# Phase 10: Agent Skills Core - Research

**Researched:** 2026-03-29
**Domain:** Supabase PostgreSQL schema, RLS policies, Supabase Storage, FastAPI CRUD router
**Confidence:** HIGH

---

## Summary

Phase 10 is a pure backend-infrastructure phase: no new UI surface ships here. The deliverables are (1) a SQL migration adding `skills` and `skill_files` tables with RLS, (2) a `skill-files` Supabase Storage bucket (created via SQL in the migration), (3) a FastAPI `/skills` router with full CRUD, enabled-toggle, global-share/unshare, and file-attachment endpoints, and (4) Pydantic models for all request/response shapes. Phase 12 will consume these endpoints from the frontend.

The schema and API pattern follows the existing `folders` feature almost exactly: the `folders` router in `backend/app/api/folders.py` and `supabase/migrations/014_folders.sql` are the canonical internal references. RLS for skill files mirrors the storage access control pattern described in official Supabase Storage docs.

The only genuinely new surface is Supabase Storage RLS — the `documents` bucket was provisioned manually without migration SQL, so Phase 10 must establish the correct SQL pattern for creating a private bucket and writing `storage.objects` policies. The verified pattern is: `INSERT INTO storage.buckets (id, name, public) VALUES ('skill-files', 'skill-files', false)` followed by RLS policies on `storage.objects`.

**Primary recommendation:** Model the `skills` router, migration, and Pydantic models directly after the `folders` feature. Introduce the `skill_files` table to track file metadata in Postgres, and enforce Supabase Storage access via `storage.objects` RLS policies keyed on `user_id` and `is_global`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIL-01 | User can create a skill with name, description, and instructions | POST /skills endpoint; `skills` table insert |
| SKIL-02 | User can edit an existing skill's name, description, or instructions | PATCH /skills/{id} endpoint |
| SKIL-03 | User can delete a skill they own | DELETE /skills/{id} — must cascade delete skill_files rows and remove Storage objects |
| SKIL-04 | User can toggle a skill enabled/disabled | PATCH /skills/{id}/toggle-enabled — mirrors toggle-global pattern in folders.py |
| SKIL-05 | User can share a skill globally so all authenticated users can see and load it | PATCH /skills/{id}/toggle-global |
| SKIL-06 | User can unshare a global skill (reverts to private) | Same toggle-global endpoint — toggles boolean |
| FILE-01 | User can upload files to a skill | POST /skills/{id}/files (multipart upload) |
| FILE-02 | User can delete a file from a skill | DELETE /skills/{id}/files/{file_id} |
| FILE-03 | Files stored in `skill-files` Supabase Storage bucket scoped by `user_id/skill_id/filename` | Storage path pattern; bucket provisioned in migration |
| FILE-06 | RLS ensures users can only access files belonging to their own skills or global skills | `storage.objects` RLS policies + `skill_files` table RLS |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | 2.10.0 | PostgreSQL + Storage client | Already in requirements.txt; used by all other routers |
| fastapi | 0.115.6 | HTTP router | Project stack |
| pydantic | (bundled with fastapi) | Request/response models | Project rule: Pydantic for structured outputs |
| python-multipart | 0.0.20 | Multipart file upload parsing | Already in requirements.txt; used by documents.py |

### No New Dependencies Required

All packages required for Phase 10 are already installed. File uploads use the same `UploadFile` + `python-multipart` pattern from `documents.py`.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended File Structure

```
backend/
├── app/
│   ├── api/
│   │   └── skills.py          # New FastAPI router
│   ├── models/
│   │   └── skill.py           # New Pydantic models
│   └── main.py                # Add include_router(skills.router)
├── tests/
│   └── integration/
│       └── test_skills.py     # Integration tests (mirrors test_folders.py)
supabase/
└── migrations/
    └── 017_skills.sql         # skills table, skill_files table, RLS, Storage bucket
```

### Pattern 1: Skills Table Schema

Mirror the `folders` table pattern from `014_folders.sql`. Key fields:

