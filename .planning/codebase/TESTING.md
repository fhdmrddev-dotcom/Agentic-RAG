# Testing Patterns
_Last updated: 2026-04-05_

## Test Frameworks

### Backend: pytest
- Framework: `pytest >= 8.0.0` with `pytest-asyncio >= 0.24.0`
- Config: `backend/pytest.ini` — `asyncio_mode = auto`, `testpaths = tests`
- HTTP client for route tests: `fastapi.testclient.TestClient` (sync wrapper around ASGI)
- Mocking: `unittest.mock` (stdlib `MagicMock`, `patch`)
- No coverage tool configured

### Frontend: Vitest
- Framework: `vitest ^4.1.0`
- Config: `frontend/vitest.config.ts` — `environment: "jsdom"`, `globals: true`, `setupFiles: ["./src/setupTests.ts"]`
- DOM assertions: `@testing-library/jest-dom ^6.9.1` (imported in `frontend/src/setupTests.ts`)
- Component rendering: `@testing-library/react ^16.3.2`
- User events: `@testing-library/user-event ^14.6.1`
- Path alias `@/` resolved via vitest config to match the app config

### E2E: Playwright
- Framework: `@playwright/test` (Chromium only)
- Config: `e2e/playwright.config.ts` — `baseURL: "http://localhost:5173"`, `timeout: 30_000`, `retries: 1`
- Screenshot on failure, video on first retry, trace on first retry
- **Does NOT auto-start servers** — requires frontend and backend already running

## Run Commands

### Backend tests
```bash
cd backend
source venv/bin/activate        # activate virtualenv
pytest                          # run all tests
pytest tests/unit/              # unit tests only
pytest tests/integration/       # integration tests only
pytest tests/unit/test_embedding_service.py  # single file
pytest -v                       # verbose output
```

### Frontend tests
```bash
cd frontend
npm run test          # vitest run (single pass, CI mode)
npm run test:watch    # vitest (watch mode for development)
```

### E2E tests
```bash
cd e2e
# Requires: frontend at :5173, backend at :8000, and env vars set
TEST_USER_EMAIL=user@example.com TEST_USER_PASSWORD=secret npx playwright test
npx playwright test --ui          # Playwright UI mode
npx playwright show-report        # view last run report
```

## Test File Organization

### Backend
```
backend/
  pytest.ini
  tests/
    conftest.py                          # shared fixtures, mock setup, app overrides
    __init__.py
    unit/
      test_embedding_service.py          # chunk_text pure-logic tests
      test_retrieval_service.py          # search_documents with mocked OpenAI + Supabase
      test_openai_service.py             # LLM client / streaming chat logic
      test_explorer_agent.py             # explorer agent tool dispatch
      test_module7_tools.py              # kb tool functions
      test_sql_service.py                # query_documents service
      test_web_search_service.py         # Tavily web search service
      test_sandbox_service.py            # SandboxSessionManager lifecycle
      test_sandbox_tools.py              # code execution tool wrapper
      test_tool_memory.py                # tool memory / context management
    integration/
      test_health.py                     # GET /health
      test_threads.py                    # /threads CRUD + SSE streaming
      test_documents.py                  # /documents upload, list, delete
      test_folders.py                    # /folders CRUD, move, toggle-global
      test_kb.py                         # /kb ls, tree, grep, glob, read_document
      test_skills.py                     # /skills CRUD, toggle-enabled, toggle-global
      test_skills_import_export.py       # skill import/export endpoints
      test_threads_skills.py             # skill activation during chat
```

### Frontend
```
frontend/src/
  setupTests.ts                          # jest-dom import
  __tests__/
    components/
      DocumentStatusBadge.test.tsx       # status badge rendering
      FolderNode.test.tsx                # folder tree node interactions
      FolderTree.test.tsx                # full tree rendering
      IngestionPage.test.tsx             # ingestion page integration
      MessageItem.test.tsx               # message rendering (user/assistant)
    hooks/
      useDocuments.test.ts               # useDocuments hook behavior
      useFolders.test.ts                 # useFolders hook + Realtime mock
    lib/
      api.test.ts                        # API client (fetch mocking)
      buildFolderTree.test.ts            # buildFolderTree pure-function tests
```

