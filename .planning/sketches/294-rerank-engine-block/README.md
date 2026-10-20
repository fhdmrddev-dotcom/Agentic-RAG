---
sketch: 294
name: rerank-engine-block
question: "How does the Reranking card show which engine runs, which key it uses, and that text leaves the server?"
winner: "B — engine cards (operator, 2026-10-20)"
tags: [phase-294, dec-01, settings, rerank, egress]
phase: 294
requirements: [DEC-01]
extends: [024-embedding-provider-picker]
---

# Sketch 294: Rerank Engine Block

## Design Question
The existing Reranking card (Enabled · Provider · Model · Top-N · API Key) gains Jev and OpenAI Decisions.
How does it show where each engine runs, which saved key it uses, what it can do, and that passages leave
the server for a hosted engine?

## How to View
open .planning/sketches/294-rerank-engine-block/index.html

## Variants
- **A: Select + always-on footer** — the 024 ProviderPicker pattern; endpoint · model · price · where it runs always visible.
- **B: Engine cards** — four radio cards side by side with key, price, cuts / steering / citation-check.
- **C: Off / On this server / Hosted** — the data decision first, the vendor second.

## State buttons
Reranking off · Keys saved · OpenRouter key missing.

## Fixed in every variant (294-CONTEXT)
One block and one on/off (D-01); saved provider keys reused and never shown (D-02); Jev via OpenRouter only
(D-03); organisation-wide save (D-04); a worded egress notice for hosted engines (D-05); Cohere and local
reorder only (D-08); the citation check needs Jev or OpenAI (D-16).

## What to Look For
- Can you tell, without opening anything, whether your text leaves the server?
- Does the missing-key state read as "won't run, search keeps today's order" rather than as an error?
- Which layout still works when a fifth engine is added?
