---
phase: 093-harness-cross-provider-parity
verified: 2026-06-02T21:30:00Z
status: human_needed
score: 28/28 codebase must-haves verified (PARITY-02 binding closure = operator LIVE UAT)
overrides_applied: 0
re_verification:
  previous_status: none
  note: initial verification
human_verification:
  - test: "Dimension 1 — native-7 x 5-phase-type x 4-seed-workflow headline gate"
    expected: "Each of research_summarize / plan_execute_verify / literature_review / doc_qa_human runs end-to-end on ALL native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/zhipu, MiniMax); runs + sub-agent runs rows record the CORRECT per-provider model; tools ACTUALLY dispatch (not narrated as text); both llm_agent and llm_single phases complete"
    why_human: "Requires the operator's running backend + provider API keys + live Supabase + Redis; non-deterministic LLM round-trips cannot be exercised in the verifier sandbox (D-13: F1-F8 each passed unit tests and failed live — wire-format INSUFFICIENT)"
  - test: "Dimension 2 — 4-axis bandwidth (SC#10 MANDATORY scoreboard recipe)"
    expected: "Cross-provider = all native-7 (covered by Dim 1); Multi-tool = >=1 row firing search_documents + execute_code (plan_execute_verify execute phase); Parallel-thread = Thread A streaming literature_review fan-out while Thread B accepts a research_summarize kickoff; Long-message = one workflow kicked off with a >=5KB prompt OR after >=50 prior messages"
    why_human: "Requires live multi-provider + parallel-thread streaming against a running stack; cannot be driven from the verifier"
  - test: "Dimension 3 — durability rows (resume / resume-mid-ask_user / Continue / reload)"
    expected: "Resume: kill uvicorn mid-llm_agent phase -> restart -> resume_stranded_workflows re-drives -> answer surfaces (D-11) on >=1 native provider. Resume-mid-ask_user: kill while paused in doc_qa_human confirm -> restart -> re-subscribe -> submit answer -> run completes (card flips green). Continue: drive a phase to step cap -> POST /continue -> run resumes + surfaces. Reload: page reload during a streaming harness run -> reconcile -> no stale lock (F2 self-heal)"
    why_human: "Requires killing/restarting the live worker process and observing live SSE + Supabase reconcile — process lifecycle + real-time behavior not reproducible in the verifier"
  - test: "Dimension 4 — Deep-parity regression row (RED LINE D-14)"
    expected: "Run the 092.5 SSE-diff skeleton driver on Deep — Anthropic byte-identical (0 skeleton edits, the twin cross-check); other 6 within tool-path-noise. Plus the eval task prompt (Deep task() sub-agent) confirming the task_service rewrite did not regress Deep sub-agents (esp. the CR-01 Anthropic system-prompt path — a SEMANTIC loss the skeleton diff will not catch)"
    why_human: "Requires live cross-provider Deep runs + the operator's eval scoreboard; the byte-identical claim at the FILE level is verified here (agent_loop.py + sub_agent_service.py have ZERO diff across the phase), but the SEMANTIC Anthropic system-prompt round-trip needs a live task() row"
  - test: "Dimension 5 — result-quality operator pass/fail (the 'as-intended' gate)"
    expected: "Per the migration-065 Fix-3 prompts, on a real KB folder: research_summarize produces a grounded summary of found research (does NOT ask the user to share research, sources attach); literature_review integrates distinct per-subtopic reviews; plan_execute_verify actually runs code/search and the answer reflects the executed result (not a hollow VERIFIED); doc_qa_human finalize incorporates the user's correction (does not restart). Sampled across >=2 providers incl. >=1 OpenAI-compat native"
    why_human: "Functionality != quality — a workflow can run, dispatch tools, and surface an answer while still doing the wrong thing (the 'asks me to share the research' defect). Requires operator judgment on real KB content. Deeper repeatable measurement = SEED-050 -> Phase 096"
  - test: "WR-02 — model-resolver casing-trap live check (deferred from REVIEW)"
    expected: "For each native provider (especially zhipu/GLM/MiniMax with documented case-sensitive registry-id sensitivity), confirm the user-selected model is PRESENT in that provider's available_models list — so the newly-live D-06 cross-provider fallback does NOT replace a legitimately-selected model with _SUB_AGENT_MODEL_DEFAULTS. Also confirm gemini-3.5-flash is in Google's available_models (IN-03)"
    why_human: "Depends on each provider's curated available_models content for the operator's actual settings rows; the fallback logic is verified correct in code (fires only on a genuine cross-provider mismatch, never on empty/fresh settings), but the DATA completeness is environment-specific"
  - test: "STRUCTURED-recovery mechanism split (Landmine 4, clarified 2026-06-02)"
    expected: "(a) default-model compat-natives (DeepSeek/Moonshot/GLM/MiniMax) fire search_documents via NATIVE mode (the happy path the gateway-consumption fix enables); (b) a deliberately registry-MISSING / native_tools:False model triggers the STRUCTURED inject+post-parse recovery and STILL fires the tool (does not narrate it as text)"
    why_human: "Both modes need a live provider round-trip; the verifier confirms the consumer-side inject + post-parse code exists and is gated on calling_mode + bool(tools), but cannot exercise the NATIVE-vs-STRUCTURED branch against a real model"
