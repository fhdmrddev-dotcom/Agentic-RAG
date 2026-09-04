import { GAUNTLET_STAGES } from "../facts"
import "./scenes.css"

export function WorkflowsScene() {
  return (
    <div className="scene sc-wf" aria-label="Interactive workflows storyboard showing describe prompt, node chaining, 10-stage gauntlet, and scheduled run">
      <div className="sfloor" aria-hidden="true" />

      {/* Typing natural language prompt */}
      <div
        className="el font-mono w-type"
        style={{
          left: 28,
          top: 26,
          fontSize: 13,
          color: "hsl(226 60% 97%)",
        }}
      >
        Every Monday, summarise last week’s notes into the report template and draft the email.
      </div>

      {/* Step Spine */}
      <div
        className="el w-spine"
        style={{
          left: 28,
          right: 28,
          top: 96,
          display: "flex",
          alignItems: "center",
          gap: 0,
        }}
      >
        <div className="wn w-n1"><span className="wg">⌕</span>Read notes</div>
        <div className="wc w-c1" />
        <div className="wn w-n2"><span className="wg">≡</span>Summarise</div>
        <div className="wc w-c2" />
        <div className="wn w-n3"><span className="wg">▤</span>Fill template</div>
        <div className="wc w-c3" />
        <div className="wn w-n4"><span className="wg">✉</span>Draft email</div>
        <div className="wc w-c4" />
        <div className="wn w-n5" style={{ borderColor: "hsl(38 92% 60% / .6)" }}>
          <span className="wg" style={{ color: "hsl(38 92% 62%)" }}>✋</span>Review
        </div>
      </div>

      {/* Gauntlet Header reading count from facts */}
      <div
        className="el font-mono"
        style={{
          left: 28,
          top: 178,
          fontSize: 10,
          letterSpacing: ".08em",
          color: "hsl(220 16% 65%)",
        }}
      >
        PUBLISH GAUNTLET · {GAUNTLET_STAGES.length} CHECKS
      </div>

      {/* 10 Gauntlet Pips */}
      <div
        className="el w-pips"
        style={{
          left: 28,
          top: 200,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {GAUNTLET_STAGES.map((stage, idx) => (
          <span
            key={stage.label}
            className={`wp w-p${idx + 1}`}
            title={stage.label}
            style={{ "--d": `${idx * 0.3}s` } as Record<string, string>}
          />
        ))}
      </div>

      <div
        className="el font-mono w-plabel"
        style={{
          left: 28,
          top: 232,
          fontSize: 11,
          color: "hsl(220 16% 65%)",
        }}
      >
        Golden run — a real run against your knowledge base…
      </div>

      {/* Published Golden Seal */}
      <div
        className="el w-seal font-display"
        style={{
          right: 60,
          top: 150,
          padding: "10px 18px",
          border: "3px solid hsl(142 71% 45%)",
          color: "hsl(142 71% 55%)",
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: ".06em",
        }}
      >
        PUBLISHED
      </div>

      {/* Schedule Badge */}
      <div
        className="el mini w-sched"
        style={{
          right: 28,
          bottom: 60,
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "9999px",
            background: "hsl(142 71% 45%)",
          }}
        />
        <span className="font-mono text-xs">Mon 08:00 · every week · next run in 6d</span>
      </div>

      <div className="el scap">
        Describe it → the AI drafts the steps → ten checks including a real run → published and scheduled
      </div>
    </div>
  )
}
