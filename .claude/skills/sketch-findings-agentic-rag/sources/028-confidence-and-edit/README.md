---
sketch: 028
name: confidence-and-edit
question: "How does per-field confidence read (the ConfidenceChip), and how does inline edit / manual-override feel — inside the 027-A panel?"
winner: A
tags: [phase-112, confidence-chip, inline-edit, manual-override, honesty, wcag, a11y]
---

# Sketch 028: Confidence + Inline Edit

## Design Question
This is the heart of Phase 112: the per-field **confidence chip** (so a user instantly sees
which extracted values to trust) and **inline edit / manual override** (so they can correct the
shaky ones). It lives inside the **027-A right-side panel** shell. Built from a grounded design
workflow — three independent lenses (calm-Linear / honesty-forward / dense-triage) judged and
synthesized; the judge scored honesty-forward 88, calm-Linear 86, dense-triage 82, and grafted
the best of each.

## How to View
```
open .planning/sketches/028-confidence-and-edit/index.html
```
- **Click any value** (or "＋ Not extracted — add" on an empty field) → it becomes an inline editor
  (Enter saves, Esc cancels). Watch the chip morph to a neutral **"✎ Edited"** (no score), the
  **"🛡 Saved · audit logged"** receipt, and the needs-review count tick down.
- **Try the Charter's** empty *Author*, the low-confidence *Project phase* / *Owner*, and *Region*
  (a value with **no** confidence score → neutral **"✦ Extracted"**, never a fake "High").
- **Triage:** "↑ Review low first", "⧩ Only needs-review", "Jump to next ↓".
- **ⓘ (panel header)** opens **Build notes** — what's real today vs. net-new for Phase 112.

## Variants
- **A — Trust-gutter + scored chips ★ (recommended)** — the full synthesis. Every model-scored
  field shows a chip = **glyph + tier word + raw score** (`✓ High · 0.96`); a 2px decorative
  spine runs down the column (green/amber/red/primary) for an at-a-glance certainty read; Low
  values themselves read *tentative* (italic + dimmed + ⚠). Manual edit → neutral "Edited" chip +
  solid-primary spine + the audit receipt.
- **B — Decrescendo (quiet at High)** — same machine, tests calm-Linear's extreme on the one open
  dimension (chip form): **High renders almost nothing** — just a hairline ✓ in muted, score in
  the tooltip; Med a quiet chip; Low a loud one. No spine. *Does dropping the score at High read
  as calmer, or as less scannable/honest?*
- **C — Dense triage (needs-review first)** — same scored chips, but Low + empty fields are
  **grouped to the top** under a "⚠ Needs review" subhead by default, with the "Only needs-review"
  work-queue filter. No spine (the grouping is the signal). *Does reordering accelerate the fix
  loop, or disorient the read-mostly case?*

> **Bulk-confirm ("confirm all extracted") was deliberately cut** from all variants — mass-asserting
> human authority over values you never individually reviewed manufactures false provenance.

## What to Look For
- **Never colour alone** (WCAG 1.4.1): every chip carries glyph **+ tier word + score**; Low also
  gets italic + ⚠ + dimming, all of which survive greyscale.
- **The honesty flip:** a model score (`Low · 0.34`) becomes a human-owned **"Edited"** with *no
  score* — because once you set it, the model is no longer the authority.
- **`exclude_none` honesty:** empty fields show "Not extracted", never a fake blank; editing one is
  how you *add* a value.
- **Custom fields** (◆) sit beside standard fields.

## Build Handover — real vs net-new (verified against the codebase, correcting a workflow grounding error)
- ✅ **REAL today:** per-field confidence in `documents.metadata._confidence` (`embedding_service.py`
  `attach_confidence`/`build_metadata_model`, Phase 111) — chips render on real data. `exclude_none`
  drops empty fields. `metadata.update` is already in `VALID_ACTION_TYPES`. The `/metadata-fields`
  CRUD router exists.
- 🟣 **NET-NEW (Phase 112):** the **save-edited-metadata endpoint** (`POST/PATCH /documents/{id}/metadata`)
  — there is **no** metadata-write route today (metadata is set only at upload). A per-field
  **`source: user|extracted`** marker (so re-extraction never silently overwrites edits). The
  custom-field-value edit-persistence path. → the receipt must not claim "audit logged" until the
  write path is wired (the Phase 101/104 false-green class).
- **Reuse map:** clone `StatusPill` anatomy for `ConfidenceChip` (NOT chat-only `ConfidenceBadge`);
  `FolderNode` inline-edit pattern; `PanelSection` accordion + warn-count badge; panel-scoped AA
  tokens (`--panel-status-done/active`, `--panel-muted-foreground` — never global `--muted-foreground`);
  motion `fadeSlideUp`/`checkPop` gated by `prefers-reduced-motion`.
- **Tier thresholds** are settings-driven (a 112 decision); the `0.54/0.38` in the codebase are
  *retrieval* buckets — a different system. The sketch uses legible cuts (0.75 / 0.5) as placeholders.
