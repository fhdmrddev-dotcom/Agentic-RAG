---
seed_id: SEED-077
title: Durable ingestion job queue + throughput at scale (in-process BackgroundTask has no queue/cap/retry/resume)
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: scale / performance (ingestion) — a durability + admission-control seam on the document-ingestion pipeline, NOT a new feature
related_seeds: [SEED-001, SEED-005, SEED-048, SEED-065, SEED-069, SEED-076, SEED-081, SEED-036, SEED-071]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, project_embeddings_openai_spof]
related_decisions:
  - "Phase 071.2 D-071.2-05 (instant-201 BackgroundTask refactor — documents.py:497-498 schedule _upload_pipeline; solved upload-UX latency, NOT durability/throughput)"
  - "Phase 071.2 D-071.2-06 (/reingest scheduled as BackgroundTask too — documents.py:741, same shape, same gap)"
trigger_when:
  - SEED-005 Enhanced Document Structure (the operator-confirmed NEXT milestone) is scoped — auto-classification + per-field confidence make per-document ingest heavier, and bulk metadata re-processing multiplies the work; the current model will not hold under it
  - A milestone scoped to multi-tenancy / org-level (SEED-004) is planned — org onboarding IS bulk corpus import, which is the literal first thing an enterprise buyer does
  - v3.4 Automations / reactive-or-scheduled re-ingestion is scoped (SEED-069 living-document loop multiplies ingest volume on a schedule)
  - Production/telemetry shows N simultaneous large-PDF uploads saturating the threadpool / CPU subprocesses / the single OpenAI embeddings endpoint, OR a worker restart mid-ingest silently loses an upload with no resume
  - A B2B customer requires a documented ingestion-throughput + bulk-onboarding SLA / requirements matrix to deploy
re_open_triggers:
  - "First reported lost-upload-on-restart or stuck-'processing' document with no resume path"
  - "First bulk-load (>50 docs in one batch) onboarding by any tenant"
priority: high — bulk document onboarding is the first thing an enterprise buyer does, and the current in-process model silently drops work under exactly that load. Not load-bearing for single-operator dev (one upload at a time, no restarts mid-batch), but a hard prerequisite for the NEXT milestone.
suggested_phase: a future scale-hardening deliverable, co-planned with SEED-005 bulk-load and the org-onboarding flow (SEED-004). Cheapest first cut reuses the existing Redis run-buffer infra. NOT v2.9.
surface: Agentic-RAG
---

# SEED-077 — Durable ingestion job queue + throughput at scale

## The gap (grounded in current code)

Document ingestion runs as a FastAPI **in-process `BackgroundTask` per upload**.
The alignment-sweep hunt on 2026-06-10 confirmed there is no durability or
admission-control layer anywhere on the ingest path:

| Property | Current behavior | Evidence |
|---|---|---|
| Job unit | One in-process `BackgroundTask` per upload — `_upload_pipeline` (extract + embed) scheduled on the handler's `BackgroundTasks` object | `documents.py:136` (`_upload_pipeline` def) → scheduled at `documents.py:497-498` (`background_tasks.add_task(_upload_pipeline, ...)`); `/reingest` uses the same shape at `documents.py:741` |
| Durable queue | **NONE** — the task lives only in the worker process's event loop / threadpool; nothing is persisted as a pending job | `documents.py:491-498` (instant-201, then fire-and-forget) |
| Concurrency cap | **NONE** — no global ingestion-concurrency limit, no semaphore, no backpressure. N simultaneous large-PDF uploads spawn N concurrent extract+embed pipelines | `documents.py` (no cap on the add_task path) |
| Cross-worker coordination | **NONE** — each uvicorn worker schedules tasks on its own loop; nothing balances or coordinates ingest load across the `WORKER_COUNT=2` workers | per-worker `BackgroundTasks`, no shared queue |
| Resume on restart | **NONE** — a worker restart (deploy, OOM, crash) mid-ingest **silently loses** the task; no dead-letter, no resume, the document is left stuck "processing" | in-process task, not persisted |
| Retry | **NONE** — embedding failures during ingest are not retried (SEED-048 names this unguarded shape for the chat path; the ingest path has the identical exposure) | no retry wrapper on the embed step |
| Shared bottlenecks | All concurrent pipelines compete for the same threadpool, the same CPU subprocesses (camelot / PyMuPDF extraction), and the **single OpenAI embeddings endpoint** (SEED-048 SPOF) | extract + `ingest_document` run inside the task body |

