export function Navigation() {
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || "/app"
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string | undefined) || "#start"

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid hsl(220 20% 16% / 0.6)",
        background: "hsl(216 45% 4% / 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <a
          href="#"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 16,
            fontWeight: 700,
            color: "hsl(226 60% 97%)",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 18, height: 18 }}
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="hl">Agentic RAG</span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a
            className="hide-m"
            href="#features"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Features
          </a>
          <a
            className="hide-m"
            href="#tour"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Tour
          </a>
          <a
            className="hide-m"
            href="#workflows"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Workflows
          </a>
          <a
            className="hide-m"
            href="#compare"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Compare
          </a>
          <a
            className="hide-m"
            href="#security"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Security
          </a>
          <a
            className="hide-m"
            href={appUrl}
            title="Existing customers sign in to their workspace"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
            Sign in
          </a>
          <a
            className="btn btn-primary"
            href={demoUrl}
            style={{ height: 36, padding: "0 14px" }}
          >
            Book a demo
          </a>
        </nav>
      </div>
    </header>
  )
}
