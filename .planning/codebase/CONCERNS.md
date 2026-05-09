# Codebase Concerns

**Analysis Date:** 2026-05-09

This document is the authoritative inventory of technical debt, known issues, fragile areas, deferred items, and forward-looking risks at the close of v2.5 (Deployment Strategy). Items are grouped by urgency category. Each entry cites file paths so the executor can navigate directly. Source-of-truth linkage to seeds (`SEED-001`..`SEED-014`), known issues (`KI-*`), and deferred-items lists is preserved so re-open triggers stay actionable.

---

## Category Index

1. **Critical** — Active correctness or security risks; address before next major work
2. **Fragile / High-Risk** — Works today but a wrong edit breaks production
3. **Deferred-with-Trigger** — Intentionally postponed; carry-forward seeds
4. **Monitoring-Only** — Known characteristics; act only when triggers fire
5. **Historical Debt** — Pre-GSD micro-tickets and milestone carry-forwards

---

## 1. Critical

### KI-001 — In-flight LLM/tool calls continue after SSE disconnect (substantially mitigated; not closed)

**What happens:** Python async generators can only receive `GeneratorExit` at `yield` points. The current LLM call or tool execution runs to completion before the generator stops; iteration only halts after the in-flight call yields.

**Status:** Substantially addressed by Phase 067.1's Track A drain-into-queue helper at `backend/app/api/threads.py:158-255` (`_drain_stream_with_close_on_cancel`). The producer thread runs the sync `for chunk in stream:` loop; on cancel, the main thread closes the SDK stream from the outside so langsmith's `_TracedStream.__iter__` exits via `StopIteration` (clean `error=None` trace) rather than `GeneratorExit`. Phase 066 added per-LLM-call timeout machinery (`LLM_CALL_TIMEOUT_OVERRIDES` in `backend/.env.example`, dispatcher in `backend/app/services/openai_service.py`) and split `cancelled` (user-Stop) vs `timed_out` (system-deadline) lifecycle states with `runs.error` populated.

**Residual risk:** Tool executions outside the streaming loop (e.g., `execute_code` Docker run with no per-execution timeout) still cannot be interrupted mid-flight. See "No Timeout on Sandbox Code Execution" below.

**Files:** `backend/app/api/threads.py:158-255`, `backend/app/services/openai_service.py`, `backend/app/services/anthropic_service.py:150-200`

**Re-open trigger:** New surface added that takes a sync iterator inside the SSE generator without going through `_drain_stream_with_close_on_cancel`.

---

### Service-Role Client Bypasses RLS — Manual Scoping Required Throughout

The backend creates a single Supabase client using the service-role key at `backend/app/dependencies.py:13-17`, which bypasses all Row-Level Security policies. Every endpoint must manually enforce user scoping or data leaks across users become possible.

**Files:** `backend/app/dependencies.py:13-17`, `backend/app/services/sql_service.py`

**Current mitigation:** `_inject_user_id()` in `sql_service.py` inserts `WHERE documents.user_id = '...'` or `WHERE folders.user_id = '...'` via regex substitution before executing SQL. Fragile — any SQL shape that doesn't match the regex patterns escapes the filter.

**Risk:** A poorly-formed LLM-generated SQL query that confuses the regex bypasses user scope entirely. DB-level RLS doesn't catch it because the service-role key skips RLS.

**Fix approach:** Switch to a per-request Supabase client using the user's JWT token, relying on DB-level RLS. If service role remains necessary, add a strict allowlist of SQL patterns.

---

### SQL Injection Risk in `grep_path` and `query_documents`

`grep_path` in `backend/app/api/kb.py` builds raw SQL by string-interpolating user-supplied regex:

```python
sql = f"SELECT id, filename, folder_id FROM documents WHERE full_markdown ~ '{escaped_pattern}'"
```

Only sanitisation is `pattern.replace("'", "''")`. Doesn't protect against regex catastrophic backtracking DoS or dollar-sign quoting.

The `query_user_documents` RPC at `supabase/migrations/012_query_documents_fn.sql` uses `EXECUTE format(...)` with dynamic SQL. Application-level guard (`not clean.lower().startswith("select")` and `";" in clean`) is bypassable (e.g., `SELECT ... FROM (SELECT pg_sleep(5))`). RPC is `SECURITY INVOKER`, but service-role client means RLS is not active.

**Files:** `backend/app/api/kb.py`, `backend/app/services/sql_service.py`, `supabase/migrations/012_query_documents_fn.sql`

**Risk:** Medium — attacker must be authenticated; any authenticated user could exfiltrate other users' data via crafted queries.

**Fix approach:** Use parameterised queries or Supabase `.rpc()` with proper parameter binding rather than string interpolation.

---

### `match_document_chunks` RPC Uses `SECURITY DEFINER`

`match_document_chunks` at `supabase/migrations/002_module2_byo_retrieval.sql` is declared `SECURITY DEFINER`, running with owner privileges (superuser) not caller. Filters by `match_user_id` parameter supplied by the application; not verified at the DB level.

**Risk:** If the application ever passes the wrong `match_user_id`, another user's chunks are returned. No DB-enforced guard.

**Fix approach:** Change to `SECURITY INVOKER` and rely on RLS, or verify ownership inside the function body using `auth.uid()`. Migration `033_fix_match_document_chunks_overload.sql` and `036_drop_5arg_match_document_chunks.sql` cleaned up overloads but did not change the security model.

---

### Settings Stored in Plain-Text JSON File on Disk

