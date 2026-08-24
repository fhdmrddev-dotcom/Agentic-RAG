---
phase: 194-stop-a-running-workflow
plan: 07
subsystem: chat-surface
tags: [run-01, bug-260815-04, banner, panel-09, d-18, d-14, fences, honesty]
requires:
  - "194-01 (BASELINE figures at 743965a1)"
  - "194-MEASUREMENTS.md (the duplicate-icon verdict — DEFERRED, so only the banner half is closed here)"
provides:
  - "V-07 both directions: the harness banner ADVANCES after a phase completes AND still reads the pinned string before phase 1"
  - "outerBannerLabel's 6th additive-default parameter + harnessBannerProgress(), the derivation"
  - "HarnessOuterBanner — the PANEL-09 crossing, scoped to one mounted row"
  - "The D-14 decision on RunCard's cancelled vocabulary, stated and auditable: KEPT"
  - "T-194-07-03 closed BY CONSTRUCTION: 1 reconcile fetch per thread, not one per assistant row"
affects:
  - "frontend/src/lib/toolMeta.ts (outerBannerLabel — additive only)"
  - "frontend/src/components/chat/MessageItem.tsx (the pre-tools banner arm)"
  - "frontend/src/components/chat/RunCard.tsx (comment only — zero deleted lines)"
tech-stack:
  added: []
  patterns:
    - "additive-default parameter as the mechanism — the shipped call site is the default"
    - "the honesty rule lives in the TYPE (two numbers), so no author content can reach the sentence without changing the interface"
    - "a store read scoped to a child mounted on one row, because the shipped selector FETCHES per mount"
    - "split a measurement into mount-cost and per-event-cost before claiming either"
key-files:
  created:
    - frontend/src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx
  modified:
    - frontend/src/lib/toolMeta.ts
    - frontend/src/lib/__tests__/toolMeta.test.ts
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/RunCard.tsx
decisions:
  - "The banner claims NO total ('Working on phase 2…', never 'phase 2 of 5') — the chat slice cannot prove a total, and the panel owns the spine (094/103 D1)"
  - "The read lives in a CHILD component, not beside useWorkflowLockForThread as the plan instructed — usePhases fetches per mount and MessageList is unvirtualised (measured 7 fetches vs 1)"
  - "RunCard's cancelled pair is KEPT, not extended — the receipt already carries the step count beside the word, so it does not read as though nothing survived"
  - "No glyph literal is spelled in any new prose: occurrence counts in these files are load-bearing evidence"
metrics:
  tasks: 3
  commits: 3
  duration: ~75m
  completed: 2026-08-16
---

# Phase 194 Plan 07: The Chat Banner Advances — Summary

`BUG-260815-04`'s banner half, closed at its mechanism. During a workflow run the
chat surface now says something true about progress after phase 1; before phase 1
it still reads the nine-phase-old byte-pinned string, unedited.

**Base:** main working tree, branch `develop`, HEAD `77f7fc16` at start
(`d2a3b51b` verified ancestor — `git merge-base --is-ancestor` exit 0). No
worktree; no `git worktree add`, no `git reset --hard`, no `git stash` at any
point. A pre-existing `stash@{0}` from another session was observed and left
untouched.

---

## The blocking input, and what it means for scope

`194-MEASUREMENTS.md` exists at `3b22a6c3` and its verdict is
**`⏸ NOT MEASURED — DEFERRED with a trigger`**. So, exactly as this plan's
non-goals provide for:

- **The banner-advance half is closed here.**
- **The duplicate-assistant-icon half was NOT attempted.** No `dedupMessages.ts`,
  no `StreamsProvider` identity code, nothing in the 174-04 / BUG-260609-03 area
  was read for a fix or changed.

⚠ **`MEASUREMENTS`'s own re-open trigger stays LIVE and is NOT discharged by this
plan.** It reads *"Re-open when a harness run can be observed mid-stream"*, and
the report separately records that the bug report's existing trigger — *"Re-open
if 194 closes only the banner-advance half"* — also still stands. **This plan is
precisely the event that trigger names.** Both remain open, and neither is
weakened by anything below.

