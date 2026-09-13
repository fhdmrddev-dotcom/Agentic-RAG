---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
plan: 04
subsystem: frontend/chat
tags: [CHAT-01, sketch-234-V1, clamp, honest-duration, D-243-02, D-243-13]
requires:
  - "243-02 — `ThinkingBlock.tsx` as the ONE reasoning renderer, mounted from `MessageItem`"
  - "243-03 — the producer-side delta coalescer, which the span stamp must sit ABOVE"
provides:
  - "Sketch 234 V1's shipped surface: real paragraphs, body font, no nested scroller"
  - "A clamp whose control REMOVES ITSELF below the measured threshold"
  - "`Thought for N seconds` when the span was measured, and no number when it was not"
  - "`Message.reasoningMs` — one optional CLIENT-ONLY field whose ABSENCE is the contract"
  - "SEED-269 — the owed single home for three near-duplicate elapsed formatters"
affects:
  - "frontend/src/components/chat/ThinkingBlock.tsx"
  - "frontend/src/providers/StreamsProvider.tsx"
  - "frontend/src/types/index.ts"
  - "frontend/src/components/chat/MessageItem.tsx (DEVIATION — not in files_modified)"
tech-stack:
  added: []
  patterns:
    - "sketch-050 clamp mechanism, COPIED not mounted (UserMessageBubble is violet-bound in 4 places)"
    - "RunCard.tsx:181-186's honesty rule applied to a second value"
key-files:
  created:
    - "frontend/src/components/chat/__tests__/ThinkingBlock.clamp.test.tsx"
    - ".planning/seeds/SEED-269-one-home-for-the-elapsed-formatter.md"
    - ".planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/deferred-items.md"
  modified:
    - "frontend/src/components/chat/ThinkingBlock.tsx"
    - "frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx"
    - "frontend/src/__tests__/providers/streamsProvider_243_cadence.test.tsx"
    - "frontend/src/providers/StreamsProvider.tsx"
    - "frontend/src/types/index.ts"
    - "frontend/src/components/chat/MessageItem.tsx"
    - "scripts/vitest-count-gate.cjs"
    - "docs/HOT-FILE-LEDGER.md"
    - "CLAUDE.md"
    - ".planning/reported-bugs/BUG-260718-02.md"
decisions:
  - "D-243-13 honoured: the span is a CLOCK READING or it is absent. `grep -c '/ 180'` is 0."
  - "The clamp measures `scrollHeight > CLAMP_MAX_PX`, NOT `> clientHeight` — the bubble's form needs the cap applied before it can measure, which would leave the cap on a 198-char body forever."
  - "The elapsed-formatter extraction stays CLOSED; the third file-local helper is accepted and owed at SEED-269."
  - "BUG-260718-02 → `folded`, NOT `closed`: the code half is measured, the perceptual half is owed to G-4 UAT."
metrics:
  duration: "~2h"
  completed: 2026-09-11
---

# Phase 243 Plan 04: V1's thin rule, the clamp, and an honest label — Summary

The reasoning block now looks like the operator-approved mockup — the model's own prose, in the
body font, as real paragraphs, with no scrollbar inside a scrolling conversation, a tail treatment
whose control removes itself on the common case, **and a duration that is measured or absent and
never inferred from string length**.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `b9819b7ab` | V1's thin rule — four classes out, real paragraphs in |
| 2 | `96ca3909c` | The clamp — and the control that removes itself |
| 3 | `2a988c3de` | An honest `Thought for N seconds` — measured, or absent |

---

## ⚖ MECHANICAL vs JUDGEMENT (D-243-12)

**MECHANICAL — a command decides, and the command is quoted below:** the class-token set diff; the
`/ 180` grep; the `dangerouslySetInnerHTML` / markdown-pipeline greps; the empty `supabase/`,
`backend/`, `RunCard.tsx` and `MessageList.tsx` diffs; the pin greps; the count-gate verdict line;
the typecheck set diff; the ledger and CLAUDE.md-size gates; the RED runs (a failing assertion is a
measurement, not an opinion).

**JUDGEMENT — a person decided, and the reason is written down:**

