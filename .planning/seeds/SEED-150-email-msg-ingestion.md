---
id: SEED-150
title: Emails cannot be ingested — no `.msg` / `.eml` path exists, so the single most common business document type is the one the knowledge base cannot read
status: open
planted: 2026-08-10
planted_by: Operator, reviewing the app after the v3.6 deploy (2026-08-10) — "we need the ability to ingest emails .msg, or convert this to md or other formats; this might be also related to connectors that we are building"
surface: Agentic-RAG
severity: warning
category: ingestion — file-type coverage
priority: medium
scope: Medium. A parser + an attachment decision. The attachment half is what makes it non-trivial.
affected_areas: [ingestion-pipeline, extraction-engines, document-mime-handling, connectors]
related_seeds: [SEED-142, SEED-144, SEED-146, SEED-060]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the connections milestone scopes a Gmail/Outlook connector —
  decide THEN whether ingestion is file-upload, connector-pull, or both, so the parser is not built
  twice; (2) an ingestion milestone opens; (3) any user uploads a `.msg` or `.eml` and gets a
  rejection; (4) SEED-142 (two-way connectors / auto-ingest) is picked up.
---

# SEED-150 — the knowledge base cannot read email

## The observation (operator, 2026-08-10)

> "we need the ability to ingest emails `.msg` — or convert this to md or other formats. This might
> also be related to connectors that we are building."

## Why it matters

For the org-scale B2B tenant this product targets, **email is where the decisions actually live**.
Approvals, scope changes, commitments, the reason a risk was accepted — these are rarely in the
`.docx`; they are in a forwarded thread someone saved to disk. A knowledge base that reads every
polished artefact and none of the correspondence answers "what does the document say" but not "what
did we agree".

`.msg` in particular is what a Windows/Outlook user produces when they drag an email to a folder,
which is exactly this product's audience.

## The genuinely hard part is not the parser

Extracting text from `.msg` (Outlook's compound-binary format) or `.eml` (RFC-822 MIME) is a solved
problem with mature libraries. Four design questions are what make this a seed rather than a ticket:

1. **Attachments.** An email is a container. Does ingesting one email also ingest its three attached
   PDFs as separate documents? As children of the email? Not at all? This is the decision that
   shapes the schema, and getting it wrong is expensive later. Note the product already has a
   document-relationships model (Phase 117) — an email→attachment edge may be exactly what it is for.
2. **Threads.** Ten forwards of the same conversation are ten files with ~90% duplicated quoted text.
   Ingesting all of them poisons retrieval with near-duplicates. Quoted-reply stripping and thread
   de-duplication are the real quality work here, and they are not optional.
3. **Metadata as first-class fields.** From/To/Cc/Date/Subject are structured, high-value, and map
   cleanly onto the existing metadata enrichment + filter/view surfaces (v3.0/Phase 114). An email
   ingested as a wall of text throws that away. This is where email ingestion could be genuinely
   better than a generic converter.
4. **Provenance and access.** An email carries other people's names and addresses. Whatever RLS and
   org-scoping applies to documents applies here with sharper edges.

## The connector question — decide it BEFORE building

The operator's own note flags this and it is the most important routing constraint: **do not build
this twice.** If the connections milestone ships a Gmail or Outlook connector (SEED-144 is
provider-shaped, SEED-146 is the capability surface, SEED-142 is read-pull/auto-ingest), then a
pulled email and an uploaded `.msg` should land in the **same** normalisation path. Build the parser
and the four decisions above once, then let both the upload route and the connector route feed it.

⚠ Note the standing project rule that ingestion is manual file upload only is **dated, not
permanent** — CLAUDE.md records the operator's 2026-08-08 direction toward auto-ingest and points at
SEED-142. Whoever ships the first sync connector changes that rule in the same commit. This seed sits
on the file-upload side of that line today and should not wait for it.

## Cheapest useful first step

Scope only `.eml` + `.msg` → text + the five metadata fields, attachments explicitly OUT and recorded
as deferred with a trigger. That is a small, shippable slice that makes email searchable, and it
forces the attachment decision to be made deliberately rather than by accident.

## Suggested routing

Sequence **with or after** the connections milestone so the normalisation path is shared, but do not
let it be absorbed into it — connections is about outbound writes today, and this is inbound
ingestion. If connections slips, this can ship standalone as part of an ingestion milestone
alongside **SEED-149** and **SEED-060**.
