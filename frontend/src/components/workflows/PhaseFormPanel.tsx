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
 * Phase 103-ux helper line: every field ALSO renders a muted, always-visible
 * one-line plain-English helper sentence directly under its label (the optional
 * `help` prop on the shared field components → FieldLabel renders it). The hover-only
 * ⓘ (which maps to the exact technical term like `prompt`/`folder_scope`) stays for
 * power users, but the plain helper needs NO hover/click — a non-technical user knows
 * what each parameter means at a glance.
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
 *
 * Phase 184-09 (CANVAS-04 / R11, sketch 140-A): the panel is now ALSO the canvas's step
 * inspector — a third way IN to this one form, never a second form. Governance arrives as
 * three RAILS on the optional `rails` prop: locked order, a tool whitelist sourced live
 * from `GET /workflows/grounding-bundle`, and the checks that cannot be detached. The prop
 * is optional for a load-bearing reason: this component is rendered ONCE, by the page, and
 * serves BOTH the shipped Spine view and the flagged Canvas view, so `rails` ABSENT must
 * render today's panel byte-for-byte or a flag-off user's surface drifts (D-14 /
 * D-181-01). Every rail branch in this file is therefore gated on `rails` being present.
 * Phase 184 does NOT invent an authored grounding field — the gates are DERIVED by the
 * caller exactly as `groundingFor()` derives grounding today; Phase 185 is what replaces
 * that derivation, and it plugs into `rails.gates` rather than into new layout.
 *
 * THE PANEL IS DISMISSED FROM ITS OWN HEADER, and `onClose` is REQUIRED so it can
 * never mount unclosable. For one shipped revision the only exit was re-activating the
 * same node — a move a user has no way to discover — so the panel could be entered and
 * not left. Making the handler required puts that state outside the type system rather
 * than outside the tests: the parent owns the selection, this header owns the ask.
 */
import { useId } from "react"
import type { PhaseSpecJSON } from "./phaseVocabulary"

/** A partial config patch the form emits on each edit. */
export type PhaseConfigPatch = Record<string, unknown>

/** A simple id→name lookup (folders / skills). Missing ids fall back to the id. */
export type IdNameMap = Record<string, string>

/**
 * One row of the gates rail (Phase 184-09 / CANVAS-04, sketch 140-A).
 *
 * A DISCRIMINATED UNION, not a `locked: boolean` flag with an optional handler beside it,
 * because the two states differ in what they OWE the user. A locked gate came WITH a choice
 * above it — remove what made it apply and it goes; there is no switch, so a `🔒` row must
 * carry no removal control at all (not a disabled one: "cannot be wired around" is a
 * structural claim, and a disabled control is still a control that a later edit can
 * re-enable). An `○` row can be detached, and a row that says so while offering nothing to
 * press is the same lie in the other direction. Modelled this way, "a locked gate with a
 * remove button" and "a removable gate with no way to remove it" are both un-representable —
 * the idiom this file's own required `onClose` established.
 *
 * `onRemove` belongs to the CALLER because a gate is a `validators` entry, and this panel's
 * only write seam (`onChange`) patches `config`. The panel renders the rail; the page owns
 * the definition.
 */
export type PhaseGateRow =
  | { label: string; locked: true }
  | { label: string; locked: false; onRemove: () => void }

/**
 * The three governance rails (CANVAS-04). Every value here is DERIVED or SERVER-SOURCED by
 * the caller; the panel computes none of it and fetches none of it.
 *
 * - `order` — informational only. `phase_index` IS the order and there is no `depends_on`,
 *   so moving is allowed and rewiring is not representable. The rail carries no control.
 * - `toolOptions` — the set the author chooses FROM, straight off
 *   `GET /workflows/grounding-bundle` (`useGroundingBundle`). The literal `"degraded"`
 *   means the palette read FAILED and the surface must say so; an empty array would be
 *   byte-indistinguishable from an author who owns no tools, which is the lie R11 exists
 *   to prevent.
 * - `gates` — derived exactly as the shipped `groundingFor()` derives grounding today
 *   (`citation_policy` plus the presence of a `citations_required` validator). Phase 185
 *   replaces that derivation with an authored per-node grounding mode and plugs into THIS
 *   array; designing the container for it now is the point, inventing the field is not.
 */
