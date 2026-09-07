/* The Gallery module's data: posts, each a picture with a title and a date.
 *
 * Everything that is not specific to a blog — localStorage, the Drive mirror,
 * the debounce, tombstones, signing in and out — comes from
 * lib/module-store.js, which Learning and Service use in exactly the same way. */
import * as Drive from "@/lib/google"
import { createModuleStore, useModuleStore } from "@/lib/module-store"
import { emptyData, mergeData, newPost, normalize, normalizeTags, nowISO, slugify } from "./model"

export const GalleryStore = createModuleStore({
  name: "gallery",
  file: "gallery.json",
  key: "littleme.gallery.v1",
  empty: emptyData,
  normalize,
  merge: mergeData,
})

/* ---- what a blog can do, on top of what every module can ---- */
Object.assign(GalleryStore, {
  post(id) { return this.s.posts.find((p) => p.id === id) || null },

  addPost(f) {
    const p = newPost(f)
    p.slug = this.uniqueSlug(p.slug, p.id)
    this.s.posts.push(p)
    this.sortPosts()
    this.commit()
    return p
  },
  /** Text is stored as it was typed. Trimming here would eat the space the
   *  moment it is typed — the field is redrawn from the store on every
   *  keystroke, so "My blue" would come back as "Myblue" — and normalize()
   *  trims everything on the way in and out anyway. */
  updatePost(id, f) {
    const p = this.post(id)
    if (!p) return null
    Object.assign(p, f, {
      title: String(f.title ?? p.title),
      caption: String(f.caption ?? p.caption),
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
  /** Removes the post and, when it owns one, its picture file in Drive. */
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
  sortPosts() { this.s.posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) },

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

  /** Upload a picture into the person's Drive, share it, attach it to the post. */
  async attachImage(postId, blob, name) {
    if (!Drive.isSignedIn()) throw new Error("Sign in before adding a picture.")
    const p = this.post(postId)
    if (!p) throw new Error("That post is gone.")
    this.setBusy("Uploading the picture…")
    try {
      const old = p.imageId
      const id = await Drive.uploadImage(blob, name || `${p.slug}.jpg`)
      p.imageId = id
      p.image = ""              // a Drive picture wins over an external URL
      p.at = nowISO()
      this.commit()
      if (old && old !== id) { try { await Drive.deleteFile(old) } catch { /* ignore */ } }
      return id
    } finally {
      this.setBusy("")
    }
  },

  /** Share the blog's file and every picture in it, so a published post is not
   *  full of holes. The pictures are shared here rather than as they are
   *  uploaded, so that a blog nobody has published has nothing readable in it. */
  async publish() {
    await this.flush()
    const f = await Drive.publish("gallery")
    for (const id of this.imageIds()) await Drive.makePublic(id)
    this.commit()
    return f
  },

  /** Take it all back: the blog's file first, so the link stops working even if
   *  a picture refuses, then every picture it pointed at. */
  async unpublish() {
    const f = await Drive.unpublish("gallery")
    for (const id of this.imageIds()) await Drive.makePrivate(id)
    this.commit()
    return f
  },

  imageIds() { return this.s.posts.map((p) => p.imageId).filter(Boolean) },
  isPublished() { const f = Drive.getFile("gallery"); return !!(f && f.shared) },
  blogId() { const f = Drive.getFile("gallery"); return f ? f.id : "" },
  fileLink() { const f = Drive.getFile("gallery"); return f ? f.webViewLink : "" },
})

export const useGallery = () => useModuleStore(GalleryStore)

/** One line for the app's home screen. Lives with the store, not with the page,
 *  so the home screen never has to import a module's UI to describe it. */
export function gallerySummary() {
  const n = GalleryStore.s.posts.length
  if (!n) return { line: "No pictures yet", detail: "Add one and it is saved to your Drive." }
  return {
    line: `${n} picture${n === 1 ? "" : "s"}`,
    detail: GalleryStore.isPublished() ? "Published — anyone with the link can see them." : "Private to you until you publish.",
  }
}
