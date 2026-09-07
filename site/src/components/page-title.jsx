import { useEffect } from "react"

import { C } from "@/modules/gallery/content"

/** Sets document.title for the current view. */
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} – ${C.site.title}` : C.site.title
  }, [title])
}
