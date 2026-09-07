/* Google Sign-In and Google Drive, for a blog whose data belongs to its author.
 *
 * Ported from zhangqi444/volunteer's `drive.js`, which is the pattern this
 * project follows, and extended in the one way a blog needs and a private
 * tracker does not: what the app writes has to be **readable by strangers**.
 *
 * The `drive.file` scope only ever grants access to files this app created, so
 * the author's other documents stay invisible to it. A file it creates is
 * private until `publish()` grants `{role: reader, type: anyone}` on it, at
 * which point anyone holding the id can read it — which is the whole point of
 * publishing, and is why nothing is shared until the author asks.
 *
 * Reading a published blog needs no sign-in at all: `readPublic()` fetches the
 * JSON with a browser API key, and pictures are plain <img> URLs on Google's
 * image CDN. A visitor never sees a consent screen. */

const GIS_SRC = "https://accounts.google.com/gsi/client"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const SCOPES = `${DRIVE_SCOPE} openid email profile`
const FILES = "https://www.googleapis.com/drive/v3/files"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo"
const APP_TAG = "gallery-site"
const SESSION_KEY = "gallery.drive"
const SAVE_DEBOUNCE_MS = 1200

let cfg = { clientId: "", apiKey: "", fileName: "gallery-site-data.json", onState: () => {}, onSaved: () => {} }
let tokenClient = null
let token = null      // { access_token, expires_at }
let profile = null    // { name, email, picture }
let file = null       // { id, webViewLink, modifiedTime, shared }
let granted = false
let waiter = null
let pendingData = null, saveTimer = null, saveInFlight = false

export class AuthError extends Error {
  constructor(msg, code) { super(msg); this.name = "AuthError"; this.code = code }
}

function setState(state, detail) { try { cfg.onState(state, detail || "") } catch { /* ignore */ } }
function persistSession() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, profile, granted, file })) } catch { /* ignore */ }
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    if (!s) return
    if (s.token && s.token.access_token && Date.now() < s.token.expires_at) token = s.token
    profile = s.profile || null; granted = !!s.granted; file = s.file || null
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
  profile = { name: j.name || j.email || "Author", email: j.email || "", picture: j.picture || "" }
  persistSession()
  return profile
}

async function findFile() {
  const params = new URLSearchParams({
    q: `appProperties has { key='app' and value='${APP_TAG}' } and trashed=false`,
    fields: "files(id,name,modifiedTime,webViewLink,shared)",
    orderBy: "modifiedTime desc", pageSize: "5", spaces: "drive",
  })
  const j = await (await api(`${FILES}?${params}`)).json()
  const f = (j.files || [])[0]
  file = f ? { id: f.id, webViewLink: f.webViewLink, modifiedTime: f.modifiedTime, shared: !!f.shared } : null
  persistSession()
  return file
}

/** { data, file } or null when this account has no blog file yet. */
export async function load() {
  const f = await findFile()
  if (!f) return null
  const text = await (await api(`${FILES}/${encodeURIComponent(f.id)}?alt=media`)).text()
  let data
  try { data = text.trim() ? JSON.parse(text) : null }
  catch { throw new Error("The blog file in Google Drive is not valid JSON.") }
  return { data, file: f }
}

export async function save(data) {
  const body = JSON.stringify(data, null, 2)
  if (file && file.id) {
    const j = await (await api(`${UPLOAD}/${encodeURIComponent(file.id)}?uploadType=media&fields=id,webViewLink,modifiedTime`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body,
    })).json()
    file = { ...file, id: j.id || file.id, webViewLink: j.webViewLink || file.webViewLink, modifiedTime: j.modifiedTime }
    persistSession()
    return file
  }
  if (await findFile()) return save(data)      // another tab created it meanwhile
  const meta = {
    name: cfg.fileName, mimeType: "application/json", appProperties: { app: APP_TAG },
    description: "Blog data. The site reads and writes this file.",
  }
  const j = await (await multipartUpload(meta, "application/json", body)).json()
  file = { id: j.id, webViewLink: j.webViewLink, modifiedTime: j.modifiedTime, shared: false }
  persistSession()
  return file
}

