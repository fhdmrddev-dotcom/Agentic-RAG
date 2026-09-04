import React from "react"
import ReactDOM from "react-dom/client"
import { LandingPage } from "./LandingPage"

const rootElement = document.getElementById("landing-root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>,
  )
}