The evidence the report permits citing but forbids treating as a verdict — harness
runs leave `runs.message_id` NULL in **587 of 607** rows while the sampled Deep run
sets it — is a mechanism in the DATABASE, not the symptom in the STORE, and is
consistent with all three candidate causes. Nothing in this plan turns it into one.

---

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `157329ef` | `outerBannerLabel` gains a 6th additive-default parameter; `harnessBannerProgress()` derives it; 15 new cases |
| 2 | `7e5d1fb8` | `HarnessOuterBanner` in `MessageItem.tsx` + `MessageItem.harnessBanner.test.tsx` (11 cases, 4 measurements) |
| 3 | `2a5962d3` | `RunCard.tsx` — the D-14 decision recorded in the file, comment only, zero deleted lines |

---

## ⚠ THE STRING IS BYTE-UNCHANGED, AND THE PROOF IS A COUNT ON EVERY LITERAL

Not one `-` line in `git diff` on `toolMeta.ts` carries the pinned string; the
only deleted line in that file is its `import type` line. Measured before → after,
by `grep -c` against `git show HEAD:…`:

| Literal | shipped | after | moved? |
|---|---|---|---|
| `Starting workflow…` | **2** | **2** | no |
| `Setting up agent…` | **4** | **4** | no |
| `Reasoning…` | **2** | **2** | no |

⚠ **A CORRECTION ON MEASUREMENT AGAINST THIS PLAN'S OWN ACCEPTANCE CRITERION,
recorded beside it rather than quietly satisfied.** The plan states
*"`grep -c "Starting workflow…" frontend/src/lib/toolMeta.ts` returns exactly 1"*.
**Measured at the phase base it is 2** — the shipped file already spells it once
in the `isHarness` parameter's own docblock. The stronger property is asserted
instead: **UNMOVED at its shipped count**, which is checkable without knowing what
the right number is supposed to be.

⚠ **And getting there cost a self-inflicted miss worth recording, because it is
the THIRD instance of the same trap in this repository and the second in this
phase.** My first draft of the code comment quoted the pinned string twice, moving
the count `2 → 4` **with no code change at all** — exactly what `194-04` recorded
about its own `default:` grep. Both mentions were reworded to *describe* the
string rather than spell it, and the reason is now written **in the file**, so the
next editor learns it from the source rather than from this summary. The same
discipline was then applied pre-emptively in `RunCard.tsx` (below), where it
caught two more.

---

## The mechanism, and the copy

`hasAnyTools = (message.tool_calls?.length ?? 0) > 0`, and a harness run writes
**no `tool_calls`** — so the `isStreaming && !hasAnyTools` branch held from
kickoff to terminal. The banner was **structurally incapable of advancing**. The
fix is the advancing input; the string is untouched.

**The advance trigger is `phasesDone > 0 || runningPhase > 1`**, so phase 1 merely
*running* is still "starting" — the pinned value is the honest reading there, and
an absent or not-yet-advanced slice **degrades to the shipped truth rather than to
an invented one** (T-194-07-01).

**The copy:**

| State | Sentence |
|---|---|
| harness, pre-phase-1 | the pinned string, byte-unchanged |
| a phase running, run advanced | `Working on phase 2…` |
| between phases, k finished | `1 phase done…` / `4 phases done…` |
| Deep | the shipped `Setting up agent…`, byte-identical |

### ⚠ NO TOTAL IS CLAIMED, AND THAT IS A DECISION AGAINST THE OBVIOUS CHOICE

