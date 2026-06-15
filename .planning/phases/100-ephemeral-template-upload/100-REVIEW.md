---
phase: 100-ephemeral-template-upload
reviewed: 2026-06-10T12:25:20Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/api/workspace.py
  - backend/app/db/workspace.py
  - backend/app/main.py
  - backend/app/models/harness.py
  - backend/app/models/user_settings.py
  - backend/app/services/template_service.py
  - backend/app/services/workspace_service.py
  - backend/tests/conftest.py
  - backend/tests/test_workspace_template.py
  - frontend/src/components/panel/__tests__/FilesSection.test.tsx
  - frontend/src/components/panel/FilesSection.tsx
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
  - supabase/migrations/068_workspace_template_ephemeral.sql
findings:
  critical: 0
  warning: 8
  info: 6
  total: 14
status: issues_found
---

# Phase 100: Code Review Report

**Reviewed:** 2026-06-10T12:25:20Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 100 (Ephemeral Template Upload, TMPL-01) was reviewed at standard depth. Large pre-existing files (`threads.py`, `main.py`, `harness.py`) were reviewed via their phase-100 diff hunks (`git diff f38763f5..HEAD`) plus surrounding context; all other files were reviewed in full.

**What holds up well:**

- **G-5 compliance verified.** The `threads.py` hunk (lines 971-982) is a genuinely thin delegating call — no inline query/Storage logic; all lifecycle logic lives in `template_service.py`. Same for the `main.py` sweep wiring.
- **D-11 byte-identical path verified.** NULL `kind`/`expires_at` defaults thread through `write_file` → `upsert_workspace_file` correctly; the asyncpg list gate (`expires_at IS NULL OR expires_at > now()`) and the REST `.or_` gates are literal no-ops for agent rows. Migration 068 is nullable-with-NULL-allowing-CHECK, so pre-existing rows stay valid.
- **D-12 OOXML validation is solid** — `zipfile.is_zipfile` + `[Content_Types].xml` + per-extension part marker is a real magic-byte gate, stdlib-only, with nothing persisted on rejection.
- **D-06 signed-URL bypass is closed** — the content route gates the row SELECT before any signed URL is minted (Pitfall 2 handled), and all 4 REST GET routes carry the expiry gate.
- **D-09 pin SQL is correct** — `GREATEST` extend-only with `kind = 'template_input' AND expires_at IS NOT NULL` guard, so agent rows can never acquire an expiry.
- `_verify_thread_ownership` (404, not 403) covers the upload route; cross-user isolation looks right.

**Key concerns:** two gaps in the "expired/ephemeral templates are hidden from ALL read paths" invariant (WR-01, WR-02), a permanent Storage-byte leak mode in the sweep's delete ordering (WR-03), unbounded request buffering before the upload size check (WR-04), common real-world filenames rejected with a confusing error (WR-05), and most of the phase's TDD contract tests remaining vacuous symbol-existence stubs (WR-06, WR-07).

No Critical issues found. No source files were modified by this review.

## Warnings

### WR-01: Agent overwrite of a template path silently clears `kind`/`expires_at`, making the original template bytes permanent

**File:** `backend/app/db/workspace.py:36-43`
**Issue:** The upsert's `ON CONFLICT ... DO UPDATE` unconditionally sets `kind = EXCLUDED.kind, expires_at = EXCLUDED.expires_at`. Every agent caller passes `kind=None, expires_at=None`, so if the agent ever does a `workspace_write` to the exact path of an uploaded template (visible to it via `workspace_list` — e.g., a "fill in the template" run that writes back to the same path), the row's expiry is NULLed. The row then never expires, the sweep never touches it, and — crucially — the **original user-uploaded template bytes remain forever in `workspace_file_versions` v1** (inline or Storage). This bypasses the phase's core ephemeral guarantee (TTL-bound, GC'd by the janitor).
**Fix:** Preserve template lifecycle metadata on overwrite. No caller today intentionally clears these fields, so `COALESCE` is safe:
```sql
ON CONFLICT (thread_id, path) DO UPDATE SET
    ...
    kind = COALESCE(EXCLUDED.kind, workspace_files.kind),
    expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at),
    updated_at = now()
```
Alternatively, reject agent writes to `kind='template_input'` paths in `write_file`. Either way, add a test for "agent overwrites template path → expiry survives (or write rejected)".

