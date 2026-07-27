---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 01
subsystem: testing
tags: [vitest, tooling, gate, fluent-emoji, unplugin-icons, iconify, react, workflow-canvas]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    provides: "The shipped `soulData.PHASE_GLYPHS` single-source glyph vocabulary, `phaseGlyph()`/`PHASE_GLYPH_MARKS` render-time resolver, and the 16-file / 424-test Wave-0 suite this plan pins"
  - phase: 127-icon-convention
    provides: "The build-time-bundled `~icons/fluent-emoji/<slug>` deep-subpath convention that makes a missing slug a build failure"
provides:
  - "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file test-COUNT differential gate, falsified and green, callable by every later Wave-0 plan"
  - "`llm_agent` → `compass` and `llm_batch_agents` → `handshake` live in BOTH glyph maps, as one independently revertable three-file commit"
  - "A named-reason, exit-code-honest gate shape for count differentials that other phases can copy"
affects: [184-02, 184-03, 184-04, 185, 187, 188, wave-0-extractions, phase-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file test-COUNT differential (not failures-only) as committed, falsified tooling that ships BEFORE the work it measures"
    - "Scratch/report artifacts written to the OS temp dir, never inside a reload-watched tree"
    - "Cross-cutting vocabulary decisions ship as their own atomic commit, separate from the tooling that measures them"

key-files:
  created:
    - scripts/vitest-count-gate.cjs
  modified:
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/soulData.test.ts
    - frontend/src/lib/phaseGlyph.tsx

key-decisions:
  - "D-184-08's count gate ships as its own single-file commit BEFORE any Wave-0 source change, so the icon swap it carves out is itself measured by it"
  - "The icon swap touches five places in one commit — both maps, both imports, the verified-slugs docblock, and the one pinned assertion — because swapping one map alone is a silent split-brain"
  - "The plan's `npm run build` exit-0 criterion was unsatisfiable on an untouched checkout (`tsc -b && vite build` with 33 pre-existing errors); split into a DIFFERENTIAL tsc count + `npx vite build` exit 0, per D-ITEM-183-01"
  - "Stale docblocks naming the retired slugs were reworded to name them as HISTORY, not current truth (D-ITEM-183-02 — a guard that only passes by making a comment lie is a broken guard)"
  - "The live in-app five-surface sweep is deferred to phase verification as a G-4 row; the operator substituted stronger mechanical evidence (measured luminance + rendered-against-real-tokens screenshot) because Docker Desktop was down"

patterns-established:
  - "Count-gate shape: module-level BASELINE keyed by bare filename, named failure reasons in brackets, exit 0/1/2, pinned/actual/delta table, increases allowed and printed as +N"
  - "A gate must be falsified before it is trusted — delete a test, observe the named failure, restore, observe green, record both observations"

requirements-completed: [CANVAS-02]

# Metrics
duration: 51min
completed: 2026-07-27
---

# Phase 184 Plan 01: Wave-0 Measuring Stick + the Cross-Cutting Glyph Swap Summary

**A falsified per-file vitest count gate (`scripts/vitest-count-gate.cjs`, pinning 16 files / 424 tests / 0 failing) landed first as baseline infrastructure, then `llm_agent → compass` and `llm_batch_agents → handshake` swapped across both glyph maps, both `~icons` imports, the verified-slugs docblock and one carved-out assertion — as a standalone three-file commit that `git revert` undoes without touching the gate or any canvas code.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-07-27T07:57:00Z
- **Completed:** 2026-07-27T08:48:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint, operator-resolved)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- **The D-184-08 measuring stick exists and has teeth.** `scripts/vitest-count-gate.cjs` pins per-FILE counts, not just the failure count — the Phase-177 lesson that a failures-only differential cannot see a *deleted* test. It was falsified (see below) before it was trusted, and it shipped in its own single-file commit BEFORE any Wave-0 source change, so plans 184-02 and 184-03 can call `node scripts/vitest-count-gate.cjs` unconditionally.
- **The two cross-cutting icon swaps landed atomically in five places.** `soulData.PHASE_GLYPHS` (the string fallback), `phaseGlyph.PHASE_GLYPH_MARKS` (the bundled 3D component map), both `~icons/fluent-emoji/*` deep-subpath imports, the "verified slugs" docblock, and the one pinned assertion. PATTERNS.md §W0a was right that this is five places, not one — swapping `PHASE_GLYPHS` alone would leave `phaseGlyph()` returning the old 3D component while the string fallback changed, a silent split-brain.
- **The D-184-07 revert unit is clean.** `git show --stat ffb3e9cf` lists exactly the three icon files; the gate script is NOT among them. `git revert ffb3e9cf` undoes the icon decision alone and leaves the gate standing.
- **Zero collateral movement.** 424/424 with every per-file delta at 0, `tsc` at 33 (equal to the `develop` baseline, none of them naming a phase file), canvas snapshot byte-unchanged, `frontend/` working tree clean after every gate run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Ship the D-184-08 per-file test-count differential gate** — `4a019bd8` (chore) — exactly one file: `scripts/vitest-count-gate.cjs`
2. **Task 2: Swap both glyph maps to compass + handshake** — `ffb3e9cf` (feat) — exactly three files, the standalone revert unit
3. **Task 3: Five-surface before/after check** — checkpoint, operator-resolved with substituted mechanical evidence (no code change; no commit)