`Phase i of N` is the vocabulary the sketch approves
(`workflow-run-surface.md` D2 line 2; the composer runchip's `phase 3/6`), and the
panel renders it. **The panel may; the chat may not**, and the reason is measured:
the panel holds the RECONCILE FLOOR — `getThreadWorkflow`'s authoritative
`total_phases` (`StreamsProvider.tsx:3382-3388`) — while `appendPhaseForThread`
(`:2779`) **grows** the slice as phases start. In any window where the floor has
not landed, a length-derived total is understated: *"Phase 2 of 2"* on a
five-phase run. Rather than race the fetch, the banner claims no total, which is
also the 094/103 split (D1: the panel owns the meaningful spine, chat carries a
**thin run receipt**). **Re-open trigger:** a corroborated total reaching the chat
surface — a wire field, or a slice flag meaning *"this is the seeded plan"*.

**No workflow-author content reaches the sentence either.** `HarnessBannerProgress`
carries **two numbers**. No slug, no phase output, no run error, no user content
can enter without changing the *type* — which is why it is a type and not a
formatted string (T-194-07-02). A test asserts the rendered shape is
`/^Working on phase \d+…$/`.

---

## The two measured re-render counts D-18 requires — and the third that changed the design

D-18 accepts the PANEL-09 crossing **"with the cost stated"** and demands a
MEASURED count. All figures below come from `React.Profiler` commit counts in
`MessageItem.harnessBanner.test.tsx` and are asserted there, not quoted here.

| # | Measurement | Result |
|---|---|---|
| 1+2 | commits across **6 token deltas**, Deep (no subscription) vs harness (subscription live) | **7 and 7 — UNMOVED** |
| 1+2b | commits at **mount**, Deep vs harness | **1 → 2 (+1)** |
| 3 | commits across **3 phase transitions**, message object held FIXED | **3** — one per transition |
| 4 | `getThreadWorkflow` calls with **6 assistant rows** mounted | **1** (and **0** on a Deep thread) |

**The load-bearing clause is the first row and it is asserted first.** D-18's stop
condition is *"if the token-stream count moves at all, the read is wired to the
wrong slice"*. It does not move.

⚠ **The half that DID move is stated rather than rounded away.** The **mount**
costs exactly one extra commit, and the cause is named rather than guessed:
`usePhases` mounts `usePanelReconcile`, whose thread-switch effect calls
`setIsLoading(true)` once (`hooks/usePanelReconcile.ts:122`). It is
once-per-mounted-banner, not per token, and it is not the cost PANEL-09 was
protecting against.

⚠ **Getting the split right required a false start, and it is recorded because the
first reading would have read as a STOP.** The initial measurement compared
*totals* — 8 (Deep) vs 9 (harness) — which looks like "the token-stream count
moved". Instrumenting per-iteration showed the difference was entirely at mount
and the stream deltas were **7 and 7**. It also explained the 7-for-6: the first
delta gives the row its first content, which settles `MessageItem`'s callback-ref
into state (`setMessageBody`, `MessageItem.tsx:393`, Phase 153-05) for one extra
commit — **present identically on both sides**, which is exactly why a measured
control beats an arithmetic expectation. *A total is not a rate; splitting them
before claiming either is the whole method.*

### PANEL-09's original reasoning is recorded BESIDE the crossing, not over it

The comment beside the read quotes `StreamsProvider.tsx:971-978` verbatim, states
that PANEL-09 is a rule about what the demux **WRITES** (this adds a READ and
changes not one line of it — `git diff --numstat` on `StreamsProvider.tsx` is
**empty**), names `useWorkflowLockForThread` as the Phase-092 precedent for a chat
component consuming a harness-demux slice, and records the accepted cost with the
numbers above.

---

## ⚠ A DEVIATION FROM THE PLAN'S LITERAL INSTRUCTION, MEASURED RATHER THAN PREFERRED

The plan says to read `usePhases` **beside** the `useWorkflowLockForThread` call at
`MessageItem.tsx:303`, and its acceptance asks that the call "sits beside" it.
**It does not: it lives in a child component, `HarnessOuterBanner`, mounted only
on the harness arm of the pre-tools branch.** The two hooks are not equivalent in
cost and the difference is a defect, not a style point:

- `useWorkflowLockForThread` is a bare store selector.
- `usePhases` **also mounts `usePanelReconcile`, which FETCHES per mount**
  (`hooks/usePanelReconcile.ts:116-130`).
- `MessageList` renders one `MessageItem` per message with **no virtualisation**
  (`MessageList.tsx:175-188`).

⇒ a hook at `MessageItem`'s top level is **one `getThreadWorkflow` per assistant
row on every thread open**, plus one store write per resolution. That is
T-194-07-03's denial-of-service disposition landing on our own backend.

**Measured, not argued** — the plan's shape was planted in production source and
observed (plant P2 below): **7 calls** where the shipped design makes **1**, and a
**Deep** thread went from **0** calls to **1**. The plan's `key_links` pattern
`usePhases\(message\.thread_id` is still satisfied verbatim
(`grep -c` → **1**), and `MessageItem.tsx` still `contains: "usePhases"`.

The mounting is doubly narrow and both narrowings are load-bearing: only inside
`isStreaming && !hasAnyTools`, and `MessageList.tsx:182` passes
`isStreaming={isStreaming && isLastAssistant}` ⇒ **at most one row**; and only when
`workflowLock != null` ⇒ a Deep thread never mounts it, so the Deep path costs
zero fetches and zero subscriptions.

The rendered DOM is unchanged: both arms render the shipped
`<span className="italic">`.

---

## Fences driven RED — three plants, every one in real production source

Each plant was applied to production source, observed, **reverted from a file copy
(never `git checkout --` — the 194-08 lesson)**, and the file confirmed
**md5-identical**.

| # | Plant | File | Cases it reds | Observed failure |
|---|---|---|---|---|
| **F-9** | harness arm returns the phase label **unconditionally** (the no-progress guard deleted) | `toolMeta.ts` | **4**, incl. the shipped nine-phase-old pin at `toolMeta.test.ts:31` | `expected 'Working on phase 1…' to be 'Starting workflow…'` |
| **P1** | the banner passes `null` progress — ignores the slice entirely | `MessageItem.tsx` | **3** | `expected 'Starting workflow…' not to be 'Starting workflow…'`; `… to be 'Working on phase 2…'` |
| **P2** | `usePhases` hoisted to `MessageItem`'s top level (the plan's literal shape) | `MessageItem.tsx` | **3** | `expected "vi.fn()" to be called 1 times, but got 7 times`; Deep control `… to not be called at all, but actually been called 1 times`; mount cost `expected 2 to be 1` |

