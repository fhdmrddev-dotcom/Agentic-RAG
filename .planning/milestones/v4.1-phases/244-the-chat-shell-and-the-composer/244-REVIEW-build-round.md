<!-- PRESERVED 2026-09-12 by /gsd:execute-phase 244 (gap-closure round 1).
     This is the BUILD round's review (diff_base 223b3ea4f, 29 files), kept verbatim
     because the round-1 review writes a fresh 244-REVIEW.md over a different diff base.
     Its still-OPEN findings are WR-04, WR-07, WR-08 and IN-01..IN-09.
     WR-07 was CLOSED by 244-13 (same defect as G-1). The rest are tracked with
     fireable re-open triggers in deferred-items.md. -->
---
phase: 244-the-chat-shell-and-the-composer
reviewed: 2026-09-12T00:00:00Z
depth: standard
diff_base: 223b3ea4f
files_reviewed: 29
files_reviewed_list:
  - backend/app/api/connectors.py
  - backend/app/api/threads.py
  - backend/app/api/workspace.py
  - backend/app/models/connector.py
  - backend/app/models/workspace.py
  - backend/app/services/agent_loop.py
  - backend/app/services/tool_dispatcher.py
  - frontend/src/components/chat/ActiveConnectorChips.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/ChatAttachmentChip.tsx
  - frontend/src/components/chat/ConnectedFilePickerModal.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/components/chat/composerCopy.ts
  - frontend/src/components/chat/useComposerAttachments.ts
  - frontend/src/components/layout/ChatHistoryColumn.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/attentionConditions.ts
  - frontend/src/components/library/LibraryCloudImport.tsx
  - frontend/src/components/library/LibraryHeaderBar.tsx
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/components/panel/TemplateUpload.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/api/connectors.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/workspaceAllowedExt.ts
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/providers/StreamsProvider.tsx
findings:
  critical: 1
  warning: 8
  info: 9
  total: 18
status: partially_resolved
resolved_by: 244-07
resolved_at: 2026-09-12
resolved:
  - CR-01   # both composer attach doors silent with no thread — refuses visibly, cloud verb throws
  - WR-01   # announcement had no kind filter — allow-list on template_input, in the renderer
  - WR-02   # "once per session" was per-iteration — marker moved to a WeakSet of sessions
  - WR-03   # "General mode only" excluded only explorer — harness now excluded too
  - WR-05   # folder_id accepted "" — LibraryFolderId validates UUID shape, still a str
  - WR-06   # folder 403/404 and duplicate 409 masked as 502 — except HTTPException: raise
open:
  - WR-04   # cloud attach buffers the whole provider file before the 10 MB cap
  - WR-07   # workflowLocked unlocks a genuine harness lock when the run is cap-paused (LATENT)
  - WR-08   # transcript says "Read <file>" for a turn that could not read it
  - IN-01
  - IN-02
  - IN-03
  - IN-04
  - IN-05
  - IN-06
  - IN-07
  - IN-08
  - IN-09
# ⛔ Every `open` item carries a concrete re-open trigger in `deferred-items.md` (items 7-10).
# A finding that lives only in a review file is a deferral with no re-open, which is a deletion
# that looks like a decision.
---

> ⚠ **STATUS, 2026-09-12 — SIX OF EIGHTEEN ARE CLOSED AND TWELVE STAND.** `244-07` fixed the six
> the operator scoped (`CR-01`, `WR-01`, `WR-02`, `WR-03`, `WR-05`, `WR-06`), each with a RED
> drive committed before its GREEN. All six reproduced against the CURRENT file first; none was
> already fixed. The findings below are **left verbatim, never edited to match the code** — a
> review is the record of what was true when it was written, and the frontmatter above is where
> the disposition lives. Full account: `244-07-SUMMARY.md`.
>
> ⚠ `WR-08` is worse-SHAPED after `244-07`, not worse: `WR-03` adds `harness` to the excluded
> set, so there are now **two** modes for which the `Read <file>` line's justification fails.

# Phase 244: Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard (per-file analysis of the diff `223b3ea4f..HEAD`, language-aware)
**Files Reviewed:** 29 non-test source files
**Status:** issues_found

