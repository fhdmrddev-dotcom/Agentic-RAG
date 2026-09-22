---
phase: 254-independent-review-of-249-253
plan: 04
subsystem: planning-registers
tags: [debt-06, independent-review, agents-md-6.3, register-integrity, agent-bus, roadmap, requirements]

requires:
  - phase: 254-01
    provides: the five bus asks amended in place with the 2026-09-24 deadline and the rank 251 → 253 → 252 → 249 → 250
  - phase: 254-02
    provides: 251-REVIEW.md — the self-assessed quality floor over the one phase with no review artifact
  - phase: 254-03
    provides: five *-REVIEW-REFUSAL.md drafts, graded, with one byte-identical ADOPTED READING
provides:
  - "a sweep counting `independent_review` finds FIVE rows where it found four — 251 stopped being invisible"
  - "all five values still read `owed`, asserted by yaml.safe_load rather than by grep"
  - "DEBT-06's text amended into two RE-DERIVED clauses (ten unmet · four accounted), box still unticked"
  - "seven ROADMAP rows carrying the new verdict FIRST and the prior verdict verbatim beside it"
  - "254-REVIEW-INDEX.md — the operator's single document, with five answer+close pairs pre-filled and unrun"
affects: [complete-milestone, verify-work-254, the next phase that touches DEBT-06, any sweep over independent_review]

tech-stack:
  added: []
  patterns:
    - "a register state goes in a KEY, its reasons in the COMMENT — prose is invisible to every scan"
    - "a correction sits BESIDE its original (— **SUPERSEDED VERDICT FOLLOWS:**), never over it"
    - "re-derive a requirement's list from the files at write time; never re-type it from a table"
    - "report the present-but-owed set and the ABSENT-key set as two figures, never summed"

key-files:
  created:
    - .planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md
  modified:
    - .planning/phases/249-the-model-you-actually-run/249-VERIFICATION.md
    - .planning/phases/250-run-honesty-the-residue/250-VERIFICATION.md
    - .planning/phases/251-register-integrity/251-VERIFICATION.md
    - .planning/phases/252-close-the-v42-audit-gaps/252-VERIFICATION.md
    - .planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-VERIFICATION.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

decisions:
  - "239 was ADDED to DEBT-06's unmet clause: it reads `independent_review: owed` on disk and the requirement never named it. Found by the derivation, not by the plan."
  - "The plan's own acceptance fence for `no flips` is DEFECTIVE and was reported rather than worked around: it cannot tell the VALUE from the explanatory comment. The value-only reading and yaml.safe_load were used instead, both published."
  - "The `⚠ 7 / 8 v4.2 phases closed` counts line was left byte-identical. A numerator moves when a phase CLOSES; that is /gsd:verify-work's call, never a plan's."
  - "SEED-177 routed NOT FOLDED (a path collision on ROADMAP.md) and left byte-unchanged."
  - "BUG-260916-01 stays `status: open`, named as an INPUT to 249's review and deliberately not folded — 254 fixes nothing."

metrics:
  duration: ~1h40m
  completed: 2026-09-17
  tasks: 3
  commits: 6
  files_changed: 10
---

# Phase 254 Plan 04: The registers say what is true — and the box is still empty

**One-liner:** Five `*-VERIFICATION.md` rows where a sweep found four, `DEBT-06` amended into two
re-derived clauses instead of ticked, seven ROADMAP rows appended to rather than overwritten, and one
index in front of the operator with five `answer`+`close` pairs claude did not run.

## What shipped

| Task | Commit | What changed |
|---|---|---|
| 1 | `3a531f796` | the five `*-VERIFICATION.md` frontmatters — **ADD** on 251, amend on four, **zero flips** |
| 2 | `477c14098` | `ROADMAP.md` (7 rows) + `REQUIREMENTS.md` (`DEBT-06` text + 2 coverage rows) |
| 3 | `97b5dc6ae` | `254-REVIEW-INDEX.md` — the operator's list, and the phase's own hygiene sweeps |
| — | `05e6a9110` + `3017852ea` | `254-04-SUMMARY.md` and its self-check |
| — | `c9db0cc84` | `STATE.md` — plan 4 / 4; plan counts 27 → 31 on BOTH sides (254 four plans had never been counted); phases HELD at 7 / 8 because 254 is executed, not verified |

