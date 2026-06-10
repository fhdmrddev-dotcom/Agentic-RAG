---
phase: 100-ephemeral-template-upload
verified: 2026-06-10T16:45:00Z
status: human_needed
score: 3/3 roadmap truths verified (automated evidence)
overrides_applied: 0
gaps:
  - truth: "The uploaded template expires via TTL (expires_at) + a sweep and is no longer retrievable after expiry"
    status: partial
    reason: "WR-01: ON CONFLICT in upsert_workspace_file unconditionally overwrites kind/expires_at with EXCLUDED values (no COALESCE). An agent write to a template's path NULLs expires_at, making the file permanent and bypassing the sweep. WR-02: workspace_service.get_diff (the asyncpg path consumed by the workspace_diff agent tool) does not check is_expired — an expired-but-not-yet-swept template is still reachable via this path, contradicting the 'no longer retrievable after expiry' guarantee. WR-03: sweep_expired deletes the DB row before removing Storage bytes; a transient Storage failure orphans the bytes permanently with no retry path (the deleted row cannot be retried by future sweeps)."
    artifacts:
      - path: "backend/app/db/workspace.py"
        issue: "WR-01: ON CONFLICT DO UPDATE SET kind = EXCLUDED.kind, expires_at = EXCLUDED.expires_at — no COALESCE; agent write to a template path NULLs out its expiry permanently"
      - path: "backend/app/services/workspace_service.py"
        issue: "WR-02: get_diff calls get_file_by_path (which returns is_expired) but never checks file_row.get('is_expired') before proceeding — the diff path leaks an expired template's version metadata and bypasses D-10"
      - path: "backend/app/services/template_service.py"
        issue: "WR-03: sweep_expired DELETEs the DB row first, then calls storage.remove — a Storage failure permanently orphans the bytes with no retry (only logging); WR-03 fix is to reverse the order so a Storage failure leaves the row intact for the next sweep"
    missing:
      - "In upsert_workspace_file: change ON CONFLICT SET kind = COALESCE(EXCLUDED.kind, workspace_files.kind), expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at)"
      - "In get_diff: after file_row = await get_file_by_path(...), add: if file_row.get('is_expired'): raise FileNotFoundError_('template expired')"
      - "In sweep_expired: reverse deletion order — remove Storage objects first, skip row DELETE if storage.remove fails; ensures retry on next sweep cadence"
human_verification:
  - test: "Upload a real .docx to the workspace panel Files section"
    expected: "Card appears with a 'Template' badge and 'expires in Nh' countdown. Agent workspace_list returns the file. Agent workspace_read returns the binary stub."
    why_human: "Lived-experience UI interaction + live agent tool execution in a real thread"
  - test: "Upload a template containing the text 'ZZ-TMPL-MARKER-100', then search for that string via agent search_documents and via the UI KB search"
    expected: "The distinctive marker text must NEVER appear in any search results — template is workspace-only, not ingested"
    why_human: "Requires a live KB search against the actual vector store to confirm no embedding/ingestion occurred"
  - test: "Set app_settings.template_ttl_hours to a low value (e.g. 1/24 of an hour via direct SQL or a very near-past expires_at), then observe the panel"
    expected: "The file disappears from the panel after expiry. An agent workspace_read returns 'template expired'. After the sweep runs, verify via psycopg2 on local :54322 that the workspace_files row is gone AND the workspace-files Storage bucket has no leftover version objects for that file_id"
    why_human: "Requires wall-clock waiting plus Storage inspection; automated tests mock the sweep path"
  - test: "Upload an .exe renamed to .docx, then upload a real PDF"
    expected: "Both uploads are rejected with a visible 422 error message in the panel. No workspace_files row is created for either attempt."
    why_human: "Requires browser interaction to observe the panel error surface and confirm no row persisted"
  - test: "Start a multi-phase workflow with an uploaded template whose TTL would expire during the run"
    expected: "The run-pin (D-09) extends expires_at via GREATEST at kickoff; the workflow completes without a mid-flight 'template expired' error"
    why_human: "Requires a live multi-phase workflow run with precise TTL timing"
  - test: "Log in as a second user and attempt to list / download the first user's uploaded template"
    expected: "All attempts return 404 — the template is RLS-scoped to the uploading user only"
    why_human: "Requires two live browser sessions"
  - test: "Verify that agent-written workspace files (expires_at NULL) list/read/diff exactly as before Phase 100, and run a workflow that has no template_input file"
    expected: "No behavioral change in NULL-expiry files; the templateless workflow runs byte-identically (D-11 RED LINE)"
    why_human: "Requires a live workflow execution to confirm the D-11 no-op invariant in production"
