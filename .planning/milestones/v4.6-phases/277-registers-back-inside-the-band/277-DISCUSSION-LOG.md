# Phase 277: Registers Back Inside the Band - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 277-registers-back-inside-the-band
**Areas discussed:** Headroom target, Hot-file table cells, Stop the regrowth, Fixing archived records

---

## Headroom target

| Option | Description | Selected |
|--------|-------------|----------|
| ~90k | Vitest history + other narrative; ~30k headroom (~15 phases) | ✓ |
| ~100k | Vitest history only; ~10 phases of room | |
| ~80k | Also UAT recipe, Supabase MCP, deployment narrative | |

**User's choice:** ~90k (Recommended)
**Notes:** Claude noted afterwards that short cells + vitest history alone reach ~81k, so the other narrative moves become optional.

---

## Hot-file table cells

| Option | Description | Selected |
|--------|-------------|----------|
| Short verdict only | Every row + triple stays; cell → ≤ ~80-char verdict; full text verbatim to HOT-FILE-LEDGER.md; ~20k saved | ✓ |
| Keep 200-char cells | No table change | |

**User's choice:** Short verdict only (Recommended)

---

## Stop the regrowth

| Option | Description | Selected |
|--------|-------------|----------|
| Lower the cell cap | `[disposition-too-long]` 200 → short-cell cap, driven RED | ✓ |
| Cap + section budgets | Also fail on any oversized `##` section | |
| No guard change | Split only | |

**User's choice:** Lower the cell cap (Recommended)

---

## Fixing archived records

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in place + one note | Remove glued rows at v4.5-REQUIREMENTS.md:9; backfill 19 SUMMARY `requirements` from each PLAN; one dated note per file | ✓ |
| Correction beside original | Strike through, write correct beside | |

**User's choice:** Fix in place + one note (Recommended)

---

## Claude's Discretion

- Destination file name for the vitest history; plan count; pointer wording.

## Deferred Ideas

- Per-section size budgets in the size gate.
- Moving UAT recipe / Supabase MCP / deployment narrative.

## Todos reviewed

- `spike-nl-workflow-authoring.md` — keyword-only match (0.6); not folded.
