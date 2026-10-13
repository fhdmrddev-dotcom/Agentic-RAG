#!/usr/bin/env python
"""Phase 278 (SEAM-03, D-06 / D-07) — did the dispatcher-split commit(s) change tests ONLY by
retargeting patch targets, imports and source paths?

The roadmap failure mode this answers: *"a moved handler changes behaviour and a test edited in the
same commit hides it."* D-06 allows test edits in the move commit ONLY to retarget patch targets and
imports (re-exports cannot keep string patches working — patch-where-used), and D-07 demands a
MECHANICAL check of that claim, because 45+ files are retargeted and a reviewer misses one changed
``assert``.

USAGE (run with backend/venv's python; stdlib only)::

    check-test-retarget-only.py [options] <old_rev> <new_rev|WORKTREE>
    check-test-retarget-only.py --no-loss [options] <old_rev> <new_rev|WORKTREE>

Exit codes: 0 clear · 1 violation · 2 harness error. ``WORKTREE`` reads the files on disk.

OPTIONS (Phase 279 / D-03 — parameterised, not forked; with NO option the 278 behaviour is
reproduced exactly, and ``18abc1ed5^ 18abc1ed5`` must still read CLEAR in both modes)::

    --source <repo-rel .py>          the split module      (default backend/app/services/tool_dispatcher.py)
    --dest <repo-rel path|glob>      a move home; repeatable (default backend/app/services/tools/*.py)
    --norm-module <regex>=<module>   repeatable; when given these REPLACE the 278 norm() rules (each
                                     regex -> module, plus the matching ``<basename>.py`` path form)
    --exclude-prefix <prefix>        the move's own pin files (default test_278_)
    --extra-scope <repo-rel>         repeatable; ``""`` means none (default scripts/uat-adversarial-sync.py)

The 279 invocation (the expert_scope split, 279-01)::

    check-test-retarget-only.py --source backend/app/services/expert_scope.py --dest backend/app/services/expert_scope_statement.py --dest backend/app/services/expert_scope_events.py --norm-module "app\\.services\\.expert_scope_(statement|events)\\b=app.services.expert_scope" --exclude-prefix test_279_ --extra-scope "" <old_rev> <new_rev|WORKTREE>

── RETARGET MODE ─────────────────────────────────────────────────────────────────────────────

Scope: every file under ``backend/tests/`` that exists at ``<old_rev>`` and differs at ``<new_rev>``
(``test_278_*`` excluded — those are the move's own pins, whose xfail markers 278-03 removes), plus
``scripts/uat-adversarial-sync.py``. Lines are diffed with ``difflib.SequenceMatcher`` after ``\\r``
is stripped (autocrlf on this box). Rules:

1. ABSOLUTE — no added or removed line matches ``\\bassert\\b``, ``pytest.fail/raises/skip``,
   ``pytest.mark.skip/skipif/xfail`` or ``.assert_<x>(``. No exception, no override.
2. Every changed line must classify as one of:
   - IMPORT   — the line lies inside an ``import`` / ``from … import`` statement (by AST span, so
                a parenthesised import's continuation lines count, and nothing else does);
   - BLANK    — whitespace only;
   - COMMENT  — starts with ``#`` after stripping;
   - PATH     — a path-only line: string literals, ``/``, ``Path(``, ``getsourcefile(``,
                ``inspect.getsourcefile(``, ``td`` / ``td_<family>``, CONSTANT names, brackets and
                commas, optionally as the RHS of a CONSTANT assignment; it must carry a ``.py``
                string or a ``td`` name, or be a pure bracket opener/closer;
   - NORM-EQUAL — in a ``replace`` hunk with EQUAL line counts, the pair is equal after ``norm()``,
                which maps ``app.services.tools.<x>`` and ``app.services.search_documents_tool`` to
                ``app.services.tool_dispatcher``, ``tools/<x>.py`` and ``"tools" / "<x>.py"`` to
                ``tool_dispatcher.py``, and ``td_<x>`` to ``td``. ⚠ Convention: every new module
                alias in a retargeted test is named ``td_<family>``.
3. A changed line that falls inside an ``assert`` statement's line span is allowed ONLY if it is
   PATH class (NORM-EQUAL is not enough there), and every such line is printed under
   ``assert-span path lines (allowed, listed for review)`` so the verifier sees it.
4. (278-REVIEW WR-04) A diff hunk may never LOSE a ``.py`` path entry: the number of ``.py`` string
   literals on its removed PATH / NORM-EQUAL lines must not exceed the number on its added ones.
   Each unpaired removal is reported as ``path-entry-removed``. Without this, deleting
   ``"services/tools/memory.py",`` from a fence's scan list classified PATH and passed CLEAR —
   narrowing what an absence fence scans while its own ``seen == len(...)`` still agreed with itself.

── NO-LOSS MODE ─────────────────────────────────────────────────────────────────────────────

The AST pure-move pin cannot see comments (they are not in the AST). This mode proves the comments
and docstrings moved: every non-blank line REMOVED from ``backend/app/services/tool_dispatcher.py``
between the revs — excluding lines inside a top-level ``import`` statement of the OLD file — must
appear (stripped, counted as a multiset) among the lines ADDED to ``backend/app/services/tools/*.py``
plus the lines ADDED to ``tool_dispatcher.py`` itself (a line moved within the file is removed and
re-added). A dropped comment or docstring line exits 1 and is printed.

── HOW THIS COULD LIE (read before trusting a green) ─────────────────────────────────────────

- NORM-EQUAL trusts the normaliser. A retarget that ALSO changes behaviour on the same line in a
  way ``norm()`` erases (e.g. swapping which ``td_<x>`` alias a call goes through) passes. That is
  the point of patch-where-used retargeting, and it is why the move is ALSO pinned by the AST pin,
  the registry pin and the full gate's failing-SET diff — this script is one of four proofs.
- PATH lines are shape-checked, not meaning-checked: repointing a fence at the WRONG file passes
  here. D-08's anchor asserts (each fence first asserts it found its code) are what catch that.
  ACCEPTED at 278-REVIEW WR-04 rather than fixed: knowing the RIGHT family needs a handler → file
  map at the new rev plus knowing which handler each fence is about, i.e. re-deriving D-08's
  per-fence intent. Rule 4 catches a scan list SHRINKING; a same-count swap to the wrong family is
  left to the anchor asserts.
- Scope is files that existed at ``<old_rev>``. A NEW test file is not checked (nothing to diff).
- No-loss is a multiset over stripped lines: a common line (``return result``) dropped in one place
  and duplicated in another nets to zero. The AST pin covers code; this covers prose.
- (279) A retarget to the WRONG sibling module (``expert_scope_statement`` vs ``expert_scope_events``)
  is NORM-EQUAL and passes here. 279 closes that with ``test_279_pure_move``'s fresh-import / AST /
  one-home pins and by RUNNING the retargeted suites — not by this script.
"""
from __future__ import annotations

