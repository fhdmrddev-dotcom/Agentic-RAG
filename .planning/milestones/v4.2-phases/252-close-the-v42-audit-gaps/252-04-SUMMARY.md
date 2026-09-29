---
phase: 252-close-the-v42-audit-gaps
plan: 04
subsystem: ui
tags: [react, zustand, streaming, workspace-panel, run-honesty, typescript]

requires:
  - phase: 250
    provides: "HONEST-03 / HONEST-04 — `deriveTodoDisplayStatus`, the `isRunLive` seam, and the hook-order source fence this plan extends"
  - phase: 251
    provides: "the seeds-register renumber that moved SEED-269 → SEED-284, which is what W-8's dangling citation is a casualty of"
provides:
  - "`reconcilingThreads: Set<string>` — a per-thread store slice marking reconcile's own `/snapshot` round-trip, read through `useReconcilingForThread`"
  - "a PER-THREAD `reconcileInFlightRef`, so a reconcile on thread A can no longer drop thread B's"
  - "`PhaseCard`'s `runLive?: boolean` prop and `statusMetaForRun()` — the panel's SECOND run-state surface stops claiming `running` for a dead run"
  - "`BUG-260915-01` corrected: its stated mechanism was measurably false and its fix candidate #1 was already shipped"
affects: [252-05, workspace-panel, streams-provider, count-gate-pins]

tech-stack:
  added: []
  patterns:
    - "A presentation override over a WIRE type: `statusMetaForRun` returns a row that is deliberately NOT a `STATUS_META` key, because `Phase[\"status\"]` is what the backend can emit and this state is what it emits NOTHING for"
    - "`undefined !== false` as a third state on an optional prop — the pre-fetch/no-caller default is today's behaviour, and the override fires only on an explicit `false`"

key-files:
  created: []
  modified:
    - .planning/reported-bugs/todo-rows-flash-not-ticked-on-a-live-run-after-thread-open.md
    - frontend/src/stores/streamsStore.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/TodosSection.tsx
    - frontend/src/components/panel/__tests__/TodosSection.test.tsx
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx
    - frontend/src/components/panel/PhaseTimeline.tsx
    - frontend/src/components/panel/phaseStatusMeta.ts
    - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
    - frontend/src/components/chat/ThinkingBlock.tsx

key-decisions:
  - "D-20 honoured: the report was corrected BEFORE any code, with the false sentences struck through rather than deleted"
  - "D-21 honoured: a NEW `reconcilingThreads` slice, never a reuse of `loadingThreads` — measured, `grep -c loadingThreads` in StreamsProvider.tsx is 8 at base and 8 after"
  - "D-22 honoured: `reconcileInFlightRef` is a `Set<string>`; the retry it unblocks is deliberately NOT taken"
  - "D-23 honoured: three hooks, three `const` lines; the source fence now asserts three calls on three DISTINCT line numbers"
  - "D-25/D-26 honoured: ONE optional prop from `PhaseTimeline`'s own `runTerminal`; the not-live reading is a ROW, not an `if`"
  - "D-27 honoured: `git diff 53e2435b7 -- WorkspacePanel.tsx` is EMPTY"
  - "The new Set is TRANSIENT and is deliberately absent from the persist wiring — the trigger is `[bucketsBySurface, todosByThread, tasksByThread]` and the writer takes only those"

patterns-established:
  - "Every `reconcile` exit path clears the liveness slice through ONE `finally`, so a stuck `reconciling` (which would claim live forever) is structurally impossible rather than merely avoided"
  - "A counting acceptance criterion and prose that spells its needle cannot coexist — three greps in this plan were made unreadable by their own comments and reworded (the 187-24 lesson, fired three more times)"

requirements-completed: [HONEST-03, HONEST-04]

duration: ~75min
completed: 2026-09-16
---

# Phase 252 Plan 04: Both of the workspace panel's run-state surfaces stop lying Summary

