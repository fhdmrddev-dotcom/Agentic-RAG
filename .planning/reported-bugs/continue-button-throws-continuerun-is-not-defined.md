---
id: BUG-260904-01
title: "The Continue button on the iteration-limit banner throws `continueRun is not defined`"
reported: 2026-09-04
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, run-lifecycle, MessageItem.tsx, iteration-cap]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 57274c7e0
  date: 2026-09-04
---

# BUG-260904-01: the Continue button calls a function that was never imported

Found by the Phase 227 post-execution review, 2026-09-04, while checking the typecheck
delta. **Not introduced by Phase 227** — `git show 7334f8d84:frontend/src/components/chat/MessageItem.tsx`
shows the identical unimported call at `:647` before the phase began.

## What happens

`frontend/src/components/chat/MessageItem.tsx:535` (`:647` pre-227) calls:

```tsx
const res = await continueRun(workflowLock.runId)
```

`continueRun` is **not imported anywhere in the file** — no top-level import, no dynamic
import inside the handler. The function does exist, at `frontend/src/lib/api/threads.ts:1673`.
So the identifier resolves to nothing and the click handler throws
`ReferenceError: continueRun is not defined`. The `catch` below it logs
`"continueRun failed:"` and the button re-enables, so the user sees a Continue button that
does nothing, with no message.

Reached when a run hits the iteration cap and the amber banner renders with
`continuesRemaining > 0` — the one affordance that lets a capped run keep going.

## How it stayed invisible

- `npx tsc -p tsconfig.app.json --noEmit` reports it as **`TS2304: Cannot find name 'continueRun'`**,
  and has done for some time — it is inside the project's **66-error accepted baseline**, so the
  gate reads "no new errors" and nobody looks at the list.
- jsdom never clicks it. `WorkspacePanel.test.tsx:1218` asserts the call exists **as source text**
  (`expect(src).toMatch(/continueRun\(workflowLock\.runId\)/)`) — a fence on the *shape* of the
  call, which passes whether or not the symbol resolves.
- ⚠ **That is the finding worth keeping**: a source-text fence and a baseline of accepted type
  errors can agree with each other while the button is dead.

## Fix (1 line — G-3 candidate)

Import `continueRun` from `@/lib/api` (or `@/lib/api/threads`) in `MessageItem.tsx`, then drive
the button once in a browser with a real capped run — the source fence cannot prove this one.

## Related

Phase 227's Wave 3 additionally left `useLayoutEffect`, `useRef` and `cn` imported-but-unused in
the same file (they moved out with `UserMessageBubble`), taking the typecheck from 66 to 69.
Fixing those four imports together returns the reading to baseline.