| Decision | Judgement made |
|---|---|
| Clamp measures against the **cap**, not `clientHeight` | The bubble's form is circular here; the sketch's `chars < 700` is a proxy for a measurement, so the measurement is what shipped |
| `Show less` as the collapsed-form label | The sketch names no word; the shipped clamp's word was reused rather than a third phrase invented |
| Clamp lives **inside** the fold, not replacing it | Two nested affordances, decided rather than discovered |
| `Math.max(1, …)` floor on the label | The one part of `index.html:338` worth keeping — it is about grammar, not about where the number came from |
| `BUG-260718-02` → `folded`, not `closed` | The reported defect is a perception; every piece of evidence here is synthetic |
| Extraction closed, SEED-269 planted | Mechanical *reason* (files_modified / ledger-gate blindness), but the call to accept the debt is a judgement |
| Accepting the `StreamsProvider.tsx` EOL normalization | See "Measured side effects" below |

---

## Task 1 — V1's thin rule

### The RED, before the production edit

```
× §5 — the reasoning body's class tokens: V1's set, changed here by the ONE plan permitted to
  AssertionError: expected [ 'px-3', 'py-2', 'text-xs', …(9) ] to include 'text-sm'
× §5b-i   AssertionError: expected [] to have a length of 2 but got +0
× §5b-ii  AssertionError: expected [ 'px-3', 'py-2', 'text-xs', …(9) ] to not include 'overflow-y-auto'
× §5b-iii AssertionError: expected [] to have a length of 1 but got +0
× §5b-iv  AssertionError: expected '' to contain 'First thought.'
Tests  5 failed | 22 passed (27)
```

### The class-token set diff, re-derived

```bash
$ grep -o 'font-mono\|whitespace-pre-wrap\|max-h-64\|overflow-y-auto\|text-xs\|text-sm\|border-l-2\|ml-3' \
    frontend/src/components/chat/ThinkingBlock.tsx | sort | uniq -c
      1 border-l-2
      1 ml-3
      1 text-sm
      1 text-xs
```

Against V1's diff table: **`font-mono`, `whitespace-pre-wrap`, `max-h-64`, `overflow-y-auto` are
GONE (0 each)**; `text-xs` → `text-sm` on the body; `border-l-2` and `ml-3` STAY. ⚠ **The single
`text-xs` is the CLAMP CONTROL, not the body** — the sketch's own `.moretog{font-size:var(--text-xs)}`
(`index.html:143`). §5 asserts on `data-testid="thinking-body"`, so the two cannot be confused.

⭐ **The grep is exact only because the prose was de-tokenised.** The first pass read
`1 max-h-64 · 1 overflow-y-auto · 1 whitespace-pre-wrap · 2 text-xs` — every one of them in a
COMMENT I had just written explaining what was dropped. **A comment naming a dropped token makes
the acceptance count read as though the token still shipped**, which is this file's own 187-24 trap
one register over. The component docblock now states the rule so the next editor does not re-add it.

Also mechanical: `grep -c "dangerouslySetInnerHTML"` → **0**;
`grep -c "MarkdownRenderer\|CitedMarkdown\|dedupParagraphs"` → **0** (the answer-dedup helper is
described without being named, same grep reason);
`grep -c "cancelRun(\|stopThread(\|stopStream(\|lock.runId"` → **0** (the `WorkspacePanel` raw sweep).

### The paragraph cases assert element COUNT and per-element text

```tsx
expect(ps).toHaveLength(2)
expect(ps[0].textContent).toBe(TWO_PARAS[0])
expect(ps[1].textContent).toBe(TWO_PARAS[1])
```

and the scroller case asserts the token SHAPE, not one literal spelling:

```tsx
expect(tokens.filter((t) => /^max-h-/.test(t))).toEqual([])
expect(tokens.filter((t) => /^overflow-/.test(t))).toEqual([])
expect(screen.getByTestId("thinking-body").textContent?.length).toBeGreaterThan(30_000)  // positive control
```

### Every other 243-01 case still passes

