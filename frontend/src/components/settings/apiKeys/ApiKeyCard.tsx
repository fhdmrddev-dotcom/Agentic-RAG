/**
 * Phase 293-04 (D-05, D-17) — ONE key card, in every state (sketch 293 variant C).
 *
 * Presentational: it fetches nothing and holds only its own "activity open" toggle. Every fact it
 * prints comes from `apiKeyFacts.keyCardFacts`, every word from `apiKeysCopy.ts`.
 *
 * ⚠ A key with a workflow that is no longer startable never reads `● active` (UI-SPEC failure 3):
 *   the tag turns amber, the chip turns dashed, and a line says why calls to it are refused.
 * ⚠ The prop is `apiKey`, not `key`: React reserves `key` and would never hand it to the component.
 *
 * `showOwner` is the admin view (owner name first on the meta line, ` (you)` on the admin's own).
 * `fresh` is the 1.6 s green border after "I've saved the secret" (the only motion on this tab).
 */
import { useEffect, useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ApiKeyLimits, ApiKeyRead } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { keyCardFacts, type KeyTagKind } from "./apiKeyFacts"
import { ApiKeyActivity } from "./ApiKeyActivity"
import { ApiKeyCallStrip } from "./ApiKeyCallStrip"

const C = API_KEYS_COPY

const TAG_CLASS: Record<KeyTagKind, string> = {
  active: "border-success/40 text-success",
  refused: "border-warning/50 text-warning",
  expired: "border-dashed border-border text-muted-foreground",
  revoked: "border-dashed border-border text-muted-foreground",
}

const FRESH_MS = 1600

export function ApiKeyCard({
  apiKey,
  now,
  showOwner = false,
  fresh = false,
  limits,
  orgName,
  onRevoke,
  onOpenRun,
  onOpenAudit,
}: {
  apiKey: ApiKeyRead
  now?: Date
  showOwner?: boolean
  fresh?: boolean
  limits?: ApiKeyLimits
  orgName?: string | null
  onRevoke?: (key: ApiKeyRead) => void
  onOpenRun?: (runId: string) => void
  onOpenAudit?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [glow, setGlow] = useState(fresh)
  useEffect(() => {
    if (!fresh) return
    setGlow(true)
    const t = window.setTimeout(() => setGlow(false), FRESH_MS)
    return () => window.clearTimeout(t)
  }, [fresh])

  const at = now ?? new Date()
  const f = keyCardFacts(apiKey, at)
  const ctx = { key: apiKey, limits, orgName, now: at }
  const hasCalls = apiKey.calls.length > 0

  return (
    <div
      data-testid="api-key-card"
      data-dead={f.dead ? "true" : "false"}
      data-fresh={fresh ? "true" : "false"}
      className={cn(
        "rounded-[14px] border bg-card p-4 transition-colors duration-500",
        f.dead && "opacity-[0.62]",
        glow ? "border-success/55" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span data-testid="api-key-label" className="font-headline text-base font-semibold">
          {apiKey.label}
        </span>
        <span className={cn("rounded-md border px-1.5 py-0.5 text-xs", TAG_CLASS[f.tag.kind])}>{f.tag.text}</span>
        <span className="font-mono text-xs text-muted-foreground">{apiKey.key_prefix}…</span>
        <span className="flex-1" />
        {f.receipt !== null ? (
          <span data-testid="api-key-receipt" className="text-xs text-muted-foreground">
            {f.receipt}
          </span>
        ) : apiKey.state === "active" && onRevoke ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            aria-label={fillCopy(C.card.revokeAria, { label: apiKey.label })}
            onClick={() => onRevoke(apiKey)}
          >
            {C.card.revoke}
          </Button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {f.chips.map((chip) => (
          <span
            key={chip.id}
            data-testid="api-key-chip"
            data-refused={chip.refused ? "true" : "false"}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              chip.refused ? "border-dashed border-warning/60 text-warning" : "border-border bg-muted/40",
            )}
          >
            {chip.text}
          </span>
        ))}
      </div>
      {f.refusalLines.map((line) => (
        <p key={line} className="mt-1 text-xs text-warning">
          {line}
        </p>
      ))}

      <div data-testid="api-key-meta" className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {showOwner && (
          <>
            <span>
              {C.card.metaOwner}
              <b className="font-semibold text-foreground/80">{apiKey.owner_name ?? C.sheet.unknownOwner}</b>
              {apiKey.owner_is_you ? C.card.metaYou : ""}
            </span>
            <span aria-hidden="true">{" · "}</span>
          </>
        )}
        <span>
          {C.card.metaExpires}
          <b className="font-semibold text-foreground/80">{f.expires}</b> ({f.expiresRelative})
        </span>
        <span aria-hidden="true">{" · "}</span>
        <span>
          {C.card.metaLastUsed}
          <b className="font-semibold text-foreground/80">{f.lastUsed}</b>
        </span>
        <span aria-hidden="true">{" · "}</span>
        <span>
          {C.card.metaCreated}
          {f.created}
        </span>
      </div>

      {(apiKey.state === "active" || hasCalls) && (
        <ApiKeyCallStrip calls={apiKey.calls} now={at} label={apiKey.label} ctx={ctx} />
      )}

      {hasCalls && (
        <div className="mt-2">
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setOpen((o) => !o)}>
            {open ? C.card.hideActivity : C.card.showActivity}
          </button>
        </div>
      )}
      {open && (
        <div className="mt-2">
          <ApiKeyActivity
            calls={apiKey.calls}
            revoked={apiKey.state === "revoked"}
            lastUsed={f.lastUsed}
            now={at}
            ctx={ctx}
            onOpenRun={onOpenRun}
            onOpenAudit={onOpenAudit}
          />
        </div>
      )}
    </div>
  )
}
