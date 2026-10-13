"""Phase 142 (SRH-01) — the PURE runtime-gap classifier, its fixed allowlists and messages,
``SCRIPT_EXTS``, and the per-run repeat-guard result builder. No I/O.

Moved VERBATIM out of ``tool_dispatcher.py`` in Phase 278 (SEAM-03, a pure move): every binding
here is AST-identical to its PHASE_BASE source, proven by ``tests/unit/test_278_pure_move.py``.
``tool_dispatcher.py`` keeps the registry: it imports the handlers below BY NAME into its static
``_TOOL_REGISTRY`` literal (Extension Contract — never registered dynamically).

``SCRIPT_EXTS`` is re-exported from ``tool_dispatcher`` for ``app/api/skills.py`` (D-04).
``import re as _re_filename`` is the base module's alias, kept so the moved regexes stay
AST-identical. Pure: nothing here reads a patchable service — tests import these names from
``app.services.tools.runtime_gap`` (``tools/sandbox.py`` imports them by name, so a patch of
``_classify_runtime_gap`` for ``execute_code`` targets ``app.services.tools.sandbox``).

⛔ Import-cycle rule: no module-level import of ``app.services.tool_dispatcher`` here (the
dispatcher imports this module at load). Cross-family helpers are imported BY NAME from their
``app.services.tools.<family>`` home, never through the dispatcher.
"""
from __future__ import annotations

import json
import re as _re_filename


# ---------------------------------------------------------------------------
# Phase 142 (SRH-01) — non-Python skill-script runtime-gap honesty.
#
# `_classify_runtime_gap` is the single correctness-critical piece of Phase 142:
# it decides WHETHER a completed sandbox failure is one of three KNOWN runtime
# gaps (G-A missing bundled file / G-B non-Python script / G-C missing binary or
# module) and, if so, WHICH permanent-framed honest message to surface. It is a
# PURE function (four string/int args -> dict | None). Nothing calls it in this
# plan — Plan 02 wires it into the completed-run result builder + the per-run
# repeat-guard; on its own it changes no runtime behavior.
#
# DESIGN LAW (threat T-142-01 — the most important property in the phase):
# NEVER reshape on error-type or exit-code ALONE. A hit requires a token from a
# FIXED allowlist NAMED by the shell as missing (`<tok>: not found` / a
# FileNotFoundError exec of it), or present with a 124/127 exit, OR a
# `No module named '<mod>'` for a known module, OR a JS-exclusive token on a
# NON-COMMENT `code` line together with a Python SyntaxError, OR a missing
# RELATIVE path under a known skill-bundle subdir (`scripts/`|`assets/`|`resources/`).
# The POST-HOC caller additionally gates on a NON-ZERO exit so a successful run is
# never reshaped. Everything else returns None so a genuine ValueError / a genuine
# missing /sandbox/output file / a real SyntaxError / a recoverable relative miss
# still reaches the model unchanged.
# Proven by test_142_runtime_gap.py::test_non_gap_passthrough. This mirrors the
# "distrust a model/sandbox string, match a FIXED set, safe default on non-match"
# posture of _safe_out_filename above.

# Fixed allowlists (single source — Plans 02/03/05 import these). Tokens are the
# bounded key space for GAP_MESSAGES and the repeat-guard set, so there is no
# attacker-controlled key growth (threat T-142-04).
KNOWN_MISSING_BINARIES = frozenset({
    "soffice", "libreoffice", "pandoc", "pdftoppm", "pdfinfo",
    "node", "npm", "npx", "extract-text",
})
KNOWN_MISSING_MODULES = frozenset({"markitdown"})
# CR-01(1c): JS-exclusive markers for the G-B (non-Python script) branch. `"let "`
# was REMOVED — Python has no `let`, but the substring is too common in ordinary
# English inside comments/strings ("let me…", "let's…") to be a safe JS signal and
# collided with the repeat-guard. The remaining markers are JS-only constructs.
JS_TOKENS = ("const ", "=>", "require(", "console.log",
             "export default", "function*")

# WR-01: the ONLY missing-path shape that classifies as a lost, flattened
# skill-tree helper (G-A). A relative path under one of these known skill-bundle
# subdirs (e.g. `scripts/office/convert.py`) is the flattened-tree signal. ANY
# other relative miss (`data/input.json`, `config/settings.yaml`) is a RECOVERABLE
# user error and passes through (None) so the model can create the dir / fix it.
_SKILL_BUNDLE_DIRS = ("scripts/", "assets/", "resources/")

