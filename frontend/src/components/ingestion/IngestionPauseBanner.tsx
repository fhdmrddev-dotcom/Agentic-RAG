import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface IngestionPauseBannerProps {
  /** The provider name that issued the rate limit / quota exhaustion (e.g. "OpenAI") */
  provider?: string
  /** HTTP status code (e.g. 429) */
  statusCode?: number | string
  /** Provider status text / code (e.g. "insufficient_quota") */
  statusText?: string
  /** Verbatim error message from provider */
  verbatimError?: string
  /** Count of files successfully processed and safely stored */
  completedCount: number
  /** Total count of files in the batch */
  totalCount: number
  /** Initial countdown in seconds until the automatic half-open probe */
  initialRetrySeconds?: number
  /** Optional callback when retry fires */
  onRetry?: () => void
  className?: string
}

/**
 * Phase 230 Plan 05: IngestionPauseBanner.
 *
 * Implements the locked refusal copy and banner design from Sketch 227 (SC#3, closes BUG-260815-05).
 * - Explicitly names the provider and HTTP status code.
 * - Renders the provider's own words verbatim in a mono block.
 * - Reassures user that finished files stay added and remaining files are queued, not lost.
 * - Animated live countdown with dotBounce retry indicator ("nothing for you to do").
 * - ⛔ NEVER says "your documents returned nothing"
 * - ⛔ NEVER performs a silent provider swap (D-2).
 */
export function IngestionPauseBanner({
  provider = "OpenAI",
  statusCode = 429,
  statusText = "insufficient_quota",
  verbatimError = "Rate limit reached for text-embedding-3-small in organization org-••••7f2a on tokens per min (TPM): Limit 1,000,000, Used 998,231.",
  completedCount,
  totalCount,
  initialRetrySeconds = 14,
  onRetry,
  className,
}: IngestionPauseBannerProps) {
  const [countdown, setCountdown] = useState(initialRetrySeconds)

  const remainingCount = Math.max(0, totalCount - completedCount)

  useEffect(() => {
    setCountdown(initialRetrySeconds)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRetry?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [initialRetrySeconds, onRetry])

  return (
    <div
      data-testid="ingestion-pause-banner"
      className={cn(
        "relative overflow-hidden rounded-xl border border-amber-500/40",
        "bg-gradient-to-b from-amber-500/10 to-amber-500/[0.03] p-4 text-sm shadow-sm",
        "animate-fadeSlideUp",
        className,
      )}
    >
      {/* ── Left amber accent bar with luminous glow ─────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.7)]"
        aria-hidden="true"
      />

      {/* ── Header: Named Provider Refusal ───────────────────────────── */}
      <h4 className="font-semibold text-amber-500 text-base leading-tight flex items-center gap-2">
        <span aria-hidden="true">⏸</span>
        {" "}
        <span>{provider} is rate-limiting us — ingestion paused</span>
      </h4>

      {/* ── Honest State: Count of preserved vs queued files ─────────── */}
      <p className="mt-1.5 text-muted-foreground text-xs leading-normal">
        <strong className="text-foreground">
          {completedCount} of {totalCount} files are already added
        </strong>{" "}
        and stay added. The remaining {remainingCount} are queued, not lost.
      </p>

      {/* ── Verbatim Provider Error Block (SC#3 / BUG-260815-05) ─────── */}
      <div
        data-testid="verbatim-provider-error"
        className="mt-2.5 font-mono text-xs text-muted-foreground/90 bg-background/80 border border-border/80 rounded px-3 py-2 select-text"
      >
        {provider.toLowerCase()} · {statusCode} {statusText ? `${statusText} — ` : "— "}
        &ldquo;{verbatimError}&rdquo;
      </div>

      {/* ── Live Countdown Retry Line ─────────────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-dotBounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-dotBounce [animation-delay:0.16s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-dotBounce [animation-delay:0.32s]" />
        </span>
        <span>
          Retrying automatically in{" "}
          <span className="font-mono text-foreground font-semibold" data-testid="retry-countdown">
            {countdown}s
          </span>{" "}
          — nothing for you to do.
        </span>
      </div>
    </div>
  )
}
