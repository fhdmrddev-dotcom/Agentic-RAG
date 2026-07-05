---
phase: 260705-nfu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/skills.py
  - backend/tests/integration/test_skills_import_export.py
autonomous: true
requirements: [QUICK-260705-nfu-skill-import-collision-dataloss]
must_haves:
  truths:
    - "Two companion files that flatten to the same basename both get uploaded under DISTINCT storage paths (neither is silently lost)"
    - "A file positioned AFTER a failing file in the upload loop still gets uploaded — one failure no longer aborts the loop"
    - "In the synchronous path (file_count <= 20) per-file upload failures appear in the /skills/import response `errors` list via the existing SkillImportError channel"
    - "In the background path (file_count > 20) per-file upload failures are logged server-side (no response channel remains)"
    - "The `os.path.basename(relative)` flattening line is UNCHANGED — folder-tree fidelity stays out of scope"
  artifacts:
    - path: "backend/app/api/skills.py"
      provides: "Resilient _upload_skill_files (per-file try/except, returns error list, logs) + import_skill flattened-name de-dup + per-file error wiring + module logger"
      contains: "logger = logging.getLogger(__name__)"
    - path: "backend/tests/integration/test_skills_import_export.py"
      provides: "TestImportCollisionResilience — three behavioral regression tests (dedup survival + one-failure-doesnt-kill-loop + background-path resilience/logging)"
      contains: "class TestImportCollisionResilience"
  key_links:
    - from: "import_skill file-collection loop"
      to: "distinct storage_path per colliding flattened name"
      via: "_dedup_flattened_name(filename, used_names)"
      pattern: "_dedup_flattened_name"
    - from: "_upload_skill_files return value"
      to: "response `errors` (sync) / logger.warning (background)"
      via: "per-file error list aggregation"
      pattern: "errors.append"
    - from: "logger = logging.getLogger(__name__)"
      to: "server-side per-file failure record"
      via: "logger.warning on caught exception"
      pattern: "logger.warning"
---

<objective>
Fix a silent data-loss bug in skill ZIP import (`backend/app/api/skills.py`). When a ZIP contains multiple files that flatten to the same basename (e.g. three `__init__.py` in three folders), the flattened storage paths collide; the second colliding upload fails, and because `_upload_skill_files` has no per-file error handling the unhandled exception aborts the ENTIRE loop — every file later in ZIP order is silently dropped with no error shown to the user.

Two coordinated fixes, keeping the existing flat-storage model unchanged (folder-tree fidelity is deliberately out of scope):
1. Make `_upload_skill_files` resilient — wrap each file's upload + DB insert in try/except so one failure never stops the rest, and return a list of per-file errors instead of propagating.
2. De-duplicate colliding flattened filenames BEFORE upload in `import_skill`'s file-collection loop, so distinct source files get distinct storage paths.

Then surface remaining per-file errors: synchronous path appends a `SkillImportError` to the existing response `errors` list (reused as-is, no new frontend/response surface); backgrounded path logs server-side.

Purpose: Restore the guarantee that an imported skill's files all survive (or their failures are visible), closing a confirmed live data-loss defect (real docx skill imported only the files preceding the second colliding `__init__.py`).
Output: Patched `skills.py` + three behavioral regression tests that are red against the pre-fix code.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@backend/app/api/skills.py
@backend/app/models/skill.py
@backend/tests/integration/test_skills_import_export.py
@backend/tests/conftest.py

<interfaces>
<!-- Contracts the executor needs directly — no codebase exploration required. -->

CURRENT `_upload_skill_files` (backend/app/api/skills.py) — returns None, NO try/except (the bug):
```
def _upload_skill_files(files_to_upload: list[dict], skill_id: str, user_id: str, supabase: Client) -> None:
    for entry in files_to_upload:
        supabase.storage.from_("skill-files").upload(path=entry["storage_path"], file=entry["file_bytes"], file_options={"content-type": entry["mime_type"]})
        supabase.table("skill_files").insert({... "filename": entry["filename"], "file_path": entry["storage_path"] ...}).execute()
```
Each dict carries: file_bytes, filename, storage_path, mime_type.

