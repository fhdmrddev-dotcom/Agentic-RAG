---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
plan: 05
subsystem: frontend/chat
tags: [CHAT-05, CHAT-01, D-243-06, D-243-14, red-drive, navigation-path, gate-knobs, ledger]
requires:
  - "243-02 — `ThinkingBlock.tsx` mounted from `MessageItem` for both message shapes (the line the answer now sits below)"
  - "243-04 — the V1 thin rule, the span stamp and the clamp (the settled thinking line the order is asserted against)"
provides:
  - "CHAT-05's live half: a tool-bearing run writes its answer as the MESSAGE BODY, not inside the narration fold"
  - "MessageItem.answerOutOfFold.test.tsx — the only fence in the tree that drives the NAVIGATION path (a run terminating while its thread is not the mounted surface)"
  - "The measured verdict that BUG-260707-03 residual #2's RECONCILE half shipped at Phase 176 and was never re-measured"
  - "A document-order assertion for thinking -> tool rows -> answer (243-02 pinned the first half; this pins the second)"
affects:
  - "frontend/src/components/chat/MessageItem.tsx"
  - "frontend/src/components/chat/StreamingNarration.tsx (ZERO production callers after this plan — retirement OWED, not taken)"
  - "frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx (§11's anchor had to move — it used the fold as a proxy for the answer)"
tech-stack:
  added: []
  patterns:
    - "Set-diff triage against a byte-identical tree before attributing any red — 14 of 15 failures proven inherited by reverting ONE file"
    - "A fixture corrected to the DECLARED type after `tsc` caught it green-and-wrong (`status: \"completed\"` is not a ToolCall status)"
    - "Rejecting an alternative on a MEASURED ground (oscillation) recorded in the production docblock, not only in the summary"
key-files:
  created:
    - frontend/src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx
  modified:
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260707-03-final-answer-stays-folded-in-narration-until-reload.md
    - .planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/deferred-items.md
decisions:
  - "Task 1 OUTCOME 1 — branch only. The navigation path at the provider was GREEN on first drive; the reconcile half of residual #2 shipped at Phase 176 (RENDER-02 / D-07) and the routing note that called it owed was never re-measured."
  - "Option (b) taken: `StreamingNarration` loses this path entirely. Option (a) — a fold narrowed to `hasRunningTools` — was REJECTED on a measured ground: it oscillates once per iteration, and holding it open needs state, which re-hollows the 227 discharge."
  - "`StreamsProvider.tsx` was named in `files_modified` and needed NO edit. Said rather than absorbed (the 243-03 `MessageList.tsx` precedent)."
  - "BUG-260707-03 stays `folded`, NOT `closed` — every fence is synthetic and residual #1 (live verification) has been open since 2026-07-07."
  - "SEED-049 is NOT re-opened: criterion 5 WAS reachable from vitest (§6a/§6b drive it through the provider's own callbacks and reconcile). A G-4 browser row is still owed for the perceptual half."
metrics:
  duration: "~1h50m"
  completed: 2026-09-11
---

# Phase 243 Plan 05: The Answer Out of the Fold — Summary

**The RED drive's verdict, first, in one sentence: OUTCOME 1 — branch only.** `MessageItem`'s
`StreamingNarration` arm was the entire defect; the navigation path at the provider was driven
through its own callbacks and its own `reconcile` and was **GREEN on the first honest run**.

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `5e03d12b0` | `test(243-05): drive the branch AND the navigation path before fixing either` |
| 2 | `63e56e79f` | `feat(243-05): the answer stops being written inside the narration fold` |

Base: `develop` at **`4175f41b5`** (D-243-19: this is the EXECUTION base — not `96adfd668`, the
tree `243-BASELINE.md`'s gate figures were measured on, and not `149360176`, the tree the plans'
file:line triage was measured on). Main working tree, no worktree, no bootstrap.
`git status --porcelain -- frontend scripts docs CLAUDE.md .planning` was **EMPTY** before the first
edit. No foreign `frontend/` or `scripts/` change appeared at any point — the sibling Phase 242
session is backend/docs.

