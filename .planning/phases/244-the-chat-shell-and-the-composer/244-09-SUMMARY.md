---
phase: 244-the-chat-shell-and-the-composer
plan: 09
subsystem: chat-shell
tags: [shell, layout, nav-rail, overflow, gap-closure, hot-file-ledger]
gap_closure: true
gap_closure_round: 1
requires:
  - "244-01's min-h-0 chain (the five message-column sites) — unchanged, and the reason this gap existed"
provides:
  - "a nav rail that bounds and scrolls its OWN content instead of pushing the document"
  - "link 6 of the scrollFrame fence — the rail column's source pin, in BOTH gate knobs"
  - "244-09-UAT-ROW.md — the 8-sample browser row that is the ACTUAL acceptance for SHELL-01"
  - "a re-derived hot-file ledger row + section for NavPanel.tsx"
affects:
  - "every desktop viewport shorter than ~540px"
tech-stack:
  added: []
  patterns:
    - "bound a flex column at its own root (overflow-y-auto) rather than adding a min-height to an ancestor"
key-files:
  created:
    - .planning/phases/244-the-chat-shell-and-the-composer/244-09-UAT-ROW.md
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
decisions:
  - "D-244-19 honoured: SHELL-01 closes on a MEASURED bound, so this plan reports built / drive owed — never closed."
  - "The in-file comment deliberately does NOT spell the two class tokens verbatim, because the plan's own acceptance counts them with grep -c."
  - "NavPanel.tsx's ledger row was UPDATED, not added — 244-UAT.md's claim that it has no row is stale and acting on it would have failed [duplicate-row]."
metrics:
  duration: "~28 min"
  tasks: 2
  commits: 2
  completed: 2026-09-12
---

# Phase 244 Plan 09: The nav rail bounds itself Summary

**One-liner:** The page root overflowed below ~540px because the nav RAIL — the one shell column
`244-01` never swept — could neither scroll nor clip; it now carries `min-h-0 overflow-y-auto`,
pinned by a twice-RED-driven source fence, with the pixels owed to a browser row.

⚠ **Solo run (D-244-21 / OV-SOLO-01).** Gemini is unavailable. Everything below is a
**SELF-verification**, never a review. No independent second reader saw this work.

⛔ **SHELL-01 IS NOT CLOSED BY THIS PLAN — it is *built, drive owed*.** jsdom performs no layout, so
the fence proves the token cannot be deleted silently and nothing more. The measured bound is
`244-09-UAT-ROW.md`, driven at `/gsd:verify-work`. G-6 shipping behind a green fence is exactly why
this separation is written down rather than assumed.

---

## What was wrong

SHELL-01's first criterion is *"no dead space opens under the composer **at any window height**"*.
The `L-1` UAT drive measured six samples and **two failed**:

| viewport h | panel | `#root` sh / ch | overflow |
|---|---|---|---|
| 436 | CLOSED | 540 / 436 | **+104px** |
| 436 | OPEN | 540 / 436 | **+104px** |
| 576, 696 | either | equal | 0 |

The threshold bisected to **h=516 (+24px)**. `rootScrollHeight` was **pinned at 540px at every
viewport**, and panel state made no difference at all — itself diagnostic: the overflowing element
was in neither the panel nor the message column.

**It was the rail.** `NavPanel.tsx`'s rail root computed `overflow-y: visible` **and**
`min-height: auto`, so it could neither scroll nor clip. Its auto-margin footer block (org/operator
shields + the ProfileMenu anchor, 128px) measured `bottom = 540px`, past the rail's own box, and the
walk up the parent chain found `overflow-y: visible` on every ancestor to `<html>`.

⭐ **The finding is about the SWEEP, not the class.** `244-01` fixed exactly this mechanism at five
sites — `ChatLayout.tsx:803,809`, `ChatArea.tsx:501,584`, `MessageList.tsx:219` — **all in the
message column**. The workspace `<aside>` already carried `min-h-0 … overflow-hidden`. The rail is
the **one column of the shell that got neither treatment**, and it is the one that was broken.
`NavPanel.tsx` sat outside the G-5 audit for **eleven phases** before Phase 235 gave it a row, so a
sweep that follows the ledger swept the column the ledger pointed at.

---

## Task 1 — bound the rail · commit `5dbbc6d84`

**One changed source line**, plus a comment block:

```
"hidden md:flex flex-col h-full min-h-0 overflow-y-auto shrink-0 bg-sidebar …"
```

