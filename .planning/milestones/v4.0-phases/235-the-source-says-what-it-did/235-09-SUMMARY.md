---
phase: 235-the-source-says-what-it-did
plan: 09
subsystem: ui
tags: [react, app-shell, notification-surface, mobile, accessibility, radix]

requires:
  - phase: 235
    provides: "`useSourceAttention` (plan 04) — the ONE polled client reader of the server verdict, which derives nothing"
  - phase: 235
    provides: "`sourceHealthVocabulary.COPY` (plan 02) — `badgeTitle` / `popTitle` / `popOpenHealth`, and `SENTENCE_FOR_CAUSE`"
  - phase: 235
    provides: "`ChatLayout.Props.onOpenLibraryHealth` (plan 08) — declared, forwarded to nothing, and explicitly left for this plan to wire"
  - phase: 156
    provides: "`RailItem`'s two-rendering shape and the pinned ☰ 58px⇄210px rail this badge has to survive"
  - phase: 166
    provides: "`ProfileMenu` — the shipped rail-anchored popover primitive (shadcn dropdown / Radix Menu) reused here rather than a new package"
provides:
  - "`attentionConditions.ts` — the app-level attention producer registry, with EXACTLY ONE tenant (D-235-03)"
  - "`AttentionPopover.tsx` — a door: it names each stopped source and opens Library Health; it carries no repair"
  - "`RailItem`'s generic `badge?: React.ReactNode` slot + `testId`, working at BOTH 58px and 210px"
  - "the mobile home for SURF-03: a badge on the drawer's Library button AND a dot on the drawer-opening control"
  - "`ChatArea.attentionCount?: number` — one optional prop, one decorative dot, zero new hooks"
affects:
  - "235-11 (Health tab's attention list — same server verdict, different renderer)"
  - "235-12 (owes the count-gate pins for BOTH new suites: they are in NEITHER knob today)"
  - "SEED-231 (the second tenant plugs into `ATTENTION_PRODUCERS` without a second surface)"
  - "SEED-253 (NEW — the residual mobile navigation gap this plan measured but did not create)"

tech-stack:
  added: []
  patterns:
    - "A producer REGISTRY whose length is asserted literally, so 'exactly one tenant' is enforceable rather than aspirational"
    - "A namespace import used to make a one-reader property a MEASURABLE line count instead of a claim"
    - "The popover trigger is a SIBLING of the rail button, not a child and not the badge span — nested buttons are invalid and a wrapping trigger would hijack navigation"

key-files:
  created:
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/components/layout/AttentionPopover.tsx
    - frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx
    - .planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md
  modified:
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/chat/ChatArea.tsx

key-decisions:
  - "The popover trigger is a separate sibling control over the badge — the badge itself stays a decorative `aria-hidden` span inside the rail button, so the Library control is still named 'Library' AND there is a real keyboard/AT-reachable control named '2 sources stopped reading'"
  - "`AttentionProducer.use` takes the navigator as a PARAMETER, against the plan's declared zero-arg signature — injection is impossible without one, and the plan's own action text asks for an injected `onOpen`"
  - "`ChatLayout` reaches the registry through a NAMESPACE import, so exactly one line of the file names it and the acceptance criterion's line count measures the call site rather than the import"
  - "The badge carries a COUNT and no glyph — the design skill's word-badge rule (`the WORD carries the meaning; tone is decoration`) and its `do not invent a category-icon vocabulary` rule both forbid drawing a new mark here"
  - "Tasks 1 and 2 landed in ONE commit: both are a single edit to `NavPanel.tsx` and cannot be staged apart without leaving the file half-wired"

patterns-established:
  - "When a `getByTestId` fence asserts a block kind the design instantiates N times, the case is unsatisfiable by construction — say so and name which later plan inherits the same shape"

requirements-completed: [SURF-03]

duration: 47min
completed: 2026-09-06
---

# Phase 235 Plan 09: The signal reaches a person where they already are — Summary

