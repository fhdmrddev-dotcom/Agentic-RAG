---
phase: 254-independent-review-of-249-253
plan: "03"
subsystem: planning-registers
tags: [debt-06, refusal, review-debt, draft, self-assessed]
requires:
  - ".planning/DEBT-06-REFUSALS.md — the 2026-09-14 operator-ruled refusal FORMAT"
  - ".planning/DEBT-06-AUDIT.md — the counting rule"
  - ".planning/phases/251-register-integrity/251-REVIEW.md — written by 254-02"
  - ".agent-bus/OPEN.md — BUS-249/250/251/256/257, amended by 254-01"
provides:
  - "five per-phase written refusal DRAFTS, each naming the decider, the reason, the mechanical evidence, the judgement a measurement cannot replace, the risk accepted and the re-open trigger"
  - "one ADOPTED READING of the two registers that disagree (M-8), fenced byte-identical across all five"
affects:
  - ".planning/phases/249-the-model-you-actually-run/"
  - ".planning/phases/250-run-honesty-the-residue/"
  - ".planning/phases/251-register-integrity/"
  - ".planning/phases/252-close-the-v42-audit-gaps/"
  - ".planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/"
tech-stack:
  added: []
  patterns:
    - "byte-identity by CONSTRUCTION: the two shared sections live in one fragment each and every file is assembled by cat, so the five cannot drift in the first place"
    - "fence the WORDS, not the block — extract the section body, md5 the five, require one distinct value"
    - "RED drive: plant a one-word change, watch the fence exit 1, restore from a byte-copy, prove with an identical md5 pair"
    - "a claim about the tree is DRIVEN before it is written — two of the plan's own inherited claims were refuted this way"
key-files:
  created:
    - ".planning/phases/249-the-model-you-actually-run/249-REVIEW-REFUSAL.md"
    - ".planning/phases/250-run-honesty-the-residue/250-REVIEW-REFUSAL.md"
    - ".planning/phases/251-register-integrity/251-REVIEW-REFUSAL.md"
    - ".planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-REFUSAL.md"
    - ".planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-REFUSAL.md"
  modified: []
decisions:
  - "The plan's instruction to record `schema-acl-parity.yml has never executed` was DRIVEN before being written and is now FALSE — the workflow ran successfully 2026-09-17T14:05:28Z, and backend-tests is green for the first time in the repository's history. The correction is written into 253's draft beside the original rather than copied forward."
  - "The acceptance criterion `md5sum <file>` == `git show HEAD:<file> | md5sum` FAILS on 251-REVIEW.md and the file is NOT tampered with — blob LF vs worktree CRLF, exactly 462 bytes. The fence was re-run CR-normalised and all twelve register files match on CONTENT. A raw whole-file md5 against a git blob is unsound on this box."
  - "Task 3 changed zero bytes: the fences passed on first run because the shared sections were assembled from single fragments rather than typed five times. The RED drive is the evidence that they can fail."
metrics:
  duration: "~11 min"
  completed: 2026-09-17
  tasks: 3
  commits: 2
  files_created: 5
  lines: 885
---

# Phase 254 Plan 03: Five Drafted Refusals — Summary

Each of 249-253 now carries a written refusal **draft** in its own directory naming the operator as
the decider, the mechanical evidence a stranger can re-run, the one judgement a measurement cannot
replace, the risk accepted and what re-opens it — and not one of them claims a review or moves a
register.

## What was built

| File | Case | Residual risk | The judgement a measurement cannot reach |
|---|---|---|---|
| `253-REVIEW-REFUSAL.md` | **weakest** of five | **HIGH** | whether `SEED-290`'s 13 unfixed findings were dispositioned correctly — `WR-05` (latent, unfenced, permissive direction) and `WR-04` (a false docstring this phase added, and the stated reason another finding was deferred) |
| `252-REVIEW-REFUSAL.md` | second-weakest | **moderate** | whether the seven refuted inherited claims were refuted correctly, and whether `W-5` / `W-9` genuinely needed no work |
| `251-REVIEW-REFUSAL.md` | middle | low-moderate | D-07's date rule on the eight renumbers where `seedDate()` is not total, and D-17's 35 product-source files left pointing at stubs |
| `250-REVIEW-REFUSAL.md` | second-strongest | low | the `NOT TICKED` badge wording, the declined G-2 sketch (`D-250-12`), and the three remaining `owed:` entries |
| `249-REVIEW-REFUSAL.md` | **strongest** of five | low | whether closing `MODEL-09` **by measurement** was the right call, and whether `BUG-260916-01` belongs to this phase |

