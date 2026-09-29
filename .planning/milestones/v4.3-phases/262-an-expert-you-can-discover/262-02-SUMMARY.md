---
phase: 262-an-expert-you-can-discover
plan: 02
subsystem: frontend-expert-surfaces + backend-api-fences
tags: [retirement, one-home-per-concern, tdd, count-gate, hot-file-ledger, PACK-11, PACK-12]
requires: ["262-01"]
provides:
  - "frontend/src/components/experts/expertIcon.tsx — the ONE home of expert-icon resolution"
  - "the five hardcoded demo-Expert sites RESEARCH R-7 named, retired as rewrites"
  - "backend API-layer proof that GET /experts reaches the grant-aware list path"
affects:
  - "plan 04 (PACK-12 detail modal): the spotlight card now states a folder COUNT; the NAMES are plan 04's job"
  - "any future Expert surface: icon resolution has one home and it cannot string-match"
tech-stack:
  added: []
  patterns:
    - "retirement-as-rewrite: the deleted assertion's REASON travels with its replacement (SEED-177 / D-206-07)"
    - "the retired literals live in the ledger + SUMMARY, never in the source — spelling them there would satisfy the greps that prove they are gone"
    - "closed-map component resolution for author-controlled strings (T-262-05)"
key-files:
  created:
    - frontend/src/components/experts/expertIcon.tsx
    - frontend/src/components/experts/__tests__/expertIcon.test.tsx
    - backend/tests/unit/test_262_expert_list_grants_api.py
  modified:
    - frontend/src/components/chat/ExpertSpotlightCard.tsx
    - frontend/src/components/chat/InviteExpertDialog.tsx
    - frontend/src/components/chat/__tests__/ExpertSpotlightCard.test.tsx
    - frontend/src/components/org/OrgExpertsTab.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-262-06 honoured and widened to RESEARCH R-7's five sites; all five gone, provable by grep."
  - "The spotlight folder pill stays a COUNT — the NAMES are PACK-12's job in plan 04's modal."
  - "The ExpertSpotlightCard pin was RAISED 5 → 9, never lowered; the pin is a floor."
  - "The retired identifiers and literals are recorded in the ledger and here, NOT in the source."
metrics:
  duration: "~1h10m"
  tasks: 3
  completed: 2026-09-22
---

# Phase 262 Plan 02: Five hardcodes retired, one icon home, PACK-11 at the API layer Summary

The five `financial-analyzer` sites RESEARCH R-7 measured are gone from both chat surfaces, replaced
by a single closed-map icon home that reads the `icon` column; the suite that pinned four of them was
rewritten (not deleted) from 5 to 9 cases with each replacing case naming the assertion it replaces;
and `GET /experts` now has an API-layer proof that it hands the caller's own identity and roles to
the grant-aware list path.

**Commits:** `c47b974fb` · `e9fecedae` · `2119035a3` · `134da0787` · `21ccf17ca`

---

## Task 1 — one home for the expert icon

### The RED, quoted verbatim, captured before the real implementation existed

`expertIcon.tsx` was first committed to disk as a **stub that still guessed from `name`** — a
faithful port of the retired `getExpertIcon` shape. Case (4) failed:

```
FAIL  src/components/experts/__tests__/expertIcon.test.tsx > (4) THE BEHAVIOUR CHANGE — an Expert
named "Financial Whatever" with NO icon gets the neutral fallback, not a name-derived guess
AssertionError: expected '<svg …' to be '<svg …' // Object.is equality

Expected: class="lucide lucide-sparkles h-5 w-5"
Received: class="lucide lucide-chart-column h-5 w-5"
```

Whole-file RED: `1 failed | 5 passed (6)`. After the real implementation: `6 passed`.

⭐ **That RED is the behaviour change, stated rather than asserted.** The retired function returned
📊 for *any* Expert whose slug was the seeded demo one **or whose name merely contained "financial"**
— so a customer's brand-new "Financial Whatever", authored by someone who never picked an icon, wore
the demo Expert's face.

### What the home does, and what it refuses to do

