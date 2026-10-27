# Phase 296: Close v4.7 Debt - Pattern Map

**Mapped:** 2026-10-26 (HEAD `7055b5847`)
**Files analyzed:** ~60 touched files, grouped into 14 fix PATTERNS across the 5 plans (RESEARCH §Plan Cut)
**Analogs found:** 14 / 14 patterns (every fix shape has an in-repo precedent; only the Moonshot `$ref` inliner has no direct twin, so it copies the shape of the Google sanitiser)

> Proportionate by design (bug-fix phase). One analog plus one excerpt per fix PATTERN, not per file.
> Line numbers were read at HEAD `7055b5847`. These are hot files, so the executor re-reads them before editing.
> The file → plan ownership is RESEARCH §Plan Cut, including its reassignment table. It is not repeated here.

## File Classification (by plan → pattern)

| Plan | Files (new/modified) | Role | Data flow | Pattern (below) | Analog | Match |
|---|---|---|---|---|---|---|
| 296-01 W1 | `api/folders.py`, `api/workflows.py` (`create_draft`), `db/workflows.py` (`create_workflow_definition`) | route + db fn | request-response / CRUD | **P1 org stamping** | `api/threads.py:940-975` `create_thread` | exact |
| 296-01 W1 | `services/run_evidence.py` (`compose_phase_log`, 289-IN-04) | service (pure) | transform | **P2 one local + one condition** | same function, `:263-269` | exact (in-place) |
| 296-01 W1 | `supabase/migrations/216_neutral_default_org_name.sql`, `scripts/full-schema-supplement.sql:205` | migration | DDL | **P3 migration + supplement same-commit** | `214_app_settings_round_caps.sql` header; supplement `:195-216` | role-match |
| 296-01 W1 | `services/rate_limit.py`, `api/citation_checks.py` | service + route | request-response | **P4 Redis per-subject limiter** | `rate_limit.enforce_ip_limit` `:98-112` | exact |
| 296-01 W1 | `services/inbound_inputs.py` (`missing_required`), `api/threads.py:2085`, `services/workflow_kickoff.py:570` | utility + guard | validation | **P5 pure predicate + one guard per site** | `inbound_inputs.validate_inbound_inputs` `:118-168` | exact |
| 296-02 W2 | `harness_engine.py` (boot sweep), `api/runs.py`, `run_handoff.py`, `run_reconciler.py`, `db/workflows.py` | engine / lifecycle | event-driven | **P6 boot-sweep pause-and-continue** | `harness_engine.py:2702-2714` arm 2a + `_is_armed_action_risk` `:2890-2912` | exact |
| 296-02 W2 | `main.py`, `tests/conftest.py` (SEED-363) | config flag | lifecycle | **P7 module flag beside `_setup_mode`** | `main.py:406,431` `if not _setup_mode:` | exact |
| 296-02 W2 | `api/schedules.py`, `scheduler_service.py`, `api/workflows.py` (293-DEL), `api/runs.py` (295-IN-07), `api_keys.py`, `inbound.py` | route | request-response | **P8 worded refusal, raw text never on the wire** | `create_draft` `UniqueViolationError → 409` (`api/workflows.py:1212-1222`); `ScheduledLaunchRefused` | exact |
| 296-02 W2 | `unattended_launch.py:223` (293-IN-04) | service | fire-and-forget | **P9 held task reference** | `run_transport._spawn` `:44-52` | exact |
| 296-02 W2 | new `provider_gateway/schema_moonshot.py` + one line at `openai_compat.py:~449-455` | provider leaf | transform | **P10 pure recursive schema transform at the boundary** | `google_service._sanitize_schema_for_google` `:314-342` | role-match |
| 296-02 W2 | `harness/phase_types.py` (S6-F8 `:206-216`, 293-F-4 `:1653-1656`), `task_service.py`, `sub_agent_models.py` | harness | request-response | **P11 one helper / one precedence expression** | the lines themselves + `wrap_untrusted_input` (`inbound_inputs.py:180`) | exact (in-place) |
| 296-03 W3 | `WorkflowBuilderPage.tsx`, `WorkflowCanvas.tsx` (D-09), `GovernanceSection.tsx`, `NodeCornerMarks.tsx`, `canvasModel.ts`, `definitionOps.ts` (D-04 b), `publish_service.py` (D-08), describe-door files | component / page | UI state | **P12 lift-state one prop + one condition**; D-04(b) copy narrowing; D-08 typed stand-ins | `selectedSlug` controlled prop (`WorkflowCanvas.tsx:540,673`) | exact |
| 296-04 W4 | `StreamsProvider.tsx` (follow terminal), `RunEvidenceReport.tsx`, `evidenceVocabulary.ts`, `WorkflowScheduleModal.tsx`, `useStartWorkflowInThread.ts`, `composerCopy.ts`, `ChatLaunchForm.tsx`, `RunModal.tsx`, `soulData.ts`†, `PhaseCard.tsx`, `rerankEngines.ts`, `citationCheckStore.ts`, `CitationCheckAction.tsx`, `curlExamples.ts`, diagram/tooltip files | component / provider | event-driven / UI | **P13 one reconcile in the terminal wrapper**; **P14 sentence lives in a vocabulary file** | `StreamsProvider.tsx:2011-2018` (continuation settle) and `:2107-2113` (thread-switch reconcile); `evidenceVocabulary.ts:48-49` | exact |
| 296-05 W5 | tests, `.planning/reported-bugs/*`, `.planning/seeds/SEED-375+`, `docs/HOT-FILE-LEDGER.md` | records | — | **Shared: ledger row + section, seed contract, bug close** | `frontend/nginx.conf` row (`HOT-FILE-LEDGER.md:12023` + `:24903`); `seeds/TEMPLATE.md`; `BUG-261004-01` frontmatter | exact |

