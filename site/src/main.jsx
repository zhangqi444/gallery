import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import App from "./App"
import { loadContent, showMine } from "./lib/content"
import { Store, DRIVE_ENABLED } from "./lib/store"
import { bootTheme } from "./lib/theme"

bootTheme()
Store.init()

/* While the author is signed in, the pages show their own data, so editing a
   post is its own preview. Signing out puts the published blog back. */
if (DRIVE_ENABLED) {
  let mine = false
  Store.subscribe(() => {
    const signedIn = Boolean(Store.email)
    if (signedIn) { mine = true; showMine(Store.s) }
    else if (mine) { mine = false; loadContent() }
  })
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
      '<p style="padding:2rem;font-family:system-ui">Could not load this blog. ' + e.message + "</p>"
  })
