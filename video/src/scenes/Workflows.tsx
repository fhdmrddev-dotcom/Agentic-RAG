import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Caption, Check, Chip, Panel } from "../components/ui";
import { body, C, display, enter, EASE_MOVE } from "../theme";

const PHASES = [
  { name: "Gather evidence", note: "From the Board folder only" },
  { name: "Analyse", note: "Numbers checked against sources" },
  { name: "Draft report", note: "Fills your Word template" },
  { name: "Validate citations", note: "Every claim must cite a source" },
  { name: "Deliver", note: "Board-Update-Q3.docx" },
];
const FIRST = 40;
const PHASE = 40;
const ROW = 96;

export const Workflows: React.FC = () => {
  const frame = useCurrentFrame();
  const gauntletAt = FIRST + PHASES.length * PHASE + 4;
  const PIPS = 8;

  return (
    <AbsoluteFill>
      <Caption
        eyebrow="Workflows"
        title={
          <>
            Turn routine work
            <br />
            into <Accent>trusted workflows.</Accent>
          </>
        }
        sub="Describe the process in plain English. Syrel runs every step in order, checks each one, and won't publish a workflow until it proves it works."
      />

      <Panel at={10} style={{ left: 860, top: 140, width: 920, padding: "36px 40px" }}>
        <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.muted, marginBottom: 22 }}>
          Workflow · Quarterly board update
        </div>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 19, top: ROW / 2, width: 2, height: (PHASES.length - 1) * ROW, background: C.border }} />
          <div
            style={{
              position: "absolute",
              left: 19,
              top: ROW / 2,
              width: 2,
              background: `linear-gradient(${C.primary}, ${C.violet})`,
              height: interpolate(frame, [FIRST, FIRST + PHASES.length * PHASE], [0, (PHASES.length - 1) * ROW], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE_MOVE,
              }),
            }}
          />
          {PHASES.map((ph, i) => {
            const lit = enter(frame, FIRST + i * PHASE, 12);
            const done = enter(frame, FIRST + i * PHASE + PHASE - 12, 10);
            return (
              <div key={ph.name} style={{ display: "flex", alignItems: "center", gap: 24, height: ROW }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: C.card,
                    border: `2px solid ${lit > 0 ? C.primary : C.border}`,
                    boxShadow: `0 0 ${24 * lit * (1 - done)}px hsl(239 100% 82% / 0.6)`,
                    scale: interpolate(lit, [0, 1], [0.9, 1]),
                  }}
                >
                  {done > 0 ? (
                    <Check progress={done} size={30} />
                  ) : (
                    <span style={{ fontFamily: display, fontWeight: 800, fontSize: 18, color: lit > 0 ? C.primary : C.dim }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: body, fontSize: 28, fontWeight: 600, color: lit > 0 ? C.fg : C.dim }}>{ph.name}</div>
                  <div style={{ fontFamily: body, fontSize: 20, color: C.muted, marginTop: 4, opacity: 0.4 + 0.6 * lit }}>{ph.note}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Publish gauntlet: pips fill as a micro-cascade */}
        <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 20, opacity: enter(frame, gauntletAt - 6, 10) }}>
          <div style={{ fontFamily: body, fontSize: 21, fontWeight: 600, color: C.muted }}>Publish checks</div>
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: PIPS }).map((_, i) => {
              const p = enter(frame, gauntletAt + i * 4, 8);
              return (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 12,
                    borderRadius: 6,
                    background: p > 0.5 ? C.success : C.border,
                    scale: interpolate(p, [0, 0.6, 1], [1, 1.25, 1]),
                  }}
                />
              );
            })}
          </div>
          <div style={{ opacity: enter(frame, gauntletAt + PIPS * 4 + 4, 12) }}>
            <Chip color={C.success}>8 / 8 passed · Published</Chip>
          </div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
