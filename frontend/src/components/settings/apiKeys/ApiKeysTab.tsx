/**
 * Phase 293-04 (START-02; D-02, D-04, D-17, D-18, D-19, D-21) — Settings → API keys, the member's
 * ONE home for keys (sketch 293 variant C: a card per key, the draft card becomes the key).
 *
 * Self-contained on the `RetentionTab` shape: it owns its reads (`listApiKeys`, and
 * `listStartableWorkflows` when a draft opens), guards every setState with an `alive` ref, and a
 * failed re-read keeps what it last knew.
 *
 * ⛔ THE SECRET (T-293-21). The just-created secret lives in THIS component's `useState` and
 *   nowhere else: no ref that outlives unmount, no storage, no URL, no log, no query cache. It is
 *   dropped on "I've saved the secret", and on unmount (which is what a Settings tab switch or a
 *   reload is), so it can never be shown twice. The re-fetch after creation reads `/api-keys`,
 *   which never carries a secret.
 *
 * ⚠ The ⋯ menu pre-pick is read ONCE on mount (`readApiKeyPrepickOnce` clears it in the same read),
 *   and opens the draft with that workflow already ticked.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { API_BASE } from "@/lib/api/_core"
import {
  createApiKey,
  listApiKeys,
  listStartableWorkflows,
  revokeApiKey,
  type ApiKeyCreateBody,
  type ApiKeyList,
  type ApiKeyRead,
  type StartableWorkflowList,
} from "@/lib/api/apiKeys"
import { readApiKeyPrepickOnce, type ApiKeyPrepick } from "./apiKeyPrepick"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { orderKeys } from "./apiKeyFacts"
import { apiBaseForCurl } from "./curlExamples"
import { ApiKeyCard } from "./ApiKeyCard"
import { ApiKeyDraftCard } from "./ApiKeyDraftCard"
import { ApiKeySecretOnce } from "./ApiKeySecretOnce"
import { RevokeApiKeySheet } from "./RevokeApiKeySheet"

const C = API_KEYS_COPY

interface JustCreated {
  key: ApiKeyRead
  secret: string
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : ""
}

export function ApiKeysTab({
  onOpenRun,
  onOpenAudit,
}: {
  onOpenRun?: (runId: string) => void
  /** Switches Settings to the Audit Log tab ("4"); the link is hidden without it. */
  onOpenAudit?: () => void
}) {
  const [list, setList] = useState<ApiKeyList | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [from, setFrom] = useState<ApiKeyPrepick | null>(null)
  const [picker, setPicker] = useState<StartableWorkflowList | null>(null)
  const [pickerFailed, setPickerFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createFailure, setCreateFailure] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<JustCreated | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRead | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listApiKeys()
      if (!alive.current) return
      setList(res)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(messageOf(err)) // keep the last-known list
    }
  }, [])

  const loadPicker = useCallback(async () => {
    setPickerFailed(false)
    try {
      const res = await listStartableWorkflows()
      if (alive.current) setPicker(res)
    } catch {
      if (alive.current) setPickerFailed(true)
    }
  }, [])

  const openDraft = useCallback(
    (pick: ApiKeyPrepick | null) => {
      setFrom(pick)
      setCreateFailure(null)
      setDrafting(true)
      setPicker(null)
      void loadPicker()
    },
    [loadPicker],
  )

  useEffect(() => {
    alive.current = true
    void load()
    const pick = readApiKeyPrepickOnce()
    if (pick) openDraft(pick)
    return () => {
      alive.current = false
    }
  }, [load, openDraft])

  async function handleCreate(body: ApiKeyCreateBody) {
    setCreating(true)
    setCreateFailure(null)
    try {
      const res = await createApiKey(body)
      if (!alive.current) return
      setJustCreated({ key: res.key, secret: res.secret })
      setDrafting(false)
      setFrom(null)
      void load()
    } catch (err) {
      if (alive.current) {
        setCreateFailure(fillCopy(C.draft.createFailed, { sentence: messageOf(err) }).replace(/\s{2,}/g, " "))
      }
    } finally {
      if (alive.current) setCreating(false)
    }
  }

  function savedSecret() {
    const id = justCreated?.key.id ?? null
    setJustCreated(null) // the secret leaves the page here
    setFreshId(id)
  }

  const keys = list ? orderKeys(list.keys) : []
  // The just-created key is shown by the show-once card, not twice.
  const listed = justCreated ? keys.filter((k) => k.id !== justCreated.key.id) : keys
  const showNewKey = list !== null && keys.length > 0 && !drafting && !justCreated
  const base = apiBaseForCurl(API_BASE, window.location.origin)
  const firstFields =
    justCreated && picker ? picker.workflows.find((w) => w.id === justCreated.key.workflows[0]?.id)?.fields ?? [] : []

  return (
    <div className="grid gap-3">
      <div className="ghost-border rounded-xl bg-card/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 font-headline text-base font-semibold">
              <KeyRound className="h-4 w-4 flex-none" aria-hidden="true" />
              {C.tab.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{C.tab.description}</p>
            {list !== null && keys.length > 0 && (
              <p data-testid="api-keys-limits" className="mt-2 text-xs text-muted-foreground">
                {fillCopy(C.tab.limits, { starts: list.limits.starts_per_minute, reads: list.limits.reads_per_minute })}
              </p>
            )}
          </div>
          {showNewKey && (
            <Button type="button" className="gradient-primary" onClick={() => openDraft(null)}>
              {C.tab.newKey}
            </Button>
          )}
        </div>
      </div>

      {list === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {C.tab.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[C.tab.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {C.tab.retry}
          </Button>
        </div>
      )}

      {drafting && (
        <ApiKeyDraftCard
          workflows={picker?.workflows ?? null}
          workflowsFailed={pickerFailed}
          draftsHidden={picker?.drafts_hidden ?? 0}
          from={from}
          busy={creating}
          failure={createFailure}
          onRetryWorkflows={() => void loadPicker()}
          onCreate={(body) => void handleCreate(body)}
          onDiscard={() => {
            setDrafting(false)
            setFrom(null)
            setCreateFailure(null)
          }}
        />
      )}

      {justCreated && (
        <ApiKeySecretOnce
          created={justCreated.key}
          secret={justCreated.secret}
          base={base}
          fields={firstFields}
          onDone={savedSecret}
        />
      )}

      {list !== null && keys.length === 0 && !drafting && !justCreated && (
        <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center">
          <KeyRound className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="mx-auto mb-4 mt-2 max-w-md text-sm text-muted-foreground">{C.tab.empty}</p>
          <Button type="button" className="gradient-primary" onClick={() => openDraft(null)}>
            {C.tab.newKey}
          </Button>
        </div>
      )}

      {listed.map((k) => (
        <ApiKeyCard
          key={k.id}
          apiKey={k}
          fresh={k.id === freshId}
          limits={list?.limits}
          onRevoke={setRevokeTarget}
          onOpenRun={onOpenRun}
          onOpenAudit={onOpenAudit}
        />
      ))}

      <RevokeApiKeySheet
        target={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        revoke={revokeApiKey}
        onDone={() => void load()}
      />
    </div>
  )
}