**A thread mid-reconcile now reads live instead of `Not ticked`, a dead run's phase card stops
spinning, and `BUG-260915-01` no longer tells the next fixer to build a no-op.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 4 of 4
- **Files modified:** 11 (1 planning, 7 source, 3 test)
- **Commits:** `1e42d0a8c` · `28318416c` · `448d03dbc` · `4e982fe7b`
- **Base asserted:** `53e2435b7` (the worktree arrived on `84e3b020f`, the stale default branch,
  and was `git reset --hard` to the correct base before any read — the sixth consecutive executor
  to hit this)

---

## Task 1 — `BUG-260915-01` corrected before any code (D-20)

### ⭐ The four cited line references, VERIFIED AT `53e2435b7` and quoted

The report's claim that *"opening a thread triggers no reconcile"* is **refuted**. Every line was
opened and read; none was inherited from the plan.

| # | Site | Line, verbatim |
|---|---|---|
| 1 | `StreamsProvider.tsx:1936-1939` | `if (threadId !== null) {` / `useStreamsStore` / `.getState()` / `.actions.reconcile(threadId)` |
| 2 | `ChatArea.tsx:323-325` | `useLayoutEffect(() => {` / `setViewingThread(thread?.id ?? null)` / `}, [thread?.id])` |
| 3 | `StreamsProvider.tsx:1503` | `const reconcileInFlightRef = useRef(false)` |
| 4 | `StreamsProvider.tsx:1975` · `:2506` | `if (reconcileInFlightRef.current) return` · `reconcileInFlightRef.current = false` |

Plus the code's own note at `:2028`, quoted in full in the report: *"would hold
`reconcileInFlightRef` — a GLOBAL flag, not a per-thread one … Make the in-flight guard per-thread
first if a retry is ever wanted here."*

⚠ **Two of the plan's line references were off by one or two and are corrected here rather than
copied forward.** `loadMessages`'s `loadingThreads` **add** is at **`:3277`** (the plan said
`:3275-3277`; `:3275` is a comment), and the **clear** block is **`:3386-3391`** (the plan said
`:3381-3390`). Both were re-derived with `grep -n`, and both confirm the substance: `loadMessages`
is the ONLY writer of that set.

### What changed in the report

- `status: open` → **`status: folded`**, `folded_into: null` → **`folded_into: 252`**, plus a
  `corrected:` line dated 2026-09-16.
- The false mechanism is **struck through, not deleted** — `grep -c "~~"` returns **10**.
- Fix candidate **#1 is marked ALREADY IMPLEMENTED** with the line reference that proves it.
- Candidate #2 is marked correct, with the variant this plan took.
- One line records the method: *the report was written from the symptom and reasoned backwards to a
  mechanism; the mechanism was never driven.*

⚠ **ONE DEVIATION, and it is the W-8 lesson applied to my own work.** The plan's `corrected:` line
was first written citing `.planning/v4.2-MILESTONE-AUDIT.md §3`. **That file does not exist in this
worktree** (`ls` → no such file; it is untracked in the main checkout). Citing it would have shipped
exactly the dangling-citation defect Task 4 was fixing four commits later. The citation now points at
`252-RESEARCH.md §5.1` and `252-CONTEXT.md` D-20, both `ls`-verified.

✅ **No source file was touched by this task** — `git diff --name-only` after it named **exactly one
path**, the report.

---

## Task 2 — Hole 1: a per-thread reconciling signal and a per-thread lock

### RED, driven and quoted

```
FAIL … > a reconciling thread still reads IN PROGRESS — the thread-open flash (BUG-260915-01)
Error: expect(element).toHaveTextContent()
Expected element to have text content:  /in progress/i
Received:  Translate full document content to ArabicNot ticked

FAIL … > hooks are never short-circuited — the source fence a mocked-hook test cannot be
AssertionError: expected [ 1, 1, +0 ] to deeply equal [ 1, 1, 1 ]
```

⭐ **The idle control passed on that same RED run and passes now.** That is the case that stops the
fix from deleting `HONEST-03` instead of closing it: an always-optimistic panel would satisfy the
flash case and quietly retire the requirement.

### ⛔ Every `reconcile` exit path, ENUMERATED

