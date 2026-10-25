---
phase: 293-start-from-outside-and-close-out
plan: 03
subsystem: run-origin read / workflow card / operator settings
tags: [run-origin, run-surface, evidence, chat-run-line, workflow-card, schedules, api-keys, settings]
base: 9f66e6717c651734c7f2cc41eff264362bff070a
requires: [293-01, 293-02, 293-04]
provides:
  - "run_read_wire: ORIGIN_KINDS, RunOriginWire, origin_for_wire(kind, label, actor_name)"
  - "origin on WorkflowRunRead, WorkflowRunListItem, RunEvidenceRun, ThreadWorkflowState; run_origin on MessageResponse"
  - "runOriginVocabulary.originSentence + RunOriginLine leaf"
  - "automationFacts.next (server instant, formatted only)"
  - "ApiKeyLimits card + ApiKeyLimitsHandle in Settings -> Integrations"
affects: [293-05]
tech-stack:
  added: []
  patterns:
    - "one pure wire helper per recorded fact, imported by every run read (the 295-05 end_reason precedent)"
    - "fail silent, never guess: a thread-level stamp only when every run agrees (A8)"
    - "leaf with own fetch + changes()/adopt() handle riding the section's one Save (292.1 AgentRoundLimits)"
key-files:
  created:
    - frontend/src/components/workflows/runOriginVocabulary.ts
    - frontend/src/components/workflows/RunOriginLine.tsx
    - frontend/src/components/settings/ApiKeyLimits.tsx
    - backend/tests/unit/test_293_origin_reads.py
    - frontend/src/components/workflows/__tests__/RunOriginLine.test.tsx
    - frontend/src/components/workflows/__tests__/runOriginVocabulary.test.ts
    - frontend/src/components/settings/__tests__/ApiKeyLimits.test.tsx
  modified:
    - backend/app/services/harness/run_read_wire.py
    - backend/app/api/workflow_runs.py
    - backend/app/api/workflow_run_evidence.py
    - backend/app/models/message.py
    - backend/app/models/thread.py
    - backend/app/api/threads.py
    - backend/tests/fixtures/phase289/run_evidence_contract.json
    - backend/tests/unit/test_289_evidence_contract.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/types/index.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/lib/api/runEvidence.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/api/skills.ts
    - frontend/src/components/workflows/history/runLogRow.ts
    - frontend/src/components/workflows/evidenceView.ts
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/chat/ThreadRunLine.tsx
    - frontend/src/components/workflows/library/automationFacts.ts
    - frontend/src/components/workflows/library/libraryVocabulary.ts
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/pages/SettingsPage.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
key-decisions:
  - "293-03: Step 0 chose branch B. The chat home of the origin line is ThreadRunLine (live + stopped), fed by ThreadWorkflowState.origin. RunCard is untouched. MessageResponse.run_origin ships but the UI does not read it"
  - "293-03: run_origin and ThreadWorkflowState.origin are typed `dict | None` in the Pydantic models. Importing the harness package from app.models is circular. The run-read models use RunOriginWire"
  - "293-03: the card's next-run fragment has no title attribute. The library F1 fence (D-14, touch has no hover) forbids it, so the year shows in the visible text when it differs"
  - "293-03: actor_name comes only from the starter's display name (never the email or fallback words), so all four surfaces agree; a missing name reads 'Started in the app'"
requirements-completed: [START-04, START-02]
duration: ~2 h
completed: 2026-10-25
---

# Phase 293 Plan 03: How a run started, everywhere, and the operator's limits Summary

**One pure helper (`origin_for_wire`) puts the recorded start on the run page read, the run log, the evidence report and the chat thread frame. `RunOriginLine` shows one of six sentences in four places, and an unrecorded run shows nothing. The workflow card shows the server's next run time. Operators set the two per-key limits from the Integrations tab's one Save.**

BASE: `9f66e6717c651734c7f2cc41eff264362bff070a`

## Task commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | `f44cb6c6e` | test(293-03): failing tests for the recorded origin on every run read and the chat message |
| 1 GREEN | `e84122d60` | feat(293-03): the recorded origin on every run read and on the chat message |
| 2 RED | `957f01024` | test(293-03): failing tests for the origin line in four places |
| 2 GREEN | `bb8ce1096` | feat(293-03): the origin line, one sentence in four places |
| 2 (OpenAPI) | `c0e6ef55d` | chore(293-03): regenerate the OpenAPI for ThreadWorkflowState.origin |
| 3 RED | `a3bf271cd` | test(293-03): failing tests for the card's next run time and the per-key limits card |
| 3 GREEN | `e49a08f11` | feat(293-03): the card's next run time and the operator's per-key limits |
| ledger | `2b98f5c68` | docs(293-03): hot-file ledger rows + section for the FIRING files 293-03 touched |

