"""Phase 274 plan 02 Task 1 (ATT-03 / D-13 / D-14) — THE PREVIEW MUST AGREE WITH THE MINTER.

The Save-to-Library dialog warns *before* confirming: "already in the Library, in <folder>" (D-13)
or "this will become version N" (D-14). Those sentences are only true if the read-only preview asks
the same two questions `ingest_splice.mint_document_row` asks when the person confirms:

  - dedup: user_id + content_hash + status='completed' (+ org_id when passed)
  - folder-scoped version: user_id + filename (+ org_id) + folder_id

`ingest_splice.py` is a FIRING hot file and stays byte-unchanged, so the preview DUPLICATES the two
predicates instead of sharing a helper. This file is what pins the duplication: each case builds
ONE fake table state, asks the preview, then runs the REAL minter over the same state, and asserts
that the two agree.

⭐ The fake supabase EVALUATES its filters over in-memory rows rather than returning scripted
results in call order. A scripted mock would agree with any query the preview made, which is the
exact drift this file exists to catch.

Every case is in-memory: no database row is created by this file.
"""
from __future__ import annotations

import copy
import hashlib

import pytest

from app.services import ingest_splice

USER = "33333333-3333-4333-8333-333333333333"
ORG = "22222222-2222-4222-8222-222222222222"
FOLDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
FOLDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
NAME = "Meridian-Q4-pricing.xlsx"


# ── an in-memory supabase that really filters ─────────────────────────────────────────────
class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db: dict, table: str):
        self._db = db
        self._table = table
        self._op = "select"
        self._payload = None
        self._filters: list = []
        self._order: tuple | None = None
        self._limit: int | None = None
        self._single = False

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def eq(self, col, val):
        self._filters.append(lambda r: r.get(col) == val)
        return self

    def neq(self, col, val):
        self._filters.append(lambda r: r.get(col) != val)
        return self

    def is_(self, col, val):
        assert val == "null"
        self._filters.append(lambda r: r.get(col) is None)
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def maybe_single(self):
        self._single = True
        return self

    def execute(self):
        rows = self._db.setdefault(self._table, [])
        if self._op == "insert":
            row = copy.deepcopy(self._payload)
            rows.append(row)
            return _Result([copy.deepcopy(row)])
        matched = [r for r in rows if all(f(r) for f in self._filters)]
        if self._op == "update":
            for r in matched:
                r.update(self._payload)
            return _Result([copy.deepcopy(r) for r in matched])
        if self._order:
            col, desc = self._order
            matched = sorted(matched, key=lambda r: r.get(col) or 0, reverse=desc)
        if self._limit is not None:
            matched = matched[: self._limit]
        out = [copy.deepcopy(r) for r in matched]
        if self._single:
            return _Result(out[0] if out else None)
        return _Result(out)


class _FakeSupabase:
    def __init__(self, db: dict):
        self.db = db

    def table(self, name: str):
        return _Query(self.db, name)


def _db(*docs: dict) -> dict:
    return {
        "folders": [
            {"id": FOLDER_A, "user_id": USER},
            {"id": FOLDER_B, "user_id": USER},
        ],
        "documents": [copy.deepcopy(d) for d in docs],
    }


def _doc(*, id: str, folder_id: str, raw: bytes, version: int = 1, filename: str = NAME) -> dict:
    return {
        "id": id,
        "user_id": USER,
        "org_id": ORG,
        "filename": filename,
        "folder_id": folder_id,
        "content_hash": hashlib.sha256(raw).hexdigest(),
        "status": "completed",
        "version_number": version,
        "is_latest": True,
        "file_path": f"{USER}/{id}/{filename}",
    }


async def _preview_then_mint(db: dict, *, raw: bytes, folder_id: str = FOLDER_A):
    from app.api.workspace_promote import preview_promotion

    sb = _FakeSupabase(db)
    preview = await preview_promotion(
        sb, raw=raw, filename=NAME, user_id=USER, org_id=ORG, folder_id=folder_id,
    )
    mint = ingest_splice.mint_document_row(
        raw=raw,
        filename=NAME,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        user_id=USER,
        supabase=sb,
        folder_id=folder_id,
        org_id=ORG,
        on_conflict="link",
        version_scope="folder",
    )
    return preview, mint