Derived mechanically (`awk` over the function body filtering `return` at reconcile-body
indentation), not eyeballed. Line numbers are post-change.

| # | Exit | Clears `reconcilingThreads`? | Clears the lock? |
|---|---|---|---|
| 1 | `:1984` the top guard `if (reconcileInFlightRef.current.has(threadId)) return` | **N/A — nothing to clear.** This call never added; the in-flight call owns the entry and will clear it. | N/A |
| 2 | `:2082` the `getSnapshot` catch arm's early `return` (the 244-11 banner path) | ✅ **YES** — it is INSIDE the `try`, so the `finally` runs | ✅ yes |
| 3 | `:2237` `if (activeThreadIdRef.current !== threadId) return` inside the `for (const run of activeRuns)` loop | ✅ **YES** — inside the `try` | ✅ yes |
| 4 | normal fall-through off the end of the `try` | ✅ **YES** | ✅ yes |
| 5 | **any thrown exception**, including from `getThreadWorkflow` or a `setState` | ✅ **YES** — `finally` is unconditional | ✅ yes |
| — | `:2555` / `:2558` `return {}` and `return { reconcilingThreads: next }` | not exits — they are the `setState` **updater's** returns, i.e. the clear itself | — |

**There is exactly ONE clear site, and that is the design.** Both the add and the clear are outside
every branch: the add sits immediately after the lock acquisition and before the `try`, the clear
sits in the `finally`. A stuck entry — a thread claiming live forever, the mirror-image defect and
strictly worse because it is silent (TM-252-17) — is therefore structurally unreachable rather than
merely avoided.

The other returns the `awk` sweep surfaced (`:2109`, `:2141`, `:2184`, `:2186`, `:2229`) are inside
`setState` updaters and array predicates and are not exits of `reconcile`.

### ⭐ `isRunLive`'s consumers — the grep, recorded

```
$ grep -rn "isRunLive" frontend/src
todoRunHonesty.ts:91   * @param isRunLive   is a run streaming (or loading) on the thread being viewed
todoRunHonesty.ts:99    isRunLive: boolean,
todoRunHonesty.ts:102   if (isRunLive) return status
TodosSection.tsx:117   function TodoRow({ todo, isRunLive }: …)
TodosSection.tsx:122     const status = deriveTodoDisplayStatus(normalizeStatus(todo.status), isRunLive)
TodosSection.tsx:180   function DerivedRow({ item, isRunLive }: …)
TodosSection.tsx:186     const status = deriveTodoDisplayStatus(normalizeStatus(item.status), isRunLive)
TodosSection.tsx:264     const isRunLive = isStreaming || isLoading            ← now …|| isReconciling
TodosSection.tsx:279              <DerivedRow  … isRunLive={isRunLive} />
TodosSection.tsx:306              <TodoRow     … isRunLive={isRunLive} />
```

✅ **CONFIRMED: `deriveTodoDisplayStatus` is still the ONLY semantic consumer.** The four
`TodosSection` hits are pure pass-through — both row components take the value and hand it
straight to that one function. It is read to **suppress** the `not_ticked` claim and **nothing
positive is asserted from it** (`if (status === "completed") return "completed"; if (isRunLive)
return status; return "not_ticked"`), which is exactly what makes folding *"we do not know yet"*
into it correct (D-24). The semantic limit is recorded in three places: the store field's docblock,
the selector's docblock, and the component's comment.

### ⭐ The persist-wiring decision, with the block read

**DECISION: the new Set is TRANSIENT and is NOT persisted.** `StreamsProvider.tsx:4077-4100` was
read in full. The throttled writer's subscription selector is

```js
(state) => [state.bucketsBySurface, state.todosByThread, state.tasksByThread] as const
```

and `writeSnapshotToLocalStorage` takes only `bucketsBySurface`, a timestamp, a predicate,
`todosByThread` and `tasksByThread`. **The new Set is absent from both the trigger and the writer,
so no wiring change was needed or made.** Rehydrating an in-flight fetch flag on F5 would claim a
request that is not running — the stuck-signal defect, arriving by a different door. (TM-252-20.)

