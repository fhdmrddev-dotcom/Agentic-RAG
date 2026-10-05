---
phase: 267-an-expert-adds-scope
plan: FIX-CR02-CR03-LIVE
subsystem: experts / chat scoping
tags: [experts, scoping, live-drive, verification]
requires: [267-FIX-CR02-CR03-SUMMARY.md]
evidence: evidence/cr02-cr03-live-drive.txt
head: f54c5284c
independent_review: self
---

# Phase 267: live drive of the CR-02 / CR-03 fixes

The fixes were driven against the **restarted** local backend. It had one listener on :8000, started at 21:49:10 local, after the last fix commit (21:47:21). The drive used the real HTTP API, the local DB and the run's Redis stream. The Supabase MCP (production) was not used. No source file was edited.

Setup:
- **Org:** the 269 throwaway org `21274586-…`, on the enterprise tier.
- **Model:** deepseek-v4-flash, set per request.
- **Temporary Experts,** created through `POST /experts`:
  - T1 "CR02 probe": biased, 0 folders.
  - T2 "CR03 probe": restricted to the HR install folder.

## Verdicts

| Drive | What | Verdict |
|---|---|---|
| D1 | CR-02: biased Expert with 0 folders on a no-folder thread | **PASS** |
| D2 | CR-03 (a)+(c): server-side clear is stated once, and the snapshot and list read null | **PASS** |
| D3 | CR-03 (d): a disabled Expert is hidden from members | **PASS** |
| D4 | Regression: a restricted starter (Contract Reviewer) still answers its cited question | **PASS** |

## Findings per drive

**D1.**
- The T1 thread and a plain thread got the same result:
  - `search_documents` returned 3 org documents, and the answer carried `$124.5 million` and `30.8%` with `[1]` citations;
  - the stream had a `citations` event and **0 `scope_violation`** entries (189-entry stream).
- The run row carries `expert_id = T1`, so the run really was an Expert run.

**D2.** The thread belonged to the **member**; the admin disabled T2 through `PATCH /experts/{id}`.
- **Message 1** was scoped and answered "18 weeks".
- **Message 2** returned HTTP 201. Its run then `failed` with the unchanged error text: `ValueError: Active expert '…' could not be resolved or is inaccessible; refusing run (fail-closed)`.
- `threads.active_expert_id` became NULL.
- **Exactly one** `system` row was written in the thread's org, with kind `expert_changed` and content `CR03 probe left. Now: All your documents. Dropped: Nothing.`
- **Message 3** ran as a plain run and wrote **no second row**.
- The snapshot returned the key `active_expert_id` with value `null`.
- The `GET /threads` object reads `active_expert_id: null`.

**D3.**
- **Member:** `GET /experts/{T2}` returned 404 "Expert bundle not found".
- **Org-admin:** 200 with `is_enabled: false`.
- **Member's `GET /experts`:** excludes T2.

**D4.**
- The answer carried `$2.35M` and `75 days`.
- All search documents came from the contract install folder (0 outside it), and there was 0 `scope_violation`.

## Controls that would have passed without the fix

- **D1 control (the plain thread):** it answers identically before and after the fix. It shows what "searches like a plain thread" looks like, but proves nothing about the fix. The evidence is the T1 run itself, and it could have failed: the checks look for "No relevant documents found." and for `scope_violation`.
  - This drive **did not** re-run the pre-fix code live, because the backend could not be restarted onto the old commit.
  - The pre-fix failure of this exact shape (citations 0, `scope_violation` emitted) is the in-process `PREFIX` measurement in `267-FIX-CR02-CR03-SUMMARY.md`. It is not measured here.
- **D2: most of the checks would also pass on the pre-fix code.** The old code already did these things:
  - refused the run with the same `ValueError`;
  - cleared `active_expert_id`, so the thread list also reads null;
  - put `active_expert_id: null` on the snapshot wire (measured in the fix summary, CR-03(c)).

  The **new** behaviour this drive proves live is narrower:
  - the single `expert_changed` system row, in the thread's org;
  - no duplicate row on the next send.
- **D3: only the member's 404 is new.** The admin's 200 and the member's list exclusion were already true before the fix. The list has filtered disabled Experts since R265-262-07.
- **D4 is a regression control by design.** It is expected to be identical before and after.

## Unexpected / worth knowing

1. **The admin's default `GET /experts` also hides the disabled T2.** Only `?for_management=true&enabled_only=false` shows it: that returned 200 for the admin with T2 `is_enabled: false`, and 403 for the member. This is consistent with R265-262-07, not a defect, but a manager looking at the default catalog will not see a disabled Expert.
2. **The refusal is still a run-time failure, not a pre-run refusal.** The send returned **201**, and the run failed after about 17 ms. The review's CR-03(b) (a 409 before any run) is **deferred** and still absent, as the fix summary states.
3. **The refused message stays in the history unanswered.** The next plain run (message 3) answered it: it gave the "23 days" PTO figure alongside the requested summary. That is harmless here, but the refused question is carried into the next turn.
4. **The statement row is written before the run starts.** Its `created_at` is 17:53:28.826; run 2 started at 17:53:28.830. So the transcript orders "left" before the failed turn.
5. **Not driven here:** the client half of CR-03(c), the chip clearing in the UI through the terminal snapshot probe. This was an API-level drive. The browser step in the fix summary is still owed if an eyes-on check is wanted.

## Cleanup (local DB, one transaction)

All 4 temporary threads cascaded, plus the 2 temporary Experts:
- `DELETE FROM runs WHERE thread_id = ANY(<4 threads>)`: 6 rows;
- `DELETE FROM messages …`: 12 rows (2 + 2 + 6 + 2, including the one `expert_changed` row);
- `DELETE FROM threads …`: 4 rows;
- `DELETE FROM expert_bundles WHERE id = ANY(<T1, T2>)`: 2 rows.

The after-counts are 0 across messages, runs, threads, bundles, grants, installs, code_executions, workspace_files, todos, workflow_runs and born-for skills.

**Left in place on purpose:** 5 `audit_log` rows. These are the app's append-only ledger of the drive's searches, not rows the drive created itself. The 269 org, its users and its installs are untouched.
