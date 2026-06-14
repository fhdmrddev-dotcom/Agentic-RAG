/**
 * Phase 103-04 Task 2 (REQ-5 / WFAUTH-01, sketch 019-D D8/D9) — PhaseFormPanel.
 *
 * Phase 103-ux: the form is now PLAIN-LANGUAGE for a non-technical business user.
 * Every raw schema field name (prompt / available_tools / folder_scope / …) is
 * shown as a friendly label; the technical term stays reachable behind a small ⓘ
 * hint (a hover/focus tooltip — no heavy popover library). The per-phase-type
 * field CONDITIONING is unchanged (same fields per type); only the surface wording
 * + a few renderers (tool chips, folder/skill NAMES) changed.
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
 *  - `folder_scope` always renders the folder NAME(s) + bound UUID, NEVER a path.
 *
 * A field edit calls `onChange(patch)`; a blur/save calls `onPersist()` (the page
 * wires it to `updateWorkflowDraft` PATCH after the first `createWorkflowDraft`).
 */
import { useId } from "react"
import type { PhaseSpecJSON } from "./PhaseSpineGraph"

/** A partial config patch the form emits on each edit. */
export type PhaseConfigPatch = Record<string, unknown>

/** A simple id→name lookup (folders / skills). Missing ids fall back to the id. */
export type IdNameMap = Record<string, string>

export interface PhaseFormPanelProps {
  /** The selected phase to edit, or null at rest. */
  phase: PhaseSpecJSON | null
  /** Whether the panel is open (the form) or collapsed to the resting rail. */
  open: boolean
  /** The bound project-folder display name for `folder_scope` (name, never a path).
   *  Kept for backward-compat; `folderNames` (the id→name map) is preferred. */
  folderName?: string
  /** Phase 103-ux: id→name map so every folder_scope id renders as its real NAME
   *  (📁 Name) with the bound id reachable via the ⓘ hint. */
  folderNames?: IdNameMap
  /** Phase 103-ux: id→name map so a skill_ref id renders as its real skill NAME. */
  skillNames?: IdNameMap
  /** A field edit — the parent merges the patch into the draft definition. */
  onChange: (patch: PhaseConfigPatch) => void
  /** A blur/save — the parent persists via PATCH (after the first create). */
  onPersist: () => void
}

const CITATION_POLICIES = ["strict", "flag", "partial", "draft"] as const
const INTEGRITY_POLICIES = ["strict", "documented_limit"] as const
const MERGE_STRATEGIES = ["concat", "concat_numbered"] as const

/** Plain-language captions for citation_policy (sourcing strictness). */
const CITATION_CAPTIONS: Record<string, string> = {
  strict: "Every claim must be cited — the deliverable fails if anything is uncited.",
  flag: "Delivers, but marks any uncited claims so a reviewer can spot them.",
  partial: "Blanks out uncited values (leaves them empty rather than inventing them).",
  draft: "No enforcement — labels the whole thing a draft.",
}

/** Plain-language labels for each phase type (the small header chip). */
const PHASE_TYPE_FRIENDLY: Record<string, string> = {
  programmatic: "Server step",
  llm_single: "AI write step",
  llm_agent: "AI agent step",
  llm_batch_agents: "Parallel agents",
  llm_human_input: "Needs a person",
  llm_emit: "Deliverable",
}

/** A small ⓘ hint — reveals the technical term / guidance on hover or focus.
 *  Uses a native `title` (zero-dep, accessible) PLUS a tabbable span so keyboard
 *  users reach it too. No popover library. */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      role="img"
      aria-label={text}
      title={text}
      className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      ⓘ
    </span>
  )
}

/** A friendly field label: plain text + optional grey "(qualifier)" + optional ⓘ. */
function FieldLabel({
  htmlFor,
  text,
  qualifier,
  hint,
}: {
  htmlFor?: string
  text: string
  qualifier?: string
  hint?: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 flex items-center text-[11px] font-medium text-foreground">
      <span>{text}</span>
      {qualifier && <span className="ml-1 font-normal text-muted-foreground">{qualifier}</span>}
      {hint && <InfoHint text={hint} />}
    </label>
  )
}

