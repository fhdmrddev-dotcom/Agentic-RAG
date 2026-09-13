---
phase: 243
plan: "06"
kind: review-fixes
created: 2026-09-11
base: 1212bdc50
commits: [0825d30dc, 0790ad7b0, 436f904bd]
source: "243-REVIEW.md — the mandatory code review under OV-SOLO-01"
---

# 243-06 — the three defects the review found, fixed

Phase 243 closed its five plans with 5/5 success criteria verified. **Then the mandatory code
review found three real defects in the code those plans had just written**, and this is the
record of fixing them.

⭐ **That is the review doing its job, and it is worth stating plainly rather than burying:** the
phase had a characterization net, seven gated suites, a verifier that opened every file, and
`count gate OK` — and **HI-1 passed all of it.** A fence shaped like its author's assumption
cannot catch the author's assumption.

## HI-1 — `reasoningMs` billed tool-execution time as thinking time

**The phase re-introduced the exact defect it was built to remove, in a different variable.**

`D-243-13` exists because `RunCard`'s elapsed *"measures the whole run … includes every tool
call … wrong by construction on any tool-bearing turn, which is the majority shape."* 243-04 then
shipped a span that closed only on the first **content** delta or `onDone` — and nothing closed it
at a tool boundary. `agent_loop.py:2078-2100` emits `reasoning_delta` → `tool_preparing` with no
content delta required between them, which is the ordinary shape for a reasoning model that thinks
and then calls a tool with no preamble.

Driven by the reviewer against the real callback factory:

```
onReasoningDelta(...) ; +100ms ; onReasoningDelta(...)
onToolPreparing / onToolStart ; +40_000ms ; onToolEnd ; onIterationStart(2)
onDelta("Here is the answer.")
→ MEASURED reasoningMs = 40100        → the fold read "Thought for 40 seconds"
```

**Fixed** (`0825d30dc`): the span is the **reasoning stream itself** — `reasoningLastMs -
reasoningStartMs`, with `reasoningLastMs` stamped on every reasoning delta, and bursts accumulated
across iterations into `reasoningTotalMs`. The honesty rule is untouched: **no measured span ⇒ no
duration**, label falls back to `Thinking`/`Thought`.

⚠ **Why every fence missed it, which is the more useful half.** The cadence suite had **six** span
cases and **none** put a tool callback between reasoning and content; characterization §14 only
asserted how a *given* `reasoningMs` renders. **The missing case was the one that mattered**, and
it was missing because the same mind wrote the fix and the fence.

## HI-2 — one click in the transcript re-pinned a reader who had scrolled away

243-03's re-arm fix gated on `lastGestureIntentRef.current !== "up"`. But that ref is **overwritten
by every gesture**, and `MessageList.tsx` maps `pointerdown`/`touchmove` to `"unknown"` — which
passes the test.

⭐ **And this phase made it a designed interaction rather than a hypothetical: 243-02 put a
`<button>` (the thinking fold trigger) on every assistant row inside the viewport.** The fix for
CHAT-03 and the change that defeats it shipped in the same phase, four commits apart.

