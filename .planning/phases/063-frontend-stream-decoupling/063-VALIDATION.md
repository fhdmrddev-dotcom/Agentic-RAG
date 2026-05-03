---
phase: 063
slug: frontend-stream-decoupling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 063 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest 8.x + pytest-asyncio + httpx ASGITransport (Phase 058+ pattern) |
| **Backend config file** | `backend/pytest.ini` (existing) |
| **Backend quick run** | `cd backend && python -m pytest tests/integration/test_063_*.py -x -q` |
| **Backend full suite** | `cd backend && python -m pytest tests/integration/test_058_*.py tests/integration/test_059_*.py tests/integration/test_061_*.py tests/integration/test_062_*.py tests/integration/test_063_*.py -q -k 'not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)'` (preserves DEF-061.1-01/02 inherited exclusions) |
| **Frontend framework** | None for unit (project has no Jest/Vitest); Playwright e2e at `e2e/tests/*.spec.ts` |
| **Frontend e2e config** | `e2e/playwright.config.ts` (existing) |
| **Frontend e2e quick run** | `cd frontend && npx playwright test e2e/tests/063-*.spec.ts` |
| **Estimated runtime (per task commit)** | ~10–25 s backend / ~30–60 s e2e |
| **Estimated runtime (full suite)** | ~3–5 min backend + ~1–2 min e2e |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/integration/test_063_*.py -x -q` (fast — only the new 063 files)
- **After every plan wave:** Run backend full suite (combined regex above) + `cd frontend && npx playwright test e2e/tests/063-*.spec.ts`
- **Before `/gsd-verify-work`:** Backend full suite green AND `e2e/tests/060-thread-race.spec.ts` green (Phase 060 regression) AND `e2e/tests/063-*.spec.ts` green AND legacy `event_consumer` confirmed deleted by grep
- **Max feedback latency:** 25 s (per-task quick run)

---

## Per-Task Verification Map

> Filled by planner during step 8. Each plan task gets one row mapping its requirement to the automated verification command. Status updated by executor.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | STREAM-04 | T-063-IDOR-active-runs / T-063-IDOR-stream / T-063-IDOR-cancel | Cross-user requests return 404, not 403 (D-062-12) — preserved by Phase 062 endpoints unchanged | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_063_post_contract.py` — covers new POST `{message_id, run_id}` shape, response-before-first-XADD invariant
- [ ] `backend/tests/integration/test_063_post_then_subscribe.py` — POST+GET roundtrip end-to-end (regression guard combining new POST + 062 GET stream)
- [ ] `backend/tests/integration/test_063_legacy_path_deleted.py` — static-check tests asserting `event_consumer` is not importable from `app.api.threads` and POST handler signature returns JSON not SSE
- [ ] `e2e/tests/063-refresh-mid-stream.spec.ts` — Playwright covers Symptom F (F5 mid-stream → reattach via active-runs)
- [ ] `e2e/tests/063-resume-failed.spec.ts` — Playwright covers Resume button visibility on failed runs (uses backend mock fault injection per Phase 062 redis_down test pattern)
- [ ] Audit task: any backend test in `test_058_*.py` / `test_059_*.py` / `test_061_*.py` that POSTs to `/threads/{tid}/messages` and reads SSE off the response — rewrite to GET `/runs/{rid}/stream` after POST returns JSON, OR delete if redundant with 062's coverage

*All test framework deps (pytest, pytest-asyncio, httpx, Playwright, redis-py async, sse-starlette) already in `backend/requirements.txt` and `frontend/package.json` per Phase 058–062. No installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-tab sync (two browser tabs render same tokens for same run) | STREAM-04 | Requires multi-tab orchestration; Phase 064 browser MCP harness will own | Open same thread in two browser tabs, send message in tab A, observe tab B renders identical tokens via Phase 062 multi-consumer fan-out |
| Symptom G cross-tab Stop (Stop in Tab B closes Tab A's stream) | STREAM-02b | Multi-tab orchestration; deferred to 064 | Open same thread in two tabs streaming the same run; click Stop in Tab B; verify Tab A's stream closes via terminal sentinel |
| Bug 3 regression — no tool-result JSON leak in chat content | (preserves Phase 060 invariant) | No frontend unit framework; full coverage via e2e in 064 | Send message that triggers tool calls; verify rendered content shows assistant prose, not raw JSON tool results |
| bfcache restore reconciliation | STREAM-04 | bfcache only triggers via real browser navigation (back/forward); cannot simulate in headless Playwright reliably | Navigate to thread, navigate away, navigate back via browser back button; verify `pageshow` with `event.persisted === true` triggers active-runs reconcile |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (filled by planner)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files listed above)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 25 s per-task / < 5 min full suite
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills the task map)

**Approval:** pending
