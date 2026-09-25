---
phase: 267-an-expert-adds-scope
plan: 04
subsystem: chat-frontend — every Expert state in the chat
tags: [experts, chat, transcript-event, handoff, invite-dialog, scope-preview, seed-309, tdd, pack-22, pack-23, pack-24, pack-25]
requires:
  - "267-02 wire fixtures backend/tests/fixtures/phase267/*.json; GET /threads/expert-scope-preview; POST /threads/{id}/handoff; PATCH /threads writes expert_changed; allowlisted system rows on the messages/snapshot reads"
  - "267-03 ScopeLedger / LedgerColumn; expertCatalog CONNECTION_COPY, LEDGER_COPY, connectionGate, connectionLedgerColumns, inviteGate; ExpertBundle.connection_state / can_connect"
provides:
  - "frontend/src/components/chat/expertEventCopy.ts — TRANSCRIPT_EVENT_KINDS mirror (?raw cross-pinned), EVENT_COPY, transcriptEventOf, handoffMarkerOf, eventCardModel, handoffEventModel, handoffCardModel, eventTimeLabel"
  - "frontend/src/components/chat/ExpertEventCard.tsx — join / swap / removal Now-Dropped card + the handoff pointer"
  - "frontend/src/components/chat/HandoffCard.tsx — the new thread's first message"
  - "frontend/src/components/chat/threadNavigation.tsx — ThreadNavigationProvider + useThreadNavigation (findThread, openThread, refreshThreads)"
  - "lib/api/threads.ts — ExpertChangedEvent / ExpertHandoffEvent / HandoffMarker / TranscriptScopeLine wire types; createThread(title, folderId?, activeExpertId?); handoffThread(); refusal-preserving throws"
  - "lib/api/experts.ts — ExpertScopePreview + getExpertScopePreview"
  - "expertCatalog.ts — PREVIEW_COPY, LEDGER_COPY.willUse/wontUse/chatAttachments, inviteBlock, previewLedgerColumns"
affects: [267-05]
tech-stack:
  added: []
  patterns:
    - "One vocabulary module renders a stored payload to words; the card draws only what its selector returns"
    - "A context as the no-router door, so a deep transcript leaf navigates without new props on hot files"
    - "One PATCH home: a child REPORTS a choice, the parent writes, reverts on refusal and refetches the event"
key-files:
  created:
    - frontend/src/components/chat/expertEventCopy.ts
    - frontend/src/components/chat/ExpertEventCard.tsx
    - frontend/src/components/chat/HandoffCard.tsx
    - frontend/src/components/chat/threadNavigation.tsx
    - frontend/src/components/chat/__tests__/expertEventCopy.test.ts
    - frontend/src/components/chat/__tests__/ExpertEventCard.test.tsx
    - frontend/src/components/chat/__tests__/HandoffCard.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.transcriptEvent.test.tsx
    - frontend/src/components/chat/__tests__/InviteExpertDialog.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.expertThread.test.tsx
  modified:
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/MessageList.tsx
    - frontend/src/components/chat/InviteExpertDialog.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/experts/catalog/expertCatalog.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/api/experts.ts
    - frontend/src/hooks/useThreads.ts
    - frontend/src/types/index.ts
    - frontend/src/components/chat/__tests__/ComposerExpert.test.tsx
    - frontend/src/lib/api/__tests__/entitlementRefusal.test.ts
    - scripts/vitest-count-gate.cjs
decisions:
  - "getExpertScopePreview and handoffThread are imported from their submodules (the installExpert precedent), so lib/api.ts — the repo's hottest file — is untouched; tests mock at @/lib/api/experts and @/lib/api/threads"
  - "InviteExpertDialog gains an optional currentExpertName so R7/R8 can name the active Expert even when it is not in the loaded list"
  - "Once the server has created the handoff thread, a failed list refresh is logged and the thread is still opened — it never surfaces as R10, whose sentence says nothing was created"
  - "The event card animates only when its payload's `at` is within 15 s of mount (the card has no other live-append signal); a reload of history does not animate"
  - "UI-SPEC additions: 'Same folder: /{name}' on the handoff pointer (D-267-33) and the PATCH-refusal alert line above the composer (server sentence, cleared on the next change)"
