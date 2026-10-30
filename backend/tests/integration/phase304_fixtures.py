"""Phase 304-03 — the shared two-org world the parity and narrowed-key suites run against.

THE SUBJECT (D-31, Pitfall 10 — never an owner, never an org-only fixture). U is role ``member`` in
org X AND role ``member`` in org Y. Co-members V_X and V_Y each own an ORG-SHARED folder with a
document in it, so every "the key sees what the app sees" arm is exercised by content U does NOT
own. V_X also owns a PRIVATE folder + document, which U must never reach.

Seeded, every INSERT with an explicit ``org_id``:

  X, owned by U   F (folder) ⊃ F2 (subfolder); ``f_doc`` in F (version 2 of a lineage whose
                  version 1 ``old_x`` is superseded), ``f2_doc`` in F2, ``ext_doc`` in F carrying
                  ``source_connection_id`` (connector-fed, D-40), ``root_x`` in no folder; a
                  published + a draft workflow; three views (all, Contract-only, scoped to F);
                  relationships: f_doc→f2_doc, root_x→f_doc (incoming to f_doc), f_doc→fy_doc
                  (an endpoint in Y), f_doc→px_doc (an endpoint U cannot read).
  X, owned by V_X ``SX`` (org-shared) with ``sx_doc``; ``PX`` (private) with ``px_doc``.
  Y, owned by U   FY with ``fy_doc``, ``root_y``, a published workflow, a view, fy_doc→root_y.
  Y, owned by V_Y ``SY`` (org-shared) with ``sy_doc``.

Chunks carry a distinctive per-org token and a per-org embedding axis, so a token present only in
X can only ever retrieve X content (``embed_texts`` is stubbed to the org's axis). Within an org
every chunk has a distinct rank on both arms, so two separate searches cannot order ties apart.

Keys are minted through ``api_key_auth.mint_key`` + ``db.api_keys.create_api_key`` and resolved
with the real ``resolve_mcp_principal`` — the principal under test is never hand-built.

Everything seeded is deleted in ``finally``. ⛔ No role-``anon`` call to any function here
(BUG-261031-01: it crashed the local cluster in 304-01).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest_asyncio

from app.db import api_keys as api_keys_db
from app.security import api_key_auth
from app.security.mcp_principal import McpPrincipal, resolve_mcp_principal
from app.services.mcp_tool_catalogue import PRESETS
from tests.integration._271_gotrue_users import (
    GoTrueUsers,
    _admin,
    create_org,
    drop_org,
    memberships,
    require_gotrue,
)
from tests.unit.phase293_inbound_fakes import FakeRedis

READ_TOOLS = PRESETS["read"].tools
RUN_TOOLS = PRESETS["run"].tools
_DEFAULT_MODEL = "text-embedding-3-small"


def request_for(org: str | None) -> SimpleNamespace:
    """A request carrying ``X-Org-Id`` (the 298 active-org shape); ``None`` = no header."""
    headers = {"X-Org-Id": str(org)} if org else {}
    return SimpleNamespace(headers=headers, state=SimpleNamespace())


@dataclass
class World:
    pool: object
    x: str = ""
    y: str = ""
    u: str = ""
    u_tok: str = ""
    v_x: str = ""
    v_y: str = ""
    conn_id: str = ""
    dim: int = 0
    model: str = _DEFAULT_MODEL
    tok_x: str = ""
    tok_y: str = ""
    f: str = ""
    f2: str = ""
    fy: str = ""
    sx: str = ""
    px: str = ""
    sy: str = ""
    docs: dict[str, str] = field(default_factory=dict)
    views: dict[str, str] = field(default_factory=dict)
    wf: dict[str, str] = field(default_factory=dict)
    users: GoTrueUsers | None = None
    extra_folders: list[str] = field(default_factory=list)

    def ids(self, *labels: str) -> set[str]:
        return {self.docs[label] for label in labels}

    # ── seeding helpers ────────────────────────────────────────────────────────

    async def folder(self, owner: str, org: str, name: str, *, shared=False, parent=None) -> str:
        fid = await self.pool.fetchval(
            "INSERT INTO public.folders (user_id, org_id, name, is_org_shared, parent_id)"
            " VALUES ($1, $2, $3, $4, $5) RETURNING id",
            UUID(owner), UUID(org), f"304-03-{name}-{uuid4().hex[:6]}", shared,
            UUID(parent) if parent else None,
        )
        return str(fid)

    async def doc(
        self, label: str, owner: str, org: str, *, folder: str | None = None,
        doc_type: str | None = None, conn: str | None = None, latest: bool = True,
        version: int = 1, filename: str | None = None, minutes_ago: int = 0,
    ) -> str:
        meta = '{"document_type": "%s"}' % doc_type if doc_type else "{}"
        did = await self.pool.fetchval(
            "INSERT INTO public.documents (user_id, org_id, folder_id, filename, file_path,"
            " file_size, mime_type, status, is_latest, version_number, metadata,"
            " source_connection_id, created_at)"
            " VALUES ($1, $2, $3, $4, $5, 100, 'text/plain', 'completed', $6, $7, $8::text::jsonb,"
            " $9, now() - make_interval(mins => $10)) RETURNING id",
            UUID(owner), UUID(org), UUID(folder) if folder else None,
            filename or f"304-03-{label}-{uuid4().hex[:6]}.txt",
            f"{owner}/304-03-{label}-{uuid4().hex[:8]}.txt", latest, version, meta,
            UUID(conn) if conn else None, minutes_ago,
        )
        self.docs[label] = str(did)
        return str(did)

    async def chunk(self, label: str, owner: str, org: str, *, words: str, rank: int) -> None:
        """One chunk whose vector arm AND keyword arm both rank it ``rank``-th in its org, so the
        fused order is strict (no ties for two separate calls to break differently): the vector
        is the org's axis plus a ``rank``-sized tilt, the token repeats ``8 - rank`` times."""
        token, axis = (self.tok_x, 0) if org == self.x else (self.tok_y, 1)
        vec = ["0"] * self.dim
        vec[axis] = "1"
        vec[3 + rank] = repr(0.05 * rank)
        await self.pool.execute(
            "INSERT INTO public.document_chunks (document_id, user_id, org_id, content, chunk_index,"
            " embedding, embedding_model) VALUES ($1, $2, $3, $4, 0, $5::text::public.vector, $6)",
            UUID(self.docs[label]), UUID(owner), UUID(org), f"{' '.join([token] * (8 - rank))} {words}",
            "[" + ",".join(vec) + "]", self.model,
        )

    async def view(self, label: str, owner: str, org: str, *, conditions=(), folder_scope=None) -> str:
        vid = await self.pool.fetchval(
            "INSERT INTO public.document_views (user_id, org_id, name, filter_expr, folder_scope)"
            " VALUES ($1, $2, $3, $4, $5) RETURNING id",
            UUID(owner), UUID(org), f"304-03 {label} {uuid4().hex[:6]}",
            {"op": "and", "conditions": list(conditions)},
            UUID(folder_scope) if folder_scope else None,
        )
        self.views[label] = str(vid)
        return str(vid)

    async def edge(self, owner: str, org: str, source: str, target: str, rel_type: str) -> None:
        await self.pool.execute(
            "INSERT INTO public.document_relationships (user_id, org_id, source_doc_id, target_doc_id,"
            " rel_type) VALUES ($1, $2, $3, $4, $5)",
            UUID(owner), UUID(org), UUID(self.docs[source]), UUID(self.docs[target]), rel_type,
        )

    async def workflow(self, label: str, owner: str, org: str, *, status: str = "published") -> str:
        wid = await self.pool.fetchval(
            "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
            " VALUES ($1, $2, $3, $4, $5) RETURNING id",
            f"p304-03-{label}-{uuid4().hex[:8]}", f"304-03 {label}", UUID(owner), UUID(org), status,
        )
        self.wf[label] = str(wid)
        return str(wid)

    # ── keys ───────────────────────────────────────────────────────────────────

    async def mint(
        self, *, kind: str = "mcp", tools=READ_TOOLS, folder_ids=None, include_external=False,
        org: str | None = None, label: str | None = None,
    ) -> str:
        """Mint a real key for U through the app's own mint + insert. Returns the secret."""
        minted = api_key_auth.mint_key(kind)
        mcp = kind == "mcp"
        await api_keys_db.create_api_key(
            self.pool,
            org_id=UUID(org or self.x),
            user_id=UUID(self.u),
            label=label or f"304-03 {kind} {uuid4().hex[:8]}",
            key_prefix=minted.key_prefix,
            key_hash=minted.key_hash,
            workflows=[] if mcp else [{"id": self.wf["pub_x"], "name": "304-03 pub_x"}],
            expires_at=(datetime.now(timezone.utc) + timedelta(days=30)) if mcp else None,
            kind=kind,
            folder_ids=list(folder_ids) if folder_ids is not None else None,
            tools=list(tools) if mcp else None,
            include_external=include_external,
        )
        return minted.secret

    async def principal(self, **kw) -> McpPrincipal:
        """Mint an MCP key and resolve it through the real resolver (``resolve_mcp_principal``)."""
        secret = await self.mint(**kw)
        return await resolve_mcp_principal(secret, pool=self.pool, redis=FakeRedis())

    # ── teardown ───────────────────────────────────────────────────────────────

    async def cleanup(self) -> None:
        p = self.pool
        uids = [UUID(x) for x in (self.u, self.v_x, self.v_y) if x]
        steps = [
            "DELETE FROM public.api_keys WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.workflow_runs WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.workflow_definitions WHERE created_by = ANY($1::uuid[])",
            "DELETE FROM public.document_relationships WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.document_views WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.document_chunks WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.documents WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.folders WHERE user_id = ANY($1::uuid[]) AND parent_id IS NOT NULL",
            "DELETE FROM public.folders WHERE user_id = ANY($1::uuid[])",
            "DELETE FROM public.audit_log WHERE user_id = ANY($1::uuid[])",
        ]
        for sql in steps:
            try:
                await p.execute(sql, uids)
            except Exception:
                pass
        if self.conn_id:
            try:
                await p.execute("DELETE FROM public.connector_connections WHERE id = $1", UUID(self.conn_id))
            except Exception:
                pass


