---
id: SEED-033
title: Inline citation & source attribution — grounded vs. general knowledge transparency
status: planted
planted: 2026-05-27
trigger_when: "Next milestone scoping for RAG quality OR user requests citation feature OR competitive audit against Glean/Copilot/Perplexity"
surface: Agentic-RAG
affected_areas: [threads, openai_service, anthropic_service, google_service, StreamsProvider, MessageItem, ToolCallPanel]
origin: "Phase 081 UAT session — user observed Kimi-k2.5 mixed document references into a general-knowledge essay; no visual signal distinguished org-sourced claims from model knowledge"
---

# SEED-033: Inline Citation & Source Attribution

## Context

During Phase 081 UAT, user sent the same general-knowledge prompt ("Write a 2000-word AI history essay") to two threads:
- Thread with tools active: agent called `search_documents`, found user docs that mentioned AI, and wove them into the response alongside general knowledge — no visual distinction between sourced and unsourced claims.
- Thread without tools: model answered purely from its own knowledge — clean essay, no document references.

The user's observation: there's no way to tell which parts of a response came from organizational documents vs. the model's general knowledge. This is a fundamental attribution transparency gap.

## Domain Research (2026-05-27)

Industry converges on a single pattern: **citations ARE the attribution signal**.

### The universal pattern

| Platform | Citation style | Grounded signal | Ungrounded signal |
|----------|---------------|-----------------|-------------------|
| Perplexity | Inline `[1][2]` per-claim, hover shows excerpt | Numbered marker | No marker |
| Google NotebookLM | Inline `[1][2]`, click navigates to source passage | Numbered marker | No marker |
| Glean | Document pill cards below response, deep-linked to exact passage | Pill present | No pill |
| Microsoft Copilot | Citation pills with source links; "Allow ungrounded responses" toggle | Pill present | No pill (or blocked entirely) |
| Vertex AI | `GroundingMetadata` with per-claim `grounding_support` array | API-level segment mapping | Segments without grounding entries |

**No major platform uses explicit "From your docs" / "General knowledge" labels.** The presence or absence of a citation marker is the signal.

### Key findings

- Inline per-claim markers (not footer-only) are the standard
- Mixed-source answers are handled naturally — some sentences get markers, others don't
- **Bad citations damage trust more than no citations** — precision matters
- Users expect citations for factual claims (65% per OpenAI 2024 study) but don't always read them; presence alone shifts trust perception
- Citation hallucination rates of 11-57% across commercial models — implementation must be precise

## Implementation Shape (When Triggered)

### Backend

1. **Chunk-to-response tracking**: When the agent uses `search_documents` results, tag which retrieved chunks informed which parts of the response. Options:
   - Generation-time: instruct the LLM to emit citation markers as it generates (Perplexity approach)
   - Post-hoc: compare response segments against retrieved chunks via semantic similarity (heavier, more reliable)
2. **Citation SSE events**: New event type (e.g., `citation`) or embed citation metadata in the `content` delta events
3. **Citation data model**: `citations` array on the message record — each entry maps a text span to a document_id + chunk reference

### Frontend

1. **Inline citation markers**: Render `[1][2]` superscript badges in MessageItem content
2. **Citation hover/click**: Show source document title, excerpt, confidence score; click navigates to document
3. **Sources card**: Collapsible "Sources" section below the response listing all cited documents (Glean-style pills)
4. **No marker = general knowledge**: This convention is implicit and requires no UI for uncited content

### Agent prompt

- Instruct the agent to mark claims sourced from retrieved documents with `[N]` markers referencing the source
- Provide a citation format spec in the system prompt so all providers emit consistent markers

## Scope Estimate

- Medium-to-large feature: touches streaming pipeline, message schema, agent prompt, and frontend rendering
- Could be phased: Phase A (backend citation tracking + storage), Phase B (frontend rendering + UX)
- Dependencies: stable streaming pipeline (post-075.x), message schema (messages table may need a `citations` JSONB column)

## References

- Perplexity streaming citation parsing: `docs.perplexity.ai/docs/cookbook/articles/streaming-citations`
- Google Vertex AI GroundingMetadata: `cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1beta1/GroundingMetadata`
- Glean deep-linked citations: `developers.glean.com/guides/chat/deep-linked-citations`
- ShapeofAI citations pattern: `shapeof.ai/patterns/citations`
- Microsoft Copilot Studio knowledge sources: `learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio`
- arxiv 2025 — citation hallucination rates: `arxiv.org/pdf/2501.01303`
