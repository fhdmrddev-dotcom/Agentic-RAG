# Phase 116: Document Relationships — Backend + Agent Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 116-document-relationships-backend-agent-tool
**Areas discussed:** Version-stable link identity, Retrieval shape & direction, Create-time validation, Create/remove surface scope

---

## Version-stable link identity (SC#1 core)

| Option | Description | Selected |
|--------|-------------|----------|
| Follow to latest | Link always surfaces the current latest version; never orphans on re-upload/restore. Mechanism left to researcher. | ✓ |
| Pin to exact version | Link stays bound to the precise version created against; feels orphaned once newer exists. | |
| Follow, but keep a version note | Resolve to latest + record original version for provenance. | |

**User's choice:** Follow to latest (Recommended)
**Notes:** Versioning model: re-upload INSERTs a new `documents` row (new id), old kept `is_latest=false`; lineage grouped only by `(user_id, filename)` — no lineage UUID. Mechanism (read-time resolve vs re-point-on-upload) = researcher discretion (D-116-1a). Filename-rename flagged as the fragility edge.

---

## Retrieval shape & direction (REL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Both directions, labeled | Outgoing + incoming, direction-tagged, inverse phrasing for incoming (superseded_by, etc.). | ✓ |
| Outgoing only | Only links this doc is the source of; misses "what supersedes this?". | |
| Both, flat (no inverse naming) | Both directions + raw rel_type + direction field; agent infers inverse. | |

**User's choice:** Both directions, labeled (Recommended)

### Follow-up — Tool input (how the agent names the subject doc)

| Option | Description | Selected |
|--------|-------------|----------|
| document_id, w/ filename fallback | Primary = document_id (from cited source_refs); also accept exact filename → latest accessible version, caller-scoped. | ✓ |
| document_id only | Strictly UUID; forces a prior lookup when user names a doc by title. | |
| filename / title only | Human name only; ambiguous on duplicate filenames. | |

**User's choice:** By document_id, w/ filename fallback (Recommended)
**Notes:** Honors the `minimax-m3-invalid-tool-args-400` watch item — clear discriminated shape weak models can fill.

---

## Create-time validation (REL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Visible-only + idempotent | Both endpoints must be caller-visible (own-or-global); duplicate = idempotent no-op returning the existing edge. | ✓ |
| Visible-only, allow duplicates | Enforce visibility; allow distinct duplicate rows. | |
| Visible-only + reject duplicates (409) | Enforce visibility; duplicate returns an error the caller must handle. | |

**User's choice:** Visible-only + idempotent (Recommended)
**Notes:** Self-link already blocked by table `no_self_rel` CHECK. Table has no unique constraint today — idempotency enforcement site (app-code vs additive partial unique index) = planner discretion.

### Follow-up — Reciprocal edges

| Option | Description | Selected |
|--------|-------------|----------|
| Single directed edge only | One row; inverse derived at read from the incoming-direction query. | ✓ |
| Auto-create inverse row | Insert a second inverse row; stores the fact twice, sync risk on delete, double audit. | |

**User's choice:** Single directed edge only (Recommended)

---

## Create/remove surface scope

| Option | Description | Selected |
|--------|-------------|----------|
| API write, agent read-only | Backend REST create/remove (for 117 UI); agent gets only read-only get_related_documents. | ✓ |
| Agent can also write | Add create/remove agent tools for autonomous linking. | |
| API write only, no agent read either | Defer the read tool — rejected by ROADMAP (REL-04 + SC#2 require it). | |

**User's choice:** API write, agent read-only (Recommended)

---

## Claude's Discretion

- Follow-to-latest mechanism (read-time resolve vs re-point-on-upload) — D-116-1a.
- Idempotency enforcement site (app-code vs additive partial unique index) — D-116-6.
- Inverse-label wording per rel_type; exact field set on each compact row.
- Tool name + JSON-schema arg shape for the document_id-XOR-filename discriminator.
- Create/remove route shape + request models.
- Audit: `relationship.create` on create, `relationship.delete` on remove — both already in the enum (no migration).

## Deferred Ideas

- Agent-driven create/remove of relationships (autonomous linking) — own future phase.
- Provenance / "linked against version N" history — re-open if Phase 119 governance wants it.
- Relationship types beyond the four — additive enum migration in a later phase.
- The relationship panel UI — Phase 117 (REL-02, G-2 sketch).