## Task 1: the origin on every run read

- `run_read_wire.py`: `ORIGIN_KINDS`, `RunOriginWire` (`kind: Literal["app","schedule","key"]`) and `origin_for_wire`. A NULL kind, or any kind outside the three, returns `None`. Labels and names go through `_nonblank`. `actor_name` is kept only for `app`. The module still has no `app` import.
- `GET /workflow-runs/{id}` and `GET /workflow-runs` select `origin_kind, origin_label` explicitly. The app actor comes from one helper, `_owner_display_name`, with one profiles read per request, and only when a row is an app start. Both reads are owner-scoped, so the actor is the caller.
- Evidence: the two columns are in `_ACCESS_SQL`. `origin` sits next to `end_reason` and uses the display name the started-by line already reads. The JSON export is the payload, so it carries `run.origin`. The shared contract fixture gained `run.origin`, and `test_289_evidence_contract.py`'s path set gained `"run.origin"`.
- Chat: `_enrich_messages_with_runs` does one batched two-column `workflow_runs` read per thread. It stamps `run_origin` only when every run of the thread has the same non-null `(kind, label)`; otherwise it stamps `None` (A8). The `runs` select and its `.is_("parent_run_id", "null")` comment are byte-unchanged (a source-text test pins this).
- OpenAPI snapshot + public spec regenerated twice (Task 1, then the Task 2 frame field). `--check` OK.

## Task 2: one sentence, four places

### Step 0: which chat home (read-only SELECT on the local DB)

The planned query (newest 20 workflow-run thread assistant messages) returned **20 rows. Every one had `tool_calls` NULL (`t = None, n = 0`)**, newest first:

```
1c2b2175… 2026-10-24 05:36  t=None n=0
15be04fd… 2026-10-23 21:46  t=None n=0
5a3e8294… 2026-10-23 21:42  t=None n=0
13832b69… 2026-10-23 21:38  t=None n=0
f853a7f9… 2026-10-23 21:34  t=None n=0
7c5156f5… 2026-10-23 21:31  t=None n=0
e3c0648a… 2026-10-23 21:28  t=None n=0
d3e53b09… 2026-10-23 21:25  t=None n=0
275a825d… 2026-10-23 21:05  t=None n=0
9c3af9ba… 2026-10-23 20:58  t=None n=0
e97ea5d1… 2026-10-23 20:52  t=None n=0
fbfb004f… 2026-10-21 13:52  t=None n=0
092c78aa… 2026-10-21 13:51  t=None n=0
e7cb0bd5… 2026-10-21 13:49  t=None n=0
9931b7c8… 2026-10-21 13:48  t=None n=0
efd103d3… 2026-10-21 05:15  t=None n=0
fc866f38… 2026-10-21 05:12  t=None n=0
d1ea3627… 2026-10-21 04:50  t=None n=0
f1436e36… 2026-10-21 04:41  t=None n=0   (twice: the thread has two workflow runs)
```

Totals across all workflow-run threads: 380 assistant rows, 13 with tool calls, 302 threads (337 threads have a workflow run). All 13 rows with tool calls date from June 2026. Each has its own chat `runs` row (`web_search`, `execute_code`, `search_documents`…), so they are ordinary chat turns in threads that also ran a workflow, not workflow-run turns. **Branch B selected.** The ThreadRunLine docblock says the same: since 194.1-03, a harness run has no assistant node.

### Placements

| Place | Mount | Hook counts (before → after) |
|---|---|---|
| `WorkflowRunPage.tsx` status row, after `WaitingOnLine` | `<RunOriginLine origin={run?.origin} />` | `useState(` 1 → 1, `useEffect(` 4 → 4 |
| `RunEvidenceReport.tsx` under `evidence-sub`, above `RunEndReasonLine` | `<RunOriginLine origin={view.origin} />` | `useState(` 2 → 2, `useEffect(` 2 → 2 |
| `runLogRow.ts` detail line | `originSentence(row.origin)` as the last atom (`RunLogPanel.tsx` untouched) | pure leaf |
| `ThreadRunLine.tsx` (branch B), one mount inside the shared `RunLine`, so live and stopped both carry it | `<RunOriginLine origin={origin} />`, fed `frame?.origin` | `useState(` 1 → 1, `useEffect(` 2 → 2 |