metrics:
  duration: "~1h 35m"
  completed: 2026-09-25
  tasks: 3
  commits: 6
---

# Phase 267 Plan 04: Every Expert state in the chat Summary

A persisted `expert_changed` row now renders as one timestamped card whose Now / Dropped words come from the stored payload through one vocabulary module, and it survives reload. A handoff shows a pointer on the source thread (with an Open button only when the target can be opened) and a handoff card on the new thread. The invite dialog states each Expert's cost before it can be accepted: the connection gate, the `Will use` / `Won't use · N` ledger from one preview response, `Replace` / `New chat with …`, an in-flight lock and a refusal that ends "Nothing was created." Every Expert change goes through one PATCH home in ChatArea. An invite on a brand-new chat now travels with the create call, and the chat-send tier refusal is fenced by a test driven red with the 265 review's own plant.

## Commits

| Task | Gate | Commit | What |
|---|---|---|---|
| 1 | RED | `f7d006e7c` | vocabulary / cards / MessageItem early return / MessageList role reads |
| 1 | GREEN | `27888c86e` | expertEventCopy, ExpertEventCard, HandoffCard, threadNavigation, MessageItem, MessageList, wire types, `Message.role` += system |
| 2 | RED | `60e0da421` | InviteExpertDialog R1-R10 suite; ComposerExpert answers the restricted preview |
| 2 | GREEN | `4beb8ac55` | getExpertScopePreview, PREVIEW_COPY / inviteBlock / previewLedgerColumns, the dialog rebuilt around `ExpertRowActions` |
| 3 | RED | `cbbec3d36` | ChatArea wiring suite, entitlementRefusal extension, ComposerExpert re-meaning |
| 3 | GREEN | `0acd7fe73` | createThread + handoffThread + refusal shape, useThreads, ChatArea one PATCH home + handoff, MessageInput, ChatLayout provider, count gate |

## TDD gate compliance

Every task has its `test(267-04)` commit before its `feat(267-04)` commit.

**RED, quoted:**
- **Task 1:** `Test Files 4 failed (4) · Tests 7 failed | 1 passed (8)`. The three new-module suites failed to resolve their imports. The MessageItem suite failed on base behaviour. The clearest case is T-267-41: a non-allowlisted system row rendered as an assistant bubble. `(3) … AssertionError: expected 'Run · 1 stepturn 1✓ done[context trun…' to be ''`. Also `(4) expected 'raw system text\n' to be ''`, and the G-5 fence `expected [] to have a length of 1 but got +0`.
- **Task 2:** `Tests 18 failed | 14 passed (32)` (ComposerExpert's 12 and two InviteExpertDialog characterizations passed on base: R2-wins-over-R3 and R6 invite).
- **Task 3:** `Tests 14 failed | 19 passed (33)`.
  - **D-267-21, driven red on base:** `AssertionError: expected "vi.fn()" to be called with arguments: [ null, 'e-cr' ]`. The create call on base carried no Expert.
  - The fence `expected 'import { useState, useRef, useEffect,…' not to match /setThreadActiveExpert/`.
  - The PATCH refusal: `expected Error: Failed to update thread active exp… to be an instance of ApiError`.
  - `createThread` body: `expected { title: 'New Chat', folder_id: 'f-1' } to deeply equal { title: 'New Chat', …(2) }`.
  - Cases (4) dismiss-PATCHes-once and (6) no-refetch-while-streaming passed on base as characterizations.
- **R265-audit-fixes-06 (SEED-309, D-267-24):** the chat-send case passes on the real code, so it was **driven red by the review's plant**. `entitlementRefusalMessage(body) ??` → `null ??` at `threads.ts:648`: `× chat send names the plan, with status 403 (R265-audit-fixes-06)` · `AssertionError: expected 'Failed to send message' to be 'Your plan doesn't include workflows.…'` · `Tests 1 failed | 12 skipped (13)`. Restored with `git checkout -- frontend/src/lib/api/threads.ts`; `git diff --quiet HEAD -- frontend/src/lib/api/threads.ts` → `RESTORED-CLEAN`.

## Verification

