// Phase 276-03 (D-10, D-12, D-13) — the video slot manifest: the ONE place a slot key maps to a
// video. <VideoSlot slot="…"> resolves against it; a key that is absent, or a YouTube entry whose
// youtubeId is still null, renders NOTHING (UI-SPEC V0: no frame, no "coming soon").
//
// Slot keys (UI-SPEC §Video slots → slot map):
//   Remotion — landing.promo · home.overview · clip.chat · clip.library · clip.workflows ·
//              clip.connections · clip.experts · clip.admin
//              → added by 276-05 together with the lazy RemotionSlot branch inside VideoSlot.tsx.
//   YouTube  — explainer.* (NotebookLM explainers) · changelog.chapter-1 … -5 (documentary)
//              → listed below with youtubeId null: nothing is uploaded yet (an operator action).
//
// ⛔ explainer.automate-workflows stays null until a corrected cut replaces the current one's
// "8-stage" claim (276-VIDEO-QUEUE.md). Posters for YouTube slots are SELF-HOSTED (never YouTube's
// thumbnail host), so nothing reaches YouTube before the reader presses play.
import type { ComponentType } from "react"

export type VideoAspect = "16:9" | "9:16"

/** What a lazily-imported Remotion slot module provides (276-05 owns the shape's consumers). */
export interface RemotionModule {
  component: ComponentType<Record<string, unknown>>
  durationInFrames: number
  fps: number
  compositionWidth: number
  compositionHeight: number
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
  poster: string
  title: string
  durationSec: number
  aspect: VideoAspect
  transcript?: string
}

export type VideoEntry = YouTubeEntry | RemotionEntry

const chapter = (n: number, title: string): YouTubeEntry => ({
  kind: "youtube",
  youtubeId: null,
  poster: null,
  title: `Chapter ${n}: ${title}`,
  durationSec: 0,
  aspect: "16:9",
})

export const VIDEOS: Record<string, VideoEntry> = {
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
