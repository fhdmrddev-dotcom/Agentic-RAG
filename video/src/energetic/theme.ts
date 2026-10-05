import { Easing, interpolate, spring } from "remotion";

// Energetic archetype (motion-design skill): 100–250 ms, ease-out-expo entrances,
// 15–30% overshoot reserved for hero pops, exits faster than entrances.
export const EXPO_IN = Easing.bezier(0.19, 1, 0.22, 1); // entrances: ease-out-expo
export const EXPO_OUT = Easing.bezier(0.7, 0, 0.84, 0); // exits: ease-in-expo
export const F_QUICK = 4; // ~130 ms
export const F_STD = 7; // ~230 ms
export const F_SLOW = 10; // ~330 ms (hero only)
export const F_STAGGER = 2; // ~67 ms; keep cascades under 500 ms
export const AMBIENT_SPEED = 2.5;
export const PUSH_IN = 1.04;

/** 0 → 1 with ease-out-expo. */
export const punch = (frame: number, start: number, dur = F_STD) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EXPO_IN,
  });

/** 1 → 0 with ease-in-expo (exits are shorter). */
export const cut = (frame: number, start: number, dur = F_QUICK) =>
  interpolate(frame, [start, start + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EXPO_OUT,
  });

/** Hero pop: underdamped spring, ~20% overshoot. Use only on hero elements. */
export const pop = (frame: number, start: number, fps: number) =>
  spring({ frame: frame - start, fps, config: { damping: 9, stiffness: 200, mass: 0.6 } });
