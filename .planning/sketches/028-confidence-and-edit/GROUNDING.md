# 028 Grounding — Confidence + Inline Edit (build spec)

Distilled from a grounded design workflow (3 lenses → judged → synthesized, ~493k tokens).
**The grounding agent made factual errors; the contract below is CORRECTED against the live
codebase (verified 2026-06-17).** Read this before building Phase 112's metadata panel.

## Verified data contract (real vs net-new)

**REAL today (do NOT rebuild):**
- Per-field confidence IS stored: `documents.metadata._confidence` is a `{field_key: 0.0-1.0}` map.
  Produced by Phase 111 enriched extraction — `build_metadata_model` builds a runtime schema
  (7 built-ins + enabled custom fields + a public `confidence` map), the LLM fills it via
  `forced_emit`, and `attach_confidence` (`embedding_service.py:233`) renames `confidence` →
  nested `_confidence` post-`model_dump(exclude_none=True)`. `_confidence` is DISPLAY-ONLY —
  never a flat `metadata_filter` dimension (D-111-3/9).
- `exclude_none=True` → empty fields are genuinely ABSENT in the JSONB, never coerced to `""`.
- `metadata.update` (and `metadata.field.create`) ARE in `VALID_ACTION_TYPES`
  (`audit_service.py:24`) — the audit action is ready; `write_audit_entry(user_id, action_type,
  metadata, supabase)` is fire-and-forget and swallows exceptions (D-05).
- `/metadata-fields` CRUD router EXISTS (`api/metadata_fields.py`); custom field defs live in
  `metadata_field_definitions` (closed `field_type` vocab enforced in the Pydantic model).
- Reuse primitives: `StatusPill` (chip anatomy), `FolderNode` (inline edit), `PanelSection`
  (accordion + warn-count badge), `ConfidenceBadge` (chat-only — do NOT reuse for the chip),
  `fileIcons`, panel-scoped AA tokens.

**NET-NEW for Phase 112 (the real work):**
- A **metadata-write endpoint** — `POST`/`PATCH /documents/{id}/metadata`. NONE exists today;
  metadata is written only at ingest (a background task). Without it inline edit is non-functional
  (the Phase 101/104 false-green class). Must validate standard + custom fields and call
  `write_audit_entry(..., 'metadata.update', ...)`.
- A per-field **`source: user | extracted`** marker so re-extraction (`POST /reextract` exists)
  never silently overwrites a manual edit; define re-extract-vs-override precedence.
- The **custom-field value edit-persistence** path (storage shape decision).
- **Tier thresholds for metadata** — a 112 decision. The `0.54/0.38` in the codebase
  (`app_settings.confidence_bucket_high/medium`, `agent_loop.py` `_compute_confidence`) are
  RETRIEVAL buckets, a DIFFERENT system. Don't blindly reuse them for display.

## Synthesis build spec (winner: 028-A)

**ConfidenceChip** (`frontend/src/components/metadata/ConfidenceChip.tsx`, clone StatusPill):
`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase
tracking-wider`. Three inseparable atoms (never-colour-alone): **[glyph aria-hidden] + [tier WORD]
+ [· score tabular-nums]**.
- HIGH: CheckCircle2 + "High" + raw score; `bg-[hsl(var(--panel-status-done)/0.15)]
  text-[hsl(var(--panel-status-done))]` (10.63:1).
- MED: filled dot + "Med" + score; `--panel-status-active` (10.48:1).
- LOW: AlertTriangle + "Low" + score; `bg-destructive/15 text-[hsl(0_80%_80%)]` (≥4.5:1 — NEVER
  raw `--destructive` for text).
- Score = raw 2-decimal value, NOT rescaled to a fake %. Tooltip names the threshold source.
- MANUAL-OVERRIDE → NEUTRAL provenance chip: PencilLine + "Edited", **no score, no green**
  (`bg-transparent border-border text-panel-muted-foreground`). Green would falsely imply model
  confidence — locked rationale, code-comment it.
- EXTRACTED-NO-SCORE (value but no `_confidence` entry) → neutral Sparkles + "Extracted", no score.
  **NEVER fabricate "High".**

**Field states** (5) in a `grid grid-cols-[2px_1fr]` row; col 1 = decorative aria-hidden
trust-gutter spine (high green / med amber / low red / manual solid-primary / empty faint).
LOW value reads tentative: italic + `--panel-muted-foreground` + leading AlertTriangle (survives
greyscale). EMPTY = focusable dashed "Not extracted — add" button (the edit trigger; on save →
manual, emit `metadata.field.create`/null-old).

**Inline edit** (FolderNode pattern, no panel-wide mode, no bottom Save bar): value is a `<button>`
→ click/Enter swaps to a type-appropriate control in place (string→Input h-8 `focus:ring-1
ring-primary/40`; summary→Textarea; date→date Input; select→Select; multiselect/topics→pill editor).
"will become · Edited" hint replaces the chip while editing. Enter commits if dirty (Cmd/Ctrl+Enter
in Textarea); Esc cancels + restores focus to trigger (useRef); guarded blur-commit (only if changed
& not Esc & focus didn't move to Save/Cancel — mobile keyboard guard). PATCH → on 200 → MANUAL state;
inline **"🛡 Saved · audit logged"** receipt (fadeSlideUp, ~4s) + `role=status aria-live=polite`;
chip cross-fades + `checkPop` on the new glyph; Low value de-italicizes. ERROR keeps edit mode,
value preserved, `role=alert` assertive "Couldn't save — your change wasn't recorded" (honest inverse).

**Triage** (scan→fix→next): honesty banner ("✦ AI-extracted · N need review · last verified by you");
`PanelSection` warn=true amber count of LOW+EMPTY (→ "✓" at 0; reconcile via fetch — Realtime is
best-effort D-v2.5-03); "Review low first" toggle; "Jump to next ↓" (roving focus to next Low);
optional "Only needs-review" filter. **Default sort = schema order** (Low rows already pre-attentively
visible). **Bulk-confirm CUT** — manufactures false provenance + floods the audit log.

**a11y checklist:** never-colour-alone (glyph+word+score; Low also italic+triangle+dim);
contrast verified on `--panel-surface #0c121d` (assert in code comments, panel-scoped tokens only,
NEVER global `--muted-foreground` 3.59:1); focus rings (global ring-2; inline ring-1 ring-primary/40);
focus management (autofocus+select on open, Esc→trigger, post-commit→next Low/Med); ARIA live split
(polite for save/count, assertive for errors); sr-only disambiguation per editable value; roving
keyboard (j/k/Arrow, Enter edit, n jump-next-low, Esc cancel); `aria-busy` while saving; PanelSection
APG accordion reused; motion gated by `prefers-reduced-motion` (honesty receipt still renders instantly);
vitest-axe asserts focus-trap escape, polite/assertive split, glyph+word on all states, **and that an
unscored field NEVER renders "High"**.

## Variants explored
- **A ★ (chosen):** trust-gutter spine + scored chips + tentative-low values + neutral Edited.
- B — decrescendo: High nearly chrome-less (score in tooltip), no spine. (calm but less scannable)
- C — dense triage: needs-review-first grouping + roving keyboard + work-queue filter, no spine.
