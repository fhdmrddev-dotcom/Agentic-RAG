export function CtaSection() {
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || "/app"
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string | undefined) || "#start"

  return (
    <section id="start" style={{ padding: "0 0 96px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div
          style={{
            borderRadius: 14,
            border: "1px solid hsl(220 20% 16%)",
            background: "linear-gradient(135deg, hsl(220 30% 7%), hsl(239 84% 67% / 0.12))",
            padding: "64px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            className="glow"
            style={{
              width: 420,
              height: 420,
              bottom: -260,
              right: -120,
              background: "radial-gradient(circle closest-side, hsl(258 90% 66% / 0.18), transparent)",
            }}
          />
          <h2
            className="hl h2"
            style={{
              margin: 0,
              fontSize: 40,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              position: "relative",
            }}
          >
            See it run on your own documents.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: "hsl(220 16% 65%)",
              maxWidth: 520,
              position: "relative",
            }}
          >
            A 30-minute walkthrough on a sample of your files — your formats, your folders, your
            approval rules. Existing customers sign in to their workspace.
          </p>
          <div
            className="cta-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingTop: 4,
              position: "relative",
            }}
          >
            <a className="btn btn-primary btn-lg" href={demoUrl}>
              Book a demo
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              className="btn btn-outline btn-lg"
              href={appUrl}
              style={{ background: "transparent" }}
            >
              Sign in to your workspace
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
