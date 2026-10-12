"""Phase 275 code-review fix pass (275-REVIEW-backend.md B-WR-01) — the evaluator half, pure.

One document's date that cannot carry a period (year 9999 + 1 year, or a day overflow), or a family
the loader could not read (its folder left the org), is THAT family's "can't be decided" — never an
exception that stops the org's sweep, Preview, queue and policy list (a member could otherwise
stop retention for the whole org by setting one metadata date). The loader half is driven live in
``tests/integration/test_275_review_hardening.py``.
"""
from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.services.retention.evaluate import EvalContext, FamilyFacts, PolicyFacts, Stage, evaluate

NOW = datetime(2026, 10, 12, tzinfo=timezone.utc)


def _policy(value: int, unit: str) -> PolicyFacts:
    return PolicyFacts(
        id="p1", name="Forever-ish", scope_kind="folder", folder_id="f1", include_subfolders=True,
        document_type_norm=None, clock="document_date", stage1=Stage(value, unit, "archive"), stage2=None,
        revision=1, previewed_revision=1,
    )


def _family(d: date) -> FamilyFacts:
    return FamilyFacts(
        family_key="u/f1/a.md", latest_id="d1", row_ids=("d1",), file_paths=("u/d1.md",), org_id="o1",
        folder_id="f1", document_type_norm=None, date_typed=d, created_at=NOW, archived_at=None,
        org_visible=True, name="a.md",
    )


@pytest.mark.parametrize("d, value, unit", [
    (date(9999, 6, 1), 1, "years"),      # _add_months → year 10000 → ValueError
    (date(9999, 12, 30), 5, "days"),     # date + timedelta → OverflowError
    (date(9999, 12, 1), 3, "months"),
])
def test_wr01_an_unusable_date_is_that_documents_no_date_never_an_exception(d, value, unit):
    ctx = EvalContext(folder_parent={"f1": None}, folder_policies={"f1": _policy(value, unit)}, class_policies={})
    decision = evaluate(_family(d), ctx, NOW)
    assert decision.kind == "no_date", decision
    assert decision.why == "the date can't be used"
    assert decision.policy_ids == ("p1",), "the undecidable row must still be attributed to its policy"


def test_wr01_a_normal_date_still_decides():
    ctx = EvalContext(folder_parent={"f1": None}, folder_policies={"f1": _policy(1, "years")}, class_policies={})
    assert evaluate(_family(date(2020, 1, 1)), ctx, NOW).kind == "archive"


def test_wr01_a_document_whose_folder_left_the_org_is_undecidable():
    ctx = EvalContext(folder_parent={"f1": None}, folder_policies={"f1": _policy(1, "days")}, class_policies={})
    fam = _family(date(2020, 1, 1))
    fam = FamilyFacts(**{**fam.__dict__, "unreadable": "its folder is outside the organization"})
    d = evaluate(fam, ctx, NOW)
    assert d.kind == "not_previewed" and d.why == "its folder is outside the organization"
