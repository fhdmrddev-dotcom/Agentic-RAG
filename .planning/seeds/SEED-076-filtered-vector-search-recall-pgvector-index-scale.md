---
seed_id: SEED-076
title: Filtered-vector-search recall + pgvector index strategy at corpus scale (filtered-HNSW recall collapse)
status: shipped
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partially-shipped     # ⚠ NOT `closed`. Levers 1-3 and 5-adjacent shipped at Phase 241; lever 4 stays deferred with a NEW trigger below.

  The prose that followed the token, byte-for-byte:
  # ⚠ NOT `closed`. Levers 1-3 and 5-adjacent shipped at Phase 241; lever 4 stays deferred with a NEW trigger below.

  Mapped `partially-shipped` -> `shipped` + `partial: true`. Reason: D-16.
folded_into: 241
answered: 2026-09-10
answered_by: "Phase 241 (QUEUE-06) — .planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md"
re_open_trigger_after_241: >
  Lever 4 (per-tenant partial indexes / table partitioning) re-opens ONLY when a measured install
  shows `hnsw.ef_search` + `hnsw.iterative_scan` insufficient at its own tenant skew, or when a
  corpus materially larger than the 100,000 chunks Phase 241 measured is benched and the curve no
  longer reaches recall@k = 1.000. ⛔ It did NOT fire at 241: `ef_search = 200` reached 1.000 at
  every measured selectivity (0.2% / 2% / 20%). Re-run `scripts/measure-recall.py` before
  proposing partitioning — the seed's own §1 says every lever is chosen against the curve, never
  against an estimate, and that instruction is now backed by a tool.
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
surface: Agentic-RAG
trigger_when: unset
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

---

## ✅ ANSWERED 2026-09-10 — Phase 241 (QUEUE-06). Where each of the four levers went.

⚠ **`status:` is `partially-shipped`, NOT `closed`, and the distinction is load-bearing.** Three of
this seed's levers shipped; one is still deferred and now carries a **measured** re-open trigger
instead of a predicted one. Full verdict, with every number citing its JSON report:
`.planning/phases/241-recall-at-corpus-scale/241-VALIDATION.md`.

### ⭐ The seed's central prediction was CORRECT, and it is now measured rather than argued

> *"on a large shared table where each user/org owns a small fraction, filtered recall silently
> collapses"*

Measured on a 100,000-chunk bench, `k = 20`, 25 query vectors, seed 241, at the shipped
`hnsw.ef_search = 40`:

| Tenant share of corpus | `recall@20` | `underfill` |
|---|---|---|
| 0.2% | **0.040** | **0.960** |
| 2% | **0.068** | **0.932** |
| 20% | **0.360** | **0.588** |

**Even a tenant owning a fifth of the corpus loses ~64% of the right answers.** The user-facing
symptom was measured too: the ten evaluation probes score `Hit@1 0.78` at 7,959 chunks and
**`0.44`** at 100,000 — three named documents stop being found, silently, with a *faster* response.

### Lever-by-lever

