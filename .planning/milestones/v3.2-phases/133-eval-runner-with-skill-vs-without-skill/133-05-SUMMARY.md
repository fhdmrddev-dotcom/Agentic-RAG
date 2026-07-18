---
phase: 133-eval-runner-with-skill-vs-without-skill
plan: 05
subsystem: eval-runner / thin frontend surface
tags: [eval, EVAL-02, frontend, --skip-ui, pattern-3, reattach, sse-reuse, owner-scoped]
requires:
  - "evals.router — POST /skills/{id}/evals/runs + GET runs/results (Plan 04)"
  - "companion public.runs row keyed by the eval run_id (Plan 04, Pattern 3)"
  - "subscribeToRun / getActiveRuns existing run-stream client (api.ts)"
  - "getProviders settings/providers list (api.ts)"
provides:
  - "startEvalRun / getEvalRun / listEvalRuns client fns (api.ts)"
  - "SkillEvalSection.tsx — thin run/watch/results surface mounted in SkillFormDialog"
  - "onEvalCaseStarted / onEvalCaseDone / onEvalComplete additive StreamCallbacks (+ dispatch branches)"
affects:
  - "frontend/src/lib/api.ts (additive callbacks + 3 client fns — no existing dispatch touched)"
  - "frontend/src/types/index.ts (4 additive wire types)"
  - "frontend/src/components/skills/SkillFormDialog.tsx (import + 1 render block)"
tech-stack:
  added: []
  patterns:
    - "Pattern 3: the eval run wrote a companion public.runs row, so subscribeToRun carries eval_* progress with ZERO new stream code — eval_* added as additive panel-event branches (no return → cursor still advances), exactly like the harness phase_* branches"
    - "Durable readout is authoritative: getEvalRun (DB) re-fetched on eval_complete + every terminal, so results render after the Redis buffer TTL + a reload (D-06/SC#3)"
    - "Reattach discovery via listEvalRuns (the skill-scoped analog of getActiveRuns — the thin client has no ephemeral eval thread_id) + subscribeToRun(run_id, '0') verbatim"
    - "Owner-scoping is server-side only (Plan 04 .eq(user_id)); the picker is a convenience, model validation is the backend's job"
key-files:
  created:
    - "frontend/src/components/skills/SkillEvalSection.tsx"
  modified:
    - "frontend/src/lib/api.ts"
    - "frontend/src/types/index.ts"
    - "frontend/src/components/skills/SkillFormDialog.tsx"
decisions:
  - "D-07: the surface is intentionally NON-designed (plain selects + Run eval button + per-arm progress list + per-case readout); no new design-system primitives — it must NOT pre-empt the Phase 137 designed Skill Evals panel (PANEL-01, G-2)"
  - "Reattach uses listEvalRuns (durable owner-scoped status='running' discovery) instead of getActiveRuns: getActiveRuns(thread_id: UUID) reads the runs table by an ephemeral per-run eval thread the thin client never receives (eval_runs has NO thread_id column — migration 080), so the literal getActiveRuns path is unimplementable; listEvalRuns is the skill-scoped equivalent and still reattaches via subscribeToRun verbatim (zero new stream code — Pattern 3 intent honored)"
  - "eval_* events surfaced by ADDING optional callbacks + dispatch branches to the existing subscribeToRun (additive, no return — the established harness-branch pattern), NOT a bespoke EventSource"
metrics:
  duration: ~25 min
  completed: 2026-06-30
  tasks: 1
  files: 4
---

# Phase 133 Plan 05: Eval Runner Thin Functional Surface Summary

