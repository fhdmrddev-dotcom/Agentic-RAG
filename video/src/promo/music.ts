import * as BM from "./beatMap";

/**
 * The promo's soundtrack and the frame map the picture locks to.
 *
 * Default: the original, synthesized "Syrel Pulse" (tools/make_music.py → public/music/syrel-pulse.wav).
 * To use a free library track instead (Pixabay Music, YouTube Audio Library): put the file in
 * public/music/, set `src`, its `bpm`, and `offsetS` = seconds from the file start to the first
 * downbeat. The promos assume the same 16-bar shape (2-bar intro, drop at bar 3, breakdown bar 11,
 * build bar 12, drop 2 at bar 13, final hit at bar 16), so pick a track whose sections land there or
 * edit the section bars below.
 */
export const MUSIC = {
  src: "music/syrel-pulse.wav",
  bpm: BM.BPM,
  offsetS: BM.OFFSET_S,
  sections: { drop1: 3, breakdown: 11, build: 12, drop2: 13, finalHit: 16, bars: 16 },
  tailS: 1.5,
} as const;

export const FPS = 30;

export const makeBeatMap = (bpm: number, offsetS: number, s = MUSIC.sections, tailS = MUSIC.tailS) => {
  const beatS = 60 / bpm;
  /** Frame of bar N (1-based), plus an optional beat offset (0-3.x). */
  const at = (bar: number, beat = 0) => Math.round((offsetS + ((bar - 1) * 4 + beat) * beatS) * FPS);
  return {
    at,
    beatFrames: beatS * FPS,
    barFrames: 4 * beatS * FPS,
    drop1: at(s.drop1),
    breakdown: at(s.breakdown),
    build: at(s.build),
    drop2: at(s.drop2),
    finalHit: at(s.finalHit),
    trackFrames: Math.round((offsetS + s.bars * 4 * beatS + tailS) * FPS),
  };
};

export const MAP = makeBeatMap(MUSIC.bpm, MUSIC.offsetS);

// The generated map and the computed one must agree for the default track (checked at module load,
// so a drift between tools/make_music.py and this file fails the render loudly instead of desyncing).
if (MUSIC.src.endsWith("syrel-pulse.wav")) {
  const pairs: [string, number, number][] = [
    ["drop1", MAP.drop1, BM.DROP_1],
    ["build", MAP.build, BM.BUILD],
    ["drop2", MAP.drop2, BM.DROP_2],
    ["finalHit", MAP.finalHit, BM.FINAL_HIT],
  ];
  for (const [k, a, b] of pairs) {
    if (a !== b) throw new Error(`beat map drift: ${k} computed ${a} vs generated ${b}`);
  }
}
