# Phase 120: Collision Fix + Context Isolation - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 11 (9 edits + 2 net-new) — plus 2 net-new test files
**Analogs found:** 11 / 11 (every edit seam read in source; every net-new file mapped to a real analog)

This phase is mostly EDITS to existing backend seams plus a small net-new set (migration 076 + helper + tests). For the EDIT sites the "analog" IS the current code at that seam — the excerpts below are the **actual current lines** so the planner writes concrete `<action>` targets, not assumptions.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/076_messages_origin.sql` | migration | DDL / schema | `supabase/migrations/050_messages_reasoning_content.sql` (ADD COLUMN on `messages`) + `075_*` (idempotent-style header + apply rule) | exact (same table, same op family) |
| `backend/app/services/sandbox_service.py` | service | file-I/O | self — extract from `harvest_output_files` (`:201-361`), same container-I/O idiom | self (new helper mirrors existing) |
| `backend/app/services/agent_loop.py` | service | event-driven (agent loop) | self — `:1316` baseline init, `:1024` history query, `:209`/`:1269`/`:1226` inserts | self (edit-in-place) |
| `backend/app/services/tool_dispatcher.py` | service | file-I/O / request-response | self — `execute_code` handler `:864-1146` (session + `_previous_files_in_run` wiring) | self |
| `backend/app/services/harness/phase_types.py` | service | event-driven (per-phase ctx) | self — `:343` baseline init, `:629` ask_user insert | self |
| `backend/app/services/harness_engine.py` | service | event-driven (workflow run) | self — `:225` raw SQL insert, `:439`/`:513` shared-helper calls, `:889` ask_user insert | self |
| `backend/app/db/runs.py` | db helper | CRUD (INSERT) | self — `insert_assistant_message` `:145-190` (the shared persist path) | self |
| `backend/app/api/runs.py` | route | request-response | self — `ask_user_response` handler `:578-601` (insert at `:580`) | self |
| `backend/app/api/threads.py` | route (G-5 HOT) | request-response | self — user insert `:1020` (NO tag needed — see Shared Patterns) | self |
| `backend/tests/unit/test_120_collision_regression.py` | test | unit | `backend/tests/unit/test_075_4_dedup_supersedes.py` + `test_sandbox_service.py` | exact (same harvest mock scaffold) |
| `backend/tests/test_120_origin_filter.py` | test | unit | (same scaffold + query-builder-call assertions) | role-match |

> **Migration apply rule (project-locked, CLAUDE.md):** author `076_*.sql` only; the operator pastes it into the Supabase SQL editor (NEVER `supabase db push`/`db reset` — preserves dev data), then runs `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commits migration + regenerated `full-schema.sql` together. **Never hand-edit `full-schema.sql`.** The 075 header (excerpt below) is the canonical wording for this rule.

---

## Pattern Assignments

### `supabase/migrations/076_messages_origin.sql` (migration, DDL) — NET-NEW

**Analog 1 — simplest ADD COLUMN on `messages`** (`050_messages_reasoning_content.sql`, full file):
```sql
-- Phase 076.1 / SEED-032: DeepSeek reasoning_content round-trip
-- ... (header comment block explaining WHY) ...
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning_content TEXT;
```
> Migration 050 is the precedent the research cites for "ADD COLUMN inherits the existing RLS policy — no new policy needed." Copy that property: 076 adds NO RLS policy.

**Analog 2 — current idempotent-header + apply-rule style** (`075_document_relationships_idempotency_index.sql:17-23`):
```sql
-- Apply by pasting this whole file into the Supabase SQL editor (or psycopg2 to local
-- :54322 per the 100/099/101.1/102/110/111/114 precedent) — NEVER `supabase db push` /
-- `db reset` (preserves dev data); then `bash scripts/regenerate-full-schema.sh`
-- (no --reset), commit migration + regenerated full-schema.sql together.
-- Plan 04 (operator, autonomous:false / BLOCKING) applies it + regenerates full-schema.sql.
-- This plan (NN-01) ONLY AUTHORS the file — it is NOT applied here, and
-- supabase/full-schema.sql is NOT touched here (Plan 04 regenerates it).
```

