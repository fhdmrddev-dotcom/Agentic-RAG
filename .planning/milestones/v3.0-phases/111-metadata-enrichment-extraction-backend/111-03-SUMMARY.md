---
phase: 111-metadata-enrichment-extraction-backend
plan: 03
subsystem: metadata-enrichment
tags: [metadata, crud, rls, audit, custom-fields, meta-01]
requires:
  - "migration 071 (metadata_field_definitions table + RLS + audit CHECK enum) — applied live"
  - "audit_service.write_audit_entry + VALID_ACTION_TYPES (metadata.field.create already seated)"
provides:
  - "/metadata-fields CRUD router (create/list/update/delete) — the authoring surface for custom metadata fields"
  - "app.services.metadata_field_service (own+global list, hard-set owner create, own-scoped mutate)"
  - "MetadataFieldCreate/Update/Response models with the field_type Literal + field_key V5 validators"
affects:
  - "Plan 02 read_enabled_field_defs folds these user-authored defs into the extraction schema on ingest"
tech-stack:
  added: []
  patterns:
    - "skills.py own+global CRUD router shape (get_current_user + RLS + 404-not-403)"
    - "service-layer data-access with optional injectable supabase client (mirrors write_audit_entry(supabase=...))"
    - "live-DB integration tests source a REAL local supabase client from backend/.env (conftest plants a fake cloud URL)"
key-files:
  created:
    - backend/app/models/metadata_field.py
    - backend/app/api/metadata_fields.py
    - backend/app/services/metadata_field_service.py
    - backend/tests/unit/test_111_metadata_field_model.py
  modified:
    - backend/app/main.py
    - backend/tests/integration/test_111_metadata_fields_crud.py
    - backend/tests/integration/test_111_audit_field_create.py
decisions:
  - "Create logic + the is_global=false hard-set live in metadata_field_service.py (not inline in the router) so the Wave-0 RED tests can drive them directly against :54322 — the RED test imports app.services.metadata_field_service by design."
  - "Service functions take an optional supabase client (default get_supabase()); the router passes the DI client, live tests inject a real local client. Root-cause fix for the conftest fake-cloud-URL getaddrinfo failure — clean DI, not a monkeypatch."
metrics:
  duration_min: 11
  completed: 2026-06-15
  tasks: 2
  commits: 2
  files_created: 4
  files_modified: 3
  tests_green: 34
---

# Phase 111 Plan 03: Custom Metadata Field Authoring (META-01) Summary

Shipped the `/metadata-fields` CRUD surface that lets a user DEFINE custom metadata fields — a new router + Pydantic models + a service-layer data-access core, mounted in `main.py`, mirroring the skills router. Create hard-sets `user_id=caller` + `is_global=false` (app code + RLS WITH CHECK), validates `field_type` against the closed `{string,date,number,boolean,enum}` Literal and `field_key` against `^[a-z][a-z0-9_]*$` + the 7 built-in keys + reserved prefixes, and writes a `metadata.field.create` audit row verified LIVE against :54322. META-01 "define" delivered.

## What Was Built

**Task 1 — Models + V5 validation (commit `20ce5eaa`)**
- `backend/app/models/metadata_field.py`: `MetadataFieldCreate` / `MetadataFieldUpdate` / `MetadataFieldResponse`.
  - `field_type` is a closed `Literal["string","date","number","boolean","enum"]` (the DB column has NO CHECK — `071:94` is `text NOT NULL DEFAULT 'string'`, so the vocabulary is enforced here per D-111-5).
  - `field_key` `field_validator`: regex `^[a-z][a-z0-9_]*$` (rejects uppercase, leading underscore, hyphens, spaces, empty), built-in collision against the 7 immutable keys, and a belt-and-suspenders reserved-prefix guard (`_confidence`/`_classification`).
  - `model_validator(mode="after")`: `enum` field_type requires a non-empty `options` list.
- `backend/tests/unit/test_111_metadata_field_model.py`: 29 pure-unit assertions covering all 5 `<behavior>` cases (closed Literal accept/reject, valid/malformed keys, built-in collision, reserved prefix, enum-options). GREEN, no DB.

