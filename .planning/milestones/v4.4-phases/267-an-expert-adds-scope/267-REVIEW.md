---
phase: 267-an-expert-adds-scope
reviewed: 2026-09-26T00:00:00Z
depth: standard
diff_base: 785c03274
files_reviewed: 33
files_reviewed_list:
  - backend/app/api/experts.py
  - backend/app/api/threads.py
  - backend/app/dependencies.py
  - backend/app/models/expert.py
  - backend/app/models/message.py
  - backend/app/models/thread.py
  - backend/app/services/agent_loop.py
  - backend/app/services/expert_authoring.py
  - backend/app/services/expert_scope.py
  - backend/app/services/expert_service.py
  - backend/app/services/run_producer.py
  - backend/app/services/thread_handoff.py
  - backend/app/services/tool_dispatcher.py
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/ExpertEventCard.tsx
  - frontend/src/components/chat/HandoffCard.tsx
  - frontend/src/components/chat/InviteExpertDialog.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/components/chat/expertEventCopy.ts
  - frontend/src/components/chat/threadNavigation.tsx
  - frontend/src/components/experts/ExpertAuthoringStudio.tsx
  - frontend/src/components/experts/ScopeLedger.tsx
  - frontend/src/components/experts/catalog/ExpertCard.tsx
  - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
  - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
  - frontend/src/components/experts/catalog/expertCatalog.ts
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/hooks/useThreads.ts
  - frontend/src/lib/api/experts.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/types/index.ts
findings:
  critical: 2
  warning: 9
  info: 8
  total: 19
status: fixed
fix_outcomes:
  fixed: 13
  refuted: 0
  deferred: 6
---

# Phase 267: Code Review Report

**Reviewed:** 2026-09-26
**Depth:** standard (diff `785c03274..HEAD`, with the call sites the diff depends on read in full)
**Files Reviewed:** 33
**Status:** issues_found

## Summary

The backend half holds up on most of the checks the phase set for itself:

- **Tenancy on writes.** `org_id` is set explicitly on every new `messages` and `threads` insert. The event and handoff writes run on one user-JWT asyncpg transaction (`get_user_pg_connection` opens `conn.transaction()`). IDOR checks on `thread_id` come before any other read in the preview, PATCH and handoff routes.
- **Transcript allowlist.** It is a real allowlist (`_visible_transcript_rows`), and `_reconstruct_history` drops the same kinds before any model sees them.
- **Tool union.** The tool filter and both constants are deleted. `agent_loop.py` gains only neutrally named, default-`None` fields and has no Expert branch.
- **Blocking I/O.** Every new supabase-py call is wrapped in `aexec`, and `load_user_settings` goes through `run_in_threadpool`.

The defects are in two places:

1. **The frontend never reconciles the thread's bound Expert after a change.** The chip goes back to the Expert the server no longer has and contradicts the transcript event this phase added (CR-01).
2. **The "one fail-closed binding gate" does not check whether an admin has disabled the Expert** (CR-02). Two new doors, POST /threads and the handoff, now inherit that gap.

Other gaps: the handoff can put an Expert into a thread in a different org from the one it was gated in; a refused create on a brand-new chat silently loses the first message; and several honesty statements (D-267-19, D-267-35, and D-267-18 on a new chat with a folder) are hidden or missing in states the decisions name.

## Critical Issues

### CR-01: After a swap or remove, the thread list keeps the old `active_expert_id`, so the chip shows the wrong Expert when the user comes back

**File:** `frontend/src/components/chat/ChatArea.tsx:502-525` (writer) and `:250-268` (hydration). Related: `frontend/src/hooks/useThreads.ts`, `frontend/src/components/layout/ChatLayout.tsx:160-168`.

