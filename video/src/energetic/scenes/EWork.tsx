import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, Footnote, Spinner } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

const STEPS = [
  { tool: "search_documents", label: "Searched 3 folders", detail: "12 passages" },
  { tool: "execute_code", label: "Ran the analysis", detail: "Python · sealed sandbox" },
  { tool: "execute_code", label: "Built the chart", detail: "matplotlib" },
  { tool: "write_file", label: "Saved the workbook", detail: "2 sheets" },
];
const FILES = [
  { name: "churn-by-segment.png", kind: "PNG" },
  { name: "q3-churn-analysis.xlsx", kind: "XLSX" },
];
const FIRST = 14;
const STEP = 16;
const ROW = 88;

export const EWork: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const filesAt = FIRST + STEPS.length * STEP + 2;

  return (
    <PushIn duration={duration}>
      <Vo beat={3} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      {STEPS.map((_, i) => (
        <Sfx key={i} at={FIRST + i * STEP + STEP - 4} src={SFX.click} volume={0.3} />
      ))}
      <Sfx at={filesAt} src={SFX.toggle} volume={0.4} />
      <AbsoluteFill>
        <ECaption eyebrow="Real work" lines={["Not just answers.", "It *does the work.*"]} sub="Searches your library, runs Python in a sealed sandbox, hands you real files." />
        <EPanel at={4} style={{ left: 880, top: 170, width: 900, padding: "34px 40px" }}>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.muted, marginBottom: 20 }}>Run · Q3 churn deep-dive</div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 13, top: ROW / 2, width: 2, height: (STEPS.length - 1) * ROW, background: C.border }} />
            <div
              style={{
                position: "absolute",
                left: 13,
                top: ROW / 2,
                width: 2,
                background: `linear-gradient(${C.primary}, ${C.violet})`,
                height: interpolate(frame, [FIRST, FIRST + STEPS.length * STEP], [0, (STEPS.length - 1) * ROW], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                boxShadow: `0 0 12px ${C.primary}`,
              }}
            />
            {STEPS.map((s, i) => {
              const start = FIRST + i * STEP;
              const appear = punch(frame, start - 4, 5);
              const done = punch(frame, start + STEP - 4, 5);
              const active = frame >= start && done === 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, height: ROW, opacity: appear, translate: `${(1 - appear) * 40}px 0px` }}>
                  <div style={{ width: 28, height: 28, zIndex: 1, background: C.card, borderRadius: 14, scale: done > 0 ? pop(frame, start + STEP - 4, fps) : 1 }}>
                    {done > 0 ? <Check progress={done} /> : active ? <Spinner /> : null}
                  </div>
                  <div>
                    <div style={{ fontFamily: body, fontSize: 28, fontWeight: 600, color: done > 0 || active ? C.fg : C.dim }}>{s.label}</div>
                    <div style={{ fontFamily: body, fontSize: 20, color: C.muted, marginTop: 4 }}>
                      <span style={{ fontFamily: "ui-monospace, Consolas, monospace", color: C.violetText }}>{s.tool}</span>
                      {"  ·  "}
                      {s.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 24 }}>
            {FILES.map((f, i) => {
              const p = pop(frame, filesAt + i * F_STAGGER * 2, fps);
              return (
                <div
                  key={f.name}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 20px",
                    borderRadius: 16,
                    border: "1px solid hsl(239 100% 82% / 0.4)",
                    background: "hsl(239 100% 82% / 0.1)",
                    opacity: Math.min(1, p),
                    scale: p,
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                      color: C.bg,
                      fontFamily: display,
                      fontWeight: 800,
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {f.kind}
                  </div>
                  <div>
                    <div style={{ fontFamily: body, fontSize: 21, fontWeight: 600, color: C.fg }}>{f.name}</div>
                    <div style={{ fontFamily: body, fontSize: 18, color: C.primary, marginTop: 2 }}>↓ Download</div>
                  </div>
                </div>
              );
            })}
          </div>
        </EPanel>
        <Footnote>Illustrative example</Footnote>
      </AbsoluteFill>
    </PushIn>
  );
};
