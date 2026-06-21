---
phase: 111
slug: metadata-enrichment-extraction-backend
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
validated: 2026-06-16
---

# Phase 111 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `111-RESEARCH.md` § "Validation Architecture". The planner maps Task IDs into the Per-Task table; the executor fills Status.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), unit + integration split (`backend/tests/unit/`, `backend/tests/integration/`) |
| **Config file** | `backend/pytest.ini` / existing project conftest (Phase 110 added `tests/integration/test_110_*`) |
| **Quick run command** | `cd backend && venv\Scripts\python -m pytest tests/unit/test_111_*.py -x -q` |
| **Full suite command** | `cd backend && venv\Scripts\python -m pytest -q` (prove net-new=0 vs base via SEED-056 stash-and-rerun; ~119 pre-existing rot failures at baseline) |
| **Estimated runtime** | ~30s unit subset; full suite minutes (integration needs local Supabase :54322 up) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && venv\Scripts\python -m pytest tests/unit/test_111_*.py -x -q`
- **After every plan wave:** Run the full `test_111_*` set incl. integration (requires local Supabase up)
- **Before `/gsd-verify-work`:** Full suite green (net-new=0 vs base), THEN the live SC#4 4-axis UAT (Manual-Only below)
- **Max feedback latency:** ~30 seconds (unit subset)

---

## Per-Task Verification Map

> The planner maps each Wave-0 test file to the Task that delivers its behavior. Requirement→test reference (from RESEARCH § Validation Architecture):

| Requirement / Invariant | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|-------------|
| META-01 (define) | CRUD create writes own-scoped, `is_global=false` forced; list returns own+global enabled | integration (live DB) | `pytest tests/integration/test_111_metadata_fields_crud.py -x` | ✅ green |
| META-01 (extract) | `build_metadata_model` folds enabled custom fields into the schema (7 built-ins + custom + confidence) | unit | `pytest tests/unit/test_111_dynamic_model.py::test_custom_fields_in_schema -x` | ✅ green |
| META-01 (vocab) | `field_type` validated against closed `{string,date,number,boolean,enum}` `Literal`; unknown rejected | unit | `pytest tests/unit/test_111_dynamic_model.py::test_field_type_vocabulary -x` | ✅ green |
| META-03 (un-pin) | `extraction_model` resolves from `app_settings`; unset → `settings.llm_model` (gpt-4o) | unit | `pytest tests/unit/test_111_extraction_model_resolve.py -x` | ✅ green |
| META-03 (settings) | migration 072 columns read back via `_build_settings_from_row` (env_attr=None) | integration (live DB) | `pytest tests/integration/test_111_settings_readback.py -x` | ✅ green |
| META-04 (window) | head+tail sampler returns head+tail for >cap text, full text for ≤cap; cap clamps to model window | unit | `pytest tests/unit/test_111_window_sampling.py -x` | ✅ green |
| Confidence survival | `confidence` populated dict survives `model_dump(exclude_none=True)`; attaches as `_confidence` | unit | `pytest tests/unit/test_111_confidence_survives_exclude_none.py -x` | ✅ green |
| exclude_none non-regression | empty `author` DROPPED (not `""`); flat fields stay top-level | unit | `pytest tests/unit/test_111_exclude_none_nonregression.py -x` | ✅ green |
| Flat-filter non-regression | stored metadata with `_confidence` still matches a flat `@>` containment filter | integration (live DB) | `pytest tests/integration/test_111_flat_filter_compat.py -x` | ✅ green |
| User-scoped read | field-def read with explicit `.or_(user_id,is_global)` returns own+global only, NOT cross-user (2-user) | integration (live DB) | `pytest tests/integration/test_111_field_def_scoping.py -x` | ✅ green |
| lmstudio provider | `lmstudio` in `_PROVIDER_BASE_URLS`; `resolve_llm_provider` sets base_url, dummy key, no `/v1` append | unit | `pytest tests/unit/test_111_lmstudio_provider.py -x` | ✅ green |
| Audit live | `metadata.field.create` INSERTs and SELECTs back against live DB (NOT mocked) | integration (live DB) | `pytest tests/integration/test_111_audit_field_create.py -x` | ✅ green |

*Status filled by executor: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/test_111_dynamic_model.py` — create_model schema + field_type vocabulary (META-01) — authored 111-01, xfail until Plan 02/03
- [x] `tests/unit/test_111_confidence_survives_exclude_none.py` — the A1 underscore-field caveat (**BLOCKING** — verifies the chosen `confidence`→`_confidence` naming) — authored 111-01, design proof GREEN + builder variant xfail
- [x] `tests/unit/test_111_exclude_none_nonregression.py` — empty author dropped (D-111-9) — authored 111-01, design proof GREEN + dynamic variant xfail
- [x] `tests/unit/test_111_window_sampling.py` — head+tail + cap clamp (META-04) — authored 111-01, xfail until Plan 02
- [x] `tests/unit/test_111_extraction_model_resolve.py` — model resolution + gpt-4o fallback (META-03) — authored 111-01, xfail until Plan 02/04
- [x] `tests/unit/test_111_lmstudio_provider.py` — provider registration (D-111-7) — authored + flipped GREEN 111-01 Task 3
- [x] `tests/integration/test_111_metadata_fields_crud.py` — CRUD + RLS forcing (META-01) — authored 111-01, xfail until Plan 03
- [x] `tests/integration/test_111_field_def_scoping.py` — 2-user service-role scoping (D-111-6) — authored 111-01, xfail until Plan 02
- [x] `tests/integration/test_111_settings_readback.py` — migration 072 read-back (META-03) — authored 111-01, xfail until Plan 05 live apply
- [x] `tests/integration/test_111_flat_filter_compat.py` — `@>` still matches with `_confidence` present (D-111-9) — authored 111-01, xfail until Plan 04 (synthetic-row proof stands)
- [x] `tests/integration/test_111_audit_field_create.py` — live INSERT+SELECT (D-111-5/11) — authored 111-01, raw round-trip xpasses against migrated :54322
- [x] Framework install: none — pytest + venv already present

