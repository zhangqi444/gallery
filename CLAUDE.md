# CLAUDE.md

**Read [AGENTS.md](AGENTS.md) first** — project context, stack, the content
rules, testing and the hard rules live there. This file is only the working
agreement for Claude Code sessions. It mirrors `zhangqi444/volunteer/CLAUDE.md`
and `zhangqi444/isee/CLAUDE.md`; when they drift, this project follows isee.

## Before you change anything

- Work in `site/`. Content edits go in `content/**`, then re-run
  `python3 site/make_bundle.py` and commit the regenerated bundle.
- Keep this site consistent with `isee` and `volunteer`: same tokens (with this
  site's blue accent), component library, test layout and docs. A convention
  added to one belongs in the others.
- Never touch the wording of a post unless asked; see the hard rules.

## Before you commit

```bash
cd site && npm run build && npm test
python3 site/make_bundle.py && python3 site/make_learning.py
git diff --exit-code -- site/public/content/
```

If a check fails because the UI legitimately changed, fix the test's assumption —
never delete the check.

## Committing and pushing

- Work on `main` directly; the owner asked for that in the remote session.
  Push after every green commit — the Pages build follows automatically.
- Commit messages: what changed and *why it was wrong before*, in prose. No
  bullet-point changelogs of file names.
- Trailers:

```
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: <session url>
```

## Things that have bitten before

- Pages must have **Source: GitHub Actions**. With "Deploy from a branch" GitHub
  runs Jekyll over the repo root and serves the README instead of the site.
  The workflow cannot turn Pages on by itself: until the owner enables it once
  in Settings → Pages, `configure-pages` fails with "Resource not accessible by
  integration" even though the bundle check and the build before it pass.
- `sheilazhang.org` and the Internet Archive are not reachable from the remote
  sandbox, so the layout was reconstructed from the search summary of its pages
  and from the conventions its theme follows. It is a visual reference only:
  this repository is a blog of its own, sharing no code or platform with it.
- Pictures must be in `site/public/images/`; `make_bundle.py` refuses a post
  whose `image` is not there.
- The domain cannot be configured from the remote sandbox, and neither can the
  deploy be re-run: the Pages REST path is blocked by the proxy, `rerun-failed-jobs`
  and `workflow_dispatch` both answer 403 for the session's token, GitHub's
  sign-in page and Cloudflare are blocked as well, so a browser cannot log in
  either. The repo carries the address (`url` in `content/site.json` → `CNAME`,
  `robots.txt`, `sitemap.xml`, head tags); enabling Pages, the Cloudflare record
  and Search Console are the owner's, and the README lists them in order.
- Check `has_pages` on the repository (`/repos/{owner}/{repo}`, which the proxy
  does allow) before assuming a deploy can succeed. It was `false` after the
  rename, which is why every *Deploy site* run had failed.

## Verification habit

Screenshot the page you changed — desktop, phone width, and dark mode — and look
at it before saying it is done. The suite writes `shot-*.png` into `site/`.
