---
phase: 143-starter-workflow-library-stretch
plan: 03
subsystem: database
tags: [supabase, migration, seed, workflows, harness, docxtpl, python-docx, storage, pydantic]

# Dependency graph
requires:
  - phase: 143-01
    provides: WorkflowDefinition.category (str | None) — the additive-optional curation marker each seeded def carries INSIDE its definition JSONB (category='starter'); without it extra='forbid' would 422 the seed + fork round-trip
  - phase: 104-pm-flagship-content-pack
    provides: scripts/seed-pm-pack.py (upload_template byte round-trip, _assert_slug guard, name-only secret bootstrap, _build_def def shape) + scripts/pm-pack/make_pm_templates.py (the Pitfall-4-safe {%tr%} docxtpl builder) + the 2 committed source templates
provides:
  - "supabase/migrations/094_starter_workflows.sql — 3 is_global published starter definitions (category='starter'), the ONLY path that can set is_global=true (mig 056 RLS); AUTHORED here, applied by Plan 05"
  - "scripts/pm-pack/templates/compliance-gap-report.docx — fresh 6-col {%tr%} table + scalar header template (the 1 net-new artifact); committed built bytes"
  - "scripts/seed-starters.py — storage re-home (3 .docx -> seed-user _library prefix) + a deterministic --validate-migration gate"
