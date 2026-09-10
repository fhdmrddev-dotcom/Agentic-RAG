---
phase: 243
name: The Thinking Block and the Follow-Scroll Seam
milestone: v4.1
requirements: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
created: 2026-09-11
source: "synthesized by the orchestrator from ROADMAP + the two operator-approved sketches + code measured at HEAD — /gsd:discuss-phase was NOT run"
sketches: [234-the-thinking-block, 235-thinking-with-no-run]
g2_status: DISCHARGED
research: skipped (ROADMAP flag)
plan_target: 4-5
---

# Phase 243 — CONTEXT

## ⚠ How this file came to exist, stated rather than hidden

`/gsd:discuss-phase 243` **was not run.** The operator asked for the phase end-to-end
autonomously while separately discussing Phase 242 (which the ROADMAP explicitly permits:
*"May run alongside 242 — the blast radii do not intersect"*).

This file is therefore **synthesized**, and every decision below is traceable to one of three
sources that already exist and were not invented here:

1. `.planning/ROADMAP.md` → Phase 243 (goal, 5 success criteria, flags, `How we'd know this failed`)
2. The **two operator-approved sketches**, both dated 2026-09-11, both carrying an explicit
   `✅ WINNER — (operator, 2026-09-11)` section
3. **Code read at HEAD on 2026-09-11**, quoted with line numbers below — not read off a report

⭐ Where this file states a fact about the code it was **measured**, and where it states a
decision it **names whose decision it was**. Nothing here is a preference of the orchestrator's.

## ⛔ G-2 IS DISCHARGED — do not re-run `/gsd:sketch`

The ROADMAP flags `/gsd:sketch` as **MANDATORY before planning**. It has already run, twice,
and both sketches closed with an operator verdict:

| Sketch | Question | Winner (operator, 2026-09-11) |
|---|---|---|
| `234-the-thinking-block` | what reasoning looks like at rest / mid-stream / expanded | **V1 "Thin rule"** — from a Google Stitch pass, re-expressed against shipped components |
| `235-thinking-with-no-run` | where reasoning lives when there is no RunCard | **B "bare line in the message body"** — recognised from 234 rather than re-compared |

⚠ **`.planning/sketches/234-the-thinking-block/index.html` IS the G-2 acceptance bar** for this
phase — the file, not a description of it. Sketch 235's file is the record of the placement
question and its rejected foils; it is **not** the bar.

⚠ **The named failure mode is sketch-to-build drift.** A criterion closed against a paragraph
describing the mockup, rather than against the mockup, has not been closed. Verification opens
`index.html`.

## The five requirements, and what is actually true at HEAD

Each row was opened on 2026-09-11. Line numbers are from the working tree at that read.

| Req | The claim in REQUIREMENTS.md | Measured at HEAD |
|---|---|---|
| **CHAT-01** | reasoning renders as a `whitespace-pre-wrap font-mono` blob at `RunCard.tsx:501` | ✅ **TRUE.** `RunCard.tsx:500` is `<div className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border-l-2 border-muted-foreground/20 ml-3">` — a nested `max-h-64` scroller inside a scrolling conversation |
| **CHAT-02** | `StreamsProvider.tsx` fires a full `setMessages` per token, unthrottled | ✅ **TRUE.** `onDelta` (≈`:416`) and `onReasoningDelta` (≈`:423`) each call `setMessages(prev => prev.map(...))` **per delta**. `lib/throttle.ts` (`makeThrottle`, 40 L) exists and its own docblock says it is used *"to batch writes to localStorage"* — the UI path is untouched |
| **CHAT-03** | `MessageList.tsx:164-176` re-runs per token and smooth-scrolls at `:171` | ✅ **The lines are exactly as described.** `:171` is `preparingEl.scrollIntoView({ behavior: "smooth", block: "nearest" })` inside the `else if (isStreaming && isPinnedNow())` token-cadence branch, and `:176` is the dep array containing `messages` — which is what makes it per-token. ⚠ **BUT SEE D-243-05: the ROOT CAUSE `BUG-260823-01` names was ALREADY FIXED, and the report is stale** |
| **CHAT-04** | `MessageItem.tsx` gates reasoning on tool calls | ✅ **TRUE, and worse than "gated".** `RunCard.tsx:478-502` is the **only** renderer of `reasoningContent` in the codebase, and `MessageItem.tsx:425` mounts the run path only when `(message.tool_calls?.length ?? 0) > 0`. A pure-text reply does not hide reasoning — **it has nowhere to put it.** 105 of 340 reasoning-bearing rows (31%) are that shape |
| **CHAT-05** | the final answer stays folded in narration until reload | ✅ **TRUE, and it shares a cause with CHAT-01.** The answer *is* already streaming (`StreamsProvider.tsx:415` appends `content: m.content + delta`), but on a tool-bearing run `MessageItem.tsx:425-431` routes that content into `<StreamingNarration>` — the folded italic gist — so it is written **inside the fold** and only appears when the run-end reconcile swaps in the persisted text |

