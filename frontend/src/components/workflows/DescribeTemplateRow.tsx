/**
 * Phase 193.1-06 (AUTH-03) — THE PRE-DRAFT TEMPLATE ROW.
 *
 * The control that lets an author supply the document their workflow will fill in BEFORE the
 * draft is written, plus the honest reading of what that document asks for. Sketch 165-C's
 * shape with sketch 166-B's footing line.
 *
 * ⚠ NOTHING MOUNTS THIS YET. Plan 08 mounts it, on BOTH pre-draft describe screens — there are
 * two, they render nearly the same thing, and the splice anchor class string occurs in both. A
 * plan that assumes one is the other lands the feature on half the product.
 *
 * ── WHY THIS IS A NEW COMPONENT RATHER THAN A PROP ON THE SHIPPED ONE ─────────────────────
 * `TemplateAttachSection.tsx` renders this same reading on the deliverable step's rail, and
 * reusing it here was measured IMPOSSIBLE rather than merely awkward: it consults the server
 * itself, keyed on a saved definition id AND a stored asset id, and NEITHER EXISTS BEFORE A
 * DRAFT DOES. Mounting it pre-draft is a data-contract change to a component that shipped with
 * a large pinned suite, not a styling one.
 *
 * So this component INHERITS THAT COMPONENT'S SENTENCES BY IMPORT and re-types none of them,
 * which is exactly what sketch 165's contract asks for — the pre-draft screen showing the SAME
 * words for the same list is what makes the two surfaces read as one fact rather than two
 * features. `TemplateAttachSection.tsx` is not edited by this phase.
 *
 * ── PRESENTATIONAL. IT OWNS NO FETCH ─────────────────────────────────────────────────────
 * `ForkNameDialog.tsx` is the shape: fed entirely from its props, no network import, no request
 * cancellation of its own, no state machine of its own. The read lives in the hook this
 * surface's own plan cut out; this file renders its answer. That separation is what lets the
 * whole five-arm surface be driven in a test without a server.
 *
 * ⚠ THE TWO PROPERTIES ABOVE ARE ACCEPTED BY GREP, so this file deliberately does not SPELL
 * either banned identifier anywhere — not even to say it avoids them. Prose quoting the pattern
 * it bans is what makes such a grep unreadable, which this repository has now recorded three
 * times. The properties are named in words and asserted mechanically instead.
 *
 * ── THE INHERITED CONSTRAINT, RESTATED BECAUSE IT IS THE POINT ────────────────────────────
 * The `none` reading and the `unavailable` reading MAY NEVER MERGE — nor may their two footing
 * lines. `none` is a fact about the DOCUMENT: we opened it and it carries no fill-in fields.
 * `unavailable` is a fact about US: we never opened it. The consequence for the draft happens
 * to be identical, which is exactly why the wording must not be. An author shown the first when
 * the second is true ships a workflow that fills nothing — the defect this whole phase exists
 * to remove. Each arm therefore gets its OWN node with its OWN testid, so a change that renders
 * one arm's sentence for another turns a test red rather than shipping.
 *
 * ── TWO DELIBERATE OMISSIONS, RECORDED SO THEY READ AS DECISIONS RATHER THAN GAPS ─────────
 * 1. **Sketch 165-C's own promise line is NOT rendered.** It and sketch 166-B's footing say the
 *    same thing, and the operator picked 166-B's for that line: the winning shape is the spec
 *    block with ONE line underneath. Two sentences saying one thing would be a second home for
 *    it, and the second home is what drifts.
 * 2. **The conditional hint swap is DECLINED (D-13).** The describe hint is three governed
 *    fragments pinned byte-exact by an existing suite; swapping it when a document is attached
 *    means a second sentence in the vocabulary module and a second pinned capture. Sketch 166-C
 *    was already rejected for reopening a governed string settled three weeks earlier, and the
 *    same logic applies here. The shipped hint stays whole — it just promises less.
 *
 * ── EVERY COUNT THIS SURFACE STATES IS DERIVED ───────────────────────────────────────────
 * `footingFields` is called with the LENGTH OF THE LIST RENDERED DIRECTLY ABOVE IT — never a
 * literal, never a prop a caller could pass wrong. The suite asserts the rendered number equals
 * the number of list items actually present, so a hardcoded value cannot pass. A number beside
 * a list of a different length is the exact class of silent lie this phase exists to remove.
 *
 * ⚠ NAME IDENTIFIERS, NEVER WORDS, IN EVERY COMMENT IN THIS FILE. It is swept by the D-24(a)
 * RAW copy fence, prose included: a docblock quoting a governed door word is a second home for
 * it and reds the fence, which is the fence working rather than misfiring.
 */
