---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
plan: 03
subsystem: frontend-chat
tags: [cadence, scroll, coalescing, red-drive, gate-knobs, ledger, bug-correction]
requires:
  - "243-02 (ThinkingBlock mounted from MessageItem — the DOM this plan's scroll fences render)"
provides:
  - "frontend/src/lib/throttle.ts — makeAccumulatingCoalescer: leading-edge, argument-free, lossless"
  - "CHAT-02 closed: 60 deltas make 12 setMessages calls, not 61"
  - "CHAT-03 closed: a sub-threshold nudge up can no longer be re-armed by a scroll nobody produced"
  - "MessageList.scroll.test.tsx — the scroll effect's FIRST behavioural coverage, with a real spy"
  - "useFollowScroll.ts and lib/throttle.ts have ledger rows for the first time in their lives"
affects:
  - "243-04 (the V1 restyle) — the fold now repaints on a 60 ms cadence, not per token"
  - "243-05 (the answer out of the narration fold) — MessageItem.tsx:425 untouched here"
tech-stack:
  added: []
  patterns:
    - "useLiveValidation.ts:11-22 — reuse the SHAPE, not the function; name the original and state both differences"
    - "A generic wrapper stated in the NEGATIVE, so the 48th callback cannot forget the rule"
    - "Set-diff triage against the base commit before attributing any red"
key-files:
  created:
    - frontend/src/__tests__/components/chat/MessageList.scroll.test.tsx
    - frontend/src/__tests__/providers/streamsProvider_243_cadence.test.tsx
  modified:
    - frontend/src/lib/throttle.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/hooks/useFollowScroll.ts
    - frontend/src/__tests__/hooks/useFollowScroll.test.ts
    - frontend/src/__tests__/lib/throttle.test.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260823-01-tool-call-smooth-scroll-rearms-the-pin.md
decisions:
  - "D-243-05 outcome 3: a residual reproduced at HEAD and it is NOT the one BUG-260823-01 names"
  - "The discharging commit is a QUICK TASK, not a Phase 228 commit — measured 7h48m before 228 was scoped"
  - "The coalescing window is 60 ms with a leading edge; worst-case first paint 0 ms"
  - "MessageList.tsx was NOT modified — the plan named it and it needed no edit; said rather than absorbed"
  - "BUG-260823-01 stays `folded`, not `closed`: every fence here is a synthetic WheelEvent, and this file's own history records two fixes that passed those and failed a real mouse"
metrics:
  duration: ~2h
  completed: 2026-09-11
---

# Phase 243 Plan 03: The Cadence and the Scroll — Summary

**The RED drive's verdict, first, in one sentence: D-243-05's outcome 3 — a residual DID reproduce
at HEAD, and it is not the defect `BUG-260823-01` describes.** That report's named cause was deleted
by `64357e979` on 2026-09-04; what still reproduced is narrower, has a different mechanism, and was
driven RED at two levels before a single production line was written.

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `ac599e645` | `test(243-03): drive the scroll residual at HEAD, not at the bug report` |
| 2 | `bfdf899b1` | `feat(243-03): coalesce the delta path producer-side, losing no token` |
| 3 | `8d7dfab43` | `fix(243-03): a gesture that says "leave me here" can no longer re-arm the pin` |

Base: `develop` at `b39ad2ade`, **main working tree, no worktree**. `git status --porcelain --
frontend scripts docs CLAUDE.md .planning/reported-bugs` was **EMPTY** before the first edit and is
**EMPTY** at close. No foreign frontend/scripts change appeared at any point (the sibling Phase 242
session is backend/docs).

---

## 1. Task 1 — the RED drive, and the commit that discharged the original defect

### The two commits that touch `useFollowScroll.ts`, established by measurement

`git log --oneline -S "hardProgrammaticUntilRef" -- frontend/src/hooks/useFollowScroll.ts` returns
**exactly one** commit; the file has three in its whole life.

