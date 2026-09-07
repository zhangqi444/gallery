/* Learning's content, fetched a topic at a time.
 *
 * The index says what there is to do — subjects with their counts and skills,
 * the mock exams, the vocabulary sets — and is the only thing fetched when the
 * module opens. A subject's questions arrive when a child chooses that subject,
 * and are then kept for the rest of the visit.
 *
 * This is why site/make_learning.py writes a file per topic instead of one
 * bundle: 27 kB to decide what to practise, rather than 689 kB. */

const BASE = "content/learning/"
const cache = new Map()

export const L = { index: null }

async function fetchJson(file) {
  const res = await fetch(BASE + file, { cache: "no-cache" })
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status}).`)
  return res.json()
}

export async function loadIndex() {
  if (L.index) return L.index
  L.index = await fetchJson("index.json")
  return L.index
}

/** One topic, fetched once and remembered. Concurrent callers share a request. */
export function loadTopic(file) {
  if (!cache.has(file)) cache.set(file, fetchJson(file).catch((e) => { cache.delete(file); throw e }))
  return cache.get(file)
}

export const subjects = () => (L.index ? L.index.subjects : [])
export const subject = (id) => subjects().find((s) => s.id === id) || null
export const mocks = () => (L.index ? L.index.mocks : [])
export const mock = (id) => mocks().find((m) => m.id === id) || null
export const wordSets = () => (L.index ? L.index.precision : [])
/** The essay programme: eight weeks with a prompt each, and a bank of others.
 *  Fetched only when the Essays tab is opened. */
export async function loadEssays() {
  const e = await loadTopic("essay.json")
  const weeks = Object.entries(e.weeks || {})
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([id, w]) => ({ id, ...w }))
  return { weeks, bank: e.bank || [], rubric: e.rubric || {}, guide: e.guide || {} }
}

export const books = () => {
  const b = (L.index && L.index.books) || {}
  const starter = (b.starter || []).map((x) => ({ ...x, id: x.id || x.title, suggested: false }))
  const suggested = (b.suggestions || []).map((x) => ({ ...x, id: x.id || x.title, suggested: true }))
  return { note: b.note || "", list: [...starter, ...suggested] }
}

/** The four sections of a mock are the four subjects; give them the names the
 *  subject list already uses rather than a bare code. */
export function sectionLabel(id) {
  const s = subject(id)
  return s ? s.label : String(id).toUpperCase()
}

/** `k` is already the index of the right choice: make_learning.py resolves the
 *  source's A-D letters once, at build time, so no screen has to. */
export const answerIndex = (q) => (Number.isInteger(q.k) ? q.k : -1)
export const isCorrect = (q, choice) => choice === answerIndex(q)
