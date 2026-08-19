import { useId } from "react"

import type { AuthorModelRow } from "@/lib/api"

import {
  EMIT_TIER_ORDER,
  modelFitnessTechnical,
  modelFitnessWord,
  resolveEmitTier,
  type EmitTier,
} from "./modelFitness"

/**
 * Phase 196 Plan 05 (AUTH-04 — D-04 … D-15) — the step's model picker.
 *
 * AUTH-04 in one sentence: *a user selects the model for a step from the live model
 * registry, rather than typing a model name or slug by hand.* Until this component the
 * four `AI model` inputs in the phase form were free-text fields validated by nothing —
 * a typo produced a workflow that looked saved and failed at run time, and a retired
 * model looked exactly like a working one.
 *
 * ── IT IS A PURE FUNCTION OF ITS PROPS. NO COMPONENT STATE. NO EFFECT. NO FETCH. ─────
 *
 * That is not a style preference, and it is the property everything below depends on:
 *
 *   • It mounts FOUR times inside one panel. A component that fetched its own rows would
 *     fetch four times every time a person clicked a step. The registry read is a
 *     panel-level concern and lives one level up, in `useModelRegistry`.
 *   • ⚠ A component with no effect CANNOT fire a write when it is opened. D-07 requires
 *     that opening the form never rewrites a stored value as a side effect of being
 *     looked at — viewing a workflow is not editing it — and here that is a GUARANTEE
 *     rather than an accident. Both shipped pickers in this repository have the same
 *     property by luck: they persist only inside their own select handler, so nobody had
 *     to decide it. This one is fenced on its own source, with a positive control, in
 *     `ModelField.test.tsx`.
 *
 * The only two write paths are the `<select>`'s own change event and its blur. There is
 * no third, and there is no code path that can reach either without a user gesture.
 *
 * ── WHY IT DOES NOT IMPORT THE PANEL'S LABEL PRIMITIVE ───────────────────────────────
 *
 * `PhaseFormPanel` owns a small `FieldLabel` used by every field it renders, and this
 * component renders the SAME two-audience structure: the label with its grey qualifier
 * and its ⓘ (the precise technical term, on hover / as an accessible name), then an
 * always-visible plain-English `help` sentence underneath. It is not imported, for a
 * structural reason: the panel is about to import THIS module, so an import back the
 * other way would make the pair a genuine ESM cycle. The seam is the panel's two
 * audiences, not the panel's function — and a later change to that label's markup must
 * be mirrored here, which the rendered assertions in this file's suite pin.
 *
 * ── THE COPY RULES THIS FILE IMPLEMENTS, AND WHAT EACH REFUSES ───────────────────────
 *
 * D-04 · Blank stays the empty string on the wire. Nothing here migrates a stored value
 *        and no persisted shape changes; `""` means *inherit*, exactly as it always did.
 *
 * D-05 · Blank is a NAMED leading option, never an empty slot. An unlabelled first row
 *        reads as a missing value; this one says what it does.
 *
 * D-06 · ⚠ The hedge is IN THE LABEL, and there is deliberately NO always-on footer
 *        naming a default. Both shipped pickers carry one, and on this surface it would
 *        be a lie: a run inherits whatever model STARTED it, which is knowable at run
 *        time and not while somebody is authoring. So the label names what the server
 *        resolved TODAY, and when the server resolved nothing it degrades to the bare
 *        sentence — never to a guessed id, and never to a house model written into this
 *        file. (The three real candidates measured on this tree do not agree with each
 *        other, which is the whole argument for computing the value server-side.)
 *
 * D-07 · A disabled model is never offered, but a stored one is KEPT as `(current)`.
 * D-08 · An unknown model is kept the same way and NAMES its consequence in user words.
 *        Saving is NOT blocked: an operator retiring a registry row must not make every
 *        existing workflow unsaveable.
 *
 * D-12 · Fitness is annotated on the DELIVERABLE step only (`showFitness`). On the other
 *        three step types the tier predicts nothing about the outcome, and a warning that
 *        predicts nothing trains people to ignore the ones that do.
 *
 * D-15 · Engine words never become user words. The tier token appears only under the ⌥
 *        Technical-names reveal, and only on the GROUP LABEL — the option text stays the
 *        bare model id, so what a person picks is never ambiguous between the two
 *        audiences.
 *
 * ── WHY GROUPING RATHER THAN A PER-OPTION SUFFIX ─────────────────────────────────────
 *
 * A native `<option>` cannot render markup — no chip, no mark, no second line — so a
 * "badge" would be a text suffix either way. Grouping buys something a suffix cannot: a
 * weakest-tier model can never sit ADJACENT to a strongest-tier one, so the distinction
 * survives inattention instead of requiring a person to read every row. That is also why
 * this file imports nothing from the icon seam: a mark cannot live inside an `<option>`
 * at all, and if one is ever wanted it comes from `@/lib/providerLogo` and sits outside
 * the control.
 */
