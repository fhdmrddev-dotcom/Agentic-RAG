"""Phase 293-01 (START-02; D-01, D-17, D-19; T-293-02, T-293-05) — ``db/api_keys.py``.

These queries run on the BYPASSRLS asyncpg pool, so the SQL predicate is the only owner scope.
A stub pool captures every statement and its arguments; the assertions are about the SQL, because
the SQL is the security property.

  * every statement carries an ``org_id = $`` or ``user_id = $`` predicate, except
    ``get_key_for_auth`` — the ONE owner-agnostic read, which has no caller yet by construction;
  * the client projection never contains ``key_hash``;
  * ``create_api_key`` binds ``org_id`` explicitly (the autofill trigger is only a backstop);
  * ``touch_last_used`` carries the 30-second throttle, so a busy key does not write every call;
  * ``workflows`` is bound as a plain python list (the pool's jsonb codec encodes it — a
    ``json.dumps`` here would store a jsonb STRING scalar, the migration-123 defect).
"""

from __future__ import annotations

import inspect
import re
from datetime import datetime, timezone
from uuid import UUID

import asyncpg
import pytest

from app.db import api_keys as db

ORG = UUID("44444444-4444-4444-8444-444444444444")
USER = UUID("33333333-3333-4333-8333-333333333333")
KEY = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
ADMIN = UUID("66666666-6666-4666-8666-666666666666")


class _Pool:
    def __init__(self, *, row=None, rows=None, value=None, raise_on_fetchrow=None):
        self.calls: list[tuple[str, str, tuple]] = []
        self.row, self.rows, self.value = row, rows or [], value
        self.raise_on_fetchrow = raise_on_fetchrow

    async def fetchrow(self, sql, *args):
        self.calls.append(("fetchrow", sql, args))
        if self.raise_on_fetchrow is not None:
            raise self.raise_on_fetchrow
        return self.row

    async def fetch(self, sql, *args):
        self.calls.append(("fetch", sql, args))
        return self.rows

    async def fetchval(self, sql, *args):
        self.calls.append(("fetchval", sql, args))
        return self.value

    async def execute(self, sql, *args):
        self.calls.append(("execute", sql, args))
        return "UPDATE 1"


def _row(**kw):
    base = {
        "id": KEY, "org_id": ORG, "user_id": USER, "label": "Zapier", "key_prefix": "srl_live_abcd",
        "workflows": [{"id": "w", "name": "W"}], "expires_at": None, "revoked_at": None,
        "revoked_by": None, "last_used_at": None, "created_at": datetime.now(timezone.utc),
    }
    base.update(kw)
    return base


OWNER_PREDICATE = re.compile(r"\b(org_id|user_id)\s*=\s*\$\d")


async def _drive_every_scoped_function() -> list[tuple[str, str, tuple]]:
    pool = _Pool(row=_row(), rows=[_row()], value=1)
    await db.create_api_key(
        pool, org_id=ORG, user_id=USER, label="Zapier", key_prefix="srl_live_abcd",
        key_hash="0" * 64, workflows=[{"id": "w", "name": "W"}], expires_at=None,
    )
    await db.list_keys_for_owner(pool, org_id=ORG, user_id=USER)
    await db.list_keys_for_org(pool, org_id=ORG)
    await db.revoke_key(pool, key_id=KEY, org_id=ORG, owner_id=USER, revoked_by=USER)
    await db.revoke_key(pool, key_id=KEY, org_id=ORG, owner_id=None, revoked_by=ADMIN)
    await db.touch_last_used(pool, KEY, org_id=ORG)
    await db.is_org_member(pool, org_id=ORG, user_id=USER)
    await db.list_key_calls(pool, org_id=ORG, key_ids=[str(KEY)], since=datetime.now(timezone.utc))
    await db.get_key_workflows(pool, workflow_ids=[KEY], user_id=USER, org_id=ORG)
    await db.list_startable_candidates(pool, user_id=USER, org_id=ORG)
    await db.count_own_drafts(pool, user_id=USER, org_id=ORG)
    return pool.calls


