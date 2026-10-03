import React from "react";
import { AbsoluteFill, Composition, Folder } from "remotion";
import { Background } from "./components/ui";
import { OVERVIEW_DURATION, SCENES, SyrelOverview } from "./SyrelOverview";
import { Opening } from "./scenes/Opening";
import { AskAndCite } from "./scenes/AskAndCite";
import { AgentWorks } from "./scenes/AgentWorks";
import { Workflows } from "./scenes/Workflows";
import { Connected } from "./scenes/Connected";
import { Experts } from "./scenes/Experts";
import { Close } from "./scenes/Close";

const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

// Standalone scene previews get the same ambient background as the full video.
const withBg = (Scene: React.FC): React.FC => () => (
  <AbsoluteFill>
    <Background />
    <Scene />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SyrelOverview" component={SyrelOverview} durationInFrames={OVERVIEW_DURATION} {...VIDEO} />
    <Folder name="Scenes">
      <Composition id="Opening" component={withBg(Opening)} durationInFrames={SCENES.opening} {...VIDEO} />
      <Composition id="AskAndCite" component={withBg(AskAndCite)} durationInFrames={SCENES.ask} {...VIDEO} />
      <Composition id="AgentWorks" component={withBg(AgentWorks)} durationInFrames={SCENES.agent} {...VIDEO} />
      <Composition id="Workflows" component={withBg(Workflows)} durationInFrames={SCENES.workflows} {...VIDEO} />
      <Composition id="Connected" component={withBg(Connected)} durationInFrames={SCENES.connected} {...VIDEO} />
      <Composition id="Experts" component={withBg(Experts)} durationInFrames={SCENES.experts} {...VIDEO} />
      <Composition id="Close" component={withBg(Close)} durationInFrames={SCENES.close} {...VIDEO} />
    </Folder>
  </>
);
