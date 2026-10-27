---
phase: 296-close-v4-7-debt
verified: 2026-10-27T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
verified_at_head: d9b08b06b
status: passed
independent_review: self
score: 3/5 ROADMAP success criteria verified (SC#1 FAILED on the record, SC#4 PENDING on the vitest count gate)
overrides_applied: 0
gaps:
  - truth: "SC#1: every item in the 296 inventory reads fixed, accepted-with-reason, or moved-to-v4.8-as-a-seed"
    status: failed
    reason: >-
      The coverage loop passes (133 IDs, 0 missing), but the Outcome table was last written at 996f527c8
      (296-05) and never re-synced after the 15 post-execution commits. Several rows still say
      something other than fixed / accepted / seeded, although the work is done and the evidence exists.
    artifacts:
      - path: ".planning/phases/296-close-v4-7-debt/296-INVENTORY.md"
        issue: >-
          Outcome rows are out of date. 293-F-4 reads "PARTLY fixed ... NOT closed; a G-7 routing decision",
          but it was fixed by a7a09f269 (RED 1f5fa6283), and evidence/roster/pinned-emit-*.json reads PASS 6/6
          with emit_validated_providers [openai]. 293-INH / 295-TEST reads "PENDING". 293-IN-03 still
          records the chunked-body residual as "accepted via nginx", but that residual was fixed by
          dbc43dbc1 (AR-05). Eleven or more "⏳ G-4 #N" rows were never flipped, although every named
          G-4 row now PASSes. The "live backend predates 296-06" row and the 292.1-IN-01/02 "re-run
          owed" rows were never updated after the dde894f24 re-runs.
      - path: ".planning/phases/296-close-v4-7-debt/296-HUMAN-UAT.md"
        issue: >-
          The section (c) board table and the section (d) cross-provider axis are out of date. They still
          say "gpt-5.6-luna pins 5/5 FAIL", "Not closed; a G-7 routing decision" and "resume re-run after
          restart". The committed evidence files read PASS: pinned-emit 6/6 and resume-model 6/6, with
          metadata_provider equal to the run provider. The dde894f24 commit message records the same
          result.
    missing:
      - "Re-sync the Outcome table rows named above to their final word (fixed + commit / accepted / seeded)"
      - "Re-sync HUMAN-UAT (c)/(d) to the committed post-fix roster evidence"
  - truth: "Phase goal: no defect v4.7 found is carried silently (296's own review findings)"
    status: failed
    reason: >-
      The 296-REVIEW.md triage table has 2 rows and is out of date. FE-CR-01 still reads "pending",
      although it was fixed at 492c7ddb0. Of the 9 warnings, 7 were fixed (merge 3e5a84819 plus
      dbc43dbc1) and BE-WR-01 was seeded as SEED-388. BE-WR-03 has no disposition anywhere. It was
      introduced by this phase (needs_typed_task, 04618f10e, 2026-10-27). It falsely refuses a workflow
      whose only inputs are Look-it-up (kb_auto) inputs: the key picker greys it out as needs_task,
      create_key refuses it, and an inbound start returns needs_task. The only other mention is in
      296-SECURITY T-296-30, which calls it "an over-refusal, fail-closed, not a security gap". That
      line is not a disposition. None of the 10 info findings (BE-IN-01..04, FE-IN-01..06) has a
      disposition either.
    artifacts:
      - path: "backend/app/services/inbound_inputs.py"
        issue: "needs_typed_task returns `not declared_fields(...)` (drops kb_auto), unlike the browser's entryInputFields, which uses raw inputs[] (review BE-WR-03)"
      - path: ".planning/phases/296-close-v4-7-debt/296-REVIEW.md"
        issue: "Triage table lists only BE-CR-01 / FE-CR-01; FE-CR-01 out of date; 9 warnings + 10 info undispositioned in the record"
    missing:
      - "BE-WR-03: fix it (the change is about 5 lines, /gsd:fast under G-3, with a RED test), or accept it or seed it with a written reason"
      - "Complete the 296-REVIEW.md triage table: one disposition line per finding (21), including BE-WR-01 -> SEED-388"
human_verification:
  - test: "Vitest count gate (re-run in progress by the orchestrator at verification time)"
    expected: "GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs -> count gate OK (no per-file decrease, 0 failing), new 296 test files pinned. This also closes inventory row 293-INH / 295-TEST"
    why_human: "Instructed not to run it; result pending"
---

# Phase 296: Close v4.7 Debt — Verification Report

**Phase goal:** Every defect v4.7 found and deferred is fixed, or explicitly accepted with a reason, so the milestone closes with no open bug carried silently. No new capability.
**Verified:** 2026-10-27 at HEAD `d9b08b06b`
**Status:** gaps_found. Both gaps are small: record re-syncs plus one fix of about 5 lines. The vitest count gate is pending.
**Re-verification:** No. This is the initial verification.

## Bottom line

The code-level work is real, and it holds where I checked. The live G-4 drive is backed by real
screenshots and DB evidence. The security fixes are in the code. The post-fix roster evidence is
6/6 on every reachable provider. What fails is the record:

- the inventory Outcome table and the HUMAN-UAT board were not re-synced after the 15
  post-execution commits;
- one warning that 296 introduced itself (BE-WR-03) and 10 info findings have no written
  disposition.

The phase goal forbids carrying a defect silently, so these are gaps, not notes. Every item is
≤ 10 lines or docs-only. Under G-3/G-7 this is `/gsd:fast` work, not a gap-closure round. This
phase has had 0 rounds, and no ROADMAP SC is unmet in code.

## ROADMAP success criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Every inventory item reads fixed / accepted / seeded; none silently dropped | ✗ FAILED (record only) | The coverage script, re-run read-only (`python -I .../outcome-coverage.py`), gives `inventory row IDs: 133 · outcome rows: 138 · missing: 0`, exit 0. So nothing is DROPPED. But the table is out of date: 293-F-4 still reads "NOT closed" (fixed `a7a09f269`, board PASS); 293-INH/295-TEST reads "PENDING"; and the ⏳ G-4 rows were never flipped. See gap 1. Operator rows (OpenRouter top-up, Moonshot, DEPLOY, 294-ENV, 286-V-2) carry their reasons, which is acceptable. |
| 2 | Each fixed bug has a RED-first test, and each closed bug report reads `status: closed` with the fixing commit | ✓ VERIFIED | 11 of the 12 `folded_into: "296"` reports read `status: closed`, `verified_closed_by: "296"`, `fixed_by_commit:` with RED+GREEN SHAs. BUG-261025-02 is CSS-only: under D-19 it is exempt from RED and was checked live (G-4 #7 PASS). BUG-261020-03 was fixed pre-296 at `6d14ccf59` and re-verified (3 passed). Post-exec fixes are RED-first: `1f5fa6283`→`a7a09f269`, `d34d1b115`→`51ec89cfc`, `0429bc53c`→`492c7ddb0`, `2846a572d`→`1129aaa5c`, `c8b5427c1`→`dbc43dbc1`, `6a6791309`→`aac1a6d5b`, and the 6 WR RED/fix pairs in the merge. |
| 3 | Security items closed: keys not in LangSmith traces (BUG-261020-03); folder/workflow create honours `X-Org-Id` (BUG-261021-02) | ✓ VERIFIED | Every `@traceable` / `@_ls_traceable` under `backend/app/` binds `process_inputs=redact_inputs`; a grep for decorators without it finds only comments. `api/folders.py:62-95`: `resolve_active_org_or_none`, a cross-org parent gets 404, and the row is stamped with `org_id`. `api/workflows.py:1216-1221`: `create_workflow_definition(..., org_id=...)`. G-4 #1 PASS with DB evidence (`evidence/g4/1-two-org-db.json`). 296-SECURITY 44/44 closed. |
| 4 | Gates: backend ≤ 71, vitest count gate OK, tsc no new errors, ledger / seeds / CLAUDE.md-size clear | ? PENDING (vitest) | Backend: 69 failures (orchestrator, twice). `evidence/gates/backend-fail-set-close.txt` has 69 ids in 22 files and 0 `test_296*`. I did not re-run it, as instructed. **tsc, re-measured by me at HEAD:** 62 errors, set-identical to `evidence/gates/tsc-head-file-code-set.txt`, so the post-exec frontend commits added none. **Re-run by me:** CLAUDE.md size OK; ledger OK (695 rows · 165 subject · 99 watched); seeds register OK (397/397). **Vitest count gate:** pending (re-run in progress, not run here). |
| 5 | User-visible fixes driven live in Chrome (G-4) before close | ✓ VERIFIED | `296-HUMAN-UAT.md`: scenarios 1-8 PASS, with scenario 3 passing after the `1129aaa5c` fix. Optional rows 9 and 10 PASS; 11 and 12 PASS after fixes `a04c6d759` and `aac1a6d5b`. Screenshots exist for every row except the row-11 re-drive, which records DOM measurements inline (scrollTop 2057, rect 419-545 inside 86-546). I viewed `3-followed-PASS-after-fix.jpg` (answer rendered, panel shows `Unsourced · continued by …`) and `2-colleague.jpg` (step 1 and step 2 withheld with their words, sources masked). Both are genuine. |

**Score:** 3/5 verified, 1 failed (record), 1 pending.

## Bug reports folded into 296 (check 3)

| Report | Status | G-4 row | Verdict |
|---|---|---|---|
| BUG-261020-03 LangSmith keys | closed / 296 | n/a (backend; test + AST sweep) | ✓ |
| BUG-261021-02 X-Org-Id | closed / 296 | #1 PASS | ✓ |
| BUG-261021-03 / -04 followed run | closed / 296 | #3 PASS after fix | ✓ |
| BUG-261021-05 escalated seal | closed / 296 | opt. #9 PASS | ✓ |
| BUG-261024-02 draft lost | closed / 296 | opt. #10 PASS | ✓ |
| BUG-261024-04 follow-up files | closed / 296 | #8 PASS | ✓ (the intermediates half is SEED-383) |
| BUG-261025-01 Run now | closed / 296 | #5 PASS | ✓ |
| BUG-261025-02 title crushed | closed / 296 | #7 PASS | ✓ |
| BUG-261025-03 expired ask cards | closed / 296 | #4 PASS | ✓ |
| evidence-page withheld substance | closed / 296 | #2 PASS | ✓ |
| BUG-261024-01 Moonshot | **folded** | ⛔ live 429 | ✓ open with a recorded reason. The `re_open_trigger` names the account reinstatement and the exact board command. Unit-proven (`test_296_moonshot_schema.py`, passes). |
| BUG-261024-03 OpenRouter | folded into **292.1** (not 296) | ⛔ live 402 | ✓ open with a recorded reason. The `re_open_trigger` names the top-up and `run-2921-board.py --providers openrouter`. |

Three new minor reports were filed during the drive (BUG-261027-01/02/03): status `open`, each with a
fold trigger. Together with SEED-388..390, they are routed rather than carried silently.

## Spot-checks of fixes (check 4)

| Fix | Code | Test |
|---|---|---|
| 293-F-4: pinned cross-provider emit | `forced_emit.py:470-473`: the settings copy now carries `active_provider: provider`, so `resolve_api_surface` resolves under the pinned provider | `test_296_pinned_emit_surface.py`. Board: `pinned-emit-*.json` PASS for 6/6 providers pinned to `gpt-5.6-luna` (`emit_validated_providers: [openai]`, `has_400: false`) |
| AR-05: chunked inbound body cap | `api/inbound.py` `_BodyCapRoute`: no Content-Length → count the stream, 413 at `INBOUND_MAX_BODY_BYTES`, then cache `request._body` | `test_296_kickoff_and_keys.py` |
| BUG-261021-02 / BE-WR-06: create_folder | `api/folders.py:51-96`: validated active org, cross-org parent 404, and both supabase-py calls via `aexec` (off the loop) | two-org integration test (recorded 13 passed; not re-run, because it mutates the DB) |
| G-4 S3: re-drive stream end | `api/runs.py:887-903`: after finalize, emit the terminal sentinel and EXPIRE. `StreamsProvider.tsx`: `onRunCompleted` ends the follow segment | `2846a572d` RED tests. G-4 #3 PASS after fix |

Targeted run, by me: `pytest test_296_kickoff_and_keys.py test_296_pinned_emit_surface.py
test_296_engine_touches.py test_trace_key_redaction.py test_296_moonshot_schema.py` → **61 passed**.

## Anti-patterns / notes

| File | Line | Note | Severity |
|---|---|---|---|
| `backend/app/api/runs.py` | 902 | `except BaseException:` swallows `CancelledError`. It sits at the very end of a background task and matches lines 198 and 345 of the same file, so the impact is negligible | ℹ️ Info |
| `backend/app/services/inbound_inputs.py` | ~130 | BE-WR-03 over-refusal (see gap 2) | ⚠️ Warning |
| `.planning/ROADMAP.md` | 296 plan list | `296-05` still `[ ]` and progress reads `6/7 · In Progress`. The orchestrator flips this at close | ℹ️ Info |
| `evidence/roster/created.json` | — | uncommitted modification in the working tree | ℹ️ Info |

No debt markers (TBD/FIXME/XXX) were found in the spot-checked diffs.

## Gaps summary

1. **The records are out of date (SC#1).** `296-INVENTORY.md` → Outcome and `296-HUMAN-UAT.md` (c)/(d)
   still describe the 296-05 checkpoint: 293-F-4 "NOT closed", resume "re-run after restart",
   ⏳ G-4 rows, 293-INH "PENDING". The committed evidence says otherwise. This is a docs-only re-sync.
2. **296's own review is not fully dispositioned (phase goal).** BE-WR-03 was introduced by 296-06. It
   wrongly refuses all-kb_auto workflows for API keys and inbound starts, and it has no fix, accept or
   seed. The 10 info findings and the out-of-date FE-CR-01 row also lack a disposition line. Fix
   BE-WR-03 with RED first (about 5 lines, `/gsd:fast`), or accept or seed it in words, and complete
   the triage table.
3. **Pending, not a gap:** the vitest count gate (SC#4). Its OK verdict also closes inventory row
   293-INH / 295-TEST.

These items are ≤ 10 lines or docs-only. G-7 says route them to `/gsd:fast`, not to
`/gsd:plan-phase 296 --gaps`.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier), independent_review: self_


## Gap closure 2026-10-27 (orchestrator, G-3 fast fixes — no --gaps round)

1. Records re-synced to the evidence (INVENTORY outcome table + 'Fixed after execution', HUMAN-UAT (c)/(d), REVIEW triage 22 rows, status resolved); outcome-coverage missing 0.
2. BE-WR-03 fixed: RED `3116847ce`, fix `4bd5e640f` (317 inbound/key tests pass).
3. SC#4: vitest count gate OK (12236, 0 failing, no per-file decrease). All five success criteria verified → passed.
4. The six info findings left open go to v4.8 as SEED-391.
