"""Phase 232 (SRC-01) / Phase 238 (D-238-10) — the source-contract architectural fence.

⚠ **THE FENCE SHIPPED IN PHASE 232 COULD NOT HAVE CAUGHT THE LEAK THAT WAS ALREADY THERE, AND
THAT IS WHY THIS FILE WAS REWRITTEN RATHER THAN EXTENDED.** The original refused the literals
`onedrive | sharepoint | dropbox | box` inside `sources/base.py` and **explicitly permitted
`google`** — while `SourceRegistry._ensure_registered` branched on `"google" in service_id`
three lines away in that same file, and `watch_service` fell back to the Drive adapter for any
connection it could not resolve. So the guard would have flagged the *second* vendor to leak
while the *first* sat inside the module the guard was written to protect.

A deny-list of vendor names is the wrong shape for this rule. The rule is *no provider identity
decides control flow above `adapters/`*, so this file asserts that directly: **any** provider
literal in a comparison or a membership test, in any of the source-path modules, fails — and
the exceptions are an explicit, reasoned allow-list rather than an omission.

⭐ **This fence was DRIVEN RED before it was trusted.** A planted `if "google" in service_id`
in `sources/base.py` made it fail by name, and the file was restored byte-identically. A guard
nobody has seen fire is not a guard (Phase 235's lesson; Phase 236 SC#2's requirement).
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[4]

#: Every module that handles a source ABOVE the adapter package. A module missing from here is
#: unfenced, so the list is the thing to grow when a source-path module is added.
FENCED_MODULES = (
    "app/services/sources/base.py",
    "app/services/sources/preview_service.py",
    "app/services/sources/import_service.py",
    "app/services/watch_service.py",
)

#: Provider identities. Lower-cased; matched as whole strings and as substrings of a compared
#: literal, because `"google" in service_id` is the exact shape that leaked.
PROVIDER_LITERALS = (
    "google",
    "google_workspace",
    "workspace",
    "gdrive",
    "microsoft",
    "microsoft_graph",
    "onedrive",
    "sharepoint",
    "dropbox",
    "box",
    "googleapis.com",
    "graph.microsoft.com",
)

#: ⚠ THE EXEMPTIONS, NAMED AND REASONED — never an omission.
#:
#: `application/vnd.google-apps.*` are MIME TYPE constants, not provider routing. Deleting them
#: would break Docs/Sheets export, and widening the rule to "anything containing google" would
#: have deleted them. They are exempt because a MIME type identifies a FILE FORMAT; the rule is
#: about identity deciding which code path runs.
#:
#: `drive` is exempt as a bare token because it is a `SourceNode.kind` value ("folder" | "drive")
#: in the shared contract — a shape word, not a vendor.
ALLOWED_LITERAL_SUBSTRINGS = (
    "application/vnd.google-apps",
)
ALLOWED_EXACT_LITERALS = ("drive",)


#: ⛔ TOOL NAMES — Phase 239's load-bearing claim, which was enforced by NOTHING until the
#: gap-closure round (review ME-05). `mcp_source.py:19` states *"nothing anywhere else in the
#: codebase knows any tool name"*; `connector_service.py` held
#: `("list_directory", "list_dir", "list_files", "ls", "browse")` in a membership test the
#: whole time, and this file structurally could not see it — `connector_service.py` was not in
#: `FENCED_MODULES`, and `PROVIDER_LITERALS` contains no tool name, so BOTH doors were shut.
#:
#: The vocabulary now lives in `sources/adapters/mcp_source.py` and this set is what keeps it
#: there. Matched as substrings, like the provider set, because `"read_file_v2"` is the same
#: leak wearing a suffix.
TOOL_LITERAL_SUBSTRINGS = (
    "list_directory",
    "list_dir",
    "list_files",
    "read_file",
    "get_file_contents",
    "view_file",
)

#: ⚠ Bare words that are tool names ONLY when they are the WHOLE literal. `"read"` and
#: `"browse"` are deliberately ABSENT rather than forgotten: they are ordinary English that
#: appears in scopes, verbs and modes across these modules, and a fence with false positives
#: is a fence that gets deleted. `ls` and `cat` are safe because nothing else spells them.
TOOL_LITERAL_EXACT = ("ls", "cat")

#: Every module that must not know a tool name — the source path above `adapters/`, PLUS the
#: three that actually handle an MCP binding. `connector_service.py` is here because it is
#: where the leak was; `models/connector.py` and `api/connectors.py` are here because they are
#: the write boundary and the router for the same column, and an absent module is an
#: unfenced one (the failure this whole file exists to make impossible).
TOOL_FENCED_MODULES = FENCED_MODULES + (
    "app/services/connector_service.py",
    "app/models/connector.py",
    "app/api/connectors.py",
)

#: Method calls whose FIRST ARGUMENT decides something. ⚠ ME-06: the fence used to see
#: `ast.Compare` and nothing else, so `service_id.startswith("google")`, `ADAPTERS["google"]`
#: and `match service_id: case "google":` all passed it silently — while the sibling hint
#: fence in the same phase (`test_239_mcp_source_adapter._hint_comparisons`) already handled
#: `Subscript` and `.get(...)`. The stronger shape existed in the same diff and was not applied
#: here, which is why this one is written from that shape rather than beside it.
_DECIDING_METHODS = ("get", "startswith", "endswith", "removeprefix", "removesuffix")


def _deciding_operands(node: ast.AST) -> list[ast.expr]:
    """Every expression this node uses to DECIDE something.

    Deliberately not "every string literal": a docstring naming Google is documentation, and a
    fence that refuses documentation gets weakened until it refuses nothing.
    """
    if isinstance(node, ast.Compare):
        return [node.left, *node.comparators]
    if isinstance(node, ast.Subscript):
        return [node.slice]
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in _DECIDING_METHODS
    ):
        return list(node.args[:1])
    if isinstance(node, ast.MatchValue):
        return [node.value]
    return []


def _flatten(operands: list[ast.expr]) -> list[ast.expr]:
    """Expand container literals, because `x in ("a", "b")` is ONE operand and TWO identities.

    ⚠ THIS ARM WAS FOUND BY THIS FILE'S OWN POSITIVE CONTROL, which is the entire argument for
    writing one. The widened walker was already an improvement on `ast.Compare`-only — and it
    still returned `[]` for `if name in ("list_directory", "ls")`, because the comparator of an
    `in` test against a tuple is an `ast.Tuple`, not an `ast.Constant`. That is not an exotic
    shape: it is the single most idiomatic way in Python to write the membership test both of
    these fences exist to refuse, and BOTH fences were blind to it for the whole of Phase 232,
    238 and 239. A control that only confirms what you already believe is decoration.
    """
    out: list[ast.expr] = []
    for operand in operands:
        if isinstance(operand, (ast.Tuple, ast.List, ast.Set)):
            out.extend(operand.elts)
        else:
            out.append(operand)
    return out


def _literals_in_decisions(
    source: str,
    *,
    substrings: tuple[str, ...],
    exact: tuple[str, ...] = (),
    allowed_substrings: tuple[str, ...] = (),
    allowed_exact: tuple[str, ...] = (),
) -> list[tuple[int, str, str]]:
    """`(lineno, the literal, what it matched)` for every identity reaching a decision."""

    def _offending(value: str) -> str | None:
        low = value.strip().lower()
        if not low:
            return None
        if any(allowed in low for allowed in allowed_substrings):
            return None
        if low in allowed_exact:
            return None
        if low in exact:
            return low
        for literal in substrings:
            if low == literal or literal in low:
                return literal
        return None

    findings: list[tuple[int, str, str]] = []
    for node in ast.walk(ast.parse(source)):
        for operand in _flatten(_deciding_operands(node)):
            if isinstance(operand, ast.Constant) and isinstance(operand.value, str):
                hit = _offending(operand.value)
                if hit:
                    findings.append((getattr(node, "lineno", 0), operand.value, hit))
    return findings


def _offending_literal(value: str) -> str | None:
    """Return the provider literal `value` carries, or None."""
    low = value.strip().lower()
    if not low:
        return None
    if any(allowed in low for allowed in ALLOWED_LITERAL_SUBSTRINGS):
        return None
    if low in ALLOWED_EXACT_LITERALS:
        return None
    for provider in PROVIDER_LITERALS:
        if low == provider or provider in low:
            return provider
    return None


def _scan(source: str) -> list[tuple[int, str, str]]:
    """Every provider literal that DECIDES something — see `_deciding_operands` for which
    shapes count, and ME-06 for the three that used to be invisible."""
    return _literals_in_decisions(
        source,
        substrings=PROVIDER_LITERALS,
        allowed_substrings=ALLOWED_LITERAL_SUBSTRINGS,
        allowed_exact=ALLOWED_EXACT_LITERALS,
    )


def _scan_tool_names(source: str) -> list[tuple[int, str, str]]:
    """Every MCP tool name that DECIDES something, anywhere above `adapters/`."""
    return _literals_in_decisions(
        source, substrings=TOOL_LITERAL_SUBSTRINGS, exact=TOOL_LITERAL_EXACT
    )


@pytest.mark.parametrize("relative", FENCED_MODULES)
def test_no_provider_identity_branches_above_the_adapter_package(relative: str):
    """The contract's own claim, asserted: a source family is DATA and registration."""
    path = BACKEND / relative
    assert path.exists(), f"{relative} is in FENCED_MODULES but does not exist"

    findings = _scan(path.read_text(encoding="utf-8"))
    assert not findings, (
        f"{relative} branches on a provider identity above services/sources/adapters/:\n"
        + "\n".join(f"  line {ln}: {lit!r} (matches {hit!r})" for ln, lit, hit in findings)
        + "\n\nAdding a source family must be registration, not a branch. Move the decision "
        "into the adapter, or make the routing DATA (a dict keyed by service_id) rather than "
        "control flow."
    )