import ast
import difflib
import fnmatch
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

EXIT_CLEAR = 0
EXIT_VIOLATION = 1
EXIT_HARNESS = 2

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKTREE = "WORKTREE"

# The 278 defaults. Phase 279 (D-03) turned each into a CLI option whose default is this value, so a
# run with no option reproduces the 278 check exactly.
_TD_REL = "backend/app/services/tool_dispatcher.py"
_TOOLS_DIR_REL = "backend/app/services/tools"
_EXTRA_SCOPE = ("scripts/uat-adversarial-sync.py",)
_DEFAULT_DESTS = (f"{_TOOLS_DIR_REL}/*.py",)
_DEFAULT_EXCLUDE_PREFIX = "test_278_"


@dataclass(frozen=True)
class Config:
    """What a run checks. ``Config()`` IS the 278 configuration."""

    source: str = _TD_REL
    dests: tuple[str, ...] = _DEFAULT_DESTS
    # (compiled regex, replacement module) — empty means the 278 norm() rules apply unchanged.
    norm_modules: tuple[tuple[re.Pattern[str], str], ...] = field(default_factory=tuple)
    exclude_prefix: str = _DEFAULT_EXCLUDE_PREFIX
    extra_scope: tuple[str, ...] = _EXTRA_SCOPE