## Files Created/Modified

- `scripts/vitest-count-gate.cjs` — **created.** Spawns `npx vitest run <Wave-0 targets> --reporter=json --outputFile=<os.tmpdir()>` with `cwd=frontend`, parses `numTotalTests` / `numFailedTests` / per-suite `assertionResults.length` keyed by bare filename, and gates on four named reasons. Imports nothing from `frontend/src`; needs no database, backend or network.
- `frontend/src/components/workflows/soulData.ts` — `PHASE_GLYPHS` now carries `llm_agent: "compass"` and `llm_batch_agents: "handshake"`; the other four entries untouched. Comment records the swap, its rationale and the re-verification date.
- `frontend/src/lib/phaseGlyph.tsx` — imports `Compass` / `Handshake` from their deep subpaths, `PHASE_GLYPH_MARKS` repointed, and the verified-slugs docblock rewritten to enumerate `gear, memo, compass, handshake, raised-hand, package` against the INSTALLED `@iconify-json/fluent-emoji@1.2.7` set.
- `frontend/src/components/workflows/soulData.test.ts` — the one carved-out assertion (below), plus a docblock honesty fix.

## D-184-08 carve-out — the one edited assertion

**File:** `frontend/src/components/workflows/soulData.test.ts`
**Lines:** `:132-133` (inside the `toMatchObject` glyph-map block of the test `"maps the 6 phase types to the verified fluent-emoji slugs exactly"`)

| | Old | New |
|---|---|---|
| `llm_agent` | `"robot"` | `"compass"` |
| `llm_batch_agents` | `"busts-in-silhouette"` | `"handshake"` |

**This is the ONLY permitted assertion edit in phase 184.** Every other plan in this phase — the Wave-0 extractions 184-02 and 184-03 in particular — is under a **zero-assertion-edit gate**: an assertion that *has to* change means the extraction was not behaviour-preserving, and that is the signal, not an inconvenience. This one is carved out because the swap is a deliberate vocabulary decision rather than a behaviour-preserving refactor, and it carries its own revert story and its own before/after check.

**Proof it was the only one:** `git show ffb3e9cf -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'` reports exactly one file (`soulData.test.ts`, 11 insertions / 4 deletions), and the only executable-code change in that diff is the two map lines above. Every other line in that file's diff is a comment.

**Two non-assertion docblock edits shipped in the same commit, deliberately** (D-ITEM-183-02 — the "a comment that lies" trap that fired five times in Phase 183):

1. `soulData.test.ts:11-15` — the module docblock listed `robot` / `busts-in-silhouette` as the CURRENT verified slugs. Reworded so the retired names are named as **history**, not current truth. The acceptance grep is deliberately scoped to map entries and imports precisely so a historical mention stays legal.
2. `soulData.test.ts:124-132` — an inline comment added above the assertion naming it as the D-184-08 carve-out, so a future reader (or verifier) does not read the edit as a gate violation.

Neither is an assertion. Both are enumerated here so the count is unambiguous: **1 assertion edit, 2 docblock honesty fixes, 0 test-count changes** (`soulData.test.ts` still reports exactly its pinned 14).

## Count-gate falsification observation

A gate that has only ever passed is not evidence. The control, run against Task 1's committed script:

**Falsified —** temporarily deleted one `it(...)` block (`"partial -> MIDDLE"`) from `frontend/src/components/workflows/deriveTier.test.ts`:

