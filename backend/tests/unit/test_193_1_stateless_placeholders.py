"""Phase 193.1 (AUTH-03, re-opened half) — the STATELESS template read (D-05).

``POST /workflows/template/placeholders`` takes the **bytes**, returns the **field
names**, and persists nothing. It exists because the shipped upload door
(``POST /workflows/{definition_id}/template``) requires a saved workflow, and at
describe time there is no workflow yet.

⚠ **THE HARNESS BELOW IS DELIBERATELY SMALLER THAN ITS ANALOG'S, AND THE SHRINKAGE
IS THE SECURITY PROPERTY.** ``test_193_workflow_template_upload.py`` needs a
``_FakePool`` and a ``_FakeSupabase`` because its route authorizes a ROW and writes a
Storage object. This route owns no row and accepts no caller-supplied path, so the
cross-tenant Storage-read class that quick task ``260814-q5r`` had to guard against
with a hand-written owner-prefix check is **unreachable here by construction** — there
is no client to attach it to. That is only true for as long as nobody adds
``supabase=Depends(get_supabase)`` "for symmetry", so
``test_handler_injects_no_client_and_no_pool`` below asserts BOTH the signature and the
body: a signature-only fence would miss a ``pool = await get_pg_pool()`` inside the
function.

What is pinned here:
  * a real ``.docx`` yields its sorted, de-duplicated field names — INCLUDING loop
    columns and EXCLUDING the collection name (the assembly both doors now share);
  * a document that opens but carries no tokens is ``read="ok"`` with ``[]`` — the one
    arm that may honestly answer that way;
  * a renamed binary / a truncated file wearing a ``.docx`` name is a **422 refusal**,
    never ``read="ok"`` with ``[]``. Those two facts may never merge;
  * ``.pptx`` / ``.xlsx`` pass the container gate and answer ``ok`` + ``[]`` — the
    parser is Word-only and the SERVER does not word that distinction;
  * the ordered upload-gate ladder, including the WR-04 declared-size check whose stub
    RAISES on read so it cannot pass by accident;
  * the zip-bomb cap this route ADDS (the shipped doors do not have it);
  * the no-client / no-pool fence, the authoring-gate fence and the route-pattern fence.

Fully OFFLINE — no Postgres, no Storage, no network, and no ``TestClient``.
"""

from __future__ import annotations

import inspect
import io
import zipfile

import pytest
from fastapi import HTTPException

_USER_ID = "3f2b0a11-1111-4c1e-9a00-00000000beef"


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _StubUpload:
    """A minimal ``UploadFile`` stand-in (copied verbatim from the Phase 193 analog).

    ``explode_on_read`` is the load-bearing bit for the WR-04 case: if the route
    materialises the body despite an oversized DECLARED size, the read RAISES, so
    the test cannot pass by accident.
    """

    def __init__(self, filename, data=b"", size=None, explode_on_read=False) -> None:
        self.filename = filename
        self.size = len(data) if size is None else size
        self._data = data
        self._explode = explode_on_read
        self.read_calls = 0

    async def read(self) -> bytes:
        self.read_calls += 1
        if self._explode:
            raise AssertionError("route read the body despite an oversized declared part size")
        return self._data


def _read(upload):
    """Invoke the route DIRECTLY. Two keyword arguments and nothing else — see the
    module docblock: there is no pool to fake and no client to fake."""
    from app.api import workflows as wf_api

    return wf_api.read_template_placeholders(file=upload, current_user={"id": _USER_ID})


# ── Byte builders ─────────────────────────────────────────────────────────────
#
# ⚠ MEASURED CORRECTION to the plan's instruction ("use ``valid_docx_bytes`` for every
# happy path"): the shared fixture writes ``word/document_marker.xml``, NOT
# ``word/document.xml`` (``tests/conftest.py:1037-1040``). ``parse_docx_template_variables``
# reads ONLY ``word/document.xml`` and ``word/header|footer\\d*.xml``
# (``template_render_service.py:382-385``), so ``valid_docx_bytes`` can only ever produce
# the ``ok`` + ``[]`` arm — which is exactly what it is used for below. A docx carrying
# real tokens has to satisfy BOTH gates at once, which is what ``_template_docx`` builds.
def _template_docx(body: str) -> bytes:
    """A docx that satisfies BOTH gates: ``[Content_Types].xml`` + a ``word/`` part for
    ``_validate_ooxml_container`` (``workspace.py:135-152``), AND a real
    ``word/document.xml`` for the shipped parser. Neither existing helper does both —
    ``valid_docx_bytes`` has no ``document.xml`` and ``test_q5r``'s ``_docx`` has no
    ``[Content_Types].xml``."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types/>')
        zf.writestr(
            "word/document.xml",
            f"<w:document><w:body><w:t>{body}</w:t></w:body></w:document>",
        )
    return buf.getvalue()


def _zip_bomb(uncompressed: int) -> bytes:
    """A VALID OOXML container whose declared uncompressed total exceeds the cap.

    This is the real shape of the exposure: the compressed body is a few dozen KB, so
    every size gate on the ladder passes, and only the ``infolist()`` cap stops the
    bytes from being decompressed into RAM.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types/>')
        zf.writestr("word/document.xml", b"\x00" * uncompressed)
    return buf.getvalue()


