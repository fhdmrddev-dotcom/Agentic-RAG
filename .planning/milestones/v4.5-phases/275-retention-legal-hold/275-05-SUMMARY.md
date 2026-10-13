---
phase: 275-retention-legal-hold
plan: 05
subsystem: retention-close
tags: [retention, legal-hold, g-4, uat, merged-tree-gates, ledger, docs, registers, fast-fix]

requires:
  - phase: 275-01
    provides: "mig 204 (policies, holds, receipts, DB hold refusal) + mig 205 (documents.retrievable in both RPC arms)"
  - phase: 275-02
    provides: "hold_guard on every delete door; ApiRefusal; retentionCopy fence; Find include_archived"
  - phase: 275-03
    provides: "evaluate / preview / sweep / disposition + the /retention API"
  - phase: 275-04
    provides: "Org admin Retention tab + Library retention surfaces"
provides:
  - "275-G4-EVIDENCE.md: SC#1-4 matrix, 7 failure criteria, 44-row threat register, D-31/32/33 fences, three G-4 drives with DB evidence, fast-fixes, known limits, registers, owed operator rows"
  - "Merged-tree gate verdicts in 275-BASELINES.md (backend FAILED SET == base, count gate, tsc set diff, drift, docs, OpenAPI, M-1)"
  - "Ledger close: every 275 file re-derived in CLAUDE.md + docs/HOT-FILE-LEDGER.md"
  - "docs/public/administer/org/retention.md written (A46, E23, router:retention)"
  - "Four G-3 fast-fixes from the G-4 drive (History delete_refused, two-stage folder line, '1 policy', fully-archived empty state)"
  - "Registers: SEED-250 answered, SEED-345 partially-answered, BUG-261004-01 closed, SEED-354 planted, BUG-261012-01/02 filed"
affects: [phase-275-verification, phase-close, production-deploy, SEED-354, SEED-072, SEED-210]

tech-stack:
  added: []
  patterns:
    - "A client sentence built from the server's ORDERED rule text, with a ?raw fence on the server f-string it parses"
    - "A live read as the owner with a rolled-back positive control, so a zero is an exclusion and not a blind probe"

key-files:
  created:
    - .planning/phases/275-retention-legal-hold/275-G4-EVIDENCE.md
    - .planning/seeds/SEED-354-org-wide-legal-hold-matter-by-custodian.md
    - .planning/reported-bugs/BUG-261012-01-watch-purge-never-removes-storage-bytes.md
    - .planning/reported-bugs/BUG-261012-02-delete-document-500-on-a-row-the-caller-does-not-own.md
  modified:
    - docs/public/administer/org/retention.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/phases/275-retention-legal-hold/275-BASELINES.md
    - .planning/seeds/SEED-250-retention-and-archival-is-the-one-absent-dms-capability.md
    - .planning/seeds/SEED-345-per-org-retention-and-rate-limit-settings.md
    - .planning/reported-bugs/BUG-261004-01-search-serves-documents-deleted-or-unshared-at-source.md
    - frontend/src/components/retention/RetentionHistory.tsx
    - frontend/src/components/retention/RetentionFolderLine.tsx
    - frontend/src/components/retention/RetentionTab.tsx
    - frontend/src/components/retention/retentionCopy.ts
    - frontend/src/pages/LibraryPage.tsx
    - frontend/src/components/retention/__tests__/RetentionHistory.test.tsx
    - frontend/src/components/retention/__tests__/RetentionTab.test.tsx
    - frontend/src/components/retention/__tests__/libraryRetention.test.tsx
    - frontend/src/components/retention/__tests__/retentionCopy.test.ts
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "Cross-provider scoreboard NOT APPLICABLE by decision (W-7): the exclusion and the hold refusal are enforced in Postgres and the tool dispatcher before any provider; LIFECYCLE ran on DeepSeek deepseek-v4-flash only"
  - "did_not_delete receipts keep hold_name NULL: the spec sentence names the hold TIME; the receipt's subject is the disposition; several matters can hold one document"
  - "FAIL-2 fixed on the client from the server's ordered rule_text, not by adding an API field (G-3: no API surface)"
  - "BUG-261004-01 closed only after a live as-owner read on every arm with a rolled-back control"
  - "OBS-1 (DELETE /documents 500) filed, not fixed: documents.py is FIRING and D-32 allowed guard calls only"

patterns-established:
  - "UAT-found fixes are recorded with their commits AND an owed re-look at the next UAT"

# Repaired 2026-10-12 (Phase 277, REG-05): requirements-completed was [] and is replaced with the list copied verbatim from 275-05-PLAN.md frontmatter requirements (D-15)
requirements-completed: [RET-01, RET-02, RET-03, RET-04]

duration: ~1.7h (Task 1 + Task 2 by earlier agents; this executor ~25 min)
completed: 2026-10-12
---

