# Architecture

How The Little Me is put together, and why. Read [AGENTS.md](../AGENTS.md) for
the rules; this document explains the structure those rules protect.
[the-little-me.md](the-little-me.md) is the plan behind the hub app, and
[design.md](design.md) covers the visual design.

## One sentence

A static React site with no backend: three modules over one Google sign-in,
each keeping its data in a folder of the child's own Drive, plus a reader that
shows a published blog to a stranger with no sign-in at all.

## Two chromes

`App.jsx` decides between them and nothing else in the app has to know.

| Address | Chrome | What it shows |
|---|---|---|
| `#/me`, `#/me/<module>` | `components/app-shell.jsx` | the modules and the account: the child's own screens |
| `#/b/<driveFileId>/…` | `components/site-header.jsx` | that published blog, read with the API key |
| everything else | the reader | this deployment's own blog: `blogId` in `site.json`, else the committed bundle |

A stranger following a link to a child's drawings should never see their
practice or their hours in a sidebar, so the reader carries no sign of the app.
`appHome` in `content/site.json` decides which of the last two answers `#/`.

## The shape

```
  content/       site.json, posts/*.md, pages/*.md   |  content/learning/**
     |  make_bundle.py                               |  make_learning.py
     v                                               v
  public/content/bundle.json                 public/content/learning/*.json
     |  the fallback, and this deployment's blog        |  one file per topic,
     v                                                  v  fetched when chosen
  +-------------------------------------------------------------------------+
  |  browser                                                                 |
  |                                                                          |
  |   lib/session.js  — the one sign-in; every module registers with it      |
  |        |                                                                 |
  |        v  adopt(email) / pull / flush                                    |
  |   lib/module-store.js  — the contract each module instantiates once      |
  |        |         gallery.json      service.json      learning.json       |
  |        v                                                                 |
  |   localStorage, synchronously  --1.2 s debounce-->  the child's own      |
  |        ^                                             Drive, a folder     |
  |        |  signed in                                  per module          |
  |   modules/gallery/content.js  <-- picks one source, normalises all three |
  |        ^                                                                 |
  |        |  #/b/<id> or site.blogId: readPublic(id) + API key, no token    |
  |   lib/google.js  — GIS token, drive.file, publish(), uploadImage()       |
  +-------------------------------------------------------------------------+
```

Every child is a tenant of nothing: their data is one JSON file per module, plus
one Drive file per picture, in their own Drive, and the app can only ever see
files it created. Publishing is a Drive permission, not a copy: `{role: reader,
type: anyone}` on the blog's file. Reading a published blog needs no token, only
the browser API key, so a visitor never meets a consent screen.

A module is a folder under `src/modules/` and a row in `registry.js`, and it
owes the shell four things: a store built by `createModuleStore`, a `summary()`
the home screen renders, a lazily imported component, and its own content if it
has any. Nothing else in the app is edited to add one — `me.jsx` lays out
whatever the registry lists, and each `lazy()` import becomes its own chunk, so
one module's code and content never load for another.

## Layers

| Layer | Where | Responsibility |
|---|---|---|
| Content | `content/**` → `site/public/content/bundle.json` | Posts, pages, the gallery and the site's facts. Built by `site/make_bundle.py`, which validates names, dates and pictures and derives excerpt and reading time. The bundle carries the raw Markdown so CI needs no Python packages. |
| Practice content | `content/learning/**` → `site/public/content/learning/*.json` | Split by topic by `site/make_learning.py`: an index of what there is to do, then a file per subject, mock, the words and the essay programme. It resolves the source's A-D answer letters into an index once, at build time, and fails the build if the index grows past 60 kB. |
| Loader | `modules/gallery/content.js`, `modules/learning/content.js` | The blog's `loadContent()` picks the author's store, a published file or the bundle and normalises all three into `C`. Learning's fetches the index at open and one topic at a time after that, remembering each. |
| Session | `lib/session.js` | One sign-in for the whole app. Modules register their store; `afterAuth` adopts them all, and signing out clears every one. |
| Store | `lib/module-store.js` | The contract a module instantiates: localStorage synchronously, its own Drive file on a 1.2 s debounce with a single 401 retry, per-record merge by `at`, tombstones in `deleted`, and a flush on `pagehide`. |
| Modules | `modules/registry.js` | The list the shell offers. Each row carries a label, a summary read from the module's store, and a `lazy()` component, so a module is added without editing the shell. |
| Markdown | `lib/markdown.js` | marked, GFM, with a renderer that gives headings ids, wraps images in figures, wraps tables so they scroll inside the column, and opens external links in a new tab. Trusted content, no sanitiser. |
| Router | `lib/router.js`, `App.jsx` | `#/me` and `#/me/<module>` in the app shell; `#/`, `#/post/<slug>`, `#/tag/<tag>`, `#/gallery` and `#/<slug>` in the reader, each optionally under `#/b/<driveFileId>` so a published blog's links keep their blog. Any other route is the 404 view. Navigation scrolls to the top. |
| Theme | `lib/theme.js` | Saved choice (`localStorage["gallery.theme"]`) > host `data-theme` > OS; sets the `.dark` class and the `theme-color` meta. |
| Shell | `components/app-shell.jsx`, `site-header.jsx`, `site-footer.jsx` | The app's chrome (modules, account, save state) and the reader's (brand, the nav from `site.json` folded into a menu on phones, the theme toggle). |
| Pages | `modules/gallery/pages/*.jsx`, `modules/<id>/index.jsx` | One file per reader route — `home`, `post`, `tag`, `page`, `gallery`, `not-found`, `studio` — and one page per module. |
| UI kit | `components/ui/*` | shadcn/ui `button`, `badge`, `dialog` copied into the repo. `modules/gallery/post-card.jsx` holds the card, the avatar and the byline. |

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

Two Playwright suites, both against the built `dist/`. `site/test_site.cjs` is
the reading site, served under `/gallery/` on a desktop and a touch-emulated
phone; it reads the committed bundle so its expectations (how many cards, which
post leads, which topic has how many posts) follow the content rather than being
hard-coded. `site/test_drive.cjs` is the app, with Google stubbed by a fake
Drive that refuses an anonymous read of an unshared file — which is what makes
the privacy checks worth anything. It also records every request for
`content/learning/`, so a change that loads all the practice content at boot
fails the suite rather than merely slowing the app down.

Selectors are `data-testid`; a UI change that breaks one means fixing the test's
assumption, never deleting the check.

## Relationship to isee and volunteer

This repo shares the stack, the theme tokens, the docs layout and the test
layout with `zhangqi444/volunteer` and `zhangqi444/isee` on purpose, and its
Google and store layers follow volunteer's. The deliberate differences: the
three apps' jobs live here as modules over one sign-in rather than three
sign-ins; the reader half is public and needs no account at all; the shell is a
top bar rather than the apps' sidebar; and the accent is blue rather than teal.

Neither old repository is modified by this work, and neither can be read from
here: `drive.file` grants an app access only to the files it created, and the
two use different client ids in different Google Cloud projects. Their data
comes across by export when there is a reason to move — see
[the-little-me.md](the-little-me.md).
