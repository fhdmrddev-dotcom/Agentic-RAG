"""Phase 182 (VALID-01 / D-182-R2-01, D-182-R2-02) — the canvas off-switch's
NON-DISCOVERABILITY seam.

REVERT-01 / REVERT-02 (operator HARD gate #1) promise that, with
``visual_workflow_canvas`` off, the product is byte-identical to one where the canvas was
never built. ``Depends(require_canvas())`` (dependencies.py) delivers most of that, but two
channels sit structurally OUTSIDE the dependency-injection layer and leaked the gated
routes' existence to an anonymous caller.

**(1) The request path itself.** FastAPI decodes the request body in
``get_request_handler`` BEFORE ``solve_dependencies`` runs, so a MALFORMED body 422'd ahead
of the gate's 404 (``POST /workflows/validate`` carrying ``b"{"`` -> 422 ``json_invalid``).
Starlette's router likewise answers a wrong-method probe with 405 and a trailing-slash probe
with a 307 redirect — both BEFORE any dependency runs. No rewrite of ``require_canvas`` can
fix that; the flag decision has to happen before routing.

**(2) The published schema.** ``GET /openapi.json`` is anonymous and unconditional on every
finalized deploy, and it advertised both canvas paths plus every canvas-only response model.
Schema generation never touches dependency injection at all.

So this ONE module owns BOTH halves of the off-switch's non-discoverability contract:

* ``CanvasGateMiddleware`` — the request-path half. A pure-ASGI middleware that resolves the
  flag before Starlette routing and before any body decode, short-circuiting to the
  byte-identical 404.
* ``build_canvas_aware_openapi`` / ``canvas_filtered_openapi`` — the schema half. A
  request-time hook that, while off, serves a filtered DEEP COPY with the canvas paths and
  exactly their own models removed.

Both halves read the SAME ``CANVAS_GATED_PATHS`` constant, so one edit hides a future canvas
route on both channels.

Design decisions baked in here:

* **Pure ASGI — deliberately NOT built on Starlette's ``BaseHTTP`` middleware base class**
  (mirrors ``MaintenanceMiddleware``, whose module docstring names that base class and its
  hazard in full). The app streams every chat/workflow response over SSE (CLAUDE.md); that
  base class wraps the response body through an anyio memory stream and would sit in front
  of every SSE stream in the app. A plain-class ASGI middleware either short-circuits with a
  plain 404 or passes the scope through **untouched**.
* **Fail-CLOSED on a cold/blip read (D-181-02)** — deliberately the OPPOSITE polarity to
  the ``MaintenanceMiddleware`` analog. See ``_read_canvas_is_off``.
* **``Depends(require_canvas())`` STAYS on both routes** (D-182-05, defense in depth).
  This middleware owns ONLY the master off-switch; caller resolution and the
  operator / everyone / role audience decision stay in the dependency, so a future mount
  under a different prefix still meets the route-level gate.
"""
from __future__ import annotations

import copy
import re
from typing import Any, Callable, Iterable

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# THE ONE source of canvas-gated absolute paths for the whole app — read by BOTH halves
# below (the request-path gate and the schema filter). When Phase 183+ mounts a new canvas
# route, add its absolute path HERE in the SAME commit that mounts it — that single edit is
# what makes the route non-discoverable while off, on both channels.
#
# The members are ABSOLUTE FastAPI path templates and SPAN ROUTERS — they are not relative to
# any one prefix. Two prefixes are represented today: "/workflows" (workflows.py) and
# "/workflow-runs" (workflow_runs.py, Phase 188). This note previously read "(Router prefix
# is /workflows, hence the absolute form.)", which stopped being true the moment the second
# prefix joined; it is corrected here rather than left, because a comment that still names a
# shape the code no longer has is the same defect as a false docblock.
#
# ⚠ THE TWO HALVES CONSUME THIS CONSTANT DIFFERENTLY — know which shape a member is.
# ``canvas_filtered_openapi`` pops these strings from FastAPI's ``paths`` dict, whose keys ARE
# templates, so a parameterised member is used VERBATIM there. ``_is_canvas_path`` (below)
# matches the concrete REQUEST path, so a templated member is compiled to a segment-bounded
# regex first (``_GATED_PATH_PATTERNS``). Both halves read this ONE constant, so the single
# edit remains the contract.
#
# ⚠ CR-04 (Phase 188 review) — this note previously said a templated member "can never match"
# on the request side and that ``Depends(require_canvas())`` was therefore the request-side
# authority for it. That was FALSE as a security claim, and the falseness was measured:
# ``require_canvas`` is a DEPENDENCY, and Starlette answers a wrong-method probe (405) and a
# trailing-slash probe (307) during ROUTING — before ``solve_dependencies`` runs. So with the
# canvas off, ``POST /workflow-runs/<uuid>`` returned **405 {"detail":"Method Not Allowed"}**
# while ``POST /workflow-runs/x/y`` returned 404: the 405 admits a handler is declared at that
# exact path, which is the disclosure this middleware exists to close. The dependency remains
# defense-in-depth (D-182-05); it is not, and never was, able to own these two channels.
CANVAS_GATED_PATHS: frozenset[str] = frozenset(
    {
        "/workflows/validate",
        "/workflows/grounding-bundle",
        # Phase 188 (RUNVIZ-03 / D-188-16) — the run read. TEMPLATE form: OpenAPI-half only
        # (see the asymmetry note above); its request-path 404 comes from require_canvas.
        "/workflow-runs/{workflow_run_id}",
        # SEED-190 — the run LOG (the list). Registered in the SAME commit that mounts it,
        # which is what this constant's header asks for. ⚠ IT IS A BARE PREFIX AND THAT IS
        # NOT A TYPO: the route is `@router.get("")` on a router whose prefix is
        # `/workflow-runs`, so its absolute path has no trailing segment. It carries no
        # `{param}`, so `_compile_gated_pattern` anchors it exactly — it matches
        # `/workflow-runs` and NOT `/workflow-runs/<uuid>`, which the member above already
        # owns. Two members, two shapes, neither shadowing the other.
        "/workflow-runs",
    }
)


