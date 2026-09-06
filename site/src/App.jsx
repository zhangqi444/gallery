/* The shell (header, footer) and the hash router.
   /               home
   /post/<slug>    one post
   /tag/<tag>      posts with a tag
   /gallery        the gallery
   /<slug>         a standing page from content/pages (about, …) */
import { useRoute } from "@/lib/router"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Home } from "@/pages/home"
import { Post } from "@/pages/post"
import { Tag } from "@/pages/tag"
import { Page } from "@/pages/page"
import { Gallery } from "@/pages/gallery"
import { NotFound } from "@/pages/not-found"

function View({ route }) {
  const [head, arg] = route
  if (!head) return <Home />
  if (head === "post" && arg) return <Post slug={arg} />
  if (head === "tag" && arg) return <Tag tag={arg} />
  if (head === "gallery") return <Gallery />
  if (route.length === 1) return <Page slug={head} />
  return <NotFound />
}

export default function App() {
  const route = useRoute()
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader route={route} />
      <main className="flex-1">
        <View route={route} />
      </main>
      <SiteFooter />
    </div>
  )
}
