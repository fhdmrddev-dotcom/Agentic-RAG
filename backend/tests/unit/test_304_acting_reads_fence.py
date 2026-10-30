"""Phase 304-01 — the acting-org contextvar, the one ``dependencies.py`` edit, and the reads fence.

D-13 / D-14: an MCP key acts as its owner in ONE org. The org crosses the API→Postgres boundary as
the transaction-local GUC ``app.acting_org_id``; ``_apply_rls_user_context`` sets it ONLY when the
acting-org contextvar is set, and the contextvar is set ONLY by ``app/security/acting_member.py``
(never from a header or request value). Unset must be byte-identical to today at the SQL level.

D-38: the narrowed reads live in ``app/services/acting_member_reads.py`` and run one statement on the
acting connection, so RLS + the GUC is the only visibility rule. This file fences that module from
every path the GUC cannot reach (service role, supabase-py builders, ``org_members``).

The live proof — that the GUC narrows and never widens — is
``tests/integration/test_304_acting_org_rls_live.py``.
"""

from __future__ import annotations

import io
import json
import re
import tokenize
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
APP = BACKEND / "app"
ACTING_ORG = APP / "security" / "acting_org.py"
ACTING_MEMBER = APP / "security" / "acting_member.py"
READS = APP / "services" / "acting_member_reads.py"
DEPS = APP / "dependencies.py"

ORG_A = "2f0b7c1e-5d55-4e3c-9f4a-0d8a3b6c1e01"
USER = "7a1c9e44-0b2d-4c8e-a7f3-55d1e2c3b402"


def _code_only(path: Path) -> str:
    """Source with comments and statement-level strings (docstrings) removed — prose cannot
    satisfy or break a fence; SQL string literals inside expressions are kept."""
    src = path.read_text(encoding="utf-8")
    out: list[str] = []
    prev = tokenize.NEWLINE
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            continue
        if tok.type == tokenize.STRING and prev in (tokenize.NEWLINE, tokenize.NL, tokenize.INDENT,
                                                    tokenize.DEDENT, tokenize.ENCODING):
            prev = tok.type
            continue
        if tok.type not in (tokenize.NL,):
            prev = tok.type
        out.append(tok.string)
    return " ".join(out)


# ── the contextvar scope ───────────────────────────────────────────────────────


def test_a_malformed_org_is_refused_before_anything_is_set():
    from app.security.acting_member import acting_org_scope
    from app.security.acting_org import current_acting_org

    with pytest.raises(ValueError):
        with acting_org_scope("not-a-uuid"):
            pass  # pragma: no cover - never entered
    assert current_acting_org() is None


def test_a_valid_org_is_canonicalised_and_restored():
    from app.security.acting_member import acting_org_scope
    from app.security.acting_org import current_acting_org

    assert current_acting_org() is None
    with acting_org_scope(ORG_A.upper()):
        assert current_acting_org() == str(uuid.UUID(ORG_A))
        assert current_acting_org() == ORG_A
    assert current_acting_org() is None


def test_the_scope_restores_even_when_the_body_raises():
    from app.security.acting_member import acting_org_scope
    from app.security.acting_org import current_acting_org

    with pytest.raises(RuntimeError):
        with acting_org_scope(ORG_A):
            raise RuntimeError("boom")
    assert current_acting_org() is None


def test_nested_scopes_restore_the_outer_value():
    from app.security.acting_member import acting_org_scope
    from app.security.acting_org import current_acting_org

    other = str(uuid.uuid4())
    with acting_org_scope(ORG_A):
        with acting_org_scope(other):
            assert current_acting_org() == other
        assert current_acting_org() == ORG_A
    assert current_acting_org() is None


def test_acting_as_reads_only_the_principal_org_id():
    from app.security.acting_member import acting_as
    from app.security.acting_org import current_acting_org

    class _P:
        org_id = ORG_A
        user_id = USER

    with acting_as(_P()):
        assert current_acting_org() == ORG_A
    assert current_acting_org() is None


async def test_acting_member_connection_scopes_the_user_connection(monkeypatch):
    import app.security.acting_member as am
    from app.security.acting_org import current_acting_org

    seen: dict = {}

    @asynccontextmanager
    async def _fake(request, current_user):
        seen["request"] = request
        seen["user"] = current_user
        seen["org_at_entry"] = current_acting_org()
        yield "CONN"

    monkeypatch.setattr(am, "get_user_pg_connection", _fake)
    async with am.acting_member_connection(user_id=USER, org_id=ORG_A) as conn:
        assert conn == "CONN"
        assert current_acting_org() == ORG_A
    assert seen == {"request": None, "user": {"id": USER}, "org_at_entry": ORG_A}
    assert current_acting_org() is None


# ── the one dependencies.py edit: unset is byte-identical ──────────────────────


class _RecordingConn:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "OK"


def _today(uid: str) -> list[tuple]:
    return [
        ("SET LOCAL ROLE authenticated", ()),
        ("SELECT set_config('request.jwt.claim.sub', $1, true)", (uid,)),
        ("SELECT set_config('request.jwt.claims', $1, true)",
         (json.dumps({"sub": uid, "role": "authenticated"}),)),
    ]


