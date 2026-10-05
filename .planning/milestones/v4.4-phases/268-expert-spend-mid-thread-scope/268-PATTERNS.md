# Phase 268: Expert Spend & Mid-Thread Scope - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 44 (24 modified, 20 created, including tests)
**Analogs found:** 42 / 44. Two files have only a partial analog (the roll-up SQL shape and the `ScopePicker` tree).

Line numbers were read on `develop` at `5240711b1`. Hot files move daily, so re-check a line number before any
`old_string` edit.

---

## File Classification

### Plan 1: attribution at insert, explicit org, continuation tokens, roll-up SQL

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/197_runs_expert_attribution.sql` (new) | migration | DDL | `supabase/migrations/182_workflow_runs_token_totals.sql` | exact (ADD COLUMN + COMMENT ON COLUMN on a metering table) |
| `backend/app/db/runs.py` (mod) | db writer | CRUD (asyncpg, service-role) | itself: `insert_run` :39-79, `insert_assistant_message` :179-226, `load_cap_paused_tool_calls` :125-176 (org-aware arm) | exact |
| `backend/app/services/run_lifecycle.py` (mod) | service | request-response | itself: `register_run_start` :258-295 | exact |
| `backend/app/api/threads.py` `send_message` (mod) | controller | request-response | itself :1364-1504 (the active-org stamp at :1364, the `register_run_start` call at :1495) | exact |
| `backend/app/services/run_producer.py` (mod) | service | event-driven (detached producer) | itself :559-747 (Deep branch), :841-967 (continuation); accumulation idiom from `harness/phase_types.py:768-790` | exact |
| `backend/app/services/agent_loop.py` (mod, 4 org stamps) | service | CRUD (message inserts) | itself :389-400 (carrier), :1959-1970 (assistant), :2001-2009 (system warnings) | exact |
| `backend/app/db/rates.py` (mod) | db reader | aggregation / batch | itself :341-688 (`get_org_spend_summary`, `get_spend_runs`) + `pricing_service.cost_usd_sql` :27-52 | role-match (the CTE shape is new) |
| `backend/tests/unit/test_268_insert_run_sites.py` (new) | test (fence) | static AST | `backend/tests/unit/test_256_judge_usage_counted.py:732-826` + `test_264_born_for_carrier.py:54-73` (AST helpers) | exact |
| `backend/tests/unit/test_268_insert_run_stamp.py` (new) | test | unit (mock pool) | `backend/tests/unit/test_db_runs.py` (3 inherited reds, do not add a 4th) | role-match |
| `backend/tests/unit/test_268_send_path_stamp.py` (new) | test | unit | `test_267_expert_changed_event.py:196-295` patch harness (`patch.object(threads_mod, …)`) | role-match |
| `backend/tests/unit/test_268_continuation_tokens.py` (new) | test | unit (two-segment RED-first) | `test_256_producer_shells.py` / `test_256_producer_shell_site3.py` | role-match |
| `backend/tests/unit/test_268_spend_rollup.py` (new, includes the placeholder-root fence) | test | unit (SQL shape) + AST fence | `test_257_rates_db.py`, `test_257_single_token_conversion_home.py:187-194` | role-match |
| `backend/tests/integration/test_268_two_org_rows.py` (new) | test | integration (real PG + RLS) | `backend/tests/integration/test_267_transcript_rows_rls.py:68-207` | exact |
| `backend/tests/integration/test_268_spend_rollup_pg.py` (new) | test | integration | `test_257_single_token_conversion_home.py:223-244` (the real-PG spelling-agreement test) | partial |

### Plan 2: the spend API and the cockpit

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/api/admin_spend.py` (mod) | controller | request-response | itself :84-150 | exact |
| `backend/tests/unit/test_268_admin_spend_expert.py` (new) | test | unit (TestClient) | `backend/tests/unit/test_257_admin_spend_api.py:36-90` | exact |
| `frontend/src/lib/api/spend.ts` (mod) | api client | request-response | itself :17-130 | exact |
| `frontend/src/types/spend.ts` (mod) | types | n/a | itself :28-66 | exact |
| `frontend/src/pages/admin/AdminSpendPage.tsx` (mod) | page | request-response | itself :108-231 (`loadAll` / `goToLedgerOffset`), :341-389 (ribbon) | exact |
| `frontend/src/components/admin/spend/ExpertFilterPills.tsx` (new) | component | presentational | the ribbon pill groups `AdminSpendPage.tsx:343-389` | role-match |
| `frontend/src/components/admin/spend/ExpertSpendCard.tsx` (new, includes `LedgerExpertCell`) | component | presentational | `BlindSpotsCard.tsx` (card shell + honesty prose) + `ScopeLedger.tsx` (paired-hue leaf) | role-match |
| `frontend/src/components/admin/spend/AttributionDisclosures.tsx` (new) | component | presentational | `BlindSpotsCard.tsx:150-190` tile grid | exact |
| `frontend/src/components/admin/spend/expertSpendCopy.ts` (new) | copy module | n/a | `frontend/src/components/chat/expertEventCopy.ts:47-68` (`EVENT_COPY`) | exact |
| `frontend/src/components/admin/spend/BlindSpotsCard.tsx` (mod) | component | presentational | itself :150 (grid class) | exact |
| `frontend/src/pages/admin/AdminSpendPage.test.tsx` (extend) + new `src/components/admin/spend/__tests__/*.test.tsx` | test | vitest | `AdminSpendPage.test.tsx:1-70, 242-277` | exact |

