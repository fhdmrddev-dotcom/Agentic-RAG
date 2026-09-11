# Phase 244: The Chat Shell and the Composer — Pattern Map

**Mapped:** 2026-09-11
**Base:** `develop` HEAD (`1ff80a1da`), phase base recorded in CONTEXT as `5ebd0fbca`
**Files analysed:** 22 new/modified (4 net-new, 18 modified)
**Analogs found:** 20 / 22 (2 have no analog — named at the bottom)
**Inputs read:** `244-CONTEXT.md`, sketch 236 `README.md` + `COPY.js`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md` (the nine per-file sections in D-244-20)

> ⚠ **Read the `## Measured corrections to CONTEXT.md` section FIRST.** Five claims in
> `244-CONTEXT.md` were driven against the source and **three are false or a no-op**. Two of them
> change the shape of a plan (the composer gate and the approval mount), and one of them answers
> a question D-244-09 says is "UNVERIFIED" — it is verifiable from source, and the answer is bad.
>
> ⚠ **ADDENDUM (revision pass, 2026-09-11):** two further corrections — **C-8** and **C-9** — were
> measured during planning and were recorded **only inside PLAN.md files**, where nobody consulting
> this map would find them. They are appended to the section below in the same register. The count in
> the sentence above is the mapper's original and is **left as written** rather than edited, per this
> project's record-beside-the-original convention.

---

## Measured corrections to CONTEXT.md

### ⛔ C-1 — D-244-08's proposed gate `workflowLock?.mode === "harness"` is a **NO-OP**

`WorkflowLock.mode` is the **literal type `"harness"`** and has no second member
(`frontend/src/stores/streamsStore.ts:89`):

```ts
  runId: string
  mode: "harness"
  /** True when the run is cap_paused (a Continue card is pending). */
  capPaused: boolean
  /** Continues remaining (max_continues_per_run - continues_used, D-06). */
  continuesRemaining: number
```

And the Deep cap-paused reconcile branch **hard-codes `mode: "harness"`** —
`frontend/src/components/chat/ChatArea.tsx:184-192`:

```tsx
        } else if (state.cap_paused) {
          const runId = (state.active_workflow_run_id || state.latest_producer_run_id || "") as string
          if (runId) {
            streamActions.setWorkflowLockForThread(tid, {
              runId,
              mode: "harness",          // ⛔ a DEEP cap-paused run is labelled "harness" HERE
              capPaused: true,
              continuesRemaining: state.continues_remaining,
            })
```

**So `workflowLock?.mode === "harness"` is `true` for exactly the run D-244-08 wants to unlock.**
The only discriminator that separates a genuine harness run from a Deep cap-pause on the shipped
type is **`capPaused`**. The operative edit at `ChatArea.tsx:116` is therefore:

```tsx
const workflowLocked = workflowLock !== null && !workflowLock.capPaused
```

D-244-08 already allows this ("and/or `&& !capPaused`"); this records that the `mode` half cannot
do any work and that a plan writing `mode === "harness"` alone ships nothing.

### ⛔ C-2 — D-244-09 IS determinable from source, and the answer is **the lock returns**

- `POST /threads/{thread_id}/messages` (`backend/app/api/threads.py:728`) contains **no `cap_paused`
  refusal** — confirmed (grep over the handler body returns none).
- It **INSERTs a brand-new `runs` row** (`threads.py:873` `run_id = _uuid_mod.uuid4()` →
  `register_run_start(...)` at `:899`) and **writes nothing to the previous row**.
- The lock reader takes the thread's **latest `runs` row with `status = 'cap_paused'`, with no
  recency bound** (`threads.py:1239-1253`):

```python
    if not cap_paused:
        # Look at the thread's latest cap_paused `runs` row (Deep-run Continue case).
        deep_row = await _rls_fetchrow(
            """
            SELECT run_id, status, continues_used
            FROM runs
            WHERE thread_id = $1 AND status = 'cap_paused'
            ORDER BY started_at DESC
            LIMIT 1
            """,
```

- The **ONLY writer that clears `status='cap_paused'` on a `runs` row** in the whole backend is
  `continue_run` (`backend/app/api/runs.py:1082-1086`):

```python
            await aexec(
                supabase.table("runs")
                .update({"continues_used": _new_used, "status": "streaming"})
                .eq("run_id", str(run_id))
            )
```

  (`grep "cap_paused" backend/app/db/runs.py backend/app/services/run_lifecycle.py` → **no matches**.)

