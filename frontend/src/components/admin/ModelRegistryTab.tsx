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
import { Check, ChevronDown, Loader2, Lock, RotateCcw, Unlock } from "lucide-react"

import { ApiError, type ModelCapabilityPatch, type ModelRegistryRow } from "@/lib/api"
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

/** Compact large token counts (400000 → "400k"); small values render verbatim. */
function fmtNum(n: number, suffix?: string): string {
  if (suffix) return `${n}${suffix}`
  if (n >= 1000 && n % 100 === 0) return `${n / 1000}k`
  return n.toLocaleString()
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
  showTechnical,
}: ModelRegistryTabProps) {
  const groups = useMemo(() => (rows ? groupByProvider(rows) : []), [rows])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  return (
    <section aria-label="Model registry" className="space-y-2.5">
      {groups.map(([provider, providerRows]) => {
        const isCollapsed = collapsed.has(provider)
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
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <Th>
                        Model {showTechnical && <TechName>model_id</TechName>}
                      </Th>
                      {NUM_FIELDS.map((f) => (
                        <Th key={f.key}>
                          {f.label} {showTechnical && <TechName>{f.tech}</TechName>}
                        </Th>
                      ))}
                      <Th>
                        Tools {showTechnical && <TechName>native_tools</TechName>}
                      </Th>
                      <Th>
                        Enabled {showTechnical && <TechName>enabled</TechName>}
                      </Th>
                      <Th>Users see</Th>
                      <Th aria-label="Row actions" />
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
  )
}

function Th({ children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className="border-t border-border/40 px-3 py-2 text-left font-medium first:pl-4"
      {...rest}
    >
      {children}
    </th>
  )
}

function TechName({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[9px] text-muted-foreground">{children}</span>
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-foreground">{id}</span>
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
          <RowToggle
            on={row.native_tools}
            busy={busy}
            label={`Native tools for ${id}`}
            tone="primary"
            gated={row.provider === "anthropic" || row.provider === "google"}
            gatedTitle="Always native on this provider — Anthropic/Google models run their native SDK paths, which don't consult this toggle."
            onToggle={() => void write({ native_tools: !row.native_tools })}
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
          <td colSpan={NUM_FIELDS.length + 5} className="border-t-0 px-4 pb-2">
            <span className="text-[11px] font-medium text-destructive" role="alert">
              {errorDetail}
            </span>
          </td>
        </tr>
      )}

      {showTechnical && (
        <tr>
          <td colSpan={NUM_FIELDS.length + 5} className="border-t-0 px-4 pb-1 pt-0">
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
        className="w-24 rounded-[5px] border border-primary bg-background px-1.5 py-1 font-mono text-xs text-foreground"
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        aria-label={`Edit ${field.label} for ${modelId}`}
        onClick={onStartEdit}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[5px] border border-transparent px-1.5 py-0.5 text-left transition-colors hover:border-border hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
          !overridden && "italic text-muted-foreground",
        )}
      >
        <span className="font-mono text-xs">
          {value === null ? "—" : fmtNum(value, field.suffix)}
        </span>
        <SourceTag overridden={overridden} />
      </button>
      {overridden && (
        <button
          type="button"
          disabled={busy}
          aria-label={`Reset ${field.label} for ${modelId}`}
          title="Reset to the built-in default"
          onClick={onReset}
          className="inline-flex items-center gap-0.5 rounded-[5px] border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  )
}

/** OVR (your stored edit, primary) vs DEF (inherited from the built-in registry, dim). */
function SourceTag({ overridden }: { overridden: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1 py-px font-mono text-[9px] tracking-wide",
        overridden ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {overridden ? "OVR" : "DEF"}
    </span>
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
