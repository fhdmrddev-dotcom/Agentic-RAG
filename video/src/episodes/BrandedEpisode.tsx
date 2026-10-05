import React from "react";
import { Video } from "@remotion/media";
import { ALL_FORMATS, Input, UrlSource } from "mediabunny";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background, LogoPlaceholder } from "../components/ui";
import { body, C, display, gradientText } from "../theme";
import { PunchLine, Sfx, SFX } from "../energetic/kit";
import { pop, punch } from "../energetic/theme";

/**
 * Wraps a NotebookLM video (documentary or explainer) in Syrel branding:
 * ~3 s intro card → the NotebookLM video full-frame (title lower-third for its first seconds) → ~4 s outro.
 * The source lives in public/notebooklm/ (git-ignored: large files exported from NotebookLM).
 */
export type BrandedEpisodeProps = {
  /** File under public/, e.g. "notebooklm/explainer-workflows-you-can-trust.mp4". */
  src: string;
  /** e.g. "Episode 1 · Chapter 1" or "Explainer". */
  episodeLabel: string;
  title: string;
  /** "Syrel: The Build Story" (documentaries) or "Syrel Explainers". */
  series: string;
};

const FPS = 30;
export const INTRO = 90;
export const OUTRO = 120;
const OVERLAP = 12; // the video fades in under the end of the intro card

export const calculateEpisodeMetadata: CalculateMetadataFunction<BrandedEpisodeProps> = async ({ props }) => {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(staticFile(props.src)) });
  const seconds = await input.computeDuration();
  input.dispose();
  const videoFrames = Math.floor(seconds * FPS);
  return {
    durationInFrames: INTRO - OVERLAP + videoFrames + OUTRO - OVERLAP,
    props: { ...props, videoFrames } as BrandedEpisodeProps,
  };
};

const IntroCard: React.FC<Omit<BrandedEpisodeProps, "src">> = ({ series, episodeLabel, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = pop(frame, 4, fps);
  const s = punch(frame, 10, 8);
  const out = interpolate(frame, [INTRO - OVERLAP, INTRO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Background speed={2} />
      <Sfx at={2} src={SFX.whoosh} volume={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <div style={{ scale: logo, opacity: Math.min(1, logo) }}>
          <LogoPlaceholder size={110} />
        </div>
        <div style={{ fontFamily: body, fontSize: 26, fontWeight: 700, letterSpacing: 6, textTransform: "uppercase", color: C.primary, opacity: s }}>
          {series} · {episodeLabel}
        </div>
        <PunchLine text={title} at={16} size={92} align="center" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const LowerThird: React.FC<{ series: string; title: string }> = ({ series, title }) => {
  const frame = useCurrentFrame();
  const inP = punch(frame, 10, 10);
  const outP = interpolate(frame, [130, 145], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        bottom: 64,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 26px 16px 18px",
        borderRadius: 18,
        background: "hsl(216 45% 4% / 0.82)",
        border: "1px solid hsl(239 100% 82% / 0.35)",
        boxShadow: "0 20px 60px hsl(240 80% 3% / 0.6)",
        opacity: inP * outP,
        translate: `${(1 - inP) * -40}px 0px`,
      }}
    >
      <LogoPlaceholder size={52} />
      <div>
        <div style={{ fontFamily: body, fontSize: 18, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: C.primary }}>{series}</div>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 800, color: C.fg, marginTop: 2 }}>{title}</div>
      </div>
    </div>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const word = pop(frame, 10, fps);
  const tag = punch(frame, 20, 10);
  const cta = pop(frame, 34, fps);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Background speed={2} />
      <Sfx at={34} src={SFX.ding} volume={0.3} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <LogoPlaceholder size={110} />
        <div style={{ fontFamily: display, fontSize: 150, fontWeight: 800, letterSpacing: -4, lineHeight: 1, scale: word, ...gradientText }}>Syrel</div>
        <div style={{ fontFamily: body, fontSize: 40, color: C.fg, opacity: tag }}>
          Answers from your knowledge. <span style={{ color: C.muted }}>With receipts.</span>
        </div>
        <div
          style={{
            marginTop: 10,
            padding: "18px 40px",
            borderRadius: 999,
            background: `linear-gradient(100deg, ${C.primary}, ${C.violet})`,
            color: C.bg,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 30,
            scale: cta,
            opacity: interpolate(cta, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Book a demo
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const BrandedEpisode: React.FC<BrandedEpisodeProps & { videoFrames?: number }> = ({
  src,
  episodeLabel,
  title,
  series,
  videoFrames = 300,
}) => {
  const { fps } = useVideoConfig();
  const videoStart = INTRO - OVERLAP;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Sequence name="Episode video" from={videoStart} durationInFrames={videoFrames} premountFor={fps}>
        <AbsoluteFill>
          <Video src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <LowerThird series={series} title={title} />
        </AbsoluteFill>
      </Sequence>
      <Sequence name="Intro" durationInFrames={INTRO} premountFor={fps}>
        <IntroCard series={series} episodeLabel={episodeLabel} title={title} />
      </Sequence>
      <Sequence name="Outro" from={videoStart + videoFrames - OVERLAP} durationInFrames={OUTRO} premountFor={fps}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