API keys (OpenAI, Anthropic, OpenRouter, Google, Tavily, Cohere) persisted to `backend/settings_override.json` as plain text. File is gitignored but sits on the server filesystem.

**Files:** `backend/app/models/user_settings.py:84-101`, `backend/settings_override.json`

**Risk:** Any process with filesystem read access (compromised container, directory traversal bug) can read all API keys.

**Fix approach:** Store overrides in Supabase (encrypted at rest) or a secrets manager rather than a local JSON file. Secrets-store decision is part of `SEED-003` (Deployment Flexibility) and `SEED-012` (Admin / Operator UI).

---

### No File Size Limit on Document Upload

`backend/app/api/documents.py:60-66` reads the entire file into memory with `raw = await file.read()` before any validation. A 500 MB PDF consumes server memory for the full request duration.

**Note:** Skill file uploads enforce 10 MB at `backend/app/api/skills.py:375`; documents have no equivalent guard.

**Fix approach:** Streaming size check or FastAPI middleware enforcing a limit before reading the full upload body.

---

## 2. Fragile / High-Risk

### `threads.py` `send_message` — God Function (~1850 lines, growing)

`send_message` at `backend/app/api/threads.py:876` runs to ~end of file (2725 LOC total). Single async function containing: SSE streaming logic, multi-turn tool call loop, ~16 tool dispatch branches each with inline business logic, sandbox execution orchestration, message persistence, thread title generation, error handling, run-backed streaming integration, per-call timeout machinery callsites, and Track A drain-into-queue invocation.

**Files:** `backend/app/api/threads.py:876-2725`

**Status:** Now significantly larger than the 612 lines flagged in 2026-04-05 audit; v2.5 added ~1200 lines of run-backed streaming + adaptive timeout + suggestion-emit + provider-router code without extraction.

**Impact:** Extremely difficult to test, modify, or reason about. Adding a new tool requires editing deep inside this function. Unit tests cannot cover dispatch logic without full integration harnesses. Every v2.5 cross-phase chain (067.x) had to grep through this file to find the right edit site.

**Fix approach:** Extract tool dispatch into a `ToolDispatcher` class, move each tool handler to a dedicated function or module, separate streaming scaffold from business logic. Largest single mechanical refactor outstanding in the codebase.

---

### `useMessages.ts` Single Buffer Architecture (1229 lines)

`frontend/src/hooks/useMessages.ts` carries the entire run-backed streaming integration: `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `activeThreadIdRef`, `streamingThreadIdRef`, `messagesByThread` Map, `clearMessages` streaming-bucket guard (Branch D-3 fix), `subscribeToRun` orchestration, `loadMessages` MERGE three-clause filter, reconcile triggers (mount + visibilitychange + focus + pageshow).

**Files:** `frontend/src/hooks/useMessages.ts:1-1229`, especially `useMessages.ts:572-590` (Branch D-3 `clearMessages` guard)

**Risk:** Single-buffer assumption breaks the moment UI surfaces concurrent streams (split-view, eval runs alongside chat, multi-pane Skill Studio). Any contributor adding a second stream surface without lifting state to a Context provider risks: (a) duplicated `subscriptionsRef` + offset logic in a second hook (drift), (b) cross-hook coordination via window globals (anti-pattern), or (c) keying ChatArea on something other than `thread.id` and killing SSE on remount (Gap-003 regression in a new shape).

**Fix approach:** Lift to `<StreamsProvider>` Context as planned in **SEED-007** (App-level Streams Provider). Trigger: any milestone needing concurrent stream rendering, multi-pane chat UI, or component-remount-survival. Strongest trigger is Skill Studio (SEED-002).

---

### `_reconstruct_history` Silently Drops Tool Calls Without `tool_call_id`

Backward-compat logic at `backend/app/api/threads.py:819` (`_reconstruct_history` function): assistant messages without `tool_call_id` on their tool calls are emitted as plain assistant messages, silently dropping tool call data from the reconstructed LLM context.

**Impact:** Pre-migration messages produce inaccurate conversation history; LLM may repeat tool calls or hallucinate.

**Fix approach:** One-time migration to backfill `tool_call_id` for existing messages, then remove the backward-compat branch.

---

### Storage Upload Failure Silently Swallowed on Document Upload

`backend/app/api/documents.py:146-153`:

```python
try:
    supabase.storage.from_("documents").upload(...)
except Exception:
    pass  # Storage upload failure doesn't block ingestion
