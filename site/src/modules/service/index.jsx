/* Service: who I help, what I have taken on, and the hours I have given.
 *
 * One screen rather than the six routes volunteer used, because a child's
 * record is small enough to read at once and a page you have to navigate is a
 * page you stop visiting. Logging hours is the one filled button; everything
 * else is quieter. */
import { useState } from "react"
import { BuildingIcon, ClockIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { useSession } from "@/lib/session"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { hoursForItem, hoursForOrg, todayISO, totals } from "./model"
import { useService } from "./store"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useTitle } from "@/components/page-title"

const hrs = (n) => `${n} h`

function Stat({ label, value, caption }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

const input = "rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/* ---------- dialogs ---------- */

function OrgDialog({ open, onClose, store }) {
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [website, setWebsite] = useState("")
  const save = () => {
    if (!name.trim()) return
    store.addOrg({ name, contact, website })
    setName(""); setContact(""); setWebsite("")
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="org-dialog">
        <DialogTitle>Add an organisation</DialogTitle>
        <DialogDescription>Somewhere you help. You can add what you do there next.</DialogDescription>
        <div className="flex flex-col gap-3">
          <Field label="Name"><input className={input} value={name} data-testid="org-name" onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Who you talk to" hint="Optional"><input className={input} value={contact} data-testid="org-contact" onChange={(e) => setContact(e.target.value)} /></Field>
          <Field label="Website" hint="Optional"><input className={input} value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="org-save" disabled={!name.trim()} onClick={save}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ItemDialog({ open, onClose, store, orgId }) {
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("")
  const save = () => {
    if (!title.trim()) return
    store.addWorkItem({ orgId, title, targetHours: Number(target) || 0 })
    setTitle(""); setTarget("")
    onClose()
  }
  const org = store.org(orgId)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="item-dialog">
        <DialogTitle>What do you do at {org ? org.name : "this place"}?</DialogTitle>
        <DialogDescription>A project or a regular commitment. Hours are logged against it.</DialogDescription>
        <div className="flex flex-col gap-3">
          <Field label="What it is"><input className={input} value={title} data-testid="item-title" onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Hours you are aiming for" hint="Optional. Leave it empty if there is no target.">
            <input className={input} type="number" min="0" step="0.5" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="item-save" disabled={!title.trim()} onClick={save}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LogDialog({ open, onClose, store }) {
  const [date, setDate] = useState(todayISO())
  const [hours, setHours] = useState("")
  const [workItemId, setWorkItemId] = useState("")
  const [activity, setActivity] = useState("")
  const [error, setError] = useState("")
  const items = store.s.workItems.filter((w) => w.status !== "completed")

  const save = () => {
    const n = Number(hours)
    if (!(n > 0)) { setError("Hours must be greater than zero."); return }
    const item = store.item(workItemId)
    store.addEntry({ date, hours: n, workItemId, orgId: item ? item.orgId : "", activity })
    setHours(""); setActivity(""); setError("")
    onClose()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="log-dialog">
        <DialogTitle>Log hours</DialogTitle>
        <DialogDescription>What you did, and how long it took.</DialogDescription>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input className={input} type="date" value={date} data-testid="log-date" onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Hours"><input className={input} type="number" min="0" step="0.25" value={hours} data-testid="log-hours" onChange={(e) => { setHours(e.target.value); setError("") }} /></Field>
          </div>
          <Field label="What you did">
            <select className={input} value={workItemId} data-testid="log-item" onChange={(e) => setWorkItemId(e.target.value)}>
              <option value="">Not linked to anything</option>
              {items.map((w) => {
                const org = store.org(w.orgId)
                return <option key={w.id} value={w.id}>{w.title}{org ? ` · ${org.name}` : ""}</option>
              })}
            </select>
          </Field>
          <Field label="A note" hint="Optional"><input className={input} value={activity} data-testid="log-activity" onChange={(e) => setActivity(e.target.value)} /></Field>
          {error && <p className="text-sm text-destructive" data-testid="log-error">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button data-testid="log-save" onClick={save}>Log it</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- the page ---------- */

export default function Service() {
  useTitle("My hours")
  const session = useSession()
  const store = useService()
  const [dialog, setDialog] = useState(null)   // "org" | "item" | "log"
  const [forOrg, setForOrg] = useState("")

  if (!session.signedIn()) {
    return (
      <p className="mx-auto max-w-2xl text-muted-foreground" data-testid="service-locked">
        Sign in to keep your hours. They are saved in your own Google Drive.
      </p>
    )
  }

  const s = store.s
  const t = totals(s)
  const empty = s.organizations.length === 0 && s.entries.length === 0

  return (
    <div className="mx-auto max-w-3xl" data-testid="service">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My hours</h1>
          <p className="text-sm text-muted-foreground">Who I help, and what I have given.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" data-testid="add-org" onClick={() => setDialog("org")}>
            <BuildingIcon /> Add a place
          </Button>
          <Button data-testid="log-button" onClick={() => setDialog("log")}>
            <ClockIcon /> Log hours
          </Button>
        </div>
      </header>

      {empty ? (
        <p className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground" data-testid="service-empty">
          Nothing here yet. Add a place you help, then log the hours you spend there.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3" data-testid="service-stats">
            <Stat label="Hours" value={<span data-testid="stat-hours">{t.hours}</span>} caption="All the time you have given" />
            <Stat label="This year" value={t.thisYear} caption={t.lastDate ? `Last on ${fmtDate(t.lastDate)}` : "Nothing yet this year"} />
            <Stat label="Places" value={t.organizations} caption={`${t.active} thing${t.active === 1 ? "" : "s"} on the go`} />
          </div>

          {s.organizations.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Where I help</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {s.organizations.map((o) => {
                  const items = s.workItems.filter((w) => w.orgId === o.id)
                  return (
                    <li key={o.id} className="rounded-xl border bg-card p-4" data-testid="org-card" style={{ borderTopColor: o.color, borderTopWidth: 3 }}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
                          <h3 className="font-semibold">{o.name}</h3>
                          {o.contact && <span className="text-xs text-muted-foreground">{o.contact}</span>}
                        </div>
                        <span className="text-sm tabular-nums text-muted-foreground">{hrs(hoursForOrg(s, o.id))}</span>
                      </div>
                      <ul className="mt-2 flex flex-col gap-1">
                        {items.map((w) => {
                          const done = hoursForItem(s, w.id)
                          const pct = w.targetHours > 0 ? Math.min(100, Math.round((done / w.targetHours) * 100)) : null
                          return (
                            <li key={w.id} className="flex items-center gap-3 text-sm" data-testid="item-row">
                              <span className={cn("flex-1 truncate", w.status !== "active" && "text-muted-foreground line-through")}>{w.title}</span>
                              {pct !== null && (
                                <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                </span>
                              )}
                              <span className="tabular-nums text-muted-foreground">
                                {w.targetHours > 0 ? `${done} / ${w.targetHours} h` : hrs(done)}
                              </span>
                              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${w.title}`}
                                onClick={() => store.deleteWorkItem(w.id)}><Trash2Icon /></Button>
                            </li>
                          )
                        })}
                      </ul>
                      <div className="mt-2 flex items-center gap-2">
                        <Button variant="ghost" size="sm" data-testid="add-item"
                          onClick={() => { setForOrg(o.id); setDialog("item") }}>
                          <PlusIcon /> Add something I do here
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label={`Remove ${o.name}`}
                          onClick={() => store.deleteOrg(o.id)}>Remove</Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {s.entries.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hours I have logged</h2>
              <ul className="mt-3 divide-y rounded-xl border bg-card" data-testid="entry-list">
                {s.entries.slice(0, 20).map((e) => {
                  const item = store.item(e.workItemId)
                  const org = store.org(e.orgId)
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid="entry-row">
                      <time dateTime={e.date} className="w-24 shrink-0 tabular-nums text-muted-foreground">{fmtDate(e.date)}</time>
                      <span className="min-w-0 flex-1 truncate">
                        {e.activity}
                        {item && <span className="text-muted-foreground"> · {item.title}</span>}
                        {!item && org && <span className="text-muted-foreground"> · {org.name}</span>}
                      </span>
                      <span className="tabular-nums">{hrs(e.hours)}</span>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${e.activity}`} data-testid="entry-delete"
                        onClick={() => store.deleteEntry(e.id)}><Trash2Icon /></Button>
                    </li>
                  )
                })}
              </ul>
              {s.entries.length > 20 && (
                <p className="mt-2 text-xs text-muted-foreground">Showing the 20 most recent of {s.entries.length}.</p>
              )}
            </section>
          )}
        </>
      )}

      <OrgDialog open={dialog === "org"} onClose={() => setDialog(null)} store={store} />
      <ItemDialog open={dialog === "item"} onClose={() => setDialog(null)} store={store} orgId={forOrg} />
      <LogDialog open={dialog === "log"} onClose={() => setDialog(null)} store={store} />
    </div>
  )
}