md5s: `toolMeta.ts` `9b3dc373988761783809d365a010d027` before and after (driven
**twice** — see below); `MessageItem.tsx` `4a83da8b27f91e70ff3e18d2ce181242`
before and after both P1 and P2.

**WHICH cases failed was read, not just how many** (the 194-06 lesson):

- **F-9's four** are the shipped pin plus my three new before-phase-1 cases. The
  shipped pin firing is the whole point — it proves the byte guard can still fire
  against the exact "fix" a future reader is most likely to attempt.
- **F-9 was driven TWICE, and the second run is the one that counts.** The first
  RED was observed while the pin sat at `:35` (four import lines had been added
  above it). Those lines were then removed and the imports widened in place so the
  pin returned to **`:31`** — the address cited by `194-CONTEXT.md`,
  `194-PATTERNS.md`, `194-RESEARCH.md` and this plan — and the plant was re-driven
  against the shipped file. A RED observed against a file that then changed is not
  a receipt for the file that shipped.
- **P1's three** are the two advance cases plus MEASUREMENT 4's text assertion.
  ⚠ **MEASUREMENT 3 did NOT red under P1, and that is a finding, not a gap:** it
  counts commits, and a banner that ignores the slice still *subscribes* to it, so
  the commit count is unchanged. **Measurement 3 is a cost measurement, not a
  correctness fence**, and saying so is better than letting a reader assume the
  three measurements defend three properties.
- **P2's three clauses fire independently and each says something different** —
  the six-row fetch count, the Deep-thread control, and the mount cost. A single
  plant reding one of them would have left the other two potentially inert.

### One clause NOT independently driven, stated rather than implied

`expect(mockGetThreadWorkflow).toHaveBeenCalledWith(THREAD, expect.anything())`
was not driven RED on its own — under both plants the earlier call-count clause
fails first. It is belt-and-braces beside the driven count clause, and this
sentence is the record of that.

### A fence of my own that could not fire, caught by RUNNING and not by reading

The first run of `MessageItem.harnessBanner.test.tsx` failed **7 of 11** cases
because `useStreamsStore.getState().actions.*` are **no-op stubs**
(`streamsStore.ts:405-415`) until `StreamsProvider` MOUNTS and installs the real
closures — so `setWorkflowLockForThread` and `replacePhasesForThread` silently did
nothing and every case read the Deep value. It failed loudly rather than passing
vacuously, which is the only reason it was caught; a suite that had asserted only
*"the banner is not the pinned string"* would have gone green on the wrong
mechanism. The helpers now write the slices directly in the same copy-on-write
shape the shipped mutators use, with the finding recorded in the file.

