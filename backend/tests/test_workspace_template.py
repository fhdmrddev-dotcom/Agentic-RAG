"""Phase 100 — ephemeral template upload (TMPL-01).

This is the cross-plan TDD contract for the ephemeral-template behavior. It is the
single test file the 100-VALIDATION.md per-task verification map points at: every
downstream Plan 100-0X `<verify>` command runs a `-k` slice of THIS file.

  GREEN from THIS plan (Plan 01 — no new app code needed):
    - test_workspace_files_not_in_ingestion — the SC#2 structural-isolation guard.
      A static source scan proving no ingestion / embedding / retrieval module
      references `workspace_files` — workspace template files are NEVER ingested,
      embedded, or retrieved (that is the whole point of "ephemeral, not part of
      the KB"). Passes live now (the isolation is already true; this test pins it).

  RED-by-design until the implementing plan lands (cross-plan TDD); each asserts
  the TARGET behavior and is marked `xfail(strict=False)` so the full suite stays
  exit-0 in the interim — the 098/099 convention
  (test_099_skill_composition.py:14-21). Imports of not-yet-created symbols live
  INSIDE the test body so the ImportError surfaces as an xfail, not a collection
  error.

    Plan 100-02 (migration 068 — nullable kind/expires_at + index + TTL setting):
      - test_existing_rows_valid          — pre-068 rows (NULL kind / NULL
        expires_at) still validate; the CHECK allows NULL (zero-migration /
        byte-identical for agent files).

    Plan 100-03 (asyncpg read seams gated + write_file persists kind/ttl + D-10
                 expired tool-read error):
      - test_upload_sets_kind_and_ttl     — a template upload sets
        kind='template_input' + expires_at ~= now + TTL.
      - test_expired_tool_read_errors     — an expired template read via the
        asyncpg tool path returns the "template expired" error (D-10).
      - test_agent_files_unchanged        — NULL-expiry (agent) files list / read
        / diff byte-identical (the D-11 RED LINE — templates optional everywhere).

    Plan 100-04 (validate_ooxml magic-byte gate + REST routes gated + TTL from
                 app_settings):
      - test_valid_ooxml_accepted         — validate_ooxml accepts a real
        docx/pptx/xlsx and returns the canonical extension.
      - test_bad_file_rejected            — a renamed binary -> HTTPException(422),
        no workspace_files row.
      - test_oversized_rejected           — oversized OOXML -> HTTPException(422).
      - test_expired_excluded_rest        — an expired row is absent from the REST
        list + content responses (the signed-URL bypass is closed).
      - test_cross_user_isolation         — a second user's list / content / download
        of the first user's template all 404 (RLS half of SC#1).

    Plan 100-05 (in-process sweep janitor + kickoff run-pin):
      - test_sweep_deletes_rows_and_bytes — the sweep removes expired rows AND all
        version Storage paths; idempotent on a second run.
      - test_run_pin_extends_and_noop     — a run pin extends expires_at (GREATEST);
        no-op when the thread has no template_input row.

Post-review upgrade (100-REVIEW WR-06): the implementing plans (100-02..100-06)
have ALL landed, so the RED-by-design symbol-existence stubs in this file were
upgraded to BEHAVIORAL tests against the offline seams (the conftest
``mock_asyncpg_pool`` recorder, the shared supabase mock + TestClient, and the
pure ``validate_ooxml``) and every ``xfail(strict=False)`` marker was dropped —
a silent XPASS can no longer mask a regression. Offline-friendly: no live DB /
Storage needed. The cross-provider / live UAT half stays MANUAL
(100-VALIDATION.md "Manual-Only Verifications" — all 7 G-4 rows).
"""

from __future__ import annotations

import pathlib

import pytest

# ── SC#2 structural-isolation guard (GREEN this plan — no new app code) ────────


