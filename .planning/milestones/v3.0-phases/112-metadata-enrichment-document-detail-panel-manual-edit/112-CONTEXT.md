# Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A net-new right-side **document detail panel** on the documents page (`IngestionPage`) that displays each metadata field alongside its per-field confidence (`ConfidenceChip`) and lets users correct any value inline — persisted through a new audited write path (`PATCH /documents/{id}/metadata` → `metadata.update`) and protected from re-extraction. Delivers META-02 (see per-field confidence) + META-05 (manual edit, audit-logged). The panel is the shared shell that Phases 117 (relationships) and 118 (classification) will later inhabit.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `112-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read it before planning/implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Right-side push/split detail panel as a reusable `PanelSection` accordion shell, with the **Metadata section only** rendered now.
- Net-new `ConfidenceChip` primitive (glyph + tier word + raw score; honest neutral Edited/Extracted/empty states; tentative low-value typography).
- Net-new `PATCH /documents/{id}/metadata` (RLS-owner-scoped, writes a `metadata.update` audit row).
- Honest inline edit (click-to-edit, Enter/Esc/blur, "Saved · audit logged" receipt) for **built-in AND custom fields**.
- Per-field `source: user|extracted` marker + re-extract precedence preserving user edits.
- Editing an empty field = adding a value (becomes a `source=user` override).
- Hardcoded display tier thresholds (now **High ≥ 0.75 / Med ≥ 0.50 / Low < 0.50** — see D-05).
- UX-01 (Deep Midnight / Aether, mobile bottom-sheet, WCAG 2.1 AA).

**Out of scope (from SPEC.md):**
- Relationships / Classification / Versions accordion sections (117/118 + later) — shell ready, no inert stubs shipped now.
- A Settings knob for display tier thresholds.
- Bulk "confirm all extracted" (manufactures false provenance).
- Triggering/re-running re-extraction from the panel (only RESPECT the source marker).
- Changing the extraction engine/model/window (Phase 111 territory).
- Rescaling confidence into a percentage; reusing the retrieval `0.54/0.38` buckets as metadata tiers.

</spec_lock>

<decisions>
## Implementation Decisions

### Panel entry-point & the current inline expand
- **D-01:** Clicking a document row opens the right-side push/split detail panel; the **existing inline-expand `MetadataPanel` in `DocumentList.tsx` is RETIRED** — one honest metadata surface, no duplication/drift. The panel mounts at the `IngestionPage.tsx` layout level wrapping `DocumentList` (push/split grid `minmax(0,1fr) 430px`, list shrinks but stays visible). Mobile (≤ project breakpoint) falls back to a bottom-sheet (sketch 027).

### Metadata storage shape (the `source` marker)
- **D-02:** The per-field `source` marker is stored as a **parallel `metadata._source.{field}` sub-key**, mirroring the existing `metadata._confidence.{field}` pattern from Phase 111. Top-level field values stay flat, so the `documents.metadata @> filter` JSONB containment pre-filter (the load-bearing **D-111-9** invariant) is unaffected. No nested per-field `{value,source,confidence}` objects (would break containment + force a filter rework).

### Edit + re-extract contract
- **D-03:** A net-new **`PATCH /documents/{id}/metadata`** accepts a single `{field, value}` (built-in field name OR custom `field_key`). Server: writes the value into `documents.metadata[field]`, stamps `_source[field]='user'`, and writes a `metadata.update` audit row via `write_audit_entry`. **RLS owner-scoped** — a non-owner gets **404** (no existence leak). Re-extraction (`POST /{id}/reextract` → `ingest_document` enriched path) **MERGES**: fields with `_source='user'` are preserved (value + source + their "Edited" status, no confidence), every other field is refreshed from the model. A user-owned field renders the neutral **"✎ Edited"** chip (no score, no green). Single-field PATCH (not whole-object PUT) avoids clobber/concurrency hazards.

### Custom-field rendering
- **D-04:** The panel **fetches enabled custom-field definitions from the existing `/metadata-fields` CRUD** (`backend/app/api/metadata_fields.py`), renders each with an edit control chosen by its `field_type`, and **ignores internal `_`-prefixed keys** (`_confidence`, `_source`). Custom-field values persist via the SAME PATCH endpoint under their `field_key`. The panel renders the union of (known built-in fields) + (enabled custom defs) — never raw metadata keys.

