---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
reviewed: 2026-09-11T07:05:00Z
depth: deep
diff_range: 3412bb6ab..b5560a62d
scope: frontend only
reviewer: Claude (gsd-code-reviewer) — solo, standing in for the absent §6.3 independent reviewer (OV-SOLO-01)
files_reviewed: 7
files_reviewed_list:
  - frontend/src/components/chat/ThinkingBlock.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/hooks/useFollowScroll.ts
  - frontend/src/lib/throttle.ts
  - frontend/src/components/chat/MessageList.tsx
findings:
  critical: 0
  high: 2
  medium: 4
  low: 7
  total: 13
status: issues_found
---

# Phase 243 — Code Review Report

**Reviewed:** 2026-09-11
**Depth:** deep (cross-file; trace + drive)
**Range:** `3412bb6ab..b5560a62d`, frontend only
**Status:** issues_found — **2 HIGH, 4 MEDIUM, 7 LOW. No CRITICAL.**

## How this review was conducted

Everything reported below was **traced through the code and, where it is a behavioural
claim, DRIVEN** — three throwaway vitest files were written against the real
`makeStreamCallbacks` / `useFollowScroll` exports, run, and deleted (tree verified clean
afterwards). Where I could not confirm a suspicion I have said so and labelled it
unconfirmed. Nothing here is inferred from a SUMMARY.

Measurements taken during the review:

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | **67 errors** — exactly the documented base figure; **0 in any file this phase touched** |
| The phase's 7 new/edited suites | **7 files / 100 tests, all green** |
| `src/components/chat` + `src/providers` + `src/__tests__/providers` + `src/__tests__/components/chat` | **13 failed / 626 passed** |
| The same 4 paths at the **base commit** `3412bb6ab` | **the identical 13 failures** → **no regression introduced** (see MD-2) |
| `check-hot-file-ledger.cjs 243` | `ledger gate OK` — 8 watched files, all have rows |
| `check-claude-md-size.cjs` | OK — 88,891 chars |

---

## CRITICAL

**None.** I looked specifically for the things that would earn this tier and did not find
them. Stated positively, because "no critical issues" is only worth reading if it says what
was checked:

- **No token loss on any exit path.** Driven, not reasoned. `makeAccumulatingCoalescer`
  (`lib/throttle.ts:78-113`) re-arms its own window after every fire and only stops on a tick
  with nothing pending, so the buffer **self-drains within ≤ 2 × 60 ms of the last delta even
  when no terminal callback ever arrives**. Driven cases that all pass: 10 deltas then an
  abort with no `onDone` and no `onTerminal` → full text lands; a delta arriving *after*
  `onDone` → not lost; every structural callback drains first. The buffer carries **no
  arguments**, so `makeThrottle`'s last-write-wins hazard (`throttle.ts:19,28`) genuinely
  cannot apply here.
- **No ordering hole in the generic wrapper.** I enumerated the object literal's keys:
  47 function-valued callbacks, of which exactly three are excluded by
  `FILLS_THE_BUFFER` (`StreamsProvider.tsx:1296`) and every other one is wrapped with a
  leading `coalesceDeltas.flush()`. Driven: `delta("text1") → delta("text2") → onToolStart →
  delta("text3")` shows `"text1text2"` already committed **at tool time** and
  `"text1text2text3"` at the end. The only post-construction reassignments are
  `callbacks.onTerminal` (three sites, each flushing at the **top** of its wrapper, before the
  bodies that reconcile) and `callbacks.onCursor` (three sites; it mutates no message
  structure).
- **No cross-message or cross-thread span leak.** `reasoningStartMs` / `pendingReasoningMs`
  are per-invocation closure state and every write targets `m.id === assistantId`. Driven:
  two concurrent harnesses accumulate and stamp independently. The producer-resubscribe path
  (`:1706`) passes the **run id** as `assistantId`, so it matches no row and stamps nothing.
- **No negative or absurd duration from the clock.** Both ends are `Date.now()` in one
  closure; `thoughtForLabel` (`ThinkingBlock.tsx:149-155`) floors at 1 s. (A duration *is*
  wrong here, but for a different reason — see HI-1.)
- **No XSS introduced.** `ThinkingBlock` renders reasoning as React text children only and
  §12 of the characterization suite fences the file's **source** for
  `dangerouslySetInnerHTML` — I read the fence; it is real and it would fire. The live
  answer path now reaches `MarkdownRenderer` / `CitedMarkdown`, both of which run
  `DOMPurify.sanitize(marked.parse(...))`, and `CitedMarkdown`'s marker `<sup>` nodes are
  `document.createElement`-owned, so no model text becomes an attribute.