affects: [143-05 (BLOCKING operator apply of mig 094 + storage upload + full-schema regen), 143-04 (Starters shelf reads these 3 category='starter' rows via GET /workflows/starters)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promote = TRANSFORM not verbatim copy (D-143-4b / Pitfall 1): strip private folder binding + every per-phase KB scope, re-home assets[].asset_id to the seed-user _library prefix, add category='starter'"
    - "Storage-seed split: a SQL migration seeds the DB rows (canonical, captured by full-schema.sql); a Python service-role script uploads the template bytes the migration references (a migration cannot place Storage bytes)"
    - "Deterministic no-DB migration validator: regex-extract each ::jsonb literal, model_validate as WorkflowDefinition, assert the transform invariants (category / no folder binding / seed prefix) — exit non-zero on any failure"

key-files:
  created:
    - supabase/migrations/094_starter_workflows.sql
    - scripts/pm-pack/templates/compliance-gap-report.docx
    - scripts/seed-starters.py
  modified:
    - scripts/pm-pack/make_pm_templates.py

key-decisions:
  - "Used DISTINCT slugs (risk-register / weekly-status-report / compliance-gap-report) — NOT the operator's pm-* source slugs — because UNIQUE(slug,version) is GLOBAL (mig 056) and ON CONFLICT (id) would NOT catch a slug/version collision with the operator's existing pm-risk-register v1 row"
  - "Stripped project folder binding + every per-phase KB scope from the promoted defs so retrieval runs over the FORKER's own KB (a private folder id would retrieve zero evidence and the strict citation gate would fail every forker's run)"
  - "Kept citation_policy/integrity_policy strict + citations_required(fail_run) + output_file_valid(fail_run) on every emit phase (D-143-7): an honest failure over a fabricated deliverable"
  - "seed-starters.py DB responsibility is storage-only + validate; the canonical def INSERT lives in the migration (captured by full-schema.sql), NOT re-implemented in the script"

patterns-established:
  - "Pattern 1: transform-on-promote — the seed migration carries the source def SHAPE with 3 deltas (add category, omit folder binding/scope, re-home asset_id), never a verbatim copy of the private source row"
  - "Pattern 2: idempotent immutable seed — fixed uuid (00000000-...-00c1/c2/c3) + ON CONFLICT (id) DO NOTHING; never UPDATE a published row (the mig-056 immutability trigger raises 23514)"

requirements-completed: []  # WF-01 is phase-spanning (5 plans); Plan 03 lands the curated content, not the shipped shelf. Marking WF-01 complete now would be dishonest.

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 143 Plan 03: Starter Content Authoring Summary

**Authored the 3 curated Starters as trusted seed content on existing primitives — migration 094 (3 transformed is_global `category='starter'` definitions with distinct slugs, no private folder binding, seed-prefix-re-homed templates, strict citation gates), a fresh Compliance Gap Report `.docx`, and a storage-seed + deterministic migration-validator script.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-10T06:13:24Z
- **Completed:** 2026-07-10T06:19:50Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- **Migration 094** — 3 `is_global` published starter definitions (`risk-register`, `weekly-status-report`, `compliance-gap-report`), each carrying `category='starter'`, with the D-143-4b transform applied (no private folder binding, no per-phase KB scope, `assets[].asset_id` re-homed to `00000000-…-01/_library/<slug>.docx`) and the strict emit gate intact. Fixed uuids c1/c2/c3 + `ON CONFLICT (id) DO NOTHING` = idempotent. DISTINCT slugs avoid the global `UNIQUE(slug,version)` collision with the operator's `pm-*` rows.
- **Compliance Gap Report `.docx`** — the phase's one net-new artifact: a `{%tr for r in rows %}` 6-column table (requirement / source_clause / current_state / gap / severity / owner) + a scalar header block (report_title / report_date / scope), authored via a `build_compliance_gap_report()` python-docx builder wired into `make_pm_templates.py`'s `build()`. Re-opens clean; a throwaway render grew the table to N cited rows across all 6 columns.
- **`scripts/seed-starters.py`** — `--upload` re-homes the 3 committed `.docx` to the seed-user `_library/` prefix via a service-role client with a byte round-trip; `--validate-migration` is a deterministic no-DB gate (regex-extract each `::jsonb` def, `model_validate` as `WorkflowDefinition`, assert `category='starter'` + no folder binding + no phase KB scope + asset_ids under the seed prefix). Proven to exit non-zero on a transform-violating def.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the Compliance Gap Report .docx (python-docx builder)** - `b5ca9d59` (feat)
2. **Task 2: Author migration 094 — 3 transformed seed-INSERT rows** - `4c3f568d` (feat)
3. **Task 3: scripts/seed-starters.py — storage upload + migration validator** - `86ab6cef` (feat)

**Plan metadata:** (this commit) `docs(143-03): complete starter content authoring plan`

## Files Created/Modified
- `supabase/migrations/094_starter_workflows.sql` - 3 transformed, strict-gated, distinct-slug starter seed rows (`category='starter'`, no folder binding, seed-prefix asset_ids). AUTHOR-ONLY: applied by Plan 05 via the Supabase SQL editor.
- `scripts/pm-pack/templates/compliance-gap-report.docx` - fresh 6-col `{%tr%}` table + scalar header template (committed built bytes).
- `scripts/seed-starters.py` - storage re-home (`--upload`) + deterministic migration validator (`--validate-migration`); mirrors `seed-pm-pack.py`, lives under `scripts/` (not the uvicorn-watched `backend/`).
- `scripts/pm-pack/make_pm_templates.py` - added `build_compliance_gap_report()` + wired it into `build()`/`__main__`; header docstring extended.

## Decisions Made
- **Distinct slugs, not `pm-*`:** `UNIQUE(slug,version)` is global; seeding `pm-risk-register v1` would UNIQUE-violate against the operator's existing local row (ON CONFLICT (id) does not catch a slug/version conflict). Used `risk-register` / `weekly-status-report` / `compliance-gap-report`.
- **Kept the seed-user INSERT OUT of 094:** the seed system user `00000000-…-01` is already present from mig 056/061 (referenced, not re-inserted) — this also keeps exactly 3 `ON CONFLICT (id) DO NOTHING` lines (the Task 2 structural verify).
- **Prompts written apostrophe-free** so the JSONB is a clean single-quoted SQL literal, cleanly extractable by the validator's `'…'::jsonb` regex (which also un-escapes SQL `''` for future robustness).
- **Compliance template has no derived cell** (unlike the Risk Register's inline P×I Score) — all 6 columns are plain cited `{{ r.<col>.value }}` cells.

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes (Rules 1-3) were needed; no architectural decisions (Rule 4) arose. No package installs (python-docx/docxtpl already in the venv + sandbox image, per RESEARCH § Package Legitimacy Audit). No CLAUDE.md-driven adjustments — the migration is AUTHOR-ONLY here (Plan 05 owns the blocking SQL-editor apply + `full-schema.sql` regen; no `db push`/`db reset` run).

## Issues Encountered
None. Git emitted cosmetic `LF will be replaced by CRLF` warnings on the new/edited text files (Windows autocrlf) — expected, no action needed. A pre-existing untracked `scripts/pm-pack/out/` dir (prior UAT output, not created by this plan) was left untouched per scope boundary.

## Threat Surface Scan
No new threat surface beyond the plan's `<threat_model>`. The migration is the sanctioned `is_global` seed (T-143-01); the script's service-role upload writes ONLY under the seed-user prefix (T-143-05); the promoted defs strip the private folder binding (T-143-04); the seed names ONLY `render_template` + `search_documents` (closed registries, T-143-03); no package installs (T-143-SC). The `--validate-migration` parser reads only the trusted committed migration file (no untrusted input). No new network endpoint, auth path, or schema-at-trust-boundary surface. No Threat Flags.

## Known Stubs
None. This plan authors curated seed content + a script — no UI, no hardcoded empty values that flow to rendering, no placeholder/TODO text intended for a later plan to resolve. The 3 definitions and the template are complete, runnable content.

## User Setup Required
None in THIS plan. The BLOCKING operator step (apply migration 094 via the Supabase SQL editor, run `scripts/seed-starters.py --upload`, regenerate `full-schema.sql`) is Plan 05's responsibility, not this one.

## Next Phase Readiness
- **Plan 05 (BLOCKING apply):** migration 094 is authored + validated; `scripts/seed-starters.py --upload` is ready to re-home the 3 templates once the local Supabase stack is up. Apply order: paste 094 into the SQL editor → run `--upload` → `bash scripts/regenerate-full-schema.sh` (no `--reset`) → commit the migration + regenerated `full-schema.sql`.
- **Plan 04 (Starters shelf):** the 3 `category='starter'` global rows are exactly what `GET /workflows/starters` (Plan 02) selects, so the shelf has live content to render once 094 is applied.
- **UAT (D-143-4a / SC-d):** each starter must be fork-run end-to-end against a POPULATED KB (the strict citation gate fails an empty/mismatched KB by design — Pitfall 2). A1 (engine `ctx.supabase` is service-role so a non-operator forker can read the seed-prefix template) is HIGH-confidence but unverified end-to-end — confirm with one non-operator fork-run at UAT.

## Self-Check: PASSED

All 4 files exist on disk (migration 094, compliance-gap-report.docx, seed-starters.py, make_pm_templates.py) and all 3 task commits (`b5ca9d59`, `4c3f568d`, `86ab6cef`) are present in the git log.

---
*Phase: 143-starter-workflow-library-stretch*
*Completed: 2026-07-10*
