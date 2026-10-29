"""Phase 286 (REG-07, plan 286-01) — characterisation pins for the ``workflows.py`` seam.

These pins were written and their fixtures CAPTURED on the UNMOVED tree, one commit before
``backend/app/api/workflows.py`` was split into ``workflow_wire.py`` and
``workflow_authoring_doors.py`` (D-12: pins first). The move is correct only if this file and
its three fixtures are byte-unchanged afterwards (``git diff --numstat`` empty) and every case
here is still green.

What each pin proves (D-07):

  1. **OpenAPI** — the ``/workflows`` sub-document of the app's schema, plus every component
     schema it reaches through ``$ref``, is byte-identical to the base capture. Built with
     ``fastapi.openapi.utils.get_openapi`` over ``app.routes`` DIRECTLY: ``app.openapi`` is
     replaced at ``app/main.py`` by a canvas-aware, memoised callable that reads a DB flag,
     so the cached ``app.openapi()`` is never the thing measured here.
  2. **Route table** — for every route on ``app.api.workflows.router``, IN ORDER: path,
     methods, endpoint name, response_model, status code, route-level dependency callables
     (with the feature/capability strings their closures carry) and the dependant's params.
     Plus the ordered ``/workflows`` slice of ``app.main.app.routes``. Order matters: a
     literal segment declared after ``/{definition_id}`` is shadowed.
  3. **AST identity** — every symbol in the option-B move set is AST-identical to the base
     (``ast.dump`` with the decorator list emptied), found exactly once at module top level
     across the three files. A route handler's decorator is compared separately: either in
     its ``decorator_list`` (base shape) or as ONE module-level registration statement
     ``router.<verb>(...)(<handler>)`` in ``workflows.py`` (moved shape).
  4. **Re-export** — every moved name and every name a test imports from
     ``app.api.workflows`` still resolves there, to the identical object.
  5. **Logger name** — a moved handler still logs as ``app.api.workflows``.

CAPTURE MODE: ``PIN286_CAPTURE=1`` writes the three fixtures instead of asserting. It was run
exactly once, at the phase base recorded in ``286-01-BASE.md``, and must never be run again —
a re-capture after the move would bless whatever the move did.

DELIBERATE RE-BASELINE (Phase 288-04, 2026-10-19): plan 288-02 added ONE optional field,
``auto_answered``, to ``PublishVerdict`` (the "answered automatically during validation" note).
The OpenAPI fixture and the ``PublishVerdict`` body hash were recaptured for that field alone;
the diff was checked to be exactly +5 lines (the one property) and one hash. The route table
fixture is byte-unchanged. A further change to either needs its own written reason here.

DELIBERATE RE-BASELINE (Phase 291-01, 2026-10-22): AUTH-02's describe door added TWO routes —
``POST /workflows/describe/read`` (the stateless file read, registered before the first
``/{definition_id}`` pattern) and ``POST /workflows/{definition_id}/reference`` (beside the
template upload) — and widened two moved handlers: ``upload_workflow_template`` (accepts a
fillable ``.pdf``; an optional ``anchors`` form field binds a server-made Word fillable copy)
and ``get_workflow_template_placeholders`` (one ``.pdf`` branch through the AcroForm oracle).
``_EXPECTED_ROUTES`` was edited by hand to 17 entries, then ``PIN286_CAPTURE=1`` was run once and
each fixture diff was read: ``workflows_routes.json`` +116 / −0 (the two route rows, the two
``app`` slice rows, and ``anchors`` in the template door's ``body_params``);
``workflows_openapi.json`` +397 / −1 (the two new paths, their two ``Body_*`` schemas,
``DescribeReadResponse`` / ``DescribeField`` / ``DescribeUnplaced`` / ``ReferenceAssetRef``, the
``anchors`` property, and the ONE replaced line: the template door's description, which gained
its Phase 291 paragraph); ``workflows_moved_ast.json`` +2 / −2 (the ``body_sha256`` of
``upload_workflow_template`` and of ``get_workflow_template_placeholders``; both decorator
digests unchanged). ``_MOVE_SET`` stays 25: the new handlers are pinned in
``test_291_describe_read_door.py``, not here.

DELIBERATE RE-BASELINE (Phase 291-02, 2026-10-22): the generate body gained the describe
door's files — ``GenerateRequest.form`` (``DescribeFormIn``) and ``GenerateRequest.references``
(``list[DescribeReferenceIn]``, max 5) — and ``generate_workflow`` forwards both verbatim.
``InputFieldSpec`` (reached from the ``/workflows`` sub-document) gained the optional
``origin`` / ``note`` pair. ``PIN286_CAPTURE=1`` was run once and each fixture diff was read:
``workflows_openapi.json`` +167 / −0 (the three new schemas ``DescribeFormFieldIn`` /
``DescribeFormIn`` / ``DescribeReferenceIn``, the two ``GenerateRequest`` properties, and
``InputFieldSpec``'s ``origin`` + ``note``); ``workflows_moved_ast.json`` +2 / −2 (the
``body_sha256`` of ``GenerateRequest`` and of ``generate_workflow``; decorator digests
unchanged); ``workflows_routes.json`` byte-unchanged (the capture rewrote only its line endings,
restored). ``_MOVE_SET`` stays 25; the new request models are pinned in
``test_291_generate_degraded.py``.

DELIBERATE RE-BASELINE (Phase 291-06, 2026-10-23): gap round 1, CR-02. A common fillable PDF
(250 fields, a 195-country dropdown) was dropped from generation without a word, so the body
caps were raised: ``DescribeFormFieldIn.enum_options`` 50 → 500 and ``DescribeFormIn.fields``
200 → 1000 (an aggregate 20,000-option model validator bounds the body and is invisible to
OpenAPI). ``PIN286_CAPTURE=1`` was run once and each fixture diff was read:
``workflows_openapi.json`` +2 / −2 (exactly the two ``maxItems`` values);
``workflows_moved_ast.json`` and ``workflows_routes.json`` showed no numstat (the capture
rewrote only their line endings, restored).

DELIBERATE RE-BASELINE (Phase 296-06, 2026-10-26): three wire-typing rows. 288-IN-01 typed
``PublishVerdict.auto_answered`` as ``list[AutoAnsweredNote]`` (``{phase: str | None, message:
str}``); 291-IN-03 added ``TemplateAssetRef.unplaced_sentences: list[str]`` (default ``[]``) and
``upload_workflow_template`` now fills it from the partial placement. ``PIN286_CAPTURE=1`` was run
and each fixture diff was read: ``workflows_openapi.json`` +35 / −1 (the new ``AutoAnsweredNote``
schema, the ``auto_answered`` items ``$ref`` replacing ``{}``, and the ``unplaced_sentences``
property); ``workflows_moved_ast.json`` +3 / −3 (the ``body_sha256`` of ``PublishVerdict``,
``TemplateAssetRef`` and ``upload_workflow_template``; decorator digests unchanged);
``workflows_routes.json`` showed no numstat (line endings only, restored). A first capture was
discarded because ``AutoAnsweredNote``'s docstring carried plan ids into the public schema
description; the docstring was reworded and the capture run again.

DELIBERATE RE-BASELINE (Phase 299-01, 2026-10-28, D-38): ``POST /workflows`` (``create_draft``) gained
ONE optional query parameter, ``from_definition_id`` — the published workflow a Tweak copies — so a
copy of the caller's own workflow from another of their orgs is refused in words instead of being
stamped with the wrong org. No route was added or removed and no existing parameter changed; the
fence's intent is unchanged. ``PIN286_CAPTURE=1`` was run once and each fixture diff was read:
``workflows_openapi.json`` +28 / −8 (the one ``parameters`` entry; the operation's ``security`` and
``requestBody.required`` keys re-ordered around it, values unchanged); ``workflows_routes.json``
+3 / −1 (``query_params`` of the create row: ``[]`` -> ``["from_definition_id"]``);
``workflows_moved_ast.json`` showed no numstat (``create_draft`` is not a moved handler).
"""