```

Document record created and ingestion proceeds even if storage upload fails. Backing file missing from Supabase Storage; future `delete_document` calls silently no-op the storage removal step. User has no signal.

**Fix approach:** Log the failure explicitly and surface it in the document's `error_message` field, or make storage upload a prerequisite.

---

### Stale Document Deletion is Folder-Unaware

`backend/app/api/documents.py:104-119` detects "stale" documents (same filename, different content) by querying across all folders — not just the target folder. If user has `notes.md` in folder A and uploads `notes.md` to folder B, the old `notes.md` in folder A gets deleted.

**Fix approach:** Scope the stale document query to the same `folder_id` as the upload target.

---

### `move_document` Allows Moving Into Other Users' Global Folders

`backend/app/api/documents.py:243-253`:

```python
.or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
```

A user can move private documents into any global folder (not just their own), inadvertently or deliberately exposing them to all authenticated users.

**Fix approach:** Restrict to folders owned by the current user; moving to a global folder should require owning that folder.

---

### `delete_folder` Lacks Defence-in-Depth Ownership Check

`backend/app/api/folders.py:131-167` (`delete_folder`) uses BFS to collect all descendant folder IDs, then fetches and deletes documents in those folders without `.eq("user_id", ...)` on line 148. Upload now validates folder ownership upstream, but no defence-in-depth.

**Fix approach:** Add `.eq("user_id", current_user["id"])` to the document query.

---

### No Per-Execution Timeout on Sandbox Code Execution

The `execute_code` path in `backend/app/api/threads.py` runs user-provided Python code in Docker via `loop.run_in_executor(None, _run_sync)`. Session TTL exists for idle eviction but no per-execution timeout. A user can submit an infinite loop and the request hangs indefinitely.

**Files:** `backend/app/api/threads.py` (execute_code dispatch), `backend/app/services/sandbox_service.py:15-16`

**Status:** Phase 066's per-LLM-call timeout addresses LLM stalls but does NOT cover sandbox code execution. KI-001 mitigation also doesn't apply — the executor thread is not a streaming generator.

**Fix approach:** Wrap `loop.run_in_executor(...)` future in `asyncio.wait_for(fut, timeout=60)`; surface timeout to the user.

---

### Sandbox Session Manager is Not Multi-Process Safe

`backend/app/services/sandbox_service.py:15-16` stores sessions in module-level `_sessions: dict[str, object] = {}`. Under multi-worker deployment (`uvicorn --workers N`), each worker has its own dict — sessions invisible across workers.

**Files:** `backend/app/services/sandbox_service.py:15-16`

**Status:** Currently moot because **D-v2.5-02 mandates single-worker uvicorn**. Becomes a blocker the moment scale-readiness work (SEED-001) introduces multi-worker.

**Fix approach:** Move session state to Redis or document the constraint as a hard requirement until SEED-001 lands asyncpg + multi-worker.

---

### Realtime is Best-Effort Hint, Not Source of Truth (D-v2.5-03)

Frontend must reconcile via fetch on every (re)connect. Any contributor adding a new feature that depends on Realtime delivery (rather than reconciling) reintroduces the STREAM-02 family of bugs.

**Reference:** `CLAUDE.md` rule "Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect"; D-v2.5-03 in `PROJECT.md`.

**Risk:** Subtle. New code looks "right" until tested across tab-switch and F5 scenarios.

**Mitigation:** Lock D-v2.5-03 in code review checklist for any frontend SSE/Realtime work.

---

### Blocking I/O in Async Handlers Must Use `run_in_threadpool` (D-v2.5-01)

Direct `supabase-py` calls inside async handlers block the event loop; v2.5 raised AnyIO threadpool ceiling 40→200 to buy 5x headroom (Phase 058). The wrap pattern (`aexec`, `run_in_threadpool`) is mechanical but easy to forget — `aexec` callers in `backend/app/services/sql_service.py` and `backend/app/api/threads.py` are the canonical examples.

**Status:** Tactical fix; full migration to `asyncpg` direct deferred per `SEED-001` (Scale Readiness).

**Re-open trigger:** Production telemetry shows AnyIO threadpool saturation (queue depth) OR >10 simultaneous active users.

---

## 3. Deferred-with-Trigger (Carry-Forward Seeds)

### SEED-001: Scale Readiness — multi-user concurrent load

**File:** `.planning/seeds/SEED-001-scale-readiness.md`

CONCUR-03 asyncpg migration for hot paths; multi-worker production deployment; sticky websocket sessions if Realtime returns; backpressure / queueing instrumentation; per-user concurrent SSE stream cap. v2.5 raised AnyIO 40→200 (5x headroom) but NOT a production-grade fix.

**Re-open triggers:** Feature set declared "complete"; >10 simultaneous active users; latency complaints; AnyIO threadpool saturation in logs.

---

### SEED-002: Skill Studio Milestone Preparation

**File:** `.planning/seeds/SEED-002-skill-studio-milestone-prep.md`

Test-infra debt blocks the entry point (Phase 065 partially closed via skills test repair; pre-existing `test_059_disconnect.py::test_normal_stream_unchanged` remains — see SEED-011); MIME-fidelity gap intersects PRD Open Question #3; Skills tab redesign deferred TO this milestone; SKILL-01/02 catalog full-inject collides with PRD Open Question #2; Phase 059's `agent_runner` + `asyncio.Queue` is a clean template for dual-execution evals.

**Re-open triggers:** Milestone scoped to "Skills" / "Skill Studio" / "Eval" / v3.0 / v3.1.

---

### SEED-003: Deployment Flexibility & Install/Config UX

**File:** `.planning/seeds/SEED-003-deployment-flexibility-install-ux.md`

Deployment-shape inventory; install wizard / first-run experience; secrets management story; configuration UX (operator vs end-user split); packaging artifacts (Docker images, Compose, Helm); scale-tier presets.

**Re-open triggers:** Milestone mentioning install / deploy / packaging / one-click / self-host / enterprise; non-developer install requests; pre-launch readiness review.

---

### SEED-004: Org / Department / Role Multi-Tenancy

**File:** `.planning/seeds/SEED-004-org-multi-tenancy.md`

Tenancy model decision (isolated vs co-tenant vs hybrid); org/department/role data model; RLS shift from `user_id = auth.uid()` to membership; document type taxonomy per department; department-targeted skill & automation deployment; roles-based admin UX; org-level audit & compliance.

**Re-open triggers:** Milestone scoped to tenancy / orgs / teams / departments / RBAC / enterprise; user requests dept visibility or role-based access.

---

### SEED-005: Document Management Capabilities (M-Files-aligned subset)

**File:** `.planning/seeds/SEED-005-document-management-capabilities.md`

Tier A (high alignment): metadata-driven views (saved searches as virtual folders), document relationships (typed links), auto-classification on upload. Tier B: check-in/check-out, retention policies, simple approval workflow.

**Re-open triggers:** Milestone scoped to DM / DMS / lifecycle / workflow / approvals / retention / metadata views.

---

### SEED-006: Multimodal Extraction Quality (Phase 35/36 Follow-up)

**File:** `.planning/seeds/SEED-006-multimodal-extraction-quality.md`

Current pipeline stores ~5% of visible figures (1 real table + 3 false-positive 1×1 tables + 2 image descriptions on a 4 MB thesis with 50+ visible figures). Bottleneck is post-detection (`extract_and_store_images` cascading silent drops at `_MAX_VISION_CALLS = 20`, `_MAX_B64_BYTES = 512KB`, decode failures on JPEG2000 / JBIG2 / CMYK). PyMuPDF primary path identified; Docling deferred due to httpx version conflict with supabase 2.10 stack.

**Verified in code (2026-05-09):** `_MAX_VISION_CALLS = 20` and `_MAX_B64_BYTES = 512 * 1024` still hardcoded at `backend/app/services/multimodal_service.py:29-33`; `image_dicts[:_MAX_VISION_CALLS]` enforced at line 285.

**Re-open triggers:** Milestone scoped to RAG quality / ingestion / multimodal; user complaint about "missing tables/images in answers".

---

### SEED-007: App-level Streams Provider

**File:** `.planning/seeds/SEED-007-app-level-streams-provider.md`

Lift `subscriptionsRef`, `lastSeenOffsetRef`, per-run buffer out of `useMessages` into a top-level `<StreamsProvider>` Context. Single-buffer architecture today doesn't paint into a corner but extending to multi-consumer requires the lift.

**Re-open triggers:** Milestone introducing split-view / multi-pane chat; eval/skill streams alongside chat (SEED-002); ChatArea keyed on something other than `thread.id`.

---

### SEED-008: Streaming UX Polish

**File:** `.planning/seeds/SEED-008-streaming-ux-polish.md`

Two gaps surfaced during Phase 067.4 closing UAT 2026-05-09:

1. **Thread-switch perceived latency** — sequential `GET /threads/{id}/messages` → `GET /threads/{id}/active-runs` → `GET /runs/{run_id}/stream?since=N` chain (~100-300ms each). Fix paths: optimistic rendering, parallelize into combined `/snapshot` endpoint, pre-fetch on hover, IndexedDB cache.

2. **Sandbox stdout — line-by-line streaming** — Plan 03 of Phase 067.4 explicitly chose NOT to revive dead `on_stdout`/`on_stderr` callbacks at `backend/app/api/threads.py:2014-2024`. Stdout is batched at completion; user expected progressive line emit. Heartbeat (`code_executing` ticks) emits elapsed seconds only, not output content.

**Re-open triggers:** Recurring "feels slow" feedback; sandbox-heavy user requests "watch the code execute"; v2.6 milestone planning.

---

### SEED-009: claude-haiku-4-5 max_tokens cap mismatch

**File:** `.planning/seeds/SEED-009-claude-haiku-max-tokens-cap.md`

Backend sends `max_tokens=65536`; Anthropic caps `claude-haiku-4-5-20251001` at 64000 → `BadRequestError` at request time. Surfaced live during Phase 067.5 Cycle 5 (run_id `8ca784f2-…`, thread `6e2913b7-…`, 2026-05-09). Resume path D-063-04 worked cleanly; user clicked Resume and got new run_id `53ee4e5a-…` succeeding.

**Files:** `backend/app/services/anthropic_service.py:150-200`

**Fix shape:** Path 1 — `_clamp_max_tokens()` helper in `anthropic_service.py` (~5 LOC). Path 2 (recommended) — extend `MODEL_CAPABILITIES` registry in `backend/app/config.py` with `max_output_tokens: int` per-model (~10-15 LOC).

**Re-open triggers:** User report of `BadRequestError` on any Anthropic model; adding new Anthropic model to `MODEL_CAPABILITIES`; touching `anthropic_service.py`; migrating to a newer Claude model family.

---

### SEED-010: OpenRouter Kimi-k2.5 + MiniMax-m2.7 synthetic-timeout protocol verification

**File:** `.planning/seeds/SEED-010-openrouter-synthetic-timeout-protocol.md`

Phase 067.2 closing UAT Rows 11+12 deferred — `OPENROUTER_API_KEY` was absent at UAT time. User-deferred at Phase 067.4 even though creds returned. Verifies Phase 066's per-LLM-call timeout (`LLM_CALL_TIMEOUT_OVERRIDES`) produces clean `timed_out` lifecycle on OpenRouter-routed models, NOT `GeneratorExit`.

**Cost:** ~30 minutes of UAT (env edit + uvicorn restart + 4 runs + verdict capture).

**Re-open triggers:** User report of agent hang or `GeneratorExit` on OpenRouter-routed models; adding new OpenRouter-routed models needing lifecycle verification; touching per-call timeout machinery.

---

### SEED-011: test_059_disconnect.py::test_normal_stream_unchanged fixture-teardown bug

**File:** `.planning/seeds/SEED-011-test-059-fixture-teardown.md`

`backend/tests/integration/test_059_disconnect.py::test_normal_stream_unchanged` fails with `RuntimeError: Event loop is closed` during fixture teardown. Other tests in same file pass. Phase 065 Plan 03 verified pre-existing on `fa1e327` base via `git stash` round-trip — NOT a Phase 065 regression.

**Likely root cause:** Same loop-binding trap as Phase 062/063 — pytest-asyncio function-scope creates fresh event loop per test; cached singleton (Redis client, sse-starlette `AppStatus`) holds an event-loop reference past loop close.

**Canonical fix:** `_reset_redis_singleton` autouse fixture pattern at `backend/tests/integration/test_062_stream_replay.py:36-51` (verbatim copy at `test_063_post_then_subscribe.py:45-62`).

**Cost:** ~15 minutes (paste fixture + verify).

**Re-open triggers:** Test-infra phase touching `test_059_disconnect.py`; pytest-asyncio version bump; Skill Studio scaffolds new SSE eval tests importing `_drive_sse_until_disconnect`; flaky-test investigation surfacing other `Event loop is closed` cases.

---

### SEED-012: Admin / Operator UI Completeness

**File:** `.planning/seeds/SEED-012-admin-operator-ui-completeness.md`

Operational levers currently outside the UI: DB migrations (paste into Supabase SQL editor); env vars (`REDIS_URL`, `SANDBOX_ENABLED`, `LLM_CALL_TIMEOUT_OVERRIDES`, provider keys); MODEL_CAPABILITIES registry; sandbox config; user management; migration / schema state; worker / Redis / Supabase health; audit log export (per-user only); background runs lifecycle ("kill stuck run", admin view).

**Suggested chunking:** Operator role + admin shell → health & observability dashboard → provider & model management → user management → migrations & schema state → sandbox ops → Settings UI redesign.

**Re-open triggers:** Non-developer operator reports "ssh into server" friction; v3.x scoped to admin/operator/platform UX; onboarding non-developer co-maintainer; cross-trigger from SEED-003.

---

### SEED-013: External Integrations — public API + MCP server + webhooks + service accounts

**File:** `.planning/seeds/SEED-013-external-integrations-api-mcp.md`

13 internal API route modules; no MCP code anywhere; no webhooks (in or out); no API keys (only Supabase JWT); no rate limiting; no per-consumer observability. Position: open-source self-hostable agentic-RAG-as-a-platform with REST + MCP exposure.

**Phasing:** Versioned public API + service accounts (Phase 1) → MCP server (Phase 2) → webhooks (Phase 3) → SDKs (Phase 4, optional).

**Re-open triggers:** Inbound "talk to your app from my app" request; Claude Desktop / Cursor / MCP client user asks for MCP server; milestone scoped to API / integration / platform / MCP; open-source release or hosted offering.

---

### SEED-014: Automations & Routines — scheduled, triggered, reactive agent runs

**File:** `.planning/seeds/SEED-014-automations-routines.md`

Three modes: scheduled ("every Monday at 9am, run contract-review skill"), triggered ("when document lands in folder X, …"), long-running monitors ("watch RSS feed; alert on >0.85 match"). Existing pieces compose well: skills system, run-backed streaming, per-LLM-call timeout machinery, multi-provider router, sandbox, Knowledge Health Dashboard data, audit log.

**Genuinely new:** Scheduler (separate Python process polling Postgres recommended); event bus abstraction on Redis Streams.

**Re-open triggers:** First user request for "schedule this prompt"; Skill Studio milestone in flight; B2B customer asks about workflow automation; competitive pressure from ChatGPT Tasks / Copilot Studio / Glean Workflows / n8n.

---

## 4. Monitoring-Only

### Synchronous Supabase Calls Inside Async Endpoints

Most Supabase calls still use synchronous `supabase-py` client (not `AsyncClient`) inside `async def` route handlers. v2.5 mitigated the streaming hot path via `aexec` / `run_in_threadpool` wrap (D-v2.5-01) plus AnyIO 40→200 ceiling raise. Production-grade asyncpg migration deferred to **SEED-001**.

**Files:** All `backend/app/api/` and `backend/app/services/` files that call `.execute()` directly.

---

### `ingest_document` Runs Blocking Calls in Background Task

`backend/app/api/documents.py:155` uses `background_tasks.add_task(ingest_document, ...)`. FastAPI's `BackgroundTasks` runs after response is sent, but `ingest_document` makes blocking OpenAI embedding calls + chunking loop in the event loop thread.

**Impact:** Long documents block the server during ingestion.

**Fix approach:** Proper task queue (Celery, ARQ) or `asyncio.get_event_loop().run_in_executor()`. Becomes urgent under SEED-001 multi-worker.

---

### `full_markdown` Stored Redundantly Alongside Chunks

`documents.full_markdown` stores full extracted text alongside `document_chunks.content` (chunked) — effectively the same data twice. `fetch_full_document` in `backend/app/services/retrieval_service.py` already reconstructs from chunks without using `full_markdown`.

**Impact:** Storage inefficiency.

**Fix approach:** Drop `full_markdown` and reconstruct from chunks, OR keep only `full_markdown` and derive chunks at read time.

---

### `fetch_all_folders` Scans All Folders on Every Request

`backend/app/utils/folder_utils.py` `fetch_visible_folders` and `get_globally_visible_folder_ids` both call `fetch_all_folders()` (full table scan) repeatedly within a single request. A multi-tool agent turn triggers 5-10 full folder scans per message.

**Files:** `backend/app/utils/folder_utils.py`, `backend/app/api/kb.py`, `backend/app/api/threads.py`

**Fix approach:** Per-request cache passed through call chain, or in-process cache with short TTL. Becomes urgent at SEED-001 scale.

---

### Folder Visibility Computed In-Process

`backend/app/utils/folder_utils.py:13-51` `is_in_global_subtree()` walks ancestor chain in Python. DB-native `folder_is_globally_visible()` recursive CTE exists in `supabase/migrations/019_global_folder_subtree_visibility.sql` and is used by RLS policies, but application reimplements in Python.

**Fix approach:** Replace Python traversal with DB function call.

---

### Keyword Search Does Not Apply Folder Scoping (post-v2.1 partially fixed)

`backend/app/services/retrieval_service.py:218` `_keyword_search()` was extended in v2.1 Phase 21 to accept `folder_ids`; verify this is being passed everywhere it should be. Audit on next ingestion / retrieval-quality milestone.

---

### `glob` Folder Scoping Applied Client-Side After DB Fetch

`backend/app/api/threads.py` glob result filtering done in Python after DB returns all matching documents for the user. `total` count in pre-filter response is misleading.

**Fix approach:** Pass `folder_ids` into `glob_path` and apply filter in DB query.

---

### `analyze_document` Does Not Respect Folder Scope

`analyze_document` tool calls `resolve_document_id` in `backend/app/services/retrieval_service.py:124-148`, which searches by filename across ALL of the user's documents regardless of folder scope.

**Impact:** Folder-scoped chats may surface content from outside the intended folder.

**Fix approach:** Pass `folder_subtree_ids` to `resolve_document_id`.

---

### No Pagination on Any List Endpoint

All list endpoints return unbounded result sets:

- `GET /documents` — `backend/app/api/documents.py:160`
- `GET /threads` — `backend/app/api/threads.py:488`
- `GET /skills` — `backend/app/api/skills.py:72`
- `GET /folders` — `backend/app/api/folders.py:11`

**Fix approach:** Add `limit` + `cursor` (or `offset`) parameters.

---

### Context Window Growth Is Unbounded for Long Conversations

`send_message` in `backend/app/api/threads.py` loads full message history on every message. Trimming added in v2.1 (rolling context window with atomic tool-pair removal); verify trimming is active on all paths and that long threads are bounded.

---

### `web_search` Has No Specific Error Handling for Tavily Failures

`backend/app/services/web_search_service.py:8-34` calls `response.raise_for_status()`; propagates through tool dispatch and is caught by the broad `except Exception`, returning generic `"Tool execution failed: ..."` to LLM.

**Fix approach:** Catch specific Tavily exceptions and return structured error message.

---

### Tool Errors Not Distinguishable by SSE Clients

Tool execution errors emit generic `"Tool execution failed: {e}"` string with standard `tool_end` SSE event. Frontend and LLM cannot distinguish failure from real result.

**Fix approach:** Emit structured `tool_error` SSE event type distinct from `tool_end`.

---

### `load_user_settings` Ignores `user_id` — Stub Function

`backend/app/models/user_settings.py:306-307`:

```python
def load_user_settings(user_id: str, supabase=None) -> UserEffectiveSettings:
    return load_app_settings()
