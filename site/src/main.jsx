import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import App from "./App"
import { loadContent } from "./lib/content"
import { bootTheme } from "./lib/theme"

bootTheme()

loadContent().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}).catch((e) => {
  document.getElementById("root").innerHTML = '<p style="padding:2rem;font-family:system-ui">Could not load the site’s content. ' + e.message + "</p>"
})
