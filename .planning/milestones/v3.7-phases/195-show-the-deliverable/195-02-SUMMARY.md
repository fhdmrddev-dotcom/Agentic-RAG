---
phase: 195-show-the-deliverable
plan: 02
subsystem: frontend-test-fences + CI tooling
tags: [characterization, byte-identity, count-gate, plants, D-08, D-20, F5, F8, P2, P3, P9, P10]
requires:
  - "195-BASELINE.md (the pre-change floor: tsc 33, gate 3972/3898, five suite counts)"
  - "frontend/src/components/chat/OutputFileCard.tsx (byte-unchanged — the subject)"
  - "frontend/src/pages/WorkflowRunPage.tsx (byte-unchanged — the subject)"
provides:
  - "The FIRST direct coverage of OutputFileCard anywhere in the repository"
  - "`supersedes` pinned in BOTH of the component's two branches, independently"
  - "The dead-link state split into four clauses that cannot short-circuit one another"
  - "D-20's THIRD SURFACE, carried as a fixture because chat renders nothing live"
  - "The run page's silent dead row captured before plan 195-06 inverts it"
  - "Five suites adopted into the count gate, file-level, with per-suite reasoning"
affects:
  - "195-04 (converts OutputFileCard — these assertions must stay unchanged)"
  - "195-06 (inverts the run-page capture — quote in place, never delete)"
  - "195-03 (the one-icon-path decision reads the chat-row record)"
  - "every later plan (the gate now runs 4 suites it previously could not see)"
tech-stack:
  added: []
  patterns:
    - "*.baseline.test.tsx naming idiom for pre-refactor captures"
    - "one clause per it() where a prior assertion would short-circuit the next"
    - "class/token-name assertions instead of resolved rgb() for theme-conditional tokens"
    - "file-level TARGETS entries, never a bare directory"
key-files:
  created:
    - frontend/src/components/chat/__tests__/OutputFileCard.baseline.test.tsx
  modified:
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-195-02-A: the chat row ships as a FIXTURE, not a live capture — chat renders no card for a workflow deliverable by construction (D-14)"
  - "D-195-02-B: OutputFileCardProps stays UNEXPORTED — exporting it to type a fixture would itself be a public-surface change"
  - "D-195-02-C: no case for the 3 s auto-clearing download error — fake timers, and not a D-08 state"
  - "D-195-02-D: five suites adopted file-level; every declined directory carries its reason"
  - "D-195-02-E (DEVIATION): the gate's clean verdict was obtained at GSD_VITEST_MAX_WORKERS=1, re-measured because this plan grew the gated set +72 to 4044"
metrics:
  tasks: 3
  commits: 3
  plants_driven_red: 9
  suites_adopted: 5
  completed: 2026-08-17
---

# Phase 195 Plan 02: Author the Fences Before the Change — Summary

**Every byte-identity claim Phase 195 will make about `OutputFileCard` and the run page's id-less row
now has a fence that has been PROVED able to fail, authored against the UNMOVED tree — and the count
gate runs four suites it previously could not see.**

**Base asserted:** `35a16bc1ff69eac527eeb2c243cf6be126387adf`.
⚠ **The worktree forked from the WRONG base** (`fda79214`, a `master` merge commit — `merge-base`
read `3781a3fe`, not the expected SHA) and was corrected with `git reset --hard` per the dispatch's
own assertion block. **This is the 16th recorded instance** of the failure mode that hit 7/7
worktrees in Phase 194 and 8/8 in 194.1; the assertion caught it because it MEASURED the base rather
than assuming it.

---

## What was actually built

| Task | Artifact | Result |
|---|---|---|
| 1 | `frontend/src/components/chat/__tests__/OutputFileCard.baseline.test.tsx` (NEW) | **21 cases, 0 failing** |
| 2 | A pre-change capture block in `frontend/src/pages/WorkflowRunPage.test.tsx` | **102 → 105, 0 failing** |
| 3 | Five file-level `TARGETS` + `BASELINE` entries in `scripts/vitest-count-gate.cjs` | **75/75 → 80/80 pinned files, 0 failing** |

**Commits**

