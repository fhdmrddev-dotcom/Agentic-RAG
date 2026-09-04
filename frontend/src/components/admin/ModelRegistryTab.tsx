// ─────────────────────────────────────────────────────────────────────────────
// Phase 149 Plan 07 (MODEL-01 / sketch 070-A) — the Model Registry capability
// instrument table.
//
// The body of the Control Room "Model Registry" tab: every model the platform can
// route to, provider-grouped into collapsible sections, with the real
// `model_capabilities_overrides` columns as inline click-to-edit cells
// (context / max-out / native-tools / timeout / enabled / deprecated).
//
// THE SEED-116 TWO-LAYER PATTERN MADE VISIBLE (D-149-01): the `enabled` flag couples
// to a derived `✓ in picker / ✕ hidden` chip — the operator sees exactly what users
// can pick. A 🔓/🔒 lock pins the org default; on a `✕ hidden` row the lock control
// is GATED (courtesy — the 148 self-row disabled-affordance) so the operator isn't
// invited into a guaranteed refusal (the Plan-06 lock-path 409 is the real wall).
//
// HONESTY RAILS:
//   • OVR (a stored override) reads distinct from a dim+italic DEF (inherited from
//     the built-in registry); every overridden field carries a Reset that sends an
//     explicit `null` (clears to DEF — Plan 05 Task 3).
//   • deprecated ≠ disabled (D-149-04): a deprecated row stays enabled/selectable and
//     only carries the informational marker; it NEVER flips the coupling chip.
//   • A capability change takes effect on the next request — no restart (the picker
//     re-reads within the ~30s TTL, SC#1). The tab never optimistically flips a value;
//     the shell re-fetches after every write (server = source of truth).
//   • A 409 (disabling the org-default/locked model) surfaces the server's
//     plain-language refusal IN-ROW — never a silent failure.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (ControlRoomPage) owns the
// fetch + the server writes; this leaf renders the table and reports the intended edit.
// `rows === null` → a calm loading placeholder (honest, mirrors UsersAndAccess).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Lock, Plus, RotateCcw, Unlock } from "lucide-react"

import { ApiError, type AddModelBody, type ModelCapabilityPatch, type ModelRegistryRow } from "@/lib/api"
import { familyDefaults } from "@/lib/model-defaults"
import { providerLogo } from "@/lib/providerLogo"
import { cn } from "@/lib/utils"

interface ModelRegistryTabProps {
  /** Every registry row the shell fetched; `null` while the fetch is in flight. */
  rows: ModelRegistryRow[] | null
  /** Edit one model's capabilities → `PATCH /admin/models/{id}`. An explicit `null` on a
   *  field is a Reset (clears the override to DEF). Resolves on success; rejects (an
   *  `ApiError(409, detail)`) so the row can surface the plain-language refusal in place. */
  onSetCapability: (modelId: string, patch: ModelCapabilityPatch) => Promise<void>
  /** Lock/unlock the org default → `PUT /admin/models/{id}/lock`. Only ever called for an
   *  ENABLED row (the leaf gates the control on `✕ hidden` rows). */
  onLock: (modelId: string, locked: boolean) => Promise<void>
  /** Add ONE model by explicit id + provider → `POST /admin/models` (D-159-02). The body
   *  NEVER carries `enabled` (`AddModelBody` has no such field — the server forces
   *  `enabled=false`; the model lands disabled and is enabled from the table, SC#3). Rejects
   *  with an `ApiError(409/422, detail)` so the form surfaces the plain-language refusal.
   *  Optional so the leaf renders byte-identical where the shell hasn't wired it yet — the
   *  "+ Add model by ID" affordance appears ONLY when the shell provides this handler. */
  onAddModel?: (body: AddModelBody) => Promise<void>
  /** When true, reveal the raw column names (⌥ LANG-01 reveal). */
  showTechnical: boolean
}

/** The three inline-editable numeric columns (the 112/FolderNode inline-edit cells). */
interface NumField {
  key: "context_window_tokens" | "max_output_tokens" | "llm_call_timeout_seconds"
  label: string
  tech: string
  /** Render suffix — the timeout reads as seconds. */
  suffix?: string
}

const NUM_FIELDS: readonly NumField[] = [
  { key: "context_window_tokens", label: "Context", tech: "context_window_tokens" },
  { key: "max_output_tokens", label: "Max out", tech: "max_output_tokens" },
  { key: "llm_call_timeout_seconds", label: "Timeout", tech: "llm_call_timeout_seconds", suffix: "s" },
]

/** The capability columns a Reset may clear — the scope of the row-level "Reset overrides".
 *
 *  ⚠ `enabled` / `deprecated` / `deprecated_reason` are DELIBERATELY EXCLUDED even though the
 *  backend tracks them in `overridden_fields` exactly like the rest (`_MODEL_CAP_COLUMNS` has
 *  eight entries, not five). They are operator LIFECYCLE state, not capabilities, and clearing
 *  them is not a no-op: `_registry_row` resolves a null `enabled` to **True**
 *  (`model_registry.py`), so a "reset" on a model an operator deliberately hid would put it
 *  back in front of users. A reset hands back the built-in DEFAULT; it never makes a
 *  visibility decision on the operator's behalf. */
const RESETTABLE_CAPS = [
  "context_window_tokens",
  "max_output_tokens",
  "llm_call_timeout_seconds",
  "native_tools",
  "emit_tier",
] as const

