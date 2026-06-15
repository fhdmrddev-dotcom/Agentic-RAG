---
phase: 101-template-fill-integrity-validation
plan: 01
subsystem: testing
tags: [docxtpl, ooxml, python-docx, python-pptx, openpyxl, pydantic, pytest, fixtures, sandbox, supabase-storage, psycopg2]

# Dependency graph
requires:
  - phase: 097-spike-risk-register-template-fill
    provides: "make_template.py {%tr %} docx generator, render_docx.py (build_context/render/assert_integrity/residual_tags), derive_fields.check_coverage — the spike artifacts this plan ports the fixtures + test contract from"
  - phase: 098-project-binding-server-side-kb-scope-governance
    provides: "AssetRef + WorkflowDefinition.assets[] additive-optional schema (locked, zero-migration) — the shape the seeded library fixture satisfies"
  - phase: 100-ephemeral-template-upload
    provides: "test_workspace_template.py cross-plan TDD contract structure (the analog mirrored exactly); workspace_files kind/expires_at columns (migration 068)"
provides:
  - "backend/tests/unit/test_template_render.py — TMPL-02 deterministic-core cross-plan TDD contract (6 named render tests, all xfail RED-by-design)"
  - "backend/tests/unit/test_template_integrity.py — TMPL-03 cross-plan TDD contract (3 named integrity tests, all xfail)"
  - "4 real OOXML fixtures + make_fixtures.py (a {%tr %} docx, a run-fragmented {{token}} docx, a pptx table, a chart+merged-cell xlsx)"
  - "docxtpl==0.20.2 in Dockerfile.sandbox (the one net-new production dependency, sandbox tier)"
  - "seed_library_asset.py + uat_fixture_ids.json — the seeded trusted-path library-asset fixture (D-09) in the live local DB/Storage"
affects: [101-02-template-render-service, 101-03-asset-resolution, template-fill, cross-provider-scoreboard]

# Tech tracking
tech-stack:
  added: ["docxtpl==0.20.2 (Dockerfile.sandbox sandbox tier + backend venv test tier — NOT requirements.txt)"]
  patterns:
    - "Cross-plan TDD stub file: module docstring maps each test to its implementing plan; xfail(strict=False) RED-by-design; service imports INSIDE the test body so ImportError surfaces as xfail not a collection error (the 098/099/100 convention)"
    - "Deterministic regenerable binary fixtures via a committed make_fixtures.py (never hand-edit binaries)"
    - "Idempotent service-role data seed: INSERT-published-in-one-statement + ON CONFLICT (id) DO NOTHING so a re-run never trips the 056/067 immutable-on-publish trigger (23514); Storage upsert; secrets name-only from backend/.env"

key-files:
  created:
    - backend/tests/fixtures/templates/make_fixtures.py
    - backend/tests/fixtures/templates/risk-register.docx
    - backend/tests/fixtures/templates/arbitrary-split-token.docx
    - backend/tests/fixtures/templates/table-deck.pptx
    - backend/tests/fixtures/templates/chart-book.xlsx
    - backend/tests/unit/test_template_render.py
    - backend/tests/unit/test_template_integrity.py
    - backend/tests/fixtures/seed_library_asset.py
    - backend/tests/fixtures/uat_fixture_ids.json
  modified:
    - backend/Dockerfile.sandbox

key-decisions:
  - "docxtpl pinned in Dockerfile.sandbox (sandbox tier) + already present in the backend venv (test tier); deliberately NOT added to requirements.txt — production code never imports docxtpl (render runs in the sandbox; a backend import would be Pitfall 4)"
  - "The seed uses ON CONFLICT (id) DO NOTHING (not DO UPDATE) so a re-run never UPDATEs the published row and therefore never trips the immutability trigger; idempotency is proven by re-running the script (exit 0 twice)"
  - "Storage key uses the {user_id}/_library/... convention (RLS foldername[1]=uid); the no-TTL workspace_files marker uses kind='agent', expires_at=NULL to distinguish the library asset from an ephemeral template_input upload"

patterns-established:
  - "Pattern 1: cross-plan TDD stub file (single -k-sliceable contract; xfail until the implementing plan lands)"
  - "Pattern 2: deterministic regenerable OOXML fixtures committed alongside their generator"
  - "Pattern 3: idempotent service-role+Storage live-local data seed that emits a fixture-IDs JSON for downstream live UAT"

