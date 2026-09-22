"""263-REVIEW.md WR-09 — ``POST /experts`` must not hand its driver's exception to the browser.

WHAT WAS WRONG. The catch-all arm interpolated the raw exception into the response body::

    detail=f"Could not create expert bundle: {exc}"

``exc`` is whatever asyncpg raised, and ``handleResponse`` puts it straight into
``setSaveError``, which the studio's banner renders. A duplicate slug produced::

    UniqueViolationError: duplicate key value violates unique constraint
    "idx_expert_bundles_org_slug" DETAIL: Key (org_id, slug)=(<uuid>, financial-analyzer)
    already exists.

— an internal index name, the column tuple, and ANOTHER ORG-SCOPED IDENTIFIER, in the
browser. The same arm forwards connection strings and SQL fragments on a driver error.

TWO THINGS ARE FIXED, and they are separable on purpose:

 1. The catch-all returns a STABLE string. The detail still reaches the log with
    ``exc_info=True``; it just stops reaching the client.
 2. The one case users actually hit — a slug already taken — gets its OWN arm: a 409 with a
    machine-readable ``error`` key, so the client can say something useful instead of
    rendering a Postgres sentence. This mirrors PACK-16's refusal shape exactly
    (``detail`` is a DICT and the client discriminates on ``detail.error``, never on the
    bare status, because FastAPI's own 422 body is a LIST).

⛔ THE ORDER IS THE CONTRACT. The ``UniqueViolationError`` arm must precede the catch-all,
and BOTH must sit outside the ``HTTPException`` the save refusal raises above them — inside,
a 422 is caught and re-raised as a 400, which is the trap
``test_263_expert_save_refuses_unknown_skills.py`` already pins for the other door.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pytest

from app.api import experts as experts_api

_SRC = Path(inspect.getfile(experts_api)).read_text(encoding="utf-8")


def _handler(name: str) -> ast.AsyncFunctionDef:
    for node in ast.walk(ast.parse(_SRC)):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name:
            return node
    pytest.fail(f"handler {name!r} not found in app/api/experts.py")


def _handlers(node) -> list[ast.ExceptHandler]:
    return [h for h in ast.walk(node) if isinstance(h, ast.ExceptHandler)]


def _detail_sources(handler: ast.ExceptHandler) -> list[str]:
    """Every expression passed as ``detail=`` inside this except arm."""
    out = []
    for call in [n for n in ast.walk(handler) if isinstance(n, ast.Call)]:
        for kw in call.keywords:
            if kw.arg == "detail":
                out.append(ast.unparse(kw.value))
    return out


def test_no_except_arm_interpolates_the_exception_into_detail():
    """The defect itself: an f-string over the bound exception name, in a response body."""
    fn = _handler("create_expert")
    offenders = []
    for h in _handlers(fn):
        bound = h.name
        if not bound:
            continue
        for src in _detail_sources(h):
            if f"{{{bound}}}" in src or f"{{{bound}!r}}" in src:
                offenders.append(src)
    assert not offenders, (
        "WR-09 regression: the driver's exception is being rendered in the browser. "
        f"Got: {offenders}"
    )


def test_the_catch_all_detail_is_a_constant():
    """A literal cannot leak. Anything computed has to justify itself here first."""
    fn = _handler("create_expert")
    broad = [
        h for h in _handlers(fn)
        if h.type is None or (isinstance(h.type, ast.Name) and h.type.id == "Exception")
    ]
    assert broad, "create_expert must still have a catch-all arm — removing it is not the fix"
    for h in broad:
        for src in _detail_sources(h):
            assert src.startswith(("'", '"')), (
                f"the catch-all's detail must be a plain literal, got: {src}"
            )


def test_duplicate_slug_has_its_own_named_arm_before_the_catch_all():
    """⛔ ORDER IS THE CONTRACT — after the catch-all, this arm is unreachable."""
    fn = _handler("create_expert")
    arms = _handlers(fn)
    unique_at = next(
        (i for i, h in enumerate(arms)
         if h.type is not None and "UniqueViolation" in ast.unparse(h.type)),
        None,
    )
    assert unique_at is not None, (
        "WR-09: a taken slug is the one failure users actually hit and it still renders as a "
        "generic 400. Give it a named arm."
    )
    broad_at = next(
        (i for i, h in enumerate(arms)
         if h.type is None or (isinstance(h.type, ast.Name) and h.type.id == "Exception")),
        None,
    )
    assert broad_at is not None and unique_at < broad_at, (
        "the UniqueViolationError arm must come BEFORE the catch-all, or it never runs"
    )


def test_duplicate_slug_arm_answers_409_with_a_discriminable_error_key():
    """Mirrors PACK-16: a DICT detail with an ``error`` key, never a bare status."""
    fn = _handler("create_expert")
    arm = next(
        h for h in _handlers(fn)
        if h.type is not None and "UniqueViolation" in ast.unparse(h.type)
    )
    body = ast.unparse(arm)
    assert "409" in body or "HTTP_409_CONFLICT" in body, body
    assert '"error"' in body or "'error'" in body, (
        "the client discriminates on detail.error — a status alone is not enough, because "
        f"FastAPI's own 422 body is a LIST. Got: {body}"
    )
    assert "expert_slug_taken" in body, body
    # ⛔ And the named arm must not leak either — same rule as the catch-all.
    assert "{exc}" not in body, body
