"""Phase 103 (REQ-2 / WFAUTH-02) — NL one-shot generation + single auto-retry.

Wave 0 (Plan 01 Task 1) authors these stubs; **Plan 02** fills them. All cases are
``@pytest.mark.xfail(strict=False)`` until the ``workflow_authoring`` service +
``POST /workflows/generate`` route land in Plan 02, so the Wave-0 suite exits 0.

Target behaviors (Plan 02):
  - test_one_call_on_valid: a first forced_emit that validates -> exactly ONE
    provider call (attempt count == 1); no retry.
  - test_retry_once_on_validation_error: a first None (validate/forcing failure)
    -> EXACTLY one retry (call_count == 2), never a 3rd.
  - test_no_strict_for_authoring: the authoring shot passes the additive
    ``strict`` override so OpenAI/DeepSeek (strict_json_schema:True) do NOT 400 on
    the optional-heavy WorkflowDefinition schema (Pitfall 1).
  - test_honest_fail_on_second_none: a second None -> an honest structured failure,
    NEVER a runnable/partial draft.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; forced_emit mocked.
"""

from __future__ import annotations

import pytest


@pytest.mark.xfail(reason="Plan 02 implements workflow_authoring.generate (one-call path)", strict=False)
@pytest.mark.asyncio
async def test_one_call_on_valid():
    """A first forced_emit that validates -> exactly ONE provider call (no retry)."""
    from app.services import workflow_authoring  # noqa: F401 — Plan 02 creates this

    raise AssertionError("Plan 02 fills: assert forced_emit call_count == 1 on a valid first emit")


@pytest.mark.xfail(reason="Plan 02 implements the single-retry-on-ValidationError path", strict=False)
@pytest.mark.asyncio
async def test_retry_once_on_validation_error():
    """A first None -> EXACTLY one retry (call_count == 2), never a 3rd."""
    from app.services import workflow_authoring  # noqa: F401

    raise AssertionError("Plan 02 fills: assert forced_emit call_count == 2 (one retry), no 3rd")


@pytest.mark.xfail(reason="Plan 02 adds the additive strict override (Pitfall 1)", strict=False)
@pytest.mark.asyncio
async def test_no_strict_for_authoring():
    """The authoring shot forces strict OFF so OpenAI/DeepSeek do not 400 on the
    optional-heavy WorkflowDefinition schema (Pitfall 1 — strict requires every
    property in ``required``)."""
    from app.services import workflow_authoring  # noqa: F401

    raise AssertionError("Plan 02 fills: assert the forced_emit call passes strict=False for authoring")


@pytest.mark.xfail(reason="Plan 02 implements the honest-fail-on-second-None contract", strict=False)
@pytest.mark.asyncio
async def test_honest_fail_on_second_none():
    """A second None -> an honest structured failure, NEVER a runnable/partial draft."""
    from app.services import workflow_authoring  # noqa: F401

    raise AssertionError("Plan 02 fills: assert an honest failure (no partial draft) on the 2nd None")


@pytest.mark.xfail(reason="Plan 02 implements POST /workflows/generate (delegation, never persists)", strict=False)
@pytest.mark.asyncio
async def test_generate_route_delegates_and_does_not_persist():
    """POST /workflows/generate delegates to the service and returns a draft object
    WITHOUT persisting it (persistence is REQ-1's explicit POST /workflows create)."""
    from app.api import workflows as wf_api  # noqa: F401

    raise AssertionError("Plan 02 fills: assert the route delegates + never calls create_workflow_definition")
