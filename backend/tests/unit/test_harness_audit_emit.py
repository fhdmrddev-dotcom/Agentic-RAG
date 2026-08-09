"""Phase 101.1 (D-12) — the ``harness_audit`` emit-kind extension + receipt shape.

Wave 0 RED stubs. These two tests are satisfied by THIS plan's Task 3 (migration 069
ALTERs the event_type CHECK + ``_AUDIT_EVENT_TYPES`` is extended in lockstep). Task 1
marks them ``xfail(strict=False)`` so the suite exits 0 BEFORE Task 3; Task 3 un-marks
them to GREEN.

Both tests run OFFLINE — ``test_write_audit_accepts_emit_kinds`` asserts the in-process
fail-fast frozenset (NOT a live DB write); ``test_receipt_metadata_shape`` asserts the
RESEARCH §4 receipt keys against a hand-built dict.

CONVENTION: ``from app... import ...`` is INSIDE each test body so a not-yet-existing
symbol never breaks COLLECTION.
"""

from __future__ import annotations

# The 7 emit-transition kinds migration 069 adds to the CHECK (lockstep with
# _AUDIT_EVENT_TYPES). RESEARCH §4 / D-12.
_EMIT_KINDS = [
    "emit_forced",
    "emit_recovered",
    "emit_validated",
    "emit_rejected",
    "emit_rendered",
    "emit_integrity_failed",
    "emit_failed",
]


def test_write_audit_accepts_emit_kinds():
    """After migration 069 + the ``_AUDIT_EVENT_TYPES`` extension, every emit kind is
    accepted by ``write_audit``'s fail-fast guard (no ``ValueError`` raised). The guard
    asserts membership BEFORE any DB call, so this runs offline."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    for kind in _EMIT_KINDS:
        assert kind in _AUDIT_EVENT_TYPES, f"emit kind {kind!r} missing from _AUDIT_EVENT_TYPES"

    # The 9 pre-existing kinds are still present (the ALTER is additive).
    for kind in (
        "phase_started",
        "phase_completed",
        "phase_transition",
        "gate_passed",
        "gate_failed",
        "tool_refused",
        "run_started",
        "run_completed",
        "run_failed",
    ):
        assert kind in _AUDIT_EVENT_TYPES

    # 9 (059) + 7 emit (069) + 6 judge/publish (070, Phase 102)
    #   + 1 armed action-risk pause (114, Phase 185 / BUG-260731-02)
    #   + 1 send receipt (117, Phase 190 CONN-02/CONN-03) = 24 total kinds.
    # The 069 emit kinds are still all present (the 070, 114 and 117 ALTERs are all
    # additive); this count is bumped in lockstep with the _AUDIT_EVENT_TYPES extension.
    # The guard that keeps the Python set equal to the SQL CHECK — so a kind can never
    # again be emitted while unregistered — is tests/unit/test_audit_event_registration.py.
    assert len(_AUDIT_EVENT_TYPES) == 24


def test_receipt_metadata_shape():
    """The D-12 emit-receipt metadata (RESEARCH §4) carries the substrate keys
    Phase 107 reads: tier / provider / raw field-map / gate verdict / integrity verdict
    / output file hash, keyed to definition@version. Asserted against a hand-built dict
    (offline — no live write)."""
    from app.db.workflows import _AUDIT_EVENT_TYPES

    # A representative terminal emit_validated receipt (RESEARCH §4 shape).
    receipt = {
        "definition_version": 3,
        "definition_id": "00000000-0000-0000-0000-0000000101a0",
        "phase_slug": "fill",
        "emitter": "render_template",
        "tier": "TIER-FORCE",
        "provider": "anthropic",
        "model": "claude-opus-4-8",
        "forced": True,
        "thinking": False,
        "recovered_from_narration": False,
        "retrieved_ids": ["chunk-0"],
        "field_map": {"scalars": [], "rows": []},
        "gate_verdict": {
            "covers_template": True,
            "citation_coverage_pct": 100.0,
            "uncited_value_count": 0,
            "invented_citation_count": 0,
        },
        "integrity_verdict": {"rendered": True, "opened": True, "residual_clean": True},
        "output_file": {"path": "/risk-register.docx", "sha256": "abc", "bytes": 36992},
    }

    required_keys = {
        "definition_version",
        "tier",
        "provider",
        "field_map",
        "gate_verdict",
        "integrity_verdict",
        "output_file",
    }
    assert required_keys <= receipt.keys()
    assert "sha256" in receipt["output_file"]
    # The receipt is written under one of the emit event_type kinds.
    assert "emit_validated" in _AUDIT_EVENT_TYPES