_ASSERT_RE = re.compile(
    r"\bassert\b|pytest\.(fail|raises|skip)\b|pytest\.mark\.(skip|skipif|xfail)\b|\.assert_\w+\("
)
_STRING_RE = re.compile(r"""(?:[rRbBuUfF]{0,2})("([^"\\]|\\.)*"|'([^'\\]|\\.)*')""")
_CONST_ASSIGN_RE = re.compile(r"^\s*_?[A-Z][A-Z0-9_]*\s*(:\s*[^=]+)?=\s*")
_ALLOWED_IDENT_RE = re.compile(
    r"\b(inspect\.getsourcefile|getsourcefile|Path|td_\w+|td|__file__|parents|parent|_?[A-Z][A-Z0-9_]*)\b"
)
_TD_NAME_RE = re.compile(r"\btd(_\w+)?\b")
_STRUCTURAL_RE = re.compile(r"^[\s()\[\],./0-9]*$")
_PURE_BRACKETS_RE = re.compile(r"^[\s()\[\],]+$")


class HarnessError(Exception):
    pass


# ── git / file access ───────────────────────────────────────────────────────────────────────


def _git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8",
    )
    if proc.returncode != 0:
        raise HarnessError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def _exists_at(rev: str, rel: str) -> bool:
    if rev == WORKTREE:
        return (REPO_ROOT / rel).is_file()
    proc = subprocess.run(
        ["git", "cat-file", "-e", f"{rev}:{rel}"], cwd=REPO_ROOT, capture_output=True,
    )
    return proc.returncode == 0


def _read_at(rev: str, rel: str) -> str:
    if rev == WORKTREE:
        text = (REPO_ROOT / rel).read_text(encoding="utf-8")
    else:
        text = _git("show", f"{rev}:{rel}")
    return text.replace("\r", "")


def _lines_at(rev: str, rel: str) -> list[str]:
    return _read_at(rev, rel).split("\n") if _exists_at(rev, rel) else []


def _changed_files(old: str, new: str, *paths: str) -> list[str]:
    if new == WORKTREE:
        out = _git("diff", "--no-renames", "--name-only", old, "--", *paths)
    else:
        out = _git("diff", "--no-renames", "--name-only", old, new, "--", *paths)
    return [ln.strip() for ln in out.splitlines() if ln.strip()]


def _tools_files_at(rev: str, dir_rel: str = _TOOLS_DIR_REL, pattern: str = "*.py") -> list[str]:
    """The files directly under ``dir_rel`` matching ``pattern`` at ``rev`` (278: ``tools/*.py``)."""
    if rev == WORKTREE:
        d = REPO_ROOT / dir_rel
        return sorted(f"{dir_rel}/{p.name}" for p in d.glob(pattern) if p.is_file()) if d.is_dir() else []
    out = _git("ls-tree", "--name-only", rev, f"{dir_rel}/")
    return sorted(
        ln.strip() for ln in out.splitlines()
        if ln.strip() and fnmatch.fnmatchcase(ln.strip().rsplit("/", 1)[-1], pattern)
    )


def _dest_files_at(rev: str, dests: tuple[str, ...]) -> list[str]:
    """Every move-home file a ``--dest`` names at ``rev``: an explicit path as-is (absent → it simply
    contributes no lines), a glob expanded over its directory."""
    out: set[str] = set()
    for spec in dests:
        if any(ch in spec for ch in "*?["):
            dir_rel, _, pattern = spec.rpartition("/")
            out.update(_tools_files_at(rev, dir_rel, pattern))
        else:
            out.add(spec)
    return sorted(out)


# ── classification ──────────────────────────────────────────────────────────────────────────


def _path_form(pattern: re.Pattern[str], module: str) -> tuple[re.Pattern[str], str]:
    """The ``<basename>.py`` path form of one ``--norm-module`` mapping: the regex's last dotted
    component (its trailing ``\\b`` dropped) followed by ``.py``, mapped to the module's basename."""
    last = re.split(r"\\\.", pattern.pattern)[-1]
    if last.endswith(r"\b"):
        last = last[:-2]
    return re.compile(rf"\b{last}\.py"), f"{module.rsplit('.', 1)[-1]}.py"


def norm(s: str, cfg: Config | None = None) -> str:
    if cfg is not None and cfg.norm_modules:
        # 279 (D-03): the mappings REPLACE the 278 module rules — each regex → its module, plus the
        # matching path form (``expert_scope_statement.py`` → ``expert_scope.py``).
        for pattern, module in cfg.norm_modules:
            s = pattern.sub(module, s)
            path_re, path_repl = _path_form(pattern, module)
            s = path_re.sub(path_repl, s)
        return s
    s = re.sub(r"app\.services\.tools\.\w+", "app.services.tool_dispatcher", s)
    s = s.replace("app.services.search_documents_tool", "app.services.tool_dispatcher")
    s = re.sub(r"""(["'])tools\1\s*/\s*(["'])\w+\.py\2""", r'\1tool_dispatcher.py\1', s)
    s = re.sub(r"tools/\w+\.py", "tool_dispatcher.py", s)
    s = re.sub(r"\btd_\w+\b", "td", s)
    return s


