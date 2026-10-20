---
phase: 287-start-from-a-thread-fork-a-starter
reviewed: 2026-10-19T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/layout/ChatLaunchForm.tsx
  - frontend/src/components/workflows/LaunchInputFields.tsx
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/chat/ThreadWorkflowPicker.tsx
  - frontend/src/components/chat/useStartWorkflowInThread.ts
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/stores/streamsStore.ts
  - supabase/migrations/210_starter_workflows_v2.sql
  - scripts/apply_migration_210.py
  - scripts/seed-starters.py
  - scripts/vitest-count-gate.cjs
  - backend/tests/unit/test_287_fork_isolation.py
  - backend/tests/unit/test_287_starter_static_gauntlet.py
  - frontend/src/components/chat/__tests__/ThreadWorkflowPicker.test.tsx
  - frontend/src/components/chat/__tests__/useStartWorkflowInThread.test.tsx
  - frontend/src/components/chat/__tests__/ChatArea.threadWorkflowPicker.test.tsx
  - frontend/src/components/workflows/__tests__/soulData.requiredFields.test.ts
  - frontend/src/components/workflows/library/__tests__/starterFork.287.test.tsx
  - frontend/src/providers/__tests__/StreamsProvider.inputs.test.tsx
  - frontend/src/pages/__tests__/RunModal.test.tsx
  - CLAUDE.md
  - docs/HOT-FILE-LEDGER.md
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 287: Code Review Report

**Reviewed:** 2026-10-19
**Depth:** standard
**Status:** issues_found

## Summary

No blockers. The migration is data-only, idempotent (fixed ids + `ON CONFLICT (id) DO NOTHING`), uses `is_system_global`, relies on the org_id autofill trigger with a loud guard, and ships no assets, inputs or folder binding. `docs/OPERATOR.md` Step 3 lists mig 210 and the ledger rows match `wc -l` (picker 91, hook 85, ChatArea 1189, soulData 523). Required-field logic is correct: whitespace is trimmed, `required: false` is exempt, and an absent `required` reads true. Nothing is read from the thread or model: the kickoff text is `Run <name>` and the inputs are the typed form values. `inputs` is forwarded through `postMessage`, which already drops an empty `inputs` dict. The double-fire guard (`startingRef`) is sound. The three warnings are about the in-thread start path colliding with an active Deep stream, and about a vacuous isolation test.

## Warnings

### WR-01: Picker is enabled while a normal (Deep) turn is streaming in the thread; the start is silently dropped and the composer is polluted

**File:** `frontend/src/components/chat/ChatArea.tsx:808` (with `ThreadWorkflowPicker.tsx:29`)
**Issue:** `locked` is only `workflowLocked` (harness lock). `isStreaming` is already available in ChatArea (line 158) but is not passed in, so `disabled = locked || s.starting` ignores a running Deep stream. Scenario: the user sends a chat message and, while it streams, picks a no-input workflow. `sendMessage` hits the `sendingThreadsRef.current.has(threadId)` duplicate guard (StreamsProvider.tsx ~2619-2647). It does not dispatch. It sets `reconcileErrors` to "Couldn't send — tap to retry" and stashes `failedSendDrafts = "Run <name>"`. The composer is prefilled with `Run <name>`. The hook meanwhile sets `starting` and closes the list. The person sees an error banner and a stray draft, and the workflow never starts.
**Fix:** Pass `locked={workflowLocked || isStreaming}` (or a separate `busy` prop with its own reason line). Add a ChatArea test that streams and asserts the trigger is disabled.