---

## Task 3 — the D-14 decision on `RunCard`: **KEPT**, and here is why

The shipped pair is unchanged and the decision is now recorded **in the file** as
well as here, because *a plan that silently leaves a file alone and a plan that
examined it and declined are two different facts, and only one is auditable*.

**Why kept, three reasons, the third being the one that settles it:**

1. The chat receipt is deliberately **thin** (094/103, `workflow-run-surface.md`
   D1). Phase 194 already made the **spine** honest about a stop — `194-04` gave
   `Phase["status"]` a ninth member and the panel the word `Stopped`. Restating
   that here would rebuild the spine in the receipt, which is what D1 refuses.
2. Nothing needs a new source of truth: `runStatus` is already persisted and
   already drives both halves.
3. **It does not read as though nothing survived** — the D-13 worry that would
   have forced an extension. The rendered strip (`RunCard.tsx:383-389`) is
   `Run · {n} step{s} · <mark> cancelled · {elapsed}`: the step count is in the
   same sentence as the word. D-13 rejects *"collapsing to a bare `cancelled` that
   hides partial work … it discards evidence the database still holds"* — and a
   bare `cancelled` is exactly what this receipt is not. Copy claiming work was
   kept (or discarded) would be a claim this component cannot check.

**Both refusals are recorded:** the shipped mark is not replaced (D-14 forbids
replacement without a stated why, and none exists), and the sketch's net-new
stop-square is refused outright — absent from `icon-convention.md` §4's table,
and §4 requires a net-new mark to be a **flagged proposal**.

### ⚠ The FOURTH shipped cancelled mark, recorded beside RESEARCH's three-mark table

RESEARCH lists three: the filled square (`RunCard.tsx:534`), the lucide `Square`
(the Stop **control**), and the sketch's designed-never-built stop-square. **There
is a fourth and it ships: `frontend/src/pages/WorkflowRunPage.tsx:299` renders
`"⊘ Cancelled"` as the run band's cancelled sentence.** That is what disqualifies
`⊘` from any new use — it would then carry three concepts (that one, plus
`admin/ModelDiscoveryPanel.tsx:504`'s *"No longer offered"*). `194-04` measured
the same fourth mark independently; both readings agree. The literal is spelled
**here** and deliberately **not** in `RunCard.tsx` (next paragraph).

### No glyph literal is spelled in the new prose — and that caught two more misses

`RunCard.tsx`'s glyph occurrence **counts** are load-bearing evidence: `194-04`
chose the panel's stopped mark by counting renders across `frontend/src`. My first
draft of the comment moved `grep -c '"■"'` from **1 → 2** and `grep -c '⏹'` from
**0 → 2**, both with zero code change — the acceptance criteria for this very
task. Reworded to name the marks rather than spell them. Final counts, measured:

| Needle | shipped | after |
|---|---|---|
| `"■"` (quoted) | 1 | **1** |
| `■` (raw, lines) | 1 | **1** |
| `⏹` | 0 | **0** |
| `⊘` | 0 | **0** |

### G-5 evidence for `RunCard.tsx` — measured before → after, not claimed

| Figure | before | after |
|---|---|---|
| `useState(` | 3 | **3** |
| `fetch(` | 0 | **0** |
| props on `RunCardProps` | 2 | **2** |
| deleted lines in the diff | — | **0** |

**No figure moved. D-01 does not fire: the file gained no state, no fetch, no prop
and no concern — the change is 58 comment lines.**

---

## Gates

| Gate | `194-BASELINE.md` | Measured | Verdict |
|---|---|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **33** | **33** | unmoved (re-run after every task) |
| frontend count gate | `OK` · total 3918 · failed 0 · pinned 3868 · 75/75 | `count gate OK` · total **3954** · failed **0** · pinned 3868 · **75/75** | OK |
| `src/lib/__tests__/toolMeta.test.ts` | 5 cases | **20 passed / 0 failed** (+15) | green |
| `src/components/chat/__tests__/` (14 files) | — | **118 passed / 0 failed** | green |
| `MessageItem.harnessBanner.test.tsx` (new) | — | **11 passed / 0 failed** | green |
| `git diff --numstat` `StreamsProvider.tsx` | — | **empty** | untouched |
| `git diff --numstat` `MessageItem.test.tsx` | — | **empty** | byte-unedited |
| `eslint` on the three source files | 1 error + 1 warning on `RunCard.tsx` | **identical** | pre-existing, see below |

⚠ **THE COUNT GATE DOES NOT EXECUTE A SINGLE ONE OF MY CHAT SUITES, AND SAYING SO
IS PART OF THE READING.** Its `TARGETS` covers `src/components/workflows` plus four
named Builder files; `src/components/chat` and `src/lib` are outside it entirely.
That is why the total reads **3954 both before and after** — identical to
`194-08`'s reading — rather than 3954 + 26. **That is not evidence my tests ran.**
The evidence is the explicit vitest runs quoted above. The gate's value here is the
other direction: it proves nothing inside its blast radius broke (`failed 0`,
75/75 pinned present). It ran **once**, first time, `failed 0`, so no
failing-filename capture was owed.

⚠ **`scripts/vitest-count-gate.cjs` was NOT edited**, for the same two reasons
`194-08` recorded when it hit this identical hole: the script is outside this
plan's `files_modified`, and widening `TARGETS` mid-phase is a change to every
plan's gate. **Deferred with a trigger** — see below.

⚠ **The `RunCard.tsx` eslint error is PRE-EXISTING and was PROVED so, not
assumed.** `react-hooks/purity` at `:148` (`Date.now()` in render) plus one unused
`eslint-disable` at `:74`. The base file was extracted with
`git show HEAD:…RunCard.tsx`, linted, and reported the **identical** `2 problems
(1 error, 1 warning)`. My change is 58 comment lines.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug in my own prose] The new code comments falsified three acceptance greps**
- **Found during:** Task 1 acceptance check, then again in Task 3
- **Issue:** quoting a pinned literal in a comment moves the very count the
  criterion measures — `Starting workflow…` `2 → 4` in `toolMeta.ts`, and `"■"`
  `1 → 2` / `⏹` `0 → 2` in `RunCard.tsx`, all with zero code change. Third
  instance of this trap in the repository, second in this phase (`194-04`).
