---
phase: 243-the-thinking-block-and-the-follow-scroll-seam
plan: 02
subsystem: frontend-chat
tags: [extraction, component-boundary, chat-04, g5-discharge, source-fence]
requires:
  - "243-01 (the pre-extraction net — 17 cases, both gate knobs)"
provides:
  - "frontend/src/components/chat/ThinkingBlock.tsx — the ONE reasoning renderer, self-guarding, mounted from MessageItem for both message shapes"
  - "CHAT-04 closed: a reasoning-bearing reply that called zero tools draws its thinking"
  - "RunCard.tsx's four-phase-old G-5 obligation, DISCHARGED by deletion"
affects:
  - "243-04 (the V1 restyle) — its target is now ThinkingBlock.tsx, not RunCard.tsx:501"
  - "243-05 (the answer out of the narration fold) — MessageItem.tsx:425 is untouched here, deliberately (D-243-14)"
tech-stack:
  added: []
  patterns:
    - "StreamingNarration.tsx:27 self-guard — the mechanical form of 'the conditionality disappears by construction'"
    - "Phase 227 two-docblock extraction header: phase-tagged header, then the ORIGINAL contract moved verbatim beneath it, corrected beside rather than over"
    - "Comment-stripped source fence with a discriminating positive control (StepTypePicker.test.tsx:952-959 house form)"
key-files:
  created:
    - frontend/src/components/chat/ThinkingBlock.tsx
  modified:
    - frontend/src/components/chat/RunCard.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-243-01 honoured: exactly ONE JSX-child render of the reasoning value exists in frontend/src, and it is ThinkingBlock.tsx"
  - "The thinkingOpen remount semantics 243-01 flagged as UNDECIDED are DECIDED: no `key` on the mount — the fold survives the temp-id → DB-id reconcile, carried across the move rather than changed by it"
  - "State 2 (the planning placeholder + the 55-line elapsed derivation) deliberately stays in RunCard — it draws only when reasoning is ABSENT, so it is no second renderer"
  - "§6b's positive control had to move from <RunCard> to <MessageItem> — the plan's '§8 and only §8' criterion is refuted by measurement"
metrics:
  duration: ~55 min
  completed: 2026-09-11
---

# Phase 243 Plan 02: The Thinking Block Leaves the Card — Summary

The reasoning fold is now its own component, mounted from `MessageItem` for **both** message
shapes with no tool test anywhere, so the 31% of reasoning-bearing turns that call no tool draw
their thinking for the first time — and `RunCard.tsx`'s G-5 obligation, which four consecutive
phases recorded as *"passes forward COMPLETELY UNTOUCHED AND UNDISCHARGED"*, is discharged by a
**deletion** rather than by a claim.

## Commits

| Task | Commit | Subject |
|---|---|---|
| 1 | `2a62acb60` | `feat(243-02): one reasoning renderer, mounted for both message shapes` |
| 2 | `4bbd2c724` | `chore(243-02): raise the thinking-block pin 17 -> 23, read from the gate` |
| 3 | `3de4a0cd3` | `docs(243-02): three ledger rows, three sections, one commit` |

Base: `develop` at `32886ce0f`, **main working tree, no worktree**. `git status --porcelain --
frontend scripts docs CLAUDE.md` was **EMPTY** before the first edit and is **EMPTY** at close. No
foreign frontend/scripts change appeared at any point (the sibling Phase 242 session is
backend/docs).

---

## 1. The RED run, recorded BEFORE any production edit

The suite was first run **unmodified** against unmodified code as a control: **17 passed (17)**.
Then §8 and §9 were inverted and the four move-specific cases added, and the suite was run again
**against still-unmodified production code**:

```
 × §8 — CHAT-04 CLOSED (inverted here, by plan 243-02): a reasoning-bearing reply with ZERO tool calls renders its thinking
 × §9 — INVERTED here, by plan 243-02: a settled run’s reasoning is ONE fold away — the trigger exists BEFORE the run row is opened
 × §10a — the sweep is non-empty and can SEE the three files this plan touched
 × §10c — exactly one production file in components/chat renders it, and it is ThinkingBlock.tsx
 × §12 — NO SECOND GATE: the mount carries no tool test and no key, and the block never spells tool_calls

TestingLibraryElementError: Unable to find an element by: [data-testid="thinking-trigger"]   (×2)
AssertionError: expected false to be true                                                    (×2)
AssertionError: expected +0 to be 1

 Tests  5 failed | 18 passed (23)
```