---

# Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening — Verification Report

**Phase Goal:** The Harness/workflow path is a first-class, provider-agnostic, robust backend surface — all 5 phase-types and all 4 seed workflows run end-to-end on the native-7 — achieved by CONSUMING the Phase 092.5 gateway, with Deep byte-identical (the red line).
**Verified:** 2026-06-02T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement Summary

Every codebase-layer must-have across all 5 plans is **VERIFIED in the actual source** (not just claimed in SUMMARYs). The two REVIEW-caught fixes are genuinely in place and correctly gated: **CR-01** (Anthropic system-prompt drop — the byte-identical-Deep RED-LINE breach) is fixed at `task_service.py:203-216`, and **WR-01** (no-tools llm_single answer blanking) is fixed at `task_service.py:227/233/317`. The Deep red-line files (`agent_loop.py`, `sub_agent_service.py`) have **ZERO diff** across the entire phase commit range — file-level byte-identical confirmed. The deterministic test surface is GREEN (67 unit + 5 live-DB integration + 69 contract/deviation tests). Migration 065 is a sound data-only trigger-toggle.

**The phase GOAL is not yet achieved** — not because of a codebase gap, but because PARITY-02's binding closure is, by explicit design (D-13 / SC#6), the **native-7 × 5-phase-type × 4-workflow LIVE UAT** authored in `093-VALIDATION.md`. That UAT requires the operator's running backend + provider keys + live Supabase/Redis and CANNOT be executed in the verifier sandbox. This is the lesson of F1-F8: every one passed unit tests and failed live — wire-format checks are INSUFFICIENT. Status is therefore **human_needed** with the 7 LIVE UAT items above as the gate.

## Observable Truths (per-plan must_haves)

### Plan 093-01 — Wave 0 substrate (split_topic alias + INPUT_UNSATISFIED lint + migration 065)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | literature_review produces sub_questions from kickoff_prompt (not []) | ✓ VERIFIED (code) | `programmatic.py:93` `topic = (input.get("topic") or input.get("kickoff_prompt") or "").strip()`; migration 065 Fix 1 adds `kickoff_prompt` to the split phase input_keys. Live N>1 fan-out = Dim 1 UAT |
| 2 | llm_batch_agents fans out N>1 when split_topic produced N | ✓ VERIFIED (code) / ? live | Code path present; test_093_split_topic.py GREEN. Actual N-way fan-out on a real run = Dim 1 UAT |
| 3 | plan_execute_verify completes without dead-ending when VERIFIED not echoed | ✓ VERIFIED (code) / ? live | migration 065 Fix 2 sets `{phases,2,validators}` to `[]` (drops the dead-ending regex gate on the terminal phase). test_093_verify_gate_route_forward.py SKIPS (needs live run) — routed to Dim 1 UAT |
| 4 | Publishing a workflow reading a never-produced input_key is rejected | ✓ VERIFIED | `reachability.py:42 _check_input_contracts`, wired into `lint_workflow` errors at `:176`; `_KNOWN_RUN_INPUT_KEYS={"kickoff_prompt","topic"}` at `:39`. test_harness_reachability GREEN |
| 5 | The 4 seed workflows lint clean after the seed fix | ✓ VERIFIED | reachability tests GREEN; only literature_review split declares input_keys (now `["topic","kickoff_prompt"]` — both known run inputs) |
| 6 | Downstream phases work prior-phase output into a result (not ask user to supply it) | ✓ VERIFIED (prompt) / ? quality | migration 065 Fix 3 rewrites research_summarize/literature_review/doc_qa_human prompts to anti-delegation form. Result-quality judgment = Dim 5 operator pass/fail |
| 7 | Each Wave-0 test file exists and fails RED (or skips on absent live DB) until its plan lands | ✓ VERIFIED | All 7 files exist (verify.artifacts 7/7 passed); now GREEN after their plans landed |