# Shared script-extension set — consumed by D-11 decode (Plan 03), the D-05b
# load_skill flag (Plan 03), and the SC#1 import note (Plan 05). Single source;
# import from here.
SCRIPT_EXTS = frozenset({
    "js", "ts", "jsx", "tsx", "mjs", "cjs", "sh", "bash",
    "rb", "go", "rs", "php", "pl", "lua", "ps1", "bat",
})

# Permanent-framed reshape wording per gap. Each: names the gap, says it cannot
# become available, says do NOT retry, and offers the in-sandbox forward action
# (tone modeled on BUG-260707-02-pptx-skill-instructions-sandbox-aware.md).
_MSG_SOFFICE = ("LibreOffice (`soffice`) is not installed in this sandbox and cannot be "
    "installed here. Do NOT retry. Build or QA the presentation/document in-memory with "
    "python-pptx / python-docx / openpyxl, or tell the user this conversion is unavailable.")
_MSG_NODE = ("This sandbox runs Python only — Node.js/npm/npx are not installed and cannot "
    "be installed here. Do NOT retry as JavaScript. Re-implement the step in Python, or tell "
    "the user JavaScript execution is unavailable.")
GAP_MESSAGES = {
    "soffice": _MSG_SOFFICE,
    "libreoffice": _MSG_SOFFICE,
    "node": _MSG_NODE,
    "npm": _MSG_NODE,
    "npx": _MSG_NODE,
    "pandoc": ("pandoc is not installed in this sandbox and cannot be installed here. Do NOT "
        "retry. Work with the source format directly using python-docx / pypdf / openpyxl, or "
        "tell the user document conversion is unavailable."),
    "pdftoppm": ("Poppler (`pdftoppm`) is not installed in this sandbox and cannot be installed "
        "here. Do NOT retry. Read PDF text with pypdf instead of rasterizing pages, or tell the "
        "user PDF-to-image rendering is unavailable."),
    "pdfinfo": ("Poppler (`pdfinfo`) is not installed in this sandbox and cannot be installed "
        "here. Do NOT retry. Inspect the PDF with pypdf, or tell the user this is unavailable."),
    "extract-text": ("The `extract-text` helper is not installed in this sandbox and cannot be "
        "installed here. Do NOT retry. Extract text in-memory with pypdf / python-docx / "
        "python-pptx, or tell the user."),
    "markitdown": ("`markitdown` is not installed in this sandbox and cannot be installed here. "
        "Do NOT retry. Read the document in-memory with python-docx / python-pptx / openpyxl / "
        "pypdf, or tell the user this conversion is unavailable."),
}
# Class-level messages for G-B (JS) and G-A (missing bundled file), keyed by class not token:
GAP_MESSAGES_JS = _MSG_NODE
GAP_MESSAGES_MISSING_FILE = ("A bundled skill script at '{path}' was not found in the sandbox. "
    "Nested helper scripts (e.g. `scripts/office/*`) do not resolve here — the skill's folder "
    "tree is flattened on import. Do NOT retry the same path. Do the equivalent work in-memory "
    "with the Python libraries available, or tell the user.")

# Precompiled extractors (reuse the module-level `re` alias bound above). The
# module regex runs on a lowercased haystack; the path regex runs on the ORIGINAL
# stderr (IGNORECASE) so the captured path keeps its real case for the message.
_NO_MODULE_RE = _re_filename.compile(r"no module named ['\"]?([\w\.\-]+)")
_MISSING_PATH_RE = _re_filename.compile(
    r"no such file or directory:\s*['\"]([^'\"]+)['\"]", _re_filename.IGNORECASE
)

