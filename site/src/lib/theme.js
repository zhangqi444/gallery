/* Theme: saved choice > host's data-theme > OS. The .dark class on <html> is the
   only switch; every token has its own dark value in index.css. */
const KEY = "gallery.theme"
const listeners = new Set()

export function savedTheme() {
  try { return localStorage.getItem(KEY) || "" } catch { return "" }
}
export function isDark() {
  const pref = savedTheme()
  const host = document.documentElement.getAttribute("data-theme")
  const sys = matchMedia("(prefers-color-scheme: dark)").matches
  return pref ? pref === "dark" : host ? host === "dark" : sys
}
export function applyTheme() {
  const dark = isDark()
  document.documentElement.classList.toggle("dark", dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", dark ? "#0F1318" : "#2B63C9")
  listeners.forEach((fn) => fn(dark))
}
export function setTheme(theme) {
  try { theme ? localStorage.setItem(KEY, theme) : localStorage.removeItem(KEY) } catch {}
  applyTheme()
}
export function toggleTheme() { setTheme(isDark() ? "light" : "dark") }
export function onTheme(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function bootTheme() {
  applyTheme()
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
}
