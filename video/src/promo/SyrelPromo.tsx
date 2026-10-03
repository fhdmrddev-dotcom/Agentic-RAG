import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { HERO_FACTS, CONNECTOR_CATALOG } from "../../../frontend/src/landing/facts";
import { Background, LogoPlaceholder } from "../components/ui";
import { body, C, display, gradientText } from "../theme";
import { Sfx, SFX } from "../energetic/kit";
import { Burst, Counter, Flash, Fly3D, MaskReveal, shakeAt, SlamWord, usePortrait, useUnit } from "./fx";
import { ChatCard, ChecksCard, EXPERT_NAMES, ExpertCard, GRANTS, GrantRow, Tile, TILE_NAMES, WorkflowCard } from "./cards";
import { MAP, MUSIC } from "./music";

// Music-driven launch promo — NO narration. Every cut lands on a beat from the beat map; hero hits land
// on downbeats, the drops and the final hit. Counters read REAL numbers from the landing's drift-guarded
// facts.ts (never typed here).
const at = MAP.at;
const BEAT = MAP.beatFrames;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FACTS = {
  providers: HERO_FACTS.providersCount,
  checks: HERO_FACTS.checksCount,
  tools: HERO_FACTS.toolsCount,
  services: CONNECTOR_CATALOG.length,
};

/** Bars of drop 1, each opening with a slammed word, then its product beat. */
const DROP1_BARS = [
  { bar: 3, word: "ASK." },
  { bar: 4, word: "CITED." },
  { bar: 5, word: "AUTOMATE." },
  { bar: 6, word: "CHECKED." },
  { bar: 7, word: "CONNECT." },
  { bar: 8, word: "GRANTED." },
  { bar: 9, word: "EXPERTS." },
  { bar: 10, word: "PROVEN." },
];
const DROP2_WORDS = ["ASK.", "CITE.", "AUTOMATE.", "CHECK.", "CONNECT.", "GRANT.", "INSTALL.", "AUDIT.", "ASK.", "CITE.", "RUN.", "TRUST."];

/** Snare/clap hits (beats 2 & 4 of every drop bar) + heavier hits on drops and the final impact. */
const SNARES: number[] = [];
for (let bar = 3; bar <= 15; bar++) {
  if (bar === 11 || bar === 12) continue;
  SNARES.push(at(bar, 1), at(bar, 3));
}
const IMPACTS = [MAP.drop1, MAP.drop2, MAP.finalHit];

/** Centred stage for cards; portrait gets a little more scale and sits lower (word label above). */
const Stage: React.FC<{ children: React.ReactNode; dy?: number }> = ({ children, dy = 0 }) => {
  const portrait = usePortrait();
  const unit = useUnit();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ scale: (portrait ? 1.25 : 1.5) * unit, translate: `0px ${(portrait ? 120 : 70) + dy}px` }}>{children}</div>
    </AbsoluteFill>
  );
};

/** After the slam, the word shrinks to a label above the product beat. */
const Label: React.FC<{ text: string; from: number; until: number }> = ({ text, from, until }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const unit = useUnit();
  if (frame < from || frame >= until) return null;
  const p = interpolate(frame, [from, from + 5], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: portrait ? "flex-start" : "flex-start", paddingTop: (portrait ? 330 : 90) * unit }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: (portrait ? 120 : 96) * unit, letterSpacing: -3, opacity: p, translate: `0px ${(1 - p) * -30}px`, ...gradientText }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** Beats elapsed since a frame (fractional), for driving per-beat reveals. */
const beatsSince = (frame: number, f0: number) => Math.max(0, (frame - f0) / BEAT);

