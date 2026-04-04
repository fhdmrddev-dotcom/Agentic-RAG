# Phase 13: Skills Open Standard - Research

**Researched:** 2026-04-02
**Domain:** ZIP-based skill import/export, YAML frontmatter parsing, path traversal security
**Confidence:** HIGH

## Summary

Phase 13 adds import/export of skills as ZIP files in an "agentskills.io" open format. The feature is
purely a new pair of backend endpoints (`GET /skills/{id}/export` and `POST /skills/import`) plus
corresponding frontend buttons on the SkillCard and a file-picker on SkillsPage.

All required tools are already present in the Python stdlib (`zipfile`, `io`) and in the already-installed
`PyYAML 6.0.3` package. No new dependencies are needed for the backend. The frontend uses the browser
`File` API and a standard `<input type="file" accept=".zip">` — no new npm packages required.

The only non-trivial concern is path traversal safety during ZIP extraction (OPEN-06). Python's
`zipfile` module does not sanitize filenames; filenames like `../../etc/passwd` are accepted silently.
The fix is a single `os.path.normpath` check per entry before any write or storage upload.

**Primary recommendation:** Implement two backend endpoints (export + import), add export/import buttons
to the existing SkillCard and SkillsPage, and gate all import filename handling behind a path-traversal
sanitizer. No new libraries needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPEN-01 | User can export any skill they own as a ZIP file (agentskills.io format) | `GET /skills/{id}/export` returns `StreamingResponse` with `application/zip` content-type; frontend `<a download>` triggers browser save |
| OPEN-02 | Exported ZIP contains `SKILL.md` with YAML frontmatter (name, description, license, compatibility) and skill instructions body | PyYAML available in venv; write YAML block manually with `yaml.dump()` or string template; body is `skill.instructions` |
| OPEN-03 | Exported ZIP includes building-block files in categorized subdirectories (`scripts/`, `references/`, `assets/`) | Files are in Supabase Storage at `user_id/skill_id/filename`; MIME-type mapping determines subdirectory |
| OPEN-04 | User can import a skill from a ZIP file; a new skill is created from the ZIP contents | `POST /skills/import` accepts `UploadFile`; parses SKILL.md, creates skill row, uploads files to storage |
| OPEN-05 | Bulk import from ZIP is atomic — if SKILL.md parsing fails, no partial skill is created; single-skill import is also atomic | Parse and validate ALL SKILL.md entries before creating any DB rows; errors collected and reported per skill |
| OPEN-06 | ZIP import is safe against path traversal attacks (filenames sanitized before extraction) | `os.path.normpath(name).startswith('..')` check verified working in venv; reject any entry that resolves outside expected prefix |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Python backend must use a `venv` virtual environment — all backend code runs inside `backend/venv`
- No LangChain, no LangGraph — raw SDK calls only (not applicable here, but noted)
- Use Pydantic for structured LLM outputs — use Pydantic for request/response models in new endpoints
- All tables need Row-Level Security — no new tables needed for this phase; RLS already covers skills/skill_files
- Stream chat responses via SSE — not applicable for ZIP download; use `StreamingResponse` with `application/zip`
- Ingestion is manual file upload only — import is via explicit ZIP upload; this is consistent with the rule

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zipfile` | stdlib | Create/read ZIP archives | Python stdlib; no install needed |
| `io.BytesIO` | stdlib | In-memory byte buffer for ZIP assembly | No disk writes needed; stdlib |
| `PyYAML` | 6.0.3 (installed) | Parse YAML frontmatter in SKILL.md | Already in venv via transitive dep; verified present |
| `os.path` | stdlib | Path normalization for traversal checks | Verified: `normpath('../../x').startswith('..')` is `True` on Windows |
| FastAPI `StreamingResponse` | (installed) | Stream ZIP bytes as download response | Already used in `threads.py`; consistent pattern |
| FastAPI `UploadFile` | (installed) | Receive ZIP upload for import | Already used in skills file upload endpoints |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-frontmatter` | NOT installed | Parse YAML frontmatter with dedicated library | Not needed — manual split on `---` with `yaml.safe_load` is sufficient and avoids a new dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `---` split + `yaml.safe_load` | `python-frontmatter` package | `python-frontmatter` is cleaner API but requires `pip install`; manual parsing is 4 lines and already verified |
| In-memory ZIP assembly | Temp file on disk | In-memory is cleaner for a serverless-style FastAPI; avoids temp file cleanup |
| MIME-type subdirectory mapping | Filename extension mapping | MIME type is already stored in `skill_files.mime_type`; use it directly |

