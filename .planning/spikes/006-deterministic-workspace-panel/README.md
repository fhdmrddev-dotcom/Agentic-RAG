---
spike: 006
name: deterministic-workspace-panel
validates: "Given real cross-provider runs, when the panel is derived from the tool-call activity stream with a smart gate, then simple chats stay clean and multi-step work (incl. providers that never call write_todos) populates naturally + semantically"
verdict: VALIDATED
related: [007]
tags: [cross-provider, workspace-panel, todos, deterministic, smart-gate, phase-095, pre-096]
---

# Spike 006: Deterministic Workspace-Panel Population

## What This Validates
Given the REAL tool-call sequences from live runs (OpenAI which called write_todos,
Anthropic which never did, Google which failed) + synthetic clean cases, when the
panel is filled by a **deterministic smart gate + activity-derivation** (no reliance
on the model voluntarily calling write_todos), then:
- simple Q&A / single-lookup / failed runs stay **clean** (no forced panel), and
- multi-step work **populates naturally and semantically — for every provider**,
  including Anthropic which only emitted `execute_code` (no write_todos).

## How to Run
```
python .planning/spikes/006-deterministic-workspace-panel/spike.py
```

## What to Expect
7/7 checks PASS; the Anthropic-derived panel matches the OpenAI write_todos plan
nearly word-for-word.

## Results
**VERDICT: VALIDATED (7/7 checks).**

| Fixture | Gate | Panel source | Result |
|---|---|---|---|
| openai-3step (called write_todos) | populate | write_todos (honored) | 3 items ✓ |
| anthropic-3step (NO write_todos) | populate | **activity-derived** | 3 **semantic** items ✓ |
| google-failed (0 tools, failed) | clean | — | no panel ✓ |
| simple-qa (0 tools) | clean | — | no panel ✓ |
| single-search (1 tool) | clean | — | no panel ✓ |

**Key discoveries:**
1. **`execute_code` already carries a `description` field** the model populates
   ("Print numbers 1 to 30", "Create a CSV…") — so activity-derivation is
   *semantically rich*, not just raw tool names. The Anthropic derived panel is
   nearly identical to the OpenAI write_todos plan.
2. **The smart gate is naturally implicit in activity**: 0-tool Q&A and 1-tool
   lookups never trigger a panel; ≥2 meaningful steps (or an explicit write_todos)
   do. No model-behavior dependence, no forcing.
3. **Honor-then-derive precedence works**: when the model *does* call write_todos,
   use it (richest); otherwise derive from activity. Best of both, all providers.

**Signal for the build:** Approach (A) activity-derivation + smart gate is the
primary mechanism — deterministic, provider-independent, zero added cost/latency.
The dedicated planner sub-agent (B) is NOT required for the common case; defer it
(only useful for showing a plan UPFRONT before the first tool, or for tool calls
that lack a description — see spike 007). Honors the per-provider gateway
separation: this lives on the shared SSE-activity layer, no per-model rules.

**Caveat probed by spike 007:** label quality depends on `execute_code.description`
being present. The OpenAI run's `execute_code` calls had `description: null` (it
relied on write_todos instead) — so the derive path needs a graceful fallback.