- **`jumpToLive` still works.** `useFollowScroll.ts:243-249` sets the pin directly and never
  consults the new intent ref.

---

## HIGH

### HI-1 — `reasoningMs` bills tool-execution wall time as thinking time. **Driven: 40,100 ms reported for 100 ms of reasoning.** This is the exact defect `D-243-13` was written to forbid.

**Files:** `frontend/src/providers/StreamsProvider.tsx:488-491` (`closeReasoningSpan`),
`:522-537` (`onDelta`), `:547-566` (`onDone`) — surfaced at
`frontend/src/components/chat/ThinkingBlock.tsx:149-155`.

**Issue.** The span closes on exactly two events: the **first content delta**, or `onDone`.
Nothing closes it at a tool boundary. `backend/app/services/agent_loop.py:2078-2100` emits
`reasoning_delta` and `tool_preparing` from the same `elif` chain with **no `delta` required
between them** — which is the ordinary shape for a reasoning model that emits a thinking
block and then a `tool_use` block with no preamble text (DeepSeek reasoner, and the
`<think>`-stripped Kimi / MiniMax / GLM path the callback comment itself names). On that
shape the first content delta does not arrive until **after the tool has executed**, so the
span swallows the whole tool call.

`243-CONTEXT.md` D-243-13 rejects precisely this:

> *`RunCard`'s elapsed machinery measures **the whole run** … which **includes every tool
> call**. Labelling that "thought for" is wrong by construction on any tool-bearing turn,
> which is the majority shape.*

The implementation reproduces that wrongness through a different route, and the label is a
**clock reading**, so it passes every honesty fence the phase wrote.

**Failure scenario (driven, not reasoned).** Harness over the real `makeStreamCallbacks`:

```
onReasoningDelta("Let me check the docs.")   // t=0
+100 ms
onReasoningDelta(" I will search.")
onToolPreparing("search_documents", 0)
onToolStart("search_documents", {query:"x"}) // no preamble text — the common Anthropic/
                                             // DeepSeek extended-thinking shape
+40_000 ms                                   // the tool runs
onToolEnd(...) ; onIterationStart(2)
onDelta("Here is the answer.")               // first CONTENT delta — span closes HERE
onDone()
```

```
MEASURED reasoningMs = 40100
AssertionError: expected 40100 to be less than 5000
```

The fold then reads **"Thought for 40 seconds"** for **0.1 s** of thinking. That is
`BUG-260606-02`'s `1440m` lie in a new unit — the very bug D-243-13 cites as the reason the
honesty rule exists.

**Why the net did not catch it.** `streamsProvider_243_cadence.test.tsx` §10 has six span
cases and **not one of them puts a tool callback between the reasoning and the content**.
§10a is `reasoning → content`; §10b is `reasoning → done`; §10d is `content → later
reasoning`. The whole of §14 in the characterization suite asserts how a *given* `reasoningMs`
**renders** — it says nothing about whether the number is right. The label is fenced; the
measurement is not.

**Fix.** Measure the reasoning stream itself instead of the gap to the answer — this needs no
new callback and cannot be defeated by an interleaving:

```ts
let reasoningStartMs: number | null = null
let reasoningLastMs = 0            // ← NEW

onReasoningDelta: (delta) => {
  const now = Date.now()
  if (reasoningStartMs === null) reasoningStartMs = now
  reasoningLastMs = now            // ← NEW
  pendingReasoning += delta
  coalesceDeltas()
},

const closeReasoningSpan = () => {
  if (reasoningStartMs === null || reasoningSpanSettled) return
  reasoningSpanSettled = true
  pendingReasoningMs = reasoningLastMs - reasoningStartMs   // ← was Date.now() - start
}
```

The floor of 1 s in `thoughtForLabel` already covers a single-delta burst. Add a cadence case
`reasoning → onToolStart → advance 40 s → content` asserting `reasoningMs < 5_000`; it is RED
today and green after the two lines above. If instead you prefer to keep the wall-clock shape,
`closeReasoningSpan()` must also be called from `onToolPreparing` **and** `onToolStart` — but
that still over-counts the argument-streaming window, so the `reasoningLastMs` form is the
better answer.

---