requirements-completed: []  # TMPL-02, TMPL-03 are Wave-0-scaffolded only; the behavior lands in Plans 02-04 — marked complete at phase close

# Metrics
duration: ~20min
completed: 2026-06-10
---

# Phase 101 Plan 01: Wave 0 Scaffold Summary

**The two cross-plan TDD contract files (9 named RED-by-design xfail tests), four real regenerable OOXML fixtures, the docxtpl==0.20.2 sandbox-image add, and a live-seeded trusted-path library-asset fixture (published WorkflowDefinition + Storage object) emitting its IDs to uat_fixture_ids.json.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-10T17:21Z (approx — execution start)
- **Completed:** 2026-06-10T17:41Z
- **Tasks:** 4
- **Files modified:** 10 (9 created + 1 modified)

## Accomplishments

- **Two cross-plan TDD contract files** mirroring the Phase 100 analog exactly: `test_template_render.py` (6 named TMPL-02 tests — field-map shape/nullable Cited, the deterministic coverage gate, the truncation guard, `{%tr %}` row growth `[1,5,20]`, the run-merge split-token reassembly, engine-by-provenance) and `test_template_integrity.py` (3 named TMPL-03 tests — corrupt-file-never-delivered, `& < >` autoescape, template_input→non-Jinja routing). All 9 are `xfail(strict=False)` with the `app.services.template_render_service` imports inside the test bodies; the suite exits 0 (11 xfailed counting the 3 parametrize cases).
- **Four real, regenerable OOXML fixtures** + `make_fixtures.py`: a trusted docxtpl `{%tr %}` register (`get_undeclared_template_variables() ⊇ {project_name, report_date, rows}`), an arbitrary-path docx with `{{client_name}}` fragmented across 3 `<w:r>` runs (the Pitfall-1 reproduction) + a clean control, a pptx with a 2×2 scalar-token table, and a chart+merged-cell xlsx.
- **docxtpl==0.20.2 added to Dockerfile.sandbox** (the one net-new production dependency) after `reportlab==4.2.5`, with a Phase-101/TMPL-02 comment; explicitly NOT in `requirements.txt`.
- **Seeded the trusted-path library-asset fixture (D-09)** into the live local stack: a published `WorkflowDefinition` (id `00000000-0000-0000-0000-0000000101a0`) whose `assets[]` AssetRef points at a real `workspace-files` Storage object at `{user_id}/_library/risk-register-101uat.docx`; IDs emitted to `uat_fixture_ids.json`. Idempotent — re-runs do not trip the immutability trigger.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate the four OOXML fixtures + make_fixtures.py** — `1d078221` (test)
2. **Task 2: Create the two cross-plan TDD test files (RED-by-design stubs) + docxtpl venv (test tier)** — `315cbe57` (test)
3. **Task 3: Add docxtpl==0.20.2 to Dockerfile.sandbox** — `3c70fc10` (chore)
4. **Task 4: Seed the trusted-path library-asset fixture (D-09) + emit uat_fixture_ids.json** — `dbb50152` (test)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — committed separately.

## Files Created/Modified

- `backend/tests/fixtures/templates/make_fixtures.py` — deterministic, idempotent generator of all 4 OOXML fixtures
- `backend/tests/fixtures/templates/risk-register.docx` — trusted docxtpl `{%tr %}` variable-row register + scalar tags
- `backend/tests/fixtures/templates/arbitrary-split-token.docx` — `{{client_name}}` fragmented across 3 runs + clean `{{report_title}}` control
- `backend/tests/fixtures/templates/table-deck.pptx` — 2×2 scalar-token table + `{{deck_title}}` (python-pptx grow-table limit probe)
- `backend/tests/fixtures/templates/chart-book.xlsx` — `{{title}}` cell + BarChart (openpyxl chart-strip) + merged-cell `A4:B4` `{{merged_note}}`
- `backend/tests/fixtures/templates/.gitattributes` — marks the 4 binaries as binary
- `backend/tests/unit/test_template_render.py` — TMPL-02 cross-plan TDD contract (6 named tests)
- `backend/tests/unit/test_template_integrity.py` — TMPL-03 cross-plan TDD contract (3 named tests)
- `backend/tests/fixtures/seed_library_asset.py` — idempotent psycopg2 + Storage-API seed of the trusted-path library-asset fixture
- `backend/tests/fixtures/uat_fixture_ids.json` — the seeded fixture IDs (definition_id + asset_id + storage_path) the live UAT consumes
- `backend/Dockerfile.sandbox` — added `docxtpl==0.20.2` to the pinned pip block