def _compile_gated_pattern(template: str) -> re.Pattern[str]:
    """Compile ONE FastAPI path template to a segment-bounded, fully-anchored regex.

    ``{param}`` becomes ``[^/]+`` — bounded to a single segment on purpose, so
    ``/workflow-runs/{workflow_run_id}`` matches ``/workflow-runs/<uuid>`` and does NOT match
    the deliberately-unbuilt two-segment baseline ``/workflow-runs/x/y`` that the byte-identity
    tests compare against. Every literal run is ``re.escape``-d, so a path containing a regex
    metacharacter (``.``, ``+``, ``-`` inside a future member) can never widen the match.
    """
    parts = re.split(r"(\{[^/}]+\})", template)
    body = "".join(
        "[^/]+" if p.startswith("{") and p.endswith("}") else re.escape(p) for p in parts
    )
    return re.compile("^" + body + "$")


# Compiled ONCE at import, and ONLY for the templated members — the literal ones are already
# answered by the frozenset lookup, so the overwhelmingly common request (a path that is not
# gated at all) still costs one set lookup plus one regex match against a single pattern.
_GATED_PATH_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    _compile_gated_pattern(p) for p in sorted(CANVAS_GATED_PATHS) if "{" in p
)

# The schema half's path — FastAPI's default ``openapi_url`` (main.py:593 passes no override).
# Named here only so the middleware knows where to bound the flag's staleness for the SYNC
# ``build_canvas_aware_openapi`` hook, which cannot await for itself (T-184-UAT-02). This is
# NOT a gated path: ``/openapi.json`` still answers 200 in both flag states, filtered.
_SCHEMA_PATH: str = "/openapi.json"


async def _ensure_flag_fresh() -> None:
    """Bound the flag read's staleness before ``_read_canvas_is_off`` consults the cache.

    T-184-UAT-02 (Phase 184 security audit). ``_read_canvas_is_off`` resolves through the
    SYNC settings reader, which performs no staleness check of its own — so on a worker that
    did not service the operator's write, this gate kept enforcing the PRE-FLIP audience with
    no code-level bound. ``ensure_settings_fresh`` is TTL-checked, so this is one comparison
    and no DB I/O on a warm cache, and at most one query per 30s per worker on a cold one.

    Awaited ONLY after ``_is_canvas_path`` has already matched (and for the schema path), so
    the overwhelming majority of requests never reach it — the "no per-request DB call"
    property below is preserved exactly where it was claimed, and the bounded cost is paid
    only on the paths where a stale read has a security consequence.

    NEVER RAISES (``ensure_settings_fresh`` swallows its own failures), so a settings blip
    still lands in ``_read_canvas_is_off``'s fail-closed branch below.
    """
    try:
        from app.models.user_settings import ensure_settings_fresh

        await ensure_settings_fresh()
    except Exception:  # noqa: BLE001 — defensive: never let a refresh blip escape the gate
        pass