async def test_unset_issues_exactly_todays_three_statements():
    from app.dependencies import _apply_rls_user_context

    conn = _RecordingConn()
    await _apply_rls_user_context(conn, USER)
    assert conn.calls == _today(USER)


async def test_set_appends_exactly_one_parameterised_guc():
    from app.dependencies import _apply_rls_user_context
    from app.security.acting_member import acting_org_scope

    conn = _RecordingConn()
    with acting_org_scope(ORG_A):
        await _apply_rls_user_context(conn, USER)
    assert conn.calls == _today(USER) + [("SELECT set_config('app.acting_org_id', $1, true)", (ORG_A,))]


def test_dependencies_edit_is_the_single_bound_set_config():
    code = _code_only(DEPS)
    assert code.count("app.acting_org_id") == 1
    assert "set_config('app.acting_org_id', $1, true)" in code


# ── static fences ──────────────────────────────────────────────────────────────


def test_acting_org_is_a_leaf():
    src = ACTING_ORG.read_text(encoding="utf-8")
    assert not re.search(r"^\s*(from|import)\s+app\b", src, re.M)


def test_only_the_two_security_modules_name_the_contextvar():
    allowed = {ACTING_ORG.resolve(), ACTING_MEMBER.resolve()}
    offenders = []
    setters = []
    for path in APP.rglob("*.py"):
        code = _code_only(path)
        if re.search(r"\b_acting_org\b", code) and path.resolve() not in allowed:
            offenders.append(str(path.relative_to(BACKEND)))
        if re.search(r"\b_acting_org\s*\.\s*set\s*\(", code):
            setters.append(path.resolve())
    assert offenders == []
    # The ONE setter (D-14): acting_member.py. Never a header, never a request value.
    assert setters == [ACTING_MEMBER.resolve()]


def test_the_acting_member_module_never_reads_a_request():
    code = _code_only(ACTING_MEMBER)
    for banned in ("Request", ".headers", "get_current_user", "get_service_role_supabase", "org_members"):
        assert banned not in code, banned
    assert "get_user_pg_connection ( None" in code


FORBIDDEN_IN_READS = (
    "org_members",
    "fetch_visible_folders",
    ".rpc(",
    ". rpc (",
    "document_ids",
    "linked document (no access)",
    ".table(",
    ". table (",
    "document_search_service",
    "document_view_resolver",
    "fetch_full_document",
    "get_current_user",
    "Request",
    ".headers",
    ". headers",
)


def test_the_reads_module_is_fenced_from_every_unnarrowed_path():
    code = _code_only(READS)
    for banned in FORBIDDEN_IN_READS:
        assert banned not in code, banned
    # Owner masking is imported, never copied.
    assert re.search(r"from app\.utils\.folder_utils import _null_foreign_global_owner",
                     READS.read_text(encoding="utf-8"))


def test_the_service_role_is_used_only_by_the_two_sanctioned_calls():
    """304-03 (D-38): the module's ONLY supabase-py touches are the service-role client handed to
    ``search_documents`` (filename enrichment of rows the acting connection's RPC already returned)
    and to ``resolve_document_scope`` (step 1 PROPOSES ids; step 2, on the RLS connection inside
    ``acting_as``, DECIDES). Two call sites, each an argument of one of those two calls."""
    code = _code_only(READS)
    calls = re.findall(r"get_service_role_supabase \(", code)
    assert len(calls) == 2, calls
    for callee in ("search_documents", "resolve_document_scope"):
        # the service-role client is a DIRECT argument of that call (no other call opens before it)
        assert re.search(callee + r" \([^()]*get_service_role_supabase \(", code), callee


def test_search_never_passes_an_allow_list_and_runs_inside_acting_as():
    """D-40: connector-fed exclusion is a POST-filter; a ``document_ids`` allow-list would switch
    retrieval into filtered mode and change ranking against the app."""
    code = _code_only(READS)
    assert "document_ids" not in code
    assert re.search(r"with acting_as \( principal \) :.*?search_documents \(", code, re.S)
    assert re.search(r"with acting_as \( principal \) :.*?resolve_document_scope \(", code, re.S)


def test_relationships_import_the_mask_and_labels_never_copy_them():
    src = READS.read_text(encoding="utf-8")
    assert src.count("from app.services.document_relationship_service import") == 1
    assert re.search(r"from app\.services\.document_relationship_service import .*_NO_ACCESS_MASK", src)
    assert re.search(r"from app\.services\.document_relationship_service import .*_INVERSE_LABEL", src)
    code = _code_only(READS)
    assert "linked document (no access)" not in code
    for label in ("superseded_by", "amended_by", "referenced_by", "has_attachment"):
        assert label not in code, label


