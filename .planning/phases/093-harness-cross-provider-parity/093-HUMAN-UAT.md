---
status: partial
phase: 093-harness-cross-provider-parity
source: [093-VERIFICATION.md]
spec: 093-VALIDATION.md
started: 2026-06-02T21:30:00Z
updated: 2026-06-02T17:05:00Z
driver: Claude (Chrome-MCP smart-sample live UAT) + operator follow-up
---

## Current Test

[smart-sample live UAT complete — 1 confirmed issue (Google thought_signature) routed to gaps; operator-only dimensions (durability, parallel-thread, long-message, Moonshot/MiniMax/GLM breadth) remain]

> **Live sample driven 2026-06-02** against the running stack (frontend :5173 + backend :8000, login fhdmrd@gmail.com, KB folder **DBA** = the "Fahed Mrad Chapters 1 to 4" dissertation, 441+402 chunks). 8 live workflow/Deep runs across **4 of native-7 providers** (DeepSeek, Google, OpenAI, Anthropic) covering **all 4 seed workflows + all 5 phase types**. Evidence = Supabase `runs`/`workflow_runs`/`messages` rows + UI/panel + network 200s. Moonshot, MiniMax, zhipu(GLM) NOT live-sampled (operator breadth).

## Tests

### 1. Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow headline gate
expected: Each of research_summarize / plan_execute_verify / literature_review / doc_qa_human runs end-to-end on ALL native-7; runs + sub-agent runs record the CORRECT per-provider model; tools ACTUALLY dispatch (not narrated); both llm_agent and llm_single phases complete.
result: issue
reported: "3 of 4 sampled providers PASS end-to-end (DeepSeek, OpenAI, Anthropic) with correct per-provider models recorded and real tool dispatch. GOOGLE FAILS: literature_review on gemini-3.5-flash errored with 400 INVALID_ARGUMENT 'Function call is missing a thought_signature in functionCall parts ... default_api:search_documents, position 2' — the harness sub-agent's multi-turn Gemini tool call omits the required thought_signature. Moonshot/MiniMax/zhipu(GLM) not live-sampled."
severity: major
evidence: |
  PASS — per-provider model resolution + NATIVE tool fire confirmed in Supabase:
  - DeepSeek research_summarize (wf b97ee55e): parent run deepseek-v4-pro, sub-agent deepseek-v4-flash, both provider=deepseek; final msg grounded w/ real source_refs (dissertation chunks). NATIVE tool fire (grounding can only come from search_documents actually executing).
  - DeepSeek literature_review clause-rich (wf 5d7bb1e8): parent deepseek-v4-pro spawned 3 parallel sub-agent runs (deepseek-v4-flash) — split_topic→llm_batch_agents N=3 fan-out, all completed; merged review integrated 3 distinct subtopics, 96 sources.
  - OpenAI plan_execute_verify (wf 3964deb1): gpt-5.4-mini, completed, 9 sources, verify-gate routed forward.
  - OpenAI doc_qa_human (wf 9d3ee63b): gpt-5.4-mini, full ask_user round-trip, completed.
  - Anthropic research_summarize (wf 7e35e33d): claude-haiku-4-5, parent+sub-agent provider=anthropic, grounded w/ 48 sources.
  FAIL — Google: run 2f54f88e error verbatim: "400 INVALID_ARGUMENT. ... 'Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly ... function call default_api:search_documents, position 2.'" The merge phase then 'completed' by NARRATING the failure (no review delivered) — workflow_run status misleadingly 'completed'.

### 2. Dimension 2 — 4-axis bandwidth (SC#10 MANDATORY scoreboard recipe)
expected: Cross-provider = all native-7; Multi-tool = ≥1 row firing search_documents + execute_code; Parallel-thread = Thread A streaming while Thread B kicks off; Long-message = ≥5KB prompt OR ≥50 prior messages.
result: blocked
blocked_by: other
reason: "Cross-provider PARTIAL (4/7 live: DeepSeek/Google/OpenAI/Anthropic). search_documents dispatch confirmed on all 4. Multi-tool (search + execute_code in ONE prompt) NOT cleanly demonstrated — plan_execute_verify did search (9 sources) but the trivial arithmetic did not force execute_code (1 sub-agent, no code-exec run). Parallel-thread NOT tested. Long-message NOT tested. These 3 axes + the remaining 3 providers are operator follow-up."

