/**
 * Phase 193 (AUTH-03, piece 2 of 3) — TemplateAttachSection: the file this deliverable fills in.
 *
 * ── WHAT WAS MISSING ──────────────────────────────────────────────────────────────────
 * The READ half of this circuit has been shipped since Phase 187: `WorkflowBuilderPage`
 * resolves `assets.find(a => a.kind === "template")?.filename` into `NameContext`, and
 * `derivedFace` tier 2 turns it into the node face `Fill {filename}` on BOTH the spine and
 * the canvas. The run engine's `resolve_template_source` Branch 1 has always been able to
 * consume the descriptor. Nothing in the app could ever WRITE one — every template-bound
 * workflow in the database was seeded straight into it. This component is the writer.
 *
 * ── IT OWNS ITS OWN FILE, BY STANDING ORDER (G-5) ─────────────────────────────────────
 * `CLAUDE.md`'s hot-file ledger closes the `PhaseFormPanel.tsx` row with an instruction
 * rather than a status: *"Keep this shape — the next surface that needs the panel gets its
 * own component and one gated line."* This is that next surface. `GovernanceSection.tsx` is
 * the precedent being copied deliberately (its own file, one gated mount, all of the logic
 * here), and the panel's whole cost for this phase is one optional prop plus one gated line
 * in the render body.
 *
 * ── WHY THE WRITE IS CALLER-OWNED (the config-vs-definition seam) ─────────────────────
 * `PhaseFormPanel` documents its only write seam at its `PhaseGateRow` docblock: *"this
 * panel's only write seam (`onChange`) patches `config`"* — which is PHASE-scoped. A
 * template descriptor is DEFINITION-scoped: it lives in `definition.assets[]`, a sibling of
 * `phases`, and the page already reads it from exactly there. So this component takes an
 * `onAttached` callback and hands the descriptor UP, exactly as `PhaseGateRow.onRemove` and
 * `onGovernanceChange` hand their definition-level writes up, for the identical reason.
 * Smuggling it through `onChange` would bury the descriptor inside one step's config, where
 * the run engine would never look for it and the node face would never find it.
 *
 * ── THE UPLOAD LIVES HERE, THE DEFINITION WRITE DOES NOT ──────────────────────────────
 * The `ConnectionPicker.tsx` shape (Phase 190-12): a leaf that consults the server itself
 * rather than growing three props on its parent. The backend deliberately does NOT write the
 * definition — it returns the descriptor and stops — so that exactly ONE writer touches the
 * `definition` JSONB and Phase 186's `If-Match` token is never raced by a second one. This
 * component therefore performs the POST and performs no save: the caller appends and saves.
 *
 * ── EVERY USER-VISIBLE STRING IS AN EXPORTED IDENTIFIER ───────────────────────────────
 * The `GovernanceSection.tsx` / `ConnectionPicker.tsx` discipline, for its stated reason: a
 * sentence living inline inside JSX is a sentence nobody can test for drift.
 *
 * ── THE ONE SENTENCE THIS COMPONENT DOES NOT AUTHOR ───────────────────────────────────
 * A 422 refusal is shown in THE SERVER'S OWN WORDS. Its detail is a plain, actionable
 * sentence by contract ("A workflow template must be a .docx, .pptx or .xlsx document (got
 * .png).", "File too large. Maximum size is 10 MB."), and the rule it enforces lives in one
 * place — re-wording it here would be a second copy of a server predicate that can drift
 * from the gate that actually refused (D-182-06). A 404 IS worded here, because the server
 * makes not-found and not-yours deliberately indistinguishable and the client must not
 * invent a distinction the server refused to make.
 *
 * A LEAF: no context, no store, no router. One network call, one callback, three states.
 */
import { useCallback, useId, useState } from "react"

import { useTemplatePlaceholders } from "@/hooks/useTemplatePlaceholders"
import { uploadWorkflowTemplate, WorkflowTemplateUploadError } from "@/lib/api"
import type { WorkflowTemplateAsset } from "@/lib/api"

/** The section heading. A module-scope const for the same reason `GovernanceSection`'s is:
 *  the `<h3>` text and anything that labels the group must be the same words. */
export const TEMPLATE_SECTION_HEADING = "The file this step fills in"

/** Said when nothing is attached. It states the CONSEQUENCE, not just the absence — an
 *  author who does not know a deliverable step needs a file learns it here. */
export const TEMPLATE_NONE_NOTE =
  "No template attached yet. This step fills in a document you supply."

/** The accepted set, said in words a person recognises before they open a file dialog and
 *  again in the picker's own `accept` filter below. */
export const TEMPLATE_TYPES_NOTE = "Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB."

