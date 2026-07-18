// ─────────────────────────────────────────────────────────────────────────────
// Phase 149 Plan 07 (MODEL-02 / sketch 071-A) — the model-discovery propose→confirm
// panel. SC#3 propose-only is the visible HERO.
//
// "Run discovery" fans out to each provider's /models (server-side) and returns an
// EPHEMERAL diff — new / changed / vanished — that lives only in this component's
// state (D-149-12, no proposals table; navigating away discards it).
//
// THE SC#3 HONESTY BEAT (the load-bearing surface):
//   • A capability the provider did NOT return renders as an amber "unknown — you
//     set it" INPUT — NEVER a guessed value. Only OpenRouter yields native_tools and
//     only Google + OpenRouter yield token limits from /models; everything else is
//     amber (RESEARCH Pitfall 2 / the provider capability matrix).
//   • A NEW model is NEVER auto-enabled: its "enable now" tick is disabled until every
//     capability is provider-returned OR hand-filled (the silent no-tools bug, barred).
//   • VANISHED models are FLAGGED (mark-deprecated / disable / keep) — never a delete;
//     a model can vanish because a provider paused an endpoint, not because it's gone
//     (the 058/060 verbatim-error-excluded-not-failed lesson).
//   • A rate-limited / errored provider shows its VERBATIM status, excluded not failed.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell owns the api calls; this leaf
// runs discovery, collects the operator's confirmed changes, and reports them via
// onConfirm (the shell routes each to setModelCapability + re-fetches the registry).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Loader2, RefreshCw, ShieldCheck } from "lucide-react"

import {
  DISCOVERY_UNKNOWN,
  type DiscoveryResult,
  type ModelCapabilityPatch,
} from "@/lib/api"
import { familyDefaults, type FamilyDefaults } from "@/lib/model-defaults"
import { providerLogo } from "@/lib/providerLogo"
import { cn } from "@/lib/utils"

interface ModelDiscoveryPanelProps {
  /** Fan out to each provider's /models and return the ephemeral propose-only diff. */
  onRunDiscovery: () => Promise<DiscoveryResult>
  /** Apply the operator's confirmed changes (the shell routes each to setModelCapability
   *  per model, then re-fetches the registry + pulses the receipt). */
  onConfirm: (changes: Array<{ modelId: string; patch: ModelCapabilityPatch }>) => Promise<void>
  /** Phase 159 (D-159-04): the persisted, default-on suitability filter state (read by the
   *  shell from app_settings `model_discovery_filter_enabled`). DISPLAY-ONLY — when true,
   *  known non-chat "utility" `new` models are hidden; it NEVER mutates the confirmable diff
   *  (accepted / enableNow / drafts / buildChanges are untouched — 149's "propose, humans
   *  confirm" red line). */
  filterEnabled: boolean
  /** Persist a new filter default (the shell writes setFlag("model_discovery_filter_enabled", …)
   *  then re-fetches settings — the server is the source of truth; this is NOT the ephemeral
   *  per-view "Show all" reveal). */
  onSetFilter: (enabled: boolean) => Promise<void>
}

// The ONLY two providers whose /models exposes capability metadata (mirrors the backend
// `_CAPS_PROVIDERS` — RESEARCH capability matrix). Google + OpenRouter return token
// limits; everyone else returns IDs only. Native-tools is OpenRouter-only, but that
// falls out per-field via the UNKNOWN sentinel — this set only drives the per-provider
// "capabilities ✓ / IDs only" run-card badge.
const CAPS_PROVIDERS = new Set(["google", "openrouter"])

// The discovery-service capability field names → the PATCH column names + display label.
const CAP_FIELDS: readonly { field: string; label: string; col: keyof ModelCapabilityPatch }[] = [
  { field: "context", label: "context", col: "context_window_tokens" },
  { field: "max_output", label: "max out", col: "max_output_tokens" },
  { field: "native_tools", label: "tools", col: "native_tools" },
]
const COL_FOR = new Map(CAP_FIELDS.map((f) => [f.field, f.col]))
const LABEL_FOR = new Map(CAP_FIELDS.map((f) => [f.field, f.label]))

const isUnknown = (v: number | boolean | string): boolean => v === DISCOVERY_UNKNOWN