† `soulData.ts` belongs to W3 under the RESEARCH reassignment (287-IN-02). W4 only *imports* `missingRequiredFields` / `requiredFieldsMessage`.

---

## Pattern Assignments

### P1. Org stamping on create (BUG-261021-02). W1: `api/folders.py`, `api/workflows.py`, `db/workflows.py`

**Analog:** `backend/app/api/threads.py:960-965` (`create_thread`, Phase 268 D-268-07)
```python
        # Phase 268 (D-268-07 / SEED-314): without an Expert the thread still belongs to the
        # VALIDATED active org, not to the mig-106 trigger's LIMIT-1 guess (which is the wrong org
        # for a two-org user). No header / non-member header → None → no key → byte-identical.
        _active_org = await resolve_active_org_or_none(request, current_user)
        if _active_org:
            insert_data["org_id"] = _active_org
```
Imports come from `app.dependencies` (`threads.py:42`). The signature adds `request: Request` (see `create_thread`'s signature at `:942-948`).

**Targets as they stand:**
- `api/folders.py:45-86` `create_folder` has no `request` param. Its insert dict is at `:77-82`. The parent check at `:52-56` uses `fetch_visible_folders`. RESEARCH Pitfall 10 also asks for a refusal when the parent's `org_id` differs from `_active_org`. That refusal uses the same `404 "Parent folder not found"`, and the executor should confirm the folder read selects `org_id`.
- `api/workflows.py:1193-1222` `create_draft` → `db/workflows.py:1028-1058` `create_workflow_definition(pool, *, definition, user_id)`. The INSERT column list is at `:1049-1050`.

**Keyword-only optional kwarg analog (db fn):** `db/workflows.py:400-412` `create_workflow_run(..., *, ..., origin_kind: str | None = None, origin_label=..., origin_ref=...)` (293-02). Add `org_id: UUID | None = None` the same way. When it is None, the SQL must stay byte-identical so the mig-106 trigger fills NULL.

**Test analog, unit:** `backend/tests/unit/test_268_send_path_stamp.py:266-330`. The test patches `resolve_active_org_or_none` with an `AsyncMock` and captures the insert dict.
```python
    with patch.object(threads_mod, "aexec", _aexec), \
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=ORG_B)):
        ...
    assert inserted and inserted[0]["org_id"] == ORG_B
# and the twin: AsyncMock(return_value=None) → assert "org_id" not in inserted[0]
```
**Test analog, real two-org Postgres (DB-mutating, serial):** `backend/tests/integration/test_268_two_org_rows.py:44,80-97`. It uses `TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"` and creates a second org. Keep its non-vacuity control: assert trigger-org ≠ active-org *before* the org assertion. The existing route tests to extend are `tests/unit/test_103_draft_crud.py` and `tests/integration/test_folders.py`.

---

### P2. One local + one condition in a pure composer (BUG-261020-02 / D-05; 289-IN-04). W1: `services/run_evidence.py`

**Analog (the site itself):** `backend/app/services/run_evidence.py:263-269`
```python
        if (
            not viewer_is_owner
            and readable_ids is not None
            and output_text is not None
            and any(c["document_id"] not in readable_ids for c in _citations_of(row))
        ):
            output_text = WITHHELD_OUTPUT_SENTENCE
```
- Add `withheld_upstream = False` before the loop. Widen the condition with `(withheld_upstream or any(...))`. Set `withheld_upstream = True` **only inside this branch**, so a human-input step that nulls `output_text` at `:257-262` never triggers the cascade (Pitfall 9).
- UI-SPEC A requires a **second constant**. The cascaded step gets `WITHHELD_UPSTREAM_SENTENCE = "This step builds on an earlier step you don't have access to, so its output is withheld too."` and the citing step keeps `WITHHELD_OUTPUT_SENTENCE`. So the branch picks the sentence by which arm fired. Declare the constant beside `run_evidence.py:88`.
- **289-IN-04:** filter `cited_document_ids` to canonical UUIDs before the `uuid[]` cast (`run_evidence.py:~365-372`, `api/workflow_run_evidence._viewer_reads`). The regex is the one in P3/F18.

**Test analog:** `backend/tests/unit/test_289_run_evidence.py:645-684`. This test rewrites one phase row's output through the `wire` fixture's patched `pool.fetch`, then reads as `COLLEAGUE` and as `OWNER`.
```python
    colleague = json.loads((await _read(RUN_DONE, COLLEAGUE)).model_dump_json())
    assert colleague["phase_log"][0]["output_text"] == ev.WITHHELD_OUTPUT_SENTENCE
    # a step with no masked citation keeps its output   ← THIS assertion is what D-05 flips for later steps
    assert colleague["phase_log"][2]["output_text"] == "Memo written."
```
⚠ The existing line `phase_log[2] == "Memo written."` pins the OLD behaviour. RED-first means writing the new expectation (`== ev.WITHHELD_UPSTREAM_SENTENCE` for the colleague, unchanged for the owner) and amending that assertion deliberately, with the reason in the test body.

---

### P3. Migration + supplement copy in the same commit (SEED-364 / D-06 → mig 216; 293-IN-05 edits 215 in place). W1

**Header/style analog:** `supabase/migrations/214_app_settings_round_caps.sql:1-21`. It opens with a prose header naming phase, row and decision, then states "SCHEMA, NOT A SEED", the RLS/grant posture, and idempotence. 216 is `CREATE OR REPLACE FUNCTION public.handle_new_user()`, so its header must state: **no UPDATE of existing rows (D-06)** and *EXECUTE privileges kept by CREATE OR REPLACE (mig 181 posture)*.

**Body to copy byte-for-byte except the name expression:** `scripts/full-schema-supplement.sql:195-216`
```sql
  begin
    if not exists (select 1 from public.org_members m where m.user_id = new.id) then
      v_org_id := public.create_org_with_default_dept(
                    coalesce(new.email, new.id::text) || '''s Organization', null, 'General');
      ...
  exception when others then
    raise warning 'handle_new_user: personal-org creation failed for %: %', new.id, sqlerrm;
  end;
```
Replace only the `coalesce(new.email, …) || '''s Organization'` expression with a no-email name, and make the identical edit in `full-schema-supplement.sql` **in the same commit** (that file FIRES at 15 phases, so it needs a ledger section touch). Prior definitions are in `001_initial_schema.sql`, `105_personal_org_backfill.sql:103` and `181_revoke_public_secdef_functions.sql`. Read 181 to confirm the grant posture.

**Shape-test analog:** `backend/tests/unit/test_294_migration_211_shape.py:18-45`. It defines `REPO_ROOT`/`MIGRATIONS`/`SUPPLEMENT` paths, `_migration()` globbing `216_*.sql` and asserting exactly 1, and `_strip_comments()` so header prose cannot satisfy an assertion. Use the same file shape for (a) 216 having no `email` in the name expression, the supplement matching it, and no `UPDATE public.organizations`; and (b) 215's backfill regex being the canonical `'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`.

Then apply 216 by the SQL editor (or asyncpg under the local-DB lock), run `bash scripts/regenerate-full-schema.sh` (no `--reset`), then `check-schema-acl-parity.cjs` and `check-greenfield-privileges.py`.

---

### P4. Redis per-subject limiter, fail closed (SEED-365 rate half / D-13). W1: `services/rate_limit.py`, `api/citation_checks.py`

**Analog:** `backend/app/services/rate_limit.py:98-112` `enforce_ip_limit` (module-constant limit, the `IP_CALLS_PER_MINUTE` precedent at `:91`)
```python
async def enforce_ip_limit(redis, *, client: str) -> None:
    limit = int(IP_CALLS_PER_MINUTE)
    try:
        retry = await hit(redis, key_id=client, kind="ip", limit=limit)  # type: ignore[arg-type]
    except Exception:  # noqa: BLE001 — any Redis failure refuses; see the module docblock
        logger.warning("inbound per-address limiter unavailable; refusing the call", exc_info=True)
        raise HTTPException(status_code=503, detail=UNAVAILABLE_DETAIL)
    if retry is not None:
        raise HTTPException(status_code=429, detail=IP_LIMIT_DETAIL.format(limit=limit, retry=retry),
                            headers={"Retry-After": str(retry)})
```
- `Kind = Literal["start", "read"]` (`:29`) is why `"ip"` needs a `type: ignore`. Widening the Literal to include `"citation"` is cleaner than a second ignore.
- ⚠ **Wire-shape correction to RESEARCH's code example:** every refusal in `api/citation_checks.py` uses a **dict** detail with a reason code (`:158` `detail={"reason": availability.reason}`, `:163` `{"reason": "in_flight"}`, `:170` `{"reason": "engine_failed"}`), and UI-SPEC D names a new client reason `rate_limited`. So the 429 should carry `detail={"reason": "rate_limited"}` plus `Retry-After`, and the sentence lives client-side in the citation vocabulary (`citationVerdicts.ts`). Do not put an English string on the wire here.
- Call site: the top of `post_citation_check` (`api/citation_checks.py:124`), after the route has resolved `current_user` and **before** the in-flight `redis.set(..., nx=True)` claim at `:162`. `redis` is already injected (`:130`).
- **Tests:** `backend/tests/unit/test_293_rate_limit.py:106-143` (`frozen` fixture, bucket-key and shared-count tests) and `tests/unit/test_294_citation_check_route.py`. The limiter fakes are in `tests/unit/phase293_inbound_fakes.py`.

---

### P5. Pure predicate + one guard per kickoff site (287-T01). W1: `services/inbound_inputs.py`, `api/threads.py`, `services/workflow_kickoff.py`

**Analog:** `backend/app/services/inbound_inputs.py:160-167` (the key-call "missing required" arm)
```python
    missing = [
        f.key for f in declared.values()
        if f.required and out.get(f.key, "").strip() == ""
    ]
    if missing:
        raise InboundInputRefused(
            "missing_input", f"Missing required input(s): {', '.join(missing)}.", missing
        )
```
- Extract this into a pure `missing_required(definition, inputs) -> list[str]` built on `declared_fields` (`:65`) and `_is_fenced` (`:114`). Then call it from `validate_inbound_inputs` too, so there is one predicate.
- **Client parity to pin:** `frontend/src/components/workflows/soulData.ts:221-226`
  ```ts
  return fields.filter((f) => f.required !== false && (values[f.key] ?? "").trim() === "")
  ```
  It applies over `launchInputFields(...)`, which excludes `file`/`kb_auto`. Match those exclusions exactly and pin them in a test.
- **Guard sites:** one line each, before the run/thread insert. The sites are `api/threads.py:2085` (`"kickoff_prompt": launch_kickoff(body.content, _kickoff_definition, body.inputs)`) and `services/workflow_kickoff.py:570`. Both files FIRE, so each gets one guard and a ledger touch. The refusal is a 422 with one worded sentence (P8).
- **Tests:** a new unit test for `missing_required`, and the `tests/integration/test_214_launch_inputs_wire.py` pattern for the route.

---

### P6. Boot-sweep "pause and continue", classify by the DEFINITION (BUG-261025-03 / D-24; also SEED-362, RES-a, DEBT-3, 295-IN-01/02/03). W2: `harness_engine.py`, `api/runs.py`, `run_handoff.py`, `run_reconciler.py`, `db/workflows.py`

**Analog:** `backend/app/services/harness_engine.py:2702-2714` (295 arm 2a: an unanswered engine ask stays paused)
```python
        _engine_ask = ((active or {}).get("output") or {}) if isinstance(
            (active or {}).get("output"), dict) else {}
        _engine_tcid = (_engine_ask.get("_awaiting_answer") or {}).get("tool_call_id")
        if _engine_tcid and await get_ask_user_response(pool, run_id, str(_engine_tcid)) is None:
            await pause_run(pool, run_id)
            continue
```
**Classifier analog (reuse its idiom, never a second classifier):** `harness_engine.py:2906-2912`
```python
    slug = active_phase.get("slug")
    if not slug or definition is None:
        return False
    for spec in getattr(definition, "phases", None) or []:
        if getattr(spec, "slug", None) == slug:
            return bool(getattr(spec, "action_risk_armed", False))
    return False
```
- **The dead branch being replaced** is `:2715-2731`. `_is_llm_human_input(active)` / `_active_tool_call_id(active)` read keys that `get_active_phase` never selects (`db/workflows.py:~1700`).
- **Ordering constraint:** the definition is loaded only at step 3 (`definition = await _load_run_definition(pool, run_id)`, `:~2734`). The new human-input arm must therefore sit **after** that load and its `None` guard (RESEARCH Code Examples), not where the dead branch sits now. When the latest prompt is answered, set `ctx.resume_answered_tool_call_id` before `_resume_run`, never re-ask.
- **Tests:** write RED from the **real** `get_active_phase` row shape (`id, slug, phase_index, status, output, started_at, completed_at`; Pitfall 4). Extend `tests/test_harness_resume.py`, `tests/test_200_human_gate_pause.py` and `tests/test_295_engine_ask_redrive.py`. Reconcile fakes that carry `config`/`tool_call_id` deliberately, with the reason in the test body (the D-206-07 precedent).
- **Same family, one-touch each (all in G-5 firing files):**
  - RES-a: one guard on `getattr(ctx, "resume_answered_tool_call_id", None)` at `harness_engine.py:~1015-1024`.
  - 289-F3: pass `ctx.user_settings` at `:~383`.
  - SEED-362: in `_build_resume_context`, prefer `run.get("model")` over `resolve_workflow_ctx_model(_owner_settings)`. Add the `wr.model` select in `find_resumable_runs` and in `api/runs.py:~737`.
  - DEBT-3: RED test only. Expect green, then close as "did not reproduce" (Pitfall 3: `run_is_cap_paused` reads `runs`, which is the wrong table).
- **RES-b analog for a "carry who on the broadcast" kwarg:** `run_lifecycle.broadcast_run_cancellation(redis, run_id, reason="cancelled")` (`run_lifecycle.py:103`) plus `record_stop(pool, run, stopped_by, policy=...)` (295-04).

---

### P7. Module flag beside `_setup_mode` (SEED-363). W2: `app/main.py`, `backend/tests/conftest.py`

**Analog:** `backend/app/main.py:406-407` and `:431-432`
```python
    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no DB to reconcile
        asyncio.create_task(_resume_stranded())
    ...
    if not _setup_mode:  # Phase 158 (D-03) — a fresh box has no DB to reconcile
        asyncio.create_task(_reconcile_orphans())
```
- Add a module-level `RUN_BOOT_SWEEPS = True` and change both conditions to `if not _setup_mode and RUN_BOOT_SWEEPS:`. Read it as a module global at lifespan time, so a test's assignment takes effect.
- **Where tests turn it off:** `backend/tests/conftest.py`. That is the top-level conftest; `tests/unit/` has **no** conftest of its own, and `tests/integration/conftest.py` exists separately. The file already patches env before any app import (`:7-44`). It has **no `pytest_configure` today**, so either add one or set `app.main.RUN_BOOT_SWEEPS = False` at module level after the env block.
- ⛔ **No env var** (Pitfall 5: `check-deploy-drift.sh`).
- **Test:** new `tests/unit/test_296_lifespan_no_sweeps.py`. Patch `app.services.harness_engine.resume_stranded_workflows` and assert it is not awaited under a `TestClient` lifespan.

---

### P8. Worded refusal; a raw exception never reaches the wire (295-IN-05, 293-DEL, 295-IN-07, 287-T01 422, 293-IN-06, 291-S2-F3). W2 / W3

**Analog A, a DB constraint mapped to an honest 409:** `backend/app/api/workflows.py:1212-1222`
```python
    try:
        row = await create_workflow_definition(pool, definition=body, user_id=user_id)
    except asyncpg.exceptions.UniqueViolationError:
        # ... An honest 409 — NEVER a raw 500 (UAT-103).
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="a workflow with this slug and version already exists",
        )