def _read_canvas_is_off() -> bool:
    """True when ``visual_workflow_canvas`` is off — the master revert switch.

    Reads the per-worker settings cache through ``feature_audience`` — a pure in-memory read
    (NO DB call, D-v2.5-01), so it never blocks the event loop. Callers on a gated path
    ``await _ensure_flag_fresh()`` FIRST, which is what actually bounds this cache's staleness
    to the 30s TTL; this function itself only reads whatever is there. ``feature_audience``
    is documented never to raise (a cold cache / DB blip / missing key resolves to the
    hardcoded default, which for this key is ``"off"``).

    FAIL-CLOSED (``True`` = gate ON) on ANY read failure — the DELIBERATE OPPOSITE of the
    ``MaintenanceMiddleware`` analog this file otherwise mirrors. Maintenance fails OPEN
    (D-Q4) because a settings blip must never wedge the whole platform read-only; the canvas
    fails CLOSED (D-181-02) because a settings blip must never REVEAL a gated route. Same
    shape, opposite polarity, for opposite reasons.

    ``feature_audience`` is lazy-imported inside the function to avoid the
    user_settings -> middleware import cycle (matches ``require_canvas``'s lazy import).
    """
    try:
        from app.models.user_settings import feature_audience

        return feature_audience("visual_workflow_canvas") == "off"
    except Exception:  # noqa: BLE001 — defensive: any read failure => gated (D-181-02)
        return True


def _is_canvas_path(path: str) -> bool:
    """True if ``path`` is a canvas-gated route, normalizing ONE trailing slash first.

    The normalization closes the trailing-slash escape. Starlette's ``redirect_slashes``
    issues a 307 for ``/workflows/validate/`` ONLY because the slash-stripped path DOES
    match a mounted route — so without normalization the redirect itself (and the 422 that
    follows it) would advertise the route's existence.

    CR-04: the same two escapes (307, and 405 on a wrong-method probe) were open for the
    TEMPLATED member, because this function used to end at the frozenset lookup and a concrete
    request path can never equal ``/workflow-runs/{workflow_run_id}``. The templated members
    are matched through ``_GATED_PATH_PATTERNS`` for exactly that reason. The gate stays
    PATH-ONLY — never method-aware — for the reason stated at the call site.
    """
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    if path in CANVAS_GATED_PATHS:
        return True
    return any(pattern.match(path) for pattern in _GATED_PATH_PATTERNS)


class CanvasGateMiddleware:
    """Pure-ASGI 404 gate for the canvas paths while ``visual_workflow_canvas`` is off."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only guard HTTP requests — websocket / lifespan scopes pass through untouched.
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # T-184-UAT-02 — bound the flag's staleness on THIS worker before either half reads
        # it. Gated on the paths whose answer depends on the flag: the canvas routes (the
        # request-path half below) and the schema document (the `build_canvas_aware_openapi`
        # half, which is SYNC and therefore cannot refresh for itself — this is its only
        # opportunity). Every other request skips it entirely and pays nothing.
        if _is_canvas_path(path) or path == _SCHEMA_PATH:
            await _ensure_flag_fresh()

        # Gate on PATH ONLY — NEVER on method. A path that was never built answers the SAME
        # way for every method, so restricting the gate to POST/GET would leave the
        # wrong-method probe advertising the surface: ``GET /workflows/validate`` returns
        # 405 "Method Not Allowed" today, which admits a POST handler is declared at exactly
        # that path. Path-only matching folds that into the same 404.
        if _is_canvas_path(path) and _read_canvas_is_off():
            # Byte-identity with an unbuilt path IS the contract: exactly the payload
            # ``dependencies._NOT_FOUND`` produces through FastAPI's http_exception_handler
            # and exactly the payload Starlette's unmatched-route 404 produces. No custom
            # message, no extra headers, no WWW-Authenticate.
            response = JSONResponse(status_code=404, content={"detail": "Not Found"})
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


# ══ D-182-R2-02 — the schema half: a flag-aware /openapi.json ═══════════════════════
#
# Gating the request path is only half of non-discoverability: while the canvas was off, an
# anonymous `GET /openapi.json` still published both canvas paths and every model reachable
# only from them, which is a complete map of the surface the 404 is meant to hide. `/docs`
# is just a static Swagger shell that renders whatever this document says, so filtering the
# document is what removes the disclosure.

_REF_PREFIX = "#/components/schemas/"


def _collect_refs(node: Any, into: set[str]) -> None:
    """Record every ``#/components/schemas/<Name>`` referenced anywhere under ``node``."""
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith(_REF_PREFIX):
            into.add(ref[len(_REF_PREFIX) :])
        for value in node.values():
            _collect_refs(value, into)
    elif isinstance(node, list):
        for item in node:
            _collect_refs(item, into)


