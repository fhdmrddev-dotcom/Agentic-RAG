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
  "canvasModel.purity.test.ts": 69,
  "SeedReceipt.test.tsx": 68,
  // 185-08: 42 → 33. Req 6 deleted the slot-1 grounding word-badge; the 9 `it()`
  // blocks over its three faces went with it. Measured, not computed.
  "phaseVocabulary.test.ts": 33,
  "WorkflowCanvas.test.tsx": 31,
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
  "canvasModel.test.ts": 26,
  "PublishGauntlet.test.tsx": 24,
  "WorkflowBuilderPage.canvas.test.tsx": 128,
  "WorkflowBuilderPage.describe.test.tsx": 19,
  "PhaseFormPanel.test.tsx": 19,
  "WorkflowBuilderPage.test.tsx": 15,
  "PhaseSpineGraph.test.tsx": 14,
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
}

// Still COMPUTED, never hand-written — the reduce is the single source, so the
// trailing figure below is a note about the reduce's result and can never be the
// thing the gate reads. 946 = 804 + 7 (DescribeKbPicker 30→37) + 106 (canvas
// 22→128) + 10 (DoorSwitch 13→23) + 19 (describe.test.tsx, newly RUN and pinned)
// — the post-round-5 truth-14 correction. Was 804 = 715 + 30 + 30 + 29 (187-29
// extended; 715 = 415 + 232 + 68 after 187-25 extended; was 415 after 185-08
// lowered it, 424 at the original 184 Wave-0 pin).
const BASELINE_TOTAL = Object.values(BASELINE).reduce((a, b) => a + b, 0) // 946

// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  "src/pages/WorkflowBuilderPage.canvas.test.tsx",
  "src/components/admin/revertByteIdentical.test.tsx",
  // Added in 184.1. This suite is the ONLY thing pinning the flag-off Builder header —
  // D-181-01's Builder half was unguarded until it existed — so leaving it outside the
  // gate's blast radius would mean the one guard for a byte-identity promise could be
  // deleted without the gate noticing. It is deliberately NOT added to BASELINE: it
  // postdates the 424 pin, so it reports as `new` and its own count is free to grow.
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
