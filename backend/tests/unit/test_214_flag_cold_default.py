"""Phase 214 plan 14 Task 1 (D-214-19) — the COLD read Phase 209 did not have.

⚠ **Phase 209's 16/16 browser drive ran against a hand-flipped DATABASE.** Every criterion it
recorded was true of that operator's box and true of nobody else's, because
``visual_workflow_canvas`` cold-read ``"off"`` from Phase 181 all the way through v3.7. A
criterion verified behind a flipped row is not shipped — that is the ROADMAP's own complaint and
the entire reason D-214-19 exists.

So every case here resolves the flag with **NOTHING SEEDED**. The fixtures below construct the
resolver against (a) a settings object whose ``feature_visibility`` is an empty dict — the shape
of a fresh ``app_settings`` row — and (b) a ``load_app_settings`` that RAISES, the shape of a cold
cache or a DB blip. ⚠ **A case that seeds ``feature_visibility`` first and then asserts
``everyone`` has tested the seeding, not the default**, which is precisely the failure being
guarded here. Nothing in this file writes a row, and ``test_no_case_in_this_file_seeds_the_flag``
reads this module's own source to keep it that way.

D-214-19's second half is asserted just as hard: ``live_connectors`` STAYS ``"off"``. That flag
arms real outbound sending for every user; a future flip must be a deliberate decision with its
own evidence, and these cases are what make an accidental one loud.

The last case closes a parity obligation that ``scripts/check-deploy-drift.sh`` structurally
cannot see: measured 2026-08-28,
``grep -n "feature_visibility\\|visual_workflow_canvas" docs/OPERATOR.md scripts/check-deploy-drift.sh``
returned ZERO before this plan. The drift script reads env-var keys, migration filenames, the
sandbox image tag and the compose file — never the audience map. So OPERATOR.md's cold-default
table is checked HERE instead, or it is checked by nothing.
"""
from __future__ import annotations

import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.models import user_settings as us

_REPO_ROOT = Path(__file__).resolve().parents[3]
_OPERATOR_DOC = _REPO_ROOT / "docs" / "OPERATOR.md"
_THIS_FILE = Path(__file__).resolve()

# The six governed features as of Phase 214. A SEVENTH appearing without a recorded decision is
# the thing test_governed_feature_set_is_exactly_the_six_known_keys catches.
_EXPECTED_KEYS = {
    "skill_studio",
    "model_management",
    "workflow_authoring",
    "governance_health",
    "visual_workflow_canvas",
    "live_connectors",
}


@pytest.fixture
def unseeded_settings(monkeypatch):
    """A fresh ``app_settings`` row: the column exists, the JSONB is empty, no key is seeded.

    This is the state of a greenfield install after OPERATOR.md Step 3 item 3
    (``INSERT INTO app_settings (id) VALUES ('global')``) and before any operator has opened
    ``/admin``. It seeds NOTHING — that is the whole point of the fixture.
    """
    monkeypatch.setattr(
        us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={})
    )
    return None


@pytest.fixture
def cold_cache(monkeypatch):
    """The other unseeded shape: the settings read itself fails (cold cache / DB blip).

    ``_feature_record`` swallows the exception and yields ``{}``, so this must land on the very
    same default as ``unseeded_settings``. Two independent routes to "nothing stored".
    """

    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")

    monkeypatch.setattr(us, "load_app_settings", _boom)
    return None


# ── D-214-19 first half: the canvas flag COLD-READS "everyone" ────────────────────────────────


def test_canvas_cold_reads_everyone_on_a_fresh_unseeded_row(unseeded_settings):
    """⭐ THE ASSERTION PHASE 209 DID NOT HAVE. No seeded key -> "everyone"."""
    assert us.feature_audience("visual_workflow_canvas") == "everyone", (
        "the canvas flag must resolve 'everyone' with NOTHING seeded — a fresh install shows "
        "the canvas layer without an operator touching /admin (D-214-19)"
    )


def test_canvas_cold_reads_everyone_when_the_settings_read_fails(cold_cache):
    """The cold-cache route reaches the same default as the empty-JSONB route."""
    assert us.feature_audience("visual_workflow_canvas") == "everyone"


