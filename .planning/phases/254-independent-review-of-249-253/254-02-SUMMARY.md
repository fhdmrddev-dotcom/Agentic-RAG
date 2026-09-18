---
phase: 254-independent-review-of-249-253
plan: "02"
subsystem: planning-registers
tags: [review, debt-06, seeds-register, self-assessed]
requires:
  - ".planning/phases/251-register-integrity/251-VERIFICATION.md"
  - ".planning/DEBT-06-AUDIT.md"
  - "scripts/check-seeds-register.cjs"
provides:
  - "the self-assessed quality floor over Phase 251 (251-REVIEW.md)"
affects:
  - ".planning/phases/251-register-integrity/"
tech-stack:
  added: []
  patterns:
    - "RED drive: plant the defect the arm claims to catch, run the arm, restore by byte-copy, prove with an identical md5 pair"
    - "blob-vs-blob body comparison via `git ls-tree` + `git show`, never a working-tree read (core.autocrlf)"
    - "extract the fenced command and RUN it — grep cannot audit a wiring"
key-files:
  created:
    - ".planning/phases/251-register-integrity/251-REVIEW.md"
  modified: []
decisions:
  - "The standard-depth pass was conducted INLINE by the executor because no agent-spawn tool was available in this worktree; scope, instrument discipline and output shape are unchanged, and the file's `review_type` is `self-assessed` either way (claude in both cases)."
  - "251-VERIFICATION.md's '91 (independently re-counted as 90)' was driven and the LEDGER is right — 90 is `git grep -c` counting LINES. Recorded as a finding with disposition `accept`, not corrected in place: a correction sits beside its original."
metrics:
  duration: ~50 min
  completed: 2026-09-17
  tasks: 3
  commits: 3
  findings: "2 critical · 0 blocker · 2 warning · 3 info"
---

# Phase 254 Plan 02: Phase 251 gets its quality floor — Summary

A standard-depth code-review pass over Phase 251's nine files, labelled in its own frontmatter as
the self-assessment it is, with every critical and warning driven against the tree before being
reported and every planted defect restored to an identical md5.

## What was built

`.planning/phases/251-register-integrity/251-REVIEW.md` — a file that did not exist before this
plan (`git log --diff-filter=A` names exactly one commit, `ecc83bf0b`), so D-09's do-not-overwrite
rule is satisfied by construction and M-3 is confirmed rather than contradicted.

| | |
|---|---|
| Depth | `standard` (config `workflow.code_review_depth`) |
| Scope | **9 files**, re-derived from Phase 251's four `*-PLAN.md` `files_modified` blocks |
| Range | `600e28dde..de6986fa2` — **10** build commits on those files, re-derived |
| Findings | **2 critical · 0 blocker · 2 warning · 3 info · 0 resolved_in_phase** |
| Verdicts | `still_live: 4 · fixed_since: 0 · refuted: 0 · not_driven: 0` |
| Registers flipped | **none** — `discharges_debt_06: false`, `BUS-249` stays OPEN |

## The findings, and their recommended routes

| id | one line | route |
|---|---|---|
| **CR-01** | `--self-test` prints `8/8 arms PASS` and the gate prints `297/297 carry all 5 required keys` with the `[missing-key]` check completely dead — D-09's contract has no counterfactual arm | next phase |
| **CR-02** | `TEMPLATE.md`'s "change all three, or change none" enum rule has zero executable enforcement; seven of ten values were deleted from the contract's only home and the gate exited 0 | next phase |
| **WR-01** | `seedDate()` is not total — 6 of 297 seeds carry neither `created:` nor `planted:`, so D-07's tie-break rule is underivable for them (null-safe at every call site; latent, not live) | next phase |
| **WR-02** | both GSD wirings sit in a vendored framework directory a framework update can revert, and no hook, CI workflow or gate would notice | next phase |
| **IN-01** | the `STATUS_ENUM` docstring says `superseded-id` "matches zero files"; Plan 03 of the same phase created eight | fast-fix |
| **IN-02** | `251-VERIFICATION.md`'s "re-counted as 90" is the figure that is off — the ledger's 91 is right, and the gap is lines-vs-occurrences, not rounding | accept |
| **IN-03** | the four real body diffs the verification counted were never named; they are `SEED-040 / 068 / 234 / 270`, not the three ids its phrasing suggests | accept |

## How the findings were driven

Five defects were **planted** and every one restored from a byte-copy taken before the edit, each
proven by an `md5sum` pair identical before and after:

| target | planted defect | result |
|---|---|---|
| `check-seeds-register.cjs` arm 1c | the stub carve-out reverted to a bare count | **arm 1c RED alone** (7/8, exit 1) |
| `check-seeds-register.cjs` arm 2b | `[id-in-heading]` short-circuited to `false &&` | **arm 2b RED alone** (7/8, exit 1) |
| `check-seeds-register.cjs` arm 4 | `if (hits.length)` → `if (true)` | **arm 4 RED alone** (7/8, exit 1) |
| `check-seeds-register.cjs` `[missing-key]` | the required-keys push short-circuited | ⛔ **8/8 PASS, exit 0 — the finding (CR-01)** |
| `migrate-seeds-frontmatter.cjs` body invariant | `writeAndVerify` forced to `ok: true` | **arm 5 RED alone** (6/7, exit 1) |
| `.planning/seeds/TEMPLATE.md` enum | 7 of 10 values deleted | ⛔ **gate OK, exit 0 — the finding (CR-02)** |