- **Fix:** every mention reworded to *describe* the literal. Counts restored to
  their shipped values. The reason is recorded **in both files**, so the next
  editor learns it from the source.
- **Commits:** `157329ef`, `2a5962d3`

**2. [Rule 1 — Bug in my own new test] The suite's store writes were silent no-ops**
- **Found during:** Task 2, first run (7 of 11 failing)
- **Issue:** `useStreamsStore`'s default `actions` are no-op stubs until
  `StreamsProvider` mounts; a component rendered in isolation gets nothing from
  every mutator.
- **Fix:** helpers write the slices directly in the shipped copy-on-write shape,
  with the finding recorded in the file.
- **Commit:** `7e5d1fb8`

**3. [Rule 2 — Missing critical behaviour] The plan's literal hook placement is a fetch-per-row defect**
- **Found during:** Task 2
- **Issue / Fix / Evidence:** see *"A deviation from the plan's literal
  instruction"* above — measured at **7 calls vs 1**, and a Deep thread **0 → 1**.
- **Commit:** `7e5d1fb8`

### Corrections on measurement, recorded beside the originals

- The plan's *"`grep -c "Starting workflow…"` returns exactly 1"* — measured **2**
  at the phase base. Replaced with the stronger, checkable *unmoved* property.
- The plan's *"it sits beside the shipped `useWorkflowLockForThread` read"* — it
  does not, and the measured reason is above.
- The plan's F-9 note that `toolMeta.test.ts:31` *"must not be edited"* — it was
  not, and its **line number** was preserved too, which cost two `-` lines on the
  import statements instead. Both facts are recorded in the test file: a stale
  pointer survives every gate here because nothing typechecks prose, and
  `194-CONTEXT.md` already cites a rotted `toolMeta.test.ts:30`.

---

## Deferred, with triggers

