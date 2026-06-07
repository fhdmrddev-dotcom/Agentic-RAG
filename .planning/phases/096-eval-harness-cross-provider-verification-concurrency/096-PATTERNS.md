# Phase 096: Eval Harness + Cross-Provider Verification + Concurrency - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 15 new/modified files
**Analogs found:** 14 / 15 (one no-analog: capability-table artifact format)

All line numbers verified by direct read on 2026-06-07. RESEARCH.md's claims cross-checked; one correction found (see `api.ts` finding under Pattern Assignment 9).

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `scripts/eval_cross_provider.py` | extend | operator script | request-response + DB polling | itself (Deep-mode rows) | exact |
| `backend/tests/test_096_ci_workflow_regression.py` | new | test | streaming/event-driven | `backend/tests/unit/test_085_task_service.py:546-619` + `backend/tests/test_harness_resume.py:274-330` + `backend/tests/conftest.py:495-502` | exact |
| `backend/tests/test_096_askuser_cleanup.py` | new | test | CRUD | `backend/tests/test_harness_resume.py:174-232` (ask_user pending queries on mock pool) | exact |
| `frontend/src/providers/__tests__/streamPool.test.tsx` | new | test | event-driven | `frontend/src/__tests__/providers/streamsProvider.test.tsx:1-91` | exact |
| `scripts/restart_smoke.py` | new | operator script | batch / DB polling | `scripts/eval_cross_provider.py` helpers + `scripts/observe-run.py` | exact |
| `scripts/conc_probe.py` | new | operator script | batch / HTTP polling | `scripts/eval_cross_provider.py` helpers + `backend/app/api/admin.py:52-99` response shape | exact |
| `supabase/migrations/066_eval_coverage_seed.sql` (number: verify at plan time, A7) | new | migration / seed | config | `supabase/migrations/061_harness_seed_templates.sql` | exact |
| `backend/app/services/harness/programmatic.py` (add `eval_slow_step`) | extend | service utility | transform | its own `split_topic` + `register_programmatic` (`:44-62, :71`) | exact |
| `frontend/src/providers/StreamsProvider.tsx` | extend | provider | streaming/event-driven | its own onTerminal bookkeeping (`:1051-1059`) + `setViewingThread` (`:1134-1161`) | exact (self) |
| `frontend/src/lib/api.ts` (one-line `answerAskUser` fix) | extend | utility | request-response | its own `ApiError` + `postMessage` pattern (`:16-23`, `:451`) | exact (self) |
| `backend/app/api/panel.py` (`/pending` liveness filter) | extend | controller | request-response | its own `/pending` query (`:103-156`) | exact (self) |
| `backend/app/services/harness_engine.py` (terminal-site ask_user cleanup) | extend | service | event-driven | its own `fail_run` site (`:769-782`) + resume finalizer (`:1141-1173`) | exact (self) |
| `frontend/src/components/panel/PendingAskCard.tsx` | extend | component | request-response | its own expired/answered states (`:225-260`) | exact (self) |
| `backend/app/config.py` (D-05 curation) | extend | config | — | its own registry rows + defaults table (`:186-245`, `:594-604`) | exact (self) |
| `.planning/eval/capability-table-<date>.{json,md}` | new | artifact (script-emitted) | file-I/O | — | no analog (new artifact class) |

`.github/workflows/backend-tests.yml`: **likely zero edits required** — it already triggers on `backend/**` (`:10-12`) and already boots real Redis from `docker-compose.dev.yml` (`:40-56`), so the new pytest file runs automatically. Optional: a dedicated `-k test_096` step for log legibility.

---

## Pattern Assignments

### 1. `scripts/eval_cross_provider.py` — workflow-mode extension (operator script, request-response + DB polling)

**Analog:** itself — every plumbing helper is reused verbatim, the extension adds a workflow row type alongside `CANONICAL_PROMPTS`.

**Entry-point discipline to preserve** (`eval_cross_provider.py:644-649` — hard-gate FIRST, presence-only env report):
```python
def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    load_env()
    # HARD-GATE first — before any DB connection or agent-loop call (T-088-02-01).
    assert_localhost_only()
    report_env_presence()
```