```

Signature accepts `user_id` and `supabase` but ignores both. Settings are shared across all users. Becomes blocker for SEED-004 multi-tenancy.

**Fix approach:** Implement actual per-user settings or remove the parameter to make global-only behaviour explicit.

---

### `app_settings` DB Table is Unused Dead Code

Migration `010_app_settings.sql` creates `public.app_settings` table. Application reads/writes settings via `backend/settings_override.json` on disk instead.

**Fix approach:** Drop the table OR migrate settings storage to use it. Coupled with SEED-012 admin UI work.

---

### MIME Fidelity Lost in Skill Import/Export

`import_skill` stores all skill files as `application/octet-stream` (`backend/app/api/skills.py:232`). Round-trip works but MIME is lost on re-import. PRD Open Question #3 (Skill Studio) asks how eval runs handle file outputs (text vs file) — same root.

**Re-open trigger:** SEED-002 Skill Studio milestone (PRD Open Question #3).

---

### `import_skill` Returns 202 BackgroundTask — Status Not Tracked

Historical micro-ticket 260412-jnc — `unknown` status; verify whether import status tracking was implemented at any point in v2.x.

---

### CORS Allows Any `localhost` Port

`backend/app/main.py:28-35` uses `allow_origin_regex=r"http://localhost:\d+"`. Acceptable for dev; must tighten for production. Coupled with SEED-013 external API work.

---

### Provider-Latency Variance (OpenRouter slower than direct providers)

Observed in Phase 067.4 UAT: OpenRouter is observably slower than direct OpenAI/Anthropic SDK paths because each request makes an extra hop through OpenRouter's backend before reaching the actual model. Some OpenRouter-routed models (e.g., Kimi 2.5) also have weaker first-shot tool-use accuracy. Documented in **SEED-008**. Could surface as a "via OpenRouter" badge near model picker.

**Not a bug.** Provider characteristic.

---

## 5. Historical Debt

### 15 Backend Test Failures from Side-Phase 002 (test-suite-remediation)

Surfaced in `STATE.md` `## Blockers/Concerns`. Deferred from v2.4 close. NOT v2.5 scope.

