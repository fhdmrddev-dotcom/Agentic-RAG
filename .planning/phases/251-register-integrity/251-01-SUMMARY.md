---
phase: 251
plan: "01"
subsystem: planning-tooling
tags: [gate, seeds-register, REG-02, self-test, tdd]
requires: []
provides:
  - "scripts/check-seeds-register.cjs — the REG-02 sweep instrument (CLI + library, zero dependencies)"
  - "module.exports { frontmatter, readKey, readList, keyValue, stripComment, readRegister, analyse, STATUS_ENUM, REQUIRED_KEYS, HarnessError, seedDate, statusToken, statusNote } — consumed by Plan 02's migration"
  - "--self-test — D-04's arms, re-runnable forever"
  - "251-GATE-BASELINE.md — the pre-migration census Plans 02/03/04 are measured against"
affects:
  - ".planning/seeds/ (READ ONLY — not one byte changed, proven by md5)"
tech_stack:
  added: []
  patterns:
    - "house gate shape: exit 0 clear / 1 violation / 2 harness error, derivation printed, [bracketed-codes] with a reason beside each"
    - "first check-*.cjs in this repo with module.exports + a require.main entry guard"
    - "first check-*.cjs in this repo with any executable self-test"
key_files:
  created:
    - scripts/check-seeds-register.cjs
    - .planning/phases/251-register-integrity/251-GATE-BASELINE.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "D-04's arm 4 required extracting analyse() as a pure function — a counterfactual cannot be asserted against scraped stdout"
  - "assertAccounting throws a catchable HarnessError instead of calling process.exit, so arm 5 can OBSERVE the count assertion fire"
  - "a sixth arm (1b) was added beyond the plan's five: D-05's superseded-id carve-out is a real code path and was otherwise asserted only by a comment"
  - "REG-02 was NOT marked complete — D-03 rules the wiring is the deliverable, and that is Plan 04"
metrics:
  duration: ~75 min
  tasks: 3
  commits: 4
  completed: 2026-09-16
---

# Phase 251 Plan 01: The Seeds-Register Gate Summary

**One-liner:** A zero-dependency sweep of all 284 seeds that derives its own scan set, refuses to
exit 0 over a collapsed one, names four failure codes on the live register today, and carries a
`--self-test` whose counterfactual arm was driven RED against a planted "matches everything" defect
that four of the other five arms sat green over.

## What shipped

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | The reader — frontmatter, continuation scalars, the count that cannot lie | `9e15ab3f4` | `scripts/check-seeds-register.cjs` |
| 2 | Four validation arms, the trigger match, the honest verdict | `f683ab4ab` | `scripts/check-seeds-register.cjs` |
| 3 | `--self-test` + the pre-migration census | `b38bd8444` | `scripts/check-seeds-register.cjs`, `251-GATE-BASELINE.md` |

Full census — every figure pasted from a named command —
`.planning/phases/251-register-integrity/251-GATE-BASELINE.md`.

---

## RED evidence, verbatim — required by `<tdd_note>`

### RED 1 · the continuation reader, driven BEFORE it was written

Run against the live register while `check-seeds-register.cjs` did not yet exist, using the plain
`scalar()` shape every sibling gate uses:

```
register files            : 284
no frontmatter block      : 5
carry a trigger_when line : 158
NAIVE single-line reader  : 45   <-- RED: this is what a plain scalar reader sees
```

GREEN, through `readKey` after Task 1:

```
files with a non-empty trigger_when : 158
shape tally                         : {"list":34,"plain":45,"folded":79}
```

⛔ **113 of 158 would have been silently reported as "no trigger"** by a `scalar()`-based sweep —
REG-02's own failure mode rebuilt inside the instrument meant to end it.

⚠ **One disagreement with `251-RESEARCH.md` §3.1, and the reader is the one that is right.** Research
measured `78 folded + 33 list + 45 plain + 1 other`, naming `SEED-167` as non-conforming
(`BLOCK_OR_MIXED`). Measured here: `79 / 34 / 45 / 0 other`. `SEED-167` is an ordinary YAML list whose
bullets **wrap onto indented continuation lines**; `readKey` appends a wrapped line to the bullet
above it, so the file resolves as `list` and no seed needs coercing. (`+1` on folded is `SEED-285`.)

