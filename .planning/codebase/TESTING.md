# Testing Patterns

**Analysis Date:** 2026-05-09

This codebase has THREE test surfaces:
- **Backend pytest suite** at `backend/tests/` — 70+ files, split into `unit/`, `integration/`, `api/`, plus a few legacy top-level tests
- **Frontend vitest suite** at `frontend/src/__tests__/` — 13 files covering hooks, components, lib utilities
- **Playwright E2E** at `e2e/tests/` — 9 specs, runs against the live local stack at `http://localhost:5173`

> **Local-machine note:** vitest cannot currently run locally on this developer machine because of an npm optional-dependency cascade (`@rolldown/binding-win32-x64-msvc` missing). TS-gated commits (`tsc -b && vite build` via `npm run build`) are used as a substitute. CI / other machines run vitest normally.

---

## Test Frameworks

### Backend — pytest

**Runner:**
- `pytest >= 8.0.0` with `pytest-asyncio >= 0.24.0`
- `pytest-timeout >= 2.4.0` for `@pytest.mark.timeout(N)` annotations
- Config: `backend/pytest.ini`
  ```ini
  [pytest]
  asyncio_mode = auto
  testpaths = tests
  ```
  - `asyncio_mode = auto` — every `async def test_*` is auto-collected; no per-test `@pytest.mark.asyncio` required (but most files include it explicitly anyway for clarity).

**Assertion / mocking:**
- `unittest.mock.MagicMock`, `AsyncMock`, `patch` (stdlib) — exclusive choice; no `pytest-mock`.
- HTTP route tests: `fastapi.testclient.TestClient` for sync paths; `httpx.AsyncClient` + `httpx.ASGITransport` for SSE / async paths.

**Run commands (from `backend/`, with `venv` activated):**
```bash
pytest                                    # All tests
pytest tests/integration/                 # Integration only
pytest tests/unit/test_063_post_contract.py -v   # Single file
pytest -k "test_post_then_get" -v         # By name
pytest --timeout=30                       # Override timeout
```

### Frontend — Vitest

**Runner:**
- `vitest ^4.1.0`
- Config: `frontend/vitest.config.ts`
  ```typescript
  export default defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: ["./src/setupTests.ts"],
      globals: true,
    },
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  })
  ```
- DOM env via `jsdom ^29`.
- Setup file `frontend/src/setupTests.ts` registers `@testing-library/jest-dom` matchers.

**Assertion / rendering:**
- `@testing-library/react ^16.3` (`render`, `screen`, `renderHook`, `waitFor`, `act`)
- `@testing-library/user-event ^14.6` (`userEvent.setup()` + `await user.click(...)`)
- `@testing-library/jest-dom ^6.9` matchers (`toBeInTheDocument`, `toHaveAttribute`, ...)

**Run commands (from `frontend/`):**
```bash
npm test            # vitest run (one-shot)
npm run test:watch  # vitest watch mode
npm run build       # tsc -b && vite build — TS-gated build (substitute for vitest on this machine)
```

### E2E — Playwright

**Runner:**
- `@playwright/test ^1.49`
- Config: `e2e/playwright.config.ts` — `testDir: "./tests"`, `timeout: 30_000`, `retries: 1`
- Single project: `chromium` / Desktop Chrome
- `screenshot: "only-on-failure"`, `video: "on-first-retry"`, `trace: "on-first-retry"`

**Run commands (from `e2e/`):**
```bash
npm run install-browsers  # one-time
TEST_USER_EMAIL=fhdmrd@gmail.com TEST_USER_PASSWORD=123456 npm test
npm run test:ui           # debug UI
```
- E2E spec helper: see `e2e/tests/063-refresh-mid-stream.spec.ts:38-46` for the canonical `signIn(page)` helper used across all auth-required specs.

---

## Test File Organization

### Backend layout