async def test_every_statement_but_the_auth_read_carries_an_owner_predicate():
    calls = await _drive_every_scoped_function()
    assert calls, "no statement captured"
    for kind, sql, _args in calls:
        if sql.lstrip().upper().startswith("INSERT"):
            assert "org_id" in sql, sql   # an INSERT has no WHERE; it BINDS the owner instead
            continue
        assert OWNER_PREDICATE.search(sql), f"{kind} without an owner predicate: {sql}"


async def test_the_auth_read_is_the_one_owner_agnostic_statement_and_says_so():
    pool = _Pool(row=_row(key_hash="f" * 64))
    out = await db.get_key_for_auth(pool, "f" * 64)
    assert out["key_hash"] == "f" * 64
    (_kind, sql, args), = pool.calls
    assert "key_hash = $1" in sql
    assert args == ("f" * 64,)
    doc = inspect.getdoc(db.get_key_for_auth) or ""
    assert "owner-agnostic" in doc.lower()


async def test_the_auth_read_returns_none_for_a_miss():
    assert await db.get_key_for_auth(_Pool(row=None), "f" * 64) is None


def test_the_client_projection_never_contains_key_hash():
    assert "key_hash" not in db._KEY_COLUMNS
    assert "key_hash" in db._AUTH_COLUMNS


async def test_no_client_facing_statement_selects_key_hash():
    calls = await _drive_every_scoped_function()
    for _kind, sql, _args in calls:
        if sql.lstrip().upper().startswith("INSERT"):
            # INSERT names key_hash as a COLUMN to write; its RETURNING must not read it back.
            returning = sql.upper().split("RETURNING", 1)[-1]
            assert "KEY_HASH" not in returning, sql
            continue
        assert "key_hash" not in sql, sql


async def test_create_binds_org_id_explicitly_and_the_workflows_as_a_plain_list():
    pool = _Pool(row=_row())
    wf = [{"id": "w", "name": "W"}]
    await db.create_api_key(
        pool, org_id=ORG, user_id=USER, label="Zapier", key_prefix="srl_live_abcd",
        key_hash="0" * 64, workflows=wf, expires_at=None,
    )
    (_kind, sql, args), = pool.calls
    assert ORG in args and USER in args
    assert wf in args                      # the list itself, never json.dumps(wf)
    assert not any(isinstance(a, str) and a.startswith("[") for a in args)
    assert not re.search(r"^\s*import json\b", inspect.getsource(db), re.M)


async def test_a_duplicate_active_label_raises_duplicate_key_label():
    err = asyncpg.UniqueViolationError("duplicate key")
    err.constraint_name = "api_keys_owner_label_active_uq"
    pool = _Pool(raise_on_fetchrow=err)
    with pytest.raises(db.DuplicateKeyLabel):
        await db.create_api_key(
            pool, org_id=ORG, user_id=USER, label="Zapier", key_prefix="srl_live_abcd",
            key_hash="0" * 64, workflows=[{"id": "w", "name": "W"}], expires_at=None,
        )


async def test_touch_last_used_carries_the_30_second_throttle():
    pool = _Pool()
    await db.touch_last_used(pool, KEY, org_id=ORG)
    (_kind, sql, args), = pool.calls
    assert "last_used_at IS NULL OR last_used_at < now() - interval '30 seconds'" in sql
    assert args == (KEY, ORG)


async def test_member_revoke_is_owner_scoped_and_admin_revoke_is_org_scoped():
    pool = _Pool(row=_row())
    await db.revoke_key(pool, key_id=KEY, org_id=ORG, owner_id=USER, revoked_by=USER)
    member_sql = pool.calls[0][1]
    assert "user_id = $" in member_sql and "org_id = $" in member_sql

    pool = _Pool(row=_row())
    await db.revoke_key(pool, key_id=KEY, org_id=ORG, owner_id=None, revoked_by=ADMIN)
    admin_sql = pool.calls[0][1]
    assert "org_id = $" in admin_sql
    assert "user_id = $" not in admin_sql
    assert ADMIN in pool.calls[0][2]


async def test_revoke_returns_none_for_a_miss_and_a_foreign_key():
    assert await db.revoke_key(_Pool(row=None), key_id=KEY, org_id=ORG, owner_id=USER, revoked_by=USER) is None


