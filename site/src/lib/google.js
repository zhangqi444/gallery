/* Google sign-in, and one folder in the person's own Drive with a file per module.
 *
 * Ported from zhangqi444/volunteer's `drive.js`, which is the pattern this
 * family of projects follows, and extended in two ways this app needs:
 *
 *  - **A folder per module.** Learning, Service and Gallery each get a subfolder
 *    of `The Little Me`, holding that module's document and whatever else it
 *    keeps — Gallery's pictures today. Nothing has to be merged when a module is
 *    added, one bad write can only cost one module, and a person opening their
 *    own Drive can see which module a file belongs to.
 *  - **Publishing.** The `drive.file` scope means only the creator can read what
 *    this app writes, which is right for practice and hours and wrong for a
 *    blog. `publish()` grants `{role: reader, type: anyone}` on one file, and
 *    `readPublic()` reads such a file with a browser API key and no sign-in, so
 *    a stranger looking at a child's drawings never sees a consent screen.
 *    `unpublish()` takes that permission away again, because a child who can
 *    put something on the internet must be able to take it off.
 *
 * `drive.file` also means this app can never see a file it did not create,
 * including the files written by the older isee and volunteer apps: those use
 * different OAuth clients, so their data has to be carried across by an export
 * the person downloads and imports. That is a property of the scope, not a gap.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const SCOPES = `${DRIVE_SCOPE} openid email profile`
const FILES = "https://www.googleapis.com/drive/v3/files"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo"
const FOLDER_MIME = "application/vnd.google-apps.folder"
const APP_TAG = "little-me"
const SESSION_KEY = "littleme.drive"
const SAVE_DEBOUNCE_MS = 1200

let cfg = { clientId: "", apiKey: "", folderName: "The Little Me", onState: () => {} }
let tokenClient = null
let token = null          // { access_token, expires_at }
let profile = null        // { name, email, picture }
let folders = {}          // "" -> the app folder; module name -> its subfolder
let files = {}            // module -> { id, webViewLink, modifiedTime, shared }
let granted = false
let waiter = null
const folderPromises = new Map()
const pending = new Map() // module -> { file, data }
const timers = new Map()  // module -> timeout id
const inFlight = new Set()

export class AuthError extends Error {
  constructor(msg, code) { super(msg); this.name = "AuthError"; this.code = code }
}

function setState(state, detail) { try { cfg.onState(state, detail || "") } catch { /* ignore */ } }
function persistSession() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, profile, granted, folders, files })) } catch { /* ignore */ }
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    if (!s) return
    if (s.token && s.token.access_token && Date.now() < s.token.expires_at) token = s.token
    profile = s.profile || null
    granted = !!s.granted
    folders = s.folders || {}
    files = s.files || {}
  } catch { /* ignore */ }
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve()
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    const fail = () => reject(new Error("Could not load Google Sign-In. Check your connection."))
    if (existing) {
      const t = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) { clearInterval(t); resolve() }
      }, 50)
      setTimeout(() => { clearInterval(t); if (!(window.google && window.google.accounts)) fail() }, 8000)
      existing.addEventListener("error", fail)
      return
    }
    const s = document.createElement("script")
    s.src = GIS_SRC; s.async = true; s.defer = true
    s.onload = () => resolve(); s.onerror = fail
    document.head.appendChild(s)
  })
}

function friendly(code) {
  switch (code) {
    case "popup_closed": return "The Google sign-in window was closed before finishing."
    case "popup_failed_to_open": return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."
    case "access_denied": return "Google Drive access was not granted, so nothing can be saved there."
    case "invalid_client": return "The Google client ID is invalid."
    default: return code ? `Google sign-in failed (${code}).` : "Google sign-in failed."
  }
}
function onTokenResponse(resp) {
  const w = waiter; waiter = null
  if (!w) return
  if (!resp || resp.error) return w.reject(new AuthError(friendly(resp && resp.error), resp && resp.error))
  const oauth2 = google.accounts.oauth2
  if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
    return w.reject(new AuthError(friendly("access_denied"), "access_denied"))
  }
  token = { access_token: resp.access_token, expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60_000 }
  granted = true
  persistSession()
  w.resolve(token)
}
function onTokenError(err) {
  const w = waiter; waiter = null
  if (w) w.reject(new AuthError(friendly(err && err.type), err && err.type))
}
function requestToken(opts = {}) {
  if (!tokenClient) return Promise.reject(new AuthError("Google Sign-In is not ready.", "not_ready"))
  if (waiter) return Promise.reject(new AuthError("A sign-in is already in progress.", "busy"))
  return new Promise((resolve, reject) => {
    waiter = { resolve, reject }
    const req = { prompt: opts.prompt !== undefined ? opts.prompt : (granted ? "" : "consent") }
    if (profile && profile.email) req.hint = profile.email
    tokenClient.requestAccessToken(req)
  })
}
const tokenValid = () => Boolean(token && token.access_token && Date.now() < token.expires_at)

