# Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 091-harness-engine-5-phase-types-gates-whitelist
**Areas discussed:** Seed workflow templates, Whitelist-refusal feedback, Failure & timeout surfacing, Completion output

---

## Seed workflow templates

Which 2-3 (chosen: all 4) workflows ship as showcase + UAT fixtures; together must exercise all 5 phase types.

| Option | Description | Selected |
|--------|-------------|----------|
| Research → Summarize | llm_agent gather → llm_single cited summary | ✓ |
| Plan → Execute → Verify | llm_single plan → llm_agent execute → llm_single verify (gate) | ✓ |
| Literature review (batch) | programmatic split → llm_batch_agents parallel → llm_single merge | ✓ |
| Doc Q&A with human checkpoint | llm_agent draft → llm_human_input pause → llm_single finalize | ✓ |

**User's choice:** All 4.
**Notes:** +1 over the HARNESS-07 "2–3" guideline, accepted for complete 5-type coverage. First two
marked primary showcase; latter two are coverage fixtures (unique exercisers of llm_batch_agents +
llm_human_input). If scope tightens, the two showcase templates are must-ship.

---

## Whitelist-refusal feedback

What the tool_result tells the model when it calls a tool blocked in the current phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Guide + list allowed | "Tool X not available in this phase. Available: [a,b,c]." Model self-corrects. | ✓ |
| Guide, no list | "Tool X not available in current phase." No menu. | |
| Plain deny | Minimal "Tool not permitted." | |

**User's choice:** Guide + list allowed.
**Notes:** Paired with a derived decision (D-05) — whitelist filters get_tools() per phase (model sees
only allowed schemas, composes with TOOL-05 budget) AND dispatch_tool() is the hard backstop; refusals
thus rare, recovered by the guiding message. All refusals audited.

---

## Failure & timeout surfacing

What happens to the run + what the user sees when a gate exhausts retries or a phase times out.

| Option | Description | Selected |
|--------|-------------|----------|
| Stop + keep partial + reason | Fail, stop cleanly, keep completed outputs, plain reason to chat, detail in audit | ✓ |
| Stop + reason only | Fail + reason, partial outputs not surfaced | |
| Auto-fallback phase | Jump to on_failure recovery phase instead of stopping | |

**User's choice:** Stop + keep partial + reason.
**Notes:** Sets the baseline when on_failure = fail_run. Per-phase on_failure / skip_to_phase recovery
stays available (HARNESS-04, D-09). Also locked: retries are visible — each attempt emits SSE on
run:{run_id} + a harness_audit row (panel renders in 094).

---

## Completion output

What the final assistant chat message is when a multi-phase workflow completes successfully.

| Option | Description | Selected |
|--------|-------------|----------|
| Last phase output verbatim | Terminal phase IS the answer; no extra LLM call | ✓ |
| Always synthesize a wrap-up | Extra llm_single summary tail every run | |
| Per-template choice | Optional final_output flag per definition | |

**User's choice:** Last phase output verbatim.
**Notes:** All 4 seeds are terminal-by-design (Summarize/Verify/merge/finalize). Deterministic, zero
added cost, no drift. Avoids overlap with PARITY-01 Anthropic summary-tail (Phase 093). No final_output
config knob in v1.

## Claude's Discretion

- Per-phase step-cap / wall-clock-timeout default values (check existing config knobs first).
- Engine module layout + phase-executor dispatch shape + PROGRAMMATIC_PHASE_REGISTRY surface.
- Final harness.py Pydantic field shapes for the 5 phase-type configs.
- Reachability-lint algorithm + publish-time validation entry point.
- harness_audit event-type enum values.

## Deferred Ideas

- Always-on synthesized completion summary / per-template final_output flag (D-11).
- on_failure auto-fallback recovery phases in seed templates (mechanism ships, no v1 seed uses it).
- CONC-01 llm_batch_agents fair-share + AnyIO threadpool-budget sizing → Phase 096.
- Restart-mid-workflow independent verification (HARNESS-03 kill-and-resume) → Phase 096 (EVAL-02).
