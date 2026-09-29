"""Phase 268 (METER-08 / D-268-19 / T-268-02) — EVERY ``insert_run(`` call site, with a disposition each.

A ``runs`` row is born in exactly one writer, ``app.db.runs.insert_run``, and from 268 on that
writer stamps ``expert_attributed = true`` in SQL. What it cannot decide is WHICH Expert a root
run ran with — only the caller knows. So every caller must have been looked at by someone and
classified:

  STAMP                 — passes ``org_id=`` and ``expert_id=`` (the Deep chat send path, via
                          ``run_lifecycle.register_run_start``; the value is
                          ``ThreadScoping.born_for_bundle_id``, access-checked).
  COPY-PARENT(SQL)      — a sub-agent row: ``parent_run_id=`` is passed and the SQL inside
                          ``insert_run`` copies the parent's org / Expert / attributed flag.
                          The call site passes neither ``org_id`` nor ``expert_id``.
  NO-EXPERT(...)        — a harness / eval / golden / resume shell: no Expert is ever
                          resolved on these paths (the 264 fence pins that), so the row is
                          ``(expert_id NULL, expert_attributed true)`` = "No Expert".

⚠ THE 257 FIVE-SITE LESSON, MADE EXECUTABLE. Phase 257 fixed the spend query at the sites it
remembered and shipped a sixth it did not. A disposition map keyed ``file:ordinal`` means a NEW
call — including a second call in a file that already has one — fails this fence until someone
decides its attribution. Asserted as a SET, never a count.

⚠ THE ALIAS TRAP, MEASURED. ``api/runs.py`` imports ``insert_run as _insert_run`` (inside a
function) and calls ``await _insert_run(``. A regex copied from the 256 ``forced_emit`` fence
would miss that site entirely. This fence walks the AST and resolves every
``from app.db.runs import insert_run [as X]`` — module-level or function-local — before it
matches a call.

⛔ OUT OF THIS FENCE'S REACH, NAMED RATHER THAN SILENT: ``api/test_fixtures.py`` (a test-only
route) inserts ``runs`` rows through the supabase client's ``.insert``, not ``insert_run``. Those
rows take the column default ``expert_attributed = false`` ("Not recorded"), which is honest for
a fixture. Any OTHER ``supabase.table("runs").insert`` would equally be invisible here.
"""
from __future__ import annotations

import ast
import pathlib

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"

#: D-268-19. Keyed ``<file relative to backend/app>:<1-based ordinal of the call in that file>``.
_EXPECTED_INSERT_RUN_SITES: dict[str, str] = {
    "services/run_lifecycle.py:1": "STAMP (register_run_start: org_id + expert_id from send_message)",
    "services/task_service.py:1": "COPY-PARENT(SQL) (sub-agent: parent_run_id; the SQL copies org/Expert)",
    "api/runs.py:1": "NO-EXPERT(harness continue shell, model='unknown')",
    "services/harness_engine.py:1": "NO-EXPERT(resume shell: boot sweep / ask_user re-drive / scheduler)",
    "services/harness/publish_service.py:1": "NO-EXPERT(golden-run shell)",
    "api/evals.py:1": "NO-EXPERT(eval run companion)",
    "api/evals.py:2": "NO-EXPERT(eval run companion)",
    "api/evals.py:3": "NO-EXPERT(eval run companion)",
}

_WRITER_MODULE_SUFFIX = "db.runs"