async function ensureToken() {
  if (tokenValid()) return token
  token = null
  return requestToken({ prompt: "" })     // silent while Google's own session lives
}

async function api(url, opts = {}, retry = true) {
  const t = await ensureToken()
  let res
  try {
    res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${t.access_token}` } })
  } catch {
    throw new Error(navigator.onLine ? "Network error talking to Google Drive." : "You're offline.")
  }
  if (res.status === 401 && retry) { token = null; return api(url, opts, false) }
  if (!res.ok) {
    let msg = `Google Drive error ${res.status}`
    try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message } catch { /* ignore */ }
    const err = new Error(msg); err.status = res.status; throw err
  }
  return res
}

async function fetchProfile() {
  const j = await (await api(USERINFO)).json()
  profile = { name: j.name || j.email || "", email: j.email || "", picture: j.picture || "" }
  persistSession()
  return profile
}

/* ---------- the folder, and the file inside it for one module ---------- */

/** Find or create a folder: the app's own when `module` is empty, otherwise
 *  that module's subfolder inside it. A module gets a folder of its own because
 *  it will hold more than one file — Gallery's pictures, and whatever Learning
 *  and Service come to keep — and because the person opening their own Drive
 *  should be able to see which module a file belongs to.
 *
 *  Concurrent callers share one request, so three modules signing in at the
 *  same moment cannot create three folders. */
function ensureFolder(module = "") {
  if (folders[module]) return Promise.resolve(folders[module])
  if (folderPromises.has(module)) return folderPromises.get(module)
  const work = (async () => {
    const parent = module ? await ensureFolder("") : null
    const kind = module ? "module" : "root"
    const q = [
      `appProperties has { key='app' and value='${APP_TAG}' }`,
      `appProperties has { key='kind' and value='${kind}' }`,
      module ? `appProperties has { key='module' and value='${module}' }` : "",
      `mimeType='${FOLDER_MIME}'`,
      "trashed=false",
    ].filter(Boolean).join(" and ")
    const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "5", spaces: "drive" })
    const found = (await (await api(`${FILES}?${params}`)).json()).files || []
    if (found[0]) folders[module] = found[0].id
    else {
      const meta = {
        name: module ? module.charAt(0).toUpperCase() + module.slice(1) : cfg.folderName,
        mimeType: FOLDER_MIME,
        appProperties: module ? { app: APP_TAG, kind, module } : { app: APP_TAG, kind },
        ...(parent ? { parents: [parent] } : {}),
      }
      const j = await (await api(`${FILES}?fields=id`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta),
      })).json()
      folders[module] = j.id
    }
    persistSession()
    return folders[module]
  })().finally(() => { folderPromises.delete(module) })
  folderPromises.set(module, work)
  return work
}

async function findFile(module) {
  const params = new URLSearchParams({
    q: `appProperties has { key='app' and value='${APP_TAG}' } and appProperties has { key='module' and value='${module}' } and trashed=false`,
    fields: "files(id,name,modifiedTime,webViewLink,shared)",
    orderBy: "modifiedTime desc", pageSize: "5", spaces: "drive",
  })
  const j = await (await api(`${FILES}?${params}`)).json()
  const f = (j.files || [])[0]
  files[module] = f ? { id: f.id, webViewLink: f.webViewLink, modifiedTime: f.modifiedTime, shared: !!f.shared } : null
  persistSession()
  return files[module]
}

/** `{ data, file }`, or null when this account has no file for the module yet. */
export async function load(fileName, module) {
  const f = await findFile(module)
  if (!f) return null
  const text = await (await api(`${FILES}/${encodeURIComponent(f.id)}?alt=media`)).text()
  let data
  try { data = text.trim() ? JSON.parse(text) : null }
  catch { throw new Error(`The ${module} file in Google Drive is not valid JSON.`) }
  return { data, file: f }
}

export async function save(fileName, module, data) {
  const body = JSON.stringify(data, null, 2)
  const known = files[module]
  if (known && known.id) {
    const j = await (await api(`${UPLOAD}/${encodeURIComponent(known.id)}?uploadType=media&fields=id,webViewLink,modifiedTime`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body,
    })).json()
    files[module] = { ...known, id: j.id || known.id, webViewLink: j.webViewLink || known.webViewLink, modifiedTime: j.modifiedTime }
    persistSession()
    return files[module]
  }
  if (await findFile(module)) return save(fileName, module, data)   // another tab made it
  const parent = await ensureFolder(module)
  const meta = {
    name: fileName, mimeType: "application/json", parents: [parent],
    appProperties: { app: APP_TAG, module },
    description: `The Little Me — ${module}. The app reads and writes this file.`,
  }
  const j = await (await multipartUpload(meta, "application/json", body)).json()
  files[module] = { id: j.id, webViewLink: j.webViewLink, modifiedTime: j.modifiedTime, shared: false }
  persistSession()
  return files[module]
}

/** One multipart create: the metadata part, then the bytes. */
function multipartUpload(meta, contentType, body) {
  const boundary = "lm_" + Math.random().toString(36).slice(2)
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  const tail = `\r\n--${boundary}--`
  const payload = typeof body === "string" ? head + body + tail : new Blob([head, body, tail])
  return api(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink,modifiedTime`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: payload,
  })
}

