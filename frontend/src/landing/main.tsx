import React from "react"
import ReactDOM from "react-dom/client"
import "../index.css"

function LandingApp() {
  return (
    <div id="landing-placeholder" className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Agentic RAG</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          AI Knowledge &amp; Autonomous Workflows with Human-in-the-Loop Governance.
        </p>
      </div>
    </div>
  )
}

const rootElement = document.getElementById("landing-root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LandingApp />
    </React.StrictMode>,
  )
}
