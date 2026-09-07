/* The Service module's data. Everything not specific to volunteering — the
 * localStorage copy, the Drive mirror, the debounce, tombstones, signing in and
 * out — comes from lib/module-store.js, exactly as Gallery's does. */
import { createModuleStore, useModuleStore } from "@/lib/module-store"
import { emptyData, mergeData, newEntry, newOrg, newWorkItem, normalize, nowISO, STATUSES } from "./model"

export const ServiceStore = createModuleStore({
  name: "service",
  file: "service.json",
  key: "littleme.service.v1",
  empty: emptyData,
  normalize,
  merge: mergeData,
})

Object.assign(ServiceStore, {
  org(id) { return this.s.organizations.find((o) => o.id === id) || null },
  item(id) { return this.s.workItems.find((w) => w.id === id) || null },
  entry(id) { return this.s.entries.find((e) => e.id === id) || null },

  addOrg(f) {
    const o = newOrg(f, this.s.organizations.length)
    if (!o.name) return null
    this.s.organizations.push(o)
    this.commit()
    return o
  },
  updateOrg(id, f) {
    const o = this.org(id)
    if (!o) return null
    Object.assign(o, f, { name: String(f.name ?? o.name).trim(), at: nowISO() })
    this.commit()
    return o
  },
  /** Deleting an organisation takes its work items with it. Its logged hours
   *  stay: the work was still done, so they lose the link, not the record. */
  deleteOrg(id) {
    for (const w of this.s.workItems.filter((w) => w.orgId === id)) this.bury(w.id)
    this.s.workItems = this.s.workItems.filter((w) => w.orgId !== id)
    this.s.organizations = this.s.organizations.filter((o) => o.id !== id)
    this.bury(id)
    for (const e of this.s.entries) {
      if (e.orgId === id) { e.orgId = ""; e.workItemId = ""; e.at = nowISO() }
    }
    this.commit()
  },

  addWorkItem(f) {
    const w = newWorkItem(f)
    if (!w.title || !this.org(w.orgId)) return null
    this.s.workItems.push(w)
    this.commit()
    return w
  },
  updateWorkItem(id, f) {
    const w = this.item(id)
    if (!w) return null
    Object.assign(w, f, {
      title: String(f.title ?? w.title).trim(),
      status: STATUSES.includes(f.status) ? f.status : w.status,
      at: nowISO(),
    })
    this.commit()
    return w
  },
  deleteWorkItem(id) {
    this.s.workItems = this.s.workItems.filter((w) => w.id !== id)
    this.bury(id)
    for (const e of this.s.entries) if (e.workItemId === id) { e.workItemId = ""; e.at = nowISO() }
    this.commit()
  },

  addEntry(f) {
    const e = newEntry(f)
    if (!(e.hours > 0)) return null
    this.s.entries.push(e)
    this.sortEntries()
    this.commit()
    return e
  },
  updateEntry(id, f) {
    const e = this.entry(id)
    if (!e) return null
    Object.assign(e, f, {
      activity: String(f.activity ?? e.activity).trim() || "Volunteer work",
      hours: Math.max(0, Math.round((Number(f.hours ?? e.hours) || 0) * 100) / 100),
      at: nowISO(),
    })
    this.sortEntries()
    this.commit()
    return e
  },
  deleteEntry(id) {
    this.s.entries = this.s.entries.filter((e) => e.id !== id)
    this.bury(id)
    this.commit()
  },
  sortEntries() { this.s.entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) },
})

export const useService = () => useModuleStore(ServiceStore)