/* ---------- publishing: what a private tracker never needs ---------- */

/** Grant "anyone with the link can read". Drive answers 200 for a permission
 *  that already exists, so this is safe to repeat. */
export async function makePublic(fileId) {
  await api(`${FILES}/${encodeURIComponent(fileId)}/permissions?fields=id`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  })
  return true
}

/** Take "anyone with the link" away again. The permission is found rather than
 *  assumed: Drive names it `anyone`, but deleting a permission that is not there
 *  is a 404, and a file nobody shared is already in the state being asked for. */
export async function makePrivate(fileId) {
  const res = await api(`${FILES}/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type)`)
  const list = (await res.json()).permissions || []
  for (const p of list) {
    if (p.type !== "anyone") continue
    try { await api(`${FILES}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(p.id)}`, { method: "DELETE" }) }
    catch (e) { if (e.status !== 404) throw e }
  }
  return true
}

/** Share one module's file, so anyone holding its id can read that module. */
export async function publish(module) {
  const f = files[module]
  if (!f || !f.id) throw new Error("There is nothing saved to publish yet.")
  await makePublic(f.id)
  files[module] = { ...f, shared: true }
  persistSession()
  return files[module]
}

/** Stop sharing one module's file. Anything else the module shared — Gallery's
 *  pictures — is the module's own to withdraw, since only it knows what it has. */
export async function unpublish(module) {
  const f = files[module]
  if (!f || !f.id) throw new Error("There is nothing published.")
  await makePrivate(f.id)
  files[module] = { ...f, shared: false }
  persistSession()
  return files[module]
}

/** Upload one picture into the folder; returns its Drive file id.
 *
 *  It is shared only if the module it belongs to is already published. A
 *  picture uploaded to a private blog stays private until the child presses
 *  Publish, which is what "nothing is public until she publishes" has to mean
 *  to be worth saying — a Drive file id in a URL is a link like any other. */
export async function uploadImage(blob, name, module = "gallery") {
  const parent = await ensureFolder(module)
  const meta = {
    name: name || `picture-${Date.now()}`, parents: [parent],
    appProperties: { app: APP_TAG, kind: "image", module },
    description: "A picture on the blog.",
  }
  const j = await (await multipartUpload(meta, blob.type || "image/jpeg", blob)).json()
  if (files[module] && files[module].shared) await makePublic(j.id)
  return j.id
}

