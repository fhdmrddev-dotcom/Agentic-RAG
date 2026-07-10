# Phase 132: Skill Versioning + Eval Test-Case Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 132-skill-versioning-eval-test-case-persistence
**Areas discussed:** Version capture mechanism, Test-case schema & binding, Schema scope now vs later, Backfill & global-skill visibility

---

## Version capture mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres trigger on `skills` (safe-by-construction) | Fires on every write path automatically; zero duplicated app code | ✓ |
| App-code per router | Explicit snapshot calls in create/update/import | |

**Version-scope sub-decision (AskUserQuestion):**

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description + instructions | Any trifecta change snapshots; toggles never do; gives Phase 139 description-proposer a version trail | ✓ |
| Instructions only | Strictly literal VER-01; description edits don't version | |

**User's choice:** Trigger-based capture; version on full content trifecta.
**Notes:** Toggles (enabled/global) explicitly excluded via `IS DISTINCT FROM` guard. Monotonic `version_number` + `source` provenance tag.

---

## Test-case schema & binding

**User's choice:** `skill_test_cases` table — cases belong to the skill (freely editable before a run), NOT version-locked; the eval RUN records the version (Phase 133). `expected_behavior` is free text (judge-based verdict in 134). Provider-agnostic here.
**Notes:** No alternatives forked — recommendation accepted as presented.

---

## Schema scope now vs later

**User's choice:** Lay only 132's two tables now (`skill_versions` + `skill_test_cases`); 133/134 add the run/result/ratings tables. The "~5 tables" is the milestone total. Forward-compatible stable keys for downstream FKs.
**Notes:** Avoids guessing at 133's SSE/provider shape.

---

## Backfill & global-skill visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only RLS, even for global skills | Versions + cases are the author's private harness | ✓ |
| Visible to anyone who sees the skill | Global-skill viewers see history + cases | |

**User's choice:** Backfill a v1 for every existing skill at migration time; owner-only RLS on both tables even for global skills.
**Notes:** Matches skills RLS precedent; consumers run a global skill but don't see its edit history / eval cases.

---

## Claude's Discretion

- Column types/constraint names, trigger function naming, discrete-columns-vs-JSONB snapshot shape (leaning discrete), CRUD route shapes.
- Whether a thin version-history/test-case UI lands in 132 or stays a thin API consumed by the sketch-gated Phase 137 panel.

## Deferred Ideas

- Eval runner / SSE / two completions per case → Phase 133 (EVAL-02).
- Per-provider verdict + side-by-side + ratings → Phase 134 (EVAL-03/04).
- Self-improvement loop → Phase 135 (SI-01); description-only proposer → Phase 139 (SI-02).
- Publish gate → Phase 136 (GATE-01).
- Consolidated sketch-gated Evals panel → Phase 137 (PANEL-01).
- Reported-bugs cross-check: 8 open Agentic-RAG reports reviewed; none overlap; all left open, none folded.
