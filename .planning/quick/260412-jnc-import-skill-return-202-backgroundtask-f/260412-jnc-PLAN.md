---
phase: quick-260412-jnc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/skills.py
  - frontend/src/components/skills/SkillFormDialog.tsx
autonomous: true
requirements: [IMPORT-202, MODAL-SCROLL]
must_haves:
  truths:
    - "ZIP imports with >20 files return 202 immediately and upload files in background"
    - "ZIP imports with <=20 files behave exactly as before (synchronous, 201)"
    - "Edit skill modal file list scrolls when many files are present instead of stretching the modal"
  artifacts:
    - path: "backend/app/api/skills.py"
      provides: "_upload_skill_files helper, BackgroundTasks param, 202 branch"
      contains: "_upload_skill_files"
    - path: "frontend/src/components/skills/SkillFormDialog.tsx"
      provides: "Scrollable file list"
      contains: "overflow-y-auto"
  key_links:
    - from: "import_skill"
      to: "_upload_skill_files"
      via: "direct call (sync) or background_tasks.add_task (async)"
      pattern: "_upload_skill_files"
---

<objective>
Two small improvements: (1) make large ZIP skill imports non-blocking by returning 202 and uploading files in a BackgroundTask, and (2) add scroll overflow to the edit skill modal file list.

Purpose: Large skill ZIPs (>20 files) currently block the HTTP response while uploading every file to storage. Returning 202 immediately lets the frontend continue without waiting. The file list scroll prevents the modal from growing unbounded.
Output: Modified backend/app/api/skills.py and frontend/src/components/skills/SkillFormDialog.tsx
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/api/skills.py
@frontend/src/components/skills/SkillFormDialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add background file upload for large ZIP imports</name>
  <files>backend/app/api/skills.py</files>
  <action>
1. Add `BackgroundTasks` to the import at line 7: `from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status`
2. Add `JSONResponse` import: `from fastapi.responses import JSONResponse, StreamingResponse`
3. Create a new helper function `_upload_skill_files(files_to_upload: list[dict], skill_id: str, user_id: str, supabase: Client)` placed after `_find_skill_entries`. Each dict in `files_to_upload` has keys: `file_bytes`, `filename`, `storage_path`, `mime_type`. The function iterates over the list and for each entry:
   - Calls `supabase.storage.from_("skill-files").upload(path=entry["storage_path"], file=entry["file_bytes"], file_options={"content-type": entry["mime_type"]})`
   - Calls `supabase.table("skill_files").insert({...}).execute()` with skill_id, user_id, filename, file_path=storage_path, file_size=len(file_bytes), mime_type
4. Add `background_tasks: BackgroundTasks` parameter to `import_skill` endpoint signature (after `file` param)
5. In `import_skill`, after step 5 parsing (line 170) and before step 6, restructure the file upload logic:
   - For each `(prefix, fm, instructions)` in `parsed`:
     - Insert the skill DB row (existing code, unchanged)
     - Build a `files_to_upload` list by iterating ZIP entries matching the prefix (same filtering logic as current lines 187-210), collecting dicts with `file_bytes`, `filename`, `storage_path`, `mime_type` (always "application/octet-stream")
     - Count file entries: `file_count = len(files_to_upload)`
     - If `file_count > 20`: call `background_tasks.add_task(_upload_skill_files, files_to_upload, skill_row["id"], current_user["id"], supabase)`
     - If `file_count <= 20`: call `_upload_skill_files(files_to_upload, skill_row["id"], current_user["id"], supabase)` directly (synchronous)
     - Append skill_row to results as before
6. After the with-block (after all skills processed), check if ANY skill had background uploads scheduled. Track this with a boolean `has_background = False` set before the loop, flipped to True when the >20 branch is taken.
7. If `has_background`: return `JSONResponse(status_code=202, content={"created": results, "errors": errors, "message": "Skill imported — files uploading in background"})`
8. If not `has_background`: return `{"created": results, "errors": errors}` (existing behavior, 201 status from decorator)
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" && python -c "from backend.app.api.skills import _upload_skill_files, import_skill; print('imports OK')" 2>/dev/null || cd "C:/Vibe Apps/Agentic RAG/backend" && python -c "from app.api.skills import _upload_skill_files, import_skill; print('imports OK')"</automated>
  </verify>
  <done>import_skill returns 202 with background task when ZIP has >20 files; returns 201 synchronously for <=20 files; _upload_skill_files helper exists and is reusable</done>
</task>

<task type="auto">
  <name>Task 2: Add scroll overflow to edit skill modal file list</name>
  <files>frontend/src/components/skills/SkillFormDialog.tsx</files>
  <action>
In SkillFormDialog.tsx, find the `<ul>` element at line 162 that renders the file list. Add `overflow-y-auto max-h-48` classes to it so it scrolls when there are many files:

Change line 162 from:
```
<ul className="flex flex-col gap-1">
```
to:
```
<ul className="flex flex-col gap-1 overflow-y-auto max-h-48">
```

max-h-48 (12rem / 192px) fits roughly 8-10 file rows before scrolling, which is reasonable for a modal.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" && grep -n "overflow-y-auto max-h-48" frontend/src/components/skills/SkillFormDialog.tsx</automated>
  </verify>
  <done>File list in edit skill modal scrolls vertically when more than ~8-10 files are present; modal height stays bounded</done>
</task>

</tasks>

<verification>
- `grep "_upload_skill_files" backend/app/api/skills.py` shows the helper function defined and called in both sync/async paths
- `grep "BackgroundTasks" backend/app/api/skills.py` shows import and parameter usage
- `grep "202" backend/app/api/skills.py` shows the JSONResponse for large imports
- `grep "overflow-y-auto" frontend/src/components/skills/SkillFormDialog.tsx` shows scroll class on file list
</verification>

<success_criteria>
- Large ZIP imports (>20 companion files) return HTTP 202 with a message indicating background upload
- Small ZIP imports (<=20 companion files) return HTTP 201 with synchronous upload (no behavior change)
- Edit skill modal file list scrolls when file count exceeds visible area
</success_criteria>

<output>
After completion, create `.planning/quick/260412-jnc-import-skill-return-202-backgroundtask-f/260412-jnc-SUMMARY.md`
</output>
