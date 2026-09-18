---
seed_id: SEED-224
title: Document space redesign — the Stitch "RAG Document Manager" journey as a five-tab Documents section, RAG-honesty first
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, operator direction after reviewing Stitch project "RAG Document Manager V1" — "capture the requirements… same tone, same level of information, same level of user experience… keep it simple, do not deviate from the RAG"
enriched: 2026-08-28 — the two load-bearing assumptions MEASURED rather than assumed, the host surface located, and the G-5 exposure derived from git (see "Measured at planting time")
renumbered_from: SEED-217
renumbered_because: >
  This seed was planted uncommitted on 2026-08-28. Phase 214's close plan (214-15) independently
  committed a DIFFERENT SEED-217 (`an-upstream-argument-source-is-inert-on-native-capability-rows`)
  and could not see this file. Two files claimed id 217; `status:` frontmatter IS the register
  index, so a duplicate id breaks the sweep. This side was renumbered because it had no inbound
  references, while the committed SEED-217 is already cited in `214-UAT.md` and its SUMMARY.
surface: Agentic-RAG
severity: minor
category: UX redesign / information architecture
priority: medium
scope: >
  Re-skin + enrich the Documents section as a 5-tab surface (Documents / Views & Collections /
  Ingestion / Indexing / Retrieval) following the Stitch redesign's tone and information density,
  WITHOUT deviating from RAG: ship only what is grounded in real data. Full assessment with
  per-screen gap table and explicit cut list: docs/DOCUMENT-SPACE-REDESIGN.md.
affected_areas: [frontend/documents, frontend/ingestion, retrieval-path, eval-runner, schema]
relates_to:
  - docs/DOCUMENT-SPACE-REDESIGN.md
  - SEED-005 (document management capabilities — the management half; this seed is the retrieval-honesty half)
  - SEED-142 (connected-drive auto-ingest owns the Connectors sub-view, NOT this seed)
  - SEED-046 (library health dashboard enrichment — the Retrieval tab supersedes part of it)
re_open_trigger: >
  The next milestone whose scope touches the Documents surface, ingestion UX, or retrieval
  observability — OR any /gsd:new-milestone sweep (the seed register sweep rule). Also re-open
  if retrieval events get logged for any other reason: that substrate makes three of the five
  tabs non-decorative and changes this seed's cost estimate.
trigger_when: unset
---

# SEED-224 — the document space redesign, kept honest

## The operator's direction, 2026-08-28

The operator reviewed Stitch project **RAG Document Manager V1**
(`projects/6647337692456837497`, 12 screens) and liked it "very very much": capture the
requirements, reflect the user journey and the level of information in the Documents section
(multi-tab is fine), keep it simple, and do not deviate from the RAG. Explicitly NOT to be
folded into the running milestone — planted as a seed instead.

## The one-sentence verdict (full table in docs/DOCUMENT-SPACE-REDESIGN.md)

The redesign's worth is **honesty about the RAG half** — retrieval frequency, golden samples,
chunk visibility, index health — not the management half, which we largely already ship
(Phases 112/114/117/118). The five-tab set is implementable on existing surfaces except ONE
new substrate: a per-document `retrieval_events` log, which is what makes the Retrieval tab,
the detail-panel Retrieval section, and the latency tile measured instead of decorative.

## ⚠ Measured at planting time, 2026-08-28 — do not re-derive these from the prose above

The assessment doc says *"check first whether search/retrieval events are already logged"*.
**That check has now been RUN, and so have three others.** These are measurements, not estimates,
and two of them change the shape of the work:

**1. The retrieval path persists NOTHING — the substrate is genuinely new.**
`grep -rlniE "retrieval_event|search_event|query_log|retrieval_log" backend/app supabase/migrations`
returns **empty** across all 122 migrations. `search_documents`
(`backend/app/services/retrieval_service.py:290`) is typed `-> tuple[list[dict], float]` and writes
no row on any path. So `retrieval_events` is a real schema addition, exactly as the doc assumed —
the assumption is now confirmed rather than carried.

**2. Chunk text is ALREADY stored and ALREADY returned — the Chunks list is zero-schema.**
`document_chunks` has a `content text` column since migration `002_module2_byo_retrieval.sql:24`,
and the RPCs in `023_rpc_chunk_index.sql` already return `content` in both the vector and the
rank arm. The read-only chunk view costs a query and a component, not a migration.

**3. ⚠ THERE IS NO `DocumentsPage`, AND THE FIVE-TAB SHELL HAS NO HOME — this is the finding
that changes the plan.** The assessment doc refers to a "`DocumentsPage`-family"; no such file
exists. The surface is **`frontend/src/pages/IngestionPage.tsx`** hosting
`frontend/src/components/ingestion/DocumentList.tsx`, and `grep -niE "Tabs|TabsList|activeTab"`
over that page is **empty** — no tab shell exists to extend. Two consequences a plan must settle
BEFORE writing tasks:
  - **The host page is named after one of its own proposed tabs.** "Ingestion" is tab 3 of 5, but
    the page it would live inside is `IngestionPage`. Either the page is renamed (a route + IA
    change touching the three-homes navigation contract) or the tab set is re-rooted. This is an
    IA decision, not an implementation detail, and the doc did not see it.
  - The tab bar is **net-new**, not an extension of an existing shell.