/** ONE numbering convention for every numeric cell: thousands-grouped digits, plus the
 *  field's unit suffix where it has one (`16,384` · `4,096` · `550s`). ⚠ There used to be a
 *  compact-`k` branch here that fired only when `n % 100 === 0`, so one column could read
 *  `400k` while the column beside it read `131,072` — the same quantity styled two ways in
 *  one row. These are inline-EDITABLE values: the operator types the exact integer back, so
 *  the display must be the number they typed, never a rounded rendering of it. */
function fmtNum(n: number, suffix?: string): string {
  return `${n.toLocaleString("en-US")}${suffix ?? ""}`
}

/** Group rows by provider, preserving first-seen provider order (stable sections). */
function groupByProvider(rows: ModelRegistryRow[]): [string, ModelRegistryRow[]][] {
  const map = new Map<string, ModelRegistryRow[]>()
  for (const r of rows) {
    const list = map.get(r.provider)
    if (list) list.push(r)
    else map.set(r.provider, [r])
  }
  return [...map.entries()]
}

/** The 070-A instrument table: provider-grouped collapsible sections of inline-edit
 *  capability rows, with the enabled→picker coupling chip + the gated-on-disabled lock. */
export function ModelRegistryTab({
  rows,
  onSetCapability,
  onLock,
  onAddModel,
  showTechnical,
}: ModelRegistryTabProps) {
  const groups = useMemo(() => (rows ? groupByProvider(rows) : []), [rows])
  // ⚠ This tracks the OPEN sections, not the closed ones — so the empty initial Set means
  // EVERY provider lands FOLDED, which is what an operator opening this tab should see. The
  // registry is provider-grouped precisely because nobody reads all of it at once, and with
  // every section open the page ran to several screens before "Discover models".
  //
  // Storing the OPEN set is also what makes "folded by default" work without an effect:
  // provider names are only known AFTER the fetch resolves, so a `collapsed` set would have
  // to be back-filled once `rows` arrives — which flashes the table open on first paint and
  // has to decide what to do about a provider that appears later.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (rows === null) {
    return (
      <div
        className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-8 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading the model registry…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No models in the registry yet. Run discovery to find models from your providers.
      </div>
    )
  }

  function toggleSection(provider: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* D-159-02: the "+ Add model by ID" affordance sits ABOVE the (byte-identical)
          provider-grouped table. Rendered only when the shell wires `onAddModel`. */}
      {onAddModel && <AddModelSection onAddModel={onAddModel} />}
      <section aria-label="Model registry" className="space-y-2.5">
      {groups.map(([provider, providerRows]) => {
        const isCollapsed = !expanded.has(provider)
        const Logo = providerLogo(provider)
        const shownCount = providerRows.filter((r) => r.enabled).length
        return (
          <div
            key={provider}
            data-provider={provider}
            className="overflow-hidden rounded-[12px] border border-border/70 bg-surface"
          >
            <button
              type="button"
              onClick={() => toggleSection(provider)}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground">
                {Logo ? <Logo size={16} /> : provider.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-semibold text-foreground">{provider}</span>
              <span className="text-xs text-muted-foreground">
                {providerRows.length} model{providerRows.length === 1 ? "" : "s"} · {shownCount} shown to users
              </span>
              <span className="flex-1" />
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-none text-muted-foreground transition-transform",
                  isCollapsed && "-rotate-90",
                )}
                aria-hidden="true"
              />
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto border-t border-border/60">
                <table className="w-full border-collapse text-sm table-fixed">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {/* Column widths are set here and enforced by table-fixed so every
                          provider section renders with identical proportions. */}
                      <Th className="w-[21%]">
                        Model {showTechnical && <TechName>model_id</TechName>}
                      </Th>
                      {NUM_FIELDS.map((f) => (
                        <Th key={f.key} className="w-[10%]">
                          {f.label}
                          {showTechnical && (
                            <TechName className="block break-all leading-tight">{f.tech}</TechName>
                          )}
                        </Th>
                      ))}
                      <Th className="w-[8%]">
                        Tools {showTechnical && <TechName>native_tools</TechName>}
                      </Th>
                      <Th className="w-[16%]">
                        <span className="inline-flex items-center gap-1">
                          Document filling {showTechnical && <TechName>emit_tier</TechName>}
                          <span
                            title="Setting this records what you believe the provider supports; nothing verifies it against the provider."
                            aria-label="Document filling note"
                            className="cursor-help select-none text-muted-foreground/50 hover:text-muted-foreground"
                          >
                            ⓘ
                          </span>
                        </span>
                      </Th>
                      <Th className="w-[6%]">
                        Enabled {showTechnical && <TechName>enabled</TechName>}
                      </Th>
                      <Th className="w-[9%]">Users see</Th>
                      <Th className="w-[10%]" aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {providerRows.map((row) => (
                      <ModelRow
                        key={row.model_id}
                        row={row}
                        onSetCapability={onSetCapability}
                        onLock={onLock}
                        showTechnical={showTechnical}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
      </section>
    </div>
  )
}

function Th({ children, className, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("border-t border-border/40 px-3 py-2 text-left font-medium first:pl-4", className)}
      {...rest}
    >
      {children}
    </th>
  )
}

function TechName({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[9px] text-muted-foreground", className)}>{children}</span>
}

/** One capability row. Owns only its transient write state (busy / receipt / the
 *  in-row 409 refusal / which numeric field is being edited + the deprecated-reason
 *  draft). The capability VALUES are the shell's source of truth — no optimistic flip;
 *  the shell re-fetches after every write. */
function ModelRow({
  row,
  onSetCapability,
  onLock,
  showTechnical,
}: {
  row: ModelRegistryRow
  onSetCapability: (modelId: string, patch: ModelCapabilityPatch) => Promise<void>
  onLock: (modelId: string, locked: boolean) => Promise<void>
  showTechnical: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState(false)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const id = row.model_id
  const overridden = new Set(row.overridden_fields)
  // WR-05 honest lock: anthropic/google route through their native SDK branches, which never
  // consult `native_tools` — so neither the toggle NOR its Reset does anything there.
  const toolsGated = row.provider === "anthropic" || row.provider === "google"

  /** The single write chokepoint — busy → onSetCapability → ✎ receipt flash, or the
   *  in-row plain refusal on a rejection (the server 409 detail is `ApiError.message`). */
  async function write(patch: ModelCapabilityPatch) {
    if (busy) return
    setBusy(true)
    setErrorDetail(null)
    try {
      await onSetCapability(id, patch)
      setReceipt(true)
      window.setTimeout(() => setReceipt(false), 3500)
    } catch (err) {
      setErrorDetail(
        err instanceof ApiError ? err.message : "Couldn’t save that change — try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function lock(next: boolean) {
    if (busy) return
    setBusy(true)
    setErrorDetail(null)
    try {
      await onLock(id, next)
      setReceipt(true)
      window.setTimeout(() => setReceipt(false), 3500)
    } catch (err) {
      setErrorDetail(err instanceof ApiError ? err.message : "Couldn’t update the lock — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <tr data-model={id} data-coupling={row.enabled ? "shown" : "hidden"} className="hover:bg-accent/20">
        {/* Model id + org-default marker + the deprecated toggle. */}
        <td className="border-t border-border/40 py-2 pl-4 pr-3 align-middle">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="block truncate font-mono text-xs text-foreground">{id}</span>
            {row.is_default && (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
                org default
              </span>
            )}
          </div>
          <DeprecatedControl row={row} busy={busy} onWrite={write} />
        </td>

        {/* Inline-edit numeric cells (OVR vs dim+italic DEF + a Reset on overridden). */}
        {NUM_FIELDS.map((f) => (
          <td key={f.key} className="border-t border-border/40 px-3 py-2 align-middle">
            <NumericCell
              modelId={id}
              field={f}
              value={row[f.key]}
              overridden={overridden.has(f.key)}
              editing={editing === f.key}
              busy={busy}
              onStartEdit={() => setEditing(f.key)}
              onCancel={() => setEditing(null)}
              onCommit={(v) => {
                setEditing(null)
                if (v !== row[f.key]) void write({ [f.key]: v } as ModelCapabilityPatch)
              }}
              onReset={() => void write({ [f.key]: null } as ModelCapabilityPatch)}
            />
          </td>
        ))}

        {/* native_tools toggle. WR-05 (review round 2) honest lock: models whose provider is
            anthropic/google are served by the NATIVE SDK branches (agent_loop dispatches on
            the active provider BEFORE any calling-mode read), which never consult
            native_tools — a write here would record an OVR + ✎ receipt while routing stays
            byte-identical. Silent inertness on an operator control is banned (Control-Room
            honest-locks doctrine), so the toggle is gated with the always-native tooltip. */}
        <td className="border-t border-border/40 px-3 py-2 align-middle">
          <div className="flex min-w-0 items-center gap-1.5">
            <RowToggle
              on={row.native_tools}
              busy={busy}
              label={`Native tools for ${id}`}
              tone="primary"
              gated={toolsGated}
              gatedTitle="Always native on this provider — Anthropic/Google models run their native SDK paths, which don't consult this toggle."
              onToggle={() => void write({ native_tools: !row.native_tools })}
            />
            {/* ⚠ `native_tools` lands in `overridden_fields` exactly like the numeric columns,
                but this cell used to render the EFFECTIVE value and nothing else — so once an
                operator flipped Tools they could not see it was an override, and had no way
                back to the built-in default from this screen at all. On a gated provider the
                marker is read-only: a write here changes no routing, and offering an inert
                click is the silent inertness the honest-locks doctrine bans. */}
            <SourceTag
              overridden={overridden.has("native_tools")}
              fieldLabel="Tools"
              modelId={id}
              busy={busy}
              onReset={toolsGated ? undefined : () => void write({ native_tools: null })}
            />
          </div>
        </td>

        {/* emit_tier — this tab's FIRST enum column (NUM_FIELDS is int-only, RowToggle is
            boolean, so neither was reusable). D-15 / SEED-085: the operator reads the
            user-facing sentence; the raw engine token appears only under the ⌥ reveal. */}
        <td className="border-t border-border/40 px-3 py-2 align-middle">
          <EmitTierControl
            row={row}
            busy={busy}
            overridden={overridden.has("emit_tier")}
            showTechnical={showTechnical}
            onWrite={write}
          />
        </td>

        {/* enabled toggle. */}
        <td className="border-t border-border/40 px-3 py-2 align-middle">
          <RowToggle
            on={row.enabled}
            busy={busy}
            label={`Enabled for ${id}`}
            tone="success"
            onToggle={() => void write({ enabled: !row.enabled })}
          />
        </td>

        {/* The derived enabled→picker coupling chip (the two-layer pattern made visible). */}
        <td className="border-t border-border/40 px-3 py-2 align-middle">
          <CouplingChip enabled={row.enabled} locked={row.is_locked} />
        </td>

        {/* Actions: the lock (gated on a ✕ hidden row) + the busy/receipt affordance. */}
        <td className="border-t border-border/40 px-3 py-2 align-middle">
          <div className="flex items-center justify-end gap-2">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
            <RowResetControl row={row} busy={busy} onWrite={write} />
            {receipt && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning" role="status">
                <Check className="h-3 w-3 text-success" aria-hidden="true" />✎ recorded
              </span>
            )}
            <LockControl row={row} busy={busy} onLock={lock} />
          </div>
        </td>
      </tr>

      {/* The in-row 409 plain-language refusal — never a silent failure (D-149-09). */}
      {errorDetail && (
        <tr data-model-error={id}>
          <td colSpan={NUM_FIELDS.length + 6} className="border-t-0 px-4 pb-2">
            <span className="text-[11px] font-medium text-destructive" role="alert">
              {errorDetail}
            </span>
          </td>
        </tr>
      )}

      {showTechnical && (
        <tr>
          <td colSpan={NUM_FIELDS.length + 6} className="border-t-0 px-4 pb-1 pt-0">
            <span className="font-mono text-[9px] text-muted-foreground">
              {row.capability_source === "db_override" ? "db_override" : "registry"} ·{" "}
              {row.overridden_fields.length > 0
                ? `overridden: ${row.overridden_fields.join(", ")}`
                : "all inherited (DEF)"}
            </span>
          </td>
        </tr>
      )}
    </>
  )
}

/** The three tier sentences, in the operator's words rather than the engine's.
 *
 *  ⚠ THESE STRINGS ARE SHARED BY CONSTRUCTION, NOT BY CONVENTION. The workflow-canvas model
 *  picker renders the same three sentences; keeping one list here (rather than two lists that
 *  happen to agree today) is what stops the two surfaces from drifting into describing the
 *  same stored value differently. D-15 / SEED-085: the raw `emit_tier` token is an ENGINE
 *  name and appears only under the ⌥ Technical-names reveal. */
const EMIT_TIER_OPTIONS = [
  { value: "force_strict", label: "Can fill a document — guaranteed format" },
  { value: "force", label: "Can fill a document" },
  { value: "coerce", label: "Best-effort only — may not fill a document" },
] as const

/** The per-row forced-emission tier control — this tab's first enum column.
 *
 *  ⚠ A `null` tier renders as `coerce`, NOT as blank. Blank would imply "unknown", and the
 *  backend does not treat it that way: `forced_emit.py` reads `cap.get("emit_tier", "coerce")`,
 *  so an untracked model is ALREADY behaving as best-effort. Showing "—" would hide a real,
 *  active behaviour behind a shrug. The OVR/DEF tag is what distinguishes "an operator asserted
 *  this" from "this is the default it falls back to". */
function EmitTierControl({
  row,
  busy,
  overridden,
  showTechnical,
  onWrite,
}: {
  row: ModelRegistryRow
  busy: boolean
  overridden: boolean
  showTechnical: boolean
  onWrite: (patch: ModelCapabilityPatch) => Promise<void>
}) {
  const effective = row.emit_tier ?? "coerce"

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] text-foreground disabled:opacity-50"
          value={effective}
          disabled={busy}
          aria-label={`Document filling for ${row.model_id}`}
          data-emit-tier={row.model_id}
          onChange={(e) => {
            const next = e.target.value as (typeof EMIT_TIER_OPTIONS)[number]["value"]
            if (next !== row.emit_tier) void onWrite({ emit_tier: next })
          }}
        >
          {EMIT_TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {/* The shared marker — which is also this field's Reset (explicit `null` clears the
            override to DEF). It replaces a bespoke lowercase `ovr`/`def` pair that disagreed
            with the OVR/DEF every other column renders for the very same state. */}
        <SourceTag
          overridden={overridden}
          fieldLabel="Document filling"
          modelId={row.model_id}
          busy={busy}
          onReset={() => void onWrite({ emit_tier: null })}
        />
      </div>

      {showTechnical && <TechName>emit_tier: {row.emit_tier ?? "null"}</TechName>}
    </div>
  )
}

/** One inline click-to-edit numeric cell. Display shows the effective value + an OVR
 *  (stored) or dim+italic DEF (inherited) tag; a Reset appears only on an overridden
 *  field and sends an explicit `null` (clears to DEF). */
function NumericCell({
  modelId,
  field,
  value,
  overridden,
  editing,
  busy,
  onStartEdit,
  onCancel,
  onCommit,
  onReset,
}: {
  modelId: string
  field: NumField
  /** WR-04: `null` = the value is not tracked in the registry (renders "—", empty input). */
  value: number | null
  overridden: boolean
  editing: boolean
  busy: boolean
  onStartEdit: () => void
  onCancel: () => void
  onCommit: (value: number) => void
  onReset: () => void
}) {
  // One-shot guard so an Enter-commit isn't re-fired by the blur that follows it (and an
  // Escape-cancel isn't turned into a commit by its own blur). Reset each time editing opens.
  const settled = useRef(false)
  // Phase 155 (A11Y-01): focus the editor via ref when the cell opens, instead of
  // the declarative `autoFocus` prop (jsx-a11y/no-autofocus) — same behavior.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) {
      settled.current = false
      inputRef.current?.focus()
    }
  }, [editing])

  if (editing) {
    const commitFrom = (raw: string) => {
      if (settled.current) return
      settled.current = true
      const n = parseInt(raw, 10)
      // A valid number commits; an empty/invalid edit is a no-op (never a stray Reset), so a
      // "not tracked" (null) cell the operator opens but leaves blank stays untracked.
      if (Number.isFinite(n)) onCommit(n)
      else onCancel()
    }
    return (
      <input
        ref={inputRef}
        type="number"
        aria-label={`${field.label} for ${modelId}`}
        defaultValue={value === null ? "" : String(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitFrom((e.target as HTMLInputElement).value)
          } else if (e.key === "Escape") {
            settled.current = true
            onCancel()
          }
        }}
        onBlur={(e) => commitFrom(e.target.value)}
        className="w-full min-w-0 rounded-[5px] border border-primary bg-background px-1.5 py-1 font-mono text-xs text-foreground"
      />
    )
  }

  // ⚠ The tag sits OUTSIDE the edit button, not inside it. It is a button now (it carries
  // the Reset), and a button nested in a button is invalid HTML whose click reaches both.
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        aria-label={`Edit ${field.label} for ${modelId}`}
        onClick={onStartEdit}
        className={cn(
          "inline-flex min-w-0 items-center rounded-[5px] border border-transparent px-1.5 py-0.5 text-left transition-colors hover:border-border hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
          !overridden && "italic text-muted-foreground",
        )}
      >
        <span className="truncate font-mono text-xs">
          {value === null ? "—" : fmtNum(value, field.suffix)}
        </span>
      </button>
      <SourceTag
        overridden={overridden}
        fieldLabel={field.label}
        modelId={modelId}
        busy={busy}
        onReset={onReset}
      />
    </div>
  )
}

/** OVR (your stored edit, primary) vs DEF (inherited from the built-in registry, dim). */
/** The row-level "put this model back how you found it" — ONE write that clears EVERY
 *  overridden capability at once.
 *
 *  The backend already makes this a single request: `set_model_capability` writes only the
 *  keys PRESENT in the body and treats an explicit `null` as a clear (`admin.py`), so five
 *  nulls is one parameterized upsert, one cache invalidation and one ✎ `model.capability.set`
 *  receipt — not five round trips, and not five audit rows for one intention.
 *
 *  ⚠ ARM-TO-CONFIRM, per the Control-Room graded-action-guards rule. Clearing up to five
 *  stored values is a bigger step than clearing one, so the first click ARMS (naming the
 *  count it is about to clear) and only the second commits. It disarms itself after 4s so an
 *  armed destructive control is never left sitting on the screen. The accessible name is
 *  STABLE across both states — an assistive-tech user must not have the control rename itself
 *  underneath them mid-interaction.
 *
 *  Renders NOTHING on a row with no capability overrides: an action with no effect is not an
 *  affordance, and this column is shared with the lock. */
function RowResetControl({
  row,
  busy,
  onWrite,
}: {
  row: ModelRegistryRow
  busy: boolean
  onWrite: (patch: ModelCapabilityPatch) => Promise<void>
}) {
  const [armed, setArmed] = useState(false)
  const disarmAt = useRef<number | null>(null)
  // The timer outlives a row that unmounts while armed (a re-fetch replaces the list) — clear
  // it, or the callback fires setState on a gone component.
  useEffect(
    () => () => {
      if (disarmAt.current !== null) window.clearTimeout(disarmAt.current)
    },
    [],
  )

  const stored = RESETTABLE_CAPS.filter((c) => row.overridden_fields.includes(c))
  if (stored.length === 0) return null

  const noun = stored.length === 1 ? "value" : "values"
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Reset ${stored.length} overridden ${noun} for ${row.model_id}`}
      title={`Clear every operator override on this model (${stored.join(", ")}) and fall back to the built-in defaults.`}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          disarmAt.current = window.setTimeout(() => setArmed(false), 4000)
          return
        }
        if (disarmAt.current !== null) window.clearTimeout(disarmAt.current)
        setArmed(false)
        void onWrite(Object.fromEntries(stored.map((c) => [c, null])) as ModelCapabilityPatch)
      }}
      className={cn(
        "inline-flex flex-none items-center gap-0.5 rounded-[5px] border px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-50",
        armed
          ? "border-warning bg-warning/15 font-medium text-warning"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <RotateCcw className="h-2.5 w-2.5 flex-none" aria-hidden="true" />
      {armed ? `Reset ${stored.length}?` : stored.length}
    </button>
  )
}

/** The per-field OVR/DEF marker — and, on an overridden field, the Reset ITSELF.
 *
 *  The tag IS the button. D-149-03's Reset used to be a separate control beside it, which
 *  cost most of a column's width in a `table-fixed` table: three numeric cells carrying
 *  value + tag + Reset overflowed their 8% columns and painted over Tools. The marker
 *  already appears on exactly the fields that CAN be reset, so folding the action into it
 *  costs zero extra width — and it extends to any column that can carry an override, which
 *  is how `native_tools` finally got one. The accessible name is unchanged
 *  (`Reset <field> for <model>`), so a Reset is still a named control.
 *
 *  DEF is a plain span, never a button: there is no stored override to clear, so there is
 *  nothing to click. Same for an overridden field whose reset is inert (the gated
 *  anthropic/google Tools column) — offering a click that changes no routing would be the
 *  silent-inertness the honest-locks doctrine bans. */
function SourceTag({
  overridden,
  fieldLabel,
  modelId,
  busy,
  onReset,
}: {
  overridden: boolean
  fieldLabel: string
  modelId: string
  busy?: boolean
  /** Omit to render the marker read-only (a DEF field, or an override that cannot be cleared). */
  onReset?: () => void
}) {
  if (!overridden || !onReset) {
    return (
      <span
        className={cn(
          "flex-none rounded px-1 py-px font-mono text-[9px] tracking-wide",
          overridden ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {overridden ? "OVR" : "DEF"}
      </span>
    )
  }
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Reset ${fieldLabel} for ${modelId}`}
      title={`Set by an operator — click to reset ${fieldLabel} to the built-in default`}
      onClick={onReset}
      className="group/ovr inline-flex flex-none items-center gap-0.5 rounded bg-primary/15 px-1 py-px font-mono text-[9px] tracking-wide text-primary transition-colors hover:bg-primary/30 disabled:opacity-50"
    >
      OVR
      <RotateCcw
        className="h-2 w-2 flex-none opacity-0 transition-opacity group-hover/ovr:opacity-100"
        aria-hidden="true"
      />
    </button>
  )
}