### Plan 3: the scope PATCH, the event, the chip and picker, and the audit key

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/models/thread.py` (mod) | model | n/a | itself :18-21 (`ThreadUpdate`), :33-60 (`ExpertScopePreview`) | exact |
| `backend/app/models/message.py` (mod) | model | n/a | itself :46 (`TRANSCRIPT_EVENT_KINDS`), :174-212 (ref models, `ExpertChangedEvent`) | exact |
| `backend/app/services/expert_scope.py` (mod) | service (pure builders) | transform | itself :346-400 (`build_expert_changed_event`, `event_sentence`), :403-420 (`scope_preview`) | exact |
| `backend/app/api/threads.py` `rename_thread` + new scope-effect route (mod) | controller | request-response + transactional write | itself :891-1067 (`_expert_changed_event`, `_write_expert_change`, `rename_thread`), :790-839 (`get_expert_scope_preview`) | exact |
| `backend/app/services/tool_dispatcher.py` (mod) | service | event-driven (fire-and-forget audit) | itself :946-955 | exact |
| `backend/tests/unit/test_268_scope_patch.py` (new) | test | unit | `backend/tests/unit/test_267_expert_changed_event.py:196-330` | exact |
| `backend/tests/unit/test_268_scope_effect.py` (new) | test | unit (pure) | `test_267_expert_changed_event.py:57-190` + `test_267_scope_preview.py` fakes | exact |
| `backend/tests/unit/test_268_search_audit_keys.py` (new) | test | unit | `tool_dispatcher` search tests (the RAG-09 `ctx.spawn` stub shape) | role-match |
| `backend/tests/fixtures/phase268/scope_changed*.json` (new) | fixture | n/a | `backend/tests/fixtures/phase267/expert_changed.json` | exact |
| `frontend/src/lib/api/threads.ts` (mod) | api client | request-response | itself :212-224 (`setThreadActiveExpert`) + `lib/api/experts.ts:259-280` (`getExpertScopePreview`) | exact |
| `frontend/src/components/chat/expertEventCopy.ts` (mod) | copy module | transform | itself :35-38, :76-83, :149-174 | exact |
| `frontend/src/components/chat/ExpertEventCard.tsx` (mod) | component | presentational | itself :38-82 (`Shell`), :125-148 (`ChangedCard`), :195-198 (dispatch) | exact |
| `frontend/src/components/chat/scopeCopy.ts` (new) | copy module | n/a | `expertEventCopy.ts:47-68` | exact |
| `frontend/src/components/chat/ScopeChip.tsx` (new) | component | presentational + menu trigger | `ActiveExpertChip.tsx` (container class) + `layout/AttentionPopover.tsx:71-80` (Radix trigger `asChild`) | exact |
| `frontend/src/components/chat/ScopePicker.tsx` (new) | component | request-response (preview) | `layout/AttentionPopover.tsx` + `layout/ProfileMenu.tsx:140-179` (Check glyph, `onSelect` + `preventDefault`) + `experts/ScopeLedger.tsx` | partial (no existing radio-item tree) |
| `frontend/src/components/chat/ActiveExpertChip.tsx` (mod, class strings only) | component | presentational | `ExpertEventCard.tsx:70` paired violet steps | exact |
| `frontend/src/components/experts/ScopeLedger.tsx` (mod, `held` tone) | component | presentational | itself :56-60 | exact |
| `frontend/src/components/chat/MessageInput.tsx` (mod) | component | presentational | itself :452 (`showChipsRow`), :509-541 (chip row) | exact |
| `frontend/src/components/chat/ChatArea.tsx` (mod) | container | request-response | itself :515-550 (`applyExpertChange`), :826-854 (header pill, removed) | exact |
| `frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx` (extend) | test (fence) | static + rendered | itself | exact |
| `frontend/src/components/chat/__tests__/{ScopeChip,ScopePicker,scopeCopy,ChatArea.scopeChange}.test.tsx` (new) | test | vitest | `ChatArea.expertThread.test.tsx:1-90`, `expertEventCopy.test.ts:1-50` | exact |
| `scripts/vitest-count-gate.cjs` (mod) | gate config | n/a | itself: BASELINE :193 / :261, TARGETS :4503-4537 | exact |
| `docs/HOT-FILE-LEDGER.md` + CLAUDE.md scan-list rows (mod) | docs / registry | n/a | `docs/HOT-FILE-LEDGER.md:17053-17134` (267 sections) | exact |

### Files that must NOT change

- `backend/app/services/retrieval_service.py`. D-268-14: when no plan lists it, record "G-5 not fired: file unmodified;
  SEED-224 extraction stays owed".
- `frontend/src/components/chat/MessageItem.tsx`. UI-SPEC R3: its one early return at `:332-341` already routes every
  allowlisted kind to `ExpertEventCard`.
- `task_service.py`, `runs.py`, `harness_engine.py`, `publish_service.py` and `evals.py` need no call-site edits. The SQL
  inside `insert_run` does the parent copy, and the defaults give `(NULL, true)`. The fence (below) records each site's
  disposition.

---

## Pattern Assignments

### `supabase/migrations/197_runs_expert_attribution.sql` (migration)

**Analog:** `supabase/migrations/182_workflow_runs_token_totals.sql`. It adds columns to a metering table, with a WHY
header, `COMMENT ON COLUMN` prose, and no backfill.

**Header convention** (182:1-34; the 196 header uses the same shape):
```sql
-- Migration 182 — Phase 256 (METER-03 / D-256-01 / ...)
-- workflow_runs token totals + the coverage marker.
--
-- WHY ALL THREE COLUMNS ARE NULLABLE, AND WHY THAT IS NOT LAZINESS.
--   ...
-- WHY THERE IS NO BACKFILL HERE.
--   A schema change must not do data work. ...
-- NOTE: no COMMIT inside a PROCEDURE/DO block — migrations 105 and 107 could not be pasted into
-- the Supabase SQL editor for exactly that reason.
```

**Column + comment pattern** (182:36-50):
```sql
ALTER TABLE public.workflow_runs
    ADD COLUMN IF NOT EXISTS input_tokens   integer,
    ADD COLUMN IF NOT EXISTS output_tokens  integer,
    ADD COLUMN IF NOT EXISTS token_coverage text[];

COMMENT ON COLUMN public.workflow_runs.input_tokens IS
    'Phase 256 (METER-03). ... '
    'the last segment''s spend ...';   -- '' escapes; adjacent literals concatenate
```

**No-FK precedent to contrast:** `188_expert_chat_scoping.sql:7-8` gives `threads.active_expert_id` an FK
`REFERENCES public.expert_bundles(id) ON DELETE SET NULL`. D-268-04 forbids that on `runs.expert_id`, because SET NULL would
turn a deleted Expert's runs into "No Expert". Name this contrast in the header.

**Apply discipline** (196:22-23): `-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER supabase db push / db reset. Idempotent: safe to paste twice.`
Use `BEGIN; … COMMIT;` only if there is no DO block (196:26/38). The research shape at RESEARCH:737-745 is the body.
Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`).

---

### `backend/app/db/runs.py` (db writer, CRUD)

**Analog:** the file itself. It **has no hot-file ledger row and FIRES** (8/7/226). Add its row and its section to
`docs/HOT-FILE-LEDGER.md` **in the same commit** as the first edit (D-268-25).

**Module-doc constraint to update** (runs.py:19-30). The doc claims that writes "OMIT org_id → the mig-106 BEFORE-INSERT
autofill triggers … stamp it". Phase 268 makes that false for the send path, so correct the docblock beside the
original, following the project's correction convention.

**Current INSERT** (runs.py:65-79). Keep `$N` placeholders only (T-073-02, runs.py:15-17):
```python
    await pool.execute(
        """
        INSERT INTO runs (run_id, thread_id, user_id, status, model, provider,
                          spawned_by_worker, parent_run_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        run_id, thread_id, user_id, status, model, provider, spawned_by_worker, parent_run_id,
    )
```

