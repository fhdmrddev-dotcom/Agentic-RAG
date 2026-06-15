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
      "gap_list":         <list[str], partial>,   # the blanked leaves
      "draft_label":      <str, draft>,           # the DRAFT header line
    }

…or, when the verdict named offenders but ZERO leaves were actually modified (WR-06
honesty — a stale/mismatched leaf string means the policy is a no-op), a strict-fallback
signal so the caller honest-fails rather than claiming a false success:
    {"field_map": <unchanged>, "delivered": False, "fallback": "strict", "reason": <str>}

The function is PURE (no I/O) — the executor owns the audit receipt + the surface +
the render dispatch.

WR-06 (102-08): matching is on the FULL ``(location, field)`` pair — exactly the
``"{location}.{field}"`` strings ``check_coverage`` puts in ``uncited_leaves`` /
``invented_leaves`` (``"scalar"`` for scalars, ``"{cname}{ri}"`` for collection cells).
A bare-field-name match over-blanks a CITED sibling cell sharing the same column name
(``risks0.risk_id`` uncited would destroy ``risks1.risk_id`` cited); the full-pair match
touches ONLY the named leaf. Invented-citation leaves are blanked/marked too (an invented
citation is no better than none).
"""

from __future__ import annotations

import copy

_UNVERIFIED_MARK = "[unverified]"
_DRAFT_LABEL = "DRAFT — citations not enforced"


def _offending_leaves(gate: dict) -> set[str]:
    """The set of FULL ``"{location}.{field}"`` leaf strings the verdict flagged —
    BOTH uncited AND invented (WR-06). Kept verbatim from the verdict (the location is
    NOT stripped) so the leaf matches the exact pair ``_iter_leaf_dicts`` yields."""
    leaves = (gate.get("uncited_leaves") or []) + (gate.get("invented_leaves") or [])
    return {str(x) for x in leaves}


def _iter_leaf_dicts(field_map: dict):
    """Yield (leaf, cited_dict) over every Cited leaf of a field-map, mutating in place.

    ``leaf`` is the FULL ``"{location}.{field}"`` string formatted EXACTLY as
    ``template_render_service.check_coverage._iter_leaves`` formats it (``"scalar"`` for
    scalars, ``"{cname}{ri}"`` index-aware for collection cells) so a caller can compare
    against the verdict's full leaf strings (WR-06 — never the bare field name).

    Handles BOTH the legacy generic envelope (``scalars: {key: {value, ...}}`` +
    ``collections: {name: [{col: {value,...}}]}``) AND the flat ``EmitFieldMap`` test
    shape (``scalars`` is a LIST of ``{key, value, citation}`` + ``rows`` of
    ``{collection, cells}``). Yields the actual mutable leaf dict so the caller can
    mark/blank it. The flat shape's leaf strings mirror ``check_coverage`` after the same
    flat→legacy normalization (``scalar.{key}`` / ``{collection}{ri}.{key}``).
    """
    scalars = field_map.get("scalars")
    collections = field_map.get("collections")

    # Flat EmitFieldMap shape: scalars is a LIST of {key, value, citation}; rows carry a
    # {collection, cells} shape. Mirror check_coverage's flat→legacy leaf strings.
    if isinstance(scalars, list):
        for cell in scalars:
            if isinstance(cell, dict):
                yield (f"scalar.{cell.get('key')}", cell)
        # Group rows by collection name so the per-collection row index matches the
        # legacy envelope's "{cname}{ri}" exactly (check_coverage walks collections then
        # enumerates rows). Preserve first-seen collection order.
        per_coll: dict[str, list] = {}
        for row in field_map.get("rows") or []:
            if not isinstance(row, dict):
                continue
            cname = row.get("collection") or "rows"
            per_coll.setdefault(cname, []).append(row)
        for cname, rows in per_coll.items():
            for ri, row in enumerate(rows):
                for cell in row.get("cells") or []:
                    if isinstance(cell, dict):
                        yield (f"{cname}{ri}.{cell.get('key')}", cell)
        return

    # Legacy generic envelope.
    if isinstance(scalars, dict):
        for key, cited in scalars.items():
            if isinstance(cited, dict):
                yield (f"scalar.{key}", cited)
    if isinstance(collections, dict):
        for cname, rows in collections.items():
            for ri, row in enumerate(rows or []):
                for col, cited in (row or {}).items():
                    if isinstance(cited, dict):
                        yield (f"{cname}{ri}.{col}", cited)


def _strict_fallback(field_map: dict, policy: str, offenders: set[str]) -> dict:
    """WR-06 honesty: the verdict named offenders but the policy matched ZERO leaves to
    modify (a stale/mismatched leaf string) — signal a strict fallback so the caller
    honest-fails rather than claiming a false success with a gap list of never-blanked
    keys / marks that never landed."""
    return {
        "field_map": field_map,
        "delivered": False,
        "policy": policy,
        "fallback": "strict",
        "reason": (
            "policy named offenders but matched no leaves to modify — "
            f"failing back to strict ({', '.join(sorted(offenders)) or 'none'})"
        ),
    }


def apply_citation_policy(field_map: dict, gate: dict, policy: str) -> dict:
    """Apply a NON-strict citation policy to a field-map (D-01 / SEED-082).

    ``strict`` must be handled by the caller (the inline honest fail) — calling this
    with ``"strict"`` is a programming error; it raises so the strict path can never
    accidentally route here. For ``flag``/``partial``/``draft`` it returns the modified
    field-map + the surfaced-message material; every mode MARKS or BLANKS (never a
    silent pass-off — T-102-04-03). WR-06: matching is on the FULL ``(location, field)``
    pair (never a cited sibling), invented leaves are blanked/marked too, and a no-op
    falls back to strict.
    """
    if policy == "strict":
        raise ValueError(
            "apply_citation_policy: 'strict' is the inline honest-fail path, not a "
            "deliver disposition — the caller must not route strict here"
        )

    fm = copy.deepcopy(field_map)
    offenders = _offending_leaves(gate)

    if policy == "flag":
        marked: list[str] = []
        for leaf, cited in _iter_leaf_dicts(fm):
            if leaf in offenders and cited.get("value") is not None:
                cited["value"] = f"{cited['value']} {_UNVERIFIED_MARK}"
                marked.append(leaf)
        # WR-06 honesty: the verdict named offenders but NONE matched a real leaf → no-op
        # → fail back to strict (never claim marks that did not land).
        if offenders and not marked:
            return _strict_fallback(field_map, "flag", offenders)
        summary = (
            f"Quality check: {len(marked)} value(s) unverified — "
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
        for leaf, cited in _iter_leaf_dicts(fm):
            if leaf in offenders and cited.get("value") is not None:
                cited["value"] = None
                if leaf not in blanked:
                    blanked.append(leaf)
        # WR-06 honesty: offenders named but nothing blanked → no-op → strict fallback
        # (never a gap list of keys that were never actually blanked).
        if offenders and not blanked:
            return _strict_fallback(field_map, "partial", offenders)
        summary = (
            f"Quality check: {len(blanked)} value(s) had no valid citation and were "
            f"BLANKED (null-over-invent): {', '.join(blanked)}"
        )
        return {
            "field_map": fm,
            "delivered": True,
            "policy": "partial",
            "coverage_summary": summary,
            "gap_list": blanked,
        }

    if policy == "draft":
        # No citation enforcement — deliver as-is with a visible DRAFT label (draft never
        # falls back to strict; it makes no claim about specific leaves).
        return {
            "field_map": fm,
            "delivered": True,
            "policy": "draft",
            "draft_label": _DRAFT_LABEL,
            "coverage_summary": f"{_DRAFT_LABEL} — this is a DRAFT deliverable.",
        }

    raise ValueError(f"apply_citation_policy: unknown policy {policy!r}")
