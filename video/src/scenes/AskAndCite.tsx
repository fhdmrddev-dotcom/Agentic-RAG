import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Caption, Chip, Footnote, Panel } from "../components/ui";
import { body, C, display, enter, EASE_IN, STAGGER } from "../theme";

const QUESTION = "What was our Q3 churn, and what drove it?";
// Answer as segments so citation markers can pop in as they stream.
const ANSWER: Array<{ text: string; cite?: number }> = [
  { text: "Q3 churn was 4.2%, down from 5.1% in Q2." , cite: 1 },
  { text: " The main driver was onboarding friction in the first 30 days,", cite: 2 },
  { text: " concentrated in the SMB tier.", cite: 3 },
];
const SOURCES = [
  "Q3-Retention-Report.pdf · p. 4",
  "CS-Interviews-September.docx · §2",
  "Churn-by-Segment.xlsx · Sheet 1",
];

export const AskAndCite: React.FC = () => {
  const frame = useCurrentFrame();

  // Typing: ~1.6 chars per frame, starting after the panel lands.
  const typed = QUESTION.slice(0, Math.max(0, Math.floor((frame - 30) * 1.6)));
  const answerStart = 92;
  const totalWords = ANSWER.reduce((n, s) => n + s.text.split(" ").length, 0);
  const shownWords = Math.max(0, Math.floor((frame - answerStart) / 2.2));

  // Rebuild segments up to the streamed word count.
  let budget = shownWords;
  let cumulative = 0;
  const segments = ANSWER.map((seg) => {
    const segWords = seg.text.split(" ");
    const take = Math.min(segWords.length, Math.max(0, budget));
    budget -= segWords.length;
    cumulative += segWords.length;
    return {
      text: segWords.slice(0, take).join(" "),
      done: take === segWords.length,
      cite: seg.cite,
      doneFrame: answerStart + Math.ceil(cumulative * 2.2),
    };
  });
  const streamingDone = shownWords >= totalWords;
  const doneAt = answerStart + Math.ceil(totalWords * 2.2);

  const confidence = enter(frame, doneAt + 30, 12);

  return (
    <AbsoluteFill>
      <Caption
        eyebrow="Grounded answers"
        title={
          <>
            Ask anything.
            <br />
            Get an answer <Accent>with receipts.</Accent>
          </>
        }
        sub="Every claim is cited to the exact page in your documents, and every answer is scored for confidence."
      />

      <Panel at={10} style={{ left: 860, top: 170, width: 920, padding: 40 }}>
        {/* User bubble */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              maxWidth: 620,
              padding: "18px 24px",
              borderRadius: 20,
              background: "hsl(239 100% 82% / 0.14)",
              border: `1px solid hsl(239 100% 82% / 0.3)`,
              fontFamily: body,
              fontSize: 26,
              color: C.fg,
              minHeight: 34,
            }}
          >
            {typed}
            {typed.length < QUESTION.length && frame > 30 ? (
              <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: C.primary }}>▍</span>
            ) : null}
          </div>
        </div>

        {/* Assistant answer */}
        <div style={{ marginTop: 34, opacity: enter(frame, answerStart - 6, 10) }}>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, color: C.primary, marginBottom: 12 }}>
            Syrel
          </div>
          <div style={{ fontFamily: body, fontSize: 30, lineHeight: 1.55, color: C.fg, minHeight: 190 }}>
            {segments.map((s, i) => (
              <React.Fragment key={i}>
                {s.text}
                {s.done && s.cite ? (
                  <sup
                    style={{
                      display: "inline-block",
                      marginLeft: 6,
                      padding: "2px 9px",
                      borderRadius: 8,
                      fontSize: 18,
                      fontWeight: 700,
                      color: C.bg,
                      background: C.primary,
                      scale: interpolate(
                        frame,
                        [s.doneFrame, s.doneFrame + 8],
                        [0.4, 1],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN },
                      ),
                    }}
                  >
                    {s.cite}
                  </sup>
                ) : null}
              </React.Fragment>
            ))}
          </div>

          {/* Sources: standard stagger, all from the same direction */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
            {SOURCES.map((src, i) => {
              const p = enter(frame, doneAt + 4 + i * STAGGER, 12);
              return (
                <div key={src} style={{ opacity: streamingDone ? p : 0, translate: `${(1 - p) * -20}px 0px` }}>
                  <Chip color={C.muted} style={{ fontSize: 20, fontWeight: 500 }}>
                    <span style={{ color: C.primary, fontWeight: 700 }}>{i + 1}</span> {src}
                  </Chip>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 26, opacity: confidence, scale: interpolate(confidence, [0, 1], [0.8, 1]) }}>
            <Chip color={C.success}>● High confidence · 3 sources agree</Chip>
          </div>
        </div>
      </Panel>
      <Footnote>Illustrative example</Footnote>
    </AbsoluteFill>
  );
};
