/**
 * Phase 293-04 (D-03, D-18; sketch 293 C, "Org admin" state) — Org admin → API keys: every
 * member's keys in the active org, with owner names, and revoke on any of them.
 *
 * Self-contained on the `RetentionTab` shape: it owns its read (`listOrgApiKeys`), guards every
 * setState with an `alive` ref, keeps the last-known list on a failed re-read, and calls
 * `onRecorded()` after a revoke so the band's "every action recorded" marker pulses (062-A). No toast.
 *
 * ⚠ No New key button: an admin makes keys for themselves in Settings → API keys, like anyone.
 * ⚠ Run ids are links only on the admin's OWN keys: the run page is owner-scoped while a run is
 *   live, so a link on someone else's key would open a door that refuses them.
 * ⚠ The UI hides this tab from non-admins (the shell is admin-only), but the WALL is the server's
 *   `require_org_manage` on `/org/api-keys` (T-293-23): a forced call gets 403.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { listOrgApiKeys, revokeOrgApiKey, type ApiKeyList, type ApiKeyRead } from "@/lib/api/apiKeys"
import { ApiKeyCard } from "@/components/settings/apiKeys/ApiKeyCard"
import { RevokeApiKeySheet } from "@/components/settings/apiKeys/RevokeApiKeySheet"
import { API_KEYS_COPY, fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { orderKeys } from "@/components/settings/apiKeys/apiKeyFacts"

const C = API_KEYS_COPY

export function OrgApiKeysTab({
  orgName,
  onRecorded,
  onOpenAudit,
  onOpenRun,
}: {
  orgName?: string | null
  onRecorded?: () => void
  /** Switches the shell to its Audit tab. */
  onOpenAudit?: () => void
  /** Opens a run; handed ONLY to the admin's own keys. */
  onOpenRun?: (runId: string) => void
}) {
  const [list, setList] = useState<ApiKeyList | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRead | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listOrgApiKeys()
      if (!alive.current) return
      setList(res)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(err instanceof Error ? err.message : "")
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  const keys = list ? orderKeys(list.keys) : []

  return (
    <div className="grid gap-3">
      <div className="ghost-border rounded-xl bg-card/60 p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-headline text-base font-semibold">
          <KeyRound className="h-4 w-4 flex-none" aria-hidden="true" />
          {C.admin.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {orgName ? fillCopy(C.admin.description, { org: orgName }) : C.admin.descriptionNoOrg}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{C.admin.note}</p>
        {list !== null && keys.length > 0 && (
          <p data-testid="api-keys-limits" className="mt-2 text-xs text-muted-foreground">
            {fillCopy(C.tab.limits, { starts: list.limits.starts_per_minute, reads: list.limits.reads_per_minute })}
          </p>
        )}
      </div>

      {list === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {C.admin.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[C.admin.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {C.tab.retry}
          </Button>
        </div>
      )}

      {list !== null && keys.length === 0 && (
        <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center">
          <KeyRound className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {orgName ? fillCopy(C.admin.empty, { org: orgName }) : C.admin.emptyNoOrg}
          </p>
        </div>
      )}

      {keys.map((k) => (
        <ApiKeyCard
          key={k.id}
          apiKey={k}
          showOwner
          limits={list?.limits}
          orgName={orgName}
          onRevoke={setRevokeTarget}
          onOpenRun={k.owner_is_you ? onOpenRun : undefined}
          onOpenAudit={onOpenAudit}
        />
      ))}

      <RevokeApiKeySheet
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        revoke={revokeOrgApiKey}
        onDone={() => {
          onRecorded?.()
          void load()
        }}
      />
    </div>
  )
}
