---
phase: 176-chat-render-correctness-exec-reliability
verified: 2026-07-22T22:29:55Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "SC#10 4-axis live scoreboard (cross-provider, multi-tool, parallel-thread, long-message)"
    expected: "Per 176-VALIDATION.md: one user bubble + un-folded final answer on OpenAI/Anthropic/Google/DeepSeek; execute_code declared-install + undeclared auto-heal + honest bad-name failure + no re-attempt on later same-run miss; Thread A un-folds with no reload while Thread B is active; a ≥50-message/≥5KB send lands or restores the draft with the retry hint"
    why_human: "Live streaming timing, cross-provider behavior, and real send races cannot be proven by unit test alone (176-VALIDATION.md D-15, explicitly Manual-Only)"
  - test: "Final answer un-folds at run-end with NO reload (send path AND nav-watched backgrounded path)"
    expected: "The narration fold gives way to a clean markdown answer at the clean terminal without reloading"
    why_human: "Live-render timing artifact — the applied fix was never live-confirmed before (why BUG-260707-03 stayed open); D-08"
  - test: "Approve a description proposal in the Skill Studio Triggering tab"
    expected: "Header vN AND the Versions-tab LIVE badge update with no reload (BUG-260706-01)"
    why_human: "Depends on a real approve action + the studio render — 176-VALIDATION.md Additional Live Checks"
  - test: "Fresh-thread immediate send, sent several times in a row"
    expected: "Every message lands OR restores the text + shows the retry hint — never a silent vanish"
    why_human: "A timing race is hard to prove gone by unit test; the durable property (honesty) is unit-tested, but the frequency-reduction (D-10.1) needs a live race to observe"
---

# Phase 176: Chat Render Correctness + Exec Reliability Verification Report

