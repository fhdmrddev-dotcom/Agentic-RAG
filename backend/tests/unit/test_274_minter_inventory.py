"""Phase 274 plan 02 Task 2 (ATT-02 / D-18, backend half) — EVERY `documents` MINTER, PINNED.

ATT-02's named failure is *"met by hiding a button while an API path still writes Library rows from
chat"*. A visual check cannot see that; an inventory can. This file walks `backend/app/**/*.py`
and asserts that the set of modules CALLING the minter (`mint_document_row(`, which also matches
`async_mint_document_row(`) is exactly the six known doors:

| module | door |
|---|---|
| `api/documents.py` | the Library upload |
| `services/sources/import_service.py` | connector import |
| `services/watch_service.py` | watched cloud folders |
| `services/email_attachments.py` | mail attachments |
| `services/expert_install_service.py` | Expert install |
| `api/workspace_promote.py` | Phase 274's explicit Save-to-Library — the ONLY chat-side door |

⛔ `services/ingest_splice.py` is EXCLUDED by name: it is the DEFINING module (`def
mint_document_row(` / its async wrapper's inner call), not a caller.

A seventh caller turns this red. That is deliberate: a new minter is a new way into the Library,
and it must be added here by a decision, never discovered later. The 244 fence that keeps
`api/workspace.py` minter-free is a separate test and stays green beside this one.
"""
from __future__ import annotations

import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2] / "app"

#: The defining module — excluded because it DEFINES the minter rather than calling it.
DEFINING_MODULE = "services/ingest_splice.py"

PINNED_MINTERS = {
    "api/documents.py",
    "services/sources/import_service.py",
    "services/watch_service.py",
    "services/email_attachments.py",
    "services/expert_install_service.py",
    "api/workspace_promote.py",
}


def _strip_comments(src: str) -> str:
    """Prose about code is not code: a docstring explaining WHY a module never mints names the
    minter, and an unstripped scan would count the explanation."""
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out


def _found_minters() -> set[str]:
    found: set[str] = set()
    for path in APP_ROOT.rglob("*.py"):
        rel = path.relative_to(APP_ROOT).as_posix()
        if rel == DEFINING_MODULE:
            continue
        body = _strip_comments(path.read_text(encoding="utf-8"))
        if "mint_document_row(" in body:
            found.add(rel)
    return found


def test_the_set_of_documents_minters_is_exactly_the_six_known_doors():
    """PLANT to drive RED: add a module under `backend/app/` that calls `mint_document_row(`."""
    found = _found_minters()
    # Non-vacuity: the scan really reads the tree (the Library upload door is always a caller).
    assert "api/documents.py" in found, f"scan read nothing useful from {APP_ROOT}"
    assert found == PINNED_MINTERS, (
        f"unexpected minters: {sorted(found - PINNED_MINTERS)}; "
        f"missing: {sorted(PINNED_MINTERS - found)}"
    )


def test_the_defining_module_is_really_the_definition():
    """PLANT to drive RED: rename the minter (the exclusion above would then hide a caller)."""
    src = (APP_ROOT / DEFINING_MODULE).read_text(encoding="utf-8")
    assert "def mint_document_row(" in src
    assert "async def async_mint_document_row(" in src


def test_the_chat_attach_module_is_not_a_minter():
    """The 244 placement guarantee, restated from the inventory's side: `api/workspace.py` is the
    chat door, and the promote lives in its OWN module precisely so this stays true."""
    assert "api/workspace.py" not in _found_minters()