def _insert_run_aliases(tree: ast.AST) -> set[str]:
    """Every local name bound to ``app.db.runs.insert_run`` anywhere in the module."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and (node.module or "").endswith(_WRITER_MODULE_SUFFIX):
            for alias in node.names:
                if alias.name == "insert_run":
                    names.add(alias.asname or alias.name)
    return names


def _insert_run_calls(src: str, filename: str = "<src>") -> list[ast.Call]:
    tree = ast.parse(src, filename=filename)
    aliases = _insert_run_aliases(tree) | {"insert_run"}
    calls: list[ast.Call] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        f = node.func
        if isinstance(f, ast.Name) and f.id in aliases:
            calls.append(node)
        elif isinstance(f, ast.Attribute) and f.attr == "insert_run":
            calls.append(node)
    return sorted(calls, key=lambda c: (c.lineno, c.col_offset))


def _measured_sites(overrides: dict[str, str] | None = None) -> dict[str, ast.Call]:
    """``{file:ordinal: Call}`` over backend/app, excluding the writer's own module.

    ``overrides`` replaces a file's source in memory — the plant drive below uses it so the
    fence can be driven RED without touching a tracked file.
    """
    overrides = overrides or {}
    out: dict[str, ast.Call] = {}
    for path in sorted(APP_DIR.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(APP_DIR).as_posix()
        if rel == "db/runs.py":
            continue
        # utf-8-sig: measured — services/email_extraction_service.py carries a BOM, and a
        # plain utf-8 read hands ast.parse a U+FEFF it rejects.
        src = overrides.get(rel) or path.read_text(encoding="utf-8-sig")
        for i, call in enumerate(_insert_run_calls(src, filename=rel), start=1):
            out[f"{rel}:{i}"] = call
    return out


def _kwargs(call: ast.Call) -> set[str]:
    return {k.arg for k in call.keywords if k.arg}


def test_every_insert_run_call_site_carries_a_disposition():
    measured = set(_measured_sites())
    expected = set(_EXPECTED_INSERT_RUN_SITES)
    assert measured == expected, (
        "the `insert_run(` call-site SET changed.\n"
        f"  appeared (needs a disposition): {sorted(measured - expected)}\n"
        f"  vanished: {sorted(expected - measured)}\n"
        "Every site must be classified STAMP / COPY-PARENT(SQL) / NO-EXPERT(...) (D-268-19). "
        "An unclassified site writes `expert_attributed = true` with whatever Expert it did or "
        "did not pass — the spend view would then call its runs 'No Expert' on nobody's decision."
    )
    assert all(v.strip() for v in _EXPECTED_INSERT_RUN_SITES.values()), "a blank disposition is not one"


def test_the_alias_site_is_seen_not_skipped():
    """``api/runs.py`` calls ``_insert_run`` — a regex fence would miss it. This one must not."""
    sites = _measured_sites()
    assert "api/runs.py:1" in sites
    call = sites["api/runs.py:1"]
    assert isinstance(call.func, ast.Name) and call.func.id == "_insert_run"


def test_each_disposition_matches_what_the_call_actually_passes():
    """A disposition is a claim about the call; check the claim against the call's keywords."""
    sites = _measured_sites()
    for key, disposition in _EXPECTED_INSERT_RUN_SITES.items():
        kw = _kwargs(sites[key])
        if disposition.startswith("STAMP"):
            assert {"org_id", "expert_id"} <= kw, f"{key} is STAMP but passes {sorted(kw)}"
        elif disposition.startswith("COPY-PARENT"):
            assert "parent_run_id" in kw, f"{key} is COPY-PARENT but passes no parent_run_id"
            assert "expert_id" not in kw and "org_id" not in kw, (
                f"{key} is COPY-PARENT — the SQL copies the parent; a call-site value would be a "
                "second source that can disagree with it"
            )
        elif disposition.startswith("NO-EXPERT"):
            assert "expert_id" not in kw, f"{key} is NO-EXPERT but passes expert_id"
        else:  # pragma: no cover — the map itself is malformed
            raise AssertionError(f"{key}: unknown disposition {disposition!r}")


def test_a_planted_extra_call_fails_the_fence():
    """The fence is driven, not assumed: plant a fourth call into evals.py (in memory)."""
    rel = "api/evals.py"
    src = (APP_DIR / rel).read_text(encoding="utf-8-sig")
    planted = src + (
        "\n\nasync def _planted_268(pool):\n"
        "    await insert_run(pool, run_id=None, thread_id=None, user_id=None,\n"
        "                     status='streaming', model='m', provider='p')\n"
    )
    measured = set(_measured_sites({rel: planted}))
    extra = measured - set(_EXPECTED_INSERT_RUN_SITES)
    assert extra == {"api/evals.py:4"}, f"the plant was not seen: {sorted(extra)}"


def test_a_planted_aliased_call_fails_the_fence():
    """The alias arm, driven: a function-local ``import ... as`` in a file with no site today."""
    rel = "services/run_producer.py"
    src = (APP_DIR / rel).read_text(encoding="utf-8-sig")
    planted = src + (
        "\n\nasync def _planted_268_alias(pool):\n"
        "    from app.db.runs import insert_run as _ir  # noqa: PLC0415\n"
        "    await _ir(pool, run_id=None, thread_id=None, user_id=None,\n"
        "              status='streaming', model='m', provider='p')\n"
    )
    measured = set(_measured_sites({rel: planted}))
    assert measured - set(_EXPECTED_INSERT_RUN_SITES) == {"services/run_producer.py:1"}



# ── 268-REVIEW WR-06 — an ORG-LESS ROOT insert must be justified ─────────────────────────────────────────
#
# D-268-07 fixed the send path's org only. A root row with no ``org_id`` falls to the mig-106 trigger's
# ``org_members … LIMIT 1`` guess, and ``insert_run``'s parent copy then moves EVERY sub-agent under it
# into the same org — so a two-org user's harness spend shows in the other org's cockpit. Every root site
# (no ``parent_run_id=``) must pass ``org_id=`` or be named here with the reason it does not.
_ORG_LESS_ROOT_JUSTIFIED: dict[str, str] = {
    "api/evals.py:1": "ORG-TRIGGER (named gap, not WR-06's three shells): eval thread + run both take the trigger's org",
    "api/evals.py:2": "ORG-TRIGGER (named gap, not WR-06's three shells): eval thread + run both take the trigger's org",
    "api/evals.py:3": "ORG-TRIGGER (named gap, not WR-06's three shells): eval thread + run both take the trigger's org",
}


def test_an_org_less_root_insert_must_be_justified():
    sites = _measured_sites()
    org_less_roots = {
        key for key, call in sites.items()
        if "parent_run_id" not in _kwargs(call)
        or any(k.arg == "parent_run_id" and isinstance(k.value, ast.Constant) and k.value.value is None
               for k in call.keywords)
        if "org_id" not in _kwargs(call)
    }
    unjustified = sorted(org_less_roots - set(_ORG_LESS_ROOT_JUSTIFIED))
    assert unjustified == [], (
        f"root `insert_run(` sites with no org_id and no justification: {unjustified} — the row and every "
        "sub-agent under it take the trigger's LIMIT-1 org (268-REVIEW WR-06)"
    )
    stale = sorted(set(_ORG_LESS_ROOT_JUSTIFIED) - org_less_roots)
    assert stale == [], f"a justified site now passes org_id — drop its entry: {stale}"
