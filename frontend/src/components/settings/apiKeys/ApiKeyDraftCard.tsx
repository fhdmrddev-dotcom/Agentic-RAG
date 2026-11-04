/**
 * Phase 293-04 (D-02, D-04, D-11, D-18) — the create form inside the draft card (sketch C).
 *
 * Label (1-60 characters, trimmed), the caller's PUBLISHED workflows from the server (a file-upload
 * one is a disabled row with its reason), and an expiry of 30 / 90 / 365 days or never, with 90
 * preselected (D-04). Create key stays disabled, and SAYS why (`aria-describedby`), until a label
 * and one workflow are present.
 *
 * ⚠ Esc does nothing destructive here; only Discard draft discards. A create failure keeps every
 *   value the person chose (the parent owns `failure` and never remounts this card on it).
 * ⚠ A ⋯ menu pre-pick is ticked only once the server's list says it CAN be ticked, and the hint
 *   waits for that list too, so it never claims "already picked" about a row it could not tick.
 *
 * Phase 304-05 (D-01, D-07, D-08, D-30): when the deployment can make AI tool keys, the first row is
 * `<ApiKeyKindChoice>` and nothing else shows until a kind is chosen (a ⋯ menu pre-pick chooses
 * `workflow`). `kind="workflow"` renders the 293 form below unchanged; `kind="mcp"` renders
 * `<McpKeyFields>` under the shared Label. Each kind keeps its own choices until the draft is
 * discarded. When MCP is not available (no `mcp`, or `available` false) there is no choice row and
 * this card is 293's, byte for byte.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ApiKeyCreateBody, ApiKeyKind, McpOff, McpToolRef, PickableFolder, StartableWorkflow } from "@/lib/api/apiKeys"
import type { ApiKeyPrepick } from "./apiKeyPrepick"
import { API_KEYS_COPY, fillCopy } from "./apiKeysCopy"
import { startableRowFacts } from "./apiKeyFacts"
import { MCP_KEY_COPY } from "./mcpKeyCopy"
import {
  MCP_DRAFT_DEFAULT,
  MCP_EXPIRY_DAYS,
  draftFolderIds,
  draftTools,
  mcpCreateBlocker,
  type McpBlocker,
  type McpDraft,
} from "./mcpKeyFacts"
import { ApiKeyKindChoice } from "./ApiKeyKindChoice"
import { McpKeyFields } from "./McpKeyFields"

const C = API_KEYS_COPY
const M = MCP_KEY_COPY

type Expiry = "30" | "90" | "365" | "never"
const EXPIRIES: readonly Expiry[] = ["30", "90", "365", "never"]
const EXPIRY_DAYS: Record<Expiry, 30 | 90 | 365 | null> = { "30": 30, "90": 90, "365": 365, never: null }
const MAX_LABEL = 60

const BLOCKER_WORDS: Record<McpBlocker, string> = {
  needLabel: C.draft.needLabel,
  needTool: M.mcp.needTool,
  needFolder: M.mcp.needFolder,
  waitTools: M.mcp.waitTools,
  waitFolders: M.mcp.waitFolders,
}

export function ApiKeyDraftCard({
  workflows,
  workflowsFailed,
  draftsHidden,
  from,
  busy,
  failure,
  onRetryWorkflows,
  onCreate,
  onDiscard,
  mcp,
  orgName = null,
  folders = null,
  foldersFailed = false,
  onRetryFolders,
  onRetryCatalogue,
  onKindChange,
}: {
  /** null while the picker list loads. */
  workflows: readonly StartableWorkflow[] | null
  workflowsFailed: boolean
  draftsHidden: number
  from: ApiKeyPrepick | null
  busy: boolean
  failure: string | null
  onRetryWorkflows: () => void
  onCreate: (body: ApiKeyCreateBody) => void
  onDiscard: () => void
  /** Phase 304: the list's MCP availability and the server's tool catalogue. Absent = 293's draft. */
  mcp?: { available: boolean; off: McpOff | null; tools: readonly McpToolRef[] }
  /** The active org, named on the MCP rows. */
  orgName?: string | null
  /** The member's pickable folders (`GET /api-keys/folders`), null while they load. */
  folders?: readonly PickableFolder[] | null
  foldersFailed?: boolean
  onRetryFolders?: () => void
  onRetryCatalogue?: () => void
  /** Told when a kind is chosen, so the owner can fetch the MCP folders the first time. */
  onKindChange?: (kind: ApiKeyKind) => void
}) {
  const mcpAvailable = mcp?.available === true
  const [kind, setKind] = useState<ApiKeyKind | null>(() => (!mcpAvailable || from ? "workflow" : null))
  const [label, setLabel] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [expiry, setExpiry] = useState<Expiry>("90")
  const [mcpDraft, setMcpDraft] = useState<McpDraft>(MCP_DRAFT_DEFAULT)
  const appliedFrom = useRef(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const focusLabel = useRef(kind !== null)
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([])
  const ids = { label: useId(), why: useId(), wf: useId(), exp: useId() }

  useEffect(() => {
    if (!focusLabel.current) return
    focusLabel.current = false
    labelRef.current?.focus()
  }, [kind])

  function chooseKind(next: ApiKeyKind, how: "arrow" | "activate") {
    if (next === kind) {
      if (how === "activate") labelRef.current?.focus()
      return
    }
    if (how === "activate") focusLabel.current = true
    setKind(next)
    onKindChange?.(next)
  }

  const fromRow = from && workflows ? workflows.find((w) => w.id === from.workflowId) ?? null : null
  useEffect(() => {
    if (appliedFrom.current || !fromRow) return
    appliedFrom.current = true
    if (fromRow.startable) setPicked([fromRow.id])
  }, [fromRow])

  const trimmed = label.trim()
  const catalogue = mcp && mcp.tools.length > 0 ? mcp.tools : null
  const mcpTools = catalogue ? draftTools(mcpDraft, catalogue) : []
  const mcpBlocker =
    kind === "mcp"
      ? mcpCreateBlocker({
          label,
          tools: mcpTools,
          folderMode: mcpDraft.folderMode,
          folderIds: mcpDraft.folderIds,
          catalogueLoaded: catalogue !== null,
          foldersLoaded: folders !== null,
        })
      : null
  const why =
    kind === null
      ? M.kind.chooseFirst
      : kind === "mcp"
        ? mcpBlocker && BLOCKER_WORDS[mcpBlocker]
        : !trimmed
          ? C.draft.needLabel
          : picked.length === 0
            ? C.draft.needWorkflow
            : null
  const canCreate = kind !== null && why === null && !busy

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function onRadioKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + EXPIRIES.length) % EXPIRIES.length
    setExpiry(EXPIRIES[next])
    radioRefs.current[next]?.focus()
  }

  function submit() {
    if (!canCreate) return
    if (kind === "mcp") {
      onCreate({
        kind: "mcp",
        label: trimmed,
        tools: mcpTools,
        folder_ids: draftFolderIds(mcpDraft, folders),
        include_external: mcpDraft.external,
        expires_in_days: MCP_EXPIRY_DAYS[mcpDraft.expiry],
      })
      return
    }
    // Server order is kept: the first picked row in LIST order is the one the show-once curl uses.
    const order = (workflows ?? []).map((w) => w.id)
    const workflow_ids = [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    onCreate({ label: trimmed, workflow_ids, expires_in_days: EXPIRY_DAYS[expiry] })
  }

  const hintFrom =
    fromRow === null ? null : fromRow.startable ? fillCopy(C.draft.fromMenu, { workflow: from?.name || fromRow.name }) : fillCopy(C.draft.fromMenuFile, { workflow: from?.name || fromRow.name })

  const draftsHint =
    draftsHidden <= 0 ? C.draft.workflowsHintNone : draftsHidden === 1 ? C.draft.workflowsHintOne : fillCopy(C.draft.workflowsHint, { N: draftsHidden })

  return (
    <div data-testid="api-key-draft" className="rounded-[14px] border border-primary bg-card p-4 ring-1 ring-primary/15">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
        <span className={cn("font-headline text-base font-semibold", !trimmed && "text-muted-foreground")}>
          {trimmed || C.draft.titlePlaceholder}
        </span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{C.draft.tag}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {mcpAvailable && mcp && (
          <ApiKeyKindChoice value={kind} onChange={chooseKind} mcp={mcp} autoFocus={kind === null} />
        )}

        {kind === "workflow" && hintFrom && <p className="text-xs text-primary">{hintFrom}</p>}

        {kind !== null && (
          <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
            <label htmlFor={ids.label} className="pt-1.5 text-sm">
              {C.draft.labelField}
            </label>
            <div>
              <Input
                id={ids.label}
                ref={labelRef}
                className="h-8"
                value={label}
                maxLength={MAX_LABEL}
                placeholder={kind === "mcp" ? M.mcp.labelPlaceholder : C.draft.labelPlaceholder}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">{C.draft.labelHint}</p>
            </div>
          </div>
        )}

        {kind === "mcp" && (
          <McpKeyFields
            orgName={orgName}
            catalogue={catalogue}
            catalogueFailed={catalogue === null}
            onRetryCatalogue={() => onRetryCatalogue?.()}
            folders={folders}
            foldersFailed={foldersFailed}
            onRetryFolders={() => onRetryFolders?.()}
            value={mcpDraft}
            onChange={setMcpDraft}
          />
        )}

        {kind === "workflow" && (
          <>
            <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
              <span id={ids.wf} className="pt-1.5 text-sm">
                {C.draft.workflowsField}
              </span>
              <div>
                <div role="group" aria-labelledby={ids.wf} className="max-h-[208px] overflow-y-auto rounded-md border border-border">
                  {workflows === null && !workflowsFailed && (
                    <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                      {C.draft.workflowsLoading}
                    </p>
                  )}
                  {workflowsFailed && (
                    <div role="alert" className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-[hsl(0_80%_80%)]">
                      <span>{C.draft.workflowsFailed}</span>
                      <Button type="button" variant="outline" size="sm" className="h-7" onClick={onRetryWorkflows}>
                        {C.tab.retry}
                      </Button>
                    </div>
                  )}
                  {workflows !== null && workflows.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">{C.draft.noWorkflows}</p>
                  )}
                  {workflows?.map((w) => {
                    const row = startableRowFacts(w)
                    return (
                      <label
                        key={w.id}
                        className={cn(
                          "flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-sm first:border-t-0",
                          row.disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                          disabled={row.disabled}
                          checked={picked.includes(w.id)}
                          onChange={() => toggle(w.id)}
                        />
                        <span className="flex-1">{w.name}</span>
                        <span className={cn("text-right text-xs", row.disabled ? "" : "font-mono text-muted-foreground")}>{row.right}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{draftsHint}</p>
              </div>
            </div>

            <div className="grid gap-1 md:grid-cols-[128px_1fr] md:gap-4">
              <span id={ids.exp} className="pt-1.5 text-sm">
                {C.draft.expiresField}
              </span>
              <div>
                <div role="radiogroup" aria-labelledby={ids.exp} className="inline-flex rounded-md border border-border p-0.5">
                  {EXPIRIES.map((e, i) => (
                    <button
                      key={e}
                      ref={(el) => {
                        radioRefs.current[i] = el
                      }}
                      type="button"
                      role="radio"
                      aria-checked={expiry === e}
                      tabIndex={expiry === e ? 0 : -1}
                      onClick={() => setExpiry(e)}
                      onKeyDown={(ev) => onRadioKey(ev, i)}
                      className={cn(
                        "rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        expiry === e ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {C.draft.expiresOptions[e]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{expiry === "never" ? C.draft.expiresHintNever : C.draft.expiresHint}</p>
              </div>
            </div>

            <p className="border-l-[3px] border-primary bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {C.draft.runsAsLead}
              <b className="font-semibold text-foreground">{C.draft.runsAsBold}</b>
              {C.draft.runsAsTail}
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {kind !== null && (
            <Button
              type="button"
              className="gradient-primary"
              disabled={!canCreate}
              aria-describedby={why ? ids.why : undefined}
              onClick={submit}
            >
              {busy ? C.draft.creating : C.draft.create}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onDiscard}>
            {C.draft.discard}
          </Button>
          {why && (
            <span id={ids.why} className="text-xs text-muted-foreground">
              {why}
            </span>
          )}
        </div>
        {failure !== null && (
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            {failure}
          </p>
        )}
      </div>
    </div>
  )
}
