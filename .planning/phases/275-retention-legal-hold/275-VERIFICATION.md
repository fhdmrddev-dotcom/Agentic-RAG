---
phase: 275-retention-legal-hold
verified: 2026-10-12T10:27:23Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
verified_at_head: 067f63711
status: human_needed
score: 8/8 must-haves verified (4 ROADMAP success criteria + RET-01..04)
overrides_applied: 0
independent_review: self
human_verification:
  - test: "Live UI re-look of the code-review fix pass (5 critical + 19 warning, migration 206 + 19 frontend commits ca9542133..1acbfd61c), which landed AFTER the G-4 drives"
    expected: "HOLD still refuses document + folder delete with the server sentence; a folder delete with a held document anywhere in its subtree deletes NOTHING (delete_folder_tree, one transaction); Waiting for you renders failed / bytes_not_removed / changed / gone clauses and never a green 'Done' or 'Deleted 0' when every row was dropped; Reload never records a 'kept' decision the admin did not make; the posture line does not say 'finished, nothing failed' while a sweep is running"
    why_human: "The three G-4 drives (275-G4-EVIDENCE.md §5) ran before 206 and the frontend fix pass; every fix is proven by rendered-word / live-DB tests only, and fixes found by review need their own lived-experience look"
  - test: "Live UI re-look of the four G-4 fast-fixes (275-G4-EVIDENCE.md §6.1)"
    expected: "History renders 'Refused to delete {doc}: on legal hold' (not the raw key delete_refused); a two-stage folder line reads 'kept 1 day …, then archived; queued for deletion 2 days …'; the posture line reads '1 policy'; a fully archived folder shows only the 'N archived documents hidden · Show' line, no 'No documents in this folder'"
    why_human: "Copy fixes verified by rendered-word tests only; G-4 rule: UAT fixes need their own UAT"
---

# Phase 275: Retention & Legal Hold — Verification Report

**Phase Goal:** An admin can say how long a class of documents or a folder is kept and what happens after. A legal hold stops it, and disposition runs on its own schedule, writes an audit record, and never deletes what it cannot prove it should.
**Verified:** 2026-10-12T10:27:23Z at `067f63711` (develop, after "docs(275): review index")
**Status:** human_needed
**Re-verification:** No — initial verification

