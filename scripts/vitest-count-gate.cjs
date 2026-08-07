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
  "definitionOps.test.ts": 232,
  "canvasModel.fixtures.test.ts": 100,
  // 188-12: 69 → 143. A stale-low pin inherited from 187-25 and flagged as owed by
  // five 188 plans. The 74 cases in the slack were deletable with the gate green.
  "canvasModel.purity.test.ts": 143,
  "SeedReceipt.test.tsx": 68,
  // 185-08: 42 → 33. Req 6 deleted the slot-1 grounding word-badge; the 9 `it()`
  // blocks over its three faces went with it. Measured, not computed.
  // 188-12: 33 → 96. The suite has grown by 63 since; de-slacked, not lowered.
  "phaseVocabulary.test.ts": 96,
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
  "WorkflowCanvas.test.tsx": 52,
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
  "canvasModel.test.ts": 49,
  "PublishGauntlet.test.tsx": 46,
  "WorkflowBuilderPage.canvas.test.tsx": 128,
  "WorkflowBuilderPage.describe.test.tsx": 19,
  "PhaseFormPanel.test.tsx": 19,
  "WorkflowBuilderPage.test.tsx": 15,
  // 188-12: 14 → 20, inherited stale-low pin.
  "PhaseSpineGraph.test.tsx": 20,
  "soulData.test.ts": 14,
  // 21 → 23: the two end-to-end WIRE fences for CR-R5-01 (a pick whose folder is gone,
  // and a pick that survived a failed re-fetch, each asserting the `project_folder_id`
  // KEY is absent from the request the client actually sends). Both observed RED with
  // the picker's single `onChange("")` severed.
  "WorkflowDoorSwitch.test.tsx": 23,
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
  "PhaseNodeCard.test.tsx": 128,
  "PhaseNode.test.tsx": 26,
  "PhaseTimeline.test.tsx": 10,
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
  "WorkflowRunPage.test.tsx": 89,
  // 188 code-review fix pass (CR-03): 39 → 41. An EXTENSION, not a lowering — nothing was
  // deleted. The two added cases are the receipt's own reason for existing: `finish_run`
  // NULLs `threads.active_workflow_run_id` in the same transaction as the terminal status,
  // so the receipt rendered only while a run was LIVE and was absent for exactly the
  // finished run it was built for. One case pins that a cleared anchor still opens the run
  // (observed RED first), the other that the LIVE anchor still wins while a run is under
  // way — the guard against the fix drifting into "always the latest row". Both numbers
  // read from this script's own `actual` column.
  "WorkspacePanel.test.tsx": 41,
  "phaseState.test.ts": 34,
  // 188 code-review fix pass (CR-05): 12 → 17. An EXTENSION, not a lowering. The run home
  // shipped UNGATED while `WorkflowBuilderPage` gates its canvas on the identical
  // expression, so an operator flipping `visual_workflow_canvas` off produced a launch that
  // landed on a surface the pre-canvas product never had, 404'd on its own read, and
  // reported the kill switch as "deleted, or belongs to another account". Four of the five
  // cases were observed RED; the fifth is the flag-ON positive control. This also
  // discharges the render-guard assertion `revertByteIdentical.test.tsx` deferred in 181.
  "ChatLayout.launch.test.tsx": 17,
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
  "WorkflowCanvas.editing.test.tsx": 61,
  "builderStore.test.ts": 52,
  "phaseVocabulary.corpus.test.ts": 45,
  "StepTypePicker.test.tsx": 43,
  "GovernanceSection.test.tsx": 42,
  "StarterTemplatePicker.test.tsx": 40,
  "canvasNudge.test.ts": 31,
  "governanceVocabulary.test.ts": 30,
  "PhaseFormPanel.rails.test.tsx": 27,
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
  "FlowEdge.test.tsx": 22,
  // 188.1-01: 19 → 20. EXTENDED — the same move-invariant subtree-fence control, carried
  // here as well because this suite re-scopes its own five negatives and a control living in
  // another file protects another file. Twice-measured from the `actual` column.
  "WorkflowCanvas.composition.test.tsx": 20,
  "CanvasToolbar.test.tsx": 14,
  "BuilderSaveRegion.test.tsx": 11,
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
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0) // ⚠ 2502 (188.2-07)

// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
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

  console.log(`running: npx ${args.join(" ")}`)
  console.log(`   cwd: ${FRONTEND_DIR}`)
  console.log(`report: ${outFile}`)
  console.log("")

  const res = spawnSync("npx", args, {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
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
