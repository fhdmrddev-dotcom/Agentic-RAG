---
phase: 067-frontend-streaming-ux-fix
verified: 2026-05-07T16:30:00Z
status: human_needed
score: 5/6 must-haves verified (UX-067-01..05 verified; SC#6 partial — Gap-007 escalated)
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "SC#6 LangSmith trace hygiene under synthetic per-call timeout"
    expected: "LangSmith ChatOpenAI sub-trace shows clean TimeoutError with NO GeneratorExit at run_helpers.py:1680 (D-066-11 invariant)"
    why_human: "Already exercised live in Plan 05 Task 4 (run 7558735c-3a2f-446f-b678-2c735be91871, sub-trace f40572ae-61a3-4cfd-9c19-fe88e9feaed8) — GeneratorExit IS present at the prohibited line. Disposition is decided at orchestrator level: this is a Phase 066 carry-forward (SC#6) the phase scoped but did not own — Gap-007 has been escalated to a follow-on focused phase. Verifier cannot programmatically re-run LangSmith MCP to confirm or close; orchestrator/human must accept the partial closure (mirrors Phase 063.1 precedent: UAT partial / project-level approved) or block on Gap-007."
gaps: []
deferred:
  - truth: "SC#6 (Phase 066 closure) — LangSmith trace shows clean TimeoutError with NO GeneratorExit at run_helpers.py:1680"
    addressed_in: "Phase 068+ (Gap-007 follow-on)"
    evidence: "067-HUMAN-UAT.md SC#6 row + Gap-007 section: 'D-066-11 stream.close() invariant violated under synthetic-timeout conditions. ChatOpenAI sub-trace f40572ae... records GeneratorExit at run_helpers.py:1680. Status: open — escalated to follow-on focused fix phase.' Phase 067's own SCs (UX-067-01..05) all green; SC#6 is a Phase 066 deferral that 067 attempted to close as a courtesy. The architectural fix belongs to a follow-on phase that audits agent_runner.py stream-close ordering against D-066-11. 067-HUMAN-UAT.md project_level_approval is 'approved' on the Phase 063.1 / 066 precedent: project-level approval decoupled from UAT-file status when phase-owned deliverables are green and the partial closure is on a deferred (not phase-owned) sub-criterion."
---

# Phase 067: Frontend Streaming-UX Fix — Verification Report

**Phase Goal:** Restore real-time first-paint of streaming agent events so the chat surface renders progressively while the agent runs — without requiring a manual page refresh — and close the five carry-forward UX issues (UX-067-01..05) surfaced incidentally by Phase 066's live UAT. After this phase lands, re-run Phase 066 Plan 05 Task 2 protocol (synthetic per-call timeout) to close out SC#6 live verification (banner + Resume + LangSmith clean).

**Verified:** 2026-05-07T16:30:00Z
**Status:** human_needed (5-of-6 SCs fully verified; SC#6 partial closure with Gap-007 escalation requires orchestrator/human disposition)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth (ROADMAP SC) | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | UX-067-01 — First-paint works without refresh | VERIFIED | Plan 01 Task 1 reorder of `subscriptionsRef.current.set(run_id, controller)` to fire BEFORE the runId-stamping `setMessages` confirmed in source at `useMessages.ts:554` (set) → `:561` (setMessages); audit comment block at `:522-538`. Live UAT (run `213740c9-fa29-423d-be00-5ca1d16653f2`) confirms first SSE delta visible within ~1s. |
| 2   | UX-067-02 — `runStatus` state machine in sync; "Saving response…" only at proper time | VERIFIED | (a) Existence-check guards in BOTH terminal-flip blocks at `useMessages.ts:622` (sendMessage) + `:866` (reconcile). (b) "Saving response" literal absent from `frontend/src/` (Grep returned 0 matches). (c) `MessageItem.tsx:140` shows `: null /* D-067-02: no mid-stream chrome */`. Live evaluate_script returned `[]` across 4 separate runs. |
| 3   | UX-067-03 — Refresh-recovery path remains healthy | VERIFIED | Pre-existing Phase 061+ replay-tail wiring untouched by Plan 01-04; verified live by Plan 05 Task 1 (run `1ddd4bda-38e6-41c3-a6f4-94e1adc7da46`, F5 mid-stream during clockmaking essay → full ~9000-char essay restored, no duplicate bubble). |
| 4   | UX-067-04 — Redis consumer cancellation is clean (no traceback on tab cycle) | VERIFIED | Plan 03 source verified at `runs.py`: module-top alias import at `:52`; three `except asyncio.CancelledError` clauses at `:113, :194, :236` each followed by `raise`; three `except RedisTimeoutError` clauses at `:123, :202, :247`; canonical INFO substring at `:130, :209, :252`. All three monkey-patched cancellation tests in `tests/api/test_runs_cancellation.py` PASS (3/3 in 0.15s). Live UAT (run `566d1583-4db5-43d5-89af-df1f4bc19e7a`): 0 Tracebacks in uvicorn scrollback after F5. |
| 5   | UX-067-05 — Tool-call iteration boundaries surfaced | VERIFIED | Plan 02 source verified: `iteration?: number` at `types/index.ts:46` with D-067-03 doc comment; `let currentIteration = 0` at `useMessages.ts:60`; `iteration: currentIteration` stamps at `:96` (preparing) + `:138` (running fallback); `data-testid="iteration-divider"` at `ToolCallPanel.tsx:677`; `Step {tc.iteration + 1}` label at `:682`. Live UAT (run `e59815c8-a2e6-4778-9c01-d9826ba9a91a`): 1 divider rendered with "Step 2" label, `data-iteration="1"`, no divider above first iteration (Pitfall 4 confirmed). |
| 6   | SC#6 — Phase 066 closure (synthetic per-call timeout → banner + Resume + LangSmith clean) | PARTIAL | **4-of-5 sub-criteria green (frontend banner, Resume button, runs.status='timed_out', runs.error format).** **1 sub-criterion red:** LangSmith ChatOpenAI sub-trace `f40572ae-61a3-4cfd-9c19-fe88e9feaed8` records `GeneratorExit` at `run_helpers.py:1680` — the EXACT line D-066-11 invariant requires absent. Escalated as **Gap-007**. This is a Phase 066 carry-forward (architectural ownership lives in `agent_runner.py` close-before-cancel ordering, not in Phase 067's frontend-state-machine + xread-cancellation scope). |

**Score:** 5/6 truths fully verified; 1 deferred to Phase 068+ via Gap-007 escalation.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SC#6 — LangSmith trace shows clean TimeoutError with NO GeneratorExit at run_helpers.py:1680 | Phase 068+ (Gap-007) | `067-HUMAN-UAT.md` Gap-007 section: "D-066-11 stream.close() invariant violated under synthetic-timeout conditions... Status: open — escalated to follow-on focused fix phase." Phase 066's automated `test_066_langsmith_clean.py` was a unit test of wrapper logic in isolation; the timeout-cancellation pathway under real `asyncio.timeout` was never actually exercised pre-067. Plan 05 Task 4 was the first live exercise and surfaced the latent bug. The fix belongs in agent_runner.py / langsmith-py interaction layer, NOT in the four files Phase 067 modified (useMessages.ts, MessageItem.tsx, ToolCallPanel.tsx, runs.py). |

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `frontend/src/hooks/useMessages.ts` | (a) reorder set BEFORE setMessages; (b) audit comment; (c) existence-check terminal flips; (d) iteration counter + stamping | VERIFIED | All 4 invariants present and confirmed via Grep (line refs above). |
| `frontend/src/components/chat/MessageItem.tsx` | "Saving response…" deleted; D-067-02 marker | VERIFIED | Line 140 reads `: null /* D-067-02: no mid-stream chrome */`. "Saving response" Grep returns 0 matches across `frontend/src/`. |
| `frontend/src/components/chat/ToolCallPanel.tsx` | data-testid="iteration-divider" with `Step N` label | VERIFIED | Line 677 (testid) + line 682 (label `Step {tc.iteration + 1}`). |
| `frontend/src/types/index.ts` | ToolCall.iteration?: number with D-067-03 comment | VERIFIED | Line 46 with D-067-03 JSDoc at lines 43-45. |
| `backend/app/api/runs.py` | RedisTimeoutError alias + 3 differentiated handlers | VERIFIED | Line 52 alias; 3× CancelledError (113/194/236); 3× RedisTimeoutError (123/202/247); 3× canonical INFO substring (130/209/252); 3× logger.exception preserved for genuine RedisError (136/173/215/258). `(RedisError, OSError)` tuple preserved at site #3 (verified in source). |
| `backend/tests/api/__init__.py` | Package marker | VERIFIED | Created. |
| `backend/tests/api/test_runs_cancellation.py` | 3 tests covering CancelledError, RedisTimeoutError, ConnectionError | VERIFIED | 3 async test functions defined (lines 78, 120, 175). Canonical substring at line 51. **Behavioral spot-check: 3/3 PASS in 0.15s** via `pytest tests/api/test_runs_cancellation.py -x -q`. |
| `backend/.env` | RUN_HARD_TIMEOUT_SECONDS removed | VERIFIED (operator-side) | File is gitignored — Glob returns no files in repo. SUMMARY 04 documents this as operator-machine action; runtime impact is zero (Pydantic `extra="ignore"` at config.py:245 already drops the var silently). |
| `backend/.env.example`, `supabase/SETUP.md`, `REDIS-SETUP.md` | RUN_HARD_TIMEOUT_SECONDS absent | VERIFIED | Grep returns 0 matches in all three. |
| `backend/app/config.py:366-371` | Dead-code documentation comment preserved | VERIFIED | Line 368 contains the legacy comment (intentionally preserved per plan must_haves). |
| `backend/tests/integration/test_061_hard_timeout.py:44` | Deletion-guard test docstring preserved | VERIFIED | Line 44 contains the docstring reference (intentionally preserved). |
| `.planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` | 6 SC rows with concrete evidence | VERIFIED | All 6 rows present; 5 green + 1 partial (SC#6) with Gap-007 detail; concrete run_ids, banner text, SQL row, LangSmith trace_id all inline. |
| `.planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` | per-task map populated | VERIFIED | All 5 rows have status (4× ✅ green + 1× ⚠️ partial for Plan 05); frontmatter `status: partial`, `nyquist_compliant: partial`, `wave_0_complete: true`. |
| `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` SC#6 row | Updated with Phase 067 closure note | VERIFIED | SC#6 row marked `partial` with run_id `7558735c-...` evidence + closure note section appended at line 100-102 + sign-off line at line 242. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| useMessages.ts sendMessage POST→subscribe handoff | subscription slot reservation BEFORE the runId-stamping setMessages | reorder | WIRED | `subscriptionsRef.current.set(run_id, controller)` at line 554 fires BEFORE `setMessages((prev) => prev.map(...))` at line 561. |
| useMessages.ts sendMessage onTerminal | guarded setMessages updater that no-ops on missing assistantId | `prev.some((m) => m.id === assistantId)` | WIRED | Line 622: `if (!prev.some((m) => m.id === assistantId)) return prev`. |
| useMessages.ts reconcile onTerminal | guarded setMessages updater that no-ops on missing targetId | `prev.some((m) => m.id === targetId)` | WIRED | Line 866: `if (!prev.some((m) => m.id === targetId)) return prev`. |
| MessageItem.tsx hasAnyTools branch | no 'Saving response…' literal | replacement with `: null` | WIRED | Line 140: `: null /* D-067-02: no mid-stream chrome */`. |
| useMessages.ts onIterationStart | closure-tracked currentIteration counter | `currentIteration = iteration` | WIRED | Line 60 declaration; line 296 update inside onIterationStart. |
| useMessages.ts onToolPreparing/onToolStart | ToolCall objects stamped with iteration | spread literal | WIRED | Line 96 (preparing); line 123 (preparing-upgrade defensive `tc.iteration ?? currentIteration`); line 138 (running fallback). |
| ToolCallPanel.tsx render loop | Step N divider DOM | conditional `i > 0 && tc.iteration !== undefined && prevToolIteration !== undefined && tc.iteration !== prevToolIteration` | WIRED | Line 674-689 (boundary helper at 644-655 + conditional render at 674; testid at 677; label at 682). |
| runs.py replay xread Site 1 | differentiated handler | except priority chain | WIRED | Lines 113-141: CancelledError (113-122) re-raises; RedisTimeoutError (123-135) INFO + sentinel + return; RedisError (136-141) logger.exception + sentinel + return. |
| runs.py replay xread Site 2 | differentiated handler | except priority chain | WIRED | Lines 194-222: same shape. |
| runs.py replay xread Site 3 (post-BLOCK probe) | differentiated handler with (RedisError, OSError) preserved | except priority chain | WIRED | Lines 236-261: CancelledError + RedisTimeoutError + (RedisError, OSError) tuple preserved at end. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| MessageItem.tsx banner | `message.runStatus` / `message.stopped` | useMessages.ts terminal-flip in sendMessage onTerminal (line 622-631) + reconcile onTerminal (line 866-874) | YES — flowed from real SSE terminal events through guarded setMessages updaters; live UAT (run 7558735c-...) confirmed banner text "Agent reached time limit" rendered when runs.status='timed_out' | FLOWING |
| ToolCallPanel iteration-divider | `tc.iteration` | onToolPreparing (line 96) / onToolStart (line 138) stamping currentIteration counter from onIterationStart (line 296) | YES — counter populated from `iteration_start` SSE event payload; live UAT confirmed `data-iteration="1"` on the rendered divider | FLOWING |
| runs.py SSE error event yield on RedisTimeoutError | `{"type": "error", "error": "redis_timeout"}` | All three xread sites yield sentinel before return; producer-task is left untouched per D-061-03 try/finally:pass invariant | YES — `test_xread_redis_timeout_logs_info_no_traceback` test asserts `body['type'] == 'error'` on the first yielded event | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compile (frontend) | `cd frontend && npx tsc --noEmit -p tsconfig.json` | exit 0, no output | PASS |
| Backend xread cancellation tests | `cd backend && venv/Scripts/python.exe -m pytest tests/api/test_runs_cancellation.py -x -q` | `3 passed, 1 warning in 0.15s` | PASS |
| "Saving response" literal absent in frontend/src | Grep | 0 matches | PASS |
| RUN_HARD_TIMEOUT_SECONDS absent in operator-facing surfaces | Grep on .env.example, supabase/SETUP.md, REDIS-SETUP.md | 0 matches each | PASS |
| Settings has no run_hard_timeout_seconds field | Grep `run_hard_timeout_seconds` in config.py | Only the dead-code comment at line 368 (no class attribute declaration) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| STREAM-04-polish | All 5 plans (frontmatter `requirements: [STREAM-04-polish]`) | Continuation polish of v2.5 STREAM-04 (closing UX-067-01..05 dossier from Phase 066). NOT formally listed in REQUIREMENTS.md (parent STREAM-04 is "Complete" at Phases 061+062+063) — the "-polish" suffix denotes follow-on UX work scoped under the same milestone-level requirement. | SATISFIED (informal) | Phase 067 owns the polish-tier work atop STREAM-04. ROADMAP entry for Phase 067 lists 6 numbered Success Criteria; 5/6 verified, 1 deferred to Phase 068+ via Gap-007. |

**Note on STREAM-04-polish:** This requirement ID is plan-frontmatter local — REQUIREMENTS.md formally lists STREAM-04 as Complete (Phases 061+062+063). The "-polish" suffix marks UX cleanup work that does not belong to a separate roadmap requirement. No orphaned requirements under REQUIREMENTS.md filter for Phase 067.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | — |

No anti-patterns detected. All Plan 01-04 commits verify cleanly:
- No TODO/FIXME/PLACEHOLDER comments introduced.
- No empty handlers, hardcoded empty data flowing to render, console.log-only implementations.
- All Phase 063.1 invariants preserved (guardedSetMessages, reconcileInFlightRef, lastSeenOffsetRef, BL-03 ordering, MERGE-preserve filter) — confirmed via Grep counts in 067-01-SUMMARY.md verification table.
- Phase 062 D-062-14 file-layout discipline respected — Plan 03 only touched runs.py + tests/api/, no leak into threads.py.

### Human Verification Required

#### 1. SC#6 LangSmith Trace Hygiene Disposition

**Test:** Decide whether Phase 067 closes with `passed` (accepting Gap-007 as a deferred carry-forward to Phase 068+) or `gaps_found` (blocking on the SC#6 LangSmith hygiene sub-criterion).

**Expected (per phase narrative):** Phase 067's OWN scope (UX-067-01..05) is fully delivered; SC#6 was a Phase 066 deferral that 067 attempted to close as a courtesy. The 5 phase-owned UX issues are all green. The architectural fix for Gap-007 lives in agent_runner.py close-before-cancel ordering (Phase 066's territory + langsmith-py interaction), NOT in any of the four files Phase 067 modified.

**Why human:** Disposition mirrors Phase 063.1 precedent (`partial` UAT, `approved` project-level). The verifier cannot programmatically:
1. Re-run LangSmith MCP to re-test Gap-007 (would not change the outcome — the fix is in a follow-on phase).
2. Decide whether to accept the 5/6 split as `passed` (Phase 063.1 / 066 precedent) or treat the SC#6 sub-criterion failure as a Phase-067-blocking gap.

**Recommendation:** Accept `passed` per the Phase 063.1 / 066 precedent. Phase 067 plans 01-04 deliver every must_have they scoped. Plan 05 was scoped as a verification harness (autonomous: false) and faithfully reported the partial closure with concrete LangSmith trace evidence. Gap-007 is a NEW finding surfaced by Phase 067's UAT — the correct disposition is to escalate (which the team did) rather than block 067 on a Phase 066-architecturally-owned bug.

### Gaps Summary

**No phase-owned gaps.** All Plans 01-04 deliverables match their must_haves verbatim in committed code:

- Plan 01 — useMessages.ts handoff reorder + existence-check terminal flips + MessageItem.tsx fallback deletion: VERIFIED (4 commits: a83479d, 51f4a9d, ee603ff, 0936772).
- Plan 02 — ToolCall.iteration field + counter + Step N divider: VERIFIED (3 commits: 8096362, bf3e486, e165bfe).
- Plan 03 — runs.py differentiated xread handlers + tests: VERIFIED (3 commits: 27c0b6c, 4c9de8e, e0ed4dc); 3/3 tests pass.
- Plan 04 — RUN_HARD_TIMEOUT_SECONDS cleanup: VERIFIED (no-op on tracked surfaces; gitignored .env is operator-side).

**One deferred item** (SC#6 sub-criterion → Gap-007) is a Phase 066 architectural carry-forward that Phase 067 attempted to close but could not because the underlying invariant (D-066-11 stream.close() ordering) is implemented in agent_runner.py / langsmith-py interaction — outside the 4 files Phase 067 modified. Documented and escalated in 067-HUMAN-UAT.md and reflected in 066-HUMAN-UAT.md SC#6 row update.

The phase ships its OWN deliverables green; the open carry-forward is honestly accounted for via Gap-007 escalation. Status routing as `human_needed` because the orchestrator/human must explicitly accept the partial-with-Gap-007 closure (mirroring Phase 063.1 precedent) — programmatic verification cannot decide the sub-criterion-vs-phase-scope tradeoff.

---

_Verified: 2026-05-07T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
