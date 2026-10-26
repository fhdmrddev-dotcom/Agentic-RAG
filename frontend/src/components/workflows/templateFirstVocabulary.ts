/**
 * Phase 193.1-06 (AUTH-03) — EVERY WORD ON THE TEMPLATE-FIRST SURFACE THAT IS NOT ALREADY A
 * SHIPPED IDENTIFIER AND NOT A GOVERNED DOOR WORD.
 *
 * ── WHY THIS MODULE EXISTS AT ALL, RATHER THAN `doorVocabulary.ts` ────────────────────────
 * Two mechanical reasons, both measured rather than preferred:
 *
 *   1. **`doorVocabulary.ts` STRUCTURALLY CANNOT HOLD A MESSAGE FUNCTION.** The D-24(a) copy
 *      fence builds its needles by coercing every export of that module through
 *      `(value as string).replace(/&/g, "&amp;")`. A FUNCTION export lands in that expression
 *      and throws inside the needle builder — the fence does not merely fail, it errors before
 *      it can sweep anything. Two of the strings this surface needs state a DERIVED COUNT and
 *      are therefore functions, so they cannot live there. This is not a style call; it is what
 *      the fence's own implementation permits.
 *   2. **A runtime FUNCTION exported beside a COMPONENT is a `react-refresh/only-export-components`
 *      lint ERROR** (measured on two shipped files). So the functions cannot live beside the
 *      component that renders them either. A `.ts` vocabulary module is the only home left, and
 *      it is the shipped shape — `libraryVocabulary.ts` sits beside its surface exactly so.
 *
 * Exactly ONE id from this surface is GOVERNED and lives in `doorVocabulary.ts` instead:
 * `DESCRIBE_ATTACH_PROMPT` (D-21 / D-28). Everything else on the surface is here.
 *
 * ── THE RULE EVERY FUNCTION IN THIS FILE FOLLOWS ──────────────────────────────────────────
 * `libraryVocabulary.ts:146-148`, verbatim in force: *the interpolated half is DATA, and a
 * template assembled at the call site is a string that leaks out of this module's fences.* A
 * caller may pass a number; a caller may never assemble a sentence.
 *
 * ⚠ AND THE COUNT IS THE WHOLE POINT. `footingFields` takes a count as a PARAMETER because the
 * caller derives it from the list it renders. A hardcoded number beside a list of a different
 * length is the exact class of silent lie this phase exists to remove — an `8` above a list of
 * 5. The suite asserts each function's output actually CHANGES with its argument, so a function
 * that ignored its count could not pass.
 *
 * ── A TRUE LEAF ───────────────────────────────────────────────────────────────────────────
 * This module imports NOTHING — asserted, not documented, for the reason `doorVocabulary.ts`'s
 * own suite states: a zero-import leaf is what makes the surface's cycle risk one-directional.
 *
 * ⚠ NAME IDENTIFIERS, NEVER WORDS, IN EVERY COMMENT BELOW. This file is swept by the D-24(a)
 * RAW copy fence, prose included. A docblock QUOTING a governed door word is a second home for
 * it and reds the fence — which is the fence working, not misfiring.
 */

// ── 165-C · the pre-draft attach control ─────────────────────────────────────────────────

/**
 * `ctrl.note` — the sub-note under the control's prompt.
 *
 * ⚠ SHIPS EXACTLY AS SKETCH 165'S CONTRACT STATES IT, and D-28 explicitly re-confirmed it is
 * NOT reworded. It states the CONSEQUENCE, which is the whole reason this phase exists: without
 * it the control reads as a file upload that merely happens early, and SEED-157's defect
 * survives with a control on screen.
 */
export const ATTACH_NOTE =
  "Attach the document this should fill in — the draft is built to its fields."

/**
 * `spec.filenameLead` — the lead-in before the filename in the spec block (variant C only).
 *
 * Names the RELATIONSHIP rather than restating the file: the rail's own filename line answers
 * *what is attached*, this answers *what is it FOR*.
 */
export const SPEC_FILENAME_LEAD = "Drafting to"

