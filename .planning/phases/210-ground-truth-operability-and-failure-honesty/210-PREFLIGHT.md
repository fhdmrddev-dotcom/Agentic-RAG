---
phase: 210-ground-truth-operability-and-failure-honesty
artifact: PREFLIGHT
author: claude (reviewer)
builder: gemini
date: 2026-08-26
reviewed_at_head: 9db6de23
plans_reviewed: [210-01, 210-02, 210-03]
tree_state: docs-only — no 210 or 211 code committed
---

# Phase 210 — reviewer pre-flight

**What this is.** AGENTS.md §3.1 puts a `NNN-PREFLIGHT.md` before execution on every ordinary
phase. It is written by the reviewer, who did not shape the build. **Everything below is a
measurement or an open question.** Where a finding implies work, the decision on that work is
the builder's or the operator's — this file deliberately proposes no fix.

Baselines are BUS-003 / BUS-004, re-derived on the untouched tree and still valid at this HEAD:
`tsc 34` (`-p tsconfig.app.json`) · count gate OK 114/114, total 5793, failed 0 ·
backend `tests/unit` 68 failed / 2680 passed.

---

## P-1 · `connectionsCopy.ts` is inside 211's fence — SEAM

`210-01-PLAN.md` `files_modified` claims `frontend/src/components/settings/connectionsCopy.ts`.
BUS-004's operator-agreed fence gives **all of `components/settings/`** to 211, and 211 must
edit that file — it is one of the 12+ frontend files spelling `send_email` literally.

The dependency is real, not a stray edit: `connectionsCopy.ts:62`'s `liveConnectorsOnFrom`
helper exists *because* the client union does not yet name the feature, and the file says so
itself at line 52 — *"widening it fails five `Record<GovernedFeature, …>` exhaustive maps"*.
210-01 removes that helper as the last step of the widening.

So this is a **seam** between two concurrently-built phases, which is the Phase 204 shape.
Raised on the bus as **BUS-005**. The rest of 210 is clean against the fence: 210-02 and 210-03
touch nothing in 211's territory, and `_core.ts` is 210's alone.

## P-2 · `phase_types.py` is also 211's, and 210-03 needs it — MISSING ARTIFACT + SEAM

210-03 threads `retrieval_status` / `retrieval_error` into *"output metadata / citations so
downstream validator gates can inspect it"*. Measured: the phase `output` dict the gate
receives is assembled at **`phase_types.py:823`** (`"citations": result.get("citations") or []`).

- `phase_types.py` is **not** in 210-03's `files_modified`.
- `phase_types.py` **is** in 211's fence, and 211 is the phase refactoring it.

No artifact in 210-03 names the code that carries the new keys from `ToolResult` into the dict
`_validate_citations_required` is handed. **Open question for the builder: which file does that,
and is it inside 210's fence?**

## P-3 · The gate reads three keys nothing writes — the Phase 204 fail-open shape

210-03 task 2's gate code reads `output.get("retrieval_error")`,
`output.get("retrieval_status") == "provider_error"`, and `output.get("embedding_provider")`.

Measured at `tool_dispatcher.py:722-731`, the shipped handler emits exactly two keys:

```json
{"error": "retrieval_unavailable", "detail": "The document search could not run — …"}
```

`retrieval_status`, `retrieval_error` and `embedding_provider` are written **nowhere in the tree
today**. Task 1 is supposed to add them; task 2 consumes them. If the two halves are executed or
verified independently, each is green in isolation and the join is dead — and the failure is
**silent**, because the surviving `"nothing was retrieved (0 sources)"` arm still renders
honestly. That is `load_run_budget` reading `metadata` while `204-03` wrote `inputs`, one file
over. AGENTS.md §3.1 calls for a test that mocks **neither** side; 210-03's `<verify>` blocks run
`test_tool_dispatcher.py` and `test_validator_kinds.py` **separately**.

## P-4 · RAG-09's tool-side half is already shipped — the premise in T-210-06 is stale

210-03 task 1 asks for a catch-and-rewrap of embedding failures, and T-210-06 states the defect
as *"If this exception is caught and converted to `[]`"*.

Measured:

- **`retrieval_service._vector_search` contains no `try`/`except` at all.** `embed_texts` raising
  propagates straight out of `search_documents`. There is no swallow in that file to fix.
- **`tool_dispatcher.py:686-731` already implements the described behaviour**, tagged
  `BUG-260815-05` in a 25-line comment block naming this exact symptom, the 2026-08-15
  measurement, and the reason the exception is converted rather than re-raised.
- The two `return [], 0.0` / `return []` sites (`retrieval_service.py:334`, `:157`) are the
  **honest-zero-match** and **empty-input** paths, not exception handlers.

So the un-shipped half of RAG-09 appears to be the **gate**, not the tool. Whether task 1 still
has work to do — emitting the three keys P-3 names — is the builder's call; the risk flagged here
is a plan re-implementing shipped code in a file that never carried the defect.