# Phase 275 Plan 05: Merged-tree close, G-4 drives, docs and registers — Summary

**The phase was proven on the merged tree, not assumed: every gate ran and its verdict line is recorded, the three operator-agreed G-4 scenarios ran in Chrome with SQL behind each step, and the four defects they found were fixed test-first. BUG-261004-01 is closed by a live read on every retrieval arm, and the production steps are written down for the operator, not performed.**

## Performance

- **Duration:** ~1.7 h across three agents (Task 1 ~1 h, Task 2 ~20 min of drive, fast-fixes + Task 3 ~25 min)
- **Completed:** 2026-10-12
- **Tasks:** 3/3, plus the G-3 fast-fixes from the G-4 drive
- **Files:** 4 created, 17 modified (product source: 5 files, about 35 lines)

## Accomplishments

- **Task 1 (`8abbda8c8`, earlier executor; see `275-05-TASK1-NOTES.md`).** Merged-tree gates, verbatim in
  `275-BASELINES.md`: backend `71 failed, 7146 passed` with the **FAILED SET equal to base**; the six live suites
  `71 passed`; count gate `total 10131 · failed 0 · 434/434`; tsc set diff with no new error; deploy drift PASS; docs
  coverage OK; OpenAPI snapshot `2 passed`; M-1 EXPLAIN still on `document_chunks_embedding_idx`. `275-G4-EVIDENCE.md`
  §1-§4 maps SC#1-4, all 7 failure criteria and all 44 threat ids to named evidence; the D-31/32/33 negative fences
  are empty. Ledger close: 34 scan rows re-derived, 20 CLAUDE.md G-5 rows updated, 5 FIRING files given the rows
  they lacked.