| # | Hash | Subject |
|---|---|---|
| 1 | `9f72041b` | `test(195-02): first direct OutputFileCard coverage — supersedes in BOTH branches` |
| 2 | `c99d9955` | `test(195-02): capture the run page's SILENT dead row before plan 06 improves it (F8)` |
| 3 | `dbc30a90` | `chore(195-02): adopt five suites into the count gate — file-level, with reasons` |

**Nine plants driven RED** against production source (seven on `OutputFileCard.tsx`, two on
`WorkflowRunPage.tsx`), every file restored **md5-identical**, and **both source files byte-unchanged**
across the whole plan (`git diff --numstat` EMPTY for each).

---

## The two states that had NO coverage anywhere in the repository

F5 said `supersedes` and `data-variant` were uncovered tree-wide, and P3(b) said why a naive fence
would not have fixed it: **the `supersedes` subline is written TWICE** — once in the live branch
(`OutputFileCard.tsx:168-172`) and once in the dead branch (`:101-105`) — and *"a fence rendering only
a url-bearing fixture structurally cannot see the dead branch."*

**Both arms are now pinned separately, and the independence is a MEASUREMENT, not a claim:**

- deleting the **live** block reds 3 cases and leaves the DEAD-branch case **green**
- deleting the **dead** block reds the DEAD-branch case **only** and leaves the live one **green**

Neither result was available before this plan, because no fixture in the tree omits `url` *and* sets
`supersedes`.

---

## The nine plants — every one observed RED against production source

⚠ **Failing case NAMES are recorded, never just counts** (194-06). ⚠ **Every file restored
md5-identical, verified with `md5sum` before and after** — not by trusting `git checkout`.

### Task 1 — `frontend/src/components/chat/OutputFileCard.tsx`

**md5 before every plant and after every restore: `4dbebcada28847b1abf1814cd3c10f1f`** (7 restores,
7 matches). Final `git diff --numstat` for this file across the whole plan: **EMPTY**.

| # | The exact edit | Failing case NAMES | RED output | ⚠ What ALSO mattered |
|---|---|---|---|---|
| **P3(a)** | deleted the live-branch `{file.supersedes && (…)}` block (`:168-172`) | *"LIVE branch: a url-bearing file with `supersedes` renders the Replaces subline"* · *"the LITERAL is `Replaces: ` — asserted exactly, so a copy change reds"* · *"a markup-shaped `supersedes` renders as LITERAL TEXT, injecting no element"* | `3 failed \| 18 passed (21)` | **the DEAD-branch case stayed GREEN** — the two arms are independent |
| **P3(b)** | deleted the dead-branch block (`:101-105`) | *"DEAD branch: a file with NO url and `supersedes` renders the SAME subline"* — **and nothing else** | `1 failed \| 20 passed (21)` | **the LIVE case stayed GREEN** — the converse of P3(a), which is what makes the pair proof |
| **P3(c)** | `Replaces: {file.supersedes}` → `Replaces:{file.supersedes}` — **ONE character** | the same 3 as P3(a) | `3 failed \| 18 passed`; `expected 'Replaces:draft-v1.docx' to be 'Replaces: draft-v1.docx'` | a **single space** reds it. The copy is pinned byte-exactly, not by `/replaces/i` |
| **P2(a)** | removed `data-dead="true"` (`:96`) | *"(a) the ATTRIBUTE clause: the row carries data-dead=\"true\""* · *"DEAD branch: …"* | `2 failed \| 19 passed` | **the COPY case (b) stayed GREEN** |
| **P2(b)** | `Download unavailable` → `No link` (`:116`) | *"(b) the COPY clause: the row says `Download unavailable`"* — **and nothing else** | `1 failed \| 20 passed` | **the ATTRIBUTE case (a) stayed GREEN** |
| **variant** | added `variant === "hero" ? "shadow-lg" : ""` to the class merge | *"hero and working render the SAME tag, the SAME class list and the SAME children"* — only | `1 failed \| 20 passed` | the inert flag cannot silently become behaviour again |
| **+1 (extra)** | `fileIcon(file.filename, 30)` → `fileIcon(file.filename, 16)` | *"the icon is fileIcon() — a 30 px glyph WITH a mono `.EXT` ribbon"* — only | `1 failed \| 20 passed` | proves **D-20's third-surface record can fire**, not just the D-08 fences |