**4. ⚠ Five of the six files this work would touch FIRE G-5, and NOT ONE has a hot-file ledger
row.** Re-derived from git on 2026-08-28 with the CLAUDE.md recipe (dated six-digit quick-task
buckets excluded), and `grep -c <basename> CLAUDE.md` is **0** for every row below:

| File | commits / phases / lines | G-5 | Ledger row |
|---|---|---|---|
| `frontend/src/components/ingestion/DocumentList.tsx` | 22 / 12 / 609 | **FIRES** | ⚠ none |
| `frontend/src/pages/IngestionPage.tsx` | 26 / 9 / 601 | **FIRES** | ⚠ none |
| `backend/app/services/retrieval_service.py` | 17 / 9 / 362 | **FIRES** | ⚠ none |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | 6 / 5 / 393 | **FIRES** | ⚠ none |
| `frontend/src/hooks/useDocuments.ts` | 8 / 3 / 120 | **FIRES — at threshold** | ⚠ none |
| `frontend/src/components/ingestion/DocumentUpload.tsx` | 10 / 1 / 144 | no (1 phase) | ⚠ none |

`DocumentList.tsx` at **12 phases** and `retrieval_service.py` at **9** have been invisible to
their own guardrail for their entire lives. **A discuss-phase for this seed must add these rows
BEFORE planning**, because a G-5 audit that scans the ledger will report this whole surface clean
— which is the exact failure mode Phase 214 found 25 further instances of at its close.

## The 12 Stitch screens, by real id

⚠ The assessment doc cites screens as bare numbers (`01`, `03`, `07`, `09`, `10`, `11`, `12`,
`13`, `15`) which **resolve to nothing retrievable**. The project's actual screens, so a future
reader can open the source rather than guess:

| Screen | id (under `projects/6647337692456837497/screens/`) |
|---|---|
| RAG Document Manager V1 (hub) | `f6d12cfafc6e422a9df0f1bb3316038c` |
| RAG Document Manager V2 | `1d7447af122d45978a43098aa4f138ec` |
| Document Ingestion & Upload | `849e25b058bb42c5948c45f00036f88c` |
| Chunking & Analysis Settings | `900d47eb26154df2ac2f1bdbc66e6db8` |
| Indexing & Vector Management | `7fcfae52c0164459950437db0928e8d1` |
| Document Explorer & Custom Views | `9fc78c7301884c35aad83bf2ccfd7d8f` |
| Bulk Ingestion & Connectors | `4f57d8f13df64b9c87432d5fbceb0bca` |
| Collection-Based Indexing | `5e3bbf3f797f47688e25f2ded0f93de5` |
| Automated Processing Pipeline | `8c1210c87cbe481dbc5ebb0d09ad0f10` |
| Advanced Document Data Table | `7f9908438d514ce5a552409d0110203a` |
| Detailed Metadata & Insights | `0a89f43ad9164fbf95de08b25220cc10` |
| Retrieval Analytics & Validation | `3ed6929234fb489283c9e7804b15f1d2` |

⚠ **A Stitch project is mutable and privately scoped.** If it is edited or deleted, the ids above
stop resolving — `docs/DOCUMENT-SPACE-REDESIGN.md` is the durable capture, and the screenshots
committed in `35838972c` are the durable pixels. Do not treat the Stitch project as the contract.

## What ships vs. what is cut (do not re-litigate at plan time)

- **Ship:** per-file 3-stage ingestion progress; chunk list (read-only, existing storage —
  confirmed zero-schema above); per-doc retrieval stats + golden-sample marking wired to the
  existing eval runner; Indexing tab = embedding model + live vector count + existing re-embed
  lifecycle; Re-index / Test-query row actions.
- **Cut (decorative or ungrounded):** "Embedding Quality 92%" score + trend, static
  "Semantic Match %" column, ingestion token pie charts, section-level retrieval heatmap +
  narrative summary, faceted filter panel, connector cards (SEED-142).

## Deferred inside the seed (with triggers)

- Collection search-quality score → once retrieval history has a few weeks of data.
- Section-level heatmap → after golden samples prove the eval wiring.
- Ingestion token accounting → only if a real cost question appears.

## Sequencing note

The redesign's honest half depends on `retrieval_events`, and **the embedding provider is a
single point of failure that already lies about its own failures** when it 429s (`BUG-260815-05`,
folded into Phase 210). A Retrieval tab built on top of a retrieval path that misreports provider
failure would show "0 retrievals" for an outage. Sequence this seed **after** that honesty fix
lands, or the tab inherits the lie it exists to prevent.
