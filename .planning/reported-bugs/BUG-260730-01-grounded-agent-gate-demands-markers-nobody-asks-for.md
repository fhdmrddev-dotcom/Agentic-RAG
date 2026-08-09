---
id: BUG-260730-01
title: The auto-attached grounded-agent citation gate demands inline markers nothing ever asks the model to write
reported: 2026-07-30
surface: Agentic-RAG
severity: blocking
status: folded
affected_areas: [backend/harness, governance/GOVERN-01, workflows/publish-gauntlet]
folded_into: "185"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 84345ed8
  date: 2026-07-30
---

# BUG-260730-01: The auto-attached grounded-agent citation gate demands inline markers nothing ever asks the model to write

## What we observed

Operator published the `Compliance Gap Report` starter workflow and its publish golden run failed.

`workflow_runs` row `ded89703-44c4-4e40-b5fe-9af35a44a54d` — `status: failed`,
`is_golden_run: true`, `model: deepseek-v4-flash`, definition `compliance-gap-report-03ua7t`.

`workflow_phases` phase 0 (`retrieve`, `llm_agent`) output:

```json
{"_failure_reason": "Phase 1 (retrieve) gate failed after 3 attempt(s): citations_required: 0/1 citation markers in the answer"}
```

Phase 1 (`emit`) never ran (`status: pending`).

**The step DID retrieve.** `_validate_citations_required` checks the two halves of
`mode: retrieved_and_cited` in order, and half (a) — the empty-`citations` check, whose message is
`"nothing was retrieved (0 sources)"` — did not fire. The emitted message is half (b), the marker
count. So retrieval succeeded and `output["citations"]` was non-empty; the model simply did not write
`[1]` / `(doc…)` markers into its prose.

Probe against the shipped validator (`_validate_citations_required`, `mode: retrieved_and_cited`),
using the documented `llm_agent` output shape:

| agent output | verdict |
|---|---|
| retrieved, prose without markers | **FAIL** — `citations_required: 0/1 citation markers in the answer` (byte-identical to production) |
| retrieved, prose containing `[1]` | PASS |
| retrieved, prose containing `(doc-1#3)` | PASS |
| nothing retrieved | FAIL — `nothing was retrieved (0 sources)` |

The gate is therefore satisfiable **only** when the answer carries a marker matching
`\[\d+\]|\(doc[^)]*\)` (`validator_kinds.py:258`).

**Nothing instructs the model to produce one.**

- The auto-attachment (`grounding.py:935-947`) appends the validator and no prompt text. A grep for
  marker guidance across `backend/app/services/harness/` and `backend/app/prompts/` returns the
  pattern literal in `validator_kinds.py` and nowhere else — it exists only as the thing being
  checked, never as an instruction.
- The starter's own `retrieve` prompt asks for "the source passages supporting each" — it never names
  a marker format.
- The retry feedback (`harness_engine.py:804`) is
  `"Previous output failed validation: {gate.error_message}. Fix it."` — it repeats the deficit
  (`0/1 citation markers`) without ever stating what a marker looks like. All 3 attempts failed.

## Why it matters

`blocking` for GOVERN-01.

GOVERN-01's promise is that a grounded step's citation gate is attached **automatically** and is not
author-loosenable-away. As shipped, that gate is attached automatically and then usually **fails**,
because satisfying it depends on marker-format instructions the author would have to have hand-written
into the step prompt themselves — which is precisely the author-side burden the auto-attachment exists
to remove.

Downstream effects:

1. **Any** detected grounded agent step fails after 3 attempts unless its prompt happens to request
   `[n]` markers. This is not provider-specific — no model is told the format; a stronger model may
   guess `[1]` from context, which makes the failure look like provider flakiness rather than a
   structural gap.
2. Publish is blocked for grounded workflows, because the gauntlet's golden run hits the same gate.
   The `Compliance Gap Report` starter — shipped seed content — cannot be published.
3. Three full agent attempts are burned per run before failing, so the defect also costs tokens.

Note this is a **different** failure from the one 185-11's checkpoint predicted as an expected
non-bug ("a detected step whose golden run retrieves nothing now blocks publish"). Here retrieval
succeeded. It is the same *class* as the landmine recorded in 185-CONTEXT (the shipped
`deterministic` mode reads `field_map`, which no agent step produces, and so would fail 100% of
detected agent steps). The new `retrieved_and_cited` mode fixed half (a) and left half (b)
unsatisfiable by omission.

## Hypothesized cause

**Hypothesis, verified for the mechanism and unverified only for intent:** the phase treated the
marker requirement as an existing capability of the answer rather than as a new obligation on the
producer. Half (b) deliberately reuses the `presence` branch, and `presence` was only ever applied to
steps whose authors opted in and wrote their own marker instructions. Auto-attaching that same check
to steps whose authors never opted in transfers the obligation to the model without ever telling it.

Root cause sits at the attachment seam, not in the validator: the one place that decides a step has
earned the gate (`grounding.py`) is also the only place that knows the step now owes markers, and it
currently communicates that to the checker but not to the producer.

## Surface classification

`Agentic-RAG` — this app's own harness engine. Cross-checked at the GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** **185** — this is GOVERN-01's headline behaviour and Phase 185 is
  still open at its final operator gate (`185-11` Task 3). Closing 185 with this open would mark
  GOVERN-01 complete against a gate that fails in normal use.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

Suggested fix, at the attachment seam so there is one home for the concern: when the engine
synthesizes the `retrieved_and_cited` gate for a detected step, it must also make the requirement
legible to the producer — inject the marker instruction into that step's prompt at the same seam that
attaches the validator, and state the required format in the retry feedback so attempt 2 is better
informed than attempt 1. Both halves of the gate would then be satisfiable by a model that did the
right thing.

## Workarounds (prompt-side, code-side, or UI-side)

- **Prompt-side, today:** add an explicit instruction to the grounded step's prompt, e.g. *"After each
  claim, cite the source inline as a bracketed number — `[1]`, `[2]` — matching the passages you
  retrieved."* This satisfies half (b) without any code change, and is the fastest way to unblock a
  publish.
- **Author-side:** declaring your own `citations_required` validator does not help — D-185-05 makes
  the engine's gate win over a weaker declared one, by design.
- **Not a workaround:** switching providers. Nothing tells any model the format.

## Reference / evidence links

- Failed run: `workflow_runs.id = ded89703-44c4-4e40-b5fe-9af35a44a54d` (thread
  `7ddc0ef6-36cc-4fa7-8e37-52704c068b5c`), local Supabase.
- `backend/app/services/harness/validator_kinds.py:244-271` — the two halves and both messages;
  `:258` the marker pattern.
- `backend/app/services/harness/grounding.py:935-947` — the auto-attachment, which adds no prompt text.
- `backend/app/services/harness_engine.py:804` — the retry-feedback string.
- 185-CONTEXT.md — the recorded `field_map` landmine this shares a class with.