### Plan 093-02 — task_service gateway consumption (F9 core)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | _stream_one_iteration drives open_stream, not create_adaptive_streaming_chat directly | ✓ VERIFIED | `task_service.py:217` `stream, calling_mode = await open_stream(_provider, _gw_request)` |
| 2 | calling_mode consumed (never discarded) — STRUCTURED-mode natives get TOOL_USAGE_INSTRUCTIONS inject + parse_structured_tool_calls post-parse | ✓ VERIFIED | inject at `:233-248` (gated on calling_mode==STRUCTURED + _has_tools); post-parse at `:317-330` (`parse_structured_tool_calls`) |
| 3 | DeepSeek/Moonshot/GLM/MiniMax harness sub-agent fires search_documents (not narrated) | ✓ VERIFIED (code) / ? live | NATIVE happy path + STRUCTURED safety-net both present (Landmine 4 mechanism split). BOTH modes = Dim 1 + the mechanism-split UAT item |
| 4 | Anthropic/Google harness sub-agents reach their native adapters via the gateway | ✓ VERIFIED | `_adapter_provider` routes anthropic/google directly (`:184`); **CR-01 fix** carries system_prompt so the native Anthropic converter (which strips role=system) receives it |
| 5 | Deep task()/analyze_document callers byte-identical (rewrite is correct path for them too) | ✓ VERIFIED | agent_loop.py + sub_agent_service.py = ZERO diff across phase; full-suite net-new failures = 0; Deep task() unit cases GREEN. SEMANTIC Anthropic round-trip = Dim 4 UAT |

### Plan 093-03 — model-resolver field fix + resolve_workflow_ctx_model wrapper

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | resolve_sub_agent_model_safely reads available_models (list[str]), not non-existent llm_models | ✓ VERIFIED | `sub_agent_models.py:89-93` reads `user_settings.available_models` |
| 2 | Stale cross-provider llm_model falls back to provider default | ✓ VERIFIED | `:111-130` — if candidate not in available_models, return `_provider_default` (or best-effort candidate for flexible providers) |
| 3 | _SUB_AGENT_MODEL_DEFAULTS actually fires now (dead since 085) | ✓ VERIFIED | `:95 _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(...)`; D-06 revives the previously-empty list. WR-02 live-data check = UAT |
| 4 | resolve_workflow_ctx_model resolves an effective ctx model WITHOUT mutating saved settings | ✓ VERIFIED | `:137-169` — reads only, returns string; docstring + body confirm no writes to llm_model/override_provider/available_models |
| 5 | Google sub-agent default is the live-confirmed served representative | ✓ VERIFIED | `config.py:597 "google": "gemini-3.5-flash"` (Open Q1 live-probed 2026-06-02); registered in MODEL_CAPABILITIES at config.py:231. IN-03 presence-in-available_models = UAT |

