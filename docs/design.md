# Design

The look and feel of The Little Me — the blog a stranger reads and the app the
child uses — and the reasons behind it. Companion to
[architecture.md](architecture.md). The rules that must not drift are in
[AGENTS.md](../AGENTS.md) under *UI conventions*; this document explains them.

## Who it is for

Sheila, 9, who makes the pictures, and the friends and family who look at them.
The shape is the one she already knows from sheilazhang.org: a calm front page,
big readable titles, pictures that are allowed to be large.

**The content decides the design.** Almost every post is one picture with a
title and a date. So a card is a picture with its title under it and no excerpt,
because there is nothing to excerpt; a post page is the picture at up to 80% of
the screen's height, uncropped, with its caption when it has one; nothing claims
a reading time unless there are at least fifty words; and the front page opens on
the newest two dozen with a button for more, because three years of pictures in
one grid is a page nobody can use.

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

## The app's screens

The app shares every token, component and rule below; only the chrome differs.

- **Shell**: the same sticky bar, with the modules where the blog's nav is, and
  at the right the save state in words ("Saving…", "Saved to Drive"), the theme
  toggle and sign out. The save state is written out rather than shown as a dot,
  because a child should be able to see that her work is kept without being told
  to trust it.
- **Home**: "Hello, <name>", then one card per module. Each card carries what
  that module says about itself — "12 pictures", "6 hours", "30 questions
  answered", and a line under it — so the home screen is a report rather than a
  menu, and a fourth module needs no edit here.
- **A module page**: one column at 42rem, a title in the first person ("My
  practice"), and tabs where a module has more than one thing to do. Nothing is
  behind a settings screen.
- **Practice**: one question at a time, the choices as full-width buttons, and
  the marking under them the moment one is pressed — right or wrong, with the
  explanation. Colour never carries the answer alone: the right choice is
  outlined in the accent and ticked, a wrong pick is crossed as well as
  reddened, and the sentence above says which it was in words.
- **My pictures**: one row per picture — thumbnail, title, date, and the
  buttons, which wrap under the title rather than squeezing it on a phone.
  Everything else about a post (the description, a caption, topics, a note) is
  folded away behind a chevron, because almost every post is a picture with a
  title and nothing else. The one nag: a picture with no description says
  *Describe this picture* where its caption would go, and pressing that opens
  the field it is about.
- **Writing**: the plan boxes, then the draft in its three parts with a running
  word count, then the week's own checks. No score, no grade, no badge — an
  essay is judged by a person, and the screen must not pretend otherwise.

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
Reading time is "3 min read". Topics are lower-case words. The posts are hers
and are never rewritten; anything this repository adds around them — a label, an
empty state, a hint in a form — is written in the same voice: short, concrete,
no hype, no exclamation marks.
