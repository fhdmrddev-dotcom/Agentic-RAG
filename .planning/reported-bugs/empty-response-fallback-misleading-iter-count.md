---
id: BUG-260522-01
title: Empty-response fallback message reports max_iterations (15) instead of actual iteration count
reported: 2026-05-22
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [backend/agent-loop, user-facing-errors]
folded_into: "075.4"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 54d0538
  date: 2026-05-22
---

# BUG-260522-01: Empty-response fallback reports `max_iterations` instead of actual count

## What we observed

When the agent loop terminates because the LLM returned empty content + no tool calls, the user-facing fallback at `backend/app/api/threads.py:2910` always reports:

> *"The model returned an empty response after 15 iterations. Try breaking the request into smaller steps or switching to a different model."*

The string formats `max_iterations` (a constant — 15 for main agent, 8 for explorer per `threads.py:1364-1368`) — **not** the actual number of iterations the loop executed.

In the 2026-05-22 Google empty-stream investigation (quick task `260522-gdg`), the loop in reality ran **2 iterations** (iteration 0 empty → `_empty_retries < 1` retry → iteration 1 empty → break at `threads.py:2031`). Users see "15 iterations" and assume the model worked hard before giving up. It didn't.

## Why it matters

**Severity: minor (UX accuracy).** The bug is observability-only — no functional impact on the agent loop. But:

- Misleads operator triage. A bug report saying "fails after 15 iterations" pulls investigators toward iteration-count root causes (tool loops, max-iter budget too low) when the actual failure mode might be "empty on iteration 0, broke after 2".
- Misleads end users. Suggesting *"break into smaller steps"* is bad advice when the model isn't iterating at all — it's failing on the first call.
- Reduces trust signal. Users may interpret "after 15 iterations" as "the model tried hard". If it actually tried once, the suggestion to retry is more accurate; if it tried 15 times, the suggestion to switch models is more accurate. Conflating them weakens the message's diagnostic value.

## Hypothesized cause

Hardcoded format string at `threads.py:2910` references `max_iterations` (the loop budget constant) rather than tracking the actual iteration index reached when the loop exits via `break` at `threads.py:2031` or natural loop exit. Likely a copy-paste assumption that the fallback fires only when the loop *exhausts* its budget — but the same string also fires when `_empty_retries` triggers an early break.

Fix shape (one-line + tracking):
- Track actual iteration index in a `_iters_run` accumulator (or capture the last `iteration` value at loop exit — already in scope at line 2910 since the for-loop variable persists).
- Update the format string to: `f"...empty response after {actual_iters} iteration(s) (max {max_iterations})..."`.

## Surface classification

`Agentic-RAG` — bug lives entirely in our backend agent loop. Routable into any phase that touches user-facing error messages.

## Suggested routing

- **Fold into in-flight phase:** n/a (075.2 is frontend-focused; not a fit)
- **Defer to future phase / milestone:** **Phase 082.5** (*Error Handler Foundation — SEED-026 urgent slice*). Per ROADMAP §"Phase 082.5" SC#1, that phase ships the `ErrorResponse` model with `user_message` + `admin_message` separation and a global handler that *"sanitizes untrusted exception detail — internal SDK error strings never reach `user_message`"*. The same SC#1 work is the natural home for accuracy improvements to user-facing error strings. Net addition: one line in the fallback formatter + one regression unit test.
- **Plant as seed:** n/a (too narrow for a seed; just a Phase 082.5 line item)
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **For operators triaging:** check the backend log for `LLM returned empty response on iteration N — retrying once` lines (at `threads.py:2027`) — that's the authoritative iteration count.
- **For users:** none beyond switching models / starting a new chat.

## Reference / evidence links

- `backend/app/api/threads.py:2910` — the misleading format string
- `backend/app/api/threads.py:2024-2031` — the empty-content retry + break path
- `backend/app/api/threads.py:1364-1368` — where `max_iterations` is set per agent type
- `.planning/quick/260522-gdg-google-15-iter-loop-diagnostic/SUMMARY.md` — context where this was surfaced
- `.planning/ROADMAP.md` §"Phase 082.5: Error Handler Foundation" — natural routing target
