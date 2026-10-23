---
sketch: 290
name: team-picture
question: "How does a multi-agent workflow read as a truthful team (orchestrator / workers / judge) without drawing a single edge the definition lacks?"
winner: "A"
tags: [phase-290, vis-01, seed-086, workflow, read-only, schema-truth]
---

# Sketch 290: The Team Picture

## Design Question
VIS-01 / SEED-086: show a workflow as the team it is: who runs the work, who does it, who
waits for you, who checks it. Every line must trace to a field in `WorkflowDefinition`
(ROADMAP 290 SC#2-4).

## How to View
Serve the sketches folder (`python -m http.server 8765` in `.planning/sketches`), then open
`http://127.0.0.1:8765/290-team-picture/index.html`. A `file://` open also works in a normal
browser.

## Variants
- **A: Org chart.** The orchestrator branches to every step in run order. Judges and checks hang under the step they grade.
- **B: Office floor.** A room of desks with the orchestrator's desk, the shared record and a judge's bench. Your step sits at the door. Order is shown by desk number, checks are tags, and almost no lines are drawn.
- **C: Layers (control room).** Lanes for *runs / does / waits for you / checks*. Each step keeps its own column, so order reads left to right and everything about one step lines up vertically.

Workflow switcher (the same picture for every variant):
- **Vendor risk review, 7 steps.** Uses all 7 phase types, 1 judge, 2 checks and 1 `skip_to_phase`. This is the real-size stress case.
- **Literature review, 3 steps.** The seeded workflow from mig 061. It has no gates, so the sketch draws no judge and says so.
- **Plan → Execute → Verify, 3 steps.** Seeded. Its gate is a `regex_match` check, not a judge.
- **Draft a reply, 1 step.** The honest single node (SC#4). The Team segment is disabled.

## Schema truth this sketch is built on (measured 2026-10-20)
- **The orchestrator is the engine, not a phase.** `harness_engine.py` runs phases in index order and passes `accumulated_outputs`, so every step reads all earlier outputs. There is no field for a step-to-step link, which means **0 step-to-step lines are drawn**.
- **A judge is a `ValidatorSpec.kind == "llm_judge_rubric"` on one phase.** It is a gate, not a node, and has no glyph (icon-convention §4, X-2). Every other gate kind is labelled a **check**.
- **⤳ is drawn only for `on_failure: skip_to_phase:<slug>`.** The line starts at the check that owns the `on_failure` and ends at the target step. `retry` is written as words, not drawn as a loop.
- **Parallel seats come from `max_parallel_agents`.** That field is a cap, so the label reads "up to N". How many agents actually ran is only known in a run.
- **One derivation (`model()`) feeds all three variants.** The variants differ only in how they draw. The side ledger lists every line with its source path, which is the SC#3 test surface.

## Marks used (§4 glyph audit)
- **Shipped:** the 7 phase-type 3D glyphs (`soulData.ts` PHASE_GLYPHS: compass, handshake, outbox-tray…), `⤳`, and the ⌥ Technical-names reveal, which swaps the subtitle to `${label} · ${slug}`.
- **PROPOSAL (net-new, flagged):** the corner role words (`fixed step / writer / agent / team / you / producer / outside`) and the words "Judge" and "Check" on gate cards. No new glyphs.

## What to Look For
1. Does the 7-step workflow stay legible? A gets wide; C keeps columns.
2. Does each variant make "steps don't talk to each other" obvious, without looking like a broken diagram?
3. Is the judge visibly tied to the one step it grades, and visibly different from a check?
4. On 1-step and no-gate workflows, does the absence read as honest rather than empty?

## Open questions (not decided here)
- **A live "who is working now" run view** (SEED-086's second moment) is deliberately out of scope. ROADMAP 290 builds from the definition only, so this sketch adds no second runtime.
- **The publish-gauntlet judge** (pre-publish) is not shown. It belongs to the definition's history, not to the team that runs.
- **Entry point:** a `Steps | Team` segment in the builder header, per the 286 forecast (≤ 1 gated mount in `WorkflowCanvas.tsx`).
