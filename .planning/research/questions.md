# Research / Open Decisions Questions

Open questions surfaced during exploration that need a decision (usually at the named
discuss-phase). One section per topic. Append; don't rewrite.

---

## NL→Workflow Authoring (for v2.9 / D-092-AUTHOR Phase B/C — see SEED-051)

Surfaced: `/gsd:explore` 2026-06-03 (operator). Decide these at v2.9 discuss-phase, *informed by
the recommended spike* (companion todo `spike-nl-workflow-authoring.md`). Each has a recommended
default from the grounding investigation (workflow `wf_7faac1cf-4fa`).

1. **Where does the output-QUALITY gate live, and is it a publish blocker?**
   A generated workflow can be structurally valid (passes `lint_workflow`) and still produce
   garbage — that is SEED-050, restated at authoring time. Options: (a) golden expected-outputs
   per workflow, (b) an LLM-rubric judge per run, (c) both. **Recommend: an output-quality eval
   gate is a HARD dependency before NL-authoring ships** (generation safety ≠ result quality).
   This is the single biggest latent risk. Owner: SEED-050 → Phase 096 eval.

2. **Who may author — self-serve vs operator-only?**
   Options: (a) operator/`super_admin`-only (controlled, matches Plugin tier), (b) any end-user
   but drafts-only + operator approves global publish, (c) fully self-serve incl. sharing.
   **Recommend: (b)** — which is *exactly what RLS already enforces* (users can't self-promote to
   `is_global=true`); drafts are always lint-gated + never auto-published, so self-serve drafting
   is low-risk.

3. **What IS the generator — one-shot structured call, constrained decoding, or a meta-workflow?**
   Options: (a) one-shot structured call emitting a `WorkflowDefinition` → `model_validate` +
   `lint` + auto-retry (provider-uniform; we already own the structured-output layer); (b)
   provider-level constrained decoding (strongest shape guarantee, but provider-specific — fights
   the cross-provider-uniform-UX rule); (c) a meta-workflow that builds workflows using the
   harness itself (dogfood; heavier). **Recommend: (a) as baseline**, optionally layer (c) later
   as a Plugin-Contract dogfood once telemetry justifies it.

4. **Should a phase be able to inject a Skill (skill-in-phase composition)?**
   A phase whose system prompt = a loaded skill gives a consistent per-step quality bar (industry
   best practice), but couples the workflow contract to the skills registry. **Recommend: design
   the field now (e.g. `skill_ref` on llm_agent/llm_single configs), wire in v2.9** — "design the
   seam now, wire later," like `output_keys` already is. Also note the reverse: can a skill
   *trigger* a workflow? (deferred, name it consciously).

5. **How are workflow INPUTS shaped — AI-derived dynamic fields, locked on publish?**
   Operator direction: inputs are NOT hand-defined static fields; the generator infers them from
   the description + uploaded template, human refines, then they lock. Decide: the `inputs`
   schema shape on `WorkflowDefinition` (field types, KB-auto-fill markers, required/optional),
   and whether run-time may auto-populate some inputs from the KB. **Spike answers the shape.**

6. **Templates/assets owned by a workflow — Storage model + fill mechanism?**
   A workflow carries attached files (templates/forms/reference docs). Decide: where assets live
   (Storage bucket + reference in the definition; RLS), and whether template-fill is a
   `programmatic` fn, an `execute_code` phase, or a first-class "fill" capability. **Spike
   answers whether docx/pdf fill is robust enough to make first-class.**

7. **Per-phase KB folder scoping — config field + run-time enforcement?**
   Pin a phase to a KB folder/subfolder so it always pulls from the right place (the
   reliability-from-grounding lever; search is whole-KB today). Decide the config field
   (`folder_scope`?) and how `search_documents` honors it within a phase.

8. **Do we add the orchestrator-workers pattern (runtime-dynamic phases)?**
   Our 5 types cover 4 of Anthropic's 5 workflow patterns; the missing one is an LLM creating
   subtasks at runtime (we only have `programmatic split_topic` fan-out at a fixed phase). It
   breaks "backend owns sequencing" (HARNESS-01). **Recommend: explicitly DON'T add it** — it
   trades away the determinism that is the whole consistency story. Name it so it's a conscious
   choice, not an omission.