```
backend/tests/
├── conftest.py                 # Shared env-patching, fixtures, dependency overrides
├── __init__.py
├── unit/                       # Pure functions, no FastAPI app surface
│   ├── test_061_consumer.py    # event_consumer with FakeRedis
│   ├── test_061_emit_helper.py # _emit / _emit_terminal XADD shape
│   ├── test_062_active_runs.py
│   └── ...
├── integration/                # ASGI-level tests; real Redis often required
│   ├── _run_helpers.py         # Shared helpers (Phase 065 canonical)
│   ├── test_058_concurrency.py
│   ├── test_059_disconnect.py
│   ├── test_063_post_contract.py
│   ├── test_063_post_then_subscribe.py
│   ├── test_062_stream_replay.py
│   └── ...
├── api/                        # Lightweight route-level tests via TestClient
│   └── test_runs_cancellation.py
├── test_audit.py               # Legacy top-level tests (kept for compat)
├── test_feedback.py
└── test_provider_router.py
```

**Naming:**
- Phase-numbered tests: `test_<phase>_<topic>.py` — `test_063_post_contract.py`, `test_062_active_runs.py`. The phase number aligns with `.planning/<NNN>-<phase-name>/`.
- Topic-only tests: `test_<topic>.py` — `test_audit.py`, `test_retrieval_service.py`.
- Helper modules: leading underscore — `_run_helpers.py` — to mark them as non-test.

### Frontend layout

```
frontend/src/__tests__/
├── components/
│   ├── CitationCard.test.tsx
│   ├── ConfidenceBadge.test.tsx
│   ├── DocumentStatusBadge.test.tsx
│   ├── FolderNode.test.tsx
│   ├── FolderTree.test.tsx
│   ├── IngestionPage.test.tsx
│   ├── MessageItem.test.tsx
│   └── SuggestionPills.test.tsx
├── hooks/
│   ├── useDocuments.test.ts
│   ├── useFolders.test.ts
│   └── useMessages.test.ts
└── lib/
    ├── api.test.ts
    └── buildFolderTree.test.ts
```
- Tests are NOT colocated with source — they live under `__tests__/` mirroring the source tree. Both conventions appear in vitest projects elsewhere; this repo standardizes on the centralized layout.
- Filename mirrors target: `MessageItem.tsx` → `MessageItem.test.tsx`; `useMessages.ts` → `useMessages.test.ts`.

### E2E layout

```
e2e/tests/
├── auth.spec.ts
├── documents.spec.ts
├── threads.spec.ts
├── rag-retrieval.spec.ts
├── 060-thread-race.spec.ts
├── 063-refresh-mid-stream.spec.ts
├── 063-resume-failed.spec.ts
├── 063.1-concurrent-reconcile.spec.ts
├── 063.1-refresh-no-duplicate-bubble.spec.ts
└── 063.1-thread-switch-mid-stream.spec.ts
```
- Phase-tagged specs cover SSE / streaming behaviors that cannot be exercised at the unit level.

---

## Test Structure

### Backend pytest — class-based grouping (route tests)

```python
# backend/tests/integration/test_threads.py:70-103
class TestListThreads:
    def test_requires_auth(self, client):
        from tests.conftest import app, mock_user_data
        from app.dependencies import get_current_user
        from fastapi import HTTPException, status as http_status

        def raise_401():
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, ...)
        app.dependency_overrides[get_current_user] = raise_401
        try:
            resp = client.get("/threads")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user] = lambda: mock_user_data

    def test_returns_200_with_auth(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_thread_row()]
        response = client.get("/threads", headers=auth_headers)
        assert response.status_code == 200
```
- Test classes group by route / behavior (`TestListThreads`, `TestCreateThread`).
- Each class method receives shared fixtures by name.
- Auth override is the canonical 401 path: swap `app.dependency_overrides[get_current_user]` and restore in `finally`.

### Backend pytest — function-style (concurrency / SSE)

