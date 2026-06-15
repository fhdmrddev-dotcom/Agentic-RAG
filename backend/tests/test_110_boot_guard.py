"""Phase 110 SC#3 (boot half) — boot drift guard raises on a desynced CHECK.

Unit test (NOT integration — no live DB). Constructs a STUB pool whose
``fetchrow`` returns a fabricated ``pg_get_constraintdef`` def MISSING one of the
19 types, and asserts ``assert_action_types_synced(stub)`` raises RuntimeError.
Second case: ``fetchrow`` returns None (constraint absent → migration not
applied) → also raises. The stub IS the point — it proves the guard fires
before a real boot crash, with no DB dependency.
"""

import pytest


class _StubPool:
    """Minimal async pool stub exposing only ``fetchrow``."""

    def __init__(self, def_str):
        self._def = def_str

    async def fetchrow(self, *_args, **_kwargs):
        if self._def is None:
            return None
        return {"def": self._def}


# A constraintdef rendering all 19 types EXCEPT 'metadata.field.create' (one
# missing → frozenset is NOT a subset → must raise).
_TYPES_MISSING_ONE = [
    "document.upload", "document.delete", "search.query", "code.execute",
    "skill.load", "thread.create", "thread.delete", "settings.update",
    "memory.remember", "memory.recall", "feedback.submit",
    "view.create", "view.delete", "relationship.create", "relationship.delete",
    "classification.apply", "classification.rule.create", "metadata.update",
    # 'metadata.field.create' deliberately OMITTED
]
_DEF_MISSING_ONE = (
    "CHECK ((action_type = ANY (ARRAY["
    + ", ".join(f"'{t}'::text" for t in _TYPES_MISSING_ONE)
    + "])))"
)

# A complete constraintdef rendering all 19 types (the synced case → no raise).
_ALL_19 = _TYPES_MISSING_ONE + ["metadata.field.create"]
_DEF_ALL_19 = (
    "CHECK ((action_type = ANY (ARRAY["
    + ", ".join(f"'{t}'::text" for t in _ALL_19)
    + "])))"
)


@pytest.mark.asyncio
async def test_boot_guard_raises_on_missing_type():
    """A live CHECK missing one frozenset type → RuntimeError (the dangerous drift)."""
    from app.services.audit_service import assert_action_types_synced
    with pytest.raises(RuntimeError):
        await assert_action_types_synced(_StubPool(_DEF_MISSING_ONE))


@pytest.mark.asyncio
async def test_boot_guard_raises_when_constraint_absent():
    """fetchrow returns None (constraint absent / migration 071 not applied) → RuntimeError."""
    from app.services.audit_service import assert_action_types_synced
    with pytest.raises(RuntimeError):
        await assert_action_types_synced(_StubPool(None))


@pytest.mark.asyncio
async def test_boot_guard_passes_when_synced():
    """A live CHECK carrying all 19 types → no raise (frozenset is a subset)."""
    from app.services.audit_service import assert_action_types_synced
    await assert_action_types_synced(_StubPool(_DEF_ALL_19))  # must NOT raise


@pytest.mark.asyncio
async def test_boot_guard_ignores_extra_db_type():
    """A DB type NOT in the frozenset is harmless (no writer) — must NOT raise."""
    from app.services.audit_service import assert_action_types_synced
    def_with_extra = (
        "CHECK ((action_type = ANY (ARRAY["
        + ", ".join(f"'{t}'::text" for t in _ALL_19 + ["future.unused.type"])
        + "])))"
    )
    await assert_action_types_synced(_StubPool(def_with_extra))  # must NOT raise
