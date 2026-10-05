// Phase 276-03 (D-12, D-13) — the ONE home of slot resolution. A slot key resolves against VIDEOS:
//   absent key / null slot           → null (UI-SPEC V0 — no frame, no copy, no reserved space)
//   youtube with youtubeId null       → null
//   youtube with an id                → <YouTubeFacade> (click to load, youtube-nocookie)
//   remotion                          → <RemotionVideo> (276-05, UI-SPEC V2): a poster button; the
//                                        Player chunk arrives through import("./RemotionSlot") only
//                                        after the click (hover/focus may prefetch that one file).
import { Component, lazy, Suspense, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { formatDuration } from "../headingId"
import { PlayIcon } from "../icons"
import { YouTubeFacade } from "./YouTubeFacade"
import { VIDEOS, type RemotionEntry, type VideoEntry } from "./videos"

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
  if (entry.kind === "remotion") return <RemotionVideo entry={entry} />
  return null
}

// ── Remotion (V2) ────────────────────────────────────────────────────────────

const loadRemotionSlot = () => import("./RemotionSlot")

export const VIDEO_LOAD_ERROR = "This video couldn't load. Check your connection and try again."

/** Catches a failed RemotionSlot chunk (React.lazy rejects by throwing to the nearest boundary). */
class SlotBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

type Phase = "idle" | "playing" | "error"

function RemotionVideo({ entry }: { entry: RemotionEntry }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [attempt, setAttempt] = useState(0)
  // A rejected React.lazy caches its rejection, so every attempt gets a fresh one.
  const RemotionSlotLazy = useMemo(() => lazy(loadRemotionSlot), [attempt]) // eslint-disable-line react-hooks/exhaustive-deps
  const prefetched = useRef(false)
  const duration = formatDuration(entry.durationSec)
  const portrait = entry.aspect === "9:16"

  const prefetch = () => {
    if (prefetched.current) return
    prefetched.current = true
    loadRemotionSlot().catch(() => {
      prefetched.current = false
    })
  }
  const start = () => {
    setAttempt((a) => a + 1)
    setPhase("playing")
  }
  const fail = useCallback(() => setPhase("error"), [])

  const poster = (busy: boolean) => (
    <button
      type="button"
      className="d-video-poster"
      aria-label={`Play video: ${entry.title}, ${duration}`}
      aria-busy={busy || undefined}
      onClick={busy ? undefined : start}
      onPointerEnter={prefetch}
      onFocus={prefetch}
    >
      <img
        src={entry.poster}
        alt=""
        loading="lazy"
        decoding="async"
        width={portrait ? 720 : 1280}
        height={portrait ? 1280 : 720}
      />
      {busy ? (
        <span className="d-ring" aria-hidden="true" />
      ) : (
        <span className="d-play" aria-hidden="true">
          <PlayIcon size={24} />
        </span>
      )}
    </button>
  )

  return (
    <figure className={`d-video${portrait ? " d-video-portrait" : ""}`}>
      <div className="d-video-frame" style={{ aspectRatio: portrait ? "9 / 16" : "16 / 9" }}>
        {phase === "playing" ? (
          <SlotBoundary key={attempt} onError={fail}>
            <Suspense fallback={poster(true)}>
              <RemotionSlotLazy entry={entry} fallback={poster(true)} onError={fail} />
            </Suspense>
          </SlotBoundary>
        ) : (
          poster(false)
        )}
      </div>
      {phase === "error" && (
        <p className="d-video-error" role="alert">
          {VIDEO_LOAD_ERROR}{" "}
          <button type="button" className="d-textbtn" onClick={start}>
            Try loading the video again
          </button>
        </p>
      )}
      <figcaption className="d-video-caption">
        <span>
          {entry.title} · {duration}
        </span>
        {entry.transcript && (
          <details className="d-transcript">
            <summary>Read the transcript</summary>
            <p>{entry.transcript}</p>
          </details>
        )}
      </figcaption>
    </figure>
  )
}
