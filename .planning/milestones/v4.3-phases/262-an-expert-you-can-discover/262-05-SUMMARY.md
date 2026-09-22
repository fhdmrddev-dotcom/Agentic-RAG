---
phase: 262-an-expert-you-can-discover
plan: 05
subsystem: frontend-navigation + repo-registers
tags: [PACK-11, PACK-12, PACK-13, reachability-triad, nav-ia, count-gate, hot-file-ledger, seeds, tdd]
requires: ["262-01", "262-02", "262-03", "262-04"]
provides:
  - "the `experts` ActiveView member, its ChatLayout branch and its NAV_ITEMS entry — ONE commit"
  - "the EIGHTH NAV_ITEMS entry (tenth rail affordance) — rail AND mobile drawer from one array"
  - "the composer `+` menu's catalog door, on the shipped onOpenConnections prop chain"
  - "PACK-13 wired: one control on the catalog produces a thread the SERVER knows is scoped"
  - "the navigation/IA contract corrected in every register that states it"
affects:
  - "the phase: the catalog is reachable; verification can now drive it in a browser"
  - "SEED-185: the app has THIRTEEN views, still zero addressable"
  - "SEED-171: an eighth flaky suite, of a shape the seven do not cover"
tech-stack:
  added: []
  patterns:
    - "a union member is not reachability: member + branch + entry, in one commit, with a fence that fails when any is missing"
    - "correct a rotted claim BESIDE its original, in every register, in the commit that makes it stale"
    - "establish inherited-vs-new by checking the changed files out at the base and reproducing — never by unchangedness"
key-files:
  created: []
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/lib/nav-items.ts
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/layout/__tests__/NavPanel.test.tsx
    - frontend/src/lib/nav-items.test.ts
    - frontend/src/components/chat/__tests__/ComposerExpert.test.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .claude/skills/sketch-findings-agentic-rag/SKILL.md
    - .claude/skills/sketch-findings-agentic-rag/references/app-information-architecture.md
    - .planning/phases/262-an-expert-you-can-discover/262-CONTEXT.md
    - .planning/seeds/SEED-171,185,188,280,284,286,287,296,303
decisions:
  - "D-262-03 honoured mechanically: the triad is ONE commit, shown by `git show --stat`."
  - "D-262-04 honoured by measurement: `grep -ci experts frontend/src/App.tsx` → 1, the union line."
  - "D-262-09's re-aim implemented: the nav entry is UNGOVERNED, because `experts` is a per-org TIER axis with no frontend read path."
  - "P-11 decided rather than discovered: the renameFence needle preserved verbatim, the correction appended as a new paragraph."
  - "Rule 2: the start control's rejection is caught at the ChatLayout seam — the page discards the promise, so an uncaught rejection would be the only report."
  - "Wave 4's prompt-tile decision was NOT reversed: no prompt-bearing callback was declared, and `onStartChat` was not re-pointed."
metrics:
  duration: "~55m"
  tasks: 3
  completed: 2026-09-22
---

# Phase 262 Plan 05: The reachability triad, both doors, and the IA contract on the record Summary

The Expert catalog stopped being built-and-unreachable: a union member, a `ChatLayout` branch placed
last-but-one, and the **eighth** `NAV_ITEMS` entry landed in **one commit**, with wave 1's AST fence
driven RED against the real files first. A second door lives in the composer `+` menu. And the
`KnowledgeHealthPage` claim that had rotted in three registers at once was corrected beside its
original in all three — including the `App.tsx` comment that was its source.

**Commits:** `917d79a7b` · `a618b566c` · `fc0b600f7`

---

## Task 1 — the triad, in one commit

### The RED, quoted verbatim, captured on the REAL pair

`ActiveView` was given its member with the `ChatLayout` branch deliberately absent, and
`activeViewReachability.test.ts` was run against the shipped files — not a fixture:

```
 FAIL  src/lib/__tests__/activeViewReachability.test.ts > activeViewReachability · (3) the SHIPPED pair > every ActiveView member has a ChatLayout branch
AssertionError: expected [ 'experts' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "experts",
+ ]

      Tests  2 failed | 9 passed (11)
```

⭐ **Case (2) went red TOO, and that is the more interesting half.** The fence's own synthetic-13th-member
case asserts `unbranched` equals exactly `[SYNTHETIC_MEMBER]`, so it is only exact while the shipped pair
is complete. **A fence built to catch a branchless member turned out to be able to tell you that the
shipped pair itself had one.** After the branch landed: `11 passed (11)`.

