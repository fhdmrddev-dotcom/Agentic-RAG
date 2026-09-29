"""269 D-269-08 / SC#2 — installing a starter Expert runs NO Expert-specific code or branch.

The 266 install path (``expert_install_service`` + ``expert_corpus``) reads ``bundle["slug"]``
generically and resolves ``app/experts/corpora/<slug>/`` by directory name. The moment any
production file names a specific starter slug or bundle id, a second, unreviewed install path
exists for that one Expert. This fence makes "no Expert-specific install code" a mechanical
property instead of a claim.

⛔ The needle set is DERIVED, never a constant list (RESEARCH Pitfall 4 — a fence over a
hand-typed list rots the day a sixth Expert ships):

* slugs = directory names under ``CORPORA_ROOT`` UNION slug literals parsed out of the seed SQL
  (migration 187, the staged ``269-candidate-bundles.sql`` found by ``rglob`` under ``.planning``
  so it survives milestone archiving, and any ``supabase/migrations/198_*.sql``);
* ids = bundle-id UUID literals parsed from the same SQL, minus the sentinel author ``...0001``.

Backend: every ``backend/app/**/*.py`` is ``ast``-parsed and every string ``Constant`` is checked,
EXCLUDING docstrings by construction (``db/experts.py`` names ``financial-analyzer`` inside a
docstring — excluded because it is prose, NOT allowlisted). Comments never reach the AST.

Frontend: every non-test ``frontend/src/**/*.{ts,tsx}`` is scanned for a QUOTED slug literal or
any occurrence of a bundle id. Exactly ONE allowlisted hit: ``ExpertAuthoringStudio.tsx``'s
``placeholder="financial-analyzer"`` (M-15 — an authoring-form input hint, not an install branch),
and the allowlisted hit is asserted to still EXIST so the allowlist cannot rot silently.

Driven RED in 269-02 against two plants (a per-slug ``if`` in ``expert_install_service.py`` and an
exported slug constant in ``catalog/expertCatalog.ts``), each restored md5-identical — see
``269-02-SUMMARY.md``.

The SQL helpers below are shared with ``test_269_bundle_sql_shape.py`` (imported, never copied).
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from app.services.expert_corpus import CORPORA_ROOT

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_APP = REPO_ROOT / "backend" / "app"
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
PLANNING = REPO_ROOT / ".planning"

SENTINEL_AUTHOR = "00000000-0000-0000-0000-000000000001"
SLUG_RE = re.compile(r"^[a-z0-9-]+$")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# M-15 — the ONE stated allowlist entry: an authoring-form placeholder hint, not an install branch.
FRONTEND_ALLOWLIST = {
    ("components/experts/ExpertAuthoringStudio.tsx", 'placeholder="financial-analyzer"'),
}


# ---------------------------------------------------------------------------------------------
# SQL helpers (quote-aware; shared with test_269_bundle_sql_shape.py)
# ---------------------------------------------------------------------------------------------

_DOLLAR_TAG = re.compile(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$")


def split_sql(sql: str) -> list[str]:
    """Split SQL on top-level ``;`` with comments removed.

    Quote-aware: ``'...'`` (with ``''`` escapes, and ``E'...'`` with backslash escapes),
    ``$tag$...$tag$`` bodies and ``/* */`` / ``--`` comments are handled, so a ``;`` or ``--``
    inside a literal never splits or truncates a statement. Returns whitespace-normalised
    statements, empty ones dropped.
    """
    out: list[str] = []
    buf: list[str] = []
    i, n = 0, len(sql)
    while i < n:
        c = sql[i]
        if c == "-" and sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j == -1 else j
            continue
        if c == "/" and sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        if c == "'":
            escaped = i > 0 and sql[i - 1] in "Ee" and (i < 2 or not (sql[i - 2].isalnum() or sql[i - 2] == "_"))
            j = i + 1
            while j < n:
                if escaped and sql[j] == "\\":
                    j += 2
                    continue
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            buf.append(sql[i : j + 1])
            i = j + 1
            continue
        if c == "$":
            m = _DOLLAR_TAG.match(sql, i)
            if m:
                tag = m.group(0)
                j = sql.find(tag, m.end())
                j = n if j == -1 else j + len(tag)
                buf.append(sql[i:j])
                i = j
                continue
        if c == ";":
            out.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1
    out.append("".join(buf))
    return [re.sub(r"\s+", " ", s).strip() for s in out if s.strip()]


def split_top_level(expr: str, sep: str) -> list[str]:
    """Split ``expr`` on ``sep`` outside quotes, dollar-quotes and parentheses."""
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    i, n = 0, len(expr)
    while i < n:
        c = expr[i]
        if c == "'":
            j = i + 1
            while j < n:
                if expr[j] == "'":
                    if j + 1 < n and expr[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            buf.append(expr[i : j + 1])
            i = j + 1
            continue
        if c == "$":
            m = _DOLLAR_TAG.match(expr, i)
            if m:
                tag = m.group(0)
                j = expr.find(tag, m.end())
                j = n if j == -1 else j + len(tag)
                buf.append(expr[i:j])
                i = j
                continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if depth == 0 and expr.startswith(sep, i):
            parts.append("".join(buf).strip())
            buf = []
            i += len(sep)
            continue
        buf.append(c)
        i += 1
    parts.append("".join(buf).strip())
    return parts


def _matching_paren(s: str, open_at: int) -> int:
    """Index of the ``)`` closing the ``(`` at ``open_at`` (quote-aware)."""
    inner = s[open_at + 1 :]
    depth = 1
    i, n = 0, len(inner)
    while i < n:
        c = inner[i]
        if c == "'":
            j = i + 1
            while j < n:
                if inner[j] == "'":
                    if j + 1 < n and inner[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            i = j + 1
            continue
        if c == "$":
            m = _DOLLAR_TAG.match(inner, i)
            if m:
                j = inner.find(m.group(0), m.end())
                i = n if j == -1 else j + len(m.group(0))
                continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return open_at + 1 + i
        i += 1
    raise AssertionError(f"unbalanced parentheses in: {s[:120]}")


def eval_text(expr: str) -> str | None:
    """Evaluate a SQL text expression built only from literals and ``||``.

    Handles ``'a''b'``, ``E'a\\nb'``, ``$tag$...$tag$`` and a trailing ``::type`` cast on each
    part. Returns ``None`` for anything that is not a pure literal (NULL, true, a function call).
    """
    pieces: list[str] = []
    for part in split_top_level(expr, "||"):
        part = re.sub(r"::[a-z_\[\]]+$", "", part.strip(), flags=re.I).strip()
        m = re.fullmatch(r"'((?:[^']|'')*)'", part, flags=re.S)
        if m:
            pieces.append(m.group(1).replace("''", "'"))
            continue
        m = re.fullmatch(r"[Ee]'((?:[^'\\]|''|\\.)*)'", part, flags=re.S)
        if m:
            body = m.group(1).replace("''", "'")
            pieces.append(body.encode("latin-1", "backslashreplace").decode("unicode_escape"))
            continue
        m = re.fullmatch(r"(\$[A-Za-z_0-9]*\$)(.*)\1", part, flags=re.S)
        if m:
            pieces.append(m.group(2))
            continue
        return None
    return "".join(pieces)


def parse_insert(stmt: str) -> dict[str, str] | None:
    """``{column: raw value expression}`` for an ``INSERT INTO public.expert_bundles`` statement."""
    m = re.match(r"INSERT INTO public\.expert_bundles \(", stmt)
    if not m:
        return None
    cols_close = _matching_paren(stmt, m.end() - 1)
    cols = [c.strip() for c in stmt[m.end() : cols_close].split(",")]
    v = re.match(r"\s*VALUES \(", stmt[cols_close + 1 :])
    assert v, f"INSERT without a VALUES tuple: {stmt[:160]}"
    vals_open = cols_close + 1 + v.end() - 1
    vals_close = _matching_paren(stmt, vals_open)
    values = split_top_level(stmt[vals_open + 1 : vals_close], ",")
    assert len(cols) == len(values), (cols, values)
    row = dict(zip(cols, values))
    row["__tail__"] = stmt[vals_close + 1 :].strip()
    return row


def parse_update(stmt: str) -> tuple[dict[str, str], str] | None:
    """``({column: raw expression}, where_clause)`` for ``UPDATE public.expert_bundles``."""
    m = re.match(r"UPDATE public\.expert_bundles SET (.*) WHERE (.*)$", stmt, flags=re.S)
    if not m:
        return None
    sets: dict[str, str] = {}
    for assignment in split_top_level(m.group(1), ","):
        col, _, expr = assignment.partition("=")
        sets[col.strip()] = expr.strip()
    return sets, m.group(2).strip()


def seed_sql_files() -> list[Path]:
    """Every SQL file that seeds ``expert_bundles`` rows — derived, never a constant list."""
    files = [MIGRATIONS / "187_expert_bundles.sql"]
    files += sorted(PLANNING.rglob("269-candidate-bundles.sql"))
    files += sorted(MIGRATIONS.glob("198_*.sql"))
    return [f for f in files if f.is_file()]


def slugs_and_ids_from_sql(path: Path) -> tuple[set[str], set[str]]:
    slugs: set[str] = set()
    ids: set[str] = set()
    for stmt in split_sql(path.read_text(encoding="utf-8")):
        row = parse_insert(stmt)
        if row is not None:
            slug = eval_text(row.get("slug", ""))
            if slug and SLUG_RE.fullmatch(slug):
                slugs.add(slug)
            bid = eval_text(row.get("id", ""))
            if bid and UUID_RE.fullmatch(bid):
                ids.add(bid)
            continue
        upd = parse_update(stmt)
        if upd is not None:
            _, where = upd
            for s in re.findall(r"\bslug = '([a-z0-9-]+)'", where):
                slugs.add(s)
            for u in re.findall(r"\bid = '([0-9a-f-]{36})'", where):
                ids.add(u)
    ids.discard(SENTINEL_AUTHOR)
    return slugs, ids


def derived_needles() -> tuple[set[str], set[str]]:
    slugs = {p.name for p in CORPORA_ROOT.iterdir() if p.is_dir()}
    ids: set[str] = set()
    for f in seed_sql_files():
        s, i = slugs_and_ids_from_sql(f)
        slugs |= s
        ids |= i
    return slugs, ids


# ---------------------------------------------------------------------------------------------
# Scanners
# ---------------------------------------------------------------------------------------------


def _docstring_node_ids(tree: ast.AST) -> set[int]:
    out: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                out.add(id(body[0].value))
    return out


def scan_backend(needles: set[str], *, exclude_docstrings: bool = True) -> tuple[int, list[str]]:
    files = sorted(BACKEND_APP.rglob("*.py"))
    hits: list[str] = []
    for f in files:
        tree = ast.parse(f.read_text(encoding="utf-8-sig"), filename=str(f))
        skip = _docstring_node_ids(tree) if exclude_docstrings else set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in skip:
                low = node.value.lower()
                for needle in sorted(needles):
                    if needle in low:
                        rel = f.relative_to(REPO_ROOT).as_posix()
                        hits.append(f"{rel}:{node.lineno}: {needle!r}")
    return len(files), hits


def _frontend_files() -> list[Path]:
    files = [*FRONTEND_SRC.rglob("*.ts"), *FRONTEND_SRC.rglob("*.tsx")]
    return sorted(f for f in files if ".test." not in f.name and ".testutil." not in f.name)


def scan_frontend(slugs: set[str], ids: set[str]) -> tuple[int, list[tuple[str, int, str, str]]]:
    """``(file_count, [(rel_to_src, line_no, line_text, needle)])`` — quoted slugs, any id."""
    files = _frontend_files()
    slug_res = {s: re.compile(r"([\"'`])" + re.escape(s) + r"\1") for s in slugs}
    hits: list[tuple[str, int, str, str]] = []
    for f in files:
        rel = f.relative_to(FRONTEND_SRC).as_posix()
        for no, line in enumerate(f.read_text(encoding="utf-8-sig").splitlines(), start=1):
            for s, rx in slug_res.items():
                if rx.search(line):
                    hits.append((rel, no, line.strip(), s))
            low = line.lower()
            for i in ids:
                if i in low:
                    hits.append((rel, no, line.strip(), i))
    return len(files), hits


def _is_allowlisted(hit: tuple[str, int, str, str]) -> bool:
    rel, _, text, _ = hit
    return any(rel == a_rel and a_text in text for a_rel, a_text in FRONTEND_ALLOWLIST)


# ---------------------------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------------------------


def test_needle_set_is_derived_and_not_collapsed():
    slugs, ids = derived_needles()
    # The parser is proven to work on the one row that has existed since 259.
    assert "financial-analyzer" in slugs, slugs
    assert "00000000-0000-0000-0000-000000000259" in ids, ids
    assert SENTINEL_AUTHOR not in ids
    # Collapse guard: a fence over one Expert cannot see a starter-specific branch.
    assert len(slugs) >= 5, f"derived slug set collapsed: {sorted(slugs)}"
    assert len(ids) >= 5, f"derived id set collapsed: {sorted(ids)}"


def test_backend_app_has_no_starter_slug_or_bundle_id_outside_docstrings():
    slugs, ids = derived_needles()
    count, hits = scan_backend(slugs | ids)
    assert count > 100, f"scanned only {count} backend files — the scan root moved"
    assert not hits, (
        "Expert-specific literal(s) in production backend code — the install path must stay generic "
        "(D-269-08):\n" + "\n".join(hits)
    )


def test_backend_docstring_exclusion_is_load_bearing():
    """Positive control: WITHOUT the docstring exclusion the scanner finds db/experts.py's prose.

    Proves the AST scan can see a needle at all (non-vacuous) and that the exclusion — not an
    allowlist — is what keeps that docstring out.
    """
    _, hits = scan_backend({"financial-analyzer"}, exclude_docstrings=False)
    assert any(h.startswith("backend/app/db/experts.py:") for h in hits), hits


def test_frontend_src_has_no_starter_slug_literal_or_bundle_id():
    slugs, ids = derived_needles()
    count, hits = scan_frontend(slugs, ids)
    assert count > 100, f"scanned only {count} frontend files — the scan root moved"
    offending = [h for h in hits if not _is_allowlisted(h)]
    assert not offending, (
        "Expert-specific literal(s) in production frontend code (D-269-08):\n"
        + "\n".join(f"frontend/src/{r}:{n}: {s!r} in {t}" for r, n, t, s in offending)
    )


def test_frontend_allowlist_entry_still_exists():
    """The single allowlisted hit must still be present, or the allowlist has rotted silently."""
    slugs, ids = derived_needles()
    _, hits = scan_frontend(slugs, ids)
    for a_rel, a_text in FRONTEND_ALLOWLIST:
        assert any(r == a_rel and a_text in t for r, _, t, _ in hits), (
            f"allowlisted hit {a_rel} / {a_text} no longer exists — remove it from FRONTEND_ALLOWLIST"
        )
