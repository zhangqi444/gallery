/* Gallery: the pictures I have made, and publishing them.
 *
 * This is a module page, so it assumes the app shell around it has already
 * handled signing in. It only does the two things a blog needs: keep the posts,
 * and share them when — and only when — the child asks. */
import { useRef, useState } from "react"
import { CheckIcon, ImageIcon, LinkIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { useSession } from "@/lib/session"
import { imageUrl } from "@/lib/google"
import { fmtDate } from "@/lib/format"
import { blogHref } from "@/lib/router"
import { todayISO } from "@/modules/gallery/model"
import { useGallery } from "@/modules/gallery/store"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

function PostRow({ post, store, onError }) {
  const fileRef = useRef(null)
  const src = post.imageId ? imageUrl(post.imageId, 400) : post.image
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3" data-testid="studio-post">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {src
          ? <img src={src} alt="" className="size-full object-cover" />
          : <ImageIcon className="size-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <input
          className="w-full truncate rounded-md border-0 bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus-visible:bg-accent"
          value={post.title} placeholder="Untitled" data-testid="studio-title"
          onChange={(e) => store.updatePost(post.id, { title: e.target.value })} />
        <div className="mt-0.5 flex items-center gap-2 px-1">
          <input type="date" value={post.date} data-testid="studio-date"
            className="rounded-md border-0 bg-transparent text-xs text-muted-foreground outline-none focus-visible:bg-accent"
            onChange={(e) => e.target.value && store.updatePost(post.id, { date: e.target.value })} />
          <span className="truncate text-xs text-muted-foreground">{post.caption}</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="studio-file"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0]
          if (f) store.attachImage(post.id, f, f.name).catch((err) => onError(err.message))
          e.target.value = ""
        }} />
      <Button variant="outline" size="sm" data-testid="studio-pick" onClick={() => fileRef.current.click()}>
        <ImageIcon /> Picture
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${post.title || "this post"}`} data-testid="studio-delete"
        onClick={() => store.deletePost(post.id).catch((err) => onError(err.message))}>
        <Trash2Icon />
      </Button>
    </li>
  )
}

export function Studio() {
  useTitle("My pictures")
  const session = useSession()
  const store = useGallery()
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  if (!session.signedIn()) {
    return (
      <p className="mx-auto max-w-2xl text-muted-foreground" data-testid="studio-locked">
        Sign in to keep your pictures. They are saved in your own Google Drive.
      </p>
    )
  }

  const published = store.isPublished()
  const id = store.blogId()
  const link = id ? `${location.origin}${location.pathname}${blogHref(id)}` : ""

  return (
    <div className="mx-auto max-w-2xl" data-testid="studio">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My pictures</h1>
          <p className="text-sm text-muted-foreground">
            {store.s.posts.length} picture{store.s.posts.length === 1 ? "" : "s"}
            {store.busy && <> · {store.busy}</>}
          </p>
        </div>
        <Button data-testid="studio-add" onClick={() => store.addPost({ date: todayISO(), title: "" })}>
          <PlusIcon /> Add a picture
        </Button>
      </header>

      <section className="mt-5 rounded-xl border bg-card p-4" data-testid="studio-publish">
        {published ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckIcon className="size-4" /> Published. Anyone with this link can see it.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input readOnly value={link} data-testid="studio-link"
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000)
              }}>
                <LinkIcon /> {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            {/* Putting something on the internet is only a decision if it can be
                undone; the link stops working and the pictures go private too. */}
            <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" data-testid="studio-unpublish"
              onClick={() => store.unpublish().catch((e) => setError(e.message))}>
              <LockIcon /> Make them private again
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              These pictures are <strong>private</strong>. Only you can see them. Publishing makes the file in
              your Drive readable by anyone who has its link.
            </p>
            <Button className="mt-3" data-testid="studio-publish-button" disabled={store.s.posts.length === 0}
              onClick={() => store.publish().catch((e) => setError(e.message))}>
              Publish my pictures
            </Button>
            {store.s.posts.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Add a picture first.</p>}
          </>
        )}
      </section>

      {(error || session.lastError) && (
        <p className="mt-4 text-sm text-destructive" data-testid="studio-error">{error || session.lastError}</p>
      )}

      {store.s.posts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nothing here yet. <em>Add a picture</em> starts your first one.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {store.s.posts.map((p) => <PostRow key={p.id} post={p} store={store} onError={setError} />)}
        </ul>
      )}

      {store.lastSync && (
        <p className="mt-6 text-xs text-muted-foreground">Last saved {fmtDate(new Date().toISOString().slice(0, 10))}</p>
      )}
    </div>
  )
}
