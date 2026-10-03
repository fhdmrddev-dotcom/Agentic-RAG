import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footnote } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

// Shipped Control Room surfaces (v3.3 + v4.4): users, model registry, spend per Expert,
// audit log, kill switches (web search, code sandbox, self-improvement, workflows) and
// maintenance mode. Names match docs/history/v3.3-operator-ux.md.
const TABS = ["Health", "Users", "Models", "Spend", "Audit", "Kill switches"];
const SWITCHES = [
  { name: "Web search", on: true },
  { name: "Code sandbox", on: true },
  { name: "Self-improvement", on: true, flips: true },
  { name: "Workflows", on: true },
];
const AUDIT = [
  { verb: "✎ capability.toggle", what: "Self-improvement → off", who: "operator" },
  { verb: "✎ user.disable", what: "contractor account", who: "operator" },
  { verb: "✎ model.add", what: "registry entry added", who: "admin" },
];

const FIRST = 10;
const FLIP_AT = 50;
const AUDIT_AT = 62;

export const EAdmin: React.FC<SceneProps> = ({ duration, vo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeTab = frame < FLIP_AT - 10 ? 0 : 5;

  return (
    <PushIn duration={duration}>
      <Vo beat={0} file={vo} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      <Sfx at={FLIP_AT} src={SFX.toggle} volume={0.45} />
      {AUDIT.map((_, i) => (
        <Sfx key={i} at={AUDIT_AT + i * 6} src={SFX.click} volume={0.25} />
      ))}
      <AbsoluteFill>
        <ECaption
          eyebrow="Control Room"
          lines={["Run it", "*with confidence.*"]}
          sub="Users, models, spend per Expert, the audit log and kill switches — all from the browser."
        />
        <EPanel at={4} style={{ left: 880, top: 160, width: 900, padding: "26px 30px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            {TABS.map((t, i) => {
              const p = punch(frame, FIRST + i * F_STAGGER, 5);
              const on = i === activeTab;
              return (
                <div
                  key={t}
                  style={{
                    fontFamily: body,
                    fontSize: 18,
                    fontWeight: 600,
                    padding: "8px 14px",
                    borderRadius: 999,
                    color: on ? C.primary : C.muted,
                    background: on ? "hsl(239 100% 82% / 0.14)" : "transparent",
                    border: `1px solid ${on ? "hsl(239 100% 82% / 0.45)" : C.border}`,
                    opacity: p,
                  }}
                >
                  {t}
                </div>
              );
            })}
          </div>

          {/* Vitals */}
          <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
            {[
              ["Active users", "24"],
              ["Running now", "3"],
              ["Spend this month", "$412"],
            ].map(([k, v], i) => {
              const p = punch(frame, FIRST + 8 + i * F_STAGGER, 7);
              return (
                <div key={k} style={{ flex: 1, padding: "14px 16px", borderRadius: 14, background: C.cardRaised, border: `1px solid ${C.border}`, opacity: p, translate: `0px ${(1 - p) * 20}px` }}>
                  <div style={{ fontFamily: body, fontSize: 15, color: C.muted }}>{k}</div>
                  <div style={{ fontFamily: display, fontSize: 34, fontWeight: 800, color: C.fg, marginTop: 4 }}>{v}</div>
                </div>
              );
            })}
          </div>

          {/* Kill switches */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            {SWITCHES.map((s, i) => {
              const p = punch(frame, FIRST + 14 + i * F_STAGGER, 6);
              const flipped = s.flips && frame >= FLIP_AT;
              const on = flipped ? false : s.on;
              const knob = s.flips ? interpolate(frame, [FLIP_AT, FLIP_AT + 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
              const bump = s.flips && frame >= FLIP_AT ? pop(frame, FLIP_AT, fps) : 1;
              return (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 14,
                    background: C.cardRaised,
                    border: `1px solid ${flipped ? "hsl(38 92% 60% / 0.5)" : C.border}`,
                    opacity: p,
                    scale: bump,
                  }}
                >
                  <span style={{ fontFamily: body, fontSize: 19, fontWeight: 600, color: C.fg }}>{s.name}</span>
                  <div style={{ width: 52, height: 28, borderRadius: 14, background: on ? C.success : C.border, position: "relative" }}>
                    <div style={{ position: "absolute", top: 3, left: 3 + 24 * knob, width: 22, height: 22, borderRadius: 11, background: C.fg }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audit receipts */}
          <div style={{ fontFamily: display, fontSize: 19, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Audit log</div>
          {AUDIT.map((a, i) => {
            const p = punch(frame, AUDIT_AT + i * 6, 6);
            return (
              <div
                key={a.verb + i}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "baseline",
                  padding: "8px 0",
                  borderTop: i ? `1px solid ${C.border}` : "none",
                  opacity: p,
                  translate: `${(1 - p) * 30}px 0px`,
                }}
              >
                <span style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 17, color: C.violetText, width: 230 }}>{a.verb}</span>
                <span style={{ fontFamily: body, fontSize: 18, color: C.fg, flex: 1 }}>{a.what}</span>
                <span style={{ fontFamily: body, fontSize: 15, color: C.dim }}>{a.who}</span>
              </div>
            );
          })}
        </EPanel>
        <Footnote>Illustrative example</Footnote>
      </AbsoluteFill>
    </PushIn>
  );
};
