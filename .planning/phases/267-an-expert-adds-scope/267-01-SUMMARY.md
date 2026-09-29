---
phase: 267-an-expert-adds-scope
plan: 01
subsystem: backend — Expert run seam, transcript kinds, connection state
tags: [experts, run-producer, agent-loop, tool-floor, connectors, skills, overlay, tdd]
requires:
  - "266 per-org Expert install (overlay_install_state, ExpertScopeUnavailable)"
  - "264 born-for carrier (RunContext.born_for_bundle_id)"
provides:
  - "backend/app/services/expert_scope.py — ExpertScope + compose_expert_scope (pure)"
  - "backend/app/models/message.py — TRANSCRIPT_EVENT_KINDS; MessageResponse.role admits 'system'"
  - "backend/app/services/run_producer.py — ThreadScoping NamedTuple"
  - "RunContext.scoped_connection_keys / RunContext.skill_catalog_additions (effective_tools REMOVED)"
  - "backend/app/services/expert_service.py — ConnectionState + connection_states()"
  - "backend/app/dependencies.py — feature_visible()"
  - "GET /experts (both arms) and GET /experts/{id} — connection_state + can_connect keys"
  - "backend/tests/fixtures/phase267/expert_overlay_row.json — the overlay wire contract"
  - ".planning/phases/267-an-expert-adds-scope/267-BASELINES.md — frozen base gates"
affects: [267-02, 267-03, 267-04, 267-05]
tech-stack:
  added: []
  patterns:
    - "Default-off additive RunContext fields (None => byte-identical), neutral names under the agent_loop AST fence"
    - "One-home rule functions read by BOTH the run and the user-facing statement"
    - "Server overlay as NEW keys on a copied row; permission asked only when needed"
key-files:
  created:
    - backend/app/services/expert_scope.py
    - backend/tests/unit/test_267_expert_scope.py
    - backend/tests/unit/test_267_transcript_kinds.py
    - backend/tests/unit/test_267_tool_floor_union.py
    - backend/tests/unit/test_267_connection_overlay.py
    - backend/tests/fixtures/phase267/expert_overlay_row.json
    - .planning/phases/267-an-expert-adds-scope/267-BASELINES.md
  modified:
    - backend/app/services/run_producer.py
    - backend/app/services/agent_loop.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/models/message.py
    - backend/app/services/expert_service.py
    - backend/app/api/experts.py
    - backend/app/dependencies.py
    - backend/app/models/expert.py
    - backend/app/services/expert_authoring.py
    - docs/HOT-FILE-LEDGER.md
    - "13 existing test files re-driven (listed below)"
decisions:
  - "D-267-01 planner choice taken: EXPERT_CORE_TOOLS / EXPERT_DELIVERABLE_TOOLS DELETED (not kept as docs), and RunContext.effective_tools deleted with its schema filter"
  - "Expert skills that match a DB row are pulled OUT of the relevance-trim set and appended (not merely pinned) — _cap_pins can drop an over-cap pin, so pinning would not guarantee 'never trimmed'"
  - "connection_states names a slug from a CONNECTED matching row first, else any matching row, else the slug"
  - "The union fence drives run_agent_loop's real setup block and reads its locals at the _reconstruct_history call (frame inspection), because no smaller real entry runs the connector block"
metrics:
  duration: "~2h 5m"
  completed: 2026-09-25
  tasks: 3
  commits: 7
---

# Phase 267 Plan 01: An Expert Adds Scope — Backend Runtime Core Summary

An Expert thread now keeps every tool a plain thread has, and adds its own resolver-approved connections (admitted by `service_id` or `capability`) and its member skills (never trimmed) as neutrally named run data. Scope composition has one pure home, `compose_expert_scope`. Transcript-only system kinds have one home and never reach a model. The one "is it connected" rule, `connection_states`, feeds both the resolver and a new `connection_state` / `can_connect` overlay on every Expert read.

## Commits

| # | Hash | Type | What |
|---|------|------|------|
| 0 | `d15822ac8` | docs | 267-BASELINES.md: base gates frozen as sets, before any source edit |
| 1 RED | `568c7cfbd` | test | compose_expert_scope + transcript kinds |
| 1 GREEN | `ad4f6b602` | feat | expert_scope.py, TRANSCRIPT_EVENT_KINDS, history skip, role widen, ledger rows |
| 2 RED | `6dfd7cc94` | test | union fence, skill union, admission, AST fences |
| 2 GREEN | `509f6a0a2` | feat | tool floor deleted; ThreadScoping; admission + skill union; 11 suites re-driven |
| 3 RED | `209b8d504` | test | connection_states, resolver characterization, overlay, feature_visible |
| 3 GREEN | `bc8802bd5` | feat | connection_states, feature_visible, overlay, doc text, wire fixture |