// ── 166-B · the footing line — ONE line, five arms, five DISTINCT values ──────────────────
//
// ⚠ THE INHERITED RULE THAT BINDS ALL OF THESE, RESTATED ONE LEVEL DOWN. The shipped reading
// sentences carry a constraint in their own docblock: the `none` reading and the `unavailable`
// reading MAY NEVER MERGE. `none` is a fact about the DOCUMENT (we opened it and found
// nothing); `unavailable` is a fact about US (we never opened it). The consequence for the
// draft happens to be identical, which is exactly why the wording must not be — an author told
// "no fields" about a document nobody opened ships a workflow that fills nothing.
//
// The footings below inherit that constraint one level down, and the suite asserts the three
// no-fields sentences pairwise distinct BY NAME rather than trusting this comment.
//
// D-09: every arm has a footing, INCLUDING `loading`, so a control that is waiting can always
// say why. A control that is disabled and does not say why reads as broken.

/**
 * `footing.none` — the server read the document and it carries no fill-in fields.
 *
 * ⚠ THE CONTRACT CALLS THIS THE MOST IMPORTANT STRING ON THE PAGE, and the reason is
 * structural: SEED-158 measures the plain-language document as the COMMON case. Without this
 * line the author attaches a real document, reads a sentence about it, and is never told the
 * draft ignored it — SEED-157 recurring with a control on screen. It states the CONSEQUENCE
 * ("written from your description alone"), never merely the fact.
 */
export const FOOTING_NONE =
  "This template has no fill-in fields, so your draft will be written from your description alone."

/**
 * `footing.notWord` — two of the three accepted upload types cannot be read for fields at all.
 *
 * Separate from `FOOTING_NONE` for the same reason the shipped sentences are separate: telling
 * a slide-deck author their deck has no fields would be a flat lie.
 */
export const FOOTING_NOT_WORD =
  "We can only read fields from Word documents, so your draft will be written from your description alone."

/**
 * `footing.unavailable` — the read failed.
 *
 * ⚠ MUST NOT MERGE WITH `FOOTING_NONE`. See the block comment above; this is the one-level-down
 * mirror of the shipped rule, and it is asserted in the suite rather than trusted here.
 */
export const FOOTING_UNAVAILABLE =
  "We could not read this template's fields, so your draft will be written from your description alone."

/**
 * `footing.loading` — the read is in flight.
 *
 * D-09 requires this to ship WITH the in-flight arm rather than after it. It promises the draft
 * will be aimed at whatever the document asks for, which is the fact the author needs while
 * they wait.
 */
export const FOOTING_LOADING =
  "Reading the template — the draft will be built to whatever it asks for."

/**
 * `footing.fields` — the arm that STATES A COUNT.
 *
 * ⚠ A FUNCTION, AND THAT IS THE WHOLE REASON THIS MODULE EXISTS. The contract's own rule:
 * *in build it must be derived from the list rendered directly above it and never hardcoded. A
 * hardcoded 8 beside a list of 5 is exactly the class of silent lie this phase exists to
 * remove.* The caller passes the length of the list it just rendered — never a literal, never a
 * prop a caller could pass wrong — and the component's suite asserts the rendered number equals
 * the number of list items actually present.
 *
 * The singular arm is a DERIVED VARIATION, stated rather than smuggled: the contract's sentence
 * is written in the plural because its fixture has eight fields, and a document with exactly
 * one would otherwise render "these 1 fields". The plural branch is the contract's string
 * verbatim; only the number is substituted.
 */
export function footingFields(count: number): string {
  return count === 1
    ? "Your draft will be built to fill this 1 field."
    : `Your draft will be built to fill these ${count} fields.`
}

// ── D-06 · the bind failed after the draft was written ───────────────────────────────────

/**
 * The draft was built to fill a document, and binding that document to the saved workflow then
 * failed — so the workflow now expects a file it does not have.
 *
 * ⚠ IT CARRIES THE CONSEQUENCE, NOT ONLY THE FACT, and that is load-bearing rather than
 * sympathetic. Measured (RESEARCH §B): a deliverable step that expects a document and has none
 * bound fails at RUN time with `no_template_bound`, and that failure is TERMINAL. An author who
 * is told only "attaching failed" keeps a workflow that cannot complete and finds out at the
 * worst possible moment. So the sentence says what is now true of the draft and names the one
 * place the fix lives.
 *
 * Shaped as a FUNCTION for the module rule above: the filename is DATA.
 */
export function templateBindFailedMessage(filename: string): string {
  return `Your draft was written to fill “${filename}”, but the document could not be attached to it. The steps are saved — attach the document on the deliverable step to finish, or this workflow will stop when it runs.`
}

