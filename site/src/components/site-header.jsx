/* Top bar: brand on the left, the site's nav in the middle, theme toggle on the
   right. On phones the nav folds into a disclosure under the bar. */
import { useEffect, useState } from "react"
import { MenuIcon, MoonIcon, PenLineIcon, SunIcon, XIcon } from "lucide-react"

import { C } from "@/modules/gallery/content"
import { DRIVE_ENABLED } from "@/lib/session"
import { href } from "@/lib/router"
import { isDark, onTheme, toggleTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function useDark() {
  const [dark, set] = useState(isDark)
  useEffect(() => onTheme(set), [])
  return dark
}

export function SiteHeader({ route }) {
  const [open, setOpen] = useState(false)
  const dark = useDark()
  const current = "/" + route.join("/")
  useEffect(() => { setOpen(false) }, [current])

  const links = C.site.nav.map((n) => {
    const active = n.to === "/" ? route.length === 0 : current === n.to || current.startsWith(n.to + "/")
    return (
      <a key={n.to} href={href(n.to)} data-testid="nav-link" aria-current={active ? "page" : undefined}
        className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
          active ? "text-foreground" : "text-muted-foreground")}>
        {n.label}
      </a>
    )
  })

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <a href={href("/")} data-testid="brand" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            {C.site.title.trim()[0]}
          </span>
          <span>{C.site.title}</span>
        </a>
        <nav className="ml-4 hidden items-center gap-1 sm:flex" data-testid="nav">{links}</nav>
        <div className="ml-auto flex items-center gap-1">
          {DRIVE_ENABLED && (
            <Button variant="ghost" size="icon" asChild
              aria-label="Open The Little Me" data-testid="studio-link-header">
              <a href={href("/me/gallery")}><PenLineIcon /></a>
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} data-testid="theme-toggle" onClick={toggleTheme}>
            {dark ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} data-testid="menu-toggle" onClick={() => setOpen((o) => !o)}>
            {open ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t sm:hidden" data-testid="nav-mobile">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2">{links}</div>
        </nav>
      )}
    </header>
  )
}