### RED 2 · the count assertion over a collapsed scan set

```
registerSize = 0  entries = 0
FATAL: the register at …/seeds-red-L0JzfC resolved ZERO files. A gate that passes over nothing is
worse than absent — check-hot-file-ledger.cjs was measured exiting 0 over `subject: 0 files` at
Phase 242. Refusing to report a verdict.
exit=2
```

### RED 3 · `--files` with zero arguments

```
FATAL: --files was given ZERO arguments. A gate that passes over nothing is worse than absent:
check-hot-file-ledger.cjs was measured exiting 0 over `subject: 0 files` at Phase 242, in the same
run that printed `ledger gate OK`.
exit=2
```

### RED 4 · ⭐ THE ONE THAT MATTERS — arm 4, the counterfactual, driven against a planted defect

A scratch copy of the gate with exactly one line changed, so the matcher matches unconditionally:

```js
-        if (path.matchesGlob(norm(f), g)) hits.push({ kind: 'path', glob: g, target: norm(f) });
+        hits.push({ kind: 'path', glob: g, target: norm(f) });   // PLANTED DEFECT: matches everything
```

```
  arm 1 duplicate id FAILS … PASS
  arm 1b a superseded-id stub is NOT a duplicate … PASS
  arm 2 unknown status + no frontmatter FAIL, clean seed does not … PASS
  arm 3 a matching trigger IS printed … PASS
  arm 4 a NON-matching trigger is ABSENT (the counterfactual) … FAIL
      907 must NOT appear in the matched set, got [906,907]
  arm 5 an EMPTY register raises a harness error … PASS

self-test 5/6 arms PASS — the gate cannot be trusted until every arm is green.
exit=1
```

⛔ **FIVE of six arms stayed GREEN over a gate that had become useless.** D-04's *"a gate that prints
everything is not a sweep"* is no longer an argument in a document — it is a measurement, and arm 4 is
the only thing that caught it. The defective copy lived in the scratchpad and was deleted.

### RED 5 · the real register — a planted ninth collision, with a byte-identity proof

```
register digest BEFORE : ed6c0d98a173a2c64e08b520d3acac8f *-
  register: 285 files · parsed: 285 · skipped: 0 · duplicate ids: 9
  [duplicate-id] SEED-001 — 2 files claim this id; a reference to it resolves to more than one thing
      .planning/seeds/SEED-001-planted-ninth-collision-red-drive.md   (NO DATE)
      .planning/seeds/SEED-001-scale-readiness.md   (NO DATE)
exit=1
register digest AFTER  : ed6c0d98a173a2c64e08b520d3acac8f *-
BYTE-IDENTICAL: yes
git status --porcelain .planning/seeds/ -> [0 line(s)]
```

`register:` moved **284 → 285 by itself** — the scan set is derived, so a stale constant could not
have hidden the ninth collision. The digest is an md5 of per-file md5s over **raw bytes**, so one
changed byte anywhere in 284 files would have changed it.

---

## The self-test, green

```
seeds register — self-test (fixture register under C:/Users/fhdmr/AppData/Local/Temp, real register untouched)
  arm 1 duplicate id FAILS … PASS
  arm 1b a superseded-id stub is NOT a duplicate … PASS
  arm 2 unknown status + no frontmatter FAIL, clean seed does not … PASS
  arm 3 a matching trigger IS printed … PASS
  arm 4 a NON-matching trigger is ABSENT (the counterfactual) … PASS
  arm 5 an EMPTY register raises a harness error … PASS

self-test 6/6 arms PASS — duplicate id, stub carve-out, bad status, match, counterfactual, empty-register floor.
exit=0
```

---

## Deviations from Plan

### 1. [Rule 1 — stale measurement] The plan's register size had rotted BY ONE, in its own base commit