async def _embedding_dim(pool) -> int:
    fmt = await pool.fetchval(
        "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
        "WHERE attrelid = 'public.document_chunks'::regclass AND attname = 'embedding'"
    )
    assert fmt and fmt.startswith("vector(") and fmt.endswith(")"), fmt
    return int(fmt[len("vector("):-1])


def search_settings():
    """The member's effective settings as the app's own search path loads them
    (``load_user_settings`` -> ``load_app_settings``), with rerank OFF so neither side makes a
    provider call. Both sides of every parity arm get the SAME object."""
    from app.models.user_settings import load_app_settings

    return load_app_settings().model_copy(update={"rerank_enabled": False, "retrieval_top_k": 10})


def patch_search(monkeypatch, w: World) -> None:
    """Stub the embedder to the fixture's per-org vectors and give the module's two sanctioned
    service-role calls the LOCAL stack's client (the unit conftest points ``settings`` at a
    placeholder project)."""
    import app.services.acting_member_reads as reads
    import app.services.retrieval_rpc as rpc

    def _vec(text: str) -> list[float]:
        index = 0 if w.tok_x in text else 1 if w.tok_y in text else 2
        out = [0.0] * w.dim
        out[index] = 1.0
        return out

    def _fake_embed(texts, *args, **kwargs):
        return [_vec(t) for t in texts]

    monkeypatch.setattr(rpc, "embed_texts", _fake_embed)
    monkeypatch.setattr(reads, "get_service_role_supabase", lambda org_id: _admin(), raising=False)