def test_workspace_files_not_in_ingestion():
    """SC#2 — workspace_files is NEVER referenced by the ingestion / embedding /
    retrieval pipeline. Templates live in the per-thread workspace, never in the
    knowledge base, so a distinctive marker inside a template can never surface in
    `search_documents` / KB search. This static source scan pins that invariant:
    if a future change wires a workspace-file read into the ingestion path, this
    test goes RED.
    """
    services = pathlib.Path(__file__).resolve().parents[1] / "app" / "services"
    # The modules that own the ingestion -> embedding -> retrieval pipeline (and
    # anything that populates document_chunks). If any of these grows a
    # `workspace_files` reference, the template-isolation contract is broken.
    candidates = (
        "extraction_service.py",
        "retrieval_service.py",
        "embedding_service.py",
        "multimodal_service.py",
    )
    offenders = []
    for fname in candidates:
        f = services / fname
        if f.exists() and "workspace_files" in f.read_text(encoding="utf-8"):
            offenders.append(fname)
    assert not offenders, (
        f"{offenders} must never reference workspace_files (SC#2 isolation — "
        "templates are ephemeral, never ingested/embedded/retrieved)"
    )


# ── Plan 100-04 — OOXML magic-byte validator (validate_ooxml) ──────────────────


def test_valid_ooxml_accepted(valid_docx_bytes, valid_pptx_bytes, valid_xlsx_bytes):
    """validate_ooxml accepts a real docx/pptx/xlsx and returns its canonical
    extension (the magic-byte allowlist — D-12)."""
    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    assert validate_ooxml("report.docx", valid_docx_bytes) == ".docx"
    assert validate_ooxml("deck.pptx", valid_pptx_bytes) == ".pptx"
    assert validate_ooxml("sheet.xlsx", valid_xlsx_bytes) == ".xlsx"


def test_bad_file_rejected(renamed_binary_bytes):
    """A renamed binary (fake .docx that is not a ZIP) is rejected with
    HTTPException(422); no workspace_files row is created (D-12)."""
    from fastapi import HTTPException

    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    with pytest.raises(HTTPException) as exc:
        validate_ooxml("malware.docx", renamed_binary_bytes)
    assert exc.value.status_code == 422


def test_oversized_rejected(oversized_ooxml_bytes):
    """An OOXML container padded past the 10 MB size limit is rejected 422 even
    though its magic bytes are valid (validate_ooxml's defense-in-depth size
    guard — the route also pre-checks file.size before buffering, WR-04)."""
    from fastapi import HTTPException

    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    with pytest.raises(HTTPException) as exc:
        validate_ooxml("huge.docx", oversized_ooxml_bytes)
    assert exc.value.status_code == 422


# ── Plan 100-03 — write_file persists kind + TTL; D-10 expired tool read ───────


async def test_upload_sets_kind_and_ttl(mock_asyncpg_pool):
    """A template upload persists kind='template_input' and expires_at on the
    workspace_files row (D-05 / D-06). Behavioral: drive ``write_file`` (the seam
    ``upload_template`` delegates to with exactly these kwargs) against the
    recording pool and assert the upsert args carry the kind + expiry AND the
    returned dict echoes them."""
    import uuid as _uuid
    from datetime import datetime, timedelta, timezone
    from unittest.mock import MagicMock

    from app.services.workspace_service import write_file

    pool = mock_asyncpg_pool
    fid = _uuid.uuid4()
    pool.set_fetchrow_result({"id": fid, "is_new": True})  # upsert RETURNING
    pool.set_fetchval_result(1)  # get_next_version -> 1; count_files_in_thread -> 1

    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    result = await write_file(
        pool, MagicMock(),
        thread_id=_uuid.uuid4(), user_id=_uuid.uuid4(),
        path="/a1b2c3d4-report.docx", content=b"PK-fake-template-bytes",
        kind="template_input", expires_at=expires,
    )

    assert result["kind"] == "template_input"
    assert result["expires_at"] == expires.isoformat()

    upsert_sql, upsert_args = next(
        (sql, args) for sql, args in pool.calls
        if "ON CONFLICT (thread_id, path)" in sql
    )
    # VALUES ($1..$9): thread_id, path, size, mime, inline, storage, created_by,
    #                  kind, expires_at
    assert upsert_args[7] == "template_input"
    assert upsert_args[8] == expires