## P-5 · The budget default does not reach existing schedules

210-02 changes `models/schedule.py`'s `max_tokens_per_run` default `50_000 → 500_000`. That is a
Pydantic default: it binds **schedules created after the change**. Existing rows carry `50_000`
in `schedules.max_tokens_per_run` (`db/schedules.py:63,96`), and `write_schedule_run_budget`
copies the **row's** value into `workflow_runs.inputs`, where `load_run_budget` reads it.

No plan contains a migration or a backfill `UPDATE`. **Open question: is ROADMAP SC#3 —
*"a scheduled run starts with a token budget a realistic workflow can finish inside"* — claimed
for the operator's existing schedules, or only for new ones?** As planned it is the latter, and
the bug that was reported was on an existing one.

✅ Verified clean while checking this: the Phase 204 fail-open is genuinely fixed —
`db/workflows.py:2436-2492` writes to `workflow_runs.inputs` and `load_run_budget` reads there,
with the string-scalar defence in place and the whole history in the docstring. 210-02 does not
disturb it.

## P-6 · `scheduler_process_enabled` has no reader — unresolved contract between the two tasks

210-02 task 2 has the frontend *"add scheduler daemon status check"* and render a banner. Task 1's
matching backend action is *"Expose `scheduler_process_enabled` in schedule metadata **or** via
settings/status"* — an unresolved `or`, with no endpoint, field name or response shape fixed.

Measured: `scheduler_process_enabled` is a **backend env-var setting** (`config.py:1139`, default
`False`), read once at `main.py:517`. It is in no API response, no `app_settings` row and no
frontend type. That is consistent with CLAUDE.md — a daemon toggle is infra, so an env var is the
right home — which means the frontend cannot learn it without a new endpoint or field. **Two
tasks in one plan, no named contract between them.** Same family as P-3.

## P-7 · Verified correct — recorded so it is not re-litigated at review

- **T-210-01's mitigation is right, and the reason is stronger than the plan states.**
  `phase_types.py:2391` requires the **positive** `feature_audience("live_connectors") ==
  "everyone"`; the comment above it records CR-03 measuring that `!= "off"` read three of the four
  audiences as fully on. A binary On/Off card is therefore the only shape that cannot mislead, and
  any other audience fails **closed**.
- **`DEFAULT_VISIBILITY: live_connectors: "off"` matches the backend**, which already defaults it
  `"off"` at `user_settings.py:1214`. No fail-open introduced by the new key.
- **SC#1's second half — *"a subsequent external call is refused"* — is already enforced
  server-side**: `require_visible("live_connectors")` sits per-endpoint on the connector WRITE
  routes (`connectors.py:349,385,427,451`) and the executor gate is `phase_types.py:2391`.
  210-01 being frontend-only is sufficient for SC#1; this should not be raised as a gap later.
- **T-210-03's string-scalar guard is warranted.** The trap is real and recorded
  (`workflow_definitions` / `workflow_phases.output` string scalars), and mirroring
  `publish_service.py` is the shape already used elsewhere in the tree.

---

## Gates the post-execution check will re-derive

| Gate | Baseline | Contract |
|---|---|---|
| `tsc -p tsconfig.app.json` | 34 | 34, and **0 in touched files** — the bare form checks ZERO files |
| count gate | OK 114/114, total 5793, failed 0 | no per-file DECREASE, 0 failing; a bigger total is the gate working |
| backend `tests/unit` | 68 failed / 2680 passed | 68 is the rot set and is **unattributed**; `test_retrieval_service.py` is 15 of it and is RAG-09's home file, `test_111_1_reembed_kickoff.py` is 4 more |

⚠ Capture failing **filenames from the gate's own persisted JSON before any re-run**, and check
each against `git diff --numstat`. `GSD_VITEST_MAX_WORKERS=2` on every run — two test-running
agents is exactly the measured limit.

---

# Round 2 — against the revised plans (HEAD `9a6c6fa3`)

P-1, P-4, P-5, P-6 and P-7 are answered. **P-3 is not closed — it changed shape.**

## R-1 · ⛔ BLOCKING · the `ctx` bridge does not exist in production

The revised 210-03 has `tool_dispatcher` `setattr` the failure state onto `ctx`, and
`_validate_citations_required` read it off `ctx`, *"avoiding any dependency on `phase_types.py`"*.

**Measured: those are two different objects.**

- The tool handler's `ctx` is a **`ToolContext`**, constructed fresh at
  **`phase_types.py:537`**, field-by-field out of `getattr(ctx, …)`. It is a copy with **no
  back-reference** to the harness ctx.
- The gate's `ctx` is the **harness ctx** — `harness_engine.py:986` calls
  `run_gates(phase, output, ctx, timing="post")` with the same variable it passed to
  `_execute_phase(phase, accumulated_outputs, ctx)` at `:948`.

