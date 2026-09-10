---
seed_id: SEED-029
title: "Continue" button on iteration-cap stop — user-confirmed escape valve to resume agent loop with a fresh budget (Claude.ai-style)
status: folded          # folded_into v4.1 (SHELL-02) at /gsd:new-milestone 2026-09-11
folded_into: "v4.1"

planted: 2026-05-23
phase_origin: 075.4 context-gathering (operator question about Claude.ai's tool-call-limit Continue affordance)
related_seeds: [SEED-012, SEED-026]
relates_to:
  - Phase 066 lifecycle states (cancelled / timed_out / completed split)
  - Phase 075.4 Plan 03 D-075.4-E2 iteration-cap silent-drop guard (ships the *warning*; this seed adds the *Continue button*)
  - BUG-260523-04 (Anthropic 22-iter outlier) — measured by Phase 075.4 Plan 05 E2E #6; root-cause fix deferred to focused phase after 075.4
  - v2.7 PRD — Agent Workspace + Harness Engine (long-running multi-step agent workflows)
  - `backend/app/api/threads.py:1656` `force_no_tools = (iteration == max_iterations - 1)` — current iteration-cap branch
  - D-063-04 Resume mechanism (already exists for crashed/timed-out runs — pattern reusable for Continue)

re_open_triggers:
  - After Phase 075.4 ships AND the deferred BUG-260523-04 root-cause investigation closes: if iteration-cap is still hit on legitimate multi-step tasks (i.e. tasks the model expects to continue, not bugs where the model loops), promote to a phase
  - v2.7 plan-phase opens — fold into Harness Engine if it lands there
  - User reports any task that fails with "Reached iteration limit" warning (from Phase 075.4 Plan 03) more than 2× — clear signal the cap is real-world friction, not just a bug-spec

priority: MEDIUM (value-add UX, not urgent — Phase 075.4 ships the warning; this seed adds the affordance)
suggested_phase: v2.7 Harness Engine (preferred) OR focused v2.6 polish phase if real-world friction surfaces post-075.4
---

# SEED-029 — Iteration-cap "Continue" affordance

## What was observed

Claude.ai, when its agent loop reaches the tool-call limit, presents a **Continue** button to the user. Clicking it resumes the agent loop with a fresh iteration budget. Operator surfaced this 2026-05-23 during Phase 075.4 context-gathering: *"how it could be applicable to our app? in case applicable, is it needed?"*

This app's current behavior (and the behavior Phase 075.4 Plan 03 will ship):
- `force_no_tools = (iteration == max_iterations - 1)` at `backend/app/api/threads.py:1656`
- If iteration N-1 returns content AND tool_calls, the tool_calls were silently dropped → Phase 075.4 fixes this by surfacing a visible warning (D-075.4-E2: "⚠ Reached iteration limit — didn't run the last N tools the model requested.")

Warning ≠ Continue. The warning closes the *trust* gap; this seed would close the *capability* gap.

## Why it's not in 075.4

075.4 Plan 03's iteration-cap warning is intentionally **passive** — it tells the user what happened, doesn't offer a resolution. Per FORWARD-REF #6 in 075.4 context, lightweight inline warnings only; sophisticated affordances deferred to 082.5 (error-handler) and beyond.

A Continue button needs:
- New `runs.status = 'iteration_cap_paused'` lifecycle state (extends Phase 066 cancelled / timed_out / completed split — D-066 schema)
- Backend endpoint to resume with a fresh iteration budget (or reuse existing Resume path with a `reset_iteration_count=true` flag)
- Frontend UI: warning becomes an actionable button (Plan 075.4-E2's system-role message becomes the carrier for the action)
- Telemetry: track Continue clicks vs. natural completions — informs whether the cap is set correctly

## Why probably not urgent

The audit (`.planning/AUDIT-2026-05-23-cross-cutting-cleanup.md`) shows the iteration cap (`max_iterations=15`) comfortably covers normal usage: 4-6 iterations is typical. The known pain case is BUG-260523-04 (Anthropic 22-iter outlier) — that's a *bug* in Claude's loop behavior, not a legitimate use of the cap. Once BUG-260523-04 is rooted (post-075.4), the cap should hold for normal cases.

Long agentic workflows (research bots, multi-stage builds, deep-dive analysis) that legitimately need 30-50+ iterations are exactly what **v2.7 Agent Workspace + Harness Engine** is being scoped to host. SEED-029 lands naturally there.

## What's needed when this re-opens

### 1. Lifecycle state extension

Add `iteration_cap_paused` to the runs.status enum (alongside `cancelled` / `timed_out` / `completed` / `streaming` / `queued`). Schema migration with default-NULL fallback for existing rows.

### 2. Resume-with-budget-reset endpoint

Either:
- **Reuse existing Resume** (`POST /threads/{id}/runs/{run_id}/resume` per D-063-04) with a new `reset_iteration_count: bool` body field — minimal new surface
- **New endpoint** (`POST /threads/{id}/runs/{run_id}/continue`) — explicit, but more API surface

Reuse path preferred. Continue is conceptually a Resume with a slightly different precondition (last-known-good iteration state instead of last-known-good message).

### 3. UI affordance

Phase 075.4 Plan 03 D-075.4-E1/E2 ships system-role messages with structured `kind:` field. Carrier for Continue button is the same shape — extend the system-role message renderer to optionally include an action button when `kind: "iteration_cap_paused"`. Click → calls Resume endpoint with reset flag.

### 4. Per-task / per-user cap policy

Open question: does Continue have its own limit? Three options:
- Unlimited (each Continue gets a fresh `max_iterations` budget) — most user-friendly, risk of runaway loops
- Caps after N continues (e.g., 3 Continues max per run) — safety valve
- Tied to per-user / per-org quota — multi-tenancy work (v3.0+)

Recommended: cap at 3 Continues per run for v2.7; later phases tie to quota.

### 5. Telemetry

Log per-run: `continues_used: int`. Aggregate dashboard answers "are we setting max_iterations too low?" — feeds Phase 066's adaptive-timeout precedent for cap tuning.

## Open questions to resolve at plan-phase

- **Resume vs Continue API surface** — reuse or split?
- **Cap on Continues** — see §4 above
- **Memory of dropped tool_calls** — when iteration cap fires with buffered tool_calls (the trigger for the warning today), does Continue re-issue those tool_calls or start fresh? Probably fresh, since 15 iterations later the user's intent may have shifted, but worth confirming
- **Cross-provider parity** — Anthropic native (stream_anthropic), OpenAI/OpenRouter (chat.completions), Google (OpenAI-compat) all need identical Continue semantics; map to Phase 075.4 Plan 02's provider-agnostic sweep

## Cross-references

- Phase 075.4 Plan 03 D-075.4-E1/E2 — *the warning* (already scoped)
- Phase 066 lifecycle states — *the precedent* for a new run status
- D-063-04 Resume mechanism — *the API pattern to reuse*
- v2.7 PRD Harness Engine — *the likely landing zone*
- BUG-260523-04 — *the test case that determines whether iteration cap is actually hit by legitimate use*
