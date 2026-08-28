/**
 * Phase 214-07 Task 2 (STEP-01 / D-214-01 / D-214-02 / D-214-03 / D-214-06 / D-214-22) —
 * ONE argument: what it is, what fills it, and where that comes from.
 *
 * ── FIVE PROPERTIES COPIED FROM `ExternalActionSection.tsx`, DELIBERATELY ──────────────
 *  1. It authors NO sentence of its own — every user-visible string is an identifier
 *     imported from `argumentVocabulary.ts`. A sentence living inside a component is a
 *     sentence nobody can test for drift.
 *  2. It consults no server: no `fetch`, no `@/lib/api`, no route string.
 *  3. Its class constants are at module scope, never inline at a use site.
 *  4. ⚠ NO RUNTIME `export const` BESIDE THE COMPONENT. That is a measured
 *     `react-refresh/only-export-components` ERROR on this directory, not a style note —
 *     only the component and its TYPES are exported.
 *  5. A LEAF: it reads no context, holds no store reference and fetches nothing. Every
 *     answer arrives as a prop and every change leaves as a callback.
 *
 * ── ⭐ D-214-22 / INVARIANT #5 · THE GUTTER IS A COLUMN THAT WIDENS ────────────────────
 * The row is a TWO-COLUMN grid, always. Column 1 is the source gutter and column 2 is the
 * argument itself. The gutter's WIDTH changes; the number of columns never does, and the
 * body cell is the SECOND CHILD in every row of every state.
 *
 * ⛔ NEVER INSERT A LANE. An inserted column shifts the label column, so a sourced row would
 * stop lining up with an unsourced one directly above it and the form would read as two
 * layouts. The template string is computed ONCE per section and handed to every row
 * identically, which is what makes the offsets equal by construction rather than by care.
 *
 * ── ⚠ THE SLUG NEVER REACHES THE DOM (D-214-02 / INVARIANT #6) ─────────────────────────
 * The upstream binding STORES a bare phase slug and RENDERS the author's own name for that
 * step. The `<select>`'s option values are POSITIONAL INDICES, never slugs, and the reading
 * beside it is built from the title. A slug that resolves to no known upstream step renders
 * as *nothing supplies this yet* — which is true, and is what the publish gate calls
 * `upstream_unreachable` — rather than leaking the raw value into a sentence.
 *
 * ⛔ NO EXPRESSION LANGUAGE. No `{{ }}`, no dotted path, no output-key sub-picker. A step's
 * whole output is what travels, and that is the entire mechanism.
 *
 * ── ⛔ AND THERE IS NO ESCAPE HATCH IN ANY STATE ───────────────────────────────────────
 * An argument this form cannot draw is NAMED. There is no free-form box for it, no
 * hidden-behind-a-disclosure box and no name-and-value grid — not for these and not for anything.
 * That absence is swept by a source fence with a positive control, because it is the whole
 * content of SC#1.
 */
import { useId } from "react"

import {
  ARG_NO_SOURCE,
  ARG_OPTIONAL_MARK,
  ARG_PRESET_NOTE,
  ARG_READING_ASK,
  ARG_READING_FIXED,
  ARG_READING_UPSTREAM,
  ARG_REQUIRED_MARK,
  ARG_SOURCE_ASK,
  ARG_SOURCE_FIXED,
  ARG_SOURCE_GROUP_LABEL,
  ARG_SOURCE_UPSTREAM,
  ARG_ASK_KEY_HINT,
  ARG_ASK_KEY_LABEL,
  ARG_UNRENDERABLE,
  ARG_UNRENDERABLE_OPTIONAL,
  ARG_UNRENDERABLE_REQUIRED,
  ARG_UPSTREAM_EMPTY,
  ARG_UPSTREAM_NONE_OPTION,
  ARG_UPSTREAM_PICK_LABEL,
} from "@/components/workflows/argumentVocabulary"
import type {
  ArgumentRowModel,
  ArgumentSource,
  UpstreamPhase,
} from "@/components/workflows/argumentModel"

/**
 * The three arms, in the ONE order every group renders them (invariant #3). A NAMED
 * module-scope constant rather than an inline literal at the use site — the
 * `GovernanceSection.DIAL_TYPES` form — so a fourth arm cannot appear in one group alone.
 */
const SOURCE_ARMS: readonly { source: ArgumentSource; label: string }[] = [
  { source: "fixed", label: ARG_SOURCE_FIXED },
  { source: "ask", label: ARG_SOURCE_ASK },
  { source: "upstream", label: ARG_SOURCE_UPSTREAM },
]

// ── LOOKS ────────────────────────────────────────────────────────────────────────────
// ⚠ NOT ONE OF THESE SPENDS DESTRUCTIVE COLOUR (invariant #14). An argument with no source
// yet is an unfinished thought, not an error, and painting it red would say the author did
// something wrong by not having finished.

const ROW_CLASSES = "grid items-start gap-x-2 border-t border-border/50 py-1.5"