The EVAL-02 control surface: a deliberately non-designed `--skip-ui` component that lets a user pick a provider/model, press **Run eval**, watch a live per-case with-skill/without-skill progress list driven by the `eval_*` SSE events over the EXISTING run-stream client, and read a plain per-case durable results readout. Because Plan 04 wrote a companion `public.runs` row (Pattern 3), `subscribeToRun` carries the eval run with zero new stream code — the only stream-client change is three additive `eval_*` dispatch branches mirroring the harness `phase_*` precedent. The durable readout always comes from `getEvalRun` (the DB) so it survives the Redis buffer TTL and a reload (D-06/SC#3). Phase 137 (PANEL-01, G-2) owns the real designed panel; this surface stays plain on purpose so it cannot constrain it.

## What Shipped

- **`frontend/src/lib/api.ts`**:
  - `startEvalRun(skillId, {provider, model})` → `EvalRunKickoff` (POST, surfaces the backend `detail` on non-OK so a 409 in-flight / 400 unknown-model reads clearly).
  - `getEvalRun(skillId, runId)` → `EvalRunReadout` (the durable `{eval_run, eval_results}` DB readout).
  - `listEvalRuns(skillId)` → `EvalRun[]` (newest-first; the reattach-discovery analog of getActiveRuns).
  - `StreamCallbacks` gains three optional callbacks — `onEvalCaseStarted` / `onEvalCaseDone` / `onEvalComplete` — and `subscribeToRun` gains three additive `eval_*` dispatch branches (FLAT payloads read verbatim from `eval_runner_service`: `{test_case_id, variant}` / `{…, status}` / `{status}`). They sit with the other panel-event branches with NO `return`, so the Deep/harness dispatch is byte-identical and cursor advancement still fires.
- **`frontend/src/components/skills/SkillEvalSection.tsx`** (new, `{skillId}`):
  - Provider/model picker sourced from `getProviders()` (convenience only; backend validates).
  - **Run eval** → `startEvalRun` → `attach(run_id)` which subscribes the EXISTING client (`subscribeToRun(run_id, "0", …, signal)`); `eval_case_started` marks a `${case}:${variant}` arm running, `eval_case_done` records its terminal status, `eval_complete` + every terminal re-fetch the durable readout via `getEvalRun`.
  - On mount: load providers + `listEvalRuns` → show the latest run's durable readout and reattach (`attach`) if its status is still `running` (D-06).
  - Per-case with/without readout (status + output + error). An `AbortController` ref tears the subscription down on unmount / re-run (no reader leak).
- **`frontend/src/components/skills/SkillFormDialog.tsx`**: `SkillEvalSection` imported and rendered as a sibling of `SkillTestCasesSection` (mounted only for a saved skill).
- **`frontend/src/types/index.ts`**: `EvalRunKickoff`, `EvalRun`, `EvalResult`, `EvalRunReadout` — snake_case wire mirrors of migration 080 + the Plan 04 route payloads (no client reshape).

## Tasks & Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | api.ts client fns + eval_* callbacks + SkillEvalSection thin surface + dialog mount | `12bdd6ee` |

## Verification

- **FAIL-FAST tsc** (`cd frontend && npx tsc -b --noEmit`): no error references `SkillEvalSection.tsx`, the new `api.ts` fns, or `types/index.ts`. The only flagged lines are pre-existing SEED-056-family rot in unmodified files (test files, `SettingsPage.tsx`, `StreamsProvider.tsx`, `streamsStore.ts`, `MessageSkeleton.tsx`, `NavPanel.tsx`) and the two pre-existing `fileInputRef` RefObject errors in `SkillFormDialog.tsx` (lines I never touched). Zero new errors attributable to this plan — gate passes.
- **Acceptance greps:** `startEvalRun|getEvalRun` in api.ts = **3** (≥2); `Run eval` in SkillEvalSection = **2** (≥1); `subscribeToRun` in SkillEvalSection = **5** (≥1); `new EventSource` in SkillEvalSection = **0** (==0 — no bespoke stream client); `SkillEvalSection` in SkillFormDialog = **2** (import + render, ≥2).

## Deviations from Plan

**1. [Rule 3 — Blocking issue] Reattach via `listEvalRuns`, not `getActiveRuns`**
- **Found during:** Task 1 (wiring the D-06 reattach-on-mount path).
- **Issue:** The plan/must_haves describe reattach as `getActiveRuns(evalThreadId) -> subscribeToRun(run_id, "0")`. But `GET /threads/{thread_id}/active-runs` takes a thread **UUID** and queries the `runs` table by `thread_id`; the eval run's companion runs row is anchored to an **ephemeral per-run eval thread** (Plan 04 deviation #2) whose UUID is never returned to the client, and `eval_runs` has **no `thread_id` column** (migration 080). The thin client therefore has no thread id to feed `getActiveRuns` and cannot reconstruct one after a reload.
- **Fix:** Reattach discovery uses the owner-scoped `listEvalRuns(skillId)` — find the newest run whose durable `status === "running"` and reattach via `subscribeToRun(run.id, "0")` verbatim. This is the skill-scoped equivalent of "what's still streaming" and fully honors the Pattern 3 intent (reattach over the reused run-stream client, zero new stream code; the durable readout still comes from `getEvalRun`).
- **Files modified:** `frontend/src/lib/api.ts` (added `listEvalRuns`), `frontend/src/components/skills/SkillEvalSection.tsx`.
- **Commit:** `12bdd6ee`.

**2. [Rule 3 — Blocking issue] Added 4 wire types to `types/index.ts` (not in `files_modified`)**
- **Found during:** Task 1.
- **Issue:** The new `api.ts` client fns need return types; the codebase convention keeps wire mirrors in `types/index.ts` (e.g. `TestCase`, `SkillVersion`).
- **Fix:** Added `EvalRunKickoff` / `EvalRun` / `EvalResult` / `EvalRunReadout` mirroring migration 080 + the Plan 04 payloads. Additive only.
- **Files modified:** `frontend/src/types/index.ts`.
- **Commit:** `12bdd6ee`.

**3. [Rule 2 — Missing critical functionality] `eval_*` dispatch branches added to `subscribeToRun`**
- **Found during:** Task 1.
- **Issue:** "Reuse subscribeToRun verbatim" — but the existing dispatcher had NO branch for `eval_case_started` / `eval_case_done` / `eval_complete`, so those events would fall through undispatched and the live progress list could never populate.
- **Fix:** Added three optional callbacks + three additive dispatch branches following the established harness `phase_*` pattern (NO `return`, sit with the panel-event branches, Deep dispatch byte-identical). This is additive growth of the existing client, not a new EventSource — the Pattern 3 "no bespoke stream client" constraint holds.
- **Files modified:** `frontend/src/lib/api.ts`.
- **Commit:** `12bdd6ee`.

Otherwise executed as written (provider/model picker, Run eval → start → subscribe, live per-arm progress from eval_* events, durable per-case with/without readout re-fetched from getEvalRun, mounted as a SkillTestCasesSection sibling, intentionally non-designed).

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`. T-133-01 (info disclosure) + T-133-09 (provider/model tampering) stay server-side mitigations (Plan 04 owner-gate + registry validation); the thin client only renders owner-scoped route responses and treats the picker as a convenience. T-133-SC (package installs) holds — **no new frontend packages**; the surface reuses the existing run-stream client, `getProviders`, and existing design primitives (`Button`, native `select`, lucide icons).

## Known Stubs

None. The surface is fully wired against the Plan 04 routes (`startEvalRun` / `getEvalRun` / `listEvalRuns`), the reused `subscribeToRun` stream client (Pattern 3), and the `getProviders` model list. The `onDelta`/`onDone` callbacks are intentional no-ops (the eval run carries no chat deltas to this surface — only the eval_* progress + the terminal).

## Self-Check: PASSED

- FOUND: `frontend/src/components/skills/SkillEvalSection.tsx`
- FOUND: `startEvalRun` / `getEvalRun` / `listEvalRuns` in `frontend/src/lib/api.ts`
- FOUND: `SkillEvalSection` import + render in `frontend/src/components/skills/SkillFormDialog.tsx`
- FOUND commit: `12bdd6ee` (feat — thin eval runner surface)