`overflow-y-auto` is the fix — the box was **already** bounded at the viewport (`h-full` inside
`div.flex.h-screen`, measured `height = viewport`), so the content escaped purely because the
computed overflow was `visible`. `min-h-0` is defensive: symmetry with `244-01`'s five sites, and the
automatic-minimum-size rule is direction-dependent. The comment says which of the two does the work.

**Scope held, measured rather than asserted:**

| check | result |
|---|---|
| `grep -c "overflow-y-auto" NavPanel.tsx` | **1** |
| `grep -c "mt-auto" NavPanel.tsx` | **1** — unchanged from pre-edit |
| `git diff --stat NavPanel.tsx` | `27 +, 1 -` — one changed source line, 26 comment lines |
| `git diff ChatLayout.tsx ChatArea.tsx MessageList.tsx` | **EMPTY** — the five `244-01` sites untouched |
| `git diff backend/ supabase/` | **EMPTY** |
| `git diff package.json package-lock.json requirements.txt` | **EMPTY** — no dependency added (`T-244-09-SC` n/a) |

⛔ **No `min-height` was added to the page, `#root` or any ancestor** — that makes the page scroll
deliberately, which IS the bug. The footer block and the mobile drawer were not touched.

### Link 6 was driven RED twice, and the failure text is quoted rather than claimed

**RED drive 1 — against the shipped tree** (before the classes existed):

```
AssertionError: the rail root is unbounded: hidden md:flex flex-col h-full shrink-0 bg-sidebar
border-r border-border/20 py-3 motion-safe:transition-[width] motion-safe:duration-300:
expected 'hidden md:flex flex-col h-full shrink…' to contain 'min-h-0'
```

**RED drive 2 — against a planted deletion of `overflow-y-auto` ALONE**, so the third assertion is
proven to fire on its own rather than being shadowed by the `min-h-0` one:

```
AssertionError: the rail root cannot scroll its own content and will push the document:
hidden md:flex flex-col h-full min-h-0 shrink-0 bg-sidebar border-r border-border/20 py-3
motion-safe:transition-[width] motion-safe:duration-300:
expected 'hidden md:flex flex-col h-full min-h…' to contain 'overflow-y-auto'
```

The source was restored between drives (`git diff` after restore was limited to the intended change).
GREEN after restore: **6 passed**, `failed 0`.

**Both gate knobs.** `BASELINE` `5 → 6`; `TARGETS` already carried
`src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx` — **confirmed by grep, not
assumed** (a suite in one knob and not the other runs while guarding nothing).

---

## Task 2 — the ledger, and a claim about the ledger · commit `9de33f29c`

### The row was stale — and the UAT's claim about it was WRONG in the opposite direction

⚠ **`244-UAT.md`'s G-5 block asserts *"NavPanel.tsx has NO hot-file ledger row"* and lists adding one
under `missing:`. That is FALSE.** Phase 235 added it, and
`check-hot-file-ledger.cjs --files frontend/src/components/layout/NavPanel.tsx` exits `0`. Acting on
the UAT would have added a **second** row and failed `[duplicate-row]`. *"Stale"* and *"absent"* call
for **opposite actions** and only one of them is safe — so the correction is recorded in the ledger
section, where the next reader of the row will meet it.

**Re-derived at `5dbbc6d84`** with CLAUDE.md's own recipe, from the repo root:

| | |
|---|---|
| the row said | `20 / 11 / 329` |
| **measured** | **`22 / 12 / 370`** |
| planning-time reading | `21 / 11 / 344` — itself already stale by the time it was used |

Recorded **beside** the old, never over it. Arithmetic published: **zero** six-digit dated
quick-task buckets to subtract; **four** non-numeric buckets discarded (`nav`, `phase`, `SEED`, one
untagged `fix:` subject). ⚠ `045/45` and `048/48` are the same two phases spelled two ways — a
pre-existing artifact of this recipe, **preserved rather than silently corrected**, because changing
the accounting inside a re-derivation makes the delta unreadable.

**Same-commit sync rule honoured**: `CLAUDE.md` row + `docs/HOT-FILE-LEDGER.md` section in one
commit. Disposition cell **169 chars** (cap 200). `grep -c` on the path in `CLAUDE.md` → **1**;
`^## …NavPanel.tsx` sections → **1**.

**Named seam, updated:** the rail's three regions — logo/toggle, nav list, footer — are one flat flex
column with **no scroll owner**. Today the whole rail scrolls, right at 370 lines and wrong the
moment the nav list grows: the **nav list** should own the scroll with logo and footer pinned.
`NavRailScrollRegion`. ⭐ Phase 235's `NavAttentionBadge` seam still stands and is not superseded.

