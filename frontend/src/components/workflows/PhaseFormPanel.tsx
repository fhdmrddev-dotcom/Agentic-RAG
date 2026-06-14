/**
 * Phase 103-04 Task 2 (REQ-5 / WFAUTH-01, sketch 019-D D8/D9) — PhaseFormPanel.
 *
 * The fixed-width 400px right-side form panel that REFINES one phase of a draft
 * by FORM. It is the SECOND column of the Builder's push grid (the parent owns
 * the `gridTemplateColumns` reflow) — it PUSHES the read-only spine graph, it
 * NEVER overlays it. The panel is a grid track (no absolutely-positioned overlay).
 * At rest (no node selected) it collapses to a thin 44px rail; on mobile (<768px)
 * the parent grid switches it to a bottom-sheet row (a media-query concern owned
 * by the parent; this component stays layout-neutral).
 *
 * The form is CONDITIONED on `phase.config.phase_type` and renders ONLY that
 * type's real editable fields (the 6-form map mirroring `harness.py`). The locked
 * invariants:
 *  - programmatic / llm_human_input show NO model/tools/scope (deterministic step /
 *    a human pause).
 *  - llm_emit is the ONLY type with `citation_policy` (editable) + `integrity_policy`
 *    (GREYED / read-only — declared in the schema, the emitter wiring is Phase 106).
 *  - `folder_scope` always renders the folder NAME + bound UUID, NEVER a path.
 *
 * A field edit calls `onChange(patch)`; a blur/save calls `onPersist()` (the page
 * wires it to `updateWorkflowDraft` PATCH after the first `createWorkflowDraft`).
 */
import { useId } from "react"
import type { PhaseSpecJSON } from "./PhaseSpineGraph"

/** A partial config patch the form emits on each edit. */
export type PhaseConfigPatch = Record<string, unknown>

export interface PhaseFormPanelProps {
  /** The selected phase to edit, or null at rest. */
  phase: PhaseSpecJSON | null
  /** Whether the panel is open (the form) or collapsed to the resting rail. */
  open: boolean
  /** The bound project-folder display name for `folder_scope` (name, never a path). */
  folderName?: string
  /** A field edit — the parent merges the patch into the draft definition. */
  onChange: (patch: PhaseConfigPatch) => void
  /** A blur/save — the parent persists via PATCH (after the first create). */
  onPersist: () => void
}

const CITATION_POLICIES = ["strict", "flag", "partial", "draft"] as const
const INTEGRITY_POLICIES = ["strict", "documented_limit"] as const
const MERGE_STRATEGIES = ["concat", "concat_numbered"] as const

/** A labeled text input wired to onChange(key) / onPersist on blur. */
function TextField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  onPersist: () => void
  textarea?: boolean
  type?: string
  full?: boolean
}) {
  const id = useId()
  const cls =
    "w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] text-muted-foreground">
        {props.label}
      </label>
      {props.textarea ? (
        <textarea
          id={id}
          value={props.value}
          rows={3}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onPersist}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          id={id}
          type={props.type ?? "text"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onPersist}
          className={cls}
        />
      )}
    </div>
  )
}

/** A labeled select. `disabled` greys it (read-only — integrity_policy). */
function SelectField(props: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  onPersist: () => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] text-muted-foreground">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onPersist}
        className={[
          "w-full rounded border border-border px-2 py-1.5 text-[12px] focus:border-primary focus:outline-none",
          props.disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-card text-foreground",
        ].join(" ")}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A labeled READ-ONLY input (disabled) — a bound value the user can read but not
 *  edit (e.g. the emitter registry key). Carries a real <label htmlFor> so it is
 *  reachable by accessible name. */
function ReadOnlyField(props: { label: string; value: string; full?: boolean }) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] text-muted-foreground">
        {props.label}
      </label>
      <input
        id={id}
        value={props.value}
        disabled
        readOnly
        className="w-full cursor-not-allowed rounded border border-border bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground"
      />
    </div>
  )
}

/** A read-only bound value display (folder_scope name + uuid, etc.). */
function StaticField(props: { label: string; children: React.ReactNode; testId?: string; full?: boolean }) {
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <span className="mb-1 block font-mono text-[11px] text-muted-foreground">{props.label}</span>
      <div
        data-testid={props.testId}
        className="break-words rounded border border-border bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground"
      >
        {props.children}
      </div>
    </div>
  )
}

/** Render the folder_scope as bound name + UUID (never a path). */
function FolderScopeField({ ids, folderName }: { ids: string[]; folderName?: string }) {
  return (
    <StaticField label="folder_scope" testId="folder-scope-display" full>
      <span className="flex flex-wrap items-center gap-1.5">
        <span>📁 {folderName ?? "(unbound)"}</span>
        {ids.map((id) => (
          <span key={id} className="rounded bg-card px-1.5 py-0.5 text-muted-foreground">
            {id}
          </span>
        ))}
      </span>
    </StaticField>
  )
}

function asStr(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v)
}
function asList(v: unknown): string {
  return Array.isArray(v) ? (v as unknown[]).join(", ") : ""
}