## TDD gate compliance

Every task has a `test(...)` commit before its `feat(...)` commit. RED runs, quoted:

- **Task 1 (on base code):** `ERROR tests/unit/test_267_expert_scope.py` with `ModuleNotFoundError: No module named 'app.services.expert_scope'`, and `ERROR tests/unit/test_267_transcript_kinds.py` with `ImportError: cannot import name 'TRANSCRIPT_EVENT_KINDS' from 'app.models.message'`. 2 errors during collection.
- **Task 2 (on the base tool floor):** `18 failed, 4 passed`. The union fence fired for the real reason. It did not fail on a harness error:
  `AssertionError: an Expert thread lost tools: ['attach_skill_file', 'fetch_document_file', 'get_related_documents', 'hubspot__search', 'query_documents_by_view', 'query_tables', 'recall', 'remember', 'save_skill', 'task', 'web_search', 'workspace_delete', 'workspace_diff', 'workspace_list', 'workspace_read', 'write_todos']`.
  - The list is 15 built-in tools plus `hubspot__search`. That entry is the composer-armed connector tool that the bare-slug filter dropped (D-267-03), so it was measured, not inferred.
  - The 4 that passed on base are the ones meant to: no-keys-no-chips-means-none, plain catalog unchanged, the `task_service.py` AST case, and the inventory.
  - The fence works on both the old and the new tuple shape (`_ctx_kwargs`), so it can be re-driven red at any time by restoring the old producer.
- **Task 3 (on base code):** `23 failed` (no `connection_states`, no overlay keys, no `feature_visible`, old description text). The resolver characterization literals were captured by running the base resolver in a scratch script first. The output is below.

## Rewritten test assertions (old meaning → new meaning)