**Consequence:** posting a new message leaves the old `cap_paused` row intact, so
`GET /threads/{id}/workflow` keeps returning `cap_paused: true` **forever** on that thread, and
`ChatArea.tsx:184` re-sets the lock on the next reconcile. Unlocking the composer without also
retiring that row is exactly the "unlocking a composer that then posts into a still-locked thread"
defect D-244-09 warns about — **and it is not hypothetical.** The plan must either (a) retire the
row server-side when a new run starts on the thread, or (b) bound the read (only if it is newer
than the thread's latest run). ⛔ D-244-09's "drive it, do not reason about it" still binds — this
is the source reading that says *what* to drive.

### ⛔ C-3 — `useAskUserPrompt` is **NOT** "a store selector, not a fetch"

D-244-11 says a third reader is free. Measured — `frontend/src/providers/StreamsProvider.tsx:4004-4021`:

```ts
export function useAskUserPrompt(threadId: string | null): { … } {
  const data = useStreamsStore((s) =>
    threadId ? (s.pendingAsksByThread.get(threadId) ?? EMPTY_ASKS) : EMPTY_ASKS,
  )
  const replace = useStreamsStore((s) => s.actions.replacePendingAsksForThread)
  const { isLoading, error, reconcile } = usePanelReconcile<PendingAsk>({
    threadId, hookId: "asks", fetcher: getThreadPendingAsks, replace,
  })
```

`usePanelReconcile` (`frontend/src/hooks/usePanelReconcile.ts`) fires a **real fetch per mount** on
the `[threadId]` effect. And `PendingAskStack` additionally calls `usePhases`, which mounts a
*second* `usePanelReconcile` (a `getThreadWorkflow` fetch per mount).

⚠ **This is the exact cost this codebase already measured and closed by construction** —
`frontend/src/components/chat/MessageItem.tsx:180-188`:

> `useWorkflowLockForThread` is a bare store selector, while `usePhases` also mounts
> `usePanelReconcile`, which fires a `getThreadWorkflow` FETCH per mount. `MessageList` renders one
> `MessageItem` per message with no virtualisation … measured at 6 rows: **6 calls**, versus **1**
> with this component.

**So D-244-12's "mount `<PendingAskStack />` inline at `MessageItem.tsx:392-397`" costs TWO fetches
per assistant row unless the mount is narrowed the way `HarnessOuterBanner` is.** The analog to copy
is in the same file (see §3 below) — mount it inside a gate that is true for **at most one row**.

### ⚠ C-4 — `PendingAskStack` has **ONE** mount today, not two

`grep -rn "PendingAskStack" frontend/src --include=*.tsx` (non-test) →
`WorkspacePanel.tsx:71` (import) and **`WorkspacePanel.tsx:438`** (the only mount).
`WorkflowRunPage.tsx:1629` mounts **`PendingAskCard`** directly, with its own ordering and its own
`runIsOver` (`isTerminal`) — *not* the stack. CONTEXT's `WorkspacePanel.tsx:358` is the component's
`export function` line, not the mount. A chat mount is therefore the **second** `PendingAskStack`
and the **third** `useAskUserPrompt` reader in the tree.

⚠ **That trips arm 1 of `attentionConditions.ts`'s deferral trigger analogue for the panel hooks**
and, more concretely, it is the third concurrent `useAskUserPrompt` — CONTEXT's own Deferred list
flags this. Say so in the plan rather than discovering it.

### ⚠ C-5 — `AttentionCondition` carries **NO kind discriminator** (D-244-15's question, answered)

`frontend/src/components/layout/attentionConditions.ts` — the interface is exactly four fields:

```ts
export interface AttentionCondition {
  id: string        // stable across polls
  title: string     // what is affected, in the person's words
  detail: string    // a SENTENCE from a vocabulary leaf — never a raw error string
  onOpen: () => void  // injected by the shell; no router (SEED-185)
}
```

**Where the kind DOES exist:**
- `AttentionProducer.key` — the module constant is `[{ key: "stopped-sources", use: … }]`. That is a
  producer-level kind, available to `ChatLayout` at the `flatMap`, and it is what a
  condition→tab mapping would key off **without adding a producer**.
- `StoppedSource.cause` (`frontend/src/lib/api/sources.ts:274`, a `SourceFailureCause` union:
  `token_revoked | folder_gone | unreachable | connection_disabled | unknown`) — but
  `useStoppedSourceConditions` **consumes and discards it**, mapping it through
  `SENTENCE_FOR_CAUSE[source.cause](...)` into `detail`.

**Plainly: the condition does not know its kind; the producer does.** The cheapest honest route for
`BUG-260911-03` is one **optional** field on `AttentionCondition` (e.g. `tab?: LibraryTab`) set by
the producer — additive, no second producer, `ATTENTION_PRODUCERS.length === 1` untouched.
⛔ The alternative (a second producer per tab) is forbidden by `D-235-03` and by
`NavPanel.badge.test.tsx:118-119`:

```ts
    expect(ATTENTION_PRODUCERS.length).toBe(1)
    expect(ATTENTION_PRODUCERS[0].key).toBe("stopped-sources")
```

### ⚠ C-6 — `BUG-260911-02`: there is **no select-then-open two-step in the source**

`ChatHistoryColumn.tsx:163-167` — one click, one call, no intermediate state:

```tsx
            <button
              type="button"
              onClick={() => onSelectThread(thread)}
              className="w-full py-1.5 cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
```

`onSelectThread` is `useThreads.selectThread` (`frontend/src/hooks/useThreads.ts:35-37`), a bare
`setSelectedThread(thread)`; `ChatLayout.tsx:796` passes `thread={selectedThread}` straight to
`ChatArea`. The mobile drawer row (`ChatLayout.tsx:676`) is the same one-step.

**So the "first click selects but does not open" symptom is NOT a two-step handler.** The plan must
drive it rather than patch a handler that is already single-step. Candidate causes worth driving,
in order: (a) `activeView` is not `"chat"` at click time, so the column is not mounted and the
click landed on the drawer/palette path; (b) a re-render/remount discards the first `setState`;
(c) it is `ChatArea`'s own render gate (welcome vs thread branch) rather than selection.
⛔ `BUG-260911-02` also says "never checked against production" — do that first.

### ⚠ C-7 — `BUG-260816-03` is **partly already built**

The thread row at `ChatHistoryColumn.tsx:168-194` already renders **an icon**
(`<MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />`), a
**truncating title** (`truncate flex-1 min-w-0` + `title={thread.title}` + `HighlightTitle`), and a
**folder chip** with an italic "Unfiled" fallback (`folderLabel(folders, thread.folder_id)`), mode-
switched against a date bucket. Read the bug report against *this* markup before planning work —
this is the F-4 pattern (already-shipped) one layer down.

### ⚠ C-8 — D-244-20's *"all of this phase's hot files HAVE ledger rows"* is **FALSE**

⛔ **Measured, not asserted.** `node scripts/check-hot-file-ledger.cjs 244` **exits 1** and names
**nine** files with no `docs/HOT-FILE-LEDGER.md` row:

```
G-5 CANNOT FIRE ON 9 FILE(S) — they have no ledger row:
  [no-row] backend/app/api/workspace.py   (named by 244-02-PLAN.md)
  [no-row] frontend/src/components/chat/ActiveConnectorChips.tsx   (named by 244-05-PLAN.md)
  [no-row] frontend/src/components/chat/ChatAttachmentChip.tsx   (named by 244-05-PLAN.md)
  [no-row] frontend/src/components/chat/ConnectedFilePickerModal.tsx   (named by 244-06-PLAN.md)
  [no-row] frontend/src/components/chat/composerCopy.ts   (named by 244-05-PLAN.md)
  [no-row] frontend/src/components/layout/ChatHistoryColumn.tsx   (named by 244-01-PLAN.md)
  [no-row] frontend/src/components/panel/TemplateUpload.tsx   (named by 244-02-PLAN.md)
  [no-row] frontend/src/hooks/useThreads.ts   (named by 244-01-PLAN.md)
  [no-row] frontend/src/lib/workspaceAllowedExt.ts   (named by 244-02-PLAN.md)
```

⛔ **`backend/app/api/workspace.py` measures `11 / 6 / 620`** (re-derived with the CLAUDE.md recipe at
this base) — **it is FIRING G-5 and has been invisible to it for its entire life.** That is the
`App.tsx` (23 phases) and `config.py` (whole life) failure one file over, and **D-244-20 answered the
auditor with `satisfied` over it**: a claim that is present and WRONG stops the audit, which is worse
than an absent claim. The other eight sit below the threshold, so the obligation there is the
`settingsSearchPayload.ts` precedent — **a row is added at CREATION, not at the third phase.**

**Row ownership — one file → exactly ONE task** (⛔ the gate fails `[duplicate-row]`, so a second
well-meaning row is a red gate):

| File | Row owed by |
|---|---|
| `backend/app/api/workspace.py` · `TemplateUpload.tsx` · `workspaceAllowedExt.ts` | `244-02` T1 |
| `ChatHistoryColumn.tsx` · `useThreads.ts` | `244-01` |
| `ActiveConnectorChips.tsx` · `ChatAttachmentChip.tsx` · `composerCopy.ts` | `244-05` T1/T2 |
| `ConnectedFilePickerModal.tsx` | `244-06` T3 |

⚠ **S-8 below repeats D-244-20's claim and is SUPERSEDED by this correction** — left as written
rather than overwritten, because the original being wrong is the finding. ⛔ Same-commit sync rule
still binds: the CLAUDE.md row and the `docs/HOT-FILE-LEDGER.md` section move together, disposition
cell capped at 200 chars.

### ⚠ C-9 — `<code_context>`'s *"nothing new is needed on the tool side"* is TRUE for text, **FALSE for binary**

`244-CONTEXT.md` § `<code_context>` states: *"`workspace_read` / `workspace_list` … the agent's
existing reach into `workspace_files`. **Nothing new is needed on the tool side.**"*

**Measured at this base:** `workspace_read` returns the literal `"Content available via REST API."`
for **any binary MIME**, and the sandbox has **no workspace mount** —
`grep -rn "workspace" backend/app/services/sandbox_service.py` returns **no matches**. **Eight of the
fifteen accepted extensions are binary** (3 OOXML + 5 image), and sketch 236's own headline scenario
file is `Meridian-Q4-pricing.xlsx`. So `SHELL-04`'s *"and the agent can use it"* clause is **not
satisfied by the status quo for the most likely attachments** — a person attaches a spreadsheet and
the agent tells them to use the REST API.

⭐ **This is also why the phase ships six plans and not four** (see the `D-244-17` correction now
recorded in `244-CONTEXT.md`): it is a **third backend seam inside one requirement**. `244-02` Task 2
closes it by hydrating the thread's non-expired workspace files into `/sandbox/attachments/` using
**the injection mechanism that already exists in the same function** — the skill-file loop at
`tool_dispatcher.py:1888-1923`, guarded once per session in the shape of `_output_baseline_seeded`.
⛔ **No new subsystem and no second expiry rule**: `D-244-04`'s SQL read gate on the listing stays the
only one.

---

## File Classification

| New/Modified file | New? | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|---|
| `frontend/src/components/chat/ChatArea.tsx` | mod | container/view | request-response | itself (`:184` branch) + `DocumentDetailPanel.tsx:257` | exact |
| `frontend/src/components/chat/MessageList.tsx` | mod | view | scroll/layout | `DocumentDetailPanel.tsx:300`, `FilePreview.tsx:165` | exact |
| `frontend/src/components/layout/ChatLayout.tsx` | mod | shell | layout + nav callbacks | `WorkspacePanel.tsx:622` (min-h-0 chain) | exact |
| `frontend/src/components/layout/ChatHistoryColumn.tsx` | mod | view (list rows) | event-driven | itself (`:163`) | exact |
| `frontend/src/components/layout/NavPanel.tsx` | mod | shell/nav | props-down | its own badge props (`attentionConditions`) | exact |
| `frontend/src/components/chat/MessageInput.tsx` | mod | composer | event-driven + file-I/O | `ActiveConnectorChips.tsx`, `TemplateUpload.tsx` | exact |
| `frontend/src/components/chat/ChatAttachmentChips.tsx` (or similar) | **new** | presentational leaf | render-only | `ActiveConnectorChips.tsx` (whole file) | exact |
| `frontend/src/components/chat/ConnectedFilePickerModal.tsx` | mod | modal | request-response | itself + `uploadWorkspaceTemplate` | role-match |
| `frontend/src/components/chat/MessageItem.tsx` | mod | view | store-selector + render | `HarnessOuterBanner` (same file, `:198`) | exact |
| `frontend/src/components/panel/PendingAskCard.tsx` | mod (maybe) | **cross-surface shell** | store + fetch | its own `PendingAskStack` | exact |
| `frontend/src/components/layout/attentionConditions.ts` | mod | registry (leaf) | pure map | itself (producer shape) | exact |
| `frontend/src/components/layout/AttentionPopover.tsx` | mod | presentational | render-only | itself | exact |
| `frontend/src/lib/libraryTabHandoff.ts` | mod (maybe) | pure leaf | transform | itself | exact |
| `frontend/src/App.tsx` | mod | root | state + nav | `handleOpenLibraryHealth` (`:179-182`) | exact |
| `frontend/src/lib/api/documents.ts` | mod (maybe) | api client | file-I/O | `uploadWorkspaceTemplate` (`:56`) | exact |
| `frontend/src/lib/api/connectors.ts` | mod | api client | request-response | `previewSource` / `postPreview` (`:673-697`) | exact |
| `frontend/src/pages/LibraryPage.tsx` | mod | page | composition | `DocumentUpload` mount (`:642-649`) | exact |
| `backend/app/api/connectors.py` | mod | route | request-response (body) | `preview_source_folder` (`:1826`) | exact |
| `backend/app/models/connector.py` | mod | pydantic model | schema | `SourcePreviewRequest` (`:713`) | exact |
| `backend/app/services/agent_loop.py` | mod | service | prompt assembly | the five `active_system_prompt = … + note` sites | exact |
| `backend/app/api/threads.py` | mod (C-2) | route | CRUD | `continue_run`'s status write (`runs.py:1082`) | role-match |
| `backend/app/api/workspace.py` | mod **only if** `.pdf` is taken (D-244-24) | route/validator | file-I/O | `_validate_ooxml_container` / `_image_magic_ok` | **no analog for PDF** |

---

## Pattern Assignments

### 1. `SHELL-01` — the scroll frame (`ChatLayout.tsx` → `ChatArea.tsx` → `MessageList.tsx`)

**Analogs:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:257` + `:300`, and
`frontend/src/components/panel/WorkspacePanel.tsx:622`.

**The correct chain, verbatim (`DocumentDetailPanel.tsx:257` and `:300`):**

```tsx
    <div className="flex h-full min-h-0 flex-col">
      {/* fixed header … */}
      <div className="min-h-0 flex-1 overflow-y-auto">
```

`WorkspacePanel.tsx:622` is the same rule at a shell root:

```tsx
        "flex h-screen min-h-0 min-w-0 flex-col overflow-hidden border-l …",
```

**The broken chain, measured — it is FOUR links, not the two F-5 names:**

| # | File:line | Class list | `min-h-0`? |
|---|---|---|---|
| 1 | `ChatLayout.tsx:546` | `flex h-screen bg-background` | n/a (root) |
| 2 | `ChatLayout.tsx:790` | `grid min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] …` | ⛔ **missing** |
| 3 | `ChatLayout.tsx:796` | `<main className="min-w-0 overflow-hidden">` | ⛔ **missing** |
| 4 | `ChatArea.tsx:552` | `flex flex-col h-full bg-background` | ⛔ **missing** |
| 5 | `MessageList.tsx:212` | `<ScrollArea className="flex-1">` | ⛔ **missing** |

**Why the primitive cannot save it** — `frontend/src/components/ui/scroll-area.tsx:12-14, 31`:

```tsx
  <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {…props}>
    …
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
```

The Root's height comes from `flex-1` on an item whose `min-height` is `auto`, so it grows to
content; the Viewport's `h-full` then resolves to that grown height and nothing scrolls internally.
⭐ **The sibling call site proves the mechanism**: `ReadDocumentBody.tsx:53` uses
`<ScrollArea className="max-h-64">` — an explicit bound — and scrolls correctly. There are exactly
two `<ScrollArea` call sites in `src/` (pinned by `scrollAreaViewportWidth.test.tsx:26`).

⚠ **F-5 is a hypothesis, and D-244-19 forbids closing on a screenshot.** Measure per D-244-19:
`document.scrollingElement.scrollHeight <= clientHeight`, plus the rail's **leaf bounding rect**
unchanged after scrolling, at ≥3 viewport heights × panel closed and open.
⛔ `scrollTop` is not the reader's position (memory: it once reported a 1,039 px drag that never
happened).

---

### 2. `SHELL-02` — the cap-paused composer (`ChatArea.tsx:116` → `:436` → `MessageInput.tsx:339`)

**The single lock chain, verbatim.** `ChatArea.tsx:115-116`:

```tsx
  const workflowLock = useWorkflowLockForThread(thread?.id ?? null)
  const workflowLocked = workflowLock !== null
