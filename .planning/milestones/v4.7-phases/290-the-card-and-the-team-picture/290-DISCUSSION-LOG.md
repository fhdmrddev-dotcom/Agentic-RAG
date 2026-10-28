# Phase 290: The Card and the Team Picture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-21
**Phase:** 290-the-card-and-the-team-picture
**Areas discussed:** Which card sketch wins, Where the picture opens, Small and judge-less teams, New role words

Findings presented before the questions: sketch 179 C (shipped in 192.2) cut the purpose and phase glyphs that VIS-04's sketch 163 drew; production has 29 definitions, 7 with steps (2-3 each), 0 judges, 0 batch steps, 0 skip links.

---

## Which card sketch wins

| Option | Description | Selected |
|--------|-------------|----------|
| Add one chip line | Keep 179 C; add a third line of labelled step chips when steps exist | ✓ |
| Count VIS-04 as done | 179 C answered it; close SEED-155 by measurement | |
| Rebuild to sketch 163 | Labelled chips, smaller purpose, toolbar rework | |

| Option (toolbar) | Description | Selected |
|--------|-------------|----------|
| Leave it out | Keep on SEED-155 | ✓ |
| Include it | Rework LibraryToolbar now | |

| Option (overflow) | Description | Selected |
|--------|-------------|----------|
| First 3, then +N more | One line, never wraps, rest named in words | ✓ |
| All steps, wrap | Wraps to a second row | |
| Count only | "3 steps" in words | |

| Option (sketch bar) | Description | Selected |
|--------|-------------|----------|
| Small sketch first | Renders the real card component plus the chip line | ✓ |
| 163's chips are the bar | No new sketch | |

---

## Where the picture opens

| Option | Description | Selected |
|--------|-------------|----------|
| Builder Steps / Team only | One mount in WorkflowCanvas | ✓ |
| Builder + run page | Second mount in WorkflowRunPage | |
| Builder + library card | "See the team" in the card's menu | |

| Option (who can see it) | Description | Selected |
|--------|-------------|----------|
| Anyone who can open it | Read-only, no new access | ✓ |
| Only workflows you can edit | Edit mode only | |

---

## Small and judge-less teams

| Option (1 step) | Description | Selected |
|--------|-------------|----------|
| Honest single node | Orchestrator + one step + a line in words | ✓ |
| Switch disabled | Greyed with reason | |
| Switch hidden | No Team option | |

| Option (no judge) | Description | Selected |
|--------|-------------|----------|
| Say it in one line | "Nothing checks this work" / "Checked by rule, not a judge" | ✓ |
| Draw nothing | No words | |

| Option (parallel) | Description | Selected |
|--------|-------------|----------|
| "up to N" seats | N seats labelled as a cap | ✓ |
| One node + words | No seats drawn | |

---

## New role words

| Option (roles) | Description | Selected |
|--------|-------------|----------|
| Reuse today's step words | phaseVocabulary, one vocabulary | ✓ |
| Sketch's corner words | New word set | |
| Both | Corner role + step subtitle | |

| Option (gates) | Description | Selected |
|--------|-------------|----------|
| Adopt Judge / Check | Two vocabulary entries; ⌥ reveals the kind | ✓ |
| Show the gate kind | Per-kind plain words | |

---

## Claude's Discretion

- Home of the pure derivation module; how the chip line reaches the card within the ledger budget; plan count (3-5).

## Deferred Ideas

- LibraryToolbar rework and counter pill (SEED-155); live run view (SEED-086); other entry points; publish-gauntlet judge in the picture.
