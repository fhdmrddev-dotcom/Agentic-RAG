"""Phase 278 (SEAM-03, D-05) — the closed tool registry is pinned IDENTICAL across the dispatcher split.

``tool_dispatcher.py`` is split into a registry module and a ``tools/`` family package in 278-03.
This suite is landed FIRST, green at PHASE_BASE, and is meant to stay **byte-for-byte unchanged**
across that move. If any test here has to be edited in the move commit, the move was not pure.

What each test proves:

1. ``test_registry_names_order_and_bindings_match_base`` — the 30 tool names, in the SAME order as
   the dict literal at PHASE_BASE, and each name still binds the object the base literal named
   (``_TOOL_REGISTRY[k] is getattr(tool_dispatcher, <base value name>)``). A swapped handler or a
   re-ordered entry fails here.
2. ``test_registry_is_the_same_static_literal`` — the ONE top-level ``_TOOL_REGISTRY`` binding is
   AST-identical to the base binding and is an ``ast.Dict``. The Extension Contract (D-05): the
   registry is a static literal, never built by mutation, decorator registration, ``{**a, **b}``
   or import-order side effects.
3. ``test_nothing_mutates_the_registry`` — no file under ``backend/app`` subscript-stores into,
   deletes from, calls ``update``/``setdefault``/``pop``/``popitem``/``clear``/``__setitem__`` on,
   augmented-assigns, imports by name, or re-binds ``_TOOL_REGISTRY`` (outside its one literal).
   Non-vacuous: it must walk more than 100 files.
4. ``test_schema_text_is_byte_identical[combo]`` / ``test_render_template_schema_is_byte_identical``
   — the sha256 of the full tool-schema text every provider receives (``get_tools()`` for all 8
   combinations of its three capability flags, plus the harness-only ``RENDER_TEMPLATE_TOOL``) is
   the digest captured at PHASE_BASE. A mismatch means a schema string changed by at least one byte
   (the roadmap failure mode: "a moved handler changes behaviour").

Driven RED before commit (278-01 SUMMARY): swapping the ``"ls"`` / ``"tree"`` registry lines fails
tests 1 and 2; changing one character of one tool description fails the affected hash cases.
"""
from __future__ import annotations

import ast
import hashlib
import importlib
import itertools
import json
import subprocess
import sys
from pathlib import Path

import pytest

PHASE_BASE_SHA = "25b4235c540b1e21a055301ce576d1deb78d5634"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"
APP_DIR = BACKEND_DIR / "app"

_TD_REL = "backend/app/services/tool_dispatcher.py"

_REGISTRY = "_TOOL_REGISTRY"
_MUTATING_METHODS = {"update", "setdefault", "pop", "popitem", "clear", "__setitem__", "__delitem__", "__ior__"}


