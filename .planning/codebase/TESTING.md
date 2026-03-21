# Testing Patterns

_Generated: 2026-03-21_

## Summary

The project has three distinct test tiers: Python unit/integration tests (pytest), frontend unit tests (Vitest + Testing Library), and full-stack E2E tests (Playwright). Backend tests use a shared `conftest.py` that mocks the entire Supabase client and injects a test auth user. Frontend tests mock the `@/lib/api` and `@/lib/supabase` modules wholesale. E2E tests require live infrastructure and are credential-gated.

---

## Test Frameworks

### Backend
- **Runner:** pytest `>=8.0.0`
- **Async support:** pytest-asyncio `>=0.24.0`, configured `asyncio_mode = auto` in `pytest.ini`
- **HTTP client:** httpx `>=0.27.0` + FastAPI `TestClient` (from `starlette.testclient`)
- **Mocking:** Python standard library `unittest.mock` (`MagicMock`, `patch`)
- **Config:** `backend/pytest.ini` — `testpaths = tests`, `asyncio_mode = auto`

### Frontend
- **Runner:** Vitest `^4.1.0`
- **DOM environment:** jsdom `^29.0.0`
- **Component rendering:** `@testing-library/react` `^16.3.2`
- **User interaction:** `@testing-library/user-event` `^14.6.1`
- **DOM assertions:** `@testing-library/jest-dom` `^6.9.1`
- **Config:** `frontend/vitest.config.ts` — `environment: "jsdom"`, `globals: true`, `setupFiles: ["./src/setupTests.ts"]`
- **Path alias:** `@/` → `src/` resolved in vitest config

### E2E
- **Runner:** Playwright (config in `e2e/`)
- **Language:** TypeScript

---

## Run Commands

```bash
# Backend (from backend/ with venv activated)
pytest                          # run all tests
pytest tests/unit/              # unit tests only
pytest tests/integration/       # integration tests only
pytest -v                       # verbose

# Frontend (from frontend/)
npm test                        # vitest run (single pass)
npm run test:watch              # vitest (watch mode)

# E2E (from e2e/)
npx playwright test             # all specs (requires live app + TEST_USER_EMAIL/PASSWORD)
```

---

## Test File Organization

### Backend

```
backend/tests/
├── conftest.py                  # shared fixtures, Supabase mock, FastAPI TestClient
├── unit/
│   ├── test_embedding_service.py
│   ├── test_module7_tools.py
│   ├── test_openai_service.py
│   ├── test_retrieval_service.py
│   ├── test_sql_service.py
│   └── test_web_search_service.py
└── integration/
    ├── test_documents.py
    ├── test_health.py
    └── test_threads.py
```

- Unit tests: pure logic, all external calls mocked with `patch`
- Integration tests: full HTTP request/response via `TestClient`, Supabase mocked at fixture level

### Frontend

```
frontend/src/__tests__/
├── components/
│   ├── DocumentStatusBadge.test.tsx
│   └── MessageItem.test.tsx
├── hooks/
│   └── useDocuments.test.ts
└── lib/
    └── api.test.ts
```

Test files are NOT co-located with source. They live in `src/__tests__/` mirroring the `src/` directory structure.

### E2E

```
e2e/
├── fixtures/
│   └── test-document.txt        # document used in upload/retrieval tests
└── tests/
    ├── auth.spec.ts
    ├── documents.spec.ts
    ├── rag-retrieval.spec.ts
    └── threads.spec.ts
```

---

## Test Structure

### Backend Unit Tests (pytest class style)

```python
class TestChunkTextEdgeCases:
    def test_empty_string_returns_empty_list(self):
        assert chunk_text("") == []

    def test_long_text_returns_multiple_chunks(self):
        text = "x" * 300
        result = chunk_text(text, chunk_size=100, overlap=20)
        assert len(result) >= 3
```

Test classes group related cases by subject. No `unittest.TestCase` inheritance — plain classes with `pytest` collection.