### HI-2 — The CHAT-03 re-arm fix only covers an `"up"` gesture, and Phase 243 just put a click target on every assistant row. **Driven: one `pointerdown` inside the transcript re-pins a released reader.**

**Files:** `frontend/src/hooks/useFollowScroll.ts:154, 174, 232-240`;
`frontend/src/components/chat/MessageList.tsx:107-118` (the intent mapping).

**Issue.** The new third re-arm clause is `lastGestureIntentRef.current !== "up"`. The intent
ref is **overwritten by every gesture**, and `MessageList` maps `pointerdown` and `touchmove`
to `"unknown"` — which passes the clause. So the release the operator asked for survives only
until the reader touches the transcript for any reason at all. Phase 243 added a
`<button>` (`ThinkingBlock.tsx:212-219`) **to every assistant row inside the scroll viewport**,
which makes clicking inside the transcript a first-class, designed interaction rather than an
accident.

**Failure scenario (driven).** Real hook, real refs, fake timers, viewport 40 px from the
bottom (inside `FOLLOW_SCROLL_THRESHOLD`):

```
beginProgrammaticScroll()           // a token just landed
noteUserGesture("up")               // reader nudges up 40 px
onScroll()                          // → isPinned === false           ✓ released
advance 1000 ms ; onScroll()        // → isPinned === false           ✓ CHAT-03 holds
noteUserGesture()                   // reader CLICKS the new "Thinking..." fold
                                    //   (MessageList: pointerdown → "unknown")
onScroll()                          // the fold opening reflows content above
→ isPinned === true                 ✗ AssertionError: expected true to be false
```

The reader is re-pinned and auto-follow drags them to the live edge — *"if I scroll up it is
forcing me to go down"*, which is the operator report this phase exists to close.

**Two smaller mouths on the same hole, both deterministic from the source:**

- `MessageList.tsx:109` — `e.deltaY < 0 ? "up" : "down"`. A **horizontal** wheel or
  shift+wheel has `deltaY === 0` and is classified `"down"`, refreshing the gesture clock and
  clearing an `"up"` intent.
- `MessageList.tsx:111-114` — a `keydown` that is in neither `UP_KEYS` nor `DOWN_KEYS`
  correctly returns early, **but** `noteUserGesture` has already not been called, so that arm
  is fine. (Checked; no finding.)

**Fix.** An intent only ever *loses* the right to re-arm; it should not *regain* it from a
gesture that carries no direction. Keep a sticky "the reader asked to be left alone" bit and
clear it only on an unambiguous `"down"`, on `jumpToLive()`, and on a new run:

```ts
// useFollowScroll.ts
const leftDeliberatelyRef = useRef(false)

// noteUserGesture
if (intent === "up") { leftDeliberatelyRef.current = true; setIsPinned(false) }
else if (intent === "down") leftDeliberatelyRef.current = false
// "unknown" leaves the bit untouched — it can neither take hold nor free it

// onScroll re-arm clause
… && !leftDeliberatelyRef.current

// jumpToLive
leftDeliberatelyRef.current = false
```

`"unknown"` still falls through to the geometry whenever the reader had **not** deliberately
left, so the mirror case the file insists on (touch drag / scrollbar grab coasting to the
bottom re-arms) is preserved — add it as a case beside the driven one above so a future fix
cannot buy one by breaking the other.

⚠ Note for the record: the prompt asked whether the fix **over**-corrects and strands a
reader. Driven answer: **no.** Wheel-down, `PageDown`/`ArrowDown`/`End`, a touch drag, a
scrollbar grab and the chip all still re-arm. The defect is in the other direction.

---

## MEDIUM

### MD-1 — The commit carrying HI-1 is **98.7 % line-ending churn**, so the phase's riskiest logic was effectively unreviewable at the moment it shipped.

**File:** `frontend/src/providers/StreamsProvider.tsx`, commit `2a988c3de`
*("feat(243-04): an honest 'Thought for N seconds' — measured, or absent")*.

**Measured:**

| | raw | `git diff -w` |
|---|---|---|
| `bfdf899b1` (243-03) | 155 / 19 | 152 / 16 |
| **`2a988c3de` (243-04)** | **4380 / 4325** | **57 / 2** |
| whole range | 4380 / 4189 | 206 / 15 |

