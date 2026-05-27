---
phase: 074
slug: seed-009-seed-011-polish-bundle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 074 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (asyncio_mode=auto) |
| **Config file** | `backend/pytest.ini` (existing, unchanged) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_resolve_max_tokens.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py tests/integration/test_059_disconnect.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py tests/unit/test_resolve_max_tokens.py -q` |
| **Estimated runtime** | ~30 seconds (unit <1s; integration ~25s) |

---

## Sampling Rate

- **After every task commit:**
  - Plan 01 tasks → `cd backend && venv/Scripts/python -m pytest tests/unit/test_resolve_max_tokens.py -q`
  - Plan 02 tasks → 4-file integration gate command above
- **After every plan wave:** Full suite command
- **Before `/gsd-verify-work`:** Full suite must be green AND live UAT SC#3 confirmed (haiku-4-5 over-cap run reaches `runs.status='completed'`)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 074-01-XX (clamp logic) | 01 | 1 | POLISH-SEED-009-01 | — | Vendor hard cap enforced regardless of env override (`MODEL_OUTPUT_LIMITS` cannot exceed registry cap) | unit (parametrize 3 cases: under/at/over) | `pytest tests/unit/test_resolve_max_tokens.py::test_clamp_haiku_4_5 -x` | ❌ W0 — NEW FILE | ⬜ pending |
| 074-01-XX (passthrough) | 01 | 1 | POLISH-SEED-009-01 | — | Unknown model returns requested value unchanged; no clamp log emitted | unit | `pytest tests/unit/test_resolve_max_tokens.py::test_unknown_model_passthrough -x` | ❌ W0 | ⬜ pending |
| 074-01-XX (live UAT) | 01 | 1 | POLISH-SEED-009-01 | — | haiku-4-5 over-cap request reaches `runs.status='completed'` (not 400) + `clamped max_tokens` log line emitted | live UAT (manual / Chrome MCP) | localhost:5173 with `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536`; test login `fhdmrd@gmail.com` / `123456` | n/a — runtime | ⬜ pending |
| 074-02-XX (core fix) | 02 | 1 | POLISH-SEED-011-01 | — | test_059_disconnect.py is 3/3 PASS — no `RuntimeError: Event loop is closed` | integration | `pytest tests/integration/test_059_disconnect.py -q` | ✅ exists | ⬜ pending |
| 074-02-XX (regression) | 02 | 1 | POLISH-SEED-011-01 | — | test_058 + test_062 + test_063 still PASS after fixture hoist (no fixture-collision regression) | integration | `pytest tests/integration/test_058_concurrency.py tests/integration/test_062_stream_replay.py tests/integration/test_063_post_then_subscribe.py -q` | ✅ all 3 exist | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_resolve_max_tokens.py` — NEW FILE, covers POLISH-SEED-009-01 boundary + passthrough cases
- [ ] `backend/tests/integration/conftest.py` — NEW FILE, hoists `_reset_redis_singleton` autouse fixture (this IS the fix for POLISH-SEED-011-01)

**Framework install:** None — pytest + pytest-asyncio already installed via `backend/requirements.txt`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Haiku-4-5 over-cap run reaches `runs.status='completed'` + `clamped max_tokens` log emitted | POLISH-SEED-009-01 (SC#3) | Over-cap path needs a live Anthropic key + a real run through the chat UI; Phase 064 fixture harness (deferred) would automate this. Chrome DevTools MCP can drive the flow per `feedback_chrome_mcp_testing.md`. | 1. Start backend with `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` (forces resolver to attempt >cap). 2. Drive `http://localhost:5173/` with test login `fhdmrd@gmail.com` / `123456`. 3. Select `claude-haiku-4-5-20251001`. 4. Send a long-output prompt. 5. Inspect backend logs: `clamped max_tokens for model=claude-haiku-4-5-20251001: 65536 -> 64000` MUST appear. 6. Confirm `runs.status='completed'` (no 400 BadRequestError). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers both NEW FILE requirements (unit test file + integration conftest)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after planner finalizes Task IDs

**Approval:** pending
