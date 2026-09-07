/* One post: tag, title, excerpt, byline, the picture, the body in a reading
   column, then older/newer links and three more to read. */
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

import { neighbours, postBySlug, related } from "@/modules/gallery/content"
import { fmtDate, titleOf } from "@/lib/format"
import { href } from "@/lib/router"
import { Markdown } from "@/components/markdown"
import { PostCard, PostMeta } from "@/modules/gallery/post-card"
import { useTitle } from "@/components/page-title"
import { NotFound } from "@/modules/gallery/pages/not-found"

export function Post({ slug }) {
  const post = postBySlug(slug)
  useTitle(post ? titleOf(post) : "Not found")
  if (!post) return <NotFound what="post" />
  const { newer, older } = neighbours(post)
  const more = related(post)
  return (
    <article data-testid="post" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {post.image && (
        <figure className="mx-auto max-w-4xl">
          <img src={post.image} alt={post.imageAlt || titleOf(post)} data-testid="post-image"
            className="max-h-[82vh] w-full rounded-xl object-contain" />
          {post.caption && (
            <figcaption className="mt-3 text-center text-sm text-muted-foreground">{post.caption}</figcaption>
          )}
        </figure>
      )}
      <header className="mx-auto mt-8 max-w-3xl">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-primary">
            {post.tags.map((t) => <a key={t} href={href("/tag/" + t)} className="hover:underline">{t}</a>)}
          </div>
        )}
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl" data-testid="post-title">{titleOf(post)}</h1>
        {post.excerpt && <p className="mt-3 text-base text-muted-foreground">{post.excerpt}</p>}
        <PostMeta post={post} className="mt-4" />
        {post.updated !== post.date && <p className="mt-1 text-xs text-muted-foreground">Updated {fmtDate(post.updated)}</p>}
      </header>
      {post.body.trim() && (
        <div className="mx-auto mt-10 max-w-3xl">
          <Markdown body={post.body} />
        </div>
      )}
      <nav className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-2" aria-label="Older and newer posts" data-testid="post-nav">
        {older ? (
          <a href={href("/post/" + older.slug)} className="group rounded-xl border bg-card p-4 hover:bg-accent">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeftIcon className="size-3" /> Older</span>
            <span className="mt-1 block font-semibold group-hover:underline">{titleOf(older)}</span>
          </a>
        ) : <span />}
        {newer && (
          <a href={href("/post/" + newer.slug)} className="group rounded-xl border bg-card p-4 text-right hover:bg-accent">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Newer <ArrowRightIcon className="size-3" /></span>
            <span className="mt-1 block font-semibold group-hover:underline">{titleOf(newer)}</span>
          </a>
        )}
      </nav>
      {more.length > 0 && (
        <section className="mt-16" aria-labelledby="more-heading">
          <h2 id="more-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Read more</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="read-more">
            {more.map((p) => <PostCard key={p.slug} post={p} />)}
          </div>
        </section>
      )}
    </article>
  )
}