**Installation:** No new packages required. All tools are stdlib or already installed.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. All new code goes into existing files:

```
backend/app/api/skills.py          # Two new endpoints added here
backend/app/models/skill.py        # Two new Pydantic models added (SkillImportResult)
backend/tests/integration/
  test_skills_import_export.py     # New test file for OPEN-01..OPEN-06
frontend/src/lib/api.ts            # exportSkill(), importSkill() functions added
frontend/src/components/skills/
  SkillCard.tsx                    # Export button added (owner-only)
  SkillsPage.tsx                   # Import button + hidden file input added
```

### Pattern 1: Export Endpoint (StreamingResponse)

**What:** `GET /skills/{skill_id}/export` — assembles a ZIP in memory and returns it as a streaming download.
**When to use:** Any time a binary file needs to be returned from FastAPI without writing to disk.

```python
# Source: FastAPI docs / threads.py existing pattern
from fastapi.responses import StreamingResponse
import zipfile, io, yaml

@router.get("/{skill_id}/export")
async def export_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # 1. Fetch skill (owner check)
    skill = ...  # .eq("user_id", current_user["id"])
    if not skill.data:
        raise HTTPException(404, "Skill not found")

    # 2. Assemble SKILL.md content
    frontmatter = yaml.dump({
        "name": skill_row["name"],
        "description": skill_row["description"],
        "license": "MIT",
        "compatibility": "1.0",
    }, default_flow_style=False)
    skill_md = f"---\n{frontmatter}---\n\n{skill_row['instructions']}"

    # 3. Build ZIP in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", skill_md)
        # Fetch and add each skill file
        for f in files.data:
            raw = supabase.storage.from_("skill-files").download(f["file_path"])
            subdir = _mime_to_subdir(f["mime_type"])
            zf.writestr(f"{subdir}/{f['filename']}", raw)
    buf.seek(0)

    filename = skill_row["name"].replace(" ", "-").lower()
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'},
    )
```

### Pattern 2: Import Endpoint (UploadFile + ZIP parsing)

**What:** `POST /skills/import` — accepts a ZIP upload, parses SKILL.md(s), creates skills.
**When to use:** Bulk or single skill import.

```python
@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_skill(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    raw = await file.read()
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise HTTPException(400, "Uploaded file is not a valid ZIP")

    results = []
    errors = []
    with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
        skill_entries = _find_skill_entries(zf)  # returns list of (prefix, skill_md_bytes)
        # Parse all first — no DB writes yet (OPEN-05 atomicity)
        parsed = []
        for prefix, skill_bytes in skill_entries:
            try:
                fm, instructions = _parse_skill_md(skill_bytes.decode("utf-8"))
                parsed.append((prefix, fm, instructions))
            except ValueError as e:
                errors.append({"skill": prefix or "root", "error": str(e)})

        # Now create DB rows for successfully parsed skills
        for prefix, fm, instructions in parsed:
            skill_row = supabase.table("skills").insert({...}).execute().data[0]
            # Upload companion files
            for name in zf.namelist():
                if not _is_under_prefix(name, prefix) or name.endswith("SKILL.md"):
                    continue
                _safe_extract_to_storage(zf, name, skill_row["id"], current_user, supabase)
            results.append(skill_row)

    return {"created": results, "errors": errors}
```

