---
seed_id: SEED-243
title: "Find the DOCUMENT, not just the answer — DMS-grade metadata, structure and search, and the classification page that has no home"
created: 2026-09-04
planted_during: "v3.9 close intake — operator, before /gsd:complete-milestone"
status: planted
surface: Agentic-RAG
severity: medium
category: knowledge-base / document-management / search / IA
priority: high
relates_to:
  - SEED-005                                              # the M-Files-aligned DMS seed; Tier A shipped in v3.0
  - SEED-211                                              # permissions derived from metadata (the M-Files fork) — deferred with Phase 219
  - frontend/src/components/classification/ClassificationRulesPage.tsx   # 201 L, exists
  - frontend/src/components/classification/RuleBuilderPanel.tsx          # 440 L
  - frontend/src/pages/LibraryPage.tsx                    # the five-tab Library (217 / 217.1)
  - backend/app/api/documents.py
  - backend/app/services/retrieval_service.py
trigger_when: >
  Planning any milestone that touches the Library, metadata, classification or search. Fires
  IMMEDIATELY on the next milestone definition — the operator raised it as a named gap at the v3.9
  close, and one half of it (the classification surface) already ships as code with no clear home.
---

## What the operator asked for, in their words

> *"we should see how we can enrich the metadata, the classification, document structure, folder
> structure — similar to the basic functionality of M-Files — that will allow us to search in
> documents not only as RAG but also to search FOR documents, similar to the functionality of a
> document management system. We have an empty page which is classification and I think we can
> leverage the use of this and rename it to something."*

## The distinction that makes this a seed and not a feature request

**RAG answers a question. A DMS finds a file.** Today this product does the first extremely well and
the second barely: retrieval returns *passages* ranked by embedding similarity, and the Library
lists documents by folder and by saved View. What is missing is the thing every document manager
does first — *"find me the contract with Acme, signed last year, owned by Legal, superseded by
nothing"* — which is a **metadata query**, not a semantic one.

⚠ **The two searches are not the same mechanism and must not be conflated.** One ranks chunks by
cosine distance; the other filters rows by structured fields. Building the second on top of the
first is how a DMS ends up unable to answer a question with a definite answer.

## What already exists — verified at HEAD, not assumed

| Piece | State |
|---|---|
| `SEED-005` (M-Files-aligned DMS) | **Tier A shipped in v3.0**: metadata-driven views / virtual folders, document relationships, auto-classification. **Tier B — retention, check-in/out, approvals — still deferred** |
| Classification rules surface | ⭐ **IT IS NOT EMPTY — it is 641 lines of shipped code**: `ClassificationRulesPage.tsx` (201 L) + `RuleBuilderPanel.tsx` (440 L), from Phase 118. What it lacks is a **home in the IA** and a name a person recognises |
| Metadata extraction | Per-document LLM-structured JSON, custom fields, per-field confidence (v3.0 enrichment add-on) |
| Library | Five tabs after 217 / 217.1, with saved Views and a folder tree |
| Per-hit similarity | ⚠ `retrieval_service.py` computes it and **DROPS it** — the one retrieval fact the Library cannot show (`SEED-224`) |

**So the raw material is largely built.** This seed is mostly about *composition and findability*,
not new extraction.

## What to decide when this is planned

1. **Rename and re-home the classification surface.** "Classification" is an engineering word. It is
   a *rules* surface: how a document gets its type, its folder, its fields. Name it for what a
   person does there, and mount it inside the Library rather than beside it.
2. **A document-first search** that queries fields (type, owner, dates, custom fields, relationships,
   version state) and returns DOCUMENTS — sitting beside, never inside, the answer-first RAG search.
3. **Structure as a first-class field.** Folder path, relationships and version lineage are already
   stored; they are not searchable dimensions yet.
4. ⚠ **The permissions fork is `SEED-211` and it is deferred with Phase 219.** M-Files derives
   permissions FROM metadata. If this seed goes anywhere near that, it inherits the Connected
   Knowledge milestone's security gate — do not let a metadata feature quietly become an access-control
   feature.

## How we would know it worked

A person who knows a document exists can find it **without guessing a phrase that appears inside
it** — by type, by owner, by date, by folder, by relationship. And the rules surface is somewhere
they can find without being told where it is.
