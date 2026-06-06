---
spike: 007
name: execcode-label-fallback
validates: "Given execute_code calls with NO description, when a deterministic comment/keyword heuristic runs on the code body, then each call still gets a meaningful label (CSV/chart/docx/…) rather than a generic 'Run code'"
verdict: VALIDATED
related: [006]
tags: [cross-provider, workspace-panel, todos, deterministic, fallback, phase-095, pre-096]
---

# Spike 007: execute_code Label Fallback

## What This Validates
Spike 006 relies on `execute_code.description` for semantic labels. But some runs
(e.g. the OpenAI run) emit `execute_code` with `description: null`. This validates
the deterministic FALLBACK: infer a label from the code body itself, so the derive
path never collapses to a useless "Run code".

## How to Run
```
python .planning/spikes/007-execcode-label-fallback/spike.py
```

## What to Expect
6/6 label inferences correct on real OpenAI code shapes; only the genuinely
unrecognizable snippet falls back to "Run code".

## Results
**VERDICT: VALIDATED (6/6).**

Deterministic precedence proven end-to-end (006 + 007):
`write_todos` → `execute_code.description` → **code-inferred** → `"Run code"`.

- Leading `# comment` wins (most honest): `# Build the quarterly report` → that label.
- Keyword inference: `.to_csv`→"Create CSV file", `savefig/plt.`→"Create chart",
  `from docx`→"Create Word document", `from pptx`→"Create slides", `print(`→"Print output".
- Genuinely unrecognizable code → "Run code" (acceptable, rare).

**Signal for the build:** the derive path degrades gracefully; no provider/model
dependence. Combined with 006, approach (A) activity-derivation + smart gate is a
complete, deterministic, cross-provider mechanism. A dedicated planner sub-agent
(B) remains OPTIONAL (upfront-plan UX only), not required for correctness.