## Decisions

### D-243-01 — The component seam: `ThinkingBlock` comes OUT of `RunCard` and mounts in `MessageItem`

**Whose:** operator, via sketch 235's winner B.

Today the fold is built inline inside `RunCard`'s `expanded &&` body (`RunCard.tsx:478-502`),
which is why 31% of reasoning has no home. The winner binds:

- one `ThinkingBlock` component, extracted from `RunCard`
- mounted in **`MessageItem`** for **both** message shapes — tool-bearing and tool-free
- **the tool-conditionality disappears by construction**, not via a second branch
- order on screen: **thinking above the tool rows and above the answer** — the order in time
- **renderers afterwards: exactly one.** A second reasoning renderer is a build failure, not a
  style choice (Phase 095 build-once inventory rule)

⭐ This extraction is also the G-5 discharge for `RunCard.tsx` — see D-243-07.

### D-243-02 — What V1 changes, and nothing else

**Whose:** operator, via sketch 234's winner. Reproduced from the sketch's own diff table so a
plan cannot drift from it:

| | |
|---|---|
| **Fold control** | **Unchanged component.** `FoldTrigger.tsx` is already shared with `CitationList` (Phase 224-05). Only its `label` prop moves: `"Thinking"` → `"Thought for N seconds"` |
| **⛔ No `count`** | `FoldTrigger`'s own comment forbids inventing one for reasoning: *"reasoning has no countable unit and inventing one would be fabricated precision"* |
| **Body** | drops four classes — `font-mono`, `whitespace-pre-wrap`, `max-h-64`, `overflow-y-auto` — and `text-xs` → `text-sm`. **`border-l-2` and `ml-3` stay** |
| **Long reasoning** | clamp + "Show all of it", reusing the **shipped sketch-050 pattern**, not a second mechanism. Below ~700 chars the control removes itself rather than sitting inert |
| **Answer** | renders live below the settled thinking line instead of inside `StreamingNarration` |
| **Tool rows** | ⛨ **untouched — operator constraint.** Nothing in this phase restyles, re-orders or re-labels a tool row |
| **Fold default** | ⛔ **UNCHANGED — folded, at rest AND while streaming** (operator, 2026-09-11). Shipped default is `useState(false)` at `RunCard.tsx:91`; `FoldTrigger.tsx`'s comment protects it: flipping it *"would be a regression dressed as consistency"*. ⚠ **Auto-expanding during the stream would flip it in effect — so it does not.** Reasoning accumulates behind a closed fold; opening it mid-stream is the user's choice |

### D-243-03 — The scale the design must survive is 170×, and it was measured

**Whose:** sketch 234, queried against this machine's local Supabase on 2026-09-11.

| | |
|---|---|
| Messages carrying reasoning | **340** |
| …that called **zero** tools (invisible today) | **105** — 31% |
| Median reasoning length | **198 chars** |
| Mean | **1,053 chars** |
| Max | **33,713 chars** |

⭐ **The median is one short paragraph and the max is a wall.** A surface that is calm at 198
and skimmable at 33,713 is the deliverable. **Any test that exercises only one end of that
range has not exercised the design.** Both ends are named in the UAT rows below.

