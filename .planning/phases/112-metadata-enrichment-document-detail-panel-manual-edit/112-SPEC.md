# Phase 112: Metadata Enrichment — Document Detail Panel + Manual Edit — Specification

**Created:** 2026-06-17
**Ambiguity score:** 0.15 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

Give users a first-class **document detail panel** that displays each metadata value alongside its per-field confidence and lets them correct any value inline — every edit persisting to `documents.metadata` through a net-new audited write path, and protected from silent re-extraction overwrites. The panel is the net-new shared shell that Phases 117 (relationships) and 118 (classification) will later inhabit.

## Background

Current state, verified against the codebase 2026-06-17:

- **No detail surface exists.** Documents only render in `DocumentList.tsx`; clicking a row expands it inline (accordion) into a plain-text `MetadataPanel` (title/author/date/type/language) — **no confidence shown, no editing**.
- **Per-field confidence is already real** (Phase 111): extraction stores it in `documents.metadata._confidence`, drops empty fields via `exclude_none=True`, and the flat `documents.metadata @> filter` JSONB containment pre-filter is a load-bearing invariant (D-111-9). It is never surfaced in the UI.
- **`metadata.update` is already a valid `audit_log` action** (Phase 110 audit-enum extension); custom fields exist via the `/metadata-fields` CRUD router + `metadata_field_definitions` table.
- **No metadata-write endpoint exists** — `documents.metadata` is written only at ingest. A `POST /reextract` path exists and overwrites metadata wholesale.
- **Reuse primitives exist:** `StatusPill` (chip clone target), `PanelSection` (accordion shell + warn-count badge), `FolderNode` (inline-edit pattern), panel-scoped AA tokens, `fileIcons.getFileIcon()`. Only a chat-only `ConfidenceBadge` exists — it is NOT reusable here (no glyph/label/honesty enforcement).

The design is locked by sketches **027** (right-side push/split shell, winner A) + **028** (ConfidenceChip + honest inline edit, winner A), packaged into the `sketch-findings-agentic-rag` project skill (`references/document-detail-panel.md` + `sources/028-confidence-and-edit/GROUNDING.md`). G-2 (sketch-before-plan) is satisfied.

This phase delivers META-02 (see per-field confidence) and META-05 (manually edit/override, audit-logged).

## Requirements

1. **Document detail panel (shared shell)**: Opening a document reveals a right-side push/split detail panel; the document list shrinks but stays visible.
   - Current: No detail surface; metadata only appears as inline plain-text expansion inside a `DocumentList` row.
   - Target: Clicking a document opens a ~430px right-side panel (`minmax(0,1fr) 430px`), built as a `PanelSection` accordion with a `Metadata` section open by default; the shell is architecturally able to host future sections (117/118) with no rework; mobile falls back to a bottom-sheet.
   - Acceptance: On desktop, opening a document shows the panel WITH the document list still visible; on mobile (≤ the project breakpoint) it renders as a bottom-sheet; the Metadata section renders inside a `PanelSection` accordion; closing the panel restores focus to the trigger.

2. **Per-field ConfidenceChip (META-02)**: Each metadata value displays its per-field confidence as a chip that never relies on colour alone.
   - Current: `documents.metadata._confidence` is stored (Phase 111) but never displayed; no `ConfidenceChip` primitive exists.
   - Target: A net-new `ConfidenceChip` (cloned from `StatusPill` anatomy) renders next to each value as **[glyph] + [tier WORD] + [· raw score]** — High `✓ High · 0.96`, Med `● Med · 0.63`, Low `⚠ Low · 0.41`; tiers are hardcoded constants **High ≥ 0.75 / Med ≥ 0.50 / Low < 0.50**; the score shown is the raw stored value, never rescaled to a percentage.
   - Acceptance: A field with `_confidence = 0.41` shows "⚠ Low · 0.41" (glyph + word + raw score, not colour-only); a field at 0.96 shows "✓ High · 0.96"; no field displays a rescaled percentage.

3. **Honest confidence states**: Confidence display never fabricates authority the model didn't earn.
   - Current: No confidence UI, so no honesty contract is enforced.
   - Target: (a) a manually-overridden field shows a NEUTRAL "✎ Edited" chip with NO score and NO success-green; (b) a stored value with no `_confidence` entry shows a neutral "✦ Extracted" chip, NEVER a fabricated "High"; (c) an empty field (`exclude_none` absent) shows a "Not extracted — add" affordance, never a fake blank; (d) a low-confidence value's text itself renders tentative (italic + dimmed + leading ⚠) so flagged rows survive greyscale triage.
   - Acceptance: An edited field shows "✎ Edited" with no numeric score and no green; an unscored stored value shows "✦ Extracted" (not "High"); an absent field shows "Not extracted — add"; a Low value reads tentative in a greyscale screenshot.