@pytest.mark.parametrize("relative", TOOL_FENCED_MODULES)
def test_no_MCP_TOOL_NAME_decides_anything_above_the_adapter_package(relative: str):
    """⛔ ME-05 — the phase's load-bearing claim, finally enforced rather than asserted.

    `mcp_source.py`'s docstring says *"nothing anywhere else in the codebase knows any tool
    name"*. That was FALSE the day it was written: `connector_service.py` carried the lister
    and reader tuples in a membership test. Nothing could see it — that module was unfenced
    and this file knew vendor names only. Adding a server is a ROW; the moment a tool name
    reaches a conditional up here, it is a code change, a review and a deploy again."""
    path = BACKEND / relative
    assert path.exists(), f"{relative} is in TOOL_FENCED_MODULES but does not exist"

    findings = _scan_tool_names(path.read_text(encoding="utf-8"))
    assert not findings, (
        f"{relative} decides something using an MCP tool name:\n"
        + "\n".join(f"  line {ln}: {lit!r} (matches {hit!r})" for ln, lit, hit in findings)
        + "\n\nThe vocabulary belongs to services/sources/adapters/mcp_source.py, which is "
        "the file whose docstring claims it. Connecting a new server must stay a ROW."
    )


def test_the_fence_can_actually_fire():
    """⭐ THE POSITIVE CONTROL. Without it, every assertion above is *"we found nothing"*, which
    is indistinguishable from *"we looked for nothing"* — the exact failure the Phase 232 fence
    had, where `google` was an exempted literal and so could never be found."""
    planted = 'def f(service_id):\n    if "google" in service_id:\n        return 1\n'
    findings = _scan(planted)
    assert findings, "the fence cannot detect the leak it exists to detect"
    assert findings[0][2] == "google"

    also = 'x = 1 if provider == "onedrive" else 2\n'
    assert _scan(also), "the fence misses an equality comparison"


