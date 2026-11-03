/**
 * Phase 307-05 (OAUTH-07; D-25, D-28; UI-SPEC Surface 2) — Settings → API keys → Connected apps.
 *
 * Mounted ONCE as the first child of `ApiKeysTab`'s grid (SettingsPage is not edited). Self-contained
 * on the `RetentionTab` shape: its own read (`listMyConnectedApps`), an `alive` ref on every
 * setState, and the last-known list kept on a failed re-read.
 *
 * ⚠ RENDERS NOTHING, AND READS NOTHING, WHEN SIGN-IN IS NOT SERVED (`oauthAvailable` false = the
 *   server's `mcp.oauth`, i.e. no public base). Then `/mcp` is not mounted at all, so no grant can
 *   act, and the tab stays exactly 306's.
 * ⚠ Every app the member holds, in EVERY org, each naming its org (A-13): an app acting as you
 *   anywhere is visible from one place.
 * ⚠ NEVER OPTIMISTIC, NO TIMER (062-A): a disconnect re-reads the list; the receipt line stays until
 *   the next disconnect or unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Plug } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { McpToolRef } from "@/lib/api/apiKeys"
import { disconnectApp, listMyConnectedApps, type ConnectedApp } from "@/lib/api/oauth"
import { OAUTH_COPY } from "@/components/connect/oauthCopy"
import { fillCopy } from "./apiKeysCopy"
import { appHost, ConnectedAppCard } from "./ConnectedAppCard"
import { CopyButton, type CopyState } from "./McpConnectSnippets"
import { DisconnectAppSheet } from "./DisconnectAppSheet"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import { McpOffNotice } from "./McpOffNotice"

const A = OAUTH_COPY.apps
const M = MCP_KEY_COPY.mcp
const COPY_STATE_MS = 2000

export function ConnectedAppsSection({
  mcpUrl,
  mcpTools,
  oauthAvailable,
}: {
  mcpUrl: string | null
  mcpTools?: readonly McpToolRef[]
  /** The server's `mcp.oauth`: sign-in from an AI tool is served on this deployment. */
  oauthAvailable: boolean
}) {
  const [apps, setApps] = useState<ConnectedApp[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [target, setTarget] = useState<ConnectedApp | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listMyConnectedApps()
      if (!alive.current) return
      setApps(res.apps)
      setLoadError(null)
    } catch (err) {
      if (alive.current) setLoadError(err instanceof Error ? err.message : "") // keep the last-known list
    }
  }, [])

  useEffect(() => {
    alive.current = true
    if (oauthAvailable) void load()
    return () => {
      alive.current = false
    }
  }, [load, oauthAvailable])

  useEffect(() => {
    if (copyState === "idle") return
    const t = window.setTimeout(() => setCopyState("idle"), COPY_STATE_MS)
    return () => window.clearTimeout(t)
  }, [copyState])

  if (!oauthAvailable) return null

  function copyAddress() {
    if (!mcpUrl) return
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined
    if (!clip) {
      setCopyState("failed")
      return
    }
    clip.writeText(mcpUrl).then(
      () => alive.current && setCopyState("done"),
      () => alive.current && setCopyState("failed"),
    )
  }

  const deploymentOff = (apps ?? []).some((a) => a.mcp_off === "deployment")

  return (
    <div data-testid="connected-apps" className="grid gap-3">
      <div className="ghost-border rounded-xl bg-card/60 p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-headline text-base font-semibold">
          <Plug className="h-4 w-4 flex-none" aria-hidden="true" />
          {A.title}
          {apps !== null && (
            <span data-testid="connected-apps-count" className="font-mono text-xs font-normal text-muted-foreground">
              {apps.length}
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{A.description}</p>
        {mcpUrl ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{A.addressLead}</span>
            <code className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-xs text-foreground">
              {mcpUrl}
            </code>
            <CopyButton state={copyState} label={A.copyAddress} onCopy={copyAddress} />
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{M.noAddress}</p>
        )}
        {deploymentOff && <McpOffNotice scope="deployment" className="mt-2" />}
      </div>

      {receipt !== null && (
        <p data-testid="connected-apps-receipt" role="status" className="px-1 text-xs text-muted-foreground">
          {receipt}
        </p>
      )}

      {apps === null && loadError === null && (
        <p role="status" className="px-1 text-sm text-muted-foreground">
          {A.loading}
        </p>
      )}
      {loadError !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[hsl(0_80%_80%)]"
        >
          <span>{[A.loadFailed, loadError].filter(Boolean).join(" ")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            {A.retry}
          </Button>
        </div>
      )}

      {apps !== null && apps.length === 0 && (
        <div className="rounded-[14px] border border-border bg-card px-4 py-8 text-center">
          <Plug className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{A.empty}</p>
        </div>
      )}

      {(apps ?? []).map((a) => (
        <ConnectedAppCard key={a.id} app={a} mcpTools={mcpTools} onDisconnect={(x) => setTarget(x)} />
      ))}

      <DisconnectAppSheet
        target={target}
        mcpTools={mcpTools}
        onClose={() => setTarget(null)}
        disconnect={(a) => disconnectApp(a)}
        onDone={(a) => {
          setReceipt(fillCopy(A.receipt, { name: a.client_name, host: appHost(a) }))
          void load()
        }}
      />
    </div>
  )
}
