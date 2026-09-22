"""263-REVIEW.md WR-01 / WR-02 / WR-03 — every write door must enforce the same caps.

THE SHAPE, stated once. ``ExpertBundleBase`` is the contract: it is what ``POST /experts``
validates and what the drafter's output is POSTed into. Two other doors reach the same
columns and each had drifted from it in its own direction:

  WR-01  the PRODUCER side. ``ExpertDraftOutput.icon`` had no ``max_length`` while
         ``ExpertBundleBase.icon`` caps at 64 — so the drafter could emit a value its own
         consumer refuses, and the app 422s on the Expert its AI just wrote.
         ⚠ ``test_263_drafter_output_fits_its_consumers.py`` is the fence written for exactly
         this class, and it could not see ``icon`` because ``PRODUCER_CONSUMER_PAIRS`` is a
         HAND-TYPED list. That is this project's recurring "a register nobody re-derives"
         shape, so the fence here DERIVES its field set instead of listing it.

  WR-02  the UPDATE side. ``ExpertBundleUpdate`` carried bare ``str | None`` on every field,
         so ``PATCH`` accepted what ``POST`` refuses — including ``{"name": ""}``, which
         ``update_expert_bundle``'s ``allowed_fields`` then persists.

  WR-03  ``slug``. The studio let an author edit it and reported success while the server
         silently dropped it. OPERATOR DECISION 2026-09-22: **slug is IMMUTABLE after
         creation** — it is how saved references resolve. So the absence of ``slug`` from
         ``ExpertBundleUpdate`` is now the INTENDED contract, pinned here, rather than an
         oversight that happened to look like one.

⛔ WHY ``exclude_unset`` MAKES ``default=None`` LOAD-BEARING. ``update_expert_service`` reads
the PATCH body with ``exclude_unset=True``: "absent means unchanged". A ``Field(...)`` with no
default would make every optional field REQUIRED and break every partial PATCH in the product.
Constraints are added; the defaults are not touched. ``test_update_fields_all_still_optional``
is what stops a future tightening from doing that by accident.
"""

from __future__ import annotations

from annotated_types import MaxLen, MinLen

import pytest

from app.models.expert import (
    ExpertBundleBase,
    ExpertBundleCreate,
    ExpertBundleUpdate,
)
from app.services.expert_authoring import ExpertDraftOutput


def _bound(model, field: str, kind) -> int | None:
    info = model.model_fields.get(field)
    if info is None:
        return None
    for meta in info.metadata:
        if isinstance(meta, kind):
            return meta.max_length if kind is MaxLen else meta.min_length
    return None


def _string_fields(model) -> set[str]:
    """Plain ``str`` fields only — lists, enums, UUIDs and bools carry no length cap."""
    return {
        name
        for name, info in model.model_fields.items()
        if info.annotation is str
    }


# ── WR-01: the producer's fields are DERIVED, never hand-listed ───────────────────────


def test_every_shared_string_field_is_bounded_on_the_producer():
    """⛔ DERIVED from the intersection of the two models, so a NEW shared field is covered
    the day it is added. The hand-typed table in
    ``test_263_drafter_output_fits_its_consumers.py`` is what let ``icon`` through."""
    shared = _string_fields(ExpertDraftOutput) & _string_fields(ExpertBundleBase)
    assert shared, "no shared string fields resolved — the derivation itself is broken"

    unbounded = sorted(f for f in shared if _bound(ExpertDraftOutput, f, MaxLen) is None)
    assert not unbounded, (
        "these drafter fields feed a CAPPED consumer with no cap of their own, so the "
        f"drafter can emit what the save path refuses: {unbounded}"
    )


def test_producer_cap_never_exceeds_its_consumer_cap():
    """A producer bound LOOSER than its consumer is the same defect one step quieter."""
    shared = _string_fields(ExpertDraftOutput) & _string_fields(ExpertBundleBase)
    offenders = []
    for f in sorted(shared):
        p, c = _bound(ExpertDraftOutput, f, MaxLen), _bound(ExpertBundleBase, f, MaxLen)
        if p is not None and c is not None and p > c:
            offenders.append(f"{f}: producer {p} > consumer {c}")
    assert not offenders, offenders


def test_icon_specifically_is_bounded():
    """WR-01 by name, so a regression reads as itself in the failure list."""
    assert _bound(ExpertDraftOutput, "icon", MaxLen) == 64, (
        "WR-01 regression: a weaker model answering the enumerated-glyph instruction with "
        "'file-text (Document / General — best fit for …)' (71 chars) drafts 200 and saves 422."
    )


# ── WR-02: PATCH must not accept what POST refuses ────────────────────────────────────


_UPDATE_SHARED = sorted(_string_fields(ExpertBundleUpdate) | {
    f for f, i in ExpertBundleUpdate.model_fields.items()
    if i.annotation == (str | None)
})


@pytest.mark.parametrize("field", [f for f in _UPDATE_SHARED if f in ExpertBundleBase.model_fields])
def test_update_string_field_carries_the_same_caps_as_create(field: str):
    create_max = _bound(ExpertBundleCreate, field, MaxLen)
    update_max = _bound(ExpertBundleUpdate, field, MaxLen)
    assert update_max == create_max, (
        f"WR-02 regression on '{field}': POST caps at {create_max}, PATCH at {update_max}. "
        "A door that accepts what its sibling refuses is not a second door, it is a hole."
    )
    create_min = _bound(ExpertBundleCreate, field, MinLen)
    if create_min:
        assert _bound(ExpertBundleUpdate, field, MinLen) == create_min, (
            f"'{field}' has min_length={create_min} on create and none on update — "
            'PATCH {"' + field + '": ""} would persist an empty value.'
        )


def test_update_rejects_an_empty_name():
    """The concrete call from the finding, driven rather than reasoned about."""
    with pytest.raises(Exception):
        ExpertBundleUpdate(name="")


def test_update_rejects_an_overlong_description():
    with pytest.raises(Exception):
        ExpertBundleUpdate(description="x" * 8001)


def test_update_fields_all_still_optional():
    """⛔ THE GUARD ON THE FIX ITSELF. ``exclude_unset`` is what makes "absent means
    unchanged" work; a required field here breaks every partial PATCH in the product."""
    required = sorted(n for n, i in ExpertBundleUpdate.model_fields.items() if i.is_required())
    assert not required, f"ExpertBundleUpdate fields must all be optional, got required: {required}"
    # And the empty patch — the shape every unrelated rename relies on — still validates.
    assert ExpertBundleUpdate().model_dump(exclude_unset=True) == {}


# ── WR-03: slug's absence from the update model is the CONTRACT ───────────────────────


def test_slug_is_not_updatable():
    """OPERATOR DECISION 2026-09-22 — slug is immutable after creation.

    ⛔ Pinned as INTENT, not left as an accident. `get_expert_by_slug_service` resolves by
    this value, so a rename silently invalidates anything holding the old one. The studio's
    input is `readOnly` in edit mode and the TS `ExpertBundleUpdate` no longer declares it;
    this is the server half of the same decision. To make slug mutable, the work is named in
    263-REVIEW WR-03 — add it here AND to `allowed_fields` AND give
    `idx_expert_bundles_org_slug` a named 409. Deleting this test alone is not that work.
    """
    assert "slug" not in ExpertBundleUpdate.model_fields
    assert "slug" in ExpertBundleCreate.model_fields, "slug must still be required at creation"
