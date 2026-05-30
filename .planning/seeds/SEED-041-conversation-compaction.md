---
id: SEED-041
status: dormant
planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: A thread exceeds the smallest active model's context budget and context_truncated fires in normal use, OR per-turn input-token cost on long interactive threads becomes a complaint, OR the v3.4 checkpoint-compression deferral matures
scope: Medium
---

# SEED-041: Conversation Compaction — context-window management for long interactive chats (condense, don't discard)

## Why This Matters

This app is deliberately **stateless** — CLAUDE.md says it plainly: "store and send chat history yourself, no provider-side thread state." That means on **every single turn** the backend re-sends the entire conversation history to the model. It's the right call for portability (we can switch providers freely), but it has a cost that grows with the chat: the longer a thread gets, the bigger the payload we ship each turn, the more we pay for input tokens, and the slower the first token comes back. Eventually a long, chatty thread bumps into the model's hard context-window ceiling.

Right now the **only** thing protecting against that ceiling is a blunt instrument: when the history won't fit, we throw away the oldest turns. That's drop-oldest sliding-window truncation in `backend/app/services/context_window.py:151-229` (`trim_messages_to_fit`), wired into the agent loop both before it starts (`agent_loop.py:941`) and again on every iteration (`agent_loop.py:1151`). When it fires it drops the oldest messages, leaves a `[trimmed]` marker, and emits a `context_truncated` SSE warning (added in Phase 075.4). The problem: **dropping is lossy.** The model literally forgets what was said earlier in the conversation — the user can be mid-discussion and the assistant suddenly loses the thread because turn 3 got silently deleted to make room for turn 40.

The better answer is **compaction**: instead of deleting the old turns, summarize them into a short recap and keep that recap. The conversation stays coherent, the payload stays small, and the user doesn't hit a memory cliff. This is what Claude.ai and ChatGPT do under the hood, and it's what we should do too.

## When to Surface

**Trigger:** a thread exceeds the smallest active model's context budget and `context_truncated` fires in normal use; OR per-turn input-token cost on long interactive threads becomes a complaint; OR the v3.4 checkpoint-compression deferral matures (see Notes).

Present during `/gsd:new-milestone` when the milestone scope matches any of:
- Chat/context-window/long-conversation quality work, OR a real `context_truncated` event observed in production (the warning is already wired, so it's a measurable signal)
- Cost/latency-reduction work, agent-loop / context-management refactors, or any milestone touching `trim_messages_to_fit` / `agent_loop.py`
- The v3.4 → v3.5+ **checkpoint-compression** slot coming due (this seed should be UNIFIED with that slot — see Notes)

## Scope Estimate

**Medium** — a phase or two, three deliverables that can ship incrementally:

1. **Rolling summarization (the core).** Replace or augment drop-oldest: when the trimmable head needs to go, summarize it into a compact recap block and keep that recap **right after the system prompt** instead of discarding the turns. The trim machinery (what's protected, what's trimmable, atomic tool-call sequences) already exists in `context_window.py` — this swaps the "delete the head" step for "summarize the head, then keep the summary."
2. **Per-thread token-budget telemetry.** Surface how many input tokens each turn is costing on a thread so the cost/latency growth is visible (and so we can prove compaction actually helps). The token estimator already lives in `context_window.py` (`estimate_messages_tokens`).
3. **Artifact-reference replacement (optional, high-leverage).** Large stored tool results (a big `execute_code` stdout, a fat `search_documents` payload) dominate long-thread token cost far more than chat text does. Replace those in-history with a short reference pointer ("see artifact X") so the bulky body isn't re-sent every turn.

**Provider-docs-first (per CLAUDE.md):** research Anthropic's **native** context-management / compaction first — the Anthropic SDK we already vendor ships `beta_context_management_config_param.py` and `beta_managed_agents...context_compacted_event.py` (currently **unused** in our code; the param file is confirmed present under `backend/venv/.../anthropic/types/beta/`). Then keep the behavior **provider-agnostic at the UX layer** (one experience) with an **app-level summarization fallback** for the non-Anthropic native providers (OpenAI, Google, DeepSeek, Moonshot, GLM/Z.ai, MiniMax). One behavior, per-provider adapters at the service boundary — the same "one UX, four adapters" pattern the project already follows for streaming.

## Breadcrumbs

- `backend/app/services/context_window.py:151-229` — `trim_messages_to_fit` (the current drop-oldest sliding-window; emits `[trimmed]` marker)
- `backend/app/services/context_window.py` — `estimate_messages_tokens` (token estimator — reuse for telemetry deliverable #2)
- `backend/app/services/agent_loop.py:941` — pre-loop trim call
- `backend/app/services/agent_loop.py:1151` — per-iteration trim call; `:1163-1170` emits the `context_truncated` SSE warning (Phase 075.4)
- `backend/venv/Lib/site-packages/anthropic/types/beta/beta_context_management_config_param.py` — vendored Anthropic native compaction config (unused today); plus `beta_managed_agents...context_compacted_event.py`
- `.planning/PRDs/v3.4.md:302` (Opportunity E supersession), `:394` (§11 deferral: "Context-compression strategies (summarization, token eviction, artifact-reference replacement) for checkpoints" → v3.5+, re-trigger `agent_checkpoints` > ~10MB/run)
- Related seeds: SEED-024 (per-model `context_window_tokens` knob — the budget this compaction must respect), SEED-027 (multimodal token budget), SEED-001 (scale readiness)

## Notes

There is a **near-miss** already on record in `.planning/PRDs/v3.4.md` (Theme D / §11, line 394) that defers exactly these strategies — "summarization, token eviction, artifact-reference replacement" — to a v3.5+ polish slot. But read it carefully: that deferral is scoped **only to compressing `agent_checkpoints` rows for long-running AUTONOMOUS runs** (its re-trigger is literally "`agent_checkpoints` table grows beyond ~10MB/run"). That is a **different surface** from this seed's concern, which is the **interactive chat** the user types into every day. The v3.4 deferral is also not tracked as a seed — it lives buried in a PRD section, so it can silently fall through the cracks.

This seed **SUPERSEDES the interactive-chat half** of that v3.4 deferral and should be **UNIFIED with the v3.4 → v3.5+ checkpoint-compression slot** when that matures — build the summarization engine **once** and share it across both surfaces (interactive chat compaction + autonomous-run checkpoint compaction). They want the same primitive; splitting them would mean writing summarization twice.

The `context_truncated` SSE warning shipped in 075.4 is the canary: when operators start seeing it in normal chat (not just stress tests), that's the empirical signal this seed has matured from "dormant" to "do it now."

Per-model budgets matter here: the right ceiling isn't one global number — it's `model_capabilities_overrides.context_window_tokens` per model (see SEED-024). Compaction must trim against the *active* model's budget, and "the smallest active model's budget" is the conservative floor when a thread might be served by different models across turns.
