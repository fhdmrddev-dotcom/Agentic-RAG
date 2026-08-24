"""Quick task 260814-q5r — show a template's placeholders when it is attached.

WHAT THIS PINS, and why each case is not decoration:

  * **The owner fence.** ``GET /workflows/{id}/template/placeholders`` takes a Storage
    PATH in the query string. Owning the *definition* proves nothing about an
    ``asset_id`` that arrived separately, and the workflow cluster reads through a
    service-role pool that bypasses RLS — so the ``startswith(f"{user_id}/")`` check is
    an authorization boundary, not a tidiness check.
  * **The traversal fence.** ``workspace_storage_select_own``
    (``supabase/migrations/054_workspace_files.sql:83-89``) keys on
    ``(storage.foldername(name))[1]`` — the FIRST path segment — so
    ``{uid}/../someone-else/x.docx`` passes BOTH the owner-prefix check and the database
    policy. This one is measured, not theoretical.
  * **Unreadable is distinguishable from empty.** Two responses that both carry
    ``placeholders == []`` must carry DIFFERENT ``read`` values. Without this the author
    of a template we failed to open is told, in the app's own words, that their template
    has no fill-in fields — and they ship a workflow that fills nothing.
  * **The happy path**, against a REAL docx zip built in-memory and parsed by the real
    ``parse_docx_template_variables`` — not a mocked parser. A mocked parser would prove
    the plumbing and nothing about the oracle.

Fully OFFLINE — no Postgres, no network, no Storage. The route function is called
DIRECTLY against a fake pool and a fake supabase client (the ``test_193_workflow_template_upload``
precedent), so these run in any CI. That matters here more than usual: the two fences below
are this endpoint's only authorization boundary, and a guard that skips when the database
is down is not a guard.

── THE RED PLANTS, AND WHAT WAS OBSERVED ────────────────────────────────────────
Each plant was applied to REAL production source, observed failing, then reverted and
the file confirmed md5-identical before the green run. A fence whose scope was never
tested is not a fence — a sibling phase shipped three registers claiming assertions that
could not fire, one of them sweeping against the empty string and passing green.

  RED-1 — deleted ``asset_id.startswith(f"{user_id}/")`` from ``workflows.py``, keeping
    the ``..`` check. OBSERVED: ``1 failed, 13 passed`` —
    ``Failed: DID NOT RAISE <class 'fastapi.exceptions.HTTPException'>`` at
    ``test_foreign_prefix_is_404_and_reads_nothing``. ⚠ That assertion fires at the
    ``pytest.raises`` boundary, so it does not BY ITSELF show a disclosure — the same
    RED would appear if the route merely returned an empty list. The disclosure was
    therefore confirmed SEPARATELY, by driving the planted route directly:
    ``RESULT: {'read': 'ok', 'placeholders': ['their_secret']}`` with the recording
    resolver asked for ``9c8d…cafe/_library/x/aa-Their.docx``. Another author's field
    names really do cross the wire when this one clause is absent.

  RED-2 — removed ONLY the ``".." in asset_id.split("/")`` clause, keeping the prefix
    check. OBSERVED: ``2 failed, 12 passed`` — both ``test_traversal_segment_is_404``
    and ``test_traversal_deeper_in_the_path_is_also_404`` raised
    ``Failed: DID NOT RAISE <class 'fastapi.exceptions.HTTPException'>``. This is the
    case the prefix check CANNOT catch (the hostile id starts with the caller's own uid),
    which is the whole reason the clause is not decoration.

  RED-3 — in ``grounding.py``, made the ``except`` arm return ``([], "ok")`` instead of
    ``([], "unreadable")``. OBSERVED: ``1 failed, 13 passed`` — a real
    ``AssertionError: a failed read reported itself as a successful one: 'ok' == 'ok'``,
    never a bare timeout. The scope check that matters: with the distinction removed the
    test goes red, so it tests the distinction rather than merely co-existing with it.
    Note ``test_no_bytes_is_unreadable_not_empty`` stayed GREEN under this plant — the
    two unreadable arms are pinned independently, so neither can carry the other.
"""

from __future__ import annotations

import io
import zipfile
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

_OWNER_ID = "3f2b0a11-1111-4c1e-9a00-00000000beef"
_OTHER_ID = "9c8d7e66-2222-4b3a-8f00-00000000cafe"


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _FakePool:
    """``_owned_slug_or_404`` issues exactly one owner-scoped ``fetchrow``."""

    def __init__(self, row: dict | None) -> None:
        self._row = row
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, query: str, *args):
        self.calls.append((query, args))
        return self._row


class _RecordingResolver:
    """Stands in for ``resolve_template_source`` and RECORDS every asset id it is asked for.

    The recording is load-bearing: "no names leaked" is a weak assertion when the route
    raised before reaching Storage anyway. What the fences must prove is that the read
    NEVER HAPPENED — so the fence tests assert on this list, and the RED plants make it
    non-empty rather than merely changing a status code.
    """

    def __init__(self, data: bytes | None = None, explode: bool = False) -> None:
        self.asked: list[str] = []
        self._data = data
        self._explode = explode

    async def __call__(self, *, pool, supabase, thread_id, user_id, asset_ref):
        self.asked.append(asset_ref.asset_id)
        if self._explode:
            raise RuntimeError("storage object is gone")
        return {"bytes": self._data}


