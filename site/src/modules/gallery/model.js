/* The data model for one blog: what a valid dataset looks like, and how any
 * JSON (a Drive file, a backup, the bundled seed) is coerced into one.
 *
 * Every record carries `at`, the ISO time of its last edit, so two devices can
 * be merged last-write-wins per record, and `deleted` holds tombstones so a
 * deletion on one device is not undone by the other's copy. The shape follows
 * zhangqi444/volunteer and zhangqi444/isee; only the records differ. */

export const SCHEMA = 1

const str = (v) => String(v ?? "")
const trimmed = (v) => str(v).trim()
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SLUG_OK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const todayISO = () => new Date().toISOString().slice(0, 10)
export const nowISO = () => new Date().toISOString()
export const ts = (v) => {
  const n = Date.parse(v || "")
  return Number.isNaN(n) ? 0 : n
}

/** A title into a URL-safe slug; falls back to the date when nothing survives. */
export function slugify(title, date) {
  const s = str(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return s || str(date || todayISO())
}

export function emptyData() {
  return {
    schema: SCHEMA,
    updatedAt: nowISO(),
    site: { title: "", description: "", author: "", at: "" },
    posts: [],
    deleted: {},
  }
}

/** One post: a picture, a title, a date, and optionally a caption and tags. */
export function newPost(f = {}) {
  const date = ISO_DATE.test(f.date) ? f.date : todayISO()
  return {
    id: uid(),
    slug: SLUG_OK.test(str(f.slug)) ? f.slug : slugify(f.title, date),
    title: trimmed(f.title),
    date,
    caption: trimmed(f.caption),
    tags: normalizeTags(f.tags),
    // A picture lives in the same Drive as this file. `imageId` is its Drive
    // file id; `image` is a plain URL, for pictures that live elsewhere.
    imageId: trimmed(f.imageId),
    image: trimmed(f.image),
    imageAlt: trimmed(f.imageAlt),
    body: str(f.body),
    createdAt: nowISO(),
    at: nowISO(),
  }
}

export function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",") : []
  return [...new Set(list.map((t) => trimmed(t).toLowerCase()).filter(Boolean))]
}

/** Coerce arbitrary JSON into a dataset. Throws when it is not even an object. */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("That file is not a blog data file.")
  }
  const out = emptyData()
  const fileAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString()
  out.updatedAt = fileAt

  const site = raw.site && typeof raw.site === "object" ? raw.site : {}
  out.site = {
    title: trimmed(site.title),
    description: trimmed(site.description),
    author: trimmed(site.author),
    at: typeof site.at === "string" ? site.at : "",
  }

  const seen = new Set()
  const posts = Array.isArray(raw.posts) ? raw.posts : []
  out.posts = posts
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const date = ISO_DATE.test(str(p.date)) ? str(p.date) : todayISO()
      let slug = SLUG_OK.test(str(p.slug)) ? str(p.slug) : slugify(p.title, date)
      while (seen.has(slug)) slug += "-1"          // two posts may not share a route
      seen.add(slug)
      return {
        id: str(p.id || uid()),
        slug,
        title: trimmed(p.title),
        date,
        caption: trimmed(p.caption),
        tags: normalizeTags(p.tags),
        imageId: trimmed(p.imageId),
        image: trimmed(p.image),
        imageAlt: trimmed(p.imageAlt),
        body: str(p.body),
        createdAt: str(p.createdAt || fileAt),
        at: str(p.at || p.updatedAt || p.createdAt || fileAt),
      }
    })
  out.posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const dead = raw.deleted && typeof raw.deleted === "object" && !Array.isArray(raw.deleted) ? raw.deleted : {}
  for (const k of Object.keys(dead)) if (typeof dead[k] === "string") out.deleted[k] = dead[k]

  return out
}

/** Per record: last write wins by `at`; a tombstone newer than the record beats
 *  it on both sides; a record only one side has is kept. */
export function mergeData(local, remoteRaw) {
  let remote
  try { remote = normalize(remoteRaw) } catch { return local }

  const dead = { ...remote.deleted, ...local.deleted }
  for (const k of Object.keys(remote.deleted)) {
    if (ts(remote.deleted[k]) > ts(dead[k])) dead[k] = remote.deleted[k]
  }

  const byId = new Map(local.posts.map((p) => [p.id, p]))
  for (const r of remote.posts) {
    const l = byId.get(r.id)
    if (!l || ts(r.at) > ts(l.at)) byId.set(r.id, r)
  }
  const posts = [...byId.values()]
    .filter((p) => !dead[p.id] || ts(dead[p.id]) < ts(p.at))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const site = ts(remote.site.at) > ts(local.site.at) ? remote.site : local.site
  return { ...local, site, posts, deleted: dead, updatedAt: nowISO() }
}