`2a988c3de` converted the file from CRLF to LF **in the same commit as the span logic**. The
normalization itself is arguably correct — 0 of the 180 blobs in `components/chat`,
`providers`, `hooks` and `lib` are CRLF at HEAD, so this file was the straggler — but doing it
inside a feature commit means the 57 substantive lines (including `closeReasoningSpan`, the
defect in HI-1) sit inside a 4,380-line diff. `git blame` on this file is now uniformly
`2a988c3de`. In a phase whose review premise is *"no independent reviewer exists"*, that is
not a cosmetic cost.

**Fix.** Land whitespace normalizations as their own commit, and add the SHA to
`.git-blame-ignore-revs`. Going forward, a `.gitattributes` with `* text=auto eol=lf` would
stop the remaining CRLF blobs from each producing one of these.

---

### MD-2 — The three suites that pin `makeStreamCallbacks`' tool reducer are **red (13 cases) and in neither count-gate knob**, so this phase rewrote that factory with no regression evidence from them — and did not notice.

**Files:** `frontend/src/__tests__/providers/streamsProvider.test.tsx` (10 failing),
`StreamsProvider.dedup.test.ts` (2), `streamsProvider_075_9_clientkey.test.tsx` (1).

**Issue.** ⚠ **These are INHERITED, not introduced** — I checked out `3412bb6ab -- frontend/src`,
re-ran, and got the byte-identical set of 13 failing test names, then restored. Phase 243
regressed nothing here. But:

1. `243-BASELINE.md` names **two** inherited failures, both in
   `library/__tests__/sketchComposition.test.tsx`. These thirteen are not mentioned anywhere in
   the phase.
2. `scripts/vitest-count-gate.cjs` reaches `src/__tests__/providers/` only through
   **named files**, and the only one named is the suite this phase added
   (`streamsProvider_243_cadence.test.tsx`, `:4800`). The script says so itself at `:2971`:
   *"`src/providers` sits in NEITHER knob."*
3. Failures include `D-075.2-04: onToolEnd(...) flips the entry whose tc.id === id`
   (`expected 'running' to be 'done'`) and the whole `075.6 argsCodeText` reducer slice —
   i.e. the **tool-reducer behaviour of the exact factory this phase wrapped in a generic
   flush**. `243-03-PLAN.md:275` even cites `streamsProvider_075_9_clientkey.test.tsx:28-90`
   as its harness reference without observing that it is red.

I drove the ordering contract by hand (see the CRITICAL section) and found it sound, so this
is a **coverage** finding, not a defect finding. But the phase's claim to have preserved the
reducer rests on suites nobody ran.

**Fix.** Record the thirteen in `243-VERIFICATION.md` as inherited, with the base-commit
evidence. Then either repair them and adopt the three files into `TARGETS` + `BASELINE`, or
plant a seed naming them — an unwatched red suite over a hot file is this repo's own recurring
finding.

---

### MD-3 — `CitedMarkdown`'s docblock now asserts an invariant 243-05 broke, and the component can be mounted mid-stream over partial content.

**Files:** `frontend/src/components/chat/CitedMarkdown.tsx:21-23`;
`frontend/src/components/chat/MessageItem.tsx:481`.

**Issue.** The docblock reads:

> *Used **ONLY** on the settled cited-assistant path … the StreamingNarration body never sees
> markers (D-05 attach-on-settle).*

Removing the narration arm makes that false. `backend/app/services/agent_loop.py:3023` emits
`citations` **after** the agent loop finishes but **before** `done`, and the terminal content
reconcile (`StreamsProvider.tsx:2627-2645`) is an async `getMessages()` round-trip. In the
window between them, `message.runStatus === "streaming"` and `message.citations.length > 0`,
so `MessageItem:481` routes the **accumulated narration+answer blob** into `CitedMarkdown`.
Each render re-runs `container.innerHTML = html` and the full `TreeWalker` marker upgrade,
replaying the `citation-marker--attach` stagger animation.

No security consequence — the pipeline is `DOMPurify.sanitize(marked.parse(...))` and the
`<sup>` nodes are `document.createElement`-owned. The cost is a stale invariant in a docblock
that a future phase will read as binding, plus a visible marker re-flash.

**Fix.** Correct the docblock (the house style here is to strike the superseded line rather
than delete it), and consider gating the marker upgrade on `!isStreaming` so the attach
animation plays once.

---

### MD-4 — On an `error` / `cancelled` terminal the accumulated narration blob is now the permanent answer body.

