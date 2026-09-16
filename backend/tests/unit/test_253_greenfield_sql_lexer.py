"""Phase 253 plan 03 (CR-02) — the greenfield harness must not lose an ACL behind a
``--`` that lives INSIDE a string literal.

This module needs **no database, no driver and no environment variable**, for the same
reason ``test_253_supplement_column_parity.py`` gives about the artifact it reads:
``scripts/check-greenfield-privileges.py`` imports ``asyncio, hashlib, os, pathlib, re,
sys, time, urllib.parse`` at module level and NOTHING else — ``asyncpg`` is imported
lazily inside ``_require_asyncpg()``. So the parsing half of the harness is importable
and drivable as pure Python, which is precisely what makes this fence cheap enough to
run on every backend test invocation.

⛔ WHY THIS EXISTS. ``scripts/check-schema-acl-parity.cjs`` replaced ``line.indexOf('--')``
with a real lexer in plan 253-02, and its own docstring records why: a ``--`` inside a
string literal eats the literal's closing quote AND its semicolon, so every statement
boundary after it is wrong. The Python harness — shipped in the SAME phase, measuring the
SAME property against a real database — still did exactly the rejected thing::

    i = line.find("--")
    out.append(line if i == -1 else line[:i])

Reproduced by the reviewer on this tree, and re-driven here:

    COMMENT ON COLUMN public.t.c IS 'a value -- with a dash';
    REVOKE ALL ON public.secrets FROM anon;

collapses into ONE chunk that ``_parse_statement`` returns ``None`` for. The REVOKE is
gone from the expectation model, ``PrivilegeModel`` leaves ``anon`` seeded with the stock
``GRANT ALL`` — which is exactly what a greenfield database MISSING that mirrored REVOKE
actually has — so expected == measured and the harness exits **0**. ⛔ A false green, in
the PERMISSIVE direction, on the exact defect class Phase 253 exists to close.

Not a hypothetical shape: ``supabase/migrations/180_app_settings_self_hosted_endpoints.sql``
already writes a ``COMMENT ON COLUMN … IS '… -- …';``.

⚠ WHAT THIS FENCE DOES NOT ASSERT, said here so its silence is not read as coverage:
  · the *model* built from a parsed statement (``ROLES`` still drops the ``public``
    grantee — WR-05, deferred with a mechanical re-open trigger). The ``FROM PUBLIC`` arm
    below therefore asserts the SPLIT and the chunk TEXT, never the model, so that it can
    neither go green if WR-05 is fixed nor stay red because it is not.
  · ``ON ALL TABLES IN SCHEMA`` (WR-09, deferred) and ``assert_derived_set`` (WR-04).
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

import pytest

# ── load the script module (it is not on the import path) ──────────────────────
# The house idiom, per backend/tests/unit/test_241_bench_safety.py:26-60.
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "check-greenfield-privileges.py"


def _load_harness():
    if "greenfield_privileges_under_test" in sys.modules:
        return sys.modules["greenfield_privileges_under_test"]
    if not _SCRIPT.exists():
        raise ImportError(f"the greenfield harness does not exist: {_SCRIPT}")
    spec = importlib.util.spec_from_file_location(
        "greenfield_privileges_under_test", _SCRIPT
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["greenfield_privileges_under_test"] = module
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


gf = _load_harness()


# ── NON-VACUITY CONTROL ────────────────────────────────────────────────────────


def test_the_symbols_this_fence_drives_actually_exist():
    """⛔ A rename must break this fence LOUDLY rather than turn it into a silent skip.

    Phase 242 measured two guards in this repo exiting 0 over zero parsed input. Every
    arm below reaches through ``_statements`` and ``_parse_statement``; if either name
    moves, ``getattr`` here fails first and names it.
    """
    for name in ("_statements", "_parse_statement", "derive_expectations",
                 "supplement_section5_columns"):
        assert hasattr(gf, name), (
            f"{name} is gone from scripts/check-greenfield-privileges.py — this fence "
            "drives it, so a rename must be deliberate, not silent."
        )
    assert callable(gf._statements)
    # And it must actually split: a two-statement input yields more than one chunk.
    assert len(gf._statements("SELECT 1; SELECT 2;")) > 1


def _parsed(sql: str):
    """Every non-None ``_parse_statement`` result over the lexed chunks of ``sql``."""
    return [p for p in (gf._parse_statement(c) for c in gf._statements(sql)) if p]


# ── RED 1 — THE COMMENT-SWALLOW (the review's own reproduction) ────────────────


def test_a_revoke_after_a_dash_bearing_literal_is_parsed():
    """RED 1. Against the shipped splitter every chunk returns ``None``."""
    sql = (
        "COMMENT ON COLUMN public.t.c IS 'a value -- with a dash';\n"
        "REVOKE ALL ON public.secrets FROM anon;\n"
    )
    parsed = _parsed(sql)
    assert parsed, (
        "the REVOKE after a `--`-bearing literal produced NO parsed statement — the "
        "expectation model would leave anon with the stock GRANT ALL, which is what an "
        "UNMIRRORED greenfield database has, so expected == measured and the harness "
        "would exit 0 in the permissive direction."
    )
    verb, privs, table, roles = parsed[0]
    assert verb == "REVOKE"
    assert table == "public.secrets"
    assert roles == ["anon"]
    assert privs == [("ALL", None)]


def test_the_literal_bearing_comment_statement_keeps_its_own_boundary():
    """The COMMENT and the REVOKE are TWO chunks, not one glued pair."""
    sql = (
        "COMMENT ON COLUMN public.t.c IS 'a value -- with a dash';\n"
        "REVOKE ALL ON public.secrets FROM anon;\n"
    )
    chunks = [c.strip() for c in gf._statements(sql) if c.strip()]
    assert len(chunks) == 2, chunks
    assert chunks[0].startswith("COMMENT ON COLUMN")
    assert "REVOKE" not in chunks[0], (
        "the REVOKE was swallowed into the COMMENT chunk — the literal's closing quote "
        "and semicolon were eaten by the `--`."
    )


# ── RED 2 — THE SAME SHAPE WITH `FROM PUBLIC` ──────────────────────────────────


def test_a_revoke_from_public_after_a_dash_bearing_literal_is_split_out():
    """RED 2. ⚠ Asserts the SPLIT and the chunk TEXT, never the model.

    ``ROLES`` drops the ``public`` grantee (WR-05, deferred), so an assertion on
    ``_parse_statement``'s roles here would either go green when WR-05 is fixed or stay
    red because it is not — neither of which is a statement about THIS defect. This is
    the project's own thrice-fired PUBLIC trap: ``REVOKE … FROM anon`` is a no-op while
    the PUBLIC grant stands, so the ``FROM PUBLIC`` statement is the one that matters
    most and the one a comment must never be able to hide.
    """
    sql = (
        "COMMENT ON COLUMN public.t.c IS 'careful -- this is not a comment';\n"
        "REVOKE ALL ON public.secrets FROM PUBLIC;\n"
    )
    chunks = [c.strip() for c in gf._statements(sql) if c.strip()]
    revokes = [c for c in chunks if c.upper().startswith("REVOKE")]
    assert len(revokes) == 1, chunks
    assert "FROM PUBLIC" in revokes[0].upper()
    assert "COMMENT ON COLUMN" not in revokes[0].upper()


# ── RED 3 — DOLLAR-QUOTE FALSE-POSITIVE CONTROL ────────────────────────────────


def test_an_acl_shaped_line_inside_a_dollar_quoted_body_is_a_phantom():
    """RED 3, and it is a FALSE-POSITIVE control, not a false-negative one.

    ⚠ 253-02 shipped a vacuous arm of exactly this shape in the ``.cjs`` — it wrapped an
    ordinary body containing a ``--`` and asserted the ACL AFTER it was still found, and
    it PASSED against its own planted defect because the body's terminator sat on a line
    of its own. The arm was replaced rather than the finding written off. This is the
    REPLACED arm: a body whose TEXT contains an ACL-shaped line at a statement boundary.
    A splitter that does not know ``$$`` mines the body and counts a PHANTOM revoke no
    database will ever execute — inflating the expected set and reding the harness
    against a CORRECT artifact, which is how a guard gets switched off. Quote-awareness
    alone does not save it: there is not a quote in sight.
    """
    sql = (
        "DO $$\n"
        "BEGIN\n"
        "  RAISE NOTICE 'x';\n"
        "REVOKE ALL ON public.phantom_from_body FROM anon;\n"
        "END\n"
        "$$;\n"
        "REVOKE ALL ON public.real_table FROM anon;\n"
    )
    tables = [p[2] for p in _parsed(sql)]
    assert "public.phantom_from_body" not in tables, (
        "an ACL-shaped line inside a dollar-quoted body was counted as a real statement"
    )
    assert "public.real_table" in tables, (
        "the ACL AFTER the dollar-quoted body was lost — the body's terminator was not "
        "recognised, so everything after it is inside a phantom literal."
    )


def test_a_tagged_dollar_quote_is_recognised_too():
    """``$tag$ … $tag$`` is the same construct with a name on it.

    ⚠ THE INTERNAL ``SELECT 1;`` IS LOAD-BEARING AND WAS ADDED AFTER A DRIVEN CHECK.
    The first version of this arm put the phantom REVOKE on the body's FIRST line, and
    it PASSED against the shipped splitter — because the naive ``split(";")`` produced a
    chunk beginning ``CREATE FUNCTION …``, which ``_ACL_RE``'s ``^`` anchor rejects for
    a reason that has nothing to do with dollar quoting. That is the same vacuity 253-02
    found in the ``.cjs``, one file over, so the fixture was changed rather than the
    finding written off. With the leading ``SELECT 1;`` the naive splitter yields a chunk
    that STARTS with ``REVOKE`` and counts the phantom — and the arm goes red.
    """
    sql = (
        "CREATE FUNCTION public.f() RETURNS void AS $body$\n"
        "  SELECT 1;\n"
        "REVOKE ALL ON public.phantom_tagged FROM anon;\n"
        "  SELECT 2\n"
        "$body$ LANGUAGE sql;\n"
        "REVOKE ALL ON public.after_tagged FROM anon;\n"
    )
    tables = [p[2] for p in _parsed(sql)]
    assert "public.phantom_tagged" not in tables, tables
    assert "public.after_tagged" in tables, tables


# ── RED 4 — THE DOUBLED-QUOTE ESCAPE ───────────────────────────────────────────


def test_a_doubled_single_quote_does_not_end_the_literal():
    """RED 4. ``'it''s -- fine'`` is ONE literal; the ACL after it is still found."""
    sql = (
        "COMMENT ON COLUMN public.t.d IS 'it''s got a doubled quote -- and a dash';\n"
        "REVOKE ALL ON public.escaped_table FROM anon;\n"
    )
    tables = [p[2] for p in _parsed(sql)]
    assert tables == ["public.escaped_table"], tables


def test_a_double_quoted_identifier_containing_a_dash_pair_is_not_a_comment():
    sql = 'REVOKE ALL ON public."odd -- name" FROM anon;\n'
    chunks = [c.strip() for c in gf._statements(sql) if c.strip()]
    assert len(chunks) == 1
    assert "odd -- name" in chunks[0]


# ── PRESERVED — the property the old stripper existed for ──────────────────────


def test_an_entirely_commented_verify_block_contributes_no_statement():
    """⛔ A FALSE RED IS HOW A GUARD GETS SWITCHED OFF.

    Migration tails carry entirely-commented VERIFY blocks quoting GRANT statements.
    Counting those inflates the expected set and reds the harness against a CORRECT
    artifact. Whatever the lexer gains, it must not lose this.
    """
    sql = (
        "-- VERIFY (entirely commented -- must NOT be counted):\n"
        "--   REVOKE ALL ON public.never_real FROM anon;\n"
        "--   GRANT SELECT ON public.never_real TO authenticated;\n"
    )
    assert _parsed(sql) == []


def test_a_block_comment_hides_its_contents_and_separates_its_neighbours():
    sql = (
        "/* REVOKE ALL ON public.in_a_block FROM anon; */\n"
        "REVOKE ALL ON public.after_a_block FROM anon;\n"
    )
    tables = [p[2] for p in _parsed(sql)]
    assert tables == ["public.after_a_block"], tables


def test_nested_block_comments_are_handled_like_postgres_does():
    """⚠ Postgres NESTS block comments; ``fnmatch``-grade strippers do not.

    Recorded as a DIVERGENCE note rather than left to be discovered: the ``.cjs``
    ``statements()`` tracks nesting depth and ``_statements`` mirrors it. The review's
    proposed Python snippet did not.
    """
    sql = (
        "/* outer /* inner */ still a comment\n"
        "REVOKE ALL ON public.nested_phantom FROM anon;\n"
        "*/\n"
        "REVOKE ALL ON public.after_nested FROM anon;\n"
    )
    tables = [p[2] for p in _parsed(sql)]
    assert tables == ["public.after_nested"], tables


# ── CRLF parity, the same property the .cjs pins ───────────────────────────────


def test_crlf_input_yields_the_same_parsed_statements_as_lf():
    lf = (
        "COMMENT ON COLUMN public.t.c IS 'x -- y';\n"
        "REVOKE ALL ON public.crlf_table FROM anon, authenticated;\n"
    )
    assert _parsed(lf) == _parsed(lf.replace("\n", "\r\n"))
    assert _parsed(lf), "the LF arm parsed nothing, so the comparison proves nothing"


# ── REAL-CORPUS COUNTERFACTUAL ─────────────────────────────────────────────────


def test_the_real_migration_corpus_still_derives_a_non_collapsed_model():
    """⛔ A lexer change that COLLAPSED the expectation model would be worse than the
    defect it fixes. The review measured 32 statements across 12 files on this tree.
    This arm holds the floor rather than pinning an exact number, so a new ACL-bearing
    migration does not red it — the exact figure and any delta belong in the SUMMARY.
    """
    if not gf.MIGRATIONS_DIR.exists():  # pragma: no cover - the repo always has it
        pytest.skip("migrations directory absent")
    _model, files, total, per_file = gf.derive_expectations()
    assert len(files) >= gf.MIN_MIGRATION_FILES
    assert total >= 32, f"the derived statement count COLLAPSED to {total}"
    assert len(per_file) >= 12, f"only {len(per_file)} file(s) contributed"


def test_the_supplement_section5_extraction_is_unaffected():
    """The SECOND caller of the old stripper. Its output must not move."""
    cols = gf.supplement_section5_columns()
    assert cols is not None, "the §5 GRANT block was not found at all"
    assert "created_by" in cols          # MC-3
    assert "secret_ciphertext" not in cols
    assert len(cols) == 20, cols
