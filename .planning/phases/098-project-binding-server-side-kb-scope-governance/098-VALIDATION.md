---
phase: 098
slug: project-binding-server-side-kb-scope-governance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 098 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 098-RESEARCH.md → "## Validation Architecture" (verified file:line seams).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + `pytest-asyncio` (`asyncio_mode = auto`) |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) |
| **Quick run command** | `cd backend && python -m pytest tests/test_098_schema_lock.py tests/test_098_scope_governance.py -x` |
| **Full suite command** | `cd backend && python -m pytest -q` |
| **Estimated runtime** | ~quick < 10s · full ~60-120s (existing harness suite) |

Consumable existing patterns: `test_harness_engine.py`, `test_harness_whitelist.py`, `test_harness_resume.py`, `test_thread_workflow_endpoint.py`, `test_reingest.py`. **No `test_retrieval_service.py` exists** → the ⊆-assert unit test is net-new. A `backend/tests/conftest.py` already exists — reuse its fixtures.

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_098_schema_lock.py tests/test_098_scope_governance.py -x`
- **After every plan wave:** Run `cd backend && python -m pytest -q` (full backend suite)
- **Before `/gsd-verify-work`:** Full suite green **AND** the representative-4 cross-provider live UAT scoreboard complete
- **Max feedback latency:** ~10 seconds (quick run)

---

## Per-Task Verification Map

> Task IDs are illustrative (planner assigns final IDs). The Req/SC + Test Type + Command columns are the contract.

| Req / SC | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SC#1 / PROJ-01 | seeded-template JSONB (migrations 061/065) `model_validate()`s unchanged after adding optional fields | V5 | strict model still accepts old rows (additive-optional) | unit | `pytest tests/test_098_schema_lock.py::test_old_rows_validate -x` | ❌ W0 | ⬜ pending |
| SC#1 / D-01,D-08 | a definition WITH `project_folder_id`/output fields round-trips (`model_dump(mode="json")` → `model_validate`) | V5 | UUID→str on write, str→UUID on read | unit | `pytest tests/test_098_schema_lock.py::test_new_fields_roundtrip -x` | ❌ W0 | ⬜ pending |
| SC#1 / PROJ-01 | `GET /workflows/published?project_folder_id=X` returns only matching defs | V4 | IDOR-safe filter scoped to user | integration | `pytest tests/test_thread_workflow_endpoint.py -k project_filter -x` | ⚠️ extend | ⬜ pending |
| SC#2 / PROJ-02 | `_build_phase_tool_context` narrows project subtree by per-phase `folder_scope` (∩) | V4 | bound id list, not a prompt hint | unit | `pytest tests/test_098_scope_governance.py::test_per_phase_narrowing -x` | ❌ W0 | ⬜ pending |
| SC#3 / D-04 | run-start sources scope from `project_folder_id` (not thread folder) and binds `p_folder_ids` (mock RPC asserts param) | V4 | server-resolved from RLS ctx | integration | `pytest tests/test_098_scope_governance.py::test_run_start_resolution -x` | ❌ W0 | ⬜ pending |
| SC#3 / D-05a | ⊆ assert is a **literal no-op when scope is None** (Deep byte-identical) | V1 | gated guard, no Deep regression | unit | `pytest tests/test_098_scope_governance.py::test_deep_noop -x` | ❌ W0 | ⬜ pending |
| SC#3 / D-07 | narrow-only validator REJECTS a phase `folder_scope ⊄ subtree` | V5 | hard validation error at validate/save | unit | `pytest tests/test_098_scope_governance.py::test_narrow_only_reject -x` | ❌ W0 | ⬜ pending |
| SC#4 / D-06 | injected out-of-scope row → row dropped AND `scope_violation` XADDed to `run:{run_id}` | V4 | clip + observe, run continues | unit/integration | `pytest tests/test_098_scope_governance.py::test_clip_and_emit -x` | ❌ W0 | ⬜ pending |
| GOV-01 / D-13 | an act/export tool excluded from a read-only phase's whitelist is refused | V4 | act/export separable from read | unit | `pytest tests/test_harness_whitelist.py -k exclude -x` | ⚠️ extend | ⬜ pending |
| SC#3 / Pitfall 3 | resume + Continue ctx-build sites resolve scope (not `None`) | V4 | no post-restart scope bypass | unit | `pytest tests/test_harness_resume.py -k scope -x` | ⚠️ extend | ⬜ pending |
| SC#4 / SC#10 / D-09 | bound scope holds in-run per provider; clip warning observable | V4 | provider-agnostic by construction | **live UAT** (manual) | representative-4 cross-provider | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_098_schema_lock.py` — old-row round-trip (SC#1) + new-field round-trip (D-01/D-08). Load the seeded-template JSONB from migrations 061/065 as the "old row" fixture.
- [ ] `tests/test_098_scope_governance.py` — per-phase narrowing (SC#2), Deep no-op (SC#3/D-05a), narrow-only reject (SC#3/D-07), clip+emit (SC#4/D-06). The ⊆-assert + emit test needs a fake `ctx.emit` capturing XADD calls (mirror existing harness-test fakes).
- [ ] No `tests/conftest.py` change expected (`backend/tests/conftest.py` already exists; reuse its fixtures).

---

## Manual-Only Verifications

> SC#10 4-axis cross-provider mandate. Authored here (NOT in PLAN tasks). Representative-4 (D-09): OpenAI, Anthropic, Google, OpenRouter — one model each. Full native-7 reserved for Phase 101.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-run retrieval stays inside the project subtree — **per provider** | SC#3 / SC#4 / D-09 | needs live provider keys + running stack | Run a bound workflow once per provider (OpenAI / Anthropic / Google / OpenRouter). Cross-check via Supabase: the run's cited `document_id`s all resolve to `folder_id ∈ subtree`. (4 rows) |
| **Multi-tool** scope holds | SC#10 | live multi-tool path | One bound phase prompts `search_documents` + a second tool (`execute_code`). Confirm scope holds across both tools. (≥1 row) |
| **Parallel-thread** scope isolation | SC#10 | concurrent live threads | Thread A runs a bound workflow while Thread B accepts a new prompt. Confirm scope isolation holds (A's scope doesn't leak to B). (≥1 row) |
| **Long-message** scope still bound | SC#10 | live large context | ≥50 prior messages OR a ≥5 KB user prompt; confirm retrieval still bound to the project subtree. (≥1 row) |
| `scope_violation` observability | SC#4 / D-06 | clip rarely fires naturally (RPC is primary filter — Pitfall 4) | Inject/force an out-of-scope retrieval (mock or test path), confirm the `scope_violation` event appears in the run log/timeline. If it can't be naturally triggered, document why (RPC primary filter excludes it pre-assert). |
| Act/export excluded from read-only phase | GOV-01 / D-13 | live whitelist enforcement | A read-only phase whose whitelist excludes an act/export tool refuses it at runtime. (1 row) |

**Watch item:** `minimax-m3-invalid-tool-args-400` — MiniMax is NOT in the representative-4; re-open/route the bug only if it surfaces here.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`test_098_schema_lock.py`, `test_098_scope_governance.py`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] Representative-4 cross-provider live UAT scoreboard authored + executed
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