## Summary

Six plans across both tiers: the `min-h-0` scroll frame, thread-row identity + the hit-test sink,
workspace attachments the agent can read, the cap-pause composer unlock, the inline approval, the
attention tab attribution, and the two re-pointed cloud doors.

**What held up under adversarial reading, verified rather than accepted:**

- **The allow-list lockstep is a real mechanism, not a comment.**
  `frontend/src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts` imports
  `backend/app/api/workspace.py` with `?raw`, parses all four `_*_EXT` set literals, asserts
  **set equality** against `WORKSPACE_ALLOWED_EXT`, and separately asserts that `_ALLOWED_EXT`
  unions all four names. A member added on one side goes red. The claim is supported.
- **Path traversal via a filename is closed.** `_attachment_container_path`
  (`tool_dispatcher.py:1783`) normalises backslashes → `os.path.basename` → charset narrow →
  `lstrip(".")` → length cap → non-empty fallback. `../../etc/passwd` reduces to `passwd`, and the
  result is always `/{_ATTACHMENTS_DIR}/{basename}`. The prompt renderer imports **that same
  function** rather than re-deriving, so there is one rule with one home.
- **Prompt injection through the announcement is closed.** The announced name is derived from the
  container path (charset `[A-Za-z0-9._\- ]`, cap 120), then passed through `_one_line`, which
  strips CR/LF/control chars and every markdown structure character. A filename cannot open a
  heading, a fence or a list inside the system prompt.
- **Cloud import destination is not an IDOR.** `import_single_file` → `async_mint_document_row`
  (`ingest_splice.py:154-168`) validates the folder exists and `user_id` matches, 404/403
  otherwise; the connection itself is resolved org-scoped
  (`connector_service.get_connection(..., org_id=active_org)`).
- **The ingest splice is respected.** The Library door still mints through
  `async_mint_document_row` + `_enqueue_or_splice`; `backend/app/api/workspace.py` imports neither
  `import_single_file` nor `ingest_splice` (the only occurrence is inside a docstring), so the chat
  door structurally cannot write a `documents` row.
- **The cap-pause lock bound is server-side.** `threads.py:1243-1276` now reads the thread's
  **latest** run and then tests `status == 'cap_paused'`, so the client boolean cannot resurrect a
  stale pause and the client half alone is not load-bearing. It adds no second writer of
  `runs.status`.
- **The gate registry was not weakened.** `git diff --numstat` on `scripts/vitest-count-gate.cjs`
  reads `305 0` — purely additive, no entry deleted.
- **No new type errors.** `npx tsc -p tsconfig.app.json --noEmit` in `frontend/` reports **67**
  errors at HEAD, identical to the recorded base count.

