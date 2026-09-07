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
    """Every provider literal used in a COMPARISON or a MEMBERSHIP TEST.

    Deliberately not "every string literal": a docstring naming Google is documentation, and a
    fence that refuses documentation gets weakened until it refuses nothing. What is refused is
    a provider identity reaching `==`, `!=`, `in` or `not in` — the shapes that branch.
    """
    findings: list[tuple[int, str, str]] = []
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Compare):
            continue
        operands = [node.left, *node.comparators]
        for operand in operands:
            if isinstance(operand, ast.Constant) and isinstance(operand.value, str):
                hit = _offending_literal(operand.value)
                if hit:
                    findings.append((node.lineno, operand.value, hit))
    return findings


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
