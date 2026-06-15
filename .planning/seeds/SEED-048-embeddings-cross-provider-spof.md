---
id: SEED-048
title: Document search is a cross-provider single point of failure — embeddings hardwired to OpenAI with no fallback
status: planted
planted: 2026-06-01
planted_by: orchestrator (092.5-06 FINAL PROOF GATE — BLOCK triage)
trigger_when: a resilience/availability hardening pass on retrieval, OR the next time an OpenAI outage blocks cross-provider work (incl. the 092.5-06 gate re-run), OR a milestone that promises provider independence / production SLA
priority: medium
tags: [backend/retrieval, embeddings, resilience, cross-provider, openai, ingestion, production-scale]
---

# SEED-048: Embeddings Cross-Provider Single Point of Failure

## Context (how it surfaced)

The 092.5-06 FINAL PROOF GATE (`capture_sse_baseline.py --mode after`) returned
`SSE_DIFF_RESULT: BLOCK` on ALL 7 native providers. An 8-agent adversarial workflow
(`wf_b45e948c-45a`, ~561K tokens) proved the BLOCK was **100% environmental, not a gateway
regression**: the OpenAI account hit `429 insufficient_quota` (billing exhausted), and that
took down `search_documents` for **every** chat provider — because document retrieval's
embedding call is hardwired to OpenAI.

## The defect

`search_documents` → `retrieval_service.py:36` (`_vector_search`) → `openai_service.embed_texts`
→ `embed_texts` (`openai_service.py:1288`, via `get_embedding_client` `:906-929`) constructs a
raw `openai.OpenAI` client and calls `client.embeddings.create()` with:

- **no try/except**,
- **no alternate provider / no fallback**,
- **no dependence on the active CHAT provider** — embeddings follow their own `embedding_*`
  settings (default `text-embedding-3-small`, 1536 dims).

So when ANY of the native-7 chat providers is selected, the chat LLM streams fine, but the
first `search_documents` call still hits OpenAI embeddings → an OpenAI outage throws unguarded
→ search fails for all of them. In the hybrid path, `_keyword_search` (pure Supabase,
OpenAI-free) runs AFTER `_vector_search`, so it cannot rescue the call; the vector-only path
has no keyword leg at all.

**Blast radius is wider than chat search:** the SAME `embed_texts` path is used at document
**ingestion** (`embedding_service.py:97`, `multimodal_service.py:496`), so during an OpenAI
outage new uploads also fail to embed. (Rerank is NOT affected — it routes to Cohere/local
with an error-swallowing fallback and is off by default.)

This is directly at odds with the project posture: "keep ALL native-7 integrated, route each
provider to the feature it fits best" and "targets production at organizational scale". A
single provider's billing lapse silently breaks the platform's core RAG grounding for users
who never selected that provider.

## Why deferred (out of scope for 092.5)

092.5 is a **byte-identical** provider-gateway refactor (chat-stream dispatch). The embeddings
SPOF is **pre-existing and identical before/after** the extraction — fixing it here would
violate the phase's red line (never change behaviour). It does NOT block closing 092.5; the
gate just needs a re-run once OpenAI credits are restored.

## Likely shape if promoted

1. **Wrap `embed_texts` in fail-soft handling** so a provider 429/5xx surfaces as a graceful
   "search temporarily unavailable" tool result (the agent already falls back to
   grep/read_document — make that path intentional, not accidental), instead of an unguarded throw.
2. **Optional embedding-provider fallback / selector.** Non-trivial: stored chunk vectors are
   **dimension-locked to 1536** (`text-embedding-3-small`), so a hot fallback needs a
   dimension-matched alternate (e.g. another OpenAI-compatible 1536-dim endpoint, or a parallel
   index). Cheapest first cut: a second OpenAI-compatible embeddings key/base_url that can be
   swapped without re-indexing.
3. **Ingestion resilience:** queue/retry embeddings on provider outage rather than failing the upload.
4. **Observability:** distinguish "embeddings down" from "no results" in the tool result so the
   agent (and logs) can tell a quota outage from an empty corpus.

## Re-open trigger (concrete)

- Immediately relevant: the **092.5-06 gate re-run** depends on OpenAI embeddings being healthy.
  If OpenAI quota is a recurring blocker for cross-provider verification, pull this forward.
- Otherwise fold into the first retrieval/resilience hardening phase, or any milestone that
  markets provider independence or a production availability SLA.
