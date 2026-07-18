---
phase: 136-skill-publish-gate-gate-01
plan: 03
subsystem: frontend
tags: [react, typescript, vitest, alert-dialog, publish-gate, skills, thin-ux]

# Dependency graph
requires:
  - phase: 136-01
    provides: "PublishGate JSON contract (met/state/measured/passed/passing_run_id/reason/last_override) + the GET /skills/{id}/publish-gate and PATCH /skills/{id}/toggle-global {override} wire shapes this UI mirrors"
provides:
  - "PublishGate TS interface in types/index.ts — exact 7-field mirror of the backend Pydantic model (incl last_override)"
  - "getPublishGate(skillId) api client + override-capable toggleSkillGlobal(id, override?) with typed PublishGateError on 409"
  - "useSkills().toggleGlobal(id, override?) passthrough"
  - "PublishGateDialog — the thin server-gate confirm dialog (met satisfied X/N + Publish vs honest unmet + Force publish)"
  - "SkillCard share→dialog / unshare→direct intercept"
affects: [136-04, 137-skill-evals-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render server-computed gate status only — no client-side gate math (D-07); refetch-not-optimistic on every dialog open"
    - "Typed error carrier (PublishGateError extends Error) for a structured 409 whose detail is an OBJECT {error, gate}, NOT a string — bypasses proposalError's string path"
    - "Force-publish is UX-only: it echoes override=true; the server remains the gate and records the override"
    - "Thin/undesigned publish UX reusing the AlertDialog primitive — no new design chrome (137 fence)"

key-files:
  created:
    - frontend/src/components/skills/PublishGateDialog.tsx
    - frontend/src/components/skills/PublishGateDialog.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useSkills.ts
    - frontend/src/components/skills/SkillCard.tsx

key-decisions:
  - "Modeled the 409 gate carrier as a named PublishGateError class (typed .gate field), mirroring the in-file ApiError idiom, rather than stuffing the gate onto Error.cause — clearer instanceof check for the dialog and consistent with the existing status-carrying error pattern"
  - "toggleSkillGlobal sends a JSON body ONLY when override is provided (private→global); the ungated unshare call (no arg) sends no body — keeps the existing unshare wire shape byte-identical (D-07)"
  - "The met branch's Publish action confirms with override=false (a real body {override:false}) so the server re-checks the gate on the actual mutation; force uses override=true — the client never assumes met"

requirements-completed: [GATE-01]

# Metrics
duration: 8min
completed: 2026-07-03
---

# Phase 136 Plan 03: Publish-Gate Thin UX (Client + Dialog + SkillCard Intercept) Summary

**The thin, deliberately-undesigned publish-gate UX: a "Share globally" confirm dialog that renders the server-computed gate status (satisfied X/N + Publish vs honest unmet + how-to-satisfy + explicit Force-publish), plus the client plumbing (PublishGate type, getPublishGate, override-capable toggleSkillGlobal + typed 409, useSkills passthrough) — the server stays the gate (D-07); the client is UX only.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-03T03:20:31Z
- **Completed:** 2026-07-03T03:28:50Z
- **Tasks:** 3 (all `type="auto"`)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **Client contracts (Task 1).** Added the `PublishGate` TS interface — an exact 7-field mirror of the backend Pydantic model from Plan 01 (`met`, `state` union, `measured`/`passed`/`passing_run_id` nullable evidence, `reason`, and the normalized `last_override: {gate_state, created_at} | null`). Added `getPublishGate(skillId)` (GET `/skills/{id}/publish-gate`, mirroring `getEvalRun`'s auth→fetch→typed-cast shape). Widened `toggleSkillGlobal` to `(id, override?)`: when `override` is provided it sends a `{ override }` JSON body; a `res.status === 409` branch parses the OBJECT `detail.gate` and throws a typed `PublishGateError` carrying the server `PublishGate` so the dialog renders the server's honest evidence (never a string-path `[object Object]`). `useSkills().toggleGlobal(id, override?)` passes the flag through and keeps the `setSkills` local `is_global` update.
- **PublishGateDialog (Task 2).** A thin confirm dialog composed only from the `@/components/ui/alert-dialog` primitives (137 fence — no new chrome). On open it refetches `getPublishGate` (refetch-not-optimistic, D-07), shows a loading spinner, then renders two branches (D-05): **met** → "Eval passed X/N on the current version." + a primary **Publish** action confirming `onConfirm(false)`; **unmet** → honest per-`state` copy (`never_evaled` / `latest_failed` / `passed_on_older_version`) + the server `reason` + a pointer to run an eval + an explicit destructive-styled **Force publish anyway** confirming `onConfirm(true)`. `onConfirm` errors (incl. a racey server 409 `PublishGateError`) surface inline and keep the dialog open; success closes it.
- **SkillCard intercept (Task 3).** The Globe click now branches on `skill.is_global`: **unshare** (global→private) stays a direct, never-gated `handleToggleGlobal()` (D-07, existing behavior, no `override`); **share** (private→global) opens `<PublishGateDialog>` whose `onConfirm(override)` calls `onToggleGlobal(skill.id, override)`. The `onToggleGlobal` prop type was widened to `(id, override?) => Promise<void>` to match the useSkills passthrough.

## Task Commits

Each task was committed atomically:

1. **Task 1: Client contracts — PublishGate type + api client + useSkills passthrough** — `c43e3fa9` (feat)
2. **Task 2: PublishGateDialog component + component test** — `d718f166` (feat)
3. **Task 3: SkillCard intercept — dialog on share, direct on unshare** — `68322b11` (feat)

## Files Created/Modified

- `frontend/src/types/index.ts` — added the `PublishGate` interface (7 fields incl `last_override`), mirroring the backend model; flat/nullable/status-union style matching `EvalRun`/`PromotionGate`
- `frontend/src/lib/api.ts` — imported `PublishGate`; added `PublishGateError` (typed `.gate` carrier); widened `toggleSkillGlobal(id, override?)` (JSON body only when `override` provided) + a 409 branch surfacing the gate object; added `getPublishGate(skillId)`
- `frontend/src/hooks/useSkills.ts` — `toggleGlobal(id, override?)` passthrough + `UseSkills` interface update
- `frontend/src/components/skills/PublishGateDialog.tsx` — NEW: the thin server-gate confirm dialog (AlertDialog primitives only)
- `frontend/src/components/skills/PublishGateDialog.test.tsx` — NEW: 2 vitest cases (met 3/3 → Publish(false); never_evaled → Force publish(true)), `@/lib/api` mocked
- `frontend/src/components/skills/SkillCard.tsx` — Globe `is_global` branch (share→dialog, unshare→direct) + mounted `PublishGateDialog` + widened `onToggleGlobal` prop type

## Decisions Made

1. **Typed `PublishGateError` over `Error.cause`.** The plan allowed either `.cause` or a typed field; I chose a named error class with a typed `.gate` field, matching the file's existing `ApiError` idiom. The dialog can `instanceof`-check and render; this reads cleaner than an untyped `.cause` unwrap.
2. **Body sent only for the share direction.** `toggleSkillGlobal` sends `{ override }` ONLY when `override` is passed (private→global). The unshare call (no arg) sends no body — the existing ungated wire shape is byte-identical, honoring D-07 ("unshare never gated").
3. **Met's Publish confirms with `override=false` (a real body).** The met branch does not skip the body — it sends `{ override: false }` so the server re-checks the gate on the actual mutation. The client never trusts its own read; the server is the gate.

## Deviations from Plan

None — plan executed exactly as written. (One environment-only setup step, not a code deviation: the git worktree ships without `node_modules`, so a Windows directory junction was created from the worktree's `frontend/node_modules` to the main checkout's `frontend/node_modules` to run `tsc`/`vitest`. `node_modules` is gitignored — the junction is not tracked and does not appear in the diff.)

## Known Stubs

None. Every rendered value in `PublishGateDialog` is server-sourced from `getPublishGate`; there are no hardcoded empty values flowing to the UI. `UNMET_COPY.passed = ""` is an intentional never-rendered map slot (the met branch renders the satisfied X/N line, not this map), not a stub.

## Threat Surface Scan

No new threat surface. This plan is a frontend-only diff (verified: `git diff --name-only` vs base shows exactly 6 `frontend/**` files — no backend / agent-loop / `threads.py` touch, D-10). The plan's registered mitigations hold: T-136-06 / T-136-03 (client-side bypass / forged gate) are mitigated because the client renders server-computed status only (no client gate math) and Force-publish merely echoes `override=true` — the actual gate + override record live server-side (Plan 02). No new network endpoints, auth paths, or schema changes are introduced here.

## Verification

- `npm run test -- PublishGateDialog --run` → **2 passed** (met 3/3 → Publish(false); never_evaled → Force publish(true))
- `npx tsc --noEmit -p tsconfig.json` → **clean (exit 0)** across the whole project incl. the new files
- `npm run test -- SkillCard --run` → "No test files found" (no SkillCard test exists — none required; acceptance is "no regressions", and tsc-clean confirms the SkillsPage consumer still type-matches)
- Diff scope confirmed frontend-only (6 files) — D-10 red line held
- G-4 lived UAT of the dialog is a phase-gate manual check (136-VALIDATION.md Manual-Only), not automated here

## Next Phase Readiness

- **Plan 04** can add the `SkillEvalSection` D-06 gate-status line + owner-visible override record reusing the same `getPublishGate` client + `PublishGate` type shipped here.
- **Phase 137 (PANEL-01, G-2)** owns the designed publish experience; this dialog is deliberately thin (AlertDialog primitive only) and is the seam it will re-skin.

## Self-Check: PASSED

- All 6 files exist on disk (2 created + 4 modified) — verified via `git diff --name-only` vs base
- All 3 task commits exist in git log: `c43e3fa9`, `d718f166`, `68322b11`
- Test suite green (2/2 PublishGateDialog) + tsc clean at HEAD

---
*Phase: 136-skill-publish-gate-gate-01*
*Completed: 2026-07-03*