- **Found during:** Task 1, first run.
- **Issue:** `251-01-PLAN.md` asserts `283` files and `157` `trigger_when` values throughout its
  acceptance criteria. Measured at the base commit `97bb24e4d`: **284** and **158**. The extra file is
  `SEED-285-decision-coverage-gate-parses-zero-decisions-on-every-phase.md`, added by **`97bb24e4d`
  itself** — the commit this plan started from.
- **Fix:** none needed in code, and that is the finding. `registerSize` is derived by `readdirSync` at
  run time and `grep -n "28[34]" scripts/check-seeds-register.cjs` matches **two comment lines, zero
  code lines**. A gate that had hardcoded 283, as several acceptance criteria are phrased, would have
  exited `2` on the first run of its own criteria. Recorded in `251-GATE-BASELINE.md` §0, in STATE.md,
  and beside the stale `283` in ROADMAP's Plan-02 line (struck through, never overwritten).
- **Commit:** `b38bd8444` (baseline), plus the metadata commit.

### 2. [Rule 2 — missing critical coverage] A sixth self-test arm, `1b`, beyond the plan's five

- **Found during:** Task 3.
- **Issue:** D-05's carve-out — *a group carrying exactly one `status: superseded-id` member is not a
  duplicate* — is the code path Plan 03's entire output depends on. Without it, Plan 03's eight
  redirect stubs read as eight new regressions. The plan's five arms do not drive it, so it would have
  shipped asserted only by a comment.
- **Fix:** arm `1b` builds a two-member fixture with one stub and asserts **zero** `[duplicate-id]`
  findings. The ratio line therefore reads `6/6`, not the `5/5` the plan's acceptance criterion names.
- **Commit:** `b38bd8444`.

### 3. [Rule 3 — blocking] `assertAccounting` had to stop calling `process.exit`

- **Found during:** Task 3.
- **Issue:** arm 5 must **observe** the count assertion firing. `fail()` calls `process.exit(2)`,
  which nothing can catch, so the assertion was undrivable from inside the same process.
- **Fix:** a `HarnessError` class thrown by `harness()`; the CLI's existing `try/catch` converts it
  back into `fail()`, so the exit-code contract (`2 = harness error`) is byte-for-byte unchanged —
  verified by re-running RED 2 and RED 3 after the refactor.
- **Commit:** `b38bd8444`.

### 4. [decision] `REG-02` was NOT marked complete in REQUIREMENTS.md

The plan's frontmatter carries `requirements: [REG-02]`, and the standing execute-phase step is to
check the requirement off. **It was deliberately left `Pending`.** D-03's own words: *"⛔ **The wiring
is the deliverable, not the script.**"* The wiring into `discuss-phase` and `new-milestone` is Plan
04. Ticking REG-02 here would put a false record in the register this phase exists to make truthful —
which would be the funniest possible way to fail it. Plan 04 ticks it.

---

## Measured findings worth carrying

### ⭐ `check-hot-file-ledger.cjs 251` is green because it checked NOTHING

```
hot-file ledger — .planning/phases/251-register-integrity
  scan list: 281 rows · subject: 17 files · watched: 0
ledger gate OK — every watched file has a row.
exit=0
```

No `[no-row]`, exactly as `251-CONTEXT.md` predicted, and **no spurious ledger row was added for
tooling**. ⚠ But note `watched: 0` beside `subject: 17`: the gate's WATCHED filter is `backend/app/`
and `frontend/src/` only, so `ledger gate OK` here means *"nothing was checked"*, not *"everything
checked out"*. That is the `subject: 0 files · ledger gate OK` shape from Phase 242 one field over,
and it is recorded rather than fixed — it is a fact about that gate's subject-side guard
(`251-RESEARCH.md` §4.4), not about this phase.

### ⭐ The gate reproduces D-20's rulings instead of transcribing them

