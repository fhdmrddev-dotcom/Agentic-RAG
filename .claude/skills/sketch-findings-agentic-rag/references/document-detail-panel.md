# Document Detail Panel & Metadata Editing (Phase 112)

The net-new **document-detail surface** — and the per-field **confidence display + honest inline
edit** that lives inside it. This is the v3.0 Document-Management equivalent of the workspace
panel: a shared shell that later phases plug sections into. Synthesized from sketches **027**
(shell form) + **028** (confidence chip + inline edit).

> **Build spec lives in `sources/028-confidence-and-edit/GROUNDING.md`** — the corrected
> real-vs-net-new contract + exact chip/edit/a11y spec. Read it before writing code.

---

## Design Decisions

### 1. The detail surface = a right-side push/split panel (sketch 027 winner A)
Opening a document slides a ~430px detail panel in from the right (`minmax(0,1fr) 430px`); the
document list **shrinks but stays visible**. This won over a full-page view and a modal because
the core action of Phase 112 is *correcting* metadata — a **scan → fix → next** loop — and a panel
keeps the list in view so you tab document→document without losing your place. It also matches the
established "push, never overlay" philosophy ([panel-shell.md](panel-shell.md)) and has a known
mobile fallback (bottom-sheet).

**It is a SHARED SHELL.** Organized as **stacked-accordion sections** (the 004-B pattern):
`Metadata` (open) · `Relationships` (Phase 117) · `Classification` (Phase 118) · `Versions`.
→ **Phase 117 and Phase 118 add their sections to THIS panel — they do not build a new surface.**
Rejected: full-page view (interrupts the correction loop), centered modal (breaks push-not-overlay
+ cramps once REL/CLASS pile in), enriched expand-in-place (too tight in a table row).

### 2. ConfidenceChip = glyph + tier word + raw score, never colour-alone (sketch 028 winner A)
A net-new primitive. Three inseparable atoms (WCAG 1.4.1): **[glyph] + [tier WORD] + [· raw score]**.
- HIGH `✓ High · 0.96` (success green) · MED `● Med · 0.63` (warning amber) · LOW `⚠ Low · 0.41`
  (lightened red — never raw `--destructive` for text).
