---
phase: 235-the-source-says-what-it-did
plan: 15
subsystem: app-shell navigation / source-attention signal
tags: [SURF-03, gap-closure, hand-off, docblock-truth, fence]
gap_closure: true
gap_closure_round: 1
requires:
  - "235-08 — the `initialTab` prop threading whose consumption side this fixes"
  - "235-09 — the `ATTENTION_PRODUCERS` registry and its one-reader claim"
provides:
  - "libraryTabAfterNavigate — the one-shot hand-off lifetime rule, pure and testable"
  - "the corrected reader-count rule in attentionConditions.ts, with a re-open trigger"
  - "a ?raw reader-inventory fence that reds when a fourth useSourceAttention() appears anywhere"
affects:
  - "frontend/src/App.tsx — both navigation doors now route through one handler"
tech-stack:
  added: []
  patterns:
    - "import.meta.glob(?raw, eager) whole-tree inventory fence"
    - "line-anchored comment stripper before any code-count measurement"
key-files:
  created:
    - frontend/src/lib/libraryTabHandoff.ts
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/235-the-source-says-what-it-did/deferred-items.md
decisions:
  - "D-235-15-01: the clear belongs to the NAVIGATOR, not to a second writer beside handleOpenLibraryHealth"
  - "D-235-15-02: CitationNavProvider routes through the same handler — deliberately, and it is a no-op today"
  - "D-235-15-03: G4 resolved by amending the docblock, not by threading the verdict down — measured and declined in writing"
  - "D-235-15-04: SEED-253 stays OWED. Not built. Trigger unchanged."
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 2
  commits: 3
---

# Phase 235 Plan 15: The Hand-Off Is One-Shot, And The Docblock Is True — Summary

Closed the two truth defects verification found: the Library no longer opens on Health forever after a single attention-popover click, and `attentionConditions.ts` no longer asserts a reader-count invariant the shipped tree breaks.

## What shipped

| # | Task | Commit |
|---|---|---|
| 1 | The Health hand-off is one-shot, proven by a REMOUNT test | `4e0b0323b` |
| 2 | The reader-count docblock says what is true, plus an inventory fence | `7ad72c854` |
| — | Ledger row + detail section (same-commit sync rule) | `db86af9b0` |

## G5 — the Library no longer sticks on Health

**The defect, restated from the code rather than the report.** `App.tsx:176-180` set `libraryTab = "health"` in `handleOpenLibraryHealth` and never reset it. `ChatLayout` mounts `<LibraryPage>` inside a ternary, so the page unmounts on navigation away and re-seeds its reducer from `initialTab` at **every** mount — `LibraryPage.tsx:210-212`, a lazy `useReducer` initializer. One click therefore redefined where the Library opens, permanently, contradicting `App.tsx`'s own comment.

**The fix.** A new strict leaf, `frontend/src/lib/libraryTabHandoff.ts` (59 L, **zero runtime imports**, generic in the tab type), owns the hand-off *lifetime*: kept when navigating into the Library, spent on any other destination, idempotent when absent. `App.tsx` gained one `handleNavigate` that replaces the raw `setActiveView` at both mount points. `handleOpenLibraryHealth` is byte-unchanged — the clear belongs to the navigator, not to a second writer.

**⚠ The `CitationNavProvider` door was routed through the same handler deliberately, and it is commented as such.** It is a strict no-op today: `citationNav.tsx:98` only ever navigates to `"documents"`, the one destination the rule keeps the hand-off for. It is routed anyway because a hand-off that one navigator clears and another bypasses is the same defect one layer down.

### Why the shipped test could not have caught this — and the RED message from the one that can

`LibraryPage.initialTab.test.tsx`'s *"⛔ SEEDS the tab, never PINS it"* case mounts once and clicks a tab. It proves a **within-mount** transition works, which was never in doubt — the reducer was untouched. **The defect lives BETWEEN mounts**, and `initialTab` is only read at mount, so a suite that never unmounts is structurally blind to it.

The new case builds a harness mirroring `App`'s state shape, lands on Health, navigates away (asserting the tablist is really **gone**, not merely hidden), and returns. Driven RED against the bare setter, it produced:

```
FAIL  src/pages/__tests__/LibraryPage.initialTab.test.tsx
      > LibraryPage — the hand-off survives ONE entry and no more
      > ⭐ REMOUNTS on the page's OWN default after the Health hand-off was used once
AssertionError: expected 'Health' to be 'Documents' // Object.is equality
Expected: "Documents"
Received: "Health"
```

That is the user-visible bug, verbatim, from a test.

### ⚠ A step-4 assertion I wrote was WRONG, and finding out is a real result

