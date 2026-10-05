import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { EXPO_IN, F_STAGGER, punch } from "../theme";
import type { SceneProps } from "./EOpening";

// The real five starter Experts (supabase/migrations/198_starter_expert_library.sql).
const EXPERTS = [
  { name: "Financial Analyzer", mono: "FA" },
  { name: "Contract Reviewer", mono: "CR" },
  { name: "HR Policy Advisor", mono: "HR" },
  { name: "Operations Analyst", mono: "OA" },
  { name: "Security & Compliance", mono: "SC" },
];
const SPEND = [
  { name: "Financial Analyzer", share: 0.46 },
  { name: "Contract Reviewer", share: 0.31 },
  { name: "HR Policy Advisor", share: 0.18 },
];
const INSTALL_AT = 22;
const SPEND_AT = 48;

export const EExperts: React.FC<SceneProps> = ({ duration, vo }) => {
  const frame = useCurrentFrame();
  useVideoConfig();

  return (
    <PushIn duration={duration}>
      <Vo beat={6} file={vo} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} at={INSTALL_AT + i * 6} src={SFX.click} volume={0.3} />
      ))}
      <AbsoluteFill>
        <ECaption eyebrow="Experts" lines={["An Expert", "for every *team.*"]} sub="Install it. It only adds to what Syrel can do — and every token it spends is counted." />
        <div style={{ position: "absolute", left: 900, top: 150, width: 860, display: "flex", flexDirection: "column", gap: 14 }}>
          {EXPERTS.map((e, i) => {
            const p = punch(frame, 2 + i * F_STAGGER, 6);
            const installed = i < 3 ? punch(frame, INSTALL_AT + i * 6, 5) : 0;
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
                  border: `1px solid ${installed > 0.5 ? "hsl(152 60% 52% / 0.5)" : C.border}`,
                  boxShadow: installed > 0 ? `0 0 ${24 * (1 - installed) + 6}px hsl(152 60% 52% / 0.25)` : "none",
                  opacity: p,
                  translate: `${(1 - p) * 120}px 0px`,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, hsl(239 100% 82% / 0.25), hsl(258 90% 66% / 0.25))",
                    border: "1px solid hsl(239 100% 82% / 0.35)",
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
        <EPanel at={SPEND_AT - 6} style={{ left: 900, top: 690, width: 860, padding: "22px 30px" }}>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, color: C.muted, marginBottom: 12 }}>Spend by Expert · this month</div>
          {SPEND.map((s, i) => {
            const w = interpolate(frame, [SPEND_AT + i * 3, SPEND_AT + i * 3 + 12], [0, s.share], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EXPO_IN,
            });
            return (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 18, height: 40 }}>
                <div style={{ width: 230, fontFamily: body, fontSize: 19, color: C.fg }}>{s.name}</div>
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: C.border }}>
                  <div style={{ width: `${w * 100}%`, height: "100%", borderRadius: 6, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, boxShadow: `0 0 10px ${C.primary}` }} />
                </div>
              </div>
            );
          })}
        </EPanel>
      </AbsoluteFill>
    </PushIn>
  );
};