- Score is the raw value, **not rescaled to a fake %** (don't manufacture precision).
- Tier thresholds are **settings-driven (a 112 decision)** — the `0.54/0.38` buckets in the codebase
  are *retrieval* confidence, a DIFFERENT system; do not blindly reuse them for metadata display.

### 3. Honesty is load-bearing (the whole point of the surface)
- **Manual override → a NEUTRAL "✎ Edited" chip with NO score and NO green.** Once a human sets a
  value the model is no longer the authority — a green/scored chip would lie. (Lock this in a code
  comment; reviewers will be tempted to "fix" it to green.)
- **A stored value with no `_confidence` entry → neutral "✦ Extracted" chip, NEVER a fabricated
  "High".** A green check on data the model never scored is a lie.
- **Empty fields (`exclude_none`) → "Not extracted — add", never a fake blank.** Editing an empty
  field is how you *add* a value (it then becomes a manual override).
- **A low-confidence VALUE itself reads tentative** (italic + dimmed + leading ⚠), so flagged rows
  are pre-attentively visible — the value typography, which survives greyscale, is the triage signal.
- Saving surfaces a **"🛡 Saved · audit logged"** receipt (the `metadata.update` audit). The receipt
  must NOT claim "logged" until the write path is actually wired (see net-new below).

### 4. Inline edit = correction, not a form (sketch 028 winner A)
No panel-wide edit mode, no bottom Save bar. Click a value → it becomes a type-appropriate control
in place; Enter saves, Esc cancels; a "will become · Edited" hint replaces the chip while editing.
Triage helpers: an honesty banner ("✦ AI-extracted · N need review"), a `PanelSection` warn-count
badge, "Review low first", "Jump to next ↓". **Bulk-confirm ("confirm all extracted") was
deliberately CUT** — mass-asserting human authority over un-reviewed values manufactures false
provenance and floods the audit log.

---

## Verified reuse map (port these, don't reinvent)
- **`ConfidenceChip`** → clone `StatusPill` anatomy (`inline-flex rounded-full font-mono text-[10px]`).
  **NOT** the chat-only `ConfidenceBadge` (display-only, raw colour tokens, no glyph+label enforcement).
- **Inline edit** → the `FolderNode` pattern (toggle `isEditing`, conditional render, `autoFocus`,
  Enter/Esc/blur, tight `focus:ring-1 ring-primary/40`).
- **The panel shell + sections** → push/split grid + `PanelSection` accordion (APG
  `aria-expanded`/`aria-controls`/`role=region`) + its **warn-count badge** (the amber needs-review count).
- **A11y tokens** → panel-scoped AA tokens (`--panel-status-done` 10.63:1, `--panel-status-active`
  10.48:1, lightened red `hsl(0 80% 80%)` ≥4.5:1, `--panel-muted-foreground`). **Never** global
  `--muted-foreground` (3.59:1, fails).
- **Motion** → `fadeSlideUp` (receipt) + `checkPop` (chip morph), gated by `prefers-reduced-motion`
  (the honesty receipt still renders instantly when motion is off).
- **`fileIcons.getFileIcon()`** for the panel header icon.

## CSS patterns (from the winning variant)
```css
/* Field row with decorative trust-gutter spine (col 1) */
.field-row { display: grid; grid-template-columns: 2px 1fr; gap: var(--space-3); }
.spine.high { background: hsl(142 71% 45% / 0.6); }   /* med amber / low red / manual solid-primary / empty faint */

/* Chip — glyph + word + score; tier-tinted bg + AA-safe text */
.chip.low  { background: var(--color-danger-dim); color: hsl(0 80% 80%); border: 1px solid hsl(0 72% 51% / 0.4); }
.chip.manual { background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); } /* no score, no green */

/* Low-confidence VALUE itself reads tentative */
.val-tentative { font-style: italic; color: var(--color-text-muted); }
```

## What to Avoid
- A full-page detail view or a modal for the shell — they break the correction loop / push-not-overlay.
- Reusing `ConfidenceBadge` (chat) for the metadata chip — wrong component, no a11y enforcement.
- Colour-only confidence (no word/glyph), or a green/scored chip on a manual override, or a
  fabricated "High" on an unscored field — all violate the never-color-alone + honesty contracts.
- Coercing empty fields to `""` — `exclude_none` means absent; show absence as absence.
- Bulk "confirm all" — manufactures false provenance.
- Rescaling raw confidence into a fake percentage.
- Reusing the `0.54/0.38` *retrieval* thresholds as the *metadata* display tiers.

## Honest NET-NEW wire for the build (verified against the codebase 2026-06-17)
**Already real (Phase 111):** per-field confidence in `documents.metadata._confidence`
(`embedding_service.py` `build_metadata_model` + `attach_confidence`); `exclude_none` empties;
`metadata.update` in `VALID_ACTION_TYPES`; the `/metadata-fields` CRUD router; the reuse primitives above.

**Net-new for Phase 112 (the real work — NOT yet built):**
1. A **metadata-write endpoint** (`POST`/`PATCH /documents/{id}/metadata`). NONE exists today —
   metadata is written only at ingest. Without it, inline edit is non-functional (the Phase 101/104
   false-green class). Must call `write_audit_entry(..., 'metadata.update', ...)`.
2. A per-field **`source: user | extracted`** marker so re-extraction (`POST /reextract` exists)
   never silently overwrites a manual edit; define re-extract-vs-override precedence.
3. **Custom-field value edit persistence** (storage shape decision).
4. The **metadata display tier thresholds** (a 112 decision — see above).

---

## Downstream — concrete next stages

**Build Phase 112 (this surface):**
`/gsd:spec-phase 112` → `/gsd:discuss-phase 112` (cross-check open `surface: Agentic-RAG` bugs;
lock the per-field `source` marker + tier thresholds + the metadata-PATCH contract as the gray
areas) → `/gsd:plan-phase 112` → `/gsd:execute-phase 112`. G-2 (sketch-before-plan) is satisfied
by 027 + 028. UX-01 (Deep Midnight / mobile / WCAG AA) and UX-02 are cross-cutting acceptance.

**Phases that INHERIT this shell (reuse, do not rebuild):**
- **Phase 117 — Document Relationships Panel UI** adds a `Relationships` accordion section to THIS
  panel (outgoing/incoming typed links, "linked document (no access)" masking, reuse
  `MoveToFolderDialog` for the target picker). G-2 sketch fires for 117 — extend this shell, not a
  new surface.
- **Phase 118 — Auto-Classification** adds a `Classification` accordion section (accept/dismiss a
  suggestion) to THIS panel and the document row.
- **Phase 119 — Governance Health** is a separate read-only view, but its "low-confidence metadata"
  signal links back into this panel's per-field `ConfidenceChip`.

## Origin
Synthesized from sketches: 027 (winner A), 028 (winner A).
028 was built from a grounded 3-lens design workflow (judge: honesty-forward 88 / calm-Linear 86 /
dense-triage 82 → synthesis); the grounding was independently re-verified against the codebase,
correcting three wrong "doesn't exist" claims.
Source files: `sources/027-document-detail-shell/` · `sources/028-confidence-and-edit/`
(incl. `GROUNDING.md`).
