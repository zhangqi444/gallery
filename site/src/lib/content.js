/* The content bundle, fetched once at boot. Everything the site shows comes from here. */
export const C = { site: null, posts: [], pages: [], gallery: [] }

export async function loadContent() {
  const res = await fetch("content/bundle.json", { cache: "no-cache" })
  if (!res.ok) throw new Error("content bundle missing (" + res.status + ")")
  Object.assign(C, await res.json())
  return C
}

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
