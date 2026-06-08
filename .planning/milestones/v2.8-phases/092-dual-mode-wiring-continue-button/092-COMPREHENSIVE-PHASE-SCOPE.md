# 092 — Comprehensive Phase Scope: Harness Cross-Provider Parity + ask_user Round-Trip + Legibility

**For:** Product owner (decision: stop piecemeal fixing, route ONE proper phase)
**Date:** 2026-05-31
**Context:** v2.8 Harness Engine & Workflow Mode. Phase 092 closed its verified core (F1–F8 fixed live on OpenAI). Operator UAT (092-07-UAT-FINDINGS UPDATE 5) found two BINDING, OPEN defects — **F9 (cross-provider harness parity)** and **F10 (Doc Q&A ask_user)** — and directed: note these for a comprehensive phase, not more single-domino deviations.
**Source evidence:** 4-area code investigation (this doc's findings), `092-07-UAT-FINDINGS.md` F9/F10, `092-MODE-MODEL-AND-DIRECTION.md`, `092-WORKFLOW-UX-STRATEGY-BRIEF.md`, verified live in code (`runs.py:512-516`, `threads.py`, `task_service.py`, `phase_types.py`, `harness_engine.py`).

---

## 0. The one-sentence diagnosis

Every harness defect (F1→F10) has the **same shape**: the harness path was built by copying the *Deep* path's intent but never wiring its substrate, then verified only on OpenAI — so each layer that Deep gets for free (ctx fields, output surfacing, kickoff threading, **provider routing**, **the answer-channel namespace**, **intermediate-output legibility**) had to be discovered one live run at a time. F9 and F10 are the last two layers, and they are the two hardest because they are not "set a missing field" — they require the harness to consume Deep's *provider boundary* and Deep's *surfacing vocabulary*, not just its ctx.

This phase's job: **make the harness a first-class, provider-agnostic, legible surface** — not "fix two bugs."

---

## 1. F9 — Harness cross-provider parity

**Symptom (operator):** the Research workflow worked on **OpenAI only**; on the other native providers a "random model" was selected per provider and the run failed. F4–F8 were all verified on OpenAI alone.

There are **two independent root causes** that BOTH must be fixed, plus one dead safety net. They compound: even fixing one leaves the workflow broken off-OpenAI.

### 1a. Root cause A — the model NAME is stale cross-provider (wrong model id sent to the right endpoint)

The live harness ctx (`wf_ctx`, a `SimpleNamespace` at `threads.py:1214-1255`) **never carries the request-resolved model.** Deep threads `resolved_model=_resolved_model` into its `RunContext` (`threads.py:1426`); the harness branch omits any `model` field entirely and never references `_resolved_model` (which exists in scope — `threads.py:903`).

So `_effective_model(phase, ctx)` (`phase_types.py:131-133`) resolves to `""` (phase `config.model` defaults to `None`; ctx has no `model` attr), and the chain falls through to `user_settings.llm_model`. But `override_provider` (`user_settings.py:514-524`) updates `active_provider / llm_api_key / llm_base_url / available_models` and **deliberately NOT `llm_model`**. Result: when the user picks a non-OpenAI provider, the **endpoint + key route correctly** while the **model name is still the stale prior-provider id** (commonly the `gpt-4o` default, `config.py:635`). A non-OpenAI endpoint gets an OpenAI model id → 400/404. OpenAI "works" only because the stale id is coincidentally a valid OpenAI id. "Random model each" = whatever stale id sat in `app_settings.llm_model` / the env default at that moment.

Affects **both** `llm_single` (the summarize phase — `phase_types.py:228-236`) and `llm_agent` (the research phase via `run_task_sub_agent` — `task_service.py:251-255`, `fallback_model=parent_ctx.model or None` collapses to `None` → stale `llm_model`). A Research workflow therefore fails at the FIRST LLM-touching phase off-OpenAI.

**Dead safety net (compounding):** `resolve_sub_agent_model_safely` (`sub_agent_models.py:70-74`) validates the candidate against `user_settings.llm_models` — **a field that does not exist** (the real field is `available_models`, `user_settings.py:100`). `getattr(...,'llm_models',None)` is always `None` → the validation/provider-default-fallback guard never fires. The D-085-05/BUG-260528-01 "hardened" net is unreachable. The original it copies (`sub_agent_service.py:62-64`) has the **same wrong field name**, so the `analyze_document` sub-agent shares this latent bug. `_SUB_AGENT_MODEL_DEFAULTS` (correct per-provider fallbacks, `config.py:594-604`) is consequently never consulted on the runtime path.

### 1b. Root cause B — the harness has NO native-provider tool path (Anthropic/Google can't tool-call at all)

Even with the correct model name, the harness funnels **every** LLM call through `openai_service.create_adaptive_streaming_chat`, which always builds a single `OpenAI()` client (`get_llm_client`) and calls `client.chat.completions.create()`. It **never branches** to the native `stream_anthropic` / `stream_google` SDK paths that Deep uses (`agent_loop.py:1396` anthropic, `~1530` google, else=OpenAI-compat). `task_service.py` imports **only** `create_adaptive_streaming_chat + get_tools` — grep confirms ZERO references to `anthropic_service / google_service / stream_anthropic / stream_google` anywhere under `services/harness/`.

Consequences by provider class:

| Provider class | What happens in the harness today |
|---|---|
| **OpenAI** | Works (native tools via OpenAI SDK; model id valid). The only tested path. |
| **Anthropic, Google** | No native adapter at all. `tool_use`/function-calling request shape, system-prompt handling, `thought_signature` round-trip (Gemini-3 multi-iteration, `agent_loop.py:1625-1647`), Claude content-block accumulation — none exist. `search_documents` is never produced as a real tool call. |
| **OpenAI-compat natives (deepseek, moonshot, GLM/zhipu, minimax) + openrouter/ollama** | The **MODEL_CAPABILITIES registry trap.** A registry MISS (or case/ID mismatch) → `native_tools=False` → `CallingMode.STRUCTURED`. In STRUCTURED, `create_adaptive_streaming_chat` (`1279-1282`) passes NO tools and relies on the CALLER to inject tool schemas into the system prompt. Deep does this (`agent_loop.py:1373-1384 / 1669-1678` TOOL_USAGE_INSTRUCTIONS + a structured parser). **The harness does NEITHER** — `_consume_sync_stream` only parses native `delta.tool_calls`; there is no structured/XML parser and no prompt injection. The model narrates the tool call as text, `tool_calls=[]`, the loop treats the narration as the FINAL answer (`task_service.py:386-389`), and `search_documents` silently never runs. (This is the documented 2026-05-30 zhipu/minimax registry trap.) |

**Downstream:** the F7 "show sources" / confidence union (`task_service.py:492-505`) is correctly wired but **starves** when the tool-call path fails off-OpenAI — `source_refs` stays `[]`. Not a separate bug; it starts working once the provider boundary is fixed (re-confirm in UAT).

### What an F9 fix MUST cover

1. **Thread the resolved model onto ALL THREE harness ctx build sites** (additive — does not touch `producer_run_id`/`stream_run_id`/`inputs`/`supabase` substrate from F4/F5/F8):
   - Live: set `wf_ctx.model = _resolved_model` (`threads.py:1214-1255`, mirror Deep's `1426`).
   - Resume (`harness_engine._build_resume_context`): currently mints a shell with `model='unknown'`. Read `workflow_runs.model` (SEED-047 persisted it, `threads.py:996`; `find_resumable_runs` must SELECT `wr.model`, F8 precedent) and set `ctx.model`.
   - `POST /continue` resume builder (`threads.py ~1894-1903`): `resolved_model` already in scope — verify it threads onto the harness ctx too.
   - **Preserve precedence:** a phase `config.model` must still win over `ctx.model` (`phase.config.model or ctx.model`).
2. **Give the harness Deep's provider boundary.** Route `active_provider == anthropic → stream_anthropic`, `google → stream_google`, else → `create_adaptive_streaming_chat` (OpenAI-compat only). Per CLAUDE.md, provider-specific handling belongs at the service boundary. **Strongly preferred: EXTRACT the `agent_loop.py` per-provider dispatch + chunk-normalization into a shared adapter both Deep and the harness consume** (one UX, four adapters) — avoid a third copy of the 4-provider branch. (This is the G-1/G-5 "shared substrate" move; `agent_loop.py` is already the de-facto shared substrate — consider the extraction a refactor pre-step.)
3. **Handle STRUCTURED mode in the harness.** Either (a) consume the normalized event stream the native adapters already emit, or (b) add the TOOL_USAGE_INSTRUCTIONS system-prompt injection + a structured-mode tool-call parser (mirror Deep). Plus: verify the v2.8 GLM/zhipu + minimax model IDs are registered with `native_tools=True` so they take the NATIVE path.
4. **Fix the dead safety net (defense-in-depth):** `resolve_sub_agent_model_safely` + `sub_agent_service.py` → read `user_settings.available_models` (not `llm_models`) so `_SUB_AGENT_MODEL_DEFAULTS` actually fires. Also fixes `analyze_document`.
5. **Decide:** should `override_provider` also reset `llm_model` to the new provider's default/first-available? This is the *upstream* source of the stale name across BOTH harness and any `llm_model` fallback path. (Recommend: yes, with operator sign-off — but ctx.model fix is the load-bearing one regardless.)
6. **Preserve native per-iteration machinery in the harness loop:** a multi-step `llm_agent` phase that tool-calls twice on Google will 400 without `thought_signature` preservation. The harness loop has no equivalent today.

**Hard constraints:** do NOT modify byte-frozen `sub_agent_service.py` (D-085-16). Keep Deep's `task()` path byte-identical (SC#2 / Phase 089). `run_task_sub_agent`'s `tools_override`/`system_prompt_override` are additive — any provider branch must preserve OpenAI behavior exactly for the Deep caller.

---

## 2. F10 — Doc Q&A ask_user (two distinct sub-defects)

**Symptom (operator, OpenAI):** the Doc Q&A workflow jumped STRAIGHT to ask_user with **NO draft text**, AND did **not accept the user's answer** (the workflow never resumed). These are two unrelated root causes that happen to co-occur.

### 2a. Sub-defect (b) — answer not accepted: the ask_user run_id namespace mismatch

This is the fatal one. The harness durable prompt row stores `run_id = ctx.run_id = the workflow_run id` (`workflow_runs.id`). The frontend submits the answer to `/runs/{workflow_run_id}/ask_user_response`. But that endpoint's ownership gate (`runs.py:512-516`, **verified live this session**) does:

```
supabase.table("runs").select("run_id, thread_id, status").eq("run_id", str(run_id)).eq("user_id", ...).maybe_single()
```

`runs` (PK `run_id`, migration 035) and `workflow_runs` (PK `id`, migration 057) are **disjoint UUID namespaces.** Every `runs` row on the harness path is minted with a PRODUCER id (`threads.py:944`, `harness_engine.py:755`) — the workflow_run id is NEVER inserted into `runs`. So the SELECT finds no row → **404 "Run not found" BEFORE persist (step 2) and publish (step 4)**. The answer is never persisted, never published; the live subscriber (`subscribe_for_response` on `ask_user:{workflow_run_id}:{tcid}`) never wakes; the workflow never resumes.

**Note:** the channel keys themselves WOULD match (frontend submits the workflow_run id; subscribe is keyed on the workflow_run id). The fatal break is purely the runs-vs-workflow_runs **table lookup** in the ownership gate — which is a hole that F4/F8 did not touch (they fixed run-id *routing*, not the answer-submission ownership table).

**Four sites must agree on whichever namespace is chosen** (changing one re-breaks resume):
- durable prompt-row stored `run_id` (`phase_types.py:434`)
- `subscribe_for_response` channel (`phase_types.py:469`)
- `get_pending_ask_user` / `ask_user_response_exists` matchers (`db/workflows.py:264,300` — filter `tool_calls->0->>'run_id' = workflow_run_id`, JOIN `workflow_runs wr ON wr.id = $1`)
- `panel.py /ask_user/pending` returned `run_id` (`panel.py:150`)

**Two fix options (pick ONE, operator/architect decision):**
- **(i) Endpoint detects a workflow_run id and does its ownership SELECT against `workflow_runs`** (FK chain `workflow_runs.thread_id → threads.user_id`). Keeps all four sites + channels on the workflow_run id (no change to matchers/channels). **Must not break the Deep runs-keyed case** (`tool_dispatcher.py:1349` uses `ask_user:{run_id}:{tcid}` where `run_id` IS a real `runs.run_id`) — branch carefully.
- **(ii) Harness stores the PRODUCER run_id** (a real `runs.run_id`) in the durable prompt row + subscribe channel + matchers so the existing runs-keyed endpoint resolves. **Requires rewriting** the `get_pending_ask_user`/`ask_user_response_exists`/WR-05/WR-06 matchers and switching the live subscribe to the producer id.

*Recommendation:* **Option (i)** is lower-blast-radius (the four harness sites stay correct; only the submit endpoint learns the second namespace), and it keeps the Deep path untouched. Validate against both live (subscribe alive) and resume (worker-restart → `resume_pending_prompt` re-subscribe) paths.

### 2b. Sub-defect (a) — no draft shown: intermediate-phase output is invisible (the F6 ceiling)

The Doc Q&A definition (`061_harness_seed_templates.sql:192-230`) is: `draft` (index 0, `llm_agent`, search_documents) → `confirm` (index 1, `llm_human_input`) → `finalize` (index 2, `llm_single`). The user is asked "Does this draft answer your question?" but **the draft is never shown.** Three layers cause this:

1. **The engine surfaces ONLY the final phase.** `harness_engine.py:661-665` sets `ctx.final_output = last_output` (last phase only). The F6 surfacing block (`threads.py:1297-1318`) emits exactly ONE `delta` of `final_output['text']`, and only AFTER `run_workflow` returns. Non-final phases (draft, plan, research, split, review) emit only `phase_started/phase_completed/phase_transition` — contentless metadata. **There is no SSE vocabulary for "a non-final phase finished with this text."**
2. **The `confirm` phase BLOCKS before the final delta can ever fire.** `_exec_llm_human_input` awaits `subscribe_for_response` (`phase_types.py:469`) inside the single linear `run_workflow` loop. The F6 delta (`threads.py:1308`) is downstream of `await run_workflow(...)` — structurally **impossible** to render pre-pause context with the current single-post-return delta.
3. **Sub-agent text is return-only, never streamed.** `_stream_one_iteration` consumes the stream in a worker thread and RETURNS `(content, tool_calls)` — emits no `delta`. The draft text exists (captured as `result['summary']`, persisted to `workflow_phases.output`) but is never surfaced. The sub-agent's own events route on a separate `sub_run_id` stream the chat content path doesn't render.
4. **The prompt carries no draft context.** `_exec_llm_human_input` emits `ask_user_prompt` with only `{prompt, options, timeout_seconds, tool_call_id}` (`phase_types.py:457-463`); `prompt = phase.config.prompt` (the static seed string). `accumulated_outputs` (holding `draft['text']`) is passed in but never read. Frontend `api.ts:600-608` + `PendingAsk` type have no draft field to render.

**What a (a) fix MUST cover (additive — do NOT touch `_stream_one_iteration`'s return contract or the byte-frozen provider streaming path):**
- Introduce an **intermediate-output surfacing path** at the harness/engine boundary that emits DURING the loop (per-phase), not after `run_workflow` returns — reuse the F6 `_harness_emit('delta', ...)` mechanism but per-phase and pre-pause. New SSE event type and/or per-phase delta + a frontend handler to render it.
- For ask_user specifically: either (1) emit the prior phase's draft as visible content BEFORE the blocking emit, OR (2) bundle the prior phase's draft text into the `ask_user_prompt` payload + durable prompt-row + frontend `PendingAsk` shape so the question carries the draft inline. **Operator decides the surface:** chat assistant bubble vs the amber PendingAskCard body.
- Define a **per-phase "surface to user" policy** in the definition — not every phase should be shown (a programmatic `split_topic` phase is plumbing; a `draft`/`research` phase is user-facing content). Blanket-emitting every phase output is wrong.

---

## 3. Cross-cutting theme — why F1–F10 are one story

| Layer Deep gets for free | Harness gap | Found by |
|---|---|---|
| ctx fields (supabase, folder scope, spawn, semaphore) | F5 — wf_ctx didn't set them | live UAT |
| answer persisted as assistant reply | F6 — `_result_sink` only populated by Deep loop | live UAT |
| kickoff question threaded into the turn | F8 — stored but no phase consumed it | live UAT |
| grounding union (sources + confidence) | F7 — wired but starved | live UAT |
| **resolved model on the ctx** | **F9a — wf_ctx has no `model`** | cross-provider UAT |
| **per-provider tool/streaming boundary** | **F9b — OpenAI-SDK-only path; no native adapters; no STRUCTURED handling** | cross-provider UAT |
| **answer-channel ownership table** | **F10b — endpoint reads `runs`, harness keys `workflow_runs`** | ask_user UAT |
| **intermediate / pre-pause output surfacing** | **F10a — only final phase emitted; blocks before that** | ask_user UAT |

**The pattern:** the harness was implemented as Deep's *intent* (D-10 "final phase becomes the assistant message"; "sub-agents inherit the parent's provider") without Deep's *substrate* (the ctx, the persist sink, the provider dispatch, the answer namespace, the surfacing vocabulary) — and was verified **only on OpenAI, single-turn, no human-input**. Every domino (F1→F10) is "Deep had X; the harness needed X too, but nobody noticed until a live run on the un-tested axis hit it." **Mock-pool tests + structural-skeleton SSE proof passed through ALL of them** — only LIVE UAT on the un-tested axis (provider, human-input) caught each.

**The comprehensive correction (not "fix two bugs"):** treat the harness as a **first-class, provider-agnostic, legible surface that consumes Deep's substrate**, rather than a parallel re-implementation. Concretely that means: (1) one shared provider adapter both Deep and harness consume (kills the F9b class permanently); (2) one shared answer-channel namespace contract (kills the F10b class); (3) a first-class intermediate-output surfacing vocabulary (kills the F10a/legibility class and unblocks Phase 094); (4) **cross-provider × human-input UAT made MANDATORY at scope-time**, not post-hoc — the structural absence of these axes is precisely why F9/F10 escaped 092-07.

This also satisfies the standing guardrails: `agent_loop.py`'s provider dispatch is the shared substrate (G-1/G-5 say extract before a third copy), and the legibility work is visual (G-2 sketch-before-plan fires).

---

## 4. Recommended phase shape

**Verdict: a comprehensive phase, discuss/sketch → plan → execute, with the native-7 × human-input 4-axis UAT as the non-negotiable gate.** This is NOT a `/gsd:fast` or `/gsd:quick` candidate (multi-file, schema-adjacent, provider routing + agent loop + UI — every "MANDATORY UAT scoreboard" trigger fires). Three workstreams, sequenced so the refactor lands before the feature code:

### Pre-step (G-1/G-5 refactor): shared provider adapter
EXTRACT `agent_loop.py`'s per-provider dispatch + chunk-normalization into an adapter both Deep and the harness consume. Deep stays byte-identical (Phase 089 invariant); the harness gains the native boundary by *consuming* the adapter, not copying it. **Do this FIRST** — adding harness-specific provider code without it creates the third copy the hot-file ledger forbids.

### Workstream (a) — Cross-provider harness parity (F9)
Thread resolved model onto all 3 ctx build sites (precedence preserved); harness consumes the shared adapter for native Anthropic/Google; STRUCTURED-mode handling + GLM/minimax registry verification for OpenAI-compat natives; fix the dead `available_models` safety net; decide `override_provider` llm_model reset. Backend-heavy.

### Workstream (b) — ask_user round-trip + intermediate-output surfacing (F10)
Reconcile the ask_user run_id namespace end-to-end (Option (i) recommended, all 4 sites + channel symmetry + Deep regression guard); introduce per-phase pre-pause intermediate-output surfacing (new SSE event + frontend handler); bundle/show the draft before the ask; define the per-phase "surface to user" policy. Backend + frontend; **G-2 sketch fires** for the intermediate-output + ask_user presentation.

### Workstream (c) — Presentation/legibility direction (link, don't duplicate)
The legibility *frame* (mode label, step timeline, governed-run badge, Continue) is **Phase 094's** mandate per `092-MODE-MODEL-AND-DIRECTION.md §4` and D-092-UX (composer simplification A+C). The intermediate-output *surfacing substrate* this phase builds (workstream b) is exactly what Phase 094 will draw on — so this phase ships the *plumbing* (per-phase events + draft surfacing), and 094 ships the *chrome* (the panel timeline). **Coordinate, don't conflate:** this phase must emit the per-phase vocabulary in a shape 094 can render; 094 owns the visual frame and starts with a sketch. Do NOT build the workflow BUILDER (v2.9) or a "deeper Deep" here.

### The gate (MANDATORY — this is the F9/F10 acceptance bar that 092-07 lacked)
Per CLAUDE.md UAT scoreboard + 4-axis bandwidth + `feedback_uat_lived_experience_gap` + `feedback_uat_cover_all_design_contracts`:
- **Cross-provider (native-7):** seed a real Research→Summarize (search_documents) AND a Doc Q&A (ask_user) run on EACH of OpenAI, Anthropic, Google, deepseek, moonshot, GLM/zhipu, minimax. Verify the `runs` + sub-agent `runs` rows record the CORRECT per-provider model, tools ACTUALLY dispatch (not narrated as text), and both `llm_agent` and `llm_single` phases complete. Wire-format/structural check is INSUFFICIENT.
- **ask_user round-trip (live + resume):** submit returns 200 (not 404); the run resumes to finalize; the card flips green via `ask_user_response` SSE; cover both subscribe-alive and worker-restart→re-subscribe. Verify the draft renders BEFORE the question.
- **Deep parity regression:** a Deep RAG message on the DBA folder unchanged; the Deep ask_user path still works post-endpoint-change.
- **The remaining 092 binding rows owed:** F3 lock-during-long-run, SC#3 parallel-thread, SC#5 reload-mid-run, CONT-01 cap→Continue.

### Sequencing recommendation
```
/gsd:sketch   (G-2: intermediate-output + ask_user presentation; baseline = sketch-findings-agentic-rag)
   ↓
/gsd:discuss-phase  (lock: provider-adapter extraction scope, ask_user namespace option (i)/(ii),
                     override_provider llm_model reset decision, per-phase surface policy)
   ↓
/gsd:plan-phase     (Pre-step refactor → WS(a) → WS(b); native-7 × human-input UAT authored in VALIDATION.md, not PLAN tasks)
   ↓
/gsd:execute-phase  (run SEQUENTIALLY — no worktrees, per reference_gsd_sdk_verb_gaps stale-base bug)
   ↓
gate: native-7 cross-provider scoreboard LIVE + ask_user round-trip live+resume + Deep parity
```

### Open decisions for the operator (resolve at discuss-phase)
1. **Provider adapter:** approve the `agent_loop.py` extraction as a refactor pre-step (G-1/G-5), or accept a harness-local provider branch (creates the 3rd copy — not recommended)?
2. **ask_user namespace:** Option (i) endpoint-detects-workflow_run (recommended, low blast radius) or (ii) harness-stores-producer-id (rewrites matchers)?
3. **override_provider:** reset `llm_model` to the new provider's default on switch (fixes the upstream stale-name source app-wide)?
4. **Draft surface:** show the Doc Q&A draft in the chat assistant bubble, or inline in the amber PendingAskCard body?
5. **094 seam:** confirm this phase ships the per-phase surfacing *substrate* and 094 ships the *chrome* — agree the event shape contract now so 094 doesn't redo it.

---

## 5. Hard constraints (carry into PLAN.md)

- Byte-frozen `sub_agent_service.py` (D-085-16) — do not modify; fix its `llm_models`→`available_models` typo only if the same fix lands without changing the byte-frozen call contract (confirm at plan time; otherwise scope as a separate guarded change).
- Deep `task()` path byte-identical (SC#2 / Phase 089). `run_task_sub_agent` additions stay additive.
- No shared-path breakage (`feedback_no_cross_provider_regressions`): provider fixes go at the service boundary; never modify the threads.py chunk handler / SSE emitter in ways that break working providers.
- The F9 ctx.model add is additive to the SimpleNamespace — does not touch `producer_run_id` (Facet A), `stream_run_id` (Facet B), `inputs`/`kickoff_prompt` (F8), or the supabase/folder-scope substrate (F5).
- All 6+ native providers are first-class from day 1 (`feedback_cross_provider_always_top_of_mind`); OpenRouter experimental (fix only if native-safe + low-complexity).