/** The deprecated toggle + an optional short reason (operator context, never shown to
 *  end users). deprecated ≠ disabled (D-149-04): toggling it NEVER touches `enabled`, so
 *  the row stays selectable and the coupling chip is unchanged. */
function DeprecatedControl({
  row,
  busy,
  onWrite,
}: {
  row: ModelRegistryRow
  busy: boolean
  onWrite: (patch: ModelCapabilityPatch) => Promise<void>
}) {
  // IN-02: seed the reason draft from the stored note so re-editing a deprecated model
  // preserves it (a blur/enter no longer overwrites the current reason with a blank).
  const [reason, setReason] = useState(row.deprecated_reason ?? "")

  // Full commit parity with InlineNumberCell (D-149-04 / Test-10): a one-shot `settled`
  // guard so an Enter-commit isn't re-fired by the trailing blur, and an Escape-cancel
  // isn't turned into a commit by its own blur. Reset when the reason editor (re)mounts
  // (the row becomes deprecated) AND on every fresh keystroke — so a genuine re-edit still
  // commits, but a single logical edit writes at most once.
  const settled = useRef(false)
  useEffect(() => {
    if (row.deprecated) settled.current = false
  }, [row.deprecated])

  function commitReason() {
    if (settled.current) return
    // WR-03 (review round 2) dirty check — the missing half of the InlineNumberCell
    // parity (NumericCell's parent drops no-change commits): a plain focus+blur /
    // tab-through with zero edits must never PATCH, never stamp a ✎ audit receipt for
    // a change that did not happen, and never trigger the shell's registry re-fetch.
    const next = reason.trim() || null
    if (next === (row.deprecated_reason ?? null)) return
    // WR-03 busy-window: if another write on this row is in flight, do NOT settle —
    // settling here (before write()'s busy guard dropped the call) swallowed the
    // typed reason permanently. Left un-settled, the next blur/Enter commits it.
    if (busy) return
    settled.current = true
    void onWrite({ deprecated: true, deprecated_reason: next })
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <RowToggle
        on={row.deprecated}
        busy={busy}
        label={`Deprecated for ${row.model_id}`}
        tone="warning"
        size="sm"
        onToggle={() =>
          void onWrite(
            row.deprecated
              ? { deprecated: false }
              : { deprecated: true, ...(reason.trim() ? { deprecated_reason: reason.trim() } : {}) },
          )
        }
      />
      <span
        className={cn(
          "text-[10px]",
          row.deprecated ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        deprecated
      </span>
      {row.deprecated && (
        <input
          type="text"
          aria-label={`Deprecation reason for ${row.model_id}`}
          placeholder="reason (optional)"
          value={reason}
          disabled={busy}
          onChange={(e) => {
            // A fresh keystroke invalidates a prior commit → a genuine re-edit commits again.
            settled.current = false
            setReason(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Commit (with preventDefault so it never triggers a stray surrounding submit).
              e.preventDefault()
              commitReason()
            } else if (e.key === "Escape") {
              // Cancel: revert the draft to the stored reason and never write.
              settled.current = true
              setReason(row.deprecated_reason ?? "")
            }
          }}
          onBlur={commitReason}
          className="w-40 rounded-[5px] border border-warning/40 bg-background px-1.5 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground/50"
        />
      )}
    </div>
  )
}

/** The derived `✓ in picker` / `✕ hidden` coupling chip (D-149-01). Locked adds "· locked". */
function CouplingChip({ enabled, locked }: { enabled: boolean; locked: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        ✕ hidden
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">
      ✓ in picker{locked ? " · locked" : ""}
    </span>
  )
}

/** The lock affordance. On a `✕ hidden` (disabled) row it is GATED/disabled with a
 *  courtesy tooltip — the 148 self-row disabled-affordance (a disabled model cannot be
 *  the org default; the Plan-06 lock-path 409 is the authoritative wall, this only spares
 *  the operator a guaranteed refusal). */
function LockControl({
  row,
  busy,
  onLock,
}: {
  row: ModelRegistryRow
  busy: boolean
  onLock: (next: boolean) => void
}) {
  const gated = !row.enabled && !row.is_locked
  const label = row.is_locked ? `Unlock ${row.model_id}` : `Lock ${row.model_id} as org default`

  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={gated || busy}
      title={
        gated
          ? "Enable this model before locking it as the org default"
          : row.is_locked
            ? "Locked as the org default — click to unlock"
            : "Lock as the org default (disallow user override)"
      }
      onClick={() => {
        if (gated || busy) return
        onLock(!row.is_locked)
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11px] transition-colors",
        gated
          ? "cursor-not-allowed border-transparent text-muted-foreground/40"
          : row.is_locked
            ? "border-warning/40 bg-warning/15 text-warning"
            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {row.is_locked ? (
        <>
          <Lock className="h-3 w-3" aria-hidden="true" />
          locked
        </>
      ) : (
        <>
          <Unlock className="h-3 w-3" aria-hidden="true" />
          lock
        </>
      )}
    </button>
  )
}

/** A small accessible toggle (role="switch") reused for native_tools / enabled /
 *  deprecated. ON tone varies (primary / success / warning); OFF is calm/muted. */
function RowToggle({
  on,
  busy,
  label,
  tone,
  size = "md",
  gated = false,
  gatedTitle,
  onToggle,
}: {
  on: boolean
  busy: boolean
  label: string
  tone: "primary" | "success" | "warning"
  size?: "sm" | "md"
  /** WR-05 honest lock: when true the switch is inert BY DECLARATION — aria-disabled +
   *  click guard + courtesy tooltip (the LockControl gated pattern, NOT `disabled`, so
   *  the tooltip still shows). Used where a write would be silently inert (e.g.
   *  native_tools on a native-SDK-served provider). */
  gated?: boolean
  gatedTitle?: string
  onToggle: () => void
}) {
  const dims = size === "sm" ? "h-4 w-7" : "h-5 w-9"
  const knob = size === "sm" ? "h-3 w-3" : "h-4 w-4"
  const shift = size === "sm" ? "translate-x-[13px]" : "translate-x-[18px]"
  const onBg =
    tone === "success" ? "bg-success/70" : tone === "warning" ? "bg-warning/70" : "bg-primary/70"
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      aria-disabled={gated || busy}
      title={gated ? gatedTitle : undefined}
      onClick={() => {
        if (gated) return
        onToggle()
      }}
      className={cn(
        "relative inline-flex flex-none items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        dims,
        on ? onBg : "bg-muted",
        gated && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block transform rounded-full bg-white shadow transition-transform",
          knob,
          on ? shift : "translate-x-0.5",
        )}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// D-159-02 / D-159-03 — the "+ Add model by ID" vertical (the 070-A idiom).
//
// Generalizes the SEED-088 GPT-5.6 hand-add into a first-class UI path: type an id,
// pick the provider (the 8-cloud roster), set the 3 capability knobs pre-filled from
// the per-family default table (source-honest labels), submit → a DB-only override row
// that lands DISABLED (SC#3 — the server forces `enabled=false`; there is deliberately
// no `enabled` field on `AddModelBody`). Graded-guard 066: add-by-ID is reversible + has
// no victim → direct submit + ✎ receipt (no arm-to-confirm). A 409/422 refusal renders
// in-form; never a silent failure.
// ─────────────────────────────────────────────────────────────────────────────

/** The 8-cloud provider roster the operator picks from — the native-7 + OpenRouter,
 *  matching the backend add-by-ID allowlist + the setup wizard's OTHER_PROVIDER_ROWS
 *  order (openrouter last). A native `<option>` can only hold text, so the SELECTED
 *  provider's `@lobehub` mark renders beside the select (the icon convention realized
 *  for a native picker — an SVG can't live inside an `<option>`). */
const ADD_PROVIDER_ROSTER = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "moonshot",
  "zhipu",
  "minimax",
  "openrouter",
] as const

/** The three honest capability sources (D-159-03). */
type CapSource = "default" | "operator" | "blank"

/** The three-way source badge — extends the 2-state `SourceTag` (OVR/DEF) to a third
 *  operator-typed state: amber "default — confirm" (the untouched family suggestion the
 *  operator must review), primary "you set it" (the operator edited it), or nothing at all
 *  when `familyDefaults` returned null (a blank input the operator fills). */
function CapSourceTag({ source }: { source: CapSource }) {
  if (source === "blank") return null
  return (
    <span
      className={cn(
        "rounded px-1 py-px font-mono text-[9px] tracking-wide",
        source === "operator" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
      )}
    >
      {source === "operator" ? "you set it" : "default — confirm"}
    </span>
  )
}

/** One labeled capability control + its source badge (a small column). */
function CapField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  )
}