**What this means in practice:** the Phase 071.2 instant-201 refactor (D-071.2-05)
correctly fixed the *UX* problem — `/upload` returns 201 within ~1s instead of
blocking 1–120s — by moving the heavy work into a `BackgroundTask`. But it left the
heavy work **ephemeral, uncapped, and unrecoverable**. At org-scale onboarding
("bulk-load thousands of documents on day one") this throughput model does not hold:
a burst of uploads is unbounded, a restart drops in-flight work, and a transient
embeddings 429 fails the document with no retry.

## Why it matters at the product's target scale

The operator's direction (2026-06-10): **this product must serve any scale — a small
company on one box up to multi-thousand-user organizations — with the infrastructure
choice left to the buying company against clear, published requirements.** The product
is **B2B-first**, with a possible **lighter hosted multi-tenant SaaS subscription**
alongside; the single-VPS plan (Phase 080) was operator self-testing only, never the
target. (See `project_target_scale` + `project_org_level_deferred` memories.)

Against that vision, the in-process ingestion model is a silent-degradation cliff that
**single-user dev can never expose** (one upload at a time, no restarts mid-batch):

- **Bulk onboarding is the first thing an enterprise buyer does** — and the current
  model drops work under exactly that load, with no operator-visible queue, no resume,
  and no honest "your import is N% done / M failed, retrying" surface.
- **Blocks the operator-confirmed NEXT milestone (SEED-005).** Enhanced Document
  Structure adds auto-classification + per-field confidence (heavier per-doc work) and
  bulk metadata re-processing — both multiply ingest volume against a pipeline that
  already has no ceiling.
- **Compounds with the embeddings SPOF (SEED-048).** A single OpenAI outage or 429 mid-
  bulk-import fails documents with no retry/dead-letter; the durable queue is the place
  that retry/backoff would live.
- **The hosted-SaaS line needs per-tenant fairness** — one tenant's bulk import must not
  starve another's, which requires the global + per-user concurrency cap this seed adds.

## Why it is deferred / not now

This is a **pre-existing** gap, untouched and unworsened by current v2.9 work — Phase 101
(template-fill) and the active phases do not change the ingest path. Single-operator and
small-team usage works fine today: uploads are sequential or low-concurrency, and a
restart mid-upload is a rare, recoverable annoyance rather than silent data loss at scale.
The durable-queue work earns its keep only when bulk onboarding, multi-tenant fairness, or
scheduled re-ingestion (v3.4 / SEED-069) make the burst real. It is therefore a
scale-hardening deliverable co-planned with SEED-005 bulk-load and the org-onboarding flow,
not a v2.9 insert.

## Likely shape if promoted

Cheapest first cut reuses the existing Redis run-buffer infrastructure (the same Redis that
backs `run:{run_id}` streams / `runs:active` per Phase 061+). Candidate scope, ordered:

1. **Persist the job before returning 201.** Write a durable ingestion-job record
   (Redis-stream entry or a DB-backed `ingestion_jobs` table) at upload time, BEFORE
   scheduling the work — so a restart can re-discover and resume pending jobs instead of
   silently losing them. Keep the instant-201 UX (D-071.2-05) intact.
2. **A worker/consumer that pulls from the queue** instead of fire-and-forget `add_task` —
   with a **global ingestion-concurrency cap** + backpressure (reuse the SEED-036 Lua-counter
   admission pattern) so N concurrent large-PDF uploads queue rather than all racing for the
   threadpool, CPU subprocesses, and the embeddings endpoint at once.