⛔ **This is the wave that proves plan 01's guard was not decorative.** Before it, a branchless member
shipped **green**: `as never` is always a legal assertion so `tsc` never narrows; `ChatLayout.fallback.test.tsx`
is four source-text assertions that mount nothing; `renameFence.test.ts:142` asserts a member-count
FLOOR. Phase 257 shipped the spend cockpit with a member and a mount and **no entry action**, and
typing a URL was the only way in.

### The three legs

| Leg | Where | What landed |
|---|---|---|
| 1 · the member | `App.tsx:127` | one string literal appended to the union |
| 2 · the branch | `ChatLayout.tsx:996` | last-but-one arm; `<UnknownViewFallback` stays at `:1050` |
| 3 · the door | `nav-items.ts` | the **eighth** `NAV_ITEMS` entry, `Sparkles`, ungoverned |

```
experts branch line: 996
UnknownViewFallback line: 1050
ORDER OK — branch precedes fallback
```

`git show --stat 917d79a7b` lists `App.tsx`, `ChatLayout.tsx` and `nav-items.ts` together — **the triad
is one commit, not three.**

### The nav entry is UNGOVERNED, and that is measured rather than assumed

D-262-09 asked the right question of the wrong system. `experts` is **not** a `GovernedFeature` —
that union is closed at six members and governs the operator's per-AUDIENCE visibility map. The
catalog's real gate is `require_capability("experts")`, a **per-ORG TIER** entitlement through
`tier_capabilities` with **no frontend read path at all**. ⛔ **A `feature:` key could therefore not
have prevented the 403 it would appear to prevent.** Precedent: `connections`. And `visibleNavItems`
has been fail-OPEN since 2026-09-09 — *the API is the wall*.

⭐ **It belongs IN the array**, unlike `control-room` and `admin-spend`: those are operator surfaces
whose existence is withheld, and the array is what `ChatLayout`'s **mobile drawer** maps. An entry
rendered anywhere else would have shipped a desktop-only catalog.

### The three pitfalls, each with its outcome

| Pitfall | Outcome |
|---|---|
| **P-3** `NO TWELFTH` | **PRESERVED.** `grep -c 'NO TWELFTH' App.tsx` → **1**. A line was added BESIDE it saying why this phase's member is not what it refuses — without naming the literal. `LibraryPage.initialTab.test.tsx` is **byte-unchanged** and green |
| **P-11** the renameFence needle | **PRESERVED VERBATIM, DECIDED NOT DISCOVERED.** `"the three-homes contract holds"` is untouched; the correction is a NEW paragraph beneath it. `renameFence.test.ts` is **byte-unchanged** and green |
| **P-10** `<ChatArea` / `<WorkspacePanel` | **OBSERVED.** No new `ChatLayout` comment spells either tag; the new block names the seams in words. `ChatLayout.launch.test.tsx` **byte-unchanged** and green |

**D-262-04, measured:** `grep -cin 'experts' frontend/src/App.tsx` → **1**, and `grep -n '"experts"'`
returns only line 127, the union. **The member's literal appears in no comment in that file.**

### The stale claim, corrected in all three registers — beside its original

`App.tsx:103-105` claimed the trailing arm was `<KnowledgeHealthPage />` and that a branchless member
*"silently renders Knowledge Health"*. It has been `<UnknownViewFallback view={activeView as never} />`
since **217.1-14** — a branchless member renders *"This view has no screen: `<name>`"*.

| Register | What was done |
|---|---|
| `frontend/src/App.tsx` (**the source**) | original paragraph kept; a correction beneath it names all three false/unenforced sentences |
| `262-CONTEXT.md` | a pointer added at the original claim site to R-1 at the foot of the file |
| the IA skill's **D6** | corrected beside its original; **node N5** struck through too — `KnowledgeHealthPage` was still listed as a live surface |

⭐ **The DISCIPLINE survives untouched in all three; only the CONSEQUENCE was wrong.** That is why a
wrong consequence survives years of re-reading: everyone who reads it does the right thing anyway.

⚠ **AND THE NUMBER IS THE RIGHT ONE.** RESEARCH R-6 measured `NAV_ITEMS` at **seven** before this
phase, with the operator shield and the Spend entry rendered outside the array. So the registers say
**eighth `NAV_ITEMS` entry / tenth rail affordance** — ⛔ never *"three homes → four"*. D1 also gained
a clarification that "three homes" names the WORKFLOW concern triad (Authoring / Library+Launch /
Execution) and was never a count of nav entries.

