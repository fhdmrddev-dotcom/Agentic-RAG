# Phase 141: template_input Resolver Run-Scope (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 141-template_input Resolver Run-Scope (STRETCH)
**Areas discussed:** Reuse vs. re-upload, Which leak to block, Schema vs. no-schema, Verify + cross-provider bar

---

## Scope semantics — what "run-scoped" means (folds Reuse-vs-re-upload + Which-leak-to-block)

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow (block cross-context) | Block a workflow-run's template from a Deep turn (and vice-versa) and cross-workflow-run leaks, but KEEP same-mode reuse. Satisfies SC#1 intent + SC#2 no-regression. | ✓ |
| Strict per-run | Every run sees only templates it itself claimed; "do it again" without re-uploading fails. Tighter, but a felt UX change; fights Phase-100 keep-alive. | |

**User's choice:** Narrow (block cross-context)
**Notes:** Grounded in the architecture reality surfaced during scouting — templates
are uploaded to a THREAD with no run_id (`api/workspace.py` "has no run"); runs consume
them. The motivating Phase-120 collision was Deep↔workflow sharing a thread, so the
narrow reading targets the real leak while preserving the working reuse UX. → D-141-01.

---

## Mechanism / blast radius

| Option | Description | Selected |
|--------|-------------|----------|
| Claim-stamp column (mig 092) | Nullable claim column on workspace_files; stamp on first resolve with lineage (workflow_run_id / deep sentinel); resolver refuses foreign-lineage. Mirrors 120's messages.origin. | ✓ |
| No-schema time-cutoff | Derive scope from run start timestamp / existing pin. Catches "stale previous run" but can't cleanly tell Deep from workflow — under-covers the cross-mode leak. | |

**User's choice:** Claim-stamp column (mig 092)
**Notes:** The `'deep'` sentinel (vs. leaving Deep rows NULL) is what makes the block
symmetric in both directions. Claim-on-first-resolve keeps `threads.py` untouched (G-5).
→ D-141-02, D-141-03, D-141-04.

---

## Verification bar

| Option | Description | Selected |
|--------|-------------|----------|
| Repro test + cross-provider smoke | Faithful cross-run repro (fails-before/passes-after) + one-model render smoke. 141 not in SC#10 headline list; change is provider-agnostic. | ✓ |
| Full SC#10 4-axis UAT | Full cross-provider × multi-tool × parallel-thread × long-message matrix under VALIDATION.md. | |

**User's choice:** Repro test + cross-provider smoke
**Notes:** render_template is a shared, provider-agnostic backend resolver — the model
only emits the tool call. → D-141-06, D-141-07.

---

## Claude's Discretion

- Exact claim column name/type (text sentinel vs. enum+uuid) — contract: "holds a
  workflow_run_id OR a deep sentinel."
- Stamp timing: on-resolve (lean) vs. on-successful-render.
- Exact wording of the "belongs to another run/context — upload again" message.
- Whether sub-agent runs (`parent_run_id` set) inherit the parent's claim (intended) or
  claim independently — enumerate against the resolve path.

## Deferred Ideas

- Strict per-run isolation (re-upload every run) — rejected for 141; revisit only if a
  real reuse-leak the narrow block misses is observed.
- Claiming at the run-start pin instead of on-resolve — rejected for precision + to keep
  threads.py untouched.
- Reported-bugs cross-check: no open `surface: Agentic-RAG` report folds into this phase.
