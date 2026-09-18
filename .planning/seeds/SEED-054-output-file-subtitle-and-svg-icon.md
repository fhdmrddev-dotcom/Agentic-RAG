---
seed_id: SEED-054
title: Output-file descriptive subtitle (needs a backend description/role field) + folded-page SVG file icon — the two Phase-095 design-fidelity items deferred from gap closure
status: planted
planted: 2026-06-06
planted_by: orchestrator (/gsd:execute-phase 095 — operator live-UAT gap triage; full-fidelity scope chose to defer these two LOW/data-contract items)
trigger_when: Phase 095 gap closure has shipped AND we want the output-files area to fully match sketch 016, OR any phase that adds a structured field to the `final_output_files` wire shape (backend agent_loop.py emit + persist + frontend api.ts + types/index.ts `OutputFile`), OR a v2.9 chat-surface polish pass.
trigger_paths:
  - "**/agent_loop.py"
  - "**/api.ts"
priority: low
tags: [chat-surface, output-files, sketch-016, file-axis, data-contract, 095, design-fidelity]
surface: Agentic-RAG
---

# SEED-054: Output-file subtitle + folded-page SVG icon (deferred 095 design items)

## Context (how it surfaced)

`/gsd:execute-phase 095` reached `human_needed`; operator live-UAT (2026-06-06) reported
"overall good but not the same as the sketches." A diagnostic workflow (`wf_a263d71a-919`,
11 agents, adversarially verified) produced a ranked sketch-vs-implementation diff. The operator
chose **full-fidelity** gap closure for the HIGH/MEDIUM divergences but explicitly **deferred** the
two items below — one because it needs a new data contract, one because it is not actually a gap.

## The two deferred items

### 1. Per-file descriptive subtitle (data-contract gap)
Sketch 016 renders a two-line stack on every output-file row:
- hero: `report.docx` / **`4.1 MB · the file you asked for`**
- working: `appendix.docx` / **`182 KB · matplotlib · intermediate`**

Today `OutputFileCard` renders the size only as a right-aligned badge — there is **no descriptive
subline**, and the wire shape (`types/index.ts` `OutputFile = {filename, url?, size?, is_hero?}`)
has **no `description`/`role` field** to back the "the file you asked for" / "intermediate" text.

**To do it honestly:** add a `description` (or `role: "deliverable" | "intermediate"`) field to the
`final_output_files` emit + each persisted `execute_code` `output_files` entry in
`backend/app/services/agent_loop.py`, thread it through `frontend/src/lib/api.ts` +
`types/index.ts`, and render a real subline in `OutputFileCard`. The agent could set `role`/
`description` when it declares files (D-08 already added an agent-marks path for `is_hero` — the
same site can carry `role`). **Do NOT fabricate the subtitle on the frontend** — it must be backed
by real data or stay size-only.

**Gap-closure interim:** render the hero size as a *subline under the filename* (`4.1 MB · …`)
instead of only a right-aligned badge — echoes the sketch's two-line hero treatment without
inventing the descriptive text. (This interim may be done in 095 gap closure; the full
description/role field is the seed.)

### 2. Folded-page SVG file icon (NOT a required change)
Sketch 016's `fileIcon()` renders an actual folded-page SVG (light page + folded corner + inset
glyph + a **filled colored ribbon** with white `.EXT` text). The code uses a **Lucide glyph +
tinted `.EXT` text label** instead. **The written design contract EXPLICITLY PERMITS the Lucide
form** (016 README:72, chat-tool-card-unification.md:79-81, CONSISTENCY.md G1:56 all say "a
Lucide-based equivalent … is fine"). So this is **not a real gap** — captured only so that if a
future pass wants the exact rendered artifact, the work is: wrap the `.EXT` label in a filled
colored rounded badge (bg = category color, white text) in `frontend/src/lib/fileIcon.tsx`.

## Why deferred (not in 095 gap closure)

- Item 1 changes the `final_output_files` **wire shape** (backend emit + persist + frontend type) —
  a data-contract change broader than the visual gap closure, and the gap-closure interim
  (size-as-subline) gets 80% of the felt improvement with zero schema risk.
- Item 2 is contract-permitted as shipped — building the SVG ribbon is taste, not correctness.

## Re-open trigger

When any phase adds a structured field to `final_output_files` (natural home for `role`/
`description`), OR a deliberate v2.9 chat-surface polish pass, OR the operator asks for the exact
sketch-016 file-row treatment. Linked: the Phase 095 gap closure (`095-HUMAN-UAT.md` GAP-095-03
"Deferred to a SEED").
