---
quick_id: 260328-x6n
status: completed
commit: 2852601
date: 2026-03-29
---

# Quick Task 260328-x6n: Summary

## What Was Fixed

**Bug:** Pressing Enter in the folder creation input did not reliably create the folder.

**Root causes identified:**

1. **Unreliable `autoFocus`** — React 18 StrictMode double-mounts components in development,
   which can cause `autoFocus` to not fire on the second mount. The input appeared but may not
   have received keyboard focus, so Enter keypresses went nowhere.

2. **`onBlur` race condition** — When Enter is pressed, `handleCreateCommit` immediately calls
   `setCreatingInParentId(null)`, which unmounts `FolderCreateInput`. The unmount causes the
   focused input to fire a `blur` event. Without a guard, this `onBlur` could call `onCancel()`
   on the empty-value path if `value` was stale in the closure.

3. **No `e.preventDefault()` on Enter** — Without this, browser defaults could interfere in
   certain contexts (e.g., if focus was on the Global folder checkbox when Enter was pressed).

## Changes Made

### `frontend/src/components/ingestion/FolderCreateInput.tsx`
- Replaced `autoFocus` with `useRef<HTMLInputElement>` + `useEffect(() => ref.current?.focus(), [])` for reliable focus in all environments
- Added `committedRef = useRef(false)` guard — prevents `onBlur` from canceling after Enter has already committed
- Added `e.preventDefault()` on both Enter and Escape handlers
- Non-empty blur still keeps input visible (correct: user may be clicking "Global folder" checkbox)

### `frontend/src/components/ingestion/FolderNode.tsx`
- Added `e.preventDefault()` on Enter and Escape in the rename inline input

## Verification

- Existing folder-related tests: all pass (FolderNode, FolderTree, useFolders)
- Pre-existing failures unrelated to this fix: MessageItem CSS tests + useDocuments upload test
