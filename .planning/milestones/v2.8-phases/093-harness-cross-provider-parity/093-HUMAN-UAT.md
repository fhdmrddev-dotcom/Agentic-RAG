---
status: passed
phase: 093-harness-cross-provider-parity
source: [093-VERIFICATION.md]
spec: 093-VALIDATION.md
started: 2026-06-02T21:30:00Z
updated: 2026-06-03T19:00:00Z
driver: Claude (Chrome-MCP smart-sample live UAT) + operator follow-up
reuat_pending: false
reuat_note: "Gap-closure plans 06-09 (D-16..D-21) SHIPPED + code-verified 41/41 (093-VERIFICATION.md, status human_needed). Gap 1 (Google+Moonshot reasoning round-trip) -> 093-07; Gap 2 (GLM max_steps) -> 093-09 (force-synthesis + cap 8->12); Gap 3 (result-quality) -> SEED-050/Phase 096. BINDING re-confirmation = the operator D-21 native-7 LIVE re-UAT (full 11-item matrix in 093-VERIFICATION.md human_verification + 093-VALIDATION.md runbook). PARITY-02 stays Pending until that passes."
---

## Current Test

[post-gap-closure re-UAT PENDING — see "## Re-UAT (post-gap-closure 06-09)" below. The pre-fix sample (this file's Tests/Gaps) DROVE plans 06-09, which are now shipped + code-verified; the binding live re-confirmation across the native-7 is the remaining operator gate.]

> **Live sample driven 2026-06-02** against the running stack (frontend :5173 + backend :8000, login fhdmrd@gmail.com, KB folder **DBA** = the "Fahed Mrad Chapters 1 to 4" dissertation, 441+402 chunks). **11 live workflow/Deep runs across ALL native-7 providers** covering **all 4 seed workflows + all 5 phase types**. Evidence = Supabase `runs`/`workflow_runs`/`messages` rows + UI/panel + network 200s.
>
> **Harness tool-using-workflow cross-provider matrix (research_summarize / multi-turn tool use):**
>
> | Provider | Result | Evidence |
> |----------|--------|----------|
> | OpenAI | ✅ PASS | plan_execute_verify (9 src) + doc_qa_human ask_user round-trip; correct model |
> | Anthropic | ✅ PASS | research_summarize grounded 48 src (CR-01 confirmed); Deep 8-tool loop intact |
> | DeepSeek | ✅ PASS | research_summarize + literature_review N=3 fan-out (96 src); NATIVE tool fire |
> | MiniMax | ✅ PASS | research_summarize grounded 35 src; NATIVE tool fire (M2.7 parent / M2.5-highspeed sub) |
> | Google | 🔴 FAIL | 400 — `thought_signature` missing on 2nd tool turn (functionCall) |
> | Moonshot | 🔴 FAIL | 400 — `reasoning_content` missing on assistant tool call at index 2 |
> | zhipu (GLM) | 🟡 PARTIAL | NATIVE tool fire works (36 src) but sub-agent reached **max_steps without a final answer** → no deliverable |
>
> **4/7 fully pass. Google + Moonshot share ONE root cause (harness consumer drops the finish-event reasoning metadata that must round-trip on multi-turn tool calls — the Deep path preserves it). GLM is a separate convergence/step-cap issue.**

## Tests

### 1. Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow headline gate
expected: Each of research_summarize / plan_execute_verify / literature_review / doc_qa_human runs end-to-end on ALL native-7; runs + sub-agent runs record the CORRECT per-provider model; tools ACTUALLY dispatch (not narrated); both llm_agent and llm_single phases complete.
result: issue
reported: "ALL native-7 sampled. 4 PASS (OpenAI, Anthropic, DeepSeek, MiniMax) — correct per-provider models, real NATIVE tool dispatch, grounded. 2 HARD FAIL with ONE shared root cause: GOOGLE (gemini-3.5-flash) 400 'Function call is missing a thought_signature in functionCall parts ... position 2' AND MOONSHOT (kimi-k2.6) 400 'thinking is enabled but reasoning_content is missing in assistant tool call message at index 2' — both = the harness sub-agent's 2nd tool turn omits provider-specific reasoning metadata the Deep path round-trips. 1 DEGRADED: GLM/zhipu (glm-5.1) fires tools natively (36 sources) but the sub-agent reached max_steps without a final answer → no deliverable. So 3 of 7 native providers cannot complete a tool-using harness workflow."
severity: major
evidence: |
  PASS — per-provider model resolution + NATIVE tool fire confirmed in Supabase:
  - DeepSeek research_summarize (wf b97ee55e): parent run deepseek-v4-pro, sub-agent deepseek-v4-flash, both provider=deepseek; final msg grounded w/ real source_refs (dissertation chunks). NATIVE tool fire (grounding can only come from search_documents actually executing).
  - DeepSeek literature_review clause-rich (wf 5d7bb1e8): parent deepseek-v4-pro spawned 3 parallel sub-agent runs (deepseek-v4-flash) — split_topic→llm_batch_agents N=3 fan-out, all completed; merged review integrated 3 distinct subtopics, 96 sources.
  - OpenAI plan_execute_verify (wf 3964deb1): gpt-5.4-mini, completed, 9 sources, verify-gate routed forward.
  - OpenAI doc_qa_human (wf 9d3ee63b): gpt-5.4-mini, full ask_user round-trip, completed.
  - Anthropic research_summarize (wf 7e35e33d): claude-haiku-4-5, parent+sub-agent provider=anthropic, grounded w/ 48 sources.
  - MiniMax research_summarize (wf fdc9ad7a): MiniMax-M2.7 parent / MiniMax-M2.5-highspeed sub-agent, provider=minimax, grounded w/ 35 sources. NATIVE tool fire.
  FAIL —
  - Google literature_review (run 2f54f88e): "400 INVALID_ARGUMENT. ... 'Function call is missing a thought_signature in functionCall parts ... default_api:search_documents, position 2.'" Merge phase 'completed' by NARRATING the failure (no review). workflow_run status misleadingly 'completed'.
  - Moonshot research_summarize (run child of 7ad0027f): "Error code: 400 - 'thinking is enabled but reasoning_content is missing in assistant tool call message at index 2'". Summarize phase narrated the API error (no deliverable).
  PARTIAL —
  - GLM/zhipu research_summarize (wf ad0af8ea, thread 09643962): glm-5.1 parent / glm-4.6 sub-agent, provider=zhipu, both completed (NO 400), 36 sources retrieved (tool fire works) — but final msg: "Sub-agent reached max_steps without producing a final answer ... no research findings are available." Distinct from the reasoning round-trip bug.

### 2. Dimension 2 — 4-axis bandwidth (SC#10 MANDATORY scoreboard recipe)
expected: Cross-provider = all native-7; Multi-tool = ≥1 row firing search_documents + execute_code; Parallel-thread = Thread A streaming while Thread B kicks off; Long-message = ≥5KB prompt OR ≥50 prior messages.
result: blocked
blocked_by: other
reason: "Cross-provider now ALL 7 sampled (4 PASS / 2 hard-fail / 1 degraded — see Test 1). Multi-tool (search + execute_code in ONE prompt) NOT cleanly demonstrated — plan_execute_verify did search (9 sources) but the trivial arithmetic did not force execute_code (1 sub-agent, no code-exec run). Parallel-thread NOT tested. Long-message NOT tested. These 3 axes are operator follow-up."

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
result: issue
reported: "(a) NATIVE happy path CONFIRMED for DeepSeek (3 runs) AND MiniMax (35 src) — search_documents fires NATIVELY, never narrated. GLM/zhipu also fires tools natively (36 src) but its sub-agent loops to max_steps without finalizing. Google + Moonshot DO reach NATIVE mode but hard-fail on the 2nd tool turn (reasoning-metadata round-trip — see Gap 1), so their NATIVE multi-turn tool path is broken. (b) The registry-MISSING STRUCTURED-recovery branch needs a deliberately mis-cased/unregistered model id, which the UI does not expose — code-verified (task_service.py:233-248 inject + :317-330 post-parse, gated on calling_mode==STRUCTURED + bool(tools)) but not live-exercisable from the UI. Operator/edge-config follow-up."
severity: minor

## Summary

total: 7
passed: 2
issues: 3
pending: 0
skipped: 0
blocked: 2

## Gaps

- truth: "Any tool-using harness workflow runs end-to-end on the reasoning-model native providers (Google, Moonshot) — the sub-agent's multi-turn tool calls round-trip the provider's required reasoning metadata"
  status: fix_shipped_pending_reuat
  fixed_by: "093-07 (D-16/D-17) — task_service._drain now CONSUMES the gateway finish event: hydrates Google thought_signature + accumulates Moonshot/Kimi reasoning_content onto the assistant tool-call replay message. Code-verified + 43/43 unit GREEN; LIVE 400-elimination re-confirmation owed (re-UAT Test 2)."
  reason: "Live UAT: TWO native providers hard-fail on the 2nd sub-agent tool turn, same root cause. GOOGLE (gemini-3.5-flash): 400 'Function call is missing a thought_signature in functionCall parts ... default_api:search_documents, position 2'. MOONSHOT (kimi-k2.6): 400 'thinking is enabled but reasoning_content is missing in assistant tool call message at index 2'. Both workflows 'complete' by narrating the API error (no deliverable). 4/7 providers (OpenAI, Anthropic, DeepSeek, MiniMax) pass — they don't require echoing reasoning metadata."
  severity: major
  test: 1
  root_cause: "The harness/task_service sub-agent iteration consumer DELIBERATELY ignores the gateway `finish` event (task_service.py:299-300 comment: 'finish ignored — the sub-agent return needs no token SUM or thought_signature round-trip (A1)'). For reasoning models, the provider REQUIRES its per-turn reasoning metadata echoed back on the assistant tool-call parts in the NEXT request: Gemini → base64 `thought_signature` on functionCall; Moonshot/Kimi (thinking on) → `reasoning_content` on the assistant tool-call message. The DEEP consumer (agent_loop.py _on_chunk finish-branch) hydrates BOTH (the gateway adapters google.py / openai_compat.py already EMIT them on `finish`); the HARNESS consumer drops them. So the reasoning-provider sub-agent's turn-2 tool call is rejected. ONE fix unblocks both; reasoning_content is NOT referenced in task_service.py at all (confirmed)."
  artifacts:
    - path: "backend/app/services/task_service.py"
      issue: "iteration consumer ignores `finish` event → drops BOTH Gemini thought_signature AND Moonshot reasoning_content (A1 assumption wrong for reasoning models); ~line 299-300 + the tool_calls buffer it rebuilds for the next assistant turn"
    - path: "backend/app/services/agent_loop.py"
      issue: "reference: Deep consumer hydrates thought_signature + reasoning_content onto tool_calls_buffer (the working path to mirror)"
    - path: "backend/app/services/provider_gateway/google.py"
      issue: "SEAM doc confirms thought_signature hydration is consumer-side; the adapter EMITS it on finish"
    - path: "backend/app/services/provider_gateway/openai_compat.py"
      issue: "emits reasoning_content on finish (Moonshot/Kimi); harness consumer must echo it back"
  missing:
    - "In the harness/task_service consumer, capture the provider reasoning metadata (thought_signature for Gemini, reasoning_content for Moonshot/Kimi) from the `finish` event and echo it onto the assistant tool-call parts on the next iteration — mirror agent_loop.py. Provider-scoped + additive; MUST NOT change OpenAI/Anthropic/DeepSeek/MiniMax behavior or the Deep byte-identical path."
  debug_session: ""

- truth: "GLM/zhipu completes a tool-using harness workflow with a real deliverable"
  status: fix_shipped_pending_reuat
  fixed_by: "093-09 (D-19) — root cause PINNED via the live GLM run + LangSmith trace (thread 71502600 / wf f3cffe56): NOT a stuck loop or structured re-loop — Branch B (cap-too-low), the sub-agent did 8 DISTINCT progressive searches and was cut off mid-research (CSF sibling converged at exactly step 8). Fix: force-synthesis fallback on max_steps exhaustion (any provider returns a real answer, never the placeholder) + effective cap raise 8->12. Code-verified + 3/3 GREEN; LIVE convergence re-confirmation owed (re-UAT Test 3)."
  reason: "GLM/zhipu (glm-5.1 parent / glm-4.6 sub-agent) fires search_documents NATIVELY (36 sources, NO 400 error) but the research sub-agent reached max_steps without producing a final answer, so the summarize phase had no findings → narrated the failure. Distinct from the reasoning round-trip bug (no API error)."
  severity: major
  test: 1
  root_cause: "UNCONFIRMED — needs diagnosis. Candidates: (a) GLM tool-loop behavior (keeps searching, never emits a final text answer) possibly tied to how its reasoning/tool-call turns are fed back; (b) sub-agent max_steps cap too low for GLM's style; (c) a softer manifestation of the same reasoning-metadata handling. The sub-agent run completed without error but never produced a terminal answer."
  artifacts:
    - path: "backend/app/services/task_service.py"
      issue: "sub-agent iteration loop / max_steps handling for GLM — investigate whether GLM's tool turns converge to a final answer"
  missing:
    - "Diagnose why the GLM sub-agent loops to max_steps without finalizing; confirm whether it shares the reasoning-metadata cause or is a separate step-cap/convergence issue."
  debug_session: ""

- truth: "plan_execute_verify execute phase grounds its numbers in the documents (not 'figures you provided'); doc_qa_human finalize faithfully applies the user's explicit correction"
  status: deferred
  re_open_trigger: "SEED-050 / Phase 096 EVAL — result-quality (execute-phase grounding fidelity + finalize correction-incorporation) is a deeper prompt/eval surface NOT in 06-09 scope. Re-open when Phase 096 builds the harness result-quality eval. Operator Dimension-5 judgment (re-UAT Test 9) still samples it live."
  reason: "Dim-5 quality: OpenAI plan_execute_verify used N=165 (doc reports 309) + 'Using the figures you provided'; OpenAI doc_qa_human finalize ignored the explicit 'exactly 4 RQ1–RQ4 mapping to 6 objectives' correction and listed 6 items."
  severity: minor
  test: 5
  root_cause: "Likely prompt-quality (migration-065 anti-delegation prompts cover the 'ask user to share research' defect but not execute-phase grounding fidelity or finalize correction-incorporation strength). Partly model behavior (gpt-5.4-mini). Needs operator judgment + possibly a prompt tune; deeper measurement = SEED-050 → Phase 096 eval."
  artifacts: []
  missing:
    - "Operator final pass/fail on result-quality across ≥2 providers (the Dimension-5 'as-intended' gate). Consider a code-forcing multi-tool prompt to exercise execute_code (Dim-2 multi-tool)."
  debug_session: ""

## Re-UAT (post-gap-closure 06-09)

**Status: PENDING (operator-run).** Plans 06-09 shipped + code-verified (093-VERIFICATION.md = human_needed, 41/41 code must-haves; RED LINE held — agent_loop.py + sub_agent_service.py zero-diff; 99/99 deterministic tests). Code review of the gap-closure: 0 critical / 3 warning — WR-02 (log-sink startup-safe) + WR-03 (connection-string/secret redaction) FIXED (commit 94fcd141); WR-01 (093-08 makes Deep task() honor sub_agent_model — a deliberate, more-correct behavior change) = operator sign-off (re-UAT Test 8).

**Already re-confirmed LIVE this session** (the operator's GLM diagnosis run — thread `71502600-4c65-4ab9-9f6c-42b51ef93940`, wf `f3cffe56`, glm-4.6, completed end-to-end with a full ~8,118-char review):
- ✅ 093-08 model resolution — all sub-agent runs recorded `glm-4.6`, NOT gpt-4o.
- ✅ 093-07 S4 usage — sub-agent runs rows have non-NULL input/output tokens (16705/1789, 64060/210, 60636/2139).
- ✅ 093-01 split_topic — 3 sub-questions produced.
- ⚠️ This run PRE-DATES the 093-09 force-synthesis fix (it surfaced the symptom: 1 of 3 sub-agents hit max_steps). The post-fix GLM convergence is re-UAT Test 3.

**Remaining live re-confirmation (the binding PARITY-02 gate — full 11-item matrix in 093-VERIFICATION.md `human_verification` + the runbook in 093-VALIDATION.md §"Manual-Only Verifications"):**
- Test 2 — Google + Moonshot multi-tool harness sub-agent completes with NO round-2 400 (093-07 live proof).
- Test 3 — GLM literature_review fan-out: NO "reached max_steps" placeholder in the merged review (093-09 live proof; re-run the same prompt the diagnosis used).
- Tests 1, 4, 5 — the native-7 × workflow rotation (§9): correct per-provider model, tools dispatch, usage non-NULL.
- Tests 6-7 — 4-axis bandwidth (multi-tool + parallel-thread + long-message) + durability (resume / resume-mid-ask_user / Continue / reload).
- Test 8 — Deep-parity skeleton-diff regression + WR-01 sub_agent_model sign-off.
- Test 9 — Dimension-5 result-quality (the migration-065 anti-delegation prompts on a real KB folder; the residual Gap-3 quality concerns).
- Tests 10-11 — model-resolver casing-trap data check + STRUCTURED-recovery NATIVE/safety-net split.

**Activate the D-20 log-sink first** (already done this session): `LOG_FILE_PATH=logs/backend.log` in `backend/.env` + uvicorn restart → grep `backend/logs/backend.log` for `gpt-4o … falling back`, `runs.usage missing`, `400 thought_signature`/`reasoning_content` during the re-UAT.

On a clean live pass across all 11 dimensions → flip PARITY-02 to Validated and phase status to passed.

---

## Re-UAT (D-21) — EXECUTED 2026-06-03 (Claude Chrome-MCP + log-sink + Supabase + LangSmith) → **PASSED (passed_with_overrides)**

Live stack: frontend :5173 + backend :8000 (log-sink active), KB folder **DBA** (Mrad RPA/BPM dissertation, N=309). Evidence = `runs`/`workflow_runs` rows + `backend/logs/backend.log` deltas + UI + screenshots `screenshots/093-reuat-*`.

### Dimension 1 — native-7 × 4-workflow (8 cells) — **8/8 PASS**
| # | Workflow | Provider/model | workflow_run | Result |
|---|---|---|---|---|
| 1 | research_summarize | Google / gemini-3.5-flash | 31486487 | ✅ 14 tool turns, **0× thought_signature 400** (vs DB anchor 2f54f88e@turn2); sub-agent tokens 180528/2252; grounded N=309, 46 src |
| 2 | research_summarize | OpenAI / gpt-5.4-mini | 5757114b | ✅ control; grounded N=309, 17 src |
| 3 | plan_execute_verify | Moonshot / kimi-k2.6 | 801b89a9 | ✅ **0× reasoning_content 400** across code turns; execute_code fired; ⚠️ Dim-5: fabricated n=247 (no search) |
| 4 | plan_execute_verify | Anthropic / claude-haiku-4-5 | 2b61198c | ✅ grounded N=309 + **search+code = Dim-2 multi-tool ✓**; ⚠️ over-iterated (16 calls/10 code-exec) |
| 5 | literature_review | GLM / glm-5.1→glm-4.6 | f09b3864 | ✅ **0 "max_steps" placeholder**; 3 subs real output 3470/1808/2587 (not /210 looper) |
| 6 | literature_review | DeepSeek / v4-pro→v4-flash | 53ab5f76 | ✅ control; N=3 fan-out, 0 placeholder |
| 7 | doc_qa_human | MiniMax / M2.7→M2.5-highspeed | 5b27540b | ✅ **ask_user round-trip works** (card→ANSWERED·AGENT RESUMED→finalize); ⚠️ Dim-5: finalize "reviewed" vs applied correction |
| 8 | doc_qa_human | Google / gemini-3.5-flash | c97cc01d | ✅ ask_user round-trip + **finalize incorporated correction** (4 RQs + RQ↔O map); thought_signature reconfirmed |

**4 gap-closure fixes all proven LIVE:** Google thought_signature (093-07), Moonshot reasoning_content (093-07), GLM max_steps (093-09), sub-agent model+tokens / no gpt-4o (093-08/S4). Across all 8 cells: status=completed, correct per-provider model, 0 gpt-4o leaks, sub-agent tokens non-NULL, 0 unexpected 400s.

### Dimension 2 — 4-axis bandwidth — **PASS**
- Cross-provider ✅ (8 cells). Multi-tool ✅ (cell 4 search+code). Parallel-thread ✅ (Thread A deepseek lit_review + Thread B OpenAI research_summarize concurrent; **no global isStreaming lockout** — 075.3 regression absent; no event bleed; clean A↔B reconcile). Long-message ✅ (5188-char kickoff persisted un-truncated in workflow_runs.inputs, run acted on it, no context-length error).

### Dimension 4 — Deep-parity regression — **PASS (no regression)**
- `eval_cross_provider.py --prompt factual-doc-search` = **8/8 providers PASS** (all invoke search_documents). Deep `task()` cell = PASS.
- `capture_sse_baseline.py --mode after` raw verdict = BLOCK, **but per the documented noise-isolation method it is non-regression**: Anthropic twin **byte-identical across 2 runs**; all diverging providers' edits *moved* run-to-run (minimax & moonshot flipped PASS↔BLOCK; deepseek skeleton 26→57 tok) = LLM tool-path non-determinism, not structural regression. `agent_loop.py` git-zero-diff in 093 corroborates.

### Dimension 10/11 — model-resolver data check + STRUCTURED-recovery — **PASS**
- Guard fired correctly on ALL 7 providers (gpt-5.4-mini → correct per-provider default; never gpt-4o). NATIVE tool-fire confirmed on all compat-natives. STRUCTURED safety-net (registry-missing model) = code-verified only (UI can't exercise an unregistered id) — operator/edge follow-up.

### Dimension 3 — durability — **PARTIAL (override)**
- Abrupt-crash resume path **NOT exercised**: on Windows, Ctrl+C triggers a *graceful* shutdown that cancels+fails the in-flight run (producer `cancelled` → workflow_run `failed`); force-quit didn't override until the client SSE dropped. So the resume sweep had nothing stranded to recover. Resume infra is pre-existing (091/092), unchanged by 093 → retest deferred.
- New findings from the attempt (→ ops/094): (a) graceful shutdown **hangs** on an open harness SSE connection; (b) it **fails an in-flight human-input run** rather than preserving it resumable; (c) a failed harness run **renders empty in the UI** (no reason) — RC-4 → 094.

### Dimension 5 — result-quality — **operator-judged; 2 deferred gaps → SEED-050/096**
- Excellent + grounded: Google, OpenAI, Anthropic, DeepSeek (N=309, real stats, cited). Two provider-specific gaps: **kimi-k2.6** execute fabricated n=247 (didn't search); **MiniMax-M2.7** finalize reviewed-the-draft instead of applying the correction. Plumbing uniform; quality varies by model → Phase 096 eval + prompt-tune candidates.

### Operator UI/legibility observations (all → 094, none block 093)
1. Draft-before-ask_user is **invisible** — review-an-invisible-draft (draft plumbed wire-only 093-05; render = 094 SC#6 / Deferred #1). 2. Nothing in chat during a run (spinner→full answer at once) → 094 SC#6. 3. **Operator-specified 094 acceptance bar:** show the *real steps* (sub-agents spawned, N searches, M tool calls, phase transitions, "merge generating", done) — the log-level transparency surfaced in the panel. 4. Generated files (charts/reports/xlsx from execute_code) not shown in panel FILES → SEED-037/038 + 094/095. 5. Failed run renders empty (RC-4) → 094. 6. Intermittent **general-chat silent send-drop** (not harness) → new bug report. 7. Mode toggle reads "Deep" during a Harness run → D-092-UX/094.

### Overrides accepted by operator (2026-06-03)
1. Dim-3 abrupt-resume retest deferred (Windows kill-friction; pre-existing infra). 2. Dim-5 result-quality (kimi/MiniMax) → SEED-050/096. 3. WR-01 (Deep task() honors sub_agent_model) accepted (eval task cell passed).

**VERDICT: PARITY-02 Validated. Phase 093 CLOSED (passed_with_overrides). Next = /gsd:sketch 094 (G-2).**