def _docx(body: str) -> bytes:
    """A REAL docx-shaped zip. The parser reads ``word/document.xml`` and strips tags,
    so this exercises the shipped oracle rather than a stand-in for it."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", f"<w:document><w:body><w:t>{body}</w:t></w:body></w:document>")
    return buf.getvalue()


def _call(asset_id: str, *, resolver: _RecordingResolver, owner_row=..., user_id: str = _OWNER_ID):
    """Invoke the route directly against fakes; returns (coroutine, pool)."""
    from app.api import workflows as wf_api

    pool = _FakePool({"slug": "some-workflow"} if owner_row is ... else owner_row)

    async def _go():
        with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)), patch(
            "app.services.template_asset_service.resolve_template_source", resolver
        ):
            return await wf_api.get_workflow_template_placeholders(
                definition_id=uuid4(),
                asset_id=asset_id,
                current_user={"id": user_id},
                supabase=object(),
            )

    return _go(), pool


# ── 1. The owner fence ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_foreign_prefix_is_404_and_reads_nothing():
    """Another author's asset id, requested against a definition the caller DOES own."""
    resolver = _RecordingResolver(_docx("{{ their_secret.value }}"))
    coro, pool = _call(f"{_OTHER_ID}/_library/{uuid4()}/aabbccdd-Their Report.docx", resolver=resolver)

    with pytest.raises(HTTPException) as exc:
        await coro

    assert exc.value.status_code == 404
    # 404, never 403 — a 403 would confirm the object exists (no existence oracle), which
    # is the same posture the owner-gate on the definition already takes.
    assert exc.value.detail == "template not found"
    # THE ACTUAL PROPERTY: Storage was never touched for another user's path.
    assert resolver.asked == []
    # The definition owner-gate really ran, owner-scoped, before the asset fence.
    assert len(pool.calls) == 1
    assert "created_by" in pool.calls[0][0]


@pytest.mark.asyncio
async def test_non_owner_of_definition_is_404_before_any_asset_work():
    """Gate 1 still stands on its own: an unowned definition never reaches gate 2."""
    resolver = _RecordingResolver(_docx("{{ a.value }}"))
    coro, _pool = _call(f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-Mine.docx",
                        resolver=resolver, owner_row=None)

    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 404
    assert resolver.asked == []


# ── 2. The traversal fence ────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_traversal_segment_is_404():
    """``{uid}/../someone-else/x.docx`` — passes the owner-prefix check AND the database
    policy (which keys on the first path segment). Only the ``..`` clause stops it."""
    hostile = f"{_OWNER_ID}/../{_OTHER_ID}/stolen.docx"
    assert hostile.startswith(f"{_OWNER_ID}/")  # the prefix check alone is satisfied
    assert hostile.split("/")[0] == _OWNER_ID  # ...and so is storage.foldername(name)[1]

    resolver = _RecordingResolver(_docx("{{ their_secret.value }}"))
    coro, _pool = _call(hostile, resolver=resolver)

    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 404
    assert resolver.asked == []


@pytest.mark.asyncio
async def test_traversal_deeper_in_the_path_is_also_404():
    """The check is per-SEGMENT, not a prefix test — a ``..`` further along still escapes."""
    resolver = _RecordingResolver(_docx("{{ x.value }}"))
    coro, _pool = _call(f"{_OWNER_ID}/_library/../../{_OTHER_ID}/stolen.docx", resolver=resolver)

    with pytest.raises(HTTPException) as exc:
        await coro
    assert exc.value.status_code == 404
    assert resolver.asked == []


@pytest.mark.asyncio
async def test_a_filename_merely_containing_dots_is_not_refused():
    """A scope check on the fence itself: ``..`` inside a NAME is not a traversal, and
    refusing it would make the fence look effective while breaking real templates."""
    ok_id = f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-Q3..final.docx"
    resolver = _RecordingResolver(_docx("{{ project_name.value }}"))
    coro, _pool = _call(ok_id, resolver=resolver)

    result = await coro
    assert result.read == "ok"
    assert resolver.asked == [ok_id]