**Target shape** (RESEARCH §Q2 :234-244). Add two new kwargs, `org_id: UUID | None = None` and
`expert_id: UUID | None = None`. `expert_attributed` is always `true` in SQL, and the parent copy is done in SQL:
```sql
INSERT INTO runs (run_id, thread_id, user_id, status, model, provider,
                  spawned_by_worker, parent_run_id, org_id, expert_id, expert_attributed)
SELECT $1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE(p.org_id, $9::uuid),
       CASE WHEN $8::uuid IS NULL THEN $10::uuid ELSE p.expert_id END,
       CASE WHEN $8::uuid IS NULL THEN true ELSE COALESCE(p.expert_attributed, true) END
FROM (SELECT 1) one
LEFT JOIN public.runs p ON p.run_id = $8::uuid
```
When `$9` is NULL and there is no parent, the mig-106 trigger still fills `org_id`, so single-org rows are unchanged.

**The org-aware optional-arg idiom to mirror in `insert_assistant_message`** (runs.py:147-160). This file already has a
"None = byte-identical, else add the org predicate" precedent:
```python
    if org_id is not None:
        row = await pool.fetchrow("""... AND org_id = $2 ...""", thread_id, org_id)
    else:
        row = await pool.fetchrow("""...""", thread_id)
```
For `insert_assistant_message` (runs.py:205-226), add `org_id: UUID | None = None`. Either branch like this, or append
`org_id` as `$11` and let `NULL` fall to the trigger. The trigger short-circuits only on `NEW.org_id IS NOT NULL`
(`106_org_id_autofill_trigger.sql:86-101`), so passing NULL explicitly still gets the trigger's value. That makes the
single-SQL form safe.

⚠ `tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally` and the two `insert_assistant_message` shape
tests are **already among the inherited 71 failures**. The edit may turn them green (the count may fall) but must not
add a new red.

---

### `backend/app/services/run_lifecycle.py` `register_run_start` (service)

