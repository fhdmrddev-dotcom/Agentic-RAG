import React from "react"
import ReactDOM from "react-dom/client"
import { DocsApp } from "./DocsApp"
import "./docs.css"

// Phase 276 — the public docs entry (docs.html). Same shape as src/landing/main.tsx and, like it,
// NO app providers (auth, streams, org): the docs are public and must never pull app code.
const rootElement = document.getElementById("docs-root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <DocsApp />
    </React.StrictMode>,
  )
}
