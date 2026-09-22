---
phase: 262-an-expert-you-can-discover
plan: 03
subsystem: frontend-expert-catalog
tags: [PACK-11, catalog, honesty, tdd, count-gate, hot-file-ledger, derived-not-hardcoded]
requires: ["262-01", "262-02"]
provides:
  - "frontend/src/components/experts/catalog/expertCatalog.ts — pure search / derived categories / honest folder naming"
  - "frontend/src/components/experts/catalog/ExpertCard.tsx — the sketch's 5-element card face"
  - "frontend/src/components/experts/catalog/ExpertCatalogPage.tsx — the catalog surface and its declared props contract"
  - "PACK-11's vanish DRIVEN at the rendered surface, with a positive control"
affects:
  - "plan 04 (PACK-12): `resolveFolderNames` and its ResolvedFolder union are ready; `onInspect` is the declared seam"
  - "plan 05 (PACK-13 / reachability triad): `folders` + `onStartChat` ship on the props interface; the page is NOT yet mounted anywhere"
tech-stack:
  added: []
  patterns:
    - "derived-not-listed: a UI menu is computed from the rows, never transcribed from the sketch"
    - "discriminated union over optional field: `{known:false}` cannot render `undefined` as a label"
    - "a declared-but-unbound prop: the contract ships one plan before its consumer, to keep noUnusedParameters quiet"
key-files:
  created:
    - frontend/src/components/experts/catalog/expertCatalog.ts
    - frontend/src/components/experts/catalog/ExpertCard.tsx
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
    - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-262-02 honoured by CONSTRUCTION: no second card variant exists, so no grey-out can be rendered."
  - "D-262-07 honoured: exactly ONE listExperts() call, grep-asserted; management arm and resolver grep-asserted absent."
  - "The card's prompt tiles ship as DISPLAY, not triggers — PACK-13's callback is plan 05's, and a tile wired elsewhere would lie."
  - "`folders` declared on the props interface but deliberately not destructured (TS6133 / base 70, zero headroom)."
  - "D-262-10's refusal edge left as the planner took it, and re-flagged for the phase close."
metrics:
  duration: "~40m"
  tasks: 3
  completed: 2026-09-22
---

# Phase 262 Plan 03: The catalog page Summary

The first user-facing surface in this repository that renders migration 189's presentation columns
at all — a search-and-category catalog over exactly the Experts the server returned — with PACK-11's
vanish driven at the rendered output, a positive control that proves the probe works, and category
pills **derived from the rows** rather than transcribed from the sketch.

**Commits:** `b6a3bbbad` · `48adb425a` · `bd57b34df` · `9128effe3`

