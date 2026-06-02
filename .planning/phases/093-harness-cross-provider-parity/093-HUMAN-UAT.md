---
status: partial
phase: 093-harness-cross-provider-parity
source: [093-VERIFICATION.md]
spec: 093-VALIDATION.md
started: 2026-06-02T21:30:00Z
updated: 2026-06-02T21:30:00Z
---

## Current Test

[awaiting operator LIVE UAT — needs the running backend + native-7 provider keys + live Supabase/Redis]

> All 28/28 codebase must-haves are verified GREEN (see 093-VERIFICATION.md). The
> deterministic + IDOR + byte-identical-Deep file-level checks pass. PARITY-02's
> BINDING closure is the operator-run LIVE matrix below (D-13 / SC#10) — it cannot
> run in the agent sandbox. The full row-by-row spec lives in **093-VALIDATION.md**;
> this file is the trackable checklist that surfaces in /gsd:progress + /gsd:audit-uat.

## Tests

### 1. Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow headline gate
expected: Each of research_summarize / plan_execute_verify / literature_review / doc_qa_human runs end-to-end on ALL native-7 (OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/zhipu, MiniMax); runs + sub-agent runs rows record the CORRECT per-provider model; tools ACTUALLY dispatch (not narrated as text); both llm_agent and llm_single phases complete.
result: [pending]

### 2. Dimension 2 — 4-axis bandwidth (SC#10 MANDATORY scoreboard recipe)
expected: Cross-provider = all native-7 (Dim 1); Multi-tool = ≥1 row firing search_documents + execute_code (plan_execute_verify execute phase); Parallel-thread = Thread A streaming literature_review fan-out while Thread B accepts a research_summarize kickoff; Long-message = one workflow kicked off with a ≥5 KB prompt OR after ≥50 prior messages.
result: [pending]

### 3. Dimension 3 — durability (resume / resume-mid-ask_user / Continue / reload)
expected: Resume: kill uvicorn mid-llm_agent phase → restart → resume_stranded_workflows re-drives → answer surfaces (D-11) on ≥1 native provider. Resume-mid-ask_user: kill while paused in doc_qa_human confirm → restart → re-subscribe → submit answer → run completes (card flips green). Continue: drive a phase to step cap → POST /continue → run resumes + surfaces. Reload: page reload during a streaming harness run → reconcile → no stale lock (F2 self-heal).
result: [pending]

### 4. Dimension 4 — Deep-parity regression (RED LINE D-14) + CR-01 semantic round-trip
expected: Run the 092.5 SSE-diff skeleton driver on Deep — Anthropic byte-identical (0 skeleton edits, twin cross-check); other 6 within tool-path noise. PLUS the eval task prompt (Deep task() sub-agent) confirming the task_service rewrite did not regress Deep sub-agents — **especially the CR-01 Anthropic path: confirm the sub-agent system prompt is actually delivered on Anthropic** (a SEMANTIC loss the skeleton diff won't catch; file-level diff is already zero).
result: [pending]

### 5. Dimension 5 — result-quality operator pass/fail (the "as-intended" gate)
expected: On a real KB folder (sampled across ≥2 providers incl. ≥1 OpenAI-compat native): research_summarize produces a grounded summary and does NOT ask the user to share research (sources attach); literature_review integrates distinct per-subtopic reviews; plan_execute_verify actually runs code/search and the answer reflects the executed result (not a hollow VERIFIED); doc_qa_human finalize incorporates the user's correction (does not restart). Deeper repeatable measurement = SEED-050 → Phase 096.
result: [pending]

### 6. WR-02 — model-resolver casing-trap live check (deferred from code review)
expected: For each native provider (esp. zhipu/GLM/MiniMax with documented case-sensitive registry-id sensitivity), confirm the user-selected model is PRESENT in that provider's available_models — so the newly-live D-06 cross-provider fallback does NOT replace a legitimately-selected model with _SUB_AGENT_MODEL_DEFAULTS. Also confirm gemini-3.5-flash is in Google's available_models (IN-03).
result: [pending]

### 7. STRUCTURED-recovery mechanism split (clarified 2026-06-02)
expected: (a) default-model compat-natives (DeepSeek/Moonshot/GLM/MiniMax) fire search_documents via NATIVE mode (the happy path the gateway-consumption fix enables); (b) a deliberately registry-MISSING / native_tools:False model triggers the STRUCTURED inject+post-parse recovery and STILL fires the tool (does not narrate it as text).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