---

## Task 2 — the second door

### The RED

```
 FAIL  src/components/chat/__tests__/ComposerExpert.test.tsx > … > reveals a catalog door inside the '+' menu, beside the shipped invite door
TestingLibraryElementError: Unable to find an element by: [data-testid="browse-experts-door"]

      Tests  2 failed | 6 passed (8)
```

After the prop chain landed: **8 passed (8)**.

⚠ **The third new case PASSED at RED, and that is recorded rather than dressed up.** *"renders NO
catalog door when the host wires no navigator"* is a negative arm, and an absent element is absent for
either reason. It earns its place as a regression fence for the guard, not as evidence the guard was
built.

### The chain, and the grep that proves each hop

`ChatLayout` → `ChatArea` → `MessageInput`, copying `onOpenConnections` line for line.

| Grep | Result |
|---|---|
| `grep -c "onBrowseExperts" ChatLayout.tsx` | **1** |
| `grep -c "onBrowseExperts" ChatArea.tsx` | **3** |
| `grep -c "onBrowseExperts" MessageInput.tsx` | **4** |
| `grep -c "onBrowseExperts?:" MessageInput.tsx` | **1** — optional at the leaf, exactly once |

⛔ **The prop is optional at every hop, for a measured reason**: four shipped suites mount these
components from their own prop objects, and a required prop would redden a typecheck baseline with
zero headroom. **And absent means the item does not render** — a control with no navigator is a dead
affordance, which is what D-262-02 refuses a whole requirement over.

⭐ **DELIBERATE REDUNDANCY, NOT THE TRIAD'S THIRD LEG.** Task 1's nav entry already discharges
D-262-03. This exists because `BUS-303` named both, and because the mid-thread moment is where a
person actually is when they want an Expert. Said in the code, so no reader has to infer which of the
two is required.

**The composer's control budget is unchanged**, and Phase 260's own UI-budget case — untouched — is
what measures it: it counts `<button>` elements in the toolbar container, and a `DropdownMenuItem`
does not register there (P-9).

---

## Task 3 — the registers, the gates, and the seeds

### The five edited G-5-firing files: disposition per file, with arithmetic

| File | triple (post-commit) | G-5 disposition |
|---|---|---|
| `App.tsx` | **34 / 25 / 410** | **honoured by construction** — ONE union member + 2 corrected comments. `useState` 4→4, navigators 4→4, branches 0 new. The named seam (`useAppNavigation()` at the fifth pair) is NOT crossed |
| `ChatLayout.tsx` | **54 / 28 / 1082** | **honoured by construction** — 3 imports + ONE last-but-one branch + ONE prop forward. `useState`/`useEffect` unchanged, no new read; `folders` is a 4th consumer of ONE call |
| `nav-items.ts` | **10 / 7 / 141** | **honoured by construction** — ONE array entry + ONE lucide import. `visibleNavItems` and `NavItem` **byte-unchanged** |
| `ChatArea.tsx` | **78 / 39 / 889** | **honoured by construction** — ONE optional prop declared, destructured, forwarded. 0 new state, 0 new effect, 0 new branch |
| `MessageInput.tsx` | **36 / 18 / 975** | **honoured by construction** — ONE optional prop + ONE guarded menu item in the EXISTING expert section. No new handler, no new import (`Sparkles` reused) |

⚠ **AND ONE OF THOSE FIGURES WAS WRONG WHEN THIS PLAN FIRST WROTE IT, WHICH IS THE FINDING.** The
triad commit published `ChatLayout.tsx` at `53 / 28 / **1095**`; `git show 917d79a7b:…ChatLayout.tsx | wc -l`
reads **1077**. The line count was **transcribed from an estimate instead of re-derived** after the
last edit of that commit. Corrected in both registers in the next commit, with the wrong figure kept
visible. ⛔ **This is this ledger's own recurring warning happening to the person writing it** — *a row
that is present and WRONG answers the auditor and stops the audit.* Re-derive; never transcribe.

### The three other firing files the PHASE touched — NOT modified by plan 05, re-derived as an observation

`git diff --stat 1623a4654 HEAD` over all three is **EMPTY**.