```

→ passed at `ChatArea.tsx:436` as `workflowLocked={workflowLocked}` → consumed at
`MessageInput.tsx:285` and `:337-339`:

```tsx
  const canSend = !disabled && !workflowLocked && value.trim().length > 0
  …
              placeholder={workflowLocked ? "Workflow running — Cancel to switch back" : "Ask anything…"}
              title={workflowLocked ? "Workflow running — Cancel to switch back" : undefined}
              disabled={disabled || workflowLocked}
```

**Pattern to copy:** change **one expression at `ChatArea.tsx:116`** and nothing else. D-244-10 keeps
the harness copy untouched, and that is structurally free here because the copy is keyed off the
same single boolean. See **C-1** for why `mode === "harness"` cannot be the discriminator.

**The sentence the unlock makes true** (`MessageItem.tsx:576-578`, do not delete it — the ROADMAP's
named anti-fix):

```tsx
                    {continueExhausted || workflowLock.continuesRemaining <= 0
                      ? "Reached the Continue limit — this run is stopped. Start a new message to keep going."
                      : "Reached the iteration limit — some tools haven't run yet."}
```

**Server half (C-2):** the writer analog for retiring a stale `cap_paused` row is
`backend/app/api/runs.py:1082-1086` — a scoped `.update({… "status": "streaming"})` on `runs`
inside `aexec`, wrapped so a failure is a 500 rather than a silent pass. Any new supabase-py call
on this path is blocking I/O → `run_in_threadpool` / `aexec` (D-v2.5-01).

---

### 3. `SHELL-03` — the approval in the thread (`MessageItem.tsx:392-397`)

**The cue it joins, verbatim (`MessageItem.tsx:392-396`):**

```tsx
        {isMessageStreaming && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {hasPendingAsk(message.tool_calls) && <PausedRunCue />}
          </div>
        )}
