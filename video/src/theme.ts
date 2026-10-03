import { Easing, interpolate } from "remotion";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Fonts match the app (frontend/src/index.css): Manrope for display, Inter for body.
export const display = loadManrope("normal", { weights: ["600", "700", "800"], subsets: ["latin"] }).fontFamily;
export const body = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;

// "Deep Midnight" dark tokens, converted from frontend/src/index.css (.dark).
export const C = {
  bg: "hsl(216 45% 4%)",
  card: "hsl(220 30% 7%)",
  cardRaised: "hsl(220 28% 10%)",
  fg: "hsl(226 60% 97%)",
  muted: "hsl(220 16% 65%)",
  dim: "hsl(220 14% 45%)",
  border: "hsl(220 20% 16%)",
  primary: "hsl(239 100% 82%)",
  violet: "hsl(258 90% 66%)",
  violetText: "hsl(258 95% 84%)",
  success: "hsl(152 60% 52%)",
  warn: "hsl(38 92% 60%)",
  danger: "hsl(0 72% 62%)",
};

export const gradientText: React.CSSProperties = {
  backgroundImage: `linear-gradient(100deg, ${C.primary}, ${C.violetText})`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

// Brand motion identity (motion-design skill, "Premium" archetype):
// one signature entrance curve, one exit curve, three durations.
export const EASE_IN = Easing.bezier(0.16, 1, 0.3, 1); // entrances: decelerate
export const EASE_OUT = Easing.bezier(0.3, 0, 1, 1); // exits: accelerate
export const EASE_MOVE = Easing.bezier(0.4, 0, 0.2, 1); // on-screen moves
export const QUICK = 9; // 300 ms @ 30 fps
export const STANDARD = 15; // 500 ms
export const SLOW = 24; // 800 ms
export const STAGGER = 3; // 100 ms between siblings; keep total < 500 ms

/** 0 → 1 progress for an entrance starting at `start`. */
export const enter = (frame: number, start: number, dur = STANDARD) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_IN,
  });

/** 1 → 0 progress for an exit starting at `start` (exits are shorter than entrances). */
export const exit = (frame: number, start: number, dur = QUICK) =>
  interpolate(frame, [start, start + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
