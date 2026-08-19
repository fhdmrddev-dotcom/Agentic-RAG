/**
 * Phase 188.2-05 Task 1 (D-04) — NodeCornerMarks.
 *
 * THE TWO CORNER MARKS, AND WHY THEY SHARE ONE MODULE. The server's verdict mark on the
 * card's LEFT edge (184-08, moved left by 185-01) and the ⛨ governance seal at the card's
 * TOP-RIGHT (185-09) live together because they are ONE decision, not two: the card has
 * exactly two free corners and two claimants with different lifespans, and the argument
 * that settles which claimant gets which corner has to be readable from both marks at
 * once. That is D-04's "one reason to change" — a later phase that wants a corner is
 * editing THIS file, and it will find the argument it has to answer sitting beside the
 * code it wants to move. The status ring and the 3D well are a different reason and live
 * in `NodeRunOverlay.tsx` and `NodeIconWell.tsx`; one omnibus module mixing three phases'
 * ownership is precisely what D-04 forbids.
 *
 * PURELY PRESENTATIONAL, LIKE THE CARD IT CAME OUT OF. Two props in, no callback out, no
 * context read, no state owned, nothing fetched, nothing closed over at module scope —
 * and, per D-184-06, NOTHING imported from the canvas graph library. Both props arrive
 * ALREADY DERIVED: `verdict` is a server severity reduced to one of three mark kinds by
 * `verdictModel.markFor` before it ever reaches the card (VALID-03 / D-182-06), and
 * `grounded` is resolved by a shared client rule. This module derives neither, and it
 * must never start — that is red line D-14.
 *
 * WHAT 185 FILLED, stated literally so this paragraph does not drift either: plan
 * 185-09 added ONE slot, `grounded`, and renders it as the corner seal at top-right
 * plus a border reinforcement — no new layout constant, no new badge. Badge slot 1
 * stayed EMPTY on purpose: SPEC Req 6 says governance spends no colour and no
 * word-badge slot, so the freed slot went to 188 / 189 and the governance reading is
 * made of SHAPE instead.
 *
 * ⚠ AND THE FREED SLOT IS NOW SPENT (189-15). 188 declined its claim — its channel is the
 * ring's geometry plus a sentence in the body — and 189 filled slot 1 with the
 * state-conditional "Not connected" word-badge (D-12 / D-18). **THE ARGUMENT ABOVE IS
 * UNCHANGED, AND IT IS THE HALF THAT HAD TO SURVIVE THIS EDIT:** governance still spends NO
 * colour and NO badge slot, and the badge 189 added is not a governance mark — it says a
 * step is wired to nothing yet, not that a step must prove itself. Nothing in this module
 * changed to carry it: the tuple is built by the `PhaseNode` adapter and arrives through the
 * card's existing `badges` prop. What HAS changed is that there is no spare slot left to
 * reach for — both are taken and a third is a typecheck error against `BadgeSlots` — so a
 * future governance reading cannot become a chip even by accident.
 *
 * WHAT 184-08 CHANGED, stated literally so this docblock does not drift: the `verdict`
 * slot is now RENDERED — a corner mark on the card's left edge (it landed on the right
 * in 184-08 and was moved by 185-01; see the mark's own docblock). (This sentence used
 * to end "…while `status` and `stepNumber` are still declared and still render nothing",
 * which 188-06 made false for the first of the two; `stepNumber` alone still holds.)
 * The seam worked exactly as D-184-06 intended: filling it was a change to
 * `PhaseNodeCard`'s body and to nobody else's contract. The card is still the wrong
 * place to ask what a verdict MEANS: the value arrives already reduced to one of three
 * states by `verdictModel.markFor`, which reads the server's `severity` and derives none
 * of it (VALID-03 / D-182-06).
 *
 * ⚠ BOTH PARAGRAPHS ABOVE ARRIVED HERE FROM `PhaseNodeCard.tsx:27-32` AND `:43-52` IN THE
 * 188.2-06 CUT — relocated rather than re-argued (D-01, the prose travels WITH its code).
 * They are the card's own account of what filled these two corners, and after the cut the
 * card holds neither block; leaving them in its header would have left it narrating code
 * that is not in the file. The only edit is the pronoun: "this component's body" became
 * "`PhaseNodeCard`'s body", because "this component" now means `NodeCornerMarks`.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future.
 * **AT THIS COMMIT THE CARD STILL DECLARES ITS OWN COPIES OF BOTH BLOCKS AND IMPORTS
 * NEITHER.** 188.2-05 is ADDITIVE by design, which is the split 188.1 proved: create
 * additively, then cut. The three ranges below — `PhaseNodeCard.tsx:410-434` (the verdict
 * derivation), `:567-599` (the verdict mark) and `:601-656` (the seal) — were moved here
 * VERBATIM, docblocks and inline comments and `⚠` paragraphs and all, so their span
 * `diff` against the pre-move card is EMPTY and the phase reads as a MOVE under
 * `git diff --numstat` rather than as a rewrite a reviewer would have to re-derive.
 * `188.2-06` owns the HARD CUT: it deletes the card's copies, leaves NO re-export shim,
 * and renders `<NodeCornerMarks>` at the byte-identical JSX site.
 *
 * ⚠ THE VERDICT BLOCK STAYS ABOVE THE SEAL BLOCK, AND THE SEAL KEEPS ITS TERNARY.
 * `PhaseNodeCard.test.tsx`'s `sealJsxBlock` carves the seal's JSX out of the subtree
 * source by two literal string anchors and THROWS when it cannot find them. It walks
 * BACKWARDS from the seal's test id to the nearest guard opener, and its own docblock
 * says that is safe because it "cannot latch onto the verdict mark's structurally
 * identical block above it" — a sentence that is true only while that order holds. So
 * rewriting the seal as an early `if (!grounded) return null` is not a style choice here,
 * it is a hard failure; and swapping the two blocks silently changes what a shipped fence
 * measures. Both constraints are recorded HERE because the next editor meets them at edit
 * time, not at review time.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED COMMENTS POINT AT THE PRE-MOVE
 * `PhaseNodeCard.tsx` (measured 797 L at `42b42cb7`), never at this file. Kept stale ON
 * PURPOSE — a move that renumbered its own prose would stop being a move.
 *
 * THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.
 * `react-refresh/only-export-components` errors for exactly that: it is what
 * `FlowEdge.tsx:147` and `BuilderStoreProvider.tsx:45, 53, 78` error for today, and those
 * four errors are the whole of this directory's lint count. One `export const` here takes
 * `eslint src/components/workflows/` from 5 back to 6 and silently undoes 188.1's only
 * measurable lint win. Type-only exports are exempt (measured: `PhaseNodeCard.tsx`
 * exports six types and contributes zero errors), which is why the props interface below
 * is exported and nothing else is.
 *
 * NOT WRAPPED IN A RE-RENDER CACHE, DELIBERATELY. An extraction is only worth trusting if
 * it changed nothing, and a render-skipping wrapper changes WHEN this subtree renders —
 * an unmeasured behaviour change on the surface whose whole promise is "renders
 * identically". `PlaneEditingLayer.tsx`, 188.1's own output and the shape this file
 * copies, is unwrapped for the same recorded reason. `FlowEdge.tsx:134`'s import of the
 * render-skipping wrapper is explicitly NOT the analog to copy.
 *
 * These paragraphs are kept honest by machine, not by habit. `PhaseNodeCard.test.tsx`
 * reads this file's SOURCE through the 188.2-01 subtree fence — an `import.meta.glob`
 * `?raw` sweep whose path list already named `./NodeCornerMarks.tsx` before this file
 * existed — so the SEVENTEEN negative scope fences that guarded this code inside the card
 * now read it here rather than quietly covering fewer lines than they did yesterday. A
 * second fence in the same suite forbids this module from naming a `PhaseNodeCard`
 * specifier in ANY import form (static, dynamic or type-only): after the cut the card
 * references these components as VALUES at module scope, so an import back would close a
 * live ESM cycle — which typechecks clean, lints clean, and fails only at RUNTIME as a
 * TDZ `ReferenceError` in whichever module a caller reaches first. And the suite's
 * no-focusable-control walk reaches this JSX, because neither mark may ever carry a
 * control of any kind: one tab stop per node is a canvas-level invariant.
 */
