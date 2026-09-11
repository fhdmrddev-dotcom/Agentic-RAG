#!/usr/bin/env node
/* ==========================================================================
 * vitest-count-gate.cjs — the D-184-08 per-file test-COUNT differential gate.
 * ==========================================================================
 * Why this exists (Phase 184 / D-184-08, the mechanical half):
 *   Phase 177 taught the lesson the hard way: a failures-only differential
 *   CANNOT see a *deleted* test. A refactor that quietly drops an `it(...)`
 *   block leaves the suite green and the coverage smaller. So Wave 0 pins
 *   per-FILE counts, not just the failure count.
 *
 *   This script is BASELINE INFRASTRUCTURE: it ships in its own single-file
 *   commit BEFORE any Wave-0 source change, so every later Wave-0 commit
 *   (including plan 184-01's own icon swap, and plans 184-02 / 184-03) is
 *   measured against a stick that already existed.
 *
 *   Structural sibling: scripts/check-181-scope-freeze.sh — same shape
 *   (why/usage/notes header, explicit exit codes, named failure reasons,
 *   never a watch flag).
 *
 * The pin (measured on `develop`, 2026-07-26 — see
 * .planning/phases/184-editable-canvas-live-structural-validation-round-trip/
 * 184-VALIDATION.md § "Wave 0 Count Pin"): 16 files / 424 tests / 0 failing.
 *
 * THE PIN HAS MOVED TWICE. The two events are different in kind and the
 * difference is the whole rule, so both are recorded rather than collapsed:
 *
 *   1. LOWERED — Phase 185 plan 185-08 (SPEC Req 6) DELETED the three-face
 *      grounding word-badge and the ~9 `it()` blocks that covered it, so
 *      `phaseVocabulary.test.ts` went 42 → 33 and the pinned total 424 → 415.
 *      That re-pin rode in the SAME COMMIT as the deletion, and its number was
 *      READ FROM THIS SCRIPT'S OWN OUTPUT (the `actual` column) rather than
 *      hand-computed — which is the only honest way to move a pin. A deletion
 *      that lands without its pin edit leaves HEAD red; a pin edit that lands
 *      without the deletion leaves the gate blind to the NEXT deleted test. See
 *      .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/
 *      185-RESEARCH.md § L-9.
 *   2. EXTENDED — Phase 187 plan 187-25 ADDED two files that were already
 *      running inside `TARGETS` but carried no pin: `definitionOps.test.ts` (232)
 *      and `SeedReceipt.test.tsx` (68), pinned total 415 → 715. Nothing was
 *      lowered and nothing was deleted; two suites that had become load-bearing
 *      stopped being deletable with the gate green. See the map entry below.
 *   3. EXTENDED AGAIN — Phase 187 plan 187-29 added the three suites carrying
 *      gap-closure round 5's honesty estate: `DescribeKbPicker.test.tsx` (30),
 *      `ProblemsTray.test.tsx` (30) and `verdictModel.test.ts` (29), pinned
 *      total 715 → 804. **This is an EXTENSION, not a lowering, and the
 *      difference is the whole rule:** an extension has NO deletion behind it
 *      and needs none — only a LOWERING requires a deliberate, plan-authorised
 *      deletion to ride in the same commit. Nothing was removed, no existing
 *      pin moved by a single test, and all three numbers came from the `actual`
 *      column of two agreeing runs. See the map entry below.
 *   4. EXTENDED AND DE-SLACKED — Phase 188 plan 188-12 pinned EVERY file the
 *      gate executes, at the `actual` it reported across two agreeing runs on
 *      2026-08-05 (total 2421 · failed 0, identical per-file columns). Pinned
 *      total 1037 → 2421 across 26 → 45 files. Nothing was lowered; every
 *      movement is an increase or a first pin.
 *
 *      WHY the whole set, and not just Phase 188's own suites: a pin BELOW a
 *      file's real count is not a weaker guard, it is NO guard for the cases in
 *      the gap. `PhaseReconcile.test.tsx` was pinned at 2 while running 12 — the
 *      ten in the slack were every falsification test Phase 188 wrote, all of
 *      them deletable with the gate green. That is verbatim the "verification
 *      truth 14" failure Phase 187 shipped and had to correct afterwards, and it
 *      was flagged as owed by five separate 188 plans (188-02/04/05/06/07/08)
 *      before this one closed it. The same slack existed in five inherited pins
 *      (`canvasModel.purity` 69/143, `phaseVocabulary` 33/96, `canvasModel` 26/49,
 *      `PublishGauntlet` 24/46, `PhaseSpineGraph` 14/20) and fifteen files ran
 *      inside TARGETS with no pin at all (including `canvasModel.roundtrip.test.ts`
 *      at 517 — a single file holding more cases than the entire original pin).
 *
 *      Adopting them into BASELINE imports NO rot: they were already inside
 *      TARGETS, so the gate already required them to pass. The only thing that
 *      changes is that deleting one is now visible. (Contrast the 188-01
 *      blast-radius argument for declining a bare TARGETS *directory* entry —
 *      that adds files the gate must keep green forever, which is a real cost.
 *      A BASELINE entry for a file already inside TARGETS is not.)
 *
 *      CONSEQUENCE, stated plainly: BASELINE_TOTAL now EQUALS the measured total,
 *      so the gate has zero slack. A legitimate deletion must move its pin in the
 *      SAME commit — which is the rule below, now actually enforced rather than
 *      merely written down.
 *
 * **A pin is LOWERED only alongside a deliberate, plan-authorized deletion —
 * never to make a red gate go quiet.** Adding a pin needs no deletion; it needs
 * only that the number came from the `actual` column of a run, not from a hand
 * count of `it(` literals (`definitionOps.test.ts` declares ~118 literals and
 * runs 232 cases, because of `it.each`).
 *
 * The gate FAILS (exit 1) when:
 *   [failing-tests]        numFailedTests > 0
 *   [total-below-baseline] numTotalTests < BASELINE_TOTAL
 *   [missing-file]         a pinned baseline file did not run at all
 *   [count-decrease]       a pinned file reports FEWER tests than its pin
 * A count that INCREASED is ALLOWED and printed as `+N` — feature waves add
 * tests. Wave 0 must not change any of them.
 *
 * Usage:
 *   node scripts/vitest-count-gate.cjs              # run the suite, then gate
 *   node scripts/vitest-count-gate.cjs --json PATH  # gate an existing report
 *
 * Notes:
 *   - `--reporter=json` ONLY. `--reporter=basic` was REMOVED in vitest 4, and
 *     a watch flag must never appear in a committed command.
 *   - The JSON report is written under the OS temp dir — NEVER into frontend/
 *     or backend/. A scratch file inside a watched tree wedges the vite /
 *     uvicorn reload watchers on Windows (the project's "no scratch in a
 *     watched tree" rule). The resolved path is printed on every run and the
 *     script refuses to write inside the app tree.
 *   - Committed tooling: imports NOTHING from frontend/src, needs no database,
 *     no backend and no network.
 *
 * Exit codes: 0 = gate green · 1 = gate violated · 2 = harness error.
 * ========================================================================== */

"use strict"

const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

// ── The pin. Keyed by BARE filename (testResults[].name is an absolute path). ──
const BASELINE = {
  "Seam.test.tsx": 8,
  "TodosSection.test.tsx": 12,
  "CitationList.test.tsx": 15,
  "RunCard.test.tsx": 29,
  "RunCard.timer.test.tsx": 7,
  "ChatArea.approval.test.tsx": 3,
  // ── Phase 237 (RULES-01 / SC#1 / SC#3) — Classification rules & arrival watch builder suites ──
  "ClassificationRulesPage.test.tsx": 8,
  "ClassificationSection.test.tsx": 13,
  "RuleBuilderPanel.test.tsx": 8,
  // ── 196-05 (AUTH-04 / D-04 … D-15) — THREE NEW FILES, each pinned in the SAME COMMIT ──
  // ── that creates it, because a `BASELINE` key naming a path that does not yet exist ──
  // ── makes this gate ERROR (exit 2) rather than fail. ──────────────────────────────────
  //
  // A `TARGETS` edit accompanies exactly ONE of the three, and which one is CHECKED rather
  // than assumed. `modelFitness.test.ts` and `ModelField.test.tsx` live in
  // `src/components/workflows`, already a DIRECTORY entry in the `TARGETS` array below, so
  // they RAN the moment they existed and this script printed them as `— 18 new` and
  // `— 32 new` before these lines were written. `useModelRegistry.test.ts` lives under
  // `src/hooks`, which has NO directory entry anywhere in this script, so it needed both
  // knobs — the reasoning is recorded beside its `TARGETS` line rather than duplicated here.
  // TARGETS decides what RUNS, BASELINE what is GUARDED.
  //
  // ⚠ AN UNPINNED FILE IS NOT A LIGHTLY-GUARDED ONE, IT IS AN UNGUARDED ONE. All three
  // numbers were READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed
  // them, never hand-counted from `it(` literals and never taken from a planning document —
  // this plan's own text quotes none of them for exactly that reason.
  //
  // What would be unguarded without these three entries:
  //
  //   • `ModelField.test.tsx` (32) — ⚠ THE MOST LOAD-BEARING OF THE THREE. It carries the
  //     ONLY mechanical guard on the no-write-on-open property: a SOURCE fence over the
  //     component's own `?raw` text asserting zero component-state and zero effect tokens,
  //     with a positive control run over an inline fixture that DOES contain them and a
  //     non-vacuity floor. No shipped picker suite in this tree asserts that a form performs
  //     no write when it is merely opened, and a form that rewrites a stored value as a side
  //     effect of being LOOKED AT is a silent integrity change to a saved definition. Also
  //     here: the hedged-vs-degraded inherit label in both arms (the whole of D-06's refusal
  //     to assert a default the code does not implement), the `(current)` retention for a
  //     disabled AND an unknown id, and the absence assertions — no free-text path, no
  //     grouping without the deliverable flag, no engine token without the reveal — which
  //     are the easiest kind of case to delete unnoticed.
  //
  //   • `modelFitness.test.ts` (18) — the whole-table properties of the tier vocabulary:
  //     the three locked sentences, the demonstration that a containment assertion on them
  //     is vacuous by construction (the strongest sentence CONTAINS the middle one), and
  //     the two separate fallback paths a single coalesce would collapse into one — the
  //     read-time default for an ABSENT tier and the boundary guard for an UNRECOGNISED
  //     one, both landing on the weakest word rather than on blank.
  //
  //   • `useModelRegistry.test.ts` (11) — that a FAILED read resolves to a distinct member
  //     and NOT to an empty success, with a positive control proving a genuinely empty
  //     registry still reads as ready. Without it, a failed fetch would render as a
  //     perfectly calm picker offering nothing but its inherit option — a defect that LOOKS
  //     exactly like a correct render, which is why a reviewer cannot be the guard.
  "ModelField.test.tsx": 32,
  "modelFitness.test.ts": 18,
  "useModelRegistry.test.ts": 11,
  // ── 196-07 (D-18 / BUG-260718-04) — TWO NEW FILES, pinned in the SAME COMMIT that ─────
  // ── creates them. ADDITIVE beside 196-05's three keys directly above: nothing there ───
  // ── was restructured, renumbered or removed. ─────────────────────────────────────────
  //
  // Both needed a `TARGETS` line as well as a pin — `src/hooks` and `src/components/chat`
  // each have only FILE-LEVEL entries and no bare-directory entry, so neither suite would
  // have executed at all. The reasoning is recorded beside those `TARGETS` lines rather
  // than duplicated here. TARGETS decides what RUNS, BASELINE what is GUARDED.
  //
  // ⚠ BOTH NUMBERS WERE READ FROM THIS SCRIPT'S OWN `actual` COLUMN, on the run that first
  // executed them (printed as `— 17 new` and `— 2 new`), never hand-counted from `it(`
  // literals and never taken from a planning document — this plan's own text quotes
  // neither, for exactly that reason.
  //
  // ⚠ AN UNPINNED FILE IS NOT A LIGHTLY-GUARDED ONE, IT IS AN UNGUARDED ONE. What would be
  // unguarded without these two entries:
  //
  //   • `useComposerModel.test.ts` (17) — ⚠ THE LOAD-BEARING ONE. It carries the ONLY
  //     mechanical guard on D-18's derivation, and three of its cases guard things nothing
  //     else in this tree asserts. (a) THE TWO SKIPS: a `model` of `undefined` on user-role
  //     rows (which have no run row and therefore no model) and the LITERAL `"unknown"`,
  //     which is not a sentinel anybody invented — 121 live `runs` rows carry it, and
  //     restoring it would put an id in the composer that no provider offers. The skip
  //     cases place those rows AFTER the run-backed one, so a derivation that simply read
  //     the last element fails rather than passes. (b) THE ORDER: `provider` is applied
  //     BEFORE `model`, asserted as a SEQUENCE on the exported pure function the hook
  //     itself calls. React batches the two setState calls, so an end-state assertion
  //     would pass against a REVERSED implementation right up until `handleProviderChange`
  //     clobbered the restored model in production — where the symptom is "fixed on mount,
  //     broken after any provider interaction", the hardest shape there is to notice.
  //     (c) THE DISABLED REFUSAL, which is what keeps the composer from pre-selecting a
  //     model the runtime would refuse to run.
  //
  //   • `ChatArea.model.test.tsx` (2) — small on purpose and NOT redundant with the above.
  //     It answers the one question a pure derivation cannot: does the restored value reach
  //     the control an operator actually looks at. Its second case is a CONTROL, not a
  //     duplicate — same component, same providers, only the messages differ, requiring the
  //     global default instead. Without the pair, "the composer shows claude-5-haiku" is
  //     satisfied by any picker that renders the last item of any list. It stays thin
  //     because `ChatArea` mounts the real `StreamsProvider`, which is exactly why the
  //     branch coverage lives in the hook suite and not here.
  "useComposerModel.test.ts": 17,
  "ChatArea.model.test.tsx": 2,
  // Phase 226 — src/landing (pinned at the merge commit; pre-flight F-6 kept the phase off this file while 224-05 edited it)
  "landingBundleFence.test.ts": 2,
  "facts.test.ts": 5,
  "cssClasses.test.ts": 1,
  "scenes.test.tsx": 9,
  "LandingPage.test.tsx": 7,
  "MessageInput.connectors.test.tsx": 5,
  // SEED-235 (2026-09-01): 15 -> 19. Four cases for the SECOND approval in one run —
  // three for the defect (a stale decision rendered the next question as already answered
  // and blocked its submit) and one COUNTERWEIGHT proving a settled card does not flicker
  // back into a question. Read from the gate's own printed column.
  "ToolApproval.test.tsx": 19,
  "MessageInputDrafts.test.tsx": 5,
  // 187-25: PINNED NOW, because these two stopped being ordinary suites. Between
  // them they carry the whole Req-5 governance-honesty estate — CR-03's thirteen
  // carried-paragraph cases, CR-04's three post-arrival fences plus their leaf
  // fences, WR-09's cause fence and WR-12's word-class property, WR-11's no-actor
  // property and WR-15's two-half exhaustiveness pin, WR-14's agreement
  // biconditional, and WR-13's standing testid/state-attribute coverage sweep.
  // Both already RAN inside `TARGETS` (`src/components/workflows`) and counted
  // toward the total, but with no per-file pin the total sat far enough above the
  // floor to absorb a large deletion — so every one of those guards was deletable
  // with the gate green. That is verbatim the Phase-177 lesson this script exists
  // for. Leaving them unpinned WAS right while they held no load-bearing guard;
  // it stopped being right in round 4.
  // BOTH NUMBERS WERE READ FROM THIS SCRIPT'S OWN `actual` COLUMN (two runs of
  // `node scripts/vitest-count-gate.cjs`, 2026-08-04, agreeing at 232 / 68) —
  // never hand-counted, never taken from a planning document. Each was then
  // observed catching a deletion: one `it(` block removed per file reds the gate
  // with `[count-decrease]` naming that file.
  // 189-12: 232 → 243. The 7th `phase_type` (`external_action`, CONN-01) — five cases
  // pinning that it is APPENDED LAST with the shipped six unmoved, that its slug base and
  // its required-config arm answer, and that its config round-trips; plus a four-case
  // D-23 CROSS-LANGUAGE agreement block that reads `backend/app/models/harness.py` through
  // the `?raw` loader and asserts the client mirror equals the backend union in order.
  // Read from this script's own `actual` column, in the same commit as the tests.
  "definitionOps.test.ts": 243,
  "canvasModel.fixtures.test.ts": 100,
  // 188-12: 69 → 143. A stale-low pin inherited from 187-25 and flagged as owed by
  // five 188 plans. The 74 cases in the slack were deletable with the gate green.
  "canvasModel.purity.test.ts": 143,
  "SeedReceipt.test.tsx": 68,
  // 185-08: 42 → 33. Req 6 deleted the slot-1 grounding word-badge; the 9 `it()`
  // blocks over its three faces went with it. Measured, not computed.
  // 188-12: 33 → 96. The suite has grown by 63 since; de-slacked, not lowered.
  // 189-13 (CONN-01 / D-13): 96 → 112. An EXTENSION, not a lowering — no `it(` was deleted
  // or renamed; two shipped cases were WIDENED in place (their hand-typed six-type lists
  // became `PHASE_TYPE_ORDER` derivations) without changing the count. The +16 are the
  // capability tier's own block (all three sentences, the no-capability floor, the
  // unrecognised-name floor, the `constructor` own-guard probe, non-string totality, the
  // type gate, two ordering cases, the one-constant export, the integer-numbering source
  // assertion, the zero-imports source assertion, the GROUNDING_DIAL_TYPES pin), the
  // three-register word check, and `notConnectedOf`'s three cases. Read from THIS SCRIPT'S
  // OWN `actual` column, never hand-counted.
  // 190-05 (CONN-02 / D-24), 2026-08-08: 112 → 117. An EXTENSION, never a lowering — no
  // `it(` was deleted or renamed, and one shipped case (189-13's "SEPARATE LINES" seam)
  // was AMENDED IN PLACE without changing the count. The +5 are `notConnectedOf`'s state
  // test finally becoming falsifiable: the first genuine BOUND case in this suite's
  // history (`connection_id` set → badge absent), its unbound opposite, the
  // empty/whitespace/non-string boundary, the type half re-asserted BOUND as well as
  // unbound, and the zero-import property fence. Read from THIS SCRIPT'S OWN `actual`
  // column across the run that moved it (112 → 117, +5), never hand-counted — and the
  // pin moves in the SAME COMMIT as the tests, because this gate only fails on a
  // DECREASE, so a count that grows without its pin edit leaves the gate blind to the
  // NEXT deleted test rather than red.
  "phaseVocabulary.test.ts": 117,
  // 188-12: 31 → 46. GREW IN THIS PHASE — 188-06 added the seven-readings and ring-spec
  // cases, 188-07 the derives-nothing property and the type-only-import fence that is the
  // mechanical half of the G-5 diff cap. It began this phase pinned at 31 while running 35.
  // 188.1-01: 46 → 48. EXTENDED, never lowered, and read from this script's own printed
  // `actual` column across two agreeing runs rather than by counting `it(` literals. The two
  // cases are the move-invariant subtree-fence control (which keeps the file's twelve `?raw`
  // negatives from narrowing when 188.1-03 cuts 311 lines out of `WorkflowCanvas.tsx`) and
  // the editable SC#4 walk (the two shipped no-focusable-control assertions render READ-ONLY,
  // so neither ever mounted `PlaneEditingLayer` — the layer this phase moves).
  // 188.1-03 EXTENDED 48 → 52, read from this script's own `actual` column across two
  // agreeing runs (never by counting `it(` literals). The four are the ESM-cycle fence
  // SC#3 owes: the extraction's two new modules may not import `WorkflowCanvas` back in
  // ANY form, `editAffordance` must stay a leaf, and the canvas must import the layer
  // rather than declare it. A cycle there typechecks clean, lints clean and fails only at
  // RUNTIME, so nothing else in the battery can see it. Extension only — no test was
  // relocated by that plan and no pin was lowered.
  // 189-15 (CONN-01 / D-12 / D-18): 52 → 53. An EXTENSION, and specifically NOT a
  // replacement — the shipped grounding-chip absence guard was REWORDED IN PLACE and kept,
  // because its title was misleading (*"slot 1 is empty and reserved"*) while its assertion
  // was still true (it selects on `[data-grounding]` SPECIFICALLY, so 189 filling the slot
  // never broke it). Deleting it would have dropped the only canvas-level guard that the
  // retired 185 chip stays retired. The +1 is the real 189 guard beside it: the
  // `[data-not-connected]` attribute present on an `external_action` node and absent on all
  // six other types, over a roster derived from `PHASE_TYPE_ORDER`.
  // ⚠ 200-06: 53 → 89, and the +36 is DECOMPOSED rather than quoted as one number, because
  // only twelve of it is this plan's. The gate printed `53 89 +36` on the run that first
  // executed this plan's cases; the suite ran **77** immediately before them (measured by
  // running it alone on this same tree), so **+24 was PRE-EXISTING DRIFT** — 24 cases that
  // were deletable with the gate green — and **+12 is this plan's** (the payload seam, the
  // pass-through proof, the `constructor`-slug pair, the four states with hover/selection
  // driven for real, and the legend). The drift is ABSORBED DELIBERATELY here rather than
  // carried forward as another paragraph about it: an unpinned case is an unguarded one, and
  // this file's own eleven-times-stale marker is the standing evidence that a drift left in a
  // comment outlives every plan that noticed it. Read from the `actual` column, never counted.
  //
  // ⚠ AND RAISED AGAIN IN THE SAME PLAN, 89 → 93, by its OWN second commit (BC-MR-03): the
  // branch condition's four cases — the target step's NAME rather than its slug, no element
  // where no branch is declared, the broken branch stated ONCE on the stub, and a
  // `constructor`-slugged branch TARGET resolving to a step rather than to a function.
  // Read from the `actual` column on the run that first executed them.
  //
  // ⚠ AND A THIRD TIME IN THE SAME PLAN, 93 → 105, by its THIRD commit: `BUG-260813-01`'s
  // light-mode fence (the plane AND a node card, in BOTH directions, plus a
  // provider-broadcast toggle and the no-provider posture) and §3.2's MUST-NOT-RENDER fence
  // with its two permanent controls and the role-SET pin. Three raises in one plan are
  // recorded as three lines rather than one, because a single `53 → 105` would hide that
  // +24 of it was pre-existing drift and none of it was this plan's.
  //
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES THE PROVIDER WORK, and that was CHECKED rather than
  // assumed. `ThemeProvider.tsx` is a SOURCE file, not a suite: its behaviour is asserted
  // from `WorkflowCanvas.test.tsx`, which the `src/components/workflows` directory entry
  // already runs and this map already pins. Adding a `src/providers` TARGETS entry would
  // have pulled in unrelated unpinned suites and told nobody anything about this fix.
  "WorkflowCanvas.test.tsx": 105,
  // 187-29: gap-closure round 5's three suites, pinned for exactly the reason
  // 187-25 pinned its two — each now carries a guard that a failures-only
  // differential cannot see the deletion of:
  //   · DescribeKbPicker.test.tsx  — GAP A: the loose "Describe & run" door's
  //     knowledge-base picker itself — what it offers, what it refuses to invent,
  //     and (post-round-5) that it surrenders a choice it cannot show.
  //     ATTRIBUTION CORRECTED (WR-R5-02): this comment used to credit this file
  //     with the BORN-BOUND ROUND TRIP as well. It does not have it — this suite
  //     lists `generateWorkflow` in its FORBIDDEN_SYMBOLS and asserts it at zero
  //     calls. The round trip, and the two wire fences beneath it, live in
  //     `WorkflowDoorSwitch.test.tsx`. The mis-credit pointed away from the one
  //     unprotected fence, which is how it stayed unpinned.
  //   · ProblemsTray.test.tsx      — GAP B: the fence that the all-clear line
  //     and the "checked by the server" attribution CANNOT render before a check
  //     has answered. These are ABSENCE assertions with a positive control; an
  //     absence assertion is the easiest kind of case to delete unnoticed.
  //   · verdictModel.test.ts       — GAP B's other half: DEGRADED_SENTENCE's
  //     totality over the widened `TrayCheckCause` union, plus the word-class
  //     property that the never-ran sentence claims no pass and attributes
  //     nothing to a server. (⚠ its third member is spelled `not-run` on
  //     purpose — see that module's DO NOT "TIDY" THIS SPELLING docblock.)
  // ALL THREE NUMBERS WERE READ FROM THIS SCRIPT'S OWN `actual` COLUMN (two runs
  // of `node scripts/vitest-count-gate.cjs`, 2026-08-04, agreeing at 30 / 30 / 29)
  // — never hand-counted, never taken from a planning document. A hand count of
  // `it(` literals is not merely sloppy here, it is unsound: `definitionOps.test.ts`
  // declares ~122 literals and runs 232 cases because of `it.each`, and a pin BELOW
  // the real count can never fire. Each was then observed catching a deletion: one
  // `it(` block removed per file reds the gate with `[count-decrease]` naming that
  // file, at `failed 0` — the count decrease being the ONLY signal is the point.
  // POST-ROUND-5 CORRECTION (verification truth 14 FAILED). Round 5 pinned the three
  // suites above and believed "every guard round 5 added is pinned". It was not true.
  // A pinned TOTAL rising proves nothing about the NEW cases, because slack inside an
  // already-listed file absorbs them — measured: `WorkflowDoorSwitch.test.tsx` 13 pinned
  // / 21 actual (GAP A's ONLY end-to-end wire fence sat in the slack, deletable with the
  // gate green) and `WorkflowBuilderPage.canvas.test.tsx` 22 / 128 (the whole GAP-B and
  // GAP-C estate). Each is now pinned AT its actual, read from this script's own printed
  // `actual` column on the run that added `describe.test.tsx` to TARGETS above — never a
  // hand count of `it(` literals, which is unsound under `it.each`.
  // `DescribeKbPicker.test.tsx` 30 → 37: the 7 cases fencing CR-R5-01, the blocker round 5
  // shipped — a held folder id the server no longer offers is surrendered rather than sent
  // invisibly, because `POST /workflows/generate` mints `unbound_retrieval` on
  // `project_folder_id is None` and a dangling id would suppress the very verdict the
  // picker exists to help the author satisfy.
  "DescribeKbPicker.test.tsx": 37,
  "ProblemsTray.test.tsx": 30,
  "verdictModel.test.ts": 29,
  // 188-12 de-slacking, both inherited stale-low pins (26/49 and 24/46).
  // 189-13 (CONN-01 / D-12 / WR-04): 49 → 51. An EXTENSION. The +2 are the WR-04 probe on
  // the subtitles read this plan GUARDED (an inherited `phase_type` must yield the same
  // empty subtitle a table MISS yields — the case above it cannot see the difference,
  // which is why it is a separate case) and the `notConnected` projection case.
  // 189-15 (CONN-01 / D-12 / D-18): 51 → 52. An EXTENSION. The +1 asserts `notConnected` at
  // the PROJECTION level across the whole shipped roster rather than the three types
  // `threePhase` happens to contain — derived from `PHASE_TYPE_ORDER` via `minimalPhaseFor`
  // and compared as a RECORD, so a failure names the offending type and the eighth type
  // joins the coverage without anyone remembering to extend a list.
  "canvasModel.test.ts": 52,
  // 214.1-02 RE-BASELINE 46 -> 83. ⚠ NOT A BUMP: this pin was stale by 32 BEFORE Phase 214.1
  // began (the file ran 78 at wave 1's start), so it was leaving 37 cases deletable in
  // silence on the gauntlet — the publish surface. Reasons + the full six-pin table live in
  // the 214.1-02 block beside `declaredInputs.test.ts`.
  "PublishGauntlet.test.tsx": 83,
  "WorkflowBuilderPage.canvas.test.tsx": 128,
  // ⚠ 193.1-08 (D-24): 19 → 30 (+11). Read from THIS SCRIPT'S OWN `actual` column
  // (`WorkflowBuilderPage.describe.test.tsx 19 30 +11`), never counted by hand.
  //
  // The eleven cases mount the AUTH-03 pre-draft row on the GOVERN door's describe screen and
  // pin the SURFACE, not just the behaviour: there are two near-identical pre-draft describe
  // screens and the splice anchor occurs in both, so every case names its file in its title and
  // asserts a node only this one has. ⚠ AND NOTHING WAS RE-PINNED DOWNWARD TO GET HERE: this
  // suite's diff is `214 0` — ZERO deletions — so `FLAG_OFF_DESCRIBE_MARKUP` and the
  // `/template|starter/i` CTA-region guard are untouched, which is the mount's placement
  // argument rather than a lucky outcome.
  "WorkflowBuilderPage.describe.test.tsx": 30,
  // 193.1-01 (D-01 / D-02) — a NEW FILE, pinned in the SAME COMMIT that adds its `TARGETS`
  // entry, because a `BASELINE` key naming a path this gate does not EXECUTE would pin a
  // number nothing produces.
  //
  // ⚠ THIS ONE NEEDED **BOTH** KNOBS, AND THAT IS THE DIFFERENCE FROM THE THREE 193 ENTRIES
  // BELOW — measured, not assumed. `193-01`, `193-03` and `193-05` each record "NO `TARGETS`
  // EDIT ACCOMPANIES IT" because their files live under `src/components/workflows`, a
  // DIRECTORY entry, so the gate ran them the moment they existed. This file lives under
  // `src/pages`, which this array reaches by NAMED FILES ONLY — there is no `src/pages`
  // directory entry anywhere in `TARGETS`. So the gate would never have executed it, and a
  // file the gate never runs has falsified nothing. TARGETS decides what RUNS, BASELINE what
  // is GUARDED; here BOTH were missing.
  //
  // What would be unguarded without it: six whole-`innerHTML` characterization captures of
  // the pre-draft describe screen — flag ON and flag OFF × the three `builderPhase` arms —
  // taken on the UNMOVED tree at `5333518b`, where both modules Phase 193.1's later waves
  // create answer `does not exist in 'HEAD'` (exit 128). They are the only evidence the phase
  // will have that D-01's cut changed no pixel. Plus the two `/generate` KEY-SET assertions
  // that pin the wire BEFORE `template_placeholders` joins it (`SEED-157`), whose whole value
  // is that they must MOVE in the commit that changes the wire.
  //
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN (`WorkflowBuilderPage.preDraft.baseline.test.tsx
  // — 16 new`) on the run that first executed the file, never hand-counted from `it(` literals.
  // 193.1-07: 16 → 22. An EXTENSION — nothing deleted, nothing lowered, and in particular the
  // six captures and BOTH key-set literals above are byte-untouched (`git diff --numstat` on
  // that file for this plan is `120 0`, zero deletions).
  //
  // ⚠ AND THE +6 CORRECTS THE COMMENT DIRECTLY ABOVE, WHICH IS LEFT STANDING RATHER THAN
  // OVERWRITTEN. It says the two KEY-SET assertions' *"whole value is that they must MOVE in
  // the commit that changes the wire"*. Measured when that commit arrived: **they must NOT
  // move.** Both drive the page with no document supplied, and this screen has no way to
  // supply one until Plan 08 mounts the control — so their key sets are identical after the
  // wire and before it. That is not a missing feature, it is D-08 / SC#4 asserted at the page
  // level: a session that supplies nothing is untouched by construction. The six new cases pin
  // exactly that (the two key sets re-asserted AFTER the wire shipped, the CTA proved not
  // disabled, a source fence proving the page derives no key of its own, and two on D-06's
  // failure line being one `role="status"` node routed through NEITHER the save's refusal nor
  // the canvas notice). The mechanical evidence that the wire changed lives where the wire
  // lives — `useTemplateFirstDraft.test.tsx` §10, pinned above.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`preDraft.baseline 16 22 +6`).
  "WorkflowBuilderPage.preDraft.baseline.test.tsx": 22,
  // 193.1-09 (AUTH-03 / SC#3 / D-22): 19 → 24. An EXTENSION — nothing was deleted, renamed or
  // lowered; all 19 shipped cases are still here and still counted. The +5 pin the name-check
  // mount as the ONE GATED LINE this file's G-5 ledger row demands: absent-renders-nothing on
  // BOTH a non-emit and an emit step (the property that keeps every other mount of this panel,
  // including the flag-off Spine, byte-identical by construction), present-but-wrong-type
  // renders nothing, present-and-emit mounts and forwards the prop UNCHANGED (so the panel is
  // proved to derive nothing), the DOM-order assertion that it sits ABOVE the attach section,
  // and a SOURCE fence asserting the mount is exactly one line carrying both the type gate and
  // the whole-prop spread. Without that last one the "one gated line" claim is prose.
  // Read from THIS SCRIPT'S OWN `actual` column (`PhaseFormPanel.test.tsx 19 24 +5`).
  //
  // 196-08 (AUTH-04 / D-20): 24 → 38. AN EXTENSION, and the SAME kind as 193.1's above —
  // nothing was deleted, renamed or lowered; all 24 shipped cases are still here and still
  // counted, and the shipped one-gated-line fence is byte-unchanged. The +14 exist because
  // this phase REPLACED the four free-text `AI model` boxes with four registry-backed picker
  // mounts, and the shipped fence could not see any of it: it is scoped to the template
  // name-check mount, so a picker mount passes through it invisibly AND the panel could have
  // grown a memo to build the option list with that fence noticing nothing at all.
  //
  // ⚠ WHAT WOULD BE UNGUARDED WITHOUT THEM, since an unpinned case is an unguarded one:
  //
  //   • THE MOUNT SHAPE — exactly four mounts, guards compared as a SORTED SET against the
  //     four model-bearing step types, each forwarding the caller's answer whole. A bare
  //     length check passes a duplicate guard and a missing type alike; the set comparison
  //     fails both. Driven RED against a real ungated-mount plant in production source
  //     (`expected [ Array(4) ] to deeply equal [ 'llm_agent', …(3) ]`), then restored
  //     md5-identical — a fence never observed red is not evidence.
  //   • THE ABSOLUTE ZERO — `useMemo` / `useState` / `useEffect` counted on the panel's own
  //     `?raw` source and required to be 0, not merely non-increasing. All three measured 0
  //     before this phase, so a non-decrease criterion would have permitted the first one.
  //     Also driven RED against a real planted memo (`expected 1 to be +0`).
  //   • THE BLANK — 239 of 257 phases across the 270 stored definitions carry a blank
  //     `model`. That case renders the NAMED inherit option carrying the server-resolved id,
  //     and no phantom `(current)` row. It is the shape the overwhelming majority of real
  //     workflows are in, and nothing else in this tree asserts it end-to-end through the
  //     panel.
  //   • NO-WRITE-ON-OPEN across three stored values including an unknown one (D-07). The
  //     failure it catches is INVISIBLE on screen — a mount that normalised a stored value on
  //     open would silently rewrite those 239 blanks the first time anybody looked at them.
  //   • ABSENT ⇒ NO CONTROL AT ALL, and emphatically no free-text fallback. AUTH-04 is the
  //     claim that no path through this form accepts a typed model name; without this case a
  //     future "graceful degradation" that restores a text input reads as a fix.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`PhaseFormPanel.test.tsx 24 38 +14`).
  //
  // ── ⚠ 200-04 Task 3 (DES-02, `200-CHECKLIST.md` §1) — RAISED 38 → 74. ────────────────
  //
  // ⚠ NOTE THE ASYMMETRY, because it changes what a reviewer's grep should expect: ADDING a
  // pin is `+n / −0`, but RAISING one necessarily DELETES a line. So `git diff -U0 -- this
  // file | grep -c '^-[^-]'` is expected to be **exactly 1** for this plan — one raise here,
  // one pure addition (`toolNames.test.ts`) above — and a criterion of 0 would be right for
  // the add and WRONG for the raise.
  //
  // The +36 is this plan's §1 atom cases and nothing else, itemised so the number is
  // auditable rather than asserted:
  //   • 8 for the card sections `SP-MR-02`/`03`/`04` — the MODEL frame on all four
  //     model-bearing types, the fitness siting, NO EMPTY CARD when the registry answer is
  //     absent, the folders-by-name frame, the outside-change card with its mark and
  //     sentence, the consequence line that renders NOTHING when nothing is chosen, the
  //     `ARM_PINNED_TYPES` drift tie, and the `data-card`-not-`data-rail` guard.
  //   • 4 GREEN rows DRIVEN rather than grepped (`SP-MR-05`/`06`/`07` + `SP-MNR-04`) —
  //     ⚠ `ALREADY-SHIPPED` is not a pass in this phase; it was 57 of 105 verdicts in 199.
  //   • 5 for the `MUST NOT RENDER` fence (`SP-MNR-01`/`02`/`03`) INCLUDING its **two
  //     permanent non-vacuity controls** — a planted violation that must be FOUND (one plant
  //     per forbidden class, so a selector typo fails that case first and names the class),
  //     and a deliberate-absence case proving the predicate does NOT fire on honest copy, so
  //     nobody has to delete a true sentence to go green.
  //   • 3 for the two REPORT rows (`SP-4` / `SP-5`) and their own needle control.
  //
  // ⚠ THE FENCE WAS DRIVEN RED AGAINST REAL PLANTS IN PRODUCTION SOURCE, then both files
  // restored byte-exactly (`git status` clean on each). A ligature name + a model literal in
  // `StepCardSection.tsx` and a raw `{t}` in the panel's tool rail produced
  // `expected [ 'search_documents', …(3) ] to not include 'search_documents'` and
  // `llm_single: expected [ …(3) ] to deeply equal []` — three violations, one per class.
  // **A fence never seen red is not evidence**, and wave 3 of this phase found one that was
  // reached and still wrote nothing.
  //
  // ⚠ THE ABSOLUTE-ZERO HOOK PIN INSIDE THIS FILE WAS NOT TOUCHED, and that is MEASURED, not
  // promised: the whole `196-08 picker mounts` describe block (220 lines) diffs BYTE-IDENTICAL
  // against this plan's parent commit. D-11 is honoured by EXTRACTION — the card shell is a new
  // leaf holding no state — never by re-baselining a guard whose point is that it reads zero.
  "PhaseFormPanel.test.tsx": 74,
  // ── 200-04 Task 1 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-01`) — pinned in the SAME COMMIT
  // that creates the file, because *"an unpinned file is not a lightly-guarded one, it is an
  // unguarded one"* and because a `BASELINE` key naming a path that does not yet exist makes
  // this gate ERROR (exit 2) rather than fail.
  //
  // NO `TARGETS` EDIT ACCOMPANIES IT, and that is CHECKED rather than assumed: the file lives
  // under `src/components/workflows`, already a DIRECTORY entry in the `TARGETS` array below,
  // so the gate EXECUTED it the moment it existed. TARGETS decides what RUNS; BASELINE decides
  // what is PINNED, and the two knobs are needed together only for a path outside those
  // directory entries.
  //
  // What the 10 cases hold, so a later drop is visible as a loss rather than a number:
  //   • the RED-FIRST `constructor` and `__proto__` cases — the EIGHTH live WR-04
  //     prototype-key sink in this tree, observed RED against the shipped panel before the
  //     module existed (React REFUSED the function child, so the chip's label rendered as
  //     NOTHING AT ALL — worse than the predicted `[Function Object]`).
  //   • a POSITIVE CONTROL reproducing the shipped coalesced-bracket shape and proving it
  //     really is broken on those keys. Without it every negative could pass against a reader
  //     that was never at risk, and the mitigation would be ceremony.
  //   • COVERAGE as a SET DIFFERENCE against the 28 ids `get_tools(None)` offers — so a tool
  //     added server-side fails HERE rather than reaching a business user as a schema token.
  "toolNames.test.ts": 10,
  // 193.1-09 (AUTH-03 / SC#3) — TWO NEW FILES, pinned in the SAME COMMIT that creates them,
  // because a `BASELINE` key naming a path that does not yet exist makes this gate ERROR
  // (exit 2) rather than fail.
  //
  // NO `TARGETS` EDIT ACCOMPANIES EITHER, and that is CHECKED rather than assumed:
  // `src/components/workflows` is already a DIRECTORY entry in the `TARGETS` array below, so
  // the gate printed both as `— 29 new` before these lines were written. TARGETS decides what
  // RUNS, BASELINE what is GUARDED, and only the second was missing.
  //
  // What would be unguarded without them:
  //   • `templateNameBuckets.test.ts` — the exactly-once property over a REAL definition shape
  //     read out of the live corpus (not sketch 167's invented one), the declared precedence
  //     that makes the run-input bucket outrank a slug coincidence, all six defensive
  //     untyped-JSONB read shapes, and the SOURCE fence proving the module names neither of
  //     the two config keys D-20 measured as non-existent or category-wrong. That fence is the
  //     only thing stopping someone "fixing" the omission back in.
  //   • `TemplateNameCheck.test.tsx` — the degenerate render (8 of 8 named nowhere, the
  //     MEASURED common case) swept for alarm words; both empty-bucket arms compared against
  //     ONE SHARED expected value, which is what makes an empty bucket unable to become a
  //     claim; the disclaiming sentence on every non-empty render; D-11's cap proved to expand
  //     in the SAME DOM node; the D-12 write-callback sweep; and the D-14 fence-scope guard in
  //     three import spellings. Both of the last two were driven RED against real plants.
  //
  // Read from THIS SCRIPT'S OWN `actual` column, never hand-counted from `it(` literals.
  "templateNameBuckets.test.ts": 29,
  "TemplateNameCheck.test.tsx": 29,
  "WorkflowBuilderPage.test.tsx": 15,
  // 188-12: 14 → 20, inherited stale-low pin.
  // ⚠ 200-05 Task 2 (DES-02 / `200-CHECKLIST.md` §2): 20 → 35, and the FIRST 4 of those 15 are
  // DE-SLACKING, not new coverage. This file was running 24 while pinned at 20 — measured on
  // the unmodified tree at this plan's base, where the gate printed
  // `PhaseSpineGraph.test.tsx  20  24  +4`. **Four cases were deletable with the gate green**,
  // and *"a pinned TOTAL rising proves nothing about the NEW cases, because slack inside an
  // already-listed file absorbs them"* — so the slack is closed in the same commit that adds
  // the eleven run-tense cases, rather than letting them hide inside it.
  //
  // ⚠ RAISING A PIN NECESSARILY DELETES A LINE, so a `grep -c '^-[^-]'` expecting 0 is WRONG
  // for this hunk — unlike the two ADDED pins at the foot of this map, which are `+n / −0`.
  //
  // WHAT THE ELEVEN NEW CASES HOLD: the two halves of the optional-run-prop contract, and
  // neither is sufficient alone. (1) ABSENT ⇒ the render is BYTE-IDENTICAL to the authoring
  // one, compared as whole `innerHTML` rather than probed — that is 199-02's refusal (this
  // component reads a DRAFT definition and has NO run, so a duration or a branch outcome on it
  // is a FABRICATED claim) enforced by construction instead of remembered. (2) PRESENT ⇒ a
  // DIFFERENT DOM, copied from `PhaseFormPanel.rails.test.tsx:125`, because a prop that changed
  // nothing would pass (1) perfectly while being inert and nothing else would say so. Plus:
  // `never ran (skipped)` and `time not recorded` proved DIFFERENT readings on the rendered
  // spine; a declared `0` rendering while an ABSENT count renders no slot at all; and the
  // branch reading as a THREE-state read whose absent arm renders nothing, because
  // `branch not taken` would be a claim about a run nobody measured.
  // ⚠ 200-05 Task 3: 35 → 42, the §2.2 `MUST NOT RENDER` fence. It is sited HERE rather than
  // in `RunReceipt.test.tsx` (where that task's own file list put it) because a fence in an
  // unrelated suite is one nobody re-reads when the guarded component changes — declared as a
  // deviation in `200-05-SUMMARY.md`, not done quietly. It scans the RENDERED DOM plus the
  // ANNOUNCED text and sweeps a ROLE SET, which is the only predicate `199-03` measured as
  // able to fire (a `?raw` regex and a `queryAllByRole("button")` filter both passed GREEN
  // against a live planted violation there). It carries FOUR permanent positive controls, a
  // negative control proving the honest word `person gate` does not trip it, and TWO clean
  // shipped renders — authoring AND run tense — each asserted non-vacuous, because wave 3's
  // fence was reached and still wrote nothing on an empty queue. **It was driven against the
  // real component**: the legend, the raw chip and the `phase_index` line were planted back
  // into `PhaseSpineGraph.tsx`, the fence went RED naming `BS-MNR-01`, `BS-MNR-02` and
  // `BS-MNR-03`, and the source was restored byte-exactly (md5 `f14a58d7…` before and after,
  // `git diff --numstat` empty). ⚠ The plant also FALSIFIED the fence's own first draft: a
  // word-boundary regex MISSED a real chip, because adjacent DOM text nodes concatenate with
  // no separator (`Gather sourcesllm_agent`).
  "PhaseSpineGraph.test.tsx": 42,
  // 189-13 (CONN-01 / UI-SPEC §5a): 14 → 17. An EXTENSION, not a lowering — the six
  // individual PHASE_GLYPHS key assertions were NOT collapsed into the new property, they
  // were kept and the seventh added beside them, because a property rewrite that shrank
  // this file would (a) trip `[count-decrease]` and (b) be exactly how coverage silently
  // disappears. The +3 are the split-brain key-set identity property, its literal-driven
  // positive control (`sameKeySet(["a","b"],["a"])` is false), and the resolver sweep that
  // proves every slug in the string map resolves to a bundled component while an inherited
  // key still floors to null. Read from THIS SCRIPT'S OWN `actual` column, never hand-counted.
  // 193-02 (AUTH-03 / D-21 / D-25), pinned by 193-10's sweep: 17 → 33. An EXTENSION, never a
  // lowering — no `it(` was deleted, renamed or moved out of this file by Phase 193. The +16 are
  // `templateAdmission()`'s three states entered with REAL cases: the `llm_emit`-without-a-bound-
  // asset arm that admits, the bound-`assets[kind=="template"]` arm that does NOT (the 16-row
  // correction D-21 measured against the live DB), the `phases: []` arm that reads `unknown`
  // rather than a positive no, the five malformed shapes (`undefined` / `null` / `{}` /
  // `phases: null` / non-array `phases`), and the Pydantic-default case — an `llm_emit` phase
  // with NO `emitter` key still admits, which is the arm the shipped `RunModal.test.tsx` fixtures
  // at `:70-96` depend on.
  //
  // ⚠ CORRECTED ON MEASUREMENT (193 REVIEW WR-05): this enumeration previously listed
  // "missing `config`" as the fifth malformed shape. `ADMISSION_CASES` contains NO case whose
  // phase entry omits `config` — every phase in the table declares one — so that arm was
  // documented as guarded while being unguarded. The real fifth shape is `phases: null`. The
  // CODE half of WR-05 (a `config`-less phase list currently returns a POSITIVE
  // `does-not-admit`, where D-20's rule argues for `unknown`) is a behaviour question and is
  // deliberately NOT changed here — see `193-REVIEW.md` WR-05.
  //
  // ⚠ WHY THE RAISE IS NOT COSMETIC: `templateAdmission` is consumed by TWO surfaces under
  // OPPOSITE unknown-fallbacks (the card goes silent, D-15; the Run modal keeps the control,
  // D-20). The cases proving `unknown` is distinct from `does-not-admit` are the ONLY mechanical
  // thing preventing a later "tidy" collapsing the union back to a boolean — and a boolean cannot
  // express D-20. At the old pin of 17 every one of them was deletable with the gate green.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`soulData.test.ts 17 33 +16`), never hand-counted.
  // 193 REVIEW WR-05 / WR-07 (2026-08-14): 33 → 36, read from THIS SCRIPT'S OWN `actual`
  // column (`soulData.test.ts 33 36 +3`). Three `ADMISSION_CASES` rows the review found
  // missing: two `config`-silent shapes (the WR-05 arm, DRIVEN RED against a disabled `(2b)` —
  // both reported `expected 'does-not-admit' to be 'unknown'` — with the source restored
  // md5-identical), and the jsonb STRING SCALAR that 194 of 223 live rows actually carry,
  // which nothing pinned before despite being the dominant shape (WR-07).
  // 214.1-02 RE-BASELINE 36 -> 58 (214.1-01's RESERVED-key mirror cases). See the 214.1-02
  // block beside `declaredInputs.test.ts` for the measured six-pin table.
  "soulData.test.ts": 58,
  // 21 → 23: the two end-to-end WIRE fences for CR-R5-01 (a pick whose folder is gone,
  // and a pick that survived a failed re-fetch, each asserting the `project_folder_id`
  // KEY is absent from the request the client actually sends). Both observed RED with
  // the picker's single `onChange("")` severed.
  // 193-05 (D-24(a) / T-193-17 / T-193-18): 23 → 28, an EXTENSION and never a rewrite — the
  // five are the copy fence and its controls. Three are SCOPE (both `?raw` sources really
  // loaded at > 1000 chars, all 21 ids present in the needle list, the escaped spelling is
  // not a no-op; the swept list contains no test file; a planted literal IS caught in both
  // spellings) and two are the sweep itself, one per swept component. The 28 is read from
  // THIS SCRIPT'S OWN `actual` column, never hand-counted.
  //
  // Without this raise the fence would ship UNGUARDED: a later edit deleting all five cases
  // would leave `actual` back at 23 and the gate green, which is precisely the shape 193-03
  // records as "an unpinned covering suite is an unguarded one".
  // 193-09 (AUTH-01 / D-04 / D-22), pinned by 193-10's sweep: 28 → 33. An EXTENSION, never a
  // lowering — Phase 193 deleted no `it(` from this file; 193-08 re-valued literals inside shipped
  // cases (re-capture 1 of 2, WORDS) and 193-09 re-valued them again (re-capture 2 of 2,
  // STRUCTURE), neither of which changes a count. The +5 are the D-22 half of the restack: the
  // describe band's escape demoted identically to the govern one, asserted by CHILD ORDER with the
  // length check first, plus the cross-component source equality that PROVES the two demotions
  // agree — two class strings pulled out of two `?raw` sources and compared, because no single
  // rendered DOM hosts both bands.
  //
  // ⚠ THAT CROSS-COMPONENT CASE IS THE ONLY THING THAT CAN SEE D-22 DRIFT. The two bands live in
  // two files and never co-render, so a future edit demoting one and not the other typechecks
  // clean, lints clean and renders fine — exactly the "new inconsistency manufactured by the fix"
  // D-22 exists to prevent. Unpinned it was deletable at `failed 0`.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`WorkflowDoorSwitch.test.tsx 28 33 +5`).
  // 193 REVIEW WR-01 (2026-08-14): 33 → 34. ONE new `it.each` row, because the D-24(a) copy
  // fence gained its THIRD swept source — `@/pages/WorkflowBuilderPage.tsx`, the file that held
  // the ungoverned copy this phase had to fix and that the fence could not see. The new row was
  // driven RED against a re-typed `DESCRIBE_CTA` literal (`expected [ 'DESCRIBE_CTA/plain' ] to
  // deeply equal []`) and the plant restored md5-identical, so this pin guards a fence that is
  // PROVED to fire rather than one assumed to.
  // 193.1-05 (D-14 / AUTH-03): 34 → 35. ONE new `it.each` row, because the D-24(a) copy fence
  // gained its FOURTH swept source — `./useTemplateFirstDraft.ts`, the pre-draft
  // describe→generate concern cut off the Builder page under G-5 in this same wave. It imports
  // nothing from `doorVocabulary` today and is swept anyway: the sweep is RAW, that module's
  // docblocks discuss the CTA, and WR-01 is the standing proof that waiting for the import to
  // appear is the policy that produced the last gap. Driven RED against a real planted
  // `DESCRIBE_CTA` literal in that file — the value READ OFF the vocabulary module at plant
  // time rather than re-typed — which failed exactly as WR-01's fix recorded
  // (`expected [ 'DESCRIBE_CTA/plain' ] to deeply equal []`), and the plant was restored to a
  // content-identical blob. Read from THIS SCRIPT'S OWN `actual` column
  // (`WorkflowDoorSwitch.test.tsx 34 35 +1`).
  // 193.1-06 (D-14 / D-21 / D-28): 35 → 37. TWO new `it.each` rows, because the D-24(a) copy
  // fence gained its FIFTH and SIXTH swept sources in the wave that creates them —
  // `./DescribeTemplateRow.tsx` and `./templateFirstVocabulary.ts`.
  //
  // ⚠ THE SIXTH IS A DELIBERATE STRENGTHENING OF THE PLAN'S OWN ACCEPTANCE CRITERION, which
  // said this list goes to FIVE. The plan counted the component and did not count the
  // vocabulary module it creates in the same wave — leaving the HIGHER-RISK file outside the
  // sweep, because a vocabulary module is the single most likely place in this repository for a
  // governed sentence to be re-typed: re-typing strings is what the file is FOR. Sweeping the
  // component that renders the words while skipping the module that declares them is the WR-01
  // shape exactly.
  //
  // Both were driven RED against a real planted literal in their OWN file, the value READ OFF
  // the vocabulary module at plant time rather than re-typed:
  //   • `DescribeTemplateRow.tsx` → `expected [ 'DESCRIBE_CTA/plain' ] to deeply equal []`
  //   • `templateFirstVocabulary.ts` → `expected [ 'DESCRIBE_ATTACH_PROMPT/plain' ] to deeply
  //     equal []` — which additionally proves the 21 → 22 needle bump on the same line is
  //     CONNECTED, since that id did not exist in the needle set before this wave.
  // Both plants restored to byte-identical BLOBS (compared with `git show :<path>`, not the
  // working file — `git checkout` applies CRLF normalization on this box, so an on-disk md5
  // comparison after a restore is measuring the line endings, not the content).
  //
  // ⚠ 193.1-08 (D-24): 37 → 44 (+7). Read from THIS SCRIPT'S OWN `actual` column
  // (`WorkflowDoorSwitch.test.tsx 37 44 +7`).
  //
  // Seven cases for the row's OTHER mount — the loose door's, which is the screen sketch 165
  // actually rendered. Two of them were driven RED against real plants in production source
  // before being trusted: dropping the seed from the crossing spread turned the zero-request
  // case red (`expected "vi.fn()" to be called 1 times, but got 2 times`), and dropping the
  // `loading` term from this file's `canDraft` turned the D-07 gate case red. Both plants were
  // restored to the identical BLOB (`git hash-object` → `d5955076…`, compared as a blob rather
  // than an on-disk md5 because `git checkout` normalizes CRLF on this box).
  //
  // ⚠ `SWEPT_SOURCES` DOES **NOT** MOVE, and that is checked rather than assumed: this plan
  // creates NO module. Both of its mounts land in files the D-24(a) fence already sweeps
  // (`WorkflowDoorSwitch.tsx` and `WorkflowBuilderPage.tsx`), so the list stays at SIX and the
  // `toHaveLength(6)` assertion is untouched.
  "WorkflowDoorSwitch.test.tsx": 44,
  // ── 193.1-06 (AUTH-03 / D-04 / D-09 / D-14) — TWO NEW FILES, each pinned in the SAME ──
  // ── COMMIT that creates it, because a `BASELINE` key naming a path that does not yet ──
  // ── exist makes this gate ERROR (exit 2) rather than fail. ────────────────────────────
  //
  // NO `TARGETS` EDIT ACCOMPANIES EITHER, and that is CHECKED rather than assumed — the fifth
  // and sixth time this map records the same check: both live in `src/components/workflows`,
  // already a DIRECTORY entry in the `TARGETS` array below, so they RAN the moment they
  // existed and the gate printed `— 42 new` and `— 21 new` before these lines were written.
  // TARGETS decides what RUNS, BASELINE what is GUARDED, and only the second was missing.
  //
  // What would be unguarded without this entry: the 20 ORDERED ARM PAIRS. That loop is the
  // mechanised form of the inherited rule *these sentences may never merge* — a surface that
  // says "we read it and found no fields" about a document nobody opened is the exact defect
  // AUTH-03 was re-opened to remove. Every one of those 20 is an ABSENCE assertion, the easiest
  // kind to delete unnoticed, and each carries an INLINE positive control proving the arm
  // rendered its OWN nodes first (without it, an arm that rendered nothing would satisfy all
  // 20). Also here: the derived-count cases, asserted against `querySelectorAll("li").length`
  // rather than against the fixture, and OBSERVED RED against a planted hardcoded `8` (3 cases
  // failed, including the one named for a 5-field document); plus two injection cases proving
  // attacker-supplied placeholder names render as TEXT and create no element.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`DescribeTemplateRow.test.tsx — 42 new`).
  "DescribeTemplateRow.test.tsx": 42,
  // 193.1-07 (D-06 / D-25) — a FIRST PIN on a suite that has shipped since Phase 186 and that
  // this gate has NEVER EXECUTED. ⚠ Unlike every other entry in this map it needs BOTH knobs:
  // there is no `src/hooks` entry anywhere in `TARGETS`, so the accompanying `TARGETS` line is
  // what makes this number reachable at all. The full reasoning — and what the four new cases
  // guard — is recorded beside that entry rather than duplicated here.
  //
  // ⚠ AN ADOPTION, and MEASURED FIRST exactly as 188-10 requires of one: the suite ran
  // `1 passed (1) / 59 passed (59)` under plain vitest at cap 2 on 2026-08-15, i.e. ZERO
  // pre-existing failures, so it imports no rot into a gate that requires 0 failing forever.
  // 55 of those 59 are Phase 186's shipped autosave estate — the single-flight rule, the
  // receipt-names-what-it-wrote property, the halt taxonomy, the hold/release path and the
  // flag-off promise — every one of which has been deletable with the gate green until now.
  //
  // Read from THIS SCRIPT'S OWN `actual` column, never hand-counted from `it(` literals.
  "useDraftPersistence.test.tsx": 59,
  // What would be unguarded without this entry: the whole-table properties of the template-first
  // surface's words — non-emptiness, pairwise distinctness, the zero-import leaf claim, and the
  // two that carry this phase's honesty requirements. (a) The three no-fields footings are
  // asserted pairwise distinct BY NAME *and* non-substring, restating one level down the shipped
  // rule that a fact about the DOCUMENT and a fact about US may never merge. (b) EVERY message
  // function is proved to change with its argument and to interpolate the number it was given —
  // the mechanical statement of *no count is ever hardcoded*, which is what SC#2 rides on.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`templateFirstVocabulary.test.ts — 21 new`).
  "templateFirstVocabulary.test.ts": 21,
  // 193.1-05 (D-01 / D-24(b)) — a NEW FILE, pinned in the SAME COMMIT that creates its fence
  // widening, because a `BASELINE` key naming a path that does not yet exist makes this gate
  // ERROR (exit 2) rather than fail.
  //
  // NO `TARGETS` EDIT ACCOMPANIES IT, and that is CHECKED rather than assumed:
  // `src/components/workflows` is already a DIRECTORY entry in the `TARGETS` array below, so
  // the gate printed `useTemplateFirstDraft.test.tsx — 29 new` before this line was written.
  // TARGETS decides what RUNS, BASELINE what is GUARDED.
  //
  // What would be unguarded without it: the behaviour of the moved pre-draft concern (the
  // `canDraft` rule's three arms, the `/generate` body as a sorted KEY SET in two folder
  // states, the stamp-only-if-unbound rule, both honest-failure paths and the 124 CR-01
  // one-shot), plus the D-24(b) ESM-cycle fence over BOTH hosts in four import forms × two
  // suffix spellings — the only thing standing between this module and a TDZ cycle that
  // typechecks clean, lints clean and fails at runtime.
  //
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN (`useTemplateFirstDraft.test.tsx — 29 new`),
  // never hand-counted from `it(` literals.
  // 193.1-07 (D-19 / D-07 / D-08 / D-06): 29 → 58. An EXTENSION — nothing was deleted,
  // renamed or lowered; 193.1-05's 29 moved-behaviour and cycle-fence cases are all still here
  // and still counted. The +29 are the read state machine's five arms keyed on `File` OBJECT
  // identity (including the SAME-NAME / different-object case, which no shipped hook proves and
  // which a name-keyed implementation passes every other case of), the abort-is-silent arm with
  // its positive control, the seed's ZERO-REQUEST property that carries a completed read across
  // the door handoff, the D-07 gate on all four arms PLUS a SOURCE fence forbidding a second
  // "has a template" conditional (driven against a planted forbidden shape), the wire as a
  // sorted KEY SET on all five readings, and D-06's bind — whose central case asserts the
  // RETURNED PROMISE resolves on a SYNCHRONOUS throw, because a `void`-ed rejection has nowhere
  // to be caught. Read from THIS SCRIPT'S OWN `actual` column.
  "useTemplateFirstDraft.test.tsx": 58,
  // 193-05 (AUTH-01 / D-10 / D-11) — a NEW FILE, pinned in the SAME COMMIT that creates it,
  // for the same reason as the 193-01 entry below: a `BASELINE` key naming a path that does
  // not yet exist makes this gate ERROR (exit 2) rather than fail. No `TARGETS` edit
  // accompanies it and that is MEASURED, not assumed — `src/components/workflows` is already
  // a directory entry, so the gate printed `doorVocabulary.test.ts — 9 new` before this line
  // was written. TARGETS decides what RUNS, BASELINE what is GUARDED.
  //
  // What would be unguarded without it: the whole-table properties of the 21 governed door
  // words — the count, non-emptiness, pairwise distinctness against a DECLARED exception set,
  // the zero-import leaf claim that makes `DoorHeaderStrip`'s import cycle-safe, and the
  // demonstration that containment assertions on this table are vacuous by construction.
  // 193-08 (AUTH-01 / D-01 / D-02 / D-23), pinned by 193-10's sweep: 9 → 39. An EXTENSION, and
  // the largest single raise of this phase — nothing was deleted, renamed or moved; 193-05's nine
  // whole-table property cases are all still here and still counted. The +30 are what turned a
  // shape suite into a FALSIFICATION suite when variant D shipped: the 21 column-D literals
  // spelled ONCE each and exact-matched (a `toContain` on a fragment is vacuous — this table's own
  // header rule), five codepoints pinned individually because an en dash is invisible in a diff,
  // the `STRIP_LABEL_GOVERN: typeof DOOR_B_NAME` literal-type agreement fence (D-23, proved to
  // fire at 33 → 34 → 33 type errors), and the contract-agreement case that RE-PARSES
  // `BUILD-CONTRACT.generated.md` at test time and deep-equals it against the suite's own literals.
  //
  // ⚠ THE CONTRACT-AGREEMENT CASE IS THE PHASE'S ANTI-DRIFT INSTRUMENT: it is the only thing that
  // notices the generated acceptance bar and the shipped strings diverging. D-02's whole rule is
  // that column D is DERIVED and never re-typed; that rule is prose everywhere except in this one
  // case. At the old pin of 9 it sat in thirty cases of slack, deletable with the gate green.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`doorVocabulary.test.ts 9 39 +30`).
  //
  // 193.1-06 (AUTH-03 / D-21 / D-28), re-pinned 39 → 41. An EXTENSION again — nothing deleted,
  // renamed or weakened. The +2 are the 22nd governed id's own exact-match case (the loop runs
  // over the UNION of the two governed sets, so the id inherited it automatically) plus ONE new
  // case that is the interesting one:
  //
  // ⚠ THE CONTRACT-AGREEMENT CASE HAD TO BE RE-SCOPED, AND THE NEW CASE IS WHAT KEEPS THAT
  // HONEST. `DESCRIBE_ATTACH_PROMPT` comes from a DIFFERENT acceptance bar (sketch 165's slot,
  // reworded by D-21/D-28); the generated doors-copy contract has no row for it and never will.
  // Widening the parse until it "found" 22 would have made this file's anti-drift instrument
  // report on a row its own source does not contain. So the contract case is scoped to
  // `CONTRACT_ID_COUNT` (21) and a NEW case asserts every post-contract id is genuinely ABSENT
  // from the contract, in both the parsed table and the raw source — which is what stops
  // `POST_CONTRACT_COPY` becoming a place to park any id someone would rather the generator did
  // not check. Without that pin the new case sits in slack and is deletable with the gate green.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`doorVocabulary.test.ts 39 41 +2`).
  "doorVocabulary.test.ts": 41,
  // 193-01 (D-08 / AUTH-01) — a NEW FILE, pinned in the SAME COMMIT that creates it, which is
  // the only commit it CAN be pinned in: a `BASELINE` entry naming a path that does not yet
  // exist makes this gate ERROR (exit 2) rather than fail.
  //
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES IT, and that is MEASURED rather than assumed — the same
  // check `runVocabulary.test.ts` and `libraryFork.test.ts` above record. The file lives in
  // `src/components/workflows`, already a DIRECTORY entry in TARGETS, so it RAN the moment it
  // existed: the gate printed `WorkflowDoorSwitch.baseline.test.tsx — 17 new` before this line
  // was written. TARGETS decides what RUNS, BASELINE what is GUARDED, and only the second was
  // missing.
  //
  // What would be unguarded without it: the six whole-`innerHTML` characterization captures of
  // `WorkflowDoorSwitch` taken on the UNMOVED tree at `501b3c14` — the only evidence Phase 193
  // will have that lifting the govern band into `DoorHeaderStrip.tsx` and the copy into
  // `doorVocabulary.ts` (both proved nonexistent at that commit, exit 128) changed no pixel.
  // Half of its rows are ABSENCE assertions and one is the D-05 `ml-auto` pair, which is the
  // easiest kind of case to delete unnoticed and the whole reason the six-state shape exists.
  //
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN (`— 17 new`), never hand-counted from `it(`
  // literals — the house rule this header states twice and `librarySubtree.fences.test.ts`
  // records five times.
  "WorkflowDoorSwitch.baseline.test.tsx": 17,
  // 193-03 (D-05 / D-24(b) / AUTH-01) — a NEW FILE, pinned in the SAME COMMIT that creates it,
  // for the reason the entry above states: a `BASELINE` key naming a path that does not yet
  // exist makes this gate ERROR (exit 2), so this is the only commit it CAN be pinned in — and
  // an unpinned covering suite is an UNGUARDED one, not a lightly-guarded one.
  //
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES IT, MEASURED rather than assumed for the fourth time in this
  // map: the file lives in `src/components/workflows`, already a DIRECTORY entry in TARGETS, so
  // it RAN the moment it existed — the gate printed `DoorHeaderStrip.test.tsx — 12 new` before
  // this line was written, which is where the 12 comes from. TARGETS decides what RUNS, BASELINE
  // what is GUARDED, and only the second was missing.
  //
  // What would be unguarded without it: the D-05 `ml-auto` PAIR (present standalone, absent
  // inline) — the whole risk of lifting the govern band out of `WorkflowDoorSwitch.tsx`, and
  // asserted here against the class string READ OUT OF `WorkflowBuilderPage.header.test.tsx`'s
  // band literal rather than re-typed — plus the D-24(b) ESM-cycle fence, whose four cases are
  // ABSENCE assertions (the easiest kind to delete unnoticed) and which was observed RED against
  // two real back-import plants, one per spelling of `allowImportingTsExtensions`.
  //
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN, never hand-counted from `it(` literals — and
  // note the count is 12 from SEVEN `it()`s, because two are `it.each` over both `inline`
  // values, which is exactly why hand-counting is forbidden here.
  // 193-09 (AUTH-01 / D-03 / D-04), pinned by 193-10's sweep: 12 → 16. An EXTENSION, never a
  // lowering — 193-05 NARROWED this suite's 193-03 `not.toMatch(ANY_IMPORT)` leaf claim into an
  // EQUALITY over a permitted-specifier list plus an import-line count, in place and at an
  // unchanged case count, so no pin moved then. The +4 are the D-04 shape: the escape carrying no
  // border class, the borrowed divider sitting between it and the door label, and the four-child
  // order pin driven at BOTH `inline` values with the judge badge asserted LAST.
  //
  // ⚠ THE BADGE-LAST ASSERTION IS AN ABSENCE-SHAPED GUARD ON THE ONE ELEMENT D-04 DELIBERATELY DID
  // NOT MOVE. `git diff -U0` over the restack matches no line naming it, which proves it today and
  // proves nothing tomorrow; this case is what makes "the badge keeps the far edge" survive the
  // next edit. Same for the no-border claim, which is a negative and therefore the easiest kind of
  // case to delete unnoticed.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`DoorHeaderStrip.test.tsx 12 16 +4`) — and note
  // 16 comes from fewer than 16 `it()`s, because two are `it.each` over both `inline` values,
  // which is exactly why hand-counting is forbidden here.
  "DoorHeaderStrip.test.tsx": 16,
  "PhaseSpine.test.tsx": 11,
  "deriveTier.test.ts": 9,
  "WorkflowSoul.test.tsx": 8,
  "revertByteIdentical.test.tsx": 7,
  // 188-01 (Wave 0): FOUR EXTENSIONS, no lowering — nothing was deleted and no existing pin
  // moved, so no deliberate deletion needs to ride along (the LOWERED-vs-EXTENDED distinction
  // in the header). Two of the four are the exact 187-25 situation recurring:
  //   · PhaseNode.test.tsx     (13) — RAN inside the `src/components/workflows` directory entry
  //     and counted toward the total, but was PINNED BY NOTHING. Phase 188 writes Req 2's
  //     no-harness-vocabulary fence and Req 5's waiting-words string-INEQUALITY guard into it.
  //     A string-inequality guard is an absence assertion; those are the easiest cases to
  //     delete unnoticed, and with 1260 tests of slack above the floor a whole file's worth
  //     could go without `[total-below-baseline]` ever firing.
  //   · PhaseNodeCard.test.tsx (68) — same: running, unpinned. It carries 188's seal-at-seven
  //     guard and the ring-dial geometry assertions, i.e. the mechanical half of the SPEC's
  //     "all seven readings stay distinguishable" criterion.
  // The other two are pinned in the same commit that first made them RUN (see the TARGETS
  // entries below); pinning at first execution is cheaper than discovering later that the
  // suite was inside one knob and outside the other:
  //   · PhaseReconcile.test.tsx (2) — Req 3's REACHABLE fail-open, where
  //     `finalizeAllPhasesForThread` sweeps `pending` → `done`.
  //   · PhaseTimeline.test.tsx  (8) — the developer-view suite Req 1's parity assertion leans
  //     on: the non-technical face and the developer face must agree on the SAME derivation.
  // ALL FOUR NUMBERS WERE READ FROM THIS SCRIPT'S OWN PRINTED `actual` COLUMN, across two
  // agreeing runs of `node scripts/vitest-count-gate.cjs` on 2026-08-05 (13 / 68 / 2 / 8) —
  // never hand-counted from `it(` literals, which is unsound under `it.each` and yields a pin
  // BELOW the real count that can therefore never fire. The 13 and 68 in 188-VALIDATION.md are
  // the EXPECTED figures; the printed column agreed with them, so there is no discrepancy to
  // record. `PhaseNodeCard.test.tsx` was then observed catching a deletion: one whole `it(`
  // block removed reds the gate with `[count-decrease]` naming that file at `failed 0` — the
  // count decrease being the ONLY signal is the entire point. Raw output in 188-01-SUMMARY.md.
  //
  // ── 188-12 (Wave 10): the four 188-01 pins RAISED to their measured `actual`. ──
  // 188-01 pinned each at the count it ran ON THE DAY IT WAS PINNED, which was correct then
  // and stopped being correct the moment the phase started writing into these files. Every
  // number below is the `actual` column of the two agreeing runs on 2026-08-05 (total 2421,
  // failed 0, per-file columns identical) — never a hand count of `it(` literals.
  //   · PhaseNodeCard.test.tsx  68 → 105: 188-06 added the seven-readings-distinct-by-shape
  //     block and the seal-invariant-at-seven guard.
  //   · PhaseNode.test.tsx      13 →  25: 188-07 added Req 2's split harness-vocabulary fence
  //     and Req 5's waiting-words stem-set separation.
  //   · PhaseReconcile.test.tsx  2 →  12: ⚠ THE ONE THAT MATTERED. 188-02's falsification of
  //     the REACHABLE fail-open (`finalizeAllPhasesForThread` sweeping `pending` → `done`)
  //     and 188-04's identity-overlay cases ALL landed in the ten-case gap between the pin
  //     and the run. Every falsification this phase wrote sat in gate slack, deletable with
  //     the gate green — which is the exact failure mode the falsifications exist to prevent,
  //     reproduced in the guard rather than in the product.
  //   · PhaseTimeline.test.tsx   8 →   8: unchanged. Recorded rather than omitted, so a reader
  //     can tell "measured and still 8" from "nobody looked".
  // ── 188.1-04 (Wave 4): three of the four suites this plan EXTENDED. ──
  // EXTENSIONS ONLY, nothing lowered, `TARGETS` unedited (all four were already inside it).
  // Every number is this script's own `actual` column across TWO agreeing runs on
  // 2026-08-06 (total 2476, failed 0, per-file columns identical) — never a hand count of
  // `it(` literals, which is unsound under `it.each` (`definitionOps.test.ts` declares ~122
  // and runs 232).
  //   · PhaseNodeCard.test.tsx 105 → 107: the WR-04 site-4 (`VERDICT_MARK`) and site-5
  //     (`RING_STROKE`) falsifications, both observed RED against the shipped tree.
  //   · PhaseNode.test.tsx      25 →  26: the WR-04 site-1 (`ICON_TINT`) falsification. ONE
  //     case, not three, because `data.phaseType` feeds three lookups and the property is
  //     about the VALUE — the measured first consequence of a prototype key was not a wrong
  //     tint but a hard render crash out of `phaseGlyph`.
  //   · PhaseTimeline.test.tsx   8 →  10: the WR-04 site-2 (`PHASE_TYPE_LABEL`) and site-3
  //     (`STATUS_META`) falsifications. ⚠ They drive `panel/PhaseCard` DIRECTLY rather than a
  //     timeline fixture: the fixture path is normalised by the already-guarded
  //     `phaseStatusFromDb`, so a fixture-driven site-3 test would have been GREEN against
  //     the unguarded tree — never observed RED, and therefore known to test nothing.
  // 188.2-07: 107 → 124. EXTENDED, not lowered — the whole of Phase 188.2 DELETED no `it(`,
  // renamed no `describe(` and moved no case out of this file (the phase's own rule: moving an
  // `it(` out would trip `[count-decrease]`, and a move is not a plan-authorised deletion). The
  // +17 are 188.2-01's subtree-fence non-vacuity control, the D-09 third-badge `@ts-expect-error`
  // control and the three-`it(` ESM-cycle fence (+5); 188.2-03's three whole-`innerHTML` captures,
  // their three marker rows and the seven-reading / three-verdict / four-border geometry matrices
  // (+12). Read from THIS SCRIPT'S OWN `actual` column across two agreeing runs, 2026-08-07
  // (both printed `PhaseNodeCard.test.tsx 107 124 +17`) — never hand-counted.
  // 188.2-VALIDATION AUDIT (2026-08-07): 124 → 128. EXTENDED again, not lowered — the audit's
  // own gap-closure round found 4 per-task claims in the 188.2 map (04-T1 zero-runtime-export,
  // 04-T2 zero-import, 05-T2 RING_* module-private, 02-T1 card-untouched-by-the-z-index-tier)
  // that were TRUE at HEAD but backed by no PER-FILE assertion — only the joined
  // `cardSubtreeSource` haystack, which cannot distinguish "true in this file" from "true
  // somewhere in the subtree". +4 `it(` blocks, one per claim, each reading `CARD_MODULES` by
  // its own destination path. Read from `actual` across two agreeing runs, 2026-08-07 (both
  // printed `PhaseNodeCard.test.tsx 124 128 +4`).
  // 189-10 (CONN-01 / D-16): 128 → 130. An EXTENSION, not a lowering — no `it(` was
  // deleted or renamed. The +2 are the eighth reading's RENDERED uniqueness ("the ONLY
  // ring drawn in FOUR arcs", joining the seven ONLY-assertions this block already makes
  // so the build criterion stays a complete enumeration) and the `EXPECTED_RING` row that
  // falsifies the dash formula at a repeat count no shipped row uses.
  //
  // ⚠ THE CAPTURED `CARD_READING_SHAPES` ROW ADDS NO CASE, and that is worth stating: it
  // is a table the EXISTING loops read, so the eighth reading is covered by tests that
  // were already counted. Its absence from this delta is not an under-count.
  //
  // FIVE literal `7`s in this file were DERIVED from `ALL_READINGS.length` rather than
  // re-pinned at 8 (the seal loop, the card-distinctness set, the signature set, the word
  // set, the matrix total). None changes the count; all five stop the NINTH reading from
  // reading as a regression.
  // 189-13 (CONN-01 / UI-SPEC §5c): 130 → 131. An EXTENSION, not a lowering. The +1 is the
  // tint-coverage property — every type in the GLYPH vocabulary has an `ICON_TINT` entry and
  // none of them is `DEFAULT_TINT`, so a SHIPPED type silently falling to the floor cannot
  // look like an unknown one. The existing tint case was EDITED in the same commit rather
  // than added to: its `toHaveLength(6)` is now `Object.keys(PHASE_GLYPHS).length` (derived,
  // so the EIGHTH type does not read as a regression) plus the new tint's exact value.
  // 189-15 (CONN-01 / D-12 / D-18): 131 → 132. An EXTENSION. The falsified card-suite
  // comment ("slot 1 is still empty and still reserved") was REWRITTEN IN PLACE and its
  // assertion kept — it passes an explicit one-badge list and counts one chip, which is the
  // CARD's own budget test and is unaffected by the ADAPTER spending a slot. The +1 is that
  // case's missing POSITIVE CONTROL: two badges in, two chips out, in tuple order, in the
  // SAME row. Without it, "one badge → one chip" was equally satisfiable by a card that
  // renders at most one badge whatever it is handed — the regression 189 could have caused.
  "PhaseNodeCard.test.tsx": 132,
  // 189-15 (CONN-01 / D-12 / D-18): 26 → 31. An EXTENSION, not a lowering — no `it(` was
  // deleted, renamed or moved out. The +5 are badge slot 1, the LAST free word-badge on the
  // card, and every one of them was driven RED against a planted wrong fix before it was
  // trusted: the badge present on `external_action` and absent on all six shipped types
  // (a RECORD comparison derived from `PHASE_TYPE_ORDER`, so the eighth type joins it
  // automatically); the two-badge ORDER (slot 1 first — PLANT: the tuple written
  // `[waitsForYou, notConnected]`, RED, exactly one failure); the design-time badge word and
  // the run-time word coexisting on one card and asserted NOT EQUAL by exact match (they
  // share the leading token "Not", so a `toContain` would be ambiguous); the badge as a
  // plain span with the no-focusable-control leaf walk re-driven over a two-badge card; and
  // the source fence for the no-spread + state-conditional shape.
  //
  // ⚠ THE SOURCE FENCE IS THE ONLY THING THAT CAN SEE THE D-12 DEFECT, and that was
  // MEASURED, not assumed. A TYPE-conditional gate (`data.phaseType === "…"`) renders
  // BYTE-IDENTICALLY today — nothing in the app can be connected to anything until Phase
  // 190 — so under that plant all four RENDER cases stayed green and only the fence went
  // red. A DOM-only suite would have shipped the coupling D-12 exists to prevent.
  "PhaseNode.test.tsx": 31,
  // 189-10 (CONN-01 / D-16 / D-07) — a NEW FILE, pinned in the SAME COMMIT that creates it.
  //
  // ⚠ THIS ONE DID NOT HIT THE TWO-KNOB TRAP, and the reason is worth recording because it
  // is the FIRST entry in this table for which that is true. Every prior note here (188-08,
  // 188-09, 188-05, round 5) describes a suite that landed outside BOTH knobs and therefore
  // never ran. `runVocabulary.test.ts` lives in `src/components/workflows`, which is a
  // DIRECTORY entry in TARGETS, so it RAN the moment it existed — measured, not assumed: the
  // gate printed `runVocabulary.test.ts — 12 new` before this line was written. TARGETS was
  // therefore NOT edited. The pin below is about what is GUARDED, not about what executes.
  //
  // What would be unguarded without it: this suite carries the only assertions that the D-16
  // word is byte-exact (em dash asserted by CODEPOINT — an en dash is invisible in a diff),
  // that it collides with none of the seven shipped words, that its clause is deliberately
  // `null`, and that it claims no card border. The border case is an ABSENCE assertion over a
  // `Partial<>` table, which the compiler cannot see at all and is the easiest kind to delete
  // unnoticed.
  //
  // 189-10 TASK 2: 12 → 23. The ring half, same plan but a later commit, pinned from
  // `actual` across two agreeing runs. The +11 carry three WHOLE-TABLE invariants that
  // existed NOWHERE before this plan — exact tiling (`repeats × (dash + gap) === 1`, true
  // of all seven shipped rows and asserted by nothing), FOUR-ARC uniqueness, and
  // pairwise-distinct rendered geometry — plus the WR-04 `"constructor"` probe on
  // `ringSpecFor` and the fail-closed direction: an unowned reading floors on the DOTTED
  // unknown ring and NEVER on the closed circle `done` owns.
  "runVocabulary.test.ts": 23,
  // 189-08 (CONN-01 / D-07): 10 → 17. An EXTENSION, not a lowering — no `it(` was deleted,
  // renamed or moved. The +7 are the panel half of the governed not-sent terminal: the new
  // STATUS_META row rendering its own glyph and exact text, the D-07 non-collision case
  // (string INEQUALITY against all seven shipped panel words — never `toContain("Not")`,
  // which is ambiguous across surfaces), the WR-04 floor re-pinned now that the table has
  // grown, the PHASE_TYPE_LABEL DECLINATION pinned rather than merely commented, and three
  // announcer cases (the new sentence, a `complete` positive control, and the `default:`
  // silence for a status the switch cannot name). Four wrong fixes were planted and each
  // observed RED — most sharply PLANT N ("the not-sent word must not be Complete"), which
  // is this phase's stated failure mode. Read from this script's own `actual` column.
  // ⚠ Moved in the SAME COMMIT as the tests (S2).
  // ── RAISED IN 200-07 (DES-02, `200-CHECKLIST.md` §4): 17 → 35 ─────────────────────────
  //
  // ⚠ THE RAISE IS `+18` AND ONLY `+7` OF IT IS THIS PLAN'S. The other ELEVEN were ALREADY
  // RUNNING against a pin of 17 — this gate printed `PhaseTimeline.test.tsx  17  28  +11`
  // on the unmodified tree, an owed re-pin that has been carried since 190-12 (which
  // recorded it at `17 / 21, +4` and deliberately did not take it). **De-slacking is closed
  // in the SAME commit that adds the new cases**, because the gate's own §187-29 correction
  // says why it has to be: *"a pinned TOTAL rising proves nothing about the NEW cases,
  // because slack inside an already-listed file absorbs them."* Eleven cases were deletable
  // with this gate green.
  //
  // The seven new ones are the panel half of the run surface: the durable per-step reading
  // and the declared count rendered from the FETCHED rows, an absent row rendering NOTHING
  // (which is not `time not recorded`), the fetch-authoritative re-read on a status
  // transition, `did not finish` on an active row under a terminal run, `never ran` vs a
  // historic row proved distinct IN ONE RENDER, a `constructor`-slugged phase, and the
  // zero-re-derivation fence over both panel sources.
  //
  // Read from this script's own `actual` column across two agreeing runs, never hand-counted
  // from `it(` — this suite carries `it.each` blocks whose case count is not its `it(` count.
  "PhaseTimeline.test.tsx": 35,
  // 188 code-review fix pass (CR-06): 12 → 17. An EXTENSION, not a lowering. The five
  // added cases falsify the fail-open that survived ONE FUNCTION AWAY from the one 188-02
  // closed: the live branch's `i < current ? "done"` painted a `skipped` row Complete (or
  // Running, when the cursor is still parked on it — `advance_current_phase` is not called
  // on the skip branch), and did the same to a `failed` row and to an unnameable one. Four
  // of the five were observed RED; the fifth is the positive control that a genuinely
  // completed row below the cursor is unaffected.
  "PhaseReconcile.test.tsx": 19,
  // ── 188-12: the four suites Phase 188 CREATED (or deliberately adopted), pinned now. ──
  // Each was put into TARGETS by the plan that created it — in the same commit, because an
  // entry pointing at a not-yet-existing path makes the gate ERROR (exit 2) rather than fail —
  // and each was deliberately left OUT of BASELINE while its count was still growing. This is
  // the plan that closes the second knob. Until this commit, every one of them RAN and NONE of
  // them was pinned: the whole run-observability estate could have been deleted at `failed 0`.
  //   · WorkflowRunPage.test.tsx     60 (188-08 authored at 45, 188-10 grew it to 60 — 188-08's
  //     closing note saying "pin at 45" is STALE and is superseded by the measurement here).
  //     Carries the `phase_index` join fence (a slug-keyed join silently misses every
  //     not-yet-started node mid-run), the run band's totality, and the `claimed_at == null`
  //     no-number rule. All three are ABSENCE assertions.
  //   · WorkspacePanel.test.tsx      39 (31 shipped + 8 added by 188-10). The THREAD side of
  //     D-188-13's bidirectional seam — the only route back to a finished run while `GET /runs`
  //     is deferred and the app has no router.
  //   · phaseState.test.ts           34 (188-05). Req 8's zero-re-derivation SOURCE fence, the
  //     only mechanical thing preventing a second copy of the derivation in the canvas tree,
  //     plus the totality guard measured RED on the plan's own proposed `?? "done"` expression.
  //   · ChatLayout.launch.test.tsx   12 (188-09). The only fence on the launch path: lands on
  //     the run not on chat, the thread still anchors the run, the two-bare-uuid id trap, and
  //     the positional-fallback hazard.
  // 188 code-review fix pass (CR-02): 60 → 64. An EXTENSION, not a lowering. Nothing on
  // this surface opened the run's SSE stream after the retarget — the store reconcile that
  // calls `subscribeToRun` is fired from `ChatArea`'s layout effect alone, and `ChatArea`
  // is unmounted here — so the canvas painted its mount-time snapshot for the whole run.
  // Three of the four cases were observed RED; the fourth pins that nothing fires before a
  // run has resolved.
  // …and CR-01: 64 → 69. Also an extension. `setRun` had ONE caller, so the band, the
  // terminality, the elapsed anchor and the assertive alert were frozen at mount — a live
  // run read "● Running" forever with a clock still counting under it. Three of the five
  // added cases were observed RED; the other two guard the poll's teardown and its
  // never-tear-down-a-good-surface rule.
  // 72 = 69 + the three F1 cases (UAT 2026-08-05): the phase slice and the stream now ride
  //      the run poll, and a final slice+file read lands on the terminal edge.
  // 83 = 75 + the eight F5 cases (UAT 2026-08-05). An EXTENSION, not a lowering. The
  //      run-time waiting reading was STRUCTURALLY UNREACHABLE here: `reconcilePhases`
  //      hardcodes `pendingAsk: null` in both branches, so `canvasReading`'s waiting arm —
  //      which is first, ahead of every status — could never fire on a surface that rides
  //      polled reconciles. Four of the eight were observed RED (the reading itself, the
  //      run-thread keying, and the ask slice riding both the poll and the wake). The other
  //      four are the derivation's negative controls, and they are not ceremony: `PendingAsk`
  //      carries no phase reference, so the waiting step is DERIVED, and each control pins
  //      one way that derivation could over-claim — a running `llm_agent` step, a
  //      human-input step with nothing pending (D-188-05's design-time/run-time split), a
  //      step the run has not reached, and a terminal run with a stale ask. The last was
  //      falsified by forcing its guard true and observed RED.
  // 85 = 83 + the two F6 cases (UAT 2026-08-05), found by WATCHING the F5 verification run
  //      rather than by any suite. F3 moved the elapsed figure's anchor to the `created_at`
  //      fallback and left the TICK GATE reading `claimedMs` — so on every live run (which
  //      is all of them: 0 of 149 completed rows carry `claimed_at`) the 1s interval never
  //      armed and the band rendered a mount-time number that looked live. Observed RED at
  //      3 s advanced with the figure still reading its mount value. The second case is the
  //      over-fix guard: a terminal run's figure is a measurement between two recorded
  //      timestamps and must stay frozen.
  // 87 = 85 + the two F7 cases (UAT 2026-08-05). SC#1 requires each node to show live state
  //      AND its grounded-cited vs open governance state; the second half never reached this
  //      surface. `toCanvas` resolves `grounded` via `isGrounded(phase, kbTools)` and defaults
  //      an omitted `kbTools` to the frozen empty NO_KB_TOOLS, and the page passed none — so
  //      `available_tools ∩ kb_tools` ran against the empty set and the DETECTED cause, the
  //      dominant one, could never resolve. Quiet because `already-set` and `escalated` still
  //      did. Falsified live on ONE workflow across BOTH surfaces: the Builder canvas gave the
  //      node `data-grounded="true"`, the run surface no attribute. Both cases observed RED.
  //      The second is an R11 fence: the page must READ the server list, never author one.
  // 88 = 87 + the ONE 188.1-04 WR-07 case (2026-08-06). An EXTENSION, not a lowering. It
  //      asserts the URL a mocked `fetch` RECEIVES when the REAL `getWorkflowRun` (reached
  //      through `importActual`, which un-mocks that module for one call) is handed a
  //      `runId` of `"a/b"` — encoded `a%2Fb`, never a bare `workflow-runs/a/b` path.
  //      ⚠ IT LIVES HERE FOR A GATE REASON, not a topical one: the function under test is
  //      `lib/api.ts`'s, and `frontend/src/lib/` sits outside BOTH knobs — `TARGETS` decides
  //      what RUNS, `BASELINE` what is PINNED — so a suite written beside `api.ts` would
  //      never be executed by this gate. A falsification that does not run has falsified
  //      nothing (verification truth 14, round 5 of Phase 187). This file is inside both.
  // 102 = 89 + Phase 194.1 Plan 07's thirteen (2026-08-16). An EXTENSION, not a lowering —
  //       nothing was deleted, and `git diff --diff-filter=D` on the whole plan is EMPTY, so
  //       the `:24-45` deletion rule does not apply. The figure is the GATE's OWN `actual`
  //       column on TWO agreeing runs (`total 3972 · failed 0 · pinned total 3885 · 75/75`,
  //       verdict `count gate OK` both times), never a hand count.
  //       ⚠ THE PIN IT REPLACES WAS EXACT (89 = 89 at `194.1-BASELINE.md` §11), unlike its
  //       neighbour `WorkspacePanel.test.tsx`, whose pin was found running TWELVE cases
  //       behind its actual. Recorded because "the pin is the case count" is true here and
  //       was false there, twenty lines below, at the same moment.
  //       The thirteen: NINE mount cases (R3) — five status cases, one per shipped band
  //       sentence, plus DOM containment + child order, the press-by-VALUE, the no-guard
  //       direct flip, and the stopping-slot swap — and FOUR fence cases (F1/F2 + one
  //       positive control each), which exist because `WorkspacePanel.test.tsx`'s F-1/V-05
  //       globs `components/panel|chat|workflows` and NOT `src/pages`: the fourth Stop mount
  //       would otherwise have been the one outside the fence guarding the other three.
  // 105 = 102 + Phase 195 Plan 02's THREE (2026-08-17). An EXTENSION, not a lowering —
  //       nothing was deleted, and `git diff --diff-filter=D` on this plan is EMPTY, so
  //       the `:24-45` deletion rule does not apply. ⚠ BOTH NUMBERS APPEAR HERE ON
  //       PURPOSE: the OLD value is 102 and the NEW one is 105, recorded beside each other
  //       rather than the old one overwritten, per this project's correction rule.
  //       The figure is the GATE's OWN `actual` column on TWO agreeing runs
  //       (`total 4044 · failed 0`, verdict `count gate OK` both times), never a hand
  //       count — the rule this script states about itself.
  //       The three: `195-02`'s pre-change capture of the id-less deliverable row — that
  //       it is a FACT (name + size + `title` full path, and ZERO `<button>` in the
  //       region), that it carries NO "Download unavailable" copy, and a positive control
  //       proving that absence assertion can actually fail.
  //       ⚠ CASE 2 IS EXPECTED TO INVERT WHEN PLAN 195-06 LANDS — the id-less arm gains
  //       the shipped D-08 affordance when the region adopts the shared row. When it does,
  //       the original assertions are QUOTED IN PLACE, never deleted (the 194.1-07
  //       precedent recorded twenty lines above), and this pin moves only on a number read
  //       from the `actual` column — never to make a red gate go quiet.
  //       ⚠ 195-06 LANDED AND CASE 2 DID INVERT, exactly as predicted above. The
  //       inversion itself moved NO number — an `it()` rewritten in place still counts
  //       one — which is precisely why the plan inverted rather than deleted: a deletion
  //       would have needed a pin LOWERING, and this file's own rule is that a pin never
  //       comes down to quiet a gate. The `105 -> 108` below is the THREE cases 195-06
  //       ADDED: the D-02 label-honesty sweep, and the two D-12 ordering cases (one per
  //       `created_at` regime). Read from this script's own printed `actual` column
  //       (`WorkflowRunPage.test.tsx  105  108  +3`), never hand-counted from `it(`
  //       literals, and raised in the SAME COMMIT as the tests — a lagging pin is the
  //       gate going blind (the 195-03 incident, corrected again in 195-05).
  // ── RAISED IN 200-07 (DES-02, `200-CHECKLIST.md` §4): 108 → 137 ───────────────────────
  //
  // ⚠ `+29`, of which `+25` is this plan's and `+4` was PRE-EXISTING SLACK (`108 → 112` on
  // the unmodified tree). Closed here, per the §187-29 correction on the two entries above.
  //
  // The twenty-five, by row id: the receipt MOUNTED and named by the same `nodeTitle` the
  // canvas paints and reachable from no other surface (`RS-MR-05` ×3); the phase-derived
  // total runtime, its `claimed_at`-null independence, its worded absence, its remount
  // stability and its deliberate distinctness from the header figure (`RS-MR-03` ×5); D-06's
  // arms read through the receipt (`RS-MR-02`/`RS-MR-04` ×3); fetch-authoritative over a
  // stale live slice, and an empty durable read (×2); the count's supply line into the
  // canvas, an absence forwarded as an absence, a declared `0`, and the noun passed verbatim
  // (`RS-MR-01`/`RS-MNR-03` ×4); D-17 DRIVEN as a green row plus the receipt opening no
  // file-content path (`RS-MR-06`/`RS-MNR-07` ×2); the §4.2 fence with its two PERMANENT
  // controls and both real renders (×4); and the two REPORT rows recorded as executable
  // cases rather than as SUMMARY prose (`RS-3b`, `RS-1` ×2).
  //
  // ⚠ THIS SUITE IS ONE OF `SEED-171`'s FIVE FLAKY SUITES. It read `failed 0` on every
  // invocation across this plan and the gate never redded — recorded as an OBSERVATION, not
  // as proof of innocence. One green sample of a flaky suite is not proof of anything.
  // ⚠ RE-PINNED 137 → 148 (2026-08-20). THE DRIFT IS NOT THIS PASS'S DOING AND SAYING SO IS
  //    THE POINT: Phase 200 deliberately WITHHELD the count-gate pins from every agent so its
  //    waves could run in parallel instead of serialising on this file, and `.planning/STATE.md`
  //    records that as owed debt. This is that debt being paid, for the three suites Phase 200
  //    left unpinned or under-pinned. The figure is read from this script's own `actual` column
  //    (`WorkflowRunPage.test.tsx  137  148  +11`), never hand-counted from `it(` literals.
  //
  // ⚠ AND THE SUITE ITSELF IS BYTE-UNCHANGED BY THE PASS THAT RAISES THE PIN — checked with
  //    `git diff --numstat` before the number was touched, because a pin raised in the same
  //    breath as an edit to its subject proves nothing about either.
  "WorkflowRunPage.test.tsx": 148,
  // ── Added in 195-02 task 3, in the SAME COMMIT as their TARGETS entries. Every ───────
  // ── number below is this script's own printed `actual` column across TWO agreeing ────
  // ── runs (`total 4044 · failed 0 · count gate OK` both times) — never hand-counted ───
  // ── from `it(` literals, which is the rule this script states about itself. ──────────
  //
  // The per-suite reasoning — what each one guards, why it was invisible to this gate
  // until now, and which bare directories were declined — is recorded ONCE, at the
  // matching `TARGETS` block near the bottom of this file (search `195-02`). It is not
  // duplicated here, because two copies of a reason drift.
  //
  // ⚠ ALL FIVE WERE MEASURED GREEN BEFORE ADOPTION (`195-BASELINE.md`: 11 / 11 / 15 / 11
  // and the 21 this plan's task 1 created), so the adoption imports ZERO rot into a gate
  // whose contract is 0 failing forever.
  "OutputFileCard.baseline.test.tsx": 21,
  "StopControl.baseline.test.tsx": 15,
  // 195-05 task 2 GREW this file 11 -> 22 as the panel adopted the shared row:
  // arrow-key roving focus THROUGH that row (the ref-forwarding integration —
  // `FileRow.test.tsx` unit-tests a ref passed TO the row; nothing tested a ref
  // passed to its caller-supplied CHILD), the two mime-first branches, the
  // code-extension coverage the shipped cases are structurally blind to (they
  // use docx/pptx/xlsx only) with its negative control, the meta string, the
  // deliberate glyph change, the panel's AA token, the full-path label, the
  // shipped padding and preview-not-download. ADDITIONS ONLY —
  // `git diff --numstat` read `272  0`, i.e. zero removed lines.
  //
  // ⚠ THE PIN MOVES IN THE SAME COMMIT AS THE TESTS, which is this script's own
  // rule at the `phaseVocabulary` pin and the correction recorded at
  // `fileIcon.test.tsx` two entries below. 195-03 left THAT file pinned at 11
  // against an actual of 41 and the orchestrator had to correct it at the wave-2
  // close; the reasoning ("a pin is a floor, never a census") is coherent and the
  // conclusion is still wrong, because a pin that lags its actual means the
  // difference can be DELETED with the gate green — here that would be all
  // eleven cases above, including the only fence in the tree on the panel's
  // light-theme AA token. A lagging pin is the gate going blind, not a
  // conservative choice.
  //
  // 22 is read from THIS SCRIPT'S OWN printed `actual` column
  // (`FilesSection.test.tsx  11  22  +11`), never hand-counted from `it(`
  // literals.
  "FilesSection.test.tsx": 22,
  // 195-03 task 1 GREW this file 11 → 41: the widening's own coverage (ribbon /
  // tone / className / mimeType / the nine added extensions / the own-property
  // guard), ADDITIONS ONLY — `git diff` showed zero removed lines and all 11
  // original titles intact.
  //
  // ⚠ CORRECTION (orchestrator, wave-2 close). 195-03 left this pinned at 11
  // and recorded the reasoning: *"The pin is a FLOOR, never a census
  // (`WorkspacePanel.test.tsx`'s note below records a pin that sat twelve cases
  // stale while the gate stayed satisfied), so leaving it at 11 keeps the
  // contract 'no per-file DECREASE' exactly as strong."* The original wording is
  // preserved here rather than deleted, because the reasoning is coherent and
  // the conclusion is still wrong.
  //
  // It is wrong against THIS SCRIPT'S OWN RULE, stated at the `phaseVocabulary`
  // pin above: *"the pin moves in the SAME COMMIT as the tests, because this gate
  // only fails on a DECREASE, so a count that grows without its pin edit leaves
  // the gate blind to the NEXT deleted test rather than red."* A pin of 11 against
  // an actual of 41 means **thirty cases can be deleted and the gate stays green** —
  // and those thirty include the nine-extension block, i.e. the fence 195-03 built
  // to answer the icon-regression question would itself be undefended against
  // deletion. `WorkspacePanel.test.tsx`'s note RECORDS a stale pin; it does not
  // establish that stale is correct.
  //
  // 41 is read from THIS SCRIPT'S OWN printed `actual` column at the wave-2 close
  // gate run (`fileIcon.test.tsx 11 41 +30`, `total 4136 · failed 0 ·
  // count gate OK — 82/82`), never hand-counted from `it(` literals.
  "fileIcon.test.tsx": 41,
  // Added 2026-08-25 in the SAME COMMIT as its TARGETS entry. 55 is read from THIS SCRIPT'S
  // OWN printed `actual` column, never hand-counted from `it(` literals — and note that this
  // is an ADD, not a RAISE, so the diff on this file is `+N / -0`.
  "fileTypeMark.test.tsx": 55,
  "MessageItem.finalOutputs.test.tsx": 11,
  // ── Added in 195-03 task 3, in the SAME COMMIT as their TARGETS entries. ────
  // Both numbers are THIS SCRIPT'S OWN printed `actual` column, on two agreeing
  // runs (`total 4136 · failed 0 · count gate OK` both times) — never
  // hand-counted from `it(` literals, which is the rule this script states
  // about itself. The per-suite reasoning is recorded ONCE, at the matching
  // `TARGETS` block near the bottom of this file (search `195-03`).
  //
  // ⚠ BOTH WERE MEASURED GREEN BEFORE ADOPTION (22 and 40, run individually and
  // together), so the adoption imports ZERO rot into a gate whose contract is
  // 0 failing forever.
  "fileRowUtils.test.ts": 22,
  "FileRow.test.tsx": 40,
  // ══ Added in 195-07 task 3, in the SAME COMMIT that CREATES the file. ═══════
  //
  // (1) PLAN: `195-07` — Phase 195's single pin-reconciliation point, so no two
  //     same-wave plans ever contend for this file.
  //
  // (2) `FileRow.sweep.test.ts`'s `TARGETS` entry and this `BASELINE` pin land in
  //     the SAME COMMIT as the suite itself. That is this script's own rule
  //     (`phaseVocabulary`), and it is also a hard requirement here: a `TARGETS`
  //     path that does not exist makes this gate ERROR at exit 2 — not fail — for
  //     every later plan and every later phase. The path was `ls`-confirmed and
  //     the bare filename confirmed unique tree-wide (the BASELINE key space is
  //     global) before these lines were written.
  //
  // (3) WHAT WOULD BE UNGUARDED WITHOUT IT: **three of the four in-scope source
  //     files had NO source fence before Phase 195** — `FilesSection.tsx`,
  //     `OutputFileCard.tsx` and `lib/fileIcon.tsx` were swept by nothing at all,
  //     and only `WorkflowRunPage.tsx` carried one. After plans 04/05/06 converted
  //     all three onto the shared row, SC#2 (*no second file UI*) is BELIEVED
  //     rather than checked, and `FileRow.sweep.test.ts` is the only artefact that
  //     checks it. Leaving it out of `TARGETS` would put the phase's single most
  //     important falsification OUTSIDE CI — the `194.1-BASELINE.md` §2 shape,
  //     where an ungated pin sat red for twelve cases while four clean gate
  //     reports could not have included it.
  //
  // (4) EVERY PHASE-195 PIN, OLD → NEW, WITH THE PLAN THAT GREW IT. All five
  //     raises had already landed when 195-07 ran; this plan VERIFIED each against
  //     the printed `actual` column rather than re-raising it, and every one read
  //     delta 0:
  //
  //       WorkflowRunPage.test.tsx          102 →  105 (195-02)  105 → 108 (195-06)
  //       fileIcon.test.tsx                  11 →   41 (⚠ 195-03 left it at 11
  //                                                     against an actual of 41;
  //                                                     raised by the ORCHESTRATOR
  //                                                     at the wave-2 close)
  //       FilesSection.test.tsx              11 →   22 (195-05)
  //       FileRow.test.tsx                    – →   40 (195-03, new)
  //       fileRowUtils.test.ts                – →   22 (195-03, new)
  //       OutputFileCard.baseline.test.tsx    – →   21 (195-02, new)
  //       StopControl.baseline.test.tsx       – →   15 (195-02, adopted)
  //       MessageItem.finalOutputs.test.tsx   – →   11 (195-02, adopted)
  //       FileRow.sweep.test.ts               – →   20 (195-07, new — this entry)
  //
  //     ⚠ WHY EVERY PIN ENDS *AT* ITS ACTUAL RATHER THAN BELOW IT. The contract is
  //     *no per-file DECREASE*, so an increase is permitted and a lagging pin never
  //     reds — which is exactly the danger. A pin of 11 against an actual of 41
  //     means thirty cases can be DELETED with the gate green. `fileIcon.test.tsx`
  //     was in that state for a whole wave, and `WorkspacePanel.test.tsx`'s note
  //     elsewhere in this file RECORDS a pin found twelve cases behind. A lagging
  //     pin is the gate going blind, not a conservative choice.
  //
  // (5) 20 IS THIS SCRIPT'S OWN PRINTED `actual` COLUMN, read across TWO AGREEING
  //     RUNS — never hand-counted from `it(` literals, which is the rule this
  //     script states about itself and the reason it prints that column at all.
  //     ⚠ Hand-counting would have been wrong here anyway, and by a MEASURED
  //     margin: the suite's 20 cases come from 16 plain `it(` literals plus ONE
  //     4-way `it.each` over the four swept sources. A grep counting both literal
  //     forms reads **17**, three short of the truth; a grep counting only `it(`
  //     reads 16, four short. The `actual` column reads 20.
  //
  // ⚠ MEASURED GREEN BEFORE ADOPTION (20 passed / 0 failed, run individually), so
  // this adoption imports ZERO rot into a gate whose contract is 0 failing forever.
  "FileRow.sweep.test.ts": 20,
  // 188 code-review fix pass (CR-03): 39 → 41. An EXTENSION, not a lowering — nothing was
  // deleted. The two added cases are the receipt's own reason for existing: `finish_run`
  // NULLs `threads.active_workflow_run_id` in the same transaction as the terminal status,
  // so the receipt rendered only while a run was LIVE and was absent for exactly the
  // finished run it was built for. One case pins that a cleared anchor still opens the run
  // (observed RED first), the other that the LIVE anchor still wins while a run is under
  // way — the guard against the fix drifting into "always the latest row". Both numbers
  // read from this script's own `actual` column.
  //
  // 194.1-05 (R7(a) / R1 / D-06): 41 → 58. An EXTENSION, not a lowering — nothing was
  // deleted, so no deletion rides along (`:24-45`: that requirement is on LOWERINGS only).
  // Read from THIS SCRIPT'S OWN `actual` column on two agreeing runs, never hand-counted.
  //
  // ⚠ THE `41` WAS STALE BY TWELVE BEFORE THIS PLAN ADDED A SINGLE CASE, AND THAT IS
  // RECORDED RATHER THAN QUIETLY ABSORBED INTO THE NEW NUMBER. `194.1-BASELINE.md` §11
  // measured the file's `actual` at **53** against a pin of **41** at Wave 1 — the gate was
  // satisfied the whole time, because its contract is *no per-file DECREASE* and not
  // equality, so twelve cases had accumulated behind a pin nobody re-derived. So the +17 is
  // **12 inherited + 5 mine**, and a reader who takes `58 − 41 = 17` as this plan's case
  // count would be wrong by more than double. *A pin is a floor, never a census.*
  //
  // The FIVE that are actually this plan's:
  //   · +1  a LIVE run with phases already recorded still renders the Stop — the pair that
  //         makes D-25's two booleans measurable (the lock, not the phase count, is the
  //         signal). Two other cases were REWRITTEN IN PLACE rather than added: the Phase
  //         194 case that pinned the DEFECT (a phases-exist thread with no lock rendering
  //         `panel-stop-run`) is now its own inverse, with the original quoted verbatim.
  //   · +4  the REAL cross-mount block — composer + panel, ONE thread. D-06's only proof,
  //         and a case a single-mount test structurally cannot see: both mounts render;
  //         pressing the panel retires the composer's control too; the symmetric direction;
  //         and the scope clause proving the slice is keyed BY THREAD, not global.
  //
  // ⚠ IT IS THIS FILE AND NOT A FOURTH NEW ONE FOR A GATE REASON, exactly like the
  // `WorkflowRunPage.test.tsx` note above. `src/components/panel/__tests__/` is reached by
  // THREE NAMED FILES and has no directory entry, and `src/components/chat` has no entry at
  // all (`194.1-BASELINE.md` §2) — so a new suite would land UNGATED and the phase's single
  // most important case would be the one nothing runs in CI. *A falsification that does not
  // run has falsified nothing.*
  "WorkspacePanel.test.tsx": 58,
  // 189-08 (CONN-01 / D-07 / D-17): 34 → 40. An EXTENSION, not a lowering — nothing was
  // deleted or renamed. The +6 are the sixth `workflow_phases_status_check` slug arriving
  // in the ONE derivation: +2 from the shipped `DB_TABLE` gaining a row (it drives both the
  // totality loop and the parity loop, so one row is two cases), and +4 from the dedicated
  // block — the double negative (`!== "done"` AND `!== "unknown"`, because asserting only
  // the positive would still pass if the value were ALSO aliased to done), the unknown
  // FLOOR surviving at both derivations, the new reading with the pending-ask precedence
  // above it unchanged, and the own-property guard re-pinned now that the map has grown.
  // Read from this script's own `actual` column, never a hand count of `it(` literals.
  // ⚠ Moved in the SAME COMMIT as the tests (S2): a pin edited without the test leaves the
  // gate blind, a test added without the pin leaves HEAD red.
  "phaseState.test.ts": 40,
  // 188 code-review fix pass (CR-05): 12 → 17. An EXTENSION, not a lowering. The run home
  // shipped UNGATED while `WorkflowBuilderPage` gates its canvas on the identical
  // expression, so an operator flipping `visual_workflow_canvas` off produced a launch that
  // landed on a surface the pre-canvas product never had, 404'd on its own read, and
  // reported the kill switch as "deleted, or belongs to another account". Four of the five
  // cases were observed RED; the fifth is the flag-ON positive control. This also
  // discharges the render-guard assertion `revertByteIdentical.test.tsx` deferred in 181.
  "ChatLayout.launch.test.tsx": 17,
  // ⚠ ADOPTED 2026-09-01, pinned at the gate's OWN printed `new` column (13), never counted
  // by hand — `221-CARRY-FORWARD.md` §E2 records the session where a hand-split pin was
  // caught doing exactly that. TARGETS was added in the same commit; a suite in one knob
  // and not the other either runs unguarded or is guarded without running.
  //
  // ⚠ RECORDED WHILE ADOPTING IT, AND DELIBERATELY NOT FIXED HERE: the neighbour above
  // measures 35 and is pinned at 17. That pin is stale-LOW, so 18 of its tests could be
  // deleted without the gate noticing — the gate only fails on a decrease BELOW the pin.
  // Its test file is byte-unchanged by this commit (last touched 2026-08-30, 217.1-18), so
  // re-baselining it here would bury someone else's drift inside a nav refactor.
  // 241-03: 13 -> 23. The +10 are the two HNSW knobs on the shipped Retrieval card (QUEUE-06 /
  // D-09), all asserting rendered CONTENT rather than presence — the served bounds reaching the
  // input's min/max, the three pgvector modes by VALUE, and both keys on the save payload.
  // 242-02: 23 -> 24. Phase 241's "Save Search Settings carries both keys" case became TWO, because
  // D-242-02 changed the contract it pinned: the tab now sends CHANGED FIELDS ONLY, so an untouched
  // `hnsw_ef_search` is no longer on the payload. The original assertion was NOT deleted — deleting
  // it would erase 241 D-09's guarantee silently while looking like a tidy-up. It became (a) an
  // edited knob rides AND its untouched sibling is absent, and (b) both ride when both are edited.
  "SettingsPage.test.tsx": 24,
  // ── ADOPTED 2026-09-11 (Phase 242) — the three SettingsPage suites that were in NEITHER knob. ──
  // Numbers read from the gate's own `— N new` column, never hand-counted. The full reason and the
  // red-suite repair are in the TARGETS block for these files.
  "SettingsPage.a11y.test.tsx": 4,
  "SettingsPage.sourceCeiling.test.tsx": 9,
  "SettingsPage.changedFields.test.tsx": 17,
  // ── 188-12: the fifteen files that RAN inside TARGETS with NO pin at all. ──
  // Inherited from Phases 183-187, none authored by this phase. They are pinned here because
  // the reason to leave a suite unpinned ("it postdates the pin, its count is free to grow")
  // expires the moment the suite stops growing, and nothing ever expires it — so the note
  // outlives the reason and the file stays permanently deletable. `canvasModel.roundtrip.test.ts`
  // alone runs 517 cases: more than the entire original 424 pin, guarded by nothing.
  // Every value is the `actual` column of the two agreeing runs on 2026-08-05.
  // ⚠ These are pins, not adoptions: all fifteen were ALREADY inside TARGETS, so the gate
  // already required them to pass and this imports no new rot. What changes is only that
  // deleting one is now visible.
  "canvasModel.roundtrip.test.ts": 517,
  // 188.1-02: 57 → 58. EXTENDED, not lowered — nothing was deleted, renamed or
  // re-described in that suite; the added case is the pre-move AFFORDANCE_SHAPE capture
  // that SC#2's "renders identically" is checked against, and it must be pinned BEFORE
  // 188.1-03 moves the code it fences, or the extraction could take the only baseline
  // with it. Read from this script's own `actual` column across two agreeing runs.
  // 188.2-07: 58 → 61. EXTENDED, not lowered — 188.2-02's three-part z-index guard for
  // BUG-260806-01 (the `AFFORDANCE_Z` > `SELECTED_NODE_Z` relation with both numbers named as
  // literals, the library's own elevation read off a really-rendered selected node, and the
  // rendered wiring across all three affordance groups). Nothing was deleted: the same plan
  // RE-CAPTURED `AFFORDANCE_SHAPE_BASELINE` as its one authorised exception, which changes 12
  // entries' `style` strings and not the case count. Read from THIS SCRIPT'S OWN `actual` column
  // across two agreeing runs, 2026-08-07 (both printed
  // `WorkflowCanvas.editing.test.tsx 58 61 +3`).
  // BUG-260807-01 (`/gsd:fast`, 2026-08-07): 61 → 63. EXTENDED, not lowered — two rows
  // guarding `verticalOffsetFor`'s totality over a prototype-member slug (the SIXTH WR-04
  // sink, and the one `188.2-DEF-02` does NOT cover). Nothing was deleted and no other pin
  // moved. Both rows were observed RED against the pre-fix body before the pin moved, and
  // the RED reproduced the report's own measurement exactly (`expected NaN to be +0`).
  // BUG-260808-01 (`/gsd:fast`, 2026-08-08): 63 → 65. EXTENDED, not lowered — two rows
  // guarding the NODE POSITION lookup's totality over a prototype-member slug (the SEVENTH
  // WR-04 sink, a DIFFERENT one from the sixth pinned directly above: that one returned
  // `NaN`, this one returned the inherited FUNCTION, so the node's `position` had no `.x`/`.y`
  // and the library wrote no transform at all). Nothing was deleted and no other pin moved.
  // Both rows were observed RED against the pre-fix body before the pin moved, and the RED
  // reproduced the report's own measurement exactly (`got position function Object() {
  // [native code] }`). Read from a full-file run: 65 passed.
  "WorkflowCanvas.editing.test.tsx": 65,
  // 214.1-02 RE-BASELINE 52 -> 77 (214.1-01's `setDeclaredInputs` cases — the ONE write path
  // for `definition.inputs[]`). See the 214.1-02 block beside `declaredInputs.test.ts`.
  "builderStore.test.ts": 77,
  "phaseVocabulary.corpus.test.ts": 45,
  // 189-12: 43 → 46. The 7th row — one case pinning it is offered LAST (a bare count
  // passes an insert), one pinning its title comes from the resolver rather than from a
  // fabricated sentence, and one pinning the "•" fallback mark. The last two are
  // FALSIFIABLE placeholders: they go red the day 189-14 lands the type sentence and
  // 189-13 lands the `outbox-tray` mark, which is what forces the exclusions to be
  // emptied rather than to outlive their reason.
  // BUG-260807-02 (`/gsd:quick 260807-x9p`): 46 → 52. An EXTENSION, not a lowering — no
  // `it(` was deleted, renamed or moved, and no shipped case changed its assertions. The
  // +6 are the contract half of the clipping fix, and they are pinned knowing exactly what
  // they can and cannot see: the two library opt-out class tokens (`nowheel` / `nopan`,
  // which `@xyflow/system`'s `isWrappedWithClass` finds by an ANCESTOR WALK from the event
  // target, so they must be on the panel ITSELF), the two overflow tokens, the inline
  // `max-height` arriving from the CALLER, the two no-inline-bound rows (prop omitted and
  // an explicit `null` — the unmeasured container), and the wheel-does-not-reach-a-parent
  // case with its positive control in the same `it(`.
  //
  // ⚠ THESE ARE CONTRACT ASSERTIONS AND NOT THE ACCEPTANCE, which is why the sentence
  // matters more than the number: jsdom applies no CSS, computes no overflow clipping and
  // `.click()` bypasses hit-testing — this suite was GREEN while row 7 (`external_action`)
  // was unreachable from all three insertion doors. The acceptance is the driven
  // `elementFromPoint` probe recorded on the bug report. Read from THIS SCRIPT'S OWN
  // `actual` column across two agreeing runs, 2026-08-08 (both printed
  // `StepTypePicker.test.tsx 46 52 +6`), in the SAME COMMIT as the tests.
  // BUG-260807-02, the KEYBOARD half (`/gsd:quick 260808-148`): 52 → 68. An EXTENSION, not
  // a lowering. NOTHING was deleted: the file's ONE `expect(row).toBeDisabled()` was
  // REWRITTEN IN PLACE inside its existing `it(` — the native `disabled` is gone so refused
  // rows can take focus, and `jest-dom`'s matcher does not consult `aria-disabled` — which
  // changes an assertion and not a count. The +16 are the APG vertical-`menu` contract:
  // focus entering the menu on open, the roving array asserted WHOLE, the 1→7 walk with
  // both wraps plus Home/End (each landing checked on BOTH `activeElement` and the tabindex
  // array), the Left/Right non-move control, the `.scrollIntoView(` source fence, Escape
  // re-stated with focus INSIDE the menu, three focus-return cases, and the four cases the
  // dropped `disabled` makes load-bearing (reachable-by-walk, the focus indicator, and the
  // click / Enter / Space guards, each with a positive control proving the event reached
  // the row).
  //
  // ⚠ ONE OF THE SIXTEEN IS THERE BECAUSE THE OTHER FIFTEEN WERE GREEN AGAINST A BROKEN
  // BUILD. `main.tsx` wraps the app in `<StrictMode>` and `render()` does not, so React
  // double-invoked the focus effect in the app only; instrumented live, the two captures
  // read `["canvas-insert-0", "step-type-choice-programmatic"]` and the surviving "opener"
  // was the picker's own row, so `Escape` stranded focus on `document.body`. The
  // StrictMode case reproduces it — and it only does so because the harness MOUNTS and
  // UNMOUNTS the picker as both real callers do: a harness that toggled `open` on a
  // mounted picker was measured green against the exact pre-fix capture, because React
  // double-invokes on MOUNT, not on a dependency change.
  //
  // Read from THIS SCRIPT'S OWN `actual` column across two agreeing runs, 2026-08-08 (both
  // printed `StepTypePicker.test.tsx 52 68 +16`), in the SAME COMMIT as the tests.
  "StepTypePicker.test.tsx": 68,
  // BUG-260807-02 — NET-NEW: `editAffordance.ts`'s FIRST suite ever, pinned in the commit
  // that creates it. No `TARGETS` edit accompanies it, and that is measured rather than
  // assumed: `src/components/workflows` is already a DIRECTORY entry, so the file RAN the
  // moment it existed — the gate printed `editAffordance.test.ts — 31 new` before this
  // line was written. TARGETS decides what RUNS, BASELINE what is GUARDED, and only the
  // second was missing.
  //
  // What would be unguarded without it: `pickerPlacement`'s whole contract — the side
  // choice and its tie rule, the TWO COORDINATE SPACES asserted in single calls at zoom
  // 0.5 and 2 (the panel's net scale is 1, so the height budget is a SCREEN gap and must
  // NOT be scaled, while `PICKER_DROP` is a FLOW offset and must be), the x clamp three
  // ways, the `PICKER_MIN_HEIGHT` floor, and the NaN-totality block. That last one is not
  // ceremony: every field is interpolated into `translate(...)`, one NaN invalidates the
  // whole declaration, and since 188.2 gave these style objects `zIndex: 1002` a dropped
  // transform strands the affordance ABOVE every card (the `verticalOffsetFor` /
  // `BUG-260807-01` mechanism, asserted here rather than inherited).
  // BUG-260807-02, the KEYBOARD half (`/gsd:quick 260808-148`): 31 → 63. An EXTENSION —
  // no case was deleted, renamed or moved, and every one of the 32 was observed RED before
  // either helper existed. They pin `nextRovingIndex` (both wraps, Home/End, totality over
  // a degenerate count, an out-of-range index that CLAMPS rather than escaping the array,
  // and the six-key `null` list that is the falsification control for the whole keyboard
  // claim — `Escape` because the shipped dismissal depends on falling through, and
  // `ArrowLeft`/`ArrowRight` because this is a vertical `menu` and NOT
  // `ExternalActionSection`'s `radiogroup`) and `scrollTopToReveal` (reveal in both
  // directions, the already-visible no-ops, the `clientHeight` 0 refusal that is jsdom's
  // branch, and non-finite totality).
  //
  // ⚠ THE SCROLL FIXTURE IS THE SHIPPED PANEL, and it reproduces a live measurement rather
  // than resembling one: a 41px header plus seven 48px rows is `scrollHeight` 377 against
  // `clientHeight` 209, so row 7 reveals at exactly 168 — which is both the panel's own
  // maximum `scrollTop` and the figure the clipping half's driven wheel recorded.
  // Read from THIS SCRIPT'S OWN `actual` column across two agreeing runs, 2026-08-08 (both
  // printed `editAffordance.test.ts 31 63 +32`), in the SAME COMMIT as the tests.
  "editAffordance.test.ts": 63,
  // 189-14 Task 2 (D-04 / D-24): 42 -> 49. An EXTENSION — every shipped case is unmoved.
  // The +7 pin the arming switch's refusing state on `external_action`: it renders ON with
  // `actionRiskArmed: false` supplied (the state a freshly-placed step is in), it is
  // `disabled` + `aria-disabled` and its callback is proven NOT to fire by a DRIVEN CLICK,
  // its reason is real DOM text wired by `aria-describedby` with NO `title` anywhere, it is
  // NOT struck through (with a positive control proving the strike-through class really
  // does render where 142-B puts it), and `DIAL_TYPES` is asserted byte-identical on source.
  // ⚠ The FIRST of the seven is the NEGATIVE CONTROL over all six shipped types — without
  // it the whole block would pass on a switch disabled everywhere.
  "GovernanceSection.test.tsx": 49,
  "StarterTemplatePicker.test.tsx": 40,
  "canvasNudge.test.ts": 31,
  "governanceVocabulary.test.ts": 30,
  // 189-13 (D-189-DEF-02): 27 → 32. An EXTENSION. The +5 close the deferred item that
  // 189-04 opened and 189-12 left untouched — the author-facing tool rail would have
  // painted a STRUCTURALLY REQUIRED capability struck through and pressable. The rail was
  // already unreachable for `external_action` BY CONSTRUCTION (two mutually exclusive
  // `pt === …` branches, no default arm), so no render code changed; what was missing was
  // a MECHANICAL guard. Four of the five went RED against PLANT Z5 — the exact wrong fix
  // (giving the type the generic rail and widening its options with the three capability
  // names), which is the D-20 hole 189-04 closed.
  "PhaseFormPanel.rails.test.tsx": 32,
  // 189-14 — NET-NEW: the capability picker's suite, pinned in THE COMMIT THAT CREATED IT.
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES THIS PIN, and the omission is measured rather than
  // assumed: `src/components/workflows` is already a TARGETS **directory** entry, so the
  // file RUNS the moment it exists (the gate printed it as `new` before this line was
  // written, which is how the claim was checked). TARGETS and BASELINE are two knobs —
  // TARGETS decides what RUNS, BASELINE what is PINNED — and only the second one was
  // missing. Adding a redundant file-level entry beside a directory that already covers it
  // would state a dependency that is not real. 188-12's correction still applies in full:
  // an unpinned file is not lightly guarded, it is UNGUARDED, so the pin is not deferred
  // "while the count grows".
  "ExternalActionSection.test.tsx": 25,
  // 190-12 (CONN-02 / CONN-03) — NET-NEW: the connection picker's suite, pinned in THE
  // COMMIT THAT CREATED IT, the rule `ExternalActionSection.test.tsx:12` states verbatim.
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES THIS PIN either, and the omission is measured the same
  // way its 189-14 neighbour above measured its own: `src/components/workflows` is already
  // a TARGETS **directory** entry, so this file RAN and printed as `new` in two agreeing
  // gate runs BEFORE this line existed — which is how the number below was read, out of
  // this script's own `actual` column, rather than counted by hand.
  // The 20 pin the picker's seven UI-SPEC §6d states as SEVEN (populated ≠ empty ≠ loading
  // ≠ error), Gate 1 with its own non-vacuity control (a healthy connection DOES bind), the
  // provider-less render that protects two shipped suites, and T6 — that the ONLY key ever
  // written into the definition JSONB is `connection_id`. Four were driven RED against real
  // plants in production source, each restored with an empty `git diff`: the planted
  // `smtp_password` write, Gate 1 short-circuited off, the effect's disconnected guard
  // deleted, and the `aria-disabled` attribute removed. Recorded in `190-12-SUMMARY.md`.
  //
  // ⚠ RAISED 20 → 58 at 206.2-02, IN THE SAME COMMIT AS THE CASES IT COUNTS. The 38 added
  // cases pin the picker's SECOND SHAPE: that the MCP read calls `listConnectorConnections()`
  // with ZERO arguments (the one line SEED-200 is about, asserted as `mock.calls[0]` being
  // `[]` and not merely as "some call happened"), that neither shape lists the other's rows
  // from ONE org holding both, that a disabled MCP row is not a choice either, that the two
  // MCP absences stay TWO SENTENCES with their own `data-empty-reason`, that the repaired
  // destination ladder names an MCP row's OWN host — with a SYNTHETIC-FIFTH-SHAPE control
  // asserting both an empty list and the absence of `SLACK_FIXED_DESTINATION`, because "not
  // Slack" alone would pass on some other wrong host — and TWELVE byte-identity captures
  // (3 capability fixtures × 4 states) taken from the BASE commit's own component and never
  // re-captured, each behind a COUNTED `useId` normalization whose per-state replacement
  // count is measured (2 / 2 / 4 / 1) rather than reasoned about.
  // ⚠ AGAIN NO `TARGETS` EDIT, and again measured rather than assumed: this file is already
  // pinned below, so it already RUNS via the `src/components/workflows` directory entry —
  // the number 58 was read out of THIS SCRIPT'S OWN `actual` column on a full run before
  // this line was written, never counted by hand off the source.
  // ⚠ Raising a pin necessarily deletes one line, so a `grep -c '^-[^-]'` expecting 0 on
  // this file is the wrong check here; exactly one deletion — this pin's old value — is
  // correct, and more than one is not.
  "ConnectionPicker.test.tsx": 58,
  // 190-16 (CONN-02 / D-25 / D-26 / D-27) — NET-NEW: the Settings → Connections suite,
  // pinned in THE COMMIT THAT CREATED IT, the rule `ExternalActionSection.test.tsx:12`
  // states verbatim and that `ConnectionPicker.test.tsx` above followed.
  // ⚠ UNLIKE its two neighbours, THIS ONE DID NEED A `TARGETS` EDIT, and the difference is
  // the two-knob rule rather than an oversight: `src/components/settings/` is covered by
  // NOTHING in `TARGETS` — the directory entries reach only `src/components/workflows`,
  // and everything else is a NAMED file under `src/pages/`, `src/components/panel/__tests__/`,
  // `src/lib/` or `src/components/layout/`. Measured: the gate's printed file list did not
  // contain this suite before the entry existed. So TARGETS gained a file-level line in the
  // same commit (see its own note below the map), and the number here is this script's own
  // printed `actual` column across TWO AGREEING RUNS on 2026-08-09 (both printed
  // `ConnectionsTab.test.tsx — 34 new`, total 2786, failed 0) — never a hand count of `it(`
  // literals, which is unsound under `it.each`.
  //
  // What would be unguarded without it: SEVEN of the 34 cases are ABSENCE assertions, the
  // easiest kind to delete unnoticed — the non-admin Add button ABSENT rather than
  // `disabled` (U-02: a `toBeDisabled()` assertion PASSES on the very defect), the OFF
  // banner appearing ZERO times on any row (D-26 — at 24 rows a per-row notice is 24
  // identical amber lines), zero `[title]` nodes with a menu AND a sheet open (142-B), no
  // secret-shaped key in the markup (T-190-16-T7), no toast mounted (062-A), the
  // `Check credential` item REMOVED rather than inert while 190-15 is unlanded, and both
  // no-victim direct flips opening NO dialog. Seven plants were applied to real production
  // source and each observed RED before this pin existed, with the file restored
  // md5-identical (`cb66363a…`) after every one — recorded in `190-16-SUMMARY.md`.
  //
  // ⚠ ONE MEASUREMENT WORTH INHERITING: the first gate run with this suite in it reported
  // **8 failing tests — 2 here and SIX IN UNRELATED SHIPPED SUITES**
  // (`WorkflowBuilderPage`, `FlowEdge`, `PhaseNode`, `PhaseSpineGraph`, `StepTypePicker`,
  // `WorkflowCanvas.editing`), all as bare `STACK_TRACE_ERROR` timeouts. None was a
  // regression: this suite's `userEvent.setup()` calls used the DEFAULT per-keystroke delay,
  // and the resulting wall-clock cost starved six neighbours past the 5 s default. Switching
  // to `userEvent.setup({ delay: null })` cleared all eight. A slow new suite inside this
  // gate is not merely slow — it reds files it never touches.
  "ConnectionsTab.test.tsx": 102,
  // ── 206.1-01 (item 3, CONN-02 / SC#3) — the per-service mark map's own suite. ──
  // The number is THIS SCRIPT'S OWN `actual` column across TWO AGREEING RUNS on 2026-08-25
  // (both printed `connectionMark.test.tsx — 39 new`, total 5511, failed 0) — never a hand
  // count of `it(` literals, which is unsound under the six `it.each` blocks this suite uses.
  //
  // ⚠ IT NEEDED BOTH KNOBS, like `ConnectionsTab.test.tsx` above and for the same reason:
  // the two existing `src/components/settings/` entries are FILE-LEVEL, so a third file in
  // that directory is reached by neither. See the TARGETS note for the measurement that
  // established it (the grand total moved by the FIVE cases added to `ConnectionsTab` and by
  // NONE of this suite's 39) and for the honest record that the entry landed ONE COMMIT
  // LATE against the same-commit rule the blocks above state.
  //
  // ⚠ THE PIN DIRECTLY ABOVE IS DELIBERATELY LEFT AT 36 THOUGH THAT SUITE NOW REPORTS 41.
  // The gate's contract is *no per-file DECREASE*, so 41 satisfies a pin of 36, and RAISING
  // a pin necessarily deletes a line — which this file's own ledger row names as the thing
  // that makes a `-0` deletion check wrong. ADDING a pin is not RAISING one; this edit is
  // additions only.
  // ⚠ RE-BASELINED 39 -> 75 in Phase 221. The old floor was 36 cases below the actual
  // count, so this file could have LOST half its assertions and the gate would have said
  // OK. The rise is not this phase's work — 221 adds exactly one case (the "one home"
  // repo scan); it is 36 cases of drift the stale pin was hiding.
  "connectionMark.test.tsx": 75,
  // ── 214-08 (STEP-04 / SC#4 / D-214-16) — the shared step-identity element's own suite, ──
  // ── pinned in the commit that creates it, because a `BASELINE` key naming a path that ──
  // ── does not yet exist makes this gate ERROR (exit 2) rather than fail. ──────────────
  //
  // ⚠ IT NEEDS ONLY THIS KNOB, AND THAT WAS CHECKED RATHER THAN ASSUMED: the file sits
  // under `src/components/workflows`, which is the ONE directory-level entry in `TARGETS`,
  // so it RAN the moment it existed. Contrast its sibling in the same commit —
  // `connectionMark.test.tsx` moved to `src/lib`, which has NO directory entry anywhere in
  // this script, and so needed its `TARGETS` PATH repointed while its BASENAME pin above
  // resolved untouched. Same commit, two files, two different answers.
  //
  // ⚠ THE NUMBER IS A SCOPED-RUN MEASUREMENT, NOT THIS GATE'S OWN `actual` COLUMN, and the
  // difference is recorded rather than glossed. Phase 214's wave-2 executors run under an
  // orchestrator rule forbidding a full gate run (two sibling agents were active; `count
  // gate OK` is not reliably reachable on demand — SEED-171). `41` is what
  // `npx vitest run src/components/workflows/StepIdentity.test.tsx` reported on FOUR
  // separate invocations at `GSD_VITEST_MAX_WORKERS=2`, three of them the green runs
  // bracketing four planted-defect RED drives. Plan `214-15` re-derives it at the phase
  // close. ⚠ Never a hand count of `it(` literals — unsound under the three `it.each`
  // blocks this suite uses.
  //
  // What would be unguarded without it: the three properties sketch 216 #6 says the import
  // fence STRUCTURALLY CANNOT catch (resolved-but-EMPTY / -IDENTICAL / -INVISIBLE), the
  // null-service arm that must render the action ALONE, and the wire-id sweep. Each was
  // driven RED against a planted defect before this line was written.
  "StepIdentity.test.tsx": 41,
  // ── 190-17: the add/edit panel's own suite, pinned in the commit that creates it. ──
  // Number read from THIS SCRIPT'S OWN `actual` column across two agreeing runs — never a
  // hand count of `it(` literals, which is unsound under the `it.each` this suite uses for
  // the three capability field-counts.
  //
  // What would be unguarded without it: NINE of the 31 cases are ABSENCE assertions, and
  // three of those guard properties that exist NOWHERE else in the tree —
  //   · the FOCUS TRAP and the FOCUS RESTORE, which `Dialog` would have supplied for free
  //     and which sketch 156-A's push/split container supplies not at all (§14 verbatim:
  //     *"the panel traps focus nowhere (Tab escapes into the table behind it)"*). Both are
  //     asserted through `document.activeElement`, not by the presence of a handler — a
  //     handler that exists and does the wrong thing passes the weaker check;
  //   · the write-only secret: NO `input[type=password]` in edit mode, the dots proved to
  //     be a `<span>`, and a whole-markup sweep for `xoxb-` / `enc:v1:` / `ciphertext`;
  //   · D-190-DEF-07's structural half — with `live_connectors` off, Save / `Replace` /
  //     every input are ABSENT rather than `disabled`, plus zero `[disabled]` nodes.
  //
  // TEN plants were applied to real production source (nine to `ConnectionFormPanel.tsx`,
  // one to `ConnectionsTab.tsx`) and every one observed RED before this pin existed, each
  // file restored md5-identical afterwards. ⚠ THE ONE TO READ IS PLANT E: Save rendered
  // `disabled={saving || !showSave}` instead of REMOVED — 190-16's plant C, applied to this
  // surface — and it was checked for REACH, not merely for RED: the two failures it
  // produces are named `renders static text, no Replace and no Save — ABSENT, not disabled`
  // and `every WRITE affordance is REMOVED while the switch is off`. A `toBeDisabled()`
  // assertion would have PASSED on both.
  //
  // ⚠ `userEvent.setup({ delay: null })` in every case, inheriting the measurement recorded
  // against `ConnectionsTab.test.tsx` directly above: a slow new suite in this gate is not
  // merely slow, it reds six files it never touches.
  //
  // ── RE-PINNED 31 → 63 by plan 190-18 (2026-08-09), in the commit that adds the cases ──
  // The +32 are the refusal copy, the check moments and the graded guards: §4c's closed
  // six-row table read against `egress.py`'s OWN source through `?raw` (parser falsified on
  // synthetic input first), §4b's asymmetry asserted in BOTH directions with the
  // `aria-describedby` proved to RESOLVE, §4d's two forbidden swaps over all three buckets,
  // §5b's sentence by EXACT equality plus an absolute-verb fence over every string the copy
  // module can produce, §5c's negation pinned against `_EXTERNAL_ACTION_NEGATION`, a sentinel
  // secret swept out of every `data-*` / `aria-label` / `title` with a positive control, and
  // §2g's graded guards.
  //
  // TEN plants were applied to real production source and every one observed RED, each file
  // restored md5-identical. ⚠ TWO OF THEM STAYED GREEN ON THE FIRST ATTEMPT AND BOTH ARE
  // RECORDED RATHER THAN QUIETLY RE-AIMED: plant C renamed the `aria-describedby` id in the
  // ONE constant that feeds both ends, so the wiring still resolved (the plant was wrong, and
  // desynchronising the two ends reds it); plant D made the REFUSED branch render §5b's
  // sentence and the fence saw nothing, because that sentence carries "failing" and "fail"
  // but never the whole word "failed" that §14 names — THE TEST was wrong, and it now
  // asserts the stem.
  "ConnectionFormPanel.test.tsx": 63,
  // Pinned 2026-09-05 at the gate's OWN printed `— N new` figure, never a hand count of
  // `it(`. Guards the destructive/non-destructive split in the re-embed confirm gate; see
  // the TARGETS entry for why this suite needed both knobs.
  "ReembedConfirmModal.test.tsx": 7,
  // 184.1 pinned NOTHING here on purpose ("it postdates the 424 pin, so it reports as `new`
  // and its own count is free to grow"). Four phases later it is still the ONLY guard on the
  // flag-off Builder header — D-181-01's byte-identity promise — and it has stopped growing.
  // The now-false TARGETS comment below is corrected in this same commit.
  // Nyquist gap-closure (2026-08-06): 27 → 32. EXTENDED, not lowered — nothing deleted or
  // reworded; five appended cases now pin D-184.1-03 (the merged row driven onto the SPINE
  // tab explicitly, not just incidentally by default) and D-184.1-04's non-breach half
  // (useEffectiveFeatures() has exactly one non-test call site, App.tsx). Both falsified and
  // reverted before this pin moved. Read from this script's own `actual` column across two
  // agreeing runs, same as every other extension in this map.
  "WorkflowBuilderPage.header.test.tsx": 32,
  // 193 AUTH-03 piece 2 — NET-NEW: the author-time template door's suite, pinned in THE
  // COMMIT THAT CREATES IT, the rule `ExternalActionSection.test.tsx:12` states verbatim.
  // ⚠ NO `TARGETS` EDIT ACCOMPANIES THIS PIN, and the omission is measured rather than
  // assumed, exactly as its 189-14 / 190-12 neighbours measured their own:
  // `src/components/workflows` is already a TARGETS **directory** entry, so this file RAN
  // and printed as `new` in the gate run BEFORE this line existed — which is how the number
  // was read, out of this script's own `actual` column, and never hand-counted from `it(`.
  //
  // What would be unguarded without it: the three claims a template door can most easily
  // break silently — that a REFUSAL says what was wrong in words (a whole-container sweep
  // asserts NO bare `404`/`422`/`502`/`500` ever reaches the DOM), that the control keeps NO
  // local mirror of the filename (so it can never claim an attachment the DEFINITION does
  // not carry), and that `setTemplateAsset` REPLACES rather than appends — `.find(a => a.kind
  // === "template")` is the read on both sides of this circuit, so a second entry leaves the
  // surface and the run engine both pinned to the OLD file forever.
  //
  // TWO plants were applied to real production source and both observed RED before this pin
  // existed — the append-instead-of-replace filter removed from `builderStore.ts` (2 failures)
  // and the 404 branch relaying the server's terse detail instead of the both-causes sentence
  // (1 failure) — with both files restored (`TemplateAttachSection.tsx` md5-identical at
  // `0414bf98…`). Recorded in `AUTH-03-FRONTEND-SUMMARY.md`.
  //
  // 260814-q5r: 25 → 43 (+18). The section now shows WHAT the attached template asks for,
  // and the eighteen new cases exist because an empty field list is ambiguous: "we read it
  // and found nothing" and "we never read it" are different facts, and merging them tells an
  // author their template is field-less when the read simply failed. RED-4 planted exactly
  // that merge — the `unavailable` branch rendered `TEMPLATE_FIELDS_NONE` under the
  // `template-fields-none` testid — and observed **5 failed | 38 passed**, headed by
  // `TestingLibraryElementError: Unable to find an element by:
  // [data-testid="template-fields-unavailable"]` with a full DOM dump, NOT a bare timeout.
  // Source restored md5-identical at `37181e61…`. The number below is the gate's OWN reported
  // actual, read off its output, never a predicted one.
  "TemplateAttachSection.test.tsx": 43,
  // 200-06 (BC-MR-01 / BC-MR-02): 22 → 34, and the +12 is ENTIRELY this plan's — the gate's
  // own drift column read `22 34 +12` on the run that first executed the new cases, with no
  // pre-existing gap on this file to decompose. Read from the `actual` column, never counted
  // from `it(` literals. The twelve are the payload label (declared count, DECLARED ZERO, a
  // DOM absence where nothing was declared, the verbatim noun, survival on an armed
  // connector, the typeof-arm source fence) and the four connection states with their
  // absence case and positive control.
  "FlowEdge.test.tsx": 34,
  // 188.1-01: 19 → 20. EXTENDED — the same move-invariant subtree-fence control, carried
  // here as well because this suite re-scopes its own five negatives and a control living in
  // another file protects another file. Twice-measured from the `actual` column.
  // ── 200-06 — a NEW suite, pinned in the SAME COMMIT that creates it ────────────────
  //
  // ONE knob, and which one is CHECKED rather than assumed: `connectionState.test.ts` lives
  // under `src/components/workflows`, already a DIRECTORY entry in the `TARGETS` array
  // below, so it RAN the moment it existed and this script printed it as `— 13 new` before
  // this line was written. A `TARGETS` edit would have been redundant; a `BASELINE` entry
  // would not, because TARGETS decides what RUNS and BASELINE decides what is GUARDED, and
  // an unpinned file is not a lightly-guarded one — it is an unguarded one.
  //
  // The number is the gate's OWN `actual` column on that first run, never hand-counted.
  "connectionState.test.ts": 13,
  "WorkflowCanvas.composition.test.tsx": 20,
  "CanvasToolbar.test.tsx": 14,
  "BuilderSaveRegion.test.tsx": 11,
  // ── 192-01 (Phase 192 Wave 0, the FIRST commit of the phase) ───────────────────────
  // Four suites that render the LIVE `WorkflowsPage` and were pinned by NOTHING. Each also
  // required a `TARGETS` line in this same commit — the two-knob rule, eighth occurrence and
  // the second entry in this map (after `ConnectionsTab.test.tsx` at 190-16) that needed BOTH
  // knobs. WHICH EXISTING ENTRY FAILED TO COVER THEM, measured from the gate's own printed
  // `running:` line on an unmodified tree: the directory entries reach only
  // `src/components/workflows`; `src/pages` is reached by five NAMED files and
  // `WorkflowsPage.test.tsx` is not among them; `src/pages/__tests__` is reached by nothing
  // at all. See the TARGETS block below for the full argument.
  //
  // ALL FOUR NUMBERS WERE READ FROM THIS SCRIPT'S OWN PRINTED `actual` COLUMN — the run that
  // first put these files inside TARGETS printed them as `new` rows at 23 / 11 / 8 / 7, and
  // two further runs after the pins landed printed `delta 0` on every one. NEVER hand-counted
  // from `it(` literals, never copied from a planning document: 192-RESEARCH.md predicted
  // exactly these four figures, and the pin is the MEASUREMENT, not the prediction it happens
  // to agree with.
  //
  // ADOPTING IMPORTS NO ROT: `failed 0` on the unmodified tree and `failed 0` on every run
  // after adoption.
  //
  // ⚠ `WorkflowsPage.test.tsx`'s pin WILL be LOWERED later in Phase 192, when D-01's
  // restructure deletes the shelf-order cases. That lowering must ride in the SAME COMMIT as
  // the deletion, at a number read from this column — never to make a red gate go quiet.
  //
  // ── 192-10: THE LOWERING PREDICTED ABOVE, 23 → 22. THE ONE PIN THIS PHASE LOWERS. ──────
  //
  // It rides in the same commit as the deletions that justify it, and the two deletions are
  // NAMED so a later reader can audit the trade rather than take it on trust:
  //
  //   DELETED (2) — both asserted the DOM ORDER OF THE THREE SECTIONS that D-02 removes:
  //     1. "the Published shelf renders ABOVE the Drafts shelf (DOM order — BUG-260628-01
  //        fold, D-143-5)"
  //     2. "folds BUG-260628-01 (SC-e): section order is Starters → Published → Drafts
  //        (runnable no longer buried under drafts)"
  //   ADDED (1) — "a REJECTED /workflows/drafts still renders the published rows and the
  //     starter". The D-16 merge's highest-risk defect: `/drafts` is gated while /published
  //     and /starters are the RUN CARVE-OUT, so a `Promise.all` plus one shared error path
  //     empties the WHOLE library on a 403. A test where all three feeds resolve is green
  //     against both shapes and proves nothing; this one is not.
  //
  //   23 − 2 + 1 = 22, which is arithmetic — and arithmetic is NOT how this number was
  //   obtained. IT WAS READ FROM THIS SCRIPT'S OWN `actual` COLUMN: the run made against the
  //   restructured suite printed `WorkflowsPage.test.tsx  23  22  -1`, and two further runs
  //   after this edit printed `delta 0`. The sum above merely has to AGREE with the
  //   measurement; if it ever did not, the measurement would win.
  //
  //   The BUG the two deleted cases folded is not un-fixed by their removal: BUG-260628-01
  //   was "runnable work is buried under drafts", and 157-B answers it more strongly than a
  //   section order can — a user who wants runnable rows says so with the *Ready to run*
  //   chip and receives exactly the count that chip promised, which `libraryFilter.test.ts`
  //   proves as arithmetic, per chip, without a DOM.
  //
  // NO OTHER PIN IS LOWERED HERE. `WorkflowBuilderPage.header.test.tsx` (32) and
  // `.session.test.tsx` (23) both had selectors updated by the same restructure and both
  // still read their pinned numbers exactly — a selector change must never move a count.
  // ⚠ ALL FOUR RAISED BY 192-12 (the phase's closing commit) — 22→39, 11→32, 8→16, 7→32.
  // The argument, the per-suite attribution and the four drifts deliberately left alone are
  // in the 192-12 block at the foot of this map. Read from the printed `actual`, twice.
  // 40, not 39: the CR-01 fix (all-three-feeds-fail must not claim "you have no workflows
  // yet") added one case AFTER 192-12's pinning sweep read 39. Raised here rather than left
  // low — a pin below the real count is a pin that cannot see the next deletion.
  //
  // ── 192-16 (GAP-CLOSURE ROUND 1, wave 4): 40 → 48. AN EXTENSION, NEVER A LOWERING. ──────
  //
  // Nothing was deleted, renamed or moved out of this suite by the round — `git diff` over
  // waves 2 and 3 is +291 insertions / 0 deletions on the test file — so no plan-authorised
  // deletion needs to ride along (the LOWERED-vs-EXTENDED distinction in the header). The
  // eight are the ONLY mechanical memory of a LIVE BLOCKER a human found by clicking:
  //   · 192-14 (+4) — the fork-collision branch 3176 passing tests NEVER ENTERED. The only
  //     difference between the new describe and the shipped one above it is ONE EXTRA ROW in
  //     the drafts feed, which is the entire reason `⋯ → Make my own copy` could 409 twice in
  //     silence through a 12-plan phase, a code review and a 6/6 verification.
  //   · 192-15 (+4) — WR-03's failure visibility: the first tests in this repo that ever drive
  //     a FAILING fork on EITHER handler, including the starter's single 409 retry pinned from
  //     the inside at exactly two `createWorkflowDraft` calls (measured RED-side too, so the
  //     retry can neither have been introduced by the repair nor be deleted under cover of it).
  //
  // THESE PINS EXIST SO THAT DELETING A REGRESSION TEST FOR A LIVE BLOCKER REDS THE GATE with
  // `[count-decrease]` NAMING THE FILE — at `failed 0`, the count decrease being the only
  // signal. Demonstrated, not asserted: one whole `it(` block removed from the 192-14 block
  // was observed printing `WorkflowsPage.test.tsx 48 47 -1` → `[count-decrease]`, exit 1, and
  // the file restored md5-identical (`192-16-SUMMARY.md` carries both hashes).
  //
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-11, both
  // printed `WorkflowsPage.test.tsx 40 48 +8` at `total 3188 · failed 0` — never hand-counted
  // from `it(` literals, and NEVER taken from a SUMMARY: `192-14-SUMMARY.md` recorded this
  // raise as owed at `40 → 44`, which was true when it was written and stale four cases later.
  // ── 192.1-07 Task 2 (LIB-05 / D-19…D-24): 48 → 52. AN EXTENSION, NEVER A LOWERING. ──────
  // The +4 are the name prompt's END-TO-END arc, driven on the live page rather than on the
  // component: (1) D-23's blocker guard — on an already-forked published row NO dialog mounts
  // and `createWorkflowDraft` is called zero times; (2) its POSITIVE CONTROL — the same verb
  // on a row with no existing draft DOES mount the dialog, and still writes nothing until the
  // name is given; (3) the copy ARRIVES under the typed name (`definition.name`, which the
  // server writes to the row's `name` COLUMN — LIB-05's actual fix, since a Builder caption
  // alone would leave the library as unreadable as it was); (4) D-20 end-to-end over the REAL
  // pre-flight rather than a stubbed `isClash` — a name already in the merged feed warns and
  // the create happens anyway.
  // ⚠ CASE (1) WAITS ON A PRESENT NODE BEFORE QUERYING AN ABSENCE (T-4). This file sets
  // `asyncUtilTimeout: 15000`, longer than vitest's 5 s budget, so a `findBy` on an absent
  // dialog would blow the TEST timeout and read as D-192-DEF-01 rather than as a defect.
  // ⚠ NOT ONE `expect(…)` LINE IN THE TWELVE SHIPPED FORK CASES WAS EDITED — the 192-14 block
  // and T-192-42's two-call pin are byte-identical and green. What changed is the
  // INTERACTION: every case that reaches a create now types a name first, because that is
  // what a person now does. The single exception is stated rather than buried — the Builder
  // caption assertion moved from the parent's SLUG to the typed NAME, because the behaviour
  // moved with it.
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-13, both
  // printing `WorkflowsPage.test.tsx 48 52 +4` and `librarySubtree.fences.test.ts 116 117 +1`
  // at `total 3436 · failed 0` — never hand-counted from `it(` literals.
  "WorkflowsPage.test.tsx": 59,
  // 193-01 + 193-07 (AUTH-03 / D-17 / D-18 / D-19 / D-20), pinned by 193-10's sweep: 32 → 40. An
  // EXTENSION, never a lowering — Phase 193 deleted no `it(` here. The +8 are the two halves of
  // the template cut: 193-01's WAVE-0 case, written BEFORE the cut and driven RED, that a launch
  // failure stays VISIBLE on a workflow that positively cannot fill a template; and 193-07's
  // four-arm render coverage of `templateAdmission` at the rendered surface, with `unknown` proved
  // to render IDENTICALLY to `admits` against one shared expected value.
  //
  // ⚠ THE LAUNCH-FAILURE CASE IS THE ONE THAT MATTERS AND IT IS PINNED FOR A NAMED REASON.
  // `launchError` is NOT template-only — `handleRun`'s catch sets it on ANY `onRun` rejection, and
  // its node lived INSIDE the wrapper D-17 removes. A naive hide makes every non-template launch
  // failure silent, which is the WR-03 class of defect Phase 192's gap round had to repair on this
  // exact surface. The case predates the cut by design, so it is a falsification and not a
  // description; unpinned, the whole guard sat in eight cases of slack.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`RunModal.test.tsx 32 40 +8`).
  "RunModal.test.tsx": 40,
  // 193-07 (AUTH-03 / D-18), pinned by 193-10's sweep: 16 → 20. An EXTENSION, never a lowering.
  // The +4 guard that D-18's `Template to fill` is a TEXT NODE and not a `<label htmlFor>` bound
  // to a hidden input — the a11y half of naming the control — plus the D-19 provenance sentence
  // travelling with the block it describes. A `<label>` here would read plausibly and would
  // silently re-point the accessible name; nothing else in the battery can see that.
  "RunModal.a11y.test.tsx": 20,
  "PublishedCardDelete.test.tsx": 32,
  // 192-01 Task 2: the FIFTH covering suite. `WorkflowBuilderPage.session.test.tsx` renders
  // the LIVE `WorkflowsPage` three times (`:482`, `:510`, `:768`) and was pinned by nothing —
  // an unpinned covering suite is an UNGUARDED one, not a lightly-guarded one. It needed BOTH
  // knobs, same as the four above.
  // ⚠ RESEARCH ASSUMPTION A6 IS RECORDED IN THE TARGETS BLOCK BELOW, BEFORE THIS PIN: the
  // "pane click" case was measured at 5060 ms against a 5000 ms limit under `--maxWorkers=4`
  // in a mixed run and passed on re-run — a parallel-load flake, not latent rot. Confirmed
  // before pinning by two standalone runs, both `23 passed (23)` / 0 failing. Read from this
  // script's own `actual` column: it reported `— 23 new` on the run that first put the file
  // inside TARGETS, and `delta 0` on the two runs after this pin landed.
  "WorkflowBuilderPage.session.test.tsx": 23,
  // ── 192-12 (Phase 192 Wave 8, the CLOSING commit): THE EXEMPTION EXPIRES ───────────────
  //
  // 188-12's statement, applied to this phase's own output: AN UNPINNED SUITE IS AN
  // UNGUARDED ONE, not a lightly-guarded one. Waves 2–5 deliberately left the four suites
  // they CREATED out of this map while their counts were still growing — the same exemption
  // 188-12 granted and then had to revoke fifteen times. `192-VALIDATION.md` § "Gate
  // ownership across waves" wrote the expiry date into the plan rather than leaving it to
  // anyone's memory, and this is that expiry.
  //
  // ⚠ NO `TARGETS` LINE IS NEEDED FOR THE FOUR NEW ONES, AND THAT IS MEASURED RATHER THAN
  // ASSUMED — which matters, because the two-knob trap has now fired eight times in this
  // script and its EIGHTH firing (192-01) was on this very phase. All four live under
  // `src/components/workflows/library/`, which the DIRECTORY entry `src/components/workflows`
  // already reaches: the gate's own printed columns listed each of them as `— NN new`,
  // i.e. it was already EXECUTING them and merely not PINNING them. A file the gate never
  // runs cannot report a number at all, so a printed `actual` IS the proof that TARGETS
  // already covers it. (Contrast 192-01's four, which printed nothing until their TARGETS
  // lines landed.)
  //
  // EVERY NUMBER BELOW WAS READ FROM THIS SCRIPT'S OWN PRINTED `actual` COLUMN across two
  // agreeing runs — never hand-counted from `it(` literals, never carried from a SUMMARY.
  // ⚠ THAT DISTINCTION IS NOT CEREMONIAL HERE: `192-10-SUMMARY.md` recorded
  // `WorkflowsPage.test.tsx` as "settled at 22 and needs nothing further", and by wave 7 it
  // was 39. `192-11-SUMMARY.md` in turn handed forward `librarySubtree.fences.test.ts` at
  // 47, and this plan's OWN Task 1 took it to 64. A pin quoted from prose is stale by
  // default; a pin read from the column is stale only if the column is.
  //
  // ── The four suites Phase 192 CREATED, pinned here for the first time ──────────────────
  // ── 192.1-01 (LIB-05 / D-15): 36 → 48. AN EXTENSION, NEVER A LOWERING. ─────────────────
  // The +12 are the `updated_at` → `updatedAt` hop and its D-16 fence: both normalizers
  // lifting the field (each with its own POSITIVE CONTROL), the absent and explicit-null
  // paths collapsing to `undefined` rather than to a fabricated time, survival through
  // `mergeLibrary` on all three provenances including the `source-failed` partial, and the
  // D-16 group — a draft whose `token` DISAGREES with its `updated_at`, so a normalizer
  // reading the token cannot produce the right answer, plus a source fence over the two
  // `updatedAt:` assignments with its own planted positive control.
  // ⚠ THE SOURCE FENCE IS SCOPED TO NON-COMMENT LINES DELIBERATELY. Both normalizers carry a
  // comment saying why `row.token` is forbidden, so an unscoped needle would RED on a clean
  // tree — the trap `librarySubtree.fences.test.ts` already records twice (`:186-193`,
  // `:497-506`). Stripping line comments is what makes the fence about code, not prose.
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-12, both
  // reporting `libraryFilter.test.ts  36  48  +12` and `total 3200 · failed 0`. Never
  // hand-counted from `it(` literals, never carried from a SUMMARY — the distinction this
  // block's header paragraph records is not ceremonial.
  "libraryFilter.test.ts": 96,
  // ── 192.1-03 Task 1 (D-01 / D-33): 64 → 67. AN EXTENSION, NEVER A LOWERING. ────────────
  // The +3 are arithmetic, not authorship: `LIBRARY_SUBTREE_PATHS` gained ONE path
  // (`./libraryFork.ts`, the G-5 fork extraction's pure leaves) and exactly three
  // `it.each(LIBRARY_SUBTREE_PATHS)` blocks sweep it — F1 (`:202`), T-192-04 (`:224`) and F4
  // (`:266`). One path × three sweeps = +3, and the arithmetic is stated so the NEXT module
  // added is expected to move this by three again rather than by a number someone guesses.
  // ⚠ THE CORPUS EDIT AND THIS PIN ARE ONE COMMIT BY DESIGN (D-33). An unlisted module is
  // swept by NOTHING while every fence stays green, so the `toHaveLength` assertion is what
  // forces the pairing — it was observed RED (`expected […] to have a length of 7 but got 8`)
  // before either number was written.
  // ── 192.1-03 Task 2 (D-01 / D-29 / D-33): 67 → 70. The SAME +3 arithmetic, again. ──────
  // `./useWorkflowFork.ts` joined the corpus in the commit that created it, and the three
  // `it.each` sweeps picked it up: one path × three sweeps = +3. Observed RED first
  // (`expected […] to have a length of 8 but got 9`), then read from this script's own
  // `actual` column across TWO AGREEING RUNS, 2026-08-12, both printing
  // `librarySubtree.fences.test.ts 67 70 +3` at `total 3217 · failed 0`.
  // ── 192.1-03 Task 3 (D-01 / D-37): 70 → 77. THE OD FENCE, EXTENDED WITH THE CUT. ───────
  // The +7 is arithmetic too, and it decomposes exactly: SIX new `PAGE_MUST_NOT_DECLARE`
  // entries (the fork concern in BOTH declaration families — two module-scope `function`s
  // that the shipped `"function …("` needle matches, and four component-scope `const`s that
  // it never would have) plus ONE new `PAGE_IMPORTED_MODULES` entry (`useWorkflowFork`).
  // ⚠ `libraryFork` is deliberately NOT an eighth: after the cut the page has no use for the
  // pure leaves and does not import them, so listing it would assert a coupling that must not
  // exist — the fence's own recorded rule for `WorkflowDeleteSheet`. This CORRECTS
  // `192.1-03-PLAN.md` Task 3(a), which names both.
  // ⚠ ALL SEVEN WERE DRIVEN RED BEFORE THE CUT, against the page's REAL shipped declarations
  // — a stronger drive than a plant-and-restore, because no file was mutated and none needed
  // restoring. Then read from this script's own `actual` column across TWO AGREEING RUNS,
  // 2026-08-12, both printing `librarySubtree.fences.test.ts 70 77 +7` and
  // `WorkflowsPage.test.tsx 48 48 0` at `total 3224`.
  // ⚠ THE `failed` COLUMN DISAGREED ACROSS THOSE RUNS (1, then 0) AND IS RECORDED RATHER THAN
  // RE-RUN AWAY: D-192-DEF-01 measured `0 / 0 / 1` on a clean tree with the same cap, so on
  // this machine the COUNT columns are the regression backstop and the `failed` line is not.
  // The counts agreed exactly on both runs.
  // ── 192.1-04 Task 2 (D-14 / D-18 / D-33): 77 → 80. THE SAME +3 ARITHMETIC, A THIRD TIME. ─
  // `./relativeChanged.ts` joined the corpus in the commit that created it, and the three
  // `it.each(LIBRARY_SUBTREE_PATHS)` sweeps picked it up: one path × three sweeps = +3. The
  // arithmetic has now held for three consecutive additions, which is why it is restated
  // rather than re-derived: the NEXT module added moves this by three again.
  // ⚠ THE FIXTURE `__fixtures__/libraryScale.ts` ADDS **NOTHING** HERE, AND THAT IS MEASURED
  // RATHER THAN ASSUMED. The corpus glob at `librarySubtree.fences.test.ts:96` is
  // `./*.{ts,tsx}` — NON-RECURSIVE — so a subdirectory module cannot enter it at all; listing
  // the path would contribute the empty string forever, i.e. a path that reads as swept and
  // is not. It is also a non-`.test` module, so the gate never runs it and it needs no pin.
  // ⚠ OBSERVED RED FIRST, as D-33 requires the corpus edit and this pin to be one commit:
  // `expected [ './libraryRow.ts', …(9) ] to have a length of 9 but got 10`, before either
  // number was written. Then READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING
  // RUNS, 2026-08-12, both printing `librarySubtree.fences.test.ts 77 80 +3` and
  // `relativeChanged.test.ts — 37 new` at `total 3264 · failed 0` — never hand-counted.
  // ── 192.1-05 Task 3 (D-09 / D-16 / D-33 / D-35): 80 → 111. TWO NEW FENCES, +31. ─────────
  // The arithmetic decomposes exactly, and it is worth reading because THE MULTIPLIER CHANGED:
  //   +3   `./rowIdentity.ts` joining the corpus × the THREE pre-existing `it.each` sweeps
  //        (F1 `:202`, T-192-04 `:224`, F4 `:266`) — the same +3 that has now held four times
  //   +14  F6 (D-16, the opaque draft field never parsed as a date): 3 controls + an 11-path sweep
  //   +14  F7 (D-09, no owner display name): 3 controls + an 11-path sweep
  // ⚠ THE NEXT MODULE ADDED MOVES THIS BY **FIVE**, NOT THREE. There are now FIVE
  // `it.each(LIBRARY_SUBTREE_PATHS)` blocks. The three previous additions each recorded "+3, the
  // same arithmetic again"; that sentence is now false and is corrected here rather than copied.
  // ⚠ BOTH NEW FENCES WOULD RED ON A CLEAN TREE AS RAW GREPS, MEASURED RATHER THAN INHERITED:
  // the D-16 needle appears 24 times across 4 swept modules and `useWorkflowFork.ts:125,254,308`
  // READS IT IN REAL CODE (so even comment-stripping fails), and the D-09 needle appears 6 times,
  // every one of them prose explaining why the name is not rendered. Both are AST-parsed, both
  // carry a scoping control run over the REAL sources, and both were driven RED against a real
  // plant in `rowIdentity.ts` which was restored md5-identical
  // (`bbc1218cb67abbf6e07e5271e5caada9` before and after, both times).
  // ⚠ OBSERVED RED FIRST for the corpus edit, as D-33 requires it and this pin to be one commit:
  // `expected [ './libraryRow.ts', …(10) ] to have a length of 10 but got 11`.
  // Then READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-12, both
  // printing `librarySubtree.fences.test.ts 80 111 +31` and `rowIdentity.test.ts — 72 new` at
  // `total 3367 · failed 0` — never hand-counted from `it(` literals.
  // ── 192.1-07 Task 1 (D-19 / D-20 / D-33 / D-36): 111 → 116. THE FIVE-MULTIPLIER HELD. ────
  // `./ForkNameDialog.tsx` joined the corpus in the commit that created it, and the FIVE
  // `it.each(LIBRARY_SUBTREE_PATHS)` sweeps picked it up: one path × five sweeps = +5. That
  // is the ⚠ one screen up landing exactly — the block above corrected "+3, the same
  // arithmetic again" to FIVE before this addition, and this is the addition that tested it.
  // ⚠ F1 IS THE FENCE THAT MATTERED HERE, and for a MEASURED reason rather than a general
  // one: the natural shell to clone (`org/InviteMemberDialog.tsx`) carries the forbidden
  // attribute TWICE (`:159`, `:228`), so a dialog module is the one place in this subtree
  // where the violation arrives by COPYING rather than by invention. D-36 says not to clone
  // it; the corpus entry is what makes that mechanical instead of remembered.
  // ⚠ AND THE 187-24 TRAP FIRED AGAIN, INSIDE THIS VERY COMMIT — the fourth instance this
  // subtree has recorded. `ForkNameDialog.tsx`'s docblock explained why the raw-HTML escape
  // hatch is not used, spelled the prop, and T-192-04 (a RAW regex, not a parsed fence) went
  // red on it: `expected '/**\n * Phase 192.1-07 Task 1 (LIB-05…' not to match
  // /dangerouslySetInnerHTML/`. The prose now describes the hatch instead of naming it.
  // ⚠ OBSERVED RED FIRST, as D-33 requires the corpus edit and this pin to be one commit:
  // `expected [ './libraryRow.ts', …(11) ] to have a length of 11 but got 12`, before either
  // number was written. Then READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING
  // RUNS, 2026-08-12, both printing `librarySubtree.fences.test.ts 111 116 +5` and
  // `ForkNameDialog.test.tsx — 18 new` at `total 3431 · failed 0` — never hand-counted.
  // ── 192.1-07 Task 2 (D-19): 116 → 117. ONE MORE, AND IT IS AN `OD` ENTRY, NOT A SWEEP. ──
  // The page MOUNTS `ForkNameDialog`, so the downward edge exists and `PAGE_IMPORTED_MODULES`
  // must name it — a one-case `it.each`, hence +1 rather than +5. It is the first entry there
  // that is a COMPONENT THE PAGE RENDERS rather than a module it calls, which is exactly why
  // `WorkflowDeleteSheet` still is not listed: the Sheet is mounted by the CARD.
  // ⚠ DRIVEN RED AGAINST A REAL PLANT IN PRODUCTION SOURCE, not added blind: the page's import
  // specifier was broken to `…/ForkNameDialogX` and the fence failed with `imports
  // ForkNameDialog from the library subtree … AssertionError: expected '/**\n * Phase 103-06
  // (REQ-7 / WFAUTH-…' to match /from\s+["']@\/components\/…/` at 1 failed / 116 passed.
  // ⚠ AND THE RESTORE WAS md5-CHECKED, WHICH IS WHY THIS NOTE EXISTS. The first restore was
  // CONTENT-correct and NOT byte-identical — `sed -i` under Git Bash rewrote the file LF-only
  // against a CRLF working tree (1160 line endings flipped, zero characters changed), and the
  // md5 caught what a `git diff` could not have: git normalises EOL in the index, so the diff
  // was clean while the file on disk no longer matched its neighbours. Re-terminated to CRLF,
  // the page hashes `bbc827e055dd890b8c6da1e29d82125d` — EXACTLY its pre-plant value.
  // ── /gsd:secure-phase 192.1 (E-1 / E-2): 117 → 118. ONE CASE, TWO FENCES REPAIRED. ──
  // The audit found two DURABILITY holes — both properties held at HEAD, neither was defended:
  //   E-1 T-192.1-16's register claimed the `[rows]` memo key was *"grep-asserted on the literal
  //       dependency array"*. It was not. The only `[rows])` hit in ANY test file was a COMMENT
  //       (`rowIdentity.test.ts:815`), and `WorkflowsPage.test.tsx` names neither `identityIndex`
  //       nor `useMemo`. That is the NEW case, hence +1: an `it` in the OD block with three
  //       synthetic controls (two widenings rejected, one reformat accepted).
  //   E-2 the non-vacuity guard asserted `SWEPT.length >= 3` and named three of twelve modules,
  //       so NINE had no proof they loaded. Repaired IN PLACE — exact equality against
  //       `LIBRARY_SUBTREE_PATHS` subsumes both retired assertions — so it moves no count.
  // ⚠ BOTH DRIVEN RED AGAINST REAL PLANTS, and the E-2 plant is the one worth recording: the
  // corpus entry was changed to `./ForkNameDialog.jsx` (an extension change — exactly how a
  // rename empties a glob key), and the new assertion failed with `- "./ForkNameDialog.jsx"` at
  // 1 failed / 117 passed. THE FOUR `it.each` SWEEPS FOR THAT PATH STILL PASSED — swept against
  // the empty string, green — which is the Phase-190 CR-01 shape demonstrated rather than
  // argued. E-1's plant widened the real memo to `[rows, query]`: 1 failed / 117 passed.
  // ⚠ Both restores md5-CHECKED per the note above: fences `c1f2c17f53fe2fd8a75f07fed0c6d8f1`,
  // and `WorkflowsPage.tsx` left absent from `git status --porcelain`.
  "librarySubtree.fences.test.ts": 118,
  // ── 192.1-07 Task 1 (LIB-05 / D-19 / D-20 / D-36): a NEW suite, pinned in its first commit ─
  // 162-B's name prompt, in `RunModal.a11y.test.tsx`'s posture (the four Radix jsdom shims,
  // `axe()` on the OPEN dialog, roles and accessible names rather than class-name reading).
  // The 18 cover D-19's four mechanical clauses — it ASKS (the field opens empty and focused,
  // never prefilled), its primary is `Create my copy` AND no control is named `Confirm`
  // (paired with a positive control that plants one), it wears no destructive styling
  // (asserted over the rendered `outerHTML`, with a matcher control), and D-20's
  // WARNS-NEVER-BLOCKS — whose headline case SUBMITS THROUGH THE CLASH and reads the argument
  // the callback received, because "the warning renders" is satisfied identically by a dialog
  // that warns and then refuses. Plus reset-on-open, both escapes, the not-`role="alert"`
  // clash hint with its own alert control, and two `axe()` cases (idle and clash).
  // ⚠ THE RED WAS DRIVEN AS REAL AssertionErrors, not as a module-not-found: the component was
  // first written with TWO deliberate defects (`disabled={empty || clash}` and a `Confirm`
  // primary), and the suite failed 4/18 with `expect(element).toBeEnabled() … disabled=""`,
  // `expected "vi.fn()" to be called 1 times, but got 0 times`, and
  // `toHaveAccessibleName() Expected: Create my copy / Received: Confirm`.
  // ⚠ NO `TARGETS` LINE IS NEEDED, and that is measured rather than assumed: the gate printed
  // `ForkNameDialog.test.tsx — 18 new`, and a file the gate never runs cannot report a number
  // at all, so the printed `actual` IS the proof the `src/components/workflows` DIRECTORY
  // entry already reaches it. (Two knobs: TARGETS decides what RUNS, BASELINE what is GUARDED.)
  "ForkNameDialog.test.tsx": 18,
  // ── 192.1-05 Tasks 1+2 (LIB-05 / SC#1 / SC#2): a NEW suite, pinned in its first phase ─────
  // The identity resolver, proved as arithmetic in the `libraryFilter.test.ts` posture — no
  // `render`, no DOM, no clock mock. The 72 cover: the four-state lineage with the version branch
  // checked before the copy branch, D-13's silence driven on the real fixture's seven orphan
  // SLUGS, the D-32 inherited-key probe across five prototype members (× three shapes), the D-31
  // ranker's three rules, the flagship 44-row family with the sketch's `varies()` transcribed as
  // an in-test CONTROL, the D-31 residual asserted as a FLOOR, the >20 / >8 distinctness
  // properties from the sketches' own drives, D-05's scope proof, and D-34's call-count property.
  // ⚠ NO `TARGETS` LINE IS NEEDED, and that is measured rather than assumed: the gate printed
  // `rowIdentity.test.ts — 72 new`, and a file the gate never runs cannot report a number at all,
  // so the printed `actual` IS the proof that the `src/components/workflows` DIRECTORY entry
  // already reaches it. (Two knobs: TARGETS decides what RUNS, BASELINE what is GUARDED.)
  "rowIdentity.test.ts": 72,
  // ── 192.1-04 Task 2 (LIB-05 / SC#3 / D-18): a NEW suite, pinned in its first commit ───────
  // The nine-band formatter, proved in the `libraryFilter.test.ts` posture — pure `describe`s,
  // no `render`, and NO CLOCK MOCK, because `now` is a parameter (`credentialLabel`'s shape).
  // The 37 cover all nine bands, BOTH sides of all eight thresholds, the four values where
  // truncation would disagree, every `null` case paired with a positive control, and four
  // source fences (the imported prefix, no date library, no live tick, and the docblock's
  // admission that this is the THIRD relative-time formatter in the repo).
  // ⚠ NO `TARGETS` LINE IS NEEDED, AND THAT IS MEASURED RATHER THAN ASSUMED: the gate printed
  // `relativeChanged.test.ts — 37 new`, and a file the gate never runs cannot report a number
  // at all, so the printed `actual` IS the proof that the `src/components/workflows` DIRECTORY
  // entry already reaches it. (The two-knob rule: TARGETS decides what RUNS, BASELINE what is
  // GUARDED, and only the second one moved here.)
  "relativeChanged.test.ts": 37,
  // ── 192.1-03 Task 1 (D-01 / D-22 / T-192.1-05): a NEW suite, pinned in its first commit ──
  // `freshHash` + `isForkConflict` proved as ARITHMETIC in the `libraryFilter.test.ts`
  // posture — both close over nothing, so nothing renders. Includes the T-192.1-05 grep
  // (no `randomUUID`, no `crypto.` — the "upgrade" that would break D-13's `[a-z0-9]{6}`
  // lineage regex) and the D-22 assertion that WR-08's re-open trigger survived the move.
  // ⚠ NO `TARGETS` LINE IS NEEDED and that is measured rather than assumed: the gate printed
  // `libraryFork.test.ts — 11 new`, and a file the gate never runs cannot report a number at
  // all, so a printed `actual` IS the proof the `src/components/workflows` DIRECTORY entry
  // already reaches it.
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-12, both
  // printing `librarySubtree.fences.test.ts 64 67 +3` and `libraryFork.test.ts — 11 new` at
  // `total 3214 · failed 0` — never hand-counted from `it(` literals.
  "libraryFork.test.ts": 11,
  "LibraryToolbar.test.tsx": 36,
  // ── 192-16 (GAP-CLOSURE ROUND 1, wave 4): 35 → 39. AN EXTENSION, NEVER A LOWERING. ──────
  // The +4 are 192-13's card-sentence cases: a published row the user has ALREADY forked now
  // SAYS SO before the click (`FORK_CONSEQUENCE_EXISTING`), selected into the ONE
  // `fork-consequence` node rather than appended beside it — so the card's atom count is
  // invariant and a truth fix cannot smuggle in card density (G-7 / U5-b). The set includes
  // the `aria-describedby` round trip driven on the NEW variant, which is the only thing
  // proving the sentence a screen reader receives is the state-aware one.
  // Measured `git diff` over the round: **50 insertions / 1 deletion**, and the single deleted
  // line is an IMPORT (`FORK_CONSEQUENCE, FORK_VERB`), not an `it(` —
  // `git diff … | grep -c '^-.*\bit('` returns **0**, so nothing was deleted, renamed or moved
  // out and no plan-authorised deletion needs to ride along.
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-11, both
  // printed `WorkflowCard.test.tsx 35 39 +4` at `total 3188 · failed 0` — never hand-counted.
  // ── 192.1-06 (wave 5): 39 → 80. THE 14TH ATOM, AND ITS PROOF AT THE OPERATOR'S SHAPE. ────
  // The +41 decomposes, so the number is attributable rather than merely large:
  //   +27  block 8 — the identity line's own contract, one row at a time: the child-order
  //        placement on all three provenances (D-08), the grammar and its separator rule
  //        (D-03/D-06), the null-recency pair, D-10's draft case with its positive control,
  //        the owner ceiling (D-09), the re-scoped tooltip sweep with a NON-VACUITY control,
  //        and the three shipped-testid survival cases (D-11).
  //   +14  block 9 — the SAME component driven at **106 fixture rows carrying 14 duplicated
  //        names**, with named cases for SC#1, SC#2 and SC#3. This is the block Phase 192 did
  //        not have: it tested at 12 rows AND at 107 and still shipped an unreadable library,
  //        because every fixture it used carried DISTINCT names.
  // ⚠ NO `TARGETS` LINE IS NEEDED, and it is measured rather than assumed for the same reason
  // `libraryFork.test.ts` above records: the gate PRINTED a number for this file, and a file the
  // gate never runs cannot report one — the `src/components/workflows` directory entry reaches it.
  // ⚠ NOTHING WAS DELETED, RENAMED OR MOVED OUT, AND THE FIGURE IS MEASURED RATHER THAN
  // ESTIMATED: `git diff --numstat d48e9699 -- <file>` over this whole plan reports
  // **614 insertions / 0 deletions**, and `grep -c '^-.*\bit('` over the same diff returns
  // **0**. A pure extension, so no plan-authorised deletion needs to ride along with the raise.
  // READ FROM THIS SCRIPT'S OWN `actual` COLUMN across TWO AGREEING RUNS, 2026-08-12, both
  // printing `WorkflowCard.test.tsx 39 80 +41` at `total 3408` — never hand-counted from `it(`
  // literals. ⚠ The two runs agreed on every COUNT column and disagreed on `failed` (1, then 0),
  // which is D-192-DEF-01 on this box; both readings are recorded rather than the green one kept.
  // 193-06 (AUTH-03 / D-13 / D-14 / D-15), pinned by 193-10's sweep: 80 → 90. An EXTENSION, never
  // a lowering — no `it(` was deleted, renamed or moved by Phase 193. One shipped case changed its
  // ROW rather than its expectation (the dangling-separator case, so the suite keeps a one-part
  // identity line), which moves no count. The +10 are the card's template mark: the segment
  // present at INDEX 0 of `identityParts` on a positive `admits`, the two silent arms asserted
  // against ONE SHARED expected value so `does-not-admit` and `unknown` are proved
  // indistinguishable by construction rather than by promise, and the provenance node still at DOM
  // position 2 by child order.
  //
  // ⚠ 193-06's OWN SUMMARY DEFERRED THIS RAISE TO THE SWEEP AND NAMED IT: *"193-11 owns the
  // count-gate pin sweep — WorkflowCard.test.tsx 80 → 90 is NOT pinned here."* It lands in 193-10
  // rather than 193-11 because the sweep is 193-10's task and 193-11 is the operator's UAT drive.
  // The deferral is recorded because a raise owed by a plan that never claims it is exactly how a
  // suite stays permanently unguarded.
  //
  // ⚠ ONE SHARED EXPECTED VALUE IS THE LOAD-BEARING SHAPE. D-15 says the two silent arms must be
  // DELIBERATELY indistinguishable — absence of the mark may never be readable as an assertion
  // that no template is needed. Two separate expectations would drift apart without failing.
  //
  // Read from THIS SCRIPT'S OWN `actual` column (`WorkflowCard.test.tsx 80 90 +10`).
  "WorkflowCard.test.tsx": 128,
  // ── Phase 192.2 gap round 1 — THE CR-01 REGRESSION TESTS WERE DELETABLE WITH A GREEN GATE ────
  //
  // ⚠ Found by the round's own code review (`192.2-REVIEW-R1.md`, WR-01) and confirmed against
  // THIS SCRIPT'S OWN `actual` column, which read WORSE than the review reported:
  //   `WorkflowCard.test.tsx    90  128  +38`
  //   `libraryFilter.test.ts    48   96  +48`
  //   `WorkflowsPage.test.tsx   52   59   +7`
  // and `runFacts.test.ts`, `cardFace.test.ts` and `gutterTokens.fences.test.ts` printed `new` —
  // i.e. NO PIN AT ALL. `runFacts.test.ts` is the four-arm matrix that proves CR-01 itself: the
  // whole suite could have been deleted and this gate would still have said OK.
  //
  // ⚠ The shape worth remembering: `192.2-10` correctly pinned `apiRunFields.fences.test.ts` in
  // its creating commit, so the round PROVED it knew how — nothing did the same for the suites
  // that actually hold the blocker's fix. **A guard that is itself unguarded is the recurring
  // failure in this file, not an exception.**
  //
  // Raised/added at the round's close, read from the `actual` column, never hand-counted.
  // ⚠ Raising a pin necessarily DELETES a line; ADDING one does not — this edit does both.
  "runFacts.test.ts": 65,
  "cardFace.test.ts": 34,
  "gutterTokens.fences.test.ts": 11,

  // ── The four RAISES owed by suites Phase 192 GREW ──────────────────────────────────────
  //
  // All four already sat in this map (192-01 adopted them in the phase's first commit). Each
  // grew because the restructure moved behaviour INTO reach of a suite that could already
  // see it, not because anything was duplicated:
  //   `WorkflowsPage.test.tsx`      22 → 39  (+17) — 192-11's 200-row LIB-01…04 evidence,
  //                                          plus the F2/F3 DOM fences.
  //   `PublishedCardDelete.test.tsx` 7 → 32  (+25) — 192-04's seven characterization
  //                                          baselines and the delete-grade cases.
  //   `RunModal.test.tsx`           11 → 32  (+21) — 192-03's six whole-`innerHTML` captures
  //                                          plus both canvas-gate destination branches.
  //   `RunModal.a11y.test.tsx`       8 → 16   (+8) — the a11y half of the same capture.
  //
  // ⚠ NOT ONE OF THESE IS A LOWERING. The single lowering this phase is permitted (23 → 22)
  // landed in 192-10, in the same commit as the two deletions that justified it, and is
  // argued in full above. Nothing here makes a red gate go quiet.
  //
  // The four raised VALUES are edited in place above (this map may hold one entry per
  // basename), beside the 192-01 block that first adopted them.
  //
  // ── FOUR DRIFTED PINS ARE DELIBERATELY NOT RE-PINNED HERE, AND THEY ARE NAMED ─────────
  //
  // The same run that produced every number above also printed four PRE-EXISTING drifts
  // this phase did not cause and does not touch:
  //   `ExternalActionSection.test.tsx`   25 pinned / 34 actual  (+9)  — owed since 190-12
  //   `PhaseTimeline.test.tsx`           17 / 21                (+4)  — owed since 190-12
  //   `WorkflowBuilderPage.canvas.test.tsx` 128 / 133           (+5)  — first seen at 192-01
  //   `builderStore.test.ts`             52 / 58                (+6)  — first seen at 192-01
  // **24 cases are therefore deletable with this gate green today.** They are RECORDED as
  // owed rather than absorbed: folding an unrelated drift into a commit that did not cause
  // it is the thing this whole header argues against, and it is the reason 190-12, 190-15,
  // 190-16 and 192-01 each declined the same four. Owed as its own edit.
  // ── Added in 196-03, in the SAME COMMIT as its `TARGETS` entry below ──────────────────
  //
  // THE REASON, stated rather than summarised (this script's own adoption rule requires one
  // either way — a decline with no recorded reason is indistinguishable from an oversight):
  // this suite is now the ONLY guard on the honest-notice half of D-10. Plan 196-03 routes
  // every harness per-phase model through the shipped disabled-model resolver and surfaces a
  // substitution as a `model_fallback` sub-step. `PhaseCard.tsx`'s `subStepMeta` has a
  // forward-compat default arm that renders an UNMAPPED status as the word **"Working"** — so
  // if the `SUBSTEP_META` entry were dropped, the notice would silently become the exact
  // defect Phase 196 exists to remove, and nothing outside this suite would notice. An
  // unpinned file is not a lightly-guarded one, it is an UNGUARDED one (the 188-12 statement).
  //
  // ⚠ BOTH KNOBS WERE NEEDED, and that was MEASURED rather than assumed: `src/components/panel`
  // is reached above by three NAMED `__tests__/` files, and `PhaseCard.test.tsx` does not live
  // under `__tests__/` at all — it was absent from this gate's printed file list entirely. The
  // full derivation lives at the matching `TARGETS` entry and is not duplicated here, because
  // two copies of a reason drift.
  //
  // ⚠ THE NUMBER IS READ FROM THIS SCRIPT'S OWN `actual` COLUMN, never hand-counted from `it(`
  // and never quoted from a document: the run that added the `TARGETS` entry printed
  // `PhaseCard.test.tsx  —  27  new` (verdict `count gate OK`, total 4197 · failed 0 ·
  // pinned total 4096 · 83/83). Measured beside it so the delta is a real before/after rather
  // than an assertion: the suite counted **24** at this plan's base — the pre-change file was
  // restored and run standalone at `GSD_VITEST_MAX_WORKERS=2` to get that figure. The +3 is
  // exactly this plan's own cases and nothing else: the `model_fallback` member added to the
  // whole-union `SUBSTEPS` it.each (+1), the fixed-sentence/amber-node case (+1), and its
  // positive control asserting the default arm STILL catches a genuinely unknown value as
  // "Working" (+1). ⚠ That control is load-bearing: without it, a `model_fallback` riding the
  // default arm would pass the first case and this pin would be guarding nothing.
  // ── RAISED IN 200-07 (DES-02, `200-CHECKLIST.md` §4): 27 → 41 ─────────────────────────
  //
  // ⚠ `+14`, of which `+9` is this plan's and `+5` was PRE-EXISTING SLACK — this gate printed
  // `PhaseCard.test.tsx  27  32  +5` on the unmodified tree. Closed in the same commit as
  // the new cases, per the §187-29 correction recorded on the entry above.
  //
  // The nine: `never ran` vs a historic row proved DIFFERENT renders (and the boolean a
  // careless implementation would use shown to collapse them), D-06's eight arms proved
  // eight DISTINCT readings, no ticking clock on a terminal run or on a step that never ran,
  // an absent facts prop rendering nothing at all, the declared pair rendered verbatim, a
  // declared `0` rendering, four undeclared shapes rendering NO element, and the shipped
  // nine-row status-atom inventory proved BYTE-IDENTICAL with the new prop supplied.
  //
  // ⚠ THAT LAST ONE IS THE POINT OF THE OTHERS. This suite pins the status atom's children
  // POSITIONALLY (`button span.ml-auto`, read by index) across all nine statuses, so the new
  // reading was sited in the IDENTITY COLUMN instead — a characterization pin answered by
  // moving the new thing rather than by re-baselining the old one (199-03's precedent, and
  // 200-06's icon-well decline). The pin passed UNEDITED, and that is asserted rather than
  // assumed.
  "PhaseCard.test.tsx": 41,
  // ── Added in 200-07 (DES-02, `200-CHECKLIST.md` §4), in the SAME COMMIT that creates the
  //    file — and it needs BOTH KNOBS, which is the ELEVENTH occurrence of the two-knob trap
  //    this script records as a rule ──────────────────────────────────────────────────────
  //
  // MEASURED, not assumed: `src/components/panel/` is reached by FOUR NAMED FILES only
  // (`__tests__/PhaseReconcile.test.tsx`, `__tests__/PhaseTimeline.test.tsx`,
  // `__tests__/FilesSection.test.tsx` and `PhaseCard.test.tsx`) — there is no directory entry
  // for it anywhere in `TARGETS`. On the first gate run after this suite existed but before
  // its `TARGETS` line did, this script's printed run command did NOT contain it and the file
  // never appeared in the output at all. A pin with no `TARGETS` entry pins a suite that
  // never executes, and a falsification that does not run has falsified nothing.
  //
  // WHAT IS UNGUARDED WITHOUT IT: `phaseStatusMeta.ts` shipped **UNPINNED for its entire
  // life** while holding the panel's nine status words, the two glyphs and — the sharp part —
  // the own-property floor that keeps an inherited key (`constructor`, `__proto__`) from
  // resolving to a FUNCTION typed as a `StatusMeta`. Every one of those was exercised only
  // TRANSITIVELY, through a `PhaseCard` or `PhaseTimeline` render, which is precisely the
  // state the §187-29 correction describes: slack inside an already-listed file absorbs it.
  // `200-04` found the EIGHTH live sink of that class in this tree, where React REFUSED the
  // function child and the label rendered as NOTHING AT ALL.
  //
  // ⚠ TIMING: `ls`-confirmed before this line was written — a `TARGETS` path that does not
  // exist makes this gate ERROR at exit 2, not fail, for every later plan. The bare filename
  // was confirmed unique tree-wide: the `BASELINE` key space is global.
  "phaseStatusMeta.test.ts": 8,
  // ── Added in 197-11 (Wave 7, phase close) — THE THREE SUITES PHASE 197 CREATED ────────
  //
  // ⚠ ONE KNOB, NOT TWO, AND THAT IS WHY THE FILES WERE PLACED WHERE THEY WERE. All three
  // live under `src/components/workflows`, which is a DIRECTORY entry at the top of the
  // `TARGETS` array below, so this gate EXECUTED all three the moment they landed — exactly
  // the `193-01` case, and deliberately not the two-knob path `src/pages` forces. **No
  // `TARGETS` entry is added for any of them**; a second knob for a directory already covered
  // would be a duplicate, not a belt-and-braces.
  //
  // ⚠ RUNNING IS NOT BEING PINNED. Until this commit all 111 cases below were deletable with
  // the gate green — an unpinned file is not a lightly-guarded one, it is an UNGUARDED one
  // (the 188-12 statement, which this script keeps re-learning).
  //
  // ⚠ ALL THREE NUMBERS ARE READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that had no
  // pin for them — never hand-counted from `it(`, never quoted from a plan document. That run
  // printed, verbatim:
  //     DecisionsList.test.tsx                        —      54     new
  //     DraftArrivalCard.test.tsx                     —      35     new
  //     decisionsVocabulary.test.ts                   —      22     new
  //     total                                      4217    4447    +230
  //     total 4447  ·  failed 0  ·  pinned total 4217
  //   count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
  //
  // WHAT WOULD BE UNGUARDED WITHOUT THESE THREE PINS — the invariant each one carries:
  //   · `decisionsVocabulary.test.ts` (22) — the five rows' words, their readiness arms, and
  //     the fact that the module is a TRUE LEAF (it imports nothing). ⚠ ONLY ROW 3 MAY CLAIM A
  //     PUBLISH REQUIREMENT, because only row 3's sentence arrives on the wire from
  //     `grounding.py`'s stage-1 `business_requirement_missing` — measured as the ONLY
  //     definition-level publish predicate (D-20). A copy edit letting row 1, 2, 4 or 5 claim
  //     one would tell an author the gauntlet enforces something nothing enforces.
  //   · `DecisionsList.test.tsx` (54) — THREE ARMS, NEVER TWO. An ABSENT readiness must render
  //     no verdict node at all, which is not the same as a green one. Collapsing the union to
  //     a boolean re-introduces exactly the "unknown reads as satisfied" defect D-20 exists to
  //     prevent, and a boolean cannot express the third arm.
  //   · `DraftArrivalCard.test.tsx` (35) — THE SUPPRESSION LIST IS LOAD-BEARING. It must name
  //     the receipt's four FRAME/DUPLICATE handles (`seed-receipt`, `-heading`, `-dismiss`,
  //     `-close`) and NONE of its four CONTENT handles; naming a content handle silently
  //     BLANKS the fold, and a blank fold renders green in every geometry assertion. A fence
  //     in the suite sweeps the targeted handles in the source and asserts the set is exactly
  //     those four. ⚠ G-4 row **U1 is still owed** on the appearance half: jsdom applies no
  //     CSS, so the one-card composition is proved here by SOURCE assertion only.
  "decisionsVocabulary.test.ts": 22,
  "DecisionsList.test.tsx": 54,
  "DraftArrivalCard.test.tsx": 35,
  // ── Added in 192.2-10 (WR-02), in the SAME COMMIT that creates the file ──────────────
  //
  // ⚠ THE TWO-KNOB TRAP, AND `src/lib/` IS WHERE THIS SCRIPT ALREADY RECORDS IT FOUR TIMES.
  // TARGETS decides what RUNS; BASELINE decides what is GUARDED, and a file can land outside
  // BOTH by default. `src/lib/` has NO bare-directory entry — it is reached only by the two
  // FILE-LEVEL lines `src/lib/phaseState.test.ts` and `src/lib/__tests__/fileIcon.test.tsx` —
  // so without the matching `TARGETS` line below this suite would never have EXECUTED, and a
  // falsification that does not run has falsified nothing.
  //
  // WHAT IS UNGUARDED WITHOUT IT: `frontend/src/lib/api.ts` declares THREE fields spelled
  // `last_run_status?: string | null` (on `ThreadWorkflowState`, `PublishedWorkflow` and
  // `WorkflowDraftRow`) and a swap between any two of them TYPECHECKS — the collision the
  // file's own warning predicted twelve lines above it. WR-02's fix is a cross-reference
  // docblock on each, bound by one marker token. This suite is the ONLY mechanical thing
  // standing between that and a silent FOURTH declaration, or a marker deleted in a tidy-up.
  // Neither `tsc` nor any rendering test can see either event.
  //
  // PINNED AT 12 — read from this gate's own printed `actual` column, and driven RED twice
  // against REAL plants in `api.ts` first (a fourth declaration: 3 failed; one marker
  // deleted: 4 failed), each with an md5-verified restore.
  "apiRunFields.fences.test.ts": 12,
  // ── Added in 200-05 Task 1 (DES-02 / D-06 / D-07 / D-09), in the SAME COMMIT that creates
  //    both files, because *"an unpinned file is not a lightly-guarded one, it is an
  //    UNGUARDED one"* (the 196-05 / 196-07 rule) and because a `BASELINE` key naming a path
  //    that does not yet exist makes this gate ERROR (exit 2) rather than fail. ─────────────
  //
  // ⚠ ONE KNOB, NOT TWO, AND IT IS CHECKED RATHER THAN ASSUMED. Both files live under
  // `src/components/workflows`, already a DIRECTORY entry in the `TARGETS` array below, so
  // this gate EXECUTED both the moment they landed — the run that had no pin for them printed
  // them as `— 31 new` and `— 16 new`, which is where these two numbers come from. **No
  // `TARGETS` entry is added for either**; a second knob for a directory already covered is a
  // duplicate, not a belt-and-braces.
  //
  // ⚠ BOTH FIGURES ARE READ FROM THIS SCRIPT'S OWN `actual` COLUMN — never hand-counted from
  // `it(` literals, never quoted from a plan document. That run's verdict lines, verbatim:
  //     phaseDuration.test.ts                         —      31     new
  //     receiptVocabulary.test.ts                     —      16     new
  //     total                                      4589    5047    +458
  //
  // WHAT WOULD BE UNGUARDED WITHOUT THESE TWO PINS — the invariant each one carries:
  //   · `phaseDuration.test.ts` (31) — D-06's NINE discriminated arms, and specifically that
  //     `never ran (skipped)` and `time not recorded` are DIFFERENT SENTENCES. Folding an
  //     absence together with a negative is the defect this repo has now shipped twice
  //     (`runFacts.ts` CR-01 printed *"Never run"* about workflows that had really run;
  //     `DecisionsList` D-20 rendered an absent readiness as a pass), and **a boolean cannot
  //     express it** — `never ran` / `not reached` / `time not recorded` are three facts that
  //     all have "no duration to show". It also pins IDIOM-3 (a declared `0` renders while an
  //     ABSENT count renders nothing at all — never `0`, never a dash) with a POSITIVE CONTROL
  //     reproducing the coalesce that destroys the distinction, and the WR-04 own-property
  //     guard on a `constructor`-slugged phase, whose control proves the bare bracket read
  //     really does hand back a function.
  //   · `receiptVocabulary.test.ts` (16) — that this module IMPORTS NOTHING FROM THE LIBRARY
  //     SUBTREE. ⚠ That is not a duplicate of the library's own 14-path fence: importing its
  //     vocabulary from OUTSIDE the subtree would not TRIP that fence, it would BREAK its
  //     contract (`LIBRARY_SUBTREE_PATHS` would stop describing the subtree's blast radius),
  //     so nothing over there can catch it and only this suite can. It also pins the
  //     zero-glyph rule, the TRUE-LEAF (zero imports) property, exact-match values for every
  //     governed id, and the inequality against every one of `runVocabulary.ts`'s LOCKED
  //     canvas words — asserted AFTER a non-vacuity check on that comparison set, because a
  //     negative against an empty set passes while proving nothing.
  // ⚠ RAISED 31 → 43 IN PHASE 200's RUN-LOG COMMIT, and the twelve are attributed rather than
  // absorbed: `runAnchorMs` (4), `readInstant` (1) and `transcriptEntries` (7). Leaving the pin
  // at 31 would have left every one of them deletable under a green gate — the exact slack
  // §187-29 records ("a pinned TOTAL rising proves nothing about the NEW cases, because slack
  // inside an already-listed file absorbs them").
  //
  // WHAT THE TWELVE CARRY:
  //   · that `runAnchorMs` ANSWERS WHERE `runSpan` DOES NOT — mid-run, when a step has started
  //     and nothing has completed, which is every run that is still going. Driven as a CONTRAST
  //     (`runSpan(rows)` null, `runAnchorMs(rows)` not) rather than asserted alone, because the
  //     whole reason the function was extracted is that difference. A log built on `runSpan`
  //     would have had no clock during the only period a log matters.
  //   · that the two agree on `startedAtMs` whenever `runSpan` has an answer — which is what
  //     "one home for the run's zero" has to mean operationally, rather than as a comment.
  //   · that an UNPARSEABLE start is an ABSENCE — `readInstant("")` is `NaN`, and letting it
  //     through would anchor a whole log on the epoch and print figures nothing measured.
  //   · that a row is placed at its `completed_at` when it has one, so a finished step sorts by
  //     its ENDING; that untimed rows are APPENDED rather than dropped (a dropped row reads as
  //     a step that does not exist); and that ties break on the SERVER's row order.
  "phaseDuration.test.ts": 43,
  "receiptVocabulary.test.ts": 16,
  // ── Added in 200-05 Task 3, in the SAME COMMIT that creates the file. Same one-knob check
  //    as the two pins above: `src/components/workflows` is already a `TARGETS` directory
  //    entry, so the gate RAN this suite the moment it existed and printed it as `— 20 new`.
  //
  // WHAT WOULD BE UNGUARDED WITHOUT IT:
  //   · D-07 REACHING THE DOM. A step that declared NO count renders NO count slot at all —
  //     never `0`, never a dash, never prose. N-8 records that the sketch's own run surface
  //     puts the SENTENCE `Summarized meeting notes` where the COUNT `Found 12 contracts`
  //     goes, which is exactly the fabricated-figure failure D-07 exists to prevent, and
  //     `199-05` called that class *"the highest-consequence lie this phase could ship."* A
  //     DECLARED `0` is the opposite case and renders, because it is a measurement.
  //   · D-06 reaching the DOM as TWO readings: `never ran (skipped)` and `time not recorded`
  //     asserted DIFFERENT on both the time column and the outcome column.
  //   · that the total runtime is derived from the PHASE TIMESTAMPS — proved by rendering the
  //     same rows at two `now`s nine million ms apart and comparing the headers, which a
  //     `claimed_at`- or `Date.now()`-anchored figure could not survive.
  //   · ⚠ THAT THE COMPONENT IS MOUNTED NOWHERE. An `import.meta.glob` `?raw` sweep of
  //     `/src/**` asserts zero importers outside its own two files, with a positive control
  //     proving the needle finds a real mount. That is what keeps `199-02`'s refusal intact
  //     BY CONSTRUCTION — a receipt that cannot reach the builder cannot fabricate a run-tense
  //     claim on a draft — and `200-07` is the plan that mounts it.
  //   · that the component spells NO user-visible string: a JSX text-position literal sweep
  //     with its own positive control, plus the `aria-label` proved to come from the
  //     vocabulary — an `aria-label` IS user-visible text, just not to a sighted reviewer.
  // ⚠ THIS PIN IS SUPERSEDED — see `"RunReceipt.test.tsx": 26` at the foot of this block, where
  //    the six in-flight cases are described. The original entry is REMOVED rather than left
  //    beside it: two entries for one key in one object literal is a silent last-wins, which is
  //    the one shape a pin table may never take.
  // ── Added in Phase 200's run-log commit, in the SAME COMMIT that creates both files. Same
  //    one-knob check as every pin above: `src/components/workflows` is already a `TARGETS`
  //    directory entry, so the gate RAN both the moment they existed and printed them as
  //    `— 19 new` and `— 7 new`. **No `TARGETS` entry is added for either.**
  //
  // ⚠ BOTH FIGURES ARE READ FROM THIS SCRIPT'S OWN `actual` COLUMN, never hand-counted from
  // `it(` literals. That run's verdict lines, verbatim:
  //     RunTranscript.test.tsx                        —      19     new
  //     transcriptVocabulary.test.ts                  —       7     new
  //     total                                      4824    5283    +459
  //
  // WHAT WOULD BE UNGUARDED WITHOUT THESE TWO PINS:
  //   · `RunTranscript.test.tsx` (19) — **THE TENSE RULE**, which is the highest-consequence
  //     logic on the run surface's new centre. The state word comes from the phase STREAM and
  //     the duration from the durable FETCH, and this page already carries a test proving the
  //     two really do disagree. Two contradictions are therefore reachable on one line — a
  //     present-tense word beside a finished duration, and a settled word beside a still-
  //     ticking one — and the mitigation is that the NUMBER waits for both sources. ⚠ BOTH
  //     HALVES WERE DRIVEN RED INDEPENDENTLY before this pin was written: deleting either
  //     guard fails exactly one case, so neither is decorative. It also pins that a finished
  //     step is stamped at its COMPLETION (inverting the preference goes red), that EVERY row
  //     renders including the untimed ones (with the gutter present and EMPTY — never a
  //     fabricated zero, never a dash), that a declared `0` renders while an ABSENT count
  //     renders NO ELEMENT (D-07 / `SEED-159`, with a same-render non-vacuity control), and
  //     that the component spells NO user-visible string — a JSX literal sweep with its own
  //     positive control, run over comment-STRIPPED source because that file's docblock quotes
  //     the sheet's own narration on purpose (the 187-24 trap, met again).
  //   · `transcriptVocabulary.test.ts` (7) — that the module's two absence headlines are
  //     DIFFERENT SENTENCES. *"No steps recorded"* and *"step times not recorded"* are two
  //     facts about two different runs, and folding them prints "nothing happened" about a run
  //     that did plenty — the same shape this repo has now got wrong three times (`runFacts.ts`
  //     CR-01, `DecisionsList` D-20, `phaseDuration.ts`'s own nine arms). It also pins the
  //     export COUNT (so growing the module is deliberate), the zero-glyph rule as a
  //     CHARACTER-CLASS sweep rather than a list of forbidden marks (a list only catches the
  //     glyphs someone already thought of), and inequality against every `receiptVocabulary`
  //     export and every `RUN_READING_WORD` value — compared against the REAL exports, never a
  //     hand-listed copy, and asserted after a non-vacuity check on each comparison set.
  // ── RE-PINNED 19 → 28 (2026-08-20, the run-surface finish pass) ────────────────────────
  //
  // ⚠ RAISING A PIN NECESSARILY DELETES A LINE, so this is an EDIT and not an addition — the
  // distinction `196` records about this very file. The nine new cases are the BRIGHT/DIM
  // CONTRAST block, and what they guard is a judgement rather than a treatment:
  //
  //   · a step the run NEVER REACHED is dimmed, and a COMPLETED one is not — the honest half
  //     of the operator's "bright-completed / dim-in-flight" ask;
  //   · the RUNNING step stays FULL STRENGTH. That is the refusal this file already carried in
  //     prose and now carries in a test: the sheet's dim lines are in-flight NARRATION between
  //     bright RESULT lines, and with one line per step that mapping inverts and would mute
  //     the single most important row on a page somebody is watching;
  //   · a SKIPPED step is full strength — the arm most likely to be got wrong, because it
  //     never ran and yet is a settled DECISION, not a not-yet;
  //   · a run where every step finished has NO alternation, asserted so the absence cannot
  //     later be read as the change having failed;
  //   · and ATTENTION outranks the dim arm — pinned with a fixture whose WIRE ROW is `active`,
  //     because the first draft seeded `pending` and the tense rule correctly dropped the
  //     page's word. That miss is itself now a case: two sources that disagree render from the
  //     WIRE and flag `data-source-conflict`.
  "RunTranscript.test.tsx": 28,
  "transcriptVocabulary.test.ts": 7,
  // ── ADDED 2026-08-20 (the run-surface finish pass). `src/components/workflows` is already a
  //    `TARGETS` directory entry, so the gate RAN this suite from the moment it existed and
  //    printed it `— 11 new`. **No `TARGETS` entry is added.** The figure is read from this
  //    script's own `actual` column, never hand-counted from `it(` literals.
  //
  // WHAT WOULD BE UNGUARDED WITHOUT IT: `RunSpine.test.tsx` (11) is the only pin on the run
  // panel's own column — the surface that carries the ANSWER CONTROL. It holds that the spine
  // speaks the author's titles and spells NO slug anywhere (the whole reason the component
  // replaced `PhaseTimeline` on this page); that D-07's declared count renders VERBATIM, that
  // an absent count renders NO element and a declared `0` renders; that the time column
  // carries TIME facts only, so a HISTORIC row says its time was not recorded (the arm a local
  // subtraction silently loses) and a STATE fact never appears there; that a running step
  // ticks and the tick DISCLOSES it is unfinished; that a STALE slice cannot pulse a finished
  // step, because liveness needs BOTH sources; and that the caller's ask renders inside the
  // row it was given for and nowhere else — which is the placement the whole re-port turns on.
  "RunSpine.test.tsx": 11,
  // ── SEED-190's run log, pinned in the commit that creates all three files ───────────────
  //
  // ⚠ THREE SUITES, THREE DIFFERENT THINGS, and none of them is coverage for its own sake:
  //
  //   · `runLogRow.test.ts` (21) — that an UNMEASURED run reports NO duration and above all
  //     never `0s`. Migration 121 is not backfilled, so most rows in the real database take
  //     that arm today (measured: 10 of 580 phase rows carry the pair), and a resolver that
  //     coalesced a missing instant to zero would look perfect on a fixture and print `0s` at
  //     a person about ~220 of their 230 runs. It also pins that the outcome word is the
  //     LIBRARY CARD's — asserted by calling `runFacts` independently and comparing, never by
  //     a copied literal, so the log and the card cannot drift into two vocabularies for one
  //     fact — and that the span is measured from the INSTANTS and never from `created_at`
  //     (falsified with a row whose insert time is 90 minutes from its 57-second span).
  //   · `RunLogPanel.test.tsx` (20) — that a FAILURE is never rendered as an EMPTY LOG, in
  //     BOTH directions, and that the three empty states are three SENTENCES. "We could not
  //     look" and "we looked and there is nothing" are different facts, and showing the second
  //     when the first is true is how a surface tells a person their work is gone. Also: the
  //     filter goes over the wire as a SLUG and never a definition id (the version trap), and
  //     with no way to open a run the rows are NOT CONTROLS rather than dead ones.
  //   · `runLogTone.mirror.test.ts` (10) — the guard that makes a deliberate duplication safe.
  //     The log's colour tables mirror `WorkflowCard.tsx`'s, which could not be extracted
  //     because `gutterTokens.fences.test.ts` pins the shape of those object bodies IN THE
  //     CARD'S OWN SOURCE. This asserts the two agree entry for entry, with a positive control
  //     proving the parser really sees six entries per map and a driven falsification proving
  //     a single changed utility is caught.
  "runLogRow.test.ts": 21,
  "RunLogPanel.test.tsx": 20,
  "runLogTone.mirror.test.ts": 10,
  // ── THE LAST TWO OF PHASE 200'S UNPINNED SUITES, pinned at their measured actuals ───────
  //
  //   · `StepPanelPort.test.tsx` (25) — the step panel's port, guarded against the failure
  //     that made the port necessary. Its own header says it plainly: `PhaseFormPanel.test.tsx`
  //     reported 13/14 atoms GREEN on a screen the operator then said was not what was
  //     designed, because those atoms were derived from a CHANGE-LOG rather than from the
  //     drawing. This suite's atoms come from the sheet's markup, and it asserts the ABSENCES
  //     as strictly as the presences — an invented per-folder lock badge, an `Add a source`
  //     that writes nothing — each with a positive control, because "nothing is there" must
  //     not be reachable by a selector typo.
  //   · `WorkflowCard.baseline.test.tsx` (29) — the CHARACTERIZATION PIN that discharged
  //     `WorkflowCard.tsx`'s G-5: it was committed ONE COMMIT BEFORE `cardFace.ts` existed and
  //     passed unedited across the extraction. It pins the card's whole resting atom inventory
  //     BY VISIBLE TEXT, so a refactor that keeps a `data-testid` alive while emptying the node
  //     it names still reds. ⚠ A pin on a characterization suite is the one place where the
  //     count matters most and the count is the least of it — the file's value is that its
  //     lines predate the change they judge.
  // ⚠ RE-PINNED 25 → 29 by 206.2-03. The four cases stop one shipped LIE: the readiness
  //   card's `capability` row was pushed whenever an `external_action` step had no
  //   capability SENTENCE — a lookup into the closed table, and therefore `undefined` for
  //   every MCP-shaped step forever, however completely configured. Three of the four are
  //   NON-VACUITY CONTROLS that were already GREEN at their base, which is the point: the
  //   suppression could otherwise have deleted the row outright and read as a fix.
  "StepPanelPort.test.tsx": 29,
  "WorkflowCard.baseline.test.tsx": 29,
  // ── ADDED 2026-08-20 in the SAME COMMIT as `RunReceipt.test.tsx`'s own growth ───────────
  //
  // ⚠ RE-PINNED 20 → 26. The six new cases exist because of a defect NO TEST IN THIS FILE
  // COULD HAVE CAUGHT, and that is the reason they are pinned rather than left to run: every
  // case in that suite rendered a TERMINAL run, so the receipt's header was never exercised in
  // flight. Driven on a real run with a human-input step on 2026-08-20, the strip read
  // *"Ran 42s · 3 steps · finished 22:15"* beside a spine visibly waiting for an answer.
  // Both FIGURES were honest; the SENTENCES asserted a stop that had not happened.
  //
  // The block pins that all three in-flight statuses (`active`, `paused`, `cap_paused`) report
  // the runtime SO FAR and name no finish; that a terminal run is UNCHANGED (the control,
  // without which the block passes on a strip that never says `Ran`); that "still running"
  // OUTRANKS "no finish time recorded", because the two are different facts and only one tells
  // a person to keep waiting; and that an ABSENT status asserts NO finish — never success by
  // default, which is the arm whose first draft was written backwards and corrected in place.
  "RunReceipt.test.tsx": 26,
  // ── ADDED 206.2-04 (SEED-200 / D-206.2-14) — TWO PINS, AND THE FIRST OF THEM IS A SUITE
  //    THAT HAS BEEN RUNNING-BUT-UNGUARDED SINCE PHASE 206 ──────────────────────────────
  //
  // ⚠ MEASURED AT THIS PLAN'S BASE: `grep -n "Mcp" scripts/vitest-count-gate.cjs` returned
  // NOTHING, and this script's own printed column read `McpToolPicker.test.tsx  —  12  new`.
  // So the whole MCP tool surface's component suite could have been DELETED with the gate
  // green. 188-12's rule verbatim: *an unpinned file is not lightly guarded, it is
  // UNGUARDED.* It is pinned here, in the same commit as the code that makes it meaningful.
  //
  // BOTH KNOBS, AND THE SECOND IS MEASURED RATHER THAN ASSUMED: `src/components/workflows`
  // is already a `TARGETS` **directory** entry (see the array below), so both files RAN from
  // the moment they existed — the printed `actual` column IS that proof. **NO `TARGETS` EDIT
  // ACCOMPANIES THESE PINS**, because this script's own comment at the 189-14 block refuses a
  // redundant file-level entry beside a directory that already covers it: it would state a
  // dependency that is not real. Both figures are read from the `actual` column, never
  // hand-counted from `it(` literals.
  //
  // WHAT WOULD BE UNGUARDED WITHOUT THEM:
  //
  //   · `McpToolPicker.test.tsx` (29) — the ONE grant predicate mirroring the server's
  //     `grants.get(tool_name) is True`; the three audience arms (a measured member loses
  //     BOTH write affordances and gains one sentence carrying both facts; an unmeasured
  //     caller renders nothing new, asserted as a NODE COUNT against the pre-phase render
  //     with a non-vacuity control); and above all THE FULL MERGED MAP, asserted by SET
  //     EQUALITY because `PATCH /grants` is a whole-column REPLACE and a superset check
  //     would pass the very payload that drops a grant. Plus the in-flight guard, the
  //     absence of an optimistic flip, and two receipts for two directions.
  //
  //   · `McpToolPicker.reachability.test.tsx` (11) — ⚠ THE PIN THAT MATTERS MOST, because
  //     the thing it guards is a TIER rather than a behaviour. Leg (a) is an import sweep
  //     and was GREEN AT THIS PHASE'S BASE, AGAINST THE DEFECT. Leg (b) renders the
  //     PRODUCTION parent and constructs NO component prop at all; its headline is a
  //     zero-argument call assertion, and it was observed RED against the pre-phase tree
  //     (5 of 11 red) in the same run that showed all three leg-(a) cases green. A future
  //     editor who deletes leg (b) has deleted the guard, and the gate would not notice
  //     unless this file is pinned.
  "McpToolPicker.test.tsx": 29,
  "McpToolPicker.reachability.test.tsx": 11,
  // ── 211-05 Task 1(c) · the phase's TWO new suites, pinned in the commit that creates
  //    them. TARGETS decides what RUNS, BASELINE decides what is PINNED, and a file can sit
  //    outside BOTH by default. An unpinned file is not lightly guarded — it is UNGUARDED.
  //
  // ⚠ THEY NEEDED DIFFERENT KNOBS, AND WHICH ONE WAS **MEASURED, NOT ASSUMED**. The gate was
  // run from the repo root with both files on disk and green, BEFORE either line below was
  // written, and its own `actual` column was read:
  //
  //     connectionCardReachability.test.tsx           —      10     new
  //     (connectionVerbFence.test.ts: ABSENT from the printed list entirely)
  //     total 5808  ·  failed 0  ·  pinned total 5180
  //   count gate OK — 114/114 pinned files present, no per-file decrease, 0 failing.
  //
  //   · `connectionCardReachability.test.tsx` lives under `src/components/workflows`, which is
  //     already a DIRECTORY entry in TARGETS, so it RAN the moment it existed. **NO `TARGETS`
  //     EDIT ACCOMPANIES IT** — the 189-14 block above refuses a redundant file-level entry
  //     beside a directory that already covers it, because it would state a dependency that is
  //     not real. Only the pin was missing.
  //   · `connectionVerbFence.test.ts` lives under `src/components/settings`, whose three
  //     existing entries are FILE-LEVEL, so a FOURTH file there is reached by none of them. It
  //     therefore takes BOTH knobs, and its TARGETS line lands in this same commit. A
  //     falsification that does not run has falsified nothing (verification truth 14).
  //
  // Both numbers are read from THIS SCRIPT'S OWN `actual` column across two agreeing runs —
  // never a hand count of `it(` literals, which is unsound under the two `it.each` blocks the
  // fence suite uses for its MUST-FIRE / MUST-NOT-FIRE controls.
  //
  // ⚠ ADDITIONS ONLY — NOT ONE EXISTING PIN IS RAISED OR LOWERED BY THIS PHASE. Raising a pin
  // necessarily deletes a line, which is the thing that makes a `-0` deletion check wrong; and
  // a LOWERING is permitted only when the deleted cases are named in a summary, which this
  // phase has no occasion for (211-03 and 211-04 already re-baselined their own files).
  //
  // WHAT WOULD BE UNGUARDED WITHOUT THEM:
  //
  //   · `connectionVerbFence.test.ts` (21) — SC#3 IN ITS ENTIRETY. It is a pure ABSENCE fence
  //     over BOTH surface trees, and an absence assertion is the easiest kind to delete
  //     unnoticed. Eleven of its cases are the matcher's own falsification (five MUST-FIRE
  //     shapes of the deleted chooser, six MUST-NOT-FIRE shapes of prose this tree
  //     legitimately ships), three are non-vacuity floors, and one asserts the single
  //     exemption is LOAD-BEARING. Three plants were applied to real production source —
  //     a category chip in `connectionsCopy.ts`, a `role="radio"` segment in
  //     `ExternalActionSection.tsx`, a native `<option>` in `ConnectionFormPanel.tsx` — each
  //     observed RED naming `file:line`, and each file restored md5-identical.
  //
  //   · `connectionCardReachability.test.tsx` (10) — ⭐ THE RENDER HALF OF THE SEAM, which no
  //     backend test can see. Its case 1 (a legacy row with an EMPTY action list still
  //     rendering its card, its in-words empty state and a pressable Refresh) is the closed
  //     loop revision iteration 1 of this phase caught, and it was observed RED against the
  //     pre-211-04 gate planted back into `McpToolPicker.tsx` — 4 of 10 failing, with case 3
  //     (MCP + empty) correctly still passing, which is what makes the RED discriminating
  //     rather than blanket. Restored md5-identical.
  "connectionVerbFence.test.ts": 21,
  "connectionCardReachability.test.tsx": 10,
  // ── Added in 212-05 (GATE-1) — Phase 212 catalog and barrel tests ────────────
  "servicesCatalog.test.ts": 3,
  // ⚠ RE-BASELINED `3 -> 5` at Phase 217's close (plan `217-12`), edited HERE rather
  // than re-declared in the 217 block below — a second entry for the same key is a
  // silent LAST-WINS override. 217-10 extended this barrel guard to `api/documents.ts`
  // (it covered `connectors.ts` only); the `+2` is exactly its two new `it` blocks, read
  // from this gate's own printed `3 -> 5 +2` row, with no residual.
  "apiBarrel.test.ts": 5,
  // ── Added in Phase 213 (213-05 / GATE-1) — per-tool grants list invariants ──
  "ConnectionGrantsList.test.tsx": 8,
  "ingestVisibility.test.tsx": 16,
  // ── Added in Phase 221 (221-01 / T7), every value read from THIS script's own printed
  // ── `— N new` column in the same run that adopted them. Not booked ahead: an unpinned
  // ── file is not lightly guarded, it is UNGUARDED — its count can fall to 1 and the gate
  // ── still reports OK.
  //
  // ⚠ `ConnectionFormPanel.oauth.test.tsx` is a FIND, not a new file. It has shipped since
  // Phase 215 and sat in NEITHER knob, so the gate never ran it and nothing guarded it —
  // the sixth suite found in that state inside a week. TARGETS decides what RUNS and
  // BASELINE decides what is GUARDED, and a suite can sit on the wrong side of exactly one.
  "ConnectionFormPanel.oauth.test.tsx": 8,
  "toolGroups.test.ts": 21,
  // Step 2 (2026-09-01): +3 — the two band cases for a mixed-direction application and
  // the D-221-06 rendering case. Read from the gate's own printed column.
  "ConnectionGrantsList.grouping.test.tsx": 18,
  // Plan 02 (2026-09-01): 14 -> 19. `partly` was UNREACHABLE BY CONSTRUCTION until this
  // plan — `blockedApplicationCount` was the literal 0 — so these five cases had nothing
  // to assert before it. Read from the gate's own printed column, not counted by hand.
  "connectionRowVerdict.test.ts": 37,
  // ── Added in Phase 221 plan 02, in the SAME COMMIT that creates the files ───────────
  // ⚠ BOTH KNOBS, TOGETHER. Every suite found orphaned in the last week was orphaned
  // because one knob was edited and the other was not; `src/components/settings/` entries
  // in TARGETS are FILE-LEVEL, so a new file there is invisible until its name is typed.
  "applicationAvailability.test.ts": 18,
  "ApplicationGroup.availability.test.tsx": 10,
  "statusWord.honesty.test.ts": 5,
  // ⚠ FOUND UNPINNED 2026-09-01 while fixing the ask-card defect: the gate RUNS this
  // suite (a directory TARGETS entry reaches it) and guarded NOTHING. It could have lost
  // every case and the gate would still have said OK. The twelfth suite found in this
  // state in a week — see SEED-229, which proposes the gate self-check that would end it.
  "PendingAskCard.test.tsx": 45,
  // SEED-227 — pinned at 3 in the SAME COMMIT that creates the file and its TARGETS line,
  // from this script's own printed `actual` column (`— 3 new`), not booked ahead. An
  // unpinned file is not a lightly-guarded one, it is an UNGUARDED one: the count could
  // fall to 1 and the gate would report OK. The load-bearing case is the ABSENCE one —
  // `_images` is stamped only on truncation — and an absence assertion is the easiest kind
  // to delete without anyone noticing.
  "DocumentDetailPanel.images.test.tsx": 3,

  // ── Phase 240 (SRC-05 / D-240-19) — pinned at the counts measured at this phase's close.
  // ⚠ Captured from a GREEN run, never while red, and matched 1:1 with the TARGETS entries
  // added at the end of this file. A file in TARGETS and not here RUNS and guards nothing.
  "ConnectedSourceSection.test.tsx": 5,
  "CreateWatchModal.test.tsx": 5,
  "DocumentConversationSection.test.tsx": 8,
  "watchProductMark.test.ts": 7,
  "navItemsUnknownIsNotDenied.test.ts": 4,

  // ── Phase 243 (243-01 / CHAT-01 / CHAT-04 / D-243-16) — the thinking block's
  // ── PRE-EXTRACTION characterization net. Pinned in the SAME COMMIT that creates the file
  // ── and its TARGETS line, because a BASELINE key naming a path that does not yet exist
  // ── makes this gate ERROR (exit 2) rather than fail.
  //
  // ⚠ 17 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed the
  // file (printed as `— 17 new`), never hand-counted from `it(` literals and never taken from
  // a planning document — the plan that authored this suite quotes no number for that reason.
  //
  // What is UNGUARDED without this entry: the thinking block's three states have NO other
  // test anywhere in this tree — `thinking-trigger` and `thinking-row` were asserted by
  // nothing at all before this file existed. 243-02 MOVES that block out of RunCard and
  // mounts it from MessageItem; this pin is what stops the move from silently deleting the
  // cases that certify it. Two of the seventeen pin DEFECTS on purpose (the tool-gated
  // reasoning of CHAT-04, and the two folds a settled run puts in front of it) — a lowering
  // here would most cheaply be achieved by dropping exactly those.
  //
  // RAISED 17 -> 23 at Phase 243 plan `243-02`, and the number was READ FROM THE GATE'S OWN
  // `actual` column (`ThinkingBlock.characterization.test.tsx  17  23  +6`), never counted by
  // hand. The +6 is fully attributed: 10a/10b/10c (the one-renderer source fence and its
  // positive control), 11 (DOM order), 12 (the no-second-gate fence) and 13 (the fold
  // survives the temp-id -> DB-id reconcile, which is where the remount semantics were
  // DECIDED). The two defect cases named above did NOT go away when the defects were fixed:
  // 8 and 9 were INVERTED IN PLACE and still assert, now on the correct side. That is the
  // distinction this pin exists to make — a fixed defect keeps its case, a dropped one does
  // not, and only the count can tell them apart.
  //
  // RAISED 23 -> 27 at `243-04`, again READ FROM THE `actual` COLUMN
  // (`ThinkingBlock.characterization.test.tsx  23  27  +4`). The +4 is fully attributed and
  // is ALL of §5b: the two-paragraph element-count case, the no-nested-scroller case, the
  // single-paragraph median case, and the lossless-split case. §5 itself CHANGED rather than
  // multiplied - it now pins V1's class set instead of the defect's - so the count is the
  // only thing that can tell a REPLACED pin from a DROPPED one.
  //
  // RAISED 27 -> 33 at `243-04` task 3, from the `actual` column again. The +6 is §14, the
  // label's three arms: MEASURED (a), pluralisation (b), and ⛔ the two REFUSALS (c, d) plus
  // the streaming and no-count guards (e, f). ⛔ §14d is the one that costs something to keep -
  // it drives a 33,713-char body specifically because that is the scale at which a
  // length-derived duration looks most plausible, and it is the cheapest case to drop.
  "ThinkingBlock.characterization.test.tsx": 33,

  // ── Phase 243 (243-04 / CHAT-01 / D-243-02) — the reasoning clamp ───────────────────
  //
  // ⚠ 7 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed the
  // file (printed as `—  7  new` on this suite's row), never hand-counted. ⚠ The suite's
  // FILENAME is deliberately not repeated in this prose: the plan's own acceptance grep
  // counts its occurrences in this script, and a comment naming it makes that count lie.
  //
  // What is UNGUARDED without this entry: the tail treatment at BOTH ends of D-243-03's 170x
  // spread. §3 is the load-bearing one - the control is ABSENT (not hidden) on the median
  // 198-char body, which is what distinguishes this clamp from the two OTHER clamps in this
  // tree (`CandidateCard.tsx:104`, `CitationCard.tsx:196-205`) that mount their toggle
  // unconditionally. §4 proves the gate is the MEASUREMENT and not the sketch's ~700-char
  // proxy; §5 proves the fade is not the user bubble's violet; §6 proves the cap is a REVEAL
  // and never a nested scroller, which is what CHAT-01 is about. A lowering here would most
  // cheaply be achieved by dropping exactly §3 and §4 - the two that cost something to keep.
  "ThinkingBlock.clamp.test.tsx": 7,

  // ── Phase 243 (243-05 / CHAT-05 / CHAT-01 — D-243-06) — the answer out of the fold ─────
  //
  // ⚠ 13 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed the
  // file (printed as `— 13 new` beside this suite name), never hand-counted from `it(`
  // literals.
  //
  // What is UNGUARDED without this entry, and none of it is covered anywhere else in the
  // tree: §1/§2 that a live tool-bearing run writes its answer as the message BODY and in
  // DOCUMENT ORDER below the thinking line (the CHAT-05 fix itself); §3 that the streaming
  // caret survives it; §4 that `StreamingNarration` is neither deleted nor restyled; §5 that
  // the absence hint's gate did not flip as a side effect; and §6 the NAVIGATION path, driven
  // through `StreamsProvider`'s own callbacks and reconcile — the only fence in the tree that
  // drives a run terminating while its thread is not the mounted surface.
  //
  // ⛔ A lowering here would most cheaply be achieved by dropping §6, which is the half
  // `BUG-260707-03` residual #2 is actually stated on and the half a live-send check cannot
  // see. `src/providers` sits in NEITHER knob, so §6 is guarded here or nowhere.
  "MessageItem.answerOutOfFold.test.tsx": 13,

  // ── Phase 243 (243-03 / CHAT-02 / D-243-15) — the delta path's coalescing fence ─────────
  //
  // ⚠ 9 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed the
  // file (printed as `— 9 new` beside this suite name), never hand-counted from `it(` literals.
  //
  // What is UNGUARDED without this entry: `makeStreamCallbacks` now BUFFERS text between
  // repaints, and the two ways that goes wrong are invisible to every other suite in this
  // tree. §2/§3 reconstruct the exact concatenation of 60 individually-distinguishable
  // deltas — the guard against `makeThrottle`'s last-write-wins shape being reintroduced,
  // which would drop tokens while every cadence measurement still looked right. §6 asserts
  // the FIRST delta paints with no window elapsed (a trailing-only coalescer would delay a
  // reply's first character). §4/§5 assert both terminal edges drain the buffer. A lowering
  // here would most cheaply be achieved by dropping exactly those.
  //
  // ⛔ §8 pins DELTA_COALESCE_MS at 60. The case NAMES of §1 do arithmetic on that number,
  // so retuning the window without re-deriving them is caught here rather than silently
  // leaving a comment that lies.
  //
  // RAISED 9 -> 15 at `243-04` (D-243-13). The +6 is §10, the MEASURED reasoning span, which
  // lives in this file rather than the component net because the stamp is delta-path
  // behaviour and this file already owns the `makeStreamCallbacks` harness and its module
  // mocks. §10c (no reasoning -> the field is ABSENT) and §10d (the span settles once) are the
  // two that stop a fabricated or whole-run duration; a lowering would most cheaply drop them.
  //
  // RAISED 15 -> 18 at `243-06` (review finding HI-1). The +3 is §10g / §10h / §10i, and all
  // three were driven RED against 243-04's shipped code — §10g read `expected 40100 to be less
  // than 5000` for 100 ms of thinking either side of a 40 s tool. They are the cases that pin
  // WHICH INTERVAL the number is: §10g that a tool call is not thinking, §10h that a
  // multi-burst turn sums its bursts rather than its wall clock, §10i that one reasoning delta
  // is an observation and not an interval (so no duration is written at all). §10b and §10f
  // were re-expressed in the same vocabulary and still count 1 each; the total moves by the
  // three new cases only.
  "streamsProvider_243_cadence.test.tsx": 18,
  // 243-06 (MD-4): this suite existed since Phase 176 and was in NEITHER knob, so it ran
  // nowhere and guarded nothing. Registered here when MD-4 added the failed-terminal cases.
  "streamsProvider_bug_260707_03_final_answer_resolve.test.tsx": 6,

  // ── Phase 243 (243-03 / CHAT-03 / D-243-16) — the scroll effect's ONLY behavioural fence ─
  //
  // ⚠ 8 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN on the run that first executed the
  // file (printed as `— 8 new`), never hand-counted.
  //
  // What is UNGUARDED without this entry: EVERYTHING about `MessageList.tsx:141-176`.
  // `MessageList.test.tsx` stubs `HTMLElement.prototype.scrollIntoView` to a NO-OP tree-wide
  // (`:61-65`), so until this file existed nothing in this tree could see how many times that
  // effect scrolls, or with which `behavior`. This suite installs a SPY instead. §3 pins the
  // residual CHAT-03 defect (a sub-threshold nudge up must not be re-armed by a scroll nobody
  // produced) and §5 pins its MIRROR (a deliberate flick back down MUST still re-arm) — the
  // pair is the design, and a "fix" that drops either half is what this count catches. §7 is
  // the only case here that drives the REAL producer, and it is what makes D-243-04's claim a
  // measurement: 60 deltas produced 61 scrolls before the coalescing and 13 after.
  //
  // ⚠ Every case runs on a 54-message thread. A 3-message fixture cannot show the failure
  // mode the ROADMAP names ("works on a short thread and fails on a long one").
  //
  // ⚠ RAISED 8 -> 11 at `243-06` (review finding HI-2). §8 drove RED at the component level with
  // the REAL interaction this phase introduced — a `pointerdown` on `ThinkingBlock`'s fold
  // `<button>`, which sits inside this viewport on every reasoning-bearing row — and the
  // Jump-to-live chip vanished, i.e. the reader was dragged back. §9 drove the horizontal wheel
  // (`deltaY === 0`, which used to read as "down"). §10 is their mirror: the same click with no
  // prior scroll-up must leave following intact.
  "MessageList.scroll.test.tsx": 11,

  // ── Phase 243 (243-03 / CHAT-02) — ADOPTED, NOT CREATED, and it was ungated since 068.5 ──
  //
  // ⛔ THIS FILE ALREADY EXISTED AND WAS IN NEITHER KNOB. `grep -n "throttle"` on this script
  // returned NOTHING before 243-03 — `lib/throttle.ts` shipped at Phase 068.5 with a suite
  // that has guarded nothing for the whole of its life. Registered in both knobs here.
  //
  // ⚠ 11 was READ FROM THIS SCRIPT'S OWN `actual` COLUMN (printed as `— 11 new`). It is 4
  // inherited cases plus 7 added by 243-03, and the split matters: the 4 pin `makeThrottle`'s
  // trailing-only, last-write-wins contract, which is CORRECT for its one call site (the
  // localStorage cache writer) and would DROP TOKENS on the delta path. The 7 pin the new
  // `makeAccumulatingCoalescer`, whose contract is the opposite on both axes.
  //
  // ⛔ A future editor who "unifies" the two primitives breaks one of the two call sites
  // silently. A decrease here is most cheaply achieved by exactly that.
  "throttle.test.ts": 11,
  // ══════════════════════════════════════════════════════════════════════════════
  // Added at Phase 214's CLOSE (plan `214-15`), collected here AFTER every file
  // exists — a `BASELINE` key naming a path that does not yet exist makes this gate
  // ERROR (exit 2) rather than fail, which is why sixteen plans' pins land in one
  // commit instead of sixteen.
  //
  // ⚠ EVERY FIGURE BELOW IS THE GATE'S OWN PRINTED `— N new`, read off the run
  // recorded verbatim in `214-15-SUMMARY.md` (`total 6355 · failed 0 · pinned total
  // 5266 · 120/120`). NOT ONE IS HAND-DERIVED. A hand-derived pin is a number the
  // gate has never agreed with.
  //
  // ⚠ TARGETS vs BASELINE was CHECKED HERE, NOT ASSUMED — and the check refuted the
  // plan's own belief. `WorkflowScheduleModal.test.tsx` was recorded at plan time as
  // being in NEITHER knob. It is in `src/components/workflows/__tests__/`, and the
  // `src/components/workflows` entry in TARGETS below is a DIRECTORY entry, which
  // recurses. So the gate had been EXECUTING it and GUARDING nothing — the worse of
  // the two halves, because a green gate read as covering a launch-critical surface.
  // No TARGETS edit is needed for it; the pin below is the whole fix.
  //   · plan `214-16` creates no frontend suite at all — it extends
  //     `src/lib/apiRunFields.fences.test.ts`, already a TARGETS **file** entry.
  //   · plan `214-07`'s reachability case lives inside `ArgumentEditor.test.tsx`,
  //     under the `src/components/workflows` **directory** entry.
  // TARGETS decides what RUNS; BASELINE decides what is GUARDED.
  //
  // ⛔ BACKEND SUITES ARE NOT PINNED HERE AND CANNOT BE — this gate is vitest-only.
  // `backend/tests/integration/test_214_launch_inputs_wire.py` (214-16) and
  // `backend/tests/integration/test_214_argument_seams.py` (214-14) are guarded by
  // their plans' own pytest criteria and by the backend failure-count baseline (68).
  // Recorded as a DECISION rather than a silence, so nobody later reads this gate's
  // green as covering them.
  // Phase 214.1-01 (STEP-02) — the declared-input door's suite.
  //
  // ⚠ TARGETS vs BASELINE WAS CHECKED FROM THE GATE'S OWN PRINTED ROWS, NOT ASSUMED, and
  // the check is the whole reason no TARGETS line accompanies this pin: the pre-pin run
  // printed `DeclaredInputsEditor.test.tsx — 16 new`, so the file was ALREADY EXECUTING
  // under the `src/components/workflows` **directory** entry the moment it existed. It was
  // running and guarding nothing; the pin below is the entire fix.
  //
  // ⚠ AND A SECOND NEW SUITE IS NAMED RATHER THAN LEFT SILENT. The same run printed
  // `declaredInputs.test.ts — 25 new`. It is likewise executing and likewise unguarded, and
  // it is NOT pinned here because plan `214.1-02` owns this phase's registry edits and a
  // wave-1 worktree must not race a shared artifact for a second line. An unpinned suite is
  // not a lightly-guarded one, it is an UNGUARDED one — recorded so the adoption is owed
  // rather than forgotten. Its measured count at this commit is **25**.
  "DeclaredInputsEditor.test.tsx": 16,
  "ArgumentEditor.test.tsx": 33,
  "DescribeServicePicker.test.tsx": 20,

  // ══ Phase 214.1-02 (STEP-02) — THE PHASE'S REGISTRY DEBTS, PAID IN ONE PLACE ═══════════
  //
  // Plan `214.1-02` owns EVERY shared-registry edit of this phase, because a shared artifact
  // must not be written from two parallel worktrees. Six pins move below and one suite is
  // adopted, and EVERY figure is read from the gate's OWN `actual` column on a pre-edit run
  // — never hand-counted, and never carried over from a plan's prose. The dispatch note for
  // this plan named three of these; the gate's own output named six.
  //
  // ⚠ THE DISTINCTION THAT MATTERS: these are RE-BASELINES, not bumps. A pin sitting far
  // below its file's real count guards almost nothing — `PublishGauntlet.test.tsx` pinned at
  // 46 against a file running 83 left THIRTY-SEVEN cases deletable in silence, which is the
  // failure mode this whole register exists to prevent. Raising each pin to the measured
  // actual is what re-arms it.
  //
  //   file                            was  ->  now   attribution
  //   PublishGauntlet.test.tsx         46  ->   83   +37; stale BEFORE this phase (it read
  //                                                  78 at wave 1's start), plus 214.1-03's
  //                                                  five BUG-260828-04 diagnosis cases
  //   builderStore.test.ts             52  ->   77   +25; 214.1-01's setDeclaredInputs cases
  //   soulData.test.ts                 36  ->   58   +22; 214.1-01's RESERVED-key mirror
  //   PublishRefusalList.test.tsx      22  ->   25    +3; 214.1-03
  //   LaunchInputFields.test.tsx       15  ->   20    +5; 214.1-01's `required` mark
  //   declaredInputs.test.ts            —  ->   25   ADOPTED — see below
  //
  // ⭐ THE ADOPTION `214.1-01` EXPLICITLY OWED THIS PLAN. That plan's own note reads: *"an
  // unpinned suite is not a lightly-guarded one, it is an UNGUARDED one"*. `declaredInputs.ts`
  // is the ONE minting site every declared input passes through — its three refusals and its
  // ask-key derivation — and its 25 cases have been executing under the
  // `src/components/workflows` directory entry while guarded by nothing.
  // ⚠ THREE OF THE SIX ARE EDITED AT THEIR ORIGINAL LINES, NOT RE-DECLARED HERE.
  // `PublishGauntlet.test.tsx`, `builderStore.test.ts` and `soulData.test.ts` already have
  // entries far above; a second entry for the same key is a silent LAST-WINS override that
  // reads as two facts and behaves as one. Each carries a pointer back to this block.
  "declaredInputs.test.ts": 25,
  "LaunchInputFields.test.tsx": 20,
  "PublishRefusalList.test.tsx": 25,

  // ⭐ THE REACHABILITY PROPERTY (214.1-02 Task 2), AND IT NEEDS BOTH KNOBS.
  //
  // ⚠ CHECKED FROM THE GATE'S OWN PRINTED ROWS RATHER THAN ASSUMED, and the answer differs
  // from its wave-1 sibling directly above: the pre-edit run's file list contains **no row
  // at all** for `WorkflowBuilderPage.declaredInputs.test.tsx`, because `src/pages` is
  // reached by NAMED FILES ONLY — there is no `src/pages` directory entry. So this file was
  // neither running nor guarded, and the pin alone would have guarded a file the gate never
  // executes. A `TARGETS` line is added beside it.
  //
  // TARGETS decides what RUNS; BASELINE decides what is GUARDED. This suite needed both;
  // `DeclaredInputsEditor.test.tsx` needed only the second. The two sit ten lines apart and
  // took opposite answers, which is why the check is made per file and never inferred.
  "WorkflowBuilderPage.declaredInputs.test.tsx": 9,
  "StepIdentity.coverage.test.tsx": 23,
  "WorkflowScheduleModal.test.tsx": 9,
  "argumentModel.test.ts": 26,
  "argumentVocabulary.test.ts": 44,
  "describeServiceMatch.test.ts": 15,
  "publishRefusalVocabulary.test.ts": 41,
  "stepIdentityVocabulary.test.ts": 34,

  // ── BUG-260828-09 — BOTH NEEDED ONLY THE SECOND KNOB, AND THAT IS MEASURED ──────────
  // The gate's own pre-pin run printed both as `— N new` rows, which is proof they were
  // already EXECUTING: they live under `src/components/workflows`, a DIRECTORY entry in
  // `TARGETS` below, so no `TARGETS` line is owed. TARGETS decides what RUNS; BASELINE
  // decides what is GUARDED, and a suite can sit on the wrong side of exactly one of them
  // — the `WorkflowBuilderPage.declaredInputs.test.tsx` note above is the case that took
  // the opposite answer ten lines up, which is why this is checked per file and never
  // inferred from a sibling.
  //
  // Counts read from that run's printed rows, not predicted: 13 and 8.
  "publishBlockedStep.test.ts": 13,

  // BUG-260829-01 — same check as the pair above and the same answer: it lives under
  // `src/components/workflows`, already a DIRECTORY entry in `TARGETS`, so it RAN the moment it
  // was created and needs BASELINE only. Count read from the gate's printed row, not predicted.
  "cronPlain.test.ts": 15,
  "PublishBlockedStepCard.test.tsx": 8,
  // ⭐ ADOPTED rather than created. `RunStepList.tsx` IS in this phase's diff
  // (214-11 mounted the shared step identity in it) and its only suite was
  // unpinned — executed by the directory entry, guarded by nothing. An unpinned
  // suite is not a lightly-guarded one, it is an unguarded one.
  "RunStepList.test.tsx": 17,
  // ⚠ FIVE MORE SUITES REMAIN UNPINNED AND ARE NAMED RATHER THAN LEFT SILENT:
  // `PromptVariableChips.test.tsx` (3), `RunHero.test.tsx` (18),
  // `automationFacts.test.ts` (11), `nodeEffectBanner.test.ts` (8),
  // `toolReadOnlyMap.test.ts` (7). None guards a file in Phase 214's diff, so
  // adopting them here would fold unrelated drift into a commit that did not cause
  // it — the same reason twelve consecutive plans declined the pre-existing four.
  // Registered as `SEED-222` with a concrete re-open trigger, because a decision
  // recorded only in a comment is invisible to every sweep.

  // ══ Phase 217 (plan `217-12`, the phase's CLOSING plan) — THE DOCUMENT SPACE ═════════
  //
  // The GUARDED half of the two-knob pair whose RUNS half is the matching `TARGETS` block
  // below (search `Phase 217`). The full reasoning — why the pins land in one closing plan
  // rather than in fourteen creating commits, why every entry is file-level, and which five
  // directories this gate reaches by nothing — is recorded ONCE there and is not duplicated
  // here, because two copies of a reason drift.
  //
  // ⛔ EVERY FIGURE BELOW IS THIS GATE'S OWN PRINTED `— N new` COLUMN, read off the run made
  // AFTER the TARGETS lines existed and BEFORE these pins were written. NOT ONE IS
  // HAND-DERIVED. A hand-derived pin is a number the gate has never agreed with, and a pin
  // guessed high fails every run afterwards.
  //
  // ⭐ THE ARITHMETIC CLOSES WITH ZERO RESIDUAL, and that is what distinguishes GROWTH from
  // DRIFT. Adopting the TARGETS entries moved the grand total `6482 → 6664` = **+182**, and
  // the fourteen rows below sum to exactly 182. An unexplained `+n` is the thing to worry
  // about; a bigger number that adds up is this gate WORKING.
  //
  // ⚠ `DocumentList.test.tsx` and `DocumentList.moveToFolder.test.tsx` are the two halves of
  // the resolved bare-name collision. They are COMPLEMENTS (Phase 118 classification chip /
  // Phase 114 move-to-folder row action), so BOTH are pinned and NEITHER is excluded — an
  // undocumented exclusion is how a suite becomes invisible.
  "renameFence.test.ts": 15,
  // 19 → 20 at the format-list widening: the negative arm inverted to a presence arm, plus a
  // new case proving the list is still a SUBSET (one server mime deliberately unlisted).
  "acceptFormats.test.ts": 20,
  // ⚠ RE-PINNED 25 → 31 at Phase 233. It was UNDER-pinned by five before this phase touched it
  // (the gate's contract is no per-file DECREASE, so an under-pin is silent), and 233 repaired
  // an INHERITED red in it: `229-03` added `"ingestion_step": "failed"` to `documents.py`, which
  // is a terminal marker rather than a pipeline stage, and the ORDERED source fence counted it.
  // The fence was doing its job; what it caught was a real drift. +1 case is 233's own positive
  // control for the now-NAMED exclusion.
  "IngestionStrip.test.tsx": 31,
  "DetailSections.lazy.test.tsx": 14,
  "CR01.reset.test.tsx": 2,
  "DetailSections.tables.test.tsx": 15,
  "tabsContrast.test.ts": 14,
  "LibraryPage.test.tsx": 12,
  "librarySelection.test.ts": 25,
  "useDocuments.test.ts": 7,
  "DocumentList.test.tsx": 7,
  "DocumentList.moveToFolder.test.tsx": 4,
  "ViewsGroup.test.tsx": 10,
  "DocumentDetailPanel.a11y.test.tsx": 7,
  "CsvTablePreview.test.tsx": 8,
  //
  // ⚠ ONE RE-BASELINE, NOT A NEW PIN, AND IT IS EDITED AT ITS ORIGINAL LINE rather than
  // re-declared here — a second entry for the same key is a silent LAST-WINS override that
  // reads as two facts and behaves as one. `apiBarrel.test.ts` moves `3 -> 5`: plan 217-10
  // extended it to cover `api/documents.ts` (it guarded `connectors.ts` only), and the `+2`
  // is exactly its two new `it` blocks, with no residual. See the pointer at its own entry.
  //
  // ── DECLINED, each with its reason, so a decline can never read as an oversight ───────
  //  · The five `SEED-222` suites named directly above (`PromptVariableChips`, `RunHero`,
  //    `automationFacts`, `nodeEffectBanner`, `toolReadOnlyMap`) — STILL unpinned. 217 reads
  //    none of them and none guards a file in this phase's diff; adopting them here would
  //    fold unrelated drift into a commit that did not cause it. Their measured counts at
  //    this commit are unchanged from Phase 214's note: 3 / 18 / 11 / 8 / 7.
  //  · The six other `src/components/panel/__tests__` suites (`FilePreview`,
  //    `PendingAskCard`, `Seam`, `TodosSection`, `VersionDiff`, `WorkspacePanel.derived`) —
  //    217 converts only `CsvTablePreview.tsx`, so only its suite is claimed.
  //  · `DocumentStatusBadge.test.tsx`, `FilterBar.test.tsx` and
  //    `DocumentStatusBadge.a11y.test.tsx` — DECLINED by 217 (it modified neither
  //    `DocumentStatusBadge.tsx` nor `FilterBar.tsx`), then ADOPTED by 217.1-18, which
  //    owns the document space. See the pins at the tail of this map.
  //
  // ⛔ BACKEND SUITES ARE NOT PINNED HERE AND CANNOT BE — this gate is vitest-only.
  // `backend/tests/test_217_document_response_fields.py`,
  // `backend/tests/test_217_document_detail_routes.py` and
  // `backend/tests/test_217_document_queries.py` are guarded by their plans' own pytest
  // criteria and by the backend failure-count baseline. Recorded as a DECISION rather than
  // a silence, so nobody later reads this gate's green as covering them.

  // ── THE PHASE 217.1 SUITES — ADOPTED BY 217.1-18 AT ITS OWN CLOSE ────────────────────
  // Pinned at the gate's OWN printed `actual` on the same run that this phase's closeout
  // verified green, never while red. Two knobs: each has a named-file `TARGETS` entry above
  // (TARGETS decides what RUNS) and a pin here (BASELINE decides what is GUARDED). The three
  // trailing orphans close 217's deferred-§3 re-open trigger.
  "sketchComposition.test.tsx": 47,
  "ingestionFailureCopy.test.ts": 25,
  "IngestionTab.test.tsx": 40,
  "pipelineGroups.test.ts": 7,
  "LibraryStatTiles.test.tsx": 13,
  "viewRulePhrase.test.ts": 4,
  "ViewCardGrid.test.tsx": 14,
  "IndexFoldersTable.test.tsx": 6,
  "IndexingTab.gate.test.tsx": 6,
  "HealthTiles.test.tsx": 6,
  "HealthSignalChips.test.tsx": 13,
  "CheckedQueriesSection.test.tsx": 11,
  "ChatLayout.fallback.test.tsx": 4,
  "DocumentQueriesSection.test.tsx": 8,
  "FilterBar.test.tsx": 10,
  "DocumentStatusBadge.test.tsx": 19,
  "DocumentStatusBadge.a11y.test.tsx": 19,
  // ── Phase 222 (222-05 / D-222-09) — Door half OAuth & probe-auth discovery ──
  "connectors.mcp_auth.test.ts": 8,
  "connectionFormCopy.mcp.test.ts": 6,
  "McpAuthDoor.test.tsx": 9,
  "McpAuthDoor.byo.test.tsx": 3,
  "scrollAreaViewportWidth.test.tsx": 2,
  // ── BUG-260904-02 (2026-09-04) — the follow-but-release scroll machine ───────────────
  // ⚠ FOUND IN NEITHER KNOB while carrying the entire scroll discipline of the chat: the gate
  // has never executed it and nothing guarded its count. Adopted here, in the commit that fixes
  // the defect it failed to catch.
  //
  // WHAT IS UNGUARDED WITHOUT IT: the three fences that keep a streaming run from dragging a
  // reader who scrolled away — the smooth-scroll TAIL must not re-arm the pin, a gesture must
  // cancel our claim for the purpose of letting go but NEVER for taking hold again, and an
  // upward gesture must release synchronously rather than a commit later. Each was driven RED,
  // and two of them only after a REAL mouse wheel refuted a synthetic one that measured clean.
  //
  // ⚠ RAISED 10 -> 17 at `243-06`, AND THE +7 IS TWO DIFFERENT THINGS — attributed rather than
  // quoted as one number, because an unexplained `+n` is the thing to worry about. **+3 were
  // already on disk and unpinned**: `243-03` added cases ⭐A / ⭐B / ⭐C and did not re-baseline,
  // so the file ran at 13 against a pin of 10 for a whole phase. **+4 are `243-06`'s** (review
  // finding HI-2): ⭐D drove RED — `expected true to be false` — that ONE directionless
  // `pointerdown` re-pinned a reader who had wheeled up and stayed released for 1000 ms, and
  // D-mirror-1/2/3 pin the three ways the decision must still be GIVEN BACK (a geometry-only
  // release, `jumpToLive()`, a new run). ⛔ The mirrors are the half a later "fix" would drop:
  // refusing every directionless re-arm passes ⭐D and strands every scrollbar user.
  "useFollowScroll.test.ts": 17,
  // ── BUG-260904-01 (2026-09-04) — the Continue button's ONLY behavioural guard ──────────
  // Pinned in the SAME COMMIT that creates it (a BASELINE key naming a path that does not yet
  // exist makes this gate ERROR at exit 2, not fail). Bare name confirmed unique tree-wide.
  //
  // ⚠ WHAT IS UNGUARDED WITHOUT IT, and why an existing fence did not cover it: the call
  // `continueRun(workflowLock.runId)` was ALREADY asserted by `WorkspacePanel.test.tsx:1218`
  // — as SOURCE TEXT. That fence passed for as long as the symbol was unimported and the click
  // threw `ReferenceError`. A fence on the SHAPE of a call cannot see whether the call resolves;
  // only rendering the card and clicking the button can, which is what this suite does. Driven
  // RED against the unfixed component first.
  "MessageItem.continueButton.test.tsx": 2,
  // ── Phase 227 (227-01 / SC#5) — Chat run frame & message decomposition suites ──
  "MessageItem.cancelledRun.test.tsx": 8,
  "MessageItem.blockedNotice.test.tsx": 4,
  "MessageItem.harnessBanner.test.tsx": 11,
  "ChatAreaBanner.test.tsx": 7,
  "ChatAreaMode.test.tsx": 5,
  "RunCard.characterization.test.tsx": 8,
  "MessageItem.test.tsx": 24,
  "MessageItem.clamp.test.tsx": 5,
  "MessageItem.fallbackNotice.test.tsx": 3,
  "MessageItem.memo.test.tsx": 3,
  "MessageItem.sticky.test.tsx": 4,
  "RunCard.logo.test.tsx": 6,
  "ToolCallPanel.test.tsx": 16,
  "MessageList.test.tsx": 30,
  "MessageList.dedup.test.tsx": 7,
  "MessageList.runline.baseline.test.tsx": 8,
  // ── Phase 228 (228-02 / DEBT-02) — Retry turn & cap_paused reconcile suites ──
  "MessageItem.retry.test.tsx": 4,
  "MessageItem.capPaused.test.tsx": 5,
  // ── Phase 228 (228-03 / DEBT-04) — Vercel subdomain routing suite ──
  "vercelRouting.test.ts": 6,
  // ── Phase 232 (232-04 / SRC-02) — Source folder picker suite ──
  "SourceFolderPicker.test.tsx": 7,
  // ── Phase 233 (233-02 / PREV-01…03 / LIB-09) — THE PREVIEW. Two suites, and BOTH knobs ──
  // ── are set in the SAME COMMIT that creates them, because a BASELINE key naming a path ──
  // ── that does not yet exist makes this gate ERROR (exit 2) rather than fail. ───────────
  //
  // ⚠ Neither file is covered by an existing TARGETS entry: `src/components/sources` is NOT a
  // directory entry — `SourceFolderPicker.test.tsx` is pinned by an explicit PATH above, and a
  // path entry recurses into nothing. So both suites needed a TARGETS line of their own, and
  // that was CHECKED against the array rather than assumed. This is Phase 214's finding
  // (`WorkflowScheduleModal.test.tsx` ran for phases while guarding nothing) in the one place
  // where forgetting it would leave the milestone's differentiator unguarded.
  //
  // ⭐ These two carry the honesty invariants of the operator-locked sketches 229 + 230: the
  // four verbatim labels, the no-content-identity claim, the four sections with no removal
  // control, collapse-hides-files-not-counts, the four-zero receipt, and a NAMED refusal. Four
  // defects were planted against them and each fired (4 / 1 / 1 / 4 assertions), with both
  // source files restored md5-identical.
  // 12 → 17 at the recursion fix: the scanned-depth and budget-stop sentences.
  // 17 → 21 at sketch 231-A: the honest-confirm vocabulary (Accepted ≠ Readable) and the
  // three-terminal-outcomes fence.
  "previewVocabulary.test.ts": 21,
  // ── Sketch 231-A (operator-locked 2026-09-05) — the Library's one header row. ──────────
  // ⚠ BOTH knobs, same commit, AND THE CHECK MATTERED: this comment first read
  // "`src/components/library` IS a directory entry so the file already runs". **It is not.**
  // That directory's suites are listed one PATH at a time in TARGETS, and a path entry
  // recurses into nothing — so without its own TARGETS line this file would never have been
  // EXECUTED, and a BASELINE key naming an unexecuted file makes this gate ERROR (exit 2)
  // rather than fail. Phase 214's `WorkflowScheduleModal` finding, avoided by looking.
  "LibraryHeaderBar.test.tsx": 9,
  // 22 → 30: per-file selection (operator: "how can I select individual files") and the
  // two-column body that puts the folder tree inside the card it feeds.
  "SourcePreviewPanel.test.tsx": 30,
  // ── Phase 234 (234-05 / LIB-08 / SURF-01 / VIS-05) — Watched folders surface ──
  // 6 → 27 at Phase 235: the card gained the outcome line, the stopped sentence, the
  // degraded/report row and the history disclosure, each with its own case (235-10).
  "WatchedFoldersSection.test.tsx": 27,
  // ══ Phase 235 (235-12 / SURF-02 / SURF-03 / LIB-10) — "the source says what it did" ════
  //
  // ⚠ EVERY NUMBER BELOW IS THE GATE'S OWN PRINTED `— N new` FIGURE at this commit, read
  // off the run made with the TARGETS lines added and these keys still absent. None is
  // copied from a plan summary and none is guessed: the ten `— N new` figures sum to
  // EXACTLY +150 and the grand total moved 7565 → 7715, which is the arithmetic that
  // separates growth from drift (Phase 192.2's rule — an unexplained `+n` is the thing to
  // worry about, never a bigger number).
  //
  // BOTH knobs are set in the SAME COMMIT as the TARGETS lines above. See that block for
  // why (`exit 2`, not `fail`) and for the checked-not-assumed finding that none of
  // `src/components/sources`, `src/components/library`, `src/components/layout` or
  // `src/hooks` is a directory entry.
  //
  // ⛔ `sourceComposition.test.tsx` — the phase's design-contract fence — IS IN NEITHER
  // KNOB, DELIBERATELY, BECAUSE IT IS RED (16 failed / 33 passed of 49). Full reasoning in
  // the TARGETS block. This is stated in both places because a reader who greps one knob
  // must not conclude the omission was an oversight.
  "sourceHealthVocabulary.test.ts": 42,
  "runHistoryFold.test.ts": 17,
  "RunHistoryList.test.tsx": 18,
  "WatchedFoldersSection.history.test.tsx": 17,
  "IngestionTab.readerOff.test.tsx": 5,
  // Quick task after Phase 235: the one control must RENDER and ACT. 5 behaviour cases
  // (IngestionTab -> WatchedFoldersSection) + 1 SOURCE FENCE for LibraryPage -> IngestionTab,
  // which the behaviour cases are structurally blind to and which is the link that ACTUALLY broke.
  "IngestionTab.reconnectControl.test.tsx": 6,
  "SourcesAttentionSection.test.tsx": 13,
  "NavPanel.badge.test.tsx": 14,
  "ChatLayout.badge.test.tsx": 5,
  "useSourceAttention.test.tsx": 13,
  "LibraryPage.initialTab.test.tsx": 6,
  // Phase 238 (D-238-08). 6 cases; the load-bearing one is "refuses a service_id that LOOKS
  // like a source but was never registered" — the guess this replaced said TRUE for both of
  // its fixtures. ⚠ In BOTH knobs on purpose: Phase 214 measured that TARGETS decides what
  // RUNS and BASELINE decides what is GUARDED, and a suite can sit on the wrong side of
  // exactly one of them for a whole phase without anyone noticing.
  "sourceCapability.test.ts": 12,
  // ── Phase 239 (239-03) — F-7, THE OWED ENTRIES, TAKEN BY THE LAST WAVE ───────────────
  //
  // ⚠ `239-02` shipped a FOURTEEN-CASE suite and the gate's grand total moved by EXACTLY
  // ZERO — `7822 · pinned 7026`, character-for-character what Phase 238's close recorded.
  // That is what proved it: `src/components/settings` is NOT a directory entry in TARGETS
  // (its settings suites are listed one file at a time), so the gate never ran the file and
  // a future edit could have deleted all fourteen cases with the gate still green.
  //
  // ⚠ Wave 2 deliberately did not take this edit — two parallel waves editing one shared
  // hot file is a merge conflict for no gain — and named it as owed at the phase close.
  // This is that close. BOTH knobs, for the reason the entry above states.
  "ConnectionFormPanel.sourceTools.test.tsx": 14,
  "ConnectionFormPanel.refreshReceipt.test.tsx": 4,
}

// Still COMPUTED, never hand-written — the reduce is the single source, so the
// trailing figure below is a note about the reduce's result and can never be the
// thing the gate reads. 2421 after 188-12 pinned EVERY file the gate executes at
// its measured `actual` (41 files); the figure now equals the run's own printed
// `total`, i.e. the gate carries ZERO slack and any deletion anywhere in the blast
// radius is visible. Was 1037 = 946 + 68 + 13 + 8 + 2 (188-01 extended: two suites
// that already RAN unpinned, plus two pinned in the same commit that first made
// them run). Was 946 = 804 + 7 (DescribeKbPicker 30→37) + 106 (canvas 22→128)
// + 10 (DoorSwitch 13→23) + 19 (describe.test.tsx, newly RUN and pinned)
// — the post-round-5 truth-14 correction. Was 804 = 715 + 30 + 30 + 29 (187-29
// extended; 715 = 415 + 232 + 68 after 187-25 extended; was 415 after 185-08
// lowered it, 424 at the original 184 Wave-0 pin).
// ⚠ CORRECTED BY 188.1-01: the trailing figure said `2421` while the reduce computed 2462 —
// stale since 188-12 re-pinned every file, and harmless only because the gate reads the
// reduce and never the comment. It became 2465 (2462 + the two 188.1-01 extensions above),
// re-derived from this script's own printed `total` across two agreeing runs. A number in a
// comment that nothing checks goes stale by default; recording the correction rather than
// silently rewriting it is the house `⚠` rule.
// ⚠ AND AGAIN BY 188.1-02: 2465 → 2466, the single editing-suite extension above. The same
// note going stale twice in two plans is the evidence for the rule, not a counterexample to
// it: this figure is a NOTE ABOUT the reduce's result and is never what the gate reads, so
// only a deliberate correction in the same commit as the pin keeps it true.
// ⚠ AND A THIRD TIME BY 188.1-04: 2470 → 2476, the six falsification extensions above
// (PhaseNodeCard +2, PhaseTimeline +2, PhaseNode +1, WorkflowRunPage +1). Re-derived from
// this script's own printed `total` across two agreeing runs, in the same commit as the
// pins — which is the only thing that keeps a note nothing checks from going stale again.
// ⚠ AND A FOURTH TIME BY the 184.1 Nyquist gap-closure: 2477 → 2482, the five
// `WorkflowBuilderPage.header.test.tsx` extensions above (D-184.1-03's Spine-view pin +
// D-184.1-04's non-breach guard, both falsified and reverted before the pin moved).
// Re-derived from this script's own printed `total` across two agreeing runs.
// ⚠ AND A FIFTH TIME BY 188.2-07: 2482 → 2502, the two extensions above (`PhaseNodeCard`
// +17, `WorkflowCanvas.editing` +3). Re-derived from this script's own printed `total` across
// two agreeing runs on 2026-08-07 (both `total 2482 2502 +20`), in the SAME commit as the pins.
// ⚠ A finding recorded here because it bears on how this line should be read: on 2026-08-07 the
// gate's `failed` count was observed varying between 0 and 1 across two back-to-back runs with
// IDENTICAL per-file columns. The one failure was
// `src/pages/WorkflowBuilderPage.canvas.test.tsx > 184-11 … POSITIVE CONTROL`, which passes
// 128/128 in isolation, and no Phase-188.2 plan touches that file. See `188.2-DEFERRED.md`
// D-188.2-DEF-01 — the COUNT columns are stable and remain a sound regression backstop; the
// `failed` line is not, on this machine, today.
// ⚠ AND A SIXTH TIME BY BUG-260807-01 (`/gsd:fast`, 2026-08-07): 2506 → 2508, the one
// extension above (`WorkflowCanvas.editing` +2).
// ⚠ TWO CORRECTIONS ON MEASUREMENT, both pre-existing and stated rather than smoothed:
//   1. The trailing marker on this line read `2502 (188.2-07)` while the gate itself printed
//      `pinned total 2506` on an UNMODIFIED tree — the sum drifted 4 above its own note. The
//      note is not what the gate reads (`BASELINE_TOTAL` is computed from `Object.values`),
//      which is exactly why nothing caught it; a hand-written total beside a derived one is a
//      claim, not a check.
//   2. The `failed` variance recorded above as "between 0 and 1" is measured WIDER today:
//      **9 on a clean, unmodified tree** and 19 on a second sample of the same tree state.
//      The nine were named and attributed rather than waved through — `WorkflowCanvas.test.tsx`
//      axe rows ("Axe is already running"), `PhaseNode.test.tsx`, `StepTypePicker.test.tsx`,
//      `WorkflowCanvas.composition.test.tsx` and `WorkflowBuilderPage.canvas.test.tsx` — and
//      every one passes in isolation. NONE is in a file this fix touches. D-188.2-DEF-01
//      stands and is if anything understated.
// ⚠ A SEVENTH TIME BY 189-08, AND THE NOTE WAS NOT MOVED WITH IT — measured by 189-10 on an
// unmodified tree: the marker below read `2508` while the gate printed `pinned total 2521`,
// a drift of 13 (189-08's `phaseState.test.ts` 34 → 40 and `PhaseTimeline.test.tsx` 10 → 17).
// That is correction #1 above recurring in the very next plan, which is the strongest
// available argument that a hand-written total beside a derived one is a claim and not a
// check. Corrected to the measured figure rather than silently rewritten.
// ⚠ AND AN EIGHTH TIME BY 189-10: 2521 → 2533, the new `runVocabulary.test.ts` (+12) pinned
// above — and a NINTH by the SAME PLAN'S Task 2: 2533 → 2546 (`runVocabulary` +11, the three
// whole-table ring invariants; `PhaseNodeCard` +2, the rendered four-arc uniqueness and the
// `EXPECTED_RING` falsification row). Both read from THIS SCRIPT'S OWN printed `total` column
// across two agreeing runs, each in the SAME COMMIT as its own pins.
// ⚠ AND A TENTH TIME BY 189-12: 2546 → 2560 (`definitionOps.test.ts` +11, the 7th phase
// type and the D-23 cross-language mirror fence; `StepTypePicker.test.tsx` +3, the 7th
// row's position, its resolver-sourced title and its fallback mark). Both read from THIS
// SCRIPT'S OWN printed `actual` column, in the SAME COMMIT as the tests that moved them.
// ⚠ AND AN ELEVENTH TIME BY 189-13: 2560 → 2564 (`soulData.test.ts` +3, the split-brain
// key-set property, its literal positive control and the resolver sweep; `PhaseNodeCard.test.tsx`
// +1, the tint-coverage property). Read from THIS SCRIPT'S OWN printed `actual` column, in the
// SAME COMMIT as the tests that moved them. ⚠ `StepTypePicker.test.tsx` had its 3D-mark
// exclusion DISCHARGED in the same commit and its pin was deliberately NOT moved — the case was
// REWRITTEN in place rather than deleted, so its count is unchanged at 46 and moving the pin
// would make the gate disagree with reality.
// ⚠ AND BY 189-13's SECOND TASK: 2564 → 2582 (`phaseVocabulary.test.ts` +16, the D-13
// capability tier and `notConnectedOf`; `canvasModel.test.ts` +2, the WR-04 subtitles probe
// and the `notConnected` projection). ⚠ FOUR further suites changed ASSERTIONS but not
// COUNTS and their pins were deliberately NOT moved — `StepTypePicker.test.tsx` (46, two
// exclusion cases rewritten in place), `phaseVocabulary.corpus.test.ts` (45, its derived
// token count moved 6 → a ≥ 7 floor), `panel/__tests__/PhaseTimeline.test.tsx` (17, its
// declined-panel-label case narrowed once the 7th type gained a 3D MARK — a different table)
// and `canvasModel.fixtures.test.ts` (100, 14 snapshots regenerated: the diff is 36 additions
// of `"notConnected": false` and NOTHING else).
// ⚠ The note below is prose beside a DERIVED value and has now drifted twice; it is
// updated here for the reader, and `BASELINE_TOTAL` itself remains the `reduce`.
// ⚠ AND BY 189-13's THIRD (deviation) TASK: 2582 → 2587 (`PhaseFormPanel.rails.test.tsx`
// +5, the D-189-DEF-02 closure guard).
// ⚠ AND BY 189-14 TASK 1: 2587 → 2612, and the PINNED FILE COUNT 46 → 47 — the first
// new pinned FILE since 188-01. `ExternalActionSection.test.tsx` (25) is the capability
// picker's net-new suite; it neither absorbs nor replaces `PhaseFormPanel.test.tsx` (19)
// or `PhaseFormPanel.rails.test.tsx` (32), both of which are unmoved beside it — the
// Phase-177 coverage-loss shape this per-file pinning exists to make impossible.
// ⚠ AND BY 189-14 TASK 2: 2612 → 2619 (`GovernanceSection.test.tsx` 42 → 49).
// ⚠ AND BY 189-15 TASK 1: 2619 → 2625 (`PhaseNode.test.tsx` 26 → 31, `canvasModel.test.ts`
// 51 → 52) — badge slot 1, the last free word-badge on the card. Pinned FILE count unmoved
// at 47: both suites already existed and both already ran inside the
// `src/components/workflows` DIRECTORY entry.
// ⚠ AND BY 189-15 TASK 2: 2625 → 2627 (`PhaseNodeCard.test.tsx` 131 → 132, the two-badge
// positive control; `WorkflowCanvas.test.tsx` 52 → 53, the canvas-level not-connected
// guard). Both guards whose WORDING 189 falsified were REWRITTEN IN PLACE, never deleted —
// a deleted guard is coverage nobody notices losing, and the gate would have refused the
// per-file decrease anyway.
// ⚠ AND BY BUG-260807-02 (`/gsd:quick 260807-x9p`, 2026-08-08): 2627 → 2664, and the
// pinned FILE count 47 → 48 — the first new pinned FILE since 189-14. `StepTypePicker.test.tsx`
// 46 → 52 and the net-new `editAffordance.test.ts` (31), both read from this script's own
// printed columns across two agreeing runs, in the SAME COMMIT as the tests.
// ⚠ AND A DISCREPANCY RECORDED RATHER THAN SMOOTHED, because it is exactly the drift this
// note keeps going stale over: those same two runs printed `total 2677`, which is THIRTEEN
// above the pinned 2664. The gap is NOT this change — it is two PRE-EXISTING files running
// above their pins, `ExternalActionSection.test.tsx` (25 pinned / 34 actual, +9) and
// `PhaseTimeline.test.tsx` (17 / 21, +4), both measured on the unmodified tree BEFORE any
// file here was touched. Nine and four cases are therefore deletable with the gate green
// today. They are left unpinned deliberately: neither file is in this fix's blast radius,
// and re-pinning a suite this change did not author would hide the drift inside an
// unrelated commit. Owed as its own edit.
// ⚠ AND BY BUG-260807-02's KEYBOARD HALF (`/gsd:quick 260808-148`, 2026-08-08): 2664 →
// 2712 (`StepTypePicker.test.tsx` 52 → 68, `editAffordance.test.ts` 31 → 63). Pinned FILE
// count unmoved at 48 — both suites already existed and both already ran inside the
// `src/components/workflows` DIRECTORY entry. RE-DERIVED FROM THIS SCRIPT'S OWN PRINTED
// `total` after the two pins above were edited, never by adding 16 and 32 to 2664 — this
// note is prose beside a `reduce` and has gone stale seven times by being computed rather
// than read. The measured `actual` remains 2725, i.e. thirteen above the new pin: that is
// the SAME two pre-existing under-pins recorded in the paragraph above
// (`ExternalActionSection.test.tsx` +9, `PhaseTimeline.test.tsx` +4), unchanged by this
// work and still owed as their own edit.
// ⚠ AND BY 190-12 (CONN-02 / CONN-03): the pinned FILE count 48 → 49, `ConnectionPicker.test.tsx`
// (20) — the connection picker's net-new suite, pinned in the commit that created it. READ
// FROM THIS SCRIPT'S OWN PRINTED `pinned total` after the map entry above was added, across
// two agreeing runs (2739), never by adding 20 to a figure in this comment — which is what
// the paragraph above means when it says this note has gone stale seven times by being
// computed rather than read. IT WAS STALE AGAIN: the trailing marker below read `2712` while
// the reduce computed **2719** on an UNMODIFIED tree, so the correction rides here rather
// than being smoothed over. The +13 gap the two paragraphs above describe is UNCHANGED and
// still owed as its own edit — `ExternalActionSection.test.tsx` (25 pinned / 34 actual, +9)
// and `PhaseTimeline.test.tsx` (17 / 21, +4). 190-12 deliberately did not re-pin either:
// `ExternalActionSection.test.tsx` IS in this plan's blast radius, but its count is unmoved
// at 34 by the two-insertion mount, so re-pinning it here would fold an unrelated
// pre-existing drift into a commit that did not cause it.
// ⚠ AND BY 190-16 (CONN-02 / D-25): the pinned FILE count 49 → 50,
// `ConnectionsTab.test.tsx` (34) — the Settings → Connections suite, pinned in the commit
// that creates it, and the FIRST entry in this map whose file also required a `TARGETS`
// line (`src/components/settings/` is covered by nothing above — the two-knob rule).
// READ FROM THIS SCRIPT'S OWN PRINTED `pinned total` after the map entry landed, never by
// adding 34 to a figure in this comment — which is exactly what the paragraphs above mean
// when they say this note has gone stale eight times by being computed rather than read.
// The +13 gap those paragraphs describe is UNCHANGED and still owed as its own edit:
// `ExternalActionSection.test.tsx` (25 pinned / 34 actual, +9) and `PhaseTimeline.test.tsx`
// (17 / 21, +4). 190-16 deliberately re-pins neither — both sit outside this plan's blast
// radius entirely, and folding an unrelated pre-existing drift into a commit that did not
// cause it is the thing this whole header argues against.
// ⚠ AND BY 190-15 (CONN-02, the credential check): `ConnectionsTab.test.tsx` 34 → 36. The
// two new cases are `?raw` source fences over the CONTAINER, which the 34 shipped cases
// structurally could not see — they all render `ConnectionsTabView` with props, and were
// green for the whole of 190-16 while `Check credential` was absent from the running app
// because the container passed no `onCheck`. Both were driven RED against real plants in
// `ConnectionsTab.tsx` (the wiring removed; the handler flipping local state instead of
// re-fetching), one case each, file restored md5-identical. The +13 gap above is STILL
// unchanged and still owed as its own edit — 190-15 re-pins neither of those two files, for
// the same reason 190-12 and 190-16 did not.
// ⚠ AND BY 192-01 (Phase 192 Wave 0): the pinned FILE count 51 → 55, adopting the four suites
// that render the LIVE `WorkflowsPage` — `WorkflowsPage.test.tsx` (23), `RunModal.test.tsx`
// (11), `RunModal.a11y.test.tsx` (8), `PublishedCardDelete.test.tsx` (7). All four also
// required a `TARGETS` line in this same commit (the two-knob rule; see the map entries and
// the TARGETS block below).
//   ⚠ IT WAS STALE AGAIN, AND BY THE LARGEST MARGIN YET — the trailing marker below read
//   `2775` while the reduce computed **2838** on an UNMODIFIED tree, a 63-test gap accrued
//   since 190-15. That correction rides here rather than being smoothed over, and it is now
//   the NINTH time this note has gone stale by being computed rather than read. The new
//   figure `2887` was READ FROM THIS SCRIPT'S OWN PRINTED `pinned total` across two agreeing
//   runs after the four map entries landed — never by adding 49 to a figure in this comment.
//   The +24 gap the run still prints is PRE-EXISTING drift this plan did not cause and
//   deliberately does not re-pin: `ExternalActionSection.test.tsx` (25 pinned / 34 actual,
//   +9) and `PhaseTimeline.test.tsx` (17 / 21, +4) — the same two owed since 190-12 — plus
//   `WorkflowBuilderPage.canvas.test.tsx` (128 / 133, +5) and `builderStore.test.ts`
//   (52 / 58, +6), both newly observed here and both outside Phase 192's blast radius.
//   Folding an unrelated drift into a commit that did not cause it is the thing this whole
//   header argues against.
// ⚠ AND AGAIN BY 192-01 TASK 2, in the very next commit: the pinned FILE count 55 → 56,
// `WorkflowBuilderPage.session.test.tsx` (23) — the fifth `WorkflowsPage`-covering suite, and
// the one whose adoption needed assumption A6 measured first (see the map entry and the
// TARGETS block). The figure `2910` was CHECKED AGAINST this script's own printed
// `pinned total` across two agreeing runs after the map entry landed, and the honest sequence
// is recorded rather than implied: it was written as an EXPECTATION (2887 + 23) and then
// falsified against the printed column — it agreed. Had the two disagreed, the printed value
// is what stays; an expectation that survives a measurement is still only worth the
// measurement. That is the whole difference between this note and the previous NINE times it
// went stale by being computed and never checked. The pre-existing +24 drift named in the
// paragraph above is UNCHANGED and still deliberately not re-pinned here.
// ⚠ AND BY 192-12 (Phase 192 Wave 8, the closing commit): the pinned FILE count 56 → 60 and
// the pinned total 2909 → **3151**, from the four suites this phase CREATED
// (`librarySubtree.fences.test.ts` 64, `libraryFilter.test.ts` 36, `LibraryToolbar.test.tsx`
// 36, `WorkflowCard.test.tsx` 35) plus the four RAISES owed by suites it GREW
// (`WorkflowsPage.test.tsx` 22→39, `PublishedCardDelete.test.tsx` 7→32, `RunModal.test.tsx`
// 11→32, `RunModal.a11y.test.tsx` 8→16). The full argument is in the 192-12 block inside the
// map above.
//   ⚠ AND IT WAS STALE AGAIN — THE TENTH TIME, and by the SMALLEST margin yet, which is the
//   most useful kind: the trailing marker read `2910 (192-01)` while the gate printed
//   `pinned total 2909` on an UNMODIFIED tree, a drift of ONE. 192-01's own note explains
//   how: it wrote 2910 as an EXPECTATION (2887 + 23), said it had been checked against the
//   printed column, and recorded that "an expectation that survives a measurement is still
//   only worth the measurement". The measurement was 2909. A drift of 1 is invisible to
//   every reader and to every check, because `BASELINE_TOTAL` is the `reduce` and this line
//   is prose beside it — which is precisely the argument, not a counterexample to it.
//   `3151` below is READ from this script's own printed `pinned total`, on two agreeing
//   runs, in the SAME COMMIT as the eight pins that moved it.
//   ⚠ The run still prints `total 3175`, i.e. **+24 above the pin**, and that gap is NOT this
//   phase's: it is the four pre-existing drifts named at the foot of the map
//   (`ExternalActionSection` +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5,
//   `builderStore` +6). 24 cases are deletable with this gate green today. Owed as its own
//   edit, deliberately not absorbed here.
//   ⚠ THE `failed` LINE VARIED AND IS NOT SMOOTHED: three consecutive runs of this gate on
//   the SAME tree printed `failed 0`, `failed 1`, `failed 0` with IDENTICAL per-file count
//   columns on all three. That is D-188.2-DEF-01 recurring, and 192-01's standing
//   instruction covers it — the suite it names (`WorkflowBuilderPage.session.test.tsx`,
//   the "pane click" case) was re-run standalone here and reported 23 passed / 0 failed.
//   THE COUNT COLUMNS ARE THE REGRESSION BACKSTOP; the `failed` line, on this machine, is not.
// ⚠ AND BY 192-16 (GAP-CLOSURE ROUND 1, wave 4): the pinned total → **3164**, pinned FILE
// count UNMOVED at 60 — both raised suites were already pinned and already ran. READ from this
// script's own printed `pinned total` AFTER the two map entries above were edited, never by
// adding 12 to a figure in this comment, which is what the eleven paragraphs above mean when
// they say this note goes stale by being computed rather than read.
//   ⚠ AND IT WAS STALE AGAIN — the ELEVENTH time, and again by ONE: the trailing marker read
//   `3151 (192-12)` while the gate printed `pinned total 3152` on an UNMODIFIED tree. The
//   missing one is CR-01's own extra case (`WorkflowsPage.test.tsx` 39 → 40, commit
//   `60b8842f`), raised in the fix's commit AFTER 192-12 wrote this line. Corrected here
//   rather than smoothed over.
//   ⚠ THE +36 GAP THIS ROUND OPENED IS NOW DECOMPOSED, AND THE GATE ITSELF IS THE PROOF —
//   not arithmetic. Before this edit the run printed `total 3188 · pinned 3152 · +36`, which
//   is TWENTY-FOUR MORE than the +12 these two suites explain. It is NOT a mystery and NOT
//   this round's: it is the same four PRE-EXISTING drifts named at the foot of the map
//   (`ExternalActionSection` 25/34 +9 and `PhaseTimeline` 17/21 +4, owed since 190-12;
//   `WorkflowBuilderPage.canvas` 128/133 +5 and `builderStore` 52/58 +6, first seen at
//   192-01), every one of them printed in the gate's own highlighted rows on both runs.
//   After the two pins above landed, the SAME tree printed `+24` — the delta fell by exactly
//   the 12 that were pinned, which is the measurement that closes the question. **24 cases
//   remain deletable with this gate green today.** Deliberately NOT absorbed here: re-pinning
//   four suites this round did not author would fold unrelated drift into a commit that did
//   not cause it — the thing this whole header argues against, and the reason 190-12, 190-15,
//   190-16, 192-01 and 192-12 each declined the same four. Owed as its own edit.
// ⚠ AND BY 192.1-05 (wave 4): the pinned total → **3343**, pinned FILE count 62 → **63** (the new
// `rowIdentity.test.ts`). READ from this script's own printed `pinned total` after the two map
// entries above were edited, across two agreeing runs — never computed from the marker below.
//   ⚠ AND THE MARKER WAS STALE AGAIN — the TWELFTH time, and this time by SEVENTY-SIX, which is
//   the largest drift it has carried. It read `3164 (192-16)` while an UNMODIFIED tree at this
//   phase's base printed `pinned total 3240`. The 76 are this phase's own earlier waves
//   (192.1-03's `libraryFork.test.ts` 11 and the fences 64 → 67 → 77; 192.1-04's
//   `relativeChanged.test.ts` 37 and the fences 77 → 80), every one of them correctly pinned in
//   its own commit while this reader-facing marker was left behind. It goes stale for exactly the
//   reason the paragraphs above give: it is a number written by hand next to a number computed by
//   `reduce`. Corrected on measurement rather than smoothed.
//   ⚠ THE +24 GAP IS UNCHANGED BY THIS PLAN AND IS STILL NOT ITS DEBT: it is the same four
//   pre-existing drifts (`ExternalActionSection` +9, `PhaseTimeline` +4,
//   `WorkflowBuilderPage.canvas` +5, `builderStore` +6) that 190-12, 190-15, 190-16, 192-01,
//   192-12 and 192-16 each declined for the same reason. It was +36 before 192-16 pinned 12, and
//   it read +127 mid-plan here only because this plan's own 103 new cases were not yet pinned;
//   after the two entries above it is back to exactly 24. Owed as its own edit (T-9).
// ⚠ AND BY 192.1-06 (wave 5): the pinned total → **3384**. ONE map entry moved
// (`WorkflowCard.test.tsx` 39 → 80); the pinned FILE count is UNCHANGED at 63, because this plan
// adds no module and therefore no new suite — the 14th atom lands in a file the gate already
// pinned. READ from this script's own printed `pinned total` after that entry was edited.
//   ⚠ THE MARKER WAS NOT STALE THIS TIME, and saying so is worth as much as the twelve times it
//   was: an UNMODIFIED tree at this plan's base printed `pinned total 3343`, exactly what the
//   line below claimed. 192.1-05 corrected it on measurement and the correction held for one
//   whole wave. The habit is what fixed it, not luck — so the habit is repeated here.
//   ⚠ THE +24 GAP IS STILL UNCHANGED AND STILL NOT THIS PLAN'S DEBT — the same four pre-existing
//   drifts, now declined by an eighth consecutive plan for the eighth identical reason (T-9). It
//   read +65 mid-plan here only because this plan's own 41 new cases were not yet pinned; after
//   the one entry above it is exactly 24 again, which is the measurement that closes the question.
// ⚠ AND BY 193-01 (wave 1, D-08): the pinned total → **3430**, the pinned FILE count 64 → 65
// (both READ from this script's own printed footer — it said `64/64 pinned files present`
// before the entry and `65/65` after; the 192.1-06 note above says 63, which was already one
// behind and is corrected here on measurement rather than inherited).
// ONE map entry is ADDED (`WorkflowDoorSwitch.baseline.test.tsx` 17, a file created in the same
// commit); nothing is lowered, nothing is deleted, and no existing pin moves — so no
// plan-authorised deletion needs to ride along.
//   ⚠ THE MARKER WAS STALE AGAIN — THE THIRTEENTH TIME — AND BY THE LARGEST MARGIN IN ITS
//   HISTORY: **29**. The trailing note below read `3384 (192.1-06)` while the gate printed
//   `pinned total 3413` on an UNMODIFIED tree at this plan's base (`501b3c14`). It is CORRECTED
//   HERE ON MEASUREMENT rather than overwritten in silence, which is this file's own habit: the
//   192.1-06 note above it says the marker "was NOT stale this time" and that the habit is what
//   fixed it — measured now, the habit lapsed on the very next commit that moved a pin. The
//   drift is invisible to every reader and to every check for the reason stated four times
//   above: `BASELINE_TOTAL` IS the `reduce`, and this line is prose beside a derived value —
//   which is the argument for deriving it, not a counterexample to it. Neither 3384 nor 3413 is
//   this plan's number: `3430` below is READ from this script's own printed `pinned total` after
//   the entry above was added.
//   ⚠ THE +24 GAP IS UNCHANGED AND IS STILL NOT THIS PLAN'S DEBT — the same four pre-existing
//   drifts a ninth consecutive plan declines for the ninth identical reason (`ExternalActionSection`
//   +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore` +6). It read +41
//   mid-plan here only because this plan's own 17 new cases were not yet pinned; after the one
//   entry above it is exactly 24 again, which is the measurement that closes the question.
// ⚠ AND BY 193-10 (wave 6, the phase's PIN SWEEP): the pinned total → **3533**, the pinned FILE
// count UNCHANGED at 67 (READ from this script's own printed footer, `67/67 pinned files present`
// both before and after — this plan creates no suite; it raises seven that Phase 193 GREW).
// SEVEN map entries move, every one of them an EXTENSION read off the `actual` column of the run
// that measured them, and NOT ONE is a lowering — so no plan-authorised deletion needs to ride
// along. `git diff` over the phase confirms no `it(` was removed from any of the seven:
//   · doorVocabulary.test.ts          9 → 39  (+30, 193-08 — column D, the codepoints, the fence)
//   · soulData.test.ts               17 → 33  (+16, 193-02 — templateAdmission's three states)
//   · WorkflowCard.test.tsx           80 → 90  (+10, 193-06 — the mark's slot and its two silences)
//   · RunModal.test.tsx               32 → 40   (+8, 193-01 + 193-07 — the launch-error guard)
//   · WorkflowDoorSwitch.test.tsx     28 → 33   (+5, 193-09 — D-22's cross-component equality)
//   · DoorHeaderStrip.test.tsx        12 → 16   (+4, 193-09 — the D-04 shape, both `inline` values)
//   · RunModal.a11y.test.tsx          16 → 20   (+4, 193-07 — D-18's label as a TEXT NODE)
//   ⚠ THE MARKER WAS STALE AGAIN — THE FOURTEENTH TIME — and by **26**: the line below read
//   `3430 (193-01)` while an UNMODIFIED tree at this plan's base (`294a2ac8`) printed
//   `pinned total 3456`. CORRECTED HERE ON MEASUREMENT rather than overwritten in silence, which
//   is this file's habit. The 26 are Phase 193's own middle waves, each correctly pinned in its own
//   commit while this reader-facing marker was left behind: 193-03's `DoorHeaderStrip.test.tsx` 12,
//   193-05's `doorVocabulary.test.ts` 9 and its `WorkflowDoorSwitch.test.tsx` 23 → 28 (+5). The
//   thirteenth event, three notes above, was recorded by 193-01 — and the marker went stale again
//   two commits later. That is the fourth consecutive phase in which the habit has lapsed on the
//   very next commit that moved a pin, which is the argument for DERIVING this line, not a
//   counterexample to it.
//   ⚠ A SECOND CORRECTION ON MEASUREMENT, AND IT IS AGAINST THIS PLAN'S OWN PLAN FILE:
//   `193-10-PLAN.md` § `<interfaces>` states the marker "reads `⚠ 3384 (192.1-06)`" and instructs
//   this plan to record the THIRTEENTH staleness event. Measured, both are one behind — 193-01 had
//   already corrected the marker to `3430` and had already recorded the thirteenth. A figure
//   written into a plan at planning time goes stale on that phase's own first commit, which is the
//   identical failure the ledger rows in `CLAUDE.md` correct about themselves.
//   ⚠ THE +24 GAP IS UNCHANGED AND IS STILL NOT THIS PLAN'S DEBT — the same four pre-existing
//   drifts a TENTH consecutive plan declines for the tenth identical reason (`ExternalActionSection`
//   +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore` +6). Measured at this
//   HEAD the gate printed `total 3557` against `pinned total 3456`, a gap of +101; after the seven
//   entries above (+77) it is exactly 24 again, which is the measurement that closes the question.
//   Re-pinning them HERE would fold unrelated drift into a commit that did not cause it. Owed as
//   its own edit (T-9), and stated so the decline reads as a decision rather than an oversight.
// ⚠ THE ANNOTATION ON THIS LINE WAS STALE BEFORE 193.1 OPENED, and it is corrected BESIDE the
// claimed value rather than over it — this repository's habit for a figure that rots.
// It read `3533 (193-10)`. Measured at 193.1-01's base `5333518b`, BEFORE this plan's own pin,
// this script printed `pinned total 3580` — already +47, from pins landed after 193-10 wrote the
// number. With 193.1-01's `+16` it prints **3596**. The value itself is DERIVED (the `reduce`
// above), so nothing behavioural ever depended on the annotation; what rotted is the only figure
// a reader could check against, which is exactly why it is worth correcting rather than deleting.
// Re-derive with: `node -e "const s=require('./scripts/vitest-count-gate.cjs')"` — or simply read
// the `pinned total` this script prints on any run.
// 193.1-05: 3596 → **3626**. The +30 is this plan's two knob moves and nothing else —
// `WorkflowDoorSwitch.test.tsx` 34 → 35 (+1, the fourth swept source's `it.each` row) and
// `useTemplateFirstDraft.test.tsx` 29 (new). The annotation is kept in step in the same commit
// that moves it, which is the whole point of the correction recorded above.
// ⚠ 3693 (193.1-06) — the PINNED sum, which is NOT the run total. The gate printed
// `total 3717 · pinned total 3693` on the run that set the four 193.1-06 pins; the 24-case gap
// is files inside TARGETS that carry no pin. Quoting the run total here would be quoting a
// different number for the same name, which is how an annotation goes stale on its own commit.
// ⚠ 3787 (193.1-07), against a run total of 3811 — kept in step in the commit that moves it,
// which is the whole point of the correction above. The +94 over 193.1-06's 3717 is: this
// plan's 29 new hook cases, its 6 new page cases, and **59 cases that already existed and
// which this gate had never once executed** — `useDraftPersistence.test.tsx` was in NEITHER
// knob until now (see its two entries below). The 24-case gap is UNCHANGED and is still the
// same four pre-existing drifts an eleventh consecutive plan declines for the same reason:
// re-pinning them here would fold unrelated drift into a commit that did not cause it.
// Measured twice at `GSD_VITEST_MAX_WORKERS=2` on 2026-08-15, both runs agreeing exactly
// (`total 3811 · failed 0`, identical per-file columns).
// ⚠ 3805 (193.1-08), against a run total of 3829 — kept in step in the commit that moves it.
// The +18 over 193.1-07's 3787 is EXACTLY this plan's two knob moves and nothing else:
// `WorkflowBuilderPage.describe.test.tsx` 19 → 30 (+11, the govern door's mount) and
// `WorkflowDoorSwitch.test.tsx` 37 → 44 (+7, the loose door's mount and the crossing). ⚠ The
// two BASELINE suites this plan re-captured did NOT move — `WorkflowDoorSwitch.baseline` stays
// 17 and `WorkflowBuilderPage.preDraft.baseline` stays 22, because a declared re-capture changes
// LITERALS, never the number of assertions; a movement there would have meant an assertion was
// added or dropped to make a capture pass. The 24-case gap is UNCHANGED and is still the same
// four pre-existing drifts a twelfth consecutive plan declines for the same reason.
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0)

// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  // Phase 226 (merge commit) — the public landing page: fence, facts, CSS-class lint, scenes, page.
  "src/landing",
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  "src/pages/WorkflowBuilderPage.canvas.test.tsx",
  "src/components/admin/revertByteIdentical.test.tsx",
  // Added in 184.1. This suite is the ONLY thing pinning the flag-off Builder header —
  // D-181-01's Builder half was unguarded until it existed — so leaving it outside the
  // gate's blast radius would mean the one guard for a byte-identity promise could be
  // deleted without the gate noticing. It was deliberately NOT added to BASELINE while its
  // count was still growing ("it postdates the 424 pin, so it reports as `new`"). CORRECTED
  // BY 188-12: it has stopped growing and is now PINNED at 27. An unpinned file is not a
  // lightly-guarded one, it is an unguarded one, and nothing ever expired the exemption.
  "src/pages/WorkflowBuilderPage.header.test.tsx",
  // Added post-round-5 (CR-R5-01 / verification truth 14). TARGETS and BASELINE are TWO
  // knobs: TARGETS decides what RUNS, BASELINE decides what is PINNED, and a page-level
  // suite lands outside BOTH by default because the directory entry above only covers
  // `src/components/workflows`. Round 5 pinned three suites and still left GAP A's only
  // end-to-end wire fence unguarded — this file was never even EXECUTED by the gate. That
  // is round-3's WR-16 recurring, so the fix is the entry, not another comment about it.
  "src/pages/WorkflowBuilderPage.describe.test.tsx",
  // ── Added in 193.1-01 (Wave 1, D-01/D-02) — and it needs BOTH knobs, which is the ────
  // ── difference from 193-01's entry and is MEASURED rather than assumed. ──────────────
  //
  // `193-01` created `WorkflowDoorSwitch.baseline.test.tsx` and needed a BASELINE entry
  // ONLY: it lives under `src/components/workflows`, which is a DIRECTORY entry at the top
  // of this list, so the gate executed it the moment it existed and printed
  // `— 17 new`. This file is the same KIND of suite and needs BOTH, because `src/pages` is
  // reached here by NAMED FILES ONLY — `WorkflowBuilderPage.test.tsx`, `.canvas.test.tsx`,
  // `.header.test.tsx`, `.describe.test.tsx`, `.session.test.tsx`, `WorkflowsPage.test.tsx`,
  // `WorkflowRunPage.test.tsx` — and there is NO `src/pages` directory entry anywhere in
  // this array. Verified by reading the array, not by belief: a new page-level suite is not
  // executed by this gate at all until it is named here, and **a file the gate never runs
  // has falsified nothing.**
  //
  // What would be unguarded without it: the SIX whole-`innerHTML` characterization captures
  // of the pre-draft describe screen (flag ON and OFF × `empty`/`composing`/`error`) taken
  // on the UNMOVED tree at `5333518b` — the only evidence Phase 193.1 will have that cutting
  // the pre-draft template-read concern out of `WorkflowBuilderPage.tsx` (both destination
  // modules proved nonexistent at that commit, exit 128) changed no pixel — plus the two
  // `/generate` KEY-SET assertions that pin the wire BEFORE `template_placeholders` is added
  // to it. Half of those rows are ABSENCE assertions, which is the easiest kind of case to
  // delete unnoticed.
  "src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx",
  // Phase 224-05 — THE CHAT/PANEL RUN SURFACE, ADOPTED. Measured 2026-09-03: the gate
  // RAN none of these and GUARDED none of them, so 224-05's own acceptance criterion
  // would have passed whether or not four of the phase's five plans worked. The Phase
  // 214 shape again: TARGETS decides what RUNS, BASELINE what is GUARDED, and these sat
  // outside BOTH. All six were green BEFORE adoption, so adoption cannot red the gate;
  // every count was read from a real run AFTER the edits landed, never guessed.
  "src/components/panel/__tests__/Seam.test.tsx",
  "src/components/panel/__tests__/TodosSection.test.tsx",
  "src/components/chat/__tests__/CitationList.test.tsx",
  "src/components/chat/RunCard.test.tsx",
  "src/components/chat/RunCard.timer.test.tsx",
  "src/components/chat/__tests__/ChatArea.approval.test.tsx",
  // ⭐ Added in 214.1-02 — THE SECOND KNOB for this phase's headline artefact, and it was
  // MEASURED to be needed rather than added by habit: the pre-edit gate run printed no row
  // whatsoever for this file, because `src/pages` is reached by NAMED FILES ONLY and there
  // is no `src/pages` directory entry. Contrast its wave-1 sibling
  // `DeclaredInputsEditor.test.tsx`, which was ALREADY executing under the
  // `src/components/workflows` directory entry and needed a pin alone. Two suites in one
  // phase, opposite answers — which is why the check is per file and never inferred.
  //
  // What would be unguarded without it: the ONLY test in this repository that walks an
  // EMPTY builder to a PUBLISHED workflow with a non-empty `definition.inputs[]` while
  // mocking NEITHER the store NOR any `@/lib/api` module. `BUG-260828-02` shipped through a
  // sixteen-plan phase with green gates precisely because every other test built
  // `definition.inputs[]` by hand, so this file is the phase's whole answer to *"could a
  // person actually do it?"* — plus three `?raw` self-fences (each with a positive control,
  // all three driven RED against planted defects) and a non-vacuity control. A reachability
  // proof the gate never executes has proved nothing.
  "src/pages/WorkflowBuilderPage.declaredInputs.test.tsx",
  // Added in 188-01 (Wave 0), for the same two-knob reason spelled out directly above and
  // for one more: `src/components/panel/__tests__/` lands outside BOTH knobs by default —
  // the directory entries above cover only `src/components/workflows` and three named
  // `src/pages/` files. Phase 188's Req-3 falsification test (the REACHABLE fail-open where
  // `finalizeAllPhasesForThread` sweeps `pending` → `done`) and its Req-1 developer-view
  // parity assertion are written INTO these two suites. Without these entries the gate would
  // never have EXECUTED either one, and a falsification test that does not run has falsified
  // nothing — verbatim the round-5 "verification truth 14" failure Phase 187 shipped and had
  // to fix afterwards.
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/panel/__tests__`. The
  // directory holds 12 suites; measured under plain vitest on 2026-08-05 it is
  // `12 passed (12) / 144 passed (144)` — i.e. 0 failing, so the directory form WOULD have
  // been admissible. It is still not taken: the gate requires 0 failing forever, and adopting
  // ten suites nobody in this phase reads makes this phase the owner of their future rot. A
  // later phase that wants CsvTablePreview / FilePreview / FilesSection / PendingAskCard /
  // Seam / TodosSection / VersionDiff / WorkspacePanel{,.derived} inside the gate should adopt
  // them deliberately, with its own measured number.
  "src/components/panel/__tests__/PhaseReconcile.test.tsx",
  "src/components/panel/__tests__/PhaseTimeline.test.tsx",
  // Added in 188-05, in the SAME COMMIT that creates the file — never earlier (a
  // TARGETS entry pointing at a path that does not exist yet makes the gate ERROR, not
  // fail) and never later (the two-knob trap above, third occurrence). `src/lib/`
  // lands outside BOTH knobs by default: the directory entries above cover only
  // `src/components/workflows`, four named `src/pages/` files and two named
  // `src/components/panel/__tests__/` files. Without this entry `phaseState.test.ts`
  // would never be EXECUTED by the gate, and Req 8's zero-re-derivation source fence —
  // the ONLY mechanical thing standing between the shared derivation and a second copy
  // of it appearing in the canvas tree — would be deletable with the gate green.
  // FILE-LEVEL, deliberately NOT the bare directory `src/lib`: it holds ten other
  // suites this phase does not read, and adopting them would make this phase the owner
  // of their future rot (the same reasoning recorded for the panel directory above).
  // Left OUT of BASELINE while its count was still growing. PINNED at 34 by 188-12 (not
  // 188-11 as this comment used to say — the pinning plan is 188-12), from the printed
  // `actual` column across two agreeing runs.
  "src/lib/phaseState.test.ts",
  // Added 2026-08-25 in the SAME COMMIT that creates the file — the two-knob trap, again,
  // and this time pre-empted rather than recorded after the fact. `fileTypeMark.test.tsx`
  // guards the OFFICIAL file-type marks on the documents surface; unpinned it would be the
  // `McpToolPicker.test.tsx` state this script already records, where an entire suite can be
  // deleted with the gate green. FILE-LEVEL for the same reason as its neighbours above.
  "src/lib/__tests__/fileTypeMark.test.tsx",
  // Added in 188-08, in the SAME COMMIT that creates the file — the fourth occurrence of
  // the SAME two-knob trap, so this comment records the rule rather than the incident:
  //
  //   TARGETS decides what RUNS. BASELINE decides what is PINNED. They are two knobs and
  //   a file can land outside BOTH by default, which is what happened to
  //   `WorkflowBuilderPage.describe.test.tsx` (round 5), to the two panel suites (188-01)
  //   and to `phaseState.test.ts` (188-05). `src/pages/` is covered ONLY by named files:
  //   the directory holds nine suites the green gate has never executed, so a page-level
  //   suite is invisible to the gate until its own entry exists.
  //
  // And the timing is not cosmetic: an entry pointing at a path that does not exist yet
  // makes the gate ERROR (exit 2), not fail — so it can only be added in the commit that
  // creates the file, never before, never after.
  //
  // What would be unguarded without it: this suite carries the ONLY mechanical fences for
  // the `phase_index` join (D-188-01 — a slug-keyed join silently misses every
  // not-yet-started node mid-run), for the run band's totality (an unrecognised
  // `workflow_runs.status` must never read as success), and for the `claimed_at == null`
  // no-number rule. All three are ABSENCE assertions, which are the easiest kind to
  // delete unnoticed.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/pages` — see the same reasoning
  // recorded for `src/components/panel/__tests__` and `src/lib` above. Left OUT of
  // BASELINE while its count was still growing — and it DID grow, 45 → 60 when 188-10
  // filled the deliverable region. PINNED at 60 by 188-12 from this script's printed
  // `actual` column across two agreeing runs. (188-08's closing note said "pin at 45";
  // that is exactly why a pin is read at the END, from a measurement, not booked ahead.)
  "src/pages/WorkflowRunPage.test.tsx",
  // Added in 188-09, in the SAME COMMIT that creates the file — the FIFTH occurrence of
  // the two-knob trap the entry above states as a rule. `src/components/layout/` lands
  // outside BOTH knobs by default: nothing above covers it, so the layout directory's
  // suites have never been executed by this gate. The rule, restated so it survives a
  // future reader who skips the block above: TARGETS decides what RUNS, BASELINE decides
  // what is PINNED, a file can be outside BOTH, and an entry pointing at a path that does
  // not exist yet makes the gate ERROR (exit 2) rather than fail — so the entry can only
  // be added in the commit that creates the file.
  //
  // What would be unguarded without it: this suite is the ONLY mechanical fence for the
  // launch path. It pins (a) that launching lands on the run and never on chat, (b) that
  // the thread is still created and still anchors the run — the guard against
  // OVER-deleting `doRun`'s surviving half, (c) the id trap, where two differently-typed
  // ids share the name `run_id` and BOTH ARE BARE UUIDS so the compiler cannot help, and
  // (d) the positional-fallback hazard, where an `ActiveView` member with no branch of its
  // own renders Knowledge Health silently. (b), (c) and (d) are ABSENCE assertions.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/layout` — the same
  // reasoning recorded for `src/components/panel/__tests__`, `src/lib` and `src/pages`
  // above: the directory holds suites this phase does not read (NavPanel, ProfileMenu,
  // orgRefetch, and the Phase-121 launch suite under `__tests__/`), and adopting them
  // would make this phase the owner of their future rot. Left OUT of BASELINE while its
  // count was still growing; PINNED at 12 by 188-12 from this script's printed `actual`
  // column across two agreeing runs.
  "src/components/layout/ChatLayout.launch.test.tsx",
  // ⚠ ADOPTED 2026-09-01 — it was in NEITHER knob, and the change that found it is the
  // kind the gate exists to watch: Connections moved out of Settings into its own page,
  // which deleted a tab, retired a routing key and re-pointed the persisted-tab fallback.
  // Four existing tests went RED and two new guards were driven RED against a planted
  // empty `RETIRED_TABS` — and NONE of that was visible to the gate, because this suite
  // has never been run by it. Same pattern BUS-040 recorded for three chat suites, one of
  // which had been red for hours unseen.
  // ⚠ No bareName collision: the sibling is `SettingsPage.a11y.test.tsx`, a distinct key.
  "src/pages/SettingsPage.test.tsx",
  // ── ADOPTED 2026-09-11 (Phase 242) — THREE MORE SettingsPage SUITES. ──────────────────────
  // ⚠ THE FINDING THAT FORCED IT: `grep -n "SettingsPage" scripts/vitest-count-gate.cjs`
  // returned exactly TWO hits before this commit — the BASELINE key and the TARGETS path
  // directly above — while `src/pages/__tests__/` held two more SettingsPage suites that had
  // NEVER RUN UNDER THE GATE. `src/pages` is not a directory entry here, so a file-level list
  // is the only thing that reaches them, and nobody had added them.
  // ⛔ AND ONE OF THEM WAS RED. `SettingsPage.a11y.test.tsx` failed all four of its cases —
  // proven inherited at the phase's base commit, with Phase 242's own `SettingsPage.tsx`
  // stashed away. The cause was in the SUITE, not the page: its `renderSettings` lacked
  // `EffectiveFeaturesProvider`, and SettingsPage renders the AI Model / Search / Integrations
  // tabs only when `model_management` resolves true, so every case audited a page whose tab
  // never mounted. Repaired in the same commit, because pinning a red suite turns the shared
  // gate red and pinning it with an allowance makes a gate that cannot fail (the Phase 235
  // decision on `sourceComposition.test.tsx`, applied in the other direction).
  // ⭐ Adoption RAISES the total. That is the desirable direction and is not drift.
  "src/pages/__tests__/SettingsPage.a11y.test.tsx",
  "src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx",
  // Phase 242's own suite — the changed-fields-only payload fence (D-242-02). Registered in
  // BOTH knobs in the SAME commit: a BASELINE key naming a file that does not exist makes the
  // gate exit 2 and halts every agent.
  "src/pages/__tests__/SettingsPage.changedFields.test.tsx",
  // Added in 188-10 — and this one is an ADOPTION, not a new file, which is the case the
  // panel-directory comment above explicitly reserved: "a later phase that wants
  // WorkspacePanel inside the gate should adopt it deliberately, with its own measured
  // number." That is what this is. MEASURED FIRST, before the decision: the shipped suite
  // ran `1 passed (1) / 31 passed (31)` under plain vitest on 2026-08-05, i.e. zero
  // pre-existing failures — so adopting it imports no rot into a gate that requires 0
  // failing forever. Had it been red, the seam guard would have gone into a fresh
  // `WorkspacePanelRunSeam.test.tsx` instead and THAT file would be the entry here.
  //
  // What would be unguarded without it: the THREAD side of D-188-13's bidirectional seam
  // — the only route back to a finished run while `GET /runs` and the cross-workflow runs
  // home are deferred and the app has no router. Its four load-bearing cases are ABSENCE
  // assertions (renders nothing with no callback, nothing on a Deep thread, nothing with
  // no anchor, nothing when the anchor read fails), plus the wrong-id guard where the
  // panel's workflow lock holds a PRODUCER run id and both ids are bare uuids.
  //
  // Left OUT of BASELINE while its count was still growing; PINNED at 39 by 188-12 from
  // this script's printed `actual` column across two agreeing runs — which is exactly the
  // 31 shipped + 8 added here that 188-10 predicted, but the pin is the MEASUREMENT, not
  // the prediction it happens to agree with.
  "src/components/panel/__tests__/WorkspacePanel.test.tsx",
  // ── Added in 193.1-07 (D-06 / D-25, threat T-193.1-07-01), in the SAME COMMIT as its ──
  // ── BASELINE pin — the SEVENTH occurrence of the two-knob trap the entries above ──────
  // ── state as a rule, and the FIRST one on `src/hooks/`, which is covered by NOTHING. ──
  //
  // MEASURED BEFORE THIS LINE WAS WRITTEN, not assumed: a grep for that directory name over
  // this whole script returned NOTHING, and `useDraftPersistence.test.tsx` appeared in neither
  // the `TARGETS` array nor the `BASELINE` map. **The gate did not EXECUTE this suite at
  // all** —
  // 55 shipped cases, none of them ever run by the gate, guarding Phase 186's entire autosave
  // estate. A test that does not run has falsified nothing (verbatim Phase 187's round-5
  // "verification truth 14"), and this is by some distance the largest such file the gate has
  // been blind to since 188-12 closed the last five.
  //
  // What would be unguarded without it, from THIS plan alone: `onDraftCreated` LOOKS like a
  // fire-and-forget notification and is not — it is invoked INSIDE the create branch's `try`,
  // whose `catch` turns anything thrown into a save REFUSAL and, for a terminal-shaped error,
  // sets a halt flag nothing in the session clears. Phase 193.1 makes that reachable for the
  // first time by binding a held document there (D-06). The four new cases are the hazard
  // CHARACTERIZED (a synchronous throw really does produce a false save-error for a row that
  // WAS created), the shipped guard proved clean on all three properties, the not-awaited
  // property, and a source fence over the call site — the last two OBSERVED RED against a real
  // planted `await` at `:645`, restored to the identical blob.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/hooks` — the same reasoning recorded
  // for `src/components/panel/__tests__`, `src/lib`, `src/pages` and `src/components/layout`
  // above. That directory holds dozens of suites this phase does not read, and adopting them
  // would make this phase the owner of their future rot; the gate requires 0 failing forever.
  // A later phase that wants them inside the gate should adopt them deliberately, with its own
  // measured number.
  "src/hooks/useDraftPersistence.test.tsx",
  // Added in 190-16, in the SAME COMMIT that creates the file — the SIXTH occurrence of
  // the two-knob trap the entries above state as a rule, and the first one on
  // `src/components/settings/`, which is covered by NOTHING above: the directory entries
  // reach only `src/components/workflows`, five named `src/pages/` files, three named
  // `src/components/panel/__tests__/` files, one `src/lib/` file and one
  // `src/components/layout/` file. Measured before this line was written: the gate's
  // printed file list did NOT contain `ConnectionsTab.test.tsx`, so without this entry the
  // suite would never be EXECUTED by the gate — and a falsification that does not run has
  // falsified nothing (verification truth 14, round 5 of Phase 187).
  //
  // ⚠ THE TIMING IS NOT COSMETIC: an entry pointing at a path that does not yet exist makes
  // the gate ERROR (exit 2) rather than fail, so it can only land in the commit that creates
  // the file — never before, never after.
  //
  // What would be unguarded without it: the whole Settings → Connections honesty estate.
  // Seven of its cases are ABSENCE assertions, which are the easiest kind to delete
  // unnoticed — the non-admin Add button being ABSENT rather than `disabled` (U-02: a
  // `toBeDisabled()` assertion would PASS on the defect), the OFF banner appearing ZERO
  // times on a row (D-26), no `[title]` node anywhere (142-B), no secret-shaped key in the
  // markup (T-190-16-T7), no toast mounted (062-A), the `Check credential` item being
  // removed rather than inert, and both no-victim direct flips opening NO dialog. Each of
  // the seven was driven RED against a real plant in production source before this pin
  // existed, and the file was restored md5-identical after each (see `190-16-SUMMARY.md`).
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/settings` — the same
  // reasoning recorded for the panel directory, `src/lib`, `src/pages` and
  // `src/components/layout` above. The directory holds three suites this plan does not
  // read (`EngineHealthCard`, `JudgeModelPicker`, `ModelDefaultPreference`), and adopting
  // them would make this phase the owner of their future rot.
  "src/components/settings/__tests__/ConnectionsTab.test.tsx",
  // Added in 190-17, in the SAME COMMIT that creates the file — the SEVENTH occurrence of
  // the two-knob trap, and the second on `src/components/settings/`. The entry directly
  // above is FILE-LEVEL, not a directory entry (deliberately, so this phase does not become
  // the owner of `EngineHealthCard` / `JudgeModelPicker` / `ModelDefaultPreference`'s future
  // rot), which means a SECOND file in that same directory is still invisible to the gate.
  //
  // MEASURED BEFORE THIS LINE WAS WRITTEN rather than assumed: the gate was run with the
  // suite already on disk and green, and `ConnectionFormPanel.test.tsx` did NOT appear in
  // its printed file list — 50/50 pinned files, total 2788, the suite absent. A
  // falsification that does not run has falsified nothing (verification truth 14, round 5
  // of Phase 187).
  //
  // ⚠ THE TIMING IS NOT COSMETIC: an entry pointing at a path that does not yet exist makes
  // the gate ERROR (exit 2) rather than fail, so it can only land in the commit that creates
  // the file — never before, never after.
  "src/components/settings/__tests__/ConnectionFormPanel.test.tsx",
  // ── Added 2026-09-05 with `ReembedConfirmModal.test.tsx` — the SAME two-knob reason the
  //    entries above give: every `src/components/settings/` entry here is FILE-LEVEL, so a
  //    new file in that directory is invisible to the gate until it is named. TARGETS decides
  //    what RUNS; BASELINE decides what is GUARDED, and this suite needed both.
  //
  //    What it guards is worth stating, because it is not ordinary coverage: until this
  //    commit the re-embed confirm modal rendered "Resumable & non-destructive" for a
  //    DIMENSIONS change, which is the one case where every vector is destroyed up front by
  //    resize_embedding_column. The four destructive cases were driven RED against the
  //    pre-fix component (4 failed / 3 passed) and the component restored before commit — a
  //    guard nobody has seen fire is not a guard.
  "src/components/settings/__tests__/ReembedConfirmModal.test.tsx",
  // ── Added in 206.1-01 (item 3, the per-service mark map) — the THIRD entry on
  //    `src/components/settings/`, for the identical reason the two above give: those two
  //    are FILE-LEVEL, so a THIRD file in that directory is still invisible to the gate.
  //
  // MEASURED BEFORE THIS LINE WAS WRITTEN rather than assumed. The gate was run with the
  // suite already on disk and green (39 passing), and its printed `running: npx vitest run …`
  // line did NOT contain `connectionMark.test.tsx`: the grand total moved 5467 → 5472, i.e.
  // by the FIVE cases added to `ConnectionsTab.test.tsx` and by NONE of this suite's 39. A
  // falsification that does not run has falsified nothing (verification truth 14).
  //
  // ⚠ AND THE TIMING RULE ABOVE WAS MISSED BY ONE COMMIT — recorded rather than tidied
  // away. The blocks above say an entry *"can only land in the commit that creates the file
  // — never before, never after"*; this one lands one commit after `ae8a2359`, because the
  // gap was found by reading the gate's own arithmetic at the plan's verification step
  // rather than at the file's creation. The `never before` half is mechanical (an entry for
  // a non-existent path makes the gate exit 2); the `never after` half is discipline, and
  // this is what breaking it looks like. Landing it late is strictly better than leaving
  // the file unguarded — *"an unpinned file is not a lightly-guarded one, it is an
  // UNGUARDED one"* (196-05 / 196-07).
  //
  // What would be unguarded without it: the whole of SC#3. TWENTY-ONE of the 39 cases are
  // ABSENCE or NEGATIVE assertions — the two wordmark slugs never imported and the absent
  // `jira` variant never tried, the coalesced bracket read absent from the source, the
  // compiles-to-nothing utility absent, an inherited key never resolving to a mark, the
  // brand marks carrying NO colour utility, the lucide glyphs carrying NO fill utility (a
  // CSS fill on a lucide root beats its presentation attribute and turns the outline into a
  // blob), and `capability: null` alone never resolving MCP. Each is the kind that deletes
  // unnoticed, and three of them guard properties that exist NOWHERE else in the tree: the
  // ink contract, the wordmark refusal, and the MCP arm's own-condition rule.
  //
  // ⚠ REPOINTED IN 214-08 — A PATH KNOB, MOVED WITH ITS FILE. `connectionMark.tsx` and its
  // suite moved from `components/settings/` to `src/lib/` (D-214-17: the mark is a REUSE, and
  // its consumer set went from one surface to six). This entry is a PATH, so it does not
  // follow a `git mv` on its own — and a pinned file the gate cannot FIND fails
  // `N/N pinned files present`, which reads as a test failure and is a path edit.
  //
  // ⚠ THE `BASELINE` KEY NEEDED NO EDIT AND THAT WAS CHECKED RATHER THAN ASSUMED: baseline
  // keys are BASENAMES (`connectionMark.test.tsx`), matched against the report's own file
  // names, so the pin of 39 still resolves after the move. TWO knobs, only ONE of which is
  // location-sensitive — the asymmetry the blocks above describe, seen from the other side.
  //
  // ⚠ AND `src/lib` HAS NO DIRECTORY ENTRY ANYWHERE IN THIS ARRAY, so the suite would have
  // gone UNRUN rather than merely unpinned had this line been deleted instead of repointed.
  "src/lib/__tests__/connectionMark.test.tsx",
  // ── Added in 211-05 (Task 1(c), SC#3) — the FOURTH entry on `src/components/settings/`,
  //    for the identical reason the three above give: every one of them is FILE-LEVEL, so a
  //    fourth file in that directory is reached by none of them.
  //
  // MEASURED BEFORE THIS LINE WAS WRITTEN rather than assumed. The gate was run from the repo
  // root with the suite already on disk and green (21 passing), and its printed file list did
  // NOT contain `connectionVerbFence.test.ts` at all — while its sibling
  // `connectionCardReachability.test.tsx` DID appear, as `— 10 new`, because that one sits
  // under the `src/components/workflows` DIRECTORY entry above and so ran the moment it
  // existed. That contrast is the measurement: same phase, same commit, two new files, and
  // only ONE of them needed this knob. A falsification that does not run has falsified
  // nothing (verification truth 14).
  //
  // ⚠ THE TIMING IS NOT COSMETIC: an entry pointing at a path that does not yet exist makes
  // the gate ERROR (exit 2) rather than fail, so it can only land in the commit that creates
  // the file — never before, never after.
  //
  // What would be unguarded without it: the whole of SC#3 — *"browsing, filtering and picking
  // never offer Message / Ticket / Email as a category"*. The suite is a SOURCE fence over
  // BOTH `src/components/settings/**` and `src/components/workflows/**`, so it is the only
  // artifact in the tree that proves that absence anywhere other than on a surface some test
  // happened to mount.
  "src/components/settings/__tests__/connectionVerbFence.test.ts",
  // ── Added in 192-01 (Phase 192 Wave 0, the FIRST commit of the phase) ──────────────
  // The EIGHTH occurrence of the two-knob trap, and the first one that lands on the very
  // file the phase exists to rewrite. Stated as the rule rather than as an incident, for a
  // reader who skips every block above: TARGETS decides what RUNS, BASELINE decides what is
  // PINNED, and a file can sit outside BOTH by default.
  //
  // WHICH EXISTING ENTRY FAILED TO COVER THESE FILES — measured, not assumed, from the
  // gate's own printed `running: npx vitest run …` line on an unmodified tree (2026-08-10):
  //   · the DIRECTORY entries above reach `src/components/workflows` only;
  //   · `src/pages/` is reached by FIVE NAMED FILES (`WorkflowBuilderPage.test.tsx`,
  //     `.canvas.test.tsx`, `.header.test.tsx`, `.describe.test.tsx`,
  //     `WorkflowRunPage.test.tsx`) — `WorkflowsPage.test.tsx` is not one of them;
  //   · `src/pages/__tests__/` is reached by NOTHING AT ALL — no entry above names that
  //     directory or any file inside it.
  // So all four suites below were absent from the gate's printed file list, and the gate had
  // never EXECUTED one of them.
  //
  // CONSEQUENCE, stated plainly (192-RESEARCH.md § "THE eighth two-knob trap"): 74 of the 123
  // tests covering the surface Phase 192 rewrites were invisible to this gate, 49 of them
  // covering the library view directly. Phase 192's D-01 is a structural restructure of
  // `WorkflowsPage.tsx` (1407 L, 21 commits, 10 phases) that deletes card components and
  // rewrites testids — exactly the shape of change that drops an `it()` unnoticed. Without
  // these entries that deletion leaves the gate green, which is verbatim the Phase-177 lesson
  // this script exists for and the round-5 "verification truth 14" failure Phase 187 had to
  // fix afterwards.
  //
  // ⚠ TIMING: all four files EXIST at this commit (confirmed with `ls` before the entries
  // were written), so they are adopted here rather than in a later commit. An entry pointing
  // at a path that does not exist makes the gate ERROR (exit 2), not fail — so any NEW suite
  // Phase 192 creates must get its entry in the commit that creates the file.
  //
  // ⚠ ADOPTING IMPORTS NO ROT: measured before these lines were written — the gate ran green
  // with 0 failing on the unmodified tree, and re-ran green with 0 failing once these four
  // were inside TARGETS.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/pages/__tests__` — the same
  // reasoning this script already records for `src/components/panel/__tests__`, `src/lib`,
  // `src/pages`, `src/components/layout` and `src/components/settings`: the directory holds
  // suites this phase does not read, and adopting them would make this phase the owner of
  // their future rot. A later phase that wants them should adopt them deliberately, with its
  // own measured number.
  //
  // ⚠ Phase 192 WILL LOWER `WorkflowsPage.test.tsx`'s pin when D-01 deletes the shelf-order
  // tests. That lowering rides in the SAME COMMIT as the deletion, at a number read from this
  // script's own `actual` column — never to make a red gate go quiet.
  "src/pages/WorkflowsPage.test.tsx",
  "src/pages/__tests__/RunModal.test.tsx",
  "src/pages/__tests__/RunModal.a11y.test.tsx",
  "src/pages/__tests__/PublishedCardDelete.test.tsx",
  // ── Also 192-01 (Task 2), the FIFTH covering suite — and the one adoption in this ──────
  // ── phase that required a measurement of its own before it could be trusted. ──────────
  //
  // `WorkflowBuilderPage.session.test.tsx` renders the LIVE `WorkflowsPage` THREE times
  // (`:482`, `:510`, `:768`) and was pinned by nothing: `src/pages` is reached only by named
  // files above, and this one was not among them. An unpinned covering suite is an UNGUARDED
  // one, not a lightly-guarded one — the 188-12 statement, applied here.
  //
  // ⚠ RESEARCH ASSUMPTION A6, RECORDED BEFORE THE PIN RATHER THAN AFTER IT
  // (192-RESEARCH.md § "Assumptions Log" A6 / Pitfall 7): this suite's "pane click" case was
  // measured timing out at **5060 ms against a 5000 ms limit** under `--maxWorkers=4` in a
  // mixed eight-file run, and PASSING on re-run of the same set. That is a parallel-load
  // flake, NOT latent rot, so the adoption is expected to import ZERO rot.
  // CONFIRMED BEFORE PINNING, per the plan: the suite was run standalone TWICE with
  // `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4`, and both runs reported
  // `1 passed (1) / 23 passed (23)` — zero failures, the flake did not reproduce.
  // THE STANDING INSTRUCTION FOR THE REST OF PHASE 192: if "pane click" reds, RE-RUN before
  // declaring red. A consistent red is a PRE-EXISTING flake to re-run, not a regression this
  // phase introduced and not a defect to chase.
  //
  // ── DECLINED, with its reason, so a decline can never read as an oversight ────────────
  // `src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` (2 tests) is DELIBERATELY NOT
  // adopted — into neither TARGETS nor BASELINE. It reaches `WorkflowsPage` only transitively
  // through `ChatLayout`, its two cases are owned by the LAYOUT concern rather than the
  // library one, and `ChatLayout`'s own launch contract is already pinned by
  // `ChatLayout.launch.test.tsx` (17, adopted at 188-09). Adopting it would make Phase 192
  // the owner of the layout directory's future rot for two tests that assert nothing about
  // the library IA. This script's own adoption rule requires a stated reason either way: a
  // decline with no recorded reason is indistinguishable from an oversight, which is exactly
  // the failure mode the rule exists to prevent. A later phase touching the layout launch
  // seam should adopt it deliberately, with its own measured number.
  "src/pages/WorkflowBuilderPage.session.test.tsx",
  // ── Added in 195-02 (Phase 195 Wave 1), FIVE file-level entries, in the SAME ─────────
  // ── COMMIT as the BASELINE pins below and as the suite this plan created. ───────────
  //
  // ⚠ PHASE 195 IS THE "LATER PHASE" THE COMMENT AT THE PANEL-DIRECTORY ENTRY ABOVE
  //   RESERVED BY NAME. That comment reads: *"A later phase that wants CsvTablePreview /
  //   FilePreview / FilesSection / PendingAskCard / Seam / TodosSection / VersionDiff /
  //   WorkspacePanel{,.derived} inside the gate should adopt them deliberately, with its
  //   own measured number."* Phase 195 CONVERTS `FilesSection.tsx`, so this is that
  //   deliberate adoption — with its own measured number, read from this script's own
  //   printed `actual` column across two agreeing runs.
  //
  // WHAT WAS MEASURED FIRST, rather than assumed (`195-BASELINE.md` § "Pre-change tree
  // baselines"): **the gate covered ONE of this phase's five suites.** `TARGETS` had no
  // entry for `src/components/chat`, `src/lib` or `src/components/panel`, and only
  // `src/pages/WorkflowRunPage.test.tsx` was gated. So a green gate said nothing about
  // four fifths of Phase 195 — the NINTH occurrence of the two-knob trap the entries
  // above state as a rule.
  //
  // ⚠ TIMING IS NOT COSMETIC, and it was discharged rather than trusted: all five paths
  // were confirmed with `ls` from `frontend/` before these entries were written (an entry
  // pointing at a path that does not exist makes the gate ERROR — exit 2 — not fail, which
  // would break every subsequent plan in this phase). `OutputFileCard.baseline.test.tsx`
  // is created by THIS plan's task 1, in a commit that precedes this one in the same plan.
  //
  // ⚠ THE BASELINE KEY SPACE IS GLOBAL (bare filename). All five bare names were confirmed
  // unique tree-wide with `git ls-files` before the pins below were written, so no two
  // suites can collide silently on one number.
  //
  // ⚠ ADOPTING IMPORTS NO ROT: `195-BASELINE.md` measured all five green on the unmoved
  // tree — 102 / 11 / 11 / 11 / 15 = 150 tests, 0 failing. The gate requires 0 failing
  // forever, so an adoption is only safe when the adopted suites are already clean.
  //
  // WHAT WOULD BE UNGUARDED WITHOUT EACH ONE — named per suite, because "adopt the
  // phase's suites" is not a reason, it is a summary:
  //
  //  1. `OutputFileCard.baseline.test.tsx` — the FIRST direct coverage of
  //     `OutputFileCard` anywhere in the tree. It is the only fence on the `supersedes`
  //     subline (written TWICE in that component — once per branch — and covered by
  //     NOTHING before this plan), on the inert `data-variant`, and on the dead-link
  //     state's four clauses split so they cannot short-circuit each other. It is also
  //     D-20's THIRD SURFACE: chat renders no file card at all for a workflow deliverable
  //     (measured live, `195-BASELINE.md` arm 3), so this fixture is the phase's only
  //     record of the chat row. Plan 195-04 converts the component's internals; without
  //     this entry that conversion could drop any of those states with the gate green.
  //  2. `FilesSection.test.tsx` — this phase CONVERTS `FilesSection.tsx` onto the shared
  //     row. Its 11 cases are the whole contract for the panel's `role="listbox"` +
  //     roving-`tabIndex` a11y shape, its preview activation and its fresh-write flash.
  //     ⚠ And its icon path is MIME-first while `fileIcon` is extension-only, so the
  //     conversion has a real behaviour delta these 11 cases are the first line against.
  //  3. `fileIcon.test.tsx` — this phase WIDENS `fileIcon.tsx`. Its 11 cases pin the
  //     ext→(colour, glyph) map and the `.EXT` ribbon; a widening that changes an
  //     existing call site's output is exactly what they exist to catch.
  //  4. `StopControl.baseline.test.tsx` — ⚠ P9's fence, and the one with the sharpest
  //     reason. It greps `WorkflowRunPage.tsx?raw` and counts `/<StopControl/g` expecting
  //     exactly 1, so it breaks for reasons unrelated to its own subject every time this
  //     phase edits that page — and it was UNGATED, which is verbatim the lesson
  //     `docs/HOT-FILE-LEDGER.md` records against this very page: *"A pin in an ungated
  //     suite is a pin nothing checks."* That suite's own docblock (`:560-573`) records a
  //     line-count pin sitting RED through a whole plan because no gate ran it.
  //  5. `MessageItem.finalOutputs.test.tsx` — the only SHIPPED coverage of
  //     `OutputFileCard`'s dead-link state (indirectly, through `MessageItem`), and the
  //     suite that would notice if plan 195-04 accidentally opened `MessageItem.tsx` —
  //     which D-13 forbids (chat gains no new file affordance).
  //
  // FILE-LEVEL, deliberately NOT the bare directories `src/components/chat`,
  // `src/components/panel/__tests__`, `src/lib/__tests__` or `src/__tests__` — the same
  // reasoning this script already records for the panel directory, `src/lib`, `src/pages`,
  // `src/components/layout`, `src/components/settings` and `src/pages/__tests__`: those
  // directories hold suites this phase does not read, and adopting them would make Phase
  // 195 the owner of their future rot in a gate that requires 0 failing forever. Verified
  // with `grep -n '"src/components/chat"'` returning nothing — no bare-directory entry was
  // added by this plan.
  //
  // ── DECLINED, each with its reason, so a decline can never read as an oversight ──────
  //  · The rest of `src/components/panel/__tests__` (CsvTablePreview, FilePreview,
  //    PendingAskCard, Seam, TodosSection, VersionDiff, WorkspacePanel.derived) — Phase
  //    195 reads none of them. `WorkspacePanel.test.tsx` and the two Phase-188 panel
  //    suites are already adopted above by earlier phases; this plan adds only
  //    `FilesSection.test.tsx`, the one file it converts.
  //  · The rest of `src/components/chat/__tests__` and `src/__tests__/components/` —
  //    same reason. This plan adopts the three chat-side suites that guard files Phase
  //    195 opens (`OutputFileCard`, the `WorkflowRunPage.tsx?raw` grep, and the shipped
  //    dead-link coverage) and no others.
  //  · `src/lib/__tests__`'s other suites — `fileIcon.test.tsx` is the only one covering
  //    a file this phase widens.
  "src/components/chat/__tests__/OutputFileCard.baseline.test.tsx",
  "src/components/chat/__tests__/StopControl.baseline.test.tsx",
  "src/components/panel/__tests__/FilesSection.test.tsx",
  "src/lib/__tests__/fileIcon.test.tsx",
  "src/__tests__/components/MessageItem.finalOutputs.test.tsx",
  // ── Added in 195-03 task 3, in the SAME COMMIT as their BASELINE entries ────
  //
  // `src/components/files/` is a directory Phase 195 CREATED, and it holds the
  // one row markup, the one byte formatter, the one basename and the one
  // two-regime comparator that plans 05, 06 and 07 then convert three shipped
  // surfaces onto. A suite guarding all of that which nothing runs in CI would
  // be the phase's single most important falsification going unmeasured — the
  // `194.1-BASELINE.md` §2 finding, where an ungated pin sat red for twelve
  // cases and four clean gate reports could not have included it.
  //
  // ⚠ FILE-LEVEL, NOT THE BARE DIRECTORY `src/components/files`. A directory
  // entry here would silently adopt every future suite in this phase's OWN new
  // directory — including `FileRow.sweep.test.ts`, which does NOT exist yet and
  // whose adoption belongs to plan 195-07, with 07's numbers and 07's reasons.
  // That is the ownership trap this script argues against three times; being
  // the directory's author is not a reason to spring it on oneself.
  //
  // Both paths were `ls`-confirmed before these lines were written (a TARGETS
  // path that does not exist makes this gate ERROR at exit 2, not fail), and
  // both bare filenames were confirmed unique tree-wide — the BASELINE key
  // space is global.
  "src/components/files/__tests__/fileRowUtils.test.ts",
  "src/components/files/__tests__/FileRow.test.tsx",
  // ── Added in 195-07 task 3, in the SAME COMMIT that CREATES the file ────────
  //
  // `FileRow.sweep.test.ts` is the SC#2 source sweep — the one artefact in the
  // tree that measures *no second file UI* rather than believing it. The full
  // reasoning (why it exists, what is unguarded without it, and the OLD → NEW
  // table for every Phase-195 pin) is recorded ONCE at the matching `BASELINE`
  // entry above (search `195-07`); it is not duplicated here, because two copies
  // of a reason drift.
  //
  // ⚠ FILE-LEVEL, NOT THE BARE DIRECTORY `src/components/files` — the very trap
  // 195-03's block above names by anticipation ("including `FileRow.sweep.test.ts`,
  // which does NOT exist yet and whose adoption belongs to plan 195-07, with 07's
  // numbers and 07's reasons"). That prediction is honoured here: this is the
  // third file-level entry in that directory, and no directory entry was added.
  //
  // ⚠ HOW THAT IS VERIFIED — and the correction is RECORDED here rather than the
  // trap quietly side-stepped, because it fired twice in five minutes.
  //
  // 195-07's acceptance criterion was a bare `grep -n` for the DOUBLE-QUOTED bare
  // directory path, expected to return nothing. The first version of this comment
  // wrote that path double-quoted while explaining that no such entry exists — so
  // the grep matched its own explanation and read 1 instead of 0. The second
  // version replaced it with a stricter regex, quoted in full — and matched THAT.
  // A criterion phrased as "this string is absent" is UNSATISFIABLE the moment
  // anything documents it. Same shape as 195-06 (a grep that cannot tell
  // `not.toMatch(` from `toMatch(`) and as 187-24 (prose is never exempt), and it
  // is why every arm of `FileRow.sweep.test.ts` reads STRIPPED code.
  //
  // The path is therefore written in BACKTICKS throughout this block, as 195-03's
  // block above already does. The check that actually discriminates is an anchored
  // regex matching a whole ARRAY-ELEMENT line — start-of-line, optional indent, the
  // double-quoted bare directory path, a comma, end-of-line — which a prose mention
  // structurally cannot satisfy because prose is preceded by `//`. Run against this
  // file it exits 1: there is no bare-directory entry, only file-level ones.
  //
  // `ls`-confirmed before this line was written — a `TARGETS` path that does not
  // exist makes this gate ERROR at exit 2, not fail, for every later plan. The
  // bare filename `FileRow.sweep.test.ts` was confirmed unique tree-wide (`find`
  // returns exactly one match): the BASELINE key space is global.
  "src/components/files/__tests__/FileRow.sweep.test.ts",
  // ── Added in 196-03, in the SAME COMMIT as its BASELINE pin above ───────────
  //
  // The TENTH occurrence of the two-knob trap, and the first that lands on a file
  // shipped since Phase 101.1 rather than one the phase created.
  // `src/components/panel/` is reached above by THREE NAMED FILES ONLY —
  // `__tests__/PhaseReconcile.test.tsx`, `__tests__/PhaseTimeline.test.tsx` and
  // `__tests__/FilesSection.test.tsx` — and `PhaseCard.test.tsx` does not live
  // under `__tests__/` at all, so no entry above reached it. MEASURED, not
  // assumed: it was absent from this gate's printed file list on the unmodified
  // tree, and appeared as `— 27 new` on the first run after this line existed.
  //
  // WHAT IS UNGUARDED WITHOUT IT — the full reason is recorded ONCE at the
  // matching `BASELINE` entry above (search `196-03`); in one line: this suite is
  // now the only fence standing between the D-10 fallback notice and
  // `subStepMeta`'s default arm, which renders an unmapped status as the word
  // "Working" — i.e. silently.
  //
  // ⚠ TIMING: `ls`-confirmed before this line was written — a `TARGETS` path that
  // does not exist makes this gate ERROR at exit 2, not fail, for every later
  // plan. The bare filename was confirmed unique tree-wide
  // (`git ls-files | grep -c 'PhaseCard.test.tsx$'` → 1): the BASELINE key space
  // is global.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/panel` — the
  // same reasoning this script already records seven times over. That directory
  // holds suites this plan does not read, and adopting them would make Phase 196
  // the owner of their future rot in a gate that requires 0 failing forever.
  "src/components/panel/PhaseCard.test.tsx",
  // ── Added in 200-07, in the SAME COMMIT that creates the file — the ELEVENTH occurrence of
  //    the two-knob trap. The full reason is recorded ONCE at the matching `BASELINE` entry
  //    above (search `200-07`); in one line: without this path the gate never EXECUTES the
  //    only direct guard on the panel's status vocabulary and on its prototype-key floor.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/panel` — the same
  // reasoning this script already records eight times over. That directory holds suites this
  // plan does not read, and adopting them would make Phase 200 the owner of their future rot
  // in a gate that requires 0 failing forever.
  "src/components/panel/phaseStatusMeta.test.ts",
  // Added in 196-05 (AUTH-04 / D-06), in the SAME COMMIT that creates the file — the
  // NINTH occurrence of the two-knob trap this array records as a rule, and the SECOND
  // entry ever on `src/hooks/`.
  //
  // ⚠ THIS ENTRY IS WHAT MAKES THE PIN REACHABLE AT ALL. Unlike Tasks 1 and 2 of this
  // plan — whose suites live in `src/components/workflows`, already a DIRECTORY entry at
  // the top of this array, so they RAN the moment they existed — there is no `src/hooks`
  // directory entry anywhere here. MEASURED before this line was written, not assumed:
  // the only `src/hooks` path in this whole script is the FILE-LEVEL
  // `useDraftPersistence.test.tsx` entry above, so without this line the gate would never
  // EXECUTE this suite, and a falsification that does not run has falsified nothing
  // (verification truth 14, round 5 of Phase 187).
  //
  // WHAT IS UNGUARDED WITHOUT IT — the full reason is recorded ONCE at the matching
  // `BASELINE` entry (search `196-05`); in one line: this suite is the only thing standing
  // between a FAILED registry read and a picker that renders as a calm, correct control
  // offering nothing but its inherit option.
  //
  // ⚠ TIMING: a `TARGETS` path that does not yet exist makes this gate ERROR at exit 2,
  // not fail, for every later plan — so it lands in the creating commit and nowhere else.
  //
  // FILE-LEVEL, deliberately NOT the bare directory `src/hooks` — the same reasoning this
  // script already records eight times over, and verbatim the reasoning recorded at the
  // `useDraftPersistence.test.tsx` entry above. That directory holds dozens of suites this
  // plan does not read, and adopting them would make Phase 196 the owner of their future
  // rot in a gate that requires 0 failing forever.
  "src/hooks/__tests__/useModelRegistry.test.ts",
  // ── Added in 196-07 (D-18 / BUG-260718-04) — TWO entries, both in the SAME COMMIT ──────
  // ── that creates their files. Additive beside 196-05's entry directly above; nothing ──
  // ── there was restructured or removed. ────────────────────────────────────────────────
  //
  // ⚠ BOTH SUITES WERE UNGATED AND BOTH NEEDED A LINE — measured, not assumed.
  // `grep -n '"src/components/chat'` over this script returns exactly two FILE-LEVEL
  // entries (`OutputFileCard.baseline`, `StopControl.baseline`) and NO bare-directory
  // entry, which is the same finding the comment at those lines already records. And
  // `src/hooks` has no directory entry either — 196-05 hit that one line above. So neither
  // of these two would have EXECUTED without its own line, and a falsification that does
  // not run has falsified nothing.
  //
  // WHAT IS UNGUARDED WITHOUT THEM — full reason at the matching `BASELINE` entries
  // (search `196-07`); in one line: between them they are the ONLY guards on D-18's
  // derivation, including the two skips that no other suite in this tree asserts (a
  // `model` of `undefined` on user-role rows, and the literal `"unknown"` that 121 live
  // `runs` rows actually carry).
  //
  // ⚠ TIMING: a `TARGETS` path that does not yet exist makes this gate ERROR at exit 2 —
  // not fail — for every later plan, so both land in their creating commit and nowhere
  // else.
  //
  // FILE-LEVEL, deliberately NOT the bare directories `src/hooks` or `src/components/chat`
  // — verbatim the reasoning this script already records nine times over. Both directories
  // hold dozens of suites this plan does not read, and adopting them wholesale would make
  // Phase 196 the owner of their future rot in a gate that requires 0 failing forever.
  "src/hooks/__tests__/useComposerModel.test.ts",
  "src/components/chat/__tests__/ChatArea.model.test.tsx",
  // ⚠ ADOPTED 2026-08-31 — it was in NEITHER knob, so the gate neither ran it nor guarded
  // it, on the suite that now fences the composer's connector selection. That selection
  // shipped a defect where an EMPTY choice meant EVERY connection; a fence the gate does
  // not execute would not have caught its return. TARGETS decides what runs, BASELINE
  // decides what is guarded, and this file was on the wrong side of both.
  "src/components/chat/__tests__/MessageInput.connectors.test.tsx",
  // ⚠ ADOPTED 2026-08-31, for the same reason and on the same day: the approval card is
  // the ONE surface where a person grants an external action, and its suite was in
  // neither knob. The three-button card writes a real grant; a fence the gate does not
  // execute would not notice that button losing its wiring.
  "src/components/chat/__tests__/ToolApproval.test.tsx",
  // ⚠ ADOPTED 2026-08-31 (noise audit). Found RED for hours after the connector-toggle
  // fix changed `onSend`'s second argument from `undefined` to `[]` — and nobody saw it,
  // because this suite was in NEITHER knob. The THIRD chat suite found in that state on
  // one day. TARGETS decides what runs; BASELINE decides what is guarded.
  "src/components/chat/__tests__/MessageInputDrafts.test.tsx",
  // ── Added in 192.2-10 (WR-02), in the SAME COMMIT as its BASELINE pin above ─────────
  //
  // The ELEVENTH occurrence of the two-knob trap this script documents. `src/lib/` is reached
  // above by TWO NAMED FILES ONLY (`phaseState.test.ts`, `__tests__/fileIcon.test.tsx`), so
  // nothing here reached a new suite sitting directly in that directory. MEASURED, not
  // assumed: absent from this gate's printed file list on the unmodified tree.
  //
  // WHAT IS UNGUARDED WITHOUT IT — the full reason is recorded ONCE at the matching `BASELINE`
  // entry above (search `192.2-10`); it is not duplicated here, because two copies of a reason
  // drift.
  //
  // ⚠ FILE-LEVEL, deliberately NOT the bare directory `src/lib` — verbatim the reasoning this
  // script already records for `phaseState.test.ts`: that directory holds a dozen suites this
  // plan does not read, and adopting them would make Phase 192.2 the owner of their future rot
  // in a gate that requires 0 failing forever.
  //
  // ⚠ TIMING: a `TARGETS` path that does not yet exist makes this gate ERROR at exit 2 — not
  // fail — for every later plan, so this lands in its creating commit and nowhere else. The
  // path was `ls`-confirmed and the bare filename confirmed unique tree-wide (the BASELINE key
  // space is global) before this line was written.
  "src/lib/apiRunFields.fences.test.ts",
  // ── Added in 212-05 (GATE-1) — Phase 212 catalog and barrel tests ────────────
  "src/components/settings/__tests__/servicesCatalog.test.ts",
  "src/lib/__tests__/apiBarrel.test.ts",
  // ── Added in Phase 213 (213-05 / GATE-1) — per-tool grants list invariants ──
  "src/components/settings/__tests__/ConnectionGrantsList.test.tsx",
  // ── Added in Phase 221 (221-01 / T7) — the six-application split ─────────────
  // ⚠ FOUR lines, and the fourth is a FIND rather than a new file:
  // `ConnectionFormPanel.oauth.test.tsx` has shipped since Phase 215 and was in
  // NEITHER knob — the gate has never executed it and nothing guarded its count.
  // That is the sixth suite found in this state inside a week (three chat suites on
  // 2026-08-31, one of them RED for hours unseen), and the cause is structural: the
  // `src/components/settings/` entries here are FILE-LEVEL by deliberate choice, so
  // every new file under it is invisible until somebody types its name.
  "src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx",
  // ── Added in Phase 231 (VIS-02) — the "who will see this" sentence ──────────
  // FILE-LEVEL, matching this directory's standing convention (the bare directory
  // is deliberately not adopted). Added in the SAME COMMIT that creates the file,
  // and to BOTH knobs — `src/components/settings/` is reached by nothing above.
  "src/components/settings/__tests__/ingestVisibility.test.tsx",
  "src/components/settings/toolGroups.test.ts",
  "src/components/settings/ConnectionGrantsList.grouping.test.tsx",
  "src/components/settings/connectionRowVerdict.test.ts",
  // ── Added in Phase 221 plan 02 (the availability line) — BOTH knobs, same commit ────
  "src/components/settings/applicationAvailability.test.ts",
  "src/components/settings/ApplicationGroup.availability.test.tsx",
  // Added 2026-09-01 with the two honest-failure fixes the operator drove out.
  "src/components/chat/__tests__/statusWord.honesty.test.ts",
  // ⚠ FOUND IN NEITHER KNOB 2026-09-01 — the gate never RAN it and nothing guarded it,
  // on the suite covering the APPROVAL CARD, which is the product's trust boundary. The
  // panel __tests__ entries here are FILE-LEVEL, so this file was invisible until its
  // name was typed. Twelfth such suite in a week; SEED-229 has the structural fix.
  "src/components/panel/__tests__/PendingAskCard.test.tsx",
  // ── Added for SEED-227, in the SAME COMMIT that creates the file — the two-knob trap
  // ── again, and MEASURED rather than assumed: `grep -n "components/metadata"` over this
  // ── whole script returned NOTHING before this line was written. `src/components/metadata`
  // ── is covered by no directory entry, so the gate has never EXECUTED a suite there —
  // ── including the shipped `DocumentDetailPanel.a11y.test.tsx`.
  //
  // FILE-LEVEL, deliberately NOT the bare directory: adopting `src/components/metadata`
  // would pull in the a11y and InlineEdit suites and make this change the owner of their
  // future rot, which is the same reasoning already recorded for `src/pages` and
  // `src/components/layout` above. Phase 218 owns the document space and can adopt the
  // directory deliberately, with its own measured number.
  //
  // What would be unguarded without it: the ONLY fence on the truncation notice, whose
  // load-bearing case is an ABSENCE — `_images` is stamped only when images were skipped,
  // so a notice rendered unconditionally would warn on every document in the library. Both
  // positive cases were driven RED against a planted `{false && …}` (2 failed, absence
  // control correctly green) before this entry was written.
  "src/components/metadata/DocumentDetailPanel.images.test.tsx",

  // ══ Phase 217 (plan `217-12`, the phase's CLOSING plan) — THE DOCUMENT SPACE ═════════
  //
  // ⚠ MEASURED BEFORE THIS BLOCK WAS WRITTEN, never assumed: of the thirteen suites Phase
  // 217 wrote, converted or inherited, exactly ONE doc-space suite sat in BOTH knobs —
  // `DocumentDetailPanel.images.test.tsx`, adopted for SEED-227 one phase earlier. The
  // gate's grand total did not move at all across this phase's second wave, because it
  // never executed any of them.
  //
  // TARGETS decides what RUNS; BASELINE decides what is GUARDED, and a suite can sit on
  // the wrong side of exactly one. Checked PER FILE from this gate's own printed rows and
  // never inferred from a sibling — the `WorkflowBuilderPage.declaredInputs` note above
  // records taking the OPPOSITE answer to its neighbour ten lines away, which is why the
  // check is made file by file.
  //
  // ⚠ WHY THE PINS LAND HERE RATHER THAN IN EACH CREATING COMMIT — a deliberate planning
  // decision, recorded so it is auditable rather than discovered later. A BASELINE key
  // naming a file that does not yet exist makes this gate ERROR (exit 2), so pinning ahead
  // is impossible; pinning per plan would have made this script a shared artifact across
  // six parallel worktrees and forced the whole phase serial. The cost is real and is
  // stated rather than hidden: every suite below was UNGUARDED for the length of the
  // phase. The mitigation is that the adoption list was derived mechanically —
  // `git diff --name-only --diff-filter=A 9a3808697..HEAD -- 'frontend/src/**/*.test.ts*'`
  // — and not from memory. Phase 214 left six suites unpinned by doing this from memory.
  //
  // ⚠ A BARE-NAME COLLISION BLOCKED ONE ADOPTION AND WAS RESOLVED, NOT WORKED AROUND.
  // `bareName()` makes the BASELINE key space GLOBAL, and `DocumentList.test.tsx` existed
  // at TWO paths. Both were read before either was touched, and they are COMPLEMENTS, not
  // duplicates: the colocated `src/components/ingestion/` one covers the Phase 118
  // classification chip; the `src/__tests__/components/` one covers the Phase 114
  // move-to-folder row action. So neither is dropped and neither is excluded — the latter
  // was `git mv`d to `DocumentList.moveToFolder.test.tsx` (history follows) and both are
  // adopted below.
  //
  // ⚠ FIVE DIRECTORIES REACHED BY NOTHING, NAMED rather than left silent, because an
  // unnamed absence is exactly how a suite becomes permanently invisible:
  //   · `src/pages` — reached by NAMED FILES ONLY; there is no directory entry, so
  //     `src/pages/__tests__/` was reached by nothing at all before this block.
  //   · `src/components/ingestion`, `src/components/ui`, `src/__tests__/library` and
  //     `src/__tests__/hooks` — likewise unreached by any entry in this file.
  //   · `src/components/metadata` — STILL covered by no DIRECTORY entry after this block.
  //     217 adopts it FILE BY FILE, verbatim the reasoning SEED-227 recorded one phase
  //     earlier. ⭐ Phase 218 owns the document space and can adopt the directory
  //     deliberately, with its own measured number.
  //
  // ⚠ FILE-LEVEL EVERYWHERE, deliberately NOT bare directories. A directory entry RECURSES
  // into `__tests__/` — that is precisely how `WorkflowScheduleModal.test.tsx` ended up
  // RUNNING while guarding nothing at Phase 214 — and adopting a directory here would make
  // Phase 217 the owner of the future rot of suites it never read, in a gate that requires
  // 0 failing forever.

  // ── The eight suites Phase 217 CREATED ──────────────────────────────────────────────
  "src/__tests__/library/renameFence.test.ts",
  "src/components/ingestion/__tests__/acceptFormats.test.ts",
  "src/components/ingestion/__tests__/IngestionStrip.test.tsx",
  "src/components/metadata/__tests__/DetailSections.lazy.test.tsx",
  "src/components/metadata/__tests__/CR01.reset.test.tsx",
  "src/components/metadata/__tests__/DetailSections.tables.test.tsx",
  "src/components/ui/__tests__/tabsContrast.test.ts",
  "src/pages/__tests__/LibraryPage.test.tsx",
  "src/pages/__tests__/librarySelection.test.ts",

  // ── The four pre-existing doc-space ORPHANS this gate had NEVER executed ─────────────
  // Adopted rather than created. Each guards a file inside Phase 217's blast radius:
  // `useDocuments.ts` carries the reconcile that the `ingestion_step` field flows through,
  // `DocumentList.tsx` is the strip's host row, `DocumentDetailPanel.tsx` gained five
  // sections, and `ViewsGroup.tsx` is the sidebar half of the one selection truth.
  // ⚠ 217 does NOT modify `DocumentList.tsx` itself — the strips live on the Ingestion tab
  // — so its G-5 obligation is not triggered by a code change here. What changes is that
  // its two suites stop being invisible to this gate.
  "src/__tests__/hooks/useDocuments.test.ts",
  "src/__tests__/components/DocumentList.moveToFolder.test.tsx",
  "src/components/ingestion/DocumentList.test.tsx",
  "src/components/ingestion/ViewsGroup.test.tsx",
  "src/components/metadata/DocumentDetailPanel.a11y.test.tsx",

  // ── ⭐ THE PANEL-DIRECTORY RESERVATION, CLAIMED ──────────────────────────────────────
  // The comment at the panel entries far above reads, verbatim: *"A later phase that wants
  // CsvTablePreview / FilePreview / FilesSection / PendingAskCard / Seam / TodosSection /
  // VersionDiff / WorkspacePanel{,.derived} inside the gate should adopt them deliberately,
  // with its own measured number."* Phase 217 CONVERTS `CsvTablePreview.tsx` — 217-11
  // extracted `DataTableView` out of it — so this is that deliberate adoption, on exactly
  // the ground Phase 195 claimed `FilesSection.test.tsx`. ⭐ Its count is UNCHANGED by the
  // extraction, which is 217-11's own proof that the extraction was faithful.
  // The other six panel suites stay DECLINED for their already-recorded reason: 217 reads
  // none of them, and a decline must never read as an oversight.
  "src/components/panel/__tests__/CsvTablePreview.test.tsx",

  // ── ⭐ THE PHASE 217.1 SUITES — ADOPTED BY 217.1-18, AT ITS OWN CLOSE ─────────────────
  // Every suite this phase created or adopted. `src/components/library` and the metadata
  // `__tests__/` dir have NO directory entry, so each is a NAMED FILE here (the two-knob
  // rule: TARGETS decides what RUNS, BASELINE decides what is GUARDED). The three
  // DocumentStatusBadge / FilterBar entries close 217's deferred-§3 re-open trigger. Pins
  // were captured by 217.1-18 at the gate's own printed `-- N new`, never while red.
  "src/components/library/__tests__/LibraryHeaderBar.test.tsx",
  "src/components/library/__tests__/sketchComposition.test.tsx",
  "src/components/library/__tests__/ingestionFailureCopy.test.ts",
  "src/components/library/__tests__/IngestionTab.test.tsx",
  "src/components/library/ingestion/__tests__/pipelineGroups.test.ts",
  "src/components/library/__tests__/LibraryStatTiles.test.tsx",
  "src/components/library/__tests__/viewRulePhrase.test.ts",
  "src/components/library/__tests__/ViewCardGrid.test.tsx",
  "src/components/library/__tests__/IndexFoldersTable.test.tsx",
  "src/components/library/__tests__/IndexingTab.gate.test.tsx",
  "src/components/library/__tests__/HealthTiles.test.tsx",
  "src/components/library/__tests__/HealthSignalChips.test.tsx",
  "src/components/library/__tests__/CheckedQueriesSection.test.tsx",
  "src/components/layout/__tests__/ChatLayout.fallback.test.tsx",
  "src/components/metadata/__tests__/DocumentQueriesSection.test.tsx",
  "src/components/ingestion/FilterBar.test.tsx",
  // ⚠ This path was repointed at 217.1-18 — the file lives at `src/__tests__/components/`
  // (the `src/components/ingestion/__tests__/` path is DEAD, which is why it never printed
  // as `new`). The `.a11y` sibling below is genuinely under `src/components/ingestion/__tests__/`.
  "src/__tests__/components/DocumentStatusBadge.test.tsx",
  "src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx",
  // ── Phase 222 (222-05 / D-222-09) — Door half OAuth & probe-auth discovery ──
  "src/lib/api/__tests__/connectors.mcp_auth.test.ts",
  "src/components/settings/__tests__/connectionFormCopy.mcp.test.ts",
  "src/components/settings/McpAuthDoor.test.tsx",
  "src/components/settings/McpAuthDoor.byo.test.tsx",
  // ── Phase 239 (239-03) — F-7, the two suites that were in NEITHER knob ───────────────
  // FILE-LEVEL, not the bare `src/components/settings/__tests__` directory, verbatim the
  // reasoning every neighbour on this path already records. See the matching BASELINE
  // entries for what proved they were ungated: a 14-case suite that moved the grand total
  // by zero.
  "src/components/settings/__tests__/ConnectionFormPanel.sourceTools.test.tsx",
  "src/components/settings/__tests__/ConnectionFormPanel.refreshReceipt.test.tsx",
  "src/components/ui/__tests__/scrollAreaViewportWidth.test.tsx",
  // ── BUG-260904-02 — see the matching BASELINE entry. `src/__tests__/hooks` is reached by no
  // ── directory entry in this file, so this suite needed BOTH knobs. ───────────────────
  "src/__tests__/hooks/useFollowScroll.test.ts",
  // ── BUG-260904-01 — see the matching BASELINE entry for what it guards. FILE-LEVEL,
  // ── deliberately not the bare directory `src/components/chat/__tests__`, verbatim the
  // ── reasoning this script already records for its neighbours. ────────────────────────
  "src/components/chat/__tests__/MessageItem.continueButton.test.tsx",
  // ── Phase 227 (227-01 / SC#5) — Chat run frame & message decomposition suites ──
  "src/components/chat/__tests__/MessageItem.cancelledRun.test.tsx",
  "src/components/chat/__tests__/MessageItem.blockedNotice.test.tsx",
  "src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx",
  "src/components/chat/__tests__/ChatAreaBanner.test.tsx",
  "src/components/chat/__tests__/ChatAreaMode.test.tsx",
  "src/components/chat/__tests__/RunCard.characterization.test.tsx",
  "src/__tests__/components/MessageItem.test.tsx",
  "src/__tests__/components/MessageItem.clamp.test.tsx",
  "src/__tests__/components/MessageItem.fallbackNotice.test.tsx",
  "src/__tests__/components/MessageItem.memo.test.tsx",
  "src/__tests__/components/MessageItem.sticky.test.tsx",
  "src/__tests__/components/RunCard.logo.test.tsx",
  "src/__tests__/components/ToolCallPanel.test.tsx",
  "src/__tests__/components/chat/MessageList.test.tsx",
  "src/__tests__/components/chat/MessageList.dedup.test.tsx",
  "src/__tests__/components/chat/MessageList.runline.baseline.test.tsx",
  // ── Phase 228 (228-02 / DEBT-02) — Retry turn & cap_paused reconcile suites ──
  "src/components/chat/__tests__/MessageItem.retry.test.tsx",
  "src/components/chat/__tests__/MessageItem.capPaused.test.tsx",
  // ── Phase 228 (228-03 / DEBT-04) — Vercel subdomain routing suite ──
  "src/__tests__/routing/vercelRouting.test.ts",
  // ── Phase 232 (232-04 / SRC-02) — Source folder picker suite ──
  "src/components/sources/SourceFolderPicker.test.tsx",
  // ── Phase 233 (233-02) — the preview's two suites. See the BASELINE block for why each ──
  // ── needs its own line: `src/components/sources` is not a directory entry here. ────────
  "src/components/sources/previewVocabulary.test.ts",
  "src/components/sources/SourcePreviewPanel.test.tsx",
  // ── Phase 234 (234-05) — watched folders surface ──
  "src/components/sources/WatchedFoldersSection.test.tsx",
  // ══ Phase 235 (235-12 / SURF-02 / SURF-03 / LIB-10) — "the source says what it did" ════
  //
  // NINE suites, and BOTH knobs are set in the SAME COMMIT that adopts them, for the reason
  // Phase 233's BASELINE block records: a `BASELINE` key naming a path this array does not
  // RUN makes the gate ERROR (exit 2) rather than fail.
  //
  // ⚠ EVERY ONE OF THESE NEEDS ITS OWN PATH LINE, AND THAT WAS CHECKED AGAINST THE ARRAY
  // RATHER THAN ASSUMED. `src/components/sources`, `src/components/library`,
  // `src/components/layout` and `src/hooks` are NONE of them directory entries — this whole
  // array contains exactly TWO directory entries (`src/landing` and
  // `src/components/workflows`), and a path entry recurses into nothing. Phase 214's
  // `WorkflowScheduleModal.test.tsx` finding (it RAN for phases while guarding nothing) is
  // the inverse of this one, and both come from not looking.
  //
  // ⛔ THE TENTH SUITE OF THIS PHASE IS DELIBERATELY ABSENT FROM BOTH KNOBS AND IT IS THE
  // MOST IMPORTANT ONE: `src/components/sources/sourceComposition.test.tsx`, the phase's
  // whole design-contract fence, is RED (16 failed / 33 passed of 49) at this commit. The
  // gate's contract is *zero failing, forever*; pinning a red suite would redden the shared
  // gate for the entire repository, and adopting it with an allowance would make it a gate
  // that cannot fail — which is exactly what sketch 218 shipped and what this fence exists
  // to stop. All 16 reds are itemised with owners in `235-11-SUMMARY.md` and carried forward
  // in `235-12-SUMMARY.md` + `deferred-items.md`. **The fence RUNS in no gate today. That is
  // recorded loudly rather than hidden behind a green verdict line.**
  "src/components/sources/sourceHealthVocabulary.test.ts",
  "src/components/sources/runHistoryFold.test.ts",
  "src/components/sources/RunHistoryList.test.tsx",
  "src/components/sources/WatchedFoldersSection.history.test.tsx",
  "src/components/library/__tests__/IngestionTab.readerOff.test.tsx",
  "src/components/library/__tests__/IngestionTab.reconnectControl.test.tsx",
  "src/components/library/__tests__/SourcesAttentionSection.test.tsx",
  "src/components/layout/__tests__/NavPanel.badge.test.tsx",
  "src/components/layout/__tests__/ChatLayout.badge.test.tsx",
  "src/hooks/__tests__/useSourceAttention.test.tsx",
  "src/pages/__tests__/LibraryPage.initialTab.test.tsx",
  // ── Phase 237 (RULES-01 / SC#1 / SC#3) — Classification rules & arrival watch builder suites ──
  "src/components/classification/ClassificationRulesPage.test.tsx",
  "src/components/classification/ClassificationSection.test.tsx",
  "src/components/classification/RuleBuilderPanel.test.tsx",
  // ── Phase 238 (SRC-03 / D-238-08) — the predicate that replaced a string guess ─────────
  // ⚠ ITS OWN LINE, because `src/components/sources` is STILL not a directory entry here —
  // the same fact Phase 233 recorded and Phase 235 re-recorded. A suite dropped into that
  // folder runs in no gate unless it is named.
  "src/components/sources/__tests__/sourceCapability.test.ts",
  // ── Phase 240 (SRC-05 / D-240-19) ──────────────────────────────────────────────────────
  // ⚠ NAMED FILES, for the fact three phases in a row have now recorded on this exact path:
  // `src/components/sources` is STILL not a directory entry, so a suite dropped into that
  // folder runs in NO gate unless it is named here. `src/components/metadata` is likewise
  // covered only file-by-file.
  //
  // ⛔ The first two are the FIRST SUITES EITHER COMPONENT HAS EVER HAD, and that absence is
  // the root cause `BUG-260908-02` names in its own report. Both knobs, deliberately: Phase
  // 214 measured a suite being RUN by a directory entry while guarded by nothing, because
  // TARGETS decides what runs and BASELINE decides what is guarded.
  "src/components/sources/__tests__/ConnectedSourceSection.test.tsx",
  "src/components/sources/__tests__/CreateWatchModal.test.tsx",
  "src/components/metadata/DocumentConversationSection.test.tsx",
  // ⚠ Named, not a directory: `src/components/sources` is STILL not a TARGETS directory entry.
  "src/components/sources/watchProductMark.test.ts",
  "src/lib/__tests__/navItemsUnknownIsNotDenied.test.ts",
  // ── Phase 243 (243-01 / CHAT-01 / CHAT-04 / D-243-16) — the thinking block's ────────────
  // ── PRE-EXTRACTION characterization net. ────────────────────────────────────────────────
  // FILE-LEVEL, deliberately NOT the bare directory `src/components/chat/__tests__` — the
  // same reasoning this script already records beside its 21 other chat entries. There is no
  // `src/components/chat` directory entry anywhere here, so a suite dropped into that folder
  // runs in NO gate until it is named. TARGETS decides what RUNS, BASELINE what is GUARDED.
  "src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx",
  // ── Phase 243 (243-04 / CHAT-01 / D-243-02) — the reasoning clamp, at BOTH ends of the ──
  // ── measured 170x spread. FILE-LEVEL for the same reason as the line above it. ──────────
  "src/components/chat/__tests__/ThinkingBlock.clamp.test.tsx",
  // ── Phase 243 (243-05 / CHAT-05 / CHAT-01 — D-243-06) — the answer out of the fold ─────
  //
  // ⛔ FILE-LEVEL, BY NECESSITY: `src/components/chat` has NO directory entry (D-243-17), so
  // this suite runs in NO gate until it is named here AND in BASELINE. It is the only fence
  // in the tree that drives the NAVIGATION path — a run terminating while its thread is not
  // the mounted surface — and the only one asserting the answer's DOCUMENT POSITION relative
  // to the thinking line and the tool rows.
  "src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx",
  // ── Phase 243 (243-03 / CHAT-02 / CHAT-03) — the delta cadence and the scroll effect ────
  //
  // ⛔ ALL THREE NEEDED BOTH KNOBS BY HAND, AND NONE OF THEM IS REACHED BY A DIRECTORY RULE.
  // This file has exactly TWO bare-directory TARGETS entries — `src/landing` and
  // `src/components/workflows`. `src/__tests__` was never adopted and `src/components/chat`
  // appears only inside comments. A suite in any of these folders runs in NO gate until it is
  // named here. (Phase 214 measured the mirror of this trap on `WorkflowScheduleModal`: a
  // directory entry made a suite RUN while BASELINE guarded nothing.)
  //
  // ⚠ `src/__tests__/providers` is in NEITHER knob, which means all TEN other shipped
  // `StreamsProvider` suites are currently UNGATED — `StreamsProvider.anthropic-ordering`,
  // `.dedup`, `.stopping`, `.stopping.baseline`, `.transient`, `.watchdog`, `streamPool`,
  // `streamsProvider.test.tsx`, `_067_5_regression`, `_075_7_reconcile_race`,
  // `_075_9_clientkey`, `_bug_260707_01`, `_bug_260707_03`, `_state01b_403`. Adopting them is
  // OUT OF SCOPE for 243-03 (13 of their cases are red at this phase's base commit, so
  // adopting them would turn the shared gate red for a reason no plan here owns) — but they
  // are NAMED rather than left unlooked-for. An unadopted suite someone wrote down is a
  // different thing from one nobody noticed.
  "src/__tests__/providers/streamsProvider_243_cadence.test.tsx",
  "src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx",
  // ⚠ The scroll suite below is a SEPARATE FILE from `MessageList.test.tsx` on purpose:
  // that one stubs `scrollIntoView` to a NO-OP tree-wide (`:61-65`), so nothing mounted under it
  // can see the scroll effect at all. This is the ONLY behavioural coverage that effect has.
  "src/__tests__/components/chat/MessageList.scroll.test.tsx",
  // ⚠ The throttle suite below ALREADY EXISTED and was ENTIRELY UNGATED before 243-03 — `grep -n
  // throttle` on this file returned nothing. It is adopted here, not created here, and it now
  // guards two primitives with OPPOSITE contracts (see docs/HOT-FILE-LEDGER.md).
  "src/__tests__/lib/throttle.test.ts",
]

const REPO_ROOT = path.resolve(__dirname, "..")
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend")
const BACKEND_DIR = path.join(REPO_ROOT, "backend")

const RED = "[31m"
const GRN = "[32m"
const YEL = "[33m"
const RST = "[0m"

function fatal(message) {
  console.error(`FATAL: ${message}`)
  process.exit(2)
}

/** Reject any report path that lands inside a reload-watched tree. */
function assertOutsideWatchedTree(resolved) {
  for (const [label, dir] of [
    ["frontend/", FRONTEND_DIR],
    ["backend/", BACKEND_DIR],
  ]) {
    if (resolved === dir || resolved.startsWith(dir + path.sep)) {
      fatal(
        `refusing to write the vitest report inside ${label} (${resolved}).\n` +
          `       A scratch file in a watched tree wedges the vite/uvicorn reload watchers.`,
      )
    }
  }
}

function parseArgs(argv) {
  const opts = { jsonPath: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--json") {
      opts.jsonPath = argv[i + 1]
      if (!opts.jsonPath) fatal("--json requires a path argument.")
      i += 1
    } else if (arg.startsWith("--json=")) {
      opts.jsonPath = arg.slice("--json=".length)
    } else if (arg === "-h" || arg === "--help") {
      console.log("usage: node scripts/vitest-count-gate.cjs [--json <existing-report.json>]")
      process.exit(0)
    } else {
      fatal(`unknown argument '${arg}'. usage: node scripts/vitest-count-gate.cjs [--json <path>]`)
    }
  }
  return opts
}

/** Run the Wave-0 suites with the JSON reporter and return the report path. */
function runVitest() {
  const outFile = path.join(
    os.tmpdir(),
    `vitest-count-gate-${process.pid}-${Date.now()}.json`,
  )
  assertOutsideWatchedTree(path.dirname(outFile))

  const args = [
    "vitest",
    "run",
    ...TARGETS,
    "--reporter=json",
    `--outputFile=${outFile}`,
  ]

  // Worktree-parallel safety valve (measured 2026-08-10). Two uncapped vitest
  // runs on this 16-core box spawn ~16 workers EACH; the oversubscription shows
  // up as bare timeouts in suites the plan never touched — `failed 6` / `failed 5`
  // on two concurrent runs whose serial baseline is `failed 0`. Capped at 4
  // workers each, two concurrent runs agree EXACTLY (9 files / 23 tests failing,
  // the known SEED-056 rot set, on both). Absent => unchanged single-run behaviour.
  if (process.env.GSD_VITEST_MAX_WORKERS) {
    args.push(`--maxWorkers=${process.env.GSD_VITEST_MAX_WORKERS}`)
  }

  // ⛔ THE WINDOWS COMMAND-LENGTH LIMIT — measured 2026-09-10 (Phase 241-03), and it was
  //    ALREADY BROKEN at that phase's base commit, by nothing that phase changed.
  //
  //    `shell: true` routes the spawn through `cmd.exe /d /s /c "…"`, whose TOTAL command line
  //    is capped. TARGETS has grown past 150 entries, so the composed line measured **8,078
  //    characters** and cmd refused the whole thing with:
  //
  //        The syntax of the command is incorrect.
  //
  //    — no JSON report, exit 255, and `fatal()` below correctly called it a HARNESS error
  //    rather than a gate failure. Reproduced on two consecutive runs on an untouched tree. A
  //    controlled probe pinned the boundary between 8,100 (accepted) and 8,150 (refused):
  //
  //        for (const n of [7900, 8000, 8050, 8100, 8150])
  //          spawnSync('node', ['-e','process.exit(0)', 'x'.repeat(n-20)], {shell:true})
  //        // => 0, 0, 0, 0, 1
  //
  // ⛔ THE FIX IS TO STOP GOING THROUGH cmd.exe — NOT TO SHORTEN `TARGETS`. Trimming the scan
  //    list to fit a shell limit would silently un-run suites, which is the precise failure the
  //    TARGETS/BASELINE two-knob rule exists to prevent: *"a suite can sit on the wrong side of
  //    exactly one of them"*. A gate that quietly stops running files is worse than one that
  //    refuses to start, because only the second one tells anybody.
  //
  //    Spawning the resolved vitest entry with `process.execPath` and `shell: false` hands the
  //    argv to CreateProcess directly (32,767-char ceiling) and passes each target as its own
  //    argument, so neither quoting nor length applies. It runs the SAME file `npx` resolved:
  //    `frontend/node_modules/vitest/vitest.mjs`. `require.resolve("vitest/vitest.mjs")` does
  //    NOT work — the package's `exports` map blocks the deep path (ERR_PACKAGE_PATH_NOT_EXPORTED)
  //    — so resolve `package.json` (which every modern package exports) and join the `bin` entry.
  let vitestEntry
  try {
    const pkgPath = require.resolve("vitest/package.json", { paths: [FRONTEND_DIR] })
    vitestEntry = path.join(path.dirname(pkgPath), "vitest.mjs")
  } catch {
    vitestEntry = path.join(FRONTEND_DIR, "node_modules", "vitest", "vitest.mjs")
  }
  if (!fs.existsSync(vitestEntry)) {
    fatal(
      `could not find the vitest entry at ${vitestEntry}.\n` +
        `       In a worktree this usually means bootstrap-worktree.sh has not run.`,
    )
  }

  // `args[0]` is the literal "vitest" the npx form needed; the direct form supplies the path.
  const spawnArgs = [vitestEntry, ...args.slice(1)]

  console.log(`running: npx ${args.join(" ")}`)
  console.log(`   via: ${path.basename(process.execPath)} ${vitestEntry} (no shell — see above)`)
  console.log(`   cwd: ${FRONTEND_DIR}`)
  console.log(`report: ${outFile}`)
  console.log("")

  const res = spawnSync(process.execPath, spawnArgs, {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    shell: false,
    env: { ...process.env, CI: "1" },
  })

  if (res.error) fatal(`could not spawn vitest: ${res.error.message}`)
  // A non-zero exit is EXPECTED when tests fail — the report still exists and
  // the [failing-tests] reason below names it. Only a MISSING report is fatal.
  if (!fs.existsSync(outFile)) {
    fatal(
      `vitest produced no JSON report at ${outFile} (exit ${res.status}).\n` +
        `       The suite could not run; this is a harness error, not a gate failure.`,
    )
  }
  return outFile
}

function readReport(reportPath) {
  let raw
  try {
    raw = fs.readFileSync(reportPath, "utf8")
  } catch (err) {
    fatal(`could not read the vitest report at ${reportPath}: ${err.message}`)
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    fatal(`the vitest report at ${reportPath} is not valid JSON: ${err.message}`)
  }
}

function bareName(p) {
  return String(p).replace(/^.*[\\/]/, "")
}

function main() {
  const opts = parseArgs(process.argv.slice(2))

  let reportPath
  if (opts.jsonPath) {
    reportPath = path.resolve(process.cwd(), opts.jsonPath)
    if (!fs.existsSync(reportPath)) fatal(`--json path does not exist: ${reportPath}`)
    console.log(`reusing report: ${reportPath}`)
    console.log("")
  } else {
    reportPath = runVitest()
  }

  const report = readReport(reportPath)

  const numTotalTests = Number(report.numTotalTests)
  const numFailedTests = Number(report.numFailedTests)
  if (!Number.isFinite(numTotalTests) || !Number.isFinite(numFailedTests)) {
    fatal("the vitest report is missing numTotalTests / numFailedTests.")
  }

  // Per-file actual counts, keyed by bare filename. A file can legitimately
  // appear once; if a name ever repeats, sum it rather than silently losing one.
  const actual = new Map()
  for (const suite of report.testResults || []) {
    const name = bareName(suite.name)
    const count = Array.isArray(suite.assertionResults) ? suite.assertionResults.length : 0
    actual.set(name, (actual.get(name) || 0) + count)
  }

  const failures = []

  console.log("==============================================================")
  console.log(" D-184-08 per-file vitest COUNT gate (Phase 184 Wave 0)")
  console.log(` report: ${reportPath}`)
  console.log("==============================================================")
  console.log(
    `  ${"file".padEnd(40)}${"pinned".padStart(7)}${"actual".padStart(8)}${"delta".padStart(8)}`,
  )
  console.log("  " + "-".repeat(61))

  const pinnedNames = Object.keys(BASELINE).sort((a, b) => BASELINE[b] - BASELINE[a] || a.localeCompare(b))
  for (const file of pinnedNames) {
    const pinned = BASELINE[file]
    if (!actual.has(file)) {
      failures.push(`[missing-file] ${file} — pinned at ${pinned} tests but did NOT run`)
      console.log(
        `  ${RED}${file.padEnd(40)}${String(pinned).padStart(7)}${"MISSING".padStart(8)}${"—".padStart(8)}${RST}`,
      )
      continue
    }
    const got = actual.get(file)
    const delta = got - pinned
    const deltaText = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`
    const color = delta < 0 ? RED : delta > 0 ? YEL : ""
    const reset = color ? RST : ""
    console.log(
      `  ${color}${file.padEnd(40)}${String(pinned).padStart(7)}${String(got).padStart(8)}${deltaText.padStart(8)}${reset}`,
    )
    if (delta < 0) {
      failures.push(
        `[count-decrease] ${file} — pinned ${pinned}, ran ${got} (${delta}). A test was deleted or skipped away.`,
      )
    }
  }

  // Files present in the run but not in the pin — informational, never a failure.
  const extras = [...actual.keys()].filter((f) => !(f in BASELINE)).sort()
  for (const file of extras) {
    console.log(
      `  ${YEL}${file.padEnd(40)}${"—".padStart(7)}${String(actual.get(file)).padStart(8)}${"new".padStart(8)}${RST}`,
    )
  }

  console.log("  " + "-".repeat(61))
  const totalDelta = numTotalTests - BASELINE_TOTAL
  const totalDeltaText = totalDelta === 0 ? "0" : totalDelta > 0 ? `+${totalDelta}` : `${totalDelta}`
  console.log(
    `  ${"total".padEnd(40)}${String(BASELINE_TOTAL).padStart(7)}${String(numTotalTests).padStart(8)}${totalDeltaText.padStart(8)}`,
  )
  console.log(`  total ${numTotalTests}  ·  failed ${numFailedTests}  ·  pinned total ${BASELINE_TOTAL}`)
  console.log("--------------------------------------------------------------")

  if (numFailedTests > 0) {
    failures.unshift(`[failing-tests] ${numFailedTests} test(s) failed — the gate requires 0.`)
  }
  if (numTotalTests < BASELINE_TOTAL) {
    failures.unshift(
      `[total-below-baseline] total ${numTotalTests} < pinned ${BASELINE_TOTAL}.`,
    )
  }

  if (failures.length > 0) {
    console.log(`${RED}RESULT: COUNT GATE VIOLATED (${failures.length} reason(s))${RST}`)
    for (const reason of failures) console.log(`  ${RED}FAIL${RST}  ${reason}`)
    console.log("")
    console.log("        D-184-08 pins per-FILE counts because a failures-only")
    console.log("        differential cannot see a DELETED test (the Phase-177 lesson).")
    process.exit(1)
  }

  // DERIVED, not hard-coded: this line read "16/16" until 187-25 pinned two more
  // files, at which point a literal would have printed a false count on a green
  // gate — the same class of stale claim the pin itself exists to catch.
  const pinnedCount = pinnedNames.length
  console.log(
    `${GRN}count gate OK${RST} — ${pinnedCount}/${pinnedCount} pinned files present, no per-file decrease, 0 failing.`,
  )
  process.exit(0)
}

main()