### E2E
```
e2e/
  playwright.config.ts
  tests/
    auth.spec.ts                         # sign-in, sign-up, invalid credentials
    documents.spec.ts                    # document upload, list, delete
    threads.spec.ts                      # create/rename/delete chat threads
    rag-retrieval.spec.ts                # RAG query produces a response
```

## Backend Test Structure

### Shared Fixtures (`backend/tests/conftest.py`)

The conftest wires up a full mock Supabase client and overrides FastAPI's dependency injection for all tests:

```python
# Env vars patched before any app import (pydantic-settings reads at class init time)
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

# Dependency overrides applied to the app object
app.dependency_overrides[get_current_user] = lambda: mock_user_data
app.dependency_overrides[get_supabase] = lambda: _supabase
```

Key fixtures:
- `client` — `TestClient(app)` for HTTP route tests
- `auth_headers` — `{"Authorization": "Bearer test-token"}`
- `mock_user` — `{"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}`
- `mock_execute_result` — the shared Supabase query result mock (set `.data` per test)
- `mock_builder` — the shared fluent query builder mock (configure `side_effect` per test)
- `reset_mocks` — **autouse** fixture that resets all mock state before each test to prevent leakage

### Supabase Builder Mock Pattern

The mock replicates Supabase's fluent query builder:

```python
# All chained methods return the builder itself
builder.select.return_value = builder
builder.eq.return_value = builder
builder.in_.return_value = builder
builder.execute.return_value = execute_result
```

Per-test data is set by assigning to `mock_execute_result.data`:
```python
def test_list_folders(self, client, auth_headers, mock_execute_result):
    mock_execute_result.data = [_folder_row()]
    response = client.get("/folders", headers=auth_headers)
    assert response.status_code == 200
```

### Integration Test Structure

```python
# Pattern used in all integration test files
USER_ID = "00000000-0000-0000-0000-000000000001"

def _folder_row(folder_id=None, name="Reports", ...):
    """Helper that returns a realistic DB row dict."""
    return {"id": folder_id or FOLDER_ID, "user_id": USER_ID, ...}

class TestCreateFolder:
    def test_create_root_folder(self, client, auth_headers, mock_execute_result):
        mock_execute_result.data = [_folder_row()]
        response = client.post("/folders", headers=auth_headers, json={"name": "Reports"})
        assert response.status_code == 201
        assert response.json()["name"] == "Reports"
```

Tests are organized into classes by endpoint group (e.g., `TestCreateFolder`, `TestRenameFolder`, `TestDeleteFolder`).

### Unit Test Structure

Unit tests import the service function directly and mock its external dependencies:

```python
# backend/tests/unit/test_retrieval_service.py
from app.services.retrieval_service import search_documents

class TestSearchDocuments:
    def test_calls_embed_texts_with_query(self):
        sb = _make_supabase()
        with patch("app.services.retrieval_service.embed_texts", return_value=[FAKE_EMBEDDING]) as mock_embed:
            search_documents("test query", USER_ID, sb)
            mock_embed.assert_called_once_with(["test query"])
```

Pure-logic functions (e.g., `chunk_text`, `buildFolderTree`) are tested without any mocking.

## Frontend Test Structure

### Component Tests

Use `render` from `@testing-library/react`, query via accessible roles and text, fire events with `fireEvent` or `userEvent`:

```typescript
// frontend/src/__tests__/components/FolderNode.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

function makeNode(overrides: Partial<FolderNode> = {}): FolderNode { ... }

describe("FolderNode", () => {
  it("renders folder name", () => {
    renderWithTooltip(<FolderNodeComponent node={makeNode()} {...defaultProps} />)
    expect(screen.getByText("My Folder")).toBeInTheDocument()
  })
})
```