async def test_expired_tool_read_errors():
    """D-10 (Plan 100-05 Task 3): an expired template read via the asyncpg tool path
    (workspace_read) surfaces the literal "template expired" error rather than the
    file bytes — run-honesty, NOT a generic not-found.

    ``read_file`` (Plan 100-03) raises ``FileNotFoundError_("template expired")`` on
    ``is_expired``. ``FileNotFoundError_`` subclasses ``WorkspaceError``, so the
    message flows through the EXISTING ``except WorkspaceError as e: return
    ToolResult(result=json.dumps({"error": str(e)}))`` surface in
    ``_handle_workspace_read`` — NO new branch needed. This test pins that the
    literal "template expired" reaches the ToolResult JSON intact (the message is
    not swallowed/reshaped into a generic "File not found")."""
    import json
    from unittest.mock import AsyncMock, patch

    from app.services.tool_dispatcher import _handle_workspace_read, ToolContext
    from app.services.workspace_service import FileNotFoundError_

    async def _fake_read_expired(pool, supabase, *, thread_id, path, start_line, end_line):
        # Exactly what read_file raises on an is_expired row (Plan 100-03 D-10).
        raise FileNotFoundError_("template expired")

    ctx = ToolContext(
        redis=None, run_id=None, thread_id="00000000-0000-0000-0000-000000000001",
        supabase=None, pool="fake_pool", user_settings=None,
        current_user={"id": "u"}, folder_subtree_ids=None,
        scoped_folder_path=None, emit=AsyncMock(), spawn=lambda c: None,
    )
    with patch(
        "app.services.tool_dispatcher.ws_read_file",
        side_effect=_fake_read_expired,
    ):
        result = await _handle_workspace_read({"path": "/template.docx"}, ctx)

    payload = json.loads(result.result)
    assert payload["error"] == "template expired", (
        "D-10: the expired-template tool read must surface the literal "
        f"'template expired' (got {payload!r}) — not a generic not-found."
    )


async def test_agent_files_unchanged(mock_asyncpg_pool):
    """The D-11 RED LINE: an agent write passes kind=None / expires_at=None
    (NULL/NULL on the row — the gated read seams are a literal no-op), AND the
    upsert's ON CONFLICT COALESCE (WR-01, 100-REVIEW) means an agent overwrite of
    a template path can never CLEAR the template lifecycle — which would make the
    original template bytes permanent and bypass the ephemeral guarantee."""
    import uuid as _uuid
    from unittest.mock import MagicMock

    from app.services.workspace_service import write_file

    pool = mock_asyncpg_pool
    fid = _uuid.uuid4()
    pool.set_fetchrow_result({"id": fid, "is_new": True})
    pool.set_fetchval_result(1)

    result = await write_file(
        pool, MagicMock(),
        thread_id=_uuid.uuid4(), user_id=_uuid.uuid4(),
        path="/notes.md", content=b"agent-written content",
        # NO kind / expires_at — the agent caller signature, unchanged from 084
    )

    assert result["kind"] is None
    assert result["expires_at"] is None

    upsert_sql, upsert_args = next(
        (sql, args) for sql, args in pool.calls
        if "ON CONFLICT (thread_id, path)" in sql
    )
    assert upsert_args[7] is None       # kind   -> NULL on the row
    assert upsert_args[8] is None       # expiry -> NULL (never expires)
    # WR-01: agent NULLs must not clobber a template row's lifecycle on overwrite
    # (COALESCE keeps the stored kind/expires_at; NULL-over-NULL stays NULL).
    assert "kind = COALESCE(EXCLUDED.kind, workspace_files.kind)" in upsert_sql
    assert (
        "expires_at = COALESCE(EXCLUDED.expires_at, workspace_files.expires_at)"
        in upsert_sql
    )


# ── Plan 100-04 — REST routes gated (expired excluded) + cross-user RLS ────────


