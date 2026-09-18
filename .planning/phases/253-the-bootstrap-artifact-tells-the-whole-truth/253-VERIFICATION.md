---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
verified: 2026-09-17T14:10:00Z
status: gaps_found
score: 14/14 must-haves verified (re-driven on the CURRENT tree, post gap-closure round 1 + 2 fast-fixes)
overrides_applied: 0
verification_mode: self-verified
independent_review: owed   # ⚠ AMENDED 2026-09-17 by Phase 254 (plan `254-04`). ⛔ THE VALUE IS STILL `owed` AND NOTHING WAS DISCHARGED BY THIS WRITE — what changed is that the debt stopped being silent. WHO IS OWED IT: `BUS-257`, filed 2026-09-16 `to:gemini`, **amended in place** 2026-09-17 by plan `254-01` with a deadline and a risk rank (this phase is rank 2 of 5 under `251 → 253 → 252 → 249 → 250`); ⛔ it is UNANSWERED as of this write. THE DEADLINE: **2026-09-24** — after it, a refusal that is already DRAFTED awaits the operator's ruling (D-04 / D-05); ⛔ `REG-03` — claude may not answer or close a bus item, so the deadline expiring changes nothing by itself. THE DRAFT: `.planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-REFUSAL.md`, `status: draft-pending-operator-ruling`, `kind: recorded-decision-not-review`. WHAT THIS MARKER IS NOT: it says the row is ACCOUNTED FOR, never that the work was done. An operator ruling on the draft would make it `refused`; only an `AGENTS.md` §6.3 review by the agent that did NOT build it makes it `done`. RE-OPEN TRIGGER: `BUS-257` being answered at any time, before or after the deadline — at which point the verdict artifact is `253-REVIEW-IND.md` and the draft is void. FULL AUDIT: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`.
re_verification: true
re_verification_detail:
  previous_status: human_needed
  previous_score: 14/14
  previous_verified_at: 2026-09-16T20:40:54Z
  previous_repo_state: "develop @ 69f06cef0 — BEFORE 253-03 (gap-closure round 1) and BEFORE 253-REVIEW-R2.md"
  what_changed_since:
    - "253-03 (gap-closure round 1) landed and FF-merged at feb3d4752: CR-01, CR-02, WR-02, WR-06, WR-08 from 253-REVIEW.md closed."
    - "253-REVIEW-R2.md (round-1's own code review) found 2 NEW blockers + 7 warnings + 6 info in the round-1 diff itself."
    - "Both R2 blockers were fast-fixed under G-3 at 3cedc6e51 (backend-tests.yml: psycopg2-binary + --continue-on-collection-errors + a scripts/-fences-only step) and 71affadd1 (check-schema-acl-parity.cjs: MIN_ACL_TUPLES=100 non-vacuity floor, self-test 35->37)."
    - "The 7 warnings + 6 info from 253-REVIEW-R2.md were NOT fixed and — this re-verification's own finding — were NOT recorded in any register (no seed, no STATE.md line, no CONTEXT addendum) the way round 1's own deferred findings were."
  gaps_closed:
    - "R2-CR-01: the parity gate's non-vacuity floor guarded FILE COUNT only — a parser regression (both ACL regexes neutered) printed `mirrored: 0/0` then `schema ACL parity OK`, exit 0. Independently re-driven on a scratch copy in this session: now exit 2, VacuousScanError, `only 0 ACL tuple(s) parsed … below the floor of 100`."
    - "R2-CR-02: backend-tests.yml had never been green (40/40 runs failure, collection aborted on a missing psycopg2 import) — the two Python fences added in round 1 were executed by nothing. Now: psycopg2-binary installed test-only, `--continue-on-collection-errors` added, and a dedicated 'scripts/ parity fences (must pass)' step runs the three test_253_* modules alone. Independently re-run in this session: 26 passed, exit 0."
  gaps_remaining:
    - "The 7 warnings + 6 info in 253-REVIEW-R2.md have no register entry anywhere outside the review file itself (no SEED-NNN, no STATE.md line, no 253-CONTEXT.md addendum). This is a NEW finding of this re-verification, not inherited from round 1 (round 1's own 13 deferred findings ARE properly recorded, each with a re-open trigger, in 253-03-PLAN.md's `<deferred>` block)."
  regressions: []