**A stopped source now shows a warning-toned count on the Library rail item at both 58px and 210px, opening a popover that names what broke and leads to Library Health — and the same signal reaches a phone, on the drawer's Library button and as a dot on the control that OPENS the drawer, from ONE verdict read that is asserted at runtime to fire exactly once.**

## Performance

- **Duration:** ~47 min
- **Tasks:** 3 of 3
- **Files:** 5 created, 3 modified
- **Commits:** `e82a1aa8c`, `91f7103da`, `8d92186a7`, `834502ffc`

## Accomplishments

### Tasks 1 + 2 — the rail carries a signal, and the popover is a door (`e82a1aa8c` RED → `91f7103da` GREEN)

**RED, read rather than assumed:** the suite failed to LOAD — `Failed to resolve import "../attentionConditions"` — with `NavPanel.test.tsx` green at **14 passed** in the same run. **GREEN: 28 passed (14 + 14), `NavPanel.test.tsx` unchanged at 14.**

- `RailItem` gained a **generic** `badge?: React.ReactNode` slot and a `testId`. It branches on nothing — it does not know what a badge means, exactly as it does not know what `className` means. `relative` was added to the rail button's base class list so an absolutely-positioned badge anchors at the 40px collapsed square as well as the full-width expanded row.
- `attentionConditions.ts` — the producer registry, `Object.freeze`d, **one entry**.
- `AttentionPopover.tsx` — the shipped shadcn dropdown (the primitive `ProfileMenu` already uses). ⛔ **No package was installed.** There is no `@radix-ui/react-popover` in this repo and buying a dependency to draw a five-line panel would have been a real cost for no gain (T-235-SC).

### Task 3 — mobile gets the same signal (`8d92186a7` RED → `834502ffc` GREEN)

**RED: `4 failed | 1 passed (5)`.** The one pass is the non-vacuity control (the tree mounts, the drawer-opening control exists) — deliberately, because *a run in which every case is red is indistinguishable from a broken harness*. **GREEN: 5 passed.**

- `ChatLayout` resolves the registry **once** and feeds three renderers: the desktop rail, the drawer's Library button, and `ChatArea`'s hamburger.
- `ChatArea` gained **one optional prop and one decorative element**.

## ⭐ The measured `useSourceAttention` call count per render tree: **1**

Asserted at runtime in `ChatLayout.badge.test.tsx`, with all three renderers proven present in the same case *before* the count is read:

```
expect(await screen.findByTestId("rail-badge")).toBeInTheDocument()          // rail
expect(screen.getByTestId("drawer-trigger-dot")).toBeInTheDocument()         // hamburger
expect(await screen.findByTestId("drawer-attention-badge")).toBeInTheDocument() // drawer
expect(mockGetSourceHealth).toHaveBeenCalledTimes(1)
```

⚠ **`toHaveBeenCalledTimes(1)`, never `toHaveBeenCalled()`** — the second is true of the two-reader world it is supposed to catch.

The three-way assertion the plan asked for, measured:

| # | Criterion | Measured |
|---|---|---|
| 1 | `grep -c ATTENTION_PRODUCERS NavPanel.tsx` = **0** | **0** ✓ — `NavPanel` receives a PROP and imports only the *type* |
| 2 | `grep -c ATTENTION_PRODUCERS ChatLayout.tsx` = **1** | **1** ✓ |
| 3 | runtime `toHaveBeenCalledTimes(1)` | **1** ✓ |

⚠ **Criterion 2 is satisfiable only by a deliberate choice, and the choice is recorded rather than hidden.** A named import (`import { ATTENTION_PRODUCERS } from …`) plus one call site is **two** lines containing the literal, so the criterion as written is unreachable that way; a wrapper hook makes it **zero**, which fails it in the opposite direction and also stops the grep measuring anything. `ChatLayout` therefore uses `import * as attentionRegistry`, so exactly one line — the call site — names the registry, and the criterion measures the property it is about. The reason is written into the import's own comment so the next author does not "tidy" it back.

## Deviations from Plan

