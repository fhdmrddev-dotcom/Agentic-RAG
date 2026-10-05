import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Background, LogoPlaceholder } from "../components/ui";
import { body, C, display, gradientText } from "../theme";
import { PunchLine, PushIn, Sfx, SFX } from "../energetic/kit";
import { AMBIENT_SPEED, pop, punch } from "../energetic/theme";
import type { SceneProps } from "../energetic/scenes/EOpening";
import { EAsk } from "../energetic/scenes/EAsk";
import { ELibrary } from "../energetic/scenes/ELibrary";
import { EWorkflows } from "../energetic/scenes/EWorkflows";
import { EConnect } from "../energetic/scenes/EConnect";
import { EExperts } from "../energetic/scenes/EExperts";
import { EAdmin } from "../energetic/scenes/EAdmin";
import { CLIP_VO_SECONDS, type ClipId } from "./clipTimings";

// One 15–20 s clip per docs guide (Phase 276). Title card → the feature scene with its own voice
// line → end card. Scenes are the energetic overview scenes, re-voiced with `vo`.
export const CLIPS: Record<ClipId, { title: string; guide: string; Scene: React.FC<SceneProps> }> = {
  chat: { title: "Chat with your *knowledge*", guide: "Use Syrel › Chat", Scene: EAsk },
  library: { title: "Library & *documents*", guide: "Use Syrel › Library", Scene: ELibrary },
  workflows: { title: "Workflows you can *trust*", guide: "Automate › Workflows", Scene: EWorkflows },
  connections: { title: "Connect *every tool*", guide: "Connect › Overview", Scene: EConnect },
  experts: { title: "Experts for *every team*", guide: "Experts › Overview", Scene: EExperts },
  admin: { title: "The *Control Room*", guide: "Administer › Control Room", Scene: EAdmin },
};

const FPS = 30;
export const TITLE = 45;
export const END = 100;
const T = 9;
export const clipSceneFrames = (id: ClipId) => Math.max(330, Math.ceil(CLIP_VO_SECONDS[id] * FPS) + 6 + 45);
export const clipDuration = (id: ClipId) => TITLE + clipSceneFrames(id) + END - 2 * T;

const TitleCard: React.FC<{ title: string; guide: string }> = ({ title, guide }) => {
  const frame = useCurrentFrame();
  const e = punch(frame, 2, 5);
  return (
    <PushIn duration={TITLE}>
      <Sfx at={1} src={SFX.whoosh} volume={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <div style={{ fontFamily: body, fontSize: 24, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", color: C.primary, opacity: e }}>
          Syrel guide · {guide}
        </div>
        <PunchLine text={title} at={4} size={110} align="center" />
      </AbsoluteFill>
    </PushIn>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = pop(frame, 4, fps);
  const word = pop(frame, 8, fps);
  const sub = punch(frame, 16, 8);
  const cta = pop(frame, 26, fps);
  return (
    <PushIn duration={END}>
      <Sfx at={26} src={SFX.ding} volume={0.3} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <div style={{ scale: logo, opacity: Math.min(1, logo) }}>
          <LogoPlaceholder size={110} />
        </div>
        <div style={{ fontFamily: display, fontSize: 140, fontWeight: 800, letterSpacing: -4, lineHeight: 1, scale: word, ...gradientText }}>Syrel</div>
        <div style={{ fontFamily: body, fontSize: 34, color: C.muted, opacity: sub, translate: `0px ${(1 - sub) * 16}px` }}>
          Read the full guide in the Syrel docs.
        </div>
        <div
          style={{
            marginTop: 12,
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
    </PushIn>
  );
};

export const FeatureClip: React.FC<{ id: ClipId }> = ({ id }) => {
  const { fps } = useVideoConfig();
  const { title, guide, Scene } = CLIPS[id];
  const sceneFrames = clipSceneFrames(id);
  return (
    <AbsoluteFill>
      <Background speed={AMBIENT_SPEED} />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Title" durationInFrames={TITLE} premountFor={fps}>
          <TitleCard title={title} guide={guide} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name={`Scene · ${id}`} durationInFrames={sceneFrames} premountFor={fps}>
          <Scene duration={sceneFrames} voFrames={Math.ceil(CLIP_VO_SECONDS[id] * FPS)} vo={`vo/clip-${id}.wav`} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: T })} />
        <TransitionSeries.Sequence name="End" durationInFrames={END} premountFor={fps}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
