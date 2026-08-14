---
id: BUG-260814-01
title: A phase's declared folder_scope is silently INERT when the project subtree is unresolved — retrieval reads the whole KB
reported: 2026-08-14
surface: Agentic-RAG
severity: major
status: open
affected_areas: [workflow-runs, harness/phase_types, grounding, retrieval, governance]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-157, SEED-161]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 852cc546
  date: 2026-08-14
---

# BUG-260814-01: a declared `folder_scope` can be silently ignored

## What we observed

A **real run**, driven by the operator through the live UI on 2026-08-14 (`workflow_runs.id =
26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2`, 68 s, `status=completed`).

Workflow: **Weekly Status Report** (`00000000-0000-0000-0000-0000001040a0`, slug
`pm-weekly-status-report` v1), which declares:

```
definition.project_folder_id      = 1564da7e-2348-4237-b7a1-ec17c5ea8f4b   ("PM Demo Project")
phase 0 retrieve .folder_scope    = ['1564da7e-2348-4237-b7a1-ec17c5ea8f4b']
phase 1 emit     .folder_scope    = ['1564da7e-2348-4237-b7a1-ec17c5ea8f4b']
```

That folder contains exactly 5 documents: `risk-log.md`, `weekly-meeting-notes-week8.md`,
`weekly-meeting-notes-week9.md`, `sprint-task-log.md`, `project-charter-source.md`.

**3 of the 8 emitted fields were sourced from a document that is NOT in that folder:**

| field | cited chunk | source document | folder |
|---|---|---|---|
| `project_name` | `d407080c…#0` | `weekly-status-report.docx` | **NULL** |
| `reporting_period` | `d407080c…#0` | `weekly-status-report.docx` | **NULL** |
| `risks_blockers` | `d407080c…#1` | `weekly-status-report.docx` | **NULL** |

`select d.filename, f.name from documents d left join folders f on f.id = d.folder_id where
d.id = 'd407080c-e698-49e2-9282-a2927e44221d'` → `('weekly-status-report.docx', None)`.

⚠ **The citations are NOT invented — that is what makes this dangerous.** All 8 cited chunk ids
were verified present in the emit phase's own `retrieved_ids` (41 ids). The document really was
retrieved; it simply should not have been reachable. Every downstream honesty check
(`check_coverage`'s `invented_citation_count`, the uncited-value count) passes clean.

## Why it matters

**Severity: major.** Three compounding reasons:

1. **`folder_scope` is a governance control, and it failed open.** The graded-governance surface
   (Phase 185) sells "this step can only read what it declared". A control that silently does
   nothing is worse than an absent one, because the canvas still renders the step as scoped.
2. **The output is plausible and wrong in a way review will not catch.** The retrieved document
   is a *prior status report* (or the template ingested as KB, added 2026-06-19). So the new
   weekly report partly **copies last week's report** instead of deriving from the meeting notes
   and risk log. Reports drift from reality while looking perfectly cited. This is the exact
   failure a cited-RAG product exists to prevent.
3. **It is invisible at every gate.** Publish passes, the run completes, coverage is clean,
   citations resolve. Only a hand-check of `source_doc` against the declared scope reveals it —
   which is how it was found.

## Hypothesized cause

**Hypothesis, not yet confirmed by a test.** `backend/app/services/harness/phase_types.py:436-441`
builds the per-phase tool context:

```python
_proj = getattr(ctx, "folder_subtree_ids", None)            # resolved project subtree, or None
_phase_scope = getattr(phase.config, "folder_scope", None)  # the phase's declared list
_effective = (
    [f for f in _proj if f in set(map(str, _phase_scope))]  # narrow-only ∩
    if _proj is not None and _phase_scope else _proj
)
```

The narrowing is an **intersection with the resolved project subtree**, and the fallback is
`_proj`. So when `_proj is None` — the project subtree was not resolved at run start — the
expression yields `None`, meaning **no narrowing at all**, and `folder_scope` is discarded
entirely rather than applied on its own.

The comment above it states the intent plainly: *"None project subtree (unbound / Deep) → None (no
narrowing)"*. That is deliberate for an unbound/Deep run. The defect is that a phase which
**declared** a scope inherits the unbound behaviour instead of its own declaration.

**What still needs measuring before this is a finding rather than a hypothesis:**
- Was `ctx.folder_subtree_ids` actually `None` on this run, or non-null and simply not containing
  the out-of-folder doc? (If non-null, the cause is elsewhere and this analysis is wrong.)
- Does the Run modal pass the project binding, or can a run start unbound on a workflow whose
  definition binds a project?
- Is `search_documents` the only reader of `folder_subtree_ids`, or can another tool bypass it?

## Surface classification

`Agentic-RAG` — this app's own run engine. Routing candidate at the four GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (no phase in flight on the run engine)
- **Defer to future phase / milestone:** a v3.7 run-correctness phase — this is a **correctness**
  bug, not a UX one, and should not wait behind the authoring work
- **Plant as seed:** n/a — this is a defect with a live reproduction, not a cross-milestone concern
- **External — note only:** no

## Workarounds

None reliable today. A user cannot see that scope was ignored — the run surface reports success and
the citations resolve. The only detection is manual: compare each emitted field's `source_doc`
against the phase's declared `folder_scope`.

Partial mitigation: keep the KB free of unfiled documents (`folder_id IS NULL`), since those are
what an unnarrowed search reaches. This is a housekeeping dodge, not a fix.

## Reference / evidence links

- Run: `workflow_runs.id = 26b5a898-c0ca-4fbb-ae35-ed488bbf2eb2` (2026-08-14 16:16 UTC)
- Emit output: `workflow_phases.output` where `slug='emit'` — carries `field_map`,
  `retrieved_ids` (41) and `placeholder_keys` (8)
- Code: `backend/app/services/harness/phase_types.py:436-441` (the ∩ and its `_proj` fallback)
- Produced artifact: `/weekly-status-report.docx`, 37585 bytes, `opened: true`,
  `residual_clean: true`
- Found during the `260814-q5r` end-to-end verification, at the operator's request that the
  feature be proven by a real run rather than by a panel rendering
