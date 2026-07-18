# Phase 124: Workflow Studio UX — Soul + Strict↔Loose - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 124-workflow-studio-ux-soul-strict-loose
**Areas discussed:** Launch seam, Soul atoms & empty states, Publish-summary scope, Bug routing

**Pre-discussion note:** This phase was ~90% pre-decided going in — the G-2 sketch gate was
already satisfied (sketches 046-A + 047-A, both winner-A, operator-approved 2026-06-26), and a
codebase scout confirmed the two load-bearing data shapes already exist (`business_requirement`
on `WorkflowDefinition`, `harness.py:240`, required at publish; `deriveTier`/`TIERS` in
`frontend/src/components/workflows/deriveTier.ts`). That established the phase as **pure-frontend**
and left only four genuine open decisions, all resolved below to the recommended option.

---

## Launch seam (vs Phase 121's single front door)

| Option | Description | Selected |
|--------|-------------|----------|
| Studio entry only | Fork = authoring entry (New workflow / Author & govern). Library card Run stays one-click launch-into-thread exactly as Phase 121 shipped. Nothing merges. | ✓ |
| Two doors = page landing | The Workflows page itself becomes the two doors; the library Run lives inside the 'Describe & run' door. | |

**User's choice:** Studio entry only (Recommended).
**Notes:** Preserves Phase 121's single-front-door consolidation. Loose users Run-and-go from the library card; users creating/shaping a workflow enter the Studio and meet the doors. → CONTEXT D-01.

---

## Soul atoms & empty states

| Option | Description | Selected |
|--------|-------------|----------|
| Honest fallbacks | Draft purpose → 'draft · purpose not declared yet'; output line → terminal `llm_emit` deliverable when present, else 'produces: answer in chat'. Atom always shown, never blank/faked. | ✓ |
| Hide atom when absent | Drop the output line when there's no file deliverable; show nothing for an undeclared draft purpose. | |

**User's choice:** Honest fallbacks (Recommended).
**Notes:** Principle — the soul never shows blank and never lies. → CONTEXT D-03 (with D-02 pure-FE provenance, D-04 the 5 atoms).

---

## Publish-summary scope

| Option | Description | Selected |
|--------|-------------|----------|
| Soul-block-only | Prepend the soul block atop the publish summary; leave the gauntlet ladder (pip-strip + worded verdict = WUX-03) for Phase 127 STRETCH. | ✓ |
| Also re-skin the ladder now | Pull WUX-03 forward into 124. | |

**User's choice:** Soul-block-only (Recommended).
**Notes:** Keeps 124 a clean pure-soul re-skin; WUX-03 stays Phase 127. → CONTEXT D-06.

---

## Bug routing (mandatory reported-bugs cross-check)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave both open / defer | Both are live-run mechanics (timer/reconcile/slug), not the soul/door chrome 124 re-skins. Add a re-open trigger to re-check after the run-header re-skin. | ✓ |
| Fold run-strip one only | Fold BUG-260610-01 (timer/avatar); leave the phase-0 slug bug open. | |
| Fold both into 124 | Fix both as part of this phase. | |

**User's choice:** Leave both open / defer (Recommended).
**Notes:** BUG-260610-01 + BUG-260609-04 stay `open` (not folded); `re_open_trigger` recorded on each frontmatter pointing back to the 124 run-header re-skin. Routing reflected in CONTEXT `<deferred>`.

---

## Claude's Discretion

- Exact net-new component file names + placement; CSS token choices within the locked Aether Deep Midnight theme; precise copy strings — all subject to matching sketches 046-A / 047-A (the SC#4 acceptance bar).

## Deferred Ideas

- **WUX-03** (gauntlet pip-strip + worded verdict + quiet idle cards) → Phase 127 STRETCH.
- **BUG-260610-01** (timer reseed + dup avatar on nav, minor) — left OPEN with re-open trigger.
- **BUG-260609-04** (phase-0 placeholder slug, minor) — left OPEN with re-open trigger.
