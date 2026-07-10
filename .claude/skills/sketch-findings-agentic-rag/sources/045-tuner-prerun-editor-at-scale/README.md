---
sketch: 045
name: tuner-prerun-editor-at-scale
question: "How does the pre-run case editor read and get edited at the org's REAL scale (one seeded case per sibling skill → dozens), and where does it live so it has room — instead of a 9–11px wall jammed in a 360px rail while the results column sits empty?"
winner: "B"
tags: [phase-123.1, skill-triggering, trigger-tuner, case-editor, density-at-scale, layout, gap-closure, bug-260624-01]
---

# Sketch 045: Tuner pre-run editor at scale

## Design Question

Sketches **041-A** (focused full-surface, narrow-left rail + wide-right results) and **043-A**
(two-column should-fire / should-NOT lists) set the Tuner's shape — but they were drawn with a
**handful of illustrative cases**. In production the backend `auto_seed_cases` seeds **one full
sibling-skill description per enabled owned/global skill** (uncapped) into the should-NOT column.
For a real user with a big skill library that's **dozens of long cases**, rendered at 9–11px in a
**360px rail split two ways (~170px each)** while the wide results column sits **empty** (idle/pre-run).

Result (live UAT, `weekly-report-writer`): an illegible wall of tiny text. Same `BUG-260624-01`
"doesn't read at the org's real scale" class the phase was meant to fix — relocated from the
scoreboard to the editor. This sketch settles **where the editor lives pre-run** and **how the
many seeded cases are presented**.

## How to View

`open .planning/sketches/045-tuner-prerun-editor-at-scale/index.html`

**Drive it:** the toolbar (bottom-right) has a **scale** control (6 / 20 / 50 skills) and a **cap**
control (8 / 12 / none). Crank scale to 50 and toggle cap to feel how each variant holds — or holds
up — at the real scale. On A & B, **▶ preview run result** flips to the post-run layout. "show all N"
reveals the uncapped wall (so you feel why the cap matters).

## Variants

- **A: Editor-first stage** — mode-aware layout. Pre-run, the **case editor takes the wide column**
  and run-config + description demote to a narrow rail; after a run the layout **flips** (results take
  the stage, editor collapses to a one-line summary). Cases live in capped-height, internally-scrolled
  columns at legible ~13px. Fixes the inversion: the thing you edit before a run gets the room.
- **B: Full-width stack** — **no rail pre-run**. One full-width flow: description → two wide case
  columns (each ~half the page = very readable) → run bar. The empty-results void is gone because
  results don't exist yet; after a run, results render full-width. Simplest mental model, no mode-swap.
- **C: Minimal-diff (density only)** — **keeps today's 360px-rail structure unchanged**; the entire fix
  lives in the editor. The should-NOT rail collapses into a **digest**: "🛡 N sibling skills seeded as
  false-fire bait" + a cluster of **skill-name chips** (not full descriptions), expandable to an
  editable list. The rail now reads as a calm config column, not a broken wall. Lowest effort / lowest risk.

All three carry: a **backend seed cap** + "showing 8 of N — capped" banner, preserved provenance tags
(seeded / sibling / you), the 60/40 split bar, the cost-preview, and the **red line** (no scoring core /
agent loop / shared chat path / CTX-03 trim-pin changes).

## What to Look For

- **Crank scale to 50.** Which variant stays legible and scannable without a "show all" wall?
- **Is the empty-results void gone** pre-run? (A reclaims it for the editor; B removes the rail; C
  keeps it but makes the rail calm via the digest.)
- **Does the should-NOT rail still read as the safety rail** when it's a digest of chips (C) vs. a
  full list (A/B)? Do you lose the ability to actually review the false-fire bait?
- **The post-run flip (A/B):** does handing the stage back to results after a run feel right, or does
  the editor-on-the-rail summary feel lost?
- **Effort vs. payoff:** C is the smallest diff (CaseEditor + a backend cap) and preserves every other
  123.1 decision. A/B re-architect the page layout. Is the layout itself wrong, or just the density?

## Decision — Variant B (Full-width stack) ★

Operator picked **B**. Rationale: it kills the empty-results void **by construction** — pre-run there
are no results to render, so a single full-width stack (description → two wide case columns → run bar)
leaves nothing sitting empty; results render full-width only after a run. No mode-aware layout swap to
maintain (A's complexity), and each case column gets ~half the *full* page width, so even long sibling
descriptions read cleanly. The digest idea (C) was not chosen — keeping the full should-NOT list visible
preserves the false-fire rail as something the author can actually review, not an opaque chip cluster.

**Build contract for the 123.1 gap-closure plan:**
1. **Backend** — cap / sample the auto-seeded should-NOT set in `auto_seed_cases` /
   `seed_cases_with_provenance` (`skill_tuner_service.py`); `GET /tuner/cases/seeded` returns the capped
   slice **plus** `total` so the UI can show "showing N of M — capped" honestly (never silent).
2. **Layout** — `SkillTunerPage.tsx:423`: replace the pre-run `lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]`
   rail with a **full-width single-column stack** for the idle/pre-run state (description → CaseEditor →
   run bar). The per-provider scoreboard + candidate cards render full-width **after** a run (reuse the
   existing 123.1 ProviderScoreboard / CandidateCard untouched).
3. **CaseEditor** — columns get `max-height` + internal scroll (`scrollbar-thin`), text bumped from
   9–11px to `text-sm`, a per-column count + the cap banner with "show all N". Columns now sit in a
   full-width two-up grid (not ~170px each).
4. **Red line preserved** — no scoring core / agent loop / shared chat path / CTX-03 trim-pin changes.

## Build Notes (reuse vs net-new)

- **Backend (all variants):** cap / sample the auto-seeded should-NOT set in `auto_seed_cases` /
  `seed_cases_with_provenance` (`skill_tuner_service.py`) — a focused default set, author extends.
  Mirror the cap in the `GET /tuner/cases/seeded` payload (return `total` + the capped slice).
- **A/B (net-new layout):** change the `SkillTunerPage.tsx:423` grid from a fixed narrow-left rail to a
  pre-run/post-run mode-aware layout (editor-wide pre-run; results-wide post-run). Reuse the existing
  scoreboard/candidate components for the flipped state.
- **C (minimal diff):** keep `SkillTunerPage.tsx` layout; rework only `CaseEditor.tsx` — add max-height +
  internal scroll, bump text to `text-sm`, and add the should-NOT **digest** (skill-name chips +
  expand-to-list). Smallest blast radius; touches one hot file.
- **Honesty (load-bearing):** capping is **visible** ("showing 8 of N — capped"), never silent. The
  digest (C) must still let the author open and edit the full false-fire set, or the safety rail
  becomes opaque.