| Property | Implementation |
|---|---|
| map | `EXPERT_ICON_MAP` — the eleven lucide keys `OrgExpertsTab.tsx:30-46` shipped, moved verbatim |
| resolution | `icon && EXPERT_ICON_MAP[icon]` → component; otherwise `Sparkles` |
| what it reads | the `icon` field and **nothing else** — no `slug`, no `name`, no string content |
| T-262-05 | a CLOSED-MAP lookup. Never `React.createElement(userString)`, never a dynamic import, never an `<img src>`. Case (3) drives an unknown key **and** a `<script>` payload to the fallback |
| key set | pinned as a SORTED SET, not a count (case 5) — a silent drop degrades every Expert whose author chose that key |

`grep -cE "slug *===|name\.toLowerCase\(\)" frontend/src/components/experts/expertIcon.tsx` → **0**.

### The extraction out of `OrgExpertsTab.tsx` is a PURE MOVE, and it was checked as one

`OrgExpertsTab.test.tsx` (count-gate pin 5) is **byte-unchanged** — `git diff --stat` shows it absent
— and reports 5 passing. `grep -cE "^\s*(const ICON_MAP|function renderExpertIcon)"` → **0**.

⚠ **A small correction to the plan, stated rather than glossed:** the plan said "the two call sites";
`renderExpertIcon` had exactly **one** call site (`:215`). Measured, not assumed.

⚠ The move dropped nine now-unused lucide imports and the `React` default import (`React.ComponentType`
was its only use). The three pre-existing `TS6133` unused-import errors in that file (`Check`,
`FileCode`, `cn`) were **left alone** — they are out of scope and removing them would have altered the
tsc set diff this plan is measured against.

---

## Task 2 — five sites retired, as rewrites

### The readymade RED (RESEARCH P-7), driven exactly as specified

**GREEN before the change**, `ExpertSpotlightCard.test.tsx`, verbatim case names:

```
✓ renders expert name, glowing identity, and scope badges without lecturing prose
✓ displays 3 large Action Tiles with icons, titles, and prompts
✓ triggers onSelectPrompt with 1-click execution when an Action Tile is clicked
✓ triggers onDismiss when close button is clicked
✓ renders custom prompt suggestions when provided by expert bundle
Tests  5 passed (5)
```

**RED after the component change, before the test file was touched at all** — three failing case
names verbatim, with their errors:

```
× renders expert name, glowing identity, and scope badges without lecturing prose
    TestingLibraryElementError: Unable to find an element with the text: SEC Filings & Reports.
× displays 3 large Action Tiles with icons, titles, and prompts
    TestingLibraryElementError: Unable to find an element by: [data-testid="action-tile-1"]
× triggers onSelectPrompt with 1-click execution when an Action Tile is clicked
    AssertionError: expected "vi.fn()" to be called with arguments: [ Array(1) ]
Tests  3 failed | 2 passed (5)
```

⭐ **That pairing is the point.** GREEN-before / RED-after proves each retired assertion was actually
**load-bearing** rather than decorative — a deletion nobody can see fail is a deletion nobody can
audit.

### The five sites, and what each became

| # | Site | Was | Now |
|---|---|---|---|
| 1 | `InviteExpertDialog.tsx:27-37` | icon by `slug`/`name` string-match | `<ExpertIcon icon={expert.icon} />` |
| 2 | `ExpertSpotlightCard.tsx:70-81` | **the same function, verbatim** | `<ExpertIcon icon={expert.icon} />` |
| 3 | `ExpertSpotlightCard.tsx:26-42`, used `:58-59` | three verbatim SEC-filing prompts for anyone "financial" | the single honest "Explore Scope" tile the function already had |
| 4 | `ExpertSpotlightCard.tsx:93-96` | the literal `"SEC Filings & Reports"` | the folder COUNT arm it already had |
| 5 | `ExpertSpotlightCard.tsx:98-103` | the literal `"ratio_calculator"` | `member_skills[0] ?? "domain_tools"` |

**Provable:** `grep -rcE "financial-analyzer|SEC Filings|ratio_calculator|Q3 Revenue Growth"` → **0**
for both files; `grep -c "getExpertIcon"` → **0** for both files.

### The reason travelled with the retirement — and a deviation about WHERE

Each retirement carries, in place, why its predecessor shipped: at Phase 260 there was one seeded
Expert (migration 188) and **no read path for the presentation columns at all** — migration 189 had
not landed — so hardcoding was the only way the hero card could render anything. Migration 189 plus
`ExpertAuthoringStudio` turned it into a lie.

