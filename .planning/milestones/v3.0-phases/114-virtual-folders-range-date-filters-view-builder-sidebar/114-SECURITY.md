---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
secured: 2026-06-20
asvs_level: L1
block_on: high
threats_total: 25
threats_mitigate: 16
threats_accept: 9
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
cr01_new_endpoint_verified: true
---

# Phase 114 — Security Audit (secure-phase)

**Verdict: SECURED.** All 16 `mitigate` threats verified present in shipped code at file:line; all 9 `accept` dispositions are coherent and genuinely low-risk (8 are zero-package supply-chain accepts; 1 is a caller-scoped count render with no new query). The CR-01 new stateless `POST /document-views/resolve` endpoint (added during code review, NOT in the plan-time register) was verified in-scope for T-114-02-01/02/03 and applies the SAME caller-scoped own+global leak-safety + bound-param binding as the saved-view path, with NO DB write and NO audit. WR-01/WR-02 operand validation confirmed present.

This audit verified controls in the SOURCE, not in SUMMARY/REVIEW prose (the "static would false-green" discipline). Implementation files were read-only.

---

## Threat Verification (16 mitigate)

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-114-01-01 | Tampering | mitigate | CLOSED | `view_filter_compiler.py` no f-string/`.format()` SQL — every op returns a `Fragment` w/ bound `value`. The lone `f"%{cond.value}%"` (`view_operators_extra.py:122`) is a LIKE pattern carried in the bound `Fragment.value`, not SQL. Live SC#4 proof: `test_113_view_filter_compiler.py:173-187` payload `'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}` rides as a bound literal. |
| T-114-01-02 | Tampering | mitigate | CLOSED | `Fragment.field` typed leg uses CONSTANT cols via `PROMOTED_TYPED_COLUMNS` dict (`view_filter_compiler.py:152`, `view_operators_extra.py:52/90/124/150/160`), never user input. `_`-prefix rejected unconditionally `view_filter_compiler.py:274`; whitelist check `:276`. |
| T-114-01-03 | Elevation of Privilege | mitigate | CLOSED | Registry-miss `KeyError` fail-closed `view_filter_compiler.py:189`; Pydantic `Literal` discriminator `document_view.py:42-54`. `test_113::test_unknown_op_rejected` (line 93). Hardened further by `validate_operands` (WR-01/WR-02) `view_filter_compiler.py:214`. |
| T-114-01-04 | Denial of Service | mitigate | CLOSED | `074_view_typed_columns.sql:77-95` IMMUTABLE `view_iso_to_date` w/ ISO-regex guard (`:84`) + `EXCEPTION WHEN others → NULL` (`:92-93`). Live proof: `test_114_typed_columns.py:234-280` (calendar-invalid `2026-13-99`/`2026-02-31`/`0000-00-00` → NULL, insert succeeds; `provolatile=='i'`). |
| T-114-02-01 | Information Disclosure | mitigate | CLOSED | Both legs scope from `caller`: own `document_views.py:523` `.eq("user_id", caller)`; global `:533` via `get_globally_visible_folder_ids(supabase, caller)` `:490`. `view["user_id"]` appears ONLY in readability-gate comments (`:307`), never a documents query (grep: lines 18/283/307/316/519 all comments). Live two-user leak proof `test_114_resolve_range_date.py:402-434` (A excludes B; cross-user read → 404). |
| T-114-02-02 | Information Disclosure | mitigate | CLOSED | Count path `document_views.py:493-517`: `.select("id")` only (never `*`), same caller-scoping (`:505` own, `:514` global), id-set DISTINCT union `:517` `len(own_ids | glob_ids)`. Live proofs `test_114_count_only.py:277-314` (overlap dedupe), `:317-339` (caller-scoped, never counts other user). |
| T-114-02-03 | Tampering | mitigate | CLOSED | Typed leg = CONSTANT col `document_views.py:453`; custom leg field re-validated vs live whitelist at resolve `:400-405`; `.in_` for `one_of` (PostgREST-quoted) `:472`; `is_empty` `.or_` uses whitelisted const col + HARD-CODED RHS tokens `:478`; values bound via `getattr(q, frag.builder)(col, frag.value)` `:482`. |
| T-114-02-04 | Information Disclosure | mitigate | CLOSED | `_relative_window` recomputes from `date.today()` server clock `document_views.py:106`; `within_next` `.gte(today)` excludes overdue `:465`. Live proofs `test_114_resolve_range_date.py:219-302` (server-clock, month boundary, frozen-clock drift), `:471-501` (overdue excluded live). |
| T-114-03-01 | Denial of Service | mitigate | CLOSED | ISO-regex `CASE`/helper → NULL on bad date (same as T-114-01-04). Live full-dataset proof `test_114_typed_columns.py:216-280`. |
| T-114-03-02 | Denial of Service | mitigate | CLOSED | `074_view_typed_columns.sql:36/110` `BEGIN;...COMMIT;` atomic wrapper; applied via `scripts/apply_migration_074.py` psycopg2-direct (no `db push`/`reset`). Read-back: columns present in `full-schema.sql` L537-538, indexes L1488/L1495 (data preserved 33→33 per Plan-03). |
| T-114-03-03 | Tampering | mitigate | CLOSED | `full-schema.sql` regenerated (no `--reset`): `view_iso_to_date` L227, both GENERATED STORED cols L537-538, both btree indexes L1488/L1495 — matches migration 074. EXPLAIN/backfill tests fail-loud if columns absent (`test_114_resolve_range_date.py:448-449` `pytest.fail`). |
| T-114-04-01 | Elevation of Privilege | mitigate | CLOSED | `DocumentList.tsx` reuses existing `MoveToFolderDialog` (grep=3) → `PATCH /documents/{id}/move` (already-shipped owner-scoped endpoint). Zero net-new backend/authz; `onDrop`/`onDragStart`=0 (verified in 114-VERIFICATION). |
| T-114-05-01 | Tampering | mitigate | CLOSED | Client only assembles AST + POSTs it; server is the trust boundary. `_resolve_filter` re-runs `validate_fields` + `validate_operands` at resolve `document_views.py:387-388` (this IS save-time check for the ad-hoc path); custom-leg field re-checked `:401`. Hand-crafted payload → 422 or bound literal. |
| T-114-05-02 | Information Disclosure | mitigate | CLOSED | `resolveFilterCount` (`api.ts:2143`) → `resolveAdHoc` → `POST /document-views/resolve` → `_resolve_filter` caller-scoped count. Live proof `test_114_resolve_adhoc.py:208-228` + caller-scope `:308-329`. |
| T-114-06-01 | Information Disclosure | mitigate | CLOSED | Per-view badge `ViewsGroup.tsx:12` `resolveView(id, {count_only})` → caller-scoped own+global count (`document_views.py:493-517`). A global view's badge shows CALLER's count, never owner's. |
| T-114-06-02 | Information Disclosure | mitigate | CLOSED | `ViewsGroup`/`IngestionPage` render `listViews()` (`api.ts:2081`) → `GET /document-views` → Phase-113 leak-safe `document_view_service.list_views(caller)` (`document_views.py:162`). No client-side filtering bypass — client renders only what the server returns. |

