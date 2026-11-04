/**
 * Phase 304-06 (KEY-06, D-02, D-35; UI-SPEC Surface 3) — the org admin's MCP switch, inside
 * Org admin → Settings, under the identity block.
 *
 * Self-contained on the `OrgApiKeysTab` shape: it owns its read (`getOrgMcpAccess`) and its write
 * (`setOrgMcpAccess`), guards every setState with an `alive` ref, and calls `onRecorded()` after a
 * successful write so the band's "every action recorded" marker pulses (062-A). No toast.
 *
 * ⚠ NEVER OPTIMISTIC (T-304-43): the switch shows what the SERVER answered. While the write is in
 *   flight it is disabled; a failed write leaves it where it was and says so.
 * ⚠ NO SWITCH ON A FAILED READ (T-304-44): a switch must never show a guessed value, so a failed
 *   read renders the words and Retry only.
 * ⚠ DIRECT FLIP, NO CONFIRM: a reversible capability switch with no single victim takes the 066
 *   graded guard's direct-flip arm, like the Control Room grid. OFF is armed (065-A).
 * ⚠ The switch look is RE-DECLARED here, not imported: exporting `CapabilitySwitch` would add an
 *   export to `CapabilityGrid.tsx`, a FIRING file (UI-SPEC §G-5 mount budget).
 * ⚠ The wall is the server's `require_org_manage` on `/org/api-keys/mcp-access` (T-304-46); this
 *   card only sits inside the admin-only shell.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { getOrgMcpAccess, setOrgMcpAccess } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"
import { cn } from "@/lib/utils"

const M = MCP_KEY_COPY.mcp

export function OrgMcpSwitchCard({
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
  const org = orgName || M.orgFallback

  const load = useCallback(async () => {
    setLoadFailed(false)
    try {
      const res = await getOrgMcpAccess()
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
      const res = await setOrgMcpAccess(!enabled)
      if (!alive.current) return
      setEnabled(Boolean(res.enabled))
      onRecorded?.()
    } catch {
      if (alive.current) setWriteFailed(true)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const armed = enabled === false

  return (
    <div
      data-testid="org-mcp-switch"
      data-armed={String(armed)}
      className={cn(
        "mt-3 rounded-md border px-4 py-3 transition-colors",
        armed ? "border-destructive/50 bg-destructive/[0.06]" : "border-border bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
            {M.orgSwitchTitle}
            {armed && (
              <span className="flex-none rounded-md border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                {fillCopy(M.orgSwitchOffTag, { org })}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs leading-snug text-muted-foreground">
            {fillCopy(M.orgSwitchSub, { org })}
          </div>
        </div>

        {enabled !== null && (
          <McpSwitch on={enabled} busy={busy} label={M.orgSwitchTitle} onToggle={() => void handleToggle()} />
        )}
      </div>

      {enabled === null && !loadFailed && (
        <p className="mt-2 text-xs text-muted-foreground">{M.orgSwitchLoading}</p>
      )}
      {loadFailed && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-destructive">
          <span>{M.orgSwitchLoadFailed}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {API_KEYS_COPY.tab.retry}
          </Button>
        </div>
      )}

      {armed && (
        <div className="mt-2 text-xs font-medium leading-snug text-destructive">
          {fillCopy(M.orgSwitchImpact, { org })}
        </div>
      )}

      {writeFailed && (
        <div className="mt-1.5 text-xs text-destructive" role="status">
          {M.orgSwitchFailed}
        </div>
      )}
    </div>
  )
}

/** The direct-flip switch: the shipped `CapabilitySwitch` look (20×36 track, `bg-primary/70` on,
 *  `bg-destructive/70` off), re-declared so the FIRING grid gains no export. */
function McpSwitch({
  on,
  busy,
  label,
  onToggle,
}: {
  on: boolean
  busy: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        on ? "bg-primary/70" : "bg-destructive/70",
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
