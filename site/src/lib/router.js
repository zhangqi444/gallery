/* Hash router: works on GitHub Pages under a project subpath with no server rewrites.
 *
 * A published blog is addressed by the Drive file it lives in, so every route
 * may be prefixed with `/b/<blogId>`. That prefix is stripped here and put back
 * by `href`, which means no page has to know whether it is showing this
 * deployment's own blog or someone else's. */
import { useEffect, useState } from "react"

const BLOG = /^[A-Za-z0-9_-]{10,}$/

const split = (hash) => (hash || "#/").replace(/^#/, "").split("/").filter(Boolean).map(decodeURIComponent)

/** The blog id in the address, or "" for this deployment's own blog. */
export function blogId(hash = location.hash) {
  const parts = split(hash)
  return parts[0] === "b" && BLOG.test(parts[1] || "") ? parts[1] : ""
}

const parse = () => {
  const parts = split(location.hash)
  return blogId() ? parts.slice(2) : parts
}

export function useRoute() {
  const [parts, set] = useState(parse)
  useEffect(() => {
    const on = () => { set(parse()); window.scrollTo(0, 0) }
    addEventListener("hashchange", on)
    return () => removeEventListener("hashchange", on)
  }, [])
  return parts
}

/** A link inside the blog being viewed, keeping its id in the address. */
export function href(path) {
  const id = blogId()
  return "#" + (id ? "/b/" + id : "") + (path.startsWith("/") ? path : "/" + path)
}
export function go(path) { location.hash = href(path).slice(1) }
/** A link to another blog entirely. */
export const blogHref = (id, path = "/") => `#/b/${id}${path === "/" ? "" : path}`