⛔ **252 and 253 are graded as the WEAKEST pair on purpose.** They are the two phases `AGENTS.md`
§3.1's critical-phase test catches — credentials, the permission model, and fail-open — and §3.1's
answer to a critical phase is to **swap the seats**, not skip one. A refusal on a security-bearing
phase is a **higher** residual risk than a refusal on a bookkeeping one, and neither line reads `low`.
`DEBT-06-REFUSALS.md` graded its own five; flattening that is how a refusal set stops carrying
information.

⭐ **The two strongest cases rest on decisions that were already recorded, by the party entitled to
make them.** 249's verification frontmatter carries an `independent_review_waiver` quoting the
operator's 2026-09-15 instruction verbatim and saying in the same breath *"WAIVED BY INSTRUCTION, not
satisfied"*; 250 carries `reviewer: null` and an `owed:` list whose fourth entry reads *"independent
review (DEBT-06) — WAIVED BY INSTRUCTION, NOT SATISFIED"*. Both drafts are that recorded intention
catching up, not a second-guess of the close. ⚠ Both also state that the ground has moved:
`OV-SOLO-01` was re-armed 2026-09-13, so each needs a **fresh** ruling rather than an appeal to the
old one.

⭐ **251 is the one that had to be most careful, and it is the most explicit that having a review file
changes nothing.** It cites `251-REVIEW.md` by name with its verdict triple (`still_live: 4 ·
fixed_since: 0 · refuted: 0`) and its counts (2 critical · 0 blocker · 2 warning · 3 info), states
that `DEBT-06-AUDIT.md`'s counting rule makes it a code-review pass and not a §6.3 review, and
**bars the floor pass from its own residual-risk argument** — using a builder's reading of its own
work to argue that the same builder's refusal is low-risk would be circular. ⚠ It also carries the
register fact nothing else does: `grep -c independent_review .planning/phases/251-register-integrity/251-VERIFICATION.md`
returns **0**, so a sweep of owed rows returns 4 and silently omits 251. The key is **added** by
`254-04`, never flipped, and not by this draft.

## The fences, and the one that was driven RED

| Fence | Result |
|---|---|
| `## ADOPTED READING` body md5, five files | **one distinct value** — `sort -u \| wc -l` == 1 |
| `## ⛔ What this draft does not do` body md5, five files | **one distinct value** — `0db8f5074c43dfc2eedd3cf6462c2e98` x5 |
| `review_type: self-assessed` per file | exactly **1** in each of the five |
| `review_type: independent` over the five **plus** `251-REVIEW.md` | **0** |
| `independent_review: done` over the same six | **0** |
| `independent_review: refused` in any of the five `*-VERIFICATION.md` | **0** — nothing has been ruled; the drafts carry `independent_review_after_ruling`, a distinct key |
| twelve pre-existing register/review files vs `HEAD` | **content-identical**, and `git status --short` over all five phase directories is **empty** |

⭐ **The adopted-reading fence was driven RED before it was believed.** One word of
`250-REVIEW-REFUSAL.md`'s adopted reading was changed (`adopts BOTH rules` to `adopts ONE rule`); the
fence exited **1** with `FAIL adopted-reading drift`. Restored from a byte-copy taken before the edit:
fence exit **0**, and the md5 pair is identical either side —
`43c8fbe8cc6cf382dccc2aa6e7420e99` before and after. **A fence nobody has seen fail is not a fence.**

⭐ **Byte-identity is by CONSTRUCTION, not by care.** The two shared sections were written once into
one fragment each and every file assembled with `cat head adopted body disclaimer > target`. Five
files typed five times drift in the paragraph that matters most; five files assembled from one
fragment cannot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan told this plan to write a sentence that is now FALSE**

