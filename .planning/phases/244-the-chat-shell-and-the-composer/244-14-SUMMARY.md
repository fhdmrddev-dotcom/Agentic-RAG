---
phase: 244-the-chat-shell-and-the-composer
plan: "14"
kind: fix-round
gap_closure_round_note: |
  ⛔ THIS IS NOT A GAP-CLOSURE ROUND AND CARRIES NO `gap_closure` FRONTMATTER, DELIBERATELY.
  `scripts/check-gap-closure-rounds.cjs` counts gap-closure PLANS, and round 1 of a cap of 2 is
  already spent. This is the `244-07` / `244-08` pattern: a fix round with NO PLAN.md, repairing
  the round's OWN output. Verified after the last commit: `node scripts/check-gap-closure-rounds.cjs 244`
  still reads **1 round completed (cap is 2)** and exits 0.
subsystem: chat-shell / streams-provider / workspace-attachments / test-infrastructure
tags: [reconcile, workflow-lock, attachment-hydration, raw-source-fences, nav-rail, TDD, solo-verified]
base_commit: b11e99c8e
requires:
  - 244-REVIEW.md (gap-closure round 1, diff base 8cd9d8119..b11e99c8e) — the work list
  - 244-09-SUMMARY.md … 244-13-SUMMARY.md — the code being repaired
  - 244-CONTEXT.md — D-244-10, D-244-14, D-244-19, D-244-21
provides:
  - a reconcile that CLEARS the failure entry it set, so the G-3 banner is no longer sticky
  - one capPaused value at both mount-time workflow-lock writers, fenced in source
  - a Continue card whose copy reads the same discriminator the composer beside it reads
  - a bounded retry for a transient attachment-hydration failure, named on every attempt
  - `stripComments` as ONE shared test normaliser, with three consumers
  - an enforceable precondition where an unreachable abort guard used to be
affects:
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/layout/NavPanel.tsx
  - backend/app/services/tool_dispatcher.py
  - frontend/src/lib/stripComments.testutil.ts
  - scripts/vitest-count-gate.cjs

tech-stack:
  added: []
  patterns:
    - "A path that can WRITE a shared error slice must also be able to CLEAR it — the pair, not the write."
    - "A lockstep source fence compares two writers' EXPRESSIONS, and pins the DIRECTION separately."
    - "Replace an unreachable guard with an enforceable PRECONDITION rather than keeping a control that cannot fire."
    - "Separate *claimed* from *succeeded*: bound a retry with a CAP, never with never-retrying."
    - "One shared `stripComments` — the fix for 'two copies of a rule drift' must not be a second copy of a rule."

key-files:
  created:
    - frontend/src/lib/stripComments.testutil.ts
    - frontend/src/__tests__/providers/workflowLockWriters.lockstep.test.ts
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_244_attachment_hydration.py
    - frontend/src/__tests__/providers/streamsProvider_244_snapshot_failure.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md · docs/HOT-FILE-LEDGER.md
    - .planning/phases/244-the-chat-shell-and-the-composer/{244-UAT.md, 244-09-SUMMARY.md, 244-09-UAT-ROW.md, 244-10-UAT-ROW.md, 244-13-UAT-ROW.md, deferred-items.md}

key-decisions:
  - "D-244-14-01: the 1s silent retry is NOT copied into reconcile — `reconcileInFlightRef` is a GLOBAL boolean, so sleeping in it would DROP a switched-to thread's reconcile entirely."
  - "D-244-14-02: WR-04's abort arm is DELETED rather than made reachable; threading a signal is a behaviour change, not a gap fix."
  - "D-244-14-03: WR-03 keeps the deviation's DoS bound and pays for it with `_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2` instead of never retrying."
  - "D-244-14-04: IN-04 (D5's seed race) is DEFERRED, not fixed — but D7, added here, does not reproduce the shape."
  - "D-244-14-05: the two mount-time lock writers agree on `false` (fail-closed), and the DIRECTION is pinned as its own case because agreement alone is satisfiable by agreeing on `cap_paused`."

requirements-completed: []

duration: ~1h 10m
completed: 2026-09-12
---

# Phase 244 Plan 14: the round-1 review's own findings, repaired — Summary

