/* The Learning module's data, on the same store contract as Service and Gallery. */
import { createModuleStore, useModuleStore } from "@/lib/module-store"
import { booksFinished, BOOK_STATES, emptyData, essaysStarted, mergeData, normalize, nowISO, streakDays, todayISO, uid } from "./model"

export const LearningStore = createModuleStore({
  name: "learning",
  file: "learning.json",
  key: "littleme.learning.v1",
  empty: emptyData,
  normalize,
  merge: mergeData,
})

Object.assign(LearningStore, {
  /** The latest answer to one question. Answering again replaces it. */
  answer(questionId, subject, choice, correct) {
    this.s.results[questionId] = { correct: Boolean(correct), choice, subject, at: nowISO() }
    this.commit()
  },
  /** One finished practice session, kept as a row so progress has a history. */
  finishSession({ subject, asked, right, kind = "practice", label = "" }) {
    if (!(asked > 0)) return null
    const row = { id: uid(), kind, subject, label, date: todayISO(), asked, right, at: nowISO() }
    this.s.sessions.unshift(row)
    this.commit()
    return row
  },
  resultFor(questionId) { return this.s.results[questionId] || null },

  /** Reading: a book is not started, being read, or finished. Pressing the
   *  state it is already in clears it, so a mistake is one click to undo. */
  setBook(id, state, about = {}) {
    if (!BOOK_STATES.includes(state)) return
    const cur = this.s.books[id]
    if (cur && cur.state === state) {
      delete this.s.books[id]
      this.bury("book:" + id)
    } else {
      this.s.books[id] = { state, title: about.title || (cur && cur.title) || "", author: about.author || (cur && cur.author) || "", at: nowISO() }
    }
    this.commit()
  },
  bookState(id) { return this.s.books[id] ? this.s.books[id].state : "" },

  /** Writing: one record per prompt, holding the plan, the draft and which of
   *  the week's checks have been ticked. */
  essay(id) { return this.s.essays[id] || { plan: {}, draft: {}, checks: [], at: "" } },
  setEssayField(id, part, field, value) {
    const cur = this.essay(id)
    this.s.essays[id] = { ...cur, [part]: { ...cur[part], [field]: String(value) }, at: nowISO() }
    this.commit()
  },
  toggleEssayCheck(id, check) {
    const cur = this.essay(id)
    const checks = cur.checks.includes(check) ? cur.checks.filter((c) => c !== check) : [...cur.checks, check]
    this.s.essays[id] = { ...cur, checks, at: nowISO() }
    this.commit()
  },
})

export const useLearning = () => useModuleStore(LearningStore)

export function learningSummary() {
  const s = LearningStore.s
  const done = Object.keys(s.results).length
  if (!done) return { line: "Nothing practised yet", detail: "Pick a subject and try ten questions." }
  const streak = streakDays(s)
  const last = s.sessions[0]
  const read = booksFinished(s)
  const written = essaysStarted(s)
  return {
    line: `${done} question${done === 1 ? "" : "s"} answered`,
    detail: [
      streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row` : "",
      last ? `last set ${last.right} out of ${last.asked}` : "",
      read ? `${read} book${read === 1 ? "" : "s"} finished` : "",
      written ? `${written} essay${written === 1 ? "" : "s"} started` : "",
    ].filter(Boolean).join(" · ") || "Keep going.",
  }
}
