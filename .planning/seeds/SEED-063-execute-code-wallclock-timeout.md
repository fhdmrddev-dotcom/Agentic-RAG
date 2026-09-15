---
seed_id: SEED-063
title: execute_code needs a wall-clock timeout — runaway model code wedges a run forever (availability bug)
status: shipped
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: DONE ✅ — backend implemented + unit-tested + LIVE-VERIFIED 2026-06-07 (operator set SANDBOX_EXEC_TIMEOUT_SECONDS=10, ran sleep(30): aborted at 10s, no hang)

  The prose that followed the token, byte-for-byte:
  ✅ — backend implemented + unit-tested + LIVE-VERIFIED 2026-06-07 (operator set SANDBOX_EXEC_TIMEOUT_SECONDS=10, ran sleep(30): aborted at 10s, no hang)

  Mapped `DONE` -> `shipped`. Reason: READ SEED-063/064 — both prose lines say code shipped and was live-verified.
planted: 2026-06-07
phase_origin: Phase 096 live UAT (Test 3 stream-cap storm) — operator-run, DB-verified
category: B — real defect, slated for a small dedicated fix phase (operator-approved routing 2026-06-07)
severity: blocker
related_seeds: [SEED-062, SEED-036a]
related_findings: [SEED-064 (no-stop-button — same lived incident), SEED-065 (load degradation — same incident)]
relates_to:
  - "`backend/app/services/tool_dispatcher.py:589-672` — `_handle_execute_code` runs `session.execute_command` in `loop.run_in_executor(None, _run_sync)` and `await fut` with NO timeout; no `asyncio.wait_for`, no sandbox-side wall-clock cap"
  - "`backend/app/config.py` MODEL_CAPABILITIES `llm_call_timeout_seconds` bounds LLM calls ONLY — tool execution is unbounded"
  - "`backend/app/services/sandbox_service.py` — per-thread container, 30-min idle eviction; no per-execution timeout"
re_open_triggers:
  - The dedicated fix phase for the 096-UAT findings is planned (this is its primary line item)
  - Any production / multi-user deployment (an unbounded sandbox compute is a resource-exhaustion / availability risk at scale)
  - A sandbox-hardening pass (SEED-062) is opened — timeout belongs in the same runtime_configs surface
priority: high (real availability bug; low blast radius to fix)
suggested_phase: small dedicated fix phase alongside SEED-064 (stop button)
surface: Agentic-RAG
trigger_when: unset
---

# SEED-063 — execute_code wall-clock timeout

## What happened (Phase 096 live UAT, 2026-06-07 — DB-verified)

Operator ran ~6–7 concurrent chats with a heavy `execute_code` prompt (sort
benchmark on lists up to 8M random integers). Two runs — anthropic
`claude-haiku-4-5` (run `09694697`) and openrouter `llama-3.3-70b`
(run `394644e1`) — got stuck **inside** `execute_code` for **40+ minutes**.
DB/Redis evidence: producers ALIVE (heartbeat `code_executing` with
`elapsed_seconds: 2445` / `2402` still ticking), `runs.status='streaming'`,
runs never terminalized. Operator had to kill 8+ sandbox containers and restart
the backend (uvicorn graceful shutdown itself HUNG, waiting on the stuck
executor threads).

## Root cause

`_handle_execute_code` awaits the sandbox executor future unbounded. A model
that writes a non-terminating or O(n²)-on-8M-elements computation (plausible
from the prompt) — especially under heavy multi-container CPU contention — runs
effectively forever. The per-model `llm_call_timeout_seconds` does NOT cover
tool execution. Nothing kills it; the producer holds a thread-executor slot and
the run wedges with no auto-recovery.

## Fix direction (for the fix phase — confirm provider-uniform, don't break)

1. Add a configurable per-call `execute_code` wall-clock timeout — `asyncio.wait_for`
   around the executor future AND/OR a sandbox-side `execute_command` timeout.
2. On expiry: kill the in-container process / abandon the container, return a
   normal `ToolResult` error ("code execution exceeded Ns — aborted"), and let
   the agent loop continue or the run terminalize CLEANLY — never wedge.
3. Make the limit a setting (`app_settings` / config), generous default (e.g.
   120–300s), not a magic constant.
4. Provider-uniform: the handler is shared across all 7 providers — the fix is
   provider-agnostic by construction. Verify no Deep-mode regression.
5. Pairs with SEED-036a sandbox-concurrency sizing (how many sandboxes may run
   at once) and SEED-065 (load degradation).

## Vibe-coder plain summary

The agent can run Python in a sandbox, but there's no time limit. If a model
writes code that never finishes (a slow algorithm on huge data), the chat hangs
forever, eats your CPU, and can't even be stopped — which is exactly what
happened in testing. The fix: give code-execution a deadline; if it runs too
long, stop it cleanly and tell the user, instead of hanging.

## Follow-up (2026-06-07, post-fix): models are not PROACTIVELY aware of the limit

Verified: the 180s cap is communicated only REACTIVELY (the timeout ToolResult error
coaches "split the work into smaller steps"). Neither the shared `EXECUTE_CODE_TOOL`
description (`backend/app/services/openai_service.py:435`) nor the shared
`SYSTEM_PROMPT` code-execution conventions (`backend/app/services/agent_loop.py`)
mentions a time limit — so models burn the full 180s before learning the wall exists,
instead of planning chunked work upfront.

Proposed polish (operator-approved direction, routed to a dedicated prompt-polish
phase — NOT a drive-by edit, per provider-docs-first):
- Add ~1 sentence to the execute_code tool description: each execution has a
  wall-clock limit (surface the configured value, not a hardcoded "180"); for long
  computations split work into steps — variables/files persist across calls in the
  same thread.
- Provider-uniform by construction (single tool definition + single SYSTEM_PROMPT,
  all 8 providers) but any shared-prompt change requires cross-provider UAT
  (4-axis scoreboard).
- Belongs with SEED-034 (per-provider prompt strategy) when that phase is scoped.
