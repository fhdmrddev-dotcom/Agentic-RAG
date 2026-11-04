/**
 * Phase 307-05 (OAUTH-07; D-26, D-28; UI-SPEC Surface 3) — Org admin → API keys → the org's
 * connected apps, each with its own Disconnect, and Disconnect all.
 *
 * Mounted ONCE in `OrgApiKeysTab`, between the header card and the key list. Self-contained: its own
 * read (`listOrgConnectedApps`), an `alive` ref, the last-known list kept on a failed re-read.
 *
 * ⛔ DISCONNECT ALL IS THE 066 VICTIM-NAMING SHEET (target-specific, with victims): it names how many
 *   apps and members, the first three members, what ends and what is kept. "Keep them" holds focus.
 *   The server revokes grants in THIS org only (never a key, never another org); the receipt reads
 *   the SERVER's count, so a race between opening the sheet and confirming can never show a guess.
 * ⚠ After every server-confirmed write `onRecorded()` pulses the band's "every action recorded"
 *   marker (the 304 precedent) and the list re-reads. No toast, no timer (062-A).
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { McpToolRef } from "@/lib/api/apiKeys"
import {
  disconnectOrgApp,
  listOrgConnectedApps,
  revokeAllConnectedApps,
  type OrgConnectedApp,
} from "@/lib/api/oauth"
import { OAUTH_COPY } from "@/components/connect/oauthCopy"
import { fillCopy } from "@/components/settings/apiKeys/apiKeysCopy"
import { appHost, ConnectedAppCard } from "@/components/settings/apiKeys/ConnectedAppCard"
import { DisconnectAppSheet } from "@/components/settings/apiKeys/DisconnectAppSheet"
import { MCP_KEY_COPY } from "@/components/settings/apiKeys/mcpKeyCopy"

const A = OAUTH_COPY.apps
const O = OAUTH_COPY.org
const S = OAUTH_COPY.sheet

/** The first three members' names, then ", and K more" (distinct, in list order). */
export function victimNames(apps: readonly OrgConnectedApp[]): { names: string; members: number } {
  const owners: string[] = []
  for (const a of apps) {
    const n = a.owner_name ?? O.unknownOwner
    if (!owners.includes(n)) owners.push(n)
  }
  const shown = owners.slice(0, 3).join(O.allNamesSep)
  const more = owners.length - 3
  return { names: more > 0 ? shown + fillCopy(O.allNamesMore, { K: more }) : shown, members: owners.length }
}

export function OrgConnectedApps({
  orgName,
  mcpTools,
  oauthAvailable,
  onRecorded,
}: {
  orgName?: string | null
  mcpTools?: readonly McpToolRef[]
  /** The server's `mcp.oauth` (D-15). False: nothing renders and nothing is read (the tab is 306's). */
  oauthAvailable: boolean
  onRecorded?: () => void
}) {
  const [apps, setApps] = useState<OrgConnectedApp[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [target, setTarget] = useState<OrgConnectedApp | null>(null)
  const [allOpen, setAllOpen] = useState(false)
  const [allBusy, setAllBusy] = useState(false)
  const [allFailure, setAllFailure] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const alive = useRef(true)
  const org = orgName ?? MCP_KEY_COPY.mcp.orgFallback

  const load = useCallback(async () => {
    try {
      const res = await listOrgConnectedApps()
      if (!alive.current) return
      setApps(res.apps)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(err instanceof Error ? err.message : "")
    }
  }, [])

  useEffect(() => {
    alive.current = true
    if (oauthAvailable) void load()
    return () => {
      alive.current = false
    }
  }, [load, oauthAvailable])

  async function disconnectAll() {
    if (allBusy) return
    setAllBusy(true)
    setAllFailure(null)
    try {
      const res = await revokeAllConnectedApps()
      if (!alive.current) return
      onRecorded?.()
      setReceipt(fillCopy(O.allReceipt, { N: res.revoked, org }))
      setAllOpen(false)
      void load()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      if (alive.current) setAllFailure(fillCopy(O.allFailed, { detail }).replace(/\s{2,}/g, " "))
    } finally {
      if (alive.current) setAllBusy(false)
    }
  }

  if (!oauthAvailable) return null

  const list = apps ?? []
  const count = list.length
  const victims = victimNames(list)

  return (
    <section data-testid="org-connected-apps" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <h3 className="font-headline text-base font-semibold">{fillCopy(O.heading, { org })}</h3>
        {apps !== null && <span className="font-mono text-xs text-muted-foreground">{count}</span>}
        <span className="flex-1" />
        {count >= 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-destructive/45 text-destructive"
            onClick={() => {
              setAllFailure(null)
              setAllOpen(true)
            }}
          >
            {O.all}
          </Button>
        )}
      </div>
      <p className="-mt-2 px-1 text-xs text-muted-foreground">{O.description}</p>

      {receipt !== null && (
        <p data-testid="org-connected-apps-receipt" role="status" className="px-1 text-xs text-muted-foreground">
          {receipt}
        </p>
      )}

      {apps === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {O.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[O.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {A.retry}
          </Button>
        </div>
      )}

      {apps !== null && count === 0 && (
        <p className="px-1 text-sm text-muted-foreground">{fillCopy(O.empty, { org })}</p>
      )}

      {list.map((a) => (
        <ConnectedAppCard
          key={a.id}
          app={a}
          showOwner
          mcpTools={mcpTools}
          onDisconnect={(x) => setTarget(x as OrgConnectedApp)}
        />
      ))}

      <DisconnectAppSheet
        target={target}
        admin
        mcpTools={mcpTools}
        onClose={() => setTarget(null)}
        disconnect={(a) => disconnectOrgApp(a.id)}
        onDone={(a) => {
          onRecorded?.()
          setReceipt(fillCopy(A.receipt, { name: a.client_name, host: appHost(a) }))
          void load()
        }}
      />

      <AlertDialog
        open={allOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAllFailure(null)
            setAllOpen(false)
          }
        }}
      >
        <AlertDialogContent className="max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-xl font-semibold">
              {fillCopy(O.allTitle, { org })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">{fillCopy(O.allSub, { org })}</AlertDialogDescription>
          </AlertDialogHeader>

          <div data-testid="disconnect-all-facts" className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/40 p-3">
              <div className="font-headline text-base font-semibold">{count}</div>
              <div className="text-xs text-muted-foreground">{fillCopy(O.allFactApps, {}, count)}</div>
            </div>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="font-headline text-base font-semibold">{victims.members}</div>
              <div className="text-xs text-muted-foreground">{fillCopy(O.allFactMembers, {}, victims.members)}</div>
            </div>
          </div>
          <p data-testid="disconnect-all-names" className="text-sm text-muted-foreground">
            {victims.names}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{fillCopy(O.allConsequence, { org })}</li>
          </ul>
          <ul data-testid="disconnect-all-kept" className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {[O.allKeptKeys, O.allKeptOrgs].map((line) => (
              <li key={line}>
                <span className="text-success" aria-hidden="true">
                  {O.allKeptMark}
                </span>{" "}
                {line}
              </li>
            ))}
          </ul>

          {allFailure !== null && (
            <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
              {allFailure}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="font-semibold">{O.allKeep}</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void disconnectAll()} disabled={allBusy}>
              {allBusy ? S.busy : fillCopy(O.allConfirm, { N: count })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