export function PhaseFormPanel({ phase, open, folderName, onChange, onPersist }: PhaseFormPanelProps) {
  // RESTING rail — the parent grid collapses this column to 44px; show a thin hint.
  if (!open || !phase) {
    return (
      <aside
        data-testid="phase-form-rail"
        aria-label="Phase form (collapsed)"
        className="flex h-full min-w-0 items-start justify-center border-l border-border bg-card pt-4"
      >
        <span className="select-none text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
          select a phase to refine its fields
        </span>
      </aside>
    )
  }

  const cfg = phase.config as Record<string, unknown>
  const pt = phase.config.phase_type
  const folderIds = Array.isArray(cfg.folder_scope) ? (cfg.folder_scope as string[]) : []

  // A small helper to wire a field key → onChange patch (parent merges).
  const set = (key: string) => (v: string | number) => onChange({ [key]: v })

  return (
    <aside
      aria-label={`Refine phase: ${phase.name ?? phase.slug}`}
      className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-card"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
          {phase.name?.trim() || phase.slug}
        </span>
        <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {pt}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-[11px] text-muted-foreground">
          refine by form · fields for <span className="font-mono">{pt}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* ── programmatic: fn + input_keys (a deterministic server step — no LLM fields) ── */}
          {pt === "programmatic" && (
            <>
              <TextField
                label="fn"
                value={asStr(cfg.fn)}
                onChange={set("fn")}
                onPersist={onPersist}
                full
              />
              <TextField
                label="input_keys (comma-separated)"
                value={asList(cfg.input_keys)}
                onChange={(v) => onChange({ input_keys: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
            </>
          )}

          {/* ── llm_single: prompt + model + temperature + folder_scope + skill_ref ── */}
          {pt === "llm_single" && (
            <>
              <TextField label="prompt" value={asStr(cfg.prompt)} onChange={set("prompt")} onPersist={onPersist} textarea full />
              <TextField label="model (optional)" value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />
              <TextField label="temperature" value={asStr(cfg.temperature)} onChange={set("temperature")} onPersist={onPersist} type="number" />
              <FolderScopeField ids={folderIds} folderName={folderName} />
              <TextField label="skill_ref (optional)" value={asStr(cfg.skill_ref)} onChange={set("skill_ref")} onPersist={onPersist} full />
            </>
          )}

          {/* ── llm_agent: + available_tools + max_steps (12) + wall_clock_seconds ── */}
          {pt === "llm_agent" && (
            <>
              <TextField label="prompt" value={asStr(cfg.prompt)} onChange={set("prompt")} onPersist={onPersist} textarea full />
              <TextField label="model (optional)" value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />
              <TextField label="max_steps" value={asStr(cfg.max_steps, "12")} onChange={set("max_steps")} onPersist={onPersist} type="number" />
              <TextField label="available_tools (comma-separated)" value={asList(cfg.available_tools)} onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })} onPersist={onPersist} full />
              <TextField label="wall_clock_seconds (optional)" value={asStr(cfg.wall_clock_seconds)} onChange={set("wall_clock_seconds")} onPersist={onPersist} type="number" />
              <FolderScopeField ids={folderIds} folderName={folderName} />
              <TextField label="skill_ref (optional)" value={asStr(cfg.skill_ref)} onChange={set("skill_ref")} onPersist={onPersist} full />
            </>
          )}

          {/* ── llm_batch_agents: + max_parallel_agents (5) + merge_strategy ── */}
          {pt === "llm_batch_agents" && (
            <>
              <TextField label="prompt" value={asStr(cfg.prompt)} onChange={set("prompt")} onPersist={onPersist} textarea full />
              <TextField label="model (optional)" value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />
              <TextField label="max_steps" value={asStr(cfg.max_steps, "12")} onChange={set("max_steps")} onPersist={onPersist} type="number" />
              <TextField label="available_tools (comma-separated)" value={asList(cfg.available_tools)} onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })} onPersist={onPersist} full />
              <TextField label="max_parallel_agents" value={asStr(cfg.max_parallel_agents, "5")} onChange={set("max_parallel_agents")} onPersist={onPersist} type="number" />
              <SelectField label="merge_strategy" value={asStr(cfg.merge_strategy, "concat")} options={MERGE_STRATEGIES} onChange={set("merge_strategy")} onPersist={onPersist} />
              <FolderScopeField ids={folderIds} folderName={folderName} />
            </>
          )}

          {/* ── llm_human_input: prompt + options + timeout_seconds (300) — a human pause ── */}
          {pt === "llm_human_input" && (
            <>
              <TextField label="prompt" value={asStr(cfg.prompt)} onChange={set("prompt")} onPersist={onPersist} textarea full />
              <TextField label="options (comma-separated)" value={asList(cfg.options)} onChange={(v) => onChange({ options: v.split(",").map((s) => s.trim()).filter(Boolean) })} onPersist={onPersist} full />
              <TextField label="timeout_seconds" value={asStr(cfg.timeout_seconds, "300")} onChange={set("timeout_seconds")} onPersist={onPersist} type="number" />
            </>
          )}

          {/* ── llm_emit: the ONLY type with citation_policy + integrity_policy (greyed) ── */}
          {pt === "llm_emit" && (
            <>
              <TextField label="prompt" value={asStr(cfg.prompt)} onChange={set("prompt")} onPersist={onPersist} textarea full />
              <ReadOnlyField label="emitter" value={asStr(cfg.emitter, "render_template")} full />
              <TextField label="model (optional)" value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />
              <TextField label="skill_ref (optional)" value={asStr(cfg.skill_ref)} onChange={set("skill_ref")} onPersist={onPersist} />
              <FolderScopeField ids={folderIds} folderName={folderName} />
              <SelectField
                label="citation_policy"
                value={asStr(cfg.citation_policy, "strict")}
                options={CITATION_POLICIES}
                onChange={set("citation_policy")}
                onPersist={onPersist}
              />
              {/* integrity_policy: GREYED / read-only (disabled) — schema-declared, Phase 106 wiring. */}
              <SelectField
                label="integrity_policy (Phase 106)"
                value={asStr(cfg.integrity_policy, "strict")}
                options={INTEGRITY_POLICIES}
                onChange={() => {}}
                onPersist={() => {}}
                disabled
              />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default PhaseFormPanel
