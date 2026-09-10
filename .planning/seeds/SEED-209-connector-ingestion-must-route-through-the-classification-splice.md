---
id: SEED-209
title: Connector-ingested documents must enter through the SAME classification splice as an upload, and source facts must become first-class filterable fields
status: folded            # FOLDED into Phase 237 (2026-09-06) -- RULES-01, RULES-02
folded_into: Phase 237 (One Rule Engine, Not Two — RULES-01, RULES-02)
closed_at: 2026-09-06
planted: 2026-08-26
planted_by: Operator, 2026-08-26 — "we have to think about how to ingest once this connection is established. for example, if a file is uploaded into onedrive, where it will be stored? this should be similar to document management system like m-files which we already define the rules, classes and structure"
surface: Agentic-RAG
severity: info
category: product / ingestion architecture + connector routing
priority: high
scope: Medium — one binding design rule plus a vocabulary extension; no new subsystem
affected_areas: [connectors, ingestion, documents, classification-rules, document-views, custom-fields, knowledge-base]
related_seeds: [SEED-142, SEED-146, SEED-144, SEED-005, SEED-210, SEED-211, SEED-212, SEED-213]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the Connections & Open Platform milestone gets a phase
  number — this seed is an input to its ingestion scope, not a follow-on; (2) anyone specifies a
  sync/auto-ingest connector (OneDrive, SharePoint, Google Drive, email, transcripts) — the splice
  rule below is binding on that phase; (3) anyone proposes writing connector-ingested documents by
  any path other than the shared ingest splice; (4) a classification rule is asked to match on a
  fact the connector knows and the field whitelist does not (source path, site, library, sender,
  participants, channel).
---

# SEED-209 — connector ingest must reuse the classification splice, and provenance must be filterable

## The question that produced this

*"If a file is uploaded into OneDrive, where will it be stored?"* — and the operator's own frame for
the answer: this should behave like **M-Files**, where rules, classes and structure decide placement.

## The finding: most of the M-Files model is ALREADY BUILT

Measured against the codebase on 2026-08-26, not assumed:

| M-Files concept | This app's equivalent | Where |
|---|---|---|
| Property definitions | **custom field definitions** — the filter whitelist is *built-ins ∪ the caller's enabled custom fields* | `backend/app/services/document_view_resolver.py:128-150` |
| Classes / auto-classification | **classification rules** carrying a validated `match_expr` AST | `backend/app/api/classification_rules.py` (Phase 118) |
| Dynamic views | **saved document views** — filters, never folders | `backend/app/api/document_views.py` (Phase 114) |
| Static structure | real folders — M-Files deliberately omits these; we are hybrid | `backend/app/api/folders.py` |
| Permission derived from metadata | ❌ nothing — RLS on ownership | see SEED-210 / SEED-211 |

And the rules already fire at the right moment. From `classification_rules.py:6-7`, verbatim:

> *"there is no resolve route here; a rule is evaluated **on upload by the ingest splice**, Plan 03,
> not resolved on demand"*

**So a connector does not need a routing engine. One exists.** What it needs is to arrive through it.

## THE BINDING RULE

> **A connector-ingested document MUST enter through the same ingest splice as a manual upload.**

A sync that writes documents by its own path means classification rules silently do not apply to
synced files — and **that failure is invisible**, because the documents *do* appear, merely
unclassified. Every M-Files-like guarantee would then hold for the handful of manual uploads and
quietly not hold for the ten thousand files that arrived automatically.

This is the same failure shape this repo has hit before under a different name: a guarantee that
covers the door people watch and not the door the volume comes through.

## THE GAP: the field vocabulary has no SOURCE FACTS

Rules and views match on document metadata. A connector carries facts with nowhere to live:

| Source | Facts it knows | Filterable today |
|---|---|---|
| OneDrive / SharePoint | site, library, source path, owner, modified-by, **and the SharePoint columns themselves** | no |
| Google Drive | drive, folder path, owner, shared-with, last-modifier | no |
| Email | sender, recipients, subject, label/folder, thread id, has-attachment | no |
| Meetings (SEED-212) | participants, organiser, date, series | no |
| Slack / Teams | workspace, channel, poster | no |

Without these, the rule everyone actually wants cannot be written:

> *"anything from the DMT SharePoint library → class: Programme Doc, project: DMT"*

**Provenance is precisely what a person would route on, and it is the one thing the vocabulary
cannot express.**

⚠ **The extension is a MAPPING, not a new system.** The whitelist is already *built-ins ∪ enabled
custom field definitions*, so source metadata becomes filterable by landing in the custom-field
system that ships today. A connection could even **declare its field set at connect time** —
SharePoint columns (which are already M-Files-style curated properties) become custom fields
automatically, and the user's existing curation carries over instead of being retyped.

## Where the file actually lands — the proposal

Stated concretely so a future phase argues with a position rather than a blank page.

1. **Bytes** — the same Supabase Storage bucket as uploads. No second store, no second lifecycle.
2. **Identity** — a source key (`source_system` + `external_id` + `etag`/version) so a re-sync
   UPDATES rather than duplicates, and a file that was *also* uploaded by hand dedups against the
   existing version model rather than becoming a twin. Without this, every sync is a duplication
   engine.
3. **Logical home** — mirror the source tree as **metadata, not folders**. This is the core M-Files
   insight: structure is derived from properties, never authored twice. Saved views already work
   this way, so a *"OneDrive / DMT / Contracts"* view costs nothing, while a mirrored folder tree
   would fight the folder model permanently and would have to be re-mirrored on every source move.
4. **Placement** — rules **suggest, never move**. Phase 118 already shipped exactly this grain for
   auto-classification (suggested-never-moved chips). Reuse it rather than inventing a different
   auto-filing behaviour for the sync door than the one the upload door has.
5. **Unmatched** — a review queue, never silent default filing. Ten thousand documents landing in
   *"Uncategorised"* is how a document-management system dies, and it is indistinguishable from
   working until someone searches.

## What this does NOT decide

- **Permissions.** Where a document lands and who may see it are different questions; the second is
  SEED-210 (the gap) and SEED-211 (the candidate mechanism). Do not let placement rules quietly
  become an access-control model without that decision being made deliberately.
- **Change detection / delta or webhook.** SEED-142 owns the sync mechanics.
- **Which providers ship first.** The Connections milestone candidate owns breadth and sequencing.

## The honest summary

The routing engine, the property system and the dynamic-view model already exist and were built for
this. The connector work's ingestion half is therefore small and specific: **enter through the same
splice, and teach the field vocabulary about provenance.** Getting either wrong is not a polish
issue — it is a re-ingest.

## ⭐ SEQUENCED INTO THE CONNECTED KNOWLEDGE MILESTONE — operator, 2026-09-04

Taken at the v3.9 close audit (`.planning/v3.9-MILESTONE-AUDIT.md`, GAP 1). **Phase 219
(*A Connected Source Feeds the Library*, LIB-08/09/10) was DEFERRED out of v3.9 and travels with
this seed and its three siblings — `SEED-209`, `SEED-210`, `SEED-211`, `SEED-212` — into the same
milestone.**

Why the two cannot be separated: Phase 219's SC#1 is *"watched on a schedule"*, an AUTOMATIC
background sync, which is word for word v3.9's binding re-open trigger for these seeds. v3.9's own
scope section states that shipping auto-ingest without them *"is not a gap, it is a security
defect"*. So the trigger has NOT fired — it was kept from firing by moving the feature, not by
ignoring it.

⚠ **This seed therefore stays `planted` on purpose.** It is not dormant and it is not answered:
it is now a PREREQUISITE of a named future phase, and whoever plans that milestone must sequence
these four ahead of 219 rather than beside it.
