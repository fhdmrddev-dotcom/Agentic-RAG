# Phase 142: Non-Python Skill-Script Honesty (SRH-01) - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 12 (7 source modified, 1 pure helper added inside an existing module, 4 test files new + 2 extended)
**Analogs found:** 12 / 12 (every touchpoint has a blessed in-tree analog — this is an additive-composition phase, not a green-field one)

> **Line numbers re-verified against live code this session** (RESEARCH warned of drift; all seams confirmed). Where a RESEARCH line differs from live, the live number is used below and flagged.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/tool_dispatcher.py` → `_classify_runtime_gap` (NEW pure helper) | utility | transform (untrusted stderr → gap verdict) | `_safe_out_filename` (`:1909`) + `_error_markers` heuristic (`:1192-1207`) | role-match (posture analog; no exact classifier exists) |
| `backend/app/services/tool_dispatcher.py` → `ToolContext.dead_gap_tokens_in_run` (NEW field) | model (dataclass) | run-scoped by-reference state | additive-default-off fields `new_file_hashes_in_run` / `skill_snapshot` / `skill_instructions_override` (`:92-142`) | exact |
| `backend/app/services/tool_dispatcher.py` → `_handle_load_skill` gap flag (`:666`) | service (tool handler) | request-response (CRUD read + ride-along note) | `_handle_save_skill` `lint_warnings` (`:747-761`, `:772`/`:784`) | exact |
| `backend/app/services/tool_dispatcher.py` → `_handle_execute_code` reshape + pre-flight guard (`:891`) | service (tool handler) | request-response + transform | its own result builder `llm_content` (`:1249-1275`) | exact (in-place extension) |
| `backend/app/services/tool_dispatcher.py` → `_decode_skill_file_bytes` whitelist (`:788`) | utility (decoder) | transform (bytes → text) | the existing text-ext branch + else-branch (`:822-829`) | exact (in-place extension) |
| `backend/app/services/openai_service.py` → `EXECUTE_CODE_TOOL.description` (`:581`) | config (tool schema) | request-response (contract string) | the existing `description` string (`:585-596`) | exact (in-place extension) |
| `backend/app/api/skills.py` → `import_skill` note (`:245`) | route (API endpoint) | file-I/O (ZIP) + request-response | its own per-skill loop (`:298-337`) + response shapes (`:372-381`) + `lint_warnings` posture | exact |
| `backend/app/services/agent_loop.py` → run-scoped set init + 2 ctx builds (`:1579`) | service (orchestration) | run-scoped state threading | `_previous_files_in_run` / `_new_file_hashes_in_run` (`:1579`/`:1585` → `:1635-1636` → `:2418-2419`) | exact |
| `backend/app/services/task_service.py` → sub-agent fresh set (`:585`) | service (sub-agent spawn) | run-scoped state threading | `previous_files_in_run={}` fresh-copy (`:602`, Pitfall 7) | exact |
| `frontend/src/lib/api.ts` → `SkillImportResult.notes?` (`:4`) | model (TS type) | request-response | the existing `SkillImportResult` interface (`:4-7`) | exact (additive field) |
| `frontend/src/pages/SkillsPage.tsx` → `handleImport` render (`:63`) | component (page) | request-response (render result) | the existing `importMessage` set/render (`:63-88`, `:122-126`) | exact (additive) |
| `backend/tests/unit/test_142_*.py` (4 NEW) + 2 extended | test | — | `conftest.make_tool_context` (`:621`); `test_099_skill_composition` byte-symmetry tests (`:278`/`:304`); `test_skills_import_export._make_zip` (`:66`) | exact |

**Key data-flow note:** every reshape/guard operates on **already-harvested** in-memory stderr — no new container I/O — so **no new `run_in_threadpool` wrap is required** (D-v2.5-01 already satisfied on the read path). Confirmed against `:1184-1189` (`exec_result = await fut` is where stderr lands in memory).

---

## Pattern Assignments

### `tool_dispatcher.py` → `_classify_runtime_gap` (NEW pure helper, utility / transform)

**Analog A — untrusted-string coercion posture:** `_safe_out_filename` (`tool_dispatcher.py:1909-1922`)

```python
# 101-06 CR-01 — the blessed "distrust a model/sandbox-controlled string" precedent.
# Note: a compiled module-level regex + a FIXED whitelist + a safe default fallback.
_SAFE_OUT_FILENAME_RE = _re_filename.compile(r"^[A-Za-z0-9._ -]+\.(docx|pptx|xlsx)$")
_VALID_RENDER_ENGINES = frozenset({"docxtpl", "run_replace"})   # ← fixed allowlist, exactly the shape KNOWN_MISSING must take

