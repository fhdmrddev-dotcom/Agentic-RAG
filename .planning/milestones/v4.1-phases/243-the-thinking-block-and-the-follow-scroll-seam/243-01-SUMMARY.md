---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
plan: 01
subsystem: frontend-chat
tags: [characterization, test-net, gate-knobs, pre-extraction]
requires: []
provides:
  - "frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx — the pre-extraction net 243-02 must pass unchanged"
  - "scripts/vitest-count-gate.cjs — the suite registered in BOTH knobs (TARGETS path + BASELINE 17)"
affects:
  - "243-02 (the extraction) — these 17 cases are its acceptance evidence"
  - "243-04 (the V1 restyle) — the ONE plan permitted to change §5 and the label cases"
tech-stack:
  added: []
  patterns:
    - "Phase 227 characterization template: write the cases against the UNMOVED component first"
    - "Render through the boundary that SURVIVES the move (MessageItem), not the component the code leaves"
    - "Both gate knobs in the same commit; the pinned number read from the gate's own `— N new` column"
key-files:
  created:
    - frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx
  modified:
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-243-16 honoured: the net exists before anything moves"
  - "D-243-11 honoured: every case asserts rendered CONTENT or a class-token set"
  - "The terminal arm of RunCard's elapsed honesty gate is UNREACHABLE on the planning row — measured, and pinned as §6e rather than faked"
metrics:
  duration: ~50 min
  completed: 2026-09-11
---

# Phase 243 Plan 01: The Thinking Block's Pre-Extraction Net — Summary

Seventeen characterization cases now describe what the thinking block does today, written against
the unmoved `RunCard` but rendered through `MessageItem` — the boundary that survives 243-02's
extraction — and registered in both gate knobs. The net was driven RED against two planted defects
and the production file restored md5-identical.

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `a17955cc3` | `test(243-01): characterize the thinking block before it moves` |
| 2 | `f9bd3ccc7` | `chore(243-01): register the thinking-block net in both gate knobs` |

Base: `develop` at `3412bb6ab`, main working tree, no worktree. `git status --porcelain -- frontend
scripts` was EMPTY before the first edit and is EMPTY at close.

## The case names, verbatim

| § | Kind | Case name |
|---|---|---|
| §1 | describe | `§1 — the settled reasoning fold` |
| §1a | **SETTLED** | `§1a — a settled tool-bearing turn labels the trigger exactly \`Thinking\`, once the run row is open` |
| §1b | **SETTLED** | `§1b — the fold is CLOSED by default: the reasoning prose is absent before the trigger is clicked` |
| §1c | **SETTLED** | `§1c — clicking the trigger reveals the reasoning prose verbatim, newlines included` |
| §1d | **SETTLED** | `§1d — the 33 KB end of the 170× spread renders verbatim too (D-243-03)` |
| §2 | **STREAMING** | `§2 — a STREAMING turn labels the trigger exactly \`Thinking...\` with three ASCII dots, never the single ellipsis character` |
| §3 | **STREAMING** | `§3 — while streaming, reasoning accumulates behind a CLOSED fold: the prose appears only once the trigger is clicked (D-243-02)` |
| §4 | describe | `§4 — the trigger carries no count` |
| §4a | **SETTLED** | `§4a — the settled trigger's text is exactly \`Thinking\` and carries no unit, no total and no digit` |
| §4b | **SETTLED** | `§4b — a reasoning body FULL of digits still produces a digit-free trigger — the assertion binds to the trigger, not to the page` |
| §5 | **SETTLED** | `§5 — the reasoning body's class tokens, pinned as the thing 243-04 will change` |
| §6 | describe | `§6 — the planning placeholder (state 2), anchored to the card 243-02 leaves it in` |
| §6a | STREAMING (RunCard) | `§6a — streaming + isPlanning + no reasoning renders \`Thinking · planning next step\`` |
| §6b | STREAMING (RunCard) | `§6b — the SAME fixture with reasoning does not render the planning copy — states 1 and 2 are mutually exclusive by construction` |
| §6c | STREAMING (RunCard) | `§6c — an honest start renders a duration beside the planning copy` |
| §6d | STREAMING (RunCard) | `§6d — no honest start renders NO duration — the honesty gate, on the only input state 2 can reach` |
| §6e | **SETTLED** (RunCard) | `§6e — a TERMINAL planning run renders no planning row at all, which is WHY the terminal arm of the honesty gate is unreachable here` |
| §7 | **SETTLED** | `§7 — state 3: with neither reasoning nor planning, no \`Thinking\` trigger and no \`Thinking · planning next step\` render inside an OPEN run` |
| §8 | SETTLED, no tools | `§8 — ⚠ DECLARED DEFECT (CHAT-04): a reasoning-bearing reply with ZERO tool calls renders no reasoning anywhere` |
| §9 | **SETTLED** | `§9 — ⚠ DECLARED DEFECT: on a settled run the reasoning sits behind TWO folds — no thinking trigger exists until the run row is opened` |