```
  deriveTier.test.ts                            9       8      -1
  total                                       424     423      -1
RESULT: COUNT GATE VIOLATED (2 reason(s))
  FAIL  [total-below-baseline] total 423 < pinned 424.
  FAIL  [count-decrease] deriveTier.test.ts — pinned 9, ran 8 (-1). A test was deleted or skipped away.
```
→ **exit 1**, naming the file and the decrease. A failures-only differential would have reported this tree as green.

**Restored —** `git checkout -- frontend/src/components/workflows/deriveTier.test.ts`, re-ran:

```
  total                                       424     424       0
  total 424  ·  failed 0  ·  pinned total 424
count gate OK — 16/16 pinned files present, no per-file decrease, 0 failing.
```
→ **exit 0**. `git status --porcelain frontend/` clean, confirming the control left nothing behind.

**Resolved report path:** `C:\Users\fhdmr\AppData\Local\Temp\vitest-count-gate-<pid>-<timestamp>.json` — i.e. `os.tmpdir()`, which on this machine resolves to `C:\Users\fhdmr\AppData\Local\Temp\`. Concrete instance from the post-swap run: `C:\Users\fhdmr\AppData\Local\Temp\vitest-count-gate-39896-1785125503138.json`. This is **outside `frontend/` and outside `backend/`** (T-184-01-03): a scratch file in a reload-watched tree wedges the vite/uvicorn watchers on Windows. The script does not merely prefer this — `assertOutsideWatchedTree()` hard-refuses (exit 2) any report path resolving inside either directory. `git status --porcelain frontend/` was clean after every one of the four gate runs in this plan.

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `node scripts/vitest-count-gate.cjs` | exit 0, total ≥ 424, failed 0, no per-file decrease, 16/16 present | **exit 0** — 424/424, 0 failing, every per-file delta **0**; `soulData.test.ts` exactly 14 |
| `node --check scripts/vitest-count-gate.cjs` | parses | **OK** |
| Gate falsification | a deleted test is caught by name | **exit 1**, `[count-decrease] deriveTier.test.ts` (see above) |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (D-ITEM-183-01 differential) | **33** — equal to baseline; **0** of them name `phaseGlyph` or `soulData` |
| `npx vite build` | exit 0 (proves both `~icons` subpaths resolve) | **exit 0**, built in 4.56s |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0** (pathspec confirmed to match the real `canvasModel.fixtures.test.ts.snap` — an empty pathspec would pass vacuously) |
| Old-slug grep (map entries + imports only) | no matches | **none** in all three files |
| Positive greps | `llm_agent: "compass"`, `llm_batch_agents: "handshake"`, `import Compass from "~icons/fluent-emoji/compass"`, `import Handshake from "~icons/fluent-emoji/handshake"`, `llm_agent: Compass`, `llm_batch_agents: Handshake` | **all present** |
| Directly-affected suites | green | `soulData.test.ts` 14 · `WorkflowSoul.test.tsx` 8 · `PhaseSpineGraph.test.tsx` 14 = **36/36 passed** |
| Task 1 commit scope | exactly 1 file | `4a019bd8` — `scripts/vitest-count-gate.cjs` only |
| Task 2 commit scope | exactly 3 files, gate script absent | `ffb3e9cf` — the three icon files; gate script **not** present |

**Slug presence pre-check (T-184-01-01):** before editing, both `compass` and `handshake` were confirmed present in the installed `@iconify-json/fluent-emoji@1.2.7` `icons.json`. The green `vite build` is the authoritative proof — an unresolvable `~icons/fluent-emoji/<slug>` fails the build — but the pre-check meant a failure would have been diagnosable rather than mysterious.

## Task 3 — checkpoint resolution and the evidence substituted for the live sweep

The plan's Task 3 is a blocking five-surface visual check (workflows card, run + publish soul headers, gauntlet stages, live step cards). I started the Vite dev server (v8, ready in 1027 ms, HTTP 200 at `http://localhost:5173/`, compiling clean) and stopped, emitting `## CHECKPOINT REACHED` rather than self-approving a visual judgement.

**Docker Desktop was down** (ports 54322 / 54321 / 8000 all refused; `docker info` fails), so local Supabase and the backend were unavailable and sign-in — hence the in-app sweep — was impossible. The operator explicitly did **not** rubber-stamp it. Instead they verified the substance mechanically and directed that the evidence be recorded here, because it is stronger than a bare "operator said ok":

**1. Luminance measured directly from the installed `@iconify-json/fluent-emoji@1.2.7` `icons.json`** (mean of all `#rrggbb` stops in each icon body, Rec.709 weights):