const Drop1Bar: React.FC<{ bar: number; word: string }> = ({ bar, word }) => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const start = at(bar);
  const end = at(bar + 1);
  const b1 = at(bar, 1);
  if (frame < start || frame >= end) return null;
  const k = beatsSince(frame, b1); // 0 at beat 2 of the bar
  let product: React.ReactNode = null;
  switch (bar) {
    case 3:
      product = (
        <Fly3D from={b1} land={b1 + 8} ry={-55} z={-1000}>
          <ChatCard cites={Math.min(3, 1 + Math.floor(k))} />
        </Fly3D>
      );
      break;
    case 4:
      product = (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
          {["1 · Retention-Report.pdf · p.4", "2 · CS-Interviews.docx · §2", "3 · Churn-by-Segment.xlsx · Sheet 1"].map((t, i) => (
            <Fly3D key={t} from={at(bar, 1 + i)} land={at(bar, 1 + i) + 6} rx={70} z={-600} y={-120}>
              <div
                style={{
                  padding: "18px 30px",
                  borderRadius: 18,
                  background: C.cardRaised,
                  border: "1px solid hsl(239 100% 82% / 0.35)",
                  fontFamily: body,
                  fontSize: 30,
                  color: C.fg,
                  boxShadow: "0 30px 80px hsl(240 80% 3% / 0.7)",
                }}
              >
                {t}
              </div>
            </Fly3D>
          ))}
        </div>
      );
      break;
    case 5:
      product = (
        <Fly3D from={b1} land={b1 + 8} rx={50} z={-900}>
          <WorkflowCard lit={Math.min(5, Math.floor(k * 2) + 1)} />
        </Fly3D>
      );
      break;
    case 6: {
      const passed = Math.round(interpolate(frame, [b1, at(bar, 3)], [0, FACTS.checks], clamp));
      product = (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <Counter to={FACTS.checks} from={b1} land={at(bar, 3)} label="publish checks" size={170} />
          <ChecksCard passed={passed} total={FACTS.checks} />
        </div>
      );
      break;
    }
    case 7:
      product = (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 150px)", gap: 28 }}>
          {TILE_NAMES.map((n, i) => (
            <Fly3D key={n} from={b1 + i * (BEAT / 2)} land={b1 + i * (BEAT / 2) + 6} z={-1400} ry={i % 2 ? 40 : -40}>
              <Tile name={n} />
            </Fly3D>
          ))}
        </div>
      );
      break;
    case 8:
      product = (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {GRANTS.map(([tool, mode], i) => (
            <Fly3D key={tool} from={at(bar, 1 + i)} land={at(bar, 1 + i) + 5} x={i % 2 ? 500 : -500} ry={i % 2 ? -30 : 30} z={-300}>
              <GrantRow tool={tool} mode={mode} />
            </Fly3D>
          ))}
        </div>
      );
      break;
    case 9:
      product = portrait ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {EXPERT_NAMES.map((n, i) => (
            <Fly3D key={n} from={b1 + i * (BEAT / 2)} land={b1 + i * (BEAT / 2) + 6} z={-900} ry={i % 2 ? 35 : -35}>
              <ExpertCard name={n} compact />
            </Fly3D>
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", width: 1240, height: 330 }}>
          {EXPERT_NAMES.map((n, i) => {
            const f0 = b1 + i * (BEAT / 2);
            const off = i - 2;
            return (
              <div key={n} style={{ position: "absolute", left: 495 + off * 250, top: Math.abs(off) * 18 }}>
                <Fly3D from={f0} land={f0 + 6} z={-1200} ry={off * -25}>
                  <div style={{ transform: `rotateY(${off * -12}deg)` }}>
                    <ExpertCard name={n} />
                  </div>
                </Fly3D>
              </div>
            );
          })}
        </div>
      );
      break;
    case 10:
      product = (
        <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: portrait ? 36 : 70, alignItems: portrait ? "center" : "flex-start" }}>
          <Counter to={FACTS.providers} from={b1} land={b1 + 10} label="AI providers" size={150} />
          <Counter to={FACTS.tools} from={at(bar, 2)} land={at(bar, 2) + 10} label="built-in tools" size={150} />
          <Counter to={FACTS.services} from={at(bar, 3)} land={at(bar, 3) + 8} label="connectable services" size={150} />
        </div>
      );
      break;
  }
  return (
    <>
      <SlamWord text={word} at={start} until={b1} accent={bar % 2 === 0} />
      <Label text={word} from={b1} until={end} />
      <Stage dy={bar === 10 ? 20 : 0}>{product}</Stage>
    </>
  );
};