def _safe_out_filename(raw: str | None, template_ext: str) -> str:
    candidate = (raw or "").strip()
    if candidate and _SAFE_OUT_FILENAME_RE.match(candidate):
        return candidate
    ext = template_ext if template_ext in ("docx", "pptx", "xlsx") else "docx"
    return f"deliverable.{ext}"   # ← safe default on non-match (never raises)
```
**Copy:** the module-level-frozenset + "match against a FIXED set, default to a safe pass-through" shape. `_classify_runtime_gap` returns `None` (pass-through) as its "safe default," exactly like this returns `deliverable.<ext>` — never over-reaches on an unrecognized input (threat #1 / Pitfall 2).

**Analog B — the existing stderr/stdout error-signal heuristic to co-locate with:** `_handle_execute_code` exit-derivation (`tool_dispatcher.py:1189-1208`)

```python
actual_exit_code = getattr(exec_result, "exit_code", None) or 0
if actual_exit_code == 0:
    stdout_text = exec_result.stdout or ""
    _error_markers = (
        "Traceback (most recent call last)", "Error:", "Exception:",
        "ModuleNotFoundError", "ImportError", "SyntaxError", "NameError",
        "TypeError", "ValueError", "RuntimeError", "AttributeError",
        "KeyError", "IndexError",
    )
    if any(m in stdout_text for m in _error_markers):
        actual_exit_code = 1
```
**Copy:** the `tuple` of substring markers + `any(m in text ...)` idiom is EXACTLY the primitive the classifier's NOT_FOUND_PHRASES / JS_TOKENS scans should mirror. The classifier is a **stricter** version — it requires a KNOWN_MISSING token to **co-occur** with a NOT_FOUND phrase (never marker-alone), which is the design-law bound in RESEARCH §"Detection Signature Matrix". Feed it `(code, stdout, stderr, exit_code)` (all four surface at `:1189`/`:1256-1266`; exit-124 timeout is a separate hit).

---

### `tool_dispatcher.py` → `ToolContext.dead_gap_tokens_in_run` (NEW field, model)

**Analog:** the additive-default-off run-scoped fields already on `ToolContext` (`tool_dispatcher.py:92-142`)

```python
@dataclass
class ToolContext:
    ...
    previous_files_in_run: dict | None = None  # sandbox output file tracking across execute_code calls
    new_file_hashes_in_run: set | None = None  # RUN-01a — run-scoped accumulator (by-reference share)
    ...
    # Every field below is DEFAULT-OFF (None) so duck-typed / legacy callers stay byte-identical:
    skill_snapshot: Any = None            # 099 — None on Deep => gated branch is a literal no-op
    skill_instructions_override: dict[str, str] | None = None  # 135 — None => byte-identical load_skill
```
**Copy verbatim (the field to add):**
```python
dead_gap_tokens_in_run: set | None = None  # 142 — run-scoped repeat-guard; None on
                                           # legacy/duck-typed callers => guard is a no-op
```
**Why this exact shape:** `new_file_hashes_in_run` is the closest sibling — a `set | None = None` that is a **by-reference run-scoped accumulator** guarded everywhere by `is not None`. Match the guard idiom at `:1239`:
```python
if ctx.new_file_hashes_in_run is not None:     # ← the exact no-op guard the repeat-guard copies
    ctx.new_file_hashes_in_run |= (...)
```
**Anti-pattern (Pitfall 1 / RESEARCH):** do NOT `setattr(ctx, "_dead_calls", ...)`. A fresh `ToolContext` is rebuilt every iteration at `:2405`; setattr does not survive the loop. Run-lifetime persistence REQUIRES the by-reference container.

---

### `tool_dispatcher.py` → `_handle_load_skill` gap flag (`:666`, service / request-response)

**Analog:** `_handle_save_skill`'s `lint_warnings` ride-along (`tool_dispatcher.py:747-761`, returned at `:772`/`:784`)

```python
# TRIG-03 — lint owner-scoped, NEVER block. Save always proceeds; warnings ride along.
lint_warnings: list[dict] = []
try:
    ...
    lint_warnings = lint_description(name, description, siblings)