---

## 1. Task 1 — the three outcomes, and which one obtained

The plan named three, each with a different fix. **Outcome 1 obtained.**

| Outcome | What it would have meant | Measured |
|---|---|---|
| **1 — branch only** | `runStatus` is correctly terminal on return; the live-render branch is the whole defect | ⭐ **THIS ONE** |
| 2 — reconcile too | a message can come back still reading `"streaming"` | ❌ refuted — §6a and §6b both green against unmodified code |
| 3 — not reachable from vitest | the navigation path cannot be seen from this level; re-open `SEED-049` | ❌ refuted — it is reachable, and §6 reaches it |

### The RED run, quoted with case names and expected-vs-received

13 cases, run against **unmodified production code** (`git diff --stat -- frontend/src/components
frontend/src/providers` was EMPTY at task 1's close; the new file is untracked and appears in no
diff):

```
 FAIL  MessageItem.answerOutOfFold.test.tsx > §1 > renders every paragraph of the streaming content as real body text
TestingLibraryElementError: Unable to find an element with the text: Now I will search the knowledge base for the withholding figures.

 FAIL  MessageItem.answerOutOfFold.test.tsx > §1 > does not route the answer through the narration fold
AssertionError: expected false to be true // Object.is equality

 FAIL  MessageItem.answerOutOfFold.test.tsx > §2 > places the thinking trigger before the run card and the run card before the answer body
TestingLibraryElementError: Unable to find an element with the text: The withholding lines do not agree — invoice1092 shows a 230.00 gap.

 FAIL  MessageItem.answerOutOfFold.test.tsx > §5 > still routes a LIVE cited answer through the citation renderer, not the fold
AssertionError: expected <div data-state="closed" …(1)>…(2)</div> to be null

      Tests  4 failed | 9 passed (13)
```

The two `Unable to find an element` failures **are** the characterization of today, stated as a
received value rather than as a separate pinned case: on a live tool-bearing turn the whole blob
folds, Radix's closed `CollapsibleContent` does not mount, and only the last line survives in the
DOM — stripped to an italic gist inside the trigger. The §5 failure quotes that trigger verbatim in
its received value, gist text and all.

### ⚠ The FIRST red run was `5 failed | 8 passed` and one of the five was a HARNESS artifact — recorded, not hidden

§6b initially failed `expected 'streaming' not to be 'streaming'`. Rather than re-running or
reaching for the cap, it was **diagnosed**: the case printed
`DIAG snapCalls before/after: 1 1` — `getSnapshot` had been called **once in the whole test**, so
the navigate-back reconcile never fired at all and the assertion was measuring the in-flight guard.

**Cause, measured:** `reconcile` `await`s `getThreadWorkflow(threadId)` **inside**
`reconcileInFlightRef`'s window. Left unmocked, that runs a real jsdom `fetch`, the reconcile's own
try/catch swallows the 401, and the next navigation's reconcile short-circuits on the in-flight
bit. `MessageList.test.tsx:24-31` records the identical trap in as many words. Mocked, with the trap
named in the file. **The product was never at fault and no production line was written to make §6b
pass.**

### The navigation path was driven through the provider, not fixtured

§6a and §6b both construct their state by calling `setViewingThread` on the real `StreamsProvider`,
letting its `reconcile` discover the run from `active_runs`, and streaming deltas through the real
`makeStreamCallbacks` chain. **No hand-built message that already carries the answer appears
anywhere in §6.**

- **§6a** — the run's clean terminal arrives while the operator is viewing a *different* thread.
  `subscribeToRun`'s promise never resolves, which suppresses the `.finally()` `loadMessages`
  floor, so the ONLY thing that can settle the message is the provider's own terminal handling.
  → `runStatus === "completed"`, `content === CLEAN_ANSWER`. **GREEN.**
