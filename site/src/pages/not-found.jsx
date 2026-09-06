import { href } from "@/lib/router"
import { Button } from "@/components/ui/button"

export function NotFound({ what = "page" }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6" data-testid="not-found">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">That {what} is not here</h1>
      <p className="mt-3 text-muted-foreground">It may have moved, or the link may be wrong.</p>
      <Button asChild className="mt-6"><a href={href("/")}>Back to the front page</a></Button>
    </div>
  )
}
