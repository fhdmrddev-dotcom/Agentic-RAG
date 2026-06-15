---
phase: 100-ephemeral-template-upload
asvs_level: 1
block_on: high
audited: 2026-06-10
auditor: gsd-security-auditor (claude-sonnet-4-6)
threats_open: 0
status: SECURED
---

# Phase 100 Ephemeral Template Upload — Security Audit

**ASVS Level:** 1  
**Audit date:** 2026-06-10  
**Result: SECURED — 23/23 threats CLOSED, 0 open**

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-100-01-01 | Tampering | accept | CLOSED | Accepted risk: fixtures are in-memory stdlib `zipfile` ZIPs; never written to a real bucket. Verified: `conftest.py` OOXML fixtures use `io.BytesIO` + `zipfile.ZipFile` with no Supabase Storage call. |
| T-100-01-02 | Info Disclosure | mitigate | CLOSED | SC#2 structural guard (`test_workspace_files_not_in_ingestion`) verified GREEN. Confirmed: `extraction_service.py`, `retrieval_service.py`, `embedding_service.py`, `multimodal_service.py` — all 4 have 0 references to `workspace_files` (grep count = 0 each). |
| T-100-02-01 | Tampering | mitigate | CLOSED | `migrations/068_workspace_template_ephemeral.sql` lines 9-11: both columns `ADD COLUMN IF NOT EXISTS kind text` and `ADD COLUMN IF NOT EXISTS expires_at timestamptz` — no DEFAULT; `full-schema.sql:866` confirms `expires_at timestamp with time zone` nullable. Existing rows receive NULL/NULL (D-11 verified: SUMMARY.md reports pre-migration row count equals post-migration NULL/NULL count). |
| T-100-02-02 | Elevation of Privilege | mitigate | CLOSED | No new RLS policy needed — confirmed. `full-schema.sql:2457-2487` shows `workspace_files_select_own`, `workspace_files_insert_own`, `workspace_files_update_own`, `workspace_files_delete_own` policies each use `auth.uid() = (SELECT threads.user_id ...)` — row-level FK chain, covers new columns automatically. |
| T-100-02-03 | Info Disclosure | accept | CLOSED | Accepted risk: `app_settings.template_ttl_hours` is a non-secret global config integer. Verified: `full-schema.sql:304` — `template_ttl_hours integer DEFAULT 24` on the single global-row `app_settings` table. No per-user exposure surface. |
| T-100-03-01 | Info Disclosure | mitigate | CLOSED | `db/workspace.py:182-205`: `list_files_in_thread` adds `AND (expires_at IS NULL OR expires_at > now())` to BOTH the prefix and no-prefix branches. `workspace_service.py:333-338`: `read_file` checks `file_row.get("is_expired")` and raises `FileNotFoundError_("template expired")`. |
| T-100-03-02 | Tampering | mitigate | CLOSED | `workspace_service.py:224-225`: `write_file` signature has `kind: str | None = None, expires_at: datetime | None = None`. `db/workspace.py:19-20`: `upsert_workspace_file` also defaults both to `None`. Agent callers pass neither → NULL/NULL → gated filter treats NULL as never-expires (D-11). |
| T-100-03-03 | Spoofing | mitigate | CLOSED | `workspace_service.py:337-338`: `if file_row.get("is_expired"): raise FileNotFoundError_("template expired")`. The message is distinct from the generic `f"File not found: {path}"` at line 332 — the model can relay honestly. |
| T-100-03-04 | Tampering | mitigate | CLOSED | `workspace_service.py:43-55`: `_BINARY_MIME_PREFIXES` includes `"application/vnd.openxmlformats-officedocument"`. The binary-stub branch at lines 342-353 returns a metadata stub with `"is_binary": True` — OOXML bytes never decoded through the UTF-8 path. |
| T-100-04-01 | Spoofing/Tampering | mitigate | CLOSED | `api/workspace.py:117-144`: `validate_ooxml` implements: (1) `_ALLOWED_EXT` check on `.docx/.pptx/.xlsx`, (2) `zipfile.is_zipfile(bio)` End-of-Central-Directory validation, (3) `[Content_Types].xml` presence, (4) per-ext part marker (`word/`/`ppt/`/`xl/`). Raises `HTTPException(422)` on any failure before `write_file` is called. |
| T-100-04-02 | Info Disclosure | mitigate | CLOSED | `api/workspace.py:163`: `await _verify_thread_ownership(thread_id, current_user, supabase)` is the first call in `upload_template`. Uses 404-not-403 (existence-leak prevention). All 4 GET routes also call `_verify_thread_ownership` first (lines 234, 261, 341, 381). RLS FK-chain policies cover the SELECT path. |
| T-100-04-03 | Info Disclosure | mitigate | CLOSED | `api/workspace.py:264-278` (`get_workspace_file_content`): the row SELECT at line 265 includes `.or_("expires_at.is.null,expires_at.gt." + _now_iso())`. Signed URL is minted at line 299 — AFTER the `if not row: raise 404` check at line 274. An expired template's row reads as None → 404, no URL ever minted (Pitfall 2 closed). |
| T-100-04-04 | DoS | mitigate | CLOSED | `api/workspace.py:167-173`: `file.size` pre-check before `file.read()`, then `len(raw) == 0` empty check, then `len(raw) > MAX_FILE_SIZE` (10 MB) check — all return 422 before `write_file`. `validate_ooxml` (line 133) has a redundant size guard as defense-in-depth. |
| T-100-04-05 | Tampering (RAG poisoning) | mitigate | CLOSED | Upload path calls only `ws_write_file` (`workspace_service.write_file`) which writes to `workspace_files`. SC#2 guard confirms 0 references to `workspace_files` in `extraction_service.py`, `retrieval_service.py`, `embedding_service.py`, `multimodal_service.py`. Bytes stored opaque via asyncpg/Storage, never parsed for embedding. |
| T-100-05-01 | Elevation of Privilege | mitigate | CLOSED | `template_service.py:56-59`: `sweep_expired` SELECT is `WHERE expires_at IS NOT NULL AND expires_at <= now()` — only reads row IDs, never returns user content. Service-role client passed from `main.py` lifespan is used only for `storage.remove([sp])` (line 72), scoped to the specific storage path of the expired file. |
| T-100-05-02 | DoS | mitigate | CLOSED | `template_service.py:63-65`: `get_storage_paths_for_file(pool, file_id)` collects ALL version+file Storage paths BEFORE deletion (Pitfall 3). WR-03 fix: Storage remove is done FIRST (lines 69-81), row DELETE LAST (line 83). On Storage failure the row is kept (`continue` at line 81) → next sweep cadence retries. |
| T-100-05-03 | DoS | mitigate | CLOSED | `template_service.py:115-132`: `run_cap_seconds(definition)` sums per-phase `wall_clock_seconds` (or 3600 default) across all phases + 600s margin. `template_service.py:102-106`: `pin_templates_for_run` uses `GREATEST(expires_at, now() + cap)` — never shortens (D-08 preserved). |
| T-100-05-04 | Tampering | mitigate | CLOSED | `template_service.py:104-106`: `WHERE thread_id = $1 AND kind = 'template_input' AND expires_at IS NOT NULL` — the double guard on `kind` and `expires_at IS NOT NULL` ensures agent/NULL-expiry rows are never matched by the pin UPDATE. |
| T-100-05-05 | Spoofing | mitigate | CLOSED | `workspace_service.py:437-442`: `get_diff` checks `file_row.get("is_expired")` and raises `FileNotFoundError_("template expired")` — the same D-10 honest-error added for `read_file` (WR-02 fix confirmed in the post-review-fix code). `tool_dispatcher.py:1045,1081,1110,1128,1155`: 5 `except WorkspaceError as e: return ToolResult(result=json.dumps({"error": str(e)}))` surfaces carry the message through to the model. |
| T-100-05-06 | Tampering | mitigate | CLOSED | `threads.py:977`: one `await _template_service.pin_templates_for_run(...)` call with no inline query/Storage/GREATEST literal. Grep for `GREATEST` in `threads.py` returns 0 matches; grep for `UPDATE workspace_files` in `threads.py` returns 0 matches. All logic lives in `template_service.py`. |
| T-100-06-01 | Tampering | mitigate | CLOSED | `TemplateUpload.tsx:53`: `accept=".docx,.pptx,.xlsx"` is explicitly a UX hint. `api/workspace.py:117-144`: `validate_ooxml` is the server-side gate — it validates extension allowlist + zipfile End-of-Central-Directory + `[Content_Types].xml` + per-ext part marker regardless of what the client claims. |
| T-100-06-02 | Info Disclosure | mitigate | CLOSED | `FilesSection.tsx` has 0 occurrences of `dangerouslySetInnerHTML`. Filename/path renders as React text children (standard JSX text interpolation — auto-escaped). Upload error detail also renders as text-child, not as raw HTML. |
| T-100-06-03 | Spoofing | accept | CLOSED | Accepted risk: the countdown is a UI hint. Server-side authoritative path confirmed: both asyncpg (`list_files_in_thread` with `expires_at IS NULL OR expires_at > now()`) and supabase-py (4 REST routes with `.or_("expires_at.is.null,expires_at.gt."+_now_iso())`) filter expired rows. A stale caption never grants access; the file vanishes on the next reconcile/refetch (D-03). |