4. **Audited metadata-write endpoint + inline edit (META-05)**: A user can correct any value inline and the change persists with an audit row.
   - Current: No metadata-write endpoint exists; `documents.metadata` is write-once at ingest; inline edit is impossible (a Phase-101/104-class false-green risk if the UI is built without the endpoint).
   - Target: A net-new authenticated, RLS-owner-scoped `PATCH /documents/{id}/metadata` persists a single field edit into `documents.metadata` and calls `write_audit_entry(..., 'metadata.update', ...)`. The UI edits in place (click value → type-appropriate control; Enter saves, Esc cancels; blur saves) and shows a "🛡 Saved · audit logged" receipt ONLY after the write succeeds.
   - Acceptance: Editing `title` and saving updates `documents.metadata.title` AND inserts an `audit_log` row with `action_type='metadata.update'` for that document — **verified live against :54322**; a non-owner request returns 404 (no existence leak); the "Saved · audit logged" receipt does not appear on a failed write.

5. **Edit protection from re-extraction (source marker)**: A human correction is never silently overwritten by a later re-extraction.
   - Current: `POST /reextract` overwrites `documents.metadata` wholesale — a manual correction would be lost.
   - Target: Each field carries a `source: user | extracted` marker; a manual edit sets `source=user`; re-extraction preserves `source=user` fields (does not overwrite them) while refreshing `source=extracted` fields; the re-extract-vs-override precedence is explicit and documented in code.
   - Acceptance: Edit field A (→ `source=user`), trigger re-extract: field A's value is unchanged while an un-edited field B is refreshed; the flat `metadata @>` containment pre-filter still matches after the markers are added (D-111-9 invariant holds, verified live).

6. **Custom-field display + edit**: User-defined custom fields are first-class in the panel, not just built-ins.
   - Current: Custom fields (`metadata_field_definitions`, Phase 111) are extracted into `documents.metadata` with confidence but have no display or edit surface.
   - Target: The panel renders each enabled custom field (per its field definition) with the same ConfidenceChip + honest inline-edit behavior as the built-in fields; custom-field edits persist via the same `PATCH` endpoint using a defined value shape.
   - Acceptance: A document with an extracted custom field shows that field + its confidence chip in the panel; editing it persists, writes a `metadata.update` audit row, and the new value round-trips after a reload.

7. **UX-01 design + accessibility compliance (cross-cutting)**: The panel meets the project's visual and accessibility bar.
   - Current: N/A — new surface.
   - Target: Panel matches the Deep Midnight / Aether design system; uses panel-scoped AA tokens (never global `--muted-foreground` at 3.59:1); the chip never relies on colour alone (WCAG 1.4.1); the accordion uses APG `aria-expanded`/`aria-controls`/`role=region`; inline edit is keyboard-operable (autofocus, Enter/Esc/blur); motion is gated by `prefers-reduced-motion` (the save receipt still renders instantly when motion is off); mobile bottom-sheet fallback.
   - Acceptance: An automated contrast check (aXe or equivalent) reports no AA failures on the panel; chip meaning survives greyscale; the panel open/close, accordion toggle, and field edit are all reachable and operable by keyboard alone; a reduced-motion user still sees the save receipt.

## Boundaries

**In scope:**
- The right-side push/split **document detail panel** as a reusable `PanelSection` accordion shell, with the **Metadata section only** rendered now.
- A net-new **`ConfidenceChip`** primitive (glyph + tier word + raw score; honest neutral Edited/Extracted/empty states; tentative low-value typography).
- A net-new **`PATCH /documents/{id}/metadata`** endpoint — RLS-owner-scoped, writes a `metadata.update` audit row.
- **Honest inline edit** (click-to-edit, Enter/Esc/blur, "Saved · audit logged" receipt) for **both built-in and custom fields**.
- A per-field **`source: user | extracted`** marker + **re-extract precedence** that preserves user edits.
- **Editing an empty field = adding a value** (which then becomes a `source=user` override).
- **Hardcoded display tier thresholds** (High ≥ 0.75 / Med ≥ 0.50 / Low < 0.50) as named constants.
- **UX-01** compliance (Deep Midnight / Aether, mobile bottom-sheet, WCAG 2.1 AA).