**Issue:**
- `applyExpertChange` is documented as "THE ONE HOME of every Expert change". It PATCHes the thread and then **throws away the returned `Thread`** (`await setThreadActiveExpert(tid, next?.id ?? null)`).
- Nothing updates `useThreads`' `threads` or `selectedThread`. The hook has no updater for `active_expert_id`. The snapshot's `active_expert_id` is also never read: grepping `frontend/src` finds `active_expert_id` only in `types`, `ChatArea` and the create path.
- The hydration effect is keyed on `[thread?.id, thread?.active_expert_id]`.

Sequence: swap A → B on thread T, open thread U, come back to T. `selectThread` passes the stale list object (`active_expert_id = A`), and the effect calls `getExpert(A)` and shows A as active. Meanwhile:
- the server has B;
- the next run is scoped to B;
- the transcript directly above shows the persisted "A → B" event card.

Removing an Expert and coming back re-shows the removed Expert the same way. After this the dialog is wrong too:
- A renders as "Active", and "Replace A" is offered for B, the Expert that is actually bound.
- The user cannot re-invite A without first dismissing the phantom chip, which PATCHes `null` and writes a spurious "B left" event.

PACK-23's premise is that the product states the thread's scope truthfully. After this sequence the composer states the wrong one. The bug existed before 267, but 267 made this the single write path and added the event that now visibly contradicts the chip.

**Fix:** Write the server's answer back into the thread list (and into the selected thread):
```ts
// useThreads: add
const patchThread = useCallback((updated: Thread) => {
  setThreads((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
  setSelectedThread((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
}, [])

// ChatArea.applyExpertChange
const updated = await setThreadActiveExpert(tid, next?.id ?? null)
onThreadUpdated?.(updated)   // wired to patchThread by ChatLayout
```
Alternatively, have the snapshot's `active_expert_id` drive the hydration effect (it is already returned and never read), which also reconciles changes made in another tab.

### CR-02: The binding gate does not check `expert_bundles.is_enabled`, so a disabled Expert can still be bound and run by id

**File:** `backend/app/api/threads.py:718-747` (`assert_expert_bindable`). Called from `:765` (POST /threads), from PATCH, and from `:1067` (handoff).

**Issue:**
- `assert_expert_bindable` calls `get_expert_service` → `experts_db.get_expert_bundle_by_id`, which filters only `is_system OR org_id = $2`, then `check_expert_grant_access`, which checks only visibility and grants. Neither reads `is_enabled`. Measured in `backend/app/db/experts.py:147-165` and `:309-340`.
- `resolve_expert_bundle` (the run path) uses the same fetch.
- R265-262-07 made the list hide disabled Experts from non-managers (`enabled_only=True`), but anyone holding the id (from an old thread, the URL of the detail call, or a colleague) can still bind a disabled Expert through all three doors, and runs keep using it.

D-267-31 describes this helper as THE fail-closed gate. An admin's "disable" toggle, which is the administrative kill for a broken or leaking Expert, is not enforced by it. This phase added two new doors (POST /threads, handoff) that widen the reach of the gap.

**Fix:** Refuse disabled bundles in the gate, and in the resolver so already-bound threads stop running them:
```python
bundle = await get_expert_service(...)
if not bundle or not bundle.get("is_enabled", True):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                        detail="Expert bundle not found or access denied")
```
Do the same in `resolve_expert_bundle` (return `None`), which already makes `_resolve_thread_scoping` clear the stale id and refuse the run. Add a unit case per door.

## Warnings

### WR-01: If a new chat's create is refused, the first message is lost silently and nothing reports the error

**File:** `frontend/src/components/chat/ChatArea.tsx:443-449`, `frontend/src/components/chat/MessageInput.tsx:382-395`

**Issue:** D-267-21 routes the invited Expert through `createThread`, and `POST /threads` now runs the binding gate. That gate can refuse with 403 ("Choose an organization…"), a tier refusal, or a 404 if access was revoked since the invite. `handleSend` is `async` and `await onCreateThread(...)` rejects, but:
- `MessageInput.handleSend` calls `onSend(trimmed, activeConnectorIds)` **without awaiting or catching**;
- it then clears the textbox, clears attachments and deletes the draft.

