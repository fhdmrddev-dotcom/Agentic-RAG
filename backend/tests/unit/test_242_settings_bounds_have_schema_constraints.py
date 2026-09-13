"""Phase 242 (SHIP-01, ROADMAP SC#3) — a bound that lives only in Python is not a bound.

⛔ WHAT THIS CATCHES, AND WHY IT WAS INVISIBLE.

`app_settings.multimodal_max_vision_calls` was bounded `1..1000` at `api/settings.py:467` and by
NOTHING ELSE. Migration 044 added the column with `DEFAULT 100` and no CHECK. So any writer that is
not that one endpoint — a psql session, a restored dump, a hand-edit in the Supabase SQL editor, a
future endpoint — could store a value the API would then refuse to accept back.

That is not hypothetical. It is what made the operator's local Search tab unsaveable: a stored
`1001` nobody typed, refusing every save on a tab where 22 other fields ride the same payload.

⚠ THE INSTANCE IS CHEAP TO FIX AND THE CLASS IS NOT. The next phase that adds a bounded settings
column in Python reproduces the identical outage, and no gate in this project would see it — the
bound is a Python `if`, the column is SQL, and nothing reads both.

**This test reads both.** It parses `api/settings.py` with `ast`, collects every numeric range
bound written as `lo <= body.<field> <= hi`, and requires each one to have a matching CHECK
constraint somewhere in `supabase/migrations/`.

⚠ THE MEASUREMENT THAT SHAPED IT. `242-CONTEXT.md` deferred "a CHECK on every other bounded
settings column" as "a phase, not a gap", naming five columns. Measured at HEAD against
`pg_constraint` on the live local database: THREE of them already had one —
`app_settings_source_max_file_size_mb_bounds` (migration 174) and
`app_settings_hnsw_ef_search_bounds` + `app_settings_hnsw_iterative_scan_values` (migration 176).
The real gap was two columns, and migration 178 closes both. So the allow-list below is EMPTY —
which is the only state in which a fence like this certifies anything.

RETIREMENT: this test retires when `api/settings.py` stops validating ranges inline — e.g. if the
bounds move into Pydantic `Field(ge=, le=)` constraints on `SettingsUpdate`. At that point the
detector below stops finding anything and §1 fails LOUDLY rather than passing vacuously. That is
deliberate: rewrite the detector for the new shape, never delete the requirement.
"""

import ast
import re
from pathlib import Path

import pytest

# backend/tests/unit/<this file>  →  parents[2] == backend/  →  parents[3] == repo root
_BACKEND = Path(__file__).resolve().parents[2]
_REPO = _BACKEND.parent
SETTINGS_PY = _BACKEND / "app" / "api" / "settings.py"
MIGRATIONS_DIR = _REPO / "supabase" / "migrations"


# ⛔ EMPTY, AND IT IS MEANT TO STAY EMPTY. Every numeric bound in settings.py has a matching CHECK
#    in supabase/migrations/ as of migration 178. An entry added here is a DEFERRAL and must carry
#    a reason and a seed id — never a silence. A fence with an unbounded exception list certifies
#    nothing, which is the whole reason this constant is a named module-level thing rather than an
#    inline `skip`.
#
#    ⚠ `retrieval_top_k` / `rrf_k` are NOT here because they carry no bound at all (measured at
#       settings.py:535-541 — a bare `is not None`). They are UNVALIDATED, which is a different and
#       arguably worse finding, and it is recorded in SEED-271 rather than hidden in an allow-list.
#    ⚠ `hnsw_iterative_scan` is an ENUM membership check (settings.py:624), not a numeric range, so
#       the detector below cannot see it by construction. It DOES have a CHECK
#       (`app_settings_hnsw_iterative_scan_values`, migration 176) — named here so its absence from
#       the detected set reads as a decision rather than a miss.
BOUNDS_WITHOUT_SCHEMA_CONSTRAINT: set[str] = set()


