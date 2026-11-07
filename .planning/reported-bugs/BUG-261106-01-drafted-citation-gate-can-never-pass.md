---
id: BUG-261106-01
title: AI-drafted agent steps carry a citation check they can never pass
reported: 2026-11-06
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [backend/workflow-authoring, backend/harness-gates]
folded_into: null
verified_closed_by: "hotfix bcebbd6cc on production; live runs dc6e4c56 (step 1 passed) and cff40665 (completed) 2026-11-06"
related_seeds: [SEED-156]
re_open_trigger: null
reproduces_on:
  branch: production
  commit: f6a45c22070244e7b74f3d14d2a79b2d9c768b7d
  date: 2026-11-06
---

# BUG-261106-01: AI-drafted agent steps carry a citation check they can never pass

Tester report: `Syrel-Testing-and-Bug-Report.md` revision 2, finding BUG-19 (also covers the
symptom BUG-20). Related findings there: BUG-25 (the editor hides the check) and BUG-27 (no
route to build a workflow without the drafter).

## What we observed

Production test org, run RUN-007 (2026-11-06 09:06, deepseek-v4-flash). The drafted
definition gave both agent steps:

```json
{"kind": "citations_required", "config": {"require_citations": true}, "on_failure": "fail_run", "max_retries": 2}
```

Phase 1 failed after 3 attempts: `citations_required: no field_map on output`. No sources
were cited. Chat on the same corpus cited 6 sources (RUN-008), so retrieval works.

## Why it matters

Every AI-drafted workflow with a document-reading agent step fails its first run and can
never pass the publish golden run. The editor does not show the check, so the author cannot
remove it.

## Cause (verified in code and by a RED test)

`citations_required` reads `config.mode`. `require_citations` is a key the model invented,
so `mode` falls back to `deterministic`, which checks `output["field_map"]`. Only `llm_emit`
steps return a `field_map`; agent steps return `{text, citations, ...}`. The gate ran before
the engine's own `retrieved_and_cited` gate and failed every attempt.

## Fix (develop, not deployed)

- `harness/grounding.py`: new pure predicate `citation_gate_can_never_pass`. `effective_phase`
  drops such an author gate when it adds the engine's own gate. Parse-time only, so drafts
  already saved with the gate run correctly without an edit.
- `workflow_authoring.py`: the drafter drops such gates from every step it returns.
- Test: `backend/tests/unit/test_261106_dead_citation_gate.py` (RED reproduced the live error).

Not fixed here: config keys are still not validated against each validator kind at save or
publish (tester fix direction b), and the editor still hides author validators (BUG-25).

## Surface classification

Agentic-RAG: the app's own drafter and workflow engine.