/** The picker's label, in its two readings. Attaching a second file REPLACES the first:
 *  a workflow binds one template, and the word has to say so before the press, not after. */
export const TEMPLATE_ATTACH_LABEL = "Attach a template"
export const TEMPLATE_REPLACE_LABEL = "Replace this template"

/** In flight. Present tense, and it never claims the attachment is done. */
export const TEMPLATE_UPLOADING_NOTE = "Attaching…"

/**
 * The draft has never been saved, so there is no row to attach to. NOT a disabled picker
 * with no explanation: the person is one press away (the header's Save draft) and the
 * sentence says which press.
 */
export const TEMPLATE_UNSAVED_REFUSAL =
  "Save this draft first — a template attaches to a saved workflow. Use Save draft above, then attach."

/**
 * HTTP 404. Worded here rather than relayed, because the server answers 404 for BOTH "no
 * such workflow" and "not yours" on purpose (no existence oracle), so the only honest
 * client sentence names both and prefers neither.
 */
export const TEMPLATE_NOT_FOUND_ERROR =
  "This workflow could not be found. It may have been deleted, or it may not be yours."

/** The refusal arrived with no readable sentence in it — the only case where this file
 *  words a refusal the server owns, and it says what to do rather than what happened. */
export const TEMPLATE_REFUSED_FALLBACK =
  "That file was refused. Attach a .docx, .pptx or .xlsx document under 10 MB."

/** The request never got an answer. Distinguished from a refusal because the action to take
 *  is different: try again, rather than pick a different file. */
export const TEMPLATE_NETWORK_ERROR =
  "The template could not be sent. Check your connection and try again."

/** The `accept` filter — a convenience, never a gate. The server's magic-byte check is the
 *  gate, and a renamed binary gets past this attribute and is refused there. */
export const TEMPLATE_ACCEPT = ".docx,.pptx,.xlsx"

/* ── Quick task 260814-q5r: what the attached template ASKS FOR ────────────────────────
 *
 * Until now this section said a file is attached, by NAME, and nothing more — so an author
 * could not tell what the document would ask the step to fill in, and found out at run time
 * or never. Four readings are added, and the ONE rule binding them is that `none` and
 * `unavailable` may never share a node or a sentence: an author who is told "no fields"
 * about a template we never opened ships a workflow that fills nothing.
 *
 * ⚠ NO NEW VISUAL LANGUAGE. All four use this file's existing `NOTE_CLASSES`. The amber
 * `REFUSAL_CLASSES` block is reserved for refusals this panel OWNS — a degraded read is not
 * a refusal and dressing it as one would overstate it. No colour, no chip, no badge.
 */

/** Heading for the list. Says what the fields ARE to the author, not what they are called
 *  in the document's XML ("placeholders" is our word, not theirs). */
export const TEMPLATE_FIELDS_HEADING = "What this template asks for"

/** In flight. The fields settle after the filename does, so this is a real reading rather
 *  than a flash — and it never implies the answer is empty while it is merely absent. */
export const TEMPLATE_FIELDS_LOADING = "Reading this template…"

/**
 * We opened the document and it carries no fill-in fields. States what we DID and what we
 * FOUND, rather than making a claim about the document — and it must never be reworded
 * into `TEMPLATE_FIELDS_UNAVAILABLE`'s shape, or the distinction dies in the copy.
 */
export const TEMPLATE_FIELDS_NONE = "We read this template and found no fill-in fields in it."

/**
 * We could not read it. Explicitly DISCLAIMS the reading, because the whole defect being
 * prevented is an author concluding their template is field-less when we never opened it.
 * It also says the attachment survives — a failed read is not a failed attach.
 */
export const TEMPLATE_FIELDS_UNAVAILABLE =
  "We could not read this template's fields. It is still attached — this says nothing about what is in it."

/**
 * The parser reads `word/document.xml` and its headers/footers ONLY, yet the upload door
 * accepts `.pptx` and `.xlsx` too — so two of the three accepted types would otherwise be
 * told they have no fields, which is a flat lie.
 *
 * ⚠ GATED ON EMPTINESS, which is what makes it drift-safe rather than a second copy of a
 * server predicate (the D-182-06 red line). It renders only when the server answered `ok`
 * with ZERO fields AND the filename is not `.docx`. If the backend ever learns `.pptx`, the
 * fields render and this sentence can never appear — it cannot go stale.
 */
export const TEMPLATE_FIELDS_NOT_WORD =
  "Fields can only be read from Word (.docx) templates, so we cannot say what this one asks for."

