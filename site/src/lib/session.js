/* The one sign-in, shared by every module.
 *
 * A person signs into The Little Me once. This holds who they are and how the
 * connection to their Drive is doing; each module keeps its own data through
 * lib/module-store.js and never talks to Google itself. Splitting it this way
 * is what lets a module be added without touching authentication again. */
import { useSyncExternalStore } from "react"

import * as Drive from "./google"

const CLIENT_ID = (typeof window !== "undefined" && window.__OAUTH_CLIENT_ID__) || ""
const API_KEY = (typeof window !== "undefined" && window.__GOOGLE_API_KEY__) || ""
export const DRIVE_ENABLED = typeof window !== "undefined" && !!window.__ENABLE_DRIVE__ && !!CLIENT_ID

/** The folder created in the person's own Drive, one file per module inside. */
export const FOLDER = "The Little Me"

const listeners = new Set()
let version = 0
const emit = () => { version++; listeners.forEach((f) => f()) }

/** Modules register here so signing in and out reaches all of them at once. */
const stores = new Set()
export function registerStore(store) { stores.add(store); return () => stores.delete(store) }

export const Session = {
  status: "local",   // local | connecting | syncing | live | expired | error | unavailable
  ready: false,
  email: null, name: null, picture: null,
  lastError: null, lastSync: null,

  init() {
    if (!DRIVE_ENABLED) { this.setStatus("unavailable"); return }
    Drive.init({
      clientId: CLIENT_ID, apiKey: API_KEY, folderName: FOLDER,
      onState: (st, detail) => this.onDriveState(st, detail),
    })
      .then(() => {
        this.ready = true
        emit()
        if (Drive.hasSession()) this.resume()
      })
      .catch((e) => { this.lastError = e.message; this.setStatus("unavailable") })
    const p = Drive.getProfile()
    if (p) { this.email = p.email; this.name = p.name; this.picture = p.picture }
  },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  snapshot() { return version },
  setStatus(v) { if (this.status !== v) { this.status = v; emit() } },
  signedIn() { return Boolean(this.email) },

  onDriveState(st, detail) {
    if (st === "saving") this.setStatus("syncing")
    else if (st === "saved") { this.lastSync = new Date(); this.setStatus("live") }
    else if (st === "auth") { this.lastError = detail; this.setStatus("expired") }
    else if (st === "error" || st === "offline") { this.lastError = detail; this.setStatus("error") }
  },

  /** Must run from a click: browsers block the Google popup without a gesture. */
  signIn() {
    if (!DRIVE_ENABLED || !Drive.available()) { this.setStatus("unavailable"); return Promise.resolve() }
    this.setStatus("connecting")
    return Drive.signIn().then((p) => this.afterAuth(p)).catch((e) => {
      this.lastError = e.message
      this.setStatus(
        e.code === "popup_closed" && Drive.hasSession() ? "expired"
          : e.code === "access_denied" ? "error"
            : Drive.hasSession() ? "expired" : "local")
    })
  },

  /** Boot: reconnect silently while the stored token is still inside its hour. */
  resume() {
    return Drive.restoreSession().then((p) => {
      if (p) return this.afterAuth(p)
      this.setStatus("expired")
    })
  },

  afterAuth(p) {
    this.email = p.email; this.name = p.name; this.picture = p.picture
    this.setStatus("syncing")
    // Every module pulls its own file; one failure must not hide the others.
    return Promise.all([...stores].map((s) => s.adopt(p.email)))
      .then(() => { this.lastSync = new Date(); this.setStatus("live") })
      .catch((e) => {
        this.lastError = e.message
        this.setStatus(e instanceof Drive.AuthError ? "expired" : "error")
      })
  },

  signOut() {
    Drive.signOut()
    this.email = this.name = this.picture = null
    // The device is cleared; the files in Drive keep everything.
    for (const s of stores) s.clearDevice()
    this.setStatus("local")
    emit()
  },
}

export function useSession() {
  useSyncExternalStore((fn) => Session.subscribe(fn), () => Session.snapshot(), () => Session.snapshot())
  return Session
}