# CR-01(1b): a MISSING BINARY only classifies as G-C when the shell NAMES it as
# missing — `<tok>: not found`, `<tok>: command not found`, or a FileNotFoundError
# exec of EXACTLY that token — anchored to a left token boundary. A bare
# co-occurrence of the token with the words "not found" (a `ValueError` printing
# `config node 'db' not found`, which yields `node 'db' not found` NOT
# `node: not found`) is NOT a gap and passes through (None). One precompiled regex
# per fixed-allowlist token — no attacker-controlled key growth (T-142-04).
_BINARY_GAP_RES = {
    _btok: _re_filename.compile(
        rf"(?<![\w/-]){_re_filename.escape(_btok)}:\s*(?:command\s+)?not found"
        rf"|no such file or directory:\s*['\"]{_re_filename.escape(_btok)}['\"]",
        _re_filename.IGNORECASE,
    )
    for _btok in KNOWN_MISSING_BINARIES
}


def _strip_py_line_comments(code: str) -> str:
    """CR-01(1c) — drop each line's unquoted ``#…`` tail so a Python COMMENT can
    never supply a JS token to the G-B check (``# let me handle a => b``). Quote
    tracking is per-line and deliberately simple: on the rare edge it over-strips
    (a ``#`` inside a triple-quoted string spanning lines), it only removes MORE
    text, which can only SUPPRESS a G-B hit — the safe-default (pass-through)
    direction, so it never causes a false reshape."""
    out_lines: list[str] = []
    for line in code.splitlines():
        quote: str | None = None
        cut = len(line)
        i = 0
        n = len(line)
        while i < n:
            ch = line[i]
            if quote is not None:
                if ch == "\\":
                    i += 2
                    continue
                if ch == quote:
                    quote = None
            elif ch in ("'", '"'):
                quote = ch
            elif ch == "#":
                cut = i
                break
            i += 1
        out_lines.append(line[:cut])
    return "\n".join(out_lines)


def _classify_runtime_gap(
    code: str, stdout: str, stderr: str, exit_code: int
) -> dict | None:
    """Classify a completed sandbox failure as one of the three known runtime
    gaps, or None (pass-through — a real error the model must still see).

    Returns ``{"class": "G-A"|"G-B"|"G-C", "token": <str>, "message": <str>}``
    on a hit; ``None`` otherwise. Pure — no I/O. See the DESIGN LAW comment above:
    a hit ALWAYS requires a fixed-allowlist token NAMED as missing (or the
    JS-token+SyntaxError combination, or a bundled-skill-tree missing path) —
    never error-type or exit code alone. Safe default (``None``) on any non-match,
    exactly like ``_safe_out_filename`` returns ``deliverable.<ext>`` on a bad name.
    """
    code_s = code or ""
    out_l = f"{stdout or ''}\n{stderr or ''}".lower()
    all_l = f"{code_s.lower()}\n{out_l}"
    shell_exit = exit_code in (124, 127)

    # (a) G-C missing binary. Two disjoint signals, BOTH requiring a fixed-
    #     allowlist token — NEVER exit code alone:
    #       * a 124/127 exit with the token anywhere in code+output — a hung/killed
    #         binary leaves its name only in the executed code (the timeout stderr
    #         is our own abort message); OR
    #       * the shell NAMING the token as missing — `<tok>: not found`,
    #         `<tok>: command not found`, or a FileNotFoundError exec of EXACTLY
    #         that token — via the precise per-token regex (CR-01 1b). A bare
    #         co-occurrence of the token with the words "not found"
    #         (`config node 'db' not found`) is NOT a gap → falls through to None.
    for tok in sorted(KNOWN_MISSING_BINARIES):
        if shell_exit and tok in all_l:
            return {"class": "G-C", "token": tok, "message": GAP_MESSAGES[tok]}
        if _BINARY_GAP_RES[tok].search(out_l):
            return {"class": "G-C", "token": tok, "message": GAP_MESSAGES[tok]}

    # (b) G-C missing module — `No module named '<mod>'` for a KNOWN module only
    #     (a genuine `No module named some_pip_pkg` the user could install via
    #     libraries=[...] is NOT reshaped as permanent).
    m = _NO_MODULE_RE.search(out_l)
    if m:
        mod = m.group(1)
        if mod in KNOWN_MISSING_MODULES:
            return {"class": "G-C", "token": mod, "message": GAP_MESSAGES[mod]}

    # (c) G-B non-Python script — a JS-exclusive token on a NON-COMMENT `code`
    #     line AND a Python SyntaxError in stderr. Both required (a bare
    #     SyntaxError passes through). CR-01 1c: line-comments are stripped first
    #     so a `# let me handle a => b` note cannot masquerade as JS, and `"let "`
    #     is no longer a token (so `print("let there be light")` + SyntaxError
    #     passes through as None).
    if "syntaxerror" in out_l:
        code_no_comments = _strip_py_line_comments(code_s)
        for jtok in JS_TOKENS:
            if jtok in code_no_comments:
                return {"class": "G-B", "token": jtok, "message": GAP_MESSAGES_JS}

    # (d) G-A missing BUNDLED skill helper — a not-found RELATIVE path under a
    #     known skill-bundle subdir (`scripts/` | `assets/` | `resources/`): the
    #     lost flattened skill-tree signal. WR-01: a genuine missing relative USER
    #     path (`data/input.json`, `config/settings.yaml`) is RECOVERABLE — create
    #     the dir / fix the path — so it passes through (None); only bundle-prefixed
    #     relative paths are reshaped as a permanent lost-tree gap. A genuine
    #     absolute /sandbox/output/*.csv (starts with '/') also passes through.
    #     Recording only these narrowed paths keeps the repeat-guard set from
    #     growing on arbitrary model-supplied paths (T-142-04 reconciliation).
    pm = _MISSING_PATH_RE.search(stderr or "")
    if pm:
        path = pm.group(1).strip()
        if not path.startswith("/") and any(
            path.startswith(prefix) for prefix in _SKILL_BUNDLE_DIRS
        ):
            return {
                "class": "G-A",
                "token": path,
                "message": GAP_MESSAGES_MISSING_FILE.format(path=path),
            }

    return None