### Backend Integration Tests

```python
class TestUploadDocument:
    def test_valid_txt_upload_returns_201(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_doc_row()]
        with patch("app.api.documents.ingest_document"):
            response = client.post(
                "/documents/upload",
                headers=auth_headers,
                files={"file": ("test.txt", b"Hello world content", "text/plain")},
            )
        assert response.status_code == 201
```

### Frontend Unit Tests (Vitest)

```typescript
describe("MessageItem – streaming state", () => {
  it("shows thinking indicator when streaming with empty content", () => {
    render(
      <MessageItem
        message={makeMessage({ role: "assistant", content: "" })}
        isStreaming={true}
      />,
    )
    expect(screen.getByText(/thinking/i)).toBeInTheDocument()
  })
})
```

### E2E Tests (Playwright)

```typescript
test.describe("Authentication", () => {
  test("sign in with valid credentials shows chat interface", async ({ page }) => {
    if (!hasCredentials) { test.skip(); return }
    await page.goto("/")
    // ... interaction
    await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
  })
})
```

---

## Mocking

### Backend — Shared Supabase Fixture (`backend/tests/conftest.py`)

A fluent chainable `MagicMock` is built once and reset before each test via `autouse=True` fixture:

```python
def _make_builder(execute_result):
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.eq.return_value = b
    b.order.return_value = b
    b.single.return_value = b
    b.execute.return_value = execute_result
    return b
```

The entire `get_supabase` dependency is overridden at app level: `app.dependency_overrides[get_supabase] = lambda: _supabase`.

Auth is similarly overridden: `app.dependency_overrides[get_current_user] = lambda: mock_user_data`.

To configure specific test data, fixtures accept `mock_execute_result` and set `.data`:
```python
def test_returns_list(self, client, auth_headers, mock_execute_result):
    mock_execute_result.data = [_doc_row()]
    response = client.get("/documents", headers=auth_headers)
```

For tests needing call-by-call control, `mock_builder.execute.side_effect = [result1, result2, ...]` is used.

### Backend — Service Unit Test Mocking

Service tests use `patch` as a context manager to mock external dependencies:

```python
def test_calls_embed_texts_with_query(self):
    sb = _make_supabase()
    with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]) as mock_embed:
        search_documents("test query", USER_ID, sb)
        mock_embed.assert_called_once_with(["test query"])
```

Settings are patched at the module level: `with patch("app.services.openai_service.settings") as mock_settings`.

### Frontend — Module Mocking (Vitest)

Uses `vi.mock()` with `vi.hoisted()` to ensure mocks are available before module imports:

```typescript
const { mockListDocuments, mockUploadDocument, mockDeleteDocument } = vi.hoisted(() => ({
  mockListDocuments: vi.fn(),
  mockUploadDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listDocuments: mockListDocuments,
  uploadDocument: mockUploadDocument,
  deleteDocument: mockDeleteDocument,
}))
```

Supabase client is mocked to return a fake channel:
```typescript
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "token" } } }) },
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))
```

`fetch` is mocked globally per-test:
```typescript
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue(body) }))
```

---

## Test Data Helpers

### Backend — Row Factory Functions

Tests define module-level factory functions that produce fixture dicts:
```python
def _doc_row(doc_id=None, status="pending"):
    return {
        "id": doc_id or DOC_ID,
        "user_id": USER_ID,
        "filename": "test.txt",
        "status": status,
        # ... all required fields
    }
```

Fixed UUIDs used: `USER_ID = "00000000-0000-0000-0000-000000000001"`, `DOC_ID = str(uuid4())`.

### Frontend — Object Factory Functions

```typescript
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

## Parametrize

Backend tests use `@pytest.mark.parametrize` for testing the same assertion across multiple inputs:

```python
@pytest.mark.parametrize("tool", [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, WEB_SEARCH_TOOL])
def test_tool_has_type_function(self, tool):
    assert tool["type"] == "function"