def test_the_fence_fires_on_the_THREE_SHAPES_IT_USED_TO_MISS():
    """⭐ ME-06's positive control. Every plant below is a real branch on a vendor identity and
    every one of them passed the `ast.Compare`-only walker in silence — which means the green
    this file printed for four modules was green about one shape out of four."""
    assert _scan('if service_id.startswith("google"):\n    pass\n'), (
        "a .startswith() branch on a vendor is invisible to the fence"
    )
    assert _scan('if service_id.endswith("onedrive"):\n    pass\n')
    assert _scan('ADAPTERS = {}\nx = ADAPTERS["google"]\n'), (
        "a dict keyed by vendor identity is routing, and it is a Subscript, not a Compare"
    )
    assert _scan('cfg = {}\nx = cfg.get("microsoft_graph")\n')
    assert _scan(
        'def f(service_id):\n'
        '    match service_id:\n'
        '        case "onedrive":\n'
        '            return 1\n'
    ), "a match/case on a vendor is the same branch with newer syntax"
    assert _scan('if service_id in ("google", "dropbox"):\n    pass\n'), (
        "⚠ THE SHAPE THIS FILE'S OWN CONTROL CAUGHT. `x in (\"a\", \"b\")` is the most "
        "idiomatic membership test in Python and BOTH fences were blind to it — the "
        "comparator is an ast.Tuple, and only its ELEMENTS are Constants"
    )