**Task 2 — CRUD router + service + audit + mount (commit `e9021e37`)**
- `backend/app/services/metadata_field_service.py`: `list_field_definitions` (own+global via `.or_(...)`, deduped), `create_field_definition` (HARD-SETS `user_id=caller` + `is_global=False` — the `is_global` arg is accepted for signature symmetry but always forced False), `field_key_exists` (own-scoped dup pre-check), `update_field_definition` / `delete_field_definition` (own-scoped `.eq("user_id", caller)`, return None/False on a cross-user miss). All `.execute()` calls run through `aexec` (run_in_threadpool, D-v2.5-01). Every function takes an optional injectable `supabase` client.
- `backend/app/api/metadata_fields.py`: `router = APIRouter(prefix="/metadata-fields")`, GET/POST/PATCH/DELETE. POST returns 201, fires `write_audit_entry(action_type="metadata.field.create", ...)` (async, swallowing — never blocks the request), 409 on an own-scoped duplicate key. PATCH/DELETE collapse a cross-user miss to **404-not-403** (`detail="Metadata field not found"`, D-v2.6-04 / T-111-03-03).
- `backend/app/main.py`: added `metadata_fields` to the `from app.api import ...` tuple + `app.include_router(metadata_fields.router)` (additive only).
- Un-xfailed the 2 Wave-0 RED integration tests to real assertions; added a cross-user 404 scoping test and a real-service-path live audit round-trip (drives the REAL `create_field_definition` + `write_audit_entry`, then raw-asyncpg SELECTs the audit row back — mock-proof per the 104 lesson). 5/5 integration tests GREEN live.

## Verification

| Check | Result |
|---|---|
| `tests/unit/test_111_metadata_field_model.py` | 29 passed |
| `tests/integration/test_111_metadata_fields_crud.py` | 3 passed (live :54322) |
| `tests/integration/test_111_audit_field_create.py` | 2 passed (live :54322) |
| `python -c "import app.main"` | IMPORT_OK (router mounts clean) |
| `grep "is_global": False` (service) | MATCH |
| `grep metadata.field.create` + `write_audit_entry` (router) | MATCH |
| `grep 404-not-403` (router) | MATCH |
| `grep metadata_fields` (main.py) | 2 MATCHES (import + include_router) |
| Full collection (`pytest --collect-only tests/`) | 1632 collected, 0 collection errors |
| **SEED-056 net-new failures vs base** | **0** (only main.py touched; additive; verified) |

**Must-have truths (all confirmed live):**
- A user can define a custom field via POST /metadata-fields; the stored row has `user_id=caller` + `is_global=false` even when the caller passes `is_global=True` (asserted against the persisted row).
- `field_type` validated against the closed Literal; `field_key` matches the regex and rejects the 7 built-ins + the reserved prefixes.
- list returns own+global; update/delete are own-scoped, returning None/False (router → 404, not 403) on a cross-user miss.
- Creating a field writes a `metadata.field.create` audit row, verified by a raw-asyncpg SELECT-back through the REAL service+write_audit_entry path (not mocked).

## Threat Register Outcomes

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-111-03-01 (EoP — global field create) | mitigated | Service hard-sets `is_global=False`; RLS WITH CHECK `071:168` forces it; `test_crud_create_forces_owner_and_not_global` asserts the stored row `is_global is False`. |
| T-111-03-02 (Tampering — malicious field_key/type) | mitigated | Create-model regex + built-in collision + reserved prefix + closed `field_type` Literal; 29-case unit test asserts each rejection. |
| T-111-03-03 (Info Disclosure — 403-vs-404 leak) | mitigated | PATCH/DELETE `.eq("user_id")` + None/False→404; `test_update_delete_own_scoped_404_not_403_on_cross_user` asserts the cross-user miss. |
| T-111-03-04 (Repudiation — audit drop) | mitigated | LIVE INSERT+SELECT round-trip through the real service path (`test_create_field_emits_audit_via_real_service_path_live`); the swallowing service is bypassed by raw-asyncpg verification. |
| T-111-03-05 (Tampering — description as injection) | accept (Plan 02) | Description stored verbatim as DATA; no instruction-execution path in this router. |