| icon | mean luminance | stops |
|---|---|---|
| busts-in-silhouette (OLD) | **33.3** | 34 |
| robot (OLD) | 127.8 | 53 |
| handshake (NEW) | **181.4** | 66 |
| compass (NEW) | 155.8 | 53 |
| gear / memo / package (unchanged band) | 171.9 / 161.5 / 144.2 | — |

This **independently reproduces the sketch's claim** — the sketch recorded 34.5 and 182.6; measurement gives 33.3 and 181.4. `busts-in-silhouette` at 33.3 is a severe outlier against the 144–172 band of every other mark. The swap is justified by measurement, not taste.

**2. Both marks rendered against the real Deep Midnight tokens and screenshotted.** Using `--background 216 45% 4%` and `--card 220 30% 7%`, read from `frontend/src/index.css:94,96`, in Chrome. Result: the OLD `busts-in-silhouette` is nearly invisible — dark blobs dissolving into the background, which is precisely the defect. Both NEW marks render as full 3D fluent-emoji marks, clearly legible, visually in-band with the unchanged `gear`/`memo`/`package` reference row. **No blank box and no text-glyph fallback on either.**

**3. Coverage argument for the five surfaces.** `npx vite build` exit 0 proves `~icons/fluent-emoji/compass` and `/handshake` resolve globally. All five surfaces read the same `PHASE_GLYPHS` / `phaseGlyph()` map with **no per-surface override** — that is exactly why one map swap moves five shipped surfaces. So the specific failure the sweep guards against (an unresolved binding rendering blank or falling back to a text glyph) is excluded by (2) + (3) together.

**Deferred to phase verification (G-4 row, NOT a gate on these two commits):** the live in-app five-surface confirmation, to be run once Docker Desktop + Supabase + uvicorn are up. What remains unproven by the mechanical evidence is per-surface *composition* — sizing, the icon well behind the mark, and crowding at each of the five call sites — not the mark's resolution or its legibility, both of which are now measured.

## Decisions Made