def test_the_TOOL_fence_can_actually_fire():
    """⭐ ME-05's positive control, and it is the one that matters: the fence this replaces
    could not have failed on the leak that was actually present."""
    planted = 'def f(name):\n    if name in ("list_directory", "ls"):\n        return 1\n'
    findings = _scan_tool_names(planted)
    assert findings, "the tool fence cannot detect the leak it exists to detect"
    assert {hit for _, _, hit in findings} == {"list_directory", "ls"}

    assert _scan_tool_names('if tool == "read_file": pass\n')
    assert _scan_tool_names('x = TOOLS["get_file_contents"]\n')
    assert _scan_tool_names('if name.startswith("read_file"): pass\n')
    # ⚠ THE EXACT ARM IS EXACT. A capability called `catalog` is not the `cat` tool, and a
    # fence that says it is gets deleted within a week.
    assert _scan_tool_names('if kind == "catalog": pass\n') == []
    assert _scan_tool_names('if verb == "read": pass\n') == [], (
        "`read` is ordinary English in these modules — see TOOL_LITERAL_EXACT for why it is "
        "deliberately absent rather than forgotten"
    )


def test_the_exemptions_are_exemptions_and_not_holes():
    """A MIME constant passes; a service_id that merely contains it does not."""
    assert _scan('MIME = "application/vnd.google-apps.document"\nif m == MIME: pass\n') == []
    assert _scan('if m == "application/vnd.google-apps.folder": pass\n') == []
    assert _scan('if kind == "drive": pass\n') == [], "SourceNode.kind is a shape, not a vendor"
    assert _scan('if service_id == "google_drive": pass\n'), "a vendor id must still be caught"


def test_every_adapter_implements_the_contract():
    """The other half of the boundary: below `adapters/`, everything IS a SourceAdapter."""
    from app.services.sources.adapters.google_drive import GoogleDriveSourceAdapter
    from app.services.sources.adapters.mcp_source import McpSourceAdapter
    from app.services.sources.adapters.microsoft_graph import MicrosoftGraphSourceAdapter
    from app.services.sources.adapters.mock_source import MockSourceAdapter
    from app.services.sources.base import SourceAdapter

    for adapter_cls in (
        MockSourceAdapter,
        GoogleDriveSourceAdapter,
        MicrosoftGraphSourceAdapter,
        # Phase 239. ⭐ The FOURTH family, and the first that is not a single named service —
        # it is a protocol, so one adapter serves every server anyone ever points it at.
        McpSourceAdapter,
    ):
        assert issubclass(adapter_cls, SourceAdapter), adapter_cls


def test_every_registered_adapter_is_covered_by_the_list_above():
    """⚠ THE HALF THAT CANNOT BE FORGOTTEN. The list above is hand-maintained, so an adapter
    added and not listed is silently unasserted — the same gap as a hot file with no ledger row,
    one directory over. This derives the set from the REGISTRY instead of from a reader."""
    import app.services.sources  # noqa: F401 — the eager import IS what populates the registry
    from app.services.sources.base import SourceAdapter, SourceRegistry

    registered = {cls for cls in SourceRegistry._adapters.values()}
    assert registered, "the registry is empty — the eager import list is not running"
    for adapter_cls in registered:
        assert issubclass(adapter_cls, SourceAdapter), adapter_cls


def test_the_fenced_module_list_covers_the_sources_package():
    """A module added to `services/sources/` and forgotten here is silently unfenced — the
    same class of gap as a hot file with no ledger row."""
    package = BACKEND / "app" / "services" / "sources"
    on_disk = {
        f"app/services/sources/{p.name}"
        for p in package.glob("*.py")
        if p.name not in ("__init__.py", "failure_cause.py", "health_verdict.py")
    }
    missing = on_disk - set(FENCED_MODULES)
    assert not missing, (
        f"unfenced modules in services/sources/: {sorted(missing)} — add them to "
        "FENCED_MODULES, or state here why they carry no source routing"
    )
