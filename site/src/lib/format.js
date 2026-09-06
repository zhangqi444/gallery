const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Sep 6, 2026" from an ISO date; the string is left alone if it is not one. */
export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "")
  if (!m) return iso || ""
  return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`
}
export const readTime = (minutes) => `${minutes} min read`
export const initials = (name) => (name || "").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
