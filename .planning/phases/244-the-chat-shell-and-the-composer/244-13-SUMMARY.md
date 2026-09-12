---
phase: 244-the-chat-shell-and-the-composer
plan: 13
subsystem: chat-shell / thread-workflow-lock
tags: [gap-closure, G-1, WR-07, SHELL-02, discriminated-union, hot-file-ledger]
gap_closure: true
gap_closure_round: 1
requires:
  - "244-03 (the server change that created the defect)"
  - "244-11 (StreamsProvider.tsx / ChatArea.tsx, wave 2)"
  - "244-12 (MessageItem.tsx, wave 2)"
provides:
  - "WorkflowLock.mode as a REAL discriminator, set from the server's own ThreadWorkflowState.mode"
  - "three PRESENCE tests replaced by MODE tests (run line, banner, composer lock)"
  - "hot-file ledger rows + sections for streamsStore.ts and toolMeta.ts"
  - "244-13-UAT-ROW.md — the browser row SHELL-02 closes on"
affects:
  - "any future consumer of the thread workflow lock"
tech-stack:
  added: []
  patterns:
    - "discriminated union at the TYPE, documented at the type rather than in one consumer's comment"
    - "server computes the fact once; the client never re-derives it"
key-files:
  created:
    - .planning/phases/244-the-chat-shell-and-the-composer/244-13-UAT-ROW.md
  modified:
    - frontend/src/stores/streamsStore.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/__tests__/ThreadRunLineKickoff.test.tsx
    - frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
    - .planning/phases/244-the-chat-shell-and-the-composer/244-UAT.md
decisions:
  - "D-244-08's FIRST arm (gate on mode) is correct AFTER ALL — C-1 measured it a no-op, and C-1 was right about the TYPE, which is what changed"
  - "the cap_paused SSE INHERITS the lock's mode; the rule is an inference with a reason, not a fact off the wire"
  - "toolMeta.ts gets a ledger row despite NOT being modified — it fires G-5 at 6 phases and G-1's criterion turned on it"
  - "WR-08's re-open trigger FIRED on this plan and was DECLINED with a reason (G-7: the wording half is an operator call)"
metrics:
  tasks: 3
  commits: 3
  duration: ~1h50m
  completed: 2026-09-12
verification: SELF (D-244-21 / OV-SOLO-01 — Gemini unavailable, no independent reviewer)
---

# Phase 244 Plan 13: The lock says what it IS — Summary

**`WorkflowLock.mode` became a real discriminator, and three presence tests became mode tests — closing UAT gap `G-1` (a phantom live workflow receipt on a Deep cap-paused thread) and open review finding `WR-07` (a genuine harness lock unlocking the composer) with one change.**

⛔ **`SHELL-02` is reported BUILT, DRIVE OWED — never closed.** `D-244-14` / `D-244-19`: a requirement closes on a driven browser row, not on a fence. `244-13-UAT-ROW.md` is that row and it is unfilled.

⚠ **SELF-verified.** Gemini is unavailable (`D-244-21` / `OV-SOLO-01`), so there is no independent reviewer standing behind any claim below.

---

## What was wrong, and why it is one defect rather than two

`WorkflowLock.mode` was the single-member literal `"harness"`, **hard-coded at all six write sites — including the branch that locks a DEEP run paused at its iteration cap.** So three consumers that wanted to ask *"is a harness run live?"* could only ask *"does a lock exist?"*, and for as long as the lock was harness-only those were the same question.

`244-03` made the server populate the lock for a cap-paused **DEEP** run (`threads.py:1237-1276`). **A server change reached three client consumers written against the old invariant.** Nothing typechecked, nothing failed, and no suite ever asked *"what does a DEEP thread with a cap_paused lock render?"*

