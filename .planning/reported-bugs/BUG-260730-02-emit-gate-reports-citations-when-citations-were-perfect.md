---
id: BUG-260730-02
title: The emit step's failure is reported as a citation problem when citation coverage was 100% — the honest verdict is computed and then thrown away
reported: 2026-07-30
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/harness, emit/render_template, workflows/publish-gauntlet, observability]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 88fadd7b
  date: 2026-07-30
---

# BUG-260730-02: The emit step's failure is reported as a citation problem when citation coverage was 100%

## What we observed

Operator re-published `Compliance Gap Report` after BUG-260730-01 was fixed. Phase 0 (`retrieve`) now
**completes** — the 185-12 fix worked, and the phase output carries real `[1]` markers. Phase 1
(`emit`) then failed, and the gauntlet blocked publish with:

```
Blocked early — structural_gate
named_failures: Phase 2 (emit) gate failed after 3 attempt(s): citations_required: no field_map on output
```

Golden run `43b34171-35d9-4884-9f12-0d76f42b1352`, model `deepseek-v4-flash`, definition
`compliance-gap-report-cim40y`.

**That message is wrong on two counts.** From `harness_audit`, the 3 attempts contained TWO different
failures, and the surfaced message describes neither accurately:

`emit_rejected` — the attempts where the model DID emit a field map:

```json
{"covered_keys": ["report_date", "report_title", "scope"],
 "covers_template": false,
 "total_leaves": 39, "filled_value_count": 37, "null_leaf_count": 2,
 "cited_value_count": 37, "uncited_value_count": 0, "invented_citation_count": 0,
 "citation_coverage_pct": 100.0, "uncited_leaves": [], "invented_leaves": []}
```

Citation coverage was **100.0%** — zero uncited leaves, zero invented citations. The rejection was
`covers_template: false`
(`template_render_service.py:488` — `set(placeholder_keys) <= present_keys`): the model filled 37 of
39 leaves but under key names that do not match the template's parsed placeholders, so only
`report_date`, `report_title` and `scope` were recognised.

`emit_failed` — the other attempts: `recovered_from_narration: false`, `truncated: false`. Here the
model narrated instead of emitting, and `_exec_llm_emit` returned
`_emit_failure_output("model_failed_to_emit", msg)` (`phase_types.py:1327`) with **no** `field_map`
(`:1087` sets the key only when one exists).

The declared `citations_required` validator (`mode: deterministic`) then ran on that empty output and
emitted `"no field_map on output"` — which became the phase's `_failure_reason`, the run's
`run_failed.reason`, and the gauntlet's `named_failures` entry.

So the operator is told **"citations_required"** about a run whose citations were perfect, and
**"no field_map"** about a step that produced a field map on 2 of 3 attempts.

Meanwhile the honest, specific message was already computed and is discarded:

> "The model did not emit a structured field-map for the template (it narrated prose or was
> truncated) and the deliverable was NOT produced. This is an honest failure — no Markdown stand-in
> is delivered as the artifact."

## Why it matters

`major` — not a wrong result, but a wrong *explanation*, which is the expensive kind.

1. **It points the operator at the wrong subsystem.** The visible words are "citations_required", so
   the natural response is to go and fix citations. Citations were already perfect. The actual lever
   is template placeholder-key coverage, which the message never names.
2. **It hides a real, actionable verdict.** `gate_verdict` knows exactly which placeholder keys were
   missing. That is what the operator needs and it never reaches them.
3. **It masks two distinct failure modes as one.** "Failed 3 attempts, same reason" reads as a stable
   defect; in fact the model failed differently across attempts (incomplete key coverage vs
   narration), which is what you would want to know before choosing between a prompt fix, a template
   fix, and a model change.
4. **It blocks publish for a shipped starter workflow**, so it is on the first-run path for the
   feature, not an edge case.

This is NOT a Phase-185 defect and must not be folded into it — 185 is graded governance, and this is
the shipped Phase-101 emit/`render_template` path plus its reporting seam. It was previously MASKED:
before BUG-260730-01 was fixed, phase 0 always failed first and phase 1 never ran.

## Hypothesized cause

Two independent causes, one per symptom:

**(a) The reporting seam — high confidence.** A post-gate validator runs on the *output* of an
executor that has already diagnosed its own failure precisely. The validator sees only a shape (no
`field_map` key) and reports the shape. Nothing gives the executor's richer verdict precedence over
the gate's generic one when both describe the same attempt, so the least informative message wins by
being last.

**(b) The underlying emit miss — medium confidence, not yet isolated.** The model produced
well-cited content under key names the template's placeholder oracle does not recognise. Whether the
model is shown the exact placeholder key list (the "spotlight") strongly enough, and whether
`deepseek-v4-flash` is simply weak at large forced structured emission, are separable and untested.
The `emit_rejected` metadata records `forced: false` while `tier: "force"`, which is worth checking
on its own.

## Surface classification

`Agentic-RAG` — this app's harness emit path and its audit/reporting seam.

## Suggested routing

- **Fold into in-flight phase:** **no.** Phase 185 is graded governance; this is the emit/render path.
  Folding it would repeat the scope error the project's one-home rule exists to prevent.
- **Defer to future phase / milestone:** a dedicated emit-diagnostics phase, or the next phase that
  opens `phase_types.py`'s emit half. Cause (a) is small and self-contained; cause (b) needs its own
  investigation.
- **Plant as seed:** yes if not scheduled soon — "the least informative error wins by being last" is
  a general seam defect, not specific to citations.
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- **Fastest, and it doubles as UAT progress:** run with a different model. `deepseek-v4-flash` is
  doing forced structured emission over a 39-leaf template under strict citation coverage — the
  hardest thing in the pipeline. It is also not one of the four providers SC#10 requires
  (OpenAI / Anthropic / Google / OpenRouter), so switching both unblocks publish and scores a
  scoreboard row.
- **Diagnosis today, without any code change:** read `harness_audit` for the run —
  `event_type='emit_rejected'` carries the real `gate_verdict` with `covers_template` and
  `covered_keys`. That is the message that should have been surfaced.

## Reference / evidence links

- Blocked run: `workflow_runs.id = 43b34171-35d9-4884-9f12-0d76f42b1352`; definition
  `compliance-gap-report-cim40y`; `harness_audit` rows `publish_blocked`, `run_failed`, `gate_failed`,
  `emit_failed`, `emit_rejected`, `emit_forced` (attempts 1-3).
- `backend/app/services/template_render_service.py:488` — `covers_template` definition.
- `backend/app/services/harness/phase_types.py:1073-1090` — `_emit_failure_output`, which omits
  `field_map` when there is none; `:1316-1327` — the `model_failed_to_emit` branch and its discarded
  honest message.
- `backend/app/services/harness/validator_kinds.py` — the `deterministic` branch that reports
  `"no field_map on output"`.
- [[BUG-260730-01]] — the defect whose fix unmasked this one.