```
For 293-DEL, use the same shape with `asyncpg.exceptions.ForeignKeyViolationError` in `delete_workflow_cascade` (`api/workflows.py:1469`). The detail is UI-SPEC E's exact sentence.

**Analog B, a typed refusal exception whose `str()` is the sentence:** `backend/app/services/scheduler_service.py:41-49` `class ScheduledLaunchRefused(Exception)` ("``str(exc)`` is the author-facing sentence"). **Target:** `api/schedules.py:268-284`. Today it is
```python
    try:
        run_id = await launch_scheduled_run(launch_row, pool=pool, redis=get_redis())
    except Exception as exc:
        logger.error("Failed to manually trigger schedule %s: %s", schedule_id, exc)
        return ScheduleTriggerResult(launched=False, detail=f"Failed to launch schedule: {exc}")
```
Add `except ScheduledLaunchRefused as exc: detail=str(exc)` **before** the generic arm. The generic arm then returns UI-SPEC C's fixed sentence and logs `exc`. Replace the `run_id is None` detail with UI-SPEC C's "could not be loaded" sentence.

**Rule (CONTEXT Established Patterns):** one refusal = one worded sentence. Backend sentences are module constants. Frontend sentences live in a vocabulary file (P14). `apiKeyFacts.test.ts` is the precedent for a frontend test reading backend reasons.

---

### P9. Held reference for fire-and-forget tasks (293-IN-04). W2: `services/unattended_launch.py:223`

**Analog:** `backend/app/services/run_transport.py:44-52`
```python
_BACKGROUND_TASKS: set[asyncio.Task] = set()

