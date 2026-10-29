"""Phase 300-03 (NOTE-06 / D-21) — the mail path imports only what a BUILT image contains.

⚠ WHY THIS IS AN AST WALK, NEVER AN IMPORT. The shipped invite mailer did a lazy
``import resend`` inside ``send_invite``. The dev venv never had ``resend`` either, but the
lazy import meant no test ever executed it, and the built image (``backend/Dockerfile``:
``pip install -r requirements.txt`` minus ``sentence-transformers``) could not send a single
invitation email. Importing the module in the venv proves nothing about the image: a package
that is installed transitively here, or by hand, passes an import test and is still absent
from the image. So the closure is checked against what ``requirements.txt`` DECLARES.

Every ``import`` / ``from … import`` in the listed modules — module-level AND function-local —
must resolve to the stdlib (``sys.stdlib_module_names``), to ``app.*``, or to a distribution
declared in ``backend/requirements.txt`` minus the Dockerfile filter. The import-name →
distribution map is explicit, so a new third-party import fails here until someone states
which declared distribution provides it.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
APP = BACKEND / "app"
REQUIREMENTS = BACKEND / "requirements.txt"

#: The modules on the app's outbound-mail path.
MAIL_PATH_MODULES = [
    APP / "services" / "email_provider.py",
    APP / "services" / "connectors" / "smtp_adapter.py",
]

#: import name -> the DECLARED distribution that ships it. ``starlette`` is a hard dependency of
#: ``fastapi`` (no fastapi install exists without it); ``pydantic`` is a hard dependency of
#: ``fastapi`` and ``pydantic-settings``.
IMPORT_TO_DIST = {
    "httpx": "httpx",
    "fastapi": "fastapi",
    "starlette": "fastapi",
    "pydantic": "pydantic-settings",
    "pydantic_settings": "pydantic-settings",
    "markdown_it": "markdown-it-py",
    "supabase": "supabase",
    "asyncpg": "asyncpg",
}

#: The Dockerfile drops these lines before ``pip install`` (Dockerfile:32-34).
DOCKERFILE_FILTER = re.compile(r"^\s*sentence-transformers", re.IGNORECASE)


def _declared_distributions() -> set[str]:
    declared = set()
    for line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        stripped = line.split("#", 1)[0].strip()
        if not stripped or DOCKERFILE_FILTER.match(line):
            continue
        name = re.split(r"[\s\[<>=!~;]", stripped, maxsplit=1)[0]
        declared.add(name.lower())
    return declared


def _top_level_imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = set()
    for node in ast.walk(tree):  # ast.walk reaches function-local imports too
        if isinstance(node, ast.Import):
            names.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module.split(".")[0])
    return names


def test_the_walker_sees_function_local_imports(tmp_path):
    """Non-vacuity: the walker must see an import nested inside a function — the exact shape
    of the shipped ``import resend`` it exists to catch."""
    probe = tmp_path / "probe.py"
    probe.write_text("def f():\n    import resend\n    from markdown_it import MarkdownIt\n",
                     encoding="utf-8")
    assert _top_level_imports(probe) == {"resend", "markdown_it"}


def test_every_mail_path_import_ships_in_the_built_image():
    declared = _declared_distributions()
    assert "httpx" in declared, "the requirements parser lost a known line (vacuous check)"
    for path in MAIL_PATH_MODULES:
        assert path.exists(), f"{path} is listed on the mail path but does not exist"
        for name in sorted(_top_level_imports(path)):
            if name in sys.stdlib_module_names or name == "app" or name == "__future__":
                continue
            dist = IMPORT_TO_DIST.get(name)
            assert dist is not None, (
                f"{path.name} imports {name!r}, which is neither stdlib nor app nor mapped to a "
                "declared distribution — state which requirements.txt line ships it"
            )
            assert dist in declared, (
                f"{path.name} imports {name!r} from {dist!r}, which backend/requirements.txt does "
                "not declare (minus the Dockerfile filter) — the built image would not have it"
            )


def test_requirements_declare_markdown_it_py():
    assert "markdown-it-py" in _declared_distributions()


def test_nothing_under_app_imports_resend():
    offenders = []
    for path in APP.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        if "resend" in _top_level_imports(path):
            offenders.append(path.relative_to(BACKEND).as_posix())
    assert offenders == [], f"the resend SDK is not in the image; imported by {offenders}"
