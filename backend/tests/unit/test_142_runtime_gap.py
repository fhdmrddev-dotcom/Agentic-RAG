"""Phase 142 (SRH-01) — unit tests for the pure runtime-gap classifier.

`_classify_runtime_gap(code, stdout, stderr, exit_code)` is the single
correctness-critical piece of Phase 142: it decides WHETHER a sandbox failure
is one of the three known runtime gaps (G-A missing bundled file / G-B
non-Python script / G-C missing binary or module) and, if so, WHICH
permanent-framed honest message to surface. It is a PURE function over four
string/int args — no sandbox, no DB, no Redis.

The load-bearing property (threat T-142-01, the "design law"): the classifier
NEVER reshapes on error-type or exit-code ALONE. A hit requires a token from a
FIXED allowlist co-occurring with a not-found phrase (or the JS-token +
SyntaxError combination, or a relative-subdir missing path). Everything else —
a genuine ValueError, a genuine missing ``/sandbox/output/*.csv``, a real
Python SyntaxError with no JS token — passes through unchanged (returns None),
so a real bug still reaches the model as a real traceback. That guarantee is
proven by ``test_non_gap_passthrough`` below.
"""
from __future__ import annotations

from app.services.tool_dispatcher import (
    _classify_runtime_gap,
    KNOWN_MISSING_BINARIES,
    KNOWN_MISSING_MODULES,
    GAP_MESSAGES,
    GAP_MESSAGES_JS,
    GAP_MESSAGES_MISSING_FILE,
)


# --- Fixed-allowlist sanity (single source for Plans 02/03/05) ---------------

def test_allowlists_are_frozensets_with_expected_tokens():
    """The allowlists are the fixed, bounded sets later plans consume (T-142-04)."""
    assert isinstance(KNOWN_MISSING_BINARIES, frozenset)
    assert isinstance(KNOWN_MISSING_MODULES, frozenset)
    # A representative token from each class is present.
    assert "soffice" in KNOWN_MISSING_BINARIES
    assert "node" in KNOWN_MISSING_BINARIES
    assert "markitdown" in KNOWN_MISSING_MODULES
    # Every binary/module token has a permanent-framed message (key_link:
    # token -> GAP_MESSAGES lookup).
    for tok in KNOWN_MISSING_BINARIES | KNOWN_MISSING_MODULES:
        assert tok in GAP_MESSAGES, f"missing GAP_MESSAGES entry for {tok!r}"


# --- G-C: missing binary -----------------------------------------------------

def test_classify_gc_soffice():
    """`soffice: command not found` (exit 127) -> G-C hit on the soffice token."""
    hit = _classify_runtime_gap(
        code="import subprocess; subprocess.run(['soffice', '--headless'])",
        stdout="",
        stderr="soffice: command not found",
        exit_code=127,
    )
    assert hit is not None
    assert hit["class"] == "G-C"
    assert hit["token"] == "soffice"
    assert hit["message"] == GAP_MESSAGES["soffice"]


def test_classify_gc_pandoc_no_such_file():
    """A binary token co-occurring with a not-found phrase is a G-C hit."""
    hit = _classify_runtime_gap(
        code="import subprocess; subprocess.run(['pandoc', 'in.md', '-o', 'out.docx'])",
        stdout="",
        stderr="FileNotFoundError: [Errno 2] No such file or directory: 'pandoc'",
        exit_code=1,
    )
    assert hit is not None
    assert hit["class"] == "G-C"
    assert hit["token"] == "pandoc"
    assert hit["message"] == GAP_MESSAGES["pandoc"]


def test_classify_gc_markitdown_module():
    """`No module named 'markitdown'` -> G-C hit keyed off the module allowlist."""
    hit = _classify_runtime_gap(
        code="import markitdown",
        stdout="",
        stderr="ModuleNotFoundError: No module named 'markitdown'",
        exit_code=1,
    )
    assert hit is not None
    assert hit["class"] == "G-C"
    assert hit["token"] == "markitdown"
    assert hit["message"] == GAP_MESSAGES["markitdown"]


