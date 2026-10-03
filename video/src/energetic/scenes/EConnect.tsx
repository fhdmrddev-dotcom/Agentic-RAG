import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

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
const LINES_AT = 12;
const HUB_AT = 22;
const GRANTS_AT = 42;

export const EConnect: React.FC<SceneProps> = ({ duration, vo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <PushIn duration={duration}>
      <Vo beat={5} file={vo} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      {GRANTS.map((_, i) => (
        <Sfx key={i} at={GRANTS_AT + i * 8} src={SFX.toggle} volume={0.35} />
      ))}
      <AbsoluteFill>
        <ECaption eyebrow="Connections" lines={["Your tools.", "*Your rules.*"]} sub="Google Workspace, Jira, any MCP server — and every tool is Allow, Ask, or Deny." />
        <div style={{ position: "absolute", left: 900, top: 110, width: 880, height: 520 }}>
          <svg width={880} height={520} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="eg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="880" y2="520">
                <stop offset="0%" stopColor="hsl(239 100% 82%)" />
                <stop offset="100%" stopColor="hsl(258 90% 66%)" />
              </linearGradient>
            </defs>
            {SERVICES.map((s, i) => {
              const p = punch(frame, LINES_AT + i * F_STAGGER, 8);
              const x1 = s.x + TILE / 2;
              const y1 = s.y + TILE / 2;
              const x2 = HUB.x + TILE / 2;
              const y2 = HUB.y + TILE / 2;
              const len = Math.hypot(x2 - x1, y2 - y1);
              return (
                <line key={s.name} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#eg)" strokeWidth={3} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
              );
            })}
          </svg>
          {SERVICES.map((s, i) => {
            const p = pop(frame, 2 + i * F_STAGGER, fps);
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
                  opacity: Math.min(1, p),
                  scale: p,
                }}
              >
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: s.mono.length > 2 ? 26 : 34, color: C.fg }}>{s.mono}</div>
                <div style={{ fontFamily: body, fontSize: 15, color: C.muted, textAlign: "center", padding: "0 6px" }}>{s.name}</div>
              </div>
            );
          })}
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
              scale: pop(frame, HUB_AT, fps),
              opacity: frame >= HUB_AT ? 1 : 0,
              boxShadow: `0 0 ${40 + 30 * Math.sin(frame / 5)}px hsl(239 100% 82% / 0.5)`,
            }}
          >
            Syrel
          </div>
        </div>
        <EPanel at={GRANTS_AT - 6} style={{ left: 980, top: 690, width: 720, padding: "22px 30px" }}>
          {GRANTS.map((g, i) => {
            const at = GRANTS_AT + i * 8;
            const p = punch(frame, at - 3, 5);
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
                  translate: `${(1 - p) * 40}px 0px`,
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
                    background: c.replace(")", ` / ${interpolate(frame, [at, at + 4, at + 12], [0.12, 0.4, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`),
                    scale: frame >= at ? pop(frame, at, fps) : 0.6,
                  }}
                >
                  {g.mode}
                </span>
              </div>
            );
          })}
        </EPanel>
      </AbsoluteFill>
    </PushIn>
  );
};
