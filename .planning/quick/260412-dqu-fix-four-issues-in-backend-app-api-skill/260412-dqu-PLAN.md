---
phase: quick-260412-dqu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [backend/app/api/skills.py]
autonomous: true
requirements: [MIME-ROUTE, ZIP-SLUG, FM-COMPAT, ZIP-ROOT]
must_haves:
  truths:
    - "Office/PDF/ZIP/binary files route to assets/ subdirectory in export ZIP"
    - "Plain text types still route to references/"
    - "ZIP filename and frontmatter name use URL-safe slug derived from skill name"
    - "compatibility field contains human-readable requirement string, not version number"
    - "Every file in the ZIP is nested under a root folder named after the slug"
  artifacts:
    - path: "backend/app/api/skills.py"
      provides: "All four fixes applied"
      contains: "import re"
  key_links:
    - from: "_mime_to_subdir"
      to: "export_skill zf.writestr"
      via: "subdir variable"
      pattern: "zf\\.writestr.*subdir"
---

<objective>
Apply four targeted fixes to backend/app/api/skills.py: expand _mime_to_subdir routing for document/binary MIME types, derive a URL-safe slug for ZIP naming, update frontmatter dict with correct compatibility semantics and metadata block, and wrap all ZIP entries under a root folder.

Purpose: Exported skill ZIPs conform to agentskills.io format with correct file routing, clean naming, and proper folder structure.
Output: Single modified file — backend/app/api/skills.py
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/api/skills.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix _mime_to_subdir and add re import</name>
  <files>backend/app/api/skills.py</files>
  <action>
1. Add `import re` to the top-level imports (line 1 area, alongside `import io`, `import os`).

2. In `_mime_to_subdir` (line 25), add a NEW branch BEFORE the final `return "references"` (line 31) that routes to `"assets"` for these MIME types:
   - Anything starting with `application/vnd.openxmlformats-officedocument`
   - `application/pdf`
   - `application/zip`
   - `application/octet-stream`

   Implementation — add after the image/audio/video check (line 29-30) and before `return "references"`:
   ```python
   if (
       mime_type.startswith("application/vnd.openxmlformats-officedocument")
       or mime_type in ("application/pdf", "application/zip", "application/octet-stream")
   ):
       return "assets"
   ```

   Plain text types (text/plain, text/markdown, text/csv, text/html) must still fall through to `return "references"` — do NOT add them to the new branch.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" && python -c "
import sys; sys.path.insert(0, 'backend')
from app.api.skills import _mime_to_subdir
assert _mime_to_subdir('application/pdf') == 'assets', 'pdf failed'
assert _mime_to_subdir('application/zip') == 'assets', 'zip failed'
assert _mime_to_subdir('application/octet-stream') == 'assets', 'octet failed'
assert _mime_to_subdir('application/vnd.openxmlformats-officedocument.wordprocessingml.document') == 'assets', 'docx failed'
assert _mime_to_subdir('text/plain') == 'references', 'text/plain failed'
assert _mime_to_subdir('text/markdown') == 'references', 'markdown failed'
assert _mime_to_subdir('text/csv') == 'references', 'csv failed'
assert _mime_to_subdir('text/x-python') == 'scripts', 'python failed'
assert _mime_to_subdir('image/png') == 'assets', 'image failed'
print('All _mime_to_subdir assertions passed')
"</automated>
  </verify>
  <done>_mime_to_subdir routes office/PDF/ZIP/binary to assets/, text types to references/, python to scripts/. `import re` is present at module top.</done>
</task>

<task type="auto">
  <name>Task 2: Fix export_skill — slug, frontmatter, and ZIP root folder</name>
  <files>backend/app/api/skills.py</files>
  <action>
In the `export_skill` function (starts ~line 456), make these changes:

1. **Slug derivation** — Replace the existing slug line (line 502: `slug = skill_row["name"].replace(" ", "-").lower()`) and move slug computation EARLIER, right after `skill_row` is assigned (~line 473). Use:
   ```python
   slug = re.sub(r'[^a-z0-9-]+', '-', skill_row["name"].lower()).strip('-')
   ```
   This requires the `import re` from Task 1.

2. **Frontmatter dict** — Replace the existing `fm` dict (lines 486-491) with:
   ```python
   fm = {
       "name": slug,
       "description": skill_row["description"],
       "license": "MIT",
       "metadata": {
           "version": "1.0",
           "original_name": skill_row["name"],
       },
       "compatibility": "Requires execute_code tool with Docker sandbox and python-docx",
   }
   ```

3. **ZIP root folder wrapper** — Prefix every `zf.writestr` path with `f"{slug}/"`:
   - Change `zf.writestr("SKILL.md", skill_md)` to `zf.writestr(f"{slug}/SKILL.md", skill_md)`
   - Change `zf.writestr(f"{subdir}/{safe_name}", raw)` to `zf.writestr(f"{slug}/{subdir}/{safe_name}", raw)`

4. **Verify _find_skill_entries** — Confirm it already handles SKILL.md one level deep. Looking at lines 58-69, it checks `len(parts) == 2 and parts[1] == "SKILL.md"` which correctly handles `slug/SKILL.md`. No change needed here.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" && python -c "
import ast, re

with open('backend/app/api/skills.py') as f:
    source = f.read()

# Check slug uses re.sub
assert \"re.sub(r'[^a-z0-9-]+'\" in source, 'slug re.sub not found'

# Check frontmatter has metadata block
assert '\"original_name\"' in source, 'original_name not in frontmatter'
assert '\"metadata\"' in source, 'metadata key not in frontmatter'

# Check compatibility is a human-readable string
assert 'Requires execute_code tool' in source, 'compatibility string not found'

# Check ZIP root folder wrapping
assert 'f\"{slug}/SKILL.md\"' in source or 'f\\\"{slug}/SKILL.md\\\"' in source or '{slug}/SKILL.md' in source, 'SKILL.md not wrapped'
assert '{slug}/{subdir}/{safe_name}' in source, 'file paths not wrapped'

# Check slug is derived before fm dict
tree = ast.parse(source)
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'export_skill':
        body_src = ast.get_source_segment(source, node)
        slug_pos = body_src.find('re.sub')
        fm_pos = body_src.find('fm = {')
        assert slug_pos < fm_pos, f'slug must come before fm dict (slug@{slug_pos}, fm@{fm_pos})'
        break

print('All export_skill assertions passed')
"</automated>
  </verify>
  <done>export_skill produces ZIPs with: URL-safe slug as name field and root folder, original_name preserved in metadata, human-readable compatibility string, all entries nested under slug/ prefix.</done>
</task>

</tasks>

<verification>
Run the inline verification commands for both tasks. Additionally:
```bash
cd "C:/Vibe Apps/Agentic RAG" && python -c "import ast; ast.parse(open('backend/app/api/skills.py').read()); print('Syntax OK')"
```
</verification>

<success_criteria>
- _mime_to_subdir correctly routes office/PDF/ZIP/binary MIME types to assets/
- Plain text types still route to references/, python to scripts/
- export_skill slug is URL-safe (lowercase alphanumeric + hyphens only)
- Frontmatter contains metadata.original_name and human-readable compatibility
- All ZIP entries wrapped under slug/ root folder
- File parses without syntax errors
</success_criteria>

<output>
After completion, create `.planning/quick/260412-dqu-fix-four-issues-in-backend-app-api-skill/260412-dqu-SUMMARY.md`
</output>