def test_classify_gc_timeout():
    """Exit 124 (wall-clock abort) with a known binary in `code` -> G-C hit.

    A hung binary leaves its name only in the executed `code` (the timeout
    stderr is our own abort message), so the exit-124/127 branch must scan
    `code` in addition to stdout/stderr.
    """
    hit = _classify_runtime_gap(
        code="import subprocess; subprocess.run(['soffice', '--convert-to', 'pdf', 'x.pptx'])",
        stdout="",
        stderr="[execution aborted: exceeded the 60s wall-clock limit]",
        exit_code=124,
    )
    assert hit is not None
    assert hit["class"] == "G-C"
    assert hit["token"] == "soffice"
    assert hit["message"] == GAP_MESSAGES["soffice"]


# --- G-B: non-Python script --------------------------------------------------

def test_classify_gb_js_syntaxerror():
    """A JS token in `code` + a Python SyntaxError in stderr -> G-B hit."""
    hit = _classify_runtime_gap(
        code="const x = () => 1;\nconsole.log(x());",
        stdout="",
        stderr="  File \"<string>\", line 1\n    const x = () => 1;\n          ^\nSyntaxError: invalid syntax",
        exit_code=1,
    )
    assert hit is not None
    assert hit["class"] == "G-B"
    assert hit["message"] == GAP_MESSAGES_JS
    # The token is one of the JS-exclusive markers (fed to the repeat-guard).
    assert isinstance(hit["token"], str) and hit["token"]


# --- G-A: missing bundled file (flattened tree path) -------------------------

def test_classify_ga_missing_bundled_file():
    """A relative subdir path missing (a lost skill-tree path) -> G-A hit."""
    path = "scripts/office/unpack.py"
    hit = _classify_runtime_gap(
        code="import subprocess; subprocess.run(['python', 'scripts/office/unpack.py'])",
        stdout="",
        stderr=f"FileNotFoundError: [Errno 2] No such file or directory: '{path}'",
        exit_code=1,
    )
    assert hit is not None
    assert hit["class"] == "G-A"
    assert path in hit["token"]
    assert path in hit["message"]
    assert hit["message"] == GAP_MESSAGES_MISSING_FILE.format(path=path)


# --- T-142-01: the MANDATORY pass-through negative test ----------------------

def test_non_gap_passthrough():
    """Design law (threat T-142-01): NEVER reshape a genuine error.

    A real ValueError, a genuine missing USER output file under
    /sandbox/output/, a real Python SyntaxError with no JS token, and a bare
    non-zero exit with a plain traceback MUST all classify as None (pass
    through unchanged so the model still sees the real error).
    """
    # 1. Genuine ValueError traceback — no known token anywhere.
    assert _classify_runtime_gap(
        code="raise ValueError('bad input')",
        stdout="",
        stderr=(
            "Traceback (most recent call last):\n"
            "  File \"<string>\", line 1, in <module>\n"
            "ValueError: bad input"
        ),
        exit_code=1,
    ) is None

    # 2. Genuine missing USER output file — absolute /sandbox/output path, NOT a
    #    lost tree path, and no known binary/module token. The not-found phrase
    #    is present but must NOT be enough on its own.
    assert _classify_runtime_gap(
        code="open('/sandbox/output/report.csv').read()",
        stdout="",
        stderr=(
            "FileNotFoundError: [Errno 2] No such file or directory: "
            "'/sandbox/output/report.csv'"
        ),
        exit_code=1,
    ) is None

    # 3. Real Python SyntaxError with NO JS token — SyntaxError alone is never a hit.
    assert _classify_runtime_gap(
        code="def f(:\n    pass",
        stdout="",
        stderr=(
            "  File \"<string>\", line 1\n"
            "    def f(:\n"
            "          ^\n"
            "SyntaxError: invalid syntax"
        ),
        exit_code=1,
    ) is None

    # 4. Bare non-zero exit with a plain traceback — exit code alone is never a hit.
    assert _classify_runtime_gap(
        code="d = {}; d['missing']",
        stdout="",
        stderr=(
            "Traceback (most recent call last):\n"
            "  File \"<string>\", line 1, in <module>\n"
            "KeyError: 'missing'"
        ),
        exit_code=1,
    ) is None
