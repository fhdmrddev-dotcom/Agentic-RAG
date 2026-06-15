---
phase: 102
slug: reusable-validation-gate-library-output-quality-gate
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 102 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend tier; the harness/emit suite is the precedent — `backend/tests/unit/test_*.py`) |
| **Config file** | `backend/pyproject.toml` / `backend/pytest.ini` (existing — no install needed) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/<touched_file>.py -x` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit -q` |
| **Estimated runtime** | ~30-60 seconds (the 8 Phase-102 unit files); full unit suite ~3-5 min |

No new framework — pytest + the venv tier already run the harness suite. The live-DB
`test_publish_flip.py` connects psycopg2 to `:54322` (skip-guarded if the stack is down).

---

## Sampling Rate

- **After every task commit:** Run the touched file's suite (`pytest tests/unit/<file>.py -x`)
- **After every plan wave:** Run `pytest tests/unit -q` + the SEED-056 baseline-checkout net-new-failure proof (revert the touched source files to the wave base, confirm identical failures, restore)
- **Before `/gsd-verify-work`:** Full unit suite green + the SC#10 live UAT scoreboard (below)
- **Max feedback latency:** ~60 seconds (per-file quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 102-01-01 | 01 | 1 | GATE-01/QUAL-01 | T-102-01-01 | strict-parse rejects an injected validator kind | unit | `pytest tests/unit/test_validator_kinds.py tests/unit/test_freshness.py tests/unit/test_pre_post_timing.py tests/unit/test_ask_user_disposition.py tests/unit/test_citation_policy.py tests/unit/test_publish_service.py tests/unit/test_harness_audit_102.py tests/unit/test_publish_flip.py -q` | ❌ W0 | ⬜ pending |
| 102-01-02 | 01 | 1 | GATE-01/QUAL-01 | T-102-01-04 | pre-102 JSONB row still model_validate()s (additive-optional) | unit | `pytest tests/unit/test_citation_policy.py -k strict -q` + the model one-liner | ✅ (after 01-01) | ⬜ pending |
| 102-01-03 | 01 | 1 | QUAL-01 | T-102-01-02 | _AUDIT_EVENT_TYPES == 22 in lockstep with the 070 CHECK | unit | `pytest tests/unit/test_harness_audit_102.py -q` | ✅ (after 01-01) | ⬜ pending |
| 102-02-01 | 02 | 2 | QUAL-01 | T-102-02-01 | migration 070 applied (CHECK + column) via psycopg2, no reset | integration (live DB) | the :54322 read-back one-liner (`OK migration 070 live`) | ❌ W0 | ⬜ pending |
| 102-03-01 | 03 | 3 | GATE-01 | T-102-03-05 | freshness queries only the bound folder_scope ($N, no f-string SQL) | unit | `pytest tests/unit/test_pre_post_timing.py -q` + the run_gates signature one-liner | ✅ (after 01-01) | ⬜ pending |
| 102-03-02 | 03 | 3 | GATE-01 | T-102-03-01 | llm_judge_rubric fails closed on a failure/None verdict (never silent pass) | unit | `pytest tests/unit/test_validator_kinds.py tests/unit/test_freshness.py -q` | ✅ (after 01-01) | ⬜ pending |
| 102-04-01 | 04 | 3 | GATE-01 | T-102-04-01 | ask_user pause reuses 085; unanswered -> honest fail, never hung | unit | `pytest tests/unit/test_ask_user_disposition.py tests/unit/test_pre_post_timing.py -q` | ✅ (after 01-01) | ⬜ pending |
| 102-04-02 | 04 | 3 | GATE-01/QUAL-01 | T-102-04-03/04 | citation_policy strict byte-identical; flag/partial/draft mark-or-blank, never silent | unit | `pytest tests/unit/test_citation_policy.py -q` | ✅ (after 01-01) | ⬜ pending |
| 102-05-01 | 05 | 4 | QUAL-01 | T-102-05-05 | draft->published flip allowed by the trigger; published->edit still blocked | unit + integration | `pytest tests/unit/test_publish_flip.py -q` (psycopg2 :54322) | ✅ (after 01-01) | ⬜ pending |
| 102-05-02 | 05 | 4 | QUAL-01 | T-102-05-01/02/06 | owner-scoped publish; a gameable verdict can't pass; not_found -> 404 (no leak) | unit | `pytest tests/unit/test_publish_service.py -q` | ✅ (after 01-01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/test_validator_kinds.py` — the 5 new kinds (GATE-01) — Plan 01 Task 1
- [ ] `tests/unit/test_freshness.py` — freshness deterministic queries + ask_user branch (GATE-01)
- [ ] `tests/unit/test_pre_post_timing.py` — the D-10 timing seam
- [ ] `tests/unit/test_ask_user_disposition.py` — the D-11 4th disposition
- [ ] `tests/unit/test_citation_policy.py` — the D-01 enum dispositions
- [ ] `tests/unit/test_publish_service.py` — the publish pipeline (QUAL-01)
- [ ] `tests/unit/test_publish_flip.py` — live-DB draft->published trigger behavior (psycopg2 :54322, skip-guarded)
- [ ] `tests/unit/test_harness_audit_102.py` — new receipt kinds + `_AUDIT_EVENT_TYPES` lockstep
- [ ] Shared fixtures (inline in the test files): a golden-run-shaped `WorkflowDefinition` with `business_requirement` + `llm_judge_rubric`; a `forced_emit`-mocked judge fixture (mock at the gateway boundary per `feedback_mock_completeness` — mock ALL network deps). NOTE: the publish path's REAL acceptance is the LIVE golden run (D-05, no-mock) — the live UAT scoreboard is the real gate (Pitfall 4, the 099/101 mock-mask lesson).

All 8 files are authored in Plan 01 (Task 1) as `xfail(strict=False)` RED stubs that exit 0;
each downstream plan un-marks the stubs it satisfies (the 098/099/101.1 un-mark-on-landing convention).

---

## Manual-Only Verifications

> SC#10 4-axis cross-provider rows (MANDATORY — the judge calls providers via `llm_judge` during runs).
> These rows are authored HERE in VALIDATION.md, NOT in PLAN.md tasks (the CLAUDE.md UAT-scoreboard recipe).
> The acceptance bar is the LIVE publish-gate golden run against the real project KB (D-05, no-mock).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider judge verdict | QUAL-01 | The judge calls a provider during the golden run; a coerce-tier judge must still produce an honest verdict or honest failure, never a silent pass | Run `POST /workflows/{id}/publish` with `harness_judge_model` set in turn to a representative of OpenAI, Anthropic, Google, OpenRouter. Each must render a structured `JudgeVerdict` (`overall_passed` present) OR an honest forced-emit failure. A Kimi/Moonshot coerce-tier judge: confirm an honest verdict/failure, never a silent empty "pass". |
| Multi-tool golden run | QUAL-01 | A real run exercising 2+ tools then judged end-to-end | Publish a workflow whose golden run uses `search_documents` + `render_template`; confirm the judge grades the multi-tool output and the verdict + structural gates persist as receipts. |
| Parallel-thread publish | QUAL-01 | The publish gate must not wedge the composer | Start a golden-run publish on Thread A; while it streams, accept a new prompt on Thread B; confirm B is responsive and A's publish completes/blocks honestly. |
| Long-message golden run | QUAL-01 | The judge verdict must not truncate under a long KB context | Publish a workflow whose golden run carries a long KB context / ≥ 50 prior messages; confirm the `forced_emit` truncation guard rejects a cut-off verdict rather than passing a half-verdict. |
| Judge blocks bad output (the QUAL-01 hard blocker) | QUAL-01 | A lint-clean workflow that produces bad output must NOT publish | Author a lint-clean workflow whose golden run delegates the work back to the user (the SEED-050 trap); confirm `POST /publish` returns `blocked_stage="judge"` with the per-criterion critique + the golden_run_id, and the definition stays `draft`. |
| ask_user freshness pause (G-4 lived experience) | GATE-01 | The cross-worker pause must be felt end-to-end, not just wire-verified | Attach a `freshness` validator (`timing=pre`, `on_failure=ask_user`, a small `max_age_days`) over a stale folder; confirm the run pauses with a choice prompt, Proceed continues + writes a `validator_ask_user_approved` receipt, Abort fails honestly, and an unanswered prompt expires to an honest fail (never a hung run). |
| flag/partial/draft delivery marks (Pitfall 5) | GATE-01 | The marks/blanks/label are visible-or-it-failed; structural verification is insufficient | Run an emit phase under each non-strict `citation_policy`; open the delivered file: `flag` shows "[unverified]" marks + a coverage summary, `partial` shows blanked cells + a gap list, `draft` shows a DRAFT label. Confirm NO non-strict mode silently passes off unverified data as authoritative. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has an automated verify)
- [x] Wave 0 covers all MISSING references (the 8 unit files + the live-DB flip test)
- [x] No watch-mode flags (every command is a one-shot `pytest -q`/`-x`)
- [x] Feedback latency < 60s (per-file quick run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12
