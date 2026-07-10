---
id: BUG-260626-04
title: Workspace "DERIVED FROM ACTIVITY" todos render each step twice in the live/just-completed window (temp+persisted twin)
reported: 2026-06-26
surface: Agentic-RAG
severity: minor
status: closed
affected_areas: [frontend/streaming, frontend/panel]
folded_into: null
verified_closed_by: 6ec8be77
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 2a48fea4
  date: 2026-06-26
---

# BUG-260626-04: Workspace todos doubled during the temp+persisted window

## What we observed

During the Phase 123 SC#10 Axis-2 render re-test (the BUG-260626-01 verification),
watching the workspace panel surfaced a sibling defect: on a single multi-tool run,
the Workspace TODOS panel ("DERIVED FROM ACTIVITY") rendered **each step twice** in
the live / just-completed window.

Concrete, live-captured (OpenAI `gpt-5.4-mini`, thread `ef221f76`, one run with
`search_documents` + `execute_code`):
- Workspace TODOS showed **4 rows**: `Search documents · COMPLETED`, `Creating risk
  search results bar chart · COMPLETED`, then the SAME two again.
- DB ground truth: **1 assistant message, 2 tool_calls, 0 rows in `todos`** → the
  panel is purely activity-derived and should show exactly **2** items.
- **Self-heals on reload** (reopening the thread from the DB → exactly 2 items).

## Why it matters

The workspace surface visibly duplicates the agent's task list during normal use —
the same "reads as broken even though the data is correct" lived-experience defect as
BUG-260626-01, in a different consumer. Minor (cosmetic, self-heals) but immediately
noticeable. It is the SAME temp+persisted root cause, so it travels with BUG-01.

## Root cause (adversarially confirmed)

The in-memory chat bucket transiently holds TWO assistant messages for the same
`runId` in the live/just-completed window: the `temp-…` placeholder AND the
persisted/reconciled row. `useDerivedPanel` (`StreamsProvider.tsx:2646`) flat-maps
`tool_calls` across **all** bucket messages, then dedups with `dedupToolCalls`
(`stepCount.ts`). But that dedup keys each call `clientKey ?? id ?? composite`: the
**temp copy carries `clientKey`** (live-SSE always stamps it), while the
**persisted copy is DB-reconstructed and has no `clientKey`** (falls back to
`id`/composite). The two copies of the same logical call get DIFFERENT keys → both
survive → every derived step doubles. The original BUG-260626-01 fix deduped
MessageList's *render* only, so this second consumer was uncovered.

## Surface classification

`Agentic-RAG` — this app's frontend workspace panel. Routing candidate.

## Resolution (fixed + verified live)

Fixed in commit **`6ec8be77`** on `develop` (2026-06-26): extracted the MessageList
inline runId-dedup into a shared pure `dedupMessagesByRunId` helper
(`frontend/src/lib/dedupMessages.ts`) and applied it at BOTH consumers —
MessageList's render AND `useDerivedPanel`'s flat-map — so the temp twin collapses
once, from one seam, for any future consumer. Keeps the persisted (non-temp) row.

- Tests: `dedupMessages.test.ts` (6 cases) + a `panelHooks.test.tsx` case that
  reproduces the exact temp(`clientKey`)+persisted(no `clientKey`) twin and asserts
  the derived todos are 2, not 4. 40 tests green; `tsc --noEmit` clean.
- **Live verification** (OpenAI `gpt-5.4-mini`, fresh single-run thread): workspace
  TODOS shows exactly **2** items in the just-completed window (was 4); 1 run card /
  1 GENERATED FILES header / 1 file card; console clean.

## Reference / evidence links

- Found during the BUG-260626-01 Axis-2 render re-test (see [[project_123_uat_render_bugs]]).
- DB: thread `ef221f76` = 1 assistant message / 2 tool_calls / 0 todos rows; live render showed 4 derived rows, reload showed 2.
- Same root-cause family as BUG-260626-01 (temp+persisted in-memory twin).
