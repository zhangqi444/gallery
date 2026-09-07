/* The modules The Little Me is made of.
 *
 * Everything the shell needs to show a module lives here, so adding a fourth is
 * one entry rather than an edit in five files. `load` is a dynamic import on
 * purpose: Learning carries a large content bundle, and someone opening the app
 * to look at a drawing must not download a question bank to do it. */
import { lazy } from "react"

export const MODULES = [
  {
    id: "learning",
    label: "Learning",
    mine: "My practice",
    blurb: "Practice, reading, essays and the books I finished.",
    from: "zhangqi444/isee",
    ready: false,
    Component: lazy(() => import("./learning/index.jsx")),
  },
  {
    id: "service",
    label: "Service",
    mine: "My hours",
    blurb: "The organisations I help, what I plan, and the hours I have given.",
    from: "zhangqi444/volunteer",
    ready: true,
    Component: lazy(() => import("./service/index.jsx")),
  },
  {
    id: "gallery",
    label: "Gallery",
    mine: "My pictures",
    blurb: "Pictures I have made, and the ones I have published for anyone to see.",
    from: "this repository",
    ready: true,
    Component: lazy(() => import("./gallery/pages/studio.jsx").then((m) => ({ default: m.Studio }))),
  },
]

export const moduleById = (id) => MODULES.find((m) => m.id === id) || null
