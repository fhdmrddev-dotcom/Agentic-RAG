---
phase: 251
plan: "03"
subsystem: planning-tooling
tags: [seeds-register, REG-01, D-05, D-06, D-07, D-17, D-20, renumber, redirect-stub]
requires:
  - "251-01 — scripts/check-seeds-register.cjs (frontmatter, keyValue, readKey, analyse, the [duplicate-id] superseded-id carve-out)"
  - "251-02 — the migrated frontmatter that makes `created`-else-`planted` readable on all 16 members"
provides:
  - ".planning/seeds/ — 292 files: 8 movers at 277-284 and 8 redirect stubs at the original ids"
  - "the register's FIRST fully green reading: 292/292 parsed, 0 duplicate ids, 292/292 carry all 5 required keys"
  - "251-RENUMBER-LEDGER.md — the derivation, both tie-breaks, and every reference deliberately left on a stub"
affects:
  - ".planning/seeds/ (8 renamed + 8 created + 6 cross-reference edits + 4 H1 corrections)"
  - "docs/HOT-FILE-LEDGER.md, CLAUDE.md, .planning/{STATE,HANDOFF*,PROJECT-adjacent}, .planning/phases/247-*, .planning/reported-bugs/, .planning/sketches/ (37 single-line id swaps)"
  - "⛔ backend/, frontend/, scripts/ and .planning/milestones/ — BYTE-UNCHANGED, asserted"
tech_stack:
  added: []
  patterns:
    - "one parser, IMPORTED: the derivation and the stub writer both call the Wave-1 gate's reader rather than growing a second one"
    - "dry-run default / explicit --apply / read-back asserted, carried forward from 251-02"
    - "a rewrite map is a table of (file, line, old, new, expected-occurrences) that REFUSES a count mismatch — never a sed over the id set"
    - "RAW-Buffer body invariant applied to renames, not only to the migration"
key_files:
  created:
    - .planning/seeds/SEED-022-superseded-id.md
    - .planning/seeds/SEED-092-superseded-id.md
    - .planning/seeds/SEED-228-superseded-id.md
    - .planning/seeds/SEED-229-superseded-id.md
    - .planning/seeds/SEED-231-superseded-id.md
    - .planning/seeds/SEED-253-superseded-id.md
    - .planning/seeds/SEED-259-superseded-id.md
    - .planning/seeds/SEED-269-superseded-id.md
    - .planning/phases/251-register-integrity/251-RENUMBER-LEDGER.md
    - .planning/phases/251-register-integrity/251-03-SUMMARY.md
  modified:
    - .planning/seeds/ (8 git-mv renames, 6 cross-reference edits, 4 H1 corrections, TEMPLATE.md)
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "the 8 verdicts were RE-DERIVED through the gate's own reader and then compared against RESEARCH §2.6's independently-produced table — they agree on all 8, which is the property D-07 was chosen for"
  - "FOUR ids are read from product code, not the one D-17 names: SEED-092 was found AT EXECUTION because its four references spell out `SEED-092-remainder`, and a per-id ruling would have called all six of them keeper"
  - "FOUR moved files still titled themselves with the OLD id in their `# H1` — the gate greps `seed_id`, never headings, so it was green throughout and could not have caught it"
  - "the whole `.planning/phases/251-register-integrity/` directory is deliberately NOT rewritten: it is the transcript OF the collision, and rewriting pasted gate output makes it a lie"
  - "`SEED-281:162` quotes `attentionConditions.ts`'s docblock VERBATIM and must keep saying `SEED-231`, because the source file still does"
  - "⛔ FINDING, not fixed here: the gate's carve-out is `stubs.length === 1`, so a 3-member group with one stub is silenced. Fixing it means editing `scripts/`, which this plan forbids — routed to Plan 04"
  - "REG-01 marked COMPLETE — unlike Waves 1 and 2, this plan's requirement is genuinely discharged: the gate reads 0 duplicate ids"
metrics:
  duration: ~95 min
  tasks: 3
  commits: 4
  completed: 2026-09-16
---

# Phase 251 Plan 03: The Duplicate Renumber and the Redirect Stubs Summary