- **Task 2 (`3ef48e78c`, Chrome agent).** HOLD, LIFECYCLE and MEMBER all **PASS** on every D-26 clause (§5). HOLD:
  UI refusals plus a direct `fetch` DELETE → `409` with the server sentence; rows and bytes still present.
  LIFECYCLE: Save locked until Preview; the in-process sweep (flag off, same code path as the route) archived 3
  and queued 3; the chat answer and a model-free as-admin read on both RPC arms returned none of them; Find with
  Include archived listed them; Download `200`; a late hold dropped one document at confirm with a
  `did_not_delete` receipt carrying the hold time. MEMBER: no Org admin door, own-token `POST`/`PUT
  /retention/policies` → `403` (positive control `200` in the member's own org), `On legal hold. Ask an org
  admin.` with no matter name in the DOM. Cleanup recorded.
- **G-4 fast-fixes (this executor), test-first.** RED `f62e19200` (4 failing cases), then `13e962d8b` History
  `delete_refused` sentence, `443b29e8b` `1 policy`, `88aec8e6f` two-stage folder line in order, `86e29ccc0`
  fully archived list no longer claims emptiness. OBS-4 (`hold_name` NULL on `did_not_delete`) kept by decision.
- **Task 3 (`51835a538`).** Retention guide written; SEED-250 → `answered`; SEED-345 stays
  `partially-answered`; BUG-261004-01 → `closed`; SEED-354 planted; BUG-261012-01 and -02 filed; §6 of the
  evidence file holds the known limits, registers and six owed operator rows.

## Task Commits

1. **Task 1: merged-tree gates, matrices, ledger close** — `8abbda8c8` (docs)
2. **Task 2: G-4 drives HOLD / LIFECYCLE / MEMBER** — `3ef48e78c` (docs)
3. **G-4 fast-fixes** — RED `f62e19200` (test); GREEN `13e962d8b`, `443b29e8b`, `88aec8e6f`, `86e29ccc0` (fix); count-gate re-pins + evidence §5.4/§6 committed with this SUMMARY. Count gate after the fixes: `total 10136 · failed 0 · pinned total 9349` · `count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing.` (+5 = the five new cases)
4. **Task 3: docs page + registers** — `51835a538` (docs)

## Decisions Made

- **Cross-provider board: NOT APPLICABLE, by decision, not coverage** (W-7). Recorded in §5 of the evidence file.
- **`did_not_delete.hold_name` stays NULL.** The spec sentence names the time, not the matter; mig 204's CHECK
  makes the policy the receipt's subject; several matters can hold one document; the hold's own receipt names
  the matter. Re-open if an auditor asks History to name the blocking matter.
- **FAIL-2 fixed on the client.** `rule_text` is already the server's ordered sentence (S8's home); the line
  fills the S7 template's two slots from it, with a `?raw` fence on the two `evaluate.py` f-strings. No API field
  was added, so the OpenAPI snapshot is untouched.
- **SEED-250 is `answered`, not `shipped`:** nothing is in production until the owed rows run.
- **BUG-261004-01 closed** only with the live read: both `missing_at_source` documents return 0 chunks on five
  probes per document, and a rolled-back control proves each probe could see them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, copy] History rendered `delete_refused` as the raw key (G-4 FAIL-1)**
- Found during: Task 2 (LIFECYCLE-13). Fix: S5 sentence added + fenced. Files: `RetentionHistory.tsx`,
  `retentionCopy.ts`, `retentionCopy.test.ts`. Commit: `13e962d8b`.

**2. [Rule 1 - Bug, copy] Two-stage folder line read the delete before the archive (G-4 FAIL-2)**
- Found during: Task 2 (LIFECYCLE-7). Fix: fill from `rule_text`. File: `RetentionFolderLine.tsx`. Commit: `88aec8e6f`.

**3. [Rule 1 - Bug, copy] Posture read `1 policies` (G-4 OBS-3)**
- Fix: noun by count. Files: `retentionCopy.ts`, `RetentionTab.tsx`, `retentionCopy.test.ts`. Commit: `443b29e8b`.

**4. [Rule 1 - Bug, UI state] A fully archived folder claimed `No documents in this folder` (G-4 OBS-2)**
- Fix: do not mount the list's empty state when every row is hidden as archived. File: `LibraryPage.tsx`
  (FIRING hot file; one condition around the existing mount, no hook, no fetch). Commit: `86e29ccc0`.

**5. [Rule 2 - register] A second bug filed beside the plan's one.** OBS-1 (`DELETE /documents/{id}` 500 for
a row the caller does not own) is pre-existing and out of scope, so it was filed as BUG-261012-02 rather than
fixed (D-32).

**6. [Recorded] The plan's file list names `BUG-261012-01` only;** both ids were re-derived (no `BUG-261012-*`
existed) and SEED-354 was confirmed free (max was 353).

Task 1's own deviations (threat grep 45 vs 44, four stale triples, five missing G-5 rows, the
`build-public-openapi.cjs` row, the M-1 plan difference, the `comm` artifact) are in `275-05-TASK1-NOTES.md`.

**Impact:** five product files, all under G-3's size; no schema, API or backend change. ⚠ The fast-fix commits
make the ledger triples of `RetentionHistory.tsx`, `RetentionFolderLine.tsx`, `RetentionTab.tsx`,
`retentionCopy.ts`, `LibraryPage.tsx` and `scripts/vitest-count-gate.cjs` one commit stale; the cells were not re-churned here (CLAUDE.md is in
the warn band) and should be re-derived at the next phase that touches them.

## Issues Encountered

- The first keyword control for the `.eml` document used a three-word AND query that matched nothing even with
  the state cleared, so it proved nothing. It was re-run with single words; six of nine words return the
  document under the control and none as-is.
- A Bash heredoc failed on quoting while writing §6; the same text was written with the Edit tool.

## Known Stubs

None. The retention docs page is `status: written`; the stub it replaced is gone.

## Threat Flags

None. No new endpoint, auth path, file access or schema change. The fast-fixes change rendered words and one
mount condition. T-275-35..38: no Supabase MCP call of any kind; the only DB statements ran on
`127.0.0.1:54322` under the local-DB lock (taken 08:2xZ, released `2026-10-12T08:27:40Z`), and the only writes
were inside rolled-back transactions; evidence names accounts by role only; no fixture was left.

## Next Phase Readiness

- Ready for `/gsd:code-review 275` and phase verification.
- **Owed (operator):** the six §6.4 rows — prod migs 204 then 205 before the backend deploy, `get_advisors`,
  the `source_state` read, backend before frontend, `RETENTION_SWEEP_ENABLED=false` until a dry run is read —
  plus a re-look at the four fast-fixes at the next UAT.
- Not marked here: RET-01..04 in REQUIREMENTS.md (the phase-close step does that after verification).

## Self-Check: PASSED

- Files FOUND: `275-G4-EVIDENCE.md`, `SEED-354-…`, `BUG-261012-01-…`, `BUG-261012-02-…`,
  `docs/public/administer/org/retention.md`, this SUMMARY.
- Commits FOUND: `8abbda8c8`, `3ef48e78c`, `f62e19200`, `13e962d8b`, `443b29e8b`, `88aec8e6f`, `86e29ccc0`,
  `51835a538`, `9776214a4`.
- Acceptance: `router:retention` in the page's `covers`; page `status: written`; SEED-345 `status:
  partially-answered`; SEED-354 `trigger_when` filled; BUG-261004-01 `closed` with its evidence; six owed rows in §6.4.
- Gates on the committed tree: `check-docs-coverage` 0 · `check-seeds-register` 0 · `check-hot-file-ledger` 0 ·
  `check-claude-md-size` 0 (OK WITH WARNINGS, warn band) · count gate OK (434/434, 0 failing).