export interface ModelFieldProps {
  /** The stored `cfg.model`. `""` means *inherit the run's model* (D-04). */
  value: string
  /** Fired by the `<select>`'s own change event, and by nothing else. */
  onChange: (v: string) => void
  /** Fired on blur, matching every other field in the panel. */
  onPersist: () => void
  /** The live registry union — the six-field AUTHOR projection, fetched ONCE by an owner
   *  above the panel. Never the operator row: `deprecated_reason` and the seven other
   *  operator-only fields are structurally unreachable from here. */
  models: AuthorModelRow[]
  /** The model a run would ACTUALLY inherit, resolved server-side. `null` when the chain
   *  resolved nothing — an honest absence, which degrades the label rather than guessing. */
  runDefaultModel: string | null
  /** D-12 — true on the deliverable step mount only. */
  showFitness?: boolean
  /** The ⌥ Technical-names reveal, threaded from the panel's existing flag. */
  showTechnical?: boolean
  disabled?: boolean
  /**
   * Phase 199-06 (DES-01, sheet `c4-phase-form-panel`) — THE READING THAT PRODUCED NO ROWS.
   *
   * ⚠ WHY THIS PROP EXISTS AT ALL, stated because its absence was a recorded defect rather
   * than an oversight. `useModelRegistry` has resolved THREE readings since Phase 196 —
   * `loading`, `ready` and `unavailable` — and this component took only rows. So the caller
   * had exactly two moves on a failed read, and it correctly chose the less dishonest one:
   * pass `models: []` and render a calm, correct-looking picker that has silently removed
   * every model a person could choose, or pass nothing and REMOVE the field. It removed the
   * field, and wrote the cost down at its own mount: *"`ModelField` cannot express 'I could
   * not read the registry' — it takes rows, not a reading — and widening it is 196-05's
   * file, not this plan's."* The hot-file ledger carries the same line. This is that widening.
   *
   * ABSENT ⇒ the answer arrived, and every branch below runs exactly as it shipped.
   * PRESENT ⇒ there are no rows to speak of, and `models` is not consulted AT ALL — the
   * early return happens above the first line that reads it, so "a failed read rendered as
   * an empty-but-fine picker" is not reachable through this component (T-199-06-01).
   *
   * ⚠ `loading` AND `unavailable` ARE SEPARATE MEMBERS AND MUST STAY SO. "Still asking" and
   * "we asked and could not be answered" are different facts, and a control that says
   * *failed* while a request is in flight is a lie that arrives roughly once per page load.
   *
   * ⚠ AND NEITHER OF THEM IS AN EMPTY SUCCESSFUL READ. A registry that answered and offers
   * nothing is a THIRD thing, rendered by the normal path with `REGISTRY_EMPTY` below. The
   * three are compared against this explicit value, never against emptiness or truthiness —
   * the rule `runFacts.ts` learned the hard way and `modelFitness.ts` states twice.
   */
  noAnswer?: "loading" | "unavailable"
}

/** The leading option's sentence. The clause is appended only when the server resolved
 *  something to name. */
const INHERIT_LABEL = "Use the run's model"

/** What an unknown stored model means for the person looking at it, in their words: the
 *  step will still run, and the guarantee they might have expected is not available. */
const UNKNOWN_CAPTION =
  "not in the registry — forced emission unavailable, document steps run best-effort"