def _blob_at(sha: str, rel_path: str) -> str:
    """A tracked file's contents at ``sha``."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 / test_272 precedent). `text=True` alone
    # decodes with the locale codec (cp1252 here), and these modules carry `⚠` / `—` in their
    # comments — so the reader thread dies with a `UnicodeDecodeError`, `.stdout` comes back `None`,
    # and the fence fails with an `AttributeError` that looks nothing like the property it pins.
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _read(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def _binds_registry(node: ast.AST) -> bool:
    if isinstance(node, ast.Assign):
        targets = node.targets
    elif isinstance(node, ast.AnnAssign):
        targets = [node.target]
    else:
        return False
    return _REGISTRY in {getattr(t, "id", None) for t in targets}


def _registry_node(src: str) -> ast.Assign | ast.AnnAssign:
    """The ONE top-level binding of ``_TOOL_REGISTRY`` — and it must be a dict literal."""
    hits = [n for n in ast.parse(src).body if _binds_registry(n)]
    assert len(hits) == 1, f"{_REGISTRY} is bound {len(hits)} times at top level (expected exactly 1)"
    assert isinstance(hits[0].value, ast.Dict), (
        f"{_REGISTRY} is no longer a static dict literal (D-05 Extension Contract)"
    )
    return hits[0]


# ── 1. names, order, bindings ────────────────────────────────────────────────────────────────


def test_registry_names_order_and_bindings_match_base():
    base = _registry_node(_blob_at(PHASE_BASE_SHA, _TD_REL)).value
    assert all(isinstance(k, ast.Constant) and isinstance(k.value, str) for k in base.keys)
    assert all(isinstance(v, ast.Name) for v in base.values)
    keys = [k.value for k in base.keys]
    names = [v.id for v in base.values]
    assert len(keys) == 30, f"base literal carries {len(keys)} entries, expected the 30-tool closed core"

    td = importlib.import_module("app.services.tool_dispatcher")
    assert list(td._TOOL_REGISTRY) == keys, "tool names or their ORDER differ from PHASE_BASE"
    for key, name in zip(keys, names):
        assert hasattr(td, name), f"tool_dispatcher no longer binds {name} (registry entry {key!r})"
        assert td._TOOL_REGISTRY[key] is getattr(td, name), (
            f"registry entry {key!r} no longer binds the object named {name} — a handler was swapped"
        )


# ── 2. static literal (D-05) ──────────────────────────────────────────────────────────────────


def test_registry_is_the_same_static_literal():
    head = _registry_node(_read(_TD_REL))
    base = _registry_node(_blob_at(PHASE_BASE_SHA, _TD_REL))
    assert ast.dump(head) == ast.dump(base), (
        f"the {_REGISTRY} literal is not AST-identical to PHASE_BASE {PHASE_BASE_SHA[:9]}"
    )


# ── 3. nothing mutates it ────────────────────────────────────────────────────────────────────


def _names_registry(node: ast.AST) -> bool:
    """``_TOOL_REGISTRY`` or ``<anything>._TOOL_REGISTRY``."""
    return (isinstance(node, ast.Name) and node.id == _REGISTRY) or (
        isinstance(node, ast.Attribute) and node.attr == _REGISTRY
    )


def test_nothing_mutates_the_registry():
    td_path = (REPO_ROOT / _TD_REL).resolve()
    violations: list[str] = []
    files_walked = 0
    for path in sorted(APP_DIR.rglob("*.py")):
        files_walked += 1
        rel = path.relative_to(REPO_ROOT).as_posix()
        # utf-8-sig: at least one app module (email_extraction_service.py) carries a BOM.
        tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
        is_td = path.resolve() == td_path
        for node in ast.walk(tree):
            # subscript store / delete: _TOOL_REGISTRY[k] = v ; del _TOOL_REGISTRY[k]
            if isinstance(node, ast.Subscript) and isinstance(node.ctx, (ast.Store, ast.Del)):
                if _names_registry(node.value):
                    violations.append(f"{rel}:{node.lineno} subscript {type(node.ctx).__name__}")
            # method mutation: _TOOL_REGISTRY.update(...) etc.
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr in _MUTATING_METHODS and _names_registry(node.func.value):
                    violations.append(f"{rel}:{node.lineno} .{node.func.attr}()")
            # augmented assignment: _TOOL_REGISTRY |= {...}
            elif isinstance(node, ast.AugAssign) and _names_registry(node.target):
                violations.append(f"{rel}:{node.lineno} augmented assignment")
            # re-binding: anywhere outside the one top-level literal in tool_dispatcher.py
            elif isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any(_names_registry(t) for t in targets):
                    if not (is_td and node in tree.body):
                        violations.append(f"{rel}:{node.lineno} re-binding")
            # importing it by name gives a second handle that can be mutated out of sight
            elif isinstance(node, ast.ImportFrom):
                if any(a.name == _REGISTRY for a in node.names):
                    violations.append(f"{rel}:{node.lineno} imports {_REGISTRY} by name")
    assert files_walked > 100, f"walked only {files_walked} files under {APP_DIR} — the scan is vacuous"
    assert violations == [], "the closed registry is mutated or re-bound:\n" + "\n".join(violations)
    # The one legitimate binding exists (the scan above would also pass over an empty file).
    _registry_node(_read(_TD_REL))


# ── 4. schema text, byte-identical ──────────────────────────────────────────────────────────

# Captured at PHASE_BASE 25b4235c5 (backend source byte-identical to the planning tree) with
# json.dumps(get_tools(SimpleNamespace(web_search_enabled=w, sandbox_enabled=s,
# self_improve_enabled=i)), ensure_ascii=False) encoded UTF-8. Keyed by (w, s, i).
# ⚠ A mismatch means a tool schema string every provider receives changed by AT LEAST ONE BYTE —
# the roadmap failure mode for a "pure move". Never re-capture to make this green inside 278.
# ⚠ RE-CAPTURED 2026-10-15 (BUG-261015-03), outside 278, deliberately: ask_user's timeout_seconds
# description changed from "Optional. Maximum seconds to wait. Server clamps." to text telling the model
# to pass null. Proven the ONLY byte change: with the old description restored in memory, all 8 combos hashed
# to the 278 digests below. RENDER_TEMPLATE_TOOL is unchanged. The 278 digests, kept for the record:
#   (True, True, True): "48a44e238df3998d52e96e55730b2ef2d1d8af64e0bfe963e2b975c4950bc559",
#   (True, True, False): "9f7525d3d09dbd1f45e086f1c95d8fda7127eb76b229c0e62720841c0b3d75b5",
#   (True, False, True): "627ab0764fb406eec7f69d11d9b5bf99e1fd320ed62e83079fc6b1a88ca8c415",
#   (True, False, False): "09c2ac5006f6b05bd808d0f68ed9584496910736847afa180400e641215494bb",
#   (False, True, True): "0d3b47edfb6bae77939cbc0c3654fb2da6ceb18ab0efa55f83ad958bfda545e6",
#   (False, True, False): "52a324a98a5dc098dca7b02ed35d31d43c4016c9d65120acf6a9fb84eb4e9fb5",
#   (False, False, True): "df266c3b425f6d3825e78b2ce1a91c2f38cdc8a253fcbf1c68b68e0491c6c4fb",
#   (False, False, False): "dbee6dd9ee102b11b48ed1975344b158882e5990059542e67f8dce6db08605d6",
# ⚠ RE-CAPTURED 2026-10-20 (Phase 294-01, D-09), outside 278, deliberately: SEARCH_DOCUMENTS_TOOL gained
# ONE optional plain-string `instruction` property (the steering text for the decision engines). Proven
# the ONLY byte change: with that property popped in memory, all 8 combos hashed to the BUG-261015-03
# digests below. RENDER_TEMPLATE_TOOL is unchanged. The BUG-261015-03 digests, kept for the record:
#   (True, True, True): "c883da9ac213135cbcf7d4f2a23534695e7ff27331a9eea20de9f197e65c12dd",
#   (True, True, False): "9cc26986031aa0f6d981527470ac33960339744dffebf292686dfc94363a0b6b",
#   (True, False, True): "b364e3e0245e4afb2789ed5800e2718681f4fe228cb1dc582e8f97dfbf2b53a9",
#   (True, False, False): "96cca8475333eae0b8bbb6df725fa88626961db7e3bc830caa8b99483f6b474d",
#   (False, True, True): "fd8f7276f1836e5ec5b396bfa4305f2df82e40c4b5cee6bd79abb3732ce229e5",
#   (False, True, False): "9f734c1c0b2abcfe9fbf9de6ffb10087662e904906e726394c839998f1e675a1",
#   (False, False, True): "d7ac152b38d4050751747370dc7a8c0a7a5856bc63d977e1bf14a2993ed795e6",
#   (False, False, False): "39555dbd1ae1e6b339669182a50408cd7c462692d554949a21a649756fe6dd50",
# ⚠ RE-CAPTURED 2026-10-20 (294-REVIEW WR-01), outside 278, deliberately: the `instruction` description no
# longer says it "never filters" (the decision engines fold it into the score prune() cuts on). Proven the
# ONLY byte change: with the old description restored in memory, all 8 combos hashed to the 294-01 digests
# below. RENDER_TEMPLATE_TOOL is unchanged. The 294-01 digests, kept for the record:
#   (True, True, True): "0b18ce999b476843e00bb974b7d8b03b72a4422e429d9d35210bef8511538e70",
#   (True, True, False): "407b8187e2c8cfcc82ea25df3fcc1efed1353bd6fccbde4663a21a2deac1d3ad",
#   (True, False, True): "0524aceb6f74af270eb3874624b6372a9546f980c12906f98440fdc35a4703ec",
#   (True, False, False): "e14d0c8797620845660c00125c311f345a2a76f39f357b5dac81fcfcc2ce29df",
#   (False, True, True): "49abde1228de3f08c2a288e9fae58d4bdccdb20ee67958bdff97404e157fa958",
#   (False, True, False): "84e000e8319a8b2048cb989ba4a91f085b9dcabc7e481e8ab679eb360670d7b4",
#   (False, False, True): "d158c6eb0b2b0ae2dac8faa773ed9fdbe0c858ba46341957187c03e04d641bc6",
#   (False, False, False): "e8ffec20254a3a21addd97a77d673ee86d0b0726551a589fd76c6a1c4cf493ef",
# ⚠ RE-CAPTURED 2026-10-24 (292-01, D-09), outside 278, deliberately: SHOW_ARTIFACT_TOOL gains the
# diagram / comparison / timeline objects, the six-name component enum and the widened description.
# Proven the ONLY byte change: with the base (ba8e38c05) SHOW_ARTIFACT_TOOL restored in memory, all 8
# combos hashed to the 294-REVIEW WR-01 digests below. RENDER_TEMPLATE_TOOL is unchanged. Those digests,
# kept for the record:
#   (True, True, True): "78609984e3fb0cb9d6a86a55463a2ab8b18262639ac3f8bd4e541c6e5b189e28",
#   (True, True, False): "e75061f8d2d08e76778543aff77e7d6195b4c76b604796eb67ec51ff14f9a835",
#   (True, False, True): "8856dd73851edbb8ac9fe457489db779a429a3aa1e404de2ef89d84cd0da485d",
#   (True, False, False): "0a1ad3a456e05ee84fb7dd0f9bfcab261ae01887b26d758638bcc12cdc42a4db",
#   (False, True, True): "2a639a105cd8d1542b03b5d8bf28cdf5d94c747ae17777e2f103eb7c1023a747",
#   (False, True, False): "902f6fc516476bb5793f78f2281deb1eb3cbd61794b221ad389ccf90fe5aea62",
#   (False, False, True): "f5d6a04cb15e8efb2934401eeecb614ec4c594d9f9310523e2d3f2c061e08d1a",
#   (False, False, False): "0c3cfde3c637e4a345192cf76ad0ec20acec3e522e29347c65404ccbf5d73623",
SCHEMA_SHA256: dict = {
    (True, True, True): "8d495767f10eadf10cb933d9ceff3efe66e0cfe04c54502de4e7e84bb0fd43df",
    (True, True, False): "14631717d92d5cb7d8564150f66e711a9ccf169f25fd3ae45bea07e023aa4e24",
    (True, False, True): "44647b34c433a6d7afa0761b844107b28508fc284693a882ab7b965c50d53045",
    (True, False, False): "6b6164ff689a4c799799dccf8df9e4e96c49ac755d04bc8e51e901fefd1774e3",
    (False, True, True): "327542867324d49627cd342ec0901c1481365840e8d75cdbf4eb6b427d9ffd31",
    (False, True, False): "6b67006d3daa66b5b4b82191cc5cd2e85193661575721cd1f4d90a88fa59bb88",
    (False, False, True): "dafdf8bc9723b1160ddbb32b84e865087eb85396b70b95376865588c9a7803d0",
    (False, False, False): "fea12fe8e501847101a413eb67d6884c5aaab22a755203db1b3b172d1b1c6f2d",
    "RENDER_TEMPLATE_TOOL": "aa76bc5f0db6a685ab22e9b1bbfa1d2c628f14e9a2ccee08cfb474f048e13b0f",
}

_COMBOS = list(itertools.product([True, False], repeat=3))

# The digests are computed in a FRESH interpreter, once per session. The schema dicts are module
# globals shared by reference; a test elsewhere in the suite that mutates one in-process would turn
# this pin red for a reason unrelated to the source bytes it exists to pin. `get_tools(None)` is
# never called: it reads the DB-backed self_improve cache.
_DIGEST_PROBE = """
import hashlib, itertools, json, sys
from types import SimpleNamespace
from app.services.openai_service import RENDER_TEMPLATE_TOOL, get_tools
def h(obj):
    return hashlib.sha256(json.dumps(obj, ensure_ascii=False).encode("utf-8")).hexdigest()
