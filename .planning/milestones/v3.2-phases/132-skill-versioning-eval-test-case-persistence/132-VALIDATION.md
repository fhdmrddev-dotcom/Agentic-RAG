---
phase: 132
slug: skill-versioning-eval-test-case-persistence
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-29
updated: 2026-06-29
---

# Phase 132 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + tsc/vite build (frontend) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -x -k "132 or skill_version or test_case" -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Estimated runtime** | ~30-60 seconds (backend integration; live-DB tests skip if :54322 down) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (backend) / `npx tsc --noEmit` (frontend tasks).
- **After every plan wave:** Run the full suite command.
- **Before `/gsd:verify-work`:** Full backend suite green + `npm run build` clean.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 132-01-01 | 01 | 1 | VER-01, EVAL-01 | T-132-02/03/04/05 | Trigger sets user_id from NEW.user_id; UNIQUE guards race; append-only UPDATE block | static (grep) | `grep -c ... 079_skill_versions_and_test_cases.sql` | ❌ W0 | ⬜ pending |
| 132-01-02 | 01 | 1 | VER-01 | T-132-02/03 | Version immutability + correct ownership proven on live DB | integration | `pytest tests/integration/test_132_skill_versions.py -q` | ❌ W0 | ⬜ pending |
| 132-01-03 | 01 | 1 | VER-01, EVAL-01 | — | Live DB physically has tables/trigger (no false positive) | manual (blocking) | SQL-editor apply + regen + tests pass | n/a | ⬜ pending |
| 132-02-01 | 02 | 2 | EVAL-01, VER-01 | T-132-07 | Models carry no provider/model fields; user_id server-owned | import smoke | `python -c "import app.models.skill_test_case, app.models.skill_version"` | ❌ W0 | ⬜ pending |
| 132-02-02 | 02 | 2 | EVAL-01, VER-01 | T-132-06/07/08 | Every route `.eq("user_id", current_user["id"])`; versions read-only | integration | `pytest tests/integration/test_132_test_cases.py -q` | ❌ W0 | ⬜ pending |
| 132-03-01 | 03 | 3 | EVAL-01, VER-01 | T-132-10 | Typed client; owner-scoping is server-side | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 132-03-02 | 03 | 3 | EVAL-01, VER-01 | T-132-10/11 | Thin client renders only owner-scoped API data | build | `npm run build` | ✅ | ⬜ pending |
| 132-03-03 | 03 | 3 | EVAL-01, VER-01 | — | End-to-end persistence + version-on-change-not-toggle | manual (blocking) | operator UAT steps | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_132_skill_versions.py` — VER-01 (insert→v1, content-change→vN, toggle→no version, update-blocked, backfill, unique). Template: `test_123_1_tuner_runs_timestamp.py` (asyncpg :54322 + rolled-back tx + skip guards).
- [ ] `backend/tests/integration/test_132_test_cases.py` — EVAL-01 CRUD persistence + owner-scope isolation + version-history GET. Template: `test_skill_tuner_routes.py`.
- [ ] Integration tests must skip cleanly when migration `079` is unapplied (`to_regclass('public.skill_versions') IS NULL`) — they go green only after the Plan 01 blocking apply.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 079 applied to live local Supabase + full-schema regenerated | VER-01, EVAL-01 | Schema changes apply via SQL editor (CLAUDE.md) — never `db push`; code passing ≠ DB has tables | Plan 01 Task 3 checkpoint: paste 079 into SQL editor, `bash scripts/regenerate-full-schema.sh` (no --reset), commit both, run VER-01 tests green |
| Test cases persist across reload; edit/delete works; version increments on instruction change but NOT on toggle | EVAL-01, VER-01 | Lived-experience end-to-end check across reload | Plan 03 Task 3 checkpoint UAT steps |

> **SC#10 / UAT scoreboard:** NOT applicable. This phase does not touch streaming, the agent loop, provider routing, or chat UI state (RESEARCH Validation Architecture). No cross-provider × multi-tool × parallel-thread × long-message matrix required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit blocking manual checkpoints (the two live-DB / UAT steps that cannot be automated).
- [x] Sampling continuity: no 3 consecutive code tasks without automated verify.
- [x] Wave 0 covers all MISSING references (the two new integration test files).
- [x] No watch-mode flags.
- [x] Feedback latency < 60s.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-06-29
