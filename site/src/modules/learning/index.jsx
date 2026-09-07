/* Learning: choose something to practise, answer ten questions, see how it went.
 *
 * The index of subjects is the only thing fetched when this opens. A subject's
 * questions arrive when it is chosen, which is why the content is split by topic
 * rather than shipped as one bundle.
 *
 * A question is marked as soon as it is answered, with the explanation, because
 * a nine-year-old learns from the correction while she still remembers what she
 * was thinking — not from a score at the end. */
import { useEffect, useMemo, useState } from "react"
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react"

import { useSession } from "@/lib/session"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/format"
import { answerIndex, isCorrect, loadIndex, loadTopic, subjects } from "./content"
import { recentSessions, streakDays, subjectProgress } from "./model"
import { useLearning } from "./store"
import { Button } from "@/components/ui/button"
import { useTitle } from "@/components/page-title"

const SET_SIZE = 10
const LETTERS = "ABCDE"

/** Ten questions: ones never seen first, then ones answered wrongly, so a set
 *  is always either new ground or a second chance, never idle repetition. */
function chooseSet(items, results) {
  const unseen = [], wrong = [], right = []
  for (const q of items) {
    const r = results[q.id]
    if (!r) unseen.push(q)
    else if (!r.correct) wrong.push(q)
    else right.push(q)
  }
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v)
  return [...shuffle(unseen), ...shuffle(wrong), ...shuffle(right)].slice(0, SET_SIZE)
}

function Passage({ text, title }) {
  return (
    <details className="mt-3 rounded-lg border bg-muted/40 p-3" data-testid="passage">
      <summary className="cursor-pointer text-sm font-medium">{title || "The passage"}</summary>
      <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
    </details>
  )
}

function Practice({ subject, topic, store, onDone }) {
  const [set] = useState(() => chooseSet(topic.items, store.s.results))
  const [at, setAt] = useState(0)
  const [choice, setChoice] = useState(null)
  const [right, setRight] = useState(0)

  const q = set[at]
  const key = q ? answerIndex(q) : -1
  const answered = choice !== null
  const passage = q && q.p ? topic.passages[q.p] : null

  if (!q) return null

  const pick = (i) => {
    if (answered) return
    setChoice(i)
    const ok = isCorrect(q, i)
    if (ok) setRight((n) => n + 1)
    store.answer(q.id, subject.id, i, ok)
  }
  const next = () => {
    if (at + 1 >= set.length) {
      store.finishSession({ subject: subject.id, asked: set.length, right })
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
          {subject.label} · question <span data-testid="practice-at">{at + 1}</span> of {set.length}
        </p>
        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${(at / set.length) * 100}%` }} />
        </span>
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
                  !answered && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  answered && isKey && "border-primary bg-accent text-accent-foreground",
                  answered && chosen && !isKey && "border-destructive text-destructive",
                  answered && !isKey && !chosen && "opacity-60",
                )}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium">
                  {LETTERS[i]}
                </span>
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

function Result({ result, subject, onAgain, onFinish }) {
  const pct = Math.round((result.right / result.asked) * 100)
  return (
    <div className="mx-auto max-w-md text-center" data-testid="result">
      <p className="text-sm text-muted-foreground">{subject.label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums" data-testid="result-score">
        {result.right} / {result.asked}
      </p>
      <p className="mt-1 text-muted-foreground">
        {pct === 100 ? "Every one." : pct >= 70 ? "Good going." : "Worth another look."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button data-testid="practice-again" onClick={onAgain}>Another ten</Button>
        <Button variant="outline" onClick={onFinish}>Done for now</Button>
      </div>
    </div>
  )
}

export default function Learning() {
  useTitle("My practice")
  const session = useSession()
  const store = useLearning()
  const [index, setIndex] = useState(null)
  const [error, setError] = useState("")
  const [active, setActive] = useState(null)     // { subject, topic }
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState("")

  useEffect(() => { loadIndex().then(setIndex).catch((e) => setError(e.message)) }, [])

  const list = useMemo(() => (index ? subjects() : []), [index])

  if (!session.signedIn()) {
    return (
      <p className="mx-auto max-w-2xl text-muted-foreground" data-testid="learning-locked">
        Sign in to keep your practice. It is saved in your own Google Drive.
      </p>
    )
  }
  if (error) return <p className="mx-auto max-w-2xl text-destructive" data-testid="learning-error">{error}</p>
  if (!index) return <p className="mx-auto max-w-2xl text-sm text-muted-foreground">Loading…</p>

  const start = async (s) => {
    setLoading(s.id)
    try {
      const topic = await loadTopic(s.file)
      setResult(null)
      setActive({ subject: s, topic })
    } catch (e) { setError(e.message) } finally { setLoading("") }
  }

  if (active && result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Result result={result} subject={active.subject}
          onAgain={() => { setResult(null); setActive({ ...active }) }}
          onFinish={() => { setActive(null); setResult(null) }} />
      </div>
    )
  }
  if (active) {
    return (
      <div className="mx-auto max-w-2xl">
        <Practice key={active.subject.id + String(store.s.sessions.length)}
          subject={active.subject} topic={active.topic} store={store} onDone={setResult} />
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

      <ul className="mt-5 flex flex-col gap-3" data-testid="subject-list">
        {list.map((s) => {
          const p = subjectProgress(store.s, s.id, s.count)
          return (
            <li key={s.id}>
              <button type="button" data-testid={`subject-${s.id}`} disabled={loading === s.id}
                onClick={() => start(s)}
                className="w-full rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md disabled:opacity-60 cursor-pointer">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">{s.label}</h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {loading === s.id ? "Loading…" : `${p.seen} of ${p.total} tried`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${p.total ? (p.seen / p.total) * 100 : 0}%` }} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.percent === null ? "—" : `${p.percent}%`}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lately</h2>
          <ul className="mt-3 divide-y rounded-xl border bg-card" data-testid="session-list">
            {recent.map((r) => {
              const s = list.find((x) => x.id === r.subject)
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <time dateTime={r.date} className="w-24 shrink-0 tabular-nums text-muted-foreground">{fmtDate(r.date)}</time>
                  <span className="min-w-0 flex-1 truncate">{s ? s.label : r.subject}</span>
                  <span className="tabular-nums">{r.right} / {r.asked}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
