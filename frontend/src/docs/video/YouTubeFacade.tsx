// Phase 276-03 (D-12, T-276-12, UI-SPEC V1/V3) — a YouTube video behind a click. Before the click
// the page holds only a self-hosted poster and a button: no YouTube script, image, font or
// preconnect. The privacy-enhanced (youtube-nocookie.com) iframe is created only on press.
import { useEffect, useRef, useState } from "react"
import { formatDuration } from "../headingId"
import { PlayIcon } from "../icons"
import type { YouTubeEntry } from "./videos"

export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
}

export function YouTubeFacade({ entry, youtubeId }: { entry: YouTubeEntry; youtubeId: string }) {
  const [playing, setPlaying] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const duration = formatDuration(entry.durationSec)
  const portrait = entry.aspect === "9:16"

  useEffect(() => {
    if (playing) frameRef.current?.focus()
  }, [playing])

  return (
    <figure className={`d-video${portrait ? " d-video-portrait" : ""}`}>
      <div className="d-video-frame" style={{ aspectRatio: portrait ? "9 / 16" : "16 / 9" }}>
        {playing ? (
          <iframe
            ref={frameRef}
            src={youTubeEmbedUrl(youtubeId)}
            title={entry.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
          />
        ) : (
          <button
            type="button"
            className="d-video-poster"
            aria-label={`Play video: ${entry.title}, ${duration}`}
            onClick={() => setPlaying(true)}
          >
            {entry.poster && (
              <img
                src={entry.poster}
                alt=""
                loading="lazy"
                decoding="async"
                width={portrait ? 720 : 1280}
                height={portrait ? 1280 : 720}
              />
            )}
            <span className="d-play" aria-hidden="true">
              <PlayIcon size={24} />
            </span>
          </button>
        )}
      </div>
      <figcaption className="d-video-caption">
        <span>
          {entry.title} · {duration}
        </span>
        <span>Plays from YouTube in privacy-enhanced mode. Nothing loads from YouTube until you press play.</span>
      </figcaption>
    </figure>
  )
}