/** The header affordance: a button that reveals the inline add-by-ID form, plus the
 *  post-add ✎ receipt (shown in the header for 3500ms after the form clears + collapses,
 *  so the confirmation survives the collapse). */
function AddModelSection({ onAddModel }: { onAddModel: (body: AddModelBody) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [receipt, setReceipt] = useState(false)

  function handleAdded() {
    setOpen(false)
    setReceipt(true)
    window.setTimeout(() => setReceipt(false), 3500)
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border/70 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/40"
      >
        <Plus className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">Add model by ID</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          type an id, pick a provider, set its capabilities
        </span>
        <span className="flex-1" />
        {receipt && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning" role="status">
            <Check className="h-3 w-3 text-success" aria-hidden="true" />✎ recorded
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-none text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <AddModelForm onAddModel={onAddModel} onCancel={() => setOpen(false)} onAdded={handleAdded} />
      )}
    </div>
  )
}

/** The inline add-by-ID form. Capabilities pre-fill from `familyDefaults(model_id || provider)`
 *  and are rendered with three source-honest labels (D-159-03). The write chokepoint mirrors
 *  `ModelRow.write`: busy → `onAddModel` → ✎ receipt + collapse, or the server refusal in-form.
 *  The body is built by CONDITIONAL INCLUSION (mirrors `ModelDiscoveryPanel.coerce`): a numeric
 *  cap is sent only when a finite value is present; `native_tools` is sent ONLY when the tri-state
 *  select is `native` (true) or `none` (false) and is OMITTED on `unknown` (never a bare false —
 *  an unmatched-family model then lands NULL and the server serves the inferred default, SC#3).
 *  `enabled` is NEVER in the body (`AddModelBody` has no such field). */
