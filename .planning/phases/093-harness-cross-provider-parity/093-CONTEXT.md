# Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening - Context

**Gathered:** 2026-06-01
**Refreshed:** 2026-06-02 — post-092.5 execution facts folded in (tagged **[092.5]**); no decision changed
**Status:** Ready for planning (Phase 092.5 — Provider Gateway Extraction — ✅ SHIPPED 2026-06-01 `passed_with_overrides`; gateway live at `backend/app/services/provider_gateway/`)

> **RESCOPED at discuss-phase (2026-06-01).** The roadmap originally titled this phase
> "Anthropic Cross-Provider Parity" (requirement PARITY-01 — a Deep-mode polish for 3 reported
> Anthropic/tool-card bugs). Operator-confirmed rescope: PARITY-01 is **re-deferred** (Deep is already
> provider-robust on all 7; the 3 bugs are low-priority and not reproducing for the operator now),
> and Phase 093 becomes the **milestone-blocking harness work** — making the Harness/workflow path
> work on all native-7 providers and finishing the never-run phase-types. Evidence: the 092
> comprehensive audit + a live-code verification sweep (2026-06-01) that confirmed the audit holds.

> **REFRESHED 2026-06-02 (post-092.5 execution).** Phase 092.5 (Provider Gateway Extraction) **CLOSED
> `passed_with_overrides` 2026-06-01** — the gateway shipped exactly as **D-02** assumed and is Deep
> byte-identical (Anthropic 0-edit; the other 6 native providers' residuals are LLM tool-path / chunk-cadence
> noise with no regression signature). This CONTEXT was written *before* 092.5 ran, so it could not name the
> concrete deliverable. Facts folded in below are tagged **[092.5]**: the **gateway contract** + the 🔴
> **sync-generator trap** (`<code_context>` → *Gateway contract*), the exact **F9 bug-site**
> (`task_service.py:177` discards `calling_mode`), **SEED-048** (embeddings SPOF — a UAT false-alarm risk),
> **SEED-049** (Playwright rot), and the **D-13 proof method** + 2 carry-forward live re-checks.
> **No decision (D-01…D-14) changed** — these sharpen the first implementation task and de-risk the UAT gate.

<domain>
## Phase Boundary

**Make the Harness (workflow) path a first-class, provider-agnostic, robust backend surface — by
consuming the shared provider gateway (built in Phase 092.5), not by re-implementing Deep's machinery.**

Today, verified against live code: **1 of 4 seed workflows runs end-to-end, on 1 of 7 providers (OpenAI).**
This phase closes that gap so all 5 phase-types and all 4 seed workflows run on the native-7
(OpenAI, Anthropic, Google, DeepSeek, Moonshot, GLM/zhipu, MiniMax).

**In scope (backend + the minimal plumbing to make output reach the client):**
1. Harness consumes the shared provider gateway → native Anthropic/Google + STRUCTURED-mode tool
   recovery for the OpenAI-compat natives (DeepSeek/Moonshot/GLM/MiniMax).
2. One shared model-resolver → kills the stale-model class (resolve from the provider, never mutate saved settings).
3. ask_user round-trip fixed (workflow_run-id namespace reconciled) — the answer is accepted and the run resumes.
4. The 3 never-run phase-types completed: `programmatic` (split_topic), `llm_batch_agents` (fan-out),
   `llm_human_input` (ask_user) — and the 5 phase-types hardened into **safe-by-construction validated primitives**.
5. Seed-workflow data fixes (split_topic key + verify-gate route-forward).
6. Resume/Continue **answer surfacing** + the ask_user **draft** carried so it reaches the client
   (using the EXISTING `delta`/`sources`/`confidence` event vocabulary — the *plumbing*, not the chrome).

**Out of scope (boundary — see `<deferred>`):**
- The provider-gateway extraction itself → **Phase 092.5** (ships first; 093 consumes it).
- The visible workflow legibility frame (phase timeline, run-card, mode clarity) → **Phase 094** (sketch-first, G-2). 093 ships the *substrate/events*; 094 ships the *chrome*.
- PARITY-01 (Deep-mode Anthropic summary tail + iteration bloat + non-Anthropic tool-card labels) → **re-deferred**.
- Workflow builder / authoring UI → v2.9. New phase-types → none added. Deep behavior changes → none (red line).
- Broader admin/settings-controllability-at-scale → SEED-024 / SEED-012 (forward-looking).

</domain>

<decisions>
## Implementation Decisions