Every verdict below was read from the code at HEAD and from test runs made by this verifier, not from SUMMARY claims.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence (code at HEAD) |
|---|---|---|---|
| SC#1 | An org admin sets a retention policy on a document class or a folder (period + archive/delete/review); a non-admin member can neither create nor change one (RET-01) | ✓ VERIFIED | `supabase/migrations/204_retention_and_legal_hold.sql:69-103`: `scope_kind IN ('folder','class')`, `stage1_value/unit (days/months/years)`, `stage1_action IN ('archive','delete','review')`, optional stage 2 only after archive. `:609-611` REVOKE ALL from `authenticated` then GRANT SELECT only, so no JWT can INSERT/UPDATE/DELETE a policy. `backend/app/api/retention.py:275-355`: create / update / delete each `Depends(require_org_manage)` and write through the service pool after the gate. 206 `:242-257` adds a folder-same-org trigger. Tests: `test_275_retention_api.py::test_a_member_is_refused_by_the_server_and_nothing_is_reached` (green in this run). G-4 MEMBER-2: member POST/PUT → 403 with a positive control. |
| SC#2 | A held document is not disposed by the sweep and cannot be deleted through the ordinary delete path while the hold stands (RET-02) | ✓ VERIFIED | DB: BEFORE DELETE triggers on documents (`204:358`) and folders (`204:381`), re-defined in `206:112-145` with the fast path widened to "no active hold anywhere"; BEFORE TRUNCATE guards (`204:463-468`) + `REVOKE TRUNCATE … FROM authenticated, anon` (`204:470`); org_id/user_id change refused on held rows (`206:146-206`); storage DELETE policy refuses a file that still backs a documents row (`206:212-231`). Python: `hold_guard.assert_none_held` is called BEFORE the row delete on every app path — `api/documents.py:1853` (scope=all) and `:1873` (version), `api/folders.py:182` (with `folder_ids`, then `delete_folder_tree` in one TX `:191`), `api/sources.py:334` (watch delete purge) and `:479` (purge-missing); each row delete is wrapped by `map_hold_refusal` (PT409 → the same 409). Order verified in code: hold check → rows → bytes (`documents.py:1863-1869, 1880-1884`; `folders.py:194-200`). Sweep: `evaluate` returns `held` first; `confirm_batch` re-checks `retention_held_documents` inside each family's TX (`disposition.py:577`) and treats a racing PT409 as `did_not_delete` (`:638-641`). Multiline grep of `backend/app` finds no other `documents`/`folders` delete. G-4 HOLD-1..5 incl. a direct `fetch` DELETE → 409, rows and bytes still present. |
| SC#3 (reworded, D-09) | A dry run reports exactly what a sweep would do before any real sweep; the scheduled sweep archives the archive set and queues the delete set; nothing is deleted until an org admin confirms; one audit record per action (document, policy, action, approver for deletes, time); incomplete/ambiguous disposes nothing (RET-03) | ✓ VERIFIED | Dry run before sweep: `config.py:1436` `retention_sweep_enabled: bool = False`; `main.py:610` starts `RetentionSweepService` only behind it; `api/retention.py:719` run-now 409 while off; create/update refuse without a fresh matching preview (`api/retention.py:285-286, 310-311`, `PREVIEW_AGAIN`); the evaluator makes an unpreviewed revision `not_previewed` (undecidable). Sweep: `sweep_service.py` claim + lease via `db/retention.claim_due_retention_sweeps`; `disposition._sweep_write` (`:315-396`) only UPDATEs `archived_at` and INSERTs `retention_queue` — the ONE `DELETE FROM public.documents` in the retention modules is `disposition.py:627`, inside `_confirm_delete`, reached only from `confirm_batch`, which refuses unless `typed_count == len(delete_ids)` (`:445`). Receipts: `archived` / `queued_*` / `deleted` / `did_not_delete` each name document, policy, actor (deletes: `actor_id` + `actor_name` + `approved_at`); mig 204 CHECK requires `policy_name` for disposition actions. Fail closed: `IncompleteEvaluation` → zero writes + one `sweep_incomplete` receipt (`disposition.py:304-313`). Tests green this run: `test_275_sweep.py::test_the_sweep_path_never_deletes_a_document`, `::test_only_disposition_deletes_a_document`, `::test_the_one_document_delete_is_reached_only_from_confirm_batch`, `::test_the_sweep_flag_defaults_off`, `test_275_retention_api.py::test_a_wrong_typed_count_is_422_and_nothing_is_deleted`. G-4 LIFECYCLE-2..13 (preview 3 = sweep 3 archived + 3 queued; late hold dropped with `did_not_delete` naming the hold time). |
| SC#4 | An archived document leaves default chat retrieval, document search with an archive filter still finds it, and it can be opened and downloaded (RET-04) | ✓ VERIFIED | `205:52` `retrievable` STORED generated column (`archived_at IS NULL AND source_state live/NULL`) + `ANALYZE`; `AND d.retrievable` in both branches of `match_document_chunks` (`205:110, 133`) and in `keyword_search_chunks` (`205:180`); `query_user_documents` sets `app.agent_read` and refuses `set_config` / `current_setting` / `u&` text (`205:226-239`); four RESTRICTIVE agent-read policies (`205:266-277`). Agent tools: `agent_wall.unretrievable` at `tool_dispatcher.py:363` (read_document), `:406` (`_fetch_owned_document_bytes`, shared by fetch_document_file + attach_skill_file), `:1088` (analyze_document); `retrievable_only=True` for query_documents_by_view / get_related_documents (`:923, 927, 1037`); `.eq(RETRIEVABLE_COLUMN, True)` on kb.py ls/tree/glob (7 sites) and `retrieval_documents.py:90,102,125,162`. Find: `DocumentSearchRequest.include_archived: bool = False` (`models/document_search.py:162`), `_apply_archived` (`document_search_service.py:220-223, 453`); frontend `findState.ts:337` sends it only when on. Open/download routes not filtered. G-4 LIFECYCLE-5/6/8/9: both RPC arms 3→0 rows after archive, Find "Archived: included" 3 docs vs 0, download-url 200 + storage 200. |

