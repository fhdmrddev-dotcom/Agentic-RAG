---
phase: 244-the-chat-shell-and-the-composer
plan: 12
subsystem: chat-surface
tags: [SHELL-03, BUG-260828-07, G-6, G-2, approval, ask_user, harness, gap-closure]
gap_closure: true
gap_closure_round: 1
requires:
  - "PendingAskStack (frontend/src/components/panel/PendingAskCard.tsx) — zero-prop, self-resolving"
  - "useAskUserPrompt / usePhases / useViewingThread (StreamsProvider) — the shared store slice"
provides:
  - "a LIST-LEVEL chat-column mount of the approval surface, reachable for a workflow-raised pause"
  - "MessageItem.inlineApproval.test.tsx W1-W5 — cases driven on the shape the PRODUCT writes"
  - "244-12-UAT-ROW.md — the three-arm browser row SHELL-03 actually closes on"
affects:
  - "frontend/src/components/chat/MessageList.tsx"
  - "frontend/src/components/chat/MessageItem.tsx"
  - "frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx"
  - "frontend/src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx"
tech-stack:
  added: []
  patterns:
    - "list-level mount beside ThreadRunLine, above bottomRef — the placement a store-fed surface needs when its carrier row never reaches the wire"
    - "a superseded docblock is kept verbatim under a SUPERSEDED header, never rewritten"
key-files:
  created:
    - ".planning/phases/244-the-chat-shell-and-the-composer/244-12-UAT-ROW.md"
  modified:
    - "frontend/src/components/chat/MessageList.tsx"
    - "frontend/src/components/chat/MessageItem.tsx"
    - "frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx"
    - "frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx"
    - "frontend/src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx"
    - "frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx"
    - "scripts/vitest-count-gate.cjs"
    - "docs/HOT-FILE-LEDGER.md"
    - "CLAUDE.md"
decisions:
  - "The fix is a MOVE, not a predicate — widening hasPendingAsk would have closed nothing, because the harness's carrier row never reaches the frontend at all."
  - "The list-level mount is UNCONDITIONAL by decision; every available gate is a narrowing mount condition, which is what made SHELL-03 unreachable twice over."
  - "The measured price is +4 fetches per thread open, published rather than estimated."
  - "G-2 is an OPERATOR OVERRIDE of a locked Phase 243 rationale, recorded beside it, not over it."
  - "SHELL-03 is BUILT, DRIVE OWED — this plan may not report it closed (D-244-14)."
metrics:
  duration: "~70 min"
  completed: "2026-09-12"
  tasks: 3
  commits: 4
---

# Phase 244 Plan 12: The approval, where a harness pause can actually reach it — Summary

**A workflow-raised approval now renders its controls in the chat column, because the mount moved
to LIST level where a pause with no message to anchor to can reach it — and the one-line "widen the
predicate" fix would have shipped a second green fence over the same blocker.**

⚠ **SELF-VERIFIED, NOT REVIEWED** (D-244-21 / OV-SOLO-01). Gemini is unavailable; there is no
independent second reader standing behind anything below.

⛔ **SHELL-03 IS BUILT, WITH ITS DRIVE OWED. IT IS NOT CLOSED.** `D-244-14` binds the closing
evidence to a **driven** row, not a fence: *"a mount test proves mounting, not answering"* —
244-03's own words, and the reason this gap exists at all. `244-12-UAT-ROW.md` carries the row.

---

## What was wrong, and why the obvious fix was the wrong one

G-6 was driven in Chrome on a real workflow approval (200-Word Essay Writer, step 2 `"act"`). The
chat thread rendered **no approval controls and no paused cue**; all three controls measured at
`left >= 1103` against the panel's own left edge of `1082`. `anyApprovalControlInChatColumn = FALSE`.

`MessageItem.tsx`'s arm was unreachable **three** times over for that pause:

1. `hasPendingAsk` requires `tc.name === "ask_user"` with a running/interrupted `status`; the
   harness writes `tool_calls: [{ kind: "ask_user_prompt" }]` — no `name`, no `status`.