def test_the_cold_default_is_read_by_feature_audience_not_resolve_feature_access(unseeded_settings):
    """⚠ A REAL ASYMMETRY, pinned because reading past it would misread every case above.

    ``feature_audience`` falls back to ``_GOVERNED_FEATURES``; ``resolve_feature_access`` does
    NOT — it reads only the STORED record and fail-closes to ``False`` when there is none. So on
    a fresh box the canvas is granted by ``require_canvas``'s ``audience == "everyone"`` branch
    (``dependencies.py``), never by ``resolve_feature_access``, which is reached only for the
    ``role`` audience. A test that asserted ``resolve_feature_access(...) is True`` cold would
    fail for a reason that has nothing to do with this flip, and "fixing" it by seeding a row is
    the Phase 209 mistake wearing a different hat.
    """
    assert us.feature_audience("visual_workflow_canvas") == "everyone"
    assert us.resolve_feature_access("visual_workflow_canvas", "member", set()) is False, (
        "resolve_feature_access is fail-closed on an unseeded record BY DESIGN — the cold "
        "default lives in feature_audience, which is what require_canvas branches on"
    )
    # And the honored-record path agrees with the cold default it replaces, so an operator who
    # explicitly re-affirms the flip in /admin changes nothing observable.
    stored = SimpleNamespace(
        feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}}
    )
    original = us.load_app_settings
    try:
        us.load_app_settings = lambda: stored
        assert us.feature_audience("visual_workflow_canvas") == "everyone"
        assert us.resolve_feature_access("visual_workflow_canvas", "member", set()) is True
    finally:
        us.load_app_settings = original


def test_canvas_is_not_off_in_the_authoritative_dict():
    """Read the ONE authoritative cold default directly — no fixture, no resolver."""
    assert us._GOVERNED_FEATURES["visual_workflow_canvas"] == "everyone"


# ── D-214-19 second half: live_connectors STAYS off ───────────────────────────────────────────


def test_live_connectors_cold_reads_off_on_a_fresh_unseeded_row(unseeded_settings):
    """⛔ NOT flipped by this phase. Arming real outbound sending is its own decision."""
    assert us.feature_audience("live_connectors") == "off", (
        "D-214-19 flips the canvas flag ONLY — live_connectors arms real outbound sending for "
        "every user and stays a separately armed decision"
    )


def test_live_connectors_cold_reads_off_when_the_settings_read_fails(cold_cache):
    assert us.feature_audience("live_connectors") == "off"


def test_live_connectors_denies_a_plain_non_operator_cold(unseeded_settings):
    """The consequence: nobody is granted live sending cold, at any role or group."""
    assert us.resolve_feature_access("live_connectors", "org_admin", {"anything"}) is False
    assert us.resolve_feature_access("live_connectors", "member", set()) is False


def test_live_connectors_is_off_in_the_authoritative_dict():
    assert us._GOVERNED_FEATURES["live_connectors"] == "off"


# ── the set itself ────────────────────────────────────────────────────────────────────────────


def test_governed_feature_set_is_exactly_the_six_known_keys():
    """A SEVENTH governed feature appearing without a recorded decision is the thing to catch.

    Not a style check: every key here is a visibility boundary, and one added silently ships a
    default nobody chose. Adding a feature is legitimate — it just has to update this set, its
    ``_GOVERNED_FEATURES`` comment, and OPERATOR.md's table in the SAME commit.
    """
    assert set(us._GOVERNED_FEATURES) == _EXPECTED_KEYS, (
        "a governed feature was added or removed — update this set, the dict's comment, and "
        "the docs/OPERATOR.md cold-default table together"
    )


def test_every_governed_default_is_a_recognized_audience_enum():
    """No booleans, no typos — a default outside the enum silently safe-denies at read time."""
    for feature, audience in us._GOVERNED_FEATURES.items():
        assert audience in ("everyone", "operators", "role", "off"), (
            f"{feature!r} has cold default {audience!r}, which feature_audience does not "
            "recognize — it would be re-defaulted rather than honored"
        )


# ── the parity the drift script cannot check ──────────────────────────────────────────────────