### Provider parity approach (the architecture)
- **D-01:** Phase **rescoped** — PARITY-01 (Deep-mode Anthropic polish) re-deferred; 093 = harness cross-provider + phase-type hardening. Operator-confirmed 2026-06-01.
- **D-02:** Harness reaches parity by **consuming the shared provider gateway** (Phase 092.5), NOT by adding a harness-local provider branch. Operator's reasoning (verbatim intent): *most reliable + scalable + maintainable + easiest to find bugs = one home for all provider logic, separated per concern.* The gateway is the single source of truth; Deep + harness + future features all consume it. This avoids the "third copy" of the 4-provider dispatch (a 2nd OpenAI-shaped accumulator already exists — `task_service._consume_sync_stream` mirrors `agent_loop._on_chunk_openai`) and the 075.x drift risk.
- **D-03:** The gateway must cover **BOTH** halves of the off-OpenAI gap: (a) the native Anthropic/Google SDK boundary AND (b) STRUCTURED-mode tool-call recovery (`TOOL_USAGE_INSTRUCTIONS` injection + `parse_structured_tool_calls`) for the OpenAI-compat natives. Fixing only the native boundary leaves DeepSeek/Moonshot/GLM/MiniMax still narrating tools as text (search_documents never fires).

### Model resolution (the stale-id root cause)
- **D-04:** Fix the stale-model class at the **root, via ONE shared model-resolver** — resolve the effective model from the active provider's `available_models` when building the workflow ctx; thread it onto `wf_ctx.model` at all 3 build sites (live kickoff, resume `_build_resume_context`, `POST /continue`). Precedence preserved: `phase.config.model or ctx.model`.
- **D-05:** **Resolve, never mutate.** Do NOT change `override_provider` to reset the saved `llm_model` globally (that would surprise an admin who pinned a model). The resolver is the safe, scale-correct fix.
- **D-06:** Fix the **dead safety net** — `resolve_sub_agent_model_safely` (`sub_agent_models.py:70`) reads a non-existent field `user_settings.llm_models`; the real field is `available_models`. Once it reads the right field, `_SUB_AGENT_MODEL_DEFAULTS` actually fires. Confirm per-provider defaults are current before enabling. **`sub_agent_service.py` is byte-frozen (D-085-16)** — fix via the replicating helper (`sub_agent_models.py`) or re-litigate the freeze with the operator at plan time; do not silently edit the frozen file.

### ask_user round-trip
- **D-07:** Fix = **Option (i): the answer endpoint detects a workflow_run id.** `POST /runs/{id}/ask_user_response` falls back to a `workflow_runs` ownership resolve (owner-scoped, anchor-confirmed) — **exactly the pattern the Continue endpoint already uses (`runs.py:645-670`)** — then publishes/emits under the workflow_run id so it matches the harness subscribe channel. Keeps Deep unchanged and the 4 harness sites unchanged. Rejected Option (ii) (harness stores producer id) — the producer id is re-minted per resume/Continue, so it is NOT stable across restarts → would re-break resume.
- **D-08:** **Branch, never replace** — when the id IS a real `runs.run_id` (Deep), the existing runs-table SELECT must still succeed. The Deep ask_user round-trip is a protected working path.