**Out of scope:**
- **Relationships, Classification, and Versions accordion sections** — owned by Phases 117 / 118 (and a later versions pass). The shell is architecturally ready, but no inert/placeholder stubs ship now — honesty (no signposts to features that don't work yet).
- **A Settings knob for display tier thresholds** — marginal value, adds a settings surface + migration; hardcoded constants suffice because the raw score is always shown. Deferrable to a later governance/settings pass.
- **Bulk "confirm all extracted"** — deliberately CUT (mass-asserting human authority over un-reviewed values manufactures false provenance and floods the audit log) per sketch 028.
- **Triggering / re-running re-extraction from the panel** — the `POST /reextract` path already exists; this phase only ensures it RESPECTS the `source=user` marker.
- **Changing the extraction engine, model, or window** — Phase 111 territory.
- **Rescaling confidence into a percentage** — violates the honesty contract.
- **Reusing the `0.54/0.38` retrieval-confidence buckets** as the metadata display tiers — they are a different system.

## Constraints

- **Flat `@>` containment invariant (D-111-9):** the `documents.metadata @> filter` JSONB containment pre-filter MUST keep matching after the `_confidence` and per-field `source` markers are present — they must not break top-level key containment. Verified live against :54322.
- **`exclude_none=True` preserved:** empty fields remain absent and render as "Not extracted — add"; never coerce an empty value to `""`.
- **RLS discipline:** `PATCH /documents/{id}/metadata` is owner-scoped; a non-owner gets 404 (no existence leak), matching the project RLS precedent.
- **Audit enum already covers it:** `metadata.update` is already in `VALID_ACTION_TYPES` (Phase 110) — no new audit-enum migration is needed for the action type. A migration MAY still be required for the `source` marker / custom-field value storage shape (decided at plan-phase — a HOW decision).
- **No shared-path regressions:** Deep/chat surfaces and the ingest/extraction path stay untouched except for the additive re-extract precedence guard; reuse `StatusPill`, `PanelSection`, `FolderNode`, panel AA tokens, and `fileIcons.getFileIcon()` rather than reinventing.

## Acceptance Criteria

- [ ] Clicking a document opens a right-side detail panel with the document list still visible (desktop) / a bottom-sheet (mobile); the Metadata section renders inside a `PanelSection` accordion.
- [ ] Each metadata value shows a `ConfidenceChip` with glyph + tier word + raw score (e.g. "⚠ Low · 0.41"), tiers High ≥ 0.75 / Med ≥ 0.50 / Low < 0.50, raw value (not a percentage).
- [ ] A manually-edited field shows a neutral "✎ Edited" chip (no score, no green); an unscored stored value shows "✦ Extracted" (not a fabricated "High"); an absent field shows "Not extracted — add".
- [ ] A low-confidence value's text reads tentative (italic + dimmed + leading ⚠) and is distinguishable in greyscale.
- [ ] `PATCH /documents/{id}/metadata` persists a single field edit into `documents.metadata` AND writes an `audit_log` row with `action_type='metadata.update'` — verified live against :54322.
- [ ] A non-owner `PATCH` returns 404; the "Saved · audit logged" receipt only appears after a successful write.
- [ ] After editing a field then triggering `POST /reextract`, the user-edited (`source=user`) field value is preserved while an un-edited field is refreshed.
- [ ] The flat `metadata @> filter` containment pre-filter still matches after `_confidence` + `source` markers are present (D-111-9), verified live.
- [ ] A custom field (from `metadata_field_definitions`) displays with its confidence chip and is editable in the panel; the edit persists and round-trips on reload.
- [ ] Inline edit supports click-to-edit, Enter (save), Esc (cancel); editing an empty field adds a value.
- [ ] Automated contrast check reports no WCAG 2.1 AA failures on the panel; the panel, accordion, and field edit are fully keyboard-operable; reduced-motion users still see the save receipt.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Panel + chip + audited edit + custom fields, sketch-locked   |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Metadata-only shell-ready; source-marker IN; stubs/knob OUT  |
| Constraint Clarity | 0.80  | 0.65 | ✓      | `@>` invariant, exclude_none, RLS 404, audit enum present    |
| Acceptance Criteria| 0.82  | 0.70 | ✓      | 11 pass/fail criteria, live audit + re-extract precedence    |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      | Gate passed after 1 boundary round                           |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                                        |
|-------|-----------------|-------------------------------------------|------------------------------------------------------------------------|
| 0     | Researcher      | What exists today vs the target?          | No detail panel/chip/write-endpoint; confidence + audit enum + custom-field CRUD already real (Phase 110/111); sketches 027+028 locked |
| 1     | Boundary Keeper | How much of the shared shell ships now?   | Metadata-only, shell-ready — no inert REL/CLASS/Versions stubs (honesty; 117/118 plug in later) [Claude recommendation, operator-delegated] |
| 1     | Boundary Keeper | Protect manual edits from re-extraction?  | Yes — per-field `source: user\|extracted` marker + explicit re-extract precedence (operator-chosen) |
| 1     | Boundary Keeper | Custom fields in display + edit, or built-ins only? | Built-in AND custom fields — META-01 is the point of v3.0 enrichment [Claude recommendation, operator-delegated] |
| 1     | Boundary Keeper | Tier thresholds: settings-driven or hardcoded? | Hardcoded constants High ≥ 0.75 / Med ≥ 0.50 / Low < 0.50; raw score always shown; settings knob OUT [Claude decision] |

---

*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Spec created: 2026-06-17*
*Next step: /gsd:discuss-phase 112 — implementation decisions (the `source` marker + custom-field value storage shape, the PATCH contract details, the panel mount/entry-point wiring)*
