/* Gallery: the pictures I have made, and publishing them.
 *
 * This is a module page, so it assumes the app shell around it has already
 * handled signing in. It only does the two things a blog needs: keep the posts,
 * and share them when — and only when — the child asks. */
import { useRef, useState } from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ImageIcon, LinkIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { useSession } from "@/lib/session"
import { imageUrl } from "@/lib/google"
import { fmtDate } from "@/lib/format"
import { blogHref } from "@/lib/router"
import { todayISO } from "@/modules/gallery/model"
import { useGallery } from "@/modules/gallery/store"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

const field = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Everything about a post that is not its title, its date or its picture.
 *
 *  Folded away by default, because almost every post here is a picture with a
 *  title and nothing else and a form that asks for four more things suggests
 *  otherwise. The alt text is the one field that is not optional in spirit: a
 *  picture nobody can describe is a picture some readers never see. */
function Details({ post, store }) {
  const [tags, setTags] = useState(post.tags.join(", "))
  return (
    <div className="flex flex-col gap-3 border-t p-3" data-testid="studio-details">
      <Field label="Describe the picture" hint="Read out to anyone who cannot see it.">
        <input className={field} value={post.imageAlt} data-testid="studio-alt"
          placeholder="A blue cat asleep on a windowsill"
          onChange={(e) => store.updatePost(post.id, { imageAlt: e.target.value })} />
      </Field>
      <Field label="A caption" hint="Optional. Shown under the picture.">
        <input className={field} value={post.caption} data-testid="studio-caption"
          onChange={(e) => store.updatePost(post.id, { caption: e.target.value })} />
      </Field>
      <Field label="Topics" hint="Optional. Separated by commas.">
        {/* held here while it is being typed: the store lowercases and splits
            on every change, which would fight anyone typing "cats, paint" */}
        <input className={field} value={tags} data-testid="studio-tags"
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => store.updatePost(post.id, { tags })} />
      </Field>
      <Field label="Anything to say about it?" hint="Optional.">
        <textarea className={field} rows={3} value={post.body} data-testid="studio-body"
          onChange={(e) => store.updatePost(post.id, { body: e.target.value })} />
      </Field>
    </div>
  )
}

function PostRow({ post, store, onError }) {
  const fileRef = useRef(null)
  const [open, setOpen] = useState(false)
  const src = post.imageId ? imageUrl(post.imageId, 400) : post.image
  return (
    <li className="rounded-lg border bg-card" data-testid="studio-post">
      {/* the buttons wrap under the title on a phone rather than squeezing it
          into three characters */}
      <div className="flex flex-wrap items-center gap-3 p-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
          {src
            ? <img src={src} alt="" className="size-full object-cover" />
            : <ImageIcon className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <input
            className="w-full truncate rounded-md border-0 bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus-visible:bg-accent"
            value={post.title} placeholder="Untitled" data-testid="studio-title"
            onChange={(e) => store.updatePost(post.id, { title: e.target.value })} />
          <div className="mt-0.5 flex items-center gap-2 px-1">
            <input type="date" value={post.date} data-testid="studio-date"
              className="rounded-md border-0 bg-transparent text-xs text-muted-foreground outline-none focus-visible:bg-accent"
              onChange={(e) => e.target.value && store.updatePost(post.id, { date: e.target.value })} />
            {/* a picture with no description is the one thing worth nagging
                about, and the nag opens the field it is about */}
            {post.caption
              ? <span className="truncate text-xs text-muted-foreground">{post.caption}</span>
              : src && !post.imageAlt
                ? <button type="button" data-testid="studio-needs-alt" onClick={() => setOpen(true)}
                    className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
                    Describe this picture
                  </button>
                : null}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="studio-file"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            if (f) store.attachImage(post.id, f, f.name).catch((err) => onError(err.message))
            e.target.value = ""
          }} />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" data-testid="studio-pick" onClick={() => fileRef.current.click()}>
            <ImageIcon /> Picture
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={open ? "Hide the details" : "More about this picture"}
            data-testid="studio-more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${post.title || "this post"}`} data-testid="studio-delete"
            onClick={() => store.deletePost(post.id).catch((err) => onError(err.message))}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
      {open && <Details post={post} store={store} />}
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
