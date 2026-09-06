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
python3 site/make_bundle.py && git diff --exit-code -- site/public/content/bundle.json
```

If a check fails because the UI legitimately changed, fix the test's assumption —
never delete the check.

## Committing and pushing

- Work on `master` directly; the owner asked for that in the remote session.
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
  sandbox; the layout here was built from Ghost's Casper theme, which that site
  uses, and from the search summary of its pages. This site is new and does not
  use Ghost.
- Pictures must be in `site/public/images/`; `make_bundle.py` refuses a post
  whose `image` is not there.

## Verification habit

Screenshot the page you changed — desktop, phone width, and dark mode — and look
at it before saying it is done. The suite writes `shot-*.png` into `site/`.
