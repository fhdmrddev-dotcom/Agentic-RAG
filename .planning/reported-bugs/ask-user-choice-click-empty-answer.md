---
id: BUG-260607-01
title: ask_user choice-click answers arrive as empty strings — the model never receives the chosen option
reported: 2026-06-07
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/panel, backend/tool-dispatch, backend/harness]
folded_into: null
verified_closed_by: "v2.8 audit close-out (fix commit on v2.5-dev; unit-verified both paths)"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 0af81c8e (pre-fix)
  date: 2026-06-07
---

# BUG-260607-01: ask_user choice-click answers arrive as empty strings

## What we observed

Live during the v2.8 close-out verify (run `92c7b64c`, openai gpt-5.4-mini, thread `056282b0`, 2026-06-07 17:39):

1. Model called `ask_user` ("full benchmark or smaller size?") with 2 options.
2. Operator clicked an option (no free text). DB shows the answer row persisted as `{choice_index: 1, response_text: ""}`.
3. The tool result delivered to the model was `result: ""` (persisted on the assistant message's tool_calls).
4. The model, given an empty answer, **re-asked the question in plain text and ended the run** — from the operator's view, "I answered and it did not proceed."

## Why it matters

Click-an-option = the primary ask_user interaction — and it silently broke the round-trip on **every provider, in both Deep and Harness modes**. In Harness mode it is worse: `_exec_llm_human_input` would advance the workflow on a silently-empty answer. All prior UAT (093 F10, 096 eval robot D-02a) sent *typed* text, so the click-only branch was never exercised.

## Root cause (verified, 3 layers)

1. **Frontend** `PendingAskCard.tsx` `handleSubmit`: sent `response_text: hasText ? freeText.trim() : ""` — the correctly-resolved `selectedValue` (`options[choiceIndex]`) was used only for the optimistic display, never POSTed.
2. **Deep consumer** `tool_dispatcher.py` (ask_user handler): `ToolResult(result=payload.get("response_text") or "")` — no `options[choice_index]` fallback.
3. **Harness consumer** `phase_types.py` `_exec_llm_human_input`: `answer = payload.get("response_text") or ""` — same missing fallback.

## Fix (shipped at v2.8 audit close-out)

- Frontend sends `response_text: selectedValue` (option text for clicks, trimmed free text otherwise — the contract documented at the top of the file all along).
- Both backend consumers defensively resolve `options[choice_index]` when `response_text` is empty (server never hands the model an empty answer when the user actually chose; out-of-range/malformed index degrades to "" gracefully).
- Regression tests: `test_handle_ask_user_choice_click_resolves_option_text` + out-of-range guard (Deep), `test_human_input_choice_click_resolves_option_text` + guard (harness), PendingAskCard submit test retargeted to assert the option text rides `response_text`.

## Surface classification

`Agentic-RAG` — our frontend + both backend consumers.

## Suggested routing

- **Fixed inline** at v2.8 milestone-audit close-out (operator-approved). No further routing.

## Reference / evidence links

- DB evidence: messages rows on thread `056282b0` (ask_user_prompt 17:39:30, ask_user_response 17:39:46 with empty text + choice_index 1, assistant re-ask 17:39:47)
- Fix commit: see `git log` v2.5-dev 2026-06-07 (fix(ask_user) commit following 0af81c8e)
