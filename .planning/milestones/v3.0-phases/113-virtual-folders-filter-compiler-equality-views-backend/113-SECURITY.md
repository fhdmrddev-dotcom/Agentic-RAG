---
phase: 113-virtual-folders-filter-compiler-equality-views-backend
secured: 2026-06-19
asvs_level: 1
block_on: high
threats_total: 15
threats_closed: 15
threats_open: 0
accepted_risks: 1
status: SECURED
register_authored_at_plan_time: true
---

# Phase 113 — Security Audit (SECURED)

**Phase:** 113 — Virtual Folders: Filter Compiler + Equality Views (backend)
**Threats Closed:** 15/15 · **Open:** 0
**ASVS Level:** 1 · **block_on:** high
**Verdict:** SECURED — every declared `mitigate` disposition verified present in shipped code; the mandatory live two-user GLOBAL-view leak test (T-113-09 / SC#3 / VIEW-06) was authored in secure-phase and **PASSED live against :54322** (3/3).

All 15 threats in the plan-time register carry disposition `mitigate`. Each was grep/read-verified against the frozen implementation under `backend/app/`. T-113-09 was additionally closed by NEW live evidence (a code-read alone could not close it — the D-102/D-110-5 "static would false-green" lesson).

---

## Threat Verification

| Threat ID | Category | Disposition | Evidence (file:line — shipped code) |
|-----------|----------|-------------|-------------------------------------|
| T-113-01 | Tampering (SQLi) — value handling | mitigate | `view_filter_compiler.py:68-76` `_op_eq` returns `{field: value}` UNCHANGED; bound as `$1::jsonb` via `.contains("metadata", metadata_filter)` at `document_views.py:254`. No f-string SQL / `.format`-into-query anywhere in compiler (grep clean). Unit: `test_113_view_filter_compiler.py:150 test_injection_value_neutralized` (byte-equality) PASS. |
| T-113-02 | Tampering (SSTI) — value handling | mitigate | Same path: value is JSON data matched by `@>`, never rendered/templated. `{{7*7}}`/`${jndi:...}` survives byte-for-byte — unit `test_injection_value_neutralized` + live `test_113_view_resolve.py:309 test_injection_value_neutralized_live` (0 matches, table intact) PASS. |
| T-113-03 | Tampering (field-name injection) | mitigate | `view_filter_compiler.py:104-118 validate_fields` — `_`-prefix unconditional reject (line 115) + whitelist membership (line 117). Whitelist = `set(DocumentMetadata.model_fields) ∪ enabled custom defs` at `document_views.py:69,72-85`. Unit `:102 test_unknown_field_rejected_at_save` + `:124 test_underscore_field_excluded` PASS. |
| T-113-04 | Tampering (unknown-op smuggling) | mitigate | Two layers: Pydantic `Literal["eq"]`/`Literal["and"]` reject at parse (`document_view.py:36,41`); `compile_filter` raises `KeyError` on registry miss (`view_filter_compiler.py:97-99`). No `eval`/`getattr`/dynamic-import. Unit `:72 test_unknown_op_rejected` PASS. |
| T-113-05 | Info Disclosure (`_`-key as filter dimension) | mitigate | `_confidence`/`_source` excluded from whitelist (excluded by `validate_fields` itself, never added in `_build_whitelist`) + unconditional `_`-prefix reject (`view_filter_compiler.py:115`). D-111-9/D-112-D02 invariant. Unit `test_underscore_field_excluded` PASS. |
| T-113-06 | EoP (escalate to global) — create/update payload | mitigate | `create_view` HARD-SETS `"is_global": False` (`document_view_service.py:86`), never read from caller; `ViewCreate`/`ViewUpdate` have no `is_global` field (`document_view.py:46-55`). Defense-in-depth RLS `WITH CHECK ((auth.uid()=user_id) AND (is_global=false))` migration 071:129,131. Live `test_113_view_crud.py:187` asserts created row `is_global is False`. |
| T-113-07 | Info Disclosure (existence leak) | mitigate | `get_view` reads own-OR-global, miss→None (`document_view_service.py:113-127`); `update_view`/`delete_view` own-only, miss→None/False (`:130-155`). Router maps every miss to generic `HTTPException(404)` (`document_views.py:162,182,197,219`), never 403. Live `test_113_view_crud.py:204 test_cross_user_miss_404` PASS. |
| T-113-08 | DoS (blocking I/O in async) | mitigate | Every `.execute()` in service wrapped in `aexec` (`document_view_service.py:88,98,121,135,149`); `aexec = run_in_threadpool(query.execute)` (`utils/db.py:32-44`). No bare `.execute()` in code body (grep clean). D-v2.5-01. |
| **T-113-09** | **Info Disclosure (cross-user content/count/existence leak — VIEW-06)** | **mitigate** | **Code:** every resolve docs-query leg scoped from `caller` — own leg `.eq("user_id", caller)` (`document_views.py:263`), global leg `get_globally_visible_folder_ids(supabase, caller)` (`:268`); `view["user_id"]` used ONLY in the `get_view` readability gate (`:217`), NEVER in a docs query. Subtree owner-scoped to caller + intersected with caller-visible folders (`:241-249`). **LIVE PROOF (mandatory, NEW this secure-phase):** `tests/integration/test_113_view_global_leak.py` — 3/3 PASSED against :54322: A sees only A's 2 invoices, B only B's 1; totals AND result sets differ; ids+filenames disjoint; a zero-match 3rd caller gets `{[], 0}` not another user's data; nonexistent/unseeable id→404. |
| T-113-10 | Info Disclosure (view-existence enumeration) | mitigate | Generic `HTTPException(404)` on every CRUD+resolve miss, never 403, no distinct message (`document_views.py:162,182,197,219`). Live `test_cross_user_miss_404` + leak-test `test_global_view_nonexistent_or_unseeable_id_404` (404 for nonexistent AND unseeable-private) PASS. |
| T-113-11 | Tampering (SQLi/SSTI via filter value — SC#4 live) | mitigate | `document_views.py:254` `.contains("metadata", metadata_filter)` → `metadata @> $1::jsonb`, param-bound, never string-interpolated. Live `test_113_view_resolve.py:309 test_injection_value_neutralized_live` — payload→0 matches, `count(*)` unchanged, table intact, benign row survives — PASS. |
| T-113-12 | Tampering (field-name injection at save/update) | mitigate | `validate_fields` runs before create (`document_views.py:112`) AND before update when `filter_expr` present (`:168`); `ValueError`→422 (`:114,170`). Unknown/`_`-field→422. |
| T-113-13 | EoP (escalate to global view) | mitigate | Same as T-113-06: service hard-sets `is_global=False` (`document_view_service.py:86`); `ViewUpdate` carries no `is_global` so PATCH cannot escalate; RLS `WITH CHECK` migration 071:129,131. Live CRUD asserts non-global. |
| T-113-14 | DoS (unbounded subtree recursion) | mitigate | `resolve_view` reuses the shipped cycle-guarded `resolve_project_subtree` (`harness/scope.py:51`), whose `_walk` has the IN-01 visited-guard (`scope.py:73-87`) and returns a bounded `list[str]`. Not re-derived. |
| T-113-15 | DoS (blocking I/O in async route) | mitigate | Every `.execute()` in the router rides `aexec` (`document_views.py:266,277`); no bare `.execute()` in the route body (grep clean). D-v2.5-01. |

**Closed: 15/15. Open: 0.**

---

## Live Leak Test (T-113-09 / SC#3 / VIEW-06) — mandatory evidence

Authored this secure-phase per VALIDATION.md §Manual-Only / :79 (deliberately deferred from execute-phase — the RLS label / caller-scope code comment is NOT proof):

**File:** `backend/tests/integration/test_113_view_global_leak.py` (NEW — verification artifact, not under `backend/app/`; no implementation file modified).

**Result:** `3 passed` live against `127.0.0.1:54322` (verbose-confirmed PASSED, not SKIPPED):
- `test_global_view_resolves_per_viewer_no_cross_user_leak` — one `is_global=true` invoice view (service-role seeded; the router cannot create one — that hard-set IS T-113-13). User A (2 invoices + 1 report) and User B (1 invoice + 1 memo) resolve the SAME view id. Asserted: A sees exactly A's 2 invoice ids, B exactly B's 1; `total` 2 vs 1 (differ); result sets differ; id-sets AND filename-sets disjoint; B's invoice filename absent from A's listing; non-matching docs excluded from each owner's own resolve.
- `test_global_view_zero_match_caller_gets_empty_not_leak` — a 3rd user with NO docs resolves the global view → `{documents: [], total: 0}`, disjoint from both A's and B's docs (honest empty, never another user's data).
- `test_global_view_nonexistent_or_unseeable_id_404` — resolve of a random uuid → 404; resolve of A's PRIVATE view by B → 404 (never 403).

Full Phase 113 suite + this leak file: **23 passed** live (`6.89s`), regression-clean.

---

## Accepted Risks

| ID | Threat | Severity | Disposition | Re-open trigger |
|----|--------|----------|-------------|-----------------|
| AR-113-01 (→ SEED-091) | **WR-03** — global views expose the seeding OWNER's opaque auth `user_id` + `folder_scope` UUID to non-owner callers via `list_views`/`ViewResponse` (`document_view_service.py:92-110`, `document_view.py:58-64`). | **low — accepted (transferred to SEED-091)** | Pre-existing APP-WIDE behavior: `GET /folders` and global skills disclose the owner `user_id` identically — fixing only views would be inconsistent. Exposes ONLY opaque internal UUIDs (no PII, no content, no document rows); the resolve document-leak path (T-113-09) is fully intact and live-proven. Deferred app-wide (commit `95cbf459`). | Re-open if/when: (a) v3.2 Multi-Tenancy lands, OR (b) a non-opaque owner field (email/name) is ever added to `ViewResponse`/folder/skill list surfaces, OR (c) an audit flags cross-tenant owner-id disclosure as in-scope. **Auditor judgment: ACCEPTED, not OPEN** — opaque-UUID disclosure of a deliberately-shared global object's owner does not defeat any Phase 113 leak-safety guarantee (T-113-09 proves document rows never cross users); blocking 113 on a pre-existing app-wide info-exposure would be inconsistent and out of this phase's scope. |

---

## Unregistered Flags

None. All three SUMMARY.md `## Threat Flags` sections (113-01 implicit / 113-02:84 / 113-03:127) report **"None"** — no new attack surface appeared during implementation beyond the 15-threat plan-time register. The code review (113-REVIEW.md) surfaced 5 warnings + 4 info items; all map to the existing register (robustness/info-exposure hardening of T-113-06/07/09/10/13), none is a new unmapped attack surface:
- WR-01 (422-vs-404 ordering) — FIXED `4fa47c9a`, strengthens T-113-07/10 (ownership now precedes validation, `document_views.py:154-162`; live `test_cross_user_invalid_filter_patch_404`).
- WR-02 (`user_id` f-string into `.or_()`) — FIXED `d09dce81`, hardens T-113-06/07/09/13 service-role owner-scoping gate (`_uid()` UUID-wrap at `document_view_service.py:51-62,101,125`; unit `test_113_view_service_guards.py` 3 guards PASS).
- WR-03 — accepted/transferred → SEED-091 (see Accepted Risks above).
- IN-03 — dead `ViewResolveResponse` removed `c1ddec18` (112 CR-01 landmine eliminated).

---

## Implementation Files (READ-ONLY — not modified)

Verified, never patched: `view_filter_compiler.py`, `models/document_view.py`, `document_view_service.py`, `api/document_views.py`, `main.py`. Migration 071 RLS confirmed. The only file authored this secure-phase is the verification artifact `tests/integration/test_113_view_global_leak.py`.
