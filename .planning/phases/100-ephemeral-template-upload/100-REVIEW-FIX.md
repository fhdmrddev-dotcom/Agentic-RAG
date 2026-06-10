---
phase: 100-ephemeral-template-upload
fixed_at: 2026-06-10T16:56:00Z
review_path: .planning/phases/100-ephemeral-template-upload/100-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 100: Code Review Fix Report

**Fixed at:** 2026-06-10T16:56:00Z
**Source review:** .planning/phases/100-ephemeral-template-upload/100-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (fix_scope: critical_warning — all 8 Warnings; 0 Critical)
- Fixed: 8
- Skipped: 0

**Gates after fixes:**
- Backend: `pytest tests/test_workspace_template.py tests/unit/test_workspace_api.py tests/unit/test_tool_dispatcher.py -q` → **37 passed, 0 failures** (previously 27 passed + 10 xpassed — the 10 xfail stubs are now real behavioral tests)
- Frontend: `npx vitest run src/components/panel/__tests__/FilesSection.test.tsx` → **11 passed** (unchanged count, one assertion strengthened)
- `npx tsc --noEmit` reports no errors in `frontend/src/lib/api.ts` (pre-existing errors in other files untouched)

## Fixed Issues

### WR-01: Agent overwrite of a template path silently clears `kind`/`expires_at`

**Files modified:** `backend/app/db/workspace.py`
**Commit:** 055f0f5b
**Applied fix:** ON CONFLICT now uses `kind = COALESCE(EXCLUDED.kind, workspace_files.kind)` and `expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at)`. D-11 agent-path verified byte-identical: fresh agent insert takes the VALUES path (NULL/NULL), agent-over-agent overwrite is `COALESCE(NULL, NULL) = NULL`, template re-upload's non-NULL EXCLUDED values still win. Only the agent-overwrites-template case changes — the template lifecycle survives, so the row still expires and the sweep still GCs it. Pinned by the upgraded `test_agent_files_unchanged` (asserts NULL args AND the COALESCE clauses in the recorded upsert SQL).

### WR-02: `workspace_diff` tool path not gated on expiry

**Files modified:** `backend/app/services/workspace_service.py`
**Commit:** d48ac96a
**Applied fix:** `get_diff` now mirrors the `read_file` gate — `if file_row.get("is_expired"): raise FileNotFoundError_("template expired")` immediately after the not-found check. The message flows through the existing `except WorkspaceError` surface in `_handle_workspace_diff` (`tool_dispatcher.py`), so the agent receives the honest D-10 error instead of a row-existence leak. (`delete_file` left ungated per the review — deleting an expired row is GC-friendly.)

### WR-03: Sweep deletes the DB row before removing Storage bytes (permanent leak on remove failure)

**Files modified:** `backend/app/services/template_service.py`
**Commit:** bf6a0b19
**Applied fix:** Reversed the order per the review: gather paths → remove Storage objects → only if ALL removes succeeded, DELETE the row. On any remove failure the row is kept (`continue`), so the next ~15-min sweep's SELECT finds it again and retries both halves — self-healing. Idempotency preserved (already-gone Storage object is a no-op remove; the DELETE rowcount check still skips sibling-worker races). The block rewrite also replaced the brittle `res.endswith("0")` with `res.split()[-1] == "0"` (IN-01, incidental — same lines). Pinned by the upgraded `test_sweep_deletes_rows_and_bytes` (happy path, idempotent no-op, and remove-fails→row-kept).

### WR-04: Upload route buffers the entire request body before the 10 MB check

**Files modified:** `backend/app/api/workspace.py`
**Commit:** 6b122ab9
**Applied fix:** Added `if file.size is not None and file.size > MAX_FILE_SIZE: raise HTTPException(422, ...)` BEFORE `await file.read()`; kept the post-read `len(raw)` check as fallback for a None size. Replaced the hardcoded `10 * 1024 * 1024` with `MAX_FILE_SIZE` imported from `workspace_service` (IN-03, incidental — same lines). Also added the size guard inside `validate_ooxml` as defense-in-depth, which made the phase's `test_oversized_rejected` contract test genuinely pass (needed for WR-06's xfail removal).

