---
phase: 134-eval-results-honest-verdict-ratings
plan: 4
subsystem: ui
tags: [react, typescript, eval, verdict, ratings, sse, thumbs, skills]

# Dependency graph
requires:
  - phase: 134-02
    provides: inline honest verdict engine (verdict_state graded/not_measured/judge_error, per-arm verdict columns, with-skill rollup, eval_verdict SSE)
  - phase: 134-03
    provides: owner-gated PUT rating endpoint + rating attached to the get_eval_run readout
  - phase: 133-05
    provides: the thin SkillEvalSection surface + eval api client + subscribeToRun demux (eval_* branches)
provides:
  - "Extended EvalResult/EvalRun TS types mirroring the mig-081 backend contract (verdict + rollup + rating fields)"
  - "rateEvalResult() owner-gated PUT client fn"
  - "Additive onEvalVerdict SubscribeCallbacks + eval_verdict demux branch (no return; Deep/harness byte-identical)"
  - "Enriched thin readout: honest X/N verdict line, per-arm PASS/FAIL/not-measured badge + one-line judge reason, working thumbs up/down"
affects: [137-panel-01, 135-si-01, 136-gate-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thumbs state derived from the durable readout (rate -> reload getEvalRun), never a separate store — the BUG-260701-02 stale-state discipline"
    - "Additive SSE demux branch with NO return (cursor advances; shared Deep/harness dispatch untouched) — Pattern 3"
    - "Verdict badge = pure function over verdict_state (honest not_measured/judge_error, never a fabricated pass/fail)"

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/skills/SkillEvalSection.tsx

key-decisions:
  - "Thumbs reload keys off evalRun.id (runId as live fallback), not the literal `if (runId)` — so it also fires for a completed run loaded on mount when runId is null (Rule 1 bug fix)"
  - "onEvalVerdict live reflection merged into the EXISTING `live` map (already reset in both reset paths) rather than adding new state — avoids re-introducing the stale-across-skills bug class"
  - "Build gate: tsc -b is pre-existing-broken (SEED-056 rot); verified via error-set diff (zero new tsc errors from my files) + vite build exits 0 (the real deploy gate)"

patterns-established:
  - "Pattern: verdict badge derived from durable verdict_state; PASS/FAIL only when graded"
  - "Pattern: owner-gated write then durable re-read as single source of truth (thumbs)"

requirements-completed: [EVAL-03, EVAL-04]

# Metrics
duration: 30min
completed: 2026-07-01
---

# Phase 134 Plan 04: Thin Eval Read/Rate Surface Summary

**The thin SkillEvalSection now shows an honest "X/N with-skill passed" verdict line, a real side-by-side per-arm PASS/FAIL/not-measured badge + one-line judge reason, and working thumbs up/down — wired to the mig-081 verdict/rating backend contract via extended types, `rateEvalResult()`, and an additive `eval_verdict` demux branch.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-01T19:06Z (approx — first file reads)
- **Completed:** 2026-07-01T19:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended `EvalResult` (verdict_state / verdict_passed / verdict_score / verdict_reason / judge_model + rating) and `EvalRun` (passed_count / measured_count / verdict_summary) to mirror the Plan 02/03 backend JSON contract exactly (confirmed against `eval_run.py`).
- Added `rateEvalResult()` — an owner-gated `PUT /skills/{id}/evals/results/{resultId}/rating` client fn mirroring `startEvalRun`'s fetch + `getAuthHeaders()` + error-detail shape.
- Added the optional `onEvalVerdict` callback + an additive `eval_verdict` demux branch reading the FLAT payload with **NO return** (cursor still advances; the Deep/harness dispatch above is byte-identical — T-134-13).
- Enriched the readout (undesigned, D-10): per-run honest verdict line with a `· N not measured` note, per-arm verdict badge from `verdict_state` (PASS/FAIL/not measured/judge error), a truncated one-line `verdict_reason`, and thumbs up/down whose state is derived from the durable readout (preserving the BUG-260701-02 skill-switch reset).

## Task Commits

Each task was committed atomically (only the declared source files staged by explicit path):

1. **Task 1: Extend eval types + api client** — `59fef2e9` (feat) — `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`
2. **Task 2: Enrich SkillEvalSection readout** — `a6079635` (feat) — `frontend/src/components/skills/SkillEvalSection.tsx`

**Plan metadata:** this SUMMARY + `deferred-items.md` (docs commit; STATE.md/ROADMAP.md intentionally untouched — orchestrator owns those).

## Files Created/Modified
- `frontend/src/types/index.ts` — additive verdict/rollup/rating fields on `EvalRun` + `EvalResult` (mirror mig-081); `verdict_state` typed `"graded" | "not_measured" | "judge_error" | null`.
- `frontend/src/lib/api.ts` — `rateEvalResult()`; `onEvalVerdict?` on `SubscribeCallbacks`; additive `eval_verdict` demux branch (no return).
- `frontend/src/components/skills/SkillEvalSection.tsx` — `verdictBadge()` helper; per-run verdict line; per-arm badge + one-line reason + thumbs; `handleRate()` (rate → reload durable readout); `onEvalVerdict` merged into the existing `live` map.

## Decisions Made
- **Thumbs reload source of truth.** The plan specified `if (runId) await loadReadout(runId)`. In practice `runId` is `null` when a *completed* run is loaded on mount (the mount `init()` only calls `attach()` — which sets `runId` — for a still-`running` latest run). Reloading strictly via `runId` would silently skip the post-rating refresh for the most common case (viewing a finished run). Chose `const rid = runId ?? evalRun?.id; if (rid) await loadReadout(rid)` — `evalRun.id` is always present when a result row renders, and the guard still satisfies `tsc -b`. (See Deviations — Rule 1.)
- **onEvalVerdict live wiring (the plan's "optional").** Merged the live verdict into the EXISTING `live` map (composite value, idempotent via `split(" · ")[0]`) instead of adding a new state var, because `live` is already cleared in BOTH reset paths (skill-switch block + `handleRun`). Adding a new unreset state would risk exactly the stale-across-skills class the BUG-260701-02 reset guards against. The durable readout stays authoritative.
- **Undesigned per D-10.** Plain utility Tailwind classes already used on this surface (`text-destructive`, `text-muted-foreground`, `text-emerald-500`, `truncate`); no explainer, progressive disclosure, role-gating, tabs, panels, or new design-system chrome — those are Phase 137.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Thumbs reload used `evalRun.id ?? runId`, not the literal `if (runId)`**
- **Found during:** Task 2 (thumbs handler)
- **Issue:** `runId` state is only set by `attach()`, which the mount `init()` calls solely for a still-`running` latest run. For a completed run loaded on mount, `runId` stays `null`, so the plan's literal `if (runId) await loadReadout(runId)` would rate the answer but never re-read the durable readout — the thumbs active state would not refresh until a manual reload.
- **Fix:** Reload via `const rid = runId ?? evalRun?.id; if (rid) await loadReadout(rid)`. `evalRun` is guaranteed non-null whenever a result row renders (both come from the same `loadReadout`), so the correct run is always re-read; the `if (rid)` guard keeps `loadReadout(rid: string)` type-safe.
- **Files modified:** `frontend/src/components/skills/SkillEvalSection.tsx`
- **Verification:** Type-clean (zero new `tsc` errors); thumbs state now derives from the DB re-read on both live and completed-on-mount runs.
- **Committed in:** `a6079635` (Task 2 commit)

**2. [Rule 3 - Blocking] Build-gate substitution — `tsc -b` is pre-existing-broken**
- **Found during:** Task 1 (running the plan's `cd frontend && npm run build` gate)
- **Issue:** `npm run build` = `tsc -b && vite build`. At HEAD (before any 134-04 change) `tsc -b` already exits `2` with **29 errors** across unrelated files/tests (the documented frontend rot — SEED-056 and more), so the literal "exits 0" gate is unattainable without fixing ~25 unrelated files — explicitly out of scope (SCOPE BOUNDARY).
- **Fix:** Met the gate's verifiable intent instead: (a) captured the full `tsc -b` error set with and without my changes — **both exactly 29 errors**; `comm -23` is empty except one cosmetic counter drift on the pre-existing `api.test.ts:131` `StreamCallbacks` error ("…42 more" → "…43 more", purely from adding one optional callback); **zero** errors reference `api.ts`, `types/index.ts`, or `SkillEvalSection.tsx`; (b) `vite build` (the real deploy gate — Vercel skips `tsc`) exits `0` with my changes. Logged the rot inventory + proof to `deferred-items.md`. Did NOT fix any unrelated rot.
- **Files modified:** none (verification-only); rot logged in `.planning/phases/134-eval-results-honest-verdict-ratings/deferred-items.md`
- **Verification:** error-set diff empty of new errors + `vite build` exit 0 (twice — after Task 1 and Task 2).
- **Committed in:** n/a (out-of-scope discovery; documented, not fixed)

---

**Total deviations:** 2 (1 Rule 1 bug fix, 1 Rule 3 blocking/out-of-scope).
**Impact on plan:** Rule 1 fix makes the required thumbs-persistence behavior actually work for the common completed-run case (no scope creep — 3 declared files only). Rule 3 is an honest gate substitution against pre-existing rot; my changes are provably type-clean.

## TDD Gate Compliance
N/A — plan `type: execute` (not `type: tdd`); no `tdd="true"` tasks. Frontend vitest is rotted (SEED-056); the plan's automated gate is the build, verified as above.

## Issues Encountered
- Pre-existing frontend `tsc -b` rot blocked a literal "build exits 0" reading of the gate — resolved via the error-set-diff + `vite build` substitution above (documented in `deferred-items.md`).

## User Setup Required
None — no external service configuration required. (Live rendering of the verdict line, per-arm pass/fail, honest `not_measured`, and ratings persistence/toggle is exercised by VALIDATION.md U1–U9 at `/gsd:verify-work`, not here — D-12.)

## Next Phase Readiness
- EVAL-03 (readable honest verdict + side-by-side) and EVAL-04 (ratings) are functionally closed on the thin surface; the plain-language, role-gated, designed panel remains Phase 137 (PANEL-01, G-2) as fenced.
- `onEvalVerdict` + the `eval_verdict` demux branch + `rateEvalResult()` are now part of the api contract for Phase 137 to reuse.
- Two baseline cross-provider bugs (BUG-260701-01 / BUG-260630-01) surface honestly as `not_measured` here; their fix stays deferred to SEED-100.

## Self-Check: PASSED
- Files exist: `frontend/src/types/index.ts` FOUND · `frontend/src/lib/api.ts` FOUND · `frontend/src/components/skills/SkillEvalSection.tsx` FOUND.
- Commits exist: `59fef2e9` FOUND · `a6079635` FOUND.
- Markers: `rateEvalResult` in api.ts + SkillEvalSection; `verdict_state` in types + SkillEvalSection.
- Guards: BUG-260701-02 skill-switch reset preserved (`setRunId(null)`/`setEvalRun(null)`/`setResults([])` under `useEffect([skillId])`); `grep dangerouslySetInnerHTML` → none; `eval_verdict` demux branch has no `return`.

---
*Phase: 134-eval-results-honest-verdict-ratings*
*Completed: 2026-07-01*
