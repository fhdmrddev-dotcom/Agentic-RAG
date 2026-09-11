---
phase: 244-the-chat-shell-and-the-composer
plan: 01
subsystem: frontend/chat-shell
tags: [SHELL-01, BUG-260828-08, BUG-260911-02, BUG-260816-03, layout, scroll, chat-list]
requires: []
provides:
  - "a four-link `min-h-0` chain so the message list scrolls INSIDE the chat pane"
  - "a `?raw` + `import.meta.glob` fence pinning that chain and the whole `<ScrollArea>` inventory"
  - "a driven trace for BUG-260911-02, and the click sink it found"
  - "a bounded folder chip and an absent Unfiled chip on the thread row"
  - "the HOT-FILE-LEDGER rows ChatHistoryColumn.tsx and useThreads.ts never had"
affects:
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/components/layout/ChatHistoryColumn.tsx
tech-stack:
  added: []
  patterns:
    - "min-h-0 on EVERY link from a fixed-height root to a scroller (DocumentDetailPanel.tsx:257/300)"
    - "empty ⇒ render nothing (ActiveConnectorChips.tsx:24 / AttentionPopover.tsx:75 / PendingAskCard.tsx:733)"
    - "pointer-events-none on an always-rendered overlay, pointer-events-auto on its real controls"
key-files:
  created:
    - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.clickPath.test.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.rowIdentity.test.tsx
    - .planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md
  modified:
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageList.tsx
    - frontend/src/components/layout/ChatHistoryColumn.tsx
    - frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260911-02-first-click-on-a-thread-selects-it-but-does-not-open-it.md
    - .planning/reported-bugs/BUG-260816-03-thread-row-identity-icon-folder-chip-title-truncation.md
decisions:
  - "The min-h-0 chain is FIVE sites, not the four the plan named — ChatArea.tsx has TWO column roots and the fence found the second."
  - "BUG-260911-02 is NOT closed: neither check it asked for could be run. A fourth candidate cause was found, named with file:line, and fixed as a defect in its own right."
  - "BUG-260816-03 (a) is deferred in writing with a re-open trigger; the report stays `folded`."
  - "ChatHistoryColumn.tsx + useThreads.ts ledger rows landed in Task 1's commit, not Task 3's — one contiguous registry edit, fewer conflicting hunks for the wave merge."
metrics:
  duration: "~55 min"
  completed: 2026-09-11
  tasks: 3
  commits: 6
  files_changed: 14
---

# Phase 244 Plan 01: The chat shell's scroll frame and the thread row — Summary

**Bounded the chat frame with a five-site `min-h-0` chain (the plan named four; the fence found the
fifth), traced `BUG-260911-02` to an invisible click sink nobody had considered and fixed it without
claiming the bug closed, and made the thread row spend its width on the thread instead of on the
folder.**

⚠ **Solo run (D-244-21). Gemini is unavailable, so every verification below is a SELF-verification.
Nothing here was reviewed.**

---

## What shipped

| # | Task | Commits |
|---|---|---|
| 1 | Bound the chat frame — the `min-h-0` chain, fenced | `d8035798d` (RED) → `d5b3a1257` (GREEN) |
| 2 | Trace `BUG-260911-02` before touching a handler | `4cdbdd7fa` (RED) → `85329f554` (GREEN) |
| 3 | The thread row spends its width on the thread | `2002f5623` (RED) → `e08c2b448` (GREEN) |

Base: `223b3ea4fd2b9cb229a283729567de4981fe8b1c` · branch `worktree-agent-af81d0fd3f9fe65f8`.

---

## Task 1 — the scroll frame

### The RED, quoted verbatim

The fence was written **before** the fix and driven against the shipped tree. **5 of 5 failed:**

```
AssertionError: expected 'grid min-w-0 flex-1 overflow-hidden m…' to contain 'min-h-0'
AssertionError: expected 'min-w-0 overflow-hidden' to contain 'min-h-0'
AssertionError: expected 'flex flex-col h-full bg-background' to contain 'min-h-0'
AssertionError: expected ' className="flex-1"' to contain 'min-h-0'
AssertionError: /src/components/chat/MessageList.tsx mounts an UNBOUNDED <ScrollArea>:
                className="flex-1": expected false to be true
 Test Files  1 failed (1)
      Tests  5 failed (5)
```