/*
 * ── 291-04 (sketch 291-describe-files winner B, UI-SPEC Surface 1) — THE FORM SLOT ─────────
 * This row is EXTENDED in place, never forked: it now reads a PDF form, a Word document with
 * blanks or a scan as well as a `{{ }}` template, and renders the SERVER'S arm — fields, type
 * words, the document's own lines and every server sentence exactly as received. It still
 * owns no fetch; the ticks it shows arrive as a prop and leave as a callback.
 *
 * Every class string this phase added that needs an off-grid value is a NAMED constant from
 * `./surfaceClasses` (the UI-SPEC `?raw` spacing fence), and the four shipped row constants
 * were moved there byte-identical.
 */
import { useId, useState } from "react"

import { DESCRIBE_ATTACH_PROMPT } from "./doorVocabulary"
import {
  FACT_CLASSES,
  FIELD_GRID_CLASSES,
  FILENAME_CLASSES,
  FOOTING_CLASSES,
  NOTE_CLASSES,
  PLACES_LIST_CLASSES,
  ROW_CLASSES,
} from "./surfaceClasses"
import {
  ATTACH_NOTE,
  DESCRIBE_FORM_ACCEPT,
  DESCRIBE_FORM_ATTACH_LABEL,
  DESCRIBE_FORM_TYPES_NOTE,
  DESCRIBE_READING,
  FIELD_SUGGESTED_TAG,
  FOOTING_FORM_UNAVAILABLE,
  FOOTING_NOT_WORD,
  FOOTING_READING_DOCUMENT,
  FOOTING_REFERENCE_ONLY,
  FOOTING_UNAVAILABLE,
  FOOTING_WITHOUT_IT,
  FORM_BACK_FLAT,
  FORM_FIELDS_HEADING,
  FORM_PROVENANCE_EXACT,
  FORM_PROVENANCE_SUGGESTED_SCAN,
  FORM_PROVENANCE_SUGGESTED_TEXT,
  FORM_UNAVAILABLE,
  PLACES_HEADING,
  PLACES_PROVENANCE,
  PLACE_STAYS_BLANK,
  SCAN_UNREADABLE,
  SPEC_FILENAME_LEAD,
  fieldTypeWord,
  footingAsks,
  footingFields,
  formBackLinePdf,
  formBackLineWord,
  noFieldsLine,
  unplacedSentencesLead,
  showAllLabel,
} from "./templateFirstVocabulary"
import {
  TEMPLATE_FIELDS_HEADING,
  TEMPLATE_FIELDS_NOT_WORD,
  TEMPLATE_FIELDS_UNAVAILABLE,
} from "./TemplateAttachSection"

import type { DescribeReadState } from "./useTemplateFirstDraft"

/** The control that removes a held document, so a mis-pick is one press from undone. */
export const DESCRIBE_TEMPLATE_CLEAR_LABEL = "Remove this document"

type ReadResult = Extract<DescribeReadState, { kind: "read" }>["result"]
type ReadField = ReadResult["fields"][number]

