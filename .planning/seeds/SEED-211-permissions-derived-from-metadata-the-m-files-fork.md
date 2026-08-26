---
id: SEED-211
title: Permissions derived from METADATA (the M-Files model) — one mechanism that answers both document placement and source-ACL mirroring
status: planted
planted: 2026-08-26
planted_by: Claude, 2026-08-26, from the operator's M-Files framing during the connector-scenarios brainstorm
surface: Agentic-RAG
severity: info
category: architecture / access control — an unresolved FORK, not a task
priority: medium
scope: Large — an access-control model change; cheap to adopt BEFORE sync connectors, expensive after
affected_areas: [rls, documents, classification-rules, custom-fields, document-views, connectors, ingestion, security]
related_seeds: [SEED-210, SEED-209, SEED-115, SEED-124, SEED-125]
re_open_trigger: >
  Re-open when ANY of these is true: (1) SEED-210 is scheduled — this seed is its candidate
  mechanism and the two must be decided together; (2) anyone proposes per-document ACL mirroring as
  a standalone subsystem, since this is the alternative it should be weighed against; (3) a
  classification rule is asked to control VISIBILITY rather than placement — that is this fork
  arriving through the back door and must not be answered incrementally; (4) SEED-115's roles /
  departments / greenlists work is scheduled, since that is the other half of the identity model
  this needs.
---

# SEED-211 — should visibility be COMPUTED from metadata rather than stored per row?

## The fork, in one sentence

**M-Files derives a document's permissions from its class and properties.** This app stores
visibility as a property of the row (ownership + org, enforced by RLS). The question this seed
records — and deliberately does not answer — is whether to adopt the former before the first sync
connector lands.

## Why it is worth asking now rather than later

It is the same mechanism twice:

- **Placement** (SEED-209) is already metadata-driven here. Classification rules evaluate a
  `match_expr` at ingest; saved views are filters, not folders. That is the M-Files shape, built.
- **Permission** (SEED-210) is not. It is ownership-based, and auto-ingest is exactly what breaks
  that assumption.

If source ACLs arrive as metadata (SEED-209 already argues source facts must become first-class
fields), and visibility is computed from metadata, then **mirroring a SharePoint library's
permissions stops being a new subsystem and becomes a rule.** One mechanism, two problems, and the
mechanism is one this codebase has already demonstrated it can build — the rules engine, the field
whitelist and the view compiler all exist and are tested.

That is the argument FOR. It is a real one and it is why this is written down rather than dismissed.

## The argument AGAINST, stated as strongly

1. **RLS is the enforcement boundary and it is the thing that works.** This project's two worst
   recorded defects were cross-tenant leaks closed by migrations 110 and 112; the lesson recorded
   from both was to make the database the authority. A computed-visibility model that resolves in
   application code is a step away from that, and *"the backend runs on the service-role key with NO
   RLS backstop"* is already true on several paths — the operator gate's own docstring says so.
2. **Computed permissions are hard to audit.** "Why can Ahmed see this?" has a one-row answer today
   and a rule-evaluation trace tomorrow. On an access-control surface, explicability is a feature.
3. **Rule changes become mass permission changes.** Editing one rule could silently re-scope
   thousands of documents. That needs a preview, a diff and an audit entry — i.e. it needs to be as
   carefully built as the operator action-guards in Phase 146-148, not bolted on.
4. **Retrieval is the hard part, not storage.** Vector search must filter by the computed scope
   *inside* the query, or it leaks through ranking even when the final render is filtered. A
   metadata-computed scope has to compile down to a predicate the pgvector query can carry — which
   is a real constraint on how expressive the rule language may be.
5. **It needs an identity model this app does not have.** Mapping source principals (an Azure AD
   group, a Google group) onto our users is SEED-115's territory (roles, departments, greenlists) and
   is a prerequisite either way.

## The middle path worth evaluating

**Compute, then materialise.** Rules derive a document's visibility scope at ingest and at rule-change
time, and the result is **written to a real column** that RLS enforces exactly as it does today.

- The DB stays the enforcement authority — no change to the boundary that has already failed twice.
- The scope is a stored fact, so "why can Ahmed see this?" keeps a one-row answer, and the vector
  query keeps a simple predicate.
- The rule engine becomes a *writer* of permissions rather than an *evaluator* of them, which is a
  much smaller and more testable surface.
- The cost is staleness: a rule edit needs a re-materialisation pass, and that pass must be
  observable rather than silent.

This is the option this seed would recommend if forced to choose today — but it is recorded as a
candidate, not a verdict, because it has not been designed and the retrieval predicate above is the
part most likely to bite.

## What must be true before this is decided

- **SEED-210 must be scheduled with it.** The problem and the mechanism cannot be decided apart —
  choosing a v1 answer for 210 (e.g. connection-scoped visibility) may make this fork unnecessary for
  a whole milestone.
- **SEED-115's identity model** (roles, departments, greenlists) is a prerequisite for any option that
  maps external principals.
- **A migration question must be answered explicitly:** if visibility becomes computed or
  materialised, what happens to the documents already in the knowledge base? An answer of "they keep
  their current scope" is fine — but it must be stated, because a silent default here is a
  permission change nobody reviewed.

## The honest summary

The app already thinks in metadata for *where a document belongs*. Whether it should also think in
metadata for *who may see it* is a genuine architectural fork with a strong case on both sides. It is
cheap to adopt before auto-ingest and expensive afterwards, which is the only reason it is being
raised now rather than when it becomes obvious.
