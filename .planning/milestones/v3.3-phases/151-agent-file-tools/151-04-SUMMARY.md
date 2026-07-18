---
phase: 151-agent-file-tools
plan: 04
subsystem: api
tags: [agent-tools, tool-dispatcher, skill-files, supabase-storage, self-improve, cross-provider]

# Dependency graph
requires:
  - phase: 151-01-agent-file-tools
    provides: "_fetch_owned_document_bytes(ctx, document_id) — owner→global bytes resolver (FILE-01 source #4)"
  - phase: 151-02-agent-file-tools
    provides: "migration 101 UNIQUE index skill_files(skill_id, filename) — enables the race-immune upsert (D-07)"
  - phase: 151-03-agent-file-tools
    provides: "widened upload allowlist (template_input scripts/.md/.json/.csv/images) — attach source #1 workspace bytes"
  - phase: 147-operator-control-plane
    provides: "_CAPABILITY_FLAG_TOOLS fail-closed in-flight refuse gate (attach_skill_file added under self_improve_enabled)"
provides:
  - "attach_skill_file agent tool (FILE-01) — saves a file onto an OWNED skill from 4 sources (workspace/sandbox_output/inline/kb_document, D-05)"
  - "_resolve_attach_source_bytes(args, ctx, source, filename) — the 4-source (bytes, mime) resolver / honest-error dict"
  - "ATTACH_SKILL_FILE_TOOL flat source-enum schema (no anyOf/oneOf) + self_improve-gated get_tools() append"
  - "skill_file_attached additive SSE event (provider-uniform, best-effort)"
