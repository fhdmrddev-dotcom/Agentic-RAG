---
phase: 176
slug: chat-render-correctness-exec-reliability
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 176 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> All five fixes are code-only reconcile/dispatch edits over EXISTING, well-covered test surfaces.
> Every task authors its new case test-first (RED) inside its `tdd="true"` task, then implements (GREEN).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 (frontend) · pytest (backend) |
| **Config file** | `frontend/vitest.config.ts` · `backend/pytest.ini` |
| **Frontend quick run** | `cd frontend && npx vitest run src/__tests__/providers/ src/components/chat/__tests__/ src/pages/SkillStudioPage.test.tsx src/components/skills/studio/VersionsTab.test.tsx` |
| **Backend quick run** | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -x` |
| **Full suites** | `cd frontend && npx vitest run` · `cd backend && ./venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | frontend quick ~10-20s · backend quick ~15-30s |

---

## Sampling Rate

- **After every task commit:** run the task's requirement quick command (see the Per-Task map).
- **After every plan wave:** run the full frontend `npx vitest run` + backend `pytest -q`.
- **Before `/gsd:verify-work`:** full suites green + the **differential** (git-stash phase-start vs HEAD over the same targeted files = zero net-new failures vs the SEED-056 vitest-rot / backend source-drift baseline — D-14).
- **Max feedback latency:** ~30s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 176-01-01 | 01 | 1 | RENDER-01 | T-176-01-01/02 (accept) | N/A (client render over RLS-scoped data) | unit (store) | `cd frontend && npx vitest run src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` | ✅ (extend) | ⬜ pending |
| 176-01-02 | 01 | 1 | RENDER-02 | T-176-01-01 (accept) | N/A | unit (store) | `cd frontend && npx vitest run src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` | ✅ (extend) | ⬜ pending |
| 176-02-01 | 02 | 1 | RENDER-04 | T-176-02-01 (accept) | N/A (frontend refetch of authorized GET) | unit (page) | `cd frontend && npx vitest run src/pages/SkillStudioPage.test.tsx` | ✅ (extend) | ⬜ pending |
| 176-02-02 | 02 | 1 | RENDER-04 | T-176-02-01 (accept) | N/A | unit (tab) | `cd frontend && npx vitest run src/components/skills/studio/VersionsTab.test.tsx` | ✅ (extend) | ⬜ pending |
| 176-03-01 | 03 | 1 | EXEC-01 | T-176-03-01/02/SC (accept) | Declared install exit-code checked, never swallowed; sandbox containment unchanged | unit (dispatcher) | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py -x -k "install"` | ✅ (extend) | ⬜ pending |
| 176-03-02 | 03 | 1 | EXEC-01 | T-176-03-01/02 (accept) | Heal bound RUN-SCOPED (per-run Redis key on ctx.run_id, graceful call-local fallback) + threadpool-wrapped re-run; honest result on persistent failure (no raw traceback as "completed") | unit (dispatcher) | `cd backend && ./venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_142_runtime_gap.py -x` | ✅ (extend) | ⬜ pending |
| 176-04-01 | 04 | 2 | RENDER-03 | T-176-04-01/02 (accept) | Draft (user's own text) never silently lost; server still authorizes every send | unit (component) | `cd frontend && npx vitest run src/components/chat/__tests__/ChatAreaBanner.test.tsx src/components/chat/__tests__/MessageInputDrafts.test.tsx` | ✅ (extend) | ⬜ pending |
| 176-04-02 | 04 | 2 | RENDER-03 | T-176-04-02 (accept) | Client send-ordering refs only affect local optimistic render | unit (store) | `cd frontend && npx vitest run src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** 8 tasks, every task has an `<automated>` command — no 3 consecutive tasks without automated verify. ✓

---

## Wave 0 Requirements

**All required test files already exist** — this phase extends them; no net-new test file and no framework install is needed. Each `tdd="true"` task authors its new case **test-first (RED)** before implementing (GREEN). The specific new cases each task must add:

- [ ] `streamsProvider_075_7_reconcile_race.test.tsx` — **user-side content-dedup** case (176-01-01): drop-when-persisted-twin-present AND preserve-when-twin-absent (075.7 held). Plus the **fresh-thread pending-ordering** case (176-04-02): a reconcile fired while only the pending flag is set preserves the temp.
- [ ] `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — **mount-path content-reconcile** case (176-01-02): a backgrounded run's mount-path terminal calls `getMessages` and swaps content by `run.run_id`, no reload.
- [ ] `ChatAreaBanner.test.tsx` + `MessageInputDrafts.test.tsx` — **non-dispatch → failedSendDrafts/reconcileErrors** case (176-04-01): the banner shows the quiet retry hint and the prefill restores the composer text.
- [ ] `SkillStudioPage.test.tsx` — **approve→refetch** case (176-02-01): promoting a version re-invokes `listSkillVersions` and re-derives the header vN with no reload.
- [ ] `VersionsTab.test.tsx` — **refreshNonce refetch** case (176-02-02): a nonce bump re-runs the versions fetch and the LIVE badge tracks the refreshed live version.
- [ ] `test_tool_dispatcher.py` (+ `test_142_runtime_gap.py`) — EXEC-01 cases (176-03-01/02): (a) declared-install failure surfaces an honest result, not swallowed; (b) `ModuleNotFoundError` → `python -m pip install X` + a single re-run that is **threadpool-wrapped** (`run_in_threadpool(session.execute_command, "python -u <code_file>")` — D-v2.5-01); (c) the **RUN-SCOPED** 1-per-module bound — a second same-module miss in the SAME run consults the per-run Redis store (`heal_attempted:{run_id}`; the mocked `ctx.redis.sismember` returns true) and goes straight to the honest result with NO second install (the run-scoped store IS consulted, not a call-local set that re-initializes per call); (d) Redis-unavailable (mocked redis raises) → the call-local fallback still bounds the heal and `execute_code` does not raise. Mock `session.execute_command` to assert `python -m pip install` is used + exit codes are checked, and mock `ctx.redis` sismember/sadd/expire to assert the run-scoped heal-bound store is read and written.

---

## Manual-Only Verifications

> SC#10 4-axis live UAT is **mandatory** (D-15) and lives here, NOT as PLAN.md tasks (per CLAUDE.md UAT scoreboard recipe). Plus the D-08 live un-fold verification and the RENDER-04 live check. Operator drives the browser UAT; evidence via observation + psycopg2 (:54322) / uvicorn logs / LangSmith where useful.

### SC#10 4-axis scoreboard (author results here at phase verification)

| Axis | Required coverage (concrete scenario from bug-DB evidence) | Reqs exercised |
|------|------------------------------------------------------------|----------------|
| **Cross-provider** | OpenAI + Anthropic + Google + one of DeepSeek/Moonshot/GLM — each: a single send renders exactly ONE user bubble (RENDER-01) and the final answer un-folds LIVE at the clean terminal with no reload (RENDER-02) | RENDER-01, RENDER-02 |
| **Multi-tool** | ≥1 row exercising `execute_code` with a declared library that must install (EXEC-01 declared) AND an undeclared-import case (EXEC-01 auto-heal) — e.g. DeepSeek/fpdf2 warm-session (thread `5a86a9fd`); a bad-name package returns the honest "Could not install X" result (no raw traceback); a second same-module miss LATER in the SAME run is not re-attempted (run-scoped bound) | EXEC-01 (+ e.g. `search_documents`+`execute_code`) |
| **Parallel-thread** | Thread A streaming while Thread B sends; switch back to A after its terminal → A's answer un-folds with NO reload (RENDER-02 mount-path, D-07) AND no duplicate user bubble on either thread (RENDER-01) | RENDER-01, RENDER-02 |
| **Long-message** | ≥50 prior messages OR a ≥5 KB user prompt, per provider — the send lands, or (if it ever fails to dispatch) restores the text + shows the quiet retry hint; never a silent vanish (RENDER-03) | RENDER-03 |

### Additional live checks

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final answer un-folds at run-end with NO reload | RENDER-02 (D-08) | Live-render timing artifact; the applied fix was never live-confirmed (why BUG-260707-03 stayed open) | Run one Deep turn on each of the send path AND the nav-watched/backgrounded path; confirm the fold gives way to a clean markdown answer at the clean terminal without reloading. |
| Approve → version pointer updates live | RENDER-04 | Depends on a real approve action + the studio render | In the Skill Studio Triggering tab, approve a description proposal; confirm the header `vN` AND the Versions-tab LIVE badge update with no reload (BUG-260706-01). |
| Fresh-thread immediate send never silently drops | RENDER-03 | A timing race is hard to prove gone; the durable property is "no silent loss" | On a just-created/switched thread, send immediately several times; confirm every message lands OR restores the text + shows the retry hint. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (all 8 have `<automated>`; all test files exist and are extended test-first)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing — all files exist; new cases enumerated above)
- [x] No watch-mode flags (all `vitest run` / `pytest`, no `--watch`)
- [ ] Feedback latency < 30s (confirm at first run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