/** 296-07 (291-IN-08) — one bind failure: which kind of file, and its name (DATA only). */
export type BindFailure = { kind: "template" | "reference"; filename: string }

/**
 * 296-07 (291-IN-08) — the ONE sentence for every reference the bind could not attach, each
 * name quoted. Total: a single name is accepted as a one-item list.
 */
export function referencesBindFailedMessage(filenames: readonly string[] | string): string {
  const names = (Array.isArray(filenames) ? filenames : [String(filenames)]).map((f) => `“${f}”`)
  return `These files the draft was written from couldn't be attached to it: ${names.join(", ")}. The steps are saved and don't read these files when the workflow runs.`
}

/** 296-07 (291-WR-01) — why the file sections are disabled while the draft is being written. */
export const FILES_LOCKED_WHILE_COMPOSING = "Files can't be changed while the draft is being written."

/**
 * 296-07 (291-IN-03) — the lead line over the sentences the template bind could not place. The
 * UI-SPEC E template, with only `{n}` substituted (the `(s)` is kept verbatim).
 */
export function unplacedSentencesLead(n: number): string {
  return `${n} sentence(s) weren't found in the document, so no blank was made for them:`
}

// ── 167-C · the three-bucket NAME check ──────────────────────────────────────────────────
//
// ⚠ THREE BUCKETS, NEVER TWO — D-10's red line, not a preference. A field supplied when the
// workflow starts is not a gap: nothing produces it and nothing should. A two-bucket check
// lists those as problems, and an author told twice that a correct workflow is broken stops
// reading the panel entirely. Measured on the live corpus, the run-input bucket is not
// hypothetical.
//
// ⚠ AN EMPTY BUCKET RENDERS NO CLAIM (D-20, the 193 D-15 rule one surface later). An empty
// *produced* bucket must never read as "no step produces anything".

/**
 * `reconcile.heading` — the panel's heading.
 *
 * ⚠ REWORDED FROM THE APPROVED SKETCH UNDER D-27, and the original is left visible rather than
 * overwritten. Sketch 167-C read *"This draft was written before the template arrived"*, which
 * asserts an ORDER OF EVENTS THE DEFINITION CANNOT CARRY: measured across the live corpus there
 * is no field distinguishing a draft written before the document from one written to it. Under
 * D-19 this phase begins producing template-first drafts, on which that heading would be flatly
 * false. This heading states only what the panel actually puts side by side — a comparison —
 * and claims nothing about when either was authored.
 */
export const NAME_CHECK_HEADING = "What this template asks for, next to what these steps name"

/**
 * `reconcile.action` — the button.
 *
 * ⚠ ALSO REWORDED UNDER D-27. The sketch's *"Reconcile the steps with this template"* named an
 * act variant C DOES NOT PERFORM: the check is a pure client-side name comparison with no model
 * call and no write (D-12). This label names the operation the code truly performs.
 */
export const NAME_CHECK_ACTION = "Check the names against this template"

/**
 * `reconcile.disclaim` — SHIPS VERBATIM FROM THE SKETCH CONTRACT AND IS NOT OPEN.
 *
 * ⚠ THE SINGLE MOST IMPORTANT STRING ON THE SURFACE (D-10). Without it the panel asserts a
 * coverage verdict it CANNOT COMPUTE. Measured: at attach time the app has placeholder names,
 * phase slugs and declared run-input keys — a HEURISTIC. Only at run time does the coverage
 * check run over an actual emitted field map and produce a VERDICT. The copy may say that
 * nothing in the steps NAMES a field. It may NEVER say the document is uncovered.
 */
export const NAME_CHECK_DISCLAIM =
  "This is a name check, not a coverage check — a step may already gather a field under a different name. We cannot know until the workflow runs."

/** The bucket a field lands in when a step's own name matches it (D-20: phase slugs). */
export const BUCKET_PRODUCED = "produced by a step"

/** The bucket for fields supplied when the workflow starts (D-20: declared run-input keys). */
export const BUCKET_RUN_INPUT = "supplied as a run input"

/**
 * The remainder. ⚠ Worded as an observation about the STEPS, never as a verdict about the
 * document — "named nowhere" is a fact the app can check; "missing" or "uncovered" is not.
 */
export const BUCKET_NAMED_NOWHERE = "named nowhere"