### ⭐ The finding: the chain is FIVE sites, not four — and the fence found the fifth, not the plan

The plan (and `244-PATTERNS.md` § 1) named **one** `ChatArea.tsx` site, `:552`, the thread branch.
After that edit landed, **test 4 stayed RED**:

```
AssertionError: expected 'flex flex-col h-full bg-background' to contain 'min-h-0'
```

`ChatArea.tsx` has **two** roots carrying `flex flex-col h-full bg-background` — the `if (!thread)`
**welcome branch** at `:474` is the other, and it carries the identical link-4 obligation. Both now
carry `min-h-0`.

⛔ **The transferable lesson is about the ASSERTION, not the two tokens.** The fence used
`String.match()`, which returns the **first** occurrence — so it was a coin flip which of the two
sites it guarded, and it happened to guard the one the plan had not named. It was widened to
`matchAll` over **every** such root, so a third `ChatArea` branch cannot ship unbounded. **A
single-match source fence guards an arbitrary call site.**

### What was changed

Class tokens only — no state, no prop, no branch, no import (D-243-08: no frame rewrite).

| Site | Before | After |
|---|---|---|
| `ChatLayout.tsx` grid track | `grid min-w-0 flex-1 overflow-hidden …` | `grid min-w-0 min-h-0 flex-1 …` |
| `ChatLayout.tsx` `<main>` | `min-w-0 overflow-hidden` | `min-w-0 min-h-0 overflow-hidden` |
| `ChatArea.tsx` thread root | `flex flex-col h-full bg-background` | `flex flex-col h-full min-h-0 bg-background` |
| `ChatArea.tsx` **welcome root** | `flex flex-col h-full bg-background` | `flex flex-col h-full min-h-0 bg-background` |
| `MessageList.tsx` `<ScrollArea>` | `flex-1` | `min-h-0 flex-1` |

### ⛔ What this does NOT establish

**A fence is a presence assertion and does not satisfy `SHELL-01`.** jsdom performs no layout, so
nothing in the suite can observe the rail moving or the dead space under the composer. That sentence
is written into the suite's own docblock, as the plan required. **D-244-19's measured bound —
`document.scrollingElement.scrollHeight <= clientHeight` plus the rail's leaf bounding rect
unchanged after scrolling, at ≥3 viewport heights × panel closed and open — is a G-4 row in
`244-VALIDATION.md` and is OWED.** ⚠ `scrollTop` is not the reader's position.

---

## Task 2 — `BUG-260911-02`, traced rather than patched

Full trace: `244-01-BUG-260911-02-TRACE.md`. Driven suite:
`ChatHistoryColumn.clickPath.test.tsx` (10 cases).

### ⛔ The bug is NOT closed, and the two checks it asked for are still owed

| Check | Verdict |
|---|---|
| Production | ⛔ **could not check — no browser-driving tool is available to this executor** |
| `develop` at this base | ⛔ **could not check — same reason** |

The report's own first instruction is *"whether it reproduces on `master` / `production` … Nobody
has checked."* **That is still true.** This agent's tool set is `Read`/`Write`/`Edit`/`Bash`/
`Grep`/`Glob`; no Chrome MCP and no Supabase MCP tool is present, and the symptom is a pointer
interaction on an authenticated surface.

⚠ **And the DB read the plan suggested could not have settled it anyway** — the symptom is that the
*client* does not render a thread it has already selected, so rows exist in both the reproducing and
non-reproducing case and no `SELECT` discriminates. **A cheap check that cannot discriminate is not
evidence**, which is worth more than the tooling gap.

`status:` stays `folded`; `re_open_trigger` now names the exact click to make.

### What WAS driven

**C-6 candidate (b) — "a re-render discards the first `setState`" — REFUTED**, two observations:
one click on the real `<button>` calls `onSelectThread` **exactly once**; and
`useThreads.selectThread`'s `useCallback` body is **exactly** `setSelectedThread(thread)` (asserted
on source, because the property is *the absence of a second step*).