gaps:
  - truth: "Every review finding this phase produced is recorded somewhere a future reader will find it (this project's own standing principle: 'a fact in a register nobody re-reads is the same as no fact')"
    status: partial
    reason: "253-REVIEW-R2.md's 2 blockers were fixed (verified). Its 7 warnings + 6 info were not fixed AND were not written into any register — not a SEED, not STATE.md, not a 253-CONTEXT.md addendum, not 253-03-PLAN.md's <deferred> block (which only covers round 1's OWN findings, filed before R2 existed). STATE.md's only reference to 253-REVIEW-R2.md is a forward pointer to the filename, written BEFORE the review's content existed, and never updated after the review or the two fast-fix commits landed."
    artifacts:
      - path: ".planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-R2.md"
        issue: "Contains 7 warnings + 6 info (WR-01..WR-07, IN-01..IN-06 in this review's own numbering) with no re-open trigger recorded outside this one file."
      - path: ".planning/STATE.md"
        issue: "last_activity was last updated by commit 9c2a5cce0, BEFORE 8520dbe6e (which added the actual R2 review content) and before both fast-fix commits. It names the review FILE but not one of its findings, and does not record that 2 blockers were found and fixed after the phase's own verification had already passed 14/14."
    missing:
      - "A register entry (SEED or a 253-CONTEXT.md/STATE.md addendum) enumerating each of the 7 warnings + 6 info from 253-REVIEW-R2.md with a concrete re-open trigger, in the same shape 253-03-PLAN.md's <deferred> block already used for round 1's findings."
      - "A STATE.md last_activity update (or superseding entry) naming: the R2 review found 2 more blockers after a 14/14 pass, both were fast-fixed, and the residual 7+6 are open."
deferred: []
human_verification:
  - test: "Push a commit touching `supabase/migrations/**`, `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` or `scripts/check-schema-acl-parity.cjs` to a matching branch (or open a PR), and confirm the `schema-acl-parity` GitHub Actions job actually runs — both steps, `--self-test` first."
    expected: "The job appears in the Actions tab, `node scripts/check-schema-acl-parity.cjs --self-test` passes 37/37 (was 29 pre-phase, 35 after round 1, 37 after the R2-CR-01 fast-fix), and the scan step passes 133/133. A deliberately unmirrored REVOKE in the same push must turn the job RED, and a neutered ACL regex (the R2-CR-01 shape) must ALSO turn it red rather than reporting a false `mirrored: 0/0` pass."
    why_human: "GitHub Actions cannot be executed from this worktree. Confirmed directly this session: `gh run list --workflow=schema-acl-parity.yml` returns `HTTP 404: workflow … not found on the default branch` — it has never run, on any commit. Local `develop` is 190 commits ahead of `origin/develop` (confirmed this session), so nothing in this phase, round 1, or the R2 fast-fixes has reached a branch GitHub Actions would build."
  - test: "Push the two R2 fast-fix commits (or any commit since) so `backend-tests.yml` actually executes with psycopg2 installed."
    expected: "The job's 'Run pytest' step no longer aborts at collection; the new 'scripts/ parity fences (must pass)' step passes 3/3 files (26 tests). The full-suite step is still expected to report failures at or near the 71-failure baseline — that step is diagnostic only, per the fix's own commit message, and was never claimed to go green."
    why_human: "`gh run list --workflow=backend-tests.yml --limit 8` (run this session) shows the last 8 runs are all `failure`, dated 2026-09-08 through 2026-09-13 — all BEFORE the R2 fast-fix. No pushed commit exists yet that exercises the fixed job."
---

# Phase 253: The bootstrap artifact tells the whole truth — Re-Verification Report

