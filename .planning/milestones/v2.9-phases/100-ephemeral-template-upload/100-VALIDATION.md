---
phase: 100
slug: ephemeral-template-upload
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 100 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, venv) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Backend venv** | `backend/venv/Scripts/python` (Windows) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Frontend quick run** | `cd frontend && npm run test -- FilesSection --run` |
| **Estimated runtime** | ~60 seconds (backend) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*(One row per automatable task. Commands run from repo root; backend venv = `backend/venv/Scripts/python`.)*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 100-01 | 0 | TMPL-01 | T-100-01-01 | Synthetic OOXML fixtures (no untrusted bytes) | unit (fixture) | `cd backend && venv/Scripts/python -c "import io,zipfile; from tests.conftest import _make_ooxml; assert zipfile.is_zipfile(io.BytesIO(_make_ooxml('word')))"` | ❌ → 01 | ⬜ pending |
| 01-T2 | 100-01 | 0 | TMPL-01 | — | SC#2 structural-isolation guard live now | unit (guard) | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q` | ❌ → 01 | ⬜ pending |
| 01-T3 | 100-01 | 0 | TMPL-01 (D-02) | T-100-06-02 | Badge/countdown render stubs (no XSS surface) | unit (vitest) | `cd frontend && npm run test -- FilesSection --run` | ❌ → 01 | ⬜ pending |
| 02-T1 | 100-02 | 1 | TMPL-01 | T-100-02-01/02 | Nullable cols, no default → byte-identical; RLS row-level | migration (static) | `cd "C:/Vibe Apps/Agentic RAG" && python -c "import pathlib; t=pathlib.Path('supabase/migrations/068_workspace_template_ephemeral.sql').read_text(); assert 'expires_at timestamptz' in t and 'template_ttl_hours' in t and 'idx_workspace_files_expires_at' in t"` | ❌ → 02 | ⬜ pending |
| 02-T2 | 100-02 | 1 | TMPL-01 | T-100-02-01 | Existing rows valid post-068 (NULL/NULL) | migration smoke (manual SQL editor) | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py::test_existing_rows_valid -x` (after operator apply) | ❌ → 02 | ⬜ pending |
| 03-T1 | 100-03 | 2 | TMPL-01 (D-06/D-11) | T-100-03-01/02 | asyncpg read seams gated; agent files byte-identical | integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "agent_files_unchanged or expired"` | ❌ → 03 | ⬜ pending |
| 03-T2 | 100-03 | 2 | TMPL-01 (D-10/D-12) | T-100-03-03/04 | write_file persists kind/ttl; OOXML→binary stub; "template expired" | unit/integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "kind_and_ttl or expired_tool_read"` | ❌ → 03 | ⬜ pending |
| 04-T1 | 100-04 | 3 | TMPL-01 (D-05) | T-100-04-04 | TTL read from app_settings (default 24) | unit | `cd backend && venv/Scripts/python -c "from app.models.user_settings import load_app_settings; assert isinstance(load_app_settings().template_ttl_hours, int)"` | ❌ → 04 | ⬜ pending |
| 04-T2 | 100-04 | 3 | TMPL-01 (D-12) | T-100-04-01/02/04/05 | validate_ooxml magic-byte gate; 404 non-owner; 422 bad/oversized | unit/integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "valid_ooxml or bad_file or oversized or kind_and_ttl"` | ❌ → 04 | ⬜ pending |
| 04-T3 | 100-04 | 3 | TMPL-01 (D-06) | T-100-04-03 | 4 REST routes gated; signed-URL bypass closed | integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "expired_excluded_rest or agent_files_unchanged"` | ❌ → 04 | ⬜ pending |
| 05-T1 | 100-05 | 3 | TMPL-01 (D-07/D-09) | T-100-05-01/02/03/04 | sweep rows+ALL bytes idempotent; pin GREATEST-only no-op | integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "sweep_deletes or run_pin"` | ❌ → 05 | ⬜ pending |
| 05-T2 | 100-05 | 3 | TMPL-01 (D-09/G-5) | T-100-05-03/06 | thin kickoff pin; no inline logic in threads.py (G-5) | import + grep guard | `cd backend && venv/Scripts/python -c "import app.main; import app.api.threads"` + `grep -L "GREATEST" backend/app/api/threads.py` | ❌ → 05 | ⬜ pending |
| 05-T3 | 100-05 | 3 | TMPL-01 (D-10) | T-100-05-05 | expired tool read → "template expired" | integration | `cd backend && venv/Scripts/python -m pytest tests/test_workspace_template.py -q -k "expired_tool_read"` | ❌ → 05 | ⬜ pending |
| 06-T1 | 100-06 | 4 | TMPL-01 (D-01) | T-100-06-01 | upload client; type fields; tsc clean | type/static | `cd frontend && npx tsc --noEmit` (no new api.ts/types errors) | ❌ → 06 | ⬜ pending |
| 06-T2 | 100-06 | 4 | TMPL-01 (D-02/D-11) | T-100-06-01/02/03 | badge/countdown/amber/per-ext; agent files byte-identical; no per-sec timer | unit (vitest) | `cd frontend && npm run test -- FilesSection --run` | ❌ → 06 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Wave 0 dependency:** every ❌ command points at a test/symbol that Plan 100-01 (Wave 0) creates as RED/xfail; the implementing plan flips it GREEN. No task has 3 consecutive non-automatable steps.