### The counting criteria

| Criterion | Required | Measured | Verdict |
|---|---|---|---|
| `grep -c reconcilingThreads streamsStore.ts` | ≥2 | **3** | ✅ |
| three selector calls on three DISTINCT lines | 3 | `285` / `286` / `287` | ✅ |
| `grep -c "reconcileInFlightRef.current = true"` | 0 | **0** | ✅ |
| `grep -c loadingThreads StreamsProvider.tsx` | unchanged | **8** at base, **8** after | ✅ |
| `git diff …/chat/MessageList.tsx` | empty | **empty** | ✅ |

⛔ **`grep -c "ForThread(threadId) ||" TodosSection.tsx` is 1, NOT 0 — and it was 1 at base too.**
Measured: `git show 53e2435b7:…/TodosSection.tsx | grep -c` → **1**. The single hit is the component's
own shouting comment, which spells the forbidden expression in order to forbid it. **The plan's
criterion was unsatisfiable at base and is not a defect in this change** — the 187-24 trap, in the
acceptance criterion rather than in the code. The real guard is the suite's `stripComments`-based
source fence, which strips exactly this and is what the extended pin rides.

⚠ **Two of my own comments hit the same trap and were reworded rather than left.** A draft comment
in `reconcile` spelling `loadingThreads` pushed that count 8 → 10; it now says *"the cold-load
slice"* and names the token only in `streamsStore.ts`, where no criterion counts it.

### Also run

`node scripts/check-react-hooks-rules.cjs` → **`OK — no NEW react-hooks/rules-of-hooks violation`**
(two pre-existing `ToolCallPanel.tsx` reports, untouched). This is the PRIMARY guard the fence's own
comment names; the source fence is the backstop.

---

## Task 3 — Hole 2: the panel's OTHER run-state surface

### RED, driven and quoted

```
FAIL … > THE LIE: status=running on a TERMINAL run no longer reads Running, is not busy, is not forced open
AssertionError: expected 'Running' not to be 'Running' // Object.is equality

FAIL … > retrying is the OTHER live reading and moves with running
AssertionError: expected [ '↻', 'Attempt' ] to strictly equal [ '⊣', 'No outcome' ]
```

⭐ **Both controls — `runLive={true}` and NO prop — passed on the RED run and pass now.** The
default case is what proves every existing caller is unaffected.

### ⭐ The glyph occurrence-count grep, BEFORE the edit

Chosen by measurement exactly as the `recorded-not-sent` row's was. Counts across `frontend/src` at
`53e2435b7`:

| candidate | occurrences | |
|---|---|---|
| `⋯` | 56 | rejected — already everywhere |
| `↯` | 1 | rejected — already carries a meaning |
| `⇥` | 1 | rejected |
| `⊙` | 2 | rejected |
| **`⊣`** | **0** | ⭐ **CHOSEN** |
| `⇸` `⌁` `⊟` `⋮` `⇲` `⌇` `␥` `⍰` `⤓` `↧` `⊗` | 0 | viable, not chosen |

After the edit: **3** (one in `phaseStatusMeta.ts`, two assertions in `PhaseCard.test.tsx`).
⛔ No rejected glyph is spelled in the shipped comment — its occurrence count is the evidence, and
prose that spells it makes the count unreadable.

**The word is `No outcome`.** It reuses none of the nine shipped words, and the row's comment says
why each was rejected: `Failed` claims fault, `Skipped` claims it did not run, `Complete` claims it
finished, `Stopped` is 194's word for a person ending the run, `Not sent` is 189's governed
external-action terminal, `Unknown` claims we cannot tell which status it is. **Quiet terminal** —
`text-panel-muted-foreground`, the token `pending`/`skipped`/`unknown`/`recorded-not-sent` share.
⛔ No warning colour: the run ending is not this step's fault.

### The `isRunning` consumers, listed (the plan asked for this)

All of them fall out of the one changed line with no further edit:

| Line | Consumer | Reads |
|---|---|---|
| `:498` | the BLOOM frame (amber wash + glowing left bar) | `isRunning` |
| `:533` | the `llm_batch_agents` violet left-border suppression | `!isRunning` |
| `:437` `:441` | the initial and effect-driven auto-expand | `isRunning` |
| `:453` | `forcedOpen` → `aria-disabled` on the accordion button | `isRunning` |
| `:648` | `aria-busy` on the `role="region"` panel | `isRunning` |
| `:555` `:670` | the type one-liner / activity line | `isActive` |
| `:620` `:680` | the live activity row + spinner | `isRunning` |

⚠ **THREE sites read `phase.status === "retrying"` DIRECTLY and were fixed too — the plan asked me
to check, and the check found something.** Left alone they would have printed the new quiet word
beside a violet *active* frame and an `Attempt 2` pill:

1. `isActive = isRunning || phase.status === "retrying"` → now `isRunning || isRetrying`
2. the class ladder's `: phase.status === "retrying" ?` violet arm → now `: isRetrying ?`
3. `statusText`'s `phase.status === "retrying" && phase.attempt != null` → now `isRetrying && …`

`const isRetrying = phase.status === "retrying" && runLive !== false` is the one new derivation, and
it exists because `statusMetaForRun` overrides `retrying` as well as `running`. A sixth test case
pins it in both directions.

### The counting criteria

| Criterion | Required | Measured | Verdict |
|---|---|---|---|
| `grep -c threadId PhaseCard.tsx` | 0 | **0** (base: 0) | ✅ |
| `grep -c "useStreamsStore\|usePhases\|useTasks" PhaseCard.tsx` | 0 | **0** | ✅ |
| `grep -c "runLive !== false"` | ≥1 | **4** | ✅ |
| `grep -c "!!runLive"` | 0 | **0** | ✅ |
| `grep -c statusMetaForRun phaseStatusMeta.ts` | ≥1 | **1** | ✅ |
| `git diff 53e2435b7 -- WorkspacePanel.tsx` | EMPTY | **empty** | ✅ D-27 |

⚠ **Both zero-criteria were 1 and 2 on the first measurement, and both hits were MY OWN COMMENTS**
spelling `threadId` and `!!runLive` in order to forbid them — the 187-24 trap firing twice more in
one task. Both were reworded to say *"no thread id"* and *"never a truthiness coercion"*, with the
counting reason written into the comment so the next editor does not re-introduce it.

⛔ **`STATUS_META` has NINE keys, not the seven the plan's criterion states.** Measured before
(`pending, running, done, failed, retrying, skipped, recorded-not-sent, unknown, cancelled` = **9**)
and after (**9** — unchanged, no key added). The code wins; the criterion was written from a stale
count.

⛔ **`__tests__/PhaseCard.test.tsx` DOES NOT EXIST and was not created.** The plan's `files_modified`
names that path, but the suite lives at **`src/components/panel/PhaseCard.test.tsx`** — which is
exactly what the count gate's own comments at `:2429` / `:4797` say (*"`PhaseCard.test.tsx` does not
live [in `__tests__/`]"*, `git ls-files | grep -c` → 1). Creating a second file would have split the
suite. The existing one was extended, per the plan's own *"check whether the file exists"*.

---

## Task 4 — W-6, W-6b, W-8

### ⭐ The tsc SET diff — a strict subset, proven by `diff`, never by counts

`npx tsc -p tsconfig.app.json --noEmit`, both sets captured whole and sorted.
⛔ `npx tsc --noEmit` alone checks **zero files** here and is never quoted.

| | errors |
|---|---|
| base `53e2435b7` | **67** |
| after | **65** |
| `TS2556` after | **0** |

The two removed lines, verbatim from the base set:

```
src/components/panel/__tests__/WorkspacePanel.derived.test.tsx(62,69): error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
src/components/panel/__tests__/WorkspacePanel.derived.test.tsx(63,65): error TS2556: A spread argument must either have a tuple type or be passed to a rest parameter.
```

⚠ **A RAW `diff` IS NOT CLEAN AND SAYING SO IS THE POINT.** One pre-existing error MOVED:

```
< src/stores/streamsStore.ts(439,55): error TS2345: … ; ... 12 more ...; actions: { ...; }; }
> src/stores/streamsStore.ts(460,55): error TS2345: … ; ... 13 more ...; actions: { ...; }; }
```

That is the **same** long-standing zustand `StateCreator`/`subscribeWithSelector` mismatch, relocated
by the 21 lines Task 2 added and with its elided-member count updated `12 → 13` because Task 2 added
a field. Normalising `(line,col)` and `... N more` and re-diffing:

```
$ diff normalized-base normalized-after
37,38d36
< …WorkspacePanel.derived.test.tsx(L,C): error TS2556: A spread argument must either …
< …WorkspacePanel.derived.test.tsx(L,C): error TS2556: A spread argument must either …

$ comm -13 normalized-base normalized-after | wc -l
0
```

✅ **Zero errors exist after that do not exist before. Strict subset, 67 → 65.**

### W-6b — the stale comment, re-verified at THIS commit before quoting

Both of the research's claims hold at `53e2435b7`:

- `scripts/vitest-count-gate.cjs:152` → `"WorkspacePanel.derived.test.tsx": 4,`
- `scripts/vitest-count-gate.cjs:4212` → `"src/components/panel/__tests__/WorkspacePanel.derived.test.tsx",`
- `git log -S` on **both** the TARGETS line and `const useStreamingForThread = vi.fn(() => true)`
  returns the **same single commit**: **`b0dd02f28`** — *"fix(250): the liveness read short-circuited
  a hook and crashed the page"*.

So the sentence *"AND THIS SUITE IS IN NEITHER COUNT-GATE KNOB"* was **accurate when written and
invalidated by its own diff**. It is struck through, not deleted, with what was true then and what
is true now recorded beside it, plus the one-line re-derivation command.
⭐ **What rotted was the PROSE, not the gate.** `grep -c "~~"` in that file → **2**.

### W-8 — the dangling seed path

`ls .planning/seeds/SEED-284-one-home-for-the-elapsed-formatter.md` → **exists**. The citation at
`ThinkingBlock.tsx:158` now points there; `grep -c "SEED-269-one-home" ThinkingBlock.tsx` → **0**.
The rest of that comment — why the extraction was deliberately NOT taken — is byte-unchanged.

```
$ grep -rn "SEED-269-one-home" frontend/ backend/ scripts/ docs/
(empty)
```

