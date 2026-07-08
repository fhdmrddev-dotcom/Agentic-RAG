---
id: BUG-260707-01
title: Composer flips Stop→Send and 👍/👎 feedback appears mid-run after a transient stream-end + reattach
reported: 2026-07-07
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, frontend/chat-ui]
folded_into: "145"
verified_closed_by: null
related_seeds: []
re_open_trigger: "Folded at /gsd:discuss-phase 145 (2026-07-09, D-145-10) — same _isTransientStreamEnd / transient-reattach surface. Contract: UI must NOT flip to 'done' affordances (Send, feedback thumbs) until runs.status is actually terminal (D-145-01 authoritative signal). Gets a dedicated VALIDATION row. Re-open if the composer/feedback still flips mid-run after 145 ships."
reproduces_on:
  branch: develop
  commit: cb9fef39
  date: 2026-07-07
---

# BUG-260707-01: Composer + feedback buttons flip to "done" mid-run after a transient stream-end + reattach

## What we observed

During a multi-round chat turn (most visibly when `execute_code` **fails and the
agent retries across several rounds** — e.g. the RPA pptx run, GLM), the UI flips
into a "finished" state **while the run is still streaming**:

- The composer's **Stop button reverts to a Send button** (and the input, which
  was disabled during the run, becomes enabled again — appearing as a greyed/idle
  Send since the box is empty).
- The **👍 / 👎 feedback buttons appear** under the still-in-progress assistant
  message.

Then the run continues (the reattached stream keeps producing tool cards / text)
but these "done" affordances do **not** revert to the streaming state. Observed
live during cross-provider UAT after the first execute_code round on a run that
went on to retry.

## Why it matters

It tells the user the run is finished when it is not — dishonest run state on the
exact surface we just hardened (Fixes #1–#3 this session). Two concrete harms:

1. **Premature feedback solicitation** — thumbs appear before there is a final
   answer to rate.
2. **Composer re-enabled mid-run** — in Deep mode there is no workflow lock, so an
   enabled composer invites a second send onto a thread whose run is still live,
   risking interleaved/duplicate runs.

Same *family* as BUG-260518-01 (Resume button mid-stream, folded → 095.1) but a
**distinct control and distinct signal**: that bug was the Resume gate
(`runStatus ∈ {failed, timed_out}`); this is the `isStreaming` /
`streamingThreads` signal that drives the composer + feedback. 095's transient-
reattach work did not cover this signal.

## Hypothesized cause

**Root-caused in code (high confidence), not just hypothesis.** The single signal
behind all three affordances is `isStreaming = useStreamingForThread(threadId)`
→ `streamingThreads.has(threadId)` (`StreamsProvider.tsx:2921`). It gates the
composer disable + Stop/Send (`ChatArea.tsx:342-343`), the `MessageList`
`isStreaming` prop (`ChatArea.tsx:510`), and therefore `MessageFeedback`, which
renders on `!isStreaming && role==="assistant" && content` (`MessageItem.tsx:451`).

`streamingThreads` lifecycle in `sendMessage`:
- **Added exactly once** at send (`StreamsProvider.tsx:1715`) — the ONLY add site
  in the file (grep-verified; reconcile/reattach never add it).
- **Deleted** in the send's `finally` (`StreamsProvider.tsx:1968-1972`), which
  runs when the awaited `subscribeToRun` (`:1911`) resolves.

On a **transient mid-run stream-end** (SSE reader closes at a turn boundary — what
execute_code failure/retry rounds and some providers closing the connection
between turns produce), the awaited `subscribeToRun` resolves → the `finally`
deletes `threadId` from `streamingThreads` → `isStreaming` flips **false**.
`onTerminal` (`:1802`) then probes `_isTransientStreamEnd` and calls
`_reattachAfterTransient` (`:1826`), which opens a **new** subscription
(`:1842`) and re-adds only `subscriptionsByThread` — **it never re-adds
`streamingThreads`** (`_reattachAfterTransient` at `:257-278` only seeds the
cursor + calls `reattach`). So the delete wins and nothing restores it; the thread
streams the rest of the run with `isStreaming === false`.

Clean single-SSE runs (e.g. the OpenAI single-step chart run in this session)
never hit a transient reattach, so `onTerminal`/`finally` fire once at the TRUE
terminal and the signal is correct — which is exactly why the bug shows only on
multi-round / failure-retry runs.

## Surface classification

`Agentic-RAG` — shared frontend streaming layer (provider-agnostic; no
per-provider branch). Routing candidate at the GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a — unrelated to 139 (SI-02) / 140 (relevance
  pre-filter). Do NOT fold here.
- **Defer to future phase / milestone:** a chat-streaming run-honesty / reliability
  phase, ideally alongside the pending `StreamsProvider` / `threads.py` extraction
  (G-5 hot-file ledger already flags both). Natural sibling to the 095.1
  premature-terminal family.
- **Plant as seed:** SEED candidate "reattach must restore streamingThreads" if no
  near-term phase claims it.
- **External — note only:** no.

## Suggested fix (for the owning phase)

Minimal + additive: in the reattach callback (`StreamsProvider.tsx:1836-1848`,
and the symmetric reconcile-path reattach), re-add `threadId` to
`streamingThreads` when opening the reattached subscription (mirror the `:1715`
add). The existing `finally` delete then fires correctly on the TRUE terminal.
Add a regression test: transient stream-end → assert `streamingThreads.has(tid)`
stays true across reattach until the real terminal. Keep it on the shared layer
(no per-provider branch) so all providers stay consistent siblings.

## Workarounds (prompt-side, code-side, or UI-side)

- User-side: ignore the Send/feedback affordances until the run card shows
  `✓ done`; don't send a follow-up until then.
- Prompt-side: reducing execute_code failures (see BUG-260707-02) reduces the
  transient reattaches that trigger this.

## Reference / evidence links

- Code: `StreamsProvider.tsx` :1715 (add), :1911 (awaited subscribe), :1802-1856
  (onTerminal + reattach), :1960-1972 (finally delete), :2921 (`useStreamingForThread`);
  `_reattachAfterTransient` :257-278; `ChatArea.tsx` :342-343, :510;
  `MessageItem.tsx` :451; `MessageFeedback.tsx`.
- Live evidence: GLM RPA-pptx run `a4f41f5e-0314-4f8e-bb17-e601733a3a0d`
  (thread `eda49aa0-…`), whose retry loop produced the mid-run stream-ends.
- Related: BUG-260518-01 (Resume mid-stream, folded 095.1); BUG-260707-02
  (pptx skill retry loop — the failure source that triggers the reattaches).
