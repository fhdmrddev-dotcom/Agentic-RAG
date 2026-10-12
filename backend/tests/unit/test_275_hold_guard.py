"""Phase 275-01 (D-14 / D-15 / D-17 / D-32; revision B-1) — ``hold_guard``: the ONE Python home of the
hold check.

What this proves:

* **No cost on the happy path.** Nothing held → ``None``, and the caller's org permission is never
  looked up (a user-JWT round-trip per delete would be paid for nothing).
* **Folders are checked FIRST (B-1).** ``retention_held_folders`` runs before any document check, so
  a held EMPTY folder — which no document id can reveal — is still refused, before a row or byte moves.
* **The member never sees a matter (D-17).** The member refusal is the ported sentence EXACTLY, and
  the matter name appears nowhere in the payload; the org admin gets the name.
* **One 409 shape everywhere** — ``{code: "legal_hold", title, message, held_count}`` — whether the
  guard refused first or the database trigger refused a race (PostgREST ``PT409`` / asyncpg ``PT409``).
* **The receipt never masks the refusal.** One ``delete_refused`` receipt per held document is
  attempted through the service role; a failing write is logged and the 409 still raises.
* **Copy is ported, not re-typed (D-07).** Every ported fragment is found in the sketch itself.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import asyncpg
import pytest
from fastapi import HTTPException

from app.services.retention import hold_guard as hg

REPO_ROOT = Path(__file__).resolve().parents[3]
SKETCH = REPO_ROOT / ".planning" / "sketches" / "275-retention-legal-hold" / "index.html"

ORG = "11111111-1111-1111-1111-111111111111"
MATTER = "Halden v. Crane"
USER = {"id": "22222222-2222-2222-2222-222222222222", "email": "ada@example.com"}


class _Builder:
    def __init__(self, sb, table):
        self.sb, self.table, self.op, self.payload, self.filters = sb, table, "select", None, []

    def select(self, *_a, **_k):
        self.op = "select"
        return self

    def in_(self, col, values):
        self.filters.append((col, [str(v) for v in values]))
        return self

    def eq(self, col, value):
        self.filters.append((col, [str(value)]))
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def execute(self):
        self.sb.calls.append((self.table, self.op))
        if self.op == "insert":
            self.sb.inserts.append((self.table, self.payload))
            if self.sb.receipt_fails:
                raise RuntimeError("receipts table unreachable")
            return SimpleNamespace(data=[self.payload])
        rows = list(self.sb.tables.get(self.table, []))
        for col, values in self.filters:
            rows = [r for r in rows if str(r.get(col)) in values]
        return SimpleNamespace(data=rows)


class _Rpc:
    def __init__(self, sb, name, params):
        self.sb, self.name, self.params = sb, name, params

    def execute(self):
        self.sb.calls.append(("rpc", self.name))
        return SimpleNamespace(data=self.sb.rpc_results.get(self.name, []))


class FakeService:
    def __init__(self, *, held_docs=(), held_folders=(), receipt_fails=False):
        self.calls: list = []
        self.inserts: list = []
        self.receipt_fails = receipt_fails
        self.rpc_results = {
            "retention_held_documents": [
                {"document_id": d, "hold_id": "h1", "held_since": "2026-10-01T00:00:00+00:00"} for d in held_docs
            ],
            "retention_held_folders": [{"folder_id": f} for f in held_folders],
        }
        self.tables = {
            "legal_holds": [{
                "id": "h1", "org_id": ORG, "name": MATTER, "created_by_name": "Ada Admin",
                "created_at": "2026-10-01T09:00:00+00:00",
            }],
            "documents": [{"id": d, "filename": f"{d}.pdf", "org_id": ORG} for d in held_docs],
            "folders": [{"id": f, "org_id": ORG} for f in held_folders],
        }

    def rpc(self, name, params):
        return _Rpc(self, name, params)

    def table(self, name):
        return _Builder(self, name)


@pytest.fixture
def perm(monkeypatch):
    seen = {"calls": 0, "allowed": False}

    async def fake(_request, _user, org_id, key):
        seen["calls"] += 1
        assert key == "org:manage" and org_id == ORG
        return seen["allowed"]

    monkeypatch.setattr("app.dependencies._has_org_permission", fake)
    return seen


async def _refusal(sb, ids, **kw) -> HTTPException:
    with pytest.raises(HTTPException) as exc:
        await hg.assert_none_held(object(), USER, ids, service_supabase=sb, **kw)
    assert exc.value.status_code == 409
    return exc.value


# ── the happy path ─────────────────────────────────────────────────────────────────────────

async def test_nothing_held_returns_none_and_never_reads_the_permission(perm):
    sb = FakeService()
    assert await hg.assert_none_held(object(), USER, ["d1", "d2"], kind="document", service_supabase=sb) is None
    assert perm["calls"] == 0, "the org permission must not be looked up when nothing is held"
    assert sb.inserts == []


# ── D-17: member vs admin ──────────────────────────────────────────────────────────────────

async def test_member_gets_the_ported_sentence_and_no_matter_name(perm):
    perm["allowed"] = False
    sb = FakeService(held_docs=["d1"])
    err = await _refusal(sb, ["d1"], kind="document")
    assert err.detail["code"] == "legal_hold"
    assert err.detail["title"] == "Can't delete."
    assert err.detail["message"] == "This document is on legal hold. Ask an org admin if you think it should be released."
    assert err.detail["held_count"] == 1
    assert MATTER not in str(err.detail) and "Halden" not in repr(err.detail), "D-17: the matter leaked to a member"


async def test_admin_gets_the_matter_name(perm):
    perm["allowed"] = True
    sb = FakeService(held_docs=["d1"])
    err = await _refusal(sb, ["d1"], kind="document")
    assert err.detail["message"] == (
        "This document is on legal hold (“Halden v. Crane”). Release the hold in Org admin → Retention first."
    )


async def test_folder_with_held_documents_uses_the_count_sentence(perm):
    sb = FakeService(held_docs=["d1", "d2"])
    perm["allowed"] = False
    err = await _refusal(sb, ["d1", "d2", "d3"], kind="folder")
    assert err.detail["message"] == "This folder has 2 documents on legal hold. Nothing was deleted. Ask an org admin."
    assert err.detail["held_count"] == 2
    perm["allowed"] = True
    err = await _refusal(sb, ["d1", "d2", "d3"], kind="folder")
    assert err.detail["message"] == (
        "This folder has 2 documents on legal hold. Nothing was deleted. Release the hold in Org admin → Retention first."
    )


# ── B-1: folders first ─────────────────────────────────────────────────────────────────────

async def test_a_held_empty_folder_is_refused_before_any_document_check(perm):
    sb = FakeService(held_folders=["f-empty"])
    err = await _refusal(sb, [], kind="folder", folder_ids=["f-root", "f-empty"])
    assert err.detail["message"] == "This folder is on legal hold. Nothing was deleted. Ask an org admin."
    rpcs = [name for kind, name in sb.calls if kind == "rpc"]
    assert rpcs and rpcs[0] == "retention_held_folders", f"folders must be checked FIRST: {rpcs}"


async def test_held_folders_plus_held_documents_use_the_count_sentence(perm):
    perm["allowed"] = True
    sb = FakeService(held_docs=["d1", "d2", "d3"], held_folders=["f1"])
    err = await _refusal(sb, ["d1", "d2", "d3"], kind="folder", folder_ids=["f1"])
    assert err.detail["message"].startswith("This folder has 3 documents on legal hold. Nothing was deleted.")
    assert err.detail["held_count"] == 3


# ── the watch doors ────────────────────────────────────────────────────────────────────────

async def test_watch_purge_and_watch_delete_sentences(perm):
    sb = FakeService(held_docs=["d1", "d2"])
    perm["allowed"] = False
    err = await _refusal(sb, ["d1", "d2"], kind="watch_purge")
    assert err.detail["message"] == "2 of this watch's missing files are on legal hold. Nothing was purged. Ask an org admin."
    perm["allowed"] = True
    err = await _refusal(sb, ["d1", "d2"], kind="watch_purge")
    assert err.detail["message"] == "2 of this watch's missing files are on legal hold. Nothing was purged."
    err = await _refusal(sb, ["d1", "d2"], kind="watch_delete")
    assert err.detail["message"].endswith("Nothing was deleted.")


# ── receipts ───────────────────────────────────────────────────────────────────────────────

async def test_one_delete_refused_receipt_per_held_document(perm):
    sb = FakeService(held_docs=["d1", "d2"])
    await _refusal(sb, ["d1", "d2", "d9"], kind="document")
    receipts = [p for t, p in sb.inserts if t == "retention_receipts"]
    assert len(receipts) == 1, "one batched insert"
    rows = receipts[0]
    assert {r["document_id"] for r in rows} == {"d1", "d2"}
    for r in rows:
        assert r["action"] == "delete_refused" and r["org_id"] == ORG and r["actor_id"] == USER["id"]
        assert r["hold_name"] == MATTER, "receipts are org:manage-only (RLS) and carry the matter"


async def test_a_failing_receipt_write_never_masks_the_refusal(perm, caplog):
    sb = FakeService(held_docs=["d1"], receipt_fails=True)
    err = await _refusal(sb, ["d1"], kind="document")
    assert err.detail["code"] == "legal_hold"
    assert any("receipt" in rec.getMessage().lower() for rec in caplog.records), "the failure must be logged"


# ── the database backstop maps to the same 409 ─────────────────────────────────────────────

class _PostgrestErr(Exception):
    def __init__(self, code):
        super().__init__({"code": code, "message": "document 1 is on legal hold"})
        self.code = code


class _PgErr(asyncpg.PostgresError):
    sqlstate = "PT409"


def test_map_hold_refusal_maps_postgrest_and_asyncpg_pt409():
    for exc in (_PostgrestErr("PT409"), _PgErr("document 1 is on legal hold")):
        with pytest.raises(HTTPException) as caught:
            with hg.map_hold_refusal(kind="document"):
                raise exc
        assert caught.value.status_code == 409
        assert caught.value.detail == {
            "code": "legal_hold", "title": "Can't delete.",
            "message": "This document is on legal hold. Ask an org admin if you think it should be released.",
            "held_count": 1,
        }


def test_map_hold_refusal_folder_without_a_count_and_as_admin():
    with pytest.raises(HTTPException) as caught:
        with hg.map_hold_refusal(kind="folder"):
            raise _PostgrestErr("PT409")
    assert caught.value.detail["message"] == "This folder is on legal hold. Nothing was deleted. Ask an org admin."
    with pytest.raises(HTTPException) as caught:
        with hg.map_hold_refusal(kind="folder", can_manage=True):
            raise _PostgrestErr("PT409")
    assert caught.value.detail["message"] == (
        "This folder is on legal hold. Nothing was deleted. Release the hold in Org admin → Retention first."
    )


def test_map_hold_refusal_lets_every_other_error_through():
    for exc in (_PostgrestErr("23503"), RuntimeError("boom"), ValueError("x")):
        with pytest.raises(type(exc)):
            with hg.map_hold_refusal(kind="document"):
                raise exc


def test_hold_refusal_to_http_shape():
    http = hg.HoldRefusal(kind="document", held_count=2, title="Can't delete.", message="m").to_http()
    assert isinstance(http, HTTPException) and http.status_code == 409
    assert http.detail == {"code": "legal_hold", "title": "Can't delete.", "message": "m", "held_count": 2}


# ── the S8 hold line ───────────────────────────────────────────────────────────────────────

def test_hold_line_for_member_is_exact_and_admin_names_the_matter():
    assert hg.hold_line_for(can_manage=False, matter=MATTER, placed_by="Ada", placed_at=None) == (
        "On legal hold. Ask an org admin."
    )
    line = hg.hold_line_for(
        can_manage=True, matter=MATTER, placed_by="Ada Admin",
        placed_at=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
    )
    assert line == (
        "On legal hold — “Halden v. Crane”, placed by Ada Admin on 1 Oct 2026. "
        "It can't be deleted or disposed of until the hold is released."
    )


# ── D-07: ported, not re-typed ─────────────────────────────────────────────────────────────

def test_every_ported_fragment_is_in_the_sketch():
    sketch = SKETCH.read_text(encoding="utf-8")
    assert len(sketch) > 10000, "non-vacuity: the sketch source is real"
    for fragment in (
        hg.REFUSAL_TITLE,
        "Ask an org admin if you think it should be released.",
        "Release the hold in Org admin → Retention first.",
        "This document is on legal hold",
        "It can't be deleted or disposed of until the hold is released.",
        "On legal hold",
    ):
        assert fragment in sketch, f"not ported from the sketch: {fragment!r}"


def test_audit_action_types_cover_retention_and_the_watch_types():
    from app.services.audit_service import VALID_ACTION_TYPES

    for t in (
        "retention.policy.create", "retention.policy.update", "retention.policy.delete",
        "retention.hold.create", "retention.hold.update", "retention.hold.release",
        "retention.disposition.confirm", "retention.document.unarchive", "retention.document.keep",
        "folder.delete", "connector.watch.create", "connector.watch.delete", "connector.watch.sync",
    ):
        assert t in VALID_ACTION_TYPES, t