### WR-02: `workspace_diff` tool path is not gated on expiry — expired templates still resolve through `get_diff`

**File:** `backend/app/services/workspace_service.py:435-437`
**Issue:** `read_file` raises `FileNotFoundError_("template expired")` on `is_expired` (D-10), and `list_files` is gated, but `get_diff` — exposed to the agent as the `workspace_diff` tool via `ws_get_diff` (`tool_dispatcher.py:1139`) — calls `get_file_by_path` and never checks `is_expired`. An expired-but-unswept template is still "found" by the diff path (today the practical exposure is small — a single-version template returns an empty diff — but the row's existence and version metadata leak, and the behavior contradicts both D-10 run-honesty and the phase guarantee that expired templates are hidden from ALL read paths). `delete_file` also skips the check, but deleting an expired row is harmless/GC-friendly.
**Fix:** Mirror the `read_file` gate in `get_diff`:
```python
file_row = await get_file_by_path(pool, thread_id, path)
if not file_row:
    raise FileNotFoundError_(f"File not found: {path}")
if file_row.get("is_expired"):
    raise FileNotFoundError_("template expired")  # D-10
```

### WR-03: Sweep deletes the DB row before removing Storage bytes — a failed remove orphans the bytes permanently with no retry

**File:** `backend/app/services/template_service.py:57-71`
**Issue:** `sweep_expired` gathers Storage paths, DELETEs the row (CASCADE drops the version rows), and only then removes Storage objects. If `supabase.storage.remove` fails (transient network/Storage outage — exactly when a best-effort sweep is most likely to fail), the paths are gone from the DB forever and **no future sweep can retry** — the user's template bytes persist indefinitely in the `workspace-files` bucket, with only a warning log as a trace. For a feature whose contract is "expired templates get GC'd", this is a permanent-leak failure mode, not just a delayed one.
**Fix:** Reverse the order so failures are self-healing — remove Storage objects first, then delete the row. If the remove fails, skip the row delete; the row stays in the next sweep's SELECT and the whole operation retries on the next cadence (Storage `remove` of an already-gone object is a no-op, so the sibling-worker race stays idempotent):
```python
paths = await get_storage_paths_for_file(pool, file_id)
failed = False
for sp in paths:
    try:
        await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).remove, [sp])
    except Exception:
        failed = True
        logger.warning("Template sweep: failed to remove storage object %s (will retry next sweep)", sp)
if failed:
    continue  # row stays; next sweep retries row + bytes
res = await pool.execute("DELETE FROM workspace_files WHERE id = $1", file_id)
```

### WR-04: Upload route buffers the entire request body in memory before the 10 MB check

**File:** `backend/app/api/workspace.py:157-161`
**Issue:** `raw = await file.read()` loads the full upload into RAM and only afterwards checks `len(raw) > 10 * 1024 * 1024`. Uvicorn/FastAPI impose no default body-size limit, so an authenticated user can POST a multi-GB file and the worker fully materializes it in memory before rejecting — a memory-exhaustion vector (amplified by `WORKER_COUNT=2` and concurrent requests). Starlette spools large multipart parts to a temp file, but `.read()` pulls all of it back into one bytes object.
**Fix:** Check the size before materializing:
```python
if file.size is not None and file.size > 10 * 1024 * 1024:   # FastAPI sets UploadFile.size from the spooled part
    raise HTTPException(422, "File too large. Maximum size is 10 MB.")
raw = await file.read()
```
(or read in chunks with a running cap of `MAX_FILE_SIZE + 1` and abort early).

### WR-05: Common real-world filenames are rejected with a confusing "invalid path" 422

**File:** `backend/app/api/workspace.py:165-166` (interacting with `workspace_service.py:40,75-96`)
**Issue:** `safe_name` only sanitizes `/` and `\`, but the resulting path must pass `validate_path`'s `^/[a-zA-Z0-9._/\- ]+$` charset and the `".." not in path` rule. Entirely ordinary template filenames — `Q3 Report (final).docx`, `P&L 2026.xlsx`, `Übersicht.docx`, `report..v2.docx` — all raise `PathValidationError`, which surfaces to the panel as a 422 about *path characters* / *directory traversal*, for a user who never typed a path. This will be one of the first things a real user hits.
**Fix:** Sanitize the filename to the allowed charset before building the path:
```python
import re
stem = (file.filename or f"template{ext}")
safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
path = f"/{uuid4().hex[:8]}-{safe_name}"
```

### WR-06: Most of the phase's TDD contract tests are still vacuous symbol-existence stubs

**File:** `backend/tests/test_workspace_template.py:141-285`
**Issue:** The file is documented as "the cross-plan TDD contract... RED-by-design until the implementing plan lands", but the implementing plans (100-02..100-06) have all landed and 7 of the 10 tests were never upgraded: `test_upload_sets_kind_and_ttl` (asserts `upload_template is not None` plus a tautological `isinstance(timedelta(...), timedelta)`), `test_agent_files_unchanged`, `test_expired_excluded_rest`, `test_cross_user_isolation`, `test_sweep_deletes_rows_and_bytes`, `test_run_pin_extends_and_noop`, and `test_existing_rows_valid` (only greps the migration file for substrings). All carry `xfail(strict=False)`, so they now silently XPASS. Net effect: the sweep's row+bytes GC, the run-pin GREATEST/no-op semantics, the REST expiry exclusion, kind/TTL persistence, and cross-user isolation have **zero automated behavioral coverage** — the suite passing says almost nothing about this phase. Only `test_expired_tool_read_errors` (D-10) and the OOXML validator tests exercise real behavior.
**Fix:** Upgrade the stubs to behavioral tests against the now-existing seams (the docstrings already describe the exact assertions, e.g. for the pin: insert a `template_input` row with a near expiry into a test pool/mocked `pool.execute`, call `pin_templates_for_run`, assert the GREATEST extension and the 0-rows no-op; for the sweep: mock `pool.fetch`/`pool.execute` + a spy Storage client and assert paths-gathered-before-delete and idempotent second run). At minimum, drop the `xfail` markers so future regressions aren't masked.

### WR-07: Per-extension icon test asserts against the Upload button's SVG — assertion is vacuous

**File:** `frontend/src/components/panel/__tests__/FilesSection.test.tsx:230-231`
**Issue:** `container.querySelector("svg")` returns the **first** SVG in the rendered tree, which since this same phase's Plan 06 is the `Upload` icon in the upload affordance (rendered above the listbox), class `lucide-upload`. `expect(icon?.classList.contains("lucide-file")).toBe(false)` therefore passes regardless of which icon the template row renders — the test would stay green even if `iconFor` regressed to the generic `FileIcon`. The D-02 per-extension icon contract is not actually pinned.
**Fix:** Query the icon inside the row instead:
```tsx
const row = screen.getByRole("option")
const icon = row.querySelector("svg")
expect(icon?.classList.contains("lucide-file-text")).toBe(true)  // docx → FileText
```

### WR-08: Upload response shape (`file_id`) doesn't match `WorkspaceFile` (`id`) — masked by a type assertion

**File:** `frontend/src/lib/api.ts:1185-1200` (and `backend/app/api/workspace.py:168-184`)
**Issue:** The backend upload route returns the `write_file` dict, whose key is `file_id` (string) — there is no `id` key. `uploadWorkspaceTemplate` casts the JSON `as WorkspaceFile`, so the optimistically upserted store row has `id === undefined` (also missing `created_at`/`updated_at`). The store keys by `path` and `FilePreview`'s `useResolvedFileId` backfills the id from the GET listing, so behavior degrades gracefully (one extra GET per fresh-upload open) — but the cast hides a real shape mismatch, and the 088-05 D-16 history shows missing workspace-file ids caused live `/files//content` 404s before. Any future consumer reading `.id` off a fresh upload gets `undefined` silently.
**Fix:** Map the field at the API boundary instead of casting:
```ts
const row = await res.json()
return { ...row, id: row.id ?? row.file_id } as WorkspaceFile
```
(or have the backend route include `"id": result["file_id"]` in the response, matching the GET listing shape).

## Info

### IN-01: Brittle rowcount check `res.endswith("0")`

**File:** `backend/app/services/template_service.py:60`
**Issue:** asyncpg `execute` returns `"DELETE <n>"`. `endswith("0")` is only correct because this DELETE is by primary key (n ∈ {0,1}); any future bulk variant would misclassify `"DELETE 10"` as a no-op. The sibling `pin_templates_for_run` already parses `res.split()[-1]`.
**Fix:** `if res.split()[-1] == "0": continue`.

### IN-02: Redundant re-set of `kind`/`expires_at` on the upload response

**File:** `backend/app/api/workspace.py:182-183`
**Issue:** `write_file` already returns `kind` and `expires_at` (isoformat) in its result dict; the handler overwrites them with identical values.
**Fix:** Delete the two lines, or keep one source of truth in `write_file`.

### IN-03: Hardcoded 10 MB duplicates `workspace_service.MAX_FILE_SIZE`

**File:** `backend/app/api/workspace.py:160`
**Issue:** Magic number `10 * 1024 * 1024` duplicates `MAX_FILE_SIZE` (workspace_service.py:34); a future limit change would have to touch both (the conftest fixture duplicates it a third time, intentionally per its comment).
**Fix:** `from app.services.workspace_service import MAX_FILE_SIZE` and compare against that.

### IN-04: Sweep task created without retaining a reference

**File:** `backend/app/main.py:272`
**Issue:** `asyncio.create_task(_sweep_expired_templates())` discards the task handle. Per the asyncio docs, an unreferenced task can be garbage-collected mid-execution (unlikely while awaiting `sleep`, but documented). The pre-existing `_resume_stranded` follows the same pattern, so this matches house style — but the janitor is a long-lived loop, the canonical case for keeping a module-level reference (and it would enable clean cancellation at shutdown).
**Fix:** `app_instance.state.template_sweep_task = asyncio.create_task(...)` and `task.cancel()` after the lifespan `yield`.

### IN-05: REST expiry gate uses app-server clock; asyncpg gates use DB `now()`

**File:** `backend/app/api/workspace.py:193-201`
**Issue:** `_now_iso()` embeds the FastAPI process's clock into the PostgREST filter, while `list_files_in_thread`/`is_expired`/the sweep all compare against Postgres `now()`. Clock skew between app and DB creates a small window where the panel and the agent tools disagree about whether a template is expired. Harmless at current skew expectations; worth knowing when local-vs-cloud Supabase is switched via env (different hosts).
**Fix:** Acceptable as-is; alternatively note the assumption in the docstring, or route the listing through the (DB-clock) asyncpg seam.

### IN-06: A failed run-pin fails the whole kickoff

**File:** `backend/app/api/threads.py:977-981`
**Issue:** `pin_templates_for_run` is awaited inline with no error handling, so a transient DB error in this nicety (extending template expiry) aborts the user's workflow kickoff with a 500. The sweep wrapper in `main.py` treats its half of the lifecycle as best-effort; the pin arguably should match — an unpinned template at worst surfaces the honest D-10 "template expired" mid-run rather than killing the kickoff at the door.
**Fix:** Wrap in `try/except Exception: logger.exception("run-pin failed; kickoff continues unpinned")` — or keep fail-closed deliberately and document the choice in the service docstring.

---

_Reviewed: 2026-06-10T12:25:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
