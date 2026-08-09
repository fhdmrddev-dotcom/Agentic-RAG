"""Phase 190 · CR-01 — ``secret_ciphertext`` must be UNREADABLE over PostgREST.

── THE DEFECT THIS FILE EXISTS TO CLOSE ─────────────────────────────────────────────────
Migration 116 gave ``connector_connections`` a *row*-level SELECT policy:

    CREATE POLICY connector_connections_select ON public.connector_connections
      FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

Row-level, not column-level — and the row carries ``secret_ciphertext``. Supabase exposes
``public`` to the ``authenticated`` role through PostgREST and this app ships a live browser
Supabase client, so **any plain member of an org** — explicitly denied create / edit / delete
/ check by ``require_org_manage`` — could open devtools and run

    await supabase.from("connector_connections").select("id,name,secret_ciphertext")

and receive the ``enc:v1:`` envelope for every connector credential in their org. The API's
careful T7 projection (``connector_service._to_response`` + the module-scope assert at
``connector_service.py:108``) is **not in that path at all**: it guards the API, not the
database, and the phase's own T7 falsification row was only ever driven against the API.

Measured at HEAD before the fix (``information_schema.column_privileges``), and it was
**worse than the review stated** — ``anon`` held the column too:

    ('anon',          'secret_ciphertext', 'SELECT')   ← unauthenticated role
    ('authenticated', 'secret_ciphertext', 'SELECT')

Both come from Supabase's default ``GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
authenticated, service_role``; migration 116 never narrowed them.

⚠ **The RLS shape was copied from ``sso_configs`` (mig 104:372-374, cited verbatim in 116's
own header) — a table with NO SECRET COLUMN AT ALL.** The precedent does not carry, and this
file is the mechanical statement of that.

── WHY THIS TEST IS AT THE DATABASE LEVEL AND NOTHING ELSE WOULD DO ─────────────────────
An API-level test cannot see this. The router never returns the column, the response model
cannot carry it, and every one of those assertions passes while PostgREST hands the column
out on a completely different connection. **The only instrument that can observe the property
is a real Postgres session running as a non-service role**, which is what every case below
opens.

── WHAT MIGRATION 118 DOES ──────────────────────────────────────────────────────────────
Revokes the blanket grants and re-grants SELECT **column by column**, omitting exactly one
column. RLS still applies on top; the service-role resolver is unaffected because it bypasses
both.

── RED OBSERVED, 2026-08-09, before ``118_connector_secret_column_privilege.sql`` existed ──
``venv/Scripts/python.exe -m pytest tests/integration/test_190_secret_column_privilege.py -q``
The verbatim transcript is recorded in ``190-REVIEW-FIXES.md`` § CR-01.

DB writes: **none**. Every case is a SELECT probe or a catalogue read; nothing is inserted,
updated or deleted, so the dev database is untouched.
"""

from __future__ import annotations

import os

import pytest

psycopg2 = pytest.importorskip("psycopg2")

_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

_TABLE = "connector_connections"
_SECRET_COLUMN = "secret_ciphertext"

# The columns a client may read. Deliberately spelled out here rather than imported from
# `connector_service._RESPONSE_KEYS`: this file is the *independent* statement of the grant,
# and a fence that derives its expectation from the thing it is fencing proves nothing when
# both move together. `created_by` is included because it is a non-secret ownership fact the
# table carries; the property under test is "every column EXCEPT the secret".
_SAFE_COLUMNS = (
    "id",
    "org_id",
    "created_by",
    "capability",
    "name",
    "config",
    "is_enabled",
    "last_checked_at",
    "last_check_verdict",
    "created_at",
    "updated_at",
)

# 42501 — insufficient_privilege. Asserted by CODE, never by message text: the wording of
# "permission denied for table X" is a Postgres implementation detail that has changed
# between major versions, and a fence that reads prose is a fence that rots silently.
_INSUFFICIENT_PRIVILEGE = "42501"


def _pg_available() -> bool:
    try:
        conn = psycopg2.connect(_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:  # noqa: BLE001 — no live DB is a SKIP, not a failure
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(), reason="no live local Postgres on :54322 to gate against"
)


@pytest.fixture()
def conn():
    connection = psycopg2.connect(_DSN)
    connection.autocommit = True
    try:
        yield connection
    finally:
        connection.close()


def _as_role(conn, role: str, sql: str):
    """Run ``sql`` with ``SET ROLE role``, always resetting. Returns rows or raises."""
    cur = conn.cursor()
    try:
        cur.execute(f"SET ROLE {role}")
        cur.execute(sql)
        return cur.fetchall() if cur.description else []
    finally:
        try:
            cur.execute("RESET ROLE")
        finally:
            cur.close()


# ── the headline property ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("role", ["authenticated", "anon"])
def test_the_secret_column_is_unreadable_by_a_non_service_role(conn, role):
    """CR-01 — a plain org member (and an anonymous visitor) cannot SELECT the ciphertext.

    ``authenticated`` is the role every browser Supabase client runs as once a user signs in;
    ``anon`` is the role it runs as before that. Neither may see the column, and the refusal
    must be a PRIVILEGE refusal (42501) rather than an empty result — an empty result is
    what RLS produces for a user with no org, which would make this case pass for a
    completely different reason on a machine whose dev DB happens to have no rows.
    """
    with pytest.raises(psycopg2.errors.InsufficientPrivilege) as excinfo:
        _as_role(conn, role, f"SELECT {_SECRET_COLUMN} FROM public.{_TABLE} LIMIT 1")

    assert excinfo.value.pgcode == _INSUFFICIENT_PRIVILEGE, (
        f"CR-01: role {role!r} was refused with pgcode {excinfo.value.pgcode!r}, not "
        f"{_INSUFFICIENT_PRIVILEGE!r} (insufficient_privilege). Some other error stood in "
        "for the property and the column may still be readable."
    )


