# Sheila's blog

A new static blog for Sheila, laid out like [sheilazhang.org](https://sheilazhang.org): a front
page with the site's name and tagline, the newest post leading and the rest in a
grid, a reading page per post, topics, an **About** page, and a **Gallery** of
pictures. Posts are Markdown files in `content/posts`; nothing else is needed to
publish one.

There is no backend and no CMS. The site builds with Vite and deploys to GitHub
Pages from `.github/workflows/pages.yml`. It lives at
<https://gallary.sheilazhang.org/> (also <https://zhangqi444.github.io/gallary/>),
next to its siblings [`volunteer`](https://github.com/zhangqi444/volunteer) and
[`isee`](https://github.com/zhangqi444/isee), whose stack and conventions it shares.

`AGENTS.md` is the contract; `CLAUDE.md` is the working agreement for agent
sessions; `docs/architecture.md` explains the structure and `docs/design.md` the
look and feel.

## Writing a post

1. Add `content/posts/YYYY-MM-DD-slug.md`:

   ```markdown
   ---
   title: Paper boats on the pond
   date: 2026-08-24
   tags: [making, outdoors]
   image: images/post-boats.svg
   imageAlt: Three paper boats on rippling water
   excerpt: One sentence for the card. Optional; the first paragraph is used otherwise.
   ---

   The story, in Markdown.
   ```

   Optional keys: `featured: true`, `updated: YYYY-MM-DD`, `draft: true` (kept out
   of the site), `slug:` (defaults to the file name).
2. Put pictures in `site/public/images/` and refer to them as `images/name.ext`.
3. Run `python3 site/make_bundle.py` and commit the regenerated
   `site/public/content/bundle.json` together with the post.

Standing pages (About, …) are `content/pages/<slug>.md` with `title` and
optional `updated`, `image`, `imageAlt`; they are reachable at `#/<slug>`. The
gallery is `content/gallery.json`: `src`, `alt`, `caption`, `date`. The site's
name, tagline, author and navigation are in `content/site.json`.

The sample posts and pictures in this repository are placeholders to replace
with Sheila's own.

## Layout

    content/site.json         name, tagline, author, nav, footer
    content/posts/*.md        posts, one file each, named YYYY-MM-DD-slug.md
    content/pages/*.md        standing pages (about)
    content/gallery.json      the gallery
    site/make_bundle.py       content/** → site/public/content/bundle.json
    site/index.html           Vite entry
    site/vite.config.js       base './', manifest and service worker
    site/src/main.jsx         boot: theme, content, render
    site/src/App.jsx          shell (header, footer) and the hash router
    site/src/lib/             content, router, theme, markdown, format
    site/src/components/      site-header, site-footer, post-card, markdown; ui/ (shadcn)
    site/src/pages/           home, post, tag, page, gallery, not-found
    site/public/              favicon, manifest, service worker, images/, content/bundle.json
    site/test_site.cjs        the Playwright suite
    .github/workflows/pages.yml  build + deploy to GitHub Pages
    docs/                     architecture.md, design.md

## Build

    cd site
    npm ci
    npm run dev       # http://localhost:5173
    npm run build     # → site/dist
    npm test          # the Playwright suite, against dist/ (needs Chromium)
    python3 site/make_bundle.py   # after editing content/**; commit the bundle

## Publishing on GitHub Pages

`.github/workflows/pages.yml` runs on every push to `master` that touches
`site/`, `content/` or the workflow, rebuilds the bundle and fails if it differs
from the committed one, builds with `npm ci && npm run build` and publishes
`site/dist`. Pages must be set to **Source: GitHub Actions** (Settings → Pages).
Every asset path is relative (`base: './'`) and routing is by hash, so the same
build works at a domain root or under `/gallary/`.