⭐ **Two of the six new cases were GREEN in the RED run, and that is by design rather than by
accident.** §11 (DOM order) and §13 (the fold survives the reconcile) characterize behaviour that
must be **carried across** the move unchanged — the thinking block already preceded the tool rows
inside the card, and `thinkingOpen` already survived the id swap because `RunCard` is not re-keyed.
A case that goes red before and green after proves a *change*; these two prove a *non-change*, and
both are needed. §10b (the needle's positive control) was also green, which is what makes §10c's
red meaningful rather than vacuous.

**Final:** `Tests 23 passed (23)`.

---

## 2. Which net cases changed, and the `git diff` that proves the rest did not

`git diff 32886ce0f HEAD -- .../ThinkingBlock.characterization.test.tsx` touches **three hunks**:

| Hunk | What it is |
|---|---|
| `@@ -104,6 +104,69 @@` | **Additive only** — the source-sweep harness (glob, `stripComments`, `chatSource`, `RENDERS_REASONING`, `soleMountExpression`). No existing line changed. |
| `@@ -272,7 +335,15 @@` | **§6b's render line only** — see the deviation below. |
| `@@ -335,47 +406,186 @@` | §8 and §9 rewritten; §10–§13 appended. |

Every `-` line in the whole diff that is an **assertion, a case title or a render call** —
extracted mechanically rather than eyeballed:

```
-      renderWithTooltip(<RunCard message={msg} isStreaming />)            ← §6b (deviation 1)
-  it("§8 — ⚠ DECLARED DEFECT (CHAT-04): …renders no reasoning anywhere", …
-    expect(screen.queryByTestId("thinking-trigger")).toBeNull()           ← §8
-    expect(screen.queryByText(REASONING_MEDIAN, …)).toBeNull()            ← §8
-  it("§9 — ⚠ DECLARED DEFECT: …no thinking trigger exists until the run row is opened", …
-    expect(screen.queryByTestId("thinking-trigger")).toBeNull()           ← §9
```

**Nothing in §1, §2, §3, §4, §5, §6a, §6c, §6d, §6e or §7 was touched at all.** §1a–§1d, §2, §3,
§4a, §4b, §5 and §7 pass byte-unchanged across the move — which is what makes *"the extraction
changed no pixel"* a measurement instead of a sentence.

⚠ **§9's `expandSettledRun()` click was KEPT, deliberately.** It is no longer *necessary* to reach
the trigger, but a case that clicks and then asserts must still pass — that is exactly the
forward-compatibility 243-01 designed the helper for, and deleting it would delete the evidence
that the helper's claim was true.

---

## 3. The measurement D-243-07 demands — numbers, not a claim

Commands, run at base `149360176` (`git show 149360176:<path> | grep -c …`) and at HEAD:

| File | `useState[(<]` | `useEffect(` | props | `wc -l` | `numstat` (add/del) |
|---|---|---|---|---|---|
| `MessageItem.tsx` base | **3** | **0** | **5** | 707 | — |
| `MessageItem.tsx` HEAD | **3** | **0** | **5** | 726 | **19 / 0** |
| `RunCard.tsx` base | 4 *(see below)* | 2 | 2 | 729 | — |
| `RunCard.tsx` HEAD | **2** | **2** | **2** | **710** | **20 / 39** |

**`MessageItem` gained a MOUNT, not state ownership.** `useState` unchanged, `useEffect` unchanged,
`interface Props` unchanged at five members, and **zero deleted lines** — all nineteen added lines
are one JSX element and its docblock. Phase 227's discharge is intact; this phase did not
re-hollow it.

**`RunCard` shows a real deletion.** `-39 / +20`, `wc -l` **729 → 710**, and one real `useState`
fewer.

⚠ **`grep -c "useState[(<]"` reads 4 → 2 on `RunCard`, and the honest number of state hooks is
3 → 2.** The fourth base match was at `:486` — a *comment* inside the `FoldTrigger` docblock
(*"the DEFAULT is untouched — `useState(false)` above is correct"*) which left with the block.
Both figures are recorded here and in the ledger section so the next reader running the same grep
sees 4 → 2 and knows why, rather than concluding two state hooks were removed.

`prop count` command: `sed -n '/^interface Props {/,/^}/p' <file> | grep -cE "^\s+[a-zA-Z]+\??:"`.

---

## 4. The one-renderer proof

Wider than §10c's fence (which scopes to `components/chat/**`), and it agrees:

```
grep -rnE "(^|[^=])\{\s*(message\.)?reasoningContent\s*\}" frontend/src --include=*.tsx
  → frontend/src/components/chat/ThinkingBlock.tsx:112:          {reasoningContent}
```

**One JSX-child render of the reasoning value in the entire frontend.** `grep -rc reasoningContent`
across `frontend/src` (mentions of every kind, the number the plan asked for):

| File | count | what the occurrences are |
|---|---|---|
| `__tests__/ThinkingBlock.characterization.test.tsx` | 24 | the net |
| `chat/ThinkingBlock.tsx` | 7 | 1 render · 1 prop decl · 1 destructure · 1 self-guard · 3 docblock |
| `chat/RunCard.tsx` | **4** (before: **4**) | see below |
| `chat/MessageItem.tsx` | 3 | `:375` the prop pass; `:207` + `:612` pre-existing banner-label *signal* reads (no render) |
| `lib/api/threads.ts` · `types/index.ts` · `StreamsProvider.tsx` · `lib/toolMeta.ts` | 1–2 each | wire type / normalizer — untouched |

**`RunCard`'s four remaining occurrences, named individually as the plan requires:**

| Line | Kind |
|---|---|
| `:472` | comment — the Phase 076.2 contract's state-1 clause, quoted where it left from |
| `:473` | comment — the contract's state-2 clause |
| `:484` | comment — explaining why the guard is written out rather than left as a ternary arm |
| `:487` | **CODE — the only one**: `{!message.reasoningContent && isStreamingNow && message.isPlanning && (` |

So exactly **one** code occurrence, and it is state 2's guard — the mutual exclusion §6b pins,
now held by construction rather than by the shape of a ternary chain that no longer exists.

**The mechanical acceptance greps, all of them:**

```
tool_calls in ThinkingBlock.tsx ........ 0
memo( ................................. 0
export default ........................ 0
type="button" ......................... 1
dangerouslySetInnerHTML ............... 0
cancelRun(|stopThread(|stopStream(|lock.runId ... 0
grep -n "<ThinkingBlock" MessageItem.tsx → one line (374), containing neither tool_calls nor key=
```

---

## 5. The `thinkingOpen` remount decision 243-01 flagged

243-01's SUMMARY flagged this explicitly as unpinned and named it a thing 243-02 must decide
(`243-PATTERNS.md` §F.8). **Decided: NO `key` on the mount.**

**The reason is measured, not preferred.** `RunCard.tsx:92-96` resets **`userExpanded` only** on a
`message.id` change; `thinkingOpen` has no reset at all, so an open fold survives the temp-id →
DB-id reconcile today. `MessageList.tsx:220` keys a run-bearing assistant row by `run-${runId}`,
which is **stable** across that swap, so nothing remounts. `key={message.id}` is the cheap answer
and would **close an open fold on every reconcile** — a behaviour change smuggled in as tidiness.

It is pinned **twice, in two registers**, so the two cannot drift apart: **§12** fences the mount
expression on source for `key=`, and **§13** renders a run-bearing message, opens the fold,
re-renders with a changed `id` and the same `runId`, and asserts the prose is still on the page.

---

## 6. Neighbour regression checks — the ROADMAP's named failure mode

> *"reasoning appears on pure-text replies but the streaming cursor, the narration banner or the
> citation branch regress with it, and nobody notices because the criteria only asked about
> reasoning."*

Each named, with its covering suite and its result. **None is recorded as unchecked.**

| Suspect | Where it lives | Covering suite(s) | Result |
|---|---|---|---|
| **The streaming cursor** | `MessageItem.tsx` — `{isStreaming && !hasRunningTools && <span … animate-pulse …/>}` | `src/__tests__/components/MessageItem.test.tsx` — cases *"shows cursor when streaming with non-empty content"*, *"does not show streaming indicators when not streaming"*, *"shows thinking indicator when streaming with empty content"* | **PASS** — 24/24 |
| **The narration banner** (two distinct things, both checked) | `StreamingNarration` at `MessageItem.tsx:425` · the **harness** advancing banner | `src/__tests__/components/StreamingNarration.test.tsx` · `src/components/chat/__tests__/MessageItem.harnessBanner.test.tsx` | **PASS** both |
| **The citation branch** | `CitedMarkdown` / `CitationList` / `AbsenceHint` chain | `CitationList.test.tsx` · `CitedMarkdown.test.tsx` · `AbsenceHint.test.tsx` · `CitationPeek.test.tsx` · `CitationUI.a11y.test.tsx` · `CitationCard.test.tsx` | **PASS** — 55/55 |

⚠ **`MessageItem.tsx:425` was deliberately NOT touched** (D-243-14). Both it and the RunCard mount
at `:359-361` gate on the same predicate, which is why three documents named the wrong line — and
the two want opposite treatment. `:425` is **243-05's**.

### The in-scope suite run

```
npx vitest run RunCard.test.tsx RunCard.timer.test.tsx RunCard.characterization.test.tsx
  MessageItem.{clamp,fallbackNotice,finalOutputs,memo,sticky}.test.tsx MessageItem.test.tsx
  MessageItem.{blockedNotice,cancelledRun,capPaused,continueButton,harnessBanner,retry}.test.tsx
  CitationList.test.tsx WorkspacePanel.test.tsx ThinkingBlock.characterization.test.tsx
  --maxWorkers=2

 Test Files  18 passed (18)
      Tests  228 passed (228)
```

`WorkspacePanel.test.tsx`'s RAW `chat/**` sweep passes **with the new file inside its glob** —
`ThinkingBlock.tsx` is production source under `chat/`, so unlike 243-01's test file it is NOT
exempted by `productionOnly()`, and the forbidden-spelling grep over it reads **0**.

---

## 7. The gates

### The shared count gate — a SET DIFF against `243-BASELINE.md`

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs      (from the repo root)

  ThinkingBlock.characterization.test.tsx      17      23      +6     ← run 1, pin not yet raised
  total                                      7187    7963    +776
  total 7963  ·  failed 0  ·  pinned total 7187
count gate OK — 250/250 pinned files present, no per-file decrease, 0 failing.
```

After raising the pin (task 2):

```
  total                                      7193    7963    +770
  total 7963  ·  failed 0  ·  pinned total 7193
count gate OK — 250/250 pinned files present, no per-file decrease, 0 failing.
```

**The failing set is EMPTY** — a proper subset of `243-BASELINE.md`'s two inherited
`sketchComposition.test.tsx` cases, exactly as its corrected *subset, never equality* criterion
requires. ⚠ **This is not evidence the inherited flake is fixed**: `SEED-171`'s suite failed on
2026-09-06, 2026-09-10 and at this phase's own baseline on 2026-09-11, and **one green sample of a
flaky suite is not proof of innocence.** Nothing here touched `src/components/library`. The worker
cap was `2` on every invocation and was **neither adjusted nor needed**; the JSON-first triage
procedure was never entered because nothing went red.

**The arithmetic closes with no residual.** 243-01 closed at `total 7957 · pinned 7187 · 250 files`.
Now `7963` (= 7957 **+6**) and pinned `7193` (= 7187 **+6**), still 250 files. The whole delta is
this plan's six new cases; nothing else moved, and no per-file decrease appears on either run.

**The pin was read from the gate's own `actual` column** (`17  23  +6`), never hand-counted, and
the cell records the full attribution: §10a/§10b/§10c + §11 + §12 + §13. ⭐ It also records the
distinction that matters for the next reader: **§8 and §9 were INVERTED IN PLACE, not dropped** —
a fixed defect keeps its case, and only the count can tell a fixed defect from a deleted one.

### Typecheck — a SET DIFF, never a count

```
npx tsc -p tsconfig.app.json --noEmit   →  67 errors
grep -E "ThinkingBlock|MessageItem\.tsx|RunCard\.tsx" over that output  →  none
```

**67, identical to the base's 67, and not one of them names a file this plan touched.** Since the
only changed files are those three and none appears in the output, the error set is unchanged.
`npx tsc --noEmit` was NOT used — `tsconfig.json` is solution-style and checks zero files here.

### The hot-file ledger gate — exit 1, and that is CORRECT

Before (at the phase base):

```
G-5 CANNOT FIRE ON 3 FILE(S) — they have no ledger row:
  [no-row] frontend/src/components/chat/ThinkingBlock.tsx   (named by 243-02-PLAN.md, 243-04-PLAN.md)
  [no-row] frontend/src/hooks/useFollowScroll.ts            (named by 243-03-PLAN.md)
  [no-row] frontend/src/lib/throttle.ts                     (named by 243-03-PLAN.md)
EXIT=1
```

After:

```
  scan list: 250 rows · subject: 22 files · watched: 8
G-5 CANNOT FIRE ON 2 FILE(S) — they have no ledger row:
  [no-row] frontend/src/hooks/useFollowScroll.ts   (named by 243-03-PLAN.md)
  [no-row] frontend/src/lib/throttle.ts            (named by 243-03-PLAN.md)
EXIT=1
```

⛔ **The `[no-row]` set shrank to exactly the two files 243-03 owns. `ThinkingBlock.tsx` is gone
and nothing new appeared** — which is the plan's stated criterion. `exit 0` is unreachable at this
wave because the gate aggregates `files_modified` across **every** `*-PLAN.md` in the phase
directory, and demanding it would be the same unreachable-criterion defect `243-BASELINE.md`
eliminated for the count gate.

### The CLAUDE.md size gate

```
node scripts/check-claude-md-size.cjs
  CLAUDE.md   87707 chars   58.5% of limit   headroom 62293   [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

**32,293 chars below the 120,000 warn band, 62,293 below the 150,000 hard limit.** No
`[disposition-too-long]`, no `[duplicate-row]`, no `[malformed-row]` — but see deviation 5: it
**did** fire on the first attempt, and it fired correctly.

⚠ **A measurement caveat worth naming:** the working-tree file is LF here (the python edits wrote
LF; git restores CRLF on checkout under `autocrlf`), so this figure is ~600 chars lower than a
freshly-checked-out CRLF copy would read. `git diff --numstat` confirms the committed change is
**2 added / 2 removed** — two table rows, not a line-ending rewrite.

---

## 8. The ledger — three rows, three sections, ONE commit (`3de4a0cd3`)

Every triple **re-derived from git**, never copied forward, with six-digit dated quick-task buckets
**named** rather than silently dropped.

| File | cell read | **measured 2026-09-11** | verdict |
|---|---|---|---|
| `chat/RunCard.tsx` | `26 / 12 / 728` (STALE) | **28 / 14 / 710** | ⭐ **G-5 DISCHARGED (243-02)** |
| `chat/MessageItem.tsx` | `62 / 33 / 702` (STALE) | **67 / 33 / 726** | G-5 DISCHARGED at 227, **NOT re-hollowed** here |
| `chat/ThinkingBlock.tsx` | *(no row — `[no-row]`)* | **1 / 1 / 117** | does not fire; row exists so it never becomes invisible |

Commands, per file:
`git log --oneline -- <f> | wc -l` · `git log --format=%s -- <f> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | grep -vE '^[0-9]{6}$' | sort -u | wc -l` · `wc -l <f>`.

**Non-phase buckets, named per the ledger's own habit:**

- `RunCard.tsx` — the raw recipe prints **17** buckets; three are not phases (`chat`, `streaming`,
  `ui`), so the phase count is **14**. `streaming` is the untagged 075.x fix/revert pair this row
  already documents. **ZERO six-digit buckets.**
- `MessageItem.tsx` — **three six-digit dated quick-task buckets, NAMED: `260328`, `260405`,
  `260630`**, exactly as the plan predicted. Plus non-numeric buckets (`phase`,
  `Add Module 8: Sub`, four whole untagged subjects) that the numeric filter drops. Phase count
  **33**.
- `ThinkingBlock.tsx` — one bucket, `243`.

**Previous values are preserved BESIDE the new ones** in every section. `RunCard`'s section keeps
its *"passes forward COMPLETELY UNTOUCHED AND UNDISCHARGED"* sentence visible above the discharge,
because being able to see how long it stood is the point.

`git show --stat 3de4a0cd3` names exactly two files — `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` —
so the same-commit sync rule holds in both directions: no row without a section, no section
without a row. `ThinkingBlock.tsx` gets a **docs** row and section only; it does not fire and does
not belong in CLAUDE.md's G-5-FIRING table.

---

## Deviations from plan

### 1. [Rule 1 — the plan's own criterion is refuted by measurement] §6b had to change, so it is **§8, §9 AND §6b**, not "§8 and only §8"

- **Found during:** Task 1, the first green run after the move.
- **Issue:** the plan's acceptance criterion says *"the SUMMARY states explicitly which cases were
  edited (§8 and only §8)"*. Measured: **§9 and §6b also had to change**, and both for structural
  reasons the plan's own body actually predicts.
  - **§9** — the orchestrator's brief named it (*"§8 … and §9 … Both invert here"*); the plan's
    criterion contradicts its own narrative. Exactly **one** assertion inverts:
    `expect(screen.queryByTestId("thinking-trigger")).toBeNull()` before the run row is opened.
  - **§6b** — ⚠ **this one nobody predicted.** Its positive control was
    `expect(triggerText()).toBe("Thinking...")` rendered through `<RunCard>` directly, to prove
    state 1 had taken the branch. After the move `RunCard` does not render state 1 at all, so the
    control threw `Unable to find an element by: [data-testid="thinking-trigger"]`.
- **Fix:** §6b's **render line and nothing else** moved from `<RunCard message={msg} isStreaming />`
  to `<MessageItem message={msg} isStreaming />`. **Both absence assertions are byte-unchanged.**
  The repair is strictly *stronger* than the original: the fixture is tool-bearing and streaming,
  so the card is still mounted and the two absences are still measured against its rendered body —
  and the exclusion is now asserted across the very seam this plan created. The reason is written
  into the case so the next reader does not re-anchor it.
- **Files:** the net only. **Commit:** `2a62acb60`.

### 2. [Finding — the plan contradicts itself on the ledger gate's exit code]

`<verification>` says *"`check-hot-file-ledger.cjs 243` and `check-claude-md-size.cjs` both exit
0"*; task 3's `<acceptance_criteria>` says the ledger gate *"**exits 1 at this wave, and that is
CORRECT**"* and specifies a set diff. **The acceptance criteria were followed** — they are the
specific, measured statement, and `exit 0` is provably unreachable while 243-03's two files have no
row. Recorded rather than silently resolved.

### 3. [Rule 2 — mechanical criteria a comment can break] two needles removed from the new file's own prose

`grep -c 'type="button"'` read **2** and `grep -c dangerouslySetInnerHTML` read **1** on first
write, because the docblock *explained* both. Task 1's criteria demand **1** and **0**. Reworded to
*"an explicit non-submit button type"* and *"no raw-HTML escape hatch"*, with a line saying the
forbidden API is deliberately not spelled — the 187-24 trap, and the same discipline
`MessageInput.tsx` records about `onStop`. ⚠ **A fence whose needle appears in the comment
explaining it is a lie about itself.**

### 4. [Finding — a grep the plan specified counts comments] `RunCard`'s `useState` reads 4 → 2

The plan expects *"one `useState` fewer"*. `grep -c "useState[(<]"` reads **4 → 2** because the
base's fourth match was a **comment** at `:486` inside the `FoldTrigger` docblock, which left with
the block. Real state hooks went **3 → 2**. Both numbers are published, here and in the ledger
section, so the next reader running the same command is not misled by either.

### 5. [The gate caught me, and it was right] `[disposition-too-long]` on the new ledger row

`ThinkingBlock.tsx`'s first disposition cell measured **220 chars against the 200 cap** and
`scripts/check-claude-md-size.cjs` failed it by name and line. Shortened; the narrative it carried
is in the file's own section, which is precisely the split the cap exists to force. ⭐ **Recorded
because a guard nobody has seen fire is not a guard** — this one fired, in the turn the prose was
authored.

### 6. [Additive, beyond the plan's list] two `data-testid`s and one extra fence case

`ThinkingBlock` carries `data-testid="thinking-block"` on its root (the folder's outermost-element
convention, as `StreamingNarration` does) and `thinking-body` on the body div. **No case depends on
either** — §5 still finds the body by its text — so neither weakens anything; they exist so a later
plan has an anchor. §10b (the needle's positive control) is a third case in a section the plan
described as one.

---

## Known Stubs

None. Every path this plan touches renders real data from the message it is given; the only
`return null` is the self-guard, which is the shipped state-3 behaviour moved verbatim.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema shape is touched.
**T-243-02-01 is mitigated as specified:** the reasoning string renders as React text children
only — `grep -c dangerouslySetInnerHTML` over `ThinkingBlock.tsx` is **0**, and §12 fences it.
**T-243-02-02 (information disclosure) stands as ACCEPTED, and it is the one operator-visible
consequence worth restating:** reasoning is now drawn on ~31% more messages. No query widened, no
endpoint added, no org boundary crossed — the data was already persisted per-message and already
returned to this user's own client under RLS. It is exactly what CHAT-04 asks for.
**T-243-02-SC:** no package was installed; nothing was added to `package.json`.

---

## ⚠ Solo running — which evidence is MECHANICAL and which is JUDGEMENT (D-243-12)

Per D-243-12, mechanical evidence is not weakened by solo running; judgement calls are, and they
are named as such rather than presented as findings.

**Mechanical — stands without a second reader.** The RED run and its five failing case names; the
final `23 passed (23)`; the 18-suite / 228-test in-scope run; the 6-suite / 55-test neighbour run;
the `git diff` hunk headers and the extracted `-` assertion lines; every `grep -c`; the six-column
before/after table with the commands that produced it; `numstat 19/0` and `20/39`; the gate's own
`17 23 +6` column and the two verdict lines; the `+6 / +6 / 250` arithmetic against 243-01; the
67-error typecheck naming none of this plan's files; both ledger-gate outputs, before and after;
the size gate's `[disposition-too-long]` fire and its clearance; the re-derived triples.

**Judgement — a solo call, and named as one.**

1. **That §6b's repair honours its intent rather than quietly lowering its bar.** I argue above
   that rendering through `MessageItem` is *stronger* — the card is still mounted, the absences are
   still measured against its body. But it IS a substitution of my reading for the plan's *"§6
   anchors to the card"* instruction, taken alone, in the same sitting as the change that forced it.
2. **That "no `key`" is the right remount decision.** The measurement (stable `run-` key, no reset
   on `thinkingOpen` today) is mechanical; the *decision to preserve* that behaviour rather than
   normalise it is a design call no second reader has examined. If a future surface wants a fold
   that resets per message, §12 and §13 will both have to be revisited **deliberately**, which is
   the outcome I optimised for.
3. **That leaving state 2 behind is complete rather than half-done.** The elapsed-derivation cost is
   real and measured, but *"a planning placeholder is not a reasoning renderer"* is an argument
   about meaning, not a measurement. It is written into three places (the RunCard comment, the
   ThinkingBlock docblock, the ledger section) so a reader who disagrees can find it.
4. **That the three neighbour suspects are the right three.** They are the ROADMAP's own list and
   each has a green covering suite — but a suite's existence is not proof it covers the regression
   the ROADMAP imagined, and **no browser was opened**. G-4 lived-experience UAT on this surface is
   still owed to the phase, and this plan does not discharge it.
5. **That 243-04's target is now unambiguous.** I believe the §5 class-token pin and the label cases
   moved cleanly with the block; I did not re-derive whether `leading-relaxed` or
   `text-muted-foreground` carry design weight — 243-01 flagged that same gap and it is unchanged.

**One green sample is not proof of innocence** — that applies to the inherited `sketchComposition`
pair, and it applies to the three neighbour suites too.

---

## Self-Check: PASSED

- `frontend/src/components/chat/ThinkingBlock.tsx` — **FOUND**
- `frontend/src/components/chat/RunCard.tsx` — FOUND (710 L, `-39/+20`)
- `frontend/src/components/chat/MessageItem.tsx` — FOUND (726 L, `+19/-0`)
- `frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx` — FOUND (23 cases)
- `scripts/vitest-count-gate.cjs` — FOUND (pin 23)
- `docs/HOT-FILE-LEDGER.md` — FOUND (3 rows, 3 sections)
- `CLAUDE.md` — FOUND (2 rows updated)
- commit `2a62acb60` — FOUND in `git log`
- commit `4bbd2c724` — FOUND in `git log`
- commit `3de4a0cd3` — FOUND in `git log`
- `git status --porcelain -- frontend scripts docs CLAUDE.md` at close — **EMPTY**
