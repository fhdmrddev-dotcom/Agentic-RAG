import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Chip, LogoPlaceholder } from "../../components/ui";
import { C, display, gradientText } from "../../theme";
import { PunchLine, PushIn, Sfx, SFX, Vo } from "../kit";
import { F_STAGGER, pop, punch } from "../theme";
import type { SceneProps } from "./EOpening";

const PILLARS = ["Cited answers", "Sandboxed work", "Validated workflows", "Granted connections", "Installable Experts"];

export const EClose: React.FC<SceneProps> = ({ duration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const glow = interpolate(frame, [8, 14, 40], [0, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cta = pop(frame, 46, fps);

  return (
    <PushIn duration={duration}>
      <Vo beat={7} at={4} />
      <Sfx at={0} src={SFX.whoosh} volume={0.35} />
      <Sfx at={46} src={SFX.ding} volume={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <div style={{ scale: pop(frame, 2, fps), opacity: frame >= 2 ? 1 : 0 }}>
          <LogoPlaceholder size={124} />
        </div>
        <div
          style={{
            fontFamily: display,
            fontSize: 180,
            fontWeight: 800,
            letterSpacing: -5,
            lineHeight: 1,
            scale: pop(frame, 6, fps),
            opacity: frame >= 6 ? 1 : 0,
            filter: `drop-shadow(0 0 ${60 * glow}px hsl(239 100% 82% / ${0.8 * glow}))`,
            ...gradientText,
          }}
        >
          Syrel
        </div>
        <PunchLine text="Answers from your knowledge. With *receipts.*" at={16} size={46} weight={600} align="center" />
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {PILLARS.map((p, i) => {
            const a = punch(frame, 30 + i * F_STAGGER, 6);
            return (
              <div key={p} style={{ opacity: a, translate: `0px ${(1 - a) * 24}px` }}>
                <Chip color={C.muted} style={{ fontSize: 20, fontWeight: 500 }}>
                  {p}
                </Chip>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 24,
            scale: cta,
            opacity: frame >= 46 ? 1 : 0,
            padding: "20px 46px",
            borderRadius: 999,
            background: `linear-gradient(100deg, ${C.primary}, ${C.violet})`,
            color: C.bg,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 34,
            boxShadow: `0 20px 60px hsl(239 100% 70% / ${0.25 + 0.2 * Math.sin(frame / 6)})`,
          }}
        >
          Book a demo
        </div>
      </AbsoluteFill>
    </PushIn>
  );
};