**Settled vs streaming, stated as the plan requires.** Every case marked **SETTLED** clicks
`data-testid="run-card-collapsed"` before asserting anything (§1a-§1d, §4a, §4b, §5, §6e, §7, §9).
The **STREAMING** cases (§2, §3, §6a-§6d) do NOT, because `isStreamingNow` already makes
`RunCard`'s `expanded` true and a click would be a second, misleading gesture. §8 is the only case
that neither expands nor streams — its fixture has no tool calls, so no run card mounts at all,
which is the defect it pins.

## Where each case renders, and why

- `grep -c 'from "@/components/chat/RunCard"'` → **1**. Only §6 anchors to the card.
- `<MessageItem` appears **13** times; `<RunCard` **5** (all inside §6).

§1-§5 and §7-§9 render `<MessageItem>` because 243-02 moves the fold OUT of `RunCard` — a case
asserting a trigger inside `RunCard`'s output would go red on correct code. §6 stays on the card
because 243-02 explicitly leaves the planning placeholder and the elapsed segment there.

## Fixtures — both ends of D-243-03's 170× spread

| Fixture | Measured `.length` | Corpus reference |
|---|---|---|
| `REASONING_MEDIAN` | **197** | median 198 — one char off |
| `REASONING_LONG` | **32,951** | max 33,713 — just under, built programmatically (435 lines) |

`REASONING_MEDIAN` carries newlines deliberately and §1c asserts the body's `textContent` **is**
the fixture, `\n` included, with an identity normalizer — the default whitespace-collapsing
normalizer would have asserted something weaker than what ships.

**Tool-call shape, stated because it is what makes §8 a controlled comparison:** §1-§5, §7 and §9
carry a NON-EMPTY `tool_calls` (one `search_documents` call). §8 carries `tool_calls: []` and is
otherwise §1's fixture exactly. One variable moves.

## `toBeInTheDocument()` audit

`grep -c "toBeInTheDocument()"` → **4**, in §1c, §4b (via a `.textContent` chain), §7 and §8.
**None is the whole assertion of its case:**

| Occurrence | Paired assertion in the same case |
|---|---|
| §1c | `expect(body.textContent).toBe(REASONING_MEDIAN)` + `.toContain("\n")` |
| §6c | `within(row).getByText(/^\d+(\.\d+)?s$/)` — the duration's rendered TEXT |
| §7 | `screen.getByText("Assistant response text")` — a content positive control before two absences |
| §8 | same content positive control, before the three absences that are the defect |

No case asserts that a `data-testid` merely exists (D-243-11).

## The two planted defects — SEEN TO FAIL, restored by hash

`md5sum frontend/src/components/chat/RunCard.tsx` **before either plant**:
`2cac66602c974161bf2fd3725dbd9a6f`.

### Plant 1 — the label (`RunCard.tsx:496`)

`label={isStreamingNow ? "Thinking..." : "Thinking"}` → `"Thinking…"` (U+2026).

**3 cases went red:**

```
× §2 — a STREAMING turn labels the trigger exactly `Thinking...` with three ASCII dots, never the single ellipsis character
× §3 — while streaming, reasoning accumulates behind a CLOSED fold: the prose appears only once the trigger is clicked (D-243-02)
×   §6b — the SAME fixture with reasoning does not render the planning copy — states 1 and 2 are mutually exclusive by construction

AssertionError: expected 'Thinking…' to be 'Thinking...' // Object.is equality
Expected: "Thinking..."
Received: "Thinking…"
 ❯ src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx:186:27

Tests  3 failed | 14 passed (17)
```

### Plant 2 — the body class (`RunCard.tsx:501`)

`font-mono` deleted from the reasoning body's class string.

**1 case went red:**

```
× §5 — the reasoning body's class tokens, pinned as the thing 243-04 will change

AssertionError: expected [ 'px-3', 'py-2', 'text-xs', …(8) ] to include 'font-mono'
 ❯ src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx:254:43

Tests  1 failed | 16 passed (17)
```

### Restoration, proven by hash and not by a green re-run

