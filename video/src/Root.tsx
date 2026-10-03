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
import { E_SCENES, ENERGETIC_DURATION, SyrelEnergetic, VO_FRAMES } from "./energetic/SyrelEnergetic";
import { AMBIENT_SPEED } from "./energetic/theme";
import { EOpening, type SceneProps } from "./energetic/scenes/EOpening";
import { EAsk } from "./energetic/scenes/EAsk";
import { EWork } from "./energetic/scenes/EWork";
import { EWorkflows } from "./energetic/scenes/EWorkflows";
import { EConnect } from "./energetic/scenes/EConnect";
import { EExperts } from "./energetic/scenes/EExperts";
import { EClose } from "./energetic/scenes/EClose";
import { clipDuration, FeatureClip } from "./clips/FeatureClip";
import { SyrelEnergeticVertical, VERTICAL_DURATION } from "./vertical/SyrelEnergeticVertical";
import { BrandedEpisode, calculateEpisodeMetadata } from "./episodes/BrandedEpisode";
import { PROMO_DURATION, SyrelPromo, SyrelTeaser, TEASER_DURATION } from "./promo/SyrelPromo";

const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

// Standalone scene previews get the same ambient background as the full video.
const withBg = (Scene: React.FC): React.FC => () => (
  <AbsoluteFill>
    <Background />
    <Scene />
  </AbsoluteFill>
);

// Energetic scene previews: fast ambient background + the scene's own timing props.
const withFastBg = (Scene: React.FC<SceneProps>, duration: number, voFrames: number): React.FC => () => (
  <AbsoluteFill>
    <Background speed={AMBIENT_SPEED} />
    <Scene duration={duration} voFrames={voFrames} />
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
    <Composition
      id="SyrelEnergetic"
      component={SyrelEnergetic}
      durationInFrames={ENERGETIC_DURATION}
      defaultProps={{ musicSrc: null }}
      {...VIDEO}
    />
    <Folder name="Energetic-scenes">
      <Composition id="E-Opening" component={withFastBg(EOpening, E_SCENES.opening, VO_FRAMES[0])} durationInFrames={E_SCENES.opening} {...VIDEO} />
      <Composition id="E-Ask" component={withFastBg(EAsk, E_SCENES.ask, VO_FRAMES[1])} durationInFrames={E_SCENES.ask} {...VIDEO} />
      <Composition id="E-Work" component={withFastBg(EWork, E_SCENES.work, VO_FRAMES[2])} durationInFrames={E_SCENES.work} {...VIDEO} />
      <Composition id="E-Workflows" component={withFastBg(EWorkflows, E_SCENES.workflows, VO_FRAMES[3])} durationInFrames={E_SCENES.workflows} {...VIDEO} />
      <Composition id="E-Connect" component={withFastBg(EConnect, E_SCENES.connect, VO_FRAMES[4])} durationInFrames={E_SCENES.connect} {...VIDEO} />
      <Composition id="E-Experts" component={withFastBg(EExperts, E_SCENES.experts, VO_FRAMES[5])} durationInFrames={E_SCENES.experts} {...VIDEO} />
      <Composition id="E-Close" component={withFastBg(EClose, E_SCENES.close, VO_FRAMES[6])} durationInFrames={E_SCENES.close} {...VIDEO} />
    </Folder>
    <Composition
      id="SyrelEnergeticVertical"
      component={SyrelEnergeticVertical}
      durationInFrames={VERTICAL_DURATION}
      defaultProps={{ musicSrc: null }}
      width={1080}
      height={1920}
      fps={30}
    />
    <Composition
      id="BrandedEpisode"
      component={BrandedEpisode}
      durationInFrames={600}
      calculateMetadata={calculateEpisodeMetadata}
      defaultProps={{
        src: "notebooklm/explainer-workflows-you-can-trust.mp4",
        episodeLabel: "Explainer",
        title: "Workflows you can trust",
        series: "Syrel Explainers",
      }}
      {...VIDEO}
    />
    <Folder name="Promo">
      <Composition id="SyrelPromo" component={SyrelPromo} durationInFrames={PROMO_DURATION} {...VIDEO} />
      <Composition id="SyrelPromoVertical" component={SyrelPromo} durationInFrames={PROMO_DURATION} width={1080} height={1920} fps={30} />
      <Composition id="SyrelTeaser" component={SyrelTeaser} durationInFrames={TEASER_DURATION} {...VIDEO} />
    </Folder>
    <Folder name="Clips">
      <Composition id="Clip-Chat" component={FeatureClip} durationInFrames={clipDuration("chat")} defaultProps={{ id: "chat" as const }} {...VIDEO} />
      <Composition id="Clip-Library" component={FeatureClip} durationInFrames={clipDuration("library")} defaultProps={{ id: "library" as const }} {...VIDEO} />
      <Composition id="Clip-Workflows" component={FeatureClip} durationInFrames={clipDuration("workflows")} defaultProps={{ id: "workflows" as const }} {...VIDEO} />
      <Composition id="Clip-Connections" component={FeatureClip} durationInFrames={clipDuration("connections")} defaultProps={{ id: "connections" as const }} {...VIDEO} />
      <Composition id="Clip-Experts" component={FeatureClip} durationInFrames={clipDuration("experts")} defaultProps={{ id: "experts" as const }} {...VIDEO} />
      <Composition id="Clip-Admin" component={FeatureClip} durationInFrames={clipDuration("admin")} defaultProps={{ id: "admin" as const }} {...VIDEO} />
    </Folder>
  </>
);
