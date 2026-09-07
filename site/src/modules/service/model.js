/* Service: the organisations a child helps, the commitments under them, and the
 * hours logged against those.
 *
 * The field names are deliberately the ones zhangqi444/volunteer already uses —
 * `orgId`, `workItemId`, `activity`, `hours`, `at` — so that when its data is
 * eventually carried across, the import is close to a no-op rather than a
 * translation. Nothing here reads that app; the names are simply not worth
 * inventing again.
 *
 * What is not carried over is its catalog of researched Seattle opportunities.
 * That was one child's local research, and a catalog fixed at build time is the
 * wrong shape for an app any family can sign into. */

export const SCHEMA = 1

const str = (v) => String(v ?? "")
const trimmed = (v) => str(v).trim()
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const nowISO = () => new Date().toISOString()
export const ts = (v) => { const n = Date.parse(v || ""); return Number.isNaN(n) ? 0 : n }

export const STATUSES = ["active", "paused", "completed"]

/** Nine colours that read in both themes, so an organisation is recognisable
 *  at a glance without needing a legend. */
export const ORG_COLORS = [
  "#0f7a6b", "#3b6fb6", "#7c3aed", "#c2417d", "#b4653a",
  "#9c6f16", "#2e7d5b", "#0891b2", "#64748b",
]

export function emptyData() {
  return { schema: SCHEMA, updatedAt: nowISO(), organizations: [], workItems: [], entries: [], deleted: {} }
}

export function newOrg(f = {}, index = 0) {
  return {
    id: uid(),
    name: trimmed(f.name),
    contact: trimmed(f.contact),
    website: trimmed(f.website),
    notes: trimmed(f.notes),
    color: ORG_COLORS.includes(f.color) ? f.color : ORG_COLORS[index % ORG_COLORS.length],
    createdAt: nowISO(), at: nowISO(),
  }
}

export function newWorkItem(f = {}) {
  return {
    id: uid(),
    orgId: str(f.orgId),
    title: trimmed(f.title),
    description: trimmed(f.description),
    status: STATUSES.includes(f.status) ? f.status : "active",
    targetHours: Math.max(0, round2(f.targetHours)),
    createdAt: nowISO(), at: nowISO(),
  }
}

export function newEntry(f = {}) {
  return {
    id: uid(),
    date: ISO_DATE.test(f.date) ? f.date : todayISO(),
    orgId: str(f.orgId),
    workItemId: str(f.workItemId),
    activity: trimmed(f.activity) || "Volunteer work",
    hours: Math.max(0, round2(f.hours)),
    notes: trimmed(f.notes),
    createdAt: nowISO(), at: nowISO(),
  }
}

/** Coerce arbitrary JSON into a dataset. Throws when it is not even an object. */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("That file is not a Service data file.")
  }
  const out = emptyData()
  const fileAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString()
  out.updatedAt = fileAt
  const stamp = (r) => str(r.at || r.updatedAt || r.createdAt || fileAt)

  out.organizations = (Array.isArray(raw.organizations) ? raw.organizations : [])
    .filter((o) => o && typeof o === "object" && trimmed(o.name))
    .map((o, i) => ({
      id: str(o.id || uid()), name: trimmed(o.name), contact: trimmed(o.contact),
      website: trimmed(o.website), notes: trimmed(o.notes),
      color: ORG_COLORS.includes(o.color) ? o.color : ORG_COLORS[i % ORG_COLORS.length],
      createdAt: str(o.createdAt || fileAt), at: stamp(o),
    }))
  const orgIds = new Set(out.organizations.map((o) => o.id))

  out.workItems = (Array.isArray(raw.workItems) ? raw.workItems : [])
    .filter((w) => w && typeof w === "object" && trimmed(w.title) && orgIds.has(str(w.orgId)))
    .map((w) => ({
      id: str(w.id || uid()), orgId: str(w.orgId), title: trimmed(w.title), description: trimmed(w.description),
      status: STATUSES.includes(w.status) ? w.status : "active",
      targetHours: Math.max(0, round2(w.targetHours)),
      createdAt: str(w.createdAt || fileAt), at: stamp(w),
    }))
  const itemIds = new Set(out.workItems.map((w) => w.id))

  out.entries = (Array.isArray(raw.entries) ? raw.entries : [])
    .filter((e) => e && typeof e === "object" && ISO_DATE.test(str(e.date)))
    .map((e) => ({
      id: str(e.id || uid()), date: str(e.date),
      // An entry whose organisation or work item is gone keeps its hours and
      // loses only the link, so deleting an organisation never silently
      // destroys a record of work that was actually done.
      orgId: orgIds.has(str(e.orgId)) ? str(e.orgId) : "",
      workItemId: itemIds.has(str(e.workItemId)) ? str(e.workItemId) : "",
      activity: trimmed(e.activity) || "Volunteer work",
      hours: Math.max(0, round2(e.hours)),
      notes: trimmed(e.notes),
      createdAt: str(e.createdAt || fileAt), at: stamp(e),
    }))
    .filter((e) => e.hours > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const dead = raw.deleted && typeof raw.deleted === "object" && !Array.isArray(raw.deleted) ? raw.deleted : {}
  for (const k of Object.keys(dead)) if (typeof dead[k] === "string") out.deleted[k] = dead[k]

  return out
}

/** Per record: last write wins by `at`; a tombstone newer than the record beats
 *  it on both sides; a record only one side has is kept. */
export function mergeData(local, remoteRaw) {
  let remote
  try { remote = normalize(remoteRaw) } catch { return local }

  const dead = { ...remote.deleted, ...local.deleted }
  for (const k of Object.keys(remote.deleted)) {
    if (ts(remote.deleted[k]) > ts(dead[k])) dead[k] = remote.deleted[k]
  }
  const alive = (r) => !dead[r.id] || ts(dead[r.id]) < ts(r.at)
  const mergeList = (a, b) => {
    const byId = new Map(a.map((r) => [r.id, r]))
    for (const r of b) { const l = byId.get(r.id); if (!l || ts(r.at) > ts(l.at)) byId.set(r.id, r) }
    return [...byId.values()].filter(alive)
  }

  const organizations = mergeList(local.organizations, remote.organizations)
  const orgIds = new Set(organizations.map((o) => o.id))
  const workItems = mergeList(local.workItems, remote.workItems).filter((w) => orgIds.has(w.orgId))
  const itemIds = new Set(workItems.map((w) => w.id))
  const entries = mergeList(local.entries, remote.entries)
    .map((e) => ({
      ...e,
      orgId: orgIds.has(e.orgId) ? e.orgId : "",
      workItemId: itemIds.has(e.workItemId) ? e.workItemId : "",
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return { ...local, organizations, workItems, entries, deleted: dead, updatedAt: nowISO() }
}

/* ---------- derived numbers: computed, never stored ---------- */

export const sumHours = (list) => round2(list.reduce((n, e) => n + (Number(e.hours) || 0), 0))

export function totals(s, now = new Date()) {
  const year = String(now.getFullYear())
  const thisYear = s.entries.filter((e) => e.date.startsWith(year))
  return {
    hours: sumHours(s.entries),
    thisYear: sumHours(thisYear),
    sessions: s.entries.length,
    organizations: s.organizations.length,
    active: s.workItems.filter((w) => w.status === "active").length,
    lastDate: s.entries.length ? s.entries[0].date : "",
  }
}

export const hoursForItem = (s, id) => sumHours(s.entries.filter((e) => e.workItemId === id))
export const hoursForOrg = (s, id) => sumHours(s.entries.filter((e) => e.orgId === id))