`git diff` over the suite touches **§5 (replaced), §5b (new), §10's needle + §10b (see Deviation 1),
and the docblock**. §1a-d, §2, §3, §4a-b, §6a-e, §7, §8, §9, §10a, §10c, §11, §12, §13 are
byte-unchanged and green. ⭐ **§1c/§1d/§3/§4b survived the render change untouched for a reason
worth recording:** testing-library's `getByText` matches on `getNodeText`, which concatenates only
DIRECT text-node children — so a `<div>` whose only child is a `<p>` does not match, and the
assertions landed on the paragraph with its `textContent` (newlines included) intact.

⛨ **No tool row was restyled, re-ordered or re-labelled.** `git diff --stat` names no tool-row file
across all three commits; the `ThinkingBlock.tsx` diff contains no tool-row markup.

---

## Task 2 — the clamp, and the control that removes itself

### The RED

```
× §1 AssertionError: expected [ 'px-3', 'py-2', 'text-sm', …(5) ] to include 'max-h-[300px]'
× §2 TestingLibraryElementError: Unable to find an element by: [data-testid="thinking-clamp-toggle"]
× §4 AssertionError: expected undefined to be 'Show all of it'
× §5 TestingLibraryElementError: Unable to find an element by: [data-testid="thinking-fade"]
× §6, §7 …
Tests  6 failed | 1 passed (7)
```

⚠ **§3 passed in the RED run, and that is stated rather than hidden.** It asserts ABSENCES, which
were already true with no clamp implemented. It becomes non-vacuous only once §1/§4 pass — which
they now do — and it carries a positive control (`…textContent).toContain("retention policy")`) so
it is measured against a rendered subtree rather than against nothing.

### Both ends of the spread, measured

| Fixture | `.length` | Overflow spy | Result |
|---|---|---|---|
| `REASONING_LONG` | **32,951** | forced | clamped · fade · `Show all of it` |
| `REASONING_MEDIAN` | **197** | none | **no control, no fade, no cap** |
| `REASONING_SHORT_BUT_TALL` | **117** | forced | clamped + control — the gate is the MEASUREMENT |

### The self-removal proof

```tsx
// §3 — the median 198-char body
expect(screen.getByTestId("thinking-body").textContent).toContain("retention policy")  // positive control
expect(control()).toBeNull()          // ⛔ ABSENT, not hidden
expect(screen.queryByTestId("thinking-fade")).toBeNull()
expect(bodyTokens()).not.toContain("max-h-[300px]")
```

`toBeNull()` on a `queryBy` is the only assertion that separates *gone* from *styled invisible* —
which is exactly what distinguishes this clamp from `CandidateCard.tsx:104` and
`CitationCard.tsx:196-205`, both of which mount their toggle unconditionally.

### The threshold, and why it is not the sketch's number

`CLAMP_MAX_PX = 300` (sketch `index.html:139`). ⚠ **The sketch decides by character count
(`chars < 700`); the implementation decides by measurement**, and §4 proves it: a **117-char** body
that is forced to overflow still gets the control. If a later implementation hard-codes a character
threshold, §4 reds and its comment says it must then be rewritten to say so rather than quietly
relaxed.

Other mechanical results: `grep -c "useLayoutEffect"` → **3** (≥ 1 required);
`grep -c "hsl(258"` → **0**; `grep -c "ThinkingBlock.clamp.test.tsx" scripts/vitest-count-gate.cjs`
→ **exactly 2** (TARGETS `:4742`, BASELINE `:2947`). The pin `7` was read from the gate's own row:

```
  ThinkingBlock.clamp.test.tsx                  —       7     new
```

⚠ **That grep read 3 on the first attempt**, because my pin comment spelled the filename. Same trap
as Task 1's class tokens; the comment now says why the name is omitted.

### ⚠ Two measured surprises

1. **`useLayoutEffect` did not fire.** `CollapsibleContent` renders no children while shut, so at
   mount `bodyRef.current` is `null` and there was nothing to measure — and with `[reasoningContent]`
   alone in the deps the effect never ran again once the body appeared. `thinkingOpen` is now in the
   deps, and **because D-243-02 keeps the fold closed by default that is the ordinary path, not an
   edge case.**
2. **`Show all of it` is NEW COPY and the component says so.** `Show all` exists at three sites in
   this tree, none a text-clamp control; the shipped clamp says `Read more`. The reuse is the
   MECHANISM, never the string.

---

## Task 3 — the label: measured, or absent

### The RED, all arms before any production edit

