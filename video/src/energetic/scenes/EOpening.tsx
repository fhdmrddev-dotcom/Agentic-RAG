import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoPlaceholder } from "../../components/ui";
import { body, C, display, gradientText } from "../../theme";
import { PunchLine, PushIn, Vo } from "../kit";
import { cut, F_QUICK, F_SLOW, pop, punch } from "../theme";

export type SceneProps = {
  duration: number;
  voFrames: number;
  /** Optional voice file under public/ that replaces this scene's overview beat (feature clips). */
  vo?: string;
};

// Hook lines punch in while the voice says them; the brand pops on the last word.
export const EOpening: React.FC<SceneProps> = ({ duration, voFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = Math.max(60, voFrames - 4); // brand lands as the line finishes
  const hookOut = cut(frame, reveal - F_QUICK, F_QUICK);
  const logo = pop(frame, reveal, fps);
  const glow = interpolate(frame, [reveal + 4, reveal + 10, reveal + 30], [0, 1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tag = punch(frame, reveal + 12, F_SLOW);

  return (
    <PushIn duration={duration}>
      <Vo beat={1} at={4} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", opacity: hookOut, scale: interpolate(hookOut, [0, 1], [0.9, 1]) }}>
          <PunchLine text="Your documents know the *answer.*" at={4} size={92} align="center" />
          <div style={{ height: 22 }} />
          <PunchLine text="Most AI never reads them." at={Math.round(voFrames * 0.5)} size={68} color={C.muted} weight={700} align="center" />
        </div>

        {frame >= reveal - 1 ? (
          <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
            <div style={{ scale: logo, opacity: Math.min(1, logo) }}>
              <LogoPlaceholder size={140} />
            </div>
            <div
              style={{
                fontFamily: display,
                fontSize: 170,
                fontWeight: 800,
                letterSpacing: -5,
                lineHeight: 1,
                scale: pop(frame, reveal + 4, fps),
                filter: `drop-shadow(0 0 ${50 * glow}px hsl(239 100% 82% / ${0.8 * glow}))`,
                ...gradientText,
              }}
            >
              Syrel
            </div>
            <div style={{ fontFamily: body, fontSize: 38, color: C.muted, opacity: tag, translate: `0px ${(1 - tag) * 20}px` }}>
              The AI agent that reads your knowledge — and shows its receipts.
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
    </PushIn>
  );
};
