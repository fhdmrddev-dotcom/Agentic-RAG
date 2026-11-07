---
id: BUG-261106-02
title: AI-drafted agent steps carry a file check they can never pass
reported: 2026-11-06
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [backend/workflow-authoring, backend/harness-gates]
folded_into: null
verified_closed_by: "hotfix 2cc9b4845 on production; live run cff40665 completed 2026-11-06 13:36 UTC"
related_seeds: [SEED-156]
re_open_trigger: null
reproduces_on:
  branch: production
  commit: bcebbd6cc
  date: 2026-11-06
---

# BUG-261106-02: AI-drafted agent steps carry a file check they can never pass

Tester report: `Syrel-Testing-and-Bug-Report.md`, finding BUG-19b. Found by the live
re-run that verified BUG-261106-01 (the sibling bug, same cause class).

## What we observed

Production test org ("My organization"), run `dc6e4c56-9a12-4632-8349-2b5ad47ef1c4`
(2026-11-06 12:20 UTC, deepseek-v4-flash, input AFM-0431). Step 1 passed with the
BUG-261106-01 fix. Step 2 ("Write cited welcome pack", `llm_agent`) carried:

```json
{"kind": "output_file_valid",
 "config": {"extensions": [".md"], "must_contain": ["Still to confirm"],
            "required_filename_pattern": "^welcome_pack_.*\\.md$"},
 "on_failure": "fail_run", "max_retries": 2}
```

It failed 3 attempts with `output_file_valid: unsupported format '' ('')` and failed the run.

## Cause (verified in code and by a RED replay of the live error)

`output_file_valid` reads `output["output_file"]` (only `llm_emit` returns one) or
`config["path"]`, and opens docx/pptx/xlsx (pdf is a pass stub). The three config keys
are invented; none is read. On an agent step the filename is `''`, so every attempt fails.

## Verified live (2026-11-06)

Production `2cc9b4845`, run `cff40665-080e-477e-b589-984692ccaa0c`, same draft and input,
model `custom` / `unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_XL` (operator's local GPU via a
Cloudflare quick tunnel). Step 1 passed (27 citations, 7m19s). Step 2 try 1 failed on a
model-call outage (not a gate); try 2 wrote `/welcome_pack_AFM-0431.md` and passed with 25
citations. Run `completed` 13:36:40 UTC. The dead file gate never ran: the first failure on
step 2 came from `citations_required`, which would have been preceded by it.

## Fix (develop b40748a93; production 2cc9b4845)

- `harness/grounding.py`: new pure predicate `file_gate_can_never_pass` (not `llm_emit`
  and no openable `config.path`), and `gate_can_never_pass` (either dead arm).
  `effective_phase` drops a dead file gate on every step (parse-time only, so saved drafts
  heal). The citation arm keeps its BUG-261106-01 scope.
- `workflow_authoring.py`: the drafter drops every gate `gate_can_never_pass` names.
- Test: `backend/tests/unit/test_261106_dead_file_gate.py`.

Not fixed here: the author's intent (a markdown file containing "Still to confirm") has no
validator that can express it; validator config keys are still not validated at save or
publish; the editor still hides author validators (BUG-25).

## Also seen on the same run (separate, not fixed)

- The run executed twice in parallel: `phase_started` for step 1 at 12:19:55 and 12:20:18,
  each copy overwrote the other's phase output, and the second copy logged a `gate_failed`
  at 12:25:37, after `run_failed` at 12:25:36.
- A stale `active-org-id` (an org the signed-in user is not a member of) made the draft
  save return 403 `You are not a member of this organization.`, which the builder showed as
  "Upgrade to Enterprise to use workflows."

## Surface classification

Agentic-RAG: the app's own drafter and workflow engine.
