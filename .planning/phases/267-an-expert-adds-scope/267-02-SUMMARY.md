---
phase: 267-an-expert-adds-scope
plan: 02
subsystem: backend — thread surfaces that state or change an Expert
tags: [experts, threads, binding-gate, transcript-event, scope-preview, handoff, forced-emit, tdd]
requires:
  - "267-01 compose_expert_scope / ExpertScope, TRANSCRIPT_EVENT_KINDS, connection_states, _reconstruct_history skip"
provides:
  - "backend/app/api/threads.py — assert_expert_bindable (one gate, three callers), _visible_transcript_rows, GET /threads/expert-scope-preview, POST /threads/{id}/handoff, the rename_thread event writer"
  - "backend/app/services/expert_scope.py — ScopeStatement, describe_expert_scope (async, one RLS documents query per counted set), build_expert_changed_event, event_sentence, scope_preview"
  - "backend/app/services/thread_handoff.py — HandoffSummary, HandoffSummaryFailed, HANDOFF_INPUT_CHAR_CAP, summarise_thread_for_handoff, write_handoff, handoff_title, handoff_content"
  - "backend/app/models/message.py — TranscriptExpertRef, TranscriptFolderRef, TranscriptScopeLine, TranscriptExclusion, ExpertChangedEvent, ExpertHandoffEvent, HandoffMarker"
  - "backend/app/models/thread.py — ThreadHandoffRequest, ExpertScopePreview (+ ScopePreviewFolder, ScopePreviewThreadFolder)"
  - "backend/tests/fixtures/phase267/{expert_changed,scope_preview,expert_handoff,handoff_marker}.json — the wire contracts 267-04 renders"
affects: [267-04, 267-05]
tech-stack:
  added: []
  patterns:
    - "One statement object feeds both the pre-invite preview and the persisted event (never two derivations)"
    - "Compute before the transaction; write the state change and its record in ONE user-JWT asyncpg txn with explicit org_id"
    - "LLM summary as a service passing an emitter NAME to forced_emit — closed core untouched"
key-files:
  created:
    - backend/app/services/thread_handoff.py
    - backend/tests/unit/test_267_binding_gate.py
    - backend/tests/unit/test_267_scope_preview.py
    - backend/tests/unit/test_267_expert_changed_event.py
    - backend/tests/unit/test_267_handoff.py
    - backend/tests/fixtures/phase267/expert_changed.json
    - backend/tests/fixtures/phase267/scope_preview.json
    - backend/tests/fixtures/phase267/expert_handoff.json
    - backend/tests/fixtures/phase267/handoff_marker.json
  modified:
    - backend/app/api/threads.py
    - backend/app/services/expert_scope.py
    - backend/app/models/message.py
    - backend/app/models/thread.py
    - backend/tests/unit/test_260_expert_chat_scoping.py
    - backend/tests/unit/test_256_judge_usage_counted.py
decisions:
  - "Preview route lives at GET /threads/expert-scope-preview?expert_id=&thread_id= (thread optional), declared above GET /threads/{thread_id}"
  - "The thread's own doc count and the excluded set reuse ONE documents response when the two folder sets are equal (the common restricted case)"
  - "The thread's own scope is computed through compose_expert_scope itself (biased, no Expert folders) — the subtree logic is not re-spelled"
  - "Dropped = what the previous side read that the next side's composition does not cover (a folder inside the new thread subtree is not 'dropped')"
  - "An unresolvable BEFORE Expert is named from its bundle row and stated as reading nothing; if it no longer exists at all, the change proceeds and no event is written (logged) — never an invented name"
  - "Handoff folder name comes from the user-JWT folders read; the source's staying Expert is named via get_expert_service (org-scoped, no grant check)"
  - "thread_handoff.py registered NO-RUN in the test_256 forced_emit call-site fence (tokens unattributed, routed to Phase 268 METER-08)"
metrics:
  duration: "~1h 40m"
  completed: 2026-09-25
  tasks: 3
  commits: 6
---

# Phase 267 Plan 02: Backend Thread Surfaces Summary

Every server door that binds an Expert now goes through one fail-closed gate; a swap, join or removal on a thread with messages writes one org-correct `expert_changed` event in the same transaction as the update; the snapshot and messages reads let only allowlisted transcript kinds through; a restricted Expert's cost is computable before the invite from the same statement the event uses; and "New chat with <Expert>" is one request that summarises through `forced_emit` and then creates the thread, its handoff marker row and the source pointer atomically — or nothing.