### D-243-04 — `CHAT-02` and `CHAT-03` are ONE mechanism and MAY NOT be split across plans

**Whose:** `D-v4.1-02`, ratified in the ROADMAP. Restated because it is the phase's sharpest
constraint:

> `CHAT-02` and `CHAT-03` **may not be split across phases or across plans that cannot see each
> other** — they are one line of code, and fixing either alone re-breaks the other.

The shared line is the `messages`-dependent effect at `MessageList.tsx:141-176`. Coalescing the
delta cadence (CHAT-02) changes how often that effect runs, which changes the scroll behaviour
(CHAT-03). **They land in ONE plan.** A plan file that names one without the other is wrong.

### D-243-05 — ⚠⚠ `BUG-260823-01`'s stated root cause IS ALREADY FIXED. Drive the defect before fixing it.

**This is the most important decision in this file, and it is the milestone's own method rule
paying for itself again: a review is a CLAIM about code, not the code.**

`BUG-260823-01` (2026-08-23, `status: open`, `folded_into: null`) names its cause precisely:

> `beginProgrammaticScroll()` sets a boolean and clears it on the **next animation frame** …
> that assumption holds only for an **instant** scroll

**That code no longer exists.** Measured at HEAD in `hooks/useFollowScroll.ts`:

- `PROGRAMMATIC_SCROLL_SETTLE_MS = 900` replaced the one-frame flag
- `hardProgrammaticUntilRef` — a **second, uncancellable** clock that gates the **re-arm**
- `noteUserGesture(intent)` — wheel / touch / pointer / key, with direction, releasing the pin
  **synchronously** on an upward intent and aborting the in-flight animation via
  `vp.scrollTop = vp.scrollTop`
- `isPinnedNow()` — the ref read, so the auto-follow effect cannot fire on a stale `true`

Those landed for `BUG-260904-02`, **twelve days after `BUG-260823-01` was filed**, and the bug
report was never updated. Its `status: open` is a register that only knows the register below it.

⛔ **THEREFORE: no plan may "fix" CHAT-03 against the bug report.** The first task on the
CHAT-02/03 plan is a **TDD RED drive that establishes what still reproduces at HEAD**, on the
real geometry, and names it. Three outcomes are all acceptable and each is a different plan:

1. **A residual is found and driven RED** → fix it, and the fence is the proof.
2. **Nothing reproduces** → CHAT-03 closes as **already-fixed-by-228**, the bug report is
   updated with the discharging commit, and the plan says so plainly. **This is a legitimate
   outcome, not a failure** — and it must not be dressed up as a fix.
3. **The residual is real but different from the report** → record the correction **beside** the
   original in the bug file, never over it.

⚠ **A candidate residual, named so it is checked rather than assumed:** while pinned, the effect
refreshes `hardProgrammaticUntilRef` to `now + 900ms` on every token. A wheel-up records the
gesture at `t`, and the hard clock expires around `t + 900ms` while the gesture window
(`USER_GESTURE_WINDOW_MS = 1500`) stays open to `t + 1500ms` — a **~600ms window** in which a
coasting scroll event within `120px` of the bottom re-arms the pin. Whether that is a defect or
the intended re-arm depends on the geometry a real wheel produces. **Drive it. Do not reason
about it in a plan file and call that evidence.**

### D-243-06 — CHAT-01 and CHAT-05 are ONE defect, found while sketching

**Whose:** sketch 234, §*Operator constraints, applied*, item 2.

The answer already streams. `MessageItem.tsx:425` routes it into `StreamingNarration` on a
tool-bearing run, so it is written inside the fold. Fixing where the answer renders (D-243-01's
mount order — thinking above, answer below) **is** CHAT-05's live half. They ship together.

⚠ CHAT-05's criterion is stated on the **mount/navigation** path — *"a run that finished while
the operator was on another page … with no reload"*. The send-path half already shipped at
Phase 176. **The plan must verify the navigation path specifically**, not only a live send.

### D-243-07 — G-5: four files, and the disposition of each

Triples **re-derived from git on 2026-09-11** with CLAUDE.md's recipe (six-digit dated
quick-task buckets subtracted), not copied from the ledger:

| File | Measured | Ledger cell reads | Disposition |
|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | **88 / 35 / 4189** | `85 / 34 / 4144` | ⚠ **STALE by 1 phase.** FIRES. The largest file in the frontend tree. This phase touches **two callbacks** (`onDelta`, `onReasoningDelta`) — honour by construction, measured, or propose the seam first |
| `frontend/src/components/chat/MessageList.tsx` | **20 / 8 / 292** | `19 / 8 / 267` | ⚠ STALE. FIRES |
| `frontend/src/components/chat/RunCard.tsx` | **27 / 13 / 729** | `26 / 12 / 728` | ⚠ **STALE, and it NEWLY CROSSES the threshold.** ⭐ **D-243-01's extraction IS this file's G-5 discharge** — the seam its ledger section names is *"the run-identity header vs. the status/terminal vocabulary vs. the elapsed-timer machinery"*; the thinking block leaving is a fourth concern departing, which is the right direction |
| `frontend/src/components/chat/MessageItem.tsx` | **66 / 32 / 707** | `62 / 33 / 702` | ⚠ STALE. ✅ **G-5 DISCHARGED at Phase 227.** ⛔ **Do not re-hollow it.** The mount added here is a **component mount**, not new state ownership — and that must be MEASURED (`useState(` before/after, `useEffect(` before/after, props before/after, deleted lines), not asserted |

⛔ **Every plan touching one of these four reads that file's section in
`docs/HOT-FILE-LEDGER.md` BEFORE planning**, and **updates the row in CLAUDE.md and the section
in the detail file in the SAME COMMIT.** A row present and wrong answers the auditor with
`satisfied` and stops the audit — which is worse than an absent row.

⚠ **The ledger disposition cell is capped at 200 chars** by `scripts/check-claude-md-size.cjs`.
Verdict in the cell; reasons in the detail file.

### D-243-08 — ⛔ No streaming-architecture rewrite

**Whose:** ROADMAP flags, and `D-14`'s standing red line.

These are **surgical fixes on named lines in named files**. Provider differences stay at the
gateway / adapter / sanitizer boundary. A plan that proposes restructuring the SSE path, the
stream store, or the message model has left this phase.

### D-243-09 — `SEED-049` is fired-and-deferred, and the re-open trigger is live

`SEED-049` (E2E Playwright revival) names *"a chat-surface / streaming / RunCard phase"*
verbatim as its trigger. **That trigger has FIRED.** It is deferred **by decision, not
oversight** — reviving a rotted E2E suite is a phase of its own.

⚠ **The re-open condition is concrete and this phase must answer it:** *the first criterion here
that cannot be verified without a live E2E drive.* Criterion 3 (scroll survives a tool call) and
criterion 5 (navigate-away-and-back) are the two candidates. If either cannot be honestly closed
by a vitest fence plus a driven browser check, **say so in VERIFICATION.md and re-open the
seed** — do not close the criterion against a unit test that cannot see it.

### D-243-10 — Test-gate hygiene, three named traps

1. ⚠ **`vitest-count-gate.cjs` needs `TARGETS` *and* `BASELINE` for any new suite.** A suite in
   one knob and not the other **runs while guarding nothing** — measured on
   `WorkflowScheduleModal.test.tsx` at Phase 214.
2. ⚠ **`SEED-171`'s five cap-independent flaky suites sit near this blast radius.** If the gate
   reds: **capture the failing filenames from the gate's own persisted JSON BEFORE re-running
   anything**, check each against `git diff --numstat`, and do **not** reach for the worker cap.
   `GSD_VITEST_MAX_WORKERS=2`, run from the repo root.
3. ⚠ **`npx tsc --noEmit` in `frontend/` type-checks ZERO files** — `tsconfig.json` is
   solution-style (`{"files": [], "references": [...]}`). Use **`npx tsc -p tsconfig.app.json
   --noEmit`** and measure a **set diff**: the app config reports **67 errors at base**, so
   "zero errors" is not a reachable criterion and a plan that writes one has written a criterion
   that cannot pass.

### D-243-11 — ⛔ Presence assertions cannot see content drift