**The deliverable in one number: a sweep of the five registers returned `4` before this plan and
returns `5` after.** `251-VERIFICATION.md` had carried no `independent_review` key for the phase's
entire life, so every count of the field silently omitted it — the same invisibility class as a hot
file with no ledger row. The key was **ADDED**, together with `builder:` and `reviewer:`, both also
absent.

⛔ **Nothing was flipped to `done` or `refused`, and `DEBT-06` was not ticked. That is the deliverable,
not a shortfall.** No §6.3 review has run and no refusal has been ruled on.

---

## Task 2A — the derivation, published with its command and its verbatim output

⛔ **Re-derived from the files at execution time (D-02). Deliberately INLINE and barred from
`scripts/`** — a committed script that reads `independent_review` is precisely the gate M-7 / S-1 say
must not be built inside a review phase (D-11 / G-7); the absence is a finding to record, not a hole
to close here.

```bash
# Scope: every phase DEBT-06 names (238-246) + the 249-253 arm + ANY phase whose
# independent_review key is present and not discharged (this last arm is what finds 239).
for p in 238 239 240 241 242 243 244 245 246 249 250 251 252 253; do
  f=$(ls .planning/milestones/*/$p-*/$p-VERIFICATION.md .planning/phases/$p-*/$p-VERIFICATION.md 2>/dev/null | head -1)
  if [ -z "$f" ]; then NO_FILE="$NO_FILE $p"; continue; fi
  v=$(grep -m1 "^independent_review:" "$f" | sed 's/^independent_review:[[:space:]]*//' | sed 's/#.*//' | tr -d '[:space:]')
  if [ -z "$v" ]; then KEY_ABSENT="$KEY_ABSENT $p"; continue; fi
  case "$v" in done|complete|refused) ACCOUNTED="$ACCOUNTED $p=$v";; *) PRESENT_NOT_DONE="$PRESENT_NOT_DONE $p=$v";; esac
done
```

```
present-but-not-discharged : 239=owed 242=false 249=owed 250=owed 251=owed 252=owed 253=owed
key ABSENT ENTIRELY        : 241 244
no *-VERIFICATION.md at all: 245
already accounted for      : 238=complete 240=complete 243=refused 246=done
derive-exit:0
```

⛔ **The two owed figures are reported SEPARATELY and are never summed.** *Present but not
discharged* is **7 rows**; *key absent entirely* is **2 rows**; *no verification file at all* is
**1 row**. ⭐ **The `key ABSENT` bucket is the half a `grep 'independent_review: owed'` cannot see,
and it is exactly why 251 was invisible.**

### ⚠ The derivation found a row `DEBT-06` had never named: **`239`**

`239-VERIFICATION.md` reads `independent_review: owed` on disk. The requirement's original wording —
*"Phases 238, 240, 241 and 242-246"* — does not name it, and neither does D-01's 249-253 arm. **It has
no bus ask either.** It was added to the amended requirement's unmet clause and routed as a finding in
the index (**recommended: next phase**). *A hand-typed list is the defect this family keeps re-paying.*

### ⭐ M-11's table REPRODUCES exactly — no row moved since the plan was written

The plan warned that a disagreement between the live derivation and M-11's table would be *the check
working*. It did not disagree: the plan-time fence re-derived `unmet: 241 242 244 245 · accounted:
238 240 243 246`, identical to M-11. What the **wider** scope added was `239` and the confirmation
that `245` has no file at all.

---

## Task 1 — what the five comments say, and the one thing they do not

Each of the five `independent_review:` lines now carries an inline comment in the `243-VERIFICATION.md`
pattern, naming in order: **who is owed it** (the `BUS-NNN`, filed 2026-09-16, amended in place
2026-09-17, still `[OPEN]`) · **the deadline** (`2026-09-24`) · **the drafted refusal's exact path** ·
**what the marker is NOT** · **the re-open trigger** (the ask being answered at any time, at which
point the verdict artifact is `<phase>-REVIEW-IND.md` and the draft is void) · **the full audit**
(`254-REVIEW-INDEX.md`).