**Phase Goal:** A database born from `supabase/full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail.

**Re-verified:** 2026-09-17T14:10:00Z (UTC) · repo `develop` @ `71affadd1` (190 commits ahead of `origin/develop`)
**Status:** `gaps_found` — every ROADMAP success criterion is independently re-driven and holds (this is NOT a regression of the phase's core deliverable); one bookkeeping gap found in how this phase recorded its own round-2 review findings (listed above); the CI-execution item from the prior verification is still unexecuted.
**Re-verification:** **Yes** — against the same phase after gap-closure round 1 (`253-03`, merged `feb3d4752`) plus two G-3 fast-fixes (`3cedc6e51`, `71affadd1`) that closed a fresh round-1-review-of-round-1 (`253-REVIEW-R2.md`).
**Verification mode:** ⛔ `self-verified` — the **sixth** consecutive self-verified phase this milestone (`DEBT-06`, `BUS-257`, filed 2026-09-16, still `[OPEN]` on the agent bus with generic pre-round-1 scope — it does not yet name the R2 findings).

---

## Why this needed re-verification, not a rubber stamp

The prior `253-VERIFICATION.md` (superseded block preserved verbatim below) passed **14/14 with zero gaps**, on the tree as it stood immediately after `253-01` + `253-02`. A code review of that exact tree (`253-REVIEW.md`) then found 2 criticals the verification had missed. A gap-closure round (`253-03`) fixed those. **A code review of THAT round (`253-REVIEW-R2.md`) then found 2 MORE blockers, in the round-1 fix itself** — the parity gate's own non-vacuity floor could still pass over a collapsed parse, and the CI job the round widened had never run a single test. Both were fast-fixed. This is now the **third** consecutive round in which a guard-fixing round shipped its own version of the exact defect class the phase exists to eliminate (vacuous pass, guard invoked by nothing). That pattern is itself evidence for treating "SUMMARY says fixed" as a claim, not a fact, at every level — including this one.

Every criterion below was **re-driven by this verifier, in this session, in its own process**, against the tree as it stands after `71affadd1` — not read from `253-03-SUMMARY.md`, `253-REVIEW-R2.md`, or `STATE.md`.

---

## Goal Achievement — re-driven this session

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence (measured by ME, this session) |
|---|---|---|---|
| SC#1 | A greenfield deploy cannot read the OAuth ciphertext (`connector_tokens` as `authenticated`) | ✓ VERIFIED | Ran `./backend/venv/Scripts/python.exe scripts/check-greenfield-privileges.py` end to end: **exit 0**. `[control] SELECT id … -> the read SUCCEEDED` (proves the table is reachable at all); `[SC#1] SELECT access_token_ciphertext … -> InsufficientPrivilegeError: permission denied`; same for `refresh_token_ciphertext`. `pg_class.relacl connector_tokens = {postgres, service_role}` only. `teardown verified: pg_database has 0 rows for greenfield_acl_122676_1789653131` — the scratch DB this run created is gone; the operator's cluster was not otherwise touched. This is the FIRST re-run of the harness since round 1's `CR-02` ported a new lexer into this exact script — confirms no regression. |
| SC#2 | Every column `_TABLE_SELECTABLE_KEYS` names is readable on a fresh DB | ✓ VERIFIED | Same run: `[SC#2] supplement §5 grants 20 columns on public.connector_connections` / `[SC#2] all 20 are readable as authenticated`. |
| SC#3 | Deleting the single `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` line makes the gate exit non-zero | ✓ VERIFIED | Driven directly on the REAL `supabase/full-schema.sql` (not a scratch copy) with an immediate restore: `sed -i '7901,7903d' supabase/full-schema.sql` (all three sibling REVOKE lines for that function) → `node scripts/check-schema-acl-parity.cjs` → **exit 1**, output names the tail divergence and instructs the fix. Restored from a pre-drive copy; `md5sum supabase/full-schema.sql` = `a4f570396a44035102567ec1e3b7ff62` both before and after; `git status --short supabase/` empty after restore. |
| SC#4 | A `--` inside a string literal cannot hide a following ACL | ✓ VERIFIED | `aclsIn("COMMENT … IS 'a value -- with a double dash…'; REVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;")` produces the **identical** parsed tuple to the no-dash control (same `key`, `verb`, `signature`, `grantee`). Live case re-confirmed: `statements()` over the real `supabase/migrations/180_app_settings_self_hosted_endpoints.sql` yields **5 chunks**, of which **3** are `COMMENT ON COLUMN` — matching `grep -c "COMMENT ON COLUMN"` on the real file (**3**), so the shipped splitter no longer collapses them. |
| SC#5 | The absent ledger rows exist with same-commit sections, and the CR-08 triples are re-derived | ✓ VERIFIED (unchanged since round 1) | Rows and sections still present at the commit the prior verification cited (`22972ca6e`); nothing in round 1's fix or the R2 fast-fixes touches `docs/HOT-FILE-LEDGER.md` or `CLAUDE.md`'s ledger row for these three files. Not re-driven a second time — no code path that could regress it changed. |

**Score: 5/5 ROADMAP success criteria independently re-driven and holding.**

### The two things that actually changed since the prior verification — re-driven, not read

| # | What changed | Independently re-driven this session |
|---|---|---|
| R2-CR-01 fix | `MIN_ACL_TUPLES = 100` non-vacuity floor added to `analyse()` | Copied the gate to `scripts/_scratch-neutered-gate.cjs` inside the real `scripts/` dir (so its relative-path resolution of `supabase/migrations/` still works), replaced `(REVOKE\|GRANT)` with `(ZZNEVERA\|ZZNEVERB)` in both `FUNC_ACL_RE` and `TABLE_ACL_RE`, ran it: **exit 2**, `FATAL: Error: only 0 ACL tuple(s) parsed from 148 migration file(s) … below the floor of 100 … a PARSER regression, not an empty repository`. Deleted the scratch file immediately after; `git status --short scripts/` empty. **This is exactly the shape the reviewer drove and exactly the fix's own claim — confirmed independently rather than taken on the fix commit's word.** |
| R2-CR-01 fix, self-test | `--self-test` grew from 35 to 37 arms | `node scripts/check-schema-acl-parity.cjs --self-test` → **37/37**, including the two new arms (`TUPLES: a collapsed PARSE is a harness error, never a pass` and `TUPLES: the shipped floor does NOT fire on the real tree (counterfactual)`), both PASS. |
| R2-CR-02 fix | `backend-tests.yml`: `psycopg2-binary` installed, `--continue-on-collection-errors` added, dedicated fences-only step added | Ran the three named modules directly: `pytest tests/unit/test_253_supplement_column_parity.py tests/unit/test_253_greenfield_sql_lexer.py tests/unit/test_253_ci_path_coverage.py -q` → **26 passed**, exit 0 — matches the CI step's own command exactly. Confirmed `psycopg2` is importable in the local venv (2.9.11) and confirmed it is deliberately **absent** from `backend/requirements.txt` (`grep -i psycopg2 requirements.txt` → empty), matching the commit's "test-only, not an app dep" claim. |
| Backend baseline, unaffected | The full pytest run must still read the CLAUDE.md-locked ceiling | `pytest tests/unit -q --continue-on-collection-errors` (the canonical gate command) → **71 failed, 4897 passed, 2 xfailed, 2 xpassed, 0 collection errors**, in **225.10s**. `grep -c "^FAILED"` = 71; unique files in the failing set = 24. Exactly the ceiling this milestone locked, exactly the figure `253-03-SUMMARY.md` and `STATE.md` both already claim — independently reproduced, not re-typed from either. |
| Gate real-tree scan, unaffected | The floor must not fire on a healthy tree | `node scripts/check-schema-acl-parity.cjs` (no flags) → `mirrored: 133/133`, **exit 0**, tail `653 lines · md5 da9c561634d417ebd289bedf07b75f69`. |
| G-7 round cap | The R2 fixes were fast-fixed, not stacked as a formal round 2 | `node scripts/check-gap-closure-rounds.cjs 253` → `rounds completed: 1 (cap is 2)`, **G-7 clear**. Consistent with the fixes' own commit prefixes (`fix(253)`, `ci(253)`, not `docs(253-04)`/a new PLAN.md) — this was G-3-shaped triage of a fresh review, not a second planned round. |
| `supabase/full-schema.sql` untouched by drives | Every mutation this session was reverted | `md5sum supabase/full-schema.sql` = `a4f570396a44035102567ec1e3b7ff62`, matching the value the orchestrator's pre-brief table quoted, both before my SC#3 drive and after the restore. `git status --short` clean on every tracked path I touched. |

---

### Required Artifacts — status unchanged from the prior verification except where noted

| Artifact | Status | Details |
|---|---|---|
| `scripts/check-schema-acl-parity.cjs` | ✓ VERIFIED, materially changed since prior verification | +86 lines net for `MIN_ACL_TUPLES` + 2 self-test arms (R2-CR-01 fix). Exports unchanged shape; `MIN_ACL_TUPLES` added to `module.exports`. |
| `.github/workflows/backend-tests.yml` | ✓ VERIFIED, materially changed since prior verification | +psycopg2-binary install, `--continue-on-collection-errors`, new "scripts/ parity fences (must pass)" step. Still **not driven in CI** — see human_verification. |
| `.claude/hooks/schema-acl-parity-guard.js` | ⚠ UNCHANGED SINCE ROUND 1 — one R2-CR-01 suggestion NOT taken | The reviewer's proposed fix for CR-01 included having the hook run `--self-test` before trusting a scan-mode exit code. **That specific suggestion was not implemented** — the hook still calls the gate with no flags. This is *less* consequential than it would otherwise be, because `MIN_ACL_TUPLES` now lives inside `analyse()` itself and fires on the plain scan path too (confirmed by my own drive above, which used the plain gate, not `--self-test`) — so the hook is not blind to this specific defect class even without the suggested change. Not a gap; recorded so the deviation from the reviewer's literal suggestion is not silently inherited as "done as proposed." |
| `scripts/check-greenfield-privileges.py` | ✓ VERIFIED, re-run end to end this session | Confirmed no regression from round 1's `CR-02` lexer port: exit 0, SC#1/SC#2 both hold, teardown clean. |
| `docs/HOT-FILE-LEDGER.md` / `CLAUDE.md` rows | ✓ VERIFIED, unchanged | Not touched by round 1's fix or the R2 fast-fixes; still at commit `22972ca6e` as the prior verification recorded. |
| `253-REVIEW-R2.md` | ✓ EXISTS, its 2 blockers closed, its 7 warnings + 6 info **not dispositioned in any other register** | See the gap in frontmatter. This is the one artifact-level finding new to this re-verification. |

---

### Key Link Verification — unchanged from the prior verification, all still ✓ WIRED

`full-schema-supplement.sql` ↔ `full-schema.sql` tail identity, `test_253_supplement_column_parity.py` → `connector_service._TABLE_SELECTABLE_KEYS`, `check-greenfield-privileges.py` → `supabase/migrations/`, `.claude/settings.json` → `schema-acl-parity-guard.js` → `check-schema-acl-parity.cjs`, `CLAUDE.md` ↔ `docs/HOT-FILE-LEDGER.md` same-commit rows — none of these links were touched by round 1 or the R2 fast-fixes, and none regressed. Re-confirmed by re-running the artifacts on both ends of each link (above), not re-asserted from the prior report.

**New link, added by the R2 fast-fix, driven this session:**

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `.github/workflows/backend-tests.yml` | `backend/tests/unit/test_253_*.py` (3 modules) | dedicated "scripts/ parity fences (must pass)" step | ✓ WIRED, locally reproduced | Ran the exact command the step specifies: 26 passed, exit 0. **Not yet proven IN CI** — see human_verification. |
| `.github/workflows/backend-tests.yml` | `psycopg2` | `pip install psycopg2-binary` (new step) | ✓ WIRED, locally reproduced | Confirmed importable; confirmed deliberately absent from `requirements.txt` (test-only). |

---

### Anti-Patterns Found

Zero `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in the two files the R2 fast-fixes touched (`scripts/check-schema-acl-parity.cjs`, `.github/workflows/backend-tests.yml`) — confirmed by direct grep this session. No debt-marker gate fires.

---

### Requirements Coverage

Unchanged from the prior verification: `CRED-03` and `CRED-04` both re-closed in code, both re-confirmed above by independent drive. The prior verification's WARNING about `REQUIREMENTS.md:108`/`:287` not being updated for `CRED-04` was not addressed by round 1 or the R2 fast-fixes — carried forward, still bookkeeping-only, still not a goal miss.

---

## Findings (this re-verification's own)

### ⚠ WARNING (NEW) — `253-REVIEW-R2.md`'s 7 warnings + 6 info are unrecorded outside the review file itself

**This is the one thing that is different in kind from everything else in this report**, and it is why `gaps:` is non-empty despite all 5 ROADMAP success criteria holding.

Round 1's OWN 13 deferred findings (from `253-REVIEW.md`) are properly handled: each has a named re-open trigger inside `253-03-PLAN.md`'s `<deferred>` block (verified in this session — `WR-01`, `WR-03`, `WR-04`, `WR-05`, `WR-07`, `WR-09`, `WR-10`, `WR-11`, `IN-01`..`IN-05` are all there, each with a trigger). That is the correct shape, and this project used it correctly once.

**The R2 review's own residue got no equivalent treatment.** `253-REVIEW-R2.md` records 7 warnings (WR-01..WR-07 in ITS OWN numbering — note these are different findings from round-1's WR-01..WR-11, sharing only the label) and 6 info items (IN-01..IN-06). Two are fixed (the blockers, confirmed above). The rest — including WR-01 (self-test arm 5e's CRLF counterfactual converts nothing, so it cannot fail), WR-04 (a docstring this phase itself added makes a false claim about `ON ALL TABLES IN SCHEMA` divergence — re-confirmed false by me this session, see below), and WR-05 (an `E'…'` escape string defeats both lexers identically, confirmed latent — zero occurrences in the repo today, re-confirmed by me this session) — have:

- no `SEED-NNN` (confirmed: `ls .planning/seeds/ | grep -oE "SEED-[0-9]+" | sort | tail` shows the newest is still `SEED-289`, planted before this phase; no new seed exists);
- no line in `STATE.md` (confirmed: the only STATE.md text mentioning `253-REVIEW-R2.md` was written by commit `9c2a5cce0`, which **predates** `8520dbe6e` — the commit that actually wrote the review's content — so it is a forward pointer to an empty promise, never updated after the fact);
- no addendum in `253-CONTEXT.md`;
- no entry on `.agent-bus/OPEN.md`'s `BUS-257` (confirmed: that item was filed 2026-09-16, at plan time, before round 1 OR the R2 review existed, and still reads its original generic scope).

I independently re-verified two of the six "info" claims to confirm they are not merely unfixed but genuinely unaddressed anywhere:
- **WR-04's claim** ("`ON ALL TABLES IN SCHEMA` — no divergence found, both lexers return nothing") — this is a **correction of a docstring the phase itself shipped**, and the correction itself has not been applied to the docstring either; the stale claim still stands in `check-greenfield-privileges.py`.
- **WR-05's claim** ("no `E'` literal exists in the repo today, so the shared defect is latent") — re-ran `grep -rnE "(^|[^A-Za-z0-9_])E'" supabase/migrations/ scripts/full-schema-supplement.sql supabase/full-schema.sql` myself: **0 matches**, confirming the claim and confirming the risk is real-but-dormant, exactly the kind of fact this project's seeds register exists to hold with a trigger (WR-05's own suggested trigger: "the first migration that writes an `E'` literal").

**Why this matters given this project's own stated principles:** CLAUDE.md states, verbatim and repeatedly, that *"a fact in a register nobody re-reads is the same as no fact"* and that *"`status:` frontmatter IS the index — prose inside the body saying 'still open' is invisible to the scan."* A review finding that lives only inside a review markdown file, never indexed anywhere the seeds-sweep, the bugs-sweep, or a STATE.md reader would find it, is exactly that failure mode, one register over.

**This is NOT a reason to reopen a gap-closure round.** Per G-7, a closure round may never be manufactured to fix cosmetic/latent items when every ROADMAP success criterion is already met — and here, none of the 13 remaining R2 items threaten SC#1-SC#5. **This is a `/gsd:fast`-sized recording task**: write the 7+6 into a register (a single new SEED enumerating all 13 with their already-drafted re-open triggers — the review text already contains publishable trigger language for each — is the cheapest correct shape, mirroring round 1's own `<deferred>` block) and update `STATE.md`'s `last_activity` to say plainly that the R2 review found 2 more blockers after a 14/14 pass, both were fixed, and 13 items remain recorded-but-unbuilt.

### ⛔ STANDING DEBT (not new, carried forward and its count updated) — `DEBT-06`

`verification_mode: self-verified`, `independent_review: owed` — now the **sixth** consecutive self-verified phase (249, 250, 251, 252, 253's first verification, and this re-verification). `BUS-257` is `[OPEN]` on `.agent-bus/OPEN.md`, filed 2026-09-16 at plan time — confirmed still open, still carrying its original pre-round-1, pre-R2-review scope description. Whoever picks it up should be pointed at the R2 findings explicitly, since the bus item predates them.

### ℹ️ INFO — the R2 fast-fixes exceeded G-3's own line-count guidance, without ceremony

`71affadd1` is +73/-13 to one file (86 changed lines); `3cedc6e51` is +19/-1 to one file. CLAUDE.md's G-3 describes lightweight work as "≤ 1 file, ≤ 10 lines of source change." Both fixes stayed to one file each (satisfying the *ceremony* half of G-3 — no discuss/plan cycle was run, which is correct given the finding was a driven, narrow blocker) but exceeded the line-count figure named in the rule. Recorded as an observation, not a gap: the fixes are correct and independently verified above, and G-3's line count is descriptive guidance for when to skip ceremony, not a hard cap enforced by any gate.

---

## Human Verification Required (carried forward, one item strengthened)

### 1. The `schema-acl-parity` CI job has never executed (unchanged from the prior verification)

**Test / Expected / Why human:** as the prior verification stated — re-confirmed this session with `gh run list --workflow=schema-acl-parity.yml` → `HTTP 404: workflow … not found on the default branch`. **Strengthened expectation:** the job must ALSO go red on a neutered-regex parser regression (the R2-CR-01 shape), not just on a plain unmirrored REVOKE — because the self-test count that must read 37/37 is what proves the new floor shipped, not just the pre-existing 35.

### 2. `backend-tests.yml` has never been green with the R2-CR-02 fix applied

**Test:** Push any commit past `3cedc6e51` and observe the next `backend-tests` run.
**Expected:** Collection no longer aborts; the dedicated "scripts/ parity fences (must pass)" step passes 26/3-files; the full-suite step is allowed to still report failures near the 71 baseline (that step was never claimed to go green).
**Why human:** `gh run list --workflow=backend-tests.yml --limit 8` (this session) shows the last 8 runs, 2026-09-08 through 2026-09-13, all `failure` — all predate the fix. `develop` is 190 commits ahead of `origin/develop` (confirmed this session); nothing has been pushed since.

---

## Gaps Summary

**All five ROADMAP success criteria hold, independently re-driven in this session against the current tree — the phase's core deliverable is real and has not regressed.** The two blockers a fresh review found in round 1's own fix (`253-REVIEW-R2.md`'s CR-01/CR-02) are genuinely closed; I reproduced both the pre-fix failure shape and the post-fix pass independently rather than trusting the fix commits' own messages.

**One gap is new to this re-verification and is recorded in frontmatter:** the R2 review's own 7 warnings + 6 info have not been written into any register a future reader would find — not a seed, not STATE.md, not a CONTEXT addendum — breaking this project's own repeatedly-stated rule about registers. This does not reopen any success criterion and does not warrant a gap-closure round (G-7); it is a `/gsd:fast`-sized recording task, and the recommended shape (one SEED enumerating all 13, mirroring round 1's own `<deferred>` block) is named above.

**The CI-execution item is unchanged from the prior verification and remains genuinely undrivable from this worktree** — `develop` is 190 commits ahead of `origin/develop`, so neither `schema-acl-parity.yml` nor the fixed `backend-tests.yml` has ever run against code past `69f06cef0`.

**Recommendation:** do not open a gap-closure round 2. File the recording task (SEED + STATE.md update) as a direct `/gsd:fast` edit, and treat the CI-execution items as owed human verification at the next push — exactly the disposition the prior verification already gave the CI item, extended to cover the R2 fixes.

---

## SUPERSEDED — the original verification, preserved verbatim (do not delete)

*(Written 2026-09-16T20:40:54Z, against `develop @ 69f06cef0`, BEFORE `253-03` gap-closure round 1 and BEFORE `253-REVIEW-R2.md` existed. Its verdict of 14/14 for the tree AS IT THEN STOOD is not disputed by this re-verification — every one of its individually-driven claims about that earlier tree is left as originally written. What changed is the tree, not the correctness of the original drives.)*

> ---
> phase: 253-the-bootstrap-artifact-tells-the-whole-truth
> verified: 2026-09-16T20:40:54Z
> status: human_needed
> score: 14/14 must-haves verified
> overrides_applied: 0
> verification_mode: self-verified
> independent_review: owed
> re_verification: false
> gaps: []
> deferred: []
> human_verification:
>   - test: "Push a commit touching `supabase/migrations/**`, `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql` or `scripts/check-schema-acl-parity.cjs` to a matching branch (or open a PR), and confirm the `schema-acl-parity` GitHub Actions job actually runs — both steps, `--self-test` first."
>     expected: "The job appears in the Actions tab, `node scripts/check-schema-acl-parity.cjs --self-test` passes 29/29, and the scan step passes 133/133. A deliberately unmirrored REVOKE in the same push must turn the job RED."
>     why_human: "GitHub Actions cannot be executed from this worktree. `253-02-SUMMARY.md` states this in writing rather than claiming it — the workflow file exists, parses under js-yaml, and both of its command strings were reproduced locally (exit 0 clean / exit 1 against a planted defect), but the job itself has never run. This is the one half of MC-4 that is owed."
> ---
>
> # Phase 253: The bootstrap artifact tells the whole truth — Verification Report
>
> **Phase Goal:** A database born from `supabase/full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail.
>
> **Verified:** 2026-09-16T20:40:54Z (UTC) · repo `develop` @ `69f06cef0`
> **Status:** `human_needed` — every ROADMAP success criterion is met; one CI-execution item cannot be driven from here
> **Re-verification:** No — initial verification
> **Verification mode:** ⛔ `self-verified` — the fifth consecutive phase this milestone (`DEBT-06`, `BUS-257`). Recorded as standing debt, not as a finding of this phase.
>
> [The original report's full body — "How this phase was verified", the 14-row Observable Truths table (SC#1 through SC#5, the greenfield-harness RED/GREEN reconstruction, the derived-assertion-set proof, the pytest fence, D-11, the table/column reach, the ordering-out-of-scope prose, the four new self-test arms, MC-4's hook drive, and SEED-266 arm (a)), the Required Artifacts table, the Key Link Verification table, the Independent Adversarial Drives section (hook payloads, table-half RED drives), the SC#5 twelve-triples re-derivation table, the two accepted Deviations, the CRED-04 REQUIREMENTS.md WARNING finding, the DEBT-06 standing-debt note, the six Carry-forward observations, and the Gaps Summary concluding "There are no gaps" — is preserved unabridged in git history at this file's state as of commit `ea05fd042` (`docs(253): phase verified — 14/14, 5/5 success criteria, 0 gaps`). Retrieve with `git show ea05fd042:.planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-VERIFICATION.md` rather than re-pasting ~200 lines here a second time — the content is unchanged from what `git show` returns, and duplicating it inline would risk a silent transcription drift between the two copies.]
>
> _Verified: 2026-09-16T20:40:54Z_
> _Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance_
> _⛔ `verification_mode: self-verified` · `independent_review: owed` (DEBT-06, BUS-257) — fifth consecutive phase_

---

_Re-verified: 2026-09-17T14:10:00Z_
_Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance, re-verification mode_
_⛔ `verification_mode: self-verified` · `independent_review: owed` (DEBT-06, BUS-257) — sixth consecutive phase_