```python
# backend/tests/integration/test_063_post_then_subscribe.py:65-95
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_then_get_stream_renders_full_response(redis_client):
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.post(...)
                ...
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```
- Stream / concurrency tests use `@pytest.mark.asyncio` + `@pytest.mark.timeout(15)`.
- Per-test override of `app.dependency_overrides[get_supabase]` with cleanup in `finally`.
- LLM stream is patched at `app.api.threads.create_adaptive_streaming_chat` to inject a deterministic chunk generator.

### Frontend vitest — describe / it grouping

```typescript
// frontend/src/__tests__/components/CitationCard.test.tsx:19-58
describe("CitationCard", () => {
  it("renders the filename", () => {
    render(<CitationCard citation={makeCitation()} />)
    expect(screen.getByText("report.pdf")).toBeInTheDocument()
  })

  it("removes line-clamp after clicking expand toggle", async () => {
    const user = userEvent.setup()
    const { container } = render(<CitationCard citation={makeCitation()} />)
    await user.click(screen.getByRole("button", { name: /show more/i }))
    expect(container.querySelector(".line-clamp-2")).not.toBeInTheDocument()
  })
})
```

**Setup / teardown:**
```typescript
// frontend/src/__tests__/hooks/useDocuments.test.ts:57-67
describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListDocuments.mockResolvedValue([])
  })
  afterEach(() => {
    vi.clearAllMocks()
  })
})
```

**Fixture factory pattern (preferred for components):**
```typescript
// frontend/src/__tests__/components/MessageItem.test.tsx:12-23
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "user",
    content: "Hello world",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}
```

---

## Mocking

### Backend Supabase mocking — `_build_mock_supabase` (Phase 065 canonical)

Phase 065 lifted the per-table builder factory from `test_058_concurrency.py` into the shared module `backend/tests/integration/_run_helpers.py` so it is the single source of truth.

```python
# backend/tests/integration/_run_helpers.py:179-249
def _build_mock_supabase():
    """Build a mock supabase client with per-table routing.

    Per-table routing is REQUIRED — asyncio interleaving makes Thread A and Thread B
    DB calls non-deterministic in order, so a flat side_effect queue triggers
    response-validation errors when one thread picks up a row meant for another.
    """
    state = {"messages_select_count": 0, "threads_select_count": 0}

    def messages_execute(*args, **kwargs):
        state["messages_select_count"] += 1
        if state["messages_select_count"] == 1:
            time.sleep(SLOW_INSERT_DELAY)  # 1.5s — proves aexec() unblocks loop
            return _make_result([_message_row(thread_id=thread_a_id)])
        return _make_result([])

    def runs_execute(*args, **kwargs):
        return _make_result([])  # tests assert against insert/update call_args_list

    builders = {
        "threads": _make_table_builder(threads_execute),
        "messages": _make_table_builder(messages_execute),
        "runs": _make_table_builder(runs_execute),
    }
    default_builder = _make_table_builder(default_execute)

    sb = MagicMock()
    sb.table.side_effect = lambda name: builders.get(name, default_builder)
    sb.rpc.return_value = default_builder
    ...
    return sb
```

**Companion helpers in `_run_helpers.py`:**
- `_make_table_builder(execute_fn)` — chainable builder (`select`, `insert`, `update`, `eq`, `in_`, `or_`, `is_`, `order`, `limit`, `single`, `maybe_single`, `gte`, `lt`, `range`, `upsert`).
- `_make_result(data)` — mimics Supabase `APIResponse` shape (`.data`, `.count`).
- `_make_sse_chunk(content)` / `_make_done_chunk()` — OpenAI streaming-chunk mocks for `create_adaptive_streaming_chat` patches.
- `_fast_chunks()` / `_slow_chunks(delay, count)` — sync chunk generators (NOT async — see Pitfall warning in `_slow_chunks` docstring at `_run_helpers.py:105-122`).
- `_extract_run_id_from_mock(mock_supabase)` — pulls the streaming run UUID from the runs-table INSERT call args, filtering by `status='streaming'` (D-061.1-12).
- `await_producer_finalized(mock_supabase, timeout=10.0)` — keystone race-resolver. Awaits the producer task in `RUN_TASKS` so assertions happen after `_shielded_finalize` lands all 5 ordered side-effects (D-061.1-01/02/03).
- `setup_zombie_state(redis_client, mock_supabase, run_id, thread_id, n_entries=1)` — Phase 062 zombie-state harness for DELETE-zombie tests (D-062-11).

