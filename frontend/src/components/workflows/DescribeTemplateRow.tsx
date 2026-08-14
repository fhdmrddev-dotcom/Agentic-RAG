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
import { useId } from "react"

import { DESCRIBE_ATTACH_PROMPT } from "./doorVocabulary"
import {
  ATTACH_NOTE,
  FOOTING_LOADING,
  FOOTING_NONE,
  FOOTING_NOT_WORD,
  FOOTING_UNAVAILABLE,
  SPEC_FILENAME_LEAD,
  footingFields,
} from "./templateFirstVocabulary"
import {
  TEMPLATE_ACCEPT,
  TEMPLATE_ATTACH_LABEL,
  TEMPLATE_FIELDS_HEADING,
  TEMPLATE_FIELDS_LOADING,
  TEMPLATE_FIELDS_NONE,
  TEMPLATE_FIELDS_NOT_WORD,
  TEMPLATE_FIELDS_UNAVAILABLE,
  TEMPLATE_TYPES_NOTE,
} from "./TemplateAttachSection"

import type { TemplatePlaceholdersState } from "@/hooks/useTemplatePlaceholders"

/** The control that removes a held document, so a mis-pick is one press from undone. */
export const DESCRIBE_TEMPLATE_CLEAR_LABEL = "Remove this document"

export interface DescribeTemplateRowProps {
  /**
   * The read's current answer. ⚠ THE SAME UNION THE RAIL'S HOOK RETURNS, imported rather than
   * re-declared: one wire shape for both doors means the two surfaces cannot derive different
   * arms from the same server answer.
   */
  state: TemplatePlaceholdersState
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
}

const ROW_CLASSES = "mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left"
const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"
const FOOTING_CLASSES = "mt-1.5 text-[11px] leading-snug text-foreground"
const FILENAME_CLASSES =
  "mt-1.5 flex items-center gap-1.5 text-[11px] leading-snug text-foreground"

/**
 * Which footing line belongs to a reading — EXACTLY ONE, for every arm including the in-flight
 * one (D-09: a control that is waiting and does not say why reads as broken).
 *
 * ⚠ `notWord` is DERIVED, not a member of the union, and it is gated on EMPTINESS rather than
 * on the extension alone — the shipped rule, copied in kind. A document that somehow DID yield
 * fields renders its fields; this branch exists only for the empty case, so it can never become
 * a stale second copy of the server's own parser predicate.
 */
function footingFor(state: TemplatePlaceholdersState, notWord: boolean): string | null {
  switch (state.kind) {
    case "idle":
      return null
    case "loading":
      return FOOTING_LOADING
    case "fields":
      // ⚠ DERIVED FROM THE LIST ITSELF. This is the same array the render maps over below, so
      // the number stated and the number shown cannot disagree.
      return footingFields(state.fields.length)
    case "none":
      return notWord ? FOOTING_NOT_WORD : FOOTING_NONE
    case "unavailable":
      return FOOTING_UNAVAILABLE
  }
}

export function DescribeTemplateRow({
  state,
  filename,
  onPickFile,
  onClear,
}: DescribeTemplateRowProps) {
  const inputId = useId()

  // Gated on EMPTINESS, never on the extension alone — see `footingFor`.
  const notWord = state.kind === "none" && !(filename ?? "").toLowerCase().endsWith(".docx")

  const footing = footingFor(state, notWord)
  const holding = state.kind !== "idle"

  return (
    <section data-testid="describe-template-row" className={ROW_CLASSES}>
      <p data-testid="describe-template-prompt" className="text-[11px] font-medium text-foreground">
        {DESCRIBE_ATTACH_PROMPT}
      </p>

      <p data-testid="describe-template-note" className={NOTE_CLASSES}>
        {ATTACH_NOTE}
      </p>

      <label htmlFor={inputId} className="mt-2 block text-[11px] font-medium text-foreground">
        {TEMPLATE_ATTACH_LABEL}
      </label>
      {/* The NATIVE picker, on purpose — the shipped section's reasoning, inherited: it is
          keyboard-reachable and announces itself without a hidden-input-behind-a-button proxy. */}
      <input
        id={inputId}
        type="file"
        data-testid="describe-template-input"
        accept={TEMPLATE_ACCEPT}
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
          onClick={onClear}
          className="mt-1.5 text-[10.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {DESCRIBE_TEMPLATE_CLEAR_LABEL}
        </button>
      )}

      <p data-testid="describe-template-types" className={NOTE_CLASSES}>
        {TEMPLATE_TYPES_NOTE}
      </p>

      {/* ONE stable wrapper with a live role, present across every non-idle arm — the correct
          aria pattern for a late-settling fact, and it means ONE announcement rather than four
          competing ones. Assistive tech observes the change INSIDE a node it already watches. */}
      {holding && (
        <div data-testid="describe-template-fields-region" role="status">
          {state.kind === "loading" && (
            <p data-testid="describe-template-fields-loading" className={NOTE_CLASSES}>
              {TEMPLATE_FIELDS_LOADING}
            </p>
          )}

          {state.kind === "fields" && (
            <>
              {typeof filename === "string" && filename.length > 0 && (
                <p data-testid="describe-template-filename" className={FILENAME_CLASSES}>
                  <span aria-hidden="true">📄</span>
                  <span className="min-w-0 break-all">
                    {SPEC_FILENAME_LEAD} {filename}
                  </span>
                </p>
              )}
              <p data-testid="describe-template-fields-heading" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_HEADING}
              </p>
              {/* ⚠ Names are ordinary React text children — ESCAPED BY CONSTRUCTION. They
                  originate in a document an attacker may have supplied, and this file uses no
                  raw-markup escape hatch of any kind (asserted by grep, which is why the
                  identifier is not spelled here). Rendered in the SERVER'S order and never
                  re-sorted: the order is part of the answer. */}
              <ul
                data-testid="describe-template-fields"
                className={`${NOTE_CLASSES} list-disc pl-4`}
              >
                {state.fields.map((name) => (
                  <li key={name} className="break-all">
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ⚠ THE TWO SENTENCES THAT MAY NEVER MERGE — see the file docblock. Different nodes,
              different words, so a change that renders one for the other turns a test red. */}
          {state.kind === "none" &&
            (notWord ? (
              <p data-testid="describe-template-fields-not-word" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_NOT_WORD}
              </p>
            ) : (
              <p data-testid="describe-template-fields-none" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_NONE}
              </p>
            ))}

          {state.kind === "unavailable" && (
            <p data-testid="describe-template-fields-unavailable" className={NOTE_CLASSES}>
              {TEMPLATE_FIELDS_UNAVAILABLE}
            </p>
          )}

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
