---
phase: 267-an-expert-adds-scope
plan: FIX-CR02-CR03
subsystem: experts / chat scoping
tags: [experts, scoping, retrieval, transcript, reconcile]
requires: [267-REVIEW-INDEPENDENT.md CR-02, CR-03]
provides:
  - empty biased Expert composition = no Expert narrowing (run_producer)
  - send-time stale-Expert clear writes the expert_changed removal row (thread's org)
  - client reconciles the Expert chip from every snapshot read
  - GET /experts/{id} hides a disabled Expert from non-managers
key-files:
  created:
    - backend/tests/unit/test_267_cr02_empty_biased_scope_searches.py
    - backend/tests/unit/test_267_cr03_server_side_expert_clear.py
  modified:
    - backend/app/services/run_producer.py
    - backend/app/services/expert_scope.py
    - backend/app/api/threads.py
    - backend/app/api/experts.py
    - backend/tests/unit/test_266_restricted_empty_scope_refuses.py
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/__tests__/ChatArea.expertThread.test.tsx
    - frontend/src/lib/api/threads.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/stores/streamsStore.ts
    - frontend/src/components/experts/catalog/expertCatalog.ts (comment only)
decisions:
  - "CR-02: the fix is in run_producer (`composition or None`), not in compose_expert_scope — the pure composition stays byte-for-byte as pinned by test_267_expert_scope.py."
  - "CR-03(a): the clear is now conditional on the Expert it read (`.eq('active_expert_id', read)`), so a concurrent PATCH is never clobbered and a concurrent send states the removal once."
  - "CR-03(a): one row writer — expert_scope.insert_expert_changed_row — called by both PATCH (_write_expert_change) and the send-time clear."
  - "CR-03(b) DEFERRED: no shared org-equality helper exists (PATCH and handoff compare inline with different sentences), so a send-path guard would be a new send-path branch."
  - "CR-03(c): the wire already carried `active_expert_id: null` (ThreadSnapshotResponse fills it); the defect was the client dropping it. Readings are recorded latest-REQUEST-wins; PATCH answers are recorded too."
metrics:
  started: 2026-09-29T16:58:24Z
  completed: 2026-09-29T17:22:00Z
  duration: ~24 min
  commits: 2 fix + this summary
independent_review: self
---

# Phase 267 fix: CR-02 and CR-03 from the independent review

Two findings from `267-REVIEW-INDEPENDENT.md`, each fixed test-first in one atomic commit.

**CR-02.** A biased Expert with no folders, on a thread with no folder, now searches the same way a plain thread does. Before, every search came back empty and emitted `scope_violation`, while the screen said "All your documents".

**CR-03.** When the server removes a thread's Expert:
- the transcript now records it;
- the chip clears on the next snapshot read;
- a disabled Expert no longer loads the chip for a member.

## Commits

| Finding | Commit | Files |
|---|---|---|
| CR-02 | `a95a19881` | run_producer.py, expert_scope.py (comment), expertCatalog.ts (comment), test_266 (corrected pin), new test_267_cr02 |
| CR-03 | `0cbf5d282` | run_producer.py, expert_scope.py, threads.py, experts.py, ChatArea.tsx, StreamsProvider.tsx, streamsStore.ts, lib/api/threads.ts, 2 tests |

## CR-02: an empty biased composition means "no Expert narrowing"

**Fix** (`run_producer._resolve_thread_scoping`):
- `effective_folder_ids = _scope.effective_folder_ids or None`
- `scoped_folder_path = _scope.scoped_folder_path if effective_folder_ids else None`

Only a biased Expert with no effective folders on a no-folder thread can produce an empty composition:
- restricted-empty is refused above this point;
- a thread folder always contributes its own id.

Every non-empty composition is therefore passed on unchanged.

**RED** (`test_267_cr02_empty_biased_scope_searches.py`). The test runs a real `_handle_search_documents` on the scoping `_resolve_thread_scoping` returns. Only the RPC edge is faked, and the fake follows retrieval's own rule (`folder_ids if folder_ids else None`):
```
E  AssertionError: a biased Expert with no folders walled the search to NOTHING; the statement says All your documents
E  assert 'No relevant documents found.' != 'No relevant documents found.'
E  AssertionError: assert () is None
E  assert 'No relevant documents found.' == '[{"document_...000000000a"}]'      (expert search vs plain-thread search)
3 failed, 7 passed
```

**GREEN:** 10/10.

The controls stay identical:
- restricted-empty is still refused;
- restricted and biased compositions, with or without a thread folder, are handed on exactly as `compose_expert_scope` returns them (4 parametrised cases);
- a restricted Expert's folder wall still drops out-of-scope hits and emits `scope_violation`;
- a source pin confirms the test mirrors `agent_loop`'s own two override lines.

**A test that locked in the bug, corrected:** `test_266_restricted_empty_scope_refuses.py::test_biased_expert_with_no_folders_is_unchanged` asserted `== ()`. It now asserts `is None`, and the correction is recorded beside the original.

**Wrong comments corrected beside their originals (no behaviour change):**
- `test_266`'s docstring ("keeps searching everything");
- `expert_scope.py` `ScopeStatement.used()`;
- `expertCatalog.ts` `narrowingLedgerColumns`.

Each of these comments was false when written and is true after the fix.

**Live proof** against the LOCAL stack, with no backend restart. It used:
- the real `_resolve_thread_scoping` on the service client and pool;
- real retrieval and real embeddings;
- a temporary thread (deleted afterwards) bound to `Financial Contracts Reviewer (UAT-262)`, which is biased with 0 folders.

```
scoping: ThreadScoping(effective_folder_ids=None, ..., scoped_folder_path=None, born_for_bundle_id=670479b1-…)
FIXED  folder_subtree_ids = None | citations = 5 | emits = []
PREFIX folder_subtree_ids = []   | citations = 0 | emits = ['scope_violation'] | result = No relevant documents found.
PLAIN  folder_subtree_ids = None | citations = 5 | emits = []
temp thread deleted: True
```

## CR-03: a server-side Expert clear is stated, reconciled and not re-hydrated

### (a) The removal is stated
When `_resolve_thread_scoping` cannot resolve the thread's Expert:
- it now clears it **conditionally on the Expert it read**;
- if it cleared a row, it writes the PATCH door's `expert_changed` removal row: `before` is stated with `allow_unresolved` and named by `get_expert_service`, `after` is no Expert;
- the row is written in the **thread's** org, through the one writer `expert_scope.insert_expert_changed_row`. `threads._write_expert_change` now calls the same writer.

The statement can never mask the fail-closed refusal: the `ValueError` and its text are unchanged. If the Expert no longer exists at all, no row is written, the same as on the PATCH door.

**Remaining imprecision:** the statement runs on the service client, so a thread-folder `doc_count` in the `Now:` line is counted without RLS. The folder set is still limited to folders the user can see.

### (c) The chip reconciles
- **Measured first: the finding's backend half does not hold on the wire.** `ThreadSnapshotResponse.active_expert_id: UUID | None = None` already sent `null` over HTTP (`test_c_on_the_wire_a_cleared_expert_reads_null` passes at base).
- The real defect was on the client: `getSnapshot` dropped the field, and nothing reconciled the chip.
- The handler now sets the key explicitly anyway. This does not change the wire.

The client now handles it:
- `getSnapshot` maps the field.
- `StreamsProvider` sends every snapshot read (the reconcile, the transient terminal probe and the watchdog probe) through one wrapper. The wrapper records the reading with `streamsStore.recordExpertReading`, and the latest request wins.
- ChatArea records its own PATCH answers too.
- A **new** reading that disagrees with the thread is written back to the list owner (`onThreadUpdated`). With no owner, a `null` reading clears the chip directly.
- A reading already stored when a thread comes on screen is not treated as new.
- Hook changes in ChatArea: +1 store selector, +2 refs, +1 `useEffect`, and no hook after an early return (the component has none). `useState` is unchanged.

### (d) A disabled Expert is hidden from members
`GET /experts/{id}` returns 404 ("Expert bundle not found") for a disabled Expert unless the caller has `experts:manage`. The permission is only checked for a disabled bundle.

### (b) DEFERRED — not implemented
The brief allowed (b) only as a single guard that reuses the **same** org-equality helper and message the PATCH and handoff doors use. No such helper exists:
- PATCH compares `before_row.org_id != bound_org_id` inline: "Switch to this chat's organization to invite an Expert.";
- handoff compares `source.org_id != _org_id` inline: "…to hand it off.".

The send handler also does not read `threads.org_id` today. Its select is `id, active_workflow_run_id`. Adding the guard would therefore mean a widened select, a new `if` and a new sentence in `send_message`. That breaks 268's rule of 0 new send-path branches.

**What still happens without (b):** a two-org user who opens an org-A Expert thread while org B is active still has the Expert cleared at send. Because of (a) and (c), that is now **stated** in the transcript and **visible** on the chip, rather than silent.

**Suggested route:** first extract the org-equality check into one helper (the PATCH, handoff and preview doors — IN-01 is the same class), then add (b) as a one-line call.

### RED (backend, `test_267_cr03_server_side_expert_clear.py`)
```
E  AssertionError: the server removed the Expert and wrote nothing the transcript could state
E  assert 0 == 1
E  AssertionError: assert ('active_expert_id', '4444…') in [('id', '7d00…'), ('id', '7d00…')]
E  assert 'insert_expert_changed_row(' in 'async def _write_expert_change(...'
E  AssertionError: the snapshot said nothing, so the client could not clear the chip   (x2, handler dict — see (c): the wire was already correct)
E  AssertionError: a disabled Expert still hydrated the chip
E  assert 200 == 404
6 failed, 6 passed
```
**GREEN:** 13/13, including the added wire-level test.

### RED (frontend, `ChatArea.expertThread.test.tsx` §(H), driven through the REAL StreamsProvider reconcile)
```
× (15) a reconcile that reads null removes the chip, and coming back does not bring it back
× (16) without a list owner, a null reading still clears the chip
AssertionError: expected <span …(3)>…(5)</span> to be null
Tests 2 failed | 21 passed (23)
```
**GREEN:** 23/23.

**Test (18) was checked to be able to fail.** With the PATCH-answer recording disabled, it fails: `expected 'Financial Analyzer·Biased' to contain 'Contract Reviewer'`. That is exactly the case of a snapshot already in flight putting the old Expert back. The file was then restored.

### Live proof, (a)
Run against the LOCAL stack with no backend restart. The setup was a temporary disabled restricted Expert, a thread bound to it and one user message, all deleted afterwards. The real `_resolve_thread_scoping` was called twice:
```
send 1: refused -> Active expert '…' could not be resolved or is inaccessible; refusing run (fail-closed)
send 2: not refused (the thread no longer has an Expert — a plain run, as designed)
thread.active_expert_id = None
system rows = 1
  org_id == thread org: True | content: HR Advisor (CR-03 probe) left. Now: All your documents. Dropped: Nothing.
  kind: expert_changed | before: {'id': …, 'name': 'HR Advisor (CR-03 probe)', 'scope_mode': 'restricted'} | after: None
temp rows left: 0
```
The supabase-py conditional update returned the cleared row, so exactly one event was written across two sends.

## Verification

### Backend (targeted only; the full baseline is the orchestrator's job)
`test_267_*`, `test_266_*`, `test_268_*`, `test_sql_scope_or_precedence`, `test_260_financial_analyzer_conversation`, `test_260_expert_chat_scoping`, `test_261_expert_runtime_scoping`, `test_264_born_for_carrier`, and integration `test_267_transcript_rows_rls` and `test_268_scope_patch_race`: **501 passed**.

A wider `-k` sweep had one failure, `test_phase56_iteration_start.py::…test_threads_py_emits_iteration_start_at_loop_top`. It is **inherited**: the token it looks for is absent from `threads.py` at base `81d73ba77` too (the grep count is 0 at both base and HEAD).

### Frontend
Run with `GSD_VITEST_MAX_WORKERS=2` over `src/components/chat src/__tests__/providers src/providers src/stores src/components/experts src/__tests__/integration src/__tests__/hooks src/hooks`: **1266 total, 0 failed**. No failing filenames were produced.

### Typecheck (`npx tsc -p tsconfig.app.json --noEmit`), compared as a set diff
- **Base: 70 errors at `81d73ba77`**, not the 67 CLAUDE.md quotes.
- After: 70. The sets are identical except one pre-existing `streamsStore.ts` TS2345 message, whose inline type summary went from "… 13 more …" to "… 14 more …" because the store gained one key. It is the same error, not a new one.

### ESLint
The touched files add no new findings. Every reported line is pre-existing: the `react-refresh/only-export-components` findings in StreamsProvider, `threads.ts:617/987` `any`, and ChatArea `:453`.

## Hot files touched (ledger rows exist for all; row updates left to the orchestrator)
- `backend/app/services/run_producer.py`:
  - `+1` select column (`org_id`);
  - the stale clear gained `.eq(active_expert_id)`;
  - one `if _cleared:` inside the **existing** stale branch;
  - one new private helper `_state_expert_removed`;
  - CR-02 made a one-expression change.
- `backend/app/api/threads.py`:
  - **0 changes to `send_message`**;
  - the snapshot's two conditional arms became unconditional;
  - `_write_expert_change`'s INSERT moved to the shared writer;
  - the import list swapped `event_sentence` for `insert_expert_changed_row`.
- `backend/app/api/experts.py`: one guard in `get_expert`.
- `backend/app/services/expert_scope.py`: one new writer function and one comment correction.
- `frontend/src/components/chat/ChatArea.tsx`: +1 store selector, +2 `useRef`, +1 `useEffect`, 1 recorded PATCH answer, and 1 line in the thread-switch effect.
- `frontend/src/providers/StreamsProvider.tsx`: the import was renamed and one module-level pass-through wrapper added. All three call sites are unchanged, so the 244 fence regex still matches.
- `frontend/src/stores/streamsStore.ts`: one ephemeral slice and one exported writer.
- `frontend/src/lib/api/threads.ts`: one optional field and one mapped key.

**No new send-path branch.** (b) was deferred for exactly that reason.

## Needs an operator backend restart to prove end-to-end
The running uvicorn on :8000 still has the old code. It was not restarted or killed.

**After the operator restarts it:**
1. **CR-02 in the UI.** Start **Financial Contracts Reviewer (UAT-262)**, which is biased with 0 folders, from the catalog. This gives a no-folder thread. Ask a question the org's documents answer. Expect `search_documents` citations, no `scope_violation` event in the run, and ls/tree not empty.
2. **CR-03(a)+(c) in the UI.** Bind HR Advisor (restricted) to a thread with messages. In another tab, as a manager, disable it. Send a message on the thread. Expect:
   - the run fails (fail-closed, unchanged);
   - the transcript gains "HR Advisor left. Now: All your documents. Dropped: Nothing.";
   - the chip disappears without a reload, through the error-terminal snapshot probe;
   - leaving and coming back does not bring it back.
3. **CR-03(d).** As a **member**, call `GET /experts/{disabled id}` and expect 404. As a manager, expect 200 with `is_enabled: false`.

**What works without a restart:** the (c) client half. The running backend already sends `active_expert_id: null` in snapshots and already clears stale Experts at send (the old code). So after a Vite refresh, the chip-clear half of step 2 can be observed now. The transcript row in step 2 needs the restart.

## Deviations from Plan
- **[Rule 1] CR-02's `test_266` pin** asserted the defect (`== ()`). It was corrected beside the original.
- **[Finding partly refuted] CR-03(c) backend half.** The wire already carried `null`, so the fix is client-side. The handler change is cosmetic, and this is recorded rather than claimed as a wire fix.
- **[Scope] CR-03(c) needed StreamsProvider and streamsStore.** Only there is the snapshot read. The changes are minimal: one wrapper and one slice.
- **[Rule 2] CR-03(a) concurrency.** The clear is now conditional on the Expert it read. This prevents clobbering a concurrent PATCH, and it keeps concurrent sends from writing two events.

## Known Stubs
None.

## Self-Check: PASSED
- `backend/tests/unit/test_267_cr02_empty_biased_scope_searches.py`: FOUND
- `backend/tests/unit/test_267_cr03_server_side_expert_clear.py`: FOUND
- commit `a95a19881`: FOUND
- commit `0cbf5d282`: FOUND
