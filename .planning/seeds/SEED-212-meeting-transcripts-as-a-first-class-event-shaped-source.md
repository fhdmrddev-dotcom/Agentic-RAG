---
id: SEED-212
title: Meeting transcripts are a first-class knowledge source and are shaped like EVENTS, not documents — nothing in the register covers them
status: planted
planted: 2026-08-26
planted_by: Operator, 2026-08-26 — "connecting to one drive, or google drive or emails or teams … etc to ingest documents as they are uploaded or maybe ingest meeting transcript and so on"
surface: Agentic-RAG
severity: info
category: product / ingestion source + retrieval quality
priority: high
scope: Medium-Large — a new source SHAPE, not merely a new provider
affected_areas: [connectors, ingestion, documents, chunking, retrieval, metadata, entities, knowledge-base]
related_seeds: [SEED-142, SEED-209, SEED-210, SEED-213, SEED-014]
re_open_trigger: >
  Re-open when ANY of these is true: (1) a Teams, Zoom, Google Meet or transcription connector is
  proposed — this seed owns the SHAPE question that provider work would otherwise answer by accident;
  (2) a user asks the knowledge base what was decided or agreed in a meeting; (3) event-triggered
  ingestion (interaction mode E) is specified — transcripts are its primary case; (4) a workflow or
  report is observed citing stale evidence because the current state lives in meetings nobody
  uploaded; (5) chunking strategy is revisited for any non-page-shaped source.
---

# SEED-212 — transcripts are events, and the register has never covered them

## Why this is not "one more provider"

Confirmed by grep on 2026-08-26: **no seed covers meeting transcripts.** The Connections milestone
candidate names Teams only as a Microsoft capability alongside Outlook / OneDrive / SharePoint — i.e.
as a *provider surface*, with no statement about what a transcript IS once ingested.

A transcript is not a document that happens to arrive from Teams. It differs on four axes at once,
and every one of them changes an implementation decision:

| Axis | A document | A transcript |
|---|---|---|
| Shape | pages, layout, headings | **speaker turns over time** |
| Identity | a file with a name | an **event**: organiser, participants, start/end, series |
| Value | its content | its **decisions and commitments** |
| Arrival | someone chose to upload it | **continuous and unprompted** |

## Why it may be the highest-value source this product has

The v3.8 milestone shipped document intelligence over files a person remembered to upload. But in a
programme-knowledge product, **the current state of a project lives in meetings, and the documents lag
it by weeks.**

This session produced the evidence unprompted. The DMT status-briefing workflow read **20-30
knowledge-base sources** and still opened with *"Latest recorded evidence: 8 Jul 2026"* — seven weeks
stale — and graded itself **AMBER** partly because the forward plan was not visible in any document.
Whatever was actually agreed since July was agreed in meetings.

**Transcripts are what would make that briefing current**, and it is the app's own flagship workflow.

## What is genuinely different to build

1. **Event-shaped identity and metadata.** Organiser, participants, date/time, duration, recurring
   series, and the project it belongs to. Under SEED-209's rule these become first-class filterable
   fields — and the participants are *people*, which is the first ingestion source whose metadata is
   naturally an entity set rather than a string. That opens routing nobody can write today:
   *"any meeting where the DMT delivery manager attended → project: DMT"*.
2. **Chunking by turn and topic, not by layout.** Every chunker in this repo assumes pages and
   headings. A transcript's retrievable unit is a topic segment spanning many short turns; chunking it
   by character window shreds exactly the exchange that carries the decision.
3. **Extraction is the point.** *"What did we agree about the November milestone?"* is a decisions-and-
   actions question. A transcript ingested as prose answers it poorly; a transcript with extracted
   decisions, action items and owners answers it directly. This is a structured-output job, which is a
   thing this codebase already does well (Pydantic + the emit tiers) — and it is the strongest reason
   the ingestion pipeline should treat this as its own kind rather than a text blob.
4. **It is the primary case for event-triggered ingest (mode E).** A meeting ending is an event; nobody
   uploads it. This is where an ingestion trigger has to exist rather than a poll being adequate.
5. **Correction and supersession.** Transcripts are frequently revised (better diarisation, a corrected
   recording) and one meeting supersedes another in the same series. The existing version model may
   cover the first; the second — *"the 12 Aug steering committee supersedes the 5 Aug one on this
   decision"* — is a relationship, and Phase 117's document-relationships surface is the natural home.

## What it drags in that is NOT free

- **Consent and recording policy.** Ingesting a recorded conversation involving named people is a
  materially different act from ingesting a file, and in some jurisdictions and organisations it is a
  regulated one. This deserves an explicit stance, not a default.
- **Permission inheritance is unusually sharp here.** A private 1:1 transcript landing in a shared
  knowledge base is the worst instance of SEED-210's flattening problem — the content is candid,
  personal, and about people who never chose to publish it. **If transcripts ship before SEED-210 is
  answered, this is where the incident happens.**
- **Volume.** A busy organisation generates transcripts continuously; "ingest everything" is not a
  sensible default any more than it is for a mailbox.
- **Quality varies wildly.** Diarisation errors, cross-talk and ASR noise mean a transcript's
  confidence is lower than a document's — which is exactly what Phase 112's per-field ConfidenceChip
  vocabulary was built to express honestly.

## Sequencing note

This seed does not ask to be built first. It asks that **when a Teams/Zoom connector is specified, the
shape question is answered deliberately** — because a transcript ingested as "a text file from Teams"
is cheap, will work, and will quietly foreclose every capability above.

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
