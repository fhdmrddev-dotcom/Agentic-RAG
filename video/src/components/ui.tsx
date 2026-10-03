import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { body, C, display, enter, gradientText, STAGGER } from "../theme";

/** Ambient layer: slow-drifting glow orbs + a faint dot grid. Sine-eased loops, never linear travel.
 *  `speed` scales the drift (1 = calm cut; the energetic cut uses ~2.5). */
export const Background: React.FC<{ speed?: number }> = ({ speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame / fps) * speed;
  const orb = (x: number, y: number, size: number, color: string, phase: number, amp: number) => (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin(t * 0.35 + phase) * amp,
        top: y + Math.cos(t * 0.28 + phase) * amp * 0.7,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        opacity: 0.32 + Math.sin(t * 0.5 + phase) * 0.06,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      {orb(-260, -320, 1100, "hsl(239 90% 55% / 0.55)", 0, 60)}
      {orb(1180, 420, 1000, "hsl(258 85% 50% / 0.45)", 2, 70)}
      {orb(560, 760, 800, "hsl(220 80% 40% / 0.35)", 4, 50)}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(hsl(226 60% 97% / 0.06) 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          translate: `0px ${-(t * 6) % 36}px`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Signature entrance: rise 24px + fade, decelerating. */
export const Rise: React.FC<{
  at: number;
  children: React.ReactNode;
  distance?: number;
  style?: React.CSSProperties;
}> = ({ at, children, distance = 24, style }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at);
  return (
    <div style={{ opacity: p, translate: `0px ${(1 - p) * distance}px`, ...style }}>{children}</div>
  );
};

/** Left-column headline + subline used by every feature scene. */
export const Caption: React.FC<{ eyebrow: string; title: React.ReactNode; sub: string; at?: number }> = ({
  eyebrow,
  title,
  sub,
  at = 6,
}) => (
  <div style={{ position: "absolute", left: 140, top: 300, width: 680 }}>
    <Rise at={at}>
      <div
        style={{
          fontFamily: body,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: C.primary,
          marginBottom: 22,
        }}
      >
        {eyebrow}
      </div>
    </Rise>
    <Rise at={at + STAGGER}>
      <div style={{ fontFamily: display, fontSize: 62, fontWeight: 800, lineHeight: 1.1, color: C.fg }}>
        {title}
      </div>
    </Rise>
    <Rise at={at + STAGGER * 2}>
      <div style={{ fontFamily: body, fontSize: 28, lineHeight: 1.45, color: C.muted, marginTop: 28 }}>{sub}</div>
    </Rise>
  </div>
);

export const Accent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={gradientText}>{children}</span>
);

/** Card surface with a shadow that lands after the card (follow-through). */
export const Panel: React.FC<{ at: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const p = enter(frame, at, 18);
  const shadow = enter(frame, at + 2, 18);
  return (
    <div
      style={{
        position: "absolute",
        background: `linear-gradient(180deg, ${C.cardRaised}, ${C.card})`,
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        boxShadow: `0 ${30 * shadow}px ${80 * shadow}px hsl(240 80% 3% / ${0.7 * shadow}), inset 0 1px 0 hsl(226 60% 97% / 0.05)`,
        opacity: p,
        translate: `0px ${(1 - p) * 32}px`,
        scale: interpolate(p, [0, 1], [0.97, 1]),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Pill / chip. */
export const Chip: React.FC<{
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, color = C.primary, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 18px",
      borderRadius: 999,
      border: `1px solid ${color.replace(")", " / 0.35)")}`,
      background: color.replace(")", " / 0.1)"),
      color,
      fontFamily: body,
      fontSize: 20,
      fontWeight: 600,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Logo placeholder — the Syrel logo is not designed yet. */
export const LogoPlaceholder: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.28,
      border: `2px dashed ${C.primary.replace(")", " / 0.6)")}`,
      background: `linear-gradient(135deg, hsl(239 100% 82% / 0.15), hsl(258 90% 66% / 0.15))`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: C.primary,
      fontFamily: body,
      fontSize: size * 0.13,
      fontWeight: 600,
      textAlign: "center",
      lineHeight: 1.2,
    }}
  >
    Syrel
    <br />
    logo
  </div>
);

/** Check mark that draws itself (stroke-dashoffset), for success states. */
export const Check: React.FC<{ progress: number; size?: number; color?: string }> = ({
  progress,
  size = 28,
  color = C.success,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={color.replace(")", " / 0.15)")} stroke={color} strokeWidth="1.5" opacity={progress} />
    <path
      d="M7 12.5l3.2 3.2L17 9"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={16}
      strokeDashoffset={16 * (1 - progress)}
    />
  </svg>
);

/** Small spinner for "in progress" states (rotation is the one place linear motion is right). */
export const Spinner: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ rotate: `${frame * 12}deg` }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={C.border} strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

export const Footnote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      right: 60,
      bottom: 40,
      fontFamily: body,
      fontSize: 16,
      color: C.dim,
    }}
  >
    {children}
  </div>
);