except Exception:
    lint_warnings = []
...
return ToolResult(result=json.dumps(
    {"status": "created", "name": name, "lint_warnings": lint_warnings}   # ← additive key, never fatal
))
```
**Apply to `_handle_load_skill` (current result build at `:709-724`):**
```python
files_data = _files_resp.data or []
file_names = [f["filename"] for f in files_data]     # ← :710, the input to the ext scan
...
return ToolResult(result=json.dumps({
    "name": row["name"],
    "instructions": instructions,
    "files": file_names,
    # 142 D-05b: add a non-blocking runtime note computed from file_names extensions
    # (mirror lint_warnings — advisory, never blocks the load). Shape: None-or-string.
}))
```
**Copy:** the "compute-into-a-local, `except` → empty, attach as an additive JSON key, never block" discipline. The gap-note helper (`_skill_runtime_note(file_names)`) scans extensions against `SCRIPT_EXTS` (shared with D-11 + SC#1). Note `instructions` is already conditionally overridden just above (`:716-719`, the 135 `skill_instructions_override` precedent) — the note is a sibling additive key, same posture.

---

### `tool_dispatcher.py` → `_handle_execute_code` reactive reshape + pre-flight guard (`:891`, service)

**Analog (the exact hook point):** the completed-run result builder (`tool_dispatcher.py:1249-1275`)

```python
exec_status = "completed" if actual_exit_code == 0 else "error"
tool_result = json.dumps({ "status": exec_status, "exit_code": actual_exit_code,
    "duration_ms": ..., "execution_id": ..., "output_files": ...,
    "stdout": exec_result.stdout or "", "stderr": exec_result.stderr or "" })
# llm_content is what the MODEL sees (signed URLs stripped) — the honest note appends HERE:
llm_content = json.dumps({ "status": exec_status, "exit_code": actual_exit_code,
    "duration_ms": ..., "output_files": [...],
    "stdout": exec_result.stdout or "", "stderr": exec_result.stderr or "" })
...
return ToolResult(result=tool_result, llm_content=llm_content)
```
**Post-hoc reshape (D-06):** after `actual_exit_code` is derived (`:1189-1208`) and BEFORE the `llm_content` build (`:1260`), call `_classify_runtime_gap(code, stdout, stderr, actual_exit_code)`. On a hit: add a `"runtime_gap": {"class", "token", "message"}` key to `llm_content` (the PERMANENT-framed note) AND `ctx.dead_gap_tokens_in_run.add(token)` (guarded `is not None`). On `None`: pass stdout/stderr through UNCHANGED (the real error still reaches the model — threat #1).

**Pre-flight repeat-guard (D-06):** near the top of the handler (before the sandbox is invoked — before the skill-inject/`copy_to_runtime` block at `:969-1026`), check whether the incoming `code` references any token already in `ctx.dead_gap_tokens_in_run`; if so, short-circuit — return a `ToolResult(result=..., llm_content=...)` carrying the same PERMANENT-framed message + a "you already attempted this in the current run; stop retrying" line, and NEVER touch the sandbox. This is what structurally caps the BUG-260707-02 loop at ≤1 real dead call per token.

**Anti-pattern (RESEARCH §Anti-Patterns):** do NOT put the primary reshape in the exception handler (`:1277+`) — most gaps surface as a *completed* run with a non-zero heuristic exit + stderr (`:1189-1207`), not a Python exception. The timeout path (exit-124) is a separate G-C hit.

---

### `tool_dispatcher.py` → `_decode_skill_file_bytes` script-ext whitelist (`:788`, utility / transform, SC#3 D-11)

**Analog (in-place extension of the existing branch):** `tool_dispatcher.py:822-829`

```python
elif ext in {"txt", "md", "py", "csv", "json", "yaml", "yml", "toml", "html", "xml", "rst", "log"}:
    return raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
