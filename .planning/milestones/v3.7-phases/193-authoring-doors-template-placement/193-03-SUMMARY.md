---
phase: 193-authoring-doors-template-placement
plan: 03
wave: 2
subsystem: frontend-workflows-authoring
tags: [refactor, extraction, g-5, esm-cycle-fence, verbatim-move, characterization]
requires:
  - "193-01 (the six whole-innerHTML characterization captures on the UNMOVED tree)"
provides:
  - "frontend/src/components/workflows/DoorHeaderStrip.tsx — the govern door's header strip, serving BOTH header variants"
  - "the D-24(b) ESM-cycle fence, driven RED twice against real plants"
affects:
  - "frontend/src/components/workflows/WorkflowDoorSwitch.tsx (G-5 honoured by construction)"
tech-stack:
  added: []
  patterns:
    - "verbatim move proved by sed+diff against the phase-base BLOB (188.1/192 shape)"
    - "?raw source fence with positive controls per import form x per spelling"
    - "a class string READ OUT OF another suite's committed literal rather than re-typed"
key-files:
  created:
    - frontend/src/components/workflows/DoorHeaderStrip.tsx
    - frontend/src/components/workflows/DoorHeaderStrip.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "The moved span keeps its ORIGINAL INDENTATION (4 spaces, as it sat inside `if (door === \"govern\")`). Re-indenting is the one tidy that would have made the byte-diff non-empty; the docblock says so, so it is not copied as a style."
  - "Tasks 2 and 3 landed in ONE commit, because the plan requires the pin to ship in the same commit as the suite."
metrics:
  base_sha: 4ae3194af3daf7158da601079dcdd0c085ac8695
  commits: 2
  tasks: 3
  files_touched: 4
  duration_minutes: 24
  completed: 2026-08-13
---

# Phase 193 Plan 03: Cut the govern door's header strip into its own module — Summary

The `doorGroup` docblock + fragment moved out of `WorkflowDoorSwitch.tsx` into
`DoorHeaderStrip.tsx` **byte-for-byte** (md5 `8fb9a731` on both sides of the `diff`), one
component now serves both header variants, and the nine-phase-old byte-exact band literal in
`WorkflowBuilderPage.header.test.tsx` passed with **zero edits** — which is the whole point.

**Base SHA: `4ae3194af3daf7158da601079dcdd0c085ac8695`.**
⚠ **The worktree spawned on the WRONG base and the assertion caught it** — HEAD was `fda79214`
with merge-base `3781a3fe`, exactly the drift the dispatch warned about (now 3 of 3 agents this
phase). `git reset --hard 4ae3194a` corrected it and the worktree was re-bootstrapped. Wave 1's
`WorkflowDoorSwitch.baseline.test.tsx` was then confirmed present on disk before anything was
read — on the wrong base this plan's entire proof would have been a fiction with every gate green.

---

## Commits

| Commit | Task | What |
|---|---|---|
| `34279f98` | 1 | `refactor(193-03)`: the cut — `DoorHeaderStrip.tsx` + the rewired shell |
| `2dbcd9f8` | 2+3 | `test(193-03)`: the suite and its count-gate pin, in one commit |

**Why 2+3 are one commit, stated rather than buried:** Task 3's action says the pin lands *"in
THIS SAME commit as the suite"* — a `BASELINE` key naming a path that does not yet exist makes
the gate ERROR (exit 2), and an unpinned covering suite is an unguarded one. The two instructions
(one commit per task; the pin rides with the suite) cannot both hold, and the plan's explicit
wording wins.

---

## Task 1 — the move, proved rather than asserted

### The `sed` + `diff` proof, with its exact commands and its empty output

Span bounds re-derived BY CONTENT at execution HEAD (never copied from a document):