The ROADMAP names this failure mode explicitly, and it has already shipped a defect on this
project once:

> A green composition fence coexists with the shipped defect because it asserts a block is
> **present** by `data-testid` while the content drifts.

`RunCard.tsx` already ships `data-testid="thinking-trigger"` and `data-testid="thinking-row"`.
**Asserting they exist proves nothing about this phase.** Where the words are the deliverable —
`"Thought for N seconds"`, the absence of a `count`, the clamp control's presence *and* its
self-removal below ~700 chars — **assert the rendered CONTENT**.

### D-243-12 — Solo running, and what the phase may claim

`OV-SOLO-01` was ruled on by the operator at this milestone's scoping: **solo running
continues.** No independent §6.3 reviewer exists.

- The dispatched **code-review subagent is MANDATORY** (`code_review: true`, `standard`).
- **`243-VERIFICATION.md` reads "self-verified", never "reviewed."**
- Mechanical evidence — a driven fence, a byte-identical file, a measured count — is **not**
  weakened by solo running. **Judgement calls are.** Say which is which.

### D-243-13 — ⚠⚠ `"Thought for N seconds"` HAS NO HONEST SOURCE TODAY. Do not ship the sketch's number.

**Found by the pattern-mapper and then verified in both files, 2026-09-11.** This is the phase's
one genuine design gap, and it would ship as a fabricated value if nobody named it.

**The sketch computes the number from the character count:**

```js
// sketches/234-the-thinking-block/index.html:338
const secs = Math.max(1, Math.round(chars / 180));
```

⛔ **That is a demo affordance so the mockup has a plausible label at every Scale setting — it is
NOT a design decision, and a plan that ports it ships a number derived from string length and
presented as a duration.** That is the same sin as the `count` the fold control already forbids
(*"reasoning has no countable unit and inventing one would be fabricated precision"*), one unit over.

**And there is no real source to swap in.** Measured:

- `messages.reasoning_content` is the only reasoning column — **no `reasoning_started_at` /
  `reasoning_completed_at` anywhere** in the model.
- `RunCard`'s elapsed machinery (`RunCard.tsx:143-198`, ~55 lines) measures **the whole run** —
  `runStartMs` → `completedAt` — which **includes every tool call**. Labelling that "thought for" is
  wrong by construction on any tool-bearing turn, which is the majority shape.

⭐ **The precedent for the right answer is already in this very file, and it was paid for by a
shipped bug.** `RunCard.tsx:181-186`:

> *terminal + no completedAt + no frozenEnd → **NO duration (the honesty rule)***

with `wasStreamingRef` distinguishing a run we actually watched from a reloaded one, because
capturing `Date.now()` against a stale `created_at` is *"the `BUG-260606-02` **1440m** lie"*.

**So the decision, and it is a decision rather than an option list:**

1. **Measure it client-side, live.** Stamp a start on the **first** `onReasoningDelta` and an end
   when reasoning stops (the first content delta, or `onDone`). The provider already carries
   closure state for exactly this kind of thing — `let currentIteration = 0`,
   `StreamsProvider.tsx:410`.
2. ⛔ **When it is not honestly known, show NO duration** — the label falls back to the shipped
   `"Thinking"` / `"Thought"`. **A reloaded or DB-loaded message has no measured reasoning span and
   must not invent one.** That is `RunCard`'s own `hasElapsed` gate, applied to a second value.
3. ⛔ **No migration.** Persisting the span is a schema change and this phase declares none. If a
   plan concludes the label is worthless without persistence, that is a **finding to state**, not a
   migration to slip in — plant a seed and ship the honest fallback.

⚠ **The consequence for criterion 1 is concrete:** the sketch is the acceptance bar for *shape*,
and on this one value the shipped surface will **deliberately differ from it** — a historical
message will read `"Thinking"` where the mockup reads `"Thought for 6 seconds"`. **Say so in
VERIFICATION.md.** An undeclared difference from the bar is drift; a declared one with a reason is
a decision.

### D-243-14 — ⚠ The RunCard mount is `MessageItem.tsx:359-361`, NOT `:425`

