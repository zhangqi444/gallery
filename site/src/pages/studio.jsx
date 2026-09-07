/* The author's own page: sign in with Google, add pictures, publish.
 *
 * Everything written here is saved to the author's own Google Drive, and only
 * becomes readable by anyone else when they press Publish. The page says so in
 * as many words, because "put my child's drawings on the internet" should never
 * be something a person does by accident. */
import { useRef, useState } from "react"
import { CheckIcon, ImageIcon, LinkIcon, LogOutIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { DRIVE_ENABLED, Store, useStore } from "@/lib/store"
import { imageUrl } from "@/lib/google"
import { fmtDate } from "@/lib/format"
import { blogHref } from "@/lib/router"
import { todayISO } from "@/lib/model"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

const STATUS = {
  local: "Not connected",
  connecting: "Connecting…",
  syncing: "Saving to Drive…",
  live: "Saved to Drive",
  expired: "Reconnect Drive",
  error: "Drive error",
  unavailable: "Drive unavailable",
}

function SignedOut({ store }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center" data-testid="studio-signin">
      <h1 className="text-2xl font-bold tracking-tight">Your own blog</h1>
      <p className="mt-3 text-muted-foreground">
        Sign in with Google and this becomes a place to put your pictures. Everything is
        saved in <strong>your own Google Drive</strong>, in one file this site creates.
      </p>
      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-muted-foreground">
        <li>· It can only see the file it made, nothing else in your Drive.</li>
        <li>· Nobody else can read it until you press Publish.</li>
        <li>· Delete the file in Drive and the blog is gone.</li>
      </ul>
      <Button className="mt-6" data-testid="signin-button" disabled={!store.ready}
        onClick={() => store.signIn()}>
        Sign in with Google
      </Button>
      {!store.ready && <p className="mt-3 text-xs text-muted-foreground">Waiting for Google to load…</p>}
      {store.lastError && <p className="mt-3 text-sm text-destructive" data-testid="studio-error">{store.lastError}</p>}
    </div>
  )
}

function PostRow({ post, store }) {
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
          if (f) store.attachImage(post.id, f, f.name).catch((err) => { store.lastError = err.message })
          e.target.value = ""
        }} />
      <Button variant="outline" size="sm" data-testid="studio-pick" onClick={() => fileRef.current.click()}>
        <ImageIcon /> Picture
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${post.title || "this post"}`} data-testid="studio-delete"
        onClick={() => store.deletePost(post.id)}>
        <Trash2Icon />
      </Button>
    </li>
  )
}

function SignedIn({ store }) {
  const [copied, setCopied] = useState(false)
  const published = store.isPublished()
  const id = store.blogId()
  const link = id ? `${location.origin}${location.pathname}${blogHref(id)}` : ""
  return (
    <div className="mx-auto max-w-3xl" data-testid="studio">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your blog</h1>
          <p className="text-sm text-muted-foreground">
            {store.name || store.email} · <span data-testid="studio-status">{STATUS[store.status] || store.status}</span>
            {store.busy && <> · {store.busy}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="studio-add" onClick={() => store.addPost({ date: todayISO(), title: "" })}>
            <PlusIcon /> Add a picture
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" data-testid="studio-signout"
            onClick={() => store.signOut()}>
            <LogOutIcon />
          </Button>
        </div>
      </header>

      <section className="mt-5 rounded-xl border bg-card p-4" data-testid="studio-publish">
        {published ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-success">
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
          </>
        ) : (
          <>
            <p className="text-sm">
              This blog is <strong>private</strong>. Only you can see it. Publishing makes the file in your
              Drive readable by anyone who has its link.
            </p>
            <Button className="mt-3" data-testid="studio-publish-button" disabled={store.s.posts.length === 0}
              onClick={() => store.publish().catch((e) => { store.lastError = e.message })}>
              Publish this blog
            </Button>
            {store.s.posts.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Add a picture first.</p>
            )}
          </>
        )}
      </section>

      {store.lastError && <p className="mt-4 text-sm text-destructive" data-testid="studio-error">{store.lastError}</p>}

      {store.s.posts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nothing here yet. <em>Add a picture</em> starts your first post.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {store.s.posts.map((p) => <PostRow key={p.id} post={p} store={store} />)}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        {store.s.posts.length} post{store.s.posts.length === 1 ? "" : "s"}
        {store.lastSync && <> · last saved {fmtDate(new Date().toISOString().slice(0, 10))}</>}
      </p>
    </div>
  )
}

export function Studio() {
  useTitle("Your blog")
  const store = useStore()
  if (!DRIVE_ENABLED) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" data-testid="studio-disabled">
        <h1 className="text-2xl font-bold tracking-tight">Sign-in is not set up</h1>
        <p className="mt-3 text-muted-foreground">
          This copy of the site has no Google client id, so it can only show the content committed
          to its repository. Put a client id and API key in <code>site/google.json</code> and rebuild.
        </p>
      </div>
    )
  }
  return (
    <div className="px-4 py-10 sm:px-6">
      {store.email ? <SignedIn store={store} /> : <SignedOut store={store} />}
    </div>
  )
}
