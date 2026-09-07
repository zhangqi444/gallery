import { NotMovedYet } from "@/components/not-moved-yet"

export default function Service() {
  return (
    <NotMovedYet
      id="service"
      title="Service"
      lede="The organisations I help, what I plan, and the hours I have given."
      from="zhangqi444/volunteer"
      brings={[
        "The catalog of opportunities, each checked against my age",
        "Plans on a calendar, and turning a plan into logged hours",
        "Work items, the hours log and the organisations behind them",
        "Reports to hand to a school, with signature lines",
      ]}
      note="That app already has export and import in its settings, so its data comes across as a file without changing it. It keeps working until this module replaces it."
    />
  )
}
