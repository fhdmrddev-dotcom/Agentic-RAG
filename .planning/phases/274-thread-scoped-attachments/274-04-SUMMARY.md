---
phase: 274-thread-scoped-attachments
plan: 04
subsystem: frontend / chat attachment chip + panel Files row + Save to Library mounts
tags: [chat, attachment, promote, library, panel, a11y, listbox, polling, copy-port, phase-274, att-01, att-02, att-03]
requires:
  - "274-03: SaveToLibraryDialog, FolderPathListbox, saveToLibraryCopy, lib/api/attachments, lib/attachmentLifetime"
  - "274-01/02 wire contract: expires_at null = thread-life; GET .../library-links (mocked here; 274-05 drives it live)"
provides:
  - "components/attachments/useLibraryLinks.ts — per-thread store: one fetch, 4 s poll only while indexing"
  - "components/attachments/LibraryLinkSegment.tsx — In Library / Already in Library · leaf|path · indexing…|couldn't index"
  - "components/attachments/AttachmentActionsMenu.tsx — the ⋯ + menu + ONE dialog mount, requestAttachmentMenu bus"
  - "components/attachments/AttachmentRowTrailing.tsx — the panel row's trailing slot (thread-life vs TTL)"
  - "components/attachments/folderDisplay.ts — the sketch's ` › ` path spelling (display only)"
  - "components/attachments/__tests__/composerNoLibraryDoor.test.ts — the D-18 composer fence"
affects:
  - "274-05 drives the mounted flow live (G-4) and fences the library-links contract"
tech-stack:
  added: []
  patterns:
    - "module-scoped store read through useSyncExternalStore, fetch-not-Realtime, interval keyed on a derived boolean"
    - "a wrapper that stops click/key bubbling so portal events never reach a listbox option's handlers"
    - "the panelOpenSignal bus shape for opening a specific row's menu from the row's key arm"
key-files:
  created:
    - frontend/src/components/attachments/folderDisplay.ts
    - frontend/src/components/attachments/useLibraryLinks.ts
    - frontend/src/components/attachments/LibraryLinkSegment.tsx
    - frontend/src/components/attachments/AttachmentActionsMenu.tsx
    - frontend/src/components/attachments/AttachmentRowTrailing.tsx
    - frontend/src/components/attachments/__tests__/useLibraryLinks.test.tsx
    - frontend/src/components/attachments/__tests__/AttachmentActionsMenu.test.tsx
    - frontend/src/components/attachments/__tests__/AttachmentRowTrailing.test.tsx
    - frontend/src/components/attachments/__tests__/composerNoLibraryDoor.test.ts
  modified:
    - frontend/src/components/attachments/FolderPathListbox.tsx
    - frontend/src/components/attachments/SaveToLibraryDialog.tsx
    - frontend/src/components/attachments/__tests__/FolderPathListbox.test.tsx
    - frontend/src/components/attachments/__tests__/SaveToLibraryDialog.test.tsx
    - frontend/src/components/chat/ChatAttachmentChip.tsx
    - frontend/src/components/chat/composerCopy.ts
    - .planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js
    - frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "Folder paths are DISPLAYED with the sketch's ` › ` everywhere on the attachment surfaces (list, dialog sentences, segment title, panel row) through one formatter; folderPathOf stays /-joined for its other callers; the list's search also matches a typed /"
  - "The segment's saved mark is the lucide Check glyph (the sketch draws an svg check, not a text ✓); already uses the Copy glyph, as the sketch does"
  - "Before the first library-links answer the store reports promotable: true — it makes no refusal it has not been told; the dialog preview and the minter stay authoritative"
  - "Only a SENT chip subscribes to the store (useLibraryLinks(effective === 'sent' ? thread : null)), so a pending composer chip never fetches"
  - "AttachmentActionsMenu wraps its trigger, menu and dialog in a span that stops click/keydown bubbling: React events bubble through portals, so a Space in the dialog's folder search would otherwise hit the panel option's handler and open the file preview mid-pick"
  - "Closing the panel row's menu returns focus to the row (the trigger is tabIndex -1), not to the trigger"
metrics:
  duration: "~75 min"
  completed: 2026-10-05
  tasks: 3
  files: 20
---

# Phase 274 Plan 04: Save to Library on the chip and the panel row Summary

