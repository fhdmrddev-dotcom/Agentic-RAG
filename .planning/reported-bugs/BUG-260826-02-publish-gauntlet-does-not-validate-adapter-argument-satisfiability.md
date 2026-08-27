---
id: BUG-260826-02
title: The publish gauntlet does not check that an external_action's required adapter arguments are satisfiable
reported: 2026-08-26
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/harness, backend/connectors, publish-gauntlet]
folded_into: 214
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-02: Publish accepts a send step whose required arguments nothing can supply

## What we observed

A workflow ending in an `external_action` / `send_email` step passed the full 6-stage publish
gauntlet — lint, interactive-phase, grounding fidelity, golden run, judge — and was published.
Every subsequent real run then failed at that step with
`the 'to' recipient must be a string, got NoneType` (BUG-260826-01), after the two upstream LLM
phases had already run.

The gauntlet cannot see the problem, for a specific and reasonable-in-isolation reason: **the
golden run never attempts the send.** Gate 2 (D-16) short-circuits it so publishing cannot fire a
real email — the step records its intent and returns before any argument is validated
(`phase_types.py`, D-16 block). Argument validation lives inside the adapter, which is never
reached.

The nearest existing check does not cover it either. Stage 2's structural lint validates phase
`input_keys` against upstream outputs and a two-member allowlist:

```python
_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})   # reachability.py:67
```

An adapter's `INPUT_SCHEMA` requirements (`{to, subject, body}` for `send_email`) are **not**
`input_keys`, so nothing compares what the step needs against what any launcher can provide.

## Why it matters

Major. Publishing is this product's quality wall — an 8-stage gauntlet with a judge hard-wall,
whose whole promise is that a published workflow has been proven to work. Here it certified a
workflow that **cannot succeed on any input**, and the failure surfaced in production, at the last
step, after real spend.

It also compounds BUG-260826-01: a user who hits the runtime failure has no reason to suspect the
workflow was unsatisfiable by construction, because the gauntlet said it was fine.

## Hypothesized cause

**Hypothesis.** The check was never written because Phase 190's send path was designed after the
lint's input-contract model, and the two use different vocabularies for "what this step needs":
`input_keys` (phase-level, checked) versus `INPUT_SCHEMA` (adapter-level, unchecked). The golden
run's deliberate send-skip then removes the only other opportunity to notice.

## Surface classification

`Agentic-RAG` — this app's publish path.

## Suggested routing

- **Fold into in-flight phase:** n/a — pair with BUG-260826-01's fix in the same phase
- **Defer to future phase / milestone:** with the send-arguments fix
- **Plant as seed:** n/a
- **External — note only:** no

Suggested shape: a pre-run static check (stage 2 or 2.6 class — cheap, no provider call) that, for
every `external_action` phase, resolves the adapter's `INPUT_SCHEMA["required"]` and asserts each
name is satisfiable from a declared source — the step's own arguments once BUG-260826-01 lands,
the `_BODY_ARG_FOR_CAPABILITY` auto-fill, or a declared workflow input. Block with a named failure
naming the missing argument, in the style of the existing `named_failures` entries.

Note this check has to be written against whatever fix BUG-260826-01 takes, so sequence it second.

## Workarounds (prompt-side, code-side, or UI-side)

None at publish time. Operationally: after publishing any workflow containing a send step, run it
once through the schedule-with-inputs path (BUG-260826-01's workaround) before trusting it.

## Reference / evidence links

- `backend/app/services/harness/publish_service.py:88-400` — the 6-stage flow
- `backend/app/services/harness/reachability.py:65-80` — `_KNOWN_RUN_INPUT_KEYS` + `_check_input_contracts`
- `backend/app/services/connectors/smtp_adapter.py:293-310` — the adapter `INPUT_SCHEMA` nothing consults
- BUG-260826-01 — the runtime failure this gate would have caught
