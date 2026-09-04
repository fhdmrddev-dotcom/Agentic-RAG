---
id: SEED-210
title: The connector track has a rigorous envelope for what LEAVES and none for what ENTERS — synced documents flatten source ACLs, and source deletions never propagate
status: planted
planted: 2026-08-26
planted_by: Claude, 2026-08-26, during the connector-scenarios brainstorm; grepped and confirmed absent from the seeds register, the Connections milestone candidate and docs/CONNECTOR-ARCHITECTURE.md
surface: Agentic-RAG
severity: info
category: security / ingestion governance
priority: high
scope: Large — must be decided BEFORE the first sync connector; retrofitting is a re-ingest, not a migration
affected_areas: [connectors, ingestion, documents, rls, knowledge-base, embeddings, retrieval, security]
related_seeds: [SEED-142, SEED-209, SEED-211, SEED-124, SEED-125, SEED-115]
re_open_trigger: >
  Re-open when ANY of these is true: (1) any sync / auto-ingest connector is specified or planned —
  this seed is a HARD PREREQUISITE, not a follow-on; (2) a prospect or customer security review asks
  how source permissions are honoured in the knowledge base; (3) a document is retrieved by a user
  who could not open it at its source system; (4) a file is deleted, unshared or moved at a source
  system and the ingested copy keeps answering questions; (5) anyone proposes ingesting a shared
  drive, a SharePoint site, a mailbox or a channel wholesale.
---

# SEED-210 — the inbound half of the security envelope does not exist

## The asymmetry, stated plainly

Phase 189/190 spent an entire milestone on what **leaves** this app: an unconditional egress guard
placed above credential resolution (the inverted n8n CVE class), an armed approval checkpoint the
author cannot switch off, at-most-once with no retry, receipts that carry the host but never the
recipient, and a kill switch requiring a positive `"everyone"`.

**There is no equivalent for what enters.** Confirmed by grep on 2026-08-26 across
`.planning/seeds/`, `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` and
`docs/CONNECTOR-ARCHITECTURE.md`: **zero** hits for permission-aware indexing, source ACLs, or
permission mirroring. Prompt injection IS recorded (SEED-142, SEED-146, SEED-188) — the two problems
below are not.

## Problem 1 — synced documents FLATTEN their source permissions

Sync a SharePoint site or a shared drive into the knowledge base and its ACLs do not come with it.
Our RLS is ownership/org-scoped; the source's per-file, per-group, inherited-and-broken-inheritance
permission model has no representation at all. The consequence:

> **Every user who can query the knowledge base can retrieve the contents of documents they cannot
> open at the source.**

Retrieval makes it worse than a file listing would be: the answer quotes the content, cites it, and
never had to open the file. A synthesised answer can leak a document's substance without ever
surfacing its name.

This is the classic enterprise-RAG failure — it is exactly what permission-aware indexing exists to
solve in the products this repo already crawled (`.planning/research/deep-dive/GLEAN.md`) — and it is
the finding that ends an enterprise security review. It is also **the inbound mirror of the
cross-org leaks this project has already had twice**: SEED-124 / migration 110 and SEED-125 /
migration 112. Same class, opposite direction.

⚠ **It cannot be retrofitted cheaply.** Attaching per-document source ACLs to an already-ingested
corpus means re-reading every file's permissions from the source and re-writing every row — a
re-ingest, not a migration. That is why this is a prerequisite rather than a hardening pass.

## Problem 2 — lifecycle changes at the source never propagate

A file is deleted, unshared, moved to a restricted library, or its sharing link is revoked. Today
**nothing happens**: the document row, its chunks and its embeddings all persist and keep answering.

This is Problem 1 delayed. A document that was revoked six months ago still serving answers is the
same disclosure, with the added property that nobody is looking for it any more. It also breaks the
ordinary expectation of a document-management system — "I deleted that" has to mean something.

The cases are distinct and each needs an answer:

| Source event | What must happen | Exists today |
|---|---|---|
| deleted | soft-delete + purge chunks/embeddings | no |
| unshared / permission narrowed | re-scope, do NOT delete | no (no scope to change) |
| moved | re-evaluate placement + permission | no |
| modified | re-ingest as a new version (SEED-209 identity key) | partly — version model exists |
| source disconnected | decide: retain, freeze, or purge everything from it | **undecided, and it is a policy question** |

That last row is worth deciding explicitly: disconnecting a connection is the moment a user most
expects their data to stop being used, and the moment an implementation is most likely to leave it in
place.

## Why the manual-upload rule kept this hidden

`CLAUDE.md`'s standing *"ingestion is manual file upload only"* rule has meant every document in the
knowledge base was **deliberately placed there by a person who could already read it**. Ownership-based
RLS is a sound model under that assumption. Auto-ingest breaks the assumption silently — the rule was
load-bearing for security in a way its own wording never claimed.

**So whoever retires that rule (SEED-142 requires it be retired in the same commit as the first sync
connector) is also, in that commit, retiring the reason our permission model was adequate.** That
connection is the single most important thing recorded in this seed.

## Options, none chosen

1. **Permission-derived-from-metadata** — the M-Files model. Source ACLs arrive as metadata; visibility
   is computed from it. One mechanism solves both this and placement. See **SEED-211**, which is where
   that fork is written up. Most elegant, largest design surface.
2. **Per-document ACL mirroring** — store the source's principals per document, resolve at query time
   against the user's mapped identity. Closest to how the incumbents do it; needs identity mapping
   between our users and the source's directory, which is its own project.
3. **Connection-scoped visibility** — everything from one connection inherits ONE visibility
   (the connecting user, or a named group). Crude, cheap, honest, and defensible as a v1 *if the UI
   says so plainly*. Does not scale to a whole SharePoint tenant.
4. **Ingest only what the connecting user can see, and scope it to them** — the narrowest v1. Turns a
   tenant-wide sync into a personal one; safe, but does not deliver the shared-knowledge promise.

⚠ **Option 3 or 4 is a legitimate v1 — silence is not.** A connector that ingests broadly and says
nothing about visibility has made choice (0), which is the one option with no defence.

## The honest summary

The connector track is rigorous about egress and silent about ingress. Before any document arrives
without a human choosing it, this project has to answer two questions it has never been asked: **who
may see a document nobody in this system placed here, and what happens when the source changes its
mind.**

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