2. the carrier row is `role="system"`, and the mount sat inside the assistant-row arm.
3. ⛔ **that row never reaches the frontend at all** — `threads.py:427-438` and `:682-691` both
   apply `.neq("role","system")` (`BUG-260528-01`).

⭐ **(3) is why widening the predicate would have closed nothing**, and it is the single most
important thing in this plan. There is no message to anchor to at any predicate. `ThreadRunLine`'s
own shipped comment already makes the identical argument one surface over — a harness kickoff
inserts no assistant node — so the placement was already argued in this file, for a sibling reason.

---

## Tasks and commits

| Task | What | Commit |
|---|---|---|
| 1 | RED — W1-W5 driven on the shape the product writes; cases 1-5 re-aimed, none deleted | `e1e264dba` |
| 2 | GREEN — `PendingAskStack` mounted at list level; the per-row mount removed | `39b6e2802` |
| 3 | G-2 override + ledger rows/sections + count-gate pin + the UAT row | `5953ef1de` |
| — | Two fences the plan did not name, found by the FULL gate (deviation, below) | `70a9803a8` |

---

## The RED drive, with its measured colours

`W1` failed against unmoved production code, verbatim:

```
TestingLibraryElementError: Unable to find role="radio" and name "Approve this step"
```

Measured colours at RED, all thirteen cases, recorded because a claim of "it was red" without the
set is not evidence:

| Case | RED | after |
|---|---|---|
| W1 (the gap) | **FAIL** | pass |
| W2 (Deep path survives, exactly one control set) | pass | pass |
| W3 (6 rows cost what 1 costs, workflow shape) | **FAIL** | pass |
| W4 (no pause; the bought fetch) | **FAIL** | pass |
| W5 (settle is structural on the SSE writer path) | **FAIL** | pass |
| 2 (re-aimed: the row does not own the controls) | **FAIL** | pass |
| 4 (re-aimed: the ROW buys no fetch, live ask included) | **FAIL** | pass |
| 1, 3, 5, 6a, 6b, 6c | pass | pass |

`6 failed | 7 passed (13)` at RED → `13 passed (13)` after.

⛔ **W1 constructs no ask-bearing message.** Grepped its body: the only occurrence of `ask_user` is
inside a comment explaining why there is none. The pending state arrives through the product's own
GET reconcile — `useAskUserPrompt` → `usePanelReconcile` → `getThreadPendingAsks` →
`replacePendingAsksForThread`. W5 drives the *other* product writer, the SSE path
(`addPendingAskForThread` / `removePendingAskForThread`, `StreamsProvider.tsx:1165-1168`).

**Case count: 8 → 13. No case was deleted** — the count gate's contract is *no per-file decrease*,
and the narrow mount's C-3 reasoning is the only written record of a cost that is still true about a
per-row mount.

---

## ⚠ The measured cost — the real figure, not the estimate

The plan disclosed *"roughly 2-4 fetches per thread open"* and asked for the real number. Measured
2026-09-12 by toggling this exact mount off and on against the W4 fixture, on a thread with **no
pause at all**:

