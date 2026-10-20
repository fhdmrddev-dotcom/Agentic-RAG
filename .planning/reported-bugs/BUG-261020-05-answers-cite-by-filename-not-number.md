---
id: BUG-261020-05
title: Some answers cite sources by filename in brackets instead of [n], so no citation markers render and Check citations has nothing to check
reported: 2026-10-20
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/agent-loop, citations, cross-provider]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5b7951ed6
  date: 2026-10-20
---

# BUG-261020-05: Some answers cite sources by filename in brackets instead of [n]

## What we observed

Operator report during the Phase 294 follow-up: "I do not see the ref pills in the chat … there is no numbers". Driven in the local app on 2026-10-20, DeepSeek `deepseek-v4-flash`, reranking ON:

1. "Which statistical tests does the thesis use to analyse the survey data, and why?" → References · 13 sources, **0** `[n]` markers; sources named in prose ("FMrad_FT_Approved_06062026.docx — Section 3.4").
2. "According to the thesis, what sample size was used for the survey and how were respondents selected? Cite the passages." (OpenAI Decisions reranking) → References · 30 sources, **0** `[n]` markers; six bracketed filenames such as `[FMrad_FT_Approved_06062026.docx]`.
3. Earlier the same day, "What research methodology and sampling approach does Chapter 3 of the thesis describe?" → 13 markers, rendered correctly.

Measured over the operator's 60 most recently updated threads (assistant answers that carry sources): DeepSeek v4 flash on 2026-10-20 put `[n]` in 3 of 5 answers; 1 of the 5 used bracketed filenames. The older sample is too small to call a trend (1 DeepSeek answer on 2026-10-12, also without markers).

"Check citations" on such an answer correctly returns "This answer has no cited passages to check."

## Why it matters

The References footer shows the sources, but the reader cannot tell which sentence came from which source, and the Phase 294 citation check has nothing to check. A bracketed filename looks like a citation but is not one the app recognises.

## Hypothesized cause

Model adherence, not rendering. `CITATION_INSTRUCTION` (`backend/app/services/citation_markers.py:26`) asks for `[n]` and appends a manifest whose lines read `[n] {filename} · chunk k`. A model can copy the filename half of a manifest line rather than the number. The instruction is appended only on retrieval turns (`agent_loop.py:2350`); long multi-tool runs (9 steps here) put many tool results between the instruction and the final answer. Not caused by Phase 294: `citation_markers.py` and the marker path are unchanged since before 294.

## Fix direction

Measure first, across the full native roster (CLAUDE.md UAT recipe): marker rate per provider on a fixed question set. Then options, cheapest first: tighten the instruction with a one-line wrong/right example (`[FMrad.docx]` ✗ → `[3]` ✓); or map a bracketed filename that exactly matches one manifest row to that row's number at the settle point, next to `normalize_citation_markers` (only when exactly one row carries that filename, otherwise leave it).