export interface DescribeTemplateRowProps {
  /**
   * The read's current answer. ⚠ THE SAME UNION THE DOOR'S HOOK RETURNS, imported rather than
   * re-declared: one wire shape for both doors means the two surfaces cannot derive different
   * arms from the same server answer.
   */
  state: DescribeReadState
  /**
   * The held document's name, or `undefined` when none is held. Supplied by the caller from the
   * same place the bytes came from, so the name and the reading can never disagree about which
   * document is on screen.
   */
  filename?: string
  /** The author picked a file. This component performs no upload and no read. */
  onPickFile: (file: File) => void
  /** The author removed the held document. */
  onClear: () => void
  /** 291-04 (D-27): the Word blanks the author unticked. Absent ⇒ every blank is ticked. */
  untickedKeys?: readonly string[]
  /** 291-04 (D-27): a tick was pressed. The row keeps no tick state of its own. */
  onToggleBlank?: (key: string) => void
  /** 296-07 (291-WR-01): a draft is being written — the picker, the clear and the ticks are
   *  disabled, and say why through `disabledNoteId` (the page renders that hint once). */
  disabled?: boolean
  disabledNoteId?: string
}

/**
 * 296-07 (291-IN-03) — the sentences the template bind could not place a blank for, under the
 * blanks they belong to: the count line, then each sentence quoted on its own line. React text
 * only (T-296-38). An empty list renders nothing.
 */
export function UnplacedSentencesNote({ sentences }: { sentences: readonly string[] }) {
  if (sentences.length === 0) return null
  return (
    <div data-testid="describe-form-unplaced-sentences" className="text-xs text-[hsl(var(--warning))]">
      <p>{unplacedSentencesLead(sentences.length)}</p>
      {sentences.map((sentence, i) => (
        <p key={i} className="[overflow-wrap:anywhere]">{`“${sentence}”`}</p>
      ))}
    </div>
  )
}

/** How many PDF fields show before `showAllLabel` (UI-SPEC decision 7). Words are never capped. */
const FIELD_CAP = 8
const DECK_EXTENSIONS = [".pptx", ".xlsx"]
const NO_UNTICKED: readonly string[] = []

const TAG_CLASSES = "ml-1 rounded-sm border border-border px-1 text-[11px] text-muted-foreground"
const TYPE_WORD_CLASSES = "whitespace-nowrap text-muted-foreground"
const MARK_TICKED = "rounded-sm border-b border-dashed border-primary/60 bg-primary/15 px-1 text-foreground"
const MARK_UNTICKED = "rounded-sm border-b border-dashed border-border bg-transparent px-1 text-muted-foreground"
const SHOW_ALL_CLASSES =
  "mt-1 min-h-6 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"

/**
 * Which reading the slot shows — the server's arm, with two client facts folded in that the
 * arm alone cannot carry: whether the held file is a DECK (the Word-only sentence is true only
 * of decks, UI-SPEC decision 4), and whether a field list is actually empty (then it reads as
 * the D-02 line, never as an empty list).
 */
type View =
  | { arm: "idle" }
  | { arm: "loading" }
  | { arm: "template"; fields: ReadField[] }
  | { arm: "form"; fields: ReadField[] }
  | { arm: "suggested"; fields: ReadField[]; from: "text" | "scan"; cutShort: string | null }
  | { arm: "blanks"; result: ReadResult }
  | { arm: "none" }
  | { arm: "notWord" }
  | { arm: "scan" }
  | { arm: "copyRefused"; sentence: string | null }
  | { arm: "unavailable"; pdf: boolean }

function viewOf(state: DescribeReadState, filename: string): View {
  const lower = filename.toLowerCase()
  const deck = DECK_EXTENSIONS.some((ext) => lower.endsWith(ext))
  switch (state.kind) {
    case "idle":
      return { arm: "idle" }
    case "loading":
      return { arm: "loading" }
    case "unavailable":
      return { arm: "unavailable", pdf: lower.endsWith(".pdf") }
    case "read": {
      const r = state.result
      switch (r.arm) {
        case "template_fields":
          return r.fields.length > 0 ? { arm: "template", fields: r.fields } : deck ? { arm: "notWord" } : { arm: "none" }
        case "form_fields":
          return r.fields.length > 0 ? { arm: "form", fields: r.fields } : { arm: "none" }
        case "suggested_fields":
          return r.fields.length > 0
            ? { arm: "suggested", fields: r.fields, from: r.suggested_from ?? "text", cutShort: r.cut_short }
            : { arm: "none" }
        case "blanks":
          return { arm: "blanks", result: r }
        case "scan_unreadable":
          return { arm: "scan" }
        case "copy_refused":
          return { arm: "copyRefused", sentence: r.refused }
        // `not_word`, `none` (and a reference arm, which the slot never asks for): the
        // Word-only sentence is true only of a deck, so everything else gets the D-02 line.
        default:
          return deck ? { arm: "notWord" } : { arm: "none" }
      }
    }
  }
}