```

---

## Coverage

**No coverage enforcement configured.** Neither `pytest-cov` nor a coverage threshold is present in `pytest.ini`, `requirements.txt`, or `package.json`.

**Rough estimate by area:**

| Area | Coverage | Notes |
|------|----------|-------|
| `embedding_service.chunk_text` | High | 11 dedicated unit tests for edge cases |
| `retrieval_service.search_documents` | High | 8 unit tests with full mock control |
| `openai_service` client factories | High | 7 unit tests for LLM + embedding client config |
| `openai_service` tool schemas / `get_tools()` | High | 15 parametrized + dedicated tests |
| `documents` API endpoints | Medium-High | Integration tests for list, upload (7 cases), delete |
| `threads` API endpoints | Medium | Integration tests exist (`test_threads.py`) |
| `MessageItem` component | Medium | 12 tests covering user/assistant/streaming states |
| `DocumentStatusBadge` component | High | All 4 status variants tested |
| `api.ts` library | Medium | 6 describe blocks covering main CRUD operations |
| `useDocuments` hook | Medium | Initial state, fetch, upload lifecycle, delete |
| `retrieval_service` hybrid path | Low | Unit tests cover vector-only path; hybrid/RRF not tested |
| `sub_agent_service` | Low | No unit tests found |
| `web_search_service` / `sql_service` | Low | Test files exist but focus on tool schema, not service logic |
| `useMessages` hook | None | No test file found |
| `useThreads` / `useAuth` hooks | None | No test files found |
| E2E — auth flow | Medium | 4 scenarios, credential-gated for 3 |
| E2E — document upload/management | Medium | 5 scenarios, all credential-gated |
| E2E — RAG retrieval | Low | 3 scenarios, credential-gated, requires live Supabase |

---

## Test Types

### Unit Tests
- **Backend:** `backend/tests/unit/` — test pure service functions with all I/O mocked; no FastAPI app involved
- **Frontend:** `frontend/src/__tests__/` — test React components with `@testing-library/react` and hook logic with `renderHook`

### Integration Tests
- **Backend:** `backend/tests/integration/` — test full HTTP request/response cycle through FastAPI `TestClient`; Supabase mocked at fixture level but all FastAPI middleware, routing, and Pydantic validation are exercised

### E2E Tests
- **Location:** `e2e/tests/`
- **Scope:** Full browser automation against a live running app (frontend + backend + Supabase)
- **Credential gating:** Most tests call `if (!hasCredentials) { test.skip(); return }` so they pass in CI without secrets

---

## Testing Gaps

**Backend:**
- `sub_agent_service.py` — no tests; logic for streaming LLM sub-agent is untested
- `rerank_service.py` — no tests found
- Hybrid search path in `retrieval_service.search_documents` — RRF fusion and reranking logic not unit-tested
- `ingest_document` background function in `backend/app/api/documents.py` — the integration tests mock it away; the chunking + embedding + status update flow is not tested end-to-end
- SSE streaming logic in `backend/app/api/threads.py` — the `event_stream` generator, tool dispatch loop, and `MAX_ITERATIONS` guard have no test coverage

**Frontend:**
- `useMessages` hook — no tests; most complex hook in the codebase (optimistic UI, streaming delta, tool call tracking, sub-agent state)
- `useThreads` hook — no tests
- `useAuth` hook — no tests
- `ChatArea`, `MessageList`, `MessageInput`, `ToolCallPanel`, `MarkdownRenderer` components — no tests
- `streamMessage` function in `api.ts` — SSE parsing logic not tested (only CRUD methods are tested)

**E2E:**
- Thread creation and rename flows — `e2e/tests/threads.spec.ts` exists but content not reviewed; assumed credential-gated
- Tool call UI (tool call panel rendering during streaming) — no E2E coverage found
- Sub-agent streaming UI — no E2E coverage found