```

with `hasPendingAsk` at `MessageItem.tsx:70-76`:

```tsx
function hasPendingAsk(toolCalls: ToolCall[] | undefined): boolean {
  return toolCalls?.some(
      (tc) => tc.name === "ask_user" && (tc.status === "running" || tc.status === "interrupted"),
    ) ?? false
}
```

⚠ **Note the gate is `isMessageStreaming`** — `MessageList.tsx:182` passes
`isStreaming={isStreaming && isLastAssistant}`, so the cue renders on **at most one row**. That
narrowing is what makes a fetch-mounting child affordable.

**The mount analog — `HarnessOuterBanner`, same file, `MessageItem.tsx:198-201`:**

```tsx
function HarnessOuterBanner({ message }: { message: Message }) {
  const { data: phases } = usePhases(message.thread_id ?? null)
  return (
    <span className="italic">
```

and its docblock (`:180-194`) is the decision record for **why a fetch-mounting hook must live in a
narrow child, not at `MessageItem`'s top level** — it is the exact constraint C-3 raises for
`PendingAskStack`. **Copy that shape:** mount `<PendingAskStack />` *inside* the existing
`hasPendingAsk` arm (already at-most-one-row), never at `MessageItem`'s top level.

**The thing being mounted — `PendingAskCard.tsx:690-714`, zero-prop and self-resolving:**

```tsx
export function PendingAskStack() {
  const threadId = useViewingThread()
  const { data: asks, reconcile } = useAskUserPrompt(threadId)
  …
  const workflowLock = useWorkflowLockForThread(threadId)
  const { data: phases } = usePhases(threadId)
  const runIsOver = workflowLock == null && phases.length > 0
  …
  if (asks.length === 0) return null
```

⭐ **`if (asks.length === 0) return null` is what makes the mount safe on every non-paused row** —
it renders nothing. ⚠ But the two `usePanelReconcile` fetches fire **before** that early return,
because hooks run first. That is the whole of C-3.

**The existing mount to copy the call shape from — `WorkspacePanel.tsx:438`:**

```tsx
          <PendingAskStack />
```

**⛔ Cross-surface obligation (D-244-13):** `PendingAskCard.tsx` is 765 lines / 14 commits / 7 phases
and is pinned as one of five step-identity surfaces by
`frontend/src/components/workflows/StepIdentity.coverage.test.tsx` (`BASELINE` 23 cases). A change to
the CARD lands in `WorkspacePanel` **and** `WorkflowRunPage.tsx:1629`. Prefer a change that touches
**only the mount site**, not the card.

---

### 4. `SHELL-04a` — the local attach affordance (composer)

**Analog A — the chips row the attachment chip joins.** `MessageInput.tsx:321-327`:

```tsx
          {/* Active Connector Chips Bar */}
          <div className="px-3 pt-2">
            <ActiveConnectorChips
              connections={connections}
              activeConnectorIds={activeConnectorIds}
              onRemoveConnector={handleRemoveConnector}
            />
          </div>
```

**The chip's own shape — `ActiveConnectorChips.tsx` (whole file, 61 L) is the template.** The parts a
new file chip copies verbatim:

```tsx
  if (activeConnectorIds.length === 0) return null          // ← empty ⇒ renders NOTHING, no reserved space
  …
    <div
      data-testid="active-connector-chips"
      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 mb-1 bg-muted/40 rounded-lg border border-border/40"
    >
      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mr-1">
        Using:
      </span>
      …
        <span
          key={conn.id}
          data-testid={`active-connector-chip-${conn.id}`}
          className={cn(
            "inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-medium",
            "bg-background border border-border/80 shadow-xs text-foreground",
            "hover:border-border transition-colors animate-in fade-in zoom-in-95 duration-150",
          )}
        >
          <ConnectionMarkGlyph shape={conn} size="chip" />
          <span className="truncate max-w-[140px]">{conn.name}</span>
          <button
            type="button"
            aria-label={`Remove ${conn.name}`}
            onClick={() => onRemoveConnector(conn.id)}
            className="rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
```

⚠ **Sketch 236's build contract says the file chip renders "in the existing `ActiveConnectorChips`
row, not a new region" (D-244-26).** The shipped component returns `null` when there are no
connectors and owns the row's `<div>` and its `Using:` label. **So "the existing row" is a
composition decision the plan must make explicitly:** either (a) hoist the row container into
`MessageInput` and render `ActiveConnectorChips`'s chips + the file chip as siblings inside it, or
(b) give `ActiveConnectorChips` a `children`/`extra` slot. ⛔ Rendering a second `<div>` beneath it
is the "new region" the decision forbids — and it is the easy accident, because the current
component owns its own container.

**Analog B — the upload affordance whose `accept=` is kept in lockstep.** `TemplateUpload.tsx`
(whole file, 84 L). The load-bearing parts:

```tsx
export function TemplateUpload() {
  const threadId = useViewingThread()
  const { setWorkspaceFileForThread } = useStreamActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (f: File) => {
    if (!threadId) return
    setUploading(true)
    try {
      const uploaded = await uploadWorkspaceTemplate(threadId, f)
      setWorkspaceFileForThread(threadId, uploaded)   // optimistic reconcile (no refresh)
      setUploadError(null)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed")
    } finally { setUploading(false) }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""            // ⭐ reset so re-selecting the SAME file fires change again
    if (f) void handleUpload(f)
  }
  …
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp"
        aria-label="Upload template file"
        tabIndex={-1}
        className="hidden"
        onChange={onFileInputChange}
      />
      …
      {uploadError && (
        <p role="alert" className="px-0.5 text-[11px] text-destructive">{uploadError}</p>
      )}
```

Its docblock states the contract the composer must reuse rather than restate:

> `accept=` is a UX hint only — the server's `validate_upload` is the real gate … kept in lockstep
> with `workspace.py _ALLOWED_EXT`.

⚠ **The "lockstep" is a comment, not a mechanism.** The list is a hand-typed string literal here and
a Python set there; nothing fences them. A **third** hand-typed copy in the composer makes it three.
The plan should either export one shared constant or add a `?raw` fence — and `COPY.engine.ALLOWED_EXT`
in the sketch is already a fourth copy waiting to rot.

**Analog C — the shipped upload client.** `frontend/src/lib/api/documents.ts:56-78`:

```ts
export async function uploadWorkspaceTemplate(threadId: string, file: File): Promise<WorkspaceFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  const row = (await res.json()) as WorkspaceFile & { file_id?: string }
  return { ...row, id: row.id ?? row.file_id }     // ⛔ the server returns `file_id`, not `id`
}
```

⭐ **The `err.detail` throw is what carries the server's verbatim 422 to the UI** — which is exactly
what `COPY.engine.REFUSE_TYPE` / `REFUSE_SIZE` / `REFUSE_EMPTY` need (D-244-24's "the refusal copy
carries the server's verbatim 422"). The path already exists; the composer's refusal state renders
`e.message`.

Existing chat-shell caller: `ChatLayout.tsx:377`
(`if (templateFile) await uploadWorkspaceTemplate(thread.id, templateFile)`).

**Analog D — the expired chip (D-244-25).** `FilesSection.tsx:122-140` is the shipped, three-reading
expiry helper and its docblock is the decision record:

```ts
const EXPIRY_UNKNOWN = "expiry unknown"

function expiryCaption(expiresAt?: string): string {
  if (!expiresAt) return EXPIRY_UNKNOWN       // the wire did not say — say THAT
  const at = new Date(expiresAt).getTime()
  if (Number.isNaN(at)) return EXPIRY_UNKNOWN // an UNPARSEABLE date is a third case
  const ms = at - Date.now()
  if (ms <= 0) return "expired"
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `expires in ${h}h`
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`
}
```

⛔ **The rules it encodes and the chip must not break:** the word is `expiry unknown`, never
`no expiry`; unknown is **not amber** (`isNearExpiry` returns `false` for an absent value); the
return type is **total** (`string`, never `null`), which is what makes a blank unrepresentable.
The template row it feeds is `FilesSection.tsx:273, 313-323`.

**Analog E — `WorkspaceFile`, the wire type the chip reads.** `frontend/src/types/index.ts:1064-1074`:

```ts
export interface WorkspaceFile {
  id?: string
  path: string
  size_bytes: number
  mime_type: string
  version?: number
  created_at?: string
  updated_at?: string
  kind?: string          // 100: 'template_input' for ephemeral uploads (D-02 badge)
  expires_at?: string    // 100: ISO timestamp; drives countdown + amber tint (D-02)
}
```

⚠ `types/index.ts` measures **85 / 65 / 1380** and its ledger seam is still OWED; the 243 precedent
for touching it was **one optional client-only field**. Keep any addition to that size.

---

### 5. `SHELL-04b` — the cloud door re-point (D-244-05)

**The mount, verbatim (`MessageInput.tsx:633-641`) — the whole of the contained change:**

```tsx
      <ConnectedFilePickerModal
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        connections={connections}
        onFileImported={(doc) => {
          setValue((prev) => (prev ? `${prev}\nAttached file: ${doc.filename}` : `Please analyze attached file: ${doc.filename}`))
        }}
      />
```

⛔ **Note what the shipped callback does: it EDITS THE PERSON'S TYPED TEXT.** That is precisely the
arm D-244-02 rejects ("appending 'I've attached X' to the user's own message — it edits the person's
words"). The re-point must replace this callback with a chip, not extend it.

**The menu item being re-pointed (`MessageInput.tsx:363-379`) — and the one-item case (D-244-26):**

```tsx
                <DropdownMenuContent align="start" side="top" className="p-0 border-border/80 shadow-xl overflow-hidden mb-1">
                  {hasCloudStorage && (
                    <div className="p-1 border-b border-border/50">
                      <DropdownMenuItem
                        onSelect={() => { setPlusMenuOpen(false); setFilePickerOpen(true) }}
                        className="text-xs cursor-pointer gap-2 py-1.5"
                      >
                        <HardDrive className="h-4 w-4 text-primary" />
                        <span>Import from Cloud Storage...</span>
                      </DropdownMenuItem>
                    </div>
                  )}
                  <ConnectorsFlyout … />
                </DropdownMenuContent>
```

with `hasCloudStorage` derived at `MessageInput.tsx:304-311`:

```tsx
  const hasCloudStorage = connections.some(
    (c) => c.service_id.includes("google") || c.service_id.includes("workspace")
        || c.service_id.includes("drive")  || c.service_id.includes("onedrive"),
  )
```

⚠ The `+` trigger's `data-testid` is `"composer-plus-btn"` (`MessageInput.tsx:354`) — matches
`COPY.engine.PLUS_BTN_TESTID`, so the sketch's hook is real and does not need inventing.

**The client that must be replaced/re-pointed** — `frontend/src/lib/api/connectors.ts:466-485`
(`importCloudFile`, currently body-less POST to the Library-minting route). Today the modal's
`handleImport` (`ConnectedFilePickerModal.tsx:102-112`) calls it.

---

### 6. `SHELL-04c` — the Library's folder-asking single-file import (D-244-06/07)

**Backend route analog — `preview_source_folder`, `backend/app/api/connectors.py:1826-1840`:**

```python
@router.post(
    "/connections/{connection_id}/preview",
    response_model=SourcePreviewResponse,
    summary="See exactly what bringing a source folder in would do (PREV-01 / PREV-03)",
)
async def preview_source_folder(
    connection_id: str,
    body: SourcePreviewRequest,          # ⭐ THE BODY — this is the shape :1787 must gain
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
) -> SourcePreviewResponse:
```

**The route to change — `import_connection_file`, `connectors.py:1781-1811`, currently body-less:**

```python
@router.post(
    "/connections/{connection_id}/files/{file_id}/import",
    summary="Import one named file from connected cloud storage (ATTACH-01)",
)
async def import_connection_file(
    connection_id: str,
    file_id: str,
    background_tasks: BackgroundTasks,
    active_org: str = Depends(get_active_org_id),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    …
        return await import_single_file(
            connection=conn,
            file_id=file_id,
            user_id=user["id"],
            active_org=str(active_org),
            background_tasks=background_tasks,
            supabase=supabase,
        )                                  # ⛔ no folder_id → lands at root (BUG-260905-01)
```

**⚠ The exception-ordering pattern is load-bearing and must be preserved in any edit**
(`connectors.py:1813-1824`):

```python
    # ⚠ BEFORE the broad handler below, which turns anything it catches into a 502 "the
    # provider returned an error". A disabled connection is not a provider error …
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except Exception as exc:
        logger.error("Failed to fetch file %s from connection %s: %s", file_id, connection_id, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to download cloud file: {exc}")
```

**Pydantic body analog — `SourcePreviewRequest`, `backend/app/models/connector.py:713-736`, on
`_StrictBase` (`:61-70`, `ConfigDict(extra="forbid")`):**

```python
class SourcePreviewRequest(_StrictBase):
    """Which source folder to look at, and where its files would land."""
    folder_id: str | None = None
    folder_name: str | None = None
    #: The Library folder the person chose. `None` = root.
    destination_folder_id: str | None = None
    …
```

⭐ **The refusal pattern for an unset value (D-244-06's "unset folder = refuse, never silently root")
has NO existing analog — `destination_folder_id: str | None = None` means root, by design, on the
folder door.** The cheapest mechanical refusal is a **required** field on the new body model
(`destination_folder_id: str` with no default) — FastAPI + `_StrictBase` then return a 422 before
the handler runs, and the refusal cannot be forgotten in a branch. A hand-rolled
`if not body.folder_id: raise HTTPException(422, …)` is the alternative and needs a driven RED case.
⚠ `models/connector.py` measures **24 / 13 / 772** and fires G-5; its 239 precedent was "no new
field, no shape change, no migration". A new *request* model is additive and stays in that spirit.

**The minter, and the ONLY one — `import_single_file`, `backend/app/services/sources/import_service.py:169-181`:**

```python
async def import_single_file(
    connection: Any,
    file_id: str,
    user_id: str,
    active_org: str,
    background_tasks: BackgroundTasks,
    supabase: Client,
    folder_id: str | None = None,      # ⭐ ALREADY ACCEPTS IT (Phase 233 / D-233-01)
    external_id: str | None = None,
    source_version: str | None = None,
    source_system: str | None = None,
    source_path: str | None = None,
) -> dict[str, Any]:
```

reaching the minter at `import_service.py:236-247`:

```python
    mint_result = await ingest_splice.async_mint_document_row(
        raw=raw_bytes, filename=filename, mime_type=mime_type, user_id=user_id,
        supabase=supabase, folder_id=folder_id, metadata=metadata,
        org_id=str(active_org), source_connection_id=str(conn_id) if conn_id else None,
        ingest_visibility=ingest_vis,
    )
```

**The caller to copy — `preview_service.confirm_preview`, `preview_service.py:756-778`**, which
passes `folder_id=destination_folder_id` and `source_path=item.source_path` and wraps every failure
as a **named** refusal:

```python
        except Exception as exc:  # noqa: BLE001 — a refusal is NAMED, never a silent drop
            outcomes.append(ConfirmOutcome(external_id=item.external_id, name=item.name,
                outcome="refused", reason=str(exc)[:400] or "This file could not be read."))
```

⛔ **`mint_document_row` / `splice_document` stay the only minter** — `import_single_file` is the
seam; do not add an insert.

**Frontend client analog — `postPreview` + `previewSource`, `frontend/src/lib/api/connectors.ts:673-697`:**

```ts
async function postPreview<T>(connectionId: string, path: string, body: SourcePreviewRequest, failMsg: string): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/connectors/connections/${encodeURIComponent(connectionId)}/${path}`,
    { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  )
  if (!res.ok) {
    const failure = await readConnectorFailure(res)
    throw new ConnectorApiError(failure.message || failMsg, res.status, failure.reasonCode)
  }
  return res.json() as Promise<T>
}
```

⚠ `frontend/src/lib/api/connectors.ts` measures 16 / 10 / 718 and the ledger records **three
wire-type drifts in `lib/api/org.ts` alone** — declare the new request type beside
`SourcePreviewRequest` (`:663-671`), never inline in a component.

**Where the Library door lands — `LibraryPage.tsx:642-649`, the existing upload mount:**

```tsx
      <DocumentUpload
        onUpload={upload}
        uploading={uploading}
        uploadingCount={uploadingCount}
        folderId={selectedFolderId}
        folderName={selectedFolderName}
        disabled={!canUploadToFolder}
      />
```

⭐ **`selectedFolderId` / `selectedFolderName` / `canUploadToFolder` are already computed on this
page** (`:336-348`) — the folder-asking import gets its destination from the page's existing
selection rather than inventing a picker. ⚠ `canUploadToFolder` (`:348`) is the shipped permission
predicate (`!selectedFolderId || selectedFolder.user_id === user?.id`) — reuse it.
`LibraryPage.tsx` measures 44 / 14 / 922 and fires G-5.

---

### 7. `SHELL-04d` — the system-prompt attachment line (D-244-02)

**The exact site, named as D-244-02 requires: `backend/app/services/agent_loop.py`, inside
`run_agent_loop` (declared `:1163`), between `:1292` and `:1570`.** It is the **shared path** — the
provider split happens below, at `create_streaming_chat`; nothing here is provider-specific.

The base selection (`:1291-1299`):

```python
    if body.agent_mode == "explorer":
        active_system_prompt = EXPLORER_SYSTEM_PROMPT
        active_tools = get_explorer_tools()
        max_iterations = 8
    else:
        active_system_prompt = SYSTEM_PROMPT
        active_tools = None
        max_iterations = 15
```

**There are FIVE shipped conditional-append sites, all the same shape** — copy any of them:

| Site | Line | Gate |
|---|---|---|
| `folder_scope_note` | `:1303-1311` | `if scoped_folder_path:` |
| `catalog_note` (skills) | `:1426-1432` | General mode only |
| `memory_note` | `:1447-1453` | `if memory_rows:` |
| `disabled_note` | `:1467-1473` | `if disabled_tools:` |
| `connector_note` | `:1555-1562` | `if service_lines:` |

The canonical shape (`:1447-1453`):

```python
        if memory_rows:
            memory_lines = "\n".join(f"- {r['key']}: {r['value']}" for r in memory_rows)
            memory_note = (
                "\n\n## User Memory\n"
                "(Preferences and facts you've remembered about this user across conversations)\n"
                f"{memory_lines}"
            )
            active_system_prompt = active_system_prompt + memory_note
```

and it terminates at `:1570`:

```python
    messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
```

⚠ **All five appends except `folder_scope_note` sit inside the `if body.agent_mode != "explorer":`
block (opens `:1314`).** A plan must rule on whether an attachment announcement is General-only or
both modes — Explorer's tool set (`get_explorer_tools()`) may not even carry `workspace_read`, which
would make an announcement in Explorer a promise the agent cannot keep. **Check before placing it.**

**Where the list comes from — `backend/app/db/workspace.py:187-223`, `list_files_in_thread`**, which
already applies the expiry gate in SQL:

```sql
            SELECT id, path, size_bytes, mime_type, created_at, updated_at, kind, expires_at
            FROM workspace_files
            WHERE thread_id = $1
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY path
```

⭐ **So the prompt line inherits "not expired" for free** — no second expiry rule on the prompt side,
which is the D-244-04 read-gate discipline honoured by construction.

⚠⚠ **Cross-provider obligation (D-244-02):** the 8-row roster, derived from `MODEL_CAPABILITIES`, not
re-typed. Moonshot/Kimi is the only `emit_tier: coerce` native row; every OpenRouter row is
`native_tools: False`. A blocked row is recorded ⛔ with its reason, never dropped.

---

### 8. `SHELL-05` — verify, then attribute the tab

**The registry (the decision record), `attentionConditions.ts:120-146`:**

```ts
export function useStoppedSourceConditions(onOpen: () => void): AttentionCondition[] {
  const { stopped } = useSourceAttention()
  return useMemo(
    () => stopped.map((source) => ({
        id: source.watch_id,
        title: source.source_folder_name,
        detail: SENTENCE_FOR_CAUSE[source.cause](source.connection_name ?? ""),
        onOpen,
      })),
    [stopped, onOpen],
  )
}

export const ATTENTION_PRODUCERS: readonly AttentionProducer[] = Object.freeze([
  { key: "stopped-sources", use: useStoppedSourceConditions },
])
```

**The one read, `ChatLayout.tsx:534-544`:**

```tsx
  const openLibraryHealth = useCallback(() => onOpenLibraryHealth?.(), [onOpenLibraryHealth])
  const attentionConditions = attentionRegistry.ATTENTION_PRODUCERS.flatMap((producer) =>
    producer.use(openLibraryHealth),
  )
  const attentionCount = attentionConditions.length
  const showAttention = attentionCount > 0 && Boolean(onOpenLibraryHealth)
```

**Three renderers hang off it:** `NavPanel` props (`:559-560`), the drawer nav row badge
(`:720-724`), the hamburger dot (`ChatArea attentionCount=` `:808`).

**The renderer, `AttentionPopover.tsx:73-108`** — ⛔ it derives no count and renders no verdict;
it is handed conditions and draws them. Each row is `title` + `detail`; the only control is
`rail-open-health` → `onOpenLibraryHealth`.

**The navigation pattern, and the one to copy for the tab attribution** —
`frontend/src/App.tsx:179-182`:

```tsx
  const handleOpenLibraryHealth = () => {
    setLibraryTab("health")
    setActiveView("documents")
  }
```

paired with the **one-shot lifetime rule**, `frontend/src/lib/libraryTabHandoff.ts` (a strict leaf,
no React, no runtime imports):

```ts
export const LIBRARY_VIEW = "documents"

export function libraryTabAfterNavigate<T>(pending: T | undefined, nextView: string): T | undefined {
  if (pending === undefined) return undefined
  return nextView === LIBRARY_VIEW ? pending : undefined
}
```

consumed at `App.tsx:194-197`:

```tsx
  const handleNavigate = (next: ActiveView) => {
    setActiveView(next)
    setLibraryTab((pending) => libraryTabAfterNavigate(pending, next))
  }
```

⛔ **This module exists because a comment made a claim and nothing enforced it** — one click on the
popover permanently redefined where the Library opens. Any per-tab attribution must go through this
same spent-on-navigate rule, not a second writer.

**The tab vocabulary — `frontend/src/pages/librarySelection.ts:94`:**

```ts
export type LibraryTab = "documents" | "views" | "ingestion" | "indexing" | "health"
```

and `LibraryPage.tsx:99-105` derives the header control from `TAB_LABELS`, "never re-typed".

**See C-5** for the measured answer on whether the kind is available. Short version, for the plan to
quote: **the condition does not carry a kind; the producer does (`AttentionProducer.key`), and the
raw cause exists upstream on `StoppedSource.cause` but is discarded into `detail`.**

⚠ **The reader count.** Adding the tab mapping must not add a **third** `useSourceAttention()` — the
registry's own re-open trigger arm 1. Today there are exactly **two** (the shell, plus the Library's
active tab body), pinned by a `?raw` inventory fence in `ChatLayout.badge.test.tsx:286-297, 374`.

---

## Shared Patterns

### S-1 — Navigation is a callback, never a URL (`SEED-185`)
**Source:** `attentionConditions.ts` (`onOpen` docblock) · `AttentionPopover.tsx:19-23` ·
`App.tsx:194`. **Apply to:** the tab attribution, any new Library door, any chat↔Library hop.
This app has twelve views and zero addressable routes.

### S-2 — Empty ⇒ render nothing; no reserved space, no all-clear chrome
**Source:** `ActiveConnectorChips.tsx:24` (`if (activeConnectorIds.length === 0) return null`),
`AttentionPopover.tsx:75` (`if (conditions.length === 0) return null`),
`PendingAskCard.tsx:733` (`if (asks.length === 0) return null`).
**Apply to:** the attachment chip, the inline approval mount, the tab badge.

### S-3 — An absent value SAYS SO; three readings, not two
**Source:** `FilesSection.tsx:90-140` (`expiry unknown` / `expired` / `expires in Nh`, total return
type) · `useSourceAttention.ts:56-78` (`loading` / `!loading && !verdictKnown` / `!loading && verdictKnown`).
**Apply to:** the expired chip (D-244-25), any attention count rendered per tab.
⛔ *"A consumer that reads only `loading` + `stopped` will print an all-clear it never received."*

### S-4 — The server's verbatim sentence, never a paraphrase
**Source:** `documents.ts:70-73` (`err.detail` → thrown message), `TemplateUpload.tsx:79-81`
(`role="alert"` inline), `sourceHealthVocabulary.SENTENCE_FOR_CAUSE`.
**Apply to:** the `.pdf` refusal copy (D-244-24), the import refusal.
⚠ `AttentionPopover.tsx` writes **no copy at all** — the vocabulary leaf owns the words.

### S-5 — `run_in_threadpool` / `aexec` for every supabase-py call (D-v2.5-01)
**Source:** every call in `connectors.py` and `runs.py` is wrapped in `aexec(...)`.
**Apply to:** the new import route body, any `cap_paused` row write.

### S-6 — A new suite needs BOTH gate knobs
Measured in `scripts/vitest-count-gate.cjs`: `"src/components/chat"` appears **zero** times as a
bare directory entry (`:4338` records the deliberate decision); `"src/components/layout"`,
`"src/components/panel"` and `"src/hooks"` likewise have **no** bare-directory entries. Every
relevant suite is reached FILE-BY-NAME:

| Suite | `TARGETS` line | `BASELINE` pin |
|---|---|---|
| `MessageItem.capPaused.test.tsx` | `:4755` | `:3352` → `5` |
| `MessageItem.continueButton.test.tsx` | `:4735` | `:3332` → `2` |
| `MessageInput.connectors.test.tsx` | `:4519` | `:230` → `5` |
| `NavPanel.badge.test.tsx` | `:4796` | `:3420` → `14` |
| `ChatLayout.badge.test.tsx` | `:4797` | `:3421` → `5` |
| `useSourceAttention.test.tsx` | `:4798` | `:3422` → `13` |
| `StepIdentity.coverage.test.tsx` | (dir `src/components/workflows`) | `:3161` → `23` |

⭐ `StepIdentity.coverage.test.tsx` is the one that needed **only** a BASELINE pin, and its docblock
says why: *"That directory is a `TARGETS` entry … so this suite is gated the moment it exists — no
gate edit, and no window in which a coverage suite is itself uncovered."*
⛔ **A new suite under `chat/`, `layout/`, `panel/` or `hooks/` needs BOTH lines, in the same commit.**

### S-7 — Fetch-mounting hooks live in a narrow child, never at a list row's top level
**Source:** `MessageItem.tsx:180-194` + `HarnessOuterBanner` (`:198`).
**Apply to:** the `PendingAskStack` chat mount (C-3). The measured number in that docblock is
**6 fetches vs 1** at six rows.

### S-8 — G-5: nine hot files, five triples stale, all rows present
`node scripts/check-hot-file-ledger.cjs 244` will not fail on a missing row (D-244-20 verified it).
⚠ **Re-derive rather than copy** — and two rows drifted again since CONTEXT was written:
`MessageItem.tsx` reads `68/33/755` in the ledger, `MessageList.tsx` reads `20/8/300`,
`ChatArea.tsx` `70/35/678`, `NavPanel.tsx` `20/11/329`, `PendingAskCard.tsx` `13/7/736`.
⛔ **Same-commit sync rule:** the CLAUDE.md row and the `docs/HOT-FILE-LEDGER.md` section move
together; the disposition cell is capped at **200 chars** by `scripts/check-claude-md-size.cjs`.

---

## Measured facts the plan was told to RULE on, not discover

### `_ALLOWED_EXT`, verbatim (`backend/app/api/workspace.py:124-130`)

```python
_OOXML_EXT = {".docx", ".pptx", ".xlsx"}
# Text-ish skill assets — validated as utf-8-decodable + NUL-free (D-09).
_TEXT_EXT = {".md", ".json", ".csv", ".txt", ".py", ".js", ".sh"}
# Images — validated by leading magic bytes (D-09).
_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
# The full set the door accepts — kept in lockstep with TemplateUpload.tsx accept=.
_ALLOWED_EXT = _OOXML_EXT | _TEXT_EXT | _IMAGE_EXT
```

**Fifteen extensions. No `.pdf`.** The refusal the person sees (`workspace.py:203-206`):

```python
    if ext not in _ALLOWED_EXT:
        raise HTTPException(
            422, f"Unsupported type {ext or '(none)'}. Allowed: {', '.join(sorted(_ALLOWED_EXT))}"
        )
```

— which renders exactly `COPY.engine.REFUSE_TYPE`'s sentence, alphabetically sorted, as the sketch
draws it.

**What taking `.pdf` would actually cost (D-244-24 says rule, do not assume):** `validate_upload`
(`:184-218`) dispatches to three category validators — `_validate_ooxml_container` (ZIP EOCD +
`[Content_Types].xml` + a per-type part-name marker), `_looks_like_text`, `_image_magic_ok`.
**There is no fourth branch and no PDF container validator anywhere in `workspace.py`.** A `.pdf`
added to `_TEXT_EXT` would fail `_looks_like_text` (PDFs are NUL-bearing binaries); added bare to
`_ALLOWED_EXT` it would reach the *unreachable* belt-and-braces 422 at `:217`. So the honest cost is
**a new `_PDF_EXT` category plus a magic-byte branch** (`raw[:5] == b"%PDF-"` at minimum), mirroring
`_image_magic_ok`'s shape — **plus** updating `TemplateUpload.tsx`'s `accept=`, the composer's
`accept=`, and `COPY.engine.ALLOWED_EXT`. The three other caps (10 MB × 3, the sanitiser, the TTL)
are type-agnostic and need nothing.

### The cap-paused write picture — see **C-2**. One sentence for the plan:
`POST /threads/{id}/messages` has **no `cap_paused` refusal**, inserts a **new** `runs` row, and
**nothing** clears the old `cap_paused` row except `POST /runs/{id}/continue`
(`backend/app/api/runs.py:1082-1086`). The lock read is unbounded in time
(`threads.py:1243-1249`). **This is determinable from source, and the answer is that the lock returns.**

### The chat-list click handler — see **C-6**. One sentence:
`ChatHistoryColumn.tsx:166` is `onClick={() => onSelectThread(thread)}` → `useThreads.ts:35`
`setSelectedThread(thread)` → `ChatLayout.tsx:796` `thread={selectedThread}`. **There is no
select-then-open two-step in the source**, so `BUG-260911-02` must be driven, not patched.

---

## No Analog Found

| File / concern | Role | Data flow | Why nothing matches |
|---|---|---|---|
| **PDF container validation** in `backend/app/api/workspace.py` | validator | file-I/O | Three category validators exist (OOXML ZIP, utf-8 text, image magic bytes). Nothing in the repo validates a PDF container; `pypdf` is in the sandbox image, not in the API process. Net-new if D-244-24 takes `.pdf`. |
| **"Unset destination ⇒ refuse"** on a connector import | route guard | request-response | The shipped folder door does the opposite by design: `SourcePreviewRequest.destination_folder_id: str \| None = None` with `#: None = root`. The closest mechanical route is a **required** field on a `_StrictBase` model (FastAPI 422 before the handler), which is a *shape*, not an analog. Drive it RED. |

Two further items have an analog but are **compositions, not copies**, and should be planned as such:
- The chips-row **container ownership** change (§4 Analog A) — `ActiveConnectorChips` owns its own
  `<div>`; "a sibling, not a new region" requires hoisting or a slot.
- The **scope word surviving into the sent message** (D-244-22's build obligation) — the transcript
  side has no chip renderer at all today. `MessageItem`'s user-row render is the host; the read-only
  chip is net-new presentational code with `ActiveConnectorChips` as its visual analog only.

---

## Metadata

**Analog search scope:** `frontend/src/components/{chat,layout,panel,library,metadata,ingestion,sources,ui}`,
`frontend/src/{hooks,lib,lib/api,pages,providers,stores,types}`,
`backend/app/{api,services,services/sources,db,models}`, `scripts/vitest-count-gate.cjs`,
`docs/HOT-FILE-LEDGER.md`.
**Files read in full or by targeted range:** 41.
**Pattern extraction date:** 2026-09-11.
**Read-only:** no source file was modified; this document is the only write.
