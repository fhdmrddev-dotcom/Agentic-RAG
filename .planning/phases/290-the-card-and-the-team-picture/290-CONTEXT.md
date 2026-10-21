# Phase 290: The Card and the Team Picture - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning (chip-line sketch approved: winner B, 2026-10-21)

<domain>
## Phase Boundary

Two read-only visual changes to workflows:

1. **VIS-04, the card.** The library card gains one quiet line of labelled step chips. Everything else on the card stays as it ships today (sketch 179 C, shipped in 192.2).
2. **VIS-01, the team picture.** A workflow can be opened as a picture of its orchestrator, its steps and any judge or check. The picture is built only from the workflow definition and draws no line the definition lacks.

Out of scope: a live "who is working now" run view, the LibraryToolbar rework, any new phase type, edge or schema field, and any second canvas or runtime.

</domain>

<decisions>
## Implementation Decisions

### Measured before deciding (2026-10-21)
- **The card's acceptance bar moved after VIS-04 was written.** VIS-04 and SEED-155 point at sketch 163, which drew labelled chips and a smaller purpose line. A later approved sketch, **179 C**, shipped in 192.2 (2026-08-19). It cut the purpose sentence and the phase glyphs from the resting card on purpose. The card today has a 3 px run-outcome gutter, line 1 with the name and version, and line 2 with run truth and state. So "the description no longer dominates" is already true. Only the chips are new.
- **Production definitions are small** (Supabase MCP read on `workflow_definitions`, no writes): 29 definitions; 7 have steps, all with 2-3 steps; **0** have `llm_batch_agents`, **0** an `llm_judge_rubric` gate, **0** a `skip_to_phase`. Most real team pictures will be the orchestrator plus 2-3 steps with no judge. The sketch's 7-step "Vendor risk review" is the stress case, not the common case. Planning and UAT must cover both.

### The card (VIS-04)
- **D-01:** Keep the 179 C card exactly as shipped. Add **one third line** of labelled step chips under line 2. Render it **only when the definition has at least one step**. Never draw an empty chip row.
- **D-02:** The purpose or description stays off the resting card (179 C stands). VIS-04's "description no longer dominates" is met by the shipped card. The UAT records that as a measurement, not as new work.
- **D-03:** Overflow: show **the first 3 steps in run order, then a `+N more` chip**. The line never wraps. `+N more` names the remaining steps **in visible words**, not only in `title=`, because touch has no hover (SEED-155 item 1, the D-14 hover problem).
- **D-04:** Chip words are the **type sentence**, `PHASE_TYPE_SENTENCES` in `phaseVocabulary.ts` (e.g. "Work out how to do it"), with the `PHASE_GLYPHS` glyph. **Never the author's step name and never `PHASE_TYPE_LABELS`** (that map is the ⌥ technical-names vocabulary). Settled by sketch 290-card-chip-line, winner B (2026-10-21): author names run to 54 characters and truncate to stubs on a card. Never type ids, never literals in the card. Any new string is a vocabulary **entry** in `libraryVocabulary.ts` (the 286 forecast: data, no logic).
- **D-05 (G-2):** ✅ DONE 2026-10-21: `.planning/sketches/290-card-chip-line/`, winner **B** (bordered pills, glyph + type sentence, `→`, first 3 + `+N more` that expands in place). It is the SC#1 screenshot bar. Original decision: **Sketch the chip line before planning.** It is a small sketch that **renders the real card component** (or its generated build contract) with the chip line added. SEED-155's rule is that a sketch of a surface that consumes an existing component must render that component, not redraw it. The operator approves it, and it becomes the screenshot bar for SC#1. Sketch 163's hand-drawn chips are reference only, not the bar.

### Where the team picture opens (VIS-01)
- **D-06:** **One entry point:** a `Steps | Team` switch in the workflow builder header, as sketch 290 has it. At most **one gated mount** in `WorkflowCanvas.tsx` (286 forecast). The picture is a separate read-only view, never a second canvas. There is no entry from the library card or the run page in this phase.
- **D-07:** **Anyone who can open the workflow can see its team**, including starters and another person's published workflow in read-only mode. It reads only the definition the viewer already holds, so it grants no new access and needs no new API.

