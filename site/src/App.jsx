/* The Little Me: three modules over one sign-in, and a reader for a published
 * blog.
 *
 * Two chromes, deliberately. The app shell shows the modules and the account,
 * and is what the child and their parent see. The reader shows one person's
 * published pictures with none of that, because a stranger following a link to
 * a child's drawings has no business seeing their practice or their hours.
 *
 *   #/me                 the app: hello, and the modules
 *   #/me/<module>        one module
 *   #/b/<driveFileId>/…  someone's published blog, in the reader
 *   everything else      the reader, on this deployment's own blog
 *
 * Which of the last two answers `#/` is a deployment's choice: `appHome` in
 * content/site.json. It is false here, so this build still opens on the blog. */
import { Suspense } from "react"

import { C } from "@/modules/gallery/content"
import { useRoute } from "@/lib/router"
import { AppShell } from "@/components/app-shell"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Me } from "@/modules/me"
import { moduleById } from "@/modules/registry"
import { Home } from "@/modules/gallery/pages/home"
import { Post } from "@/modules/gallery/pages/post"
import { Tag } from "@/modules/gallery/pages/tag"
import { Page } from "@/modules/gallery/pages/page"
import { Gallery } from "@/modules/gallery/pages/gallery"
import { NotFound } from "@/modules/gallery/pages/not-found"

/** The blog: what a reader sees, with no sign of the app around it. */
function Reader({ route }) {
  const [head, arg] = route
  let view = <NotFound />
  if (!head) view = <Home />
  else if (head === "post" && arg) view = <Post slug={arg} />
  else if (head === "tag" && arg) view = <Tag tag={arg} />
  else if (head === "gallery") view = <Gallery />
  else if (route.length === 1) view = <Page slug={head} />
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader route={route} />
      <main className="flex-1">{view}</main>
      <SiteFooter />
    </div>
  )
}

function ModuleView({ id }) {
  const m = moduleById(id)
  if (!m) return <NotFound what="module" />
  const { Component } = m
  return (
    <Suspense fallback={<p className="mx-auto max-w-2xl text-sm text-muted-foreground">Opening {m.label}…</p>}>
      <Component />
    </Suspense>
  )
}

export default function App() {
  const route = useRoute()
  const appHome = Boolean(C.site && C.site.appHome)

  if (route[0] === "me") {
    const rest = route.slice(1)
    return (
      <AppShell route={rest}>
        {rest.length === 0 ? <Me /> : <ModuleView id={rest[0]} />}
      </AppShell>
    )
  }
  if (appHome && route.length === 0) {
    return <AppShell route={[]}><Me /></AppShell>
  }
  return <Reader route={route} />
}
