/* Gallery: every picture in content/gallery.json, newest first, in a tiled grid.
   Clicking one opens it large with its caption. */
import { useState } from "react"

import { C } from "@/lib/content"
import { fmtDate } from "@/lib/format"
import { href } from "@/lib/router"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTitle } from "@/components/page-title"

export function Gallery() {
  useTitle("Gallery")
  const [open, setOpen] = useState(null)
  const items = C.gallery
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="gallery">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Gallery</h1>
        <p className="mt-2 text-muted-foreground">{items.length === 1 ? "1 picture" : `${items.length} pictures`}</p>
      </header>
      {items.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No pictures yet. Add one to <code>content/gallery.json</code> and rebuild.
        </p>
      ) : (
        <ul className="mt-8 columns-2 gap-4 sm:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid">
          {items.map((g) => (
            <li key={g.src}>
              <button type="button" data-testid="gallery-item" onClick={() => setOpen(g)}
                className="group block w-full overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer">
                <img src={g.src} alt={g.alt} loading="lazy" decoding="async" className="w-full transition-transform duration-300 group-hover:scale-[1.02]" />
                {(g.caption || g.date) && (
                  <span className="flex items-baseline justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{g.caption}</span>
                    {g.date && <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(g.date)}</span>}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] gap-3 p-3 sm:max-w-4xl" data-testid="lightbox">
          {open && (
            <>
              <img src={open.src} alt={open.alt} className="max-h-[75vh] w-full rounded-lg object-contain" />
              <DialogTitle className="px-1 text-base">{open.caption || open.alt}</DialogTitle>
              <DialogDescription className="flex items-center justify-between gap-3 px-1">
                <span>{open.date ? fmtDate(open.date) : open.alt}</span>
                {open.slug && (
                  <a href={href("/post/" + open.slug)} data-testid="lightbox-post"
                    className="font-medium text-primary hover:underline" onClick={() => setOpen(null)}>
                    Open post
                  </a>
                )}
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