| fetcher | mount OFF | mount ON |
|---|---|---|
| `getThreadPendingAsks` (`useAskUserPrompt`) | **0** | **2** |
| `getThreadWorkflow` (`PendingAskStack`'s `usePhases` → `reconcilePhases`) | **1** | **3** |
| **total bought** | — | **+4 per thread open** |

**+4, not "2-4".** The estimate understated it. The cost is **constant in row count** (W3: six rows
cost exactly what one costs) and **constant in whether a pause exists** (W4: the no-pause count
equals the with-pause count). Before this plan the Deep path bought **zero** here.

⛔ **The cheaper gated arm was available and was rejected, with its reason recorded at the mount:**
mount only under a harness lock, or only when a message carries a pending ask. Every such gate is a
**narrowing mount condition**, and a narrowing mount condition is precisely what made SHELL-03
unreachable twice over. Buying back four fetches by re-introducing this phase's own failure mode, on
this phase's blocker, is the wrong trade. **The number is published in the code, in the ledger and
here** so it can be re-opened on evidence rather than rediscovered.

---

## G-2 — an operator override, recorded beside what it overrides

`<RunCard>` now renders above `<ThinkingBlock>` (`MessageItem.tsx:508` vs `:510`) — **tools →
thinking → answer**.

- **Phase 243, locked, still in the file word for word:** *"ORDER IS THE ORDER IN TIME — above the
  run card's tool rows and above the answer."*
- **Phase 244, the operator, live during UAT:** *"the thinking badge it's recommended to be below
  the container of the tools not above"*.

⛔ **This is an override, not a defect fix.** Nothing was measured wrong about the 243 order; a
re-reversal later is a decision, not a regression. `grep -c "ORDER IS THE ORDER IN TIME"` returns
**1** — preserved, not deleted.

**§11 was re-driven, never deleted.** Exactly one relation inverted; driven RED against the unmoved
source first:

```
AssertionError: expected 43 to be less than 10
```

`thinkingAt < bodyAt` is **unchanged**, and both statements of each relation are kept (index and
`compareDocumentPosition`) because §11's own comment says the second exists so *"a future container
restructure cannot make the indices agree by accident"* — and a re-ordering is exactly when that
matters. All three positive controls kept. `ThinkingBlock.characterization.test.tsx` **33 passed**
(pin unchanged at 33), `+ clamp` = **40 passed**.

**§12 still resolves, and now provably so.** `soleMountExpression` survives the move; 244-12 added
`expect(mount.length).toBeGreaterThan(20)` and `toContain("reasoningContent")` **before** the three
`not.toContain` assertions — a resolver that matched nothing would otherwise have passed every one
of them over an empty string, which is the Phase-242 `check-hot-file-ledger` vacuity in another file.

---

## Deviations from Plan

### 1. [Rule 1 — Bug] A SECOND order fence existed, and the plan named only one

- **Found during:** Task 3, by the **full** count gate — not by reading the plan.
- **Issue:** `MessageItem.answerOutOfFold.test.tsx` §2 also pins the 243 order
  (`isAfter(thinking, runCard)`), in a different file under a different heading, and is **absent
  from the plan's `files_modified`**. It went red on the G-2 move: `expected false to be true`.
- **Fix:** re-driven exactly as §11 was — one relation inverted (`isAfter(runCard, thinking)`), the
  override recorded in the case's docblock, and a **third assertion ADDED**
  (`isAfter(thinking, answer)`) so *"thinking moved"* and *"thinking fell past the answer"* stay
  distinguishable. Case count unchanged; nothing deleted.
- **⭐ The finding worth more than the fix:** a source-order invariant asserted in two places is not
  redundancy — it is two places that must change together, and **only a full-gate run can say how
  many there are.** A targeted-suite verification would have shipped this red.
- **Commit:** `70a9803a8`

### 2. [Rule 3 — Blocking] The new mount made `getThreadPendingAsks` reachable from `ChatArea`

- **Found during:** Task 3, same gate run — **7** red cases in `ChatAreaBanner.test.tsx`, none of
  them about approvals.
- **Issue:** `Error: [vitest] No "getThreadPendingAsks" export is defined on the "@/lib/api" mock.`
  `ChatArea` → `MessageList` → `PendingAskStack` → `useAskUserPrompt` now reaches an export that
  suite's **allow-list** mock factory omits, so it threw at import binding.
- **⚠ That suite's own docblock already described this exact trap**, from Phase 216, and it fired
  again for the same reason. The durable repair is the Phase-196 `{ ...actual, … }` spread; it was
  **deliberately not taken** — widening a byte-unchanged suite beyond its own defect is not a
  gap-closure round's work (G-7). The comment says a **third** occurrence should take the spread.
- **Fix:** one line added to the factory, with the reasoning inline.
- **Commit:** `70a9803a8`

### 3. [Rule 1 — Bug] Case 6c passed for the wrong reason, in this plan's own commit

- **Issue:** 6c asserted `[...item.matchAll(/<PendingAskStack/g)]).toHaveLength(1)` against
  `MessageItem.tsx`. After the mount left, a **prose mention** in the "it was here and is gone"
  comment kept that count at 1 — **the fence went on passing over a file that no longer contained
  the thing it counted.**
- **Fix:** it now asserts **ZERO** in `MessageItem.tsx` and **ONE** in `MessageList.tsx`, with a
  non-empty positive control on each source, plus `<PausedRunCue` = 1 to pin the deliberate split.
  The comment is written without the angle bracket and says why.
- **⭐ The lesson, recorded in the ledger:** **a `?raw` source fence cannot tell code from a
  comment.** This plan caught it only because the grep was actually run rather than assumed.
- **Commit:** `39b6e2802`

### 4. [Documented departure from the plan's letter] Case 4 kept its row-level anchor

The plan asked for cases 1-5 to be re-aimed onto `MessageList`. Cases **1, 2, 3 and 5** were. **Case
4 was not**, deliberately: rendering it through `MessageList` would have required emptying the store
to keep its *"nothing renders"* half true, at which point it would pass **because there was nothing
to render** — the exact failure mode this gap is about — and would duplicate W4. Kept at row level,
it is instead the executable form of Task 2's removal (the row mounts no stack, so it buys no
fetch), and it gained a sharper half: **a LIVE ask on a bare `MessageItem` also buys nothing**. The
reason is written in the case.