Both sketches and the requirements table above cite `MessageItem.tsx:425` as the tool-gated RunCard
mount. **Measured at HEAD it is not.** `:425` is the **`StreamingNarration`** branch inside the
content block; the RunCard mount is:

```tsx
// MessageItem.tsx:359-361
{message.tool_calls && message.tool_calls.length > 0 && (
  <RunCard message={message} isStreaming={isStreaming} />
)}
```

⭐ **Every conclusion drawn from the wrong line still holds**, because the two sites share the same
predicate (`tool_calls.length > 0`) — which is exactly why the error survived three documents. **But
a plan that edits `:425` intending to change the RunCard mount edits the wrong construct**, and the
two want opposite treatment: `:359-361` is where `ThinkingBlock` mounts **unconditionally**
(D-243-01), while `:425` is where CHAT-05's answer must stop being routed into the fold (D-243-06).

⚠ Recorded rather than silently corrected upstream: the sketch READMEs keep their text, and this is
the correction beside it.

### D-243-15 — The coalescing choice is PRODUCER-side, and the reason is D-243-04

Two shipped mechanisms exist and they sit at different layers. The pattern-mapper measured both:

| | `makeThrottle` on the delta callbacks (**producer**) | `useDeferredValue` in `ThinkingBlock` (**consumer**) |
|---|---|---|
| fold repaint cadence | coalesced ✅ | coalesced ✅ |
| `setMessages` frequency | **reduced** | unchanged |
| `MessageList.tsx:141-176` run frequency (`messages` is in its dep array) | **reduced** ✅ | **unchanged** ❌ |
| satisfies CHAT-02 | yes | yes |
| satisfies **D-243-04**'s *"one line of code"* linkage to CHAT-03 | **yes** | **no** |

⇒ **Only the producer-side throttle has the property D-243-04 is written about.** A consumer-side
`useDeferredValue` would calm the fold and leave the scroll effect running per token — closing
CHAT-02's flicker criterion while touching CHAT-03 not at all, which is precisely the *"fixed one
and re-broke the other"* failure the ROADMAP names. **Choose the producer side, and say why.**

⚠ `useDeferredValue` is nonetheless the project's one shipped in-render coalescer
(`components/chat/tool-bodies/ShikiCode.tsx:109`, Phase 075.9 T4) — cite it if a consumer-side
assist is added *on top of* the producer throttle, never *instead of* it. `useTransition` and
`startTransition` occur **zero** times in `frontend/src`; there is no rAF-batching precedent.

⛔ **TWO TRAPS, both measured, both fatal if missed:**

1. **`makeThrottle` is LAST-WRITE-WINS, not accumulate** (`lib/throttle.ts:19,28` — `lastArgs =
   args` discards the previous call). The accumulation currently lives *inside* the `setMessages`
   updater (`m.content + delta`). **Wrapping `onDelta` in `makeThrottle` naively DROPS TOKENS.**
   The shape is a closure accumulator flushed *through* the throttle, with `.flush()` at the
   terminal edges (`onDone`, `onTerminal`) — mirroring the cache writer's own flush discipline.
2. **`makeThrottle` has no leading edge** (`throttle.ts:8-9`), so the first token's paint is delayed
   by up to `waitMs`. At the cache writer's 500 ms that is a visible half-second of nothing before
   a reply starts. **Pick the window deliberately and state the number.**

### D-243-16 — The extraction has NO safety net, and the 227 template is how it gets one

⛔ **Zero tests assert the thinking block.** `grep -rn "thinking-trigger|thinking-row"` across every
suite → **0 matches**. Reasoning is not one of `RunCard.characterization.test.tsx`'s eight
characterized states. ⛔ **Zero tests assert the scroll effect's behaviour** either —
`MessageList.test.tsx:61-65` stubs `scrollIntoView` to a **no-op**, so nothing in the tree can see
how many times the effect scrolls or with which `behavior`.

⇒ *"the extraction changed no pixel"* is currently an **assertion, not a measurement**.

⭐ **Phase 227 already solved this on this exact file** and its template is the instruction:
characterization cases written against the **unmoved** `RunCard` first, then the code moves and the
cases must still pass. **Write the net before the move, not after.**