| File | re-derived | Both registers |
|---|---|---|
| `NavPanel.tsx` | **24 / 13 / 417** | agree (262-01 reconciled a 2-register disagreement on LINES) |
| `types/index.ts` | **90 / 70 / 1434** | agree |
| `lib/api/experts.ts` | **6 / 3 / 313** | agree |

⚠ `NavPanel.**test**.tsx` was edited; `NavPanel.tsx` was **not**.

### The seven files created at planning-time rows — all re-derived, all rows already correct

| File | re-derived | fires? |
|---|---|---|
| `lib/activeViewReachability.ts` | 1 / 1 / 159 | no |
| `components/experts/expertIcon.tsx` | 1 / 1 / 72 | no |
| `catalog/expertCatalog.ts` | 1 / 1 / 96 | no |
| `catalog/ExpertCard.tsx` | 1 / 1 / 159 | no |
| `catalog/ExpertCatalogPage.tsx` | 2 / 1 / 216 | no |
| `catalog/ExpertDetailModal.tsx` | 1 / 1 / 349 | no |
| `catalog/startScopedChat.ts` | 1 / 1 / 70 | no |

⭐ **All seven rows were already right** — waves 1-4 corrected the at-planning `0/0/0` rows in the
commits that created each file, and none has rotted since.

### Gates

| Gate | Result |
|---|---|
| `vitest-count-gate.cjs` (repo root, cap 2) | **`count gate OK` — 324/324 pinned present, no per-file decrease, 0 failing.** `total 8745 · pinned total 8004` |
| per-file arithmetic | wave 4 left `8737 / 7996`; **+8 / +8**, fully attributed: `nav-items` +3, `NavPanel` +2, `ComposerExpert` +3. **No new file adopted** (324 → 324) |
| `tsc -p tsconfig.app.json --noEmit` | **70 errors — SET DIFF against base EMPTY**, measured after task 1 AND after task 2. ⛔ bare `tsc --noEmit` checks zero files |
| `check-hot-file-ledger.cjs` | exit **0** — 328 rows, 15 watched files, all have rows |
| `check-claude-md-size.cjs` | exit **0** — **119,168** chars (plan start 118,989; net **+179**). No `[disposition-too-long]`, `[duplicate-row]` or `[malformed-row]` |
| `check-seeds-register.cjs --phase 262` | exit **0** — 310/310 parsed, 0 duplicate ids, all 5 required keys |
| backend baseline harness | **not run, and not omitted — not required.** `git diff --stat 1623a4654 HEAD -- backend/` is EMPTY |

⚠ **CLAUDE.md DID NOT CROSS THE 120,000 WARN BAND** — it sits **832 chars** below it. Planning measured
1,209 chars of headroom and this plan spent 179 of them. ⛔ **The next plan to add ledger prose here
will cross it**, and CLAUDE.md's own rule then applies: the split is SCHEDULED, not scrambled, and
never skipped by dropping the edit. Flagged for the orchestrator at phase close.

### An EIGHTH flaky suite, and the procedure that established it was inherited

⛔ **`count gate OK` is not the worst case, and this plan measured that.** On one byte-identical tree,
`GSD_VITEST_MAX_WORKERS=2`:

| invocation | result |
|---|---|
| `LibraryPage.initialTab.test.tsx` alone | **15 passed (15)** |
| the 16-file task-1 group | **167 passed (167)** |
| full `vitest-count-gate.cjs` (8745 cases) | **`count gate OK`, 0 failing** |
| the plan's own 100-file verification command, run **three times** | **RED every time, SET VARIED**: `1 failed` → `2 failed` (different names) → `1 failed` |

**Established inherited by MEASUREMENT, not by unchangedness** — the suite reads `App.tsx?raw` and
this plan edits `App.tsx`, so byte-unchangedness proves nothing here. The **eight** files this plan
changed were checked out at the phase base `1623a4654` (**explicit paths only** — no blanket reset, no
`git clean`), the same wide command re-run, and it read **`2 failed` with the same two case names**.
Restored afterwards: all eight `git hash-object` digests **identical** and `git diff --quiet -- frontend/`
clean. ⛔ **No gate was running during the swap.** Recorded in `SEED-171` as an eighth suite of a shape
its seven do not cover. ⚠ The failing cases are both `LibraryPage` MOUNT cases — never the suite's
`App.tsx?raw` source-text cases, which passed in every run.