### Backend conftest — global supabase mock + per-test reset

`backend/tests/conftest.py` provides a flat shared mock for the simpler integration tests that do NOT need per-table routing:

```python
# backend/tests/conftest.py:69-81
_execute_result = _make_execute_result()
_builder = _make_builder(_execute_result)
_supabase = _make_supabase(_builder, _execute_result)

mock_user_data = {"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}

from app.main import app
from app.dependencies import get_current_user, get_supabase
app.dependency_overrides[get_current_user] = lambda: mock_user_data
app.dependency_overrides[get_supabase] = lambda: _supabase
```

**The autouse `reset_mocks` fixture (`conftest.py:86-134`)** is critical — it:
1. Restores canonical `dependency_overrides` (so a test that swaps `get_supabase` doesn't leak state).
2. Resets `_execute_result.data = []`.
3. Clears `_builder.execute.side_effect` (a leftover side_effect list raises `StopIteration` in the next test).
4. Re-assigns each chained method's `return_value` back to `_builder`.
- Runs before AND after every test (autouse + yield).

### Backend Redis mocking

**Real Redis (preferred for integration tests):**
```python
# backend/tests/conftest.py:174-199
_REDIS_TEST_URL = _os.environ.get("REDIS_URL", "redis://localhost:6379")

@_pytest_asyncio.fixture
async def redis_client():
    import redis.asyncio as aioredis
    client = aioredis.from_url(_REDIS_TEST_URL, encoding="utf-8", decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()
```
- **Function-scoped (NOT session) — required:** pytest-asyncio creates a fresh event loop per test (`asyncio_mode = auto`), and a session-scoped client would bind to the FIRST loop.
- `decode_responses=True` so `XREAD` entries arrive as `str`.
- UUID-isolated test data (D-061-17) — no key prefixing needed.

**`_reset_redis_singleton` autouse per-file fixture (Phase 062 D-062-14, copied verbatim into Phase 063 tests):**
```python
# backend/tests/integration/test_063_post_then_subscribe.py:45-62
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis so each test gets a Redis client bound to
    its own per-test event loop. Without this, a singleton from test N's loop is
    invoked by test N+1 against a closed loop → RuntimeError("Event loop is closed").
    """
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```
- Required in every integration test that hits the real `get_redis()` singleton.
- Mirror of `_reset_sse_starlette_app_status` from `test_059_disconnect.py` (same loop-binding trap, different module).

**Fake Redis for unit tests (`backend/tests/unit/test_061_consumer.py`):** hand-rolled `_FakeRedisAdvancesCursor` class implementing the minimal `xread` protocol the consumer requires. No `fakeredis` library — D-061-14 explicitly forbids it.

**`AsyncMock` for one-shot XADD assertions:**
```python
# backend/tests/unit/test_061_emit_helper.py:14-25
mock_redis = AsyncMock()
await _emit(mock_redis, run_id, "delta", content="hello")
mock_redis.xadd.assert_awaited_once()
args, kwargs = mock_redis.xadd.call_args
assert args[0] == f"run:{run_id}"
assert kwargs.get("maxlen") == 10000
```

### Backend LLM mocking — patch the call site

```python
# Standard pattern (test_063_post_then_subscribe.py:86-95)
with patch(
    "app.api.threads.create_adaptive_streaming_chat",
    side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
), patch(
    "app.services.suggestion_service.generate_suggestions",
    return_value=([], None),
), patch(
    "app.api.threads.generate_thread_title",
    return_value=("T", None),
):
    ...
```
- Patch where the symbol is **looked up** (`app.api.threads.create_adaptive_streaming_chat`), not where defined (`app.services.openai_service.create_adaptive_streaming_chat`).
- `side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE)` — adapter returns a `(stream, calling_mode)` tuple.

### Backend POST → GET-stream pattern (Phase 063 canonical)

The canonical end-to-end pattern after Phase 063 — used by every test that exercises the agent loop end-to-end:

```python
# backend/tests/integration/test_063_post_then_subscribe.py:96-159
async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
    # Step 1: POST returns 201 + JSON envelope (NOT SSE)
    resp = await ac.post(
        f"/threads/{THREAD_A}/messages",
        headers={"Authorization": "Bearer test-token"},
        json={"content": "hello", "agent_mode": "default"},
    )
    assert resp.status_code == 201
    ctype = resp.headers.get("content-type", "")
    assert ctype.startswith("application/json")          # anti-false-RED guard
    body = resp.json()
    assert "run_id" in body
    run_id = body["run_id"]

    # Step 2: small sleep so producer's first XADD lands (Pitfall 4)
    await asyncio.sleep(0.2)

    # Step 3: configure mock so /runs/{rid}/stream ownership SELECT succeeds
    runs_builder = mock_supabase.table("runs")
    runs_builder.execute.side_effect = lambda *a, **k: type("R", (), {
        "data": {"run_id": run_id, "status": "streaming",
                 "thread_id": THREAD_A, "error": None},
        "count": None,
    })()

    # Step 4: GET /runs/{rid}/stream?since=0 — drain to first TERMINAL_TYPES event
    events = []
    async with ac.stream(
        "GET", f"/runs/{run_id}/stream?since=0",
        headers={"Authorization": "Bearer test-token"},
        timeout=30.0,
    ) as stream_resp:
        assert stream_resp.status_code == 200
        async for line in stream_resp.aiter_lines():
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                events.append(payload)
                if payload.get("type") in TERMINAL_TYPES:
                    break

assert any(e.get("type") == "delta" for e in events)
assert events[-1].get("type") in TERMINAL_TYPES
```

**Why this pattern (Phase 063 D-063-01):** before 063, POST itself returned an SSE stream. After 063, POST returns JSON synchronously while a detached producer task writes to Redis Stream `run:{run_id}`; consumers (one or many) attach via `GET /runs/{rid}/stream?since=N`.

### Frontend mocking with `vi.hoisted` + `vi.mock`

Vitest hoists `vi.mock` calls to the top of the file; closure-captured mock functions must be created via `vi.hoisted()`:

```typescript
// frontend/src/__tests__/hooks/useMessages.test.ts:25-58
const {
  mockPostMessage,
  mockSubscribeToRun,
  mockGetMessages,
  mockGetActiveRuns,
  mockCancelRun,
} = vi.hoisted(() => ({
  mockPostMessage: vi.fn(),
  mockSubscribeToRun: vi.fn(),
  mockGetMessages: vi.fn(),
  mockGetActiveRuns: vi.fn(),
  mockCancelRun: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  postMessage: mockPostMessage,
  subscribeToRun: mockSubscribeToRun,
  getMessages: mockGetMessages,
  getActiveRuns: mockGetActiveRuns,
  cancelRun: mockCancelRun,
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { useMessages } from "@/hooks/useMessages"
```

**SSE mocking (NOVEL — documented in 067.4-PATTERNS.md):**
```typescript
// frontend/src/__tests__/hooks/useMessages.test.ts:76-91
function makeSseRecorder() {
  const callbacksByRunId: Map<string, StreamCallbacks> = new Map()
  let lastCallbacks: StreamCallbacks | null = null
  mockSubscribeToRun.mockImplementation(
    async (runId: string, _since: string, callbacks: StreamCallbacks, _signal?: AbortSignal) => {
      callbacksByRunId.set(runId, callbacks)
      lastCallbacks = callbacks
      // Never resolves — caller drives event arrival via captured callbacks.
      return new Promise<void>(() => {})
    },
  )
  return {
    last: () => lastCallbacks,
    forRun: (runId: string) => callbacksByRunId.get(runId),
  }
}
```
- Mock `subscribeToRun` returns a never-resolving Promise; the test orchestrates `onDelta`, `onToolStart`, `onToolEnd`, `onTerminal` calls manually inside `act()`.

**Always mock `@/lib/supabase` in component tests** to prevent real Auth / channel calls:
```typescript
// frontend/src/__tests__/components/IngestionPage.test.tsx:29-43
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  },
}))
```

### What to mock / NOT to mock

**Mock:**
- Supabase client (`@/lib/supabase` on the frontend, `get_supabase` dependency on the backend).
- LLM SDK call sites (`create_adaptive_streaming_chat`, `stream_anthropic`, etc.) — patch at lookup site.
- `subscribeToRun` SSE consumer (frontend hook tests).
- `@tanstack/react-query` / hooks that wrap network I/O.
- `@/lib/api` module functions in component / hook tests.

**Do NOT mock:**
- Redis in integration tests — use the real `redis_client` fixture (D-061-14 explicit ban on fakeredis).
- The `app.api.threads` module's internal helpers (`_emit`, `event_consumer`, `RUN_TASKS`) — exercise them directly.
- React state primitives, refs, or lifecycle hooks — render via `@testing-library/react`'s `renderHook` instead.
- `app.utils.db.aexec` — let it run through to the mocked supabase client.

---

## Fixtures and Factories

### Backend conftest fixtures (`backend/tests/conftest.py`)

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `client` | function | `TestClient(app)` context manager |
| `mock_user` | function | `mock_user_data` dict (id `00000000-...-001`) |
| `auth_headers` | function | `{"Authorization": "Bearer test-token"}` |
| `mock_execute_result` | function | The shared `_execute_result` MagicMock (set `.data` per test) |
| `mock_builder` | function | The shared `_builder` MagicMock (set `.side_effect` per test) |
| `redis_client` | function | Real `aioredis.from_url(REDIS_URL, decode_responses=True)` |
| `reset_mocks` | function (autouse) | Resets shared MagicMocks + dependency overrides between tests |
| `_flushdb_at_session_end` | session (autouse) | Sync `FLUSHDB` at session teardown (best-effort) |

### Per-file autouse Redis fixtures (Phase 062 / 063 pattern)

Each integration test file that touches the real Redis singleton MUST include a verbatim copy of `_reset_redis_singleton` — it is not promoted to conftest because it has cross-loop dependencies that conflict with session-level setup. Source of truth: `backend/tests/integration/test_062_stream_replay.py:36-51`. Mandate: Phase 063 PATTERNS.md.

### Backend factory functions (in `_run_helpers.py`)

- `_thread_row(thread_id=DEFAULT_THREAD_PLACEHOLDER)` — minimal `threads` row matching production schema.
- `_message_row(role="user", content="hello", thread_id=None)` — `messages` row with role/content overrides.
- `_make_result(data)` — `APIResponse`-shaped MagicMock with `.data`, `.count`.

### Frontend factory functions

```typescript
// frontend/src/__tests__/components/MessageItem.test.tsx:12-23
function makeMessage(overrides: Partial<Message> = {}): Message { ... }

// frontend/src/__tests__/components/CitationCard.test.tsx:7-17
function makeCitation(overrides: Partial<Citation> = {}): Citation { ... }
```
- Each test file declares its own factory locally — no shared `frontend/src/__tests__/fixtures/` directory.

### Test-only API endpoint (Phase 063 Plan 05)

`backend/app/api/test_fixtures.py` — gated by `ENABLE_TEST_FIXTURES=1` env var.
- Used by Playwright E2E specs to inject failed runs (`POST /__test__/inject-failed-run`) without driving a real producer.
- BL-04 fix in `main.py:161-173`: refuses to start when `ENABLE_TEST_FIXTURES=1` AND `ENVIRONMENT in ("production", "prod")` — belt-and-suspenders against accidental prod exposure.
- CI / staging / prod env files MUST NOT set this variable.

---

## Coverage

**Backend:**
- No coverage threshold enforced.
- `pytest-cov` is NOT in `requirements.txt`; coverage is measured ad-hoc with `pip install coverage && coverage run -m pytest && coverage report`.

**Frontend:**
- Vitest's `c8` coverage is available via `npm test -- --coverage` but no threshold is configured.
- Local-machine vitest run is currently broken (npm optional-deps cascade) — TS-gated build (`npm run build`) is the de facto coverage substitute.

**E2E:** N/A.

---

## Test Types

### Unit tests (`backend/tests/unit/`)

- Pure functions or single-class behaviors with no FastAPI app surface mounted.
- Examples:
  - `test_061_emit_helper.py` — XADD shape assertions on `_emit` / `_emit_terminal`.
  - `test_061_consumer.py` — drives the real `event_consumer` async generator with a hand-rolled fake Redis.
  - `test_streaming_reliability.py` — TDD-RED-style coverage of stop-event invariants.
  - `test_anthropic_service.py`, `test_openai_service.py`, `test_retrieval_service.py`, `test_embedding_service.py` — service-layer unit coverage.

### Integration tests (`backend/tests/integration/`)

- Mount the FastAPI app via `httpx.AsyncClient + ASGITransport`.
- Often require real Redis (`redis_client` fixture).
- Patch LLM stream generators + suggestion service to keep tests deterministic.
- Examples:
  - `test_058_concurrency.py` — cross-tab race; relies on `SLOW_INSERT_DELAY = 1.5s` to prove `aexec()` unblocks the event loop.
  - `test_059_disconnect.py` — client mid-stream disconnect; introduces `_reset_sse_starlette_app_status` (the loop-binding fix referenced everywhere).
  - `test_062_stream_replay.py`, `test_062_delete_*.py`, `test_062_multi_consumer_fanout.py` — Redis Stream replay + DELETE branches.
  - `test_063_post_contract.py`, `test_063_post_then_subscribe.py` — POST contract + roundtrip.
  - `test_063_1_messages_runs_join.py` — D-063.1-13/15 LEFT JOIN validation.
  - `test_066_*.py` — per-call timeout + system-timeout terminal classification.
  - `test_067_4_suggestion_emit.py` — suggestion-emit timing.

### E2E tests (`e2e/tests/`)

- Drive a real browser against the live local stack.
- Each spec defines its own `signIn(page)` / `createNewThread(page)` / `sendMessageInActiveThread(page, text)` helpers (deduplicated locally; not shared).
- Long-stream prompts use a deterministic phrasing that triggers multi-tool retrieval (~5s+ stream) — see `LONG_STREAM_PROMPT` constant in `e2e/tests/063-refresh-mid-stream.spec.ts:35-36`.

---

## Common Patterns

### Async test guard

```python
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_xyz(redis_client):
    ...
```
- Always combine `asyncio` + `timeout` for stream / Redis tests (default pytest run has no per-test timeout otherwise).

### Reading SSE lines from the consumer

```python
async for line in stream_resp.aiter_lines():
    if line.startswith("data: "):
        payload = json.loads(line[6:])
        events.append(payload)
        if payload.get("type") in TERMINAL_TYPES:
            break
```
- Strip the `data: ` prefix (6 chars) — sse-starlette wraps each event in `data: <json>\n\n`.

### Anti-false-RED guard

```python
ctype = resp.headers.get("content-type", "")
assert ctype.startswith("application/json"), (
    f"Expected JSON content-type, got {ctype!r}"
)
```
- Phase 063 hardening: assert content-type BEFORE `resp.json()` so a stale SSE response (legacy POST contract) reports a recognizable contract error instead of a JSON-decode trace.

### Race-resolver helper

```python
from tests.integration._run_helpers import await_producer_finalized
await await_producer_finalized(mock_supabase, timeout=10.0)
# Now safe to assert on mock_supabase.table("runs").update.call_args_list
```
- Use BEFORE asserting on `update`/`insert` `call_args_list` to eliminate the window where `_shielded_finalize` is detached.

### Frontend SSE event drive

```typescript
const sseRecorder = makeSseRecorder()
const { result } = renderHook(() => useMessages())

await act(async () => {
  await result.current.sendMessage("thread-A", "hello")
})
const cb = sseRecorder.last()!

await act(async () => {
  cb.onDelta?.("Hi ")
  cb.onToolStart?.("search_documents", { query: "x" })
  cb.onToolEnd?.("search_documents", "ok")
  cb.onTerminal?.("done")
})

await waitFor(() => {
  expect(result.current.isStreaming).toBe(false)
})
```

### Error testing (Python)

```python
# backend/tests/unit/test_061_emit_helper.py:43-50
@pytest.mark.asyncio
async def test_emit_terminal_rejects_non_terminal_type():
    from app.api.threads import _emit_terminal
    mock_redis = AsyncMock()
    with pytest.raises(ValueError, match="TERMINAL_TYPES"):
        await _emit_terminal(mock_redis, uuid.uuid4(), "delta")
```

### Error testing (TypeScript)

```typescript
expect(() => render(<Component badProp={null} />)).toThrow(/required/i)

await expect(api.listThreads()).rejects.toThrow("Failed to list threads")
```

### Auth override (sync `client` fixture)

```python
# Pattern from backend/tests/integration/test_threads.py:71-84
def raise_401():
    raise HTTPException(status_code=401, detail="Not authenticated")
app.dependency_overrides[get_current_user] = raise_401
try:
    resp = client.get("/threads")
    assert resp.status_code == 401
finally:
    app.dependency_overrides[get_current_user] = lambda: mock_user_data
```

### Per-test mock_execute_result data

```python
def test_returns_list(self, client, auth_headers, mock_execute_result):
    mock_execute_result.data = [_thread_row()]   # set BEFORE the request
    response = client.get("/threads", headers=auth_headers)
    assert response.json()[0]["title"] == "New Chat"
```

---

## Phase Tag Reference

When reading test files, these phase markers indicate WHY a pattern exists. Preserve them when editing:

- **Phase 058** — D-058-03/D-058-07: AnyIO threadpool sizing + `aexec()` introduction.
- **Phase 059** — D-059-04: cooperative cancellation; `_reset_sse_starlette_app_status` fixture origin.
- **Phase 061** — D-061-04, D-061-11/13/14/17: Redis Stream introduction; `_emit` / `_emit_terminal` / `RUN_TASKS` registry; UUID-isolated test data; no fakeredis.
- **Phase 061.1** — D-061.1-01/02/03: `await_producer_finalized` keystone helper. D-061.1-12: `_extract_run_id_from_mock` IN-02 hardening.
- **Phase 062** — D-062-05/07/14: replay-tail consumer with `since` cursor; `_reset_redis_singleton` per-file fixture mandate.
- **Phase 063** — D-063-01: POST returns JSON envelope (NOT SSE); `GET /runs/{rid}/stream` is the new streaming surface. Plan 05: `[data-testid="assistant-message"]` selector for E2E.
- **Phase 065** — Test infrastructure repair: `_run_helpers.py` lifted from `test_058_concurrency.py`; `_build_mock_supabase` is the shared canonical mock factory.
- **Phase 066** — D-066-03/04/06: per-LLM-call timeout + 5th terminal type `timed_out`.
- **Phase 067** / **067.1** / **067.3** / **067.4** — frontend per-thread message bucket; tool-stage handler patches; sandbox heartbeat.

---

*Testing analysis: 2026-05-09*
