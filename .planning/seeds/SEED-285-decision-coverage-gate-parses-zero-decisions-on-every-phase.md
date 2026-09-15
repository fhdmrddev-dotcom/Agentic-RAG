---
seed_id: SEED-285
title: The BLOCKING decision-coverage gate parses ZERO decisions on every phase this project has written — it reports `passed: true, skipped: true, "no trackable decisions"` because one regex demands a bullet shape this project has never used
created: 2026-09-16
planted_during: Phase 251 plan-phase, running the §13a gate the workflow calls BLOCKING against a CONTEXT.md carrying 20 locked decisions
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-275 — a gate green because its SCAN SET is wrong (three literal paths, 20 files existing).
    ⚠ SAME FAMILY, THIRD AXIS. 274 is a gate whose THRESHOLD is wrong; 275 a gate whose SCAN SET is
    wrong; this is a gate whose PARSER is wrong. All three are sound in logic and prove nothing.
    ⭐ And this one is worse in one specific way: 275's gate at least printed `subject: 3 files`, a
    number a reader could notice was too small. This one prints `skipped: true` with a REASON that
    reads like a legitimate finding about the input — *"no trackable decisions"* — so the failure
    disguises itself as a fact about the phase rather than a fact about the gate.
  - SEED-274 — a gate pinned to an integer over a value that moves.
relates_to_registers:
  - "`.claude/get-shit-done/workflows/plan-phase.md` §13a — the step that calls this gate, and calls
    it BLOCKING in its own words: *'BLOCKING: refuse to mark phase planned when a trackable decision
    is uncovered'*, with `exit 1` on failure, and the rationale *'failing here is cheap… Catching
    that now beats discovering it after thousands of dollars of execution.'* It has never once been
    in a position to catch anything."
  - "`CLAUDE.md` § Workflow guardrails — *'a rule that exists and is not applied is the same as no
    rule'*, a finding this project records as already paid for twice. This is the third."
  - "`CLAUDE.md` § hot-file ledger — *'a gate nobody has seen fire is not a guard'*. This gate has
    never fired, in either direction, on any phase."
  - "Phase 251 `251-CONTEXT.md` D-04 — the four-arm RED drive plus the counterfactual, written
    BECAUSE of exactly this class. The phase specifying that discipline was itself waved through by
    a gate exhibiting the defect."
trigger_when: >
  ANY of: (1) any phase runs `/gsd:plan-phase` and the §13a gate reports `skipped: true` with reason
  `no trackable decisions` while its CONTEXT.md visibly contains `D-NN` bullets — that is this bug,
  every time; (2) `get-shit-done-cc` is updated and `sdk/dist/query/decisions.js` changes — check
  `bulletRe` first, the fix may have landed upstream or the shape may have moved again; (3) the
  CONTEXT.md decision-bullet house style is changed for any reason, which would silently change
  which side of this mismatch we are on; (4) someone proposes trusting `check.decision-coverage-plan`
  or `check.decision-coverage-verify` as evidence in a verification, a review, or a phase closeout;
  (5) a decision is discovered to have been dropped between discuss-phase and execute-phase — this
  gate is the mechanism that was supposed to prevent that and it is inert.
---

# SEED-285 — the gate that cannot see a single decision, on any phase, ever

## What is true, measured 2026-09-16 at `d0b0f3474`

`/gsd:plan-phase` §13a calls `check.decision-coverage-plan` and describes it, in the workflow's own
words, as **BLOCKING** — it `exit 1`s rather than let a phase be marked planned while a discuss-phase
decision is uncovered. Run against Phase 251, whose `251-CONTEXT.md` `<decisions>` block carries
**twenty** locked decisions (`D-01` … `D-20`):

```
$ gsd-sdk query check.decision-coverage-plan .planning/phases/251-register-integrity \
                                             .planning/phases/251-register-integrity/251-CONTEXT.md
{
  "passed": true,
  "skipped": true,
  "reason": "no trackable decisions",
  "total": 0,
  "covered": 0,
  "uncovered": [],
  "message": "No trackable decisions in CONTEXT.md."
}
```

**`total: 0` against twenty decisions.** And this is not a Phase 251 peculiarity — the same call
against every other phase of this milestone that has a CONTEXT.md:

```
247    total=0 covered=0 skipped=true reason=no trackable decisions
248    total=0 covered=0 skipped=true reason=no trackable decisions
249    total=0 covered=0 skipped=true reason=no trackable decisions
250    total=0 covered=0 skipped=true reason=no trackable decisions
```

