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

/** `k` is already the index of the right choice: make_learning.py resolves the
 *  source's A-D letters once, at build time, so no screen has to. */
export const answerIndex = (q) => (Number.isInteger(q.k) ? q.k : -1)
export const isCorrect = (q, choice) => choice === answerIndex(q)
