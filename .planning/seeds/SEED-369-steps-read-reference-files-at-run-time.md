---
seed_id: SEED-369
title: Let a workflow's steps read or cite the reference files saved with its draft, while it runs
created: 2026-10-23
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "an operator workflow needs a step to cite or read an attached reference while it runs"
trigger_paths: ["backend/app/services/harness/phase_types.py", "frontend/src/components/workflows/decisionsVocabulary.ts"]
trigger_surfaces: []
migration_note:
relates_to: ["291", "SEED-051", "SEED-157", ".planning/phases/291-describe-it-from-your-own-files/291-CONTEXT.md", ".planning/phases/291-describe-it-from-your-own-files/291-UI-SPEC.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-369: Steps read reference files at run time

## The finding

Phase 291's D-05 said reference documents *"are saved with the draft so its steps can cite or read
them at run time."* 291 delivered only the first half, deliberately (D-32, the narrowed D-05):

- The describe door takes up to 5 reference files (291-04). Their text reaches the drafting model as
  fenced, untrusted content when the draft is written (291-02).
- At the first autosave each is stored with the draft as `assets[kind=reference]`
  (`POST /workflows/{id}/reference`, 291-01), and the decisions `template` row lists them after a
  reload (291-05).
- **No step reads them when the workflow runs.** Research measured that `assets[kind=reference]`
  has no run-time consumer (291-RESEARCH A9 / Open Question 2). Building one is a new capability,
  not part of 291.

The UI says so in words: `templateRowReferencesLine` in
`frontend/src/components/workflows/decisionsVocabulary.ts` reads *"Used to write this draft; steps
don't read them when the workflow runs."*

## Why it matters

An author who attached a policy or a price list may expect the run to consult it. Today it shapes
only the draft's step instructions. A run cannot quote it, cite it or check against it unless the
same file is also in a Library folder the workflow reads.

## When to surface

When an operator workflow needs a step to cite or read an attached reference while it runs, or any
phase that gives `assets[kind=reference]` a run-time reader (the harness phase executors in
`backend/app/services/harness/phase_types.py`).

⛔ **The phase that ships run-time reading owns changing `templateRowReferencesLine`'s second
sentence, in the SAME commit as the capability.** Until then that sentence is the truth.

⚠ **Re-check the "powers" set when this lands (research A1 / D-34).** 291 walls off the tools a file
may never grant (`web_search`, `save_skill`, `attach_skill_file`, `remember`, every
`external_action` step, every connection and MCP tool, and any grant). A step that READS a
reference at run time puts file text in front of a running model, not just the drafting one, so the
D-14 rule ("powers come only from the author") must be re-derived for that path rather than assumed.

## Scope estimate

Medium. A read path from the run to the stored asset (owner-scoped Storage read), a way for a step
to name which references it reads, the fenced-content rule applied at run time, citations that can
point at a reference, and the vocabulary change above.

## Breadcrumbs

- 291-CONTEXT.md D-05 (original) and D-32 (the narrowing, orchestrator decision 2).
- 291-UI-SPEC.md "Deviation from D-05 (recorded, not hidden)".
- 291-RESEARCH.md A1 (the powers set) and A9 (no run-time consumer of reference assets).
- Planted by 291-05 at the phase close-out (2026-10-23), id allocated as max(existing)+1.
