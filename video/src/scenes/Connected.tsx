import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Caption, Panel } from "../components/ui";
import { body, C, display, EASE_MOVE, enter, STAGGER } from "../theme";

// Generic monogram tiles — no third-party logos in the video.
const SERVICES = [
  { mono: "Dr", name: "Drive", x: 120, y: 60 },
  { mono: "Gm", name: "Gmail", x: 400, y: 20 },
  { mono: "Ca", name: "Calendar", x: 680, y: 60 },
  { mono: "Sh", name: "Sheets", x: 120, y: 330 },
  { mono: "Ji", name: "Jira", x: 400, y: 370 },
  { mono: "MCP", name: "Any MCP server", x: 680, y: 330 },
];
const HUB = { x: 400, y: 195 };
const TILE = 120;

const GRANTS: Array<{ tool: string; mode: "Allow" | "Ask" | "Deny" }> = [
  { tool: "drive.search_files", mode: "Allow" },
  { tool: "gmail.send_message", mode: "Ask" },
  { tool: "jira.delete_issue", mode: "Deny" },
];
const MODE_COLOR = { Allow: C.success, Ask: C.warn, Deny: C.danger } as const;

export const Connected: React.FC = () => {
  const frame = useCurrentFrame();
  const grantsAt = 150;

  return (
    <AbsoluteFill>
      <Caption
        eyebrow="Connections"
        title={
          <>
            Connect the tools
            <br />
            <Accent>you already use.</Accent>
          </>
        }
        sub="Google Workspace, Jira, and any MCP server. You grant every tool one by one — Allow, Ask first, or Deny."
      />

      {/* Constellation: tiles arrive, then lines draw into the hub */}
      <div style={{ position: "absolute", left: 880, top: 110, width: 880, height: 520 }}>
        <svg width={880} height={520} style={{ position: "absolute", inset: 0 }}>
          {SERVICES.map((s, i) => {
            const p = interpolate(frame, [30 + i * STAGGER * 2, 60 + i * STAGGER * 2], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE_MOVE,
            });
            const x1 = s.x + TILE / 2;
            const y1 = s.y + TILE / 2;
            const x2 = HUB.x + TILE / 2;
            const y2 = HUB.y + TILE / 2;
            const len = Math.hypot(x2 - x1, y2 - y1);
            return (
              <line
                key={s.name}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#g)"
                strokeWidth={2}
                strokeDasharray={len}
                strokeDashoffset={len * (1 - p)}
              />
            );
          })}
          <defs>
            <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="880" y2="520">
              <stop offset="0%" stopColor="hsl(239 100% 82%)" />
              <stop offset="100%" stopColor="hsl(258 90% 66%)" />
            </linearGradient>
          </defs>
        </svg>

        {SERVICES.map((s, i) => {
          const p = enter(frame, 10 + i * STAGGER, 14);
          return (
            <div
              key={s.name}
              style={{
                position: "absolute",
                left: s.x,
                top: s.y,
                width: TILE,
                height: TILE,
                borderRadius: 28,
                background: C.cardRaised,
                border: `1px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: p,
                scale: interpolate(p, [0, 1], [0.85, 1]),
              }}
            >
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: s.mono.length > 2 ? 26 : 34, color: C.fg }}>{s.mono}</div>
              <div style={{ fontFamily: body, fontSize: 15, color: C.muted, textAlign: "center", padding: "0 6px" }}>{s.name}</div>
            </div>
          );
        })}

        {/* Hub */}
        {(() => {
          const p = enter(frame, 62, 16);
          const pulse = 0.5 + 0.5 * Math.sin(frame / 10);
          return (
            <div
              style={{
                position: "absolute",
                left: HUB.x,
                top: HUB.y,
                width: TILE,
                height: TILE,
                borderRadius: 32,
                background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: display,
                fontWeight: 800,
                fontSize: 30,
                color: C.bg,
                opacity: p,
                scale: interpolate(p, [0, 1], [0.7, 1]),
                boxShadow: `0 0 ${30 + pulse * 30}px hsl(239 100% 82% / ${0.35 * p})`,
              }}
            >
              Syrel
            </div>
          );
        })()}
      </div>

      {/* Per-tool grants */}
      <Panel at={grantsAt - 10} style={{ left: 960, top: 690, width: 720, padding: "24px 30px" }}>
        {GRANTS.map((g, i) => {
          const p = enter(frame, grantsAt + i * STAGGER * 2, 12);
          const c = MODE_COLOR[g.mode];
          return (
            <div
              key={g.tool}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderTop: i ? `1px solid ${C.border}` : "none",
                opacity: p,
                translate: `${(1 - p) * 20}px 0px`,
              }}
            >
              <span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 22, color: C.fg }}>{g.tool}</span>
              <span
                style={{
                  fontFamily: body,
                  fontWeight: 700,
                  fontSize: 19,
                  color: c,
                  padding: "6px 16px",
                  borderRadius: 999,
                  border: `1px solid ${c.replace(")", " / 0.4)")}`,
                  background: c.replace(")", " / 0.12)"),
                }}
              >
                {g.mode}
              </span>
            </div>
          );
        })}
      </Panel>
    </AbsoluteFill>
  );
};
