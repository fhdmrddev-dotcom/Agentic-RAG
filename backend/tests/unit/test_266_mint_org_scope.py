"""Phase 266 (PACK-19 / D-266-18) — mint_document_row is org-contained when an org is passed.

The defect this pins (RESEARCH Pitfall 2): every query `mint_document_row` issues was scoped by
`user_id` alone. For a person who belongs to TWO orgs, installing an Expert in org B would

  (a) find org A's copy of the same bytes in the dedup check and return it as "already here" — so
      org B gets no document at all, and
  (c) retire org A's `is_latest` flag when minting org B's copy — and retrieval requires
      `is_latest`, so org A's knowledge silently disappears from search.

Each of the four sites — (a) dedup, (b) version lookup, (c) is_latest retirement, (d) the
on_conflict="link" re-query — is asserted SEPARATELY. "`eq('org_id')` appears somewhere" would stay
green with three of the four sites unscoped.

And the other direction, which matters as much: `/upload` passes NO org_id, and with org_id=None the
function must issue exactly the queries it issued at base — the full filter sequence is pinned.

The Supabase client here is a small in-memory fake that APPLIES the filters it is given, so a
missing org predicate produces the wrong row rather than merely a missing call.
"""

from __future__ import annotations

import hashlib
from typing import Any

import pytest
from fastapi import HTTPException

from app.services.ingest_splice import mint_document_row

USER = "00000000-0000-0000-0000-000000000001"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
RAW = b"# ACME Q3 report bytes"
HASH = hashlib.sha256(RAW).hexdigest()
FILENAME = "acme_q3_2026_financial_report.md"
MIME = "text/markdown"

_FILTERS = ("eq", "neq", "is_")


class _Result:
    def __init__(self, data):
        self.data = data


class _Site:
    """One query as issued: its kind, its payload, and every chained call in order."""

    def __init__(self, db: "_FakeDB", kind: str, arg: Any):
        self.db = db
        self.kind = kind
        self.arg = arg
        self.calls: list[tuple[str, tuple, dict]] = []

    def _rec(name):  # noqa: N805 — builder factory
        def method(self, *a, **k):
            self.calls.append((name, a, k))
            return self

        return method

    eq = _rec("eq")
    neq = _rec("neq")
    is_ = _rec("is_")
    order = _rec("order")
    limit = _rec("limit")
    maybe_single = _rec("maybe_single")

    # -- evaluation -------------------------------------------------------------------------

    def _matches(self, row: dict) -> bool:
        for name, a, _ in self.calls:
            if name == "eq" and row.get(a[0]) != a[1]:
                return False
            if name == "neq" and row.get(a[0]) == a[1]:
                return False
            if name == "is_" and a[1] == "null" and row.get(a[0]) is not None:
                return False
        return True

    def filters(self) -> list[tuple]:
        return [(n, a) for n, a, _ in self.calls if n in _FILTERS]

    def has_org(self, org: str) -> bool:
        return ("eq", ("org_id", org)) in self.filters()

    def execute(self):
        if self.kind == "insert":
            if self.db.insert_error is not None:
                raise self.db.insert_error
            self.db.rows.append(dict(self.arg))
            return _Result([dict(self.arg)])
        matched = [r for r in self.db.rows if self._matches(r)]
        if self.kind == "update":
            for r in matched:
                r.update(self.arg)
            return _Result([dict(r) for r in matched])
        for name, a, k in self.calls:
            if name == "order":
                matched.sort(key=lambda r: r.get(a[0]) or 0, reverse=bool(k.get("desc")))
        for name, a, _ in self.calls:
            if name == "limit":
                matched = matched[: a[0]]
        return _Result([dict(r) for r in matched])


class _FakeTable:
    def __init__(self, db: "_FakeDB"):
        self.db = db

    def _site(self, kind, arg):
        s = _Site(self.db, kind, arg)
        self.db.sites.append(s)
        return s

    def select(self, cols="*"):
        return self._site("select", cols)

    def update(self, payload):
        return self._site("update", payload)

    def insert(self, payload):
        return self._site("insert", payload)


class _FakeDB:
    def __init__(self, rows=None, insert_error: Exception | None = None):
        self.rows: list[dict] = [dict(r) for r in (rows or [])]
        self.sites: list[_Site] = []
        self.insert_error = insert_error

    def table(self, name):
        assert name == "documents", f"unexpected table {name!r}"
        return _FakeTable(self)

    # -- site lookup by role ------------------------------------------------------------------

    def dedup_site(self) -> _Site:
        return next(s for s in self.sites if s.kind == "select" and s.arg == "*"
                    and ("eq", ("status", "completed")) in s.filters())

    def version_site(self) -> _Site:
        return next(s for s in self.sites if s.kind == "select" and s.arg == "id, version_number")

    def retire_site(self) -> _Site:
        return next(s for s in self.sites if s.kind == "update" and s.arg == {"is_latest": False})

    def link_site(self) -> _Site:
        return next(s for s in self.sites if s.kind == "select" and s.arg == "*"
                    and ("neq", ("status", "failed")) in s.filters())