def _spawn(coro) -> asyncio.Task:
    """Schedule a fire-and-forget coroutine and retain a strong reference."""
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t
```
The same idiom appears in `eval_runner_service.py:93-109` and `api/evals.py:643`. The 289-WR-06b "retry after the lease" task in `api/runs.py` must also be held this way.

---

### P10. Pure recursive schema transform at the provider boundary (BUG-261024-01, Moonshot). W2: new `provider_gateway/schema_moonshot.py`, one line in `openai_compat.py`

**Analog:** `backend/app/services/google_service.py:314-342` `_sanitize_schema_for_google`. It is pure, recursive, returns a new structure, and carries a docblock citing the live evidence.
```python
    if isinstance(schema, dict):
        out = {k: _sanitize_schema_for_google(v) for k, v in schema.items()
               if k not in _GOOGLE_UNSUPPORTED_SCHEMA_KEYS}
        return _translate_nullable_type(out)
    if isinstance(schema, list):
        return [_sanitize_schema_for_google(item) for item in schema]
    return schema
```
- **Call site:** `provider_gateway/openai_compat.py:449-455` passes `tools_override=request.tools` into `create_adaptive_streaming_chat(...)`. The neighbouring comment (`:447`) is the rule to follow: *"keyed on the ENDPOINT's provider, never the registry vendor"* (`request.retries_provider()` / `active_provider_name`). It is one conditional expression, and the logic stays in the leaf. The inliner body is in RESEARCH Code Examples.
- **Identity requirement:** a ref-free schema returns the **same object**. Prove it with an identity test over `get_tools()`. The pattern test is `tests/unit/test_151_cross_provider_schema.py`, and the new test is `test_296_moonshot_schema.py`.

---

### P11. One helper / one precedence expression in `phase_types.py` (291-S6-F8, 293-F-4, 291-IN-01). W2

**Site, 293-F-4:** `backend/app/services/harness/phase_types.py:1653-1656`
```python
            result = await forced_emit(
                messages=messages,
                model=model,
                provider=getattr(ctx, "provider", None) or _provider_for_model(model, ctx),
```
Make the step's pinned `phase.config.model` win: use `_provider_for_model(model, ctx)` when the step pins a model, and keep today's order otherwise. `forced_emit` already resolves a non-active provider's key and base_url (`forced_emit.py:449-481`). The agent-step path (`task_service.run_task_sub_agent`, `sub_agent_models.resolve_sub_agent_model_safely`) is decided by RED. A silent swap becomes a worded notice; real cross-provider routing becomes a seed (D-03).

**Site, S6-F8:** `phase_types.py:206-216`
```python
def _first_phase_user_turn(accumulated_outputs: dict, ctx) -> str:
    prior = _prior_output_text(accumulated_outputs)
    return prior or _kickoff_prompt(ctx)
```
Add one helper that appends the **declared** inputs' answers (keys from `definition.inputs`, never `ctx.inputs` wholesale, and never `_NON_ACTION_RUN_INPUTS` at `:~2119`). Wrap each value with `inbound_inputs.wrap_untrusted_input(field, text)` (`inbound_inputs.py:180`) when `ctx.inputs[UNTRUSTED_FLAG]` (`:175`). Read `launch_kickoff` (`:234`) first so key-run answers are not doubled. Test: `tests/test_dual_mode_wiring.py`. This is a D-21 roster row.

---

### P12. Lift state as ONE controlled prop + ONE condition (290-WR-02 / D-09). W3: `WorkflowCanvas.tsx`, `WorkflowBuilderPage.tsx`

**Analog (an existing controlled prop on the same component):** `WorkflowCanvas.tsx:540` `selectedSlug: string | null` / `:673`, which the page passes at `WorkflowBuilderPage.tsx:2137-2138` (`selectedSlug={selectedSlug}` `onSelectNode={handleSelectNode}`).

**State to lift:** `WorkflowCanvas.tsx:1154-1156`
```tsx
  // 290-03 (VIS-01 / D-06) — which view the header switch shows. Local, never persisted.
  const [view, setView] = useState<"steps" | "team">("steps")
  const teamShown = team !== undefined && view === "team"
```
**Gates in the page:**
- The undo/redo key handler opens at `WorkflowBuilderPage.tsx:1006-1007` with `if (!canvasEnabled || activeGraphView !== "canvas") return`. Add `|| teamShown` to that one early return. It must not clear the notice (UI-SPEC E).
- `<PhaseFormPanel` mounts at `:2790`. Do not render it while Team shows, and keep `selectedSlug` so returning to Steps re-opens it.
- The canvas already guards its own keyboard reorder with `teamShown` (`:1160`), which is the in-file precedent.
- Tests: `WorkflowBuilderPage.canvas.test.tsx`.

**D-04 (b) copy narrowing (BUG-261021-05). The analogs are the two sites that claim a check for `escalated`:**
```ts
// WorkflowBuilderPage.tsx:440-448 gatesFor
  return cause === "detected" || cause === "escalated"
    ? [{ label: GOVERNANCE_GATE_ROW_LABEL, locked: true }] : []
// canvasModel.ts:382-384 isGrounded
  return groundingCauseOf(phase, kbTools) !== null
```
Narrow both to `=== "detected"`. Do the same for `GovernanceSection.tsx:~367` (`governance-attached`), the `NodeCornerMarks.tsx` seal and the `definitionOps.ts` copy. `GovernanceSection.tsx:56-62` already documents the same trap for `llm_single`, so copy its wording. `teamModel.ts:253` already matches the engine.
- Tests: `GovernanceSection.test.tsx`, `canvasModel.test.ts:501-513`, `definitionOps.test.ts:629-657`, `SeedReceipt.test.tsx`.
- ⚠ `GovernanceSection.tsx`, `NodeCornerMarks.tsx` and `definitionOps.ts` have **no ledger row** (D-26). Add the row and section in the first commit that touches each.

**D-08 typed stand-ins (291-S6-F7). In-place analog:** `publish_service.py:1635-1656`
```python
    golden_inputs: dict[str, str] = {"kickoff_prompt": golden_input}
    for _spec in getattr(definition, "inputs", None) or []:
        ...
            golden_inputs[_key] = (
                f"golden-run-placeholder-{_key}@example.invalid"
                if _is_addr
                else f"golden run placeholder for {_key}"
            )
```
- Keep the same loop and the address arm. RFC 2606 `.invalid` is load-bearing (`:1630-1634`). Branch on `_spec.type`: `enum` → first non-blank `enum_options`, `date` → a fixed ISO date, `number` → `"1"`, `text` → a short realistic string.
- ⚠ The comment at `:1645` ("`InputFieldSpec.type` is `\"text\"` for every field today") is now stale, because 291 added `date`/`number`/`enum`. Update it in the same edit.
- Collect the stand-in keys for the gauntlet sentence (UI-SPEC E S6-F7).
- Tests: `tests/unit/test_291_form_inputs_overlay.py`, `test_291_pdf_fill_driver.py`.

