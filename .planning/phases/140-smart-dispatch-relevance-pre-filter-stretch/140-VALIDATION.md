---
phase: 140
slug: smart-dispatch-relevance-pre-filter-stretch
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-07
---

# Phase 140 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Backend-only phase (pgvector semantic pre-filter + settings-resolved token budget over the
> `## Available Skills` catalog block). SC#10 fires (agent loop + provider routing) → the 4-axis
> cross-provider UAT is authored under **Manual-Only Verifications** below, NOT in PLAN tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && python -m pytest tests/test_140_*.py -x` |
| **Full suite command** | `cd backend && python -m pytest` |
| **Estimated runtime** | ~10-25 seconds (unit); integration/DB-CHECK adds ~10s (psycopg2 → :54322) |

---

## Sampling Rate

- **After every task commit:** `cd backend && python -m pytest tests/test_140_*.py -x`
- **After every plan wave:** `cd backend && python -m pytest tests/test_140_*.py tests/test_agent_loop_catalog_override.py tests/integration/test_140_*.py`
- **Before `/gsd:verify-work`:** Full suite green (`cd backend && python -m pytest`), THEN the 4-axis UAT below.
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 140-01-01 | 01 | 1 | TRIG-02 | T-140-01 | `match_skills` reproduces owner+global scope exactly (no cross-user leak) | DB-CHECK | `pytest tests/integration/test_140_migration_091.py -x` | ❌ W0 (green post-apply, Plan 05) | ⬜ pending |
| 140-01-02 | 01 | 1 | TRIG-02 | T-140-02 | stale/absent vector → NULL similarity (fail-open keep) | DB-CHECK | `pytest tests/integration/test_140_migration_091.py -x` | ❌ W0 (green post-apply) | ⬜ pending |
| 140-02-01 | 02 | 1 | TRIG-02 | — | embed source = description + should_fire prompts, name fallback | unit | `pytest tests/integration/test_140_skill_embedding_service.py::test_embed_source_builder -x` | ❌ W0 | ⬜ pending |
| 140-02-02 | 02 | 1 | TRIG-02 | T-140-03 / T-140-04 | job hand-scopes `.eq(user_id)`; `embed_texts` off the loop | unit (mock) | `pytest tests/integration/test_140_skill_embedding_service.py -x` | ❌ W0 (real run Plan 05) | ⬜ pending |
| 140-03-01 | 03 | 1 | TRIG-02 (SC#2) | T-140-05 | budget bounds-checked; ≤0 disables cleanly (inject-all) | unit | `pytest tests/test_140_catalog_trim.py::test_budget_zero_injects_all -x` | ❌ W0 | ⬜ pending |
| 140-03-02 | 03 | 1 | TRIG-02 (SC#1/SC#3) | T-140-06 | fits→byte-identical (no marker); trim→honest `_CATALOG_TRIM_MARKER` | unit | `pytest tests/test_140_catalog_trim.py -x` | ❌ W0 | ⬜ pending |
| 140-04-01 | 04 | 2 | TRIG-02 (SC#1/SC#3/D-05/D-06) | T-140-07 / T-140-08 / T-140-09 | embed only over-budget + threadpool + fail-open; override tuple branch untouched | integration | `pytest tests/test_agent_loop_catalog_override.py -x` | ✅ (extend) | ⬜ pending |
| 140-04-02 | 04 | 2 | TRIG-02 (SC#3) | — | `load_skill` loads a menu-absent skill by exact name | integration | `pytest tests/integration/test_140_escape_hatch.py -x` | ❌ W0 | ⬜ pending |
| 140-05-01 | 05 | 3 | TRIG-02 (schema) | T-140-10 | operator applies reviewed SQL to live LOCAL DB (never `db push`) | DB-CHECK | `pytest tests/integration/test_140_migration_091.py -x` (now green) | ❌ W0 → green | ⬜ pending |
| 140-05-02 | 05 | 3 | TRIG-02 (data) | T-140-11 | backfill hand-scopes user_id; vectors populated | integration | `pytest tests/integration/test_140_skill_embedding_service.py -x` (now green) | ❌ W0 → green | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_140_catalog_trim.py` — unit tests for `build_skill_catalog_block` + `resolve_skill_catalog_budget` (SC#1 byte-identical + cut-least-relevant, SC#2 budget-zero, SC#3 marker + pinned-kept, D-05 fail-open None-sim). Pure function → NO DB/LLM.
- [ ] `backend/tests/integration/test_140_escape_hatch.py` — proves the existing `_handle_load_skill` (`tool_dispatcher.py:666`) loads a menu-absent skill by exact name (verifies, does not rebuild).
- [ ] `backend/tests/integration/test_140_migration_091.py` — psycopg2 DB-CHECK (`:54322`): `skill_embeddings` table + `vector(1536)` col + owner-only RLS + both mark-stale triggers + `match_skills` RPC + `app_settings.skill_catalog_max_tokens`. RED until Plan 05 apply.
- [ ] `backend/tests/integration/test_140_skill_embedding_service.py` — embed-source builder (pure, green now) + reembed-shaped job (staleness predicate, RLS hand-scope, non-destructive) mirroring `test_111_1_reembed_*`. Job real run in Plan 05.
- [ ] Extend `backend/tests/test_agent_loop_catalog_override.py` — add a fits-budget byte-identical case + an over-budget-trim case (mock `match_skills` + `embed_texts`) + a fail-open case, reusing the existing `_capture_system_prompt` harness. The `None`/`()`/tuple branches must stay green (D-06).

---

## Manual-Only Verifications

### SC#10 — 4-Axis Cross-Provider UAT (authored HERE, not in PLAN tasks)

Per CLAUDE.md "UAT scoreboard recipe." **Setup for every row: an OVER-budget catalog** (either lower
`app_settings.skill_catalog_max_tokens` to a small value like `120`, or seed enough enabled skills that the
full `## Available Skills` block exceeds the budget) with **one planted should-fire skill** whose description
clearly matches the test prompt. The escape-hatch + honest marker must hold live across providers.

| # | Axis | Required row | Pass condition |
|---|------|--------------|----------------|
| U1 | Cross-provider (OpenAI) | Over-budget catalog + a prompt that clearly matches the planted should-fire skill, on an OpenAI representative model. | The planted skill is in the injected menu (or reachable), `load_skill` fires, the honest `_CATALOG_TRIM_MARKER` is present when skills were cut. |
| U2 | Cross-provider (Anthropic) | Same, on an Anthropic representative model. | Same as U1 — provider-agnostic (the pre-filter shapes the prompt before dispatch). |
| U3 | Cross-provider (Google) | Same, on a Google representative model. | Same as U1. |
| U4 | Cross-provider (OpenRouter) | Same, on an OpenRouter representative model. | Same as U1 (OpenRouter experimental — native-safe behavior expected; note upstream flakiness if any). |
| U5 | Multi-tool | One prompt (over-budget catalog) that triggers the planted skill **and** a second tool (e.g. `load_skill` + `search_documents`) in one turn. | Both tools fire correctly; the skill still reaches the model. |
| U6 | Parallel-thread | Thread A streaming with an over-budget catalog while Thread B accepts a new prompt. | Thread A's pinned/recent set does NOT bleed into Thread B (owner/thread scope holds); each thread's catalog is scoped to its own turn. |
| U7 | Long-message | ≥ 50 prior messages OR a ≥ 5 KB user prompt with an over-budget catalog. | Trimming + pinned-keep still correct; no regression in interaction with `trim_messages_to_fit` (context_window budget). |

> Cross-provider axis satisfied when U1-U4 pass (one representative model per configured provider). If a
> provider is unavailable at UAT time, note it as blocked (not failed) with the upstream reason, per the
> Phase 135 U4 precedent.

### Why these are manual
The 4-axis matrix exercises live cross-provider streaming + real embedding + real DB ranking end-to-end,
which the automated suite mocks. The automated `build_skill_catalog_block` unit tests + the extended
override integration tests cover axes 1-3 structurally; long-message + true cross-provider dispatch stay
manual (SC#10 recipe).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
