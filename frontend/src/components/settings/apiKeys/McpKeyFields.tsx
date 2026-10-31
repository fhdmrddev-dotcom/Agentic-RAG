/**
 * Phase 304-05 (KEY-02, KEY-03, KEY-04; D-07, D-11, D-12, D-23; UI-SPEC §1c rows 2-7) — the MCP rows
 * of the draft card, under its shared Label row: Organisation, Tools, Folders, Include mail and
 * synced sources, Expires, and the acts-as note. The draft card renders Label and the actions.
 *
 * ⚠ THE CATALOGUE IS THE SERVER'S (D-11). Tool names and their plain labels come only from
 *   `list.mcp.tools`; this file spells only the three group headings and the four preset names.
 *   Presets are derived from that list by `mcpKeyFacts` (never a retyped set).
 * ⚠ SAFE DEFAULTS (SC2 / KEY-04): Read only, All folders, mail and synced left out, 90 days, and no
 *   Never (D-07: an AI tool key always expires). Ask and run start unticked.
 * ⚠ Companions (D-12) are disabled mirrors of their lead with "comes with {tool}": they are never
 *   ticked or unticked on their own.
 *
 * Controlled (`value` / `onChange`), so the draft card keeps these choices across a switch of kind.
 */
import { useId, useRef, type KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { McpToolRef, PickableFolder } from "@/lib/api/apiKeys"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import {
  MCP_EXPIRIES,
  MCP_GROUPS,
  MCP_PRESET_CHOICES,
  companionLead,
  draftTools,
  type McpDraft,
} from "./mcpKeyFacts"
import { KeyFoldersField } from "./KeyFoldersField"

const M = MCP_KEY_COPY.mcp

/** A segmented `role="radiogroup"` with the shipped Expires control's roving tabindex. */
function Segments<T extends string>({
  labelledBy,
  options,
  value,
  label,
  onChange,
}: {
  labelledBy: string
  options: readonly T[]
  value: T
  label: (o: T) => string
  onChange: (o: T) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + options.length) % options.length
    onChange(options[next])
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="inline-flex flex-wrap rounded-md border border-border p-0.5">
      {options.map((o, i) => (
        <button
          key={o}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === o}
          tabIndex={value === o ? 0 : -1}
          onClick={() => onChange(o)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            "min-h-[44px] rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0",
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

export function McpKeyFields({
  orgName,
  catalogue,
  catalogueFailed,
  onRetryCatalogue,
  folders,
  foldersFailed,
  onRetryFolders,
  value,
  onChange,
}: {
  orgName: string | null
  /** The server's catalogue (`list.mcp.tools`); null while it is not known. */
  catalogue: readonly McpToolRef[] | null
  catalogueFailed: boolean
  onRetryCatalogue: () => void
  folders: readonly PickableFolder[] | null
  foldersFailed: boolean
  onRetryFolders: () => void
  value: McpDraft
  onChange: (next: McpDraft) => void
}) {
  const ids = { org: useId(), tools: useId(), exp: useId(), ext: useId(), why: useId(), askExt: useId() }
  const groupIds = { read: useId(), ask: useId(), run: useId() }
  const org = orgName || M.orgFallback
  const tools = catalogue ? draftTools(value, catalogue) : []
  // 306-05 (D-29): the ask group's lead, read from the server's catalogue (D-11: no name retyped).
  const askLead = catalogue?.find((t) => t.group === "ask" && !t.travels_with)?.name
  const askNeedsExternal = !!askLead && tools.includes(askLead) && !value.external

  function toggleTool(name: string) {
    if (!catalogue) return
    const next = tools.includes(name) ? tools.filter((t) => t !== name) : [...tools, name]
    // A hand tick always moves to Choose tools (UI-SPEC §1c); companions follow in draftTools.
    onChange({ ...value, preset: "custom", custom: next.filter((t) => companionLead(t, catalogue) === null) })
  }

  function setExternal(on: boolean) {
    // D-23: unticking the one control also unticks every connector-fed folder.
    const fed = new Set((folders ?? []).filter((f) => f.source !== null).map((f) => f.id))
    onChange({ ...value, external: on, folderIds: on ? value.folderIds : value.folderIds.filter((id) => !fed.has(id)) })
  }

  return (
    <>
      <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
        <span id={ids.org} className="text-sm">
          {M.orgField}
        </span>
        <div>
          <b data-testid="mcp-org" className="text-sm font-semibold">
            {org}
          </b>
          <p className="mt-1 text-xs text-muted-foreground">{M.orgHint}</p>
        </div>
      </div>

      <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
        <span id={ids.tools} className="pt-1.5 text-sm">
          {M.toolsField}
        </span>
        <div className="grid gap-2">
          <Segments
            labelledBy={ids.tools}
            options={MCP_PRESET_CHOICES}
            value={value.preset}
            label={(p) => M.presets[p]}
            onChange={(p) =>
              onChange(p === "custom" ? { ...value, preset: "custom", custom: tools } : { ...value, preset: p })
            }
          />
          <div className="max-h-[208px] overflow-y-auto rounded-md border border-border">
            {catalogue === null && !catalogueFailed && (
              <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                {M.toolsLoading}
              </p>
            )}
            {catalogueFailed && (
              <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
                <span>{M.toolsFailed}</span>
                <Button type="button" variant="outline" size="sm" className="h-7" onClick={onRetryCatalogue}>
                  {API_KEYS_COPY.tab.retry}
                </Button>
              </div>
            )}
            {catalogue &&
              MCP_GROUPS.map((g) => {
                const rows = catalogue.filter((t) => t.group === g)
                if (rows.length === 0) return null
                return (
                  <div key={g} role="group" aria-labelledby={groupIds[g]} className="border-t border-border/60 first:border-t-0">
                    <p id={groupIds[g]} className="px-3 pt-2 text-xs text-muted-foreground">
                      {M.groups[g]}
                    </p>
                    {rows.map((t) => {
                      const lead = t.travels_with
                      const reasonId = `${ids.why}-${t.name}`
                      return (
                        <label
                          key={t.name}
                          className={cn(
                            "flex min-h-[44px] items-center gap-2 px-3 py-1.5 text-sm sm:min-h-0",
                            lead ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 flex-none accent-[hsl(var(--primary))]"
                            checked={tools.includes(t.name)}
                            disabled={lead !== null}
                            aria-describedby={lead ? reasonId : undefined}
                            onChange={() => toggleTool(t.name)}
                          />
                          <span className="font-mono text-xs">{t.name}</span>
                          <span className="flex-1 text-xs text-muted-foreground">{t.label}</span>
                          {lead && (
                            <span id={reasonId} className="text-right text-xs text-muted-foreground">
                              {fillCopy(M.comesWith, { tool: lead })}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )
              })}
          </div>
          <p className="text-xs text-muted-foreground">{M.toolsHint}</p>
        </div>
      </div>

      <KeyFoldersField
        orgName={orgName}
        folders={folders}
        failed={foldersFailed}
        onRetry={onRetryFolders}
        mode={value.folderMode}
        onModeChange={(folderMode) => onChange({ ...value, folderMode })}
        ticked={value.folderIds}
        onTickedChange={(folderIds) => onChange({ ...value, folderIds })}
        external={value.external}
      />

      <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
        <span aria-hidden="true" />
        <label className="flex min-h-[44px] cursor-pointer items-start gap-2 text-sm sm:min-h-0">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 flex-none accent-[hsl(var(--primary))]"
            checked={value.external}
            aria-describedby={askNeedsExternal ? `${ids.ext} ${ids.askExt}` : ids.ext}
            onChange={(e) => setExternal(e.target.checked)}
          />
          <span>
            {M.externalField}
            <span id={ids.ext} className="mt-0.5 block text-xs text-muted-foreground">
              {M.externalSub}
            </span>
            {askNeedsExternal && (
              // 306-05 (UI-SPEC §7c, D-29): a warning, never a blocker: Create stays enabled.
              <span id={ids.askExt} className="mt-1 block text-xs text-warning">
                {M.askNeedsExternalHint}
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
        <span id={ids.exp} className="pt-1.5 text-sm">
          {API_KEYS_COPY.draft.expiresField}
        </span>
        <div>
          <Segments
            labelledBy={ids.exp}
            options={MCP_EXPIRIES}
            value={value.expiry}
            label={(e) => API_KEYS_COPY.draft.expiresOptions[e]}
            onChange={(expiry) => onChange({ ...value, expiry })}
          />
          <p className="mt-1 text-xs text-muted-foreground">{M.expiresHint}</p>
        </div>
      </div>

      <p data-testid="mcp-acts-as" className="border-l-[3px] border-primary bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {M.actsLead}
        <b className="font-semibold text-foreground">{M.actsBold}</b>
        {fillCopy(M.actsTail, { org })}
      </p>
    </>
  )
}
