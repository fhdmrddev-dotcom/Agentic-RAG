---
phase: 262-an-expert-you-can-discover
plan: 01
subsystem: frontend-fences + repo-registers
tags: [reachability, count-gate, hot-file-ledger, entitlements, tdd]
requires: []
provides:
  - "activeViewReachability — AST ActiveView↔ChatLayout-branch correspondence checker"
  - "count-gate coverage for nav-items.test.ts, navItemsConnections.test.ts, activeViewReachability.test.ts"
  - "262-TIER-PRECONDITION.md — the measured experts entitlement for the UAT org"
affects:
  - "plans 03-05: the ActiveView member they add is now provable, not asserted"
tech-stack:
  added: []
  patterns:
    - "ts.createSourceFile over ?raw source imports — AST measurement a comment cannot satisfy"
    - "vacuity refusal: a checker THROWS rather than reporting over nothing"
key-files:
  created:
    - frontend/src/lib/activeViewReachability.ts
    - frontend/src/lib/__tests__/activeViewReachability.test.ts
    - .planning/phases/262-an-expert-you-can-discover/262-TIER-PRECONDITION.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-262-04 honoured by construction: the checker parses, it does not grep."
  - "The three adopted suites went into TARGETS and BASELINE in the SAME commit."
  - "The tier remedy SQL was NOT written, because writing it puts it one paste from production."
metrics:
  duration: "~1h05m"
  tasks: 3
  completed: 2026-09-22
---

# Phase 262 Plan 01: The guard this project never had Summary

An AST-based `ActiveView`↔`ChatLayout`-branch reachability fence, driven RED against a synthetic
13th member before it existed; three previously-ungated suites adopted into both count-gate knobs;
eight ledger triples re-derived in both registers (seven were stale, and two registers disagreed
about one file); and the UAT org's `experts` entitlement measured read-only as **ALLOWED**.

**Commits:** `e996d3248` · `986f92898` · `23a9206e5`

---

## Task 1 — the reachability fence

### The RED, quoted verbatim, captured before the checker existed

`frontend/src/lib/activeViewReachability.ts` was first committed to disk as a **stub returning an
empty `unbranched`**, the suite was run, and case (2) read:

```
 FAIL  src/lib/__tests__/activeViewReachability.test.ts > activeViewReachability · (2) THE RED — a branchless member is caught > a synthetic 13th union member with no ChatLayout branch lands in `unbranched`
AssertionError: expected [] to deeply equal [ 'expert-catalog-synthetic' ]

- Expected
+ Received

- [
-   "expert-catalog-synthetic",
- ]
+ []
```

The whole-file RED was `Tests 7 failed | 4 passed (11)`. After the AST implementation:
`Test Files 1 passed (1) · Tests 11 passed (11)`.

⭐ **This is the point of the task.** `262-RESEARCH.md` R-2 measured that a branchless 13th member
ships GREEN today, and this plan re-confirmed why by reading the two suites that were supposed to
cover it:

- `ChatLayout.fallback.test.tsx` is **four source-text assertions that mount nothing and enumerate
  nothing**. Its fourth case is literally titled *"the compile-time exhaustiveness check is bypassed
  via as never in a ternary"*, and its body is a single `expect(LAYOUT).toContain("as never")` — it
  asserts the escape hatch is present, which is the opposite of catching what the hatch lets through.
  Its own comment delegates the real guarantee to `renameFence.test.ts`.
- `renameFence.test.ts` case (a) then asserts `expect(members.length).toBeGreaterThanOrEqual(10)` —
  a **FLOOR**, not a correspondence. Twelve members and one branch passes it.

So the delegation formed a loop with nothing at the bottom of it. Waves 3-5 land a member; this is
what makes wave 5's claim provable.

### What the checker does, and what it refuses to do

| Property | Implementation |
|---|---|
| members | `TypeAliasDeclaration` named `ActiveView` → `UnionTypeNode` → `LiteralTypeNode`/`StringLiteral` |
| branched | every `BinaryExpression` `===` with left `Identifier("activeView")` and a `StringLiteral` right — a **sub-expression** walk, so `activeView === "workflow-run" && canvasEnabled` is caught |
| unbranched | `members` minus `branched`, order preserved |
| fallbackIsLast | max `node.pos` of the comparisons vs the `UnknownViewFallback` JSX element's `pos`; **`false` when the element is absent**, never true-by-absence |
| vacuity | THROWS `ActiveViewReachabilityError` on: no alias, zero string members, zero comparisons |