**Key concerns.** One blocker: both composer attach doors are a **silent no-op on a chat that has
no thread yet**, which is the most likely place a person first tries the phase's headline feature —
and the cloud door reports success while doing nothing. Beyond that, three claims written into the
code do not match what the code does (hydration "once per session", the announcement "General mode
only", and the required-`folder_id` refusal), and the attachment announcement tells the model that
agent-written scratch files are files "the user attached" and that they "expire" when they do not.

---

## Critical Issues

### CR-01: Both composer attach doors silently do nothing on a chat with no thread — and the cloud door reports success

**File:** `frontend/src/components/chat/useComposerAttachments.ts:75`, `:98`
**Also:** `frontend/src/components/chat/ChatArea.tsx:571` (`{inputBar}` inside the `if (!thread)`
branch), `frontend/src/components/chat/ChatArea.tsx:435` (`threadId={thread?.id ?? null}`),
`frontend/src/components/chat/MessageInput.tsx:493-512` (the `+` menu items, ungated)

**Issue:** `ChatArea` renders the **same** `MessageInput` in its welcome/no-thread branch, passing
`threadId={null}`. Both attach verbs begin with `if (!threadId) return`:

```ts
const attachLocalFile = useCallback(async (f: File) => {
  if (!threadId) return          // :75
  ...
```

Neither `+` menu item is gated on `threadId`, so on a brand-new chat:

1. **Local door.** `+ → "Attach a file"` opens the OS dialog, the person picks `contract.pdf`,
   `onAttachInputChange` fires, `attachLocalFile` returns immediately. No chip, no `refusal`
   region, no console error, no request. The file was never uploaded and nothing on screen says so.
2. **Cloud door, worse.** `attachCloudFile` also returns at `:98` — it returns `undefined` rather
   than throwing, so `ConnectedFilePickerModal.handleConfirm` takes the success path, `onOpenChange(false)`
   runs in `finally`, and the modal closes exactly as it does on a real attach. The interaction is
   indistinguishable from success.

This is also a **regression on a shipped path**: before this phase the cloud modal's
`onFileImported` worked from a threadless composer (it imported to the Library and prefilled the
draft). After the re-point it is inert there.

The phase's own acceptance bar (`sketch 236`) is about a person putting a file into a conversation;
"open a new chat and attach a contract" is the first thing anyone will try.

**Fix:** decide the no-thread case explicitly instead of returning. Either disable the two menu
items with a reason when `threadId` is falsy, or create the thread first, or refuse loudly:

```ts
const attachLocalFile = useCallback(async (f: File) => {
  if (!threadId) {
    setRefusal({ fileName: f.name, message: "Send a message first — a file belongs to a conversation." })
    return
  }
  ...
```

and, at minimum, make `attachCloudFile` `throw` in the same branch so the modal cannot close as
though the pick took. A fence over "the `+` menu with `threadId === null`" belongs in
`ComposerAttach.composition.test.tsx`, which currently only exercises the threaded case.

---

## Warnings

### WR-01: The attachment announcement claims agent-written scratch files are "files the user attached", and that they expire

**File:** `backend/app/services/agent_loop.py:1661-1667`, `:1221-1230`

**Issue:** the announcement is built from `list_files_in_thread(pool, thread_id)`
(`backend/app/db/workspace.py:187-224`), which selects **every** `workspace_files` row for the
thread with `expires_at IS NULL OR expires_at > now()`. There is **no `kind` filter anywhere** —
`grep -n template_input backend/app/services/agent_loop.py` returns nothing. Per migration
`068_workspace_template_ephemeral.sql:19` the column is `kind IS NULL OR kind IN
('template_input','agent')`, and agent-written rows carry a NULL kind and a **NULL `expires_at`**
(so they always pass the gate).

Concrete failure: a Deep run where the agent calls `workspace_write` ten times produces ten rows.
The next turn's system prompt then says, verbatim:

> "The user attached these files to THIS conversation… They expire, so use them in this
> conversation rather than assuming they persist."

— about ten files the user never attached and that never expire. The transcript chip does filter
correctly (`ChatAttachmentChip.attachmentsForMessage` requires `kind === "template_input"` and its
docblock says *"an AGENT-written workspace file is not an attachment and must never wear this
chip"*), so the UI and the prompt disagree about the same set. The same unfiltered list drives
`_hydrate_thread_attachments`, so agent output is also copied into a directory named
`/sandbox/attachments/`.

**Fix:** apply the rule the chip already states, in the renderer and the hydrator:

```python
rows = [r for r in (_attachment_rows or []) if r.get("kind") == "template_input"]
```

If agent files are deliberately included, the prompt must not call them "attached by the user" and
must not claim they expire.

### WR-02: The hydration guard is per-ITERATION, not "once per sandbox session" — the DoS arm it names is still open

**File:** `backend/app/services/tool_dispatcher.py:2008-2020`

**Issue:** the comment states *"ONCE PER SESSION, in the exact shape of the
`_output_baseline_seeded` guard"* and *"re-copying on every call … on a 10 MB attachment it is the
DoS arm of T-244-02-05"*. The flag is stored on `ctx`:

```python
if not getattr(ctx, "_attachments_hydrated", False):
    ctx._attachments_hydrated = True
```

but `ToolContext` is constructed **once per agent-loop iteration** —
`backend/app/services/agent_loop.py:2790` says so literally: *"Phase 083 D-01: construct
ToolContext once per iteration."* A fresh object means a fresh `getattr` default, so the guard only
suppresses re-copies among parallel tool calls **inside one iteration**.

Concrete: a thread with a 10 MB `.xlsx` attachment, a run that calls `execute_code` in eight
separate iterations → **eight** full copies (temp file write + `copy_to_runtime`) of the same 10 MB,
≈80 MB of container I/O per run. The stated bound is 50 files, so the worst case is 500 MB per
iteration.

**Fix:** key the guard on something that lives as long as the sandbox session — e.g. a marker file
inside the container (`test -d /sandbox/attachments/.hydrated`), or a module-level
`set[thread_id]` beside the session cache, or hang the flag on the `session` object rather than on
`ctx`. If per-iteration is acceptable, delete the "once per session" claim rather than leaving it.

### WR-03: The announcement is not "General mode only" — harness runs get it too, against their phase whitelist

**File:** `backend/app/services/agent_loop.py:1389` (the enclosing gate), `:1642-1670`

**Issue:** the block sits inside `if body.agent_mode != "explorer":`, and the comment plus
`244-02-SUMMARY.md`'s key-decision both describe this as *"General mode only"*. `agent_mode` has a
third value — `"harness"` (see `_apply_origin_filter`, `agent_loop.py:960`) — and it is **not**
excluded. A harness phase carries `ToolContext.phase_whitelist`, and a tool not in that set is
refused at dispatch.

Concrete: a workflow phase whose whitelist omits `execute_code` and `workspace_read` still receives
*"read ANY of them … from the path below inside execute_code"*. The model then attempts a tool that
is refused — which is the precise failure the explorer exclusion exists to avoid ("a promise the
agent cannot keep … strictly worse than silence because the model will try").

**Fix:** gate on the mode the decision names, not on the negation of one other mode:

```python
if body.agent_mode not in ("explorer", "harness"):
```

or condition the line on the effective tool set (`"execute_code" in {t names}`), which also keeps
it honest if the whitelist changes.

### WR-04: The cloud attach downloads the whole provider file into memory before the 10 MB cap is applied

**File:** `backend/app/api/workspace.py:400`, cap at `:322`

**Issue:** the local door pre-checks `file.size` **before** materialising the body (WR-04,
`:288-290`), and `_persist_workspace_upload`'s docstring says the caller still owns that
short-circuit *"because only a multipart part declares a size before it is materialised"*. That is
not true of the cloud door: `CloudFileItem` (the row the picker already rendered) carries a size,
and `body.file_id` could be size-checked against the listing before the fetch. Instead:

```python
filename, raw, _mime = await fetch_cloud_file(conn, body.file_id)   # :400 — unbounded
...
if len(raw) > MAX_FILE_SIZE:  # :322 — after the whole object is resident
```

`fetch_cloud_file` → `adapter.read_file` has no size bound of its own. Concrete: an authenticated
user picks a 2 GB video from their own Drive; the backend buffers 2 GB in a worker process
(`WORKER_COUNT=2`) and only then answers 422. Two such requests can exhaust the box for every
tenant.

Pre-existing on the Library import path (`import_single_file` has the same shape); **new here** in
that the workspace door is a new route that inherits it while documenting a guard it does not have.

**Fix:** resolve the provider's declared size before downloading and refuse early, mirroring
WR-04's ordering — e.g. look the id up in the adapter's listing/metadata call and
`raise HTTPException(422, "File too large. Maximum size is 10 MB.")` before `read_file`. A streaming
read with a running byte counter that aborts past `MAX_FILE_SIZE` is the stronger version.

### WR-05: `folder_id: str` is required but not non-empty — the documented "refusal by the model" does not cover `""` or a non-UUID

**File:** `backend/app/models/connector.py:763`, consumed at
`backend/app/services/ingest_splice.py:154`

**Issue:** the docstring claims *"Because the field has no default and `_StrictBase` is
`extra="forbid"`, FastAPI answers **422 before the handler runs**, so the refusal cannot be
forgotten in a branch a future edit adds."* Pydantic's bare `str` accepts `""`, and the ownership
gate downstream is truthiness-based:

```python
if folder_id:                       # ingest_splice.py:154 — "" skips the whole check
    folder_check = supabase.table("folders")...
```

Concrete: `POST /connectors/connections/{id}/files/{fid}/import` with `{"folder_id": ""}` passes
validation, skips the 404/403 ownership check entirely, and reaches the insert at
`ingest_splice.py:241` with `"folder_id": ""` — which a `uuid` column rejects, producing a 500
(further masked as a 502 by WR-06). A non-UUID string like `"root"` behaves the same way. The
UI cannot send this (`LibraryCloudImport.handleConfirm` guards `if (!folderId) return`), so this is
API-surface only — but the guarantee is written as structural and it is not.

**Fix:** make the type carry the constraint, which is what the docstring promises:

```python
from uuid import UUID
folder_id: UUID          # or: folder_id: str = Field(min_length=1)
```

`UUID` also gives a 422 for `"root"`, and the handler already stringifies on the way in.

### WR-06: `import_connection_file` turns the folder 403/404 and the duplicate 409 into a 502 "the provider returned an error"

**File:** `backend/app/api/connectors.py:1819-1838`

**Issue:** the route has `except SourceConnectionDisabled` and then a bare `except Exception` that
wraps everything in a 502 — with **no `except HTTPException: raise`** in between. Starship
`HTTPException` is an `Exception`, so every deliberate refusal raised deeper is relabelled. Before
this phase the route never passed `folder_id`, so `async_mint_document_row`'s ownership branch was
unreachable; passing it (`:1824`) makes those raises live.

Concrete: importing into a folder owned by someone else returns

```
502 {"detail": "Failed to download cloud file: 403: Cannot upload to a folder you do not own"}
```

and `LibraryCloudImport` renders exactly that sentence in its refusal strip — while the file was
never downloaded and the fault is not the provider's. The `on_conflict="raise"` duplicate 409 and
the "Folder not found" 404 are mangled the same way. The new workspace route added in this same
phase gets this right (`workspace.py:405-406` has `except HTTPException: raise`), so the two doors
disagree.

**Fix:** add the arm the sibling route already has, immediately before the catch-all:

```python
    except SourceConnectionDisabled as exc:
        raise _disabled_connection_response(exc) from None
    except HTTPException:
        raise
    except Exception as exc:
        ...
```

### WR-07: `workflowLocked` unlocks a genuine harness lock whenever the workflow run itself is cap-paused

**File:** `frontend/src/components/chat/ChatArea.tsx:140`

**Issue:**

```ts
const workflowLocked = workflowLock !== null && !workflowLock.capPaused
```

`capPaused` is set from two different places. The **second** branch (`:208-217`) is the synthetic
Deep lock this phase means to release. The **first** branch (`:200-207`) is a genuine harness lock
and it copies the server's flag straight through: `capPaused: state.cap_paused`. Server-side,
`cap_paused = run_status == "cap_paused"` where `run_status` is `workflow_runs.status`
(`threads.py:1236`), and `_TERMINAL_WORKFLOW_STATUSES` is `("completed","failed","cancelled")` —
so `cap_paused` is **non-terminal**, meaning `locked=True` and `cap_paused=True` can be returned
together. In that state the composer enables, the person types and sends, and
`workflow_kickoff.preflight_workflow_kickoff:174` answers **409 "Thread is workflow-locked"** —
the exact "UI instructs an action it forbids" inversion this phase exists to remove, one branch
over.

The ChatArea comment asserts *"a genuine harness run still reads 'Workflow running — Cancel to
switch back' on both axes"*; nothing in the expression enforces that.

⚠ **Reachability, stated honestly:** `workflow_runs.status='cap_paused'` is schema-valid
(`063_dual_mode_continue.sql:57`, added explicitly "on BOTH status" columns) and is treated as a
live non-terminal state by `db/workflows.py:1320` and `api/workflows.py:1774`. **I could not find a
current writer of that value on `workflow_runs`** (every `cap_paused` write I could locate targets
`runs.status`), so today this is latent rather than firing. D-244-08's own wording asked for both
conjuncts; only one was implemented.

**Fix:** discriminate the two lock origins rather than relying on `mode`, which the comment
correctly notes is a single-member literal — e.g. carry the server's `locked` onto the lock and
gate on it:

```ts
const workflowLocked = workflowLock !== null && (workflowLock.harnessLocked || !workflowLock.capPaused)
```

setting `harnessLocked: true` in the `state.locked && …` branch and `false` in the `cap_paused`-only
branch (both in `ChatArea.tsx` and the mirrored reconcile in `StreamsProvider.tsx:2306/2325`).

### WR-08: The transcript says "Read <file>" for a turn in which the agent was never told the file exists

**File:** `frontend/src/components/chat/MessageItem.tsx:455-465`
(`COPY.shared.agentReadLine`, `composerCopy.ts:112`)

**Issue:** the assistant row renders `Read <name>` for every attachment in the preceding user turn's
window. Its docblock justifies this as *"`244-02` hydrates every non-expired thread attachment …
so 'the agent could read it' is TRUE for all of them"*. That justification does not hold in
Explorer mode: the announcement is gated out (`agent_loop.py:1389`) **and** the explorer tool set
carries neither `execute_code` nor any workspace tool, so no hydration happens either. The agent
cannot have read the file, and the row still says it did — in the past tense.

Concrete: attach `contract.pdf`, switch the composer to Explorer, send "summarise this". The reply
cannot mention the file, and the line above it reads `Read contract.pdf`.

**Fix:** either render the pointer only when the turn's mode could reach the file, or change the
wording to a capability statement rather than an event (`Available to the agent: contract.pdf`).
The strings are ported from `COPY.js`, so a copy change is an operator call — the mode gate is not.

---

## Info

### IN-01: Dead comparison in the chip's expiry word, and a flat `24h` shown for a file with a minute left

**File:** `frontend/src/components/chat/ChatAttachmentChip.tsx:196`

`caption === COPY.engine.TTL_HOURS + "h"` compares against `"24h"`, a string `expiryCaption`
(`FilesSection.tsx:132-146`) can never return — its three shapes are `"expiry unknown"`,
`"expired"`, and `"expires in Nh"` / `"expires in Nm"`. The clause is unreachable; only the
`startsWith("expires in")` arm ever fires. A consequence worth naming: because the whole
`expires in …` range maps to the literal `24h`, a chip for a file with 1 minute left reads `24h`.
The docblock calls this "the PROMISE, not a clock" and the sketch draws it flat, so it is a
decision — but the dead clause should go.

**Fix:** `const expiryWord = caption.startsWith("expires in") ? COPY.a.chipTtl : caption`.

### IN-02: `truncate` on an `inline-flex` clips the folder chip without an ellipsis

**File:** `frontend/src/components/layout/ChatHistoryColumn.tsx:210`

`className="inline-flex max-w-[96px] … truncate …"` — `text-overflow: ellipsis` applies to a block
container's own inline content; on a flex container the text node becomes an anonymous flex item
and is clipped hard instead. The width cap works (which is the reported defect's fix), but a long
folder name ends mid-character with no `…`.

**Fix:** wrap the label in its own `<span className="truncate">` inside the flex row, leaving
`max-w-[96px] overflow-hidden` on the container.

### IN-03: Two new files disagree about how many routes `workspace.py` ships — both written this phase

**File:** `frontend/src/components/chat/ChatAttachmentChip.tsx:87-90` ("SIX routes … one `POST
/files` and five GETs") vs `frontend/src/components/chat/useComposerAttachments.ts:113` ("SEVEN
routes … two POSTs, five GETs")

The second is correct at HEAD (`workspace.py` has POST `/files`, POST `/files/from-connection`, and
five GETs). The first was accurate when `244-05` wrote it and went stale inside the same phase when
`244-06` added the route. Both are load-bearing prose for the detach-is-not-delete rule.

**Fix:** correct the `ChatAttachmentChip` docblock to seven, or drop the count from both and point
at the one file.

### IN-04: The 502 body echoes the raw exception string to the client

**File:** `backend/app/api/workspace.py:417` (mirrors `connectors.py:1836`)

`detail=f"Failed to download cloud file: {exc}"` forwards whatever the adapter raised — which can
carry provider URLs, request ids, or fragments of an upstream error body — to an end user, and the
composer renders it verbatim in the refusal strip. The log line above it already records the full
exception.

**Fix:** return a fixed sentence to the client and keep `exc` in the log. Pre-existing pattern
copied from `connectors.py`; newly introduced at this route.

### IN-05: The hydration failure note is unbounded, unlike the path it describes

**File:** `backend/app/services/tool_dispatcher.py:1886`

`os.path.basename(src_path)` is used raw in a note that goes into `_llm_payload["attachments"]`,
while the container path immediately above is capped at `_ATTACHMENT_NAME_MAX = 120`. Upload-time
sanitisation (`workspace.py:333-335`) bounds the charset but never the length, so a 4,000-character
filename that fails to copy produces a 4,000-character line in the model's tool result — the
prompt-flood the cap was added to stop, on the failure path.

**Fix:** reuse the bounded name — `_attachment_container_path(src_path).rsplit("/", 1)[-1]`.

### IN-06: A Library tab can carry an attention badge while the shell badge is suppressed

**File:** `frontend/src/components/layout/ChatLayout.tsx:544` vs `:852`

`showAttention` requires `Boolean(onOpenLibraryHealth)`, but `attentionConditions` is passed to
`LibraryPage` unconditionally. In a mount where `onOpenLibraryHealth` is absent, the rail shows
nothing and the Library tab strip still shows a count — the "WHERE" without the "THAT".

**Fix:** pass `attentionConditions={showAttention ? attentionConditions : []}` so both renderers
hang off one predicate.

### IN-07: The lockstep fence sweeps only `TemplateUpload.tsx` for a re-introduced `accept=` literal

**File:** `frontend/src/lib/__tests__/workspaceAllowedExt.lockstep.test.ts:78-85`

The final case asserts `expect(code).not.toMatch(/accept="\.[a-z]/)` against `TemplateUpload.tsx`
only. The composer's new input (`MessageInput.tsx:795`) is the second consumer and correctly reads
`WORKSPACE_ACCEPT_ATTR` today, but a hand-typed list re-introduced there would be invisible to the
fence — the exact rot the suite exists to catch.

**Fix:** add `MessageInput.tsx?raw` to the same sweep, or glob the two consumers.

### IN-08: `usePrecedingUserTurns` silently falls back to the last two user turns when the message id is absent

**File:** `frontend/src/providers/StreamsProvider.tsx:4046-4058`

The loop `break`s on `m.id === messageId`; if the id is not in the bucket (an optimistic id replaced
by the server's, a row from another surface), it runs to completion and returns the thread's last
two user timestamps. The consumer then computes an attachment window for the wrong turn, and chips
can appear on a row they do not belong to.

**Fix:** track whether the id was found and return `"|"` when it was not.

### IN-09: Client-stamped message time vs Postgres-stamped file time can drop the chip from the message just sent

**File:** `frontend/src/components/chat/ChatAttachmentChip.tsx:170-183`

The association window is `P.created_at < file.created_at <= M.created_at`. `file.created_at` comes
from Postgres; the optimistic user message's `created_at` is client-stamped. The docblock makes the
upper bound inclusive for the same-millisecond case, which does not cover a client clock a second
or two behind the server: `file.created_at > M.created_at` puts the file outside the window and the
chip vanishes from the message it belongs to until the server echo replaces the optimistic row.

**Fix:** allow a small tolerance on the upper bound for optimistic rows, or prefer the server-echoed
`created_at` for the association once it lands.

---

## Notes on the already-recorded items

Checked against `deferred-items.md` and found **no worse than recorded**:
`MessageInput.tsx` measures **821** lines (the claimed `855 → 821`),
`useComposerAttachments.ts` is a real extraction of state + three verbs,
`backend/app/api/connectors.py` measures **2102** (the claimed `2091 → 2102`, eleven lines), and
the `ComposerChipsRow` half is genuinely still inline JSX as the note says.

---

_Reviewed: 2026-09-12_
_Reviewer: Claude (gsd-code-reviewer) — solo run, no independent second reviewer (OV-SOLO-01)_
_Depth: standard_