import { GOVERNANCE_SEAL_LABEL } from "@/components/workflows/definitionOps"
import { VERDICT_MARK, type VerdictMarkKind } from "@/components/workflows/nodePresentation"
import { own } from "@/components/workflows/ownProperty"
import { cn } from "@/lib/utils"

export interface NodeCornerMarksProps {
  /** The server's verdict for this step, ALREADY reduced to one of three mark kinds one
   *  function away (`verdictModel.markFor`). Absent means the server returned no problem
   *  and the transient mark renders nothing at all.
   *
   *  Typed as `VerdictMarkKind` rather than as the card's `NodeVerdictMark` alias: the
   *  two are the same type (`phaseNodeCardContract.ts:125`), and taking it from the table
   *  module the mark is looked up in keeps this file's import list at the four the fences
   *  expect. */
  verdict?: VerdictMarkKind
  /** Whether the step is grounded — resolved by a shared CLIENT rule rather than by the
   *  server (185-09). It is the ONLY thing the seal block reads: no run reading, no
   *  selection, no run phase. A `?raw` props fence pins that mechanically. */
  grounded?: boolean
}

/**
 * The two marks, and the one structural reason they look the way they do.
 *
 * THE DESIGN ARGUMENT IS NOT REPEATED HERE — IT MOVED WITH THE CODE. Both blocks below
 * carry their own multi-paragraph JSX comments, unedited, and those comments ARE the
 * argument: the lifetime rule that gives the permanent mark a corner and relocates the
 * transient one, the `stepNumber` graze recorded as a residual, the reason governance is
 * made of SHAPE rather than of colour or of a word-badge, the 17px derivation, the
 * documented sketch-143-B fallback, and the rule that the seal is NEVER conditional on
 * run state. D-01 says a comment moves with the code it explains; lifting those
 * paragraphs up here would have made the span `diff` non-empty and turned a move into a
 * rewrite for no gain, so they stayed exactly where they were written.
 *
 * WHAT THIS DOCBLOCK ADDS is the one sentence the card never had to say, because inside
 * the card it was obvious: NEITHER MARK IS A CONTROL. Both are `pointer-events-none`,
 * neither carries a role, a tab index or a handler, and that is a canvas-level invariant
 * rather than a local taste — one tab stop per node, enforced at both levels
 * (`WorkflowCanvas.test.tsx`'s per-node walk and this suite's leaf-level mirror, which
 * now reads this file). Arming and escalating happen in the panel; the canvas is where
 * you SEE, never where you SET (sketch 147).
 *
 * AND ONE MEASUREMENT ABOUT THE LOOKUP. `own(VERDICT_MARK, verdict)` is WR-04 sink 4, and
 * its guard is not ceremony: the falsification in `PhaseNodeCard.test.tsx` rendered an
 * EMPTY mark and was observed RED before the guard was written. That falsification drives
 * through the CARD, whose copy still exists at this commit; `188.2-06` re-verifies it
 * keeps passing AND keeps reaching the moved code.
 */