**Score:** 4/4 success criteria verified (and RET-01..04, below).

### Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `supabase/migrations/204_retention_and_legal_hold.sql` (777 L) | ✓ VERIFIED | 9 tables, RLS enabled on all 9 (`:599-607`), REVOKE ALL from PUBLIC/anon/authenticated/service_role before each GRANT; hold predicates, triggers, TRUNCATE guard, receipts CHECK |
| `supabase/migrations/205_retrievable_predicate.sql` (316 L) | ✓ VERIFIED | `retrievable` column, both RPCs keep `force_custom_plan`, GUC + RESTRICTIVE policies |
| `supabase/migrations/206_retention_hold_hardening.sql` (383 L) | ✓ VERIFIED | review fix pass B-CR-01..03, B-WR-01..03; idempotent CREATE OR REPLACE; applied LOCALLY only (275-REVIEW-backend.md § Fix pass, VERIFY 9/9) |
| `backend/app/services/retention/hold_guard.py` | ✓ VERIFIED | `assert_none_held`, `map_hold_refusal`, `HoldRefusal` → one 409 shape; calls `retention_held_documents` / `retention_held_folders` via service role |
| `backend/app/services/retention/{evaluate,load,disposition,sweep_service,agent_wall,periods}.py` | ✓ VERIFIED | pure evaluator; fail-closed loader; archive/queue/confirm/unarchive; daemon behind flag |
| `backend/app/api/retention.py` (851 L) + `backend/app/db/retention.py` | ✓ VERIFIED | router included at `main.py:918`; every write route gated by `require_org_manage` |
| `frontend/src/components/retention/*` (17 components + hook) | ✓ VERIFIED + WIRED | `RetentionTab` rendered from `OrgAdminShell.tsx:436` (tab `locked: false`, `:108`); `useRetentionStates` in `LibraryPage.tsx:697`; `RetentionRowChips` in `DocumentRow.tsx:453`; `RetentionSection` in `DocumentDetailPanel.tsx:345`; `HoldRefusalNotice` + `ApiRefusal` 409 in `DocumentList.tsx:153,286` and `FolderNode.tsx:109`; `ArchivedHiddenLine` shares Find's `include_archived` (`LibraryPage.tsx:932-935`) |
| `docs/public/administer/org/retention.md`, `.planning/seeds/SEED-354-…md` | ✓ VERIFIED | both exist |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| documents / folders BEFORE DELETE triggers | `retention_held_documents` / `retention_held_folders` | SQL call inside SECURITY DEFINER trigger fns | ✓ WIRED |
| `hold_guard.py` | `retention_held_documents` / `_folders` | service-role `.rpc()` (`hold_guard.py:138, 169`) | ✓ WIRED |
| `api/documents.py`, `folders.py`, `sources.py` delete handlers | `hold_guard.assert_none_held` | awaited before every row delete | ✓ WIRED (5 paths) |
| `match_document_chunks` / `keyword_search_chunks` | `documents.retrievable` | `AND d.retrievable` in every branch | ✓ WIRED |
| `tool_dispatcher.py` | `agent_wall.unretrievable` | beside each scope wall | ✓ WIRED |
| `main.py` lifespan | `RetentionSweepService` | behind `settings.retention_sweep_enabled` | ✓ WIRED (off by default) |
| `api/retention.py` save | `retention_previews` | `record_preview` / `fresh_preview_exists` (draft hash, 30 min) | ✓ WIRED |
| `disposition.confirm_batch` | `retention_held_documents` | per-family TX re-check + trigger backstop | ✓ WIRED |
| `document_search_service.structure()` | `documents.archived_at` | `_apply_archived(q, include_archived)` | ✓ WIRED |
| `OrgAdminShell` / `LibraryPage` / `DocumentRow` | `RetentionTab` / `useRetentionStates` / `RetentionRowChips` | render branch / hook / one mount | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Library chips / section / folder line | retention state | `POST /retention/document-states` (RLS read as caller, then service-role hold check) via one batched `useRetentionStates` | yes (G-4 HOLD-2, MEMBER-3/4/5) | ✓ FLOWING |
| Waiting for you | queue rows | `GET /retention/queue` ← `retention_queue` written by the sweep | yes (G-4 LIFECYCLE-10) | ✓ FLOWING |
| History | receipts | `GET /retention/history` ← `retention_receipts` | yes (G-4 LIFECYCLE-13, 1:1 with the table) | ✓ FLOWING |

