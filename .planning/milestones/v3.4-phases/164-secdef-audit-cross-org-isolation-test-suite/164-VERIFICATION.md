---
phase: 164-secdef-audit-cross-org-isolation-test-suite
verified: 2026-07-20T17:50:02Z
human_verified: 2026-07-20T22:15:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
gaps: []
human_verification_result: "Both human-verification items PASS (verify-work 164, 2026-07-20). (1) SC#10 4-axis cross-provider UAT: operator-confirmed live + DB double-confirm (7 recent threads single-org 22f9c615, every search_documents turn returned >=1 citation 5/5/5/13/5/5/5/8 = no empty-retrieval regression on the producer→user-context swap). (2) Frontend null-owner UI: Chrome-verified — is_system skill-creator (null owner) shows Built-in badge + only 'Try in Chat', NO Edit/Delete owner controls (a11y tree ref_33), while owned skills show full controls; no crash/undefined."
deferred:
  - truth: "CR-01/SEED-124: KB browse/read tools (ls/tree/glob/read_document) run on the service-role connection through org-agnostic folder_utils.py helpers (fetch_visible_folders / get_globally_visible_folder_ids / is_in_global_subtree) — a live cross-org leak of another org's is_global folder names, document filenames, and full document content"
    addressed_in: "Phase 165"
    evidence: "ROADMAP.md Phase 165 SC#4 (verbatim): '(Folded from Phase 164 CR-01 / [[SEED-124]] — MUST close here) The folder_utils.py visibility helpers ... are org-scoped so the agent's service-role KB browse/read tools ... can no longer enumerate or read documents in another org's is_org_shared (formerly is_global) folders. Verified by flipping the xfail(strict=True) marker test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124 ... to XPASS.' Tracked live in the exit gate as an intentional xfail(strict=True), 22 passed / 1 xfailed, exit 0 — not a phase-164 failure."
  - truth: "WR-01: _null_foreign_global_owner only nulls the owner on a row that is itself is_global/is_system — a non-global DESCENDANT folder inside a shared subtree still discloses the seeding owner's real user_id"
    addressed_in: "Phase 165"
    evidence: "ROADMAP.md Phase 165 SC#4: 'Also close WR-01 (null the seeder's user_id on non-is_org_shared descendants of shared folders in the folders list/serialize path).'"
human_verification:
  - test: "Frontend null-owner UI-contract: load the Folders / Skills lists as a non-owner viewing a global/system-shared row and confirm owner-gated affordances (edit/delete/rename) stay correctly hidden now that the API returns user_id=null instead of the seeding owner's UUID"
    expected: "Owner-gated UI affordances remain hidden for the non-owner (a `user_id === me.id` check safely evaluates false against null); no runtime crash from the null value"
    why_human: "frontend/src/types/index.ts Folder.user_id and Skill.user_id are still the hard-required `string` type (NOT loosened to `string | null` — confirmed live: 164-02 scoped this as backend-only/no-UI-build and explicitly flagged it as a follow-up rather than fixing it). TypeScript's type is compile-time only so this cannot regress a running build, but the actual browser behavior needs a human's eyes to confirm the affordance-gating logic tolerates the null value in practice."
  - test: "SC#10 4-axis live cross-provider UAT (cross-provider x multi-tool x parallel-thread x long-message) exercising hybrid search + text-to-SQL + code execution across OpenAI/Anthropic/Google/OpenRouter reps post the retrieval user-context swap"
    expected: "No cross-org leak on any axis; Deep-mode byte-identical; retrieval/text-to-SQL/grep all return the caller's own rows correctly across every provider"
    why_human: "Requires live LLM providers + real SSE streaming; 164-VALIDATION.md explicitly designates this as an operator-run manual-only verification (\"Manual-Only Verifications\" table), not something the automated suite exercises"
---

# Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite Verification Report

