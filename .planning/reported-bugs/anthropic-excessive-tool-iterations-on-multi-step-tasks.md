---
id: BUG-260523-04
title: Anthropic agent runs 15+ tool iterations on prompts that completed in 4-6 iterations on other providers
reported: 2026-05-23
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [backend/agent-loop, anthropic, system-prompt, tool-results]
folded_into: null
related_seeds: []
re_open_trigger: "Phase 075.4 E2E scenario 6 (cross-provider iteration-count parity) surfaces the magnitude; root-cause fix needs LangSmith trace data Plans 03/05 unlock. Re-open as a focused investigation phase after 075.4 ships."
reproduces_on:
  branch: v2.5-dev
  commit: 46e8a63
  date: 2026-05-23
---

# BUG-260523-04: Anthropic loops through >15 tool calls on prompts that OpenAI completes in ~4

## What we observed

Same "search Fahed Mrad dissertation, make a professional pptx" prompt run against representative models from each provider:

| Provider     | Iterations | Wall clock | Final artifact |
|---|---|---|---|
| OpenAI gpt-4.1 | ~4 tools | 78s  | one pptx, good charts |
| Anthropic claude-opus-4-6 | "22 tools" reported, >15 iterations | 504s | one pptx, but took 8+ min |
| OpenRouter minimax-m2.7 | 13 tools | 510s | two pptx (see BUG-260523-03) |

DB-confirmed (`runs` rows, 2026-05-23):
- OpenAI: 78s, completed, 51k input / 3.5k output tokens
- Anthropic claude-opus-4-6: 504s, completed, 109k input / 26k output tokens
- OpenRouter minimax-m2.7: 510s, completed, 516k input / 32k output tokens

Anthropic's iteration count is ~5× OpenAI's on the same task. The Anthropic-specific transcript user shared shows many "Searching documents", "Searching file contents", and intermediate "Reading skill file" steps that OpenAI/Gemini-2.5-pro did not perform.

## Why it matters

User-facing: an 8-minute wait on a task that completes in 78s on a different provider is a degraded experience. Even though it eventually succeeds, the cost (tokens) and time (wall clock) are an order of magnitude worse.

The token cost differential is real: 109k input tokens on Anthropic vs 51k on OpenAI for the same prompt. If user-facing billing reflects this, the user is paying 2× for a slower outcome.

## Hypothesized cause

Several candidates, ordered by likelihood:

1. **Tool-result formatting Anthropic-specific drift.** Anthropic's native tool-use format encodes tool results as `tool_result` content blocks. If our backend serializes results in a slightly different shape than Anthropic expects (e.g., wrapping in a `text` block instead of a structured `tool_result` block, or stringifying nested JSON), Claude may not "see" the result clearly and try the same tool again with slight variations. Anthropic SDK is sensitive to the exact shape.
2. **System prompt drift.** A recent change to the system prompt (any of Phase 068.5 / 075 / 075.x) may have added agent-loop guidance that's especially open-ended for Claude (which tends to be more thorough/deliberative than GPT-4.1).
3. **Sub-agent recursion.** Anthropic transcripts show "Sub-agent: claude-haiku-4-5-20251001" calls that may not exit cleanly — if the sub-agent's tool results are nested back into the main loop's context without summarization, the main loop sees them as fresh tool calls and re-issues queries.
4. **`pptx` skill loading.** Anthropic transcripts show explicit "Loading skill 'pptx'" + "Reading skill file 'python-pptx-guide.md'" steps. If the skill-loading path returns a long guide that Claude then quotes / re-reads, that inflates iteration count without producing new outputs.

## Suggested investigation steps

1. Pull the LangSmith trace for the Anthropic 504s run and count tool calls by type (`query_documents`, `execute_code`, `read_skill`, etc.) — find the tool that's getting called the most.
2. Diff the assistant-message shape we send back to Anthropic vs what the Anthropic SDK examples send (especially `tool_result` block structure).
3. Compare the system prompt active during this run vs the one used in earlier successful Anthropic runs (git blame the system-prompt module).
4. If pptx skill is implicated, decide whether to inline-cache the guide or summarize it before passing to Claude.

## Why "minor" severity

The run still completes successfully and produces a usable artifact. It's slow + expensive, not broken. Promote to major if (a) token cost becomes a billing concern, OR (b) iteration count starts hitting the agent-loop iteration cap and runs die mid-flight.

## Related

- BUG-260523-03 (OpenRouter duplicate output) — different provider, but same pattern of "loop runs too long, intermediate state leaks into final output"
- Phase 067.x / 075.x agent-loop changes — candidate origin