**C-6 candidate (c) — "it is `ChatArea`'s render gate" — REFUTED AS AN EXPLANATION, and this is the
sharpest thing the trace found.** The report observes a **highlighted row** and the
*"How can I help you?"* pane **simultaneously**. Those two cannot both come from selection state,
because they read the **same value**: `ChatArea.tsx:472` gates on `if (!thread)`, `thread` is
`selectedThread`, and the row's highlight is `selectedThread?.id === thread.id`. Driven: the welcome
copy occurs exactly once in `ChatArea.tsx` and sits inside that branch.

⭐ **So the highlight was almost certainly HOVER, not selection** — an un-selected row carries
`hover:bg-accent/40` and the `⋯` is revealed by `group-hover`, both under a resting pointer on any
row (driven, with the selected-state contrast as its control). **That reframes the symptom from
"selected but not opened" to "the click did not select at all."**

### ⭐ A FOURTH candidate C-6 did not list — the invisible click sink

`frontend/src/components/layout/ChatHistoryColumn.tsx:220-227` (pre-fix). The per-row actions
container is **always rendered** and merely `opacity-0` at rest (an A11Y-01 decision: CSS-gated,
never render-gated). Its class list, quoted from the failing assertion:

```
absolute inset-y-0 right-0 flex items-center gap-1 pl-10 pr-1.5
bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg
opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100
```

`absolute inset-y-0 right-0` with a **`pl-10` transparent scrim**, painted **after** the row
`<button>` — so it **wins the hit test over the right-hand strip of every row while invisible.** A
pointer landing there hits a `div` with no handler: the thread is not selected, while the hover
treatment and this very reveal both fire. **That is the reported appearance exactly.**

⛔ **The evidence is an ASYMMETRY, not a hunch.** Its sibling — the SEED-064 run-dot overlay at
`:203-206`, identical `absolute inset-y-0 right-0` geometry — carries `pointer-events-none` and says
why in its own comment: *"`pointer-events-none` keeps it click-through."* **One overlay was reasoned
about and the other was not.** Both halves are driven: a case asserts the sibling's token (the
control) and a case asserts the actions container's (the finding, seen RED).

**Fixed** — `pointer-events-none` on the container, `pointer-events-auto` on both controls, with a
behavioural case proving the options button still opens Rename + Delete. ⛔ **Shipped as a defect in
its own right, NOT as a closure**: an invisible element swallowing clicks on a surface's primary
action target is wrong either way, and jsdom cannot hit-test, so the browser confirmation is exactly
what the re-open trigger asks for.

### ⚠ One inference in the bug report does not hold

The report says *"clicking via the element reference (`ref`) … has the same effect, so it is not a
hit-test or pointer-target problem."* **Driven false as an inference**: a synthetic click on a
*wrapper* never reaches a handler bound to a *child*. A failing ref click is **consistent with** a
target problem, not evidence against one.

### ⛔ Compliance with the plan's negative criterion

The strings "two-step" and "select-then-open" appear in this summary and in the trace **only as
readings being refuted**, never as a stated cause. C-6 measured that no such handler exists, and
the trace re-drove it.

---

## Task 3 — the thread row

### The RED, quoted verbatim (3 of 7)

```
AssertionError: the folder chip is unbounded: inline-flex items-center gap-1 text-[10px]
  shrink-0 whitespace-nowrap text-muted-foreground:
  expected 'inline-flex items-center gap-1 text-[…' to match /\bmax-w-\[?[\w.%]+\]?/
AssertionError: expected <span …(1)></span> to be null        (the "Unfiled" chip)
+ the chip's title= attribute (part of the same bound)
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```

The 4 green cases are **controls, not filler**: the title's flex budget, the positive chip case
(a negative alone would pass on a component that renders nothing), the FOLDER-mode "Unfiled" **group
header** (untouched), and the shipped full-title tooltip.

### What changed, and what deliberately did not

