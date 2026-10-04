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
        {/* Phase 276 (D-14/D-15): the static Iris lockup as an <img> — never inline SVG, the
            brand files share gradient ids "g"/"h" and two inline copies would collide. */}
        <a
          href="/"
          aria-label="Syrel home"
          style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
        >
          <img src="/brand/syrel-lockup-iris.svg" height={28} alt="" aria-hidden="true" />
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