**Phase Goal:** The four SECURITY DEFINER retrieval/sharing functions carry an in-body org predicate + pinned search_path, the fragile regex is deleted, and a two-org adversarial test suite proves zero cross-org leakage — the milestone's verifiable isolation gate.
**Verified:** 2026-07-20T17:50:02Z (automated) · 2026-07-20T22:15:00Z (human verification complete)
**Status:** passed
**Re-verification:** No — initial verification; human-verification items closed via /gsd:verify-work 164

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 4 DEFINER functions (`match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible`) carry an in-body org predicate + a pinned `search_path` | ✓ VERIFIED | Live `pg_proc` query on :54322: all four `prosecdef=True`, `proconfig=['search_path=""']`. Live `prosrc` dump shows `WHERE dc.org_id = ANY (SELECT public.current_user_org_ids()) AND (dc.user_id = auth.uid() OR ...)` in both chunk fns; `match_skills` keeps `(s.is_system = true) OR (org gate ...)` (FIX-A shape); `folder_is_globally_visible` is the pure ancestor-walk (no org predicate by design) |
| 2 | `_inject_user_id` (sql_service.py) + `_inject_user_id_for_grep` (kb.py) are DELETED; `query_user_documents` runs over the asyncpg user-context (RLS is the gate) | ✓ VERIFIED | `grep -n "^def _inject_user_id\|_inject_user_id("` → 0 matches in sql_service.py; `grep -n "_inject_user_id_for_grep"` → 0 matches in kb.py; both files import + call `get_user_pg_connection`; `_inject_folder_scope` retained with a WR-02 valid-SQL fix (verified: 4 unit legs pass, and a manual repro of the 3 documented broken shapes now produces valid SQL) |
| 3 | `test_v3_4_org_isolation.py` exists and passes as the milestone exit gate: every user-facing table x both DB paths x all 4 DEFINER fns x `X-Org-Id` spoof rejection | ✓ VERIFIED | Live run: `pytest tests/integration/test_v3_4_org_isolation.py -q` → **22 passed, 1 xfailed, exit 0** (matches SUMMARY claim exactly). The 1 xfail is an intentional `xfail(strict=True)` (`test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124`) documenting CR-01, folded to Phase 165 — not a 164 failure (see Deferred Items) |
| 4 | The red-anchor (`test_definer_ignores_spoofed_match_user_id`) is a non-vacuous RED-then-GREEN proof, not a tautology | ✓ VERIFIED | 164-01-SUMMARY documents the anchor FAILING against the pre-164 DB with a real leaked chunk id (RED, captured before migration 110 applied). Live re-run now: `test_definer_ignores_spoofed_match_user_id PASSED` (1 passed, 0.32s) — GREEN post-migration. Both states independently confirmed |
| 5 | Hybrid search is org- AND folder-ACL-isolated; a live two-user retrieval test proves it (PRAG-01) | ✓ VERIFIED | Live `document_chunks` SELECT RLS policy dump: `(org_id IN (SELECT current_user_org_ids())) AND ((auth.uid() = user_id) OR EXISTS(... folder_is_globally_visible(d.folder_id)))` — mirrors the documents folder-visibility predicate. Live `pytest -k prag01_retrieval` passes (private chunk never crosses org, shared-folder chunk correctly scoped) |
| 6 | CONCUR-01 perf gate stays <1s after the `document_chunks` RLS widening | ✓ VERIFIED | Live run: `pytest tests/integration/test_058_concurrency.py -x` → 1 passed, 0.25s wall (SUMMARY claims 15.0ms measured internally; both comfortably under the 1s threshold) |
| 7 | Global/org-shared resources (folders / skills / views) null the seeding owner's `user_id` (+ scope UUID for views) for non-owner readers in every list/serialize path | ✓ VERIFIED (with a documented, deferred edge case) | `backend/app/models/folder.py:26` / `skill.py:25,50` → `user_id: UUID \| None` confirmed live. Live `pytest tests/test_seed091_owner_nulling.py` → 6 passed. Shared `_null_foreign_global_owner` helper confirmed wired into skills.py/document_view_service.py/folder_utils.py (folders.py + kb.py). **Caveat (WR-01, deferred to 165):** the helper nulls only when the row itself is `is_global`/`is_system` — a non-global descendant folder inside a shared subtree still leaks the real owner UUID. This is a documented, explicitly-deferred edge case (ROADMAP Phase 165 SC#4), not silently missed |
| 8 | The frontend TS type for folders/skills tolerates a null owner (owner-gated affordances branch on ownership without throwing) | ✓ VERIFIED | **Human-verified live via Chrome MCP (2026-07-20).** On the Skills page as `fhdmrd@gmail.com`, the `is_system` skill-creator (owner `00000000` seed@system.local → backend serializes `user_id: null` for this caller) renders with a "Built-in" badge and — confirmed in the accessibility tree (ref_33) — exposes ONLY a "Try in Chat" button, NO Edit/Delete owner controls, while every owned skill card DOES show Edit/Delete. No crash, no "undefined owner" glitch. The `user_id === me.id` gate safely evaluates false against `null` at runtime. (TS `string`→`string \| null` loosening at `index.ts:451,495` remains a clean forward follow-up, inert today.) |

