/**
 * Phase 307-05 (OAUTH-07; D-25, D-26; UI-SPEC §2b, §3a) — one connected app, on the shipped
 * `ApiKeyCard` shape. The member view, and with `showOwner` the org admin's view (a "Connected app"
 * chip after the name and the owner first in the meta line).
 *
 * ⛔ The app's name is a CLAIM and renders as TEXT only (T-307-23): no markup, no link, no logo. The
 *   mark comes from what the server proved (the redirect kind), never from what the client said; the
 *   host chip is the fact, shown as a hostname only (a loopback port carries no trust, A-4).
 * ⚠ A grant has no secret, prefix, label, call strip or "How to connect" (D-15, D-17), so none render.
 * ⚠ Every word is read from `oauthCopy.ts` / `mcpKeyCopy.ts`; the verb is Disconnect, never the key verb (A-23).
 */
import type { ReactNode } from "react"
import { Globe, Laptop } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { McpToolRef } from "@/lib/api/apiKeys"
import type { ConnectedApp, OrgConnectedApp } from "@/lib/api/oauth"
import { OAUTH_COPY } from "@/components/connect/oauthCopy"
import { fillCopy } from "./apiKeysCopy"
import { formatCallTime, formatDay } from "./apiKeyFacts"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import { mcpScopeChips } from "./mcpKeyFacts"
import { McpOffNotice } from "./McpOffNotice"

const A = OAUTH_COPY.apps
const M = MCP_KEY_COPY.mcp

/** A template whose `{slot}`s render bold (the 304 fact-line voice); the words around stay plain. */
export function boldTemplate(template: string, values: Record<string, string>, boldClass = "font-semibold text-foreground"): ReactNode[] {
  return template.split(/(\{[a-zA-Z]+\})/).map((part, i) => {
    const key = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null
    if (key !== null && key in values) {
      return (
        <b key={i} className={boldClass}>
          {values[key]}
        </b>
      )
    }
    return <span key={i}>{part}</span>
  })
}

/** The app's host as shown everywhere: the parsed hostname, or a plain "unknown address". */
export function appHost(app: Pick<ConnectedApp, "redirect_host">): string {
  return app.redirect_host || A.unknownHost
}

/** "Read only" / "2 tools", "All folders" / the folder names, "mail & synced sources". */
export function appReach(app: ConnectedApp, catalogue: readonly McpToolRef[] | undefined) {
  const m = mcpScopeChips(app, catalogue)
  const tools = m.tools.preset === "custom" ? fillCopy(M.chipNTools, { N: m.tools.count }) : M.presets[m.tools.preset]
  const count = m.folders.shown.length + m.folders.more.length
  return { model: m, tools, foldersAll: m.folders.all, folderCount: count, external: m.external }
}

const CHIP = "rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
const FACT = "font-semibold text-foreground/80"

export function ConnectedAppCard({
  app,
  showOwner = false,
  mcpTools,
  now,
  onDisconnect,
}: {
  app: ConnectedApp | OrgConnectedApp
  /** The org admin's view: the "Connected app" chip and the owner first in the meta line. */
  showOwner?: boolean
  mcpTools?: readonly McpToolRef[]
  now?: Date
  onDisconnect: (app: ConnectedApp | OrgConnectedApp) => void
}) {
  const at = now ?? new Date()
  const host = appHost(app)
  const loopback = app.redirect_kind === "loopback"
  const Mark = loopback ? Laptop : Globe
  const reach = appReach(app, mcpTools)
  const owner = showOwner && "owner_name" in app ? app.owner_name ?? OAUTH_COPY.org.unknownOwner : null
  const org = app.org_name ?? M.orgFallback

  const meta: ReactNode[] = []
  if (owner !== null) meta.push(boldTemplate(A.metaOwner, { name: owner }, FACT))
  meta.push(boldTemplate(A.metaActsIn, { org }, FACT))
  meta.push(boldTemplate(A.metaConnected, { date: formatDay(app.created_at, at) }, FACT))
  meta.push(
    app.last_used_at
      ? boldTemplate(A.metaLastUsed, { time: formatCallTime(app.last_used_at, at) }, FACT)
      : <b className={FACT}>{M.notUsedYet}</b>,
  )
  if (app.expires_at) meta.push(boldTemplate(A.metaLapses, { date: formatDay(app.expires_at, at) }, FACT))

  return (
    <div
      data-testid={`connected-app-${app.id}`}
      data-mark={loopback ? "loopback" : "web"}
      className="rounded-[14px] border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Mark className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 break-words font-headline text-base font-semibold">{app.client_name}</span>
        {showOwner && <span className={CHIP}>{A.chipConnectedApp}</span>}
        {app.name_source === "dcr" && <span className="text-xs text-muted-foreground">{OAUTH_COPY.consent.callsItself}</span>}
        <span data-testid="connected-app-host" className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-xs">
          {host}
        </span>
        {app.name_source === "cimd" && (
          <span className="rounded-md border border-success/40 px-1.5 py-0.5 text-xs text-success">
            {OAUTH_COPY.consent.tagVerified}
          </span>
        )}
        {app.mcp_off && (
          <span className="rounded-md border border-warning/40 px-1.5 py-0.5 text-xs text-warning">{M.tagOff}</span>
        )}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-destructive"
          aria-label={fillCopy(A.disconnectAria, { name: app.client_name, host })}
          onClick={() => onDisconnect(app)}
        >
          {A.disconnect}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={CHIP} title={reach.model.tools.names.join(", ")}>
          {reach.tools}
        </span>
        {reach.foldersAll ? (
          <span className={CHIP}>{M.chipAllFolders}</span>
        ) : (
          <>
            {reach.model.folders.shown.map((f) => (
              <span key={f.id} className={CHIP}>
                {f.name}
              </span>
            ))}
            {reach.model.folders.more.length > 0 && (
              <span className={CHIP} title={reach.model.folders.more.map((f) => f.name).join(", ")}>
                {fillCopy(M.chipMore, { N: reach.model.folders.more.length })}
              </span>
            )}
          </>
        )}
        {reach.external && <span className={CHIP}>{M.chipExternal}</span>}
      </div>

      {app.mcp_off && <McpOffNotice scope={app.mcp_off} variant="card" className="mt-2" />}

      <p data-testid="connected-app-meta" className="mt-2 text-xs text-muted-foreground">
        {meta.map((part, i) => (
          <span key={i}>
            {i > 0 && A.metaSep}
            {part}
          </span>
        ))}
      </p>
    </div>
  )
}
