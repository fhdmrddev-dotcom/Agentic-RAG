---
phase: 195-show-the-deliverable
plan: 01
subsystem: testing
tags: [baseline, uat, chrome-mcp, workflow-run, workspace-files, docx, ooxml, vitest, count-gate, hot-file-ledger]

# Dependency graph
requires:
  - phase: 188-workflow-run-surface
    provides: "WorkflowRunPage's `run-deliverables` region — the shipped surface this plan MEASURES (live since 783daab5)"
  - phase: 194.1-chat-run-surface
    provides: "the tsc=33 / count-gate floor this baseline re-derives rather than inherits"
provides:
  - "195-BASELINE.md — the pre-change, command-backed record of the tree, the DB and the live surface at BASE_SHA f2eef045"
  - "BASE_SHA f2eef045096efabdf7f05a1175271272b55617b9 as an ARTIFACT, not an assumption (195-07's P7(a) reads it)"
  - "SC#1 CONFIRMED by observation on two runs — one terminal, one launched live — before any source change"
  - "Proof the BYTES transfer: 39660 on disk == workspace_files.size_bytes, CRC-clean OOXML, 5843 chars of filled prose"
  - "The mid-run-vs-terminal timing (35.7 ms), classified as a LOG not a refutation"
  - "The theme-conditional icon-token finding that constrains 195-03's one-icon-path decision"
  - "Five re-derived hot-file triples for 195-08's same-commit ledger sync"
  - "The non-regression floor every later plan compares against: tsc 33, count gate OK/3972/failed 0/pinned 3898, five suites = 150 tests / 0 failing"