### 1. [Rule 3 — blocking] `AttentionProducer.use` takes the navigator as a parameter

The plan declared `use: () => AttentionCondition[]` while its `<action>` text asked for each condition's `onOpen` to be *"the injected `onOpenLibraryHealth`"*. **Injection is impossible through a zero-argument signature.** Shipped as `use: (onOpen: () => void) => AttentionCondition[]`. Nothing else about the registry changed, and the length assertion is unaffected.

### 2. Tasks 1 and 2 landed in ONE commit

Both are a single edit to `NavPanel.tsx` (the badge slot exists so the popover has something to hang off). Staging them apart would have committed a file with a badge and no door. Both tasks' verifications were run and both passed; the commit message says so.

### 3. `data-testid`, not `data-block` — as the plan required, recorded as instructed

The sketch emits `data-block`; the shipped house convention is `data-testid` and the composition fence asserts `data-testid`. Every hook here is `data-testid`: `rail-rail-item`, `rail-rail-item-library`, `rail-badge`, `rail-attention-trigger`, `rail-popover`, `rail-pop-item`, `rail-open-health`, `drawer-attention-badge`, `drawer-trigger-dot`.

### 4. A comment was reworded because it made a code measurement satisfiable by prose

`grep -n "color-danger" NavPanel.tsx` initially matched **a comment of mine** saying which token is forbidden. That is the 235-08 / 187-24 lesson recurring inside this phase: prose repeating a literal makes a code grep answerable by prose. The comment now names the forbidden token **in words**, and says why. `grep` returns nothing.

### 5. The badge carries no glyph — the design skill overrides the plan's phrasing

The plan's action said *"glyph + count + colour, never colour alone"*. The skill's own §4 says the opposite twice: **the word-badge carries NO glyph** (*"the WORD carries the meaning; tone is decoration"*) and **there is no category-icon vocabulary — do not invent one** (the worst of four measured sketch drifts). Shipped: the **count** is the non-colour carrier, the **sentence** (`COPY.badgeTitle(n)`) is the trigger's accessible name and `title`, and the tone is `bg-warning`. No mark was invented.

## The composition fence — ONE case turned green, and I BUILT it (a hook, on a surface that already existed)

| | 235-BASELINE.md | at my base `845a90b62` | after this plan |
|---|---|---|---|
| failed | 37 | **36** | **35** |
| passed | 12 | **13** | **14** |
| total | 49 | 49 | 49 |

⚠ **My base was NOT the BASELINE's tree, and the difference is not mine.** `§6 · "scheduled" appears in NEITHER api/sources.py…` was **already green** when I started: `backend/app/api/sources.py` contains zero occurrences and is **not in my diff** (`git diff 845a90b62 HEAD --name-only` is the eight files listed above). That case is plan 08's (BUG-260906-02). **My delta is exactly `+1`.**

**Which one, and which kind — the disambiguation `235-BASELINE.md` explicitly demands, because a missing hook and a missing surface fail this fence identically:**