def _spans(source: str, node_types: tuple[type, ...]) -> set[int]:
    """1-based line numbers covered by any node of ``node_types`` (any depth)."""
    lines: set[int] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, node_types):
            lines.update(range(node.lineno, (node.end_lineno or node.lineno) + 1))
    return lines


def _is_path_line(line: str) -> bool:
    body = line.strip()
    if not body:
        return False
    if body.endswith(","):
        body = body[:-1].rstrip()
    body = _CONST_ASSIGN_RE.sub("", body, count=1)
    has_py_string = bool(re.search(r"""\.py["']""", body))
    has_td = bool(_TD_NAME_RE.search(_STRING_RE.sub('""', body)))
    rest = _STRING_RE.sub("", body)
    rest = _ALLOWED_IDENT_RE.sub("", rest)
    if not _STRUCTURAL_RE.match(rest):
        return False
    # A pure bracket opener/closer (`(`, `),`, `)]`) carries no value; digits are NOT allowed there,
    # so a changed expected count inside a literal can never pass as a "path" line.
    return has_py_string or has_td or _PURE_BRACKETS_RE.match(body) is not None


def _classify(line: str, lineno: int, import_lines: set[int]) -> str | None:
    """The class a changed line falls in, or None when it fits none."""
    if lineno in import_lines:
        return "IMPORT"
    if not line.strip():
        return "BLANK"
    if line.strip().startswith("#"):
        return "COMMENT"
    if _is_path_line(line):
        return "PATH"
    return None


def _check_file(rel: str, old: str, new: str, cfg: Config | None = None) -> tuple[list[str], list[str]]:
    """(violations, assert-span path lines) for one file."""
    old_src = _read_at(old, rel)
    new_src = _read_at(new, rel) if _exists_at(new, rel) else ""
    old_lines = old_src.split("\n")
    new_lines = new_src.split("\n") if new_src else []
    is_py = rel.endswith(".py")
    try:
        old_imports = _spans(old_src, (ast.Import, ast.ImportFrom)) if is_py else set()
        new_imports = _spans(new_src, (ast.Import, ast.ImportFrom)) if is_py and new_src else set()
        old_asserts = _spans(old_src, (ast.Assert,)) if is_py else set()
        new_asserts = _spans(new_src, (ast.Assert,)) if is_py and new_src else set()
    except SyntaxError as exc:
        raise HarnessError(f"{rel}: does not parse ({exc}); cannot classify its lines") from exc

    violations: list[str] = []
    assert_span: list[str] = []

    def judge(sign: str, lineno: int, text: str, cls: str | None, asserts: set[int]) -> None:
        if _ASSERT_RE.search(text):
            violations.append(f"{rel}:{lineno} [{sign}] assert-line-changed {text.strip()}")
            return
        if lineno in asserts:
            if cls == "PATH":
                assert_span.append(f"{rel}:{lineno} [{sign}] PATH {text.strip()}")
            else:
                violations.append(
                    f"{rel}:{lineno} [{sign}] non-path-line-inside-assert ({cls or 'unclassified'}) "
                    f"{text.strip()}"
                )
            return
        if cls is None:
            violations.append(f"{rel}:{lineno} [{sign}] not-a-retarget {text.strip()}")

    matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        paired = tag == "replace" and (i2 - i1) == (j2 - j1)
        # 278-REVIEW WR-04 — a hunk may never LOSE a ``.py`` path entry. Without this, a lone removed
        # ``"services/tools/memory.py",`` classifies PATH and passes, which silently narrows an
        # absence fence's scan list (``_HANDLER_FILES`` etc. — the fence's own ``seen == len(...)``
        # compares the shrunken tuple with itself). Counted over PATH / NORM-EQUAL lines only, so a
        # comment or import naming a file never counts. A retarget keeps or grows the count.
        removed_entries: list[tuple[int, str]] = []
        added_entries = 0
        for k in range(max(i2 - i1, j2 - j1)):
            o_idx = i1 + k if i1 + k < i2 else None
            n_idx = j1 + k if j1 + k < j2 else None
            o_text = old_lines[o_idx] if o_idx is not None else None
            n_text = new_lines[n_idx] if n_idx is not None else None
            o_cls = _classify(o_text, o_idx + 1, old_imports) if o_text is not None else None
            n_cls = _classify(n_text, n_idx + 1, new_imports) if n_text is not None else None
            if paired and o_cls is None and n_cls is None and norm(o_text, cfg) == norm(n_text, cfg):
                o_cls = n_cls = "NORM-EQUAL"
            if o_text is not None:
                judge("-", o_idx + 1, o_text, o_cls, old_asserts)
                if o_cls in ("PATH", "NORM-EQUAL"):
                    removed_entries.extend((o_idx + 1, o_text) for _ in range(_py_path_entries(o_text)))
            if n_text is not None:
                judge("+", n_idx + 1, n_text, n_cls, new_asserts)
                if n_cls in ("PATH", "NORM-EQUAL"):
                    added_entries += _py_path_entries(n_text)
        if len(removed_entries) > added_entries:
            for lineno, text in removed_entries[added_entries:]:
                violations.append(
                    f"{rel}:{lineno} [-] path-entry-removed ({len(removed_entries)} removed vs "
                    f"{added_entries} added in this hunk) {text.strip()}"
                )
    return violations, assert_span


