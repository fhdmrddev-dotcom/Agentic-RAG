/**
 * Phase 190-16 (CONN-02 / D-25 / D-26 / D-27, UI-SPEC §2a–§2h, §10, §12) —
 * Settings → Connections: the instrument table sketch 155-C locked.
 *
 * ── WHY CONNECTIONS LIVE IN SETTINGS AND NOT THE CONTROL ROOM (D-25) ──
 * The recorded settings↔control-room boundary splits by WHO DECIDES: the operator sets the
 * allowed-set and the platform lock; the USER — here an org admin — sets the preference.
 * A connection is a tenant's own destination, so it is a Settings surface. 190 adds nothing
 * to `/admin`.
 *
 * ── WHY A SIXTH TAB AND NOT A CARD INSIDE INTEGRATIONS (sketch 155-C, locked) ──
 * The five shipped Settings tabs are each a single-value form saved en masse behind one
 * Save (`SettingsPage.tsx:1354-1365`). A connection is a ROW with its own transaction and a
 * write-only secret. Nesting them means either the tab-level Save silently skips rows, or a
 * row edit is lost on navigate-away. Variant B was built to be rejected and did its job.
 *
 * ── THE TABLE IS THE PRIMARY VISUAL ANCHOR (§2c) ──
 * It opens the tab body, owns the full content width, and nothing competes with it: no
 * hero, no summary tiles, no chart. The filter bar sits directly above it and DESCRIBES it;
 * the kill-switch banner sits above that and QUALIFIES it. A person landing here looks at
 * rows, and the first thing any row says is its NAME.
 *
 * ── THE ROSTER IS THE SHIPPED 068-A INSTRUMENT TABLE, NOT A NEW PRIMITIVE ──
 * `divide-y divide-border/60` rows inside a rounded bordered box — the exact
 * `UsersAndAccess.tsx:166-179` container. There is NO `table` primitive in
 * `src/components/ui/` and 190 must not add one (UI-SPEC §15): this is a RE-USE whose
 * density behaviour is already known at real scale, and 190 installs nothing.
 *
 * ── CAPABILITY MARKS, NEVER VENDOR LOGOS (§10 / U-12) ──
 * The mark says *"this sends an email"*, not *"this is Fastmail"*. `@lobehub/icons` is the
 * single source for PROVIDER marks and it is an LLM-provider set — Slack/Jira/SMTP are not
 * in its domain, and sourcing them from a second package is exactly the per-surface
 * vocabulary the icon convention forbids. The vendor is already told, in text, where it is
 * actionable: the `Sends to` column carries the real host.
 *
 * ⚠ ALL THREE SLUGS WERE VERIFIED AGAINST THE INSTALLED PACKAGE, not against any document
 * (icon-convention §3's empty-icon trap: `fluent-emoji:direct-hit` shipped BLANK in Phase
 * 127). Measured 2026-08-09 against `@iconify-json/fluent-emoji@1.2.7` (3174 icons):
 * `envelope` PRESENT · `ticket` PRESENT · `speech-balloon` PRESENT. For the record, the
 * near-misses that are ABSENT and must never be tried: `email`, `outbox`, `direct-hit`.
 *
 * ── THE STATE WORDS, THE COPY AND THE DERIVATIONS LIVE IN `connectionsCopy.ts` ──
 * That module's header states why (the measured `react-refresh/only-export-components`
 * cost plan 190-12 recorded). THIS file exports components and nothing else.
 *
 * ── NO `title` ATTRIBUTE ANYWHERE ON THIS SURFACE ──
 * Every reason here is real DOM text (142-B, the 184-07 lesson). The shipped
 * `UsersAndAccess.tsx:507` analog uses `title` for its courtesy guard; that half is
 * deliberately NOT copied, and the suite asserts zero `[title]` nodes in the output.
 *
 * ── D-190-DEF-07 IS RESOLVED IN THIS COMMIT — BRANCH (b), THE GATE IS RIGHT ──
 * See `connectionsCopy.ts`'s `CONNECTIONS_BANNER_BODY` docblock for the full reasoning and
 * the exact reversal cost. The consequence HERE is structural, not only textual: while
 * `live_connectors` is off, every WRITE affordance is REMOVED rather than disabled — the
 * shipped 185 rule, and the only shape under which the banner's new sentence and the API's
 * 403 tell the same story. A hidden button the API still honours is one defect; a rendered
 * button the API refuses is the other, and this surface ships neither.
 */
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Check, Loader2, MoreHorizontal, Search } from "lucide-react"