| Assertion | Reading |
|---|---|
| `grep -h '^independent_review:'` over the five | **5** (was **4**) |
| all five values | **`owed`** — `yaml.safe_load` returns the string `owed` five times |
| `grep -h '^verification_mode:' \| grep -c self-verified` | **5**, unchanged |
| every line contains `2026-09-24`, `BUS-`, and its own `*-REVIEW-REFUSAL.md` path | **5 / 5** |
| `251-VERIFICATION.md` now carries `builder:` and `reviewer:` | **1 / 1** each, both previously absent |
| `253-VERIFICATION.md` still reads `status: gaps_found` | **yes** (M-4 — its ROADMAP row reading COMPLETE does not refute it) |
| `git diff --numstat` on the five | `1/1 · 2/1 · 3/0 · 1/1 · 1/1` — **no line was removed except the four `independent_review:` lines genuinely rewritten** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The plan's own `no flips` acceptance fence is DEFECTIVE, and it was reported rather than worked around**

- **Found during:** Task 1 verification.
- **Issue:** the plan's fence reads
  `grep -h "^independent_review:" $F | grep -cE "(done|refused)"` and requires `0`. It returns **`5`** —
  because the plan's own `<action>` block *requires* every comment to say *"a refusal, if ruled, would
  make it `refused`; only a §6.3 review makes it `done`"*. **The fence cannot tell a VALUE from its own
  explanation**, so it fires on the very sentence that forbids the thing. This is the same lexer class
  Phase 253 fixed for SQL comments (`_strip_sql_comments`, `line.find("--")`), one register over, and
  the same shape as this plan's own deliberate exclusion of `254-*-PLAN.md` from the
  `review_type: independent` fence.
- **Fix:** ⛔ **The comment content was NOT weakened** — it is required by the plan's action and it is
  the part a reader needs. Three independent readings were driven and all three are published:

  | Reading | Command | Result |
  |---|---|---|
  | plan as written (substring anywhere on the line) | `grep -h '^independent_review:' $F \| grep -cE '(done\|refused)'` | **5** ⛔ defective |
  | value only, comment stripped | `grep -h '^independent_review:' $F \| sed 's/#.*//' \| grep -cE '(done\|refused)'` | **0** ✅ |
  | parsed | `yaml.safe_load(frontmatter)['independent_review']` ×5 | **`'owed'` ×5** ✅ strongest |

- **Files modified:** none — this is a fence defect, not a content defect.
- **Commit:** `3a531f796` (the content); recorded here.

**2. [Rule 3 — Blocking] `REQUIREMENTS.md` is CRLF; the plan's anchor could not match**

- **Found during:** Task 2C.
- **Issue:** the first write attempt asserted on a `\n`-terminated anchor and found **0** occurrences.
  Measured: `.planning/REQUIREMENTS.md` is `\r\n` throughout, while the five `*-VERIFICATION.md` files
  and `ROADMAP.md` are `\n`. A mixed-ending tree is exactly what made wave 2's whole-file md5
  comparison report a false tamper.
- **Fix:** the writer now **detects** the file's line ending and uses it for every inserted line, so
  no mixed-ending line was introduced. Verified by `git diff --numstat` showing `29/1` — the 27 added
  bullet lines, the extended coverage row (`1/1`) and the new untick row (`+1`), with no whole-file
  rewrite.
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** `477c14098`.

⚠ **A second CRLF consequence, recorded because it makes a fence weaker than it looks:** the plan's
`DEBT-06` bullet-block extractor is `sed -n "/^- \[ \] \*\*DEBT-06\*\*/,/^$/p"`. On a CRLF file `/^$/`
never matches (the "blank" line is `\r`), so `$B` runs to **end of file** rather than to the end of the
bullet. The fence still passes on every arm — both clause lines are unique in the file — but its
`245 carries no` check is weaker than intended, since it would be satisfied by that literal appearing
**anywhere below** the bullet. It is in fact inside the bullet; that was confirmed by reading, not by
the fence.

### ⚠ Two plan-time claims that did not reproduce (corrections, not failures)

**1. `250-VERIFICATION.md`'s `owed:` list had FIVE entries, not four.** The plan's acceptance criterion
says *"exactly one more entry than before and the original four are byte-unchanged."* Measured: the
list held **5** and now holds **6**. One entry was appended and the prior **five** are byte-unchanged.