async def test_an_already_revoked_key_is_returned_unchanged():
    """The UPDATE only touches a live key; a second revoke reads the row back as it was, so the
    first revoker and time are never overwritten."""

    class _Twice(_Pool):
        async def fetchrow(self, sql, *args):
            self.calls.append(("fetchrow", sql, args))
            if sql.lstrip().upper().startswith("UPDATE"):
                return None
            return _row(revoked_at=datetime(2026, 10, 1, tzinfo=timezone.utc), revoked_by=USER)

    pool = _Twice()
    out = await db.revoke_key(pool, key_id=KEY, org_id=ORG, owner_id=USER, revoked_by=ADMIN)
    assert out["revoked_by"] == USER
    assert "revoked_at IS NULL" in pool.calls[0][1]


async def test_membership_is_read_live_from_org_members():
    pool = _Pool(value=None)
    assert await db.is_org_member(pool, org_id=ORG, user_id=USER) is False
    pool = _Pool(value=1)
    assert await db.is_org_member(pool, org_id=ORG, user_id=USER) is True
    assert "org_members" in pool.calls[0][1]


async def test_list_key_calls_reads_the_call_audit_rows_only():
    pool = _Pool(rows=[])
    since = datetime.now(timezone.utc)
    await db.list_key_calls(pool, org_id=ORG, key_ids=[str(KEY)], since=since)
    (_kind, sql, args), = pool.calls
    assert "audit_log" in sql
    assert "action_type LIKE 'api_key.%'" in sql
    assert "NOT IN ('api_key.create','api_key.revoke')" in sql
    # 293-REVIEW WR-02: one LATERAL read per key id, each with its own limit (never a shared 600).
    assert "unnest($2::text[])" in sql and "LATERAL" in sql
    assert "metadata->>'api_key_id' = k.api_key_id" in sql
    assert "LIMIT $4" in sql and "LIMIT 600" not in sql
    assert args == (ORG, [str(KEY)], since, 50)


async def test_list_key_calls_with_no_keys_reads_nothing():
    pool = _Pool(rows=[])
    assert await db.list_key_calls(pool, org_id=ORG, key_ids=[], since=datetime.now(timezone.utc)) == []
    assert pool.calls == []


async def test_list_for_org_names_the_owner_and_the_revoker():
    pool = _Pool(rows=[])
    await db.list_keys_for_org(pool, org_id=ORG)
    sql = pool.calls[0][1]
    assert "profiles" in sql
    assert "owner_name" in sql and "revoked_by_name" in sql


# 293-05 D-4 (G-4 step 5): every key in Org admin -> API keys read "owner an unknown member (you)",
# because the dev profiles carry no display_name and the name came from profiles alone. The owner
# and the revoker now fall back to the member's sign-in email, as the org members roster shows it.
async def test_the_owner_and_revoker_names_fall_back_to_the_member_email():
    for fn, kw in ((db.list_keys_for_org, {"org_id": ORG}),
                   (db.list_keys_for_owner, {"org_id": ORG, "user_id": USER})):
        pool = _Pool(rows=[])
        await fn(pool, **kw)
        sql = " ".join(pool.calls[0][1].split())
        assert "COALESCE(NULLIF(po.display_name, ''), uo.email) AS owner_name" in sql, fn.__name__
        assert "COALESCE(NULLIF(pr.display_name, ''), ur.email) AS revoked_by_name" in sql, fn.__name__
        assert "LEFT JOIN auth.users uo ON uo.id = k.user_id" in sql
        assert "LEFT JOIN auth.users ur ON ur.id = k.revoked_by" in sql


async def test_a_workflow_the_caller_cannot_read_returns_no_content():
    """Every content column is behind the readability predicate, so a foreign row's name or
    definition never leaves this module."""
    pool = _Pool(rows=[])
    await db.get_key_workflows(pool, workflow_ids=[KEY], user_id=USER, org_id=ORG)
    (_kind, sql, args), = pool.calls
    for col in ("name", "status", "definition"):
        assert f"THEN {col} END AS {col}" in sql
    assert "created_by = $2 AND org_id = $3" in sql
    assert args == ([KEY], USER, ORG)