def _py_path_entries(line: str) -> int:
    """How many string literals on the line name a ``.py`` file (a scan-list / path entry)."""
    return sum(1 for m in _STRING_RE.finditer(line) if re.search(r"""\.py["']$""", m.group(1)))


def _retarget_mode(old: str, new: str, log, cfg: Config | None = None) -> int:
    cfg = cfg or Config()
    candidates = _changed_files(old, new, "backend/tests", *cfg.extra_scope)
    scope = [
        rel for rel in candidates
        if (rel.startswith("backend/tests/") or rel in cfg.extra_scope)
        and not Path(rel).name.startswith(cfg.exclude_prefix)
        and _exists_at(old, rel)
    ]
    violations: list[str] = []
    assert_span: list[str] = []
    for rel in scope:
        v, a = _check_file(rel, old, new, cfg)
        violations.extend(v)
        assert_span.extend(a)
    log(f"retarget-only check {old} -> {new}: {len(scope)} file(s) in scope "
        f"({len(candidates)} changed under backend/tests + extra scope)")
    for rel in scope:
        log(f"  scanned {rel}")
    if assert_span:
        log("assert-span path lines (allowed, listed for review):")
        for line in assert_span:
            log(f"  {line}")
    if violations:
        log(f"VIOLATION — {len(violations)} changed line(s) are not a retarget (D-07):")
        for line in violations:
            log(f"  {line}")
        return EXIT_VIOLATION
    log("retarget-only: CLEAR (no assert line changed; every changed line is a retarget)")
    return EXIT_CLEAR


def _added_lines(old_lines: list[str], new_lines: list[str]) -> list[str]:
    out: list[str] = []
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    for tag, _i1, _i2, j1, j2 in matcher.get_opcodes():
        if tag in ("replace", "insert"):
            out.extend(new_lines[j1:j2])
    return out


