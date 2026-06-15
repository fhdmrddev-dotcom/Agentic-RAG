# Phase 090: Harness Schema + RLS + Config Models - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 090-harness-schema-rls-config-models
**Areas discussed:** Template sharing & authoring, Draft/publish lifecycle, Config model strictness, Audit retention & delete behavior

---

## Gray-area selection

The phase is heavily pre-locked by the ROADMAP success criteria + the v2.8 research (ARCHITECTURE.md).
Locked-and-carried-forward (not discussed): migrations 056+, `deep_mode_metadata` dropped, `org_id NULL`
forward-compat with user-scoped RLS, FK-chain RLS via `threads.user_id`, INSERT-only audit, immutable-on-publish
constraint+trigger, Pydantic discriminated union over 5 phase types. No reported bugs folded (all open
Agentic-RAG bugs are frontend chat-surface, routed to 093/095).

User selected ALL FOUR remaining product-level gray areas to discuss.

---

## Template sharing & who authors

| Option | Description | Selected |
|--------|-------------|----------|
| Global seeds + users author own | Seed templates `is_global=true` (like global skills); users can also author private definitions. `created_by` + `is_global`, RLS = own-or-global. | ✓ |
| Global seeds, authoring deferred | Seeds global/read-only; users cannot author in v1. | |
| Per-user only (no global) | No global scope; seeds copied per-user on first use. | |

**User's choice:** Global seeds + users author own
**Notes:** Mirrors the proven skills `is_global` model; no operator-role dependency (that tier is v2.9). Recommended option.

---

## Draft vs publish lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Draft → publish → new version on edit | `status` (draft\|published); draft editable, publish freezes via BEFORE UPDATE trigger; edits create version+1. | ✓ |
| Frozen-on-insert (no draft state) | Every row immutable on insert; no draft phase. | |
| Mutable until first run | Editable until a run references it, then freezes. | |

**User's choice:** Draft → publish → new version on edit
**Notes:** Explicit, reproducible publish moment with a mutable draft phase; trigger blocks mutation conditional on `status='published'`. Recommended option.

---

## Config model strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strict — reject unknown fields | Pydantic `extra='forbid'`; typo'd/unknown keys fail `model_validate()`. | ✓ |
| Lenient — ignore unknown fields | `extra='ignore'`; unknown keys silently dropped (forward-compat). | |

**User's choice:** Strict — reject unknown fields
**Notes:** v1 authoring is by-hand seed/JSONB/API, so strict parsing catches authoring mistakes early. Lenient deferred. Recommended option.

---

## Audit retention & delete behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep forever + audit independent | No TTL; audit rows survive run/definition deletion (trail persists). | ✓ |
| Keep forever + cascade with run | No TTL; audit cascade-deletes with parent run. | |
| Add retention cap now | Build TTL/purge into v2.8. | |

**User's choice:** Keep forever + audit independent
**Notes:** Audit volume tiny at current scale; trail must survive. Definitions already `ON DELETE RESTRICT`. Recommended option.

---

## Claude's Discretion

- Migration file split (one-per-table vs combined), column types/names beyond named, index choices, trigger naming.
- `harness_audit` event-type shape and audit→run linkage mechanism (SET NULL FK vs plain stored id).
- Pydantic field shapes for each of the 5 phase-type configs (coordinate with downstream Phase 091 engine needs).

## Deferred Ideas

- Operator/super_admin publish-restriction role tier → v2.9 (D-v2.8-01).
- Audit retention/TTL purge → until volume is a concern.
- Lenient forward-compat config parsing → until cross-version compat need.
- Org-level RLS/multi-tenancy → `org_id` carried NULL only; predicates user-scoped.
- `deep_mode_metadata jsonb` → dropped (not deferred); revive only with a concrete consumer.