| sha | date | subject | vs. `BUG-260823-01`'s filing date `2026-08-23` |
|---|---|---|---|
| `53b6128b6` | 2026-06-05 | `feat(095-04): useFollowScroll follow/release/re-arm/jump state machine (D-03)` | 79 days **before** |
| **`64357e979`** | **2026-09-04** | **`fix(chat): stop the streaming run dragging a scrolled-away reader (BUG-260904-02)`** | **12 days AFTER** |
| `8d7dfab43` | 2026-09-11 | this plan | 19 days after |

**`64357e979` is the discharging commit** — it deleted every line the report blames, and the report
stayed `status: open` for the nineteen days in between.

### ⚠ Deviation reported, not absorbed: it is NOT a Phase 228 commit

`243-CONTEXT.md` D-243-05 and the bug file's first correction both attribute it to *"Phase 228"*.
**Measured:** `64357e979` is timestamped `2026-09-04 11:46`; Phase 228's first commit
(`7a5207dfd docs(228): capture phase context`) is `19:34` the **same day** — **7 h 48 m later**. It
is an untagged `fix(chat)` **quick task raised during Phase 227's review**, which
`BUG-260904-02`'s own frontmatter confirms (`verified_closed_by: "quick task 260904"`). The
substance of D-243-05 is untouched; the attribution is corrected in the register that owns it, and
this is the kind of thing that explains *how* a substantial rewrite of a hot file happens with no
phase to hang an audit on.

### (a) The hook — the candidate residual, RED, quoted verbatim

```
 × ⭐ A — an UPWARD gesture, then a near-bottom scroll 1000 ms later: the pin must NOT re-arm
AssertionError: expected true to be false // Object.is equality
- Expected   false
+ Received   true
   useFollowScroll.test.ts:330:37
 Tests  1 failed | 12 passed (13)
```

### (b) The mirror cases — GREEN, and they are what constrain the fix

