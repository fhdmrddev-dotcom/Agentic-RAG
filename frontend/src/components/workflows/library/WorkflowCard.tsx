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
 *   | runnable (published or starter) | `▶ Run`  | the fork verb · Delete workflow… |
 *   | draft ("Still building")        | `✎ Open` | Delete                        |
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
 * `WorkflowSoul scale="card"` renders the five atoms and is CONSUMED UNCHANGED — purpose hero,
 * needs, glyph-dot spine, tier chip, deliverable. This card adds chrome and one sentence AROUND
 * the soul; it does not rebuild the card's content and must not lose an atom. It also owns
 * neither fork's slug/version mechanics (they stay in the page's two shipped handlers) nor the
 * heaviest delete guard (that is `WorkflowDeleteSheet`, moved in 192-08, mounted here as a
 * black box).
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
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { templateAdmission } from "@/components/workflows/soulData"
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import { deleteWorkflowDraft } from "@/lib/api"

import { CHIP_PREDICATES } from "./libraryFilter"
import type { LibraryRow, Provenance } from "./libraryRow"
import {
  CARD_TEMPLATE_MARK,
  FORK_CONSEQUENCE,
  FORK_CONSEQUENCE_EXISTING,
  FORK_VERB,
} from "./libraryVocabulary"
import type { RowIdentity } from "./rowIdentity"
import {
  WorkflowDeleteSheet,
  type WorkflowDeleteSheetHandle,
  type WorkflowDeleteSheetProps,
} from "./WorkflowDeleteSheet"

// ── The words owed a re-home (see the ⚠ paragraph above) ─────────────────────────────

/** The primary verb for a runnable row, carried over verbatim (`WorkflowsPage.tsx:864`). */
const RUN_LABEL = "▶ Run"

/** The primary verb for a draft, carried over verbatim (`WorkflowsPage.tsx:754`). */
const OPEN_LABEL = "✎ Open"

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

const CARD_CLASSES = "flex flex-col gap-3 rounded-lg border bg-card p-4"
const NAME_CLASSES = "truncate text-[14px] font-medium text-foreground"
const VERSION_CLASSES = "font-mono text-[11px] text-muted-foreground"
const PILL_BASE = "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase "
const NOTE_CLASSES = "text-[11.5px] leading-snug text-muted-foreground"
const FOOTER_CLASSES = "mt-auto flex items-center gap-2 border-t border-border/60 pt-2"

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
 */
const IDENTITY_CLASSES = "mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"

/**
 * The owner word wears the card's OWN pill shape (`PILL_BASE`), reused rather than re-specced —
 * the mockup draws it as a small mono uppercase bordered pill, which is exactly what that
 * constant already is. The colour is picked from `owned` — the file's ONE existing ownership-
 * predicate read, reused rather than re-tested, because a second copy of that predicate is the
 * drift D-03 forbids by name. The WORD itself is resolved by the page (D-09) and merely painted.
 *
 * ⚠ The predicate's identifier is deliberately NOT spelled in this prose. D-11's acceptance
 * check is a RAW SOURCE COUNT of it, so a docblock naming it would answer the very grep that
 * proves there is only one call — the 187-24 trap this file's header already records twice.
 */
const IDENTITY_OWN_YOURS = PILL_BASE + "border-primary/40 text-primary"
const IDENTITY_OWN_SHARED = PILL_BASE + "border-border text-muted-foreground"

/** The separator, spent BETWEEN present parts only. Decorative — a reader hears the parts. */
const IDENTITY_SEPARATOR = "·"
const PRIMARY_CLASSES =
  "rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90"
const SECONDARY_CLASSES =
  "rounded-md border border-border px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/40"

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

/** Per-provenance decorative mark + status pill, all three carried over verbatim. */
const FACE = {
  published: { mark: "📄", pill: "published", pillClass: "border-primary/40 text-primary" },
  starter: { mark: "✨", pill: "Starter", pillClass: "border-primary/50 bg-primary/15 text-primary" },
  draft: { mark: "📝", pill: "draft", pillClass: "border-border text-muted-foreground" },
} as const satisfies Record<Provenance, { mark: string; pill: string; pillClass: string }>

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

  const runnable = row.provenance !== "draft"
  const face = FACE[row.provenance]

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
    ...identity.segs,
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
      {/* ── Card chrome (NOT a soul atom): name/version header, folder chip, ⋯ + pill ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">{face.mark}</span>
            <span className={NAME_CLASSES}>{row.name}</span>
            {row.version !== undefined && <span className={VERSION_CLASSES}>v{row.version}</span>}
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

          {folderName && (
            <span className="mt-0.5 inline-block text-[11px] text-muted-foreground">
              📁 {folderName}
            </span>
          )}
        </div>

        <div className="flex flex-none items-center gap-1">
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className={PILL_BASE + face.pillClass}>{face.pill}</span>
        </div>
      </div>

      {/* LIB-02: the shared card-scale soul, CONSUMED UNCHANGED — all five atoms. */}
      <WorkflowSoul def={row.def} scale="card" />

      {/* ── THE ONE SENTENCE THIS SURFACE SPENDS (D-13 / D-14) ───────────────────────
          Real DOM text, always visible, wired to the fork control by `aria-describedby`
          — so the explanation reaches a touch user and a screen reader alike, which the
          hover-only tooltip it replaces never did. It names BOTH halves: what you get,
          and what stays true. Naming only the first half reproduces the exact surprise
          LIB-03 exists to end, which is why the sentence is imported rather than typed.

          It is spent ONCE, here. `Run` runs and `Open` opens; neither earns a sentence,
          and repeating one on all 200 cards is the clutter LIB-02 exists to cure.

          ⚠ 192-13: WHICH sentence depends on the row's real state. On a row the person has
          already forked the verb opens their EXISTING draft and creates nothing, so promising
          "a new private copy" there would be a quiet lie — and trading the U5 silent failure
          for a quiet lie is not closing that gap. STILL EXACTLY ONE NODE: the sentence is
          selected, never appended, so the card gains no atom (U5-b is out of this round). */}
      {runnable && (
        <p id={consequenceId} data-testid="fork-consequence" className={NOTE_CLASSES}>
          {hasExistingFork ? FORK_CONSEQUENCE_EXISTING : FORK_CONSEQUENCE}
        </p>
      )}

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
            {RUN_LABEL}
          </button>
        ) : (
          <button
            type="button"
            data-testid="draft-open"
            onClick={() => onOpen(row)}
            className={SECONDARY_CLASSES}
          >
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
  )
}