def _no_loss_mode(old: str, new: str, log, cfg: Config | None = None) -> int:
    cfg = cfg or Config()
    source = cfg.source
    if not _exists_at(old, source):
        raise HarnessError(f"--source {source} does not exist at {old}")
    old_src = _read_at(old, source)
    old_td = old_src.split("\n")
    new_td = _lines_at(new, source)
    try:
        top_import_lines: set[int] = set()
        for node in ast.parse(old_src).body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                top_import_lines.update(range(node.lineno, (node.end_lineno or node.lineno) + 1))
    except SyntaxError as exc:
        raise HarnessError(f"{source} at {old} does not parse: {exc}") from exc

    removed: list[tuple[int, str]] = []
    matcher = difflib.SequenceMatcher(None, old_td, new_td, autojunk=False)
    for tag, i1, i2, _j1, _j2 in matcher.get_opcodes():
        if tag in ("replace", "delete"):
            for idx in range(i1, i2):
                if old_td[idx].strip() and (idx + 1) not in top_import_lines:
                    removed.append((idx + 1, old_td[idx]))

    available: Counter[str] = Counter(ln.strip() for ln in _added_lines(old_td, new_td))
    dest_files = sorted(
        (set(_dest_files_at(new, cfg.dests)) | set(_dest_files_at(old, cfg.dests) if old != WORKTREE else []))
        - {source}  # the source's own re-added lines are already counted above
    )
    present_at_new = [rel for rel in dest_files if _exists_at(new, rel)]
    for rel in dest_files:
        added = _added_lines(_lines_at(old, rel), _lines_at(new, rel))
        available.update(ln.strip() for ln in added)

    dest_label = " + ".join(cfg.dests)
    lost: list[str] = []
    for lineno, text in removed:
        key = text.strip()
        if available[key] > 0:
            available[key] -= 1
        else:
            lost.append(f"{source}:{lineno} [-] lost {key}")
    log(f"no-loss check {old} -> {new}: {len(removed)} removed non-blank non-import line(s) from "
        f"{source}; {len(present_at_new)} destination file(s) at the new rev ({dest_label})")
    if lost:
        log(f"VIOLATION — {len(lost)} removed line(s) appear nowhere in {dest_label} or the new "
            f"{source} (a dropped comment, docstring or line):")
        for line in lost:
            log(f"  {line}")
        return EXIT_VIOLATION
    log(f"no-loss: CLEAR (every removed line reappears in {dest_label} or {source})")
    return EXIT_CLEAR


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # pragma: no cover - redirected streams
        pass

    def log(msg: str = "") -> None:
        print(msg, flush=True)

    usage = (
        "usage: check-test-retarget-only.py [--no-loss] [--source <rel.py>] [--dest <rel|glob>]... "
        "[--norm-module <regex>=<module>]... [--exclude-prefix <prefix>] [--extra-scope <rel>]... "
        "<old_rev> <new_rev|WORKTREE>"
    )
    no_loss = False
    source: str | None = None
    dests: list[str] = []
    norm_modules: list[tuple[re.Pattern[str], str]] = []
    exclude_prefix: str | None = None
    extra_scope: list[str] | None = None
    positional: list[str] = []
    value_opts = ("--source", "--dest", "--norm-module", "--exclude-prefix", "--extra-scope")
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--no-loss":
            no_loss = True
            i += 1
            continue
        name, eq, inline = arg.partition("=")
        if name in value_opts:
            if eq:
                value = inline
            elif i + 1 < len(argv):
                value = argv[i + 1]
                i += 1
            else:
                log(f"{name} needs a value\n{usage}")
                return EXIT_HARNESS
            i += 1
            if name == "--source":
                source = value
            elif name == "--dest":
                dests.append(value)
            elif name == "--norm-module":
                regex, sep, module = value.rpartition("=")
                if not sep or not regex or not module:
                    log(f"--norm-module wants <regex>=<module>, got {value!r}\n{usage}")
                    return EXIT_HARNESS
                try:
                    norm_modules.append((re.compile(regex), module))
                except re.error as exc:
                    log(f"--norm-module regex {regex!r} does not compile: {exc}")
                    return EXIT_HARNESS
            elif name == "--exclude-prefix":
                exclude_prefix = value
            else:  # --extra-scope; "" means none
                extra_scope = (extra_scope or []) + ([value] if value else [])
            continue
        if arg.startswith("--"):
            log(f"unknown option {arg}\n{usage}")
            return EXIT_HARNESS
        positional.append(arg)
        i += 1
    if len(positional) != 2:
        log(usage)
        return EXIT_HARNESS
    cfg = Config(
        source=source or _TD_REL,
        dests=tuple(dests) or _DEFAULT_DESTS,
        norm_modules=tuple(norm_modules),
        exclude_prefix=exclude_prefix if exclude_prefix is not None else _DEFAULT_EXCLUDE_PREFIX,
        extra_scope=tuple(extra_scope) if extra_scope is not None else _EXTRA_SCOPE,
    )
    old, new = positional
    try:
        if old == WORKTREE:
            raise HarnessError("<old_rev> must be a git revision, not WORKTREE")
        _git("rev-parse", "--verify", f"{old}^{{commit}}")
        if new != WORKTREE:
            _git("rev-parse", "--verify", f"{new}^{{commit}}")
        return _no_loss_mode(old, new, log, cfg) if no_loss else _retarget_mode(old, new, log, cfg)
    except HarnessError as exc:
        log(f"FATAL: {exc}")
        return EXIT_HARNESS


if __name__ == "__main__":
    sys.exit(main())