**Re-open trigger:** Skill Studio Phase 0 (test-infra repair) — already partially addressed by Phase 065 (skills suite 26/26 pass) but the broader 15-test count is unverified post-v2.5.

---

### Pre-GSD Quick Tasks (11 historical micro-tickets, mostly `unknown` status)

Per `STATE.md` `## Quick tasks — historical micro-tickets predating GSD`:

- `260322-26g` — improve tool-call display for ls/tree/grep
- `260328-v6n` — investigate duplicate folder behavior
- `260328-wqj` — folder-scoped chat returning results bug
- `260328-x6n` — folder not created when pressing (`completed` per tracker)
- `260404-vel` — streaming cursor bug + meaningful indicator
- `260405-rgy` — folder public visibility files
- `260405-s1e` — hide toggle-global from non-owners
- `260407-vqw` — context window management review
- `260411-wj5` — skill file upload bug
- `260412-dqu` — four issues in skills API
- `260412-jnc` — import skill 202 BackgroundTask

These pre-date the GSD planning workflow. Most are `unknown` status (the tracker has no link back to whether they shipped). Several were almost certainly resolved during v2.2 / v2.3 / v2.4 milestones but the quick-task tracker was never reconciled. NOT in v2.5 scope; should be re-triaged at next milestone planning if any still reproduce.

