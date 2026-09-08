#!/usr/bin/env python3
"""Ghost export JSON -> content/posts/*.md and content/pages/*.md.

Run once when moving the writing over from Ghost:

    python3 site/import_ghost.py path/to/blog.ghost.YYYY-MM-DD.json \\
        --images path/to/unzipped/content/images

The export from Ghost's Settings -> Migration -> Export content carries the
text but not the picture files; those come from the full backup zip, whose
`content/images` folder is what `--images` points at. Anything referenced but
missing is listed at the end rather than silently dropped, because a post whose
`image` is not in site/public/images/ fails make_bundle.py later.

Nothing here is invented: a field the export does not have is left out, and the
body is converted, never rewritten. Re-running overwrites what it wrote before,
so a second export after more writing is safe.
"""
import argparse, json, re, shutil, sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "content" / "posts"
PAGES = ROOT / "content" / "pages"
IMAGES = ROOT / "site" / "public" / "images"

BLOCK = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "figure", "figcaption", "hr", "div", "section"}
HEADING = {"h1": "#", "h2": "##", "h3": "###", "h4": "####", "h5": "#####", "h6": "######"}


class ToMarkdown(HTMLParser):
    """The subset of HTML that Ghost's editor produces, as Markdown."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.list_stack = []       # "ul" / "ol" nesting
        self.counters = []         # item number per ordered list
        self.in_pre = False
        self.images = []           # every src seen, in order

    # -- helpers ---------------------------------------------------------
    def w(self, s):
        self.out.append(s)

    def para_break(self):
        text = "".join(self.out)
        if text and not text.endswith("\n\n"):
            self.w("\n" if text.endswith("\n") else "\n\n")

    # -- tags ------------------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in HEADING:
            self.para_break(); self.w(HEADING[tag] + " ")
        elif tag == "p":
            self.para_break()
        elif tag in ("ul", "ol"):
            self.para_break(); self.list_stack.append(tag); self.counters.append(0)
        elif tag == "li":
            depth = max(0, len(self.list_stack) - 1)
            indent = "  " * depth
            if self.list_stack and self.list_stack[-1] == "ol":
                self.counters[-1] += 1
                marker = f"{self.counters[-1]}. "
            else:
                marker = "- "
            text = "".join(self.out)
            if text and not text.endswith("\n"):
                self.w("\n")
            self.w(indent + marker)
        elif tag == "blockquote":
            self.para_break(); self.w("> ")
        elif tag == "pre":
            self.para_break(); self.w("```\n"); self.in_pre = True
        elif tag == "code" and not self.in_pre:
            self.w("`")
        elif tag in ("strong", "b"):
            self.w("**")
        elif tag in ("em", "i"):
            self.w("*")
        elif tag == "a":
            self.w("[")
        elif tag == "img":
            src = a.get("src", "")
            if src:
                self.images.append(src)
            self.para_break()
            self.w(f'![{a.get("alt", "")}]({local_name(src)})')
            self.para_break()
        elif tag == "br":
            self.w("\n")
        elif tag == "hr":
            self.para_break(); self.w("---"); self.para_break()

    def handle_endtag(self, tag):
        if tag in HEADING or tag == "p" or tag == "blockquote":
            self.para_break()
        elif tag in ("ul", "ol"):
            if self.list_stack:
                self.list_stack.pop(); self.counters.pop()
            self.para_break()
        elif tag == "pre":
            self.in_pre = False; self.w("\n```"); self.para_break()
        elif tag == "code" and not self.in_pre:
            self.w("`")
        elif tag in ("strong", "b"):
            self.w("**")
        elif tag in ("em", "i"):
            self.w("*")
        elif tag == "a":
            self.w("]({})".format(self.href or ""))
            self.href = None
        elif tag == "figcaption":
            self.para_break()

    href = None

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        if self.in_pre:
            self.w(data)
            return
        text = re.sub(r"\s+", " ", data)
        if text.strip() == "" and not "".join(self.out[-1:]).endswith(" "):
            if text:
                self.w(" ")
            return
        self.w(text)

    def feed_link(self, attrs):
        self.href = dict(attrs).get("href")

    def result(self):
        text = "".join(self.out)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip() + "\n"


class Linked(ToMarkdown):
    """ToMarkdown, remembering each <a href> so the closing tag can use it."""

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.feed_link(attrs)
        super().handle_starttag(tag, attrs)


LOCALIZE = False


def local_name(url):
    """The picture's address for the front matter.

    Ghost serves the pictures from its own CDN, and this site can point straight
    at them, so an absolute URL is kept as it is. With --localize the URL becomes
    images/<file name> instead, for when the files have been copied into the repo
    and the site should stop depending on the old host."""
    if not url:
        return ""
    if not LOCALIZE and re.match(r"^https?://", url):
        return url
    name = url.split("?")[0].rstrip("/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name)
    return "images/" + (name or "image")


def html_to_markdown(html):
    p = Linked()
    p.feed(html or "")
    p.close()
    return p.result(), p.images


def lexical_to_html(raw):
    """Ghost 5 stores `lexical`; walk its tree into the HTML we already handle."""
    try:
        doc = json.loads(raw)
    except (TypeError, ValueError):
        return ""
    out = []

    def walk(node):
        t = node.get("type")
        kids = node.get("children", [])
        inner = "".join(walk(k) for k in kids)
        if t == "text":
            s = node.get("text", "")
            fmt = node.get("format", 0)
            if fmt & 1:
                s = f"<strong>{s}</strong>"
            if fmt & 2:
                s = f"<em>{s}</em>"
            if fmt & 16:
                s = f"<code>{s}</code>"
            return s
        if t == "linebreak":
            return "<br>"
        if t == "paragraph":
            return f"<p>{inner}</p>"
        if t == "heading":
            tag = node.get("tag", "h2")
            return f"<{tag}>{inner}</{tag}>"
        if t == "quote":
            return f"<blockquote>{inner}</blockquote>"
        if t == "list":
            tag = "ol" if node.get("listType") == "number" else "ul"
            return f"<{tag}>{inner}</{tag}>"
        if t == "listitem":
            return f"<li>{inner}</li>"
        if t == "image":
            return f'<img src="{node.get("src", "")}" alt="{node.get("altText", "")}">'
        if t == "horizontalrule":
            return "<hr>"
        if t == "code":
            return f"<pre><code>{inner}</code></pre>"
        return inner

    for child in doc.get("root", {}).get("children", []):
        out.append(walk(child))
    return "".join(out)


def body_html(rec):
    """Ghost has written three body formats over the years; take what is there."""
    if rec.get("html"):
        return rec["html"]
    if rec.get("lexical"):
        return lexical_to_html(rec["lexical"])
    if rec.get("mobiledoc"):
        try:
            md = json.loads(rec["mobiledoc"])
        except ValueError:
            return ""
        parts = []
        for section in md.get("sections", []):
            if len(section) >= 3 and section[0] == 1:
                parts.append("<p>" + "".join(m[3] if len(m) > 3 else "" for m in section[2]) + "</p>")
        return "".join(parts)
    return ""


def when(rec):
    for key in ("published_at", "created_at", "updated_at"):
        v = rec.get(key)
        if not v:
            continue
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v / 1000, timezone.utc).date().isoformat()
        m = re.match(r"^(\d{4}-\d{2}-\d{2})", str(v))
        if m:
            return m.group(1)
    return datetime.now(timezone.utc).date().isoformat()


def quote(s):
    """Front matter is a small YAML subset; quote anything that could confuse it."""
    s = str(s).replace("\n", " ").strip()
    if not s:
        return '""'
    if re.search(r'^[\s"\'\[{>|&*#!%@`-]|: |[:#]$', s) or s.lower() in ("true", "false", "null", "yes", "no"):
        return '"' + s.replace('"', '\\"') + '"'
    return s


def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def meta_for(export, post_id):
    """posts_meta holds the picture's caption and alt text, when they were set."""
    for m in export.get("posts_meta", []):
        if m.get("post_id") == post_id:
            return m
    return {}


