---
phase: 087-panel-ui
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/panel/CsvTablePreview.tsx
  - frontend/src/components/panel/DiffExpandOverlay.tsx
  - frontend/src/components/panel/DiffLines.tsx
  - frontend/src/components/panel/FilePreview.tsx
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/PanelEmpty.tsx
  - frontend/src/components/panel/PanelRail.tsx
  - frontend/src/components/panel/PanelSection.tsx
  - frontend/src/components/panel/PausedRunCue.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/SeamCard.tsx
  - frontend/src/components/panel/SeamPointer.tsx
  - frontend/src/components/panel/TodosSection.tsx
  - frontend/src/components/panel/VersionDiff.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/panel/panelOpenSignal.ts
  - frontend/src/components/ui/sheet.tsx
  - frontend/src/index.css
  - frontend/src/lib/api.ts
  - frontend/src/lib/diffParse.ts
  - frontend/src/types/index.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 087: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 087 ships the Agentic RAG workspace panel: shell + state machine
(WorkspacePanel), four section bodies, a client-side CSV table and unified-diff
renderer, the file-preview router, the `ask_user` answer surface, and the
additive chat↔panel seam. The code is careful and well-documented, and the
security posture the reviewer was asked to scrutinize holds up:

- **XSS / raw-HTML injection: clean.** Every agent/file-derived string —
  CSV cells, diff lines, todo/file/prompt text, answers — renders as a React
  text child. No `dangerouslySetInnerHTML` anywhere in the phase. Markdown and
  code go through the existing DOMPurify (`MarkdownRenderer`) and HTML-escaping
  (`ShikiCode`) paths. The only raw `<img src>` is a backend-issued 60s signed
  URL gated on `storage_type === "bucket"` + `mime/image` (FilePreview.tsx:212-223).
- **AbortController fetch races: handled.** VersionDiff and FilePreview both
  use the `active` flag + `controller.abort()` cleanup pattern keyed on
  `threadId`/`fileId`/`pair`, with AbortError suppressed. No cross-thread diff bleed.
- **`run_id`-gated `ask_user` submit: correct.** `handleSubmit` double-guards
  (`!canSubmit || run_id == null`) and `canSubmit` requires `runReady`. A pure-SSE
  prompt (no `run_id`) triggers exactly one `reconcile()` and stays in
  "Preparing…" until the GET-reconciled prompt lands. No POST to `/runs/null/...`.
- **G-5 hot files (MessageItem, ChatLayout): additive only.** New imports + two
  new sibling render blocks + helper fns. RunCard / ToolCallPanel internals
  untouched. ChatLayout adds one conditional sibling.
- **panelOpenSignal bus: leak-free.** `subscribeOpenPanel` returns an unsubscribe;
  WorkspacePanel's effect returns it directly (`useEffect(() => subscribeOpenPanel(expand), [expand])`).

No Critical issues. The findings below are correctness edge cases (Warnings) and
maintainability notes (Info).

## Warnings

### WR-01: Optimistic "Answered" card can revert to "pending" if the reconcile-driven store replace lands before the SSE removal

**File:** `frontend/src/components/panel/PendingAskCard.tsx:97-115` (with `PendingAskStack` keying at :268)
**Issue:** On submit, the card sets local `state = "answered"` optimistically and
relies on the `ask_user_response` SSE to remove the `PendingAsk` from the store
(unmounting the card). But the card mounted by a pure-SSE prompt also fires
`reconcile()` (a full **replace** of `pendingAsksByThread` — see
StreamsProvider hook comment "reconcile REPLACES the inner Map atomically").
If a reconcile resolves after the optimistic flip but before the removal SSE,
the store re-emits the same `tool_call_id` (still server-pending until the
backend persists), `PendingAskStack` re-renders, and because the card is keyed
only by `ask.tool_call_id` the same component instance survives — so local
`answered` state is *preserved* in this path. However, if the prompt's
`tool_call_id` identity changes across reconcile (it should not, but the SSE
flat payload vs GET payload are merged by path/id in the store), React would
remount and drop the optimistic state, snapping the card back to amber "Needs
you" for a beat. This is a felt-experience regression on the exact 4-axis
parallel-thread / slow-stream scenario CLAUDE.md flags.
**Fix:** Don't rely solely on identity stability. Persist the answered/expired
disposition keyed by `tool_call_id` one level up (in `PendingAskStack` or the
store) so a re-render from reconcile cannot resurrect an already-answered card:
```tsx
// PendingAskStack: track locally-resolved ids so a reconcile replace can't un-answer
const resolved = useRef<Set<string>>(new Set())
// pass markResolved(tool_call_id) into PendingAskCard.handleSubmit success
// and filter: ordered.filter((a) => !resolved.current.has(a.tool_call_id))
```