The duplicate-id output derives, from git, the same two tie-breaks CONTEXT.md recorded by hand:
`SEED-231` → `decision-coverage-gate-…` older by 62m 56s (CONTEXT: *"63 min"*); `SEED-253` →
`mobile-has-no-drawer-…` older by 13h 24m 06s (CONTEXT: *"13h 24m"*). Git was consulted on exactly
**2 of 8** pairs and **printed that it had been**, so no reader takes the choice on trust.

### ⚠ `SEED-001` carries no date at all

Neither `created:` nor `planted:` — surfaced by RED 5, which printed `(NO DATE)` for both members of
the planted pair. **`seedDate()` is not total**, and Plan 02 must not assume it is.

### ⚠ STATE.md's `progress:` frontmatter is internally inconsistent

`completed_phases: 1 / total_phases: 12` and `percent: 8`, while ROADMAP reads *"4 / 5 phases
complete"* for v4.2. Untouched except for `completed_plans: 6 → 7` and the activity fields —
correcting the rest is outside this plan's boundary, but it is exactly the class of register rot
`REG-01..03` exists to end, one file over. Flagged for Plan 04 or the phase close.

---

## Interfaces published (consumed by Plans 02-04)

```
node scripts/check-seeds-register.cjs                    # scan   — exit 1 today
node scripts/check-seeds-register.cjs --files a.md b.md  # per-file, no count floor
node scripts/check-seeds-register.cjs --phase 251        # trigger sweep — "0 seeds matched" today
node scripts/check-seeds-register.cjs --self-test        # 6/6 arms PASS

module.exports = { frontmatter, readKey, readList, keyValue, stripComment, readRegister,
                   assertAccounting, skippedTotal, analyse, STATUS_ENUM, REQUIRED_KEYS,
                   HarnessError, norm, unquote, seedDate, statusToken, statusNote }
```

⭐ **`frontmatter(text)` returns the whole `match` object**, so `m[0].length` is the block-end string
offset Plan 02 converts with `Buffer.byteLength` to slice the body Buffer for D-11's md5 proof.
⛔ Returning the bare captured string would force `text.indexOf(block)`, which returns `0` on an empty
frontmatter block and silently mis-slices that file's body.

⚠ **S-5 same-commit sync rule is now live:** `STATUS_ENUM` and `REQUIRED_KEYS` in this file and the
enum comment in `.planning/seeds/TEMPLATE.md` (Plan 02 creates it) are ONE PAIR. Change both, or
neither.

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `--self-test` | exit **0**, `self-test 6/6 arms PASS` |
| 2 | scan over the live register | exit **1**: 8 `[duplicate-id]`, 5 `[no-frontmatter]`, 396 `[missing-key]`, 27 `[unknown-status]` |
| 3 | `git status --porcelain .planning/seeds/` | **empty** — not one byte of the register changed |
| 4 | `check-hot-file-ledger.cjs 251` | exit **0**, no `[no-row]` (see the finding above re `watched: 0`) |
| 5 | `require()` of the gate | prints nothing, exits 0, three functions resolve |
| 6 | dependency audit | `require(` matches `fs`, `path` and (lazily) `os`, `child_process` — no third party |
| 7 | T-251-03 write audit | all 4 write calls inside `runSelfTest`, under `mkdtempSync`, boundary-guarded |

## Self-Check: PASSED

```
FOUND: scripts/check-seeds-register.cjs
FOUND: .planning/phases/251-register-integrity/251-GATE-BASELINE.md
FOUND: 9e15ab3f4
FOUND: f683ab4ab
FOUND: b38bd8444
```

## TDD Gate Compliance

Plan-level `type: execute` with three `tdd="true"` tasks. Commit sequence is
`feat` → `feat` → `test`, not `test` → `feat`. ⚠ **Stated rather than hidden:** the RED drives for
Tasks 1 and 2 are the house gate-script method (plant a defect / point at a collapsed set → run →
capture → restore), executed and captured verbatim above **before** each behaviour was trusted, and
RED 1 was executed **before the file existed at all**. The `test(...)` commit at `b38bd8444` is what
makes those drives re-runnable forever. There was no test framework to drive first, because — measured
at research — **no `check-*.cjs` in this repo has ever had one.** This plan is the first.
