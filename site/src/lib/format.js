const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Sep 6, 2026" from an ISO date; the string is left alone if it is not one. */
export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "")
  if (!m) return iso || ""
  return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`
}
export const readTime = (minutes) => `${minutes} min read`

/** Ghost stores "(Untitled)" for a post that was never named. Nineteen cards
 *  reading the same word tell a reader nothing, so those show their date. */
const UNTITLED = /^\(?\s*untitled\s*\)?$/i
export const isUntitled = (post) => UNTITLED.test((post.title || "").trim())
export const titleOf = (post) => (isUntitled(post) ? fmtDate(post.date) : post.title)
export const initials = (name) => (name || "").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