**Analog:** itself, :258-295. Forward exactly two kwargs and change nothing else (ledger row: "`register_run_start`
forwards 2 kwargs; nothing else"):
```python
async def register_run_start(
    *, pool, redis, run_id, thread_id, user_id, model, provider,
    spawned_by_worker=None, parent_run_id=None, status: str = "streaming",
    # + org_id=None, expert_id=None
) -> None:
    await insert_run(
        pool, run_id=run_id, thread_id=thread_id, user_id=user_id, status=status,
        model=model, provider=provider, spawned_by_worker=spawned_by_worker,
        parent_run_id=parent_run_id,
        # + org_id=org_id, expert_id=expert_id
    )
```

---

### `backend/app/api/threads.py` `send_message` (controller: resolve once, stamp at insert)

**Analog:** itself.

**The validated org is already computed** (threads.py:1364-1366). Reuse it and never look it up again:
```python
    active_org_id = await resolve_active_org_or_none(request, current_user)
    if active_org_id:
        current_user = {**current_user, "org_id": active_org_id}
```

**User-message insert to stamp** (threads.py:1413-1426). This is the conditional-key idiom already used for
`active_connector_ids`:
```python
    _user_msg_row = {"thread_id": thread_id, "user_id": current_user["id"], "role": "user", "content": body.content}
    if body.active_connector_ids is not None:
        _user_msg_row["active_connector_ids"] = [str(c) for c in body.active_connector_ids]
    # + if active_org_id: _user_msg_row["org_id"] = active_org_id
```

**Thread insert to stamp** (`create_thread`, threads.py:761-770). The `org_id` key is already set only on the Expert
arm; extend it to "when an active org validated":
```python
    insert_data: dict = {"user_id": current_user["id"], "title": body.title}
    ...
        insert_data["org_id"] = _org_id
```

**Run insert** (threads.py:1495-1504). Add `org_id=` and `expert_id=`. Per D-268-19, resolve
`_scoping = await _resolve_thread_scoping(...)` **before** this call, only when `_kickoff_definition is None`. Keep the
exception as `scoping_error` and hand both to `run_producer`. Import `_resolve_thread_scoping` late from
`app.services.run_producer`; the cycle is already broken that way.
```python
        await register_run_start(
            pool=await get_pg_pool(), redis=redis, run_id=run_id,
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            user_id=UUID(current_user["id"]) if isinstance(current_user["id"], str) else current_user["id"],
            model=_resolved_model, provider=_resolved_provider,
            spawned_by_worker=str(os.getpid()),
            # + org_id=active_org_id, expert_id=(_scoping.born_for_bundle_id if _scoping else None)
        )
```
⛔ Add no new branch in the send path beyond `if _kickoff_definition is None` (ledger constraint). The existing test
`test_chat_active_org.py:120-135` pins the stamping order.

---

### `backend/app/services/run_producer.py` (service, detached producer)

**Analog:** itself.

**Deep branch to parameterize** (run_producer.py:709-739). Add `scoping=None, scoping_error=None` to the
`run_producer` signature (:559-573). Use the passed object and fall back to resolving only when it is None, so every
existing test's call shape still works. Re-raise `scoping_error` **inside** the existing `try` at :643, so
`except Exception` at :786 writes the identical `failed: ExpertScopeUnavailable: …`:
```python
            else:                                          # Deep — byte-identical
                _wf_pool = await get_pg_pool()
                _scoping = await _resolve_thread_scoping(
                    supabase=supabase, thread_id=thread_id, current_user=current_user, pool=_wf_pool,
                )
                ctx = RunContext(
                    ...
                    born_for_bundle_id=_scoping.born_for_bundle_id,   # keep: 1 of exactly 2
                )
```
⛔ `test_264_born_for_carrier.py:154-165` counts `born_for_bundle_id=` keywords by AST and requires **exactly 2**. Passing
`scoping=` and reading `.born_for_bundle_id` as an attribute is safe. A third keyword is a new red.

**Continuation token accumulation** (D-268-20; `spawn_continuation_run` :841-967). The loop fills `_result_sink`
(:872). Before `_finalize_producer_run` (:945), read the row's prior totals and **add** them. Copy the accumulation
semantics from `harness/phase_types.py:768-790` (`_record_run_usage`), where None adds nothing:
```python
    if input_tokens:
        box["input_tokens"] = (box.get("input_tokens") or 0) + int(input_tokens)
    if output_tokens:
        box["output_tokens"] = (box.get("output_tokens") or 0) + int(output_tokens)
```
The sink keys `_finalize_producer_run` reads are `input_tokens_total` / `output_tokens_total` (run_producer.py:109-110).
The rule is NULL+NULL → NULL, and otherwise None counts as 0 (D-256-06). ⛔ Do not edit `finalize_run`'s SQL
(`db/runs.py:104-122`); that trips SEED-297 trigger (a). Read the prior totals through the same pool
(`get_pg_pool`, already imported late at :867), with `SELECT input_tokens, output_tokens FROM runs WHERE run_id = $1`.

---

### `backend/app/services/agent_loop.py` (4 org stamps, 0 branches)

**Analog:** itself. ⛔ It is AST-fenced against any Name, Attribute or def containing `expert`
(`test_264_born_for_carrier.py:215-230`). `org_id` is safe.

| Site | Lines | Edit |
|---|---|---|
| cap-paused carrier (Pitfall 3, **mandatory**) | :389-400 `supabase.table("messages").insert({...})` | add `"org_id"` when `current_user.get("org_id")` is set. `persist_cap_paused` receives `user_id`, not `current_user`, so thread the org in as one kwarg |
| assistant message | :1959-1970 `insert_assistant_message(...)` | `org_id=current_user.get("org_id")` |
| system warnings | :2001-2009 | the same conditional key |

Carrier dict to extend (agent_loop.py:390-399):
```python
            supabase.table("messages").insert({
                "thread_id": thread_id, "user_id": user_id, "role": "system",
                "content": (...), "tool_calls": carrier,
            })
```
Proof: `load_cap_paused_tool_calls(pool, thread, org_id=<run's org>)` (db/runs.py:147-160) must find the carrier in the
two-org integration test.

---

### `backend/app/db/rates.py` (db reader, aggregation)

**Analog:** itself (`get_org_spend_summary` :341-558, `get_spend_runs` :561-688) plus `pricing_service.cost_usd_sql`.

**Import and the one USD spelling** (rates.py:16, :20):
```python
from app.services.pricing_service import ModelRate, compute_token_cost_usd, cost_usd_sql
_COST_USD_SQL = cost_usd_sql()
```
`cost_usd_sql(runs_alias, rate_alias)` (pricing_service.py:27-52) takes aliases, so write `cost_usd_sql("m", "rate")`
for the member rows. ⛔ `test_257_single_token_conversion_home.py:187` fails on any `_cost_per_million / <digit>`
outside `pricing_service.py`.

**The rate LATERAL to reuse verbatim** (rates.py:372-384). Change only the org source to the **root's** org
(`mr.org_id = m.root_org_id`), because a pre-268 sub-agent row may carry the trigger's org (Pitfall 7):
```sql
            LEFT JOIN LATERAL (
                SELECT mr.input_cost_per_million, mr.output_cost_per_million
                FROM public.model_rates mr
                WHERE mr.model_id = r.model
                  AND (mr.org_id = r.org_id OR mr.org_id IS NULL)
                  AND (mr.provider = r.provider OR mr.provider IS NULL)
                  AND mr.effective_from <= r.started_at
                ORDER BY (mr.org_id IS NOT NULL) DESC,
                  (mr.provider IS NOT NULL AND mr.provider = r.provider) DESC,
                  mr.effective_from DESC
                LIMIT 1
            ) rate ON true
```
This block appears four times today (:372, :436, :490, :584). The new `roots → members → priced → per_root` CTE
(RESEARCH §Q4 :324-365) should be one module-level string that all four queries include. That makes
`breakdown`, `window_total_usd` and `window_run_count` come from one CTE (D-268-21, Pitfall 6).

**CR-06 counter vocabulary to keep** (rates.py:392-401). Rated means a rate exists; unmeasured means a rate with no tokens:
```sql
            COUNT(*) FILTER (WHERE input_cost_per_million IS NOT NULL) AS rated_runs_count,
            COUNT(*) FILTER (WHERE input_cost_per_million IS NULL) AS unrated_runs_count,
            COUNT(*) FILTER (WHERE input_cost_per_million IS NOT NULL AND cost_usd IS NULL) AS unmeasured_runs_count,
```

**The LATERAL-not-JOIN lesson for the ledger count** (rates.py:597-614). The count query must carry the **same** root and
Expert predicates as the page query.

**Bound-parameter rule.** The shipped `time_clause` / `status_filter_clause` f-strings (rates.py:574-628) are static
text only. The Expert value is user input and must be `$N` (RESEARCH Code Examples :727-735, the `expert_id::text = $4`
form, Assumption A2).

**Placeholder-root fence (D-268-21).** Three sites write `model="unknown"`: `api/runs.py:1181`,
`harness_engine.py:2803` and `harness/publish_service.py:1629`. The fence pins that set, in the shape of the set
fence at `test_256_judge_usage_counted.py:787-807`.

---

### `backend/tests/unit/test_268_insert_run_sites.py` (disposition fence)

**Analog:** `test_256_judge_usage_counted.py:732-807`.

```python
#: ⚠ EVERY ``forced_emit`` CALL SITE IN ``backend/app``, WITH A DISPOSITION EACH.
#: Asserted as a SET, never as ``len(...) == 10`` ...
_EXPECTED_FORCED_EMIT_SITES: dict[str, str] = {
    "services/embedding_service.py": "NO-RUN",
    ...
}
_FORCED_EMIT_RE = re.compile(r"(?:await\s+forced_emit\s*\(|=\s*forced_emit\s*\()")

def test_every_forced_emit_call_site_carries_a_disposition():
    measured = _measured_forced_emit_files()
    expected = set(_EXPECTED_FORCED_EMIT_SITES)
    assert measured == expected, (
        "the `forced_emit` call-site file SET changed.\n"
        f"  appeared (needs a disposition): {sorted(measured - expected)}\n"
        f"  vanished: {sorted(expected - measured)}\n" ...)
    assert all(_EXPECTED_FORCED_EMIT_SITES.values()), "a blank disposition is not one"
```

⚠ **Alias trap, measured.** `api/runs.py:1140` imports `insert_run as _insert_run` and calls `await _insert_run(` at
:1172. A regex copied from `_FORCED_EMIT_RE` would **miss that site**. Prefer an AST walk that resolves
`ImportFrom(module="app.db.runs")` aliases (the helper style of `test_264_born_for_carrier.py:54-66`), or at minimum
match `\b_?insert_run\s*\(`. Measured call set (grep, 2026-09-28): `api/evals.py:331,1932,2643`, `api/runs.py:1172`,
`services/harness_engine.py:2795`, `services/harness/publish_service.py:1623`, `services/run_lifecycle.py:285`,
`services/task_service.py:553`. Dispositions: `STAMP` (run_lifecycle), `COPY-PARENT(SQL)` (task_service), and
`NO-EXPERT(harness/eval/golden)` for the rest. Key the map by `file:count` so a second call in one file is also caught.
`api/test_fixtures.py:115` inserts via supabase `.insert`, not `insert_run`. Name it in the docstring as out of the
fence's reach.

---

### `backend/tests/integration/test_268_two_org_rows.py` (integration, real PG)

**Analog:** `backend/tests/integration/test_267_transcript_rows_rls.py`. Copy the fixture wholesale.

**Imports and guard** (:26-50):
```python
import pytest
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _drop_user
pytestmark = requires_pg
TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"
```

**Two-org subject fixture** (:68-150). It derives the trigger's pick and never assumes it:
```python
        members = {r["org_id"] for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid)}
        assert len(members) == 2, f"U must belong to exactly two orgs, got {members}"
        org_a = (await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"]
        (org_b,) = members - {org_a}
```
Extend the `finally` cleanup with `DELETE FROM public.runs WHERE user_id = $1` **before** `threads`.

**Control-then-writer shape** (:162-202). First a control row with no org lands in A. Then the real writer (here
`register_run_start` / `insert_run` / `insert_assistant_message` / the carrier insert) with active org B lands in B. Add
the Continue-lookup case (`load_cap_paused_tool_calls(pool, thread, org_id=org_b)` returns the carrier) and a
sub-agent `insert_run(parent_run_id=…)` that reads back the parent's org and `expert_id`.

Run with `-rs`, because a skip is a SKIP. It needs the live DB, so the plan is **serialized** (worktree rule 4).

---

### `backend/app/api/admin_spend.py` (controller)

**Analog:** itself.

**Query-param pattern** (admin_spend.py:84-103, :123-143):
```python
@router.get("/summary")
async def get_spend_summary(
    request: Request,
    org_id: Optional[UUID] = Query(None, description="Organization ID (defaults to active org)"),
    start_time: Optional[datetime] = Query(None, description="Start timestamp filter"),
    end_time: Optional[datetime] = Query(None, description="End timestamp filter"),
    # + expert: Optional[str] = Query(None, pattern=r"^(none|unrecorded|[0-9a-fA-F-]{36})$")  → 422 on garbage
):
    pool = await deps.get_pg_pool()
    target_org_id = await _resolve_operator_org_id(request, org_id, pool)
    summary = await get_org_spend_summary(pool=pool, org_id=target_org_id, start_time=start_time, end_time=end_time)
```
The router inherits `require_operator` (admin_spend.py:1-4). Add no new auth. Response keys are additive:
`expert_breakdown`, `window_total_usd`, `window_run_count`, `unpriced_subagents` (following the dict at :105-120).

**Test analog:** `test_257_admin_spend_api.py:36-90`. It uses `app.dependency_overrides[require_operator]`, patches
`app.api.admin_spend.get_org_spend_summary` with `AsyncMock(return_value=SpendSummary(...))`, and patches
`_resolve_operator_org_id`. Assert that the mock received `expert=` and that a bad value returns 422.

---

### `frontend/src/lib/api/spend.ts` + `frontend/src/types/spend.ts`

**Analog:** itself. Param pattern (spend.ts:17-28, :86-101):
```ts
export async function getSpendSummary(params?: { orgId?: string; startTime?: string; endTime?: string }) {
  const search = new URLSearchParams()
  if (params?.startTime) search.set("start_time", params.startTime)
  // + if (params?.expert) search.set("expert", params.expert)
```
Mapper pattern: snake-to-camel inside `getSpendRuns` (spend.ts:108-124) and the summary return (:71-83). Add
`expertId`, `expertName`, `expertDeleted`, `expertAttributed` and `subagentCount` to the `SpendRunItem`
(types/spend.ts:49-66) mapper. Add `expertBreakdown`, `windowTotalUsd`, `windowRunCount` and `unpricedSubagents` to
`SpendSummaryData`.

---

### `frontend/src/pages/admin/AdminSpendPage.tsx` (page)

**Analog:** itself. **The two-dialects rule is load-bearing.**

**One loader** (AdminSpendPage.tsx:126-137). Add `expert` to both calls **and** to the dependency list:
```tsx
  const loadAll = React.useCallback(async () => {
    return Promise.all([
      getSpendSummary({ startTime: timeRangeToStartTime(timeRange) }),
      getSpendRuns({
        timeRange: timeRange === "all" ? undefined : timeRange,
        filterStatus: coverageFilter === "all" ? undefined : coverageFilter,
        limit: LEDGER_PAGE_SIZE,
        offset: ledgerOffsetRef.current,
      }),
      getModelRates(),
    ] as const)
  }, [timeRange, coverageFilter])
```
**The paging door** (:203-231) is the second call site. It must pass `expert` too, and its dependency list
`[timeRange, coverageFilter]` gains `expertFilter`.

**Ribbon group mount point** (:341-389). Mount `<ExpertFilterPills>` between the Time group (:343-361) and the Coverage
group (:364-389). Pass the shared `filterPillClass` (UI-SPEC §9-D8) to all three groups. The shipped "on" class
`bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold` (:354, :382) is dark-only. The new helper
pairs it for light and dark.

**Test pattern** (AdminSpendPage.test.tsx:12-17, :242-277): `vi.mock("@/lib/api/spend", () => ({ getSpendSummary: vi.fn(), … }))`,
then assert on `vi.mocked(spendApi.getSpendSummary).mock.calls.at(-1)?.[0]`. The D-268-08 test clicks a pill and asserts
that **both** `getSpendSummary` and `getSpendRuns` last-call args carry `expert`, and that KPI, chart, donut and ledger text
all change.

---

### `frontend/src/components/admin/spend/{ExpertFilterPills,ExpertSpendCard,AttributionDisclosures}.tsx`, `expertSpendCopy.ts` (new leaves)

**Analogs:**
- `BlindSpotsCard.tsx`: card shell and honesty prose.
- `BlindSpotsCard.tsx:150`: tile grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4`, which becomes
  `md:grid-cols-2 xl:grid-cols-3` (UI-SPEC §5.8).
- `ScopeLedger.tsx`: a fenced, paired-hue leaf.

**Why the leaves exist.** `AdminSpendPage.tsx` and `BlindSpotsCard.tsx` are dark-only (`text-amber-400`,
`text-emerald-400`, `text-indigo-300`), for example BlindSpotsCard.tsx:85, :91, :104, :118. Every new element lives in a
leaf that joins the `expertThemeContrast` fence (UI-SPEC §4.3 / §9-D9).

**Honesty-arithmetic precedent to copy.** `apportion100` (BlindSpotsCard.tsx:23-47) is exported and has its own test
(`apportion100.test.ts`). Export the reconciliation footer's comparison the same way (integer ten-thousandths,
`Math.round(usd * 1e4)`) and test it directly.

**Copy module:** follow `EVENT_COPY` (expertEventCopy.ts:47-68). It is a `const` object of strings and `(x) => string`
templates `as const`, pinned by a `?raw`-free unit test (UI-SPEC §7).

---

### `backend/app/models/message.py` (model: new kind + payload)

**Analog:** itself.

**The allowlist** (message.py:30-46). Add one member. ⛔ Keep the word "expert" out of any name `agent_loop.py`
imports (message.py:45):
```python
TRANSCRIPT_EVENT_KINDS: frozenset[str] = frozenset({"expert_changed", "expert_handoff"})
# → + "scope_changed"
```
The frontend mirror (`expertEventCopy.ts:35-38`) is cross-pinned by the `?raw` test (`expertEventCopy.test.ts:14`).
Change both in the same commit.

**Event model shape** (message.py:202-212):
```python
class ExpertChangedEvent(BaseModel):
    kind: Literal["expert_changed"] = "expert_changed"
    at: datetime
    before: TranscriptExpertRef | None = None
    after: TranscriptExpertRef | None = None
    now: TranscriptScopeLine
    dropped: TranscriptScopeLine
    excluded: TranscriptExclusion | None = None
```
The new `ScopeChangedEvent`: `kind="scope_changed"`, `at`, `from_folder`, `to_folder`, `expert`, `held`, `now`,
`dropped`, `saved`, `during_run`.

⛔ **Pitfall 11.** Do NOT add `path: str | None = None` to `TranscriptFolderRef` (message.py:180-185). `model_dump`
would then emit `"path": null` on every 267 event and break the byte-equality check at
`test_267_expert_changed_event.py:189-190` (`assert fixture == ev.model_dump(mode="json")`). Use a subclass
(`ScopeFolderRef(TranscriptFolderRef)` with `path`), and drive that 267 test green as proof.

---

### `backend/app/services/expert_scope.py` (pure builders)

**Analog:** itself.

**Builder to extract a shared helper from** (expert_scope.py:346-371). The `dropped` computation moves into a private
pure `_dropped_line(prev, after)`. `build_expert_changed_event` calls it with byte-identical output:
```python
def build_expert_changed_event(before: ScopeStatement, after: ScopeStatement, *, at: datetime) -> ExpertChangedEvent:
    now = after.used()
    prev = before.used()
    dropped = TranscriptScopeLine(
        folders=[f for f in prev.folders if not after.covers(f.id)],
        thread_folder=(prev.thread_folder
            if prev.thread_folder is not None and not after.covers(prev.thread_folder.id) else None),
        all_documents=prev.all_documents and not now.all_documents,
        connections=[c for c in prev.connections if c not in now.connections],
    )
```
**Statement inputs** (`describe_expert_scope`, :247-343). Call it twice, with the thread's active Expert and the before
and after folder. `held` is `after.expert is not None and after.expert.scope_mode == "restricted"`, decided **here**, never
in the frontend (D-267-11).

**Path reuse** (:139-143). `compose_expert_scope(scope_mode="biased", thread_folder_id=X, expert_folder_ids=[], visible_folders=visible).scoped_folder_path`
already yields `/A/B`. Reuse it; do not walk the tree again.

**Sentence for the NOT NULL `content` column.** Mirror `event_sentence` (:386-400) as `scope_event_sentence`, reusing
`_line_items` (:374-383) and the `_ALL_DOCUMENTS` / `_NOTHING` / `_UNNAMEABLE_FOLDER` constants (:164-166).

**Preview mapper.** Mirror `scope_preview` (:403-420). It is a pure `ScopeStatement → wire model` function.

---

### `backend/app/api/threads.py` `rename_thread` scope arm + `_write_scope_change` + scope-effect route

**Analog:** itself. `_write_expert_change` (:927-952) is the template for the writer:
```python
async def _write_expert_change(conn, *, thread_id, user_id, org_id, update_data: dict, event) -> None:
    after = update_data.get("active_expert_id")
    params: list = [UUID(str(thread_id)), UUID(str(user_id)), UUID(str(after)) if after else None]
    sets = ["active_expert_id = $3::uuid"]
    if "title" in update_data:
        params.append(update_data["title"])
        sets.append(f"title = ${len(params)}")
    await conn.execute(
        f"UPDATE public.threads SET {', '.join(sets)} WHERE id = $1::uuid AND user_id = $2::uuid", *params)
    await conn.execute(
        "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
        "VALUES ($1::uuid, $2::uuid, $3::uuid, 'system', $4, $5::jsonb)",
        UUID(str(thread_id)), UUID(str(user_id)), UUID(str(org_id)),
        event_sentence(event),
        [event.model_dump(mode="json")],      # a plain list — the pool's jsonb codec encodes it
    )
```
Either generalize it (`folder_id = $3::uuid`) or write a sibling `_write_scope_change`. Keep the Expert arm's `aexec`
call sequence unchanged. `test_267_expert_changed_event.py` pins `[before-read, message count, update, select]`.

**Arm structure to mirror** (rename_thread :967-1049):
- Clear idiom (:968): `body.clear_active_expert or ("active_expert_id" in body.model_fields_set and body.active_expert_id is None)`.
  The folder arm uses the same test with `clear_folder` / `folder_id`.
- Before-read (:984-993): `.select("active_expert_id, folder_id, org_id") … .maybe_single()`, then 404
  `"Thread not found"`.
- Messages gate (:1013-1015): `_thread_has_messages` (:860-873), following D-268-12b.
- ⛔ No 409 while streaming. D-268-12a is confirmed in RESEARCH §Q1. Call `_thread_has_active_run` (:876-888) **only**
  to compute `during_run`.
- Transaction and literal-detail error (:1031-1049):
```python
    if event is not None:
        try:
            async with get_user_pg_connection(request, current_user) as conn:
                await _write_expert_change(conn, thread_id=thread_id, user_id=current_user["id"],
                                           org_id=thread_org_id, update_data=update_data, event=event)
        except Exception:
            logger.error("expert change on thread %s was not written", thread_id, exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="The Expert was not changed.")
    elif update_data:
        await aexec(supabase.table("threads").update(update_data).eq("id", thread_id).eq("user_id", current_user["id"]))
```
- Reject a body that changes both the Expert and the folder with a 422 (RESEARCH §Q6).

**Folder authorization** (Pitfall 12). Copy the visibility check from `get_expert_scope_preview` (:805-809), then
narrow it to the thread's org (`fetch_visible_folders(..., restrict_org_ids={thread.org_id})` plus the folder row's
`org_id == thread.org_id`):
```python
        from app.utils.folder_utils import fetch_visible_folders  # noqa: PLC0415
        visible = await fetch_visible_folders(supabase, str(current_user["id"]))
        if str(folder_id) not in {str(f.get("id")) for f in visible}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
```
⛔ Do not copy `create_thread`'s unchecked `insert_data["folder_id"] = str(body.folder_id)` (:762-763).

**Scope-effect route.** Copy the order of `get_expert_scope_preview` (:790-839): ownership read, then 404 before
anything else, then the statement, then the pure mapper. Resolve with the run's inputs:
`resolve_active_org_or_none(request, current_user)` + `_caller_roles(request, current_user)` (:711-715) (Pitfall 9).
The path is `/{thread_id}/scope-effect`, so the "declare above `/{thread_id}`" ordering trap (:785-787) does not apply.

**Test analog** (`test_267_expert_changed_event.py:196-330`). Reuse `ThreadsDb`, `FakeConn`, `FakeTxn` and
`_writer_patches` (`patch.object(threads_mod, "aexec", db.aexec)`, `patch.object(threads_mod, "get_user_pg_connection", txn)`,
`patch.object(threads_mod, "resolve_active_org_or_none", …)`). Import them from that module rather than copying them, the
way it imports `scope_patches` from `test_267_scope_preview`. The assertions to mirror are at :304-327: one transaction
entered and committed, two SQL statements, UPDATE first, the INSERT carries the THREAD's org, and `tool_calls[0]["kind"]`.

---

### `backend/app/services/tool_dispatcher.py` (audit metadata, additive)

**Analog:** itself, :946-955:
```python
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",
        metadata={
            "query_text": args["query"],
            "document_ids": _audit_doc_ids,
            "similarities": _sims,
            # + "run_id": str(ctx.run_id), "thread_id": str(ctx.thread_id),
            # + "parent_run_id": ..., "folder_ids": list(ctx.folder_subtree_ids or [])
        },
        supabase=ctx.supabase,
    ))