**2. The orchestrator's briefing said `grep -c "independent_review: \(done\|refused\)"` across *every*
`*-VERIFICATION.md` returns 0. It returns 0 across `.planning/phases/` and TWO across `.planning/`.**
`243-VERIFICATION.md` reads `refused` and `246-VERIFICATION.md` reads `done`, both in
`.planning/milestones/v4.1-phases/`, both written **2026-09-16 by the DEBT-06 audit** — pre-existing,
not touched here. ⭐ **The criterion as intended holds** (nothing in this plan's scope reads discharged);
what is corrected is the *scope* of the sweep. A claim about a register is a claim: it was driven.

---

## Task 2B/E — the ROADMAP, appended to and never overwritten

Seven rows changed: the five Progress rows for 249-253, 254's own Progress row (`3/4` → **`4/4`**), and
the `### Coverage` table row for 254 whose *"discharges the standing gate `DEBT-06`"* wording
contradicted this phase's own success criteria.

| Assertion | Reading |
|---|---|
| all six distinctive row literals still present | **6 / 6** — asserted by content, not by eyeballing a diff |
| `— **SUPERSEDED VERDICT FOLLOWS:**` occurrences | **3 → 10**, delta **+7** exactly (captured before, not assumed) |
| each of the five rows contains `2026-09-24` | **1 each**, and 254's own row too |
| Progress-table `^\| ` row count | **86 → 86** |
| `⚠ **7 / 8 v4.2 phases closed …` | **byte-identical to `git show HEAD:`** — md5 `72a230988a502bf4b29a8d325d2d8936` on both sides |
| `git diff --numstat .planning/ROADMAP.md` | **7 / 7** — seven lines rewritten, nothing else |

⛔ **The counts line was deliberately left alone.** The numerator moves when a phase **closes**, and
that is `/gsd:verify-work`'s call; moving it here would be a phase claiming its own close.

---

## Task 2C/D — `DEBT-06` amended, not ticked

The original sentence is **preserved verbatim** and the amendment sits under it, because *"it names not
one phase this milestone built"* is the finding, not a typo to fix.

```
**Still unmet (re-derived 2026-09-17):** 239 `owed` · 241 key absent · 242 `false` · 244 key absent ·
245 has no verification file · 249 `owed` · 250 `owed` · 251 `owed` (the key was ABSENT and was ADDED
by `254-04`) · 252 `owed` · 253 `owed` — **ten rows**.
**Already accounted for (re-derived 2026-09-17):** 238 `complete` · 240 `complete` · 243 `refused` ·
246 `done` — **four rows**, and ⛔ not one of them may be named as owed again.
```

⛔ **The range token `242-246` appears in neither clause** — it merges four discharged rows with two
unmet ones, which is the false sentence the fence exists to stop. ⛔ **The two clauses are on separate
lines**, which the plan found necessary by driving its own fence: sharing a line made each clause
unreadable in isolation and reported `238` as unmet when the file said the opposite.

The bullet also states, on the plan's instruction: that **245 carries no** `*-VERIFICATION.md` at all
so it holds no value in any state; that the amendment **widens** the requirement — from the eight rows
the original wording covered to **fourteen** (ten unmet + four accounted); that 254 closes only the
**249-253 arm** and with *drafted refusals awaiting a ruling* rather than reviews; and that the box
stays `- [ ]`, quoting `ROADMAP.md:271` verbatim.

⚠ **One figure in the plan did not reproduce and is corrected rather than echoed.** D-03 says the
amended requirement *"covers ten phases"*. The derivation reaches **fourteen** rows (ten unmet + four
accounted). **Ten is the size of the UNMET half only.** The bullet states fourteen and shows its work.

Coverage rows: the `DEBT-06` row gained a *STILL PENDING after Phase 254* sentence; the
`LEFT UNTICKED at the 251-04 sweep` row is **preserved verbatim** with a new sibling row beneath it
(`STILL UNTICKED at the 254-04 sweep, and now for a SECOND, DIFFERENT reason`). `26 requirements` is
unmoved; `- [ ] **DEBT-06**` reads **1**, `- [x]` reads **0**.

---

## Task 3 — the index, and the sweeps

`254-REVIEW-INDEX.md` follows the `251-BUS-TRIAGE.md` skeleton: a *what claude did NOT do* table where
every claim carries its command and its reading → `## The five rows, measured` → `## The findings,
triaged` → `## ⛔ The structural finding` → `## ADOPTED READING` → `## The flip recipe` →
`## The commands — ⛔ YOURS TO RUN, NOT CLAUDE'S` → `## What this document changed on disk` →
`## Gate readings`.

⚠ **`bus_writes: 0` was deliberately NOT copied from the analog.** Plan `254-01` *did* write to
`.agent-bus/OPEN.md` — five item bodies amended in place — so that phrase would have been a false
claim. The two honest keys are `bus_items_opened_answered_or_closed: 0` and
`bus_item_bodies_amended: 5`, and the first is backed by
`git diff -U0 .agent-bus/OPEN.md | grep -c '^[-+]### '` → **0**, not by a phrase.

**Ten findings, each with exactly one recommended disposition:** the **7** from `251-REVIEW.md`
(`grep -cE '^### (CR|WR|IN)-[0-9]'` → 7, matched), plus **3 authored by 254 itself**, labelled as such:

- **254-F1** — `independent_review` has **two spellings of one state**: `238=complete`, `240=complete`,
  `246=done`. A sweep written against one word silently misses the other. → *next phase*
- **254-F2** — `242` reads **`independent_review: false`**, a value in no register's vocabulary.
  `DEBT-06-AUDIT.md` already noted that *"a bare `false` names neither who nor why"* — and it is still
  there. → *next phase*
- **254-F3** — **245** has no `*-VERIFICATION.md` at all, yet `DEBT-06-AUDIT.md` counts it among the four
  unmet while `DEBT-06-REFUSALS.md` lists it among the five refused: **two registers hold a row that has
  no file to hold it.** → *accept now, re-open at `/gsd:complete-milestone`*

⛔ **None was repaired** — `git status --short .planning/milestones/` is empty; 238/240/241/242/243/244/246
are byte-unchanged. A vocabulary fix across ten phase files is a phase, not a review task.

**The structural finding, re-derived rather than quoted:**

```
$ grep -rn "independent_review" scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md
$ echo "grep-exit:$?"
grep-exit:1
```

**No matches.** The register flip is documentation, not an enforced state, and `DEBT-06-AUDIT.md`
measured the decay rate on a real row: **Phase 240's marker went stale in ten hours.** ⛔ Building a
gate over the field was **considered and rejected here** as new capability inside a review phase
(D-11 / G-7); it is recorded as an OPEN finding with a re-open trigger (the next phase touching
`DEBT-06`, or `/gsd:complete-milestone`), not closed.

**`## ADOPTED READING` is byte-identical to the five drafts** — section-body md5
`08fe04f7d9438e28d4734a71c5ba0240`, 1416 bytes, **one distinct value across six files**.

### Gate readings — every exit code captured WITHOUT a pipe

| Gate | Reading |
|---|---|
| `check-seeds-register.cjs --phase 254` | **exit 0** · `297/297 parsed · 0 duplicate ids` · ⭐ **`4 plan file(s), 15 path(s)`** — non-zero on both, where the discuss-time run was green over `0 plan file(s), 0 path(s)` · **1 seed matched: `SEED-177`** |
| unswept seed figures | **`134` carry no `trigger_when` at all** · **`114` carry prose but no structured trigger** — ⛔ two figures, never summed |
| `check-gap-closure-rounds.cjs 254` | **exit 0** · `plans: 4 total · 0 gap-closure` · `G-7 clear` |
| `check-hot-file-ledger.cjs <254 dir>` | **exit 0** · `scan list: 287 rows · subject: 15 files · watched: 0` |
| `check-verification-honesty.cjs` | **exit 0** · `subject: 16 files (9 archived + 7 live)` · `OV-SOLO-01-status: retired-2026-09-13 — claims-review arm SKIPPED` · `honesty gate OK — 16/16 subject files carry verification_mode, 0 frontmatter review claims.` |
| reported-bugs | `grep -rl 'folded_into: 254' .planning/reported-bugs/` → **nothing** |

⛔ **The ledger gate's `subject: 15` is non-zero — it genuinely parsed this phase's plans** (it was
measured elsewhere printing `subject: 0` over a CRLF plan and exiting 0, a green over nothing). ⛔ **But
`watched: 0` means its green says *nothing to see*, never *clear* (M-10)** — its `WATCHED` set is
`backend/app` + `frontend/src` only. **It cannot be cited as coverage for this phase.**

⛔ **`SEED-177` ROUTING: NOT FOLDED — a path collision, not a trigger.** It matched only on the path
`.planning/ROADMAP.md`; `SEED-177` is about MCP connections usable in chat and workflows, and 254 ships
no capability at all. **The seed is byte-unchanged** — `git status --short .planning/seeds/` is empty.
The gate's own caveat is recorded verbatim in the index: *"the phase declares NO surfaces, so
`trigger_surfaces` matched nothing here — that is a fact about the PHASE, not about the register."*

⛔ **`BUG-260916-01` stays `status: open`**, named as an INPUT to 249's review and deliberately not
folded, because **254 fixes nothing**.

---

## ⚠ The PostToolUse honesty hook did NOT fire on any of the five register edits

The plan expected it in the transcript (M-9). It did not appear, and the reason is measurable rather
than mysterious: `.claude/settings.json` registers that hook on **`Write|Edit`**, and all five
`*-VERIFICATION.md` edits were authored through a script run from Bash. ⭐ **That is the same
matcher-blindness class Phase 253 fixed for `MultiEdit`, one tool over — a path/matcher filter that
silently covers nothing when the edit arrives by another route.** The gate was therefore run **by
hand** and its output is recorded verbatim above (exit 0, `subject: 16`). **Recorded as an observation
and routed nowhere:** it is not this phase's to fix (D-11 / G-7), and the hook is advisory — it never
blocks.

---

## Authentication gates

None.

## Known Stubs

None. This plan ships no code; every artifact is a register write or a document, and every claim in
them is backed by a command whose reading is published.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change is in this plan's blast
radius — `git status --short backend/ frontend/` is empty.

---

## What is still owed after this plan

1. ⛔ **Five `independent_review` rows still read `owed`, and that is correct** — a §6.3 review or an
   operator ruling is what changes them. `BUS-249` / `BUS-250` / `BUS-251` / `BUS-256` / `BUS-257` are
   all still `[OPEN]`, behind a 9-item `to:gemini` queue that has not moved since 2026-09-16.
2. ⛔ **`DEBT-06` is unticked and covers fourteen rows.** The older arm — 239 · 241 · 242 · 244 · 245 —
   is genuinely unmet and outside D-01's scope; `239` has no ask at all.
3. ⚠ **Ten findings are triaged and none is fixed.** Two criticals (`CR-01`, `CR-02` of
   `251-REVIEW.md`) are recommended *next phase*.
4. ⚠ **Nothing reads `independent_review`.** Every row above is an assertion no gate re-checks; the
   measured decay rate is ten hours.
5. ⚠ **Three vocabulary defects** (`complete` vs `done`; a bare `false`; a row with no file) are routed
   and unrepaired by design.

---

## Self-Check: PASSED

- **9 / 9 files present on disk** — `254-REVIEW-INDEX.md`, `254-04-SUMMARY.md`, the five
  `*-VERIFICATION.md`, `ROADMAP.md`, `REQUIREMENTS.md`.
- **2 / 2 new files tracked in `HEAD`** (`git ls-tree -r --name-only HEAD`).
- **4 / 4 commits resolve** — `3a531f796` · `477c14098` · `97b5dc6ae` · `05e6a9110`.
- **No deletions** in any commit — `git diff --diff-filter=D --name-only HEAD~1 HEAD` empty at each.
- ⛔ **`.agent-bus/OPEN.md` and `.planning/seeds/` byte-unchanged** — `git status --short` empty for both.

---

## ⛔ Two register verbs deliberately NOT run

- **`requirements mark-complete DEBT-06`** — ⛔ **not run, and running it would have been the exact
  failure this plan exists to prevent.** The plan's frontmatter lists `requirements: [DEBT-06]`, but
  D-02 / D-03 and `ROADMAP.md:271` all say the requirement is **amended, never ticked** at this close.
  The box reads `- [ ]`.
- **`roadmap update-plan-progress` / any `state.*` verb** — ⛔ not called. `ROADMAP.md` and `STATE.md`
  were **hand-edited** and the diffs read, per this project's standing rule: `state.*` has corrupted
  `STATE.md` seven times and `phase.add` wrote to the wrong ROADMAP section twice in two days.
  `STATE.md`'s frontmatter was re-validated with `yaml.safe_load` after the edit.