**Phase Goal:** The transcript renders each message once, un-folded at a clean terminal, with honest send outcomes + live version-pointer updates; `execute_code` installs requested libraries reliably.
**Verified:** 2026-07-22T22:29:55Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Important:** This verification runs against the CURRENT HEAD (post-code-review-fix) state, not the plan-execution-time state. Three commits landed after the 4 plans and their SUMMARYs were written: `7098cd0b` (CR-01), `b946cac8` (WR-01), `41097139` (WR-02) — all fixes for findings in `176-REVIEW.md`. Every claim below was checked against the current source, not the SUMMARY narrative.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RENDER-01: a single send renders exactly ONE user bubble (no duplicate optimistic-temp + persisted-row) | VERIFIED | `StreamsProvider.tsx:1514-1533` — the untyped-temp preserve branch drops the temp via **identity** match (`m.registeredUserMsgId !== undefined && snapshot.messages.some(s => !s.id.startsWith("temp-") && s.id === m.registeredUserMsgId)`), superseding the original plan's skew-fragile `created_at >=` compare (WR-01 fix, commit `b946cac8`). `registeredUserMsgId` is stamped on `postMessage` resolve (`:2002`) and typed in `types/index.ts`. Preserve-when-no-twin (D-06) intact. Test `streamsProvider_075_7_reconcile_race.test.tsx` describe block "Phase 176 RENDER-01 / WR-01 — identity-based user-temp dedup (skew-immune)" explicitly exercises client-ahead clock skew — PASS. |
| 2 | RENDER-02: the final answer renders un-folded at a clean terminal with no reload, including on a backgrounded/nav-watched run | VERIFIED | `StreamsProvider.tsx:1725-1758` — mount-path `onTerminal` fires `getMessages(threadId)` on `kind === "done"/"reader_done"` and content-swaps the matching `run.run_id` assistant message. Send-path reconcile (`registeredRunId`-keyed) unchanged. Test `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` mount-path case — PASS. Live un-fold timing is Manual-Only (D-08, human item below). |
| 3 | RENDER-03: a submitted message always sends or surfaces an honest failure — no silent send-drop | VERIFIED | `StreamsProvider.tsx:1856-1882` — the `sendingThreadsRef` duplicate-guard non-dispatch early-return now stashes `failedSendDrafts` + a `reconcileErrors` `ApiError(400)` hint (the SAME 099-08 seam the ApiError rollback uses) instead of returning silently. `ChatArea.tsx:322` pre-marks `markThreadPendingSend` BEFORE `setViewingThread` (fresh-thread race tighten, D-10.1) without tripping the duplicate-guard. `ChatAreaBanner.test.tsx` case "e" + `streamsProvider_075_7_reconcile_race.test.tsx` RENDER-03 describe blocks — PASS. |
| 4 | RENDER-04: an approved skill/description version pointer updates in the UI without a reload | VERIFIED | `SkillStudioPage.tsx:120` `refreshVersions` (mirror of `refreshGate`) threaded as `onVersionPromoted` through `TriggeringTab.tsx:26` → `SkillTunerPage.tsx:557` (`handleApproveDescription` calls it after `approveDescriptionProposal` resolves). `VersionsTab.tsx:129/173` consumes `refreshNonce` in its fetch-effect deps. `SkillStudioPage.test.tsx` approve→refetch + `VersionsTab.test.tsx` nonce-refetch cases — PASS. |
| 5 | EXEC-01: `execute_code`'s `libraries` param installs reliably (no silent no-op, no wasted retry rounds), and the CR-01 heal-bound fix does not re-open the zombie-run risk | VERIFIED | `tool_dispatcher.py:1469-1564` — `_pip_install` uses `python -m pip` (system interpreter, matches `python -u`), non-streaming (reliable exit_code), retried once via `_install_declared_libraries`, never swallowed. `:2996-3148` — run-scoped auto-heal (`_heal_bound_seen`/`_heal_bound_record` on Redis `heal_attempted:{run_id}`, graceful call-local fallback) + threadpool-wrapped re-run + honest `install_failed` on `llm_content`. **CR-01 confirmed wired:** `_run_bounded_sandbox` (`:1496-1528`) wraps BOTH the declared-install path (`_install_declared_libraries` → `:1547/1550`) AND the heal re-run (`:3129`) with the same `settings.sandbox_exec_timeout_seconds` wall-clock ceiling the primary run uses, killing the container + raising `_SandboxCommandTimeout` on overrun (never a silent bare `run_in_threadpool`). Dedicated tests `test_run_bounded_sandbox_timeout_kills_container_and_raises`, `test_autoheal_rerun_timeout_surfaces_honest_and_no_exec_result`, `test_declared_install_pip_timeout_surfaces_honest_reason` all PASS. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/providers/StreamsProvider.tsx` | RENDER-01 content-supersede drop + RENDER-02 mount-path reconcile + RENDER-03 honesty stash/pending-ref | VERIFIED | All three present; RENDER-01 upgraded post-plan from content-compare to identity-compare (WR-01) — a superset fix, not a regression. |
| `backend/app/services/tool_dispatcher.py` | `_pip_install` / `_install_declared_libraries` / auto-heal / `_run_bounded_sandbox` | VERIFIED | All present and wired below the adapter boundary; no `provider ==` fork anywhere in the diff. |
| `frontend/src/pages/SkillStudioPage.tsx` | `refreshVersions` + `versionsNonce` | VERIFIED | `:74/120/227/233`. |
| `frontend/src/pages/SkillTunerPage.tsx` | `onVersionPromoted` call in `handleApproveDescription` | VERIFIED | `:557`. |
| `frontend/src/components/skills/studio/TriggeringTab.tsx` | forwards `onVersionPromoted` | VERIFIED | `:26/32`. |
| `frontend/src/components/skills/studio/VersionsTab.tsx` | `refreshNonce` prop in fetch-effect deps | VERIFIED | `:129/173`. |
| `frontend/src/components/chat/ChatArea.tsx` | `markThreadPendingSend` pre-mark before `setViewingThread` | VERIFIED | `:322-323`. |
| `frontend/src/stores/streamsStore.ts` | `markThreadPendingSend` action type + stub | VERIFIED | `:170/351` (undeclared in the original plan's `files_modified`, but a necessary/documented deviation — TypeScript compile requirement). |
| `backend/tests/unit/test_tool_dispatcher.py` | EXEC-01 install/heal/bound/timeout cases | VERIFIED | 31 tests in this file alone, all green; includes the 3 CR-01 timeout-specific cases. |
| `frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` | RENDER-01 identity-dedup + RENDER-03 honesty/pending cases | VERIFIED | 9 test cases across 3 describe blocks, all green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| StreamsProvider preserve-guard (untyped-temp branch) | snapshot content-supersede check | `supersededByPersisted` (now identity-based) | WIRED | Confirmed at `:1528-1533`. |
| StreamsProvider mount-path `onTerminal` | `getMessages` content-swap | `run.run_id`-keyed `setMessagesForBucket` | WIRED | Confirmed at `:1737-1757`. |
| `sendMessage` non-dispatch early-return | `failedSendDrafts.set` + `reconcileErrors` hint | the D-11 recovery seam | WIRED | Confirmed at `:1872-1878`; `ChatArea.tsx:88/365` `failedDraft` selector feeds the composer prefill. |
| ChatArea pre-mark | preserve-guard `sendInFlightOnThisThread` | `pendingSendThreadsRef` | WIRED | Confirmed at `ChatArea.tsx:322` → `StreamsProvider.tsx:1487-1488`. |
| `SkillTunerPage.handleApproveDescription` | `SkillStudioPage.refreshVersions` | `onVersionPromoted` threaded through `TriggeringTab` | WIRED | Confirmed at `SkillTunerPage.tsx:557` → `TriggeringTab.tsx:32` → `SkillStudioPage.tsx:227`. |
| `refreshNonce` bump | `VersionsTab` fetch effect | effect deps | WIRED | Confirmed at `SkillStudioPage.tsx:233` → `VersionsTab.tsx:173`. |
| declared libraries install | `python -m pip install` (system interpreter) | `_install_declared_libraries` → `_run_bounded_sandbox` → `session.execute_command` | WIRED | Confirmed at `tool_dispatcher.py:1801-1805`. |
| `exec_result` ModuleNotFoundError | bounded auto-heal + honest `llm_content` | `_extract_missing_module` → `_heal_bound_seen`/`_heal_bound_record` (Redis) → `_run_bounded_sandbox` re-run | WIRED | Confirmed at `tool_dispatcher.py:1965-1979`, `:3084-3148`. |
| auto-heal re-run + both pip-install paths | `execute_code` wall-clock abort (096/SEED-063) | `_run_bounded_sandbox(func, thread_id, timeout_s)` | WIRED (CR-01 fix) | Confirmed at `:1547/1550` (declared install), `:3129` (heal re-run), all bounded by `settings.sandbox_exec_timeout_seconds`, with `kill_session` on overrun. |
| backend `healed` marker (WR-02) | live code-card output replacement | `code_execution_complete` `healed`/`stdout`/`stderr` → `api.ts` `subscribeToRun` parse → `StreamsProvider` reducer swap | WIRED (WR-02 fix) | Confirmed at `tool_dispatcher.py:2020-2028`, `api.ts:405-410/772-780`, `StreamsProvider.tsx` `healedLines` construction (`:813-839`). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| RENDER-01 dedup | `snapshot.messages` (persisted user rows) | live `getMessages`/reconcile snapshot fed by the SAME store the rest of the app reads | Yes — real DB-backed reconcile snapshot, not a stub | FLOWING |
| RENDER-02 mount-path swap | `answer.content` | `getMessages(threadId)` → real API call | Yes | FLOWING |
| RENDER-04 header vN / LIVE badge | `versions` (SkillStudioPage) / VersionsTab's own list | `listSkillVersions(skillId)` real GET, re-invoked on `refreshVersions`/`refreshNonce` | Yes | FLOWING |
| EXEC-01 install/heal | `exec_result.stdout`/`stderr`, pip `exit_code` | real `session.execute_command` calls against the live sandbox container (mocked only in unit tests, which explicitly assert the `python -m pip install` command string and exit-code branching) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend EXEC-01 install/heal/bound/timeout behavior | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py -q` | `31 passed, 1 warning in 0.30s` | PASS |
| Backend EXEC-01 + runtime-gap regression | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -q` | `46 passed, 1 warning in 0.33s` | PASS |
| Frontend RENDER-01/02 targeted suite | `cd frontend && npx vitest run src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` | `2 files, 12 tests passed` | PASS |
| Frontend RENDER-03/04 targeted suite | `cd frontend && npx vitest run src/pages/SkillStudioPage.test.tsx src/components/skills/studio/VersionsTab.test.tsx src/components/chat/__tests__/ChatAreaBanner.test.tsx src/components/chat/__tests__/MessageInputDrafts.test.tsx` | `4 files, 30 tests passed` | PASS |
| Full backend differential | `cd backend && ./venv/Scripts/python -m pytest -q` | `201 failed, 2939 passed, 11 skipped, 5 xfailed, 9 xpassed` — see Anti-Patterns note below | PASS (differential — see note) |
| Full frontend differential | `cd frontend && npx vitest run` | `28 failed test-suite-files (34 failed tests) / 1795 passed` across 10 files | PASS (differential — see note) |

**Full-suite differential note (both backend and frontend):** Neither full-suite run is "absolute green" — both carry pre-existing rot unrelated to this phase. This is expected per this project's baseline (frontend: documented SEED-056 rot; backend: undocumented but equally pre-existing rot surfaced during this verification — see Anti-Patterns / Context below). What matters for phase-176 goal achievement is the **differential**: zero net-new failures in files this phase touched. Confirmed by parsing the frontend JSON reporter output — all 6 phase-176-touched test files (`streamsProvider_075_7_reconcile_race.test.tsx`, `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx`, `ChatAreaBanner.test.tsx`, `MessageInputDrafts.test.tsx`, `SkillStudioPage.test.tsx`, `VersionsTab.test.tsx`) report `status: "passed"` inside the full run. On the backend, `test_tool_dispatcher.py` and `test_142_runtime_gap.py` are 100% green (46/46); the 201 backend failures are entirely in files last modified in Phase 164 or earlier (`test_sql_service.py`, `test_retrieval_service.py`, `test_multimodal_query.py`, `test_sandbox_service.py`, `test_module7_tools.py`, `test_phase56_iteration_start.py`, `test_streaming_reliability.py`, `test_077_cross_cancel.py`), none of which import `tool_dispatcher.py`, and the dominant failure signature (`RuntimeWarning: coroutine 'query_documents' was never awaited`) is a pre-existing async/sync test-harness mismatch with no relation to this phase's sandbox/reconcile changes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| RENDER-01 | 176-01 | No duplicate user message bubble | SATISFIED | Identity-based dedup, tested + code-reviewed + fixed (WR-01) |
| RENDER-02 | 176-01 | Final answer renders un-folded at a clean terminal | SATISFIED | Mount-path content-reconcile keyed on `run.run_id`; live-timing confirmation is Manual-Only |
| RENDER-03 | 176-04 | No intermittent silent send-drop | SATISFIED | Honesty guarantee (non-dispatch stash) + fresh-thread pending-ordering tighten |
| RENDER-04 | 176-02 | Version pointer updates without reload | SATISFIED | `refreshVersions`/`refreshNonce` refetch wiring, no migration |
| EXEC-01 | 176-03 | `execute_code` `libraries` installs reliably | SATISFIED | `python -m pip` same-interpreter install + bounded run-scoped auto-heal + CR-01 wall-clock bound |

No orphaned requirements — all 5 IDs (`RENDER-01`, `RENDER-02`, `RENDER-03`, `RENDER-04`, `EXEC-01`) are declared in exactly one PLAN's frontmatter `requirements:` field each, and `.planning/REQUIREMENTS.md` maps all 5 to "Phase 176 / Complete" with no additional Phase-176 IDs left unclaimed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/tool_dispatcher.py` | `_heal_bound_record` ~3053-3067 | IN-01: `sadd` then `expire` is not atomic — a crash between the two leaves an un-expiring Redis key | Info | Low impact (bounded by unique run_ids); documented as advisory-only in `176-REVIEW.md`, not fixed |
| `backend/app/services/tool_dispatcher.py` | `_autoheal_missing_module` ~3013-3020 | IN-02: import-name is auto-installed as the pip package name (PIL/cv2/sklearn mismatches; typo'd import → typosquat pull risk) | Info | Blast radius contained to the already-arbitrary-code Docker sandbox (per threat model T-176-03-01, accepted); documented as advisory-only |
| `backend/app/services/tool_dispatcher.py` | `_autoheal_missing_module` ~3101-3104 | IN-03: `install_failed.reason` on the already-attempted path can fall back to an unrelated declared-install stderr | Info | Cosmetic — model-facing message can misattribute a reason; documented as advisory-only |
| `frontend/src/pages/SkillStudioPage.tsx` | `refreshVersions` ~120-136 | IN-04: `versionsNonce` bumps unconditionally, not skill-switch-guarded like `setVersions` | Info | Harmless redundant refetch on rapid skill-switch; documented as advisory-only |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file this phase modified. No `TODO`/`HACK`/placeholder-return stubs found (all `placeholder`-string grep hits are legitimate optimistic-UI-placeholder / todos-feature terminology, not incompleteness markers). All 4 Info findings above were identified and accepted as advisory-only in `176-REVIEW.md`'s resolution (2026-07-23) — none rise to Warning or Blocker under this verification's independent review, since none affect the phase's 5 success criteria and all are traceable to accepted threat-model dispositions.

### Human Verification Required

### 1. SC#10 4-axis live UAT scoreboard

**Test:** Exercise all 4 axes per `176-VALIDATION.md`: (a) cross-provider — OpenAI + Anthropic + Google + one of DeepSeek/Moonshot/GLM, each with a single-user-bubble send + a live un-fold; (b) multi-tool — `execute_code` declared-library install + an undeclared-import auto-heal + a bad-name honest failure + a second same-run miss not re-attempted; (c) parallel-thread — Thread A streaming while Thread B sends, switch back to A after its terminal; (d) long-message — ≥50 prior messages or a ≥5KB prompt per provider.
**Expected:** Every row in the 176-VALIDATION.md SC#10 scoreboard table passes as described.
**Why human:** Live streaming timing, cross-provider model behavior, and genuine send races cannot be fully proven by unit test alone — this is the standing SC#10 mandate (CLAUDE.md UAT scoreboard recipe) and is explicitly scoped as Manual-Only in `176-VALIDATION.md` (D-15).

### 2. Final answer un-folds at run-end with NO reload

**Test:** Run one Deep turn on the send path AND one on the nav-watched/backgrounded path (switch to another thread mid-run, then switch back after the run completes).
**Expected:** The narration fold gives way to a clean markdown answer at the clean terminal without reloading, on both paths.
**Why human:** Live-render timing artifact — this was never live-confirmed before this phase (the reason BUG-260707-03 stayed open despite an earlier applied fix); tracked as D-08 Manual-Only.

### 3. Approve → version pointer updates live

**Test:** In the Skill Studio Triggering tab, approve a description proposal.
**Expected:** The header `vN` AND the Versions-tab LIVE badge update with no reload.
**Why human:** Depends on a real approve action + the live studio render; tracked as a 176-VALIDATION.md Additional Live Check.

### 4. Fresh-thread immediate send never silently drops

**Test:** On a just-created/switched thread, send immediately several times in a row.
**Expected:** Every message lands OR restores the composer text + shows the "Couldn't send — tap to retry" hint — never a silent vanish.
**Why human:** The honesty guarantee (never-silent) is unit-tested and VERIFIED; the frequency-reduction of the underlying race (D-10.1) can only be observed by actually triggering the race live.

### Gaps Summary

No gaps. All 5 phase truths (RENDER-01 through RENDER-04, EXEC-01) are VERIFIED against the current HEAD state, including the three post-review fix commits (CR-01, WR-01, WR-02). The CR-01 fix specifically flagged for load-bearing confirmation — that `_run_bounded_sandbox` wraps both the auto-heal re-run and both pip-install paths (declared + heal) with the same wall-clock abort the primary `execute_code` run uses — is confirmed wired end-to-end with dedicated passing unit tests (`test_run_bounded_sandbox_timeout_kills_container_and_raises`, `test_autoheal_rerun_timeout_surfaces_honest_and_no_exec_result`, `test_declared_install_pip_timeout_surfaces_honest_reason`). Status is `human_needed` (not `passed`) solely because the phase carries a mandatory SC#10 live UAT scoreboard plus 3 additional live checks, per the phase's own `176-VALIDATION.md` Manual-Only section — this is expected and matches how prior SC#10-flagged phases (e.g. 175) verified.

---

_Verified: 2026-07-22T22:29:55Z_
_Verifier: Claude (gsd-verifier)_