| | value |
|---|---|
| md5 before plant 1 | `2cac66602c974161bf2fd3725dbd9a6f` |
| md5 after restoring plant 1 | `2cac66602c974161bf2fd3725dbd9a6f` |
| md5 after restoring plant 2 | `2cac66602c974161bf2fd3725dbd9a6f` |
| `git diff --stat -- RunCard.tsx MessageItem.tsx` | **EMPTY** at every checkpoint and at close |

Neither plant needed a second attempt; no case was found vacuous.

## The gate — both knobs, and the numbers read from the run

`grep -c "ThinkingBlock.characterization.test.tsx" scripts/vitest-count-gate.cjs` → **2**.

```
scripts/vitest-count-gate.cjs:2913    "ThinkingBlock.characterization.test.tsx": 17,
scripts/vitest-count-gate.cjs:4651    "src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx",
```

**The pinned number was read from the gate's own column**, on the run that first executed the file
(TARGETS added, BASELINE not yet):

```
  ThinkingBlock.characterization.test.tsx       —      17     new
```

Both knobs then landed in the SAME commit as required (a BASELINE key naming a file that does not
exist makes the gate exit **2**, not fail).

### Verdict lines, verbatim, both runs

Run 1 — TARGETS only, the run the `— 17 new` was read from:

```
  total                                      7170    7957    +787
  total 7957  ·  failed 0  ·  pinned total 7170
count gate OK — 249/249 pinned files present, no per-file decrease, 0 failing.
```

Run 2 — after the BASELINE pin:

```
  ThinkingBlock.characterization.test.tsx      17      17       0
  total                                      7187    7957    +770
  total 7957  ·  failed 0  ·  pinned total 7187
count gate OK — 250/250 pinned files present, no per-file decrease, 0 failing.
```

**The arithmetic closes with no residual.** `243-BASELINE.md` measured `total 7940 · pinned total
7170 · 249 pinned files`. Now: `7957` (= 7940 **+17**), `7187` (= 7170 **+17**), `250` files
(= 249 **+1**). The whole delta is this one suite; nothing else moved and **no per-file decrease**
appears on either run.

### ⚠ The set diff, and the honest reading of it