```bash
$ git rev-parse HEAD
4ae3194af3daf7158da601079dcdd0c085ac8695
$ git show HEAD:frontend/src/components/workflows/WorkflowDoorSwitch.tsx > /tmp/base_blob.tsx
$ grep -n "Phase 184.1-01 — the door group\|const doorGroup = (\|^    )$" /tmp/base_blob.tsx
146:     * Phase 184.1-01 — the door group, declared ONCE and drawn either in this shell's own
156:    const doorGroup = (
175:    )
$ sed -n '145,175p' /tmp/base_blob.tsx > /tmp/before.txt        # 31 lines, docblock through `)`

$ grep -n "^    /\*\*$\|const doorGroup = (\|^    )$" frontend/src/components/workflows/DoorHeaderStrip.tsx
67:    /**
78:    const doorGroup = (
97:    )
$ sed -n '67,97p' frontend/src/components/workflows/DoorHeaderStrip.tsx | sed 's/^export //' > /tmp/after.txt

$ diff /tmp/before.txt /tmp/after.txt
$ echo "DIFF_EXIT=$?"
DIFF_EXIT=0
```

**The output is empty. Both files md5 `8fb9a73110a5dfd06e6cab350046e91c`.**

Re-run **blob to blob** after the commit, which is the stronger form (it removes the working
copy's CRLF from the question entirely — `core.autocrlf=true` here):

```bash
$ git show HEAD:frontend/src/components/workflows/DoorHeaderStrip.tsx | sed -n '67,97p' | sed 's/^export //' > /tmp/after_blob.txt
$ diff /tmp/before.txt /tmp/after_blob.txt
$ echo "BLOB_DIFF_EXIT=$?"
BLOB_DIFF_EXIT=0
$ md5sum /tmp/after_blob.txt
8fb9a73110a5dfd06e6cab350046e91c
```

⚠ **One honest note about the `sed 's/^export //'` pipe: it matched NOTHING.** The chosen
boundary puts `export function DoorHeaderStrip(` *outside* the moved span, so the moved 31 lines
are identical with no allowance made at all — strictly stronger than the acceptance criterion's
"with the one `export ` stripped", and the pipe was retained exactly as the plan specifies so the
command is the one the plan named.

**How byte-identity was achieved, and its one cost:** the moved body keeps the 4-space
indentation it carried inside `if (door === "govern") { … }` rather than being re-indented to a
fresh file's 2. Re-indenting is the single tidy that would have made the diff non-empty.
`DoorHeaderStrip.tsx`'s docblock says this in ⚠ form so the next author reads it as a move
artifact, not as a style to copy.

### The acceptance greps

| Check | Required | Measured |
|---|---|---|
| `grep -c "const doorGroup = (" WorkflowDoorSwitch.tsx` | 0 | **0** |
| `grep -c "DoorHeaderStrip" WorkflowDoorSwitch.tsx` | ≥ 3 | **5** |
| `grep -cE "export \{[^}]*DoorHeaderStrip[^}]*\} from" WorkflowDoorSwitch.tsx` | 0 | **0** (no shim) |
| `grep -c "ml-auto" DoorHeaderStrip.tsx` | ≥ 1 | **5** (1 class + 4 docblock) |
| `grep -c "^export const\|^export let\|^export var" DoorHeaderStrip.tsx` | 0 | **0** |

The `ml-auto` conditional is still a **concatenation** onto the class string
(`` `${inline ? "" : "ml-auto "}inline-flex …` ``) — never two `className` branches — so the
non-inline result stays character-for-character what shipped.

### The two independent baselines, with zero edits

```bash
$ git diff --numstat 4ae3194a HEAD -- frontend/src/pages/WorkflowBuilderPage.header.test.tsx \
    frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
                                    # ← EMPTY. Zero insertions, zero deletions, across the whole plan.
```

`WorkflowBuilderPage.header.test.tsx` (72 cases with the two siblings) and
`WorkflowDoorSwitch.baseline.test.tsx` (Wave 1's six whole-`innerHTML` captures, including its own
D-05 `ml-auto` pair) both pass **unmodified**. **Zero re-capture.**

---

## ⚠ A landmine the plan did not name, found by running: the spread-conditional is grepped

The first shape of the rewire wrapped the spread-conditional across three lines for readability.
The DOM was byte-identical and the band literal still passed — but **`WorkflowBuilderPage.header.test.tsx:475` reddened**:

```
AssertionError: expected '…' to match /inline \? \{ headerLead, headerTrail/
❯ src/pages/WorkflowBuilderPage.header.test.tsx:475:30
```

That suite greps `WorkflowDoorSwitch`'s SOURCE for `inline ? { headerLead, headerTrail`
**contiguously**, as its proof that the flag-off props stay genuinely ABSENT rather than
present-and-undefined (the D-14 idiom). Reformatting is invisible to every DOM baseline and fatal
to that fence.

**Fixed under Rule 3 by restoring one line — the test file was NOT edited** (that would have been
the wrong repair, and the plan forbids it). The constraint is now recorded *in the source it
binds*, three lines above it, so the next formatter sees it before the CI does:

```tsx
// ⚠ ONE LINE, and mechanically so: `WorkflowBuilderPage.header.test.tsx:475` greps
// this source for `inline ? { headerLead, headerTrail` contiguously. Wrapping it
// across lines during the 193-03 move reddened that fence with the DOM unchanged.
{...(inline ? { headerLead, headerTrail: <DoorHeaderStrip onBack={goBoth} inline={inline} /> } : {})}
```

This is the plan's *"keep the spread-conditional idiom exactly as shipped"* being a **mechanical
requirement rather than a stylistic one** — worth carrying into Waves 4 and 5, which touch the
same element.

---

## Task 2 — the suite, and the fence driven RED twice

**12 cases from 7 `it()`s** (two are `it.each` over both `inline` values — which is precisely why
the count-gate number is read, never hand-counted).

### D-05 — one component, both variants

- The judge badge's **full class string standalone** is asserted against the substring **read out
  of `WorkflowBuilderPage.header.test.tsx`'s band literal** through `?raw`
  (`/data-testid="judge-locked"[^>]*?\sclass="([^"]+)"/`), never re-typed — two literals drift, one
  literal read twice cannot.
- The `ml-auto` **pair**: present as a class TOKEN standalone, absent inline, from the rendered
  node; plus the *rest* of the class list asserted equal across the pair, so the branch is proved
  to change exactly one token rather than to rewrite the badge.
- **Child order, never class name** (the 192.1 rule): length checked FIRST (3), then
  `both-doors` → unlabelled `SPAN` → `judge-locked`, with the badge LAST in both variants. The 3
  is today's shape and will legitimately change in the D-04 restack wave — pinned now so that wave
  has to state its change instead of absorbing it.
- A POSITIVE CONTROL that the class-token lookup really reads the named node (without it,
  `"".split(" ")` makes a failed lookup read as a passing absence).
- `onBack` fires exactly once per click, in both variants.

### D-24(b) — the ESM-cycle fence

All four `it()`s ported from `WorkflowCanvas.test.tsx` with the **load-bearing `(\.[jt]sx?)?`
group**: 4 import forms (static / `import type` / re-export / dynamic) × 2 spellings (bare and
`.tsx`-suffixed, legal under `allowImportingTsExtensions: true`) as positive controls; the two
`?raw` spellings as negative controls; non-vacuity; the leaf claim; the one-direction claim.

**RED-first proof — run, not claimed.** Both plants were real `import type … from` lines in the
real production file:

| # | Plant in `DoorHeaderStrip.tsx` | Observed | md5 before → after restore |
|---|---|---|---|
| 1 | `import type { WorkflowDoorSwitchProps } from "./WorkflowDoorSwitch.tsx"` | `AssertionError: expected '/**\n * Phase 193-03 Task 1 (D-05 / D…' not to match /from\s+["'][^"']*WorkflowDoorSwitch(\…/` — **2 failed / 10 passed** | `b6ba7cc29eda5f55a27b3230fe7c59ef` → `b6ba7cc29eda5f55a27b3230fe7c59ef` |
| 2 | `import type { WorkflowDoorSwitchProps } from "./WorkflowDoorSwitch"` (bare) | same `AssertionError`, same two cases — **2 failed / 10 passed** | `b6ba7cc29eda5f55a27b3230fe7c59ef` → `b6ba7cc29eda5f55a27b3230fe7c59ef` |

Both restores additionally confirmed by `git diff --numstat` on the file printing **empty**. Green
again at 12/12 after each.

### SCOPE proof — *could it fire?* (the 192.1 E-2 lesson)

The 192.1 security finding was a fence swept against the **empty string** that passed green while
defending nothing. Two independent checks here:

1. **The subjects resolve non-empty** — `wc -c`: `DoorHeaderStrip.tsx` **6218**,
   `WorkflowDoorSwitch.tsx` **20750**, `WorkflowBuilderPage.header.test.tsx` **47379**. The suite
   asserts this itself (`> 500` and `> 1000`) *before* every negative assertion, so a later rename
   that silently emptied a `?raw` import reds rather than passes.
2. **It actually fired**, twice, against real plants — which is the only proof that beats a length
   check.

⚠ **No `doorVocabulary` leg is swept, deliberately.** That module does not exist until `193-05`;
`import.meta.glob` contributes the empty string for an absent path and never throws. The reason is
written into the suite's header so `193-05` adds the leg *with* its own non-vacuity guard rather
than inheriting a vacuous one.

---

## Task 3 — the pin, read off the gate's own column

```
  DoorHeaderStrip.test.tsx                      —      12     new
  -------------------------------------------------------------
  total                                      3442    3483     +41
  total 3483  ·  failed 0  ·  pinned total 3442
--------------------------------------------------------------
count gate OK — 66/66 pinned files present, no per-file decrease, 0 failing.     [exit 0]
```

`"DoorHeaderStrip.test.tsx": 12` — **12 read off the `actual` column** on the run before the line
was written, never hand-counted. `git diff --stat` on the gate: **22 insertions, 0 deletions** — no
other `BASELINE` value moved. No `TARGETS` edit, and that is measured rather than assumed: the file
sits in `src/components/workflows`, already a TARGETS *directory* entry, so it RAN the moment it
existed (which is how the 12 was printed at all).

### ⚠ Correction on measurement #1 — the pin grep returns 2, and the shipped precedent returns 3

The acceptance criterion says `grep -c "DoorHeaderStrip.test.tsx" scripts/vitest-count-gate.cjs`
→ **1**. Measured, it is **2**: the pin line, plus one prose line quoting the gate's own
`— 12 new` output, which is the evidence the house rule requires. The criterion as literally
worded does not describe the shipped shape either — the entry directly above,
`WorkflowDoorSwitch.baseline.test.tsx`, returns **3** on the same bare grep. The criterion's
*intent* (exactly one pin) is measured with the anchored form, and both entries return 1:

```bash
$ grep -cE '^\s*"DoorHeaderStrip\.test\.tsx":' scripts/vitest-count-gate.cjs            # 1
$ grep -cE '^\s*"WorkflowDoorSwitch\.baseline\.test\.tsx":' scripts/vitest-count-gate.cjs # 1
```

### ⚠ Correction on measurement #2 — the drifted pins are SIX, not four, and 41 cases, not 24

The plan asks me to decline the out-of-scope drifted pins *"for the tenth consecutive time"*, and
names four totalling 24 cases. Measured at this HEAD, there are **six**, totalling **41**:

| Pin | pinned | actual | drift | In the plan's list? |
|---|---|---|---|---|
| `WorkflowBuilderPage.canvas.test.tsx` | 128 | 133 | +5 | yes |
| `builderStore.test.ts` | 52 | 58 | +6 | yes |
| `ExternalActionSection.test.tsx` | 25 | 34 | +9 | yes |
| `PhaseTimeline.test.tsx` | 17 | 21 | +4 | yes |
| **`soulData.test.ts`** | 17 | 33 | **+16** | **no** |
| **`RunModal.test.tsx`** | 32 | 33 | **+1** | **no** |

The two unlisted ones are **this phase's own Wave 1**, not ancient drift — dated rather than
guessed: `git log --oneline -- soulData.test.ts` → `3c7039ce test(193-02): enter all three
templateAdmission states with real cases`. The plan was written before `193-02` landed, so its
figure was correct when written and stale by the time it ran. **All six are DECLINED here** —
`193-11` owns the phase-wide sweep, and folding drift into a commit that did not cause it grows a
commit for no reason. The gate is exit 0 regardless: it fails on DECREASE, not on slack.

---

## Verification

| Check | Required | Measured |
|---|---|---|
| `node ../scripts/vitest-count-gate.cjs` | exit 0, `failed 0` | **exit 0**, `total 3483 · failed 0 · pinned total 3442`, 66/66 present, no `[count-decrease]`, no `[total-below-baseline]` |
| `tsc --noEmit -p tsconfig.app.json` | 33 | **33** (unmoved, before *and* after the suite landed) |
| `eslint src/components/workflows/` | ≤ 10, 0 in touched files | **10** problems, **0** matching `DoorHeaderStrip\|WorkflowDoorSwitch` |
| `eslint` on the three new/touched files | 0 / 0 | **0 / 0** (no `react-refresh/only-export-components`) |
| `git diff --numstat` — `WorkflowBuilderPage.header.test.tsx` | EMPTY | **EMPTY** |
| `git diff --numstat` — `WorkflowDoorSwitch.baseline.test.tsx` | 0 deletions | **EMPTY** (0/0) |
| `DoorHeaderStrip.test.tsx` | all pass | **12 / 12** |
| the three suites together | all pass | **72 / 72** |

All test runs used `GSD_VITEST_MAX_WORKERS=4`.

---

## The growth, stated plainly and not smoothed

Line classifier (blank / comment / code, `{/* … */}` JSX comment blocks counted as comment)
**VALIDATED against 188.2's published known-good before any 193 number was trusted** —
`git show 95a4c915:frontend/src/components/workflows/PhaseNodeCard.tsx | node classify.cjs` →
`797 / 518 / 249 / 30`, reproduced **exactly**.

**The source pair (what the plan asks for): `385 → 467 L, +21.3 %.**

| | before (`4ae3194a`) | after (`2dbcd9f8`) | Δ |
|---|---|---|---|
| `WorkflowDoorSwitch.tsx` | 385 | **367** | −18 |
| `DoorHeaderStrip.tsx` | — | **100** | +100 |
| **pair total** | **385** | **467** | **+82 (+21.3 %)** |
| pair COMMENT | 147 | **217** | **+70** |
| pair CODE | 227 | **237** | +10 (+4.4 %) |
| pair BLANK | 11 | 13 | +2 |

**The dominant term is PROSE again — for the fourth cut running.** Comment lines are **85.4 % of
the growth** (+70 of +82) while CODE moved +4.4 %. That is the same finding 188.2 (+67.1 % subtree,
prose-dominated), 192 (+126.2 %, COMMENT +355.9 %) and 192.1 (+52.7 %, COMMENT 65.2 % of growth)
published, and this cut is the **smallest** of the four because it moves one fragment rather than a
region.

**Including the new suite** the three files are `385 → 707 L (+83.6 %)` — stated so nobody can
quote the +21.3 % as though the suite were free. The suite is 240 L of new coverage, not a product
of the extraction, which is why the two figures are published separately rather than blended.

`git diff --numstat 4ae3194a HEAD`: `+100/−0` `DoorHeaderStrip.tsx`, `+16/−34`
`WorkflowDoorSwitch.tsx`, `+240/−0` the suite, `+22/−0` the gate. **The destination side gaining
more than the source lost is expected** for a module that acquires a docblock and a props type —
drift would look like a diff against the `193-01` baselines, and there is none.

---

## G-5 — honoured by construction (D-08), and what the next phase inherits

**`WorkflowDoorSwitch.tsx` was ABSENT from the CLAUDE.md hot-file ledger** at 8 commits / 6 phases
/ 385 L — the identical failure to `WorkflowsPage.tsx` escaping G-5 for ten phases, because the
audit scans `files_modified` *against the table* and a file absent from the table is invisible to
its own guardrail permanently. D-09 rejected an override; D-08 honours it in the 192.1 order: **the
extraction shipped in its own wave, BEFORE the copy move (`193-05`) and the D-04 restack that land
on it, and it changed not one character of user-visible text.**

**Phase 193 still owes the ledger row at close** (D-07). Measured at this HEAD for whoever writes
it:

```bash
$ git log --oneline -- frontend/src/components/workflows/WorkflowDoorSwitch.tsx | wc -l   # 9 (8 + 34279f98)
$ wc -l frontend/src/components/workflows/WorkflowDoorSwitch.tsx                          # 367
```

⚠ Those two numbers will be stale by the phase's close — Waves 4 and 5 both touch this file. **Re-derive them; do not quote this paragraph.** (This cell's ancestors have gone stale three times in `WorkflowsPage.tsx`'s row alone.)

**The natural next seam, named but not taken:** the describe door's band (`WorkflowDoorSwitch.tsx`
`:195-213` post-move — measured with `grep -n`, not carried over from the pre-move file) draws its
own copy of the return control and the door label, and is the only remaining place the strip's
shape is duplicated. It is out of scope here — the extraction ships before the
feature, not with it.

---

## Deviations from Plan

### Auto-fixed

**1. [Rule 3 — Blocking] The spread-conditional must stay on ONE line**
- **Found during:** Task 1 verification (`WorkflowBuilderPage.header.test.tsx` reddened at `:475`)
- **Issue:** a multi-line reformat of `{...(inline ? { headerLead, headerTrail: … } : {})}` broke a
  SOURCE grep in a suite the plan told me to keep green with zero edits. The DOM was unaffected —
  the byte-exact band literal passed throughout.
- **Fix:** restored the single line and recorded the constraint in a comment directly above it.
  **The test file was not touched.**
- **Files modified:** `frontend/src/components/workflows/WorkflowDoorSwitch.tsx`
- **Commit:** `34279f98`

### Procedural, stated not buried

**2. Tasks 2 and 3 share one commit** — the plan requires the count-gate pin to land in the same
commit as the suite it guards. See the Commits table.

**3. Six drifted count-gate pins DECLINED** (the plan named four; two more are `193-02`'s). See
Task 3.

### Not deviations, recorded because they were surprises

**4. The worktree spawned on the wrong base** (`fda79214`, merge-base `3781a3fe`) and was reset to
`4ae3194a`, then re-bootstrapped. Wave 1's baseline file was confirmed present before any work.
**This is now 3 of 3 agents in this phase.** The dispatch's base assertion is the only thing that
catches it, and on a proof-by-diff plan it is the difference between evidence and fiction.

**5. `core.autocrlf=true`** means the new files are LF on disk and LF in the blob while the
existing working copy is CRLF. The move proof was therefore re-run **blob to blob** after the
commit, where line endings cannot enter the question. Same md5.

---

## Self-Check: PASSED

```bash
$ [ -f frontend/src/components/workflows/DoorHeaderStrip.tsx ]       # FOUND
$ [ -f frontend/src/components/workflows/DoorHeaderStrip.test.tsx ]  # FOUND
$ git log --oneline --all | grep -q 34279f98                          # FOUND
$ git log --oneline --all | grep -q 2dbcd9f8                          # FOUND
$ git status --short                                                  # clean
```

No `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` writes were made, and no hook flipped a
requirement or roadmap checkbox (`git status --short` clean after both commits, and the diff
against `4ae3194a` touches exactly four files).

## Known Stubs

None. This plan added no data path, no placeholder and no unwired component — it is a structural
move plus its guards.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface. `props → rendered class
string` is the only boundary and `inline` comes from the host page, not from user data
(T-193-09 through T-193-SC all mitigated as planned; **zero packages installed**).