### Plan 093-04 — ask_user F10 workflow_run-id fallback + Continue ctx-model

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Harness ask_user answer to /runs/{workflow_run_id}/ask_user_response resolves via workflow_runs ownership fallback, returns 200 | ✓ VERIFIED | `runs.py:542-567` owner-scoped workflow_runs SELECT + thread-anchor confirm, synthesizes Step-1 row; test_093 live-DB suite 5/5 GREEN |
| 2 | Answer published under workflow_run id to wake ask_user:{workflow_run_id}:{tcid} | ✓ VERIFIED | `runs.py:627 publish_response(redis, run_id, ...)` with run_id = path workflow_run id (Steps 2-4 unchanged) |
| 3 | Deep runs-keyed ask_user path still returns 200 (branch never replace) | ✓ VERIFIED | Step-1 runs SELECT stays FIRST + unchanged (`:521 if not row:` guards the fallback); test_deep_runs_id_path_still_200 GREEN |
| 4 | A workflow_run id owned by another user returns 404 (never 403, no leak) | ✓ VERIFIED | every resolve query `.eq("user_id", current_user["id"])`; `:569-573` raises 404 on every miss; test_other_users_..._404_no_leak + test_non_existent_..._404 + test_..._not_thread_anchor_404 all GREEN |
| 5 | Continue endpoint threads resolved ctx model onto harness continuation wf_ctx | ✓ VERIFIED | `runs.py:877 resolve_workflow_ctx_model` import + `:886 _ctx_model = resolve_workflow_ctx_model(_owner_settings)` (D-04 site 3) |

### Plan 093-05 — shared surfacing helper + ctx-model sites 1+2 + draft carry

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Harness run surfaces final answer (delta+sources+citations+confidence) on live, resume, AND Continue | ✓ VERIFIED (code) / ? live | `harness_engine.py:235 _surface_final_answer` invoked by run_workflow (the single path all 3 entries reach). Live surfacing on resume/Continue = Dim 3 UAT |
| 2 | Exactly ONE surfacing site + ONE persist owner per entry path (no double assistant message) | ✓ VERIFIED | inline threads.py block REMOVED (`:1283-1299` is now a doc comment; live-kickoff installs NO _result_sink persist). _surface_final_answer persists directly. test_093_surfacing GREEN |
| 3 | Surfacing emits delta + grounding BEFORE the terminal run_completed | ✓ VERIFIED | `harness_engine.py:822 _surface_final_answer(...)` then `:823 _emit(... "run_completed" ...)` — strict ordering; helper docstring confirms |
| 4 | ask_user prompt carries the prior phase draft to durable row, SSE event, and /pending replay | ✓ VERIFIED | phase_types.py: `:414 draft=_latest_phase_text`, `:443` durable row, `:474` SSE event; panel.py `:153 "draft": payload.get("draft")` (/pending); D-12 plumbing complete |
| 5 | Frontend PendingAsk carries draft (additive); api.ts phase_* dispatch stays purely additive | ✓ VERIFIED | `frontend/src/lib/api.ts:610 draft: parsed.draft as string \| undefined`; tsc = 54-error baseline, 0 net-new |
| 6 | Live-kickoff and resume wf_ctx thread the resolved ctx model (D-04 sites 1+2) | ✓ VERIFIED | threads.py `:1239 model=resolve_workflow_ctx_model(user_settings)` (site 1); harness_engine.py `:944 _ctx_model = resolve_workflow_ctx_model(_owner_settings)` (site 2 / resume) |