### Behavioral Spot-Checks (run by this verifier)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend retention unit suites | `backend/venv/Scripts/python -m pytest tests/unit -q -k "275 or retention"` (from `backend/`) | `227 passed, 7008 deselected, 1 warning in 4.73s` | ✓ PASS |
| Frontend retention suites | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/retention` | `Test Files 9 passed (9)` · `Tests 180 passed (180)` | ✓ PASS |
| Hot-file ledger gate | `node scripts/check-hot-file-ledger.cjs .planning/phases/275-retention-legal-hold` | `ledger gate OK — every watched file has a row.` (505 rows · 110 files · 58 watched) | ✓ PASS |
| D-33 negative fence | `git diff --stat b41d51d6b HEAD -- backend/app/services/retrieval_service.py backend/app/services/scheduler_service.py` | empty | ✓ PASS |
| Deploy artifacts carry the flag, default off | grep `RETENTION_SWEEP_ENABLED` | `.env.example:361 =false`, `onebox.env.example:283 =false`, `OPERATOR.md:173`, `docker-compose.prod.yml:111 ${…:-false}` | ✓ PASS |

Not run by this verifier, by instruction or because they mutate the shared local DB: the full backend baseline (recorded `71 failed, 7159 passed …`, `[GATE PASSED]`, failed SET = base — 275-REVIEW-backend.md § Fix pass), the live integration suites (`tests/integration/test_275_*`, recorded `86 passed` after 206), migration apply, uvicorn. These are cited as recorded evidence, not re-measured.

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared by any 275 plan.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| RET-01 | 275-01, 275-03, 275-04 | Admin sets a retention policy per document class or folder (period and action) | ✓ SATISFIED | SC#1 row |
| RET-02 | 275-01, 275-02, 275-03 | A legal hold blocks disposition | ✓ SATISFIED | SC#2 row — DB triggers on every role + Python guard on all 5 app delete paths + confirm re-check |
| RET-03 | 275-03, 275-04 | Disposition runs on a schedule and writes an audit record | ✓ SATISFIED | SC#3 row — claim/lease/`next_run_at` daemon behind a default-off flag; receipts per action; deletes only via typed-count confirm |
| RET-04 | 275-01, 275-02, 275-03, 275-04 | Archived documents drop out of default retrieval but stay findable | ✓ SATISFIED | SC#4 row |

No orphaned requirements: REQUIREMENTS.md maps only RET-01..04 to Phase 275.

### Anti-Patterns Found

Scan over the 63 non-test source files changed since PHASE_BASE `b41d51d6b` (added lines only): **zero** `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / "not yet implemented" / "coming soon".

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `backend/app/services/retention/disposition.py` | 267 | `dry_run_org` defined but referenced by nothing in `backend/` (the dry run actually used is the per-draft `preview_draft`) | ℹ️ Info | Dead helper; SC#3's dry run is delivered by Preview-before-Save + the `not_previewed` evaluator gate, not by this function |

### Recorded decisions and deferrals (not scored as gaps)