- **§6b** — the harshest reading: the run ends server-side and this client is told **nothing** (no
  terminal callback ever fires). The operator navigates back, and only `reconcile` can resolve it.
  → `runStatus` is not `"streaming"`, `content === CLEAN_ANSWER`. **GREEN.**

⭐ **So `BUG-260707-03` residual #2 was TWO things and only one was still owed.** The reconcile
half shipped at **Phase 176 RENDER-02 / D-07** — `StreamsProvider.tsx`'s mount-path `onTerminal`
carries the mirrored content-reconcile and `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx`'s
second `describe` already drove it. The 2026-09-11 routing note on the report says residual #2
*"still relies on a reload"*; **measured, it did not.** What remained was the render branch, which
no reload-flavoured wording would ever have named.

---

## 2. The fix, and the option that was rejected on a measured ground

`MessageItem.tsx`'s content ternary lost its first arm:

```tsx
isMessageStreaming && (message.tool_calls?.length ?? 0) > 0 && message.role === "assistant"
  ? <StreamingNarration content={dedupParagraphs(message.content)} />
```

A live tool-bearing turn now routes `message.content` through the **same two shipped renderers as
the settled answer** — `CitedMarkdown` when citations are present, `MarkdownRenderer` otherwise —
below the settled thinking line, with the streaming caret at the live edge. **No renderer was
introduced and no `dangerouslySetInnerHTML` was added** (T-243-05-01: `grep -c` over the diff is
`0`); the A23 / T-174-03-01 rule that server strings render as React text children is untouched.

**⛔ Option (a) — a fold narrowed to `hasRunningTools` — was considered and REJECTED on a measured
ground, not a taste one.** `content` accumulates across every iteration, so between tool N
finishing and tool N+1 starting the predicate flips false and the body swaps gist → blob → gist,
**once per iteration**. Holding it open across the gap needs new state in `MessageItem`, which is
precisely the re-hollowing the Phase 227 discharge forbids. The rejection is written into the
file's own docblock so a later plan does not "restore" the fold as tidiness.

**⚠ The original contract was kept verbatim in the docblock rather than deleted.** It read *"this
is the model's interim narration, not the final answer"* — half right, and the failing half is the
one that mattered: **the blob's TAIL is the answer, so folding the blob folds the answer.**

---

## 3. The document-order assertion (D-243-01)

Asserted by **document position**, twice, not by a visual claim:

- `MessageItem.answerOutOfFold.test.tsx` §2 — `compareDocumentPosition` proves
  `thinking-block` → `run-card` → the answer body, each `DOCUMENT_POSITION_FOLLOWING` the last.
- `ThinkingBlock.characterization.test.tsx` §11 — index order **and** `compareDocumentPosition`,
  with a positive control on every anchor.

### ⚠ §11's answer anchor had to move, and WHY is the finding

§11 located "the answer" as `indexOfTestId("streaming-narration")` — it used the **fold** as a
stand-in for the answer, and the answer being inside that fold **is** the defect CHAT-05 names.
Its own comment said *"243-05 owns it"*. The anchor is now the **rendered content**
(`textContent === "Assistant response text"` on a leaf node), not a `data-testid` — D-243-11, since
a presence assertion cannot see content drift. The original is recorded beside the replacement in
the test file, never over it.

---

## 4. The three collateral surfaces the ROADMAP names — each by name, with a suite and a result

> *"reasoning appears on pure-text replies but the streaming cursor, the narration banner or the
> citation branch regress with it, and nobody notices because the criteria only asked about
> reasoning."*

