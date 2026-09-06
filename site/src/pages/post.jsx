/* One post: tag, title, excerpt, byline, the picture, the body in a reading
   column, then older/newer links and three more to read. */
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"

import { neighbours, postBySlug, related } from "@/lib/content"
import { fmtDate } from "@/lib/format"
import { href } from "@/lib/router"
import { Markdown } from "@/components/markdown"
import { PostCard, PostMeta } from "@/components/post-card"
import { useTitle } from "@/components/page-title"
import { NotFound } from "@/pages/not-found"

export function Post({ slug }) {
  const post = postBySlug(slug)
  useTitle(post ? post.title : "Not found")
  if (!post) return <NotFound what="post" />
  const { newer, older } = neighbours(post)
  const more = related(post)
  return (
    <article data-testid="post" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-3xl">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm font-semibold uppercase tracking-wide text-primary">
            {post.tags.map((t) => <a key={t} href={href("/tag/" + t)} className="hover:underline">{t}</a>)}
          </div>
        )}
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl" data-testid="post-title">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-lg text-muted-foreground sm:text-xl">{post.excerpt}</p>}
        <PostMeta post={post} className="mt-6 text-sm" />
        {post.updated !== post.date && <p className="mt-1 text-xs text-muted-foreground">Updated {fmtDate(post.updated)}</p>}
      </header>
      {post.image && (
        <figure className="mx-auto mt-10 max-w-5xl">
          <img src={post.image} alt={post.imageAlt || ""} className="aspect-[16/9] w-full rounded-xl object-cover" />
        </figure>
      )}
      <div className="mx-auto mt-10 max-w-3xl">
        <Markdown body={post.body} />
      </div>
      <nav className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-2" aria-label="Older and newer posts" data-testid="post-nav">
        {older ? (
          <a href={href("/post/" + older.slug)} className="group rounded-xl border bg-card p-4 hover:bg-accent">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeftIcon className="size-3" /> Older</span>
            <span className="mt-1 block font-semibold group-hover:underline">{older.title}</span>
          </a>
        ) : <span />}
        {newer && (
          <a href={href("/post/" + newer.slug)} className="group rounded-xl border bg-card p-4 text-right hover:bg-accent">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Newer <ArrowRightIcon className="size-3" /></span>
            <span className="mt-1 block font-semibold group-hover:underline">{newer.title}</span>
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
