"""306-REVIEW CR-02 (D-07 / GUARD-03) — ``get_workflow_run``'s ``end_reason`` leaves MCP through the
outbound guard and defanging like every other text field.

``end_reason`` comes from a failed phase's ``_failure_reason`` (often an LLM-written validator or
judge reason about the document content), so it can carry personal data and markup.

* ``RunRead.end_reason`` is typed ``RedactableText`` — the guard walks by annotation only, so the
  annotation IS the control;
* switch ON -> an email in it is masked, the run id and link are untouched;
* switch OFF -> the same model object comes back;
* ``run_tools._shape`` defangs it in BOTH the failed arm and the stopped arm, and keeps ``None``.
"""
from __future__ import annotations

import pytest

from app.mcp import results as R
from app.mcp import run_tools
from app.services.key_run_read import InboundRunRead
from app.services.outbound_guard import guard, redactable_fields

ORG = "44444444-4444-4444-8444-444444444444"
RUN = "55555555-5555-4555-8555-555555555555"
LINK = f"https://app.example/app/runs/{RUN}"
EMAIL = "jane.doe@example.com"


async def _on(_org):
    return True


async def _off(_org):
    return False


def test_end_reason_is_annotated_redactable():
    # Read through the guard's OWN walk: the marker of an Optional field sits one level down, so
    # ``FieldInfo.metadata`` alone is empty for it (305-REVIEW-04 WR-04-02).
    assert "end_reason" in redactable_fields(R.RunRead)


async def test_an_email_in_end_reason_is_masked_when_the_switch_is_on():
    model = R.RunRead(run_id=RUN, status="failed", end_reason=f"Ask {EMAIL} for the file", link=LINK)
    out = await guard(model, org_id=ORG, is_on=_on)
    assert "[email removed]" in out.end_reason
    assert EMAIL not in out.end_reason
    assert out.run_id == RUN and out.link == LINK


async def test_switch_off_returns_the_same_model_object():
    model = R.RunRead(run_id=RUN, status="failed", end_reason=f"Ask {EMAIL} for the file", link=LINK)
    assert await guard(model, org_id=ORG, is_on=_off) is model


@pytest.mark.parametrize("status,expected", [("failed", "failed"), ("cancelled", "stopped")])
def test_shape_defangs_end_reason_in_both_arms(status, expected):
    read = InboundRunRead(run_id=RUN, status=status, end_reason="See ![x](https://evil.example/p.png) now")
    out = run_tools._shape(read, LINK)
    assert out.status == expected
    assert out.end_reason == "See [image: x] now"
    assert "![" not in out.end_reason and "https://evil" not in out.end_reason


def test_shape_keeps_a_missing_end_reason_none():
    out = run_tools._shape(InboundRunRead(run_id=RUN, status="failed"), LINK)
    assert out.end_reason is None
