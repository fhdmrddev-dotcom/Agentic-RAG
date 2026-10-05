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
          fontSize: 14,
          color: "hsl(220 16% 65%)",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <img src="/brand/syrel-mark-iris.svg" width={20} height={20} alt="" />
          © {currentYear} Syrel
        </span>
        {/* Phase 276 (UI-SPEC P0 footer): shared by the landing and the docs, so every link is
            absolute — a "#security" anchor would point nowhere from a /docs page. */}
        <nav aria-label="Footer" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <a href="/docs" style={{ color: "hsl(220 16% 65%)" }}>
            Docs
          </a>
          <a href="/docs/changelog" style={{ color: "hsl(220 16% 65%)" }}>
            Changelog
          </a>
          <a href="/#security" style={{ color: "hsl(220 16% 65%)" }}>
            Security
          </a>
          <a
            href="https://github.com/fhdmrddev-dotcom/Agentic-RAG"
            target="_blank"
            rel="noreferrer"
            style={{ color: "hsl(220 16% 65%)" }}
          >
            GitHub
          </a>
          <a href={appUrl} style={{ color: "hsl(220 16% 65%)" }}>
            Sign in
          </a>
        </nav>
      </div>
    </footer>
  )
}