- **Targeted suites (final):** `src/components/chat` + `entitlementRefusal` + `src/components/layout` + `src/components/experts` + `src/__tests__/components/chat` + `src/__tests__/hooks` → **84 files / 976 passed**.
- **Count gate** (once, repo root, `GSD_VITEST_MAX_WORKERS=2`, exit 0). Verdict line, verbatim:
  ```
    total 8951  ·  failed 0  ·  pinned total 8202
  count gate OK — 336/336 pinned files present, no per-file decrease, 0 failing.
  ```
  Per-file counts printed by the gate:

  | Suite | pin |
  |---|---|
  | InviteExpertDialog.test.tsx | 20 (new) |
  | expertEventCopy.test.ts | 19 (new) |
  | ExpertEventCard.test.tsx | 10 (new) |
  | ChatArea.expertThread.test.tsx | 8 (new) |
  | MessageItem.transcriptEvent.test.tsx | 8 (new) |
  | HandoffCard.test.tsx | 3 (new) |
  | entitlementRefusal.test.ts | 4 → 13 |
  | ComposerExpert.test.tsx | 12 (unchanged: cases were re-meant, none added) |

  Arithmetic against 267-03's `8877 · 8125 · 330/330`:
  - **Pinned:** +77 = 68 in the new suites + 9 from the entitlementRefusal pin raise. It closes with no residual. Files 330 → 336.
  - ⚠ **Grand total:** +74 against the +75 new cases (68 + 7). **The −1 residual is recorded rather than explained away.** It lies in an unpinned suite this plan did not edit, the same size as the −1 267-03 recorded. There were no reds, so there were no filenames to capture.
- **tsc set diff** (`npx tsc -p tsconfig.app.json --noEmit | grep "error TS" | sort` against 267-BASELINES §b): **0 errors added.** The set is 70 → 70. The only textual difference is 267-03's two `ExpertAuthoringStudio.tsx` line shifts, `(13,3)` → `(12,3)` and `(42,8)` → `(41,8)`. `Message.role` gaining `"system"` produced no new error anywhere.
- `node scripts/check-hot-file-ledger.cjs 267` → `ledger gate OK — every watched file has a row.` (exit 0).
- **Acceptance greps:**
  - Task 1:
    - `Chat attachments stay readable` / `· new chat` / `Handed off from` appear in no non-test `.tsx`.
    - There is no `dangerouslySetInnerHTML` in the two cards.
    - The `backend/app/models/message.py?raw` cross-pin is present.
  - Task 2:
    - The old tool sentence is gone.
    - `items.length` does not appear in expertCatalog.ts.
    - `function ExpertRowActions` appears 1 time.
    - `Nothing was created` appears in no non-test `.tsx`.
  - Task 3:
    - `setThreadActiveExpert` does not appear in MessageInput.tsx.
    - `onCreateThread(scopeFolderId, activeExpert` appears at ChatArea.tsx:449.
    - `ThreadNavigationProvider` appears 3 times in ChatLayout.tsx.
    - The six suite names appear 14 times in the count gate.

## G-5 — honoured by construction (D-267-23), by arithmetic

Hook counts, measured from source with comments stripped (`useState` / `useEffect` / every `use*(` call), base `de74d1470` → head:

| File | base | head | What changed |
|---|---|---|---|
| `MessageItem.tsx` (FIRES) | 3 / 0 / 7 | **3 / 0 / 7** | ONE early-return block after the last hook: an event goes to `<ExpertEventCard`, a marker to `<HandoffCard`, any other system row to `null`. Pinned by `MessageItem.transcriptEvent.test.tsx` (7) |
| `MessageInput.tsx` (FIRES) | 7 / 5 / 23 | **7 / 5 / 23** | LOST its two PATCH calls and the import, and forwards 3 optional props plus the existing connections door to the dialog |
| `ChatArea.tsx` (FIRES) | 5 / 4 / 29 | 6 / 4 / 33 | Added: +1 `useState` (the refusal line), +1 context read, +2 `useCallback` (`applyExpertChange`, `handleExpertHandoff`), and one optional create argument. There is no Expert branch in the send path |
| `ChatLayout.tsx` (FIRES) | 9 / 5 / 29 | 9 / 5 / 30 | One `useMemo` provider value and one provider wrapper. `onCreateThread={newThread}` is unchanged (signature-compatible) |
| `MessageList.tsx` | — | — | The two role reads now use a module-level `lastTurnIndex` that skips system rows. No prop was added, so the prop pin holds |
| `InviteExpertDialog.tsx` (FIRES) | — | — | Took the named seam: the per-row action area is the one internal `ExpertRowActions`, and the body stays a list |

