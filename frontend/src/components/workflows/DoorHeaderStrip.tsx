/**
 * Phase 193-03 Task 1 (D-05 / D-08) — DoorHeaderStrip.
 *
 * THE GOVERN DOOR'S HEADER STRIP: the return control (`STRIP_BACK`), the current-door
 * label (`STRIP_LABEL_GOVERN`), and the judge badge. TWO props in, one callback out: it
 * owns no state, fetches nothing, reads no context and closes over nothing at module
 * scope — which is why the fragment could be lifted out of the door shell at all, and the
 * property the next author has to keep true.
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
 * ⚠ THAT BYTE-IDENTITY IS A FACT ABOUT COMMIT `2dbcd9f8`, NOT A LIVE PROPERTY OF THIS FILE.
 * `193-05` replaced this strip's two governed COPY literals with imports from
 * `doorVocabulary.ts` (D-10 / D-24(a)), so re-running that `sed`+`diff` today will NOT come
 * back empty and is not supposed to. The paragraph above is kept because it records how the
 * cut was verified when it was made; the move-proof that still binds LIVE is the DOM one —
 * `193-01`'s six whole-`innerHTML` captures and `WorkflowBuilderPage.header.test.tsx`'s
 * byte-exact band literal, both of which passed the 193-05 rewire with ZERO edits.
 *
 * ⚠ THE BODY BELOW STILL CARRIES THE INDENTATION IT HAD INSIDE THE `if` BLOCK rather than the
 * one a fresh file would give it. Re-indenting was the single tidy that would have made the
 * 193-03 diff non-empty, so it was not done. Not a style to copy into new code.
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
 * mechanical reason the door COPY went to a `.ts` leaf in `193-05` (D-10) rather than to a
 * `STRIP_COPY` const here — and adding one would put `eslint src/components/workflows/` back
 * where it started.
 *
 * ⚠ IT IS NO LONGER A ZERO-IMPORT LEAF, AND THAT IS THE 193-05 DESIGN RATHER THAN A SLIP.
 * It imports EXACTLY ONE module — `doorVocabulary.ts`, which itself imports NOTHING — so the
 * edge it adds is one hop into a data leaf and can never close a cycle. Its suite pins that
 * exact shape: the permitted import list is asserted as an EQUALITY, so a second import (or a
 * component sibling, or React) reds rather than slipping in behind a relaxed rule.
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
 *
 * ── 193-09 (D-03 / D-04) — THE RESTACK. WHAT CHANGED AND WHY ────────────────────────────
 *
 * Before this plan the return control, the current-door label and the locked-judge badge
 * rendered as THREE VISUAL PEERS: the escape hatch carried a rounded box and a 1px outline,
 * so it read with the same weight as the door you are standing in. SEED-147's operator could
 * not name "the other one", and that peer reading is the half of suspect #2 that COPY
 * PROVABLY CANNOT REACH — 193-08 re-worded every governed string on this surface and the
 * three still weighed the same. Hence D-03 putting a structural change in scope at all.
 *
 * D-04's shape, and it is now what this file renders:
 *
 *     ‹ escape  │  <current door>                       [locked-judge badge]
 *     └ no box, muted   └ primary            └ far edge, UNTOUCHED
 *
 * THREE PROPERTIES, each deliberate:
 *
 *  1. THE RETURN CONTROL LOST ITS BOX, NOT ITS NATURE. It is still a real focusable
 *     `<button type="button">` carrying the same testid and the same handler; only the
 *     rounding and the 1px outline are gone. It gains an underline-on-hover/focus-visible
 *     treatment borrowed from the shipped quiet text button on the Builder's own describe
 *     screen (`starter-door-trigger`), so removing the outline does not remove the focus
 *     affordance with it.
 *
 *  2. THE DIVIDER IS BORROWED, NOT INVENTED. It is `CanvasToolbar.tsx:212`'s decorative rule,
 *     verbatim — already in the token vocabulary, already `aria-hidden`, already used to
 *     separate groups in a toolbar strip. It carries NO testid on purpose: it is decoration,
 *     so it must contribute nothing to any accessible name. The suite asserts exactly that.
 *
 *  3. THE BADGE IS BYTE-UNTOUCHED — position, class conditional, `title` and text. D-04 is
 *     explicit that moving it is unnecessary: it is the one element already in the right
 *     place, and spending change budget on it would put the D-05 conditional at risk for
 *     nothing. The plan's own gate was a `git diff -U0` over this file matching NO line that
 *     names the badge, its testid, or the far-edge push class — which is also why the three
 *     paragraphs above name none of them either. ⚠ A criterion that greps a file for a token
 *     makes that token unusable in the file's OWN prose (the 187-24 trap, fired four times in
 *     this phase); the honest repair is to word around it and say so, never to weaken the gate.
 *
 * ⚠ THE SKETCH DRAWS NO MOCKUP OF THIS BAND, on either door. The pixel choices above are
 * Claude's discretion under CONTEXT, so the acceptance bar is UAT rows U3 (this strip) and
 * U3b (the describe door's band, demoted identically under D-22) — a human comparison, not a
 * generated contract. This is where sketch→build drift survives in Phase 193.
 *
 * ⚠ D-06 STAYS REJECTED. The return control did NOT move into the host-band slot that renders
 * only when `inline` is true — the standalone band would then have no way back at all, and an
 * author stranded on a screen is a worse defect than a busy strip (the 184.1 reasoning).
 */
import { STRIP_BACK, STRIP_LABEL_GOVERN } from "@/components/workflows/doorVocabulary"

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
        {/* ⚠ THE FIRST OF THE TWO `strip.back` SITES — the describe door's own band in
            `WorkflowDoorSwitch.tsx` carries the second, with an identical class list. Both
            render `STRIP_BACK`, and the D-24(a) fence sweeps BOTH sources (193-05). */}
        <button
          type="button"
          data-testid="both-doors"
          onClick={goBoth}
          className="px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
        >
          {STRIP_BACK}
        </button>
        {/* 193-09 (D-04): the divider, taken VERBATIM from `CanvasToolbar.tsx:212`. Decorative
            and hidden from assistive tech, and deliberately given no testid — it separates the
            escape from the current door and must contribute nothing to any accessible name. */}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
        <span className="text-[13px] font-medium text-foreground">{STRIP_LABEL_GOVERN}</span>
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