def _closure(seed: Iterable[str], definitions: dict) -> set[str]:
    """Expand ``seed`` model names to their transitive closure through ``definitions``.

    A model's own definition may reference further models (an envelope naming its per-item
    model, which in turn names an enum), so a one-level scan would leave the nested ones
    published — or, on the kept side, would wrongly conclude a still-referenced model is
    orphaned.
    """
    found: set[str] = set(seed)
    pending = list(found)
    while pending:
        name = pending.pop()
        definition = definitions.get(name)
        if definition is None:
            continue
        nested: set[str] = set()
        _collect_refs(definition, nested)
        for new in nested - found:
            found.add(new)
            pending.append(new)
    return found


def canvas_filtered_openapi(schema: dict) -> dict:
    """Return a DEEP COPY of ``schema`` with the canvas surface removed.

    NEVER mutates its argument — the caller hands it FastAPI's cached full document.

    (a) pop every ``CANVAS_GATED_PATHS`` key from the copy's ``paths``;
    (b) ``removed_refs`` = transitive closure of model names reachable from those popped
        path items;
    (c) ``kept_refs``    = transitive closure of model names reachable from everything that
        REMAINS in the copy (the surviving paths, ``webhooks``, and any other top-level
        content — deliberately NOT the model definitions themselves, which would otherwise
        keep every removed model alive through its own nested references);
    (d) delete the definition of every name in ``removed_refs - kept_refs``.

    Deriving the removal set from the reference graph rather than hardcoding model names is
    deliberate: Phase 183+ adds routes to ``CANVAS_GATED_PATHS`` and their models must
    disappear with them without anyone remembering to update a literal list. Subtracting
    ``kept_refs`` guarantees a model shared with a non-canvas route is never removed, and
    seeding from ``removed_refs`` guarantees a pre-existing orphan definition unrelated to
    the canvas is never touched. Net effect: the filtered document equals what the app would
    publish if the canvas routes had never been declared.
    """
    filtered = copy.deepcopy(schema)

    paths = filtered.get("paths")
    if not isinstance(paths, dict):
        return filtered

    popped = [paths.pop(p) for p in CANVAS_GATED_PATHS if p in paths]
    if not popped:
        return filtered

    definitions = filtered.get("components", {}).get("schemas")
    if not isinstance(definitions, dict):
        return filtered

    seed_removed: set[str] = set()
    _collect_refs(popped, seed_removed)
    removed_refs = _closure(seed_removed, definitions)

    # Everything that SURVIVES the pop. ``components`` is re-added minus its model
    # definitions, so sibling component sections (securitySchemes, parameters, responses)
    # still pin anything they reference.
    surviving: dict = {k: v for k, v in filtered.items() if k != "components"}
    components = filtered.get("components")
    if isinstance(components, dict):
        surviving["components"] = {k: v for k, v in components.items() if k != "schemas"}

    seed_kept: set[str] = set()
    _collect_refs(surviving, seed_kept)
    kept_refs = _closure(seed_kept, definitions)

    for name in removed_refs - kept_refs:
        definitions.pop(name, None)

    return filtered


def build_canvas_aware_openapi(app) -> Callable[[], dict]:
    """Build the zero-arg callable that replaces the app's schema generator (D-182-R2-02).

    While the canvas is ON the app's own full document is returned UNCHANGED; while it is
    off, a filtered deep copy is returned. The flag is read per request through the same
    fail-closed ``_read_canvas_is_off`` the middleware uses, so both halves of the off-switch
    can never disagree.

    **THE CACHE TRAP** — the load-bearing detail of D-182-R2-02. ``FastAPI.openapi()``
    memoizes its result on the app (``applications.py:980``), so a naive hook that computes
    the filtered document once and stores it in that memo serves a STALE document forever:
    it would keep hiding the routes after the flag is flipped ON, or keep publishing them
    after a flip OFF. Therefore the filtered document is (1) computed PER REQUEST, (2) built
    with ``copy.deepcopy`` so the cached full document is never mutated in place, and (3)
    NEVER written back into that memo. ONLY the full document is ever cached — the original
    bound method still generates it exactly once, so generation cost is paid exactly once.
    ``/openapi.json`` is not a hot path, so a per-request deep copy is an acceptable price
    for an answer that tracks the live flag. ``test_182_canvas_gate.py``'s
    off -> on -> off test is the falsifier for exactly this mistake.
    """
    # Captured ONCE at build time — this is the bound method that owns the generation memo.
    original_openapi = app.openapi

    def _canvas_aware_openapi() -> dict:
        full = original_openapi()  # generated on first call, cached by FastAPI thereafter
        if not _read_canvas_is_off():
            return full
        return canvas_filtered_openapi(full)

    return _canvas_aware_openapi