### Phase-type completion + safe-by-construction
- **D-09:** Fix **both** seed bugs: (a) `split_topic` reads the literal `'topic'` key but runs only carry `kickoff_prompt` → it's a **code fix** (in `programmatic.split_topic` or `_exec_programmatic` aliasing) **paired with** a seed `input_keys` edit — editing the seed alone is insufficient (verified). This revives Literature Review + the `llm_batch_agents` fan-out (same root cause). (b) Relax the **verify-gate**: change `on_failure` from `retry` (which exhausts to `fail_run`) to route-forward (`skip_to_phase`) or relax the literal `VERIFIED` regex, so a model that doesn't echo the token doesn't dead-end the whole run.
- **D-10:** **Safe-by-construction** (the operator's "how do we guarantee user-built workflows won't need code fixes?"): the 5 phase-types must be robust, contract-validated building blocks, and the **publish-time reachability lint (shipped in 091) must be extended to catch the input/output-contract breaks** (e.g., a phase whose `input_keys` are never produced by an upstream phase or the run inputs) so a broken workflow fails *validation*, not at runtime in code. This is what makes the v2.9 builder safe to compose. (Scope guard: harden the 5 existing primitives + extend the lint — do NOT build a full contract-validation framework or the builder here.)

### Output surfacing (plumbing now, chrome in 094)
- **D-11:** Wire the F6/F7 answer surfacing (delta + persist + sources/citations/confidence) into the **resume and Continue** re-entry paths — currently only the live-kickoff branch surfaces, so resumed/Continue'd workflows lose their answer. Cleanest shape: refactor the surfacing into **one shared helper `run_workflow` calls on its success terminal** so live + resume + Continue all surface identically.
- **D-12:** Carry the prior phase's **draft** into the `ask_user_prompt` payload + durable row + frontend `PendingAsk` shape, so the Doc Q&A question shows what's being confirmed (using existing events). 093 ships this *plumbing*; the visible phase-timeline/run-card *frame* is Phase 094 (sketch-first). **Agree the per-phase event-shape contract now** so 094 renders it without redoing it.

### The acceptance gate (the thing 092-07 lacked)
- **D-13:** **MANDATORY UAT gate = native-7 × all-5-phase-types × all-4-seed-workflows, live**, plus the 4-axis bandwidth (cross-provider × multi-tool × parallel-thread × long-message), plus resume + Continue + reload rows, plus a Deep-parity regression row. **Seed the runs — no "if data permits" deferrals.** Wire-format/structural checks are INSUFFICIENT (that is exactly what let F1→F8 each pass tests and fail live). Add **live-DB / real-provider tests** to close the mock blind spot (audit row 31). Authored in VALIDATION.md, not PLAN tasks.
  - **[092.5] proof method + carry-forwards (inherit these):** byte-identical vs live LLMs is impossible via raw diff (search-heavy prompts → variable tool-call counts), so use the method 092.5 proved — structural-skeleton diff (`scripts/_diag_skeleton_diff.py`) + run1-vs-run2 noise isolation + **Anthropic-as-twin** cross-check (a shared-consumer regression would hit Anthropic, whose stream proved 0-edit) + adversarial regression-signature checking (per `SSE_DIFF_RUNBOOK`). 093's harness surface is MORE non-deterministic (multi-sub-agent), so this matters more, not less. **Eval non-regression floor = native-7 16/28** — `multi-tool`/`task`/`ask_user` cells are KNOWN-FLAKY and flip run-to-run with no code change (moonshot multi-tool can time out; OpenRouter best-effort/credit-sensitive); do NOT over-read cell flips as regressions. **2 live re-checks carried from 092.5** (its suspicious-but-byte-identical deltas): (1) the assistant-message `tool_call_id` is non-empty + round-trips on a LIVE multi-tool turn per compat provider (esp. OpenRouter-proxied, where name-before-id can't be ruled out); (2) token totals non-zero + equal across a multi-iteration run. Both need a clean run (Supabase `messages.tool_calls` + `runs` token cols) — not skeleton-verifiable.

### 🔴 RED LINE (operator-stated, governs everything)
- **D-14:** **Investigate first; never break working things.** Deep is live-proven on all 7 — it stays byte-identical. Every fix is at the service boundary or purely additive. Protect-surface enumerated in `<code_context>`. No edits to: `agent_loop.py`'s 3 provider branches + their round-trip invariants, the byte-frozen `sub_agent_service.py`, the shared `_emit` SSE shape, `task_service`'s `None`-default for Deep callers, the MODE-01 Deep `else` branch, the frontend `api.ts` existing dispatch. F1–F8 are present and correct — do not re-litigate.

### Claude's Discretion
- Exact gateway consumption mechanism inside `task_service` (the planner/researcher picks how the harness sub-agent loop calls the gateway), provided D-02/D-03/D-14 hold.
- The shared model-resolver's exact signature/location, provided D-04/D-05 hold.
- The shared answer-surfacing helper's exact shape (D-11).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + diagnosis (read first)
- `.planning/phases/092-dual-mode-wiring-continue-button/092-COMPREHENSIVE-AUDIT.md` — the 34-defect → 4-root-cause landscape; the 2-phase recommendation (Phase A backend = this phase; Phase B UI = 094). **Primary scope source.**
- `.planning/phases/092-dual-mode-wiring-continue-button/092-COMPREHENSIVE-PHASE-SCOPE.md` — F9/F10 deep diagnosis + the "what an F9/F10 fix MUST cover" checklists + hard constraints.
- `.planning/phases/092-dual-mode-wiring-continue-button/092-MODE-MODEL-AND-DIRECTION.md` — the two-axis model (General/Explorer ⟂ Deep/Harness), business framing, and the legibility-is-094's-job split.
- `.planning/phases/092-dual-mode-wiring-continue-button/092-07-UAT-FINDINGS.md` — the live operator UAT (F9 OpenAI-only, F10 ask_user) that triggered the rescope.