// ── D-159-03: reviewed family-default PRE-FILL (never authoritative, never auto-enable) ──
// Map a discovery capability field ("context" / "max_output" / "native_tools") to the matching
// family default as a DRAFT STRING (the input/select vocabulary). native_tools maps the tri-state
// family default to the select's vocabulary: `true` → "native", `null` → unseeded (""). It can
// NEVER yield "none" — `familyDefaults().tools` is only ever `true` or `null` (never `false`), so a
// pre-fill can never silently DISABLE tools (SC#3 holds by construction).
function defaultDraftForField(field: string, fam: FamilyDefaults): string | null {
  if (field === "native_tools") return fam.tools === true ? "native" : null
  if (field === "context") return fam.context != null ? String(fam.context) : null
  if (field === "max_output") return fam.maxOutput != null ? String(fam.maxOutput) : null
  return null
}

/** Seed the per-model draft map from each new model's FAMILY defaults — ONLY for un-returned
 *  (UNKNOWN) capabilities that HAVE a sensible family default. A provider-returned field is never
 *  seeded (it renders green); a family with no default leaves the field blank ("unknown — you set
 *  it"). Seeding makes a pre-filled model `isComplete`, so the operator CAN opt in — but `enableNow`
 *  stays default-off, so `buildChanges` still yields `enabled:false` until they explicitly tick
 *  "Enable now" (SC#3: pre-fill NEVER auto-enables). */
function seedDraftsFromDefaults(
  newModels: DiscoveryResult["new"],
): Record<string, Record<string, string>> {
  const seeded: Record<string, Record<string, string>> = {}
  for (const m of newModels) {
    const fam = familyDefaults(m.model_id)
    const perField: Record<string, string> = {}
    for (const [field, value] of Object.entries(m.capabilities)) {
      if (!isUnknown(value)) continue
      const d = defaultDraftForField(field, fam)
      if (d != null) perField[field] = d
    }
    if (Object.keys(perField).length > 0) seeded[m.model_id] = perField
  }
  return seeded
}

type VanishedDecision = "deprecate" | "disable" | "keep"