**(c) the chip is bounded** — `max-w-[96px] truncate` plus `title={folderLabel(...)}`. Measured in
the report: a 134 px chip left **85 px of a 485 px title — 17.5 %, roughly one word**, and every
folder-scoped row sampled was truncated. ⛔ *Organising your work made your work harder to find.*
**The title span is UNCHANGED** — `truncate flex-1 min-w-0` was already correct; the defect was the
chip's unbounded `shrink-0`, exactly as the report's own hypothesis said.

**(b) an unscoped row renders `null`** — the italic "Unfiled" was on **471 of 524 rows (90 %)**.
⭐ This rides the shipped `empty ⇒ render nothing` rule (`ActiveConnectorChips.tsx:24`,
`AttentionPopover.tsx:75`, `PendingAskCard.tsx:733`): an application of an established pattern, not
a new design. ⛔ **`folderLabel` itself is UNTOUCHED** — `groupByFolder` still needs the "Unfiled"
group label in FOLDER mode, pinned by its own case. *The absence decision belongs to this row, never
to the shared vocabulary leaf.*

⚠ **One shipped test PINNED the defect and was re-baselined DELIBERATELY.**
`ChatHistoryColumn.test.tsx`'s *"renders a folder chip (or 'Unfiled') per row"* asserted
`getByText("Unfiled")` in DATE mode — the 90 % chip. It now asserts `queryByText("Unfiled")` is
`null`, **with the reason written into the case** rather than the assertion quietly deleted.

### ⛔ Sub-defect (a) — deferred IN WRITING, with both structural reasons

*One hardcoded icon for every thread kind* stays shipped. **Not "out of scope" — here is why:**

1. `Thread` (`frontend/src/types/index.ts:7-14`) carries **no** kind/workflow discriminator, so no
   row can branch until `GET /threads` grows a field. That is a **feed change**, present in no
   source artifact for this phase.
2. The report itself says *"G-2 FIRES, HARD, AND THIS ROUTES TO `/gsd:sketch` BEFORE ANY SPEC OR
   DISCUSS"* — and **D-244-18 rules that G-2 fires on exactly one surface in Phase 244** (sketch
   236, the composer). A second sketched surface would contradict a locked decision.

**`BUG-260816-03` stays `status: folded` — NOT `closed`** — with (a) named as the open half in both
the frontmatter `re_open_trigger` and a body section. **Re-open trigger:** *the next phase that adds
a thread-kind field to `GET /threads`, or the next chat-list sketch* — and the trigger text suggests
sketching it with SEED-155's library card so the row and `WorkflowCard` do not invent two visual
languages for "this is a workflow".

⭐ **C-7 held: the report was partly already built.** The row already had a lead icon, a truncating
title with `title=` and `HighlightTitle`, and a mode-switched chip. **What was missing was a BOUND
and an ABSENCE, not a chip.** The work was planned against the markup, not against the report.

---

## Registry work — both gate knobs, both ledger registers

**`scripts/vitest-count-gate.cjs` — three suites, BOTH knobs, verified by two greps each.**
`src/components/layout` is **not** a bare TARGETS directory entry (checked, not assumed), so every
suite needs a `TARGETS` path line **and** a `BASELINE` pin. `git diff --numstat` on this file reads
**`40 0`** — **zero deletions**, satisfying T-244-01-02.

| Suite | Pin |
|---|---|
| `ChatLayout.scrollFrame.test.tsx` | 5 |
| `ChatHistoryColumn.clickPath.test.tsx` | 10 |
| `ChatHistoryColumn.rowIdentity.test.tsx` | 7 |

⚠ **Recorded rather than left unlooked-for:** `ChatHistoryColumn.test.tsx` (20 cases) and
`.a11y.test.tsx` (6) have shipped since Phase 156 and are in **NEITHER** knob —
`grep -c ChatHistoryColumn scripts/vitest-count-gate.cjs` read **0** before this plan. They are left
unadopted (this plan did not author them and cannot vouch for their stability) but are **named** in
a comment beside the new TARGETS lines. An unadopted suite someone wrote down is a different thing
from one nobody noticed.

**Ledger — three triples re-derived, two rows added.**