export interface PhaseFormRails {
  order: { index: number; total: number }
  toolOptions: string[] | "degraded"
  gates: PhaseGateRow[]
}

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
  /** Dismiss the panel; the parent owns the selection state. REQUIRED — not optional
   *  — so "a panel the user cannot close" is not a representable state and a dropped
   *  wiring is a typecheck error rather than a silent UX regression. */
  onClose: () => void
  /** Phase 184-09 (CANVAS-04 / R11, sketch 140-A): the governance rails — locked order,
   *  the server-sourced tool whitelist, and the gates that cannot be wired around.
   *
   *  ABSENT ⇒ THIS PANEL RENDERS EXACTLY AS IT DOES TODAY, BYTE-FOR-BYTE. That is not a
   *  nicety, it is the D-14 / D-181-01 mechanism: `PhaseFormPanel` is ONE instance serving
   *  BOTH the shipped Spine view and the flagged Canvas view, so any change to its rendered
   *  controls would change what a flag-off user sees — including an operator. Riding the
   *  rails on an optional prop makes the flag-off surface identical by construction rather
   *  than by review. `revertByteIdentical.test.tsx` never renders this component, so the
   *  guard lives in `PhaseFormPanel.rails.test.tsx` instead. */
  rails?: PhaseFormRails
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

/** A small ⓘ hint. WR-03: the guidance is exposed two honest ways — the native
 *  `title` shows a tooltip on MOUSE hover only (evergreen browsers do NOT surface
 *  `title` on keyboard focus), and the `aria-label` supplies the accessible name a
 *  screen reader announces when the tabbable span receives focus. No visual popover
 *  on keyboard focus by design (zero-dep, no popover library). */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      // Phase 155 (A11Y-01): role="button" (not "img") so the focusable ⓘ hint is a
      // valid tabIndex host (jsx-a11y/no-noninteractive-tabindex). WR-03: the native
      // `title` reveals the guidance visually on MOUSE hover only; the aria-label
      // carries the same text as the accessible name announced on focus (no
      // keyboard-focus visual tooltip is claimed).
      tabIndex={0}
      role="button"
      aria-label={text}
      title={text}
      className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      ⓘ
    </span>
  )
}

/** A friendly field label: plain text + optional grey "(qualifier)" + optional ⓘ,
 *  PLUS an ALWAYS-VISIBLE one-line plain-English helper sentence underneath (`help`).
 *  The ⓘ stays for the precise technical term; the `help` line needs no hover/click —
 *  it is the self-explanatory guidance a non-technical user reads at a glance. */
function FieldLabel({
  htmlFor,
  text,
  qualifier,
  hint,
  help,
}: {
  htmlFor?: string
  text: string
  qualifier?: string
  hint?: string
  help?: string
}) {
  return (
    <>
      <label
        htmlFor={htmlFor}
        className={`flex items-center text-[11px] font-medium text-foreground ${help ? "" : "mb-1"}`}
      >
        <span>{text}</span>
        {qualifier && <span className="ml-1 font-normal text-muted-foreground">{qualifier}</span>}
        {hint && <InfoHint text={hint} />}
      </label>
      {help && (
        <p data-testid="field-help" className="mb-1 mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {help}
        </p>
      )}
    </>
  )
}

/** A labeled text input wired to onChange(key) / onPersist on blur. */
function TextField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
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
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
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
  help?: string
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
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
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
function ReadOnlyField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  value: string
  full?: boolean
}) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
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
  help?: string
  children: React.ReactNode
  testId?: string
  full?: boolean
}) {
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
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
      help="The knowledge-base folders this step may search."
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
 *  testable via the label), and the chips are a read-friendly preview above it.
 *
 *  Phase 184-09: `options` is the CANVAS-04 whitelist rail. `undefined` — the only value a
 *  flag-off render can produce, because it is `rails?.toolOptions` — keeps the free-text
 *  comma field below byte-for-byte. Anything else replaces it with a set the author chooses
 *  FROM, and R11 forbids a free-text box in that variant: a box a user can type any string
 *  into is not a whitelist, it is a suggestion. */