3. **Per-user / per-tenant ingestion quota** (sibling to SEED-036's `task()` quota): so one
   tenant's bulk import can't starve co-tenants, with an honest "your import is queued /
   N% done / M failed" UX.
4. **Retry + dead-letter on the embedding step** — Retry-After-aware backoff for embeddings
   429s (overlaps SEED-048's fail-soft + fallback-selector shape and SEED-081's provider-rate-
   limit admission control), and a dead-letter for documents that exhaust retries so they're
   surfaced and re-queueable rather than stuck "processing" forever.
5. **Resume-on-restart drill + cross-worker coordination** — on boot, re-claim orphaned
   in-flight jobs; coordinate consumption across `WORKER_COUNT` workers off the shared queue
   so ingest load is balanced, not duplicated.

## Deliberately NOT in scope (when it lands)

A separate ingestion microservice / external job-runner before the Redis-backed first cut is
proven; replacing the extraction subprocesses or the embeddings provider (SEED-048 owns that);
changing the instant-201 upload UX (D-071.2-05 stays — only the work behind it becomes
durable); building per-tenant autoscaling before SEED-004 tenancy is decided; premature
batch-throughput tuning before the queue exists and is instrumented.

## Relationship to sibling seeds (the scale cluster)

This seed sits in the **scale cluster** — `SEED-076 ↔ SEED-077 ↔ SEED-081 ↔ SEED-001 / SEED-065` —
the silent-degradation gaps that single-user dev never reproduces and that the v3.2 RLS rewrite /
SEED-005 bulk-onboarding would otherwise lock in unmeasured:

- **SEED-076** (filtered-vector-search recall at corpus scale) — the **retrieval-side** scale
  risk; this seed is its **ingestion-side** sibling. Both are HARD prereqs the v3.2 RLS rewrite
  and SEED-005 bulk-load must validate, not lock in blind.
- **SEED-081** (provider rate-limit resilience + fan-out admission control) — owns the
  Retry-After-aware backoff + per-provider in-flight limiter that step-4's embedding retry
  should consume; ingestion is one of the heavy concurrent provider-call paths it admits.
- **SEED-001** (scale readiness — asyncpg pool / pgbouncer / per-user SSE cap) — the broader
  datastore-and-concurrency scale-readiness umbrella; ingestion both hits the connection pool
  and adds its own admission lever.
- **SEED-065** (load degradation / Redis timeout + stream trim) — shares the Redis substrate the
  cheapest first cut reuses; co-plan the Redis sizing + MAXLEN/TTL story so the ingestion queue
  doesn't grow unbounded.
- **SEED-036** (`task()` sub-agent global concurrency → per-user quota) — **same admission-control
  pattern**, applied to ingestion jobs instead of sub-agents; reuse its Lua-counter quota substrate.
- **SEED-048** (embeddings cross-provider SPOF) — names the unguarded embed-failure shape; this
  seed is the home for the ingest-path retry/dead-letter around it.
- **SEED-069** (living-document re-ingestion) — assumes ingest works at volume; a scheduled
  re-ingest loop (v3.4 Automations) multiplies the queue's throughput requirement.
- **SEED-071** (sandbox execution fleet) — a parallel "no cap / no admission control on a hot
  fleet" gap on the *execution* side; same scale-readiness theme, different subsystem.

## Links

`backend/app/api/documents.py:136` (`_upload_pipeline` def — the heavy extract+embed body) ·
`documents.py:497-498` (the fire-and-forget `background_tasks.add_task(_upload_pipeline, ...)` scheduling) ·
`documents.py:741` (`/reingest` — same BackgroundTask shape, same gap) ·
Phase 071.2 D-071.2-05 / D-071.2-06 (instant-201 refactor — fixed UX latency, not durability/throughput) ·
SEED-005 (the NEXT milestone this blocks) · SEED-076 · SEED-081 · SEED-001 · SEED-065 · SEED-036 · SEED-048 · SEED-069 ·
investigation: workflow `wf_13ed5033`

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. The hunt confirmed document ingestion runs as an ephemeral in-process `BackgroundTask` per upload (documents.py:136 → :497-498) with no durable queue, no global/per-user concurrency cap, no embedding retry/dead-letter, and no resume-on-restart — at odds with the "serve any scale, customer-chosen infra, B2B-first, bulk-onboard on day one" product vision. It is a HARD prerequisite for the operator-confirmed NEXT milestone (SEED-005) and the ingestion-side sibling of the SEED-076 retrieval-recall scale risk.*
