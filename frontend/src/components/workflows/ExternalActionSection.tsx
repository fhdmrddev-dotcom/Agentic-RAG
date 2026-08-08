/**
 * Phase 189-14 Task 1 (CONN-01 / D-02 / D-15 / D-23, UI-SPEC §7a-§7b) —
 * ExternalActionSection: the capability picker for the 7th step type.
 *
 * ── WHY THIS IS ITS OWN FILE, AND THE PANEL GETS ONE GATED LINE ──
 * `PhaseFormPanel.tsx` is on the hot-file ledger and its row says, verbatim: *"Keep this
 * shape — the next surface that needs the panel gets its own component and one gated
 * line."* Phase 185 proved the shape at FOUR insertions in that panel's render body for a
 * whole governance feature (`GovernanceSection.tsx`, 321 L, mounted in one expression).
 * 189 is the next surface, so this file is `GovernanceSection.tsx`'s whole-file shape
 * copied deliberately, property by property, and the panel-side cost is one import plus
 * one gated JSX expression.
 *
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` (the heading
 * and the no-capability note) or from `phaseVocabulary` (the three capability labels).
 * Its suite asserts character-identity against those names, because a sentence that lives
 * inside a component is a sentence nobody can test for drift. This module imports nothing
 * from the API client, names no route and opens no request; a `?raw` fence in
 * `ExternalActionSection.test.tsx` proves it, with a positive control.
 *
 * ── D-23 · THE THREE OPTIONS ARE A CLIENT MIRROR, AND THE MIRROR IS FENCED ──
 * `PhaseFormPanel.tsx`'s tool-rail docblock states a rule that reads like it forbids this
 * component outright: *"THE OPTION SET IS THE SERVER'S… There is no frontend list of tool
 * ids here or anywhere upstream of here."* That rule is about the WHITELIST RAIL, whose
 * options arrive on `GroundingBundle.tools`, and D-20 deliberately keeps these three
 * capability names OFF that bundle — precisely so an author can never whitelist an
 * external capability onto an unarmed `llm_agent` step. So no shipped surface sources
 * these three a third way, and the exit taken is the one `definitionOps.PhaseTypeId`
 * already licenses: a CLIENT MIRROR of a backend `Literal`, justified as a *union mirror*
 * rather than as an options source. A new route and field for three constants is
 * infrastructure this phase does not need, and any server-supplied capability list is one
 * refactor away from being reused as an author-facing options source — which is the leak
 * shape 189-04 closed and `test_182_grounding_bundle.py`'s V22 guards.
 *
 * ⚠ THE ANTI-DRIFT GUARANTEE IS MECHANICAL, NOT EDITORIAL. A docblock claiming "this
 * mirrors `harness.py`" is a claim; the suite's cross-language fence is a check — it reads
 * `backend/app/models/harness.py` as raw source, extracts the `capability` Literal's
 * members, and asserts they equal `EXTERNAL_ACTION_CAPABILITIES` exactly. It was observed
 * RED against a planted mismatch before it was trusted.
 *
 * ── ONE CONSTANT READ TWICE, NEVER TWO COPIES ──
 * The picker's labels and the node face's sentences are the SAME
 * `EXTERNAL_CAPABILITY_SENTENCES` map (`phaseVocabulary.ts`), derived here rather than
 * re-typed. That is what makes "the row previews the card that lands" true by
 * construction instead of by review.
 *
 * ── THE RAW CAPABILITY ID NEVER REACHES THE DOM ──
 * The author reads sentences; the ids are wire values. Nothing here renders a capability
 * id as a value, a `data-` attribute or a test id, and `PhaseFormPanel.rails.test.tsx`
 * asserts the whole external-action panel's HTML contains none of the three — the D-20
 * boundary restated as an observable, so a capability can never be painted as an
 * author-fixable tool chip.
 *
 * A LEAF, not a wired surface: presentational and caller-driven. It reads no context,
 * fetches nothing, holds no store reference, and its only write is one capability name
 * handed back to the caller, which patches `config` through the panel's single seam.
 */
import { useId, useRef } from "react"

import {
  EXTERNAL_ACTION_HEADING,
  EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE,
} from "@/components/workflows/definitionOps"
import { EXTERNAL_CAPABILITY_SENTENCES } from "@/components/workflows/phaseVocabulary"
import { ConnectionPicker } from "./ConnectionPicker"

/**
 * The CLOSED client mirror of `ExternalActionPhaseConfig.capability`
 * (`backend/app/models/harness.py`), in the backend `Literal`'s own order.
 *
 * DERIVED from the one sentence map rather than re-typed, so the picker cannot offer a
 * name the node face has no words for, and a fourth entry cannot appear on one side
 * alone. A NAMED module-scope constant, never an inline literal at a use site — the
 * `GovernanceSection.DIAL_TYPES` form.
 *
 * ⚠ NOT EXPORTED, and the reason is mechanical rather than stylistic: a runtime export
 * beside a component is a `react-refresh/only-export-components` lint ERROR (measured —
 * `GovernanceSection.tsx` exports two components and two TYPES, and no const). The suite
 * therefore reads the mirror from its ONE home, `EXTERNAL_CAPABILITY_SENTENCES`, which is
 * the same object this line reads — so the cross-language fence still compares the
 * client's closed set against the server's `Literal`, and the source fence below it
 * proves THIS component derives from that constant rather than re-typing the three ids.
 */
const EXTERNAL_ACTION_CAPABILITIES: readonly string[] = Object.keys(
  EXTERNAL_CAPABILITY_SENTENCES,
)