- **Found during:** Task 1
- **Issue:** `254-03-PLAN.md` asked 253's draft to record, as an owed item, that *"`schema-acl-parity.yml`
  has never executed (`gh run list` → HTTP 404, not on `master`), so `--self-test`'s only runner has
  never run."* Driven before writing: `gh run list --workflow=schema-acl-parity.yml` returns
  **`completed success ... 2026-09-17T14:05:28Z`** on `develop`, and `gh run list --workflow=backend-tests.yml`
  shows **two successes** on 2026-09-17 — the first green `backend-tests` runs in this repository's
  history, after 40 consecutive failures.
- **Fix:** 253's draft records the correction beside the original rather than copying the stale claim
  forward, and states what is still genuinely owed: **one green run proves the job executes; it does
  not prove the job can fail.** `253-VERIFICATION.md`'s human-verification row still wants a
  deliberately unmirrored REVOKE and a neutered ACL regex pushed and seen to turn the job RED.
- **Files modified:** `253-REVIEW-REFUSAL.md`
- **Commit:** `c551be798`

**2. [Rule 1 - Bug] The plan's md5 acceptance criterion reports a FALSE tamper**

- **Found during:** Task 3
- **Issue:** the criterion is `md5sum <file>` == `git show HEAD:<path> | md5sum` over twelve
  pre-existing files. It **fails on `251-REVIEW.md`** — worktree `27789` bytes, blob `27327`, a
  difference of exactly **462**, which is the file's 462 lines. The blob is LF; the working copy is
  CRLF, because the wave-1 merge checked it out through the `core.autocrlf` smudge filter. **The file
  is not tampered with**: `git status --short` is clean and `cmp` after `tr -d '\r'` is identical.
- **Fix:** the fence was run **both ways** and the CR-normalised result is the one reported — **all
  twelve match on content**, and `git status --short` over the five phase directories is empty. This
  is the trap the plan's own warning named, firing on the one file wave 1 created.
- **Files modified:** none — this is a correction to the instrument, not to the tree.
- **Commit:** recorded here (Task 3 changed zero bytes)

### Not a deviation, recorded so it is not mistaken for one

**Task 3 produced no diff.** Its action is *"fix the outliers to match rather than relaxing the
fence"* — there were no outliers, because the shared sections were assembled rather than retyped. The
RED drive is what makes that a measurement instead of an assumption.

## What this plan did NOT do

1. ⛔ **It flipped no register.** No `*-VERIFICATION.md` frontmatter, no ROADMAP Progress row, no
   `REQUIREMENTS.md` line, no bus item. `254-04` owns the three register writes claude is allowed to
   make; the fourth is the operator's.
2. ⛔ **It touched `.agent-bus/OPEN.md` not at all.** Wave 1 owns that file. `git status` proves it.
3. ⛔ **It overwrote no existing `*-REVIEW.md` / `*-REVIEW-R2.md`** (D-09), including `251-REVIEW.md`
   written by wave 1 hours earlier — content-identical to `HEAD`, verified.
4. ⛔ **It fixed nothing it found.** Findings are triaged, never fixed in a review phase (D-11 / G-7).
5. ⛔ **`DEBT-06` is not ticked and cannot be ticked by this phase.** 254 closes only its 249-253 arm;
   `241 · 242 · 244 · 245` stay owed, re-derived rather than quoted as the `242-246` range.

## The honest accounting line

⛔ **A draft is not a refusal and a refusal is not a pass.** Every one of the five carries
`status: draft-pending-operator-ruling` and names the operator as the decider it is waiting on
(D-05 / `REG-03`). ⭐ And every one **voids itself if its bus ask is answered** — before or after
2026-09-24 — because *a deadline is a completion condition, not a closed door*, and Gemini cannot be
driven from here (M-5).

## Self-Check: PASSED

All six files claimed by this plan exist on disk, and all five `*-REVIEW-REFUSAL.md` files are
tracked in `HEAD` (`git ls-tree -r --name-only HEAD | grep -c REVIEW-REFUSAL.md` returns **5**).
All three commits resolve: `c551be798` (Task 1), `d2dc1358e` (Task 2), `260d7e0f4` (this summary).
Task 3 changed no bytes, so it has no commit of its own — its evidence is the RED drive recorded
above, and the byte-copy restore that proved the tree unchanged.