export function NodeCornerMarks({ verdict, grounded }: NodeCornerMarksProps) {
  // ⚠ THIS COMMENT USED TO OPEN BY CLAIMING THE LOOKUP WAS TOTAL "by construction"
  // (WR-04 site 4, corrected 188.1-04). It was not — and the literal phrase is
  // paraphrased here rather than quoted because this plan's acceptance grep asks the
  // tree whether the false claim still exists, and a quotation of it would answer yes. `VERDICT_MARK` is a plain object literal, so it INHERITS
  // `constructor`, `toString`, `__proto__` and friends; `VERDICT_MARK["constructor"]` is
  // the `Object` FUNCTION — never nullish, so the `?? VERDICT_MARK.unknown` provably did
  // not fire, and the three reads below (`.className`, `.glyph`, `.label`) each came back
  // `undefined`. MEASURED, not argued: the falsification in `PhaseNodeCard.test.tsx`
  // rendered an EMPTY mark and was observed RED before this guard was written. A node
  // nobody could check then rendered as a mark with no glyph and no accessible name at
  // all — strictly worse than the "checked-and-clean" failure the sentence below warns
  // about. `verdict` is a SERVER SEVERITY read verbatim one function away, so the slot's
  // type is a statement about the current callers; totality is a property of the lookup
  // (`lib/phaseState.ts:65-75`, the house argument).
  //
  // The slot is typed, and a forward-compat value arriving from a caller falls back to
  // the degraded mark rather than to nothing. Falling back to NOTHING would render a node
  // nobody could check as a checked-and-clean one.
  //
  // (The word this sentence used to spell for "nobody could check" is on SPEC Req 7's
  // banned list, and 185-09's acceptance grep is file-wide rather than scoped to
  // rendered strings. The meaning is unchanged — `VERDICT_MARK.unknown` is exactly the
  // "we could not check" state — so the rewording costs nothing and lets the grep
  // return 0 honestly instead of carrying a documented exception forever.)
  const mark = verdict ? (own(VERDICT_MARK, verdict) ?? VERDICT_MARK.unknown) : null

  return (
    <>
      {/* The server's verdict mark, on the card's LEFT edge (D-185-17 / SPEC Req 6).
          THE REASON IS LIFETIME, NOT TASTE. The card has exactly two free corners and
          two claimants with different lifespans. The governance seal is a PERMANENT
          property of the step — it is true of the step whether or not anything has run,
          and it was verified at all four run states in sketch 143-A — so it keeps the
          top-right corner, which SPEC Req 6 CLAIMS for it. A verdict only exists once
          the server has returned a problem, so the TRANSIENT mark is the one that
          moves. The permanent mark keeps its corner; the transient one relocates.

          RESIDUAL, recorded rather than discovered later: the moved verdict grazes the
          `stepNumber` slot by 2×16px (verdict x −8…14 / y 6…28 against 137-B's
          `.stepn` at x 12…34 / y 12…34). That is not a collision today because the slot
          RENDERS NOTHING — D-183-07 keeps `phase_index` off the face. If `phase_index`
          is ever brought to the face, move the step number to `left:16` and the graze
          clears. `PhaseNodeCard.test.tsx`'s occupancy block pins both halves.

          It is `pointer-events-none` and carries no control of any kind: one tab stop
          per node is a canvas-level invariant, and a pressable mark would make it
          two. */}
      {mark ? (
        <span
          data-testid="canvas-node-verdict"
          data-verdict={verdict}
          className={cn(
            // ⚠ `-left-2 top-1.5` → `left-[-1px] top-[50px]` AT THE PHASE 200 CANVAS PORT,
            // and BOTH axes moved for reasons worth separating.
            //
            // THE X IS THE SAME DECISION RE-DERIVED. The mark STRADDLES the card's left
            // border, so it is centred ON that border. The border used to sit 6px in from
            // the node box ((260 − 248) / 2) and a 22px mark centred there started at
            // 6 − 11 = −5, which `-left-2` (−8) approximated. The card is now 240 wide, so
            // the border sits at 10 and the mark starts at 10 − 11 = −1. Spelled exactly
            // rather than rounded to a spacing step, because the whole point of the mark is
            // WHICH LINE it straddles.
            //
            // ⚠ THE Y MOVED BECAUSE THE TOP-LEFT CORNER IS NO LONGER FREE, and this was
            // found by the occupancy check rather than by eye. Sketch 200 puts the step's
            // mark INSIDE the card in a left gutter, and the run ring is now drawn around
            // it at 11…45 on both axes. A verdict left at `top-1.5` (6…28) would have
            // overlapped that ring by 10×17px — a real collision between two rendered
            // marks, which is exactly what criterion 23 forbids and what the zero-overlap
            // assertion caught. 50 puts it clear below the ring (45) in the same gutter,
            // still straddling the same border, still nowhere near the top-right corner
            // SPEC Req 6 claims for governance.
            //
            // It overhangs the Builder card's 72px floor by 0px and the run card's 84px
            // floor not at all (50 + 22 = 72), which is the tightest of the three fits and
            // is why the number is 50 and not 52.
            "pointer-events-none absolute left-[-1px] top-[50px] z-[8] grid h-[22px] w-[22px]",
            "place-items-center rounded-full text-[11px] font-bold leading-none",
            mark.className,
          )}
        >
          <span aria-hidden="true">{mark.glyph}</span>
          <span className="sr-only">{mark.label}</span>
        </span>
      ) : null}

      {/* ── THE GOVERNANCE SEAL (GOVERN-02 · SPEC Req 6 · sketch 143-A) ───────────
          THE CORNER IS CLAIMED. Top-right of the card belongs to governance and to
          nothing else. 185-01 moved the verdict mark to the card's LEFT precisely to
          free it, and Phases 188 (run state) and 189 (external actions) may not take
          it back. ⚠ BOTH HAVE NOW SHIPPED AND NEITHER TOOK IT: 188 spends the ring and
          the run line, 189 spends badge slot 1 — the corner is still governance's, and
          this file is byte-unchanged in code by either of them. See the verdict mark's
          block above for why the PERMANENT mark keeps a corner and the TRANSIENT one moves.

          THE SEAL IS LOAD-BEARING; THE EDGE IS REINFORCEMENT. Governance may spend
          neither colour (137-B banks all of it for Phase 188's run status) nor a
          word-badge (both slots are now SPENT — slot 2 "Waits for you", slot 1 "Not
          connected" since 189-15, and a third is a typecheck error), so the mark is made of
          SHAPE. It carries its OWN background and its OWN border, which is the whole
          reason it works: when a step goes running / needs-you / failed the status
          colour overwrites the card border, and the seal stays legible anyway. The
          reading degrades from two carriers to one; it never disappears.

          THEREFORE IT IS NEVER CONDITIONAL ON RUN STATE. This block reads `grounded`
          and nothing else — no `status`, no selection, no run phase. Hiding, dimming
          or moving it mid-run would delete the reading at exactly the moment a person
          most needs it. `PhaseNodeCard.test.tsx` pins that mechanically, twice: a
          `?raw` props fence proving this block never names the run-state prop, and a
          four-value render asserting the seal's class list and text are IDENTICAL
          across every run state.

          THE OFFSET, AND WHY BOTH NUMBERS CHANGED AT THE PHASE 200 PORT. The previous
          reasoning is kept verbatim because the METHOD is unchanged and only its inputs
          moved: "Sketch 143-A places the seal `top: 11px; right: 11px` inside the 248px
          CARD. This element is a sibling of the verdict mark, so its containing block is
          the 260px NODE BOX, whose right edge sits 6px outside the card's border
          ((260 − 248) / 2). 11 + 6 = 17 keeps the sketch's 11px clearance from the border
          the reader actually sees … `top-[11px]` needs no such correction: the card's top
          edge IS the node box's top edge."

          BOTH INPUTS MOVED. The card is now 240px wide (sketch 200's own node width), so
          the node box overhangs it by (260 − 240) / 2 = 10 per side rather than 6. And
          sketch 200 places its own corner mark at a 4px inset (`top-xs right-xs`) rather
          than 143-A's 11px, on a card less than a third as tall. So: 4 + 10 = 14 for the
          right, and 4 flat for the top, which still needs no correction because the card's
          top edge is still the node box's top edge. The test asserts the CLEARANCE FROM
          THE CARD'S RIGHT BORDER rather than the composite, exactly as before, so this
          arithmetic cannot drift away from the number the sheet locked.

          ⚠ THE MARK ITSELF IS UNCHANGED — still a 21px ringed ⛨ with its own border and
          its own background, not sketch 200's bare 14px glyph. That is deliberate: 185's
          whole argument for this shape is that the seal must SURVIVE the border being
          overwritten by selection or by run state, and it survives precisely because it
          carries its own two carriers. A bare glyph would degrade to one. The sheet moved
          the mark; it did not re-argue what governance costs.

          THE DOCUMENTED FALLBACK is sketch 143-B — a stitched rail outside the card's
          border, which survives run status intact rather than degrading to one
          carrier. If the seal alone reads too quiet in live use, that is a SWAP, not a
          redesign: this block is replaced, and nothing else here moves.

          It is `pointer-events-none` and carries no control of any kind — no role, no
          tab index, no handler. One tab stop per node is a canvas-level invariant, and
          a pressable seal would make it two. Arming and escalating happen in the
          panel; the canvas is where you SEE, never where you SET (sketch 147). */}
      {grounded ? (
        <span
          data-testid="canvas-node-seal"
          data-grounded="true"
          className={cn(
            "pointer-events-none absolute right-[14px] top-[4px] z-[6] grid h-[21px] w-[21px]",
            "place-items-center rounded-full text-[11px] leading-none",
            "border border-[hsl(220_30%_100%/0.34)] bg-[hsl(220_30%_100%/0.1)] text-foreground",
          )}
        >
          <span aria-hidden="true">⛨</span>
          <span className="sr-only">{GOVERNANCE_SEAL_LABEL}</span>
        </span>
      ) : null}
    </>
  )
}
