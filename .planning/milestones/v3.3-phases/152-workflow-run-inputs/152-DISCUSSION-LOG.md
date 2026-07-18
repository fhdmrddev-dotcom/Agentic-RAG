# Phase 152: Workflow Run Inputs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 152-workflow-run-inputs
**Mode:** `--auto` (per operator instruction: identify all gray areas, auto-select the recommended option after study, then auto-advance to plan-phase)
**Areas discussed:** Run-input plumbing, Author-time folder-scope default, Scope-to-retrieval enforcement, Folder ownership/authorization, Backward compatibility, Template asset lifecycle

> The two historically-open discuss calls for this phase — **SEED-112 scope-shape** and **delete disposition** — were already settled by the G-2 sketch (commit `b3991817`, sketches 072 + 073 both winner A). They are recorded as `D-LOCK-01..05` in CONTEXT.md and were NOT re-opened here.

---

## Run-input plumbing (WFIN-01 + WFIN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| A — reuse existing `inputs` jsonb | Both template handle + per-run folder override ride `create_workflow_run(inputs: dict)` → `workflow_runs.inputs`; no migration | ✓ |
| B — new columns / table | Dedicated `workflow_run_inputs` schema | |

**Choice:** A (recommended). **Notes:** `create_workflow_run` (`db/workflows.py:77`) already persists `inputs` as `$3::jsonb` — additive keys, zero schema churn. → CONTEXT D-01.

---

## Author-time folder-scope default (WFIN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| A — reuse `definition.project_folder_id` | Use the existing definition field as the retrieval default; absent = whole-KB | ✓ |
| B — new `retrieval_folder_id` field | Separate "belongs-to" folder from "retrieves-from" folder (adds a migration) | |

**Choice:** A (recommended), **flagged for research.** **Notes:** starters strip `project_folder_id` at promotion (D-143-4b) so they stay unscoped — no regression. RESEARCH must confirm `project_folder_id` isn't load-bearing purely as a display tag (today it's read-only, NOT wired to retrieval); if it is, fall back to B. → CONTEXT D-03.

---

## Scope-to-retrieval enforcement (WFIN-02, SC#10)

| Option | Description | Selected |
|--------|-------------|----------|
| A — server-side Phase-098 resolver | `document_view_resolver` + `agent_loop` scope path; model receives a constrained scope, cannot widen | ✓ |
| B — prompt-only instruction | Tell the model to restrict to the folder | |
| C — client-side filter | Filter results in the frontend | |

**Choice:** A (recommended). **Notes:** service-boundary constraint → cross-provider identical (OpenAI/Anthropic/Google/OpenRouter) for free; B lets the model widen, C is not enforceable. → CONTEXT D-04.

---

## Folder ownership / authorization (WFIN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| A — server validates owner-reachability | Owner-scoped RLS subtree; unreachable/unowned `folder_id` → no narrowing / refuse | ✓ |
| B — trust client `folder_id` | Accept whatever the modal sends | |

**Choice:** A (recommended). **Notes:** never let a run scope into another user's folder; mirror the resolver's "unreachable scope → no narrowing." → CONTEXT D-05.

---

## Backward compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| A — absent inputs = today's behavior | No template + no override = whole-KB, no template; every existing workflow + 3 starters byte-identical | ✓ |
| B — new default behavior | Change retrieval defaults | |

**Choice:** A (recommended). → CONTEXT D-06.

---

## Template asset lifecycle (WFIN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| A — reuse `upload_template` verbatim | Existing magic-byte-validated, TTL, `kind='template_input'` route; carry handle into `inputs.template_input` | ✓ |
| B — new upload endpoint | Build a workflow-specific uploader | |

**Choice:** A (recommended). **Notes:** `_ALLOWED_EXT` already widened in Phase 151-03; handle flows into the existing whitelist-gated `render_template` fill path (never executed, never a Deep-chat tool). → CONTEXT D-02, D-07.

---

## Claude's Discretion

- Exact `inputs` jsonb key names, Run-modal `<select>` option ordering, and provenance/victim-naming copy — chosen by planner/executor within the locked shapes.

## Deferred Ideas

- Archive-vs-hard-delete (sketch 073 fallback C) — hard-delete chosen.
- Type-to-confirm delete (sketch 073 fallback B) — victim-naming sheet chosen.
- Perplexity 3-way segmented scope toggle (SEED-112 fallback) — inline dropdown chosen.
- Three open workflow-DISPLAY bugs (killed-workflow empty card; BUG-260610-01 timer-reset/dup-avatar; BUG-260712-02 duplicate user bubble) — reviewed, left open (run-display surface, not this phase's domain).
- `spike-nl-workflow-authoring.md` (todo, score 0.6) — reviewed, NOT folded (SEED-051 NL-authoring scope, separate phase).
