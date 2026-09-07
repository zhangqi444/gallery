import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import App from "./App"
import { Session, DRIVE_ENABLED } from "./lib/session"
import { GalleryStore } from "./modules/gallery/store"
import { ServiceStore } from "./modules/service/store"
import { LearningStore } from "./modules/learning/store"
import { loadContent, showMine } from "./modules/gallery/content"
import { bootTheme } from "./lib/theme"

bootTheme()

/* Every module's store is created and registered before the session starts, so
   signing in pulls all of them at once. A module added later joins here. */
GalleryStore.init()
ServiceStore.init()
LearningStore.init()
Session.init()

/* While the child is signed in, the reader shows their own pictures, so editing
   a post is its own preview. Signing out puts the published blog back. */
if (DRIVE_ENABLED) {
  let mine = false
  const sync = () => {
    if (Session.signedIn()) { mine = true; showMine(GalleryStore.s) }
    else if (mine) { mine = false; loadContent() }
  }
  Session.subscribe(sync)
  GalleryStore.subscribe(() => { if (Session.signedIn()) showMine(GalleryStore.s) })
}

loadContent()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
  .catch((e) => {
    document.getElementById("root").innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Could not load this page. ' + e.message + "</p>"
  })
