# Coding Conventions

_Generated: 2026-03-21_

## Summary

This codebase uses TypeScript (React/Vite) on the frontend and Python (FastAPI) on the backend. Frontend follows functional-component-only React with custom hooks for all business logic. Backend uses a flat service/api/models layering with Pydantic for all request/response shapes and dependency injection for Supabase and auth.

---

## Naming Conventions

### Frontend (TypeScript)

**Files:**
- React components: `PascalCase.tsx` — e.g., `MessageItem.tsx`, `ChatArea.tsx`, `DocumentStatusBadge.tsx`
- Hooks: `camelCase.ts` prefixed with `use` — e.g., `useMessages.ts`, `useDocuments.ts`
- Lib/utility modules: `camelCase.ts` — e.g., `api.ts`, `supabase.ts`, `utils.ts`
- Type definitions: `camelCase.ts` — e.g., `index.ts` under `src/types/`
- Test files: co-located in `src/__tests__/`, named `ComponentName.test.tsx` or `hookName.test.ts`

**Variables and Functions:**
- `camelCase` throughout — `loadMessages`, `sendMessage`, `makeTempId`
- Boolean state variables use descriptive names: `isStreaming`, `uploading`
- Handler functions prefixed with `handle`: `handleSend`
- Callback props prefixed with `on`: `onSend`, `onDone`, `onDelta`, `onTitleUpdate`

**Types and Interfaces:**
- `PascalCase` for all interfaces and types — `Thread`, `Message`, `Document`, `ToolCall`, `SubAgentState`
- Interface for hook return shapes named after hook minus `use`: `UseMessages`, `UseDocuments`
- Props interfaces always named `Props` within the file

**Constants:**
- `SCREAMING_SNAKE_CASE` for module-level constants — `API_BASE`, `NOW`

### Backend (Python)

**Files:**
- Modules: `snake_case.py` — `embedding_service.py`, `retrieval_service.py`, `openai_service.py`
- API routers: `snake_case.py` grouped by resource — `documents.py`, `threads.py`, `settings.py`
- Models: `snake_case.py` named after domain entity — `document.py`, `message.py`, `thread.py`
- Tests: `test_{module_name}.py` — `test_embedding_service.py`, `test_retrieval_service.py`

**Functions and Variables:**
- `snake_case` throughout
- Private helper functions prefixed with `_` — `_vector_search`, `_keyword_search`, `_rrf_fuse`, `_enrich_with_filenames`
- Module-level logger always: `logger = logging.getLogger(__name__)`
- Constants: `SCREAMING_SNAKE_CASE` — `ALLOWED_MIME_TYPES`, `SYSTEM_PROMPT`, `MAX_ITERATIONS`

**Classes:**
- `PascalCase` — `Settings`, `DocumentMetadata`, `DocumentResponse`, `MessageCreate`, `TestChunkTextEdgeCases`
- Test classes follow `Test{ClassName}` or `Test{Resource}{Action}` — `TestSearchDocuments`, `TestListDocuments`, `TestUploadDocument`

---

## Code Style

### Frontend

