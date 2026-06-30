---
id: BUG-260701-02
title: Skill eval panel shows the previous skill's results under every skill (stale state)
reported: 2026-07-01
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend, skills, evals]
folded_into: "133"
verified_closed_by: null
related_seeds: [SEED-100]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 392b503b
  date: 2026-07-01
---

# BUG-260701-02: Skill eval panel shows the previous skill's results under every skill (stale state)

## What we observed

In the skill detail side panel ("Eval runner" section), the **same** eval result appeared under **every** skill — identical, e.g.:

```
Case 949ab98a
With skill · completed
I've created `mock_page.docx` — a one-page mock document with: …
Without skill · failed
BadRequestError: Error code: 400 - … This model does not support assistant message prefill …
```

Evidence (live local DB, psycopg2 :54322, 2026-07-01):
- 4 skills exist: `docx`, `risk-lens_099uat`, `weekly-report-writer`, `pptx`.
- **Only `docx` has a test case** (`949ab98a` = "generate one mock docx page").
- **Exactly ONE eval run exists in the whole system** — for `docx` (anthropic / `claude-sonnet-5`, completed, 1 case), with the two results above.
- The other 3 skills have **no test cases and no eval runs** — so the backend returns them nothing.

The backend is correctly scoped: `list_eval_runs` / `get_eval_run` both filter `.eq("skill_id").eq("user_id")` (`backend/app/api/evals.py:382-407, 332-378`). The data is clean. The bleed is purely client-side rendering.

## Why it matters

`major` — the panel shows **incorrect data** (one skill's results presented as if they belong to a different skill), which is worse than showing nothing: it makes evals look broken/meaningless and actively undermines trust in the feature the user is already unsure about. Anyone browsing skills sees a phantom identical eval everywhere.

## Hypothesized cause

**Confirmed (not just hypothesis).** `frontend/src/components/skills/SkillEvalSection.tsx` — the `useEffect(..., [skillId])` populates the durable readout (`results`/`evalRun`/`runId`) when a skill HAS a run, but never **resets** that state when `skillId` changes to a skill whose `listEvalRuns` returns `[]` (the `if (latest) { … }` block is simply skipped). The component instance persists across `skillId` prop changes (it's rendered at a stable position in `SkillDetailPanel`), so the previous skill's results stay rendered. `handleRun` is the only place state was cleared, and it only fires on an explicit "Run eval" click.

## Surface classification

`Agentic-RAG` — this app's frontend. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** 133 (the phase that shipped this surface). Fixed in the same phase's follow-up.
- **Defer to future phase / milestone:** the deeper clarity/placement redesign (opaque `Case <uuid8>` instead of the prompt text; no plain "did the skill help?" verdict) → **Phase 137** (designed Skill Evals panel, PANEL-01) + **SEED-100 / SEED-099**.
- **Plant as seed:** n/a (already covered by SEED-100).
- **External — note only:** no.

## Fix

`SkillEvalSection.tsx` — reset the readout/live state (`runId`, `running`, `live`, `evalRun`, `results`, `error`) at the top of the `[skillId]` effect, before fetching the new skill's runs. The provider/model picker selection is intentionally preserved across skills. (The existing effect cleanup already aborts the in-flight stream.) Each skill now shows ONLY its own evals, or an empty section.

## Related

- **BUG-260701-01** — the `Without skill · failed` 400 in the quoted output is the assistant-prefill incompatibility on `claude-sonnet-5` / 4.6+ family (separate bug, folded into SEED-100). It also muddies the eval signal: the baseline arm failed on a provider quirk, not purely on skill absence.

## Reference / evidence links

- DB probe 2026-07-01 (psycopg2 :54322): 4 skills, 1 test case (docx), 1 eval run (docx), 2 results.
- `backend/app/api/evals.py:332-407` (correctly skill+owner scoped).
- `frontend/src/components/skills/SkillEvalSection.tsx` (stale-state effect + fix).
- `frontend/src/components/skills/SkillFormDialog.tsx:548` (`<SkillEvalSection skillId={savedSkillId} />` mount site, `SkillDetailPanel`).