### Live-code verification (2026-06-01) — current line numbers, confirm/refute verdicts
- The discuss-phase verification workflow (5 read-only agents) confirmed all F9/F10 claims + mapped the protect surface. Key current locations: `threads.py:1214-1255` (wf_ctx, no model) vs `:1418-1428` (Deep RunContext); `models/user_settings.py:514-524` (override_provider, no llm_model); `task_service.py:40-44/121-159/177/379` (OpenAI-only funnel); `sub_agent_models.py:70-74,96` (dead safety net); `runs.py:496-524` (ask_user ownership SELECT against `runs`) + `:645-670` (the Continue endpoint's workflow_run fallback to mirror); `harness/phase_types.py:401,434,457-470` (ask_user keying + prompt payload); `db/workflows.py:255-315` (resume matchers); `panel.py:103,150`; `harness_engine.py:663-665` (final_output last-phase-only) + `:900-936` (resume sweep) + `runs.py:814-877` (`_harness_continuation`); `harness/programmatic.py:89` (split_topic reads `topic`); `harness/phase_types.py:305-360,479-484` (batch fan-out); `061_harness_seed_templates.sql:46-239` (4 seeds, verify gate `:117-131`).

### The protected substrate (do-not-break) + the gateway source
- `backend/app/services/agent_loop.py` — Deep's 3 provider branches (anthropic `:1396/1415`, google `:1530/1553`, openai-compat `:1657`) + round-trip invariants (end_turn `:2107`, thought_signature `:1638/2150/_reconstruct_history:776`, reasoning_content `:1836/2160`, `<think>`/empty-retry `:1802/2120`, force_no_tools `:1367`, iteration cap `:1317/2028`). **The gateway (092.5) extracts THIS; 093 consumes it.** Module docstring `:15-19` warns a careless cleanup re-opens the 075.x cascade.
- `backend/app/services/sub_agent_service.py` — byte-frozen (D-085-16); the `analyze_document` path.
- `backend/app/services/task_service.py` — SHARED Deep `task()` + harness; `tools_override`/`system_prompt_override` additive (`None` = byte-identical for Deep); F7 return keys additive.
- `backend/app/services/openai_service.py:1197-1285` create_adaptive_streaming_chat (STRUCTURED branch deliberately omits tools — caller injects) + `:1155-1174` resolve_calling_mode.

### Project rules + decisions
- `CLAUDE.md` — Provider-docs-first / cross-provider rules; `feedback_no_cross_provider_regressions`; one-UX-four-adapters (`feedback_provider_uniform_ux`); `feedback_cross_provider_always_top_of_mind`; `feedback_openrouter_is_experimental` (native-7 is the bar; OpenRouter best-effort).
- PROJECT.md decisions: **D-085-16** (sub_agent_service byte-frozen), **D-092-UX** (composer A+C → 094), **D-092-AUTHOR** (NL-describe→validate→lint authoring, not a drag-canvas — the safe-by-construction thesis D-10 serves), **D-v2.8-01** (plugin/role tier → v2.9).

### Related seeds (forward-looking; cross-reference)
- `.planning/seeds/SEED-028-native-google-sdk-split.md` — the gateway is the shared consumption boundary this implies; SEED-028's native-Google-service is a future enhancement BEHIND the gateway (not required by 093/092.5, which extract the *existing* proven dispatch byte-identically).
- `.planning/seeds/SEED-024-settings-architecture-unification.md` + `.planning/seeds/SEED-012-admin-operator-ui-completeness.md` — the operator's "admin/full control over settings at scale" theme; the stale-model evidence reinforces the centralized-resolution + admin-tunable-registry direction.
- `.planning/seeds/SEED-047` (in STATE.md deferrals) — resume ctx missing inputs/model; D-04 (resume ctx.model) closes part of it.
- `.planning/seeds/SEED-048-embeddings-cross-provider-spof.md` — **[092.5]** `search_documents` + ingestion embeddings are hardwired to OpenAI (`retrieval_service.py:36` → `openai_service.embed_texts` `:1288`) with **no fallback**, decoupled from the active chat provider → an OpenAI 429/outage breaks RAG grounding for **all** native-7 chat providers at once. **UAT false-alarm guard (NOT a 093 dependency):** if 093's search-heavy native-7 UAT (D-13) BLOCKs with ONE identical fingerprint across many providers, suspect THIS shared SPOF before chasing a per-provider gateway/harness regression — it masqueraded as a 7-provider SSE BLOCK on the 092.5-06 gate.
- `.planning/seeds/SEED-049-e2e-suite-revival.md` — **[092.5]** the Playwright E2E suite is rotted (16/17 fail — composer never submits; test-driving drift across 075.4/075.7/088, NOT a backend regression). D-13's UAT must **NOT** lean on Playwright as a passing backstop until SEED-049 revives it; the live operator UAT + skeleton-diff method is the real gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (consume, don't re-derive)
- **`agent_loop.py`'s provider dispatch** — the proven native-7 path. Extracted into the shared gateway in 092.5; 093 consumes it. (D-02)
- **`tool_parser.parse_structured_tool_calls` + `TOOL_USAGE_INSTRUCTIONS`** — Deep's STRUCTURED-mode handling; the gateway/harness reuse these (D-03), never re-implement.
- **The Continue endpoint's workflow_run fallback (`runs.py:645-670`)** — the exact owner-scoped, anchor-confirmed resolve pattern the ask_user fix (D-07) mirrors.
- **`_compute_confidence`** (shared by Deep + harness F7) — keep using it; grounding union already wired (`task_service.py:492-505` → engine → Deep-shaped events).
- **The publish-time reachability lint (091)** — extend it for input/output-contract checks (D-10).
- **`_SUB_AGENT_MODEL_DEFAULTS` (`config.py`)** — the correct per-provider fallbacks the dead safety net should consult (D-06).

