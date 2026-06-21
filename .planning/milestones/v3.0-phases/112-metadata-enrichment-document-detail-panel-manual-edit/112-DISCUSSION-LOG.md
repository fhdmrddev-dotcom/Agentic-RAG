# Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 112-metadata-enrichment-document-detail-panel-manual-edit
**Areas discussed:** Panel entry-point & inline expand, Metadata storage shape (source marker), Edit + re-extract contract, Custom-field rendering, Display tier thresholds (raised by user)

---

## Panel entry-point & the current inline expand

| Option | Description | Selected |
|--------|-------------|----------|
| Replace inline expand | Row-click opens the right-side panel; old inline MetadataPanel removed; mobile bottom-sheet. | ✓ |
| Keep both | Inline row-expand AND a side panel coexist — two surfaces to keep in sync. | |

**User's choice:** Replace inline expand.
**Notes:** Panel mounts at `IngestionPage.tsx` wrapping `DocumentList`. One honest metadata surface, no drift.

---

## Metadata storage shape (the source marker)

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel `_source` sub-key | `metadata._source.{field}` alongside `metadata._confidence.{field}`; flat values → `@>` containment safe (D-111-9). | ✓ |
| Nested per-field object | `{value, source, confidence}` per field; richer but breaks the flat `@>` pre-filter, needs filter/migration rework. | |

**User's choice:** Parallel `_source` sub-key.
**Notes:** Mirrors the proven Phase-111 `_confidence` pattern.

---

## Edit + re-extract contract

| Option | Description | Selected |
|--------|-------------|----------|
| Single-field PATCH + merge | `PATCH /documents/{id}/metadata` sets one field; server stamps source=user + metadata.update audit; re-extract skips source=user fields, refreshes the rest. | ✓ |
| Whole-object PUT | Client sends full metadata on save; simpler endpoint, riskier clobber/concurrency. | |

**User's choice:** Single-field PATCH + merge.
**Notes:** RLS owner-scoped → 404 on non-owner. User-owned field keeps value+source, drops the confidence chip ("✎ Edited").

---

## Custom-field rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Defs from /metadata-fields, by type | Fetch enabled defs from the existing CRUD, control by field_type, ignore `_`-prefixed keys. | ✓ |
| Render all metadata keys generically | Show every key as a text field; leaks `_confidence`/`_source`, wrong controls. | |

**User's choice:** Defs from /metadata-fields, by type.

---

## Display tier thresholds (user-raised)

User asked: "0.8 is rarely achievable, don't you think? And this is metadata-only — it doesn't interfere with retrieval confidence?"

**Investigation (live :54322, 8 enriched docs / 53 field scores):** confidence is bimodal — median 0.95, mean 0.92, 94% ≥ 0.80, ~4% at ~0.05; the 0.50–0.79 band is nearly empty. So 0.80 IS easily achievable; the real implication is scores cluster high, so most populated fields read High and the chip triages the rare Low.

**Retrieval separation confirmed:** metadata display tiers are a separate system from the retrieval `confidence_bucket_high/medium` (0.54/0.38, `agent_loop.py:692`).

**Decision:** Lower High 0.80 → 0.75 (matches user instinct + the app's own 0.54 retrieval bar; negligible data impact), keep Med ≥ 0.50 / Low < 0.50. Hardcoded constants, raw score always shown (honest regardless of boundary), tunable + re-verify at UAT. SPEC.md threshold updated to match.

---

## Claude's Discretion

- Edit concurrency (optimistic UI / last-write-wins single field).
- Edit-control mapping per `field_type`; array (`topics`) edit shape in v1.
- Save-receipt animation timing + reduced-motion instant path.

## Deferred Ideas

- Settings-configurable metadata display tiers (infra exists; add only if users ask).
- Relationships (117) / Classification (118) / Versions accordion sections — shell ready, not built here.
- Governance low-confidence-metadata link-in (119).