else:
    # Unrecognized or binary type  ← today's MISLEADING branch for .js/.sh (they ARE text)
    return json.dumps({
        "error": f"File '{filename}' is a binary file that cannot be read as text. "
                 "Upload a text-based version instead."
    })
```
**Insert a `SCRIPT_EXTS` branch BEFORE the `else`** (RESEARCH §read_skill_file): decode utf-8 + prepend a `"[reference only — ... this sandbox runs Python only and cannot execute it ...]"` caveat **prefix string** (NOT JSON — matches the text-return contract of the `.py`/`.md` branch so the model reads it as reference text with a warning).

**Byte-symmetry (Pitfall 3 / the 099 SC#3 red line):** this ONE function is called by BOTH read paths — the 099 snapshot branch at `:849` and the live-skill branch at `:884`:
```python
raw_bytes = ctx.supabase.storage.from_("skill-files").download(storage_path)
tool_result = _decode_skill_file_bytes(filename, raw_bytes)   # ← :849 (snapshot) AND :884 (live), identical call
```
Because the change lives inside the shared decoder, live and snapshot decode identically for free — the whole point of the 099 extraction. A test MUST assert a `.js` payload returns the identical string on both paths (analog: `test_099_skill_composition::test_snapshot_routing` / `test_deep_noop`).

---

### `openai_service.py` → `EXECUTE_CODE_TOOL.description` (`:581`, config, D-05a)

**Analog (in-place extension):** the existing `description` string (`openai_service.py:585-596`)

```python
EXECUTE_CODE_TOOL = {
    "type": "function",
    "function": {
        "name": "execute_code",
        "description": (
            "Execute Python code in a sandboxed Docker container. "
            "IMPORTANT: The sandbox has only the Python standard library pre-installed. "
            "You MUST pass the `libraries` parameter for every third-party package ... "
            ...
        ),
        "parameters": { ... },
    },
}
```
**Copy:** append generic capability facts to this SAME string (available pip set vs NOT-available node/soffice/pandoc/pdftoppm/markitdown/`scripts/office/*` + "do NOT — they will fail; do the equivalent in-memory or tell the user"). Wording model: the applied pptx copy in `BUG-260707-02-pptx-skill-instructions-sandbox-aware.md`.

**Why this is the single source (D-14-safe):** `get_tools()` appends `EXECUTE_CODE_TOOL` once (`openai_service.py:1043`, alongside `LOAD_SKILL_TOOL`/`READ_SKILL_FILE_TOOL` at `:1024`), and the Anthropic/Google gateways convert this SAME list — editing the tool **description** is a uniform additive change across every provider, NOT a fork. It is NOT the `SYSTEM_PROMPT` (that is the byte-identical invariant D-14 guards). Do NOT put capability facts in the system prompt.

---

### `skills.py` → `import_skill` static ext-scan note (`:245`, route, SC#1 D-08)

**Analog (its own per-skill loop + non-blocking `lint_warnings` posture):** `skills.py:298-337`, `:372-381`

```python
# Entries are ALREADY sanitized before any per-skill work (threat #3 — no new traversal surface):
for entry_name in zf.namelist():
    _sanitize_zip_name(entry_name)          # :267-274
...
for prefix, fm, instructions in parsed:      # :298 — per-skill loop the scan reuses
    ...
    for entry_name in zf.namelist():         # :315 — per-entry loop; inspect splitext(basename) here
        if entry_name.endswith("SKILL.md") or entry_name.endswith("/"):
            continue
        filename = os.path.basename(relative)   # :321 — the flat basename (tree-fidelity stays OUT)
        ...
# TWO response branches — the note field MUST be added to BOTH (Pitfall 5):
if has_background:
    return JSONResponse(status_code=202, content={
        "created": results, "errors": errors,
        "message": "Skill imported — files uploading in background",
        # 142 SC#1: + "notes": [{"skill": ..., "note": ...}]   ← additive optional key
    })
return {"created": results, "errors": errors}   # :381 — 200 path; same additive key here
```
**Copy:** collect per-skill non-`SKILL.md` basenames whose ext ∈ `SCRIPT_EXTS` (the SAME set as D-11/D-05b) during the existing `:315` loop; if non-empty, append `{skill, note}`. Add `notes: list` to BOTH the 202 (`:372`) and 200 (`:381`) returns. Additive optional key → existing consumers ignore it (RESEARCH A4). Reuse `_make_zip`/`_valid_skill_md` (`test_skills_import_export.py:66`/`:77`) for the test.

---

### `agent_loop.py` → run-scoped set init + thread into both ctx builds (`:1579`, service, D-06 run-scope)

**Analog:** `_previous_files_in_run` / `_new_file_hashes_in_run` (`agent_loop.py:1579-1585` init → `:1635-1636` resume build → `:2418-2419` main-loop build)

```python
# :1579-1585 — init ONCE per run, OUTSIDE the iteration loop:
_previous_files_in_run: dict[str, dict] = {}
_new_file_hashes_in_run: set[str] = set()   # RUN-01a — by-reference run-scoped accumulator

# :1635-1636 (resume path) AND :2418-2419 (main per-iteration build) — passed into BOTH ToolContext(...):
    previous_files_in_run=_previous_files_in_run,
    new_file_hashes_in_run=_new_file_hashes_in_run,  # RUN-01a — same by-reference share
```
**Copy verbatim (the addition):**
```python
_dead_gap_tokens_in_run: set[str] = set()   # 142 — run-scoped repeat-guard, init once
# ... then in BOTH ctx builds (:1635 resume + :2418 main):
    dead_gap_tokens_in_run=_dead_gap_tokens_in_run,
```
Both `ToolContext(...)` builds are structurally identical (`:1622-1644` resume, `:2405-2427+` main) — thread the new kwarg into each, exactly beside `new_file_hashes_in_run`. There are exactly TWO builds in this file (confirmed by grep: `:1635` + `:2418`).

---

### `task_service.py` → sub-agent fresh set (`:585`, service, Pitfall 6)

**Analog:** the fresh-copy `previous_files_in_run={}` decision for sub-agents (`task_service.py:598-602`)

```python
sub_ctx = ToolContext(
    ...
    # Pitfall 7 — fresh dict, NOT a reference to parent's. Sub-agent's execute_code
    # output tracking is isolated from parent's; otherwise the parent's panel would
    # briefly show files that belong to the sub-agent and vice versa.
    previous_files_in_run={},
    ...
    skill_snapshot=parent_ctx.skill_snapshot,          # ← contrast: these PROPAGATE from parent
    skill_instructions_override=parent_ctx.skill_instructions_override,
)
```
**Copy:** give the sub-agent a **FRESH `set()`** (mirror `previous_files_in_run={}`, NOT `parent_ctx.dead_gap_tokens_in_run`):
```python
dead_gap_tokens_in_run=set(),   # 142 Pitfall 6 — isolate sub-agent dead calls from parent
```
**Rationale:** a sub-agent's failed `soffice` call must not short-circuit a legitimately-different parent context. Note `new_file_hashes_in_run` is simply omitted here (defaults `None`); the repeat-guard should get a fresh `set()` rather than `None` so the guard is live inside sub-agents too. This is the ONE field where the pattern is "fresh, not propagate" — every other 085/096/099/135 field on this ctx propagates from parent.

---

### `frontend/src/lib/api.ts` → `SkillImportResult.notes?` (`:4`, model / TS type)

**Analog (additive field on the existing interface):** `api.ts:4-7`

```typescript
export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
  // 142 SC#1: + notes?: Array<{ skill: string; note: string }>   ← optional so old code compiles
}
```
**Copy:** add an OPTIONAL `notes?` array. Optional → no consumer breaks; local `tsc`/vitest catch a required-field mistake (Vercel `vite build` skips tsc, so the frontend test is the backstop — Pitfall 5).

---

### `frontend/src/pages/SkillsPage.tsx` → `handleImport` render (`:63`, component)

**Analog (its own import-result render):** `SkillsPage.tsx:63-88` (set) + `:122-126` (render)

```tsx
const result = await importSkillZip(file)
const created = result.created.length
const failed = result.errors.length
if (failed > 0 && created > 0) {
  setImportMessage({ text: `${created} skill... imported, ${failed} failed - check your ZIP.`, isError: false })
} else if (created > 0) {
  setImportMessage({ text: `${created} skill... imported.`, isError: false })
}
...
// render (non-error = text-muted-foreground line, no bespoke card — D-08/D-09):
{importMessage && (
  <p className={cn("text-sm mb-4", importMessage.isError ? "text-destructive" : "text-muted-foreground")}>
    {importMessage.text}
  </p>
)}
```
**Copy:** in the `created > 0` branch, append `result.notes` text to the same `importMessage.text` (non-error, muted). NO new component (D-09). e.g. append `" Note: 'docx' includes a step the sandbox can't run yet; its instructions still work."`

---

### Test files (test / unit + integration + frontend)

| New/extended test | Analog to copy | Anchor |
|-------------------|----------------|--------|
| `tests/unit/test_142_runtime_gap.py` (NEW) — classifier hits (G-A/G-B/G-C) + **pass-through negatives** (genuine ValueError / missing user file / real SyntaxError → NO reshape) | plain pure-function unit tests over `_classify_runtime_gap` | RESEARCH §"Design law (threat #1)" — the mandatory negative test |
| `tests/unit/test_142_repeat_guard.py` (NEW) — repeat short-circuits (assert N sandbox calls → 1) + run-scope-not-setattr + loop-cap (D-03) | `make_tool_context` factory (build a ctx with `dead_gap_tokens_in_run=set()`) + a mock sandbox session | `conftest.py:621` (`make_tool_context` is a `SimpleNamespace` — pass the new field as an override); mock-session shape in `tests/unit/test_sandbox_tools.py` |
| `tests/unit/test_142_load_skill_flag.py` (NEW) — flag present when a `.js` in file list, absent when all-Python | `_handle_load_skill` handler test w/ mocked `skill_files` select | `make_tool_context` (`conftest.py:621`) |
| `tests/unit/test_142_read_skill_file.py` (NEW) — `.js`/`.sh` → reference text + caveat; **live path == snapshot path** (byte-symmetry) | `test_099_skill_composition::test_snapshot_routing` / `test_deep_noop` | `test_099_skill_composition.py:278`/`:304` |
| `tests/unit/test_sandbox_tools.py` (EXTEND) — assert `EXECUTE_CODE_TOOL.description` contains the capability facts | existing tool-schema assertions in the file | `backend/tests/unit/test_sandbox_tools.py` |
| `tests/integration/test_skills_import_export.py` (EXTEND) — import note for a `.js`-bundling ZIP (200 AND 202 paths); none for all-Python | `_make_zip` / `_valid_skill_md` helpers | `test_skills_import_export.py:66`/`:77` |
| Frontend `SkillsPage` test (NEW/EXTEND) — `handleImport` surfaces the note text | existing SkillsPage vitest (if present) or a new render test | `frontend/src/pages/SkillsPage.tsx` (note: ~14-17 frontend vitest tests are pre-existing ROT — SEED-056; author the new test to pass at HEAD) |

**Fixture note:** `make_tool_context` (`conftest.py:621`) returns a `SimpleNamespace`, so `dead_gap_tokens_in_run` can be passed as an override even before/after the dataclass field lands — no conftest change required. Its defaults do NOT yet include the field (like `new_file_hashes_in_run`, which is also absent from the factory defaults), so tests must pass it explicitly.

---

## Shared Patterns

### Non-blocking advisory note (ride-along)
**Source:** `_handle_save_skill` `lint_warnings` (`tool_dispatcher.py:747-761`, `:772`/`:784`)
**Apply to:** the `load_skill` gap flag (D-05b) AND the `import_skill` note (SC#1/D-08)
```python
warnings: list = []          # or: note = None
try:
    warnings = compute(...)  # ext scan
except Exception:
    warnings = []            # degrade silently — NEVER raise, NEVER block
return ...json.dumps({..., "advisory_key": warnings})   # additive key; old consumers ignore it
```
The rule: advisory notes are **additive JSON keys** on an existing result, computed defensively, that **never block** the save/load/import.

### Additive default-off run-scoped state (the D-14 discipline)
**Source:** `new_file_hashes_in_run` / `skill_snapshot` / `skill_instructions_override` on `ToolContext` (`tool_dispatcher.py:92-142`) + the `is not None` guards (`:1239`)
**Apply to:** the `dead_gap_tokens_in_run` repeat-guard field
```python
field: set | None = None                       # dataclass default OFF
...
if ctx.field is not None:                       # every use is guarded → literal no-op where unwired
    ctx.field.add(token)
```
Every harness / eval / test caller that leaves it `None` gets **byte-identical Deep behavior** — the guard is a literal no-op. This is the mechanism that keeps the phase off the D-14 red line.

### Run-scoped by-reference threading (init-once → thread-into-every-build → fresh-for-sub-agents)
**Source:** `_previous_files_in_run` / `_new_file_hashes_in_run` (`agent_loop.py:1579-1585` → `:1635-1636` + `:2418-2419`) + `task_service.py:602` fresh copy
**Apply to:** the repeat-guard set
- init ONCE per run, outside the iteration loop (`agent_loop.py`)
- pass into BOTH `ToolContext(...)` builds (resume `:1635` + main `:2418`)
- give sub-agents a FRESH container (`task_service.py:585`, mirror `previous_files_in_run={}`)

### Untrusted-string coercion (distrust model/sandbox strings)
**Source:** `_safe_out_filename` (`tool_dispatcher.py:1909-1922`) + `_error_markers` (`:1192-1207`)
**Apply to:** `_classify_runtime_gap` parsing untrusted sandbox stderr
```python
# module-level FIXED allowlist + substring co-occurrence; return a SAFE default (None) on non-match:
KNOWN_MISSING_BINARIES = frozenset({"soffice","libreoffice","pandoc","pdftoppm","pdfinfo","node","npm","npx","extract-text"})
NOT_FOUND_PHRASES = ("no such file or directory","filenotfounderror","command not found","not found")
# hit ONLY when a KNOWN_MISSING token co-occurs with a NOT_FOUND phrase (never marker-alone)
```
**Design law (threat #1):** never reshape on error-TYPE alone (`FileNotFoundError` / `SyntaxError` / non-zero exit). Require a KNOWN_MISSING token co-occurrence (or JS-token + `SyntaxError`). Default is pass-through (`None`) — the real error always reaches the model.

### Shared decoder = free byte-symmetry
**Source:** `_decode_skill_file_bytes` (`tool_dispatcher.py:788`) called by both `:849` (snapshot) and `:884` (live)
**Apply to:** the SC#3 `.js`/`.sh` caveat — make the change ONLY inside this one function; both read paths inherit it (Pitfall 3).

### ZIP entry safety already handled
**Source:** `_sanitize_zip_name` runs on every entry at `skills.py:267-274` BEFORE any per-skill work
**Apply to:** the import scan — it only inspects `os.path.splitext(basename)` on already-sanitized names → no new path-traversal surface (threat #3).

---

## No Analog Found

**None.** Every touchpoint has a blessed in-tree analog. The only *net-new artifact* is the pure `_classify_runtime_gap` helper, and even that composes two existing patterns (`_safe_out_filename` posture + the `_error_markers` substring-tuple idiom) — it has no drop-in analog only because no bounded stderr-classifier existed yet, but its shape is fully specified by the two posture analogs above.

---

## Metadata

**Analog search scope:** `backend/app/services/{tool_dispatcher,openai_service,agent_loop,task_service,sandbox_service}.py`, `backend/app/api/skills.py`, `frontend/src/{lib/api.ts,pages/SkillsPage.tsx}`, `backend/tests/{conftest.py,unit/test_sandbox_tools.py,integration/test_skills_import_export.py,test_099_skill_composition.py}`
**Files scanned:** 11 source/test files read; all RESEARCH-cited line numbers re-verified against live code this session
**Line-drift check:** RESEARCH `import_skill` cited both `:245` and `:246`; live decorator is `:245`, `async def` is `:246`. RESEARCH `_safe_out_filename` cited `:1910`; live is `:1909`. RESEARCH `EXECUTE_CODE_TOOL` `:581` and all `tool_dispatcher.py` seams (`:666`/`:727`/`:747`/`:788`/`:822`/`:832`/`:891`/`:1189`/`:1249`/`:1909`) and `agent_loop.py` (`:1579`/`:1585`/`:1635`/`:2418`) confirmed exact. `task_service.py` sub_ctx build is `:585` (RESEARCH cited `:602` for the `previous_files_in_run={}` line specifically — confirmed at `:602`).
**Pattern extraction date:** 2026-07-08
```
