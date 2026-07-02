---
phase: 135-self-improvement-loop-si-01
plan: 06
subsystem: ui
tags: [react, typescript, vitest, lcs, diff, api-client, self-improvement]

# Dependency graph
requires:
  - phase: 135 (Plans 04/05 — backend proposal lifecycle)
    provides: LOCKED /skills/{id}/proposals* endpoints + SkillProposal/PromotionGate response contract
provides:
  - "lineDiff.ts — pure in-repo LCS unified line diff (add/remove/unchanged), zero npm dependency (D-09)"
  - "SkillProposal + PromotionGate + ProposalApproveResult types mirroring the LOCKED backend shape (incl. D-13 honest-counts gate)"
  - "api.ts proposal helpers: propose/list/get/approve/rerun/reject/forcePromote"
affects: [135 Plan 07 (SkillEvalSection proposal card), self-improvement UI wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-repo LCS line diff (no diff/jsdiff dependency) — supply-chain-free, distinct from diffParse.ts (which parses a backend diff STRING)"
    - "Proposal api helpers copy the startEvalRun fetch + getAuthHeaders + detail-extraction shape; re-eval rides the existing eval_* SSE via re_eval_run_id (no new demux branch)"

key-files:
  created:
    - frontend/src/lib/lineDiff.ts
    - frontend/src/lib/lineDiff.test.ts
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts

key-decisions:
  - "D-09: unified line diff via in-repo LCS, zero dependency — no supply-chain checkpoint needed (package.json/lock unchanged)"
  - "D-13: PromotionGate surfaced as an optional/nullable gate object with 8 honest-count keys, populated only on the terminal promoted/not_promoted transition"
  - "Empty string treated as ZERO lines (not [\"\"]) so empty-base is all-add / empty-next is all-remove with no phantom empty-line row"

patterns-established:
  - "Pattern: pure/React-free/fetch-free lib util (lineDiff) → deterministic vitest unit test, matched to the reviewable diff the proposal card renders"
  - "Pattern: proposal-lifecycle api helpers share a proposalError() detail-extractor; authorization stays server-side (owner gate, T-135-01)"

requirements-completed: [SI-01]

# Metrics
duration: 6min
completed: 2026-07-02
---

# Phase 135 Plan 06: Proposal Frontend Contracts (lineDiff + types + api) Summary

**Pure in-repo LCS unified line diff (zero dependency, D-09) plus SkillProposal/PromotionGate types (D-13 honest-counts gate) and the full propose→approve→rerun→reject→force-promote api helper surface — the interface layer the Plan 07 proposal card wires against.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-02T03:05:22Z
- **Completed:** 2026-07-02T03:11:20Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `lineDiff.ts` — a ~55-line pure LCS unified line diff `(base, next) -> {type:'add'|'remove'|'unchanged', text}[]`; a replaced line surfaces as remove(old)+add(new); empty inputs collapse to all-add / all-remove. NO npm package added (D-09 — sidesteps the diff/jsdiff supply-chain surface, T-135-SC accepted).
- `lineDiff.test.ts` — 7 vitest cases (unchanged/insert/delete/replace/empty-base/empty-next + a base/next round-trip). TDD RED→GREEN.
- `SkillProposal` interface (LOCKED fields + 7-value status union), `PromotionGate` (8 honest-count keys, D-13), and `ProposalApproveResult` added to `types/index.ts`.
- Seven `api.ts` proposal helpers hitting the locked `/skills/{id}/proposals*` paths; re-eval rides the existing eval_* SSE via `re_eval_run_id` (no new demux branch).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing lineDiff test** - `9693d1d2` (test)
2. **Task 1 (GREEN): lineDiff LCS implementation** - `134cd7bd` (feat)
3. **Task 2: SkillProposal types + api proposal helpers** - `8a9c9508` (feat)

_Task 1 was `tdd="true"` — split into a RED test commit and a GREEN implementation commit._

## Files Created/Modified
- `frontend/src/lib/lineDiff.ts` - Pure LCS unified line diff util (add/remove/unchanged rows); zero dependency.
- `frontend/src/lib/lineDiff.test.ts` - 7 vitest cases covering every `<behavior>` case + round-trip.
- `frontend/src/types/index.ts` - Added `PromotionGate`, `SkillProposal`, `ProposalApproveResult` (after `EvalRunReadout`).
- `frontend/src/lib/api.ts` - Added `proposeImprovement`, `listProposals`, `getProposal`, `approveProposal`, `rerunProposalReeval`, `rejectProposal`, `forcePromoteProposal` + a shared `proposalError` detail-extractor; extended the `../types` import.

## Verification
- `npx vitest run src/lib/lineDiff.test.ts` → 7/7 green (run in the worktree frontend).
- Inverted tsc gate `! ( npx tsc --noEmit -p tsconfig.json | grep -Ei "lib/api|types/index|lineDiff" )` → exit 0. The full project tsc emitted **0** output lines (clean typecheck), so my files add zero type errors.
- No dependency added: `frontend/package.json` / `package-lock.json` unchanged (git status showed only the four intended files; T-135-SC acceptance criterion met).

## Decisions Made
- Kept the in-repo LCS (D-09) rather than a diff library — no supply-chain surface, no legitimacy checkpoint. `lineDiff.ts` is deliberately distinct from the existing `diffParse.ts` (which parses a backend-emitted unified-diff STRING; here the backend emits no diff so the client computes one).
- Modeled `PromotionGate` as `passed`/`no_regression`/`improved` (booleans) + `prev_pass`/`prev_fail`/`still_pass`/`newly_pass`/`excluded_not_measured` (counts), and hung it on `SkillProposal` as `gate?: PromotionGate | null` — null until the terminal gate verdict (D-13).
- `toLines("")` returns `[]` (zero lines), not `[""]`, so empty base/next produce clean all-add / all-remove with no phantom empty-line row.

## Deviations from Plan

None - plan executed exactly as written. (No code deviations; no auto-fixes required.)

## Issues Encountered
- **Test-environment path adaptation (not a code change):** the plan's verify blocks hardcode `cd "C:/Vibe Apps/Agentic RAG/frontend"` — the MAIN repo. As a worktree executor my files live in the worktree, and the worktree's `frontend/` had no `node_modules`. I created a directory junction `frontend/node_modules → <main-repo>/frontend/node_modules` (via PowerShell `New-Item -ItemType Junction`) and ran all verifications in the worktree frontend so they exercised the actual worktree files. `node_modules` is gitignored — the junction is not committed and no dependency was added.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 07 (SkillEvalSection proposal card) can now wire purely against these contracts: `lineDiff(base_instructions, proposed_instructions)` for the reviewable diff, `SkillProposal`/`PromotionGate` for typing, and the seven api helpers for the lifecycle actions. Re-eval reuses `subscribeToRun(re_eval_run_id)` — no new SSE work.
- No blockers. Backend endpoints are LOCKED (Plans 04/05); if a field name drifts at integration, it is a one-line type/helper touch here.

## Known Stubs
None - all exports are fully implemented (no placeholder/empty-return stubs).

## Self-Check: PASSED
- Files verified present: `lineDiff.ts`, `lineDiff.test.ts`, `types/index.ts`, `api.ts`, `135-06-SUMMARY.md`.
- Commits verified in git log: `9693d1d2` (RED), `134cd7bd` (GREEN), `8a9c9508` (types+api), `92aa3e24` (summary).
- Working tree clean.

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