/**
 * 199-06 — THE THREE SENTENCES FOR THE THREE READINGS THAT ARE NOT "here are your models".
 *
 * They live here, at module scope beside `INHERIT_LABEL` and `UNKNOWN_CAPTION`, because THIS
 * FILE IS ALREADY THIS PICKER'S WORDS' HOME. `modelFitness.ts` owns the TIER vocabulary and
 * holds nothing else on purpose; adding read-state copy to it would make a second thing true
 * of a module whose whole discipline is doing one. No fourth vocabulary is created.
 *
 * ⚠ THE FAILED-READ SENTENCE IS THE SHIPPED ONE, ONE FIELD UP, WITH ITS SUBJECT CHANGED.
 * `ToolWhitelistRail`'s degraded arm in `PhaseFormPanel.tsx` says *"We couldn't load the
 * tools this step is allowed to use. Nothing is offered here rather than a list that would
 * be wrong."* That is the same situation — a server-owned option set that could not be read
 * — sitting two fields away on the same form, and it is the project's locked language for
 * it. Sheet c4 draws this arm in its danger colour; the SHIPPED precedent spends no colour
 * on a failed read of an options source, and two adjacent failed-read reports in different
 * colours would be the real inconsistency. The disagreement is reported, not silently
 * resolved: see `199-06-SUMMARY.md`.
 */
const REGISTRY_UNAVAILABLE =
  "We couldn't load the list of models. Nothing is offered here rather than a list that would be wrong."

/** Still asking. ⚠ Emphatically NOT the sentence above — see `noAnswer`'s docblock. */
const REGISTRY_LOADING = "Loading the list of models…"

/** The THIRD reading: the server answered, and there is genuinely nothing to offer. */
const REGISTRY_EMPTY = "This workspace offers no models for this step."

/** What the step already names, printed on a failed read so it never looks like a wipe.
 *  Sourced from `value` — the STORED string — and never from `models`, which is exactly
 *  what makes it safe to render in a branch where no rows arrived. */
const currentlyNames = (value: string) => `This step currently names: ${value}.`

