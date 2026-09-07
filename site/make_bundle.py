#!/usr/bin/env python3
"""content/** -> site/public/content/bundle.json, the site's only content input.

Reads content/site.json, every Markdown file in content/posts and content/pages
(front matter between --- lines, then the body), and content/gallery.json.
Validates what a post needs (title, date, slug from the file name), derives the
excerpt and reading time, sorts posts newest first, and writes a deterministic
bundle so CI can fail the build when the committed bundle has drifted.

Front matter is a small YAML subset: `key: value`, `key: [a, b]`, and
`key: true/false`. Nothing else is needed for a blog."""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "site" / "public" / "content" / "bundle.json"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

def scalar(v):
    v = v.strip()
    if v in ("true", "false"):
        return v == "true"
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v

def front_matter(text, where):
    if not text.startswith("---"):
        sys.exit(f"{where}: no front matter")
    head, sep, body = text[3:].partition("\n---")
    if not sep:
        sys.exit(f"{where}: unterminated front matter")
    meta = {}
    for line in head.strip().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        k, s, v = line.partition(":")
        if not s:
            sys.exit(f"{where}: cannot read front matter line {line!r}")
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            meta[k.strip()] = [scalar(x) for x in v[1:-1].split(",") if x.strip()]
        else:
            meta[k.strip()] = scalar(v)
    return meta, body.lstrip("\n")

def plain(md):
    """Markdown body -> plain text, for the excerpt."""
    t = re.sub(r"```.*?```", "", md, flags=re.S)
    t = re.sub(r"^#{1,6}\s+.*$", "", t, flags=re.M)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*_`>#]", "", t)
    return re.sub(r"\s+", " ", t).strip()

def excerpt(md, limit=160):
    for para in re.split(r"\n\s*\n", md):
        p = plain(para)
        if p:
            return p if len(p) <= limit else p[:limit].rsplit(" ", 1)[0] + "…"
    return ""

def read_post(path):
    meta, body = front_matter(path.read_text(encoding="utf-8"), path.name)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})-(.+)\.md$", path.name)
    if not m:
        sys.exit(f"{path.name}: post files are named YYYY-MM-DD-slug.md")
    slug = meta.get("slug") or m.group(2)
    if not SLUG.match(slug):
        sys.exit(f"{path.name}: bad slug {slug!r}")
    date = str(meta.get("date") or m.group(1))
    if not DATE.match(date):
        sys.exit(f"{path.name}: date must be YYYY-MM-DD")
    if not meta.get("title"):
        sys.exit(f"{path.name}: missing title")
    tags = meta.get("tags", [])
    if isinstance(tags, str):
        tags = [tags]
    words = len(plain(body).split())
    return {
        "slug": slug,
        "title": meta["title"],
        "date": date,
        "updated": str(meta.get("updated") or date),
        "tags": [str(t).strip().lower() for t in tags if str(t).strip()],
        "excerpt": meta.get("excerpt") or excerpt(body),
        "image": meta.get("image", ""),
        "imageAlt": meta.get("imageAlt", ""),
        "caption": meta.get("caption", ""),
        "featured": bool(meta.get("featured", False)),
        "draft": bool(meta.get("draft", False)),
        "words": words,
        # 0 unless the post is long enough for a reading time to mean anything.
        # Most posts here are a picture with a one-line caption, and telling a
        # reader that three words take "1 min" is worse than saying nothing.
        "minutes": max(1, round(words / 200)) if words >= 50 else 0,
        "body": body,
    }

def read_page(path):
    meta, body = front_matter(path.read_text(encoding="utf-8"), path.name)
    slug = meta.get("slug") or path.stem
    if not SLUG.match(slug):
        sys.exit(f"{path.name}: bad slug {slug!r}")
    if not meta.get("title"):
        sys.exit(f"{path.name}: missing title")
    return {
        "slug": slug,
        "title": meta["title"],
        "updated": str(meta.get("updated", "")),
        "image": meta.get("image", ""),
        "imageAlt": meta.get("imageAlt", ""),
        "body": body,
    }

def main():
    site = json.loads((CONTENT / "site.json").read_text(encoding="utf-8"))
    for k in ("title", "description", "author", "nav"):
        if k not in site:
            sys.exit(f"site.json: missing {k}")
    posts = [read_post(p) for p in sorted((CONTENT / "posts").glob("*.md"))]
    pages = [read_page(p) for p in sorted((CONTENT / "pages").glob("*.md"))]
    seen = set()
    for p in posts + pages:
        if p["slug"] in seen:
            sys.exit(f"duplicate slug {p['slug']}")
        seen.add(p["slug"])
    for p in posts:
        p.pop("draft") if not p["draft"] else None
    posts = [p for p in posts if not p.get("draft")]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    # The gallery is every post picture, newest first, unless content/gallery.json
    # spells out its own list. On a blog whose posts are pictures, keeping a
    # second hand-written list would only drift from them.
    gallery_file = CONTENT / "gallery.json"
    if gallery_file.exists():
        gallery = json.loads(gallery_file.read_text(encoding="utf-8"))
    else:
        untitled = lambda t: re.fullmatch(r"\(?\s*untitled\s*\)?", (t or "").strip(), re.I) is not None
        gallery = [
            {"src": p["image"], "alt": p["imageAlt"] or p["title"],
             "caption": "" if untitled(p["title"]) else p["title"],
             "date": p["date"], "slug": p["slug"]}
            for p in posts if p["image"]
        ]
    for g in gallery:
        if not g.get("src") or not g.get("alt"):
            sys.exit("gallery.json: every item needs src and alt")
        g.setdefault("caption", ""); g.setdefault("date", "")
    gallery.sort(key=lambda g: (g["date"], g["src"]), reverse=True)
    # A picture is either a file in site/public/ or an absolute URL on the host
    # that still serves it; a repo-relative path that is not there is a mistake
    # the build should catch rather than a broken picture on the live site.
    for item in posts + pages + gallery:
        for key in ("image", "src"):
            src = item.get(key)
            if src and not src.startswith(("http://", "https://")) and not (ROOT / "site" / "public" / src).exists():
                sys.exit(f"{item.get('slug') or src}: image {src} is not in site/public/")
    bundle = {"schema": 1, "site": site, "posts": posts, "pages": pages, "gallery": gallery}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bundle, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(posts)} posts, {len(pages)} pages, {len(gallery)} gallery items")

if __name__ == "__main__":
    main()