⛔ **AST, never grep** (D-262-04 / research P-2). This is not stylistic: `App.tsx:96` carries a
comment that *deliberately refuses to spell its own twelfth member* because a prior acceptance fence
counted occurrences in the file and prose would have satisfied it. A grep-shaped checker would have
the same defect in reverse. `grep -c "createSourceFile" frontend/src/lib/activeViewReachability.ts`
→ `2`.

⛔ **The vacuity refusals are driven, not claimed** — cases (6a)/(6b)/(6c). A checker that silently
parses zero members passes everything, which is the failure mode the whole file exists to prevent.

### A measured detail worth not rediscovering

`frontend/tsconfig.app.json` sets `verbatimModuleSyntax: true` with no `esModuleInterop`, and
`typescript` ships CJS (`export = ts`). The import that typechecks **and** survives vitest's Node
CJS→ESM interop is:

```ts
import * as tsNamespace from "typescript"
type TsModule = typeof import("typescript")
const ts: TsModule = ((tsNamespace as unknown as { default?: TsModule }).default ?? tsNamespace) as TsModule
```

Both halves were spiked empirically (tsc clean + a throwaway vitest case) before the real file was
written; the spike files were deleted, not committed. A bare `import ts from "typescript"` is the
obvious thing to try and is wrong here.

⚠ Nothing in the app bundle imports this module — its only consumer is its own suite. That is what
makes importing a devDependency from `src/` safe, and a future app-side import would pull a compiler
into the bundle.

---

## Task 2 — the registers

### Eight triples, re-derived with CLAUDE.md's recipe (not copied)

| File | was | **measured 2026-09-22** | drift |
|---|---|---|---|
| `frontend/src/App.tsx` | `32 / 23 / 374` | **33 / 24 / 378** | +1 phase |
| `frontend/src/components/layout/ChatLayout.tsx` | `51 / 26 / 1010` | **52 / 27 / 1014** | +1 phase |
| `frontend/src/components/layout/NavPanel.tsx` | `23 / 12 / 417` (CLAUDE.md) / `23 / 12 / 381` (ledger) | **24 / 13 / 417** | +1 phase; **the registers disagreed** |
| `frontend/src/lib/nav-items.ts` | `8 / 6 / 95` | **9 / 6 / 118** | +23 L |
| `frontend/src/components/chat/MessageInput.tsx` | `34 / 17 / 942` | **35 / 17 / 942** | +1 commit |
| `frontend/src/components/chat/ChatArea.tsx` | `77 / 38 / 882` | **77 / 38 / 882** | ⭐ HELD |
| `frontend/src/types/index.ts` | `85 / 65 / 1380` | **90 / 70 / 1434** | **+5 phases** |
| `frontend/src/lib/api/experts.ts` | `5 / 3 / 298` | **6 / 3 / 313** | +1 commit |

Derivation (the recipe verbatim, per file):
```
git log --oneline -- <file> | wc -l
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' \
  | grep -E '^[0-9]+(\.[0-9]+)?$' | grep -vE '^[0-9]{6}$' | sort -u | wc -l
wc -l < <file>
```
Every original is kept beside its correction in **both** registers; nothing was overwritten.

⛔ **`262-01` modifies none of the eight.** This is an INHERITED-staleness correction; each cell
says so, and plan 05 — which actually edits `App.tsx`, `ChatLayout.tsx`, `nav-items.ts`,
`MessageInput.tsx` and `ChatArea.tsx` — writes the phase's own G-5 dispositions and re-derives again.

### ⭐ The finding: `NavPanel.tsx`'s two registers disagreed about one number

CLAUDE.md said `417` lines; `docs/HOT-FILE-LEDGER.md` said `381`. **A row that is present and wrong
stops an audit harder than an absent row does** — this ledger says so itself — and *two* rows that
are present and disagree are worse still, because an auditor can pick whichever supports the answer
they already hold. The same-commit sync rule exists for exactly this, and it had silently lapsed.
Reconciled to the measured `417`, with both prior figures recorded.

### ⭐ And the gate caught this plan's own defect, in the turn it was authored

Adding a scan-list row for `activeViewReachability.ts` produced:

```
HOT-FILE LEDGER — 1 structural problem(s) in docs/HOT-FILE-LEDGER.md
  [duplicate-row] lines 10875 + 10949  frontend/src/lib/activeViewReachability.ts — one file, one row; merge them
```