function AddModelForm({
  onAddModel,
  onCancel,
  onAdded,
}: {
  onAddModel: (body: AddModelBody) => Promise<void>
  onCancel: () => void
  onAdded: () => void
}) {
  const [modelId, setModelId] = useState("")
  const [provider, setProvider] = useState<string>("openai")
  // Per-field drafts + touched flags. Touched ⇒ the operator's value wins over the family
  // pre-fill AND the source badge flips to "you set it".
  const [ctxDraft, setCtxDraft] = useState("")
  const [outDraft, setOutDraft] = useState("")
  const [toolsDraft, setToolsDraft] = useState<"unknown" | "native" | "none">("unknown")
  const [touched, setTouched] = useState({ ctx: false, out: false, tools: false })
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  // The reviewed family pre-fill — recomputed each render (pure; the id wins over the provider,
  // so typing "kimi-k3" resolves the Kimi family regardless of the selected provider).
  const defaults = familyDefaults(modelId.trim() || provider)

  // Effective per-field value + source (touched ⇒ operator; else the family default; else blank).
  const ctxSource: CapSource = touched.ctx ? "operator" : defaults.context !== null ? "default" : "blank"
  const ctxValue = touched.ctx ? ctxDraft : defaults.context !== null ? String(defaults.context) : ""
  const outSource: CapSource = touched.out ? "operator" : defaults.maxOutput !== null ? "default" : "blank"
  const outValue = touched.out ? outDraft : defaults.maxOutput !== null ? String(defaults.maxOutput) : ""
  const toolsSource: CapSource = touched.tools ? "operator" : defaults.tools !== null ? "default" : "blank"
  const toolsValue: "unknown" | "native" | "none" = touched.tools
    ? toolsDraft
    : defaults.tools === true
      ? "native"
      : defaults.tools === false
        ? "none"
        : "unknown"

  const ProviderMark = providerLogo(provider)

  /** A controlled numeric string → a finite number, or undefined (omit the field). */
  function numOrUndef(s: string): number | undefined {
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : undefined
  }

  async function submit() {
    if (busy) return
    const id = modelId.trim()
    if (!id) {
      setErrorDetail("Enter a model id.")
      return
    }
    setBusy(true)
    setErrorDetail(null)
    // Build by conditional inclusion — start from {model_id, provider}; NEVER add `enabled`.
    const body: AddModelBody = { model_id: id, provider }
    const ctx = numOrUndef(ctxValue)
    if (ctx !== undefined) body.context_window_tokens = ctx
    const out = numOrUndef(outValue)
    if (out !== undefined) body.max_output_tokens = out
    if (toolsValue === "native") body.native_tools = true
    else if (toolsValue === "none") body.native_tools = false
    // OMIT native_tools entirely on "unknown" (never a bare false).
    const trimmedNote = note.trim()
    if (trimmedNote) {
      body.deprecated = true
      body.deprecated_reason = trimmedNote
    }
    try {
      await onAddModel(body)
      onAdded()
    } catch (err) {
      setErrorDetail(err instanceof ApiError ? err.message : "Couldn’t add that model — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      aria-label="Add model by ID"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="space-y-4 border-t border-border/60 px-4 py-4"
    >
      {/* id + provider (the selected provider's @lobehub mark sits beside the native select). */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Model ID</span>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="e.g. kimi-k3"
            aria-label="Model ID"
            className="w-64 rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">Provider</span>
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground">
              {ProviderMark ? <ProviderMark size={14} /> : provider.slice(0, 2).toUpperCase()}
            </span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              aria-label="Provider"
              className="rounded-[6px] border border-border bg-background px-2 py-1 text-sm text-foreground"
            >
              {ADD_PROVIDER_ROSTER.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {/* the 3 capability knobs, each with its three-way source label. */}
      <div className="flex flex-wrap gap-5">
        <CapField label="Context">
          <input
            type="number"
            value={ctxValue}
            placeholder="set…"
            aria-label="Context window tokens"
            onChange={(e) => {
              setTouched((t) => ({ ...t, ctx: true }))
              setCtxDraft(e.target.value)
            }}
            className="w-28 rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/50"
          />
          <CapSourceTag source={ctxSource} />
        </CapField>
        <CapField label="Max output">
          <input
            type="number"
            value={outValue}
            placeholder="set…"
            aria-label="Max output tokens"
            onChange={(e) => {
              setTouched((t) => ({ ...t, out: true }))
              setOutDraft(e.target.value)
            }}
            className="w-28 rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/50"
          />
          <CapSourceTag source={outSource} />
        </CapField>
        <CapField label="Native tools">
          <select
            value={toolsValue}
            aria-label="Native tools"
            onChange={(e) => {
              setTouched((t) => ({ ...t, tools: true }))
              setToolsDraft(e.target.value as "unknown" | "native" | "none")
            }}
            className="rounded-[6px] border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
          >
            <option value="unknown">unknown</option>
            <option value="native">native ✓</option>
            <option value="none">none</option>
          </select>
          <CapSourceTag source={toolsSource} />
        </CapField>
      </div>

      {/* optional deprecation note (a non-empty note marks the added model deprecated). */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Deprecation note (optional — marks it deprecated)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="reason (optional)"
          aria-label="Deprecation note"
          className="w-80 rounded-[6px] border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/50"
        />
      </label>

      {/* the lands-disabled copy (D-159-02 — the opt-in-enable rule made visible). */}
      <p className="text-[11px] text-muted-foreground">
        Added <span className="font-medium text-foreground">disabled</span> — enable it from the table.
      </p>

      {/* actions + the in-form refusal (never a silent failure). */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Add model
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        {errorDetail && (
          <span className="text-[11px] font-medium text-destructive" role="alert">
            {errorDetail}
          </span>
        )}
      </div>
    </form>
  )
}
