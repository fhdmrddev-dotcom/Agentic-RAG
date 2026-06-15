---
id: SEED-050
title: Workflow result-quality measurement — seed-prompt redesign + golden-output/rubric eval (functionality ≠ quality)
status: planted
planted: 2026-06-02
planted_by: orchestrator (093 plan-phase — operator-raised "workflows trigger but don't produce as-intended results")
trigger_when: Phase 096 (eval + verify — the natural home for a workflow-output rubric), OR any phase that adds/edits a seed workflow's prompts, OR the v2.9 workflow-authoring/builder work (NL-generate needs an output-quality gate), OR a milestone close that claims workflows "work"
priority: high
tags: [harness, workflows, seed-prompts, eval, quality, 096, EVAL-01, EVAL-02]
---

# SEED-050: Workflow Result-Quality Measurement

## Context (how it surfaced)

During Phase 093 plan-phase, the operator flagged: harness workflows *trigger and run*, but
don't always work *as intended in terms of results* — concrete example: **the Research
workflow asks the user to share the research** instead of doing it. A 3-agent investigation
(wf_fad50111-02d) + a phase_types.py re-read confirmed this is a **real, systemic
result-quality gap** distinct from functionality:

- **Symptom root cause (the cheap half — fixed in 093):** the downstream `llm_single` phases
  of 3 of the 4 seeds (research_summarize *summarize*, literature_review *merge*,
  doc_qa_human *finalize*) had vague prompts ("summary of the prior research findings") and the
  model sometimes treats the chained prior-phase output as a conversation and asks the user to
  supply it. **NOT a wiring break** — `_exec_llm_single` already chains the prior output as the
  user turn (`_prior_output_text`, phase_types.py:116/231) and ignores `input_keys`. Fixed in
  093 migration 065 Fix-3 (anti-delegation prompt rewrite) + a thin operator pass/fail quality
  row in 093-VALIDATION Dimension 5.

- **The deeper half (this seed):** there is **no repeatable, automated measurement of whether a
  workflow's output is actually good** anywhere in v2.8. 093's gate is functional (triggers,
  runs, dispatches tools, surfaces an answer, fans out, round-trips). The eval harness
  (`scripts/eval_cross_provider.py`) only tests the **Deep chat path** and only asserts a tool
  was *invoked* (`_assert_factual_doc_search` never reads the answer text); it never creates a
  `workflow_run`. So a workflow can pass every gate and still emit a wrong/hollow answer.

## Where it was (barely) noted before

The exact concern was captured ONCE — `092-07-UAT-FINDINGS.md` UPDATE 4 / F8: an operator
re-ran Research→Summarize and got "please send me the topic" *despite finding 5 sources*,
flagged as a "candidate follow-up (workflow-prompt-quality phase or seed)." **That seed/phase
was never created** — the wiring half got fixed (F8, commit 95da3032) and the quality half was
lost. This seed exists so it isn't lost again.

## Other quality defects found (beyond the asks-the-user symptom)

- **plan_execute_verify's verify-gate is theatrical** — it only checks the literal token
  `VERIFIED` appears; a model can emit it on a wrong result (gate gameable) or do real work and
  forget it (false fail). 093 drops the dead-ending gate; a *substantive* verification
  (re-run/re-check the artifact) is unbuilt.
- **No phase has output validators** — nothing checks an answer is non-empty / grounded, so
  degenerate output passes as "success."
- **Citations aren't structurally threaded** into the summarizer — "cited summary" relies on
  the model, so citations may be hallucinated/omitted even when sources were found.
- **literature_review is KB-only** (no web_search) — thin KB → thin review, even on success.

## Likely shape if promoted (target: Phase 096 eval)

1. Extend `scripts/eval_cross_provider.py` to drive the **workflow/harness path** (create a
   `workflow_run`, run each seed end-to-end) — not just the Deep chat path.
2. Add **golden expected-output** anchors or an **LLM-rubric judge** per seed workflow
   (grounded? answers the question? did the agent do the work vs delegate?), scored per
   native-7 provider — the repeatable version of 093's thin manual pass/fail row.
3. Consider a substantive verify-phase (re-check the artifact) to replace the token gate, and
   output validators (non-empty/grounded) as safe-by-construction guards.
4. Feed this into the v2.9 authoring/builder work — NL-generated workflows need an
   output-quality gate before publish.

## Re-open trigger (concrete)

Promote at **Phase 096** (EVAL-01/EVAL-02 — the eval + verify phase), OR whenever a phase
adds/edits a seed workflow's prompts, OR when v2.9 workflow-authoring begins (NL-generate needs
a quality gate), OR at a milestone close that claims workflows "work." Until then, 093's
migration-065 prompt fix + the Dimension-5 manual pass/fail row are the interim guard; this
seed owns the durable automated measurement.