### 3. Dimension 3 — durability (resume / resume-mid-ask_user / Continue / reload)
expected: Resume after uvicorn kill re-drives + surfaces; resume-mid-ask_user; Continue at step cap; reload reconcile no stale lock.
result: blocked
blocked_by: server
reason: "Requires killing/restarting the operator's uvicorn process (user runs the backend in their own terminal — agent must not kill it) and observing live SSE/Supabase reconcile. Not exercisable from the verifier/Chrome-MCP session. Operator-only."

### 4. Dimension 4 — Deep-parity regression (RED LINE D-14) + CR-01 semantic round-trip
expected: 092.5 SSE-skeleton diff on Deep — Anthropic byte-identical; Deep task() sub-agent unaffected; CR-01 Anthropic sub-agent system prompt actually delivered.
result: pass
reported: "CR-01 CONFIRMED live + Deep not regressed. (Full skeleton-diff regression driver = operator.)"
evidence: |
  - CR-01 (Anthropic system-prompt carry): Anthropic HARNESS research_summarize (wf 7e35e33d) produced a grounded summary w/ 48 source_refs citing specific tables ('Mrad, Table 4.29'). If the sub-agent/phase system prompt were dropped on the native Anthropic path (the role=system-stripping converter), the sub-agent would not know to use search_documents → ungrounded. The deep grounding confirms the system prompt round-trips. Mirrors the task_service.py:203-216 fix.
  - Deep parity: Deep-mode (NOT harness) run on Anthropic (run 60c5478c) grounded w/ 13 sources, correctly extracted all six objectives O1–O6 from the PDF Section 1.4 — Deep agent loop + tool use intact post-093.
  - File-level byte-identical (agent_loop.py + sub_agent_service.py ZERO diff) already verified in 093-VERIFICATION.md.
  - NOT run by agent: the scripts/_diag_skeleton_diff.py structural-skeleton driver across Deep on all 7 + run1-vs-run2 noise isolation — operator regression backstop.