| # | Surface | Covering suite(s) | Result |
|---|---|---|---|
| 1 | **the streaming cursor** | `MessageItem.answerOutOfFold.test.tsx` §3 (3 cases: the caret renders on a live turn with no running tool; it sits AFTER the answer body in document order; it is still withheld while a tool is running) · `MessageItem.test.tsx` (24) · `MessageItem.sticky.test.tsx` (4) | ✅ **GREEN** |
| 2 | **the narration banner** | `StreamingNarration.test.tsx` (3, untouched) · `MessageItem.answerOutOfFold.test.tsx` §4 (2: it still folds a blob to its gist in its own right; it still self-guards on empty content) | ✅ **GREEN** — and the component is **byte-identical**: `git diff --stat -- frontend/src/components/chat/StreamingNarration.tsx` is EMPTY |
| 3 | **the citation branch** | `CitationList.test.tsx` (15) · `CitedMarkdown.test.tsx` · `AbsenceHint.test.tsx` · `CitationUI.a11y.test.tsx` · `CitationPeek.test.tsx` · `MessageItem.answerOutOfFold.test.tsx` §5 (3) | ✅ **GREEN** |

**The absence hint at the old `:450` gate renders identically before and after.** The gate
expression `!(isMessageStreaming && (message.tool_calls?.length ?? 0) > 0)` is **byte-unchanged** —
it reads the same predicate the removed arm read, and a change that did not consider it would have
flipped the hint's visibility as a side effect. Fenced both ways, and the cases are quoted:

- *"does NOT render the absence hint on a live tool-bearing run — the gate is unchanged"* →
  `expect(screen.queryByLabelText("About citations")).toBeNull()` — GREEN
- *"still renders the absence hint on the settled cited answer"* →
  `expect(screen.getByLabelText("About citations")).toBeInTheDocument()` — GREEN

### The full named sweep

27 suite files, **276 tests, 0 failed**: `MessageItem.test.tsx` · `MessageItem.clamp.test.tsx` ·
`MessageItem.fallbackNotice.test.tsx` · `MessageItem.finalOutputs.test.tsx` ·
`MessageItem.memo.test.tsx` · `MessageItem.sticky.test.tsx` · `MessageItem.harnessBanner.test.tsx` ·
`MessageItem.retry.test.tsx` · `MessageItem.capPaused.test.tsx` · `MessageItem.cancelledRun.test.tsx` ·
`MessageItem.blockedNotice.test.tsx` · `MessageItem.continueButton.test.tsx` ·
`StreamingNarration.test.tsx` · `CitationList.test.tsx` · `CitedMarkdown.test.tsx` ·
`AbsenceHint.test.tsx` · `CitationUI.a11y.test.tsx` · `CitationPeek.test.tsx` ·
`RunCard.characterization.test.tsx` · `ChatArea.approval.test.tsx` · `ChatArea.model.test.tsx` ·
`ChatAreaBanner.test.tsx` · `ChatAreaMode.test.tsx` · `MessageList.test.tsx` ·
`MessageList.scroll.test.tsx` · `WorkspacePanel.test.tsx` · `WorkspacePanel.derived.test.tsx`.
Plus this phase's own `ThinkingBlock.characterization.test.tsx` (33) and
`ThinkingBlock.clamp.test.tsx` (7) — both green.

### ⛔ Recorded as UNCHECKED, rather than implied

- **The live browser.** No Chrome MCP drive, no real Deep run. The G-4 row is owed and named in §7.
- **The E2E suite.** Rotted (`SEED-049`); not run, not revived — deferred by decision (D-243-09).
- **`Plan04.frontend.test.tsx`** — red at the base and still red; inherited, already recorded in
  this phase's `deferred-items.md` by 243-04, in **neither** gate knob.
- **`src/__tests__/providers/*`** — 13 cases red at the base and still red (see §5). In
  **neither** gate knob (D-243-17), so nothing this phase does can make them visible to the gate.

---

## 5. Triage of the 15 red cases seen after the fix — SET, never count

The first post-fix sweep read `15 failed | 700 passed`. **The count was not trusted and was never
used.** The failing **set** was captured, then the base set was measured on a tree differing by
**one file**: `MessageItem.tsx` was reverted with `git checkout -- <that one path>` (never a blanket
reset, never `git clean`), the identical command re-run, and the sets compared with `diff`.

