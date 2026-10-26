---
phase: 296-close-v4-7-debt
plan: 04
subsystem: frontend (run surfaces, chat, settings)
tags: [debt, streams, panel, evidence-report, schedules, launch-forms, chat-artifacts, rerank, citation-check]
requires:
  - "296-02 trigger contract: ScheduleTriggerResult.outcome + worded detail (mocked here)"
  - "296-01 citation 429 { reason: rate_limited } (mocked here)"
  - "296-03 LOCAL_INFERENCE_TIMEOUT_S = 30.0 parity test against rerankEngines latencyNote"
provides:
  - "One guarded end-of-follow reconcile (BUG-261021-04/-03)"
  - "Derived ! Waiting reading for a running step on a paused run (295-D-uat-02)"
  - "One ask card per live workflow run; passed clock waits (BUG-261025-03 UI half)"
  - "Evidence report: markdown output, watched-failure alert, unlinked-file sentence, wrapping header"
  - "Row-local schedule Run now feedback + required-input refusal"
  - "Worded in-thread start failures with Retry start / Dismiss message"
affects: [296-05 G-4 scenarios 3, 4, 5, 7, 8]
tech-stack:
  added: []
  patterns: ["presentation override row (WAITING_META) beside INTERRUPTED_META", "hook owns a refused send (reads the provider's per-thread refusal, clears the kickoff draft)"]
key-files:
  created:
    - frontend/src/__tests__/providers/streamsProvider_296_followup_files.test.tsx
    - frontend/src/components/panel/__tests__/PhaseCard.waiting296.test.tsx
    - frontend/src/components/panel/__tests__/WorkspacePanel.askStack296.test.tsx
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/stores/streamsStore.ts
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/phaseStatusMeta.ts
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/workflows/evidenceVocabulary.ts
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
    - frontend/src/types/schedule.ts
    - frontend/src/components/layout/ChatLaunchForm.tsx
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/chat/useStartWorkflowInThread.ts
    - frontend/src/components/chat/composerCopy.ts
    - frontend/src/components/chat/ThreadWorkflowPicker.tsx
    - frontend/src/components/chat/artifacts/ArtifactTooltip.tsx
    - frontend/src/components/chat/artifacts/DiagramArtifact.tsx
    - frontend/src/components/chat/artifacts/diagramLayout.ts
    - frontend/src/components/settings/apiKeys/curlExamples.ts
    - frontend/src/components/settings/rerankEngines.ts
    - frontend/src/components/settings/RerankEngineBlock.tsx
    - frontend/src/stores/citationCheckStore.ts
    - frontend/src/components/chat/CitationCheckAction.tsx
    - frontend/src/components/chat/citationVerdicts.ts
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "BUG-261021-03: cause (i) is refuted (subscribeToRun calls onTerminal on every exit, reader_done included, and the terminal read carries the mark); cause (ii), the race, holds, so the reconcile is followed by one more step read"
  - "BUG-261025-03 UI half reproduced RED (both arms), so it was fixed at the stack: newest ask per run_id while a workflow run is live; a passed clock on a live workflow run reads as paused"
  - "BUG-261024-04 lead (3) did not reproduce: onFinalOutputFiles stamps by assistantId and replaces, never merges; no product change"
  - "In-thread start: the real provider swallows send errors, so the hook also reads the refusal the provider recorded for THIS send (new reconcileErrors entry that stashed the kickoff draft, or the 409 arm) and clears the kickoff draft"
  - "engineFor returns null for any id other than a known engine or the legacy api alias"
metrics:
  duration: "~46 min (2026-10-26T17:29Z to 18:15Z)"
  completed: 2026-10-26
  tasks: 3
  commits: 6
---

# Phase 296 Plan 04: Run surfaces, chat and settings debt Summary

When a followed run ends, its answer now appears in the chat. A step on a paused run reads `! Waiting`. A live workflow run shows only its newest ask. The evidence report renders markdown, announces a failure it watched happen, explains a file with no link, and wraps its header. Schedule Run now answers on the row that was pressed. Launch forms clear their refusal when you type. An in-thread start the server refuses is explained in words. Diagram tooltips follow scrolling, and the rerank and citation-check copy now matches UI-SPEC D/F.

**Base sha:** `a5077f08389657af6aeadc301de7fd7703c5d4fe` (develop).

## Commits