Non-destructive drives: both workflow fences extracted by line range and executed; the
`plant-seed.md` allocator extracted and executed (`MAX=290 NEXT=291`); the bus hook run; the D-11
body invariant re-derived blob-vs-blob at two commit pairs, reproducing the verification's
`{272, 0, 4, 8}` exactly and adding a stronger `{284, 0, 0, 0}` across the migration commit itself.

`git status --short` was empty for `scripts/`, `.claude/` and `.planning/seeds/` before every
commit, and `git diff --name-only <base> HEAD` names exactly one file.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The `gsd-code-reviewer` agent could not be spawned; the pass was run inline**
- **Found during:** Task 1
- **Issue:** The plan's action says *"spawn `gsd-code-reviewer` directly with an explicit file
  scope."* This executor's tool set is `Read / Write / Edit / Bash / Grep / Glob` — there is no
  Task or Agent tool, so no subagent could be dispatched.
- **Fix:** The standard-depth pass was conducted inline by the executor, against the same
  re-derived 9-file scope, the same four highest-value targets and the same three deliberate
  boundaries, producing the same output file in the same house shape.
- **Why this does not change what the file claims about itself:** the reviewer is claude in both
  cases, so `review_type: self-assessed` is correct either way and `discharges_debt_06: false`
  is unaffected. What is lost is the fresh-context framing a subagent would have had; that is
  recorded here rather than left implicit.
- **Files modified:** none beyond the review file itself.
- **Commit:** `ecc83bf0b`

**2. [Rule 1 — Bug in this plan's own inputs] `254-02-PLAN.md`'s build-commit list is wrong**
- **Found during:** Task 1, while re-deriving the scope as the plan instructed.
- **Issue:** `<interfaces>` names eight SHAs
  (`b38bd8444, 99f7ba5c7, b03c66441, 5fc75a0f0, 78c8cf010, f5125638b, 134cb4ffa, 81fab4927`).
  `git log --oneline 600e28dde..de6986fa2 -- <the nine files>` returns **ten** commits, and only
  **two** of the plan's eight (`b38bd8444`, `5fc75a0f0`) are among them.
- **Fix:** The re-derived list is published in `251-REVIEW.md` § *Scope, re-derived rather than
  inherited*, beside the plan's list rather than over it. ⛔ The PLAN.md itself was **not** edited —
  a plan is a record of what was asked.
- **Commit:** `ecc83bf0b`

**3. [Rule 1 — Bug in this review's own instrument] the first D-11 comparison read `.end` on a regex match**
- **Found during:** Task 2
- **Issue:** The first blob-vs-blob run reported **242 real body diffs** and looked like a large
  undisclosed D-11 violation. `gate.frontmatter()` returns a **regex match array**, not an object,
  so `.end` was `undefined` and `slice(undefined)` returned the whole file including frontmatter.
- **Fix:** Corrected to `m[0].length` — what `readRegister()` itself stores as `fmEnd`. The same
  comparison then read `284/284 identical`. ⭐ **A false critical was one commit away**, and it was
  the instrument that was wrong, not the code. Recorded in the review's `## Verified clean` beside
  Phase 251's own structurally identical near-miss from the other direction (`core.autocrlf`).
- **Files modified:** a scratchpad script only — nothing in the repository.
- **Commit:** `4a97fb293`

**4. [Rule 1 — a finding that refuted itself before it was written] the `SEED-286` mismatch**
- **Found during:** Task 1. The live `SEED-286` is titled *"a thread's folder scope cannot be
  changed once it starts"*, while `251-VERIFICATION.md` claims it was planted for BUS-040's
  `ChatArea.tsx` finding. This looked like a post-close collision.
- **Fix:** Driven before reporting. The seed's `relates_to` names `ChatArea.tsx:570`, `609-624`,
  `103,404` and `BUS-040` verbatim — **the verification is correct**, and the title simply
  describes the finding rather than the file. Recorded in `## Verified clean` as a confirmed claim,
  never escalated. This is the 2026-09-10 lesson applied: *each register only knows the one below
  it; the code is the bottom.*

## Known Stubs

None. This plan ships a document; it wires no data and renders no UI.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema was introduced or modified —
the plan's blast radius is one markdown file under `.planning/`.

## Requirements

`DEBT-06` — ⛔ **NOT satisfied and NOT ticked by this plan.** `DEBT-06-AUDIT.md`'s counting rule
makes this file a code-review pass; `251-VERIFICATION.md` keeps `verification_mode: self-verified`,
`BUS-249` stays OPEN, and `discharges_debt_06: false` is written into the artifact as an explicit
key so no later sweep can read the absence of a marker as an oversight.

## Self-Check: PASSED

- `FOUND: .planning/phases/251-register-integrity/251-REVIEW.md`
- `FOUND: ecc83bf0b` — task 1
- `FOUND: 4a97fb293` — task 2
- `FOUND: a33d4308b` — task 3
- `git diff --name-only 116f4b0bf..HEAD` → **one file**, the review
- `.planning/STATE.md` and `.planning/ROADMAP.md` untouched, as the orchestrator requires
- `251-VERIFICATION.md` byte-unchanged (plan `254-04` owns it)