**One-liner:** Eight ids that each named two seeds now name exactly one, resolved by a date rule
re-derived at execution and cross-checked against an independently-produced table, with eight
redirect stubs that name BOTH resolutions — four of them worded for a developer arriving from a code
comment, because measurement found **four** source-read ids where the decision names one — and not a
byte of product source or sealed archive touched.

## What shipped

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | The 8 verdicts derived, the 8 movers renamed to 277-284 | `5fc75a0f0` | `.planning/seeds/` (8 `git mv` + `TEMPLATE.md`), `251-RENUMBER-LEDGER.md` |
| 2 | The 8 redirect stubs | `6c31aaff1` | `.planning/seeds/SEED-0NN-superseded-id.md` ×8 |
| 3 | Live citations rewritten; the deliberate non-edits written down | `78c8cf010` | 25 files across `.planning/`, `docs/`, `CLAUDE.md` |

---

## The measured result, against `251-GATE-BASELINE.md` §10

| figure | baseline | after Plan 02 | **after this plan** | §10 predicted |
|---|---|---|---|---|
| `register:` / `parsed:` | 284 / 284 | 284 / 284 | **292 / 292** | 292 / 292 ✅ |
| `skipped:` | 0 | 0 | **0** | 0 ✅ |
| `[duplicate-id]` | **8** | 8 | **0** | 0 ✅ |
| `[no-frontmatter]` | 5 | 0 | **0** | 0 ✅ |
| `[missing-key]` | 396 | 0 | **0** | 0 ✅ |
| `[unknown-status]` | 27 | 0 | **0** | 0 ✅ |
| seeds with all 5 keys | 73 / 284 | 284 / 284 | **292 / 292** | 292 / 292 ✅ |
| `--self-test` | 6/6 PASS | 6/6 PASS | **6/6 PASS** | 6/6 ✅ |
| **gate exit code** | **1** | **1** | ⭐ **0** | — |

```
seeds register — .planning/seeds
  register: 292 files · parsed: 292 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger

seeds register gate OK — 292/292 parsed, 0 duplicate ids, 292/292 carry all 5 required keys.
```

⭐ **This is the first fully green reading of the seeds register in this phase, and the first this
project has ever had.** The verdict line is recorded verbatim above rather than summarised.

⚠ **`134 carry no trigger_when at all`, up from 126 — and that is CORRECT, not drift.** The eight
stubs each carry `trigger_when: unset`, which the Wave-1 gate deliberately counts as *no trigger*.
Reporting `126` here would have meant the gate had stopped counting eight real files. `126 + 8 = 134`,
with no residual. The second figure is unmoved at `114`, as it should be — a stub introduces no prose
trigger either.

---

## The 8 verdicts — derived, then cross-checked against a table produced by a different method

Full derivation with both dates, the supplying key, both tie-break timestamps and the two
frontmatter-vs-git disagreements: **`.planning/phases/251-register-integrity/251-RENUMBER-LEDGER.md`.**

| id | ⭐ KEEPS | → moves to | decided by |
|---|---|---|---|
| **022** | `camelot-pdf-table-precision-audit` | **277** `timeout-settings-ui` | `planted` 05-16 vs 05-25 |
| **092** | `app-wide-wcag-aa-contrast-and-icon-button-labels` | **278** `remainder` | `planted` 06-20 vs 07-16 |
| **228** | `a-workflow-cannot-say-the-whole-library-on-purpose` | **279** `read-doc-refuses-a-docx…` | `planted` 08-28 vs 08-31 |
| **229** | `does-the-golden-run-hang-on-an-armed-approval-checkpoint` | **280** `five-suites-in-neither-count-gate-knob` | `planted` 08-28 vs 08-31 |
| **231** | `decision-coverage-gate-is-blind…` | **281** `nobody-is-told-an-approval-is-waiting` | ⛔ **TIE** → git, **62m 56s** |
| **253** | `mobile-has-no-drawer-trigger…` | **282** `source-file-path-is-synthetic…` | ⛔ **TIE** → git, **13h 24m 06s** |
| **259** | `tool-names-are-rows-but-argument-shapes-are-not` | **283** `assistant-narration-repeats-verbatim…` | `created` 09-08 vs 09-13 |
| **269** | `explanations-are-noise-in-the-form…` | **284** `one-home-for-the-elapsed-formatter` | `created` 09-10 vs 09-11 |