So the rejection is unhandled, the typed message is gone, and the server's refusal sentence (which `throwThreadRefusal` was added to preserve) is shown nowhere. Before 267 this create almost never failed. Now it fails on ordinary gate outcomes.

**Fix:** Catch the rejection in `ChatArea.handleSend` around `onCreateThread`, surface `err.message` in `expertChangeError` (or the existing failed-send draft stash), and return before sending. Also have MessageInput clear the draft only after `onSend` resolves, or stash the draft on failure.

### WR-02: The Expert-change error banner stays up on other threads

**File:** `frontend/src/components/chat/ChatArea.tsx:122`, `:607-617`

**Issue:** `expertChangeError` is cleared only by the next `applyExpertChange`. The `[thread?.id]` reset effect (`setAgentMode` / `setScopeFolderId`) does not clear it. A refusal on thread A (for example "Choose an organization before inviting an Expert.") keeps rendering as a `role="alert"` above the composer after switching to B, C and so on, where it is false.

**Fix:** Add `setExpertChangeError(null)` to the `useEffect(..., [thread?.id])` that already resets per-thread composer state.

### WR-03: The handoff gates the Expert against the active org but stamps the new thread with the source thread's org

**File:** `backend/app/api/threads.py:1067` (gate result `_org_id` discarded), `backend/app/services/thread_handoff.py:195`

**Issue:** `list_threads` returns the user's threads from every org they belong to, so a two-org user can open a thread from org A while their active org (X-Org-Id) is B. The handoff then:
- checks the `experts` entitlement and Expert access in **B**;
- writes the new thread, its handoff row and the source event with `org_id = source.org_id` (**A**), and copies A's `folder_id`.

The result is an Expert bundle that may belong to B, bound inside an A thread, and an org A that may not hold the `experts` entitlement at all: a tier bypass through the handoff door. `POST /threads` stamps the gate's org, so the three doors D-267-31 wanted to agree do not.

**Fix:** In `handoff_thread`, refuse when `str(source["org_id"]) != _org_id` (409, "Switch to this chat's organization to hand it off."), or gate against `source["org_id"]` after checking membership. Apply the same rule to the PATCH door, where the thread's org is also never compared with `bound_org_id`.

### WR-04: An Expert change during a streaming run is recorded above the answer the previous Expert produced

**File:** `backend/app/api/threads.py:938-1003` (event insert, `created_at = now()`), `backend/app/services/agent_loop.py:1955` (the assistant row is inserted at run end)

**Issue:** The composer lets the user change the Expert while a run is streaming; `applyExpertChange` explicitly skips the refetch "while THIS thread is streaming". The event row is inserted immediately, but the streaming assistant message is persisted only when the run finalizes. After the run-end reconcile or a reload, the transcript (ordered by `created_at`) reads:
1. user question;
2. "A → B · Now: B's folders";
3. the answer, which was retrieved and written under A's scope.

The event's `Now` line therefore sits directly above an answer it does not describe. This is the PACK-23 honesty failure in reverse.

**Fix:** Refuse Expert changes while the thread has an active run (409 when `runs_by_thread` or `runs.status='streaming'` exists for the thread), or hide the invite control while streaming. Alternatively, write the event with `created_at` equal to the active run's `completed_at` at finalize, but refusing is simpler and matches "From your next message".

### WR-05: Scoped connection admission ignores `status`, so revoked or errored connections of the same service are advertised

**File:** `backend/app/services/agent_loop.py:1719-1720`

**Issue:** The resolver approves a key if **any** connection with that `service_id` is `is_enabled AND status='active'` (`connection_states`). The loop then admits **every** `is_enabled` connection whose `service_id`/`capability` matches, including rows with `status IN ('revoked','error')`. Their tools are advertised to the model and fail at call time, and a revoked OAuth connection is offered again as if it were live. The comment on the RunContext field ("re-checked `is_enabled` at admission") states the weaker check as if it were sufficient.