**Kickoff pattern to copy** — `run_prompt` (`:478-497`) extended with one additive field (verified accepted at `threads.py:835`):
```python
resp = requests.post(
    f"{base_url()}/threads/{thread_id}/messages",
    headers=_auth_headers(token),
    json={"content": prompt, "provider": provider, "model": model},  # + "workflow_definition_id": <eval_coverage uuid>
    timeout=30,
)
return resp.json()["run_id"]
```
Pitfall 1 (RESEARCH): `model` does NOT steer harness phases — assert effective model from sub-agent `runs.model` rows instead, and curate `_SUB_AGENT_MODEL_DEFAULTS` (see Assignment 14).

**Allowlisted-constant-query pattern** for new `workflow_phases` / `harness_audit` assertions (`:97-100` + `count_rows` `:339-358`):
```python
_COUNT_QUERIES: dict[str, str] = {
    "todos": "SELECT count(*) AS n FROM todos WHERE thread_id = %s",
    "workspace_files": "SELECT count(*) AS n FROM workspace_files WHERE thread_id = %s",
}
# count_rows raises ValueError on any table not in the allowlist; only %s params are dynamic.
```

**Terminal-poll pattern** for `workflow_runs.status` (copy `wait_for_run`, `:500-521` — note the `conn.rollback()` per poll to defeat the stale snapshot):
```python
while time.time() < deadline:
    conn.rollback()  # fresh snapshot in a long-lived psycopg2 connection
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT status FROM runs WHERE run_id = %s", (run_id,))
        row = cur.fetchone()
    if row and row["status"] in _TERMINAL_RUN_STATES:
        return row["status"]
    time.sleep(RUN_POLL_INTERVAL_S)
```
Workflow terminal states: completed/failed/cancelled (`threads.py:815` per RESEARCH).

**ask_user detection** — JSONB containment already in this script (`assert_ask_user`, `:361-376`):
```python
cur.execute(
    "SELECT count(*) AS n FROM messages "
    "WHERE thread_id = %s AND tool_calls @> %s::jsonb",
    (thread_id, '[{"kind":"ask_user_prompt"}]'),
)
```
For the D-02a auto-answer, extract `tool_call_id` + `run_id` from the prompt payload (shape at `panel.py:144-155`) and POST the same body the panel sends (`api.ts:977-989` shows the field names):
```python
requests.post(
    f"{base_url()}/runs/{workflow_run_id}/ask_user_response",
    headers=_auth_headers(token),
    json={"tool_call_id": tcid, "response_text": "Looks good", "choice_index": 0},
    timeout=15,
)
```
The F10 workflow_run-id fallback that makes this resolve is `runs.py:521-567` (owner-scoped + thread-anchor confirm, 404-never-403). Pitfall 2: poll prompt AND `workflow_runs.status` together; "terminal before answered" is its own diagnostic row outcome, not a generic FAIL.

**Greppable scoreboard pattern** (`print_scoreboard`, `:564-589`) — keep `EVAL_ROW` / `EVAL_SUMMARY` marker prefixes; the per-cell error-capture pattern in `run_cell` (`:535-561`, "one bad cell never aborts the matrix") applies to workflow rows verbatim. Capability table (D-04): extend `print_scoreboard`'s row dicts into JSON+MD emit (see No Analog Found).

---

### 2. `backend/tests/test_096_ci_workflow_regression.py` (test, streaming/event-driven)

**Analogs:** three composed sources.

