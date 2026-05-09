# Coding Conventions

**Analysis Date:** 2026-05-09

This codebase has TWO language tracks with distinct conventions:
- **Python backend** (`backend/`) — FastAPI, raw LLM SDKs, no LangChain/LangGraph
- **TypeScript frontend** (`frontend/`) — React 19 + Vite + shadcn/ui, single-page chat

There is **no enforced formatter or linter on Python** (no `ruff.toml`, no `pyproject.toml` at the project root, no `.editorconfig`). Conventions below are observed from the codebase and must be followed prescriptively even though no CI gate enforces them. The frontend has eslint v9 flat config (`frontend/eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react-hooks` (recommended), and `eslint-plugin-react-refresh` (vite preset).

---

## Naming Patterns

### Python (`backend/`)

**Files:**
- `snake_case.py` for everything: `audit_service.py`, `retrieval_service.py`, `tool_parser.py`, `_run_helpers.py`
- Service modules: `<thing>_service.py` (`embedding_service.py`, `sandbox_service.py`)
- API routers: noun plural (`threads.py`, `runs.py`, `documents.py`, `folders.py`)
- Pydantic model files: noun singular under `app/models/` (`thread.py`, `message.py`, `run.py`, `folder.py`)
- Test files: `test_<thing>.py` or `test_<phase>_<thing>.py` (`test_063_post_contract.py`, `test_062_active_runs.py`)

**Functions:**
- `snake_case`. Private helpers prefixed with single underscore: `_emit`, `_emit_terminal`, `_build_mock_supabase`, `_make_table_builder`, `_extract_run_id_from_mock`
- Async-wrapped Supabase callers use `aexec(...)` (`backend/app/utils/db.py`); never call `.execute()` directly inside async handlers (decision D-v2.5-01).

**Variables:**
- `snake_case` for locals and module-level globals.
- Module-level singletons / registries are uppercase or underscored: `RUN_TASKS` (`backend/app/api/threads.py`), `_BACKGROUND_TASKS`, `TERMINAL_TYPES`, `_RUN_STATUS_TO_TERMINAL_TYPE`, `_supabase`, `_redis`.
- Constants: `UPPER_SNAKE_CASE` — `VALID_ACTION_TYPES`, `MODEL_CAPABILITIES`, `DEFAULT_LLM_CALL_TIMEOUT_SECONDS`, `_LLM_CALL_TIMEOUT_MIN_S`.

**Types / Classes:**
- `PascalCase`: `Settings`, `ModelCapability` (TypedDict), `ThreadCreate`, `MessageResponse`, `ActiveRunResponse`, `SandboxSessionManager`.
- Pydantic request/response model trio per resource: `<Resource>Create`, `<Resource>Update`, `<Resource>Response` (see `backend/app/models/thread.py`, `folder.py`, `skill.py`).

### TypeScript (`frontend/`)

**Files:**
- React components: `PascalCase.tsx` — `MessageItem.tsx`, `CitationCard.tsx`, `FolderTree.tsx`, `ChatArea.tsx`.
- shadcn/ui primitives in `frontend/src/components/ui/` use `kebab-case.tsx`: `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`.
- Hooks: `use<Thing>.ts` — `useMessages.ts`, `useThreads.ts`, `useDocuments.ts`, `useFolders.ts`, `useAuth.ts`, `useTheme.ts`.
- Lib utilities: `camelCase.ts` — `api.ts`, `folderTree.ts`, `toolMeta.ts`, `model-info.ts` (kebab also accepted for content-shape modules).
- Tests mirror source with `.test.ts(x)` and live under `frontend/src/__tests__/{components,hooks,lib}/`.

**Functions:**
- `camelCase` for module-level functions, methods, hook return values.
- Helpers private to a module are still `camelCase` (no underscore convention).

**Variables:**
- `camelCase` for locals and component state.
- Constants: `UPPER_SNAKE_CASE` — `API_BASE` (`frontend/src/lib/api.ts:9`), `TEST_EMAIL` in e2e specs.
- React refs end with `Ref`: `lastSeenOffsetRef`, `reconcileInFlightRef`, `streamingThreadIdRef`, `subscriptionsRef`, `abortControllerRef`, `messagesByThreadRef` (`frontend/src/hooks/useMessages.ts:417-447`).

**Types:**
- `PascalCase` interfaces: `Thread`, `Message`, `ToolCall`, `Citation`, `StreamCallbacks`, `UseMessages`.
- Type aliases: `PascalCase` — `ThreadBoundSetMessages` (`frontend/src/hooks/useMessages.ts:54`).

---

## Code Style

### Python

**Formatting:**
- No automated formatter is run. Observed style:
  - 4-space indent.
  - Lines wrap around 100 chars (loose); multi-line dict/list/call uses trailing-comma style.
  - Double quotes preferred but single quotes appear inside f-strings.
  - Imports split into stdlib, third-party, local groups separated by a blank line (PEP 8) — not always strict but consistent in `app/api/threads.py`, `app/api/runs.py`.

**Type hints:**
- Required throughout: function signatures, attribute annotations on Pydantic / TypedDict models.
- Modern syntax: `str | None`, `list[dict]`, `dict[str, int]` (Python 3.10+ unions).
- `from __future__ import annotations` used in service modules with TYPE_CHECKING guards (`backend/app/services/openai_service.py:1`, `retrieval_service.py:1`, `anthropic_service.py:18`).
- `TYPE_CHECKING` guard for circular-import-prone types: see `from app.models.user_settings import UserEffectiveSettings` inside `if TYPE_CHECKING:` block.

### TypeScript

**Formatting:**
- No `.prettierrc` checked in. Observed style:
  - 2-space indent.
  - **No semicolons** (matches Vite + shadcn defaults). Visible across `frontend/src/lib/api.ts`, `frontend/src/hooks/useMessages.ts`, all components.
  - Double quotes for strings, backticks for templates.
  - Trailing commas in multi-line arrays / objects / function args.

**Linting (`frontend/eslint.config.js`):**
- `js.configs.recommended`
- `tseslint.configs.recommended`
- `reactHooks.configs.flat.recommended` (deps array enforcement)
- `reactRefresh.configs.vite` (HMR boundary enforcement)
- `globalIgnores(['dist'])`
- Ad-hoc `// eslint-disable-next-line prettier/prettier` is used at long-import lines (e.g., `useMessages.ts:3`).

**TypeScript config (`frontend/tsconfig.app.json`):**
- `"strict": true`
- `"noUnusedLocals": true`, `"noUnusedParameters": true`
- `"noFallthroughCasesInSwitch": true`
- `"noUncheckedSideEffectImports": true`
- `"verbatimModuleSyntax": true` — `import type { X }` required for type-only imports.
- `"erasableSyntaxOnly": true` — no enums, no namespaces, no parameter properties.
- Path alias `@/*` → `./src/*` (used in tests and components).

---

## Import Organization

### Python

**Order (observed in `backend/app/api/threads.py`, `backend/app/api/runs.py`):**
1. Standard library (`asyncio`, `json`, `logging`, `os`, `time`, `uuid`, `datetime`).
2. Third-party (`fastapi`, `starlette`, `redis`, `supabase`, `openai`, `anthropic`, `pydantic`).
3. Local (`from app.config import settings`, `from app.dependencies import ...`, `from app.models.* import ...`, `from app.services.* import ...`, `from app.utils.db import aexec`).

**Special patterns:**
- Late-bound imports inside function bodies for circular-import safety: `from app.services.sandbox_service import sandbox_manager` (`main.py:100`); `from app.api.threads import RUN_TASKS` (`main.py:80`, `_run_helpers.py:327`).
- Test-time imports occur AFTER environment patching (`backend/tests/conftest.py:7-19` patches env, `:77-78` imports app modules).

### TypeScript

**Order (observed in `frontend/src/hooks/useMessages.ts`, `frontend/src/lib/api.ts`):**
1. React (`import { useState, useCallback, useRef, useEffect, useMemo } from "react"`).
2. Third-party (`@tanstack/react-query`, `lucide-react`, `@radix-ui/*`).
3. Type-only imports next: `import type { Message, ToolCall } from "../types"`.
4. Local imports via `@/` alias or relative paths.

**Path aliases:**
- `@/components/...`, `@/hooks/...`, `@/lib/...`, `@/types` (configured in `tsconfig.app.json` and `vitest.config.ts`).

---

## Error Handling

### Python (FastAPI)

**HTTPException with status constants:**
```python
# backend/app/api/folders.py:46
raise HTTPException(status_code=404, detail="Parent folder not found")

# backend/app/dependencies.py:55
raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
```
- Use `from fastapi import status` for named constants when status >= 400 with semantic meaning.

**Producer-side fire-and-forget swallowing (audit / memory writes):**
```python
# backend/app/services/audit_service.py:32-39
try:
    await aexec(supabase.table("audit_log").insert({...}))
except Exception as exc:
    logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```
- Audit/observability writes MUST NOT propagate exceptions (D-05).

**Strong references for fire-and-forget tasks (`backend/app/api/threads.py:60-68`):**
```python
_BACKGROUND_TASKS: set[asyncio.Task] = set()

def _spawn(coro) -> asyncio.Task:
    t = asyncio.create_task(coro)
    _BACKGROUND_TASKS.add(t)
    t.add_done_callback(_BACKGROUND_TASKS.discard)
    return t
```
- Without strong references, asyncio garbage-collects pending tasks mid-execution.

**ValueError over assert in production paths:**
```python
# backend/app/api/threads.py:127-130 (WR-03)
if type not in TERMINAL_TYPES:
    raise ValueError(f"_emit_terminal type must be in TERMINAL_TYPES, got {type!r}")
```
Asserts are stripped under `python -O`; production-invariant guards use `raise ValueError`.

**Bounded validation with logged warnings (`backend/app/config.py:215-227`):**
```python
if val < _LLM_CALL_TIMEOUT_MIN_S or val > _LLM_CALL_TIMEOUT_MAX_S:
    logger.warning(...)
    continue
```
Operator-misconfiguration values are dropped with a logged warning, never raised.

**Try/except around third-party APIError import:**
```python
# backend/app/api/threads.py:17-20
try:
    from anthropic import APIError as AnthropicAPIError
except ImportError:
    AnthropicAPIError = Exception  # fallback if SDK not installed
```

**Cooperative cancellation — never swallow `CancelledError`:**
```python
# backend/app/api/runs.py:113-122 (D-067-04)
except asyncio.CancelledError:
    logger.info("replay_tail_consumer xread cancelled by client disconnect for run %s", run_id)
    raise   # re-raise so asyncio task state stays correct
```

### TypeScript (React)

**Throw `Error` with descriptive message at API boundary:**
```typescript
// frontend/src/lib/api.ts:30-32
const res = await fetch(`${API_BASE}/threads`, { headers })
if (!res.ok) throw new Error("Failed to list threads")
return res.json() as Promise<Thread[]>
```

**`AbortController` for stream / fetch cancellation:**
- One controller per in-flight run, keyed in `subscriptionsRef: Map<run_id, AbortController>` (`frontend/src/hooks/useMessages.ts:427`).
- `loadAbortRef` separately for `loadMessages` cancellation.
- Never reuse an AbortController across runs.

**Defensive null/undefined coercion at the wire boundary:**
```typescript
// frontend/src/lib/api.ts:89-90 (WR-02)
runId: run_id ?? undefined,         // null → undefined (frontend type is optional, not nullable)
runStatus: run_status ?? undefined,
```

---

## Logging

**Python — `logging.getLogger(__name__)` per module:**
```python
# backend/app/api/threads.py:51
logger = logging.getLogger(__name__)
```
- Use `logger.info/warning/error` with `%s` format args, never f-strings (lazy formatting).
- Pattern in `backend/app/services/audit_service.py:39`:
  ```python
  logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
  ```

**Suppress noisy 3rd-party transports (`backend/app/main.py:8-12`):**
```python
logging.getLogger("asyncio").setLevel(logging.ERROR)
```

**TypeScript:**
- `console.log` / `console.error` only; no logging framework.
- Avoid logging in hot streaming paths (it accumulates in DevTools and slows mid-stream renders).

---

## Comments / Docstrings

**Python:**
- Module-level `"""triple-quoted"""` docstring at the top of every non-trivial file. Use prose, not bullet lists, to explain why.
- Inline comments cite **decision IDs** (D-061-04, D-v2.5-08, D-067.4-R4-01) and **pitfall references** (Pitfall 5, Pitfall 6) so the reason for non-obvious code can be traced back to the planning artifact. Examples throughout `backend/app/api/threads.py`, `backend/tests/integration/_run_helpers.py`.
- Phase tags (`Phase 061`, `Phase 063 D-063-01`) appear at the top of regions that were added or rewritten during a specific phase; preserve them when editing.
- TODO-style markers are written as `WR-NN` (write-review fixes), `T-NNN-NN` (threats), `IN-NN` (improvements), and these resolve to specific decisions in `.planning/<phase>/PLAN.md` — do **not** use bare `TODO:` / `FIXME:` for live code.

**TypeScript:**
- JSDoc `/** ... */` blocks on hook signatures and public component props (see `frontend/src/hooks/useMessages.ts:31-44` for the `UseMessages` interface).
- Inline `//` comments cite the same decision IDs (`D-067.3-R1-01`, `Phase 063`, `WR-08 preserve`).
- Per-prop JSDoc inside interfaces is the documented form for Phase-tagged additions (e.g., `frontend/src/types/index.ts:43-52`).

---

## Function Design

**Python:**
- Async handlers wrap blocking Supabase work via `await aexec(query)` (`backend/app/utils/db.py`).
- Pydantic models for ALL request bodies and response payloads — every router uses `response_model=...`.
- Dependency injection via `Depends(get_current_user)`, `Depends(get_supabase)`, `Depends(get_redis)`. Never call dependency factories directly inside handlers.
- Single uvicorn worker (D-v2.5-02): module-level singletons (`_BACKGROUND_TASKS`, `RUN_TASKS`, `_supabase`, `_redis`) are safe; do not introduce in-memory state assuming multiple workers.

**TypeScript:**
- Hooks return a stable interface object with `useCallback`-wrapped action functions.
- Refs hold cross-render mutable state; useState for state that drives re-renders.
- React 19 `useMemo` derives the visible `messages` slice from the full per-thread Map (`frontend/src/hooks/useMessages.ts:396-399`).

---

## Module Design

**Python:**
- Each `app/api/<resource>.py` exposes `router = APIRouter(prefix="/<resource>", tags=["<resource>"])` and is mounted in `backend/app/main.py:138-148`.
- `app/services/` modules are stateless; manager instances (e.g. `sandbox_manager` in `sandbox_service.py:71`) are module-level singletons.
- `app/models/` modules contain Pydantic-only definitions; no logic.
- Settings resolution funnels through `from app.config import settings` (singleton at `config.py:443`); never instantiate `Settings()` ad-hoc except in unit tests that need a clean copy.

**TypeScript:**
- Named exports only; no default exports for components or hooks (matches `import { useMessages } from "@/hooks/useMessages"` everywhere).
- Single barrel file: `frontend/src/types/index.ts` (sole re-export hub).
- Hook files export both the hook and any types it requires (`UseMessages`, `StreamCallbacks`).

---

## Project-Specific Rules (CLAUDE.md / D-v2.5-*)

These are CRITICAL invariants — violating them breaks production:

1. **No LangChain, no LangGraph** — raw OpenAI / Anthropic / Google SDK calls only.
2. **Pydantic for structured LLM outputs** — never plain dicts.
3. **`run_in_threadpool` for blocking I/O in async handlers** (D-v2.5-01) — wrap `supabase.execute()` via `aexec()` (`backend/app/utils/db.py`).
4. **Single uvicorn worker** (D-v2.5-02) — `--workers N` masks concurrency bugs and breaks in-memory state (`RUN_TASKS`, `_BACKGROUND_TASKS`).
5. **Stream chat responses via SSE** — backend uses `sse-starlette` `EventSourceResponse`.
6. **Stateless chat completions** — store + send chat history yourself, no provider-side thread state.
7. **Manual file-upload ingestion only** — no connectors or automated pipelines.
8. **Schema migrations** — numbered SQL files at repo root `supabase/migrations/<NNN>_name.sql`. Names matching `^\d+_.*\.sql$` only — letter suffixes (`007b`) are silently skipped by Supabase CLI.
9. **Apply migrations via SQL editor** — never `supabase db push` / `db reset` on the dev DB. Then run `bash scripts/regenerate-full-schema.sh` to refresh `supabase/full-schema.sql`.
10. **RLS on every table** — users see own data only. Global folders/skills are the only shared scope.
11. **Settings live in `user_settings` / `app_settings`** + Settings UI; env vars are for secrets and infra only.
12. **Realtime is best-effort** (D-v2.5-03) — always reconcile via fetch on (re)connect. The frontend `reconcile()` in `frontend/src/hooks/useMessages.ts` is the canonical pattern.
13. **Postgrest `maybe_single` patch** — see `backend/app/main.py:22-45`. Returns 204 → empty result instead of `APIError`. Already in place; do not roll back.

---

*Convention analysis: 2026-05-09*