The sent attachment chip and the panel's Files row now both carry an always-visible `⋯`. It opens
the one Save-to-Library dialog. After a save the chip shows `In Library · <leaf>`, or
`Already in Library · <leaf>`, and the panel row shows the full path. Each mark says
`· indexing…` while the document is being processed and `· couldn't index` if processing failed.
Chat attachments no longer promise `24h`, and the expired copy is now true. The composer is fenced
as having no Library door.

## What was built

**Pre-task: the sketch's path separator (orchestrator note; deviation fix for 274-03 #3)**
- `folderDisplay.ts` holds the one display formatter (`folderPathParts`, `folderDisplayPath`,
  `FOLDER_PATH_SEPARATOR = " › "`). It walks folder names rather than splitting the `/` string, so
  a folder whose name contains `/` stays one segment. A folder this person cannot see gives `null`.
- `FolderPathListbox` shows `Suppliers › Meridian › Pricing`, with parents dim and the leaf bold.
  Search matches the displayed path or the `/` path, so a typed `/` still finds a folder.
- `SaveToLibraryDialog` uses the same spelling in the version warning, the already-body, the
  picked-elsewhere line and the folder chip.
- `folderPathOf` (`scopeCopy.ts`) is unchanged. The scope chip, `DocumentRow` and `FindQuickAdd`
  still read it.
- The 274-03 tests were updated to the drawn spelling, plus one case for the separator and
  `/`-tolerant search.

**Task 1: the store, the segment and the menu (D-09, D-11, D-13, D-22, D-23, D-25)**
- `useLibraryLinks`: a module-scoped `Map<threadId, Entry>` read through `useSyncExternalStore`.
  The first subscriber fetches `getLibraryLinks` and `listFolders` together, and later subscribers
  share that answer. The fetch is deduplicated while in flight, so StrictMode's double-subscribe
  makes one request.
  - `INDEXING_POLL_MS = 4000`. The interval exists only while some link is
    `pending | processing | paused`, and it is cleared on `completed`, on `failed`, or when the
    last subscriber leaves.
  - A rejected poll keeps the previous state.
  - `refreshLibraryLinks` chains behind any fetch already in flight, so a fetch that started
    before the promote cannot hide the new link.
  - It uses fetch, never Realtime: `grep -c "supabase\|\.channel("` → 0.
- `LibraryLinkSegment`: green `bg-success/15 text-success` with a Check glyph for saved, primary
  with a Copy glyph for already.
  - `title` and the accessible name carry the full path. With no navigator the segment is plain
    text, and the full path is spoken from `sr-only` text, because a generic span may not carry
    `aria-label`.
  - `display="path"` wraps rather than truncating.
  - A click calls `openDocument(document_id)`.
- `AttachmentActionsMenu`: a real `<button aria-label="More actions for this file"
  aria-haspopup="menu">` that is never hover-gated.
  - The chip variant offers `Save to Library…` and `Open in panel`. Open in panel only calls
    `requestOpenPanel()` (D-23). The panel variant offers only the verb.
  - When `promotable` is false the verb is `aria-disabled`, with the visible reason `The Library
    doesn't accept this file type.` (D-22). When the file is already linked, the verb is not
    offered.
  - It mounts ONE `SaveToLibraryDialog`, whose `onSaved` calls `refreshLibraryLinks(threadId)`.
  - `requestAttachmentMenu(fileId)` opens a given file's menu (the bus shape `panelOpenSignal`
    uses).

**Task 2: the chip (D-07, D-18, D-24, D-27)**
- `ChatAttachmentChip`:
  - `attachmentDisplayName` is now a re-export of `lib/attachmentLifetime`'s, under the same export
    name, so names are prefix-stripped.
  - It calls `useViewingThread()` unconditionally. Only the `sent` state subscribes to the store.
  - A thread-life row renders no expiry span at all. TTL rows and rows with an unknown expiry render
    their readings unchanged.
  - Sent chips get the segment, which follows the scope word, and the `⋯`. Pending and expired
    chips get neither.
  - The docblock records the wider detach-registry window as a stated limit.
