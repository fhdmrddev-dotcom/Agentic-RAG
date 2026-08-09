"""Phase 190 UAT fix — every harness ctx that can REACH a connector must carry `org_id`.

WHY THIS FILE EXISTS
--------------------
`_exec_external_action` scopes every credential lookup by `getattr(ctx, "org_id", None)` and
fails CLOSED when it is absent (D-14 — an unscoped credential read is the cross-org leak the
whole phase exists to prevent). That guard was correct. But the LIVE-KICKOFF builder never set
the attribute, so the guard was unconditionally closed on the path every ordinary run takes:
a bound connection could never send, on any provider, with any destination.

⚠ Corrected on measurement while writing this file. The RESUME builder
(``harness_engine._build_resume_context``) HAS carried ``org_id`` since Phase 163 (D-05), with
its own fallback fetch. ONLY ``workflow_kickoff.build_harness_run_context`` was missing it. The
first draft of this docstring — and of the fix — claimed "no ctx builder ever set it", and the
Python compiler refuted it as a duplicate-keyword SyntaxError. Two builders, two different
histories; the fence below now pins BOTH so the asymmetry cannot drift back.

Measured 2026-08-10 on the first real Slack UAT. The step recorded

    190 D-14: external_action phase 'act' has a connection bound but the run carries no org
              — recording rather than resolving unscoped

while `workflow_runs.org_id` was populated on all 203 rows (stamped by the migration-106
trigger). The data was right; the context never received it.

**Why nineteen plans of RED-first testing missed it:** every org test in Phase 190 injected a
`SimpleNamespace` ctx that DID carry `org_id`. The tests constructed the shape the shipped path
does not produce — the same class as code-review finding WR-01, which spotted the pattern on
`base_url` and did not generalise it. A test that builds its own subject cannot discover that
the real builder never builds it.

So this file asserts the property over the REAL SOURCE of the real builders, via AST rather
than substring matching — PLANT F in plan 190-14 proved a substring assertion can be satisfied
by a docstring eighteen lines from the code it claims to check.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parents[2] / "app"

# (file, enclosing function, must-carry-org_id)
#
# The third field is the whole point. The two builders that feed a LIVE run must carry the org.
# The publish golden-run builder must NOT — see the asymmetry test below.
CTX_BUILDERS = [
    ("services/workflow_kickoff.py", "build_harness_run_context", True),
    ("services/harness_engine.py", "_build_resume_context", True),
]

PUBLISH_BUILDER = ("services/harness/publish_service.py", None, False)


def _simplenamespace_kwargs(path: Path, func_name: str | None) -> list[set[str]]:
    """Every `SimpleNamespace(...)` keyword set inside `func_name` (or the whole module).

    AST, not text: a keyword name in real code is a `keyword.arg` node. Prose that merely
    mentions `org_id=` in a comment or docstring is invisible here, which is exactly the
    property a source fence needs and the property a `grep` does not have.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))

    scopes: list[ast.AST] = []
    if func_name is None:
        scopes = [tree]
    else:
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
                scopes.append(node)
        if not scopes:
            pytest.fail(f"{path.name}: function {func_name!r} not found — did it move or get renamed?")

    found: list[set[str]] = []
    for scope in scopes:
        for node in ast.walk(scope):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "SimpleNamespace"
            ):
                found.append({kw.arg for kw in node.keywords if kw.arg})
    return found


@pytest.mark.parametrize("rel,func,must_carry", CTX_BUILDERS, ids=[c[1] for c in CTX_BUILDERS])
def test_live_harness_ctx_builders_carry_org_id(rel: str, func: str, must_carry: bool) -> None:
    """A ctx that can reach a connector MUST carry org_id, or every send silently records."""
    path = APP / rel
    kwarg_sets = _simplenamespace_kwargs(path, func)
    assert kwarg_sets, f"{rel}: no SimpleNamespace(...) found inside {func} — the builder moved"

    carrying = [ks for ks in kwarg_sets if "org_id" in ks]
    assert carrying, (
        f"{rel}:{func} builds a harness ctx WITHOUT org_id.\n"
        "`_exec_external_action` reads getattr(ctx, 'org_id', None) and fails CLOSED, so every "
        "bound connector step will record instead of sending — silently, with a green run.\n"
        "This is the exact defect measured on 2026-08-10; do not re-introduce it."
    )


def test_publish_golden_run_ctx_deliberately_withholds_org_id() -> None:
    """The publish validation ctx must NOT carry org_id — the asymmetry is a second fence.

    D-16 already forbids a golden run performing the external action. Withholding the org makes
    a publish-time send impossible for an INDEPENDENT reason: if the is_golden_run gate is ever
    removed, the credential still cannot be scoped. Pinned so a future "consistency" cleanup
    cannot quietly delete a security fence while believing it is tidying.
    """
    rel, _, _ = PUBLISH_BUILDER
    path = APP / rel
    kwarg_sets = _simplenamespace_kwargs(path, None)

    golden = [ks for ks in kwarg_sets if "is_golden_run" in ks]
    assert golden, f"{rel}: no SimpleNamespace carrying is_golden_run — the publish ctx moved"

    for ks in golden:
        assert "org_id" not in ks, (
            f"{rel}: the golden-run ctx now carries org_id.\n"
            "That removes the SECOND fence against a publish-time send (D-16 being the first). "
            "If this is intentional, it must land TOGETHER with an explicit publish-time send "
            "prohibition — not on its own."
        )


def test_the_resolver_still_refuses_an_absent_org() -> None:
    """The guard itself must stay fail-CLOSED — the fix threads the org, it does not relax D-14.

    Reads the real signature: `resolve_connection(connection_id, org_id, *, fetch_row=None)`.
    `org_id` must remain REQUIRED and POSITIONAL with NO default, because an optional org scope
    is the id-only SELECT wearing a disguise — it type-checks, reads scoped, and silently
    defaults to unscoped for every caller that forgets.
    """
    import inspect

    import app.main  # noqa: F401 — D-190-DEF-08: establishes import order, cycle never forms
    from app.services.connector_service import resolve_connection

    params = inspect.signature(resolve_connection).parameters
    assert "org_id" in params, "resolve_connection lost its org_id parameter"
    assert params["org_id"].default is inspect.Parameter.empty, (
        "resolve_connection.org_id gained a DEFAULT. An optional org scope silently resolves "
        "unscoped for every caller that forgets — this is D-14's cross-org leak, re-armed."
    )