**Files:** `frontend/src/components/chat/MessageItem.tsx:481-488`;
`frontend/src/providers/StreamsProvider.tsx:2626` and `:2158`
(`if (kind === "done" || kind === "reader_done")`).

**Issue.** The content reconcile that replaces the blob with the backend's clean final answer
fires **only** on `done` / `reader_done`. On a failed, timed-out or cancelled run it never
fires. Before 243-05 that did not matter: the blob stayed folded to a one-line
`StreamingNarration` gist. Now it is rendered in full, as markdown, as the answer — so a
failed run permanently presents *"Now I'll search the knowledge base…"* plus tool chatter as
the model's reply.

This is a real consequence of D-243-06 and it is not named in `243-CONTEXT.md` or the
SUMMARYs. It may well be the right trade (it is more honest than hiding a failure behind a
gist) — but it should be a stated decision, not a side effect.

**Fix.** Either extend the reconcile to terminal kinds that persisted content, or state the
behaviour in `243-VERIFICATION.md` and add a fence for the error path to
`MessageItem.answerOutOfFold.test.tsx`.

---

## LOW

### LO-1 — `toParagraphs` runs on every render of the streaming row; a 33 KB body is re-split ~17×/s for the whole answer stream.
`frontend/src/components/chat/ThinkingBlock.tsx:249` calls `toParagraphs(reasoningContent)`
inline. `MessageItem` is `memo`'d so only the live row re-renders — but that row re-renders on
every coalesced flush (~60 ms) for the entire turn, long after reasoning has finished and
`reasoningContent` has stopped changing. At the measured max of **33,713 chars** that is a
regex split + `map(trim)` + `filter` per flush for nothing.
**Fix:** `const paragraphs = useMemo(() => toParagraphs(reasoningContent ?? ""), [reasoningContent])`
— and place it above the `if (!reasoningContent) return null` guard at `:193` so hook order
stays unconditional. Wrapping the component in `React.memo` is optional on top of that.

### LO-2 — Two simultaneous "thinking" affordances between iterations.
`MessageItem.tsx:703` renders an italic *"Thinking…"* when
`isStreaming && message.isPlanning && !hasRunningTools && message.content`, and
`onPlanning` (`StreamsProvider.tsx:1045-1049`) re-sets `isPlanning: true` between iterations
**after** content already exists. On a reasoning turn that is exactly when `ThinkingBlock`'s
trigger also reads *"Thinking..."* (`ThinkingBlock.tsx:216`). Two indicators, one state. The
sketch shows one.
**Fix:** gate `:703` on `!message.reasoningContent`, mirroring the guard 243-02 wrote into
`RunCard.tsx:487`.

### LO-3 — The clamp control drops the sketch's focus ring and carries no `aria-expanded`.
`ThinkingBlock.tsx:271-278`. The approved sketch specifies
`.moretog:focus-visible{outline:2px solid var(--color-primary);outline-offset:3px}`
(`sketches/234-the-thinking-block/index.html:144`); the port has no `focus-visible` style, so
the control is invisible to keyboard focus against the Deep Midnight background. It also
expands a region without announcing it.
**Fix:** add `focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[3px]`
and `aria-expanded={clampExpanded}` + `aria-controls` pointing at the body's id.
⚠ The **fold** trigger at `:212-219` is correct — real `<button>`, explicit `type="button"`,
`aria-expanded`. No finding there.