export async function deleteFile(fileId) {
  if (!fileId) return
  try { await api(`${FILES}/${encodeURIComponent(fileId)}`, { method: "DELETE" }) }
  catch (e) { if (e.status !== 404) throw e }
}

/* ---------- reading something published, with no sign-in ---------- */

/** The <img> address of a public Drive picture. Google's image CDN serves these
 *  resized and cached, which the Drive API's media endpoint does not. */
export function imageUrl(fileId, width = 1600) {
  if (!fileId) return ""
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${width}`
}

/** Read a published file by id: no token, only the browser API key, which is
 *  restricted to this site by referrer and can read nothing that is not shared. */
export async function readPublic(fileId, apiKey = cfg.apiKey) {
  if (!fileId) throw new Error("No id to read.")
  if (!apiKey) throw new Error("This site has no Google API key configured.")
  const res = await fetch(`${FILES}/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error("That was not found, or is not shared.")
    throw new Error(`Could not read it (${res.status}).`)
  }
  return res.json()
}

/* ---------- debounced autosave, per module, with an offline queue ---------- */

export function scheduleSave(fileName, module, data) {
  pending.set(module, { file: fileName, data })
  setState("saving")
  clearTimeout(timers.get(module))
  timers.set(module, setTimeout(() => flush(fileName, module), SAVE_DEBOUNCE_MS))
}

export async function flush(fileName, module) {
  clearTimeout(timers.get(module))
  const job = pending.get(module)
  if (inFlight.has(module) || !job) return
  pending.delete(module)
  inFlight.add(module)
  setState("saving")
  try {
    await save(job.file, module, job.data)
    if (!pending.has(module)) setState("saved")
  } catch (e) {
    if (!pending.has(module)) pending.set(module, job)
    if (e instanceof AuthError) setState("auth", e.message)
    else setState(navigator.onLine ? "error" : "offline", e.message)
  } finally {
    inFlight.delete(module)
    if (pending.has(module) && navigator.onLine) {
      timers.set(module, setTimeout(() => flush(job.file, module), 4000))
    }
  }
}
export const hasPending = () => pending.size > 0 || inFlight.size > 0

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    for (const [module, job] of pending) flush(job.file, module)
  })
  // The last edit before the tab closes, sent without waiting for a response.
  window.addEventListener("pagehide", () => {
    if (!tokenValid()) return
    for (const [module, job] of pending) {
      const f = files[module]
      if (!f || !f.id) continue
      try {
        fetch(`${UPLOAD}/${encodeURIComponent(f.id)}?uploadType=media`, {
          method: "PATCH", keepalive: true,
          headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(job.data),
        })
      } catch { /* ignore */ }
    }
  })
}

/* ---------- public API ---------- */
export async function init(options) {
  cfg = { ...cfg, ...options }
  if (!cfg.clientId) throw new Error("Missing Google client ID.")
  loadSession()
  await loadGis()
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cfg.clientId, scope: SCOPES, callback: onTokenResponse, error_callback: onTokenError,
  })
}
export const available = () => Boolean(tokenClient)
/** The profile if the stored token is still good; never opens Google's UI. */
export async function restoreSession() {
  if (!tokenValid()) return null
  try { return await fetchProfile() } catch { token = null; return null }
}
export const hasSession = () => Boolean(profile && granted)
/** Interactive sign-in. Must run from a click: browsers block popups otherwise. */
export async function signIn() { await requestToken(); return fetchProfile() }
export function signOut() {
  const t = token && token.access_token
  token = null; profile = null; folders = {}; files = {}; granted = false
  pending.clear()
  folderPromises.clear()
  for (const id of timers.values()) clearTimeout(id)
  timers.clear()
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  if (t && window.google && google.accounts && google.accounts.oauth2) {
    try { google.accounts.oauth2.revoke(t, () => {}) } catch { /* ignore */ }
  }
}
export const getProfile = () => profile
export const getFile = (module) => files[module] || null
export const isSignedIn = () => tokenValid() && Boolean(profile)
