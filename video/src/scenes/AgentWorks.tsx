import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Caption, Check, Footnote, Panel, Spinner } from "../components/ui";
import { body, C, display, enter, STAGGER } from "../theme";

const STEPS = [
  { tool: "search_documents", label: "Searched 3 folders", detail: "12 passages matched" },
  { tool: "execute_code", label: "Ran the analysis", detail: "Python · sealed sandbox" },
  { tool: "execute_code", label: "Built the chart", detail: "matplotlib" },
  { tool: "write_file", label: "Saved the workbook", detail: "2 sheets" },
];
const FILES = [
  { name: "churn-by-segment.png", kind: "PNG" },
  { name: "q3-churn-analysis.xlsx", kind: "XLSX" },
];

const FIRST = 40; // first step starts after the panel lands
const STEP = 46; // each step is ~1.5 s active

export const AgentWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const filesAt = FIRST + STEPS.length * STEP + 6;

  return (
    <AbsoluteFill>
      <Caption
        eyebrow="Real work, not just words"
        title={
          <>
            It doesn't just answer.
            <br />
            <Accent>It does the work.</Accent>
          </>
        }
        sub="Syrel searches your library, runs Python in a sealed sandbox, and hands you real files to download."
      />

      <Panel at={10} style={{ left: 860, top: 160, width: 920, padding: "36px 40px" }}>
        <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.muted, marginBottom: 26 }}>
          Run · Q3 churn deep-dive
        </div>
        <div style={{ position: "relative" }}>
          {/* Rail: grows as steps complete */}
          <div style={{ position: "absolute", left: 13, top: 46, width: 2, height: (STEPS.length - 1) * 92, background: C.border }} />
          <div
            style={{
              position: "absolute",
              left: 13,
              top: 46,
              width: 2,
              background: `linear-gradient(${C.primary}, ${C.violet})`,
              height: interpolate(frame, [FIRST, FIRST + (STEPS.length - 1) * STEP + STEP], [0, (STEPS.length - 1) * 92], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
          {STEPS.map((s, i) => {
            const start = FIRST + i * STEP;
            const appear = enter(frame, start - 8, 12);
            const doneP = enter(frame, start + STEP - 10, 10);
            const active = frame >= start && doneP === 0;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  height: 92,
                  opacity: appear,
                  translate: `${(1 - appear) * 20}px 0px`,
                }}
              >
                <div style={{ width: 28, height: 28, position: "relative", zIndex: 1, background: C.card, borderRadius: 14 }}>
                  {doneP > 0 ? <Check progress={doneP} /> : active ? <Spinner /> : null}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: body, fontSize: 28, fontWeight: 600, color: doneP > 0 || active ? C.fg : C.dim }}>
                    {s.label}
                  </div>
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

        {/* Output files: the hero of the scene, arrive last */}
        <div style={{ display: "flex", gap: 18, marginTop: 28 }}>
          {FILES.map((f, i) => {
            const p = enter(frame, filesAt + i * STAGGER * 2, 16);
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
                  border: `1px solid hsl(239 100% 82% / 0.35)`,
                  background: "hsl(239 100% 82% / 0.08)",
                  opacity: p,
                  translate: `0px ${(1 - p) * 24}px`,
                  scale: interpolate(p, [0, 1], [0.94, 1]),
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
      </Panel>
      <Footnote>Illustrative example</Footnote>
    </AbsoluteFill>
  );
};