---

## Accepted Risks Log

| Threat ID | Rationale | Evidence |
|-----------|-----------|----------|
| T-100-01-01 | OOXML test fixtures are stdlib in-memory ZIPs built with `io.BytesIO`; they are never written to a real Supabase Storage bucket or DB row. No untrusted bytes involved. | `backend/tests/conftest.py`: `_make_ooxml` uses `zipfile.ZipFile(bio, "w", ...)` where `bio = io.BytesIO()`. |
| T-100-02-03 | `app_settings.template_ttl_hours` is a non-sensitive global configuration integer (default 24). The `app_settings` table holds a single global row; no per-user data is exposed by this column. | `full-schema.sql:304`: `template_ttl_hours integer DEFAULT 24` with no per-row or per-user scoping. |
| T-100-06-03 | The client-side countdown is an informational UX hint only. Stale caption cannot grant access because all server read paths (asyncpg tool path + 4 REST GET routes) independently enforce the expiry filter. An expired file disappears from the panel on the next reconcile/refetch (D-03). | `workspace_service.py:333-338` (read_file is_expired guard); `db/workspace.py:189,201` (list_files_in_thread gated WHERE); `api/workspace.py:240,270,348,388` (4 REST `.or_` expiry gates). |

---

## Unregistered Flags

None. All threat flags reported in SUMMARY.md `## Threat Surface Scan` sections for Plans 01-06 map directly to registered threat IDs in the threat register:

- Plan 01 SUMMARY flags: T-100-01-01, T-100-01-02 → both registered, both CLOSED
- Plan 02 SUMMARY flags: T-100-02-01, T-100-02-02, T-100-02-03 → all registered, all CLOSED
- Plan 03 SUMMARY flags: T-100-03-01 through T-100-03-04 → all registered, all CLOSED
- Plan 04 SUMMARY flags: T-100-04-01 through T-100-04-05 → all registered, all CLOSED
- Plan 05 SUMMARY flags: T-100-05-01 through T-100-05-06 → all registered, all CLOSED
- Plan 06 SUMMARY flags: T-100-06-01, T-100-06-02, T-100-06-03 → all registered, all CLOSED

**Post-implementation fixes verified (WR-01/WR-02/WR-03 from 100-VERIFICATION.md):**

These were gaps found during verification and closed by `/gsd:code-review-fix` before this audit. The audit confirms the fixes are present:

- WR-01 (ON CONFLICT COALESCE): `db/workspace.py:48-49` — `kind = COALESCE(EXCLUDED.kind, workspace_files.kind), expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at)`. Confirmed present.
- WR-02 (get_diff is_expired check): `workspace_service.py:438-442` — `if file_row.get("is_expired"): raise FileNotFoundError_("template expired")`. Confirmed present.
- WR-03 (bytes-first sweep order): `template_service.py:68-81` — Storage remove loop runs FIRST with `failed = True` on any exception; row DELETE at line 83 is only reached if `failed` is False. Confirmed present.

---

*Audited: 2026-06-10*  
*Auditor: gsd-security-auditor*  
*Implementation files: READ-ONLY — no patches applied*