## Re-derived `commits / phases / lines` (at `0acd7fe73`, CLAUDE.md recipe, 6-digit buckets excluded) — for 267-05's ledger rows

| File | Triple |
|---|---|
| `frontend/src/components/chat/MessageItem.tsx` | 77 / 35 / 1027 |
| `frontend/src/components/chat/MessageList.tsx` | 24 / 11 / 376 |
| `frontend/src/components/chat/InviteExpertDialog.tsx` | 4 / 4 / 614 |
| `frontend/src/components/chat/MessageInput.tsx` | 38 / 19 / 977 |
| `frontend/src/components/chat/ChatArea.tsx` | 79 / 40 / 970 |
| `frontend/src/components/layout/ChatLayout.tsx` | 58 / 29 / 1124 |
| `frontend/src/components/experts/catalog/expertCatalog.ts` | 7 / 3 / 448 |
| `frontend/src/lib/api/threads.ts` | 15 / 9 / 1859 |
| `frontend/src/lib/api/experts.ts` | 9 / 5 / 418 |
| `frontend/src/hooks/useThreads.ts` | 5 / 3 / 65 (**now at 3 phases**) |
| `frontend/src/types/index.ts` | 93 / 72 / 1443 |
| `scripts/vitest-count-gate.cjs` | 254 / 57 / 6168 |
| `frontend/src/components/chat/expertEventCopy.ts` | 1 / 1 / 241 (created) |
| `frontend/src/components/chat/ExpertEventCard.tsx` | 1 / 1 / 197 (created) |
| `frontend/src/components/chat/HandoffCard.tsx` | 1 / 1 / 40 (created) |
| `frontend/src/components/chat/threadNavigation.tsx` | 1 / 1 / 45 (created) |

## UI-SPEC additions (recorded for 267-05 / the verifier)

- **Handoff pointer, `Same folder: /{name}`.** This is the D-267-33 statement, a muted 11px line under `Open`, and its copy is in `EVENT_COPY.sameFolder`. The pointer has no `Here` line when `stays_expert_name` is null.
- **PATCH-refusal alert above the composer** (`data-testid="expert-change-error"`, `role="alert"`, the shipped destructive-box classes). It shows the server's sentence and clears on the next change. The fallback is `The Expert could not be changed.` and is used only when the error carries no message.
- **Handoff generic fallback reason.** `The server did not start the new chat.` is used only when the server's body carries no string `detail`.
- The dialog's list-loading copy is `Loading Experts…`, per UI-SPEC §7.4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] A refresh failure after a successful handoff is not reported as a refusal**
- **Found during:** Task 3
- **Issue:** The plan's order is `handoffThread` → `refreshThreads` → `openThread`. If the refresh rejected, the dialog would show R10, whose sentence says "Nothing was created.", while the server had already created the thread.
- **Fix:** The refresh is wrapped and logged, and the new thread is still opened.
- **Files:** `ChatArea.tsx`. **Commit:** `0acd7fe73`.

**2. [Rule 3 - Blocking] ComposerExpert needed the restricted preview answered**
- **Found during:** Task 2
- **Issue:** Its fixture Expert is `restricted`. After this plan, a restricted row offers no invite control until its preview answers, so every shipped composer case lost its button.
- **Fix:** A `@/lib/api/experts` mock answers the preview with one folder and nothing excluded. In Task 3 the three PATCH assertions were re-meant: the composer reports the choice (`onActiveExpertChange`) and writes nothing. ChatArea.expertThread cases 3 and 4 carry the PATCH. The case count is unchanged at 12.
- **Commits:** `60e0da421`, `cbbec3d36`.