CURRENT `import_skill` file-collection loop (the collision site — build files_to_upload per parsed skill):
```
files_to_upload: list[dict] = []
for entry_name in zf.namelist():
    if not entry_name.startswith(prefix): continue
    if entry_name.endswith("SKILL.md") or entry_name.endswith("/"): continue
    relative = entry_name[len(prefix):] if prefix else entry_name
    filename = os.path.basename(relative)     # <<< DO NOT TOUCH THIS LINE
    if not filename: continue
    file_bytes = zf.read(entry_name)
    storage_path = f"{current_user['id']}/{skill_row['id']}/{filename}"   # <<< collides when filename repeats
    files_to_upload.append({"file_bytes": file_bytes, "filename": filename, "storage_path": storage_path, "mime_type": "application/octet-stream"})
file_count = len(files_to_upload)
if file_count > 20:
    background_tasks.add_task(_upload_skill_files, files_to_upload, skill_row["id"], current_user["id"], supabase)  # return DISCARDED
    has_background = True
else:
    _upload_skill_files(files_to_upload, skill_row["id"], current_user["id"], supabase)   # return currently ignored
```
`errors: list[dict]` is initialized earlier and already returned by the endpoint (`{"created": results, "errors": errors}`); existing parse-error appends use `{"skill": prefix or "root", "error": str(e)}`. `fm["name"]` is the skill name in scope inside the `for prefix, fm, instructions in parsed:` loop.

SkillImportError shape (backend/app/models/skill.py) — reuse EXACTLY: `{skill: str, error: str}`.

Logging convention to mirror (backend/app/services/sandbox_service.py): `import logging` then module-level `logger = logging.getLogger(__name__)`; call sites use %-style lazy args, e.g. `logger.warning("...%s...", value)`. NOTE: skills.py does NOT yet import logging — add it.