### WR-02: A rejected in-thread start recovers the wrong thing into the composer

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:60-69`
**Issue:** On any `ApiError` (400 disabled skill, 409 lock race, 422 inputs) the provider's rollback stashes the kickoff `content` (`Run <name>`) as `failedSendDrafts` and prefills the composer with it. The workflow definition id and the typed `inputs` are not recoverable. Pressing Send then posts `Run <name>` as an ordinary Deep message with no workflow and no inputs, which looks like a retry but runs nothing. The 409 lock-race branch's banner copy says "cancel it to send a Deep message", which is the wrong instruction for a workflow start.
**Fix:** Have the hook own the failure. Detect the failed start via the store (`reconcileErrors` / `failedSendDrafts` for the thread), clear the draft, and show its own error with a Retry that re-calls `start(def, inputs)`. Alternatively give `sendMessage` a `suppressDraftRecovery` option for workflow kickoffs.

### WR-03: Fork-isolation test never attempts the attack it claims to pin

**File:** `backend/tests/unit/test_287_fork_isolation.py:99-190`
**Issue:** The docstring and SC#4 say "editing a fork never touches the starter". The test edits only A's own fork through `update_workflow_definition`, then asserts that unrelated rows are byte-equal. That passes for any implementation that updates by the correct id. It never calls update with the starter's id as a non-owner (or as the owner, with `is_system_global=true`), which is the real boundary. It also connects as the `postgres` superuser, which bypasses RLS, so ownership and RLS are not exercised. `_ids_differ` plus its "counterfactual" test only checks `a != b`. Dropping the owner/global guard in `update_workflow_definition` would leave this suite green.
**Fix:** Add a case where user B calls `update_workflow_definition` on `starter_id` and on A's fork. Assert a refusal (`ok is False` or an exception) and byte-equal snapshots. Add a case where A (the starter's `created_by`) tries to edit the published global row, and assert the trigger/guard refuses it.

## Info

### IN-01: Required-field refusal does not clear when the person starts typing

**File:** `frontend/src/components/layout/ChatLaunchForm.tsx:97-104`, `frontend/src/components/workflows/library/RunModal.tsx:258-264`
**Issue:** `refusal` / `requiredRefusal` are reset only on the next confirm. After the person fills the named field, the `role="alert"` message ("Recipient is required") stays visible until they click Run again. Fix: clear it in the `onChange` handler (`setRefusal(null)`).

### IN-02: Refusal text uses the raw label with no empty-string guard, and the RunModal copy is placed away from the fields

**File:** `frontend/src/components/workflows/soulData.ts:219`, `frontend/src/components/workflows/library/RunModal.tsx:533`
**Issue:** `f.label ?? f.key` is safe today only because `entryInputFields` normalises a blank label to absent. Any other `EntryInputField` producer passing `label: ""` yields " is required". Use `f.label || f.key`. The RunModal refusal renders in the template/upload error group, not beside the input fields, so on a tall modal it can be off-screen.

### IN-03: Unhandled rejection path in `start`

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:60-69`
**Issue:** `void sendMessage(...).finally(...)` creates a derived promise that rejects if `sendMessage` ever rejects (a non-ApiError thrown outside its try, for example). That is an unhandled rejection, and `finally` still resets `starting`. Append `.catch(() => {})` after `.finally`, or switch to try/catch inside an async IIFE.

### IN-04: Weak assertions in the starter verification and picker UX

**File:** `supabase/migrations/210_starter_workflows_v2.sql` (VERIFY block), `frontend/src/components/chat/ThreadWorkflowPicker.tsx:41`
**Issue:** The VERIFY check "shelf lists at least 6 starters" is `>= 6`, so it passes on a DB with other starters even if one of the three new rows were skipped by an id conflict. The first check (count = 3 by slug/version) does cover the new rows, so this is only a redundancy. Separately, the open picker list has no outside-click or Escape dismissal (only the form does), and it stays open over the composer until the trigger is clicked again.

## Disposition (2026-10-19, orchestrator; G-7 triage, no gap round)
- **WR-01 FIXED inline (fast-fix):** `ThreadWorkflowPicker` takes `busy`, ChatArea passes `isStreaming`; test added in `ThreadWorkflowPicker.test.tsx`.
- **WR-02 DEFERRED:** rejected-start recovery (hook owns the error + Retry with the definition id and inputs; 409 wording). Not a success-criterion failure; the user sees a banner and nothing starts. Re-open trigger: next phase touching `useStartWorkflowInThread` or the composer retry path.
- **WR-03 DEFERRED:** strengthen `test_287_fork_isolation.py` with non-owner update refusals (needs a user-JWT/RLS connection, not the superuser pool). Re-open trigger: next phase touching fork/ownership paths.
- IN-01..IN-04: accepted, recorded.
