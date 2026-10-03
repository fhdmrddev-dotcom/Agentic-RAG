import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, Chip, LogoPlaceholder } from "../components/ui";
import { body, C, display, enter, SLOW, STAGGER } from "../theme";

const PILLARS = ["Cited answers", "Sandboxed work", "Validated workflows", "Granted connections", "Installable Experts"];

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = enter(frame, 6, SLOW);
  const name = enter(frame, 14, SLOW);
  const tag = enter(frame, 26, SLOW);
  const cta = enter(frame, 70, 18);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
      <div style={{ opacity: logo, scale: interpolate(logo, [0, 1], [0.85, 1]) }}>
        <LogoPlaceholder size={130} />
      </div>
      <div
        style={{
          fontFamily: display,
          fontSize: 170,
          fontWeight: 800,
          letterSpacing: -5,
          lineHeight: 1,
          opacity: name,
          translate: `0px ${(1 - name) * 30}px`,
        }}
      >
        <Accent>Syrel</Accent>
      </div>
      <div style={{ fontFamily: body, fontSize: 42, color: C.fg, opacity: tag, translate: `0px ${(1 - tag) * 24}px` }}>
        Answers from your knowledge. <span style={{ color: C.muted }}>With receipts.</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
        {PILLARS.map((p, i) => {
          const a = enter(frame, 40 + i * STAGGER, 12);
          return (
            <div key={p} style={{ opacity: a, translate: `0px ${(1 - a) * 16}px` }}>
              <Chip color={C.muted} style={{ fontSize: 20, fontWeight: 500 }}>
                {p}
              </Chip>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 30,
          opacity: cta,
          scale: interpolate(cta, [0, 1], [0.92, 1]),
          padding: "20px 44px",
          borderRadius: 999,
          background: `linear-gradient(100deg, ${C.primary}, ${C.violet})`,
          color: C.bg,
          fontFamily: display,
          fontWeight: 800,
          fontSize: 32,
          boxShadow: `0 20px 60px hsl(239 100% 70% / ${0.35 * cta})`,
        }}
      >
        Book a demo
      </div>
    </AbsoluteFill>
  );
};