| # | Lever | Disposition at Phase 241 |
|---|---|---|
| 1 | **Recall test harness first** | ✅ **SHIPPED.** `backend/app/services/recall_eval.py` + `scripts/measure-recall.py` — two layers (mechanical `recall@k`/`underfill` vs a forced-exact arm; semantic probes scored honestly), `--dsn`-driven so one command serves local and cloud, and it **exits non-zero and writes no report** when it cannot honestly measure. ⚠ The harness that existed before this (Phase 230) ran `content ILIKE`, never touched the vector path, scored every miss `rank = 1` and printed **`MRR 1.000`** — it was replaced in place, not extended. |
| 2 | **`ef_search` tuning + selectivity awareness** | ✅ **SHIPPED as a PRODUCT SETTING**, not a constant: `app_settings.hnsw_ef_search` (migration 176, bounded 10..1000), applied per request with `SET LOCAL` inside the transaction `get_user_pg_connection` already opens, surfaced on the Settings → Retrieval card. **It is the primary lever and it is cheap:** `ef_search = 200` reaches `recall@20 = 1.000` at all three selectivities. |
| 3 | **Iterative scan (pgvector 0.8+)** | ✅ **SHIPPED as a setting** (`app_settings.hnsw_iterative_scan`: `off` / `strict_order` / `relaxed_order`), applied in its own `try` so an older server degrades the *tuning* and never the *search*. **Cloud pgvector parity was VERIFIED LIVE before it was claimed** — cloud is **0.8.0 / PG 17.6**, exact parity with local, so it is available in production. ⚠⚠ **BUT SEE THE CORRECTION BELOW — this seed's ordering of levers 2 and 3 is REFUTED.** |
| 4 | **Partial / per-tenant index vs partitioning** | ⛔ **STILL DEFERRED, and its trigger did NOT fire.** This seed's own §1 says every lever is chosen against the curve; the curve now exists and shows levers 2+3 sufficient at the measured skew. The new, measured re-open trigger is in this file's frontmatter. |
| 5 | **The v3.2 RLS-rewrite validation gate** | ➖ **Moot as written** — that rewrite shipped long ago. What this lever actually asked for (a harness that can validate recall against the *current* predicate) is lever 1, and it is now built. `match_document_chunks`'s **seven** predicates were measured, not assumed. |
| 6 | **Published retrieval-sizing requirement (SEED-003)** | 🟡 **Partially served.** `241-VALIDATION.md` publishes the measured per-chunk storage basis (**≈16.6 KB heap + ≈8.0 KB HNSW ≈ 24.6 KB/chunk**) and the selectivity→recall curve. It does **not** publish a per-tier matrix; that stays SEED-003's. |

### ⚠⚠ THIS SEED'S LEVER ORDERING IS REFUTED BY MEASUREMENT — and the original text is left above rather than edited

§3 calls iterative scan *"the purpose-built pgvector answer to filtered recall"*, which reads as
*the* remedy with `ef_search` as the cheap warm-up. **Measured, that is backwards.** At the shipped
`ef_search = 40`, `iterative_scan = relaxed_order` **alone** lifts recall to only:

| Tenant share | `relaxed_order` alone | `ef_search = 200` alone |
|---|---|---|
| 0.2% | 0.494 (13 of 25 query vectors still under-filled) | **1.000** |
| 2% | 0.564 (12 of 25) | **1.000** |
| 20% | 0.684 (11 of 25) | **1.000** |

**`ef_search` is the lever; `iterative_scan` is the companion.** A phase that had bet on iterative
scan as *the* fix would have shipped an insufficient remedy onto a fully capable server.
⚠ The ceiling is *probably* `hnsw.max_scan_tuples = 20000` / `hnsw.scan_mem_multiplier = 1.0`,
which are hardcoded in `config.py` by design (a wrong value there is a memory footgun, not a tuning
choice) and were **not varied** — that is a hypothesis, not a measurement.

### ⚠ A second measured surprise: the curve is NOT monotone

`ef_search = 1000` (pgvector's maximum) is **reproducibly worse** than `400`: recall 1.000 → 0.926
at the 0.2% and 2% tenants. It is **bimodal** — 23 of 25 query vectors perfect, two returning 1 and
2 rows out of 20 — and a full re-run reproduced the *same two vector indices* exactly. No mechanism
is claimed. ⛔ **"Set it as high as it goes" is measurably wrong advice for this index. `200` is
what the evidence supports.**

### ⚠ And a third: adding a filter makes this product's search MORE accurate, not less

At the shipped configuration the **unnarrowed** query is the one that truncates. The three
reachable filter shapes (`folder`, `metadata @>`, `source.system` by nested jsonb containment)
score `recall@20 = 1.000` at **every** configuration including `ef_search = 40`, while the
same tenant's unfiltered-beyond-the-seven-predicates query scores 0.360. A superset returning fewer
rows than its own subset is impossible under one execution plan, so the narrowed shapes are not on
the HNSW path at all — the planner drops the index once a selective predicate is present. **The
dangerous query is the broad one**, which is the reverse of the intuition this seed was written
against.
