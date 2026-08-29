"""Phase 217 plan 02 (LIB-04) — the four document-detail routes.

`GET /documents/{id}/content` · `/chunks` · `/tables` · `/images`.

Three things here exist because a reader would otherwise call them defects:

1. **`/content` is UNNUMBERED and `/kb/read` still is not.** Both arms live in this file
   deliberately, so a future edit cannot satisfy one by breaking the other.
2. **The shared-folder RLS asymmetry is asserted as CORRECT** — chunks come back, tables
   and images come back EMPTY. See `test_globally_visible_folder_document_...`.
3. **A source fence over the four new route bodies**, with its own non-vacuity control: a
   regex that matched nothing would satisfy every absence assertion for free.

The seam is `conftest.py`'s dependency overrides. These routes hit the SAME table
(`documents`) up to three times per request with different `select` lists, which the shared
single-result `mock_builder` cannot express — so the tests below install a local client that
answers per (table, select), and mirror it onto `get_supabase` the way `conftest`'s
`_user_supabase_override` expects.
"""

import re
from pathlib import Path

import pytest

from app.dependencies import get_supabase
from app.main import app
from tests.conftest import mock_user_data

DOC_ID = "11111111-1111-1111-1111-111111111111"
FOREIGN_ID = "22222222-2222-2222-2222-222222222222"
OWNER = mock_user_data["id"]

DOCUMENTS_PY = Path(__file__).resolve().parents[1] / "app" / "api" / "documents.py"


# ── A per-(table, select) supabase double ─────────────────────────────────────────────

class _Resp:
    def __init__(self, data):
        self.data = data
        self.count = None


