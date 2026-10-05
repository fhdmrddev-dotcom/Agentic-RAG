// Phase 276-05 (D-10, D-15, D-19, UI-SPEC V4, T-276-20) — the landing hero's ONE moving thing.
//
// ⛔ This module is NEVER in the landing's static graph: HeroSection reaches it only through
// import("./HeroPromo"), after window load + a first scroll + the slot ≥ 50% visible (or a click
// under reduced motion). That is what lets it import @remotion/player and the composition
// statically here. Fenced by landingFirstPaintFence.test.ts and scripts/check-landing-first-paint.cjs.
//
// Playback rules:
//   - muted, looping, no default controls; our own Pause and Unmute are always present (WCAG 2.2.2)
//   - no audio is downloaded until Unmute: the composition gets musicSrc null (no <Audio> at all)
//     until then, and AudioOn/SfxOn off (no voice, no remote SFX from remotion.media)
//   - pauses below 25% visible or when the tab is hidden; resumes only if the reader did not press Pause
import { useCallback, useEffect, useRef, useState } from "react"
import { Player, type PlayerRef } from "@remotion/player"
import { AudioOn, SfxOn } from "@video/energetic/kit"
import { PROMO_DURATION, PromoBody } from "@video/promo/SyrelPromo"

/** The committed web copy of the promo track (video/public/music, served at /music/ by the docs plugin). */
export const PROMO_MUSIC_WEB = "music/syrel-pulse.mp3"
const MIN_VISIBLE = 0.25

function LandingPromoComposition({ musicSrc }: { musicSrc: string | null }) {
  return (
    <AudioOn.Provider value={false}>
      <SfxOn.Provider value={false}>
        <PromoBody musicSrc={musicSrc} />
      </SfxOn.Provider>
    </AudioOn.Provider>
  )
}

export function HeroPromo() {
  const playerRef = useRef<PlayerRef>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const userPaused = useRef(false)
  const inView = useRef(true)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [musicSrc, setMusicSrc] = useState<string | null>(null)

  const sync = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (!userPaused.current && inView.current && !document.hidden) player.play()
    else player.pause()
  }, [])

  useEffect(() => {
    const el = frameRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) inView.current = e.intersectionRatio >= MIN_VISIBLE
        sync()
      },
      { threshold: [0, MIN_VISIBLE, 0.5, 1] },
    )
    io.observe(el)
    const onVisibility = () => sync()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [sync])

  const togglePause = () => {
    userPaused.current = !userPaused.current
    setPaused(userPaused.current)
    sync()
  }

  const toggleMute = () => {
    const player = playerRef.current
    if (muted) {
      setMusicSrc(PROMO_MUSIC_WEB) // the first Unmute is the first audio request
      player?.unmute()
      setMuted(false)
    } else {
      player?.mute()
      setMuted(true)
    }
  }

  return (
    <div ref={frameRef} className="promo-player">
      <Player
        ref={playerRef}
        component={LandingPromoComposition}
        inputProps={{ musicSrc }}
        durationInFrames={PROMO_DURATION}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        autoPlay
        initiallyMuted
        loop
        controls={false}
        clickToPlay={false}
        acknowledgeRemotionLicense
        style={{ width: "100%", height: "100%" }}
      />
      <div className="promo-controls">
        <button
          type="button"
          className="promo-btn"
          aria-label={paused ? "Play promo" : "Pause promo"}
          aria-pressed={paused}
          onClick={togglePause}
        >
          {paused ? <PlayGlyph /> : <PauseGlyph />}
        </button>
        <button
          type="button"
          className="promo-btn"
          aria-label={muted ? "Unmute promo" : "Mute promo"}
          onClick={toggleMute}
        >
          {muted ? <MutedGlyph /> : <SoundGlyph />}
        </button>
      </div>
    </div>
  )
}

const glyph = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
}

const PauseGlyph = () => (
  <svg {...glyph}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)
const PlayGlyph = () => (
  <svg {...glyph}>
    <path d="M7 5v14l11-7z" fill="currentColor" />
  </svg>
)
const MutedGlyph = () => (
  <svg {...glyph}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m22 9-6 6M16 9l6 6" />
  </svg>
)
const SoundGlyph = () => (
  <svg {...glyph}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
)