| # | Hash | Type | What |
|---|------|------|------|
| T1 RED | `e93dbecbb` | test | follow-terminal reconcile, Waiting, ask stack, follow-up files |
| T1 GREEN | `fd59d0f19` | feat | reconcile + step re-read, WAITING_META, ask-stack dedupe, store type fix, ledger |
| T2 RED | `c563f4ad0` | test | evidence report, schedule Run now, launch refusals, neutral copy pins |
| T2 GREEN | `9c6b3403c` | feat | report, run page prop, schedule modal, types, launch forms, ledger |
| T3 RED | `dda315a08` | test | in-thread start, picker, artifacts, rerank, citation |
| T3 GREEN | `b392ef6d1` | feat | hook + copy + picker, tooltip/diagram, curl sample, rerank, citation, ledger |

## RED evidence and verdicts, per row

| Row | RED | Verdict |
|---|---|---|
| BUG-261021-04 | `0 >= 1` snapshot reads after the follow terminal on the viewed thread | FIXED: one guarded `actions.reconcile(threadId)` in `subscribeProducerStream`'s onTerminal wrapper |
| BUG-261021-03 | race arm RED (`undefined` vs the mark); cause-(i) arm GREEN at base | **Cause (ii) holds.** (i) is refuted: `subscribeToRun` calls `onTerminal` on every exit, including the defensive `reader_done`, and the terminal's read carries `unsourced`. Fixed by one more `refreshPhaseSpineAfterStop` chained after the reconcile |
| 295-D-uat-02 | `paused`/`cap_paused` running step read `●Running` | FIXED: `WAITING_META` (`!`, `Waiting`, warning) via `statusMetaForRun(status, runLive, runPaused)`; `runPaused` is derived in PhaseTimeline from its fetched frame |
| BUG-261025-03 (UI half) | (a) 3 cards for one run; (b) `agent stopped` on an `active` run | FIXED (both arms reproduced): stack keeps newest ask per `run_id` while a workflow run is live (Deep untouched); card reads a passed clock on a live workflow run as `paused`. **The prompt row carries no run status;** the stack uses the thread's recorded run status (295-08 store field). Re-check in G-4 scenario 4 |
| BUG-261024-04 lead (3) | GREEN at base | **Did not reproduce** (`streamsProvider_296_followup_files.test.tsx`). No change. Leads (1)/(2) stay with 296-06; live verdict G-4 scenario 8 |
| 287-TSC | TS2345 at `streamsStore.ts(492,55)` in base tsc | FIXED: initializer typed `(): StreamsState` (type only) |
| 289-F-B | no `<strong>`, literal `**` | FIXED: step output via `MarkdownRenderer` |
| 289-F-A | no sr-only alert | FIXED: `watchedFailure` prop; WorkflowRunPage passes it only after it saw the run live |
| 289-F-C | no sentence for an owner's unlinked file | FIXED: `DOWNLOAD_UNAVAILABLE` span |
| 289-IN-06 | constants said "your documents" | FIXED (copy) |
| BUG-261025-02 / 291-S6-F9 | title column `flex-1`, actions did not wrap | FIXED (classes). The run page has no separate record header (a finished run IS the report), so there is no second wrapper. Live 1536px check is G-4 scenario 7 |
| BUG-261025-01 | no row-local spinner or result | FIXED |
| 287-SCHED | empty required input was created | FIXED |
| 287-IN-01 | refusal stuck after typing; RunModal refusal away from fields | FIXED |
| 287-WR-02 / 287-IN-03 | no `failure`, no catch | FIXED |
| 287-IN-04b | no Escape/outside dismissal, no aria | FIXED |
| 292-IN-01 / 292-IN-03 / 292-WR-04-res | no follow; no title; "Corrected invoice" label on node 1 at 311px | FIXED |
| 293-IN-02 | `step_index: 3` on a completed sample | FIXED (data) |
| 294-IN-05 / 294-LOCAL | unknown ids read Cohere; no latency note | FIXED |
| 294-IN-06 / 294-IN-08 / SEED-365 | 409 local only, no GET retry, "citations", no 429 sentence | FIXED |

## G-5 record