⚠ And D-243-05's RED drive has a precise target: the re-arm condition at
`hooks/useFollowScroll.ts:196-201`, with `useFollowScroll.test.ts:191-227` as the case shape to
**extend** — never a new mechanism.

### D-243-17 — Gate-knob shapes, measured

- `BASELINE` — `scripts/vitest-count-gate.cjs:122`, keyed by **bare filename** (unique tree-wide).
- `TARGETS` — `:3637`, keyed by **frontend-relative path**.
- ⚠ **`src/components/chat` has NO directory entry** — all 21 chat entries are file-level, so a new
  suite is invisible to both knobs until it is added to each **by hand**.
- ⛔ **`src/providers` is in NEITHER knob** — **every `StreamsProvider` suite is currently ungated.**
  A plan touching `StreamsProvider` and relying on an existing suite to catch a regression is
  relying on a suite the gate does not run.

### D-243-18 — The gate is RED at the base commit

See `243-BASELINE.md`. `total 7940 · failed 2 · pinned total 7170`, both failures inherited and in
`library/__tests__/sketchComposition.test.tsx`. ⛔ **`count gate OK` is NOT a reachable acceptance
criterion here.** Criteria are written as a **set diff** against that file plus the explicitly-run
in-scope suites.

## Non-goals — explicit scope fences