### Display tier thresholds (REFINED from SPEC via live data)
- **D-05:** Metadata display tiers = hardcoded named constants **High ≥ 0.75 / Med 0.50–0.74 / Low < 0.50** (NOT a settings knob; NOT the retrieval `confidence_bucket_*` settings). **Evidence (live :54322, 8 enriched docs / 53 field scores):** confidence is **bimodal** — median **0.95**, mean 0.92, **94% ≥ 0.80**, with a ~4% cluster at ~0.05 (uncertain/guessed fields); the 0.50–0.79 band is nearly empty. So 0.80 is *easily* achievable (the "0.8 rarely achievable" worry was unfounded), but because scores cluster high, **most populated fields read High and the chip's triage value is catching the rare Low** (reinforced by the tentative-value typography + the "Not extracted — add" empty-state). High lowered 0.80→0.75 to match the user's instinct and the app's own retrieval calibration (0.54), with negligible data impact. **Raw score is always shown → the chip is honest regardless of the boundary.** Treat as a **tunable constant; re-verify against the live distribution at UAT.** Metadata display tiers are a SEPARATE system from retrieval confidence (`confidence_bucket_high/medium` 0.54/0.38, `agent_loop.py:692`) — never conflate (the sketch's explicit warning).

### No new migration
- **D-06:** Phase 112 needs **NO new SQL migration**. `_source` lives inside the existing `documents.metadata` JSONB; `metadata.update` is already a valid `audit_log` action (Phase 110, migration 071). Purely additive: one backend route + the re-extract merge guard + frontend.

### Reported-bugs cross-check (MANDATORY touchpoint)
- **D-07:** No open `surface: Agentic-RAG` bug overlaps the document-detail / metadata-display-edit domain — all open bugs sit in chat/streaming/harness/provider surfaces (workspace panel, composer, minimax, agent-banner). BUG-260616-01 touches "metadata-extraction" but it's the extraction-*routing* trap already folded+closed in 111.1, not display/edit. **Routing: leave all open; none fold into 112.**

### UAT scope
- **D-08:** Phase 112 does **NOT** touch streaming, agent loop, or provider routing — the **SC#10 4-axis cross-provider UAT does NOT apply** (cross-provider extraction correctness was Phase 111's gate). Acceptance = **G-4 lived-experience UI UAT** (click → panel → inline edit → persist → `metadata.update` audit row verified live; re-extract preserves a user edit; `@>` still matches) + **WCAG 2.1 AA** + the **honest-states matrix** (High/Med/Low + Edited + Extracted/unscored + empty "add").

