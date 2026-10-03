import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Chip, Footnote } from "../../components/ui";
import { body, C, display } from "../../theme";
import { ECaption, EPanel, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

const QUESTION = "What was our Q3 churn, and what drove it?";
const ANSWER: Array<{ text: string; cite: number }> = [
  { text: "Q3 churn was 4.2%, down from 5.1%.", cite: 1 },
  { text: "The main driver: onboarding friction in the first 30 days.", cite: 2 },
];
const SOURCES = ["Q3-Retention-Report.pdf · p. 4", "CS-Interviews-September.docx · §2"];

const TYPE_AT = 10;
const ANSWER_AT = 26;
const WPF = 0.8; // words per frame while streaming

export const EAsk: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typed = QUESTION.slice(0, Math.max(0, Math.floor((frame - TYPE_AT) * 4)));

  let budget = Math.max(0, Math.floor((frame - ANSWER_AT) * WPF));
  let cumulative = 0;
  const segs = ANSWER.map((s) => {
    const w = s.text.split(" ");
    const take = Math.min(w.length, Math.max(0, budget));
    budget -= w.length;
    cumulative += w.length;
    return { ...s, shown: w.slice(0, take).join(" "), done: take === w.length, doneAt: ANSWER_AT + Math.ceil(cumulative / WPF) };
  });
  const doneAt = segs[segs.length - 1].doneAt;
  const conf = pop(frame, doneAt + 12, fps);

  return (
    <PushIn duration={duration}>
      <Vo beat={2} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      {segs.map((s) => (
        <Sfx key={s.cite} at={s.doneAt} src={SFX.click} volume={0.35} />
      ))}
      <Sfx at={doneAt + 12} src={SFX.toggle} volume={0.4} />
      <AbsoluteFill>
        <ECaption eyebrow="Grounded answers" lines={["Ask anything.", "Get *receipts.*"]} sub="Every claim cited to the page. Every answer scored for confidence." />
        <EPanel at={4} style={{ left: 880, top: 200, width: 900, padding: 40 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                padding: "18px 24px",
                borderRadius: 20,
                background: "hsl(239 100% 82% / 0.14)",
                border: "1px solid hsl(239 100% 82% / 0.3)",
                fontFamily: body,
                fontSize: 26,
                color: C.fg,
                minHeight: 34,
              }}
            >
              {typed}
            </div>
          </div>
          <div style={{ marginTop: 30, opacity: punch(frame, ANSWER_AT - 4, 4) }}>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: C.primary, marginBottom: 10 }}>Syrel</div>
            <div style={{ fontFamily: body, fontSize: 31, lineHeight: 1.5, color: C.fg, minHeight: 140 }}>
              {segs.map((s) => (
                <React.Fragment key={s.cite}>
                  {s.shown}
                  {s.done ? (
                    <sup
                      style={{
                        display: "inline-block",
                        margin: "0 4px 0 6px",
                        padding: "2px 9px",
                        borderRadius: 8,
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.bg,
                        background: C.primary,
                        scale: pop(frame, s.doneAt, fps),
                      }}
                    >
                      {s.cite}
                    </sup>
                  ) : null}{" "}
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {SOURCES.map((src, i) => {
                const p = punch(frame, doneAt + 2 + i * F_STAGGER);
                return (
                  <div key={src} style={{ opacity: p, translate: `${(1 - p) * -40}px 0px` }}>
                    <Chip color={C.muted} style={{ fontWeight: 500 }}>
                      <span style={{ color: C.primary, fontWeight: 700 }}>{i + 1}</span> {src}
                    </Chip>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 22, scale: conf, opacity: Math.min(1, conf), transformOrigin: "left center" }}>
              <Chip color={C.success}>● High confidence</Chip>
            </div>
          </div>
        </EPanel>
        <Footnote>Illustrative example</Footnote>
      </AbsoluteFill>
    </PushIn>
  );
};