```sql
-- Source: mirrors 014_folders.sql + requirements SKIL-01 through SKIL-06
CREATE TABLE IF NOT EXISTS public.skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_enabled   boolean NOT NULL DEFAULT true,
  is_global    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skills_user_id_idx ON public.skills(user_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

-- SELECT: own skills + all global skills
CREATE POLICY "Users can view own and global skills"
  ON public.skills FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

-- INSERT: own only
CREATE POLICY "Users can insert own skills"
  ON public.skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: own only
CREATE POLICY "Users can update own skills"
  ON public.skills FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: own only
CREATE POLICY "Users can delete own skills"
  ON public.skills FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger (reuse existing set_updated_at() function from 014_folders.sql)
DROP TRIGGER IF EXISTS skills_set_updated_at ON public.skills;
CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Pattern 2: skill_files Table Schema

Track file metadata in Postgres. Storage objects are keyed by `user_id/skill_id/filename`.

```sql
-- Source: FILE-03 requirement + storage path convention from documents.py
CREATE TABLE IF NOT EXISTS public.skill_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename   text NOT NULL,
  file_path  text NOT NULL,   -- storage path: user_id/skill_id/filename
  file_size  bigint NOT NULL DEFAULT 0,
  mime_type  text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_files_skill_id_idx ON public.skill_files(skill_id);
CREATE INDEX IF NOT EXISTS skill_files_user_id_idx ON public.skill_files(user_id);

ALTER TABLE public.skill_files ENABLE ROW LEVEL SECURITY;

-- SELECT: files on own skills OR files on global skills
CREATE POLICY "Users can view files on own or global skills"
  ON public.skill_files FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.skills
      WHERE skills.id = skill_files.skill_id
        AND skills.is_global = true
    )
  );

-- INSERT/UPDATE/DELETE: own only
CREATE POLICY "Users can insert own skill files"
  ON public.skill_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own skill files"
  ON public.skill_files FOR DELETE
  USING (auth.uid() = user_id);
```

### Pattern 3: Supabase Storage Bucket + Storage RLS

The `documents` bucket was created manually in the Supabase dashboard — no migration SQL exists for it. For Phase 10, create the `skill-files` bucket via migration SQL so it is reproducible.

```sql
-- Source: Supabase docs + github.com/orgs/supabase/discussions/3528
-- Create private skill-files bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-files', 'skill-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can read files from their own skills
-- or from global skills (via skill_files join)
CREATE POLICY "Users can read own skill files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.skill_files sf
        JOIN public.skills s ON s.id = sf.skill_id
        WHERE sf.file_path = name
          AND s.is_global = true
      )
    )
  );

CREATE POLICY "Users can upload to own skill files folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'skill-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

CREATE POLICY "Users can delete own skill files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'skill-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );
```

**Important:** The backend uses the Supabase service role key (`supabase_service_role_key`), which bypasses RLS for storage operations. Storage RLS protects direct client-side access. The FastAPI layer enforces ownership checks in application logic before calling `supabase.storage.from_("skill-files")`.

### Pattern 4: FastAPI Router Structure

Follows `folders.py` exactly. Key endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | /skills | List all skills visible to user (own + global) |
| POST | /skills | Create skill (SKIL-01) |
| PATCH | /skills/{id} | Update name/description/instructions (SKIL-02) |
| DELETE | /skills/{id} | Delete skill + cascade files from storage (SKIL-03) |
| PATCH | /skills/{id}/toggle-enabled | Toggle is_enabled (SKIL-04) |
| PATCH | /skills/{id}/toggle-global | Toggle is_global (SKIL-05, SKIL-06) |
| GET | /skills/{id}/files | List files attached to a skill |
| POST | /skills/{id}/files | Upload file (FILE-01) |
| DELETE | /skills/{id}/files/{file_id} | Delete file from skill + storage (FILE-02) |

### Pattern 5: Delete Cascade for Skills

When deleting a skill, must clean up storage objects before deleting the DB row (since `skill_files` ON DELETE CASCADE handles the DB side, but not the Storage side):

```python
# Source: mirrors delete_folder() pattern in folders.py
# 1. Fetch all file_paths for the skill
files = supabase.table("skill_files").select("id, file_path") \
    .eq("skill_id", skill_id).eq("user_id", current_user["id"]).execute()

# 2. Remove from Storage
for f in files.data:
    try:
        supabase.storage.from_("skill-files").remove([f["file_path"]])
    except Exception:
        pass  # Storage failure doesn't block DB delete

# 3. Delete skill row — skill_files cascade via FK
supabase.table("skills").delete() \
    .eq("id", skill_id).eq("user_id", current_user["id"]).execute()