⚠ **AND ONE PROCEDURAL SLIP, NAMED RATHER THAN HIDDEN:** the first wide run's tally (`1 failed`) was
captured without the filenames, and the names came from a **second** invocation. CLAUDE.md's rule is
to capture the failing set BEFORE re-running. The conclusion survives because the base reproduction is
the decisive measurement — but the rule was not followed on the first run.

### The eight fired seeds — routed, in their own frontmatter

| Seed | Final routing |
|---|---|
| **SEED-280** | **STAYS PLANTED — and the routing's "check, do not assume" came back NO.** Neither suite 262-01 adopted is among its named five; this plan's gate printed all five still `new` at **3 · 18 · 11 · 8 · 7**, *identical* to 2026-08-31 and to 252's 2026-09-16 re-read. 262-01 closed an **eighth case of the same class**, not one of the five |
| **SEED-185** | **LEFT PLANTED — its own TITLE is now one short.** Thirteen views, zero addressable. 262 ADDS to it: the per-Expert detail view is a modal *because* there is no router |
| **SEED-296** | **LEFT PLANTED, with the worked example appended** — what a new top-level home costs, and that its most dangerous leg is now fenced |
| **SEED-287** | **STRENGTHENED — a fourth data point**, with all seven suites named: three plans each hand-added both knobs because `src/components/experts/` has no directory entry |
| **SEED-188** | **LEFT OPEN, inventory widened** — four author-controlled columns (`when_to_use`, `example_output`, `prompt_suggestions[].prompt`, `description`) are a new member-to-member content channel. T-262-13 closes the XSS half; the injection half is untested |
| **SEED-303** | **STAYS partially-answered** — what 262 answered (the four presentation columns reach a normal user; the catalog NAMES rather than counts) and what it did not (S8 deferred, S6 untouched, S3 untouched) |
| **SEED-286** | **LEFT PLANTED**, and made sharper: a thread can now acquire a scope decision from outside the composer, which still offers no way to revise it |
| **SEED-284** | **LEFT — PATH-ONLY MATCH**, with the reason written down. It fired on `docs/HOT-FILE-LEDGER.md`, which every phase edits, so its `trigger_paths` will keep firing for no reason until narrowed |

---

## Deviations from Plan

**1. [Rule 2 — missing correctness behaviour] The start control's rejection needed a handler at the ChatLayout seam**
- **Found during:** Task 1, when `tsc` reported `Type 'Promise<Thread>' is not assignable to type 'void | Promise<void>'`
- **Issue:** the obvious fix (return the promise) does not typecheck, and the obvious second fix (`void` it) is worse: `startScopedChat` **rejects** when the PATCH is refused — by design, so a failed start never dresses itself as a scoped chat (T-262-15) — and `ExpertCatalogPage`'s handler already does `void props.onStartChat(expert)`. An uncaught rejection would surface as an unhandled rejection and nothing else.
- **Fix:** an `async` arrow with a `try/catch` that logs, mirroring the composer's own invite door one register over (`MessageInput.handleSelectExpert`). The refusal has already done its real job by then: no navigation, no selection.
- **⚠ Recorded as a GAP rather than glossed:** this app ships **no toast surface** and the catalog's props are fixed at `{ folders, onStartChat, onInspect? }`, so the console is the only honest report available at this seam. **A visible failure state needs a prop the page does not have — that is a contract change, not a line here.** Re-open trigger: the first plan that gives this surface an error-reporting seam.
- **Commit:** `917d79a7b`

**2. [Bookkeeping error, self-caught] A ledger line count was transcribed instead of re-derived**
- **Found during:** Task 3, re-deriving triples with `wc -l`
- **Issue:** the triad commit published `ChatLayout.tsx` at `1095` lines; it measured **1077**.
- **Fix:** corrected in both registers in the next commit, with the wrong figure left visible and the cause named. Refuted in one command: `git show 917d79a7b:…ChatLayout.tsx | wc -l`.
- **Commit:** `a618b566c`

**3. [Observation, not a change] The self-tripping grep did NOT fire a fourth time**
- Waves 2, 3 and 4 each recorded prose satisfying the very grep proving a token absent. This wave's equivalent traps were the new `ActiveView` literal in `App.tsx` (D-262-04), the two JSX tags in `ChatLayout` (P-10), and `onBrowseExperts?:` in `MessageInput` (which must read exactly **1**). **All three were avoided pre-emptively** by describing the prohibition in words and naming literals only here. Measured: `1`, `0`, `1`.
- ⛔ **That is discipline, not a fix.** `stripComments.testutil.ts` still only covers the `?raw` case; nothing lints a comment against an acceptance grep. The rule still lives in SUMMARY files nobody re-reads.