My first draft asserted the popover door still worked immediately after the clear, **without leaving the Library**. It failed (`expected "Documents" to be "Health"`), and the failure is honest: **clicking the attention popover while the Library is already open changes nothing on screen**, because `initialTab` is read by a lazy initializer and there is no unmount to re-seed.

This is **pre-existing and unchanged by this plan** — before it, the same click was equally invisible and merely left a stale hand-off that ambushed the *next* entry. My change removes the delayed ambush and leaves the immediate no-op. Fixing the no-op means letting the page consume a hand-off **after** mount: a behaviour change, not a gap-closure fix, so it is recorded (test comment, ledger detail section, here) rather than built.

## G4 — the docblock now states the measured rule

**The refuted claim, preserved verbatim here because this is where a superseded claim belongs** (it is deliberately *not* left in the source, where a grep would find it as a live assertion):

> *"⛔ A second `useSourceAttention()` call anywhere in the same tree means two polls and, eventually, two disagreeing answers about the same source — which is exactly the failure D-235-05 exists to prevent."*

**Measured, by reading rather than assuming:**

| Claim | Verdict |
|---|---|
| one reader per render tree | **false** — there are two |
| the two can disagree | **false** — D-235-05 puts the debounce on the server; both render one verdict |
| the count could be three | **false** — `components/ui/tabs.tsx` is bare Radix with **no `forceMount`**, and `LibraryPage`'s five `<TabsContent>` carry none, so the Ingestion (`IngestionTab.tsx:167`) and Health (`SourcesAttentionSection.tsx:161`) readers are mutually exclusive by tab |
| the real cost | one extra GET per poll interval while the Library is open — a doubled **rate**, never a second opinion |

**Chosen fix: amend the docblock, not thread the verdict down.** The shell's verdict would have to cross `App → ChatLayout → LibraryPage → tab body`; three of those four are G-5-firing hot files, and it would couple the Library page to the app shell to save one poll of a small payload on the surface the person is already looking at. **Declined in writing, inside the docblock**, with a three-part re-open trigger (a third concurrent reader; a poll interval short enough for the doubled rate to matter; any consumer that needs to WRITE the verdict).

### What test WOULD have caught it — and now does

`ChatLayout.badge.test.tsx`'s `toHaveBeenCalledTimes(1)` is correct and untouched: it proves the **shell** reads once. It is blind here because **it never mounts the Library**. The suite's own docblock already recorded that the originally-proposed grep could not fire either — `ChatLayout.tsx` contains the literal **zero** times, reading through `ATTENTION_PRODUCERS`.

So the new fence measures the property that actually matters: an `import.meta.glob("../../../**/*.{ts,tsx}", ?raw, eager)` sweep of **927** source files, pinning the call-site inventory **by file**. Planting a second reader in `SourcesAttentionSection.tsx` reddened it, naming the file and the count:

```
FAIL  ChatLayout.badge.test.tsx > source-attention reader inventory
      > ⛔ EXACTLY THREE product call sites, and they are the three that are supposed to exist
AssertionError: expected [ … ] to deeply equal [ … ]
      "components/library/SourcesAttentionSection.tsx",
-     1,
+     2,
```

The plant was reverted and `git diff --numstat` on that file is **empty** — restored byte-identical.

### ⚠ Two fence defects found by driving it, not by reviewing it

1. **Vite normalises `import.meta.glob` keys to the SHORTEST relative path**, so one pattern returned keys at three different depths (`../ChatLayout.tsx`, `../../ui/tabs.tsx`, `../../../pages/LibraryPage.tsx`). Stripping a fixed `../` prefix collapsed distinct files onto colliding names. The key is now *resolved* against the suite's own directory.
2. ⭐ **The first version counted RAW text and read `attentionConditions.ts` as THREE readers** — because the docblock I had just written quotes the hook name in prose. **A code measurement satisfiable, or breakable, by a comment** is the 187-24 lesson exactly. The fence now strips comments with the line-anchored stripper first, and carries a stripper non-vacuity pair that reds if the stripper ever returns `""`.

## ⛔ G6 / SEED-253 — CONFIRMED OWED, DELIBERATELY NOT BUILT

At mobile width there is no drawer-opening control outside the chat view, so a phone user on a non-chat surface has no navigation control on screen. **This was not built, and its trigger is unchanged.**

- **Pre-existing**, not created by Phase 235: `onOpenDrawer` has only ever been threaded to `ChatArea`.
- Fixing it is a **navigation change needing its own sketch** under G-2, with layout consequences on ten views that already own page headers.
- Building it in a closure round is precisely the new-capability move **G-7 forbids**.
- **Proven untouched:** `git diff --numstat d790f3d6f HEAD` over the seed file and all four files it names (`ChatLayout.tsx`, `ChatArea.tsx`, `NavPanel.tsx`, the seed itself) is **empty**.
- ⚠ Whoever takes it must **move the attention dot with the trigger**, or the mobile half of SURF-03 is silently un-shipped.

