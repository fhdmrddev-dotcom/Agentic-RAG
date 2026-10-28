/**
 * Phase 299-05 (LINK-06 / D-26 / S6 / SEED-312) — THE BOOT SCREEN GIVES UP WITH WORDS.
 *
 * App shows this while the auth state or the one-shot setup probe has not answered. Before 299
 * that splash was an Iris with no words and no end: a boot that could not reach the server spun
 * forever (SEED-312). One clock, started at mount (the start of the wait):
 *
 *   0-8 s   today's splash markup VERBATIM — nothing changes for a fast boot;
 *   8-20 s  plus BOOT_COPY.still inside the same `role="status"` wrapper (announced politely);
 *   > 20 s  BOOT_COPY.heading + BOOT_COPY.body + a filled BOOT_COPY.retry button.
 *
 * When the wait ends at any stage, App stops rendering this and the app proceeds at once.
 *
 * ⛔ IT NEVER DECIDES AUTH. A slow session read stays on this screen through all three stages; it
 * is never shown the sign-in form because of a timeout (Pitfall 6). That is why the bound lives
 * HERE and not as a timer in `useAuth`: this clock changes only what the screen SAYS.
 * ⛔ The retry button is `window.location.reload()` — the URL is kept, so the link survives, and it is
 * not a History write (`noRawHistoryWrites.test.ts`).
 * ⛔ No amber, no red, no `role="alert"` (UI-D3): a slow network is not an error the person made.
 * The "kept" sentence appears only on an entity address (UI-D17) — on plain `/app` it would
 * promise a link nobody opened.
 */
import { useEffect, useRef, useState } from "react"
import { IrisAvatar } from "@/components/chat/IrisAvatar"
import { Button } from "@/components/ui/button"
import { kindWord } from "@/lib/returnTo"

/** S6's words (299-UI-SPEC). One home: tests assert these rendered. */
// eslint-disable-next-line react-refresh/only-export-components -- the copy lives beside the one component that renders it, so its suite asserts the same words the screen shows (the AddressNotFound.tsx precedent)
export const BOOT_COPY = {
  still: "Still connecting…",
  heading: "Can't reach Syrel",
  body: "Check your connection and try again.",
  kept: " Your link is kept, so you'll still land on it.",
  retry: "Try again",
} as const

const STILL_AFTER_MS = 8_000
const GIVE_UP_AFTER_MS = 20_000

type Stage = "iris" | "still" | "gaveup"

export function BootScreen() {
  const [stage, setStage] = useState<Stage>("iris")
  // Read once: the address does not change while the app has not booted.
  const [linkKept] = useState(() => kindWord(window.location.pathname, window.location.search) !== null)
  const retryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const still = window.setTimeout(() => setStage("still"), STILL_AFTER_MS)
    const gaveUp = window.setTimeout(() => setStage("gaveup"), GIVE_UP_AFTER_MS)
    return () => {
      window.clearTimeout(still)
      window.clearTimeout(gaveUp)
    }
  }, [])

  useEffect(() => {
    if (stage === "gaveup") retryRef.current?.focus()
  }, [stage])

  if (stage === "gaveup") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <IrisAvatar state="idle" size={56} />
          <h1 className="text-base font-semibold text-foreground">{BOOT_COPY.heading}</h1>
          <p className="max-w-[260px] text-sm text-muted-foreground">
            {linkKept ? `${BOOT_COPY.body}${BOOT_COPY.kept}` : BOOT_COPY.body}
          </p>
          <Button ref={retryRef} onClick={() => window.location.reload()}>
            {BOOT_COPY.retry}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center">
      {/* Phase 276-06: the Iris in its thinking state replaces the generic spin ring; under
          reduced motion it is the static mark with the lit core. */}
      <div role="status" aria-label="Loading Syrel" className={stage === "still" ? "flex flex-col items-center gap-4" : undefined}>
        <IrisAvatar state="thinking" size={56} />
        {stage === "still" && <p className="text-sm text-muted-foreground">{BOOT_COPY.still}</p>}
      </div>
    </div>
  )
}