Driven: wheel-up 40 px → released; +1000 ms → still released (243-03's fix holds); then a plain
click → next scroll event → `isPinned === true`.

**Fixed** (`0790ad7b0`): a sticky `leftDeliberatelyRef`, set on an `"up"` intent and cleared **only**
by an explicit `"down"`, by `jumpToLive()`, or by a new run. Also `deltaY === 0` (a horizontal
wheel, a shift+wheel, a sideways trackpad flick) no longer classifies as `"down"`.

⛔ **The mirror cases were the acceptance bar and they stayed green** — wheel-down, `End`/`PageDown`,
touch drag, scrollbar grab and the chip all still re-arm. A fix that passed the defect case by
breaking those is a regression, not a fix.

## MD-4 — a failed run rendered its narration blob as the answer, permanently

Both content-reconcile sites gated on `kind === "done" || kind === "reader_done"`. That narrowing
was **harmless for as long as `MessageItem` folded a live tool-bearing run's content into
`StreamingNarration`** — a failed run's interim blob simply stayed folded.

⛔ **243-05 deleted that arm.** So the raw narration blob began rendering as the answer, through the
answer's own renderers, and **permanently — because a failed run never reached the reconcile at
all.** A consequence of D-243-06 that no plan, no fence and no verifier named.

**Fixed** (`436f904bd`): every terminal kind reconciles, and the list is **spelled in full**
(`["done", "reader_done", "error", "cancelled", "timed_out"]`) so it is total over the `kind` union
rather than a negation a sixth kind would silently join.

⛔ **The `!answer.content` guard is load-bearing, not defensive.** A run that died before the
backend wrote anything would otherwise have its visible blob **blanked** — replacing a bad answer
with no answer, which is strictly worse than the defect being fixed.

### Driven RED both ways, independently

| Case | Reverted | Result |
|---|---|---|
| **§MD-4a** ×3 (`error` / `cancelled` / `timed_out`) | the **gate** only, guard left in place | **RED ×3** |
| **§MD-4b** (persisted content empty) | the **guard** only, gate left fixed | **RED ×1**, the other 5 green |

Source restored **md5-identical**: `cbaa0a791530af6fdef75b3effaed176` before and after.

⭐ **Two reverts, not one, and that is the point.** A single revert would have proven the pair
together and left it unknowable whether the guard did anything. Reverting each half alone proves
each half is load-bearing — and a fix without the guard **passes §MD-4a on its own.**

⚠ **The suite it lives in — `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — has
existed since Phase 176 and was in NEITHER gate knob.** It ran nowhere and guarded nothing, for the
whole of `BUG-260707-03`'s life. Registered in both knobs here (pin `6`).

## Gates

| | |
|---|---|
| count gate | `total 8046 · failed 0 · pinned total 7276` · **`count gate OK — 256/256`** |
| failing set | **empty** — a subset of `243-BASELINE.md`'s two inherited cases |
| `tsc -p tsconfig.app.json` | **67** — the documented base, set diff empty |
| ledger gate | exit **0** |
| CLAUDE.md size gate | exit **0** |
| migration | `git diff --stat -- supabase/ backend/` **EMPTY** |
| `git diff -w --stat` | **132 insertions / 4 deletions** — no whitespace churn hiding logic (MD-1's lesson, applied) |

## Mechanical vs judgement (D-243-12 — solo running)

**MECHANICAL, and not weakened by solo running:** the two independent RED drives and their received
values; the md5-identical restore; the `-w` diff; the gate set diffs; the typecheck base; both knob
greps; the three ledger/size gate exit codes.

**JUDGEMENT, carrying no second opinion:**

1. That accumulating reasoning bursts **across iterations** into a total is the right semantics —
   the alternative (first-to-last) is defensible and would read larger on a multi-tool run.
2. That reconciling a **cancelled** run to the persisted answer is right. A user who pressed Stop
   may expect to keep seeing what was on screen when they pressed it.
3. That MD-4's fix belongs in this phase at all rather than as a follow-up.

## ⚠ Owed, and not discharged here

- **Every G-4 lived-experience row. No browser has been opened in this phase at any point.**
  `243-VALIDATION.md`'s owed-ledger is still empty. **Run L-2 first** — real wheel, ≥50-message
  thread — because HI-2 is precisely the class of defect a synthetic `WheelEvent` cannot see, and
  `BUG-260823-01`'s own history records two fixes that passed synthetic events and failed a real
  mouse.
- The review's **4 LOW → 7 LOW** items and MD-1/MD-2/MD-3 are recorded in `243-REVIEW.md`, not
  fixed.
- `src/__tests__/providers` carries **13 inherited red cases** in suites in neither knob —
  confirmed inherited by checkout at the base. `243-BASELINE.md` named only two inherited failures,
  in a different file; that baseline was **incomplete**.
