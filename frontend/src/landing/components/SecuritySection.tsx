export function SecuritySection() {
  return (
    <section id="security" style={{ padding: "0 0 112px", position: "relative", zIndex: 1 }}>
      <div className="wrap">
        <div style={{ maxWidth: 640, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow">Security</div>
          <h2
            className="hl h2"
            style={{
              margin: 0,
              fontSize: 40,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Built for organisations, enforced in the database.
          </h2>
        </div>

        <div className="grid4">
          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Row-level security everywhere</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Users see only their own org’s data. Enforced by Postgres policies on every table, not by
              application code.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Isolated code execution</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Every chat gets its own container. No network egress from the sandbox; sessions are evicted
              when idle.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Approval before action</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Connectors are granted per workflow, per action. Outbound writes pause for a person;
              nothing is sent silently.
            </p>
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Audit ledger</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "hsl(220 16% 65%)" }}>
              Every write and every operator action is recorded and exportable. Kill switches for runs
              and features when you need them.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