### LO-4 — `CLAMP_MAX_PX + 1` will clamp for as little as one hidden pixel.
`ThinkingBlock.tsx:187` — `el.scrollHeight > CLAMP_MAX_PX + 1` with a `max-h-[300px]` cap. A
301 px body gets the cap, a 76 px fade and a *"Show all of it"* control for 1 px of content.
**Fix:** compare against a meaningful reveal, e.g. `scrollHeight > CLAMP_MAX_PX + 40`.
(The measurement itself is sound: I confirmed there is no circularity — `scrollHeight` reports
full content height under `overflow:hidden` — no loop is possible, because `setOverflowing` is
not in the effect's own deps, and `thinkingOpen` being in the deps genuinely is load-bearing
since Radix unmounts `CollapsibleContent`'s children while shut.)

### LO-5 — `StreamingNarration.tsx` is confirmed orphaned.
`grep -rn "StreamingNarration" frontend/src --include=*.tsx --include=*.ts` outside
`__tests__` returns **only comment text** (`MessageItem.tsx:449,477`, `ThinkingBlock.tsx:28,35`,
`CitedMarkdown.tsx:22`, `StreamsProvider.tsx:2151,2615`) plus its own definition. Zero
production callers, as reported. The phase records the retirement as owed
(`243-PATTERNS §F.4`) and `MessageItem.answerOutOfFold.test.tsx §4` fences it as
not-deleted-not-restyled, so removing it is currently a *test* change too.
**Fix:** none required now — but ensure `deferred-items.md` carries a `re_open_trigger`, or
this becomes the fourth "owed retirement" in this folder.

### LO-6 — The structural-callback flush defeats coalescing on sub-agent / code-execution turns.
`StreamsProvider.tsx:1297-1310` wraps **every** non-filling callback with
`coalesceDeltas.flush()`, including the high-frequency `onSubAgentDelta` (`:826`),
`onCodeStdout` (`:943`), `onCodeStderr` (`:956`) and `onToolArgsProgress` (`:626`). `flush()`
clears the timer unconditionally, so after each of those the **next** content delta takes the
leading edge and applies immediately — `DELTA_COALESCE_MS` stops binding. Correctness is
unaffected (this is why the drain is there), and in practice main-body content is not usually
flowing during those events, so impact is small. Recorded because CHAT-02's cadence guarantee
is the deliverable and this is the one place it silently does not hold.
**Fix (optional):** have `flush()` drain without closing the window, or exclude the three
pure-stdout/narration callbacks — but only with an ordering fence proving they cannot precede
a transcript-visible structural write.

### LO-7 — `AbsenceHint`'s gate still encodes the removed narration branch.
`MessageItem.tsx:497-500` — `!(isMessageStreaming && (message.tool_calls?.length ?? 0) > 0)`.
The comment above it explains the gate as *"never given the streaming-narration path"*. The
behaviour is still correct (citations are not settled mid-run) but the stated reason no longer
exists, so the next reader cannot tell whether the predicate is load-bearing.
**Fix:** re-state the reason as *"citations are not authoritative until terminal"*.

---

## Explicitly checked and CLEAR — stated so the absences are readable

| Asked | Verdict |
|---|---|
| Token loss on terminal / error / abort / thread switch / unmount / second run / `buffer_expired` | **Clear.** Driven on the no-terminal path; the coalescer self-drains in ≤ 120 ms regardless. |
| Every structural callback wrapped, drain ordered correctly | **Clear.** 47 keys enumerated; 3 excluded by name and all 3 are fillers; driven on the Anthropic interleave. |
| `jumpToLive` still works after the re-arm fix | **Clear** — it sets the pin directly. |
| Span leaks across messages / threads; negative or absurd duration | **Clear** on all four. The *value* is wrong for a different reason — HI-1. |
| XSS / injection on the un-folded live answer | **Clear.** DOMPurify on both live renderers; `ThinkingBlock` is text children only and §12 fences the source. |
| New `useEffect` in `MessageItem` (the Phase 227 discharge) | **Clear** — the diff adds none; the only new effect is inside the extracted leaf, which is the point of the extraction. |
| `RunCard` leftovers after the fold deletion | **Clear** — `FoldTrigger`, `Collapsible*` and `thinkingOpen` are fully removed with no dangling reference; `isStreamingNow` is still used 20×. |
| Fold state surviving the temp-id → DB-id reconcile (no `key=`) | **Clear** — `MessageList.tsx:220` keys any assistant row with a `runId` as `run-${runId}`, which is stable across the swap. |
| `text-xs` on the clamp control — right element? | **Yes.** The sketch specifies `font-size:var(--text-xs)` for `.moretog` (`index.html:142`) while the `text-xs → text-sm` step applies to the body (`index.html:272`). The port matches; `ml-[28px] mt-[9px]` and `mb-[11px]` match `:143` and `:136`. |
| `MessageList.tsx` needing no edit | **Half true.** Nothing there *breaks*; but the gesture→intent mapping that HI-2 turns on lives at `:107-118`, so a complete CHAT-03 fix does touch this file. |
| New type errors | **None.** 67 total, matching the documented base; zero in the seven files. |
| New test failures | **None.** The 13 reds are byte-identical at `3412bb6ab`. |

---

_Reviewed: 2026-09-11_
_Reviewer: Claude (gsd-code-reviewer) — solo substitute for the §6.3 independent gate, per OV-SOLO-01_
_Depth: deep. Three throwaway driving suites were written, run and deleted; `git status` verified clean._