| Not in this phase | Why |
|---|---|
| Restyling, re-ordering or re-labelling any **tool row** | ⛨ operator constraint, sketch 234 |
| Flipping the fold's **default open** | ⛔ operator, 2026-09-11 — folded at rest AND while streaming |
| A `count` on the thinking `FoldTrigger` | reasoning has no countable unit; inventing one is fabricated precision |
| A **second** reasoning renderer, or a footer variant | sketch 235 rejected C; Phase 095 build-once inventory rule |
| Any streaming-architecture rewrite | D-14 red line, D-243-08 |
| Reviving the E2E suite | `SEED-049`, deferred by decision — D-243-09 |
| `BUG-260906-01` (context trim drops the user's own question) | visible **inside** sketch 234's real sample; a real open bug, and **not this phase's** |
| The `SHELL-*` chat-shell/composer work | Phase 244. ⚠ **243 and 244 must never hold the chat frame open simultaneously** |

## UAT — the 4-axis bandwidth (SC#10) and the G-4 lived-experience rows

⚠ **G-4 fires: this phase touches user-visible UI.** These rows are authored here, at scope
time, not post-hoc — that is the whole point of the rule. They belong in `243-VALIDATION.md`.

### Cross-provider — reasoning is a PROVIDER-SHAPED feature, so the roster is not optional

Derive the roster from `MODEL_CAPABILITIES`, newest registry-backed model per provider; never
re-type the list. ⚠ **A row with no key configured is recorded ⛔ with the reason — never
silently omitted.** ⚠ **Only some providers emit reasoning at all**; a provider that emits none
is a legitimate ⛔ row **with the reason "emits no reasoning_content"**, and it still proves the
non-reasoning path did not regress.

| # | Provider | What this row proves |
|---|---|---|
| 1 | OpenAI | |
| 2 | Anthropic (native SDK) | |
| 3 | Google | historically the highest-risk row for tool-call emission |
| 4 | DeepSeek | ⭐ **the original `reasoning_content` provider** — Phase 076.2 built this surface for it |
| 5 | Zhipu / GLM | |
| 6 | MiniMax | |
| 7 | Moonshot / Kimi | the only `emit_tier: coerce` native rows |
| 8 | OpenRouter | `native_tools: False` — the non-native tool path |

### The other three axes

| Axis | Row |
|---|---|
| **Multi-tool** | one prompt exercising 2+ tools (`search_documents` + `execute_code`) — proves the thinking block sits above **multiple** tool rows without disturbing them |
| **Parallel-thread** | Thread A streaming reasoning while Thread B accepts a new prompt |
| **Long-message** | ≥ 50 prior messages **or** a ≥ 5 KB prompt — ⭐ **criterion 3's scroll fix must be verified on a LONG thread**; the ROADMAP names "verified once by hand and never on a thread with fifty messages" as a failure mode |

### The G-4 "I'd recognise failure here" rows — driven in a real browser

| # | Scenario | Recognisable failure |
|---|---|---|
| **L-1** | Watch a slow reasoning model stream. | The fold control **churns** / the line flickers per token → CHAT-02 unfixed |
| **L-2** | Same run: scroll up mid-tool-call and **stay there** through the rest of the call and the tokens that follow. | Dragged back down → CHAT-03. ⚠ **On a ≥ 50-message thread**, not a fresh one |
| **L-3** | Ask a reasoning model a plain question that calls **no tools**. | No thinking shown at all → CHAT-04 |
| **L-4** | Start a run, navigate away, come back **without reloading**. | Final answer still folded in narration → CHAT-05 |
| **L-5** | Open the fold on a **33k-char** reasoning body, then on a **198-char** one. | The tail is unreadable, or the short one looks truncated → D-243-03 |
| **L-6** | Put the shipped surface beside `sketches/234-the-thinking-block/index.html`. | They disagree → sketch-to-build drift, criterion 1 |

⚠ **A UAT row may be recorded as owed, and closing the phase with owed rows is legitimate — but
it is stated as a DECISION, never as a claim that everything ran.**

## ## How we'd know this failed

Carried verbatim from the ROADMAP, because failure criteria written at scope time are the ones
that bind:

- The thinking block is restyled and the **flicker survives** — because the repaint cadence was
  never touched, only the CSS.
- `CHAT-02` and `CHAT-03` land in different plans that do not see each other, the smooth-scroll
  branch gets fixed twice with opposite intent, and **the pin re-arms again**.
- The scroll fix works while streaming and **breaks the settled view**, or works on a short
  thread and **fails on a long one** — because it was verified once by hand.
- The sketch is approved and **the build drifts from it**, and the phase closes against a
  description of the mockup rather than the mockup.
- **A green composition fence coexists with the shipped defect** because it asserts presence by
  `data-testid` while the content drifts.
- Reasoning appears on pure-text replies but **the streaming cursor, the narration banner or the
  citation branch regress** with it, and nobody notices because the criteria only asked about
  reasoning.

⭐ And one this phase adds, from D-243-05:

- **CHAT-03 is "fixed" against a stale bug report** — the named root cause was repaired at Phase
  228, so a plan that patches `beginProgrammaticScroll`'s one-frame flag is patching code that
  does not exist, and the fence it writes is green because it tests nothing.

## Plan shape — G-8 target 3-5, ceiling 6

The ROADMAP's per-phase target is **4-5**. The natural decomposition, with D-243-04's
non-splittable pair kept whole:

| | Plan | Carries | Note |
|---|---|---|---|
| 1 | **The `ThinkingBlock` extraction** — out of `RunCard`, mounted in `MessageItem`, both shapes | CHAT-01 (structure), CHAT-04 | it is the seam every other plan builds on; **it lands first** |
| 2 | **The cadence and the scroll** — coalesce the delta path, then the `messages`-dependent effect | **CHAT-02 + CHAT-03 together (D-243-04)** | must not be split |
| 3 | **The answer out of the fold** | CHAT-05 (+ CHAT-01's live half) | depends on plan 1's mount order |
| 4 | **V1's visual diff + the clamp** — the four classes, `text-sm`, `"Thought for N seconds"`, the sketch-050 clamp | CHAT-01 (appearance) | depends on plan 1; may fold into plan 1 if they share a worktree |

⚠ **This is a suggestion to the planner, not a decision.** Two plans touching adjacent files in
one wave are **one plan with two tasks** (G-8). Above 6 plans, name in this file what genuinely
cannot share a worktree.

⛔ **NEVER cut, at any plan count:** the verifier, the TDD RED drives, `security_enforcement` /
`code_review`, migration discipline. The lever is targeted suites per task with FULL gates once
per wave — never the agent roster.

## Migrations

**None expected.** This phase is frontend-only. If a plan discovers it needs one, that is a
scope change and it is stated, not absorbed.
