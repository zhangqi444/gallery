/* What the reading pages show, from whichever source is in play:
 *
 *   1. `#/b/<driveFileId>/…`  a published blog, read straight from its owner's
 *      Drive with no sign-in — this is how a stranger reads someone's blog.
 *   2. `blogId` in content/site.json — the same, for the blog this deployment
 *      is the home of, so its own address needs no id in the URL.
 *   3. the built-in bundle — content committed to the repository.
 *
 * A signed-in author is switched to their own store, so the site they are
 * looking at is the one they are editing.
 *
 * The three sources are normalised to one read model here, so no page has to
 * know where its posts came from. */
import * as Drive from "@/lib/google"
import { normalize } from "./model"

export const C = { site: null, posts: [], pages: [], gallery: [], source: "bundle", blogId: "" }

let bundle = null       // the committed content, kept as the fallback

const listeners = new Set()
export function onContent(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const emit = () => listeners.forEach((f) => f())

/* ---------- derived fields, matching site/make_bundle.py ---------- */

const plain = (md) =>
  String(md || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()

function excerptOf(md, limit = 160) {
  for (const para of String(md || "").split(/\n\s*\n/)) {
    const p = plain(para)
    if (p) return p.length <= limit ? p : p.slice(0, limit).replace(/\s\S*$/, "") + "…"
  }
  return ""
}

/** A Drive post becomes the same shape the bundle uses. */
function readPost(p) {
  const words = plain(p.body).split(/\s+/).filter(Boolean).length
  return {
    slug: p.slug,
    title: p.title,
    date: p.date,
    updated: p.at ? String(p.at).slice(0, 10) : p.date,
    tags: p.tags || [],
    excerpt: p.excerpt || excerptOf(p.body),
    image: p.imageId ? Drive.imageUrl(p.imageId) : p.image || "",
    imageAlt: p.imageAlt || "",
    caption: p.caption || "",
    featured: false,
    words,
    minutes: words >= 50 ? Math.max(1, Math.round(words / 200)) : 0,
    body: p.body || "",
  }
}

const untitled = (t) => /^\(?\s*untitled\s*\)?$/i.test(String(t || "").trim())

/** The site's own facts, taking whatever the blog file set and falling back to
 *  the deployment's, so a blog that never named itself still has a title. */
function readSite(data) {
  const base = (bundle && bundle.site) || {}
  const s = data.site || {}
  // content/site.json carries `author` as an object; a Drive dataset carries it
  // as the author's name. Take a name out of either without caring which.
  const nameOf = (a) => (typeof a === "string" ? a : (a && a.name) || "")
  const baseAuthor = typeof base.author === "object" && base.author ? base.author : {}
  return {
    ...base,
    title: s.title || base.title || "A blog",
    description: s.description || base.description || "",
    author: { ...baseAuthor, name: nameOf(s.author) || nameOf(base.author) || "" },
    nav: base.nav || [{ label: "Home", to: "/" }],
    footer: base.footer || { note: "", links: [] },
    // Whether `#/` is the app or this deployment's blog. A blog home is the
    // default so a build with committed posts still opens on them.
    appHome: Boolean(base.appHome),
  }
}

function apply(source, data, blogId = "") {
  const posts = (data.posts || []).map(readPost)
  C.site = readSite(data)
  C.posts = posts
  C.pages = (bundle && bundle.pages) || []
  C.gallery = posts
    .filter((p) => p.image)
    .map((p) => ({ src: p.image, alt: p.imageAlt || p.title, caption: untitled(p.title) ? "" : p.title, date: p.date, slug: p.slug }))
  C.source = source
  C.blogId = blogId
  emit()
  return C
}

/** The blog id in the address, from `#/b/<id>/…`. */
export function blogIdFromHash(hash = location.hash) {
  const m = /^#\/b\/([A-Za-z0-9_-]{10,})/.exec(hash || "")
  return m ? m[1] : ""
}

export async function loadBundle() {
  if (bundle) return bundle
  const res = await fetch("content/bundle.json", { cache: "no-cache" })
  if (!res.ok) throw new Error("content bundle missing (" + res.status + ")")
  bundle = await res.json()
  return bundle
}

/** Resolve and load whichever blog this page should show. */
export async function loadContent() {
  await loadBundle()
  const wanted = blogIdFromHash() || bundle.site.blogId || ""
  if (wanted) {
    try {
      const data = normalize(await Drive.readPublic(wanted))
      return apply("drive", data, wanted)
    } catch (e) {
      // A blog that cannot be read must not take the site down with it: fall
      // back to what is committed and let the page say what went wrong.
      C.error = e.message
    }
  }
  return apply("bundle", { site: bundle.site, posts: bundle.posts }, "")
}

/** Show the signed-in author their own data, so editing is a live preview. */
export function showMine(data) { return apply("mine", data, "") }

/** Back to whatever the address asks for, after signing out. */
export function showPublished() { return loadContent() }

export const postBySlug = (slug) => C.posts.find((p) => p.slug === slug)
export const pageBySlug = (slug) => C.pages.find((p) => p.slug === slug)
export const postsByTag = (tag) => C.posts.filter((p) => p.tags.includes(tag))

/** Every tag with its post count, most used first. */
export function tags() {
  const n = new Map()
  for (const p of C.posts) for (const t of p.tags) n.set(t, (n.get(t) || 0) + 1)
  return [...n].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Up to `n` other posts to read next: same tags first, then newest. */
export function related(post, n = 3) {
  const score = (p) => p.tags.filter((t) => post.tags.includes(t)).length
  return C.posts.filter((p) => p.slug !== post.slug)
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n).map((x) => x.p)
}

/** Previous (older) and next (newer) post around `post`. */
export function neighbours(post) {
  const i = C.posts.findIndex((p) => p.slug === post.slug)
  return { newer: C.posts[i - 1] || null, older: C.posts[i + 1] || null }
}
