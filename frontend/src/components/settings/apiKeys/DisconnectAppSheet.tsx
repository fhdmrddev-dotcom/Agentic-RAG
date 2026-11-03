/**
 * Phase 307-05 (OAUTH-07; D-25, D-26; UI-SPEC §2d) — disconnect one app: the 066 victim-naming
 * guard on the key revoke sheet's shape (that sheet stays unchanged; a key keeps its own sheet).
 *
 * The sheet NAMES what stops: the app and its host, the org it acts in, what it can reach, when it
 * was last used. The admin view names the owner. "Keep it" holds focus (Radix AlertDialog focuses
 * Cancel); Esc and the scrim close it.
 *
 * ⚠ NEVER OPTIMISTIC. `disconnect(app)` is awaited, and only after the server answers does the caller
 *   get `onDone(app)` (it re-reads; the card leaves from the server's list). A failure keeps the sheet
 *   open, says the server's words, and says the app is still connected.
 */
import { useState } from "react"

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
import type { ConnectedApp, OrgConnectedApp } from "@/lib/api/oauth"
import { OAUTH_COPY } from "@/components/connect/oauthCopy"
import { fillCopy } from "./apiKeysCopy"
import { formatCallTime, formatDay } from "./apiKeyFacts"
import { appHost, appReach, boldTemplate } from "./ConnectedAppCard"
import { MCP_KEY_COPY } from "./mcpKeyCopy"

const S = OAUTH_COPY.sheet
const M = MCP_KEY_COPY.mcp

export function DisconnectAppSheet({
  target,
  admin = false,
  mcpTools,
  now,
  onClose,
  disconnect,
  onDone,
}: {
  target: ConnectedApp | OrgConnectedApp | null
  /** The org admin's view: the sub line names the owner. */
  admin?: boolean
  mcpTools?: readonly McpToolRef[]
  now?: Date
  onClose: () => void
  /** `disconnectApp` for the member, `disconnectOrgApp` for the admin. */
  disconnect: (app: ConnectedApp | OrgConnectedApp) => Promise<unknown>
  /** Called after the server answered OK; the caller re-reads. */
  onDone: (app: ConnectedApp | OrgConnectedApp) => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const at = now ?? new Date()

  async function handleDisconnect() {
    if (!target || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await disconnect(target)
      onDone(target)
      onClose()
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : ""
      setFailure(fillCopy(S.failed, { name: target.client_name, detail }).replace(/\s{2,}/g, " "))
    } finally {
      setBusy(false)
    }
  }

  const host = target ? appHost(target) : ""
  const owner =
    target && "owner_name" in target ? target.owner_name ?? OAUTH_COPY.org.unknownOwner : OAUTH_COPY.org.unknownOwner
  const reach = target ? appReach(target, mcpTools) : null
  const folders = reach
    ? reach.foldersAll
      ? M.chipAllFolders
      : fillCopy(M.sheetNFolders, { N: reach.folderCount })
    : ""

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          setFailure(null)
          onClose()
        }
      }}
    >
      <AlertDialogContent className="max-w-[480px] border-destructive/45 border-t-[3px] border-t-destructive">
        {target && reach && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="break-words font-headline text-xl font-semibold">
                {fillCopy(S.title, { name: target.client_name, host })}
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="disconnect-sub" className="text-sm">
                {admin ? boldTemplate(S.subAdmin, { owner }) : S.subOwn}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ul data-testid="disconnect-facts" className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{boldTemplate(S.factOrg, { org: target.org_name ?? M.orgFallback })}</li>
              <li>
                {boldTemplate(S.factReach, { tools: reach.tools, folders })}
                {reach.external && S.factReachExternal}
              </li>
              <li>
                {boldTemplate(S.factLastUsed, {
                  time: target.last_used_at ? formatCallTime(target.last_used_at, at) : M.notUsedYet,
                })}
              </li>
              <li>{boldTemplate(S.factConnected, { date: formatDay(target.created_at, at) })}</li>
            </ul>

            <div
              data-testid="disconnect-kept"
              className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              {S.kept}
            </div>

            {failure !== null && (
              <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
                {failure}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel className="font-semibold">{S.keep}</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={() => void handleDisconnect()} disabled={busy}>
                {busy ? S.busy : fillCopy(S.confirm, { name: target.client_name })}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