So `setattr(tool_ctx, "retrieval_status", …)` writes onto an object the gate never sees.
`ToolContext` is a plain `@dataclass` (not frozen, no `__slots__`), so the write **succeeds
silently** and nothing raises.

⚠ **The plan's own mock-neither test cannot catch this.** Task 3 step 1 creates **one**
`ToolContext` and passes that same instance as the tool's ctx *and* as the gate's ctx. That is a
shape production never has. The test passes; the feature fails open; and it fails open silently,
because the surviving `"0 sources"` arm still renders honestly.

This is P-3 unchanged — a dict-key mismatch translated into an object-identity mismatch. The
seam the state must cross **is** `phase_types.py:537`, which is why avoiding that file did not
avoid the problem.

## R-2 · ⛔ `210-01` and `210-02` both edit `_core.ts`, both `wave: 1`, both `depends_on: []`

Both plans list `frontend/src/lib/api/_core.ts`, and both edit the same region: 210-01 widens
`GovernedFeature`, 210-02 adds `scheduler_process_enabled` to `EffectiveFeatures` (`_core.ts:102`).
With worktrees enabled, same-wave plans run in parallel.

## R-3 · `EffectiveFeatures` is a `Record` over `GovernedFeature` — which form is intended?

`_core.ts:102` reads `export type EffectiveFeatures = Partial<Record<GovernedFeature, boolean>>`,
and `GET /features` builds its payload as a comprehension over `_GOVERNED_FEATURES`
(`features.py:64-88`). `scheduler_process_enabled` is infra (`config.py:1139`), not a governed
feature — it has no audience and cannot be flipped.

Putting the key **inside** that map means widening `GovernedFeature`, which then demands an entry
in the five exhaustive `Record<GovernedFeature, …>` maps, a `DEFAULT_VISIBILITY` entry, and a
Control Room card for something that is not a kill switch — **and it collides with 210-01, which
widens the same union in the same wave** (R-2). An intersection type, or a sibling key next to
`features`, has neither consequence. The plan says *"add optional `scheduler_process_enabled?:
boolean` to feature/settings response types"* without saying which. ✅ Nothing in the frontend
iterates the features map, so the sibling/intersection form is safe.

## R-4 · Note only · the SC#3 floor overrides a deliberate low budget

`_schedule_max_tokens` raising any row with `max_tokens_per_run <= 50_000` to `500_000` also
raises one an operator set low **on purpose**. That is a decision, not a defect — recorded so it
is not discovered later as a surprise.

## R-5 · ✅ P-1 resolved cleanly

`connectionsCopy.ts` is out of 210-01's `files_modified`. The `liveConnectorsOnFrom` cast keeps
working unchanged once the union is widened, and 211 retires it. No further action.

---

# Pre-existing backend failures — the exact names, captured on the untouched tree

Run at HEAD `9db6de23`, `backend/venv/Scripts/python.exe -m pytest`. **19 = the 15 + 4 the
baseline predicted.** Root cause measured: these tests call `async def` functions **without
awaiting** — `TypeError: cannot unpack non-iterable coroutine object`
(`test_retrieval_service.py:102`) plus `RuntimeWarning: coroutine 'search_documents' was never
awaited`. **Rot from an async conversion, not a defect in the code under test.**

`test_retrieval_service.py` (15):
`TestSearchDocuments::test_calls_embed_texts_with_query` ·
`::test_calls_supabase_rpc_match_document_chunks` · `::test_returns_empty_list_when_no_chunks_match` ·
`::test_returns_empty_list_when_rpc_data_is_none` · `::test_joins_results_with_documents_table` ·
`::test_returns_formatted_results` · `::test_uses_unknown_filename_when_doc_not_found` ·
`::test_returns_multiple_results` ·
`TestSearchDocumentsPhase26::test_returns_chunk_index_in_enriched_results` ·
`::test_returns_avg_similarity_as_second_value` · `::test_returns_zero_avg_sim_when_no_results` ·
`::test_hybrid_empty_returns_tuple` · `::test_chunk_index_none_when_missing` ·
`TestEnrichWithFilenamesPhase28::test_enrich_with_filenames_includes_version_number` ·
`::test_enrich_with_filenames_defaults_version_number_to_1`

`test_111_1_reembed_kickoff.py` (4): `test_model_change_kicks_reembed` ·
`test_dims_only_change_kicks_reembed` · `test_model_only_change_kicks_without_resize` ·
`test_no_change_save_does_not_reembed`

⚠ **Two of those 15 are the regression net for 210-03's own T-210-07** —
`test_returns_empty_list_when_no_chunks_match` and `test_returns_empty_list_when_rpc_data_is_none`
are exactly the honest-zero-match cases the plan must not turn into false provider errors, and
**they are red today**. The safety net for the plan's own stated mitigation is already down.
