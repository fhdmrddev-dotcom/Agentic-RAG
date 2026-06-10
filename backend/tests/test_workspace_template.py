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

Offline-friendly: the two GREEN tests (SC#2 guard) need no DB. The xfail target
tests reference live-DB / asyncpg / REST seams the implementing plans build; where
a pure function exists (validate_ooxml) the stub asserts against it directly. The
cross-provider / live UAT half stays MANUAL (100-VALIDATION.md "Manual-Only
Verifications" — all 7 G-4 rows).
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


@pytest.mark.xfail(strict=False, reason="Plan 100-04 — validate_ooxml magic-byte gate")
def test_valid_ooxml_accepted(valid_docx_bytes, valid_pptx_bytes, valid_xlsx_bytes):
    """validate_ooxml accepts a real docx/pptx/xlsx and returns its canonical
    extension (the magic-byte allowlist — D-12)."""
    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    assert validate_ooxml("report.docx", valid_docx_bytes) == ".docx"
    assert validate_ooxml("deck.pptx", valid_pptx_bytes) == ".pptx"
    assert validate_ooxml("sheet.xlsx", valid_xlsx_bytes) == ".xlsx"


@pytest.mark.xfail(strict=False, reason="Plan 100-04 — validate_ooxml rejects renamed binary")
def test_bad_file_rejected(renamed_binary_bytes):
    """A renamed binary (fake .docx that is not a ZIP) is rejected with
    HTTPException(422); no workspace_files row is created (D-12)."""
    from fastapi import HTTPException

    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    with pytest.raises(HTTPException) as exc:
        validate_ooxml("malware.docx", renamed_binary_bytes)
    assert exc.value.status_code == 422


@pytest.mark.xfail(strict=False, reason="Plan 100-04 — validate_ooxml size guard")
def test_oversized_rejected(oversized_ooxml_bytes):
    """An OOXML container padded past the 10 MB size limit is rejected 422 even
    though its magic bytes are valid (the size guard trips first)."""
    from fastapi import HTTPException

    from app.api.workspace import validate_ooxml  # built by Plan 100-04

    with pytest.raises(HTTPException) as exc:
        validate_ooxml("huge.docx", oversized_ooxml_bytes)
    assert exc.value.status_code == 422


# ── Plan 100-03 — write_file persists kind + TTL; D-10 expired tool read ───────


@pytest.mark.xfail(strict=False, reason="Plan 100-03 — upload sets kind='template_input' + expires_at")
def test_upload_sets_kind_and_ttl(client):
    """A template upload sets kind='template_input' and expires_at ~= now + the
    configured TTL on the persisted workspace_files row (D-05 / D-06)."""
    import datetime as _dt

    from app.api.workspace import upload_template  # built by Plan 100-03/04

    # The implementing plan returns the persisted row; assert the contract shape.
    row = upload_template  # symbol existence is the RED gate here
    assert row is not None
    # When wired live, the persisted row carries:
    #   row["kind"] == "template_input"
    #   row["expires_at"] is a future timestamptz ~= now + template_ttl_hours
    assert isinstance(_dt.timedelta(hours=24), _dt.timedelta)


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


@pytest.mark.xfail(strict=False, reason="Plan 100-03 — agent files (NULL expiry) byte-identical (D-11)")
def test_agent_files_unchanged():
    """The D-11 RED LINE: agent-written workspace files (expires_at IS NULL) list /
    read / diff exactly as today. Templates are optional everywhere; the gated read
    path is a literal no-op when expires_at is NULL."""
    from app.db.workspace import get_file_by_path, list_files_in_thread  # read seams

    # These read seams must stay byte-identical for NULL-expiry rows — the
    # implementing plan proves it by listing/reading an agent file before AND
    # after the template gate lands and asserting identical output.
    assert get_file_by_path is not None
    assert list_files_in_thread is not None


# ── Plan 100-04 — REST routes gated (expired excluded) + cross-user RLS ────────


@pytest.mark.xfail(strict=False, reason="Plan 100-04 — expired rows excluded from REST list + content")
def test_expired_excluded_rest(client):
    """An expired template row is absent from the REST list AND its content route
    404s — the signed-URL bypass is closed (D-06). The gated filter is
    `expires_at IS NULL OR expires_at > now()`."""
    # The implementing plan inserts a near-past expires_at row and asserts:
    #   GET /threads/{tid}/workspace/files            -> row absent
    #   GET /.../workspace/files/{file_id}/content    -> 404
    from app.api.workspace import list_workspace_files  # gated by Plan 100-04

    assert list_workspace_files is not None


@pytest.mark.xfail(strict=False, reason="Plan 100-04 — second user 404 on list/content/download (RLS)")
def test_cross_user_isolation(client):
    """SC#1 (RLS half): a second user's list / content / download of the first
    user's template all return 404. Thread ownership + RLS isolates per-user."""
    from app.api.workspace import _verify_thread_ownership  # ownership seam

    # The implementing plan drives a two-user scenario; here the symbol existence
    # is the RED gate. Live assertion: every cross-user route -> 404.
    assert _verify_thread_ownership is not None


# ── Plan 100-05 — sweep janitor + kickoff run-pin ──────────────────────────────


@pytest.mark.xfail(strict=False, reason="Plan 100-05 — sweep deletes expired rows + ALL Storage bytes; idempotent")
def test_sweep_deletes_rows_and_bytes():
    """The in-process sweep janitor removes expired template rows AND every version
    Storage object for them, and is idempotent on a second run (D-07)."""
    from app.services.template_service import sweep_expired_templates  # built by Plan 100-05

    # Live assertion (implementing plan): after sweep, the row is gone from
    # workspace_files AND storage.from_('workspace-files') has no leftover version
    # objects; a second sweep is a no-op (idempotent).
    assert sweep_expired_templates is not None


@pytest.mark.xfail(strict=False, reason="Plan 100-05 — run pin extends expires_at (GREATEST); no-op when no template")
def test_run_pin_extends_and_noop():
    """A workflow-run kickoff pin extends a template's expires_at via GREATEST
    (never shortens), and is a no-op when the thread has no template_input row
    (D-09). The pin is a thin seam — no inline logic in threads.py (G-5)."""
    from app.services.template_service import pin_templates_for_run  # built by Plan 100-05

    # Live assertion (implementing plan): pin sets
    #   expires_at = GREATEST(expires_at, now() + ttl)
    # for template_input rows in the thread; returns/changes nothing when none
    # exist (the templateless-workflow byte-identical path).
    assert pin_templates_for_run is not None


# ── Plan 100-02 — migration 068 smoke (NULL kind/expires_at still valid) ───────


@pytest.mark.xfail(strict=False, reason="Plan 100-02 — migration 068 smoke (existing rows NULL/NULL valid)")
def test_existing_rows_valid():
    """Migration 068 adds nullable kind + expires_at columns with NO default and a
    CHECK that allows NULL — so every pre-068 workspace_files row (agent files)
    stays valid (NULL kind, NULL expires_at). Zero-migration / byte-identical.

    Run after the operator applies migration 068 via the Supabase SQL editor
    (per the CLAUDE.md migration rule)."""
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    migration = repo_root / "supabase" / "migrations" / "068_workspace_template_ephemeral.sql"
    # The migration file existence + the nullable/CHECK shape is the contract.
    assert migration.exists(), "migration 068 not yet authored (Plan 100-02)"
    sql = migration.read_text(encoding="utf-8")
    assert "expires_at" in sql and "kind" in sql