```
SET DIFF: IDENTICAL — the 14 are inherited
```

- **14 inherited**, provably: 13 in `src/__tests__/providers/` (`streamsProvider.test.tsx`,
  `StreamsProvider.dedup.test.ts`, `streamsProvider_075_9_clientkey.test.tsx`) and 1 in
  `src/__tests__/components/Plan04.frontend.test.tsx`. **Byte-identical sets before and after.**
- **1 caused by this plan**, and legitimately so: `ThinkingBlock.characterization.test.tsx` §11 —
  the fence whose anchor was the fold. Repaired in §3 above.

⚠ **The honest phrasing is "provably unmodified by this plan", never "fine".** The 13 provider
cases are a standing red this plan does not own and did not fix (SCOPE BOUNDARY); they are
invisible to the count gate because `src/providers` and `src/__tests__/providers` sit in neither
knob — which is exactly the shape `SEED-222` and this phase's `deferred-items.md` already name.

---

## 6. Gates

### The count gate — verdict line read VERBATIM, from the repo root, `GSD_VITEST_MAX_WORKERS=2`

```
  total                                      7257    8030    +773
  total 8030  ·  failed 0  ·  pinned total 7257
count gate OK — 255/255 pinned files present, no per-file decrease, 0 failing.
```

| | `243-BASELINE.md` (2026-09-11, `96adfd668`) | **this close (`4175f41b5` + 2 commits)** |
|---|---|---|
| grand total | 7940 | **8030** |
| pinned total | 7170 | **7257** |
| failed | **2** | **0** |
| pinned files | — | **255/255** |

**The failing set is EMPTY, which is a SUBSET of the two inherited `sketchComposition.test.tsx`
cases** — the criterion `243-BASELINE.md` corrected itself into at `243-01`'s close. ⚠ **An empty
set is NOT a fix**: the inherited pair stands (`SEED-171`, seven suites, third reproduction on
2026-09-11), and a later run showing them again is the flake, not a regression. **The cap held at
`2` and was neither adjusted nor needed.** No gate run of this plan's ever went red, so the
JSON-first triage procedure was never entered *on the gate* — it was entered on the targeted sweep
in §5, where it did real work.

The pin: `MessageItem.answerOutOfFold.test.tsx  13  13  0`. **`13` was read from the gate's own
`— N new` column** on the run that first executed the file, never hand-counted.
`grep -c "MessageItem.answerOutOfFold.test.tsx" scripts/vitest-count-gate.cjs` → **2** (both knobs,
by hand: `src/components/chat` has no directory entry).

### Typecheck — a SET DIFF, as D-243-10 requires

`npx tsc -p tsconfig.app.json --noEmit` (never the solution-style `tsconfig.json`, which checks
zero files):

```
base:  67 errors
after: 67 errors
new errors: (none)
```

⚠ **An intermediate reading of 69 is recorded rather than quietly corrected: two of them were
MINE**, in the new test file, and `tsc` caught what 13 green assertions could not. The fixtures
wrote `status: "completed"` on a `ToolCall` (the type declares `running | done | interrupted |
preparing`) and a `Citation` with `document_name` / `chunk_id` / `snippet` / `index` (the type
declares `filename` / `chunk_index` / `passage` / `similarity` / `is_full_doc`). **Every case
passed with the wrong shapes** — `hasRunningTools` only tests `=== "running"` — so this was a
fixture that was *green and wrong*. Corrected to the declared types, with the trap named in the
file; the suite is still 13/13.

### Ledger gates

```
node scripts/check-hot-file-ledger.cjs 243   → ledger gate OK — every watched file has a row.   (exit 0)
node scripts/check-claude-md-size.cjs        → CLAUDE.md 88891 chars · 59.3% of limit            (exit 0)
```

---

## 7. `BUG-260707-03` — the verdict, and its reason

