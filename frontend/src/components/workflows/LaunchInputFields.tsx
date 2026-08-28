import type { EntryInputField } from "@/components/workflows/soulData"
import { ARG_OPTIONAL_MARK, ARG_REQUIRED_MARK } from "@/components/workflows/argumentVocabulary"

/**
 * Phase 214-12 (STEP-02 / D-214-04) — THE ONE declared-input field renderer.
 *
 * Extracted from `library/RunModal.tsx`, whose plan `214-09` identified this exact seam and
 * deliberately did NOT take it, on the stated ground that *an extraction with one consumer is
 * not an extraction*. That reason stopped holding the moment the chat launch became a second
 * live consumer (and the schedule modal a third shape of the same ask), and plan `214-09` named
 * this plan as its re-open trigger. This is the discharge.
 *
 * ── WHAT TRAVELLED WITH THE CODE, AND WHY IT HAD TO ──
 *
 * ⚠ TWO ARMS, NEVER THREE. An AUTHORED label is prose a human wrote → it renders in the body
 * face. A key with NO label renders the KEY, in the mono face. **Absence renders the key, never
 * a fabricated friendly name.** A definition that authors `inputs[]` carries
 * `InputFieldSpec.label` (a REQUIRED `str` on `backend/app/models/harness.py:504`) and that
 * label is what the first arm prints. A definition that declares only the bare
 * `PhaseSpecJSON.input_keys` (`harness.py:73` — a plain `list[str]`) has no label anywhere, on
 * the wire or off it, and inventing a friendly sentence for it would be fabricating an author's
 * words. That is the whole of the second arm.
 *
 * ⚠ THE RULE LIVES HERE BECAUSE THE CODE DOES. It sat in a docblock inside `RunModal.tsx` until
 * this plan; a rule separated from the code it governs is a rule nobody applies, so it moved with
 * the JSX and `RunModal.tsx` keeps a one-line pointer at the old site.
 *
 * ── WHAT THE CALLER MUST HAND IN ──
 *
 * ⚠ `fields` MUST BE `launchInputFields(def)`, NEVER `entryInputFields(def)`. The latter's last
 * arm falls back to a single `kickoff_prompt` row for a definition that declares nothing —
 * correct as an answer to *"what is declared?"*, wrong as a form. That key is in
 * `RESERVED_RUN_INPUT_KEYS` (`backend/app/models/message.py`) and BOTH kickoff merge sites STRIP
 * a launcher-supplied copy, so a form drawn from it would give every workflow in the product a
 * text box whose value the server discards on arrival — `BUG-260826-01` one layer up. The type
 * is the same either way (`EntryInputField[]`), so the compiler cannot tell the two apart; only
 * this sentence and the callers can.
 *
 * ── THE EMPTY ARM IS THIS COMPONENT'S PROPERTY, NOT EACH CALLER'S ──
 *
 * A `fields` array of length 0 renders `null`, not an empty region. That is what makes *"a
 * definition declaring no inputs launches exactly as it does today, with no new screen"* one
 * fact in one place rather than a discipline three launchers each have to remember.
 *
 * ── IT IS A LEAF, AND THAT IS FENCED ──
 *
 * No hooks, no state, no fetching, no provider reads. It renders what it is handed and reports
 * what changed. `LaunchInputFields.test.tsx` asserts that against the stripped source, so a
 * future edit that reaches for shared state fails a test rather than passing review.
 *
 * ⚠ NO RUNTIME `export const` BESIDE THIS COMPONENT — that is a
 * `react-refresh/only-export-components` lint ERROR on this directory (measured in
 * `ExternalActionSection.tsx`). Constants belong in a vocabulary module, not here.
 *
 * ⚠ NO REQUIRED-NESS IS VALIDATED, deliberately, on any launcher. The publish gate (`214-05`)
 * already refuses a workflow whose `ask` key is undeclared; a launcher that blocked on an empty
 * optional field would refuse a run the system can perform. An empty field sends an empty string
 * and the executor's schema is the arbiter.
 *
 * ── 214.1-01 (STEP-02) — REQUIREDNESS IS NOW SHOWN, AND STILL NOT ENFORCED ────────────
 *
 * `InputFieldSpec.required` (`bool = True`) has always travelled inside
 * `WorkflowDefinition.inputs`; `soulData`'s read-shape threw it away, so all three doors drew
 * a required field and an optional one identically. `entryInputFields` now carries it and this
 * component renders it as a MARK, from `argumentVocabulary`'s SHIPPED `ARG_REQUIRED_MARK` /
 * `ARG_OPTIONAL_MARK` rather than a third copy of the words the argument form already says.
 *
 * ⛔ AND THE CONFIRM CONTROL IS STILL NOT BLOCKED — the paragraph above stands, and this one
 * says WHY it stands rather than leaving the omission to look like an oversight:
 *
 *   1. Blocking would change the contract of THREE shipped launch doors from Phase 214 (the
 *      library Run modal, the chat launch form, the schedule form) in a plan that ships a mark.
 *   2. Nothing silently succeeds today. The SMTP adapter and the publish gate BOTH fail closed
 *      on an empty required argument, so an empty box produces a refusal that names itself —
 *      not a run that quietly does the wrong thing.
 *   3. A client-side block would be a second copy of a server predicate (D-182-06), and the
 *      weaker copy: this component cannot see the action's schema.
 *
 * ⚠ RE-OPEN TRIGGER, recorded here rather than in a plan file: **the next phase that touches a
 * launcher's confirm control takes the block.** At that point the change is one place and the
 * mark is already rendered; today it would be three doors and a new refusal vocabulary.
 *
 * ⚠ THE MARK IS AN ADDITION, NOT A THIRD ARM. The label/key rule above is untouched and the
 * label reading is still the FIRST span inside the `<label>`; the mark follows it.
 */
