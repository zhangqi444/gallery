/* The Little Me's own chrome: the app name, the modules, and the one sign-in.
 *
 * A published blog is *not* shown in this shell — a stranger reading a child's
 * pictures should never see their practice and their hours in a sidebar. That
 * lives in the reader chrome instead (site-header.jsx). */
import { useEffect, useState } from "react"
import { LogOutIcon, MoonIcon, SunIcon } from "lucide-react"

import { DRIVE_ENABLED, useSession } from "@/lib/session"
import { go, href } from "@/lib/router"
import { isDark, onTheme, toggleTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { MODULES } from "@/modules/registry"
import { Button } from "@/components/ui/button"

const STATUS = {
  local: "Not connected",
  connecting: "Connecting…",
  syncing: "Saving…",
  live: "Saved to Drive",
  expired: "Reconnect",
  error: "Drive error",
  unavailable: "",
}

function useDark() {
  const [dark, set] = useState(isDark)
  useEffect(() => onTheme(set), [])
  return dark
}

export function AppShell({ route, children }) {
  const session = useSession()
  const dark = useDark()
  const here = route[0] || ""

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:px-6">
          <a href={href("/me")} data-testid="app-brand" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">m</span>
            <span className="hidden sm:inline">The Little Me</span>
          </a>
          <nav className="ml-3 flex items-center gap-1" data-testid="module-nav">
            {MODULES.map((m) => {
              const active = here === m.id
              return (
                <a key={m.id} href={href("/me/" + m.id)} data-testid={`module-link-${m.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                  {m.label}
                </a>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {DRIVE_ENABLED && session.signedIn() && (
              <span className="hidden text-xs text-muted-foreground sm:inline" data-testid="session-status">
                {STATUS[session.status] || ""}
              </span>
            )}
            <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              data-testid="theme-toggle" onClick={toggleTheme}>
              {dark ? <SunIcon /> : <MoonIcon />}
            </Button>
            {DRIVE_ENABLED && session.signedIn() && (
              <Button variant="ghost" size="icon" aria-label="Sign out" data-testid="app-signout"
                onClick={() => { session.signOut(); go("/me") }}>
                <LogOutIcon />
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-10 sm:px-6">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          The Little Me · everything here is saved in your own Google Drive
        </div>
      </footer>
    </div>
  )
}
