/* Persistence for the author's own blog: localStorage first and synchronously,
 * a JSON file in their own Google Drive as the mirror, pushed on a 1.2 s
 * debounce. The same contract as zhangqi444/volunteer, with one addition — the
 * file and its pictures are shared publicly once the author publishes, because
 * a blog nobody can read is not a blog.
 *
 * Reading someone's published blog does not come through here at all; that is
 * lib/content.js, which needs no sign-in and no store. */
import { useSyncExternalStore } from "react"

import * as Drive from "./google"
import { emptyData, mergeData, newPost, normalize, normalizeTags, nowISO, slugify, SCHEMA } from "./model"

const KEY = "gallery.v1"
const FILE = "gallery-site-data.json"
const CLIENT_ID = (typeof window !== "undefined" && window.__OAUTH_CLIENT_ID__) || ""
const API_KEY = (typeof window !== "undefined" && window.__GOOGLE_API_KEY__) || ""
export const DRIVE_ENABLED = typeof window !== "undefined" && !!window.__ENABLE_DRIVE__ && !!CLIENT_ID
const TOMBSTONE_DAYS = 120

function lsLoad() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* fall through */ }
  return emptyData()
}
function lsSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode, quota */ } }

const listeners = new Set()
let version = 0
function emit() { version++; listeners.forEach((f) => f()) }