**Nine findings from the gap-closure round-1 code review fixed in nine atomic commits: the sticky
G-3 banner now clears, the Continue card and the composer beside it read the same discriminator,
one `capPaused` value survives the mount-time race, a transient attachment failure is retried and
re-named instead of being recorded as permanent, an unreachable abort guard is replaced by a
precondition that can actually fire, and a `?raw` fence stops confusing code with comments.**

## Performance

- **Duration:** ~1h 10m (first commit 17:47, last code commit 18:24 local)
- **Tasks:** 9 findings fixed (CR-01, WR-01…WR-05, IN-01, IN-02, IN-03) + 3 deferred with triggers
- **Files modified:** 11 source/test files, 1 gate script, 2 ledger files, 6 planning records
- **Commits:** 9, plus this SUMMARY

## What was fixed, and what the fix turns on

### CR-01 (Critical) — a successful reconcile never cleared the error it had just set

`244-11` reused `loadMessages`' failure WRITE and left that writer's **clear-on-success** behind.
`reconcile` is the **thread-open path** (`loadMessages` runs only from `handleRetryReconcile`, the
`buffer_expired` arm and the stream-terminal `finally`), so on an ordinary open **no writer could
delete the key**. One transient 503 painted the banner for the life of the session — and once the
transcript hydrated, `ChatArea.tsx:715` flipped it to *"Couldn't load latest messages. Showing
cached version."* **over freshly fetched content**, which is the exact false claim `244-11`'s own
docblock says it exists to prevent.

⛔ **THE FENCE REPAIR MATTERS AS MUCH AS THE CODE.** Test 2 starts from the empty Map the
`beforeEach` installs, so it could only ever observe *"success writes no error"*, never *"success
CLEARS a prior error"*. **A control that begins in the CLEAN state cannot see a missing transition
out of the DIRTY one.** Two things were done about that:

- **Test 2b** starts DIRTY **through the product's own 503 arm** rather than through a `setState`
  seed, so the assertion is about the PAIR and not about a fixture. It reproduces UAT row L-1's
  observed sequence exactly: open → 503 → navigate away → come back → 200 → **the banner must be
  gone and the transcript must be there.**
- **Test 2 now states its own blindness** in a comment instead of reading as coverage.

**RED first:** `AssertionError: … expected true to be false` on Test 2b, before the fix.

⚠ **THE THIRD HALF OF THAT WRITER WAS DELIBERATELY NOT COPIED, and the reason is measured rather
than stylistic (D-244-14-01).** `loadMessages` retries once at 1s before raising. Doing that in
`reconcile` would hold `reconcileInFlightRef` — a **single GLOBAL boolean** (`:1470`), not a
per-thread map — for that whole second, and `reconcile` early-returns while it is held. **A thread
switch during the sleep would DROP the new thread's reconcile entirely**, leaving the person on a
conversation that never reconciles: strictly worse than a banner they can dismiss. The review
flagged that raising on attempt 0 is *"a legitimate decision … not recorded anywhere"*. It is
recorded now, at the site and here. **Make the in-flight guard per-thread before anyone adds a
retry there.**

### WR-01 — the mirror `244-13` left open

`244-13` moved `ChatArea.tsx:167` onto `lock.mode === "harness"`, correctly, and left the Continue
card gated on `capPaused` alone. For exactly one state — `mode: "harness"` **and**
`capPaused: true` — the two surfaces decouple, and the transcript reads *"Start a new message to
keep going"* over a composer reading *"Workflow running — Cancel to switch back"*, **disabled**.
That is the ROADMAP's named anti-fix **inverted**: the UI instructing the one action it forbids,
moved one component over rather than closed.

⛔ **NEITHER SENTENCE WAS DELETED — deleting one IS the anti-fix.** The harness arm names the action
that IS available (Cancel); the Deep wording is untouched and still exactly right for a Deep
cap-pause. **D7 asserts both halves in ONE tree**, the D6 discipline, because a suite that proves
each half in its own render is consistent with a product that never shows them together.