---

### P13. One end-of-run reconcile in the follow terminal wrapper (BUG-261021-04 / -03). W4: `StreamsProvider.tsx`

**Target wrapper:** `frontend/src/providers/StreamsProvider.tsx:1888-1906`
```tsx
      const originalOnTerminal = callbacks.onTerminal
      callbacks.onTerminal = (kind, errorPayload) => {
        callbacks.flushDeltas()
        subscriptionsRef.current.delete(producerRunId)
        useStreamsStore.setState((s) => ({ subscriptionsByThread: _removeRunFromThread(...) }))
        originalOnTerminal(kind, errorPayload)
        // 295-10 (D-r1-02): ... One read so the panel and the recorded run status match the server
        refreshPhaseSpineAfterStop(threadId)
      }
```
**Analog for the read to add (the thread-switch reconcile):** `StreamsProvider.tsx:2107-2113`
```tsx
          if (threadId !== null) {
            useStreamsStore
              .getState()
              .actions.reconcile(threadId)
              .catch((err) => {
                console.error("[StreamsProvider] reconcile from setViewingThread failed", err)
              })
```
- **Sibling precedent, a terminal that re-reads the persisted answer:** the continuation path at `:2011-2018` (`if (kind === "done") { getMessages(threadId).then(...) }`).
- The fix is one guarded call after `refreshPhaseSpineAfterStop(threadId)`, gated on `viewedThreadId === threadId`.
- **Test to extend:** `frontend/src/__tests__/providers/streamsProvider_295_10_follow_after_answer.test.tsx:275-300`. That test drives `streams.get(NEW_PRODUCER)!.onTerminal?.("done")` under `act` and counts `mockGetThreadWorkflow` calls. Add the same assertion for `mockGetMessages` (mocked at `:60-63`), and check that the bucket holds the persisted harness answer and that the phases carry `unsourced`.
- RED decides -03's cause (i) vs (ii) (RESEARCH F4).