**All 8 agree with `251-RESEARCH.md` §2.6**, which was produced a day earlier with `grep -m1` and
`--date=short`; this run used the gate's `frontmatter`/`keyValue` reader and `--date=iso`. ⭐ **Two
methods, one answer — that is the whole argument for D-07 over "case by case".** The two tie deltas
also reproduce CONTEXT's hand-derived *"63 min"* / *"13h 24m"* and the Wave-1 gate's
`62m 56s` / `13h 24m 06s`: **three derivations, three registers, one answer.**

**Allocation rule, recorded rather than just used:** fresh ids assigned in ascending order of the OLD
id onto the ascending list of FREE ids — so the mapping is re-derivable from the register alone.

```
register: 284 files · distinct ids: 276 · highest: 285 · max+1 = 286
the 8 FREE ids at or above 277: 277, 278, 279, 280, 281, 282, 283, 284
```

⛔ **`SEED-285` EXISTS: exactly eight free slots for exactly eight renumbers, zero headroom.** A ninth
would have had to jump to **286**. Wave 2's carried finding re-derived here rather than trusted.

**8/8 movers cite a DATE in `renumbered_because` and explicitly disclaim reference weight; 0/8 choose
a side by reference count** — asserted mechanically, not by eye:

```
8/8 movers cite a DATE, disclaim reference weight, and choose no side by reference count.
```

⚠ `SEED-224`'s `renumbered_because` — the one prior renumber done well — chose its mover **by
reference weight**, which D-07 rejects by name. **Its KEYS were copied; its reasoning was not**, and
the eight new values say so.

---

## RED evidence, verbatim

### RED 1 · the body invariant, driven against a planted defect on a REAL CRLF seed

Five of the eight movers are CRLF and three are LF. A scratch copy of
`SEED-022-timeout-settings-ui.md` written through the same read-back path, once naively and once
correctly:

```
body md5 BEFORE (raw Buffer): 8ec7add98294b606503c15d9673f3b14  2768 bytes

PLANTED DEFECT: re-serialised string concat
  body md5 AFTER : 0f70bf64770ae85920f8c76966dc8f3c
  read-back verdict: REFUSED — BODY md5 CHANGED  <-- RED
  what a NORMALISED-TEXT check would say: identical  <-- the comfortable lie

CORRECT: Buffer.concat
  body md5 AFTER : 8ec7add98294b606503c15d9673f3b14
  read-back verdict: PASS (identical)
```

All 8 movers then verified md5-identical across the real write (per-file digests in the ledger §2).

### RED 2 · ⭐⭐ THE COUNTERFACTUAL — the stub carve-out, driven on a fixture AND on the real register

A green gate after eight stubs proves nothing on its own: it would look identical if the carve-out
matched **any** group containing a stub, or any group at all. So the carve-out was driven against
planted defects — first on a fixture register through `analyse()`:

```
carve-out counterfactual — `stubs.length === 1` is a COUNT, not a presence test

  A the SHIPPED SHAPE: keeper + exactly one superseded-id stub -> NOT a duplicate
      duplicate-id findings: 0  (want 0)  ...  PASS
  B PLANTED DEFECT: TWO superseded-id members -> MUST still be a duplicate
      duplicate-id findings: 1  (want 1)  ...  PASS
  C PLANTED DEFECT: the stub left at `planted` -> MUST still be a duplicate
      duplicate-id findings: 1  (want 1)  ...  PASS
  D ⛔ FINDING, not a defect I planted: THREE members with ONE stub -> the carve-out
      SILENCES the real keeper-vs-squatter collision
      duplicate-id findings: 0  (want 0)  ...  PASS
```

…and then on the **real, shipped register**, with a byte-identity proof either side:

```
register digest BEFORE : 3216884f8ac334baba1bf2ac3d662ef7 *-

=== RED a · the SEED-253 stub's status flipped off superseded-id ===
exit=1
  [duplicate-id] SEED-253 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md   (2026-09-06)
      .planning/seeds/SEED-253-superseded-id.md   (2026-09-16)

=== RED b · a SECOND stub planted on SEED-022 ===
exit=1
  [duplicate-id] SEED-022 — 3 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-022-camelot-pdf-table-precision-audit.md   (2026-05-16)
      .planning/seeds/SEED-022-superseded-id-planted-second-stub.md   (2026-09-16)
      .planning/seeds/SEED-022-superseded-id.md   (2026-09-16)

register digest AFTER  : 3216884f8ac334baba1bf2ac3d662ef7 *-
BYTE-IDENTICAL: yes
gate restored exit=0
```

