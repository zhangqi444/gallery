# Design

The look and feel of Sheila's blog, and the reasons behind it. Companion to
[architecture.md](architecture.md). The rules that must not drift are in
[AGENTS.md](../AGENTS.md) under *UI conventions*; this document explains them.

## Who it is for

Sheila, 9, who writes the posts, and the friends and family who read them. The
shape is the one she already knows from sheilazhang.org: a calm front page, big
readable titles, one column of text, pictures that are allowed to be large. That
site is the reference for how this one should look and feel, and nothing more —
no code, content or platform is shared with it.

## Principles

1. **The writing is the site.** Every screen exists to get someone to a post
   and then out of the way. No sidebars, no widgets, no counters.
2. **One colour, one meaning.** Blue is for links, topic labels and the single
   action on a screen. Everything else is neutral, in both themes.
3. **Pictures are first-class.** Cards lead with the picture; a post shows it
   full width above the text; the gallery is a page of nothing else.
4. **Dark mode is a theme, not an inversion.** Every token has a dark value
   chosen for contrast.
5. **Nothing to load.** The device's own font, inline SVG icons, one JSON fetch.

## Theme

The tokens are the "Calm Scholar" neutrals shared with isee and volunteer, with
the accent moved to blue because Sheila's favourite colour is blue. They are CSS
variables in `site/src/index.css`, mapped into Tailwind v4 with `@theme inline`.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `background` | `#f5f7fa` | `#0f1318` | page |
| `card` | `#ffffff` | `#171c23` | cards, the lightbox |
| `foreground` | `#171c24` | `#e7ebf1` | text |
| `muted-foreground` | `#5d6673` | `#9aa5b4` | excerpts, bylines, captions |
| `primary` | `#2b63c9` | `#8fb4f0` | links, topic labels, the avatar, the one button |
| `accent` | `#dde7f7` | `#1b2a42` | hover surfaces |
| `border` | `#d9dfe8` | `#2a323d` | hairlines |
| `hero-from` / `hero-to` | `#dbe8ff` → `#f5f7fa` | `#16233a` → `#0f1318` | the front page band |
| `radius` | `0.75rem` | | cards, pictures, controls |

Type is the device's own UI stack. Sizes: site name in the hero `text-6xl`
extrabold; post title `text-5xl` extrabold, tight tracking; card title `text-xl`
bold; body `1.125rem` at line-height 1.75 in a 48rem column (about 720px, wide
enough for roughly 70 characters); excerpts and bylines `text-sm` muted; topic labels `text-xs`
uppercase, letter-spaced, blue.

## Layout

- **Header**: sticky, translucent, 3.5rem. Brand (a blue circle with the first
  letter, then the name), the nav from `site.json`, the theme toggle. Under
  640px the nav folds into a menu button that opens a list below the bar and
  closes on navigation.
- **Front page**: a soft blue-to-background gradient band with the name and
  tagline; then the newest post as a wide card (picture left, text right on
  desktop); then the rest in a grid of one, two or three columns; then the
  topics as pills with counts.
- **Post**: topic labels, title, excerpt as a standfirst, byline (avatar · name
  · date · read time), the picture at 16:9 across a 64rem width, the body in a
  48rem column, older/newer cards, then three more posts to read (same topics
  first).
- **Topic**: a small header with the count, then the grid.
- **About** (any standing page): title, optional wide picture, the body.
- **Gallery**: a masonry of tiles (two columns on phones, three above) with
  caption and date under each; a tile opens the picture large in a dialog with
  its caption; Escape or the close button dismisses it.
- **Footer**: name, year, the note from `site.json`, and its links.

## Cards

A card is a bordered surface with the picture at 16:10 on top, the topic labels,
the title, the excerpt, and the byline pinned to the bottom. The whole card is
the link (the title's anchor stretches over it), the picture zooms very slightly
on hover, and the shadow lifts. The lead card on the front page puts the picture
beside the text above 768px.

## Motion and states

- The lightbox fades and scales in 200 ms. Hover zooms are 300 ms. Everything
  honours `prefers-reduced-motion`.
- An empty front page or gallery says what file would fill it.
- An unknown route shows a 404 view with one button back to the front page.

## Writing

Sentence case everywhere. Dates render through `fmtDate` ("Sep 6, 2026").
Reading time is "3 min read". Topics are lower-case words. The sample posts are
placeholders written in the voice the site is for: short, concrete, no hype.