---

### P14. The sentence lives in a vocabulary file; the component never spells it. W4 / W3 (all UV copy rows)

**Analog:** `frontend/src/components/workflows/evidenceVocabulary.ts:48-49` (the 289-IN-06 target itself)
```ts
export const NO_MATCH_EXPLANATION =
  "The knowledge base returned nothing for this step — its output is not drawn from your documents."
```
- Each new sentence in UI-SPEC is an exported `const` in the surface's vocabulary file. The homes are:
  - `evidenceVocabulary.ts`: `DOWNLOAD_UNAVAILABLE`
  - `composerCopy.ts`: the start-failure lines
  - `citationVerdicts.ts`: `rate_limited`
  - `rerankEngines.ts`: `latencyNote`, unknown engine
  - `phaseVocabulary.ts`: `STEP_UNTYPED`
  - `declaredInputsVocabulary.ts` and `describeRefusalVocabulary.ts`: the describe-door copy
- The `requiredFieldsMessage` label fallback (287-IN-02) is `soulData.ts:232-237`. Change `f.label ?? f.key` to `f.label?.trim() || f.key`. That is a W3 edit; W4 consumes it.
- **Renderer swap (289-F-B):** import `MarkdownRenderer` the way `components/chat/ToolCallDetails.tsx:15` does (`import { MarkdownRenderer } from "./MarkdownRenderer"`, so `"../chat/MarkdownRenderer"` from `workflows/`). No second renderer.
- **Header wrap (BUG-261025-02):** `RunEvidenceReport.tsx:173-201`. The title column is `<div className="min-w-0 flex-1">` (`:174`) and becomes `min-w-0 basis-80 grow` per UI-SPEC A. The action group is `:201` `flex flex-wrap items-center gap-1.5 print:hidden`. Measure at 1536px first (D-02).
- **In-thread start failure (287-WR-02/IN-03):** `useStartWorkflowInThread.ts:50-66`. Today `void sendMessage(threadId, \`Run ${def.name}\`, ...).finally(...)` has no `.catch`. The hook owns failure state + Retry and returns it alongside `{ open, workflows, ..., cancelForm }` (`:84`). Test: `components/chat/__tests__/useStartWorkflowInThread.test.tsx`.
- **Tests:**
  - `components/workflows/RunEvidenceReport.test.tsx` (it lives in `workflows/`, not `workflows/__tests__/`)
  - `components/workflows/__tests__/WorkflowScheduleModal.test.tsx`
  - `components/workflows/GovernanceSection.test.tsx`