### 5. Dimension 5 — result-quality operator pass/fail (the "as-intended" gate)
expected: research_summarize grounded (doesn't ask user to share research); literature_review integrates distinct subtopics; plan_execute_verify answer reflects executed result; doc_qa_human finalize incorporates the user's correction.
result: issue
reported: "MIXED. research_summarize (DeepSeek, Anthropic) and literature_review (DeepSeek N=3) are EXCELLENT — grounded, integrated, do NOT ask the user to share research (migration-065 anti-delegation prompts hold). TWO quality concerns: (a) plan_execute_verify (OpenAI) said 'Using the figures you provided' and used survey N=165 — the dissertation reports N=309 — so execute-phase grounding/search is weak for that prompt; (b) doc_qa_human (OpenAI) finalize did NOT faithfully apply my explicit correction (I said 'exactly 4 research questions RQ1–RQ4 mapping to 6 objectives'; it listed 6 questions and omitted the mapping)."
severity: minor

### 6. WR-02 — model-resolver casing-trap live check
expected: For each native provider (esp. zhipu/GLM/MiniMax case-sensitive registry), selected model present in available_models so the D-06 fallback does NOT replace a legit model; gemini-3.5-flash in Google's available_models (IN-03).
result: pass
reported: "No mis-routing observed. user_settings is EMPTY (no saved row) → resolver correctly uses provider defaults → all 8 runs recorded the correct per-provider model (deepseek-v4-pro/-flash, gemini-3.5-flash, gpt-5.4-mini, claude-haiku-4-5). IN-03 confirmed: gemini-3.5-flash auto-selected as Google default + recorded on the run. The casing-trap (D-06 fallback on a STALE SAVED cross-provider model) cannot arise on empty settings — the GLM/MiniMax saved-settings edge is operator-deferred (requires saving a GLM/MiniMax model then switching provider)."

### 7. STRUCTURED-recovery mechanism split (clarified 2026-06-02)
expected: (a) default-model compat-natives (DeepSeek/Moonshot/GLM/MiniMax) fire search_documents via NATIVE mode; (b) a deliberately registry-MISSING / native_tools:False model triggers the STRUCTURED inject+post-parse recovery and STILL fires the tool.
result: blocked
blocked_by: other
reason: "(a) CONFIRMED for DeepSeek — search_documents fires NATIVELY (grounded results across 3 DeepSeek runs, never narrated). Moonshot/GLM/MiniMax NATIVE path not live-sampled. (b) Requires a deliberately mis-cased/unregistered model id, which the UI does not expose (it only offers registered models) — code-verified (task_service.py:233-248 inject + :317-330 post-parse, gated on calling_mode==STRUCTURED + bool(tools)) but not live-exercisable from the UI. Operator/edge-config follow-up."

## Summary

total: 7
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 3

## Gaps

- truth: "literature_review (and any tool-using harness workflow) runs end-to-end on Google/Gemini — search_documents dispatches across multi-turn"
  status: failed
  reason: "User-equivalent (agent-driven live UAT): Google gemini-3.5-flash harness sub-agent 400 INVALID_ARGUMENT 'Function call is missing a thought_signature in functionCall parts ... default_api:search_documents, position 2' on the SECOND tool turn. Workflow 'completes' by narrating the failure (no deliverable)."
  severity: major
  test: 1
  root_cause: "The harness/task_service sub-agent iteration consumer DELIBERATELY ignores the gateway `finish` event's thought_signature (task_service.py:299-300 comment: 'finish ignored — the sub-agent return needs no token SUM or thought_signature round-trip (A1)'). Gemini REQUIRES the base64 thought_signature emitted on a functionCall to be echoed back on the assistant's functionCall parts in the NEXT request. The DEEP consumer hydrates it (agent_loop.py _on_chunk finish-branch; google.py SEAM notes the hydration is consumer-side); the HARNESS consumer does not. So Google sub-agent turn-2 tool calls go out without thought_signature → 400. Google-only (no other provider emits/requires thought_signature)."
  artifacts:
    - path: "backend/app/services/task_service.py"
      issue: "iteration consumer ignores `finish` event → drops Gemini thought_signature (A1 assumption wrong for Google); ~line 299-300 + the tool_calls buffer it rebuilds for the next assistant turn"
    - path: "backend/app/services/agent_loop.py"
      issue: "reference: Deep consumer hydrates thought_signature onto tool_calls_buffer (the working path to mirror)"
    - path: "backend/app/services/provider_gateway/google.py"
      issue: "SEAM doc confirms thought_signature hydration is consumer-side, not in the adapter"
  missing:
    - "In the harness/task_service consumer, capture thought_signature from the `finish` event's tool_calls[] and echo it back onto the assistant functionCall parts on the next iteration (Google-only, additive, mirrors agent_loop.py). Must NOT change other providers' behavior or the Deep byte-identical path."
  debug_session: ""

- truth: "plan_execute_verify execute phase grounds its numbers in the documents (not 'figures you provided'); doc_qa_human finalize faithfully applies the user's explicit correction"
  status: failed
  reason: "Dim-5 quality: OpenAI plan_execute_verify used N=165 (doc reports 309) + 'Using the figures you provided'; OpenAI doc_qa_human finalize ignored the explicit 'exactly 4 RQ1–RQ4 mapping to 6 objectives' correction and listed 6 items."
  severity: minor
  test: 5
  root_cause: "Likely prompt-quality (migration-065 anti-delegation prompts cover the 'ask user to share research' defect but not execute-phase grounding fidelity or finalize correction-incorporation strength). Partly model behavior (gpt-5.4-mini). Needs operator judgment + possibly a prompt tune; deeper measurement = SEED-050 → Phase 096 eval."
  artifacts: []
  missing:
    - "Operator final pass/fail on result-quality across ≥2 providers (the Dimension-5 'as-intended' gate). Consider a code-forcing multi-tool prompt to exercise execute_code (Dim-2 multi-tool)."
  debug_session: ""
