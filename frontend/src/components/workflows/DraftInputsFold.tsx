/**
 * Phase 291-05 (AUTH-02, D-09 / D-10 / D-12, sketch 291-draft-removed winner A) — the arrival
 * card's INPUTS FOLD, as a leaf.
 *
 * When a draft is built to an attached form's or template's fields, the server returns those
 * fields (`GenerateField[]`, in the form's own order) with what covers each one. This fold shows
 * every field as one row: its label, its type word, and where its answer comes from: a two-way
 * switch between asking the person (`source: "user"`) and looking it up in the documents
 * (`source: "kb_auto"`), or, for a field a step writes, a sentence saying so. A field the draft
 * left out and the SERVER added carries the added-by mark; an input the AI added beyond the form
 * carries the server-kept reason in place of its type word.
 *
 * ── WHY A LEAF, AND WHY TWO COMPONENTS ───────────────────────────────────────────────────
 * `DraftArrivalCard.tsx` is a FIRING hot file (G-5). Its ledger discipline is one optional prop
 * per concern and new rendering in a leaf, so the card carries one prop and one fold boolean,
 * and every row here lives in this file. The trigger and the body are separate components
 * because the card places them in two different places: the trigger FIRST in its footer strip,
 * the body below the strip.
 *
 * ── THE RULES THIS LEAF OBEYS ──────────────────────────────────────────────────────────
 *  • Presentational only: props in, callbacks out. It opens no request and holds no copy of the
 *    definition. The switch reflects the LIVE input's source the caller hands it, and a flip
 *    goes straight to `onSetSource`, which the page wires to the store and so to the autosave.
 *  • Every word is imported (`declaredInputsVocabulary`, `templateFirstVocabulary`), and the
 *    type word comes from the ONE formatter the describe door also uses.
 *  • File-derived text (labels, notes, the filename) renders as plain React text children. No
 *    raw-HTML escape hatch (T-291-40).
 *  • Native controls only: two radios in a named radiogroup, which gives arrow keys for free.
 *    The radio dot is visually hidden and the label is the hit target (24px tall).
 *  • Off-grid spacing reaches this file only through the imported fold constants. The suite's
 *    raw-source fence asserts the imports by name and the absence of every off-grid literal.
 *  • Components only, no runtime constant export: `react-refresh/only-export-components`.
 */
import { useId } from "react"

import type { GenerateField } from "@/lib/api/knowledge"
import {
  INPUTS_BODY_HEADING,
  INPUTS_FOLD_ACTION,
  INPUT_ADDED_BY_SYREL,
  INPUT_FROM_STEP,
  INPUT_SOURCE_ASK,
  INPUT_SOURCE_EXPLANATION,
  INPUT_SOURCE_LOOKUP,
  inputExtraNote,
  inputSourceGroupLabel,
  inputsFoldSummary,
} from "@/components/workflows/declaredInputsVocabulary"
import {
  FOLD_ACTION_CLASS,
  FOLD_BODY_CLASS,
  FOLD_GLYPH,
  FOLD_LINE_CLASS,
} from "@/components/workflows/surfaceClasses"
import { fieldTypeWord } from "@/components/workflows/templateFirstVocabulary"
import { cn } from "@/lib/utils"

/** One of the draft's declared inputs, as the saved definition holds it. Loose on purpose: the
 *  definition is JSONB, so every member but the key may be absent. */
export interface DraftInputLike {
  key: string
  label?: string | null
  type?: string | null
  enum_options?: readonly string[] | null
  source?: string | null
  origin?: string | null
  note?: string | null
}

export type InputSource = "user" | "kb_auto"

export interface DraftInputsFoldProps {
  /** The server's field list for the attached form, in the form's order. */
  fields: readonly GenerateField[]
  /** The draft's LIVE declared inputs (the store's definition, re-read every render). */
  inputs: readonly DraftInputLike[]
  /** The attached form's or template's filename. */
  filename: string
  /** The body's id, which the trigger's `aria-controls` names. Owned by the card. */
  bodyId: string
  open: boolean
  onToggle: () => void
  onSetSource: (key: string, source: InputSource) => void
}

/** The trigger: one more muted line in the card's footer strip. */
export function DraftInputsFoldTrigger({
  fields,
  inputs,
  filename,
  bodyId,
  open,
  onToggle,
}: DraftInputsFoldProps) {
  return (
    <button
      type="button"
      data-testid="draft-arrival-fold-inputs"
      aria-expanded={open}
      aria-controls={bodyId}
      onClick={onToggle}
      className={FOLD_LINE_CLASS}
    >
      <span aria-hidden="true" className="shrink-0">
        {FOLD_GLYPH}
      </span>
      <span data-testid="draft-arrival-fold-inputs-summary" className="min-w-0 flex-1 truncate">
        {inputsFoldSummary(foldRows(fields, inputs, filename).filter((row) => row.fromForm).length, filename)}
      </span>
      <span className={FOLD_ACTION_CLASS}>{INPUTS_FOLD_ACTION}</span>
    </button>
  )
}

