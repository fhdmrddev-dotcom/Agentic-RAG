---
sketch: 038
name: governance-health-surface
question: "What form does the read-only Document Governance Health view take, and where does it live in nav relative to Library Health?"
winner: "A"
tags: [phase-119, governance-health, dgov, surface, ia, nav, read-only, health-panel, honesty]
---

# Sketch 038: Governance Health Surface

> **WINNER: A — card-grid, governance as its OWN top-level nav home** (operator +
> adversarial judge panel `wf_a961f729-247`, 2026-06-21; HIGH confidence, 3 of 4 lenses).
> **A is the only variant that satisfies SC#1 with zero ambiguity** — its own route/`<h1>`/
> queries, riding the shipped `HealthPanel` anatomy 1:1 (lowest net-new). **B is
> DISQUALIFIED:** it renders `<h1>Library Health</h1>` with governance as a segmented tab
> inside that route — the exact "bolted-onto-the-dashboard" shape SC#1 forbids (and ships a
> stale hardcoded "22" tab count that never clears at rest). **Build graft (adopt at plan
> time):** A's only weakness is a cluttered six-block all-healthy state — **borrow C's
> posture-hero + collapse-to-clear FORM for the healthy state** while keeping A's top-level
> IA. (Caveat if any health-score number is shown: it must be honestly computable from the
> three heterogeneous signals, else it's a vanity metric.) **IA lock:** pairs with 040-A/C
> (top-level); the forbidden combination is 038-A + 040-B.

Phase 119 (Document Governance Health, DGOV-01/02) — the last v3.0 phase, a **pure
consumer** of everything 110–118 produced. The phase needs a **separate, light,
read-only** surface (SC#1 is explicit: *its own surface/route — NOT cards bolted onto
the knowledge-health dashboard*) that surfaces three signal classes and links each to
its fix.

## Design Question

What **form** does the governance view take, and **where does it live** in nav
relative to the existing Library Health (`library-health`) dashboard? Form and IA are
**separable** — the sketch couples them per-variant to show concrete full options, but
the operator can mix (e.g. a card-grid form reached from a Documents sidebar group).

## How to View

```
open .planning/sketches/038-governance-health-surface/index.html
```

Toggle the **data:** switch (top-right) between *needs attention* and *all healthy* to
judge the at-rest state. Fix buttons show honest receipts ("Re-extraction queued" vs
"Opening…"); the worklist filter chips (B) and collapsible sections (C) are live.

## The three governance signals (real, from upstream phases)

| Signal | Produced by | The fix-link |
|---|---|---|
| Broken / dangling relationships | 116/117 | **Open** → relationships panel |
| Unclassified documents | 118 | **Classify** (never a silent move) |
| Low-confidence metadata | 111/112 | **Re-extract** / open detail panel |

## Variants

- **A: Card-grid (own nav home)** — one HealthPanel-style card per signal (the path of
  least resistance — reuses `HealthPanel` directly), under a 3-tile KPI summary strip.
  IA: a **new top-level "Governance" nav entry** (ShieldCheck glyph, warn-dot), peer to
  Classification + Library Health.
- **B: Prioritized worklist (tab of Library Health)** — one **ranked "Needs attention"
  feed** across all three signals (highest-risk first), with signal-dot filter chips +
  per-row signal tag. IA: a **segmented Retrieval | Governance tab** on the existing
  Library Health page (one health home, two lenses).
- **C: Summary-led drill-in (Documents group)** — a governance **posture hero** (ring +
  "3 areas need attention" + signal pills) over **collapsible sections** that fold to a
  one-line "clear" when healthy. IA: reached from a **"Governance" entry in the Documents
  sidebar** (co-locates doc-governance with documents).

## What to Look For

- **The "3-second read at rest"** — when everything is healthy (toggle *all healthy*),
  which variant reads as calm/all-clear fastest without feeling empty or broken?
- **IA findability** — own top-level home (A) vs. a lens of Library Health (B) vs. living
  inside Documents (C). Which makes a *governance* view discoverable without duplicating
  Library Health or burying it?
- **One queue vs. three buckets** — does the unified ranked worklist (B) beat three
  separate cards (A/C) for "what do I fix first," or does bucketing read clearer?
- **Honesty traps (load-bearing):**
  - Low-confidence metadata uses the **Phase-112 `ConfidenceChip`** (`Low · 0.31`, the
    per-field extraction score) — NOT the retrieval-similarity bar that Library Health's
    "Low Confidence" tab already uses. The two must never read as the same number.
  - The surface is **read-only aggregation** (SC#3) — the "Read-only view" banner +
    fix-links navigate to the real edit surfaces; the governance page itself writes
    nothing.
  - **Classify** must not imply a silent auto-move (CLASS-02) — it opens the suggestion/
    accept flow.
- **Reuse** — every card/row/empty-state maps to the live `HealthPanel` /
  `HealthDocumentRow` / `HealthEmptyState` anatomy so the build is composition, not net-new.

## Build Handover (reuse vs net-new)

- **Reuse:** `HealthPanel` card shell, `HealthDocumentRow` row + hover-action pattern,
  `HealthEmptyState` (positive/neutral), `PaginationControls` / show-more, the
  Phase-112 `ConfidenceChip`, `NAV_ITEMS` + the `ActiveView` union seam.
- **Net-new:** the governance route + read-only aggregation queries (broken-rel /
  unclassified / low-confidence-metadata) over the new tables under existing RLS; the
  per-signal **fix-link router** (open doc / open classify / re-extract); the KPI strip
  (A) / segmented tab (B) / posture hero + section-collapse (C).
- **IA decision needed at plan time:** which `ActiveView` placement (new top-level entry
  vs. Library-Health tab vs. Documents-sidebar entry) — drives whether 119 extends
  `NAV_ITEMS` or the Documents-page sidebar.
