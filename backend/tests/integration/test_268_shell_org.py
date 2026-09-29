"""268-REVIEW WR-06 — a harness shell row takes its WORKFLOW RUN's org, not the trigger's guess. Real Postgres.

The resume shell (``harness_engine._build_resume_context``) mints a ``runs`` row with no ``org_id``, so
for a two-org user it lands in the mig-106 trigger's ``LIMIT 1`` org — and ``insert_run``'s parent copy
then moves every re-driven sub-agent under it there too, so the harness's spend shows in the other org's
``/admin/spend``. The builder already knows the run's org (it scopes its service-role client by it).

Driven with the REAL builder on the two-org subject from ``test_268_two_org_rows.py``: the run dict
carries org B; the shell row is read back. Everything the builder does after the INSERT is not the
subject, so any later failure is tolerated and the row is what is asserted.

Skip-guarded on local Postgres :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from uuid import uuid4

import pytest

from tests.integration._rls_harness import requires_pg
from tests.integration.test_268_two_org_rows import (  # noqa: F401 — the fixture is used by name
    _Redis,
    two_org_subject,
)

pytestmark = requires_pg


@pytest.mark.asyncio
async def test_the_resume_shell_lands_in_the_workflow_runs_org(pg_pool, two_org_subject):
    from app.services.harness_engine import _build_resume_context

    s = two_org_subject
    assert s["org_a"] != s["org_b"], "the subject must be two-org or this proves nothing"
    run = {
        "run_id": uuid4(),  # a workflow_runs id; the builder reads the org from the dict first
        "thread_id": s["thread_id"],
        "user_id": s["uid"],
        "org_id": s["org_b"],
        "inputs": {},
    }
    try:
        await _build_resume_context(run, _Redis(), pg_pool)
    except Exception:  # noqa: BLE001 — only the shell row is the subject
        pass

    shells = await pg_pool.fetch(
        "SELECT org_id FROM public.runs WHERE thread_id = $1 AND model = 'unknown' AND parent_run_id IS NULL",
        s["thread_id"],
    )
    assert len(shells) == 1, f"expected exactly one resume shell, got {len(shells)}"
    assert shells[0]["org_id"] == s["org_b"], (
        f"the resume shell landed in {shells[0]['org_id']} (the trigger's A = {s['org_a']}), not the "
        "workflow run's B — every sub-agent under it follows it there"
    )