✅ **No live citation of the dead path remains.** Repo-wide, 12 hits survive and all are
**historical planning artifacts** that should not be rewritten: `243-04-PLAN.md` /
`243-04-SUMMARY.md` / `243-VERIFICATION.md` (the archived milestone that planted it),
`251-RENUMBER-LEDGER.md` and `251-GATE-BASELINE.md` (the renumber's own record of the move), and
this phase's own `252-04-PLAN.md` / `252-RESEARCH.md`.

⭐ **AND A FINDING THE PLAN DID NOT ASK FOR.** `SEED-284`'s own frontmatter line 10 already read
*"…the non-existent path `SEED-269-one-home-…`; it now cites THIS file."* **That claim was FALSE for
five days** — the seed asserted a repair to a file nobody had edited. It is true as of this commit.
A register that describes a fix it did not perform is the same class of defect as Task 1's report.

---

## Files the plan did not list that I edited, and why

| File | Why it is legitimate |
|---|---|
| `frontend/src/components/panel/PhaseCard.test.tsx` | ⛔ **the plan's `__tests__/PhaseCard.test.tsx` does not exist.** This is the real path of the same suite (see Task 3). Extended, never re-baselined — all 55 pre-existing cases are untouched and green. |
| `frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx` | In `files_modified` for Task 4. Task 2 ALSO had to add `useReconcilingForThread` to its mock factory: it mounts the REAL `TodosSection`, and the omission was **measured** throwing 3 cases at mount against a green base (the Phase 196 `@/lib/api` lesson). No assertion was weakened; the pinned count is unchanged at **4**. |

⭐ **`frontend/src/__tests__/providers/streamsProvider_250_liveness_window.test.tsx` was NOT
re-baselined, and the reason matters.** Its header says *"when someone fixes the missing trigger,
`expect(afterLoad).toBe(false)` goes red"*. It **stayed green**, because it samples
`streamingThreads ∪ loadingThreads` **directly from the store** across an explicit `loadMessages`
call — a sequence that is not the thread-open path. This fix does not close that store-level window;
it makes reconcile's own round-trip live, which is the window a person actually sees. The
characterization test still measures what it was written to measure, and no assertion of a defect
was flipped.

---

## Test results

### Plan-level verification

`GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/panel/ src/providers/ src/stores/ src/__tests__/providers/`

```
Test Files  3 failed | 41 passed (44)
     Tests  14 failed | 630 passed (644)
```

⛔ **All 14 failures are INHERITED, proven by SET diff rather than by count.** The same four files
were run at `53e2435b7` (my nine changed files checked out at base, then restored) and produced
`14 failed | 49 passed`; `diff` of the two sorted `FAIL` lists is **empty**.

**The 14, named** — three files, none of which this plan modifies:

| File | Cases | Signature |
|---|---|---|
| `src/__tests__/providers/streamsProvider.test.tsx` | 10 | `No "getSnapshot" export is defined on the "@/lib/api" mock` — the suite still mocks the pre-075 `getActiveRuns` chain; plus the `argsCodeText` reducer trio |
| `src/__tests__/providers/StreamsProvider.dedup.test.ts` | 2 | `expected 'preparing-0-0' to be 'preparing-0'`, `expected 'running' to be 'done'` |
| `src/__tests__/providers/streamsProvider_075_9_clientkey.test.tsx` | 1 | clientKey stamping across `tool_end` |

⚠ **Two of them NAME reconcile** (*"two concurrent reconcile() calls deduplicate via the in-flight
bit"*, *"setViewingThread on a non-null thread fires reconcile"*) and are therefore the ones a
reviewer will suspect. **They fail identically at the base commit, before any edit** — the mock
factory omits `getSnapshot`, so `reconcile` throws before reaching the lock. Recorded as *provably
unmodified*, ⛔ never as *fine*.

### Directory runs, all green

| Suite | Result |
|---|---|
| `src/components/panel/` | **17 files · 372 passed · 0 failed** |
| `+ ThinkingBlock.characterization.test.tsx` | **18 files · 405 passed · 0 failed** |
| `stepIdentityVocabulary` · `RunSpine` · `connectionMark` · `WorkflowRunPage` | **4 files · 293 passed · 0 failed** |

### Gates

| Gate | Result |
|---|---|
| `node scripts/check-hot-file-ledger.cjs 252` | ✅ **`ledger gate OK`** — 281 rows, 31 subject files, 13 watched, every one has a row |
| `node scripts/check-react-hooks-rules.cjs` | ✅ **`OK — no NEW violation`** (2 pre-existing `ToolCallPanel.tsx`) |
| `tsc -p tsconfig.app.json --noEmit` | ✅ **65**, strict subset of 67 |
| repo-wide count gate | ⛔ **NOT RUN** — out of scope per the brief; already RED at base with 2 `sketchComposition.test.tsx` failures (SEED-171, 4th reproduction, D-44a) |

---

## ⭐ FOR PLAN 05 — the count-gate pins to move

⛔ This plan did **not** edit `scripts/vitest-count-gate.cjs`. Every moved count is handed over
below **with per-case attribution**, measured per file with `GSD_VITEST_MAX_WORKERS=2`.

| File | Pin now | Measured at base | Measured after | Pin should be | Attribution |
|---|---|---|---|---|---|
| `TodosSection.test.tsx` | `145: 24` | **24** | **26** | **26** | **+2, both mine:** *"a reconciling thread still reads IN PROGRESS — the thread-open flash (BUG-260915-01)"* and *"a genuinely idle thread STILL reads NOT TICKED — the control that keeps HONEST-03"*. The hook-order fence was EXTENDED in place, so it adds **0** cases. |
| `PhaseCard.test.tsx` | `2464: 41` | **55** | **60** | **60** | **+5, all mine:** *THE LIE* · *THE CONTROL* · *THE DEFAULT* · *a TERMINAL phase status is untouched by `runLive={false}`* · *retrying is the OTHER live reading*. ⚠ **`55 − 41 = 14` units of PRE-EXISTING SLACK**, none of it this plan's — a deleted case would have kept the gate green. Plan 05 should re-baseline to the measured 60, not to `41 + 5`. |
| `WorkspacePanel.derived.test.tsx` | `152: 4` | **4** | **4** | **4 — no change** | Mock factory only; no case added or removed. |
| `PhaseTimeline.test.tsx` | `1152: 35` | **38** | **38** | **38** | ⚠ **+3 of PRE-EXISTING SLACK, none of it mine** — this plan adds no case to that file and its measured count is unchanged across the change. Surfaced because it sits in the same blast radius. |

---

## Deviations from Plan

### Auto-fixed (Rule 2 — missing critical functionality)

**1. `[Rule 2]` `WorkspacePanel.derived.test.tsx`'s mock factory needed the third selector at Task 2, not Task 4**
- **Found during:** Task 2 verification
- **Issue:** the suite mounts the real `TodosSection`; the omitted export threw 3 cases at mount
- **Fix:** added `useReconcilingForThread` with a rest parameter and a defaulting-false stub
- **Commit:** `28318416c`

**2. `[Rule 2]` three direct `phase.status === "retrying"` reads in `PhaseCard.tsx`**
- **Found during:** Task 3, while listing the `isRunning` consumers the plan asked me to confirm
- **Issue:** they would have rendered the interrupted word beside an active violet frame and an
  `Attempt N` pill
- **Fix:** one `isRetrying` derivation, three call sites, one new test case pinning both directions
- **Commit:** `448d03dbc`

### Plan claims REFUTED by the code (the code wins)

| Plan said | Measured at `53e2435b7` |
|---|---|
| `grep -c "ForThread(threadId) \|\|" TodosSection.tsx` must be **0** | **1 at base and 1 now** — the component's own forbidding comment. Unsatisfiable as written; the `stripComments` source fence is the real guard. |
| `STATUS_META` has **7** keys | **9** — `…, recorded-not-sent, unknown, cancelled`. Unchanged at 9 after. |
| the suite is at `__tests__/PhaseCard.test.tsx` | it is at `src/components/panel/PhaseCard.test.tsx`; the count gate's own comments say so. Extended, not duplicated. |
| `loadMessages` add at `:3275-3277`, clear at `:3381-3390` | add at **`:3277`**, clear at **`:3386-3391`**. Substance confirmed. |
| `git diff frontend/src/components/panel/MessageList.tsx` | **that file does not exist**; `components/chat/MessageList.tsx` does, and its diff is empty. |
| `.planning/v4.2-MILESTONE-AUDIT.md` (implied citable) | **does not exist in this worktree** — untracked. Citation re-pointed to `252-RESEARCH.md §5.1`. |

### Environment

**`[base-sha]` the worktree arrived on `84e3b020f`** (`Merge develop into master — release candidate
v4.1`), the stale default branch, and was `git reset --hard 53e2435b7` before any file was read.
The sixth consecutive executor to hit this.

---

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced. The new
store slice has a real writer (`reconcile`), a real reader (`useReconcilingForThread`) and a real
consumer (`TodosSection`), all driven RED first.

## Threat Flags

None. Every change is client-side presentation over data the viewer is already authorised to see;
no endpoint, auth path, file access or schema was touched. The two integrity obligations in the
plan's threat model (TM-252-17 stuck signal, TM-252-19 false `aria-busy`) are discharged by the
enumerated single-clear-site and by the idle/default control cases respectively.

## Self-Check: PASSED

- `.planning/phases/252-close-the-v42-audit-gaps/252-04-SUMMARY.md` — FOUND
- `1e42d0a8c` · `28318416c` · `448d03dbc` · `4e982fe7b` — all FOUND in `git log --oneline 53e2435b7..HEAD`
- `git status --short` — clean
