---
phase: 135-self-improvement-loop-si-01
plan: 09
subsystem: ui
tags: [react, typescript, skills, self-improvement, fastapi-422, fetch]

# Dependency graph
requires:
  - phase: 135-self-improvement-loop-si-01
    provides: "the SI-01 proposal lifecycle backend routes (approve/reject/rerun/force-promote) + the SkillEvalSection proposal card"
provides:
  - "forcePromoteProposal sends an explicit empty JSON body so the force-promote POST succeeds instead of 422ing (CR-01 frontend half — Truth 4)"
  - "proposalError renders a readable message for FastAPI 422 array-detail bodies instead of '[object Object]' (WR-04)"
  - "the approved proposal status renders a Reject escape action, not just a spinner (CR-03 frontend half — Truth 2)"
affects: [135-verification, 135-08, skill-eval-studio, self-improvement-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-guarded error-detail extraction: assign detail only when typeof detail === 'string', else generic fallback"
    - "Status-split render branch: transient 'approved' gets an escape action; genuinely in-flight 're_evaling' stays spinner-only"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/skills/SkillEvalSection.tsx

key-decisions:
  - "Send JSON.stringify({}) as belt-and-suspenders per REVIEW.md CR-01 — works whether or not the parallel 135-08 backend change lands"
  - "Split the combined approved/re_evaling branch so only 'approved' (a wedged state on refetch) offers Reject; 're_evaling' keeps the spinner"

patterns-established:
  - "Error-detail render guards on typeof string to avoid leaking / stringifying FastAPI 422 detail arrays"
  - "Escape affordance reuses the existing proposed-branch Reject Button idiom (size sm, variant outline, X icon, void handleReject)"

requirements-completed: [SI-01]

# Metrics
duration: ~10min
completed: 2026-07-02
---

# Phase 135 Plan 09: Self-Improvement Proposal Card — Frontend Gap Closure Summary

**Force-promote now sends an empty JSON body, 422 validation errors render readably instead of "[object Object]", and a wedged `approved` proposal offers a Reject escape — closing the frontend halves of CR-01/CR-03 and the WR-04 warning.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-02T14:58:00Z (approx.)
- **Completed:** 2026-07-02T15:08:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- **CR-01 (frontend half):** `forcePromoteProposal` now sends `body: JSON.stringify({})`, so the "Force promote anyway" button succeeds against the force-promote route instead of 422ing on every click (verification Truth 4 re-verifiable, frontend half).
- **WR-04:** `proposalError` widened the parsed type to `{ detail?: unknown }` and now assigns `detail` only when `typeof j?.detail === "string"`, so a FastAPI 422 `detail` **array** renders the generic `${fallback} (status ${res.status}).` fallback instead of `"[object Object]"`.
- **CR-03 (frontend half):** the combined `approved`/`re_evaling` spinner branch was split — `re_evaling` keeps the spinner-only "Re-evaluating…" text, while `approved` (a state that is transient in the happy path and therefore signals a wedged loop when it persists on refetch) now renders the spinner text PLUS a Reject escape wired to `handleReject`, preserving the human-in-the-loop guarantee (verification Truth 2 re-verifiable, frontend half).

## Task Commits

Each task was committed atomically:

1. **Task 1: Force-promote empty body (CR-01) + string-guarded error detail (WR-04)** - `d4a06223` (fix)
2. **Task 2: Escape action for the wedged approved proposal (CR-03 frontend)** - `14347160` (fix)

## Files Created/Modified
- `frontend/src/lib/api.ts` - `forcePromoteProposal` fetch options now include `body: JSON.stringify({})`; `proposalError` guards the detail assignment on `typeof j?.detail === "string"`.
- `frontend/src/components/skills/SkillEvalSection.tsx` - split the `approved`/`re_evaling` render branch; `approved` now renders the spinner text plus a Reject escape button (reusing the `proposed`-branch Reject Button idiom).

## Decisions Made
- **Belt-and-suspenders empty body (CR-01):** sent `JSON.stringify({})` rather than waiting on the parallel `135-08` backend change — the plan and REVIEW.md both recommend BOTH sides, and `{}` works whether or not `135-08` lands. `getAuthHeaders()` already sets `Content-Type: application/json`, so no header change was needed.
- **Status-split over shared branch (CR-03):** kept `re_evaling` spinner-only (a genuinely in-flight re-eval) and gave only `approved` the Reject escape, because `approved` is transient in the happy path (it flips to `re_evaling` in the same approve response) — a persistent `approved` means the re-eval launch failed and the loop is wedged. `rejectProposal` accepts ANY status server-side (`reject_skill_proposal` has no state guard), so the escape reliably frees a wedged proposal.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verifications (grep source assertions + `npx tsc --noEmit` filtered to touched files) passed on first run.

## Issues Encountered
- Initial Edit calls targeted the shared-checkout path and were rejected by the worktree isolation guard; re-issued against the worktree copies. No effect on the diff.

## Cross-Provider Note
Per the CLAUDE.md / D-16 red line: all three changes are pure request-shape, error-render, and UI-affordance edits with NO provider forks and NO new dependency. The proposal surface stays provider-agnostic; the supply-chain surface is unchanged (zero `package.json` edits).

## Threat Surface
No new security-relevant surface introduced beyond the plan's `<threat_model>` (T-135-12/13/SC). The frontend adds no client-trusted authority — force-promote and the new Reject both hit owner-gated server routes; the button only changes which request is sent, never the authorization. No `## Threat Flags` needed.

## Known Stubs
None — both edits wire real behavior (real request body / real DB-backed reject via `handleReject`); no placeholder values, hardcoded empties, or unwired data sources introduced.

## Next Phase Readiness
- Truths 2 and 4 of `135-VERIFICATION.md` are now re-verifiable from the UI (frontend halves closed). Backend halves of CR-01/CR-03 ship in the parallel plan `135-08` (no file overlap).
- Live confirmation of the button click (U10 force-promote path) is covered by the SC#10 4-axis UAT in `135-VALIDATION.md`, run via `/gsd:verify-work` after both gap plans ship — not part of this plan.

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
