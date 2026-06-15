# Phase 110: DM Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 110-dm-foundations
**Areas discussed:** Audit type breadth, Capability-flag scope, Table column completeness, Drift-guard enforcement point

---

## A — Audit action-type breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Full DM set (8) | The 4 SC-required + view.delete, relationship.delete, classification.rule.create, metadata.field.create. No later phase re-touches the closed enum; still additively extensible. | ✓ |
| Minimal 4 now | Only SC-required view.create / relationship.create / classification.apply / metadata.update; each later phase extends the CHECK + frozenset itself. | |

**User's choice:** Full DM set (8) — recommended.
**Notes:** Locks the 8 exact strings as the v3.0 audit vocabulary; takes the live CHECK 11 → 19. Enum stays additively extensible for a genuine 9th need.

---

## B — Capability-flag scope

| Option | Description | Selected |
|--------|-------------|----------|
| Surfaces + tools only | Flag gates views/relationships/classification/governance + tools. Phase 111 enrichment stays reversible via its OWN knob, not entangled with the ingestion hot path. | ✓ |
| Also gates enrichment (111) | One master switch reverts metadata extraction to legacy gpt-4o / 3k too. | |

**User's choice:** Surfaces + tools only — recommended.
**Notes:** Keeps the ingestion hot path / Deep / agent loop out of the flag's blast radius. In 110 the flag is defined + read-helper only (no-op gate, default on).

---

## C — Table column completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Full known columns now | Create each table with every column the architecture research specified; later phases add behavior, not schema. | ✓ |
| Skeletal now, ALTER later | Minimal core columns now; each later phase ALTER-adds its own. More migrations, less upfront commitment. | |

**User's choice:** Full known columns now — recommended.
**Notes:** DDL sourced from research/ARCHITECTURE.md §1–4. Later ALTER still allowed if a genuinely new need emerges.

---

## D — Drift-guard enforcement point

| Option | Description | Selected |
|--------|-------------|----------|
| Boot + CI both | Lifespan startup assertion (hard-fail, 075.4 pattern) + a CI test. | ✓ |
| Boot-only | Just the lifespan assertion against the live DB CHECK. | |
| CI-only | Just a test; never risks taking the app down, but misses out-of-CI drift. | |

**User's choice:** Boot + CI both — recommended.
**Notes:** Boot home = main.py lifespan, after asyncpg pool init (Phase-081.1 block). No existing boot subset assertion today — net-new.

---

## Claude's Discretion

- Flag key name (recommended `document_management_enabled`) + read-helper placement.
- Single `071_dm_foundations.sql` migration vs split (recommended single; next free number = 071).
- btree index on `org_id` now (recommended yes, non-blocking).

## Deferred Ideas

- Entitlement enforcement on the flag → SEED-080 / v3.2.
- Real org-scoped multi-tenancy RLS → v3.3 (110 ships only the nullable `org_id` + re-keyable policy shape).
- Auditing view/rule/field updates/deletes beyond the 8 types → additive later if needed.

## Reported-bugs cross-check (CLAUDE.md mandate)

All 7 open `surface: Agentic-RAG` reports are chat/streaming/harness/provider/UI — none overlap the DM Foundations substrate (audit enum, RLS, schema, app_settings flag). **Zero folds; nothing deferred from this set into 110.**
