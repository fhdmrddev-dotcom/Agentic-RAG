// Phase 276-03 (D-10, D-12, D-13) — the video slot manifest: the ONE place a slot key maps to a
// video. <VideoSlot slot="…"> resolves against it; a key that is absent, or a YouTube entry whose
// youtubeId is still null, renders NOTHING (UI-SPEC V0: no frame, no "coming soon").
//
// Slot keys (UI-SPEC §Video slots → slot map):
//   Remotion — home.overview · clip.chat · clip.library · clip.workflows · clip.connections ·
//              clip.experts · clip.admin  (276-05). `landing.promo` is NOT here: the landing never
//              imports the docs tree; its promo lives in src/landing/components/HeroPromo.tsx.
//   YouTube  — explainer.* (NotebookLM explainers) · changelog.chapter-1 … -5 (documentary)
//              → listed below with youtubeId null: nothing is uploaded yet (an operator action).
//
// ⛔ explainer.automate-workflows stays null until a corrected cut replaces the current one's
// "8-stage" claim (276-VIDEO-QUEUE.md). Posters for YouTube slots are SELF-HOSTED (never YouTube's
// thumbnail host), so nothing reaches YouTube before the reader presses play.
//
// Phase 276-05 (D-11, D-13, D-18):
//   - Every Remotion `load` is a DYNAMIC import of the @video module — never a static one — so no
//     composition (and no @remotion/player) is in the docs first-paint graph (docsBundleFence).
//   - home.overview is SyrelEnergetic, the NARRATED cut (D-18); the calm overview cut has no voice.
//   - Only the six clips that exist have entries; the other IA clip keys resolve to nothing (D-13).
//   - durationInFrames is a literal for the poster label and is pinned to the composition's own
//     constant by VideoSlot.test.tsx; the Player always uses the module's live value from `load`.
//   - Transcripts are the VO lines from video/tools/make_vo.py (SCRIPT / CLIPS), verbatim.
import type { ComponentType } from "react"

export type VideoAspect = "16:9" | "9:16"

/** What a Remotion entry's `load()` resolves to. */
export interface RemotionModule {
  component: ComponentType<Record<string, unknown>>
  durationInFrames: number
}

export type YouTubeEntry = {
  kind: "youtube"
  youtubeId: string | null
  poster: string | null
  title: string
  durationSec: number
  aspect: VideoAspect
}

export type RemotionEntry = {
  kind: "remotion"
  load: () => Promise<RemotionModule>
  inputProps?: Record<string, unknown>
  poster: string
  title: string
  durationInFrames: number
  durationSec: number
  aspect: VideoAspect
  transcript?: string
}

export type VideoEntry = YouTubeEntry | RemotionEntry

/** Every Remotion composition here renders at 30 fps, 1920×1080. */
export const REMOTION_FPS = 30

const chapter = (n: number, title: string): YouTubeEntry => ({
  kind: "youtube",
  youtubeId: null,
  poster: null,
  title: `Chapter ${n}: ${title}`,
  durationSec: 0,
  aspect: "16:9",
})

type ClipId = "chat" | "library" | "workflows" | "connections" | "experts" | "admin"

/** clipDuration(id) for every shipped clip today (all six land on the 330-frame scene floor). */
const CLIP_FRAMES = 457

const clip = (id: ClipId, title: string, transcript: string): RemotionEntry => ({
  kind: "remotion",
  load: () =>
    import("@video/clips/FeatureClip").then((m) => ({
      component: m.FeatureClip as unknown as ComponentType<Record<string, unknown>>,
      durationInFrames: m.clipDuration(id),
    })),
  inputProps: { id },
  poster: `/docs-assets/posters/clip-${id}.jpg`,
  title,
  durationInFrames: CLIP_FRAMES,
  durationSec: CLIP_FRAMES / REMOTION_FPS,
  aspect: "16:9",
  transcript,
})

const OVERVIEW_FRAMES = 1199

export const VIDEOS: Record<string, VideoEntry> = {
  "home.overview": {
    kind: "remotion",
    load: () =>
      import("@video/energetic/SyrelEnergetic").then((m) => ({
        component: m.SyrelEnergetic as unknown as ComponentType<Record<string, unknown>>,
        durationInFrames: m.ENERGETIC_DURATION,
      })),
    // No music on the web: the overview plays its same-origin voiceover only.
    inputProps: { musicSrc: null },
    poster: "/docs-assets/posters/home-overview.jpg",
    title: "Watch the Syrel overview",
    durationInFrames: OVERVIEW_FRAMES,
    durationSec: OVERVIEW_FRAMES / REMOTION_FPS,
    aspect: "16:9",
    transcript: [
      "Your company's documents hold the answers. Most AI never reads them.",
      "Syrel searches your knowledge and answers with cited sources and a confidence badge.",
      "When there's real work to do, it runs Python in a sealed sandbox and hands back finished files.",
      "Turn recurring tasks into workflows that run every step in order, and must pass publish checks before they go live.",
      "Connect your tools, and decide what each one may do. Allow. Ask. Or deny.",
      "Install Experts for every team, with spend tracked per Expert.",
      "Syrel. Answers from your knowledge. With receipts.",
    ].join(" "),
  },
  "clip.chat": clip(
    "chat",
    "Chat with your knowledge",
    "Ask Syrel anything about your documents. Every answer cites its sources, and a confidence badge tells you how sure it is.",
  ),
  "clip.library": clip(
    "library",
    "Library & documents",
    "Organise documents in folders and saved views. Syrel keeps their metadata, with honest confidence, so every answer can cite the page.",
  ),
  "clip.workflows": clip(
    "workflows",
    "Workflows you can trust",
    "Describe a process in plain English. Syrel runs each step in order, checks it, and won't publish until it proves it works.",
  ),
  "clip.connections": clip(
    "connections",
    "Connect every tool",
    "Connect Google Workspace, Jira or any MCP server, then decide what every tool may do: allow it, ask first, or deny it.",
  ),
  "clip.experts": clip(
    "experts",
    "Experts for every team",
    "Install an Expert for any team. It adds its own knowledge and skills, and its spend is tracked separately.",
  ),
  "clip.admin": clip(
    "admin",
    "The Control Room",
    "Run Syrel from the Control Room: manage users and models, watch spend per Expert, read the audit log, and flip kill switches.",
  ),
  "explainer.automate-workflows": {
    kind: "youtube",
    youtubeId: null,
    poster: null,
    title: "Workflows You Can Trust",
    durationSec: 0,
    aspect: "9:16",
  },
  "changelog.chapter-1": chapter(1, "A document chat that can be trusted"),
  "changelog.chapter-2": chapter(2, "An agent that keeps working"),
  "changelog.chapter-3": chapter(3, "Workflows anyone can author"),
  "changelog.chapter-4": chapter(4, "Organisations and connections"),
  "changelog.chapter-5": chapter(5, "A product you can sell"),
}