`243-BASELINE.md` predicts two inherited failures, both in
`src/components/library/__tests__/sketchComposition.test.tsx` (*"§2 positive controls › the page
renders its heading"* and *"…the four shipped tab triggers render"*). **Neither reproduced.** The
failing set at this plan's close is **EMPTY** — `failed 0` on both full gate runs, cap `2`, quiet
tree.

That is a proper subset of the predicted set, so no criterion is violated and no third failure
appeared. But it must not be read as *"the inherited flake is fixed"*: `SEED-171`'s suite failed on
2026-09-06, on 2026-09-10 and again at this phase's baseline on 2026-09-11, and **one green sample
of a flaky suite is not proof of innocence**. Nothing in this plan touched `src/components/library`.
The cap was neither adjusted nor needed, and the JSON-first triage procedure was never entered
because nothing went red.

## Typecheck — a SET DIFF, not a count

`npx tsc -p tsconfig.app.json --noEmit` in `frontend/` → **67 errors**, identical to the base's 67.
`grep -c "ThinkingBlock.characterization"` over that output → **0**. The new file IS in the app
config's file set (`tsc --listFiles` names it), so the 67 is a real re-measurement rather than a
file the config never looked at. `npx tsc --noEmit` was NOT used — it checks zero files here.

## Hot-file ledger gate

```
node scripts/check-hot-file-ledger.cjs 243   →  EXIT 1
```

**Expected, and the `[no-row]` set is exactly the three files the plan predicted:**

```
[no-row] frontend/src/components/chat/ThinkingBlock.tsx   (named by 243-02-PLAN.md, 243-04-PLAN.md)
[no-row] frontend/src/hooks/useFollowScroll.ts            (named by 243-03-PLAN.md)
[no-row] frontend/src/lib/throttle.ts                     (named by 243-03-PLAN.md)
```

The gate aggregates `files_modified` across every `*-PLAN.md` in the phase directory, so it is
reporting later plans' files, not this one's. No file this plan touched is named — `scripts/` and
`__tests__/` are both exempt — so **this plan's `files_modified` has not drifted**.

## Deviations from plan

### 1. [Rule 1 — the plan's assertion would have failed against correct code] §6b's loose regex

- **Found during:** Task 1, first run of the suite.
- **Issue:** `screen.queryByText(/planning next step/)` matched the RUN HEADER's own
  `planning next step…` — a separate string with a typographic ellipsis, from `RunCard`'s
  status-verb helper — so the mutual-exclusion case failed against correct code.
- **Fix:** a `PLANNING_COPY = "Thinking · planning next step"` constant, asserted exactly, with the
  measurement written into the file so the next reader does not re-loosen it. §6e and §7 were moved
  onto the same constant and each also asserts `queryByTestId("thinking-row")` is null.
- **Files:** the new suite only. **Commit:** `a17955cc3`.

### 2. [Finding — the plan asked for a case the code cannot render] §6d / §6e, the honesty gate

The plan's §6 asks for *"one case with a terminal run carrying neither `completedAt` nor a
same-session stream shows NONE"*. **Measured: that case is unreachable on the thinking row.**
State 2 renders only when `isStreamingNow && message.isPlanning`, so a TERMINAL planning run
renders no row at all — there is nothing on which to observe the terminal arm of `hasElapsed`.

Rather than write a case that could not mean what it says, the plan's intent was split in two and
both halves were driven:

- **§6d** drives the reachable arm of the same gate — a streaming planning row whose start is
  unparseable shows the copy and NO duration.
- **§6e** pins WHY the other arm is unreachable — a terminal planning run renders no thinking row,
  asserted after expanding the collapsed run so the absence is measured against a rendered body.

This is recorded rather than absorbed. If 243-04 gives the settled fold a duration (D-243-13), the
terminal arm becomes reachable and §6e is the case that will have to change.

### 3. [Finding — a plan warning that is measurably not true, kept anyway]

The plan warns that this file *"enters `WorkspacePanel.test.tsx`'s RAW `?raw` source sweep"*.
**Measured false for this file:** `WorkspacePanel.test.tsx:1148-1155`'s `productionOnly()` filters
out any path containing `__tests__` and any `*.test.tsx`, so a suite in
`components/chat/__tests__/` is excluded from `CHAT_SRC` before any assertion runs. The rule was
followed regardless — `grep -cE "cancelRun\(|stopThread\(|stopStream\(|lock\.runId"` over the new
file is **0** — because the cost of complying is nil and the sweep's exclusion could be narrowed by
a later phase. The warning is a live constraint on `ThinkingBlock.tsx` itself (243-02), which is
production source and IS swept.

### 4. [Additive] Two cases beyond the plan's list

- **§1d** — the 33 KB fixture got its own case rather than riding inside §1c, so a failure at the
  long end reads as a sentence about scale instead of about the median.
- **§6e** — see deviation 2.

Neither is a scope change; both are the same surface.

## Known Stubs

None. This plan adds no production code and no placeholder.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema shape is touched; the only
production-adjacent edit is two additive entries in a test-gate config.

## ⚠ Solo running — which evidence it weakens (D-243-12)

Per D-243-12, mechanical evidence is not weakened by solo running and judgement calls are.

**Mechanical — stands without a second reader:** the two planted defects and the case names they
reddened; the md5-identical restore; the empty `git diff --stat` over `RunCard.tsx` and
`MessageItem.tsx`; the `— 17 new` column and the `+17 / +17 / +1` arithmetic against
`243-BASELINE.md`; the 67-error typecheck with zero errors naming the new file; the ledger gate's
exit 1 with its predicted `[no-row]` set; the `grep -c` counts.

**Judgement — a solo call, and named as one:**

1. **That these seventeen cases are the RIGHT seventeen.** They cover the three shipped states and
   both declared defects, but no independent reader has asked what a settled turn's *behaviour* on
   re-render, on a temp-id → DB-id swap, or under `key={message.id}` should be — and PATTERNS §F.8
   flags exactly that as a thing 243-02 must DECIDE. This net does not pin it, so it will not catch
   it.
2. **That §5's seven class tokens are the right pin.** The plan named them; I did not re-derive
   whether e.g. `leading-relaxed` or `text-muted-foreground` also carry design weight. If 243-04
   changes one of those, this net stays green through a visible change.
3. **That the §6d/§6e split honours the plan's intent** rather than quietly lowering its bar. It is
   argued above from the code, but it IS a substitution of my reading for the plan's instruction.

**One green sample is not proof of innocence** — that applies to the inherited `sketchComposition`
pair above, and it applies to this suite too: it has passed on four invocations and been driven red
on two planted defects, which is evidence about the fence, not about everything the fence does not
watch.

## Self-Check: PASSED

- `frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx` — FOUND
- `scripts/vitest-count-gate.cjs` — FOUND (2 occurrences of the suite name, one per knob)
- commit `a17955cc3` — FOUND in `git log`
- commit `f9bd3ccc7` — FOUND in `git log`
- `git diff --stat a17955cc3^..HEAD` names exactly two files: the new suite (+381) and the gate
  script (+24). No production source appears.