**Recommended migration body** (from RESEARCH Open Q2, D-120-04/05; `DEFAULT 'deep'` is load-bearing — see Pitfall 1 in Shared Patterns):
```sql
-- 076_messages_origin.sql — Phase 120 (CTX-01 / D-120-04..06).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'deep';

-- Add the CHECK separately so re-runs don't error on a duplicate constraint.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_origin_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_origin_check CHECK (origin IN ('deep','harness'));
```
> `NOT NULL DEFAULT 'deep'` FILLS all existing rows with `'deep'` (PG 11+ metadata-only fast op, verified) → ZERO NULLs → the `neq('origin','harness')` Deep filter correctly replays legacy rows. The CHECK is satisfied by the filled default. (If the planner ever drops `NOT NULL`/`DEFAULT`, the Deep filter MUST become `.or_("origin.is.null,origin.neq.harness")` — do NOT.)

---

### `backend/app/services/sandbox_service.py` (service, file-I/O) — NET-NEW HELPER + edit

**Analog:** the existing `harvest_output_files` container-I/O idiom (`sandbox_service.py:251-326`). The new `snapshot_output_baseline(session)` helper reuses the IDENTICAL `session.execute_command("mkdir -p ...")` + `session.copy_from_runtime("/sandbox/output", tmpdir)` + `os.walk` + `hashlib.sha256(data).hexdigest()` pattern so a seeded baseline entry and a later harvested entry collide on the SAME key.

**Current harvest I/O + hash idiom to mirror** (`sandbox_service.py:256-280`):
```python
        try:
            session.execute_command("mkdir -p /sandbox/output")
        except Exception:
            pass  # best-effort; copy_from_runtime will 404 if it truly doesn't exist

        with tempfile.TemporaryDirectory() as tmpdir:
            session.copy_from_runtime("/sandbox/output", tmpdir)
            for root, _dirs, files in os.walk(tmpdir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    file_size = os.path.getsize(fpath)
                    with open(fpath, "rb") as f:
                        data = f.read()
                    content_hash = hashlib.sha256(data).hexdigest()   # ← the dedup key to reuse
```

**Existing dedup that the seeded baseline rides on** (`sandbox_service.py:341-350` — DO NOT rebuild this; just seed `previous_files`):
```python
    for f in output_files:
        h = f["content_hash"]
        current_files_dict[h] = {...}
        if h in previous_files:
            continue  # same hash already seen — true duplicate, skip   ← seeded entries hit THIS branch
```

**New helper shape** (RESEARCH Pattern 1; returns `{hash: meta}` shaped exactly like `previous_files`):
```python
def snapshot_output_baseline(session) -> dict[str, dict]:
    """List + SHA-256 every file already in /sandbox/output/ so the run's
    harvest excludes pre-existing files. Best-effort: empty dir / copy failure → {}."""
    baseline: dict[str, dict] = {}
    try:
        session.execute_command("mkdir -p /sandbox/output")
    except Exception:
        pass
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            session.copy_from_runtime("/sandbox/output", tmpdir)
            for root, _dirs, files in os.walk(tmpdir):
                for fname in files:
                    with open(os.path.join(root, fname), "rb") as f:
                        data = f.read()
                    h = hashlib.sha256(data).hexdigest()
                    baseline[h] = {"filename": fname, "url": None,
                                   "size": len(data), "iteration": -1}  # -1 = pre-run
    except Exception:
        pass  # no baseline = legacy behavior; never blocks the run
    return baseline
```
> `hashlib`, `os`, `tempfile` are already imported at the top of `sandbox_service.py` (used by `harvest_output_files`). No new imports.

---

### `backend/app/services/agent_loop.py` (service, event-driven) — 4 edit seams

#### Seam A — COLL-01 baseline init (`agent_loop.py:1316`) — current state:
```python
        # Plan 075.4-03 D-075.4-D1/D2 — closure-local per-run dict
        # ... (long comment block :1303-1315) ...
        _previous_files_in_run: dict[str, dict] = {}
```
**Target:** seed this with the snapshot instead of `{}`. The resume-path ToolContexts at `:1366` and `:2049` reference this SAME closure var (`previous_files_in_run=_previous_files_in_run`) → they inherit the seed automatically (no extra change).