⭐ **The green is honest: the same gate goes RED on both ways a stub can be wrong, on the real
register, and the register comes back byte-identical.** This is Wave 1's arm-4 and Wave 2's arm-3
finding driven a third time, one register over — *a guard nobody has seen fire is not a guard.*

### ⛔ Arm D is a FINDING about the shipped gate, and it is NOT fixed here

`duplicateGroups()` reads `if (stubs.length === 1) continue;`. That is a **count on the stubs, not a
shape check on the group** — so a group of **keeper + squatter + stub** is waved through as
"resolved" when it contains a live, unresolved collision between the first two. Today no such group
exists, and the eight shipped groups are all exactly 2 members.

**It is not fixed in this plan because the fix is one line in `scripts/check-seeds-register.cjs`, and
this plan forbids touching `scripts/` (D-17).** The correct guard is
`members.length === 2 && stubs.length === 1`, plus a self-test arm asserting a 3-member group with one
stub still FAILS. ⛔ **Routed to Plan 04**, which already edits the wiring, and recorded here rather
than left in a transcript.

---

## ⛔ FOUR of the eight ids are read from product code — the decision names ONE

This is the most consequential measurement in the plan.

| id | named at | by whom |
|---|---|---|
| `SEED-253` | **discuss-phase** | D-17 names it explicitly (25+ backend refs) |
| `SEED-229` | **planning** | `scripts/vitest-count-gate.cjs` ×3 |
| `SEED-231` | **planning** | `frontend/src/components/layout/attentionConditions.ts` ×3 |
| **`SEED-092`** | ⛔ **EXECUTION — this plan** | 4 frontend a11y comments and tests |

**`SEED-092` was missed twice for a structural reason worth writing down.** Its four references live
in a11y comments and a11y tests, and `SEED-092`'s **keeper** is *the app-wide WCAG AA seed* — so
"an a11y comment means the a11y seed" is the natural inference, and it is **wrong**. Every one of them
spells the name out as **`SEED-092-remainder`**, which is the child — the seed that MOVED:

| file:line | what it says |
|---|---|
| `frontend/src/components/ingestion/NavRow.tsx:127` | *"…is logged to `SEED-092-remainder`.)"* |
| `frontend/src/components/skills/SkillCard.tsx:96` | *"…restructure is logged to `SEED-092-remainder`.)"* |
| `frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx:73` | *"…already logged to `SEED-092-remainder`"* |
| `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx:176` | *"…logged to `SEED-092-remainder`, explicitly NOT fixed"* |

⭐ **Only reading each hit found it.** A per-id ruling — the cheap approach, and the one a `sed` forces
— would have marked all six `SEED-092` references "keeper" and left four comments pointing at the
wrong seed forever. `SEED-092-superseded-id.md` now carries the sentence those four readers need and
says plainly that it is the fourth of the eight rather than pretending it was expected.

⚠ **`SEED-231` was also re-measured larger:** 3 references in one file became **5 across three** —
`attentionTab.test.ts:184` and `NavPanel.badge.test.tsx:24` carry one each. Its stub names all three
files.

---

## ⛔ FOUR moved files still titled themselves with the OLD id — and the gate could never have seen it

The renumber updated `seed_id:` and added `renumbered_from`. The re-scan of the permitted set then
found that four of the eight moved files still claimed the old id in their own `# H1`:

| file | was | now |
|---|---|---|
| `SEED-277-timeout-settings-ui.md:26` | `# SEED-022 — Timeout Settings UI with Tier Presets` | `# SEED-277 — …` |
| `SEED-278-remainder.md:37` | `# SEED-092-remainder — the exhaustive WCAG 2.1 AA audit…` | `# SEED-278 — …` |
| `SEED-281-nobody-is-told-an-approval-is-waiting.md:67` | `# SEED-231 — the run stopped and asked…` | `# SEED-281 — …` |
| `SEED-284-one-home-for-the-elapsed-formatter.md:43` | `# SEED-269 — one home for the elapsed formatter` | `# SEED-284 — …` |