| File | row read | re-derived at base | inherits |
|---|---|---|---|
| `ChatLayout.tsx` | `49 / 25 / 997` | `49 / 25 / 997` ✅ correct | `50 / 26 / 1005` |
| `ChatArea.tsx` | `70 / 35 / 678` | `70 / 35 / 678` ✅ correct | `71 / 36 / 686` |
| `MessageList.tsx` | `20 / 8 / 300` | **`21 / 9 / 300`** ⚠ STALE a THIRD time | `21 / 9 / 307` |
| `ChatHistoryColumn.tsx` | **no row** | `5 / 1 / 480` | `7 / 2 / 513` |
| `useThreads.ts` | **no row** | `4 / 2 / 64` | `4 / 2 / 64` |

⭐ **C-8 confirmed against D-244-20.** `244-CONTEXT.md` D-244-20 claims *"all of this phase's hot
files HAVE ledger rows"*; the gate names **nine** with none. Both of this plan's are now rowed **and
sectioned in the same commit**, at their SECOND phase and below the G-5 threshold — the
`settingsSearchPayload.ts` precedent: *a row is added at CREATION, not at the third phase.*
**A claim that is present and WRONG answers the auditor with `satisfied` and stops the audit.**

⚠ **`MessageList.tsx`'s `20 / 8 / 300` is the third stale reading of that one row** (`19/8/267` →
`20/8/292` → `20/8/300` → `21/9/300`), all four kept beside each other rather than overwritten.

---

## Verification

### `node scripts/check-claude-md-size.cjs` — **exit 0**, and ⭐ **it FIRED first**

```
CLAUDE.md    92196 chars   61.5% of limit  headroom 57804  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

⭐ **The gate is demonstrably NOT vacuous here.** Task 3's first draft tripped it:

```
HOT-FILE LEDGER — 1 structural problem(s) in docs/HOT-FILE-LEDGER.md
  [disposition-too-long] line 9811  266 chars (cap 200)
    frontend/src/components/layout/ChatHistoryColumn.tsx
```

The cell was trimmed and the gate went green. **A guard nobody has seen fire is not a guard** —
this one fired, on this plan's own prose, in the turn it was authored.

### `node scripts/check-hot-file-ledger.cjs 244` — **exit 1, and NOT this plan's**

```
hot-file ledger — .planning/phases/244-the-chat-shell-and-the-composer
  scan list: 255 rows · subject: 46 files · watched: 26
G-5 CANNOT FIRE ON 7 FILE(S) — they have no ledger row:
  [no-row] backend/app/api/workspace.py                       (named by 244-02-PLAN.md)
  [no-row] frontend/src/components/chat/ActiveConnectorChips.tsx      (244-05)
  [no-row] frontend/src/components/chat/ChatAttachmentChip.tsx        (244-05)
  [no-row] frontend/src/components/chat/ConnectedFilePickerModal.tsx  (244-06)
  [no-row] frontend/src/components/chat/composerCopy.ts               (244-05)
  [no-row] frontend/src/components/panel/TemplateUpload.tsx           (244-02)
  [no-row] frontend/src/lib/workspaceAllowedExt.ts                    (244-02)
```

⭐ **9 → 7: both of `244-01`'s files are gone from the list, and no `[no-row]` line names a file
this plan owns.** The remaining seven belong to `244-02` / `244-05` / `244-06` per C-8's ownership
map, so **this gate CANNOT exit 0 until all six plans merge** — the plan's own Task-1 acceptance
criterion (`exits 0`) is unsatisfiable at plan scope and is recorded as such rather than claimed.

⚠ **NOT a vacuous pass.** The plan warned that exit 0 over **0 parsed files** was measured at Phase
242 on a CRLF plan. Here the script reports **`subject: 46 files · watched: 26`** — it parsed and
scanned real content.

### `npx tsc -p tsconfig.app.json --noEmit` — **67 errors, the base set, byte-identical**

Run from `frontend/`. **Not `npx tsc --noEmit`**, which type-checks ZERO files here. A `diff` of the
sorted error-file sets before and after the change printed nothing:
`SET_IDENTICAL_TO_BASE`. **None of the five modified source files appears in the set.**

### Targeted suites — all green

| Scope | Result |
|---|---|
| `src/components/layout` + `src/components/chat/__tests__` | **45 files · 468 tests · 0 failed** |
| The 4 `ChatHistoryColumn` suites | **43 / 43** |

### ⛔ The full count gate — `failed 2`, triaged per protocol, NOT this plan's

```
  total                                      7329    8099    +770
  total 8099  ·  failed 2  ·  pinned total 7329
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