## Decisions Made

- **docxtpl is sandbox-tier + test-tier only, never a backend runtime dep.** Production render runs in the sealed Docker sandbox; importing docxtpl into `backend/app/**` would be Pitfall 4. So it goes in `Dockerfile.sandbox` (production sandbox) + the venv (test tier), and is verified absent from `requirements.txt`.
- **Seed idempotency via `ON CONFLICT (id) DO NOTHING`.** The 056/067 immutable-on-publish trigger blocks authored-column UPDATEs of a published row. A `DO UPDATE` on the `definition` column would trip 23514 on a second run, so the seed INSERTs the row already published in one statement and no-ops on conflict, reading back `assets[0].filename` to confirm success. Proven idempotent by running the script twice (exit 0 both times).
- The docxtpl venv install (Task 2 prose) was already satisfied — `docxtpl==0.20.2` is present in the backend venv from the Phase 097 spike (`backend/venv/Scripts/python.exe -c "import docxtpl"` → `0.20.2`); no re-install was needed.

## Deviations from Plan

None — plan executed exactly as written. (The Task-2 `pip install docxtpl==0.20.2` step was a no-op because the venv already had `0.20.2` from the 097 spike; this is the expected/desired state, not a deviation.)

## Issues Encountered

None. The local Supabase stack was reachable (Postgres :54322, Storage API :54321), the `workspace-files` bucket + test user + a newest thread all existed, so Task 4 seeded headlessly with no operator intervention.

## Known Stubs

The 9 `xfail(strict=False)` tests in `test_template_render.py` + `test_template_integrity.py` are **intentional RED-by-design cross-plan TDD stubs** — they assert the TARGET behavior of `app.services.template_render_service`, which is created in Plan 101-02. The `xfail` markers keep the full suite exit-0 until then (the 098/099/100 convention). These are NOT masking-stubs; each will flip GREEN when Plan 101-02 lands its named symbol. No stubs flow to UI rendering; no placeholder data.

## User Setup Required

**External services require manual configuration before live UAT (Plan 03+):**

1. **Rebuild the sandbox image with docxtpl** (operator shell), then bump the env var:
   ```
   docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/
   ```
   then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env`.
   **The tag bump only affects NEW chats** — cached sandbox sessions keep the old image until idle eviction (~30 min). Live UAT MUST use FRESH chats, or a render in an existing chat hits the old container and raises `ModuleNotFoundError: docxtpl`.

2. **Local Supabase stack UP** (already satisfied this session): `supabase start` (Postgres :54322, Storage API :54321). Task 4's seed ran headlessly against the running stack — no per-run operator clicks. If the stack is restarted, the seed is idempotent (re-run `backend/venv/Scripts/python.exe backend/tests/fixtures/seed_library_asset.py`).

## Next Phase Readiness

- **Plan 101-02** can now implement `backend/app/services/template_render_service.py` against the 9 named test contracts: defining `Cited`, the generic field-map shape, `check_coverage`, `is_truncated`, `build_context`, `render_docx_template`, `run_replace_docx`, `assert_integrity`, `residual_tags_in`, and `select_engine` will flip the xfails GREEN.
- **Plan 101-03** (asset resolution) + the cross-provider scoreboard can consume `uat_fixture_ids.json` (definition_id `00000000-0000-0000-0000-0000000101a0`, asset_id = the Storage key) to launch a trusted-path fill against the seeded library AssetRef.
- The 4 fixtures are deterministically regenerable via `make_fixtures.py`.
- **Blocker for live UAT only:** the operator sandbox rebuild + `SANDBOX_IMAGE` bump (above) — code-level work (Plans 02/03) is unblocked.

## Self-Check: PASSED

- All 9 created files exist on disk (verified) + `backend/Dockerfile.sandbox` modified.
- All 4 task commits present in git log: `1d078221`, `315cbe57`, `3c70fc10`, `dbb50152`.

---
*Phase: 101-template-fill-integrity-validation*
*Completed: 2026-06-10*
