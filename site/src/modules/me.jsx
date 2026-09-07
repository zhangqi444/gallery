/* The app's home: the one screen that is about the child rather than a module.
 *
 * It speaks in the first person because the app is called The Little Me, and it
 * shows one line per module rather than everything at once — today's practice,
 * the next thing to do, the newest picture. */
import { DRIVE_ENABLED, useSession } from "@/lib/session"
import { href } from "@/lib/router"
import { MODULES } from "@/modules/registry"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

function SignIn({ session }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-8 text-center" data-testid="app-signin">
      <h1 className="text-2xl font-bold tracking-tight">The Little Me</h1>
      <p className="mt-3 text-muted-foreground">
        One place for what I practise, what I do for other people, and the pictures I make.
      </p>
      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-muted-foreground">
        <li>· Everything is saved in <strong>your own Google Drive</strong>, in a folder this app makes.</li>
        <li>· It can only see the files it made, nothing else in your Drive.</li>
        <li>· Nothing is public until you publish it.</li>
      </ul>
      <Button className="mt-6" data-testid="signin-button" disabled={!session.ready} onClick={() => session.signIn()}>
        Sign in with Google
      </Button>
      {!session.ready && <p className="mt-3 text-xs text-muted-foreground">Waiting for Google to load…</p>}
      {session.lastError && <p className="mt-3 text-sm text-destructive" data-testid="app-error">{session.lastError}</p>}
    </div>
  )
}

export function Me() {
  useTitle("The Little Me")
  const session = useSession()

  if (!DRIVE_ENABLED) {
    return (
      <div className="mx-auto max-w-lg text-center" data-testid="app-disabled">
        <h1 className="text-2xl font-bold tracking-tight">Sign-in is not set up</h1>
        <p className="mt-3 text-muted-foreground">
          This copy has no Google client id, so it can only show what is committed to its repository.
          Put a client id and API key in <code>site/google.json</code> and rebuild.
        </p>
      </div>
    )
  }
  if (!session.signedIn()) return <SignIn session={session} />

  const first = (session.name || "").split(/\s+/)[0]
  return (
    <div className="mx-auto max-w-2xl" data-testid="app-home">
      <h1 className="text-2xl font-bold tracking-tight">{first ? `Hello, ${first}` : "Hello"}</h1>
      <p className="mt-2 text-muted-foreground">What would you like to do?</p>
      <div className="mt-6 flex flex-col gap-3">
        {MODULES.map((m) => (
          <a key={m.id} href={href("/me/" + m.id)} data-testid={`module-card-${m.id}`}
            className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold group-hover:underline">{m.mine}</h2>
              {!m.ready && <span className="shrink-0 text-xs text-muted-foreground">not moved across yet</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.blurb}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
