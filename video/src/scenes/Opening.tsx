import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Accent, LogoPlaceholder } from "../components/ui";
import { body, C, display, enter, exit, SLOW } from "../theme";

// Setup → tension → resolution: the problem lines leave, the product arrives.
export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const problemOut = exit(frame, 78, 10);
  const l1 = enter(frame, 8, SLOW);
  const l2 = enter(frame, 34, SLOW);
  const logo = enter(frame, 88, SLOW);
  const name = enter(frame, 96, SLOW);
  const tag = enter(frame, 106, SLOW);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          textAlign: "center",
          opacity: problemOut,
          translate: `0px ${(1 - problemOut) * -30}px`,
        }}
      >
        <div
          style={{
            fontFamily: display,
            fontSize: 92,
            fontWeight: 800,
            color: C.fg,
            opacity: l1,
            translate: `0px ${(1 - l1) * 30}px`,
          }}
        >
          Your documents know the answer.
        </div>
        <div
          style={{
            fontFamily: display,
            fontSize: 64,
            fontWeight: 600,
            color: C.muted,
            marginTop: 24,
            opacity: l2,
            translate: `0px ${(1 - l2) * 30}px`,
          }}
        >
          Most AI never reads them.
        </div>
      </div>

      <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
        <div style={{ opacity: logo, scale: interpolate(logo, [0, 1], [0.85, 1]) }}>
          <LogoPlaceholder size={150} />
        </div>
        <div
          style={{
            fontFamily: display,
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -4,
            opacity: name,
            translate: `0px ${(1 - name) * 30}px`,
          }}
        >
          <Accent>Syrel</Accent>
        </div>
        <div
          style={{
            fontFamily: body,
            fontSize: 38,
            color: C.muted,
            opacity: tag,
            translate: `0px ${(1 - tag) * 24}px`,
          }}
        >
          The AI agent that reads your knowledge — and shows its receipts.
        </div>
      </div>
    </AbsoluteFill>
  );
};