**Fake gateway stub** — `backend/tests/unit/test_085_task_service.py:546-574` (generalize, don't duplicate — the D-01 fake provider is this stub with a per-phase event script):
```python
class _SyncEventStream:
    """A bare SYNC generator-like stream (the IN-05 shape the gateway adapters
    return): iterable + a sync ``.close()``. ``_stream_one_iteration`` MUST drive
    it with ``for event in stream:`` (never ``async for``)."""
    def __init__(self, events):
        self._events = list(events)
        self.closed = False
    def __iter__(self):
        yield from self._events
    def close(self):
        self.closed = True

def _make_open_stream_stub(events, calling_mode, *, captured: dict):
    stream = _SyncEventStream(events)
    async def _stub(provider, request):
        captured["provider"] = provider
        captured["request"] = request
        captured["stream"] = stream
        return stream, calling_mode
    return _stub, stream
```

**Patch seam** — patch where it is CONSUMED, not where it is defined (`test_085_task_service.py:603`):
```python
with patch.object(task_service, "open_stream", stub):
    ...
```
RESEARCH anti-pattern reminder: mock at this gateway seam (lower), NOT at `phase_types._stream_one_iteration` / `run_task_sub_agent` (the 093 mock blind spot) — the real engine, drain loop, gate retries, and `dispatch_tool` whitelist guard must run.

**Engine drive + resume sweep** — `backend/tests/test_harness_resume.py:274-330` (`test_sweep_reruns_active_phase`) is the model for the resume 2-phase-write leg: seed mock-pool state with a phase left `active`, call `harness_engine.resume_stranded_workflows(pool, redis)` (`:319`), assert re-run-from-top. CAS-claim tests at `:417-476` model the double-resume guard.

**Fixtures** — `backend/tests/conftest.py`:
- `mock_asyncpg_pool` (`:495-502`): "Yields a pool whose `.calls` lists every `(sql, args)` in execution order. Per-test return values via `set_fetchrow_result` / `set_fetch_result`." This IS the 2-phase-write-order assertion mechanism.
- `_FakeRedis` + `_FakePubSub` (`:505-547`): records XADD/sadd/publish + drives the ask_user subscribe→emit→block flow. Pitfall 5: for the CI journey, mock `subscribe_for_response` ONLY (pre-published answer) — the one seam where determinism beats realism — and bound every await with `asyncio.wait_for`.
- `four_seed_defs` (`:826`): builder for in-memory WorkflowDefinitions byte-mirroring migration 061 — copy this shape for the in-test 5-type definition (the CI test does NOT need the migration; it builds its definition in-process).

**CI infra:** `.github/workflows/backend-tests.yml` already boots real compose Redis (`:40-41`) and runs `pytest tests -q` (`:58-62`) — the new file is picked up with zero YAML edits. Greppable test name per RESEARCH: `test_096_ci_workflow_regression`.

---

### 3. `backend/tests/test_096_askuser_cleanup.py` (test, CRUD)

**Analog:** `backend/tests/test_harness_resume.py:174-232` — `test_ask_user_answered_vs_pending_query` and `test_get_pending_ask_user_returns_prompt_payload` already exercise the pending-prompt SQL shapes against `mock_asyncpg_pool`. Copy their structure for:
- terminal-status cleanup write at each `harness_engine` terminal site (assert via `pool.calls` SQL-order recording),
- `/pending` liveness filter with BOTH ID namespaces (Pitfall 6: workflow_run-keyed prompts check `workflow_runs.status` + anchor; Deep runs-keyed prompts check `runs.status = 'streaming'`). The F10 dual-namespace is where this broke twice — one test per namespace, minimum.

---

### 4. `frontend/src/providers/__tests__/streamPool.test.tsx` (test, event-driven)

**Analog:** `frontend/src/__tests__/providers/streamsProvider.test.tsx` — the established StreamsProvider test harness. Copy its mock scaffold verbatim (`:34-67`):
```typescript
const {
  mockPostMessage, mockSubscribeToRun, mockGetMessages, mockGetActiveRuns, mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockCancelRun: vi.fn(),
}))
vi.mock("@/lib/api", () => ({ postMessage: mockPostMessage, subscribeToRun: mockSubscribeToRun, ... }))
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({...}) }, channel: vi.fn(), removeChannel: vi.fn() } }))
```
Note: today's mock set lacks `getSnapshot` — the pool test will need it in the `vi.mock("@/lib/api", ...)` factory since reconcile calls it (`StreamsProvider.tsx:1179`). Reuse `makeSseRecorder()` (`:74+`, ported from useMessages.test.ts:76-91) to capture per-run callbacks.

**Must-cover behaviors** (from RESEARCH Pitfall 3): evict → return to thread → reconcile re-subscribes (the `subscriptionsRef.has` short-circuit at `:1259` is exactly what ghost bookkeeping breaks); PANEL-06 isolation (zero chat re-renders on pool churn — assumption A4 confirm). Baseline discipline: frontend vitest has a documented ~16-failure pre-existing cluster — prove net-new=0 via the 095.1 git-stash pattern, never raw counts.

---

### 5. `scripts/restart_smoke.py` (operator script, batch/DB-polling)

**Analog:** `scripts/eval_cross_provider.py` plumbing (which itself canonicalized `observe-run.py`'s patterns). Copy directly, do not hand-roll:

| Need | Copy from |
|------|-----------|
| env load (backend/.env via dotenv, venv-guarded import) | `eval_cross_provider.py:188-203` (`load_env`) |
| localhost hard-gate FIRST | `:239-256` (`assert_localhost_only`) |
| presence-only env report | `:206-230` (`report_env_presence`) |
| test-user bearer mint | `:411-449` (`get_bearer_token` — Supabase password grant; never echoes body) |
| psycopg2 connect | `:264-275` (`connect_db`) |
| thread create + kickoff | `:456-497` (`create_thread`, `run_prompt` + `workflow_definition_id`) |
| poll loop w/ rollback-per-poll | `:500-521` (`wait_for_run`) — repointed at `workflow_phases.status` at ~0.5s cadence |
| clean no-backend exit (no traceback) | `BackendUnavailable` class `:389-392` + `main`'s catch `:661-671` |

**Double-execution detector** (DB-truth assertion — `harness_audit` is INSERT-only per HARNESS-06):
```sql
SELECT metadata->>'phase' AS slug, count(*) AS n
FROM harness_audit
WHERE run_id = %s AND event_type = 'phase_completed'
GROUP BY 1 HAVING count(*) > 1;   -- any row = double-applied side effect
```

**What the script verifies (not builds):** `resume_stranded_workflows` — the resume finalizer at `harness_engine.py:1141-1173` always terminalizes the producer shell (`finalize_run` in a `finally:`), a pending `llm_human_input` re-subscribes + re-emits (`resume_pending_prompt`). The mid-`ask_user` smoke leg doubles as the BUG-260605-01 fix verification (prompt re-renders post-restart AND the POST reaches the engine).

Kill-point honesty (Pitfall 4): mid-`programmatic` needs the slow eval fn (Assignment 8) — `split_topic` completes in microseconds.

---

### 6. `scripts/conc_probe.py` (operator script, HTTP/DB polling)

**Analog:** same `eval_cross_provider.py` plumbing as Assignment 5, plus the verified backpressure response shape (`backend/app/api/admin.py:52-99`):
```python
bp = requests.get(f"{base_url()}/admin/backpressure", headers=_auth_headers(token)).json()
# {"anyio_threadpool_depth": {"borrowed": int, "total": int},
#  "redis_active_runs": int, "postgres_pool_in_use": int, "per_worker_run_count": int}
```
`anyio_threadpool_depth` comes from `anyio.to_thread.current_default_thread_limiter()` (`admin.py:65-67`); dev/local auth is fail-open for any authenticated user. Record `per_worker_run_count` alongside readings — WORKER_COUNT=2 means the probe and the workflow may land on different workers.

**N=10 fan-out drive:** `split_topic` has no cap (`programmatic.py:97-114` splits on `;`/newlines/" and "/" vs ") — a kickoff prompt with 10 semicolon-separated sub-topics yields exactly 10 branches into `asyncio.Semaphore(phase.config.max_parallel_agents)` (`phase_types.py:347`, default 5). ≤5-concurrent proof = max pairwise overlap of sub-agent `runs` `(started_at, completed_at)` windows (psycopg2, parameterized). Anti-pattern: do NOT measure cross-tab latency from a browser (conflates the 6-connection cap being fixed with backend starvation); also note `/snapshot` of an idle thread short-circuits before Redis (`threads.py:418-423`) — probe a threadpool-exercising endpoint too.

---

### 7. `supabase/migrations/066_eval_coverage_seed.sql` (migration/seed, config)

**Analog:** `supabase/migrations/061_harness_seed_templates.sql` — copy its full structure:

**Idempotent seed-user block** (`:33-43`):
```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'seed@system.local', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
```

**Seed-definition row shape** (`:143-189`, literature_review — the closest composition: programmatic → batch → single):
```sql
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000b3',          -- FIXED uuid (pick a new one, e.g. ...00c1)
  'literature_review', 1, 'Literature review', 'published',
  '{
    "slug": "literature_review", "version": 1, "name": "Literature review", "status": "published",
    "phases": [
      {"slug": "split",  "phase_index": 0, "config": {"phase_type": "programmatic", "fn": "split_topic", "input_keys": ["topic"]}, "validators": []},
      {"slug": "review", "phase_index": 1, "config": {"phase_type": "llm_batch_agents", "prompt": "...", "available_tools": ["search_documents"], "max_parallel_agents": 5, "merge_strategy": "concat_numbered"}, "validators": []},
      {"slug": "merge",  "phase_index": 2, "config": {"phase_type": "llm_single", "prompt": "..."}, "validators": []}
    ]
  }'::jsonb,
  '00000000-0000-0000-0000-000000000001', true
)
ON CONFLICT (id) DO NOTHING;
```
The `eval_coverage` seed composes the union: programmatic (`eval_slow_step` or `split_topic`) → `llm_batch_agents` → `llm_agent` (copy the phase block from 061 seed 1, `:58-67`) → `llm_human_input` (copy from 061 seed 4, `:216-223` — `prompt` + `options` keys) → `llm_single`. A gate-validator block for the CI retry leg can copy 061 seed 2's `regex_match` validator (`:123-131`: `{"kind": "regex_match", "config": {"pattern": "VERIFIED"}, "on_failure": "retry", "max_retries": 2}`).

**Header discipline** (061 `:24-27`): apply by pasting into the Supabase SQL editor — never `db push`/`db reset` — then `bash scripts/regenerate-full-schema.sh` (no reset) and commit both. Escape single quotes as `''` inside the JSONB literal. `input_keys` lesson from migration 065: the programmatic fn receives only keys listed in `config.input_keys`; live runs carry `kickoff_prompt` (see `programmatic.py:89-93`), so include `"input_keys": ["topic", "kickoff_prompt"]`.

---

### 8. `backend/app/services/harness/programmatic.py` — add `eval_slow_step` (service utility, transform)

**Analog:** its own `split_topic` + decorator. Registry pattern (`:44-62`):
```python
def register_programmatic(name: str) -> Callable[...]:
    """Decorator: register ``fn`` under ``name`` in the closed registry."""
    def deco(fn):
        PROGRAMMATIC_PHASE_REGISTRY[name] = fn
        return fn
    return deco
```
Function pattern (`:71-95` — note the contract comments to replicate):
```python
@register_programmatic("split_topic")
async def split_topic(input: dict, ctx: object) -> dict:
    # PURE + IDEMPOTENT (Pattern 3): no LLM, no side effects, deterministic output —
    # re-running this phase on resume is safe.
    topic = (input.get("topic") or input.get("kickoff_prompt") or "").strip()
    ...
    return {"sub_questions": sub_questions}
```
`eval_slow_step` = `split_topic`'s output shape + an `await asyncio.sleep(~20)` so the operator can land a mid-`programmatic` kill (Pitfall 4). Keep it pure/idempotent (sleep is not a side effect); add it to `__all__` (`:37-41`). It is referenced ONLY by the eval seed workflow.

---

### 9. `frontend/src/providers/StreamsProvider.tsx` — stream-cap LRU-3 pool (provider, streaming)

**G-5 hot file (satisfied 075.7) + sketch skill:** load `Skill("sketch-findings-agentic-rag")` before implementing — it holds the StreamsProvider/chat-surface design contracts; PANEL-06 isolation + per-thread demux MUST survive (CONTEXT locked).

**Analog:** its own existing bookkeeping. The eviction helper must replicate EXACTLY what the onTerminal wrapper does (`:1051-1059`):
```typescript
callbacks.onTerminal = (kind, errorPayload) => {
  subscriptionsRef.current.delete(producerRunId)
  useStreamsStore.setState((s) => ({
    subscriptionsByThread: _removeRunFromThread(
      s.subscriptionsByThread, threadId, producerRunId,
    ),
  }))
  originalOnTerminal(kind, errorPayload)
}
```
Eviction-safe abort (composing the above with the verified `api.ts:516-517` silent-AbortError semantics):
```typescript
// api.ts:516-517 — "AbortError means caller-initiated cancel via signal — silent return"
// → no onTerminal fires; the evictor must do the bookkeeping itself:
const controller = subscriptionsRef.current.get(runId)
controller?.abort()
subscriptionsRef.current.delete(runId)
useStreamsStore.setState((s) => ({
  subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, runId),
}))
// DO NOT touch lastSeenOffsetRef — the cursor is the D-11 replay substrate.
```

**Hook point** — `setViewingThread` (`:1134-1161`, the SOLE writer of `activeThreadIdRef`; assignment count MUST stay 1 — the regression test greps for it):
```typescript
setViewingThread: (threadId) => {
  throttledWriteRef.current?.flush()
  activeThreadIdRef.current = threadId
  useStreamsStore.setState({ viewedThreadId: threadId })
  if (threadId !== null) {
    useStreamsStore.getState().actions.reconcile(threadId).catch(...)
  }
  // 096: update MRU thread list ref + enforceStreamPool(threadId) here, AFTER reconcile fires
},
```

**Subscribe-slot reservation pattern** the 5 open sites share (reconcile attach shown, `:1259-1267`) — gate each site on the keep-set:
```typescript
if (subscriptionsRef.current.has(run.run_id)) continue   // :1259 — the short-circuit ghost
                                                          // bookkeeping breaks (Pitfall 3)
const controller = new AbortController()
subscriptionsRef.current.set(run.run_id, controller)      // WR-06: RESERVE before firing
useStreamsStore.setState((s) => ({
  subscriptionsByThread: _addRunToThread(s.subscriptionsByThread, threadId, run.run_id),
}))
```
The 5 call sites (all verified): producer re-subscribe `:1062`, reconcile transient re-attach `:1315`, reconcile attach `:1362`, sendMessage transient re-attach `:1595`, sendMessage attach `:1654`.

**Cursor seeding to preserve untouched** (`:1218-1222` — client cursors win):
```typescript
for (const [rid, cursor] of Object.entries(snapshot.since_cursors)) {
  if (!lastSeenOffsetRef.current.has(rid)) {
    lastSeenOffsetRef.current.set(rid, cursor)
  }
}
```
D-11's "snapshot then replay-attach" IS this existing reconcile path — the only new work is eviction + the `STREAM_POOL_SIZE = 3` constant + MRU ref. D-10: background "running" indicators must derive from `streamingThreads`/`snapshot.active_runs`, never from `subscriptionsByThread` membership (which now under-counts by design) — audit consumers.

---

### 10. `frontend/src/lib/api.ts` — `answerAskUser` status propagation (utility, request-response)

**FINDING (resolves RESEARCH assumption A5 — it is FALSE):** `answerAskUser` currently throws a bare `Error`, not `ApiError` (`api.ts:989`):
```typescript
if (!res.ok) throw new Error(`Failed to submit ask_user answer (status ${res.status})`)
```
**Analog pattern to copy** — `ApiError` class (`:16-23`) + `postMessage`'s throw (`:451`):
```typescript
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}
// postMessage: if (!res.ok) throw new ApiError("Failed to send message", res.status)
```
One-line change: `throw new ApiError("Failed to submit ask_user answer", res.status)` — required for PendingAskCard's 404-honesty branch (Assignment 12).

---

### 11. `backend/app/api/panel.py` — `/pending` liveness filter (controller, request-response)

**Analog:** its own query (`:103-156`). The current shape to extend:
```python
await _verify_thread_ownership(thread_id, current_user, supabase)   # :120 — RLS gate stays FIRST
pool = await get_pg_pool()
rows = await pool.fetch(
    """
    SELECT m.id, m.tool_calls, m.created_at
    FROM messages m
    WHERE m.thread_id = $1
      AND m.role = 'system'
      AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
      AND NOT EXISTS (
        SELECT 1 FROM messages r
        WHERE r.thread_id = m.thread_id
          AND r.role = 'system'
          AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
          AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
      )
    ORDER BY m.created_at ASC
    """,
    UUID(thread_id),
)
```
The D-06 liveness filter adds a branch on the prompt payload's `run_id` namespace (Pitfall 6): exclude prompts whose `tool_calls->0->>'run_id'` resolves to a terminal `workflow_runs` row OR ≠ the thread's `active_workflow_run_id`; Deep prompts (runs-keyed) get the equivalent `runs.status` check. Note asyncpg uses `$1` placeholders here (vs psycopg2 `%s` in scripts) — keep constant SQL strings, parameterized ids only. Response payload shape consumers depend on: `:144-155` (`message_id`, `tool_call_id`, `prompt`, `options`, `timeout_seconds`, `run_id`, `draft`, `created_at`).

---

### 12. `backend/app/services/harness_engine.py` — terminal-site ask_user cleanup (service, event-driven)

**Analog:** its own terminal-site choreography. The `fail_run` site (`:769-782`) shows the established ordered sequence every terminal write follows — the cleanup call slots into this sequence at each site:
```python
if outcome.kind == "fail_run":
    await fail_phase(pool, phase_id, outcome.reason)
    await finish_run(pool, run_id, "failed")
    await write_audit(
        pool, run_id, user_id=_audit_user_id,
        event_type="run_failed", metadata={"reason": outcome.reason},
    )
    await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
    await _surface_failure_message(ctx, run_id, outcome.reason, pool)
    return  # stop — no further phases
```
Terminal sites to touch (all verified): `fail_run` `:769-782`, missing-skip-target `:802-812` (the second `finish_run(..., "failed")` site), the resume finalizer `:1141-1173` (its `finally:` + `finalize_run` pattern is the model for "always run cleanup on every exit path"), and the cancel path. Cleanup representation (Open Q3): filter-first (Assignment 11 closes all history) + an INSERT-only-compatible resolution/expiry write here — never UPDATE the audit trail. IDOR posture: the `runs.py:521-567` owner-scope + anchor-confirm 404-never-403 logic is CORRECT and untouched.

---

### 13. `frontend/src/components/panel/PendingAskCard.tsx` — 404 honesty + honest countdown (component, request-response)

**Analog:** its own states. The two defects and the in-file pattern that fixes each:

**Defect 1 — silent catch** (`:216-219`):
```typescript
} catch {
  // Leave the card pending so the user can retry; never crash the panel.
  setSubmitting(false)
}
```
Fix branches on `err instanceof ApiError && err.status === 404` (after Assignment 10) → render the EXISTING expired-state pattern (`:225-246`) — calm grey, `role="status"`, no nested aria-live:
```tsx
if (state === "expired") {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--muted-foreground-dim))] bg-muted/80 p-3 opacity-90"
         role="status">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
        <span className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--muted-foreground-dim))]" aria-hidden="true" />
        Expired
      </div>
      ...
```

**Defect 2 — countdown seeds fresh on mount** (`:168`):
```typescript
const [remaining, setRemaining] = useState<number>(timeout_seconds)
```
Fix: derive initial remaining from `ask.created_at` (GET-reconciled prompts carry it — `panel.py:154`); SSE-path prompts without `created_at` fall back to `timeout_seconds` honestly (emission ≈ mount). The existing tick effect (`:170-178`) already flips to `expired` at 0 — only the seed changes.

**Test analog:** `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` (extend — `vi.mock("@/lib/api", ...)` for `answerAskUser` at `:17-20`; make the mock reject with an `ApiError(404)` for the honesty case; fixtures in `__tests__/fixtures.ts`). Keep `dangerouslySetInnerHTML == 0` (T-087-11) — text children only.

---

### 14. `backend/app/config.py` — D-05 model curation (config)

**Analog:** its own registry rows. Row shape to copy when adding entries (`:186-245`):
```python
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    "gpt-5.5":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 300, "max_output_tokens": 128000, "capability_source": "registry", "uses_max_completion_tokens": True},
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 900, "max_output_tokens": 128000, "capability_source": "registry"},
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 300, "max_output_tokens":  64000, "capability_source": "registry"},
    "gemini-3.5-flash":       {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 300, "max_output_tokens": 65536, "capability_source": "registry", "supports_parallel_tools": False, "max_tools": 16},
    "MiniMax-M2":             {"native_tools": True, "provider": "minimax", "llm_call_timeout_seconds": 300, "max_output_tokens": 131072, "capability_source": "registry"},
}
```
Conventions visible in-file: dated provenance comments per provider block ("verified against ... docs 2026-05-18", "all 7 from live /models 2026-05-30, D-089 docs curation"); google rows carry `supports_parallel_tools: False` + `max_tools: 16`; flagship-tier timeout convention is 600-900s (Open Q4: `gpt-5.5` at 300s is suspected drift — resolve during curation). Known stale comment: `:240` says "api.moonshot.cn"; actual base is `api.moonshot.ai`.

**The defaults table harness eval rows actually use** (`:594-604` — first-class curation target per Pitfall 1):
```python
_SUB_AGENT_MODEL_DEFAULTS: dict[str, str] = {
    "anthropic":  "claude-haiku-4-5-20251001",
    "openai":     "gpt-5.4-mini",
    "google":     "gemini-3.5-flash",
    "openrouter": "",   # fall back to user's selected model
    "deepseek":  "deepseek-v4-flash",
    "moonshot":  "kimi-k2.6",
    "minimax":   "MiniMax-M2.5-highspeed",
    "zhipu":     "glm-4.6",
}
```
Other curation targets: `MODEL_CONTEXT_DEFAULTS` (`:66-126`), eval `PROVIDERS` constant (`eval_cross_provider.py:68-79`), Settings `available_models` (app_settings data, not code). The live `/models` validation method per provider is tabulated in RESEARCH §Model Curation Findings; case-sensitivity matters (MiniMax PascalCase; zhipu/minimax registry-miss → inferred conservative defaults per `config.py:288-321`, no longer a structured-mode downgrade since 075.3).

---

## Shared Patterns

### Script plumbing (all new `scripts/*.py`)
**Source:** `scripts/eval_cross_provider.py:188-275, 389-453`
**Apply to:** `restart_smoke.py`, `conc_probe.py`, eval extension
The five-piece kit: `load_env` → `assert_localhost_only` (FIRST, before any DB/HTTP) → `report_env_presence` (presence-only, never values) → `get_bearer_token` (Supabase password grant, test user) → `connect_db` (psycopg2). `BackendUnavailable` for clean no-traceback exits. Constant-string allowlisted SQL, `%s` params only. Scripts live in `scripts/`, NEVER in `backend/` (uvicorn --reload watched tree).

### 404-never-403 ownership posture
**Source:** `backend/app/api/runs.py:509-567` (Step-1 runs SELECT + F10 workflow_runs fallback with thread-anchor confirm)
**Apply to:** D-06 filter (panel.py), cleanup (harness_engine.py), eval auto-answer expectations
Owner-scoped `.eq("user_id", ...)` + anchor confirm; missing/not-yours/non-anchor are INDISTINGUISHABLE (404). D-06 changes filtering/UX only — never weakens this.

### Subscription bookkeeping symmetry
**Source:** `StreamsProvider.tsx:1029-1037` (add) / `:1051-1059` (remove)
**Apply to:** every stream open/close/evict path in the stream-cap work
`subscriptionsRef` (ref) and `subscriptionsByThread` (store) are written in lockstep, always both, always in the same order. Any path that aborts a stream without firing onTerminal (eviction) must replicate the remove pair itself. `lastSeenOffsetRef` is NEVER cleaned on evict (replay substrate).

### Baseline-failure proof (all test work)
**Source:** 095.1 git-stash pattern (RESEARCH Pitfall 7)
**Apply to:** frontend vitest (~16-failure pre-existing cluster, tsc -b baseline 37) and backend pytest (large pre-existing local baseline)
Prove net-new=0 in the touched surface against the pre-plan commit — never "all green" and never raw-count compares.

### Greppable evidence markers
**Source:** `eval_cross_provider.py:587-589` (`EVAL_ROW` / `EVAL_SUMMARY` prefixes)
**Apply to:** restart_smoke banner output, conc_probe readings, the CI test name (`test_096_*`)
Every operator-facing assertion emits a machine-greppable single-token marker so VALIDATION.md and the phase-closure diff ritual can extract results with one grep.

## No Analog Found

| File | Role | Data Flow | Reason / Guidance |
|------|------|-----------|-------------------|
| `.planning/eval/capability-table-<date>.{json,md}` | versioned artifact | file-I/O | First artifact of its class. RESEARCH §Capability-Table recommends both JSON (machine-diffable, one object per provider: `{provider, model_effective, workflow_completed, phase_type_results, tool_invocation_fidelity, arg_shape_ok, retry_count, gate_failures, wall_clock_s, ask_user_roundtrip_ok}`) + Markdown twin, emitted by extending `print_scoreboard`. Planner has discretion on exact format (CONTEXT). |

## Metadata

**Analog search scope:** `scripts/`, `backend/tests/`, `backend/app/{api,services,services/harness}/`, `frontend/src/{providers,lib,components/panel}/` + `__tests__`, `supabase/migrations/`, `.github/workflows/`
**Files read (targeted):** 19
**Pattern extraction date:** 2026-06-07
**Corrections to RESEARCH.md found:** 1 — assumption A5 is FALSE: `answerAskUser` (`api.ts:989`) throws bare `Error`, not `ApiError`; the D-06 frontend fix requires the one-line api.ts touch (Assignment 10).
**Skill dependency:** `Skill("sketch-findings-agentic-rag")` must be loaded by whoever implements the StreamsProvider stream-cap (Assignment 9) — chat-surface design contracts live there.