# ── 3. Unreadable is NOT empty ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_unreadable_and_empty_are_distinguishable():
    """The honesty requirement, stated as one assertion over two responses."""
    base = f"{_OWNER_ID}/_library/{uuid4()}"

    # (a) the read BLOWS UP — storage miss, deleted object, auth failure
    broken = _RecordingResolver(explode=True)
    unreadable, _ = _call(f"{base}/aabbccdd-Gone.docx", resolver=broken)
    unreadable = await unreadable

    # (b) the read SUCCEEDS and the document genuinely carries no tokens
    plain = _RecordingResolver(_docx("A report with no placeholders whatsoever."))
    empty, _ = _call(f"{base}/aabbccdd-Plain.docx", resolver=plain)
    empty = await empty

    # Both carry an empty list — that is exactly why the list alone cannot be trusted.
    assert unreadable.placeholders == []
    assert empty.placeholders == []
    # ...and this is the distinction the whole task exists for.
    assert unreadable.read == "unreadable", (
        f"a failed read reported itself as a successful one: {unreadable.read!r} == 'ok'"
    )
    assert empty.read == "ok", (
        f"a document we DID open reported itself as unread: {empty.read!r}"
    )
    assert unreadable.read != empty.read
    # The failing case really did attempt the read (it is not passing by short-circuit).
    assert len(broken.asked) == 1


@pytest.mark.asyncio
async def test_no_bytes_is_unreadable_not_empty():
    """A resolver that returns no bytes never opened anything — "ok" here would be a lie."""
    resolver = _RecordingResolver(None)
    coro, _ = _call(f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-Empty.docx", resolver=resolver)
    result = await coro
    assert result.read == "unreadable"
    assert result.placeholders == []


@pytest.mark.asyncio
async def test_a_non_word_file_reads_ok_with_no_fields():
    """A .pptx cannot be parsed by the Word-only oracle, and the SERVER does not pretend
    otherwise: it answers ``ok`` + ``[]`` (we opened bytes; there are no docx tokens in
    them). Saying "unreadable" here would be equally wrong — we DID read the object. The
    client is what must not render this as "this template has no fields"; that reading is
    pinned on the surface, gated on the filename extension."""
    resolver = _RecordingResolver(b"PK\x03\x04 not-a-docx at all")
    coro, _ = _call(f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-Deck.pptx", resolver=resolver)
    result = await coro
    assert result.read == "ok"
    assert result.placeholders == []


# ── 4. The happy path, through the REAL parser ────────────────────────────────
@pytest.mark.asyncio
async def test_scalars_and_loop_columns_come_back_sorted():
    body = "{{ project_name.value }} {%tr for r in rows %}{{ r.risk_id.value }}{%tr endfor %}"
    resolver = _RecordingResolver(_docx(body))
    asset = f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-Risk Register.docx"
    coro, _ = _call(asset, resolver=resolver)

    result = await coro
    assert result.read == "ok"
    # A scalar root AND a loop-local column — the two shapes the oracle emits.
    assert result.placeholders == ["project_name", "risk_id"]
    assert resolver.asked == [asset]


@pytest.mark.asyncio
async def test_the_response_is_exactly_two_keys():
    """The wire shape the client's typed leaf reads. A third key appearing silently is a
    contract change the frontend union would not notice."""
    resolver = _RecordingResolver(_docx("{{ project_name.value }}"))
    coro, _ = _call(f"{_OWNER_ID}/_library/{uuid4()}/aabbccdd-T.docx", resolver=resolver)
    result = await coro
    assert set(result.model_dump()) == {"read", "placeholders"}


# ── 5. The resolver's own three-state, read directly ──────────────────────────
@pytest.mark.asyncio
async def test_resolver_reports_not_requested_when_no_asset_is_supplied():
    """The third arm, which the ROUTE can never reach (its ``asset_id`` is required) but
    ``assemble_grounding_bundle`` reaches on every base palette read. Pinned here so the
    route's ``Literal["ok", "unreadable"]`` stays honest about what it excludes."""
    from app.services.harness import grounding

    names, read = await grounding.resolve_template_placeholders(
        supabase=object(), pool=None, user_id=_OWNER_ID,
        template_asset_id=None, template_placeholders=None,
    )
    assert (names, read) == ([], "not_requested")


@pytest.mark.asyncio
async def test_supplied_placeholders_are_ok_and_pass_through():
    from app.services.harness import grounding

    names, read = await grounding.resolve_template_placeholders(
        supabase=object(), pool=None, user_id=_OWNER_ID,
        template_asset_id=None, template_placeholders=["b", "a"],
    )
    assert read == "ok"
    assert names == ["b", "a"]  # pass-through, NOT re-sorted (the shipped behaviour)


# ── 6. The bundle is byte-unaffected by this task ─────────────────────────────
def test_grounding_bundle_has_no_template_read_axis():
    """``degraded`` is consumed by ``/validate``'s ``grounding_unavailable_finding`` and by
    the publish gauntlet. An unreadable TEMPLATE must never become a validation finding —
    so the read status stops at the route and never enters the bundle."""
    import dataclasses

    from app.services.harness.grounding import GroundingBundle

    fields = {f.name for f in dataclasses.fields(GroundingBundle)}
    assert "template_read" not in fields
    assert "read" not in fields
    assert "placeholders" in fields  # unchanged, still just the list


def test_the_old_private_name_is_gone():
    """The rename is real — a stale ``_resolve_template_placeholders`` left behind would
    let a future caller reach the list-only shape and lose the distinction silently."""
    from app.services.harness import grounding

    assert hasattr(grounding, "resolve_template_placeholders")
    assert not hasattr(grounding, "_resolve_template_placeholders")
