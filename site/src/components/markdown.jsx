import { useMemo } from "react"

import { render } from "@/lib/markdown"
import { cn } from "@/lib/utils"

export function Markdown({ body, className }) {
  const html = useMemo(() => render(body), [body])
  return <div className={cn("prose", className)} data-testid="prose" dangerouslySetInnerHTML={{ __html: html }} />
}