Component arms (`ThinkingBlock.characterization.test.tsx` §14):
```
× §14a AssertionError: expected 'Thinking' to be 'Thought for 6 seconds'
× §14b AssertionError: expected 'Thinking' to be 'Thought for 1 second'
× §14f AssertionError: expected 'Thinking' to be 'Thought for 6 seconds'
Tests  3 failed | 30 passed (33)
```
Provider arms (`streamsProvider_243_cadence.test.tsx` §10):
```
× §10a, §10b, §10e, §10f        Tests  4 failed | 11 passed (15)
```
⚠ **§14c / §14d / §10c / §10d passed in RED** — they are the REFUSAL arms, and a refusal is
trivially satisfied by an unimplemented feature. They became non-vacuous the moment the positive
arms went green, which is the pairing that makes them evidence.

### The stamp sites

| Moment | Site | Why there |
|---|---|---|
| **start** | `onReasoningDelta`, first line of the **RAW** callback | ⛔ Inside the coalesced flush it would date the span from the WINDOW, late by up to `DELTA_COALESCE_MS` |
| **end (usual)** | `onDelta`, guarded by `!sawContentDelta`, **before** `pendingContent += delta` | Reasoning ends when the answer begins |
| **end (quiet)** | `onDone` | Reasoning that never yields a content delta still ends |
| **write** | `applyPendingDeltas` (rides the existing update) **+** `onDone`'s bookkeeping update | ⚠ `flush()` applies only when a window was OPEN, so a span closed on a quiet terminal edge would otherwise never land |

`closeReasoningSpan()` is idempotent (`reasoningSpanSettled`), fenced by §10d: a late interleaved
reasoning block must not re-open it, or the value drifts toward the whole-run duration D-243-13
rejects. ⛔ **No timer, no tick** — a live-ticking span would re-introduce the per-token repaint
CHAT-02 had just removed.

### The no-duration fallback, at both ends of the 170× spread

```tsx
// §14c — the median, DB-loaded (no measured span)
expect(triggerText()).toBe("Thinking")
expect(triggerText()).not.toMatch(/\d/)

// §14d — 32,951 chars, no measured span. ⭐ The scale at which the lie looks most convincing.
expect(triggerText()).toBe("Thinking")
expect(triggerText()).not.toMatch(/\d/)
expect(REASONING_LONG.length).toBeGreaterThan(30_000)
```

⭐ **Under the sketch's `Math.max(1, Math.round(chars / 180))` that §14d fixture computes to
`Thought for 183 seconds`** — derived, verbatim, from `32951 / 180`. It is a plausible-looking
number with no relationship to anything the model did. §10f is the same refusal at the producer
end: a 33,713-char reasoning body measured over 1 s reports ~1 s.

```bash
$ grep -c "length / 180\|/ 180" frontend/src/components/chat/ThinkingBlock.tsx \
    frontend/src/providers/StreamsProvider.tsx
frontend/src/components/chat/ThinkingBlock.tsx:0
frontend/src/providers/StreamsProvider.tsx:0
```

### ⛔ No migration, no backend change, no wire field

```bash
$ git diff --stat -- supabase/      # (empty)
$ git diff --stat -- backend/       # (empty)
```

The type addition is exactly one optional field:

```diff
   reasoningContent?: string
+  /** Phase 243 Plan 04 (D-243-13): how long the model spent REASONING on this turn, in ms —
+   * MEASURED ON THE CLIENT during a live stream … ⛔ CLIENT-ONLY. There is no column for it and
+   * no wire field … that ABSENCE is load-bearing rather than incidental …
+   * ⛔ Never derive it from `reasoningContent.length` … */
+  reasoningMs?: number
```

### ⛔ The extraction stayed CLOSED

```bash
$ git diff --stat -- frontend/src/components/chat/RunCard.tsx frontend/src/components/chat/MessageList.tsx
                                    # (empty)
```

The third file-local helper (`thoughtForLabel`) is accepted, named in a code comment with the
mechanical reason, and **`SEED-269` is planted** with an acceptance criterion so it can be answered
rather than re-proposed. Its frontmatter:

```yaml
seed_id: SEED-269
title: Three file-local elapsed formatters now ship — one home is owed, and the third was
       accepted deliberately rather than overlooked
created: 2026-09-11
planted_during: Phase 243 (CHAT-01) — plan 243-04 task 3, at the moment the third one was written
status: planted
folded_into: null
priority: low
surface: Agentic-RAG
severity: trivial
relates_to: [RunCard.tsx:588-594, MessageList.tsx:49-58, ThinkingBlock.tsx thoughtForLabel]
trigger_when: >
  THE NEXT PHASE WHOSE `files_modified` NAMES ANY OF `RunCard.tsx`, `MessageList.tsx` OR
  `ThinkingBlock.tsx` … It fires EARLIER if a FOURTH formatter is about to be written.
```

⭐ The seed carries the **differences table** for the three sites, because a
lowest-common-denominator `formatElapsed` would be a behaviour change dressed as tidiness — none of
the three emits the same string, and `ThinkingBlock`'s unit (whole seconds, pluralised, floor of 1,
no minute form) is neither existing formatter's output.

---

## ⚠⚠ THE DECLARED DIFFERENCE FROM THE ACCEPTANCE BAR

Written verbatim for `243-VERIFICATION.md` to carry:

> **The mockup reads `Thought for 6 seconds` on every message, including historical ones. The
> shipped surface reads `Thinking` on any message it did not watch stream — a reload, a navigation,
> a message loaded from the database. That difference is deliberate, and its reason is D-243-13:
> the sketch derives its number from the character count (`index.html:338`,
> `Math.round(chars / 180)`), which is a demo affordance so the mockup reads plausibly at every
> Scale setting, not a design decision. There is no persisted source to swap in —
> `messages.reasoning_content` is the only reasoning column and `RunCard`'s elapsed measures the
> whole run, tool calls included — so the span is measured live on the client and is simply absent
> on a message this client never watched. Showing nothing is `RunCard.tsx:181-186`'s own honesty
> rule, the one `BUG-260606-02`'s "1440m" lie paid for, applied to a second value.**

**An undeclared difference from the bar is drift; this one is a decision.** Every OTHER difference
from `index.html` §V1 would be drift.

---

## BUG-260718-02 — `folded`, NOT `closed`

