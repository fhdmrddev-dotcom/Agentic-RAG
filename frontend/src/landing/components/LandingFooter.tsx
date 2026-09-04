export function LandingFooter() {
  const currentYear = new Date().getFullYear()
  const appUrl = (import.meta as any).env?.VITE_APP_URL || "/app"

  return (
    <footer
      style={{
        borderTop: "1px solid hsl(220 20% 16% / 0.6)",
        position: "relative",
        zIndex: 1,
        padding: "24px 0",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          color: "hsl(220 16% 65%)",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <span>© {currentYear} Agentic RAG</span>
        <div style={{ display: "flex", gap: 20 }}>
          <a
            href="https://github.com/fhdmrddev-dotcom/Agentic-RAG"
            target="_blank"
            rel="noreferrer"
            style={{ color: "hsl(220 16% 65%)" }}
          >
            GitHub
          </a>
          <a href="#features" style={{ color: "hsl(220 16% 65%)" }}>
            Features
          </a>
          <a href="#security" style={{ color: "hsl(220 16% 65%)" }}>
            Security
          </a>
          <a href={appUrl} style={{ color: "hsl(220 16% 65%)" }}>
            Sign in
          </a>
        </div>
      </div>
    </footer>
  )
}
