---
id: BUG-261022-01
title: A Word template with bare {{ name }} may render a dict repr and still pass the residual-tag check
reported: 2026-10-22
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/template-render, sandbox, workflows/render_template]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-368]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 53ce99de7
  date: 2026-10-22
---

# BUG-261022-01: A Word template with bare {{ name }} may render a dict repr and still pass the residual-tag check

## What we observed

Found by the Phase 291 researcher in a scratch probe (`291-RESEARCH.md` §Summary item 5, Pitfall list, Open Question 5), not through the app:

- On the trusted fill path each value reaches docxtpl as a small cited record (`{'value': ..., 'source_chunk_id': ...}`).
- A template token written as bare `{{ name }}` then renders as `{'value': 'Ann', 'source_chunk_id': ...}` in the output document.
- `residual_tags_in` / `assert_integrity` see no leftover `{{…}}`, so the run reports success.
- A token written as `{{ name.value }}` renders `Ann` correctly.

⚠ **Unverified on the real run path.** The probe called docxtpl directly with that context shape. It has not been driven through `_RENDER_DRIVER_SRC` in the sandbox with a real library template, so a coercion step this probe skipped may exist.

## Why it matters

If it reproduces, any shipped library template authored with bare tokens hands back a document full of Python dict text while the run reads as succeeded. The integrity check that exists to stop a half-filled document would not catch it.

## Hypothesized cause

Hypothesis: the Cited-record context shape was introduced without a matching change to how templates are authored or checked, and `residual_tags_in` checks only for unrendered tokens, not for rendered records.

## Surface classification

`Agentic-RAG` — the app's own template fill.

## Suggested routing

- **Fold into in-flight phase:** n/a. Phase 291 avoids it for its own copies by inserting `{{ key.value }}` (291-RESEARCH Pattern 5), but fixing existing templates is outside 291's scope.
- **Defer to future phase / milestone:** first step is a 10-minute repro through the real sandbox driver with a bare-token template.
- **Plant as seed:** n/a until reproduced.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Author tokens as `{{ name.value }}`.

## Reference / evidence links

- `.planning/phases/291-describe-it-from-your-own-files/291-RESEARCH.md` (lines ~134, ~300, ~460)
- `backend/app/services/tools/render_template.py` (`residual_tags_in`, `assert_integrity`)
