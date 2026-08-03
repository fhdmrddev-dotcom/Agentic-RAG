---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 21
subsystem: planning-record
tags: [validation, gap-closure, falsification, g-4, manual-uat, honesty]

# Dependency graph
requires:
  - phase: 187-20
    provides: "the raw measured output this plan transcribes — five falsification probes, the coverage sweep, and the pre/post gate figures"
  - phase: 187-19
    provides: "the round-2 record whose shape this plan copies: every figure adjacent to the command that produced it, disagreements recorded on both sides, limits stated rather than implied"
provides:
  - "A round-3 section in 187-VALIDATION.md whose every figure carries its command, measured at base f632f9b6"
  - "The FIVE-probe record (A/B/C/C2/D) — not the three the plan's key_links assumed nor the four its action assumed"
  - "D-20-A recorded on both sides: 187-20 refuted one of its own plan's acceptance criteria with evidence"
  - "M3 and M9 repaired so neither tells the operator to expect a defect that no longer exists"
  - "M13 — the escalated-only draft, the case WR-09 broke, with its own row"
affects: [187-VERIFICATION, phase-188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A 'before' figure re-derived at the BASE BLOB (git show <rev>:<path> | …) rather than transcribed, so both halves of a delta are measurements"
    - "A stale manual-row note is repaired by rewriting what the operator should SEE while keeping the row's blocked→unblocked→repaired history, because a row whose history is deleted cannot be audited"

key-files:
  created:
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-21-SUMMARY.md
  modified:
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md

key-decisions:
  - "FIVE probes recorded, not three — the plan's literal count was written before 187-20 ran and is wrong; the measured set is the record (Deviation D-21-A)"
  - "The count gate is recorded as pre-existing-flaky sampled three times (2 → 1 → 0 failing), NOT as clean — a sample landing at 0 is a property of the flake, not a repair (Deviation D-21-C)"
  - "187-20-SUMMARY's `grep -c seed-receipt-carried → 12` is corrected to 14 with the cause named (a commit-attribution slip, 51a60299 vs the Task-3 tip); both are recorded, the re-run is the measurement"
  - "187-VERIFICATION.md's own M3 human_verification note is still stale; it is NAMED in M3's VALIDATION note rather than edited, because that file belongs to the verifier and this plan declares one file"

patterns-established:
  - "When a plan's must_have states a literal count that execution contradicts, record the measured count AND the divergence — never compress the measurement to fit the plan's wording"

requirements-completed: []

# Metrics
duration: 34min
completed: 2026-08-03
---

# Phase 187 Plan 21: Record round 3 — the probes, the gates, and a board one row larger

**Round 3's evidence is now on the record with the command behind every figure — five falsification
probes (not the three this plan assumed), a coverage sweep re-derived at the base blobs rather than
transcribed, and gates re-measured at the round-3 tip — while the manual board went from twelve rows
to thirteen with nothing ticked, nothing softened and nothing dropped.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-08-03T18:10Z
- **Completed:** 2026-08-03T18:44Z
- **Tasks:** 2/2
- **Files modified:** 1 (`187-VALIDATION.md`) + this SUMMARY

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 — record round 3 (probes, sweep, gates) | `66170894` | `187-VALIDATION.md` (+517 / −0) |
| 2 — repair M3/M9, add M13, board 12 → 13 | `d2930e8b` | `187-VALIDATION.md` (+77 / −3) |

Task 1's diff is **purely additive** (`git diff --numstat` → `517 0`), so the round-2 section is
byte-unchanged. Task 2's **three** deletions are exactly `manual_rows: 12`, the old M3 row and the
old M9 row — nothing else in the file was removed.

## Accomplishments

### Task 1 — the round-3 record

A new sibling section, `## The gap-closure round 3 — 2026-08-03`, placed after round 2's and before
`## Wave 0 Requirements`. It carries:

- **The base, stated unambiguously:** `f632f9b6`, the tip immediately before `debced07`, with the
  `git log --oneline -5` output pasted and the explicit note that it differs from both `35261e96`
  (phase base) and `ee5fff3b` (round-2 base).
- **The scope fence, measured not promised.** WR-08 is named as an **operator decision to roll into
  Phase 188**, not a closure, and §(ac) proves it with an empty
  `git diff --stat f632f9b6 HEAD -- StepTypePicker.tsx StepTypePicker.test.tsx`. WR-01/04/05/06/07
  and IN-01…IN-05 are named as carried forward.
- **Per-task rows** `187-20-T1` / `187-20-T2` / `187-20-T3`, each with its automated command.
- **§(q) — the FIVE probes**, each with its mutation, its verbatim RED and its clean-revert evidence
  (`git diff --quiet -- frontend/` exit 0), plus the Task-1 RED signature, plus the statement that a
  probe observed RED is the only evidence a guard bites (round 2's own lesson was *"green over an
  unrepresentable fixture is not coverage"* — and its fix then shipped protected by no fixture).
- **§(r) — the honest arrival split:** 3 RED, 7 GREEN on arrival, said plainly rather than implied
  to be a whole red-to-green cycle, with the note that the probes (not a red) are what prove the
  always-green seven bite.
- **§(s) — the coverage sweep BEFORE and AFTER, both measured now.** The BEFORE table was re-derived
  by running the sweep against `git show f632f9b6:<path>` blobs and **reproduces 187-20's table cell
  for cell**; CR-03 itself reproduces as exactly one hit in all of `frontend/src`. AFTER:
  `static ids: 12 uncovered: 0`, `seed-receipt-carried` 0 → 11.
- **§(t)–(ac) — the gates**, each re-measured at the round-3 tip (see below).
- **§(ad) — D-187-10 and D-187-08** with measured evidence (added in Task 2's commit; both are
  plan-level must_haves rather than task-scoped).

### Task 2 — the manual board

- **M3's note repaired.** Round 2's warning — read the carried sentence against the per-step reasons
  because an escalated draft shows an internally-contradictory card — is explicitly marked STALE and
  replaced with what the operator should now see. The row's history is **kept**: blocked on CR-01 →
  unblocked by 187-16 (`77668751` / `5c613bf4`) → repaired by 187-20 (`debced07` / `51a60299` /
  `7593fe8b`). Still **UNPERFORMED and UNTICKED**.
- **M9's note gained a fifth check.** All four original checks survive verbatim; the new one has the
  operator confirm the carried paragraph and the rows **AGREE** rather than hunt for a contradiction.
- **M13 added** — the escalated-only draft head-on, in the table's four-column shape, phrased against
  the shipped copy (`"1 step was already set to must prove it."`, `"you turned this on by hand"`,
  the absent one-way line, the `SEED_RECEIPT_NOTHING_COMMITTED` close) and against sketch 150-B's
  four load-bearing properties. **UNPERFORMED and UNTICKED.**
- **Board 12 → 13**, frontmatter `manual_rows: 13`, with a round-3 status paragraph naming M5 and M8
  as unchanged-and-still-owed and M12's WR-08 warning as **standing**.

## Raw measurements taken for this round

All run at the round-3 tip (`43b8c6dd`, before this plan's own doc commits), base `f632f9b6`.

| Gate | Command | Result |
|---|---|---|
| five named suites | `npx vitest run SeedReceipt · StepTypePicker · phaseVocabulary · phaseVocabulary.corpus · definitionOps` | **5 files / 466 passed / 0 failed**, exit 0 — **+14** over a re-derived 452 |
| 452 re-derived | `git show <rev>:<path> \| grep -cE '^[ \t]*(it\|test)(\.each\(\|\.skip)?\('` | SeedReceipt 47→60 (+13), definitionOps 117→118 (+1), other three 0 → 466 − 14 = **452** |
| per-file | `npx vitest run …/SeedReceipt.test.tsx` · `…/definitionOps.test.ts` | **60** · **228** |
| count gate | `node scripts/vitest-count-gate.cjs` | **exit 0** — total **2089**, failed **0**, pinned 415, 16/16 present |
| pin untouched | `git status --porcelain scripts/vitest-count-gate.cjs`; `git diff --name-only f632f9b6 HEAD -- scripts/` | both **empty** |
| `tsc -b` | `npx tsc -b` | exit 2, **33** `error TS` (= the pre-change baseline), **0** in `components/workflows/`, **0** in `pages/WorkflowBuilderPage*` |
| `vite build` | `npx vite build` | `✓ built in 4.69s`, **exit 0** |
| zero migrations | `git diff --stat 35261e96 HEAD -- supabase/migrations`; same from `f632f9b6`; `git status --porcelain supabase/migrations` | **all three empty** |
| D-187-14 mount cap | `git diff --numstat f632f9b6 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` | **empty — no output at all**; the round spends 0 of the 46/5 cap |
| backend fence | `git diff --name-only f632f9b6 HEAD -- backend/` | **empty** |
| WR-08 fence | `git diff --stat f632f9b6 HEAD -- StepTypePicker.tsx StepTypePicker.test.tsx` | **empty** |
| coverage sweep, base | sweep over `git show f632f9b6:<path>` | `static ids: 12 uncovered: 1`, `MISSING 0 seed-receipt-carried` |
| coverage sweep, tip | sweep over the worktree | `static ids: 12 uncovered: 0`, `seed-receipt-carried` = **11** |
| CR-03 reproduction | `git grep -n "seed-receipt-carried" f632f9b6 -- 'frontend/src'` | **exactly one hit** — `SeedReceipt.tsx:276` |
| D-187-08 | `grep -rn 'export function groundingCauseOf' frontend/src/` | **one definition site**, `phaseVocabulary.ts:343`; 0 KB tool ids in `SeedReceipt.tsx` |
| no false record | `git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md` | **empty** |

## Deviations from Plan

### D-21-A — [Rule 1 - measured correction] The probe count is FIVE, not three or four

**Found during:** Task 1, while reading `187-20-SUMMARY.md`.

**The plan says** — `key_links`: *"187-20's **three** falsification probes"*; the Task-1 action:
*"recording all **four** falsification probes"*.

**Measured:** the set on file is **A · B · C · C2 · D — five.** 187-20 added PROBE C2 during
execution (its own deviation `D-20-C`) because PROBE C could not answer the question the plan was
asking.

**Action:** one row per **actual** probe was written, C2 included, and the divergence is stated
explicitly at the head of §(q) rather than silently reconciled. A record that compresses a
measurement to fit a plan's wording is the same failure class this whole round exists to close.

### D-21-B — [Rule 1 - measured refutation, transcribed] D-20-A recorded on both sides

**Found during:** Task 1.

187-20's own plan made it an acceptance criterion that PROBE C **must** go RED in
`SeedReceipt.test.tsx`, *"if the component test stays green here, the identity assertion is not
doing its job and must be repaired before this task can pass"*. It stayed **GREEN**, and 187-20
**refuted the criterion with evidence** instead of applying the prescribed repair:

- the assertion is `textContent === seedReceiptCarriedLead(n)` and PROBE C moves **both sides at
  once** — arithmetic, not a weak assertion;
- the prescribed repair needs a **hand-typed copy literal** in the component suite, which
  contradicts that file's own docblock and puts the copy lock in **two homes**;
- **PROBE C2** (drift the COMPONENT off the export) was added instead and went RED on 4 cases.

**Action:** recorded in §(q) under PROBE C with the reasoning on both sides, so a reader who
disagrees can reopen it as a deliberate decision to duplicate the copy lock rather than rediscovering
it as an unexplained green.

### D-21-C — [Rule 1 - honest divergence] The count gate exits 0 now; 187-20 measured exit 1

**Found during:** Task 1, running the gate.

`node scripts/vitest-count-gate.cjs` returned **exit 0, total 2089, failed 0** at the same tree state
where 187-20 recorded **exit 1** with a single `[failing-tests]` reason (two `PublishGauntlet.test.tsx`
cases).

**Action:** both are recorded in §(u), and the divergence is presented as **evidence for** the flake
rather than as a repair. The pre-existing proof is carried across intact — 187-20 restored the four
edited files to `debced07~1`, re-ran the gate (total 2075, failed 1, same two cases) and restored
them, without `git stash` or `git clean`. The gate is described as *pre-existing-flaky, sampled three
times (2 → 1 → 0), currently 0* — **not** as clean, and **not** as caused by this round. Logged as
`D-ITEM-187-20-01` in `deferred-items.md`.

### D-21-D — [Rule 1 - figure corrected] `grep -c "seed-receipt-carried"` is 14, not 12

**Found during:** Task 1, re-measuring.

187-20-SUMMARY prints **12** under its *Final gates* heading. Measured now: **14**. Cause identified
rather than guessed:

```
$ for r in 51a60299 7593fe8b HEAD; do git show $r:…/SeedReceipt.test.tsx | grep -c "seed-receipt-carried"; done
12
14
14
```

12 is the value at `51a60299` (Task 2), not at the Task-3 tip where the block is presented. Nothing
about the closure changes. **Action:** both figures recorded in §(s), the re-run named as the
measurement, per round 2's own precedent.

### D-21-E — [scope boundary, named not fixed] `187-VERIFICATION.md`'s M3 note is still stale

**Found during:** Task 2.

Round 2's *"read the carried sentence against the per-step reasons on an escalated draft"* warning
lives in **`187-VERIFICATION.md`**'s `human_verification` block, not only in VALIDATION.md. This plan
declares exactly one file in `files_modified`, and `187-VERIFICATION.md` belongs to the verifier.

**Action:** not edited. **Named** inside M3's repaired note, so the two documents are not silently in
conflict and the verifier amends it at re-verification. Recorded here rather than left for a reader
to trip over.

### D-21-F — [addition] §(ad) covering D-187-10 and D-187-08

Neither decision has a task of its own in this plan, but both are plan-level `must_haves`. §(ad) was
added in Task 2's commit with measured evidence for each (the two `toBeNull()` + `toBe("")` zero
cases and the `seed-receipt` still-arrives section for D-187-10; the single `groundingCauseOf`
definition site and zero KB tool ids in the component for D-187-08).

### Non-deviation, stated for the record — `.planning/STATE.md` is dirty

`git status --porcelain .planning/STATE.md` reports ` M` throughout this plan
(`1 file changed, 5 insertions(+), 5 deletions(-)`). That is the **orchestrator's** own tracking
write, present before this executor started. This executor did not read, write, stage or commit it,
and `REQUIREMENTS.md` / `ROADMAP.md` are both clean. Recorded in §(ab) of the validation file as
well, so the acceptance criterion's expectation of an empty status over all three is answered with
the measurement instead of a claim.

## Requirements

`VOCAB-02` is **not** marked complete by this plan. **No false completion record was written:**
`requirements.mark-complete`, `state.advance-plan` and `roadmap.update-plan-progress` were **not**
called (all three write false records in this project). `STATE.md` and `ROADMAP.md` were not modified
by this executor — the orchestrator owns those transitions.

## Threat Flags

None. This plan is documentation-only: it changed one markdown file, opened no endpoint, added no
auth path, no file access, no schema surface and installed no package. `T-187-21-SC` is discharged —
`git status --porcelain --untracked-files=no frontend/ backend/ supabase/migrations` is empty and no
package manifest was touched.

## Known Stubs

None.

## Self-Check: PASSED

- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VALIDATION.md` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-21-SUMMARY.md` — FOUND
- commit `66170894` — FOUND
- commit `d2930e8b` — FOUND
- `grep -c "187-20-T1\|187-20-T2\|187-20-T3"` → **3** (≥ 3) ✅
- `grep -c "PROBE"` → **15** (≥ 4) ✅
- `grep -c "M13"` → **5** (≥ 2) ✅
- `grep -c "CR-03"` → 14 · `grep -c "WR-09"` → 13 · `grep -c "WR-08"` → 6 (≥ 2, M12's note survives) ✅
- `grep -c "seed-receipt-carried"` → 13 (≥ 2, before and after sweeps both recorded) ✅
- no manual row contains a checked box; `UNPERFORMED` occurrences rose ✅
- `git status --porcelain --untracked-files=no frontend/ backend/ supabase/migrations` — empty ✅
- `git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md` — empty ✅
- each commit lists exactly one file ✅