/**
 * Turn a thrown upload failure into the one sentence to show. The mapping IS the honesty
 * requirement: a status code shown at a person is not a failure state they can act on. 422
 * and 502 both relay the server's own sentence — 502's is a clean, non-traceback apology by
 * contract, and re-wording either here would be a second copy of a rule the server owns.
 *
 * ⚠ NOT EXPORTED, and the reason is mechanical rather than stylistic: a runtime FUNCTION
 * export beside a component is a `react-refresh/only-export-components` lint ERROR (measured
 * — the rule's `allowConstantExport` is why the string constants above are fine and this is
 * not; `ExternalActionSection.tsx:77` records the same measurement). Its four branches are
 * therefore driven through the rendered surface, which is the stronger test anyway: it proves
 * the sentence REACHES a person rather than that a pure function returned it.
 */
function templateErrorSentence(error: unknown): string {
  if (error instanceof WorkflowTemplateUploadError) {
    if (error.status === "network") return TEMPLATE_NETWORK_ERROR
    if (error.status === 404) return TEMPLATE_NOT_FOUND_ERROR
    return error.detail ?? TEMPLATE_REFUSED_FALLBACK
  }
  return TEMPLATE_NETWORK_ERROR
}

export interface TemplateAttachSectionProps {
  /**
   * The saved draft's row id — the `definition_id` the route is keyed on. `null` means the
   * draft has never been saved, which is a REAL state on a fresh build with the canvas flag
   * off (no autosave), and it is stated rather than rendered as a dead control.
   */
  definitionId: string | null
  /**
   * The attached template's filename, resolved by the caller off `definition.assets[]`.
   * ⚠ THIS COMPONENT KEEPS NO LOCAL MIRROR OF IT. The definition is the single source of
   * truth, so a successful attach becomes visible only once the caller's write lands — which
   * means the surface can never show a filename the definition does not carry.
   */
  filename?: string
  /**
   * The attached template's `asset_id`, resolved by the caller off `definition.assets[]` —
   * the SAME place `filename` comes from, so the two can never disagree about which document
   * is on screen. Absent when nothing is attached, which asks the server nothing.
   */
  assetId?: string
  /**
   * The descriptor the server returned, handed straight up. The caller appends it to
   * `definition.assets[]` and saves; this component performs no definition write and no save
   * (see the docblock: one writer on the JSONB).
   */
  onAttached: (asset: WorkflowTemplateAsset) => void
}

/**
 * ⚠ 200 (the step-panel port) — THE SHELL WEARS THE SHEET'S CARD SHAPE NOW. This section is
 * the sheet's `Files it starts from`, and the reference draws every group as a small-caps
 * outside label over an inset panel darker than the aside around it. Only the shape moved:
 * `TEMPLATE_SECTION_HEADING` still reads `The file this step fills in`, deliberately, because
 * that sentence says what the file is FOR and the sheet's does not.
 */
const SECTION_CLASSES = "mt-3 flex flex-col gap-1.5"

/** The sheet's inset panel — the same two class strings `StepCardSection.tsx` uses. */
const SECTION_BODY_CLASSES = "rounded border border-border bg-background p-3"

const SECTION_HEADING_CLASSES =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"
const FILENAME_CLASSES =
  "mt-1.5 flex items-center gap-1.5 text-[11px] leading-snug text-foreground"

/** The shipped amber refusal block — the one the governance dial and the pinned arming
 *  switch already use, so a refusal on this panel reads the same wherever it comes from. */
const REFUSAL_CLASSES = [
  "mt-[11px] rounded-[10px] border px-3 py-2.5 text-[12px] leading-[1.7]",
  "border-[hsl(38_92%_60%/0.34)] bg-[hsl(38_92%_60%/0.1)] text-[hsl(38_92%_78%)]",
].join(" ")