**Files:** `.planning/quick/260322-26g-...` through `.planning/quick/260412-jnc-...`

---

### v2.4 UAT / Verification Gaps (Phases 45, 46, 48)

Per v2.4 milestone close (2026-04-30) — 19 deferred items including:

- Phase 45: 5 pending UAT scenarios (delete dialog, ghost content, folder selector, etc.)
- Phase 46: 3 pending UAT scenarios (CASCADE cleanup, dialog rendering, non-contiguous version promotion)
- Phase 48: 6 pending UAT scenarios (web search toggle, nav visual)
- All three with `human_needed` verification status

**Re-open trigger:** Live browser testing pass (Chrome MCP available — see global memory `feedback_chrome_mcp_testing.md`).

---

### v2.3 UAT Verification Gaps (Phases 038–042)

Per `STATE.md` `## Blockers/Concerns`: still require live browser testing. Carried from v2.3 milestone close 2026-04-19.

---

### v2.5 UAT Status Field Drift (10 phases)

Per `STATE.md` `## Deferred Items`:

| Phase | UAT file | Recorded status | Reality |
|-------|----------|-----------------|---------|
| 062 | 062-HUMAN-UAT.md | partial | Closed via v2.5 chain |
| 063.1 | 063.1-HUMAN-UAT.md | partial | Closed (project-level approval) |
| 066 | 066-HUMAN-UAT.md | green | Closed; UAT was already green/approved |
| 067 | 067-HUMAN-UAT.md | partial | Closed (project-level approval) |
| 067.1 | 067.1-HUMAN-UAT.md | green-with-note | Closed (SC#3 substantive 5/5 / strict 3/5) |
| 067.2 | 067.2-HUMAN-UAT.md | blocked | Closed via 067.3/067.4/067.5 cross-phase chain |
| 067.3 | 067.3-HUMAN-UAT.md | gaps_blocking | Closed via 067.4 R-3 GREEN |
| 067.4 | 067.4-CLOSING-UAT-RUNBOOK.md | unknown | Runbook artifact, not scoreboard |
| 067.4 | 067.4-HUMAN-UAT.md | gaps_blocking | Closed via 067.5 Branch D-3 fix |
| 067.5 | 067.5-02-CLOSING-UAT.md | unknown | Closing UAT — gate met, 5/5 cycles GREEN |

Cosmetic-only — all 10 show 0 pending scenarios. Future workflow improvement: when downstream phase closes upstream's gate-blocking row, the closing executor should mirror the status field update.

---

### v2.5 Verification Gaps Marked `human_needed` (4 phases)

Phases 061, 063, 063.1, 067 all closed with `project_level_approval: approved` per Phase 063 precedent. None blocked phase closure.

---

### Vitest Cannot Run on Windows Dev Machine (npm optional-dep cascade)

Phase 063.1 plans 02–04 documented: missing `@rolldown/binding-win32-x64-msvc` + `@jridgewell/sourcemap-codec` from npm optional-dep bug. TypeScript compilation gate substituted; Phase 063.1 Plan 05 e2e specs provide cross-stream regression coverage.

**Files:** Mentioned across `frontend/package.json`, `frontend/package-lock.json`.

**Status:** Test execution deferred to CI / freshly `npm install`-ed environment. Not blocking; worked around via TS gate + Playwright e2e.

**Re-open trigger:** Frontend test failures suspected; CI pipeline introduction (SEED-003); fresh dev-machine onboarding.

---

### Phase 064 Validation Harness — DEFERRED (intentional)

Originally scoped Chrome MCP scripts for scenarios E (tab-switch mid-stream), F (refresh mid-stream), G (Stop button), H (thread navigation), and multi-tab sync. Scenarios E + F + H validated organically by Phases 067.3 / 067.4 / 067.5 user-driven UAT (5/5 GREEN cycles). G + multi-tab sync remain partially deferred to a future side-phase if ever needed.

**Status:** Intentional non-blocker. Will get pulled into SEED-012 admin UI work (validation-runner UI surface).

---

## Dependencies at Risk

### `sentence-transformers` Always Installed but Rarely Used

`backend/requirements.txt:23` includes `sentence-transformers>=3.0.0`. Large ML package (~500 MB with PyTorch) only used when `rerank_provider="local"`. Imported lazily but always installed in venv.

**Fix approach:** Make optional dependency with separate `requirements-local-rerank.txt`.

---

### `llm-sandbox[docker]` Requires Docker Daemon — No Startup Validation

`backend/requirements.txt:24` includes `llm-sandbox[docker]>=0.3.37`. When sandbox is enabled, Docker must be running or sessions fail at runtime with only generic tool error.

**Fix approach:** Startup health check validating Docker connectivity when `SANDBOX_ENABLED=true`. Coupled with SEED-012 admin health dashboard.

---

### `openai>=2.0.0` — Unpinned Major Version Upper Bound

`backend/requirements.txt:5` specifies `openai>=2.0.0` with no upper bound. Future `openai 3.x` with breaking changes would silently install and break LLM calls.

**Fix approach:** Pin `openai>=2.0.0,<3.0.0`. Same risk pattern for `anthropic>=0.97.0`, `tiktoken>=0.12.0`, `pdfplumber>=0.11.0`, `pypdf>=5.0.0`, `python-docx>=1.0.0`, `python-pptx>=1.0.0`, `openpyxl>=3.1.0`, `ebooklib>=0.18`, `httpx>=0.27.0`, `sentence-transformers>=3.0.0`, `llm-sandbox[docker]>=0.3.37`.

---

### `httpx` Version Conflict Blocks Docling Adoption

Docling 2.92 forces `httpx>=0.28`; entire supabase 2.10 stack pins `httpx<0.28`. Resolving requires upgrading supabase 2.10 → 2.29 (package renames `gotrue`→`supabase-auth`, `supafunc`→`supabase-functions`). Documented in **SEED-006** as deferred decision.

**Re-open trigger:** SEED-006 trigger fires AND benchmark on 3-5 docs shows Docling adds ≥30% more real_tables vs PyMuPDF.

---

## Test Coverage Gaps

### Tool Dispatch Loop Has No Unit Tests

`backend/app/api/threads.py:876+` — tested only through integration tests with Supabase mocks. No unit tests for individual tool branches in isolation (`load_skill`, `save_skill`, `read_skill_file`, `execute_code`, `analyze_document`, `query_tables`, `remember`, `recall`).

**What's not tested:** Each tool branch in isolation; `_reconstruct_history` backward-compat branch; context budget truncation logic; per-call timeout invocation surface.

**Priority:** High. Largest single test-coverage blind spot.

---

### No Tests for SSE Streaming Parser in Frontend

`frontend/src/lib/api.ts` `streamMessage()` SSE parsing logic has no tests in `frontend/src/__tests__/lib/api.test.ts`. A regression silently breaks all chat streaming.

**Priority:** High. Compounded by Vitest-on-Windows blocker — `__tests__` files don't run locally; Playwright e2e is the only regression net.

---

### Sandbox End-to-End Flow Has No Real Integration Tests

`backend/tests/unit/test_sandbox_service.py` and `test_sandbox_tools.py` mock the sandbox manager. No tests exercise actual Docker execution path (install libraries, run code, harvest output files, upload to storage).

**Priority:** Medium.

---

### `extract_metadata` LLM Call Is Never Tested

`backend/app/services/embedding_service.py` `extract_metadata()` makes an LLM call during ingestion and silently swallows all failures (`except Exception: return None`). No tests for extraction prompt, Pydantic validation, or fallback path.

**Priority:** Low.

---

### Pre-Existing test_059 Flake (SEED-011)

`backend/tests/integration/test_059_disconnect.py::test_normal_stream_unchanged` — `RuntimeError: Event loop is closed` during teardown. Other tests in same file pass. Verified pre-existing on `fa1e327` base.

**Priority:** Low. Pure test-infra hygiene; ~15 minutes to fix via `_reset_redis_singleton` autouse fixture pattern.

---

## Architectural Constraints (recorded so future contributors don't trip over them)

These are not bugs; they are load-bearing decisions captured in `CLAUDE.md` and `PROJECT.md` Key Decisions. Listed here so any code review touching the relevant surface knows to check.

- **D-v2.5-01:** Blocking I/O in async handlers wrapped via `run_in_threadpool` / `aexec`. New `supabase-py` callsite without wrap = bug.
- **D-v2.5-02:** Single uvicorn worker. `--workers N` masks concurrency bugs and breaks in-memory state (sandbox sessions, Redis singletons, run buffers).
- **D-v2.5-03:** Realtime is best-effort hint. Always reconcile via fetch on (re)connect.
- **D-v2.5-08/09/10:** STREAM-04 run-backed streaming (Redis Streams + replay-and-tail). All streaming-surface changes must go through this architecture, not POST-streaming.
- **D-v2.5-11:** v2.5 stream-architecture deployment was atomic (061+062+063 single feature branch). Future architectural shifts should consider same-merge atomicity for similar surface area.
- **D-v2.5-12:** `messages.confidence_*` columns restored via migration `037_messages_confidence_columns.sql`. Confidence reads/writes in `backend/app/api/threads.py:1027-1029` and `backend/app/services/knowledge_health.py:148-484` and `backend/app/models/message.py:25-27` depend on these columns being present.
- **D-066-11:** `stream.close()` invariant under synthetic-timeout — preserved by `_drain_stream_with_close_on_cancel` Track A helper.
- **D-067.3-N01:** Model→provider router resolution chain — `MODEL_CAPABILITIES[model]['provider']` honored at `backend/app/api/threads.py:949`.

---

*Concerns audit: 2026-05-09 — refreshed at v2.5 milestone close. Folds in 14 active seeds (SEED-001..SEED-014), 1 known issue (KI-001), 31 v2.5 deferred items from STATE.md, plus carry-forward debt from v2.3 / v2.4. Service-role-bypass / SQL-injection / SECURITY-DEFINER / settings-on-disk / no-upload-size-limit critical risks remain unchanged from prior audit (2026-04-05). `threads.py:send_message` god function grew from 612 to ~1850 LOC over v2.5 — largest mechanical refactor outstanding. Duplicate-migrations directory and orphaned pip artifacts are now resolved (no longer flagged).*