| File | Old assertion | New assertion | Intent |
|---|---|---|---|
| `test_259_closed_core_inventory.py` | `len(EXPERT_CORE_TOOLS) == 10`, subset of `_TOOL_REGISTRY` | the constants are absent; `_TOOL_REGISTRY` is 29 | kept + strengthened: the second encoding cannot drift because it no longer exists |
| `test_261_closed_core_inventory.py` | module import of `EXPERT_CORE_TOOLS`; len 10 + subset | both constants absent; no module-level name in `tool_dispatcher` containing both "expert" and "tool" | same |
| `test_261_expert_runtime_scoping.py` | tool floor True keeps the deliverables and False REMOVES them; `hubspot` in the tool list | both flag values give the loop IDENTICAL data with no tool slot; `hubspot` is an additive `scoped_connection_keys` entry | strengthened: an Expert never loses a tool, and the flag can no longer remove one |
| `test_261_expert_runtime_scoping.py` (×2) | 5-tuple unpack | attribute access on `ThreadScoping` | unchanged |
| `test_261_expert_authoring_scenarios.py` S6 | deliverables and core ⊆ `eff_tools` | no tool slot on the scoping result or on `RunContext` (the union fence proves the tools reach the loop) | strengthened |
| `test_261_expert_authoring_scenarios.py` S4/S5 | 5-tuple unpack | attribute access | unchanged |
| `test_260_expert_chat_scoping.py` no-expert | `folders/tools/skills/path is None` | `== ThreadScoping(None×5)`, each field None | unchanged |
| `test_260_expert_chat_scoping.py` with-expert | `"search_documents"`, `"load_skill"`, `"github__read" in tools`; skills as the override | no `effective_tools`; `scoped_connection_keys == ("github__read",)`; `skill_catalog_additions` == the same dict | kept: the same data, carried as additions |
| `test_260_expert_chat_scoping.py` RunContext | `effective_tools=(…)` round-trips | the two new fields round-trip; `effective_tools` absent | same |
| `test_260_financial_analyzer_conversation.py` F-3 | `EXPERT_CORE_TOOLS ⊆ tools`, `"slack_notify" in tools`, no phantom tool | no tool list; `scoped_connection_keys == ("slack_notify",)`; the phantom tool is in no field; skills are additions | strengthened |
| `test_260_financial_analyzer_conversation.py` multi-turn *(not in plan's list, found by the run)* | `RunContext(effective_tools=…)`; shell tools not in it | folder scope + additions carried; no `effective_tools`; shell tools not in the real `get_tools()` set | kept, measured against the tools actually offered |
| `test_264_born_for_carrier.py` | `result == (None,)*5` | also `result.born_for_bundle_id is None` | unchanged |
| `test_264_load_skill_born_for.py` | window tokens `EXPERT_CORE_TOOLS`, `not advertised`, `lint` | tokens `IS advertised`, `reasons 2 and 3`, `lint` | the corrected comment is pinned: reason #1 became false and the decision stands on 2 and 3 |
| `test_266_restricted_empty_scope_refuses.py` (×2) | `folders, *_ =` | `.effective_folder_ids` | unchanged |
| `test_261_role_grants_reach_the_check.py` | — | **no change needed.** It never unpacks: the resolver returns None and the test expects the raise | — |

Additional re-drives outside the plan's file list (Rule 3). Each was broken by this plan's change:

| File | Old | New |
|---|---|---|
| `test_chat_connector_scoping.py` | compiles the `allowed_ids` / `active_conns` lines out of `agent_loop.py` and runs them | also compiles the new `scoped_keys` line with a `ctx` carrying `scoped_connection_keys`. 4 new cases: admission by service_id/capability, disabled is refused, no keys and no ids still means none, keys ∪ ids |
| `test_259_expert_member_isolation.py` (×2 fixtures) | mocked connection rows had only `service_id` / `capability`, because the base SQL filtered is_enabled/status itself | rows carry `is_enabled` / `status` / `name`, the shape the one rule reads. Admitted/stripped outcomes are unchanged |
| `test_266_install_route_gates.py` | `resp.json() == authored` | `== [authored row + connection_state [] + can_connect False]`; still `mperm.assert_not_awaited()` |
| `test_264_unchanged_sites_fenced.py` | docstring claimed `save_skill` is not advertised to an Expert run | docstring corrected; no assertion changed |

## Resolver characterization (captured on base `785c03274`, pinned as literals)

The fixture org has `google` revoked, `notion`/`docs` active, and `slack` active but disabled. The Expert requires `["google","notion","docs","hubspot","slack"]`.

```
org ORG : effective ['notion', 'docs']  stripped ['connection:google', 'connection:hubspot', 'connection:slack']  count 3
org None: effective []                  stripped [all five]                                                        count 5
```

HEAD reproduces both exactly. The one behavioural difference is that org `None` now makes **zero** queries instead of one. That query could only ever return nothing (`org_id = NULL`).

## Finding for SEED-303 — biased Expert on a thread with no folder (D-267-35)

`compose_expert_scope` moves the base behaviour byte-for-byte. A **BIASED** Expert on a thread with **no folder** narrows retrieval to the Expert's folders only, so "biased" acts as a filter there, not a boost. This is pinned as a characterization test (`test_biased_with_no_thread_folder_narrows_to_the_expert_folders_CHARACTERIZATION`) and documented in the module docstring. Per operator ruling D-267-35 it is kept, stated to the user as `Dropped: All your documents` (267-02/04), and routed to SEED-303 as an open arm. The re-open trigger is the first phase that gives "biased" real ranking semantics, after the SEED-224 `retrieval_service.py` extraction. This plan did not edit SEED-303 (the phase close owns the seed routing).

## Gates

- **Backend unit gate** (full, once, at the plan end): `71 failed, 5756 passed, 1 skipped, 2 xfailed, 2 xpassed` with 0 collection errors. `node scripts/check-backend-unit-baseline.cjs` returned `[GATE PASSED] … (failed: 71 <= 71, errors: 0)`.
  - **Set diff against 267-BASELINES.md:** `comm -13 base head` is empty and `comm -23 base head` is empty. The failed SET at HEAD equals the base SET.
  - One line appeared to differ, `test_db_runs.py::test_insert_assistant_message_optional_fields_none`. That was only a RuntimeWarning concatenated onto the same id in the raw output.
  - Passed went +83, all new 267 cases.
- **Closed core:** 7 phase types / 1 emitter / 29 tools / 2 programmatic. Checked by `test_267_tool_floor_union.py::test_closed_core_inventory_is_unchanged` and the green `test_259` / `test_255` suites.
- **G-5:** `node scripts/check-hot-file-ledger.cjs 267` returned `ledger gate OK` (33 watched).
- **CLAUDE.md:** untouched (`git diff 785c03274 -- CLAUDE.md` is empty).

## Re-derived `commits / phases / lines` for touched files (at `bc8802bd5`)

These feed 267-05, which writes the firing-file rows and sections (the 266-05 precedent). This plan wrote only the `expert_scope.py` and `dependencies.py` rows.

| File | Triple | Fires? |
|---|---|---|
| `backend/app/services/run_producer.py` | 16 / 8 / 967 | yes |
| `backend/app/services/agent_loop.py` | 54 / 27 / 3557 | yes |
| `backend/app/services/tool_dispatcher.py` | 92 / 39 / 5221 | yes |
| `backend/app/models/message.py` | 19 / 12 / 156 | yes |
| `backend/app/services/expert_service.py` | 11 / 7 / 619 | yes |
| `backend/app/api/experts.py` | 14 / 6 / 822 | yes |
| `backend/app/dependencies.py` | 23 / 12 / 1139 | yes (row written this plan) |
| `backend/app/models/expert.py` | 6 / 4 / 131 | yes |
| `backend/app/services/expert_authoring.py` | 7 / 3 / 393 | yes (3 phases) |
| `backend/app/services/expert_scope.py` | 1 / 1 / 116 | no (young; row written this plan) |

## G-5 honoured by construction (D-267-23), and the owed seams named rather than taken

Every change to a firing file is a removal (the tool-floor constants, `effective_tools`, the schema filter), an additive default-off field or key (`scoped_connection_keys`, `skill_catalog_additions`, `connection_state`, `can_connect`), or a pure extraction (`compose_expert_scope`, `connection_states`, `feature_visible`). `agent_loop.py` has no Name, Attribute or function containing "expert" (AST fence green), and `expert_service.py` has no LLM import and no `while` (AST fence green).

**Still owed, not taken:**
1. `tool_dispatcher.py`: the registry / handler split (5221 lines).
2. `agent_loop.py`: the prompt-assembly extraction (the skill catalog, connector note and attachment note block).
3. The chat dispatch-side whitelist: `dispatch_tool` refuses nothing on a chat run because `phase_whitelist` is None. This is named in the `tool_dispatcher` comment and deferred to SEED-303.
4. `dependencies.py`: splitting the visibility/permission gates into their own module (named in its new ledger section).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Four suites outside the plan's file list broke on this plan's change**
- **Found during:** Task 2 and Task 3 targeted runs.
- **Issue:** `test_chat_connector_scoping.py` compiles the selection lines out of `agent_loop.py`, so it needed the `scoped_keys` line and one-line statements. `test_259_expert_member_isolation.py` mocked the old pre-filtered SQL shape. `test_266_install_route_gates.py` asserted exact row equality. `test_260_financial_analyzer_conversation.py`'s multi-turn case constructed `RunContext(effective_tools=…)`, which the research table did not list.
- **Fix:** each was re-driven with its intent kept (see the tables above). `agent_loop`'s admission is written as single-line statements so that test keeps running the real predicate.
- **Commits:** `509f6a0a2`, `bc8802bd5`.

**2. [Rule 1 - Correctness] Expert skills are pulled out of the trim set rather than pinned**
- **Issue:** the plan said names that match a DB row "join pinned_recent_ids so the Phase 140 trim never drops them". But `_cap_pins` drops pins that overflow `PIN_BUDGET_FRACTION`, so pinning does not guarantee that.
- **Fix:** all additions (DB-matched ones use the DB row and its description) are removed from the trim set and appended after `build_skill_catalog_block`. This is proven by `test_expert_skills_survive_the_relevance_trim`, which asserts the trim marker is present, so the case is not vacuous.
- **Commit:** `509f6a0a2`.

**3. [Rule 1 - False claim] Stale docstring in `test_264_unchanged_sites_fenced.py`**
- The docstring stated reason #1 (`save_skill` "not advertised to an Expert run"), which this plan made false. It was corrected; no assertion changed.

**4. Vitest baseline differs from research**
- 267-BASELINES.md records `failed 0` (exit 0), where 267-RESEARCH.md recorded `failed 3`. The totals are the same (8828 / 8075, 327/327 pinned).
- There were no failing names to capture. This is recorded as a flaky-suite observation, not as proof of innocence.

## Threat model

- T-267-01 is mitigated: only resolver-approved keys are carried, `is_enabled` is re-checked, and posture is unchanged. Tested by `test_a_disabled_connection_is_not_admitted_even_when_keyed` and `test_a_denied_tool_stays_hidden_on_a_keyed_connection`.
- T-267-02 is mitigated by the AST fences, which check for no `effective_tools` keyword or attribute and that the constants are absent.
- T-267-03 is mitigated by the history skip and the one-home allowlist. `context_truncated` rows are byte-identical to base.
- T-267-04 is mitigated: `$1` is bound to the validated org, and org None makes zero queries (tested).
- T-267-05 is mitigated: the table covers `org:manage` ∧ visible, and `experts:manage` alone gives False.
- T-267-06 is mitigated: the input row is copied and the test asserts its list is unchanged.
- T-267-07: additions come only from `resolved.effective_skills`.
- T-267-08 is mitigated by the inventory re-count.

No new endpoint, auth path or schema change beyond the register.

## Known Stubs

None.

## Self-Check: PASSED

- The 7 created files exist: `expert_scope.py`, the 4 `test_267_*.py`, `expert_overlay_row.json` and `267-BASELINES.md`.
- The 7 commits `d15822ac8`, `568c7cfbd`, `ad4f6b602`, `6dfd7cc94`, `509f6a0a2`, `209b8d504` and `bc8802bd5` are present in `git log`.
- STATE.md and ROADMAP.md are untouched by this plan.
