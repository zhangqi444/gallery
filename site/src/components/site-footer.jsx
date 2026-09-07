import { C } from "@/modules/gallery/content"
import { href } from "@/lib/router"

export function SiteFooter() {
  const f = C.site.footer || {}
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <a href={href("/")} className="font-medium text-foreground">{C.site.title}</a>
          <span className="mx-2">·</span>
          <span>© {new Date().getFullYear()}</span>
          {f.note && <p className="mt-1">{f.note}</p>}
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {(f.links || []).map((l) => (
            <a key={l.to} href={href(l.to)} className="hover:text-foreground">{l.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
