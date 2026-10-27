# Phase 294 intake research (2026-10-20)

The operator shared a video demo of an Agentic RAG app using Jev as a "System One" decision model. It covered steerable reranking, a citation check and model routing. This file records what was measured and read at intake. **Re-verify every figure at discuss**: these are third-party and vendor claims.

## What the tree already has (measured 2026-10-20)

- `backend/app/services/rerank_service.py` (122 lines): providers `api`/`cohere` and `local` (sentence-transformers `CrossEncoder`, lazy singleton). `@traceable`. Falls back to the original order on any error.
- Called once, from `retrieval_service.py:159-166` (via `run_in_threadpool`, SEED-065), after RRF fusion and dedup.
- Settings: `config.py:1238-1243` (`rerank_enabled=False`, `rerank_provider="api"`, `rerank_api_key`, `rerank_model="rerank-v3.5"`, `rerank_top_n=5`), mirrored in `user_settings.py:202-207` / `:1118-1122`, and present in `SettingsPage.tsx` / `ProviderPicker.tsx`.
- Citations: `citation_markers.py` checks marker STRUCTURE only (drops out-of-range `[n]`). Nothing checks whether a cited source supports the sentence.
- No automatic model routing exists.
- OpenAI SDK installed: `2.28.0`.

## Engines

| | Jev (TypeSafe) | OpenAI Decisions | Local |
|---|---|---|---|
| Endpoint | OpenRouter `POST /api/alpha/decisions` (`typesafe/jev-1.14`, alias `~typesafe/jev-latest`); or TypeSafe direct | `POST /v1/decisions`, model `gpt-6-luna`, public beta | in-process |
| Question types | `choice`, `score`, `noul` (yes-probability), `box` (images) | `predicate`, `choice`, `score`; any answer may be `refusal` | n/a (reranker) |
| Price | $0.042 / 1M input, output free | $0.10 / 1M input, output free | free |
| Limits | about 32k tokens state+question (TypeSafe); about 30-50 passages per call | 1-200 questions per request | RAM |
| Data | hosted, text leaves our servers | ZDR / HIPAA for eligible customers; US and EU residency | stays local |

## Findings that should shape the design

1. **Per-document `noul`, split across concurrent calls**, gives absolute probabilities that compare across calls (jev-rerank: score >= 0.9 relevant 76% of the time, < 0.1 relevant 0.5%). p50 about 0.2 s for 30 documents.
2. **A listwise `choice` over the whole pool** ranked better in one test (recall@1 0.94 vs 0.87 on 200 LoCoMo questions) with far fewer calls. However, its scores are **normalised ranks, not relevance**, so an absolute floor filters by position only.
3. **Pruning has a measured cost:** one team kept about 1.6 of 30 candidates and lost 19% of the right evidence. A "none relevant" option won outright on hard queries (35 of 200 empty). Ship a conservative threshold, and never return an empty set.
4. **OpenAI `choice` probabilities shifted by up to 15 points when option order was reversed** (community test, anecdotal). The selected option did not change.
5. **Local:** Qwen3-Reranker (0.6B / 4B / 8B, takes an instruction, needs its own loader) or bge-reranker-v2-m3 (Apache-2.0, works with `CrossEncoder` directly). Jina v2 weights are CC-BY-NC.

## Deferred (Future Requirements in REQUIREMENTS.md)

- Model routing: simple turns to a cheaper model. Needs the full roster and touches the per-request model path (see SEED-362).
- Chunk tagging at ingestion (table of contents, footer, signature, personal data), through `ingest_splice.py`.

## Sources

- https://openrouter.ai/blog/insights/what-is-jev/
- https://github.com/hev/jev-rerank
- https://hindsight.vectorize.io/blog/2026/09/24/adding-jev-reranker-what-we-learned
- https://developers.openai.com/api/docs/guides/decisions
- https://community.openai.com/t/decisions-api-is-now-available-in-public-beta/1403877
- https://community.openai.com/t/results-from-toy-experiments-with-decisions-api/1404010
- https://huggingface.co/blog/a2aprotocol/openai-decisions-api-vs-jev-a-practical-guide
- https://presenc.ai/research/best-open-weight-reranker-models-2026
