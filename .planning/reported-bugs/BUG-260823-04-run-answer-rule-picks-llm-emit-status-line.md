---
id: BUG-260823-04
title: runAnswer selection rule picks llm_emit status line over substantive answer
reported: 2026-08-23
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/workflows]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-191]
re_open_trigger: "⚠ REVIEWED AT /gsd:discuss-phase 214 (2026-08-28) AND NOT FOLDED — recorded so the consideration is not repeated as a discovery. Phase 214 touches the run surfaces for step IDENTITY (service mark + action name, SC#4) and step FAILURE (SC#5), and touches `RunTranscript` / `RunStepList` / `RunSpine` / `PhaseCard`. It does NOT touch runAnswer selection, which is a different rule on the same files. `status` stays `open`. See 214-CONTEXT.md <deferred>. ── ORIGINAL ── The next phase touching the run surface's answer selection, or an operator report of the wrong-answer hero on another workflow."
reproduces_on:
  branch: develop
  commit: 4adf13ae
  date: 2026-08-23
---

# BUG-260823-04: runAnswer selection rule picks llm_emit status line over substantive answer

## What we observed

On the real QBR run (`bef870ba-0000-4000-8000-000000000001`), the shipped `runAnswer` selection rule (in `frontend/src/pages/WorkflowRunPage.tsx:840-867`) iterates backwards through server-ordered phases to find the last phase with non-empty `deliverable_text` (skipping `llm_human_input`).

Because the final `emit-qbr` step is typed `llm_emit`, the rule selects its 61-character status line:
```text
Produced the filled deliverable: /Northwind-QBR-Template.docx
```
while the preceding `synthesize` step (`llm_single`) holds **6,133 characters** of the actual comprehensive narrative answer.

As a result, the run surface displays the 61-character filename announcement under "The answer this run wrote", instead of the 6,133-character substantive synthesis.

## Why it matters

When both a file emit and an answer synthesis occur in a workflow, the user expects the answer hero to show the generated narrative, not the file emit log announcement.

## Hypothesized cause

`runAnswer`'s selection rule treats all non-`llm_human_input` steps equally, picking the last step in server order. However, `llm_emit` steps often emit a short status confirmation rather than a synthesized prose deliverable.

## Deliberately NOT fixed in Phase 200.2

This defect is recorded as a known issue and intentionally **not** fixed in Phase 200.2 per operator decision (D-17). A naive skip of `phase_type === "llm_emit"` would be fragile (an emit step whose text *is* prose would be wrongly skipped). Any future fix requires a measured cross-row heuristic and validation across all historical runs.

## Surface classification

- **Surface:** `Agentic-RAG` (Workflow run page deliverable hero).

## Suggested routing

- **Defer to future phase / milestone:** Re-evaluate during subsequent workflow answer/deliverable refinement phases.
- **Related seeds:** SEED-191.