def _row(**over) -> dict:
    base = {
        "id": "doc-a",
        "user_id": USER,
        "org_id": ORG_A,
        "filename": FILENAME,
        "file_path": f"{USER}/doc-a/{FILENAME}",
        "content_hash": HASH,
        "status": "completed",
        "folder_id": None,
        "version_number": 1,
        "is_latest": True,
        "created_at": "2026-09-20T00:00:00Z",
    }
    base.update(over)
    return base


def _mint(db: _FakeDB, org_id: str | None, on_conflict: str = "raise"):
    return mint_document_row(
        raw=RAW,
        filename=FILENAME,
        mime_type=MIME,
        user_id=USER,
        supabase=db,  # type: ignore[arg-type]
        org_id=org_id,
        on_conflict=on_conflict,  # type: ignore[arg-type]
    )


def _all_sites_db(org: str | None) -> _FakeDB:
    """A row that misses dedup (pending), hits versioning (same filename) and is found by the
    link re-query after a 23505 — so ONE mint call reaches all four sites."""
    return _FakeDB(
        rows=[_row(org_id=org, status="pending")],
        insert_error=Exception("duplicate key value violates unique constraint (23505)"),
    )


# ---------------------------------------------------------------------------------------------
# Each site, separately, carries the org predicate when an org is passed
# ---------------------------------------------------------------------------------------------


def test_every_site_is_org_scoped_when_org_is_passed():
    db = _all_sites_db(ORG_A)
    res = _mint(db, ORG_A, on_conflict="link")
    assert res.is_duplicate is True  # linked to the pending row after the 23505

    assert db.dedup_site().has_org(ORG_A), "(a) dedup select is not org-scoped"
    assert db.version_site().has_org(ORG_A), "(b) version lookup is not org-scoped"
    assert db.retire_site().has_org(ORG_A), "(c) is_latest retirement is not org-scoped"
    assert db.link_site().has_org(ORG_A), "(d) on_conflict='link' re-query is not org-scoped"


# ---------------------------------------------------------------------------------------------
# /upload (org_id=None) issues exactly the base queries
# ---------------------------------------------------------------------------------------------

# The call sequence mint_document_row issued at the phase base (522e7b4fc) for this scenario.
_BASE_SEQUENCE = [
    ("select", "*", [
        ("eq", ("user_id", USER), {}),
        ("eq", ("content_hash", HASH), {}),
        ("eq", ("status", "completed"), {}),
        ("limit", (1,), {}),
    ]),
    ("select", "id, version_number", [
        ("eq", ("user_id", USER), {}),
        ("eq", ("filename", FILENAME), {}),
        ("order", ("version_number",), {"desc": True}),
        ("limit", (1,), {}),
    ]),
    ("update", {"is_latest": False}, [
        ("eq", ("user_id", USER), {}),
        ("eq", ("filename", FILENAME), {}),
    ]),
    ("insert", None, []),
    ("select", "*", [
        ("eq", ("user_id", USER), {}),
        ("eq", ("content_hash", HASH), {}),
        ("neq", ("status", "failed"), {}),
        ("is_", ("folder_id", "null"), {}),
        ("order", ("created_at",), {"desc": True}),
        ("limit", (1,), {}),
    ]),
]


def test_upload_path_without_org_issues_the_base_queries_exactly():
    db = _all_sites_db(None)
    res = _mint(db, None, on_conflict="link")
    assert res.is_duplicate is True

    issued = [
        (s.kind, None if s.kind == "insert" else s.arg, s.calls) for s in db.sites
    ]
    assert issued == _BASE_SEQUENCE
    for s in db.sites:
        assert not any(n == "eq" and a[0] == "org_id" for n, a in s.filters()), s.kind


def test_upload_path_insert_payload_carries_no_org_id():
    db = _FakeDB()
    res = _mint(db, None)
    assert res.is_duplicate is False
    assert "org_id" not in db.rows[-1]


# ---------------------------------------------------------------------------------------------
# Behaviour a two-org admin actually sees
# ---------------------------------------------------------------------------------------------


def test_dedup_hit_is_only_reachable_from_the_same_org():
    """Org A holds a completed copy of the same bytes. Installing in org B mints org B's own copy."""
    db = _FakeDB(rows=[_row(org_id=ORG_A, status="completed")])
    res = _mint(db, ORG_B)

    assert res.is_duplicate is False, "org A's document was returned as org B's 'already here'"
    inserted = db.rows[-1]
    assert inserted["org_id"] == ORG_B
    assert inserted["id"] != "doc-a"


def test_dedup_hit_in_the_same_org_is_still_a_duplicate():
    db = _FakeDB(rows=[_row(org_id=ORG_A, status="completed")])
    res = _mint(db, ORG_A)
    assert res.is_duplicate is True
    assert res.document["id"] == "doc-a"


