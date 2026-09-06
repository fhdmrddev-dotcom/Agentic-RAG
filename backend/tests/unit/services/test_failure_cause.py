"""Phase 235 plan 02 (LIB-10 · D-235-10) — the source-failure classifier is DATA.

⭐ THE PROPERTY THIS SUITE EXISTS FOR. `watch_service.py:189-197` classified a source failure
with a substring sniff (`if "403" in err_str or "permission" in err_str`) and wrote `str(exc)`
into a `text` column that the UI rendered verbatim. This suite pins the replacement: one named
cause, a hard/soft flag that is a TABLE rather than an inline branch, and a classifier that
returns `unknown` rather than guessing.

⚠ NON-VACUITY FIRST. Every per-cause loop below rests on `get_args(Cause)`. An emptied union
would satisfy each of them vacuously while looking green, so the length assertion is the first
collected test in the file.
"""

from __future__ import annotations

from typing import get_args

import pytest

from app.services.sources.failure_cause import (
    HARD_CAUSES,
    SOFT_FAILURE_THRESHOLD,
    Cause,
    classify_failure_cause,
    is_hard,
)

# ── ⚠ NON-VACUITY — asserted BEFORE anything loops over the union ─────────────────────────


def test_non_vacuity_the_cause_union_has_four_members() -> None:
    """An emptied `Cause` union would make every property below pass over nothing."""
    assert len(get_args(Cause)) == 4
    assert set(get_args(Cause)) == {
        "token_revoked",
        "folder_gone",
        "unreachable",
        "unknown",
    }


# ── THE HARD / SOFT PARTITION ─────────────────────────────────────────────────────────────


def test_hard_soft_is_a_total_partition_over_the_union() -> None:
    """Every member of `Cause` is in exactly one of HARD_CAUSES / its complement.

    Asserted as a partition over `get_args(Cause)` rather than by listing four names, so a
    fifth cause added without a hard/soft verdict reds this test rather than sliding into the
    soft arm by default.
    """
    causes = set(get_args(Cause))
    assert HARD_CAUSES <= causes, "HARD_CAUSES names a cause that is not in the union"
    soft = causes - HARD_CAUSES
    assert HARD_CAUSES | soft == causes
    assert HARD_CAUSES & soft == set()
    # And both halves are non-empty, or the partition is a relabelled constant.
    assert HARD_CAUSES
    assert soft


def test_is_hard_reads_the_table_for_every_member_of_the_union() -> None:
    for cause in get_args(Cause):
        assert is_hard(cause) is (cause in HARD_CAUSES)


@pytest.mark.parametrize("cause", ["token_revoked", "folder_gone"])
def test_the_unrecoverable_causes_are_hard(cause: str) -> None:
    assert is_hard(cause) is True


@pytest.mark.parametrize("cause", ["unreachable", "unknown"])
def test_the_recoverable_causes_are_soft(cause: str) -> None:
    assert is_hard(cause) is False


def test_the_soft_threshold_is_three_consecutive_failures() -> None:
    """D-235-10: soft causes need 3 consecutive failures; a uniform rule was rejected."""
    assert SOFT_FAILURE_THRESHOLD == 3


# ── CLASSIFICATION BY MESSAGE ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "message",
    [
        "Source access unauthorized: 403 invalid_grant",
        "Token has been expired or revoked.",
        "invalid_grant",
        "401 Unauthorized",
        "Request had insufficient authentication scopes",
        # ⚠ The tokens `watch_service.py:192` sniffed for must stay reachable, or a failure
        #   that is classified TODAY becomes unclassified by this replacement.
        "The caller does not have permission",
        "unauthorized",
    ],
)
def test_authorisation_failures_classify_as_token_revoked(message: str) -> None:
    assert classify_failure_cause(message) == "token_revoked"


@pytest.mark.parametrize(
    "message",
    [
        "File not found: folder no longer shared",
        "404 notFound",
        "fileNotFound: the item was removed",
        "The folder was unshared with this connection",
    ],
)
def test_missing_folder_failures_classify_as_folder_gone(message: str) -> None:
    assert classify_failure_cause(message) == "folder_gone"


@pytest.mark.parametrize(
    "message",
    [
        "HTTPSConnectionPool: Read timed out",
        "connection reset by peer",
        "429 rate limit exceeded",
        "503 Service Unavailable",
        "The service is temporarily unavailable",
        "timeout while listing files",
    ],
)
def test_transient_failures_classify_as_unreachable(message: str) -> None:
    assert classify_failure_cause(message) == "unreachable"


@pytest.mark.parametrize("message", [None, "", "   ", "something nobody has seen before"])
def test_an_unrecognised_message_never_guesses(message: str | None) -> None:
    assert classify_failure_cause(message) == "unknown"


# ── CLASSIFICATION BY STATUS CODE ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "status_code,expected",
    [
        (401, "token_revoked"),
        (403, "token_revoked"),
        (404, "folder_gone"),
        (429, "unreachable"),
        (500, "unreachable"),
        (502, "unreachable"),
        (503, "unreachable"),
    ],
)
def test_the_status_table_is_consulted_before_the_regexes(
    status_code: int, expected: str
) -> None:
    # The message is deliberately unrecognisable: the verdict must come from the code.
    assert classify_failure_cause("no words we know", status_code=status_code) == expected


def test_a_status_code_we_have_no_row_for_falls_through_to_the_message() -> None:
    assert classify_failure_cause("Read timed out", status_code=418) == "unreachable"
    assert classify_failure_cause(None, status_code=418) == "unknown"


def test_every_produced_cause_is_a_member_of_the_union() -> None:
    """Totality on the OUTPUT side: the classifier cannot emit a value with no sentence."""
    causes = set(get_args(Cause))
    samples = [
        None,
        "",
        "403 permission denied",
        "404 notFound",
        "Read timed out",
        "an unrecognised sentence",
    ]
    for sample in samples:
        assert classify_failure_cause(sample) in causes


# ── THE MODULE WRITES NOTHING ─────────────────────────────────────────────────────────────


def test_the_module_imports_no_database_and_no_service_graph() -> None:
    """`failure_cause.py` is data. It must stay importable with no app wiring at all."""
    from pathlib import Path

    import app.services.sources.failure_cause as mod

    source = Path(mod.__file__).read_text(encoding="utf-8")
    for forbidden in ("app.db", "supabase", "asyncpg", "app.dependencies"):
        for line in source.splitlines():
            stripped = line.strip()
            if stripped.startswith("import ") or stripped.startswith("from "):
                assert forbidden not in stripped, f"{forbidden} imported at: {stripped}"
