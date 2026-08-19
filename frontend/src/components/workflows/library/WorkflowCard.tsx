/**
 * Phase 192-09 (LIB-02 / LIB-03 — D-09 / D-10 / D-12 / D-13 / D-14 / D-15 / D-18) — THE ONE
 * LIBRARY CARD.
 *
 * 159-C replaces THREE shipped card components with one: a single obvious verb, everything
 * else quiet behind `⋯`, and exactly ONE always-visible sentence — spent on the single action
 * whose result is not obvious from its name.
 *
 * ── A REWRITE, AND DELIBERATELY NOT AN EXTRACTION ────────────────────────────────────────
 * D-01 splits this phase's seam by SURVIVAL. The Run modal and the victim-naming delete Sheet
 * survive 192 unchanged and were moved verbatim (192-06, 192-08). The three cards do NOT
 * survive — so extracting them first would pay 188.2's measured +67% subtree tax on ~470 lines
 * the phase then deletes. This file is new code that replaces them, and `192-10` removes the
 * three originals from the page.
 *
 * ── THE VERB TABLE (D-09), LOCKED ────────────────────────────────────────────────────────
 *
 *   | Row state                       | Primary  | Overflow `⋯`                  |
 *   | runnable (published or starter) | `Run`  | the fork verb · Delete workflow… |
 *   | draft ("Still building")        | `Open` | Delete                        |
 *
 * ⚠ THE TWO PRIMARY WORDS READ `▶ Run` AND `✎ Open` UNTIL THE 200-PORT. The glyphs are not
 * gone from the CONTROL, only from the STRING — see `RUN_LABEL` for the argument. The table's
 * shape, its counts and the draft's absolute exclusion from Run are unchanged.
 *
 * SEVEN verbs across three card types collapse to three. A DRAFT NEVER EXPOSES A RUN
 * AFFORDANCE — not on its face and not inside its menu. That is the page's own load-bearing
 * contract (`WorkflowsPage.tsx:14`, *"A DRAFT cannot be Run (publish is the test)"*), and the
 * only mechanical guard on it is a test, which is why this rewrite ships its own.
 *
 * ── THE SECOND DRAFT BUTTON IS GONE (D-10) ───────────────────────────────────────────────
 * The shipped draft card carried TWO buttons whose `onClick` was the SAME handler
 * (`WorkflowsPage.tsx:751` and `:759`, measured at this commit). One of them was labelled as
 * though it shipped the workflow live; it did not — it opened the Builder, exactly like the
 * other one. A control that names an outcome it does not produce is worse than no control, so
 * it does not exist here in any form or under any label. The route to a live workflow is
 * unchanged and unchanged on purpose: Open → Builder → the gauntlet, which is where the
 * gauntlet actually lives.
 *
 * ⚠ Its `data-testid` is the ONE id this rewrite deliberately does not carry forward. It has a
 * single consumer, and `192-10` owns rewriting it.
 *
 * ── ⚠ THIS IS A REWRITE OF THE MARKUP, NOT OF THE TEST SURFACE ───────────────────────────
 * Every `data-testid` the three shipped cards emit is emitted HERE, VERBATIM. Measured with
 * `grep -rn` over every test file under `frontend/src` at this commit — not inherited — the ids
 * are consumed **62 times across 7 suites**, three of which `192-01` pins into the count gate.
 * A fresh, semantically-nicer id therefore lands as a GATE RED at wave 6 rather than as a soft
 * failure, and it would silently falsify `192-10`'s claim that those suites stay green
 * *untouched*.
 *
 *   root      `published-card` · `starter-card` · `draft-card`   (one per provenance)
 *   primary   `published-run` (runnable) · `draft-open` (draft)
 *   fork      `published-tweak` (published) · `use-starter` (starter)
 *   destroy   `published-delete` (runnable, owned) · `draft-delete` (new — D-18's wiring)
 *
 * Two of those will look like naming bugs to a later reader unless they are stated:
 *
 *  1. **`published-tweak` KEEPS ITS ID even though D-09 moves the fork verb into the `⋯`
 *     overflow and D-12 relabels it.** The control changed place and word; it did not change
 *     identity. That is deliberate continuity — do not "tidy" it to match the new label.
 *  2. **`published-tweak` and `use-starter` stay DISTINCT IDS ON DISTINCT CONTROLS**, because
 *     D-12 keeps the two fork handlers separate. One word on the face, two testids underneath.
 *     Collapsing them to one id would erase the only mechanical evidence that the two fork
 *     paths are still two paths — which is the whole of D-12.
 *
 * ── ZERO HOVER-ONLY TOOLTIP ATTRIBUTES IN THIS FILE (D-14) ───────────────────────────────
 * TOUCH HAS NO HOVER. The card this one replaces explained its fork verb ONLY through the
 * hover-only tooltip attribute (`WorkflowsPage.tsx:853`, measured here rather than inherited —
 * two prior plans of this phase quoted a stale number for it), and the starter card did the
 * same twice more. Every reason on this surface is REAL DOM TEXT wired by `aria-describedby`
 * instead — the `GovernanceSection.tsx:284` rule, which this codebase already holds everywhere
 * else. `librarySubtree.fences.test.ts` F1 parses this file's JSX attributes; this plan's own
 * suite asserts the RENDERED DOM carries none, with a positive control proving the selector can
 * find one.
 *
 * ⚠ The forbidden attribute is deliberately NOT SPELLED with its equals sign anywhere here, not
 * even in this prose — `192-05` had to make F1 a PARSED fence precisely because a raw grep reds
 * on the file that documents the rule (the 187-24 trap, inverted), and this plan's acceptance
 * checks are raw greps. The parsed fence is the authority either way; keeping the cheap check
 * truthful as well costs one word of phrasing and spares a later reader the adjudication. The
 * same reason is why the removed second draft button is described above rather than named.
 *
 * ── THE FORK OPENS A NAME PROMPT (D-15, AMENDED BY 192.1's D-19), AND THE TWO DELETES ARE
 *    DIFFERENT GRADES (D-18) ─────────────────────────────────────────────────────────────
 * The recorded 146-148 rule grades a guard BY CONSEQUENCE — victim-naming sheet, then
 * arm-to-confirm, then direct flip. Applied here that gives three different answers on one
 * card, and each of them is an argument rather than a taste:
 *
 *   fork           NO GUARD AT ALL — an INPUT STEP. ⚠ AMENDED IN PHASE 192.1 (plan 192.1-07,
 *                  D-19), IN THE SAME COMMIT THAT SHIPPED `ForkNameDialog.tsx`. What 192
 *                  recorded here, and why, is left VISIBLE below rather than deleted; what
 *                  changed is stated in full so the decision is never silently contradicted.
 *
 *                  192's REASONING, UNCHANGED AND STILL CORRECT AS FAR AS IT GOES:
 *                    "DIRECT FLIP. It is non-destructive and reversible — the live version
 *                     stays live and unchanged — so a sheet on it would spend the guard
 *                     vocabulary the delete relies on to mean anything
 *                     (`CapabilityGrid.tsx:11-13`). The sketch attached a confirm to 159-C;
 *                     it is deliberately not shipped."
 *
 *                  WHAT REOPENED IT: sketch 162-B, chosen by the operator against a measured
 *                  problem this card cannot solve on the read side — 43 of the operator's 104
 *                  workflows carry ONE name, because every fork inherits its parent's. The
 *                  identity line under the title tells them apart afterwards; a prompt at the
 *                  fork is what stops the pile growing.
 *
 *                  WHY IT DOES NOT CONTRADICT THE PARAGRAPH ABOVE, and the reason is
 *                  MECHANICAL rather than rhetorical: **the prompt collects something the
 *                  system cannot know, so it is an INPUT, not a guard — and inputs do not
 *                  spend guard vocabulary.** 159-C's confirm asked *are you sure?*, which is
 *                  the ladder's question; this asks *what should it be called?*, which is not
 *                  a question the ladder has ever asked. Each clause below is a TEST in
 *                  `ForkNameDialog.test.tsx`, not a sentiment here:
 *                    · it asks for a NAME, never for a confirmation — the field opens EMPTY,
 *                      because a prefilled name is a confirmation wearing an input's clothes;
 *                    · it wears NO destructive styling — no `DESTRUCTIVE_ITEM_CLASSES`, no
 *                      red, no victim naming (asserted over the rendered markup, with a
 *                      positive control proving the matcher catches the real tokens);
 *                    · its primary button is `Create my copy`, and asserting *"the primary is
 *                      NOT `Confirm`"* is what makes the distinction machine-checkable;
 *                    · it WARNS AND NEVER BLOCKS on a colliding name (D-20) — proved by
 *                      SUBMITTING THROUGH the clash, because "the warning renders" is
 *                      satisfied identically by a dialog that warns and then refuses.
 *
 *                  ⚠ THE 146-148 LADDER IS UNTOUCHED, and that is the load-bearing claim: the
 *                  victim-naming sheet still guards the live delete, arm-to-confirm still
 *                  guards the draft delete, and the fork is not a THIRD, LIGHTER RUNG — it has
 *                  left the ladder entirely. Nothing below was re-graded, and no guard word
 *                  was spent to buy this prompt.
 *
 *                  ⚠ AND ON ONE ROW THE VERB STILL OPENS NO PROMPT AT ALL (D-23): where this
 *                  caller ALREADY has a draft of a published slug, the fork opens that draft
 *                  and creates nothing — so nothing is being named. This card already says so
 *                  before the click, through `FORK_CONSEQUENCE_EXISTING`.
 *   draft delete   ARM-TO-CONFIRM (`MaintenancePanel.tsx:39-129`'s shipped shape). A draft has
 *                  no live history, no runs and no threads to destroy. One extra click, no
 *                  fetch, NO FABRICATED COUNT (`CapabilityGrid.tsx:15-21`), never silent.
 *   live delete    THE SHEET, unchanged — server counts fetched before the action is offered,
 *                  the victim named, an in-place lifecycle, no optimistic vanish, no undo.
 *
 * "Demonstrably lighter than the Sheet" is therefore arguable by PRECEDENT rather than by
 * taste: sheet (server preview + victim naming + terminal lifecycle) versus arm (one click).
 *
 * ── WHAT THIS CARD DOES NOT OWN ──────────────────────────────────────────────────────────
 * ⚠ **THE PARAGRAPH THAT STOOD HERE ASSERTED THE OPPOSITE OF WHAT THIS FILE NOW DOES, AND IT
 * IS AMENDED IN THE SAME DIFF AS THE SUBTRACTION RATHER THAN LEFT TO CONTRADICT ITS OWN CODE.**
 * `192.2-01-SUMMARY.md` flagged it for exactly this wave so it could not be read as a fence.
 * It said, verbatim:
 *
 *     "`WorkflowSoul scale="card"` renders the five atoms and is CONSUMED UNCHANGED — purpose
 *      hero, needs, glyph-dot spine, tier chip, deliverable. This card adds chrome and one
 *      sentence AROUND the soul; it does not rebuild the card's content and must not lose an
 *      atom."
 *
 * That was true of 192, and 192.2's D-03 reverses it deliberately: **the subtraction IS the
 * feature.** Rendering the real component (sketch 179 variant A, on a throwaway dev surface that
 * 192.2-06 tore down at this phase's close — the route is gone, the verdict is not)
 * measured the shipped card at NINE information rows deep, and the operator picked variant C,
 * which spends four slots and cuts the rest. So the card-scale soul mount is GONE and five
 * atoms leave with it — purpose hero, needs, glyph-dot spine, tier chip, deliverable — plus the
 * fork-consequence paragraph, which is RELOCATED rather than deleted (see the `⋯` menu below).
 *
 * ⚠ **`WorkflowSoul` ITSELF IS UNTOUCHED, AND THAT IS A HARD BOUNDARY.** It is CONSUMED, not
 * owned: it still renders at `scale="run"` and `scale="pub"` on two surfaces outside this
 * phase's scope. What left is this card's MOUNT of it. Deleting or narrowing the component
 * would break both of those surfaces silently.
 *
 * This card also owns neither fork's slug/version mechanics (they stay in the page's two
 * shipped handlers) nor the heaviest delete guard (that is `WorkflowDeleteSheet`, moved in
 * 192-08, mounted here as a black box).
 *
 * ── 192.2-05 (LIB-06 / D-01 / D-02 / D-03) — THE FOUR SLOTS, AND NOTHING ELSE ────────────
 *
 *   | slot        | carries                                                                  |
 *   | gutter, 3px | the last-run outcome. Colour, AND NEVER COLOUR ALONE                     |
 *   | line 1      | the NAME, with the dim mono version deferred to its right                |
 *   | line 2      | the run truth in words, then the state in BUSINESS words                 |
 *   | everything  | CUT from the resting card                                                |
 *
 * ⚠ **D-02 IS THE INSTRUCTION MOST LIKELY TO BE MISREAD, SO IT IS STATED AT THE RENDER.**
 * Sketches 177 and 178 both argued *lead with the state; the name cannot be the differentiator*.
 * **The operator chose C, which KEEPS THE NAME AS THE LEAD.** What moved is the ENCODING —
 * the outcome went to a 3px gutter and arrives peripherally. A later edit that demotes the name
 * to line two has rebuilt variant B, which was not chosen.
 *
 * ⚠ **THE GUTTER IS NEVER THE ONLY CARRIER.** Its colour repeats a fact that line 2 states in
 * words, and it is `aria-hidden` for that reason: a colour-blind reader and a screen-reader user
 * both get the whole answer from the sentence. `runFacts` returns three structurally distinct
 * arms and every one of them has a word, so there is no arm this card can render as a mark
 * alone even by accident.
 *
 * ⚠ FIVE STRINGS ARE DECLARED HERE RATHER THAN IN `libraryVocabulary.ts`, and it is a scope
 * boundary rather than an oversight — this plan's `files_modified` names exactly two files and
 * the vocabulary module is not one of them (the same boundary `192-07` recorded for its four).
 * Their re-home is OWED. They are not outside the honesty guarantee while they wait: this file
 * is one of the seven paths F5 sweeps BY NAME.
 *
 * ── ⚠ THE SUBTREE DELTA — MEASURED IN 192-12, RE-MEASURED AND CORRECTED IN 192.1-08 ──────
 * Recorded HERE as well as in the SUMMARY, for 188.2's stated reason: a later reader must not
 * be able to mistake this growth for a regression, and the figure has to live where the growth
 * is. Measured with a line classifier (blank / comment / code, counting JSX comment blocks as
 * comment) that was VALIDATED against 188.2's own published known-good — the
 * pre-cut `PhaseNodeCard.tsx` at `95a4c915`, `797/518/249/30`. 192.1-08 re-ran that validation
 * from scratch and reproduced `797 / 518 / 249 / 30` exactly, on the first attempt, before one
 * figure below was re-derived — the point being that an inherited classifier is an inherited
 * claim until it agrees with the known-good again.
 *
 * ⚠ THE TWO LINES THAT USED TO STAND HERE WERE STALE, AND THEY ARE LEFT READABLE BESIDE THEIR
 * CORRECTION RATHER THAN OVERWRITTEN — the CLAUDE.md ledger's own habit. This docblock is now
 * the second recorded instance of the same failure mode: *a figure written at a phase's close
 * goes stale on the next commit that touches any file it counted.*
 *
 *   WAS (192-12):  PAGE     1407 → 1007  (−28.4 %)    CODE 1021 →  479  (−53.1 %)
 *   WAS (192-12):  SUBTREE  1407 → 3182  (+126.2 %)   CODE 1021 → 1499  (+46.8 %)
 *
 * Both were already wrong before 192.1 opened. At this phase's base `8fc9bd74` the page was
 * 1180 / CODE 518 and the subtree 3438 / CODE 1547 — see `192.1-BASELINE.md` §8c, correction
 * B-6, which found the CODE columns stale too and not only the totals RESEARCH had named.
 *
 *   NOW (192.1-08, HEAD):
 *     PAGE      `WorkflowsPage.tsx`       1407 → 1160   (−17.6 %)    CODE 1021 →  462  (−54.8 %)
 *     SUBTREE   page + these 12 modules   1407 → 5323   (+278.3 %)   CODE 1021 → 2095  (+105.2 %)
 *
 * ── 192.1'S OWN DELTA, AND IT OWES SIX NUMBERS RATHER THAN FOUR ──────────────────────────
 * Two "before" readings are defensible and BOTH are published, so neither can be quoted as the
 * other. Against this phase's BASE (`8fc9bd74`): SUBTREE 3438 → 5323 (+54.8 %), CODE 1547 →
 * 2095 (+35.4 %). Against the honest PRE-CUT base — 192.1-01 had already added `updatedAt` to
 * `libraryFilter.ts` (284 → 294) and `libraryRow.ts` (100 → 121), +31 L, so BASELINE §8b's 3438
 * was ALREADY stale at Wave 3's own base — SUBTREE 3469 → 5323 (+53.4 %), CODE 1550 → 2095
 * (+35.2 %). And the PAGE's single figure hides its shape: 1180 → 1054 at the D-01 fork cut
 * (−126), then → 1113 (the identity memo) and → 1160 (the dialog mount) — a NET of only −20
 * across a phase whose headline act was an extraction. An extraction that removes 126 lines and
 * a phase that adds 106 back are two facts, and quoting one as the other is how the next
 * estimate goes wrong.
 *
 * WHERE THE GROWTH WENT, so it is attributable rather than merely admitted: five NEW modules
 * (`useWorkflowFork.ts` 517, `rowIdentity.ts` 509, `ForkNameDialog.tsx` 279,
 * `relativeChanged.ts` 109, `libraryFork.ts` 64 = 1478 L) plus growth on three shipped ones
 * (`libraryVocabulary.ts` 223 → 439, THIS FILE 567 → 747, `libraryRow` + `libraryFilter` +31)
 * minus the page's −20. The nine deltas sum to EXACTLY the whole subtree delta — no
 * unattributed residual. **PROSE is the dominant term for the third cut running: COMMENT
 * 1725 → 2964 (+1239 L, 65.7 % of the growth) against CODE +548 (29.1 %) and BLANK +98.**
 *
 * ⚠ RESEARCH's 192-era assumption A2 estimated +5 % to +16 %; 192-12 measured +126.2 % and this
 * reading is +278.3 %. A2 was labelled an estimate precisely so it could be contradicted in the
 * open, and its two named misses stand: it predicted the PAGE at 250–400 L (measured 1007 then,
 * 1160 now — a 3–4× miss on the single largest row), and it listed FIVE destination modules
 * where seven shipped at 192 and TWELVE stand today.
 *
 * ⚠ THE FIGURES INCLUDE THIS DOCBLOCK — it was measured, written, then RE-measured, and only
 * the digits were corrected so the line count could not move again (192.1-03 hit the identical
 * loop and resolved it the identical way). Re-derive: `git show 6bdc4684:<page> | wc -l` → 1407;
 * `git show 8fc9bd74:<page> | wc -l` → 1180; then `wc -l` on the page and on this directory's
 * TWELVE SOURCE modules — test files and `__fixtures__/` excluded, as 188.2 and 192 excluded
 * theirs.
 */
