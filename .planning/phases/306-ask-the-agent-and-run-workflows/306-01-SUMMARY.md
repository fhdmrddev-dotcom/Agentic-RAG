---
phase: 306-ask-the-agent-and-run-workflows
plan: 01
subsystem: mcp / inbound / search / schema
tags: [mcp, g5-extraction, pure-move, migration, thread-origin, app-settings]
requires: []
provides:
  - backend/app/services/key_run_read.py::read_key_run (the key-started run read shape)
  - backend/app/services/key_run_start.py::validate_key_start (the /inbound start check order, as a value)
  - backend/app/services/search_vocabulary.py (young home for Seam A)
  - threads.origin_kind / origin_label / origin_ref + threads_origin_immutable() freeze
  - app_settings.mcp_ask_wait_seconds / outside_inflight_per_key / _per_org / _per_provider
affects: [306-02, 306-03, 306-04, 306-05]
tech-stack:
  added: []
  patterns:
    - "pure move proven by AST fence against PHASE_BASE_SHA (test_278 precedent)"
    - "validation that RETURNS a refusal value; the route builds the HTTPException"
    - "bottom-of-module import to break a two-way re-export cycle (both import orders proven)"
key-files:
  created:
    - backend/app/services/key_run_read.py
    - backend/app/services/key_run_start.py
    - backend/app/services/search_vocabulary.py
    - backend/tests/unit/test_306_key_run_pure_move.py
    - backend/tests/unit/test_306_search_vocabulary_pure_move.py
    - backend/tests/unit/test_306_migration_223_static.py
    - backend/tests/integration/test_306_migration_223_live.py
    - supabase/migrations/223_mcp_ask_run_and_admission.sql
    - scripts/check-migration-223-live.py
  modified:
    - backend/app/api/inbound.py
    - backend/app/services/search_documents_tool.py
    - backend/tests/unit/test_272_prompt_and_vocabulary.py
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "306-01: the read wire models (InboundStep/File/WaitingOn/RunRead) and _DOWNLOAD_TTL/_DOWNLOAD_PREFIX moved WITH the read and are re-exported from inbound.py as the same objects, so key_run_read.py imports nothing from app.api (public OpenAPI --check unchanged)"
  - "306-01: key_run_start catches the entitlement exception by its Starlette base class and carries it as KeyStartRefusal.exc, so it imports no fastapi and the route re-raises the same object"
  - "306-01: DATE_WORDS and _field_label stay homed in search_documents_tool.py (DATE_WORDS is an allowlisted copy in test_278_vocabulary_one_home); search_vocabulary.py imports them at its bottom"
  - "306-01: threads carries no column-level grant, so migration 223's three origin columns need no grant line"
metrics:
  duration: ~37 min (3 tasks, 6 task commits, 16 files)
  completed: 2026-10-31
---

# Phase 306 Plan 01: G-5 extractions + migration 223 Summary

Two FIRING files had their named seams taken as AST-proven pure moves (`inbound.py` →
`key_run_read.py` + `key_run_start.py`; `search_documents_tool.py` → `search_vocabulary.py`), and
migration 223 landed locally: a frozen `threads.origin_*` (now able to say `mcp`) and four
CHECK-bounded `app_settings` knobs for the MCP ask wait budget and outside-run admission.
Nothing an outside caller or a chat user sees changes.

**PHASE_BASE_SHA:** `c3a5ea8888ac606f932dd5121a34ce82fea94541` (Task 1 fence). Task 2's fence
pins `cea2df294f5d3d2ded260d2b64b9f66b54068230` (the commit Task 2 started from, after Task 1).

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|------------|--------------|
| 1 | key_run_read + key_run_start pure moves out of inbound.py (D-39, D-12, D-11) | `914ce7ffe` | `cea2df294` |
| 2 | search_vocabulary pure move, same-object re-exports (D-39, D-26) | `21e265dee` | `d2f5d8ae6` |
| 3 | Migration 223: thread origin + freeze trigger, four knobs; local apply, live check, regen (D-31) | `ff5802cb1` | `8cbc146c8` |

