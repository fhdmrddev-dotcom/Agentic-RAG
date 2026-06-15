---
seed_id: SEED-076
title: Filtered-vector-search recall + pgvector index strategy at corpus scale (filtered-HNSW recall collapse)
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: scale / performance — RAG retrieval core; an index-and-recall correctness seam on the shared document_chunks table, NOT a new feature
related_seeds: [SEED-001, SEED-005, SEED-004, SEED-020, SEED-048, SEED-065, SEED-077, SEED-081]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, feedback_preserve_engine_optionality, feedback_investigate_with_tools_first]
related_decisions:
  - "Migration 034 (dynamic, dimension-agnostic match_document_chunks) — the predicate-inside-the-HNSW-scan shape lives here (034_dynamic_vector_match.sql:29-33), declared SECURITY DEFINER (:19)"
  - "Migration 002 (BYO retrieval) — the HNSW ANN index document_chunks_embedding_idx WITH (m=16, ef_construction=64) (002_module2_byo_retrieval.sql:35-37); index EXISTS and is well-formed — only filtered-recall TUNING at scale remains"
  - "v3.2 SECDEF-AUDIT-01 (SECURITY DEFINER → INVOKER on match_document_chunks) — the RLS rewrite that would push the tenant predicate into this same scan; this seed is the recall validation that rewrite must run BEFORE it ships"
re_open_triggers:
  - SEED-005 (Enhanced Document Structure — the operator-confirmed NEXT milestone) is scoped: virtual folders + custom-metadata filters make filtered vector search the PRIMARY retrieval path, not an occasional one
  - The v3.2 Multi-Tenancy RLS rewrite reaches plan-phase — RLS predicates push the org/membership filter into the same scan as the HNSW ORDER BY; this seed is a HARD prereq that rewrite must VALIDATE (measure recall under the filtered predicate), not lock in blind
  - A shared install (>1 user, or any org-scoped corpus) accumulates a large document_chunks table where any single user/org owns a small fraction of total rows
  - Production/telemetry or a UAT shows search returning fewer-than-LIMIT results, low-similarity grounding, or "the answer is in a doc but the agent didn't find it" on a populated multi-tenant corpus
  - v3.3 Open Platform exposes retrieval over the API at volume (external consumers issuing filtered queries against the shared table)
  - pgvector is upgraded to 0.8+ (iterative-scan becomes available — a candidate fix lever)
priority: high — the single most product-shaping non-sandbox scale risk; core RAG grounding silently degrades exactly as the platform succeeds, and the gap is invisible in every current single-user UAT. Not load-bearing TODAY (single-operator dev = one user owns the whole table), but a HARD prereq for the next milestone (SEED-005) and the v3.2 RLS rewrite.
suggested_phase: a "Scale Hardening" deliverable co-planned with SEED-005 (filtered search becomes primary) and validated as a GATE inside the v3.2 RLS rewrite. NOT v2.9 — Phase 101 does not touch retrieval.
---

# SEED-076 — Filtered-vector-search recall + pgvector index strategy at corpus scale

## The gap (grounded in current code)

The RAG retrieval RPC `match_document_chunks` applies the per-user (RLS-equivalent)
predicate **inside the same query as the approximate HNSW scan**:

```sql
-- supabase/migrations/034_dynamic_vector_match.sql:21-34
  SELECT dc.id, dc.document_id, dc.content,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.user_id = match_user_id                              -- :29  tenant filter
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold -- :30  threshold filter
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter) -- :31  metadata filter
  ORDER BY dc.embedding <=> query_embedding                      -- :32  HNSW ANN scan
  LIMIT match_count;                                             -- :33  top-N budget
```

