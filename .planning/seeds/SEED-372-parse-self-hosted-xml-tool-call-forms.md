---
seed_id: SEED-372
title: Parse the self-hosted Qwen (F4), GLM (F5) and Gemma (F6) tool-call text forms into real calls instead of only detecting and wording them
created: 2026-10-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "A self-hosted model (ollama / lmstudio / custom, the mig-180 path) becomes a row of a cross-provider UAT board, OR a production assistant message carries an F4 / F5 / F6 tool-call form, OR the next phase whose files_modified names text_tool_calls.py."
trigger_paths: ["**/text_tool_calls.py"]
trigger_surfaces: ["chat", "provider"]
migration_note:
relates_to: ["Phase 292.1 (text-form tool calls at the cap)", "BUG-261024-03", "backend/app/services/text_tool_calls.py", "mig 180 (self-hosted endpoints)", "SEED-373"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-372: Parse the self-hosted XML / Gemma tool-call text forms

## The finding

Phase 292.1 made tool calls a model WRITES AS TEXT a first-class path, provider-blind, in the new
pure module `backend/app/services/text_tool_calls.py`. It PARSES only the DeepSeek DSML family
(F1 one bar + space, F2 one bar, F3 two bars), because those are the forms seen in production
(`deepseek/deepseek-v4.1-flash-1017` via OpenRouter, msg `4226d237`) and in the vendor-side grammar.

Three more families were measured in the LOCAL database (read-only SELECT on `public.messages`,
2026-10-24, 292.1-RESEARCH.md "Measured format set"), **13 rows in total, all from self-hosted
endpoints**:

| # | Family | Shape | Rows | Models |
|---|---|---|---|---|
| F4 | Qwen-style XML | `<tool_call>\n<function=NAME>\n<parameter=K>\nV\n</parameter>\n</function>\n</tool_call>` | 6 | ollama `qwen3.6-35b-a3b-mtp`, `qwen-agentworld-35b-a3b`, `qwen3.5-4b`, `ornith-1.5-35b-a3b` |
| F5 | GLM-style XML | `<tool_call>NAME<arg_key>K</arg_key><arg_value>V</arg_value></tool_call>` | 4 | ollama `glm-4.7-flash`, lmstudio `spark-x2.5-4b` |
| F6 | Gemma-style | `<\|tool_call>call:NAME{k:v}<tool_call\|>` (arguments NOT JSON) | 3 | ollama `gemma4:e2b`, custom `gemma-4-26B-A4B-it-QAT-GGUF` |

Since 292.1 these are **detected, stripped from what is streamed and persisted, and worded** — never
executed. The user sees no markup (SC#2 holds), but the call the model meant to make is lost: a
self-hosted model that writes its calls this way can never use a tool through this path.

## Why it matters

Self-hosted models are a supported path since migration 180, and they are the deployment tier where
a customer cannot buy a better-behaved hosted model. Today nobody pays: no production row has shown
F4-F6, and no self-hosted model is a UAT-board row. It becomes real the day a self-hosted
deployment relies on tool use.

Parsing is a capability decision, not a bug fix, which is why 292.1 deliberately stopped at
detect + strip + word (orchestrator ruling 1, 292.1-RESEARCH.md Open Question 1).

## When to surface

- A self-hosted model (ollama / lmstudio / custom) becomes a row of any cross-provider UAT board.
- A production assistant message (or a `text_tool_markup` WARNING in production logs) carries an
  F4, F5 or F6 form.
- Any phase whose `files_modified` names `backend/app/services/text_tool_calls.py`.

## Scope estimate

Small to Medium. Each form needs a parser beside `parse_dsml` under the same rules: the run's
OFFERED tool names are passed in and any name outside them refuses the whole block; arguments are
parsed strictly or the block is refused, never repaired. F6's non-JSON argument syntax is the hard
part and may stay detect-only. No provider-name branch is allowed (D-10): the parsers stay
provider-blind, so a form is parsed whoever emits it.

## Breadcrumbs

- 292.1-RESEARCH.md: "Measured format set (D-06 evidence)" and Open Question 1.
- 292.1-01-SUMMARY.md: `text_tool_calls.py` created (`ed98c6715`), loop wiring (`2d0f3bd0f`,
  `1e76af0a5`).
- The planted F4 test in `backend/tests/unit/test_2921_text_tool_calls.py` asserts the form is
  caught and worded, not executed — a parser for F4 must retire that pin deliberately, with the
  reason written into the test.
