# Sheila's blog

A blog whose data belongs to whoever wrote it. Sign in with Google and your posts
and pictures live in **your own Google Drive**; press Publish and one file is
shared so anyone with the link can read it without signing in to anything. Every
author is their own tenant and there is no server, no database and no shared
store — the same contract as [`volunteer`](https://github.com/zhangqi444/volunteer)
and [`isee`](https://github.com/zhangqi444/isee).

This deployment is also the home of Sheila's blog, laid out like
[sheilazhang.org](https://sheilazhang.org): a front
page with the site's name and tagline, the newest post leading and the rest in a
grid, a reading page per post, topics, an **About** page, and a **Gallery** of
pictures. Posts are Markdown files in `content/posts`; nothing else is needed to
publish one.

There is no backend and no CMS. The site builds with Vite and deploys to GitHub
Pages from `.github/workflows/pages.yml`. It lives at
<https://thelittleme.org/> (also <https://zhangqi444.github.io/gallery/>),
next to its siblings [`volunteer`](https://github.com/zhangqi444/volunteer) and
[`isee`](https://github.com/zhangqi444/isee), whose stack and conventions it shares.

## The Little Me

The blog is one of three modules in a hub app for one child, reached at `#/me`
behind a single Google sign-in:

| Module | What it keeps |
|---|---|
| **Learning** | practice sets, mock exam sections, the weekly words, a reading log and the essay programme |
| **Service** | the places she helps, what she has taken on there, and the hours against it |
| **Gallery** | the pictures and posts of this blog, and the one button that publishes them |

Each module keeps its own file in its own folder of the child's Drive, so one
can be added or rewritten without touching another's data. A stranger following
a published link never sees any of it: the reader has no sign of the app around
it. `docs/the-little-me.md` has the shape, the storage and what is left to do.

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

The posts came across from Sheila's Ghost blog with `site/import_ghost.py`,
which is kept for a second pass if more are written there:

    python3 site/import_ghost.py path/to/export.json            # keep the CDN's pictures
    python3 site/import_ghost.py path/to/export.json --images D # copy pictures from folder D

Most posts are a picture with a title and a date and no body, so the site shows
no excerpt and no reading time for them, and a post Ghost never named shows its
date as its heading.

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

## Setting up Google

Sign-in is off until the build has a Google client id; without one the site just
shows the content committed here, and **The Little Me** cannot be reached at all.
Both values below are public and belong in the page — the client id names the
OAuth app, and the browser API key only reads files their owners have already
shared. Neither is a secret, but restrict the key to this site by HTTP referrer.

1. In the Google Cloud console create a project, then an **OAuth client ID** of
   type *Web application*. Under *Authorised JavaScript origins* add every
   address the app is served from:

       https://thelittleme.org
       https://zhangqi444.github.io
       http://localhost:5173          (only for `npm run dev`)

   No redirect URIs are needed: sign-in is a popup token request, not a
   redirect. The only scope used is `drive.file`, which is non-sensitive, so
   there is no verification review and no warning screen.
2. Create an **API key** in the same project and enable the **Google Drive API**.
   Restrict the key by HTTP referrer to those origins, and by API to Drive.
3. Give them to the build. Either is enough, and the environment wins:

   - **For the deployed site** — GitHub → *Settings* → *Secrets and variables* →
     *Actions* → *Variables* → **New repository variable**, twice:

         OAUTH_CLIENT_ID = ….apps.googleusercontent.com
         GOOGLE_API_KEY  = …

     Then trigger a build: push anything under `site/` or `content/`, or run
     *Deploy site* from the Actions tab. Variables are read at build time, so a
     change to them only takes effect on the next run.
   - **For local development** — `site/google.json`:

         { "client_id": "….apps.googleusercontent.com", "api_key": "…" }

     It is committed empty on purpose, so a clone of this repository builds
     without sign-in rather than inheriting somebody else's Google project.
4. Reload the site. The blog's header grows a pencil that opens **The Little
   Me** at `#/me`: sign in once, and Learning, Service and Gallery each keep
   their own file in a folder of that Google account's Drive.

To make this deployment show a published Drive blog instead of the committed
posts, put that blog's file id in `blogId` in `content/site.json`. Any blog is
also readable at `#/b/<fileId>` without configuring anything.

## Build

    cd site
    npm ci
    npm run dev       # http://localhost:5173
    npm run build     # → site/dist
    npm test          # the Playwright suite, against dist/ (needs Chromium)
    python3 site/make_bundle.py   # after editing content/**; commit the bundle

## Publishing on GitHub Pages

`.github/workflows/pages.yml` runs on every push to `main` that touches
`site/`, `content/` or the workflow, rebuilds the bundle and fails if it differs
from the committed one, builds with `npm ci && npm run build` and publishes
`site/dist`. Pages must be set to **Source: GitHub Actions** (Settings → Pages).
Every asset path is relative (`base: './'`) and routing is by hash, so the same
build works at a domain root or under `/gallery/`.

## The address and Google

The address is `url` in `content/site.json`. The build writes it into the head
(canonical link, `og:` tags) and into `dist/CNAME`, `dist/robots.txt` and
`dist/sitemap.xml`. Four things live outside the repository and only the owner
can do them, in this order:

1. **Turn Pages on**: Settings → Pages → Build and deployment → Source →
   **GitHub Actions**. Nothing is published until this is done: the workflow
   cannot enable Pages by itself, and `configure-pages` fails the deploy with
   "Resource not accessible by integration".
2. **Deploy**: Actions → *Deploy site* → the failed run → *Re-run all jobs*.
   When it is green, `https://zhangqi444.github.io/gallery/` serves the blog,
   which proves the site works with the domain out of the picture.
3. **DNS** (the `thelittleme.org` zone is at Cloudflare): the apex carries the
   four GitHub Pages `A` records (`185.199.108-111.153`) and the four matching
   `AAAA` records (`2606:50c0:800{0,1,2,3}::153`), and `www` is a `CNAME` to
   `zhangqi444.github.io`. Every one of them must be **grey (DNS only)**. Orange
   proxies the name through Cloudflare, and GitHub then cannot verify the domain
   or issue a certificate.
4. **Custom domain**: the deploy sets it from `url` in `content/site.json`, which
   the build writes into `CNAME`. Do not type it into Settings → Pages as well —
   the two then fight on every deploy. After the first deploy on a new name, tick
   **Enforce HTTPS** once the certificate is issued, which can take about fifteen
   minutes.

**Google Search Console** holds `thelittleme.org` as a *Domain* property,
verified by a `TXT` record on the apex, so nothing is needed in the repository
and `google.siteVerification` in `content/site.json` stays empty. Submit
`https://thelittleme.org/sitemap.xml` under Sitemaps. (The *URL prefix* +
*HTML tag* route works too: its token goes in `google.siteVerification` and the
build puts the meta tag in the head — but that is a different token, and the
DNS value cannot stand in for it.)

There is no Google Analytics and no Google sign-in here; see the hard rules in
`AGENTS.md`.