/** A labeled text input wired to onChange(key) / onPersist on blur. */
function TextField(props: {
  label: string
  qualifier?: string
  hint?: string
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
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} />
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
  qualifier?: string
  hint?: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  onPersist: () => void
  disabled?: boolean
  full?: boolean
  caption?: string
}) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} />
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
      {props.caption && <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{props.caption}</p>}
    </div>
  )
}

/** A labeled READ-ONLY input (disabled) — a bound value the user can read but not
 *  edit (e.g. the emitter registry key). Carries a real <label htmlFor> so it is
 *  reachable by accessible name. */
function ReadOnlyField(props: { label: string; qualifier?: string; hint?: string; value: string; full?: boolean }) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} />
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

/** A read-only bound value display (folder_scope names, skill name, etc.). */
function StaticField(props: {
  label: string
  qualifier?: string
  hint?: string
  children: React.ReactNode
  testId?: string
  full?: boolean
}) {
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel text={props.label} qualifier={props.qualifier} hint={props.hint} />
      <div
        data-testid={props.testId}
        className="break-words rounded border border-border bg-muted px-2 py-1.5 text-[11px] text-foreground"
      >
        {props.children}
      </div>
    </div>
  )
}

/** Render the folder_scope as real folder NAME(s) (📁 Name), with the bound id
 *  reachable via the per-chip ⓘ/title — never a path. `folder_scope` can hold
 *  MULTIPLE ids; each renders as its own name chip. */
function FolderScopeField({
  ids,
  folderNames,
  fallbackName,
}: {
  ids: string[]
  folderNames?: IdNameMap
  fallbackName?: string
}) {
  return (
    <StaticField
      label="Folders it can read"
      hint="folder_scope — the knowledge-base folders this step is allowed to search."
      testId="folder-scope-display"
      full
    >
      {ids.length === 0 ? (
        <span className="text-muted-foreground">📁 {fallbackName ?? "(none)"}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-1.5">
          {ids.map((id) => {
            const name = folderNames?.[id] ?? fallbackName
            return (
              <span
                key={id}
                title={id}
                className="inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5 text-foreground"
              >
                📁 {name ?? id}
                <span className="ml-0.5 font-mono text-[8px] text-muted-foreground" title={id}>
                  ⓘ
                </span>
              </span>
            )
          })}
        </span>
      )}
    </StaticField>
  )
}

/** Render available_tools as friendly chips (the raw tool ids reachable via ⓘ).
 *  Editing stays a comma field below the chips (so the field is still editable +
 *  testable via the label), and the chips are a read-friendly preview above it. */