### WR-02: `remaining` countdown never resets when `timeout_seconds` changes on the same card instance

**File:** `frontend/src/components/panel/PendingAskCard.tsx:63-73`
**Issue:** `remaining` is initialized from `timeout_seconds` via `useState`, which
only reads the initial value. The countdown effect depends on `[remaining, state]`,
not on `timeout_seconds`. Because `PendingAskStack` keys cards by `tool_call_id`
(PendingAskCard mount survives store updates), the A2 reconcile path replaces the
SSE prompt (which may have a different/refreshed `timeout_seconds` from the GET)
**without remounting** the card. The clock keeps counting from the SSE-era value
and ignores the reconciled timeout. Worst case: a card shows "expired" while the
server still considers it live, or vice-versa.
**Fix:** Resync `remaining` when `timeout_seconds` changes:
```tsx
useEffect(() => { setRemaining(timeout_seconds) }, [timeout_seconds])
```
(Guard against resetting an already-answered/expired card if that is undesirable.)

### WR-03: `useIsMobile` toggle between mobile sheet and desktop grid silently discards `selectedFile` and panel `state`

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:50-61, 170-231`
**Issue:** `WorkspacePanel` returns two entirely different subtrees based on
`isMobile`. Crossing the 768px breakpoint (rotate a tablet, drag a desktop
window narrow) unmounts one subtree and mounts the other. `selectedFile`,
`state`, and `FilesSection`'s internal drill-in/`activeIndex`/`flashKey` state
live in components that get torn down — so a resize mid-task drops the user out
of an open file preview or version comparison back to the list, and the
panel-open `state` is reset to its `useState("open")` default. The keyboard
toggle `state` (rail/hidden) is also lost. Not a crash, but a jarring
lived-experience defect on the responsive axis.
**Fix:** Lift the cross-cutting state (`state`, `selectedFile`) above the
mobile/desktop branch (already done for these two) AND avoid fully swapping the
body subtree — render the shared `body` once and only swap the *chrome*
(side-column vs Sheet wrapper), or accept the reset explicitly and document it.
At minimum, `FilesSection`'s drill-in state should be lifted so a resize doesn't
eject the user from an open preview.

### WR-04: `WorkspacePanel` ignores its `selectedThread` prop and reads `useViewingThread()` — potential desync if the two ever diverge

**File:** `frontend/src/components/panel/WorkspacePanel.tsx:67-71` and `frontend/src/components/layout/ChatLayout.tsx:202`
**Issue:** `ChatLayout` passes `selectedThread={selectedThread}` (from
`useThreads()`), but `WorkspacePanel` renames it `_selectedThread` (unused) and
derives `threadId` from `useViewingThread()` (the StreamsProvider
`viewedThreadId`). These are *intended* to be the same thread, but they come
from two independent sources of truth. If `viewedThreadId` lags `selectedThread`
during a thread switch (the `setViewingThread` → reconcile path is async), the
panel will briefly show the *previous* thread's todos/files/asks next to the new
thread's chat — a cross-thread data-bleed window precisely on the thread-switch
axis. The prop is declared but dead, which hides the coupling.
**Fix:** Either consume the passed `selectedThread.id` directly (single source of
truth that ChatArea already uses for the transcript), or drop the prop entirely
and document that the panel is intentionally driven by `viewedThreadId`. Don't
leave a declared-but-unused prop that implies a wiring that doesn't exist:
```tsx
// Option A — use the prop the parent already threads in:
export function WorkspacePanel({ selectedThread }: WorkspacePanelProps) {
  const threadId = selectedThread?.id ?? null
  ...
```

## Info

### IN-01: CSV size cap measures UTF-16 code units, not bytes

**File:** `frontend/src/components/panel/CsvTablePreview.tsx:28, 125`
**Issue:** `MAX_BYTES = 256_000` is compared against `content.length`, which is
the JS string length (UTF-16 code units), not bytes. A CSV of multibyte
characters can exceed 256 KB on the wire while passing the guard, and a CSV with
astral-plane characters counts surrogate pairs as 2. The DoS intent is
approximately met but the unit label is misleading.
**Fix:** Either rename the constant to `MAX_CHARS` to match reality, or measure
bytes with `new TextEncoder().encode(content).length` if a true byte cap is
required.

### IN-02: `headLabel` is an identity passthrough — dead indirection

**File:** `frontend/src/components/panel/SeamCard.tsx:42-44`
**Issue:** `function headLabel(kind: SeamKind): string { return kind }` returns its
argument unchanged. It adds a layer with no transformation.
**Fix:** Inline `{kind}` at the call site (SeamCard.tsx:50) and delete the helper,
or have it actually map to display copy (e.g. `ask_user` → "Question") if a
friendlier label was intended.

### IN-03: `seamCardPayloadFor` reads tool args that may not exist on the persisted wire (`version`, `total`, `done`)

**File:** `frontend/src/components/chat/MessageItem.tsx` (seamCardPayloadFor: `write_todos` / `workspace_write` branches)
**Issue:** `tc.args.version`, `tc.args.total`, `tc.args.done` are read from the
`write_todos` / `workspace_write` tool args, but those tools' arg schemas may not
carry these fields (workspace_write args are typically `path` + `content`; todo
counts are derived, not args). `Number(undefined)` → `NaN`, but the render guards
on `!= null` so `NaN` would slip through (`NaN != null` is true) and render
`v{NaN}` / `{NaN} todos`. Best-effort by design, but worth verifying against the
actual persisted `tool_calls` shape to avoid `NaN` leaking into the reload card.
**Fix:** Coerce defensively: `const n = Number(v); return Number.isFinite(n) ? n : undefined`.

### IN-04: `VersionDiff` two-click pill selection has no visible affordance for the in-progress first click

**File:** `frontend/src/components/panel/VersionDiff.tsx:106-123`
**Issue:** `pickVersion` uses a `lastClicked` ref for two-click endpoint
selection, but the first click updates only the ref (no state change) so nothing
re-renders — the user gets zero feedback that the first endpoint was registered.
The second click then jumps both pills. This is a UX papercut, not a bug.
**Fix:** Promote the pending first-click endpoint into state so the clicked pill
can show a "selecting…" highlight between the two clicks.

### IN-05: `getWorkspaceFileDiff` interpolates `from`/`to` into the query string without `encodeURIComponent`

**File:** `frontend/src/lib/api.ts:803-817`
**Issue:** `?from=${from}&to=${to}` interpolates numbers directly. They are typed
`number` so injection is not possible today, but it diverges from the
`encodeURIComponent(since)` convention used in `subscribeToRun` and is fragile if
the signature ever loosens to accept strings.
**Fix:** `?from=${encodeURIComponent(String(from))}&to=${encodeURIComponent(String(to))}` for consistency, or leave as-is given the `number` type guarantee — low priority.

### IN-06: `FilePreview` Escape handler calls `e.stopPropagation()` on a window-level listener

**File:** `frontend/src/components/panel/FilePreview.tsx:121-130`
**Issue:** The Escape `keydown` listener is attached to `window` and calls
`e.stopPropagation()`. On `window` (the last bubbling target) stopPropagation is
a no-op for bubbling, but if any other component also listens on `window` for
Escape (e.g., a future modal close), ordering is undefined and the
`stopPropagation` gives a false sense of isolation. Also, the listener fires for
Escape pressed *anywhere* in the app while a preview is mounted, not just within
the panel.
**Fix:** Scope the listener to the preview container (attach to the wrapper div
with `tabIndex` / `onKeyDown`) rather than `window`, so Escape-to-go-back only
fires when focus is inside the preview. Consistent with the Radix-based focus
trapping used elsewhere in the phase.

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