## Gates — verdicts verbatim

| Gate | Base | Now |
|---|---|---|
| vitest count gate | `237/237 · total 7734 · failed 0 · pinned 6985` | **`count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing.`** · `total 7748 · failed 0 · pinned total 6985` |
| `tsc -p tsconfig.app.json --noEmit` | 66 errors | **66 errors — unchanged** |
| composition fence (`sourceComposition.test.tsx`) | `16 failed \| 33 passed (49)` | **`16 failed \| 33 passed (49)` — byte-identical, not worse** |
| `check-claude-md-size.cjs` | 117,232 | **118,308 chars · 78.9% · OK** |
| `git diff --numstat scripts/vitest-count-gate.cjs` | — | **EMPTY** |
| `src/components/layout` | — | **12 files · 135 tests · 0 failed** |

⭐ **The `+14` closes with no residual, which is what separates growth from drift:** `LibraryPage.initialTab.test.tsx` 6 → 15 (**+9**) and `ChatLayout.badge.test.tsx` 5 → 10 (**+5**). `7734 + 14 = 7748`. **No suite file was created and `vitest-count-gate.cjs` was not edited** — both suites were already pinned in both knobs.

## Deviations from Plan

**1. [Rule 3 - Blocking] The plan's Task-2 fence instruction could not be implemented literally.**
It asked to assert `ChatLayout.tsx` contains exactly ONE `useSourceAttention(` call. `ChatLayout.tsx` contains it **zero** times — it reads through the registry, a fact the badge suite's own docblock already recorded. Implemented as the property the plan actually wants (*"a fourth reader appearing anywhere reddens a test"*): a whole-tree inventory pinned by file, plus an explicit case asserting `ChatLayout.tsx` calls the hook **zero** times and resolves the registry exactly once.

**2. [Rule 1 - Bug in my own test] The step-4 assertion was wrong** — see the G5 section. Corrected to leave the Library first, with the discovered limitation documented rather than asserted as desired behaviour.

**3. [Rule 3 - Blocking] `grep "two disagreeing answers"` had to return nothing, which conflicts with the repo norm of preserving refuted claims verbatim beside their corrections.** Resolved by paraphrasing the refuted claim in the docblock (so no false sentence survives as a quotable string) and preserving it **word for word in this SUMMARY** — which is where the commit-message hook itself directs superseded claims. The docblock says explicitly that this is what was done and where to find it.

**4. Ledger: a row WAS added for `libraryTabHandoff.ts`** (optional at 1 phase, per the plan). Chosen because an absent row is invisible to G-5 forever, and this ledger's own repeated finding is that files go unrecorded for their entire lives. Row is 305 chars with a **165-char disposition** (cap 200); the narrative went to `docs/HOT-FILE-LEDGER.md` in the **same commit**. No existing row was edited — `App.tsx`'s cell verdict (*honoured by construction*) is still accurate for this change.

## Deferred / out of scope

⚠ **Three UNGATED suites are red at this plan's base commit**, logged to `deferred-items.md` with proof:

| Suite | Failing | Evidence it is not mine |
|---|---|---|
| `src/lib/model-info.test.ts` | 1 | byte-unchanged in both diffs; no reference to `App` |
| `src/lib/__tests__/termMap.test.tsx` | 1 | ditto |
| `src/pages/__tests__/SettingsPage.a11y.test.tsx` | 4 | ditto |

⛔ **They are absent from BOTH count-gate knobs** (the file's only textual match is a comment on line 3773), and `src/lib` / `src/pages` are pinned **per file**, not as directories — which is exactly why the gate reads `failed 0` while these are red. **Consequence: the plan's acceptance criterion `npx vitest run src/pages/__tests__ src/lib — 0 failed` was unmeetable at the base commit** and is not a property any plan in that scope can deliver. Recorded rather than papered over.

## Success criteria

- [x] The Library no longer sticks on Health after a badge-popover click — proven by a REMOUNT test driven RED against the old wiring
- [x] G4 resolved by amending the docblock to the true rule; no docblock left contradicting the code; declined alternative and re-open trigger both in writing
- [x] SEED-253 confirmed unchanged and NOT built — proven by an empty diffstat over the seed and all four files it names
- [x] All tasks committed individually; SUMMARY committed before returning
- [x] STATE.md / ROADMAP.md / `vitest-count-gate.cjs` NOT modified

## Self-Check

- `frontend/src/lib/libraryTabHandoff.ts` — FOUND
- `.planning/phases/235-the-source-says-what-it-did/235-15-SUMMARY.md` — FOUND
- commit `4e0b0323b` — FOUND
- commit `7ad72c854` — FOUND
- commit `db86af9b0` — FOUND

## Self-Check: PASSED