> **DESIGN WRINKLE the planner MUST resolve (not in RESEARCH):** the sandbox `session` is NOT obtained in `agent_loop.py` — `agent_loop.py` does NOT import `sandbox_manager` (grep confirmed: zero references). The session is created lazily at `tool_dispatcher.py:868` (`session = sandbox_manager.get_or_create(ctx.thread_id)`). So RESEARCH's literal `snapshot_output_baseline(session)` call at `:1316` requires either:
> - **Option 1 (eager, RESEARCH's intent):** add `from app.services.sandbox_service import sandbox_manager, snapshot_output_baseline` to `agent_loop.py`, then `session = sandbox_manager.get_or_create(thread_id)` + `_previous_files_in_run = await run_in_threadpool(snapshot_output_baseline, session)` at `:1316`. Cost: forces container creation at run start even for runs that never call `execute_code` (~slight warm-up). `thread_id` is in scope at `:1316`.
> - **Option 2 (lazy, smaller blast radius):** seed inside the `execute_code` handler at `tool_dispatcher.py:865-868` on FIRST harvest of the run — the session ALREADY exists there at `:868`. Guard with a "seeded once per run" flag on the ctx/closure so a multi-cell run seeds only on the first cell (D-120-01 = per-RUN scope, NOT per-cell). This avoids the eager-container cost and keeps `agent_loop.py` (G-5 hot file) untouched for COLL-01.
>
> Both satisfy D-120-01 (per-run, seeded once, per-cell accumulation unchanged). Planner picks; Option 2 is the lighter touch on a hot file and avoids forcing a container for non-sandbox runs. Either way: `run_in_threadpool` is MANDATORY (D-v2.5-01 — the snapshot does container I/O; the existing harvest call at `tool_dispatcher.py:1139` already wraps with `run_in_threadpool`).

#### Seam B — CTX-01 history filter (`agent_loop.py:1024`) — current state:
```python
    # Load full message history (includes just-inserted user message)
    history_resp = await aexec(
        supabase.table("messages")
        .select("role, content, tool_calls, reasoning_content")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
        .order("created_at")
    )
```
**Target (RESEARCH Pattern 3 — asymmetric, ADDITIVE, owner/thread scope preserved):**
```python
    _history_q = (
        supabase.table("messages")
        .select("role, content, tool_calls, reasoning_content")  # origin NOT in projection
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
    )
    if body.agent_mode != "harness":          # Deep / Explorer
        _history_q = _history_q.neq("origin", "harness")   # deep OR legacy → replays
    else:                                     # Harness
        _history_q = _history_q.eq("origin", "harness")
    history_resp = await aexec(_history_q.order("created_at"))
```
> CRITICAL: keep `origin` OUT of `.select(...)` (pure WHERE filter — Anti-Pattern / Pitfall 4); keep BOTH `.eq("thread_id")` + `.eq("user_id")` (V4 owner/thread scope — never widen). **A1 (planner must confirm):** does the Harness reconstruction read history via THIS query, or a separate path? If Harness reads history elsewhere, apply the strict `= 'harness'` filter THERE. The Deep `:1024` query is confirmed; the Harness read site was not exhaustively traced.

#### Seam C — Deep system insert: cap_paused carrier (`agent_loop.py:209`) — current state:
```python
        await aexec(
            supabase.table("messages").insert({
                "thread_id": thread_id,
                "user_id": user_id,
                "role": "system",
                "content": (... iteration-limit message ...),
                "tool_calls": carrier,
            })
        )
```
**Target:** optionally add `"origin": "deep"` (D-120-07 explicit tagging). HARMLESS if missed — Deep row defaults to `'deep'` anyway. Low priority.

#### Seam D — Deep system insert: system_warning (`agent_loop.py:1269`) — current state:
```python
                await aexec(
                    supabase.table("messages").insert({
                        "thread_id": thread_id,
                        "user_id": current_user["id"],
                        "role": "system",
                        "content": _strip_nul(w.get("message", "")),
                        "tool_calls": [{"kind": w.get("kind", "")}],
                    })
```
**Target:** optionally add `"origin": "deep"`. HARMLESS if missed (defaults `'deep'`).

#### Seam E — Deep assistant persist via shared helper (`agent_loop.py:1226`) — current state:
```python
            _inserted_id = await insert_assistant_message(
                await get_pg_pool(),
                thread_id=...,
                user_id=...,
                content=_strip_nul(full_content),
                tool_calls=row.get("tool_calls"),
                ...
                reasoning_content=_strip_nul(full_reasoning_content) or None,
            )
```
**Target:** NO change needed — this Deep caller passes nothing for the new `origin` param → takes its default `'deep'`. (Listed for completeness; the dangerous direction is the HARNESS callers of the same helper — see harness_engine seams.)

---

### `backend/app/services/tool_dispatcher.py` (service, file-I/O) — COLL-01 wiring

**Analog (self):** `execute_code` handler. Session + baseline wiring already present.

**Current baseline pickup** (`tool_dispatcher.py:864-868`):
```python
    _previous_files_in_run = ctx.previous_files_in_run if ctx.previous_files_in_run is not None else {}
    try:
        session = sandbox_manager.get_or_create(ctx.thread_id)   # ← session lives HERE (Option 2 seed point)
```
**Current harvest call** (`tool_dispatcher.py:1139-1146` — the per-cell accumulation, UNCHANGED by COLL-01):
```python
            delta_files, _iter_files = await run_in_threadpool(
                harvest_output_files,
                session, execution_id, ctx.current_user["id"], ctx.supabase,
                _previous_files_in_run,
                ctx.iteration,
            )
            _previous_files_in_run.update(_iter_files)   # ← per-cell accumulation — MUST stay
            output_file_list = delta_files
```
> If the planner chooses Option 2 (lazy seed): seed `_previous_files_in_run` here on first harvest of the run (guard against re-seed across cells — D-120-01 per-RUN scope). `sandbox_manager` + `harvest_output_files` are already imported at `:34`; add `snapshot_output_baseline` to that import. Do NOT reset the baseline per cell (Anti-Pattern: drops a multi-cell run's own intermediates).

---

### `backend/app/services/harness/phase_types.py` (service, event-driven) — 2 edit seams

#### Seam A — COLL-01 Harness baseline init (`phase_types.py:343`) — current state (inside `_build_phase_tool_context`'s `return ToolContext(...)`):
```python
        model=_effective_model(phase, ctx),
        previous_files_in_run={},                    # ← :343 — seed this for D-120-03
        parent_run_id=None,
```
**Target:** snapshot at per-PHASE ctx build (BEFORE the phase's `execute_code` runs) so a PRIOR phase's leftover is excluded but THIS phase's own deliverable (written AFTER, during dispatch) is kept (Pitfall 2 — over-seeding). Same session-availability wrinkle applies: this builder has `ctx` (with `thread_id`) but does it hold a sandbox session? It does NOT currently fetch one — the planner must `sandbox_manager.get_or_create(getattr(ctx,'thread_id',''))` here + `run_in_threadpool(snapshot_output_baseline, session)`, OR mirror the chosen Deep approach. Per-phase scope is correct for harness (each phase builds its own ToolContext).

#### Seam B — Harness ask_user prompt insert (`phase_types.py:629`) — current state (role='system'):
```python
            await aexec(
                supabase.table("messages").insert(
                    {
                        "thread_id": thread_id,
                        "user_id": current_user.get("id"),
                        "role": "system",
                        "content": prompt,
                        "tool_calls": [{ "kind": "ask_user_prompt", ... }],
                    }
                )
            )
```
**Target:** add `"origin": "harness"`. **DANGEROUS if missed** — this Harness row would default to `'deep'` → leaks into Deep replay AND fails to replay in its own Harness phase.

---

### `backend/app/services/harness_engine.py` (service, event-driven) — 4 edit seams

#### Seam A — raw SQL INSERT, ask_user expiry (`harness_engine.py:225`) — current state:
```python
        await pool.execute(
            """
            INSERT INTO messages (thread_id, user_id, role, content, tool_calls)
            VALUES ($1, $2, 'system', '', $3)
            """,
            _tid,
            r["user_id"],
            [{"kind": "ask_user_response", "tool_call_id": tcid, "expired": True, ...}],
        )
```
**Target:** add `origin` to the column list + `'harness'` to VALUES (positional `$N` or the literal `'harness'` — keep `$N` style; NEVER f-string — V5/Tampering). **DANGEROUS if missed** (this site was NOT in D-120-07's list — RESEARCH Pitfall 5):
```sql
INSERT INTO messages (thread_id, user_id, role, content, tool_calls, origin)
VALUES ($1, $2, 'system', '', $3, 'harness')
```

#### Seam B — Harness assistant SUCCESS persist (`harness_engine.py:439`) — current state:
```python
        _inserted_id = await insert_assistant_message(
            pool,
            thread_id=...,
            user_id=...,
            content=_strip_nul(final_text),
            source_refs=source_refs or None,
            confidence_level=_conf.get("level"),
            ...
        )
```
**Target:** add `origin="harness"`. **DANGEROUS if missed** (defaults `'deep'` → harness final answer bleeds into Deep).

#### Seam C — Harness assistant FAILURE persist (`harness_engine.py:513`) — current state:
```python
        _inserted_id = await insert_assistant_message(
            pool,
            thread_id=...,
            user_id=...,
            content=content,
        )
```
**Target:** add `origin="harness"`. **DANGEROUS if missed.**

#### Seam D — Harness ask_user disposition prompt (`harness_engine.py:889`) — current state (role='system'):
```python
            await aexec(
                supabase.table("messages").insert(
                    {
                        "thread_id": thread_id,
                        "user_id": current_user.get("id"),
                        "role": "system",
                        "content": prompt,
                        "tool_calls": [{ "kind": "ask_user_prompt", ... }],
                    }
                )
            )
```
**Target:** add `"origin": "harness"`. **DANGEROUS if missed.**

---

### `backend/app/db/runs.py` (db helper, CRUD) — the highest-leverage tag

**Analog (self):** `insert_assistant_message` `:145-190` — the ONE persist path for BOTH Deep (`agent_loop.py:1226`) and Harness (`harness_engine.py:439`/`:513`).

**Current signature** (`:145-157`):
```python
async def insert_assistant_message(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    user_id: UUID,
    content: str,
    tool_calls: list[dict] | None = None,
    source_refs: list[dict] | None = None,
    confidence_level: str | None = None,
    confidence_avg_similarity: float | None = None,
    confidence_disclaimer: str | None = None,
    reasoning_content: str | None = None,
) -> UUID:
```
**Current INSERT** (`:170-190`):
```python
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content,
            tool_calls, source_refs,
            confidence_level, confidence_avg_similarity, confidence_disclaimer,
            reasoning_content
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        """,
        thread_id, user_id, content, tool_calls, source_refs,
        confidence_level, confidence_avg_similarity, confidence_disclaimer,
        reasoning_content,
    )
```
**Target (RESEARCH Pattern 2):** add `origin: str = "deep"` kwarg → add `origin` to the column list → add `$10` to VALUES → add `origin` to the positional args. Default `'deep'` keeps every existing Deep caller correct with NO change; Harness callers pass `origin="harness"`.

---

### `backend/app/api/runs.py` (route, request-response) — mode-aware tag

**Analog (self):** `ask_user_response` handler insert `:579-592` (role='system').

**Current insert** (`:579-592`):
```python
        await aexec(
            supabase.table("messages").insert({
                "thread_id": row["thread_id"],
                "user_id": current_user["id"],
                "role": "system",
                "content": body.response_text,
                "tool_calls": [{
                    "kind": "ask_user_response",
                    "tool_call_id": body.tool_call_id,
                    "response_text": body.response_text,
                    "choice_index": body.choice_index,
                }],
            })
        )
```
**Target (RESEARCH A2 — mode IS derivable here):** the handler already branches on which lookup found the run: Step-1 `runs` SELECT (`:512-519`) = **Deep**; the `workflow_runs` fallback (`:542-567`) synthesizes `row` = **Harness**. Tag `"origin"` by that branch — `'harness'` only when `row` came from the workflow_runs fallback; `'deep'` otherwise. Mis-tagging a workflow reply `'deep'` is the SAFE direction; mis-tagging a Deep reply `'harness'` drops it from Deep replay — so default `'deep'` and ONLY set `'harness'` on the confirmed-workflow branch.

---

### `backend/app/api/threads.py` (route, G-5 HOT FILE) — NO origin tag needed

**Analog (self):** user-message insert `:1019-1026`.

**Current insert** (`:1019-1026`):
```python
    _user_msg_resp = await aexec(
        supabase.table("messages").insert({
            "thread_id": thread_id,
            "user_id": current_user["id"],
            "role": "user",
            "content": body.content,
        })
    )
```
**Target:** **NO CHANGE.** This is a `role='user'` row. User rows are intentionally replayed by Deep (`neq('origin','harness')` → `'deep'` passes) and intentionally NOT replayed by Harness (Harness does not replay the Deep user turn). Default `'deep'` is exactly right. **G-5: do NOT grow this file; the filter lives in `agent_loop.py:1024`, never here** (D-120-07, RESEARCH §G-5). D-120-07's CONTEXT text names `threads.py:1020` as a "Deep site" but RESEARCH §G-5 + Open Q3 row #2 corrected this: it is a USER row needing no tag.

> **tool / sub-agent rows:** there is NO separate `role='tool'` insert — tool results live inside the assistant row's `tool_calls` jsonb and inherit its `origin`. Sub-agent (`task`) final answers persist via the SAME `insert_assistant_message` helper → inherit the caller's `origin`. No extra tagging.
>
> **dev fixture:** `api/test_fixtures.py:103` (dev-only) — tag `'deep'` for consistency, non-load-bearing.

---

### `backend/tests/unit/test_120_collision_regression.py` (test, unit) — NET-NEW (D-120-08 headline)

**Analog:** `backend/tests/unit/test_075_4_dedup_supersedes.py` — reuse its EXACT mock-session scaffold.

**Scaffold to copy verbatim** (`test_075_4_dedup_supersedes.py:28-47`):
```python
def _build_mock_session_with_payloads(payloads: dict[str, bytes]):
    """copy_from_runtime writes filename → bytes into the destination tmpdir."""
    def _copy_from_runtime(_src_path, tmpdir):
        for fname, payload in payloads.items():
            with open(os.path.join(tmpdir, fname), "wb") as f:
                f.write(payload)
    session = MagicMock()
    session.execute_command = MagicMock()
    session.copy_from_runtime = MagicMock(side_effect=_copy_from_runtime)
    return session

def _build_mock_supabase():
    sb = MagicMock()
    sb.storage.from_.return_value.upload = MagicMock()
    sb.table.return_value.insert.return_value.execute = MagicMock()
    return sb
```
**Test bodies (RESEARCH Code Examples + Validation map):**
- `test_stale_workflow_file_excluded_from_skill_emit` — snapshot a session holding `weekly-status-report.docx` (37,328 B) → assert its hash IS in baseline → harvest a session holding BOTH it + `Weekly_Report_2026-06-20.docx` (11,545 B) with `previous_files=baseline` → assert delta == `["Weekly_Report_2026-06-20.docx"]` exactly.
- `test_empty_baseline_emits_both_files_pre_fix` — same harvest with `previous_files={}` → delta has BOTH (proves the test FAILS before the fix).
- `test_snapshot_seeds_existing_files` — every pre-existing file's hash present; empty dir → `{}`.
- `test_harness_phase_keeps_own_output` — Harness symmetry (D-120-03): prior-phase leftover excluded, this-phase deliverable kept.

> Faithfulness: reproduce the TRUE signature (ONE execution_id emitting MORE files than the code wrote) — NOT the rejected "same filename across two execution_ids" heuristic (both live files shared one Deep execution_id).

---

### `backend/tests/test_120_origin_filter.py` (test, unit) — NET-NEW (CTX-01)

**Analog:** query-builder-call assertion style (assert `.neq("origin","harness")` / `.eq("origin","harness")` applied per `body.agent_mode`) + a Deep byte-identical no-op proof (pure-Deep thread → filtered set == unfiltered set).
- `test_asymmetric_filter_per_mode` — Deep → `neq('origin','harness')`; Harness → `eq('origin','harness')`.
- `test_harness_sites_tag_harness` — every enumerated HARNESS insert site passes `'harness'`.
- `test_deep_pure_thread_filter_is_noop` — SC#4 Deep byte-identical guard.

> RESEARCH also names an integration test `backend/tests/integration/test_120_migration.py` (live-DB: zero NULL `origin` post-migration, CHECK accepts deep/harness, rejects other) — SC#3.

---

## Shared Patterns

### The asymmetric-risk insert-site contract (apply across all `messages` inserts)
**Source:** RESEARCH Open Q3 (exhaustive 9-site enumeration) + Pitfall 3.
**Apply to:** every site listed above.
**Rule:** an untagged **HARNESS** row defaults to `'deep'` → leaks into Deep replay (the bug we are fixing) AND fails to replay in its own phase. An untagged **DEEP** row defaults to `'deep'` → correct (no harm). **Verification MUST prioritize confirming every HARNESS site is tagged `'harness'`:** `db/runs.py` (Harness callers), `phase_types.py:629`, `harness_engine.py:225`/`:439`/`:513`/`:889`, `api/runs.py:580` (workflow branch). A test asserting every insert site passes an explicit/defaulted origin is the backstop (A3 — re-run the three greps: `\.table("messages")\.insert`, `INSERT INTO messages`, the shared helper).

### `DEFAULT 'deep'` is load-bearing (NULL three-valued-logic trap)
**Source:** RESEARCH Pitfall 1 + Open Q2.
**Apply to:** migration 076 + the `:1024` filter.
**Rule:** Postgres `NULL <> 'harness'` → UNKNOWN → EXCLUDED by `neq`. If `origin` were nullable-no-default, `neq('origin','harness')` would silently drop ALL legacy Deep history. `ADD COLUMN ... NOT NULL DEFAULT 'deep'` fills existing rows → zero NULLs → legacy rows replay. Confirm post-migration: `SELECT count(*) FROM messages WHERE origin IS NULL` returns 0.

### Owner/thread scope is invariant (V4 Access Control)
**Source:** RESEARCH Security Domain.
**Apply to:** the `:1024` history query.
**Rule:** the `origin` filter is ADDITIVE — NEVER drop or relax `.eq("thread_id", thread_id)` + `.eq("user_id", current_user["id"])`. The new `.neq`/`.eq` on origin must only NARROW, never widen scope. The snapshot helper reads only the thread's OWN container (`sandbox_manager.get_or_create(thread_id)`) — no cross-thread/cross-user read.

### `run_in_threadpool` for container I/O (D-v2.5-01)
**Source:** CLAUDE.md + existing harvest call `tool_dispatcher.py:1139`.
**Apply to:** every call of the new `snapshot_output_baseline` (it does `session.execute_command` / `copy_from_runtime` container I/O). NEVER call it bare in an async handler.

### Keep `origin` OUT of the SELECT projection (Deep byte-identical)
**Source:** RESEARCH Pitfall 4 / Anti-Patterns.
**Apply to:** `agent_loop.py:1024`.
**Rule:** `origin` is a pure WHERE filter. Do NOT add it to `.select("role, content, tool_calls, reasoning_content")` or thread it into `_reconstruct_history` — that would risk altering the reconstructed message-dict shape and break the native-7 byte-identical guarantee.

---

## No Analog Found

None. Every file is either an in-place edit of an existing seam (the "analog" is the current code, shown above) or a net-new file with a direct, named codebase analog (migration 050/075; test scaffold `test_075_4_dedup_supersedes.py`).

| File | Status |
|------|--------|
| (all 11 + 2 tests) | analog found / self-edit |

---

## Open Items the Planner Must Resolve (carried from RESEARCH, sharpened by source reads)

1. **COLL-01 seed point** — `agent_loop.py` does NOT import `sandbox_manager` (grep-confirmed); the session is created lazily at `tool_dispatcher.py:868`. Choose **Option 1** (eager seed at `agent_loop.py:1316` + new import + `get_or_create`) or **Option 2** (lazy seed at `tool_dispatcher.py:865-868` on first harvest, guarded per-run). Option 2 keeps the G-5 hot file `agent_loop.py` untouched for COLL-01 and avoids forcing a container for non-sandbox runs. Mirror the same decision for the Harness seed at `phase_types.py:343`.
2. **Harness history-read site (A1)** — confirm whether Harness reconstructs thread history via `agent_loop.py:1024` or a separate path; apply the strict `origin = 'harness'` filter wherever it reads.
3. **`api/runs.py:580` mode derivation (A2)** — tag `'harness'` ONLY on the confirmed workflow_runs-fallback branch (`:542-567`); default `'deep'` on the runs-row branch. Safe direction is workflow→'deep'; never Deep→'harness'.

---

## Metadata

**Analog search scope:** `backend/app/services/` (agent_loop, sandbox_service, tool_dispatcher, harness_engine, harness/phase_types), `backend/app/db/runs.py`, `backend/app/api/{threads,runs}.py`, `supabase/migrations/`, `backend/tests/unit/`.
**Files scanned (source-read):** 11 production seams + 2 migration analogs + 1 test scaffold.
**Pattern extraction date:** 2026-06-22