**3. [Interface addition] `InviteExpertDialog.currentExpertName?`**
- R7 and R8 must name the active Expert. The active Expert may be absent from `listExperts(true, true)` (disabled, or a first-party Expert filtered out), so the name comes from the composer's `activeExpert` rather than from the list. It is optional, so no caller breaks.

**4. [Design within discretion] Submodule imports instead of `lib/api.ts` re-exports**
- `getExpertScopePreview` comes from `@/lib/api/experts` and `handoffThread` from `@/lib/api/threads` (the `ExpertCatalogPage` → `installExpert` precedent). This keeps `lib/api.ts` out of this plan. It is not in `files_modified`, and 196-08 measured 249 reds from one added export there. The dialog suite mocks at `@/lib/api/experts`, and because `@/lib/api` re-exports that module, the one mock covers both import paths.

**5. [Approximation] "Live append only" motion**
- Nothing tells the card whether its row arrived live or from a reload. The card animates only when the payload's `at` is within 15 s of mount, a decision made once in a `useState` initializer. A reload of history renders without motion.

**6. [Fallback] Thread folder with no loaded name**
- If `thread.folder_id` is set but the folder is not in the loaded list, the dialog's context line uses `Folder`, the ChatArea header's own fallback. `All your documents` would be false for a folder-scoped thread.

## Known Stubs

None. Every rendered word comes from a stored payload, a server response or a pinned copy module. The row fallback `Specialized domain assistant with scoped access.` is shipped (260) copy that existed before this plan.

## Threat model

- **T-267-40 (XSS):** mitigated. Server names, summary bullets and refusal details render as React text children only. The grep for `dangerouslySetInnerHTML` in both cards returns nothing.
- **T-267-41 (a non-allowlisted system row as a bubble):** mitigated. It was driven red on base: `context_truncated` rendered as `Run · 1 step … [context truncated …]`. It now renders nothing (MessageItem cases 3 and 4).
- **T-267-42 (double handoff):** mitigated. The `inFlightRef` lock blocks a second click, the button is disabled with `aria-busy`, sibling actions carry `aria-disabled` and ignore clicks, the dialog ignores Esc and close, and the server design is a single request (dialog case 18).
- **T-267-43 (scoped first run lost):** mitigated. The create call carries `active_expert_id`, driven red on base. The server gate is 267-02's.
- **T-267-44 (Connect shown to a caller who cannot connect):** mitigated. It renders only when `gate.action` (the server's `can_connect`) is set and a door is wired. A member gets the ask sentence (dialog cases 5 and 6).
- **T-267-45 (kind-list drift):** mitigated. The `?raw` cross-pin against `backend/app/models/message.py` is expertEventCopy case 1.
- **T-267-46 (Open to a deleted or foreign thread):** mitigated. `findThread` resolves only from ChatLayout's loaded list. A missing thread renders `… · deleted` with no control, and outside a provider there is no control (card cases 8-10).

No new endpoint, auth path or schema change. The two new client calls hit the 267-02 routes the threat register already covers.

## Notes for 267-05

- **Live UAT owed (G-4 #2 / #3).** The refetch after a successful PATCH calls `loadMessages(thread.id)`. Whether StreamsProvider's merge keeps a `role: "system"` row exactly once, across a later snapshot reconcile, is proven here only with `useMessages` mocked. The real merge path should be checked on the live board: the event appears without reload, stays once after reload, and a later run's reconcile does not duplicate it.
- `useThreads.ts` now measures **3 phases** (5 / 3 / 65). Its ledger row should be re-read.
- `graphify update .` was not run. This plan is frontend-only and the orchestrator owns the post-merge graph refresh.

## Self-Check: PASSED

- All ten created files exist on disk (the 4 leaves and the 6 suites).
- All six commits are present in `git log de74d1470..HEAD`: `f7d006e7c`, `27888c86e`, `60e0da421`, `4beb8ac55`, `cbbec3d36`, `0acd7fe73`.
- STATE.md, ROADMAP.md, docs/HOT-FILE-LEDGER.md and CLAUDE.md are untouched by this plan. `.mcp.json`, `graphify-out/`, `scratch/` and `screenshots/` were never staged.
