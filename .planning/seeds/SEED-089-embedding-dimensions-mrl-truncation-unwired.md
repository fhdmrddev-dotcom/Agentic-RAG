---
seed_id: SEED-089
title: Wire configured embedding_dimensions into the embed call (MRL truncation) — or drop the "dimensions= truncation: YES" preset claim
status: planted
planted: 2026-06-17
phase_origin: "Phase 111.1 verify-work conversation (2026-06-17) — live cross-provider embedding UAT (operator: 'you do it' + 'test Google'). Driving the app's real embed_texts against Google gemini-embedding-001 returned native 3072-d, revealing embed_texts never forwards the configured embedding_dimensions to the provider."
category: Embedding pipeline correctness — small additive fix to the single embed call boundary; NOT a re-platform of the embedder path
related_seeds: [SEED-048, SEED-088, SEED-087]
related_memories: [project_embeddings_openai_spof, feedback_prioritize_newest_models, feedback_preserve_engine_optionality, feedback_separate_per_feature_safe_by_construction]
related_decisions:
  - "Phase 111.1 (D-08): shipped zero-config default STAYS text-embedding-3-small / 1536. That model is 1536-NATIVE, so the unwired dimensions= param does not affect the default path — which is why all 6 EMBED reqs still pass despite this gap."
  - "111.1-PROVIDER-PRESETS.md lists 'dimensions= truncation: YES (MRL)' for openai-3-*, google gemini-embedding-*, and jina — a capability the embed call does not currently exercise."
re_open_triggers:
  - An operator selects a non-1536-native model (e.g. OpenAI text-embedding-3-large @ 3072, Google gemini-embedding-001 @ 3072) AND sets embedding_dimensions to a smaller value expecting MRL truncation — the returned vectors will be native-dim, mismatching the resized vector column → chunk INSERT dimension error.
  - Anyone tries to use the "openai (quality) text-embedding-3-large" preset at a reduced dimension to control re-embed cost / index size.
  - The pre-production comprehensive review (model/embedding management is on that list).
  - SEED-088 (dynamic model registry) is implemented — capability-aware embedding config is adjacent and a natural co-fix.
priority: MINOR / non-blocking — the shipped OpenAI-1536 default and native-dim local (Ollama 768) / Google (3072) paths all work and were live-proven in 111.1 verify-work. This is a latent correctness gap for the non-default MRL path + a docs-vs-impl mismatch.
suggested_phase: a /gsd:fast or /gsd:quick (≈1-3 line change at one call boundary) — or fold into SEED-088's capability work.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-089 — embedding_dimensions / MRL truncation is not wired into the embed call

## The finding (live, Phase 111.1 verify-work 2026-06-17)

`backend/app/services/openai_service.py:1480` — `embed_texts()` calls:

```python
response = client.embeddings.create(model=effective_model, input=texts)
```

It never passes the optional OpenAI `dimensions=` argument. So the configured
`user_settings.embedding_dimensions` is used ONLY to (a) size/resize the `document_chunks.embedding`
vector column and (b) tag each chunk (D-10) — it is **never sent to the provider**. The provider
returns its model's NATIVE dimension regardless.

**Live evidence:** driving `embed_texts` against Google `gemini-embedding-001` (a model documented
as MRL-truncatable to 768/1536/3072) returned **3072-d** vectors — the native size, not a configured
1536. (OpenAI `text-embedding-3-small` happens to be 1536-native, which is why the shipped default
silently "works" and masked this.)

## Why it matters

1. **Docs-vs-impl mismatch:** `111.1-PROVIDER-PRESETS.md` advertises `dimensions= truncation: YES (MRL)`
   for openai-3-*, google gemini-embedding-*, and jina. The embed call does not implement it.
2. **Latent INSERT failure:** if an operator picks a non-1536-native model and sets
   `embedding_dimensions` to anything other than that model's native output, the resized
   `vector(N)` column will reject the returned native-dim vectors (dimension mismatch) on chunk insert.
3. **No cost/size control on MRL models:** the whole point of MRL is to trade a smaller vector
   (cheaper index, faster search) for a little recall. Today you can only get a model's native dim.

## Why it is NOT blocking 111.1

- Default path = OpenAI `text-embedding-3-small` (1536-native) → no `dimensions=` needed, works.
- Local (Ollama nomic 768) and Google (3072) were live-proven at their NATIVE dims in 111.1 verify-work.
- All 6 EMBED requirements (EMBED-01..06) pass; this is the non-default MRL path only.

## The fix (small, single boundary)

Forward the configured dimension when the target model/provider supports MRL truncation:

```python
kwargs = {"model": effective_model, "input": texts}
dims = (user_settings.embedding_dimensions if user_settings else None)
if dims and _model_supports_mrl(effective_model):   # openai text-embedding-3-*, google gemini-embedding-*, jina-v3/v4
    kwargs["dimensions"] = dims
response = client.embeddings.create(**kwargs)
```

Guard providers/models that reject `dimensions=` (don't send it to them). **Alternative if not
worth wiring:** drop the MRL claim from `PROVIDER-PRESETS.md` and document native-dims-only, so the
preset table stops promising a capability the code doesn't deliver.

## Pointers
- Call site: `backend/app/services/openai_service.py:1473-1484` (`embed_texts`).
- Same boundary is used by both ingest (`embed_chunks`) and query (`retrieval_service`) and the
  re-embed job (`reembed_service.embed_texts`), so a single fix covers all three paths.
- Preset capability table: `.planning/phases/111.1-*/111.1-PROVIDER-PRESETS.md`.
- Recorded in: `.planning/phases/111.1-*/111.1-HUMAN-UAT.md` Gaps section.