affects: [195-02, 195-03, 195-07, 195-08, hot-file-ledger, D-20-acceptance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Baseline-before-change (D-16 / the 188.1 lesson): a baseline only proves something if it PREDATES the change"
    - "Orchestrator-driven browser checkpoint: the executor writes, the orchestrator (which owns Chrome MCP) measures"
    - "Byte-level deliverable proof: on-disk size == DB size_bytes, ZIP magic, testzip() CRC, OOXML skeleton, extracted <w:t> prose"
    - "Corrections recorded BESIDE originals, never over them (D-11)"

key-files:
  created:
    - .planning/phases/195-show-the-deliverable/195-BASELINE.md
  modified: []

key-decisions:
  - "SC#1 CONFIRMED (live, pre-change) at BASE_SHA f2eef045 — scope does NOT grow; 195 stays a consolidation + scoping phase"
  - "The file row precedes run-terminal by 35.7 ms — recorded as a LOG, not a refutation, because RUN-02's bar is 'when the run finishes'"
  - "D-20's three-surface bar is discharged as TWO LIVE SURFACES + ONE FIXTURE, as an explicit decision with its reason — chat structurally renders no card for a workflow deliverable (D-14)"
  - "The Word arm is recorded with its exact limit: bytes + package PROVEN, visual render INFERRED — not written as 'opened in Word: yes' and not as 'no'"
  - "The icon-token delta is THEME-CONDITIONAL: identical in the shipped dark theme, AA-bearing in light — a unification would be a dark-theme no-op and a light-theme contrast regression"

patterns-established:
  - "Arm 0 first: probe browser + reader availability at WAVE 1, never at phase close (Phase 194 lost 8 UAT rows to the opposite order)"
  - "A baseline names its blind spots: `## What this baseline does NOT claim` with 6 named limits"
  - "A baseline names its consumers: `## Consumed by` maps every figure to the plan that reads it"
  - "Zero-blocked is stated as a MEASURED FACT ('zero ⛔'), never implied by silence"

requirements-completed: [RUN-02]

# Metrics
duration: 27min
completed: 2026-08-17
---

# Phase 195 Plan 01: Pre-Change Live Baseline (D-16) Summary

**SC#1 CONFIRMED by observation at `BASE_SHA f2eef045` — two runs driven (one terminal, one launched live), the deliverable's bytes proven byte-exact and CRC-clean on disk, zero arms blocked, and three findings recorded that constrain plans 02/03/07/08.**

## Performance

- **Duration:** ~27 min of executor time (task 1 → task 3 commits), plus the orchestrator's browser drive between them
- **Started:** 2026-08-17T11:25:28Z (task 1 commit)
- **Completed:** 2026-08-17T11:51:54Z (task 3 commit)
- **Tasks:** 3 of 3 (task 2 was a blocking checkpoint driven by the orchestrator, not by an executor)
- **Files modified:** 1 (`195-BASELINE.md`) — **zero source files, by design**

## Accomplishments

- **SC#1 is now a MEASUREMENT, not an inherited claim.** CONTEXT recorded it as "measured already-satisfied *from source*"; this plan proved it on two real runs before Phase 195 touched a line of code — the D-16 / 188.1 discipline honoured in the only order that makes it worth anything.
- **The bytes were proven to transfer**, which no prior reading in this phase had established. The downloaded `.docx` is **39660 bytes on disk — byte-exact with `workspace_files.size_bytes`** — md5 `927ff3706a257a0745f44774f9f186d3`, ZIP magic `PK\x03\x04`, `testzip()` → `None` (zero CRC errors, 17 entries), a complete OOXML skeleton, and `word/document.xml` carrying **5,843 characters of real filled report prose**. None of RESEARCH's three high-cost refutations fired, so the phase's "no Python / no backend" premise holds.
- **A live run was launched and its empty state captured BEFORE the file existed** (`No files yet — this run hasn't written anything.`, `li` count 0), so the populated row is a **transition observed**, not a state found. The surface updated with **no reload** (`navigation.type` still `navigate`). DB side effects were exactly +1 / +1.
- **`BASE_SHA` is an artifact.** The planning-time expectation (`8b71e9fc`) was stale; the measured head `f2eef045` is recorded, with the stale expectation preserved beside it and the four intervening planning-only commits enumerated.
- **The baseline names its own blind spots and its own consumers** — `## What this baseline does NOT claim` (6 limits) and `## Consumed by` (every figure mapped to the plan that reads it).

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the pre-change state — DB, tree, gate, tsc, suites, BASE SHA** — `65397a8d` (docs)
2. **Task 2: Drive the live SC#1 baseline** — **no commit; measurement only.** ⚠ This was a `checkpoint:human-verify` with `gate="blocking"`, **driven by the ORCHESTRATOR via Chrome MCP, not by an executor** — the plan is `autonomous: false` for exactly this structural reason (a worktree/CLI executor has no browser tool). Its evidence was handed back for task 3 to write up.
3. **Task 3: Write the baseline record and its refutation verdict** — `2883a024` (docs)

**Plan metadata:** this summary's own commit.

## Files Created/Modified

- `.planning/phases/195-show-the-deliverable/195-BASELINE.md` — the phase's pre-change record: `BASE_SHA`, DB pre-state, the `tsc`/count-gate/five-suite floor, five re-derived hot-file triples, the P7(a) md5s, arms 0–3 verbatim, the SC#1 verdict, the named blind spots, and the consumer map.

**No file under `frontend/` or `backend/` was touched by either commit.** Asserted mechanically: `git diff --numstat 65397a8d~1 HEAD -- frontend backend` is **empty**. A baseline commit that touched source would already have contaminated the thing it exists to establish.

## Decisions Made

1. **SC#1 CONFIRMED (live, pre-change) — scope does not grow.** CONTEXT's framing is confirmed by observation. Phase 195 remains a consolidation + scoping phase.
2. **The mid-run timing is a LOG, not a defect, and the reasoning is written out** so a later reader cannot re-open it as a bug. RESEARCH's refutation table rules on this exact row, and RUN-02's bar is *"when the run finishes"* — 36 ms before terminal **is** the finish.
3. **D-20's three-surface bar ships as two live surfaces + one fixture**, recorded as a decision with its reason rather than as an omission. The fixture is the **stronger** artifact: a permanent fence that re-asserts on every suite run, versus a one-time capture that rots. Chat has no live row to capture — by construction (D-14).
4. **The Word arm states its exact epistemic limit.** Bytes and package PROVEN by machine; visual render INFERRED from a valid package plus a successful open invocation. Deliberately not "yes" (unobserved) and not "no" (false).
5. **Corrections go beside originals.** Two: the task-1 line "the download was NOT exercised" is struck through and marked **SUPERSEDED** with the reason it was correct when written; the "different design tokens" delta is marked **REFINED**.

## Headline learnings

**1. The theme-conditional token finding — this baseline's own earlier reading overstated a delta.**

| Theme | `--muted-foreground` | `--panel-muted-foreground` | Same? |
|---|---|---|---|
| **dark** (`index.css:105` / `:151`) — the shipped Deep Midnight default | `220 16% 65%` | `220 16% 65%` | ✅ **IDENTICAL** |
| **light** (`index.css:30` / `:59`) | `220 9% 46%` | `220 12% 40%` | ❌ **DIFFERENT** |

Both live rows resolved to `rgb(151, 161, 180)`, confirmed empirically with probe elements, not just read off the stylesheet. `PanelSection.tsx:85` records why the panel token exists: *"light `--muted-foreground` was 4.01:1"* — below the 4.5:1 AA floor. **Consequence for 195-03:** a "one icon path" unification onto the global token is a **no-op in every dark-theme screenshot** (so a visual diff would show nothing and could be mistaken for a safe landing) **and a measured contrast regression in light**. It must not be waved through on a dark screenshot.

**2. The 35.7 ms measurement — and why a 3-second poll could not have found it.** File `created_at` `11:45:19.676226+00`; run `updated_at` `11:45:19.711959+00`. The poll saw only `active/0 files` → `completed/1 file`; the millisecond comparison is the authoritative reading. The row appears **at the emit phase**, not meaningfully mid-run.

**3. Task 2 could not have been executed by an executor at all.** Chrome MCP lives with the orchestrator. The plan's `autonomous: false` was structural, not caution — and the split (executor writes, orchestrator measures) worked cleanly.

## Deviations from Plan

**Two, both documentation-only and both required by the plan's own acceptance criteria.**

**1. [Rule 3 — Blocking] Two residual `PENDING` literals had to be reworded**
- **Found during:** Task 3 (acceptance check `grep -c PENDING` → 2)
- **Issue:** Both remaining hits were **meta-references** to the scaffold ("replaces the task-1 `PENDING` scaffold"), not unfilled markers — but the criterion is literal and would have failed.
- **Fix:** Reworded both to "placeholder scaffold", and noted in the task-1 header that the scaffold is **since DISCHARGED**. No measurement was altered.
- **Verification:** `grep -c PENDING` → **0**
- **Committed in:** `2883a024`

**2. [Rule 2 — Missing Critical] Added a secrets sweep before committing (threat T-195-01-01)**
- **Found during:** Task 3, pre-commit
- **Issue:** The threat register requires the record carry no bearer token, Supabase key, signed URL or `.env` value. Nothing in the plan enforced it mechanically.
- **Fix:** Swept the file for `eyJ…`, `service_role`, `SUPABASE_*KEY`, `Bearer …`, `sk-…`, `X-Amz-Signature`, `token=`. The single hit was `task-1` matching `sk-[A-Za-z0-9]` case-insensitively — a false positive. **No secret present.** Run ids, thread ids and file ids are retained: they are already throughout `.planning/`.
- **Verification:** sweep clean; commit contains one planning document
- **Committed in:** `2883a024`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** None on scope or findings. Both were mechanical hygiene on a documentation artifact. No scope creep; no source file touched.

## Issues Encountered

- **The three-second DB poll was too coarse to answer the arm-2 question it was designed for.** It could not separate the file row from the run's terminal flip. Resolved by comparing the two timestamps directly at millisecond resolution — which turned an ambiguous "appeared somewhere in this 3 s window" into an exact 35.7 ms ordering. **Learning: when the question is ordering, compare timestamps; do not poll.**
- **Frontend liveness could not be probed over IPv4.** Vite binds `[::1]` only on this box, so `127.0.0.1:5173` reports down while it is running. Probed over IPv6 — the trap is already recorded in the baseline's § Environment section.
- **Task 2 was not blocked in any way.** Zero ⛔ rows, stated as a measured fact.

## User Setup Required

None — no external service configuration required. This plan read; it installed nothing, ran no migration, and issued no `UPDATE`/`INSERT` by hand. (`workspace_files` 86→87 and `workflow_runs` 226→227 are the side effects of launching one workflow **through the shipped UI**, exactly as a user would.)

## Next Phase Readiness

**Wave 1 is discharged and wave 2 is unblocked.** What later plans now have:

- **195-02** — the chat row ships as a fixture fence (`OutputFileCard.baseline.test.tsx`), with the live measurement (`[data-testid="output-file-card"]` → `null`) and the structural reason (D-14) recorded as its justification.
- **195-03** — ⚠ **must read the theme-conditional token subsection before deciding the one-icon-path.** The unification is invisible in dark and contrast-bearing in light.
- **195-07** — has `BASE_SHA f2eef045…` and both md5s. ⚠ It must name the SHA **explicitly** (never `HEAD~N`) and **plant a one-character edit to prove the check FAILS** before trusting an empty `numstat`.
- **195-08** — has the five re-derived triples. ⚠ `WorkflowRunPage.tsx` becomes the **4th** phase when 195 lands; `OutputFileCard.tsx` (6 phases) and `FilesSection.tsx` (3, at threshold) both FIRE G-5 and are **both invisible to the ledger today**.
- **Every plan** — the non-regression floor: `tsc` **33**, `count gate OK — 75/75 pinned files present, no per-file decrease, 0 failing.` (total 3972 · failed 0 · pinned 3898), and five suites at **150 tests / 0 failing**. ⚠ Four of the five are **ungated**; a green count gate says nothing about them.

**Concerns carried forward, none blocking:** SC#3 remains unexercised (no run in the live DB has >1 deliverable, and the criterion names a retired pattern corrected by D-11); D-04's blind spot stands unexamined by design; and the run surface only exists where an operator has flipped `visual_workflow_canvas` on — its cold default is `"off"`.

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `195-BASELINE.md` exists | `[ -f … ]` | ✅ FOUND |
| `195-01-SUMMARY.md` exists | `[ -f … ]` | ✅ FOUND |
| Task 1 commit | `git log --oneline --all \| grep 65397a8d` | ✅ FOUND |
| Task 3 commit | `git log --oneline --all \| grep 2883a024` | ✅ FOUND |
| Metadata commit | `git log --oneline --all \| grep 89744c97` | ✅ FOUND |
| No unfilled markers | `grep -c PENDING` | ✅ **0** |
| Exactly one verdict line | `grep -c 'SC#1 \(CONFIRMED\|REFUTED\)'` | ✅ **1** |
| Required sections | `grep -c` on both headings | ✅ 1 + 1 |
| Corrections preserved beside originals | `grep -c SUPERSEDED` / `REFINED` | ✅ 1 / 3 |
| **No source touched** | `git diff --numstat 65397a8d~1 HEAD -- frontend backend` | ✅ **EMPTY** |
| `STATE.md` / `ROADMAP.md` untouched | `git diff-tree` over all three commits | ✅ neither appears |

---
*Phase: 195-show-the-deliverable*
*Completed: 2026-08-17*
