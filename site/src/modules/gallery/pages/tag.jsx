import { postsByTag } from "@/modules/gallery/content"
import { PostCard } from "@/modules/gallery/post-card"
import { useTitle } from "@/components/page-title"
import { NotFound } from "@/modules/gallery/pages/not-found"

export function Tag({ tag }) {
  const posts = postsByTag(tag)
  useTitle(tag)
  if (posts.length === 0) return <NotFound what="topic" />
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="tag-page">
      <header className="border-b pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Topic</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{tag}</h1>
        <p className="mt-2 text-muted-foreground">{posts.length === 1 ? "1 post" : `${posts.length} posts`}</p>
      </header>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => <PostCard key={p.slug} post={p} />)}
      </div>
    </div>
  )
}
