# Phase 117: Document Relationships — Panel UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 117-document-relationships-panel-ui
**Areas discussed:** Create direction, Target picker, Section layout, States & live update

---

## Create direction

### Q1 — What should the create form let the user express?

| Option | Description | Selected |
|--------|-------------|----------|
| Outgoing-only | Form always creates 'A [rel_type] → X'; pick target + type from A's perspective. Simplest, matches single-directed-edge model; incoming still displays (derived). | ✓ |
| Direction toggle | Switch to create 'A → X' or 'X → A' from A's panel. More expressive, adds a control + inverse-mapping. | |
| Type-implied direction | No explicit direction control; each type reads naturally as outgoing from A. | |

**User's choice:** Outgoing-only
**Notes:** Authoring stays simple; to author "X supersedes A" the user opens X's panel.

### Q2 — Removal: can an INCOMING link shown in A's panel be removed there?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove either direction | Any link listed in A's panel (outgoing OR incoming) has a remove control. Consistent "see it → unlink it." | ✓ |
| Remove outgoing only | Only outgoing removable from A's panel; incoming read-only here. | |

**User's choice:** Remove either direction
**Notes:** Both edges are the same user's own rows; the own-scoped DELETE permits it. Creates a deliberate asymmetry (outgoing-only create, either-direction remove) — locked as intentional.

---

## Target picker

### Q1 — How should the user pick the target document?

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable typeahead | Combobox: type to filter visible docs by filename, pick one. Scales to hundreds; keeps MoveToFolderDialog's dialog+confirm shell. | ✓ |
| Plain Select dropdown | MoveToFolderDialog's Select verbatim. Simplest, matches SC literally, but unusable past ~30-40 docs. | |
| Reuse documents list | Embed a mini DocumentList + FilterBar. Most powerful, heaviest, overkill for one target. | |

**User's choice:** Searchable typeahead
**Notes:** Keep the dialog + confirm + error-line shell; replace only the Select with a filterable input.

### Q2 — What should the candidate list include?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide self + already-linked | Exclude the current doc AND any doc already linked with the chosen rel_type. Only actionable choices. | ✓ |
| Hide self only | Exclude only the current doc; rely on idempotent-create for redundant picks. | |
| You decide | Defer to research/planner given the fetch mechanism. | |

**User's choice:** Hide self + already-linked
**Notes:** Idempotent-create (D-116-6) is the safety net; UI exclusion is for clarity. Where the exclusion is computed (client vs server param) left to research per data source.

---

## Section layout

### Q1 — How should links be organized in the section?

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by direction | Two subgroups: Outgoing then Incoming, each row = filename + rel-type chip. Mirrors fetch + makes asymmetry legible. | ✓ |
| Flat list + direction cue | One list, per-row direction indicator + chip. Denser, weaker direction read. | |
| Grouped by rel-type | Subgroups by type, mixing directions via inverse labels. Splits the create/remove asymmetry. | |

**User's choice:** Grouped by direction
**Notes:** Feeds the G-2 sketch (which finalizes visuals). Incoming rows use the backend `_INVERSE_LABEL` vocabulary ("Superseded by") — single source of truth, frontend mirrors backend.

---

## States & live update

### Q1 — After a create or remove, how should the section update?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-fetch the list | Re-fetch relationships on success + re-render. Matches 112 reconcile; most honest (shows server truth: follow-to-latest, inverse labels, masking). | ✓ |
| Optimistic + reconcile | Insert/remove immediately then reconcile. Snappier, but optimistic row can't compute masked/inverse/follow-to-latest — brief mis-render. | |

**User's choice:** Re-fetch the list
**Notes:** Honest states (empty / loading / error / no-access) follow the 112 precedent; empty ≠ error. Exact copy/skeleton = sketch + planner.

---

## Claude's Discretion

- Read-seam route shape, response model, and extraction mechanism (D-117-7 — policy locked: share, don't fork).
- Typeahead candidate data source + where the self/already-linked exclusion is computed.
- Empty/error copy, skeleton design, chip styling, optional section count/warn badge, create-dialog mobile behavior — all subject to the G-2 sketch.
- Whether inverse-label display strings are formatted in the frontend or pre-formatted by the read endpoint.

## Deferred Ideas

- Direction toggle in the create form (author incoming from A's panel) — revisit only if the detour is painful.
- Relationship graph visualization — out of v3.0 Tier A scope (later).
- Agent-driven create/remove of relationships — deferred at 116; agent stays read-only.
- Versions accordion section in the detail panel — separate later work.
- DM feature-flag UI gating of all DM surfaces — flag exists but UI-enforced nowhere; cross-cutting phase if wanted.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — `todo.match-phase` score 0.2 (matched only "before"); off-domain. Not folded.
