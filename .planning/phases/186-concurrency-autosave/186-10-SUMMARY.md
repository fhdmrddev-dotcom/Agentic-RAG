---
phase: 186-concurrency-autosave
plan: 10
subsystem: ui
tags: [react, vitest, publish-gauntlet, workflows, unplugin-icons, property-test]

# Dependency graph
requires:
  - phase: 186-05
    provides: the F7 fail-closed spine repair (`unknownBlock`) and the worded-verdict module this plan leaves untouched
  - phase: 186-02
    provides: the `draft_changed` publish-commit refusal — the stage whose arrival exposed the fail-open
  - phase: 182
    provides: the `grounding_fidelity` publish stage that has been emitted since, with no client row to place it
provides:
  - a `Grounding` spine node at its real pipeline position (between Pause and Golden run)
  - a running-highlight index derived from the golden-run row instead of a literal
  - F18 — a property test that reads `publish_service.py` at test time, so the client's stage table can no longer silently fall behind the server's
affects: [187, publish gauntlet, workflow builder, any backend change that adds a publish stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "server-source-as-fixture: a client table that claims to mirror a server list is pinned by reading the server's own source with `?raw` and driving one render per extracted value"
    - "exclusion-set-with-evidence: a stage may be omitted from the sweep only via a one-entry allow-list whose size is asserted and whose docblock names the line of code that proves unreachability"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx

key-decisions:
  - "F18 reads publish_service.py via Vite's `?raw` loader, NOT `node:fs` — `tsconfig.app.json` sets `types: [\"vite/client\"]` deliberately so browser code cannot reach a Node built-in, and three `node:*` imports would have added three NEW tsc errors to the 33-error baseline"
  - "`new URL(literal, import.meta.url)` is unusable in this codebase's tests — Vite statically rewrites that exact pattern as an asset reference, so `fileURLToPath` receives a non-`file:` URL and throws before any test runs (observed, not predicted)"
  - "The running-node pulse is located by the stage it belongs to (`RUNNING_STAGE_INDEX` = the row whose codes include `golden_run_timeout`), so a row inserted anywhere cannot move it"
  - "`Grounding` is INSERTED at index 5 (its true pipeline position, before the golden run) rather than appended — the append-only rule that 186-05 relied on was a workaround for the literal index, and it is gone with the literal"
  - "Counting acceptance criteria were replaced by property measurements twice more (`grep -c 'codes:'` counts the type annotation line; `grep 'i === 5'` counts a docblock explaining the literal's removal) — the code was never obfuscated to satisfy a grep"

patterns-established:
  - "Pattern: a docblock claim about another file's contents is a test, or it is not a claim — F18 replaces three phases of prose that had been false for two of them"
  - "Pattern: numeric test premises about a table's LENGTH (8 ✓ badges, the Commit-node glyph) are re-expressed against the rendered node count, so growing the table does not fail tests whose claim has not changed"

requirements-completed: [CONCUR-02]

# Metrics
duration: 55min
completed: 2026-08-01
---

# Phase 186 Plan 10: Grounding row + derived running index Summary

**The publish spine now places `grounding_fidelity` — the most likely real refusal on a KB-bound workflow — on its own `Grounding` node, the running pulse is located by stage rather than by a literal index, and the "this table mirrors the server" claim is enforced by a test that reads `publish_service.py` itself.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-01T11:20Z
- **Completed:** 2026-08-01T12:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **WR-02 closed.** `grounding_fidelity` has been emitted by `publish_service.py` since Phase 182 and had no row on the client spine, so that refusal rendered as a fully grey, unplaceable spine under the generic fallback sentence. It now blocks at a `Grounding` node sitting between `Pause` and `Golden run` — its real position in the pipeline, not a position of convenience.
- **The forgotten-stage failure mode is now caught by machine, not by memory.** F18 extracts the `stage="…"` literals from the backend source at test time and drives one render per stage. A thirteenth emission site added to the service turns this file red on the next run with no edit here.
- **No hard-coded stage index survives.** The two `i === 5` reads (the node aura and the energy comet) both became `i === RUNNING_STAGE_INDEX`, derived from the row whose codes include `golden_run_timeout`.
- **F7 is untouched and green.** Its deliberately-bogus stage still paints zero passed nodes, zero reached connectors and zero ✓ badges — the fail-closed property that covers the window between the backend adding a stage and this test catching it.

## Task Commits

1. **Task 1: F18 server-sourced stage-coverage property test (RED)** — `c36daf12` (test)
2. **Task 2: Grounding row + derived running index (GREEN)** — `8504af03` (fix)

**Plan metadata:** see the docs commit that carries this SUMMARY.

## The F18 RED output (recorded verbatim)

Run with `PublishGauntlet.tsx` **unmodified** (`git diff --stat` on the component was empty, asserted before committing):

```
❯ src/components/workflows/PublishGauntlet.test.tsx (41 tests | 1 failed)
   × places the server's `grounding_fidelity` refusal on exactly one spine node

AssertionError: expected  to have a length of 1 but got +0
- Expected   1
+ Received   0
  at PublishGauntlet.test.tsx:719  expect(blocked).toHaveLength(1)

Tests  1 failed | 40 passed (41)
```

**Exactly one failing case, and it is `grounding_fidelity`** — the plan's prediction held. No second forgotten stage exists. The two controls passed in the same run: F18a (extracted set size ≥ 11, plus the planted-literal positive control) and F18c (the exclusion set is exactly `["already_published"]`).

## The full extracted stage list

Read out of `backend/app/services/harness/publish_service.py` by `/stage="([a-z_]+)"/g` — **11 distinct values** (13 matches; `already_published` is emitted twice, at :130 and :385, and `golden_run_error` also appears in a module docstring at :41):

| # | Stage | Line(s) | Spine row |
|---|-------|---------|-----------|
| 1 | `already_published` | :130, :385 | **excluded** — see below |
| 2 | `definition_invalid` | :151 | Valid |
| 3 | `business_requirement` | :165 | Goal |
| 4 | `lint` | :180 | Structure |
| 5 | `interactive_phase` | :203 | Pause |
| 6 | `grounding_fidelity` | :239 | **Grounding — added by this plan** |
| 7 | `golden_run_timeout` | :279 | Golden run |
| 8 | `golden_run_error` | :41 (docstring), :293 | Golden run |
| 9 | `structural_gate` | :316 | Citations |
| 10 | `judge` | :362 | Judge |
| 11 | `draft_changed` | :405 | Commit |

**The one exclusion, with its evidence:** `already_published`. `api.ts:3753-3754` maps HTTP 404 → `{kind:"not_found"}` and HTTP 409 → `{kind:"already_published"}`; **neither outcome carries a `verdict`**, and the spine is driven by `verdict?.blocked_stage ?? null`, so this stage renders as its own dedicated 409 panel and cannot reach `GauntletSpine`. F18c asserts the set's size is **exactly 1** — deliberately an equality, so parking a future forgotten stage here costs a reviewer's attention rather than passing quietly.

**F18 is a superset check, not a bijection.** `not_found` is a `STAGES` code with no `stage="…"` literal behind it (the 404 arrives as its own outcome kind), and the Owner row that carries it stays — it documents the stage. Extra rows are allowed; a missing row is not.

## The icon slug

**`~icons/fluent-emoji/books` resolved** — confirmed three ways, none of them assumed:
1. `@iconify-json/fluent-emoji/icons.json` lists `books` (the fallback `open-book` was not needed).
2. `npx vite build` exits **0**.
3. The render assertion — an unverified slug ships as an EMPTY `<svg>` rather than failing the build, so presence proves nothing. The shipped Commit-node glyph test was **widened from one named row to every spine node** (non-null `<svg>` with `childNodes.length > 0`), which is what the component's own icon docblock claims and could not have delivered scoped to a single row.

`MagnifyingGlassTiltedLeft` was deliberately not reused — it is the Structure row's mark, and the icon convention is one mark per meaning.

## Test counts

| Measurement | Before | After |
|---|---|---|
| `PublishGauntlet.test.tsx` (isolation) | **29 passed / 29** | **41 passed / 41** |
| All 13 suites importing `PublishGauntlet` (isolation) | — | **211 passed / 211** |
| Full frontend suite — collected | **3556** (186-09's measurement) | **3568** (= 3556 + 12) |
| Full frontend suite — failures | 42 / 43 (186-09, two runs, differing sets) | 41 / 42 / 41 (three runs this plan) |
| `tsc -b` errors | 33 (baseline) | **33**, 0 naming a touched file |
| `npx vite build` | — | exit **0** |
| `npx eslint` on both files | — | exit **0** |
| `git diff --stat frontend/package.json` | — | **empty** (no dependency added) |

**The full-suite number is not the gate, per 186-09's finding, and this plan re-confirmed why.** `PublishGauntlet.test.tsx` reports **18 failures under full-suite parallel load and 0 in isolation** — byte-identical to the count 186-09 recorded for this file *before* any change of mine. Every one of those 18 is `Error: Test timed out in 5000ms` on a **shipped** test (Phase 103 / 127-era), the file takes 131 s under load vs 22 s alone, and **zero F18 cases appear anywhere in the failure list**. Same story for `WorkflowCanvas` and the two `WorkflowBuilderPage` suites: red in the whole-suite run, 211/211 green when the 13 importer files are run together.

## Files Created/Modified

- `frontend/src/components/workflows/PublishGauntlet.tsx` — the tenth `STAGES` row (`Grounding`, `codes: ["grounding_fidelity"]`, `Books` glyph) at index 5; `RUNNING_STAGE_INDEX` derived beside `STAGES`; both `i === 5` reads replaced; the `STAGES` docblock's append-only argument replaced by the derived-index rule plus a record that F18 now pins the table.
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — the F18 describe (2 controls + a 10-case `it.each`); the retargeted running-highlight test; the widened glyph sweep; two numeric premises re-expressed against the rendered node count.

## Decisions Made

- **Read the server source with `?raw`, not `node:fs`.** The plan prescribed `readFileSync` + `fileURLToPath`. Both halves of that spelling are wrong in this codebase and the failures were observed, not reasoned about (details under Deviations). The `?raw` form is also the idiom this very file already uses two lines above, for the component's own source.
- **`Grounding` is inserted, not appended.** 186-05 appended `Commit` partly to keep the golden-run row at the index the pulse pointed at. Appending `Grounding` would have drawn the pipeline in the wrong order to spare a literal; de-magicking the literal was the cheaper and truer fix.
- **The docblock's stale argument was replaced, not supplemented.** Its closing clause said the table is safe to extend only by appending. That is no longer the reason it is safe, and leaving it would send the next reader to the wrong invariant.
- **Numeric premises about table LENGTH were re-expressed as properties.** The shipped `draft_changed` test asserted exactly 8 ✓ badges — a fact about the table's length, not about the claim ("every check before the block passed"). It now asserts `nodeCount − 1`, so the next row addition does not fail a test whose meaning has not changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `new URL(literal, import.meta.url)` path idiom is statically rewritten by Vite**

- **Found during:** Task 1 (first RED run)
- **Issue:** The whole suite failed to collect with `TypeError: The URL must be of scheme file`. Vite has dedicated static handling for the `new URL('…', import.meta.url)` asset pattern and rewrites it, so `fileURLToPath` never receives a `file:` URL. (A probe confirmed bare `import.meta.url` *is* a proper `file:` URL — it is the `new URL(…)` wrapper specifically that is transformed.)
- **Fix:** First `path.resolve(fileURLToPath(import.meta.url), "../../../../../…")`, which worked; then superseded by the `?raw` import below.
- **Verification:** The suite collected and produced the intended RED.
- **Committed in:** `c36daf12`

**2. [Rule 3 - Blocking] Three `node:*` imports added three NEW `tsc -b` errors**

- **Found during:** Task 2 (typecheck)
- **Issue:** `tsconfig.app.json` sets `types: ["vite/client"]` and nothing else — `src/**` is browser code and deliberately cannot see Node built-ins. `node:fs` / `node:url` / `node:path` each produced `error TS2307`, taking the baseline from 33 to 36.
- **Fix:** Replaced the whole Node-built-in approach with `import publishServiceSource from "../../../../backend/…/publish_service.py?raw"` — the same Vite `?raw` loader this file already uses for the component source. **Adding `"node"` to the app tsconfig was rejected**: it would let shipped browser code reach `process`/`Buffer` without the typechecker objecting, a permanent widening bought to satisfy one test file.
- **Verification:** `tsc -b` back to **33 == baseline**, 0 errors naming a touched file; suite still 41/41; the extraction is proven non-vacuous by the 10 `it.each` cases existing at all.
- **Committed in:** `8504af03`

**3. [Rule 1 - Bug] The visible "8-stage gauntlet" sentence became false**

- **Found during:** Task 2
- **Issue:** The resting publish form tells the author *"Publishing runs the full **8-stage gauntlet**"*. That was defensible at 9 rows (8 checks + the commit); `Grounding` is a ninth **check**, so the rendered claim my row makes is now wrong.
- **Fix:** One line — *"Publishing runs the **full gauntlet above**"*. The count is removed rather than incremented, so the sentence cannot go stale again; the spine it points at is rendered directly above it. No test asserts on this text.
- **Verification:** 41/41 green; the historical "8-stage" mentions in unrelated docblocks (`api.ts`, the modal-shell comments) were left alone as out of scope.
- **Committed in:** `8504af03`

**4. [Rule 2 - Missing Critical] The icon docblock's own invariant had already expired**

- **Found during:** Task 2
- **Issue:** The component's icon import block claims *"the newest addition here is pinned by a render assertion in the suite"*. That assertion was scoped to the **Commit** node by name, so it stopped covering "the newest addition" the moment `Grounding` was added — and an unverified fluent-emoji slug renders as an empty `<svg>` instead of failing the build.
- **Fix:** Widened the test from one named row to a sweep over every spine node (with a `> 1` guard against a vacuous loop).
- **Verification:** 41/41 green; the sweep exercises all 10 glyphs including `books`.
- **Committed in:** `8504af03`

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug, 1 missing critical)
**Impact on plan:** No scope creep — every fix is inside the two files the plan declares. Deviations 1 and 2 changed the *mechanism* F18 uses to read the server source, not the property it asserts.

## Issues Encountered

**Two more acceptance criteria were unsatisfiable as literally written — the eighth and ninth of this phase.** Both were resolved by measuring the property, never by bending the code:

- `grep -c "codes:" PublishGauntlet.tsx` was specified to count **10**; it counts **11**, because the `STAGES` type annotation line contains `codes: string[]`. It was always N+1 (it counted 10 when there were 9 rows). Measured instead as `grep -c 'codes: \['` → **10**, which counts rows and only rows.
- `grep -n "i === 5"` was specified to return **nothing**; it returned my own new docblock sentence explaining that the literal had been removed. Reworded to state the same fact without the token ("a bare index literal, compared against the loop counter in two separate places"), so the fence stays a real guard on the code. Verified more strongly than the plan asked: `grep -nE 'i === [0-9]'` over the whole file returns nothing, and no bare numeric index comparison survives anywhere inside `GauntletSpine`.

## User Setup Required

None — no external service configuration, no migration (head stays 114), no dependency, no env var.

## Next Phase Readiness

- **Newly observable in manual UAT:** `186-VALIDATION.md` row 3 ("Publish race") can now show a *placed* block for a grounding refusal instead of an all-grey spine. That row remains to run — it is deliberately not a plan task.
- **For 186-12 / 186-13 (waves 7-8):** this plan touched no backend file, no migration and nothing under `frontend/src/hooks/`, so `useDraftPersistence.ts` is exactly as 186-09 left it.
- **Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-02` stays as it is — WR-02 is one of three blockers plus four warnings, and 186-12 / 186-13 are still outstanding. ROADMAP plan-progress is the orchestrator's write.
- **Carry-forward for any future plan touching a frontend test that must read a file:** use `?raw`. `node:fs` costs three tsc errors and `new URL(…, import.meta.url)` is rewritten by Vite before it runs.

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