## Commits

| # | Hash | Type | What |
|---|------|------|------|
| 1 RED | `313317ec0` | test | the binding gate (12 cases) |
| 1 GREEN | `fbf64b7ba` | feat | `assert_expert_bindable`; PATCH + POST gated; test_260 fail-open case retired |
| 2 RED | `e2ed048b1` | test | statement, preview route, event builder, event writer, transcript allowlist |
| 2 GREEN | `48da70716` | feat | expert_scope statement + builders, 7 payload models, preview route, writer, allowlist, 2 fixtures |
| 3 RED | `065bda816` | test | handoff service + route (24 cases) |
| 3 GREEN | `08d27eb51` | feat | `thread_handoff.py`, handoff route, 2 fixtures, test_256 disposition |

## TDD gate compliance

Every task has its `test(...)` commit before its `feat(...)` commit. RED runs, quoted:

- **Task 1:** `12 failed` — `ImportError: cannot import name 'assert_expert_bindable' from 'app.api.threads'` (×5), `AttributeError: <module 'app.api.threads'> does not have the attribute 'assert_expert_bindable'` (×6), and on base code the no-org PATCH case failed with `AssertionError: a refused PATCH must write nothing` — the fail-open skip reached the update.
- **R265-audit-fixes-03 plant (D-267-24), driven after GREEN and reverted:** `caller_roles` replaced by `[current_user.get("role")] if current_user.get("role") else []` →
  `FAILED tests/unit/test_267_binding_gate.py::test_R265_audit_fixes_03_the_role_is_resolved_never_read_off_current_user` with `AssertionError: assert [] == ['org-admin']` (`1 failed, 30 passed` across the four suites — the other three suites stayed green under the plant, exactly as the review found). Reverted; 31 passed.