- `get_thread_workflow` adds `origin_kind, origin_label` to both arms (the anchor join and the latest-row read). It reads the caller's display name only for an app start (`_rls_fetchrow`, after every existing read, so the fetch order of shipped tests is unchanged). `ThreadWorkflowState` gains one field.
- `RunCard.tsx` is untouched (`git diff --name-only 9f66e6717 HEAD | grep -c chat/RunCard.tsx` = 0). `MessageResponse.run_origin` from Task 1 stays on the wire. It does no harm, the UI does not read it, and `_mapMessageResponse` passes it through `...rest`.
- `RunOriginLine`: `text-xs text-muted-foreground`, `data-testid="run-origin"`, `data-origin-kind`. The 14px icon (`KeyRound` / `CalendarClock` / `AppWindow`) is `aria-hidden`. The label renders as a text child.

## Task 3: the next run time and the limits card

- `automationFacts(row, now = Date.now())` gains `next`. It formats `row.nextScheduleAt` with `Intl.DateTimeFormat("en-GB", …, hourCycle: "h23")` parts in the viewer's zone, as `next Mon 26 Oct, 09:00`, adding the year when it differs from `now`'s. A past instant reads `next was due …`. An unreadable instant gives no fragment and keeps the cadence. All three silent arms are unchanged. The words live in `libraryVocabulary.ts` (`AUTOMATION_NEXT`, `AUTOMATION_NEXT_PAST`, `automationNextAt`). The file has no browser schedule maths: `new Date()` count 0, and its `cron|interval_seconds` count is 6 → 6.
- `WorkflowCard.tsx`: one `row-automation-next` span after the cadence and before `+N more`, holding the shipped `ANSWER_SEPARATOR` in `text-border`. The card's existing `now` is passed to the leaf. `useState(` 0 → 0.
- `ApiKeyLimits.tsx` copies `AgentRoundLimits.tsx`: handle type, clamp helper, loadState lock + Retry, `changes()` returns `{}` until loaded and then only changed fields, `useImperativeHandle` with no deps, and the ⛔ Invariants docblock. It uses 96px inputs (`w-24`) with bounds 1..60 and 10..600. Every string is in `apiKeysCopy.ts` under `limits` (UI-SPEC Surface 6, verbatim).
- `SettingsPage.tsx`: one `apiKeyLimitsRef`, one `<ApiKeyLimits ref={apiKeyLimitsRef} />` after `SourceFileCeilingCard` and before Save Integrations, `...apiKeyLimitsRef.current?.changes()` in the body and `adopt(updated)` on the response. `useState(` 49 → 49.

## Gates

- **Backend baseline** (`node scripts/check-backend-unit-baseline.cjs`, local DB lock held and released): **70 failed, 9843 passed**, 0 errors. Ceiling 71. Wave 2 measured 70 / 9805; the +38 passes are this plan's suite.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, run once at plan end): **count gate OK. 12102 total, 0 failing, 523/523 pinned files present**, no per-file decrease. Wave 2 was 12060 and 520/520. +42 = 27 cases in the three new suites + 15 raised.
- **tsc** (`tsconfig.app.json`): 63 errors before and after. The set is identical apart from line numbers and one shifted type-text count in the pre-existing `SettingsPage.tsx` / `SettingsPage.test.tsx` errors. No error is in a line this plan wrote.
- **Hot-file ledger**: `check-hot-file-ledger.cjs 293` OK. `check-claude-md-size.cjs` OK.
- OpenAPI `test_276_openapi_snapshot_fresh.py` passes; `build-public-openapi --check` OK.

### Vitest pins

| File | Pin |
|---|---|
| `RunOriginLine.test.tsx` | new, 6 (dir TARGET `src/components/workflows`) |
| `runOriginVocabulary.test.ts` | new, 11 (dir TARGET) |
| `ApiKeyLimits.test.tsx` | new, 10, FILE-LEVEL in TARGETS too |
| `runLogRow.test.ts` | 21 → 24 |
| `ThreadRunLineKickoff.test.tsx` | 10 → 13 |
| `evidenceView.test.ts` | 31 → 34 (it measured 33 at base; +1 here) |
| `automationFacts.test.ts` | 11 → 19 |
| `runEvidence.contract.test.ts` | 3 (unchanged; the SAMPLE gained `run.origin`) |