/** The 071-A propose→confirm panel. */
export function ModelDiscoveryPanel({
  onRunDiscovery,
  onConfirm,
  filterEnabled,
  onSetFilter,
}: ModelDiscoveryPanelProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  // Per-model operator input (all keyed by model_id — a model lives in exactly one group).
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [enableNow, setEnableNow] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [vanished, setVanished] = useState<Record<string, VanishedDecision>>({})

  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  // D-159-04: an EPHEMERAL per-view "Show all" reveal (default off, reset on each run). It
  // reveals the utility models hidden by the persisted filter WITHOUT changing the persisted
  // default — it never calls onSetFilter, so it's an honest, non-destructive peek that resets
  // the next time discovery runs.
  const [showAllThisView, setShowAllThisView] = useState(false)

  // Add-one-not-all: a text filter over the NEW-models list so the operator can find a specific
  // model instead of scrolling ~400 rows. Display-only (like the utility filter) — it narrows what
  // "Select all (matches)" targets and what's rendered, never what's already ticked. Reset each run.
  const [newSearch, setNewSearch] = useState("")

  // WR-02 (Phase 159 review): surface a persist failure on the filter toggle. The sibling add /
  // capability write paths all show refusals; a silently-reverting checkbox on a failed setFlag
  // (e.g. a pending-migration 500) is dishonest. Cleared on the next attempt.
  const [filterError, setFilterError] = useState<string | null>(null)
  async function handleToggleFilter() {
    setFilterError(null)
    try {
      await onSetFilter(!filterEnabled)
    } catch {
      setFilterError("Couldn't save the filter setting — try again.")
    }
  }

  async function run() {
    setPhase("running")
    setRunError(null)
    setApplied(false)
    try {
      const res = await onRunDiscovery()
      setResult(res)
      // NEW models default UNSELECTED (opt-in) — the operator searches + ticks only what they
      // want, so Confirm never bulk-adds the whole ~400-model discovery pull (add-one-not-all).
      // 'changed' (updates to models ALREADY in the registry) keeps accept-by-default. enable-now
      // defaults OFF (never auto-enable). "Select all (matches)" / "Clear" cover the bulk case.
      const acc = new Set<string>()
      res.changed.forEach((m) => acc.add(m.model_id))
      setAccepted(acc)
      setEnableNow(new Set())
      // D-159-03: pre-seed the hand-fill drafts from each new model's FAMILY defaults (reviewed,
      // never authoritative). enableNow stays empty above, so a pre-filled model still lands
      // enabled:false until the operator explicitly ticks "Enable now" (SC#3).
      setDrafts(seedDraftsFromDefaults(res.new))
      setVanished({})
      setShowAllThisView(false)
      setNewSearch("")
      setPhase("done")
    } catch {
      setRunError("Couldn’t run discovery — try again.")
      setPhase("idle")
    }
  }

  function toggleAccept(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setDraft(id: string, field: string, value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  /** A new model is complete when every capability is provider-returned OR hand-filled. */
  function isComplete(m: DiscoveryResult["new"][number]): boolean {
    return Object.entries(m.capabilities).every(([field, value]) => {
      if (!isUnknown(value)) return true
      const d = drafts[m.model_id]?.[field]
      return d != null && d.trim() !== ""
    })
  }

  function coerce(field: string, raw: string): number | boolean | undefined {
    if (field === "native_tools") {
      if (raw === "native") return true
      if (raw === "none") return false
      return undefined
    }
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : undefined
  }

  function buildChanges(): Array<{ modelId: string; patch: ModelCapabilityPatch }> {
    if (!result) return []
    const changes: Array<{ modelId: string; patch: ModelCapabilityPatch }> = []

    for (const m of result.new) {
      if (!accepted.has(m.model_id)) continue
      const patch: ModelCapabilityPatch = {}
      for (const [field, value] of Object.entries(m.capabilities)) {
        const col = COL_FOR.get(field)
        if (!col) continue
        if (!isUnknown(value)) {
          Object.assign(patch, { [col]: value })
        } else {
          const d = drafts[m.model_id]?.[field]
          const c = d != null && d.trim() !== "" ? coerce(field, d) : undefined
          if (c !== undefined) Object.assign(patch, { [col]: c })
        }
      }
      // NEVER auto-enable: only enable a new model that is complete AND explicitly ticked.
      patch.enabled = enableNow.has(m.model_id) && isComplete(m)
      changes.push({ modelId: m.model_id, patch })
    }

    for (const m of result.changed) {
      if (!accepted.has(m.model_id)) continue
      const patch: ModelCapabilityPatch = {}
      for (const [field, ch] of Object.entries(m.changes)) {
        const col = COL_FOR.get(field)
        if (col) Object.assign(patch, { [col]: ch.to })
      }
      changes.push({ modelId: m.model_id, patch })
    }

    for (const m of result.vanished) {
      const d = vanished[m.model_id]
      if (d === "deprecate") changes.push({ modelId: m.model_id, patch: { deprecated: true } })
      else if (d === "disable") changes.push({ modelId: m.model_id, patch: { enabled: false } })
    }

    return changes
  }

  async function confirm() {
    if (confirming) return
    setConfirming(true)
    setConfirmError(null)
    try {
      await onConfirm(buildChanges())
      // Ephemeral: the proposals are discarded once applied (D-149-12).
      setApplied(true)
      setResult(null)
      setPhase("idle")
    } catch {
      setConfirmError("Couldn’t apply the changes — try again.")
    } finally {
      setConfirming(false)
    }
  }

  const changeCount = result ? buildChanges().length : 0

  // D-159-04: the default-on suitability filter is a DISPLAY concern over `result.new` only.
  // It NEVER touches accepted / enableNow / drafts / buildChanges — `changeCount` above is
  // computed from the FULL result, so a hidden utility row can never be silently confirmed
  // nor dropped from the confirmable payload (149 red line: discovery proposes, humans confirm).
  const hidingUtility = filterEnabled && !showAllThisView
  const searchQuery = newSearch.trim().toLowerCase()
  const visibleNew = result
    ? result.new.filter((m) => {
        if (hidingUtility && m.utility === true) return false
        if (searchQuery && !m.model_id.toLowerCase().includes(searchQuery)) return false
        return true
      })
    : []
  const hiddenNewCount =
    result && hidingUtility ? result.new.filter((m) => m.utility === true).length : 0
  const selectedNewCount = result
    ? result.new.filter((m) => accepted.has(m.model_id)).length
    : 0

  // Bulk selection helpers (opt-in default): "Select all" targets only the currently VISIBLE new
  // rows (utility-filter + search applied); "Clear" removes every new-model tick. Both leave the
  // 'changed'/'vanished' selections untouched.
  function selectAllVisibleNew() {
    setAccepted((prev) => {
      const next = new Set(prev)
      visibleNew.forEach((m) => next.add(m.model_id))
      return next
    })
  }
  function clearNewSelection() {
    if (!result) return
    setAccepted((prev) => {
      const next = new Set(prev)
      result.new.forEach((m) => next.delete(m.model_id))
      return next
    })
  }

  return (
    <section aria-label="Model discovery" className="space-y-4">
      <div>
        <h3 className="font-headline text-base font-bold text-foreground">Discover models</h3>
        <p className="mt-1 max-w-[74ch] text-xs text-muted-foreground/80">
          Query each provider’s model list and propose what changed.{" "}
          <span className="font-medium text-foreground">Nothing is applied until you confirm</span> — and a
          capability the provider didn’t return is <span className="font-medium text-warning">never guessed</span>.
        </p>
      </div>

      {phase !== "done" && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={phase === "running"}
            onClick={run}
            className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Running discovery…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Run discovery
              </>
            )}
          </button>
          {phase === "running" && <RunTimer />}
          {applied && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning" role="status">
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />✎ Applied · recorded
            </span>
          )}
          {runError && (
            <div className="text-xs text-destructive" role="alert">
              {runError}
            </div>
          )}
        </div>
      )}

      {phase === "done" && result && (
        <div className="space-y-5">
          {/* Propose-only banner — the SC#3 hero. */}
          <div className="flex items-start gap-2.5 rounded-md border border-primary/30 border-l-[3px] border-l-primary bg-primary/[0.05] px-3.5 py-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
            <div className="text-muted-foreground">
              <span className="font-semibold text-primary">Propose-only.</span> Capabilities auto-fill{" "}
              <span className="font-medium text-foreground">only where the provider returned them</span> (Google
              &amp; OpenRouter). Elsewhere, un-returned fields are marked{" "}
              <span className="font-medium text-warning">unknown — you set them</span>, never filled from a
              guess — and a new model is never auto-enabled.
            </div>
          </div>

          {/* Per-provider run cards. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {result.providers.map((p) => (
              <ProviderRunCard key={p.provider} provider={p.provider} status={p.status} ok={p.ok} />
            ))}
          </div>

          {/* ✚ New models — with the D-159-04 suitability filter (default-on, persisted). The
              toggle persists the operator default (onSetFilter → app_settings); "Show all" is a
              per-view reveal. The filter is DISPLAY-only — a hidden utility row stays in the
              confirmable diff, it is simply not rendered. */}
          {result.new.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={filterEnabled}
                    onChange={() => void handleToggleFilter()}
                    className="h-3.5 w-3.5 flex-none accent-primary"
                  />
                  Filter to chat/tool models
                </label>
                <span className="text-[11px] text-muted-foreground/80">
                  hides utility models (embeddings, audio, image, moderation, rerank…)
                </span>
                {filterError && (
                  <span className="text-xs text-destructive" role="alert">
                    {filterError}
                  </span>
                )}
              </div>
              {/* Add-one-not-all: search the new-models list + explicit bulk controls. Nothing is
                  pre-selected (opt-in), so Confirm writes ONLY what the operator ticks below. */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newSearch}
                  onChange={(e) => setNewSearch(e.target.value)}
                  placeholder="Search new models by id…"
                  aria-label="Search new models by id"
                  className="h-7 min-w-[12rem] flex-1 rounded-[6px] border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={selectAllVisibleNew}
                  disabled={visibleNew.length === 0}
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all{searchQuery ? " (matches)" : ""}
                </button>
                <button
                  type="button"
                  onClick={clearNewSelection}
                  disabled={selectedNewCount === 0}
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
                <span className="text-[11px] text-muted-foreground/80" data-testid="new-selected-count">
                  {selectedNewCount} selected · showing {visibleNew.length} of {result.new.length}
                </span>
              </div>
              <DiffGroup glyph="✚" tone="success" title="New models" note="not in the registry yet">
                {visibleNew.map((m) => (
                  <NewModelRow
                    key={m.model_id}
                    model={m}
                    accepted={accepted.has(m.model_id)}
                    enableNow={enableNow.has(m.model_id)}
                    complete={isComplete(m)}
                    draftFor={(field) => drafts[m.model_id]?.[field] ?? ""}
                    onToggleAccept={() => toggleAccept(m.model_id)}
                    onToggleEnable={() =>
                      setEnableNow((prev) => {
                        const next = new Set(prev)
                        if (next.has(m.model_id)) next.delete(m.model_id)
                        else next.add(m.model_id)
                        return next
                      })
                    }
                    onDraft={(field, value) => setDraft(m.model_id, field, value)}
                  />
                ))}
                {searchQuery && visibleNew.length === 0 && (
                  <div
                    data-testid="new-search-empty"
                    className="px-3 py-2 text-xs text-muted-foreground"
                  >
                    No new models match “{newSearch.trim()}”.
                  </div>
                )}
                {hiddenNewCount > 0 && (
                  <div
                    data-testid="utility-hidden-count"
                    className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border/60 bg-surface px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {hiddenNewCount} utility model{hiddenNewCount === 1 ? "" : "s"} hidden
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllThisView(true)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Show all
                    </button>
                  </div>
                )}
              </DiffGroup>
            </div>
          )}

          {/* ± Changed. */}
          {result.changed.length > 0 && (
            <DiffGroup glyph="±" tone="primary" title="Changed" note="capability differs from the registry">
              {result.changed.map((m) => (
                <ChangedModelRow
                  key={m.model_id}
                  model={m}
                  accepted={accepted.has(m.model_id)}
                  onToggleAccept={() => toggleAccept(m.model_id)}
                />
              ))}
            </DiffGroup>
          )}

          {/* ⊘ No longer offered (vanished — flagged, never auto-deleted). */}
          {result.vanished.length > 0 && (
            <DiffGroup glyph="⊘" tone="warning" title="No longer offered" note="in the registry, not returned by /models">
              {result.vanished.map((m) => (
                <VanishedRow
                  key={m.model_id}
                  provider={m.provider}
                  modelId={m.model_id}
                  decision={vanished[m.model_id]}
                  onDecide={(d) => setVanished((prev) => ({ ...prev, [m.model_id]: d }))}
                />
              ))}
              <p className="mt-1 text-[11px] text-warning">
                Vanished models are <span className="font-semibold">never auto-deleted</span> — you decide. A
                model can vanish because a provider paused an endpoint, not because it’s gone.
              </p>
            </DiffGroup>
          )}

          {/* Sticky confirm bar. */}
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-background/95 px-4 py-3 backdrop-blur">
            <span className="text-sm text-foreground">
              Confirm <span className="font-semibold">{changeCount}</span> change{changeCount === 1 ? "" : "s"}
              <span className="ml-2 text-xs text-muted-foreground">
                {result.new.length} new · {result.changed.length} changed · {result.vanished.length} vanished
              </span>
            </span>
            <span className="flex-1" />
            {confirmError && (
              <span className="text-xs text-destructive" role="alert">
                {confirmError}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setPhase("idle")
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={confirm}
              className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/15 px-3.5 py-1.5 text-sm font-medium text-success transition-colors hover:bg-success/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Apply confirmed changes
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** A client-side elapsed timer while discovery is in flight (the run is one synchronous
 *  server fan-out; per-provider outcomes land together when the promise resolves). */
function RunTimer() {
  const [elapsed, setElapsed] = useState(0)
  const start = useRef(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((Date.now() - start.current) / 1000), 200)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="font-mono text-xs text-muted-foreground" role="status">
      querying providers… {elapsed.toFixed(1)}s
    </div>
  )
}

/** One per-provider run card. `ok` + status derive the honest badge: capabilities ✓ (a
 *  caps-returning provider) / IDs only (an ok provider without caps) / no key — skipped /
 *  the VERBATIM error status (excluded, not failed). */
function ProviderRunCard({ provider, status, ok }: { provider: string; status: string; ok: boolean }) {
  const Logo = providerLogo(provider)
  const returnsCaps = ok && CAPS_PROVIDERS.has(provider)
  const errored = !ok && status !== "no_key"

  let badge: { text: string; className: string }
  if (returnsCaps) badge = { text: "capabilities ✓", className: "bg-success/15 text-success" }
  else if (ok) badge = { text: "IDs only", className: "bg-warning/15 text-warning" }
  else if (status === "no_key") badge = { text: "no key — skipped", className: "bg-muted text-muted-foreground" }
  else badge = { text: status, className: "bg-destructive/15 text-destructive" }

  return (
    <div
      data-provider={provider}
      className={cn(
        "rounded-md border bg-surface px-2.5 py-2 text-xs",
        errored ? "border-destructive/40" : returnsCaps ? "border-success/30" : "border-border/60",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="flex h-4 w-4 flex-none items-center justify-center">
          {Logo ? <Logo size={14} /> : <span className="text-[8px] font-bold">{provider.slice(0, 2).toUpperCase()}</span>}
        </span>
        <span className="truncate font-medium text-foreground">{provider}</span>
      </div>
      <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
        {errored && "verbatim error · "}
        {badge.text}
      </span>
    </div>
  )
}

function DiffGroup({
  glyph,
  tone,
  title,
  note,
  children,
}: {
  glyph: string
  tone: "success" | "primary" | "warning"
  title: string
  note: string
  children: React.ReactNode
}) {
  const glyphColor =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary"
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className={glyphColor} aria-hidden="true">
          {glyph}
        </span>
        {title}
        <span className="text-xs font-normal text-muted-foreground">— {note}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

/** One ✚ New model row. Un-returned capabilities render as amber "unknown — you set it"
 *  inputs; the "enable now" tick is disabled until the model is complete (SC#3). */
function NewModelRow({
  model,
  accepted,
  enableNow,
  complete,
  draftFor,
  onToggleAccept,
  onToggleEnable,
  onDraft,
}: {
  model: DiscoveryResult["new"][number]
  accepted: boolean
  enableNow: boolean
  complete: boolean
  draftFor: (field: string) => string
  onToggleAccept: () => void
  onToggleEnable: () => void
  onDraft: (field: string, value: string) => void
}) {
  const id = model.model_id
  const capValues = Object.values(model.capabilities)
  const anyUnknown = capValues.some(isUnknown)
  // D-159-03: the family this model belongs to (the reviewed pre-fill source). `anyPrefilled`
  // switches the warning copy — "review the suggested defaults" when at least one un-returned
  // field HAS a family default, vs "set the unknown fields" when every unknown is blank.
  const fam = familyDefaults(id)
  const anyPrefilled = Object.entries(model.capabilities).some(
    ([field, value]) => isUnknown(value) && defaultDraftForField(field, fam) != null,
  )
  // SC#3 / D-149-13: derive the provenance suffix from the ACTUAL per-field returned-vs-unknown
  // counts, not the binary `!anyUnknown`. The old all-or-nothing basis lied whenever a provider
  // returned SOME (not all) fields — e.g. a Google model returns its token limits but never
  // native_tools, so the card read "returned IDs only" while the google provider run card
  // correctly read "capabilities ✓". Three-way: full ✓ / IDs only / a truthful partial label
  // (never claim "IDs only" when any field returned, nor "full ✓" when any field is unknown).
  const returnedCount = capValues.filter((v) => !isUnknown(v)).length
  const totalCount = capValues.length
  const provenanceLabel =
    returnedCount === totalCount
      ? "returned full capabilities ✓"
      : returnedCount === 0
        ? "returned IDs only"
        : "returned some capabilities"

  return (
    <div
      data-new-model={id}
      className={cn(
        "rounded-md border bg-surface px-3.5 py-3",
        accepted ? "border-success/40" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <AcceptCheck checked={accepted} label={`Accept ${id}`} onToggle={onToggleAccept} />
        <span className="font-mono text-sm text-foreground">{id}</span>
        <span className="text-xs text-muted-foreground">
          · {model.provider} · {provenanceLabel}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
        {Object.entries(model.capabilities).map(([field, value]) => {
          const label = LABEL_FOR.get(field) ?? field
          if (!isUnknown(value)) {
            return (
              <span
                key={field}
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-border/60 bg-background px-2 py-1 text-xs"
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-success">{renderValue(field, value)}</span>
              </span>
            )
          }
          // D-159-03: a family default pre-fills this un-returned field → style it distinctly as
          // amber "default — confirm" (a REVIEWED suggestion), vs the blank amber "unknown — you
          // set it" when no default exists, vs the green provider-confirmed value above. The draft
          // itself is seeded on run (seedDraftsFromDefaults), so the input shows the family value.
          const prefilled = defaultDraftForField(field, fam) != null
          return (
            <span
              key={field}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-xs",
                prefilled
                  ? "border-warning/60 bg-warning/[0.09]"
                  : "border-warning/40 bg-warning/[0.05]",
              )}
            >
              <span className="text-warning">{label}</span>
              {field === "native_tools" ? (
                <select
                  aria-label={`${label} for ${id}`}
                  value={draftFor(field)}
                  onChange={(e) => onDraft(field, e.target.value)}
                  className="rounded border border-warning/50 bg-background px-1 py-0.5 font-mono text-xs text-foreground"
                >
                  <option value="">unknown</option>
                  <option value="native">native ✓</option>
                  <option value="none">none</option>
                </select>
              ) : (
                <input
                  type="number"
                  aria-label={`${label} for ${id}`}
                  placeholder="set…"
                  value={draftFor(field)}
                  onChange={(e) => onDraft(field, e.target.value)}
                  className="w-20 rounded border border-warning/50 bg-background px-1.5 py-0.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50"
                />
              )}
              {prefilled && (
                <span className="rounded bg-warning/15 px-1 py-px font-mono text-[9px] uppercase tracking-wide text-warning">
                  default — confirm
                </span>
              )}
            </span>
          )
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-7">
        <label
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            complete ? "text-foreground" : "cursor-not-allowed text-muted-foreground/60",
          )}
          title={complete ? undefined : "Set every capability before this model can be enabled"}
        >
          <input
            type="checkbox"
            aria-label={`Enable ${id} now`}
            checked={enableNow && complete}
            disabled={!complete}
            onChange={onToggleEnable}
          />
          Enable now
        </label>
        {anyUnknown && (
          <span className="inline-flex items-center gap-1 text-[11px] text-warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {anyPrefilled
              ? "review the suggested defaults — it will NOT be auto-enabled"
              : "set the unknown fields — it will NOT be auto-enabled"}
          </span>
        )}
      </div>
    </div>
  )
}

/** One ± Changed row: each provider-returned change reads old (strikethrough) → new. */
function ChangedModelRow({
  model,
  accepted,
  onToggleAccept,
}: {
  model: DiscoveryResult["changed"][number]
  accepted: boolean
  onToggleAccept: () => void
}) {
  const id = model.model_id
  return (
    <div
      data-changed-model={id}
      className={cn(
        "rounded-md border bg-surface px-3.5 py-3",
        accepted ? "border-success/40" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <AcceptCheck checked={accepted} label={`Accept ${id}`} onToggle={onToggleAccept} />
        <span className="font-mono text-sm text-foreground">{id}</span>
        <span className="text-xs text-muted-foreground">· {model.provider}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2 pl-7">
        {Object.entries(model.changes).map(([field, ch]) => (
          <span
            key={field}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-primary/40 bg-background px-2 py-1 text-xs"
          >
            <span className="text-muted-foreground">{LABEL_FOR.get(field) ?? field}</span>
            <span className="font-mono text-muted-foreground line-through">{renderValue(field, ch.from)}</span>
            <span className="font-mono text-primary">{renderValue(field, ch.to)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** One ⊘ Vanished row — flagged with mark-deprecated / disable / keep. NEVER a delete. */
function VanishedRow({
  provider,
  modelId,
  decision,
  onDecide,
}: {
  provider: string
  modelId: string
  decision: VanishedDecision | undefined
  onDecide: (d: VanishedDecision) => void
}) {
  const opts: { key: VanishedDecision; label: string }[] = [
    { key: "deprecate", label: "Mark deprecated" },
    { key: "disable", label: "Disable" },
    { key: "keep", label: "Keep as-is" },
  ]
  return (
    <div
      data-vanished-model={modelId}
      className="flex flex-wrap items-center gap-2.5 rounded-md border border-dashed border-warning/40 bg-surface px-3.5 py-2.5"
    >
      <span className="font-mono text-sm text-muted-foreground">{modelId}</span>
      <span className="text-xs text-muted-foreground">· {provider}</span>
      <span className="flex-1" />
      <div className="flex gap-1.5">
        {opts.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onDecide(o.key)}
            className={cn(
              "rounded-[5px] border px-2 py-1 text-[11px] transition-colors",
              decision === o.key
                ? "border-warning/50 bg-warning/15 text-warning"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The accept tick (a checkbox). */
function AcceptCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onToggle}
      className="h-4 w-4 flex-none accent-success"
    />
  )
}

/** Render a capability value: booleans read as native/none; numbers compact; the UNKNOWN
 *  sentinel never reaches here (unknown fields render as inputs). */
function renderValue(field: string, value: number | boolean | string | null): string {
  if (field === "native_tools") {
    if (value === true) return "✓ native"
    if (value === false) return "none"
    return String(value)
  }
  if (typeof value === "number") {
    return value >= 1000 && value % 100 === 0 ? `${value / 1000}k` : value.toLocaleString()
  }
  return value == null ? "—" : String(value)
}