/** One multipart create: the metadata part, then the bytes. */
function multipartUpload(meta, contentType, body) {
  const boundary = "gs_" + Math.random().toString(36).slice(2)
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  const tail = `\r\n--${boundary}--`
  const payload = typeof body === "string"
    ? head + body + tail
    : new Blob([head, body, tail])
  return api(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink,modifiedTime`, {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: payload,
  })
}

/* ---------- publishing: the part a private tracker never needs ---------- */

/** Grant "anyone with the link can read" on a file this app created. Idempotent:
 *  Drive answers 200 for a permission that already exists. */
export async function makePublic(fileId) {
  await api(`${FILES}/${encodeURIComponent(fileId)}/permissions?fields=id`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  })
  return true
}

/** Publish the blog itself: the data file becomes readable by anyone. */
export async function publish() {
  if (!file || !file.id) throw new Error("There is nothing saved to publish yet.")
  await makePublic(file.id)
  file = { ...file, shared: true }
  persistSession()
  return file
}

/** Upload one picture and share it, returning its Drive file id. */
export async function uploadImage(blob, name) {
  const meta = {
    name: name || `picture-${Date.now()}`,
    appProperties: { app: APP_TAG, kind: "image" },
    description: "A picture on the blog.",
  }
  const j = await (await multipartUpload(meta, blob.type || "image/jpeg", blob)).json()
  await makePublic(j.id)
  return j.id
}

export async function deleteFile(fileId) {
  if (!fileId) return
  try { await api(`${FILES}/${encodeURIComponent(fileId)}`, { method: "DELETE" }) }
  catch (e) { if (e.status !== 404) throw e }
}

/* ---------- reading a published blog, with no sign-in ---------- */

/** The <img> address of a public Drive picture. Google's image CDN serves these
 *  resized and cached, which the Drive API's media endpoint does not. */
export function imageUrl(fileId, width = 1600) {
  if (!fileId) return ""
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w${width}`
}

/** Read a published blog file by id. No token: the browser API key is enough
 *  once the file is shared, and it is restricted to this site by referrer. */
export async function readPublic(fileId, apiKey = cfg.apiKey) {
  if (!fileId) throw new Error("No blog id to read.")
  if (!apiKey) throw new Error("This site has no Google API key configured.")
  const url = `${FILES}/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error("That blog was not found, or is not shared.")
    throw new Error(`Could not read the blog (${res.status}).`)
  }
  return res.json()
}

/* ---------- debounced autosave with an offline queue ---------- */
export function scheduleSave(data) {
  pendingData = data
  setState("saving")
  clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS)
}
export async function flush() {
  clearTimeout(saveTimer)
  if (saveInFlight || !pendingData) return
  const data = pendingData; pendingData = null
  saveInFlight = true
  setState("saving")
  try {
    await save(data)
    if (!pendingData) { setState("saved"); try { cfg.onSaved(data, file) } catch { /* ignore */ } }
  } catch (e) {
    if (!pendingData) pendingData = data
    if (e instanceof AuthError) setState("auth", e.message)
    else setState(navigator.onLine ? "error" : "offline", e.message)
  } finally {
    saveInFlight = false
    if (pendingData && navigator.onLine) saveTimer = setTimeout(flush, 4000)
  }
}
export const hasPending = () => Boolean(pendingData) || saveInFlight

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (pendingData) flush() })
  window.addEventListener("pagehide", () => {
    if (!pendingData || !file || !file.id || !tokenValid()) return
    try {
      fetch(`${UPLOAD}/${encodeURIComponent(file.id)}?uploadType=media`, {
        method: "PATCH", keepalive: true,
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(pendingData),
      })
    } catch { /* ignore */ }
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
export const apiKey = () => cfg.apiKey
/** Profile if the stored token is still good; never opens Google UI. */
export async function restoreSession() {
  if (!tokenValid()) return null
  try { return await fetchProfile() } catch { token = null; return null }
}
export const hasSession = () => Boolean(profile && granted)
/** Interactive sign-in. Must run from a click: browsers block popups without a gesture. */
export async function signIn() { await requestToken(); return fetchProfile() }
export function signOut() {
  const t = token && token.access_token
  token = null; profile = null; file = null; granted = false; pendingData = null
  clearTimeout(saveTimer)
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  if (t && window.google && google.accounts && google.accounts.oauth2) {
    try { google.accounts.oauth2.revoke(t, () => {}) } catch { /* ignore */ }
  }
}
export const getProfile = () => profile
export const getFile = () => file
export const isSignedIn = () => tokenValid() && Boolean(profile)