**Fix:**
```python
active_conns = [c for c in conns if (str(c.id) in allowed_ids or ((c.service_id in scoped_keys or c.capability in scoped_keys) and getattr(c, "status", "active") == "active")) and c.is_enabled]
```
Keep it on one line; `test_chat_connector_scoping.py` compiles this line.

### WR-06: D-267-35's statement is missing on the threads the decision names

**File:** `frontend/src/components/chat/InviteExpertDialog.tsx:158-205` (no statement for biased rows), `backend/app/api/threads.py:969-971` (the event requires ≥ 1 message)

**Issue:** D-267-35 keeps the "biased on an unscoped thread narrows to the Expert's folders" behaviour on the condition that it is **stated** as `Dropped: All your documents`, "in the event card and the ledger", and names catalog Start Chat as the example. However:
- A catalog Start Chat thread is empty when the Expert is bound, so D-267-12 writes no event.
- The invite dialog renders no ledger for biased rows (`previewStatement` returns `null` when not restricted).
- `D-267-35` appears nowhere in `frontend/src`.

So on exactly the threads the decision names, the narrowing happens with no statement anywhere.

**Fix:** Have the preview route serve biased Experts as well. `describe_expert_scope` already computes `all_documents`. When `mode == 'biased'` and the thread has no folder, render a `Won't use · All your documents` column in the dialog's ledger, and add the same line to the spotlight card for an empty thread.

### WR-07: On a brand-new chat with a folder picked, the restricted preview ignores that folder, so "Won't use" is missing

**File:** `frontend/src/components/chat/ChatArea.tsx:606-610`, `frontend/src/components/chat/InviteExpertDialog.tsx:369-385`, `backend/app/api/threads.py:788-829`