### `244-09-UAT-ROW.md` — the row that actually scores this criterion

8 samples: **436, 516, 576, 696** × panel **CLOSED**/**OPEN**. Authored `pending`, driven at
`/gsd:verify-work`. It carries, in order of how easily each was got wrong:

- ⛔ **The instrument.** `document.getElementById('root').scrollHeight` vs its own rect height, with
  `document.body.scrollHeight` as cross-check. **`document.scrollingElement` / `documentElement` is
  explicitly forbidden with its reason:** the automation extension injects nodes into `<body>` and it
  measured **1522 at a viewport of 696**. A briefly-believed "second instance at h=696" was purely
  that measurement error and is **not** a finding.
- ⛔ **The composer gap is a CONTROL, not the failing measure** — `37.0px` at all six prior samples
  including both failures; footer gap `12.0px` at all six. `rootOverflowBy` is the only mover. The
  earlier `106.6px` reading was a rect read against an already-scrolled root.
- ⛔ **The rail must overflow INTERNALLY at h=436** (`rail.scrollHeight > rail.clientHeight`).
  Without it the row cannot distinguish *the rail scrolls* from *content was deleted*.
- ✅ **Rail drift is NOT the defect and must not be "fixed"** — Δ `dTop`/`dLeft` was **0** and app
  `scrollIntoView` calls **0** at every pre-fix height across four real trusted scrolls. The row
  re-asserts it as a regression guard, with a real trusted scroll (a synthetic `WheelEvent` moves the
  list 0px and is discarded), the list asserted to have moved first, and a **leaf element's bounding
  rect** — `scrollTop` is not the reader's position.
- **Fixture** `261d5f57-36fb-40ec-bb0b-1c72b7550350` (78 messages), with the `G-3` snapshot-503
  hazard named: a silently-truncated transcript would make every sample read clean for the wrong
  reason.

---

## Verification

| gate | result |
|---|---|
| `ChatLayout.scrollFrame.test.tsx` in isolation | **6 passed, failed 0** — equals the new `BASELINE` |
| `tsc -p tsconfig.app.json --noEmit` | **67 errors at base, 67 after; set diff EMPTY both ways** |
| `check-claude-md-size.cjs` | **exit 0** — `96,849 chars`, 64.6% of limit; no `[disposition-too-long]`, `[duplicate-row]`, `[malformed-row]` |
| `check-hot-file-ledger.cjs --files …/NavPanel.tsx` | **exit 0**, `subject: 1 · watched: 1` |
| `check-hot-file-ledger.cjs 244` | ⚠ **exit 1 — INHERITED, not this plan's** (below) |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | ⚠ **`failed 1` on BOTH runs, a DIFFERENT suite each time** (below) |
| backend | **not run, and correctly so** — `git diff --stat backend/ supabase/` is EMPTY, so the zero-headroom baseline (71) is not at risk from this plan |

⛔ `npx tsc --noEmit` was **not** used — `frontend/tsconfig.json` is solution-style and checks zero
files. "Zero errors" is not a reachable criterion here; the **set diff** is.

### The count gate is RED, and the reason is measured rather than assumed

Two full runs from the repo root, **byte-identical tree** (clean `git status`, HEAD `9de33f29c`),
one sibling agent active (`244-10`, backend-only, separate worktree). ⛔ Filenames were captured from
the gate's **own persisted JSON before either re-run**. ⛔ **The cap was never touched** — `2`
throughout.

| run | verdict line | the ONE failing case |
|---|---|---|
| 1 | `total 8215 · failed 1 · pinned total 7426` | `library/__tests__/sketchComposition.test.tsx` — **its own POSITIVE CONTROL**, `STACK_TRACE_ERROR` |
| 2 | `total 8215 · failed 1 · pinned total 7426` | `pages/WorkflowRunPage.test.tsx` — `AssertionError: expected 0 to be greater than 0` |

⭐ **The failing SET is never the same twice** — SEED-171's defining property, reproduced exactly.
⭐ **`WorkflowRunPage.test.tsx` IS one of SEED-171's five named suites**, and `expected 0 to be
greater than 0` is the exact signature SEED-171 records for `WorkflowBuilderPage.canvas.test.tsx`.

**Both files are provably unmodified by this plan.** Its entire diff against `a2c8da1af` is seven
files (listed in the frontmatter); neither failing file is among them, and `git status --short` is
empty. ⭐ For `sketchComposition.test.tsx` there is also a **structural** argument: its only source
import is `@/pages/LibraryPage` (dynamic), and `LibraryPage.tsx` does not import `NavPanel` — **the
suite's module graph cannot reach the one source file this plan changed.** Run in isolation at this
HEAD it reads `46 passed | 1 skipped`, `failed 0`, in 15.63s of test time: a slow suite whose own
harness control timed out under the shared gate's load. ⚠ Stated as *"provably unmodified"*, never
*"fine"* — one green sample of a flaky suite is not proof of innocence.

⭐ **`ChatLayout.scrollFrame.test.tsx` read `6  6  0` on BOTH runs** (`BASELINE 6`, actual 6, delta
0). This plan's `+1` is fully attributed with **no residual**, and the gate reported **no per-file
decrease anywhere**. The sole `RESULT: COUNT GATE VIOLATED` reason on both runs was
`[failing-tests]`. ⚠ The grand total's `+789` and five `— new` suites are **inherited** — other 244
plans' suites landed before this plan's base — and adoption is the desirable direction, not drift.

⚠ CLAUDE.md's own consequence applies: **`count gate OK` is not reliably reachable on demand**, so
the deterministic evidence is the per-file delta and the explicitly-run in-scope suite, both of which
are clean.

---

## Deviations from Plan

### 1. [Rule 3 — blocking] The comment could not name the class tokens verbatim without breaking the plan's own acceptance

- **Found during:** Task 1, at the acceptance check.
- **Issue:** The plan asks for a comment that *"names which token is load-bearing and which is
  defensive"* **and** for `grep -c "overflow-y-auto"` to return exactly `1` with `grep -c "mt-auto"`
  unchanged. `grep -c` counts **lines**, so a comment naming the tokens inflates both counts —
  measured at `2` and `2`. The two requirements are in direct conflict as written.
- **Fix:** The comment names them by CSS declaration and description (*"the overflow rule in the
  class list below (`overflow-y: auto`)"*, *"`min-h-0` beside it is defensive"*, *"the auto-margin
  footer block"*), which is unambiguous next to the class list and leaves the counts honest. A
  trailing comment line **says this is deliberate**, so a later reader does not "restore" the
  literals and silently blind the check to a real second application. The full token-by-token
  attribution also lives in the fence's docblock, where it is read on purpose.
- **Files modified:** `frontend/src/components/layout/NavPanel.tsx`
- **Commit:** `5dbbc6d84`

### 2. [Out of scope — logged, not fixed] The phase-wide ledger gate is red for a plan that has not run

`check-hot-file-ledger.cjs 244` exits `1` on `[no-row] frontend/src/stores/streamsStore.ts (named by
244-13-PLAN.md)`. **Measured at base before this plan's first edit** with byte-identical output, so
it is inherited. ⭐ The parse is **not vacuous** — `scan list: 265 rows · subject: 61 files ·
watched: 29` — which is the assertion the acceptance actually wanted after Phase 242's
`subject: 0 files` incident. Not fixed here: adding a row for a file this plan does not modify would
put a triple in the ledger derived before the work that makes it hot, and risks `[duplicate-row]`
with `244-13`. Logged in `deferred-items.md` with a re-open trigger.

**G-7 compliance:** no task introduced a new user-facing capability. The one changed source line is a
CSS class on a shipped element; everything else is a test, a gate knob, or documentation.

---

## Known Stubs

None. No component was added, no data source was left unwired, no placeholder text shipped.

## Threat Flags

None. The plan crosses **no trust boundary** — one CSS class list, one `?raw` source fence, one gate
knob, three documentation files. No input parsing, network call, persistence, auth decision or
dependency. `T-244-09-01` (rail DoS) is mitigated by `overflow-y-auto` **plus** the UAT row's
rail-overflows-internally assertion, so "no overflow" cannot be achieved by losing content.
`T-244-09-02` is mitigated by link 6, driven RED. `T-244-09-03` is mitigated by both registry gates
exiting 0 with a non-vacuous parse.

---

## What is owed

1. ⛔ **Drive `244-09-UAT-ROW.md`** — 8 samples. This is the only thing that can score SHELL-01's
   first criterion. Start at **R-1 (h=436, panel CLOSED)**: it is the sample that measured `+104px`.
2. **An independent review.** This was a solo run; the build and the verification share an author.
3. `SEED-171`'s sixth suite, if `sketchComposition.test.tsx` reds a third time — trigger recorded in
   `deferred-items.md`.
