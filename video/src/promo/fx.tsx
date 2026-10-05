import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, display, gradientText } from "../theme";
import { EXPO_IN } from "../energetic/theme";

// Promo motion vocabulary (motion-design skill: Energetic). Everything is a pure function of the
// frame, so every hit can be placed exactly on a beat-map frame.

export const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Scale factor so type sized for 1080-high landscape also fits 1080-wide portrait. */
export const useUnit = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Full-screen word that SLAMS in on a kick: big → settle (spring overshoot), blur clears, exits fast. */
export const SlamWord: React.FC<{ text: string; at: number; until: number; accent?: boolean; size?: number; y?: number }> = ({
  text,
  at,
  until,
  accent = false,
  size = 230,
  y = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const unit = useUnit();
  if (frame < at || frame >= until) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 260, mass: 0.5 } });
  const scale = interpolate(s, [0, 1], [1.9, 1]);
  const blur = interpolate(frame - at, [0, 4], [14, 0], clamp);
  const out = interpolate(frame, [until - 3, until], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: display,
          fontWeight: 800,
          fontSize: size * unit,
          letterSpacing: -6 * unit,
          lineHeight: 1,
          translate: `0px ${y * unit}px`,
          scale: scale * interpolate(out, [0, 1], [0.92, 1]),
          opacity: Math.min(1, 0.7 + s) * out, // visible ON the beat frame
          filter: `blur(${blur}px)`,
          color: C.fg,
          textShadow: accent ? undefined : `0 0 ${60 * unit}px hsl(239 100% 70% / 0.35)`,
          ...(accent ? gradientText : {}),
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Colour-flash frame(s) on an impact. */
export const Flash: React.FC<{ at: number; color?: string; frames?: number; strength?: number }> = ({
  at,
  color = "hsl(239 100% 90%)",
  frames = 6,
  strength = 0.85,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 1, at, at + frames], [0, strength, 0], clamp); // peak ON the beat frame
  if (o <= 0) return null;
  return <AbsoluteFill style={{ backgroundColor: color, opacity: o, mixBlendMode: "screen" }} />;
};

/** Camera shake (px offset) from a list of hit frames — short, decaying, deterministic. */
export const shakeAt = (frame: number, hits: number[], amp = 14, frames = 7) => {
  let x = 0;
  let y = 0;
  for (const h of hits) {
    const d = frame - h;
    if (d >= 0 && d < frames) {
      const k = (1 - d / frames) * amp;
      x += (random(`sx${h}-${d}`) - 0.5) * 2 * k;
      y += (random(`sy${h}-${d}`) - 0.5) * 2 * k;
    }
  }
  return { x, y };
};

/** Radial glow + particle burst from the centre on a hit. */
export const Burst: React.FC<{ at: number; count?: number; seed?: string; hue?: number }> = ({ at, count = 36, seed = "b", hue = 245 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const d = frame - at;
  if (d < 0 || d > 40) return null;
  const p = interpolate(d, [0, 40], [0, 1], { ...clamp, easing: EXPO_IN });
  const glow = interpolate(d, [0, 3, 30], [0, 0.9, 0], clamp);
  const r = Math.max(width, height);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(${hue} 100% 75% / ${glow}) 0%, transparent ${30 + 40 * p}%)`,
        }}
      />
      {Array.from({ length: count }).map((_, i) => {
        const ang = random(`${seed}a${i}`) * Math.PI * 2;
        const dist = (0.15 + random(`${seed}d${i}`) * 0.5) * r * p;
        const size = 4 + random(`${seed}s${i}`) * 8;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: width / 2 + Math.cos(ang) * dist,
              top: height / 2 + Math.sin(ang) * dist,
              width: size,
              height: size,
              borderRadius: size,
              background: i % 3 ? C.primary : C.violetText,
              opacity: 1 - p,
              boxShadow: `0 0 ${size * 2}px ${C.primary}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Number that ticks from 0 to `to` between two frames, with a label; pops on arrival. */
export const Counter: React.FC<{ to: number; from: number; land: number; label: string; size?: number }> = ({
  to,
  from,
  land,
  label,
  size = 200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const unit = useUnit();
  const v = Math.round(interpolate(frame, [from, land], [0, to], { ...clamp, easing: EXPO_IN }));
  const pop = frame >= land ? spring({ frame: frame - land, fps, config: { damping: 9, stiffness: 220, mass: 0.5 } }) : 0;
  const appear = interpolate(frame, [from, from + 4], [0, 1], clamp);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: appear }}>
      <div
        style={{
          fontFamily: display,
          fontWeight: 800,
          fontSize: size * unit,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          scale: 1 + 0.12 * pop * (1 - Math.min(1, (frame - land) / 12)),
          ...gradientText,
        }}
      >
        {v}
      </div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 40 * unit, color: C.muted, marginTop: 8 * unit, textTransform: "uppercase", letterSpacing: 4 * unit }}>
        {label}
      </div>
    </div>
  );
};

/** Mask reveal: text wipes in left→right behind a clip-path, with a light edge. */
export const MaskReveal: React.FC<{ text: string; from: number; to: number; size?: number; color?: string; accent?: boolean }> = ({
  text,
  from,
  to,
  size = 110,
  color = C.fg,
  accent = false,
}) => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const p = interpolate(frame, [from, to], [0, 100], { ...clamp, easing: EXPO_IN });
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        style={{
          fontFamily: display,
          fontWeight: 800,
          fontSize: size * unit,
          lineHeight: 1.1,
          color,
          clipPath: `inset(0 ${100 - p}% 0 0)`,
          ...(accent ? gradientText : {}),
        }}
      >
        {text}
      </div>
      {p > 0 && p < 100 ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${p}%`,
            width: 6 * unit,
            background: C.primary,
            boxShadow: `0 0 ${30 * unit}px ${C.primary}`,
          }}
        />
      ) : null}
    </div>
  );
};

/** 3D card flight: rotates/flies from depth into place over [from, land], with a spring settle. */
export const Fly3D: React.FC<{
  from: number;
  land: number;
  rx?: number;
  ry?: number;
  z?: number;
  x?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ from, land, rx = 0, ry = -45, z = -900, x = 0, y = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from) return null;
  const s = spring({ frame: frame - from, fps, durationInFrames: Math.max(6, land - from), config: { damping: 13, stiffness: 170 } });
  return (
    <div style={{ perspective: 1600, ...style }}>
      <div
        style={{
          transform: `translate3d(${x * (1 - s)}px, ${y * (1 - s)}px, ${z * (1 - s)}px) rotateX(${rx * (1 - s)}deg) rotateY(${ry * (1 - s)}deg)`,
          opacity: Math.min(1, s * 2),
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </div>
  );
};