from __future__ import annotations

import ast
import copy
import hashlib
import json
import os
import typing
from pathlib import Path

import pytest

_BACKEND = Path(__file__).resolve().parents[2]
_API = _BACKEND / "app" / "api"
_WORKFLOWS_PY = _API / "workflows.py"
_WIRE_PY = _API / "workflow_wire.py"
_DOORS_PY = _API / "workflow_authoring_doors.py"
_FIXTURES = _BACKEND / "tests" / "fixtures" / "phase286"
_OPENAPI_FIXTURE = _FIXTURES / "workflows_openapi.json"
_ROUTES_FIXTURE = _FIXTURES / "workflows_routes.json"
_AST_FIXTURE = _FIXTURES / "workflows_moved_ast.json"

_CAPTURE = os.environ.get("PIN286_CAPTURE") == "1"

#: The 17 routes ``workflows.router`` declares, as (method, path) — the non-vacuity floor.
#: (15 at 286; Phase 291-01 added ``/describe/read`` and ``/{definition_id}/reference``.)
_EXPECTED_ROUTES = (
    ("GET", "/workflows/published"),
    ("GET", "/workflows/starters"),
    ("POST", "/workflows/validate"),
    ("GET", "/workflows/grounding-bundle"),
    ("POST", "/workflows/describe/read"),
    ("POST", "/workflows/{definition_id}/publish"),
    ("POST", "/workflows"),
    ("GET", "/workflows/drafts"),
    ("PATCH", "/workflows/{definition_id}"),
    ("DELETE", "/workflows/{definition_id}"),
    ("GET", "/workflows/{definition_id}/delete-preview"),
    ("DELETE", "/workflows/{definition_id}/cascade"),
    ("POST", "/workflows/generate"),
    ("POST", "/workflows/template/placeholders"),
    ("POST", "/workflows/{definition_id}/template"),
    ("POST", "/workflows/{definition_id}/reference"),
    ("GET", "/workflows/{definition_id}/template/placeholders"),
)