export interface ExternalActionSectionProps {
  /** The step's stored `capability`, already resolved to a string by the caller.
   *  `""` (absent) and an UNRECOGNISED value both select NOTHING — see below. */
  capability: string
  /** The panel's config write seam. Receives the capability NAME, never a sentence. */
  onChange: (value: string) => void
  /** The panel's commit seam. Called after `onChange` because a set of rows has no
   *  blur event to hang the commit on, and the store's patch is synchronous. */
  onPersist: () => void
}

const SECTION_CLASSES = "col-span-2 rounded border border-border bg-muted/40 px-2.5 py-2"

const OPTION_LIST_CLASSES = "mt-1.5 flex flex-col gap-1"

const OPTION_BASE =
  "flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"

/** The chosen row. The dial's green is the panel's own "this is set" reading. */
const OPTION_SELECTED =
  "border-[hsl(142_71%_45%/0.4)] bg-[hsl(142_71%_45%/0.14)] text-foreground"

const OPTION_UNSELECTED = "border-border bg-card text-muted-foreground hover:text-foreground"

const MARK_BASE = "inline-block h-[9px] w-[9px] shrink-0 rounded-full border border-border"

const MARK_SELECTED = "bg-[hsl(142_71%_45%/0.75)]"

const MARK_UNSELECTED = "bg-transparent"

const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

export function ExternalActionSection({
  capability,
  onChange,
  onPersist,
}: ExternalActionSectionProps) {
  const headingId = useId()
  // ── REVIEW FINDING WR-04 · THE ROLE PROMISED A WIDGET THE OPTIONS DID NOT BEHAVE LIKE ──
  // The container declared `role="radiogroup"` and each option `role="radio"` with
  // `aria-checked`, but they were plain buttons: no tabIndex management and no onKeyDown.
  // The APG radio-group pattern requires ONE tab stop for the group with Arrow keys moving
  // the selection; a keyboard user got THREE tab stops and no arrow behaviour, so the ARIA
  // announced a widget that did not exist. `vitest-axe` cannot see this —
  // `aria-required-children` and `aria-checked` are both satisfied — which is why the
  // suite's a11y coverage passed straight over it.
  //
  // The review offered two shapes. The role is KEPT and the behaviour built, rather than
  // retracting to `aria-pressed` buttons in a `role="group"`: this genuinely IS a
  // single-choice group, `role="group"` would make no promise but would also describe it
  // less well, and every existing assertion in the suite (five `getByRole("radio")` call
  // sites plus the `radiogroup` case) stays true instead of being rewritten. This is the
  // first real radiogroup on the surface, so the pattern debt is paid at its start.
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  // DERIVED DURING RENDER. An unrecognised or absent stored value selects NOTHING and
  // NEVER fabricates a row — the picker half of the same rule `derivedFace` applies to
  // the node face, which falls through to the type sentence for exactly these values.
  const selected = EXTERNAL_ACTION_CAPABILITIES.includes(capability) ? capability : null

  const selectedIndex = selected === null ? -1 : EXTERNAL_ACTION_CAPABILITIES.indexOf(selected)

  /** Commit a row and move DOM focus onto it — APG "selection follows focus". */
  const choose = (index: number) => {
    const name = EXTERNAL_ACTION_CAPABILITIES[index]
    if (name === undefined) return
    optionRefs.current[index]?.focus()
    if (name === selected) return
    onChange(name)
    onPersist()
  }

  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = EXTERNAL_ACTION_CAPABILITIES.length - 1
    // Down/Right advance, Up/Left retreat, both WRAPPING — the APG default. Home/End are
    // the pattern's optional pair and are cheap enough to be worth having.
    let next: number | null = null
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    // Arrow keys inside a radiogroup must not also scroll the panel behind it.
    event.preventDefault()
    choose(next)
  }

  return (
    <section data-section="external-action" data-testid="external-action-section" className={SECTION_CLASSES}>
      <h3 id={headingId} className="text-[11px] font-medium text-foreground">
        {EXTERNAL_ACTION_HEADING}
      </h3>

      <div
        role="radiogroup"
        aria-labelledby={headingId}
        data-testid="external-action-options"
        className={OPTION_LIST_CLASSES}
      >
        {EXTERNAL_ACTION_CAPABILITIES.map((name, index) => {
          const chosen = name === selected
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={chosen}
              // ROVING TABINDEX (WR-04) — the group is ONE tab stop. The chosen row owns
              // it; with nothing chosen the FIRST row does, so the group is always
              // reachable and never traps three stops in the panel's tab order.
              tabIndex={chosen || (selectedIndex === -1 && index === 0) ? 0 : -1}
              ref={(el) => {
                optionRefs.current[index] = el
              }}
              data-testid="external-action-option"
              data-chosen={chosen ? "true" : "false"}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              onClick={() => {
                if (chosen) return
                onChange(name)
                onPersist()
              }}
              className={[OPTION_BASE, chosen ? OPTION_SELECTED : OPTION_UNSELECTED].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[MARK_BASE, chosen ? MARK_SELECTED : MARK_UNSELECTED].join(" ")}
              />
              <span className="min-w-0">{EXTERNAL_CAPABILITY_SENTENCES[name]}</span>
            </button>
          )
        })}
      </div>

      {selected !== null && <ConnectionPicker capability={selected} />}
      {/* Said ONLY when no row is selected — the empty/no-capability note by name
          (UI-SPEC §9d). A step with a capability chosen still sends nothing in 189, and
          that fact is carried where D-12 and D-16 put it: the canvas badge at design
          time and the run word at run time. Repeating it here would be the sentence that
          becomes a lie the day Phase 190 wires the node up. */}
      {selected === null && (
        <p data-testid="external-action-nothing-chosen" className={NOTE_CLASSES}>
          {EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE}
        </p>
      )}
    </section>
  )
}

export default ExternalActionSection