---

## Shared Patterns

### G-5 ledger touch (every FIRING file; D-16, D-26)
**Source:** `docs/HOT-FILE-LEDGER.md`. A scan-list row looks like `:12023` (`frontend/nginx.conf`, a row added for a file absent its whole life), and its section starts at `:24903`.
```
| [`frontend/nginx.conf`](docs/HOT-FILE-LEDGER.md#frontendnginxconf) | 3 / 3 / 76 (was absent) | ⚠ **FIRES** | ⚠ absent its ENTIRE LIFE — row added 293-REVIEW WR-01 (one `X-Forwarded-Prefix /api` header). Phases 157, 276, 293. ⛔ /api/ prefix strip |
```
- The section structure is: the triple with its derivation date and phases, then **What it is**, then **The invariants it carries**, then **The named seam, when it comes**. A re-derived section for an existing row (`run_reconciler.py`, `:16691-16697`) moves the old cells verbatim under `Scan-list cell as of … (moved verbatim)`.
- Disposition cell ≤ 200 chars (docs) and ≤ 80 chars (CLAUDE.md FIRING table).
- **Apply to:** every file in RESEARCH's G-5 Map, in the same commit as the code. Six files need a **new** row: `api/schedules.py`, `tools/render_template.py`, `sub_agent_models.py`, `definitionOps.ts`, `GovernanceSection.tsx`, `NodeCornerMarks.tsx`.
- Gate: `node scripts/check-hot-file-ledger.cjs .planning/phases/296-close-v4-7-debt`.