| Item | Trigger |
|---|---|
| The banner claims no total (`Working on phase 2…`, not `phase 2 of 5`), because the chat slice cannot corroborate one. | The first change that gives the chat surface a corroborated total — a wire field carrying `total_phases`, or a slice flag meaning *"this is the seeded plan"*. `Phase i of N` is already the sketch-approved vocabulary and is worth adding the moment it is honest. |
| `MessageItem.harnessBanner.test.tsx` and the `src/lib` suite sit outside `scripts/vitest-count-gate.cjs`'s `TARGETS`, so the gate can never notice them shrinking or being deleted. | The next plan whose `files_modified` legitimately includes the gate script should add them as **named entries** (the `WorkflowBuilderPage.*.test.tsx` precedent), never a bare `src/components/chat` directory entry. Identical to `194-08`'s deferral. |
| `BUG-260815-04`'s duplicate-assistant-icon half. | `194-MEASUREMENTS.md`'s trigger — a harness run observed **mid-stream**, with a `workflow_runs` row and at least one assistant row reading `runStatus: "streaming"`. **NOT discharged by this plan.** |
| The bug report's own trigger — *"Re-open if 194 closes only the banner-advance half"*. | **This plan is that event.** The trigger stays live; `194-05` owns the report's frontmatter and this summary is the notice. |
| The reconcile-fetch cost is one `getThreadWorkflow` per streaming harness banner mount, on top of the panel's own. | A phase that finds the double fetch material should give the chat surface a **read-only** phases selector (no `usePanelReconcile`) exported from `StreamsProvider`; that file is outside this plan's `files_modified`. |

---

## G-5 — the hot-file position, handed to `194-05` rather than written by me

⛔ **`CLAUDE.md` was NOT edited** — it is `194-05`'s file this wave, and `194-13`
has already written ledger rows into it. Re-derived at this plan's final commit
(`2a5962d3`), for whoever places them:

### `frontend/src/components/chat/RunCard.tsx` — ⚠ THE SHIPPED ROW IS ALREADY STALE

`194-05` added this row at `77f7fc16` carrying `194-BASELINE.md`'s
**`20 commits / 8 phases / 550 L`**. **This plan moved all three**, which is this
table's own documented habit — *a figure written at a plan's close goes stale on
the next commit that touches the file, and "the next commit" can be the same
afternoon*.

```
git log --oneline -- frontend/src/components/chat/RunCard.tsx | wc -l        → 21
git log --format=%s -- frontend/src/components/chat/RunCard.tsx \
  | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u         → 10 buckets
wc -l frontend/src/components/chat/RunCard.tsx                               → 608
```

Raw buckets: `075.7 075.8 076.1 076.2 095 095.1 128 155 194 streaming`.
⚠ **`streaming` is NOT a phase** — the untagged 075.x `fix`/`revert` pair
(`0dce56aa` / `61e5eb1e`), counted **OUT**, exactly as `194-BASELINE.md` § (e)
already documents. **The raw recipe prints 10; the PHASE count is 9.**

> **⇒ `21 commits / 9 phases / 608 L`.** It inherits that.
> **G-5 fires on the count and was honoured BY CONSTRUCTION, not waived.** The
> measured reason is a test rather than an argument: **the file gained no state,
> no fetch, no prop and no concern** — `useState(` 3 → 3, `fetch(` 0 → 0, props
> 2 → 2, **zero deleted lines**, and the whole change is 58 comment lines
> recording a decision NOT to change the vocabulary. No refactor is owed by this
> plan, and **no guardrail override was taken** — that absence is a measurement.

### `frontend/src/components/chat/MessageItem.tsx`

Already ON the ledger (`075 / 075.1 / 075.4 / 075.6 / 075.7 (5+)`, marked
*satisfied (075.7 — 2026-05-24)*). Re-derived: **57 commits, 856 lines**.

⚠ **The standard bucket recipe is UNRELIABLE on this file and the correction is
stated rather than a phase count invented.** It returns 33 buckets, of which
several are pre-convention free-text subjects (*"Redesign chat UI with full …"*,
*"Add Module 8: Sub chat"*) and three are quick tasks (`260328`, `260405`,
`260630`). A trustworthy phase count needs a manual pass this plan did not take;
the raw commit count and line count are given so the next reader inherits data
rather than a guess.

