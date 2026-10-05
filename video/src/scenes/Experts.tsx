import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Caption, Check, Panel } from "../components/ui";
import { body, C, display, EASE_MOVE, enter, STAGGER } from "../theme";

// The real five starter Experts (supabase/migrations/198_starter_expert_library.sql).
const EXPERTS = [
  { name: "Financial Analyzer", mono: "FA" },
  { name: "Contract Reviewer", mono: "CR" },
  { name: "HR Policy Advisor", mono: "HR" },
  { name: "Operations Analyst", mono: "OA" },
  { name: "Security & Compliance", mono: "SC" },
];
// Illustrative spend split for the "Spend by Expert" view.
const SPEND = [
  { name: "Financial Analyzer", share: 0.46 },
  { name: "Contract Reviewer", share: 0.31 },
  { name: "HR Policy Advisor", share: 0.18 },
];

export const Experts: React.FC = () => {
  const frame = useCurrentFrame();
  const installAt = 70;
  const spendAt = 150;

  return (
    <AbsoluteFill>
      <Caption
        eyebrow="Experts"
        title={
          <>
            Install an Expert
            <br />
            <Accent>for every team.</Accent>
          </>
        }
        sub="Each Expert brings its own knowledge and skills into your workspace. It only ever adds to what Syrel can do — and every token it spends is counted."
      />

      <div style={{ position: "absolute", left: 880, top: 150, width: 880, display: "flex", flexDirection: "column", gap: 14 }}>
        {EXPERTS.map((e, i) => {
          const p = enter(frame, 12 + i * STAGGER, 14);
          const installed = i < 3 ? enter(frame, installAt + i * 8, 12) : 0;
          return (
            <div
              key={e.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "16px 22px",
                borderRadius: 18,
                background: C.cardRaised,
                border: `1px solid ${installed > 0.5 ? "hsl(152 60% 52% / 0.4)" : C.border}`,
                opacity: p,
                translate: `${(1 - p) * 30}px 0px`,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, hsl(239 100% 82% / 0.25), hsl(258 90% 66% / 0.25))`,
                  border: `1px solid hsl(239 100% 82% / 0.35)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: display,
                  fontWeight: 800,
                  fontSize: 19,
                  color: C.primary,
                }}
              >
                {e.mono}
              </div>
              <div style={{ flex: 1, fontFamily: body, fontSize: 27, fontWeight: 600, color: C.fg }}>{e.name}</div>
              {installed > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: body, fontSize: 20, fontWeight: 600, color: C.success }}>
                  <Check progress={installed} size={26} /> Installed
                </div>
              ) : (
                <div style={{ fontFamily: body, fontSize: 20, fontWeight: 600, color: C.primary }}>Install</div>
              )}
            </div>
          );
        })}
      </div>

      <Panel at={spendAt - 10} style={{ left: 880, top: 690, width: 880, padding: "24px 30px" }}>
        <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: C.muted, marginBottom: 14 }}>Spend by Expert · this month</div>
        {SPEND.map((s, i) => {
          const w = interpolate(frame, [spendAt + i * 4, spendAt + i * 4 + 30], [0, s.share], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE_MOVE,
          });
          return (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 18, height: 40 }}>
              <div style={{ width: 230, fontFamily: body, fontSize: 19, color: C.fg }}>{s.name}</div>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: C.border }}>
                <div
                  style={{
                    width: `${w * 100}%`,
                    height: "100%",
                    borderRadius: 6,
                    background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </Panel>
    </AbsoluteFill>
  );
};