**No prior plan flipped this frontmatter** (`BUG-260823-01` is 243-03's, `BUG-260707-03` is 243-05's
— this one was nobody's), so it would have stayed `open` forever while its substance shipped.

**Part A, row by row against its own 2026-09-11 table:** the flat `whitespace-pre-wrap font-mono`
blob → ✅ closed by `b9819b7ab`; the 16rem nested scroller → ✅ closed by `96ca3909c`; per-token
`setMessages` → ✅ closed by 243-03's `bfdf899b1`; the per-token auto-scroll → ✅ `bfdf899b1` +
`8d7dfab43`; `throttle.ts` on the cache writer only → ✅ `bfdf899b1`. Part B was already fixed
before the phase.

**⛔ So why not `closed`?** Because the reported defect is a PERCEPTION — *"re-renders rapidly and
feels janky"* — and **every piece of evidence above is synthetic**: fake timers for the cadence,
synthetic `WheelEvent`s for the scroll. **243-03's own SUMMARY refused to close `BUG-260823-01` for
exactly this reason** (*"this file's own history records two fixes that passed those and failed a
real mouse"*), and holding this report to a weaker standard on the same mechanism would be
incoherent. `status: folded` says precisely what is true: a phase claimed it and shipped, and the
claim is not yet verified. `verified_closed_by` stays `null`; a `re_open_trigger` naming the G-4
UAT row was added.

---

## Ledger updates (same commit, `2a988c3de`)

| File | Was | Now (re-derived) | Disposition |
|---|---|---|---|
| `StreamsProvider.tsx` | `89 / 36 / 4325` | **`90 / 36 / 4380`** | ⚠ STALE TWICE — and the second stale row was written **one plan earlier the same day** |
| `types/index.ts` | `78 / 60 / 1331` | **`85 / 65 / 1380`** | ⚠ STALE by **7 commits, 5 phases**. FIRES at 65, seam still OWED |
| `MessageItem.tsx` | `67 / 33 / 726` | **`68 / 33 / 727`** | G-5 discharged (227-03); not re-hollowed |
| `ThinkingBlock.tsx` | `1 / 1 / 117` | **`4 / 1 / 283`** | still one phase BY DESIGN; **+166 L in a single phase** |

⚠ **A derivation disagreement, recorded rather than reconciled silently:** the plan's `<interfaces>`
block measured `types/index.ts` at **66 phases**; the recipe run here reads **65**. The whole gap is
the dated quick-task bucket `260405`, which the recipe says to subtract. Both figures are in the
detail section so the next reader can reproduce either.

Sections added/updated in `docs/HOT-FILE-LEDGER.md` for all four (same-commit sync rule); every
CLAUDE.md disposition cell is ≤ 200 chars.

```
$ node scripts/check-hot-file-ledger.cjs 243   → ledger gate OK — every watched file has a row.
$ node scripts/check-claude-md-size.cjs        → 88138 chars · 58.8% of limit · OK
```

---

## Gates

**Count gate — the verdict line, verbatim:**

```
  total                                      7244    8017    +773
  total 8017  ·  failed 0  ·  pinned total 7244
count gate OK — 254/254 pinned files present, no per-file decrease, 0 failing.
```

Baseline before this plan (same machine, same day): `total 7994 · failed 0 · pinned total 7221 ·
253/253`. **Set diff of the failing set: EMPTY at both ends** — a subset of the two permitted
inherited `sketchComposition` cases, and in fact none. Pinned total `+23` and pinned files `+1` are
fully attributed: the new clamp suite (7 cases, +1 file), `ThinkingBlock.characterization` 23 → 33
(+10: four §5b, six §14), `streamsProvider_243_cadence` 9 → 15 (+6: §10).

⚠ **ONE INTERMEDIATE RUN READ `failed 3`, AND THE SET WAS RECOVERED RATHER THAN GUESSED.** It was
captured from the gate's **own persisted JSON report** (`vitest-count-gate-15172-*.json`):

| # | File | Case | Failure |
|---|---|---|---|
| 1 | `library/__tests__/sketchComposition.test.tsx` | §2 — the page renders its heading | `STACK_TRACE_ERROR` |
| 2 | `library/__tests__/sketchComposition.test.tsx` | §2 — the four shipped tab triggers render | `Found multiple elements with the role "tab"` |
| 3 | `pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `STACK_TRACE_ERROR` |

Rows 1-2 are the baseline's two named inherited cases. **Row 3 is `SEED-171`'s FIFTH named
cap-independent flaky suite**, byte-unchanged by this plan (the whole diff is
`ThinkingBlock.tsx` + `MessageItem.tsx` + `StreamsProvider.tsx` + `types/index.ts` + four
non-`WorkflowBuilderPage` suites + docs). The cap was **not** touched; it held at `2` throughout.

⛔ **A procedural miss, recorded because 193.2-02 recorded the same one:** I re-ran the gate BEFORE
capturing that set — my first invocation was piped through a `grep` that dropped the failing
filenames. The set above is a recovery from the persisted artefact, not a capture. **It happens to
be complete, and that is luck rather than method.**

**Typecheck — a SET DIFF, not a count:**

```
base=67 head=67
--- NEW (in head, not in base) ---     (empty)
--- GONE ---                           (empty)
```

(`npx tsc -p tsconfig.app.json --noEmit` — ⚠ not the vacuous solution-style `tsc --noEmit`.)

---

## Deviations from Plan

### 1. [Rule 3 — blocking] §10's render needle matched ZERO files after the authorised §5 change

- **Found during:** Task 1, immediately after the production edit.
- **Issue:** `§10c` failed `expected [] to have a length of 1`. `RENDERS_REASONING` matched a JSX
  child interpolation `{reasoningContent}`; V1's body renders `{toParagraphs(reasoningContent).map(…)}`,
  so the uniqueness fence saw **no renderer at all** — a fence about "exactly one" quietly became a
  fence about zero.
- **Fix:** re-aimed as an **alternation of two NAMED render shapes**, with the RED quoted at the
  needle. ⛔ **NOT** widened to `\{[^}]*reasoningContent[^}]*\}` — measured, that looser form matches
  **both** innocents in the tree (`RunCard.tsx:487`'s state-2 guard and `MessageItem.tsx:612`'s
  banner-label call), turning a uniqueness fence into one that reds on correct code. §10b gained
  four controls: two positives for arm 2 and both innocents as negatives.
- **Why this is not a fence edited to keep passing:** the uniqueness claim is unchanged and the
  discrimination is strictly stronger. The suite docblock records it as a third authorised edit.
- **Files:** `ThinkingBlock.characterization.test.tsx` · **Commit:** `b9819b7ab`

### 2. [Rule 3 — blocking] `MessageItem.tsx` had to take the new prop and is NOT in `files_modified`

- **Issue:** the plan puts the label in `ThinkingBlock` and the span on `Message`. The mount is in
  `MessageItem.tsx`, which the plan's `files_modified` does not name — so the prop could not be
  passed without touching an unlisted, **G-5-firing** file.
- **Fix:** made the one-line edit **and updated its CLAUDE.md row + `docs/HOT-FILE-LEDGER.md`
  section in the same commit**, honouring D-243-07 rather than relying on the ledger gate (which
  reads `files_modified`, not the diff, and would have exited 0 over the omission).
- ⭐ **This is the identical hazard the plan's own Task-3 reasoning uses to CLOSE the formatter
  extraction** — and it arrived anyway, from the other direction. The response was to record, not
  to route around.
- **Files:** `MessageItem.tsx`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md` · **Commit:** `2a988c3de`