def test_operator_doc_names_every_governed_feature_and_its_cold_default():
    """⚠ scripts/check-deploy-drift.sh CANNOT see this. Measured: grep returns zero.

    The drift script's four checks are env-var keys, Step-3 migration FILENAMES, the sandbox
    image tag, and the compose parse. ``feature_visibility`` appears in none of them, so the
    same-commit parity rule for this table is enforced here or nowhere.
    """
    doc = _OPERATOR_DOC.read_text(encoding="utf-8")
    for feature, audience in us._GOVERNED_FEATURES.items():
        assert feature in doc, (
            f"docs/OPERATOR.md does not name the governed feature {feature!r} — a fresh "
            "operator cannot see what their box switches on before they touch anything"
        )
        # The feature and its cold default must sit on ONE line (the table row), so a stale
        # default cannot hide behind a correct-looking mention elsewhere in the document.
        row = re.compile(
            r"^.*`" + re.escape(feature) + r"`.*`" + re.escape(audience) + r"`.*$",
            re.MULTILINE,
        )
        assert row.search(doc), (
            f"docs/OPERATOR.md names {feature!r} but not beside its cold default "
            f"{audience!r} on the same row — the table has drifted from _GOVERNED_FEATURES"
        )


def test_operator_doc_row_check_actually_fires_positive_control():
    """The control: the same row regex must FAIL for a default the doc does not carry.

    Without this, a regex that silently never matched would make the test above vacuous —
    the 187-24 trap, which fired at least seven times in this phase.
    """
    doc = _OPERATOR_DOC.read_text(encoding="utf-8")
    wrong = re.compile(
        r"^.*`visual_workflow_canvas`.*`operators`.*$", re.MULTILINE
    )
    assert wrong.search(doc) is None, (
        "the row regex matched a default that is NOT the canvas flag's — the check above "
        "would pass for the wrong reason"
    )
    right = re.compile(
        r"^.*`visual_workflow_canvas`.*`everyone`.*$", re.MULTILINE
    )
    assert right.search(doc) is not None, "positive control: the real row must match"


def test_no_case_in_this_file_seeds_the_flag():
    """⭐ The fixture-shape guard: this file must never WRITE a feature_visibility row.

    Phase 209 verified a criterion against a flipped database. A future edit that reaches for
    ``set_feature_visibility`` or a real pool here would reproduce exactly that, and the suite
    would stay green while proving nothing about the default. Reads this module's own source.
    """
    src = _THIS_FILE.read_text(encoding="utf-8")
    # Strip the docstrings/comments so the prose above (which names these on purpose) is not
    # counted as usage — the 187-24 trap, where a criterion greps its own warning text.
    code = re.sub(r'"""[\s\S]*?"""', '""', src)
    code = re.sub(r"^\s*#.*$", "", code, flags=re.MULTILINE)
    # Stripper-did-something control: a phrase that exists ONLY inside the module docstring
    # must be gone. Without it a stripper that silently matched nothing makes this vacuous.
    # ⚠ ASSEMBLED, for the same reason the forbidden needles below are — spelling it whole
    # here would put it in the CODE and the control would fail against itself.
    control = "hand-flipped " + "DATABASE"
    assert control in src, "control: the phrase must exist in the raw source"
    assert control not in code, "the docstring stripper did nothing"

    # ⚠ The needles are ASSEMBLED, never written whole — a literal "set_feature_visibility"
    # in this list would BE an occurrence and the check would fail against itself (187-24).
    forbidden = (
        "set_feature_" + "visibility",   # the writer
        "get_pg_" + "pool",              # a real connection
        "INSERT " + "INTO",              # raw seeding SQL
        "UPDATE " + "app_settings",      # the flip route's statement
    )
    for needle in forbidden:
        assert needle not in code, (
            f"{needle!r} appears in this file's CODE — a cold-default test that seeds or "
            "writes has tested the seeding, not the default (D-214-19 / Phase 209)"
        )

    # Positive control: the scan CAN find something, so a green result is evidence of absence
    # rather than evidence of a broken scan.
    assert ("feature_" + "audience") in code, (
        "positive control: the scan found none of its own real identifiers, so its silence "
        "about the forbidden ones proves nothing"
    )