def test_versioning_and_retirement_never_touch_another_orgs_row():
    """Same user + filename exists in org A (different bytes). Org B's copy is version 1, and
    org A's row stays is_latest — retrieval requires is_latest, so retiring it would erase org A's
    knowledge from search."""
    db = _FakeDB(rows=[_row(org_id=ORG_A, content_hash="other-hash", status="completed")])
    res = _mint(db, ORG_B)

    assert res.is_duplicate is False
    assert res.version_number == 1
    org_a_row = next(r for r in db.rows if r["id"] == "doc-a")
    assert org_a_row["is_latest"] is True, "org A's row was un-latested by org B's install"
    # Nothing was retired, so the retirement update was never issued.
    assert not any(s.kind == "update" for s in db.sites)


def test_retirement_update_is_filtered_by_the_installing_org():
    db = _FakeDB(rows=[
        _row(id="doc-a", org_id=ORG_A, content_hash="h-a", status="completed"),
        _row(id="doc-b", org_id=ORG_B, content_hash="h-b", status="completed"),
    ])
    res = _mint(db, ORG_B)

    assert res.version_number == 2
    assert db.retire_site().has_org(ORG_B)
    by_id = {r["id"]: r for r in db.rows}
    assert by_id["doc-a"]["is_latest"] is True
    assert by_id["doc-b"]["is_latest"] is False


def test_link_requery_never_adopts_another_orgs_row():
    """A 23505 race in org B must not link to org A's non-failed copy of the same bytes."""
    db = _FakeDB(
        rows=[_row(org_id=ORG_A, status="pending", filename="other-name.md")],
        insert_error=Exception("23505 duplicate key"),
    )
    with pytest.raises(HTTPException) as exc:
        _mint(db, ORG_B, on_conflict="link")
    assert exc.value.status_code == 409
    assert db.link_site().has_org(ORG_B)


# ---------------------------------------------------------------------------------------------
# WR-03 (266 review) — the installer versions WITHIN its folder, never across the org
# ---------------------------------------------------------------------------------------------
# Versioning is keyed on (user_id, filename[, org_id]) and ignores the folder. So installing an
# Expert retired the installing admin's OWN same-named document anywhere in the org, and retrieval
# requires is_latest — the person's file silently left search. version_scope="folder" (the
# installer only) adds the folder to the version lookup and the retirement; /upload is unchanged.

INSTALL_FOLDER = "f0f0f0f0-0000-0000-0000-000000000001"
OTHER_FOLDER = "f0f0f0f0-0000-0000-0000-000000000002"


class _FolderFakeDB(_FakeDB):
    """Adds the folder-ownership probe step 1 makes; every folder belongs to USER."""

    def table(self, name):
        if name == "folders":
            return _FolderTable()
        return super().table(name)


class _FolderTable:
    def select(self, *_a, **_k):
        return self

    def eq(self, _col, value):
        self._id = value
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return _Result({"id": self._id, "user_id": USER})


def _mint_into(db: _FakeDB, folder_id: str, **kw):
    return mint_document_row(
        raw=RAW,
        filename=FILENAME,
        mime_type=MIME,
        user_id=USER,
        supabase=db,  # type: ignore[arg-type]
        folder_id=folder_id,
        org_id=ORG_A,
        on_conflict="link",
        **kw,
    )


def test_folder_scope_never_retires_a_same_named_document_in_another_folder():
    db = _FolderFakeDB(rows=[_row(id="mine", folder_id=OTHER_FOLDER, content_hash="h-mine")])
    res = _mint_into(db, INSTALL_FOLDER, version_scope="folder")

    assert res.version_number == 1
    assert next(r for r in db.rows if r["id"] == "mine")["is_latest"] is True, (
        "the admin's own file in another folder was un-latested by the install"
    )
    assert ("eq", ("folder_id", INSTALL_FOLDER)) in db.version_site().filters()


def test_folder_scope_still_versions_within_the_install_folder():
    db = _FolderFakeDB(rows=[_row(id="old", folder_id=INSTALL_FOLDER, content_hash="h-old")])
    res = _mint_into(db, INSTALL_FOLDER, version_scope="folder")

    assert res.version_number == 2
    assert ("eq", ("folder_id", INSTALL_FOLDER)) in db.retire_site().filters()
    assert next(r for r in db.rows if r["id"] == "old")["is_latest"] is False


def test_default_scope_is_unchanged_and_carries_no_folder_predicate():
    db = _FolderFakeDB(rows=[_row(id="mine", folder_id=OTHER_FOLDER, content_hash="h-mine")])
    res = _mint_into(db, INSTALL_FOLDER)

    assert res.version_number == 2
    assert not any(f[1][0] == "folder_id" for f in db.version_site().filters())
    assert not any(f[1][0] == "folder_id" for f in db.retire_site().filters())
