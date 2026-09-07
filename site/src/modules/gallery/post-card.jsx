/* A post in a list. These posts are pictures, so the picture is the card: it is
   the only thing with a frame, and the title sits quietly underneath at reading
   size rather than shouting over it. `large` is the lead card on the front page,
   which gets a wider crop and the author's byline. */
import { C } from "@/modules/gallery/content"
import { fmtDate, initials, isUntitled, readTime, titleOf } from "@/lib/format"
import { href } from "@/lib/router"
import { cn } from "@/lib/utils"

export function Avatar({ className }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground", className)} aria-hidden="true">
      {initials(C.site.author.name)}
    </span>
  )
}

export function PostMeta({ post, className, byline = true }) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {byline && (
        <>
          <Avatar />
          <span className="font-medium text-foreground">{C.site.author.name}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <time dateTime={post.date}>{fmtDate(post.date)}</time>
      {post.minutes > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{readTime(post.minutes)}</span>
        </>
      )}
    </div>
  )
}

export function PostCard({ post, large = false }) {
  const to = href("/post/" + post.slug)
  // An unnamed post already shows its date as its heading; printing the date
  // again beside it would say the same thing twice.
  const dated = !isUntitled(post)
  return (
    <article data-testid="post-card" className="group relative">
      {post.image && (
        <a href={to} tabIndex={-1} aria-hidden="true"
          className="block overflow-hidden rounded-xl border bg-muted shadow-xs transition-shadow group-hover:shadow-md">
          <img src={post.image} alt={post.imageAlt || titleOf(post)} loading={large ? "eager" : "lazy"} decoding="async"
            className={cn("w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
              large ? "aspect-[3/2]" : "aspect-[4/3]")} />
        </a>
      )}
      <div className={cn("mt-3", large && "mt-4")}>
        {post.tags.length > 0 && (
          <div className="relative z-10 mb-1 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
            {post.tags.map((t) => <a key={t} href={href("/tag/" + t)} className="hover:underline">{t}</a>)}
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={cn("min-w-0 font-medium leading-snug", large ? "text-lg" : "text-sm")}>
            <a href={to} className="block truncate after:absolute after:inset-0 hover:underline underline-offset-4">
              {titleOf(post)}
            </a>
          </h2>
          {dated && (
            <time dateTime={post.date} className="shrink-0 text-xs text-muted-foreground">{fmtDate(post.date)}</time>
          )}
        </div>
        {post.excerpt && <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>}
        {large && <PostMeta post={post} className="mt-3" />}
      </div>
    </article>
  )
}