The ANN index is real and well-formed — this is **not** a "do we even have an index"
problem (that's closed):

```sql
-- supabase/migrations/002_module2_byo_retrieval.sql:35-37
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

The problem is **filtered recall at scale**. pgvector's HNSW is an *approximate* index
that walks a **fixed candidate budget** (`ef_search`, default 40) through the graph
**before** the `WHERE` predicate is fully resolved. When one user/org owns a small
fraction of a large shared `document_chunks` table, the index hands back its
*global*-nearest candidates, and the `WHERE dc.user_id = match_user_id` / `metadata_filter`
predicates then **discard most of them** — so the `LIMIT match_count` result is silently
**under-filled or low-recall**. The agent gets fewer (or worse) chunks than the corpus
actually contains, with no error and no signal.

What is missing, concretely:

| Lever | Current state | Evidence |
|---|---|---|
| `ef_search` tuning | **None** — no `SET LOCAL hnsw.ef_search = N` anywhere; runs at the default candidate budget regardless of how selective the filter is | grep of `supabase/migrations` + backend → 0 matches for `ef_search` |
| Partial / per-tenant index | **None** — one global HNSW over the whole shared table | only `document_chunks_embedding_idx` exists (002:35-37) |
| Partitioning by tenant | **None** — one shared `document_chunks` table for all users/orgs | schema; the predicate IS the only isolation (034:29) |
| Iterative scan (pgvector 0.8) | **Not used** — would let the scan keep pulling candidates until the filter yields N | no iterative-scan config present |
| Recall test harness | **None** — no synthetic multi-tenant corpus, no recall measurement at any scale | no recall fixtures in the test tree |

Single-operator dev **never** exposes this because **one user IS the whole table** — every
candidate the index returns passes the `user_id` filter, so recall looks perfect. The
defect only appears once the shared table is genuinely multi-tenant.

## Why it matters at the product's target scale

The operator's direction: **this product must serve any scale — a small company on one box
up to multi-thousand-user organizations — with the infrastructure choice left to the buying
company against clear, published requirements.** It is **B2B-first**, with a possible
**lighter hosted multi-tenant SaaS subscription** alongside; the single-VPS plan (Phase 080)
was operator self-testing only, never the product target. (See `project_target_scale` +
SEED-001 / SEED-004.)

Against that vision, filtered-HNSW recall collapse is **the single most product-shaping
non-sandbox scale risk**, because it degrades the **core value proposition (accurate
RAG grounding) silently, exactly as the platform succeeds**:

- **The defect scales *inversely* with success.** The more tenants and documents share one
  install, the smaller each tenant's fraction of the table, the worse filtered recall gets —
  and there is no error, just quietly-worse answers ("the answer is in a doc but the agent
  didn't find it").
- **It is invisible in every current UAT.** All grounding/accuracy testing runs single-user,
  where recall is trivially perfect. The failure mode cannot reproduce until the table is
  multi-tenant — so it will surface in production, at a customer, after success.
- **SEED-005 (the operator-confirmed NEXT milestone) makes the bad path the PRIMARY path.**
  Enhanced Document Structure adds virtual folders + custom-metadata filters; once retrieval
  is routinely *filtered* (folder-scoped, metadata-scoped), the `metadata_filter @>` /
  scoped predicate runs on every query — turning an occasional risk into the default.
- **The v3.2 RLS rewrite would lock the bad pattern in blind.** v3.2 rewrites the
  `user_id` predicate to a membership/org predicate across the 18 org-scoped tables and
  flips `match_document_chunks` from SECURITY DEFINER to INVOKER (SECDEF-AUDIT-01) — pushing
  an even more selective tenant filter into the *same* scan. If that rewrite ships without
  ever **measuring** recall under the filtered predicate, it bakes the collapse into the
  multi-tenant foundation permanently.
- **No published retrieval-sizing requirement is possible** without measuring this, which the
  "infra against published requirements" promise (SEED-003) ultimately needs.

## Why it is deferred / not now

- **Phase 101 does not touch retrieval at all** — template-fill (`render_template`) is a
  sandbox concern; this seam is entirely independent of v2.9.
- **It is correct and fast today** for the single-operator / single-tenant reality. There is
  no live defect to fix yet — only a latent one that materializes with multi-tenant scale.
- **The right home is co-planned with the milestones that activate it**, not bolted on
  speculatively: SEED-005 (filtered search becomes primary) and the v3.2 RLS rewrite (which
  must run the recall validation as a gate). Fixing it before either is scoped risks tuning
  against a corpus shape that doesn't yet exist.
- **`feedback_investigate_with_tools_first`:** the fix must start from a *measured* recall
  curve on a realistic synthetic corpus, not from an assumed root cause — so a test harness
  is step one, not a band-aid `ef_search` bump.

## Likely shape if promoted

Co-plan with SEED-005 and gate inside the v3.2 RLS rewrite. Candidate scope, ordered:

1. **Recall test harness first (measure, don't guess).** Build a synthetic multi-tenant
   corpus (millions of chunks across hundreds of users/orgs, each owning a varying fraction)
   and a recall@k harness comparing filtered-HNSW results against an exact (brute-force)
   k-NN baseline. Every lever below is chosen against *this* curve, not an estimate.
2. **`ef_search` tuning + selectivity awareness.** `SET LOCAL hnsw.ef_search = N` scaled to
   how selective the tenant/metadata filter is (a tenant owning 0.1% of the table needs a far
   larger candidate budget than one owning 50%). Cheapest first lever; bounded by the
   latency/recall trade the harness reveals.
3. **Iterative scan (pgvector 0.8+).** Let the scan keep pulling candidates until the filter
   yields `match_count` (relaxed/strict order), instead of a fixed pre-filter budget — the
   purpose-built pgvector answer to filtered recall. Gated on the pgvector version the deploy
   targets ship.
4. **Partial / per-tenant index vs partitioning.** For large tenants, partial HNSW indexes or
   table partitioning by tenant so each tenant's scan is over its own rows — evaluated against
   the index-bloat / maintenance cost the harness and SEED-001 connection budget expose.
5. **The v3.2 validation gate.** The RLS rewrite (SECDEF-AUDIT-01, membership predicate) MUST
   re-run the harness against the *rewritten* predicate and prove recall holds before it
   ships — this seed is the gate, not a follow-up.
6. **Published retrieval-sizing requirement.** Feed the measured curve into SEED-003's
   per-tier requirements matrix (expected corpus size / tenant skew → recommended `ef_search`,
   index strategy, pgvector version) so the buying company can size against real numbers.

## Deliberately NOT in scope (when it lands)

Replacing pgvector / Postgres with a dedicated vector DB (the index exists and is sound — this
is tuning + filtered-recall strategy, not a re-platform); re-opening embedding-model /
re-ranker / hybrid-search quality (that's SEED-020's retrieval-quality audit — orthogonal);
the embeddings single-provider SPOF (SEED-048); premature partitioning before step-1 telemetry
proves which tenant skew actually collapses recall; building the multi-tenant org model itself
(SEED-004 / v3.2 owns that — this seed *validates recall on top of* it).

## Relationship to sibling seeds (the scale cluster)

- **SEED-001** (scale readiness) — app/SSE/worker/connection-pool concurrency. This seed is
  its **retrieval-core sibling**: same "silently degrades as you succeed" theme, the RAG
  query path instead of the connection/SSE path. The recall curve also feeds SEED-001's
  connection-budget math (a larger `ef_search` / iterative scan costs more per query).
- **SEED-077** (durable ingestion job queue at scale) — its **write-side counterpart**: 077
  is "can we get millions of chunks INTO the shared table reliably"; 076 is "once they're in,
  can a filtered query still FIND the right ones." Both are HARD prereqs for SEED-005 bulk
  onboarding and surface only under multi-tenant load.
- **SEED-081** (provider rate-limit resilience + fan-out admission control) — the third member
  of the silent-scale cluster (provider availability under shared keys). 076 / 077 / 081
  together are the datastore-and-provider scale-readiness family that single-user dev cannot
  expose; all three plus SEED-001 / SEED-065 are the "Scale Hardening" candidate milestone.
- **SEED-065** (load degradation / Redis timeout) — adjacent datastore-scaling concern (Redis
  stream growth + pool sizing); co-plans naturally into the same datastore-sizing artifact.
- **SEED-004** (org multi-tenancy) — provides the org/membership model the v3.2 RLS rewrite
  keys against; that rewrite is the moment this seed's gate (step 5) must fire.
- **SEED-005** (Enhanced Document Structure — NEXT milestone) — makes filtered search the
  PRIMARY path (virtual folders + metadata filters), promoting this from latent to active.
- **SEED-020** (retrieval quality audit) — *orthogonal*: embedding model / re-ranker / hybrid.
  This seed is index-filter recall, the layer underneath; do not conflate.

## Links

`supabase/migrations/034_dynamic_vector_match.sql:21-34` (the predicate-inside-the-scan RPC) ·
`supabase/migrations/002_module2_byo_retrieval.sql:35-37` (the HNSW ANN index — exists, sound) ·
v3.2 RLS rewrite SECDEF-AUDIT-01 (`match_document_chunks` SECURITY DEFINER → INVOKER — the gate moment) ·
SEED-001 · SEED-004 · SEED-005 · SEED-020 · SEED-048 · SEED-065 · SEED-077 · SEED-081 ·
investigation: future-milestone alignment sweep, workflow `wf_13ed5033`

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. Surfaced by the Scale & Performance hunter as the single most product-shaping non-sandbox scale risk: `match_document_chunks` runs the tenant/metadata filter inside the same query as the approximate HNSW `ORDER BY ... LIMIT`, so on a large shared table where each user/org owns a small fraction, filtered recall silently collapses. The index itself is sound; the gap is `ef_search` tuning / iterative scan / per-tenant index strategy + a recall test harness. Invisible in single-user dev (one user IS the table), it is a HARD prereq the v3.2 RLS rewrite must validate and the path SEED-005 makes primary.*