Components that use Radix `Tooltip` require a `TooltipProvider` wrapper — a local `renderWithTooltip` helper handles this.

### Hook Tests

Use `renderHook` and `waitFor` from `@testing-library/react`. All external dependencies are mocked via `vi.mock`:

```typescript
// frontend/src/__tests__/hooks/useFolders.test.ts
vi.mock("@/lib/api", () => ({
  listFolders: mockListFolders,
  createFolder: mockCreateFolder,
  // ...
}))

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn()... }, channel: vi.fn()... }
}))

it("loads folders on mount", async () => {
  mockListFolders.mockResolvedValueOnce([makeFolder({ id: "f1", name: "Alpha" })])
  const { result } = renderHook(() => useFolders())
  await waitFor(() => expect(result.current.folders).toHaveLength(1))
})
```

`vi.hoisted()` is used to define mocks before module imports (required when `vi.mock` factory references external variables).

### API Client Tests

Mocks the global `fetch` function and the Supabase auth session:

```typescript
function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  })
}

it("listFolders calls /folders with auth header", async () => {
  global.fetch = mockFetch([])
  await listFolders()
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/folders"),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer mock-token" }) })
  )
})
```

### Pure Function Tests

No mocking needed. Call the function and assert on the output:

```typescript
// frontend/src/__tests__/lib/buildFolderTree.test.ts
it("returns empty array for empty input", () => {
  expect(buildFolderTree([])).toEqual([])
})

it("puts children under their parent", () => {
  const folders = [makeFolder({ id: "p1", name: "Parent" }), makeFolder({ id: "c1", name: "Child", parent_id: "p1" })]
  const tree = buildFolderTree(folders)
  expect(tree[0].children[0].name).toBe("Child")
})
```

## E2E Test Patterns

E2E tests use Playwright's `test` and `expect`. Tests are resilient to the user being already signed in:

```typescript
// frontend/e2e/tests/auth.spec.ts
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

test("invalid login shows error message", async ({ page }) => {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) {
    test.skip()  // already logged in
    return
  }
  // ... test body
})
```

## Current Coverage Gaps

**Backend — not covered by existing tests:**
- `backend/app/api/documents.py` — the `ingest_document` background task (text extraction, chunking, embedding, metadata extraction) has no unit or integration test coverage. This is the most complex code path in the system.
- `backend/app/api/threads.py` — the full SSE streaming path with tool calls (multi-turn, tool loop, sandbox execution) is partially covered in `test_threads.py` but tool call dispatch for most individual tools (grep, glob, read_document, analyze_document, web_search, execute_code) is not tested end-to-end
- `backend/app/api/kb.py` — `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path` covered in `test_kb.py` but actual Supabase RPC call shapes not deeply asserted
- `backend/app/models/user_settings.py` — settings override loading/saving logic has no dedicated tests
- `backend/app/utils/folder_utils.py` — `is_in_global_subtree` recursive logic has no dedicated unit tests

**Frontend — not covered:**
- `frontend/src/hooks/useMessages.ts` — the SSE streaming handler and tool call state machine are not tested; this is the most complex frontend code
- `frontend/src/hooks/useThreads.ts` — no tests
- `frontend/src/hooks/useAuth.ts` — no tests
- `frontend/src/hooks/useSkills.ts` — no tests
- `frontend/src/components/chat/*` — only `MessageItem` has a test; `ChatArea`, `ToolCallPanel`, `ExecuteCodeBlock`, `MessageInput`, `MarkdownRenderer` have no tests
- `frontend/src/components/skills/*` — no tests
- `frontend/src/pages/*` — `SkillsPage`, `SettingsPage` have no tests

**E2E — practical limitations:**
- E2E tests require a live Supabase project and real credentials via env vars (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`). In the absence of those vars, most tests are skipped or weakly asserted. They are not suitable for CI without a dedicated test Supabase project.
- No E2E coverage for: skills management, settings page, folder tree interactions, document ingestion status tracking