## Evidence

**Task 1: the eight 293/296/298 suites, before and after.** `test_293_inbound_status`,
`test_293_inbound_start`, `test_293_review_file_link`, `test_293_origin_reads`,
`test_296_kickoff_and_keys`, `test_298_foreign_binding`, `test_293_review_kill_switch`,
`test_293_review_bad_definition`: **162 passed at base, 162 passed after; the sorted id lists
`diff` empty** (no test edited). The wider 293/304/305 set (which imports `app.api.inbound`):
911 passed. `node scripts/build-public-openapi.cjs --check`: OK, no drift (231/273 paths,
324 schemas). Fences A-E + fresh-interpreter + symtable: 23 passed (with `test_293_seams_moved`).

**Task 2.** Fence + the 272 / 259 / 261 / 278-registry suites: 146 passed. The full
272/278/284/294 set: 934 passed. `_TOOL_REGISTRY` still 30. `agent_loop.py` and
`task_service.py` byte-unchanged against base (a fence asserts it).

**Task 3.**
- `check-migration-223-live.py` before applying: exit 1, naming all 15 missing items. After
  applying the file TWICE in one asyncpg session to `127.0.0.1:54322` (idempotent): `223 live`,
  exit 0.
- `test_306_migration_223_static.py` + `test_306_migration_223_live.py`: 35 passed, **no SKIPPED
  line**. The live suite re-applies the migration a third time, and proves: a service-role insert
  keeps `('mcp', label, ref)`; an UPDATE that rewrites the origin keeps it as the service role AND
  as an authenticated member through `_apply_rls_user_context` (`UPDATE 1` asserted, and the
  unrelated `title` change DID land, so neither pass is vacuous); a member's INSERT that sends an
  origin stores NULLs; `'bogus'` is a CheckViolation; the knobs read 30/2/4/6 and refuse 46/4/0/51/0
  while accepting the boundaries; `has_function_privilege` is false for anon/authenticated, true for
  service_role. Every write is rolled back. No statement runs as `anon` (BUG-261031-01).
- `regenerate-full-schema.sh` run with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"`, no `--reset`:
  the `full-schema.sql` diff is +116 / −1, and the one removed line is `active_expert_id uuid`
  regaining a trailing comma because 223's columns follow it — no unrelated removal.
- `check-schema-acl-parity.cjs`: OK (every function and table/column ACL mirrored).
- `check-hot-file-ledger.cjs 306`: OK. `check-claude-md-size.cjs`: OK (108,386 chars).
- Neutrality: `git diff c3a5ea888 --stat` on `threads.py`, `agent_loop.py`,
  `provider_gateway/dispatcher.py`, `run_producer.py`, `workflow_kickoff.py`, `task_service.py`,
  `tool_dispatcher.py`, `frontend/src/lib/api.ts`: empty.

**Backend unit baseline gate (once for the plan, at `8cbc146c8`):**
`node scripts/check-backend-unit-baseline.cjs` → **`70 failed, 11428 passed, 1 skipped, 2 xfailed,
2 xpassed`, 0 collection errors — GATE PASSED (70 ≤ 71).** Inherited, proven against the base
rather than a written number: the 70 failing ids were re-run with the three modified files checked
out at `c3a5ea888` (`inbound.py`, `search_documents_tool.py`, `test_272_prompt_and_vocabulary.py`)
and again at HEAD — **68 fail in both, the identical set (`diff` empty)**. The other 2
(`test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`,
`::test_the_registry_read_only_ever_turns_failed_into_cancelled`) pass in isolation on BOTH trees:
they are order-dependent in the full run and touch `run_producer` / the run registry, which this
plan does not edit. None of the 70 lives in a file that imports a module this plan changed.

**Live neighbours after 223:** `test_305_schema_privileges_live.py`, `test_305_tools_live.py` and
`test_306_migration_223_live.py`: 47 passed.