export function ModelField({
  value,
  onChange,
  onPersist,
  models,
  runDefaultModel,
  showFitness,
  showTechnical,
  disabled,
  noAnswer,
}: ModelFieldProps) {
  const id = useId()

  const hint =
    "model — the registry id this step runs on. Blank inherits whatever model started the run."

  // ── 199-06: THE READING THAT PRODUCED NO ROWS ─────────────────────────────────────
  //
  // ⚠ THIS RETURN IS DELIBERATELY THE FIRST STATEMENT AFTER THE HOOK, AND ITS POSITION IS
  // THE MITIGATION, not a style choice. Every line below it reads `models`; returning here
  // means a failed read cannot reach the retention branch, so it can never label a perfectly
  // registered stored model `(current) — not in the registry` and invite someone to change
  // it. Move this down and that lie becomes reachable again (T-199-06-01).
  //
  // The comparison is against the EXPLICIT value — never the row array's length and never
  // its truthiness, either of which would fold the honest empty registry in with the failed
  // read, which is the whole defect this branch exists to stop.
  //
  // ⚠ THE FORBIDDEN FORMS ARE DESCRIBED HERE AND NOT SPELLED, because this file's suite
  // greps its own source for them: a comment naming the needle is COUNTED BY the fence that
  // hunts it — the 187-24 trap, which this very paragraph hit on its first draft and turned
  // that fence red.
  if (noAnswer !== undefined) {
    return (
      <div data-testid="model-no-answer" data-reading={noAnswer}>
        {/* ⚠ NOT a `<label>`. There is no control to point at, and a label with a dangling
            `for` announces a form field that does not exist. The two-audience structure is
            otherwise identical to the labelled arm below, ⓘ included — the technical term
            stays reachable precisely when the plain answer is missing. */}
        <div className="flex items-center text-[11px] font-medium text-foreground">
          <span>AI model</span>
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          <span
            tabIndex={0}
            role="button"
            aria-label={hint}
            title={hint}
            className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            ⓘ
          </span>
        </div>
        <p
          role="status"
          data-testid="model-no-answer-note"
          className="mt-0.5 text-[11px] leading-snug text-muted-foreground"
        >
          {noAnswer === "unavailable" ? REGISTRY_UNAVAILABLE : REGISTRY_LOADING}
        </p>
        {/* A failed read is not a wipe — the shipped `tools-degraded` arm's own rule. The
            string comes from `value`, so this line is true without any row having arrived. */}
        {value !== "" && (
          <p
            data-testid="model-no-answer-current"
            className="mt-1 text-[10.5px] leading-snug text-muted-foreground"
          >
            {currentlyNames(value)}
          </p>
        )}
      </div>
    )
  }

  // ── The option set ────────────────────────────────────────────────────────────────
  // Offerable = ENABLED only. A DEPRECATED row stays offered and selectable: deprecated
  // is an advisory, not a removal, and the engine will still run it. Only `enabled ===
  // false` takes an option away.
  //
  // First occurrence wins on a duplicate id, so the tier a model is grouped under is
  // stable rather than dependent on where the union happened to put the second row.
  const tierById = new Map<string, EmitTier>()
  for (const row of models) {
    if (!row.enabled) continue
    if (!tierById.has(row.model_id)) tierById.set(row.model_id, resolveEmitTier(row.emit_tier))
  }
  const offered = Array.from(tierById.keys()).sort((a, b) => a.localeCompare(b))

  // ── What is stored but not offerable ──────────────────────────────────────────────
  // ONE branch covers D-07 and D-08, because they are one situation: the stored value is
  // not in the offered list. Only the SUFFIX differs, and it differs by whether the
  // registry knows the id at all.
  const retained = value !== "" && !tierById.has(value) ? value : null
  const retainedIsUnknown = retained !== null && !models.some((m) => m.model_id === retained)

  const inheritLabel = runDefaultModel
    ? `${INHERIT_LABEL} — today that would be ${runDefaultModel}`
    : INHERIT_LABEL

  const groupLabel = (tier: EmitTier) =>
    showTechnical ? `${modelFitnessWord(tier)} · ${modelFitnessTechnical(tier)}` : modelFitnessWord(tier)

  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-center text-[11px] font-medium text-foreground"
      >
        <span>AI model</span>
        <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        <span
          tabIndex={0}
          role="button"
          aria-label={hint}
          title={hint}
          className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          ⓘ
        </span>
      </label>
      {/* ⚠ 199-06 (DES-01) — THE `help` LINE THAT SAT HERE IS CUT, not folded. It read
          "Leave blank to use the run's model." directly above a control whose FIRST OPTION
          reads "Use the run's model" — a sentence restating the control's own visible text,
          which is the strongest form of the duplication SEED-184 names. Every other helper
          in this panel moved behind the density ceiling's one switch; this one needed no
          disclosure at all, because the surviving copy is inside the thing the person is
          already reading. The ⓘ above still carries the precise technical term.
          Its absence is asserted at BOTH readings in `PhaseFormPanel.test.tsx`. */}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onPersist}
        className={[
          "w-full rounded border border-border px-2 py-1.5 text-[12px] focus:border-primary focus:outline-none",
          disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-card text-foreground",
        ].join(" ")}
      >
        <option value="">{inheritLabel}</option>
        {retained !== null && (
          <option value={retained}>
            {retainedIsUnknown
              ? `${retained} (current) — not in the registry`
              : `${retained} (current)`}
          </option>
        )}
        {showFitness
          ? EMIT_TIER_ORDER.map((tier) => {
              const ids = offered.filter((m) => tierById.get(m) === tier)
              if (ids.length === 0) return null
              return (
                <optgroup key={tier} label={groupLabel(tier)}>
                  {ids.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              )
            })
          : offered.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
      </select>
      {retainedIsUnknown && (
        <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{UNKNOWN_CAPTION}</p>
      )}
      {/* 199-06 — THE THIRD READING, and the one that makes the other two honest. Without a
          sentence here, "the registry answered and offers nothing" and "the registry could
          not be read" would both render as a picker holding only its inherit option, and
          the failed-read arm above would be distinguishable only by its own absence of a
          control. Two different facts must read differently on screen, not just in the
          props. Gated on the OFFERED set being empty, which is a fact about the answer that
          did arrive — never about whether one arrived at all. */}
      {offered.length === 0 && (
        <p
          data-testid="model-registry-empty"
          className="mt-1 text-[10.5px] leading-snug text-muted-foreground"
        >
          {REGISTRY_EMPTY}
        </p>
      )}
    </div>
  )
}
