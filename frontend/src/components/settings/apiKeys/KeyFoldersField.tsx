/**
 * Phase 304-05 (D-08, D-22, D-23; UI-SPEC §1c row 4) — narrowing an MCP key to folders.
 *
 * Two radio rows (not segments, because the second opens a tree): **All folders I can see in
 * {org}** (the default) and **Only these folders**. The tree is nested NATIVE checkboxes in a
 * `role="group"`, not an ARIA tree (UI-SPEC §Interaction): Tab reaches each, Space toggles, and a
 * disabled row carries its reason through `aria-describedby`.
 *
 *  · a ticked folder includes its subtree: descendants render checked + disabled, "included";
 *  · a shared folder says "shared with the org" and starts unticked (D-22);
 *  · a mail / synced folder (the server's `source` hint, D-40) is disabled until "Include mail and
 *    synced sources" is ticked — that one control owns D-23's exclusion (the parent unticks these
 *    rows when it is unticked);
 *  · 16px indent per depth, capped at depth 4, the path in the row's `title`;
 *  · a filter input above more than 12 folders.
 *
 * Controlled: the draft card owns `mode` and `ticked`, so a switch of kind loses nothing. The folder
 * list is the server's `GET /api-keys/folders` (the member's own visibility, never `GET /folders`),
 * fetched by `ApiKeysTab`. Every word comes from `MCP_KEY_COPY`.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react"
import { Folder } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { PickableFolder } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import { filterFolderRows, flattenFolders, type FolderMode } from "./mcpKeyFacts"

const M = MCP_KEY_COPY.mcp
const MODES: readonly FolderMode[] = ["all", "only"]
const FILTER_ABOVE = 12
const MAX_DEPTH = 4

export function KeyFoldersField({
  orgName,
  folders,
  failed,
  onRetry,
  mode,
  onModeChange,
  ticked,
  onTickedChange,
  external,
}: {
  orgName: string | null
  /** null while the list loads (or after it failed). */
  folders: readonly PickableFolder[] | null
  failed: boolean
  onRetry: () => void
  mode: FolderMode
  onModeChange: (mode: FolderMode) => void
  ticked: readonly string[]
  onTickedChange: (ids: string[]) => void
  external: boolean
}) {
  const ids = { field: useId(), only: useId(), row: useId() }
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [query, setQuery] = useState("")
  const org = orgName || M.orgFallback
  const tickedSet = new Set(ticked)
  const rows = folders ? flattenFolders(folders, tickedSet) : []
  const shown = folders && folders.length > FILTER_ABOVE ? filterFolderRows(rows, query) : rows
  const ownCount = rows.filter((r) => tickedSet.has(r.folder.id) && !r.included).length

  function onRadioKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + MODES.length) % MODES.length
    onModeChange(MODES[next])
    radioRefs.current[next]?.focus()
  }

  function toggle(id: string) {
    onTickedChange(tickedSet.has(id) ? ticked.filter((x) => x !== id) : [...ticked, id])
  }

  const modeLabel = (m: FolderMode) => (m === "all" ? fillCopy(M.foldersAll, { org }) : M.foldersOnly)

  return (
    <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
      <span id={ids.field} className="pt-1.5 text-sm">
        {M.foldersField}
      </span>
      <div>
        <div role="radiogroup" aria-labelledby={ids.field} className="grid gap-1">
          {MODES.map((m, i) => (
            <button
              key={m}
              ref={(el) => {
                radioRefs.current[i] = el
              }}
              id={m === "only" ? ids.only : undefined}
              type="button"
              role="radio"
              aria-checked={mode === m}
              tabIndex={mode === m ? 0 : -1}
              onClick={() => onModeChange(m)}
              onKeyDown={(e) => onRadioKey(e, i)}
              className="flex min-h-[44px] items-center gap-2 rounded-md px-1 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 flex-none rounded-full border",
                  mode === m ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]" : "border-border",
                )}
              />
              {modeLabel(m)}
            </button>
          ))}
        </div>

        {mode === "all" ? (
          <p className="mt-1 text-xs text-muted-foreground">{M.foldersAllHint}</p>
        ) : (
          <div className="mt-2">
            {folders !== null && folders.length > FILTER_ABOVE && (
              <Input
                className="mb-2 h-8"
                aria-label={M.foldersFilter}
                placeholder={M.foldersFilter}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <div role="group" aria-labelledby={ids.only} className="max-h-[208px] overflow-y-auto rounded-md border border-border">
              {folders === null && !failed && (
                <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                  {M.foldersLoading}
                </p>
              )}
              {failed && (
                <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
                  <span>{M.foldersFailed}</span>
                  <Button type="button" variant="outline" size="sm" className="h-7" onClick={onRetry}>
                    {API_KEYS_COPY.tab.retry}
                  </Button>
                </div>
              )}
              {folders !== null && folders.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">{fillCopy(M.foldersNone, { org })}</p>
              )}
              {shown.map((r, i) => {
                const f = r.folder
                const needsExternal = f.source !== null && !external
                const disabled = r.included || needsExternal
                const reason = r.included ? M.folderIncluded : needsExternal ? M.folderNeedsExternal : null
                const reasonId = `${ids.row}-${i}`
                const chip = f.source === "mail" ? M.folderMail : f.source === "synced" ? M.folderSynced : f.shared ? M.folderShared : null
                return (
                  <label
                    key={f.id}
                    title={r.path}
                    style={{ paddingLeft: 12 + Math.min(r.depth, MAX_DEPTH) * 16 }}
                    className={cn(
                      "flex min-h-[44px] items-center gap-2 border-t border-border/60 py-1.5 pr-3 text-sm first:border-t-0 sm:min-h-0",
                      disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 flex-none accent-[hsl(var(--primary))]"
                      checked={r.checked}
                      disabled={disabled}
                      aria-describedby={reason ? reasonId : undefined}
                      onChange={() => toggle(f.id)}
                    />
                    <Folder className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    {chip && (
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{chip}</span>
                    )}
                    {reason && (
                      <span id={reasonId} className="text-right text-xs text-muted-foreground">
                        {reason}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{fillCopy(M.foldersCount, { N: ownCount })}</p>
            <p className="mt-1 text-xs text-muted-foreground">{M.foldersOnlyHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}
