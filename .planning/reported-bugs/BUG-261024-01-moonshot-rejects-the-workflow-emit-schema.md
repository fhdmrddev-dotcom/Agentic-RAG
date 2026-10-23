---
id: BUG-261024-01
title: Moonshot (kimi-k2.6) rejects the workflow-drafting tool schema, so no workflow can be drafted on Kimi
reported: 2026-10-24
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/workflow-authoring, provider/moonshot]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-327]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: e03c3c88e
  date: 2026-10-24
---

# BUG-261024-01: Moonshot rejects the workflow-drafting tool schema

## What we observed

Phase 291's S5 roster (`RUN_291_AUTHORING_ROSTER=1 backend/tests/integration/test_291_authoring_roster.py`)
failed both Moonshot rows with `could_not_generate / provider_error`. Wrapping the provider call
showed the real error:

> 400 — "tools.function.parameters is not a valid moonshot flavored json schema … At path
> 'properties.phases.items': detected infinite recursion without termination condition"

It reproduces with NO files attached and with Phase 291's `InputFieldSpec` fields (`fills`,
`origin`, `note`) removed from the schema, so it is not caused by 291. A local scan of
`WF_SCHEMA["$defs"]` finds no `$ref` cycle, so Moonshot's validator objects to something it reads
as recursive under `phases.items` (likely the `$ref`/`anyOf` shape of the phase config union).

## Why it matters

Every "Draft it for me" / builder describe call on a Kimi drafting model fails, and the author is
told "describe the work in more detail", which cannot help. Kimi is one of the seven native
providers, so the roster rule requires it.

## Hypothesized cause

Hypothesis: Moonshot's "flavored" JSON-schema validator does not accept the `$defs` references used
inside `PhaseSpec.config` (the discriminated union) and reports them as unterminated recursion.
Provider-docs-first: check Moonshot's tool-schema rules before changing anything; a provider-
specific schema flattening at the service boundary is the likely fix, never a change to the shared
schema.

## Surface classification

`Agentic-RAG`: our request is refused by the provider because of the schema we send.
