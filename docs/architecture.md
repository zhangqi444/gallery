# Architecture

How Sheila's blog is put together, and why. Read [AGENTS.md](../AGENTS.md) for
the rules; this document explains the structure those rules protect. Its
sibling [design.md](design.md) covers the visual design.

## One sentence

A static React site, served by GitHub Pages, whose only content is a JSON bundle
built from Markdown files in the repository.

## The shape

```
  content/                 site.json, posts/*.md, pages/*.md, gallery.json
     │
     ▼  make_bundle.py (front matter, excerpt, reading time, validation)
  site/public/content/bundle.json          committed; CI fails on drift
     │
     ▼  fetched once at boot (main.jsx → lib/content.js → the C object)
  ┌──────────────────────────────────────────────────────────────┐
  │  browser                                                     │
  │   App.jsx (hash router) ──▶ pages/* ──▶ components/*         │
  │   lib/markdown.js renders a post's Markdown with marked      │
  │   lib/theme.js toggles the .dark class; nothing else is state│
  └──────────────────────────────────────────────────────────────┘
```

There is no server, no database, no account and no editor. If a feature seems to
need one, it is the wrong feature for this site.

## Layers

| Layer | Where | Responsibility |
|---|---|---|
| Content | `content/**` → `site/public/content/bundle.json` | Posts, pages, the gallery and the site's facts. Built by `site/make_bundle.py`, which validates names, dates and pictures and derives excerpt and reading time. The bundle carries the raw Markdown so CI needs no Python packages. |
| Loader | `lib/content.js` | `loadContent()` fetches the bundle into `C`; `postBySlug`, `pageBySlug`, `postsByTag`, `tags()`, `related()`, `neighbours()` are the only lookups pages use. |
| Markdown | `lib/markdown.js` | marked, GFM, with a renderer that gives headings ids, wraps images in figures, wraps tables so they scroll inside the column, and opens external links in a new tab. Trusted content, no sanitiser. |
| Router | `lib/router.js`, `App.jsx` | `#/`, `#/post/<slug>`, `#/tag/<tag>`, `#/gallery`, `#/<slug>` for pages. Any other route is the 404 view. Navigation scrolls to the top. |
| Theme | `lib/theme.js` | Saved choice (`localStorage["gallery.theme"]`) > host `data-theme` > OS; sets the `.dark` class and the `theme-color` meta. |
| Shell | `components/site-header.jsx`, `site-footer.jsx` | Brand, the nav from `site.json` (folded into a menu on phones), the theme toggle; footer note and links. |
| Pages | `pages/*.jsx` | One file per route. `home` (hero, lead card, grid, topics), `post` (header, picture, body, older/newer, read more), `tag`, `page` (About), `gallery` (tiles and a lightbox dialog), `not-found`. |
| UI kit | `components/ui/*` | shadcn/ui `button`, `badge`, `dialog` copied into the repo. `post-card.jsx` holds the card, the avatar and the byline. |

## Build and deploy

- Vite 8 with `base: './'` so the same build works at a domain root or under
  `/gallery/`. `vite.config.js` adds the manifest link and registers the service
  worker, and (from `url` in `content/site.json`) writes the canonical link, the
  `og:` tags and the Search Console verification tag into the head and `CNAME`,
  `robots.txt` and `sitemap.xml` into `dist/`. The address is one of the site's
  facts, so it lives with the content rather than in the build config.
- `.github/workflows/pages.yml`: rebuild the bundle and fail on drift, `npm ci`,
  `npm run build`, `configure-pages` (with `enablement`), upload `site/dist`,
  `deploy-pages`. Pages **must** be on the GitHub Actions source; in branch mode
  Jekyll serves the README instead.
- `public/sw.js`: offline shell. Hashed assets are cached on first fetch;
  `index.html` and `bundle.json` are network-first so a new post shows up on the
  next visit.

## Testing

One Playwright suite, `site/test_site.cjs`, runs against the built `dist/`
served under `/gallery/` on a desktop and a touch-emulated phone. It reads the
committed bundle so its expectations (how many cards, which post leads, which
topic has how many posts) follow the content rather than being hard-coded.
Selectors are `data-testid`; a UI change that breaks one means fixing the test's
assumption, never deleting the check.

## Relationship to isee and volunteer

This repo shares the stack, the theme tokens, the docs layout and the test
layout with `zhangqi444/volunteer` and `zhangqi444/isee` on purpose. The
deliberate differences: this is a public, read-only site, so there is no Google
sign-in, no Drive mirror and no store; the shell is a blog's top bar rather than
the apps' sidebar; and the accent is blue rather than teal.
