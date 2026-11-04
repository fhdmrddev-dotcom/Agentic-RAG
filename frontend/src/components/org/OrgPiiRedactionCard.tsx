/**
 * Phase 305-04 (GUARD-03, D-36, D-37; UI-SPEC Surface 1) — the org admin's PII redaction switch,
 * inside Org admin → Settings, directly under the MCP switch card.
 *
 * A copy of `OrgMcpSwitchCard`'s shape and state machine: it owns its read (`getOrgPiiRedaction`)
 * and its write (`setOrgPiiRedaction`), guards every setState with an `alive` ref, and calls
 * `onRecorded()` after a successful write so the band's "every action recorded" marker pulses
 * (062-A). No toast.
 *
 * ⚠ NEVER OPTIMISTIC: the switch shows what the SERVER answered; disabled while the write is in
 *   flight; a failed write stays where it was and says so (`role="status"`).
 * ⚠ NO SWITCH ON A FAILED READ: a failed read renders the words and Retry only — never a guess.
 * ⚠ BOTH SUB LINES RENDER IN EVERY STATE (loading, failed, off, on), and the switch is
 *   `aria-describedby` them: what is covered, what is NOT (names), the fail-closed rule and that
 *   ids, citations and links are never changed are read BEFORE the switch is touched.
 * ⚠ OFF IS CALM (UI-SPEC A-3): the default, not an armed state — no destructive colour, no impact
 *   line. ON adds the success-hue tag. Direct flip either way (066: reversible, no single victim).
 * ⚠ The switch look is RE-DECLARED here, not imported (CapabilityGrid.tsx FIRES).
 * ⚠ The wall is the server's `require_org_manage` on `/org/api-keys/pii-redaction`; this card only
 *   sits inside the admin-only shell.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { getOrgPiiRedaction, setOrgPiiRedaction } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"
import { cn } from "@/lib/utils"

const P = MCP_KEY_COPY.pii

export function OrgPiiRedactionCard({
  orgName,
  onRecorded,
}: {
  orgName: string | null
  onRecorded?: () => void
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [writeFailed, setWriteFailed] = useState(false)
  const alive = useRef(true)
  const org = orgName || MCP_KEY_COPY.mcp.orgFallback
  const subId = useId()
  const notCoveredId = useId()

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await getOrgPiiRedaction()
      if (!alive.current) return
      setEnabled(Boolean(res.enabled))
    } catch {
      if (alive.current) setLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  async function handleToggle() {
    if (busy || enabled === null) return
    setBusy(true)
    setWriteFailed(false)
    try {
      const res = await setOrgPiiRedaction(!enabled)
      if (!alive.current) return
      setEnabled(Boolean(res.enabled))
      onRecorded?.()
    } catch {
      if (alive.current) setWriteFailed(true)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const on = enabled === true

  return (
    <div
      data-testid="org-pii-redaction"
      data-on={String(on)}
      className="mt-3 rounded-md border border-border bg-background px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            {P.title}
            {on && (
              <span className="flex-none rounded-md border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                {fillCopy(P.onTag, { org })}
              </span>
            )}
          </div>
          <div id={subId} className="mt-1 text-xs leading-snug text-muted-foreground">
            {fillCopy(P.sub, { org })}
          </div>
          <div id={notCoveredId} className="mt-1 text-xs leading-snug text-muted-foreground">
            {P.notCovered}
          </div>
        </div>

        {enabled !== null && (
          <PiiSwitch
            on={on}
            busy={busy}
            label={P.title}
            describedBy={`${subId} ${notCoveredId}`}
            onToggle={() => void handleToggle()}
          />
        )}
      </div>

      {enabled === null && !loadFailed && <p className="mt-2 text-xs text-muted-foreground">{P.loading}</p>}
      {loadFailed && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{P.loadFailed}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {API_KEYS_COPY.tab.retry}
          </Button>
        </div>
      )}

      {writeFailed && (
        <div className="mt-1.5 text-xs text-destructive" role="status">
          {P.failed}
        </div>
      )}
    </div>
  )
}

/** The direct-flip switch: the shipped 20×36 track, `bg-primary/70` on and a NEUTRAL track off
 *  (off is this setting's calm default, never armed). */
function PiiSwitch({
  on,
  busy,
  label,
  describedBy,
  onToggle,
}: {
  on: boolean
  busy: boolean
  label: string
  describedBy: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        on ? "bg-primary/70" : "bg-muted-foreground/30",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}
