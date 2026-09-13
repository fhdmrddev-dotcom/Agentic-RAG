---
phase: 244-the-chat-shell-and-the-composer
plan: 03
subsystem: frontend/chat-surface + backend/threads-reconcile
tags: [SHELL-02, SHELL-03, BUG-260904-05, BUG-260828-07, composer, approval, cap-paused]
requires: ["244-01"]
provides:
  - "a composer lock that can tell a cap-pause from a running workflow"
  - "a server cap_paused read bounded to the thread's LATEST run, so the lock stops returning"
  - "the shipped PendingAskStack mounted inline where the paused cue already was"
  - "a negative-regression fence over MessageItem.tsx:576's two sentences (the ROADMAP's named anti-fix)"
  - "a row-independent fetch-cost fence for the inline mount"
  - "re-derived HOT-FILE-LEDGER rows for ChatArea.tsx, threads.py, MessageItem.tsx, PendingAskCard.tsx"
affects:
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - backend/app/api/threads.py
tech-stack:
  added: []
  patterns:
    - "ONE lock boolean read by the whole composer chain — extend the expression, never add a parallel one"
    - "no fetching hook at MessageItem's top level (MessageList has no virtualisation) — mount inside the narrow arm, HarnessOuterBanner's shape"
    - "bound a status read by TIME, not by filtering on the status before ordering"
    - "a cost fence asserts an EQUALITY against a one-row control, never a per-mount literal"
key-files:
  created:
    - frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx
    - backend/tests/unit/test_244_cap_paused_lock_bound.py
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
  modified:
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - backend/app/api/threads.py
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "C-1 confirmed in code: D-244-08's `mode === \"harness\"` gate is a NO-OP. The literal string survives as a COMMENT only, which is the correction record the plan's action mandates — so the task's `grep -c … == 0` criterion is satisfied in substance and NOT literally, and that is stated rather than passed silently."
  - "C-2 arm (b) taken: bound the READ. No second writer of runs.status; the pure-read invariant is now executable, not a comment."
  - "C-3's arithmetic is an UNDERSTATEMENT — measured, ONE PendingAskStack mount fires the ask fetch TWICE. The fence therefore asserts six-rows == one-row, not a literal."
  - "The narrowing is `message.runStatus === \"streaming\"`, NOT MessageList.tsx:237's isStreaming prop as the plan's <interfaces> states."
  - "C-4 arm 1 of the attentionConditions hoist trigger has FIRED (3 concurrent useAskUserPrompt readers). Deliberately NOT taken here."
  - "PausedRunCue's 'Answer in panel →' is now redundant guidance. NOT changed — a copy decision belonging with SEED-219."
metrics:
  duration: "~2h40m"
  completed: 2026-09-12
  tasks: 2
  commits: 5
  files_changed: 9
---

# Phase 244 Plan 03: The composer at a cap-pause, and the approval in the thread — Summary

**Two pauses, two defects, one shape — *the UI instructs an action it forbids*. The iteration cap
locked the composer that the message on screen told the operator to use, and an approval rendered a
question in the thread with no controls. Both are closed on the same two files, and the cap fix
needed BOTH layers: the client boolean alone would have shipped the defect one level down.**

⚠ **Solo run (D-244-21). Gemini is unavailable, so everything below is a SELF-verification.
Nothing here was reviewed.**

---

## What shipped

| # | Task | Commits |
|---|---|---|
| 1 | Unlock the cap-paused composer — client boolean AND server read bound | `b298a6d73` (RED) → `6aee6ba59` (GREEN) |
| 2 | The approval is answerable in the thread | `dbccc94cd` (RED) → `6dc2e2202` (GREEN) → `390780402` (tsc fix) |

Base: `310b91e83` (Wave 1 merged) · branch `worktree-agent-a96ded23806e7b214`.

---

## Task 1 — the cap-paused composer

### The REDs, quoted verbatim

**Frontend** (`ChatArea.capPausedComposer.test.tsx`, against the shipped tree):

