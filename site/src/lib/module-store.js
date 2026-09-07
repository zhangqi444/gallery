/* One module's data: localStorage first and synchronously, one file in the
 * person's own Drive as the mirror, pushed on a debounce.
 *
 * This is volunteer's store contract, made reusable so Learning, Service and
 * Gallery each get their own file rather than sharing one document. Keeping
 * them separate is deliberate: a module can be added or rewritten without
 * migrating anyone's other data, and a bad write can only cost one of them.
 *
 * A module supplies what makes it different — its file name, its empty shape,
 * how foreign JSON is normalised, and how two copies merge — and gets the
 * session, the debounce, the tombstones and the offline queue for free. */
import { useSyncExternalStore } from "react"

import * as Drive from "./google"
import { DRIVE_ENABLED, registerStore, Session } from "./session"

const TOMBSTONE_DAYS = 120
const nowISO = () => new Date().toISOString()

/**
 * @param {object} spec
 * @param {string} spec.name       module id, e.g. "gallery"
 * @param {string} spec.file       file name in the folder, e.g. "gallery.json"
 * @param {string} spec.key        localStorage key, e.g. "littleme.gallery.v1"
 * @param {() => object} spec.empty
 * @param {(raw:any) => object} spec.normalize   throws when the JSON is foreign
 * @param {(local:object, remote:any) => object} spec.merge
 */
export function createModuleStore(spec) {
  const listeners = new Set()
  let version = 0
  const emit = () => { version++; listeners.forEach((f) => f()) }

  const lsLoad = () => {
    try {
      const raw = localStorage.getItem(spec.key)
      if (raw) return spec.normalize(JSON.parse(raw))
    } catch { /* fall through to empty */ }
    return spec.empty()
  }
  const lsSave = (s) => { try { localStorage.setItem(spec.key, JSON.stringify(s)) } catch { /* quota, private mode */ } }

  const store = {
    name: spec.name,
    s: null,
    owner: null,
    busy: "",

    init() {
      this.s = lsLoad()
      this.owner = this.s.owner || null
      this.pruneTombstones()
      registerStore(this)
      return this.s
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    snapshot() { return version },
    setBusy(v) { if (this.busy !== v) { this.busy = v; emit() } },

    /* ---- writes: local first, then notify, then mirror ---- */
    commit() {
      this.s.updatedAt = nowISO()
      lsSave(this.s)
      emit()
      this.schedulePush()
    },
    bury(id) { this.s.deleted[id] = nowISO() },
    pruneTombstones() {
      const cutoff = Date.now() - TOMBSTONE_DAYS * 86400e3
      for (const k of Object.keys(this.s.deleted || {})) {
        if (Date.parse(this.s.deleted[k] || "") < cutoff) delete this.s.deleted[k]
      }
    },

    /* ---- the session drives these two ---- */
    /** A person just signed in: guard against a second account, then pull. */
    adopt(email) {
      if (this.owner && this.owner !== email) {
        // Another Google account on this device. Its copy must not be pushed
        // into this account's file, so the device starts empty for them.
        this.s = spec.empty()
        lsSave(this.s)
        emit()
      }
      this.owner = email
      this.s.owner = email
      lsSave(this.s)
      return this.pull()
    },
    clearDevice() {
      this.s = spec.empty()
      this.owner = null
      lsSave(this.s)
      emit()
    },

    payload() {
      const { owner, ...rest } = this.s
      return { ...rest, module: spec.name, savedAt: nowISO() }
    },
    pull() {
      return Drive.load(spec.file, spec.name).then((r) => {
        if (r && r.data) {
          this.s = { ...spec.merge(this.s, r.data), owner: this.owner }
          lsSave(this.s)
          emit()
        }
        // Seed the file, or write the merged result back.
        return Drive.save(spec.file, spec.name, this.payload())
      })
    },
    schedulePush() {
      if (!DRIVE_ENABLED || !Drive.isSignedIn()) return
      Drive.scheduleSave(spec.file, spec.name, this.payload())
    },
    flush() { return Drive.flush(spec.file, spec.name) },

    /** Replace everything, burying whatever the new data does not contain, so
     *  Drive cannot resurrect it. Used by import and by "start again". */
    replaceAll(data, idsOf) {
      const keep = new Set(idsOf(data))
      const deleted = { ...this.s.deleted }
      for (const id of idsOf(this.s)) if (!keep.has(id)) deleted[id] = nowISO()
      this.s = { ...spec.normalize(data), deleted, owner: this.owner }
      this.commit()
      return this.s
    },

    /* ---- what the module's own screens use ---- */
    signedIn() { return Session.signedIn() },
    status() { return Session.status },
  }

  return store
}

/** Re-render a component when this module's data changes. */
export function useModuleStore(store) {
  useSyncExternalStore((fn) => store.subscribe(fn), () => store.snapshot(), () => store.snapshot())
  return store
}