⛔ **The catalog is NOT reachable at the end of this plan**, by design (D-262-03's one-commit rule):
the `ActiveView` member, the `ChatLayout` branch and the entry actions land together in plan 05.

---

## Task 1 — the pure module

### The RED, quoted verbatim, captured before the real implementation existed

`expertCatalog.ts` was first committed to disk with `resolveFolderNames` implemented as the
**silent drop** — `ids.filter((id) => byId.has(id)).map(…)`. Three cases failed:

```
 ❯ src/components/experts/catalog/__tests__/expertCatalog.test.ts (10 tests | 3 failed)
   × (8) THE RED — an unresolvable id returns an UNKNOWN entry, never a silent drop
   × (9) no ids yields an empty array — 'binds no folders' is distinguishable from 'binds folders I cannot see'
   × (10) a matched folder carrying a BLANK name is unknown, not a blank label

 FAIL  … > (8) THE RED — an unresolvable id returns an UNKNOWN entry, never a silent drop
AssertionError: expected [ { id: 'a', known: true, …(1) } ] to have a length of 2 but got 1

- Expected
+ Received

- 2
+ 1
```

Whole-file RED: `Tests 3 failed | 7 passed (10)`. After the union implementation: **10 passed**.

⭐ **That RED is the point of the task.** The drop is not hypothetical: mig `188:29-37` seeds the one
system Expert's knowledge folder into a **single** org, so every other org's `listFolders()` resolves
nothing for it (RESEARCH §4b / P-6). A filtering implementation would have shortened the scope list
of the only Expert every tenant has, and **nothing on screen would have said so**.

### What the module decides, and what it refuses to

| Export | Contract |
|---|---|
| `filterExperts` | case-insensitive over `name`, `description`, `when_to_use`, `member_skills` — the sketch's "name, topic, or capability". A row with NO `category` is never returned under a NAMED category, and IS returned under `all` |
| `categoriesOf` | the distinct non-empty `category` values PRESENT, sorted, deduped. `categoriesOf([])` → `[]` |
| `resolveFolderNames` | input order preserved; `{id, known:true, name}` or `{id, known:false}`. **No optional `name`** — an optional field would let a caller render `undefined` and call it a label |

⛔ **THE PILLS ARE DERIVED.** `grep -cE "Finance & Accounting|Legal & Compliance|Platform & Dev|HR & Ops"`
→ **0** in every file this plan wrote. Hardcoding the sketch's five names would have been a **sixth**
`financial-analyzer`-class artefact in the same phase that retired five (RESEARCH R-7 / plan 02).

⛔ **PURE.** `grep -cE "useState|useEffect|fetch\(|import .*react"` → **0**.

⚠ **One behaviour the plan did not name, added under Rule 2:** a folder that resolves to a BLANK
name is `known: false`, not `known: true, name: ""`. Rendering an empty label is the same failure as
dropping the id — the caller could not tell the difference. Driven as case (10).

---

## Task 2 — the card face and the catalog surface

### The five elements, and the one that is a prohibition

| # | Element | As shipped |
|---|---|---|
| 1 | identity + badges | `ExpertIcon icon={expert.icon}` gem, name, `category · System Template`/`Org Custom` meta line, `Restricted`/`Biased` scope badge |
| 2 | **no lecturing paragraph** | `grep -c "when_to_use"` → **0** |
| 3 | scope envelope | folder **COUNT**, skill **NAMES**, connection **NAMES** (RESEARCH §4b: only folders are ids) |
| 4 | action tiles | up to three from the Expert's OWN `prompt_suggestions`; none → no strip, no invented tile |
| 5 | dual-action footer | `Details` → `onInspect`, `Start Chat` → `onStartChat` |

An Expert with no `category` renders **"Uncategorised"**, never someone else's heading.

⛔ **NO SECOND CARD VARIANT EXISTS.** `grep -ciE "clone|upgrade to|locked|unlock"` on `ExpertCard.tsx`
→ **0**. D-262-02 is honoured by construction, not by review: there is no code path that renders an
Expert as unavailable, so PACK-11's vanish cannot be faked as a grey-out.

⚠ **THE TILES SHIP AS DISPLAY, NOT TRIGGERS — a deliberate scope call, stated rather than glossed.**
The plan's declared card props are `expert` / `onInspect` / `onStartChat`; none carries a prompt.
One-click execution is PACK-13 (plan 05). Pointing a tile at `onStartChat` would start a chat
*without* the prompt the tile names, and pointing it at `onInspect` would make it a control that
does something other than what it says. Both are the dishonesty this phase exists to remove, so the
tiles carry no button affordance and the two footer controls own every interaction. **Plan 05 gives
the tile its own callback; it must not quietly re-point this one.**

### The page

One read, on mount, `listExperts()` with its defaults — the grant-aware arm.

| Grep on `ExpertCatalogPage.tsx` | Result |
|---|---|
| `listExperts\(` | **exactly 1** |
| `for_management\|forManagement\|/resolve` | **0** |

⛔ **THE TWO UNUSED READS ARE NAMED HERE, NOT IN THE SOURCE**, and this is the plan's one real
deviation (below): the **management arm** of the list function returns the unfiltered roster and
requires `experts:manage`; the per-Expert **resolver endpoint** returns `ResolvedExpertBundle`, which
carries none of migration 189's four presentation columns. Spelling either token in a comment
satisfies the very grep that proves the page cannot reach it.

⛔ **`folders` IS DECLARED AND NOT DESTRUCTURED.** The component takes `props` and reads
`props.onStartChat` / `props.onInspect`. `tsconfig.app.json` sets `noUnusedParameters`; the tsc base
is **70** with this task's criterion being "at most 70", so an unused binding on an otherwise-correct
prop would have failed the gate at 71. **The prop ships on the interface; only the binding waits for
plan 04.**

States: loading (zero cards) · honest empty (*"No Experts are available to you yet."*, zero cards,
**and zero pills**) · search-empty (*"No Expert matched that search."*) · refusal (the server's own
sentence, zero cards).

---

## Task 3 — the vanish, driven

### The RED, quoted verbatim — and what PASSED against the stub is the finding

`ExpertCatalogPage.tsx` was temporarily replaced with a stub rendering three hardcoded fixtures
regardless of the mock's return:

```
 ❯ src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx (8 tests | 6 failed)
   × (2) THE VANISH — an Expert the caller holds no grant for does not appear at all
   × (4) THE REFUSAL — the server's own sentence renders beside ZERO cards
   × (5) SEARCH narrows the grid, driven through the real control
   × (6) CATEGORY pills are DERIVED from the rows and narrow the grid
   × (7) an empty-but-successful load renders an honest line and ZERO cards — and no pills
   × (8) the read is the grant-aware one: called ONCE, with no arguments

 FAIL  … > (2) THE VANISH — an Expert the caller holds no grant for does not appear at all
AssertionError: expected <div …(1)></div> to be null

- Expected:
null

+ Received:
<div
  data-testid="expert-card-executive-compensation-advisor"
>
  Executive Compensation Advisor
</div>
```

⭐ **CASES (1) AND (3) PASSED AGAINST THE RENDER-EVERYTHING STUB, AND THAT IS THE MOST USEFUL LINE IN
THIS SUMMARY.** The positive control passed because the stub renders the Expert; the
no-consolation-prize sweep passed because a page with no upsell vocabulary *and no honesty* also
contains none of those words. **Neither arm alone can catch a catalog that shows everything** — the
vanish needs its own assertion, and a vanish without a positive control would pass against a page
that renders nothing at all. The plan demanded all three; all three were needed.

The stub was restored and the restoration **proven, not asserted**: `git hash-object` read
`b798e6ee12519cf1d82822a6c969dddd1cb349f2` both before the plant and after the restore, and
`git diff --quiet` was clean. (A raw md5 would have been confounded by CRLF normalisation —
CLAUDE.md's own rule.) **No gate was running while the file was planted.**

### The suite

⛔ **EVERY FIXTURE IS `visibility: "granted"`.** RESEARCH §6 traced the predicate: the grant check
bites for that value **alone** — a bundle at `'org'` or `'public'` is visible to every org member no
matter what grants exist. An `'org'` fixture expecting a vanish asserts something the data does not
say and would pass while proving nothing. **The same trap will sink the G-4 UAT row if the operator
authors the wrong visibility there.**

| Case | What it pins |
|---|---|
| (1) POSITIVE CONTROL | all three returned → the granted Expert's card renders; 3 cards |
| (2) THE VANISH | two returned → the third's **name** absent (`queryByText`), its **slug** absent from `textContent`, 2 cards |
| (3) NO CONSOLATION PRIZE | `container.textContent` lowercased contains none of `locked` / `unlock` / `upgrade` / `not available to you` / `request access`; **zero disabled buttons** |
| (4) THE REFUSAL | a rejected read carrying the server's `upgrade_hint` sentence renders that sentence, ZERO cards |
| (5) SEARCH | `userEvent.type` into the real control narrows 3 → 1; `clear` restores 3 |
| (6) CATEGORY | `All` + one pill per DERIVED category; `Platform & Dev` (a sketch name no row carries) is **absent**; clicking `Legal` narrows to 1 |
| (7) EMPTY | honest line, zero cards, **no pills** |
| (8) THE READ | called **once**, with `[]` as its arguments — the management arm is unreachable from this surface |

⛔ Absence is asserted over rendered TEXT, never over a missing `data-testid` — the criterion is what
a person sees, and this repository's recorded finding is that presence assertions cannot see content
drift. The mock uses the `{...await vi.importActual(…)}` spread from `ComposerExpert.test.tsx:8-15`,
overriding `listExperts` only — the shape that keeps the Phase-196-08 mock-factory failure class out
of reach.

### Both knobs, same commit

`src/components/experts` has **no bare-directory TARGETS entry** — every sibling suite is named
file-level — so both new suites were in NEITHER knob by default. Adopted into **TARGETS and
BASELINE together** in `bd57b34df`, with pins taken from the gate's **own printed `— N new` column**
on the run that first named them in TARGETS:

```
  ExpertCatalogPage.test.tsx                    —       8     new
  expertCatalog.test.ts                         —      10     new
```

`grep -c "expertCatalog.test\|ExpertCatalogPage.test" scripts/vitest-count-gate.cjs` → **5**
(two TARGETS entries, two BASELINE pins, one in the adoption comment).

---

## Gates

| Gate | Result |
|---|---|
| `vitest run src/components/experts` | **5 files / 52 passed**, exit 0 (catalog 18 = 10 + 8) |
| `vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | **`count gate OK` — 322/322 pinned present, no per-file decrease, 0 failing.** `total 8723 · pinned total 7982`. Pinned files **320 → 322 (+2 exactly)**; pinned total **7964 → 7982 (+18 = 10 + 8)** |
| `tsc -p tsconfig.app.json --noEmit` | **70 errors — SET DIFF against base EMPTY** (base captured on the untouched tree, also 70). ⛔ bare `tsc --noEmit` checks zero files |
| `check-hot-file-ledger.cjs --files <3>` | exit **0** — 328 rows, 3/3 watched |
| `check-claude-md-size.cjs` | exit **0** — `118989` chars, under the 120,000 warn band (wave 2 left `118971`; this plan is net **+18**). No `[duplicate-row]`, no `[disposition-too-long]` |
| backend baseline harness | **not run, and not omitted — not required.** `git diff --stat 9a724c733 HEAD -- backend/` is **EMPTY**; this plan touches zero backend files |

### The count gate's failures, triaged BEFORE any re-run

⛔ **The gate was run TWICE, for two different reasons, and BOTH readings are published — the second
is not offered as proof of innocence for the first.**

**Run 1** (TARGETS named, BASELINE not yet pinned — the run whose purpose was to read the `— N new`
figures) reported **`failed 3`**. Filenames and node ids were taken from the gate's **own persisted
JSON** before anything was re-run:

| # | File | Node id | Verdict |
|---|---|---|---|
| 1 | `components/library/__tests__/sketchComposition.test.tsx` | `§2 positive controls the page renders its heading — the mount harness works` (`STACK_TRACE_ERROR`) | **INHERITED** — identical node id to CONTEXT's base reading |
| 2 | `components/library/__tests__/sketchComposition.test.tsx` | `§2 positive controls the four shipped tab triggers render — the tab bar is already built` (`Found multiple elements with the role "tab" and name "Documents"`) | **INHERITED** — identical to base |
| 3 | `pages/WorkflowBuilderPage.canvas.test.tsx` | `canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns` (`STACK_TRACE_ERROR`) | **SEED-171's fifth named cap-independent flaky suite** — the same one wave 1 saw |

Provably outside this plan's reach: `git diff --numstat 9a724c733 HEAD -- frontend/` is **four
newly-CREATED leaf files and nothing else** —

```
159  0  frontend/src/components/experts/catalog/ExpertCard.tsx
189  0  frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
136  0  frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
 96  0  frontend/src/components/experts/catalog/expertCatalog.ts
```

— so nothing either suite mounts was touched. ⛔ **The cap was NOT adjusted** (held at `2`), and
**run 2 was not a retry to make a red go away**: it existed because BASELINE had changed and the
pinned-file count could not be verified without it. Run 2 read `failed 0`.

⚠ **Recorded as an observation, never as proof of innocence.** One green sample of an intermittently
red suite proves nothing — CLAUDE.md's correction (b), `SEED-171`, and the 2026-09-16 oscillation
finding all say exactly that. ⛔ **`count gate OK` was NOT written as an acceptance criterion
anywhere in this plan's execution**; the criteria used were the per-file deltas (all `0`), the
+2 pinned-file delta, and the explicitly-run in-scope suites.

---

## Deviations from Plan

**1. [Scope, stated as a decision] The two forbidden reads are named in this SUMMARY, not in the source comments**
- **Found during:** Task 2, by running the acceptance greps against my own first draft
- **Issue:** the plan required prose explaining WHY the management arm and the resolver are off limits, AND `grep -cE "for_management|forManagement|/resolve"` returning **0** on that same file. My docblock scored **2**; `grep -cE "listExperts\("` scored **3** against a required **1**; `grep -ciE "clone|…"` on the card scored **1**. Every hit was my own explanatory prose naming the literal the grep proves absent.
- **Fix:** the comments now describe each forbidden read in words and point at this SUMMARY for the exact tokens. All six greps re-measured clean.
- **Files modified:** `ExpertCatalogPage.tsx`, `ExpertCard.tsx`
- **Commit:** `48adb425a`
- ⚠ **This is the IDENTICAL tension plan 02 recorded as its own deviation 1, and it recurred because the resolution lives in a SUMMARY nobody re-reads.** It will recur again in plan 04 unless the rule moves somewhere executable. Named here rather than quietly worked around.

**2. [Rule 2 — missing correctness behaviour] A folder resolving to a BLANK name is `known: false`**
- **Found during:** Task 1
- **Issue:** the plan specified "never a drop, never a blank string" for an *unresolvable* id, but said nothing about a folder row whose `name` is empty or whitespace. The obvious implementation returns `{known:true, name:""}` — a blank label, which is the exact failure the union exists to prevent, one case over.
- **Fix:** a blank name resolves to `known:false`; driven as case (10), including an assertion that the returned object carries **no `name` key at all**.
- **Commit:** `b6a3bbbad`

**3. [Scope, stated as a decision] The card's prompt tiles ship as DISPLAY, not as triggers**
- The plan's card props are `expert` / `onInspect` / `onStartChat` — none carries a prompt, and PACK-13 is plan 05. Rather than wire a tile to a callback that does something other than run the prompt it names, the tiles render without a button affordance. Full reasoning above and in the ledger section. **Plan 05 must give the tile its own callback, not re-point an existing one.**

**4. [Observation — the registers disagreed AGAIN] `scripts/vitest-count-gate.cjs`**
- CLAUDE.md read `236 / 58 / 5988`; `docs/HOT-FILE-LEDGER.md` read `235 / 55 / 5923`. Measured: **`242 / 55 / 6056`**. The `58` is the **unfiltered** phase count — it includes `260807`, `260808` and `260814`, which are **dated quick tasks CLAUDE.md's own recipe says to subtract**. Both registers reconciled, with the disagreement recorded. This is the same class of finding wave 1 made on `NavPanel.tsx` one plan earlier, and the same-commit sync rule had lapsed again.

**5. [Rule 1 — a figure already false when written] The three catalog ledger rows existed at PLANNING with `0 / 0 / 0`**
- Anticipated by the phase-critical constraints (wave 2 hit it for `expertIcon.tsx`, wave 1 hit the `[duplicate-row]` version). **UPDATED IN PLACE** to the measured `1/1/96`, `1/1/159`, `1/1/189`, with the planning triples kept visible. No second row added; `check-claude-md-size.cjs` reports no `[duplicate-row]`.
- **Commit:** `9128effe3`

No Rule 4 (architectural) decisions were needed. No authentication gates. **No packages installed** —
`lucide-react`, `@testing-library/*` and `userEvent` were already present (T-262-SC).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change.

- **T-262-09 honoured and grep-asserted** — exactly ONE `listExperts()` call, `for_management` and the resolver absent, so no arm exists that could return rows the caller has no grant for. Case (8) additionally asserts the call was made with **no arguments at all**.
- **T-262-10 honoured and DRIVEN** — the no-grey-out ruling is enforced by a rendered-text assertion over `locked / unlock / upgrade / not available to you / request access` plus a zero-disabled-buttons check, not by code review.
- **T-262-11 accepted as planned** — `grep -c "dangerouslySetInnerHTML"` → **0** across all three new source files; React escapes text children.
- **T-262-12 accepted as planned** — client-side filtering over a small roster.

⚠ **Out of scope, re-flagged rather than hidden (D-262-10).** The refusal state renders the server's
`upgrade_hint` ("Upgrade to Enterprise…") verbatim, which touches the edge of D-262-02's no-upsell
ruling. The planner took this deliberately — it is an error string at a failed read, not a brochure
entry, and `InviteExpertDialog.tsx:102-106` already renders the same string in the same situation, so
inventing a second vocabulary would make two surfaces disagree about one fact. **Raise at phase
close; it is one `<span>` to reverse.**

⚠ **A deploy-parity item inherited from wave 1, re-flagged because this plan is the surface it
breaks:** all 33 LOCAL orgs read `enterprise`, while Phase 258 measured **2 of 2 PRODUCTION orgs at
NULL tier**, which `entitlements.py` fails CLOSED on. **A locally-green Expert catalog predicts a
wholesale 403 in production** until the cloud orgs carry a tier — at which point this page's refusal
state, not its grid, is what every user would see.

## Known Stubs

None. Both RED stubs (task 1's dropping resolver, task 3's render-everything page) were replaced
within their own tasks; the render-everything page was **never committed** and its removal is proven
by `git hash-object`. No TODO, no FIXME and no hardcoded roster survives in any committed file.

⚠ **The stub scan's first reading was `0 / 0 / 2` and the `2` was MINE TO EXPLAIN, not to round
down.** Both hits are on `ExpertCatalogPage.tsx:110-111` and both are the search input's HTML
`placeholder="Search by name, topic, or capability..."` attribute and its
`placeholder:text-muted-foreground` Tailwind class — shipped UI copy taken verbatim from the sketch
toolbar, not a stand-in for unwritten code. Recorded because a summary that quietly reports the
number it wanted is how a real stub gets through this section.

⚠ **One intentional incompleteness, which is a plan boundary rather than a stub:** the catalog is
**not mounted anywhere**. `ExpertCatalogPage` has no `ActiveView` member, no `ChatLayout` branch and
no entry action — D-262-03's reachability triad lands as one commit in plan 05, and wave 1's AST
fence (`activeViewReachability.ts`) is what will make that claim provable rather than asserted.

## Self-Check: PASSED

```
FOUND: frontend/src/components/experts/catalog/expertCatalog.ts
FOUND: frontend/src/components/experts/catalog/ExpertCard.tsx
FOUND: frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
FOUND: frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
FOUND: frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: b6a3bbbad  FOUND: 48adb425a  FOUND: bd57b34df  FOUND: 9128effe3
```