def _assert_parity(preview, mint):
    # BOTH halves, on every case: the dedup answer and the version answer.
    assert (preview.duplicate_of is not None) == mint.is_duplicate
    assert preview.next_version == mint.version_number


# ── the four cases ─────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_parity_fresh_file():
    """PLANT to drive RED: start `next_version` at 0, or report a duplicate on an empty table."""
    db = _db()
    preview, mint = await _preview_then_mint(db, raw=b"fresh bytes")

    assert preview.duplicate_of is None
    assert preview.next_version == 1
    assert mint.is_duplicate is False and mint.version_number == 1
    _assert_parity(preview, mint)


@pytest.mark.asyncio
async def test_parity_same_name_same_folder_is_the_next_version():
    """PLANT to drive RED: drop the filename predicate from the preview's version query."""
    db = _db(_doc(id="doc-v1", folder_id=FOLDER_A, raw=b"old bytes"))
    preview, mint = await _preview_then_mint(db, raw=b"new bytes")

    assert preview.duplicate_of is None
    assert preview.next_version == 2
    assert mint.is_duplicate is False and mint.version_number == 2
    _assert_parity(preview, mint)


@pytest.mark.asyncio
async def test_parity_same_name_other_folder_is_a_fresh_v1_and_retires_nothing():
    """PLANT to drive RED: drop the folder predicate from the preview's version query (it then
    says "version 2" while the minter mints a v1). T-274-12: the other folder's document keeps
    `is_latest`, because the route passes `version_scope="folder"`."""
    db = _db(_doc(id="doc-other", folder_id=FOLDER_B, raw=b"old bytes"))
    preview, mint = await _preview_then_mint(db, raw=b"new bytes")

    assert preview.duplicate_of is None
    assert preview.next_version == 1
    assert mint.is_duplicate is False and mint.version_number == 1
    other = next(d for d in db["documents"] if d["id"] == "doc-other")
    assert other["is_latest"] is True, "a same-named file in ANOTHER folder must never be retired"
    _assert_parity(preview, mint)


@pytest.mark.asyncio
async def test_parity_same_bytes_other_folder_is_already_in_the_library_there():
    """PLANT to drive RED: add a folder predicate to the preview's dedup query (it then misses
    the copy that lives in another folder, which the minter still finds). D-13: the answer names
    the EXISTING copy's folder, not the one picked."""
    raw = b"the very same bytes"
    db = _db(_doc(id="doc-existing", folder_id=FOLDER_B, raw=raw, version=3))
    before = len(db["documents"])
    preview, mint = await _preview_then_mint(db, raw=raw, folder_id=FOLDER_A)

    assert preview.duplicate_of is not None
    assert preview.duplicate_of.document_id == "doc-existing"
    assert preview.duplicate_of.folder_id == FOLDER_B
    assert mint.is_duplicate is True
    assert mint.document["id"] == "doc-existing"
    assert len(db["documents"]) == before, "a duplicate mints nothing"
    _assert_parity(preview, mint)


# ── 274 review CR-02 · the first copy is still INDEXING ───────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize("folder_of_first", [FOLDER_A, FOLDER_B], ids=["same-folder", "other-folder"])
async def test_parity_same_bytes_first_copy_still_pending_is_linked_and_keeps_is_latest(folder_of_first):
    """PLANT to drive RED: keep the dedup `completed`-only. The preview then promises "version 2"
    for byte-identical bytes, and the confirm RETIRES the pending first copy (`is_latest=False`) —
    the only copy leaves the Library list and search while both chips read "In Library"."""
    raw = b"bytes still being indexed"
    first = _doc(id="doc-pending", folder_id=folder_of_first, raw=raw)
    first["status"] = "pending"
    db = _db(first)
    preview, mint = await _preview_then_mint(db, raw=raw, folder_id=FOLDER_A)

    assert preview.duplicate_of is not None, "a same-bytes copy still indexing is already in the Library"
    assert preview.duplicate_of.document_id == "doc-pending"
    assert preview.duplicate_of.folder_id == folder_of_first
    assert mint.is_duplicate is True
    assert mint.document["id"] == "doc-pending"
    assert len(db["documents"]) == 1, "nothing is minted"
    assert db["documents"][0]["is_latest"] is True, "the first copy is never retired"
    _assert_parity(preview, mint)