### ⚠ P2(a) + P2(b) together are the whole point of P2, and they measured it

The shipped coverage at `MessageItem.finalOutputs.test.tsx:111-125` asserts the attribute and the
copy with **two `expect`s in one case**, and the first short-circuits the second — so a copy-only
regression reds a case that was *already* red for the attribute, and the copy clause never actually
runs. Split into four independent cases here, **P2(a) reds the attribute clause alone and P2(b) reds
the copy clause alone.** That is the short-circuit defeated, demonstrated rather than asserted.

### Task 2 — `frontend/src/pages/WorkflowRunPage.tsx`

**md5 before and after both plants: `6be2054aa15fcc3ea4eab4ccf1942712`.**
`git diff --numstat -- frontend/src/pages/WorkflowRunPage.tsx` across this plan's commits: **EMPTY** —
the page source is byte-unchanged; only its *test* file was edited.

| # | The exact edit | Failing case NAMES | RED output |
|---|---|---|---|
| **A** | inserted `<button type="button">planted</button>` into the id-less branch | *"a row the listing gave with no id is shown as a fact, never as a dead control"* (the shipped `:984` case) · *"shows the name, the size and the full path in `title` — and the region holds ZERO buttons"* (this plan's) | `2 failed \| 103 passed (105)`; `expected <button type="button"></button> to have a length of +0 but got 1` |
| **B** | inserted `<span aria-disabled="true" title="Download unavailable — this file has no link">Download unavailable</span>` | *"the ROW carries no \"Download unavailable\" — the absence plan 195-06 inverts"* — **and nothing else** | `1 failed \| 104 passed (105)`; `expected 'orphan-deliverable.docx2.0 KBDownload…' not to contain 'Download unavailable'` |

### ⚠ PLANT B MEASURED SOMETHING THE PLAN ONLY PREDICTED, AND IT IS GOOD NEWS FOR PLAN 06

Plant B is the **preview of plan 195-06's real change** — the id-less arm gaining the shared D-08
affordance. It reds **case 2 only** and leaves **case 1 GREEN**.

That is empirical confirmation of the property F8 hangs on: **a `<span aria-disabled>` affordance does
NOT break the zero-`<button>` contract** at `WorkflowRunPage.test.tsx:991`. The plan reasoned this
would hold from reading the element type; the plant *observed* it. Plan 06 should expect exactly this
output — case 2 red, case 1 green — and anything else means the unification used the wrong element.

The same property is now pinned **at its source too**, in
`OutputFileCard.baseline.test.tsx` (*"(d) the dead row contains ZERO `<button>` elements"*), so the
contract is held on **both** sides of the seam rather than by luck on one.

---

## D-20's third surface, and the theme trap it had to avoid

`195-BASELINE.md` arm 3 measured **live** that
`document.querySelector('[data-testid="output-file-card"]')` returns **`null`** on the very thread
that owns the deliverable — chat renders **no file card at all** for a workflow emit, by construction
(D-14). So D-20's three-surface side-by-side is discharged as **two live surfaces + one fixture**, and
`OutputFileCard.baseline.test.tsx` **is** that fixture.

The `§ "the chat row as it ships TODAY"` block pins the same properties the other two surfaces were
measured on, so the comparison has three rows:

| | Run page (LIVE) | Panel (LIVE) | **Chat (THIS FIXTURE)** |
|---|---|---|---|
| Element | `BUTTON` | `DIV[role=option]` `tabindex=0` | **`A[href][download][target]`, no `role`** |
| Text | basename | full path | **`filename` VERBATIM — no basename derived** |
| Padding | `px-2 py-2` (33 px) | `px-2.5 py-2` (38 px) | **`px-3 py-2`** |
| Icon | `lucide-file-text` 16 px, **no ribbon** | same, 16 px, **no ribbon** | **`fileIcon()` 30 px + mono `.DOCX` ribbon** |
| Icon colour | theme token `text-muted-foreground` | theme token `text-panel-muted-foreground` | **inline category hex — NEITHER token class** |

⚠ **"One icon path" is therefore a VISIBLE change, not a no-op**, and this file is what makes that
provable later. The 7th plant proves the record can fire.

### The theme-conditional trap, honoured

`195-BASELINE.md` § *"REFINED 2026-08-17"* measured `--muted-foreground` and
`--panel-muted-foreground` as **IDENTICAL in the shipped dark theme** (`220 16% 65%`) and **DIFFERENT
in light** (`220 9% 46%` vs `220 12% 40%`), the panel token existing because light
`--muted-foreground` measured **4.01:1 — below the AA floor** (`PanelSection.tsx:85`).

**Consequence honoured here: every colour-adjacent assertion is on a CLASS / TOKEN NAME or on the
PRESENCE of an inline style — never on a resolved `rgb()`.** A resolved-colour assertion cannot tell
those two tokens apart in the theme jsdom renders, so it would pass green while a light-theme contrast
regression shipped. The case states this reasoning inline, and carries a positive control proving the
two `not.toContain` clauses are not vacuous.

---

## The count gate: from 1 of 5 suites to 5 of 5

`195-BASELINE.md` measured that **the gate covered ONE of this phase's five suites** — `TARGETS` had
no entry for `src/components/chat`, `src/lib` or `src/components/panel`. A green gate said nothing
about four fifths of Phase 195. **Phase 195 IS the "later phase" the script's own comment at
`:2168-2175` reserved by name for `FilesSection`.**

Adopted **file-level**, in the same commit as the pins, all five paths `ls`-confirmed first:

| Suite | Pin | Read from |
|---|---|---|
| `OutputFileCard.baseline.test.tsx` | **21** | the gate's own `actual` column |
| `StopControl.baseline.test.tsx` | **15** | ″ |
| `FilesSection.test.tsx` | **11** | ″ |
| `fileIcon.test.tsx` | **11** | ″ |
| `MessageItem.finalOutputs.test.tsx` | **11** | ″ |
| `WorkflowRunPage.test.tsx` | **102 → 105** | ″ (both values recorded, old beside new) |

⚠ **Never hand-counted from `it(` literals** — the rule the script states about itself. Both
pre-pin reads came from **two agreeing runs that both printed `count gate OK` with `failed 0`**.

⚠ **Global key space checked**: all five bare filenames confirmed unique tree-wide with `git ls-files`
before the pins were written, so no two suites can collide silently on one number.

⚠ **Timing discharged, not trusted**: a `TARGETS` path that does not exist makes the gate **ERROR
(exit 2), not fail** — which would break every subsequent plan in this phase. All five were
`ls`-confirmed from `frontend/` first.

**Declines recorded with reasons** (a decline with no recorded reason is indistinguishable from an
oversight): the rest of `src/components/panel/__tests__`, the rest of `src/components/chat/__tests__`
and `src/__tests__/components/`, and `src/lib/__tests__`'s other suites — Phase 195 reads none of
them, and adopting them would make this phase the owner of their future rot in a gate whose contract
is 0 failing forever. **No bare-directory entry was added** (`grep '"src/components/chat"'` → nothing).

---

## ⚠ DEVIATION D-195-02-E — the clean verdict needed `GSD_VITEST_MAX_WORKERS=1`, and that is a
## RE-MEASUREMENT the project's own rule asks for, not a workaround

**What happened, measured rather than characterised.** **EIGHT** gate runs on this identical tree —
including the three red ones and the one I confounded myself, because a table listing only the clean
runs is not a measurement:

| Run | Cap | pinned total | **grand total** | failed | Failing files (captured BEFORE any re-run) |
|---|---|---|---|---|---|
| 1 (pre-pin) | 2 | 3898 | **4044** | **0** | — → `count gate OK — 75/75 …` |
| 2 (pre-pin) | 2 | 3898 | **4044** | **0** | — → `count gate OK — 75/75 …` |
| 3 (pinned) | 2 | 3970 | **4044** | 3 | `WorkflowsPage` ×3, all `STACK_TRACE_ERROR` |
| 4 (pinned) | 2 | 3970 | **4044** | 2 | `WorkflowBuilderPage.canvas`, `WorkflowBuilderPage.session` (*"pane click"*) |
| 5 (pinned) | 2 | 3970 | **4044** | 8 | `…canvas`, `WorkflowsPage`, `WorkflowCanvas` ×2, `WorkflowCard` ×4 |
| **6 (pinned)** | **1** | **3970** | **4044** | **0** | — → **`count gate OK — 80/80 …`, exit 0** |
| 7 (pinned) | 1 | 3970 | **4044** | 2 | `WorkflowCanvas` axe a11y ×2 — ⚠ **CONFOUNDED BY ME**, see below |
| **8 (pinned)** | **1** | **3970** | **4044** | **0** | — → **`count gate OK — 80/80 …`, exit 0** |

⚠ **RUN 7 IS RECORDED AS A SELF-INFLICTED CONFOUND, NOT AS EVIDENCE ABOUT THE CAP.** I launched the
explicit six-suite ungated command *while run 7 was still in flight*, so a run whose whole purpose was
to measure a quiet cap-1 tree was measured against a tree I was loading. Run 8 repeated it with
**nothing else in flight** and came back clean. The mistake is published rather than deleted, because
the alternative — quietly dropping the run that disagreed — is exactly how a "two agreeing runs" claim
becomes worthless.

**The two agreeing clean verdicts are runs 6 and 8**, both at cap 1, verbatim:

```
count gate OK — 80/80 pinned files present, no per-file decrease, 0 failing.
```

**Why this is flake and not a defect, on evidence and not on hope:**

1. **The failing set is DIFFERENT in every red run and never repeats.** Four red runs produced four
   disjoint-ish sets — `WorkflowsPage`×3, then two Builder suites, then eight across four files, then
   two axe cases. A real regression is deterministic; this is not.
2. **Not one failing file is a file this plan touched.** Zero overlap with `OutputFileCard.tsx`,
   `WorkflowRunPage.tsx`, or either test file.
3. **The grand total is INVARIANT at 4044 across all EIGHT runs**, and **every per-file delta is 0**.
   The gate's actual contract — *no per-file decrease, zero failing* — has its first clause satisfied
   in every single run.
4. **Most were `STACK_TRACE_ERROR` timeouts** — the signature CLAUDE.md names for oversubscription,
   never for a real defect.
5. **`ps -W | grep -c node` read 28** at the time: sibling worktree agents in this wave were running
   tests concurrently. CLAUDE.md: *"at THREE concurrent test-running agents the gate goes
   non-deterministic regardless of cap."*
6. ⚠ **One of the failures is a flake this very script already documents.**
   `vitest-count-gate.cjs:2401-2411` records `WorkflowBuilderPage.session.test.tsx`'s *"pane click"*
   case as a measured parallel-load flake and states: *"THE STANDING INSTRUCTION … if 'pane click'
   reds, RE-RUN before declaring red."* Run 4's failure **is that exact case**.

**⚠ THE FAILING FILENAMES WERE CAPTURED BEFORE ANY RE-RUN, from each failing run's OWN JSON report** —
never by re-running and hoping. `193.2-02` recorded itself breaking that rule and could not afterwards
prove its cases were innocent; this plan can, and the per-run breakdown above is that proof.

**The second knob was run separately and independently confirms every pin.** The explicit ungated
command over all six in-scope suites:

```
GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 \
  src/pages/WorkflowRunPage.test.tsx \
  src/components/panel/__tests__/FilesSection.test.tsx \
  src/__tests__/components/MessageItem.finalOutputs.test.tsx \
  src/lib/__tests__/fileIcon.test.tsx \
  src/components/chat/__tests__/StopControl.baseline.test.tsx \
  src/components/chat/__tests__/OutputFileCard.baseline.test.tsx
⇒ Test Files 6 passed (6) · Tests 174 passed (174)
```

**174 = 105 + 11 + 11 + 11 + 15 + 21 — exactly the six pins, summed.** So the pinned numbers are
corroborated by a run that shares none of the gate's own machinery, and the six suites this phase
actually reads are green even in the runs where the wider gate was noisy.

**Why cap 1 rather than "run it again until it is green":** CLAUDE.md's rule is explicit that the cap
*"is a function of how many test cases the gate executes, not a constant"*, that it has **already
rotted twice** (4 → 2), and — verbatim — *"use 2, and **RE-MEASURE when the gated total grows again**
rather than trusting this number."* **This plan grew the gated set by +72, from 3972 to 4044**, which
is precisely the trigger that rule names. Cap 1 was measured, twice, and is clean.

**What is owed to later plans, stated rather than implied:** the `GSD_VITEST_MAX_WORKERS=2` figure in
CLAUDE.md is **not corrected here** — plan 195-08 owns the CLAUDE.md numbers, and this record is the
input for that edit. Later plans in this phase should expect cap 2 to be non-deterministic at 4044
while sibling agents run, and should reach for **cap 1** before concluding a red is theirs.

---

## Verification

| Check | Result |
|---|---|
| Base SHA asserted == `35a16bc1…` | ✅ (after correcting a wrong-base fork) |
| `OutputFileCard.baseline.test.tsx` exists, green, covers `supersedes` in BOTH branches | ✅ 21 / 0 |
| `grep -c "Replaces:"` in the new suite | **4** (≥ 3 required) |
| A case rendered from a fixture with NO `url` AND a `supersedes` key | ✅ |
| The dead case asserts `querySelectorAll("button")` length 0 | ✅ (+ a positive control) |
| `OutputFileCardProps` stayed UNEXPORTED | ✅ `grep -c "export interface OutputFileCardProps\|export type …"` → **0** |
| `WorkflowRunPage.test.tsx` green, count **> 102** | ✅ **105** / 0 |
| New describe title contains `195-02` and `pre-change` | ✅ |
| The block names plan `195-06` as the inversion point | ✅ |
| `StopControl.baseline.test.tsx` green at **15** (P9) | ✅ asserted after every run-page edit |
| Both source files byte-unchanged (`git diff --numstat`) | ✅ **EMPTY** for both |
| `tsc --noEmit -p tsconfig.app.json` | ✅ **33** — the `195-BASELINE.md` floor, unmoved |
| Count gate verdict `OK`, `failed 0`, two agreeing runs | ✅ runs **6 and 8** at cap 1 — `count gate OK — 80/80 pinned files present, no per-file decrease, 0 failing.` (see deviation; all 8 runs published) |
| The explicit UNGATED command also green (the two knobs are separate) | ✅ **6 files / 174 passed / 0 failed** = 105+11+11+11+15+21, the six pins summed |
| `pinned total` and grand `total` both increased vs `195-BASELINE.md` | ✅ pinned **3898 → 3970**, total **3972 → 4044**, pinned files **75/75 → 80/80** |
| `grep -c` ≥ 2 for each of the five adopted suites | ✅ (one `TARGETS`, one `BASELINE`, plus reasoning) |
| `grep -n '"src/components/chat"'` returns nothing | ✅ no bare-directory entry |
| Both **102** and **105** appear in the pin's comment | ✅ old recorded beside new |
| `package.json` / `package-lock.json` untouched | ✅ **no package installed** — T-195-02-SC needs no `slopcheck` |
| `.planning/STATE.md` / `ROADMAP.md` untouched | ✅ |
| `git diff --diff-filter=D` on this plan | ✅ **EMPTY** — nothing deleted |

---

## Threat model — dispositions discharged

| Threat ID | Disposition | How |
|---|---|---|
| **T-195-02-01** Tampering (XSS) on `filename` / `supersedes` | **mitigated + PINNED** | Two cases render a `<img src=x onerror="alert(1)">` payload through both fields **in both branches** and assert `container.querySelector("img")` is `null` while the string appears as literal text — satisfiable only if React escapes it. No `dangerouslySetInnerHTML` introduced. **Honest scale: this was true before and is now pinned.** |
| **T-195-02-02** Repudiation of the gate's numbers | **mitigated** | Every pin read from the gate's printed `actual` column across two agreeing `count gate OK / failed 0` runs; all seven runs tabulated above, including the failures |
| **T-195-02-03** DoS on CI via a nonexistent `TARGETS` path | **mitigated** | All five paths `ls`-confirmed before the entries were written; the gate run is this task's verify |
| **T-195-02-SC** package installs | **n/a** | No package installed; `package.json` / `package-lock.json` untouched |

---

## Known Stubs

**None.** This plan ships no UI, no data path and no placeholder — three test/CI artifacts, all wired
and all executing.

## Threat Flags

**None.** No new endpoint, fetch, persistence, auth path or dependency. The one security-relevant
surface touched (a model-derived string reaching JSX) was pre-existing and is now fenced.

---

## Deviations from Plan

### 1. [Rule 3 — blocking] The worktree forked from the WRONG base

- **Found during:** the pre-flight assertion, before any task
- **Issue:** `HEAD` was `fda79214` (a `master` merge commit); `git merge-base HEAD 35a16bc1…` read
  `3781a3fe`, not the expected SHA
- **Fix:** `git reset --hard 35a16bc1ff69eac527eeb2c243cf6be126387adf`, per the dispatch's own
  assertion block; the corrected HEAD was re-verified before task 1
- **Why it matters:** every byte-identity and `numstat` claim in this phase is measured against a
  base, and *"a `numstat`-empty check passes trivially when the base SHA is wrong"*

### 2. [D-195-02-E] The clean gate verdict required `GSD_VITEST_MAX_WORKERS=1`

Fully documented in its own section above, with **all eight runs**, the captured failing case names
per red run, and the CLAUDE.md rule that makes a re-measurement the correct response to a grown gated
set rather than a workaround. **Not smoothed over: the four red runs are published with their
contents — including run 7, which I confounded myself by starting the ungated command while it was
still in flight.**

### 3. [Scope +1] A seventh plant, beyond the six the plan required

The plan named six. A seventh (`fileIcon(…, 30)` → `16`) was driven to prove that **D-20's
third-surface record can fire** — the block the live baseline promoted from a nice-to-have to *the
phase's only record of the chat row*. Six plants would have proved the D-08 fences and left the D-20
fixture unproven.

### 4. [Scope, within the plan's own bounds] Four dead-link cases, not two

The plan said *"one case asserting `[data-dead]`, one asserting the text … Also assert the affordance
is a `<span>` … and zero `<button>`"*. Those last two were given **their own cases** rather than being
appended as extra `expect`s — because appending them would have re-created exactly the short-circuit
P2 exists to defeat, one level down. P2(a)/P2(b) then measured the split working.

---

## What this plan does NOT claim

1. **The chat row was NOT captured live.** It cannot be: chat renders no card for a workflow
   deliverable, by construction (D-14, measured in `195-BASELINE.md` arm 3). The fixture is a
   recorded DECISION with its reason, not a substitute nobody noticed making.
2. **`variant`'s inertness is pinned on the RENDERED shape, not on the source.** A conversion that
   reintroduced a hero/working difference through a mechanism these assertions do not read (e.g. a
   wrapper the caller supplies) would not red here. What is pinned is: same tag, same class list,
   same children, same text — which is what D-095.1-06 actually promises.
3. **The 3 s download-error auto-clear is UNCOVERED, on purpose** (D-195-02-C).
4. **`FilesSection`'s MIME-vs-extension icon delta is NOT closed by adopting its suite.** Those 11
   cases test `docx`/`pptx`/`xlsx` only; `195-PATTERNS.md` § 5 measured that `sh` `bash` `sql` `yml`
   `yaml` `css` `jsx` `mjs` resolve to `FileCode` in the panel today and would fall to `FileText`
   under `fileIcon`. **Adopting the suite guards the gate, not that delta.** Plan 195-03/05 still owes
   either an `EXT_MAP` extension or a knowingly-recorded regression.
5. **Cap 2's non-determinism is a MEASUREMENT of this box under this wave's load, not a verdict on
   the cap in general.** Two cap-2 runs on this same tree were clean.

---

## Self-Check: PASSED

- `frontend/src/components/chat/__tests__/OutputFileCard.baseline.test.tsx` — **FOUND**
- `frontend/src/pages/WorkflowRunPage.test.tsx` (modified) — **FOUND**
- `scripts/vitest-count-gate.cjs` (modified) — **FOUND**
- commit `9f72041b` — **FOUND**
- commit `c99d9955` — **FOUND**
- `.planning/STATE.md`, `.planning/ROADMAP.md` — **UNTOUCHED**, as required of a parallel executor

---

*Phase 195 Plan 02 — the fences, authored against the unmoved tree, every one proved able to fail.*