```

### Pattern 6: Pydantic Models

```python
# Source: mirrors models/folder.py structure
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class SkillCreate(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""
    is_global: bool = False

class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None

class SkillResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str
    instructions: str
    is_enabled: bool
    is_global: bool
    created_at: datetime
    updated_at: datetime

class SkillFileResponse(BaseModel):
    id: UUID
    skill_id: UUID
    user_id: UUID
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    created_at: datetime
```

### Pattern 7: File Upload Endpoint

```python
# Source: mirrors documents.py upload pattern
@router.post("/{skill_id}/files", response_model=SkillFileResponse,
             status_code=status.HTTP_201_CREATED)
async def upload_skill_file(
    skill_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. Verify user owns the skill
    skill = supabase.table("skills").select("id") \
        .eq("id", skill_id).eq("user_id", current_user["id"]) \
        .maybe_single().execute()
    if not skill.data:
        raise HTTPException(status_code=403, detail="Skill not found or not owned by you")

    # 2. Enforce 10 MB limit (per UI-SPEC copywriting: "Files must be under 10 MB")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit")

    # 3. Storage path: user_id/skill_id/filename (FILE-03)
    storage_path = f"{current_user['id']}/{skill_id}/{file.filename}"

    # 4. Upload to storage
    supabase.storage.from_("skill-files").upload(
        path=storage_path,
        file=raw,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )

    # 5. Insert metadata row
    result = supabase.table("skill_files").insert({
        "skill_id": skill_id,
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_path": storage_path,
        "file_size": len(raw),
        "mime_type": file.content_type or "application/octet-stream",
    }).execute()
    return result.data[0]
```

### Anti-Patterns to Avoid

- **Do not skip the skill ownership check before file operations**: Always verify `user_id = current_user["id"]` before uploading or deleting files. The service role key bypasses Storage RLS — application-layer checks are the only guard.
- **Do not use ON DELETE CASCADE to clean Storage objects**: The DB cascade only removes `skill_files` rows. Storage objects must be explicitly removed via `supabase.storage.from_("skill-files").remove(...)` before or after the DB delete.
- **Do not return `instructions` in the list endpoint**: Instructions can be large. The list endpoint should return `SkillResponse` without instructions for catalog queries, or include them. Given Phase 11 will need instructions in `load_skill`, it is fine to include in individual GET. For the list, include all fields — skills are user-scoped and not expected to be extremely numerous.
- **Do not add skills to Realtime**: Unlike folders, skills do not need live sync via Supabase Realtime in Phase 10. The Skills UI (Phase 12) uses standard REST polling. Only add to `supabase_realtime` publication if a future phase requires it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth token validation | Custom JWT decode | `get_current_user` dependency (already in `dependencies.py`) | Already implemented; reuse exactly |
| Supabase query builder | Custom HTTP client | `supabase-py` client from `get_supabase` dependency | Consistent with all other routers |
| File size enforcement | Manual byte counting | Read bytes then `len(raw) > limit` check | Simple, same as documents.py |
| Storage path conflicts | UUID-based dedup | Overwrite by path — same `user_id/skill_id/filename` path silently overwrites | Acceptable for skill files; no dedup needed |
| Updated_at trigger | Python-side timestamp | Reuse `set_updated_at()` Postgres trigger from `014_folders.sql` | Already defined; just create trigger |

---

## Common Pitfalls

### Pitfall 1: Storage Bucket Not Idempotent in Migration

**What goes wrong:** Running migration twice fails with unique constraint violation on `storage.buckets.id`.
**Why it happens:** `INSERT INTO storage.buckets` without a conflict clause errors on re-run.
**How to avoid:** Use `ON CONFLICT (id) DO NOTHING` in the bucket insert.
**Warning signs:** Migration fails with "duplicate key value violates unique constraint".

### Pitfall 2: Storage Objects Not Deleted on Skill Delete

**What goes wrong:** Skill rows and `skill_files` rows are deleted, but Storage objects remain orphaned.
**Why it happens:** PostgreSQL `ON DELETE CASCADE` only cascades within the database. Storage objects live outside Postgres.
**How to avoid:** Explicitly call `supabase.storage.from_("skill-files").remove([file_path])` for each file before or after deleting the skill row. Wrap in try/except to prevent storage failures from blocking DB cleanup (same pattern as `delete_folder`).
**Warning signs:** `skill-files` bucket accumulates orphaned objects over time.

### Pitfall 3: or_() Chain Breaking in Tests

**What goes wrong:** `.or_(...)` call returns a new MagicMock instead of the builder, causing `execute()` to return an untrusted default instead of test-controlled data.
**Why it happens:** Known conftest issue documented in STATE.md: "or_() breaks MagicMock chain by default".
**How to avoid:** The conftest `_make_builder` already wires `b.or_.return_value = b`. Tests that use `or_()` chains work correctly with the shared `_builder`. Tests needing separate `or_` results should use `mock_builder.or_.return_value = mock_builder`.
**Warning signs:** Test passes when skill does not exist but should fail, or vice versa.

### Pitfall 4: Global Skill File Access via RLS Join Performance

**What goes wrong:** The `storage.objects` SELECT policy with a JOIN to `skill_files` and `skills` may be slow for large datasets.
**Why it happens:** JOINs in RLS policies can cause full table scans.
**How to avoid:** Add the indexes on `skill_files(skill_id)` and `skill_files(file_path)` as specified in the schema. For Phase 10 scale this is not a blocking concern, but indexes must be present.
**Warning signs:** Slow storage reads when global skills have many files.

### Pitfall 5: Multipart Form vs JSON Body for File + Metadata

**What goes wrong:** Trying to send JSON body alongside `UploadFile` in the same request.
**Why it happens:** `multipart/form-data` cannot mix with a JSON body — this is a known FastAPI/HTTP limitation documented in STATE.md for Phase 3.
**How to avoid:** For file upload, accept all metadata as `Form(...)` fields (not a Pydantic body). The skill_id comes from the URL path parameter, so no extra Form fields are needed for the upload endpoint.
**Warning signs:** FastAPI raises 422 when attempting to use `Body(...)` alongside `File(...)`.

### Pitfall 6: Forgetting to Register Router in main.py

**What goes wrong:** Skills endpoints return 404 even after router is created.
**Why it happens:** `app.include_router(skills.router)` must be added to `main.py`.
**How to avoid:** Include the router in the same location as the other routers (bottom of `main.py`).

---

## Code Examples

### List Skills with Deduplication

```python
# Source: mirrors list_folders() in folders.py
result = (
    supabase.table("skills")
    .select("*")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .order("name")
    .execute()
)
# Deduplicate in case user owns a global skill (same pattern as folders)
seen = set()
skills = []
for row in result.data:
    if row["id"] not in seen:
        seen.add(row["id"])
        skills.append(row)
return skills
```

### Toggle is_enabled

```python
# Source: mirrors toggle_global() in folders.py
current = (
    supabase.table("skills")
    .select("*")
    .eq("id", skill_id)
    .eq("user_id", current_user["id"])
    .maybe_single()
    .execute()
)
if not current.data:
    raise HTTPException(status_code=403, detail="Skill not found or you are not the owner")

new_value = not current.data["is_enabled"]
result = (
    supabase.table("skills")
    .update({"is_enabled": new_value})
    .eq("id", skill_id)
    .eq("user_id", current_user["id"])
    .execute()
)
return result.data[0]
```

### Delete File

```python
# Source: mirrors document delete pattern in documents.py
file_row = (
    supabase.table("skill_files")
    .select("*")
    .eq("id", file_id)
    .eq("user_id", current_user["id"])
    .maybe_single()
    .execute()
)
if not file_row.data:
    raise HTTPException(status_code=404, detail="File not found")

try:
    supabase.storage.from_("skill-files").remove([file_row.data["file_path"]])
except Exception:
    pass

supabase.table("skill_files").delete().eq("id", file_id).execute()
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + httpx |
| Config file | `backend/pytest.ini` or `setup.cfg` (inferred from existing test runs) |
| Quick run command | `cd backend && python -m pytest tests/integration/test_skills.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-01 | POST /skills creates skill with correct fields | integration | `pytest tests/integration/test_skills.py::TestCreateSkill -x` | ❌ Wave 0 |
| SKIL-02 | PATCH /skills/{id} updates name/description/instructions | integration | `pytest tests/integration/test_skills.py::TestUpdateSkill -x` | ❌ Wave 0 |
| SKIL-03 | DELETE /skills/{id} removes skill + files from storage | integration | `pytest tests/integration/test_skills.py::TestDeleteSkill -x` | ❌ Wave 0 |
| SKIL-04 | PATCH /skills/{id}/toggle-enabled toggles boolean | integration | `pytest tests/integration/test_skills.py::TestToggleEnabled -x` | ❌ Wave 0 |
| SKIL-05 | PATCH /skills/{id}/toggle-global sets is_global=true | integration | `pytest tests/integration/test_skills.py::TestToggleGlobal -x` | ❌ Wave 0 |
| SKIL-06 | toggle-global sets is_global=false when already true | integration | `pytest tests/integration/test_skills.py::TestToggleGlobal -x` | ❌ Wave 0 |
| FILE-01 | POST /skills/{id}/files uploads file, returns metadata row | integration | `pytest tests/integration/test_skills.py::TestUploadFile -x` | ❌ Wave 0 |
| FILE-02 | DELETE /skills/{id}/files/{file_id} removes from storage | integration | `pytest tests/integration/test_skills.py::TestDeleteFile -x` | ❌ Wave 0 |
| FILE-03 | Storage path is user_id/skill_id/filename | integration | `pytest tests/integration/test_skills.py::TestUploadFile -x` | ❌ Wave 0 |
| FILE-06 | Non-owner cannot delete another user's skill file | integration | `pytest tests/integration/test_skills.py::TestDeleteFile -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/integration/test_skills.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before marking phase complete

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_skills.py` — covers all 10 requirements above
- [ ] No framework install needed — pytest + httpx already in requirements.txt
- [ ] `conftest.py` already provides `client`, `auth_headers`, `mock_execute_result`, `mock_builder` fixtures — no new fixtures needed for basic CRUD tests; file upload tests need `storage_bucket` mock wired via `_supabase.storage.from_.return_value`

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual bucket creation in Supabase dashboard | SQL `INSERT INTO storage.buckets` in migration | Phase 10 (new) | Reproducible local dev + CI |
| Storage RLS via dashboard policies | SQL `CREATE POLICY ON storage.objects` in migration | Phase 10 (new) | Migration-tracked, version-controlled |

**Note on existing `documents` bucket:** It was created manually (no migration SQL exists for it). Phase 10 establishes the SQL pattern that should be backfilled eventually but is not a blocker.

---

## Open Questions

1. **File type restrictions for skill files**
   - What we know: Documents.py restricts MIME types (PDF, DOCX, TXT, MD). UI-SPEC error message says "Files must be under 10 MB" with no mention of type restriction.
   - What's unclear: Should skill files be restricted to certain types (e.g., `.py`, `.md`, `.txt`, `.json`)? REQUIREMENTS.md says "Python scripts, templates, reference data."
   - Recommendation: Accept any MIME type in Phase 10 (skill files are diverse by design). Enforce only the 10 MB size limit from the UI-SPEC. Phase 13 (Open Standard) can add type validation if needed.

2. **Filename collision handling for skill file uploads**
   - What we know: Documents.py deduplicates by content hash. Skill files don't have a dedup requirement.
   - What's unclear: If the user uploads `data.csv` twice, should the second overwrite the first, or create a second entry?
   - Recommendation: Overwrite by storage path (same path = same file silently replaced in Storage) but insert a new `skill_files` row and delete the old one with the same filename+skill_id. This keeps the DB and Storage in sync.

3. **Max file count per skill**
   - What we know: No requirement specifies a limit.
   - What's unclear: Should Phase 10 enforce a maximum?
   - Recommendation: No limit in Phase 10. Add if needed in a future quick-task if performance issues arise.

---

## Sources

### Primary (HIGH confidence)

- Existing codebase: `backend/app/api/folders.py` — canonical CRUD + toggle-global + delete-cascade pattern
- Existing codebase: `supabase/migrations/014_folders.sql` — canonical RLS + trigger pattern
- Existing codebase: `backend/app/api/documents.py` — canonical Storage upload + delete pattern
- Existing codebase: `backend/tests/conftest.py` + `tests/integration/test_folders.py` — canonical test pattern with mock builder
- [Supabase Storage Access Control docs](https://supabase.com/docs/guides/storage/security/access-control) — `storage.foldername()` helper and `storage.objects` RLS syntax
- [Supabase Storage bucket creation docs](https://supabase.com/docs/guides/storage/buckets/creating-buckets) — `INSERT INTO storage.buckets` pattern
- [GitHub discussion #3528](https://github.com/orgs/supabase/discussions/3528) — SQL bucket creation confirmed as supported approach

### Secondary (MEDIUM confidence)

- `.planning/phases/10-agent-skills-core/10-UI-SPEC.md` — file size limit (10 MB), interaction contracts for Phase 12
- `.planning/STATE.md` — or_() pitfall, multipart form pitfall, storage pattern from Phase 3

### Tertiary (LOW confidence)

- None — all claims verified via codebase or official docs.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in project; verified against requirements.txt
- Architecture: HIGH — patterns directly derived from existing `folders.py` and `documents.py` in the same codebase
- Storage RLS: HIGH — verified against official Supabase docs with `storage.foldername()` and `storage.objects` policies
- Test patterns: HIGH — directly mirrors `test_folders.py` structure already in project
- Pitfalls: HIGH — all derived from STATE.md decisions log + official docs

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable tech stack; 30 days)
