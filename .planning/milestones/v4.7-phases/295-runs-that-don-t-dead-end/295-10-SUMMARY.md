---
phase: 295-runs-that-don-t-dead-end
plan: 10
gap_closure: true
gap_closure_round: 2
subsystem: chat-thread run following, ask card refusals, folder org scoping, kickoff refusal wording
tags: [gap-closure, d-r1-01, d-r1-02, d-r1-03, d-r1-04, sc-4, tdd]
requires:
  - "295-VALIDATION.md, section 'Gap round 1 re-drive (2026-10-21)' (the four defects, measured live)"
  - "base 61eedca76"
provides:
  - "D-r1-02: after an answer in the chat thread, the open tab attaches the re-drive's new producer stream and follows the run to its end or its next question"
  - "D-r1-01: a stale card's 409 shows the server's sentence; on a paused run the stack re-reads its asks so the current card appears"
  - "D-r1-04: under an org restriction, a two-org owner's OWN folders are narrowed to the allowed org too"
  - "D-r1-03: a send on a paused run is refused with words that say where the run waits and how to stop it"
affects: [295 verification, SC#4 (chat home), BUG-261021-02 (filed), docs/HOT-FILE-LEDGER.md, CLAUDE.md]
tech-stack:
  added: []
  patterns:
    - "Every defect driven by a test committed before its fix (test(295-10) then fix(295-10))"
    - "A guard widened by ONE conjunct read off an existing store field, so a shipped arm runs where it was skipped"
key-files:
  created:
    - frontend/src/__tests__/providers/streamsProvider_295_10_follow_after_answer.test.tsx
    - backend/tests/unit/test_295_10_gap_round2.py
    - .planning/reported-bugs/BUG-261021-02-folders-and-workflows-ignore-x-org-id.md
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskStack.pausedRun.test.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
    - backend/app/utils/folder_utils.py
    - backend/app/services/workflow_kickoff.py
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-r1-02 is fixed by letting the answer settle through for a thread whose recorded run status is paused; the settle's shipped live arm then attaches the new producer. No retry loop: the answer route mints the new producer shell before it returns 200, and 244-15 Test 8 forbids a timer in the settle"
  - "A producer stream's end now runs the existing phase refresh (one read), so the panel and the recorded run status come from the server when a re-driven segment ends"
  - "A run started elsewhere while the thread sits open is NOT fixed: nothing signals the tab (no Realtime on runs), and a poll would be a new capability in the last allowed round"
  - "D-r1-01 re-reads asks only on a run the stack reads as paused; an ended run's card keeps its ended reading, because /ask_user/pending omits ended runs and a re-read would remove the card"
  - "D-r1-04 narrows owned folders only under a NON-EMPTY restriction; None and set() keep their documented readings (folders.org_id is NOT NULL, so set() filtering owned rows would leave nothing)"
  - "D-r1-03 uses a sentence that does not start with the lock prefix, so the client's generic 409 arm shows it as sent; no client change"
metrics:
  completed: 2026-10-21
  tasks: 5
  files: 12
---

# Phase 295 Plan 10: Gap fix round 2 (the last round G-7 allows)

All four defects the round-1 re-drive recorded are fixed. Each was driven by a failing test committed before its fix, and every RED failed for the reason the re-drive gave. None was refuted. No new capability was added. Base: `61eedca76`.

## Defects

| Defect | Driven RED? | Result | RED commit | Fix commit |
|---|---|---|---|---|
| D-r1-02: after an answer, the tab stops following the run (SC#4) | Yes. After an accepted answer the tab never subscribed to the new producer (`expected [] to include 'producer-redrive-2'`). 4 cases RED, 1 guard green. | Fixed | `d4a270178` | `e1861837f` |
| D-r1-01: a stale card's 409 says "This run has already ended" | Yes. The server's sentence was not shown, and the asks were not re-read. 2 RED, 1 guard green. | Fixed | `b2aed2874` | `d53fa69e6` |
| D-r1-04: the owner's own other-org folders are offered | Yes. The real `fetch_visible_folders` admitted them under a restriction, and both runs offered them, the same lists the re-drive saw. 4 RED. | Fixed | `1d93b353f` | `b9eb997fe` |
| D-r1-03: a paused run's send is refused with "cancel the active workflow" | Yes. 1 RED; the other statuses' guards green. | Fixed | `1d93b353f` | `88698c121` |

Also: `283855f8d` files BUG-261021-02 (no fix).

## D-r1-02: the mechanism, read from the code

1. A paused run has no live producer. So `GET /threads/{id}/workflow` reports its lock as stale, and the tab holds **no workflow lock** for the thread. If this tab started the run, the kickoff mark is cleared when its stream ends at the pause. So when the person answers, the thread holds **neither** a lock **nor** a kickoff mark. The only thing that says a run is waiting is the run status 295-08 records from the phase reconcile (`workflowRunStatusByThread`).
2. After a successful answer, the stack calls `releaseSettledWorkflowLock`. Its first line returned early when the thread had neither a lock nor a kickoff mark (the 244-15 WR-01 guard). So for a paused run it **never read the thread's workflow state again**.
3. The answer route re-drives the run on a **new producer shell**, and it does so before it returns 200: `_redrive_paused_workflow_run` runs `resume_run` (status back to `active`) and `_build_resume_context` (the shell's `runs` INSERT, `status='streaming'`) before the route answers. So a read right after the 200 already reports the run live, with `latest_producer_run_id` set to the new shell. Nothing in the tab ever subscribed to it, so the panel kept its last picture ("Running") until a thread switch ran the mount reconcile, which does attach it (Facet C).

**The fix (two changes in `StreamsProvider.tsx`, +7 lines):**
- The settle's early return gains one conjunct: it no longer returns when the recorded run status is `paused`. Its shipped live arm then attaches the new producer stream (`subscribeProducerStream`, idempotent). The run's own events then move the panel: `phase_completed`, `run_completed`, `run_failed`, and `ask_user_prompt` for the next question.
- `subscribeProducerStream`'s terminal wrapper now runs the existing `refreshPhaseSpineAfterStop` (one read, viewed thread only). When a re-driven segment ends, whether done, failed or paused again, the panel and the recorded run status come from the server, not the stream alone (D-v2.5-03).

Invariants kept: the settle still has no `setWorkflowLockForThread` call and no timer (244-15 Test 8 green), and `workflowLockWriters.lockstep` is green. The Deep-thread guard holds (244-15 Tests 13 to 16 green, plus a new case: a thread whose recorded run is `completed` still issues no read). Per-thread keying is unchanged.

**Why no bounded retry.** The 200 is sent after the new shell exists, so one read is enough. The only path where it would not be is a lost lease claim (the boot sweep holds the run). Then the read sees the run still paused, attaches nothing, and the release arm's phase refresh records the true state. A retry would need a timer inside the settle, which 244-15 Test 8 forbids (the "never polls" rule).

**Not fixed, by decision: a run started elsewhere while the thread sits open** (the re-drive's API-started case, 155 s). Nothing signals the tab: there is no Realtime subscription on runs or messages, and the window focus reconcile does not re-read phases or asks. Showing it without a thread switch needs a poll while a thread is open, which is a new capability, and this is the last round G-7 allows. Recommended follow-up: a named phase item, "an open thread notices a run it did not start". A person who starts a run elsewhere usually switches threads or windows, and a thread switch shows it.

**Known, not changed:** during a re-driven segment the composer is not locked. The settle sets no lock, by design: it is not allowed to be a seventh lock writer. A send in that window gets the server's 409. This was already the case before 295-10.

## D-r1-01

`PendingAskCard.tsx`'s 409 arm now shows the server's sentence, followed by "Your answer was not saved.", whenever `answerAskUser` carried one. It uses the same `ASK_ANSWER_FAILED` test as the 4xx arm. With no sentence it keeps "This run has already ended — your answer was not saved". It still retires the card. On a run the stack reads as `paused`, it then calls the stack's ask reconcile once, so the stale tab gets the current question's card. A run not known to be waiting is not re-read. An ended run's card keeps its ended words, because `/ask_user/pending` omits ended runs, and a re-read would remove the card. useState 7 → 7, useEffect 3 → 3. The card's `?raw` line pin was re-baselined 1096 → 1102 with a dated note.

## D-r1-04

`fetch_visible_folders` (`backend/app/utils/folder_utils.py`): under a **non-empty** `restrict_org_ids`, an owned folder must now also have an allowed `org_id`. With `None` (every unrestricted caller: chat, the `/folders` routes, run start, resume, Continue, NL generation, the per-run override gate) and `set()` (owned only), the result is unchanged.

Every caller was checked:
- **`permitted_folder_options`** (the "Search another folder" list). This is the fix.
- **Publish stage 2.6**, through `grounding` and `scope`. It now also refuses a project root that the publisher owns in a different org from the definition. Its docstring already asked for this.
- **`threads._authorize_thread_folder`**. It already re-checked the row's org itself, so it is unchanged.

Inherited and not changed: `scope.resolve_run_scope_root`'s per-run override gate reads folders with no restriction (D-39 parity, a caller that passes no org). So a per-run `folder_id` input at run start can still name the owner's own folder in another org. It is not reachable from "Search another folder", because that list is narrowed first.

`folder_utils.py` had **no ledger row for its entire life**, at 4 phases. Its scan-list row, section and CLAUDE.md FIRING row were added in the fix commit.

## D-r1-03

`preflight_workflow_kickoff` (`backend/app/services/workflow_kickoff.py`): when the anchored run is `paused`, the 409 now reads: "This thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page. To stop the run instead, open its run page and stop it there."

The sentence deliberately does not start with `Thread is workflow-locked`. The client replaces a sentence with that prefix by its own "cancel it to send a Deep message" line. Any other send 409 already reaches the client's generic arm with the server's words (279-03 D-15), so no client change was needed. Every other live status keeps the old sentence byte for byte, and the `?raw` prefix pin is green. The F2 stale-lock rule in `threads.py` is unchanged. If 15 → 16.

## Gates

- **Frontend targeted suites.** These were run once after all fixes, read from the run's own JSON report: 101 files, **1410 passed, 0 failed**. The run covered:
  - all of `src/components/panel`, `src/__tests__/providers`, `src/providers` and `src/lib/api`
  - `streamsStore_per_thread`
  - the ChatArea, MessageItem and StopControl suites under `src/components/chat/__tests__`
  - `src/__tests__/components/chat/MessageList*` and `src/__tests__/components/MessageItem*`
  - `WorkflowRunPage.test.tsx` and `WorkflowRunPage.seam286.pin`
- **Count gate pins.** `streamsProvider_295_10_follow_after_answer.test.tsx` was adopted in both knobs with a pin of 6 and a file-level TARGETS entry. `PendingAskStack.pausedRun.test.tsx` went 11 → 14 (counted growth, dated note). Both match the run's per-file counts. The full count gate was not run.
- **Typecheck.** `npx tsc -p tsconfig.app.json --noEmit` read **63 at base, 63 at HEAD**. After line-number normalisation the error SET is identical (base measured in a temp worktree at `61eedca76`).
- **Backend named suites.** These all pass, 935 passed:
  - all `test_295_*`, `test_256_*` and `test_281_*` unit suites
  - `tests/test_295_engine_ask_redrive.py` and `tests/test_182_grounding_bundle.py`
  - the 185, 187 and 214 suites, `test_196_judge_model_db_backed` and `test_ask_user_disposition`
  - `test_165_folder_utils_org_scope`, `test_182_publish_org_scope`, the 258, 268 and 279 kickoff suites
  - the folder and publish suites (262 passed)
  - Outside `tests/unit`, two failures are inherited and identical at base: `tests/test_098_scope_governance.py::test_run_start_resolution` (`get_service_role_supabase requires an explicit org_id`) and 21 in `tests/test_dual_mode_wiring.py`.
- **Backend unit gate.** This is `pytest tests/unit -q --continue-on-collection-errors`, run once on each tree in the same environment. The base tree was a temp worktree at `61eedca76`, torn down with `scripts/teardown-worktree.sh` (source venv and node_modules intact).
  - Base: **70 failed**, 8668 passed, 1 skipped, 2 xfailed, 2 xpassed.
  - HEAD: **70 failed**, 8682 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 collection errors.
  - The failing-ID sets are **identical**: 0 new and 0 fixed. The 14 new passes are `test_295_10_gap_round2.py`. HEAD is within the 71 ceiling.
- **Ledger and size gates.** `check-hot-file-ledger.cjs` reports OK (622 rows). `check-claude-md-size.cjs` reports OK. Every touched hot file's scan-list row, section and CLAUDE.md row were updated in the same commit as its code: `StreamsProvider.tsx`, `PendingAskCard.tsx`, `vitest-count-gate.cjs` (twice), `workflow_kickoff.py`, and the new `folder_utils.py` rows.
- **Local DB.** The local-DB lock was taken (noclobber) before any backend run and deleted after. The DB read 0 active or paused workflow runs before the runs (SEED-363).
- Not done: `graphify update .` (`graphify-out/` is tracked and outside this brief; owed after merge). No Supabase MCP call of any kind. No server was started.

## What the post-merge live check must drive

The `:8000` backend and the Vite dev server serve the operator's develop checkout, so none of this is visible until merged. Drive from a chat thread, Workspace panel open, no reload and no thread switch unless a step says so.

1. **D-r1-02, found-nothing then completion (the SC#4 row).** Start the S1 plant from the thread and let it pause. Answer "Continue without sources" in the panel. Without switching threads, the panel must move off "Running": research reads done, then wrap runs and completes ("Complete"). It must read complete within a few seconds of `run_completed` in the DB, not 62 s later.
2. **D-r1-02, the next question (S2).** On the S2 plant, answer Continue in the panel. Without a thread switch, the approval card must appear in the panel as the run pauses on it, answerable. Answer it there, and the run must complete with the panel following it.
3. **D-r1-02, armed "Do not run it".** The panel must read the step as failed, with the stop reason, within seconds of the run failing. It must not read "Running · paused, waiting on a person".
4. **D-r1-01.** Use tab A and tab B on one paused found-nothing run. Answer T1 in tab B with "Search another folder", so the run pauses on T2. Then press Send on T1 in tab A. Tab A must show "This question is no longer the one the run is waiting on. Your answer was not saved.", and then T2's card, answerable. Answer T2 in tab A, and the run must resume.
5. **D-r1-04.** As the two-org dev account, start an org-A run and an org-B run on empty folders. Neither "Search another folder" list may hold any folder from the other org, owned or shared. Check this both in the UI chooser and in `engine_pause.folders` on the prompt row.
6. **D-r1-03.** Type into the composer while a run is paused. The column must read the new paused sentence (answer in the panel or on the run page, stop from the run page), not "cancel it to send a Deep message".
7. **Regression spot-check.** Run a Deep chat ask with Stop pressed, then answer inside 8 s. The Stop must still climb down (WR-01). Start a workflow from the thread and let it run to completion, with no answer at all. The panel must read the same as before.
8. **Known limit, record only.** A run started through the API while the thread sits open still shows only after a thread switch. This is by decision, see above.

## Deviations from the brief

- **[Rule 2] A second change in `StreamsProvider.tsx`:** the stream-end phase refresh. Without it, the recorded run status stayed `paused` after a re-driven run completed, and the panel's end state depended on the SSE alone. Its case was added after the first GREEN and driven RED by removing the one line. That plant reds exactly that case, and the file was restored.
- **D-r1-01's re-read is gated on `paused`**, not on every 409. The reason is above: an ended run's card would vanish.
- **D-r1-03 needed no client change.** The brief allowed for "the client showing the server's words". The existing generic 409 arm already does that for any sentence without the lock prefix.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, route, schema or auth path. D-r1-04 narrows a service-role visibility read; it never widens one.
