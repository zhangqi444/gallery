#!/usr/bin/env python3
"""Bring every remote picture into this repository and point the posts at it.

The posts imported from Ghost refer to pictures on the old blog's CDN, so the
site depends on that host staying up. Run this once, from a machine that can
reach the CDN, to download each file into site/public/images/ and rewrite the
`image:` line of every post and page to the local copy:

    python3 site/fetch_images.py                # download and rewrite
    python3 site/fetch_images.py --dry-run      # list what it would fetch

It is safe to re-run: a picture already downloaded is left alone, and a post
already pointing at images/ is skipped. Two different URLs whose file names
collide get a numbered suffix rather than one silently overwriting the other.
Afterwards run make_bundle.py, which then checks every picture really is here.
"""
import argparse, hashlib, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
IMAGES = ROOT / "site" / "public" / "images"
FIELD = re.compile(r"^(?P<key>image|src):\s*(?P<url>https?://\S+)\s*$", re.M)
TIMEOUT = 60


def safe_name(url):
    name = url.split("?")[0].rstrip("/").split("/")[-1]
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name) or "image"
    if "." not in name:
        name += ".jpg"
    return name


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "gallery-site/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = r.read()
    if not data:
        raise OSError("empty response")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="list the pictures, download nothing")
    args = ap.parse_args()

    files = sorted(CONTENT.rglob("*.md")) + sorted(CONTENT.glob("*.json"))
    urls, per_file = {}, {}
    for f in files:
        text = f.read_text(encoding="utf-8")
        found = [m.group("url") for m in FIELD.finditer(text)]
        if found:
            per_file[f] = found
            for u in found:
                urls.setdefault(u, None)
    if not urls:
        print("every picture is already local; nothing to fetch")
        return 0

    # one local name per URL, keeping two same-named pictures apart
    taken = {p.name for p in IMAGES.glob("*")} if IMAGES.is_dir() else set()
    for url in urls:
        name = safe_name(url)
        if name in taken:
            stem, dot, ext = name.rpartition(".")
            tag = hashlib.sha1(url.encode()).hexdigest()[:6]
            name = f"{stem}-{tag}{dot}{ext}"
        taken.add(name)
        urls[url] = name

    print(f"{len(urls)} picture(s) referenced by {len(per_file)} file(s)")
    if args.dry_run:
        for url, name in urls.items():
            print(f"  {name}  <-  {url}")
        return 0

    failed = []
    for i, (url, name) in enumerate(urls.items(), 1):
        dest = IMAGES / name
        if dest.exists() and dest.stat().st_size:
            print(f"  [{i}/{len(urls)}] have {name}")
            continue
        try:
            size = download(url, dest)
            print(f"  [{i}/{len(urls)}] {name}  {size // 1024} kB")
        except Exception as e:  # noqa: BLE001 - report and carry on with the rest
            failed.append((url, e))
            print(f"  [{i}/{len(urls)}] FAILED {url}: {e}")

    ok = {u: n for u, n in urls.items() if (IMAGES / n).exists()}
    changed = 0
    for f, found in per_file.items():
        text = original = f.read_text(encoding="utf-8")
        for url in found:
            if url in ok:
                text = text.replace(url, "images/" + ok[url])
        if text != original:
            f.write_text(text, encoding="utf-8")
            changed += 1

    print(f"\nrewrote {changed} file(s) to point at site/public/images/")
    if failed:
        print(f"{len(failed)} download(s) failed and were left pointing at the CDN:")
        for url, e in failed:
            print(f"  {url}: {e}")
    print("next: python3 site/make_bundle.py && cd site && npm run build && npm test")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