Test mock architecture (backend/tests/conftest.py) — shared module singletons reset by an autouse fixture:
- `mock_builder` fixture = the fluent `_builder`; ALL `supabase.table(...)` calls return it, so `.execute()` calls across every table share one call stream. Set `mock_builder.execute.return_value = _make_result([...])` (robust) OR `.side_effect = [...]` (order-sensitive).
- `_supabase.storage.from_.return_value.upload` = the storage upload mock; inspect `.call_args_list` (each call's `.kwargs["path"]` is the storage_path). Set `.side_effect` to force failures.
- IMPORTANT: the autouse `reset_mocks` clears `_builder.execute.side_effect` but does NOT clear storage-mock side_effects — a test that sets `upload.side_effect` MUST restore it to `None` in a `finally`.
- Existing helpers in test_skills_import_export.py: `_make_zip({name: content})`, `_valid_skill_md(name=...)`, `_skill_row(name=...)`, `_make_result(data)`.
- Import endpoint has NO response_model → returned dicts (raw `_skill_row`) serialize as-is; tests read `data["created"]` / `data["errors"]`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make _upload_skill_files resilient + add module logger</name>
  <files>backend/app/api/skills.py</files>
  <action>
Add `import logging` to the stdlib import block at the top of the file (alongside io/os/re/zipfile) and define a module-level `logger = logging.getLogger(__name__)` just after the imports (before `router = APIRouter(...)`), mirroring backend/app/services/sandbox_service.py exactly.

Rewrite `_upload_skill_files` so the per-file loop wraps BOTH the `supabase.storage.from_("skill-files").upload(...)` call AND the following `supabase.table("skill_files").insert(...).execute()` for a single file inside one `try/except Exception as exc`. On success the behavior is byte-for-byte unchanged. On exception: call `logger.warning(...)` with the skill_id, the file's `entry["filename"]`, and the exception (use %-style lazy args like sandbox_service — NOT f-strings), then append `{"filename": entry["filename"], "error": str(exc)}` to a local `errors` list and CONTINUE the loop — never re-raise. Change the return annotation from `None` to `list[dict]` and `return errors` (empty when every file succeeds).

Do NOT change how storage_path/filename are computed anywhere — this function only consumes the dicts it is handed. Do NOT touch create_skill, save_skill, load_skill, or any other endpoint.
  </action>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -q</automated>
  </verify>
  <done>`_upload_skill_files` returns a `list[dict]`; a single file's upload/insert exception is caught, logged via `logger.warning`, and neither aborts the loop nor propagates; `logger = logging.getLogger(__name__)` exists at module scope; all 15 existing import/export tests stay green (callers currently ignore the return, so the change is backward-compatible).</done>
</task>

<task type="auto">
  <name>Task 2: De-dup flattened names in import_skill + wire per-file errors</name>
  <files>backend/app/api/skills.py</files>
  <action>
Add a small module-level helper `_dedup_flattened_name(filename: str, used_names: set[str]) -> str`: if `filename` is not in `used_names`, add it and return it unchanged (first occurrence keeps its plain name); otherwise split with `os.path.splitext` and append the smallest integer >= 2 before the extension (`__init__.py` -> `__init__2.py` -> `__init__3.py`; a no-extension name like `Makefile` -> `Makefile2`), skipping any candidate already in `used_names`, then add the chosen name and return it. Deterministic and collision-free.

In `import_skill`'s companion-file collection loop: keep the `filename = os.path.basename(relative)` line EXACTLY as-is (per D — folder flattening stays out of scope; this fix is about not LOSING files to collisions, not preserving folders). Where `files_to_upload: list[dict] = []` is initialized for the skill, also initialize a per-skill `used_names: set[str] = set()`. After the `if not filename: continue` guard, compute `unique_name = _dedup_flattened_name(filename, used_names)` and use `unique_name` for BOTH the `storage_path` (replace the `{filename}` segment) AND the dict's `filename` field, so `file_path` and `filename` stay self-consistent.

Wire the per-file errors returned by `_upload_skill_files`: in the synchronous branch (`file_count <= 20`), capture the returned list; if non-empty, append ONE `{"skill": fm["name"], "error": <summary naming the failed files and their reasons>}` dict to the existing `errors` list (the SkillImportError channel the endpoint already returns and SkillsPage.handleImport already surfaces as "X imported, Y failed"). In the background branch (`file_count > 20`), leave `background_tasks.add_task(_upload_skill_files, ...)` as-is — its return is discarded and per-file failures are captured by the Task 1 `logger.warning` (the HTTP response is already sent, so there is no response channel).

Do NOT add any new response field, endpoint, DB migration, or frontend change.
  </action>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -q</automated>
  </verify>
  <done>Colliding flattened names produce distinct `storage_path` values; the `os.path.basename` line is unchanged; sync-path per-file failures append a `{skill, error}` dict to the response `errors` list; background-path failures rely solely on the logger; all 15 existing tests stay green (single-file / no-collision imports are unaffected because first occurrences keep their plain name).</done>
</task>

<task type="auto">
  <name>Task 3: Behavioral regression tests (dedup survival + resilience)</name>
  <files>backend/tests/integration/test_skills_import_export.py</files>
  <action>
Append a new test class `TestImportCollisionResilience` to the file, reusing its module-local helpers (`_make_zip`, `_valid_skill_md`, `_skill_row`, `_make_result`), the `_supabase` import from tests.conftest, and the shared `client` / `auth_headers` / `mock_builder` fixtures.

Test A — colliding flattened names both survive under distinct paths (proves the Task 2 de-dup):
- Build a ZIP: `skill-x/SKILL.md` (valid) + two companion files in DIFFERENT folders that flatten to the SAME basename: `skill-x/pkg_a/__init__.py` and `skill-x/pkg_b/__init__.py`.
- Set `mock_builder.execute.return_value = _make_result([_skill_row(name="Collide Skill")])` (robust: the skills INSERT needs `.data[0]`; the two skill_files inserts ignore their return — `return_value` avoids brittle side_effect call-counting).
- POST /skills/import; assert 201.
- Collect `paths = [c.kwargs["path"] for c in _supabase.storage.from_.return_value.upload.call_args_list]`; assert `len(paths) == 2` and `len(set(paths)) == 2` (distinct).
- Docstring MUST state the pre-fix failure mode: both files flattened to `__init__.py` -> one identical storage_path -> `set(paths)` size 1 (test red against old code).

Test B — one file's failure does not kill the rest (proves the Task 1 try/except):
- Build a ZIP: `skill-x/SKILL.md` (valid) + three DISTINCT companion files `skill-x/a.py`, `skill-x/b.py`, `skill-x/c.py` (distinct so de-dup is a no-op and ONLY the try/except is under test).
- Set `mock_builder.execute.return_value = _make_result([_skill_row(name="Resilient Skill")])`.
- Simulate the documented real-world failure — the SECOND file's storage upload raising a duplicate-path error — inside a `try/finally`: set `_supabase.storage.from_.return_value.upload.side_effect = [None, RuntimeError("simulated duplicate storage path"), None]`, run the request + asserts, and in `finally` restore `_supabase.storage.from_.return_value.upload.side_effect = None` (the autouse reset does NOT clear storage-mock side_effects). Optionally wrap the POST in `caplog.at_level(logging.WARNING)`.
- Assert POST-FIX behavior: status == 201; `_supabase.storage.from_.return_value.upload.call_count == 3` AND a path ending in `c.py` (the file AFTER the failure) is present in the upload paths (pre-fix: loop aborts at b.py -> only 2 upload calls -> c.py never attempted); `data["errors"]` is non-empty and some entry's `error` text contains `b.py`; and, if using caplog, at least one WARNING record was emitted for the failed file.
- Docstring MUST state the REAL pre-fix failure mode: pre-fix, `_upload_skill_files` has no try/except, so b.py's unhandled exception BOTH aborts the loop (c.py and every later file silently dropped) AND — because the project's `TestClient(app)` (conftest.py) uses the default `raise_server_exceptions=True` — propagates straight out of the `client.post(...)` call, so the OLD code makes the test ERROR with a raised exception (no `response` object is ever assigned) rather than FAIL a status-code assertion. Do NOT frame this as returning a 500: an unhandled route exception under this TestClient config never becomes a 500 response — it escapes the request call itself.

Test C — the background path (file_count > 20) is equally resilient and logs failures server-side (proves Task 1's per-file loop also protects the backgrounded branch, which the sync-path Tests A/B never exercise):
- Build a ZIP: `skill-x/SKILL.md` (valid) + 21 DISTINCT tiny companion files `skill-x/f00.py` through `skill-x/f20.py` (each a few dummy bytes) so `file_count == 21 > 20` and `import_skill` takes the `background_tasks.add_task(_upload_skill_files, ...)` branch instead of the synchronous call.
- Set `mock_builder.execute.return_value = _make_result([_skill_row(name="Background Skill")])`.
- Force exactly ONE upload to fail, inside a `try/finally`, using a stateful callable side_effect (cleaner than a 21-element list): a closure over a `calls = {"n": 0}` dict assigned to `_supabase.storage.from_.return_value.upload.side_effect` that increments `calls["n"]` on each call and does `raise RuntimeError("simulated background upload failure")` when the counter hits 11 (the 11th upload, file `f10.py` — a middle file, so files exist both BEFORE and AFTER the failure), else `return None`. Wrap the POST in `caplog.at_level(logging.WARNING)`. In `finally`, restore `_supabase.storage.from_.return_value.upload.side_effect = None` (same discipline as Test B — the autouse reset does NOT clear storage-mock side_effects).
- Assign `response = client.post(...)`. Post-fix this returns normally; that `client.post(...)` does NOT raise is itself the proof that no exception escaped the resilient background task. Assert POST-FIX behavior: `response.status_code == 202` (the `has_background` JSONResponse branch); the JSON body's `message` contains the substring `background` (matches the existing `"Skill imported — files uploading in background"`); and — because Starlette's `TestClient` runs `BackgroundTasks` synchronously after the response is built, so the task has already executed by the time `client.post(...)` returns — `_supabase.storage.from_.return_value.upload.call_count == 21`, proving every file (including the ten AFTER the failing one) was still attempted despite the single failure; and at least one WARNING `caplog` record was emitted referencing the failed file `f10.py` (the background path's ONLY failure channel — no response `errors` surface remains once the 202 body is sent).
- Docstring MUST state what it proves AND the pre-fix contrast: the background path benefits from the same resilient per-file loop and never silently truncates; pre-fix, the un-guarded background task's exception aborts the loop (every file after the failure dropped) and — since that task runs inside `client.post(...)` under `raise_server_exceptions=True` — propagates out and ERRORs the request call (the same fail-vs-error distinction as Test B), so the assertions above are never reached against the old code.

All three tests must be genuinely behavioral (red — an assertion failure for Test A, a raised-exception ERROR for Tests B and C — against pre-fix code) — do not weaken assertions to vacuous truths.
  </action>
  <verify>
    <automated>cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -q</automated>
  </verify>
  <done>`TestImportCollisionResilience` adds three passing tests; the full file (15 existing + 3 new = 18) is green; each new test's docstring documents the specific pre-fix behavior — an assertion failure (Test A) or a raised-exception ERROR (Tests B and C) — that occurs against the pre-fix code; `upload.side_effect` is restored in a finally in every test that sets it, so no state leaks to other tests.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → POST /skills/import | Untrusted uploaded ZIP; entries are already path-sanitized by `_sanitize_zip_name` (OPEN-06) and size-capped at 10 MB BEFORE this code runs. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nfu-01 | Tampering | `_dedup_flattened_name` on crafted colliding names | mitigate | Operates only on already-sanitized basenames; the appended suffix is an integer counter (no user-controlled format), so no new traversal/injection surface is introduced. |
| T-nfu-02 | Denial of Service | many-collision ZIP forcing repeated suffix probing | accept | Bounded by the existing 10 MB ZIP cap; per-file `while candidate in used_names` probing is worst-case O(n) over an already size-limited file set. |
| T-nfu-03 | Repudiation / silent failure | per-file upload/insert exception swallowed by new try/except | mitigate | Every caught exception is `logger.warning`-logged AND (sync path) surfaced in the response `errors` list — the fix REPLACES a silent whole-loop abort with visible, per-file observability. No new packages, endpoints, or schema. |
</threat_model>

<verification>
- `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -q` → 18 passed (15 existing + 3 new), 0 failed.
- `git diff --stat` shows exactly two files touched: `backend/app/api/skills.py`, `backend/tests/integration/test_skills_import_export.py` (no frontend, no migration, no other endpoint).
- The `os.path.basename(relative)` line in `import_skill` is unchanged (grep confirms it still reads `filename = os.path.basename(relative)`).
</verification>

<success_criteria>
- Colliding flattened filenames within one skill import produce distinct storage paths; both files survive (Test A green, red pre-fix).
- A per-file upload/insert failure is caught, logged, and does not abort the loop — files after the failure still upload (Test B green, red pre-fix).
- Synchronous imports surface per-file failures in the response `errors` list via the unchanged SkillImportError channel; backgrounded imports log them server-side (Test C green, red pre-fix — the background branch runs the same resilient loop and never truncates).
- Flat-storage model, basename flattening, create/save/load_skill, frontend, and DB schema are all untouched.
</success_criteria>

<output>
Create `.planning/quick/260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip-/260705-nfu-SUMMARY.md` when done.
</output>