export function LaunchInputFields({
  fields,
  values,
  onChange,
}: {
  /** The definition's declared launch inputs — `launchInputFields(def)`. */
  fields: EntryInputField[]
  /** The ONLY source of a rendered value. Nothing else may seed a field. */
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  if (fields.length === 0) return null
  return (
    <div data-testid="run-inputs" className="flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          {/* ⚠ THE MARK SITS OUTSIDE THE `<label>`, AND THAT PLACEMENT IS THE WHOLE POINT.
              An input WRAPPED by a label takes the label's entire text content as its
              ACCESSIBLE NAME — so a mark rendered inside it produced `"Recipient emailRequired"`,
              which turned `RunModal.test.tsx`'s *"an AUTHORED label IS the accessible name"* red.
              That was a REAL accessibility regression, not a stale pin: the field's name would
              have stopped being the author's words, which is this component's whole contract.

              ⛔ `aria-hidden` on the mark was the cheaper fix and is REFUSED: it would keep the
              name clean by making requiredness a sighted-only signal, which is the same class of
              dishonesty the two-arm rule exists to prevent. So the label OWNS the name and the
              mark is a DESCRIPTION, announced after it by any AT that reads `aria-describedby`.

              ⚠ The id is derived from the key rather than from `useId`, deliberately: this is a
              fenced LEAF with no hooks at all, and `f.key` is unique within a definition. Only
              one launch form is ever on screen at a time (three doors, none concurrent). */}
          {/* ⚠ THE `<label>`'S OWN CHILDREN ARE UNCHANGED — face span, then input, in that
              order and with nothing between them. Three shipped cases read the face as
              `input.parentElement.querySelector("span")` and one reads it as
              `input.previousElementSibling`, so the span and the input MUST stay direct
              siblings under the label. Both shapes were driven; both went red when they were
              not. */}
          <label className="flex flex-col gap-1">
            {f.label ? (
              <span className="text-[13px] font-medium text-foreground">{f.label}</span>
            ) : (
              <span className="font-mono text-[13px] font-medium text-foreground">{f.key}</span>
            )}
            <input
              type="text"
              aria-describedby={`run-field-mark-${f.key}`}
              data-testid={`run-input-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {/* ⚠ ABSENT reads REQUIRED — `InputFieldSpec.required` is `bool = True`, and
              `entryInputFields` already normalised that. This renders the answer; it does not
              re-derive it. */}
          <span
            id={`run-field-mark-${f.key}`}
            data-testid={`run-field-mark-${f.key}`}
            className="text-[11px] text-muted-foreground"
          >
            {f.required === false ? ARG_OPTIONAL_MARK : ARG_REQUIRED_MARK}
          </span>
        </div>
      ))}
    </div>
  )
}