def tags_for(export, post_id):
    by_id = {t["id"]: t for t in export.get("tags", [])}
    names = []
    for link in export.get("posts_tags", []):
        if link.get("post_id") == post_id:
            tag = by_id.get(link.get("tag_id"))
            if tag and not str(tag.get("name", "")).startswith("#"):
                names.append(str(tag.get("slug") or tag.get("name")).lower())
    return names


def find_data(doc):
    """The export nests the tables under db[0].data; accept a bare table too."""
    if isinstance(doc, dict):
        if "db" in doc and doc["db"]:
            return doc["db"][0].get("data", {})
        if "data" in doc:
            return doc["data"]
        if "posts" in doc:
            return doc
    sys.exit("that file does not look like a Ghost export: no posts table found")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("export", help="the Ghost export JSON")
    ap.add_argument("--images", help="folder of picture files from the Ghost backup zip (content/images)")
    ap.add_argument("--localize", action="store_true", help="rewrite picture URLs to images/<file>, for when the files live in this repo")
    ap.add_argument("--drafts", action="store_true", help="bring unpublished posts across as draft: true")
    ap.add_argument("--dry-run", action="store_true", help="say what would be written, write nothing")
    args = ap.parse_args()

    global LOCALIZE
    LOCALIZE = bool(args.localize or args.images)

    data = find_data(json.loads(Path(args.export).read_text(encoding="utf-8")))
    records = data.get("posts", [])
    if not records:
        sys.exit("the export has no posts")

    src_images = Path(args.images) if args.images else None
    written, wanted, skipped = [], [], []

    for rec in records:
        status = rec.get("status", "published")
        if status != "published" and not args.drafts:
            skipped.append(f'{rec.get("title", "?")} ({status})')
            continue
        title = (rec.get("title") or "").strip()
        slug = re.sub(r"[^a-z0-9-]", "", (rec.get("slug") or "").lower()).strip("-")
        if not title or not slug:
            skipped.append(f'{title or rec.get("id", "?")} (no title or slug)')
            continue

        html = body_html(rec)
        markdown, inline = html_to_markdown(html)
        date = when(rec)
        is_page = rec.get("type") == "page" or rec.get("page") is True

        meta = [f"title: {quote(title)}"]
        if not is_page:
            meta.append(f"date: {date}")
        updated = when({"published_at": rec.get("updated_at")})
        if updated != date:
            meta.append(f"updated: {updated}")
        if not is_page:
            tags = tags_for(data, rec.get("id"))
            if tags:
                meta.append("tags: [" + ", ".join(tags) + "]")
        pm = meta_for(data, rec.get("id"))
        feature = rec.get("feature_image") or ""
        if feature:
            wanted.append(feature)
            meta.append(f"image: {local_name(feature)}")
            alt = rec.get("feature_image_alt") or pm.get("feature_image_alt") or ""
            if alt:
                meta.append(f"imageAlt: {quote(strip_tags(alt))}")
            caption = strip_tags(pm.get("feature_image_caption") or "")
            if caption:
                meta.append(f"caption: {quote(caption)}")
        excerpt = (rec.get("custom_excerpt") or "").strip()
        if excerpt:
            meta.append(f"excerpt: {quote(excerpt)}")
        if status != "published":
            meta.append("draft: true")
        wanted.extend(inline)

        text = "---\n" + "\n".join(meta) + "\n---\n\n" + markdown
        target = (PAGES / f"{slug}.md") if is_page else (POSTS / f"{date}-{slug}.md")
        written.append(target)
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8")

    # pictures: only a concern once they are meant to live in the repo
    missing = []
    for url in (dict.fromkeys(wanted) if LOCALIZE else []):
        name = local_name(url).split("/", 1)[1]
        dest = IMAGES / name
        if dest.exists():
            continue
        found = None
        if src_images and src_images.is_dir():
            for cand in src_images.rglob(name):
                found = cand
                break
        if found and not args.dry_run:
            IMAGES.mkdir(parents=True, exist_ok=True)
            shutil.copy2(found, dest)
        elif not found:
            missing.append((name, url))

    verb = "would write" if args.dry_run else "wrote"
    print(f"{verb} {len(written)} file(s):")
    for p in written:
        print("  " + str(p.relative_to(ROOT)))
    if skipped:
        print(f"skipped {len(skipped)}: " + "; ".join(skipped))
    if missing:
        print(f"\n{len(missing)} picture(s) not found — put them in site/public/images/ before building:")
        for name, url in missing:
            print(f"  {name}   (from {url})")
    print("\nnext: python3 site/make_bundle.py && cd site && npm run build && npm test")


if __name__ == "__main__":
    main()
