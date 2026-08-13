/**
 * Phase 193-03 Task 1 (D-05 / D-08) — DoorHeaderStrip.
 *
 * THE GOVERN DOOR'S HEADER STRIP: the `‹ both doors` return control, the door label, and the
 * `🔒 judge always-on` badge. TWO props in, one callback out: it owns no state, fetches
 * nothing, reads no context and closes over nothing at module scope — which is why the
 * fragment could be lifted out of the door shell at all, and the property the next author has
 * to keep true.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * the docblock and the `doorGroup` fragment below were CUT out of `WorkflowDoorSwitch.tsx`
 * (they were declared there at `:145-175`, inside `if (door === "govern") { … }`, before the
 * 193-03 plan — measured at the phase base `4ae3194a`, not inherited from any document). It is
 * a HARD CUT: `WorkflowDoorSwitch.tsx` declares `doorGroup` no more and NO re-export shim was
 * left behind; it imports this component and renders it at BOTH sites — its own bordered band
 * and the Builder's merged row via `headerTrail`. The body moved byte-for-byte with its
 * docblock and every inline comment intact — nothing re-typed, nothing tidied, nothing
 * re-ordered, no Prettier pass over the moved span — and the move was PROVED rather than
 * asserted: the span `sed`'d out of the pre-move blob and the same span `sed`'d out of this
 * file `diff` EMPTY.
 *
 * ⚠ THAT PROOF IS WHY THE BODY BELOW CARRIES THE INDENTATION IT HAD INSIDE THE `if` BLOCK
 * rather than the one a fresh file would give it. Re-indenting is the single tidy that would
 * have made the diff non-empty, so it was not done. Not a style to copy into new code.
 *
 * ⚠ THE REFERENCES INSIDE THE MOVED DOCBLOCK POINT AT THE PRE-MOVE FILE, not at this one: it
 * speaks of "this shell's own band" and "the merged row", which are `WorkflowDoorSwitch.tsx`
 * and `BuilderHeaderBar.tsx`. Kept as shipped, for the same reason.
 *
 * THE `ml-auto` CONDITIONAL IS THE WHOLE RISK OF THIS MOVE (D-05), and its mechanical cause is
 * one grep away: `BuilderHeaderBar.tsx:53` already wraps `trail` in
 * `<div className="ml-auto flex shrink-0 items-center gap-2">`, so a second `ml-auto` inside
 * that already-right-aligned group would open a gap between the label and the badge. It stays
 * spelled as a CONCATENATION onto the class string — never two `className` branches — so the
 * non-inline result is character-for-character the class list that shipped, which is exactly
 * what `WorkflowBuilderPage.header.test.tsx`'s byte-exact band literal holds.
 *
 * THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.
 * `react-refresh/only-export-components` is an ACTIVE error in this repo (`FlowEdge.tsx:135`
 * still carries one), so a component module may not export a shared runtime value. That is the
 * mechanical reason the door COPY goes to a `.ts` leaf in `193-05` (D-10) rather than to a
 * `STRIP_COPY` const here — and adding one would put `eslint src/components/workflows/` back
 * where it started.
 *
 * These paragraphs are kept honest by machine, not by habit. `DoorHeaderStrip.test.tsx` reads
 * this file's SOURCE through Vite's `?raw` loader and forbids it from naming a
 * `WorkflowDoorSwitch` specifier in ANY import form — static, type-only, re-export or dynamic,
 * in BOTH the bare and the `.tsx`-suffixed spelling (`allowImportingTsExtensions: true` makes
 * the suffixed one compile and resolve). The reason is a live cycle, not tidiness:
 * `WorkflowDoorSwitch` imports THIS component's VALUE at module scope, so an import back would
 * close an ESM cycle that typechecks clean, lints clean and fails only at RUNTIME as a TDZ
 * `ReferenceError` in whichever module a caller reached first — the shape 188.1 proved on
 * `WorkflowCanvas`. That fence was observed RED against two real plants in this file, one per
 * spelling, and this file restored md5-identical after each.
 */

export interface DoorHeaderStripProps {
  /** Return to the "both doors" chooser. This is the shell's own `goBoth` — the handler never
   *  changes hands, the strip only calls it (D-184.1-02, unchanged by the move). */
  onBack: () => void
  /** Drawn inside the Builder's merged header row instead of this door's own bordered band.
   *  The ONLY branch that reaches a class list — see the `ml-auto` paragraph above. */
  inline?: boolean
}

export function DoorHeaderStrip({ onBack: goBoth, inline }: DoorHeaderStripProps) {
    /**
     * Phase 184.1-01 — the door group, declared ONCE and drawn either in this shell's own
     * band (today) or in the Builder's merged row (`inline`). `goBoth` never changes hands:
     * the button keeps closing over this component's state wherever the node is rendered,
     * which is what makes the merge a re-flow rather than a refactor (D-184.1-02).
     *
     * `ml-auto` is dropped ONLY when inline: in this shell's own band it is what pushes the
     * judge badge to the far edge, but inside the merged row's already-right-aligned trailing
     * group it would open a gap between the label and the badge. Concatenated so the non-inline
     * string is character-for-character the class list that shipped.
     */
    const doorGroup = (
      <>
        <button
          type="button"
          data-testid="both-doors"
          onClick={goBoth}
          className="rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          ‹ both doors
        </button>
        <span className="text-[13px] font-medium text-foreground">🔧 Author &amp; govern</span>
        <span
          data-testid="judge-locked"
          title="The llm_judge_rubric output-quality judge is the publish gauntlet's hard wall — it runs on EVERY tier and cannot be switched off (TIERS.judgeAlwaysOn)."
          className={`${inline ? "" : "ml-auto "}inline-flex items-center gap-1 rounded-full border border-accent-violet/40 bg-accent-violet/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase text-accent-violet`}
        >
          <span aria-hidden="true">🔒</span> judge always-on
        </span>
      </>
    )

    return doorGroup
}