export const Store = {
  s: null,
  status: "local",     // local | connecting | syncing | live | expired | error | unavailable
  ready: false,        // the Google script has loaded; sign-in can be requested
  email: null, name: null, picture: null,
  lastError: null, lastSync: null,
  busy: "",            // a one-line description of a long upload, for the UI

  init() {
    this.s = lsLoad()
    this.pruneTombstones()
    if (DRIVE_ENABLED) {
      Drive.init({
        clientId: CLIENT_ID, apiKey: API_KEY, fileName: FILE,
        onState: (st, detail) => this.onDriveState(st, detail),
        onSaved: () => { this.lastSync = new Date() },
      })
        .then(() => { this.ready = true; emit(); if (Drive.hasSession()) this.resume() })
        .catch((e) => { this.lastError = e.message; this.setStatus("unavailable") })
      const p = Drive.getProfile()
      if (p) { this.email = p.email; this.name = p.name; this.picture = p.picture }
    }
    return this.s
  },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  snapshot() { return version },
  setStatus(v) { if (this.status !== v) { this.status = v; emit() } },
  setBusy(v) { if (this.busy !== v) { this.busy = v; emit() } },
  hasSession() { return DRIVE_ENABLED && Drive.hasSession() },

  /* ---- writes: save locally, notify, mirror ---- */
  commit() { this.s.updatedAt = nowISO(); lsSave(this.s); emit(); this.schedulePush() },
  bury(id) { this.s.deleted[id] = nowISO() },
  pruneTombstones() {
    const cutoff = Date.now() - TOMBSTONE_DAYS * 86400e3
    for (const k of Object.keys(this.s.deleted)) {
      if (Date.parse(this.s.deleted[k] || "") < cutoff) delete this.s.deleted[k]
    }
  },

  post(id) { return this.s.posts.find((p) => p.id === id) || null },

  addPost(f) {
    const p = newPost(f)
    p.slug = this.uniqueSlug(p.slug, p.id)
    this.s.posts.push(p)
    this.sortPosts()
    this.commit()
    return p
  },
  updatePost(id, f) {
    const p = this.post(id)
    if (!p) return null
    Object.assign(p, f, {
      title: String(f.title ?? p.title).trim(),
      caption: String(f.caption ?? p.caption).trim(),
      tags: f.tags !== undefined ? normalizeTags(f.tags) : p.tags,
      at: nowISO(),
    })
    if (f.slug !== undefined || f.title !== undefined) {
      p.slug = this.uniqueSlug(f.slug || slugify(p.title, p.date), p.id)
    }
    this.sortPosts()
    this.commit()
    return p
  },
  /** Removes the post and, when it owns one, the picture file in Drive with it. */
  async deletePost(id) {
    const p = this.post(id)
    if (!p) return
    this.s.posts = this.s.posts.filter((x) => x.id !== id)
    this.bury(id)
    this.commit()
    if (p.imageId && Drive.isSignedIn()) {
      try { await Drive.deleteFile(p.imageId) } catch { /* the post is gone either way */ }
    }
  },
  uniqueSlug(want, selfId) {
    let slug = want || "post"
    const taken = new Set(this.s.posts.filter((p) => p.id !== selfId).map((p) => p.slug))
    while (taken.has(slug)) slug += "-1"
    return slug
  },
  sortPosts() {
    this.s.posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  },

  setSite(f) {
    this.s.site = {
      ...this.s.site,
      title: String(f.title ?? this.s.site.title).trim(),
      description: String(f.description ?? this.s.site.description).trim(),
      author: String(f.author ?? this.s.site.author).trim(),
      at: nowISO(),
    }
    this.commit()
  },

  /** Upload a picture to the author's Drive, share it, attach it to the post. */
  async attachImage(postId, blob, name) {
    if (!Drive.isSignedIn()) throw new Error("Sign in before adding a picture.")
    const p = this.post(postId)
    if (!p) throw new Error("That post is gone.")
    this.setBusy("Uploading the picture…")
    try {
      const old = p.imageId
      const id = await Drive.uploadImage(blob, name || `${p.slug}.jpg`)
      p.imageId = id
      p.image = ""            // a Drive picture wins over an external URL
      p.at = nowISO()
      this.commit()
      if (old && old !== id) { try { await Drive.deleteFile(old) } catch { /* ignore */ } }
      return id
    } finally {
      this.setBusy("")
    }
  },

  /* ---- Google Drive ---- */
  onDriveState(st, detail) {
    if (st === "saving") this.setStatus("syncing")
    else if (st === "saved") { this.lastSync = new Date(); this.setStatus("live") }
    else if (st === "auth") { this.lastError = detail; this.setStatus("expired") }
    else if (st === "error" || st === "offline") { this.lastError = detail; this.setStatus("error") }
  },
  signIn() {
    if (!DRIVE_ENABLED || !Drive.available()) { this.setStatus("unavailable"); return Promise.resolve() }
    this.setStatus("connecting")
    return Drive.signIn().then((p) => this.afterAuth(p)).catch((e) => {
      this.lastError = e.message
      this.setStatus(
        e.code === "popup_closed" && Drive.hasSession() ? "expired"
          : e.code === "access_denied" ? "error"
            : Drive.hasSession() ? "expired" : "local")
    })
  },
  resume() {
    return Drive.restoreSession().then((p) => {
      if (p) return this.afterAuth(p)
      this.setStatus("expired")
    })
  },
  afterAuth(p) {
    this.email = p.email; this.name = p.name; this.picture = p.picture
    // A different Google account on this device must not merge into this one's file.
    if (this.s.owner && this.s.owner !== p.email) {
      this.s = emptyData()
      lsSave(this.s); emit()
    }
    this.s.owner = p.email
    lsSave(this.s)
    this.setStatus("syncing")
    return this.pull()
      .then(() => { this.lastSync = new Date(); this.setStatus("live") })
      .catch((e) => {
        this.lastError = e.message
        this.setStatus(e instanceof Drive.AuthError ? "expired" : "error")
      })
  },
  signOut() {
    Drive.signOut()
    this.email = this.name = this.picture = null
    this.s = emptyData()      // the device is cleared; the file in Drive keeps everything
    lsSave(this.s)
    this.setStatus("local")
  },
  payload() {
    const { owner, ...rest } = this.s
    return { ...rest, schema: SCHEMA, savedAt: nowISO() }
  },
  pull() {
    return Drive.load().then((r) => {
      if (r && r.data) { this.s = { ...mergeData(this.s, r.data), owner: this.s.owner }; lsSave(this.s); emit() }
      return Drive.save(this.payload())     // seed the file, or write the merged result back
    })
  },
  schedulePush() {
    if (!DRIVE_ENABLED || !Drive.isSignedIn()) return
    Drive.scheduleSave(this.payload())
  },
  flush() { return Drive.flush() },
  hasPending() { return Drive.hasPending() },

  /** Share the blog file so anyone with its link can read it. */
  async publish() {
    await this.flush()
    const f = await Drive.publish()
    emit()
    return f
  },
  isPublished() { const f = Drive.getFile(); return !!(f && f.shared) },
  blogId() { const f = Drive.getFile(); return f ? f.id : "" },
  fileLink() { const f = Drive.getFile(); return f ? f.webViewLink : "" },
}

/** Re-render on any store change. Returns the store itself. */
export function useStore() {
  useSyncExternalStore((fn) => Store.subscribe(fn), () => Store.snapshot(), () => Store.snapshot())
  return Store
}
