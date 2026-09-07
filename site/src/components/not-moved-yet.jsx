/* A module that exists in the registry but whose code has not been moved across
 * yet. It says plainly what will live here and where it is coming from, rather
 * than pretending to be a feature that does nothing. */
import { ArrowRightIcon } from "lucide-react"

export function NotMovedYet({ title, lede, from, brings, note }) {
  return (
    <div className="mx-auto max-w-2xl" data-testid="module-pending">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not moved across yet</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{lede}</p>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          Moving from <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{from}</code>
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          here
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {brings.map((b) => (
            <li key={b} className="flex gap-2">
              <span aria-hidden="true" className="text-primary">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{note}</p>
    </div>
  )
}