- **Task 2:** `30 failed` — `cannot import name 'build_expert_changed_event'` (×8), `'scope_preview'` (×7), no attribute `resolve_expert_bundle` on expert_scope (×7), `cannot import name 'ExpertScopePreview' from 'app.models.thread'`, `cannot import name '_visible_transcript_rows'`, and two `AssertionError`s from the read-path cases (`assert [('user', Non...sponse'), ...] == [...]`). Those two ran against a fake that answers whatever the query asks for, so on base the SQL-side `.neq("role","system")` was the only filter and every system kind came back through Python — the test proves the allowlist is applied in code, not assumed from SQL.
- **Task 3:** `21 failed, 3 passed` — `ModuleNotFoundError: No module named 'app.services.thread_handoff'` (×15), `module 'app.services' has no attribute 'thread_handoff'` (×4), missing fixture, missing file. The 3 that passed on base are guard tests that are true by construction before and after (marker row reaches history as user content — 267-01's skip; the emitter name is registered nowhere; `expert_service.py` stays pure).

## Consciously retired / re-driven test expectations

| File | Old expectation | New expectation | Why |
|---|---|---|---|
| `test_260_expert_chat_scoping.py::test_patch_thread_updates_and_clears_active_expert` (block 1) | a PATCH with **no validated org** SUCCEEDS and sets the Expert (the fail-open skip) | **RETIRED under D-267-31**: it answers 403 `Choose an organization before inviting an Expert.` and writes nothing; a new block 1b proves the success path through the gate with a validated org | the gate is now fail-closed with a reason |
| same test, blocks 1b + 2 | `aexec` sequence `[update, select]` | `[before-read, message count (0), update, select]` | rename_thread reads the thread BEFORE the update to know whether the Expert changed; an empty thread writes no event, so the plain update still runs |
| `test_261_expert_authoring_scenarios.py` rename_thread scenario | — | **no change needed.** Its single `AsyncMock` returns a row whose `active_expert_id` equals the requested one, so the value is unchanged and no event path runs; the 404 arm refuses before any read | the plan listed it for a re-drive; measured unnecessary |
| `test_256_judge_usage_counted.py` `_EXPECTED_FORCED_EMIT_SITES` | 10 files | + `services/thread_handoff.py: NO-RUN` | the fence found the new `forced_emit` site at the full-suite run (Rule 3, see Deviations) |

## Wire contracts for 267-04 (frozen, executable copies in `backend/tests/fixtures/phase267/`)

- `expert_changed.json` — the swap Financial Analyzer (biased, Financial Reports & Filings, thread /Client ACME with 4 docs, Slack) → HR Advisor (restricted, HR Policies): `now.folders=[HR Policies]`, `dropped.folders=[Financial Reports & Filings]`, `dropped.thread_folder={Client ACME, doc_count 4}`, `dropped.connections=["Slack"]`, `excluded={count 4, names[4]}`.
- `scope_preview.json` — HR Advisor restricted on /Client ACME: `excluded_count 4` + 4 names from one response.
- `expert_handoff.json` / `handoff_marker.json` — source "Q3 board prep", Contract Reviewer, 3 items, folder "Client ACME".
Each is asserted against the real builder's `model_dump(mode="json")`; the handoff route test also asserts the rows it writes carry exactly the fixtures' key sets.

## Gates

- **Backend unit gate** (`node scripts/check-backend-unit-baseline.cjs`, once at plan end, on `08d27eb51`): `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)`, passed 5822.
  - **Set diff against 267-BASELINES.md:** `comm -13 base head` and `comm -23 base head` each show only `test_retrieval_service.py::TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results` — the same id with a `RuntimeWarning: coroutine 'handle_query_tables' was never awaited` concatenated onto it in the raw output (the artefact 267-01 also recorded). **The failed SET equals the base SET.**
  - The first full run (before the test_256 registration) read `72 failed`; the one new name was `test_256_judge_usage_counted.py::test_every_forced_emit_call_site_carries_a_disposition` (`appeared (needs a disposition): ['services/thread_handoff.py']`). Fixed in the Task 3 commit; see Deviations.
- **Closed core:** `EMITTER_REGISTRY` 1, `_TOOL_REGISTRY` 29 — asserted in `test_267_handoff.py`; `test_259_closed_core_inventory.py` + `test_255_extension_contract_guard.py` green. `grep emit_handoff_summary` in `emitters.py` / `tool_dispatcher.py`: nothing. `grep "forced_emit\|thread_handoff" expert_service.py`: nothing.
- **G-5:** `node scripts/check-hot-file-ledger.cjs 267` → `ledger gate OK — every watched file has a row` (33 watched).
- **Acceptance greps:** `async def assert_expert_bindable` ×1, `assert_expert_bindable(` ×5 (def + PATCH + POST + preview + handoff); no `current_user.get("role")` / `current_user["role"]`; `check_entitlement` on 1 line; `neq("role", "system")` gone; `_visible_transcript_rows(` ×3; the `INSERT INTO public.messages` line in threads.py names `org_id`; `@router.get("/expert-scope-preview"` at :779 < `@router.get("/{thread_id}"` at :820; expert_scope imports no openai/anthropic/agent_loop; no new `detail=f"` / `detail=str(`.
- **CLAUDE.md / STATE.md / ROADMAP.md / docs/HOT-FILE-LEDGER.md:** untouched.

## Re-derived `commits / phases / lines` (at `08d27eb51`, CLAUDE.md recipe, 6-digit buckets excluded) — for 267-05's ledger rows

| File | Triple | Note |
|---|---|---|
| `backend/app/api/threads.py` | **255 / 87 / 2156** | FIRES. Row stale (`245 / 82 / 1679`; research measured `252 / 86 / 1794`). Honoured by construction (D-267-23): 1 gate helper (+1 roles helper), 1 filter helper (2 callers replacing 2 `.neq`), 2 routes, 1 guarded write arm + 3 private helpers beside it. The send path and every other route untouched. |
| `backend/app/models/thread.py` | 20 / 13 / 510 | FIRES. +4 additive models. |
| `backend/app/models/message.py` | 20 / 12 / 236 | FIRES. +7 additive payload models, `Field` import. |
| `backend/app/services/expert_scope.py` | 2 / 1 / 420 | young. The pure function unchanged; the statement + 3 pure builders appended. |
| `backend/app/services/thread_handoff.py` | 1 / 1 / 250 | young (created; its ledger row was written at creation by 267-01). |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The `forced_emit` call-site fence went red on the new service**
- **Found during:** the Task 3 full-suite run.
- **Issue:** `test_256_judge_usage_counted.py::test_every_forced_emit_call_site_carries_a_disposition` re-derives every `await forced_emit(` file and fails on an unregistered one. The plan named `test_259` as the registry a new service must not disturb and did not mention this second one (the same way 263's site was found).
- **Fix:** registered `services/thread_handoff.py: "NO-RUN"` with the reason (a service called from a route, before any `runs`/`workflow_runs` row; tokens routed to METER-08). The companion test driving `run_usage_box` absence for NO-RUN hosts passes over the new file.
- **Commit:** `08d27eb51`.

**2. [Scope note] `test_261_expert_authoring_scenarios.py` was not edited**
- The plan asked for its rename_thread mock sequence to be updated. Measured: it passes unchanged under both Task 1 and Task 2 (its one mock row already holds the requested Expert, so the value is unchanged and no event path runs). No edit was made rather than an edit with no effect.

**3. [Design choice within discretion] Unresolvable BEFORE Expert**
- `describe_expert_scope(..., allow_unresolved=True)` names a previous Expert the caller can no longer resolve from its bundle row and states it as reading nothing. If the bundle no longer exists at all, rename_thread still makes the change (clearing is never gated) and writes **no** event, logging a warning — rather than inventing a name. An after-side that does not resolve answers the unchanged 404.

**4. [Refinement] "Dropped" uses coverage, not list difference**
- A folder the previous side read is "dropped" only when the next side's composition does not cover it (e.g. an Expert folder inside the new thread subtree is still read). This keeps `Dropped` literally true; the plan's listed cases all hold.

## Known Stubs

None. Every payload field is computed from the statement; no placeholder text.

## Threat model

- T-267-10/11: `assert_expert_bindable` before every bind; POST refused ⇒ insert not awaited; no-org ⇒ 403 with a reason (tested).
- T-267-12: `resolve_caller_role` only; plant-driven RED quoted above.
- T-267-13: preview and handoff both select the thread by id + user_id under the user JWT first and 404 before any other read (tested for both).
- T-267-14: names and counts come from the user-JWT documents query (RLS = retrieval's visibility), ≤ 5 names.
- T-267-15: every row this plan writes sets `org_id` from the source/thread row explicitly; tests use a thread org that differs from the caller's active org.
- T-267-16: `handoff` is not an allowlisted transcript kind; the marker reaches `_reconstruct_history` as plain user content (tested).
- T-267-18: summarise first, then one transaction; a third-INSERT failure rolls everything back (tested via the CM's commit flag).
- T-267-19: `HANDOFF_INPUT_CHAR_CAP = 20000` from the end; zero-message threads refused before the call.
- T-267-20: 409/500/502 details are literals; exceptions logged with `exc_info` only.
- T-267-21: registry counts 1 / 29 re-asserted; the emitter name is registered nowhere.

No surface outside the plan's threat register was added.

## Notes for later plans

- **267-04:** render from the four fixtures. The event row's `content` is a plain sentence (`Financial Analyzer → HR Advisor. Now: HR Policies. Dropped: Financial Reports & Filings, /Client ACME (4), Slack.`); the card must render from `tool_calls[0]`, not from `content`. The handoff user row's `content` is `Handed off from “<title>”` + `- item` lines.
- **267-05:** the D-267-20 DB check must use `_count_kb_documents`'s predicate (`is_latest = true`, `source_state` null or not `source_disconnected`, any ingest status). Knowledge-health gap analysis will count the handoff user row as a user query (research note; minor).
- **Owed to live UAT (not run here — unit tests are mocked):** the asyncpg writes (`UPDATE` + `INSERT … $5::jsonb` with the pool's jsonb codec, and the three handoff INSERTs) have not been executed against a real Postgres in this plan. They are exercised by G-4 #2 / #3 in 267-05.
- `graphify update .` was not run in this worktree (it would rewrite tracked `graphify-out/` files inside a parallel executor's branch); run it after the merge.

## Self-Check: PASSED

- Created files exist: `thread_handoff.py`, the 4 `test_267_*.py` files, the 4 fixtures.
- Commits `313317ec0`, `fbf64b7ba`, `e2ed048b1`, `48da70716`, `065bda816`, `08d27eb51` present in `git log`.
- STATE.md, ROADMAP.md, CLAUDE.md and docs/HOT-FILE-LEDGER.md untouched by this plan.
