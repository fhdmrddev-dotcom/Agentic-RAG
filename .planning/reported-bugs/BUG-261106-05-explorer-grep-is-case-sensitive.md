---
id: BUG-261106-05
title: Explorer grep is case-sensitive with no option, so it misses capitalised matches
reported: 2026-11-06
surface: Agentic-RAG
severity: medium
status: open
affected_areas: [backend/kb-explorer-tools]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 729733468
  date: 2026-11-06
---

# BUG-261106-05: Explorer grep is case-sensitive with no option

Found by the tester's chat answer key, HR-25 (Explorer mode, 2026-11-06, deepseek-v4-flash):
"Which documents mention probation?"

## What we observed

The agent called `grep {"path":"/Aldara-FM","pattern":"probation"}` and got 5 documents. The
answer key expects 7. All three role profiles were missing.

## Cause (verified in production data and code)

Each role profile has one chunk containing "Probation" and none containing "probation".
`grep_path` builds `... WHERE full_markdown ~ '<pattern>'` (`backend/app/api/kb.py:277`).
Postgres `~` is case-sensitive, and neither the tool nor the route exposes a case-insensitive
option, so a natural-language question ("mention probation") silently loses every capitalised
occurrence: headings, table labels, sentence starts.

## Fix (develop, not deployed)

- `grep_path` matches with `~*` by default; `case_sensitive=True` keeps `~`. The operator is
  one of two fixed literals. The result and `GrepResponse` report `case_sensitive`.
- `/kb/grep` takes `case_sensitive` (default false). The agent tool reaches the new default
  unchanged: its handler (`tools/documents._handle_grep`) and schema (`GREP_TOOL`) are pinned
  byte-identical by the phase-278 fences (`test_278_pure_move`, `test_278_registry_pin`), so the
  agent cannot yet ask for exact case, and `GREP_TOOL` still says "Postgres ~ operator". Offering
  the option to the agent means consciously retiring those fences (an operator decision).
- OpenAPI snapshot and public spec regenerated (17 lines each, only this change).
- Test: `backend/tests/unit/test_261106_grep_case.py`, including an HR-25 replay of the built
  SQL against a session TEMP table in real Postgres (default finds the capitalised profile).

## Fix direction (original note)

- Default to case-insensitive (`~*`) and add an optional `case_sensitive` argument, or expose
  `ignore_case` in the tool schema. Keep the result honest about which mode ran.
- While there: the pattern goes into a regex on `full_markdown` unbounded; consider a statement
  timeout for pathological patterns. `is_latest` is not filtered, so older versions can match.

## Surface classification

Agentic-RAG: the app's own Explorer tools.