### Pattern 3: Path Traversal Sanitization

**What:** Reject any ZIP entry whose normalized path resolves outside the intended prefix.
**Verified on Windows:** `os.path.normpath("../../etc/passwd")` returns `"..\\..\\etc\\passwd"` which starts with `..`.

```python
import os

def _sanitize_zip_name(name: str) -> str:
    """Raises ValueError if path traversal detected; returns safe basename otherwise."""
    # Normalize using POSIX separators to handle both / and \\ entries
    normalized = os.path.normpath(name.replace("\\", "/"))
    if normalized.startswith("..") or os.path.isabs(normalized):
        raise ValueError(f"Unsafe path in ZIP: {name!r}")
    return normalized
```

### Pattern 4: SKILL.md Frontmatter Parsing

**What:** Split on `---` delimiter, parse YAML block, extract body. Verified working with PyYAML 6.0.3.

```python
import yaml

def _parse_skill_md(content: str) -> tuple[dict, str]:
    """Parse YAML frontmatter + body from SKILL.md content."""
    parts = content.split("---", 2)
    if len(parts) < 3:
        raise ValueError("SKILL.md missing YAML frontmatter delimiters")
    try:
        frontmatter = yaml.safe_load(parts[1])
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML frontmatter: {e}")
    if not isinstance(frontmatter, dict) or "name" not in frontmatter:
        raise ValueError("SKILL.md frontmatter must contain 'name'")
    return frontmatter, parts[2].strip()
```

### Pattern 5: MIME-type to Subdirectory Mapping

**What:** Determines which subdirectory to place a skill file in during export.

```python
def _mime_to_subdir(mime_type: str) -> str:
    if mime_type.startswith("text/x-python") or mime_type.endswith("+python"):
        return "scripts"
    if mime_type.startswith("image/") or mime_type.startswith("audio/") or mime_type.startswith("video/"):
        return "assets"
    return "references"  # default: CSV, JSON, TXT, PDF, etc.
```

### Pattern 6: Multi-skill ZIP Detection

**What:** Determine if a ZIP contains one skill (root `SKILL.md`) or multiple (subdirectory `*/SKILL.md`).

```python
def _find_skill_entries(zf: zipfile.ZipFile) -> list[tuple[str, bytes]]:
    """Returns list of (prefix, skill_md_bytes). prefix='' for root skills."""
    names = set(zf.namelist())
    entries = []
    if "SKILL.md" in names:
        entries.append(("", zf.read("SKILL.md")))
    else:
        for n in names:
            parts = n.split("/")
            if len(parts) == 2 and parts[1] == "SKILL.md":
                entries.append((parts[0] + "/", zf.read(n)))
    return entries
```

### Frontend Pattern: Export Button

Export is triggered by clicking a button that hits the API and uses a browser anchor to download:

```typescript
// In api.ts
export async function exportSkill(id: string, name: string): Promise<void> {
  const headers = getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/export`, { headers })
  if (!res.ok) throw new Error("Export failed")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
```

### Frontend Pattern: Import File Input

Import uses a hidden `<input type="file">` triggered by a button click:

```typescript
// In SkillsPage.tsx
const fileInputRef = useRef<HTMLInputElement>(null)

const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  await importSkillZip(file)
  // reload skills list
}

// In JSX
<input ref={fileInputRef} type="file" accept=".zip" className="hidden"
  onChange={handleImport} />
