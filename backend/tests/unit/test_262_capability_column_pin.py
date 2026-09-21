"""Phase 262 — the capability registry's layers, pinned EQUAL in both directions.

⭐ WHY THIS FILE EXISTS. Migration 190 makes twelve of `ModelCapability`'s fifteen fields
settable from the Model Registry, so that a new model's quirk is a row edit instead of a
commit. That only holds while the layers describing a capability AGREE. They are:

    SQL CHECK (migration 190)  <->  config.API_SURFACES / the ModelCapability Literal
                               <->  admin._MODEL_CAP_ENUM_COLUMNS
                               <->  dispatcher._SURFACE_ADAPTERS  (for api_surface)

⛔ DRIFT HERE IS SILENT, WHICH IS THE ONLY REASON A TEST IS NEEDED RATHER THAN A COMMENT.
A surface the CHECK accepts but no adapter serves does not raise: `resolve_api_surface`
returns it, the dispatcher's map misses, and without the guard the request falls through to
chat.completions. The operator sets the field, the write succeeds, the audit row is written
— and the model is called on the old endpoint anyway. Migration 120 recorded the identical
failure for `emit_tier`, where an unrecognised tier was rewritten to "coerce" with no
exception, no audit row and no log line.

⚠ THE EQUALITIES ARE TWO-DIRECTIONAL ON PURPOSE. A subset check in either direction passes
while a layer quietly lags, and "the CHECK is a superset" is exactly the state that ships a
dropdown option that does nothing.

The SQL is read from the migration FILE rather than from a live database: this is a unit
test, it must run in CI with no Postgres, and the file is the artifact that gets pasted into
the SQL editor. ⚠ That means it pins what the migration SAYS, not what the live DB HAS —
applying the migration stays an operator step, and this test cannot prove it happened.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.api.admin import _MODEL_CAP_BOOL_COLUMNS, _MODEL_CAP_COLUMNS, _MODEL_CAP_ENUM_COLUMNS, _MODEL_CAP_INT_COLUMNS
from app.config import API_SURFACES, ModelCapability
from app.services.provider_gateway.dispatcher import _SURFACE_ADAPTERS

MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "190_model_capabilities_overrides_full_capability_surface.sql"
)

# Every column migration 190 adds, and the Python name it overlays onto.
NEW_COLUMNS = (
    "api_surface",
    "reasoning_first",
    "reasoning_off",
    "uses_max_completion_tokens",
    "supports_parallel_tools",
    "max_tools",
)


def _migration_sql() -> str:
    assert MIGRATION.exists(), f"migration missing at {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _check_vocabulary(sql: str, column: str) -> set[str]:
    """Pull the literal set out of a ``CHECK (col IS NULL OR col IN ('a','b'))`` clause."""
    pattern = re.compile(
        rf"CHECK\s*\(\s*{column}\s+IS\s+NULL\s+OR\s+{column}\s+IN\s*\(([^)]*)\)",
        re.IGNORECASE,
    )
    match = pattern.search(sql)
    assert match, f"no CHECK vocabulary found for {column} in migration 190"
    return {lit.strip().strip("'") for lit in match.group(1).split(",") if lit.strip()}


def _literal_values(field: str) -> set[str]:
    """The string literals of a ``Literal[...]`` annotation on ModelCapability."""
    annotation = ModelCapability.__annotations__[field]
    return set(getattr(annotation, "__args__", ()))


# ── The columns exist, in every layer that must know about them ───────────────


@pytest.mark.parametrize("column", NEW_COLUMNS)
def test_every_new_column_is_added_by_the_migration(column):
    assert f"ADD COLUMN IF NOT EXISTS {column}" in _migration_sql()


@pytest.mark.parametrize("column", NEW_COLUMNS)
def test_every_new_column_is_writable_through_the_patch_guard(column):
    """A column with no guard entry is 422'd before the DB — i.e. unreachable from the UI.

    That is the state all six were in before this phase, and it is indistinguishable from
    the column not existing.
    """
    assert column in _MODEL_CAP_COLUMNS


@pytest.mark.parametrize("column", NEW_COLUMNS)
def test_every_new_column_is_overlaid_by_the_async_capability_read(column):
    """⛔ The overlay list is what actually makes a stored value take effect.

    A column that exists, is writable and is NOT in this list reads back as NULL forever: the
    operator sets it, the row stores it, and nothing ever consults it. `grep` the source
    rather than call the function, because calling it needs a DB.
    """
    import app.config as config_module

    source = Path(config_module.__file__).read_text(encoding="utf-8")
    overlay = source.split("def get_model_capability_async")[1].split("return get_model_capability")[0]
    assert f'"{column}"' in overlay


@pytest.mark.parametrize("column", NEW_COLUMNS)
def test_every_new_column_has_a_type_guard(column):
    """Each column is in exactly ONE type bucket, so a wrong-typed value is 422 not 500."""
    buckets = [
        column in _MODEL_CAP_INT_COLUMNS,
        column in _MODEL_CAP_BOOL_COLUMNS,
        column in _MODEL_CAP_ENUM_COLUMNS,
    ]
    assert sum(buckets) == 1, f"{column} must be in exactly one type bucket, got {buckets}"


# ── api_surface: four layers, pinned equal in both directions ─────────────────


def test_api_surface_sql_check_equals_the_config_vocabulary():
    assert _check_vocabulary(_migration_sql(), "api_surface") == set(API_SURFACES)


def test_api_surface_admin_guard_equals_the_config_vocabulary():
    assert _MODEL_CAP_ENUM_COLUMNS["api_surface"] == set(API_SURFACES)


def test_every_surface_in_the_vocabulary_has_an_adapter():
    """⛔ THE EQUALITY THAT MATTERS MOST — and the direction people forget.

    A vocabulary value with no adapter is a dropdown option that silently does nothing. A
    registered adapter absent from the vocabulary is unreachable: no operator can select it
    and no CHECK will accept it. Both are failures, so this is an equality, not a subset.
    """
    assert set(_SURFACE_ADAPTERS) == set(API_SURFACES)


def test_every_registered_adapter_actually_imports_and_exposes_its_opener():
    """A map entry naming a module that does not exist fails at REQUEST time, in production.

    Importing each one here moves that failure to CI.
    """
    from importlib import import_module

    for surface, module_name in _SURFACE_ADAPTERS.items():
        module = import_module(
            f"app.services.provider_gateway.{module_name}"
        )
        opener = getattr(module, f"open_{module_name}_stream", None)
        assert callable(opener), f"adapter for {surface!r} exposes no callable opener"


def test_an_unregistered_surface_raises_rather_than_falling_back():
    """⛔ Silence is the failure mode. A fallback would call the old endpoint and say nothing."""
    from app.services.provider_gateway.dispatcher import _open_surface_stream

    with pytest.raises(ValueError, match="No gateway adapter is registered"):
        _open_surface_stream("a-surface-nobody-implemented", None)


# ── reasoning_off: three layers ──────────────────────────────────────────────


def test_reasoning_off_sql_check_equals_the_config_literal():
    assert _check_vocabulary(_migration_sql(), "reasoning_off") == _literal_values("reasoning_off")


def test_reasoning_off_admin_guard_equals_the_config_literal():
    assert _MODEL_CAP_ENUM_COLUMNS["reasoning_off"] == _literal_values("reasoning_off")


# ── The headline claim, asserted as a number ─────────────────────────────────


def test_the_registry_can_express_most_of_the_capability_type():
    """⭐ THE POINT OF THE PHASE, stated as an assertion rather than a paragraph.

    Before migration 190 the registry could express 6 of ModelCapability's 15 fields; a model
    needing any of the other 9 could not be added from the UI at all, so the fact had to be a
    code branch. `api_surface` is the proof it mattered: gpt-5.6 needed a different endpoint
    to use tools, no field could say so, and the branch that landed gave native tool calling
    up for months.

    ⚠ THE THREE STILL UNREACHABLE ARE DELIBERATE, NOT AN OVERSIGHT, and naming them here is
    what stops the gap being rediscovered as a surprise:
      * `provider`          — a row column already, not a capability overlay
      * `capability_source` — DERIVED ("registry"/"inferred"/"db_override"); an operator
                              asserting it would be asserting where their own row came from
      * `forced_emission` / `strict_json_schema` — DEPRECATED by `emit_tier` (D-122-04), and
                              re-exposing them would resurrect the two-bool guess it replaced
    """
    overlayable = {
        "llm_call_timeout_seconds",
        "max_output_tokens",
        "native_tools",
        "deprecated",
        "emit_tier",
        *NEW_COLUMNS,
    }
    declared = set(ModelCapability.__annotations__)
    unreachable = declared - overlayable - {"context_window_tokens"}

    assert unreachable == {
        "provider",
        "capability_source",
        "forced_emission",
        "strict_json_schema",
    }, f"the unreachable set changed: {sorted(unreachable)}"
