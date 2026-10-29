import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getNotificationEmailPreference,
  setNotificationEmailPreference,
  type NotificationEmailPreference as Pref,
} from "@/lib/api/settings"

/**
 * EmailNotificationPreference — Phase 300-05 (NOTE-04 / D-09, UI-SPEC S2).
 *
 * The member's own "Email me when a run is waiting on me", the third block on the Preferences tab.
 * Self-fetching and save-on-flip, server-derived (the `ModelDefaultPreference` pattern): every read
 * and write returns the server's view and the switch renders off it, never off the click.
 *
 * ⛔ Invariants:
 *  - It calls ONLY the ungated, RLS-scoped `/me/preferences` read and its own
 *    `/me/preferences/notification-email` write. This tab is rendered to members; a gated call here
 *    would be a 403 on every visit. And never the default-model PUT: it would clear their model.
 *  - Nothing reads "On" before the read answers: while loading the switch is disabled, busy, on a
 *    neutral track and carries no word.
 *  - A failed save returns to the last server value and says so; no toast (skill rule 062-A).
 *  - The delay words come from the server (`duration_words`); this file never formats seconds.
 *  - The switch look is COPIED from `SettingsPage.tsx`'s local `Toggle` (UI-D1: that file is G-5
 *    FIRING and `Toggle` is not exported, so it is copied here, not extracted).
 */

const COPY = {
  title: "Email me when a run is waiting on me",
  description: (words: string) =>
    `If a workflow run is still waiting for your answer or approval after ${words}, we'll email you a link to it. Turning this off stops the email only. The run still waits for you.`,
  // UI-D8: a read with no delay words says this instead of a number.
  shortWait: "a short wait",
  on: "On",
  off: "Off",
  saveFailed: "Couldn't save this. Try again.",
  loadFailed: "Couldn't load this setting.",
  retry: "Retry loading",
  notConfigured: "Email isn't set up on this server yet, so nothing is sent for now.",
} as const

export function EmailNotificationPreference() {
  const [pref, setPref] = useState<Pref | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading")
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const alive = useRef(true)
  const titleId = useId()
  const descId = useId()

  const load = useCallback(() => {
    setLoadState("loading")
    void (async () => {
      try {
        const p = await getNotificationEmailPreference()
        if (!alive.current) return
        setPref(p)
        setLoadState("loaded")
      } catch {
        if (alive.current) setLoadState("failed")
      }
    })()
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    return () => {
      alive.current = false
    }
  }, [load])

  const flip = useCallback(async () => {
    if (!pref) return
    setSaving(true)
    setSaveFailed(false)
    try {
      const next = await setNotificationEmailPreference(!pref.enabled)
      if (alive.current) setPref(next)
    } catch {
      // The shown value stays the last one the server answered.
      if (alive.current) setSaveFailed(true)
    } finally {
      if (alive.current) setSaving(false)
    }
  }, [pref])

  const ready = loadState === "loaded" && pref !== null
  const on = ready && pref.enabled
  const words = pref?.delayWords || COPY.shortWait

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg ghost-border bg-muted/20 px-4 py-4">
      <div className="min-w-0">
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {COPY.title}
        </p>
        <p id={descId} className="mt-1 text-xs text-muted-foreground">
          {COPY.description(words)}
        </p>
        {saveFailed && (
          <p role="alert" className="mt-1 text-xs text-[hsl(0_80%_80%)]">
            {COPY.saveFailed}
          </p>
        )}
        {ready && !pref.emailConfigured && (
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {COPY.notConfigured}
          </p>
        )}
      </div>

      {loadState === "failed" ? (
        <div role="alert" className="flex shrink-0 items-center gap-2 text-xs">
          <span>{COPY.loadFailed}</span>
          <Button type="button" size="sm" variant="outline" onClick={load}>
            {COPY.retry}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={titleId}
          aria-describedby={descId}
          aria-busy={!ready || saving}
          disabled={!ready || saving}
          onClick={() => void flip()}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
            on ? "text-primary" : "text-muted-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              on ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                on ? "translate-x-4" : "translate-x-1",
              )}
            />
          </span>
          {ready && <span>{on ? COPY.on : COPY.off}</span>}
        </button>
      )}
    </div>
  )
}