def test_expired_excluded_rest(client, mock_builder, mock_execute_result):
    """D-06: the REST read routes carry the PostgREST expiry gate
    (``expires_at.is.null,expires_at.gt.<now>``) and a row the gate filters out
    reads as ABSENT -> /content 404s BEFORE any signed URL is minted (Pitfall 2 —
    the signed-URL bypass stays closed). The supabase mock cannot evaluate the
    filter server-side, so this pins (a) the gate is ON the wire for the list
    route and (b) the content route 404s when the gated row SELECT comes back
    empty — exactly what PostgREST returns for an expired row."""
    from unittest.mock import MagicMock

    tid = "00000000-0000-0000-0000-000000000001"

    # (a) list route applies the expiry gate on the wire
    mock_execute_result.data = [{"id": "row-1", "path": "/t.docx"}]
    r = client.get(f"/threads/{tid}/workspace/files")
    assert r.status_code == 200
    assert any(
        c.args and str(c.args[0]).startswith("expires_at.is.null,expires_at.gt.")
        for c in mock_builder.or_.call_args_list
    ), "list route must apply the expires_at PostgREST gate (D-06)"

    # (b) content route: ownership passes, the GATED row SELECT returns nothing
    # (an expired row through the filter) -> 404, no signed URL ever minted.
    own = MagicMock()
    own.data = {"id": tid}
    gone = MagicMock()
    gone.data = None
    mock_builder.or_.reset_mock()
    mock_builder.execute.side_effect = [own, gone]
    r2 = client.get(f"/threads/{tid}/workspace/files/file-1/content")
    assert r2.status_code == 404
    assert any(
        c.args and str(c.args[0]).startswith("expires_at.is.null,expires_at.gt.")
        for c in mock_builder.or_.call_args_list
    ), "content route must apply the expires_at gate before minting any URL"


def test_cross_user_isolation(client, mock_execute_result):
    """SC#1 (RLS half): ``_verify_thread_ownership`` scopes the thread lookup by
    the CALLER's user_id, so a thread the caller does not own reads as absent ->
    EVERY workspace read route 404s (existence-leak-safe, D-062-12) before any
    file row / content / version / diff is touched."""
    tid = "00000000-0000-0000-0000-00000000dead"
    mock_execute_result.data = None  # ownership lookup: no row for this user_id

    assert client.get(f"/threads/{tid}/workspace/files").status_code == 404
    assert client.get(f"/threads/{tid}/workspace/files/f1/content").status_code == 404
    assert client.get(f"/threads/{tid}/workspace/files/f1/versions").status_code == 404
    assert (
        client.get(f"/threads/{tid}/workspace/files/f1/diff?from=1&to=2").status_code
        == 404
    )


# ── Plan 100-05 — sweep janitor + kickoff run-pin ──────────────────────────────


async def test_sweep_deletes_rows_and_bytes(mock_asyncpg_pool):
    """D-07: the sweep removes every Storage version object FIRST, then DELETEs
    the row (WR-03 ordering, 100-REVIEW — a failed Storage remove keeps the row
    so the NEXT sweep retries both halves; deleting the row first orphaned the
    bytes permanently). A sweep with nothing expired is a no-op (idempotent)."""
    import uuid as _uuid
    from unittest.mock import MagicMock

    from app.services.template_service import sweep_expired_templates

    pool = mock_asyncpg_pool
    fid = _uuid.uuid4()
    supabase = MagicMock()
    bucket = supabase.storage.from_.return_value

    # Happy path: 1 expired row with 1 Storage object -> remove + DELETE, count 1.
    pool.set_fetch_results([
        [{"id": fid}],                            # expired-rows SELECT
        [{"content_storage_path": "u/t/f/v1"}],   # get_storage_paths_for_file
    ])
    assert await sweep_expired_templates(pool, supabase) == 1
    bucket.remove.assert_called_once_with(["u/t/f/v1"])
    assert any("DELETE FROM workspace_files" in sql for sql, _ in pool.calls)

    # Idempotent second run: nothing expired -> no remove, no DELETE.
    pool.calls.clear()
    bucket.remove.reset_mock()
    pool.set_fetch_results([[]])
    assert await sweep_expired_templates(pool, supabase) == 0
    bucket.remove.assert_not_called()
    assert not any("DELETE FROM workspace_files" in sql for sql, _ in pool.calls)

    # WR-03: Storage remove FAILS -> the row is NOT deleted (it stays in the next
    # sweep's SELECT so the whole operation self-heals on the next cadence).
    pool.calls.clear()
    pool.set_fetch_results([
        [{"id": fid}],
        [{"content_storage_path": "u/t/f/v1"}],
    ])
    bucket.remove.side_effect = Exception("storage transiently down")
    assert await sweep_expired_templates(pool, supabase) == 0
    assert not any("DELETE FROM workspace_files" in sql for sql, _ in pool.calls)