import Envelope from "~icons/fluent-emoji/envelope"
import Ticket from "~icons/fluent-emoji/ticket"
import SpeechBalloon from "~icons/fluent-emoji/speech-balloon"

import { cn } from "@/lib/utils"
import type { PhaseMark } from "@/lib/phaseGlyph"
import {
  getEffectiveFeatures,
  listConnectorConnections,
  listPublishedWorkflows,
  checkConnectorConnection,
  createConnectorConnection,
  deleteConnectorConnection,
  updateConnectorConnection,
} from "@/lib/api"
import type {
  ConnectorConnection,
  ConnectorConnectionCreate,
  ConnectorConnectionUpdate,
} from "@/lib/api"
import { ConnectionFormPanel } from "@/components/settings/ConnectionFormPanel"
import { useOrgOptional } from "@/providers/OrgProvider"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CONNECTIONS_ACTION_CHECK,
  CONNECTIONS_ACTION_DELETE,
  CONNECTIONS_ACTION_DISABLE,
  CONNECTIONS_ACTION_ENABLE,
  CONNECTIONS_ADD_CTA,
  CONNECTIONS_BANNER_BODY,
  CONNECTIONS_BANNER_GLYPH,
  CONNECTIONS_BANNER_HEADING,
  CONNECTIONS_BANNER_OPERATOR_FLAG,
  CONNECTIONS_BANNER_OPERATOR_PREFIX,
  CONNECTIONS_BANNER_OPERATOR_SUFFIX,
  CONNECTIONS_COLUMNS,
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_GLYPH,
  CONNECTIONS_EMPTY_HEADING,
  CONNECTIONS_FILTER_CHIPS,
  CONNECTIONS_FILTER_LABEL,
  CONNECTIONS_FILTER_PLACEHOLDER,
  CONNECTIONS_FILTERED_TO_ZERO,
  CONNECTIONS_LOADING,
  CONNECTIONS_NON_ADMIN_NOTE,
  CONNECTIONS_READ_FAILED,
  CONNECTIONS_USED_BY_SCOPE_NOTE,
  CONNECTIONS_WRITE_FAILED,
  CONNECTION_FIXED_TAG,
  CONNECTION_STATE_WORDS,
  DELETE_CANCEL_LABEL,
  DISABLE_CANCEL_LABEL,
  RECEIPT_CHECKED,
  RECEIPT_DELETED,
  RECEIPT_DISABLED,
  RECEIPT_ENABLED,
  connectionMatchesQuery,
  connectionStateOf,
  connectionsCountLabel,
  credentialLabel,
  deleteConfirmLabel,
  deleteSheetBody,
  deleteSheetTitle,
  destinationFactsOf,
  disableConfirmLabel,
  disableSheetBody,
  disableSheetTitle,
  liveConnectorsOnFrom,
  moreActionsLabel,
  usageCountsFrom,
  usedByLabel,
  type ConnectionStateKind,
} from "@/components/settings/connectionsCopy"

// ── Capability marks (§10). Module-private on purpose: handing the map out would let a
//    caller bypass the own-property guard below, and an inherited key read that way is the
//    `[Function Object]` React child that hard-crashed a node face before 188.1-04. ──
const CAPABILITY_MARKS: Record<string, PhaseMark> = {
  send_email: Envelope,
  create_ticket: Ticket,
  post_message: SpeechBalloon,
}

/** Total over any key — `capability` is server data, and totality is a property of the
 *  lookup rather than of its current callers (the house argument, `phaseGlyph.tsx:106`). */
function capabilityMark(capability: string | undefined): PhaseMark | null {
  if (!capability) return null
  if (!Object.prototype.hasOwnProperty.call(CAPABILITY_MARKS, capability)) return null
  return CAPABILITY_MARKS[capability]
}

const MOBILE_BREAKPOINT = 768