@pytest_asyncio.fixture
async def world(pg_pool):
    require_gotrue()
    users = GoTrueUsers(pg_pool)
    w = World(pg_pool, users=users)
    org_x = org_y = None
    try:
        org_x = await create_org(pg_pool, "p304-03-x")
        org_y = await create_org(pg_pool, "p304-03-y")
        w.x, w.y = org_x, org_y
        w.u, w.u_tok = await users.create_signed_in_user(org_x, role="member", label="p30403u")
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            UUID(org_y), UUID(w.u),
        )
        assert await memberships(pg_pool, w.u) == {org_x, org_y}, "U is not in exactly X and Y"
        roles = {str(r["org_id"]): r["role"] for r in await pg_pool.fetch(
            "SELECT org_id, role FROM public.org_members WHERE user_id = $1", UUID(w.u))}
        # Pitfall 10: U is a plain member of BOTH orgs — never an owner, never an admin.
        assert roles == {org_x: "member", org_y: "member"}, roles
        w.v_x, _ = await users.create_signed_in_user(org_x, label="p30403vx")
        w.v_y, _ = await users.create_signed_in_user(org_y, label="p30403vy")

        w.dim = await _embedding_dim(pg_pool)
        w.model = getattr(search_settings(), "embedding_model", "") or _DEFAULT_MODEL
        w.tok_x, w.tok_y = f"zqx{uuid4().hex[:10]}", f"zqy{uuid4().hex[:10]}"

        conn = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.connector_connections (id, org_id, created_by, name, service_id)"
            " VALUES ($1, $2, $3, $4, 'p304-03-test')",
            conn, UUID(org_x), UUID(w.u), "304-03 connection",
        )
        w.conn_id = str(conn)

        # ── X, U ──
        w.f = await w.folder(w.u, org_x, "F")
        w.f2 = await w.folder(w.u, org_x, "F2", parent=w.f)
        lineage = f"304-03-lineage-{uuid4().hex[:6]}.txt"
        await w.doc("old_x", w.u, org_x, folder=w.f, latest=False, version=1, filename=lineage,
                    doc_type="Contract", minutes_ago=60)
        await w.doc("f_doc", w.u, org_x, folder=w.f, version=2, filename=lineage,
                    doc_type="Contract", minutes_ago=50)
        await w.doc("f2_doc", w.u, org_x, folder=w.f2, doc_type="Invoice", minutes_ago=40)
        await w.doc("ext_doc", w.u, org_x, folder=w.f, conn=w.conn_id, doc_type="Contract",
                    minutes_ago=30)
        await w.doc("root_x", w.u, org_x, doc_type="Contract", minutes_ago=20)
        # ── X, V_X ──
        w.sx = await w.folder(w.v_x, org_x, "SX", shared=True)
        w.px = await w.folder(w.v_x, org_x, "PX")
        await w.doc("sx_doc", w.v_x, org_x, folder=w.sx, doc_type="Contract", minutes_ago=10)
        await w.doc("px_doc", w.v_x, org_x, folder=w.px, doc_type="Contract", minutes_ago=5)
        # ── Y ──
        w.fy = await w.folder(w.u, org_y, "FY")
        await w.doc("fy_doc", w.u, org_y, folder=w.fy, doc_type="Contract", minutes_ago=45)
        await w.doc("root_y", w.u, org_y, doc_type="Contract", minutes_ago=25)
        w.sy = await w.folder(w.v_y, org_y, "SY", shared=True)
        await w.doc("sy_doc", w.v_y, org_y, folder=w.sy, doc_type="Contract", minutes_ago=15)

        words = {
            "f_doc": "quarterly revenue statement for the northern region",
            "f2_doc": "invoice ledger reconciliation appendix",
            "ext_doc": "synced mailbox attachment about vendor onboarding",
            "root_x": "board minutes covering hiring plans",
            "sx_doc": "shared playbook on customer escalation",
            "px_doc": "private memo on salary bands",
            "fy_doc": "warehouse inventory audit notes",
            "root_y": "travel policy draft for contractors",
            "sy_doc": "shared glossary of product terms",
        }
        owners = {"sx_doc": w.v_x, "px_doc": w.v_x, "sy_doc": w.v_y}
        ranks = {"f_doc": 0, "f2_doc": 1, "ext_doc": 2, "root_x": 3, "sx_doc": 4, "px_doc": 5,
                 "fy_doc": 0, "root_y": 1, "sy_doc": 2}
        for label, text in words.items():
            org = org_y if label in ("fy_doc", "root_y", "sy_doc") else org_x
            await w.chunk(label, owners.get(label, w.u), org, words=text, rank=ranks[label])

        await w.view("all_x", w.u, org_x)
        await w.view("contract_x", w.u, org_x,
                     conditions=[{"field": "document_type", "op": "eq", "value": "Contract"}])
        await w.view("scoped_x", w.u, org_x, folder_scope=w.f)
        await w.view("all_y", w.u, org_y)

        await w.edge(w.u, org_x, "f_doc", "f2_doc", "references")
        await w.edge(w.u, org_x, "root_x", "f_doc", "supersedes")
        await w.edge(w.u, org_x, "f_doc", "fy_doc", "references")
        await w.edge(w.u, org_x, "f_doc", "px_doc", "amends")
        await w.edge(w.u, org_y, "fy_doc", "root_y", "references")

        await w.workflow("pub_x", w.u, org_x)
        await w.workflow("draft_x", w.u, org_x, status="draft")
        await w.workflow("pub_y", w.u, org_y)
        yield w
    finally:
        await w.cleanup()
        await users.drop_all()
        await drop_org(pg_pool, org_x)
        await drop_org(pg_pool, org_y)
