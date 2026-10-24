---
id: BUG-261024-03
title: At the 15-round cap, a tool call the model writes as text (DeepSeek DSML) is shown as the answer and no Continue is offered
reported: 2026-10-24
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/agent-loop, provider-routing/openrouter, frontend/streaming]
folded_into: "292.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 6db8cf40a
  date: 2026-10-23
---

# BUG-261024-03: At the 15-round cap, a text-form tool call becomes the answer and Continue never appears

## What we observed (production, read-only evidence)

Thread **"generate high level project plan with visuals main"** (folder `/UASG`), cloud.

1. **Run `95c40c5a`** — `openrouter` · `deepseek/deepseek-v4.1-flash-1017`, 2026-10-23 11:23–11:36Z, **status `completed`**, 18 steps, **578,803 input / 30,428 output tokens**, `continues_used = 0`.
   The saved assistant message `4226d237` is **12,034 chars of raw DeepSeek tool-call markup**, starting `<｜DSML｜ calls> <｜DSML｜ invoke name="execute_code"> …` (a matplotlib script) and ending `</｜DSML｜ calls>`. That is what the user saw as the reply ("thinking leaking into the chat").
2. The user typed **"continue"** → a NEW run `9f21ef4c` (not a resume): same model, failed after 9 min with `APIError: Upstream error from Sail Research: no capacity available for this model right now` (external capacity; 923k input tokens spent first).
3. Run `431639e0` (2026-10-24, `google` · `gemini-3.8-flash`) answered "show me the project plan as a flow diagram" correctly, with a Phase 292 diagram card (21 steps, 24 links).

## Why it happened (code, measured)

- Chat mode caps the loop at **`max_iterations = 15`** (`agent_loop.py:1528`); on the last iteration it forces `tool_choice="none"` (`force_no_tools`, `agent_loop.py:2324`).
- Phase 092 already handles the cap the Claude.ai way: if the final iteration still produces tool calls, they are persisted and the run pauses **`cap_paused`** with a **Continue** card (`agent_loop.py:~2850`, `max_continues_per_run = 3` in `config.py:1666`; frontend `ChatArea.tsx` / `MessageItem.tsx`).
- That detection reads the **structured** `tool_calls_buffer`. DeepSeek via OpenRouter, told `tool_choice="none"`, wrote its next `execute_code` call **as text** in DSML. The buffer was empty, so the cap path never fired: the markup was saved as the final answer, the run read `completed`, and no Continue card appeared. (The Phase 175 DSML flush/leak signal did not catch this final-iteration case.)

## Expected (the Claude.ai pattern the operator asked for)

When the tool-round ceiling is reached with work still pending, the turn ends with a clear line such as *"Reached the tool-use limit for this turn"* and a **Continue** button that resumes the same run with a fresh budget — never raw tool markup in the answer.

## Likely fix (to scope in a phase — agent_loop.py is a G-5-firing hot file)

1. On the forced-final iteration, run the existing DSML/XML text-tool-call parser over the streamed text; if it finds calls, route them into the same `cap_paused` persistence as structured calls (and strip the markup from the answer).
2. Never persist DSML/XML tool markup as assistant content: a final-answer sanitiser for every provider path, with a worded fallback.
3. Decide whether a user typing "continue" after a cap should resume the paused run instead of starting a new one.
4. UAT across the full native roster + OpenRouter (CLAUDE.md SC#10), with a forced low cap to hit the ceiling cheaply.

## Routing

Operator to decide: a small inserted phase before/after 293, or the first phase of the next milestone. Not foldable into 293 (inbound-start scope).