**Score:** 8/8 truths verified (0 uncertain, 0 failed) — the previously-uncertain Truth #8 closed by live human verification

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases (Step 9b) — not actionable gaps for Phase 164.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | CR-01/SEED-124 — KB browse/read tools (`ls`/`tree`/`glob`/`read_document`) leak cross-org via org-agnostic `folder_utils.py` helpers running on the service-role connection | Phase 165 | ROADMAP.md Phase 165 SC#4 names CR-01/SEED-124 explicitly and requires the xfail marker to flip to XPASS before closing |
| 2 | WR-01 — `_null_foreign_global_owner` misses non-global descendants of a shared folder (owner UUID still disclosed) | Phase 165 | ROADMAP.md Phase 165 SC#4: "Also close WR-01" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/tests/integration/test_v3_4_org_isolation.py` | Two-org adversarial exit-gate matrix (18-23 tests) | ✓ VERIFIED | 902 lines, 17 test functions covering pg_proc audit, red-anchor, table matrix (both paths), 4-DEFINER legs, X-Org-Id spoof, text-to-SQL/grep, PRAG-01, is_system/is_global guards, badge-spoof, folder_scope unit legs, CR-01 xfail. Live: 22 passed, 1 xfailed |
| `supabase/migrations/110_secdef_org_scope_audit.sql` | 4 DEFINER re-CREATE + document_chunks widening | ✓ VERIFIED | 235 lines; applied live to :54322 (confirmed via pg_proc + pg_policies introspection); `full-schema.sql` regenerated same-commit (`e14c146b`) |
| `backend/app/services/retrieval_service.py` | `_call_as_user` seam + vector/keyword RPCs over user-context | ✓ VERIFIED | `get_user_pg_connection` imported + called; 0 remaining `supabase.rpc("match_document_chunks"...)` / `keyword_search_chunks` calls |
| `backend/app/services/sql_service.py` | `query_documents` regex-deleted, RLS-scoped | ✓ VERIFIED | `_inject_user_id` fully absent; `get_user_pg_connection` used; `_inject_folder_scope` retained with WR-02 valid-SQL fix (4 unit tests pass) |
| `backend/app/api/kb.py` | `grep_path` regex-deleted, RLS-scoped | ✓ VERIFIED | `_inject_user_id_for_grep` fully absent; `get_user_pg_connection` used; `test_kb.py` 24/24 pass |
| `backend/app/services/agent_loop.py` | `match_skills` over user-context | ✓ VERIFIED | Imports `_call_as_user`/`_vector_literal`; 0 remaining `supabase.rpc("match_skills"...)` |
| `backend/app/models/folder.py`, `skill.py` | Nullable `user_id` | ✓ VERIFIED | `UUID \| None` confirmed live in both, plus `SkillFileResponse.user_id` (A3) |
| `backend/tests/test_seed091_owner_nulling.py` | Unit proof of null-on-non-owner contract | ✓ VERIFIED | 220 lines, 6/6 pass live |
| `frontend/src/types/index.ts` | Folder/Skill TS types tolerate a null owner | ⚠️ NOT UPDATED | `Folder.user_id`/`Skill.user_id` still hard-required `string` — explicitly flagged (not fixed) by 164-02; routed to human verification |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `test_v3_4_org_isolation.py` | `_rls_harness.py` | `open_user_conn`/`assert_auth_uid`/`as_user_supabase_txn` imports | ✓ WIRED | Confirmed via live collect + pass; the harness functions are used throughout the suite |
| `test_v3_4_org_isolation.py` | `public.match_document_chunks` | asyncpg `conn.fetch` over `open_user_conn` | ✓ WIRED | `test_definer_ignores_spoofed_match_user_id` and `test_definer_zero_cross_org[match_document_chunks]` both pass live |
| `test_v3_4_org_isolation.py` | `public.query_user_documents` | asyncpg over user-context (0 A-rows) vs a leak-conn (A-rows leak) | ✓ WIRED | `test_text_to_sql_query_user_documents_isolation` + `test_text_to_sql_grep_path_isolation` both pass live — the connection-identity arbitration is exercised and non-vacuous |
| `retrieval_service.py` | `app.dependencies.get_user_pg_connection` | `_call_as_user` seam | ✓ WIRED | Grep-confirmed import + call site; live `prag01_retrieval` pass proves the seam resolves `auth.uid()` correctly in the producer |
| `sql_service.py` + `kb.py` | `public.query_user_documents` (INVOKER) | user-context connection so RLS scopes the arbitrary SELECT | ✓ WIRED | Both files call `get_user_pg_connection`; live `text_to_sql` legs pass |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `match_document_chunks`/`keyword_search_chunks` (DEFINER) | `document_chunks` rows | `public.current_user_org_ids()` (live membership resolver, mig 104) + `auth.uid()` | Yes — live DB query, not a static return | ✓ FLOWING |
| `match_skills` (DEFINER) | `skills` rows | Same org resolver + `is_system` universal escape | Yes | ✓ FLOWING |
| `folders`/`skills`/`views` list serializers | `user_id` field | Real DB rows nulled in-place by `_null_foreign_global_owner` / inline rule | Yes — confirmed via live unit test against constructed + real-endpoint-shaped rows | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| DEFINER fns live-pinned + org-gated | Live `pg_proc`/`prosrc` introspection via psycopg2 on :54322 | `prosecdef=True` + `search_path=""` for all 4; org predicate present in body | ✓ PASS |
| `document_chunks` SELECT RLS widened | Live `pg_policies` dump | `org_id IN (...) AND (auth.uid()=user_id OR EXISTS(...folder_is_globally_visible...))` | ✓ PASS |
| Exit-gate suite green | `pytest tests/integration/test_v3_4_org_isolation.py -q` | 22 passed, 1 xfailed, exit 0 | ✓ PASS |
| Red-anchor GREEN post-migration | `pytest ...::test_definer_ignores_spoofed_match_user_id -x` | 1 passed | ✓ PASS |
| CONCUR-01 <1s | `pytest tests/integration/test_058_concurrency.py -x` | 1 passed, 0.25s | ✓ PASS |
| SEED-091 unit proof | `pytest tests/test_seed091_owner_nulling.py -x` | 6 passed (2 expected UserWarnings re: frontend follow-up) | ✓ PASS |
| No 163-crux regression | `pytest tests/integration -k "163" -q` | 101 passed, 2 failed (both pre-existing, documented D-164-02-A) | ✓ PASS (no NEW regressions) |
| `test_kb.py` grep-path regression | `pytest tests/integration/test_kb.py -q` | 24 passed | ✓ PASS |
| `test_115` global-leak regression | `pytest tests/integration/test_115_tool_global_leak.py -q` | 2 passed | ✓ PASS |
| WR-02 folder-scope SQL validity | Manual repro of the 3 review-flagged broken shapes via `_inject_folder_scope` | All 3 produce valid SQL (folder condition spliced before ORDER BY/WHERE-tail) | ✓ PASS |
| D-164-04-B pre-existing test debt confirmed non-regressive | `pytest tests/integration/test_111_1_match_filters_stale.py -q` | 1 failed (non-user-context direct call, fail-closed by design), 2 passed — matches deferred-items.md exactly | ✓ PASS (documented debt, not a new gap) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventional probes exist for this phase; the pytest integration suite (`test_v3_4_org_isolation.py`) IS the phase's probe/exit-gate mechanism and was executed directly (see Behavioral Spot-Checks above). Step 7c: SKIPPED (no separate probe scripts declared).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEN-03 | 164-01, 164-03, 164-04 | 4 DEFINER fns org-predicate + pinned search_path; `_inject_user_id` deleted; `query_user_documents` via user-context | ✓ SATISFIED | Live DB introspection (Truth #1) + code grep (Truth #2) + green suite (Truth #3) |
| TEN-05 | 164-01, 164-04 | `test_v3_4_org_isolation.py` — cross-org isolation exit gate, both DB paths, X-Org-Id spoof rejection | ✓ SATISFIED | Live 22 passed/1 xfailed (Truth #3); table_matrix + org_header_spoof legs confirmed in the passing set |
| TEN-06 | 164-02 | SEED-091 — global/org-shared resources null seeding owner's `user_id` (+ scope UUID) for non-owner readers | ✓ SATISFIED (with WR-01 deferred edge case) | Model loosens + unit test live-green (Truth #7); frontend follow-up routed to human verification |
| PRAG-01 | 164-01, 164-03, 164-04 | Retrieval org- and folder-ACL isolated; live two-user retrieval proof | ✓ SATISFIED | Live `document_chunks` RLS + `prag01_retrieval` pass (Truth #5); CONCUR-01 re-benchmark <1s (Truth #6) |

No orphaned requirements: `REQUIREMENTS.md` maps exactly TEN-03/TEN-05/TEN-06/PRAG-01 to Phase 164, and all four are declared across the 5 plans' `requirements:` frontmatter (164-05 declares none — pure gap-closure plan).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 12 phase-touched files | ℹ️ Info | Clean — debt-marker gate does not fire |
| `frontend/src/types/index.ts:451,495` | 451, 495 | `Folder.user_id`/`Skill.user_id` remain hard-required `string` despite the backend now returning `null` for non-owner global reads | ⚠️ Warning | Type-safety drift, not a runtime break (TS is compile-time only); explicitly flagged by the phase's own SUMMARY, routed to human verification, not silently missed |
| `backend/app/utils/folder_utils.py:37-52` | 37-52 | `_null_foreign_global_owner` (WR-01) doesn't null non-global descendants of a shared folder | ⚠️ Warning | Explicitly deferred to Phase 165 (ROADMAP SC#4); a real but bounded, documented, tracked gap — not a silent miss |
| `backend/app/utils/folder_utils.py` (unchanged) | — | CR-01 service-role org-agnostic browse/read helpers (Critical in 164-REVIEW.md) | 🛑 Critical (folded, not a 164 blocker) | Explicitly operator-accepted fold to Phase 165 with an `xfail(strict=True)` tracking marker + a named ROADMAP success criterion — meets the bar for a documented, non-silent deferral per the phase's own review disposition |

### Human Verification — COMPLETE ✓ (both PASS, /gsd:verify-work 164, 2026-07-20)

#### 1. Frontend null-owner UI-contract — ✓ PASS

**Test:** Load the Folders or Skills list in the browser as a non-owner viewing a global/system-shared row (e.g., the built-in skill-creator, or a folder another user toggled to `is_global`). Confirm owner-gated UI affordances (edit/delete/rename buttons) stay hidden and no runtime error appears.
**Expected:** Affordances remain correctly hidden (a `user_id === me.id` check safely evaluates to `false` against `null`); no crash or visual glitch from the newly-nullable field.
**Result:** ✓ PASS — Verified live via Chrome MCP on the Skills page (`localhost:5173`, logged in as `fhdmrd@gmail.com`). The `is_system` skill-creator (owner `00000000` seed@system.local → API returns `user_id: null` for this caller) renders with a "Built-in" badge and, confirmed in the accessibility tree (ref_33), exposes ONLY a "Try in Chat" button — NO Edit/Delete owner controls — while every owned skill card DOES show Edit/Delete. No crash, no "undefined owner" text. The frontend TS `string`→`string | null` loosening remains a clean forward follow-up (inert today).

#### 2. SC#10 4-axis live cross-provider UAT — ✓ PASS

**Test:** Per `164-VALIDATION.md`'s Manual-Only Verifications table — exercise hybrid search + text-to-SQL + code execution across OpenAI/Anthropic/Google/OpenRouter representative models, including a multi-tool prompt, a parallel-thread scenario, and a long-message scenario, confirming no cross-org leak and Deep-mode byte-identical behavior now that retrieval runs over the asyncpg user-context.
**Expected:** All 4 axes pass with no cross-org leakage and no behavioral regression on the shared streaming/tool-call path.
**Result:** ✓ PASS — Operator confirmed live cross-provider. DB double-confirm (:54322, 2026-07-20): 7 recent test threads (18:12–18:14) all single-org (`22f9c615`) — no cross-org bleed; multi-tool fired live (`search_documents` + `query_documents` text-to-SQL + `ls` + `grep`); every `search_documents` turn returned ≥1 citation (5/5/5/13/5/5/5/8) → no empty-retrieval regression, proving the producer→asyncpg user-context swap resolves `auth.uid()` and migration-110's org gate returns the caller's rows (not the 0-for-everyone service-role transient).

### Gaps Summary

No BLOCKER-level gaps found. All four ROADMAP Success Criteria are independently verified live against the running database and the current codebase (not merely inferred from SUMMARY.md prose): migration 110 is applied and its four DEFINER functions carry the org predicate + pinned search_path live in `pg_proc`; the two fragile regexes (`_inject_user_id`, `_inject_user_id_for_grep`) are confirmed absent from the source; the exit-gate suite `test_v3_4_org_isolation.py` was executed directly and reproduces the claimed 22-passed/1-xfailed result exactly; the red-anchor's RED (pre-164, per 164-01-SUMMARY) and GREEN (post-164, live re-run) states are both independently confirmed; the `document_chunks` RLS widening and the live `prag01_retrieval` test confirm PRAG-01; the CONCUR-01 perf gate still passes; and the SEED-091 owner-nulling unit test passes live with the model loosens confirmed in source.

Two items are explicitly deferred to Phase 165 per an operator decision already recorded in ROADMAP.md (CR-01/SEED-124 known-open KB browse-tool leak, tracked via a live `xfail(strict=True)` marker that will force its own removal when 165 closes it; and WR-01, the owner-nulling gap on non-global descendant folders) — these are not phase-164 gaps because the phase's own scope, the code review's disposition, and the ROADMAP's Phase-165 success criteria all agree on the fold, and the tracking mechanism (strict xfail) makes silent regression impossible.

Two items were routed to human verification and are now **both PASS** (closed via /gsd:verify-work 164, 2026-07-20): the frontend null-owner UI-contract (Chrome-verified — the null-owner system skill correctly hides Edit/Delete affordances, no crash) and the SC#10 4-axis live cross-provider UAT (operator-confirmed + DB double-confirm — no cross-org leak, no empty-retrieval regression on the user-context swap). The frontend TS `string`→`string | null` loosening remains a documented, non-blocking forward follow-up.

With both human-verification items PASS and no FAILED must-have, the overall status is **`passed`** (8/8 truths verified). The two Phase-165 deferrals (CR-01/SEED-124, WR-01) remain correctly deferred (not phase-164 gaps) and are tracked via the live `xfail(strict=True)` marker.

---

_Verified: 2026-07-20T17:50:02Z (automated)_
_Human verification completed: 2026-07-20T22:15:00Z (/gsd:verify-work 164)_
_Verifier: Claude (gsd-verifier) + operator UAT_