### What the picture draws (sketch 290 winner A, org chart)
- **D-08:** Layout is **A, the org chart**: the orchestrator at the top branches to every step in run order, and judges and checks hang under the step they grade. Variants B and C are rejected.
- **D-09:** **The orchestrator is the engine, not a phase.** **No step-to-step lines are drawn**: there is no field for a step-to-step link, and every step reads all earlier outputs through `accumulated_outputs`. The picture must make "steps don't talk to each other" read as true, not as a broken diagram (sketch question 2).
- **D-10:** `⤳` is drawn **only** for `on_failure: skip_to_phase:<slug>`. It runs from the check that owns the `on_failure` to the target step. `retry` is written in words, never drawn as a loop.
- **D-11:** **One pure derivation feeds the picture** (the sketch's `model()`). It lists every drawn line with its source path in the definition. That list is the SC#3 test surface: a planted workflow with no worker-to-worker link must produce zero such lines, asserted on rendered content, not only on testids.

### Small and judge-less teams
- **D-12:** **A 1-step workflow shows an honest single node.** The switch works, and the picture shows the orchestrator plus the one step with a line in words, e.g. "One step, so there is no team to coordinate." No invented worker (SC#4). The final copy belongs to the sketch and UI-SPEC.
- **D-13:** **Absence is said once, in words.** With no gate the line is "Nothing checks this work". With only non-judge checks it is "Checked by rule, not by a judge". Final copy belongs to UI-SPEC, and the strings go in the vocabulary file.
- **D-14:** An `llm_batch_agents` step is drawn as **up to N seats**, from `max_parallel_agents`, labelled "up to N at once". The field is a cap, and how many actually ran is only known in a run. This shape appears in no production definition today, so the planted fixtures must cover it.

### Role and gate words
- **D-15:** **Step roles reuse the shipped step words** from `phaseVocabulary.ts`, the same words the chips use (D-04). The sketch's proposed corner words (`fixed step / writer / agent / team / you / producer / outside`) are **not adopted**. There is one vocabulary and no second copy to drift.
- **D-16:** **Gates read "Judge" or "Check".** A `ValidatorSpec.kind == "llm_judge_rubric"` gate is a **Judge** and every other kind is a **Check**. These two words are vocabulary entries. The ⌥ Technical names reveal shows the real kind (`llm_judge_rubric`, `regex_match`, …) by swapping the subtitle, per the existing convention. Judges and checks get **no new glyph** (icon convention §4, X-2).

### Claude's Discretion
- Where the pure derivation lives (a new leaf next to `canvasModel.ts` or `soulData.ts`). It must be a value-only module: no React, no API import, the `cardFace.ts` pattern.
- How the chip line is fed into the card. It must stay within the ledger budget ("ONE optional prop", 286 forecasts for `PhaseSpineGraph.tsx` / `PhaseNodeCard.tsx`) and must not edit `WorkflowSoul.tsx`'s card contract unless the planner justifies it. `WorkflowSoul scale="card"` is also consumed by `WorkflowDoorSwitch.tsx`, and `PhaseSpine scale="card"` by `StarterTemplatePicker.tsx`, so a change there changes those surfaces too.
- Plan count: target 3-5 (G-8).

### Folded seeds
- **SEED-155**, card half only: one chip line, sketched first. Status `folded` with `partial: true`. The toolbar and the counter pill stay open on the seed.
- **SEED-086**, authoring moment only. Status `folded` with `partial: true`. The live run view stays open on the seed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design bars
- `.planning/sketches/290-team-picture/README.md` + `index.html`: the team-picture sketch, winner **A**, with the schema-truth rules D-08..D-11 come from. View it via `python -m http.server 8765` in `.planning/sketches`.
- `.planning/sketches/179-what-the-eye-lands-on-honestly/README.md`: the card language that shipped (winner C). D-01/D-02 keep it.
- `.planning/sketches/163-the-assembled-card/README.md` + `BUILD-CONTRACT.generated.md`: the older card bar. Reference for chip style only (D-05).
- `.planning/sketches/290-card-chip-line/README.md` + `index.html`: the chip-line bar, **winner B**. It renders real captured card DOM with the app's CSS. **SC#1 screenshot bar.**

### Requirements and seeds
- `.planning/ROADMAP.md` § Phase 290: goal, SC#1-4, "How we'd know this failed".
- `.planning/REQUIREMENTS.md`: VIS-01, VIS-04.
- `.planning/seeds/SEED-155-workflow-card-does-not-match-its-approved-sketch.md`: the sketch→build drift mechanism and the "render the real component" rule.
- `.planning/seeds/SEED-086-visual-multi-agent-representation.md`: origin of the team picture and the no-fake-edges rule.

### Conventions and guardrails
- `docs/HOT-FILE-LEDGER.md`: sections for `WorkflowCard.tsx`, `PhaseSpineGraph.tsx`, `WorkflowCanvas.tsx`, `PhaseNodeCard.tsx`, `libraryVocabulary.ts` (286 forecasts for 290).
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4: canvas glyph vocabulary. Judges and checks get no glyph.
- `frontend/src/components/workflows/library/cardFace.ts`: the pattern for a pure value-only leaf.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `phaseVocabulary.ts`: `PHASE_TYPE_LABELS`, `PHASE_TYPE_SUBTITLES`, `nodeTitle()`, `technicalTitle()` (the ⌥ reveal), `SKIP_PREFIX` + `parseSkipTarget()` for `⤳`, `branchConditionOf()`.
- `soulData.ts` `PHASE_GLYPHS`: the 7 shipped phase-type 3D glyphs.
- `PhaseSpine.tsx`: hides names at card scale (`showNames = scale !== "card"`, `:51`). The chip line must not silently change other `scale="card"` consumers.
- `library/cardFace.ts` / `rowIdentity.ts`: the card's one face decision, with words imported from `libraryVocabulary.ts`.

### Established Patterns
- Words live in vocabulary files. A copy change is a one-line diff in one file (D-14 from 192.1).
- Read-only graphs never invent edges (the 103 honesty rule). Assert rendered CONTENT, not only presence (G-8 lesson).
- `ValidatorSpec.kind` already distinguishes `llm_judge_rubric` (always-on judge, see `deriveTier.ts`).

### Integration Points
- `library/WorkflowCard.tsx`: the chip line (G-5 fires; seam taken in 286-04; keep the change to one line or one prop).
- `WorkflowCanvas.tsx` / builder header: the `Steps | Team` switch (≤ 1 gated mount).
- The new team view reads the same `definition` the builder already holds. No backend change and no migration are expected.

</code_context>

<specifics>
## Specific Ideas

- Chip line as approved (sketch 290-card-chip-line B): `🧭 Work out how to do it → 📦 Produce the deliverable`, and `+3 more` on a 6-step card.
- UAT must drive both a real 2-3 step production-shaped workflow and the 7-step stress workflow. ROADMAP's failure line, "looks good on the sketch's example and breaks on a real 7-phase workflow", applies both ways.
- G-4 failure scenarios to set at UI-SPEC time: chips show type ids; a line appears between two steps; a 1-step workflow shows a worker that doesn't exist; a no-judge workflow shows an empty judge slot with no words.

</specifics>

<deferred>
## Deferred Ideas

- **LibraryToolbar rework** (filled Create button, full-width search, chips row) and the **counter pill** sized for `43 share this name`: stay open on SEED-155.
- **Live "who is working now" run view**: stays open on SEED-086 (its second moment).
- **Team picture from the run page or the library card ⋯ menu**: not in this phase (D-06). It would be a new entry point.
- **Publish-gauntlet judge in the picture**: excluded by sketch 290 (it belongs to the definition's history, not the running team).
- Reviewed, not folded: BUG-260610-01 (run nav timer) and BUG-260815-06 (gauntlet refusal copy) touch workflow UI but not the card or the team picture. Both stay open.

</deferred>

---

*Phase: 290-the-card-and-the-team-picture*
*Context gathered: 2026-10-21*