- D-24: `expiredWhy` now reads `This file expired after 24 hours. Files attached to a chat now last
  as long as the chat; workflow template files still expire after 24 hours.` The same sentence is in
  sketch 236's `COPY.js` and in the `composerCopy.ts` port, both marked `// amended by Phase 274
  D-24`, in the same commit. `grep -c "kept for 24 hours" composerCopy.ts` → 0.
- `composerNoLibraryDoor.test.ts` covers MessageInput, useComposerAttachments,
  ConnectedFilePickerModal, ConnectorsFlyout, InviteExpertDialog, ConnectionsPage and the
  ConnectionsTab it renders.
  - It checks non-vacuity first, then strips comments, then asserts none of the 8 minting tokens
    appears.
  - A planted call proves the fence can fire.
  - ConnectorsFlyout's `@/lib/api` import list is exactly `listConnectorConnections`.
- `MessageItem.tsx`, `ChatArea.tsx` and `MessageInput.tsx` are byte-unchanged:
  `git diff 8b5bb124c --stat` on the three files is empty.

**Task 3: the panel row (D-09, D-15, D-19)**
- `AttachmentRowTrailing` handles two kinds of row:
  - A thread-life row shows `this chat only`, then either the `⋯` (panel variant, `tabIndex={-1}`)
    or the full-path segment.
  - A TTL row shows the `Template` badge and the `expiryCaption` countdown, moved here byte-for-byte
    (the test asserts the exact class strings, including amber under 1 h), followed by the `⋯`.
- `FilesSection` (G-5 hot file, honoured by construction) changes in four places:
  - one import (`AttachmentRowTrailing`, `requestAttachmentMenu`);
  - the slot line `isTemplate ? <AttachmentRowTrailing …/> : undefined` (agent rows are
    byte-identical);
  - one `F10`/`ContextMenu` key arm, where F10 needs Shift;
  - `expiryCaption` / `isNearExpiry` now take `string | null`, and `isNearExpiry` is now exported.
    Their bodies are unchanged.

  That is 10 added lines, measured with `grep -cE '^\+[^+]'`.

## Verification

- TDD: each task's `test(274-04)` commit came before its `feat(274-04)` commit, and each RED was
  run first:
  - Task 1 failed at import.
  - Task 2 had 7 chip cases red. The composer fence was green at RED **by nature**: it is a
    negative proof of a property the composer already has, and its planted-call case proves it can
    fire.
  - Task 3 failed at import, with 5 FilesSection cases red.
- Targeted suites: `src/components/attachments`, FilesSection, the chip suite, ComposerAttach,
  ConnectedFilePickerModal.thread and every `MessageItem*` suite are all green, 126 of 126 in the
  Task 2 sweep.
- tsc set-diff (`npx tsc -p tsconfig.app.json --noEmit`): **70 → 66, zero new errors.** The 4
  TS2345s were removed (ChatAttachmentChip ×2, FilesSection ×2), and nothing else changed.
- Hot-file ledger: `ledger gate OK — every watched file has a row.` (exit 0).
- Full count gate, cap 2, run once at plan end from the worktree root, first try. The verdict,
  quoted exactly:
  ```
    total                                      9190    9954    +764
    total 9954  ·  failed 0  ·  pinned total 9190
  count gate OK — 423/423 pinned files present, no per-file decrease, 0 failing.
  ```
  Reconciled against the orchestrator's base (`9906 · 9136 · 418/418`), with no unexplained
  remainder. The base SHA `8b5bb124c` already contains `84aa064ec`, which pinned
  `irisMotion.test.ts` (+5 cases, +1 file) and is not in that reading. On top of it:
  - Pinned: four new pins (8 + 14 + 6 + 4 = 32), FilesSection 22 → 33 (+11; the base already read
    28), ChatAttachmentChip 10 → 15 (+5) and FolderPathListbox 11 → 12 (+1). That is +49, plus 5
    for iris, giving 9190.
  - Grand total: 43 new cases, plus 5 for iris, giving 9954.

## Deviations from Plan

**1. [Orchestrator directive / fixes 274-03 deviation #3] The ` › ` separator.** Commit `d3e55486e`.
The plan's behaviour text expects the segment `title` to read `Suppliers/Meridian/Pricing`. The
operator-approved sketch draws ` › `, so every displayed path on these surfaces now uses ` › `,
including the segment's title and accessible name. This is display only: `folderPathOf` is untouched.

**2. [Sketch over plan] The saved mark is a lucide `Check` glyph, not a typed `✓`.** The sketch's
segment renders `ico('check')`, which is an svg. The icon convention forbids inventing marks, so the
segment uses the shipped lucide glyph (`aria-hidden`). The test asserts `.lucide-check` plus the text
`In Library · Pricing`.

**3. [Rule 1 - Bug] Events from portals reaching the listbox option.** React events bubble through
portals along the React tree. Without a guard, clicking a menu item or the dialog would bubble to
the panel row's `onClick` and open the file preview, which unmounts the dialog. Pressing Space in
the folder search would hit the row's `onKeyDown`, which calls preventDefault and opens the preview.
`AttachmentActionsMenu` therefore wraps its trigger, menu and dialog in a `role="presentation"` span
that stops click and keydown propagation. Radix's Escape and dismiss listeners are document-level
capture listeners, so they are unaffected.

**4. [Rule 2 - a11y] Focus after closing the panel menu goes back to the row.** The trigger is
`tabIndex=-1`. When the menu closes, `onCloseAutoFocus` focuses the containing `role=option`, so a
keyboard user is not left on an element that is not a tab stop.

**5. [Rule 2 - a11y] `sr-only` full path on the non-button segment.** When there is no citation
navigator, the segment is a `<span>`. A generic span may not carry `aria-label`, so the full path is
spoken from hidden text instead. The chip test case 9 reads the visible prefix and the hidden path.

**6. The pending chip does not subscribe to the store.** The plan says the chip calls
`useLibraryLinks(threadId)` "unconditionally". The hook is still called unconditionally, but the
argument is `null` unless the chip is `sent`. This keeps the composer from fetching Library state.

**7. `ConnectionsTab.tsx` added to the composer fence** beside `ConnectionsPage.tsx`. The page is a
thin shell that renders the tab, so fencing the shell alone would prove little.

**8. The chip case 9 adjustment was committed with the Task 2 `feat`.** The test commit asserted an
exact `textContent`. Once the segment rendered its `sr-only` tail, the test was changed to assert
the visible prefix plus the hidden path.

## Known limits (stated, not stubs)
- The panel row's NAME is still `file.path`, which shows the upload prefix (for example
  `a1b2c3d4-…`). Changing it would touch the shared `FileRow` contract and the 195-05 "full path,
  never a basename" fence. Neither is in this plan, and D-27's display-name rule is applied on the
  chip and in the dialog. This is a candidate for 274-05 / G-4 to judge.
- The detach registry's window no longer closes on a TTL for thread-life rows. The file still
  associates only with the next sent message. This is recorded in the chip docblock, and
  single-attachment DELETE stays deferred.
- `graphify update .` was not run inside the worktree, because it rewrites the tracked
  `graphify-out/` files. It should be run once after the merge.

## Known Stubs
None. The API is mocked in the suites by design; 274-05 drives it live.

## Threat Flags
None. There are no new endpoints, and the store only reads `library-links` and `folders`.
- T-274-23 is closed by the composer fence and by the pending chip having no `⋯`.
- T-274-24: every value renders as React text, and `components/attachments` has no
  `dangerouslySetInnerHTML`.
- T-274-25: an unseen folder gives a `null` leaf and path.
- T-274-26: the poll is bounded, which the fake-timer cases cover.

## Commits
- `d3e55486e` fix(274-04): spell Library folder paths with the sketch's › separator
- `3cb57a6a9` test(274-04): failing tests for the library-links store, the after-mark segment and the shared ⋯ menu
- `d05b6d6d0` feat(274-04): the library-links store, the In Library segment and the shared ⋯ menu
- `2e3d3cb6e` test(274-04): failing chip cases for thread-life, the ⋯ and the after-mark; the D-18 composer fence
- `b954e78db` feat(274-04): the sent chip offers Save to Library and shows where the copy lives; no 24h on chat files
- `fefb24065` test(274-04): failing tests for the panel row's trailing slot and its keyboard reach
- `7d9bfd049` feat(274-04): the panel Files row offers Save to Library and shows the full path once saved

## Self-Check: PASSED

- All 5 created modules, the 4 new suites and this SUMMARY are on disk; all 7 commits listed above are on the branch (test before feat for each task).
- STATE.md / ROADMAP.md were not modified (the orchestrator owns them).
