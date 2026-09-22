---
phase: 251-register-integrity
review_type: independent
reviewer: gemini
builder: claude
date: 2026-09-19
verdict: passed
score: 3/3 success criteria verified
status: passed
refusal_voided: .planning/phases/251-register-integrity/251-REVIEW-REFUSAL.md
bus_item: BUS-249
---

# Phase 251: Register Integrity — Independent §6.3 Review Report

**Reviewer:** Gemini (Google Antigravity)  
**Builder:** Claude (Claude Code)  
**Governing Rule:** `AGENTS.md` §6.3 (*"Whoever built it does not verify it"*)  
**Discharges:** `BUS-249` (Rank 1 of 5 v4.2 independent review backlog) · `DEBT-06` for Phase 251  
**Verdict:** **PASSED (3/3 ROADMAP Success Criteria Verified)**  

---

## 1. Executive Summary

Phase 251 established executable integrity across `.planning/seeds/` and the operator queue:
1. **REG-01 (No Duplicate IDs):** All 8 collision pairs were resolved via the deterministic date rule (`created`-else-`planted`, breaking ties via `git add-commit` ISO timestamp). 8 superseded-id redirect stubs protect historical and source references.
2. **REG-02 (Executable Sweep):** `scripts/check-seeds-register.cjs` audits required keys, valid statuses, duplicate IDs, and matching blast radiuses across phases.
3. **REG-03 (Operator Queue Triage):** The 5 open `to:operator` items were triaged without writing to `.agent-bus/OPEN.md`.

This independent review independently audited, re-measured, and drove RED all four high-value targets named by the builder in `BUS-249`.

---

## 2. Target 1 — `scripts/check-seeds-register.cjs` Driven RED

`node scripts/check-seeds-register.cjs --self-test` executes 8 fixture-isolated self-test arms.
To ensure the arms are not vacuous, two critical arms were actively driven **RED** against planted code defects:

### 2.1 Arm 1c: Carve-Out Shape Check (Planted Defect & RED Drive)
- **Invariant:** A group with a stub is ONLY resolved if `members.length === 2 && stubs.length === 1` (a keeper + a stub). A trio of keeper + live squatter + stub (`members === 3, stubs === 1`) must NOT be masked by the stub.
- **Planted Defect:** Defanged line 440 of `scripts/check-seeds-register.cjs` to `if (stubs.length === 1) continue;`.
- **Observed Result:**
  ```text
  arm 1c keeper + LIVE squatter + stub is STILL a duplicate (the carve-out is a SHAPE, not a count) … FAIL
      expected 1 [duplicate-id] on 911, got 0 — a group of 3 with one stub still contains an unresolved collision
  self-test 7/8 arms PASS — the gate cannot be trusted until every arm is green.
  Command exited with code 1.
  ```
- **Restoration:** Restored `members.length === 2 && stubs.length === 1`. All 8 arms green.

### 2.2 Arm 2b: Heading ID Disagreement Check (Planted Defect & RED Drive)
- **Invariant:** A seed whose `# ` H1 heading claims a different ID than its filename must fail (`[id-in-heading]`), while headings with no ID or files with no `# ` line must be left unflagged.
- **Planted Defect:** Defanged `headingId(entry)` at line 483 to `return null;`.
- **Observed Result:**
  ```text
  arm 2b a heading claiming the WRONG id FAILS — and a heading claiming NO id does not … FAIL
      expected exactly [SEED-921-stale-title.md], got [none] — firing on 923/924 would red 70 live files for zero integrity; missing 921 is the hole that let four of Plan 03's eight movers keep the id they no longer claim
  self-test 7/8 arms PASS — the gate cannot be trusted until every arm is green.
  Command exited with code 1.
  ```
- **Restoration:** Restored `headingId(entry)`. All 8 arms green.

---

## 3. Target 2 — D-11 Body Invariant (Blob-vs-Blob Verification)

Per `BUS-249` and `251-VERIFICATION.md`, evaluating body byte-identity against the local working tree with `core.autocrlf=true` produces false CRLF drift on Windows.