Run from the **repo root**, `GSD_VITEST_MAX_WORKERS=2`, with the wave's sibling agent (`244-02`)
active — the two-concurrent-agent condition the cap exists for.

**Trajectory** against `CLAUDE.md`'s last re-derivation (2026-09-07: `7816 · pinned 7020 ·
241/241`): the grand total is **8099** and the pinned total **7329**. **A growing number is the gate
WORKING** — its contract is *no per-file DECREASE* and *zero failing*.

- ✅ **Zero per-file decreases anywhere in the report.** The only failure reason is `[failing-tests]`.
- ✅ This plan's three suites resolve exactly: `ChatHistoryColumn.clickPath 10/10/0`,
  `ChatHistoryColumn.rowIdentity 7/7/0`, `ChatLayout.scrollFrame 5/5/0`.

**Triage, in the mandated order — filenames captured from the gate's OWN persisted JSON BEFORE any
re-run:**

Both failures are in **`frontend/src/components/library/__tests__/sketchComposition.test.tsx`**:

1. `§2 positive controls > the page renders its heading — the mount harness works` — `STACK_TRACE_ERROR`
2. `§2 positive controls > the four shipped tab triggers render` — `Found multiple elements with the
   role "tab" and name "Documents"` (a downstream consequence of #1: the timed-out case left its
   tree mounted, so the next case saw two)

- ⭐ **Provably unmodified by this plan.** `git diff --numstat <base> HEAD` lists **14 files and this
  is not one of them**; `git diff --numstat` scoped to `src/components/library/` and
  `pages/LibraryPage.tsx` is **empty**.
- **Green in isolation on this exact tree**: `46 passed | 1 skipped (47)`, 0 failed.
- ⛔ **The cap was NOT touched**, per the standing rule.

⚠ **Said precisely: "provably unmodified", never "fine".** One green sample of a suite that failed
under load proves nothing, and `SEED-171`'s own correction records that `STACK_TRACE_ERROR` is **not**
a reliable tell for "not a real defect". ⚠ **`sketchComposition.test.tsx` is NOT one of SEED-171's
five named suites** — if it reds again under a concurrent wave it is a **sixth** member of the
cap-independent set and should be added there rather than re-discovered.

---

## Deviations from Plan

### Auto-fixed

**1. [Rule 3 — Blocking] `--reporter=basic` does not exist in this vitest (v4.1.0)**
- **Found during:** Task 1, the first RED drive.
- **Issue:** The plan's `<verify>` block runs `npx vitest run … --reporter=basic`. That fails at
  startup: `Error: Failed to load custom Reporter from basic` / `Failed to load url basic`.
- **Fix:** `--reporter=default` on every invocation. No source change.
- **Commit:** n/a (command-line only) — recorded here because **every other plan in this phase
  carries the same `--reporter=basic` line and will hit it.**

**2. [Rule 1 — Bug] `ChatArea.tsx` has a SECOND column root the plan did not name**
- **Found during:** Task 1 GREEN — the fence stayed RED after the planned edit.
- **Issue:** The welcome branch (`if (!thread)`, `:474`) carries the same
  `flex flex-col h-full bg-background` root and the same link-4 obligation.
- **Fix:** `min-h-0` there too, and the assertion widened from `.match()` (first occurrence) to
  `.matchAll()` over every such root.
- **Files:** `ChatArea.tsx`, `ChatLayout.scrollFrame.test.tsx`. **Commit:** `d5b3a1257`.

**3. [Rule 2 — Missing critical] the row's always-rendered actions overlay swallowed clicks**
- **Found during:** Task 2, tracing `BUG-260911-02`.
- **Issue:** An invisible (`opacity-0`) always-rendered overlay covering the right of every row,
  with no `pointer-events-none`, sitting above the surface's primary action target.
- **Fix:** `pointer-events-none` on the container, `pointer-events-auto` on both controls. RED-driven.
- **Files:** `ChatHistoryColumn.tsx`. **Commit:** `85329f554`.
- ⛔ **Explicitly NOT claimed to close `BUG-260911-02`.**

**4. [Rule 1 — Bug] one shipped test pinned the `Unfiled` defect**
- **Found during:** Task 3 GREEN — `ChatHistoryColumn.test.tsx` went red.
- **Fix:** Re-baselined in place, with the reason written into the case. **Commit:** `e08c2b448`.

### Departures from the plan's letter, stated rather than absorbed

**A. Ledger rows for `ChatHistoryColumn.tsx` + `useThreads.ts` landed in TASK 1's commit, not
Task 3's.** The plan assigns them to Task 3. Both are owned by *this plan* under C-8's map (the map
is per-PLAN, to prevent `[duplicate-row]` across plans), and doing the whole registry edit in one
contiguous hunk reduces the conflict surface the wave merge has to hand-resolve. Task 3 then only
updated `ChatHistoryColumn`'s disposition and section. **No duplicate row exists** — the gate would
fail `[duplicate-row]`, and it does not.

**B. Task 2's driven observations live in their OWN suite** (`ChatHistoryColumn.clickPath.test.tsx`)
rather than in `rowIdentity.test.tsx`. The plan permits "or a sibling suite". Two suites keep the
trace's controls separate from the row-identity contract and give each its own gate pins.

**C. Task 1's gate-knob registration landed in the GREEN commit, not the RED one.** The plan says
"same commit" as the suite. ⛔ **A RED suite in `BASELINE` reddens the shared gate for the whole
repository.** Both knobs land with GREEN, in the same commit as the source change — which is the
property the same-commit rule protects.

---

## Threat register — dispositions

| Threat ID | Disposition |
|---|---|
| `T-244-01-01` info disclosure via the chip `title=` | ✅ mitigated. React escapes the attribute; the chip is capped at `max-w-[96px]`+`truncate` so a crafted folder name cannot push the title out (that IS the fix). `grep -c dangerouslySetInnerHTML frontend/src/components/layout/ChatHistoryColumn.tsx` → **0**. |
| `T-244-01-02` tampering with the gate knobs | ✅ mitigated. `git diff --numstat scripts/vitest-count-gate.cjs` → **`40 0`** — **zero deletions**. No other plan's `TARGETS` line or `BASELINE` pin was touched. |
| `T-244-01-03` repudiation of the `BUG-260911-02` disposition | ✅ mitigated. The trace file records both checks, their refusal reasons, the driven observations and the verdict, so "not reproducible" is auditable rather than asserted. |
| `T-244-01-04` DoS — unbounded `ScrollArea` laying out N messages | ✅ mitigated. The `min-h-0` chain restores internal scrolling; the fence pins the whole `<ScrollArea>` inventory by file so a third unbounded call site cannot arrive. |
| `T-244-01-SC` package installs | ✅ **No packages were installed.** No `npm install` was run at any point. |

---

## Known Stubs

**None.** No hardcoded empty value, placeholder string or unwired component was introduced.

---

## Threat Flags

**None.** No network endpoint, auth path, file-access pattern or schema was added or changed — this
plan is CSS class tokens, one JSX conditional, three test files and registry text.

---

## What is OWED after this plan

1. ⛔ **`SHELL-01` does not close here.** D-244-19's measured bound is a G-4 row in
   `244-VALIDATION.md`, driven at `/gsd:verify-work` in a real browser.
2. ⛔ **`BUG-260911-02`'s production and `develop` checks** — one browser session; the exact click is
   in the report's `re_open_trigger`.
3. ⛔ **`BUG-260816-03` (a)** — the thread-kind icon; re-open trigger set in the frontmatter.
4. ⚠ **`node scripts/check-hot-file-ledger.cjs 244` exits 1** until `244-02` / `244-05` / `244-06`
   add their seven rows.
5. ⚠ **`sketchComposition.test.tsx`** — if it reds again under a concurrent wave, add it to
   `SEED-171` as a sixth cap-independent flaky suite.
6. ⚠ **Every other plan in this phase will hit `--reporter=basic`.** Use `--reporter=default`.