function ToolsField({
  tools,
  options,
  onChange,
  onPersist,
}: {
  tools: string[]
  options?: string[] | "degraded"
  onChange: (v: string) => void
  onPersist: () => void
}) {
  const id = useId()
  if (options !== undefined) {
    return <ToolWhitelistRail tools={tools} options={options} onChange={onChange} onPersist={onPersist} />
  }
  return (
    <div className="col-span-2">
      <FieldLabel
        htmlFor={id}
        text="What this step can do"
        hint="available_tools — the tools the AI may use in this step (e.g. search_documents, execute_code)."
        help="The tools the AI may use here."
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

const TOOL_CHIP_BASE =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] focus:outline-none focus:ring-1 focus:ring-primary"

/**
 * The tool-whitelist rail (140-A) — a set the author chooses FROM, and nothing to type into.
 *
 * THE OPTION SET IS THE SERVER'S. It arrives as `rails.toolOptions`, which `useGroundingBundle`
 * fills from `GET /workflows/grounding-bundle` and from nothing else. There is no frontend
 * list of tool ids here or anywhere upstream of here — a client-assembled whitelist would let
 * knowledge-base content whitelist itself, which is the elevation of privilege the
 * server-owned registry exists to prevent. `friendlyToolName` still LABELS the chips; a
 * display-label map is not an options source and the two must not be confused.
 *
 * A TOOL THE DEFINITION NAMES THAT THE REGISTRY DOES NOT HAVE IS SHOWN, STRUCK THROUGH — never
 * dropped. The server already answers `unregistered_tool` for it, and hiding it here would put
 * the finding somewhere the author cannot act on it while quietly editing their stored value
 * out of sight. Struck through and still pressable is the fixable form.
 *
 * A DEGRADED READ SAYS SO. `"degraded"` renders a plain sentence and ZERO options, because an
 * empty-but-normal picker is byte-indistinguishable from a registry that genuinely offers
 * nothing — it would tell the user "there are no tools" when the truth is "we could not ask".
 * What the step already names is still printed, so a failed read never looks like a wipe.
 */
function ToolWhitelistRail({
  tools,
  options,
  onChange,
  onPersist,
}: {
  tools: string[]
  options: string[] | "degraded"
  onChange: (v: string) => void
  onPersist: () => void
}) {
  // The comma string is the shipped call-site contract (`v.split(",")`), so a click commits
  // through exactly the same seam a keystroke used to — one parser, not two.
  const commit = (next: string[]) => {
    onChange(next.join(", "))
    onPersist()
  }

  return (
    <div className="col-span-2">
      <FieldLabel
        text="What this step can do"
        hint="available_tools — the tools the AI may use in this step (e.g. search_documents, execute_code)."
        help="Pick from the tools this workspace allows — you cannot add one by typing."
      />
      {options === "degraded" ? (
        <div data-rail="tools" data-testid="tools-degraded">
          <p className="text-[11px] leading-snug text-muted-foreground">
            We couldn&rsquo;t load the tools this step is allowed to use. Nothing is offered here
            rather than a list that would be wrong.
          </p>
          {tools.length > 0 && (
            <p data-testid="tools-degraded-current" className="mt-1 text-[11px] leading-snug text-muted-foreground">
              This step currently names: {tools.map((t) => friendlyToolName(t)).join(", ")}.
            </p>
          )}
        </div>
      ) : (
        <ToolOptionSet tools={tools} options={options} commit={commit} />
      )}
    </div>
  )
}

/** The chip set itself — split out so the degraded branch above reads as one sentence. */
function ToolOptionSet({
  tools,
  options,
  commit,
}: {
  tools: string[]
  options: string[]
  commit: (next: string[]) => void
}) {
  const selected = new Set(tools)
  // Registry order first (the server's own ordering), then anything the definition names
  // that the registry lacks — appended rather than hidden.
  const offered = [...options, ...tools.filter((t) => !options.includes(t))]

  return (
    <div
      data-rail="tools"
      data-testid="tools-rail"
      role="group"
      aria-label="What this step can do"
      className="flex flex-wrap gap-1.5"
    >
      {offered.length === 0 ? (
        <p data-testid="tools-empty" className="text-[11px] leading-snug text-muted-foreground">
          This workspace offers no tools for this step.
        </p>
      ) : (
        offered.map((t) => {
          const on = selected.has(t)
          const unregistered = !options.includes(t)
          return (
            <button
              key={t}
              type="button"
              data-testid="tool-option"
              data-tool={t}
              data-unregistered={unregistered ? "true" : "false"}
              aria-pressed={on}
              title={unregistered ? `${t} — not in this workspace's tool registry` : t}
              onClick={() => commit(on ? tools.filter((x) => x !== t) : [...tools, t])}
              className={[
                TOOL_CHIP_BASE,
                on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground",
                unregistered ? "line-through" : "",
              ].join(" ")}
            >
              {friendlyToolName(t)}
            </button>
          )
        })
      )}
    </div>
  )
}

/**
 * The order rail (140-A) — informational, and deliberately control-free.
 *
 * `phase_index` IS the order: there is no `depends_on`, and branching is not representable
 * in the definition at all. Moving a step is allowed (on the canvas, where the steps are);
 * rewiring one is not a thing this product can express, so the rail states the rule rather
 * than offering a switch that would have to be refused.
 */
function OrderRail({ index, total }: { index: number; total: number }) {
  return (
    <section data-rail="order" data-testid="rail-order" className="mb-3 rounded border border-border bg-muted/40 px-2.5 py-2">
      <h3 className="text-[11px] font-medium text-foreground">Order is locked</h3>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        Runs as step {index} of {total} — steps run in order, one after another.
      </p>
    </section>
  )
}

/**
 * The gates rail (140-A) — 🔒 rows that cannot be detached beside `○` rows that can.
 *
 * A locked row's subtree contains NO `button`, no `[role="button"]` and no `input`. Not a
 * disabled one — none. That is what makes "governance you cannot wire around" a structural
 * property rather than a styling choice, and it is why the ⓘ `InfoHint` (which is
 * `role="button"` for a11y reasons) is deliberately not used inside a row.
 *
 * The glyph is `aria-hidden` and the meaning is carried by a real visible WORD on both
 * branches (the never-colour-alone / never-glyph-alone rule the canvas cards already
 * follow), so the distinction survives a screen-reader read and a colour-blind read alike.
 */
function GatesRail({ gates }: { gates: PhaseGateRow[] }) {
  return (
    <section data-rail="gates" data-testid="rail-gates" className="mt-3 rounded border border-border bg-muted/40 px-2.5 py-2">
      <h3 className="text-[11px] font-medium text-foreground">Checks that run on this step</h3>
      {gates.length === 0 ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          No checks apply to this step yet.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {gates.map((gate) => (
            <li
              key={gate.label}
              data-testid="gate-row"
              data-locked={gate.locked ? "true" : "false"}
              className="flex items-center gap-1.5 text-[11px] text-foreground"
            >
              <span aria-hidden="true">{gate.locked ? "🔒" : "○"}</span>
              <span className="min-w-0 flex-1 truncate">{gate.label}</span>
              {gate.locked ? (
                <span className="shrink-0 text-[10.5px] text-muted-foreground">Cannot be removed</span>
              ) : (
                <button
                  type="button"
                  onClick={gate.onRemove}
                  className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">
        A locked check came with a choice above it — change what made it apply and it goes.
        There is no switch.
      </p>
    </section>
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
  onClose,
  rails,
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
        {/* The discoverable exit — a normal flex child of the header, never an
            absolutely-positioned overlay (the panel is a grid track). The glyph is
            hidden from the a11y tree so the announcement is the label, not "✕". */}
        <button
          type="button"
          data-testid="phase-form-close"
          aria-label="Close step details"
          onClick={onClose}
          className="ml-1.5 inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-[11px] text-muted-foreground">
          Refine this step — adjust what it does, then move on.
        </p>

        {/* The rails render ONLY when the caller supplies them. Absent ⇒ today's panel. */}
        {rails && <OrderRail index={rails.order.index} total={rails.order.total} />}

        <div className="grid grid-cols-2 gap-3">
          {/* ── programmatic: fn + input_keys (a deterministic server step — no LLM fields) ── */}
          {pt === "programmatic" && (
            <>
              <TextField
                label="Function"
                hint="fn — a key into the server-side function registry. This step runs deterministic code, not an AI."
                help="The registered function this step runs."
                value={asStr(cfg.fn)}
                onChange={set("fn")}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Inputs"
                hint="input_keys — the named values this function reads (comma-separated)."
                help="Which earlier outputs feed this function."
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
                help="What you want the AI to do in this step."
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
                help="Leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Creativity"
                hint="temperature — 0 is focused and repeatable, higher is more varied."
                help="Higher = more varied wording; lower = more focused."
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
                help="What you want the AI to do in this step."
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
                help="Leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Max steps"
                hint="max_steps — how many actions the AI may take before it must stop."
                help="How many actions the AI may take before it stops."
                value={asStr(cfg.max_steps, "12")}
                onChange={set("max_steps")}
                onPersist={onPersist}
                type="number"
              />
              <ToolsField
                tools={asList(cfg.available_tools)}
                options={rails?.toolOptions}
                onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
              />
              <TextField
                label="Time limit"
                qualifier="(seconds, optional)"
                hint="wall_clock_seconds — stop this step after this many seconds, even if it isn't finished."
                help="Stop this step after this many seconds (optional)."
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
                help="What you want the AI to do in this step."
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
                help="Leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <TextField
                label="Max steps"
                hint="max_steps — how many actions each worker may take before it must stop."
                help="How many actions the AI may take before it stops."
                value={asStr(cfg.max_steps, "12")}
                onChange={set("max_steps")}
                onPersist={onPersist}
                type="number"
              />
              <ToolsField
                tools={asList(cfg.available_tools)}
                options={rails?.toolOptions}
                onChange={(v) => onChange({ available_tools: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
              />
              <TextField
                label="Parallel workers"
                hint="max_parallel_agents — how many copies run at once (one per item, up to this many)."
                help="How many copies run at once."
                value={asStr(cfg.max_parallel_agents, "5")}
                onChange={set("max_parallel_agents")}
                onPersist={onPersist}
                type="number"
              />
              <SelectField
                label="How to combine results"
                hint="merge_strategy — how each worker's output is stitched into one result."
                help="How the parallel results are merged."
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
                help="What the person is asked to review or decide here."
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
                help="The options the person picks from when this pauses."
                value={asList(cfg.options).join(", ")}
                onChange={(v) => onChange({ options: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                onPersist={onPersist}
                full
              />
              <TextField
                label="Wait timeout"
                qualifier="(seconds)"
                hint="timeout_seconds — how long to wait for the person before the step times out."
                help="How long to wait for the person before giving up."
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
                help="What you want the AI to do in this step."
                value={asStr(cfg.prompt)}
                onChange={set("prompt")}
                onPersist={onPersist}
                textarea
                full
              />
              <ReadOnlyField
                label="Output type"
                hint="emitter — how the deliverable is produced (e.g. fill a template). Read-only."
                help="How the deliverable is produced (read-only)."
                value={asStr(cfg.emitter, "render_template")}
                full
              />
              <TextField
                label="AI model"
                qualifier="(optional — uses the default if blank)"
                hint="model — pick a specific model, or leave blank to use the workspace default."
                help="Leave blank to use the workspace default."
                value={asStr(cfg.model)}
                onChange={set("model")}
                onPersist={onPersist}
              />
              <SkillField name={skillRefName} rawId={skillRefId} onChange={set("skill_ref")} onPersist={onPersist} />
              <FolderScopeField ids={folderIds} folderNames={folderNames} fallbackName={folderName} />
              <SelectField
                label="Sourcing strictness"
                hint="citation_policy — how strictly claims in the deliverable must be backed by sources."
                help="How strictly the deliverable must cite its sources."
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
                help="Re-opens the produced file to confirm it's complete (coming in Phase 106)."
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

        {rails && <GatesRail gates={rails.gates} />}
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
        help="A saved skill to load for this step (optional)."
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