**Codebase score:** 28/28 must-have truths verified at the code level. The truths marked "? live" are code-VERIFIED but their BINDING confirmation is the operator LIVE UAT (by design — SC#6).

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/harness/programmatic.py` | split_topic reads kickoff_prompt | ✓ VERIFIED | `:93` alias present |
| `backend/app/services/harness/reachability.py` | INPUT_UNSATISFIED lint | ✓ VERIFIED | `_check_input_contracts` `:42`, wired `:176` |
| `supabase/migrations/065_harness_seed_fixes.sql` | 3 corrective seed fixes | ✓ VERIFIED | data-only trigger-toggle txn; all 3 fixes present + applied (operator SQL-editor) |
| `backend/app/services/task_service.py` | gateway-consuming iteration honoring calling_mode | ✓ VERIFIED | open_stream `:217`, CR-01 `:203-216`, WR-01 `:227/233/317` |
| `backend/app/services/sub_agent_models.py` | available_models fix + resolve_workflow_ctx_model | ✓ VERIFIED | `:89` field, `:137` wrapper, `:95/118` provider-default fallback |
| `backend/app/config.py` | _SUB_AGENT_MODEL_DEFAULTS Google default | ✓ VERIFIED | `:597 gemini-3.5-flash` |
| `backend/app/api/runs.py` | ask_user workflow_run-id fallback + Continue ctx-model | ✓ VERIFIED | F10 `:542-567`, Continue `:886` |
| `backend/app/services/harness_engine.py` | _surface_final_answer (D-11) + resume ctx-model (site 2) | ✓ VERIFIED | `:235`, `:822`, `:944` |
| `backend/app/api/threads.py` | inline surfacing removed + site-1 ctx-model | ✓ VERIFIED | block removed `:1283-1299`, `:1239` site 1 |
| `backend/app/services/harness/phase_types.py` | draft into ask_user row + SSE (D-12) | ✓ VERIFIED | `:414/443/474` |
| `backend/app/api/panel.py` | /pending replay carries draft | ✓ VERIFIED | `:153` |
| `frontend/src/lib/api.ts` | PendingAsk.draft additive | ✓ VERIFIED | `:610` |
| 7 Wave-0 test files | RED scaffolds | ✓ VERIFIED | verify.artifacts 7/7 passed; all GREEN after their plans |

## Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| migration 065 | workflow_definitions.literature_review | corrective seed update (trigger-disable txn) | ✓ WIRED (SDK confirmed + read) |
| reachability.py | lint_workflow | _check_input_contracts appended into errors | ✓ WIRED (SDK confirmed, `:176`) |
| task_service.py | provider_gateway.open_stream | await open_stream(...) | ✓ WIRED (`:217`) |
| task_service.py | tool_parser.parse_structured_tool_calls | STRUCTURED post-parse gated on calling_mode + bool(tools) | ✓ WIRED (`:317-320`) |
| sub_agent_models.py | UserEffectiveSettings.available_models | dead safety net now reads the real field | ✓ WIRED (`:89-93`) |
| sub_agent_models.py | _SUB_AGENT_MODEL_DEFAULTS | fallback to provider default on cross-provider mismatch | ✓ WIRED (`:95/118`) |
| runs.py submit_ask_user_response | workflow_runs ownership + thread anchor | fallback after Step-1 runs SELECT 404 | ✓ WIRED (`:542-567`) |
| runs.py submit_ask_user_response | publish_response under workflow_run id | Steps 2-4 unchanged | ✓ WIRED (`:627`) |
| harness_engine.py run_workflow terminal | shared surfacing helper | emit delta+grounding then persist, before run_completed | ✓ WIRED (`:822` before `:823`) |
| phase_types.py _exec_llm_human_input | ask_user_prompt durable row + SSE | draft = prior phase text | ✓ WIRED (`:414/443/474`) |

*Note: the gsd-sdk verify.artifacts / verify.key-links verbs only resolved Plan 01's frontmatter (the multi-plan phase-dir parser returns the first plan and errors "No must_haves... found" on 02-05). Plans 02-05 were therefore verified MANUALLY via Grep/Read against the live source — all pass.*

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| _surface_final_answer | final_text / source_refs / citations / confidence | ctx.final_output / final_source_refs / final_citations / final_confidence (set by engine completion block harness_engine.py:665-687) | Engine-produced per-phase output — real on a live run | ✓ FLOWING (code) / confirmed live = Dim 1+3 UAT |
| ask_user prompt draft | draft | `_latest_phase_text(accumulated_outputs)` (prior phase output) | Real prior-phase text on a multi-phase run | ✓ FLOWING (code) |
| split_topic sub_questions | topic | `input.get("topic") or input.get("kickoff_prompt")` (run_inputs) | Real user kickoff prompt on a live run | ✓ FLOWING (code) |
| ask_user answer publish | response_text | request body (operator answer) | Real on submit | ✓ FLOWING |

No HOLLOW_PROP or DISCONNECTED data sources found at the code level. The dynamic-render artifacts (frontend draft/answer) belong to Phase 094's visible frame and were verified additive-only here.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 093 unit suite (gateway + resolver + reachability + split_topic + surfacing) | `pytest test_085_task_service test_sub_agent_routing test_harness_reachability test_093_split_topic test_093_surfacing -q` | 67 passed | ✓ PASS |
| F10 ask_user + IDOR live-DB integration | `pytest test_093_ask_user_workflow_run_live.py` | 5 passed (incl. 404-no-leak, Deep-unaffected) | ✓ PASS |
| verify-gate route-forward integration | `pytest test_093_verify_gate_route_forward.py` | 1 skipped (needs live end-to-end run) | ? SKIP -> Dim 1 UAT |
| Rule-1 deviation files (dual_mode_wiring + sub_agent_intelligence) | `pytest -k "dual_mode_wiring or sub_agent_intelligence" -q` | 69 passed | ✓ PASS |
| Deep red-line files untouched | `git diff 267e8286~1 HEAD -- agent_loop.py sub_agent_service.py` | empty (zero diff) | ✓ PASS |
| CR-01 + WR-01 fix commits exist with regression tests | `git show --stat 63e9f6c6 f93c61fd` | both present (+test_085 cases) | ✓ PASS |
| full-schema.sql drift | `git status --short supabase/full-schema.sql` | clean (migration 065 data-only) | ✓ PASS |

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| PARITY-02 | 093-01..05 (all) | Harness reaches cross-provider parity by consuming the gateway — 5 phase-types + 4 seed workflows on native-7; shared model-resolver (resolve never mutate); ask_user round-trip (Option i); 3 never-run phase-types completed + safe-by-construction; resume/Continue surface answer + draft; Deep byte-identical | ⏳ CODE-COMPLETE, BINDING-PENDING | All code wiring VERIFIED (28/28 must-haves). REQUIREMENTS.md correctly tracks PARITY-02 as **Pending** — its acceptance is the native-7 × 5-phase-type × 4-workflow LIVE UAT (SC#6), which is operator-run. Do NOT flip to Validated until the LIVE UAT passes |
| GATEWAY-01 | (Phase 092.5) | Shared provider gateway | ✓ N/A here | Closed by Phase 092.5 (REQUIREMENTS.md: Complete). 093 CONSUMES it — confirmed via open_stream consumption |
| PARITY-01 | (re-deferred) | Anthropic Deep-mode polish | ✓ N/A | Correctly re-deferred 2026-06-01; not in 093 scope |

**No orphaned requirements.** PARITY-02 is the sole req and is claimed by every plan's `requirements: [PARITY-02]`. Traceability verdict: **CORRECT** — PARITY-02 stays Pending in REQUIREMENTS.md until the LIVE UAT closes it.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No blocker/warning stubs. The `return ""` in resolve_workflow_ctx_model (`:164`) is an intentional None-settings contract (documented, resume/Continue load owner settings), not a stub. The threads.py `:1283-1299` block is a documentation comment marking a deliberate removal, not dead code |

The IN-01/IN-02/IN-03 informational items from the REVIEW are acknowledged-no-code-change and do not block:
- IN-01 (ℹ️ Info): `_surface_final_answer` persists AFTER `finish_run` — pre-existing crash-window pattern mirroring `_shielded_finalize`; acceptable v1, not a 093 regression.
- IN-02 (ℹ️ Info): INPUT_UNSATISFIED lint is stricter than the runtime executor — fails CLOSED (publish-time rejection, never a runtime hang); no shipped seed trips it.
- IN-03 (ℹ️ Info): gemini-3.5-flash default bump — evidence-backed; verifier confirms it is registered in MODEL_CAPABILITIES (config.py:231); live available_models presence = UAT item.

## Deferred Items (addressed in later milestone phases — NOT actionable gaps)

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | The VISIBLE workflow-mode legibility / draft-render frame (the draft plumbed here is wire-only) | Phase 094 | VALIDATION + plan 05: "using the existing event vocabulary — *plumbing*; the visible frame is Phase 094". ROADMAP 094 = "Workflow Legibility + Mode Clarity" |
| 2 | Deeper repeatable result-quality measurement (golden expected-outputs, automated rubric judge, restart-quality) | Phase 096 (SEED-050) | VALIDATION Dim 5: "The deeper repeatable quality measurement ... is SEED-050 -> Phase 096 eval". ROADMAP 096 = "Eval Harness + Cross-Provider Verification" |

These are informational. Dimension 5's THIN operator pass/fail (the "as-intended" gate for THIS phase's migration-065 prompts) is NOT deferred — it remains a human-verification item here.

## Pre-Existing Test-Infra Noise (NOT 093 regressions — confirmed against baseline)

All catalogued in `deferred-items.md`, each confirmed reproducing on baseline:
- `test_get_model_capability_inference::test_infer_openai_from_gpt_prefix` — stale 90s-vs-300s timeout pin in config inference (pre-existing, not in 093's files).
- 8 runs/SSE-stream live-DB FK-violation tests — test-data hygiene (thread_id FK race), same class as Phase 091.
- `test_harness_gates::test_bounded_retry...` + (ordering-dependent) `test_phase_dispatch...` — cross-file PHASE_TYPE_REGISTRY state pollution; reproduces on baseline `a7828abb` and in isolation.

Net-new failures from Phase 093 = **0** across every touched surface. Candidates for a `/gsd:quick` test-isolation/pin pass (relates to SEED-049).

## Human Verification Required

See the `human_verification:` frontmatter for the full 7-item gate. Summary:

1. **Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow** (the headline PARITY-02 gate).
2. **Dimension 2 — 4-axis bandwidth** (SC#10: cross-provider × multi-tool × parallel-thread × long-message).
3. **Dimension 3 — durability rows** (resume / resume-mid-ask_user / Continue / reload).
4. **Dimension 4 — Deep-parity regression** (092.5 SSE-skeleton diff + eval task() — the SEMANTIC Anthropic system-prompt round-trip that CR-01 fixed; the skeleton diff will not catch a semantic prompt loss).
5. **Dimension 5 — result-quality operator pass/fail** (the migration-065 anti-delegation prompts on a real KB folder).
6. **WR-02 — model-resolver casing-trap live check** (selected model present in each provider's available_models; gemini-3.5-flash in Google's).
7. **STRUCTURED-recovery mechanism split** (default-model NATIVE happy path AND registry-missing STRUCTURED safety net both fire the tool, not narrate).

**Operator runbook:** `093-VALIDATION.md` §"Manual-Only Verifications" has the full matrix, the seed-the-runs directive (no "if data permits" deferrals), and the 092.5-inherited regression-detection method (structural-skeleton diff, run1-vs-run2 noise isolation, Anthropic-as-twin, eval floor native-7 16/28, SEED-048 embeddings-SPOF false-alarm guard, do-NOT-lean-on-Playwright SEED-049). Login: fhdmrd@gmail.com / 123456 at http://localhost:5173/ for Chrome-MCP-driven cells.

## Gaps Summary

**No codebase gaps found.** Every must_have across all 5 plans is verified in the actual source; the two REVIEW-caught defects (CR-01, WR-01) are genuinely fixed and correctly gated; the Deep red-line files are byte-identical (zero diff); the deterministic test surface is GREEN with zero net-new failures; migration 065 is sound. The CR-01 fix genuinely closes the Anthropic system-prompt drop: `_system_prompt` is extracted from `messages[role==system]` (`task_service.py:203-206`) and set on the `GatewayRequest` (`:213`), mirroring `agent_loop.py:1553/1628`; it is a no-op for openai_compat (which reads messages and ignores system_prompt) and is captured BEFORE the STRUCTURED inject mutates messages (correct, since Anthropic/Google are always NATIVE).

**The phase is CODE-COMPLETE but its GOAL is not yet PROVEN.** PARITY-02's binding closure is — by explicit phase design (D-13 / SC#6, the lesson of the F1-F8 mock-blind-spot cascade) — the operator-run native-7 × 5-phase-type × 4-workflow LIVE UAT, which cannot be executed in the verifier sandbox. Status: **human_needed**. Run the `093-VALIDATION.md` matrix on the live stack; on a clean pass (all 4 seeds × native-7 + the 4-axis bandwidth + durability + Deep-parity + Dimension-5 quality), flip PARITY-02 to Validated and the phase to passed.

---

_Verified: 2026-06-02T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
