"""263-REVIEW.md CR-02 / CR-03 — ``POST /experts/draft`` must not read past the caller.

WHAT WAS WRONG. The draft endpoint builds the LLM's menu of grounding assets with three
raw queries on the **asyncpg pool**, which is a BYPASSRLS connection: the database will
not re-check anything the query itself does not say.

    folders: "... WHERE org_id = $1 OR is_org_shared = true ..."
    skills:  "... WHERE (org_id = $1 OR is_system = true) AND is_enabled = true ..."

The folders arm is an **unbracketed OR**, so it matched *every org's* shared folders —
their names went into the prompt and their UUIDs came back as ``knowledge_folder_ids``.
The skills arm carried **no owner/shared term at all**, so another user's **private**
skill in the same org reached the drafter and could be proposed as a ``member_skills``
entry the caller was never entitled to see. Both are the SEED-124 / SEED-125 class.

⚠ A SECOND-ORDER EFFECT THIS PHASE INTRODUCED, which is why this is fixed here rather
than merely noted: PACK-16's new save refusal answers *"…do not exist in your library:
<name>"*. Fed a leaked name, the refusal states something false about a skill the caller
should never have been shown, and echoes the name back while doing it.

WHY THE FENCE IS SHAPED LIKE THIS. The honest drive is a live two-user DB test, and that
is owed. What this file does instead is bind the app's SQL **to the live RLS policy it is
standing in for** — the policy text is read from ``supabase/full-schema.sql``, not
hardcoded here. So the fence fires if the query drifts, AND it fires if the *policy*
drifts and the query is left behind. A fence that pins only one side cannot see the gap
between them, which is the gap that produced both defects.

⛔ The premise is checked, never assumed: ``test_policies_still_carry_the_owner_arm``
fails if the policies stop containing the owner term, so this module can never pass
vacuously by asserting a rule the database no longer has.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[3]
_EXPERTS_API = _REPO / "backend" / "app" / "api" / "experts.py"
_FULL_SCHEMA = _REPO / "supabase" / "full-schema.sql"


def _source() -> str:
    assert _EXPERTS_API.is_file(), f"missing source under fence: {_EXPERTS_API}"
    return _EXPERTS_API.read_text(encoding="utf-8")


def _policy(table: str) -> str:
    """The live SELECT policy for ``table``, read from the deploy artifact."""
    assert _FULL_SCHEMA.is_file(), f"missing schema artifact: {_FULL_SCHEMA}"
    for line in _FULL_SCHEMA.read_text(encoding="utf-8").splitlines():
        if f"ON public.{table} FOR SELECT" in line:
            return line
    pytest.fail(f"no SELECT policy for public.{table} in full-schema.sql")


def _query(keyword: str) -> str:
    """The one SQL literal in the draft handler that selects from ``keyword``.

    ⛔ Parsed with ``ast``, never regexed out of the raw text. These predicates are long
    enough to be written as implicitly-concatenated adjacent literals across several
    lines, and a regex over the source sees only the FIRST fragment — which contains the
    table name and none of the gate. A fence that reads half a predicate reports a
    missing term that is actually present, or passes over one that is actually absent.
    ``ast`` folds implicit concatenation, so the string here is the string Postgres gets.
    """
    tree = ast.parse(_source())
    hits = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and node.value.lstrip().upper().startswith("SELECT ")
        and f"FROM public.{keyword}" in node.value
    ]
    assert len(hits) == 1, (
        f"expected exactly ONE SELECT literal against public.{keyword} in experts.py, "
        f"found {len(hits)}: {hits!r}"
    )
    return hits[0]


# ── the premise ───────────────────────────────────────────────────────────────────────


def test_policies_still_carry_the_owner_arm():
    """⛔ If this fails, the rest of this module is asserting a rule the DB no longer has."""
    folders = _policy("folders")
    skills = _policy("skills")

    # folders: org-gated AND (owner OR shared-subtree)
    assert "auth.uid() = user_id" in folders, folders
    assert "folder_is_org_shared" in folders, folders

    # skills: is_system escape, then org-gated AND (owner OR org-shared)
    assert "is_system = true" in skills, skills
    assert "auth.uid() = user_id" in skills, skills
    assert "is_org_shared = true" in skills, skills


# ── CR-02: folders ────────────────────────────────────────────────────────────────────


def test_folders_query_is_not_the_unbracketed_or():
    """The exact leaky predicate, named so a revert cannot pass quietly."""
    q = _query("folders")
    assert "org_id = $1 OR is_org_shared" not in q, (
        "CR-02 regression: an unbracketed OR matches EVERY org's shared folders on a "
        f"BYPASSRLS connection. Got: {q}"
    )


def test_folders_query_gates_on_org_AND_owner_or_shared():
    q = _query("folders")
    assert "org_id = $1" in q, q
    # The org term must be ANDed with the visibility arm, never ORed past it.
    assert re.search(r"org_id = \$1\s+AND\s*\(", q), (
        f"the org predicate must AND with the visibility arm. Got: {q}"
    )
    assert "user_id = $2" in q, f"the caller's own folders must stay visible. Got: {q}"
    # Mirrors `folder_is_org_shared(id)` in the live policy — the flat column is NOT the
    # same rule: sharing is inherited down a subtree, and the column alone misses children.
    assert "folder_is_org_shared" in q, (
        f"must mirror the policy's subtree-aware share check, not the flat column. Got: {q}"
    )


# ── CR-03: skills ─────────────────────────────────────────────────────────────────────


def test_skills_query_carries_an_owner_or_shared_arm():
    q = _query("skills")
    assert "user_id = $2" in q, (
        "CR-03 regression: with no owner term, ANOTHER USER'S PRIVATE skill in the same "
        f"org reaches the drafter. Got: {q}"
    )
    assert "is_org_shared = true" in q, q


def test_skills_query_keeps_the_is_system_escape_and_the_enabled_filter():
    """The fix must not over-correct: built-ins are deliberately cross-org."""
    q = _query("skills")
    assert "is_system = true" in q, q
    assert "is_enabled = true" in q, q


def test_skills_query_ands_the_org_gate_with_the_visibility_arm():
    q = _query("skills")
    assert re.search(r"org_id = \$1\s+AND\s*\(", q), (
        f"the org predicate must AND with the visibility arm. Got: {q}"
    )


# ── the arm that must NOT change ──────────────────────────────────────────────────────


def test_connections_query_is_left_alone_because_its_policy_is_org_only():
    """⛔ Not an oversight — MEASURED. ``connector_connections_select`` is org-scoped with
    no owner term, so a connection IS an org asset and adding one here would be a
    behaviour change dressed as a security fix."""
    policy = _policy("connector_connections")
    assert "auth.uid()" not in policy, (
        f"the connections policy grew an owner term; the draft query must follow it. Got: {policy}"
    )
    q = _query("connector_connections")
    assert "org_id = $1" in q, q
    assert "user_id" not in q, q
