---
id: SEED-143
title: Seven WR-04 prototype-key sinks have now been guarded one at a time — close the CLASS at the boundary instead (constrain the phase slug, or stop keying plain objects by it)
status: open
planted: 2026-08-08
planted_by: The `/gsd:fast` run that fixed BUG-260808-01 (2026-08-08) — planted because that report's own routing said "plant as seed if the boundary fix is not taken", and the boundary fix was NOT taken (it is schema + API surface, outside /gsd:fast under G-3)
surface: Agentic-RAG
severity: minor
category: security / WR-04 prototype pollution — class closure
priority: medium
scope: Small-to-medium — one backend validator + one CHECK constraint + a migration, OR a mechanical sweep of slug-keyed maps to `Map` / `Object.create(null)`
affected_areas: [frontend/workflow-canvas, backend/harness-models, security/WR-04, supabase/migrations]
related_seeds: [SEED-141]
re_open_trigger: >
  Re-open when ANY of these is true: (1) an EIGHTH prototype-key sink is found — at that point stop
  fixing sites entirely and take the boundary fix in the same session; (2) any phase touches
  `harness.py`'s phase model or adds a migration to `workflow_phases`, which makes the slug
  constraint nearly free to add as a rider; (3) `188.2-DEF-02` (consolidating four inline
  `hasOwnProperty` guards) is picked up — that consolidation and this closure want the same owner and
  the same commit; (4) a slug becomes author-editable in the UI, which today it is NOT (`D-184-11`:
  there is no slug field and the caller derives the slug from the phase type) — that flips the
  reachability argument and raises severity immediately.
---

# SEED-143 — stop guarding WR-04 sinks one at a time

## The count, and why a seed rather than another fix

Seven sinks, guarded individually, across four days:

| # | Sink | Closed by |
|---|---|---|
| 1–4 | four inline `hasOwnProperty` guards across the card subtree | 188.1-04 / 188.2, left un-consolidated as `188.2-DEF-02` |
| 5 | `runVocabulary.ts:84-88`'s private `own()` | pre-existing |
| 6 | `editAffordance.ts` `verticalOffsetFor` — returned **`NaN`** | `BUG-260807-01`, `/gsd:fast` 2026-08-07 |
| 7 | `WorkflowCanvas.tsx:639/674/866` — the node POSITION lookup, returned the inherited **function** | `BUG-260808-01`, `/gsd:fast` 2026-08-08 |

Each fix was correct and each was driven RED first. That is not the problem. The problem is that
**the next sink is found by someone tripping over it**, and sink 7 was found only because sink 6's
author deliberately held their report open for a driven row that a green unit suite could not
replace. Without that discipline sink 7 would still be live and silently mispositioning a card.

Both `BUG-260807-01` and `BUG-260808-01` say this in as many words: *"stop fixing these one at a
time"*, *"three reports in three days is the signal."* It is now four days and seven sinks.

## The root enabler, measured

The phase slug is **unconstrained end to end**:

- `backend/app/models/harness.py:202` — `slug: str`, no pattern, no enum, no reserved-word list.
- `supabase/migrations/058_workflow_phases.sql:18` — bare `text NOT NULL`.

So nothing between an author and a plain-object index rejects `constructor`, `toString`, `valueOf`
or `__proto__` as a phase slug.

## The two ways to close the class (pick one — they are alternatives, not a sequence)

**A. Constrain the slug at the boundary.** A pattern on `slug: str` in `harness.py` plus a matching
CHECK constraint in a migration, rejecting `Object.prototype` member names (or, more simply,
restricting to `^[a-z][a-z0-9_]*$` and excluding the reserved set). One place, and every current and
future slug-keyed lookup in the tree becomes safe without anyone having to think of it.
*Cost:* a migration, and a decision about what happens to any existing row that violates it (all
`workflow_definitions` rows in this project are test data, so almost certainly none).

**B. Stop keying plain objects by slug.** Sweep the slug-keyed maps to `Map` or
`Object.create(null)`. `canvasModel.ts` already does exactly this — it keys everything through `Map`
and was therefore never exposed, which is a live proof that the shape works in this codebase.
*Cost:* mechanical, but touches more files and cannot prevent the next NEW plain object.

**Either way, add the property-style test `BUG-260808-01` asked for:** *"every slug-keyed lookup is
total over `Object.prototype` member names."* That is the thing that catches sink 8 without anyone
having to think of it, and it is worth adding even if neither A nor B is taken.

## Severity, stated plainly

**Minor, and it should not be inflated.** Reaching any of these needs an author to name a phase such
that its slug is an `Object.prototype` member — unlikely by accident, trivial on purpose — and the
blast radius is a mispositioned or over-elevated element on the canvas. Nothing leaks and nothing
escalates. What justifies the seed is not the severity of any one sink; it is that the discovery
method is "wait for someone to trip over it", and `D-184-11` (no slug field in the UI) is the only
reason the reachability argument stays weak. If a slug ever becomes author-editable, re-read this.

## Cross-links

- `.planning/reported-bugs/BUG-260807-01-…` — sink 6, and the closing-condition discipline that
  found sink 7.
- `.planning/reported-bugs/BUG-260808-01-…` — sink 7, its exact three sites, and the routing note
  that planted this seed.
- `188.2-DEFERRED.md` D-188.2-DEF-02 — the four un-consolidated guards; same owner, same commit.
- `frontend/src/components/workflows/ownProperty.ts` — the shipped `own()` leaf every site-level fix
  now routes through.
- `frontend/src/components/workflows/canvasModel.ts` — the `Map`-keyed module that was never
  exposed; option B's working precedent.
