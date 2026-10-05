import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Background } from "../components/ui";
import { body, C } from "../theme";
import { AudioOn, SweepOverlay, zoomThrough } from "../energetic/kit";
import { AMBIENT_SPEED } from "../energetic/theme";
import { E_SCENES, ENERGETIC_DURATION, VO_FRAMES, type EnergeticProps } from "../energetic/SyrelEnergetic";
import { EOpening } from "../energetic/scenes/EOpening";
import { EAsk } from "../energetic/scenes/EAsk";
import { EWork } from "../energetic/scenes/EWork";
import { EWorkflows } from "../energetic/scenes/EWorkflows";
import { EConnect } from "../energetic/scenes/EConnect";
import { EExperts } from "../energetic/scenes/EExperts";
import { EClose } from "../energetic/scenes/EClose";

/**
 * 9:16 cut of the energetic overview for LinkedIn / Shorts. It RE-LAYS-OUT each 16:9 scene instead of
 * cropping it: the caption region (left of the landscape frame) is lifted to the top, enlarged, and the
 * product visual (right of the frame) is stacked underneath. The scene renders twice — once per region —
 * so the second copy runs with `AudioOn=false` and the voice/SFX play once. Same timing as SyrelEnergetic.
 */
export const VERTICAL_DURATION = ENERGETIC_DURATION;
const W = 1920;
const H = 1080;

/** Shows the rectangle (x, y, w, h) of a 1920×1080 scene at (toX, toY), scaled. */
const Region: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  toX: number;
  toY: number;
  scale: number;
  audio: boolean;
  children: React.ReactNode;
}> = ({ x, y, w, h, toX, toY, scale, audio, children }) => (
  <div style={{ position: "absolute", left: toX, top: toY, width: w * scale, height: h * scale, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: -x * scale, top: -y * scale, width: W, height: H, scale, transformOrigin: "0 0" }}>
      <AudioOn.Provider value={audio}>{children}</AudioOn.Provider>
    </div>
  </div>
);

const Note: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center", fontFamily: body, fontSize: 22, color: C.dim }}>
    Illustrative example
  </div>
);

/** Feature scene: caption on top, product visual below. */
const Stack: React.FC<{ children: React.ReactNode; note?: boolean }> = ({ children, note = true }) => (
  <AbsoluteFill>
    <Region x={100} y={270} w={760} h={600} toX={46} toY={150} scale={1.3} audio>
      {children}
    </Region>
    <Region x={845} y={90} w={980} h={900} toX={35} toY={790} scale={1.03} audio={false}>
      {children}
    </Region>
    {note ? <Note /> : null}
  </AbsoluteFill>
);

/** Centred scene (opening / close): the whole middle band, scaled to fit the width. */
const Centre: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <Region x={230} y={0} w={1460} h={1080} toX={0} toY={560} scale={0.74} audio>
      {children}
    </Region>
  </AbsoluteFill>
);

const T_ZOOM = 10;
const T_SLIDE = 9;
const T_WIPE = 9;

export const SyrelEnergeticVertical: React.FC<EnergeticProps> = ({ musicSrc }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background speed={AMBIENT_SPEED} />
      {musicSrc ? <Audio src={staticFile(`music/${musicSrc}`)} volume={0.15} loop /> : null}
      <TransitionSeries>
        <TransitionSeries.Sequence name="Opening" durationInFrames={E_SCENES.opening} premountFor={fps}>
          <Centre>
            <EOpening duration={E_SCENES.opening} voFrames={VO_FRAMES[0]} />
          </Centre>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={zoomThrough()} timing={linearTiming({ durationInFrames: T_ZOOM })} />
        <TransitionSeries.Sequence name="Ask" durationInFrames={E_SCENES.ask} premountFor={fps}>
          <Stack>
            <EAsk duration={E_SCENES.ask} voFrames={VO_FRAMES[1]} />
          </Stack>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T_SLIDE })} />
        <TransitionSeries.Sequence name="Work" durationInFrames={E_SCENES.work} premountFor={fps}>
          <Stack>
            <EWork duration={E_SCENES.work} voFrames={VO_FRAMES[2]} />
          </Stack>
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={14} premountFor={fps}>
          <SweepOverlay />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Workflows" durationInFrames={E_SCENES.workflows} premountFor={fps}>
          <Stack note={false}>
            <EWorkflows duration={E_SCENES.workflows} voFrames={VO_FRAMES[3]} />
          </Stack>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: T_WIPE })} />
        <TransitionSeries.Sequence name="Connect" durationInFrames={E_SCENES.connect} premountFor={fps}>
          <Stack note={false}>
            <EConnect duration={E_SCENES.connect} voFrames={VO_FRAMES[4]} />
          </Stack>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={linearTiming({ durationInFrames: T_SLIDE })} />
        <TransitionSeries.Sequence name="Experts" durationInFrames={E_SCENES.experts} premountFor={fps}>
          <Stack>
            <EExperts duration={E_SCENES.experts} voFrames={VO_FRAMES[5]} />
          </Stack>
        </TransitionSeries.Sequence>
        <TransitionSeries.Overlay durationInFrames={16} premountFor={fps}>
          <SweepOverlay />
        </TransitionSeries.Overlay>
        <TransitionSeries.Sequence name="Close" durationInFrames={E_SCENES.close} premountFor={fps}>
          <Centre>
            <EClose duration={E_SCENES.close} voFrames={VO_FRAMES[6]} />
          </Centre>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