No pin was lowered. No snapshot was re-baselined. `WorkflowCard.seam286.pin.test.tsx.snap` and `WorkflowBuilderPage.seam286.pin.test.tsx.snap` were dirty from another session before this plan. They were neither staged nor touched, and no fixture sets `nextScheduleAt`, so the card snapshot cannot move. One suite run rewrote `WorkflowRunPage.seam286.pin.test.tsx.snap` with LF line endings only (`git diff` exit 0). The CRLF endings were put back in place without touching content, and that file is clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `run_origin` / `ThreadWorkflowState.origin` typed as `dict | None`, not `RunOriginWire`**
- **Found during:** Task 1 GREEN
- **Issue:** `app/models/message.py` importing `app.services.harness.run_read_wire` runs the harness package `__init__` (`register_all` → `harness_engine` → `app.models.thread` → `app.models.message`), which raised `ImportError: cannot import name 'MessageResponse' from partially initialized module`.
- **Fix:** both fields are `dict | None`, which the plan allows ("or `RunOriginWire | None`"). `origin_for_wire` still produces the value, so the shape is identical. The run-read models use `RunOriginWire`.
- **Commits:** `e84122d60`, `bb8ce1096`

**2. [Rule 3 - Blocking] `test_289_evidence_contract.py` path set extended**
- **Found during:** Task 1 GREEN
- **Issue:** that suite asserts the fixture's exact set of object paths. A declared `RunOriginWire` adds the path `run.origin`.
- **Fix:** added `"run.origin"` to the asserted set (and the TS twin's list). This is the plan's instruction to add `run.origin` to the fixture, carried into the test that enumerates it.
- **Commit:** `e84122d60`

**3. [Rule 1 - Project rule over plan] No `title` on the card's next-run fragment**
- **Found during:** Task 3 GREEN
- **Issue:** the plan and UI-SPEC Surface 5 ask for a hover `title` with the full date. `librarySubtree.fences.test.ts` F1 (D-14: "touch has no hover") forbids any `title` attribute in the library subtree, and went red.
- **Fix:** dropped the title, and with it the planned `nextTitle` field. The visible fragment already shows weekday, date, time, and the year when it differs. My own RED cases were adjusted to match.
- **Commit:** `e49a08f11`

**4. [Plan inconsistency] `grep -c "<ApiKeyLimits"` cannot be 1**
- The plan prescribes `useRef<ApiKeyLimitsHandle>(null)`, which also matches `<ApiKeyLimits`. The pin counts `<ApiKeyLimits ` (with the space): 1.

**5. Two existing `automationFacts` assertions gained `next: null`**
- The plan said the existing 11 cases stay unchanged. Their `toEqual({ phrase: null, more: null })` cannot pass once the shape has a required `next`. The case count and intent are unchanged; only the expected object grew. Documented in the RED commit.

### Out of scope (not fixed)

- `backend/tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` and ~21 cases in `tests/test_dual_mode_wiring.py` fail. Their errors are `KeyError: 'created_at'` from 194.1's `wf_row["created_at"]` against a mock row without that key, `threads` having no `insert_run`, and `get_service_role_supabase requires an explicit org_id`. None comes from a line this plan added. They live in `backend/tests/`, outside the baseline gate.

## Known Stubs

None. Every new field has a producer and a consumer. `MessageResponse.run_origin` is produced and passes through to `Message` but no UI reads it (branch B); this is recorded as a decision above.

## Threat Flags

None. The mitigations are in place:
- T-293-27: NULL or an unknown kind renders nothing anywhere, and the chat stamp stays silent when a thread's runs disagree.
- T-293-29: `actor_name` exists only for app origins and comes from the display name the started-by line already shows. The chat and thread frame use the caller's own name.
- T-293-30: the UI clamp is convenience only, the server bounds it, and only the operator tab renders the card.

No new endpoint and no new write.

## For 293-05 (G-4)

- The origin line in `ThreadRunLine` sits inline after the elapsed figure, with no `·` separator; the icon and the gap set it apart. Check it in the browser on a stopped key-started thread.
- A completed or failed workflow thread shows no chat origin, because `ThreadRunLine` is silent on both by D-16. The run page and the evidence report still show it.

## Self-Check: PASSED

- Files: `runOriginVocabulary.ts`, `RunOriginLine.tsx`, `ApiKeyLimits.tsx`, `test_293_origin_reads.py` and the three new frontend suites exist.
- Commits `f44cb6c6e`, `e84122d60`, `957f01024`, `bb8ce1096`, `c0e6ef55d`, `a3bf271cd`, `e49a08f11` and `2b98f5c68` are in `git log`.
