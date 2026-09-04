import {
  GmailIcon,
  CalendarIcon,
  DriveIcon,
  SheetsIcon,
  SlackBrandIcon,
  JiraBrandIcon,
} from "../components/BrandIcons"
import "./scenes.css"

export function ConnectionsScene() {
  return (
    <div className="scene sc-cx" aria-label="Interactive connections storyboard showing 3D orbiting integrations ring, permission gate, and confirmation receipt">
      <div className="sfloor" aria-hidden="true" />

      {/* Core Glowing Orb */}
      <div
        className="el x-core"
        style={{
          left: "50%",
          top: "50%",
          width: 56,
          height: 56,
          margin: "-28px 0 0 -28px",
          borderRadius: 14,
          background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))",
          boxShadow: "0 0 40px hsl(239 84% 67% / .5)",
        }}
      />

      {/* Pulsing ring wave */}
      <div
        className="el x-pulse"
        style={{
          left: "50%",
          top: "50%",
          width: 56,
          height: 56,
          margin: "-28px 0 0 -28px",
          borderRadius: 14,
          border: "2px solid hsl(239 100% 82%)",
        }}
      />

      {/* 3D Orbiting Connection Ring */}
      <div
        className="el x-ringwrap"
        style={{
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          perspective: 900,
        }}
      >
        <div className="x-ring">
          <div className="xt" style={{ transform: "rotateY(0deg) translateZ(280px)" }}>
            <GmailIcon size={16} />
            <span>Gmail</span>
          </div>
          <div className="xt" style={{ transform: "rotateY(60deg) translateZ(280px)" }}>
            <CalendarIcon size={16} />
            <span>Calendar</span>
          </div>
          <div className="xt" style={{ transform: "rotateY(120deg) translateZ(280px)" }}>
            <DriveIcon size={16} />
            <span>Drive</span>
          </div>
          <div className="xt" style={{ transform: "rotateY(180deg) translateZ(280px)" }}>
            <SheetsIcon size={16} />
            <span>Sheets</span>
          </div>
          <div className="xt" style={{ transform: "rotateY(240deg) translateZ(280px)" }}>
            <SlackBrandIcon size={16} />
            <span>Slack</span>
          </div>
          <div className="xt" style={{ transform: "rotateY(300deg) translateZ(280px)" }}>
            <JiraBrandIcon size={16} />
            <span>Jira</span>
          </div>
        </div>
      </div>

      {/* Gate card */}
      <div
        className="el mini x-gate"
        style={{
          right: 24,
          top: 24,
          width: 260,
          padding: 12,
          borderColor: "hsl(38 92% 60% / .5)",
          background: "hsl(38 92% 60% / .08)",
        }}
      >
        <div className="needs font-mono" style={{ marginBottom: 6 }}>
          NEEDS YOU · draft_email
        </div>
        <div style={{ lineHeight: 1.45, marginBottom: 8 }}>
          To finance@ — “Q3 vendor spend summary”. Grant:{" "}
          <span className="font-mono">gmail_write</span> (drafts only).
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span
            className="pillbtn"
            style={{
              background: "hsl(38 92% 60%)",
              color: "hsl(240 60% 8%)",
            }}
          >
            Save draft
          </span>
          <span className="pillbtn" style={{ background: "hsl(220 25% 14%)" }}>
            Refuse
          </span>
        </div>
      </div>

      {/* Success receipt */}
      <div
        className="el mini x-ok"
        style={{
          right: 24,
          bottom: 60,
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          borderColor: "hsl(142 71% 45% / .5)",
        }}
      >
        <span className="ck">✓</span>
        <span>
          Draft saved in Gmail. <span className="dim">Nothing has been sent.</span>
        </span>
      </div>

      {/* Scope grants */}
      <div
        className="el mini x-grants"
        style={{
          left: 24,
          bottom: 60,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: ".08em",
            color: "hsl(220 16% 65%)",
          }}
        >
          GRANTS · GOOGLE WORKSPACE
        </div>
        <div>
          <span className="ck">✓</span> calendar_read · <span className="ck">✓</span> gmail_write (draft) ·{" "}
          <span style={{ color: "hsl(0 80% 80%)" }}>✕</span> gmail_send
        </div>
      </div>

      <div className="el scap">
        Connect once → grant narrowly → every write pauses for a person → a receipt says exactly what happened
      </div>
    </div>
  )
}
