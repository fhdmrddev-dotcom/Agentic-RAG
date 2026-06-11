"""Phase 101.1 (TMPL-02 / D-06 / D-08) — the forced-emit substrate contract.

Wave 0 RED stubs. The production substrate (``backend/app/services/forced_emit.py``)
lands in a DOWNSTREAM plan (the gateway-forcing / native-recovery wave), so these
tests are ``xfail(strict=False)`` RED-by-design and get un-marked to GREEN by that
plan (the 098/099/100/101 un-mark-on-landing convention).

D-06: a still-NARRATED emission on the NATIVE path is parsed back (a fenced object
matching the schema) OR the run fails HONESTLY — NEVER silently dropped (the GAP-D
fix). D-08 layer 4: a truncated emission (``stop_reason=max_tokens`` /
``finish_reason=length``) is rejected BEFORE acceptance (never a "valid" empty
field-map masquerading as "no data found").

CONVENTION: ``from app.services... import ...`` is INSIDE each test body so a
not-yet-existing symbol never breaks COLLECTION.
"""

from __future__ import annotations

import json

import pytest


@pytest.mark.xfail(strict=False, reason="101.1 forced-emit substrate (D-06) — owning plan un-marks to GREEN")
def test_native_recovery_or_honest_fail():
    """On the NATIVE path, when the model NARRATES a fenced JSON object instead of
    committing the forced tool call, the substrate parses it back into a validated
    ``EmitFieldMap`` (D-06 recovery) OR fails honestly — it is NEVER silently dropped.
    """
    from app.services.forced_emit import recover_narrated_emission

    # A reasoning-native narrated the field-map as fenced JSON instead of a tool call.
    narrated = (
        "Here is the field map you asked for:\n\n```json\n"
        + json.dumps(
            {
                "scalars": [
                    {
                        "key": "project_name",
                        "value": "Meridian",
                        "source_chunk_id": "chunk-1",
                        "source_doc": "brief.docx",
                        "source_page": 1,
                    }
                ],
                "rows": [],
            }
        )
        + "\n```\n"
    )

    recovered = recover_narrated_emission(narrated)
    # Recovered into the validated flat shape (D-06) — NOT silently dropped.
    assert recovered is not None
    assert recovered.scalars[0].value == "Meridian"

    # An un-recoverable narration (no fenced object) must fail honestly, not return
    # an empty "success" field-map.
    assert recover_narrated_emission("I cannot produce that.") is None


@pytest.mark.xfail(strict=False, reason="101.1 forced-emit substrate (D-08 layer 4) — owning plan un-marks to GREEN")
def test_truncation_rejected():
    """A forced emission cut off at the output-token limit (``stop_reason=max_tokens``
    / ``finish_reason=length``) is REJECTED before acceptance — never accepted as a
    valid (but half-empty) field-map. Reuses the shipped ``is_truncated`` guard."""
    from app.services.template_render_service import is_truncated

    assert is_truncated(stop_reason="max_tokens") is True
    assert is_truncated(finish_reason="length") is True
    assert is_truncated(stop_reason="tool_use") is False
    assert is_truncated(finish_reason="tool_calls") is False
