/* A post in a list. `large` is the lead card on the home page: image beside the
   text on wide screens, stacked on phones. */
import { C } from "@/lib/content"
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
      {!(isUntitled(post) && !byline) && <time dateTime={post.date}>{fmtDate(post.date)}</time>}
      {post.minutes > 0 && (
        <>
          {!(isUntitled(post) && !byline) && <span aria-hidden="true">·</span>}
          <span>{readTime(post.minutes)}</span>
        </>
      )}
    </div>
  )
}

export function PostCard({ post, large = false }) {
  const to = href("/post/" + post.slug)
  return (
    <article data-testid="post-card" className={cn(
      "group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-shadow hover:shadow-md",
      large && "md:grid md:grid-cols-[1.35fr_1fr]"
    )}>
      {post.image ? (
        <a href={to} className={cn("block overflow-hidden", large ? "md:h-full" : "")} tabIndex={-1} aria-hidden="true">
          <img src={post.image} alt={post.imageAlt || titleOf(post)} loading={large ? "eager" : "lazy"} decoding="async"
            className={cn("w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]", large ? "aspect-[16/10] md:aspect-auto md:h-full" : "aspect-[16/10]")} />
        </a>
      ) : null}
      <div className={cn("flex flex-col gap-3 p-5", large && "md:justify-center md:p-8")}>
        {post.tags.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {post.tags.map((t) => <a key={t} href={href("/tag/" + t)} className="hover:underline">{t}</a>)}
          </div>
        )}
        <h2 className={cn("font-bold leading-snug tracking-tight", large ? "text-2xl md:text-3xl" : "text-xl")}>
          <a href={to} className="after:absolute after:inset-0 hover:underline decoration-2 underline-offset-4">{titleOf(post)}</a>
        </h2>
        {post.excerpt && <p className={cn("text-muted-foreground", large ? "text-base" : "text-sm")}>{post.excerpt}</p>}
        <PostMeta post={post} byline={large} className="mt-auto pt-2" />
      </div>
    </article>
  )
}
