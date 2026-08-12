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
  "WorkflowCanvas.test.tsx": 53,
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
  "PublishGauntlet.test.tsx": 46,
  "WorkflowBuilderPage.canvas.test.tsx": 128,
  "WorkflowBuilderPage.describe.test.tsx": 19,
  "PhaseFormPanel.test.tsx": 19,
  "WorkflowBuilderPage.test.tsx": 15,
  // 188-12: 14 → 20, inherited stale-low pin.
  "PhaseSpineGraph.test.tsx": 20,
  // 189-13 (CONN-01 / UI-SPEC §5a): 14 → 17. An EXTENSION, not a lowering — the six
  // individual PHASE_GLYPHS key assertions were NOT collapsed into the new property, they
  // were kept and the seventh added beside them, because a property rewrite that shrank
  // this file would (a) trip `[count-decrease]` and (b) be exactly how coverage silently
  // disappears. The +3 are the split-brain key-set identity property, its literal-driven
  // positive control (`sameKeySet(["a","b"],["a"])` is false), and the resolver sweep that
  // proves every slug in the string map resolves to a bundled component while an inherited
  // key still floors to null. Read from THIS SCRIPT'S OWN `actual` column, never hand-counted.
  "soulData.test.ts": 17,
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
  "PhaseTimeline.test.tsx": 17,
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
  "builderStore.test.ts": 52,
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
  "ConnectionPicker.test.tsx": 20,
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
  "ConnectionsTab.test.tsx": 36,
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
  "WorkflowsPage.test.tsx": 48,
  "RunModal.test.tsx": 32,
  "RunModal.a11y.test.tsx": 16,
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
  "libraryFilter.test.ts": 48,
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
  "librarySubtree.fences.test.ts": 70,
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
  "WorkflowCard.test.tsx": 39,
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
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0) // ⚠ 3164 (192-16)

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