```
The provider-error arm (:836-851) writes the same action. Add the keys there too, so an outage row also joins to its
run. Readers only `.get()` known keys (RESEARCH §Q7), so adding keys is safe. ⛔ The registry/handler seam is still owed.
Record this change as "honoured by construction: additive keys".

---

### `frontend/src/lib/api/threads.ts` (api client)

**Analog:** `setThreadActiveExpert` (threads.ts:212-224). Copy it for `setThreadFolder`:
```ts
export async function setThreadActiveExpert(threadId: string, expertId: string | null): Promise<Thread> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}`, {
    method: "PATCH", headers, body: JSON.stringify({ active_expert_id: expertId }),
  })
  if (!res.ok) return throwThreadRefusal(res, "Failed to update thread active expert")
  return res.json() as Promise<Thread>
}
```
`throwThreadRefusal` (threads.ts:26-32) keeps the server's `detail`, which the refusal copy renders as `{reason}`.
`getScopeEffect` copies `getExpertScopePreview` (`lib/api/experts.ts:259-280`): it builds `URLSearchParams` and uses the
same refusal-preserving shape. Wire types go beside the 267 transcript types (threads.ts:251+).

---

### `frontend/src/components/chat/expertEventCopy.ts` + `ExpertEventCard.tsx` (third kind)