function ToolsField({
  tools,
  onChange,
  onPersist,
}: {
  tools: string[]
  onChange: (v: string) => void
  onPersist: () => void
}) {
  const id = useId()
  return (
    <div className="col-span-2">
      <FieldLabel
        htmlFor={id}
        text="What this step can do"
        hint="available_tools — the tools the AI may use in this step (e.g. search_documents, execute_code)."
      />
      {tools.length > 0 && (
        <div data-testid="tools-chips" className="mb-1.5 flex flex-wrap gap-1.5">
          {tools.map((t) => (
            <span
              key={t}
              title={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] text-foreground"
            >
              {friendlyToolName(t)}
              <span className="font-mono text-[8px] text-muted-foreground" title={t}>
                ⓘ
              </span>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={tools.join(", ")}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        placeholder="search_documents, execute_code"
        className="w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  )
}

/** Map a raw tool id to a friendlier reading (best-effort; falls back to the id). */
function friendlyToolName(id: string): string {
  const map: Record<string, string> = {
    search_documents: "Search documents",
    read_document: "Read a document",
    execute_code: "Run code",
    fetch_url: "Fetch a web page",
    list_folders: "List folders",
  }
  return map[id] ?? id
}

function asStr(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v)
}
function asList(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : []
}

export function PhaseFormPanel({
  phase,
  open,
  folderName,
  folderNames,
  skillNames,
  onChange,
  onPersist,
}: PhaseFormPanelProps) {
  // RESTING rail — the parent grid collapses this column to 44px; show a thin hint.
  if (!open || !phase) {
    return (
      <aside
        data-testid="phase-form-rail"
        aria-label="Phase form (collapsed)"
        className="flex h-full min-w-0 items-start justify-center border-l border-border bg-card pt-4"
      >
        <span className="select-none text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
          select a step to refine it
        </span>
      </aside>
    )
  }

  const cfg = phase.config as Record<string, unknown>
  const pt = phase.config.phase_type
  const folderIds = Array.isArray(cfg.folder_scope) ? (cfg.folder_scope as string[]) : []
  const friendlyType = PHASE_TYPE_FRIENDLY[pt] ?? pt

  // A small helper to wire a field key → onChange patch (parent merges).
  const set = (key: string) => (v: string | number) => onChange({ [key]: v })

  // Resolve a skill_ref id → its real NAME for read-friendly display.
  const skillRefId = asStr(cfg.skill_ref)
  const skillRefName = skillRefId ? (skillNames?.[skillRefId] ?? skillRefId) : ""

  return (
    <aside
      aria-label={`Refine step: ${phase.name ?? phase.slug}`}
      className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border bg-card"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
          {phase.name?.trim() || phase.slug}
        </span>
        <span
          title={pt}
          className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {friendlyType}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-[11px] text-muted-foreground">
          Refine this step — adjust what it does, then move on.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* ── programmatic: fn + input_keys (a deterministic server step — no LLM fields) ── */}
          {pt === "programmatic" && (
            <>
              <TextField
                label="Function"
                hint="fn — a key into the server-side function registry. This step runs deterministic code, not an AI."
                value={asStr(cfg.fn)}
                onChange={set("fn")}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Inputs"
                hint="input_keys — the named values this function reads (comma-separated)."
                qualifier="(comma-separated)"
                value={asList(cfg.input_keys).join(", ")}
                onChange={(v) => onChange({ input_keys: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
            </>
          )}

          {/* ── llm_single: prompt + model + temperature + folder_scope + skill_ref ── */}
          {pt === "llm_single" && (
            <>
              <TextField
                label="Instructions"
                hint="prompt — what you're telling the AI to do in this step."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <TextField
                label="AI model"
                qualifier="(optional — uses the default if blank)"
                hint="model — pick a specific model, or leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Creativity"
                hint="temperature — 0 is focused and repeatable, higher is more varied."
                value={asStr(cfg.temperature)}
                onChange={set("temperature")}
                onPersist={onPersist}
                type="number"
              />
              <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
              <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
            </>
          )}

          {/* ── llm_agent: + available_tools + max_steps (12) + wall_clock_seconds ── */}
          {pt === "llm_agent" && (
            <>
              <TextField
                label="Instructions"
                hint="prompt — what you're telling the AI to do in this step."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <TextField
                label="AI model"
                qualifier="(optional — uses the default if blank)"
                hint="model — pick a specific model, or leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Max steps"
                hint="max_steps — how many actions the AI may take before it must stop."
                value={asStr(cfg.max_steps, "12")}
                onChange={set("max_steps")}
                onPersist={onPersist}
                type="number"
              />
              <ToolsField
                tools={asList(cfg.available_tools)}
                onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
              />
              <TextField
                label="Time limit"
                qualifier="(seconds, optional)"
                hint="wall_clock_seconds — stop this step after this many seconds, even if it isn't finished."
                value={asStr(cfg.wall_clock_seconds)}
                onChange={set("wall_clock_seconds")}
                onPersist={onPersist}
                type="number"
              />
              <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
              <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
            </>
          )}

          {/* ── llm_batch_agents: + max_parallel_agents (5) + merge_strategy ── */}
          {pt === "llm_batch_agents" && (
            <>
              <TextField
                label="Instructions"
                hint="prompt — what you're telling the AI to do for each item it works on."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <TextField
                label="AI model"
                qualifier="(optional — uses the default if blank)"
                hint="model — pick a specific model, or leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Max steps"
                hint="max_steps — how many actions each worker may take before it must stop."
                value={asStr(cfg.max_steps, "12")}
                onChange={set("max_steps")}
                onPersist={onPersist}
                type="number"
              />
              <ToolsField
                tools={asList(cfg.available_tools)}
                onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
              />
              <TextField
                label="Parallel workers"
                hint="max_parallel_agents — how many copies run at once (one per item, up to this many)."
                value={asStr(cfg.max_parallel_agents, "5")}
                onChange={set("max_parallel_agents")}
                onPersist={onPersist}
                type="number"
              />
              <SelectField
                label="How to combine results"
                hint="merge_strategy — how each worker's output is stitched into one result."
                value={asStr(cfg.merge_strategy, "concat")}
                options={MERGE_STRATEGIES}
                onChange={set("merge_strategy")}
                onPersist={onPersist}
              />
              <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
            </>
          )}

          {/* ── llm_human_input: prompt + options + timeout_seconds (300) — a human pause ── */}
          {pt === "llm_human_input" && (
            <>
              <TextField
                label="Instructions"
                hint="prompt — what the person is asked to review or decide at this pause."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <TextField
                label="Choices to offer the person"
                qualifier="(comma-separated)"
                hint="options — the buttons the person picks from (comma-separated)."
                value={asList(cfg.options).join(", ")}
                onChange={(v) => onChange({ options: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Wait timeout"
                qualifier="(seconds)"
                hint="timeout_seconds — how long to wait for the person before the step times out."
                value={asStr(cfg.timeout_seconds, "300")}
                onChange={set("timeout_seconds")}
                onPersist={onPersist}
                type="number"
              />
            </>
          )}

          {/* ── llm_emit: the ONLY type with citation_policy + integrity_policy (greyed) ── */}
          {pt === "llm_emit" && (
            <>
              <TextField
                label="Instructions"
                hint="prompt — what the AI should produce for the deliverable."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <ReadOnlyField
                label="Output type"
                hint="emitter — how the deliverable is produced (e.g. fill a template). Read-only."
                value={asStr(cfg.emitter, "render_template")}
                full
              />
              <TextField
                label="AI model"
                qualifier="(optional — uses the default if blank)"
                hint="model — pick a specific model, or leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
              <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
              <SelectField
                label="Sourcing strictness"
                hint="citation_policy — how strictly claims in the deliverable must be backed by sources."
                value={asStr(cfg.citation_policy, "strict")}
                options={CITATION_POLICIES}
                onChange={set("citation_policy")}
                onPersist={onPersist}
                full
                caption={CITATION_CAPTIONS[asStr(cfg.citation_policy, "strict")]}
              />
              {/* integrity_policy: GREYED / read-only (disabled) — schema-declared, Phase 106 wiring. */}
              <SelectField
                label="File check"
                qualifier="(coming in Phase 106)"
                hint="integrity_policy — re-opens the produced file to confirm it's complete. Not wired yet."
                value={asStr(cfg.integrity_policy, "strict")}
                options={INTEGRITY_POLICIES}
                onChange={() => {}}
                onPersist={() => {}}
                disabled
                full
              />
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

/** The "Skill" field — shows the real skill NAME (id reachable via ⓘ), editable by id. */
function SkillField({
  name,
  rawId,
  onChange,
  onPersist,
}: {
  name: string
  rawId: string
  onChange: (v: string) => void
  onPersist: () => void
}) {
  const id = useId()
  return (
    <div className="col-span-2">
      <FieldLabel
        htmlFor={id}
        text="Skill"
        qualifier="(optional)"
        hint="skill_ref — a saved skill this step loads. Leave blank for none."
      />
      {name && (
        <div className="mb-1.5 flex items-center gap-1 text-[11px] text-foreground" data-testid="skill-name">
          <span title={rawId}>✦ {name}</span>
        </div>
      )}
      <input
        id={id}
        type="text"
        value={rawId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        placeholder="(none)"
        className="w-full rounded border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
      />
    </div>
  )
}

export default PhaseFormPanel
