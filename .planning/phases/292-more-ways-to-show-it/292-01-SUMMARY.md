---
phase: 292-more-ways-to-show-it
plan: 01
subsystem: agent-artifacts (backend)
tags: [show_artifact, artifacts, diagram, comparison, timeline, migration-213, gemini, VIS-02]
requires:
  - "Phase 273 show_artifact registry (models/artifact.py, show_artifact_tool.py, migration 202)"
  - "citation_markers._deduplicate_citations (the manifest numbering the model sees)"
provides:
  - "Six-name closed component vocabulary (ComponentName, TabularComponent, NodeKind, Verdict) and caps"
  - "DiagramArgs / ComparisonArgs / TimelineArgs + StoredDiagramSpec / StoredComparisonSpec / StoredTimelineSpec"
  - "artifact_sources.resolve_sources / excerpt_for / parse_source_handle"
  - "ToolContext.turn_citations (by reference to agent_loop's retrieved_citations)"
  - "Migration 213 (component CHECK + label regex widened to six), applied locally"
  - "Shared fixtures artifact_bad_specs_292.json (35 bad / 11 good) and artifact_record_292.json"
affects:
  - "292-02 (frontend guard/renderers code against the stored contract and fixtures)"
  - "292-03 (cross-stack fence, SC#10 board, G-4 drive)"
  - "deploy: cloud must receive migration 213 before this backend deploys"
tech-stack:
  added: []
  patterns:
    - "Discriminated union arm per typed encoding, extra=forbid, worded _R refusals"
    - "Bool-first source-handle coercion before pydantic (lax int would turn True into 1)"
    - "Server-resolved provenance: model sends only the [n] manifest number"
key-files:
  created:
    - backend/app/services/artifact_sources.py
    - supabase/migrations/213_message_artifacts_more_components.sql
    - scripts/apply_migration_213.py
    - backend/tests/unit/fixtures/artifact_bad_specs_292.json
    - backend/tests/unit/fixtures/artifact_record_292.json
    - backend/tests/unit/test_292_artifact_models.py
    - backend/tests/unit/test_292_artifact_parity.py
    - backend/tests/unit/test_292_artifact_sources.py
    - backend/tests/unit/test_292_show_artifact_new_types.py
    - backend/tests/unit/test_292_artifact_history.py
    - backend/tests/unit/test_292_migration_213_shape.py
  modified:
    - docs/HOT-FILE-LEDGER.md
    - backend/app/models/artifact.py
    - backend/app/services/openai_service.py
    - backend/app/services/show_artifact_tool.py
    - backend/app/services/artifact_history.py
    - backend/app/services/tools/base.py
    - backend/app/services/agent_loop.py
    - backend/app/db/artifacts.py
    - supabase/full-schema.sql
    - backend/tests/unit/test_273_artifact_models.py
    - backend/tests/unit/test_273_tool_wiring.py
    - backend/tests/unit/test_273_migration_202_shape.py
    - backend/tests/unit/test_278_pure_move.py
    - backend/tests/unit/test_278_registry_pin.py
decisions:
  - "Source handle = the citation number n of this turn's manifest, resolved server-side against _deduplicate_citations(ctx.turn_citations); page always null; excerpt chosen by word overlap, max 280 UTF-16 units"
  - "Integral floats are accepted as source handles (Gemini sends JSON integers as floats); bools refused first"
  - "A new-type arm accepts from_artifact so the HANDLER words D-08 from the parent's type; a new-type call with neither data nor from_artifact is refused 'it has no {steps|terms|events} to show'"
  - "Empty fillers ([], {}, blank, 'null') on a new-type call's foreign keys are treated as absent; non-empty ones are refused 'a {noun} was sent another artifact type's fields'"
  - "Comparison cell excerpt text = term name + cell text (discretion: better overlap than cell text alone)"
  - "test_278_registry_pin schema digests re-captured deliberately (294-01 precedent), proven the only byte change is SHOW_ARTIFACT_TOOL"
metrics:
  duration: "~85 min"
  completed: 2026-10-24
  tasks: 3
  files: 25
---

# Phase 292 Plan 01: Backend six-component registry Summary

`show_artifact` now accepts `diagram`, `comparison` and `timeline`. Each is its own typed union arm with
caps and worded refusals, a per-element `source` that is just the `[n]` number the model saw this turn
(the server resolves it to `{document, page: null, excerpt}`), one stored spec model per type, history
placeholders, a widened schema and description (tool count still 30), and migration 213 applied locally
twice. One live Gemini request with the full new tool list was accepted and came back with a valid
`show_artifact` diagram call.

## What was built