/** The 3D wall of product cards rushing past during drop 2 (speed-ramped after the impact). */
const CardWall: React.FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  if (frame < MAP.drop2 || frame >= MAP.finalHit) return null;
  const t = frame - MAP.drop2;
  // speed ramp: fast right after the drop, easing to cruise, slight rush into the final hit
  const travel = interpolate(t, [0, 20, 150, MAP.finalHit - MAP.drop2], [0, 900, 2000, 2600], clamp);
  const cards = [<ChatCard key="c" />, <WorkflowCard key="w" lit={5} />, <ChecksCard key="k" passed={FACTS.checks} total={FACTS.checks} />];
  const rows = 6;
  return (
    <AbsoluteFill style={{ perspective: 1400, opacity: 0.55 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) rotateX(58deg) translateY(${-travel}px)`,
          transformStyle: "preserve-3d",
          display: "grid",
          gridTemplateColumns: portrait ? "repeat(2, 760px)" : "repeat(3, 760px)",
          gap: 60,
        }}
      >
        {Array.from({ length: rows * (portrait ? 2 : 3) }).map((_, i) => (
          <div key={i}>{cards[i % cards.length]}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const portrait = usePortrait();
  if (frame >= MAP.drop1) return null;
  const antic = interpolate(frame, [at(2, 2), MAP.drop1], [1, 1.12], clamp);
  const fade = interpolate(frame, [MAP.drop1 - 6, MAP.drop1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 * unit, scale: antic, opacity: fade, padding: portrait ? 60 : 0, textAlign: "center" }}>
      <MaskReveal text="Your documents" from={at(1, 1)} to={at(1, 3)} size={portrait ? 120 : 120} />
      <MaskReveal text="know the answer." from={at(2, 0)} to={at(2, 2)} size={portrait ? 120 : 120} accent />
    </AbsoluteFill>
  );
};

const Breakdown: React.FC = () => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const portrait = usePortrait();
  if (frame < MAP.breakdown || frame >= MAP.drop2) return null;
  const zoom = interpolate(frame, [MAP.build, MAP.drop2], [1, 1.28], { ...clamp, easing: (x) => x * x * x });
  const bright = interpolate(frame, [MAP.build, MAP.drop2 - 2], [0, 0.35], clamp);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 * unit, scale: zoom, textAlign: "center", padding: portrait ? 50 : 0 }}>
        <MaskReveal text="Answers from your knowledge." from={MAP.breakdown + 4} to={MAP.breakdown + 40} size={portrait ? 92 : 104} />
        <MaskReveal text="With receipts." from={MAP.build} to={at(12, 3)} size={portrait ? 130 : 150} accent />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: `hsl(239 100% 85% / ${bright})`, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

const Drop2Words: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < MAP.drop2 || frame >= MAP.finalHit) return null;
  const i = Math.floor((frame - MAP.drop2) / BEAT);
  const w = DROP2_WORDS[i % DROP2_WORDS.length];
  const f0 = MAP.drop2 + i * BEAT;
  return <SlamWord text={w} at={f0} until={Math.min(f0 + BEAT, MAP.finalHit)} accent={i % 3 === 2} size={250} />;
};

const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const unit = useUnit();
  const portrait = usePortrait();
  if (frame < MAP.finalHit) return null;
  const d = frame - MAP.finalHit;
  const logo = spring({ frame: d, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  const word = spring({ frame: d - 3, fps, config: { damping: 10, stiffness: 240, mass: 0.6 } });
  const cta = spring({ frame: d - 2 * Math.round(BEAT * 2), fps, config: { damping: 10, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 * unit }}>
      <div style={{ scale: interpolate(logo, [0, 1], [2.2, 1]) * (portrait ? 1.3 : 1), opacity: Math.min(1, logo * 2) }}>
        <LogoPlaceholder size={140} />
      </div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: (portrait ? 230 : 200) * unit, letterSpacing: -6, lineHeight: 1, scale: interpolate(word, [0, 1], [1.8, 1]), opacity: Math.min(1, word * 2), ...gradientText }}>
        Syrel
      </div>
      <div style={{ textAlign: "center", padding: portrait ? "0 40px" : 0 }}>
        <MaskReveal text="Answers from your knowledge. With receipts." from={MAP.finalHit + 18} to={MAP.finalHit + 40} size={portrait ? 52 : 50} color={C.muted} />
      </div>
      <div
        style={{
          marginTop: 10 * unit,
          padding: `${20 * unit}px ${46 * unit}px`,
          borderRadius: 999,
          background: `linear-gradient(100deg, ${C.primary}, ${C.violet})`,
          color: C.bg,
          fontFamily: display,
          fontWeight: 800,
          fontSize: (portrait ? 44 : 34) * unit,
          scale: Math.max(0, cta),
          opacity: interpolate(cta, [0, 0.4], [0, 1], clamp),
          boxShadow: `0 20px 60px hsl(239 100% 70% / 0.45)`,
        }}
      >
        Book a demo
      </div>
    </AbsoluteFill>
  );
};

/** The full promo body on the beat-map timeline. Used by SyrelPromo, SyrelPromoVertical and SyrelTeaser. */
export const PromoBody: React.FC<{ musicSrc?: string }> = ({ musicSrc = MUSIC.src }) => {
  const frame = useCurrentFrame();
  const unit = useUnit();
  const shake = shakeAt(frame, SNARES, 9 * unit, 6);
  const big = shakeAt(frame, IMPACTS, 26 * unit, 10);
  const pulse = frame >= MAP.drop1 && frame < MAP.finalHit ? 1 + 0.012 * Math.exp(-((frame - MAP.drop1) % BEAT) / 3) : 1;
  return (
    <AbsoluteFill>
      <Audio src={staticFile(musicSrc)} volume={1} />
      <Sfx at={MAP.drop1 - 10} src={SFX.whoosh} volume={0.3} />
      <Sfx at={MAP.drop2 - 12} src={SFX.whoosh} volume={0.3} />
      <Background speed={frame >= MAP.drop1 ? 3.5 : 1.5} />
      <AbsoluteFill style={{ translate: `${shake.x + big.x}px ${shake.y + big.y}px`, scale: pulse }}>
        <CardWall />
        <Intro />
        {DROP1_BARS.map((b) => (
          <Drop1Bar key={b.bar} bar={b.bar} word={b.word} />
        ))}
        <Breakdown />
        <Drop2Words />
        <Finale />
      </AbsoluteFill>
      {IMPACTS.map((f) => (
        <React.Fragment key={f}>
          <Flash at={f} />
          <Burst at={f} seed={`i${f}`} />
        </React.Fragment>
      ))}
      <Flash at={MAP.drop2 - 3} color="hsl(0 0% 100%)" frames={3} strength={0.4} />
    </AbsoluteFill>
  );
};

export const PROMO_DURATION = MAP.trackFrames;
export const SyrelPromo: React.FC = () => <PromoBody />;

/** 15 s teaser: intro + the first four drop bars, then a hard cut on a downbeat to the final hit. */
const TEASER_CUT = at(7); // downbeat of bar 7
export const TEASER_DURATION = TEASER_CUT + (MAP.trackFrames - MAP.finalHit);
export const SyrelTeaser: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={TEASER_CUT} name="Intro + drop (bars 1-6)">
      <PromoBody />
    </Sequence>
    <Sequence from={TEASER_CUT} name="Final hit (bar 16)">
      <Sequence from={-MAP.finalHit} layout="none">
        <PromoBody />
      </Sequence>
    </Sequence>
  </AbsoluteFill>
);