---

## Manual-Only Verifications

> THE CRITICAL GATE (the D-102/104 lesson): static def-shape tests FALSE-GREEN forced-structured-output, provider-forcing, and audit-enum failures. These MUST be driven LIVE, not mocked, and are authored here (NOT as PLAN.md tasks). SC#4 = the CLAUDE.md UAT scoreboard recipe.
>
> **✅ ALL 5 MANUAL-ONLY ITEMS RESOLVED 2026-06-16** (verify-work `human_verification` gate closed 4/4; `111-HUMAN-UAT.md` status: passed, 0 issues; `111-VERIFICATION.md` frontmatter `human_verification_resolved`). Axes a/c/d + live audit driven live 2026-06-15; axis b (local LM Studio) proven live 2026-06-16 (`gemma-4-12b-qat` emitted full confidence-scored metadata via the real `forced_emit` TIER-COERCE path). Two app-path local-routing bugs surfaced → folded into Phase 111.1 (BUG-260616-01); they do NOT affect 111's engine or degradation contract.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (a) Cross-provider dynamic-schema extraction | META-03, SC#4 | Forced-structured-output across native-7 can only be proven against real providers; mocks false-green | Ingest the SAME doc with `extraction_model` set to one representative model per native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Z.ai-GLM, MiniMax) + OpenRouter; SELECT stored `documents.metadata` per run. **Acceptance = pass OR documented limitation per provider** — DeepSeek (deepseek-v4-pro)/Gemini (gemini-2.5-pro) may honest-fail the forced emit (BUG-260615-01 #3), MiniMax-M3 may malform tool-args (BUG-260607-03). COERCE + degradation is the net; a honest-fail that degrades to null metadata (doc still `completed`) is ACCEPTABLE + documented. 111 does NOT own the provider fix. |
| (b) Local model (LM Studio) | META-03, D-111-7, SC#4 | Local TIER-COERCE path + first-class `lmstudio` provider can't be mocked | Ingest a doc with `extraction_model` = the LM Studio Qwen2.5-7B-Instruct model id (provider `lmstudio`); SELECT stored metadata + `_confidence`. Expect a valid dynamic-schema emission via TIER-COERCE with custom fields + confidence. **Operator pre-req:** LM Studio running on the RTX 4050 with Qwen2.5-7B-Instruct Q4_K_M loaded (impersonation `LLM_PROVIDER=ollama`→:1234 is the documented fallback). |
| (c) Long-doc window-lift | META-04, SC#4 | Window sampling effectiveness needs a real ≥5KB doc with late data | Ingest a ≥5KB doc whose title/byline data is AFTER char 3000 and dates are at the very end; SELECT metadata. Expect the late title/date captured (proves head+tail beats `content[:3000]`). |
| (d) Graceful degradation | D-111-8, SC#4 | A failing/garbage model's behavior under the two-layer backstop can only be seen live | Ingest with a deliberately-failing/garbage-emitting model (tiny/broken local model or a model id that 400s); SELECT the doc row. Expect `status=completed` with null/partial metadata — NEVER stuck in `processing`/`failed` from the extraction step. |
| Live audit INSERT+SELECT | META-01, D-111-5 | Audit enum failures false-green in static tests (the 104 lesson) | Create a custom field via the CRUD endpoint → `metadata.field.create` row appears in `audit_log` on the live DB (SELECT it back). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (unit subset 0.47s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-16

---

## Validation Audit 2026-06-16

State A audit (validate-phase): re-ran the suite for ground truth (not trusting artifacts) — **42 unit passed (0.47s) + 7 passed / 2 xpassed integration against live :54322 / 0 failures**. All 12 automated Per-Task rows COVERED (test exists, targets behavior, green). All 5 Manual-Only rows resolved via verify-work (4/4). No gap-fill auditor spawned — no MISSING/PARTIAL gaps.

| Metric | Count |
|--------|-------|
| Requirements / invariants | 12 automated + 5 manual-only |
| COVERED (automated, green) | 12 |
| PARTIAL | 0 |
| MISSING | 0 |
| Manual-only resolved | 5 |
| Gaps found | 0 |
| Tests generated this audit | 0 (none needed) |

**Advisory (non-blocking, test hygiene):** 2 integration tests xpass (authored `xfail "until Plan 05 live apply"` — `test_111_settings_readback`, `test_111_audit_field_create` — now passing post-072-apply). They count green; the stale `xfail` markers could be dropped in a future cleanup. Not a coverage gap.