async def test_run_pin_extends_and_noop(mock_asyncpg_pool):
    """D-09: the kickoff pin extends expires_at via GREATEST (extend-only — D-08
    fixed-from-upload preserved) and is scoped to ``kind = 'template_input' AND
    expires_at IS NOT NULL`` so an agent/NULL-expiry row can NEVER acquire an
    expiry via the pin; a templateless thread -> 0 rows -> literal no-op (D-11).
    The pin is a thin seam — no inline logic in threads.py (G-5)."""
    import uuid as _uuid

    from app.services.template_service import pin_templates_for_run

    pool = mock_asyncpg_pool
    pool.set_execute_result("UPDATE 1")
    pinned = await pin_templates_for_run(
        pool, thread_id=_uuid.uuid4(), run_wall_clock_cap=4200
    )
    assert pinned == 1
    sql, args = pool.calls[-1]
    assert "GREATEST(expires_at" in sql                  # extend-only (D-08)
    assert "kind = 'template_input'" in sql              # template rows only
    assert "expires_at IS NOT NULL" in sql               # agent rows unreachable
    assert args[1] == "4200"                             # the run wall-clock cap

    pool.set_execute_result("UPDATE 0")                  # templateless thread
    assert (
        await pin_templates_for_run(
            pool, thread_id=_uuid.uuid4(), run_wall_clock_cap=60
        )
        == 0
    )


# ── Plan 100-02 — migration 068 smoke (NULL kind/expires_at still valid) ───────


def test_existing_rows_valid():
    """Migration 068 keeps every pre-068 (agent) workspace_files row valid: both
    new columns are nullable ADDs with NO default/backfill, and the kind CHECK
    explicitly allows NULL (Pitfall 6) — zero-migration / byte-identical (D-11).

    Static contract on the migration file (the live-DB apply happens via the
    Supabase SQL editor per the CLAUDE.md migration rule)."""
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    migration = repo_root / "supabase" / "migrations" / "068_workspace_template_ephemeral.sql"
    assert migration.exists(), "migration 068 not yet authored (Plan 100-02)"
    sql = migration.read_text(encoding="utf-8")
    # Nullable column ADDs (no default, no backfill).
    assert "ADD COLUMN IF NOT EXISTS kind text" in sql
    assert "ADD COLUMN IF NOT EXISTS expires_at timestamptz" in sql
    # The CHECK must allow NULL or existing rows would become invalid (Pitfall 6).
    assert "kind IS NULL OR" in sql
    # No NOT NULL constraint sneaks onto the new columns (the partial index's
    # `WHERE expires_at IS NOT NULL` is the only legitimate NOT-NULL in the file).
    assert "NOT NULL" not in sql.replace("IS NOT NULL", "")


# ── Phase 101.1-09 (gap 3) — raw-bytes download route ──────────────────────────

# The conftest TestClient caller (mirrors conftest.mock_user_data); used by the
# direct-call route tests below so an owned-thread row passes the ownership check.
mock_user_data = {"id": "00000000-0000-0000-0000-000000000001", "email": "test@example.com"}


def test_safe_download_filename_strips_header_injection():
    """The Content-Disposition filename comes from a tool-written path, so any
    CR/LF/quote must be neutralized — no header-splitting out of the attachment
    value (101.1-09 T-101.1-09-01 hardening, defense-in-depth)."""
    from app.api.workspace import _safe_download_filename

    # basename only; CR/LF/quote/semicolon replaced; ordinary names preserved.
    assert _safe_download_filename("/risk-register.docx") == "risk-register.docx"
    assert _safe_download_filename("/a/b/deliverable.pptx") == "deliverable.pptx"
    out = _safe_download_filename('/evil"\r\nSet-Cookie: x.docx')
    assert "\r" not in out and "\n" not in out and '"' not in out
    # An all-illegal / empty basename never yields an empty header value.
    assert _safe_download_filename("/") == "download"


def test_raw_route_cross_user_404(client, mock_execute_result):
    """SC#1 (RLS half): a non-owner's raw download 404s at _verify_thread_ownership
    BEFORE any pg-pool read — existence-leak-safe (D-062-12)."""
    tid = "00000000-0000-0000-0000-00000000dead"
    mock_execute_result.data = None  # ownership lookup: no row for this user_id
    assert client.get(f"/threads/{tid}/workspace/files/f1/raw").status_code == 404