#: Scalars, a loop with two Cited columns, and the collection itself. The expected
#: answer is what makes the loop-column rule visible: ``rows`` (the collection) is NOT a
#: field the model fills, while ``risk_id`` and ``owner`` (its columns) are.
_BODY = (
    "{{ project_name.value }} "
    "{% for r in rows %}{{ r.risk_id.value }}{{ r.owner.value }}{% endfor %} "
    "{{ overall_rag_status.value }}"
)
_EXPECTED = ["overall_rag_status", "owner", "project_name", "risk_id"]


# ── 1. The happy path ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_real_docx_returns_sorted_unique_field_names():
    result = await _read(_StubUpload("Q3 brief.docx", _template_docx(_BODY)))

    assert result.read == "ok"
    assert result.placeholders == _EXPECTED
    # The collection name is not a field anyone fills — its COLUMNS are.
    assert "rows" not in result.placeholders
    # Nothing from the upload is echoed back: no filename, no extension, no size. That
    # is why the sibling's WR-05 ``safe_name`` sanitisation is not carried across.
    payload = result.model_dump()
    assert set(payload) == {"read", "placeholders"}
    assert "Q3 brief.docx" not in repr(payload)


@pytest.mark.asyncio
async def test_duplicate_tokens_are_deduplicated_and_sorted():
    doc = _template_docx("{{ b.value }} {{ a.value }} {{ b.value }}")
    result = await _read(_StubUpload("dupes.docx", doc))
    assert (result.read, result.placeholders) == ("ok", ["a", "b"])


# ── 2. The honest empty state — and the refusal it must never be confused with ─
@pytest.mark.asyncio
async def test_docx_that_opens_with_no_tokens_is_ok_and_empty(valid_docx_bytes):
    """The ONE arm that may honestly answer ``ok`` with ``[]``: the container really
    opened and the parser found no tokens in it.

    ⚠ ``valid_docx_bytes`` is used here DELIBERATELY and is not interchangeable with
    ``_template_docx`` — see the correction note above the byte builders."""
    result = await _read(_StubUpload("blank.docx", valid_docx_bytes))
    assert (result.read, result.placeholders) == ("ok", [])


@pytest.mark.asyncio
@pytest.mark.parametrize("name,fixture", [("deck.pptx", "valid_pptx_bytes"),
                                          ("book.xlsx", "valid_xlsx_bytes")])
async def test_pptx_and_xlsx_are_ok_and_empty(name, fixture, request):
    """The parser is Word-only. The server answers with the same honest ``ok`` + ``[]``
    it gives a field-less docx; wording that distinction (*"we can only read fields out
    of Word documents"*) is the CLIENT's job, not this route's."""
    result = await _read(_StubUpload(name, request.getfixturevalue(fixture)))
    assert (result.read, result.placeholders) == ("ok", [])


@pytest.mark.asyncio
async def test_renamed_binary_is_422_and_never_ok_with_an_empty_list(renamed_binary_bytes):
    """THE HONESTY GATE. ``parse_docx_template_variables`` returns ``None`` for TWO
    different facts — *corrupt / not a docx* (:390-391) and *a real docx with no tokens*
    (:407-408). On this route the bytes come straight off the user's disk, so the
    ambiguity is live, and the fix is ORDER: ``validate_upload`` refuses first, so a
    document that never opened can only ever be a 422."""
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("payload.docx", renamed_binary_bytes))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_truncated_container_is_422_not_an_empty_read():
    truncated = _template_docx(_BODY)[:24]  # PK header survives, the EOCD does not
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("cut.docx", truncated))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "name,data",
    [
        ("logo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32),  # legal for the skill door
        ("notes.txt", b"plain text\n"),
        ("archive.zip", b"PK\x03\x04"),
        ("noext", b"whatever"),
    ],
)
async def test_non_ooxml_extensions_are_422(name, data):
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload(name, data))
    assert exc.value.status_code == 422