### WR-05: Common real-world filenames rejected with a confusing "invalid path" 422

**Files modified:** `backend/app/api/workspace.py`
**Commit:** ab24c9e0
**Applied fix:** Sanitized the filename to `validate_path`'s charset before building the path: `re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)` then collapse `..` runs and strip, with `template{ext}` fallback. Probe-verified against the review's examples: `Q3 Report (final).docx`, `P&L 2026.xlsx`, `Übersicht.docx`, `report..v2.docx` (plus `...` and whitespace-only) all now pass `validate_path`.

### WR-06: Most TDD contract tests are vacuous symbol-existence stubs

**Files modified:** `backend/tests/test_workspace_template.py`
**Commit:** 7e255c09
**Applied fix:** All 7 vacuous stubs upgraded to behavioral tests using ONLY the existing conftest fakes (per constraint):
- `test_upload_sets_kind_and_ttl` — drives `write_file` via `mock_asyncpg_pool`; asserts the upsert args carry `kind='template_input'` + the expiry and the returned dict echoes them.
- `test_agent_files_unchanged` — agent write → NULL/NULL args + WR-01 COALESCE clauses pinned in the recorded SQL (D-11 RED LINE).
- `test_expired_excluded_rest` — TestClient + shared supabase mock; pins the `expires_at.is.null,expires_at.gt.<now>` gate ON the wire for the list route, and that the content route 404s (no signed URL) when the gated row SELECT returns empty.
- `test_cross_user_isolation` — non-owner thread → 404 on list/content/versions/diff (ownership gate wired on every route).
- `test_sweep_deletes_rows_and_bytes` — `mock_asyncpg_pool` + spy Storage: remove-then-delete happy path, idempotent empty second run, and the WR-03 remove-fails→row-kept retry contract.
- `test_run_pin_extends_and_noop` — pins GREATEST + the `kind='template_input' AND expires_at IS NOT NULL` scoping + the `UPDATE 0` no-op return.
- `test_existing_rows_valid` — strengthened migration-068 contract (nullable ADDs, NULL-allowing CHECK, no NOT NULL backfill).
All 10 `xfail(strict=False)` markers dropped (including the 3 OOXML validator tests, which now run hard-green). Module docstring updated. Gate: 37 passed, 0 xfail/xpass.

### WR-07: Per-extension icon test asserts against the Upload button's SVG

**Files modified:** `frontend/src/components/panel/__tests__/FilesSection.test.tsx`
**Commit:** 924b1f5a
**Applied fix:** Query scoped to the row per the review: `screen.getByRole("option")` → `row.querySelector("svg")`, asserting `lucide-file-text` is present (docx → FileText) AND `lucide-file` absent. Verified green live (the D-02 contract is now actually pinned).

### WR-08: Upload response shape (`file_id`) doesn't match `WorkspaceFile` (`id`)

**Files modified:** `frontend/src/lib/api.ts`
**Commit:** 2626ce62
**Applied fix:** `uploadWorkspaceTemplate` now maps at the API boundary: `const row = (await res.json()) as WorkspaceFile & { file_id?: string }; return { ...row, id: row.id ?? row.file_id }`. Frontend-only fix chosen (review's primary suggestion) — no backend route change, keeping the G-5-adjacent surface untouched.

## Skipped Issues

None — all 8 in-scope findings fixed.

## Notes

- **Info findings (out of scope, fix_scope=critical_warning):** IN-01 and IN-03 were incidentally resolved because the WR-03/WR-04 rewrites touched the exact same lines. IN-02, IN-04, IN-05, IN-06 remain open as documented review notes.
- **G-5 constraint respected:** `backend/app/api/threads.py` was NOT touched (no in-scope finding required it; IN-06 is Info/out of scope).
- **D-11 byte-identical constraint verified:** the WR-01 COALESCE is a literal no-op for NULL-kind/NULL-expiry agent rows (insert path unaffected; NULL-over-NULL stays NULL); pinned by `test_agent_files_unchanged`.
- No fixes flagged `requires human verification` — none of the findings were logic-classified; all are structural/gating changes with behavioral test coverage. Live G-4 UAT rows in 100-VALIDATION.md remain the manual backstop.

---

_Fixed: 2026-06-10T16:56:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
