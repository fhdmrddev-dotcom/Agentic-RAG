"""Phase 291 (D-09, RESEARCH Pitfall 1) — the person's own answers reach the filled form.

An ``llm_emit`` phase never sees the run's launch inputs (only the kickoff prompt), and the
citation gate rejects any value without a retrieved citation. So a value the person typed
into the launch form for an "ask the person" input used to reach the run and then vanish:
the filled form came back with every asked field blank.

``overlay_user_inputs`` is the one place that fixes it, as a PURE leaf. For each declared
input whose ``source == "user"`` and whose key the template names, the launch value is
written into the legacy field map with a SERVER-MINTED ``input:<key>`` citation, and the
minted ids are returned so the caller can admit them to BOTH citation gates.

291 UAT S6: an input may name the ONE field it fills (``fills``) instead of using the field's
own key. Its answer is written into that field and cited ``input:<input key>``. An input that
names several fields is not overlaid: one answer cannot be spread over several fields without
guessing, so the draft step keeps ``fills`` to one field.

Trust boundary (T-291-20): an ``input:<key>`` id is minted ONLY here, ONLY for a declared
``user`` input that is a template placeholder. ``kb_auto`` and ``template_derived`` inputs are
ignored, so a KB-filled key still needs a real retrieved citation. A minted id counts only on
its own overlaid scalar: any other leaf citing an ``input:`` id is stripped to uncited (WR-05). Enum validity is not checked here: the fill engine checks every answer against
the form's own choices and refuses, in words, what does not match.
"""

from __future__ import annotations

import copy
from typing import Any

_INPUT_CITATION_PREFIX = "input:"


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _answer(value: Any) -> str | None:
    """The launch value as text, or ``None`` when there is no answer to write."""
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str) and value.strip():
        return value
    return None


def overlay_user_inputs(
    legacy_map: dict,
    definition: Any,
    run_inputs: dict | None,
    placeholder_keys: list[str],
) -> tuple[dict, set[str]]:
    """Return ``(new_map, minted_ids)``. Never mutates any argument."""
    specs = _get(definition, "inputs") or []
    if not specs or not isinstance(run_inputs, dict) or not isinstance(legacy_map, dict):
        return legacy_map, set()
    wanted = set(placeholder_keys or [])
    overlay: dict[str, tuple[str, str]] = {}  # field key -> (answer, input key)
    for spec in specs:
        key = _get(spec, "key")
        if not isinstance(key, str):
            continue
        if key in wanted:
            field = key
        else:
            named = [f for f in dict.fromkeys(_get(spec, "fills") or []) if f in wanted]
            if len(named) != 1:
                continue
            field = named[0]
        if (_get(spec, "source", "user") or "user") != "user":
            continue
        answer = _answer(run_inputs.get(key))
        if answer is not None:
            overlay[field] = (answer, key)
        elif _get(spec, "required", True) is False:
            # 296-06 (291-IN-06): an optional input the person left blank is an explicit null,
            # so the model cannot fill the field from somewhere else. No id is minted for it.
            overlay[field] = (None, key)
    if not overlay:
        return legacy_map, set()

    new_map = dict(legacy_map)
    scalars = copy.deepcopy(legacy_map.get("scalars") or {})
    collections = copy.deepcopy(legacy_map.get("collections") or {})
    # WR-05: a minted id is valid ONLY on its own overlaid scalar. Any other leaf citing an
    # input: id (a KB scalar, a collection cell) loses the citation, so the gate counts it
    # as uncited and takes the normal reject/retry path.
    for cited in list(scalars.values()) + [
        cell for rows in collections.values() for row in (rows or []) for cell in (row or {}).values()
    ]:
        if isinstance(cited, dict) and str(cited.get("source_chunk_id") or "").startswith(
            _INPUT_CITATION_PREFIX
        ):
            cited["source_chunk_id"] = None
    ids: set[str] = set()
    for field, (answer, input_key) in overlay.items():
        if answer is None:  # 296-06 (291-IN-06): left blank on purpose; nothing to cite
            scalars[field] = {"value": None, "source_chunk_id": None, "source_doc": None, "source_page": None}
            continue
        cid = f"{_INPUT_CITATION_PREFIX}{input_key}"
        scalars[field] = {"value": answer, "source_chunk_id": cid, "source_doc": None, "source_page": None}
        ids.add(cid)
    new_map["scalars"] = scalars
    if "collections" in legacy_map:
        new_map["collections"] = collections
    return new_map, ids
