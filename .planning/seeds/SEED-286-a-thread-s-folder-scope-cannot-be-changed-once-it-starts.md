---
seed_id: SEED-286
title: A chat thread's KB folder scope can only be set on the empty state — once the thread starts, there is no control to change it
created: 2026-09-16
surface: Agentic-RAG
status: planted
partial: false
status_note: |
  ── 2026-09-22 · Phase 262 (plan 05), LEFT PLANTED. Fired on `ChatArea.tsx` + `MessageInput.tsx`,
  both of which 262-05 edits — but the edit is ONE optional pass-through callback opening the Expert
  catalog, and it changes nothing about scope. ⛔ ADJACENT AND DELIBERATELY NOT FOLDED: an Expert
  does change what a thread reads, so the temptation is real, and CONTEXT's boundary is explicit —
  *"no change to what an Expert DOES"*. `PACK-01`'s manifest-not-a-runtime rule must not start
  leaking in through the catalog. ⚠ AND 262 MADE THIS SEED SHARPER: `startScopedChat` creates a
  thread and PATCHes an Expert onto it, so a person can now acquire a thread-level scope decision
  from a surface OUTSIDE the composer — while the composer still offers no way to revise it.
trigger_when: any phase touching `frontend/src/components/chat/ChatArea.tsx`, the composer's scope affordance, or thread-level retrieval scope
trigger_paths: ["frontend/src/components/chat/ChatArea.tsx", "frontend/src/components/chat/MessageInput.tsx", "frontend/src/components/chat/composerCopy.ts"]
trigger_surfaces: ["chat", "retrieval"]
migration_note:
relates_to:
  - "frontend/src/components/chat/ChatArea.tsx:570 — the `if (!thread) { return (` branch"
  - "frontend/src/components/chat/ChatArea.tsx:609-624 — the folder `<select>` and its 'Scope this conversation to a specific folder' caption, both INSIDE that branch"
  - "frontend/src/components/chat/ChatArea.tsx:103,404 — `scopeFolderId` state, consumed once at `onCreateThread(scopeFolderId)`"
  - "BUS-040 (2026-08-31) — where this was found and recorded as 'found and did not fix'"
  - "SEED-112 — the WORKFLOW-run KB folder-scope surface. ⛔ A DIFFERENT surface; it does not hold this finding"
  - "SEED-247 — thread-scoped attachments vs library documents. Adjacent, not the same question"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-286: a thread's folder scope cannot be changed once it starts

## The finding

`ChatArea.tsx:570` opens `if (!thread) { return (` — the welcome/empty state — and the folder-scope
control lives entirely inside it, at `:609-624`:

```tsx
<select value={scopeFolderId ?? ""} onChange={(e) => setScopeFolderId(e.target.value || null)}>
  <option value="">All documents</option>
  …
</select>
<p className="text-xs text-muted-foreground mt-1.5">Scope this conversation to a specific folder</p>
```

`scopeFolderId` is read exactly once, at `:404` — `activeThread = await onCreateThread(scopeFolderId)`.
So the scope is a **thread-creation argument with no post-creation editor**. Once a thread exists, the
`!thread` branch never renders again, and **there is no control anywhere in the chat surface that can
change it.** The caption promises a property of *"this conversation"*; the control that sets it
disappears the moment the conversation begins.

⛔ **This was verified by reading the branch structure, not inferred from the absence of a component.**
`rg -l "ScopePicker|scopePicker" frontend/src` returns nothing — there is no extracted component to
find, which is part of why the gap is easy to miss.

## Why it matters

A user who starts a chat unscoped and then realises they meant *"only the Q3 contracts folder"* has no
move except starting a new thread and losing the transcript. The reverse is worse: a thread scoped to
one folder on its first message **silently stays scoped for its entire life**, and nothing in the
running thread says so — the only place the scope was ever named is a screen the user cannot return to.
That is a retrieval result the user cannot explain, which is the same class of defect as a refusal that
names the wrong cause.

⚠ **Nobody has reported it as a bug.** It was found during a handover sweep, not from a user complaint,
so the cost above is reasoned rather than measured. Recorded as speculative on that axis and factual on
the structural one.

## When to surface

- **Any phase whose `files_modified` names `frontend/src/components/chat/ChatArea.tsx`** — the branch
  that hides the control is in that file, and a phase already editing it pays almost nothing to move
  the control somewhere a live thread can reach.
- Any phase building a composer affordance row (`MessageInput.tsx`, `composerCopy.ts`) — the composer
  is the obvious home for a per-thread scope chip, beside the connector chips that already live there.
- Any work on thread-level retrieval scope or on explaining *why* a retrieval returned what it did.

⛔ Do **not** fold this into a workflow-scope phase. `SEED-112` is the workflow/run surface and this is
chat; treating them as one seed is how a finding gets closed by work that never touched it.

## Scope estimate

**Small-to-Medium.** The state and the write path already exist; what is missing is (a) a control
reachable from a live thread and (b) a persisted scope the thread can be updated with, rather than a
create-time argument. (b) is the part that may not be small — whether `threads` can accept a scope
update, and what a mid-thread scope change means for messages already answered, are real questions and
the answer *"new scope applies from here"* needs to be visible in the transcript rather than assumed.

## Breadcrumbs

- **BUS-040** (2026-08-31, from claude, to operator) — the handover that found it, listed under *"FOUR
  THINGS I FOUND AND DID NOT FIX"*: *"the folder scope picker exists ONLY on the empty state, so a
  thread's scope cannot be changed once it starts."*
- **Planted by Phase 251 Plan 04's bus triage**, under D-13's third arm: an item may only be
  recommended for closure once every finding it carries is held by a durable register. Grepped
  `.planning/seeds/`, `.planning/reported-bugs/`, `docs/` and `CLAUDE.md` — **nothing held this one**,
  while BUS-040's three other residuals each did (`BUG-260907-01` and `docs/HOT-FILE-LEDGER.md:10098`
  for the Microsoft 365 `✓ Ready` lie; `docs/HOT-FILE-LEDGER.md:12876` and `BUG-260911-02` for the
  hardcoded starter chips; `SEED-280` for the three chat suites in neither count-gate knob, which names
  all three by filename).
- Structure re-verified at `e7cfc5a4e` (2026-09-16): `if (!thread)` at `ChatArea.tsx:570`, the `<select>`
  at `:611`, `onCreateThread(scopeFolderId)` at `:404`.
- ⭐ This is the second time the third arm has paid for itself. The 2026-09-06 sweep found `BUS-049`'s
  org-wide-outage finding held only by the bus item, and `BUS-040`'s own measured finding held by
  nothing for 14 days until `SEED-276`. **Close a bus item without this check and the finding vanishes
  with it.**