### RED-first regression test per area (D-19)
| Area | Extend (exists, verified) | DB? |
|---|---|---|
| Org stamping | `backend/tests/unit/test_268_send_path_stamp.py`, `tests/unit/test_103_draft_crud.py`, `tests/integration/test_268_two_org_rows.py` | integration YES |
| Evidence withhold | `backend/tests/unit/test_289_run_evidence.py` | no |
| Rate limit | `backend/tests/unit/test_293_rate_limit.py`, `test_294_citation_check_route.py` | no |
| Boot sweep / re-drive | `backend/tests/test_harness_resume.py`, `tests/unit/test_289_redrive_failure.py`, `tests/test_run_reconciler.py`, `tests/unit/test_295_truthful_run_ends.py` | some YES |
| Moonshot schema | `backend/tests/unit/test_151_cross_provider_schema.py` (pattern) | no |
| First-step turn | `backend/tests/test_dual_mode_wiring.py` | no |
| Golden inputs | `backend/tests/unit/test_291_form_inputs_overlay.py` | no |
| Migration text | `backend/tests/unit/test_294_migration_211_shape.py` (pattern) | no |
| Follow terminal | `frontend/src/__tests__/providers/streamsProvider_295_10_follow_after_answer.test.tsx` | no |
| Report / schedule / start hook / governance | `RunEvidenceReport.test.tsx`, `__tests__/WorkflowScheduleModal.test.tsx`, `chat/__tests__/useStartWorkflowInThread.test.tsx`, `GovernanceSection.test.tsx`, `pages/WorkflowBuilderPage.canvas.test.tsx` | no |

### Records (W5)
- **Bug close:** frontmatter `status: closed`, `verified_closed_by: "296"`, `folded_into: 296`, `re_open_trigger: null`, plus the fixing commit (shape: `.planning/reported-bugs/BUG-261004-01-*.md:1-15`). Did-not-reproduce rows (D-02) close with the RED test named as evidence.
- **Seeds:** new ids from **SEED-375** up (`max(id)+1`; the highest today is SEED-374). Use `.planning/seeds/TEMPLATE.md` frontmatter (`seed_id` = filename, `created`, `surface: Agentic-RAG`, `status`, `trigger_when`, `trigger_paths`, `trigger_surfaces` from the controlled enum). Answered seeds (362, 363, 364) flip `status` + `status_note`. Gate: `node scripts/check-seeds-register.cjs --phase 296`.

### Cross-provider / boundary rule
Provider-specific handling stays at the adapter (`openai_compat.py`, keyed on the endpoint provider) and never in a shared schema (P10). The rows that touch a provider (BUG-261024-01, 292.1-IN-01/02, S6-F8, 293-F-4) need the D-21 roster with ⛔ rows recorded.

## No Analog Found

| File | Role | Data flow | Reason / what to use instead |
|---|---|---|---|
| `backend/app/services/provider_gateway/schema_moonshot.py` (new) | provider leaf | transform | No `$ref` inliner exists in the repo. Copy the *shape* of `_sanitize_schema_for_google` (P10) and the inliner body from RESEARCH Code Examples. Do not add `jsonref`. |
| `supabase/migrations/216_neutral_default_org_name.sql` (new) | migration | DDL | No recent migration replaces `handle_new_user`. Use the 214 header style and the supplement body (P3). |

## Metadata

**Analog search scope:** `backend/app/{api,services,db,services/harness,services/provider_gateway}`, `backend/tests/{unit,integration,.}`, `frontend/src/{providers,components/workflows,components/chat,pages}`, `supabase/migrations`, `scripts/full-schema-supplement.sql`, `docs/HOT-FILE-LEDGER.md`, `.planning/seeds/TEMPLATE.md`, `.planning/reported-bugs/`
**Files scanned:** ~35 read or grepped
**Pattern extraction date:** 2026-10-26
**Corrections to RESEARCH surfaced here:**
1. P4: the citation-check 429 should use the dict `{"reason": "rate_limited"}` detail, matching the route's other refusals and UI-SPEC D, not the English string in RESEARCH's example.
2. P6: the human-input arm must sit after `_load_run_definition` (step 3), not at the dead branch's current position.
3. P7: `tests/conftest.py` has no `pytest_configure` yet, and `tests/unit` has no own conftest.
4. P12: the `publish_service.py:1645` comment saying "type is text for every field today" is stale.
