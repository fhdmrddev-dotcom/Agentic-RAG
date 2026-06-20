# Document Relationships — Panel Section & Link Picker (Phase 117)

How a document's **typed relationships** read and get created — added as ONE accordion section to
the *existing* Phase 112 `DocumentDetailPanel` (the 027/028 shared shell reserves the
`Relationships` slot). This **extends the shell, it does NOT build a new surface.** Synthesized from
sketches **034** (the in-panel section) + **035** (the create-link target picker dialog), both
winner **A** (operator, 2026-06-20), then hardened by a 3-lens adversarial fidelity audit
(`wf_1ec2afac-687`): all 7 backend build-note claims verified TRUE against source, 2 HIGH a11y
defects fixed before lock.

> Backend base = **Phase 116** (POST `/document-relationships` + DELETE only — **NO REST read
> shipped**). Phase 117 carries the net-new shared **`GET` read seam** (D-117-7) and the panel UI.
> Read `117-CONTEXT.md` (all 11 D-117 decisions) before writing code.

---

## Design Decisions

### 1. Relationships = a chip-led, grouped-by-direction accordion (sketch 034 winner A)
A single `PanelSection` (count badge) added to the shared detail panel. Inside, two labeled
subgroups in fixed order: **Outgoing** (`A → X`) then **Incoming** (`Y → A`). Each row = a
**rel-type pill chip** (verb word + per-type colored dot) + filename + a remove **✕**.
Chip-led won over *sentence-led* (B, verb inline as prose — denser but direction reads slower) and
*compact/dense* (C, mono-tag list for many-link docs — trades warmth for throughput). A's explicit
"Outgoing N / Incoming N" subheaders make the **create/remove asymmetry legible** and give the
cleanest 3-second direction read on the common 3–12-link doc.

### 2. Incoming rows use INVERSE labels, mirrored 1:1 from the backend (D-117-6)
Outgoing shows the verbatim rel-type ("Supersedes", "Amends", "References"). Incoming shows the
**inverse** ("Superseded by", "Amended by", "Referenced by") — **mirrored exactly from the backend
`_INVERSE_LABEL` map, never invented in the client.** A relationship is one edge seen from two ends;
the inverse label is how the *other* end reads. Don't author wording in the UI.

### 3. Create = outgoing-only; remove = either-direction (D-117-1 / D-117-2 — deliberate asymmetry)
`+ Add link` lives at the **section foot** and authors an **outgoing** link from the open document
only ("to link *X supersedes this*, open X's panel"). But **remove works in either direction** —
you own the edge from either end. This asymmetry is intentional; **lock it against review drift**
(a reviewer will be tempted to "fix it to symmetry"). Idempotent create (D-116-6) is the net for a
stale candidate.

