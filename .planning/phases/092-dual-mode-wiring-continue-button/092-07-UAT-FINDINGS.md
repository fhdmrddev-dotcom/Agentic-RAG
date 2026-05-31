---
status: gaps_found
phase: 092-dual-mode-wiring-continue-button
plan: 07
source: [092-07-PLAN.md Task 6, 092-VALIDATION.md Manual-Only, operator UAT 2026-05-31]
gate: lived-experience UAT (document-grounded, DBA folder)
verdict: F4 (all facets) + resume current_user bug VERIFIED FIXED live; NEW blocker F5 (harness ctx missing the supabase client + folder-scope + spawn + semaphore) blocks every document-grounded workflow
---

## What passed (live, this UAT)

- **F4 Facet A (sub-agent parent_run_id FK): FIXED.** Harness Research→Summarize on the DBA folder created a sub-agent (`sub_run_id=8803e47e`) with **no** `runs_parent_run_id_fkey` violation. The research phase executed and the sub-agent ran its loop.
- **F4 Facet B groundwork:** the run kicked off, message POST → 201, SSE stream opened on the producer run id.
- **Resume `current_user` bug (27b12c37): FIXED.** Backend restarts cleanly — no startup-sweep `UUID('asyncpg.UUID')` crash, no stranded runs (operator terminalized the pre-fix `active` run).
- **RAG path REACHED (answers the operator's core concern):** the harness research phase **actually invoked `search_documents`** against the DBA folder — proving Harness workflows ARE document-grounded and do hit the KB retrieval path. The product behaves as a RAG engine in workflow mode; the workflow did not answer generically, it tried to search the user's documents.

## NEW BLOCKER — F5: harness phase ToolContext is missing the supabase client (+ folder-scope/spawn/semaphore)

**Live crash (backend log):**
```
task_service.run_task_sub_agent → dispatch_tool('search_documents')
  → tool_dispatcher._handle_search_documents (:158, ctx.supabase)
  → retrieval_service.search_documents → _vector_search (:48)
  → aexec(supabase.rpc("match_document_chunks", params))
AttributeError: 'NoneType' object has no attribute 'rpc'
```

**Root cause (confirmed in code):**
- Every Supabase-RPC/table tool reads `ctx.supabase` (tool_dispatcher: `search_documents`, `hybrid` search, `ls/tree/grep/glob`, `fetch_document`, skills, code-execution logging — 20+ sites).
- `task_service.py:300` builds `sub_ctx = ToolContext(..., supabase=parent_ctx.supabase, ...)` — inherits from the phase ctx.
- `phase_types._build_phase_tool_context` (:142–153) ALREADY propagates `supabase`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore` via `getattr(ctx, …)`.
- BUT the harness engine ctx (`wf_ctx`, threads.py:1158-1167) only sets: `run_id, producer_run_id, thread_id, current_user, user_settings, redis, pool, emit, retry_feedback`. It does **NOT** set `supabase`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore`. So they all resolve to `None`.
- The Deep `RunContext` (threads.py:1183-1190) DOES set `supabase=supabase` (+ folder scope etc.) — which is why Deep RAG works and harness RAG doesn't.

**Why it surfaced only now:** the harness sub-agent tool-dispatch path was never reachable live until F4 fixed the parent_run_id FK. F4 let the sub-agent call a tool for the first time → the missing-ctx-field gap appeared on the very first `search_documents`.

## Fix shape (bounded — the wf_ctx build sites are the single chokepoint)

`_build_phase_tool_context` already forwards these fields; the fix is to SET them on the engine ctx at the 3 build sites:

| Field | Live (threads.py:1158, in agent_runner scope) | Resume (_build_resume_context :599 + resume_stranded_workflows :672 + main.py sweep; runs.py _harness_continuation) |
|---|---|---|
| `supabase` | the request `supabase` (Depends get_supabase) — same value Deep uses at :1190 | a **service-role** supabase client (no request on the startup sweep) |
| `folder_subtree_ids` + `scoped_folder_path` | the folder-scope locals already computed for the Deep ctx (this is what makes the DBA folder filter apply) | best-effort from the run's stored scope, else None (unscoped) |
| `spawn` | the `_spawn` ref Deep uses | the engine's spawn ref / None if N/A |
| `per_run_task_semaphore` | the per-run semaphore Deep uses | a fresh semaphore for the resumed run |

**Test (close the mock blind spot again):** a live-DB/integration assertion that a harness phase ctx carries a non-None `supabase` and a `search_documents` dispatch through the harness sub-agent path resolves (the mock-pool tests never exercised real `supabase.rpc`). Plus a guard/assertion that wf_ctx carries the 5 fields.

**Confidence this is the LAST major domino:** the ToolContext is the single chokepoint — once the harness ctx carries the same fields Deep's RunContext does, the sub-agent has everything Deep has (and Deep works end-to-end). After F5, the document-grounded workflows should run to completion.

## UPDATE 2 (after F5 fix a7be6423) — F4+F5 CONFIRMED WORKING; NEW final gap F6

Re-ran Harness Research→Summarize on the DBA folder. The `harness_audit` trail is COMPLETE and clean (no traceback):
`phase_started(research) → phase_completed(research) → phase_transition → phase_started(summarize) → phase_completed(summarize) → run_completed`.
- **F4 + F5 VERIFIED WORKING:** both phases executed, `search_documents` ran over the DBA docs with NO `None.rpc` crash, the run completed in ~7s, the anchor cleared to NULL (SC#2 natural-completion ✓).
- The product DOES behave as a RAG engine in workflow mode: the workflow searched the user's documents end-to-end.

### NEW BLOCKER — F6: harness workflow output is never surfaced/persisted as the assistant reply

**Symptom:** after a successful run, `GET /threads/{id}/messages` returns ONLY the user message (count=1) — there is NO assistant message. The chat stays empty; a reload shows just the question. The workflow does the work and the answer is dropped. (This is the operator's exact concern: "how is the answer reflected to the user?" — currently it isn't.)

**Root cause (confirmed in code):**
- Design intent D-10 (harness_engine.py:32-34, 555-559): "the FINAL phase's text becomes the assistant message verbatim; the engine sets `ctx.final_output`; the existing message-insert path persists it." `run_workflow` DOES set `ctx.final_output = last_output` (:559).
- BUT the producer-shell finalizer `_shielded_finalize` (threads.py:1342+) persists the assistant message from `_result_sink.get("persist")` (:1359) — and `_result_sink` is populated ONLY by `run_agent_loop` (the Deep path, :1275). In the harness branch `run_agent_loop` never runs (run_workflow runs instead), so `_result_sink` is empty → `_persist` is None → NO assistant message persisted, and nothing emitted as assistant content.
- The "existing message-insert path persists ctx.final_output" hand-off (D-10) was never actually wired: no code reads `wf_ctx.final_output` and routes it into the persist/emit path.

**Fix shape (focused):** after `run_workflow` returns successfully in the harness branch (threads.py ~1168), populate `_result_sink["persist"]` from `wf_ctx.final_output` (the `{"text": ...}` summarize payload) so the existing `_shielded_finalize` persist+emit path writes the assistant message + emits the content on the producer stream — reusing the proven Deep persist path (D-10's intent), keeping rendering identical. Also confirm the content streams/emits so it renders without a reload (Facet B completeness for assistant content, not just phase events).

**This is very likely the LAST domino:** with F4 (runs), F5 (tools/ctx), F6 (output surfaced), the full loop closes — ask → search the user's docs → grounded answer rendered as the assistant reply. The harness path simply was never exercised live before, so each fix peeled one layer (F1→F2→F4→F5→F6); F6 is the surface layer (the user-visible answer). Note: only LIVE UAT caught these — the mock-pool tests + structural-skeleton SSE proof passed through all of them.

## UPDATE 3 (after F6 fix 803aafd3) — CORE DOC-GROUNDED LOOP VERIFIED WORKING ✅

Re-ran Harness Research→Summarize on the DBA folder (thread 8852c3ce, run 370dd816):
- **The assistant reply rendered live** — a 1,503-char grounded summary drawn from the user's actual DBA documents (cites the specific study: mixed-methods RPA-in-BPM, 309 survey participants, 8 expert interviews, the SUCCESS framework, organisational readiness/trust/risk perception). Unmistakably grounded in the user's docs, NOT generic world knowledge.
- **Persisted:** `GET /messages` → 2 rows (user + assistant, 1575 chars). Survives reload.
- **SC#2 natural-completion:** `active_workflow_run_id = NULL`, `locked=false` after completion.
- **F4 + F5 + F6 ALL VERIFIED LIVE.** The full RAG loop closes end-to-end: ask → search the user's DBA docs (search_documents) → grounded summary rendered + persisted as the assistant reply.

### Still OPEN (remaining binding UAT rows)
- **F3 lock-during-active-run:** NOT yet positively observed — the run completes in ~7s, too fast to catch the composer disabled (modeSel showed "Deep"/enabled at t0=1.5s). Needs a longer-running workflow (Plan→Execute→Verify / Literature review) or a sub-second poll to confirm the per-thread lock disables the composer mid-run.
- **Doc Q&A (ask_user / llm_human_input):** the Facet B ask_user-transport hole — verify the prompt RENDERS + the answer round-trips.
- **Deep parity:** a Deep RAG message on the DBA folder unchanged.
- **Out-of-KB transparency:** how a non-document answer is reflected.
- **SC#3 parallel-thread, SC#5 reload-mid-run, CONT-01 cap→Continue, native-7 cross-provider scoreboard.**

## UPDATE 4 (after F7 fix ba5949c4) — grounding now VISIBLE; separate content-quality finding

Re-ran Harness Research→Summarize on the DBA folder (thread a96d177d):
- **F7 VERIFIED:** the assistant answer now renders **"● Medium confidence"** + an expandable **"5 sources"** chip (screenshot 224844 was the bare-text "before"; now sources+confidence show). Persisted: `source_refs: 5`, `confidence_level: "medium"` on the assistant message (Deep's param shape). Grounding is now visible + matches Deep.
- **NEW finding F8 (content quality — NOT 092 wiring):** this run's answer was a clarifying question ("please send me the topic…") DESPITE finding 5 sources — whereas an earlier identical run produced a correct grounded RPA summary. So the dual-mode WIRING is solid (runs, searches, surfaces sources+confidence), but the SEED WORKFLOW prompts/handoff (research→summarize) are inconsistent: the phases don't reliably anchor on the user's kickoff question, sometimes asking for a topic while attaching sources. This is workflow-definition / prompt-tuning (the `061_harness_seed_templates` prompts + the phase accumulated_outputs handoff), separate from the 092 toggle wiring. Candidate follow-up (workflow-prompt-quality phase or seed); NOT a 092-07 wiring defect.

## Disposition

- **F4, resume-current_user, F5, F6, F7: VERIFIED CLOSED live.** Workflows run end-to-end over the user's docs, surface a grounded answer WITH visible sources + confidence.
- **F8 (kickoff_prompt not threaded into the workflow): FIXED + VERIFIED (95da3032).** It was a WIRING gap, not prompt tuning — `create_workflow_run` stored `inputs.kickoff_prompt` (SEED-047) but no phase consumed it. Now threaded into wf_ctx + both resume ctxs + the first phase's user turn (sub-agent task = `Phase: research\n\n<user question>`). Live re-test (thread d900f668): on-topic grounded synthesis ("Main success factors… 1. Digital maturity… strongest predictor…"), 2536 chars, source_refs=5, confidence=medium, anchor NULL. Consistent + correct.
- Rich live workflow panel (run-card / phase timeline / live tool calls / workspace-during-run) = Phase 094 (deferred by design).
- Remaining binding UAT rows (still owed): ask_user render (Doc Q&A), Deep parity, out-of-KB transparency, F3 lock-during-run (needs a long workflow), SC#3 parallel-thread, SC#5 reload-mid-run, CONT-01, native-7 cross-provider scoreboard. The core document-grounded workflow runs end-to-end and surfaces a grounded answer.
- MODE-01/MODE-02/CONT-01 stay OPEN until the remaining binding rows above pass (F3 lock-during-run, ask_user render, cross-provider, parallel/reload/Continue).
- All fixes folded into 092-07 (deviations): commits 27b12c37 (resume current_user), a7be6423 (F5 ctx), 803aafd3 (F6 surface).

## UPDATE 5 (operator UAT 2026-05-31) — cross-provider + ask_user defects → route to a COMPREHENSIVE phase, stop piecemeal fixing

Operator directive: NOTE these for a separate comprehensive phase rather than continue ad-hoc fixing.

- **F9 (cross-provider harness parity):** the Research workflow ("What are the success factors for digital transformation according to the research documents?") worked with **OpenAI ONLY** — failed on the other native providers (random model selected per provider). F4–F8 were verified on OpenAI; the harness phase/sub-agent LLM path is NOT provider-agnostic yet (candidate causes: sub-agent model resolution per provider, structured-vs-native tool path in the phase sub-agent, the MODEL_CAPABILITIES registry trap for zhipu/minimax, provider-specific streaming in the phase executor). This is the SC#10 native-7 row — now with evidence of failure off-OpenAI.
- **F10 (Doc Q&A ask_user / llm_human_input):** the Doc Q&A workflow (OpenAI) jumped STRAIGHT to ask_user with NO draft text, AND did not accept the user's answer. So: (a) the `draft` (llm_agent) phase produced no visible output before the `confirm` (llm_human_input) phase, and (b) the ask_user round-trip is broken (prompt fired but the answer didn't resume the workflow) — the Facet B ask_user-transport hole the adversarial verifier (092-07-RESEARCH) explicitly flagged.

Both are BINDING and currently OPEN. Recommendation: a comprehensive phase (design/discuss → plan → execute) covering cross-provider harness parity (F9) + ask_user round-trip (F10) + the presentation/legibility direction (mode differentiation + 094 panel), rather than more single-domino deviations on 092-07.

## UPDATE 6 (live evidence, 2026-05-31) — Deep is provider-robust; F9 is harness-specific; F9/F10 root causes confirmed

**Live API test, Deep mode, same RAG prompt, one model per native provider (evidence, not guess):**
| Provider/model | answered | sources | confidence |
|---|---|---|---|
| openai/gpt-5.4-mini | ✅ | 5 | high |
| anthropic/claude-sonnet-4-6 | ✅ | 25 | high |
| google/gemini-2.5-flash | ✅ | 5 | high |
| deepseek/deepseek-chat | ✅ | 9 | high |
| moonshot/kimi-k2.6 | ✅ | 14 | high |
| minimax/MiniMax-M2.5 | ✅ | 5 | high |
| zhipu/glm-4.6 | ✅ | 20 | high |

**Finding: Deep mode works + is grounded across ALL 7 native providers.** So the cross-provider failure (F9) is **HARNESS-specific**, not a provider problem — Deep uses the real per-provider service boundary; the harness phase sub-agent does not.

**F9/F10 root causes (from 092-COMPREHENSIVE-PHASE-SCOPE.md):**
- F9: (A) harness `wf_ctx` never carries `_resolved_model` → `_effective_model` falls back to stale `user_settings.llm_model` (OpenAI id) → wrong model off-OpenAI (400/404). (B) harness funnels all phase LLM calls through OpenAI-SDK-only `create_adaptive_streaming_chat` — no native anthropic/google path, no STRUCTURED-mode tool injection for GLM/MiniMax registry-miss → tools narrated as text → search_documents never runs. (+ dead net: resolve_sub_agent_model_safely reads non-existent `user_settings.llm_models`).
- F10: (b) answer rejected = run_id namespace mismatch (submit endpoint queries `runs` table; harness keys on `workflow_runs` id → 404 before persist/publish). (a) no draft = F6 ceiling (only final phase surfaced; human-input blocks before the final delta).

**Cross-cutting theme:** the harness was "Deep's intent without Deep's substrate," verified only on OpenAI / single-turn / no-human-input. Correction = make the harness a first-class provider-agnostic, legible surface that consumes Deep's substrate (shared provider boundary).

Comprehensive bug-landscape audit (wluzklz4e) → `092-COMPREHENSIVE-AUDIT.md` (full provider×mode×phase-type×workflow×UI matrix) was still running at session wrap; consume it next session.