/**
 * `reconcile.runInputNote` — THE FALSE-ALARM GUARD, beside the run-input bucket.
 *
 * ⚠ A FUNCTION because it states a COUNT, under the same rule as `footingFields`. The singular
 * arm is again a derived variation: the contract's sentence is plural because its fixture has
 * two, and one run input would otherwise render "1 more are supplied".
 */
export function nameCheckRunInputNote(count: number): string {
  return count === 1
    ? "1 more is supplied when the workflow runs, so it needs no step."
    : `${count} more are supplied when the workflow runs, so they need no step.`
}

/**
 * `reconcile.showAll` — D-11's cap: show the first few rows per bucket and expand IN PLACE.
 *
 * ⚠ A FUNCTION for the same reason. ⚠ And D-20 measured that this cap will fire on essentially
 * every real document, so it is a primary path rather than an edge: on the live corpus, zero
 * step names match any placeholder name, which puts every field in one bucket.
 */
export function showAllLabel(count: number): string {
  return `Show all ${count}`
}

// ── 291 · Surface 1 · the form slot (UI-SPEC copy, verbatim) ─────────────────────────────
//
// The slot takes a FORM (a PDF or a Word document with blanks) as well as a `{{ }}` template.
// The rail's own label, types note and filter are not changed (UI-SPEC decision 3): these are
// the door's. Server-sourced sentences (couldn't place, cut short, copy refused) are NOT here —
// they are rendered as received.

/** The slot's picker label. */
export const DESCRIBE_FORM_ATTACH_LABEL = "Attach a form or template"

/** What the slot accepts, in words. */
export const DESCRIBE_FORM_TYPES_NOTE =
  "A form (PDF or Word) or a template (.docx, .pptx or .xlsx), up to 10 MB."

/** The slot's native filter. */
export const DESCRIBE_FORM_ACCEPT = ".pdf,.docx,.pptx,.xlsx"

/** The read is in flight, for any kind of file. */
export const DESCRIBE_READING = "Reading this document…"

/** The in-flight footing. */
export const FOOTING_READING_DOCUMENT =
  "Reading the document — the draft will be built to whatever it asks for."

/** A form's fields heading — on the door, and on the rail when the bound file is a PDF. */
export const FORM_FIELDS_HEADING = "What this form asks for"

/** Provenance: the form DECLARES these fields. */
export const FORM_PROVENANCE_EXACT = "Read from the form's own fields."

/** Provenance: the AI named them, from the form's text. */
export const FORM_PROVENANCE_SUGGESTED_TEXT = "Suggested by AI from the text of this form."

/** Provenance: the AI named them, from a reading of a scan. */
export const FORM_PROVENANCE_SUGGESTED_SCAN = "Suggested by AI from a reading of this scan."

/** The tag on an AI-named field. Provenance, not a verdict. */
export const FIELD_SUGGESTED_TAG = "suggested"

/** What a run does with a fillable PDF. The filename is DATA. */
export function formBackLinePdf(filename: string): string {
  return `Answers go into this form's own fields. Each run hands back ${filename}, filled in.`
}

/** A PDF with no fillable fields: the answers cannot be written onto it (SEED-368 case 4). */
export const FORM_BACK_FLAT =
  "This PDF has no fillable fields, so runs can't write the answers onto it."

/** The Word placement list's heading (D-27). */
export const PLACES_HEADING = "Where each answer goes"

/** …and its provenance, which also says what a tick does. */
export const PLACES_PROVENANCE =
  "Suggested by AI from the blanks in this document. Untick any blank it shouldn't fill."

/** The real-DOM marker after an unticked line. The row renders the space before it. */
export const PLACE_STAYS_BLANK = "· stays blank"

/** What a run does with a Word form. The filename is DATA. */
export function formBackLineWord(filename: string): string {
  return `Answers are written into a copy of ${filename}. Your original isn't changed.`
}

/** The footing for AI-suggested fields: the draft ASKS for them (it cannot fill the file). */
export function footingAsks(count: number): string {
  return count === 1
    ? "Your draft will ask for this 1 field."
    : `Your draft will ask for these ${count} fields.`
}

/** D-02 — opened, and nothing to fill: the file is used as a reference. */
export function noFieldsLine(filename: string): string {
  return `No fields found in ${filename}, so it's used as reference only.`
}

/** The footing for a file used as a reference. */
export const FOOTING_REFERENCE_ONLY =
  "Your draft will be written from your description, using this document as a reference."