**Issue:** Before the first message, `dialogFolderId` is `scopeFolderId`, so the dialog's context line reads "This chat · /HR". But `getExpertScopePreview(expertId, threadId ?? null)` sends no thread and the route has no `folder_id` parameter. The preview is therefore computed as if the chat had no folder: `excluded_count = 0` and no `Won't use` column. The thread `handleSend` then creates **does** carry that folder, and the restricted run excludes its documents. D-267-18's "states only what it reads" carve-out covers a new thread **with no folder**, not this one.

**Fix:** Add an optional `folder_id` query parameter to `/expert-scope-preview`, used only when `thread_id` is absent. Check the caller can see the folder with `fetch_visible_folders` and return 404 otherwise. Pass `scopeFolderId` from the dialog when there is no thread.

### WR-08: D-267-19's "Chat attachments" line is folded into "and k more" when an Expert has five or more folders

**File:** `frontend/src/components/experts/catalog/expertCatalog.ts:434-441`, `frontend/src/components/experts/ScopeLedger.tsx:40,44-46`

**Issue:** `previewLedgerColumns` appends `Chat attachments` **after** the Expert's folders, and `ScopeLedger` shows only `LEDGER_VISIBLE = 5` items. An Expert with five or more knowledge folders therefore never shows the attachments promise; it becomes part of "and 1 more". The statement D-267-19 requires is invisible at rest, which is the 266 UI-3 failure this phase fences against.

**Fix:** Put `Chat attachments` first in the `Will use` column, or render it as a fixed footer line of the ledger outside the truncated list.

### WR-09: The handoff pointer says "· deleted" when it only knows the thread is not in the loaded list

**File:** `frontend/src/components/chat/ExpertEventCard.tsx:152-169`, `frontend/src/components/layout/ChatLayout.tsx:160-168`

**Issue:** `findThread` resolves only from the in-memory `threads` array. The pointer renders `"{title} · deleted"` whenever the target is missing from it, which also happens when:
- the list is still loading on first paint (`threads` starts `[]`);
- the handoff was made in another tab or session and this list has not been refreshed;
- the initial load failed, so its 2 s retry has not landed yet.

Each case asserts a deletion that did not happen. The docblock's own rule ("a thread it does not hold is rendered as words, never as a control") is satisfied by the plain title; the "deleted" claim goes further than the evidence.

**Fix:** Render the plain title, not the deleted label, when the target is absent. Reserve "deleted" for a confirmed 404 from `GET /threads/{id}`, or drop the deleted wording altogether.

## Info

### IN-01: The transcript-kind predicate is written twice

**File:** `backend/app/api/threads.py:527-536`, `backend/app/services/agent_loop.py:1022-1032`

**Issue:** The allowlist constant has one home, but the "first `tool_calls` entry's `kind`" extraction is spelled once in `_transcript_kind` and again inline in `_reconstruct_history`. If the discriminator shape ever changes, one copy can drift and let a transcript-only row reach a model.

**Fix:** Move `transcript_kind(row)` next to `TRANSCRIPT_EVENT_KINDS` in `models/message.py` and import it in both places (the name has no "expert", so the AST fence allows it).

### IN-02: The "Active" pill re-sends a PATCH

**File:** `frontend/src/components/chat/InviteExpertDialog.tsx:208-225`

**Issue:** The R1 "Active" control has `onClick={guard(onInvite)}`, which PATCHes the same Expert and triggers a `loadMessages` refetch.

**Fix:** Make the pill inert (no `onClick`), or close the dialog only.

### IN-03: The dialog shows a placeholder as if it were the folder's name

**File:** `frontend/src/components/chat/ChatArea.tsx:606-610`

**Issue:** When a folder id does not resolve, `?? "Folder"` renders "This chat · /Folder", which reads like a real folder name.

**Fix:** Use the shipped unnameable phrase (`UNNAMEABLE_FOLDER`).

### IN-04: A second catalog start is dropped with no feedback

**File:** `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx:133-148`

**Issue:** While a start for Expert A is in flight, clicking Start on Expert B returns silently. B's button shows no busy state and is not disabled.

**Fix:** Pass `startBusy={startingId !== null}` to every card, or show that another start is in progress.

### IN-05: The Expert's member skills are listed after the trim notice

**File:** `backend/app/services/agent_loop.py:1590-1595`

**Issue:** When the catalog is over budget, `build_skill_catalog_block` ends with the `_[N additional skill(s)…]_` marker, and the member-skill lines are appended after it. The model reads them as sitting past the "not listed" notice.

**Fix:** Insert the member-skill lines before the trim marker, or build them into the block.

### IN-06: The preview's TypeScript type claims the folder name is always a string

**File:** `frontend/src/lib/api/experts.ts:250-258`

**Issue:** `thread_folder.name` is typed `string`, but `ScopePreviewThreadFolder.name` is `str | None` on the server.

**Fix:** Type it `string | null`.

### IN-07: Handoff threads open with two consecutive user turns, and this has not been checked per provider

**File:** `backend/app/services/thread_handoff.py:223-231`

**Issue:** The handoff marker row is `role='user'` with no assistant reply, so the new thread's first run sends user → user. Anthropic merges consecutive user turns and Gemini accepts them. Some OpenAI-compatible reasoning endpoints have documented rejecting successive same-role messages, and no merge step exists in `_reconstruct_history` or the adapters. D-267-15 claims every provider receives the summary identically.

**Fix:** Add a handoff-thread row to the SC#10 board per provider, or merge adjacent user turns at the adapter boundary.

### IN-08: Two quick Expert changes can revert to the wrong Expert

**File:** `frontend/src/components/chat/ChatArea.tsx:502-518`

**Issue:** `previous` is captured from the closure. If two changes overlap and the first is refused, the chip reverts to an Expert that the second change has already replaced.

**Fix:** Keep an in-flight ref and drop or serialize changes while one is pending, as the handoff path does.

---

## Fix outcomes

Applied 2026-09-26 on `develop`, base `58de046f3`, main working tree. Each finding was driven RED before it was fixed: a `test(267-review): RED — …` commit that fails on base for the reason the finding states, then a `fix(267-review): …` commit. **No finding was refuted.** All 2 Critical and 9 Warning findings are fixed. Two Info findings met the "≤ 5 lines and obviously safe" bar and are fixed. The other six Info findings are deferred, each with its reason below.

`status: fixed` means every Critical and Warning is closed. The six deferred items are Info.

| Finding | Outcome | RED → fix | What changed |
|---|---|---|---|
| **CR-01** stale `active_expert_id` in the thread list | **fixed** | `e9dc1c6ed` → `00b61552c` | `useThreads.patchThread` (list + selection). ChatArea's one change home passes the PATCH's returned `Thread` to a new optional `onThreadUpdated`, and ChatLayout wires it. RED drove the real `useThreads` + real ChatArea through swap A→B on T, open U, back to T; a source check pins ChatLayout's wiring. |
| **CR-02** disabled Expert bindable | **fixed** | `774ca3766` → `0e55d3465` | `assert_expert_bindable` refuses `is_enabled = false` with its existing 404 sentence, which covers PATCH, POST /threads and the handoff. `resolve_expert_bundle` returns `None`, so the run clears the id and refuses (fail-closed). There is one case per door plus the resolver. |
| **WR-01** refused create loses the message | **fixed** | `975e400b6` → `8c3f4a16a` | ChatArea catches the refused create, shows the server's sentence in the existing `role="alert"` line, and resolves `false`. MessageInput puts the text back and keeps the draft when a send resolves `false`. There are no attachments to lose: `useComposerAttachments` refuses them without a thread. |
| **WR-02** refusal banner follows to other threads | **fixed** | `5bdf5beaa` → `8197ddda9` | One line in the per-thread reset effect. |
| **WR-03** handoff gated in active org, written into source org | **fixed** | `aa234d182` → `0c24b42d9`, `448d877cf` | **Chose refuse over re-gate.** Handoff answers 409 "Switch to this chat's organization to hand it off." and PATCH answers 409 "Switch to this chat's organization to invite an Expert." when the thread's org ≠ the gate's org. Gating against the source org would need a second membership check; refusing keeps one gate, one org, and D-267-34's thread-org stamping unchanged (`threads.org_id` is NOT NULL, so the comparison is strict). Three suites' fixtures pinned the mismatch (the handoff fixture deliberately set `SOURCE_ORG ≠` the gate's org; the 261 scenario row had no `org_id`). They now carry the thread's own org, and the active org stays different, so D-267-34 is still discriminated. |
| **WR-04** change during a stream lands above the old answer | **fixed** | `97db13f8a` → `0e1954323` | **Chose refuse, not re-time the event.** PATCH answers 409 "Wait for this answer to finish before changing the Expert." when the value changes and a primary run is `streaming` (the snapshot's own predicate, sub-agents excluded). ChatArea's one change home refuses the same state before any PATCH, showing the reason in the existing alert line; the chip does not move. ChatArea case (6) had pinned the defect as a success and was replaced. |
| **WR-05** scoped key admits revoked/errored connections | **fixed** | `97e6bad8f` → `ca559d4de` | The admission line (still one line, compiled by `test_chat_connector_scoping.py`) requires `status == 'active'` on the scoped-key arm; switched-on ids are unchanged. No name containing "expert" was added to `agent_loop.py`. |
| **WR-06** D-267-35 not stated on unscoped threads | **fixed** | `16038a31e` → `654dc74db` | **Stating only; retrieval unchanged.** The new pure selector `narrowingLedgerColumns(preview)` gives `Will use` (the Expert's folders + Chat attachments) and `Won't use` (All your documents). It returns `null` unless the preview is biased, has no thread folder, and has folders. The invite dialog previews a biased row only on a chat with no folder and renders that statement without ever blocking the invite. `ExpertSpotlightCard` gains an opt-in `unscopedChat` prop that reads the same preview, and ChatArea sets it on the empty-thread and welcome mounts (the catalog Start Chat door, where D-267-12 writes no event). |
| **WR-07** new chat's folder ignored by the preview | **fixed** | `de7ae168a` → `3e6a5cc32` | `GET /threads/expert-scope-preview` takes an optional `folder_id`. It is read only without a `thread_id` (the thread's own folder wins), and only for a folder in `fetch_visible_folders`; any other folder gets a 404 "Folder not found" before the gate or any statement. The client sends it only without a thread, and ChatArea forwards the folder id through MessageInput to the dialog. |
| **WR-08** Chat attachments folded into "and k more" | **fixed** | `5e1293c64` → `01b22550a` | `LedgerItem.pinned`: pinned items are never counted into the overflow and render after the truncated list. UI-SPEC §5.3's order (folders, then Chat attachments) is kept. |
| **WR-09** "· deleted" claimed without evidence | **fixed** | `3acd60ed6` → `2acc8d505` | An unfound target renders its plain title and no control. The `· deleted` copy and `deletedLabel` are removed, not left looking live. ExpertEventCard case (9) had pinned the defect and was replaced. |
| **IN-02** Active pill re-PATCHes | **fixed** | `87107946f` → `7b9e64892` | The pill is a `<span>` (same classes and test id), not a button wired to `onInvite`. |
| **IN-06** `thread_folder.name` typed `string` | **fixed** | `d20785a92` → `40a524d1c` | Now `string \| null`. A `?raw` fence reads both the server model and the client type, since a type mismatch has no runtime symptom. |
| **IN-01** transcript-kind predicate spelled twice | **deferred** | none | This is a refactor across `threads.py` and `agent_loop.py` (G-5 hot files), more than 5 lines. Re-open trigger: the next change to the transcript discriminator shape. |
| **IN-03** `?? "Folder"` placeholder | **deferred** | none | The one-line swap to `UNNAMEABLE_FOLDER` would render "This chat · /a knowledge folder you cannot see" (the context line adds the `/`), which is a copy decision, not an obviously safe fix. It needs a UI-SPEC ruling on the unnameable context line. |
| **IN-04** second catalog start dropped silently | **deferred** | none | Passing `startBusy` to every card changes every card's busy rendering; that is more than a line and not obviously safe. Re-open with the catalog surfaces' next phase. |
| **IN-05** member skills listed after the trim notice | **deferred** | none | This is a prompt-assembly change in `agent_loop.py` (an owed seam, D-267-23), more than 5 lines. |
| **IN-07** handoff user→user turns unverified per provider | **deferred** | none | This needs the live SC#10 per-provider board (operator-driven UAT), not a code fix. It is owed as a handoff-thread row on that board. |
| **IN-08** overlapping Expert changes revert wrongly | **deferred** | none | An in-flight ref plus serialization is more than 5 lines. WR-04's streaming refusal narrows the window but does not close it. |

**Gates (after all fixes, `develop` at `c7c452fd2`):**
- Backend unit baseline: `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` (71 failed, 5839 passed, 1 skipped, 2 xfailed, 2 xpassed). All 8 backend test files this work touched pass (130/130). The 71 are inherited: for example, `test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses` fails identically with the committed `agent_loop.py`, and the `threads.py` source-grep rot (`_persist_assistant_message`, `event_consumer`, `iteration_start`) predates the phase.
- Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, repo root): `count gate OK — 336/336 pinned files present, no per-file decrease, 0 failing.` (total 8969, pinned total 8221). There are no new suite files; five pins were raised to the printed counts (`c7c452fd2`), and two of them had lagged their files by 1 and 2 before this work.
- Frontend typecheck `npx tsc -p tsconfig.app.json --noEmit`: **70 errors, the same set as base** (set diff empty).
- Fences: the `agent_loop.py` AST fence (no `expert` name, no `if expert:`) and `expert_service.py`'s no-LLM-import fence both stay green (`test_259_closed_core_inventory`, `test_264_*`, `test_267_tool_floor_union`, `test_267_handoff`).

_Fixes applied: 2026-09-26 · Fixer: Claude (gsd-code-fixer)_

_Reviewed: 2026-09-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
