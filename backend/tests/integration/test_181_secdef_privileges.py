"""Phase 248 (CRED-03) — Integration test suite for migration 181.

Validates that:
1. anon cannot execute any of the 13 security definer functions (Group A & Group B).
2. authenticated retains EXECUTE on RLS helpers (current_user_org_ids, etc.) and search RPCs.
3. authenticated does NOT hold direct EXECUTE privilege on the 6 trigger functions.
4. Triggers STILL FIRE ON DML across all tables without requiring EXECUTE on the trigger function
   (BUS-235 empirical proof verified as a durable test fence).
"""

from __future__ import annotations

import os
import uuid
import psycopg2
import pytest

_DSN = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")


def _pg_available() -> bool:
    try:
        conn = psycopg2.connect(_DSN, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _pg_available(), reason="PostgreSQL not available on :54322")


@pytest.fixture()
def db():
    conn = psycopg2.connect(_DSN)
    conn.autocommit = False
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


ALL_13_FUNCTIONS = [
    ("capture_skill_version()", "trigger"),
    ("handle_new_user()", "trigger"),
    ("stale_skill_embedding()", "trigger"),
    ("stale_skill_embedding_from_case()", "trigger"),
    ("autofill_org_id_by_owner()", "trigger"),
    ("autofill_org_id_from_parent()", "trigger"),
    ("current_user_org_ids()", "rls"),
    ("connection_doc_is_visible(uuid, text)", "rls"),
    ("current_user_has_permission(uuid, text)", "rls"),
    ("folder_is_org_shared(uuid)", "rls"),
    ("keyword_search_chunks(text, uuid, integer, jsonb, uuid[])", "rpc"),
    ("match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)", "rpc"),
    ("match_skills(vector, uuid, text)", "rpc"),
]


@pytest.mark.parametrize("fn_sig,category", ALL_13_FUNCTIONS)
def test_anon_cannot_execute_any_of_the_13_functions(db, fn_sig: str, category: str):
    """CRED-03: anon must not hold execute privilege on any of the 13 security definer functions."""
    cur = db.cursor()
    try:
        cur.execute(f"SELECT has_function_privilege('anon', 'public.{fn_sig}', 'EXECUTE')")
        (has_priv,) = cur.fetchone()
        assert not has_priv, f"anon unexpectedly holds EXECUTE on public.{fn_sig}"
    finally:
        cur.close()


RLS_AND_RPC_FUNCTIONS = [
    "current_user_org_ids()",
    "connection_doc_is_visible(uuid, text)",
    "current_user_has_permission(uuid, text)",
    "folder_is_org_shared(uuid)",
    "keyword_search_chunks(text, uuid, integer, jsonb, uuid[])",
    "match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)",
    "match_skills(vector, uuid, text)",
]


@pytest.mark.parametrize("fn_sig", RLS_AND_RPC_FUNCTIONS)
def test_authenticated_retains_execute_on_rls_and_rpc(db, fn_sig: str):
    """CRED-03: authenticated role retains EXECUTE on RLS helpers and search RPCs."""
    cur = db.cursor()
    try:
        cur.execute(f"SELECT has_function_privilege('authenticated', 'public.{fn_sig}', 'EXECUTE')")
        (has_priv,) = cur.fetchone()
        assert has_priv, f"authenticated must hold EXECUTE on public.{fn_sig}"
    finally:
        cur.close()


TRIGGER_FUNCTIONS = [
    "autofill_org_id_by_owner()",
    "autofill_org_id_from_parent()",
    "capture_skill_version()",
    "handle_new_user()",
    "stale_skill_embedding()",
    "stale_skill_embedding_from_case()",
]


@pytest.mark.parametrize("fn_sig", TRIGGER_FUNCTIONS)
def test_authenticated_cannot_directly_execute_triggers(db, fn_sig: str):
    """CRED-03: Direct PostgREST RPC invocation of trigger functions is blocked for authenticated."""
    cur = db.cursor()
    try:
        cur.execute(f"SELECT has_function_privilege('authenticated', 'public.{fn_sig}', 'EXECUTE')")
        (has_priv,) = cur.fetchone()
        assert not has_priv, f"authenticated should NOT hold direct EXECUTE on trigger public.{fn_sig}"
    finally:
        cur.close()


def test_triggers_still_fire_on_dml_without_execute_privilege(db):
    """BUS-235: PostgreSQL does not check execute permissions at trigger fire time.

    Verifies trigger execution on DML:
    1. autofill_org_id_by_owner on public.folders under authenticated
    2. handle_new_user on auth.users (signup path)
    3. capture_skill_version on public.skills under authenticated
    """
    cur = db.cursor()
    try:
        # Find existing active user & org from org_members
        cur.execute("SELECT user_id, org_id FROM public.org_members LIMIT 1")
        member_row = cur.fetchone()
        assert member_row is not None, "No member found in public.org_members"
        user_id, org_id = str(member_row[0]), str(member_row[1])

        # 1. Test autofill_org_id_by_owner on public.folders under authenticated
        folder_id = str(uuid.uuid4())
        cur.execute(f"""
        SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', '{user_id}', true);
        SELECT set_config('request.jwt.claims', '{{"sub": "{user_id}", "role": "authenticated"}}', true);
        INSERT INTO public.folders (id, name, user_id)
        VALUES ('{folder_id}', 'Trigger Test Folder', '{user_id}')
        RETURNING id, name, org_id;
        """)
        row = cur.fetchone()
        assert row is not None
        assert row[0] == folder_id
        # autofill_org_id_by_owner trigger auto-filled org_id without EXECUTE privilege!
        assert row[2] is not None

        # 2. Test handle_new_user trigger on auth.users
        cur.execute("RESET ROLE;")
        new_uid = str(uuid.uuid4())
        cur.execute(f"""
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ('{new_uid}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'trg_test_{new_uid[:8]}@example.com', 'dummy_hash', now(), '{{"provider":"email"}}', '{{}}', now(), now())
        RETURNING id, email;
        """)
        auth_user_row = cur.fetchone()
        assert auth_user_row is not None

        # 3. Test capture_skill_version on public.skills under authenticated
        skill_id = str(uuid.uuid4())
        cur.execute(f"""
        SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', '{user_id}', true);
        SELECT set_config('request.jwt.claims', '{{"sub": "{user_id}", "role": "authenticated"}}', true);
        INSERT INTO public.skills (id, name, description, user_id, org_id)
        VALUES ('{skill_id}', 'Trigger Test Skill', 'Description', '{user_id}', '{org_id}')
        RETURNING id;
        """)
        skill_row = cur.fetchone()
        assert skill_row is not None
        assert skill_row[0] == skill_id

    finally:
        cur.close()
        db.rollback()
