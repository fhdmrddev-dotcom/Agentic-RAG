import "./scenes.css"

export function SettingsScene() {
  return (
    <div className="scene sc-st" aria-label="Interactive settings storyboard demonstrating live provider dial, reranker toggles, and live re-embedding progress">
      <div className="sfloor" aria-hidden="true" />

      {/* Model dial */}
      <div
        className="el t-dial"
        style={{
          left: 60,
          top: 60,
          width: 200,
          height: 200,
          borderRadius: 9999,
          border: "1px solid hsl(220 20% 16%)",
          background: "radial-gradient(circle, hsl(220 30% 9%), hsl(216 45% 4%))",
        }}
      >
        <div className="t-needle" />
        <span className="tl t-l1" style={{ left: "50%", top: -10, transform: "translateX(-50%)" }}>
          Anthropic
        </span>
        <span className="tl t-l2" style={{ right: -34, top: "50%", transform: "translateY(-50%)" }}>
          OpenAI
        </span>
        <span className="tl t-l3" style={{ left: "50%", bottom: -10, transform: "translateX(-50%)" }}>
          Local · LM Studio
        </span>
        <span className="tl t-l4" style={{ left: -28, top: "50%", transform: "translateY(-50%)" }}>
          Google
        </span>
        <div
          className="font-mono"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 64,
            height: 64,
            margin: "-32px 0 0 -32px",
            borderRadius: 9999,
            background: "hsl(220 30% 7%)",
            border: "1px solid hsl(220 20% 16%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 9,
            lineHeight: 1.3,
            letterSpacing: ".08em",
            color: "hsl(220 16% 65%)",
          }}
        >
          DEFAULT
          <br />
          MODEL
        </div>
      </div>

      {/* Reranker & Tool Calling Card */}
      <div
        className="el mini t-card"
        style={{
          right: 28,
          top: 28,
          width: 280,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Reranker</span>
          <span className="t-tog">
            <i />
          </span>
        </div>
        <div className="font-mono t-toglabel" style={{ fontSize: 11, color: "hsl(220 16% 65%)" }}>
          <span className="t-la">API (Cohere)</span>
          <span className="t-lb">Local (sentence-transformers)</span>
        </div>
        <div style={{ height: 1, background: "hsl(220 20% 16%)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Tool calling</span>
          <span className="font-mono text-[11px]" style={{ color: "hsl(239 100% 82%)" }}>
            Quality
          </span>
        </div>
      </div>

      {/* Re-embedding progress card */}
      <div
        className="el mini t-prog"
        style={{
          right: 28,
          top: 190,
          width: 280,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Re-embedding library</span>
          <span className="font-mono t-pct text-[11px] text-muted-foreground">1,284 chunks</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "hsl(220 25% 14%)",
            overflow: "hidden",
          }}
        >
          <div
            className="t-bar"
            style={{
              height: "100%",
              background: "linear-gradient(90deg, hsl(239 84% 67%), hsl(258 90% 66%))",
            }}
          />
        </div>
        <div className="font-mono t-done text-[11px]" style={{ color: "hsl(142 71% 55%)" }}>
          ✓ Done · new model live for every search
        </div>
      </div>

      <div className="el scap">
        Switch the default model → flip retrieval to local → re-embed with a progress card — no redeploy, no config file
      </div>
    </div>
  )
}