The row **already existed**, added at PLANNING with `0 / 0 / 0`, along with its own narrative
section. Both duplicates were removed and the planning-time rows updated to the measured
`1 / 1 / 159` with `0 / 0 / 0` kept visible. This is the "fires in the turn the prose is authored"
property CLAUDE.md claims for that hook, observed working against a real defect rather than a
planted one.

### The knob gap, closed

`nav-items.ts` FIRES G-5 at 6 phases, and **two of its three suites ran in NEITHER count-gate knob**
— only `navItemsUnknownIsNotDenied.test.ts` was ever named. The array reaches `src/lib` by named
files only (there is no `src/lib` or `src/lib/__tests__` directory entry anywhere, a decision the
script records beside its chat/layout/panel entries), so the **D-07 non-discoverability lock** and
the **connections-reachability pin** were both deletable in silence. Same find as 257.1's
`NavPanel.test.tsx`, one directory over.

Adopted into **TARGETS and BASELINE together**, in one commit. Pins measured from an explicit GREEN
run of the three files *before* adoption (so adoption could not red the gate), then confirmed
against the gate's own column — all three reported `pinned == actual, delta 0`:

```
  activeViewReachability.test.ts               11      11       0
  navItemsConnections.test.ts                   6       6       0
  nav-items.test.ts                             2       2       0
```

`grep -c` in `scripts/vitest-count-gate.cjs` is **2** for each of the three basenames (one TARGETS
entry, one BASELINE pin).

---

## Task 3 — the tier precondition

> **VERDICT: `experts` is ALLOWED for org `22f9c615-0eec-440a-8804-ed4784d6f57f`.**

`subscription_tier = "enterprise"`, `add_ons = {}`, `tier_capabilities('enterprise','experts')`
`enabled = true`. **No remedy SQL was required, written or executed.** Five `SELECT`s, zero writes,
against the LOCAL Postgres on `127.0.0.1:54322` via `backend/venv/Scripts/python.exe` — ⛔ never the
Supabase MCP, which points at production. Full queries and raw output:
`262-TIER-PRECONDITION.md`.

Both G-4 subjects exist live in that org: `fhdmrd@gmail.com` (`org-admin`) and `fhdmrd.dev@gmail.com`
(`member`).

**Two findings the task did not ask for:**

1. **The refusal arm is not drivable on this box.** All **33** local orgs read `enterprise`; there is
   no NULL, `pro` or `standard` org anywhere. A green G-4 drive proves the allowed path and says
   nothing about the 403 + upgrade-guidance arm.
2. **Local and production are opposites, and production is the failing one.** Phase 258 recorded 2 of
   2 production orgs at NULL tier, which `entitlements.py` fails CLOSED on. ⛔ **A locally-green
   Expert catalog predicts a wholesale 403 in production** until the cloud orgs carry a tier. Named
   here as a deploy-parity item rather than left for the push to discover.

⛔ The remedy statement was deliberately **not** written down. Writing an
`UPDATE organizations SET subscription_tier = …` into a planning file puts it one copy-paste from
production, without the per-action approval CLAUDE.md requires (T-262-03: transfer, not mitigate).

---

## Gates