⭐ **D7 IS FAIL-SAFE BY CONSTRUCTION, AND THE MEASUREMENT BEHIND THAT IS WORTH MORE THAN THE CASE.**
While writing it, the mount effect was measured settling **TWICE** in this harness (the first call
aborted by the re-run, writing nothing; the second writing the lock). That makes review **IN-04**'s
race *real*, not hypothetical. D7 does not depend on it: a late third settle flips `capPaused` to
`false`, which **deletes the Continue card** and reds D7's positive assertion **before** its
negative assertion is reached — so the negative can never pass vacuously.

**RED first:** `Unable to find an element with the text: Reached the Continue limit — this run is
stopped. Cancel the workflow to start something new.`

### WR-02 — two mount-time writers of one lock

`StreamsProvider.tsx` wrote `capPaused: wf.cap_paused`; `ChatArea.tsx` wrote `capPaused: false`.
Both fire on thread open, both call the same GET, both take the same branch, both write the same
store key, and **nothing orders them**. After `244-13`, the surviving consequence is WR-01's:
whether a live harness run shows the Continue card at all was decided by a promise race.

The provider now writes `false` — **fail-closed** (a harness run paused at its own cap keeps the
composer locked, so the person clicks Cancel rather than typing into a composer the server will
409). ⛔ **The invariant is now EXECUTABLE rather than commented.**
`workflowLockWriters.lockstep.test.ts` extracts both branch bodies and compares the two `capPaused`
**expressions**, and pins the **direction** as a separate case — *agreement alone is satisfiable by
agreeing on `cap_paused`*, which would re-open the hole `244-08` shut.

⚠ **That fence strips comments before extracting, and here that is load-bearing rather than
defensive:** `ChatArea.tsx`'s own comment on this branch **quotes the rejected expression**, so an
unstripped sweep could read prose as code.

**RED first:** `…StreamsProvider writes \`wf.cap_paused\`, ChatArea writes \`false\`: expected
'wf.cap_paused' to be 'false'`.

### WR-03 — a transient hydration failure recorded as permanent

`244-10` recorded a path in `already` **before** attempting it. Its justification — *"its failure is
already named individually below, so nothing is lost"* — **is true only of the call the failure
happened in**: every later call filters the path out before the loop, so no note is produced and the
model is told nothing at all. And the `except` catches **every** exception, while the realistic
failure set here is dominated by transients (Supabase Storage, the pg pool, the Docker daemon). One
blip therefore cost the person's file for the whole ~30-minute session, **in silence** — the same
shape as defect 6b, which cost ten wasted agent rounds to discover.

⭐ **The deviation's real constraint is KEPT, not reverted.** `already` now means *"do not attempt
this again"* and has exactly two writers: **success**, and a **give-up arm** after
`_ATTACHMENT_HYDRATION_MAX_ATTEMPTS = 2` failures. `_hydration_failures` is the companion
per-session record; `_session_hydration_records` is the ONE resolver of both, so a caller cannot
acquire one and forget the other. **The DoS bound survives as a CAP rather than as never-retrying**,
and the failure is **NAMED on every attempt** — the silence was never the first note going missing,
it was every note after it.