---

# Phase 100: Ephemeral Template Upload — Verification Report

**Phase Goal:** A user can hand the workflow a template file for one run without it ever entering the knowledge base.
**Verified:** 2026-06-10T16:45:00Z
**Status:** human_needed (3 warnings in code review require targeted fixes before the 3 expiry guarantee gaps close; 7 G-4 UAT rows require live operator verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user can upload a docx/pptx/xlsx into a thread temporarily (workspace-only via `POST /threads/{tid}/workspace/files`, `kind='template_input'`, RLS-scoped to the owner) | VERIFIED | `@router.post("/files")` upload handler in `workspace.py` confirmed with `validate_ooxml`, `write_file(kind="template_input", expires_at=...)`, and `_verify_thread_ownership` (404 on non-owner); `WorkspaceFile.kind?`/`expires_at?` in `types/index.ts`; `uploadWorkspaceTemplate` client in `api.ts`; FilesSection upload affordance confirmed; test suite 12 passed + 10 xpassed 0 failures |
| 2 | The uploaded template is never ingested, never embedded, and never appears in KB search results | VERIFIED (automated path) | SC#2 structural guard (`test_workspace_files_not_in_ingestion`) passes GREEN: `extraction_service.py`, `retrieval_service.py`, `embedding_service.py`, `multimodal_service.py` contain zero references to `workspace_files`; upload writes only to `workspace_files` via `write_file`; OOXML bytes stored opaque, never parsed/rendered/embedded; live confirmation requires human UAT row 2 |
| 3 | The uploaded template expires via TTL (`expires_at`) + a sweep and is no longer retrievable after expiry | PARTIAL — 3 code-review gaps (WR-01, WR-02, WR-03) undermine the full guarantee | Read-path filter confirmed: `list_files_in_thread` gates `expires_at IS NULL OR expires_at > now()` (both branches); `read_file` raises `FileNotFoundError_("template expired")` on `is_expired`; 4 REST routes gated with `.or_("expires_at.is.null,expires_at.gt."+_now_iso())`; `sweep_expired` and `pin_templates_for_run` exist and are wired. BUT: WR-01 agent-overwrite NULLs expiry; WR-02 `get_diff` asyncpg path not expiry-gated; WR-03 sweep deletes row before Storage, making Storage failures permanent. See Gaps Summary. |

**Score:** 3/3 truths have implementation evidence, but Truth 3 has 3 code-level gaps that partially undermine the guarantee. Status is `human_needed` (the 7 G-4 UAT rows are mandatory per CONTEXT.md) with the 3 WR gaps documented for targeted closure.

### Deferred Items

None — no later milestone phases address these specific gaps.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/068_workspace_template_ephemeral.sql` | kind + expires_at columns + partial index + app_settings.template_ttl_hours + permissive CHECK | VERIFIED | All 4 elements confirmed present via text grep; applied to live local DB (verified: 3 pre-existing rows untouched, both columns exist in full-schema.sql) |
| `supabase/full-schema.sql` | Regenerated bootstrap artifact including the new columns | VERIFIED | `template_ttl_hours` appears 3 times; `expires_at` and `kind text` confirmed present |
| `backend/app/db/workspace.py` | kind/expires_at in INSERT/SELECT; gated WHERE on 2 asyncpg read seams; is_expired flag | VERIFIED (with WR-01 caveat) | `expires_at IS NULL OR expires_at > now()` in both `list_files_in_thread` branches; `is_expired` computed column in `get_file_by_path` and `get_file_by_id`; `kind = EXCLUDED.kind` in ON CONFLICT — but EXCLUDED (not COALESCE) means agent writes can NULL a template's expiry (WR-01) |
| `backend/app/services/workspace_service.py` | write_file threads kind/expires_at; OOXML MIME prefix; expired→FileNotFoundError_("template expired") | VERIFIED | `application/vnd.openxmlformats-officedocument` in `_BINARY_MIME_PREFIXES`; `kind=kind, expires_at=expires_at` in write call; `raise FileNotFoundError_("template expired")` at line 338; `get_diff` lacks the is_expired check (WR-02) |
| `backend/app/api/workspace.py` | POST upload route + validate_ooxml + 4 expiry-gated GET routes | VERIFIED | `def validate_ooxml` at line 115; `zipfile.is_zipfile` at line 129; `@router.post("/files")` at line 140; `grep -c "expires_at.is.null,expires_at.gt"` = 4; `get_workspace_file_diff` REST route IS gated (the REST path is covered; only the asyncpg `get_diff` service is not) |
| `backend/app/models/user_settings.py` | template_ttl_hours: int = 24 on UserEffectiveSettings | VERIFIED | `template_ttl_hours: int = 24` confirmed; `template_ttl_hours=int(_val(...)` confirmed |
| `backend/app/services/template_service.py` | sweep_expired (rows + ALL Storage bytes, idempotent) + pin_templates_for_run (GREATEST-only, no-op when no template) | VERIFIED (with WR-03 caveat) | `async def sweep_expired` at line 34; `async def pin_templates_for_run` at line 75; `GREATEST(expires_at,...` at line 89; `kind = 'template_input' AND expires_at IS NOT NULL` WHERE guard confirmed; row DELETE occurs BEFORE Storage remove — Storage failure permanently orphans bytes (WR-03) |
| `backend/app/main.py` | _sweep_expired_templates lifespan task (~15 min, idempotent) | VERIFIED | `asyncio.create_task(_sweep_expired_templates())` at line 272; `15 * 60` cadence confirmed |
| `backend/app/api/threads.py` | One thin pin_templates_for_run call at kickoff seam (G-5 honored) | VERIFIED | `await _template_service.pin_templates_for_run(...)` at line 977; `grep "GREATEST" threads.py` = empty; `grep "UPDATE workspace_files" threads.py` = empty — G-5 confirmed clean |
| `backend/app/models/harness.py` | Co-lock comment repointed to Phase 101 | VERIFIED | Line 154: `# assets (template/reference refs) in Phase 101 (the trusted-library fill path)` |
| `frontend/src/lib/api.ts` | uploadWorkspaceTemplate(threadId, file) FormData+Bearer client | VERIFIED | `export async function uploadWorkspaceTemplate` at line 1185; `workspace/files` POST URL confirmed |
| `frontend/src/types/index.ts` | WorkspaceFile.kind? + WorkspaceFile.expires_at? optional fields | VERIFIED | `kind?: string` at line 315; `expires_at?: string` at line 316 |
| `frontend/src/components/panel/FilesSection.tsx` | Upload button + Template badge + countdown + amber tint + per-ext icons | VERIFIED | `uploadWorkspaceTemplate` imported and called; `accept=".docx,.pptx,.xlsx"` at line 238; `Template` badge at line 315; `expiryCaption` and `isNearExpiry` helpers; `text-amber-500` at line 321; `kind === "template_input"` gate; no `setInterval` found |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `workspace.py upload_template` | `workspace_service.write_file` | `kind="template_input", expires_at=now+TTL` | WIRED | Line 175: `kind="template_input"` confirmed in call |
| `workspace.py GET routes (list, content, versions, diff)` | expiry filter | `.or_("expires_at.is.null,expires_at.gt."+_now_iso())` | WIRED | 4 occurrences confirmed |
| `db/workspace.py list_files_in_thread` | expiry gate | `expires_at IS NULL OR expires_at > now()` | WIRED | 2 branch occurrences confirmed |
| `workspace_service.py read_file` | D-10 error | `is_expired → raise FileNotFoundError_("template expired")` | WIRED | Line 338 confirmed |
| `workspace_service.py get_diff` | D-10 error | `is_expired` check | NOT WIRED (WR-02) | `get_diff` calls `get_file_by_path` but never checks `file_row.get("is_expired")` |
| `db/workspace.py upsert_workspace_file` | expiry preservation on agent overwrite | `COALESCE` in ON CONFLICT | NOT WIRED (WR-01) | Uses `EXCLUDED.kind`/`EXCLUDED.expires_at` unconditionally — agent write NULLs template expiry |
| `main.py lifespan` | `template_service.sweep_expired` | `asyncio.create_task(_sweep_expired_templates())` | WIRED | Line 272 confirmed |
| `threads.py kickoff` | `template_service.pin_templates_for_run` | thin delegating call | WIRED | Line 977 confirmed; G-5 clean |
| `sweep_expired` | Storage byte removal | Storage remove AFTER row DELETE | PARTIAL (WR-03) | Delete-before-remove ordering means Storage failure permanently orphans bytes |
| `FilesSection.tsx upload button` | `api.ts uploadWorkspaceTemplate` | `onChange file input` | WIRED | `uploadWorkspaceTemplate(threadId, f)` in `handleUpload` confirmed |
| `FilesSection.tsx upload success` | `StreamsProvider setWorkspaceFileForThread` | optimistic upsert | WIRED | `setWorkspaceFileForThread(threadId, uploaded)` confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `FilesSection.tsx` | `files` (WorkspaceFile[]) | `useWorkspaceFiles(threadId)` → StreamsProvider store → `listWorkspaceFiles` API | Yes — GET list route returns kind+expires_at from live DB | FLOWING |
| `FilesSection.tsx` badge/countdown | `file.kind`, `file.expires_at` | Written by `write_file(kind="template_input", expires_at=...)` at upload | Yes — persisted to DB, returned in list response | FLOWING |
| `template_service.py sweep_expired` | `expired` rows | `pool.fetch("SELECT id FROM workspace_files WHERE expires_at IS NOT NULL AND expires_at <= now()")` | Yes — live DB query | FLOWING |
| `template_service.py pin_templates_for_run` | UPDATE result | `pool.execute("UPDATE workspace_files SET expires_at = GREATEST(...) WHERE ...")` | Yes — live DB write | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration 068 body is correct | `python -c "...assert 'expires_at timestamptz' in t..."` | All 4 assertions pass | PASS |
| Full-schema.sql regenerated | `python -c "...'template_ttl_hours' in t..."` | True | PASS |
| validate_ooxml rejects renamed binary | `from app.api.workspace import validate_ooxml; pytest.raises(HTTPException, validate_ooxml, 't.docx', b'MZ\x90\x00')` | Raises HTTPException(422) | PASS |
| asyncpg gated filter present (both branches) | `grep -n "expires_at IS NULL OR expires_at > now()" db/workspace.py` | 2 matches | PASS |
| G-5 guard: no inline GREATEST in threads.py | `grep "GREATEST" threads.py` | 0 matches | PASS |
| D-10 "template expired" in workspace_service | `grep -n "template expired" workspace_service.py` | Line 338 | PASS |
| SC#2 isolation: no workspace_files in ingestion modules | extraction/retrieval/embedding/multimodal_service.py grepped | All 4 return empty | PASS |
| Phase 100 test suite | `pytest tests/test_workspace_template.py tests/unit/test_workspace_api.py -q` | 12 passed + 10 xpassed, 0 failures | PASS |
| Frontend FilesSection suite | `vitest run FilesSection` | 11 passed / 0 skipped | PASS |
| 098/099/harness/dispatcher regression | `pytest tests/test_099... tests/test_098... tests/test_harness... tests/unit/test_tool_dispatcher.py -q` | 1 known pre-existing failure (test_bounded_retry), 94 passed — 0 new failures | PASS |
| get_diff expiry gate (asyncpg path) | `grep "is_expired" workspace_service.py get_diff body` | NOT FOUND | FAIL (WR-02) |
| ON CONFLICT COALESCE for expiry preservation | `grep "COALESCE" db/workspace.py ON CONFLICT` | NOT FOUND | FAIL (WR-01) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TMPL-01 | 100-01 through 100-06 | Upload docx/pptx/xlsx temporarily into a thread (workspace-only, TTL, RLS, never ingested, never in KB search) | PARTIAL | All 3 success criteria have implementation. SC#1 (upload, RLS) VERIFIED. SC#2 (never ingested/embedded/searchable) VERIFIED automated; live confirmation pending UAT row 2. SC#3 (expires via TTL + sweep, no longer retrievable) PARTIAL — read-path filter and sweep exist but WR-01/WR-02/WR-03 create retrievability gaps and a permanent-byte-leak mode. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/db/workspace.py` | ~41 | `kind = EXCLUDED.kind, expires_at = EXCLUDED.expires_at` (no COALESCE) | Warning (WR-01) | An agent `workspace_write` to a template's path NULLs `expires_at`, making the file permanent — the sweep never touches it, version 1 bytes persist forever. Contradicts the SC#3 ephemerality guarantee. |
| `backend/app/services/workspace_service.py` | ~12785 | `get_diff` calls `get_file_by_path` but never checks `file_row.get("is_expired")` | Warning (WR-02) | An expired-but-unswept template is still reachable via the `workspace_diff` agent tool. Row existence + version metadata leak; contradicts D-10 run-honesty and "hidden from ALL read paths" invariant. |
| `backend/app/services/template_service.py` | ~59 | `pool.execute("DELETE FROM workspace_files WHERE id = $1", file_id)` before `storage.remove` | Warning (WR-03) | Storage failure after row DELETE permanently orphans the user's template bytes — no future sweep can retry (row is gone). Not a correctness hole for access control, but violates the sweep's GC contract. |
| `backend/app/api/workspace.py` | ~161 | `raw = await file.read()` before size check | Info (WR-04) | Full request body buffered in memory before 10 MB check. DoS vector for authenticated users. Low-priority in current single-tenant dev context. |
| `backend/app/api/workspace.py` | ~165-166 | Filename sanitization only strips `/` and `\`; validate_path rejects common chars | Info (WR-05) | Real-world filenames like `Q3 Report (final).docx` produce a confusing "invalid path" 422. |
| `backend/tests/test_workspace_template.py` | ~141-285 | 7 of 10 phase tests are vacuous symbol-stubs (xpass without behavioral assertions) | Warning (WR-06) | Sweep row+bytes GC, run-pin GREATEST semantics, REST expiry exclusion, kind/TTL persistence, and cross-user isolation have zero automated behavioral coverage. The test suite passing is not meaningful evidence for these paths. |
| `frontend/src/components/panel/__tests__/FilesSection.test.tsx` | ~230-231 | `container.querySelector("svg")` returns the Upload button's SVG, not the file row icon | Info (WR-07) | Per-extension icon test is vacuous — passes even if `iconFor` regresses to generic FileIcon. |

### Human Verification Required

These items require operator execution against the live dev app (http://localhost:5173/).

#### 1. Upload Visible Readable (G-4 UAT row 1)

**Test:** Upload a real .docx file in the workspace panel's Files section.
**Expected:** Card appears with a "Template" badge and "expires in Nh" countdown caption. Agent `workspace_list` shows the file. Agent `workspace_read` returns a binary stub (not garbage UTF-8).
**Why human:** Lived-experience UI + live agent tool call in a real thread.

#### 2. Never-in-Search Proof (G-4 UAT row 2, SC#2)

**Test:** Upload a template containing the text `ZZ-TMPL-MARKER-100`. Then run agent `search_documents` for that string AND use any KB UI search.
**Expected:** The marker text MUST NOT appear in any results. The template is workspace-only.
**Why human:** Requires a live vector-store search to confirm no embedding/ingestion path was triggered.

#### 3. Expiry End-to-End (G-4 UAT row 3, SC#3)

**Test:** Insert a `workspace_files` row with `kind='template_input'` and `expires_at` in the near past (or set `template_ttl_hours` very low), then observe the panel and attempt agent reads. After the next sweep fires (or trigger it manually), inspect the DB and Storage bucket.
**Expected:** File vanishes from panel. Agent `workspace_read` returns "template expired". DB row gone. No Storage objects remaining for that file_id.
**Why human:** Requires wall-clock or DB manipulation plus Storage inspection.

#### 4. Bad-File Rejection (G-4 UAT row 4, D-12)

**Test:** Rename an `.exe` to `.docx` and attempt upload. Also try uploading a real PDF.
**Expected:** Clean visible error message in the panel (no opaque 422). Zero `workspace_files` rows created.
**Why human:** Browser file picker interaction required to observe the panel error surface.

#### 5. Run-Straddles-Expiry (G-4 UAT row 5, D-09)

**Test:** Upload a template, set its `expires_at` to be very soon (e.g. 2 minutes out), then immediately start a multi-phase workflow that would outlast that window.
**Expected:** The run-pin at kickoff extends `expires_at` via GREATEST. The workflow completes with no mid-flight "template expired" error.
**Why human:** Requires live timing of a multi-phase workflow run.

#### 6. Cross-User Isolation (G-4 UAT row 6, SC#1 RLS)

**Test:** Log in as a second user. Attempt to list, download, or access the first user's uploaded template via the API or UI.
**Expected:** All attempts return 404.
**Why human:** Requires two live browser sessions.

#### 7. No-Template Regression (G-4 UAT row 7, D-11)

**Test:** Verify that agent-written workspace files (NULL `expires_at`) list, read, and diff exactly as before Phase 100. Also run a workflow that has no uploaded template.
**Expected:** Zero behavioral change for NULL-expiry files. Templateless workflow runs byte-identically.
**Why human:** Requires live workflow execution with side-by-side behavioral comparison.

### Gaps Summary

Three code-review warnings from `100-REVIEW.md` undermine complete confidence in the SC#3 expiry guarantee. They do not prevent SC#1 (upload/RLS) or SC#2 (KB isolation) from being met, but they create partial holes in the "no longer retrievable after expiry" invariant:

**WR-01 (agent overwrite clears expiry):** If an agent ever writes a file to the exact path of an uploaded template, `ON CONFLICT DO UPDATE SET expires_at = EXCLUDED.expires_at` NULLs out the expiry. The file becomes permanent — the sweep ignores it, version 1 bytes persist forever. The fix is a two-line COALESCE in `db/workspace.py`'s ON CONFLICT clause. In current Phase 100 scope (the fill step is Phase 101), an agent overwriting a template path is unlikely but architecturally possible.

**WR-02 (workspace_diff leaks expired template metadata):** The asyncpg `get_diff` function in `workspace_service.py` calls `get_file_by_path` (which returns `is_expired`) but never acts on the flag. An expired-but-not-yet-swept template can still be diffed by the agent, leaking its version metadata and contradicting the "hidden from ALL read paths" invariant stated in D-06 and the phase guarantee. The REST diff route IS gated (4 REST gates confirmed). Only the asyncpg tool path is exposed.

**WR-03 (sweep byte-leak on Storage failure):** The sweep deletes the DB row before removing Storage objects. A transient Storage error after the DELETE permanently orphans the bytes — the deleted row is gone from the next sweep's SELECT. The fix is to reverse the order: remove Storage first, skip the row DELETE on failure, so the next sweep cadence retries cleanly. This is a correctness gap in the GC contract (bytes may accumulate unbounded on Storage errors), though it does not affect read-access control.

These three gaps are targeted — they do not require restructuring and each has a < 10 line fix. They are documented in `100-REVIEW.md` WR-01/WR-02/WR-03 with exact fix suggestions. Recommended: close WR-01/WR-02/WR-03 before proceeding to Phase 101 (which builds on the template_input kind and the expired-template error handling), then run the 7 G-4 human UAT rows.

---

_Verified: 2026-06-10T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