### 5. `streamsStore.ts` ledger row NOT added

`node scripts/check-hot-file-ledger.cjs 244` exits `1` on a single **inherited** finding —
`[no-row] frontend/src/stores/streamsStore.ts (named by 244-13-PLAN.md)`. That row belongs to
`244-13` (wave 3) and was left alone. The parse is **non-vacuous**: `scan list: 265 rows · subject:
61 files · watched: 29`, and **neither of this plan's two files appears in the no-row list**.

---

## Verification

| Gate | Result |
|---|---|
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (worktree root) | ⭐ **`count gate OK — 272/272 pinned files present, no per-file decrease, 0 failing`** · total **8220** · pinned **7431** |
| `npx tsc -p tsconfig.app.json --noEmit` | **67 errors**, SET diff against the base capture **EMPTY both ways** (`diff` exit 0) |
| `node scripts/check-claude-md-size.cjs` | exit **0** — 96,964 chars, 64.6% of limit |
| `node scripts/check-hot-file-ledger.cjs 244` | exit **1** on the inherited `streamsStore.ts` only; 61 subject files parsed (non-vacuous) |
| `MessageItem.inlineApproval.test.tsx` | **13 passed** (was 8) |
| `MessageList.test.tsx` / `.scroll` / `.dedup` / `.runline.baseline` | **30 / 11 / 7 / 8**, all green |
| `ThinkingBlock.characterization` / `.clamp` | **33 / 7** = 40, green |
| `MessageItem.answerOutOfFold` + `ChatAreaBanner` | **20 passed** after repair |
| `git diff --stat -- backend/ supabase/` | **EMPTY** |
| `git diff -- frontend/package.json frontend/package-lock.json` | **EMPTY** — no package installed, no legitimacy audit owed (T-244-12-SC) |

### The count gate, run by run — the procedure, not just the colour

⛔ **Failing filenames were captured from the gate's own persisted JSON BEFORE any re-run**, per
CLAUDE.md, and each was checked against `git diff --numstat` from the base.

| run | failed | files | disposition |
|---|---|---|---|
| 1 | **8** | `ChatAreaBanner.test.tsx` (7) · `MessageItem.answerOutOfFold.test.tsx` (1) | **BOTH REAL AND BOTH MINE.** Byte-unchanged files, but they render components this plan changed — "unmodified" is not "innocent". Repaired in `70a9803a8`. |
| 2 | **2** | `library/__tests__/sketchComposition.test.tsx` | ⚠ see below |
| 3 | **0** | — | `count gate OK` |

⚠ **On run 2's two failures, stated as an observation and not as proof of innocence.**
`sketchComposition.test.tsx` is **provably unmodified** by this plan (`git diff --numstat` empty for
`frontend/src/components/library/` and `LibraryPage.tsx`), it mounts `LibraryPage` and nothing this
plan touches, and it is **green in isolation at this commit** (46 passed / 1 skipped). The signature
is a cascade: the first case died `STACK_TRACE_ERROR` (a timeout) leaving its render mounted, and
the next case then found *"multiple elements with the role tab and name Documents"*. ⛔ **It is NOT
one of SEED-171's five named suites — it is a sixth candidate**, and one green sample of a flaky
suite proves nothing. Run 3 was clean; that is evidence, not a verdict.