### Claude's Discretion
- Edit concurrency model (optimistic UI + last-write-wins on a single field is acceptable — owner-scoped, effectively single-writer).
- Exact edit-control mapping per `field_type` (text / textarea / date / select) and whether array fields (e.g. `topics`) are editable as chips in v1 or text-only.
- Save-receipt animation timing + the `prefers-reduced-motion` instant-render path.
- Whether the PATCH body is one field or a tiny partial map (single field is the contract; a small batch is an allowed optimization if needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements (read first)
- `.planning/phases/112-metadata-enrichment-document-detail-panel-manual-edit/112-SPEC.md` — **Locked requirements, boundaries, acceptance criteria. MUST read before planning.**

### Design contract (G-2 sketches 027 + 028 — satisfied)
- `.claude/skills/sketch-findings-agentic-rag/references/document-detail-panel.md` — the panel shell + ConfidenceChip + honest-edit design decisions, reuse map, CSS patterns, what-to-avoid.
- `.claude/skills/sketch-findings-agentic-rag/sources/028-confidence-and-edit/GROUNDING.md` — exact chip/edit/a11y spec + the verified real-vs-net-new wire.

### Backend integration points
- `backend/app/api/documents.py` — host for the new `PATCH /documents/{id}/metadata` route; `reextract_document` (≈line 967) + `ingest_document` enriched path = the merge site for the `_source='user'` preservation guard.
- `backend/app/services/embedding_service.py` — `build_metadata_model` / `attach_confidence` / `_confidence` shape + the extraction confidence prompt (line ≈328); defines how `_confidence.{field}` is written (mirror for `_source`).
- `backend/app/services/audit_service.py` — `write_audit_entry` + `VALID_ACTION_TYPES` (already includes `metadata.update`).
- `backend/app/api/metadata_fields.py` + `backend/app/services/metadata_field_service.py` + `backend/app/models/metadata_field.py` — the `/metadata-fields` CRUD the panel fetches custom field defs from (filter to enabled, own-or-global).

### Frontend integration points
- `frontend/src/pages/IngestionPage.tsx` — where `DocumentList` is mounted; host for the push/split grid + selected-doc state.
- `frontend/src/components/ingestion/DocumentList.tsx` — current inline `MetadataPanel` (to RETIRE) + row-click wiring.
- `frontend/src/components/chat/StatusPill.tsx` — clone source for `ConfidenceChip` (NOT `chat/ConfidenceBadge.tsx`).
- `frontend/src/components/panel/PanelSection.tsx` — accordion shell + warn-count badge pattern.

### Calibration reference (do NOT reuse for metadata tiers)
- `backend/app/services/agent_loop.py` §≈664-695 + `backend/app/api/settings.py` / `backend/app/models/user_settings.py` (`confidence_bucket_high=0.54`/`medium=0.38`) — the **retrieval** confidence buckets. Separate system; named here so the planner does NOT conflate them with the metadata display tiers (D-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`StatusPill`** (`components/chat/StatusPill.tsx`): clone its `inline-flex rounded-full font-mono text-[10px]` anatomy for `ConfidenceChip`. Do NOT reuse `ConfidenceBadge` (chat-only, raw colour tokens, no glyph+label enforcement).
- **`PanelSection`** (`components/panel/PanelSection.tsx`): the accordion shell with APG `aria-expanded`/`aria-controls`/`role=region` + warn-count badge — the panel's section container.
- **`FolderNode`** inline-edit pattern: toggle `isEditing`, conditional render, `autoFocus`, Enter/Esc/blur, tight `focus:ring-1 ring-primary/40` — the click-to-edit model.
- **`fileIcons.getFileIcon()`**: panel header icon. Panel-scoped AA tokens (`--panel-status-done`/`-active`, lightened red `hsl(0 80% 80%)`, `--panel-muted-foreground`) — never global `--muted-foreground` (3.59:1, fails AA).
- **`write_audit_entry`** + `VALID_ACTION_TYPES` (already has `metadata.update`): the audit write for the PATCH route.

### Established Patterns
- **Flat `_`-sub-key + `@>` containment (D-111-9):** `_confidence` is a flat sub-key; add `_source` the same way so top-level containment still matches. Verify live.
- **`exclude_none=True`:** empty fields are ABSENT (not `""`) → render as "Not extracted — add".
- **`run_in_threadpool`** for sync `supabase-py` calls inside async routes (D-v2.5-01) — applies to the new PATCH route.
- **RLS owner-scope → 404 on non-owner** (no existence leak) — the project's metadata-write RLS posture.

### Integration Points
- `IngestionPage` gains the push/split grid + `selectedDocId` state; `DocumentList` row-click opens the panel instead of inline-expanding (inline `MetadataPanel` removed).
- New `PATCH /documents/{id}/metadata` in `documents.py`; `_source='user'` preservation merged into the `ingest_document` enriched re-extract path.
- Panel fetches enabled custom field defs from `/metadata-fields`.

</code_context>

<specifics>
## Specific Ideas

- **Honesty is load-bearing** (the whole point): manual override → neutral "✎ Edited" (no score, no green); unscored stored value → neutral "✦ Extracted" (never a fabricated "High"); empty field → "Not extracted — add"; a low-confidence VALUE itself reads tentative (italic + dimmed + leading ⚠). Lock the "no green on a manual override" in a code comment — reviewers will be tempted to "fix" it.
- Raw score is shown verbatim (e.g. `· 0.41`), never rescaled to a fake percentage.
- The user specifically validated that metadata display confidence is separate from retrieval confidence and that the tier boundary is a calibration detail (raw score always visible) — re-check the boundary against live data at UAT.

</specifics>

<deferred>
## Deferred Ideas

- **Settings-configurable metadata display tiers** — the infra pattern exists (`confidence_bucket_*` settings columns), so it's a small add IF users ask. Out of scope now (D-05); raw score keeps the chip honest with hardcoded constants.
- **Relationships accordion section** → Phase 117 (adds to THIS shell). **Classification accordion section** → Phase 118. **Versions section** → later (version data already exists via `fetchDocumentVersions`).
- **Governance "low-confidence metadata" signal** → Phase 119 links back into this panel's `ConfidenceChip`.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 112.

</deferred>

---

*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Context gathered: 2026-06-18*
