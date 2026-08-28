import type { EntryInputField } from "@/components/workflows/soulData"

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
        <label key={f.key} className="flex flex-col gap-1">
          {f.label ? (
            <span className="text-[13px] font-medium text-foreground">{f.label}</span>
          ) : (
            <span className="font-mono text-[13px] font-medium text-foreground">{f.key}</span>
          )}
          <input
            type="text"
            data-testid={`run-input-${f.key}`}
            value={values[f.key] ?? ""}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
      ))}
    </div>
  )
}