**G-5 does not fire as a new obligation here: this plan adds no second concern.**
The change is one child component rendering the shipped `<span className="italic">`
inside an arm the file already owns, plus a two-arm ternary on a value the branch
already computed. `useState(` in `MessageItem` itself is unmoved; the new state is
none.

### `frontend/src/lib/toolMeta.ts`

Not on the ledger and **G-5 does not fire**: **8 commits, 203 lines**. Recorded so
a later phase inherits a measurement rather than re-deriving one — the habit that
`WorkflowsPage.tsx` (ten phases) and `WorkflowDoorSwitch.tsx` (six) were both
missing.

---

## Threat register outcomes

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-194-07-01 | mitigate | **Done.** The sentence states only the running ordinal or the finished count; no total, no deliverable, no completion word (asserted by a negative match). An absent or unadvanced slice falls through to the pinned string, driven RED by F-9. |
| T-194-07-02 | mitigate | **Done.** The progress type carries two numbers; the rendered shape is asserted as `/^Working on phase \d+…$/`. No slug, output, error text or user content can reach it without changing the interface. |
| T-194-07-03 | mitigate | **Done, and stronger than planned.** Per-token re-render count MEASURED and **unmoved** (7 vs 7); the mount +1 is named and bounded. The fetch-per-row failure mode was measured (7 vs 1) and closed by construction. |
| T-194-07-04 | mitigate | **Done.** `toolMeta.test.ts:31` is green, byte-unedited **and line-stable**, and F-9 was driven RED against a real production plant — twice, the second time against the file that shipped. |
| T-194-07-SC | mitigate | **Done.** No npm package added; no install command run. |

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema surface.
The one new outbound call is the SHIPPED `getThreadWorkflow` reconcile, and this
plan's design reduces its count rather than adding a new caller class.

## Non-goals honoured

- ⛔ The pinned string is not edited — not reworded, re-cased, re-punctuated or
  moved; its literal count is unmoved and `toolMeta.test.ts:31` is unedited.
- ⛔ `"Setting up agent…"` and `"Reasoning…"` unchanged; the Deep path is
  byte-identical (asserted directly, plus a case proving Deep ignores progress
  even if a caller supplied it).
- ⛔ No backend change of any kind.
- ⛔ The demux is untouched — `git diff --numstat` on `StreamsProvider.tsx` is empty.
- ⛔ The duplicate assistant icon was not attempted; its deferral and trigger stand.
- ⛔ `RunCard`'s cancelled glyph/word pair is not replaced; no net-new stop-square
  was introduced (`grep -c` → 0).
- ⛔ `CLAUDE.md` and `frontend/src/stores/streamsStore.ts` untouched (`194-05`'s files).
- ⛔ `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` untouched; **no `gsd-sdk`
  `state.*`, `roadmap.*` or `requirements.*` verb was invoked.**
- Only my own five files were ever staged, by explicit path. No `git add -A`, no
  `git add .`, no `git commit -a`. No `git clean`, no `git stash`, no
  `git reset --hard`, and no `git checkout --` on any file.

## Known Stubs

None.

## Skills

`sketch-findings-agentic-rag` **was** loaded — this plan changes user-visible chat
copy. `references/workflow-run-surface.md` D1 (the panel owns the spine, chat is a
thin run receipt) and D2 (`Phase i of N`) are what settled both the no-total
decision and the Task-3 keep; `references/icon-convention.md` §4 is what refused
the net-new stop-square. ⚠ `workflow-run-surface.md` is being edited concurrently
by `194-05`; it was read, never written.

## Self-Check: PASSED

- `frontend/src/lib/toolMeta.ts` — FOUND, contains `Starting workflow`
- `frontend/src/lib/__tests__/toolMeta.test.ts` — FOUND
- `frontend/src/components/chat/MessageItem.tsx` — FOUND, contains `usePhases`
- `frontend/src/components/chat/RunCard.tsx` — FOUND
- `frontend/src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx` — FOUND, contains `Starting workflow`
- Commits `157329ef`, `7e5d1fb8`, `2a5962d3` — all FOUND in `git log`
- No file deleted at any commit (`git diff --diff-filter=D` empty on all three)