#: The option-B move set (operator decision, 286-01-BASE.md). 20 wire symbols + 5 door symbols.
_MOVE_SET = (
    # -> workflow_wire.py
    "_coerce_definition",
    "_caller_uuid",
    "_iso_or_none",
    "DraftCreateResponse",
    "Verdict",
    "ValidateResponse",
    "PaletteFolder",
    "PaletteSkill",
    "GroundingBundleResponse",
    "PublishRequest",
    "BlockedStep",
    "PublishVerdict",
    "_coerce_user_id",
    "_ALREADY_PUBLISHED_DETAIL",
    "DeletePreview",
    "_owned_slug_or_404",
    "_TEMPLATE_MIME_BY_EXT",
    "TemplateAssetRef",
    "TemplatePlaceholdersResponse",
    "_TEMPLATE_MAX_UNCOMPRESSED_BYTES",
    # -> workflow_authoring_doors.py
    "GenerateRequest",
    "generate_workflow",
    "read_template_placeholders",
    "upload_workflow_template",
    "get_workflow_template_placeholders",
)

#: The moved ROUTE HANDLERS — their decorators are compared separately, and their logger name
#: is pinned.
_MOVED_HANDLERS = (
    "generate_workflow",
    "read_template_placeholders",
    "upload_workflow_template",
    "get_workflow_template_placeholders",
)

