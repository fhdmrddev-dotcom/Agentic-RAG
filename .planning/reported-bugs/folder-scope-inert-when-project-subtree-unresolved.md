---
id: BUG-260814-01
title: REFUTED — "folder_scope silently inert" was an analysis error; the run had NO declared scope to ignore
reported: 2026-08-14
surface: Agentic-RAG
severity: info
status: closed
affected_areas: [workflow-runs, harness/phase_types, grounding, retrieval, governance]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-159, SEED-162]
re_open_trigger: >
  An authoring flow that can produce a definition with project_folder_id = NULL AND a non-empty
  per-phase folder_scope (measured 0 of 223 on 2026-08-14). That shape is the ONLY one where the
  flagged branch could silently drop a declared scope — see "The residual" below.
reproduces_on:
  branch: develop
  commit: 852cc546
  date: 2026-08-14
---

# BUG-260814-01: REFUTED BY MEASUREMENT — kept as a record, not as a defect

⚠ **This report was filed as `major/open` on 2026-08-14 and REFUTED the same day, by the very
measurements it asked for. There is no defect. It is kept rather than deleted because a wrong
report that quietly vanishes teaches nothing, and because the residual at the bottom is real.**

## What the report originally claimed

That workflow run `26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2` retrieved outside its declared
`folder_scope` — 3 of 8 emitted fields citing a document whose `folder_id` is NULL, while both
phases declared `folder_scope = ['1564da7e…' (PM Demo Project)]`.

## Why it is wrong — the root error

**The definition inspected was NOT the definition that ran.** Two published workflows share the
display name *"Weekly Status Report"*:

| definition_id | slug | owner | `project_folder_id` | per-phase `folder_scope` |
|---|---|---|---|---|
| `…0000001040a0` | `pm-weekly-status-report` | `d8a54002` (operator) | `1564da7e…` | `['1564da7e…']` |
| **`…00000000c2`** | **`weekly-status-report`** | **`00000000…0001` (seed)** | **NULL** | **NULL** |

`workflow_runs.definition_id` for run `26b5a898` is **`00000000-0000-0000-0000-0000000000c2`** —
the second row. I selected the first by `name`, never checked the run's own `definition_id`, and
built the entire analysis on it.

**So the run declared no scope at all.** An unbound workflow searching the whole KB is correct and
documented behaviour (`harness_engine.py:2108` — *"An unbound workflow (None) skips → whole-KB"*).
There was nothing to ignore, and `folder_scope` was never inert.

## The three measurements the report asked for, answered

1. **Was `ctx.folder_subtree_ids` `None`?** Yes — and *correctly*, because
   `definition.project_folder_id` is NULL. `resolve_run_scope_root` had nothing to resolve, and
   `workflow_runs.inputs` carries only `{"kickoff_prompt": "generate report\n"}` — no folder
   override. The `_effective = _proj` fallback returned `None` because both inputs were `None`,
   which is the designed path, not the flagged one.
2. **Can a run start unbound on a workflow whose definition binds a project?** Not demonstrated,
   and not needed — this definition binds no project.
3. **Is `search_documents` the only reader?** `folder_subtree_ids` is consumed in
   `tool_dispatcher.py` (the shared search path, gated on `is not None`) and threaded by
   `agent_loop.py` / `task_service.py` / `phase_types.py`. No bypass was found, and no bypass was
   needed to explain the observation.

## The residual — real, unreachable today, and worth a guard

The branch at `backend/app/services/harness/phase_types.py:436-441` still has this property:

```python
_effective = (
    [f for f in _proj if f in set(map(str, _phase_scope))]
    if _proj is not None and _phase_scope else _proj      # <-- _proj is None -> None
)
```

If a definition ever carries **`project_folder_id = NULL` AND a non-empty per-phase
`folder_scope`**, the declared scope is discarded rather than applied on its own — a declared
control failing open.

**Measured 2026-08-14: 0 of 223 live definitions have that shape** (17 carry a project binding).
So it is unreachable today, which is why this is `info/closed` and not a defect. It becomes real
the moment an authoring flow can produce that combination — hence the `re_open_trigger`.

## What survived the refutation, and is genuinely worth acting on

The run **did** cite `weekly-status-report.docx` (a KB document with `folder_id` NULL, ingested
2026-06-19) for `project_name`, `reporting_period` and `risks_blockers`. That is not a scope
violation — but it does mean **the new weekly report partly derived from a prior status report /
the template itself rather than from the meeting notes and risk log**. Filed separately as
`SEED-162`, where it belongs: a KB-hygiene and retrieval-quality concern, not a governance defect.

## The lesson, recorded so it does not recur

**A display name is not an identity.** The run row carries `definition_id`; the analysis must
start there. Two rows sharing a `name` is not an edge case in this database — `libraryVocabulary.ts`
already records that **18 slugs carry more than one version**.

Second: the report was written with a hypothesis section that listed exactly the three
measurements needed to promote it to a finding, and it was labelled a hypothesis throughout. That
discipline is what made the refutation cheap — it took one query. Keep it.