- **D-35 known limit:** private documents cannot be held or covered by a policy this phase → SEED-354 (org-wide matter by custodian). Written in `275-G4-EVIDENCE.md` §6.2 and the docs page.
- **Cross-provider UAT scoreboard: NOT APPLICABLE by decision (D-30)** — the exclusion is enforced in the DB/RPC and tool-dispatch layers before any provider sees results; no streaming, provider-routing or prompt code changed. The one chat row ran on DeepSeek (`deepseek-v4-flash`), recorded as a single-provider proof, not as cross-provider coverage.
- **Deferred:** local Postgres backend crash when calling a function `authenticated` lacks EXECUTE on (`deferred-items.md`); BUG-261012-01 (watch purge leaves storage bytes — `api/sources.py` purge paths delete rows, never bytes; no hold bypass, the rows are guarded); BUG-261012-02 (pre-existing 500 instead of 404 on `DELETE /documents/{id}` for a row the caller does not own; nothing is deleted).
- **Skipped review info items:** B-IN-01/02/03/06, F-IN-02, partial F-IN-06/07/08.

### Owed operator rows (production is operator-gated; recorded, not performed)

1. Production DB: apply **204 → 205 → 206** in order, one operator-approved SQL-editor write each, VERIFY rows PASS, **before** the backend deploy (`api/folders.py:191` calls `delete_folder_tree`, which only 206 creates — a backend-first deploy breaks folder delete). ⚠ `275-G4-EVIDENCE.md` §6.4 row 1 lists only 204 → 205; 206 is added by `275-REVIEW-backend.md` § Fix pass. Use the three-migration sequence.
2. `get_advisors(security)` on production after the migrations.
3. Backend before (or with) frontend (Find's `include_archived` is `extra="forbid"` on an old backend).
4. `RETENTION_SWEEP_ENABLED` stays `false` in Coolify until an org admin has read a dry run (Preview) on production.
5. UAT re-look of the review fixes and the G-4 fast-fixes (below).

### Human Verification Required

#### 1. Review fix pass in the live UI

**Test:** Re-drive HOLD and LIFECYCLE (and the Waiting-for-you result banner) on the current tree, with migration 206 applied locally.
**Expected:** A folder delete with a held document anywhere in its subtree deletes nothing (one-transaction `delete_folder_tree`); the delete-batch result banner renders `failed` / `bytes_not_removed` / changed / gone clauses and never a green "Done" or "Deleted 0" when every row was dropped; Reload never records an unmade "kept" decision; the posture line is honest while a sweep runs.
**Why human:** The three G-4 drives ran before migration 206 and the 19 frontend fix commits; those fixes are proven by tests only.

#### 2. G-4 fast-fixes in the live UI

**Test:** Retention → History after a refused delete; a two-stage folder's line; the posture line with one policy; a fully archived folder.
**Expected:** "Refused to delete {doc}: on legal hold"; "kept 1 day …, then archived; queued for deletion 2 days …"; "1 policy"; only the "N archived documents hidden · Show" line.
**Why human:** Copy fixes verified by rendered-word tests only.

### Gaps Summary

None. Every ROADMAP success criterion and RET-01..04 is met in code at `067f63711`, with this verifier's own green runs (227 backend unit, 180 frontend retention) and recorded live evidence (G-4 HOLD / LIFECYCLE / MEMBER with DB reads; live integration 86 passed after 206). All seven "How we'd know this failed" conditions are contradicted by code: the hold is enforced by `DELETE /documents/{id}` and by DB triggers for every role; no sweep can run while the flag is off and no policy acts without a preview of its revision; the receipts CHECK requires the policy; both RPC arms and the agent SQL arm read `retrievable`; every loader statement binds the org; no retention module names `workspace_files`; the service role is refused by triggers. Status is `human_needed` only because the review fix pass and the four fast-fixes landed after the G-4 drives and are owed a live re-look.

---

_Verified: 2026-10-12T10:27:23Z_
_Verifier: Claude (gsd-verifier)_
