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

## Update 2026-07-31 — the missing second half: nothing routes a bad run back into the DEFINITION

Surfaced during Phase 185 operator UAT (2026-07-30/31). Everything above this line stops at
**MEASUREMENT**. Re-read §"Likely shape if promoted": drive the workflow path, score it against goldens
or a rubric, add validators, gate NL-generated workflows before publish. All four end at a **number**.
Nothing in this seed — or anywhere in the codebase — takes a bad run and turns it into a **change to the
workflow definition**. That is the unclaimed half, and the operator asked for it directly on 2026-07-31:
*"flexibility to modify, to fine-tune"* workflows.

### The asymmetry is visible in the schema, not just in the prose

Skills got the entire loop. Workflows got none of it:

| Piece | Skills | Workflows |
|---|---|---|
| Eval history keyed to the versioned artefact | `eval_runs.skill_id NOT NULL REFERENCES skills(id)` + `skill_version_id` (`supabase/migrations/080_eval_runs_and_results.sql:42-55`) | none — no `workflow_id` column anywhere in the eval substrate |
| Per-case verdicts + operator ratings | `081_eval_verdict_and_ratings.sql`, `085_eval_matrix_duration_case_feedback.sql` | none |
| Held-out cases | Phase 123/123.1 Trigger Tuner held-out picks | none |
| Run evidence → proposed edit → approval → new version → auto re-eval | `skill_proposals` (`083_skill_proposals.sql`, Phase 135 SI-01) — proposes an instruction-body edit, creates a `skill_versions` row `source='self_improve'` **only on approval**, then auto re-evals | **no analog** |
| Versioned definition to write back into | `skill_versions` | `workflow_definitions` (`056_workflow_definitions.sql`, `(slug, version)` unique) — **exists, but nothing writes a new version from run evidence** |

The last row is the point: the write target already exists. The loop that would use it does not.

### What the second half is

1. **Per-workflow eval history keyed to the definition version that produced it** — every run scored and
   retained, not just the pre-publish verdict. A workflow's quality is a trend, not a snapshot.
2. **Held-out cases per workflow** — so a definition change is measured against cases it was NOT tuned
   on. The idiom is already built and validated on the skills side; this is a port, not an invention.
3. **A proposal path** — run evidence → a proposed edit to the definition (a phase prompt, a validator,
   a KB scope, a `field_map`) → operator approve/reject → a new `workflow_definitions` version → auto
   re-eval against the held-out set → promote or not. Mirror `skill_proposals`' lifecycle, including the
   rule that the new version row is created **only on approval** so history stays clean of abandoned
   drafts.

### The publish gauntlet is NOT this, and here is the measured reason

The publish judge is a **one-shot gate at publish time**, and it is model-fragile. On 2026-07-30 with
`harness_judge_model=gemini-3.5-flash`, the publish judge returned failure `provider_error` with
`overall_score` null and **no verdict at all** (run `da5541c0`). The operator switched
`harness_judge_model` to `gpt-5.5` at 20:13:20; the golden run at 20:13:38 (`ced8005d`) passed with
`overall_score 82` and `publish_succeeded`. A gate that can go silent on a model swap cannot double as
the quality history. Keep them separate: **gate at publish, history across runs.**

The passing judge summary, verbatim, is the shape a per-run record should retain — because *this* is what
an operator acts on when deciding what to change; `82` is not:

> "six obligation rows, each with source_clause, current_state, gap, severity, and owner, every populated
> cell carrying a citation to a named knowledge-base document, and the one unsupported field
> (report_title) correctly nulled rather than invented ... it is legitimately cited, so grounding holds."

### Hard precondition: the reported reason must BE the rejection reason

The same UAT produced the inverse failure mode, and any feedback loop built on run verdicts inherits it:

- **BUG-260730-01** (fixed by plan 185-12): the auto-attached `retrieved_and_cited` citation gate demanded
  inline `[1]`/`(doc-N)` markers that **nothing ever instructed the model to write**. A correctly-detected
  grounded step retrieved correctly and still failed 3/3 attempts. Fixed by telling the producer — never
  by weakening the gate.
- **BUG-260730-02** (open): the emit step's failure was surfaced as *"citations_required: no field_map on
  output"* while the audit showed `citation_coverage_pct 100.0`, zero uncited, zero invented. The real
  rejection was `covers_template=false`. The executor's precise message **was computed and then discarded**
  in favour of the gate's generic one.

A proposal engine fed BUG-260730-02's message would go fix citations on a run whose citations were
perfect. So the second half has a dependency, not just a scope: **a run's reported failure reason must be
its actual failure reason** before any of it is worth building.

### Trigger and owner — unchanged

Same trigger, same owner; this is not a new seed. Add to `trigger_when`: **any phase that ships workflow
authoring or editing, including the v3.6 Workflow Studio (Phases 181-189)**. The owner stays "the durable
automated measurement" — with the correction that measurement whose only consumer is a dashboard is half
a system.