**Local-DB lock:** taken with noclobber before the first DB statement (`306-01 187
2026-10-31T19:19:13Z`), released after the baseline run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The moved vocabulary reads two names that cannot move**
- **Found during:** Task 2
- **Issue:** `_vocabulary_note` reads `DATE_WORDS` and `_field_label`, which live in
  `search_documents_tool.py` and are used by the handler there. Moving `DATE_WORDS` would plant a
  literal copy of the date-word list outside its allowlist (`test_278_vocabulary_one_home`), and a
  top-of-module import in either direction is an import cycle.
- **Fix:** both names stay homed in the tool; `search_vocabulary.py` imports them at its BOTTOM
  (after every definition) and the tool's re-export import sits at ITS bottom. The fence proves
  `import app.services.search_vocabulary` and `import app.services.search_documents_tool` both
  succeed FIRST in a fresh interpreter, and that the borrowed names are the tool's own objects.
- **Files:** `backend/app/services/search_vocabulary.py`, `backend/app/services/search_documents_tool.py`
- **Commit:** `d2f5d8ae6`

**2. [Rule 3 - Blocking] A deliberate pin update in test_272_prompt_and_vocabulary.py (D-39)**
- **Found during:** Task 2
- **Issue:** two tests monkeypatched `list_field_definitions` / `top_document_types` on
  `search_documents_tool` and then called `load_search_vocabulary`; after the move the function
  reads those names from `search_vocabulary`, so the patch would miss.
- **Fix:** the two patches now target `app.services.search_vocabulary` (where the name is read),
  with a comment naming D-39. Every assertion is unchanged; no invariant was weakened.
- **Commit:** `d2f5d8ae6`

**3. [Rule 1 - Cleanliness] Dead imports dropped after each move**
- `inbound.py`: `posixpath`, `secrets`, `InboundInputRefused`, `validate_inbound_inputs`,
  `foreign_binding_refusal` (all now used only in the moved code). `search_documents_tool.py`:
  `copy`, `datetime`/`timezone`, `top_document_types`. No test reads them from those modules
  (grepped before removal).

**4. [Design choice inside the plan's latitude] Wire models moved with the read**
- The plan allowed either a function-local import of the wire models or a move with same-object
  re-exports. A function-local import could not bind `InboundFile` for the moved `_file_links`
  (an AST-identical body reads it as a module global), so the four read models and the two link
  constants moved, re-exported from `inbound.py`. Fence D asserts they are the same objects; the
  public OpenAPI check reports no change.

**5. [Fence shape] Fence B's two named substitutions**
- `read_key_run`'s body equals the base `read_inbound_run` slice with exactly two documented
  substitutions: the `audit_key_call(...)` statement stays in the route (it is written with
  `result.status`), and `_public_api_base(request)` is computed by the route and passed as
  `files_base`. The fence applies both to the base AST and then requires dump equality.

## Owed (not done here, by design)

- **Cloud paste of migration 223 is OWED** to the operator, AFTER 220 -> 221 -> 222, each with its
  own per-action approval, before the 306 backend deploys; then `get_advisors(security)`. This
  plan touched neither the cloud project nor the Supabase MCP.
- `scripts/check-greenfield-privileges.py` was NOT run: it creates and drops scratch databases on
  the shared local cluster (BUG-261031-01 territory). `check-schema-acl-parity.cjs` (text parity)
  is green; run the greenfield check on a disposable Postgres at phase close.

## Known Stubs

None.

## Threat Flags

None. The new surface (three `threads` columns, one trigger function, four knobs) is the plan's
own threat register (T-306-08, T-306-23..26), each mitigated as listed above.

## TDD Gate Compliance

RED (`test(306-01)`) precedes GREEN for every task: `914ce7ffe` → `cea2df294`,
`21e265dee` → `d2f5d8ae6`, `ff5802cb1` → `8cbc146c8`. Each RED was run and failed before its
GREEN (13, 7 and 35 failures respectively).

## Self-Check: PASSED

All 9 created files exist; all 6 task commits (914ce7ffe, cea2df294, 21e265dee, d2f5d8ae6, ff5802cb1, 8cbc146c8) are in the branch history. STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