| Gate | Result |
|---|---|
| `vitest run src/lib/__tests__/activeViewReachability.test.ts` | **11 passed**, exit 0 |
| `tsc -p tsconfig.app.json --noEmit` | **70 errors — SET-DIFF against base IDENTICAL** (`diff` of the two error lists is empty). ⛔ bare `tsc --noEmit` checks zero files |
| `check-claude-md-size.cjs` | exit **0** — `118763` chars, under the 120,000 warn band (base was `118791`; this plan is **net −28**) |
| `check-hot-file-ledger.cjs --files <9>` | exit **0** — 328 rows, 9/9 watched |
| `vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | pinned total **7935 → 7954 (+19)**, grand **8676 → 8695**, BASELINE keys **316 → 319 (+3)**, **no per-file decrease**, single failure reason `[failing-tests]` |
| backend baseline | **not run — not required.** `git diff --stat a0c2f833e -- backend/` is **empty**; this plan touches zero backend files |

### The count gate's failures, triaged before any re-run

Filenames were taken from the gate's **own persisted JSON** (`--json` report) before anything was
re-run, and diffed by **node id**:

| # | File | Node id | Verdict |
|---|---|---|---|
| 1 | `library/__tests__/sketchComposition.test.tsx` | `§2 positive controls the page renders its heading — the mount harness works` | **INHERITED** — identical to research's base reading |
| 2 | `library/__tests__/sketchComposition.test.tsx` | `§2 positive controls the four shipped tab triggers render — the tab bar is already built` (`Found multiple elements with the role "tab" and name "Documents"`) | **INHERITED** — identical to base |
| 3 | `pages/WorkflowBuilderPage.canvas.test.tsx` | `canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns` (`STACK_TRACE_ERROR`) | **NEW to this run, and provably not this plan's** |

⚠ **#3 was `failed 2` at base and `failed 3` here, so it is honestly reported as a new failing name,
not hidden.** It is provably unmodified: `git diff --numstat a0c2f833e -- frontend/` for this plan is
**two newly-CREATED leaf files and nothing else** —

```
132  0  frontend/src/lib/__tests__/activeViewReachability.test.ts
159  0  frontend/src/lib/activeViewReachability.ts
```

— so nothing `WorkflowBuilderPage.canvas.test.tsx` mounts was touched. It is **SEED-171's fifth named
cap-independent flaky suite** (added at `196-05`), and `STACK_TRACE_ERROR` is its recorded signature.
⛔ The cap was **not** adjusted — CLAUDE.md's correction (b) is explicit that adjusting it does not
fix these, and reaching for it is the move the seed exists to prevent. **Recorded as an observation,
never as proof of innocence**: one green sample of a flaky suite proves nothing, and equally, this
plan did not re-run to make it go away.

⛔ `count gate OK` was **not a reachable criterion** at this base and no acceptance claimed it was.

---

## Deviations from Plan

**1. [Rule 3 — blocking] The membership table is `public.org_members`, not `public.organization_members`**
- **Found during:** Task 3
- **Issue:** the first probe read `UndefinedTableError: relation "public.organization_members" does not exist`
- **Fix:** discovered the real name from `information_schema` (`dept_members`, `org_members`) and re-queried
- **Files modified:** none (scratchpad probe only)
- **Commit:** `23a9206e5`

**2. [Rule 1 — bug in this plan's own output] A duplicate ledger row**
- **Found during:** Task 2, by `check-claude-md-size.cjs` itself
- **Issue:** the plan instructed *"ADD A ROW AT CREATION"*; a row and a section **already existed**, added at planning with `0 / 0 / 0`. The plan's instruction was written before that row landed.
- **Fix:** removed both of this plan's duplicates (CLAUDE.md + ledger), updated the planning-time rows to the measured `1 / 1 / 159` with the original visible, and folded the narrative into the existing section
- **Files modified:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
- **Commit:** `986f92898`

**3. [Scope, stated as a decision] The ledger triple for `activeViewReachability.ts` is `1 / 1 / 159`, not the plan's `0 / 0 / <wc -l>`**
- The file was committed by task 1 before task 2 measured it, so `0 / 0` would have been a figure that was already false when written — the exact failure this ledger exists to stop. The `0 / 0 / 0` planning triple is preserved beside it.

No Rule 4 (architectural) decisions were needed. No authentication gates. No packages installed —
`typescript ~5.9.3` was already a devDependency (T-262-SC).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change. T-262-01 honoured
(the recorded DB output is org id / name / tier / capability rows; no tokens, no `add_ons` payload
beyond the empty literal, no connection string). T-262-02 honoured (pins from the gate's own column,
none lowered). T-262-03 honoured (the remedy is an OPERATOR action and was not written). T-262-04
honoured (the vacuity refusals are driven).

## Known Stubs

None. The stub checker committed for the RED drive was replaced in the same task; the committed
`activeViewReachability.ts` contains no placeholder. The two spike files were deleted, not committed.

## Self-Check: PASSED

All 7 claimed files exist on disk; all 3 claimed commits resolve in `git log --all`.

```
FOUND: frontend/src/lib/activeViewReachability.ts
FOUND: frontend/src/lib/__tests__/activeViewReachability.test.ts
FOUND: .planning/phases/262-an-expert-you-can-discover/262-TIER-PRECONDITION.md
FOUND: .planning/phases/262-an-expert-you-can-discover/262-01-SUMMARY.md
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: e996d3248
FOUND: 986f92898
FOUND: 23a9206e5
```
