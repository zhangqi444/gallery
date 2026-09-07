import { NotMovedYet } from "@/components/not-moved-yet"

export default function Learning() {
  return (
    <NotMovedYet
      id="learning"
      title="Learning"
      lede="Practice, reading, essays and the books I finished."
      from="zhangqi444/isee"
      brings={[
        "Four subjects of practice, with the question banks behind them",
        "36 reading passages",
        "Essays with their guide and rubric, and four mock exams",
        "Precision vocabulary, the eight-week plan, books and rewards",
      ]}
      note="Its content bundle is 580 kB, so it is loaded only when this module is opened. Existing progress comes across by exporting progress.json from Drive and importing it here; the old app is not changed and keeps working until then."
    />
  )
}