⛔ **This is the `SEED-068` bad precedent one field over** — the file whose `seed_id` disagrees with
its filename, which `251-PATTERNS.md` quotes so the plan could say what it was not doing. The gate
greps `seed_id`, never headings, **so it read `duplicate ids: 0` throughout and was structurally
incapable of catching this.** A gate is not a proof-reader; the re-scan is.

---

## Live references — decided by READING, one at a time

⛔ **There is no blanket find-and-replace anywhere in this plan (T-251-15).** The rewriter is a table
of `(file, line, oldToken, newToken, expectedOccurrences, why)` and **refuses** a line whose count
does not match. Full per-line table with the reason for each: ledger §4.

| | |
|---|---|
| total live hits enumerated (`--hidden`, milestones excluded) | **393 across 96 files** |
| **rewritten** (the reference means the MOVER) | **37 lines across 18 files** |
| left byte-unchanged because they mean the **KEEPER** | **55 across 17 files** |
| left because the file is this phase's **own transcript** | **123 across 10 files** |
| left under **D-17** (product source) | **91 across 35 files** |
| left because `.agent-bus/OPEN.md` is a historical message log | **13** |

⭐ **36 of the 37 rewrites are provably PURE id swaps** — mapping the new id back to the old in each
`+` line reproduces the `-` line byte-for-byte. The thirty-seventh is the one deliberate expansion,
`SEED-022/023` → `SEED-277 / SEED-023`, because `SEED-277/023` reads as a fraction.

⚠ **`rg --hidden` is load-bearing.** Without it `rg` skips dot-directories and returns a confident,
wrong, near-zero over `.planning/` — RESEARCH §8.11 published one.

### ⭐ One reference that LOOKS stale, is NOT, and must never be "fixed"

`SEED-281-nobody-is-told-an-approval-is-waiting.md:162` quotes `attentionConditions.ts`'s docblock
**verbatim**: *"The seam exists so `SEED-231` (nobody is told an approval is waiting) can plug in
later…"*. ⛔ **The quotation is accurate precisely because the source file still says `SEED-231`** —
D-17 leaves it there. Rewriting the quote would make the seed lie about what the module says.

### ⛔ The 251 phase directory is deliberately NOT rewritten

123 hits across 10 files. `251-GATE-BASELINE.md` pastes the gate's **verbatim pre-migration output**;
`251-RESEARCH.md` carries the measured 8-pair table; `251-CONTEXT.md` states D-05/D-07/D-17/D-20 about
the ids as they stood. **Rewriting a transcript makes it a lie about what the command printed.** Every
`SEED-022` in that directory correctly means *the id as it was*, which is the same reason D-06 seals
the archives.

---

## D-17 executed — 35 files, 91 occurrences, and the split that matters

| | occurrences | files |
|---|---|---|
| now land on a **stub** (the reference means the MOVER) | **54** | **25** |
| still resolve correctly (the reference means the KEEPER) | **36** | 10 more |
| genuinely **ambiguous**, left on the stub rather than guessed | **1** | 1 |
| **total** | **91** | **35** |

⚠ **Research measured `33 files / 84 occurrences` on 2026-09-15; it is `35 / 91` on 2026-09-16.**
The plan's own phrase *"the 33 files"* had rotted by two files in a day — the growth is Wave 1's and
Wave 2's own scripts, which cite the collisions in comments. **The re-derived figure is published, not
the plan's.**

⭐ **`SEED-259`'s 32 references are the largest block and every one stays correct**, because D-07's
date rule happened to keep the id on the side the code meant — including
`backend/tests/unit/services/sources/test_259_argument_shapes_are_rows_too.py`, the only place in the
repository where one of these ids is load-bearing **in a path**.

⚠ **One genuinely ambiguous reference**, left on the stub rather than guessed, exactly as the plan
directs: `backend/tests/integration/test_pymupdf_in_process.py:5` — *"plants `SEED-022` (in-process
retry trigger)"*, which describes neither a Camelot precision audit nor a timeout-settings UI.

**The full per-file list is in `251-RENUMBER-LEDGER.md` §3e**, with the id each file means and the stub
it now lands on.

---

## The observation CONTEXT.md asked for — recorded beside the rule, never as a reason to depart

**It happens on exactly one pair, and it is the heaviest of the eight.** `SEED-253` is referenced by
~53 files; every live reference outside the sealed archives means the **MOVER**, while the keeper
(`mobile-has-no-drawer-trigger-outside-the-chat-view`) is cited essentially nowhere outside its own
file and the archives.