def test_every_read_declares_its_catalogue_tool():
    """KEY-03 'holds on every tool': each public read maps to a real catalogue tool and checks it
    before reading anything."""
    import inspect

    from app.services import acting_member_reads as reads
    from app.services.mcp_tool_catalogue import MCP_TOOL_NAMES

    expected = {"list_folders", "list_documents", "read_document", "search", "list_views",
                "view_documents", "related_documents", "list_workflows"}
    assert set(reads.READ_TOOL) == expected
    assert set(reads.READ_TOOL.values()) <= MCP_TOOL_NAMES
    for name in expected:
        body = inspect.getsource(getattr(reads, name))
        assert f'_require(principal, "{name}")' in body, name


async def test_a_principal_without_the_tool_is_refused_before_any_read(monkeypatch):
    from app.services import acting_member_reads as reads

    opened: list = []

    @asynccontextmanager
    async def _no_conn(**kw):
        opened.append(kw)
        yield None

    monkeypatch.setattr(reads, "acting_member_connection", _no_conn)

    class _P:
        user_id, org_id, folder_ids, include_external = USER, ORG_A, None, True
        tools = ("list_documents",)

    calls = {
        "read_document": (str(uuid.uuid4()),),
        "related_documents": (str(uuid.uuid4()),),
        "search": ("q",),
        "list_workflows": (),
    }
    for name, args in calls.items():
        with pytest.raises(reads.ToolNotGranted):
            await getattr(reads, name)(_P(), *args)
    assert opened == []


async def test_an_empty_scope_returns_empty_with_no_sql(monkeypatch):
    """D-08 / T-304-22: a narrowed key whose every folder vanished composes ``()`` — every read
    answers empty after the ONE folders read, and never issues the read itself."""
    from app.services import acting_member_reads as reads

    class _Conn:
        def __init__(self):
            self.sql = []

        async def fetch(self, sql, *args):
            self.sql.append(sql)
            return []  # the member sees no folders, so the ticked one is gone

        async def fetchrow(self, sql, *args):  # pragma: no cover - must not be reached
            self.sql.append(sql)
            return None

        async def fetchval(self, sql, *args):  # pragma: no cover - must not be reached
            self.sql.append(sql)
            return 0

    conn = _Conn()

    @asynccontextmanager
    async def _acting(**kw):
        yield conn

    monkeypatch.setattr(reads, "acting_member_connection", _acting)

    async def _never(*a, **k):  # pragma: no cover - must not be reached
        raise AssertionError("retrieval reached with an empty scope")

    monkeypatch.setattr(reads.retrieval_service, "search_documents", _never)
    monkeypatch.setattr(reads.retrieval_scope, "resolve_document_scope", _never)

    class _P:
        user_id, org_id, include_external = USER, ORG_A, True
        folder_ids = (str(uuid.uuid4()),)
        tools = ("list_documents", "read_document", "search_knowledge_base")

    assert await reads.list_folders(_P()) == []
    assert await reads.list_documents(_P()) == {"items": [], "total": 0}
    assert await reads.read_document(_P(), str(uuid.uuid4())) is None
    assert await reads.search(_P(), "q", user_settings=object()) == []
    assert await reads.related_documents(_P(), str(uuid.uuid4())) is None
    assert all("public.folders" in s for s in conn.sql), conn.sql


# ── the folders read ───────────────────────────────────────────────────────────


class _FetchConn:
    def __init__(self, rows):
        self.rows = rows
        self.sql: list[tuple] = []

    async def fetch(self, sql, *args):
        self.sql.append((sql, args))
        return self.rows


async def test_list_acting_folders_is_one_statement_with_owner_masking():
    from app.services.acting_member_reads import list_acting_folders

    own = uuid.uuid4()
    shared = uuid.uuid4()
    parent = uuid.uuid4()
    other_user = uuid.uuid4()
    caller = uuid.UUID(USER)
    conn = _FetchConn([
        {"id": own, "name": "A", "parent_id": None, "is_org_shared": False,
         "org_id": uuid.UUID(ORG_A), "user_id": uuid.UUID(USER), "caller_id": caller},
        {"id": shared, "name": "B", "parent_id": parent, "is_org_shared": True,
         "org_id": uuid.UUID(ORG_A), "user_id": other_user, "caller_id": caller},
    ])
    # The 304-03 / 304-04 contract: list_acting_folders(conn) — the caller comes from the
    # connection's own claims (auth.uid()) in the SAME statement, never from an argument.
    rows = await list_acting_folders(conn)
    assert len(conn.sql) == 1
    sql, args = conn.sql[0]
    assert re.sub(r"\s+", " ", sql).strip() == (
        "SELECT id, name, parent_id, is_org_shared, org_id, user_id, auth.uid() AS caller_id "
        "FROM public.folders ORDER BY name, id"
    )
    assert args == ()
    assert rows[0] == {"id": str(own), "name": "A", "parent_id": None, "is_org_shared": False,
                       "org_id": ORG_A, "user_id": USER}
    # A co-member's shared folder: ids as str, owner masked.
    assert rows[1] == {"id": str(shared), "name": "B", "parent_id": str(parent), "is_org_shared": True,
                       "org_id": ORG_A, "user_id": None}
