/* The Learning module's data, on the same store contract as Service and Gallery. */
import { createModuleStore, useModuleStore } from "@/lib/module-store"
import { emptyData, mergeData, normalize, nowISO, todayISO, uid } from "./model"

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
})

export const useLearning = () => useModuleStore(LearningStore)