**Status: stays `folded`. NOT closed.** `folded_into` remains `"176, 243"`;
`verified_closed_by: null`; a concrete `re_open_trigger` was written where there was none.

**Why folded and not closed, stated as the reason rather than as caution:** every fence behind this
plan's claim is **synthetic**, and this report's own history is the argument. Residual #1 — *"Not
live-verified"* — was written on **2026-07-07** and **is still open today**, while the code half has
now been called done **three** times. A third close on synthetic evidence would repeat exactly the
failure the report records. This is the same standard `243-03` held `BUG-260823-01` to and `243-04`
held `BUG-260718-02` to.

**Owed, by name, in the report:**

1. **The G-4 browser row.** Start a tool-bearing run, navigate to `/library`, let it finish,
   navigate back **without reloading**, and read whether the answer is body text under the thinking
   line. Nobody has watched this.
2. **The narration trade is a JUDGEMENT call** (see §8). The interim narration is no longer folded;
   a long agentic run's process prose now renders in the transcript until the run-end reconcile
   replaces it with the persisted answer. Sketch 234 V1 — the operator-approved bar — draws exactly
   this, and `dedupParagraphs` still applies. Nobody has watched a ten-tool run under it.
3. **Residual #3 (`SEED-094`, the backend stray-last-line edge) is untouched**, as at 176.

### `SEED-049` is NOT re-opened, and that is a measurement

D-243-09's re-open condition is *the first criterion here that cannot be verified without a live
E2E drive*, with criterion 5 named as one of two candidates. **Criterion 5 WAS reachable from
vitest** — §6a and §6b drive a terminal on a non-mounted thread and a navigate-back reconcile
through the provider's real code. So the seed's condition did not fire on this criterion. The
browser row in (1) is a **G-4 lived-experience** obligation, not an E2E-revival trigger.

---

## 8. Mechanical vs judgement (D-243-12 — solo running, no independent §6.3 reviewer)

**MECHANICAL — unweakened by solo running:**

- The RED set: 4 named cases with quoted expected-vs-received, against a tree with an EMPTY
  production diff.
- §6a / §6b green against unmodified code ⇒ outcome 1, and the Phase-176 finding.
- The set diff in §5: 14 failures identical across a one-file revert.
- The 227 discharge: `useState` 3→3, `useEffect` 0→0, props 5→5, `--numstat 4175f41b5` → `37 / 9`,
  with all nine deletions enumerated.
- `StreamingNarration.tsx` byte-identity: an EMPTY `git diff --stat`.
- The gate verdict, the `— 13 new` pin, the 67/67 typecheck set diff, both ledger gates at exit 0.

**JUDGEMENT — weakened by solo running, and named as such:**

- **That losing the narration gist is the right trade.** The sketch draws it and D-243-06 directs
  it, but "a long run's prose in the transcript reads better than a gist that hides the answer" is
  an opinion until an operator sees a real ten-tool run. **This is the single call in this plan a
  reviewer would most usefully disagree with.**
- **That `StreamingNarration` should survive uncalled rather than be deleted.** The plan mandated
  it; whether a component with zero callers is better kept or removed is a decision, deferred.
- **That the 13 provider reds are out of scope.** Proven inherited (mechanical); *worth leaving*
  is a judgement under the SCOPE BOUNDARY rule.

---

## 9. Deviations from plan — reported, not absorbed

**1. [Rule 3 → reported] `StreamsProvider.tsx` was in `files_modified` and needed NO edit.**
Outcome 1 means the reconcile needed nothing. `git diff --numstat 4175f41b5 --
frontend/src/providers/StreamsProvider.tsx` is **EMPTY**. Its triple re-derives to
**`90 / 36 / 4380`** — identical to its CLAUDE.md row, so no ledger update was owed for it and none
was invented. Stated here for the same reason `243-03` stated it about `MessageList.tsx`: a named
file that needed no edit is a finding, not a silence.

