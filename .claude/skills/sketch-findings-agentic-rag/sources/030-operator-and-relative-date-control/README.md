---
sketch: 030
name: operator-and-relative-date-control
question: "How does the type-aware operator+value control read per field type — and specifically the relative-date control (within next N / older than N / before / after / between), honest that it recomputes live and excludes overdue?"
winner: "A"
tags: [phase-114, document-management, virtual-folders, relative-date, operator-menu, type-aware, honesty, no-dsl]
---

# Sketch 030: Operator + Relative-Date Control

## Design Question

The no-DSL builder's hardest control. Two halves:

1. **Type-aware operator menu** (D-114-6 / metadata_field types) — the operator list must adapt to the field's type (string / date / number / enum / boolean). Shown as an always-visible reference matrix at the top.
2. **The relative-date control** (D-114-4/5) — *"within next N days"* and *"older than N days"* are the headline operators, plus fixed *before/after* and *between*. It must be honest that:
   - the window is **recomputed live each time the view resolves** (a relative view drifts with the calendar), and
   - *"within next N days"* = **today → today+N**, **excluding already-overdue** documents ("coming due soon", not "overdue + soon").

What control makes that obvious without a DSL?

## How to View

open .planning/sketches/030-operator-and-relative-date-control/index.html

Each variant shows a **live resolved-window readout** (`→ Jun 19 → Sep 17, 2026`), a **"recomputed live" pulse note**, the **overdue-excluded** warning for *within next*, a **real match count** over a 36-date corpus, and a **mini timeline** with `today`, the resolved band, and (for *within next*) a dashed "overdue · excluded" zone. "today" is pinned to **Jun 19, 2026**.

## Variants

- **A — Operator encodes the direction** ★ recommended — the date operator dropdown carries `within next… / older than… / before / after / between`; the relative entries reveal a `[N] [unit]` stepper. Fewest moving parts; the menu self-documents. Costs a longer operator list (fine — date is a hot, common field).
- **B — One "Date is…" operator + segmented mode** — keeps the field→operator menu uniform with other types (just "is…"); a segmented `Relative | On/before/after | Between` + a `Within next / Older than` direction toggle live in the value area. More uniform menus, more clicks to the relative case.
- **C — Preset chips + Custom** — one-tap `Expiring ≤ 30d / ≤ 90d / Older than 1y / This year`, with `Custom…` expanding to the full control. Fastest for the 80% case; risk of "which preset?" hunting and a hidden custom path.

## What to Look For

- **Is "expiring within 90 days" obvious** without reading docs? Which control gets a non-technical user there fastest?
- **The honesty surfaces** — does the live-recompute note + overdue-excluded warning land, or read as clutter? Is the timeline worth the space?
- **Operator-menu length vs uniformity** (A's long date menu vs B's uniform "is…").
- **Unit handling** — days/weeks/months (`months ≈ 30d` in preview). Is a unit dropdown needed, or are days enough for v1?
- **Composability** — all three compile to the *same* relative operator; the chips/segments are just shorthand. Confirm none introduces a separate mental model.
