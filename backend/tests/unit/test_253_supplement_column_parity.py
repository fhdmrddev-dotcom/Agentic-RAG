"""Phase 253 (253-01 / CRED-03 / D-08) — §5's COLUMN LIST AND `_TABLE_SELECTABLE_KEYS` ARE
THE SAME SET WRITTEN IN TWO LANGUAGES, AND NOTHING EXECUTABLE HELD THEM TOGETHER.

── WHAT DRIFTS, AND WHAT IT COSTS ────────────────────────────────────────────────────────
Migration 118 revoked the blanket `GRANT SELECT` on `connector_connections` from
`authenticated` and re-granted it COLUMN BY COLUMN so that `secret_ciphertext` could be
excluded by omission. That has a consequence the supplement's own §5 header already records:
**`SELECT *` now FAILS for `authenticated`**, because Postgres expands `*` to every column
and refuses the whole statement if one is missing. `connector_service._SELECTABLE_COLUMNS` is
DERIVED from `ConnectorConnectionResponse`'s keys, so every connector read names every
response field by name — and one ungranted column answers
`42501 permission denied for table connector_connections` on EVERY read, including rows that
have nothing to do with the new column. It looks like an outage, not a permissions bug.

That already happened once: Phase 211 found §5 four columns behind and fixed it. This file is
the fence that was missing then, so the next new response field reds here instead of in
production.

── WHY A PYTHON TEST AND NOT THE NODE PARITY GATE (D-08) ────────────────────────────────
`scripts/check-schema-acl-parity.cjs` guards the FUNCTION half by comparing signature TEXT.
It cannot guard this half: `_TABLE_SELECTABLE_KEYS` is
`tuple(ConnectorConnectionResponse.model_fields)` minus a frozenset — a VALUE derived from a
Pydantic model's keys, which is exactly what a regex cannot see. A JS fence here would pin a
SPELLING rather than a value, and would go green over a model that had changed underneath it.

── WHY IT TOUCHES NO DATABASE ───────────────────────────────────────────────────────────
D-04 keeps the greenfield HARNESS (`scripts/check-greenfield-privileges.py`) out of
`backend/tests/unit` because that suite sits at a 71-failure ceiling with zero headroom and
must not gain a live-database precondition. A file-reading fence over the same artifact is a
different thing, and `backend/tests/unit/test_241_bench_safety.py` is the precedent that the
project already draws the line exactly there. ⭐ Every case here PASSES, so this raises the
suite total without touching the ceiling.

── THE DISCIPLINE THE SQL EXTRACTOR IS HELD TO ──────────────────────────────────────────
Modelled on `test_211_closed_set_agreement.py`: **the extractor is falsified on synthetic
input BEFORE the real file is read anywhere in this module.** A regex that silently matched
nothing would pass forever while proving nothing, which is the single most likely way a
cross-language fence ships dead. Two controls, both required — a synthetic block carrying a
deliberately WRONG member must yield that wrong member, and PROSE that merely mentions column
names must yield `None`. The prose control is not decorative: the real §5 block is preceded by
comment lines naming `secret_ciphertext`, `mcp_server_url`, `tool_grants`, `discovered_tools`
and `service_id` directly, so an extractor that read comments would silently include the one
column whose ABSENCE is the entire point of the block.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.services.connector_service import _TABLE_SELECTABLE_KEYS

# backend/tests/unit/<this file>  ->  parents[2] == backend/, parents[3] == repo root.
# ⚠ If this file is moved, fix the `parents[3]` arithmetic above rather than deleting this
#   control — a wrong root makes `_SUPPLEMENT.exists()` false, and the non-vacuity case below
#   is what turns that into a RED instead of a silent green.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_SUPPLEMENT = _REPO_ROOT / "scripts" / "full-schema-supplement.sql"

#: The ONE column that must never appear in §5's grant. Named as a constant so the assertion
#: message can quote it and a reader does not have to infer why the case exists.
_FORBIDDEN_COLUMN = "secret_ciphertext"

#: The single intentional difference between §5 and the response model (MC-3). It is granted
#: by supabase/migrations/118_connector_secret_column_privilege.sql:112-124 and is NOT a field
#: of `ConnectorConnectionResponse`. D-05 admits no exception list, so it stays in the
#: supplement — and it is pinned BY NAME here so a SECOND unexplained extra reds.
_INTENTIONAL_EXTRAS = {"created_by"}

#: Matches the BODY of `GRANT SELECT ( … ) ON public.connector_connections TO authenticated;`
#: across newlines. Named group, so a failure message can quote what it read.
_GRANT_BLOCK = re.compile(
    r"GRANT\s+SELECT\s*\((?P<cols>[^)]*)\)\s*ON\s+public\.connector_connections"
    r"\s+TO\s+authenticated\s*;",
    re.IGNORECASE | re.DOTALL,
)


def _strip_sql_comments(sql: str) -> str:
    """⛔ COMMENTS MUST GO FIRST — see the prose control below for what happens otherwise."""
    out = []
    for line in sql.split("\n"):
        i = line.find("--")
        out.append(line if i == -1 else line[:i])
    return "\n".join(out)


def _granted_columns(sql_text: str) -> set[str] | None:
    """The columns §5 grants, or ``None`` when the block was not found.

    ``None`` rather than ``set()`` is load-bearing: an empty set and "the regex did not match"
    are different facts, and conflating them is exactly how a cross-language fence ships green
    while reading nothing.
    """
    match = _GRANT_BLOCK.search(_strip_sql_comments(sql_text))
    if match is None:
        return None
    return {c.strip().lower() for c in match.group("cols").split(",") if c.strip()}


# ── 1 · CONTROLS — run before the real file is read anywhere in this module ───────────────


def test_the_sql_extractor_is_falsified_on_synthetic_input_first():
    """⚠ CONTROL. An extractor that silently matched nothing would make every case below pass
    forever while proving nothing about the artifact."""
    wrong = _granted_columns(
        """
        GRANT SELECT (
            id,
            wire_transfer_account,
            secret_ciphertext
        ) ON public.connector_connections TO authenticated;
        """
    )
    assert wrong == {"id", "wire_transfer_account", "secret_ciphertext"}, (
        "the control block carries two deliberately wrong members and the extractor must "
        f"REPORT them rather than normalise them away; it returned {wrong!r}. An extractor "
        "that cannot see a wrong member cannot see a drifted one either"
    )

    single_line = _granted_columns(
        "GRANT SELECT (auth_type, status) ON public.connector_connections TO authenticated;"
    )
    assert single_line == {"auth_type", "status"}, (
        "the one-line spelling of the same statement (migration 150:58's shape) was not read: "
        f"{single_line!r}"
    )


def test_the_extractor_returns_none_for_prose_that_merely_names_columns():
    """⚠ CONTROL, and it is the one that matters for THIS file.

    §5's real block is preceded by comment lines naming `secret_ciphertext`, `mcp_server_url`,
    `tool_grants`, `discovered_tools` and `service_id`. An extractor that read comments would
    silently include the one column whose ABSENCE is the point of the block — a fence that
    fires on English is a fence that gets loosened away.
    """
    prose = _granted_columns(
        "-- Three of the four (`mcp_server_url`, `tool_grants`, `discovered_tools`) drifted in\n"
        "-- at Phase 206. The column that is not here is `secret_ciphertext`.\n"
        "-- e.g. GRANT SELECT (secret_ciphertext) ON public.connector_connections TO authenticated;\n"
    )
    assert prose is None, (
        f"the extractor matched commented-out SQL and returned {prose!r}. Every one of those "
        "lines is a COMMENT; reading them would silently admit `secret_ciphertext` into the "
        "granted set and make the forbidden-column case below vacuous"
    )


# ── 2 · THE FENCE ─────────────────────────────────────────────────────────────────────────


def test_the_supplement_is_where_this_file_thinks_it_is_and_the_block_was_found():
    """⚠ NON-VACUITY, asserted as two separate facts with distinct messages.

    A green result here must not be able to mean "the file moved" or "the regex matched
    nothing". The controls above prove the extractor reads; this proves it read THIS artifact.
    """
    assert _SUPPLEMENT.exists(), (
        f"{_SUPPLEMENT} does not exist — the walk found nothing to check, so a green result "
        "below would mean the file moved rather than that the columns agree. Fix the "
        "`parents[3]` arithmetic at the top of this file rather than deleting this control."
    )
    granted = _granted_columns(_SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    assert granted is not None, (
        f"the `GRANT SELECT ( ... ) ON public.connector_connections TO authenticated;` block "
        f"was not found in {_SUPPLEMENT.name}. The extractor is proved non-vacuous by the "
        "controls above, so this means §5's shape changed — re-derive the matcher rather than "
        "deleting this case."
    )
    assert len(granted) >= 20, (
        f"§5 grants only {len(granted)} columns ({sorted(granted)}). Phase 253 took it to 20 "
        "(19 response keys + created_by); fewer means a column was dropped."
    )


def test_every_response_key_the_service_projects_is_granted_by_section_5():
    """SC#2 — the direction that causes an outage.

    Every connector read names every key of `_TABLE_SELECTABLE_KEYS`. One key §5 does not
    grant makes a greenfield database answer 42501 for the WHOLE table, on every connector
    read, for every row.
    """
    granted = _granted_columns(_SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    assert granted is not None
    missing = set(_TABLE_SELECTABLE_KEYS) - granted
    assert missing == set(), (
        f"{sorted(missing)} are projected by connector_service._TABLE_SELECTABLE_KEYS but are "
        f"NOT granted by §5 of {_SUPPLEMENT.name}. §5 grants {sorted(granted)}; the service "
        f"projects {sorted(_TABLE_SELECTABLE_KEYS)}. A greenfield database built from "
        "supabase/full-schema.sql would answer `42501 permission denied for table "
        "connector_connections` on EVERY connector read — it looks like an outage, not a "
        "permissions bug. Add the column to §5 AND to full-schema.sql's tail, in one commit."
    )


def test_the_only_extra_column_section_5_grants_is_the_one_named_here():
    """MC-3 — the reverse direction, pinned BY NAME so a second extra cannot slip in.

    ⚠ This is deliberately NOT plain set equality. §5 legitimately grants `created_by`, which
    is not a field of `ConnectorConnectionResponse` at all; equality would red on day one and
    get loosened away, which is worse than no fence.
    """
    granted = _granted_columns(_SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    assert granted is not None
    extras = granted - set(_TABLE_SELECTABLE_KEYS)
    assert extras == _INTENTIONAL_EXTRAS, (
        f"§5 grants {sorted(extras)} that the response model does not project; the only "
        f"intentional extra is {sorted(_INTENTIONAL_EXTRAS)} (granted by "
        "supabase/migrations/118_connector_secret_column_privilege.sql:112-124, and not a "
        "field of ConnectorConnectionResponse). A NEW name here is either a column the "
        "response should carry, or a grant nothing needs — say which, in the supplement, "
        "before widening this set."
    )


def test_section_5_never_grants_the_secret_column():
    """The whole point of §5: the column that is ABSENT.

    This sits BESIDE `connector_service`'s module-scope
    `assert "secret_ciphertext" not in _RESPONSE_KEYS`, not instead of it. That assert guards
    the RESPONSE; this guards the GRANT, and the two can drift apart.
    """
    granted = _granted_columns(_SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    assert granted is not None
    assert _FORBIDDEN_COLUMN not in granted, (
        f"§5 of {_SUPPLEMENT.name} grants `{_FORBIDDEN_COLUMN}` to `authenticated`. That is "
        "the tenant credential envelope, and excluding it by omission is the entire reason "
        f"migration 118 re-granted this table column by column. §5 read: {sorted(granted)}"
    )


def test_the_granted_set_is_ordering_independent():
    """⚠ Asserted as SET equality everywhere above, never ORDER — said here rather than left
    to silence.

    `_TABLE_SELECTABLE_KEYS` follows the Pydantic model's field order; §5's list is
    hand-ordered by migration-arrival. An ordered comparison would red on a harmless field
    reorder, and a fence that reds on a harmless change is a fence somebody deletes.
    """
    granted = _granted_columns(_SUPPLEMENT.read_text(encoding="utf-8", errors="replace"))
    assert granted is not None
    assert granted == set(_TABLE_SELECTABLE_KEYS) | _INTENTIONAL_EXTRAS, (
        f"§5 read {sorted(granted)}; expected the response projection "
        f"{sorted(_TABLE_SELECTABLE_KEYS)} plus {sorted(_INTENTIONAL_EXTRAS)}. The two "
        "preceding cases name which direction drifted."
    )