> `§3 · rail · renders the \`rail-item-library\` block as [data-testid="rail-rail-item-library"]` — **the SURFACE already existed** (the fence's own positive control *"the rail renders a Library nav control"* was green at baseline). **I added the HOOK**, plus the `testId` prop that lets the Library item carry a kind distinct from a plain rail item. This is a hook-tagging pass on that one case and must not be read as a feature.

### ⛔ The other five rail cases are still red, and TWO of them cannot be turned green by building anything

**`rail-badge` (×2), `rail-popover`, `rail-open-health`, `rail-pop-item` — red for a HARNESS reason, not an absent surface.** `sourceComposition.test.tsx:425-437` mounts `<NavPanel>` with the ten shipped props and **no `attentionConditions`, no `onOpenLibraryHealth`, and no `getSourceHealth` mock**. By this plan's own contract that combination renders **nothing** — *"a caller that has not wired it gets silence rather than a dead control"*. The surfaces exist and are proven live by `NavPanel.badge.test.tsx` (badge at both widths, popover, pop-items, the `open-health` action). ⚠ **The fence file is not in this plan's `files_modified` and a sibling executor is live, so I did not touch it.** Whoever owns it needs to widen the rail harness with conditions + a navigator; that is a three-line change.

**`rail-rail-item` is UNSATISFIABLE AS WRITTEN, and this is the finding worth carrying forward.** The failure is not *"not found"* — it is:

```
TestingLibraryElementError: Found multiple elements by: [data-testid="rail-rail-item"]
```

§3 asserts each block kind with `screen.getByTestId(...)`, which **throws on more than one match**, while the sketch itself draws **four** `rail-item` blocks beside one `rail-item-library` (`index.html:664-674`). No implementation can make a four-instance block resolve to a single element; tagging only one rail item would be gaming the fence, and I did not.

⚠ **PLAN 10 AND PLAN 11 INHERIT THE SAME SHAPE, and it is better learned here than at their close.** §5 of the same file asserts **9** `source-line`, **3** `source-card`, **17** `run` and **2** `attention-row` — every one of those kinds is also asserted singularly by §3. `sources-source-line`, `sources-source-card`, `sources-run` and `health-attention-row` will fail with *"Found multiple elements"* the moment they are built correctly. The fix is `getAllByTestId(...).length` in §3 (which §4 already uses), and it belongs to whoever owns the fence — not to any of the three plans it will fail.

## Verification — measured

| Check | Result |
|---|---|
| `vitest run src/components/layout/__tests__` | **8 files · 76 passed · 0 failed** |
| `vitest run src/components/chat` | **31 files · 307 passed · 0 failed** |
| `npx tsc -p tsconfig.app.json --noEmit` | **66 errors — baseline unchanged** (235-08 recorded 66) |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **`count gate OK` — 227/227 pinned files present, no per-file decrease, 0 failing** |
| count-gate totals | `total 7544 · failed 0 · pinned total 6814` — **identical to 235-BASELINE / 235-08** |
| deletions in this plan's commits | **none** (`git diff --diff-filter=D 845a90b62 HEAD` is empty) |

⚠ **The count gate was green on the first run and the cap was never adjusted** (`GSD_VITEST_MAX_WORKERS=2` throughout). No SEED-171 suite went red, and none of its five named suites is in this plan's blast radius.

## Measured figures — for plan 12's pinning

⛔ `scripts/vitest-count-gate.cjs` was **NOT modified**. Every figure below was measured by running the file **alone**, not split out of a combined run — 235-08 recorded getting exactly that wrong and having to correct two rows.

| Suite | Before | After | Knob status |
|---|---|---|---|
| `src/components/layout/__tests__/NavPanel.badge.test.tsx` | — (did not exist) | **14** passed | ⛔ in NEITHER knob |
| `src/components/layout/__tests__/ChatLayout.badge.test.tsx` | — (did not exist) | **5** passed | ⛔ in NEITHER knob |
| `src/components/layout/__tests__/NavPanel.test.tsx` | 14 passed | **14** passed (unchanged) | pinned |
| `src/components/layout/__tests__` (whole dir) | — | **76** passed / 8 files | — |
| `src/components/chat` (whole dir) | — | **307** passed / 31 files | — |

⚠ **`src/components/layout` is a FILE-LEVEL knob, not a directory entry** — the gate's own comment at `vitest-count-gate.cjs:3728` says so explicitly, and the printed file list bears it out (`ChatLayout.fallback.test.tsx` appears; my two new files do not). **Plan 12 must add both files to BOTH knobs**, and should pin at the gate's own printed `— N new` figure rather than at the 14 / 5 above.

## Known stubs / seams

| Seam | File | Status |
|---|---|---|
| `AttentionCondition.onOpen` is produced and asserted, but **not rendered** — the popover's one action calls the `onOpenLibraryHealth` prop | `attentionConditions.ts`, `AttentionPopover.tsx` | **Deliberate.** It is the per-condition door D-235-03's generality needs: `SEED-231`'s conditions will lead somewhere other than Library Health, and carrying the door on the condition is what lets the popover stay branch-free about whose condition it is rendering. It is exercised by the producer's own assertion, not dead. |

⛔ **No stub blocks this plan's goal.** A stopped source produces a visible, named, actionable signal on every surface that exists today.

## The residual gap — planted, not glossed

**`SEED-253` — at mobile width there is no way to open the nav drawer from any view except chat.**

Measured, not inferred: `ChatLayout` sets `drawerOpen` from exactly one place, `onOpenDrawer={() => setDrawerOpen(true)}` on `<ChatArea>`, and `ChatArea` renders that callback on two `md:hidden` controls — both inside the chat view. Every other view mounts in `ChatLayout`'s `else` branch, which has no drawer trigger at all, and `NavPanel` is `hidden` below `md`.

- **It is PRE-EXISTING.** This phase did not create it, and the signal reaches **every mobile surface that has a trigger today**.
- `status: planted`, `surface: Agentic-RAG`, and `trigger_when` is a concrete observable event, never a date: *"the first phase that adds a mobile-reachable surface outside the chat view, OR the first report of a mobile user unable to open the nav drawer."*
- The seed also carries the one thing a fixer could silently get wrong: **the attention dot must move with the trigger**, or the mobile half of SURF-03 un-ships without a red test.

## Threat surface

No new network endpoint, auth path, file access or schema. The badge renders only what the owner-scoped `/sources/health` endpoint (plan 06) returned — **T-235-29** is discharged upstream and nothing here widens it. **T-235-30** (two readers polling) is discharged by the runtime call-count case. **T-235-31** (crying wolf) is discharged by deriving nothing: the shell renders the server's verdict and the debounce stays server-side. **T-235-32** (offering a repair a member cannot perform) is discharged by the popover carrying no repair control at all, asserted negatively and by name.

## Guardrails

- **G-5:** `ChatArea.tsx` (67 / 32 / 595) and `ChatLayout.tsx` are G-5-firing hot files. Both are **honoured by construction, by arithmetic**: `ChatArea` gained ONE optional prop and ONE decorative element — `useState`/`useEffect` call counts measured **3 before and 3 after** — and `ChatLayout` gained one destructured prop, one memoised callback, one read and two mount points, with no new branch in any view. `NavPanel.tsx` gained one generic slot on an existing component and one wrapper `div`.
- **G-2 (sketch before UX):** satisfied upstream — sketch 233 drew this rail, its badge and its popover, and `BUILD-CONTRACT.generated.md` is what the hooks are named from.

## Self-Check

Files claimed created — verified present:

- `frontend/src/components/layout/attentionConditions.ts` — FOUND
- `frontend/src/components/layout/AttentionPopover.tsx` — FOUND
- `frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx` — FOUND
- `frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx` — FOUND
- `.planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md` — FOUND

Commits claimed — verified in `git log 845a90b62..HEAD`:

- `e82a1aa8c` test(235-09): failing suite for the app-shell attention badge — FOUND
- `91f7103da` feat(235-09): the rail carries a signal, and the popover is a door — FOUND
- `8d92186a7` test(235-09): failing suite for the mobile home of the attention signal — FOUND
- `834502ffc` feat(235-09): the signal reaches mobile — drawer badge and closed-drawer dot — FOUND

Plan-forbidden writes — verified NOT in `git diff 845a90b62 HEAD --name-only`:

- `.planning/STATE.md` — not in the diff
- `.planning/ROADMAP.md` — not in the diff
- `scripts/vitest-count-gate.cjs` — not in the diff
- `frontend/src/components/sources/WatchedFoldersSection.tsx` (plan 10) — not in the diff
- `frontend/src/components/library/IngestionTab.tsx` (plan 10) — not in the diff
- `frontend/src/components/sources/sourceComposition.test.tsx` (not mine) — not in the diff

TDD gate sequence — `test(...)` → `feat(...)` → `test(...)` → `feat(...)`: both RED gates precede their GREEN gates in `git log`.

## Self-Check: PASSED