#: Names tests import or read off ``app.api.workflows`` (the plan's interfaces list).
_TEST_IMPORTED_NAMES = (
    "get_published_workflows",
    "get_starter_workflows",
    "list_drafts",
    "DraftRow",
    "PublishedWorkflow",
    "_TEMPLATE_MAX_UNCOMPRESSED_BYTES",
    "router",
    "GroundingBundleResponse",
    "GenerateRequest",
    "_caller_uuid",
    "PublishRequest",
    "_ALREADY_PUBLISHED_DETAIL",
    "read_template_placeholders",
    "upload_workflow_template",
    "get_workflow_template_placeholders",
    "get_current_user",
    "get_supabase",
    "publish_service",
)


def _normalised(text: str) -> str:
    return text.replace("\r\n", "\n")


def _dump(obj) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=False) + "\n"


def _write_fixture(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_dump(obj), encoding="utf-8", newline="\n")


def _read_fixture(path: Path):
    assert path.exists(), f"missing fixture {path} — it is captured once, at the phase base"
    return json.loads(_normalised(path.read_text(encoding="utf-8")))


# ══ 1. OpenAPI ═════════════════════════════════════════════════════════════════════════════


def _collect_refs(node, out: set[str]) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            out.add(ref.rsplit("/", 1)[-1])
        for value in node.values():
            _collect_refs(value, out)
    elif isinstance(node, list):
        for value in node:
            _collect_refs(value, out)


def _openapi_subdocument() -> dict:
    from fastapi.openapi.utils import get_openapi

    from app.main import app

    doc = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        routes=app.routes,
    )
    paths = {p: v for p, v in doc["paths"].items() if p.startswith("/workflows")}
    schemas = doc.get("components", {}).get("schemas", {})

    # Transitive $ref closure over components.schemas.
    needed: set[str] = set()
    _collect_refs(paths, needed)
    frontier = set(needed)
    while frontier:
        found: set[str] = set()
        for name in frontier:
            _collect_refs(schemas.get(name, {}), found)
        frontier = found - needed
        needed |= frontier

    closure = {name: schemas[name] for name in schemas if name in needed}
    return {"paths": paths, "components": {"schemas": closure}}


def test_openapi_workflows_subdocument_is_byte_identical_to_base():
    sub = _openapi_subdocument()

    # NON-VACUITY: at least the 15 router paths, each one present.
    assert len(sub["paths"]) >= 13, sorted(sub["paths"])  # 15 routes share 13 distinct paths
    for method, path in _EXPECTED_ROUTES:
        assert path in sub["paths"], path
        assert method.lower() in sub["paths"][path], (method, path)
    assert sub["components"]["schemas"], "the $ref closure is empty — the walk is blind"

    if _CAPTURE:
        _write_fixture(_OPENAPI_FIXTURE, sub)
        return

    expected = _normalised(_OPENAPI_FIXTURE.read_text(encoding="utf-8"))
    assert _dump(sub) == expected, (
        "the /workflows OpenAPI sub-document changed — a route, response shape, schema name, "
        "operation id or description moved. Diff it against "
        "backend/tests/fixtures/phase286/workflows_openapi.json"
    )


# ══ 2. Route table ═════════════════════════════════════════════════════════════════════════


def _type_name(t) -> str | None:
    if t is None:
        return None
    origin = typing.get_origin(t)
    if origin is not None:
        args = ", ".join(_type_name(a) or "None" for a in typing.get_args(t))
        return f"{getattr(origin, '__name__', repr(origin))}[{args}]"
    return getattr(t, "__qualname__", repr(t))


def _closure_strings(fn) -> list[str]:
    cells = getattr(fn, "__closure__", None) or ()
    out: list[str] = []
    for cell in cells:
        try:
            value = cell.cell_contents
        except ValueError:  # empty cell
            continue
        if isinstance(value, str):
            out.append(value)
    return sorted(out)


def _callable_id(fn) -> dict:
    return {
        "qualname": getattr(fn, "__qualname__", repr(fn)),
        "closure_strings": _closure_strings(fn),
    }