**4. [Observation, not a change] Wave 4's prompt-tile decision was NOT reversed**
- `onStartChat` was **not** re-pointed to a tile, and no optional prompt-bearing callback was declared anywhere. `ExpertCatalogPage`'s props are byte-unchanged at `{ folders, onStartChat, onInspect? }`. The re-open trigger recorded by wave 4 — *the first plan declaring a prompt-bearing callback* — is untouched.

No Rule 4 (architectural) decisions were needed. No authentication gates. **No packages installed** —
`lucide-react` was already a dependency (T-262-SC).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change.

- **T-262-17 accepted and recorded in code** — the nav entry is ungoverned because `experts` is a per-org TIER axis with no frontend read path; `NavItem.feature` governs a different, closed six-member union and could not prevent the 403. Pinned by a case in `nav-items.test.ts` asserting the entry carries **no** `feature` key.
- **T-262-18 mitigated by construction** — the branch passes only `folders` (the caller's own `useFolders()` result) and callbacks. No org-wide list, no admin arm, no `for_management` reaches this mount.
- **T-262-19 mitigated** — the PATCH targets a thread the caller just created via `newThread()`; the server authorises it. `startScopedChat` refuses to navigate when the patch rejects, and this plan's catch does not undo that.
- **T-262-20 mitigated and DRIVEN** — `activeViewReachability` reports `fallbackIsLast: true` on the shipped pair, and `ChatLayout.launch.test.tsx` independently asserts the positional order. Two fences, one from this phase and one inherited, both green and the inherited one byte-unchanged.
- **T-262-21 mitigated** — the IA registers were corrected in the SAME commit that made them stale, with the count measured (**eighth entry / tenth affordance**) rather than guessed.

⚠ **Re-flagged from waves 3 and 4, unchanged and now more consequential because the catalog is
reachable:** all 33 LOCAL orgs read `enterprise`, while Phase 258 measured **2 of 2 PRODUCTION orgs at
NULL tier**, on which `entitlements.py` fails CLOSED. **A locally-green rail entry predicts a wholesale
403 behind it in production** until the cloud orgs carry a tier (`BUS-283`, `262-TIER-PRECONDITION.md`).

## Known Stubs

None. `git diff 1623a4654 HEAD -- frontend/ | grep "^+"` matched **zero** `TODO`, `FIXME`,
`placeholder`, `coming soon` or `not available` occurrences. The eight raw-file hits in the five
edited sources are all **inherited** HTML `placeholder` attributes, Tailwind
`placeholder:text-muted-foreground` classes, or prose about the nav VANISH — none is in this plan's
diff. No RED plant was created in this plan, so none could be left behind.

⚠ **One intentional incompleteness, which is a recorded gap rather than a stub:** a failed
scoped-chat start is reported only to the console. See deviation 1.

## Self-Check: PASSED

```
FOUND: frontend/src/App.tsx
FOUND: frontend/src/components/layout/ChatLayout.tsx
FOUND: frontend/src/lib/nav-items.ts
FOUND: frontend/src/components/chat/ChatArea.tsx
FOUND: frontend/src/components/chat/MessageInput.tsx
FOUND: frontend/src/components/layout/__tests__/NavPanel.test.tsx
FOUND: frontend/src/lib/nav-items.test.ts
FOUND: frontend/src/components/chat/__tests__/ComposerExpert.test.tsx
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: .claude/skills/sketch-findings-agentic-rag/SKILL.md
FOUND: .claude/skills/sketch-findings-agentic-rag/references/app-information-architecture.md
FOUND: 917d79a7b  FOUND: a618b566c  FOUND: fc0b600f7
```

## TDD Gate Compliance

RED was driven per TASK against the REAL shipped files, with the failing output quoted verbatim:
task 1's `expected [ 'experts' ] to deeply equal []` (member in, branch out) and task 2's
`Unable to find an element by: [data-testid="browse-experts-door"]`.

⚠ **The commit-type sequence is recorded rather than claimed to be something it is not.** Both task
commits are `feat(...)`, because D-262-03 requires the member, the branch and the entry — and their
cases — to land as **one** commit, which makes a separate `test(...)` commit structurally impossible
for task 1. **The RED discipline was honoured at the task level and is quoted above**; a plan-level
`test(...)` → `feat(...)` ordering was not, and could not be, given the atomicity constraint.