Three cases, the drive the review said was absent (*"no case drives a second `execute_code` after a
failure … the strongest new claim in the plan is the one with no fence"*):

| case | claim |
|---|---|
| **F1** | a file that fails ONE transient read is retried on the next call **and arrives** (asserted on the COPY TARGET, never on a note — the deliverable is the FILE) |
| **F2** | a permanently-broken file is **named on every attempt** and then given up on **once**, after the cap |
| **F3** | a failed path consumes the copy budget **only once it is given up on** — WR-03's related finding, that the truncation note could be **FALSE** while flaky Storage exhausted the cap with no file arriving |

**RED first: all three.**

### WR-04 — an unreachable guard with a false justification

Three defects in one line: the arm could not fire (`getSnapshot(threadId, signal?)` is called with
no signal); its comment named a cancellation mechanism the code does not have
(`reconcileInFlightRef` **drops** a second reconcile, it does not abort the first); and it was
narrower than the shipped guard it claimed to mirror. Test 3 was a control over a branch the
product cannot reach, passing because the fixture built the shape it then asserted.

**The arm is DELETED (D-244-14-02)** — threading a signal through is a behaviour change, not a gap
fix, and a guard for a state the product cannot produce is dead code carrying a false sentence.
⭐ **The obligation is now ENFORCED instead of guessed:** Test 3 became a **precondition** asserting
reconcile's `getSnapshot` call takes exactly `threadId`, so the moment a signal is threaded it goes
red and demands the shipped two-shape guard in the same commit.

⚠ **The file has THREE `await getSnapshot(...)` sites** — measured, not assumed: `:262` (the
stream-end probe), reconcile's, and `:3841` (`probeThread`) — so the fence identifies its target by
the handler that FOLLOWS it, never by the call's shape.

**Driven both ways:** planting a second argument reds it (`expected 'threadId, undefined' to be
'threadId'`); `StreamsProvider.tsx` restored **md5-identical** (`dcba3cb17ec76d0b261fa0f02a4c91e3`).

### WR-05 — an honesty defect inside a fence's own docblock

The trailing note claimed *"The two class tokens are deliberately NOT spelled out verbatim in this
comment"*, with the right reason. **`min-h-0` was spelled verbatim at `:215`, so `grep -c` read 2.**
Worse: `244-09-SUMMARY`'s acceptance table published `overflow-y-auto` (1) and `mt-auto` (1) and
**omitted the one token whose count the edit had broken**, so the table read clean on precisely the
wrong number. Deviation 1 of that SUMMARY was raised for exactly this conflict and the remedy
reached only one of the two tokens.

⛔ **The grep was NOT loosened.** The token is now named by its CSS declaration, the way the
load-bearing one already was; `244-09-SUMMARY` carries the missing row **and** the correction beside
the original. **This is the 187-24 vacuity class reproduced inside the comment that cites 187-24**,
and loosening the check is how it would have been hidden rather than fixed.

**Measured after:** `overflow-y-auto` 1 · `min-h-0` 1 · `mt-auto` 1 · `overflow-x-hidden` 1.

### IN-01 — `overflow-y-auto` alone makes the other axis `auto`

Per CSS overflow, when one axis is not `visible` the other computes to `auto` — so the rail, a
**width-animating** column (58px ⇄ 210px) whose children switch to their expanded layout on the same
tick the width starts moving, could flash a horizontal scrollbar or be dragged sideways.
`overflow-x-hidden` makes it `hidden auto`. It cannot clip the collapsed badge (the `-right-1` badge
ends 5px inside the 58px box). **RED first** against link 6.

### IN-02 — the repaired `?raw` fence still could not tell code from a comment

`244-12` fixed the ZERO side and left the ONE side carrying the identical hazard one file over.
⭐ **DRIVEN, NOT REASONED:** the mount was removed from `MessageList.tsx` and replaced by a comment
naming it, and case 6c **stayed GREEN** — vacuity proven, not argued. With `stripComments` it goes
red. `MessageList.tsx` restored **md5-identical** (`ad87aa8abc5fa53bba038f5f85b0124c`).

The normaliser was **extracted** to `@/lib/stripComments.testutil` and `ChatLayout.scrollFrame`
repointed at it, because **the fix for *"two copies of a rule drift"* must not itself be a second
copy of a rule**. Three consumers today.

### IN-03 — the G-2 record

The round-2 table said G-2 *"was taken outside the closure round"*. The **decision** was; the
**change** was not — `5953ef1de` is a `feat(244-12)` commit inside it. The sentence is struck
through rather than deleted, and **R2-6** was added, because the review's sharper observation is
that **the round's only user-visible visual change was the one item with no UAT row** — in a round
whose whole premise is *built, drive owed*. Still **not** a G-7 violation: a re-order is not a new
capability.

## UAT rows updated (rule 7 — a row that no longer matches the code is worse than no row)

| row | change | why |
|---|---|---|
| `244-13-UAT-ROW.md` arm 4 | **new step 2b** — the harness cap-pause must read the **Cancel** wording | WR-01 changed what this state renders, and arm 4 is exactly that state |
| `244-13-UAT-ROW.md` arm 1 step 4 | ⚠ the Deep sentence is now **mode-dependent** | so a driver does not read the harness wording on a Deep thread and call it a variant |
| `244-09-UAT-ROW.md` §4 | **two new rows** — computed `overflow-x` is `hidden`, and no scrollbar through the 300ms toggle | IN-01; jsdom performs no layout, so link 6 proves presence only |
| `244-10-UAT-ROW.md` | **new arm 4** (4 steps) — a failure is named twice, then given up on; a repaired blip arrives | WR-03; ⛔ BLOCKED-with-reason if a failure cannot be induced honestly — never faked by editing the code |
| `244-UAT.md` round-2 table | **R2-6** added; the G-2 sentence corrected in place | IN-03 |

## Deviations from the work list

### 1. [Rule 3 — blocking] The WR-02 lockstep fence would have run in NO gate

**Found during:** WR-02. **Issue:** `src/__tests__` is a bare-directory entry in **neither** gate
knob — the gate's own comment says so, and names the fourteen inherited failures in
`src/__tests__/providers` as the reason a directory entry would be wrong. A new suite placed there
runs in no gate until it is listed in TARGETS **and** pinned in BASELINE. **Fix:** both knobs, at
file level, with the reason recorded at each. **Commit:** `18a851647`.

### 2. [Rule 1 — bug] The WR-04 precondition fence pointed at three call sites, not one

**Found during:** WR-04. **Issue:** the first form matched `snapshot = await getSnapshot(...)`
globally and read `['threadId','threadId','threadId']` — the file has three such calls. A fence
that matches the wrong site is not a weaker fence, it is a different claim. **Fix:** anchor on the
`console.error("reconcile failed:"` handler that follows the reconcile call. **Commit:** `7d9fed1eb`.

### 3. [Rule 1 — bug] The lockstep fence's non-vacuity threshold was set above the measured value

**Found during:** WR-02. **Issue:** `expect(PROVIDER.length).toBeGreaterThan(100000)` failed at
`95350` — comment stripping removes ~30% of that file. **Fix:** 50000, with the measured figure
recorded in the comment so the next reader does not re-derive it. **Commit:** `18a851647`.

### 4. [Rule 2 — correctness] The ledger size gate fired on two disposition cells

**Found during:** the ledger commit. `check-claude-md-size.cjs` failed `[disposition-too-long]` at
**209** and **210** chars against the 200 cap — in the turn the prose was written, which is what
that hook is for (`244-10` hit 201 and was caught the same way). Trimmed; the narrative is in the
detail file, same commit. **Commit:** `c22ec98fc`.

## Gates

| gate | base (orchestrator-measured) | now | verdict |
|---|---|---|---|
| frontend count gate | `274/274 · 0 failing · total 8238 · pinned 7449` | **`275/275 · 0 failing · total 8245 · pinned 7455`** | ✅ run 2 |
| backend `pytest tests/unit -q` | **71 failed** (ceiling, zero headroom) | **71 failed**, 4676 passed | ✅ SET-identical |
| `tsc -p tsconfig.app.json --noEmit` | 67 | **67** | ✅ set unchanged |
| `check-hot-file-ledger.cjs 244` | 0 | **0** | ✅ |
| `check-gap-closure-rounds.cjs 244` | 1 round | **1 round** | ✅ still 1 |
| `check-claude-md-size.cjs` | OK | **OK** (97,749 chars, 65.2%) | ✅ |

**Arithmetic, so growth is distinguishable from drift:** total `8238 → 8245` = **+7**, and every one
is attributed — Test 2b (+1), D7 (+1), `workflowLockWriters.lockstep` (+5). Pinned `7449 → 7455` =
**+6**: the snapshot-failure pin 4→5, plus the lockstep suite's 5. **No residual.**

### ⚠ The first count-gate run was RED, and the triage is recorded rather than the outcome

Run 1 read **`failed 2`**. Following CLAUDE.md's procedure exactly:

1. **Filenames captured from the gate's own persisted JSON BEFORE any re-run** —
   `src/pages/WorkflowBuilderPage.canvas.test.tsx`, cases *"Undo dismisses the message it was
   attached to"* and *"an undo NEVER writes to the server (D-184-03)"*.
2. **Checked against the diff:** `git diff --numstat b11e99c8e..HEAD` over that suite,
   `WorkflowBuilderPage.tsx` **and the whole `src/components/workflows/` directory` returns
   **EMPTY**. The suite and its entire blast radius are **provably unmodified** by this round.
3. **It is SEED-171's fifth named suite**, added at `196-05` precisely because it flakes
   independently of the cap and of the tree.
4. The cap was **not** touched; it was `2` on both runs.
5. Run 2, byte-identical tree: **`failed 0`**, same per-file columns, `275/275`.

⛔ **The violation was `[failing-tests]` only** — no `[missing-file]`, no `[count-decrease]`, so
every pinned file resolved and nothing shrank on either run. ⚠ **One green sample of a flaky suite
is not proof of innocence**; the correct sentence is *provably unmodified*, and that is the one used
here.

### ⚠ The backend SET diff needed normalising, exactly as `244-10` warned

The raw sorted sets differed on two lines — and **neither was a test**: pytest interleaved a
`RuntimeWarning` from stderr onto the END of a `FAILED` line, attaching to
`test_returns_json_for_large_results` on one run and to `test_truncates_to_20_rows_with_note` on the
other. Truncating each line at the first `C:\` makes both sets **identical, 71 = 71**. ⛔ Diffing the
raw output would have published a fabricated regression on a ceiling with **zero headroom**.

## Deferred, each with a trigger somebody can RUN

Recorded in `deferred-items.md` §§ 9-11. Summaries only — the triggers are there.

| # | item | trigger (abridged) |
|---|---|---|
| 9 | **IN-04** — D5 seeds after awaiting the reconcile | D5 named in a failing-file list · any plan edits ChatArea's mount effect or its deps · the next plan touching that suite |
| 10 | **IN-05** — the truncation note repeats once the budget is exhausted | a real run emits it in ≥ 3 tool results of one turn · `_ATTACHMENT_HYDRATION_MAX_FILES` lowered from 50 · a second sentence added to that arm |
| 11 | **`WORKER_COUNT=2`** — the hydration record is per process | `WORKER_COUNT` raised above 2 in any of three named files · a UAT run sees the same file copied twice · any plan moves the record off the process |

⚠ **§9 carries a measurement that SHARPENS the review's finding rather than restating it:** the
mount effect settles **twice**, so the race is real. §10 records that WR-03 fixed the arm that could
make the note **false**, leaving only repetition of a **true** note. §11 is **pre-existing since
`244-07`**, bounded by worker count, and over-copies rather than under-copies.

## Known stubs

**None.** No hardcoded empty value, placeholder string or unwired data source was introduced.

## Threat flags

**None.** No new network endpoint, auth path, file-access pattern or schema change at a trust
boundary. The `tool_dispatcher.py` change was checked against the round-1 review's own security
section, point by point: `_attachment_container_path` is **byte-unchanged** (it does not appear in
the diff), the records still key on the **raw workspace path** and never on the derived container
destination, the slice bound is still `max(MAX - len(already), 0)` so the cap cannot become a
negative index, and both records are keyed by the sandbox session — which is keyed by `thread_id` —
so a record cannot cross a thread or a tenant.

## What this does NOT close

⛔ **Not one requirement.** `SHELL-01`, `SHELL-02`, `SHELL-03` and `SHELL-04` all remain **built,
drive owed**. This round repaired the round's own output; **every one of the six UAT rows
(R2-1…R2-6) is still `pending`**, and `/gsd:verify-work` owns them.

⚠ **Solo run (`D-244-21` / `OV-SOLO-01`).** Gemini is unavailable, so this work is **SELF-verified**.
There is no independent reviewer standing behind any claim above. ⛔ **A jsdom fence proves a
component renders when handed a shape, never that the product hands it that shape** — which is the
whole reason `244-03` shipped a green mount fence over a blocker the operator found nineteen plans
later.

**What no fence here can reach:** the pixels (IN-01's scrollbar, the rail's scroll), a byte actually
landing in a real container (every hydration case drives a `MagicMock`), whether a harness run can be
driven to its Continue cap at all (WR-01's browser arm), and whether the G-2 re-order looks right on
screen (R2-6).

## Self-Check: PASSED
