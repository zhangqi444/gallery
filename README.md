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
<https://gallery.sheilazhang.org/> (also <https://zhangqi444.github.io/gallery/>),
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

Sign-in is off until `site/google.json` has real values; without them the site
just shows the content committed here. Both values are public and belong in the
page — the client id names the OAuth app, and the browser API key only reads
files their owners have already shared. Neither is a secret, but restrict the key
to this site by HTTP referrer.

1. In the Google Cloud console create a project, then an **OAuth client ID** of
   type *Web application*. Add this site's origin to *Authorised JavaScript
   origins*. The only scope used is `drive.file`, which is non-sensitive, so
   there is no verification review and no warning screen.
2. Create an **API key** in the same project and enable the **Google Drive API**.
   Restrict the key by HTTP referrer to this site, and by API to Drive.
3. Put both in `site/google.json`:

       { "client_id": "….apps.googleusercontent.com", "api_key": "…" }

4. Rebuild. The header grows a pencil icon; `#/studio` is the author's page.

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
3. **DNS** (the `sheilazhang.org` zone is at Cloudflare): the `gallery` record
   points at `zhangqi444.github.io` and its cloud must be **grey (DNS only)**.
   Orange proxies the name through Cloudflare, and GitHub then cannot verify the
   domain or issue a certificate.
4. **Custom domain**: Settings → Pages → Custom domain → `gallery.sheilazhang.org`
   → Save. Wait for the DNS check, then tick **Enforce HTTPS** once the
   certificate is issued, which can take about fifteen minutes.

For **Google Search Console**, add `gallery.sheilazhang.org` as a *URL prefix*
property, choose the *HTML tag* method, paste the `content="…"` value into
`google.siteVerification` in `content/site.json`, run
`python3 site/make_bundle.py`, commit and push, then press *Verify*. Submit
`https://gallery.sheilazhang.org/sitemap.xml` under Sitemaps. (A *Domain*
property verified by a DNS TXT record works too and needs no token in the
repository.)

There is no Google Analytics and no Google sign-in here; see the hard rules in
`AGENTS.md`.
