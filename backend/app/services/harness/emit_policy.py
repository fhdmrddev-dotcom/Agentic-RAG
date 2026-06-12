"""Phase 102 (D-01 / SEED-082) — the citation_policy post-verdict disposition.

The SEED-082 policy family (``strict | flag | partial | draft``) governs what the
``_exec_llm_emit`` citation gate DELIVERS after the deterministic ``check_coverage``
verdict — the verdict computation is UNCHANGED; the policy only changes the
DISPOSITION when uncited/invented leaves remain after retries are exhausted.

  - ``strict`` (default): the existing state-(b) honest fail — the deliverable is NOT
    produced (handled inline in ``_exec_llm_emit``; this module is never called).
  - ``flag``: deliver WITH visible "[unverified]" marks on the uncited values + a
    coverage summary. Never silent.
  - ``partial``: BLANK the uncited values (null-over-invent) + a gap list naming the
    blanked keys. Deliver.
  - ``draft``: no citation enforcement; deliver with a visible DRAFT label.

The SEED-082 RED LINE (T-102-04-03): every NON-strict mode MARKS or BLANKS — it is
NEVER a silent pass-off of unverified data as authoritative. The mark/blank/label is
applied to the WR-02-persisted field-map (``legacy_map``) and re-rendered by the SAME
deterministic driver (NO new emit shot, NEVER model-written code) — this module only
mutates a COPY of the field-map dict; the executor feeds the modified map back into
the existing render path.

``apply_citation_policy(field_map, gate, policy)`` returns a structured dict:
    {
      "field_map": <the modified field-map to render>,
      "delivered": True,
      "policy": <policy>,
      "coverage_summary": <str, flag/partial>,   # the surfaced message line
      "gap_list":         <list[str], partial>,   # the blanked keys
      "draft_label":      <str, draft>,           # the DRAFT header line
    }

The function is PURE (no I/O) — the executor owns the audit receipt + the surface +
the render dispatch.
"""

from __future__ import annotations

import copy

_UNVERIFIED_MARK = "[unverified]"
_DRAFT_LABEL = "DRAFT — citations not enforced"


def _leaf_field_name(leaf: str) -> str:
    """The field-name half of a ``check_coverage`` ``uncited_leaves`` entry.

    ``check_coverage`` formats leaves as ``"{location}.{field}"`` (e.g.
    ``"scalar.project_name"`` / ``"risks0.risk_id"``). The bare-key form (a test/flat
    shape passing just ``"k"``) has no dot — return it as-is.
    """
    return leaf.rsplit(".", 1)[-1] if "." in leaf else leaf


def _uncited_field_names(gate: dict) -> set[str]:
    """The set of field-names flagged uncited by the verdict (location-agnostic)."""
    return {_leaf_field_name(x) for x in (gate.get("uncited_leaves") or [])}


def _iter_leaf_dicts(field_map: dict):
    """Yield (key, cited_dict) over every Cited leaf of a field-map, mutating in place.

    Handles BOTH the legacy generic envelope (``scalars: {key: {value, ...}}`` +
    ``collections: {name: [{col: {value,...}}]}``) AND the flat ``EmitFieldMap`` test
    shape (``scalars`` is a LIST of ``{key, value, citation}`` + ``rows``). Yields the
    actual mutable leaf dict so the caller can mark/blank it.
    """
    scalars = field_map.get("scalars")
    collections = field_map.get("collections")

    # Flat EmitFieldMap shape: scalars is a LIST of {key, value, citation}.
    if isinstance(scalars, list):
        for cell in scalars:
            if isinstance(cell, dict):
                yield (cell.get("key"), cell)
        for row in (field_map.get("rows") or []):
            for cell in (row.get("cells") or []) if isinstance(row, dict) else []:
                if isinstance(cell, dict):
                    yield (cell.get("key"), cell)
        return

    # Legacy generic envelope.
    if isinstance(scalars, dict):
        for key, cited in scalars.items():
            if isinstance(cited, dict):
                yield (key, cited)
    if isinstance(collections, dict):
        for _cname, rows in collections.items():
            for row in rows or []:
                for col, cited in (row or {}).items():
                    if isinstance(cited, dict):
                        yield (col, cited)


def apply_citation_policy(field_map: dict, gate: dict, policy: str) -> dict:
    """Apply a NON-strict citation policy to a field-map (D-01 / SEED-082).

    ``strict`` must be handled by the caller (the inline honest fail) — calling this
    with ``"strict"`` is a programming error; it raises so the strict path can never
    accidentally route here. For ``flag``/``partial``/``draft`` it returns the modified
    field-map + the surfaced-message material; every mode MARKS or BLANKS (never a
    silent pass-off — T-102-04-03).
    """
    if policy == "strict":
        raise ValueError(
            "apply_citation_policy: 'strict' is the inline honest-fail path, not a "
            "deliver disposition — the caller must not route strict here"
        )

    fm = copy.deepcopy(field_map)
    uncited = _uncited_field_names(gate)

    if policy == "flag":
        marked = 0
        for key, cited in _iter_leaf_dicts(fm):
            if key in uncited and cited.get("value") is not None:
                cited["value"] = f"{cited['value']} {_UNVERIFIED_MARK}"
                marked += 1
        summary = (
            f"Quality check: {marked or len(uncited)} value(s) unverified — "
            f"delivered WITH {_UNVERIFIED_MARK} marks"
        )
        return {
            "field_map": fm,
            "delivered": True,
            "policy": "flag",
            "coverage_summary": summary,
        }

    if policy == "partial":
        blanked: list[str] = []
        for key, cited in _iter_leaf_dicts(fm):
            if key in uncited and cited.get("value") is not None:
                cited["value"] = None
                if key not in blanked:
                    blanked.append(key)
        # Always carry a non-empty gap list when the verdict named uncited leaves
        # (a flat-shape map may not expose the exact keys to blank — name them anyway).
        gap_list = blanked or sorted(uncited)
        summary = (
            f"Quality check: {len(gap_list)} value(s) had no citation and were BLANKED "
            f"(null-over-invent): {', '.join(gap_list)}"
        )
        return {
            "field_map": fm,
            "delivered": True,
            "policy": "partial",
            "coverage_summary": summary,
            "gap_list": gap_list,
        }

    if policy == "draft":
        # No citation enforcement — deliver as-is with a visible DRAFT label.
        return {
            "field_map": fm,
            "delivered": True,
            "policy": "draft",
            "draft_label": _DRAFT_LABEL,
            "coverage_summary": f"{_DRAFT_LABEL} — this is a DRAFT deliverable.",
        }

    raise ValueError(f"apply_citation_policy: unknown policy {policy!r}")