⚠ **DEVIATION (and it is a real tension, not a quibble).** The plan asked for the reason "in a comment
that keeps the original intent readable" **and** for `grep` of the retired literals to return **0** in
those files. Those two instructions conflict: naming `DEFAULT_FINANCIAL_TILES`, `getExpertIcon`,
`"SEC Filings & Reports"`, `"ratio_calculator"` or `"Q3 Revenue Growth YoY"` in a comment satisfies the
very grep that proves they are gone. **Resolved by putting the verdict in the source and the exact
identifiers in the durable registers** — `docs/HOT-FILE-LEDGER.md` (a per-site table with line
numbers) and this SUMMARY. The source comments say what was retired and why, describing the literals
rather than spelling them, and point at both registers. The same tension was resolved the same way in
the backend test's docstring (task 3).

### The test file was REWRITTEN, and the pin RAISED

`ExpertSpotlightCard.test.tsx` lands at **9 cases** (floor was 5). Each replacing case body names the
assertion it replaces and why that assertion existed. The fixture **keeps the old demo slug and name
on purpose**, so every case doubles as proof that the slug no longer decides anything.

| Case | Status |
|---|---|
| no-lecturing-prose acceptance bar | UNCHANGED (original case 1's surviving half) |
| identity gem from the `icon` COLUMN (`scale` → `lucide-scale`, no 📊) | REPLACES the implicit slug-match acceptance |
| iconless + "Financial" name → `lucide-sparkles`, never `lucide-chart-column` | NEW — the behaviour change at the shipping surface |
| folder COUNT + the Expert's OWN first skill; the two literals `queryByText` to null | REPLACES both literal assertions of original case 1 |
| `2 Folders` and `domain_tools` | NEW — pins the arms the string-match used to make unreachable |
| one honest tile; `action-tile-1`/`-2` and all three invented titles absent | REPLACES the whole of original case 2 |
| custom prompt suggestions | UNCHANGED (original case 5 — the shipped good path) |
| 1-click execution, driven against the Expert's OWN prompts | REPLACES original case 3 (behaviour kept, fabricated content dropped) |
| dismiss | UNCHANGED (original case 4) |

Pin **RAISED 5 → 9** in `scripts/vitest-count-gate.cjs`, to the gate's own printed figure, with a
comment naming this plan. **Never lowered.** The gate's final row reads `ExpertSpotlightCard.test.tsx
9 9 0`.

`ComposerExpert.test.tsx` (pin 5) reaches the dialog through `expert-card-${slug}` testids, which the
icon retirement does not touch — **confirmed green and byte-unchanged rather than assumed safe**.

---

## Task 3 — PACK-11 at the API layer

### The deliberate RED, quoted

```
>       assert str(kwargs["caller_id"]) == CALLER_ID
E       KeyError: 'caller_id'
tests\unit\test_262_expert_list_grants_api.py:106: KeyError
1 failed, 4 passed
```

⚠ The plant was reverted and the revert **proved**, not asserted: `git hash-object` read
`69096473a1bf992036ebcfb4074b2fea49b45418` both before the plant and after the restore (a raw md5
would have been confounded by CRLF normalisation — CLAUDE.md's own rule).

### The claim is scoped to what the test supports

The module docstring states what it does **not** claim. It does **not** re-prove the SQL predicate:
RESEARCH **R-4** measured that `test_261_expert_grants_db.py:354-364` already drives
`list_expert_bundles_for_caller` against real Postgres with a plain-member no-grant user, so the
ROADMAP's *"no test drives the no-grant user"* is FALSE at that layer. The genuine gap was the
**endpoint's own wiring**, and this file touches no database and carries no bail-out guard
(`grep -c "54322\|pytest.skip"` → **0**).

| Case | What it pins |
|---|---|
| `…hands_caller_identity_and_roles_to_the_grant_aware_path` | `caller_user_id` == the authenticated caller, `caller_roles == ["member"]`, `caller_org_id` == the active org — i.e. the `caller_user_id is not None` branch, never the unfiltered one |
| `…excluded_is_not_re_added_by_the_endpoint` | a bundle the grant-aware path dropped does not reappear in the body |
| `…returns_exactly_the_bundles_the_grant_aware_path_returned` | the positive control: two in, the same two out |
| `…management_arm_without_permission…never_reaches_the_service` | **T-262-06** — 403 *and* `assert_not_awaited()`. Not "the body was empty": the unfiltered query is never issued |
| `…no_role_yields_an_empty_role_list_not_a_null_entry` | **T-262-07** — `caller_roles == []`, never `[None]` |

⚠ **Every fixture bundle is `visibility: "granted"`.** RESEARCH §6 traced that the grant check bites
for that value **alone** — an `org`- or `public`-visibility fixture would pass while proving nothing,
because such a bundle is visible to every org member regardless of grants.

---

## Gates

| Gate | Result |
|---|---|
| `vitest run` (4 affected suites) | **25 passed** — expertIcon 6, ExpertSpotlightCard 9, ComposerExpert 5, OrgExpertsTab 5 |
| `vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | **`count gate OK` — 320/320 pinned present, no per-file decrease, 0 failing.** `total 8705 · failed 0 · pinned total 7964` |
| `tsc -p tsconfig.app.json --noEmit` | **70 errors — normalized SET DIFF against base is EMPTY** (base captured on the untouched tree, also 70). ⛔ bare `tsc --noEmit` checks zero files |
| `check-backend-unit-baseline.cjs` | **`[GATE PASSED]`** — `Failed tests: 71 (allowed ceiling: <= 71)`, `Errors: 0`, `Passed tests: 5495` (base 5490; +5 = this plan's cases) |
| `check-hot-file-ledger.cjs --files <4>` | exit **0** — 328 rows, 4/4 watched |
| `check-claude-md-size.cjs` | exit **0** — `118971` chars, under the 120,000 warn band (this plan is net **+208** on wave 1's `118763`) |

### ⭐ The count gate came back GREEN, and that is worth stating carefully

The phase-critical constraint and `262-CONTEXT.md` both recorded the gate as **RED AT BASE** with
`failed 2` in `library/__tests__/sketchComposition.test.tsx`, and wave 1 additionally saw
`pages/WorkflowBuilderPage.canvas.test.tsx`. **Neither reproduced in either of this plan's two full
gate runs** — `sketchComposition.test.tsx` read `47 47 0` and the verdict line read `0 failing` both
times.

⛔ **This is recorded as an OBSERVATION, not as a repair and not as proof of innocence.** Nothing in
this plan touches `src/components/library`. One green sample of an intermittently-red suite proves
nothing — CLAUDE.md's own correction (b) and `SEED-171` say exactly that, and the 2026-09-16
oscillation finding says a figure matching what a register claims is no more evidence than one that
does not. ⛔ **The cap was NOT adjusted** (held at `2` throughout) and **no run was repeated to make
a red go away** — the greens were what the first run of each invocation printed.

⚠ Consequently `count gate OK` was **not** written as an acceptance criterion anywhere in this plan's
execution; the criteria used were the **per-file deltas** (all `0`) and "no failing filename beyond
the inherited set" (there were none at all).

---

## Deviations from Plan

**1. [Scope, stated as a decision] The retired identifiers live in the registers, not in the source comments**
- **Found during:** Task 2, and again in Task 3
- **Issue:** the plan required BOTH "the original reason in a comment" AND `grep` of the five retired tokens returning 0 in those files. Naming them in a comment satisfies the grep that proves they are gone. The first draft of the comments scored `7` and `2` on the two greps.
- **Fix:** source comments state what was retired and why, describing the literals rather than spelling them, and point at `docs/HOT-FILE-LEDGER.md` (which now carries a per-site table with the exact identifiers and line numbers) and this SUMMARY. Same resolution applied to the backend docstring's `pytest.skip` / `:54322` mentions.
- **Files modified:** `ExpertSpotlightCard.tsx`, `InviteExpertDialog.tsx`, `test_262_expert_list_grants_api.py`, `docs/HOT-FILE-LEDGER.md`
- **Commits:** `2119035a3`, `134da0787`, `21ccf17ca`

**2. [Rule 1 — a figure that was already false when written] The ledger row for `expertIcon.tsx` existed at PLANNING with `0 / 0 / 0`**
- **Found during:** Task 1, by checking before adding (the phase-critical constraint warned of this; wave 1 hit the `[duplicate-row]` version of it)
- **Issue:** the plan said "Add a ledger row AT CREATION … triple `0 / 0 / <wc -l>`". A row and a full section already existed in both registers.
- **Fix:** UPDATED in place to the measured `1 / 1 / 72` after the code commit, with the `0 / 0 / 0` kept visible beside it. No second row added; `check-claude-md-size.cjs` reports no `[duplicate-row]`.
- **Files modified:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`
- **Commit:** `e9fecedae`

**3. [Observation] `renderExpertIcon` had ONE call site, not two**
- The plan said "replacing the two call sites". Measured: `OrgExpertsTab.tsx:215` was the only one. Recorded so the next reader does not go looking for a second.

**4. [Scope boundary] Three pre-existing `TS6133` unused-import errors in `OrgExpertsTab.tsx` were left in place**
- They predate this plan (`Check`, `FileCode`, `cn`). Fixing them would have changed the tsc error set this plan is measured against, for no benefit to the plan's goal. Out of scope; logged here rather than silently fixed.

### Ledger triples re-derived (four files, three of them stale)

| File | was | **measured 2026-09-22** | G-5 |
|---|---|---|---|
| `frontend/src/components/experts/expertIcon.tsx` | `0 / 0 / 0` (planning) | **1 / 1 / 72** | no |
| `frontend/src/components/chat/ExpertSpotlightCard.tsx` | `0 / 0 / 0` | **2 / 2 / 205** | no (2 phases) |
| `frontend/src/components/chat/InviteExpertDialog.tsx` | `0 / 0 / 0` | **2 / 2 / 218** | no (2 phases) |
| `frontend/src/components/org/OrgExpertsTab.tsx` | `1 / 1 / 347` | **2 / 2 / 324** | no (2 phases) |

Every original is kept beside its correction in both registers; nothing overwritten. **All three
chat/org files are now at TWO phases — the next phase to touch any of them is the third and owes a
seam proposal before its feature**, which is stated in each ledger section.

No Rule 4 (architectural) decisions were needed. No authentication gates. **No packages installed** —
`lucide-react` and `typescript` were already present (T-262-SC).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change.

- **T-262-05 honoured** — icon resolution is a closed-map lookup with a `Sparkles` fallback; case (3)
  drives both an unknown key and a `<script>` payload to that fallback.
- **T-262-06 honoured and DRIVEN** — the management arm's 403 asserts `assert_not_awaited()`, not
  merely an empty body.
- **T-262-07 honoured and DRIVEN** — `caller_roles == []` for an absent role, with an explicit
  `None not in roles`.
- **T-262-08 honoured** — the retirement is a rewrite; the pre-change GREEN and post-change RED are
  both quoted above with verbatim case names.

⚠ **Out of scope, raised not hidden:** `InviteExpertDialog.tsx:102-106` still renders `upgrade_hint`
("Upgrade to Enterprise…"), which sits against D-262-02's no-upsell spirit. `262-CONTEXT.md`'s
**D-262-10** took the assumption that this is an error string at a failed invite rather than a
brochure entry, and explicitly flagged it as the planner's call rather than the operator's. This plan
left it untouched and re-flags it for the phase close.

## Known Stubs

None. The RED stub committed for task 1's drive was replaced within the same task and the same
commit's working set; the committed `expertIcon.tsx` contains no placeholder and no `name` prop.

## Self-Check: PASSED

```
FOUND: frontend/src/components/experts/expertIcon.tsx
FOUND: frontend/src/components/experts/__tests__/expertIcon.test.tsx
FOUND: backend/tests/unit/test_262_expert_list_grants_api.py
FOUND: frontend/src/components/chat/ExpertSpotlightCard.tsx
FOUND: frontend/src/components/chat/InviteExpertDialog.tsx
FOUND: frontend/src/components/chat/__tests__/ExpertSpotlightCard.test.tsx
FOUND: frontend/src/components/org/OrgExpertsTab.tsx
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: c47b974fb  FOUND: e9fecedae  FOUND: 2119035a3  FOUND: 134da0787  FOUND: 21ccf17ca
```
