/* A standing page such as About: title, optional picture, the body. */
import { pageBySlug } from "@/modules/gallery/content"
import { fmtDate } from "@/lib/format"
import { Markdown } from "@/components/markdown"
import { useTitle } from "@/components/page-title"
import { NotFound } from "@/modules/gallery/pages/not-found"

export function Page({ slug }) {
  const page = pageBySlug(slug)
  useTitle(page ? page.title : "Not found")
  if (!page) return <NotFound what="page" />
  return (
    <article data-testid="page" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl" data-testid="page-title">{page.title}</h1>
        {page.updated && <p className="mt-3 text-sm text-muted-foreground">Updated {fmtDate(page.updated)}</p>}
      </header>
      {page.image && (
        <figure className="mx-auto mt-10 max-w-5xl">
          <img src={page.image} alt={page.imageAlt || ""} className="aspect-[21/9] w-full rounded-xl object-cover" />
        </figure>
      )}
      <div className="mx-auto mt-10 max-w-3xl">
        <Markdown body={page.body} />
      </div>
    </article>
  )
}
