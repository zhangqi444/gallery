# AGENTS.md — Sheila's blog

Read this before changing anything. It is the contract for agents and for humans,
and it is deliberately the same shape as `zhangqi444/volunteer/AGENTS.md` and
`zhangqi444/isee/AGENTS.md`: the three sites share one stack, one look, one
docs layout and one way of testing.

## What this is

A static blog for **Sheila** (9): "Thoughts, stories and ideas." It carries the
writing and pictures from her earlier site at
[sheilazhang.org](https://sheilazhang.org), brought over once with
`site/import_ghost.py`. Posts are Markdown files in the repository; her parent
commits them. There is no editor in the browser, no comments, no accounts and
no analytics.

**It is a picture blog.** Of the 135 posts, all but fourteen are a title, a date
and one picture, with no body at all; the fourteen carry a line or two of her
own. Nineteen were never named and carry Ghost's `(Untitled)`. The UI is built
around that: no excerpt where there is no text, no reading time under fifty
words, and an untitled post shows its date as its heading.

Lives at <https://gallery.sheilazhang.org/> (a custom domain on GitHub Pages;
also reachable at <https://zhangqi444.github.io/gallery/>). Every path in the
build is relative and routing is by hash, so both addresses serve the same build.

## Repository layout

```
content/
  site.json                name, tagline, url, google, author, nav, footer
  posts/YYYY-MM-DD-slug.md one post per file: front matter, then Markdown
  pages/<slug>.md          standing pages (about); reachable at #/<slug>
  gallery.json             the gallery: src, alt, caption, date
site/
  import_ghost.py          one-off: a Ghost export JSON → content/posts/*.md and content/pages/*.md
  make_bundle.py           content/** → site/public/content/bundle.json (the site's only content input)
  index.html               Vite entry
  vite.config.js           base './', the manifest and the service worker
  src/main.jsx             boot: theme, fetch the bundle, render
  src/App.jsx              shell (header, footer) and the hash router
  src/lib/content.js       the bundle (C), lookups, tags, related, neighbours
  src/lib/markdown.js      marked with heading ids, figures, scrolling tables, external links
  src/lib/router.js        16 lines of hash routing
  src/lib/theme.js         saved choice > host data-theme > OS; the .dark class
  src/lib/format.js        fmtDate, readTime, initials
  src/components/ui/       shadcn/ui components, written into the repo (button, badge, dialog)
  src/components/          site-header, site-footer, post-card, markdown, page-title
  src/pages/               home, post, tag, page, gallery, not-found
  public/                  favicon, manifest, service worker, images/, content/bundle.json
  test_site.cjs            the Playwright suite — see Testing
.github/workflows/pages.yml  build + deploy to GitHub Pages
docs/                      architecture.md (structure and why), design.md (look, feel, and why)
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 8**, `base: './'` | static output, works under `/gallery/` |
| UI | **React 19** + **Tailwind v4** + **shadcn/ui** | components live in `src/components/ui/`, owned by the repo |
| Markdown | **marked** in the browser | the bundle carries raw Markdown; no Python packages needed in CI |
| Icons | **lucide-react** | |
| Font | the device's own UI stack | no webfont request |
| Router | hash routing in `src/lib/router.js` | GitHub Pages has no server-side rewrites |
| Content | `content/**` → `bundle.json`, fetched once at boot | one JSON, cached network-first by the worker |
| Hosting | GitHub Pages via Actions | |

**No backend, ever.** No server, no database, no account system, no comments
service, no analytics.

## Content

- **Posts** are `content/posts/YYYY-MM-DD-slug.md`. Front matter (a small YAML
  subset: `key: value`, `key: [a, b]`, `key: true`) needs `title`; `date` defaults
  to the file name's. Optional: `tags`, `image`, `imageAlt`, `excerpt`, `featured`,
  `updated`, `draft`, `slug`. The excerpt falls back to the first paragraph, cut
  at 160 characters. Reading time is words ÷ 200, at least 1.
- **Pages** are `content/pages/<slug>.md` with `title` and optional `updated`,
  `image`, `imageAlt`. The router sends any single-segment route that is not
  `gallery` to the page with that slug, so `#/about` is `pages/about.md`.
- **Gallery** is every post's picture, newest first, derived by the bundle
  script. A `content/gallery.json` overrides that with a hand-written list;
  without one there is no second list of pictures to drift from the posts.
- **Pictures** are either a file in `site/public/images/`, referenced as
  `images/<file>`, or an absolute URL. The imported posts point at the old
  blog's CDN, so the pictures are still served from there; `make_bundle.py`
  checks that a repo-relative picture exists but leaves an absolute URL alone.
  To stop depending on that host, copy the files in and re-run the import with
  `--images <folder>`. Relative paths work under the hash router because the
  document URL never changes.
- `make_bundle.py` must be re-run and `site/public/content/bundle.json`
  committed whenever `content/**` changes — CI fails the build if the committed
  bundle has drifted.
- **The address** is `url` in `site.json`. The build turns it into the canonical
  link and the `og:` tags in the head, and writes `CNAME`, `robots.txt` and
  `sitemap.xml` into `dist/`. `google.siteVerification` is the token from Google
  Search Console; while it is empty no verification tag is written. Enabling
  Pages, the DNS record and the Search Console property are the owner's, and the
  README lists them.

## Commands

```bash
cd site
npm ci
npm run dev        # local dev server
npm run build      # → site/dist   (the Pages build)
npm test           # the Playwright suite, against the built dist/
python3 site/make_bundle.py   # rebuild bundle.json after editing content/**
```

## Testing

One suite, `site/test_site.cjs`, run against the built `dist/` served under
`/gallery/` on a desktop and a touch-emulated phone: the hero and the cards, the
phone menu, a post reached from its card (title, headings, lists, read more,
older/newer), a topic page, About, the gallery and its lightbox, the 404 view,
and the theme toggle surviving a reload. It also writes `shot-*.png` for a look.

Rules: every feature gets checks; a UI change that breaks a selector means fixing
the test's *assumption*, not deleting the check. Selectors are `data-testid`.
The suite must pass before a commit.

## UI conventions

- shadcn/ui components only; if one is missing, add it to `src/components/ui/`
  rather than hand-rolling a div. Blog-specific pieces (cards, header) live in
  `src/components/`.
- The layout follows the reference site's: a hero with the name and tagline, the
  newest post leading, a three-column card grid, a 720px reading column, topics as
  small uppercase links in the accent colour, a byline of avatar · name · date ·
  read time.
- Dark mode is a first-class theme, not an inversion. Tokens in `src/index.css`
  are the "Calm Scholar" neutrals shared with isee and volunteer, with the accent
  moved to **blue** for this site.
- Colour has one meaning: *primary* (blue) is links, topics and the one action
  on a screen. Nothing else is coloured.
- Every route is reachable from the header; the header folds to a menu on
  phones, so nothing may live only in the inline nav.
- Dates render through `fmtDate` ("Sep 6, 2026"). Sentence case everywhere.

## Content rules

- **Never invent a fact about Sheila.** The sample posts, the About page and the
  placeholder pictures in this repository are starters to be replaced with her
  own words and pictures; do not extend them with made-up biography.
- Written by and for a nine-year-old and the parent reading with her: short,
  concrete, no hype, no exclamation marks.
- Every picture has an `alt` text.

## Hard rules

1. **Her writing is sacred.** Never rewrite, shorten or "improve" the text of a
   post. Fix a typo only when asked.
2. **No backend, no accounts, no comments, no third-party analytics or fonts.**
   The site is the repository and nothing else.
3. Pushes to `main` deploy immediately; a red build is fixed before anything
   else.