/**
 * Which footing line belongs to a reading — EXACTLY ONE, for every arm including the in-flight
 * one (D-09: a control that is waiting and does not say why reads as broken).
 *
 * ⚠ EVERY COUNT IS DERIVED FROM THE LIST RENDERED ABOVE IT. For Word blanks it is the TICKED
 * placed rows; with none ticked there is nothing to fill, so the file is used as a reference.
 */
function footingFor(view: View, ticked: number): string | null {
  switch (view.arm) {
    case "idle":
      return null
    case "loading":
      return FOOTING_READING_DOCUMENT
    case "template":
    case "form":
      return footingFields(view.fields.length)
    case "suggested":
      return footingAsks(view.fields.length)
    case "blanks":
      return ticked > 0 ? footingFields(ticked) : FOOTING_REFERENCE_ONLY
    case "none":
      return FOOTING_REFERENCE_ONLY
    case "notWord":
      return FOOTING_NOT_WORD
    case "scan":
    case "copyRefused":
      return FOOTING_WITHOUT_IT
    case "unavailable":
      return view.pdf ? FOOTING_FORM_UNAVAILABLE : FOOTING_UNAVAILABLE
  }
}

/** The PDF field grid: label · type word, in the server's order, capped with an in-place expand. */
function FieldGrid({ fields, suggested }: { fields: ReadField[]; suggested: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? fields : fields.slice(0, FIELD_CAP)
  return (
    <>
      <div role="list" data-testid="describe-form-fields" className={FIELD_GRID_CLASSES}>
        {shown.map((field) => (
          <FieldGridRow key={field.key} field={field} suggested={suggested} />
        ))}
      </div>
      {fields.length > FIELD_CAP && (
        <button
          type="button"
          data-testid="describe-form-show-all"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className={SHOW_ALL_CLASSES}
        >
          {showAllLabel(fields.length)}
        </button>
      )}
    </>
  )
}

function FieldGridRow({ field, suggested }: { field: ReadField; suggested: boolean }) {
  return (
    <>
      {/* The LABEL as the server read it — never the raw qualified field name when a label
          exists. Escaped by construction: it is an ordinary React text child. */}
      <span role="listitem" className="text-foreground [overflow-wrap:anywhere]">
        {field.label || field.key}
        {suggested && (
          <span data-testid="describe-form-suggested-tag" className={TAG_CLASSES}>
            {FIELD_SUGGESTED_TAG}
          </span>
        )}
      </span>
      <span className={TYPE_WORD_CLASSES}>{fieldTypeWord(field)}</span>
    </>
  )
}

export function DescribeTemplateRow({
  state,
  filename,
  onPickFile,
  onClear,
  untickedKeys = NO_UNTICKED,
  onToggleBlank,
  disabled = false,
  disabledNoteId,
}: DescribeTemplateRowProps) {
  const lockedBy = disabled && disabledNoteId ? { "aria-describedby": disabledNoteId } : {}
  const inputId = useId()

  const view = viewOf(state, filename ?? "")
  const placed = view.arm === "blanks" ? view.result.fields : []
  const ticked = placed.filter((f) => !untickedKeys.includes(f.key)).length
  const footing = footingFor(view, ticked)
  const holding = state.kind !== "idle"
  const shownName = filename ?? (state.kind === "read" ? state.result.filename : "")

  return (
    <section data-testid="describe-template-row" className={ROW_CLASSES}>
      <p data-testid="describe-template-prompt" className="text-[11px] font-medium text-foreground">
        {DESCRIBE_ATTACH_PROMPT}
      </p>

      <p data-testid="describe-template-note" className={NOTE_CLASSES}>
        {ATTACH_NOTE}
      </p>

      <label htmlFor={inputId} className="mt-2 block text-[11px] font-medium text-foreground">
        {DESCRIBE_FORM_ATTACH_LABEL}
      </label>
      {/* The NATIVE picker, on purpose — the shipped section's reasoning, inherited: it is
          keyboard-reachable and announces itself without a hidden-input-behind-a-button proxy. */}
      <input
        id={inputId}
        type="file"
        data-testid="describe-template-input"
        accept={DESCRIBE_FORM_ACCEPT}
        disabled={disabled}
        {...lockedBy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Reset the control NOW rather than after: picking the same file twice in a row must
          // re-fire `change`, and re-picking a corrected file is the obvious next move.
          event.target.value = ""
          if (file) onPickFile(file)
        }}
        className="mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40"
      />

      {holding && (
        <button
          type="button"
          data-testid="describe-template-clear"
          disabled={disabled}
          {...lockedBy}
          onClick={onClear}
          className="mt-1.5 text-[10.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {DESCRIBE_TEMPLATE_CLEAR_LABEL}
        </button>
      )}

      <p data-testid="describe-template-types" className={NOTE_CLASSES}>
        {DESCRIBE_FORM_TYPES_NOTE}
      </p>

      {/* ONE stable wrapper with a live role, present across every non-idle arm — the correct
          aria pattern for a late-settling fact, and it means ONE announcement rather than
          several competing ones. Assistive tech observes the change INSIDE a node it watches. */}
      {holding && (
        <div data-testid="describe-template-fields-region" role="status">
          {view.arm === "loading" && (
            <p data-testid="describe-template-fields-loading" className={NOTE_CLASSES}>
              {DESCRIBE_READING}
            </p>
          )}

          {(view.arm === "template" || view.arm === "form" || view.arm === "suggested" || view.arm === "blanks") &&
            shownName.length > 0 && (
              <p data-testid="describe-template-filename" className={FILENAME_CLASSES}>
                <span aria-hidden="true">📄</span>
                <span className="min-w-0 break-all">
                  {SPEC_FILENAME_LEAD} {shownName}
                </span>
              </p>
            )}

          {view.arm === "template" && (
            <>
              <p data-testid="describe-template-fields-heading" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_HEADING}
              </p>
              {/* ⚠ Names are ordinary React text children — ESCAPED BY CONSTRUCTION. They
                  originate in a document an attacker may have supplied, and this file uses no
                  raw-markup escape hatch of any kind (asserted by grep, which is why the
                  identifier is not spelled here). Rendered in the SERVER'S order and never
                  re-sorted: the order is part of the answer. */}
              <ul data-testid="describe-template-fields" className={`${NOTE_CLASSES} list-disc pl-4`}>
                {view.fields.map((field) => (
                  <li key={field.key} className="break-all">
                    {field.key}
                  </li>
                ))}
              </ul>
            </>
          )}

          {view.arm === "form" && (
            <>
              <p data-testid="describe-form-heading" className={NOTE_CLASSES}>
                {FORM_FIELDS_HEADING} · {FORM_PROVENANCE_EXACT}
              </p>
              <FieldGrid fields={view.fields} suggested={false} />
              <p data-testid="describe-form-back" className={NOTE_CLASSES}>
                {formBackLinePdf(shownName)}
              </p>
            </>
          )}

          {view.arm === "suggested" && (
            <>
              <p data-testid="describe-form-heading" className={NOTE_CLASSES}>
                {FORM_FIELDS_HEADING} ·{" "}
                {view.from === "scan" ? FORM_PROVENANCE_SUGGESTED_SCAN : FORM_PROVENANCE_SUGGESTED_TEXT}
              </p>
              <FieldGrid fields={view.fields} suggested />
              {/* The server's sentence, verbatim — never cut silently. */}
              {view.cutShort !== null && (
                <p data-testid="describe-form-cut-short" className={FACT_CLASSES}>
                  {view.cutShort}
                </p>
              )}
              <p data-testid="describe-form-back-flat" className={FACT_CLASSES}>
                {FORM_BACK_FLAT}
              </p>
            </>
          )}

          {view.arm === "blanks" && (
            <>
              <p data-testid="describe-form-heading" className={NOTE_CLASSES}>
                {PLACES_HEADING} · {PLACES_PROVENANCE}
              </p>
              {/* THE D-04 LIST FOR WORD FORMS, never capped: the author must see where every
                  answer lands (D-27). The whole row is the label, so the hit area is the line. */}
              <ul data-testid="describe-form-places" className={PLACES_LIST_CLASSES}>
                {view.result.fields.map((field) => {
                  const isTicked = !untickedKeys.includes(field.key)
                  return (
                    <li key={field.key}>
                      <label className="flex min-h-6 items-baseline gap-2">
                        <input
                          type="checkbox"
                          checked={isTicked}
                          disabled={disabled}
                          {...lockedBy}
                          onChange={() => onToggleBlank?.(field.key)}
                          className="focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {field.line_before !== null && field.line_before.length > 0 && (
                            <span className="text-muted-foreground">{field.line_before}</span>
                          )}
                          <span
                            data-testid="describe-form-place-mark"
                            className={isTicked ? MARK_TICKED : MARK_UNTICKED}
                          >
                            {field.label}
                          </span>
                          {field.line_after !== null && field.line_after.length > 0 && (
                            <span className="text-muted-foreground">{field.line_after}</span>
                          )}
                          {field.origin === "ai_proposed" && (
                            <span data-testid="describe-form-suggested-tag" className={TAG_CLASSES}>
                              {FIELD_SUGGESTED_TAG}
                            </span>
                          )}
                          {/* REAL DOM text, never a pseudo-element and never a strike-through:
                              an unticked blank stays BLANK, it is not deleted. */}
                          {!isTicked && (
                            <span data-testid="describe-form-place-stays-blank" className="text-muted-foreground">
                              {` ${PLACE_STAYS_BLANK}`}
                            </span>
                          )}
                        </span>
                        <span className={`ml-auto text-[11px] ${TYPE_WORD_CLASSES}`}>{fieldTypeWord(field)}</span>
                      </label>
                    </li>
                  )
                })}
                {/* D-28 — the server's own sentence, after the placed rows, never counted. */}
                {view.result.unplaced.map((unplaced, i) => (
                  <li
                    key={`unplaced-${i}`}
                    data-testid="describe-form-unplaced"
                    className="flex items-baseline gap-2 text-foreground"
                  >
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{unplaced.sentence}</span>
                  </li>
                ))}
              </ul>
              <p data-testid="describe-form-back-word" className={NOTE_CLASSES}>
                {formBackLineWord(shownName)}
              </p>
            </>
          )}

          {/* ⚠ THE TWO READINGS THAT MAY NEVER MERGE — see the file docblock. Different nodes,
              different words, so a change that renders one for the other turns a test red. */}
          {view.arm === "none" && (
            <p data-testid="describe-form-no-fields" className={FACT_CLASSES}>
              {noFieldsLine(shownName)}
            </p>
          )}

          {view.arm === "notWord" && (
            <p data-testid="describe-template-fields-not-word" className={NOTE_CLASSES}>
              {TEMPLATE_FIELDS_NOT_WORD}
            </p>
          )}

          {view.arm === "scan" && (
            <p data-testid="describe-form-scan-unreadable" className={FACT_CLASSES}>
              {SCAN_UNREADABLE}
            </p>
          )}

          {view.arm === "copyRefused" && view.sentence !== null && (
            <p data-testid="describe-form-copy-refused" className={FACT_CLASSES}>
              {view.sentence}
            </p>
          )}

          {view.arm === "unavailable" &&
            (view.pdf ? (
              <p data-testid="describe-form-unavailable" className={NOTE_CLASSES}>
                {FORM_UNAVAILABLE}
              </p>
            ) : (
              <p data-testid="describe-template-fields-unavailable" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_UNAVAILABLE}
              </p>
            ))}

          {/* EXACTLY ONE footing line, on every arm — 166-B's shape and D-09's requirement. */}
          {footing !== null && (
            <p data-testid="describe-template-footing" className={FOOTING_CLASSES}>
              {footing}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default DescribeTemplateRow
