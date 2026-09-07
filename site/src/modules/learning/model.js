/* Learning: what has been answered, and how each practice session went.
 *
 * Only the raw records are kept — the latest answer to each question, and one
 * row per session. Everything a screen shows (how many right, what is still
 * unseen, which skills are weak) is computed from those, never stored, so a
 * change of mind about how progress is measured never needs a migration. */

export const SCHEMA = 1

const str = (v) => String(v ?? "")
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
export const nowISO = () => new Date().toISOString()
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const ts = (v) => { const n = Date.parse(v || ""); return Number.isNaN(n) ? 0 : n }

export function emptyData() {
  return { schema: SCHEMA, updatedAt: nowISO(), results: {}, sessions: [], deleted: {} }
}

export function normalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("That file is not a Learning data file.")
  }
  const out = emptyData()
  const fileAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString()
  out.updatedAt = fileAt

  const results = raw.results && typeof raw.results === "object" && !Array.isArray(raw.results) ? raw.results : {}
  for (const [id, r] of Object.entries(results)) {
    if (!r || typeof r !== "object") continue
    out.results[id] = {
      correct: Boolean(r.correct),
      choice: Number.isInteger(r.choice) ? r.choice : -1,
      subject: str(r.subject),
      at: str(r.at || fileAt),
    }
  }

  out.sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      id: str(s.id || uid()),
      subject: str(s.subject),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)) ? str(s.date) : todayISO(),
      asked: Math.max(0, Number(s.asked) || 0),
      right: Math.max(0, Number(s.right) || 0),
      at: str(s.at || s.createdAt || fileAt),
    }))
    .filter((s) => s.asked > 0)
    .sort((a, b) => ts(b.at) - ts(a.at))

  const dead = raw.deleted && typeof raw.deleted === "object" && !Array.isArray(raw.deleted) ? raw.deleted : {}
  for (const k of Object.keys(dead)) if (typeof dead[k] === "string") out.deleted[k] = dead[k]

  return out
}

export function mergeData(local, remoteRaw) {
  let remote
  try { remote = normalize(remoteRaw) } catch { return local }

  const dead = { ...remote.deleted, ...local.deleted }
  for (const k of Object.keys(remote.deleted)) {
    if (ts(remote.deleted[k]) > ts(dead[k])) dead[k] = remote.deleted[k]
  }

  // An answer is a fact about a moment: the later one wins.
  const results = { ...local.results }
  for (const [id, r] of Object.entries(remote.results)) {
    const l = results[id]
    if (!l || ts(r.at) > ts(l.at)) results[id] = r
  }

  const byId = new Map(local.sessions.map((s) => [s.id, s]))
  for (const s of remote.sessions) {
    const l = byId.get(s.id)
    if (!l || ts(s.at) > ts(l.at)) byId.set(s.id, s)
  }
  const sessions = [...byId.values()]
    .filter((s) => !dead[s.id] || ts(dead[s.id]) < ts(s.at))
    .sort((a, b) => ts(b.at) - ts(a.at))

  return { ...local, results, sessions, deleted: dead, updatedAt: nowISO() }
}

/* ---------- derived, never stored ---------- */

export function subjectProgress(s, subjectId, total) {
  const seen = Object.values(s.results).filter((r) => r.subject === subjectId)
  const right = seen.filter((r) => r.correct).length
  return {
    seen: seen.length,
    right,
    total,
    percent: seen.length ? Math.round((right / seen.length) * 100) : null,
  }
}

export function recentSessions(s, n = 5) { return s.sessions.slice(0, n) }

export function streakDays(s, today = todayISO()) {
  const days = new Set(s.sessions.map((x) => x.date))
  let n = 0
  const d = new Date(today + "T00:00:00Z")
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1) }
  return n
}