| Task | What | Commits |
|---|---|---|
| STEP 0 | Ledger rows + sections for the 8 files phase 292 creates (`artifact_sources.py` + 7 frontend files) | `09395beec` |
| 1 | Six-name vocabulary, three arms, three stored specs, shared fixtures, widened `SHOW_ARTIFACT_TOOL` | `730a8bbc1` (RED) → `3d0d26fdb` (GREEN) |
| 2 | `artifact_sources.py`, `ToolContext.turn_citations`, the handler's new-type branch, D-08 refusals, history redaction | `10a32afe7` (RED) → `5309b65f0` (GREEN) |
| 3 | Migration 213 + apply script + full-schema regen, 278 digest re-capture, baseline, Gemini probe | `e9593cb3d` (RED) → `02b8e25f7` → `51a8f7b6c` |

## Measured results

- **Fixture counts:** `artifact_bad_specs_292.json` = **35 bad, 11 good** (`python -c` over the file).
- **Description length:** **2,526 chars** (cap 3,000), chart example still FIRST and it validates.
- **Tool count:** `len(_TOOL_REGISTRY) == 30`; the unedited closed-core suites (`test_259_closed_core_inventory`,
  `test_261_closed_core_inventory`, `test_267_tool_floor_union`, `test_085_tool_registration`,
  `test_255_extension_contract_guard`) pass. `SYSTEM_PROMPT` byte-identical (`test_273_tool_wiring`).
- **agent_loop.py:** `git diff --numstat ba8e38c05 -- backend/app/services/agent_loop.py` = `2 0`.
- **citation_markers.py / google_service.py:** untouched (empty diff).

### Migration 213 VERIFY (local, :54322)

Before apply (`--verify-only`, proves the VERIFY can fail):

```
  PASS         exactly one CHECK mentions component
  *** FAIL *** the component CHECK names all six
  PASS         exactly one CHECK mentions label
  *** FAIL *** the label CHECK names all six
  ...
VERIFY: 6/8 PASS
```

`--dry-run` (inside one transaction, rolled back): `VERIFY: 8/8 PASS`, row counts unchanged
(`message_artifacts 22, messages 3485`).

`--apply` (first and second apply, VERIFY identical):

```
AFTER FIRST APPLY
  PASS         exactly one CHECK mentions component
  PASS         the component CHECK names all six
  PASS         exactly one CHECK mentions label
  PASS         the label CHECK names all six
  PASS         row_count cap unchanged (1..500)
  PASS         spec size cap unchanged (262144)
  PASS         RLS still enabled
  PASS         still exactly one policy (SELECT)
VERIFY: 8/8 PASS
LIVE CHECKS (component / label):
  message_artifacts_component_check: CHECK ((component = ANY (ARRAY['chart'::text, 'table'::text, 'metric'::text, 'diagram'::text, 'comparison'::text, 'timeline'::text])))
  message_artifacts_label_check: CHECK ((label ~ '^(chart|table|metric|diagram|comparison|timeline) [1-9][0-9]*$'::text))
AFTER SECOND APPLY (idempotency check)
  ... VERIFY: 8/8 PASS
APPLIED (local) -- VERIFY identical across two applies; no row count moved.
```

`supabase/full-schema.sql` regenerated with `bash scripts/regenerate-full-schema.sh` (no `--reset`):
`7 insertions, 7 deletions` — exactly the two CHECK definitions and the five COMMENT lines.

### Backend unit gate

`node scripts/check-backend-unit-baseline.cjs` at HEAD (after all three tasks, under the local-DB lock):

```
70 failed, 9170 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 506.44s (0:08:26)
Failed tests:   70 (allowed ceiling: <= 71)
Errors:         0 (allowed: 0)
[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
```

- Base (`ba8e38c05`, measured today in this worktree with the plan's sources and tests restored):
  `70 failed, 8996 passed, 1 skipped, 2 xfailed, 2 xpassed`.
- HEAD before the 278 digest re-capture: `78 failed, 9162 passed` — the 8 extra were exactly
  `test_278_registry_pin.py::test_schema_text_is_byte_identical[*]` (see Deviations).
- **Failed SET at HEAD == failed SET at base** (70 ids, diffed with `comm`). The two
  `test_cross_worker_cancellation.py` ids that pass in isolation fail in BOTH full runs (inherited,
  order-dependent), so they are not new.

### Gemini live request (RESEARCH Pitfall 4)

Run from the session scratchpad through the project's own `google_service.stream_google` (which builds
the client with `_google_client` and converts the tools with `_convert_tools_to_google`), key from
`settings.google_api_key` (backend/.env), the FULL `get_tools()` list (29 tools, web + sandbox on),
prompt "Draw a two-step flow diagram: Request, then Approve.", model **`gemini-3.5-flash`** (newest
registry-backed Google id):

```
tools sent: 29 | show_artifact present: True
converted function declarations: 29
OUTCOME: ACCEPTED (no schema error)
event types seen: ['finish:tool_calls', 'tool_preparing', 'usage']
tool event: tool_start | name: show_artifact
  args: {"diagram": {"edges": [{"from": "1", "to": "2"}], "nodes": [{"id": "1", "label": "Request", "kind": "start"}, {"label": "Approve", "kind": "end", "id": "2"}]}, "component": "diagram", "title": "Two-Step Approval Flow"}
```