| Case | Result at HEAD, before any fix |
|---|---|
| **B** — a downward flick that COASTS to the bottom inside the gesture window **MUST** re-arm | **GREEN** |
| **C** — the tail of our OWN smooth scroll still cannot re-arm inside the 900 ms hard clock (`BUG-260904-02`'s fence, re-driven) | **GREEN** |

⭐ **The pair is the design.** A "fix" that passed A by refusing every late re-arm would break B,
which `useFollowScroll.test.ts:191-227`'s own ⭐ comment records as the whole point.

### (c) The list — RED through the real component, on a long thread

`MessageList.scroll.test.tsx` §3 also failed:

```
 × §3 — ⭐ THE RESIDUAL (D-243-05): a small nudge UP, then a scroll the reader did not cause, 1000 ms later
Error: expect(received).toBeInTheDocument()
received value must be an HTMLElement or an SVGElement. Received has value: null
   MessageList.scroll.test.tsx:243:55
```

The `null` is the **Jump-to-live chip**: it was present right after the nudge and gone after the
unattributed scroll — i.e. the pin re-armed under a reader who had just moved away.

**The thread is `LONG_THREAD_SIZE = 54` messages** (the constant is asserted `>= 50` by §0, so the
fixture cannot silently shrink).

### The spy, and the assertions that prove it is a spy

`MessageList.test.tsx:61-65` installs `scrollIntoView` as a **no-op tree-wide**; this file installs
a counter:

```ts
scrollIntoViewSpy = vi.fn()
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: scrollIntoViewSpy, writable: true, configurable: true,
})
```

Both a **count** and the **argument** are asserted:

```ts
expect(scrollIntoViewSpy).toHaveBeenCalledTimes(8)
for (const call of scrollIntoViewSpy.mock.calls) expect(call[0]).toEqual({ behavior: "instant" })
expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" })   // §2, the :171 branch
expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth" })                      // §6, settled + new message
expect(scrollIntoViewSpy).toHaveBeenCalledTimes(0)                                          // §4, after a decisive scroll-away
```

### No production edit in Task 1

```
$ git diff --stat -- frontend/src/hooks frontend/src/components frontend/src/providers
(empty)
```

### ⚠ Two fixture corrections, recorded because both were *product facts*, not typos

1. `toolCalls` → **`tool_calls`**. `MessageItem.tsx` gates `RunCard` on `message.tool_calls`; the
   camelCase field does not exist on `Message`.
2. The `preparing` fixture needed **`runStatus: "streaming"`**. `RunCard.tsx:70,93` mounts its
   `ToolCallPanel` body only when `isStreamingNow` — a terminal run with tools mounts **collapsed**,
   so `[data-tool-status="preparing"]` is absent from the DOM. A `preparing` tool can only exist on
   a live run anyway, so this is the faithful fixture rather than a prop added to make a selector
   resolve.

---

## 2. Task 2 — the coalescing, the window, and the trap that was NOT the one the plan predicted

### The RED, at exactly 1:1

```
 × §1 — 60 reasoning deltas spread over ~600 ms produce at most 1 + ceil(600/60) = 11 setMessages calls, not 60
AssertionError: expected 61 to be less than or equal to 12
```

**61 = 60 deltas × 1 `setMessages` each, plus `onDone`'s own.** After the change: **12**, re-measured
by temporarily flipping the bound to `0` and reading the received value
(`expected 12 to be less than or equal to 0`).

### The chosen window: **60 ms**, and the numbers it was chosen against

- **Measured premise, not assumed:** the backend emits **one `delta` SSE event per provider chunk
  and does not batch** — `grep` over `backend/app/services/agent_loop.py` shows nine
  `_emit(redis, run_id, 'delta', …)` sites and **zero** occurrences of `batch|coalesc|throttl`. The
  client therefore sees the raw provider token cadence.
- **Delta rate:** 30–100 tok/s ⇒ a delta every **10–33 ms**.
- **60 ms** is ~3.6 frames at 60 Hz — text still flows visibly, while the repaint rate stops tracking
  the token rate (a **3–6× reduction** across that band; **5.1×** on the fence's fixture).
- ⛔ Deliberately **not** the cache writer's 500 ms: half a second of nothing before a reply starts is
  a pause the reader can feel.
- **Worst-case first-paint delay: 0 ms.** The coalescer fires on the **leading edge**. The worst case
  for any *later* delta is **60 ms**. §6 fences this with no timer advanced at all.

The number is a named export, `DELTA_COALESCE_MS`, and §8 pins it — because §1's case *name* does
arithmetic on it, and a retune without re-deriving the name would leave a comment that lies.

### How token loss is prevented, and how it was proved

⛔ **Structurally, not by care.** `makeAccumulatingCoalescer` **takes no arguments at all** — the
buffer is the caller's closure and `apply` drains it — so `makeThrottle`'s `lastArgs = args`
channel, the thing that would silently drop tokens, **does not exist on this primitive**.

Proof, from the losslessness fence with individually distinguishable deltas
(`«r0»`, `«r1.»`, `«r2..»`, … variable-length so a dropped one cannot be absorbed):

```ts
expect(current().reasoningContent).toBe(deltas.join(""))
expect(current().reasoningContent!.length).toBe(deltas.reduce((n, d) => n + d.length, 0))
```

**Reconstructed string length == sum of the 60 delta lengths, exactly** (60 deltas averaging 7 chars;
the assertion compares the two computed totals rather than a hard-coded number, so the fixture can
grow without the fence rotting). §3 additionally asserts no cross-contamination
(`content` never contains `«r`, `reasoningContent` never contains `«c`), §4/§5 that both terminal
edges leave nothing buffered with **no timer advance**, and §9 that two runs accumulate
independently.

### `makeThrottle` is untouched — quoted

```
$ git diff b39ad2ade -- frontend/src/lib/throttle.ts | grep -E "^-" | grep -v "^---"
(no output)
```

**Zero deletions.** The change is purely additive; `makeThrottle`'s four existing cases pass
unchanged, and they are now *gated* for the first time (see §4).

### The update shape did not move

```
prev.map at base b39ad2ade : 44
prev.map now                : 44
```

### ⚠⚠ THE TRAP THAT ACTUALLY BIT WAS NOT THE ONE THE PLAN NAMED — and it was found by a driven RED

The plan named two traps (last-write-wins; no leading edge) and both were handled by construction.
**A third, unnamed one broke two shipped tests**, and it was caught only because the failing set was
diffed against the base commit instead of being read:

| | provider suites, failing | set |
|---|---|---|
| base `b39ad2ade` | **13** | inherited |
| HEAD, first attempt | **15** | the 13 **+ 2** |

The two extras were `StreamsProvider.anthropic-ordering.test.ts` — B-260519-01, Anthropic's
**interleaved text / tool_use ordering**:

```
AssertionError: expected 'text1text2' to be 'text1text2text3'
AssertionError: expected 'hello world' to be 'hello worlddone'
```

With the deltas coalesced, `text3` was still in the buffer when the tool block that **follows** it
was written — so the transcript would show a tool card above text the reader had not been shown, and
a run ending on a tool event would drop its tail entirely.

**The fix: every STRUCTURAL callback drains the buffer before its body runs.** Implemented as **one
generic wrapper over all 47 callbacks**, stated in the negative:

```ts
const FILLS_THE_BUFFER = new Set(["onDelta", "onReasoningDelta", "flushDeltas"])
```

⚠ **Wrapped generically rather than callback-by-callback, and that is a decision.** An explicit
flush in each of 47 is both invasive and forgettable, and the 48th — added by a phase that never
read the comment — would silently re-open the defect.

**After the fix the failing set is byte-identical to the base set: 13, the same 13.**

### The three call sites — named, and what each got

All three **replace** `callbacks.onTerminal` with a wrapper that calls the original **LAST**
(`:1642`, `:2090`, `:2564`), and two of those bodies reconcile the message from the server — so a
flush landing afterwards would append the buffered tail onto **replaced** content.

| site (post-patch line) | path | change |
|---|---|---|
| `:1618` | producer re-subscribe | dropped the `: StreamCallbacks` annotation; `callbacks.flushDeltas()` as the wrapper's first statement |
| `:1958` | reconcile / re-attach | same two lines — this wrapper reads `currentToolCalls` from the store at its top |
| `:2404` | `sendMessage` | same two lines — this wrapper also reconciles `answer.content` further down |

The annotation had to go at each site because it would widen the factory's return type back to
`StreamCallbacks` and hide the additive `flushDeltas` member. Nothing else at any of the three
changed.

### `isPlanning` — fenced, and it needed a second attempt

§7 went RED on the first implementation (`expected true to be false`): flushing on the first content
delta did nothing when no window was open, because `flush()` had nothing pending. The shipped form
calls the coalescer **first** and then flushes — if no window was open the call already fired on the
leading edge and the flush is a no-op; if reasoning had opened one, the flush drains it now. Cost:
**at most one extra `setMessages` per run, exactly once.**

---

## 3. Task 3 — CHAT-03, and the D-243-04 measurement

### ⭐ The `scrollIntoView` counts, before and after the cadence change

`MessageList.scroll.test.tsx` §7 is the only case that drives the **real** `makeStreamCallbacks` into
a mounted `MessageList` — so it counts scrolls per **delta**, not per render. 60 deltas, identical
fixture, three runs:

| provider | `useFollowScroll.ts` | `scrollIntoView` calls |
|---|---|---|
| base `b39ad2ade` | base | **61** |
| base `b39ad2ade` | **this plan's fixed hook** | **61** |
| **coalesced** | this plan's fixed hook | **13** |

**The count dropped from 61 to 13 with `useFollowScroll.ts` held constant across both runs.** ⭐ That
is D-243-04 — *CHAT-02 and CHAT-03 are one mechanism* — as a measurement instead of a sentence: the
producer-side cadence change reduced the scroll rate by 4.7× **without one line changing in the
scroll hook**, because `MessageList.tsx:141-176` has `messages` in its dep array.

The middle row is the negative control: it also shows the hook fix alone does **not** change the
count (there is no gesture in §7), so the two changes are cleanly separable and neither is being
credited with the other's effect.

### The fix — one ref and one clause, at the line D-243-05 predicted

`useFollowScroll.ts:196-201`. A re-arm now requires **three** things, not two:

1. our own animation has finished (the uncancellable clock);
2. the user was at the controls recently; and
3. ⚠ **the last thing they did was not to leave** (`lastGestureIntentRef.current !== "up"`).

(3) is the file's own stated principle — *a gesture buys the right to LET GO, never the right to TAKE
HOLD again* — carried one step further, since an upward gesture is the reader saying *"leave me
here"* out loud.

⛔ **It is a DIRECTION, not a ban**, and the mirror is what makes that necessary: a deliberate flick
back **down** must still re-arm, and touch drags / scrollbar grabs (whose direction the event does
not carry) arrive as `"unknown"` and keep falling through to the geometry. **No reader is stranded.**
Both halves are fenced beside the defect case in both suites, and the four pre-existing re-arm cases
in `useFollowScroll.test.ts` and `MessageList.test.tsx` pass unchanged.

⛔ Neither `PROGRAMMATIC_SCROLL_SETTLE_MS` nor `USER_GESTURE_WINDOW_MS` was touched.

⚠ **And the cadence change WIDENS the vulnerable window rather than narrowing it** — the effect now
refreshes the hard clock up to 60 ms less often, so the gap can reach ~660 ms rather than ~600 ms.
The fix is needed *more* after Task 2, not less. Recorded because the opposite would have been the
comfortable assumption.

### ⚠ Deviation: `MessageList.tsx` was NOT modified

The plan lists it in `files_modified` and it is the line CHAT-02 and CHAT-03 share — but the cadence
fix landed **upstream** in the producer and the scroll fix landed **downstream** in the hook, so the
shared line needed no edit at all. `git diff b39ad2ade HEAD -- frontend/src/components/chat/MessageList.tsx`
is **empty**, which also re-proves D-17 (`RunStatusStrip`'s block is byte-unchanged) for free. Said
plainly rather than absorbed, and rather than manufacturing a change to match the plan.

---

## 4. The gate knobs — three suites, two knobs each, by hand

| suite | status | `TARGETS` | `BASELINE` | count, read from the gate's own column |
|---|---|---|---|---|
| `streamsProvider_243_cadence.test.tsx` | new | ✅ | ✅ | `— 9 new` |
| `MessageList.scroll.test.tsx` | new | ✅ | ✅ | `— 8 new` |
| `throttle.test.ts` | **pre-existing, entirely ungated since 068.5** | ✅ | ✅ | `— 11 new` |

```
$ grep -c "streamsProvider_243_cadence.test.tsx" scripts/vitest-count-gate.cjs   → 2
$ grep -c "MessageList.scroll.test.tsx"          scripts/vitest-count-gate.cjs   → 2
$ grep -c "throttle.test.ts"                     scripts/vitest-count-gate.cjs   → 2
```

⚠ **None of the three was reachable by a directory rule.** `TARGETS` has exactly two bare-directory
entries — `src/landing` and `src/components/workflows`; `src/__tests__` was never adopted and every
`src/components/chat` occurrence is file-level or a comment. `src/__tests__/providers` and
`src/__tests__/lib` were in **neither** knob.

⚠ **`throttle.test.ts` had guarded nothing for its entire life** — `grep -n throttle scripts/vitest-count-gate.cjs`
returned nothing before this plan. It is **adopted here, not created here**, and it is now the fence
on two primitives with opposite contracts.

⚠ **The ten other `StreamsProvider` suites remain UNGATED, and they are NAMED rather than left
unlooked-for** (in the `TARGETS` comment): adopting them is out of scope because **13 of their cases
are red at this phase's base commit**, so adopting them would turn the shared gate red for a reason
no plan here owns. An unadopted suite someone wrote down is a different thing from one nobody
noticed.

### The gate

```
  total                                      7221    7994    +773
  total 7994  ·  failed 0  ·  pinned total 7221
count gate OK — 253/253 pinned files present, no per-file decrease, 0 failing.
```

**The failing set is the EMPTY subset** of `243-BASELINE.md`'s two inherited `sketchComposition`
cases — which is exactly what that file's corrected criterion permits (243-01 measured `failed 0`
twice for the same reason). ⚠ One green sample of a known flaky suite is not a fix; the inherited
pair stands.

⚠ **An intermediate run mid-plan read `failed 1`, and the single failure was my own Task-1 RED case**
(`useFollowScroll.test.ts :: ⭐ A`), identified from the gate's **own persisted JSON** before
re-running anything. The worker cap was **not** touched at any point and held at `2` throughout.

### Typecheck — a set diff, not a count

`npx tsc -p tsconfig.app.json --noEmit`: **67 errors at HEAD**, and `comm -13` against the base set
is **empty**. No new error introduced. (⚠ `npx tsc --noEmit` in `frontend/` checks **zero** files —
`tsconfig.json` is solution-style.)

### In-scope suites, all green and all named

```
useFollowScroll.test.ts · MessageList.test.tsx · MessageList.scroll.test.tsx ·
MessageList.dedup.test.tsx · MessageList.runline.baseline.test.tsx ·
streamsProvider_243_cadence.test.tsx · throttle.test.ts · ThinkingBlock.characterization.test.tsx
→ Test Files 8 passed (8) · Tests 109 passed (109)
```

---

## 5. The four ledger updates

All triples **re-derived** with CLAUDE.md's recipe at the closing commit, six-digit dated
quick-task buckets subtracted and **named**:

| File | ledger read | **measured** | six-digit buckets subtracted | G-5 |
|---|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | `85 / 34 / 4144` | **`89 / 36 / 4325`** | `260529` | **FIRES** |
| `frontend/src/components/chat/MessageList.tsx` | `19 / 8 / 267` | **`20 / 8 / 292`** | none | **FIRES** |
| `frontend/src/hooks/useFollowScroll.ts` | ⛔ **NO ROW** | **`3 / 2 / 265`** | none | does not fire |
| `frontend/src/lib/throttle.ts` | ⛔ **NO ROW** | **`2 / 2 / 108`** | none | does not fire |

- **`StreamsProvider.tsx`** — new triple recorded beside the old; verdict *honoured by construction*,
  **earned by a measurement**: `useState[(<]` **0 → 0**, `useEffect(` **8 → 8**, and what landed is
  closure state inside an already-existing factory beside the shipped `let currentIteration = 0` —
  **not a sixth concern** beside the five its section names.
- **`MessageList.tsx`** — new triple beside the old; the verdict states the effect **did not change**
  and that D-17's `RunStatusStrip` block is byte-unchanged (trivially: the whole file is).
- **`useFollowScroll.ts`** — ⛔ **NEW row and NEW section.** It does not fire at 2 phases; the row
  exists because a file missing from the scan list is invisible to its own guardrail **at any commit
  count, forever** — and this is the file `BUG-260823-01` is about, so G-5 has been structurally
  absent across both attempts to fix the chat surface's most-felt defect. The section records **the
  two clocks and why there are two, verbatim from the file's own comments**, so the next reader does
  not collapse them.
- **`lib/throttle.ts`** — ⛔ **NEW row and NEW section.** The invariant recorded: `makeThrottle` is
  trailing-only and last-write-wins **on purpose** for the cache writer, and the new export exists
  because the delta path needs the opposite **on both axes**. A future editor who "unifies" them
  breaks one of the two call sites **silently**.

CLAUDE.md's two G-5-FIRING rows updated in the **same commit**; verdict in the cell (both **≤ 200
chars**), reasons in the section.

```
$ node scripts/check-hot-file-ledger.cjs 243   → ledger gate OK — every watched file has a row.   (exit 0)
$ node scripts/check-claude-md-size.cjs        → OK, 87,945 chars, 58.6% of limit                  (exit 0)
```

---

## 6. The bug-report diff

```
$ git diff --numstat -- .planning/reported-bugs/BUG-260823-01-…md
80      2

$ git diff -- …  | grep -E "^-" | grep -v "^---"
-verified_closed_by: null
-re_open_trigger: null
```

**Exactly two deleted lines, both frontmatter nulls.** The original root-cause text and the first
correction are preserved **verbatim**; the second correction is appended **beside** them.

- `verified_closed_by` now carries the reason it is **not** set.
- `re_open_trigger` is concrete: *"A reader is dragged to the live edge during a run on a real
  mouse/trackpad after 243-03 ships, OR the 243 UAT row for a long streaming thread is not driven
  before the phase closes."*

### ⚠ Why `folded` and not `closed` — a judgement call, made against this file's own history

`64357e979`'s commit message says it outright:

> *"Attempts 1 and 2 measured CLEAN on a synthetic WheelEvent and were still broken with a real
> mouse. A synthetic input event is not evidence about an input-driven bug."*

Every fence in this plan is a synthetic `WheelEvent` in jsdom. It is **strictly more** than this
report ever had — the effect had **zero** behavioural coverage before today — but it is not a real
wheel, so the status stays `folded`.

---

## 7. Mechanical vs judgement (D-243-12 — solo running, no independent reviewer)

**Mechanical — a driven fence, a measured count, a set diff. Not weakened by solo running:**

- the RED/GREEN status of every case, quoted verbatim from the runs;
- `61 → 12` `setMessages` and `61 → 13` `scrollIntoView`, each re-measured by flipping a bound to `0`
  and reading the received value;
- the provider failing-set diff (13 base / 15 first attempt / 13 after the fix), from the gate's own
  JSON;
- `prev.map` 44 → 44; zero deletions in `throttle.ts`; `MessageList.tsx` diff empty;
- the typecheck set diff (empty) and the count gate (`failed 0`, `253/253`);
- the four re-derived ledger triples and both gate exits;
- the commit dates establishing `64357e979` as a quick task rather than a Phase 228 commit.

**Judgement — stated as judgement:**

- **60 ms** is a reasoned choice against a measured delta-rate *band*, not an instrumented
  measurement of this app's actual token cadence. It is defensible and it is pinned, but a real
  streaming session could argue for 40 or 80.
- **That the residual is a real user-facing defect.** The mechanism is proven; that a non-user scroll
  event near the bottom actually occurs in Chrome during streaming (scroll anchoring, focus moves,
  late layout shifts) is **reasoned, not observed**. The fence dispatches such an event by
  construction, which is the honest framing, and §3's comment says so.
- **Refusing to re-arm after an `"up"` gesture is the right rule.** The alternative reading — that a
  small nudge up should still be treated as "following along" — is coherent; this plan chose the
  reader's stated intent, consistent with the file's own principle.
- **Wrapping all 47 callbacks generically** rather than flushing in each. Safer by construction,
  slightly less surgical than D-243-08's "named lines" framing.
- **`folded`, not `closed`.**

---

## 8. D-243-09 check — is `SEED-049` owed?

⚠ **Criterion 3 (*"the scroll survives a tool call"*) is now covered by a vitest fence that can
actually see the effect** — which it was not before — but **not honestly CLOSED by it**. The
distance between a synthetic `WheelEvent` and a real wheel is exactly the distance that defeated two
prior fixes on this file. **The phase should record a driven-browser UAT row for a long streaming
thread**, and if that cannot be run, `SEED-049`'s re-open trigger has fired on this criterion.
`BUG-260823-01`'s `re_open_trigger` now names the same condition, so the two registers agree.

---

## Self-Check: PASSED

Files created — verified present:
- `frontend/src/__tests__/components/chat/MessageList.scroll.test.tsx` — FOUND
- `frontend/src/__tests__/providers/streamsProvider_243_cadence.test.tsx` — FOUND
- `.planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/243-03-SUMMARY.md` — FOUND

Commits — verified in `git log`:
- `ac599e645` — FOUND · `bfdf899b1` — FOUND · `8d7dfab43` — FOUND

Gates — re-run at close: `check-hot-file-ledger.cjs 243` exit 0 · `check-claude-md-size.cjs` exit 0 ·
`vitest-count-gate.cjs` `count gate OK` · `tsc -p tsconfig.app.json --noEmit` 67 errors, set diff
empty.