class _Builder:
    """Records the chain so a test can assert on it, and defers the payload to `resolve`."""

    def __init__(self, table, resolve, log):
        self.table = table
        self.select_arg = ""
        self.filters = []
        self.ordered = None
        self.is_single = False
        self._resolve = resolve
        log.append(self)

    def select(self, *args, **kwargs):
        self.select_arg = args[0] if args else ""
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def in_(self, key, value):
        self.filters.append(("in", key, value))
        return self

    def order(self, *args, **kwargs):
        self.ordered = args[0] if args else None
        return self

    def limit(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def maybe_single(self):
        self.is_single = True
        return self

    def execute(self):
        return _Resp(self._resolve(self))


class _Client:
    def __init__(self, resolve):
        self._resolve = resolve
        self.calls = []

    def table(self, name):
        return _Builder(name, self._resolve, self.calls)


@pytest.fixture
def install_client():
    """Install a resolver-backed client on `get_supabase`.

    `conftest`'s `_user_supabase_override` resolves the CURRENT `get_supabase` override at
    request time, so overriding one dep drives both. `reset_mocks` (autouse) restores the
    canonical overrides after every test, so nothing leaks.
    """
    made = {}

    def _install(resolve):
        c = _Client(resolve)
        made["client"] = c
        app.dependency_overrides[get_supabase] = lambda: c
        return c

    yield _install


@pytest.fixture(autouse=True)
def no_global_folders(monkeypatch):
    """Default: the caller sees no shared folders.

    Patched at BOTH import sites — `documents.py`'s visibility gate and `kb.py`'s
    `read_path` each hold their own reference. A test that wants the shared-folder case
    re-patches both explicitly.
    """
    async def _none(supabase, user_id):
        return []

    monkeypatch.setattr("app.api.documents.get_globally_visible_folder_ids", _none)
    monkeypatch.setattr("app.api.kb.get_globally_visible_folder_ids", _none)


# ── Resolvers ─────────────────────────────────────────────────────────────────────────

def _owned_doc(markdown, filename="report.md"):
    """Every read the four routes make on an OWNED document, keyed by (table, select)."""
    def resolve(b):
        if b.table == "documents":
            owned = ("eq", "user_id", OWNER) in b.filters
            targeted = ("eq", "id", DOC_ID) in b.filters
            if not (owned and targeted):
                return None
            if "full_markdown" in b.select_arg:
                return {"id": DOC_ID, "filename": filename, "full_markdown": markdown}
            return {"id": DOC_ID, "filename": filename, "user_id": OWNER, "folder_id": None}
        return []
    return resolve


def _foreign():
    """Nothing is visible: the owner arm misses and there are no shared folders."""
    def resolve(b):
        return None if b.is_single else []
    return resolve


# ── /content ──────────────────────────────────────────────────────────────────────────

def test_content_200_returns_unnumbered_text(client, auth_headers, install_client):
    """The HUMAN path: no `42: ` glued to any line (D-217-05)."""
    install_client(_owned_doc("alpha\nbeta\ngamma"))
    res = client.get(f"/documents/{DOC_ID}/content?start_line=1&end_line=3", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["content"] == "alpha\nbeta\ngamma"
    assert body["total_lines"] == 3
    assert body["start_line"] == 1 and body["end_line"] == 3
    assert body["filename"] == "report.md"
    for line in body["content"].splitlines():
        assert not re.match(r"^\d+: ", line), f"a line number leaked onto {line!r}"


def test_kb_read_still_numbers_lines(client, auth_headers, install_client):
    """The AGENT path is byte-identical — the other half of the same invariant.

    If a future edit flips `read_path`'s default, THIS case goes red, not the one above.
    """
    install_client(_owned_doc("alpha\nbeta\ngamma"))
    res = client.get(f"/kb/read?document_id={DOC_ID}&start_line=1&end_line=3", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["content"].splitlines()[0] == "1: alpha"
    assert re.match(r"^\d+: ", body["content"].splitlines()[0])


def test_content_empty_document_is_200_not_404(client, auth_headers, install_client):
    """An empty-text document is NOT a missing document.

    `kb.py` folds "No content available for this document." into a 404 for the agent. The
    Library renders its own empty arm and must not be told the document is gone.
    """
    install_client(_owned_doc(""))
    res = client.get(f"/documents/{DOC_ID}/content", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["content"] == ""
    assert body["total_lines"] == 0
    assert body["has_more"] is False
    assert body["filename"] == "report.md"


def test_content_foreign_document_is_404(client, auth_headers, install_client):
    install_client(_foreign())
    res = client.get(f"/documents/{FOREIGN_ID}/content", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


def test_content_has_more_is_true_only_while_lines_remain(client, auth_headers, install_client):
    install_client(_owned_doc("\n".join(f"L{i}" for i in range(1, 11))))
    partial = client.get(f"/documents/{DOC_ID}/content?start_line=1&end_line=3", headers=auth_headers)
    assert partial.json()["has_more"] is True
    whole = client.get(f"/documents/{DOC_ID}/content?start_line=1&end_line=10", headers=auth_headers)
    assert whole.json()["has_more"] is False
    assert whole.json()["end_line"] == 10


def test_content_omitted_end_line_serves_one_bounded_page(client, auth_headers, install_client):
    """T-217-07 — an omitted range is ONE page, never the whole document."""
    from app.api.documents import CONTENT_PAGE_LINES

    install_client(_owned_doc("\n".join(f"L{i}" for i in range(1, 1201))))
    res = client.get(f"/documents/{DOC_ID}/content", headers=auth_headers)
    body = res.json()
    assert body["end_line"] == CONTENT_PAGE_LINES
    assert len(body["content"].splitlines()) == CONTENT_PAGE_LINES
    assert body["total_lines"] == 1200
    assert body["has_more"] is True


def test_content_explicit_span_is_capped(client, auth_headers, install_client):
    """A caller cannot request an unbounded body by naming a huge end_line."""
    from app.api.documents import CONTENT_MAX_LINES

    install_client(_owned_doc("\n".join(f"L{i}" for i in range(1, 5001))))
    res = client.get(f"/documents/{DOC_ID}/content?start_line=1&end_line=999999", headers=auth_headers)
    body = res.json()
    assert body["end_line"] == CONTENT_MAX_LINES
    assert body["has_more"] is True


def test_content_page_past_the_end_is_200_with_honest_total(client, auth_headers, install_client):
    """A page that starts past the end is an empty page, not an error — and it still
    reports the REAL total_lines, so the client can correct itself."""
    install_client(_owned_doc("alpha\nbeta\ngamma"))
    res = client.get(f"/documents/{DOC_ID}/content?start_line=9999", headers=auth_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["content"] == ""
    assert body["total_lines"] == 3
    assert body["has_more"] is False


def test_content_rejects_a_zero_start_line(client, auth_headers, install_client):
    """`Query(ge=1)` is part of the DoS bound, not decoration."""
    install_client(_owned_doc("alpha"))
    assert client.get(f"/documents/{DOC_ID}/content?start_line=0", headers=auth_headers).status_code == 422


# ── /chunks ───────────────────────────────────────────────────────────────────────────

def _with_children(chunks=(), tables=(), images=(), visible_as="owner"):
    def resolve(b):
        if b.table == "documents":
            if visible_as == "owner":
                if ("eq", "user_id", OWNER) not in b.filters:
                    return None
            else:  # reachable only through someone else's globally-visible folder
                if ("eq", "user_id", OWNER) in b.filters:
                    return None
                if not any(f[0] == "in" and f[1] == "folder_id" for f in b.filters):
                    return None
            if "full_markdown" in b.select_arg:
                return {"id": DOC_ID, "filename": "shared.pdf", "full_markdown": "one\ntwo"}
            return {"id": DOC_ID, "filename": "shared.pdf", "user_id": OWNER, "folder_id": "f-1"}
        return {"document_chunks": list(chunks),
                "document_tables": list(tables),
                "document_images": list(images)}.get(b.table, [])
    return resolve


CHUNK = {"id": "33333333-3333-3333-3333-333333333333", "chunk_index": 0,
         "content": "chunk text", "embedding_model": "text-embedding-3-small",
         "embedding_dimensions": 1536}
TABLE = {"id": "44444444-4444-4444-4444-444444444444", "page": 2, "table_index": 0,
         "headers": ["A", "B"], "rows": [["1", "2"]], "extractor": "docling"}
IMAGE = {"id": "55555555-5555-5555-5555-555555555555", "page": 1, "image_index": 0,
         "description": "a bar chart"}


def test_chunks_200_shape_carries_embedding_lineage(client, auth_headers, install_client):
    """D-217-08 — per-chunk `embedding_model` is the point: it varies mid-re-embed."""
    c = install_client(_with_children(chunks=[CHUNK]))
    res = client.get(f"/documents/{DOC_ID}/chunks", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert res.json() == [CHUNK]
    chunk_read = [b for b in c.calls if b.table == "document_chunks"][0]
    assert ("eq", "document_id", DOC_ID) in chunk_read.filters
    assert chunk_read.ordered == "chunk_index"


def test_chunks_empty_is_200_empty_list(client, auth_headers, install_client):
    install_client(_with_children(chunks=[]))
    res = client.get(f"/documents/{DOC_ID}/chunks", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_chunks_foreign_document_is_404(client, auth_headers, install_client):
    install_client(_foreign())
    res = client.get(f"/documents/{FOREIGN_ID}/chunks", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


# ── /tables ───────────────────────────────────────────────────────────────────────────

def test_tables_200_shape(client, auth_headers, install_client):
    c = install_client(_with_children(tables=[TABLE]))
    res = client.get(f"/documents/{DOC_ID}/tables", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert res.json() == [TABLE]
    assert [b for b in c.calls if b.table == "document_tables"][0].ordered == "table_index"


def test_tables_empty_is_200_empty_list(client, auth_headers, install_client):
    """A document with no tables is not an error — the count badge already reads 0."""
    install_client(_with_children(tables=[]))
    res = client.get(f"/documents/{DOC_ID}/tables", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_tables_foreign_document_is_404(client, auth_headers, install_client):
    install_client(_foreign())
    res = client.get(f"/documents/{FOREIGN_ID}/tables", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


# ── /images ───────────────────────────────────────────────────────────────────────────

def test_images_200_shape(client, auth_headers, install_client):
    c = install_client(_with_children(images=[IMAGE]))
    res = client.get(f"/documents/{DOC_ID}/images", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert res.json() == [IMAGE]
    assert [b for b in c.calls if b.table == "document_images"][0].ordered == "image_index"


def test_images_wire_shape_promises_no_picture(client, auth_headers, install_client):
    """The table stores no bytes — the encoded PNG is handed to the vision model and
    DISCARDED. Asserted over the SERIALIZED keys, which a source grep cannot see."""
    install_client(_with_children(images=[IMAGE]))
    body = client.get(f"/documents/{DOC_ID}/images", headers=auth_headers).json()
    assert set(body[0]) == {"id", "page", "image_index", "description"}


def test_images_foreign_document_is_404(client, auth_headers, install_client):
    install_client(_foreign())
    res = client.get(f"/documents/{FOREIGN_ID}/images", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Document not found"


# ── The shared-folder asymmetry — CORRECT BEHAVIOUR, pinned ───────────────────────────

def test_globally_visible_folder_document_yields_chunks_but_no_tables_or_images(
    client, auth_headers, install_client, monkeypatch
):
    """⭐ THIS IS CORRECT BEHAVIOUR AND MUST NOT BE "FIXED".

    A document reachable only through SOMEONE ELSE'S globally-visible folder returns text
    and chunks, and EMPTY lists of tables and images, because the RLS policies are not
    symmetric:

    * `document_chunks` SELECT was WIDENED to owner-OR-globally-visible-folder by
      `110_secdef_org_scope_audit.sql:215-223` (PRAG-01 / D-164-07).
    * `document_tables` and `document_images` were left owner-only by
      `108_rls_membership_rewrite.sql:180-189` — one `FOR ALL` policy, `user_id = auth.uid()`,
      no folder branch.

    The panel does not lie about it: `list_documents`' `table_count` / `image_count`
    aggregate runs through the same user-JWT client, so the row's badge already reads 0.
    Widening those policies is a migration and a security decision — out of this phase.

    The mock reproduces the POLICY, not the route: the child tables answer `[]` here the
    way Postgres would, and the routes are asked whether they turn that into an error.
    """
    async def _shared(supabase, user_id):
        return ["f-1"]

    monkeypatch.setattr("app.api.documents.get_globally_visible_folder_ids", _shared)
    monkeypatch.setattr("app.api.kb.get_globally_visible_folder_ids", _shared)
    install_client(_with_children(chunks=[CHUNK], tables=[], images=[], visible_as="folder"))

    chunks = client.get(f"/documents/{DOC_ID}/chunks", headers=auth_headers)
    assert chunks.status_code == 200 and chunks.json() == [CHUNK]

    tables = client.get(f"/documents/{DOC_ID}/tables", headers=auth_headers)
    assert tables.status_code == 200, "an owner-only child table must not 404 the parent"
    assert tables.json() == []

    images = client.get(f"/documents/{DOC_ID}/images", headers=auth_headers)
    assert images.status_code == 200
    assert images.json() == []

    content = client.get(f"/documents/{DOC_ID}/content", headers=auth_headers)
    assert content.status_code == 200 and content.json()["total_lines"] == 2


# ── The security gate, from the query log ─────────────────────────────────────────────

def test_visibility_gate_filters_on_the_caller_id(client, auth_headers, install_client):
    """T-217-04 — `document_id` is never an authorization claim on its own.

    Read from the client's own call log rather than from the source, and pinned
    POSITIONALLY so a future edit cannot demote the owner filter below the id filter.
    """
    c = install_client(_with_children(chunks=[CHUNK]))
    assert client.get(f"/documents/{DOC_ID}/chunks", headers=auth_headers).status_code == 200
    gate = [b for b in c.calls if b.table == "documents"][0]
    assert ("eq", "user_id", OWNER) in gate.filters, gate.filters
    assert gate.is_single, "the parent check must be a single-row lookup"


# ── The source fence, with its own non-vacuity control ────────────────────────────────

def _new_route_region() -> str:
    src = DOCUMENTS_PY.read_text(encoding="utf-8")
    start = src.index("# ── Phase 217 · LIB-04")
    end = src.index('@router.post("/{document_id}/restore"')
    return src[start:end]


def test_new_route_region_extracts_non_vacuously():
    """The control for the fence below. A regex that matched NOTHING would satisfy every
    absence assertion for free, so the region is proven non-empty and proven to contain
    all four route decorators before anything is asserted about its absences."""
    region = _new_route_region()
    assert len(region) > 2000, f"region is only {len(region)} chars — the anchors moved"
    for decorator in ('/{document_id}/content"', '/{document_id}/chunks"',
                      '/{document_id}/tables"', '/{document_id}/images"'):
        assert decorator in region, f"{decorator} is not inside the extracted region"


def test_no_blocking_query_inside_the_four_new_routes():
    """D-v2.5-01 / T-217-08 — every new query runs off the event loop.

    The two nearest neighbours in the same file violate this in shipped code; the fence is
    scoped to the region this plan authored so it measures THIS work, not that debt.
    """
    region = _new_route_region()
    assert ".execute()" not in region, "a bare synchronous query sits inside the new routes"
    assert len(re.findall(r"await aexec\(", region)) >= 4, "the new routes do not all use aexec"
