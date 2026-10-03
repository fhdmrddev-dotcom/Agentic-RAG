import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Background } from "./components/ui";
import { Opening } from "./scenes/Opening";
import { AskAndCite } from "./scenes/AskAndCite";
import { AgentWorks } from "./scenes/AgentWorks";
import { Workflows } from "./scenes/Workflows";
import { Connected } from "./scenes/Connected";
import { Experts } from "./scenes/Experts";
import { Close } from "./scenes/Close";

export const TRANSITION = 15;
export const SCENES = {
  opening: 150,
  ask: 300,
  agent: 330,
  workflows: 380,
  connected: 300,
  experts: 300,
  close: 210,
};
export const OVERVIEW_DURATION =
  Object.values(SCENES).reduce((a, b) => a + b, 0) - TRANSITION * (Object.keys(SCENES).length - 1);

const t = () => <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />;

// The ambient background sits outside the series so it flows continuously across cuts.
export const SyrelOverview: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence name="Opening" durationInFrames={150} premountFor={fps}>
          <Opening />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Ask and cite" durationInFrames={300} premountFor={fps}>
          <AskAndCite />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Agent works" durationInFrames={330} premountFor={fps}>
          <AgentWorks />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Workflows" durationInFrames={380} premountFor={fps}>
          <Workflows />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Connected" durationInFrames={300} premountFor={fps}>
          <Connected />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Experts" durationInFrames={300} premountFor={fps}>
          <Experts />
        </TransitionSeries.Sequence>
        {t()}
        <TransitionSeries.Sequence name="Close" durationInFrames={210} premountFor={fps}>
          <Close />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