- **G-1** — `useHarnessLiveForThread` → `ThreadRunLine` drew a live harness receipt, with a 1 s clock, for a stopped run on a thread that has never had a workflow.
- **G-1's second consumer** — `MessageItem`'s banner branch mounted `HarnessOuterBanner` on the Deep path, taking the harness copy **and** a `getThreadWorkflow` fetch (`T-194-07-03`'s disposition, silently voided).
- **WR-07** — `ChatArea.tsx:140`'s `!workflowLock.capPaused` unlocked the composer for a *genuine* harness run that is itself cap-paused.

One cause, three symptoms: **the lock did not say what it was.**

---

## Task 1 — RED (`b155d1865`)

**Driven RED against unmoved production code** (`git diff` on the four production files was EMPTY at the task's end, verified). Measured: **6 failed | 12 passed**.

| Case | Colour at RED | Verbatim failure |
|---|---|---|
| **D1** — no phantom run line | 🔴 | `AssertionError: expected 'harness' to be 'cap_paused'` |
| **D2** — no phantom 1 s clock | 🔴 | `AssertionError: expected [ [ [Function], 1000 ] ] to have a length of +0 but got 1` |
| **D3** — the DEEP banner at zero fetches | 🔴 | `TestingLibraryElementError: Unable to find an element with the text: Setting up agent…` |
| **D4** — a genuine harness run unharmed | 🟢 | anti-regression half; green both ways, as intended |
| **D5b(a)** — a harness cap keeps `"harness"` | 🟢 | anti-regression half; **stated up front as green both ways** (site 1 hard-coded it) |
| **D5b(b)** — a Deep cap is `"cap_paused"` | 🔴 | `AssertionError: expected 'harness' to be 'cap_paused'` |
| **D5** — WR-07, composer stays locked | 🔴 | `TestingLibraryElementError: Unable to find an element with the placeholder text of: Workflow running — Cancel to switch back` |
| **D6** — both SHELL-02 halves in one tree | 🔴 | `AssertionError: expected 'harness' to be 'cap_paused'` |

⭐ **D3's `getThreadWorkflow` count on the DEEP path at RED: `1`, and the rendered word was `Starting workflow…`.** Measured with a temporary `console.log` that was then removed and the file verified **byte-identical to its pre-instrumentation backup** (`diff -q` → identical). That `1` is the second consumer firing exactly as `G-1`'s `second_consumer_same_cause` describes — **the cost `MessageItem`'s docblock claims the Deep path does not pay.**

**The suite adoption.** `ThreadRunLineKickoff.test.tsx` shipped with `194.1-06` and was in **NEITHER** gate knob — `grep -n "ThreadRunLineKickoff" scripts/vitest-count-gate.cjs` returned nothing, so it ran in no gate and guarded nothing for ~50 phases. It is now in **both** (`grep -c` → `2`).

**No fixture was deleted.** `ChatArea.capPausedComposer` went `6 → 8` cases; `ThreadRunLineKickoff` `4 → 10`. The `renderPausedItem` fixture was **RE-AIMED** from `mode: "harness"` to `mode: "cap_paused"` with a docblock recording what it used to say and why — it described a Deep cap-pause only because that is what the product wrote; after the widening, the old value describes WR-07's state instead, which is now `D5`.

---

## Task 2 — GREEN (`7fdc74d6f`)

**(a) The type.** `mode: "harness"` → `mode: "harness" | "cap_paused"`, documented **at the type** in the style `streamsStore.ts` already uses for the `runId` two-id landmine — because *a measurement that lives in one consumer's comment is invisible to the next phase* is this file's own recorded lesson, and `G-1` is that lesson recurring.

**(b) All six write sites.**

| # | Site | Now | Why |
|---|---|---|---|
| 1 | `StreamsProvider` `onCapPaused` SSE | **INHERITS** (`"harness"` if the thread already holds one, else `"cap_paused"`) | the event carries no mode; recorded as an inference with its reason |
| 2 | `StreamsProvider` reconcile, `wf.locked` | `"harness"`, explicitly | the arm requires a live non-stale `active_workflow_run_id` |
| 3 | `StreamsProvider` reconcile, `wf.cap_paused` | `wf.mode === "harness" ? … : "cap_paused"` | off the wire; ⛔ never re-derived client-side |
| 4 | `StreamsProvider` kickoff seed | `"harness"` | gated on `workflowDefinitionId`, which a Deep send never sets |
| 5 | `ChatArea` reconcile, `state.locked` | `"harness"`, explicitly | same as 2 |
| 6 | `ChatArea` reconcile, `state.cap_paused` | `state.mode === "harness" ? … : "cap_paused"` | **the phantom's source** |
| — | `StreamsProvider:3762` re-subscribe | **byte-unchanged** | `...existing` already preserves mode — `git diff … \| grep -c "producerRunId"` → `0` |

**(c) Three presence tests → mode tests.** `useHarnessLiveForThread` (still returns a **BOOLEAN**, still never hands back the lock record, `harnessKickoffThreads` disjunct untouched); `MessageItem`'s banner branch; `ChatArea.tsx:140`.

⛔ **`C-1`'s measurement is preserved verbatim beside the correction**, because it was right when written: with a one-member type and every writer hard-coding it, `mode === "harness"` really was a no-op. What changed is the type.

⛔ **`MessageItem`'s false docblock is corrected BESIDE its original, not over it.** `grep -c "a DEEP thread never mounts it"` → `1`. The sentence was true at Phase 194 and false from `244-03`; the invariant is now carried by **D3**, not by the paragraph.

### Measurements

| Check | Result |
|---|---|
| `grep -c 'mode: "harness"'` StreamsProvider + ChatArea | **4** (was 7) |
| `grep -c 'cap_paused'` streamsStore.ts | 10 (was 1) |
| `grep -c "workflowLock != null ?"` MessageItem | **0** |
| `grep -c 'workflowLock?.mode === "harness"'` MessageItem | **1** |
| `grep -c "a DEEP thread never mounts it"` MessageItem | **1** |
| MessageItem `useState` / `useEffect` / props | **4→4 · 0→0 · 5→5** — not re-hollowed |
| `git diff … \| grep -c "producerRunId"` | **0** |
| `npx tsc -p tsconfig.app.json --noEmit` | **67 at base, 67 now; SET DIFF EMPTY BOTH WAYS** |
| D1-D6 + D5b | **18 / 18 green** |
| six surrounding shipped suites | **74 / 74 green, 0 failed** |

⭐ **The typechecker was run as a WORKLIST and returned an EMPTY one.** Widening a literal union surfaces every site that assumed the single member; the set diff (line-number-normalised) is empty in both directions, so **zero unpredicted sites exist** — which confirms the plan's grep rather than merely agreeing with it, and is what made this contained rather than a sweep.

---

## Task 3 — the ledger, the deferrals, the board (`13da0dde3`)

**Two ledger rows that had never existed**, with their sections, **in the same commit**:

| File | Re-derived triple | Note |
|---|---|---|
| `frontend/src/stores/streamsStore.ts` | **20 / 13 / 525** | absent for its ENTIRE LIFE at 13 phases; the phase's ledger gate had been RED on it at **every prior commit of Phase 244** |
| `frontend/src/lib/toolMeta.ts` | **10 / 6 / 218** | absent for its ENTIRE LIFE at 6 phases; **NOT modified by this plan** — `G-1`'s own artifact list names it, so the file the criterion turned on sat outside the audit |

⭐ **The restraint of three earlier executors is recorded, not overwritten.** `244-09`, `244-11` and `244-12` each saw `[no-row] streamsStore.ts` and deliberately did not clear it, because *a row minted by a non-owner goes stale before its owner lands, and a row present-and-wrong stops the audit.* That was the correct call.

**Four existing rows re-derived:** `MessageItem.tsx` **74 / 34 / 981**, `StreamsProvider.tsx` **97 / 37 / 4660**, `ChatArea.tsx` **75 / 36 / 781** — all three were stale in the authoritative scan list. `ThreadRunLine.tsx` **1 / 1 / 357, recorded as checked-and-UNMOVED** (see Deviations).

**Gates:** `node scripts/check-hot-file-ledger.cjs 244` → **exit 0**, `scan list: 267 rows · subject: 61 files · watched: 29` (**non-vacuous** — not the `subject: 0 files` Phase 242 measured on a CRLF plan). `node scripts/check-claude-md-size.cjs` → **exit 0**, `97,433 chars · 65% of limit`, no `[disposition-too-long]`, `[duplicate-row]` or `[malformed-row]`.

**Six deferrals, each with a trigger that names a file, a command or an observable event** — appended to the BOTTOM of `deferred-items.md` (`git diff --numstat` → **143 additions, 0 deletions**): the retracted-to-MINOR sent-chip lag · the Google-native Drive file · the un-reproduced `200`-creates-nothing import · `Retry-After` · `WR-08` · `WR-04`.

⭐ **Two existing triggers FIRED on this plan and both are ANSWERED rather than silently re-armed** — which is the failure mode the register exists to prevent:
- **`WR-07`'s** first arm (*"a plan whose `files_modified` names `ChatArea.tsx`"*) fired, and is recorded **CLOSED** with its fences named. Its instruction *"do not close this by asserting it is unreachable"* is obeyed: the reconcile route stays latent and the fix is fail-closed regardless.
- **`WR-08`'s** (*"the next plan naming `MessageItem.tsx`"*) fired, and is recorded **DECLINED with a reason**: G-7 forbids a closure round from shipping a copy change, and the wording half is an operator call (the strings are ported from sketch 236's `COPY.js`). The mode half is re-armed on a narrowed trigger.

`IN-01`…`IN-09` were **checked and deliberately NOT restated** — entry 10 already carries them, and duplicating a register is how two registers start disagreeing.

**The Round 2 board** consolidates all five row files into `244-UAT.md`, **append-only** (`git diff --numstat` → **40 additions, 0 deletions**; not one recorded correction, retraction or `## Gaps` YAML block was touched). Every verdict reads `pending`; each row names the gap it closes; `G-2`'s deliberate absence is explained rather than left to read as an omission.

---

## Verification

**Frontend count gate, from the repo root, `GSD_VITEST_MAX_WORKERS=2`, run TWICE with identical output:**

```
  total 8238  ·  failed 0  ·  pinned total 7449
count gate OK — 274/274 pinned files present, no per-file decrease, 0 failing.
```

**Attribution against the merged base (`8226 · 7437 · 273/273`), with no residual:**

| Source | grand total | pinned total | pinned files |
|---|---|---|---|
| `ThreadRunLineKickoff.test.tsx` **ADOPTED** (4 shipped + 6 new cases) | **+10** | **+10** | **+1** |
| `ChatArea.capPausedComposer.test.tsx` `6 → 8` (D5, D6) | **+2** | **+2** | 0 |
| **total** | **+12** ✅ | **+12** ✅ | **+1** ✅ |

⭐ **The adoption is attributed SEPARATELY from the new cases, as the plan required** — adopting a suite raises the grand total and that is the desirable direction, never drift.

- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` — 67 errors at base, 67 now, **set diff empty both ways**. ⛔ Not `npx tsc --noEmit`, which type-checks zero files.
- **Backend:** `git diff --stat -- backend/ supabase/` **EMPTY**. The zero-headroom backend baseline (71) is not at risk and was not re-run.
- **Packages:** `git diff --stat -- frontend/package.json frontend/package-lock.json` **EMPTY** — no install, no legitimacy audit owed (`T-244-13-SC`).
- **Tree quietness:** `git status --short` was clean of files this plan did not touch at every commit, and both gate runs were made on a quiet tree with no sibling agent. ⚠ `sketchComposition.test.tsx` — which flaked in both prior waves and has twice been nominated as SEED-171's sixth suite — **did NOT flake here on either run**. Recorded as an observation, never as proof of innocence: one green sample of a flaky suite proves nothing, and the nomination therefore stands at two, not three.

---

## Deviations from Plan

### 1. `[Rule 3 - Blocking]` `since_cursors` is load-bearing in the reconcile and its absence is SILENT

**Found during:** Task 1, first RED run. **Issue:** the shipped `beforeEach` in `ThreadRunLineKickoff.test.tsx` mocks `getSnapshot` without `since_cursors`. `reconcile` does `Object.entries(snapshot.since_cursors)` and dies inside its own `catch` with `TypeError: Cannot convert undefined or null to object` — **so the workflow-lock block below it never runs and no lock ever lands.** Four cases failed with `expected false to be true`, which looks exactly like the fix not working. **Fix:** the new driver supplies `since_cursors: {}` and the reason is recorded in the file. The shipped `beforeEach` is untouched (it was harmless while no case drove a reconcile).

### 2. `[Rule 3 - Blocking]` `sendMessage` opens no stream unless the thread is VIEWED

**Found during:** Task 1, `D5b`. **Issue:** `subscribeToRun` is gated on `isThreadInStreamPool`, whose keep-set is built from `activeThreadIdRef` + the MRU list — both written **only** by `setViewingThread`. Without it the POST resolves and no SSE callback bundle ever exists. **Fix:** the driver views the thread first and lets the nav reconcile settle before sending (a reconcile landing *after* the kickoff seed would clear the very lock `D5b(a)` is about). Recorded as a product fact in the file.

### 3. `[Rule 1 - Bug in the test]` `phaseIndex` is 0-based

**Found during:** Task 1, `D4`. A 1-based fixture made the middle phase of three render **`Step 3 of 3`** — `harnessBannerProgress` renders `phaseIndex + 1` (`toolMeta.ts:128`). An off-by-one that produces a plausible wrong number rather than a crash. Fixed in the fixture and recorded in `toolMeta.ts`'s new ledger section.

### 4. `[Rule 1 - Fixture]` `D6` needed `continues_remaining: 0` to reach the sentence it asserts

**Found during:** Task 2. The card renders the **iteration**-limit sentence while continues remain and the **Continue**-limit sentence only when exhausted (`MessageItem.tsx:776-778`). ⚠ **`D6`'s RED was on the `mode` assertion** (`expected 'harness' to be 'cap_paused'`), which is the real defect; the fixture correction came afterwards and does not weaken that. This is `244-11`'s lesson one surface over — *a fixture that cannot express the state a claim is about pins the claim in the state that refutes it.*

### 5. The `mode: "harness"` grep drops by **3**, not by the 2 the acceptance predicted

Site **1** (the `onCapPaused` SSE) also stops being a literal, because the plan's own instruction for it is to **inherit**. Combined count `7 → 4`: sites 3 and 6 became wire-derived (−2) and site 1 became an inherit expression (−1). Recorded rather than absorbed.

### 6. ⛔ `ThreadRunLine.tsx` is still at ONE phase — the plan predicted two

`244-13-PLAN.md` asked the ledger to record that this file is *"one phase away"* from owing a detail section. **It is not.** `244` fixed `G-1` in the run line's **INPUT** (`useHarnessLiveForThread`), leaving `ThreadRunLine.tsx` byte-unchanged; the re-derived triple is **`1 / 1 / 357`, unmoved**. Recorded as *checked, unmoved* so a reader can tell that from *nobody checked*.

### 7. Two comments this plan authored quoted a literal an acceptance grep counts

**Found during:** Task 2's acceptance greps, which read `2` where `1` was required. Both were reworded to name the thing by **ROLE**. ⚠ This is the 187-24 lesson firing in real time: **a prose copy of a pinned literal moves the acceptance grep and makes the pin vacuous** — and it nearly happened inside the very plan that minted `toolMeta.ts`'s row for carrying that rule.

---

## Findings this plan produced that nobody else saw

### ⚠ The two ledger tables had DRIFTED APART, and only one of them is gated

`CLAUDE.md`'s G-5-FIRING shortlist read `MessageItem.tsx 73 / 34 / 954` and `StreamsProvider.tsx 96 / 37 / 4614`, while `docs/HOT-FILE-LEDGER.md`'s **authoritative** scan list still read `71 / 37 / 904` and `94 / 38 / 4528`. Waves 1-2 updated the shortlist and not the scan list. **`scripts/check-hot-file-ledger.cjs` reads only the scan list**, so the table an agent is most likely to read at planning time is the one nothing verifies — and the two disagreed on the **phase count** (`34` vs `37`), which is the figure G-5 actually fires on. Both are now corrected; the re-open trigger is recorded in `deferred-items.md`.

---

## Threat register disposition

| Threat ID | Disposition | Evidence |
|---|---|---|
| `T-244-13-01` Spoofing — a run line claiming "live" | **mitigated** | D1 (no `data-run-line-state="live"`, no harness word), D2 (no 1 s interval), D3 (no harness banner), D4 (the genuine reading unchanged) |
| `T-244-13-02` EoP — WR-07 | **mitigated** | D5 (composer disabled, sentence on both axes) + D5b(a) (the SSE writer inherits `"harness"`) |
| `T-244-13-03` DoS — a stray `getThreadWorkflow` on the Deep path | **mitigated** | D3 asserts a **zero** delta over the streaming row's mount; D4 is its positive control at `> 0`. Measured at RED: **1** |
| `T-244-13-04` Tampering — the `runId` two-id landmine | **accept (unchanged)** | selector still returns a boolean; `:3762` byte-unchanged (`grep -c producerRunId` → 0); the `194-03` F-1 fence untouched and green |
| `T-244-13-05` Repudiation — the ledger's blind spots | **mitigated** | both rows + both sections in one commit; gate reports no `[no-row]`, exit 0, non-vacuous subject count |
| `T-244-13-SC` package installs | **n/a** | no package installed; `package.json` / `package-lock.json` diff EMPTY |

---

## What is OWED

- ⛔ **`SHELL-02` is BUILT, DRIVE OWED.** `244-13-UAT-ROW.md`, four arms, every verdict `pending`. Arm 4 (`WR-07` live) may legitimately come back **BLOCKED with a reason** — ⛔ do not seed a `workflow_runs.status='cap_paused'` writer just to tick it.
- ⛔ **An independent review.** Everything above is SELF-verified.
- Six deferrals with live triggers; the ledger-drift finding; `ThreadRunLine.tsx`'s detail section at its third phase.

---

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `244-13-UAT-ROW.md` exists | `[ -f … ]` | FOUND |
| `244-13-SUMMARY.md` exists | this file | FOUND |
| commit `b155d1865` | `git log --oneline --all \| grep` | FOUND |
| commit `7fdc74d6f` | `git log --oneline --all \| grep` | FOUND |
| commit `13da0dde3` | `git log --oneline --all \| grep` | FOUND |
| `check-hot-file-ledger.cjs 244` | exit code | **0** |
| `check-claude-md-size.cjs` | exit code | **0** |
| count gate | verdict line, twice | `count gate OK — 274/274 · 0 failing` |
| STATE.md / ROADMAP.md untouched | `git status` | **not modified** |