<Button onClick={() => fileInputRef.current?.click()}>Import</Button>
```

### Anti-Patterns to Avoid

- **Writing ZIP entries to disk before scanning:** Never extract to the filesystem before sanitizing paths. Keep everything in-memory (`io.BytesIO`) or stream directly to Supabase Storage.
- **Blocking on OPEN-05 partially:** Do not insert the skill row and then fail partway through uploading files — only insert after all files have been validated and are ready to upload.
- **`yaml.load()` without `Loader=yaml.SafeLoader`:** Always use `yaml.safe_load()`. Unsafe loader allows arbitrary Python object instantiation.
- **Trusting the `Content-Type` of the uploaded ZIP:** Validate with `zipfile.is_zipfile()` on the actual bytes, not the declared MIME type.
- **Absolute path entries in ZIP:** `os.path.isabs(normalized)` check needed alongside `startswith("..")` — entries like `/etc/passwd` also traverse.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP creation | Custom archive format | `zipfile.ZipFile` (stdlib) | Compression, cross-platform, well-tested |
| YAML parsing | Custom key-value parser | `yaml.safe_load` (PyYAML 6.0.3, installed) | Handles all YAML edge cases |
| Path traversal detection | Regex on filenames | `os.path.normpath` + `startswith("..")` check | Handles `..`, `./..`, encoded slashes correctly |
| In-memory binary buffer | Temp files | `io.BytesIO` | No disk I/O, no cleanup needed |

**Key insight:** The entire feature is assembling and disassembling ZIPs around an already-working skill CRUD system. The hard parts (DB, auth, storage) are already solved; this phase is mostly glue code.

---

## Common Pitfalls

### Pitfall 1: Path Traversal Not Caught on Windows
**What goes wrong:** `os.path.normpath` on Windows uses `\\` as separator. The check `startswith("..")` fails if the input uses Windows path separators that normpath converts to `..\\..\\`.
**Why it happens:** Windows `normpath("../../x")` returns `"..\\..\\x"`, which starts with `..` — so the check `normalized.startswith("..")` IS caught correctly. Verified in venv.
**How to avoid:** Always normalize with `name.replace("\\", "/")` before calling `normpath`, then check `startswith("..")` or `os.path.isabs`.
**Warning signs:** Test with `../../etc/passwd` and `..\\..\\etc\\passwd` entries.

### Pitfall 2: SKILL.md With No Trailing Newline After First `---`
**What goes wrong:** `content.split("---", 2)` with a SKILL.md like `---\nname: x\n---\nBody` gives `['', '\nname: x\n', '\nBody']` (3 parts). But if the file starts with content before `---`, parts[0] is non-empty and the parse produces wrong sections.
**Why it happens:** SKILL.md is user-supplied; malformed documents are possible.
**How to avoid:** Require the file to start with `---`. Check `content.lstrip().startswith("---")` before splitting.
**Warning signs:** `frontmatter` key being `None` or `parts[0]` being non-empty.

### Pitfall 3: Supabase Storage Download Returns Bytes vs. String
**What goes wrong:** `supabase.storage.from_("skill-files").download(path)` returns `bytes`. If code tries to decode it as UTF-8 unconditionally, binary files (images, compiled scripts) will raise `UnicodeDecodeError`.
**Why it happens:** Export writes raw bytes into the ZIP; text decoding must only happen for SKILL.md parsing on import.
**How to avoid:** On export, write raw bytes directly to ZIP (`zf.writestr(name, raw_bytes)`). On import, only call `.decode("utf-8")` on `SKILL.md`.

### Pitfall 4: Bulk Import Error Swallowing
**What goes wrong:** If one skill fails, the handler silently skips it and still returns 201. The user doesn't know a skill was dropped.
**Why it happens:** Exception swallowing in a loop.
**How to avoid:** Collect all errors into a `errors` list and include them in the response JSON. Return 207 Multi-Status if any errors occurred alongside successes, or 201 if all succeeded. The requirement says "a parsing failure for one skill does not block others but is reported."
**Warning signs:** Tests that check error reporting pass but errors list is always empty.

### Pitfall 5: Empty ZIP or ZIP With No SKILL.md
**What goes wrong:** A ZIP containing only `.DS_Store` files or a README with no `SKILL.md` causes a confusing 500.
**Why it happens:** `_find_skill_entries` returns an empty list; code tries to iterate over it without checking.
**How to avoid:** After calling `_find_skill_entries`, if result is empty, raise `HTTPException(400, "No SKILL.md found in ZIP")`.

### Pitfall 6: Mock Storage Download in Tests
**What goes wrong:** The export endpoint calls `supabase.storage.from_("skill-files").download(path)`. The existing conftest mock only stubs `upload` and `remove` on the storage bucket, not `download`.
**Why it happens:** `download` was never needed before Phase 13.
**How to avoid:** Add `storage_bucket.download.return_value = b"file-content"` to the conftest `reset_mocks` fixture — or do it per-test as needed.

---

## Code Examples

### Complete Export Endpoint Skeleton
```python
# Source: Python stdlib zipfile docs + existing threads.py StreamingResponse pattern
@router.get("/{skill_id}/export")
async def export_skill(
    skill_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    skill = (
        supabase.table("skills")
        .select("*")
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not skill.data:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill_row = skill.data[0] if isinstance(skill.data, list) else skill.data

    files = (
        supabase.table("skill_files")
        .select("*")
        .eq("skill_id", skill_id)
        .execute()
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        fm = {"name": skill_row["name"], "description": skill_row["description"],
              "license": "MIT", "compatibility": "1.0"}
        skill_md = f"---\n{yaml.dump(fm, default_flow_style=False)}---\n\n{skill_row['instructions']}"
        zf.writestr("SKILL.md", skill_md)

        for f in files.data:
            subdir = _mime_to_subdir(f["mime_type"])
            raw = supabase.storage.from_("skill-files").download(f["file_path"])
            safe_name = os.path.basename(f["filename"])
            zf.writestr(f"{subdir}/{safe_name}", raw)

    buf.seek(0)
    slug = skill_row["name"].replace(" ", "-").lower()
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{slug}.zip"'},
    )
```

### Import Response Model
```python
# Source: Pydantic docs (project uses Pydantic throughout)
from pydantic import BaseModel

class SkillImportError(BaseModel):
    skill: str
    error: str

class SkillImportResult(BaseModel):
    created: list[SkillResponse]
    errors: list[SkillImportError]
```

### Frontend Export Call (api.ts)
```typescript
// Source: existing uploadDocument pattern in api.ts + MDN Blob URL docs
export async function exportSkill(id: string, name: string): Promise<void> {
  const headers = getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/export`, { headers })
  if (!res.ok) throw new Error("Failed to export skill")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importSkillZip(file: File): Promise<SkillImportResult> {
  const headers = getAuthHeaders()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: "POST",
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to import skill")
  return res.json() as Promise<SkillImportResult>
}
```

---

## Environment Availability

Step 2.6: No new external tools or services are required. All dependencies are stdlib or already installed in the venv.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `zipfile` | Export/Import | stdlib | Python stdlib | — |
| `io.BytesIO` | In-memory ZIP buffer | stdlib | Python stdlib | — |
| `PyYAML` | SKILL.md frontmatter | Already installed | 6.0.3 | — |
| `os.path.normpath` | Path traversal check | stdlib | Python stdlib | — |
| Supabase Storage `download()` | Export file content | Already used in project | supabase-py 2.10.0 | — |
| Browser File API + Blob URL | Frontend import/export | Browser native | All modern browsers | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24.x |
| Config file | `backend/pytest.ini` (asyncio_mode = auto) |
| Quick run command | `cd backend && ./venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -x -q` |
| Full suite command | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPEN-01 | Export returns ZIP with `application/zip` content-type | integration | `pytest tests/integration/test_skills_import_export.py::test_export_returns_zip -x` | Wave 0 |
| OPEN-02 | Exported ZIP contains SKILL.md with valid YAML frontmatter + instructions body | integration | `pytest tests/integration/test_skills_import_export.py::test_export_skill_md_content -x` | Wave 0 |
| OPEN-03 | Exported ZIP includes building-block files in `scripts/`, `references/`, `assets/` subdirs | integration | `pytest tests/integration/test_skills_import_export.py::test_export_file_subdirs -x` | Wave 0 |
| OPEN-04 | Import creates a new skill with name/description/instructions from SKILL.md | integration | `pytest tests/integration/test_skills_import_export.py::test_import_creates_skill -x` | Wave 0 |
| OPEN-05 | Bulk import: parsing failure for one skill does not block others; failed skill reported in errors | integration | `pytest tests/integration/test_skills_import_export.py::test_bulk_import_partial_failure -x` | Wave 0 |
| OPEN-06 | ZIP with path traversal filenames is rejected | integration | `pytest tests/integration/test_skills_import_export.py::test_import_path_traversal_rejected -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && ./venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -x -q`
- **Per wave merge:** `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_skills_import_export.py` — covers OPEN-01 through OPEN-06
- [ ] Conftest storage mock: add `storage_bucket.download.return_value = b"test-content"` to `reset_mocks` fixture (currently missing `download` stub)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `yaml.load()` | `yaml.safe_load()` | PyYAML 5.1 (2019) | Old form allows arbitrary Python object instantiation — security risk |
| Extracting ZIP to temp dir | In-memory `BytesIO` extraction | Modern best practice | No disk writes, no cleanup, no TOCTOU race |
| Trusting ZIP `Content-Type` header | `zipfile.is_zipfile()` byte-level check | Always best practice | Prevents corrupt file panics |

**Deprecated/outdated:**
- `zipfile.extractall(path)` without path filtering: the Python docs now explicitly warn this is unsafe and recommend manual member inspection before extraction.

---

## Open Questions

1. **Response code for bulk import with mixed results (some ok, some failed)**
   - What we know: HTTP 207 Multi-Status is the standard RFC choice; but many APIs just use 200/201 with errors in body
   - What's unclear: No existing precedent in this codebase
   - Recommendation: Use 201 if all skills created, 200 if partial (with errors array), 400 if total failure. Keeps client handling simple.

2. **Import deduplication: what if a skill with the same name already exists?**
   - What we know: Existing `create_skill` endpoint does no dedup check by name; skills are identified by UUID
   - What's unclear: REQUIREMENTS.md does not specify dedup behavior for import
   - Recommendation: Create a new skill regardless — the requirements say "a new skill is created"; leave dedup to the user. Document this in the import response.

3. **Maximum ZIP file size limit for import**
   - What we know: Existing file upload uses 10 MB per file; no ZIP-level limit defined
   - What's unclear: A ZIP with many files could be very large
   - Recommendation: Apply the same 10 MB limit to the entire ZIP upload. Simple, consistent with existing limits.

---

## Sources

### Primary (HIGH confidence)
- Python stdlib `zipfile` module — verified in venv; `zipfile.ZipFile`, `is_zipfile`, `ZipFile.namelist()`, `ZipFile.read()`, `ZipFile.writestr()` all confirmed
- PyYAML 6.0.3 — confirmed installed via `pip show pyyaml`; `yaml.safe_load()` and `yaml.dump()` verified
- `os.path.normpath` path traversal behavior — verified with test script in venv on Windows 11
- Existing `skills.py` API patterns — read directly; `SkillResponse`, storage path format `user_id/skill_id/filename`, conftest mock structure
- FastAPI `StreamingResponse` — already used in `threads.py` line 653

### Secondary (MEDIUM confidence)
- Browser File API + Blob URL download pattern — well-established web standard; consistent with existing `uploadDocument` FormData pattern in `api.ts`
- HTTP 207 Multi-Status for partial bulk operations — RFC 4918 standard

### Tertiary (LOW confidence)
- agentskills.io format specification — referenced in requirements but no official spec URL found; format is defined by this project (OPEN-02 defines the schema)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified in venv; no new dependencies
- Architecture: HIGH — patterns derived from existing codebase code; export/import are well-understood operations
- Pitfalls: HIGH — path traversal verified with actual code execution; YAML pitfalls from PyYAML docs and known security guidance

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable stdlib/PyYAML; no fast-moving dependencies)
