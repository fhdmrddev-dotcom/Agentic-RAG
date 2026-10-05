import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Background } from "../components/ui";
import { SweepOverlay, zoomThrough } from "./kit";
import { AMBIENT_SPEED } from "./theme";
import { VO_SECONDS } from "./voTimings";
import { EOpening } from "./scenes/EOpening";
import { EAsk } from "./scenes/EAsk";
import { EWork } from "./scenes/EWork";
import { EWorkflows } from "./scenes/EWorkflows";
import { EConnect } from "./scenes/EConnect";
import { EExperts } from "./scenes/EExperts";
import { EClose } from "./scenes/EClose";

const FPS = 30;
/** Speech length per beat, in frames (from tools/make_vo.py). */
export const VO_FRAMES = VO_SECONDS.map((s) => Math.ceil(s * FPS));

// Each scene = its voice line + ~0.6 s of air (+ room for the visuals to land), never shorter
// than the visual beat needs. Opening/Close start their line at frame 4, the rest at 6.
const PAD = 30;
export const E_SCENES = {
  opening: Math.max(150, VO_FRAMES[0] + 4 + 60), // brand reveal lands as the hook ends, then holds
  ask: Math.max(180, VO_FRAMES[1] + PAD),
  work: Math.max(170, VO_FRAMES[2] + PAD),
  workflows: Math.max(170, VO_FRAMES[3] + PAD),
  connect: Math.max(165, VO_FRAMES[4] + PAD),
  experts: Math.max(150, VO_FRAMES[5] + PAD),
  close: Math.max(150, VO_FRAMES[6] + 4 + 45),
};
const T_ZOOM = 10;
const T_SLIDE = 9;
const T_WIPE = 9;
export const ENERGETIC_DURATION =
  Object.values(E_SCENES).reduce((a, b) => a + b, 0) - (T_ZOOM + T_SLIDE + T_WIPE + T_SLIDE);

export type EnergeticProps = { musicSrc: string | null };

export const SyrelEnergetic: React.FC<EnergeticProps> = ({ musicSrc }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background speed={AMBIENT_SPEED} />
      {musicSrc ? <Audio src={staticFile(`music/${musicSrc}`)} volume={0.15} loop /> : null}
      <TransitionSeries>
        <TransitionSeries.Sequence name="Opening" durationInFrames={E_SCENES.opening} premountFor={fps}>
          <EOpening duration={E_SCENES.opening} voFrames={VO_FRAMES[0]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={zoomThrough()} timing={linearTiming({ durationInFrames: T_ZOOM })} />
        <TransitionSeries.Sequence name="Ask" durationInFrames={E_SCENES.ask} premountFor={fps}>
          <EAsk duration={E_SCENES.ask} voFrames={VO_FRAMES[1]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T_SLIDE })} />
        <TransitionSeries.Sequence name="Work" durationInFrames={E_SCENES.work} premountFor={fps}>
          <EWork duration={E_SCENES.work} voFrames={VO_FRAMES[2]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={14} premountFor={fps}>
          <SweepOverlay />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Workflows" durationInFrames={E_SCENES.workflows} premountFor={fps}>
          <EWorkflows duration={E_SCENES.workflows} voFrames={VO_FRAMES[3]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: T_WIPE })} />
        <TransitionSeries.Sequence name="Connect" durationInFrames={E_SCENES.connect} premountFor={fps}>
          <EConnect duration={E_SCENES.connect} voFrames={VO_FRAMES[4]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={linearTiming({ durationInFrames: T_SLIDE })} />
        <TransitionSeries.Sequence name="Experts" durationInFrames={E_SCENES.experts} premountFor={fps}>
          <EExperts duration={E_SCENES.experts} voFrames={VO_FRAMES[5]} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={16} premountFor={fps}>
          <SweepOverlay />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Close" durationInFrames={E_SCENES.close} premountFor={fps}>
          <EClose duration={E_SCENES.close} voFrames={VO_FRAMES[6]} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
