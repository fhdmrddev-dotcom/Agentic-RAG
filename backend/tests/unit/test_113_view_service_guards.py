"""Phase 113 — service-layer guard unit tests (no DB).

WR-02 hardening: ``_uid`` must reject any value that is not a well-formed UUID
before it is interpolated into the PostgREST ``.or_()`` filter grammar. The
``user_id`` reaching ``list_views``/``get_view`` is the JWT-subject UUID and is
not attacker-influenced today, but ``get_supabase()`` is the SERVICE-ROLE client
(RLS bypassed), so the app-level ``user_id.eq.<...>`` predicate is the SOLE
owner-scoping gate — the guard makes that one runtime-value-into-DSL spot safe by
construction.
"""

from uuid import uuid4

import pytest

from app.services.document_view_service import _uid


def test_uid_accepts_uuid_object_and_string():
    u = uuid4()
    assert _uid(u) == str(u)
    assert _uid(str(u)) == str(u)


def test_uid_rejects_or_grammar_breakout():
    # A value crafted to escape `user_id.eq.<...>` into an extra `.or_()` term.
    with pytest.raises(ValueError):
        _uid("00000000-0000-0000-0000-000000000000,is_global.eq.true")


def test_uid_rejects_non_uuid():
    with pytest.raises(ValueError):
        _uid("not-a-uuid")