### 4. The masked "no access" row is load-bearing honesty, present by default (D-117-8, SC#2)
A relationship can point at a document the viewer can't read. That row renders as the verbatim
`_NO_ACCESS_MASK` string ("linked document (no access)") — **never hidden behind a toggle**, and it
**never leaks the id or title**. It must read as *a real but unreadable link* — not an error, not an
empty. It still carries a remove ✕ (you own the edge even when you can't see the far end). The read
seam is **leak-safe by construction** (Phase 116's `is_latest`-gate + post-follow folder re-check,
mirrored from `list_documents`).

### 5. Mutation = re-fetch, NOT optimistic — and therefore NO undo (D-117-9)
After a create or remove, the section **re-fetches** rather than optimistically splicing the DOM.
The audit fidelity pass **removed an "Undo" affordance** that an early variant had: an "Undo" implies
optimistic reversibility the backend doesn't provide. Remove is a hard, audited `DELETE`. The honest
beat is a brief `↻ updating` flash (`role="status"`), then the fresh list — not an instant vanish.

### 6. Honest state set: empty ≠ error ≠ loading
Four distinct states, each its own treatment: **populated**, **empty** ("No links yet" + the inline
`+ Add link`, calm — not an error), **loading** (skeleton/`↻`), **error** (`role="alert"`, copy that
explicitly says *this is an error, not "no links"*). The 034 sketch's State strip exists to prove all
four; the shipped panel renders the real one.

### 7. Create-link picker = the MoveToFolderDialog shell, Select → typeahead (sketch 035 winner A, D-117-3)
SC#2 says reuse the `MoveToFolderDialog` document-picker pattern. D-117-3 keeps that **Dialog +
confirm + error-line shell** but **swaps its plain `Select`** — a `Select` dies past ~30 docs and a
KB holds thousands — **for a searchable typeahead.** The locked composition is **type-first**:
rel-type **segmented chips on top**, then the typeahead, with a live **"this document references →
X"** preview, and a **confirm disabled until a target is chosen**.
- Won over *sentence-builder* (B, "This document `[references ▾]` `[search…]`" — reads as plain
  language but buries the type in an inline dropdown) and the *inline foil* (C, form expands inside
  the accordion — snappier but **deviates from D-117-3** and competes with the already-dense panel;
  shown only to confirm the dialog is right). **C is rejected.**

### 8. Candidate exclusion is PER TYPE (D-117-4)
The typeahead excludes **self** + documents **already linked *with the currently-selected type*.**
Switching the rel-type **changes the candidate set** (a doc you already "supersede" reappears as a
valid "references" target). An honest **"N already … — hidden so every pick is actionable"** note
updates with the type. Client-filter-over-a-visible-docs-fetch vs a server param is the researcher's
discretion (pick the least-complex correct option); idempotency is the backstop.

---

## A11y contract (SC#3 WCAG 2.1 AA — locked by the fidelity audit, ships as truth)

These were not optional polish — two were HIGH defects fixed *before* the winner locked. Do not drop
them in the build:

- **Remove (✕) reachability — the #1 fix.** Hover-reveal is mouse-only sugar. The control MUST be
  keyboard-operable (`:focus-visible`) **and always visible on touch / coarse-pointer** — the
  `<768px` bottom-sheet has no hover. Shipping hover-only makes the destructive either-direction
  remove (incl. masked rows) unreachable → WCAG 2.4.7 fail. (Sketch CSS:
  `.rel-row:hover .rel-x, .rel-row:focus-within .rel-x, .rel-x:focus-visible { opacity: 1 }` — plus a
  coarse-pointer media query making it always-on.)
- **Accessible names.** Icon-only controls carry `aria-label` (shell pattern:
  `aria-label="Close document details"` + `aria-hidden` glyph). Remove announces the full target:
  `aria-label="Remove <type> link to <filename>"`. The accordion head reuses `PanelSection`'s real
  `<button aria-expanded aria-controls>` — **don't re-implement a `div`.**
- **Typeahead is a combobox — NET-NEW a11y.** The `Select`→typeahead swap **loses the APG roles the
  shadcn `Select` gave for free.** The build must wire `role="combobox"` +
  `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input (highlighted row =
  `aria-activedescendant`), `role="listbox"` on the list, `role="option"` + id per candidate.
  **Focus-trap + restore come free from the reused shadcn `Dialog`** — keep the input INSIDE the
  dialog so the swap preserves both.
- **Contrast.** The masked "no access" string (the SC#2 honesty surface), the per-type exclusion note,
  "No matching documents", subheaders, and all meaningful copy use the **panel-scoped AA token**
  (`--panel-muted-foreground` ≥4.5:1), **NEVER** the global muted/dim (3.59–3.64:1). Decorative glyphs
  (chevron, redundant per-row direction arrow) may stay dim.
- **Live regions.** The transient `↻ updating` re-fetch beat = `role="status" aria-live="polite"`;
  the load-error block = `role="alert"` (the 112 `DocumentDetailPanel` pattern).
- **In-flight beat.** Submitting → disabled confirm is inherited from `MoveToFolderDialog`'s `loading`
  state; the sketches collapse the POST + re-fetch to instant only for brevity — the build keeps the
  real disabled beat.

---

## Verified reuse map (port these, don't reinvent)
- **The shell** → `DocumentDetailPanel` + `PanelSection` accordion (count badge) + `useIsMobile`
  bottom-sheet + the `onReconcile` re-fetch hook — all from Phase 112 ([document-detail-panel.md](document-detail-panel.md)).
- **The vocabulary** → mirror the backend `_INVERSE_LABEL` map (D-117-6) and the `_NO_ACCESS_MASK`
  string (D-117-8). **Mirror, never invent.**
- **The picker** → `MoveToFolderDialog`'s Dialog / confirm / error-line / `loading` shell, with the
  `Select` swapped for the typeahead (D-117-3).
- **The create call** → `POST /document-relationships` is live (Phase 116: visible-both gate →
  idempotent persist → `relationship.create` audit). Remove → the live `DELETE`.
- **A11y tokens** → the panel-scoped AA tokens (`--panel-muted-foreground`, etc.), as in 112.

## CSS patterns (from the winning variants)
```css
/* 034 — relationship row + per-type chip; remove reachable by hover/focus/touch */
.rel-row { display:flex; align-items:center; gap:var(--space-2); padding:7px var(--space-2);
           border-radius:var(--radius-md); }
.rel-chip { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:500;
            padding:2px 9px; }                              /* verb word + per-type dot */
.rel-row.masked .rel-file { color:var(--color-text-muted); font-style:italic; }  /* "no access" */
.rel-row:hover .rel-x, .rel-row:focus-within .rel-x, .rel-x:focus-visible { opacity:1; }
/* + @media (pointer:coarse){ .rel-x{opacity:1} }  ← touch has no hover (the audit fix) */
.add-link { width:100%; text-align:left; border:1px dashed var(--color-border); }  /* section foot */
.updating { display:inline-flex; gap:6px; font-size:11px; color:var(--color-text-dim); } /* role=status */

/* 035 — typeahead (wire combobox roles net-new) + live preview line */
.ta-input:focus { border-color:var(--color-primary); box-shadow:var(--shadow-glow-primary); }
.preview-line .verb { color:var(--color-primary); font-weight:600; }   /* "references → X" */
.ta-excl { /* "N already … — hidden so every pick is actionable" — panel AA token */ }
```

## What to Avoid
- A **new surface** for relationships — it's ONE `PanelSection` in the existing detail panel.
- **Inventing** inverse labels or the "no access" wording — mirror the backend maps verbatim.
- **Symmetric create** ("X supersedes this" from this panel) — create is outgoing-only; remove is
  either-direction. The asymmetry is the design.
- **Optimistic splice / an "Undo"** — mutation is re-fetch; an Undo lies about reversibility (D-117-9).
- **Leaking** id/title on a masked row, or rendering it as an error/empty.
- A **plain `Select`** for the target picker (dies past ~30 docs) — or the **inline-in-accordion**
  create foil (rejected: deviates from D-117-3, competes with the dense panel).
- Forgetting the typeahead is **net-new a11y** (combobox roles the `Select` gave for free) or making
  remove **hover-only** (unreachable on touch).
- Coercing exclusion away — per-type exclusion is correct; switching type re-opens candidates.

## Honest NET-NEW wire for the build (verified against the codebase 2026-06-20)
**Already real (Phase 116):** `POST /document-relationships` (visible-both gate → idempotent persist
→ `relationship.create` audit), the `DELETE`, the 4 rel types, the `_INVERSE_LABEL` + `_NO_ACCESS_MASK`
constants, follow-to-latest (`_subject_version_ids` + edge `.in_()`), the leak-safe traversal
internals.

**Net-new for Phase 117 (the real work — NOT yet built):**
1. A **`GET` read endpoint** — Phase 116 shipped **no REST read**. Its leak-safe traversal must be
   **extracted into a shared `document_relationship_service` and shared with the agent tool — never
   forked** (D-117-7, share-don't-fork; the Phase 101/104 false-green class).
2. The **typeahead candidate source + the self & already-linked-per-type exclusion** (D-117-4) —
   client filter over a visible-docs fetch *or* a server param (researcher's discretion, least-complex
   correct).
3. **`api.ts` client fns** (read + create + delete) + the `Relationships` `PanelSection` + the
   typeahead inside the reused `MoveToFolderDialog` shell, with the net-new combobox a11y wiring.
4. Mobile: bottom-sheet vs centered dialog for the picker is sketch/planner discretion
   (Claude's-discretion item in CONTEXT).

---

## Downstream — concrete next stages

**Build Phase 117 (this surface):** `/gsd:plan-phase 117` (G-2 sketch-before-plan satisfied by 034 +
035; the plan MUST own the D-117-7 shared `GET` read seam — extract, share-don't-fork). →
`/gsd:execute-phase 117`. UX-01 (Deep Midnight / mobile / WCAG AA) is cross-cutting acceptance; the
A11y contract above is non-negotiable.

**This section shares the panel with:**
- **Phase 112** — Metadata + ConfidenceChip + inline edit (the shell + the open-by-default section).
- **Phase 118** — Auto-Classification adds a `Classification` accordion section to the SAME panel.

## Origin
Synthesized from sketches: **034** (winner A — chip-led grouped) + **035** (winner A — dialog,
type-first). Both operator-picked 2026-06-20, then hardened by the 3-lens adversarial fidelity audit
`wf_1ec2afac-687` (7/7 backend build-claims TRUE; 2 HIGH a11y fixes — hover-only remove → keyboard/
touch reachable, masked-row contrast → panel AA token — + the remove "Undo" killed to honor
re-fetch-not-optimistic).
Source files: `sources/034-relationship-section/` · `sources/035-link-target-picker/`.