/** One rendered row, derived from a field (and its live input) or from an extra input. */
interface Row {
  key: string
  label: string
  /** The type word, or the extra input's note sentence. */
  detail: string
  /** `null` ⇒ a step writes this field, so there is no switch. */
  source: InputSource | null
  serverAdded: boolean
  /** From a form field (counted in the summary), not an extra input the AI added. */
  fromForm: boolean
}

function liveSource(input: DraftInputLike | undefined): InputSource {
  return input?.source === "kb_auto" ? "kb_auto" : "user"
}

/** One row per question the person is asked, then one per field a step writes, then one per
 *  explained extra input. 291 UAT S3-F1: a field names the input that fills it (`input_key`),
 *  which may not be the field's own key, and several fields can share one input (one "tax
 *  classification" choice fills seven checkboxes), so that input gets ONE row and its own label. */
function foldRows(
  fields: readonly GenerateField[],
  inputs: readonly DraftInputLike[],
  filename: string,
): Row[] {
  const byKey = new Map(inputs.map((input) => [input.key, input]))
  const shown = new Set<string>()
  const rows: Row[] = []
  for (const field of fields) {
    const input = byKey.get(field.input_key ?? field.key)
    if (input !== undefined && field.covered_by !== "step") {
      if (shown.has(input.key)) continue
      shown.add(input.key)
    }
    const inputLabel = typeof input?.label === "string" ? input.label : ""
    rows.push({
      key: input?.key ?? field.key,
      label: inputLabel !== "" ? inputLabel : field.label !== "" ? field.label : field.key,
      detail: fieldTypeWord(field),
      source: field.covered_by === "step" ? null : liveSource(input),
      serverAdded: input?.origin === "server_added",
      fromForm: true,
    })
  }
  for (const input of inputs) {
    if (shown.has(input.key) || fields.some((field) => field.key === input.key)) continue
    const note = typeof input.note === "string" ? input.note.trim() : ""
    if (note === "") continue
    rows.push({
      key: input.key,
      label: typeof input.label === "string" && input.label !== "" ? input.label : input.key,
      detail: inputExtraNote(filename, note),
      source: liveSource(input),
      serverAdded: input.origin === "server_added",
      fromForm: false,
    })
  }
  return rows
}

/** The body: the heading, the explanation, then one row per question and per explained extra. */
export function DraftInputsFoldBody({
  fields,
  inputs,
  filename,
  bodyId,
  onSetSource,
}: DraftInputsFoldProps) {
  const groupBase = useId()
  const rows = foldRows(fields, inputs, filename)

  const segments: { value: InputSource; label: string }[] = [
    { value: "user", label: INPUT_SOURCE_ASK },
    { value: "kb_auto", label: INPUT_SOURCE_LOOKUP },
  ]

  return (
    <div id={bodyId} data-testid="draft-arrival-inputs-body" className={FOLD_BODY_CLASS}>
      <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {INPUTS_BODY_HEADING}
      </h3>
      <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{INPUT_SOURCE_EXPLANATION}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const groupName = `${groupBase}-source-${index}`
          return (
            <li
              key={row.key}
              data-testid="draft-arrival-input-row"
              className="flex flex-wrap items-center gap-2 rounded border border-border bg-background px-2 py-2 text-[12.5px] leading-[1.5]"
            >
              <span
                data-input-label=""
                className="min-w-[120px] flex-1 text-foreground [overflow-wrap:anywhere]"
              >
                {row.label}
              </span>
              <span data-input-type="" className="text-[11px] text-muted-foreground">
                {row.detail}
              </span>
              {row.source === null ? (
                <span className="text-[11px] text-muted-foreground">{INPUT_FROM_STEP}</span>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={inputSourceGroupLabel(row.label)}
                  className="inline-flex overflow-hidden rounded-sm border border-border"
                >
                  {segments.map((segment) => {
                    const selected = row.source === segment.value
                    return (
                      <label
                        key={segment.value}
                        className={cn(
                          "inline-flex min-h-6 cursor-pointer items-center px-2 text-[11px] text-muted-foreground",
                          "focus-within:outline-none focus-within:ring-1 focus-within:ring-primary",
                          selected && "bg-primary/15 font-medium text-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={groupName}
                          value={segment.value}
                          checked={selected}
                          onChange={() => onSetSource(row.key, segment.value)}
                        />
                        {segment.label}
                      </label>
                    )
                  })}
                </div>
              )}
              {row.serverAdded ? (
                <span
                  data-testid="draft-arrival-input-added-by-syrel"
                  className="basis-full text-[11px] text-muted-foreground"
                >
                  {INPUT_ADDED_BY_SYREL}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