⛔ **The cap was never touched.** `GSD_VITEST_MAX_WORKERS=2` on every invocation.

---

## Structural facts asserted, not assumed

- Exactly **two** `<PendingAskStack` mounts product-wide: `MessageList.tsx:320` and
  `WorkspacePanel.tsx:438`. One chat-column mount, not two — *"actionable twice and agreed in
  neither"* is the ROADMAP's own named failure mode.
- Placement: `renderMessages.map` at `:234` → `<ThreadRunLine>` at `:265` → `<PendingAskStack />` at
  `:320` → `<div ref={bottomRef} />` at `:322`. The auto-scroll anchor still lands at the true
  bottom.
- `<ThinkingBlock` (`:510`) is **after** `<RunCard` (`:508`).
- **`MessageItem` is not re-hollowed** (the Phase 227-03 discharge): `useState` **4 → 4**,
  `useEffect` **0 → 0**, props **5 → 5** — and this plan **deleted** a mount rather than adding one.
- `PausedRunCue` stays inline: `<PausedRunCue` = **1**, unchanged.

## Ledger

Both rows re-derived from git and updated **with their sections in the same commit**:

| file | row before | **re-derived** |
|---|---|---|
| `MessageItem.tsx` | `71 / 37 / 904` | **`73 / 34 / 954`** |
| `MessageList.tsx` | `21 / 9 / 307` | **`23 / 10 / 366`** |

⚠ **`MessageItem`'s phase figure differs by CONVENTION, so the cell says which it uses.** `34`
subtracts the dated six-digit quick-task buckets; the same history reads **37** without the
subtraction, which is the figure the `244-05` row carried. Only the subtracted figure feeds G-5, and
G-5 fires either way. `MessageList` reads `10` on both accountings — it has no dated buckets.
`MessageList`'s row was stale for the **fourth** consecutive close.

---

## Threat register

| Threat ID | Disposition | Applied |
|---|---|---|
| T-244-12-01 (EoP — the chat-column mount) | mitigate | ✅ zero-prop, resolves its own thread via `useViewingThread()`; renders only asks the owner-scoped `getThreadPendingAsks` already put in the shared slice. No endpoint, no authorisation path, no prop that could point it at another thread. |
| T-244-12-02 (Spoofing — two homes for one pause) | mitigate | ✅ exactly two mounts product-wide, asserted by grep **and** by case 6c on source. |
| T-244-12-03 (DoS — fetch amplification) | mitigate | ✅ W3 proves row-independence; W4 asserts the no-pause cost is non-zero and equal to the with-pause cost. **The +4 is published, not hidden.** |
| T-244-12-04 (Repudiation — the G-2 override) | mitigate | ✅ 243's rationale preserved word for word with the override, its date and its source beside it; §11 re-driven, and a second unnamed fence found and re-driven too. |
| T-244-12-05 (Tampering — `ThinkingBlock` mount invariants) | mitigate | ✅ §12 intact **and made non-vacuous**. |
| T-244-12-SC (installs) | n/a | ✅ no package touched. |

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file access or schema surface.

## What is owed

1. ⛔ **`244-12-UAT-ROW.md`, driven in a real browser at `/gsd:verify-work`** — three arms. Arm 1
   scores **by position against the panel edge**, not by testid, because L-4's finding was that the
   controls existed and were all in the panel. **Settle with "Do not run it" if the armed step is
   outward-facing** (L-4's was `send_email` over SMTP).
2. Arm 3 asks the operator to **confirm the G-2 override**, since it contradicts a Phase 243
   rationale they approved.
3. ⚠ **The Deep-mode `ask_user` path remains undriven** and this plan does not widen L-4's scope
   limit: say *"the workflow-raised approval has no chat controls"*, never *"the inline approval is
   broken"*.
4. `sketchComposition.test.tsx` is a **sixth SEED-171 candidate** — named here rather than left
   silent.
5. An independent review is owed: this was **self-verified**.