- **The gate ships before the thing it measures, in its own commit.** The alternative (bundling it with the icon swap) would have made the icon commit a four-file, non-revertable unit and left the gate unmeasured against the only Wave-0 change available to test it on.
- **Both maps move together or not at all.** Enforced by putting them in one commit and running the gate across the whole blast radius immediately after.
- **Increases are allowed, decreases are not.** Feature waves legitimately add tests; the gate prints `+N` in yellow and passes. Only a decrease, a missing file, a failing test, or a total below 424 fails it. Wave 0 must not change any count — and did not.
- **Stale docblocks were fixed, not left standing.** Naming the retired slugs as current truth would be the exact D-ITEM-183-02 trap. They are now named as history, which the deliberately narrow acceptance grep keeps legal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run build` exit-0 criterion split into a differential tsc count + `npx vite build`**
- **Found during:** Task 2 (verification)
- **Issue:** The plan's acceptance criterion "`npm run build` exits 0" is **unsatisfiable on an untouched checkout**. `frontend/package.json` defines `"build": "tsc -b && vite build"`, and `tsc -b` carries the 33 pre-existing `develop` errors (in `SettingsPage`, `OrgProvider`, `StreamsProvider`, `streamsStore` and others — none in this phase's blast radius). `npm run build` therefore exits 2 on `develop` with zero changes applied. Treating it as a gate would either block a correct commit or invite blessing away a pre-existing condition.
- **Fix:** Split it into the two gates it was actually asking for — (a) a **differential** `npx tsc -b 2>&1 | grep -c "error TS"` ≤ 33, and (b) `npx vite build` exit 0, which is the real `~icons` presence proof and the same path Vercel uses (`vite` skips `tsc`). No source change; nothing blessed.
- **Files modified:** none
- **Verification:** tsc **33** (equal to baseline, 0 phase-file names); `npx vite build` **exit 0** in 4.56s
- **Committed in:** `ffb3e9cf` (verification only — no file change)
- **Operator disposition:** **ACCEPTED and confirmed correctly reasoned.** The operator independently re-measured 33 immediately before dispatch and noted that the split matches D-ITEM-183-01, which makes every `tsc` gate in this phase differential.

**2. [Rule 2 - Missing Critical] Two stale docblocks reworded so they name the retired slugs as history**
- **Found during:** Task 2
- **Issue:** `soulData.test.ts:11-13` listed `robot` / `busts-in-silhouette` as *the verified fluent-emoji slugs*. After the swap that sentence is false. D-ITEM-183-02 is explicit that a comment which lies is a defect, and it fired five times in Phase 183 — the plan itself scopes the acceptance grep to map entries and imports precisely so a corrected docblock naming the old slugs as history stays legal.
- **Fix:** Reworded the module docblock to name `robot` / `busts-in-silhouette` as **retired by Phase 184-01 Task 2 / D-184-07 … kept here as HISTORY, not as current truth**, and added an inline comment above the assertion identifying it as the D-184-08 carve-out. The same honesty edit was applied to `phaseGlyph.tsx`'s verified-slugs docblock (place 4 of 5 — that one was already in the plan's scope).
- **Files modified:** `frontend/src/components/workflows/soulData.test.ts`
- **Verification:** Neither edit is an assertion; both are enumerated under the carve-out section above. Count unchanged at 14. The scoped old-slug grep still returns no matches.
- **Committed in:** `ffb3e9cf`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical)
**Impact on plan:** Neither expands scope. Deviation 1 replaces an impossible gate with the two measurable gates it stood for — and is stricter in the direction that matters, since it forbids any tsc *increase*. Deviation 2 is required by a locked project rule that the plan itself anticipated. No scope creep; still exactly 1 created file + 3 modified files across two commits.

## Issues Encountered

- **Local Supabase / Docker Desktop down.** Blocked the live five-surface sweep and also blocked a psycopg2 query I attempted, to name concrete live workflows containing `llm_agent` / `llm_batch_agents` steps for the operator. Resolved by the operator's substituted mechanical evidence; the live sweep is deferred to phase verification as a G-4 row.
- **`npm run build` failing on an untouched tree** — diagnosed as the pre-existing 33-error `tsc` baseline rather than a regression from the swap, and handled as Deviation 1 rather than by "fixing" 33 unrelated errors out of scope.
- The Vite dev server started for the checkpoint is **still running in the background** on port 5173. Harmless, and useful for the deferred live sweep, but worth knowing.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-01-01 (tampering — icon subpath imports) | mitigate | **CLOSED.** Slug presence enforced by the build itself; `npx vite build` exit 0 verified, not assumed. Both slugs additionally pre-checked against the installed `icons.json` |
| T-184-01-02 (info disclosure — rendered marks) | accept | Unchanged. Icon slugs are static asset names; no user/org/tenant data, no authz decision |
| T-184-01-03 (tampering — gate report path) | mitigate | **CLOSED.** Report written under `os.tmpdir()`; `assertOutsideWatchedTree()` hard-refuses (exit 2) any path inside `frontend/` or `backend/`. `git status --porcelain frontend/` clean after all four gate runs |
| T-184-01-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `zundo` remains absent and is plan 184-04's job with its own legitimacy audit |

## Scope Fence Compliance

- **Frontend + `scripts/` only.** Nothing under `backend/` touched; `git show --stat` on both commits confirms.
- **No migration.** No file created under `supabase/migrations/`.
- **No env var changed.**
- **No dependency added.** `frontend/package.json` and the lockfile are absent from both commits.
- **No watch-mode flag** committed anywhere; `--reporter=json` only, never the vitest-4-removed `--reporter=basic`.

## User Setup Required

None — no external service configuration required. (Docker Desktop + Supabase + uvicorn need to be up to run the deferred live five-surface sweep, but that is existing local dev infrastructure, not new setup.)

## Next Phase Readiness

- **Plans 184-02 and 184-03 are unblocked.** They can call `node scripts/vitest-count-gate.cjs` unconditionally in their verify steps; the baseline it pins is green at 424/424 as of `ffb3e9cf`.
- **The zero-assertion-edit gate is now armed for the extractions.** The one carve-out is spent. Any assertion edit in 184-02 or 184-03 is a signal that the extraction was not behaviour-preserving.
- **Carry into phase verification:** the live five-surface G-4 row (above). One row, needs Docker up.
- **Note for later Wave-0 plans:** if a plan legitimately adds tests, the gate passes and prints `+N` — but the BASELINE constant in the script stays pinned to the Wave-0 numbers on purpose. Re-pinning it is a deliberate act for a future wave, not routine maintenance.

## Self-Check: PASSED

- `scripts/vitest-count-gate.cjs` — FOUND
- `frontend/src/components/workflows/soulData.ts` — FOUND
- `frontend/src/components/workflows/soulData.test.ts` — FOUND
- `frontend/src/lib/phaseGlyph.tsx` — FOUND
- Commit `4a019bd8` — FOUND
- Commit `ffb3e9cf` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