out = {}
for w, s, i in itertools.product([True, False], repeat=3):
    tools = get_tools(SimpleNamespace(web_search_enabled=w, sandbox_enabled=s, self_improve_enabled=i))
    out[f"{int(w)}{int(s)}{int(i)}"] = h(tools)
out["RENDER_TEMPLATE_TOOL"] = h(RENDER_TEMPLATE_TOOL)
sys.stdout.write("DIGESTS=" + json.dumps(out) + "\\n")
"""


@pytest.fixture(scope="module")
def schema_digests() -> dict:
    proc = subprocess.run(
        [sys.executable, "-c", _DIGEST_PROBE],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert proc.returncode == 0, f"digest probe failed:\n{proc.stderr}"
    lines = [ln for ln in proc.stdout.splitlines() if ln.startswith("DIGESTS=")]
    assert len(lines) == 1, f"digest probe printed no DIGESTS line:\n{proc.stdout}\n{proc.stderr}"
    return json.loads(lines[0][len("DIGESTS="):])


@pytest.mark.parametrize("combo", _COMBOS, ids=lambda c: "w{}-s{}-i{}".format(*map(int, c)))
def test_schema_text_is_byte_identical(combo, schema_digests):
    key = "".join(str(int(b)) for b in combo)
    assert schema_digests[key] == SCHEMA_SHA256[combo], (
        f"get_tools{combo} schema text differs from PHASE_BASE by at least one byte"
    )


def test_render_template_schema_is_byte_identical(schema_digests):
    assert schema_digests["RENDER_TEMPLATE_TOOL"] == SCHEMA_SHA256["RENDER_TEMPLATE_TOOL"], (
        "RENDER_TEMPLATE_TOOL schema text differs from PHASE_BASE by at least one byte"
    )


def test_every_flag_combo_is_pinned():
    """Non-vacuity: the parametrization covers all 8 combos and each has a captured digest."""
    assert len(_COMBOS) == 8
    assert set(_COMBOS) | {"RENDER_TEMPLATE_TOOL"} == set(SCHEMA_SHA256)