/** D-08 — a scan nothing could be read from. Shared by the slot and the references. */
export const SCAN_UNREADABLE =
  "Couldn't read this scan. It stays attached, but the draft can't use what's in it. To use it, type what matters into your description."

/** The footing when the file cannot inform the draft. */
export const FOOTING_WITHOUT_IT = "Your draft will be written without it."

/** A PDF we could not read — a fact about US, never about the document. */
export const FORM_UNAVAILABLE =
  "We couldn't read this form. It's still attached — this says nothing about what's in it. To try again, remove it and attach it once more."

/** …and its footing. */
export const FOOTING_FORM_UNAVAILABLE =
  "We couldn't read this form, so your draft will be written from your description alone."

/** The input a type word is computed from: a field's type and, for a choice, its options. */
export type FieldTypeInput = { type: string; enum_options?: readonly string[] | null }

/**
 * ONE formatter for a field's type word, on the door and on the arrival card alike.
 *
 * `enum` whose options are exactly yes and no (case-insensitive) reads `yes / no`; any other
 * `enum` reads `choice of {n}`. Accepts the type alone too, so a caller holding only a type
 * string gets the same word.
 */
export function fieldTypeWord(input: FieldTypeInput | string): string {
  const type = typeof input === "object" && input !== null ? input.type : String(input)
  const options = typeof input === "object" && input !== null ? (input.enum_options ?? []) : []
  if (type !== "enum") return type
  const lower = options.map((o) => o.toLowerCase())
  if (lower.length === 2 && lower.includes("yes") && lower.includes("no")) return "yes / no"
  return `choice of ${options.length}`
}

// ── 291 · Surface 2 · the references section (UI-SPEC copy, verbatim) ───────────────────
//
// The interpolated half is DATA (a filename, a list of names, a server sentence); the words
// around it live here. The server's sentence is passed through whole, never re-worded.

/** The section's question. */
export const REFS_PROMPT = "Anything it should read first?"

/** The section's note — what they are for and where they are kept. */
export const REFS_NOTE =
  "Up to 5 documents. The draft uses what's in them to write its steps. They're kept with this workflow, not added to your Library."

/** The picker label. */
export const REFS_LABEL = "Add a reference"

/** The count beside the picker label. */
export function refsCount(count: number): string {
  return `· ${count} of 5`
}

/** The references' native filter. */
export const REFS_ACCEPT = ".pdf,.docx,.txt,.md"

/** What the section accepts, in words. */
export const REFS_TYPES = "PDF, Word or text (.pdf, .docx, .txt or .md), up to 10 MB each."

/** At the limit — and the reason the disabled picker gives. */
export const REFS_FULL = "5 of 5. Remove one to add another."

/** A row's remove control, visibly. */
export const REFS_REMOVE = "Remove file"

/** …and its accessible name, which names the file. */
export function refsRemoveLabel(filename: string): string {
  return `Remove ${filename}`
}

/** A reference being read. */
export const REFS_READING = "Reading…"

/** A reference read whole. */
export const REFS_READ_FULL = "Read in full."

/** A reference whose read got no answer — the file stays. */
export function refsSendFailed(filename: string): string {
  return `Couldn't send ${filename}. Check your connection, then add it again.`
}

/** A refused file with no server sentence to relay. */
export const REFS_REFUSED_FALLBACK =
  "That file couldn't be read. Add a PDF, Word or text file under 10 MB."

/** The read door declined a file the author picked; `sentence` is the server's own. */
export function refsRefused(filename: string, sentence: string): string {
  return `Couldn't add ${filename}. ${sentence}`
}

/** A multi-pick that did not fit in the five places (D-03). Each name is DATA. */
export function refsOverflow(...names: string[]): string {
  return `Only 5 references fit, so these weren't added: ${names.join(", ")}.`
}

/** The same name and size as a file already held. */
export function refsDuplicate(filename: string): string {
  return `${filename} is already added.`
}

/** While any file reads — the reason the CTA waits (Pitfall 11). */
export const REFS_FOOTING_READING =
  "Reading your files — you can write the draft once they're read."

/** A STRUCTURAL claim about what files can do (D-17): never a claim that a file is fine. */
export const REFS_POWERS =
  "Files can shape the steps. Only your description and the services you tick can add actions."

/** Orchestrator decision 3: the files survive a reload only from the first autosave. */
export const REFS_KEEP =
  "Your files are kept once the draft is first saved. Leave this page before then and you'll need to add them again."
