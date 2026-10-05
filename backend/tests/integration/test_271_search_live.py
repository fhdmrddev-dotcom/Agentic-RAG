"""Phase 271 (SC#1, SC#3; D-04, D-05, D-06, D-07; P-02, P-05) — Find, proven on stored rows.

Every case calls the ROUTE coroutine (``app.api.document_search.search``) with a real user
client (ANON key + a GoTrue access token, the ``get_user_supabase`` shape), so the whole
path runs: Pydantic model → core → PostgREST under RLS. Rows are seeded into a FRESH org
with every org column explicit, so the caller's visible set is exactly what this file
seeded, and each assertion compares an exact id SET — never a count.

The world (one per test, everything deleted in ``finally``):
  * caller C and colleague K, both single-membership members of a fresh org;
  * connection X (``connector_connections``) and an enabled custom field ``matter271``;
  * SC#1 rows that differ from the target in ONE dimension each (type, added by, document
    date, custom field) plus K's matching row in an org-shared folder ("Anyone else");
  * ``added`` boundary rows at 2019-12-31T15:00Z (inside 2019) and 2020-01-01T00:30Z;
  * folder F with child F2, root rows, and K's PRIVATE folder (unreachable for C);
  * relationship edges (asymmetric, on an old version, inside one lineage, from an older
    own version) and a three-version lineage for the version states.

The relationship direction follows 271-01's executed implementation and the plan's
Pattern 3 table (``<result> <verb> <picked>``): an OUTGOING verb returns the edge SOURCES
whose target is in the picked lineage; an INCOMING verb returns the TARGETS. So with the
edge ``r_a supersedes r_b``: ``supersedes`` + r_b → {r_a}, ``superseded_by`` + r_a → {r_b}.

Skip-guarded on :54322 (``requires_pg``) and :54321 (``require_gotrue``). A skip is a SKIP.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.api.document_search import search
from app.models.document_search import DocumentSearchRequest
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
    user_client,
)
from tests.integration._rls_harness import requires_pg

pytestmark = requires_pg

FIELD = "matter271"


class World:
    def __init__(self, pool, org: str, marker: str):
        self.pool, self.org, self.m = pool, org, marker
        self.docs: dict[str, dict] = {}   # label -> facts (id, owner, folder, latest, ...)
        self.folders: list[UUID] = []
        self.edges: list[UUID] = []
        self.conn_id: str | None = None
        self.field_id: UUID | None = None

    def id(self, label: str) -> str:
        return self.docs[label]["id"]

    def ids(self, *labels: str) -> set[str]:
        return {self.id(lbl) for lbl in labels}

    async def folder(self, owner: str, name: str, *, shared=False, parent=None) -> str:
        fid = uuid4()
        await self.pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared, parent_id) "
            "VALUES ($1, $2, $3, $4, $5, $6)",
            fid, UUID(owner), UUID(self.org), f"{self.m}-{name}", shared,
            UUID(parent) if parent else None,
        )
        self.folders.append(fid)
        return str(fid)

    async def doc(
        self, label: str, owner: str, *, name: str | None = None, folder: str | None = None,
        doc_type: str | None = None, doc_date: date | None = None, matter: str | None = None,
        conn: str | None = None, created_at: datetime | None = None,
        latest: bool = True, version: int = 1,
    ) -> str:
        did = uuid4()
        filename = name or f"{self.m}-{label}.pdf"
        metadata = {}
        if doc_type:
            metadata["document_type"] = doc_type
        if matter:
            metadata[FIELD] = matter
        if doc_date:
            metadata["date"] = doc_date.isoformat()
        await self.pool.execute(
            "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, "
            "file_size, mime_type, status, is_latest, version_number, metadata, "
            "source_connection_id, created_at) "
            "VALUES ($1, $2, $3, $4, $5, $6, 100, 'application/pdf', 'completed', $7, $8, "
            "$9::text::jsonb, $10, COALESCE($11, now()))",
            did, UUID(owner), UUID(self.org), UUID(folder) if folder else None, filename,
            f"{owner}/{did}.pdf", latest, version, json.dumps(metadata),
            UUID(conn) if conn else None, created_at,
        )
        # document_type_norm / date_typed are GENERATED from metadata: prove they landed.
        got = await self.pool.fetchrow(
            "SELECT document_type_norm, date_typed FROM public.documents WHERE id = $1", did
        )
        assert got["document_type_norm"] == (doc_type.lower() if doc_type else None)
        assert got["date_typed"] == doc_date
        self.docs[label] = {
            "id": str(did), "owner": owner, "folder": folder, "latest": latest,
            "version": version, "filename": filename,
        }
        return str(did)

    async def edge(self, owner: str, source: str, target: str, rel_type: str) -> None:
        eid = uuid4()
        await self.pool.execute(
            "INSERT INTO public.document_relationships (id, user_id, org_id, source_doc_id, "
            "target_doc_id, rel_type) VALUES ($1, $2, $3, $4, $5, $6)",
            eid, UUID(owner), UUID(self.org), UUID(self.id(source)), UUID(self.id(target)),
            rel_type,
        )
        self.edges.append(eid)

    async def cleanup(self) -> None:
        p = self.pool
        steps = [
            ("DELETE FROM public.document_relationships WHERE id = ANY($1::uuid[])", self.edges),
            ("DELETE FROM public.documents WHERE org_id = $1", UUID(self.org)),
            ("DELETE FROM public.folders WHERE id = ANY($1::uuid[])", list(reversed(self.folders))),
        ]
        if self.field_id:
            steps.append(("DELETE FROM public.metadata_field_definitions WHERE id = $1", self.field_id))
        if self.conn_id:
            steps.append(("DELETE FROM public.connector_connections WHERE id = $1", UUID(self.conn_id)))
        for sql, arg in steps:
            try:
                await p.execute(sql, arg)
            except Exception:
                pass
        # Child folders first (parent_id FK), then any leftover.
        try:
            await p.execute("DELETE FROM public.folders WHERE org_id = $1 AND parent_id IS NOT NULL",
                            UUID(self.org))
            await p.execute("DELETE FROM public.folders WHERE org_id = $1", UUID(self.org))
        except Exception:
            pass


@pytest.fixture
async def world(pg_pool):
    require_gotrue()
    marker = f"f271{uuid4().hex[:8]}"
    users = GoTrueUsers(pg_pool)
    org = await create_org(pg_pool, "live")
    w = World(pg_pool, org, marker)
    try:
        c_uid, c_tok = await users.create_signed_in_user(org, label="live-c")
        k_uid, k_tok = await users.create_signed_in_user(org, label="live-k")
        assert await memberships(pg_pool, c_uid) == {org}
        assert await memberships(pg_pool, k_uid) == {org}
        w.c, w.c_tok, w.k, w.k_tok = c_uid, c_tok, k_uid, k_tok

        conn = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.connector_connections (id, org_id, created_by, name, service_id) "
            "VALUES ($1, $2, $3, $4, 'google_drive')", conn, UUID(org), UUID(c_uid),
            f"{marker} Drive",
        )
        w.conn_id = str(conn)
        w.field_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.metadata_field_definitions (id, user_id, org_id, field_key, "
            "field_type, is_system_global, enabled) VALUES ($1, $2, $3, $4, 'string', false, true)",
            w.field_id, UUID(c_uid), UUID(org), FIELD,
        )

        d2019, d2020 = date(2019, 6, 15), date(2020, 3, 1)
        # SC#1: the target and four rows each differing in ONE dimension.
        await w.doc("sc1-target", c_uid, doc_type="Contract", doc_date=d2019, matter="M-1")
        await w.doc("sc1-type", c_uid, doc_type="Invoice", doc_date=d2019, matter="M-1")
        await w.doc("sc1-conn", c_uid, doc_type="Contract", doc_date=d2019, matter="M-1",
                    conn=w.conn_id)
        await w.doc("sc1-date", c_uid, doc_type="Contract", doc_date=d2020, matter="M-1")
        await w.doc("sc1-matter", c_uid, doc_type="Contract", doc_date=d2019, matter="M-2")
        kf = await w.folder(k_uid, "k-shared", shared=True)
        await w.doc("sc1-k", k_uid, folder=kf, doc_type="Contract", doc_date=d2019, matter="M-1")

        # "Added to Agentic RAG" boundary rows.
        await w.doc("added-dec31", c_uid,
                    created_at=datetime(2019, 12, 31, 15, 0, tzinfo=timezone.utc))
        await w.doc("added-jan1", c_uid,
                    created_at=datetime(2020, 1, 1, 0, 30, tzinfo=timezone.utc))

        # Folders: F ⊃ F2, and K's PRIVATE folder (unreachable for C) with a row in it.
        f = await w.folder(c_uid, "F")
        f2 = await w.folder(c_uid, "F2", parent=f)
        kp = await w.folder(k_uid, "k-private")
        w.f, w.f2, w.kp = f, f2, kp
        await w.doc("in-f", c_uid, folder=f)
        await w.doc("in-f2", c_uid, folder=f2)
        await w.doc("in-kp", k_uid, folder=kp)

        # Relationships.
        await w.doc("r-a", c_uid)
        await w.doc("r-b", c_uid)
        await w.edge(c_uid, "r-a", "r-b", "supersedes")            # asymmetric edge
        bx = f"{marker}-bx.pdf"
        await w.doc("bx-v1", c_uid, name=bx, latest=False, version=1)
        await w.doc("bx-v2", c_uid, name=bx, latest=True, version=2)
        await w.doc("r-d", c_uid)
        await w.edge(c_uid, "r-d", "bx-v1", "supersedes")          # edge on an OLD version
        ln = f"{marker}-ln.pdf"
        await w.doc("ln-v1", c_uid, name=ln, latest=False, version=1)
        await w.doc("ln-v2", c_uid, name=ln, latest=True, version=2)
        await w.edge(c_uid, "ln-v2", "ln-v1", "supersedes")        # inside ONE lineage
        ev = f"{marker}-ev.pdf"
        await w.doc("ev-v1", c_uid, name=ev, latest=False, version=1)
        await w.doc("ev-v2", c_uid, name=ev, latest=True, version=2)
        await w.doc("p2", c_uid)
        await w.edge(c_uid, "ev-v1", "p2", "references")           # from an OLDER own version

        # Versions: a three-version lineage.
        vv = f"{marker}-vv.pdf"
        await w.doc("vv-v1", c_uid, name=vv, latest=False, version=1)
        await w.doc("vv-v2", c_uid, name=vv, latest=False, version=2)
        await w.doc("vv-v3", c_uid, name=vv, latest=True, version=3)
        w.vv = vv

        landed = await pg_pool.fetch(
            "SELECT DISTINCT org_id FROM public.documents WHERE filename LIKE $1", f"{marker}-%"
        )
        assert {str(r["org_id"]) for r in landed} == {org}, "a seeded row landed in another org"
        yield w
    finally:
        await w.cleanup()
        await users.drop_all()
        await drop_org(pg_pool, org)


async def _find(w: World, *, as_k: bool = False, **body) -> dict:
    uid, tok = (w.k, w.k_tok) if as_k else (w.c, w.c_tok)
    return await search(
        body=DocumentSearchRequest(**body), current_user={"id": uid}, supabase=user_client(tok)
    )


def _ids(out: dict) -> set[str]:
    ids = [str(d["id"]) for d in out["documents"]]
    assert len(ids) == len(set(ids)), "a document appeared twice (SC#1: one row per document)"
    assert out["total"] == len(ids), "every case here fits one page; total must equal the rows"
    return set(ids)


def _cond(field: str, op: str, **kw) -> dict:
    return {"field": field, "op": op, **kw}


def _flt(*conds: dict) -> dict:
    return {"op": "and", "conditions": list(conds)}


TYPE_CONTRACT = _cond("document_type", "eq", value="Contract")
DATE_2019 = _cond("date", "between", value="2019-01-01", value2="2019-12-31")
MATTER_M1 = _cond(FIELD, "eq", value="M-1")


# ─────────────────────────────── SC#1 ───────────────────────────────


async def test_sc1_combined_request_returns_exactly_the_target(world):
    w = world
    out = await _find(w, filter_expr=_flt(TYPE_CONTRACT, DATE_2019, MATTER_M1),
                      added_by={"kind": "me"})
    assert _ids(out) == w.ids("sc1-target")


async def test_sc1_each_dimension_alone_is_exact(world):
    w = world
    sc1 = f"{w.m}-sc1-"
    assert _ids(await _find(w, name=sc1, filter_expr=_flt(TYPE_CONTRACT))) == w.ids(
        "sc1-target", "sc1-conn", "sc1-date", "sc1-matter", "sc1-k")
    assert _ids(await _find(w, name=sc1, filter_expr=_flt(DATE_2019))) == w.ids(
        "sc1-target", "sc1-type", "sc1-conn", "sc1-matter", "sc1-k")
    assert _ids(await _find(w, name=sc1, filter_expr=_flt(MATTER_M1))) == w.ids(
        "sc1-target", "sc1-type", "sc1-conn", "sc1-date", "sc1-k")
    # The whole SC#1 group with no condition: the control that the name narrowing is right.
    assert _ids(await _find(w, name=sc1)) == w.ids(
        "sc1-target", "sc1-type", "sc1-conn", "sc1-date", "sc1-matter", "sc1-k")


async def test_added_by_me_connection_and_others(world):
    w = world
    sc1 = f"{w.m}-sc1-"
    me = await _find(w, name=sc1, added_by={"kind": "me"})
    via = await _find(w, name=sc1, added_by={"kind": "connection", "connection_id": w.conn_id})
    others = await _find(w, name=sc1, added_by={"kind": "others"})
    assert _ids(me) == w.ids("sc1-target", "sc1-type", "sc1-date", "sc1-matter")
    assert _ids(via) == w.ids("sc1-conn")
    assert _ids(others) == w.ids("sc1-k")
    # The connection's NAME rides the row (270 P-02), never an email.
    assert via["documents"][0]["source_connection_name"] == f"{w.m} Drive"


async def test_added_between_keeps_the_whole_last_day(world):
    """A 2019-12-31T15:00Z row is inside 'added between 1 Jan and 31 Dec 2019' (SC#3)."""
    w = world
    out = await _find(w, dates=[{"which": "added", "op": "between",
                                 "value": "2019-01-01", "value2": "2019-12-31"}])
    assert _ids(out) == w.ids("added-dec31")
    before = await _find(w, dates=[{"which": "added", "op": "before", "value": "2020-01-01"}])
    assert _ids(before) == w.ids("added-dec31")
    on_jan1 = await _find(w, dates=[{"which": "added", "op": "between",
                                     "value": "2020-01-01", "value2": "2020-01-01"}])
    assert _ids(on_jan1) == w.ids("added-jan1")


# ─────────────────────────────── folders ───────────────────────────────


async def test_folder_subtree_on_off_root_and_unreachable(world):
    w = world
    on = await _find(w, folder={"folder_id": w.f, "include_subfolders": True})
    off = await _find(w, folder={"folder_id": w.f, "include_subfolders": False})
    assert _ids(on) == w.ids("in-f", "in-f2")
    assert _ids(off) == w.ids("in-f")

    root = await _find(w, folder={"folder_id": None}, limit=100)
    expected_root = {
        d["id"] for d in w.docs.values()
        if d["owner"] == w.c and d["folder"] is None and d["latest"]
    }
    assert _ids(root) == expected_root
    assert all(d["folder_id"] is None for d in root["documents"])

    unreachable = await _find(w, folder={"folder_id": w.kp})
    assert unreachable["total"] == 0 and unreachable["documents"] == []
    # Positive control: the folder is not empty — its owner finds the row in it.
    assert _ids(await _find(w, as_k=True, folder={"folder_id": w.kp})) == w.ids("in-kp")


# ─────────────────────────────── relationships ───────────────────────────────


async def test_each_verb_pair_differs_on_an_asymmetric_edge(world):
    """Edge: r-a supersedes r-b. The two directions return DIFFERENT sets (D-04, D-05)."""
    w = world

    async def rel(verb, label, **kw):
        return _ids(await _find(w, relationship={"verb": verb, "document_id": w.id(label)}, **kw))

    sup_b, supby_b = await rel("supersedes", "r-b"), await rel("superseded_by", "r-b")
    sup_a, supby_a = await rel("supersedes", "r-a"), await rel("superseded_by", "r-a")
    assert sup_b == w.ids("r-a")
    assert supby_b == set()
    assert supby_a == w.ids("r-b"), "an incoming verb must be non-empty while the edge exists"
    assert sup_a == set()
    assert sup_b != supby_b and sup_a != supby_a


async def test_edge_on_an_old_version_still_matches(world):
    """Edge r-d supersedes bx-v1 (an OLD row); bx was re-uploaded as bx-v2."""
    w = world
    out = await _find(w, relationship={"verb": "supersedes", "document_id": w.id("bx-v2")})
    assert _ids(out) == w.ids("r-d")
    # The incoming direction follows the old endpoint to its lineage's latest row.
    inc = await _find(w, relationship={"verb": "superseded_by", "document_id": w.id("r-d")})
    assert _ids(inc) == w.ids("bx-v2")
    assert inc["older_matches"] == 1
    show = await _find(w, relationship={"verb": "superseded_by", "document_id": w.id("r-d")},
                       version="older")
    assert _ids(show) == w.ids("bx-v1") and show["total"] == inc["older_matches"]


async def test_an_edge_inside_one_lineage_contributes_nothing_to_latest(world):
    """Edge ln-v2 supersedes ln-v1 — one document's own versions, not 'X supersedes X'."""
    w = world
    for verb in ("supersedes", "superseded_by"):
        out = await _find(w, relationship={"verb": verb, "document_id": w.id("ln-v2")})
        assert _ids(out) == set(), f"{verb}: a self-lineage edge leaked into Latest"
        show = await _find(w, relationship={"verb": verb, "document_id": w.id("ln-v2")},
                           version="older")
        # P-02 invariant even here: Show them returns exactly older_matches rows.
        assert show["total"] == out["older_matches"]


async def test_older_matches_equals_the_rows_show_them_returns(world):
    """Edge ev-v1 (an OLDER own version) references p2 (P-02)."""
    w = world
    latest = await _find(w, relationship={"verb": "references", "document_id": w.id("p2")})
    assert _ids(latest) == w.ids("ev-v2")
    assert latest["older_matches"] == 1
    show = await _find(w, relationship={"verb": "references", "document_id": w.id("p2")},
                       version="older")
    assert _ids(show) == w.ids("ev-v1")
    assert show["total"] == latest["older_matches"]
    assert all(d["is_latest"] is False for d in show["documents"])


# ─────────────────────────────── versions ───────────────────────────────


async def test_version_states_after_a_restore_and_a_delete(world):
    """D-06 / D-07 / P-05 on a three-version lineage, driven through the REAL restore route."""
    from app.api.documents import restore_document_version

    w = world
    name = f"{w.m}-vv"

    async def states():
        lat = await _find(w, name=name)
        old = await _find(w, name=name, version="older")
        has = await _find(w, name=name, version="has_earlier")
        assert all(d["is_latest"] is True for d in lat["documents"]), "Latest held an old row"
        assert all(d["is_latest"] is False for d in old["documents"]), "Older held a latest row"
        assert all(d["is_latest"] is True for d in has["documents"])
        return lat, old, has

    lat, old, has = await states()
    assert _ids(lat) == w.ids("vv-v3")
    assert _ids(old) == w.ids("vv-v1", "vv-v2")
    assert _ids(has) == w.ids("vv-v3")
    assert lat["documents"][0]["version_count"] == 3 and lat["documents"][0]["has_earlier"] is True

    # The shipped restore promotes an existing version (it creates no new row).
    await restore_document_version(
        document_id=w.id("vv-v2"), current_user={"id": w.c}, supabase=user_client(w.c_tok)
    )
    lat, old, has = await states()
    assert _ids(lat) == w.ids("vv-v2")
    assert _ids(old) == w.ids("vv-v1", "vv-v3")
    assert _ids(has) == w.ids("vv-v2"), "v2 still has an earlier version (v1)"

    # Delete v1: v2 now has no EARLIER version, though the chevron rule
    # (version_number > 1) would still say it does — P-05's recorded divergence.
    await w.pool.execute("DELETE FROM public.documents WHERE id = $1", UUID(w.id("vv-v1")))
    lat, old, has = await states()
    assert _ids(lat) == w.ids("vv-v2")
    assert _ids(old) == w.ids("vv-v3")
    assert _ids(has) == set(), "has_earlier must follow the lineage after a delete"
    row = lat["documents"][0]
    assert row["has_earlier"] is False
    assert row["version_number"] == 2, "the chevron rule (version_number > 1) still says yes"