affects: [152-workflow-run-inputs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "G-5 dual-wiring: one _handle_X + one _TOOL_REGISTRY line + one get_tools() schema + one _CAPABILITY_FLAG_TOOLS entry; threads.py untouched"
    - "Owner-only WRITE gate: resolve target by name under .eq(user_id) (never the .or_(is_global.eq.true) READ filter) + reject is_system — load-bearing under service-role (no RLS backstop)"
    - "Race-immune overwrite: Storage .upload(upsert=true) + PostgREST .upsert(on_conflict=skill_id,filename); pre-check SELECT drives created/updated REPORT only"
    - "Owner-prefixed, never-model-supplied storage path {uid}/{skill_id}/{filename} + filename basename+charset scrub (traversal-proof)"

key-files:
  created:
    - backend/tests/unit/test_151_attach_handler.py
    - .planning/phases/151-agent-file-tools/deferred-items.md
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/openai_service.py
    - backend/tests/unit/test_151_registration.py
    - backend/tests/unit/test_151_cross_provider_schema.py
    - backend/tests/unit/test_085_tool_registration.py
    - backend/tests/unit/test_tool_dispatcher.py

key-decisions:
  - "Inline (source #3) is UTF-8 text with a 5 MB _ATTACH_INLINE_MAX_BYTES weak-model guard (empty/non-str/oversized → honest error). Base64 NOT wired — the flat schema keeps exactly the 4 optional fields the plan specified (no encoding-declaration field); large/binary files use the workspace or sandbox_output source."
  - "Created-vs-updated is an informational REPORT driven by a pre-check SELECT; DB write correctness is the race-immune upsert on the Plan-02 unique index (two concurrent same-name attaches may both report 'created' but the DB still collapses to one row)"
  - "Optional skill_file_attached SSE ADDED (additive, provider-uniform, best-effort no-op when emit/run_id absent)"
  - "Filename sanitized to a safe basename (basename + [^a-zA-Z0-9._\\- ] scrub, matching FILE-02's stem) so a model '../..' filename can never escape the owner-prefixed storage path (T-02 / Pitfall 4)"

patterns-established:
  - "Four-source discriminator resolver returns (bytes, mime) | {error: ...} — the honest-failure convention, one honest error per weak-model / owner-scope refusal"
  - "self_improve-gated WRITE tool: HIDE in get_tools() when self-improve OFF + REFUSE in-flight via _CAPABILITY_FLAG_TOOLS (defense-in-depth, the SAVE_SKILL_TOOL precedent)"

requirements-completed: []

# Metrics
duration: ~9min
completed: 2026-07-14
---

# Phase 151 Plan 04: Agent File Tools (FILE-01 attach_skill_file) Summary

**`attach_skill_file` — the agent WRITE tool that saves a file onto a skill the caller OWNS from all four sources (workspace file, sandbox output, inline text, KB document), owner-only-gated (refuses global/`is_system`/other-user skills), overwriting a colliding filename in place via a race-immune `on_conflict=skill_id,filename` upsert on Plan-02's unique index, always writing to the owner-prefixed `{uid}/{skill_id}/{filename}` path — dual-wired through the flat `_TOOL_REGISTRY` G-5 contract, self_improve-gated both ways, cross-provider-safe, reusing Plan-01's owner-scope resolver for source #4.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-07-14
- **Tasks:** 3 (Task 1 TDD RED, Task 2 TDD GREEN, Task 3 registration/cross-provider + count-fixes)
- **Files:** 2 source + 1 new test + 3 modified tests + 1 deferred-items note

## Accomplishments
- FILE-01 `attach_skill_file` dual-wired through the flat `_TOOL_REGISTRY` G-5 contract + `get_tools()` (self_improve-gated, appended next to `SAVE_SKILL_TOOL`) + `_CAPABILITY_FLAG_TOOLS` — `threads.py` untouched, no `provider ==` fork.
- All 4 D-05 sources resolve to `(bytes, mime)` via `_resolve_attach_source_bytes`: workspace (`get_file_by_path` + `_get_file_content`), sandbox_output (`copy_from_runtime` harvest, basename-matched), inline (UTF-8 `content` with empty/non-str/oversized weak-model guard), kb_document (REUSES Plan-01 `_fetch_owned_document_bytes`, error dict propagated — T-03).
- Owner-only WRITE gate (D-06/T-04): target skill resolved by name under `.eq("user_id")` (NEVER `.or_(is_global.eq.true)`); empty `.data` OR `is_system` → refuse. Proven in unit (not-owned + is_system → no upload, no upsert).
- T-02: storage path always owner-prefixed `{uid}/{skill_id}/{filename}` with the model filename sanitized to a safe basename — a `../../etc/passwd` filename lands scrubbed under `owner/skill/`.
- D-07 overwrite-in-place: Storage `.upload(file_options={"upsert":"true"})` + race-immune `.upsert(on_conflict="skill_id,filename")` on Plan-02's index; pre-check SELECT reports created vs updated. Reuses the existing `skill_files` table + `skill-files` bucket (D-08 — no new table/bucket).
- Three stale exact-count assertions finalized run-derived: `_TOOL_REGISTRY` **27→29**, `test_085` base **22→25**, all-on **24→28**.
- SC#10 static backstop: the flat schema (no anyOf/oneOf) survives Google + Anthropic translation with the tool present by name; both new Phase-151 file tools translate together.

## Final Tool Counts (run-derived)
- `_TOOL_REGISTRY` = **29** (28 after FILE-02 + attach_skill_file).
- `get_tools()` base (no web / no sandbox, self-improve default-ON) = **25** (includes save_skill + attach_skill_file; fetch_document_file + execute_code + web_search are gated out).
- `get_tools()` both conditionals on (web + sandbox, self-improve default-ON) = **28** (+ web_search + execute_code + fetch_document_file).
- Gate verified: attach present with self-improve ON (even sandbox OFF), ABSENT when self-improve OFF.

## Optional SSE
**ADDED** — `skill_file_attached` (fields: `skill`, `filename`, `status`). Additive, provider-uniform (no `provider ==` fork), best-effort no-op when `ctx.emit`/`run_id` are absent.

## Task Commits

1. **Task 1: Wave 0 — attach_skill_file handler tests (RED)** — `3abbb7ed` (test) — 12 failing tests (ImportError while unbuilt).
2. **Task 2: Implement schema, handler, resolver, dual-wiring (GREEN)** — `89bf027c` (feat) — 12/12 green.
3. **Task 3: Registration + cross-provider tests; finalize 3 exact-count asserts** — `505a0d35` (test) — 45/45 across the 4 targeted suites.

**Plan metadata:** this SUMMARY + STATE + ROADMAP — final docs commit.

## Files Created/Modified
- `backend/app/services/tool_dispatcher.py` — `_ATTACH_INLINE_MAX_BYTES` const + `_resolve_attach_source_bytes` (4-source resolver) + `_handle_attach_skill_file` handler + `_TOOL_REGISTRY` line + `_CAPABILITY_FLAG_TOOLS` entry + workspace_service imports (`_get_file_content`, `get_file_by_path`, `guess_mime_type`).
- `backend/app/services/openai_service.py` — `ATTACH_SKILL_FILE_TOOL` flat source-enum schema + self_improve-gated `get_tools()` append (next to `SAVE_SKILL_TOOL`).
- `backend/tests/unit/test_151_attach_handler.py` (new) — 12 tests: 4 sources, D-07 created/updated, T-04 owner-only + is_system refuse, T-02 owner-prefixed/traversal path, inline empty/oversized guards, kb_document resolver-error propagation.
- `backend/tests/unit/test_151_registration.py` — +5 FILE-01 dual-wiring + self_improve-gate + capability-flag assertions.
- `backend/tests/unit/test_151_cross_provider_schema.py` — +3 attach translation (Google + Anthropic + both-together) assertions.
- `backend/tests/unit/test_085_tool_registration.py` — base 22→25, all 24→28 (run-derived) + comments.
- `backend/tests/unit/test_tool_dispatcher.py` — `_TOOL_REGISTRY` 27→29 + EXPECTED_TOOLS extended (fetch_document_file, attach_skill_file).
- `.planning/phases/151-agent-file-tools/deferred-items.md` (new) — pre-existing unit-test rot log.

## Decisions Made
- **Inline source = UTF-8 text only** with a 5 MB `_ATTACH_INLINE_MAX_BYTES` weak-model guard (empty / non-str / oversized → honest error). Base64 was NOT wired: the flat schema keeps exactly the 4 optional fields the plan specified (no encoding-declaration field). Large/binary files are attached via the `workspace` or `sandbox_output` source. This satisfies must-have #1 (all four sources) without adding a schema field the plan did not list.
- **Created-vs-updated is an informational REPORT** from a pre-check SELECT; the DB write is the race-immune upsert, so correctness never depends on the report.
- **Filename sanitized to a safe basename** (traversal-proof) — the storage path is fully owner-controlled (T-02).

## Deviations from Plan

None — plan executed exactly as written. Optional discretion items resolved: inline kept UTF-8-only (documented above); the optional `skill_file_attached` SSE was ADDED.

## Issues Encountered

None during the planned FILE-01 work. One out-of-scope discovery documented below.

## Deferred Issues

**Pre-existing backend unit-test rot (out of scope, logged to `deferred-items.md`):** the FULL `pytest tests/unit` tier shows **63 failures** across ~18 UNRELATED service test files (test_retrieval_service 15, test_sql_service 12, test_explorer_agent 6, test_multimodal_query 5, test_111_1_reembed_kickoff 4, test_sandbox_service 3, test_lifespan 3, test_db_runs 3, and others). **Verified pre-existing:** restoring `tool_dispatcher.py` + `openai_service.py` to the pre-plan baseline `a0a86e8e` reproduced 30 of these with the ORIGINAL source. NOT fixed (executor scope boundary — none touch this plan's files). Re-open trigger: a Phase-151 verify-work test-hygiene sweep (SEED-056 / SEED-049 rot precedent).

## Known Stubs
None — `attach_skill_file` is fully wired end-to-end (4 sources → Storage upload + skill_files upsert). No placeholder/mock data paths.

## Threat Flags
None beyond the plan's `<threat_model>` (T-151-04-01..05). No new network endpoint, auth path, or schema change — the tool is a handler-only addition through the existing `dispatch_tool` gate; it reuses the existing `skill_files` table + `skill-files` bucket (D-08) and Plan-02's already-shipped unique index. The owner-only skill gate + owner-prefixed path + is_system reject are the plan's T-02/T-03/T-04 mitigations, all implemented and unit-proven.

## Next Phase Readiness
- **FILE-01 requirement stays `Pending`** (false-green avoidance, 148/149/150 convention) — closes at `/gsd:verify-work 151` + `/gsd:secure-phase 151` after the live SC#10 4-axis UAT (authored in `151-VALIDATION.md`) and the FILE-01 T-02/T-03/T-04 threat close.
- **Phase 152 (WFIN-01)** reuses this WRITE/upload + owner-scope threat pattern as its reference.
- **Cloud parity (standing checklist):** migration 101 (Plan 02) + migrations 099/100 (Phase 149/150) still PENDING on cloud Supabase before Phase 151 ships live — no cloud action taken here.

## Self-Check: PASSED

- Created files present on disk: `backend/tests/unit/test_151_attach_handler.py`, `.planning/phases/151-agent-file-tools/deferred-items.md`; modified source files present.
- All 3 task commits (`3abbb7ed`, `89bf027c`, `505a0d35`) in git history.
- `_handle_attach_skill_file`, `_resolve_attach_source_bytes`, `ATTACH_SKILL_FILE_TOOL` importable; flat schema anyOf/oneOf-free.
- 67/67 FILE-01/FILE-02 + count-assert unit tests green.

---
*Phase: 151-agent-file-tools*
*Completed: 2026-07-14*
