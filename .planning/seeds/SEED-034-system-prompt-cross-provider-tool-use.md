---
id: SEED-034
title: System Prompt Revision for Cross-Provider Tool Use Quality
status: planted
planted: 2026-05-27
planted_by: operator
trigger_when: v2.7 milestone planning — scope as a dedicated phase
priority: medium
tags: [system-prompt, tool-use, cross-provider, RAG]
---

# SEED-034: System Prompt Revision for Cross-Provider Tool Use Quality

## Problem

The current system prompt was tuned for OpenAI and Anthropic models which have strong native tool-calling capabilities. Weaker tool-use models (DeepSeek, Kimi/Moonshot, GLM) struggle with basic hybrid search queries like "who owns DOC0002" from an uploaded CSV — they don't reliably invoke `search_documents` or `query_tables` before answering.

## Observed gap

- OpenAI (gpt-5.4) and Anthropic (claude-sonnet-4-6) correctly use hybrid search tools to answer factual document questions
- DeepSeek, Kimi, GLM sometimes answer from training data instead of searching the knowledge base
- The system prompt doesn't explicitly instruct "always search the knowledge base before answering factual questions about documents"

## Proposed scope

- Review and revise the system prompt at `backend/app/services/openai_service.py` (GENERAL_SYSTEM_PROMPT / EXPLORER_SYSTEM_PROMPT)
- Add explicit tool-use guidance: "For any question about documents, files, or uploaded content, ALWAYS use search_documents or query_tables before answering"
- Consider per-provider system prompt variations if needed (some models need more hand-holding)
- Cross-provider UAT: test the same 5 factual queries across all 9 providers, verify tool invocation happens consistently
- May also touch the tool descriptions to be more explicit about when each tool should be used

## Why it matters

Users switching between providers expect consistent behavior. If DeepSeek can't answer "who owns DOC0002" but Claude can, the multi-provider value proposition breaks down.

## Trigger

Scope as a dedicated phase in v2.7 milestone planning. Pairs well with any system prompt or agent behavior work.