# ── 3. The size ladder ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_empty_body_is_422():
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("empty.docx", b""))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_oversized_declared_size_refused_before_the_body_is_read():
    """WR-04. uvicorn/FastAPI impose no body cap, so ``.read()`` of a multi-GB part
    would buffer it all in RAM. The stub RAISES on read, so this can only pass if the
    route refuses on ``file.size`` FIRST."""
    from app.services.workspace_service import MAX_FILE_SIZE

    up = _StubUpload("huge.docx", b"", size=MAX_FILE_SIZE + 1, explode_on_read=True)
    with pytest.raises(HTTPException) as exc:
        await _read(up)
    assert exc.value.status_code == 422
    assert up.read_calls == 0


@pytest.mark.asyncio
async def test_oversized_actual_body_refused_even_when_the_declared_size_lies():
    from app.services.workspace_service import MAX_FILE_SIZE

    up = _StubUpload("huge.docx", b"x" * (MAX_FILE_SIZE + 1), size=None)
    up.size = None  # the "declared size unknown" shape
    with pytest.raises(HTTPException) as exc:
        await _read(up)
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_zip_bomb_over_the_uncompressed_cap_is_422():
    """⚠ THE ONE GAP THE INHERITED LADDER DOES NOT COVER, so it must not be presented as
    covered. ``zf.read()`` (``template_render_service.py:387``) is uncapped: a 10 MB
    OOXML container can declare a multi-GB ``word/document.xml``, every size gate above
    passes, and it decompresses into RAM. This route caps the ``infolist()``
    uncompressed total; the SHIPPED doors still do not."""
    from app.api.workflows import _TEMPLATE_MAX_UNCOMPRESSED_BYTES
    from app.services.workspace_service import MAX_FILE_SIZE

    bomb = _zip_bomb(_TEMPLATE_MAX_UNCOMPRESSED_BYTES + 1)
    # The bomb really does get past every inherited gate — that is the point.
    assert len(bomb) < MAX_FILE_SIZE, len(bomb)
    with pytest.raises(HTTPException) as exc:
        await _read(_StubUpload("bomb.docx", bomb))
    assert exc.value.status_code == 422
    # Named, not merely status-coded: the refusal says what the limit is.
    assert str(_TEMPLATE_MAX_UNCOMPRESSED_BYTES // (1024 * 1024)) in exc.value.detail


@pytest.mark.asyncio
async def test_a_container_just_under_the_cap_still_reads():
    """The cap refuses bombs, not big documents — the positive control that stops the
    test above from passing against a route that refuses everything."""
    from app.api.workflows import _TEMPLATE_MAX_UNCOMPRESSED_BYTES

    assert _TEMPLATE_MAX_UNCOMPRESSED_BYTES > 1_000_000  # a real document must fit
    result = await _read(_StubUpload("ok.docx", _template_docx(_BODY)))
    assert result.placeholders == _EXPECTED


# ── 4. The fences ─────────────────────────────────────────────────────────────
#: The symbols that would re-open the ``260814-q5r`` cross-tenant class if any of them
#: ever appeared in this handler's CODE.
_FORBIDDEN_IN_HANDLER = (
    "get_user_supabase_client",
    "get_supabase",
    "get_pg_pool",
    "_owned_slug_or_404",
    "_coerce_user_id",
    "safe_name",
)


def _code_without_prose(fn) -> str:
    """The handler's CODE with its docstring and comments removed.

    ⚠ THE SCOPE IS THE DECISION HERE, so it is stated rather than assumed. A RAW sweep
    over ``inspect.getsource`` is the right shape for Phase 193's D-24(a) copy fence,
    where a docblock QUOTING a governed word is itself the leak. It is the WRONG shape
    here: the property is *the handler does not USE a database credential*, and a
    docblock that names ``get_supabase`` in order to explain why the route must never
    take one is documentation, not a use. A raw sweep would pressure the next author into
    deleting the explanation to keep the fence green. ``ast.unparse`` of the function with
    its docstring dropped keeps every statement and discards every comment.

    ``test_the_no_client_fence_can_actually_fire`` is the positive control: a fence
    nobody has seen fire is a fence nobody knows is connected (193's WR-01)."""
    import ast
    import textwrap

    node = ast.parse(textwrap.dedent(inspect.getsource(fn))).body[0]
    if ast.get_docstring(node) is not None:
        node.body = node.body[1:]
    return ast.unparse(node)


def test_handler_injects_no_client_and_no_pool():
    """⚠ THE SECURITY PROPERTY OF THIS PLAN, asserted rather than described.

    ``260814-q5r`` had to write an owner-prefix check and a ``..`` traversal check
    because its route reads Storage through a client on a service-role pool. This route
    injects NEITHER, so that whole class has nothing to attach to. The CODE is swept as
    well as the signature: a signature-only fence would sail past a
    ``pool = await get_pg_pool()`` on line one."""
    from app.api import workflows as wf_api

    params = set(inspect.signature(wf_api.read_template_placeholders).parameters)
    assert not ({"supabase", "pool", "definition_id", "asset_id"} & params), params

    code = _code_without_prose(wf_api.read_template_placeholders)
    for forbidden in _FORBIDDEN_IN_HANDLER:
        assert forbidden not in code, forbidden


def test_the_no_client_fence_can_actually_fire():
    """The positive control for the sweep above — the plant is a REAL function, so the
    fence is shown connected rather than asserted to be."""

    async def _planted(file, current_user):
        """A docblock is prose and must NOT trip the fence."""
        pool = await get_pg_pool()  # noqa: F821 — never called, only parsed
        return pool

    code = _code_without_prose(_planted)
    assert "get_pg_pool" in code
    assert "docblock is prose" not in code  # the docstring really was dropped


def test_route_carries_the_authoring_gate_and_requires_a_user():
    """The two controls that DO remain: an unauthenticated parser is free CPU for
    anyone, and the feature gate is the same one both siblings carry (:1655, :1744)."""
    from fastapi import params as fastapi_params

    from app.api import workflows as wf_api
    from app.dependencies import get_current_user

    route = _target_route()
    gated_features: list[str] = []
    for dep in route.dependant.dependencies:
        closure = getattr(dep.call, "__closure__", None) or ()
        gated_features.extend(
            c.cell_contents for c in closure if isinstance(c.cell_contents, str)
        )
    assert "workflow_authoring" in gated_features, gated_features

    current_user = inspect.signature(
        wf_api.read_template_placeholders
    ).parameters["current_user"].default
    assert isinstance(current_user, fastapi_params.Depends)
    assert current_user.dependency is get_current_user


def _target_route():
    from app.api import workflows as wf_api

    hits = [r for r in wf_api.router.routes if r.path == _target_path()]
    assert len(hits) == 1, [r.path for r in wf_api.router.routes]
    return hits[0]


def _target_path() -> str:
    from app.api import workflows as wf_api

    return f"{wf_api.router.prefix}/template/placeholders"


def test_route_path_is_declared_once_and_no_sibling_pattern_shadows_it():
    """A cheap regression pin, NOT a claim that the route would otherwise mis-route.
    Measured with Starlette's own ``compile_path``, this literal path matches none of the
    router's declared patterns at ANY declaration position — and the router already ships
    ``POST /generate`` (a literal, :1551) declared AFTER the parameterised
    ``POST /{definition_id}/publish`` (:1040), which works for the same reason."""
    from starlette.routing import compile_path

    from app.api import workflows as wf_api

    target = _target_path()
    assert [r.path for r in wf_api.router.routes].count(target) == 1

    for route in wf_api.router.routes:
        if route.path == target:
            continue
        regex, _fmt, _conv = compile_path(route.path)
        assert regex.match(target) is None, route.path


@pytest.mark.asyncio
async def test_both_template_doors_assemble_the_same_names_for_one_document():
    """⚠ ONE DOCUMENT, ONE ANSWER. The bound-template door
    (``resolve_template_placeholders``) and this route are one screen apart in the
    product; a route that returned ``scalars`` alone would show a SHORTER field list for
    the same file — the loop columns would silently vanish. Both now go through
    ``placeholder_names_from_parsed``, and this drives one real document through both."""
    from unittest.mock import patch

    from app.services.harness import grounding

    doc = _template_docx(_BODY)

    async def _fake_resolve(*, pool, supabase, thread_id, user_id, asset_ref):
        return {"bytes": doc}

    with patch("app.services.template_asset_service.resolve_template_source", _fake_resolve):
        bound_names, bound_read = await grounding.resolve_template_placeholders(
            supabase=None,
            pool=None,
            user_id=_USER_ID,
            template_asset_id="x/y.docx",
            template_placeholders=None,
        )

    stateless = await _read(_StubUpload("same.docx", doc))
    assert (bound_read, bound_names) == ("ok", _EXPECTED)
    assert stateless.placeholders == bound_names
