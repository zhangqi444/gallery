/* Learning: practice sets, mock exam sections, and the weekly words.
 *
 * The index of what there is to do is the only thing fetched when this opens. A
 * subject, a mock or the word lists arrive when one is chosen, which is why the
 * content is split by topic rather than shipped as one bundle.
 *
 * All three ways of practising end in the same runner, because they are the
 * same act: read a question, choose, be told at once whether that was right and
 * why. A nine-year-old learns from the correction while she still remembers
 * what she was thinking, not from a score at the end. */
import { useEffect, useState } from "react"
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react"

import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/format"
import { answerIndex, books, isCorrect, loadIndex, loadTopic, mocks, sectionLabel, subjects, wordSets } from "./content"
import { booksFinished, booksReading, mockDone, recentSessions, streakDays, subjectProgress } from "./model"
import { useLearning } from "./store"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

const SET_SIZE = 10
const LETTERS = "ABCDE"
const TABS = [
  { id: "practice", label: "Practise" },
  { id: "mock", label: "Mock exams" },
  { id: "words", label: "Words" },
  { id: "books", label: "Books" },
]

/** Questions never seen come first, then ones answered wrongly, so a set is
 *  always new ground or a second chance rather than idle repetition. */
function chooseSet(items, results, size = SET_SIZE) {
  const unseen = [], wrong = [], right = []
  for (const q of items) {
    const r = results[q.id]
    if (!r) unseen.push(q)
    else if (!r.correct) wrong.push(q)
    else right.push(q)
  }
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
  return [...shuffle(unseen), ...shuffle(wrong), ...shuffle(right)].slice(0, size)
}

function Passage({ text, title }) {
  return (
    <details className="mt-3 rounded-lg border bg-muted/40 p-3" data-testid="passage">
      <summary className="cursor-pointer text-sm font-medium">{title || "The passage"}</summary>
      <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
    </details>
  )
}