const GUTTER_CLASSES = "overflow-hidden text-[10.5px] leading-snug text-muted-foreground"

const LABEL_CLASSES = "text-[11px] font-medium text-foreground"

const MARK_CLASSES = "ml-1 text-[10px] font-normal text-muted-foreground"

const NOTE_CLASSES = "mt-1 text-[10.5px] leading-snug text-muted-foreground"

const CONTROL_CLASSES =
  "mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

const CHECKBOX_CLASSES = "mt-1 h-3.5 w-3.5 accent-primary"

const ARMS_CLASSES = "mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"

const ARM_LABEL_CLASSES = "text-[10.5px] leading-none text-muted-foreground"

export interface ArgumentRowProps {
  row: ArgumentRowModel
  /** Every step that runs BEFORE this one, in run order. Empty for the first step. */
  upstreamPhases: readonly UpstreamPhase[]
  /**
   * The SECTION's grid template — one string, computed once, handed to every row. ⚠ It is a
   * prop rather than a local derivation precisely so two rows cannot disagree: that is what
   * makes invariant #5's equal label offsets true by construction.
   */
  gridColumns: string
  onChangeSource: (key: string, source: ArgumentSource) => void
  onChangeValue: (key: string, value: unknown) => void
  onChangeAskKey: (key: string, askKey: string) => void
  onChangeUpstream: (key: string, slug: string | null) => void
}