/** Inline mobile hook — the project convention, declared per-file rather than shared
 *  (`DocumentDetailPanel.tsx:44-54` and `ClassificationRulesPage.tsx:34-44` each carry
 *  their own copy, both citing `WorkspacePanel.tsx:59-71`). It exists here for ONE
 *  decision: below 768px the panel is a bottom sheet and is out of flow, so a 400px grid
 *  track would leave an empty column beside the list. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

/** The state chip's tone. Colour is REINFORCEMENT — the word beside it is the carrier. */
const STATE_TONE: Record<ConnectionStateKind, string> = {
  ready: "text-success",
  not_checked: "text-warning",
  failed: "text-destructive",
  disabled: "text-muted-foreground",
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The presentational leaf — props in, DOM out
// ═══════════════════════════════════════════════════════════════════════════════════════

export interface ConnectionsTabViewProps {
  /** Every connection in the caller's org. `null` while the read is in flight. */
  connections: ConnectorConnection[] | null
  /** The read failed. Populated ≠ empty ≠ loading ≠ error — four different facts. */
  readFailed?: boolean
  /** `connection_id` → how many published steps the CALLER CAN SEE reference it. */
  usageCounts: Record<string, number>
  /** Render-only (U-02). The API `require_org_manage` gate is the wall (plan 190-09). */
  isOrgAdmin: boolean
  /** Render-only (D-26). `require_visible("live_connectors")` on the write endpoints is
   *  the wall; with it off, every write affordance here is REMOVED — see the file header. */
  liveConnectorsOn: boolean
  onDelete: (connection: ConnectorConnection) => Promise<void>
  onSetEnabled: (connection: ConnectorConnection, next: boolean) => Promise<void>
  /** Supplied by the container since plan 190-15 landed the client function + its endpoint
   *  together. Still OPTIONAL, so a view rendered without it removes the item rather than
   *  disabling it — the shipped 185 rule, and the reason the suite drives both directions.
   *  Absent ⇒ the menu item is REMOVED, never rendered inert. */
  onCheck?: (connection: ConnectorConnection) => Promise<void>
  /** Absent until plan 190-17 lands the add/edit panel. Absent ⇒ no Add affordance. */
  onAdd?: () => void
  /** Absent until plan 190-17. Absent ⇒ the name is text, not a control. */
  onOpen?: (connection: ConnectorConnection) => void
  /** Injected by the suite so relative times are deterministic. */
  now?: number
  /** Plan 190-17 — the add/edit panel, rendered BESIDE the list in a 400px push/split
   *  grid track (D-27, sketch 156-A). Present ⇒ the track opens; absent ⇒ one column.
   *  Passed as a NODE rather than built here so this view stays presentational and the
   *  suite can drive list-plus-panel in one render. */
  panel?: React.ReactNode
}

export function ConnectionsTabView({
  connections,
  readFailed = false,
  usageCounts,
  isOrgAdmin,
  liveConnectorsOn,
  onDelete,
  onSetEnabled,
  onCheck,
  onAdd,
  onOpen,
  now,
  panel,
}: ConnectionsTabViewProps) {
  const [query, setQuery] = useState("")
  const [capability, setCapability] = useState<string | null>(null)
  const searchId = useId()
  const isMobile = useIsMobile()

  /** WRITES are possible only for an org admin on a platform whose switch is on. Both
   *  halves are render-only mirrors of a server gate, and BOTH gates are real. */
  const canWrite = isOrgAdmin && liveConnectorsOn

  const total = connections?.length ?? 0
  const filtered = useMemo(() => {
    if (connections === null) return null
    return connections.filter(
      (row) =>
        (capability === null || row.capability === capability) &&
        connectionMatchesQuery(row, query),
    )
  }, [connections, capability, query])

  const isFiltering = query.trim() !== "" || capability !== null

  return (
    // ── The 400px right-side PUSH/SPLIT track (D-27, sketch 156-A — locked; the shipped
    //    shape is `WorkflowBuilderPage.tsx:1833-1836` and `ClassificationRulesPage:139-144`).
    //    THE LIST STAYS VISIBLE AND IS NEVER COVERED — that is the whole reason A won over a
    //    dialog: when a check fails the honest next action is to look at the list, and a
    //    dialog scrims it away. Below 768px the panel becomes a bottom sheet, so the track
    //    collapses to one column rather than leaving a 400px hole. ──
    <div
      data-testid="connections-split"
      className="grid min-h-0 min-w-0 gap-4 motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
      style={{
        gridTemplateColumns: panel && !isMobile ? "minmax(0,1fr) 400px" : "minmax(0,1fr)",
      }}
    >
    <section aria-label="Connections" data-testid="connections-tab" className="min-w-0">
      {/* ── The platform-wide truth, told ONCE, above the card and never on a row (D-26).
             At 24 rows a per-row notice is 24 identical amber lines — sketch 155's own
             `tell it` control produced exactly that finding. ── */}
      {!liveConnectorsOn && (
        <div
          data-testid="connections-off-banner"
          className="mb-4 flex items-start gap-2.5 rounded-[10px] border border-warning/30 bg-warning/10 px-3.5 py-3"
        >
          <span aria-hidden="true" className="mt-px text-[13px] leading-none text-warning">
            {CONNECTIONS_BANNER_GLYPH}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-foreground">
              {CONNECTIONS_BANNER_HEADING}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {CONNECTIONS_BANNER_BODY}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {CONNECTIONS_BANNER_OPERATOR_PREFIX}
              <code className="font-mono text-[11px] text-warning">
                {CONNECTIONS_BANNER_OPERATOR_FLAG}
              </code>
              {CONNECTIONS_BANNER_OPERATOR_SUFFIX}
            </p>
          </div>
        </div>
      )}

      {/* ── The filter bar + the live count (§2d). C won a 24-row drive, not a taste
             vote: the bar is mandatory and the count is load-bearing. ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="relative inline-flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={CONNECTIONS_FILTER_PLACEHOLDER}
            aria-label={CONNECTIONS_FILTER_LABEL}
            data-testid="connections-filter-input"
            className="w-60 rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
        </label>

        {CONNECTIONS_FILTER_CHIPS.map((chip) => {
          const Mark = capabilityMark(chip.capability ?? undefined)
          const on = capability === chip.capability
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={on}
              onClick={() => setCapability(chip.capability)}
              data-testid="connections-filter-chip"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                on
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {Mark && <Mark aria-hidden="true" className="h-3 w-3" />}
              {chip.label}
            </button>
          )
        })}

        <span className="flex-1" />

        <span
          data-testid="connections-count"
          className="whitespace-nowrap font-mono text-[11px] text-muted-foreground"
        >
          {connectionsCountLabel(filtered?.length ?? 0, total, isFiltering)}
        </span>

        {/* U-02 + D-26: REMOVED, never disabled. `--primary` is spent here and on three
            other sites only (§11c) — the selected row bar, the focused input border and
            the active filter chip. */}
        {canWrite && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            data-testid="connections-add"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {CONNECTIONS_ADD_CTA}
          </button>
        )}
      </div>

      {/* U-02's one line, at the foot of the table header, where the button is not. */}
      {!isOrgAdmin && (
        <p
          data-testid="connections-non-admin-note"
          className="mb-2 text-[11px] leading-snug text-muted-foreground"
        >
          {CONNECTIONS_NON_ADMIN_NOTE}
        </p>
      )}

      {readFailed ? (
        <div
          role="alert"
          data-testid="connections-read-failed"
          className="rounded-[10px] border border-destructive/30 bg-card px-4 py-6 text-[13px] text-destructive"
        >
          {CONNECTIONS_READ_FAILED}
        </div>
      ) : connections === null ? (
        <div
          aria-busy="true"
          data-testid="connections-loading"
          className="rounded-[10px] border border-border bg-card px-4 py-6 text-[13px] text-muted-foreground opacity-40"
        >
          {CONNECTIONS_LOADING}
        </div>
      ) : filtered !== null && filtered.length === 0 ? (
        isFiltering ? (
          /* Filtered to zero — a statement about the FILTER. §2d's named risk is
             conflating this with the empty state below; they are different facts and
             the suite asserts the two strings are not equal. */
          <div
            data-testid="connections-filtered-empty"
            className="rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center text-[13px] text-muted-foreground"
          >
            {CONNECTIONS_FILTERED_TO_ZERO}
          </div>
        ) : (
          /* Genuinely empty — the 155-C block. The second sentence is the armed-checkpoint
             promise told at the moment a person first meets the concept; do not trim it. */
          <div
            data-testid="connections-empty"
            className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/40 px-6 py-12 text-center"
          >
            <div aria-hidden="true" className="text-[13px] text-muted-foreground">
              {CONNECTIONS_EMPTY_GLYPH}
            </div>
            <div className="mt-3 text-[13px] font-medium text-foreground">
              {CONNECTIONS_EMPTY_HEADING}
            </div>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
              {CONNECTIONS_EMPTY_BODY}
            </p>
            {canWrite && onAdd && (
              <button
                type="button"
                onClick={onAdd}
                data-testid="connections-add-empty"
                className="mt-5 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {CONNECTIONS_ADD_CTA}
              </button>
            )}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border">
          {/* The five columns ARE the contract (155-C, locked). Rendered by mapping the
              tuple so the header can never drift from the order the suite asserts. */}
          <div
            data-testid="connections-header"
            className="flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2"
          >
            {CONNECTIONS_COLUMNS.map((column, index) => (
              <div
                key={column}
                data-column={column}
                className={cn(
                  "text-[11px] font-medium text-muted-foreground",
                  index === 0 && "flex-[2] min-w-0",
                  index === 1 && "flex-[2] min-w-0",
                  index === 2 && "w-24 flex-none",
                  index === 3 && "w-32 flex-none",
                  index === 4 && "w-36 flex-none",
                )}
              >
                {column}
              </div>
            ))}
            <div className="w-8 flex-none" aria-hidden="true" />
          </div>

          <div className="divide-y divide-border/60">
            {(filtered ?? []).map((row) => (
              <ConnectionRow
                key={row.id}
                connection={row}
                usedBy={usageCounts[row.id] ?? 0}
                canWrite={canWrite}
                onDelete={onDelete}
                onSetEnabled={onSetEnabled}
                onCheck={onCheck}
                onOpen={onOpen}
                now={now}
              />
            ))}
          </div>
        </div>
      )}

      {/* The `Used by` read's real scope, said ONCE. See `usageCountsFrom`'s docblock:
          `GET /workflows/published` is OWNER-scoped, so the count is a floor. */}
      <p className="mt-2 px-0.5 text-[11px] leading-snug text-muted-foreground">
        {CONNECTIONS_USED_BY_SCOPE_NOTE}
      </p>
    </section>
      {panel}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// One row + its graded destructive guards (§2g — 146–148, locked)
// ═══════════════════════════════════════════════════════════════════════════════════════

type ConfirmKind = "delete" | "disable" | null

function ConnectionRow({
  connection,
  usedBy,
  canWrite,
  onDelete,
  onSetEnabled,
  onCheck,
  onOpen,
  now,
}: {
  connection: ConnectorConnection
  usedBy: number
  canWrite: boolean
  onDelete: (connection: ConnectorConnection) => Promise<void>
  onSetEnabled: (connection: ConnectorConnection, next: boolean) => Promise<void>
  onCheck?: (connection: ConnectorConnection) => Promise<void>
  onOpen?: (connection: ConnectorConnection) => void
  now?: number
}) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const state = connectionStateOf(connection)
  const Mark = capabilityMark(connection.capability)
  const facts = destinationFactsOf(connection)
  const isSlack = connection.capability === "post_message"

  /** One write, its receipt, and a retry on failure — the `UsersAndAccess.tsx:224-238`
   *  idiom. The RECEIPT is transient (062-A: a receipt, never a toast); the persistent
   *  state chip beside it is the CONSEQUENCE, and they are deliberately separate. */
  async function runWrite(fn: () => Promise<void>, recorded: string) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    setConfirm(null)
    try {
      await fn()
      setReceipt(recorded)
      window.setTimeout(() => setReceipt(null), 4000)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid="connections-row"
      data-state={state}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3",
        !connection.is_enabled && "bg-muted/20",
      )}
    >
      {/* 1 · Connection — the capability mark + the AUTHOR'S word. Never the row id. */}
      <div className="flex min-w-0 flex-[2] items-center gap-2">
        {Mark ? (
          <Mark aria-hidden="true" className="h-4 w-4 flex-none" />
        ) : (
          <span aria-hidden="true" className="w-4 flex-none text-center text-[11px] text-muted-foreground">
            •
          </span>
        )}
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(connection)}
            data-testid="connections-row-name"
            className="truncate text-left text-[13px] font-medium text-foreground hover:underline"
          >
            {connection.name}
          </button>
        ) : (
          <span data-testid="connections-row-name" className="truncate text-[13px] font-medium text-foreground">
            {connection.name}
          </span>
        )}
      </div>

      {/* 2 · Sends to — 024-A's always-on 🔒 endpoint footer, applied to a destination. */}
      <div
        data-testid="connections-row-destination"
        className="flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground"
      >
        <span aria-hidden="true">🔒</span>
        <span className="truncate">{facts.join(" · ")}</span>
        {isSlack && (
          <span className="flex-none rounded border border-border px-1 text-[11px] text-muted-foreground">
            {CONNECTION_FIXED_TAG}
          </span>
        )}
      </div>

      {/* 3 · Used by — the count that names the victims a delete would create. */}
      <div
        data-testid="connections-row-usedby"
        className="w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground"
      >
        {usedByLabel(usedBy)}
      </div>

      {/* 4 · Credential — a reading of `last_checked_at`, never a fabricated time. */}
      <div
        data-testid="connections-row-credential"
        className="w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground"
      >
        {credentialLabel(connection.last_checked_at, now)}
      </div>

      {/* 5 · State — glyph AND word, so it reads in greyscale (WCAG 1.4.1). */}
      <div className="w-36 flex-none">
        <span
          data-testid="connections-row-state"
          className={cn("inline-flex items-center text-[11px] font-medium", STATE_TONE[state])}
        >
          {CONNECTION_STATE_WORDS[state]}
        </span>
      </div>

      {/* Actions + receipt. At most three primary actions at rest (§2f): Add is
          page-level, the name opens the panel, and everything else lives in the ⋯. */}
      <div className="flex w-8 flex-none items-center justify-end">
        {receipt ? (
          <span
            data-testid="connections-receipt"
            role="status"
            className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-foreground"
          >
            <Check className="h-3 w-3 flex-none text-success" aria-hidden="true" />
            {receipt}
          </span>
        ) : (
          canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  // §12: an EXPLICIT accessible name carrying the row's own name. Radix
                  // supplies none for a glyph child, and 24 nodes announcing as "more" is
                  // the failure this rule exists to prevent.
                  aria-label={moreActionsLabel(connection.name)}
                  data-testid="connections-row-more"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Check has a side effect (it writes `last_checked_at`), so it lives in
                    the overflow rather than as a visible per-row button. The handler
                    landed with the endpoint in plan 190-15, so this renders now — and the
                    `onCheck &&` guard STAYS: it is what keeps the removed-not-disabled
                    rule true for the view when it is rendered without one (the suite
                    drives both directions). */}
                {onCheck && (
                  <DropdownMenuItem
                    data-testid="connections-action-check"
                    onSelect={() => void runWrite(() => onCheck(connection), RECEIPT_CHECKED)}
                  >
                    {CONNECTIONS_ACTION_CHECK}
                  </DropdownMenuItem>
                )}

                {connection.is_enabled ? (
                  <DropdownMenuItem
                    data-testid="connections-action-disable"
                    onSelect={() => {
                      // GRADED, honestly, by whether a victim exists (§2g). With no known
                      // victim the flip is DIRECT — and Disable is the reversible half of
                      // the pair, which is exactly why 068-A grades it below Delete.
                      if (usedBy > 0) setConfirm("disable")
                      else void runWrite(() => onSetEnabled(connection, false), RECEIPT_DISABLED)
                    }}
                  >
                    {CONNECTIONS_ACTION_DISABLE}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    data-testid="connections-action-enable"
                    // RESTORATIVE → direct flip. The deliberate asymmetry 068-A ships.
                    onSelect={() => void runWrite(() => onSetEnabled(connection, true), RECEIPT_ENABLED)}
                  >
                    {CONNECTIONS_ACTION_ENABLE}
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  data-testid="connections-action-delete"
                  // ALWAYS the victim-naming sheet — irreversible, and the credential it
                  // destroys cannot be recovered whatever the count says.
                  onSelect={() => setConfirm("delete")}
                  className="text-destructive focus:text-destructive"
                >
                  {CONNECTIONS_ACTION_DELETE}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </div>

      {failed && (
        <div className="w-full text-right text-[11px] text-destructive" role="status">
          {CONNECTIONS_WRITE_FAILED}
        </div>
      )}

      {/* ── Delete: the victim-naming sheet, ALWAYS. The victim is named in the BUTTON
             LABEL, not only in the prose above it (the 064-B shape). ── */}
      <Sheet open={confirm === "delete"} onOpenChange={(open) => !open && setConfirm(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>{deleteSheetTitle(connection.name)}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <p className="text-[13px] leading-relaxed text-foreground">{deleteSheetBody(usedBy)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {DELETE_CANCEL_LABEL}
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="connections-confirm-delete"
                onClick={() => void runWrite(() => onDelete(connection), RECEIPT_DELETED)}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {deleteConfirmLabel(connection.name)}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Disable WITH victims: the same sheet, graded by the count. ── */}
      <Sheet open={confirm === "disable"} onOpenChange={(open) => !open && setConfirm(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>{disableSheetTitle(connection.name)}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <p className="text-[13px] leading-relaxed text-foreground">{disableSheetBody(usedBy)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {DISABLE_CANCEL_LABEL}
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="connections-confirm-disable"
                onClick={() => void runWrite(() => onSetEnabled(connection, false), RECEIPT_DISABLED)}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {disableConfirmLabel(connection.name)}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The connected container — the three reads and the two writes
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Settings → Connections.
 *
 * THREE READS, all already shipped, and 190-16 adds no endpoint:
 *   1. `listConnectorConnections()` — org-WIDE by design (plan 190-09 decision 2: the
 *      reads are deliberately NOT feature-gated, so this tab renders a real table under
 *      the OFF banner rather than 403-ing into a dead page).
 *   2. `listPublishedWorkflows()` — the `Used by` counts, computed in the browser from the
 *      `definition` this response already returns inline. See `usageCountsFrom` for the
 *      corpus measurement and for why the count is a caller-scoped FLOOR.
 *   3. `getEffectiveFeatures()` — `live_connectors`. Fails CLOSED (an absent key reads as
 *      off), which on this surface is the honest direction: claiming sending is off when
 *      we cannot tell is the non-over-claiming error.
 *
 * `useOrgOptional()` rather than `useOrg()`: a leaf read that must not throw outside a
 * provider (the `TechnicalNamesProvider` idiom `OrgProvider.tsx:8-12` records), so the tab
 * degrades to non-admin rather than crashing the whole Settings page.
 */
/** Every settled read carries the KEY it answered, so a result for a previous org (or for
 *  a previous reload) is not a result at all — the surface reads `loading` again by
 *  DERIVATION. This is `ConnectionPicker.tsx:177-201`'s idiom, and it is not merely tidy:
 *  it is what lets the effect body hold NO synchronous `setState`, which is the cascading
 *  render `react-hooks/set-state-in-effect` exists to stop. */
type ConnectionsRead =
  | { kind: "loading"; key: string }
  | { kind: "ready"; key: string; rows: ConnectorConnection[] }
  | { kind: "error"; key: string }

export function ConnectionsTab() {
  const org = useOrgOptional()
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [liveConnectorsOn, setLiveConnectorsOn] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)

  /** Re-fetch after every write — the roster's chips come from the SERVER's new truth, so
   *  nothing here is flipped optimistically (the 068-A rule). */
  const reload = useCallback(() => setReloadNonce((n) => n + 1), [])

  const requestKey = `${org?.activeOrgId ?? ""}::${reloadNonce}`
  const [settled, setSettled] = useState<ConnectionsRead>({ kind: "loading", key: "" })
  const read: ConnectionsRead =
    settled.key === requestKey ? settled : { kind: "loading", key: requestKey }

  useEffect(() => {
    let cancelled = false
    listConnectorConnections()
      .then((rows) => {
        if (!cancelled) setSettled({ kind: "ready", key: requestKey, rows })
      })
      .catch(() => {
        if (!cancelled) setSettled({ kind: "error", key: requestKey })
      })
    return () => {
      cancelled = true
    }
  }, [requestKey])

  useEffect(() => {
    let cancelled = false
    listPublishedWorkflows()
      .then((rows) => {
        if (!cancelled) setUsageCounts(usageCountsFrom(rows))
      })
      .catch(() => {
        // A failed usage read must never look like "nothing depends on this": the counts
        // stay empty and `usedByLabel` renders `none you can see`, which is true of a
        // read that did not answer as much as of one that answered zero.
        if (!cancelled) setUsageCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [requestKey])

  useEffect(() => {
    let cancelled = false
    getEffectiveFeatures()
      .then((features) => {
        if (!cancelled) setLiveConnectorsOn(liveConnectorsOnFrom(features))
      })
      .catch(() => {
        if (!cancelled) setLiveConnectorsOn(false)
      })
    return () => {
      cancelled = true
    }
  }, [org?.activeOrgId])

  const handleDelete = useCallback(
    async (connection: ConnectorConnection) => {
      await deleteConnectorConnection(connection.id)
      reload()
    },
    [reload],
  )

  const handleSetEnabled = useCallback(
    async (connection: ConnectorConnection, next: boolean) => {
      await updateConnectorConnection(connection.id, { is_enabled: next })
      reload()
    },
    [reload],
  )

  /** The check writes `last_check_verdict` and `last_checked_at` server-side, so the row's
   *  Credential chip comes from the SERVER's new truth — re-fetched, never flipped
   *  optimistically (the 068-A rule this container already follows for the other two
   *  writes). The returned result is deliberately DISCARDED here: §5c's headline and §4d's
   *  three refusal states are the add/edit panel's surface (plan 190-18), and rendering a
   *  second, shorter version of them on the table row is how one closed sentence table
   *  becomes two. What the table shows is the chip, which is the persisted verdict. */
  const handleCheck = useCallback(
    async (connection: ConnectorConnection) => {
      await checkConnectorConnection(connection.id)
      reload()
    },
    [reload],
  )

  /**
   * Plan 190-18 — the PANEL's check. Same endpoint, same re-fetch, but the RESULT is handed
   * back rather than discarded: §5c's headline and §4d's three outcome shapes are the panel's
   * surface, and they are keyed off `bucket` + `reason_code` on this very object.
   *
   * ⚠ The re-fetch that follows hands the panel a NEW object for the SAME row. The panel's
   * seed effect keys on `connection?.id` for exactly that reason — see its own note — so a
   * check never discards what the person has typed.
   */
  const handlePanelCheck = useCallback(
    async (connection: ConnectorConnection) => {
      const result = await checkConnectorConnection(connection.id)
      reload()
      return result
    },
    [reload],
  )

  /** Plan 190-17 — the add/edit panel's open/close seam. `null` is CLOSED; the panel is
   *  passed as a node only while open, so the 400px grid track opens with it. */
  const [panelState, setPanelState] = useState<
    { mode: "create"; connection: null } | { mode: "edit"; connection: ConnectorConnection } | null
  >(null)

  const handleCreate = useCallback(
    async (body: ConnectorConnectionCreate) => {
      await createConnectorConnection(body)
      reload()
    },
    [reload],
  )

  const handleUpdate = useCallback(
    async (id: string, body: ConnectorConnectionUpdate) => {
      await updateConnectorConnection(id, body)
      reload()
    },
    [reload],
  )

  const isOrgAdmin = org?.canManage === true

  /** The active org's own name, for §3e's org-shared line. Read off the SHIPPED
   *  `OrgValue.orgs` membership list (`OrgProvider.tsx:46`) rather than fetched — the
   *  provider already holds it. Unresolved ⇒ `null`, and the panel falls back to a
   *  name-free wording of the SAME sentence rather than rendering a blank. */
  const orgName = org?.orgs.find((m) => m.org_id === org.activeOrgId)?.name ?? null

  return (
    <ConnectionsTabView
      connections={read.kind === "ready" ? read.rows : read.kind === "error" ? [] : null}
      readFailed={read.kind === "error"}
      usageCounts={usageCounts}
      isOrgAdmin={isOrgAdmin}
      liveConnectorsOn={liveConnectorsOn}
      onDelete={handleDelete}
      onSetEnabled={handleSetEnabled}
      onCheck={handleCheck}
      // The Add button opens the panel in CREATE mode; a row's name opens it in EDIT mode.
      // For a non-admin `onOpen` still fires — the panel opens READ-ONLY (U-02), because
      // a member may legitimately want to see WHERE a connection they can bind sends.
      onAdd={() => setPanelState({ mode: "create", connection: null })}
      onOpen={(connection) => setPanelState({ mode: "edit", connection })}
      panel={
        panelState ? (
          <ConnectionFormPanel
            open
            mode={panelState.mode}
            connection={panelState.connection}
            isOrgAdmin={isOrgAdmin}
            liveConnectorsOn={liveConnectorsOn}
            orgName={orgName}
            onClose={() => setPanelState(null)}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            // Plan 190-18 — §5c's check and §2g's graded guards, on the row being edited.
            // The panel REMOVES each of these unless a write is genuinely possible; passing
            // them unconditionally keeps that decision in ONE place (the panel) rather than
            // splitting it across two files, which is how the two halves drift.
            onCheck={handlePanelCheck}
            onDelete={handleDelete}
            onSetEnabled={handleSetEnabled}
            usedBy={panelState.connection ? (usageCounts[panelState.connection.id] ?? 0) : 0}
          />
        ) : undefined
      }
    />
  )
}

export default ConnectionsTab