/** One run of questions, whatever they came from. */
function Runner({ run, store, onDone, onStop }) {
  const [set] = useState(() => chooseSet(run.items, store.s.results, run.size || SET_SIZE))
  const [at, setAt] = useState(0)
  const [choice, setChoice] = useState(null)
  const [right, setRight] = useState(0)

  const q = set[at]
  if (!q) return <p className="text-muted-foreground">There is nothing here to practise yet.</p>

  const key = answerIndex(q)
  const answered = choice !== null
  const passage = q.p ? run.passages[q.p] : null

  const pick = (i) => {
    if (answered) return
    setChoice(i)
    const ok = isCorrect(q, i)
    if (ok) setRight((n) => n + 1)
    store.answer(q.id, run.subject, i, ok)
  }
  const next = () => {
    if (at + 1 >= set.length) {
      store.finishSession({ subject: run.subject, kind: run.kind, label: run.label, asked: set.length, right })
      onDone({ asked: set.length, right })
      return
    }
    setAt(at + 1)
    setChoice(null)
  }

  return (
    <div data-testid="practice">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {run.label} · question <span data-testid="practice-at">{at + 1}</span> of {set.length}
        </p>
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
            <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${(at / set.length) * 100}%` }} />
          </span>
          {/* A child must be able to stop. Answers already given are kept; the
              unfinished set is simply not recorded as a session. */}
          <Button variant="ghost" size="sm" data-testid="practice-stop" onClick={onStop}>Stop</Button>
        </div>
      </div>

      {passage && <Passage text={passage.x} title={passage.t} />}

      <p className="mt-4 text-lg" data-testid="question">{q.q}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {(q.c || []).map((c, i) => {
          const isKey = i === key
          const chosen = choice === i
          return (
            <li key={i}>
              <button type="button" data-testid="choice" disabled={answered} onClick={() => pick(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  !answered && "cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  answered && isKey && "border-primary bg-accent text-accent-foreground",
                  answered && chosen && !isKey && "border-destructive text-destructive",
                  answered && !isKey && !chosen && "opacity-60",
                )}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium">{LETTERS[i]}</span>
                <span className="flex-1">{c}</span>
                {answered && isKey && <CheckIcon className="size-4 shrink-0 text-primary" />}
                {answered && chosen && !isKey && <XIcon className="size-4 shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>

      {answered && (
        <div className="mt-4 rounded-lg border bg-card p-4" data-testid="marking">
          <p className="text-sm font-medium">
            {isCorrect(q, choice) ? "That's right." : `Not this time — the answer is ${LETTERS[key]}.`}
          </p>
          {q.e && <p className="mt-1 text-sm text-muted-foreground">{q.e}</p>}
          <Button className="mt-3" data-testid="practice-next" onClick={next}>
            {at + 1 >= set.length ? "See how I did" : "Next"} <ArrowRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}

function Result({ result, run, onAgain, onFinish }) {
  const pct = Math.round((result.right / result.asked) * 100)
  return (
    <div className="mx-auto max-w-md text-center" data-testid="result">
      <p className="text-sm text-muted-foreground">{run.label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums" data-testid="result-score">{result.right} / {result.asked}</p>
      <p className="mt-1 text-muted-foreground">
        {pct === 100 ? "Every one." : pct >= 70 ? "Good going." : "Worth another look."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button data-testid="practice-again" onClick={onAgain}>Another {result.asked}</Button>
        <Button variant="outline" data-testid="practice-done" onClick={onFinish}>Done for now</Button>
      </div>
    </div>
  )
}

/* ---------- the reading log ---------- */

function Books({ store }) {
  const { note, list } = books()
  const finished = booksFinished(store.s)
  const reading = booksReading(store.s)
  return (
    <div className="mt-4" data-testid="book-list">
      <p className="text-sm text-muted-foreground" data-testid="book-count">
        {finished === 0 && reading === 0
          ? "Mark a book when you start it, and again when you finish."
          : `${finished} finished${reading ? `, ${reading} on the go` : ""}.`}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {list.map((b) => {
          const state = store.bookState(b.id)
          return (
            <li key={b.id} className="rounded-xl border bg-card p-4" data-testid="book">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-xs text-muted-foreground">{b.author}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant={state === "reading" ? "default" : "outline"} size="sm" data-testid="book-reading"
                    onClick={() => store.setBook(b.id, "reading", b)}>Reading</Button>
                  <Button variant={state === "finished" ? "default" : "outline"} size="sm" data-testid="book-finished"
                    onClick={() => store.setBook(b.id, "finished", b)}>Finished</Button>
                </div>
              </div>
              {b.why && <p className="mt-2 text-sm text-muted-foreground">{b.why}</p>}
            </li>
          )
        })}
      </ul>
      {note && <p className="mt-4 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/* ---------- choosing what to do ---------- */

function Bar({ done, total }) {
  return (
    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </span>
  )
}

function Choice({ testid, title, right, children, onClick, busy }) {
  return (
    <li>
      <button type="button" data-testid={testid} disabled={busy} onClick={onClick}
        className="w-full cursor-pointer rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md disabled:opacity-60">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">{title}</h3>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{busy ? "Loading…" : right}</span>
        </div>
        {children}
      </button>
    </li>
  )
}

export default function Learning() {
  useTitle("My practice")
  const session = useSession()
  const store = useLearning()
  const [index, setIndex] = useState(null)
  const [error, setError] = useState("")
  const [tab, setTab] = useState("practice")
  const [openMock, setOpenMock] = useState("")
  const [run, setRun] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState("")

  useEffect(() => { loadIndex().then(setIndex).catch((e) => setError(e.message)) }, [])

  const done = mockDone(store.s)

  if (!session.signedIn()) {
    return (
      <p className="mx-auto max-w-2xl text-muted-foreground" data-testid="learning-locked">
        Sign in to keep your practice. It is saved in your own Google Drive.
      </p>
    )
  }
  if (error) return <p className="mx-auto max-w-2xl text-destructive" data-testid="learning-error">{error}</p>
  if (!index) return <p className="mx-auto max-w-2xl text-sm text-muted-foreground">Loading…</p>

  const open = async (id, build) => {
    setBusy(id)
    try {
      const next = await build()
      setResult(null)
      setRun(next)
    } catch (e) { setError(e.message) } finally { setBusy("") }
  }

  const startSubject = (s) => open(s.id, async () => {
    const topic = await loadTopic(s.file)
    return { kind: "practice", subject: s.id, label: s.label, items: topic.items, passages: topic.passages }
  })

  const startMockSection = (m, sec) => open(m.id + sec.id, async () => {
    const topic = await loadTopic(m.file)
    return {
      kind: "mock", subject: `${m.id}:${sec.id}`,
      label: `${m.label} · ${sectionLabel(sec.id)}`,
      items: topic.sections[sec.id] || [], passages: topic.passages,
    }
  })

  const startWords = (w) => open(w.id, async () => {
    const all = await loadTopic("precision.json")
    const entry = all[w.id] || {}
    // A word list is not multiple choice, so it is asked as one: the word, and
    // its own meaning among three others drawn from the same week. The choices
    // are shuffled — with the answer always first, a child learns to pick A.
    const words = entry.words || []
    const pick = (a, n) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v).slice(0, n)
    const items = words
      .filter((word) => word.word && word.meaning)
      .map((word, i) => {
        const others = pick(words.filter((o, j) => j !== i && o.meaning), 3).map((o) => o.meaning)
        const choices = pick([word.meaning, ...others], 4)
        return {
          id: `${w.id}-${word.word}`,
          q: `${String(word.word).toUpperCase()} most nearly means:`,
          c: choices,
          k: choices.indexOf(word.meaning),
          e: word.example || word.usage || "",
          p: "", sk: "vocabulary",
        }
      })
    return { kind: "words", subject: w.id, label: entry.title ? `Words · ${w.id}` : `Words ${w.id}`, items, passages: {} }
  })

  if (run && result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Result result={result} run={run}
          onAgain={() => { setResult(null); setRun({ ...run }) }}
          onFinish={() => { setRun(null); setResult(null) }} />
      </div>
    )
  }
  if (run) {
    return (
      <div className="mx-auto max-w-2xl">
        <Runner key={run.subject + store.s.sessions.length} run={run} store={store}
          onDone={setResult} onStop={() => { setRun(null); setResult(null) }} />
      </div>
    )
  }

  const streak = streakDays(store.s)
  const recent = recentSessions(store.s)

  return (
    <div className="mx-auto max-w-2xl" data-testid="learning">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">My practice</h1>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} in a row.` : "Pick something to practise."}
        </p>
      </header>

      <nav className="mt-4 flex gap-1" data-testid="learning-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" data-testid={`tab-${t.id}`} onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60")}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "practice" && (
        <ul className="mt-4 flex flex-col gap-3" data-testid="subject-list">
          {subjects().map((s) => {
            const p = subjectProgress(store.s, s.id, s.count)
            return (
              <Choice key={s.id} testid={`subject-${s.id}`} title={s.label} busy={busy === s.id}
                right={`${p.seen} of ${p.total} tried`} onClick={() => startSubject(s)}>
                <div className="mt-2 flex items-center gap-3">
                  <Bar done={p.seen} total={p.total} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.percent === null ? "—" : `${p.percent}%`}
                  </span>
                </div>
              </Choice>
            )
          })}
        </ul>
      )}

      {tab === "mock" && (
        <ul className="mt-4 flex flex-col gap-3" data-testid="mock-list">
          {mocks().map((m) => {
            const sat = m.sections.filter((sec) => done[`${m.id}:${sec.id}`]).length
            const isOpen = openMock === m.id
            return (
              <li key={m.id} className="rounded-xl border bg-card p-4">
                <button type="button" data-testid={`mock-${m.id}`} className="w-full cursor-pointer text-left"
                  onClick={() => setOpenMock(isOpen ? "" : m.id)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{m.label}</h3>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {sat} of {m.sections.length} sections
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Bar done={sat} total={m.sections.length} />
                    <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{isOpen ? "Hide" : "Open"}</span>
                  </div>
                </button>
                {isOpen && (
                  <ul className="mt-3 flex flex-col gap-1.5 border-t pt-3" data-testid="mock-sections">
                    {m.sections.map((sec) => {
                      const row = done[`${m.id}:${sec.id}`]
                      return (
                        <li key={sec.id} className="flex items-center gap-3 text-sm">
                          <span className="flex-1">{sectionLabel(sec.id)}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {row ? `${row.right} / ${row.asked}` : `${sec.count} questions`}
                          </span>
                          <Button variant="outline" size="sm" data-testid={`mock-start-${sec.id}`}
                            disabled={busy === m.id + sec.id} onClick={() => startMockSection(m, sec)}>
                            {row ? "Again" : "Start"}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {tab === "words" && (
        <ul className="mt-4 flex flex-col gap-3" data-testid="word-list">
          {wordSets().map((w) => {
            const p = subjectProgress(store.s, w.id, w.count)
            return (
              <Choice key={w.id} testid={`words-${w.id}`} title={`Week ${w.id.replace(/^W/, "")}`} busy={busy === w.id}
                right={`${w.count} words`} onClick={() => startWords(w)}>
                <div className="mt-2 flex items-center gap-3">
                  <Bar done={p.seen} total={w.count} />
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.percent === null ? "—" : `${p.percent}%`}
                  </span>
                </div>
              </Choice>
            )
          })}
        </ul>
      )}

      {tab === "books" && <Books store={store} />}

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lately</h2>
          <ul className="mt-3 divide-y rounded-xl border bg-card" data-testid="session-list">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <time dateTime={r.date} className="w-24 shrink-0 tabular-nums text-muted-foreground">{fmtDate(r.date)}</time>
                <span className="min-w-0 flex-1 truncate">{r.label || sectionLabel(r.subject)}</span>
                <span className="tabular-nums">{r.right} / {r.asked}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