import { Fragment, useRef, useState } from "react"
// 192.2-05 (D-06) — `FileText` / `Sparkles` / `SquarePen` replace the three emoji marks and
// `Folder` replaces the folder chip's. The house's shipped chrome set, which this file already
// drew three marks from; see `MARK_ICON`'s docblock for why NOT `phaseGlyph()`.
// 200-PORT — `Play` / `ExternalLink` / `User` arrive with sketch 200's card: the sheet draws
// the footer verbs as ICON + WORD (`play_arrow` / `open_in_new`) rather than as a glyph baked
// into the label string, and it leads the `not-by-you` status line with `person`.
import {
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  MoreHorizontal,
  Play,
  Sparkles,
  SquarePen,
  Trash2,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  // 192.2-11 (WR-03). The shipped primitive that carries `role="group"` — one of the five
  // children ARIA permits inside `role="menu"`, which a `<p>` is not. ⚠ NOT
  // `DropdownMenuLabel`, and the reason is measured; see the ⚠ paragraph at its use site.
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { templateAdmission } from "@/components/workflows/soulData"
import { deleteWorkflowDraft } from "@/lib/api"

import { cardFace, type CardFace, type CardMark } from "./cardFace"
import { CHIP_PREDICATES, type MatchReason } from "./libraryFilter"
import type { LibraryRow, Provenance } from "./libraryRow"
import type { RunOutcome } from "./runFacts"
import {
  CARD_TEMPLATE_MARK,
  FORK_CONSEQUENCE,
  FORK_CONSEQUENCE_EXISTING,
  FORK_VERB,
  MATCH_REASON_PREFIX,
  MATCH_REASON_SEPARATOR,
  MATCH_REASON_WORDS,
} from "./libraryVocabulary"
import type { RowIdentity } from "./rowIdentity"
import {
  WorkflowDeleteSheet,
  type WorkflowDeleteSheetHandle,
  type WorkflowDeleteSheetProps,
} from "./WorkflowDeleteSheet"

// ── The words owed a re-home (see the ⚠ paragraph above) ─────────────────────────────

/**
 * The primary verb for a runnable row.
 *
 * ⚠ 200-PORT — IT READ `▶ Run` AND THE GLYPH IS GONE FROM THE STRING, not from the control.
 * Sketch 200's card draws the footer verb as `play_arrow` + the word, i.e. an ICON NODE beside
 * a plain label — the same split D-06 already made for the three provenance marks when it
 * evicted their emoji from this file. A glyph baked into a label string cannot be sized, cannot
 * be toned, and is read aloud as a character by a screen reader; the icon is `aria-hidden` and
 * the word carries the meaning, which is this card's standing rule everywhere else.
 */
const RUN_LABEL = "Run"

/** The primary verb for a draft. Same 200-PORT split as `RUN_LABEL` above — it read `✎ Open`. */
const OPEN_LABEL = "Open"

/**
 * The heaviest guard's trigger word, verbatim (`WorkflowsPage.tsx:834`). The ellipsis is
 * load-bearing vocabulary in this codebase: it promises a further step, and the further step
 * really is there — the victim-naming Sheet.
 */
const DELETE_WORKFLOW_LABEL = "Delete workflow…"

/**
 * D-18's word for a draft. NO ellipsis, and the asymmetry is the point: this guard is one
 * extra click IN PLACE, not a Sheet, so an ellipsis promising a further surface would
 * overstate it. The vocabulary has to keep meaning what it means.
 */
const DELETE_DRAFT_LABEL = "Delete"

/**
 * The armed prompt. It names the victim's KIND and the irreversibility, and it names NO
 * COUNT — the `CapabilityGrid.tsx:15-21` honesty rule: no preview is fetched here, and a
 * fabricated number is worse than no number.
 */
const DELETE_DRAFT_PROMPT = "Delete this draft? It cannot be recovered."
const DELETE_DRAFT_CONFIRM = "Delete draft"
const DELETE_DRAFT_CANCEL = "Cancel"

/** Never silent (D-18). A guard that fails quietly is a guard that lies about succeeding. */
const DELETE_DRAFT_FAILED = "Couldn't delete this draft — try again."

// ── Shared class strings (the shipped card chrome, unchanged) ────────────────────────

/**
 * Phase 192.2-05 (D-01) — THE CARD IS NOW A ROW: gutter, then everything else.
 *
 * ⚠ IT WAS `flex flex-col gap-3` AND THE AXIS FLIP IS THE STRUCTURAL CHANGE, not a class tweak.
 * The 3px outcome mark has to run the FULL HEIGHT of the card to be legible peripherally down a
 * column of 107 rows, which a mark nested inside the stacked content cannot do. Everything the
 * card stacked before now stacks inside `CARD_BODY_CLASSES`.
 */
/**
 * ⚠ 200-PORT — THE ROW BECOMES A CARD AGAIN, AND THE GUTTER LEAVES THE FLOW.
 *
 * It read `flex gap-3 rounded-lg border bg-card p-4`: a flex ROW whose first child was the 3px
 * mark, which meant the mark started 16px in from the card's own edge and stopped 16px short of
 * its bottom. Sketch 200 draws it `absolute left-0 top-0 bottom-0` — FLUSH, corner to corner —
 * so down a column of 107 rows the marks form one continuous ruler rather than 107 floating
 * ticks. That is only expressible with an absolutely-positioned child, hence `relative` here
 * and the column axis for what is left.
 *
 * `rounded` (not `rounded-lg`) is the sheet's own `borderRadius.sm`, and `hover:bg-accent/30`
 * is its `hover:bg-[#0f141b]` — a one-step lift on the card's own surface, no border change.
 */
const CARD_CLASSES = "group relative flex flex-col rounded border bg-card p-4 transition-colors hover:bg-accent/30"

/**
 * The stack that used to be the card root.
 *
 * ⚠ `gap-3` IS GONE AND THE SPACING IS NOW PER-SLOT. The sheet gives its four rows DIFFERENT
 * gaps — 8px under the title, 16px under the status line, 16px under the meta line — and a
 * uniform gap flattens exactly the hierarchy the sheet spends those numbers on. `pl-1` is its
 * `pl-xs`: the content clears the now-flush gutter.
 */
const CARD_BODY_CLASSES = "flex min-w-0 flex-1 flex-col pl-1"

/**
 * D-01 slot 1 — the gutter. `3px` verbatim from the approved sketch (179-C), and since the
 * 200-PORT it is FLUSH to the card's edges rather than inset by the padding: `rounded-l`
 * follows the card's own left corners so the mark reads as part of the card's edge.
 */
const GUTTER_CLASSES = "absolute bottom-0 left-0 top-0 w-[3px] rounded-l"

const NAME_CLASSES = "truncate text-[14px] font-medium text-foreground"
const VERSION_CLASSES = "font-mono text-[11px] text-muted-foreground"
/**
 * Phase 192.2-05 — the consequence sentence's classes, IN ITS NEW HOME.
 *
 * ⚠ IT WAS `NOTE_CLASSES` (`text-[11.5px] leading-snug text-muted-foreground`) on a card-level
 * paragraph. The size and leading are carried over verbatim — the sentence did not change, only
 * where it is spent — and the padding is the menu's own item padding, so the note sits on the
 * same left edge as the verb it describes rather than floating in the popover.
 */
const MENU_NOTE_CLASSES = "px-2 py-1.5 text-[11.5px] leading-snug text-muted-foreground"
/**
 * ⚠ 200-PORT — the footer's rule is now the card's FULL border tone, not `border-border/60`,
 * and it sits on the sheet's own `pt-sm` (8px) with `justify-start`. The sheet's footer is a
 * hairline the eye can actually find at the bottom of a two-column grid; a 60%-opacity rule
 * disappeared against `bg-card` and made the verb look unanchored.
 *
 * ⚠ `mt-auto` IS REPLACED BY `mt-4` ON A GROWING HEADER BLOCK, and the swap is what makes the
 * sheet's `mb-md` gap real. `mt-auto` guarantees only that the footer sits at the BOTTOM — on a
 * card whose content already fills its box (a row of two where this one is the taller) it
 * resolves to ZERO and the rule lands hard against the meta line. Growing the block ABOVE the
 * footer instead keeps the bottom alignment across a grid row AND keeps a floor under the gap.
 */
const FOOTER_CLASSES = "mt-4 flex items-center gap-2 border-t border-border pt-2"

/**
 * Phase 192.1-06 (D-08) — THE 14TH ATOM'S CLASSES, declared in this block rather than inline
 * because this block is the file's established home for chrome classes.
 *
 * ⚠ NO THIRD TEXT SIZE IS INVENTED. The house has exactly two secondary-line idioms and this
 * takes the smaller one — `text-[11px] text-muted-foreground`, the folder chip's own size
 * (`:389` below, and `PhaseSpine.tsx:67`, `ProblemsTray.tsx:214`, `BuilderSaveRegion.tsx:239`).
 * That is chosen over `NOTE_CLASSES`'s 11.5px deliberately: the chip is this line's IMMEDIATE
 * SIBLING and D-08 stacks them, so two adjacent secondary lines at different sizes would read
 * as an accident. `flex-wrap` is load-bearing at the 43-row family's line length inside a
 * two-column grid.
 *
 * ⚠ 200-PORT — `uppercase tracking-wider leading-tight` JOIN IT, AND THE SIZE DOES NOT MOVE.
 * Sketch 200 draws this exact line as `YOURS • Main • 42 share this name • changed last month`
 * — 11px, uppercase, letter-spaced, and it is the ONLY uppercase run on the card. That is what
 * demotes it below the 14px name and the 12px status line without spending a colour or a rule
 * on it. The uppercasing is CSS, never a second spelling of any word: every string on this line
 * still arrives from `libraryVocabulary.ts` in its sentence case, so `textContent` is unchanged
 * and a copy change is still a one-line diff in one file. `mt-0.5` becomes `mt-4` — the sheet's
 * `mb-md` under the status line, the gap that makes these two read as different registers.
 */
const IDENTITY_CLASSES =
  "mt-4 flex flex-wrap items-center gap-1.5 text-[11px] uppercase leading-tight tracking-wider text-muted-foreground"

/**
 * The owner word. The colour is picked from `owned` — the file's ONE existing ownership-
 * predicate read, reused rather than re-tested, because a second copy of that predicate is the
 * drift D-03 forbids by name. The WORD itself is resolved by the page (D-09) and merely painted.
 *
 * ⚠ 200-PORT — THE PILL IS GONE AND ONLY THE PILL IS GONE. Both constants read
 * `PILL_BASE + <tone>`: a bordered, `rounded-full`, 9px MONO chip. Sketch 200 draws this word
 * as `YOURS`, in the meta line's own run, sharing its size, its tracking and its `•`
 * separators — one line of text, not a text line with a badge welded to its head. That badge
 * was the last thing on the card wearing a system token's clothes (the defect D-06 evicted the
 * emoji for), and at 9px mono inside an 11px line it also broke the line's baseline.
 *
 * WHAT SURVIVES IS THE ONLY THING THE BADGE WAS CARRYING: the ownership TONE. `text-primary`
 * for a row you own, muted for one you do not — so *whose is this?* is still answerable at a
 * glance, with no border, no radius and no second font. `PILL_BASE` had no other consumer and
 * leaves with it rather than sitting unused.
 *
 * ⚠ The predicate's identifier is deliberately NOT spelled in this prose. D-11's acceptance
 * check is a RAW SOURCE COUNT of it, so a docblock naming it would answer the very grep that
 * proves there is only one call — the 187-24 trap this file's header already records twice.
 */
const IDENTITY_OWN_YOURS = "shrink-0 font-medium text-primary"
const IDENTITY_OWN_SHARED = "shrink-0 font-medium text-muted-foreground"

/**
 * The separator, spent BETWEEN present parts only. Decorative — a reader hears the parts.
 *
 * ⚠ 200-PORT — IT READ `·` (U+00B7 MIDDLE DOT) AND IS NOW `•` (U+2022 BULLET), which is the
 * glyph sketch 200 draws on this line. At 11px with the line's new letter-spacing a middle dot
 * all but vanishes between two uppercase runs, which is what made the shipped line read as one
 * undifferentiated string. It is `aria-hidden` on both sides of the change, so nothing about
 * what a screen reader receives moves — but the two test helpers that STRIP this glyph before
 * comparing parts hold its literal, so they move in the same commit or every identity assertion
 * in the subtree reds at once.
 */
const IDENTITY_SEPARATOR = "•"

/**
 * Phase 192.2-09 (WR-04) — THE MATCH-REASON LINE'S CLASSES.
 *
 * ⚠ NO NEW SIZE AND NO NEW TONE. It READS `IDENTITY_CLASSES` above rather than restating
 * `text-[11px] text-muted-foreground`, so the reason line and the identity line it sits under
 * cannot drift into two secondary sizes — the same argument that block's own docblock makes
 * about the folder chip, applied one line further down. `italic` is the ONLY thing added: the
 * line is a note about the SEARCH the person just ran, not a further fact about the workflow,
 * and it costs no colour, no border and no glyph (the SEED-155 / U8 lesson — a bordered chip
 * here is a treatment this card structurally cannot render).
 *
 * ⚠ THE CLASSES DELIBERATELY DO NOT LIVE IN `GUTTER_TONE` OR `RUN_TONE`. Those two maps are
 * `RunGutter`-keyed colour tables for D-01's slot 1, and a reason class inside either would be
 * a member that answers a different question.
 */
const MATCH_REASON_CLASSES = IDENTITY_CLASSES + " italic"

/**
 * The default for the reason prop, hoisted to module scope so it is ONE frozen array rather
 * than a fresh `[]` minted on every render of every one of the operator's 107 rows.
 */
const EMPTY_MATCH_REASONS: readonly MatchReason[] = []
/**
 * ⚠ 200-PORT — BOTH VERBS BECOME TEXT ACTIONS. They read as a FILLED primary button and a
 * BORDERED secondary one; sketch 200 draws both as a bare icon+word in the footer, tinted
 * `primary` for Run and neutral `foreground` for Open, with no fill, no border and no radius.
 *
 * The reason is the grid, not taste: at two columns × 107 rows a filled block per card turns
 * the shelf into a wall of buttons and the eye stops finding the NAMES, which is what a person
 * actually scans for. The footer rule above already separates the action zone; a second, third
 * and fourth signal (fill + border + radius) spends weight on a control the reader was not
 * looking for. Weight is kept where D-18 says it belongs — the destructive menu items.
 *
 * The hit target does not shrink: `-mx-1 px-1 py-1` keeps the padded box while removing the
 * paint, and both remain real `<button>`s with their shipped testids and handlers.
 */
const VERB_BASE =
  "-mx-1 flex items-center gap-1.5 rounded px-1 py-1 text-[13px] font-medium transition-colors "
const PRIMARY_CLASSES = VERB_BASE + "text-primary hover:text-primary/80"
const SECONDARY_CLASSES = VERB_BASE + "text-foreground hover:text-muted-foreground"

/** The footer verbs' glyph size — the sheet's 16px, the one it draws `play_arrow` at. */
const VERB_ICON_CLASSES = "h-4 w-4 flex-none"

/**
 * THE DESTRUCTIVE WEIGHT LIVES ON THE DELETE ITEMS AND NOWHERE ELSE ON THIS CARD — the
 * 146-148 rule stated at `WorkflowsPage.tsx:813-815`. A second control wearing it would make
 * the weight mean "an action" rather than "an action you cannot undo".
 */
const DESTRUCTIVE_ITEM_CLASSES = "text-destructive focus:text-destructive"

/** Per-provenance root `data-testid` — the shipped ids, one per shipped card component. */
const ROOT_TESTID = {
  published: "published-card",
  starter: "starter-card",
  draft: "draft-card",
} as const satisfies Record<Provenance, string>

/**
 * Phase 192.2-02 (LIB-06 / D-05 / D-06) — WHAT USED TO BE THE `FACE` TABLE, NOW SPLIT IN TWO.
 *
 * The DECISION — which state a row is in, what leads, what defers — moved to `cardFace.ts`, the
 * one presentation module the three library surfaces share (CONTEXT D-05; the G-5 obligation this
 * file has carried since sketch 175). What is left here is the DRAWING: three maps keyed by the
 * face's own mark, so the card names no provenance in its header render at all.
 *
 * ── 192.2-05 (D-06) — THE EMOJI ARE GONE, AND THE REPLACEMENT IS AN ARGUMENT ────────────
 * ⚠ THREE EMOJI STOOD HERE UNTIL THIS WAVE — a page, a sparkle and a memo, one per mark — kept
 * on purpose so 192.2-02 could prove it moved no pixel. D-06 records that they violate the
 * single-source icon convention; this is where that is paid.
 *
 * ⚠ THE THREE CHARACTERS ARE DELIBERATELY NOT SPELLED IN THIS PROSE, and their literals are
 * recorded in `192.2-01-SUMMARY.md` §3 instead. D-06's acceptance check is a RAW GREP of the
 * emoji plane over this file, and a docblock quoting them answers that grep on the very file
 * that documents the rule — the 187-24 trap, which this file's header already records twice for
 * the forbidden tooltip attribute and resolves the same way.
 *
 * ⚠ **THEY DO NOT BECOME `PHASE_GLYPHS` / `phaseGlyph()`, AND THE PLAN'S `files_modified`
 * NAMING `lib/phaseGlyph.tsx` IS DECLINED RATHER THAN OBEYED.** That map is TOTAL OVER PHASE
 * TYPES — `programmatic`, `llm_agent`, `llm_emit` … — and the skill's `icon-convention.md` §4
 * forbids this exact move by name: *"Using a phase-type glyph as a category icon — a workflow
 * is its SPINE (#36), not one step's mark"*, recorded after an audit caught four such drifts.
 * `ready` / `starter` / `building` is a PROVENANCE axis; it has no shipped glyph vocabulary,
 * and inventing one there would put a second concern inside a module whose exported key set is
 * guarded to equal `soulData.PHASE_GLYPHS` exactly. The card also stopped consuming that map
 * entirely when the glyph-dot spine left with D-03 — so the honest edit is that `phaseGlyph.tsx`
 * is NOT TOUCHED by this plan.
 *
 * ⚠ **THEY BECOME `lucide-react` MARKS — THE HOUSE'S SHIPPED SET, NOT A SECOND ICON PATH.**
 * This file already draws `MoreHorizontal`, `Trash2` and `Loader2` from it; the convention's
 * single sources are `@lobehub/icons` for PROVIDERS and `PHASE_GLYPHS` for PHASE TYPES, and a
 * library row's provenance is neither. Adding a fourth path would be the drift; reusing the
 * chrome set the card is already made of is not.
 *
 * ⚠ THE MARK CARRIES NO MEANING COLOUR AND NO WORD OF ITS OWN. It is `aria-hidden`, muted, and
 * everything it hints at is said in business words on line 2 — the shipped `PhaseNodeCard` rule
 * (*"the WORD carries the meaning; tone is decoration"*), applied one surface over.
 */
const MARK_ICON = {
  ready: FileText,
  starter: Sparkles,
  building: SquarePen,
} as const satisfies Record<CardMark, LucideIcon>

/** The mark's chrome. Muted and small: it labels the row, it does not compete with the name. */
const MARK_ICON_CLASSES = "h-3.5 w-3.5 flex-none text-muted-foreground"

/**
 * Phase 192.2-05 (D-01 line 2) — THE STATE'S TONE, NOW THAT IT IS A WORD RATHER THAN A PILL.
 *
 * ⚠ IT WAS `STATE_PILL_CLASS`, A BORDERED MONO UPPERCASE CHIP IN THE CARD'S RIGHT-HAND FLEX
 * CHILD. D-01 puts the state on line 2 beside the run truth, so the chip's border, background
 * and `uppercase` all leave with the slot — `READY TO RUN` shouted in 9px mono is a system
 * token wearing a business word's clothes, which is the defect D-06 exists to end rather than
 * to relocate. CONTEXT D-05 flagged this move as STRUCTURAL and not a CSS change, because the
 * pill lived in a different flex child from the name; it was, and this is that move.
 *
 * ⚠ THE THREE TONES ARE THE SHIPPED ONES, RE-USED RATHER THAN RE-PICKED — no new hex, and no
 * new decision. The sketch spends a third colour (green) on `Ready to run`; that is deliberately
 * NOT copied, because `Worked` one span to its left is already the success tone and two greens
 * on one line would conflate *this row is runnable* with *this row's last run succeeded* —
 * the exact conflation the gutter exists to keep apart.
 */
const STATE_TONE = {
  ready: "text-primary",
  starter: "text-primary",
  building: "text-muted-foreground",
} as const satisfies Record<CardMark, string>

/**
 * The run arm as ONE key — the outcome when there was a run, the arm's own name when there was
 * not. It keys the gutter's colour and the run word's tone together, so the two cannot drift.
 */
type RunGutter = RunOutcome | "never" | "unknown" | "not-by-you"

/**
 * D-01 slot 1 — the gutter's colour. Deep Midnight semantic tokens only; every one of these is
 * already in `index.css` and none is a new hex.
 *
 * ⚠ ~~`unknown` IS DELIBERATELY UNPAINTED~~ — AMENDED BY `192.2-11` (CR-01): THERE ARE NOW
 * **THREE** QUIET ARMS, NOT TWO, AND THEY MUST BE PAIRWISE DISTINGUISHABLE. The original
 * sentence stands and is extended rather than replaced: D-08's whole point is that *the wire
 * did not say* is not *this never ran*, and `192.2-11` adds a third neighbour to that argument
 * — *somebody ran it, and it was not you*. Down a column all three must read apart:
 *
 *   · `unknown`    — NO MARK for NO INFORMATION (`bg-transparent`). T-22's mitigation in the
 *                    colour axis: a bar that merely looked quiet would make it read like a fact.
 *   · `never`      — a real, quiet bar (`bg-border`) for a real NEGATIVE fact.
 *   · `not-by-you` — a BRIGHTER NEUTRAL (`bg-muted-foreground`) for a real POSITIVE fact that
 *                    carries more signal than `never` (somebody ran it) but no outcome of the
 *                    caller's own. ⚠ It may never be `bg-success` / `bg-destructive` /
 *                    `bg-warning`: the caller has no outcome to report and a coloured outcome
 *                    would be a fabricated one (DEC-11-C).
 *
 * None of the three can be mistaken for a tick, and the WORD on line 2 is what actually
 * distinguishes them for the reader (T-20) — which is what *"colour, and never colour alone"*
 * requires, rather than three colours doing the work by themselves.
 */
const GUTTER_TONE = {
  worked: "bg-success",
  failed: "bg-destructive",
  stopped: "bg-warning",
  never: "bg-border",
  "not-by-you": "bg-muted-foreground",
  unknown: "bg-transparent",
} as const satisfies Record<RunGutter, string>

/** The run word's tone. Same SIX keys, so a new arm cannot get a colour and lose a word. */
const RUN_TONE = {
  worked: "text-success",
  failed: "text-destructive",
  stopped: "text-warning",
  never: "text-muted-foreground",
  // ⚠ Deliberately the SAME quiet tone as `never` / `unknown` (DEC-11-C). The three quiet arms
  // are told apart by their WORDS, not by three shades of grey on a 12px line.
  "not-by-you": "text-muted-foreground",
  unknown: "text-muted-foreground",
} as const satisfies Record<RunGutter, string>

/**
 * D-01 line 2's classes. `text-[12px]` is the sketch's size; it sits between the name's 14px
 * and the identity line's 11px, which is what makes the run truth read as the SECOND thing on
 * the card rather than as more metadata.
 */
const ANSWER_CLASSES = "mt-2 flex flex-wrap items-center gap-1.5 text-[12px]"

/** The separator between the two halves of line 2 — decorative, exactly like the identity line's. */
const ANSWER_SEPARATOR = "|"

/**
 * ⚠ 200-PORT — THE SHEET'S STATUS DOT, AND IT IS NET-NEW ON THIS CARD.
 *
 * Sketch 200 leads every status line with an 8px round mark in the outcome's own colour
 * (`w-2 h-2 rounded-full bg-[#21C45D]`). It is the atom that makes the run truth findable
 * before the sentence is read, at the one place the eye is already looking — the start of
 * line 2 — where the full-height gutter is peripheral.
 *
 * ⚠ IT SPENDS NO NEW COLOUR AND ADDS NO NEW FACT. It is painted from `GUTTER_TONE`, the same
 * arm-keyed table the gutter reads, so the dot and the bar cannot disagree; and the WORD one
 * span to its right still says everything the colour hints at (*"colour, and never colour
 * alone"*). `aria-hidden`, like the gutter, for exactly the same reason.
 */
const ANSWER_DOT_CLASSES = "h-2 w-2 flex-none rounded-full"

/**
 * ⚠ THE TWO ARMS THAT GET A GLYPH INSTEAD OF A DOT, AND THE ONE THAT GETS NEITHER.
 *
 * Sheet cards 5 and 6 do NOT lead with a dot: `Run by someone else` leads with `person` and
 * `Still building` with `build`. That is the sheet distinguishing *a run outcome we hold* from
 * *a fact about somebody else* — so `not-by-you` takes `User` here and no colour, because the
 * caller has no outcome to report and a coloured dot would be a fabricated one (DEC-11-C).
 *
 * ⚠ `unknown` GETS NO MARK AT ALL, which is `GUTTER_TONE.unknown = bg-transparent`'s own
 * documented rule applied one slot over: NO MARK FOR NO INFORMATION. A grey dot there would
 * make *the wire did not say* look like a fact we hold, which is the whole reason D-08 keeps
 * `unknown` and `never` apart. The sheet draws no such card, so nothing is being copied from
 * it here and nothing is being invented either — the arm simply renders its word alone.
 */
const ANSWER_GLYPH_CLASSES = "h-3.5 w-3.5 flex-none text-muted-foreground"

/**
 * Resolve the gutter key from the face's run arm. TOTAL by construction: `RunFact` has ~~three~~
 * FOUR arms, `ran` contributes its outcome and the other three contribute their own `kind`, so a
 * FIFTH arm becomes a typecheck error here rather than an unpainted gutter.
 *
 * ⚠ THE PREDICTION IN THE ORIGINAL SENTENCE CAME TRUE AND IS KEPT AS THE RECORD: adding
 * `not-by-you` to `RunFact` in `192.2-11` made this function non-total and red `tsc`, which is
 * exactly why the union member and its two colour-map entries had to land in ONE commit. The
 * body needed no change — the new arm contributes its own `kind`, as designed.
 */
function runGutterOf(run: CardFace["run"]): RunGutter {
  return run.kind === "ran" ? run.outcome : run.kind
}

// ── Props ────────────────────────────────────────────────────────────────────────────

/**
 * The delete Sheet's own row type, taken FROM the Sheet rather than re-imported from the API
 * seam. Two reasons, one of them mechanical: the card should accept exactly what the guard it
 * mounts accepts, so a change to the guard is a typecheck error here rather than a drift; and
 * the api name for it contains a token this file's D-10 acceptance check counts, which the
 * ⚠ paragraph in the header explains.
 */
type DeletableRow = WorkflowDeleteSheetProps["wf"]

export interface WorkflowCardProps {
  /** The normalized row — the ONE shape every module under `library/` reads. */
  row: LibraryRow
  /** The project folder's display name, resolved by the page. `null` = unbound. */
  folderName?: string | null
  /** Launch a runnable row (the Phase-121 one-click launch, unchanged). */
  onRun: (row: LibraryRow) => void
  /** Open a draft in the Builder (edit-in-place; saves PATCH the same row). */
  onOpen: (row: LibraryRow) => void
  /**
   * Fork a live row into a NEW VERSION — the same slug at version N+1. See `onForkStarter`:
   * these two are SIBLINGS AND NOT TWINS, and the card's only job is to pick the right one.
   *
   * ⚠ The plan suggested naming this prop after the row's provenance. It is named after what
   * the fork PRODUCES instead, for two reasons: that is the actual D-12 distinction (a new
   * version of a live row, versus a fresh copy of a shared one), and the provenance word
   * carries a token this file's D-10 acceptance check counts raw. See the header's ⚠ note.
   */
  onForkNewVersion: (row: LibraryRow) => void
  /**
   * Fork a STARTER — a fresh auto-suffixed slug at version 1, retried once on a 409.
   *
   * ⚠ D-12: THE TWO FORK HANDLERS ARE NEVER MERGED. The user's intent is identical ("give me
   * my own editable version of this") and that is why they share ONE WORD on the face; the
   * slug/version mechanics that differ behind them are ours, not theirs. Merging them breaks a
   * GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one shared starter —
   * the shipped comment at `WorkflowsPage.tsx:278-285` records exactly that. The card branches
   * on `provenance` and constructs no slug and no version itself.
   */
  onForkStarter: (row: LibraryRow) => void
  /**
   * TRUE only when THIS published row's slug already has a draft the caller owns — in which
   * case the fork verb OPENS THAT EXISTING DRAFT and creates nothing, so the sentence has to
   * change with it or the card states a consequence that is false (192-13, the U5 blocker).
   *
   * ⚠ ONLY THE PAGE CAN KNOW THIS, and that is why it arrives as a prop rather than as
   * something computed here. The page holds the merged drafts feed; this card holds one row.
   * The card computes NOTHING about slugs or versions — the same D-12 discipline that keeps it
   * out of the two fork handlers' slug/version mechanics, and the reason the shipped 409 is a
   * page-level defect rather than a card-level one.
   *
   * Optional, defaulting to `false`, so every existing call site and all 35 shipped cases are
   * byte-identical in behaviour: an ordinary row still reads exactly as it shipped.
   */
  hasExistingFork?: boolean
  /**
   * Phase 192.1 (LIB-05 / D-06 / D-08 / D-09) — THIS ROW'S IDENTITY, ALREADY RESOLVED.
   *
   * ⚠ ONLY THE PAGE CAN KNOW THIS, for the same reason `hasExistingFork` above arrives as a
   * prop: identity is a property of the row's place in the LIST, not of the row. `1 of 43` is
   * counted over the FULL merged library before any filtering (D-05), the lineage phrase names
   * a parent that lives in some other feed, and the discrimination ranker needs every namesake
   * to know which axis narrows. This card holds one row.
   *
   * **The card computes NOTHING about slugs or versions** — the same D-12 discipline that keeps
   * it out of the two fork handlers' slug/version mechanics. It paints `own`, then `segs` in
   * the order given, then `ofN`, then `when`, and it invents no part and drops none. A `null`
   * in `ofN` / `when` means RENDER NOTHING, never a placeholder.
   *
   * ⚠ REQUIRED, NOT OPTIONAL-WITH-A-DEFAULT, and the asymmetry with `hasExistingFork` directly
   * above is deliberate rather than inconsistent. That prop is optional so 35 shipped card
   * cases stay byte-identical in behaviour; **the identity line is UNCONDITIONAL** (D-06), so a
   * default of "no line" would let an un-updated call site render a card the phase says cannot
   * exist — silently, and on every row it owns. Required makes `tsc` enumerate the call sites.
   */
  identity: RowIdentity
  /**
   * Phase 192.2-05 (LIB-06 / P-1) — THE ONE INSTANT THIS CARD'S RECENCY IS MEASURED AGAINST.
   *
   * ⚠ HOIST IT ONCE PER RENDER PASS, AT THE LIST. `cardFace` and `runFacts` both default to the
   * real clock, and a card that took that default would have 107 rows each reading their own —
   * two cards in ONE pass could then straddle a band boundary and disagree about what time it
   * is. The page already hoists exactly this instant for `resolveIdentity` (`WorkflowsPage.tsx`
   * :520, with its own note on why it is NOT captured inside the `[rows]` memo, which would
   * freeze it), so this prop hands the SAME `now` to the second consumer instead of minting a
   * second clock beside the first.
   *
   * Optional with a real-clock default, following `hasExistingFork`'s precedent above rather
   * than `identity`'s: a call site that omits it renders a correct card, merely one that reads
   * its own clock — unlike an omitted identity line, which would render a card D-06 says
   * cannot exist.
   */
  now?: number
  /**
   * Phase 192.2-09 (LIB-06 — gap-closure round 1, WR-04) — WHY THIS ROW IS IN THE FILTERED
   * SET, already resolved by the page.
   *
   * ⚠ **EMPTY MEANS THIS COMPONENT RENDERS NOTHING AT ALL** — not an empty node, not a
   * zero-height wrapper, no node in the column at all. That is not a nicety; it is what makes
   * DEC-09-A's argument MECHANICAL rather than rhetorical. D-03's subtraction governs the
   * RESTING card (*"six atoms leave the **resting** card"*), and the resting card is exactly
   * the case where no chip is pressed and no search is typed — under which `matchReasons`
   * returns `[]` and this prop's default is `[]`. The proof is
   * `WorkflowCard.baseline.test.tsx`, which renders with no selection and comes through this
   * wave BYTE-UNCHANGED; a re-baseline would have been the tell that the line leaked onto the
   * resting card (T-192.2-39).
   *
   * ⚠ ONLY THE PAGE CAN KNOW THIS, for the same reason `hasExistingFork` and `identity` above
   * arrive as props: the reason a row is here is a property of the SELECTION, and the card
   * holds one row. The card paints what it is handed and derives nothing — it does not import
   * `matchReasons`, only the id type, and it looks the WORDS up in `libraryVocabulary.ts`
   * rather than spelling any of them.
   *
   * Optional with an empty default, following `hasExistingFork`'s precedent rather than
   * `identity`'s: an omitted prop renders the card exactly as it shipped, which is the
   * behaviour every existing call site and every shipped case is entitled to.
   */
  matchReasons?: readonly MatchReason[]
  /** Re-fetch after a CONFIRMED delete. Forwarded to the Sheet; also called by D-18's guard. */
  onDeleted: () => void
}

// ── The card ─────────────────────────────────────────────────────────────────────────

export function WorkflowCard({
  row,
  folderName = null,
  onRun,
  onOpen,
  onForkNewVersion,
  onForkStarter,
  hasExistingFork = false,
  identity,
  now = Date.now(),
  matchReasons = EMPTY_MATCH_REASONS,
  onDeleted,
}: WorkflowCardProps) {
  const deleteSheetRef = useRef<WorkflowDeleteSheetHandle>(null)

  /**
   * D-18's guard state — `MaintenancePanel.tsx:42-44`'s shipped arm-to-confirm, verbatim in
   * shape: THE FIRST CLICK ARMS AND DOES NOT DELETE, Confirm deletes, Cancel disarms. A
   * single stray click never reaches the endpoint.
   */
  const [armed, setArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  /**
   * Phase 192.2-02 (LIB-06 / D-05) — THE ONE CALL THAT RESOLVES THIS ROW'S FACE.
   *
   * Everything this card leads with, defers or states about the row itself comes back from here:
   * the lead, the version, the state word, the mark and whether the row can be run. The card
   * decides none of it and re-derives none of it — the same discipline it already holds when it
   * refuses to compute slugs, versions or the identity line — the mark it hands back is a KEY,
   * never a glyph, so the icon convention has exactly ONE enforcement point (`MARK_ICON` above).
   *
   * ⚠ 192.2-05: `now` IS PASSED, NOT DEFAULTED — see the prop's own docblock (P-1). The face
   * now carries the run truth as well, so this call is where D-01's line 2 and its gutter both
   * come from, and there is still exactly one of it.
   */
  const face = cardFace(row, now)
  const runnable = face.runnable
  /** D-01 slot 1's key, and line 2's tone. One derivation, two paints — never two switches. */
  const gutter = runGutterOf(face.run)

  /**
   * D-13 / D-14 — the id of the one consequence sentence, derived from the ROW id. That
   * shape is the page's own precedent, not an invention: `WorkflowDeleteSheet.tsx:126`
   * builds `wf-delete-${wf.id}` the same way, and RESEARCH measured it as the only
   * `aria-describedby` the shipped page had.
   */
  const consequenceId = `wf-fork-${row.id}`

  /**
   * D-18 — the single-draft endpoint, and NEVER the cascade pair. The cascade client and its
   * preview client resolve a SLUG and destroy every version under it, which for one draft
   * destroys far more than the person asked for. Both are reachable from this card only
   * THROUGH the Sheet, which is the only place their semantics are correct — so their
   * identifiers are described here rather than spelled, because the check that proves this
   * module never reaches them is a raw source count that prose would satisfy (the trap
   * `192-08` recorded on the page and `192-06` recorded before that).
   *
   * The row does not leave the list until the server confirms — `onDeleted` re-fetches, and
   * nothing here vanishes optimistically (the D-LOCK-04 rule the Sheet also honours).
   */
  async function confirmDeleteDraft() {
    if (deleting) return
    setDeleting(true)
    setDeleteFailed(false)
    try {
      await deleteWorkflowDraft(row.id)
      setArmed(false)
      onDeleted()
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  /**
   * Whether this row's owner is the person looking at it — read through the SHIPPED predicate
   * rather than re-tested here, because a second copy of it is the drift D-03 forbids by name.
   * It gates the heavy delete: the shipped starter card never offered one, the endpoint behind
   * it is owner-gated server-side, and offering an action that can only fail is the dishonesty
   * this whole phase exists to remove.
   */
  const owned = CHIP_PREDICATES.yours(row)

  /** D-06's mark, resolved from the face's KEY — the card's one icon-convention decision. */
  const MarkIcon = MARK_ICON[face.mark]

  /**
   * Phase 193-06 (AUTH-03 — D-13 / D-14 / D-15 / D-21) — CAN THIS ROW BE HANDED A TEMPLATE?
   *
   * SC#3 says *a user with a template to fill can find where to supply it*, and that search
   * starts at the row rather than inside the Run modal. This is the one word that tells a
   * person, before they open anything, that this workflow expects something from them.
   *
   * ── D-13: A PLAIN TEXT SEGMENT. NO CHIP, NO BADGE, NO NEW COLOUR, NO NEW COMPONENT ──────
   * It joins `identityParts` as a `string`, muted by the line's existing classes and separated
   * by the `·` the line already spends:
   *
   *     Yours · <the mark> · changed 2 months ago
   *
   * ⚠ The mark's WORDS are deliberately NOT SPELLED anywhere in this file, not even in this
   * prose. They have ONE home — `CARD_TEMPLATE_MARK` in `libraryVocabulary.ts`, so a copy change
   * is a one-line diff in one file — and this plan's acceptance check is a RAW SOURCE COUNT of
   * them, which a docblock quoting the string would silently satisfy. That is the 187-24 trap
   * this file's header already records twice, applied a third time.
   *
   * ⚠ AND THE STATED REASON IS CORRECTED HERE RATHER THAN REPEATED, because the inherited one
   * measures FALSE. D-13's own text justifies the plain-text ruling by citing 188.2's two-badge
   * ceiling and its `@ts-expect-error` control. That control guards the CANVAS `PhaseNodeCard`,
   * a different component: **there is no badge ceiling of any kind under `library/`, and NO
   * PLAN, TEST OR COMMENT MAY CLAIM A TYPECHECK ENFORCES THIS ONE.** The ruling STANDS on the
   * reason that actually applies — SEED-155 / UAT U8, where sketch 163 drew a chip treatment
   * this card structurally could not render, and a bordered chip here would repeat U8 exactly.
   * What DOES guard it mechanically is structural and lives in this file's suite: the direct
   * child count of the line is `1 + 2 × identityParts.length`, so a mark that arrived as any
   * new node type reds there. An icon-only mark was rejected too — an unlabelled glyph is the
   * same discoverability failure AUTH-03 exists to fix.
   *
   * ── D-15: SILENCE ON ANYTHING BUT A POSITIVE YES ────────────────────────────────────────
   * The comparison is `=== "admits"`. `"does-not-admit"` and `"unknown"` BOTH render nothing
   * and are deliberately INDISTINGUISHABLE — the same rule the `when` slot below already
   * follows, where `undefined` means *the wire did not say* and the honest rendering of that is
   * no segment. **Absence of the mark must never be readable as an assertion that no template
   * is needed.** ⚠ The Run modal falls back the OPPOSITE way on `unknown` (D-20, `193-07`),
   * because there a silent hide would strip a shipped capability. That asymmetry is a decision;
   * do not "fix" the two into consistency.
   *
   * ── NO NEW PROP, AND NOT A `RowIdentity` FIELD ──────────────────────────────────────────
   * `row.def` is already on the row type, and an in-card derivation from `row` is the shipped
   * practice one line up. `RowIdentity`'s four fields are all properties of the row's PLACE IN
   * THE LIST, resolved by an index built over `[rows]`; a definition-derived fact is a category
   * error there and would force `rowIdentity.ts` to learn about definitions.
   *
   * ── D-21's COST, STATED NOT SMOOTHED ────────────────────────────────────────────────────
   * Live scoring over the 145 published rows is **1 admits / 34 does-not-admit / 110 unknown**,
   * so the mark is visible on exactly ONE published row locally — `ephemeral-template-fill-101uat`.
   * 16 of the 17 emit-phase published rows already BIND a library template (on which the
   * run-time upload is unreachable code, so the mark would be false), and 110 carry a `phases: []`
   * stub nobody authored. A UAT row driven against any other slug cannot see this feature.
   */
  const templateMark = templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []

  /**
   * Phase 192.1-06 (D-03 / D-06) — the identity line's parts AFTER the owner word, in the one
   * grammar the generated build contract declares:
   *
   *   [own pill] [the AUTH-03 mark] [computed seg] · [computed seg] [1 of N] · changed <rel>
   *
   * ⚠ THE `null`s ARE DROPPED HERE RATHER THAN RENDERED AS BLANKS, and that is what makes the
   * separator rule mechanical instead of a matter of care: the card spends a `·` BETWEEN
   * present parts and nowhere else, so a row with no recency reads `Yours` and never `Yours ·`.
   * A dangling separator promises the reader something that is then not said, which is the same
   * class of defect as an empty state that lies.
   *
   * ⚠ INDEX 0 IS D-14's SLOT, AND IT IS *AFTER* PROVENANCE RATHER THAN FIRST — stated here so
   * it is not re-derived later. `identity.own` is rendered SEPARATELY as the pill and this array
   * begins after it, so index 0 of `identityParts` is immediately after provenance, giving
   * *whose it is · what it needs · which copy · when it changed*, with recency still last where
   * 192.1 put it. The mark must NOT be placed before `own`: 192.1 asserts the provenance node at
   * DOM position 2 BY CHILD ORDER, and the whole point of asserting by child order was that it
   * does not move. `templateMark` spreads an empty array on the two silent arms, so a row that
   * does not admit composes byte-identically to the way it did before this phase.
   */
  const identityParts: string[] = [
    ...templateMark,
    // ⚠ BUG-260819-01 — THE STATE WORD RENDERED TWICE ON A NAME-COLLIDING ROW, and this is the
    // one line that closes it. Confirmed live, reading (as flowing text) e.g.
    // `… Shared starter | SHARED • Shared starter • …`.
    //
    // BOTH SPELLINGS ARE CORRECT IN ISOLATION, WHICH IS WHY NEITHER PRODUCER IS AT FAULT AND
    // NEITHER IS BEING CHANGED. `rowIdentity.ts` ranks four discriminating axes over the rows
    // that share a name and `state` is one of them, so on three same-named rows of three
    // different provenances it correctly returns the state as the segment that narrows. Line 2
    // — D-01's answer to *"does this one work?"* — renders `face.state` UNCONDITIONALLY, on
    // every row, by design (its own docblock: *"NEITHER HALF IS EVER BLANK"*). Composed, the
    // card says one word twice within about forty pixels.
    //
    // ⚠ THE FIX IS A DE-DUPLICATION AT THE ONE PLACE THAT CAN SEE BOTH, AND NOWHERE ELSE. The
    // card is the only module holding `face` and `identity` at once: `cardFace` cannot know
    // what the resolver ranked, and the resolver cannot know that this surface prints the state
    // unconditionally (a THIRD surface consuming `RowIdentity` may not). Filtering inside
    // `rowIdentity.ts` would break the ranker's own arithmetic; suppressing line 2 would break
    // its totality guarantee. So the LIST drops the segment, because line 2 has already said it
    // — the same "spend a `·` BETWEEN present parts and nowhere else" honesty this array
    // already applies to `ofN` and `when`.
    //
    // ⚠ NO DISCRIMINATION IS LOST, and that is the property that makes this safe rather than
    // merely tidy. The dropped segment's whole job is to tell two namesakes apart by state; the
    // state is still on the card, one line up, on EVERY row including the ones with no
    // collision. A reader comparing two namesakes reads it in the same glance either way.
    //
    // The comparison is `!==` against the resolved business word, never against a provenance
    // spelling: the two producers already share ONE vocabulary home (`libraryVocabulary.ts`),
    // so equal words are provably the same word rather than two that happen to look alike.
    ...identity.segs.filter((seg) => seg !== face.state),
    ...(identity.ofN === null ? [] : [identity.ofN]),
    ...(identity.when === null ? [] : [identity.when]),
  ]

  /** Every row state has something behind `⋯` — the fork and the two delete grades. */
  const showOverflow = true

  return (
    <div
      data-testid={ROOT_TESTID[row.provenance]}
      data-card="workflow-card"
      data-provenance={row.provenance}
      className={
        CARD_CLASSES + (row.provenance === "draft" ? " border-dashed border-border" : " border-border")
      }
    >
      {/* ── D-01 SLOT 1 — THE GUTTER ─────────────────────────────────────────────────
          The last-run outcome, as a 3px mark running the card's full height. It is
          `aria-hidden` BY DESIGN, not by omission: it repeats, in colour, a fact line 2
          states in words, so a reader who cannot see the colour loses nothing at all.
          `data-run` carries the arm so a test can prove the colour tracks the sentence
          without asserting a class (T-20). */}
      <div
        data-testid="run-gutter"
        data-run={gutter}
        aria-hidden="true"
        className={GUTTER_CLASSES + " " + GUTTER_TONE[gutter]}
      />

      <div className={CARD_BODY_CLASSES}>
      {/* ── Card chrome (NOT a soul atom): name/version header, folder chip, ⋯ ─────── */}
      {/* ⚠ 200-PORT — `flex-1` JOINS THE COLUMN AND THE `⋯` LEAVES THE FLOW.
          The sheet runs the status line and the meta line the FULL WIDTH of the card, under a
          header row that holds the title and the overflow trigger. Here they live INSIDE the
          header's left column (192.2-05 put them there and the suite pins them by child order
          at indices 1 and 2), so a `⋯` sitting in the flow clipped both lines 32px short of
          the card's right edge — visible as a ragged right margin down a two-column grid.
          Absolutely positioning the trigger at the card's own top-right renders it in exactly
          the place `justify-between` did, and returns the width to the two lines that need it.
          `pr-8` is what keeps a long name from running under it. */}
      <div className="flex flex-1 items-start justify-between gap-2 pr-8">
        <div className="min-w-0 flex-1">
          {/* ⚠ 200-PORT — `items-baseline`, the sheet's own alignment for this pair: the
              version sits on the NAME's baseline rather than on its optical centre, which is
              what stops a 11px mono token from looking like it is floating beside a 14px word. */}
          <div className="flex items-baseline gap-2">
            <MarkIcon data-testid="row-mark" className={MARK_ICON_CLASSES} aria-hidden="true" />
            <span className={NAME_CLASSES}>{face.lead}</span>
            {face.version !== null && <span className={VERSION_CLASSES}>{face.version}</span>}
          </div>

          {/* ── D-01 LINE 2 — THE ANSWER TO *"DOES THIS ONE WORK?"* ─────────────────────
              The run truth in words, then the state in business words. This is the whole
              of LIB-06 on the resting card, and it is why the five soul atoms could go.

              ⚠ IT SITS AT DOM POSITION 2, DISPLACING THE IDENTITY LINE TO POSITION 3, and
              that is a decision rather than a drift. 179-C is SILENT on the question — the
              sketch rendered no identity line at all — so what governs is D-01, which
              numbers this slot as line 2. Burying the run truth under a five-part identity
              line would make the answer this phase exists to give the card's FOURTH line.
              `WorkflowCard.test.tsx`'s child-order assertions moved in the same wave, which
              is exactly what asserting placement by child order was for.

              ⚠ NEITHER HALF IS EVER BLANK. `runWord` is total over `RunFact`'s three arms
              (`cardFace.ts` states that at the field), and `state` is total over the three
              provenances — so this line always says two things, on every row, including a
              row whose feed carried no run keys at all. */}
          <div data-testid="row-answer" className={ANSWER_CLASSES}>
            {/* ⚠ 200-PORT — the sheet's leading mark. Three arms, and the third draws nothing;
                see `ANSWER_DOT_CLASSES` / `ANSWER_GLYPH_CLASSES` for why each is what it is.
                `data-run` repeats the gutter's key so a test can prove the two marks track ONE
                derivation rather than asserting a colour class. */}
            {gutter === "not-by-you" ? (
              <User data-testid="row-answer-glyph" className={ANSWER_GLYPH_CLASSES} aria-hidden="true" />
            ) : gutter === "unknown" ? null : (
              <span
                data-testid="row-answer-dot"
                data-run={gutter}
                aria-hidden="true"
                className={ANSWER_DOT_CLASSES + " " + GUTTER_TONE[gutter]}
              />
            )}
            <span className={RUN_TONE[gutter]}>{face.runWord}</span>
            <span aria-hidden="true" className="text-border">
              {ANSWER_SEPARATOR}
            </span>
            {/* ⚠ D-06 — `face.state`, AND THE SYSTEM SPELLINGS ARE GONE FROM THIS FILE. It read
                `LEGACY_STATE_PILL[face.mark]`, a map of `published` / `Starter` / `draft`: raw
                lifecycle tokens rendered at the user. `cardFace` has returned the business word
                since 192.2-02 — `Ready to run` / `Shared starter` / `Still building`, imported
                from `libraryVocabulary.ts` and never re-spelled — and this is the one edit that
                was left for it, which is the whole return on that extraction. The card now
                spells NO lifecycle word anywhere; `row.provenance` reaches `cardFace` as an
                input key and nothing else. */}
            <span className={STATE_TONE[face.mark]}>{face.state}</span>
          </div>

          {/* ── THE 14TH ATOM — THE IDENTITY LINE (D-06 / D-08 / D-09 / D-10) ───────────
              161-A's PLACE, 160-B's CONTENT: DOM POSITION 2 inside this `min-w-0` column,
              immediately after the name row and BEFORE the folder chip. Its own suite
              asserts that by CHILD ORDER, never by a class name — a class assertion passes
              on a node in the wrong column and fails on a Tailwind tidy-up.

              ⚠ IT IS UNCONDITIONAL, AND THAT IS THE DECISION RATHER THAN AN OVERSIGHT. The
              consequence sentence below is gated on `runnable`, so every DRAFT renders no
              sentence today — and drafts are precisely the rows most likely to be a person's
              own half-finished forks, i.e. the rows that most need to say what they came
              from. This line sits OUTSIDE that guard (D-10). What varies between a colliding
              row and a unique one is the CONTENT the page hands down, never the presence of
              the node: D-06 `quiet` keeps 161-A's consistent placement while spending
              discriminators only where they buy something.

              ⚠ EVERY WORD HERE ARRIVES RESOLVED. No string is assembled in this file — D-14
              makes a copy change a one-line diff in `libraryVocabulary.ts`, and a card that
              spelled `"Copy of "` inline would have silently forked the acceptance bar. */}
          <div
            // Part of the shipped test surface, carried as a LITERAL for the same reason the
            // root testids and `aria-label="Workflow actions"` are (`:435-437` below). It is
            // this phase's ONE net-new test hook, and there is exactly one node per card.
            data-testid="row-identity"
            className={IDENTITY_CLASSES}
          >
            <span className={owned ? IDENTITY_OWN_YOURS : IDENTITY_OWN_SHARED}>{identity.own}</span>
            {identityParts.map((part, index) => (
              // The index belongs in the key: two parts CAN carry the same text (a version
              // segment and a lineage phrase both reduce to short strings), and the list is
              // rebuilt wholesale from a prop on every render, so there is no identity to
              // preserve across one.
              <Fragment key={`${index}-${part}`}>
                <span aria-hidden="true">{IDENTITY_SEPARATOR}</span>
                <span>{part}</span>
              </Fragment>
            ))}
          </div>

          {/* ⚠ D-06's FOURTH EMOJI, and it is evicted with the other three. The chip is a KEEP
              atom — the project's NAME still renders, in the same place, at the same size — but
              its leading folder character was an emoji on the card exactly like the provenance
              marks were (again unspelled, for the reason `MARK_ICON`'s docblock gives), and
              CONTEXT's constraint is *no emoji anywhere on the card*. Same house set, same
              muted tone; `inline-block` becomes `inline-flex` only because the glyph is now a
              sibling element rather than a character in the text run. */}
          {/* ⚠ 200-PORT — IT NOW MATCHES THE LINE ABOVE IT, and it is a RESTYLE not a move.
              Sketch 200 carries the project INSIDE the meta run (`YOURS • Main • 42 share this
              name • …`). It is NOT moved there: the folder chip is `column.children[3]` and the
              suite asserts this column's order by INDEX, so a merge would be a structural change
              to a pinned composition for a purely typographic gain. Instead it takes the meta
              line's exact register — 11px, uppercase, letter-spaced, muted — so the two read as
              one continuous block that happens to wrap, which is what the sheet draws. */}
          {folderName && (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase leading-tight tracking-wider text-muted-foreground">
              <Folder className="h-3 w-3 flex-none" aria-hidden="true" />
              {folderName}
            </span>
          )}

          {/* ── 192.2-09 (WR-04) — WHY THIS ROW IS HERE ────────────────────────────────
              THE LAST CHILD, BELOW EVERYTHING, AND USUALLY ABSENT. D-01 numbers the run
              truth as line 2 and the identity line already displaced to position 3 in
              Wave 4; a reason for a filter the person just applied is subordinate to both
              and must not push either down. Its placement is asserted by CHILD ORDER,
              never by a class name — a class assertion passes on a node in the wrong
              column and fails on a Tailwind tidy-up.

              ⚠ THE GUARD IS THE WHOLE DESIGN ARGUMENT, NOT A PERFORMANCE TRICK. On the
              resting card the array is empty and this renders NO NODE — which is why
              `WorkflowCard.baseline.test.tsx` comes through byte-unchanged and why this
              line cannot become a back door for the six atoms D-03 removed. `matchReasons`
              itself emits ids ONLY for facts the card cannot otherwise show, and NOTHING at
              all for a name hit, because `HighlightTitle` has already answered that one.

              ⚠ NO STRING IS SPELLED HERE. The prefix, the words and the separator all come
              from `libraryVocabulary.ts` (D-14: a copy change is a one-line diff in one
              file), and the reason NAMES the purpose field without ever quoting the
              user-authored sentence inside it (T-192.2-40). */}
          {matchReasons.length > 0 && (
            <div data-testid="row-match-reason" className={MATCH_REASON_CLASSES}>
              <span>{MATCH_REASON_PREFIX}</span>
              {matchReasons.map((reason, index) => (
                <Fragment key={reason}>
                  {index > 0 && <span aria-hidden="true">{MATCH_REASON_SEPARATOR}</span>}
                  <span>{MATCH_REASON_WORDS[reason]}</span>
                </Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ⚠ 200-PORT — OUT OF THE FLOW, INTO THE CARD'S OWN TOP-RIGHT. Same pixel position the
            header row's `justify-between` put it in (the card's `p-4` and this offset agree);
            what changes is that it no longer takes width from the two full-bleed lines below.
            See the header row's own note. */}
        <div className="absolute right-3 top-3 flex flex-none items-center gap-1">
          {showOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  // The menu has no visible name, so this accessible one is load-bearing.
                  // Carried over as a LITERAL from `WorkflowsPage.tsx:821` for the same
                  // reason the testids are: it is part of the shipped test surface.
                  aria-label="Workflow actions"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* ── The fork: ONE WORD, TWO FUNCTIONS (D-12) ──────────────────────
                    Both items carry the same label and route to DIFFERENT handlers.
                    Exactly one of them is reachable on any given row. */}
                {row.provenance === "published" && (
                  <DropdownMenuItem
                    data-testid="published-tweak"
                    aria-describedby={consequenceId}
                    onClick={() => onForkNewVersion(row)}
                  >
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}
                {row.provenance === "starter" && (
                  <DropdownMenuItem
                    data-testid="use-starter"
                    aria-describedby={consequenceId}
                    onClick={() => onForkStarter(row)}
                  >
                    {FORK_VERB}
                  </DropdownMenuItem>
                )}

                {/* The heaviest guard's trigger — the ONLY control on this card that
                    wears destructive weight. It merely ASKS the Sheet to open. */}
                {runnable && owned && (
                  <DropdownMenuItem
                    data-testid="published-delete"
                    className={DESTRUCTIVE_ITEM_CLASSES}
                    onClick={() => deleteSheetRef.current?.openDeleteSheet()}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {DELETE_WORKFLOW_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── D-18: the LIGHTER grade, and lighter by a measurable amount ────
                    The published row's guard fetches exact server counts, names its
                    victim and drives an in-place lifecycle. A draft has no published
                    history, no runs and no threads to destroy, so it earns the middle
                    grade instead: one extra click, no fetch. This item ARMS. */}
                {!runnable && (
                  <DropdownMenuItem
                    data-testid="draft-delete"
                    className={DESTRUCTIVE_ITEM_CLASSES}
                    onClick={() => {
                      setDeleteFailed(false)
                      setArmed(true)
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {DELETE_DRAFT_LABEL}
                  </DropdownMenuItem>
                )}

                {/* ── THE ONE SENTENCE THIS SURFACE SPENDS (D-13 / D-14) ────────────
                    Real DOM text, wired to the fork control by `aria-describedby` — so
                    the explanation reaches a touch user and a screen reader alike, which
                    the hover-only tooltip it replaces never did. It names BOTH halves:
                    what you get, and what stays true. Naming only the first half
                    reproduces the exact surprise LIB-03 exists to end, which is why the
                    sentence is imported rather than typed.

                    ⚠ 192.2-05 (D-03, threat T-21): IT MOVED HERE FROM THE RESTING CARD,
                    AND MOVING IS NOT DELETING. D-03 cuts it from the resting card — it was
                    a two-line paragraph on every runnable row, i.e. most of the shelf — but
                    it warns about a real consequence before a real act, so it is spent at
                    the MOMENT IT IS NEEDED instead: in the menu, directly under the verb it
                    describes, where the person is when the warning is worth anything. The
                    `aria-describedby` round trip is unchanged and still asserted.

                    ⚠ IT IS NOT A MENU ITEM — AND THE ORIGINAL REASONING FOR THAT WAS
                    CORRECT BUT INSUFFICIENT, WHICH IS WHY IT IS AMENDED HERE RATHER THAN
                    REPLACED. It said: *"A plain `<p>` inside the content carries no role,
                    takes no focus and is skipped by Radix's roving focus and typeahead, so
                    the menu still offers exactly the actions it offered."* Every clause of
                    that is true, and **that property still holds with `DropdownMenuLabel`**
                    — the label is equally unfocusable and equally skipped, so nothing about
                    the menu's offered ACTIONS changes.

                    What it missed is a different contract (WR-03): ARIA's
                    `aria-required-children` requires the children of `role="menu"` to be
                    `menuitem` / `menuitemradio` / `menuitemcheckbox` / `group` /
                    `separator`, and a raw `<p>` is NONE of them — so the menu was
                    MISDESCRIBED to assistive technology even though it behaved correctly
                    for a sighted mouse user.

                    ⚠ THE FIX IS `DropdownMenuGroup`, **NOT** `DropdownMenuLabel`, AND THE
                    CHANGE OF PRIMITIVE IS MEASURED RATHER THAN PREFERRED. Both the review's
                    fix block and this plan's DEC-11-E named `DropdownMenuLabel` as *"the same
                    visual node with a valid role"*. **Both halves of that are false**, and
                    each was checked rather than argued:

                      · IT CARRIES NO ROLE AT ALL. Radix's `Menu.Label` is a bare
                        `Primitive.div` with no `role` prop
                        (`@radix-ui/react-menu/dist/index.mjs:356-362`), so swapping to it left
                        the five-role sweep still RED — `div[role=none]` where it had said
                        `p[role=none]`. That is a renamed defect, not a fixed one.
                      · IT IS NOT THE SAME VISUAL NODE. `DropdownMenuLabel` merges
                        `"px-2 py-1.5 text-sm font-semibold"` UNDER our `className`, and
                        `MENU_NOTE_CLASSES` names no font weight — so the note would have
                        rendered SEMIBOLD, a pixel change D-03 did not sanction on a card this
                        phase exists to quieten.

                    `Menu.Group` renders `role="group"` and nothing else
                    (`index.mjs:348-354`), so this is ONE node, a permitted role, and the
                    identical paint. It is also exactly the review's own parenthetical
                    alternative — wrap it in a `role="group"` — reached through the
                    shipped primitive instead of a hand-rolled div.

                    ⚠ THE `aria-describedby` ROUND TRIP IS UNCHANGED AND STILL ASSERTED:
                    `id`, `data-testid` and `className` all move across verbatim, so the two
                    fork items still resolve to this node and its existing round-trip cases
                    pass UNEDITED.

                    ⚠ AND AXE DID NOT CATCH THIS — measured, not assumed. `vitest-axe`
                    (axe-core 4.11.4) over the REAL open menu, opened by driving the trigger,
                    passed GREEN against the `<p>` under jsdom; `aria-required-children` never
                    fired. So the fence that actually holds WR-03 is the explicit five-role
                    sweep over the menu's direct element children in `WorkflowCard.test.tsx`,
                    which was driven RED twice — once on the `<p>` and once on the
                    `DropdownMenuLabel` attempt — and named the offending node both times.

                    ⚠ 192-13: WHICH sentence depends on the row's real state. On a row the
                    person has already forked, the verb opens their EXISTING draft and
                    creates nothing, so promising "a new private copy" there would be a quiet
                    lie. STILL EXACTLY ONE NODE: the sentence is selected, never appended. */}
                {runnable && (
                  <DropdownMenuGroup
                    id={consequenceId}
                    data-testid="fork-consequence"
                    className={MENU_NOTE_CLASSES}
                  >
                    {hasExistingFork ? FORK_CONSEQUENCE_EXISTING : FORK_CONSEQUENCE}
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── The ONE primary verb (D-09) ──────────────────────────────────────────────
          Exactly one per row state, chosen by provenance. A draft reaches no Run
          affordance anywhere on this card, menu included. */}
      <div className={FOOTER_CLASSES}>
        {runnable ? (
          <button
            type="button"
            data-testid="published-run"
            onClick={() => onRun(row)}
            className={PRIMARY_CLASSES}
          >
            {/* ⚠ 200-PORT — the sheet's `play_arrow`, as an `aria-hidden` node beside the word
                rather than as a character inside it. The accessible name is unchanged: it was
                and is the visible word (the glyph never carried meaning, only weight). */}
            <Play className={VERB_ICON_CLASSES} aria-hidden="true" />
            {RUN_LABEL}
          </button>
        ) : (
          <button
            type="button"
            data-testid="draft-open"
            onClick={() => onOpen(row)}
            className={SECONDARY_CLASSES}
          >
            {/* The sheet's `open_in_new`, on the same 200-PORT rule as `Play` above. */}
            <ExternalLink className={VERB_ICON_CLASSES} aria-hidden="true" />
            {OPEN_LABEL}
          </button>
        )}
      </div>

      {/* ── D-18's armed prompt — the deliberate SECOND step ─────────────────────────
          `MaintenancePanel.tsx:100-131`'s shipped shape. It appears only once the menu
          item has armed it, it states the consequence in words and NO COUNT, and a
          failure is said out loud rather than swallowed. */}
      {armed && (
        <div
          data-testid="draft-delete-prompt"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5"
        >
          <p className="text-[13px] font-medium text-foreground">{DELETE_DRAFT_PROMPT}</p>
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="draft-delete-cancel"
              onClick={() => setArmed(false)}
              disabled={deleting}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {DELETE_DRAFT_CANCEL}
            </button>
            <button
              type="button"
              data-testid="draft-delete-confirm"
              onClick={confirmDeleteDraft}
              disabled={deleting}
              className={
                "inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[13px] font-semibold text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-60"
              }
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {DELETE_DRAFT_CONFIRM}
            </button>
          </div>
          {deleteFailed && (
            <p data-testid="draft-delete-error" role="status" className="mt-2 text-[11.5px] text-destructive">
              {DELETE_DRAFT_FAILED}
            </p>
          )}
        </div>
      )}

      {/* The WFIN-03 victim-naming Sheet (192-08), mounted as a black box: this card
          holds a ref and forwards two props, and decides none of the guard. */}
      {runnable && owned && (
        <WorkflowDeleteSheet
          ref={deleteSheetRef}
          wf={row.source as DeletableRow}
          onDeleted={onDeleted}
        />
      )}
      </div>
    </div>
  )
}