# Every numeric bound that ships today, as an EQUALITY rather than a subset — a new bound appearing
# without a decision reds §1 as well as §2.
EXPECTED_BOUNDED_FIELDS = {
    "multimodal_max_vision_calls",
    "vision_max_pages",
    "source_max_file_size_mb",
    "hnsw_ef_search",
}


# ──────────────────────────────────────────────────────────────────────────────────────────────
# The detector. ⚠ MATCHES ON AST SHAPE, NEVER ON A FORMATTED LINE — `source_max_file_size_mb`'s
# bound is split over four physical lines, so a regex over `:517` would miss it, and a detector
# that cannot see a bound is a fence that certifies nothing.
# ──────────────────────────────────────────────────────────────────────────────────────────────
def bounded_fields(source: str) -> set[str]:
    """Return every `<name>` validated as `if not <lo> <= body.<name> <= <hi>:`.

    This is the idiom `api/settings.py` uses at all four sites today. It is NARROW on purpose —
    `bounded_fields_loose` below is the shape-independent companion, and the pair is what makes
    the "a new bound reds this" claim honest rather than aspirational.
    """
    found: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.If):
            continue
        test = node.test
        if not (isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not)):
            continue
        compare = test.operand
        if not isinstance(compare, ast.Compare):
            continue
        if len(compare.ops) != 2 or not all(isinstance(op, ast.LtE) for op in compare.ops):
            continue
        middle = compare.comparators[0]
        if (
            isinstance(middle, ast.Attribute)
            and isinstance(middle.value, ast.Name)
            and middle.value.id == "body"
        ):
            found.add(middle.attr)
    return found


_LIMIT_NAME = re.compile(r"_(FLOOR|CEILING|MIN|MAX|LIMIT)$")
_ORDERING_OPS = (ast.Lt, ast.LtE, ast.Gt, ast.GtE)


def bounded_fields_loose(source: str) -> set[str]:
    """Every `body.<name>` compared with an ordering operator against a number or a limit constant.

    ⚠ THE NARROW DETECTOR ABOVE SEES EXACTLY ONE IDIOM, and a future phase has no obligation to
    use it. `if body.x < LO or body.x > HI:` and `if body.x > CEIL:` are both perfectly ordinary
    and would be INVISIBLE to it — so a fence built on the narrow detector alone would quietly
    stop working the first time someone wrote a bound a different way.

    This one matches any `ast.Compare` with an ordering op where one side is `body.<attr>` and
    another is a numeric literal or a `*_FLOOR` / `*_CEILING` / `*_MIN` / `*_MAX` / `*_LIMIT`
    name. It is deliberately over-eager relative to the narrow one; §2b only requires that
    anything it finds is EITHER constrained OR on the allow-list, which is the same contract.

    ⛔ STILL INVISIBLE, and stated rather than hoped away:
      · a bound expressed as a Pydantic `Field(ge=…, le=…)` on `SettingsUpdate`
        (`settings.py:172-239` is where such a bound would naturally go);
      · a bound that moves out of `api/settings.py` entirely;
      · a bound whose limits come from a name this regex does not match.
    If validation ever moves to Pydantic, §1 fails LOUDLY (the detected set empties) rather than
    passing vacuously. Rewrite the detector for the new shape; never delete the requirement.
    """
    found: set[str] = set()

    def _is_limit(node: ast.AST) -> bool:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return True
        if isinstance(node, ast.Name) and _LIMIT_NAME.search(node.id):
            return True
        return False

    def _body_attr(node: ast.AST) -> str | None:
        if (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "body"
        ):
            return node.attr
        return None

    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Compare):
            continue
        if not any(isinstance(op, _ORDERING_OPS) for op in node.ops):
            continue
        operands = [node.left, *node.comparators]
        names = [n for n in (_body_attr(o) for o in operands) if n]
        if names and any(_is_limit(o) for o in operands):
            found.update(names)
    return found


# ──────────────────────────────────────────────────────────────────────────────────────────────
# The constraint scanner. Comments are STRIPPED first, so a column named only in a `--` line never
# counts as constrained — §4 drives that.
# ──────────────────────────────────────────────────────────────────────────────────────────────
_CHECK_RE = re.compile(r"check\s*\((?:[^()]|\([^()]*\))*\)", re.IGNORECASE | re.DOTALL)