**Analog:** themselves. The docblock (expertEventCopy.ts:20-21) reserved this: *"Phase 268's folder-scope event
(CHAT-08) adds a KIND and a header here … it never needs a second renderer."*

- Allowlist (expertEventCopy.ts:35-38): add `"scope_changed"`, and widen `TranscriptEvent` (:40).
- `transcriptEventOf` (:76-83): no change. It reads the Set.
- Model: add a `scopeEventModel(event)` beside `eventCardModel` (:149-174) and reuse `scopeLine` (:119-136) for Now /
  Dropped. `threadFolder` (:54-55) gains the `path` fallback (render `/{path} ({n})` when present, else 267's
  `/{name} ({n})`).
- Card (ExpertEventCard.tsx). `Shell`'s `tone: "violet" | "neutral"` (:46) widens with `"scope" | "held"`. Its container
  ternary (:61) becomes a lookup. `data-testid="expert-event-card"` (:56) becomes a prop, so the scope branch renders
  `scope-event-card` and no 267 suite changes its population (UI-SPEC §5.5). Add a `ScopeChangedCard` in the
  `ChangedCard` shape (:125-148), and extend the dispatch at :195-198. The footer line is a **sibling below the grid**
  (`Shell`'s children sit inside the `grid-cols-[auto_1fr]` at :79), so give `Shell` an optional `footer` slot.
- `ScopeValue` (:92-123) is reused unchanged (UI-SPEC §9-D10).

---

### `frontend/src/components/chat/ScopeChip.tsx` (new leaf)

**Analogs:**
- Container class from `ActiveExpertChip.tsx:30` (the family is `text-xs font-medium rounded-md px-2.5 py-1 flex items-center gap-1.5`).
- Trigger shape from `AttentionPopover.tsx:71-80`:
```tsx
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} title={label} data-testid="rail-attention-trigger" className="…" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={8} data-testid="rail-popover" className="w-72">
```
For the chip: `side="top" align="start" sideOffset={8}`, `w-[380px] max-w-[calc(100vw-2rem)] p-3` (UI-SPEC §5.3).
⛔ It must not branch on `scope_mode`. A `?raw` fence over `ScopeChip.tsx`, `ScopePicker.tsx` and the scope branch
asserts zero matches (UI-SPEC §5.1).

### `frontend/src/components/chat/ActiveExpertChip.tsx` (class strings only)

The dark-only classes to pair are `text-violet-200` / `text-violet-100` / `text-violet-400` / `text-violet-300`
(ActiveExpertChip.tsx:30, :34-37, :44). Use the `ExpertEventCard.tsx:70` form
(`text-violet-700 dark:text-violet-200`) and add the file to the fence's `FILES`.

---

### `frontend/src/components/chat/ScopePicker.tsx` (new leaf; partial analog)

**Analogs:**
- `AttentionPopover.tsx` for the primitive. Its docblock (:28-33) records the "no popover package" ruling (T-235-SC)
  that UI-SPEC §9-D1 relies on.
- `ProfileMenu.tsx:166-172`: `onSelect` + `preventDefault` keeps the menu open (Apply in flight; selecting a tree node):
```tsx
        <DropdownMenuItem className="gap-2" onSelect={(e) => { e.preventDefault(); onToggleTheme() }}>
```
- `ProfileMenu.tsx:155`: the selected-item `Check` glyph (`{isActive && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}`).
- `ScopeLedger` (`experts/ScopeLedger.tsx:103-115`) renders the ledger. Add a `"held"` tone beside `yes` / `no`
  (:56-60).

⚠ `DropdownMenuRadioItem` / `DropdownMenuRadioGroup` are exported by `components/ui/dropdown-menu.tsx`, but **no
component uses them yet**, so the tree has no in-repo precedent. ⚠ Radix Menu traps Tab (UI-SPEC §8.4), so Apply and
Cancel must be menu items. `AttentionPopover.tsx:98-105` uses a plain `<button>` inside the content, and **that pattern
is wrong here**.

---

### `frontend/src/components/chat/MessageInput.tsx` (chip-row slot)

**Analog:** itself.
- `showChipsRow` (:452): `pendingAttachments.length > 0 || armedConnectors.length > 0 || activeExpert != null`. Widen it by
  `|| scopeSlot != null`.
- The "Using:" condition (:515) widens the same way.
- Mount the slot right after `ActiveExpertChip` (:520-525) and before the attachments (:526).
- Add one optional prop, `scopeSlot?: ReactNode`, beside `activeExpert?` (:87). The hook count stays unchanged (ledger:
  7/5/23).

### `frontend/src/components/chat/ChatArea.tsx` (the one PATCH home)

**Analog:** `applyExpertChange` (ChatArea.tsx:515-546). Copy its structure for `applyScopeChange`, but **drop** the
streaming refusal at :522-525 (D-268-12a allows the change). Keep:
```tsx
      try {
        const updated = await setThreadActiveExpert(tid, next?.id ?? null)
        onThreadUpdated?.(updated)
      } catch (err) {
        setActiveExpert(previous)
        setExpertChangeError(err instanceof Error && err.message.trim() ? err.message : "The Expert could not be changed.")
        return
      }
      if (!useStreamsStore.getState().streamingThreads.has(tid)) {
        loadMessages(tid).catch(console.error)
      }
```
`applyExpertChange` must also re-read `ScopeEffect` after its own success (UI-SPEC §6.2). **Remove** the header folder
pill at :849-854 and the now-unused `scopedFolder` (:826) (UI-SPEC §9-D6). **Test analog:**
`ChatArea.expertThread.test.tsx:24-90` (`vi.hoisted` mocks, `vi.mock("@/lib/api", …)` re-exporting `setThreadActiveExpert`).
⚠ Mock the new `setThreadFolder` / `getScopeEffect` **in `@/lib/api` too**. The 196-08 lesson: a factory that does not
declare a new export throws at mount.

---

### `frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx` (extend the fence)

**Analog:** itself.
- `HUES` (:94) becomes `"violet|emerald|rose|amber|indigo"`.
- `FILES` (:85-92) gains the new leaves plus `ActiveExpertChip.tsx`. Each import is a `?raw` line (:24-36), and each
  source must be longer than 1000 characters (:99-103). ⚠ `scopeCopy.ts` / `expertSpendCopy.ts` may be under 1000 and
  carry no classes, so keep copy modules **out** of `FILES`.
- Add layer-A rendered cases with `expectBothThemes(el, light, dark)` (:44-48).
- Raise the non-vacuity floor at :136 (`toBeGreaterThanOrEqual(8)`) to the new pair count.
- Re-pin BASELINE `"expertThemeContrast.test.tsx": 6` (vitest-count-gate.cjs:193) to the new case count.

---

## Shared Patterns

### One transaction for a state change and its record
**Source:** `backend/app/api/threads.py:927-952` (`_write_expert_change`) plus :1031-1049.
**Apply to:** the scope PATCH arm.
Compute both statements **outside** the transaction. Run the UPDATE and the event INSERT on one
`get_user_pg_connection`. Set `org_id` explicitly to the THREAD's org (D-267-34). Pass `tool_calls` as a plain list, never
pre-dumped. On failure, log the cause and raise a 500 with a literal detail string (T-267-20).

### Explicit org, never the trigger's guess (SEED-314)
**Source:** `threads.py:1364-1366` (validated active org), `threads.py:761-770` (conditional `org_id` key),
`db/runs.py:147-160` (optional-org branch).
**Apply to:** the run, user message, thread, assistant message, system-warning and cap-carrier inserts.
None means byte-identical: the trigger still decides for single-org or no-header callers.

### Disposition fence over every call site
**Source:** `test_256_judge_usage_counted.py:732-826`; AST helpers `test_264_born_for_carrier.py:54-73`.
**Apply to:** `insert_run(` sites, and the three `model="unknown"` placeholder writers.
Assert a SET, never a count. A blank disposition fails. Resolve import aliases (`api/runs.py:1140`).

### One USD home
**Source:** `backend/app/services/pricing_service.py:27-52` (`cost_usd_sql`), imported at `db/rates.py:16-20`.
**Apply to:** every spend CTE. `test_257_single_token_conversion_home.py:187-194` enforces it.

### One payload, words from one vocabulary module
**Source:** `expertEventCopy.ts` (docblock :5-21) and `expert_scope.py` (docblock :1-11).
**Apply to:** chip, picker ledger, card and spend copy. The frontend never recomputes the Expert rule. Every word lives in
one `*_COPY` object. Server strings are React text children only (T-267-40).

### Light and dark pairs on every new hue
**Source:** `expertThemeContrast.test.tsx:94-137`; the pair form `text-violet-700 dark:text-violet-200`
(`ExpertEventCard.tsx:70`), `text-emerald-700 dark:text-emerald-300` (:96).
**Apply to:** every new phase-268 leaf, plus `ActiveExpertChip.tsx`.

### Real-RLS two-org proof
**Source:** `backend/tests/integration/test_267_transcript_rows_rls.py:68-207`.
**Apply to:** SEED-314 rows, and the Continue carrier lookup. Derive the trigger's pick. Run a control row with no org
first. Clean up in `finally`. Use `-rs`, because a skip is a SKIP.

### Vitest gate adoption
**Source:** `scripts/vitest-count-gate.cjs`. BASELINE pins (:193 `"expertThemeContrast.test.tsx": 6`,
:261 `"ScopeLedger.test.tsx": 9`) and TARGETS file entries (:4503-4537).
**Apply to:** every new suite (both knobs, same commit). `MessageInput.a11y.test.tsx` is in neither knob (RESEARCH §Q11).

### Hot-file ledger rows at creation
**Source:** `docs/HOT-FILE-LEDGER.md:17053-17065` ("Row added AT PLANNING" sections) and the per-phase update sections
at :17120-17134.
**Apply to:** `backend/app/db/runs.py` (**no row and FIRES**) and every new leaf. The disposition cell is 200 characters or
fewer (`check-claude-md-size.cjs`). Run `node scripts/check-hot-file-ledger.cjs 268` after planning.

---

## No Analog Found

| File | Role | Data Flow | Reason / fallback |
|---|---|---|---|
| The `roots → members → priced → per_root` CTE inside `db/rates.py` | db reader | aggregation | No query in the repo groups sub-agent rows under a root, or prices per member. Use RESEARCH §Q4 :324-365 for the shape. Keep the shipped LATERAL rate lookup and CR-06 counters verbatim inside it |
| The folder tree inside `ScopePicker.tsx` | component | presentational | No component uses `DropdownMenuRadioItem` yet. Use UI-SPEC §5.3 and §8.4 (the keyboard model) and Radix docs. `ProfileMenu.tsx:155-172` is the nearest item-level precedent |

## Metadata

**Analog search scope:** `backend/app/{api,db,models,services}`, `backend/tests/{unit,integration}`,
`supabase/migrations/18x-196`, `frontend/src/{components/chat,components/experts,components/admin/spend,components/layout,pages/admin,lib/api,types}`,
`scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md`.
**Files read for excerpts:** 34.
**Measured findings not in RESEARCH.md:**
1. `api/runs.py:1140` aliases `insert_run as _insert_run`, so a regex fence copied from `_FORCED_EMIT_RE` misses it.
2. No component uses `DropdownMenuRadioItem` yet.
3. `AttentionPopover`'s plain-`<button>`-in-content pattern is unreachable by Tab inside Radix Menu, so it must not be
   copied for Apply and Cancel.
4. `ExpertEventCard`'s `data-testid` is hard-coded in `Shell` (:56) and must become a prop.

**Pattern extraction date:** 2026-09-28
