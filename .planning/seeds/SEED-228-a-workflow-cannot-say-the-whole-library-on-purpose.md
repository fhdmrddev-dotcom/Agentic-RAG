---
id: SEED-228
title: A workflow cannot say "the whole library, on purpose" — unbound retrieval is treated as unfinished, never as an intent
status: planted
planted: 2026-08-28
planted_by: operator, challenging the 2026-08-04 decision while driving Phase 214.1
surface: Agentic-RAG
severity: major
category: design gap / governance
priority: high
scope: >
  `unbound_retrieval` disables Publish for any workflow whose retrieval step is not bound to a
  folder. There is no way to express deliberate whole-library scope, so a workflow whose PURPOSE
  is the whole library cannot be published without falsifying its own intent.
affected_areas: [backend/app/api/workflows.py, backend/app/services/harness/grounding.py, frontend/src/components/workflows/DescribeKbPicker.tsx, frontend/src/pages/WorkflowBuilderPage.tsx]
relates_to:
  - BUG-260731-03 (the report the 2026-08-04 decision answered)
  - D-187-11 (the decision this seed asks to revisit)
re_open_trigger: >
  Immediately — the operator raised it against a live workflow they cannot publish. Otherwise the
  next phase touching grounding, the KB picker, or the publish gate.
---

# SEED-228 — the gate has no word for "everything, deliberately"

## The workflow that breaks the premise

The operator built *Knowledge Base Library Structure Summary*: survey the folders and document
types **across the whole library**, write a summary, email it. Its `survey-library` step reads
documents, `project_folder_id` is `null`, so `unbound_retrieval` fires and **Publish is disabled**.

⚠ **Scoping it to a folder would not make it more correct — it would make it WRONG.** Bound to
`DBA` or `Weekly reports`, it would survey one folder and report that as the library. The defect
the gate is trying to prevent and the workflow's actual purpose are the same behaviour.

## What the code says, and why the premise fails

`unbound_retrieval` is classified `incomplete`, not `error` — `_INCOMPLETE_CODES` in
`backend/app/api/workflows.py`, whose own comment reads *"the author is still building, not
broken"* and *"a FACT plus a CONSEQUENCE — never 'unsafe' and never 'blocked'"*.

**It disables the Publish button anyway.** `WorkflowBuilderPage`'s `blockedReason` memo returns the
first verdict's message for ANY not-ok envelope, so an `incomplete`-only response still greys the
control. That was measured and accepted on 2026-08-04 (D-187-11, answering `BUG-260731-03`), on the
stated grounds that blocking is right *before a golden run is spent*.

**The premise is that unbound means UNFINISHED** — the author has not yet said what the workflow is
about. That is true of most drafts and false of this one. `project_folder_id is None` is the only
unbound state and it always fires, so there is no way to say *"I mean everything."*

## The asymmetry that makes it look like an oversight rather than a policy

**Chat already has this control and the builder does not.** The chat composer offers
**"All documents"** beside the folder list — an explicit, selectable whole-library scope. The
workflow builder offers only folders and an implicit `null`. The same intent is expressible in one
surface and inexpressible in the other.

## What closing it would need

1. A third state distinguishable from `null` — an explicit *all documents / whole library* binding,
   so "not yet decided" and "decided: everything" stop being the same value. `null` must keep firing.
2. The gate satisfied by that state, with the consequence still stated (it is a real fact that the
   run searches everything) — informational, not blocking.
3. ⚠ **The receipt must carry it.** A run that searched the whole library on purpose should say so,
   or the honesty this gate exists to protect is lost in the other direction.

## What it must NOT become

A blanket waiver or a "publish anyway" escape. The gate is right for the case it was built for —
an author who simply has not chosen. This seed asks for a way to CHOOSE everything, not a way to
skip choosing.