def _strip_sql_comments(sql: str) -> str:
    return "\n".join(line.split("--", 1)[0] for line in sql.splitlines())


def has_check_constraint(column: str, sources: list[str] | None = None) -> bool:
    """True when `column` appears inside a single balanced `CHECK ( … )` in any migration.

    ⚠ THE GRANULARITY IS THE WHOLE POINT. "the file contains a CHECK and also mentions the column"
    would read `176_app_settings_hnsw_knobs.sql` — which has CHECKs on two columns and prose about
    several others — as constraining columns it does not constrain. The regex below matches ONE
    `CHECK (…)` expression (one level of nesting, which is all these constraints use) and requires
    the column inside THAT expression.

    ⛔ WHAT IT CANNOT SEE, stated rather than assumed:
      · It reads the MIGRATION HISTORY, not the live schema. A CHECK added in migration N and
        dropped in N+1 still reads green here. The apply script asserts against `pg_constraint`,
        which is the half that reads the database.
      · It does not check the TABLE. A CHECK on some other table naming a same-named column counts.
      · It does not check that the SQL bound AGREES with the Python bound — `BETWEEN 1 AND 5000`
        would satisfy a Python `1..1000`. Agreement is asserted by reading the migration, not here.
    Each of these would need a live connection or a SQL parser; the fence's job is to make an
    ABSENT constraint impossible to miss, and that it does do.
    """
    if sources is None:
        sources = [p.read_text(encoding="utf-8") for p in sorted(MIGRATIONS_DIR.glob("*.sql"))]
    needle = re.compile(rf"\b{re.escape(column)}\b", re.IGNORECASE)
    for raw in sources:
        body = _strip_sql_comments(raw)
        for match in _CHECK_RE.finditer(body):
            if needle.search(match.group(0)):
                return True
    return False


@pytest.fixture(scope="module")
def detected() -> set[str]:
    return bounded_fields(SETTINGS_PY.read_text(encoding="utf-8"))


class TestTheDetectorSeesWhatShips:
    def test_the_premise_the_settings_module_is_readable(self):
        """A silently-missing path would make every case below vacuously green."""
        assert SETTINGS_PY.is_file(), f"settings.py not found at {SETTINGS_PY}"
        assert MIGRATIONS_DIR.is_dir(), f"migrations dir not found at {MIGRATIONS_DIR}"
        assert list(MIGRATIONS_DIR.glob("*.sql")), "no migrations found — the scanner would be blind"

    def test_every_shipped_bound_is_detected(self, detected):
        """§1 — an EQUALITY. A new bound appearing without a decision reds here too."""
        assert detected == EXPECTED_BOUNDED_FIELDS, (
            "the set of Python-side numeric bounds in api/settings.py changed.\n"
            f"  detected: {sorted(detected)}\n"
            f"  expected: {sorted(EXPECTED_BOUNDED_FIELDS)}\n"
            "If you ADDED a bound: give it a CHECK constraint in a migration (see 178 for the "
            "pattern) and add it here. If you REMOVED one, remove it here. If the validation moved "
            "to Pydantic Field(ge=, le=), rewrite the detector for that shape — never delete this."
        )

    def test_the_detector_would_see_a_brand_new_bound(self):
        """§3 — the positive control. Without it, §2 could be green because it finds nothing."""
        synthetic = (
            "def f(body):\n"
            "    if body.brand_new_knob is not None:\n"
            "        if not 1 <= body.brand_new_knob <= 9:\n"
            "            raise HTTPException(status_code=400, detail='nope')\n"
        )
        assert "brand_new_knob" in bounded_fields(synthetic)

    def test_the_detector_ignores_a_bare_none_check(self):
        """The negative control on §3: `is not None` is NOT a bound and must not be counted."""
        synthetic = (
            "def f(body):\n"
            "    if body.unvalidated_knob is not None:\n"
            "        updates['unvalidated_knob'] = body.unvalidated_knob\n"
        )
        assert bounded_fields(synthetic) == set()

    def test_the_detector_ignores_a_multiline_bound_on_something_other_than_body(self):
        """Only `body.<x>` is a request field. A local variable comparison is not a bound."""
        synthetic = "def f(n):\n    if not 1 <= n <= 9:\n        raise ValueError\n"
        assert bounded_fields(synthetic) == set()