| File | Hook counts before → after | Touch |
|---|---|---|
| StreamsProvider.tsx | useState 0→0, useEffect 9→9 | one guarded call (reconcile, then one step read) in one wrapper |
| PhaseCard.tsx | useState 1→1, useEffect 1→1 | one optional prop |
| WorkflowRunPage.tsx | useState 4→4, useEffect 4→4 | one `useRef` + one prop at the report mount (the effect's deps gained `isTerminal`) |
| PendingAskCard.tsx | useState 7→7, useEffect 3→3 | touched because the RED test reddened. One pure helper and one optional prop |
| streamsStore.ts | — | one type annotation |

The triples were re-derived with the CLAUDE.md recipe for every file touched, and each file got a `296-04:` line in its ledger section. The scan-list rows that were stale have been corrected: ChatLaunchForm read `1/1/157`, WorkflowScheduleModal `3/3/601`, RunModal `8/5/713`.

Newly FIRING:
- `evidenceVocabulary.ts`. A CLAUDE.md row was added.
- `composerCopy.ts`. Its existing row was updated.
- `ChatLaunchForm.tsx`, whose stale row had hidden that it was already firing.

`frontend/src/types/schedule.ts` got its first scan-list row and section.

`check-claude-md-size.cjs` passes, and so does `check-hot-file-ledger.cjs --files <all 25 non-test files>`.

## Guardrail overrides for STATE.md

- `WorkflowScheduleModal.tsx` (FIRES) took more than a one-touch change. Three `useState` replaced one (`notice` became `runningId`, `runResult` and `requiredRefusal`), and a pure `runNowResult` helper was added. Both rows (BUG-261025-01 and 287-SCHED) need per-row state, so this is recorded as an over-budget touch on a firing file.
- Two existing tests had their pins rewritten in place, with the original text quoted beside each change:
  - `PendingAskCard.retired.baseline.test.tsx`: the source line pin went from 1104 to 1133.
  - `streamsProvider_295_10_follow_after_answer.test.tsx`: the terminal workflow-read count went from 1 to 3.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 1] The pinned old copy moved with the words.** StepEvidenceLine.test, RunSpine.test and PhaseCard.test pinned the old `UNSOURCED_NOTE` / `NO_MATCH_EXPLANATION`. They were updated in the Task 2 RED commit `c563f4ad0`.
2. **[Rule 1] Three WorkflowRunPage.test cases pinned the verbatim output that 289-04 had recorded as a follow-up.** That follow-up is 289-F-B. The cases were rewritten in place with the 289-04 assertions quoted (`9c6b3403c`). The hostile case still asserts that no script runs, no `on*` attribute survives and no `javascript:` URL appears. It now accepts `<b>` and a handler-less `<img>`, because DOMPurify keeps those, as it does in chat.
3. **[Rule 1] Existing schedule tests submitted empty required inputs.** That is now refused. The cadence case fills the recipient, and `subject_line` is declared `required: false`.
4. **[Rule 3] The 287-IN-03 Retry needs the typed values back in the form.** ChatLaunchForm got one optional `initialValues` prop. The ChatLayout.launch fence pinned the old `useState(...({}))` literal and was rewritten in place with the original quoted. The fence's purpose still holds: no value is read from the conversation.
5. **[Rule 1] The real `sendMessage` never rejects, because the provider catches and records refusals.** A `.catch` alone could not see the real failure. The hook therefore also reads the provider's own per-thread refusal recorded for this send. It clears that entry and the `Run <name>` failed draft, which is what stopped the composer pre-fill.
6. **[Rule 1] The `citationCheckStore.test` "failed GET" case assumed no retry.** It was rewritten in place for retry-once: two failures, then a later ensure asks again.
7. **[Rule 1] `rerankEngines.parity.test` pinned the old behaviour,** where every unknown id read as Cohere. It was rewritten in place, and `?.` was added on the known-id reads so the typecheck stays clean.
8. **Not done here, and why:**
   - **289-F-A page-level test.** No WorkflowRunPage test drives a live-to-failed transition. The report prop is unit-tested. The ref logic needs the G-4 run.
   - **Count gate.** It was not run, per the orchestrator's instruction; 296-05 runs it. The new test files may need count-gate pins there.
   - **`graphify update .`** It was not run, so the shared worktree output is left untouched.

## Verification

- Every targeted suite passes:
  - panel and providers: 702 tests;
  - workflows plus WorkflowRunPage: 5910;
  - chat, settings, stores and layout: 2204;
  - the RunModal page suite.
- **tsc set diff** (`tsc -p tsconfig.app.json`, multiset of file and code): 63 errors at base, 62 now. No error is new, and one is gone: `streamsStore.ts TS2345`.
- **Unrelated reds seen in a broad `src/pages/__tests__` run:**
  - `LibraryPage.*`: 296-07's area, and no file in this plan's diff.
  - `WorkflowCard` / `SettingsPage.changedFields` / `PublishedCardDelete`: these pass when run alone, so they are load flakes.
  - All of these are logged here for 296-05's gate. They have not been proven inherited by a base re-run.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: content-render | frontend/src/components/workflows/RunEvidenceReport.tsx | Step output is now sanitised markdown, not escaped text. DOMPurify keeps a handler-less `<img>`, so a model-written image URL loads when a colleague opens the report. This matches chat today (T-296-10 is mitigated for script execution). |

## Self-Check: PASSED

- All six commits exist: `e93dbecbb`, `fd59d0f19`, `c563f4ad0`, `9c6b3403c`, `dda315a08`, `b392ef6d1`.
- All three created test files exist.