### CR-01 new-endpoint check (explicit in-scope verification target)

The code review added `POST /document-views/resolve` (`resolve_adhoc` → shared `_resolve_filter`), absent from the plan-time register. Verified it does NOT open an unscoped surface:
- **Caller-scoped, no view owner:** `resolve_adhoc` (`document_views.py:354-360`) passes `caller=current_user["id"]` to `_resolve_filter`; the core scopes every documents leg from `caller` (own `.eq("user_id", caller)` `:523`/`:505`; global from `get_globally_visible_folder_ids(supabase, caller)`). There is no view owner in this path.
- **Bound params (SC#4):** same `compile_filter` + `_apply` as the saved-view route — values ride as PostgREST bound params.
- **No persist / no audit:** `_resolve_filter` performs no `document_views` write and no `write_audit_entry`. Live proof `test_114_resolve_adhoc.py:262-305` asserts ZERO audit rows + ZERO view rows after multiple resolves; the old `__live_*` create→delete dance is fully removed (grep: no `__live_` in shipped `frontend/src`).
- **Folder-scope owner-scoped:** `_resolve_filter:419-429` intersects the resolved subtree with the caller's visible folders.

### WR-01 / WR-02 (Tampering hardening of T-114-01-03 / T-114-05-01)

- **WR-01** — range op on a custom NUMBER field rejected (422) to avoid lexical `metadata->>` comparison: `_RANGE_OPS` check `view_filter_compiler.py:242-246`; number-field set assembled by `_build_field_meta` `document_views.py:144-146`. Live 422 proof `test_114_resolve_adhoc.py:332-362`.
- **WR-02** — empty `one_of`, missing `between` bounds, missing scalar, non-numeric N all → `ValueError`→422: `validate_operands` `view_filter_compiler.py:248-260`; called at create (`:183`), update (`:241`), and resolve (`:388`).

---

## Accepted Risks (9 accept — coherence confirmed)

| Threat ID | Category | Rationale | Coherent? |
|-----------|----------|-----------|-----------|
| T-114-01-SC | Tampering (supply chain) | Zero npm/pip installs in Plan 01 (compiler/migration author). | Yes — no new deps; backend-only Python edits + SQL. |
| T-114-02-SC | Tampering (supply chain) | Zero installs in Plan 02 (resolve route). | Yes. |
| T-114-03-SC | Tampering (supply chain) | Zero installs in Plan 03 (migration apply + tests). | Yes — psycopg2 already in deps. |
| T-114-04-02 | Information Disclosure | Per-folder counts render from data the folder tree already holds for the caller; no new cross-user query. | Yes — counts are caller-scoped by the existing folder fetch; no new resolve call per folder. Low risk. |
| T-114-04-SC | Tampering (supply chain) | Zero installs (composes existing shadcn/lucide/MoveToFolderDialog). | Yes. |
| T-114-05-03 | Tampering | Client relative-date readout is PREVIEW-only; server derives the real window from its clock (D-114-16). | Yes — `_relative_window` is the sole authority (`document_views.py:106`); a tampered client readout cannot change returned rows. |
| T-114-05-SC | Tampering (supply chain) | Zero installs (native controls). | Yes. |
| T-114-06-03 | Tampering | Sidebar pin / `selectedViewId` is client/session-only state; affects layout/selection, not authz. | Yes — every resolve is server-scoped; a tampered value cannot widen data access. Low risk. |
| T-114-06-SC | Tampering (supply chain) | Zero installs. | Yes. |

All 8 `*-SC` supply-chain accepts: no `package.json` / `requirements.txt` additions for Phase 114 (composed from existing primitives + Python stdlib). Accepts are coherent and genuinely low-risk.

---

## Unregistered Flags

None of the SUMMARY/REVIEW changes constitute unmapped new attack surface:
- **CR-01 `POST /document-views/resolve`** — new endpoint, but it maps cleanly onto the existing resolve-path threats T-114-02-01/02/03 (explicitly verified in-scope above). It REDUCES attack surface (removes per-keystroke audit-row creation). Informational, not a blocker.
- **WR-01..WR-07 / IN-01..06** — defensive hardening + quality fixes within already-registered components; no new surface.

---

## Result

- **threats_open: 0**
- **Closed: 25/25** (16 mitigate verified in shipped code + 9 accept coherent)
- **ASVS Level: L1** · **block_on: high** — no high-severity open threat; phase may ship from a security standpoint.

Implementation files were not modified. The only open phase item (human WCAG AA exhaustive measurement, logged as SEED-092) is an accessibility/UX completeness item, not a security threat in this register.