```
 × 1 — with capPaused, the composer is ENABLED and offers the ordinary prompt
 × 4 — a non-empty draft can be SENT while capPaused
TestingLibraryElementError: Unable to find an element with the placeholder text of: Ask anything…
 Tests  2 failed | 3 passed (5)
```

The 3 passing were the controls and they are the load-bearing half: case 2 (a genuine harness lock
still disables the box with `"Workflow running — Cancel to switch back"` on **both** the placeholder
and the `title`) and cases 3 / 3b (`MessageItem.tsx:576-578`'s two sentences, verbatim).

**Backend** (`test_244_cap_paused_lock_bound.py`):

```
FAILED tests/unit/test_244_cap_paused_lock_bound.py::test_a_newer_running_row_clears_the_pause
FAILED tests/unit/test_244_cap_paused_lock_bound.py::test_a_newer_completed_row_also_clears_the_pause
FAILED tests/unit/test_244_cap_paused_lock_bound.py::test_the_runs_probe_carries_no_status_predicate
E   "status = 'cap_paused'" is contained here:
E      = $1 AND status = 'cap_paused' ORDER BY started_at DESC LIMIT 1
3 failed, 5 passed
```

### The change

**Frontend, one expression** — `ChatArea.tsx:140`:
`workflowLocked = workflowLock !== null && !workflowLock.capPaused`.
Nothing else in the chain moved: `MessageInput.tsx` keys `canSend`, the placeholder, the `title`,
`disabled` and the `+` menu off this **one** boolean, so D-244-10's *"the harness copy is untouched"*
is free by construction rather than fenced twice.

**Backend, one query** — `threads.py`'s Deep `cap_paused` probe dropped `AND status = 'cap_paused'`
from its `WHERE` and gained `if deep_row is not None and deep_row["status"] == "cap_paused":`.

⛔ **Why the server half was not optional.** The shipped read filtered on a **mutable status BEFORE
ordering on time**, so it answered *"has this thread EVER been paused"* while every caller read it as
*"is this thread paused NOW"*. `POST /threads/{id}/messages` has no cap-paused refusal and clears
nothing — it mints a fresh `runs` row — and the only clearer of that status anywhere in the backend
is `continue_run` (`runs.py:1082-1086`). So the endpoint re-locked the thread's composer on **every**
reconcile, forever. Type, send, reload, locked again.

⛔ **The rejected arm, with its reason.** Retiring the stale row server-side would add a **second
writer of `runs.status`** beside `continue_run`. Two writers of one status column is how `runs:active`
and `runs.status` drift — the failure Phase 145 / D-149-09 made one atomic co-write to prevent.
`test_the_workflow_reconcile_endpoint_writes_nothing` now asserts the handler's source carries no
`.update(` / `.insert(` / `.delete(`, so the pure-read claim cannot rot into a comment.

⚠ **The conftest pool mock could not have fenced this, and that is a transferable finding.**
`mock_asyncpg_pool.set_fetchrow_results` answers from a **queue and ignores the SQL**, so the shipped
query and the bounded one receive the same canned row — the decisive case would have passed under
both. The suite therefore ships a **semantic fake** implementing `WHERE` / `ORDER BY` / `LIMIT` over
one in-memory `runs` table. That is what makes the case falsifiable in both directions.

### Acceptance criteria

| Criterion | Result |
|---|---|
| `grep -n 'workflowLocked ='` includes `!workflowLock.capPaused` | ✅ `:140` |
| `grep -c 'mode === "harness"'` is **0** | ⚠ **1 — and it is COMMENT-ONLY** (`:125`). See the conflict below. |
| `git diff MessageItem.tsx` shows 0 changes to `:576` in this task | ✅ `git diff --numstat` → empty |
| cap_paused query no longer carries `AND status = 'cap_paused'` | ✅ the only remaining occurrence is the docblock quoting the old query |
| Tests 1, 2, 6 seen RED first, outputs quoted | ✅ above (2 was a green CONTROL, not RED — see below) |
| `MessageItem.capPaused` 5 · `MessageItem.continueButton` 2 | ✅ **5 and 2**, run explicitly |
| Backend failing SET ⊆ start-of-plan set | ✅ **identical**, by filename |

⚠ **TWO CRITERIA AS WRITTEN COULD NOT BOTH BE MET, and neither was quietly dropped.**

1. **`grep -c 'mode === "harness"' == 0` vs the task's own `<action>`.** The action orders a docblock
   *"recording C-1 verbatim: D-244-08 proposed `workflowLock?.mode === "harness"`"*. Writing the
   correction beside the decision necessarily puts the string in the file. The criterion's intent —
   *"shipping that gate would ship nothing"* — is met: `grep -n` returns exactly one line, `:125`,
   inside a comment, and no executable occurrence exists. **The letter is unmet; it is recorded here
   rather than passed silently.**
2. **"Test 2 was seen RED."** Test 2 is the harness-lock control and is **GREEN on the shipped tree by
   design** — a harness run locking the composer is the behaviour being *preserved*, so a RED there
   would have meant the lock was already broken. The RED cases are 1, 4 (frontend) and 6, 6-completed,
   6b (backend). Claiming a RED that never happened would be worse than reporting the mismatch.

⛔ **`SHELL-02` does NOT close here.** `D-244-09` binds: *"drive it; do not reason about it."* Whether
posting at a cap-pause starts a run **and survives a reload** is a `244-VALIDATION.md` row in a real
browser (ROADMAP criterion 2). A unit test on a stub is not that drive, and **this task claims no part
of it.**

---

## Task 2 — the approval, answerable in the thread

### The RED, quoted verbatim

```
 × 1 — the paused row renders the cue AND the panel's two actions, by their LABELS
 × 3 — SIX rows cost exactly what ONE row costs (the C-3 cost fence)
 × 5 — the settle is STRUCTURAL: a second reader sees the same slice
 × 6c — both page mount sites still exist in source
TestingLibraryElementError: Unable to find role="radio" and name "Approve this step"
AssertionError: expected [] to have a length of 1 but got +0
 Tests  4 failed | 4 passed (8)
```

### The change

`MessageItem.tsx` renders `<PendingAskStack />` beside `<PausedRunCue />`, **inside** the existing
`hasPendingAsk(message.tool_calls) && …` arm. One import, one render site.

- ⛔ **A mount, never a renderer.** `PendingAskCard.tsx` is **untouched — `git diff --numstat` reads
  `0 0`**, and `StepIdentity.coverage.test.tsx` (**23**) and `PendingAskCard.test.tsx` (**45**) are
  both unmoved at their pins. A chat-native second renderer of the same pause is D-244-11's rejected
  arm, the Phase 095 build-once rule and `SEED-219`'s complaint — and it is *how the two homes came to
  disagree in the first place*.
- The settle is therefore **structural**: one store slice, one `reconcile`, nothing to keep in sync.

### ⚠ Three measured corrections

**(a) C-3's arithmetic is an UNDERSTATEMENT, not an overstatement.** C-3 costs the mount at *"2 fetches
on one row"*, one per `usePanelReconcile`. A probe measured a **single** `PendingAskStack` mount firing
`getThreadPendingAsks` **TWICE** (1 stack → **2** calls; 3 stacks → **7**). So the hook fires twice per
mount and a top-level mount would be **~4 ask fetches per row**, not 2. The conclusion is strengthened;
only the constant was wrong. ⛔ **That is exactly why case 3 asserts an EQUALITY against a one-row
control instead of a literal** — a literal encodes a per-mount constant already measured wrong once,
and would later be "corrected" by someone reading it as drift rather than as the cost multiplying.

**(b) The narrowing is not what the plan said it was.** `244-03-PLAN.md` attributes it to
`MessageList.tsx:237` passing `isStreaming={isStreaming && isLastAssistant}`. **Measured: the arm reads
`isMessageStreaming`, i.e. `MessageItem`'s OWN `message.runStatus === "streaming"`** — not the prop.
Case 2 passes `isStreaming` **TRUE** deliberately so it cannot pass for the wrong reason. The bound is
stronger than advertised: it survives a caller that passes the prop differently.

**(c) C-4 is confirmed, and arm 1 of the hoist trigger has FIRED.** There was exactly **ONE**
`PendingAskStack` mount before this plan (`WorkspacePanel.tsx:438`); CONTEXT's *"WorkspacePanel.tsx:358"*
is the component's own export line. `WorkflowRunPage.tsx:1629` mounts `PendingAskCard` **directly**.
So the chat mount is the **SECOND stack** and makes `useAskUserPrompt` the **THIRD concurrent reader**
— **arm 1 of `attentionConditions.ts`'s three-part hoist re-open trigger is now TRUE.**
⛔ **The hoist is deliberately NOT taken here** (a HIGH-severity bug fix is not a refactor). It is
recorded so the deferral has a real trigger rather than a silent one.

### ⭐ The cost fence was FALSIFIED, not assumed

A real top-level mount was planted — `<PendingAskStack />` on every assistant row — and case 3 went RED:

```
TestingLibraryElementError: Found multiple elements with the role "radio" and name "Approve this step"
```

Three assistant rows each rendered the approval card: the defect **rendered** as well as fetched.
`MessageItem.tsx` was then restored **md5-identical** — `2752d7777c00f0e1dad78fdcc152b09f`.

⚠ **The first plant did not fire, and the reason is worth carrying.** It assigned the element to an
unused variable (`const __plantStack = <PendingAskStack />`), which **creates** JSX without
**mounting** it — case 3 stayed green and only the source-count case (6c) caught it. *A plant that does
not mount proves nothing.* ⚠ **And the first RESTORE silently failed**: the file is CRLF, the removal
pattern carried a trailing `\r` from its anchor, and the md5 comparison — not a visual check — is what
caught the plant still sitting at line 403. **The md5 is the guard, not the ceremony.**

### Acceptance criteria

| Criterion | Result |
|---|---|
| `grep -n 'PendingAskStack'` → exactly one render site, inside the arm | ✅ `:447`, and case 6c asserts it with `matchAll` |
| Case 3 seen RED against a top-level mount, count quoted | ✅ above (RED as a duplicate-render, count quoted in the probe: 1→2, 3→7) |
| Case 1 asserts the two action LABELS, read from both files | ✅ `Approve this step` / `Do not run it` / `Send Answer`, taken verbatim from BUG-260828-07 and matched against `PendingAskCard`'s render |
| `StepIdentity.coverage.test.tsx` still **23** | ✅ **23** |
| `PendingAskCard.tsx` `0 0` | ✅ untouched; no optional prop was needed |
| Both suites in BOTH knobs — two greps, not one | ✅ 4 greps, all `1` |
| Ledger rows RE-DERIVED, command output in the SUMMARY | ✅ below |
| Reader count + fired hoist arm recorded | ✅ (c) above |

⛔ **`SHELL-03` does NOT close here.** `D-244-14` binds the closing evidence to a **driven
both-directions** row in `244-VALIDATION.md` — a real armed approval answered from the thread and seen
settled in the panel, then the reverse. **A synthetic mount test proves mounting, never answering.**

---

## Ledger — RE-DERIVED, never copied from D-244-20

```
frontend/src/components/chat/ChatArea.tsx       71 / 36 / 710  (base)  → inherits 72 / 36 / 710
backend/app/api/threads.py                     244 / 81 / 1617 (base)  → inherits 245 / 82 / 1617
frontend/src/components/chat/MessageItem.tsx    69 / 33 /  803 (base)  → inherits 70 / 34 /  803
frontend/src/components/panel/PendingAskCard.tsx 14 /  7 /  765         (UNTOUCHED — 0 0)
```

⚠ **THREE OF THE FOUR ROWS WERE STALE**, and `D-244-20`'s planning table carried the stale figures
for two of them — the exact state this ledger warns about most: *a row that is present and WRONG
answers the auditor with `satisfied` and stops the audit.*

| Row | Was | Measured |
|---|---|---|
| `backend/app/api/threads.py` | `243 / 80 / 1590` | **245 / 82 / 1617** — `244` was NOT in its bucket list |
| `MessageItem.tsx` | `68 / 33 / 755` | **70 / 34 / 803** |
| `PendingAskCard.tsx` | `13 / 7 / 736` | **14 / 7 / 765** — and this plan did not touch it |
| `ChatArea.tsx` | `71 / 36 / 686` (244-01, correct when written) | **72 / 36 / 710** |

All four sections landed in `docs/HOT-FILE-LEDGER.md` in the **same commit** as their rows.
`node scripts/check-hot-file-ledger.cjs 244` parses **46 files / 26 watched** (not 0 — the CRLF
vacuous-pass trap Phase 242 found is not biting) and exits 1 on **4 `[no-row]` files**, all of them
`244-05` / `244-06`'s per the C-8 ownership map. ⛔ Adding them here would fire `[duplicate-row]`
later, so they are deliberately left.

⚠ **`MessageItem.tsx` was NOT re-hollowed** — `useState` **3→3**, `useEffect` **0→0**, props **5→5**.
The 227-03 extraction stands.

---

## Verification

### Backend — at the ceiling, set identical

```
BEFORE: 71 failed, 4594 passed, 2 xfailed, 2 xpassed, 45 warnings   (0 collection errors)
AFTER:  71 failed, 4602 passed, 2 xfailed, 2 xpassed, 45 warnings   (0 collection errors)
diff(base-set, after-set) → IDENTICAL SETS
```

`+8 passed` is **exactly** this plan's eight new cases. The failing set was captured by **filename**
both times (`grep -aE '^FAILED '`, never a `| tail`) and diffed as sets. ⚠ The contention-sensitive
`test_230_ingestion_jobs_db.py` case did **not** appear.

### Frontend typecheck — SET DIFF empty

`npx tsc -p tsconfig.app.json --noEmit` → **67 errors**, the base figure.
⚠ The first run read **68**: the one new error was mine —
`MessageItem.inlineApproval.test.tsx(233,48): TS2322: Type '"completed"' is not assignable to
'"interrupted" | "running" | "done" | "preparing"'`. Fixed in `390780402`; that case had also been
passing for a reason unrelated to the arm it tests. **None of the remaining 67 names a file this plan
touched** (the four `src/components/chat/…` hits are `ChatAreaMode.test.tsx`, pre-existing).

### Count gate — the two new suites land exactly, and the gate is RED for two INHERITED reasons

```
  MessageItem.inlineApproval.test.tsx           8       8       0
  ChatArea.capPausedComposer.test.tsx           5       5       0
  total                                      7348    8118    +770
  total 8118  ·  failed 3  ·  pinned total 7348
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

**Trajectory, with every increment attributed so none can be quoted as another:**
Wave 1 measured `total 8105 · failed 0 · pinned total 7335 · 263/263`. This plan reads
`total 8118 · pinned total 7348 · 265 pinned files`. **+13 on both totals, +2 files — exactly
`ChatArea.capPausedComposer` (5) + `MessageItem.inlineApproval` (8). No residual.** Both land with
delta `0`, so the pins are exact rather than approximate. ⛔ **No per-file DECREASE anywhere.**

#### The 3 failures — procedure followed, cap NEVER touched

Filenames were taken from the gate's **own persisted JSON** *before* any re-run, then checked against
`git diff --numstat 310b91e83 HEAD`:

| File | In this plan's diff? |
|---|---|
| `src/components/layout/__tests__/ChatHistoryColumn.rowIdentity.test.tsx` | **absent — provably unmodified** |
| `src/pages/__tests__/LibraryPage.initialTab.test.tsx` | **absent — provably unmodified** |

⛔ **`GSD_VITEST_MAX_WORKERS=2` on every invocation; the cap was never adjusted**, per the standing
rule that adjusting it is measured NOT to fix these.

**1 — `ChatHistoryColumn.rowIdentity.test.tsx` is NOT a flake. It has a measured cause and it is a
REAL DEFECT in a Wave-1 suite.** It builds fixtures as `Date.now() - 1h` / `- 2h` and asserts
`getAllByText("Today")`. The gate ran at **00:17 local on 2026-09-12**:

```
now      : Sat Sep 12 2026 00:19:37 GMT+0400
1h ago   : Fri Sep 11 2026 23:19:37 GMT+0400
same day?: false
```

⚠ **It goes red every night between 00:00 and ~02:00 local, on a shared gate**, and was green when
`244-01` pinned it (before midnight). ⛔ **NOT fixed here** — it is `244-01`'s file and editing another
plan's test mid-wave collides with the registry merge. The one-line fix (`vi.setSystemTime`) is written
out in `deferred-items.md` § D-1, with the sweep obligation for other `Date.now() -` fixtures.

**2 — `LibraryPage.initialTab.test.tsx` is a candidate SEVENTH entry for `SEED-171`.** The failing SET
is never the same twice: **2** inside the full gate, **1** with one sibling, **6** alone (flat 5000 ms
timeouts, one at 36 718 ms). ⚠ **It fails WORSE alone than under load**, which rules oversubscription
out the same way SEED-171's isolation case did. Stronger than "unmodified": `LibraryPage.tsx` has **no
import path** to either frontend file this plan changed, and the only other production change is
Python — so its behaviour at this HEAD is **identical to base by construction**. ⚠ **There was no green
sample to lean on** — it was red on all three invocations. Recorded in `deferred-items.md` § D-2.

⚠ **CONSEQUENCE, stated plainly:** `count gate OK` is not reachable on this tree tonight, for reasons
this plan does not own. The deterministic evidence is the per-file table (no decrease, both new suites
exact) and the explicitly-run in-scope suites, all green.

---

## Deviations from Plan

**1. [Rule 1 — Bug] `ToolCall.status` literal**
- **Found during:** Task 2 verification
- **Issue:** the no-pending-ask control used `status: "completed"`, absent from the union
- **Fix:** `"done"`; the only new tsc error this plan introduced
- **Commit:** `390780402`

**2. [Rule 3 — Blocking] jsdom has no `scrollIntoView`**
- **Found during:** Task 2 case 3
- **Issue:** `MessageList`'s follow-scroll effect threw at mount before the fetch count could be read
- **Fix:** a guarded no-op stub, labelled in the file as a **mount enabler only** — this suite asserts
  no scroll behaviour, and the project's note about `MessageList.test.tsx` blinding itself this way is
  cited so the scope is explicit rather than rediscovered.

**3. [Scope boundary] Two inherited reds logged, not fixed** — `deferred-items.md` D-1 / D-2.

---

## Observation recorded, deliberately not acted on

`PausedRunCue` still reads **"Answer in panel →"**. It is not false — the panel remains an answer
surface — but beside a card that now answers in place it is redundant guidance. ⛔ **Not changed**: the
task's `<action>` fences this to the mount site, and re-wording a shipped cue is a copy decision that
belongs with `SEED-219`'s vocabulary work, not inside a HIGH-severity control fix. Recorded in the
`PendingAskCard.tsx` ledger section so it is not rediscovered as a surprise.

---

## Known Stubs

None. No placeholder, no hardcoded empty value, no unwired component — both tasks mount shipped
components against real store slices.

---

## Threat Flags

None. The plan's `<threat_model>` dispositions were all `mitigate` and all are carried:
`T-244-03-01` (case 2 — a genuine harness lock still disables, driven), `T-244-03-04` (the `runs` probe
stays keyed on the route's `thread_id` through the RLS connection — asserted on the SQL and the args
the route actually executed), `T-244-03-05` (case 3, the row-independent cost), `T-244-03-06`
(avoided by design; the no-writer claim is now executable). ⛔ `T-244-03-SC`: **no packages installed.**

---

## Self-Check: PASSED

Files:
```
FOUND: frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx
FOUND: frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx
FOUND: backend/tests/unit/test_244_cap_paused_lock_bound.py
FOUND: .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
```
Commits: `b298a6d73` · `6aee6ba59` · `dbccc94cd` · `6dc2e2202` · `390780402` — all present in
`git log --oneline 310b91e83..HEAD`.