### 3. [Decision] The provider-stamp cases live in `streamsProvider_243_cadence.test.tsx`, not the characterization net

- **Reason:** the stamp is delta-path behaviour, and that suite already owns the
  `makeStreamCallbacks` harness plus the hoisted `@/lib/api` + `@/lib/supabase` module mocks.
  Importing the provider into the characterization net would have forced those mocks onto 33
  component cases that render `MessageItem` (which imports `@/lib/api`) — a far larger blast radius
  than the thing under test. The LABEL arms did go in the net (§14).
- The suite's own docblock records the deviation; its pin was raised 9 → 15.

### 4. [Rule 1 avoided — out of scope] One inherited red in a suite NEITHER gate knob names

`frontend/src/__tests__/components/Plan04.frontend.test.tsx` §"Atom C" fails
`expected '' to contain 'text-emerald-400'`. **Not mine and not new:** `grep -c "Plan04.frontend"
scripts/vitest-count-gate.cjs` is **0**, and `emerald-400` now lives only in `StepRow.tsx` — the
class moved when **Phase 227-02 decomposed `ToolCallPanel`** (`a743aeef4`), while the suite was last
touched at Phase 095-05 (`d1e724361`). Logged to `deferred-items.md`, **not fixed**. ⚠ The useful
finding is the shape: **a suite in neither knob is invisible to the gate, so a class rename can
orphan it for 16 phases while the verdict line still reads `count gate OK`.**

---

## Measured side effects

⚠ **`StreamsProvider.tsx`'s blob was normalized CRLF → LF, and the numstat for it reads
`4380 / 4325` rather than ~`35 / 3`.** Measured: `core.autocrlf` is `true`, this file was the **only
CRLF blob among 962 tracked frontend files** (`git ls-files --eol frontend/src` → `961 i/lf`,
`1 i/none`, `5 i/-text`), and `autocrlf` strips CRLF on add but never restores it — so re-creating
the outlier is not reachable from this config. **Accepted, and the cost is named: line-level
`git blame` on that file now points at `2a988c3de`.** `git log -- <file>` commit/phase counts (what
the ledger derives from) are unaffected. An attempted amend with the file rewritten as CRLF was
made and did not change the blob, which is how the cause was measured rather than assumed.

---

## Self-Check: PASSED

```
FOUND: frontend/src/components/chat/ThinkingBlock.tsx
FOUND: frontend/src/components/chat/__tests__/ThinkingBlock.clamp.test.tsx
FOUND: frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx
FOUND: frontend/src/__tests__/providers/streamsProvider_243_cadence.test.tsx
FOUND: .planning/seeds/SEED-269-one-home-for-the-elapsed-formatter.md
FOUND: .planning/phases/243-.../deferred-items.md
FOUND: b9819b7ab   FOUND: 96ca3909c   FOUND: 2a988c3de
```