### Gateway contract — what 093 consumes  **[092.5, verified on disk 2026-06-02]**
092.5 shipped the gateway exactly as **D-02** assumed. 093 **consumes** this surface; it does NOT re-implement provider logic (D-02/D-14).
- **Where:** `backend/app/services/provider_gateway/` — 6 modules: `__init__.py`, `events.py` (canonical `GatewayEvent` TypedDicts = the wire vocabulary; **type 093 against these** — incl. `ToolArgsProgressEvent.emit_sse: NotRequired[bool]` at `events.py:80`, the load-bearing boundary-gate flag the consumer reads as `_event.get("emit_sse", True)`), `dispatcher.py` (`open_stream` + `GatewayRequest` envelope), `anthropic.py` / `google.py` (clean adapters, VERBATIM), `openai_compat.py` (the 402-line entangled adapter — owns the `<think>` machine, `reasoning_content` routing, `_accumulate_chunk_usage` both branches, per-provider 5KB boundary dicts).
- **Contract:** `await open_stream(provider, request: GatewayRequest) -> (stream, CallingMode)` (`dispatcher.py:75-104`). The surfaced **`calling_mode`** is the *structural fix* for the harness-OpenAI-only bug — the harness gates the STRUCTURED skip/inject/post-parse path on it. `CallingMode` is **re-exported** from `openai_service` (not a new enum — Pitfall 3).
- **🔴 SYNC-GENERATOR TRAP (IN-05 — the single highest-value fact for the first task):** `open_stream` is `async def` and is **annotated** `-> tuple[AsyncIterator[GatewayEvent], CallingMode]`, but the adapters actually return **bare SYNC generators** (`stream_anthropic` / `stream_google` / `create_adaptive_streaming_chat`) driven in a threadpool. **The annotation lies.** Drive the stream with `for chunk in stream:` inside `run_in_threadpool` (mirror the existing `task_service._consume_sync_stream` / `agent_loop._drain_stream_with_close_on_cancel` pattern, `close_fn=stream.close`) — **never `async for`** (it would break). Confirmed in-code: `dispatcher.py:89` + `task_service.py:125` both document the sync-iterator reality. (092.5-03 "sync-generator seam" decision.)
- **Dead fields (IN-02/IN-03, low priority):** `GatewayRequest.api_key` / `.max_tokens` are currently unused — don't be misled about what the envelope drives. Absorb the IN-01…IN-05 maintainability cleanups cheaply *only if* 093 touches the contract.

