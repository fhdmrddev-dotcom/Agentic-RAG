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
 * ── ⚠ SUPERSEDED 2026-08-25 (Phase 206.1-01, item 3 · SC#3 · D-206.1-08) ──
 * The paragraph immediately below is the sentence this file shipped from Phase 190-16 until
 * this commit. It is kept VERBATIM and marked superseded rather than deleted, because a
 * reader who finds it with no correction beside it will re-apply it. The correction follows
 * it. (House precedent for this shape: `lib/phaseGlyph.tsx:107-119` and
 * `components/workflows/ownProperty.ts:67-80`.)
 *
 *   ┌─ SUPERSEDED — do not re-apply ────────────────────────────────────────────────────┐
 *   │ ── CAPABILITY MARKS, NEVER VENDOR LOGOS (§10 / U-12) ──                           │
 *   │ The mark says *"this sends an email"*, not *"this is Fastmail"*. `@lobehub/icons`  │
 *   │ is the single source for PROVIDER marks and it is an LLM-provider set —            │
 *   │ Slack/Jira/SMTP are not in its domain, and sourcing them from a second package is  │
 *   │ exactly the per-surface vocabulary the icon convention forbids. The vendor is      │
 *   │ already told, in text, where it is actionable: the `Sends to` column carries the   │
 *   │ real host.                                                                        │
 *   │                                                                                   │
 *   │ ⚠ ALL THREE SLUGS WERE VERIFIED AGAINST THE INSTALLED PACKAGE, not against any     │
 *   │ document (icon-convention §3's empty-icon trap: `fluent-emoji:direct-hit` shipped  │
 *   │ BLANK in Phase 127). Measured 2026-08-09 against `@iconify-json/fluent-emoji@1.2.7`│
 *   │ (3174 icons): `envelope` PRESENT · `ticket` PRESENT · `speech-balloon` PRESENT.    │
 *   │ For the record, the near-misses that are ABSENT and must never be tried: `email`,  │
 *   │ `outbox`, `direct-hit`.                                                           │
 *   └───────────────────────────────────────────────────────────────────────────────────┘
 *
 * ── THE RULE THAT REPLACES IT: A VENDOR SHOWS ITS OWN MARK ──
 * The operator's icon convention (`references/icon-convention.md` §1, Running Design
 * Decision 43, 2026-06-27) says a service shows its OWN mark, from one source,
 * byte-identical everywhere — and the ROADMAP's SC#3 makes that binding for THIS surface.
 *
 * ⚠ AND THE ORIGINAL'S REASONING IS OBSOLETE, NOT MERELY OUTVOTED. It rested on a set
 * membership that does not hold: measured at HEAD, `@lobehub/icons@^5.10.0` ships `Github`
 * and `Google` and **no Slack and no Jira/Atlassian at all**. So *"sourcing them from a
 * second package is exactly the per-surface vocabulary the icon convention forbids"* was
 * arguing against a package that could never have supplied these marks in the first place.
 * The per-surface vocabulary the convention actually forbids is a SECOND HOME for the same
 * mark — which is why the replacement is ONE module (`connectionMark.tsx`) and not three
 * imports here. Its second arm is equally load-bearing: a vendorLESS shape (SMTP; anything
 * unmapped) is drawn in the interface's own ink, never in a borrowed vendor's.
 *
 * ⚠ EVERY SLUG'S VERIFICATION, THE INK CONTRACT AND THE NEAR-MISSES NOW LIVE IN
 * `connectionMark.tsx`'s HEADER — one home for the marks means one home for their evidence.
 * The slug-verification paragraph above is preserved for the three fluent-emoji slugs it
 * describes, which this file no longer imports.
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