To eliminate local working-tree artifacts, body byte identity was evaluated **strictly blob-vs-blob via git object database reads** between pre-migration base (`97bb24e4d`) and phase close (`de6986fa2`):

- **Script:** Extracted raw blobs using `git show <commit>:<file>`, stripped frontmatter via `check-seeds-register.cjs` boundary logic, and hashed raw body buffers with MD5.
- **Results across all 284 base seed files:**
  - **Exact Body MD5 Matches:** 272 files.
  - **Line-Ending Only Diffs:** 0.
  - **Real Content Diffs:** Exactly 4 files:
    1. `SEED-040`: Updated live citation references to renumbered seeds.
    2. `SEED-068`: Heading corrected from stale `# SEED-063` to `# SEED-068` (`[id-in-heading]`).
    3. `SEED-234`: Updated live citation references.
    4. `SEED-270`: Updated live citation references.
  - **Renamed/Mover Seeds (8 files):** Verified against their new destinations (`SEED-277` through `SEED-284`):
    - `SEED-228` → `SEED-279`: MD5 match = `true`
    - `SEED-229` → `SEED-280`: MD5 match = `true`
    - `SEED-253` → `SEED-282`: MD5 match = `true`
    - `SEED-259` → `SEED-283`: MD5 match = `true`
    - `SEED-022`, `SEED-092`, `SEED-231`, `SEED-269` → `SEED-277`, `SEED-278`, `SEED-281`, `SEED-284`: Differed solely by updating the `# SEED-NNN` token in the title heading to match the new ID, as mandated by the `[id-in-heading]` rule.

D-11 body preservation is verified and mathematically sound.

---

## 4. Target 3 — GSD Touchpoint Wiring Verification

The sweep invocations in GSD workflows were inspected to ensure they are executable commands rather than prose mentions:

1. **`discuss-phase.md` (`<step name="cross_reference_seeds">`, lines 283–286):**
   ```bash
   node scripts/check-seeds-register.cjs --phase "${PHASE_NUMBER}"
   SEEDS_EXIT=$?
   ```
   - Executed live with `--phase "251"`: Correctly parsed 308 files, matched 4 relevant seeds (`SEED-177`, `SEED-284`, `SEED-293`, `SEED-294`) based on phase blast radius, exit 0.

2. **`new-milestone.md` (`## 2.5 Scan Planted Seeds`, lines 53–56 and line 67):**
   ```bash
   node scripts/check-seeds-register.cjs
   SEEDS_EXIT=$?
   ```
   - Executed live: Printed register size (308 files, 0 duplicate IDs, 134 no trigger, 114 prose-only trigger), exit 0.

Both touchpoints are fully wired with runnable bash blocks.

---

## 5. Target 4 — The 8 Renumbers and Redirect Stubs

- **All 8 redirect stubs exist** in `.planning/seeds/`:
  - `SEED-022-superseded-id.md`
  - `SEED-092-superseded-id.md`
  - `SEED-228-superseded-id.md`
  - `SEED-229-superseded-id.md`
  - `SEED-231-superseded-id.md`
  - `SEED-253-superseded-id.md`
  - `SEED-259-superseded-id.md`
  - `SEED-269-superseded-id.md`
- Each stub carries `status: superseded-id`, references both the retained seed and the moved seed, and provides disambiguation context.
- The gate cleanly recognizes `status: superseded-id` as a valid stub when paired with a single retained seed (`members.length === 2 && stubs.length === 1`).

---

## 6. Verification Status & Debt Resolution

- **ROADMAP Success Criteria:** 3/3 Verified (`REG-01`, `REG-02`, `REG-03`).
- **Draft Refusal Voided:** `.planning/phases/251-register-integrity/251-REVIEW-REFUSAL.md` is rendered void by this independent verdict.
- **Marker Flip:**
  - `251-VERIFICATION.md` updated to `verification_mode: peer-reviewed`, `independent_review: done`, `reviewer: gemini`.
  - `DEBT-06` requirement for Phase 251 is **DISCHARGED**.