# Phase 142 (SRH-01 / D-06) — pre-flight repeat-guard support. A recorded dead
# token is one of: a KNOWN_MISSING binary/module (keys GAP_MESSAGES), a JS marker
# (GAP_MESSAGES_JS), or a lost flattened-tree G-A path (GAP_MESSAGES_MISSING_FILE).
# Map it back to its permanent-framed wording without re-running the classifier.
def _message_for_dead_token(token: str) -> str:
    if token in GAP_MESSAGES:
        return GAP_MESSAGES[token]
    if token in JS_TOKENS:
        return GAP_MESSAGES_JS
    return GAP_MESSAGES_MISSING_FILE.format(path=token)


# Phase 142 (SRH-01 / D-06) — pre-flight repeat-guard MATCH (CR-02). Decide whether
# a newly-submitted `code` re-references an already-dead token this run. A binary/
# module IDENTIFIER (`node`, `soffice`, `markitdown`, `extract-text`) is matched at
# WORD BOUNDARIES so a substring inside a larger word (`annotate`, `node_list`,
# `network_xyz`) never re-blocks legitimate code; a JS marker (`const `, `=>`, …) or
# a G-A bundled-tree path (contains `/`) is distinctive enough to keep containment.
# RESIDUAL ACCEPTED EDGE: a later cell that uses a variable literally named after a
# missing binary at a real word boundary (e.g. `node = 1`) is still blocked — rare,
# and the cost is one blocked benign cell, not the multi-round retry loop this guard
# exists to cap.
def _code_references_dead_token(code: str, token: str) -> bool:
    if token in KNOWN_MISSING_BINARIES or token in KNOWN_MISSING_MODULES:
        return _re_filename.search(
            rf"\b{_re_filename.escape(token)}\b", code, _re_filename.IGNORECASE
        ) is not None
    return token.lower() in code.lower()


_REPEAT_BLOCKED_NOTE = (
    "You already attempted this in the current run and it failed with a PERMANENT "
    "runtime gap — it will not succeed on retry. Stop retrying; use the in-sandbox "
    "alternative described above, or tell the user this is unavailable."
)


def _repeat_blocked_result(token: str) -> str:
    """Build the short-circuit tool-result JSON for the pre-flight repeat-guard.

    Error-shaped (``status='error'`` + non-zero ``exit_code``) so the model treats
    it as a failed call, carrying the same permanent-framed message plus the
    "already attempted this run" line. No sandbox is touched to produce it.
    """
    return json.dumps({
        "status": "error",
        "exit_code": 1,
        "duration_ms": 0,
        "output_files": [],
        "stdout": "",
        "stderr": "",
        "runtime_gap": {
            "token": token,
            "message": _message_for_dead_token(token),
            "repeat_blocked": True,
            "note": _REPEAT_BLOCKED_NOTE,
        },
    })
