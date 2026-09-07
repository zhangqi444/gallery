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
  return { schema: SCHEMA, updatedAt: nowISO(), results: {}, sessions: [], books: {}, essays: {}, deleted: {} }
}

/** A book is only ever one of these; anything else means the record is wrong. */
export const BOOK_STATES = ["reading", "finished"]

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
      // "practice" for a subject set, "mock" for a mock exam section, "words"
      // for a vocabulary set. Older rows have no kind and are practice.
      kind: ["practice", "mock", "words"].includes(str(s.kind)) ? str(s.kind) : "practice",
      subject: str(s.subject),
      label: str(s.label),
      date: /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)) ? str(s.date) : todayISO(),
      asked: Math.max(0, Number(s.asked) || 0),
      right: Math.max(0, Number(s.right) || 0),
      at: str(s.at || s.createdAt || fileAt),
    }))
    .filter((s) => s.asked > 0)
    .sort((a, b) => ts(b.at) - ts(a.at))

  const books = raw.books && typeof raw.books === "object" && !Array.isArray(raw.books) ? raw.books : {}
  for (const [id, b] of Object.entries(books)) {
    if (!b || typeof b !== "object" || !BOOK_STATES.includes(str(b.state))) continue
    out.books[id] = {
      state: str(b.state),
      title: str(b.title),
      author: str(b.author),
      at: str(b.at || fileAt),
    }
  }

  const essays = raw.essays && typeof raw.essays === "object" && !Array.isArray(raw.essays) ? raw.essays : {}
  for (const [id, e] of Object.entries(essays)) {
    if (!e || typeof e !== "object") continue
    const strMap = (o) => {
      const out = {}
      if (o && typeof o === "object" && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o)) out[str(k)] = str(v)
      }
      return out
    }
    out.essays[id] = {
      plan: strMap(e.plan),
      draft: strMap(e.draft),
      checks: Array.isArray(e.checks) ? e.checks.map(str) : [],
      at: str(e.at || fileAt),
    }
  }

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

  const books = { ...local.books }
  for (const [id, b] of Object.entries(remote.books)) {
    const l = books[id]
    if (!l || ts(b.at) > ts(l.at)) books[id] = b
  }
  for (const id of Object.keys(books)) {
    const d = dead["book:" + id]
    if (d && ts(d) >= ts(books[id].at)) delete books[id]
  }

  // An essay is a document, not a set of fields: the whole of the later one
  // wins, because merging two half-written drafts field by field would produce
  // a paragraph nobody wrote.
  const essays = { ...local.essays }
  for (const [id, e] of Object.entries(remote.essays)) {
    const l = essays[id]
    if (!l || ts(e.at) > ts(l.at)) essays[id] = e
  }

  const byId = new Map(local.sessions.map((s) => [s.id, s]))
  for (const s of remote.sessions) {
    const l = byId.get(s.id)
    if (!l || ts(s.at) > ts(l.at)) byId.set(s.id, s)
  }
  const sessions = [...byId.values()]
    .filter((s) => !dead[s.id] || ts(dead[s.id]) < ts(s.at))
    .sort((a, b) => ts(b.at) - ts(a.at))

  return { ...local, results, sessions, books, essays, deleted: dead, updatedAt: nowISO() }
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

/** Every mock section already sat, so a part-finished exam can be resumed
 *  rather than restarted. Keyed "<mockId>:<section>". */
export function mockDone(s) {
  const done = {}
  for (const r of s.sessions) {
    if (r.kind === "mock" && r.subject.includes(":") && !done[r.subject]) done[r.subject] = r
  }
  return done
}

export const words = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length
export const essayWords = (e) => (e ? Object.values(e.draft).reduce((n, t) => n + words(t), 0) : 0)
export const essaysStarted = (s) => Object.values(s.essays).filter((e) => essayWords(e) > 0).length

export const booksFinished = (s) => Object.values(s.books).filter((b) => b.state === "finished").length
export const booksReading = (s) => Object.values(s.books).filter((b) => b.state === "reading").length

export function streakDays(s, today = todayISO()) {
  const days = new Set(s.sessions.map((x) => x.date))
  let n = 0
  const d = new Date(today + "T00:00:00Z")
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1) }
  return n
}