⛔ **Four for four, plus 251. The gate has never parsed a decision this project has written.**

## The cause — one regex, and it is two characters of house style away

`sdk/dist/query/decisions.js:74` (installed at
`%APPDATA%/npm/node_modules/get-shit-done-cc/`, NOT the vendored `.claude/get-shit-done/` copy —
looking there finds nothing, which is its own small trap):

```js
const bulletRe = /^\s*-\s+\*\*D-(\d+)(?:\s*\[([^\]]+)\])?\s*:\*\*\s*(.*)$/;
```

It requires the colon **inside** the bold and **immediately** after the id, with at most an optional
`[bracketed tags]` group between them. Its own docblock gives the only shapes it accepts:

```
- **D-01:** Decision text
- **D-02 [tag1, tag2]:** Tagged decision
```

This project writes, and has always written:

```
- **D-01 (locked): structured trigger fields land BESIDE the prose, never replacing it.**
- **D-16 (locked, amends D-10): `status` stays a 10-value closed enum.**
```

Two mismatches, either one fatal: a **parenthetical** `(locked)` where only a bracket group is
allowed, and the bold closing **after the text** rather than after the colon. Driven directly:

```
$ node -e '<the regex above>, tested against four strings>'
false  ours (locked)
false  ours (amends)
true   SDK spec
true   SDK spec+tag
```

⭐ **The vocabulary is not wrong, the parser is narrow.** `(locked)` carries real information this
project uses deliberately — the same way `partially-answered` does one register over. Rewriting 250+
decision bullets to suit a regex would be the tail wagging the dog; widening the regex to accept an
optional parenthetical, and to allow the bold to close at end-of-line, costs one line.

## Why this is worse than an inert gate

1. **It reports a finding about the INPUT, not about itself.** `"no trackable decisions"` reads as
   *"this phase recorded no decisions"* — a plausible, even virtuous-sounding state. Nothing in the
   output invites suspicion. Compare `SEED-275`, where `subject: 3 files` was at least a number a
   reader could see was too small.
2. **`passed: true` means the workflow proceeds.** §13a's `jq -e '.data.passed == true'` is satisfied
   by the skip, so the `exit 1` path is unreachable. The gate cannot fail, and a gate that cannot
   fail is not a gate.
3. **It has an identical twin.** `check.decision-coverage-verify` shares `parseDecisions` (same file,
   lines 268 and 418), so `/gsd:verify-work`'s decision check is inert by the same cause. Both ends
   of the discuss→plan→execute translation are unguarded, which is precisely the gap issue #2492
   opened this gate to close.
4. ⚠ **It was quoted as evidence.** Phase 251's own planning cited D-01…D-20 coverage as verified.
   The citation happens to be TRUE — coverage was re-derived by hand, twice, and all twenty ids
   appear in plan `must_haves` — but it was true by accident of diligence, not because the gate said
   so. **A green gate and a correct answer coexisted, and only one of them was doing any work.**

## The fix, and the thing to do first

⛔ **Drive it RED before trusting the repair** — the discipline Phase 251's D-04 exists to encode.
The counterfactual arm is the one that matters: after widening the regex, a decision cited by NO plan
must make the gate **exit 1**. A gate that parses twenty decisions and passes them all has only
proven it can parse, not that it can refuse.

1. Widen `bulletRe` to accept an optional parenthetical after the id and a bold that closes at end of
   line. ⚠ It lives in the **globally installed** package, so a local edit is lost on the next
   `npm update` — this wants an upstream issue/PR, with a note recorded here either way.
2. Until then, treat both decision-coverage verbs as **non-evidence**. Re-derive coverage by hand
   (`for i in $(seq -w 1 NN); do grep -ho "D-$i" <phase>/*-PLAN.md | wc -l; done`) and say in writing
   that the gate was skipped, never that it passed.
3. Consider whether `skipped: true` should ever imply `passed: true` in a gate the workflow calls
   BLOCKING. A skip is an absence of evidence; this conflates it with evidence of absence.

## What this seed is NOT

Not a claim that any decision was actually dropped. Phase 251's twenty are all cited, measured. The
loss is the *guarantee*, not (so far as anyone has checked) any specific decision — and nobody has
checked 247-250, whose gate readings were equally vacuous.

⚠ **Note for Phase 251's own migration:** this seed's `trigger_when` names no repo path an extractor
can lift — the subject is a verb in an installed npm package. It will land in D-18's second number,
*"carries prose but no structured trigger"*, and that is the honest place for it.
