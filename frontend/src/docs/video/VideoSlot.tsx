// Phase 276-03 (D-12, D-13) — the ONE home of slot resolution. A slot key resolves against VIDEOS:
//   absent key / null slot           → null (UI-SPEC V0 — no frame, no copy, no reserved space)
//   youtube with youtubeId null       → null
//   youtube with an id                → <YouTubeFacade> (click to load, youtube-nocookie)
//   remotion                          → null HERE; 276-05 adds the lazy RemotionSlot branch below
//                                        (and the remotion entries in videos.ts) without changing
//                                        this component's contract.
import { YouTubeFacade } from "./YouTubeFacade"
import { VIDEOS, type VideoEntry } from "./videos"

export function resolveSlot(slot: string | null | undefined): VideoEntry | null {
  if (!slot) return null
  const entry = Object.prototype.hasOwnProperty.call(VIDEOS, slot) ? VIDEOS[slot] : undefined
  if (!entry) return null
  if (entry.kind === "youtube" && !entry.youtubeId) return null
  return entry
}

/** True when a slot would render something (used by Home's "has a 15-s clip" and the changelog column). */
export function slotExists(slot: string | null | undefined): boolean {
  return resolveSlot(slot) !== null
}

export function VideoSlot({ slot }: { slot: string | null | undefined }) {
  const entry = resolveSlot(slot)
  if (!entry) return null
  if (entry.kind === "youtube" && entry.youtubeId) return <YouTubeFacade entry={entry} youtubeId={entry.youtubeId} />
  return null
}