export function ArgumentRow({
  row,
  upstreamPhases,
  gridColumns,
  onChangeSource,
  onChangeValue,
  onChangeAskKey,
  onChangeUpstream,
}: ArgumentRowProps) {
  const controlId = useId()
  const groupName = useId()
  // ⚠ A SECOND `<label htmlFor>` ON ONE CONTROL CONCATENATES INTO ITS ACCESSIBLE NAME. The
  // arm's own caption is therefore a DESCRIPTION, wired by `aria-describedby` — the same
  // reason `ConnectionPicker` wires its refusal that way rather than as a second label.
  const captionId = useId()

  // The bound upstream step, resolved to the AUTHOR'S OWN NAME. An unresolved slug resolves
  // to nothing rather than to itself — see the header.
  const boundUpstream =
    row.upstreamSlug === undefined
      ? undefined
      : upstreamPhases.find((phase) => phase.slug === row.upstreamSlug)

  const reading =
    row.source === "fixed"
      ? ARG_READING_FIXED
      : row.source === "ask"
        ? ARG_READING_ASK({ key: row.askKey ?? row.key })
        : row.source === "upstream" && boundUpstream !== undefined
          ? ARG_READING_UPSTREAM({ step: boundUpstream.title })
          : ARG_NO_SOURCE

  // ── THE UNRENDERABLE ARM (D-214-06 / D-214-07) ──────────────────────────────────────
  // ⛔ IT OFFERS NO CONTROL AT ALL, and that is the decision. The author is told WHICH
  // argument and what it means for the step; they are not handed a raw box, because a box
  // re-opens every surface the adapters' `additionalProperties: False` closes.
  if (!row.renderable) {
    return (
      <div
        data-testid="argument-row"
        data-arg-renderable="false"
        data-grid-columns={gridColumns}
        className={ROW_CLASSES}
        style={{ gridTemplateColumns: gridColumns }}
      >
        <div data-testid="argument-row-gutter" className={GUTTER_CLASSES}>
          {reading}
        </div>
        <div data-testid="argument-row-body">
          <p className={LABEL_CLASSES}>{ARG_UNRENDERABLE({ arg: row.label })}</p>
          <p data-testid="argument-row-unrenderable-note" className={NOTE_CLASSES}>
            {row.required ? ARG_UNRENDERABLE_REQUIRED : ARG_UNRENDERABLE_OPTIONAL}
          </p>
        </div>
      </div>
    )
  }

  const stringValue = typeof row.value === "string" || typeof row.value === "number" ? String(row.value) : ""

  const valueControl =
    row.kind === "boolean" ? (
      <input
        id={controlId}
        data-testid="argument-row-value"
        type="checkbox"
        className={CHECKBOX_CLASSES}
        checked={row.value === true}
        onChange={(event) => onChangeValue(row.key, event.target.checked)}
      />
    ) : row.kind === "enum" ? (
      <select
        id={controlId}
        data-testid="argument-row-value"
        className={CONTROL_CLASSES}
        value={stringValue}
        onChange={(event) => onChangeValue(row.key, event.target.value)}
      >
        {/* ⚠ NO TEXT. This component authors no sentence of its own, and the vocabulary
            declares no word for an unset enum — an empty option is an absence, not copy. */}
        <option value="" />
        {(row.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input
        id={controlId}
        data-testid="argument-row-value"
        type={row.kind === "number" ? "number" : "text"}
        className={CONTROL_CLASSES}
        value={stringValue}
        onChange={(event) =>
          onChangeValue(
            row.key,
            row.kind === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value,
          )
        }
      />
    )

  return (
    <div
      data-testid="argument-row"
      data-arg-renderable="true"
      // ⚠ A SHAPE, NEVER A WIRE ID. The property name is the author's own word for the
      // field and is what the label already says; no capability id and no slug is carried
      // here, which is the rule `ExternalActionSection` keeps one file up.
      data-arg-source={row.source ?? "none"}
      data-arg-preset={row.preset ? "true" : "false"}
      data-grid-columns={gridColumns}
      className={ROW_CLASSES}
      style={{ gridTemplateColumns: gridColumns }}
    >
      {/* COLUMN 1 — the gutter. Always present, sometimes zero-wide. */}
      <div data-testid="argument-row-gutter" className={GUTTER_CLASSES}>
        {reading}
      </div>

      {/* COLUMN 2 — the argument. ⚠ ALWAYS THE SECOND CHILD, in every state. */}
      <div data-testid="argument-row-body">
        <label htmlFor={controlId} className={LABEL_CLASSES}>
          {row.label}
          <span data-testid="argument-row-mark" className={MARK_CLASSES}>
            {row.required ? ARG_REQUIRED_MARK : ARG_OPTIONAL_MARK}
          </span>
        </label>

        {row.source === "ask" ? (
          <>
            <span id={captionId} className={ARM_LABEL_CLASSES}>
              {ARG_ASK_KEY_LABEL}
            </span>
            <input
              id={controlId}
              aria-describedby={captionId}
              data-testid="argument-row-ask-key"
              type="text"
              className={CONTROL_CLASSES}
              value={row.askKey ?? ""}
              onChange={(event) => onChangeAskKey(row.key, event.target.value)}
            />
            <p data-testid="argument-row-ask-hint" className={NOTE_CLASSES}>
              {ARG_ASK_KEY_HINT}
            </p>
          </>
        ) : row.source === "upstream" ? (
          upstreamPhases.length === 0 ? (
            <p data-testid="argument-row-upstream-empty" className={NOTE_CLASSES}>
              {ARG_UPSTREAM_EMPTY}
            </p>
          ) : (
            <>
              <span id={captionId} className={ARM_LABEL_CLASSES}>
                {ARG_UPSTREAM_PICK_LABEL}
              </span>
              <select
                id={controlId}
                aria-describedby={captionId}
                data-testid="argument-row-upstream"
                className={CONTROL_CLASSES}
                // ⚠ POSITIONAL, NOT THE SLUG. The stored value is a bare slug and the DOM
                // never sees it (invariant #6) — the option's value is its index in the
                // upstream list and the caller maps it back.
                value={
                  boundUpstream === undefined
                    ? ""
                    : String(upstreamPhases.indexOf(boundUpstream))
                }
                onChange={(event) => {
                  const index = event.target.value === "" ? -1 : Number(event.target.value)
                  onChangeUpstream(
                    row.key,
                    index >= 0 && index < upstreamPhases.length
                      ? upstreamPhases[index].slug
                      : null,
                  )
                }}
              >
                <option value="">{ARG_UPSTREAM_NONE_OPTION}</option>
                {upstreamPhases.map((phase, index) => (
                  <option key={phase.slug} value={String(index)}>
                    {/* THE AUTHOR'S OWN NAME FOR THE STEP (invariant #7). `nodeTitle` is
                        what produced it, one level up, and its two floors hold: the slug
                        never appears and a name is never fabricated. */}
                    {phase.title}
                  </option>
                ))}
              </select>
            </>
          )
        ) : (
          valueControl
        )}

        {/* D-214-03 · THE PRE-SET SAYS SO, AND STAYS CHANGEABLE (invariant #11). The control
            above is NOT disabled — an invisible rule is what `BUG-260826-01` was, and a
            locked one would be the next version of it. */}
        {row.preset && (
          <p data-testid="argument-row-preset-note" className={NOTE_CLASSES}>
            {ARG_PRESET_NOTE}
          </p>
        )}

        {/* ── THE SOURCE PICKER — EXACTLY THREE ARMS, AT MOST ONE PRESSED ─────────────
            Invariants #2 / #3 / #4. The group's accessible name is one identifier, the arm
            order is one module constant, and `checked` is derived from the stored source so
            *no source yet* leaves every arm unpressed rather than defaulting to one. */}
        <div
          role="radiogroup"
          aria-label={ARG_SOURCE_GROUP_LABEL}
          data-testid="argument-row-sources"
          className={ARMS_CLASSES}
        >
          {SOURCE_ARMS.map((arm) => (
            <span key={arm.source} className="inline-flex items-center gap-1">
              <input
                id={`${groupName}-${arm.source}`}
                type="radio"
                name={groupName}
                className="h-3 w-3 accent-primary"
                checked={row.source === arm.source}
                onChange={() => onChangeSource(row.key, arm.source)}
              />
              <label htmlFor={`${groupName}-${arm.source}`} className={ARM_LABEL_CLASSES}>
                {arm.label}
              </label>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ArgumentRow