async def test_raw_route_returns_exact_inline_bytes(monkeypatch):
    """An owned INLINE binary file's raw route returns the EXACT bytes with a
    binary content-type + an attachment Content-Disposition (the gap-3 fix — a
    37 KB docx is stored inline, so its bytes are not reachable via /content which
    str-decodes them). Bytes come from the pg pool (asyncpg returns raw bytes)."""
    import app.api.workspace as ws

    tid = mock_user_data["id"]  # the conftest caller owns a thread with this id-shape
    fid = "11111111-1111-1111-1111-111111111111"
    docx_bytes = b"PK\x03\x04\x00\x00binary-zip-\x00-bytes"

    async def _noop_ownership(thread_id, current_user, supabase):
        return None  # owner — passes

    async def _fake_get_pool():
        return object()

    async def _fake_get_file_by_id(pool, file_id):
        return {
            "id": fid,
            "thread_id": tid,
            "path": "/risk-register.docx",
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "content_inline": docx_bytes,
            "content_storage_path": None,
            "is_expired": False,
        }

    async def _fake_get_content(pool, supabase, row):
        return row["content_inline"]

    monkeypatch.setattr(ws, "_verify_thread_ownership", _noop_ownership)
    monkeypatch.setattr(ws, "get_pg_pool", _fake_get_pool)
    monkeypatch.setattr(ws, "get_file_by_id", _fake_get_file_by_id)
    monkeypatch.setattr(ws, "_get_file_content", _fake_get_content)

    resp = await ws.download_workspace_file_raw(
        thread_id=tid, file_id=fid, current_user=mock_user_data, supabase=object()
    )
    assert resp.status_code == 200
    assert resp.body == docx_bytes  # EXACT bytes, not str-decoded
    assert resp.media_type.endswith("wordprocessingml.document")
    assert "attachment" in resp.headers["content-disposition"]
    assert "risk-register.docx" in resp.headers["content-disposition"]


async def test_raw_route_expired_template_404(monkeypatch):
    """An expired template (is_expired) 404s on the raw route — collapsed with
    missing + cross-thread (no existence leak)."""
    import app.api.workspace as ws
    from fastapi import HTTPException

    tid = mock_user_data["id"]
    fid = "22222222-2222-2222-2222-222222222222"

    async def _noop_ownership(thread_id, current_user, supabase):
        return None

    async def _fake_get_pool():
        return object()

    async def _fake_get_file_by_id(pool, file_id):
        return {"id": fid, "thread_id": tid, "path": "/t.docx", "is_expired": True}

    monkeypatch.setattr(ws, "_verify_thread_ownership", _noop_ownership)
    monkeypatch.setattr(ws, "get_pg_pool", _fake_get_pool)
    monkeypatch.setattr(ws, "get_file_by_id", _fake_get_file_by_id)

    with pytest.raises(HTTPException) as ei:
        await ws.download_workspace_file_raw(
            thread_id=tid, file_id=fid, current_user=mock_user_data, supabase=object()
        )
    assert ei.value.status_code == 404


async def test_raw_route_cross_thread_404(monkeypatch):
    """A file whose row.thread_id differs from the path thread_id 404s (IDOR
    collapsed to 404)."""
    import app.api.workspace as ws
    from fastapi import HTTPException

    tid = mock_user_data["id"]
    fid = "33333333-3333-3333-3333-333333333333"

    async def _noop_ownership(thread_id, current_user, supabase):
        return None

    async def _fake_get_pool():
        return object()

    async def _fake_get_file_by_id(pool, file_id):
        # The row belongs to a DIFFERENT thread than the URL's thread_id.
        return {"id": fid, "thread_id": "99999999-9999-9999-9999-999999999999",
                "path": "/t.docx", "is_expired": False}

    monkeypatch.setattr(ws, "_verify_thread_ownership", _noop_ownership)
    monkeypatch.setattr(ws, "get_pg_pool", _fake_get_pool)
    monkeypatch.setattr(ws, "get_file_by_id", _fake_get_file_by_id)

    with pytest.raises(HTTPException) as ei:
        await ws.download_workspace_file_raw(
            thread_id=tid, file_id=fid, current_user=mock_user_data, supabase=object()
        )
    assert ei.value.status_code == 404
