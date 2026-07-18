---
phase: 151-agent-file-tools
plan: 01
subsystem: api
tags: [agent-tools, tool-dispatcher, sandbox, supabase-storage, cross-provider, rag]

# Dependency graph
requires:
  - phase: 101-template-fill
    provides: "render_template _ship_and_run copy-into-sandbox pattern (cloned for FILE-02)"
  - phase: 147-operator-control-plane
    provides: "_CAPABILITY_FLAG_TOOLS fail-closed in-flight refuse gate (fetch_document_file added)"
provides:
  - "fetch_document_file agent tool (FILE-02) — materializes a KB document's ORIGINAL bytes into /sandbox/input/<file>"
  - "_fetch_owned_document_bytes(ctx, document_id) — reusable owner→global bytes resolver (FILE-01 source #4 contract for Plan 04)"
  - "config.Settings.fetch_document_file_max_mb — operator-tunable size cap (env FETCH_DOCUMENT_FILE_MAX_MB, default 50)"
  - "FETCH_DOCUMENT_FILE_TOOL flat schema (no anyOf/oneOf) + sandbox-gated get_tools() append"
affects: [151-04-attach-skill-file, 152-workflow-run-inputs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "G-5 dual-wiring: one _handle_X + one _TOOL_REGISTRY line + one get_tools() schema + one _CAPABILITY_FLAG_TOOLS entry; threads.py untouched"
    - "RAG→sandbox file bridge: owner-scope resolver + threadpool download + render_template copy-into-container clone"
    - "Reusable resolver returns (filename, bytes, mime) | {error: ...} — honest-failure convention, consumed by a later plan"

key-files:
  created:
    - backend/tests/unit/test_151_tool_schema.py
    - backend/tests/unit/test_151_fetch_handler.py
    - backend/tests/unit/test_151_registration.py
    - backend/tests/unit/test_151_cross_provider_schema.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/openai_service.py
    - backend/app/config.py

key-decisions:
  - "D-02 cap lives in config.Settings (env FETCH_DOCUMENT_FILE_MAX_MB, default 50), NOT an app_settings column — avoids a second migration this phase (per plan discretion; SEED-117 tracks a later app_settings consolidation)"
  - "Reusable resolver named _fetch_owned_document_bytes — Plan 04 (FILE-01 source #4) imports THIS symbol"
  - "get_globally_visible_folder_ids imported at tool_dispatcher module level (cycle-safe; patch-where-used friendly)"
  - "fetch_document_file returns (filename, bytes, mime) tuple on success / {error} dict on refusal — honest, never a text reconstruction as the file (D-01)"

patterns-established:
  - "Size gate PRE-download: refuse over-cap with an honest MB error, no bytes ever fetched (refuse-never-truncate, D-02)"
  - "Path-traversal defense for container landing: os.path.basename + workspace.py:184 charset scrub before /sandbox/input/<safe> (T-01)"

requirements-completed: [FILE-02]

# Metrics
duration: ~30min
completed: 2026-07-13
---

# Phase 151 Plan 01: Agent File Tools (FILE-02 fetch_document_file) Summary

**`fetch_document_file` agent tool — streams a KB document's ORIGINAL bytes owner→global-scoped into `/sandbox/input/<file>` (size-capped PRE-download, path-traversal-sanitized, sandbox-gated, cross-provider-safe), plus the reusable `_fetch_owned_document_bytes` resolver that Plan 04's FILE-01 will consume.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-13T20:16:00Z (approx)
- **Completed:** 2026-07-13T20:46:17Z
- **Tasks:** 3 (Task 1 TDD RED, Task 2 TDD GREEN, Task 3 registration/cross-provider)
- **Files modified:** 3 source + 4 new test files

## Accomplishments
- FILE-02 `fetch_document_file` dual-wired through the flat `_TOOL_REGISTRY` G-5 contract — `threads.py` untouched, no `provider ==` fork.
- Owner→global bytes resolver `_fetch_owned_document_bytes` mirrors `read_path`'s scope but SELECTs storage columns; exported as the FILE-01 source #4 contract for Plan 04.
- Honest-failure semantics proven in unit tests: D-01 no-original error (never writes extracted text as a file), D-02 over-cap refused PRE-download (no partial binary), D-04/SC#4 cross-user not-found.
- T-01 path-traversal defense (basename + charset scrub) proven: `../../etc/x` lands as a scrubbed basename under `/sandbox/input/`.
- Sandbox-gated both ways: hidden from `get_tools()` when sandbox off (D-11 HIDE) + refused in-flight via `_CAPABILITY_FLAG_TOOLS` (fail-closed REFUSE).
- SC#10 static backstop: schema survives Google + Anthropic translation with the tool present by name (flat schema, no anyOf/oneOf).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 schema-shape + handler tests (RED)** - `9f17dcf8` (test)
2. **Task 2: Implement schema, handler, resolver, dual-wiring (GREEN)** - `4ccdfdb3` (feat)
3. **Task 3: Registration + cross-provider translation tests** - `3a1a008e` (test)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — final docs commit

_TDD tasks: Task 1 authored the RED tests (10 ImportError failures), Task 2 turned them GREEN in one feat commit._

## Files Created/Modified
- `backend/app/services/tool_dispatcher.py` - `_fetch_owned_document_bytes` resolver + `_handle_fetch_document_file` handler + `_TOOL_REGISTRY` line + `_CAPABILITY_FLAG_TOOLS` entry + module-level `get_globally_visible_folder_ids` import
- `backend/app/services/openai_service.py` - `FETCH_DOCUMENT_FILE_TOOL` flat schema + sandbox-gated `get_tools()` append
- `backend/app/config.py` - `fetch_document_file_max_mb` env-backed size cap
- `backend/tests/unit/test_151_tool_schema.py` - flat-schema shape (no anyOf/oneOf, document_id required)
- `backend/tests/unit/test_151_fetch_handler.py` - D-01/D-02/D-03/T-01/D-04 handler behavior + reusable-resolver contract
- `backend/tests/unit/test_151_registration.py` - dual-wiring + sandbox-gate both ways + capability-flag entry (marked FILE-01 extension point for Plan 04)
- `backend/tests/unit/test_151_cross_provider_schema.py` - Google + Anthropic translation backstop (SC#10)

## Decisions Made
- **Reusable resolver symbol = `_fetch_owned_document_bytes`** (module-level in `tool_dispatcher.py`). Plan 04 (FILE-01 source #4) MUST import this exact symbol. Returns `(filename, bytes, mime_type)` on success, `{"error": ...}` on refusal.
- **D-02 cap in `config.Settings`** (`fetch_document_file_max_mb`, env `FETCH_DOCUMENT_FILE_MAX_MB`, default 50) rather than an `app_settings` column — deliberate per the plan's D-02 discretion to avoid a second migration this phase. SEED-117 already tracks migrating this to the Control Room / `app_settings` in v3.4.
- **`document_id`-only arg** (mirrors `read_document`, D-04-faithful) — no filename fuzzy-resolve in FILE-02.
- **Optional SSE event skipped** — no live UI consumer for a fetch event this plan; additive/provider-uniform discretion left unused (Research Open Q4).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None during planned work. One expected, plan-sanctioned consequence documented below (Deferred Issues).

## Deferred Issues

**Stale exact-count assertions (owned by Plan 151-04, per plan Task 3 note + RESEARCH "Test-count artifacts"):**
- `backend/tests/unit/test_tool_dispatcher.py::test_registry_has_exactly_27_entries` — now fails `28 == 27` because FILE-02 adds one `_TOOL_REGISTRY` entry (27→28). This file is NOT in Plan 151-01's `files_modified`; Plan 04 finalizes it to `29` once FILE-01 also lands (single update for the +2 total, avoiding churn).
- `backend/tests/unit/test_085_tool_registration.py::test_get_tools_returns_22_tools_with_no_conditional_enabled` — was ALREADY failing at baseline (`24 == 22`, pre-existing rot from phases 115/116/147 adding tools). FILE-02 is sandbox-gated so it does NOT change the base (sandbox-off) count; the companion all-tools `24` assertion is likewise pre-existing rot. Both finalized in Plan 04.

These three assertions are exactly the ones RESEARCH flagged as "stale-after-add"; leaving them to Plan 04 is the plan's explicit instruction, not a deviation.

## Known Stubs
None — `fetch_document_file` is fully wired end-to-end (resolver → download → sandbox copy). No placeholder data paths.

## Threat Flags
None beyond the plan's `<threat_model>` (T-151-02-01..05). No new network endpoint, auth path, or schema change is introduced — the tool is a handler-only addition through the existing `dispatch_tool` gate, and the size cap is a config field (no DB surface).

## User Setup Required
None for local dev (default cap 50 MB, sandbox-gated). Optional: an operator may set `FETCH_DOCUMENT_FILE_MAX_MB` in `backend/.env` to tune the cap.

## Next Phase Readiness
- **Plan 151-02 (Wave 1, migration 101 unique index)** and **151-03 (Wave 1, upload allowlist widen)** are independent of this plan and ready.
- **Plan 151-04 (Wave 2, FILE-01 `attach_skill_file`)** can now import `_fetch_owned_document_bytes` from `app.services.tool_dispatcher` for its source-#4 (KB-doc) path, and MUST update the three stale exact-count assertions to the final +2 numbers.
- Live SC#10 4-axis UAT for FILE-02 (real cross-provider tool-calls) is authored in `151-VALIDATION.md`, to be exercised at phase verify-work.

## Self-Check: PASSED

- All 4 created test files present on disk + SUMMARY.md present.
- All 3 task commits (`9f17dcf8`, `4ccdfdb3`, `3a1a008e`) in git history.
- `_fetch_owned_document_bytes`, `_handle_fetch_document_file`, `FETCH_DOCUMENT_FILE_TOOL` importable.
- 17/17 `test_151_*` unit tests green.

---
*Phase: 151-agent-file-tools*
*Completed: 2026-07-13*