class TestTheScannerCanSayNo:
    """§4 — without this class the scanner could be returning True for everything."""

    def test_it_finds_a_constraint_that_provably_exists(self):
        # migration 174: app_settings_source_max_file_size_mb_bounds
        assert has_check_constraint("source_max_file_size_mb") is True

    def test_it_refuses_a_column_that_has_none(self):
        assert has_check_constraint("no_such_column_anywhere_in_this_repo") is False

    def test_a_column_named_only_in_a_comment_does_not_count(self):
        sources = [
            "-- CHECK (ghost_column >= 1 AND ghost_column <= 10)  -- documented, never applied\n"
            "ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS ghost_column integer;\n"
        ]
        assert has_check_constraint("ghost_column", sources=sources) is False

    def test_the_same_column_DOES_count_once_the_comment_marker_is_gone(self):
        """The mirror of the case above — proves the comment stripping is what made it False."""
        sources = ["ALTER TABLE t ADD CONSTRAINT c CHECK (ghost_column >= 1 AND ghost_column <= 10);"]
        assert has_check_constraint("ghost_column", sources=sources) is True


class TestEveryBoundIsAlsoAConstraint:
    """§2 — THE FENCE PROPER."""

    def test_no_python_bound_lacks_a_schema_constraint(self, detected):
        unguarded = sorted(
            f
            for f in detected
            if f not in BOUNDS_WITHOUT_SCHEMA_CONSTRAINT and not has_check_constraint(f)
        )
        assert unguarded == [], (
            "these settings columns are bounded in Python and by NOTHING in the schema, so any "
            "other writer can store a value the API will then refuse to accept back — which is "
            "exactly how the Search tab became unsaveable (SHIP-01):\n"
            + "\n".join(f"  · app_settings.{f}" for f in unguarded)
            + "\n\nTwo ways out, and only two:\n"
            "  1. Add a CHECK constraint in a numbered migration. Copy migration 178: clamp any "
            "out-of-range row FIRST (a CHECK cannot be added while a row violates it), then "
            "DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT so the file is re-runnable, and permit "
            "NULL so _val()'s config fallback still works.\n"
            "  2. Add it to BOUNDS_WITHOUT_SCHEMA_CONSTRAINT above WITH a written reason and a "
            "seed id. A deferral that is invisible to the scan is a deletion that looks like a "
            "decision."
        )

    def test_the_two_columns_migration_178_closes(self, detected):
        """§6 — the instances. ⚠ RED before 178 exists; that red was seen and recorded."""
        for column in ("multimodal_max_vision_calls", "vision_max_pages"):
            assert column in detected, f"{column} is no longer bounded in settings.py"
            assert column not in BOUNDS_WITHOUT_SCHEMA_CONSTRAINT
            assert has_check_constraint(column), (
                f"app_settings.{column} has no CHECK constraint in supabase/migrations/ — "
                "migration 178 is supposed to add it"
            )

    def test_no_loosely_detected_bound_lacks_a_schema_constraint(self):
        """§2b — the same contract, over the SHAPE-INDEPENDENT detector.

        ⚠ This is the case that survives someone writing the next bound as
        `if body.x < LO or body.x > HI:`. The narrow detector would not see it at all, so §2 would
        stay green over an unconstrained column.
        """
        loose = bounded_fields_loose(SETTINGS_PY.read_text(encoding="utf-8"))
        unguarded = sorted(
            f
            for f in loose
            if f not in BOUNDS_WITHOUT_SCHEMA_CONSTRAINT and not has_check_constraint(f)
        )
        assert unguarded == [], (
            "these request fields are compared against a numeric limit in api/settings.py and "
            "have no CHECK constraint in supabase/migrations/:\n"
            + "\n".join(f"  · {f}" for f in unguarded)
            + "\n\nIf one of these is not actually a settings COLUMN (a comparison against a "
            "length, a count, a timestamp), say so by name in BOUNDS_WITHOUT_SCHEMA_CONSTRAINT "
            "with the reason — the loose detector is deliberately over-eager and a false positive "
            "is answered by writing down why, never by narrowing it silently."
        )

    def test_the_loose_detector_sees_a_bound_written_the_other_way(self):
        """The positive control for §2b — otherwise it could be green because it finds nothing.

        ⭐ §3's control uses the SAME idiom as the narrow detector, so it says nothing about the
        other shapes. This one uses a shape the narrow detector provably cannot see.
        """
        synthetic = (
            "def f(body):\n"
            "    if body.other_knob < 1 or body.other_knob > 99:\n"
            "        raise HTTPException(status_code=400, detail='nope')\n"
            "    if body.ceilinged_knob > SOME_CEILING:\n"
            "        raise HTTPException(status_code=400, detail='nope')\n"
        )
        assert bounded_fields(synthetic) == set(), "the narrow detector should NOT see these"
        assert bounded_fields_loose(synthetic) == {"other_knob", "ceilinged_knob"}

    def test_the_loose_detector_covers_the_narrow_one(self):
        """Anything the narrow detector finds, the loose one must also find."""
        source = SETTINGS_PY.read_text(encoding="utf-8")
        narrow = bounded_fields(source)
        loose = bounded_fields_loose(source)
        assert narrow <= loose, f"narrow found {sorted(narrow - loose)} that loose missed"

    def test_every_allow_list_entry_genuinely_lacks_a_constraint(self):
        """§5b — AN ENTRY THAT IS ALREADY CONSTRAINED IS AN EXEMPTION NOBODY NEEDED.

        ⚠ This case exists because the first draft of this phase's plan exempted THREE columns on
        the strength of `242-CONTEXT.md`'s deferred list — and two of them
        (`source_max_file_size_mb`, `hnsw_ef_search`) already had CHECK constraints from migrations
        174 and 176. §5 could not have caught that: it only asserts an entry is a real BOUND, never
        that it genuinely LACKS a constraint. Without this case an allow-list can accumulate
        already-constrained columns forever and read as a deferral backlog that is mostly fiction.
        """
        needless = sorted(f for f in BOUNDS_WITHOUT_SCHEMA_CONSTRAINT if has_check_constraint(f))
        assert needless == [], (
            f"{needless} are on the allow-list but ALREADY have CHECK constraints. Remove them — "
            "an exemption nobody needs makes the deferral backlog look larger than it is, and the "
            "fence weaker than it is."
        )

    def test_the_allow_list_holds_no_dead_entries(self, detected):
        """§5 — an entry that no longer names a real bound is dead and must be removed."""
        dead = sorted(BOUNDS_WITHOUT_SCHEMA_CONSTRAINT - detected)
        assert dead == [], (
            f"BOUNDS_WITHOUT_SCHEMA_CONSTRAINT names {dead}, which api/settings.py no longer "
            "bounds. Remove the entry — a stale exception silently widens the fence."
        )

    def test_the_allow_list_is_empty_and_the_fence_has_no_exceptions(self):
        """⭐ The state SC#3 asks for, asserted rather than assumed.

        This is not a tautology over the constant above: it is the fact that makes §2 meaningful.
        If a future phase adds an entry, THIS case is the one that forces them to come here and
        change the sentence deliberately.
        """
        assert BOUNDS_WITHOUT_SCHEMA_CONSTRAINT == set(), (
            "the fence now has exceptions: "
            f"{sorted(BOUNDS_WITHOUT_SCHEMA_CONSTRAINT)}. That may be correct — but say so here, "
            "with the reason and the seed id, so the next reader knows it was a decision."
        )