import { cn } from "@/lib/utils"
import { ConnectionMarkGlyph } from "@/components/settings/connectionMark"
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
import {
  CATALOG_SERVICES,
  getServiceCatalogEntry,
  type CatalogServiceEntry,
} from "@/components/settings/servicesCatalog"
import { shapeForService } from "@/components/settings/connectionFormCopy"
import { PROVENANCE_ADDED_BY_URL } from "@/components/settings/catalogCopy"
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
  CONNECTIONS_DENSE_LABEL_CREDENTIAL,
  CONNECTIONS_DENSE_LABEL_USED_BY,
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
  credentialReadingOf,
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
  type ConnectionFilterState,
  type ConnectionStateKind,
} from "@/components/settings/connectionsCopy"

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
  /** Available service catalog entries. Defaults to CATALOG_SERVICES. */
  catalogServices?: CatalogServiceEntry[]
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
  /** Absent until plan 190-17 lands the add/edit panel. Accepts optional presetServiceId. */
  onAdd?: (presetServiceId?: string) => void
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

type DisplayItem =
  | { kind: "configured"; id: string; connection: ConnectorConnection; isPopular: boolean }
  | { kind: "catalog"; id: string; entry: CatalogServiceEntry; isPopular: boolean }

export function ConnectionsTabView({
  connections,
  catalogServices = [],
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
  const [filterState, setFilterState] = useState<ConnectionFilterState>(null)
  const searchId = useId()
  const isMobile = useIsMobile()

  /** WRITES are possible only for an org admin on a platform whose switch is on. Both
   *  halves are render-only mirrors of a server gate, and BOTH gates are real. */
  const canWrite = isOrgAdmin && liveConnectorsOn

  // Merge configured DB connection rows with unconfigured catalog services
  const allItems = useMemo<DisplayItem[] | null>(() => {
    if (connections === null) return null
    const configuredServiceIds = new Set(
      connections.map((c) => (c.service_id || "").trim().toLowerCase()).filter(Boolean),
    )
    const list: DisplayItem[] = connections.map((conn) => {
      const entry = getServiceCatalogEntry(conn.service_id)
      return {
        kind: "configured",
        id: conn.id,
        connection: conn,
        isPopular: entry.isPopular,
      }
    })

    for (const cat of catalogServices) {
      if (!configuredServiceIds.has(cat.serviceId.toLowerCase())) {
        list.push({
          kind: "catalog",
          id: `catalog:${cat.serviceId}`,
          entry: cat,
          isPopular: cat.isPopular,
        })
      }
    }
    return list
  }, [connections, catalogServices])

  const total = allItems?.length ?? 0

  const filteredItems = useMemo<DisplayItem[] | null>(() => {
    if (allItems === null) return null
    const q = query.trim().toLowerCase()
    return allItems.filter((item) => {
      // 1. State filtering
      if (filterState === "ready") {
        if (item.kind !== "configured") return false
        if (connectionStateOf(item.connection) !== "ready") return false
      } else if (filterState === "not_connected") {
        if (item.kind === "configured" && connectionStateOf(item.connection) === "ready") {
          return false
        }
      }

      // 2. Query filtering
      if (q) {
        if (item.kind === "configured") {
          const matchesBase = connectionMatchesQuery(item.connection, query)
          const entry = getServiceCatalogEntry(item.connection.service_id)
          const matchesTagline = entry.tagline?.toLowerCase().includes(q) ?? false
          if (!matchesBase && !matchesTagline) return false
        } else {
          const entry = item.entry
          const matchesName = entry.name.toLowerCase().includes(q)
          const matchesId = entry.serviceId.toLowerCase().includes(q)
          const matchesTagline = entry.tagline.toLowerCase().includes(q)
          const matchesDesc = entry.description.toLowerCase().includes(q)
          const matchesHost = entry.defaultHost?.toLowerCase().includes(q) ?? false
          if (!matchesName && !matchesId && !matchesTagline && !matchesDesc && !matchesHost) {
            return false
          }
        }
      }

      return true
    })
  }, [allItems, filterState, query])

  const isFiltering = query.trim() !== "" || filterState !== null

  const dense = Boolean(panel) && !isMobile

  return (
    <div
      data-testid="connections-split"
      className="grid min-h-0 min-w-0 gap-4 motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
      style={{
        gridTemplateColumns: dense ? "minmax(0,1fr) 400px" : "minmax(0,1fr)",
      }}
    >
      <section aria-label="Connections" data-testid="connections-tab" className="min-w-0">
        {/* Platform-wide truth */}
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

        {/* Popular Cards Row (per Screenshot 2026-08-24 202011.png & SC#3) */}
        {!dense && !isFiltering && catalogServices.length > 0 && (
          <div data-testid="connections-popular-section" className="mb-6">
            <h3 className="mb-2.5 text-[13px] font-medium text-foreground">Popular</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalogServices
                .filter((s) => s.isPopular)
                .slice(0, 3)
                .map((entry) => {
                  const shape = shapeForService(entry.serviceId)
                  return (
                    <div
                      key={entry.serviceId}
                      data-testid="connections-popular-card"
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-border/80"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ConnectionMarkGlyph shape={{ service_id: entry.serviceId, capability: shape }} size="row" />
                        <span className="truncate text-[13px] font-medium text-foreground">{entry.name}</span>
                      </div>
                      {canWrite && onAdd && (
                        <button
                          type="button"
                          onClick={() => onAdd(entry.serviceId)}
                          data-testid="connections-popular-connect"
                          className="inline-flex flex-none items-center rounded-md border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Filter bar + live count */}
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
            const on = filterState === chip.state
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={on}
                onClick={() => setFilterState(chip.state)}
                data-testid="connections-filter-chip"
                data-state-filter={chip.state ?? "all"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  on
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            )
          })}

          <span className="flex-1" />

          <span
            data-testid="connections-count"
            className="whitespace-nowrap font-mono text-[11px] text-muted-foreground"
          >
            {connectionsCountLabel(filteredItems?.length ?? 0, total, isFiltering)}
          </span>

          {canWrite && onAdd && (
            <button
              type="button"
              onClick={() => onAdd()}
              data-testid="connections-add"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {CONNECTIONS_ADD_CTA}
            </button>
          )}
        </div>

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
        ) : filteredItems !== null && filteredItems.length === 0 ? (
          isFiltering ? (
            <div
              data-testid="connections-filtered-empty"
              className="rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center text-[13px] text-muted-foreground"
            >
              {CONNECTIONS_FILTERED_TO_ZERO}
            </div>
          ) : (
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
                  onClick={() => onAdd()}
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
            {!dense && (
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
            )}

            <div className="divide-y divide-border/60">
              {(() => {
                if (!filteredItems) return null
                const shouldGroup =
                  !isFiltering &&
                  filteredItems.some((it) => it.isPopular) &&
                  filteredItems.some((it) => !it.isPopular)

                if (shouldGroup) {
                  const popular = filteredItems.filter((it) => it.isPopular)
                  const others = filteredItems.filter((it) => !it.isPopular)

                  return (
                    <>
                      <div
                        data-testid="connections-group-popular"
                        className="grouphd border-t border-border/40 bg-muted/15 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        Popular
                      </div>
                      {popular.map((item) =>
                        item.kind === "configured" ? (
                          <ConnectionRow
                            key={item.id}
                            connection={item.connection}
                            usedBy={usageCounts[item.connection.id] ?? 0}
                            canWrite={canWrite}
                            onDelete={onDelete}
                            onSetEnabled={onSetEnabled}
                            onCheck={onCheck}
                            onOpen={onOpen}
                            now={now}
                            dense={dense}
                          />
                        ) : (
                          <CatalogServiceRow
                            key={item.id}
                            entry={item.entry}
                            canWrite={canWrite}
                            onAdd={onAdd}
                            dense={dense}
                          />
                        ),
                      )}
                      <div
                        data-testid="connections-group-all"
                        className="grouphd border-t border-border/40 bg-muted/15 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        All services
                      </div>
                      {others.map((item) =>
                        item.kind === "configured" ? (
                          <ConnectionRow
                            key={item.id}
                            connection={item.connection}
                            usedBy={usageCounts[item.connection.id] ?? 0}
                            canWrite={canWrite}
                            onDelete={onDelete}
                            onSetEnabled={onSetEnabled}
                            onCheck={onCheck}
                            onOpen={onOpen}
                            now={now}
                            dense={dense}
                          />
                        ) : (
                          <CatalogServiceRow
                            key={item.id}
                            entry={item.entry}
                            canWrite={canWrite}
                            onAdd={onAdd}
                            dense={dense}
                          />
                        ),
                      )}
                    </>
                  )
                }

                return filteredItems.map((item) =>
                  item.kind === "configured" ? (
                    <ConnectionRow
                      key={item.id}
                      connection={item.connection}
                      usedBy={usageCounts[item.connection.id] ?? 0}
                      canWrite={canWrite}
                      onDelete={onDelete}
                      onSetEnabled={onSetEnabled}
                      onCheck={onCheck}
                      onOpen={onOpen}
                      now={now}
                      dense={dense}
                    />
                  ) : (
                    <CatalogServiceRow
                      key={item.id}
                      entry={item.entry}
                      canWrite={canWrite}
                      onAdd={onAdd}
                      dense={dense}
                    />
                  ),
                )
              })()}
            </div>
          </div>
        )}

        <p className="mt-2 px-0.5 text-[11px] leading-snug text-muted-foreground">
          {CONNECTIONS_USED_BY_SCOPE_NOTE}
        </p>
      </section>
      {panel}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// One unconfigured catalog service row (§2 — browsable catalog & 1-click Connect)
// ═══════════════════════════════════════════════════════════════════════════════════════

function CatalogServiceRow({
  entry,
  canWrite,
  onAdd,
  dense = false,
}: {
  entry: CatalogServiceEntry
  canWrite: boolean
  onAdd?: (presetServiceId?: string) => void
  dense?: boolean
}) {
  const shape = shapeForService(entry.serviceId)
  const isAddedByUrl = entry.serviceId === "custom_mcp"
  const destination = entry.defaultHost || "—"

  const nameNode = onAdd ? (
    <button
      type="button"
      onClick={() => onAdd(entry.serviceId)}
      data-testid="connections-row-name"
      className={cn(
        "truncate text-left text-[13px] font-medium text-foreground hover:underline",
        dense && "min-w-0 flex-1",
      )}
    >
      {entry.name}
    </button>
  ) : (
    <span
      data-testid="connections-row-name"
      className={cn(
        "truncate text-[13px] font-medium text-foreground",
        dense && "min-w-0 flex-1",
      )}
    >
      {entry.name}
    </span>
  )

  const connectButton = canWrite && onAdd && (
    <button
      type="button"
      onClick={() => onAdd(entry.serviceId)}
      data-testid="connections-catalog-connect"
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground",
        dense && "px-2 py-0.5",
      )}
    >
      Connect
    </button>
  )

  return (
    <div
      data-testid="connections-row"
      data-state="not_connected"
      data-catalog="true"
      data-dense={dense ? "true" : "false"}
      className={cn(
        dense
          ? "flex flex-col gap-1.5 px-3.5 py-3"
          : "flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3",
      )}
    >
      {dense ? (
        <>
          <div className="flex items-center gap-2">
            <ConnectionMarkGlyph shape={{ service_id: entry.serviceId, capability: shape }} size="row" />
            {nameNode}
            <div className="flex min-w-[2rem] flex-none items-center justify-end">
              {connectButton}
            </div>
          </div>

          <div
            data-testid="connections-row-destination"
            className="flex min-w-0 items-start gap-1.5 font-mono text-[11px] text-muted-foreground"
          >
            <span aria-hidden="true" className="flex-none">
              🔒
            </span>
            <span className="min-w-0 whitespace-normal break-all">{destination}</span>
          </div>

          <div className="truncate text-[11px] text-muted-foreground">
            {entry.tagline}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
            <span
              data-testid="connections-row-state"
              className="inline-flex items-center text-[11px] font-medium text-muted-foreground"
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full border border-muted-foreground/60 bg-transparent flex-none" />
              Not connected
            </span>

            <span className="inline-flex items-baseline gap-1">
              <span className="text-muted-foreground">{CONNECTIONS_DENSE_LABEL_USED_BY}</span>
              <span data-testid="connections-row-usedby" className="text-muted-foreground">
                —
              </span>
            </span>

            <span className="inline-flex items-baseline gap-1">
              <span className="text-muted-foreground">{CONNECTIONS_DENSE_LABEL_CREDENTIAL}</span>
              <span
                data-testid="connections-row-credential"
                className="font-mono text-muted-foreground"
              >
                Not set
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-[2] flex-col gap-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <ConnectionMarkGlyph shape={{ service_id: entry.serviceId, capability: shape }} size="row" />
              {nameNode}
              {isAddedByUrl && (
                <span
                  data-testid="connection-provenance-tag"
                  className="rounded border border-border px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                >
                  {PROVENANCE_ADDED_BY_URL}
                </span>
              )}
            </div>
            {entry.tagline && (
              <span
                data-testid="connection-tagline"
                className="truncate text-[11px] text-muted-foreground"
              >
                {entry.tagline}
              </span>
            )}
          </div>

          {/* 2 · Sends to */}
          <div
            data-testid="connections-row-destination"
            className="flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground"
          >
            <span aria-hidden="true">🔒</span>
            <span className="truncate">{destination}</span>
          </div>

          {/* 3 · Used by */}
          <div
            data-testid="connections-row-usedby"
            className="w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground"
          >
            —
          </div>

          {/* 4 · Credential */}
          <div
            data-testid="connections-row-credential"
            className="w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground"
          >
            Not set
          </div>

          {/* 5 · State */}
          <div className="w-36 flex-none flex items-center gap-1.5 text-[11px]">
            <span
              data-testid="connections-row-state"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full border border-muted-foreground/60 bg-transparent flex-none" />
              Not connected
            </span>
          </div>

          <div className="w-8 flex-none flex items-center justify-end">
            {connectButton}
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// One configured connection row + its graded destructive guards (§2g — 146–148, locked)
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
  dense = false,
}: {
  connection: ConnectorConnection
  usedBy: number
  canWrite: boolean
  onDelete: (connection: ConnectorConnection) => Promise<void>
  onSetEnabled: (connection: ConnectorConnection, next: boolean) => Promise<void>
  onCheck?: (connection: ConnectorConnection) => Promise<void>
  onOpen?: (connection: ConnectorConnection) => void
  now?: number
  dense?: boolean
}) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const state = connectionStateOf(connection)
  const facts = destinationFactsOf(connection)
  const isSlack = connection.capability === "post_message"
  const isMcp = Boolean(connection.mcp_server_url)
  const catalogEntry = getServiceCatalogEntry(connection.service_id)
  const isAddedByUrl = Boolean(connection.mcp_server_url) && !catalogEntry.isPopular
  const tagline = catalogEntry.tagline

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

  const nameNode = onOpen ? (
    <button
      type="button"
      onClick={() => onOpen(connection)}
      data-testid="connections-row-name"
      className={cn(
        "truncate text-left text-[13px] font-medium text-foreground hover:underline",
        dense && "min-w-0 flex-1",
      )}
    >
      {connection.name}
    </button>
  ) : (
    <span
      data-testid="connections-row-name"
      className={cn(
        "truncate text-[13px] font-medium text-foreground",
        dense && "min-w-0 flex-1",
      )}
    >
      {connection.name}
    </span>
  )

  const actionContent = receipt ? (
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
            aria-label={moreActionsLabel(connection.name)}
            data-testid="connections-row-more"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onCheck && !isMcp && (
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
                if (usedBy > 0) setConfirm("disable")
                else void runWrite(() => onSetEnabled(connection, false), RECEIPT_DISABLED)
              }}
            >
              {CONNECTIONS_ACTION_DISABLE}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              data-testid="connections-action-enable"
              onSelect={() => void runWrite(() => onSetEnabled(connection, true), RECEIPT_ENABLED)}
            >
              {CONNECTIONS_ACTION_ENABLE}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            data-testid="connections-action-delete"
            onSelect={() => setConfirm("delete")}
            className="text-destructive focus:text-destructive"
          >
            {CONNECTIONS_ACTION_DELETE}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  )

  return (
    <div
      data-testid="connections-row"
      data-state={state}
      data-dense={dense ? "true" : "false"}
      className={cn(
        dense
          ? "flex flex-col gap-1.5 px-3.5 py-3"
          : "flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3",
        !connection.is_enabled && "bg-muted/20",
      )}
    >
      {dense ? (
        <>
          <div className="flex items-center gap-2">
            <ConnectionMarkGlyph shape={connection} size="row" />
            {nameNode}
            <div className="flex min-w-[2rem] flex-none items-center justify-end">
              {actionContent}
            </div>
          </div>

          <div
            data-testid="connections-row-destination"
            className="flex min-w-0 items-start gap-1.5 font-mono text-[11px] text-muted-foreground"
          >
            <span aria-hidden="true" className="flex-none">
              🔒
            </span>
            <span className="min-w-0 whitespace-normal break-all">{facts.join(" · ")}</span>
            {isSlack && (
              <span className="flex-none rounded border border-border px-1 text-[11px] text-muted-foreground">
                {CONNECTION_FIXED_TAG}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
            <span
              data-testid="connections-row-state"
              className={cn("inline-flex items-center text-[11px] font-medium", STATE_TONE[state])}
            >
              {CONNECTION_STATE_WORDS[state]}
            </span>

            <span className="inline-flex items-baseline gap-1">
              <span className="text-muted-foreground">{CONNECTIONS_DENSE_LABEL_USED_BY}</span>
              <span data-testid="connections-row-usedby" className="text-muted-foreground">
                {usedByLabel(usedBy)}
              </span>
            </span>

            <span className="inline-flex items-baseline gap-1">
              <span className="text-muted-foreground">{CONNECTIONS_DENSE_LABEL_CREDENTIAL}</span>
              <span
                data-testid="connections-row-credential"
                className="font-mono text-muted-foreground"
              >
                {credentialReadingOf(connection, now)}
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-[2] flex-col gap-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <ConnectionMarkGlyph shape={connection} size="row" />
              {nameNode}
              {isAddedByUrl && (
                <span
                  data-testid="connection-provenance-tag"
                  className="rounded border border-border px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                >
                  {PROVENANCE_ADDED_BY_URL}
                </span>
              )}
            </div>
            {tagline && (
              <span
                data-testid="connection-tagline"
                className="truncate text-[11px] text-muted-foreground"
              >
                {tagline}
              </span>
            )}
          </div>

          {/* 2 · Sends to */}
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

          {/* 3 · Used by */}
          <div
            data-testid="connections-row-usedby"
            className="w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground"
          >
            {usedByLabel(usedBy)}
          </div>

          {/* 4 · Credential */}
          <div
            data-testid="connections-row-credential"
            className="w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground"
          >
            {credentialReadingOf(connection, now)}
          </div>

          {/* 5 · State */}
          <div className="w-36 flex-none flex items-center gap-1.5 text-[11px]">
            <span
              data-testid="connections-row-state"
              className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", STATE_TONE[state])}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full flex-none",
                  state === "ready"
                    ? "bg-success"
                    : state === "disabled"
                      ? "bg-muted-foreground"
                      : state === "failed"
                        ? "bg-destructive"
                        : "bg-warning",
                )}
                aria-hidden="true"
              />
              {CONNECTION_STATE_WORDS[state]}
            </span>
          </div>

          <div className="flex w-8 flex-none items-center justify-end">{actionContent}</div>
        </>
      )}

      {/* ── §2g's GRADED CONFIRMATION SHEETS ── */}
      {confirm && (
        <>
          <Sheet open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
            <SheetContent side="bottom" className="mx-auto max-w-lg">
              <SheetHeader>
                <SheetTitle>{deleteSheetTitle(connection.name)}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
                <p data-testid="connections-delete-body" className="text-[13px] leading-relaxed text-foreground">
                  {deleteSheetBody(usedBy)}
                </p>
                {failed && (
                  <p role="alert" className="mt-2 text-[13px] text-destructive">
                    {CONNECTIONS_WRITE_FAILED}
                  </p>
                )}
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
                    onClick={() =>
                      void runWrite(async () => {
                        await onDelete(connection)
                      }, RECEIPT_DELETED)
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {deleteConfirmLabel(connection.name)}
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={confirm === "disable"} onOpenChange={(o) => !o && setConfirm(null)}>
            <SheetContent side="bottom" className="mx-auto max-w-lg">
              <SheetHeader>
                <SheetTitle>{disableSheetTitle(connection.name)}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
                <p data-testid="connections-disable-body" className="text-[13px] leading-relaxed text-foreground">
                  {disableSheetBody(usedBy)}
                </p>
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
                    onClick={() =>
                      void runWrite(
                        () => onSetEnabled(connection, false),
                        RECEIPT_DISABLED,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {disableConfirmLabel(connection.name)}
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The stateful container — handles fetching, mutations, and panel wiring
// ═══════════════════════════════════════════════════════════════════════════════════════

type ConnectionsRead =
  | { kind: "loading"; key: string }
  | { kind: "ready"; key: string; rows: ConnectorConnection[] }
  | { kind: "error"; key: string }

export function ConnectionsTab() {
  const org = useOrgOptional()
  const [reloadNonce, setReloadNonce] = useState(0)
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [liveConnectorsOn, setLiveConnectorsOn] = useState<boolean>(false)

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

  const handleCheck = useCallback(
    async (connection: ConnectorConnection) => {
      await checkConnectorConnection(connection.id)
      reload()
    },
    [reload],
  )

  const handlePanelCheck = useCallback(
    async (connection: ConnectorConnection) => {
      const result = await checkConnectorConnection(connection.id)
      reload()
      return result
    },
    [reload],
  )

  const [panelState, setPanelState] = useState<
    | { mode: "create"; connection: null; presetServiceId?: string | null }
    | { mode: "edit"; connection: ConnectorConnection; presetServiceId?: null }
    | null
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
  const orgName = org?.orgs.find((m) => m.org_id === org.activeOrgId)?.name ?? null

  return (
    <ConnectionsTabView
      connections={read.kind === "ready" ? read.rows : read.kind === "error" ? [] : null}
      catalogServices={CATALOG_SERVICES}
      readFailed={read.kind === "error"}
      usageCounts={usageCounts}
      isOrgAdmin={isOrgAdmin}
      liveConnectorsOn={liveConnectorsOn}
      onDelete={handleDelete}
      onSetEnabled={handleSetEnabled}
      onCheck={handleCheck}
      onAdd={(presetServiceId) =>
        setPanelState({
          mode: "create",
          connection: null,
          presetServiceId: typeof presetServiceId === "string" ? presetServiceId : null,
        })
      }
      onOpen={(connection) => setPanelState({ mode: "edit", connection, presetServiceId: null })}
      panel={
        panelState ? (
          <ConnectionFormPanel
            open
            mode={panelState.mode}
            connection={panelState.connection}
            presetServiceId={panelState.presetServiceId ?? null}
            isOrgAdmin={isOrgAdmin}
            liveConnectorsOn={liveConnectorsOn}
            orgName={orgName}
            onClose={() => setPanelState(null)}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
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
