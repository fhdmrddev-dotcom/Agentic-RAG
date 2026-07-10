# Phase 120: Collision Fix + Context Isolation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 120-collision-fix-context-isolation
**Areas discussed:** Run-scope boundary (COLL-01), Legacy rows after `origin` migration (CTX-01), COLL-02 scope, Acceptance/regression proof

---

## Run-scope boundary (COLL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline-filter only, per-turn | Each Deep turn snapshots `/sandbox/output/` at start; only NEW files emitted; stale files stay on disk, never re-emitted; no clearing | ✓ |
| Baseline-filter + clear at mode boundary | Same baseline plus proactive delete of `/sandbox/output/` on Harness→Deep / run-end; risks deleting a wanted file | |
| Per-thread-session scope | Whole thread = one scope; files accumulate/re-emit across turns; looser, higher re-leak risk | |

**User's choice:** Baseline-filter only, per-turn.
**Notes:** Smallest blast radius (matches COLL-03 evidence). Stale files never destroyed → no risk of losing a file the user still wants. → D-120-01/02.

---

## Legacy rows after the `origin` migration (CTX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Treat NULL as `deep` (filter exclude-harness) | No backfill; Deep replays `origin <> 'harness'` (deep+NULL), Harness replays `='harness'` strictly; zero risk to existing chats | ✓ (recommended) |
| Backfill all existing rows to `deep` | One-time UPDATE; clean column but mis-tags existing harness rows in mixed threads | |
| Back-tag harness rows via workflow joins | Accurate historical tagging via workflow_runs/phases joins; most complex | |

**User's choice:** Asked for recommendation → accepted "Treat NULL as `deep`, no backfill."
**Notes:** Column ships `DEFAULT 'deep'` + `CHECK (origin IN ('deep','harness'))`. Default `deep` is the safe failure direction. Back-tagging rejected as fragile complexity for a shrinking set of pre-migration mixed threads. → D-120-04/05/06.

---

## COLL-02 scope (template resolver)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep COLL-02 as STRETCH 130 | Mechanism B did not fire in evidence (skill used `execute_code`); ship confirmed COLL-01+CTX-01 now | ✓ |
| Fold COLL-02 into 120 | Same harvest seam; run-scope the `template_input` resolver too; larger 120 | |

**User's choice:** Keep COLL-02 as STRETCH 130 (as roadmapped).
**Notes:** Deferred — defense-in-depth for the `render_template` path, after 120. → CONTEXT `<deferred>`.

---

## Acceptance / regression proof

| Option | Description | Selected |
|--------|-------------|----------|
| Reproduce the exact live 2-files scenario + SC#10 | Faithful end-to-end regression mirroring thread `99af24d5`; fail-before/pass-after; plus SC#10 4-axis | ✓ (recommended) |
| Synthetic unit test of the baseline only | Test baseline-seeding in isolation; lighter, less faithful to the live bug | |

**User's choice:** Asked for recommendation → accepted "Reproduce the exact live 2-files scenario + SC#10."
**Notes:** We have a confirmed live repro with exact byte sizes; a faithful end-to-end test is the guard that catches a regression. SC#10 mandatory here anyway. Live thread re-runnable as manual UAT. → D-120-08/09.

## Claude's Discretion

- Baseline-seed mechanism (directory snapshot+hash vs. mtime-filter) — researcher/planner picks; contract = "only emit files this run created."
- Exact column-add SQL semantics for existing rows (NULL vs DEFAULT-fill) — planner confirms against Postgres behavior; intent (legacy = Deep) locked.
- Whether `tool`/`ask_user`/sub-agent rows need explicit origin tagging or inherit insert-site mode — planner enumerates full insert-site set.

## Deferred Ideas

- COLL-02 `template_input`/`render_template` resolver run-scope → STRETCH Phase 130.
- Proactive `/sandbox/output/` cleanup at mode boundary → rejected for 120, revisitable.
- IA-01 composer 2-pill simplification → Phase 121.
- Reported-bugs cross-check: no open `surface: Agentic-RAG` report folds into 120 (no domain overlap).
