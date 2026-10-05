// Phase 276-05 (D-05, D-11, D-18, UI-SPEC V2, T-276-20) — the Remotion Player for one docs slot.
//
// This module is reached ONLY through `import("./RemotionSlot")` in VideoSlot.tsx, after the reader
// clicks a poster (or, at most, prefetched on hover/focus). Even so it imports nothing heavy at
// module level: @remotion/player, the composition and kit's SfxOn all arrive through import(), so
// the only thing a prefetch downloads is this small file.
//
// Web playback rules:
//   - The composition is wrapped in kit's SfxOn provider set to false: the SFX are hosted on
//     remotion.media (a third party) and a reader's browser must never request them. The voiceover
//     (/vo/*.wav, same origin) still plays — the overview and the clips are narrated.
//   - No Google Fonts: this build defines `__VIDEO_WEB_PLAYBACK__` (vite.config.ts), so the
//     compositions' theme skips @remotion/google-fonts and uses the page's own font stack — no
//     fonts.gstatic.com request (276-REVIEW B-WR-05).
//   - autoPlay is safe here because playback is user-initiated (the click that mounted us).
//   - acknowledgeRemotionLicense: Remotion is free for companies of up to 3 people (D-05; see
//     video/README.md for the recheck rule).
import { createElement, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react"
import { REMOTION_FPS, type RemotionEntry } from "./videos"

type AnyProps = Record<string, unknown>

const loadPlayer = () =>
  import("@remotion/player").then((m) => ({ default: m.Player as unknown as ComponentType<AnyProps> }))

interface Loaded {
  component: ComponentType<AnyProps>
  durationInFrames: number
}

export interface RemotionSlotProps {
  entry: RemotionEntry
  /** Rendered while the Player and composition download (the busy poster). */
  fallback: ReactNode
  /** Called once if anything fails to load; the parent shows the poster + error copy. */
  onError: () => void
}

export default function RemotionSlot({ entry, fallback, onError }: RemotionSlotProps) {
  // One lazy per mount: a rejected React.lazy caches its rejection, and a retry remounts us.
  const PlayerLazy = useMemo(() => lazy(loadPlayer), [])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    Promise.all([entry.load(), import("@video/energetic/kit"), loadPlayer()]).then(
      ([mod, kit]) => {
        const Comp = mod.component
        const WebComposition: ComponentType<AnyProps> = (props) =>
          createElement(kit.SfxOn.Provider, { value: false }, createElement(Comp, props))
        if (live) setLoaded({ component: WebComposition, durationInFrames: mod.durationInFrames })
      },
      () => {
        if (live) onError()
      },
    )
    return () => {
      live = false
    }
  }, [entry, onError])

  useEffect(() => {
    if (loaded) wrapRef.current?.focus()
  }, [loaded])

  if (!loaded) return <>{fallback}</>

  const portrait = entry.aspect === "9:16"
  return (
    <div ref={wrapRef} className="d-video-player" tabIndex={-1} role="region" aria-label={entry.title}>
      <PlayerLazy
        component={loaded.component}
        inputProps={entry.inputProps ?? {}}
        durationInFrames={loaded.durationInFrames}
        compositionWidth={portrait ? 1080 : 1920}
        compositionHeight={portrait ? 1920 : 1080}
        fps={REMOTION_FPS}
        controls
        autoPlay
        clickToPlay
        acknowledgeRemotionLicense
        style={{ width: "100%", height: "100%", aspectRatio: portrait ? "9 / 16" : "16 / 9" }}
      />
    </div>
  )
}