def test_SELECT_STAR_is_refused_for_authenticated_which_is_the_devtools_shape(conn):
    """``select("*")`` — the literal thing a browser client sends by default — must fail.

    ⚠ This is the case that makes the fix *complete* rather than cosmetic. PostgREST's
    default projection is ``select=*``, so a grant that omitted this check could leave the
    exact devtools one-liner in the module docstring working.
    """
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        _as_role(conn, "authenticated", f"SELECT * FROM public.{_TABLE} LIMIT 1")


def test_the_safe_columns_still_read_for_authenticated(conn):
    """The other half — and without it the fix could be "revoke everything" and still pass.

    Every non-secret column must remain selectable, together and individually, or the
    Settings → Connections table stops rendering for every org admin in the product.
    """
    projection = ", ".join(_SAFE_COLUMNS)
    _as_role(conn, "authenticated", f"SELECT {projection} FROM public.{_TABLE} LIMIT 1")

    for column in _SAFE_COLUMNS:
        _as_role(conn, "authenticated", f"SELECT {column} FROM public.{_TABLE} LIMIT 1")


def test_authenticated_keeps_the_write_privileges_the_CRUD_path_needs(conn):
    """INSERT / UPDATE / DELETE survive — including on the secret column itself.

    The org-admin CRUD path writes ``secret_ciphertext`` through the **user-JWT** client
    (``get_user_supabase_client`` → role ``authenticated``), so a fix that revoked write
    access to the column would make it impossible to store a credential at all. Write
    access is not read access: a role may INSERT into a column it can never SELECT.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT privilege_type
              FROM information_schema.table_privileges
             WHERE table_schema = 'public' AND table_name = %s AND grantee = 'authenticated'
            """,
            (_TABLE,),
        )
        held = {row[0] for row in cur.fetchall()}
        assert {"INSERT", "UPDATE", "DELETE"} <= held, (
            f"CR-01: `authenticated` lost a write privilege it needs — holds {sorted(held)}. "
            "The column grant must narrow READS only."
        )

        cur.execute(
            """
            SELECT privilege_type
              FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name = %s
               AND column_name = %s AND grantee = 'authenticated'
            """,
            (_TABLE, _SECRET_COLUMN),
        )
        column_privileges = {row[0] for row in cur.fetchall()}
        assert "SELECT" not in column_privileges, (
            f"CR-01: `authenticated` still holds SELECT on {_SECRET_COLUMN} "
            f"({sorted(column_privileges)})."
        )
        assert {"INSERT", "UPDATE"} <= column_privileges, (
            f"CR-01: `authenticated` cannot write {_SECRET_COLUMN} "
            f"({sorted(column_privileges)}) — no org admin could store a credential."
        )
    finally:
        cur.close()


def test_anon_holds_nothing_at_all_on_this_table(conn):
    """``anon`` is an UNAUTHENTICATED role and has no business with this table in any mode.

    Migration 116's four policies are all ``TO authenticated``, so RLS already denies anon
    every row — but privileges and policies are independent gates, and this one is the
    cheaper of the two to keep closed.
    """
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT privilege_type
              FROM information_schema.table_privileges
             WHERE table_schema = 'public' AND table_name = %s AND grantee = 'anon'
            """,
            (_TABLE,),
        )
        held = sorted(row[0] for row in cur.fetchall())
        assert held == [], (
            f"CR-01: `anon` still holds {held} on public.{_TABLE}. Measured at HEAD before "
            "migration 118, anon held SELECT, INSERT, UPDATE and DELETE — including on "
            f"{_SECRET_COLUMN}."
        )
    finally:
        cur.close()


def test_service_role_still_reads_the_secret_because_the_resolver_depends_on_it(conn):
    """The resolver runs on the service-role pool and MUST still see the column.

    ``connector_service._fetch_connection_row`` uses the service-role client (the harness
    engine carries no user JWT — the Phase-163 red line), so a fix that revoked the column
    from every role would turn every live send into a credential-resolution failure. This is
    the anti-over-correction case.
    """
    rows = _as_role(
        conn, "service_role", f"SELECT {_SECRET_COLUMN} FROM public.{_TABLE} LIMIT 1"
    )
    assert isinstance(rows, list)


def test_the_column_grant_is_recorded_in_a_numbered_migration_file(conn):
    """The live grant must have a migration behind it, or the next fresh database loses it.

    A privilege applied by hand to one dev box and never written down is the shape of defect
    this project's migration discipline exists to prevent — the property would silently be
    absent in cloud and in every greenfield deploy.
    """
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[3] / "supabase" / "migrations"
    matches = [p for p in root.glob("*.sql") if "REVOKE" in p.read_text(encoding="utf-8").upper()
               and _TABLE in p.read_text(encoding="utf-8")]
    assert matches, (
        f"CR-01: no migration under {root} revokes anything on {_TABLE}. The live grant "
        "would be undone by the next `regenerate-full-schema.sh --reset` and would never "
        "reach cloud."
    )