**2. [Rule 1 — Bug] `ThinkingBlock.characterization.test.tsx` was NOT in this plan's
`files_modified`, and had to change.** Its §11 anchored "the answer" on the narration fold. This is
the *second* consecutive wave to find a file the plan failed to declare (243-04 recorded the same
about `MessageItem.tsx`). The edit is a single anchor plus the recorded original; no assertion was
weakened and the positive control was kept.

**3. [Rule 1 — Bug] Two `tsc` errors introduced by this plan's own task-1 test file**, caught by
the set diff and fixed (see §6). They would have shipped as a silent +2 on the 67-error baseline.

**4. Recorded, not fixed: `StreamsProvider.tsx:2151` and `:2615` are now stale prose.** Both
comments describe *"StreamingNarration's fold gives way to a clean answer"* — a fold nothing
renders. Left alone deliberately: `StreamsProvider` is the tree's largest, hottest file, this plan
modified it not at all, and a comment-only touch there is not worth the G-5 surface. Logged in
`deferred-items.md` with the retirement decision it belongs to.

**5. `243-CONTEXT.md`'s typecheck baseline of "67 errors" is CONFIRMED**, measured at this
execution base — a figure in this project that did *not* rot, recorded because the others did.

---

## 10. Ledger updates

| File | Previous cell | **Re-derived 2026-09-11** | Touched by this plan |
|---|---|---|---|
| `frontend/src/components/chat/MessageItem.tsx` | `67 / 33 / 726` (243-02) | **`68 / 33 / 755`** | YES |
| `frontend/src/providers/StreamsProvider.tsx` | `90 / 36 / 4380` (243-04) | **`90 / 36 / 4380`** — unchanged | **NO** |

Recipe run from CLAUDE.md verbatim; six-digit dated quick-task buckets **named and subtracted**, not
silently dropped — `MessageItem.tsx`: `260328`, `260405`, `260630`; `StreamsProvider.tsx`: `260529`.

⚠ **On `StreamsProvider.tsx`'s numstat caveat from 243-04** — that plan reported it as the tree's
lone CRLF blob, normalized by `core.autocrlf`, making its numstat misleading. **This plan produced
no numstat for it at all** (empty diff), and commit/phase counts are unaffected by line endings, so
the caveat does not bear on the `90 / 36` re-derivation. `wc -l` reads 4380 either way.

**Same-commit sync honoured:** the `docs/HOT-FILE-LEDGER.md` section, the `CLAUDE.md` firing row and
the detail file's own scan row all moved in `63e56e79f`. Disposition cell length is within the
200-char cap (`check-claude-md-size.cjs` exit 0, which enforces it).

**The 227 discharge, in the ledger, in numbers rather than a sentence:** `useState[(<]` **3 → 3** ·
`useEffect(` **0 → 0** · props **5 → 5** (`message, isStreaming, onSendMessage, onResume,
isLastAssistant`) · `--numstat` **`37 / 9`**. ⭐ Unlike 243-02 and 243-04, this plan **deleted**
lines here — nine — and each is enumerated in the ledger section: the `StreamingNarration` import,
the seven-line arm (condition, five-line comment, JSX), and the ternary's next condition which is
re-added as the new head. All 37 additions are that re-added condition plus the docblock.

---

## Self-Check: PASSED

- `frontend/src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx` — FOUND
- `frontend/src/components/chat/MessageItem.tsx` — FOUND (modified)
- `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, `scripts/vitest-count-gate.cjs` — FOUND (modified)
- `.planning/reported-bugs/BUG-260707-03-final-answer-stays-folded-in-narration-until-reload.md` — FOUND (modified)
- commit `5e03d12b0` — FOUND · commit `63e56e79f` — FOUND

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired component was introduced. The one
component left in an unusual state — `StreamingNarration.tsx`, zero production callers — is
**not a stub**: it is fully implemented, fully tested and deliberately unmounted, with its
retirement recorded as an owed decision in `deferred-items.md`.
