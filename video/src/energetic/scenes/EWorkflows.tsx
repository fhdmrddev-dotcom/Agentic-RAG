import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, Chip } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

const PHASES = [
  { name: "Gather evidence", note: "From the Board folder only" },
  { name: "Analyse", note: "Numbers checked against sources" },
  { name: "Draft report", note: "Fills your Word template" },
  { name: "Validate citations", note: "Every claim must cite a source" },
  { name: "Deliver", note: "Board-Update-Q3.docx" },
];
const FIRST = 14;
const PHASE = 14;
const ROW = 92;
const PIPS = 10;

export const EWorkflows: React.FC<SceneProps> = ({ duration, vo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gauntletAt = FIRST + PHASES.length * PHASE + 2;
  const passedAt = gauntletAt + PIPS * 2 + 4;

  return (
    <PushIn duration={duration}>
      <Vo beat={4} file={vo} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      {PHASES.map((_, i) => (
        <Sfx key={i} at={FIRST + i * PHASE + PHASE - 4} src={SFX.click} volume={0.28} />
      ))}
      <Sfx at={passedAt} src={SFX.ding} volume={0.45} />
      <AbsoluteFill>
        <ECaption eyebrow="Workflows" lines={["Every step.", "In order.", "*Checked.*"]} sub="Describe the process in plain English. It can't go live until it passes its publish checks." />
        <EPanel at={4} style={{ left: 880, top: 140, width: 900, padding: "34px 40px" }}>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, color: C.muted, marginBottom: 16 }}>Workflow · Quarterly board update</div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 19, top: ROW / 2, width: 2, height: (PHASES.length - 1) * ROW, background: C.border }} />
            <div
              style={{
                position: "absolute",
                left: 19,
                top: ROW / 2,
                width: 2,
                background: `linear-gradient(${C.primary}, ${C.violet})`,
                boxShadow: `0 0 12px ${C.primary}`,
                height: interpolate(frame, [FIRST, FIRST + PHASES.length * PHASE], [0, (PHASES.length - 1) * ROW], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            />
            {PHASES.map((ph, i) => {
              const start = FIRST + i * PHASE;
              const lit = punch(frame, start, 5);
              const done = punch(frame, start + PHASE - 4, 5);
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
                      boxShadow: `0 0 ${30 * lit * (1 - done)}px hsl(239 100% 82% / 0.8)`,
                      scale: lit > 0 ? pop(frame, start, fps) : 0.9,
                    }}
                  >
                    {done > 0 ? (
                      <Check progress={done} size={30} />
                    ) : (
                      <span style={{ fontFamily: display, fontWeight: 800, fontSize: 18, color: lit > 0 ? C.primary : C.dim }}>{i + 1}</span>
                    )}
                  </div>
                  <div style={{ translate: `${(1 - lit) * 24}px 0px` }}>
                    <div style={{ fontFamily: body, fontSize: 28, fontWeight: 600, color: lit > 0 ? C.fg : C.dim }}>{ph.name}</div>
                    <div style={{ fontFamily: body, fontSize: 20, color: C.muted, marginTop: 4, opacity: 0.35 + 0.65 * lit }}>{ph.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 20, opacity: punch(frame, gauntletAt - 3, 4) }}>
            <div style={{ fontFamily: body, fontSize: 21, fontWeight: 600, color: C.muted }}>Publish checks</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: PIPS }).map((_, i) => {
                const on = frame >= gauntletAt + i * 2;
                return (
                  <div
                    key={i}
                    style={{
                      width: 26,
                      height: 12,
                      borderRadius: 6,
                      background: on ? C.success : C.border,
                      boxShadow: on ? `0 0 10px ${C.success}` : "none",
                      scale: on ? pop(frame, gauntletAt + i * 2, fps) : 1,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ scale: pop(frame, passedAt, fps), opacity: frame >= passedAt ? 1 : 0, transformOrigin: "left center" }}>
              <Chip color={C.success}>10 / 10 passed · Published</Chip>
            </div>
          </div>
        </EPanel>
      </AbsoluteFill>
    </PushIn>
  );
};