### Established Patterns
- **One UX, four adapters** — UI/SSE stays provider-agnostic; provider translation lives at the service boundary (the gateway). The harness must NOT add provider logic above the gateway.
- **Additive, None-default overrides** — every harness addition to a shared file defaults to a Deep-byte-identical no-op (the F1–F8 pattern; SC#2 / Phase 089 invariant).
- **2-phase write + claim_run lease** — harness durability; Continue must take a `claim_run` lease (audit row 30 — currently missing) to avoid double-drive vs the resume sweep.
- **Two-id model** — `ctx.run_id` = workflow_run id (audit/definition/resume-match); `producer_run_id` = real `runs.run_id` (FK + SSE routing). Load-bearing for F1/F2/F4/F5/F7/F8 — do not collapse it (D-08/D-14).

### Integration Points
- Harness LLM call sites: `task_service._stream_one_iteration` (`:177`) + `run_task_sub_agent` loop (`:379`) — where the gateway gets consumed. **[092.5] F9 bug-site, verified 2026-06-02:** `task_service.py:177` currently reads `stream, _calling_mode = create_adaptive_streaming_chat(...)` — it **discards `calling_mode` and bypasses the gateway entirely** (the OpenAI-only path). 092.5 surfaced the fix via `open_stream` but explicitly did NOT rewire `task_service` (its own D-05, "no task_service rewire"). So **F9 is structurally unblocked, not closed** — routing this site (and `:379`) through `open_stream` + consuming the surfaced `calling_mode` is 093's first task. New req **PARITY-02** traces here.
- ctx build sites for model threading (D-04): `threads.py:1214-1255` (live), `harness_engine._build_resume_context` (resume), `runs.py` Continue builder.
- ask_user fix (D-07): `runs.py` ask_user_response endpoint only — branch on the id namespace.
- Answer surfacing (D-11): refactor `threads.py:1266-1357` surfacing into a shared helper `run_workflow` calls.

### 🔴 Protect Surface (do-not-break — verified load-bearing)
- `agent_loop.py` 3 provider branches + ALL round-trip invariants (consume via gateway, never modify).
- byte-frozen `sub_agent_service.py` (D-085-16). Shared `_emit` SSE wire shape (`threads.py:145-159`).
- `task_service` `None`-default behavior for Deep `task()`/`analyze_document` callers.
- MODE-01 Deep `else` branch (`threads.py:1417`) + `_shielded_finalize` ordering — byte-identical.
- Frontend `api.ts:485-575` existing dispatch — Phase-B phase_* handlers must be purely additive.
- F1–F8 (all present & correct) — do not re-litigate.

</code_context>

<specifics>
## Specific Ideas

- The operator's mental model and the value framing: this is a **durable automation engine** (legal/finance/HR SOPs run the same trustworthy way every time), not a chat toy. The harness only delivering on OpenAI / 1-of-4 templates is the milestone's headline value at risk — fixing it is first-class business value, not polish.
- Operator's strategic principles, captured as design constraints: (1) **one home for provider logic** (D-02), (2) **root-cause not per-phase band-aids** (D-04 shared resolver), (3) **safe-by-construction so the future builder doesn't need code fixes per workflow** (D-10), (4) **never break working things** (D-14).
- Honest current scale (verified, state plainly in VERIFICATION): **2 of 5 phase-types work, 1 of 4 seed workflows works, on 1 of 7 providers** — before this phase.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 092.5 — Provider Gateway Extraction** (the refactor pre-step; ships FIRST). 093 depends on it. Its own discuss/plan + byte-identical-Deep UAT gate.
- **Phase 094 — Workflow Legibility + Mode Clarity** (the chrome: phase timeline, run-card for harness answers, failure-honesty, mode disambiguation per D-092-UX). Sketch-first (G-2). Renders the per-phase events 093 emits.
- **PARITY-01** (Deep-mode Anthropic summary tail BUG-260514-02 + iteration bloat BUG-260523-04 + non-Anthropic tool-card labels BUG-260528-03) — re-deferred. Operator: not reproducing now; high Anthropic iteration count may be expected Claude behavior; not worth a shared-path risk. Re-open trigger: a focused Deep-mode UX phase, or the bugs re-reproduce.
- **Admin/full settings controllability at scale** — SEED-024 + SEED-012 (forward-looking; tied to the deferred v2.9 admin/operator role tier). The shared model-resolver (D-04) is the contained root-fix now.
- **Native Google SDK service** (SEED-028) — a future enhancement behind the gateway; not needed for 093 (the gateway extracts the existing proven Google-via-compat path byte-identically).
- **`llm_judge` validator, workflow builder, new phase-types, OpenRouter as first-class** — out of v2.8 (D-v2.8-01 / project policy).

</deferred>

---

*Phase: 093-harness-cross-provider-parity*
*Context gathered: 2026-06-01*