Those exact args validate as `DiagramArgs`. **No flattening fallback was needed**: the nested
`comparison.terms[].cells[]` shape stands, and plan 03's fixture lift needs no `verdicts/texts/sources`
re-assembly.

### Security advisor (D-12)

**D-12's local `get_advisors(security)` clause is replaced by the deploy-time check.** The Supabase MCP
reaches PRODUCTION only (CLAUDE.md), where 213 is not yet applied, and 213 adds no table, function,
grant or policy, so the advisor delta is nil by construction. **`get_advisors(security)` is owed at the
deploy step, after 213 is pasted into cloud.** No MCP write was run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_278_registry_pin` schema digests had to be re-captured**
- **Found during:** Task 3 (backend baseline)
- **Issue:** the plan's "must change" list missed `test_278_registry_pin.py`, which pins the sha256 of
  every `get_tools()` combination. Widening `SHOW_ARTIFACT_TOOL` (the plan's own D-09 change) moves all
  8 digests, so the baseline read 78 failed (8 above base).
- **Fix:** the 294-01 precedent — restored the base `SHOW_ARTIFACT_TOOL` in memory (extracted from
  `git show ba8e38c05:backend/app/services/openai_service.py`) and proved all 8 combos hash to the pinned
  digests (`RESTORED_EQUALS_PINNED=True`), then re-captured the 8 digests with the old ones kept in a
  comment. `RENDER_TEMPLATE_TOOL` unchanged.
- **Files modified:** `backend/tests/unit/test_278_registry_pin.py`
- **Commit:** `02b8e25f7`

**2. [Rule 3 - Blocking] full-schema regeneration needed the main checkout's Supabase workdir**
- **Found during:** Task 3 step 4
- **Issue:** `supabase/config.toml` is untracked, so the worktree has none and `supabase status`
  looked for a container named after the worktree (`supabase_db_agent-af54…`) and the regen script
  stopped with "Supabase is not running locally".
- **Fix:** ran the worktree's own script with `SUPABASE_WORKDIR="C:/Vibe Apps/Agentic RAG"` so the CLI
  read the real project config (read-only `status`); the script still dumped via its own
  `docker exec … pg_dump` and wrote the WORKTREE's `supabase/full-schema.sql`. No reset, no hand edit.
- **Files modified:** `supabase/full-schema.sql`

**3. [Rule 1 - Bug] `_req_text` / `_opt_text` keyword collision** (caught by the first GREEN run): the
cap parameter was named `cap`, which collided with the `cap=` format kwarg of `event_text_too_long`.
Renamed to `limit` before the GREEN commit.

### Notes against the plan text

- **Acceptance grep on `full-schema.sql`.** `grep -c "'diagram', 'comparison', 'timeline'" supabase/full-schema.sql`
  returns 0 by construction: `pg_dump` renders the CHECK as `ARRAY['chart'::text, …, 'diagram'::text,
  'comparison'::text, 'timeline'::text]`. The equivalent assertion is
  `test_292_migration_213_shape.py::test_full_schema_carries_the_six_name_checks`, which parses that form
  and passes. The migration file itself carries the literal (grep = 1).
- **`test_273_migration_202_shape.py`** went red at the Task 1 GREEN commit (`3d0d26fdb`) and was fixed
  in Task 3 exactly as the plan assigns (`e9593cb3d`): 202's CHECK is now compared with its frozen
  historical three, and the live-equality assertion lives in the 213 shape test.
- **RESULT_KEY_ORDER** is not pinned as a literal by any 273 test (grep), so no 273 test changed for it.
- **The invoice fixture** is my own 8-node / 9-edge invoice flow (back edge `chase → ok`, labelled
  self-loop `chase → chase`): the sketch's diagram is a vendor-onboarding flow with no self-loop.

## Known Stubs

None. Every field stored is validated and resolved; `page` is always null by design (document chunks
carry no page column), recorded in the stored-spec docstrings and the contract.

## Threat Flags

None beyond the plan's register: no new endpoint, auth path or grant. `ToolContext.turn_citations` is
read-only to the handler and holds the same citation dicts the manifest already exposes to the model.

## TDD Gate Compliance

`test(292-01)` precedes `feat(292-01)` for every task: `730a8bbc1` → `3d0d26fdb`; `10a32afe7` →
`5309b65f0`; `e9593cb3d` → `51a8f7b6c`.

## Self-Check: PASSED

- All 11 created files exist (checked with `[ -f ]`).
- All 8 plan commits exist on this branch (`git log --oneline ba8e38c05..HEAD`): `09395beec`,
  `730a8bbc1`, `3d0d26fdb`, `10a32afe7`, `5309b65f0`, `e9593cb3d`, `02b8e25f7`, `51a8f7b6c`.
- No tracked file was deleted (`git diff --diff-filter=D ba8e38c05 HEAD` is empty).
- The local-DB lock file was removed after the migration apply and the gate run.
- STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