export function TemplateAttachSection({
  definitionId,
  filename,
  assetId,
  onAttached,
}: TemplateAttachSectionProps) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // Reset the control's value NOW, not after the request: picking the same file twice in
      // a row must re-fire `change`, and after a failed attach re-picking the corrected file
      // is the obvious next move.
      event.target.value = ""
      if (!file || definitionId === null) return
      setError(null)
      setBusy(true)
      try {
        const asset = await uploadWorkflowTemplate(definitionId, file)
        onAttached(asset)
      } catch (err) {
        setError(templateErrorSentence(err))
      } finally {
        setBusy(false)
      }
    },
    [definitionId, onAttached],
  )

  const attached = typeof filename === "string" && filename.length > 0

  // No attached template means no question to ask. The hook issues zero requests when
  // either argument is absent, so this is a real gate rather than a wasted round trip.
  const fieldsState = useTemplatePlaceholders(
    attached ? definitionId : null,
    attached ? assetId : undefined,
  )

  // D-7 — gated on EMPTINESS, never on the extension alone. A `.pptx` that somehow DID
  // yield fields renders its fields; this sentence exists only for the empty case, so it
  // can never become a stale second copy of the server's parser predicate.
  const notWord =
    fieldsState.kind === "none" && !(filename ?? "").toLowerCase().endsWith(".docx")

  return (
    <section
      data-rail="template"
      data-testid="rail-template"
      data-attached={attached ? "true" : "false"}
      className={SECTION_CLASSES}
    >
      <h3 className={SECTION_HEADING_CLASSES}>{TEMPLATE_SECTION_HEADING}</h3>
      <div className={SECTION_BODY_CLASSES}>

      {attached ? (
        <p data-testid="template-filename" className={FILENAME_CLASSES}>
          <span aria-hidden="true">📄</span>
          <span className="min-w-0 break-all">{filename}</span>
        </p>
      ) : (
        <p data-testid="template-none" className={NOTE_CLASSES}>
          {TEMPLATE_NONE_NOTE}
        </p>
      )}

      {/* The fields belong to the file named directly above, so they sit directly below it.
          ONE stable wrapper with a live role — the correct aria pattern for a late-settling
          fact, and it means one role rather than four competing announcements. The wrapper
          is present whenever a template is attached, even while the reading is `loading`,
          so assistive tech observes a change INSIDE a node it is already watching. */}
      {attached && (
        <div data-testid="template-fields-region" role="status">
          {fieldsState.kind === "loading" && (
            <p data-testid="template-fields-loading" className={NOTE_CLASSES}>
              {TEMPLATE_FIELDS_LOADING}
            </p>
          )}

          {fieldsState.kind === "fields" && (
            <>
              <p data-testid="template-fields-heading" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_HEADING}
              </p>
              {/* Names are ordinary React text children — escaped by construction. They
                  originate in a user-uploaded document and nothing here goes near
                  `dangerouslySetInnerHTML`. Rendered in the SERVER'S order, not re-sorted:
                  the order is part of the answer. */}
              <ul data-testid="template-fields" className={`${NOTE_CLASSES} list-disc pl-4`}>
                {fieldsState.fields.map((name) => (
                  <li key={name} className="break-all">
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* ⚠ THE TWO SENTENCES THAT MAY NEVER MERGE. `none` means we opened it and found
              nothing; `unavailable` means we never opened it. Different nodes, different
              words — a plant that renders one for the other turns a test red. */}
          {fieldsState.kind === "none" &&
            (notWord ? (
              <p data-testid="template-fields-not-word" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_NOT_WORD}
              </p>
            ) : (
              <p data-testid="template-fields-none" className={NOTE_CLASSES}>
                {TEMPLATE_FIELDS_NONE}
              </p>
            ))}

          {fieldsState.kind === "unavailable" && (
            <p data-testid="template-fields-unavailable" className={NOTE_CLASSES}>
              {TEMPLATE_FIELDS_UNAVAILABLE}
            </p>
          )}
        </div>
      )}

      {definitionId === null ? (
        // Refused, never a dead control — the 185 rule one section up: a control that could
        // never do anything is replaced by the sentence that states the fact.
        <p data-testid="template-unsaved" className={REFUSAL_CLASSES}>
          {TEMPLATE_UNSAVED_REFUSAL}
        </p>
      ) : (
        <>
          <label
            htmlFor={inputId}
            className="mt-2 block text-[11px] font-medium text-foreground"
          >
            {attached ? TEMPLATE_REPLACE_LABEL : TEMPLATE_ATTACH_LABEL}
          </label>
          {/* The NATIVE picker, on purpose: it is keyboard-reachable, it announces itself,
              and it needs no hidden-input-behind-a-button proxy to be either. */}
          <input
            id={inputId}
            type="file"
            data-testid="template-input"
            accept={TEMPLATE_ACCEPT}
            disabled={busy}
            onChange={(e) => void onPick(e)}
            className="mt-1 w-full text-[11px] text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-[11px] file:text-foreground hover:file:bg-accent/40"
          />
        </>
      )}

      {busy && (
        <p data-testid="template-uploading" role="status" className={NOTE_CLASSES}>
          {TEMPLATE_UPLOADING_NOTE}
        </p>
      )}

      {error !== null && (
        <p data-testid="template-error" role="status" className={REFUSAL_CLASSES}>
          {error}
        </p>
      )}

      <p data-testid="template-types" className={NOTE_CLASSES}>
        {TEMPLATE_TYPES_NOTE}
      </p>
      </div>
    </section>
  )
}

export default TemplateAttachSection