⛔ **D-07 still hands the id to the keeper, and that is correct.** D-07 rejects *"most-referenced keeps
it"* **by name** — it optimises the outcome over the principle and leaves no precedent for the ninth
collision. The consequence is paid for by D-05's stub and D-17's written record, which exist for
exactly this case. **An exception here would have been the one judgement call the rule was chosen to
avoid**, and the `SEED-253` stub says so in its own body.

---

## Deviations from Plan

### 1. [Rule 1 — my own defect, caught by the re-scan] Four moved files kept the OLD id in their `# H1`

- **Found during:** Task 3's re-enumeration of the permitted set, after Task 1 had already committed.
- **Issue:** the renumber script updated `seed_id:` and added `renumbered_from`, and said nothing
  about the body. Four of eight movers titled themselves with the id they no longer claim.
- **Fix:** all four H1s corrected in Task 3's commit, each asserted against its exact expected old
  text so a mismatch refuses rather than guesses. Recorded above and in ledger §4d.
- **Why it matters beyond the four files:** the gate is structurally blind to it. Any future renumber
  must check the body, not only the frontmatter.
- **Commit:** `78c8cf010`.

### 2. [Rule 2 — missing critical correction] `TEMPLATE.md`'s `renumbered_*` comment described the wrong side

- **Found during:** Task 1, writing the first `renumbered_from` onto a mover.
- **Issue:** the template read `# D-05, redirect stubs only — the id this file used to claim`. That is
  internally contradictory: *"the id this file used to claim"* is the MOVER's semantics, while
  *"redirect stubs only"* forbids putting it there. `SEED-224`, the precedent D-05 cites, puts both
  keys on the renumbered file.
- **Fix:** the comment now names both sides and adds D-07's constraint — *cite the DATE, never
  reference weight*. This is the first real exercise of the contract Wave 2 wrote, and it found a
  defect in it.
- **Commit:** `5fc75a0f0`.

### 3. ⛔ [decision — FINDING, deliberately not fixed] The gate's carve-out is a COUNT, not a shape check

`duplicateGroups()` skips any group with exactly one `superseded-id` member, **regardless of how many
members the group has**. A keeper + squatter + stub trio therefore reads as resolved. Driven and
measured (arm D above). **Not fixed here because the fix edits `scripts/`, which D-17 forbids in this
plan.** Routed to Plan 04 with the one-line guard and the self-test arm named.

### 4. [decision] The live-reference scope was read as the ORCHESTRATOR's boundary, which is wider than D-06's enumeration

D-06 enumerates six live locations. The executor's boundary states *"live references in `.planning/`
(outside milestones), `docs/` and `CLAUDE.md` ARE updated"*, which additionally covers
`.planning/reported-bugs/`, `.planning/sketches/`, `STATE.md`, `HANDOFF.json` and `HANDOFF-260914.md`.
**The wider reading was taken**, because `related_seeds:` frontmatter in a live bug report is exactly
the kind of index reference REG-01 exists to make resolvable. `.agent-bus/OPEN.md` sits outside
`.planning/` and is a historical message log, so it was left. Every file touched is listed in ledger
§4a.

### 5. [decision] The Task-1 acceptance criterion about filename collisions is satisfied at the moment it names, not at the end

The criterion is that `ls … | uniq -c | awk '$1>1'` prints nothing **BEFORE the stubs are written**.
Measured: **0 lines** after the renames and before Task 2. After the stubs it correctly prints eight
groups of two — each a keeper plus its stub, which is the designed resolution and the reason the
gate's `[duplicate-id]` count, not the filename count, is the criterion that matters.

### 6. [decision] REG-01 IS marked complete — unlike Waves 1 and 2

Waves 1 and 2 both deliberately left their requirements `Pending`, because their deliverables were not
the requirement. **This one is.** `[duplicate-id]` reads `0` and a reference by id resolves to exactly
one thing. Marking it complete puts a TRUE record in the register.