---

## Wave 0 Requirements

- [x] `backend/tests/test_workspace_template.py` — 12 TDD stubs (SC#1/SC#2/SC#3, D-06/07/09/10/11, D-12, migration smoke) — **Plan 100-01 Task 2**
- [x] `backend/tests/conftest.py` fixtures — valid docx/pptx/xlsx + renamed-binary + oversized OOXML bytes + `DISTINCTIVE_TEMPLATE_TEXT` marker — **Plan 100-01 Task 1**
- [x] `frontend/src/components/panel/__tests__/FilesSection.test.tsx` — badge/countdown/amber/per-ext-icon render stubs — **Plan 100-01 Task 3**
- [ ] Service-role Storage client for the sweep — **RESOLVED**: `get_supabase()` (dependencies.py:16) is the service-role client (harness_engine.py:1134 precedent); no new client needed (was Open-Q1).

---

## Manual-Only Verifications

*(From CONTEXT.md G-4 lived-experience UAT rows — all 7 are MANDATORY, authored in this file per the UAT scoreboard recipe; live verification at phase verify. NOT SC#10-flagged — no provider-bearing run in upload plumbing.)*

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| 1 | Upload→visible→readable (real docx → card + Template badge + countdown → agent reads in-thread) | TMPL-01 SC#1 | Lived-experience UI + live agent run | Upload a real docx in the panel Files section → card appears with badge + "expires in Nh" → agent `workspace_list` shows it; `workspace_read` returns the binary stub (or the Phase-101 fill consumes it) |
| 2 | Never-in-search proof (distinctive template text absent from KB search) | TMPL-01 SC#2 | Live KB + agent `search_documents` | Put `ZZ-TMPL-MARKER-100` inside the uploaded template → agent `search_documents` for it + UI search → MUST never appear (structural isolation) |
| 3 | Expiry end-to-end (short TTL → vanishes → tool error → row AND ALL Storage bytes gone) | TMPL-01 SC#3 | Wall-clock TTL + Storage inspection | Set `app_settings.template_ttl_hours` low (or insert a near-past expires_at) → file disappears from panel → agent read fails "template expired" (D-10) → after a sweep, verify via psycopg2 on local :54322 the row is gone AND `storage.from_('workspace-files')` has no leftover version objects |
| 4 | Bad-file rejection (renamed .exe / PDF → clean 422, nothing persisted) | TMPL-01 / D-12 | UI error surface | Rename an .exe to .docx (and try a real PDF) → upload → clean visible 422 → verify NO `workspace_files` row created |
| 5 | Run-straddles-expiry (run-pin extends file, run completes) | D-09 | Live multi-phase workflow run timing | Upload near expiry → start a multi-phase workflow → run-pin (D-09) extends `expires_at` (GREATEST) → run completes with no mid-flight "template expired" |
| 6 | Cross-user isolation (second user cannot list/download) | SC#1 RLS | Two live sessions | A second user's session: list + content + download of the first user's template all return 404 (RLS half of SC#1; `/gsd:secure-phase` reuses this row) |
| 7 | No-template regression (NULL-expiry files byte-identical; templateless workflow unchanged) | D-11 RED LINE | Live regression sweep | Agent-written workspace files (`expires_at NULL`) list/read/diff exactly as today, AND a workflow with no template runs byte-identically (the D-11 invariant, proven live) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test_workspace_template.py + conftest fixtures + FilesSection.test.tsx)
- [x] No watch-mode flags (all vitest use `--run`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (2026-06-10)