def _route_table() -> dict:
    from fastapi.routing import APIRoute

    from app.api import workflows as wf
    from app.main import app

    rows = []
    for route in wf.router.routes:
        assert isinstance(route, APIRoute), route
        dependant = route.dependant
        rows.append(
            {
                "path": route.path,
                "methods": sorted(route.methods),
                "name": route.name,
                "endpoint": route.endpoint.__name__,
                "response_model": _type_name(route.response_model),
                "status_code": route.status_code,
                "route_dependencies": [_callable_id(d.dependency) for d in route.dependencies],
                "query_params": [p.name for p in dependant.query_params],
                "path_params": [p.name for p in dependant.path_params],
                "header_params": [p.name for p in dependant.header_params],
                "body_params": [p.name for p in dependant.body_params],
                "sub_dependencies": [_callable_id(d.call) for d in dependant.dependencies],
            }
        )

    app_slice = [
        {"path": r.path, "methods": sorted(getattr(r, "methods", None) or [])}
        for r in app.routes
        if getattr(r, "path", "").startswith("/workflows")
    ]
    return {"router": rows, "app": app_slice}


def test_route_table_is_identical_to_base_in_order():
    table = _route_table()

    # NON-VACUITY: exactly the 15 routes, in declaration order.
    assert [(r["methods"][0], r["path"]) for r in table["router"]] == list(_EXPECTED_ROUTES)
    assert len(table["app"]) >= 15

    if _CAPTURE:
        _write_fixture(_ROUTES_FIXTURE, table)
        return

    assert table == _read_fixture(_ROUTES_FIXTURE), (
        "the /workflows route table changed — order, methods, dependencies, response_model, "
        "status code or params. Diff against backend/tests/fixtures/phase286/workflows_routes.json"
    )


# ══ 3. AST identity ════════════════════════════════════════════════════════════════════════


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _defined_name(node: ast.stmt) -> str | None:
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        return node.name
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        return node.target.id
    return None


def _kind(node: ast.stmt) -> str:
    return {
        ast.FunctionDef: "function",
        ast.AsyncFunctionDef: "async_function",
        ast.ClassDef: "class",
        ast.Assign: "assign",
        ast.AnnAssign: "annassign",
    }[type(node)]


def _body_digest(node: ast.stmt) -> str:
    clone = copy.deepcopy(node)
    if hasattr(clone, "decorator_list"):
        clone.decorator_list = []
    return _sha(ast.dump(clone, include_attributes=False))


def _parsed_modules() -> dict[str, ast.Module]:
    out = {}
    for path in (_WORKFLOWS_PY, _WIRE_PY, _DOORS_PY):
        if path.exists():
            out[path.name] = ast.parse(path.read_text(encoding="utf-8"))
    return out


def _registration_decorator(tree: ast.Module, handler: str) -> list[ast.expr]:
    """Module-level ``router.<verb>(...)(<handler>)`` statements naming ``handler``."""
    hits: list[ast.expr] = []
    for stmt in tree.body:
        if not isinstance(stmt, ast.Expr) or not isinstance(stmt.value, ast.Call):
            continue
        outer = stmt.value
        if (
            isinstance(outer.func, ast.Call)
            and isinstance(outer.func.func, ast.Attribute)
            and isinstance(outer.func.func.value, ast.Name)
            and outer.func.func.value.id == "router"
            and len(outer.args) == 1
            and not outer.keywords
            and isinstance(outer.args[0], ast.Name)
            and outer.args[0].id == handler
        ):
            hits.append(outer.func)
    return hits