---

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `check-seeds-register.cjs` | exit **0** — `292/292 parsed, 0 duplicate ids, 292/292 carry all 5 required keys` |
| 2 | `check-seeds-register.cjs --self-test` | exit **0**, **6/6 arms PASS** |
| 3 | carve-out counterfactual, fixture (4 arms) | shipped shape 0 dups; two planted defects → 1 dup each; arm D is a finding |
| 4 | carve-out RED on the REAL register (2 arms) | both exit **1**; register digest **byte-identical** before and after |
| 5 | `git diff --name-only backend/ frontend/ scripts/` | **0 lines**, working tree and index, for the whole plan |
| 6 | `git diff --name-only .planning/milestones/` | **0 lines** — archives byte-unchanged (D-06) |
| 7 | `git log --follow` on each of the 8 renamed files | resolves through the rename: 3, 6, 3, 3, 5, 6, 2, 3 commits |
| 8 | body md5 across the 8 renames (raw Buffers) | **8/8 IDENTICAL** |
| 9 | `renumbered_because` on the 8 movers | **8/8** cite a date, disclaim reference weight, choose no side by reference count |
| 10 | the 8 stubs' bodies name BOTH resolutions by full filename | asserted in the writer — **8/8** |
| 11 | `check-claude-md-size.cjs` | exit **0** — **100,572 chars**, 67% of limit, headroom 49,428 (unchanged: a 3-digit id for a 3-digit id) |
| 12 | `check-hot-file-ledger.cjs 251` | exit **0**, no `[no-row]` — ⚠ `watched: 0` beside `subject: 17` still means *nothing was checked* |
| 13 | rewrite purity | **36 / 37** provably pure id swaps; the 37th is the documented expansion |
| 14 | file deletions in any of the 3 task commits | **0**, **0**, **0** |
| 15 | dry runs (derivation, stubs, rewriter) leave `git status --porcelain` | **empty**, all three |

## Self-Check: PASSED

```
FOUND: .planning/phases/251-register-integrity/251-RENUMBER-LEDGER.md
FOUND: .planning/seeds/SEED-277-timeout-settings-ui.md
FOUND: .planning/seeds/SEED-284-one-home-for-the-elapsed-formatter.md
FOUND: .planning/seeds/SEED-022-superseded-id.md
FOUND: .planning/seeds/SEED-269-superseded-id.md
FOUND: 5fc75a0f0
FOUND: 6c31aaff1
FOUND: 78c8cf010
```

## Carried findings for Plan 04

1. ⛔ **Fix the carve-out shape check** — `members.length === 2 && stubs.length === 1`, with a
   self-test arm asserting a 3-member group carrying one stub still FAILS. Driven and measured here;
   one line in `scripts/check-seeds-register.cjs`, which only Plan 04 may touch.
2. ⚠ **The next free id is `286`**, not `285`. 277-284 are now taken by this plan and **285 was
   already taken**. The `max(id)+1` allocator Wave 2 shipped gets this right; the old count-based one
   would emit `SEED-293` today and collide differently.
3. ⚠ **A renumber must check the BODY, not only the frontmatter.** Four H1s claimed the wrong id and
   the gate is structurally blind to it. If Plan 04 wants a guard, the cheap one is an
   `[id-in-heading]` code comparing `SEED-\d{3}` in the first `# ` line against the filename.
4. ⭐ **`superseded-id` now matches 8 files, not zero.** Any future status sweep, count or histogram
   that assumed the value was decorative needs re-reading against the live register.
5. ⚠ **`STATE.md`'s `progress:` frontmatter is still internally inconsistent** (Wave 1's finding,
   unchanged here): `completed_phases: 1 / total_phases: 12 / percent: 8` against ROADMAP's own
   reading. Flagged for Plan 04 or the phase close, as Wave 1 asked.

## TDD Gate Compliance

Plan-level `type: execute` with three `type="auto"` tasks and no `tdd="true"` task. Commit sequence is
`feat` → `feat` → `docs`, **with no `test(...)` commit**, and that is stated rather than hidden: this
plan writes no executable code, and there is no test framework for `.planning/` content. What replaces
the label is the drive discipline — **RED 1 and RED 2 were both executed against planted single-line
defects BEFORE the corresponding behaviour was trusted**, RED 2 twice (fixture and the real register,
with a byte-identity proof either side), and both transcripts are captured verbatim above. **RED 2's
arm D is the one that earns the mention:** it was written expecting a pass and returned a real defect
in the shipped gate, which is what a counterfactual is for.