**Formatting:**
- No Prettier config present — formatting is enforced via ESLint only
- ESLint config: `eslint.config.js` using flat config format (`eslint/config`)
- Rules: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`
- Targets `ecmaVersion: 2020`, `globals.browser`

**TypeScript:**
- Strict typing via `tsconfig.app.json`
- `import type` used for type-only imports: `import type { Message, ToolCall } from "../types"`
- Explicit return types on hook interfaces, implicit inference on implementation
- No `any` — uses `unknown` and casts: `parsed as Record<string, unknown>`

**Import Order (observed pattern):**
1. React built-ins — `import { useState, useCallback } from "react"`
2. Third-party packages — `import { cn } from "@/lib/utils"`
3. Internal absolute imports via `@/` alias — `import type { Message } from "@/types"`
4. Relative imports last

**Path Aliases:**
- `@/` maps to `src/` — configured in both `vite.config.ts` and `vitest.config.ts`
- Use `@/` for all cross-directory imports; relative paths (`../`) only for same-directory

### Backend

**Formatting:**
- No Black or Ruff config detected — PEP 8 followed manually
- Imports grouped: stdlib → third-party → local app imports, each group separated by blank line
- `from __future__ import annotations` used in modules with forward-reference type hints

**Python Style:**
- Type hints on all function signatures: `def chunk_text(text: str, chunk_size: int | None = None) -> list[str]`
- Modern union syntax: `str | None` (Python 3.10+), not `Optional[str]`
- Pydantic `BaseModel` for all request/response shapes — never plain dicts at API boundaries
- `model_dump(exclude_none=True)` used when converting Pydantic models for Supabase insert

---

## Error Handling

### Frontend

**API calls:**
- Functions throw on non-OK responses: `if (!res.ok) throw new Error("Failed to ...")`
- Upload errors parse JSON body first: `const err = await res.json().catch(() => ({ detail: "Upload failed" }))`
- SSE stream: JSON parse errors silently ignored (`catch { // ignore malformed lines }`)
- Component-level: errors from effects caught with `.catch(console.error)`

**Hook-level:**
- `useDocuments.upload()` uses `try/finally` to always decrement `uploadingCount`
- No global error boundary detected — errors surface to console or are swallowed

### Backend

**HTTP errors:**
- Always `raise HTTPException(status_code=status.HTTP_XXX_..., detail="...")` with specific status codes
- Import status constants from `fastapi import status` and use named constants, never bare integers

**Best-effort operations:**
- Storage operations wrapped in bare `except Exception: pass` — failures don't block main path (e.g., `supabase.storage.from_("documents").remove(...)`)
- Metadata extraction: `except Exception as e: logger.warning(...)` and returns `None` — never blocks ingestion
- `ingest_document` background task: full `try/except Exception` with `logger.error` + `traceback.format_exc()`, then sets document status to `"failed"`

**Logging:**
- `logger = logging.getLogger(__name__)` at module level in every service file
- Error logging pattern: `logger.error("Context message: %s\n%s", e, traceback.format_exc())`
- Warning pattern: `logger.warning("Message: %s", e, exc_info=True)`

---

## State Management (Frontend)

**Approach:** Local React state only — no Redux or Zustand. TanStack Query is installed (`@tanstack/react-query`) but not observed in use across hooks.

**Hooks own their state:**
- `useMessages` owns `messages: Message[]` and `isStreaming: boolean`
- `useDocuments` owns `documents: Document[]` and `uploadingCount: number`
- `useThreads` and `useAuth` follow the same pattern

**Optimistic updates:**
- Document upload: new doc added to state immediately, Realtime events update status fields
- Document delete: removed from state immediately; Realtime DELETE event also fires
- Message send: user message and empty assistant placeholder both inserted before API call, content streamed in via delta callbacks

**Realtime (Supabase):**
- `useDocuments` subscribes to `postgres_changes` on the `documents` table via `supabase.channel()`
- Channel stored in `useRef` to avoid re-subscription on re-render
- `cancelled` boolean flag guards async session lookup against unmounted component

---

## Common Patterns

### SSE Streaming (backend → frontend)
Backend emits newline-delimited `data: <json>\n\n` frames. Frontend reads with `ReadableStream` + `TextDecoder`, splits on `\n`, dispatches by `parsed.type`:
- `delta` — append to assistant message content
- `tool_start` / `tool_end` — update tool call status in message
- `sub_agent_start` / `sub_agent_delta` / `sub_agent_done` — update sub-agent state
- `title` — update thread title
- `[DONE]` — close stream and call `onDone()`

SSE event types are defined in `backend/app/api/threads.py` (emitter) and `frontend/src/lib/api.ts` (consumer).

### FastAPI Dependency Injection
All handlers receive `current_user: dict = Depends(get_current_user)` and `supabase: Client = Depends(get_supabase)`. Never construct clients inline in route handlers.

### Supabase Query Builder Pattern (backend)
Fluent chain terminated with `.execute()`:
```python
result = (
    supabase.table("documents")
    .select("*")
    .eq("user_id", current_user["id"])
    .order("created_at", desc=True)
    .execute()
)
return result.data
```

### Pydantic Response Models
Every API endpoint declares `response_model=` with a Pydantic model. Models use `Literal` for constrained string fields:
```python
status: Literal["pending", "processing", "completed", "failed"]
role: Literal["user", "assistant"]
```

### Component Props Interface
Every component file defines a local `interface Props { ... }` at the top, never imported from elsewhere.

### `cn()` Utility
All conditional class composition uses `cn()` from `@/lib/utils` (wraps `clsx` + `tailwind-merge`). Never concatenate class strings with template literals.

---

## Module Design

### Frontend
- `src/lib/api.ts` — all HTTP calls; single source of truth for API contract
- `src/lib/supabase.ts` — single Supabase client instance
- `src/hooks/` — business logic; components are dumb presentational shells
- `src/types/index.ts` — all shared TypeScript interfaces; no inline interface declarations in components
- `src/components/ui/` — shadcn/ui primitives, not modified

### Backend
- `app/config.py` — single `Settings` instance (`settings = Settings()`), imported directly where needed
- `app/models/` — Pydantic models only; no business logic
- `app/services/` — all business logic; functions are stateless, receive dependencies as parameters
- `app/api/` — FastAPI routers; thin orchestration layer, delegates to services
- `app/dependencies.py` — DI helpers (`get_current_user`, `get_supabase`)