## Deviations from Plan

### Auto-fixed / structural deviations

**1. [Rule 3 — Blocking issue] Create logic + is_global hard-set placed in a service module, not inline in the router.**
- **Found during:** Task 2 (`read_first` of the Wave-0 RED CRUD test).
- **Issue:** `test_111_metadata_fields_crud.py` imports `app.services.metadata_field_service` with `create_field_definition(...)` / `list_field_definitions(...)` — it drives a SERVICE, not the router (live-DB tests have no JWT/TestClient). The plan's action text described the create/hard-set inline in the router.
- **Fix:** Created `app/services/metadata_field_service.py` as the data-access core (with the `is_global=False` hard-set and own-scoping); the router is a thin delegate that adds the 409 dup-check + audit write. The plan's grep target `"is_global": False` in `metadata_fields.py` instead lands in `metadata_field_service.py` — the security invariant is identical and verified by the live test on the persisted row. Net behavior matches the plan exactly.
- **Files:** `backend/app/services/metadata_field_service.py`, `backend/app/api/metadata_fields.py`.
- **Commit:** `e9021e37`.

**2. [Rule 3 — Blocking issue] Live tests source a REAL local supabase client from backend/.env.**
- **Found during:** Task 2 (first integration run → `httpx.ConnectError: getaddrinfo failed`).
- **Issue:** `tests/conftest.py:10` does `os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")`, so the `get_supabase()` singleton points at an unreachable fake cloud URL inside pytest. The service create/list go through the REST client (not raw asyncpg), so they hit the fake URL.
- **Fix:** Made the service functions accept an optional `supabase` client (mirroring `write_audit_entry(supabase=...)`); the live tests build a real local client from `backend/.env` via the `_read_local_supabase_env` / `_supabase_or_skip` helpers copied from `test_093_ask_user_workflow_run_live.py`. Skips cleanly if `.env` creds or the REST gate are absent. Clean DI — no monkeypatch.
- **Files:** `backend/app/services/metadata_field_service.py`, both integration test files.
- **Commit:** `e9021e37`.

**3. [Rule 2 — Missing critical functionality] 409 on an own-scoped duplicate field_key.**
- **Found during:** Task 2 (the plan's create action notes a dup-key map-to-409; `071` has no unique constraint on `(user_id, field_key)`).
- **Fix:** Added a `field_key_exists` own-scoped pre-check → 409 CONFLICT before insert (prevents silent duplicate field defs). Matches the plan's recommended pre-check-then-insert path.
- **Files:** `backend/app/api/metadata_fields.py`, `backend/app/services/metadata_field_service.py`.
- **Commit:** `e9021e37`.

### Out-of-scope (deferred, NOT fixed)

- **`tests/unit/test_lifespan.py` — 3 pre-existing failures (NOT net-new).** Reproduce identically at the base commit (verified via `git stash` of the additive `main.py` mount). Logged to `deferred-items.md`. The `metadata_fields` mount is additive and does not touch lifespan close-order logic.

## Known Stubs

None. The `options` column being conditionally included in the insert is documented forward-compat for Plan 05's migration 072 (`options jsonb`), not a stub — `field_type=enum` validation + the `options` field are live on the Create model now; the column simply isn't persisted until 072 ships.

## Shared-Artifact Note

Per the orchestrator's CRITICAL shared-artifact rule for this phase, this executor did NOT modify `.planning/STATE.md` or `.planning/ROADMAP.md` and did NOT call any `gsd-sdk query state.*` / `roadmap.*` / `record-metric` / `add-decision` verb. The orchestrator owns those files. Deliverables are the 2 code commits + this SUMMARY.

## Self-Check: PASSED

- FOUND: backend/app/models/metadata_field.py
- FOUND: backend/app/api/metadata_fields.py
- FOUND: backend/app/services/metadata_field_service.py
- FOUND: backend/tests/unit/test_111_metadata_field_model.py
- FOUND: commit 20ce5eaa
- FOUND: commit e9021e37