def _ast_identity_table() -> dict:
    modules = _parsed_modules()
    table = {}
    for name in _MOVE_SET:
        defs = [
            (fname, node)
            for fname, tree in modules.items()
            for node in tree.body
            if _defined_name(node) == name
        ]
        assert len(defs) == 1, f"{name}: defined {len(defs)} times at top level across {list(modules)}"
        fname, node = defs[0]

        decorator_digest = None
        if name in _MOVED_HANDLERS:
            in_place = list(getattr(node, "decorator_list", []))
            registrations = _registration_decorator(modules["workflows.py"], name)
            if in_place:
                assert not registrations, f"{name}: decorated AND registered — it would register twice"
                assert len(in_place) == 1, f"{name}: {len(in_place)} decorators"
                decorator = in_place[0]
            else:
                assert len(registrations) == 1, (
                    f"{name}: expected exactly one router.<verb>(...)({name}) registration in "
                    f"workflows.py, found {len(registrations)}"
                )
                decorator = registrations[0]
            decorator_digest = _sha(ast.dump(decorator, include_attributes=False))
        else:
            assert not getattr(node, "decorator_list", []), f"{name}: unexpected decorator"

        table[name] = {
            "kind": _kind(node),
            "body_sha256": _body_digest(node),
            "decorator_sha256": decorator_digest,
        }
    return table


def test_moved_symbols_are_ast_identical_to_base():
    table = _ast_identity_table()

    # NON-VACUITY: the whole option-B set, every handler with a decorator digest.
    assert len(table) == len(_MOVE_SET) == 25
    for handler in _MOVED_HANDLERS:
        assert table[handler]["decorator_sha256"], handler

    if _CAPTURE:
        _write_fixture(_AST_FIXTURE, table)
        return

    expected = _read_fixture(_AST_FIXTURE)
    assert len(expected) == 25
    mismatched = {
        name: {"base": expected.get(name), "now": table[name]}
        for name in _MOVE_SET
        if table[name] != expected.get(name)
    }
    assert not mismatched, f"moved symbols are no longer AST-identical to base: {mismatched}"


def test_the_ast_digest_can_actually_fire():
    """POSITIVE CONTROL — one changed constant must change the digest, or the pin is blind."""
    tree = ast.parse(_WORKFLOWS_PY.read_text(encoding="utf-8"))
    node = next(n for n in tree.body if _defined_name(n) == "router")
    mutated = copy.deepcopy(node)
    for sub in ast.walk(mutated):
        if isinstance(sub, ast.Constant) and sub.value == "/workflows":
            sub.value = "/workflowz"
            break
    else:  # pragma: no cover
        raise AssertionError("control could not find the constant to mutate")
    assert _body_digest(node) != _body_digest(mutated)
    # …and a deep copy with NO change digests identically, so equality is not accidental.
    assert _body_digest(node) == _body_digest(copy.deepcopy(node))


# ══ 4. Re-export ═══════════════════════════════════════════════════════════════════════════


def test_every_moved_and_test_imported_name_still_resolves_from_workflows():
    import importlib

    from app.api import workflows as wf

    for name in (*_MOVE_SET, *_TEST_IMPORTED_NAMES):
        assert hasattr(wf, name), f"app.api.workflows.{name} no longer resolves"

    modules = _parsed_modules()
    for name in _MOVE_SET:
        home_file = next(
            fname for fname, tree in modules.items() for node in tree.body if _defined_name(node) == name
        )
        home = importlib.import_module(f"app.api.{home_file[:-3]}")
        assert getattr(wf, name) is getattr(home, name), (
            f"app.api.workflows.{name} is not the same object as its home {home.__name__}.{name}"
        )


# ══ 5. Logger name ═════════════════════════════════════════════════════════════════════════


def test_moved_handlers_still_log_as_app_api_workflows():
    from app.api import workflows as wf

    for handler in _MOVED_HANDLERS:
        fn = getattr(wf, handler)
        logger = fn.__globals__.get("logger")
        assert logger is not None, f"{handler}: no module logger"
        assert logger.name == "app.api.workflows", (
            f"{handler} logs as {logger.name!r}; caplog filters and log search key on "
            "'app.api.workflows', so a renamed logger is a behaviour change"
        )
