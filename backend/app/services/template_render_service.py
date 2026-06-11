"""Phase 101 (TMPL-02 / TMPL-03) — the pure deterministic template-fill core.

The golden rule (PROJECT anchor, RESEARCH §Pattern 3): **the LLM produces DATA,
deterministic code produces the FILE.** This module is that deterministic code —
the cited field-map shape, the deterministic citation/coverage gate, the truncation
guard, the render-context builder + worded→numeric hook, BOTH fill engines (trusted
docxtpl/Jinja + arbitrary non-Jinja run-replace), the universal integrity re-open,
the residual-tag silent-miss detector, and the provenance engine selector.

It is a PORT of the 097 spike (``scripts/spike-097/field_map.py`` +
``derive_fields.py`` + ``render_docx.py``), generalized from risk-register-specific
to template-agnostic.

TWO RED LINES this module honors structurally:

  1. **NO LLM call here.** The cited field-map is emitted by the model through the
     shared provider gateway (Plan 03 wires the ``render_template`` tool as an
     ``llm_agent`` argument — so all 8 providers inherit the NATIVE/STRUCTURED
     resolution + truncation/registry traps at the service boundary; the fill path
     never branches per provider — D-14). This module only declares the field-map
     SHAPE + the deterministic checks over it.

  2. **NO sandbox / Docker import here, and NO top-level heavy-lib import.** The
     production backend venv has NO ``docxtpl`` (Pitfall 4) — render runs in the
     sealed, network-less Docker sandbox (D-12), and Plan 03's driver SHIPS these
     render functions INTO the container. So ``docxtpl`` / ``python-docx`` /
     ``python-pptx`` / ``openpyxl`` / ``jinja2`` are imported INSIDE the render
     functions, never at module top level. The PURE helpers (``Cited``,
     ``check_coverage``, ``is_truncated``, ``select_engine``,
     ``build_generic_field_map_model`` / ``GenericFieldMap``, ``build_context``) import
     cleanly in the backend even though ``docxtpl`` is absent — they touch only
     pydantic + the stdlib. The TEST tier + the sandbox image have the heavy libs.

D-02 (the security boundary): engine selection is by PROVENANCE, not content
sniffing. A library ``AssetRef`` (authored/versioned/no-TTL, trusted) → ``docxtpl``
/Jinja with row growth; an ephemeral ``kind='template_input'`` upload (untrusted) →
the non-Jinja run-replace engine. Consequence: an untrusted upload NEVER reaches the
Jinja engine → SSTI is structurally impossible for the upload path.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Optional

from pydantic import BaseModel, ConfigDict, Field

# A well-formed scalar placeholder token: ``{{ identifier }}`` (optional surrounding
# whitespace, a dotted/underscored identifier inside). Used by the arbitrary run-replace
# path to blank UNMATCHED placeholder-shaped tokens (the "lean blank for clean cells"
# choice — RESEARCH Pitfall 1 step 3) WITHOUT matching arbitrary literal ``{{`` the user
# wanted (failure mode (b)): only a bare-identifier token is treated as an intended
# placeholder. Jinja control blocks ``{% ... %}`` are NOT matched (trusted-path only).
_PLACEHOLDER_TOKEN_RE = re.compile(r"\{\{\s*[A-Za-z_][\w.]*\s*\}\}")

# ---------------------------------------------------------------------------
# 1. Field-map models — the cited shape (D-03) + the generic envelope
# ---------------------------------------------------------------------------
# Every leaf is nullable and carries its source chunk/doc/page so the model can
# DECLINE (value=None) rather than invent. PORT of field_map.py:44 verbatim, then a
# template-AGNOSTIC envelope generalized from the spike's risk-register-specific
# shape (RESEARCH Open Q 2 — LEAN fixed envelope, simpler cross-provider tool schema).


class Cited(BaseModel):
    """A single filled value with provenance. value=None means 'not found in KB'.

    PORT of scripts/spike-097/field_map.py:44 — every leaf nullable (D-03).
    """

    value: str | None = Field(None, description="The value, or null if the KB does not support it.")
    source_chunk_id: str | None = Field(
        None, description="the <doc id=...> spotlight id this value came from."
    )
    source_doc: str | None = Field(None, description="filename of the source document.")
    source_page: int | None = Field(None, description="page/chunk_index if known.")


class GenericFieldMap(BaseModel):
    """The template-agnostic cited field-map envelope (RESEARCH Code Examples).

    Generalizes the spike's risk-register-specific ``RiskRegisterFieldMap`` into a
    fixed two-bucket envelope keyed by the template's placeholder keys:

      - ``scalars``      — one ``Cited`` per scalar placeholder (e.g. ``project_name``).
      - ``collections``  — one list-of-rows per collection placeholder (e.g. ``rows``);
                           each row is a dict of column-name → ``Cited``.

    A fixed envelope (vs a dynamically-built model per template) keeps the
    cross-provider tool schema simple and stable — the LLM fills whichever scalar /
    collection keys the template requires (named in the tool description by
    ``build_field_map_tool_schema``). Every leaf is nullable → an empty/declined
    field-map validates cleanly (``GenericFieldMap()`` is valid).
    """

    scalars: dict[str, Cited] = Field(default_factory=dict)
    collections: dict[str, list[dict[str, Cited]]] = Field(default_factory=dict)


def build_generic_field_map_model(placeholder_keys: list[str]) -> type[GenericFieldMap]:
    """Return the field-map model class for a template's placeholder keys.

    Plan 02 pins the GENERIC FIXED envelope (RESEARCH Open Q 2 — fixed envelope, not a
    dynamically-derived model per template), so this returns ``GenericFieldMap``
    regardless of the keys. The keys still drive coverage (``check_coverage``) and the
    tool-schema description (``build_field_map_tool_schema``); the model SHAPE is fixed.

    Exposed so the Wave-0 stub's ``build_generic_field_map_model(sorted(keys))`` path
    resolves (the stub falls back to ``GenericFieldMap`` if this symbol is absent —
    test_template_render.py:92-97).
    """
    return GenericFieldMap


def build_field_map_tool_schema(placeholder_keys: list[str]) -> dict:
    """Return the ``GenericFieldMap`` JSON schema annotated with the template's keys.

    The shared gateway (Plan 03) passes this as the ``render_template`` tool's
    ``input_schema`` so the LLM knows WHICH scalar / collection keys the template
    requires. The schema SHAPE is the fixed envelope; the required keys ride the
    description (a hint, not a hard constraint — every leaf stays nullable so the
    model can decline).
    """
    schema = GenericFieldMap.model_json_schema()
    keys = ", ".join(sorted(placeholder_keys))
    base_desc = schema.get("description", "")
    schema["description"] = (
        f"{base_desc} The template requires these top-level placeholder keys: {keys}. "
        "Put scalar placeholders under `scalars` (one Cited each) and list/table "
        "placeholders under `collections` (a list of row dicts, each value a Cited). "
        "For EVERY non-null value set source_chunk_id to the <doc id> it came from; "
        "if the KB does not support a value, set value to null and leave source_chunk_id null. "
        "NEVER invent a value or a citation."
    ).strip()
    return schema


# ---------------------------------------------------------------------------
# 1b. The FLAT, strict-friendly cited field-map (Phase 101.1 / D-09 — RESEARCH §3)
# ---------------------------------------------------------------------------
# ADDITIVE — does NOT replace ``GenericFieldMap`` (097/101 nested-cited artifacts
# still ``model_validate()`` against it). The flat shape is the biggest single
# cross-provider reliability lever: ``extra="forbid"`` everywhere (→ every object
# level emits ``additionalProperties:false``), the citation lives as SIBLING fields
# on the same object as ``value`` (NOT a nested ``Cited{}`` wrapper), NO recursion
# (a fixed depth of 3 — ``EmitFieldMap → FlatRow → FlatScalar``), and NO
# ``minLength``/``maxLength``/``pattern`` (unsupported by Anthropic + DeepSeek
# strict). Every field is present + nullable (the OpenAI/DeepSeek strict
# "all-required-with-null-optionals" requirement) so the model can DECLINE
# (``value=None``) rather than invent.
#
# It is gated behind the new ``llm_emit`` phase type (the only path that emits this
# shape); the existing deterministic gate/driver consume the LEGACY flat-dict shape,
# so ``emit_field_map_to_legacy`` is the seam that keeps THIS plan additive — the
# citation gate (``_iter_leaves``/``check_coverage``) and the docxtpl driver
# (``build_context``) are NOT re-touched here (Plan 04 re-touches them WITH its own
# parity tests).


class FlatScalar(BaseModel):
    """One filled value + its provenance, flat (citation as SIBLING fields).

    ``value=None`` means "not found in the KB" (an honest decline, D-03). The four
    provenance fields are the EXACT field set ``Cited`` carries — copied as siblings
    so a strict schema sees one flat object, not a nested ``$ref`` wrapper.
    """

    model_config = ConfigDict(extra="forbid")  # → additionalProperties:false

    key: str  # the placeholder / column name (was a dict KEY in GenericFieldMap)
    value: str | None  # the value, or null = declined (required-with-null-optional)
    source_chunk_id: str | None  # the <doc id> spotlight id this value came from
    source_doc: str | None  # filename of the source document
    source_page: int | None  # page / chunk_index if known


class FlatRow(BaseModel):
    """One row of a collection — a flat list of cells (each cell a ``FlatScalar``)."""

    model_config = ConfigDict(extra="forbid")

    collection: str  # which collection this row belongs to (e.g. "rows")
    cells: list[FlatScalar]  # each cell's ``key`` is the column name


class EmitFieldMap(BaseModel):
    """The flat, strict-friendly cited field-map (D-09).

    ``scalars`` is a FLAT list (stable, ordered, strict-friendly — NOT an open
    ``dict``); ``rows`` is a FLAT list-of-rows. The whole shape is bounded at depth 3
    with ``additionalProperties:false`` everywhere — the cross-provider forcing target
    every TIER-FORCE provider accepts.
    """

    model_config = ConfigDict(extra="forbid")

    scalars: list[FlatScalar]
    rows: list[FlatRow]


def _flat_cell_to_cited(cell: dict) -> dict:
    """One flat ``{key, value, source_chunk_id, source_doc, source_page}`` cell → the
    legacy ``Cited`` dict (drop ``key`` — it becomes the dict KEY). Tolerant of a partial
    cell (missing provenance keys default to None) so the normalizer is robust to either a
    ``FlatScalar.model_dump()`` or a hand-built flat dict."""
    return {
        "value": cell.get("value"),
        "source_chunk_id": cell.get("source_chunk_id"),
        "source_doc": cell.get("source_doc"),
        "source_page": cell.get("source_page"),
    }


def _is_flat_emit_field_map_dict(fm_dict: dict) -> bool:
    """True iff ``fm_dict`` is the FLAT ``EmitFieldMap`` shape (D-09): a ``scalars`` LIST
    of flat cells (each a dict with a ``key`` field) and/or a ``rows`` LIST of
    ``{collection, cells}`` row objects.

    Three shapes flow into the gate/driver and MUST be told apart precisely:

      1. generic envelope    — ``scalars`` is a DICT, ``collections`` is a DICT.
      2. flat spike-style    — top-level ``{key: cited}`` scalars + ``rows`` is a list of
                               bare ``{col: cited}`` row dicts (NO ``collection``/``cells``
                               wrapper). Phase-101 tests pass this (test_template_render
                               :112). This is NOT the EmitFieldMap shape.
      3. flat EmitFieldMap    — ``scalars`` is a LIST of ``{key, value, ...}`` cells AND/OR
                               ``rows`` is a list of ``{collection, cells: [...]}`` objects.

    The discriminator is structural, not just "is rows a list": a ``rows`` list is the flat
    EmitFieldMap ONLY when its first element carries the ``collection``+``cells`` wrapper —
    otherwise it is the spike-style shape (which the existing flat branch already walks).
    A ``scalars`` LIST is unambiguous (the envelope's ``scalars`` is always a dict)."""
    if not isinstance(fm_dict, dict):
        return False
    scalars = fm_dict.get("scalars")
    if isinstance(scalars, list):
        return True
    rows = fm_dict.get("rows")
    if isinstance(rows, list) and rows:
        first = rows[0]
        return isinstance(first, dict) and "collection" in first and "cells" in first
    return False


def _flat_emit_field_map_to_legacy_dict(fm_dict: dict) -> dict:
    """Normalize a FLAT ``EmitFieldMap`` *dict* to the LEGACY generic-envelope dict.

    This is the ONE place the flat→legacy mapping lives (WR-04 "two copies cannot
    drift"): both ``emit_field_map_to_legacy`` (model entry) and the third
    ``_iter_leaves`` / ``check_coverage`` / ``build_context`` branch route through this
    function, so the flat path and the nested path produce the SAME legacy shape — and
    therefore the SAME gate verdict + render context + bytes.

      - ``scalars`` (list) → ``{key: {value, source_chunk_id, source_doc, source_page}}``
      - ``rows`` (list)    → ``{collection: [{col_key: {...cited...}}, ...]}``

    Rows with the same ``collection`` accumulate into that collection's list in emission
    order. A missing ``scalars``/``rows`` key is treated as empty (a flat map may carry
    only one).
    """
    scalars: dict[str, dict] = {}
    for cell in fm_dict.get("scalars") or []:
        if isinstance(cell, dict) and "key" in cell:
            scalars[cell["key"]] = _flat_cell_to_cited(cell)

    collections: dict[str, list[dict]] = {}
    for row in fm_dict.get("rows") or []:
        if not isinstance(row, dict):
            continue
        cname = row.get("collection")
        if cname is None:
            continue
        built = {
            cell["key"]: _flat_cell_to_cited(cell)
            for cell in (row.get("cells") or [])
            if isinstance(cell, dict) and "key" in cell
        }
        collections.setdefault(cname, []).append(built)

    return {"scalars": scalars, "collections": collections}


def emit_field_map_to_legacy(fm: EmitFieldMap) -> dict:
    """Normalize a flat ``EmitFieldMap`` to the LEGACY flat-dict shape the existing
    ``_iter_leaves`` / ``check_coverage`` / ``build_context`` already consume.

    The seam that keeps Phase 101.1 ADDITIVE: the flat model is the new forced-emit
    target, but the deterministic gate + docxtpl driver are unchanged in this plan —
    this normalizer maps the flat lists BACK to the generic-envelope shape they read:

      - scalars  → ``{key: {value, source_chunk_id, source_doc, source_page}}``
      - rows     → ``{collection: [{col_key: {...cited...}}, ...]}``

    A ``FlatRow``'s ``cells`` become one ``{col_key: cited}`` dict (keyed by each
    cell's ``key``); rows with the same ``collection`` accumulate into that
    collection's list in emission order.

    Delegates to ``_flat_emit_field_map_to_legacy_dict`` (the ONE flat→legacy mapping —
    WR-04) over the model's ``model_dump()`` so the model entry and the dict entry (the
    third gate/driver branch) can never drift.
    """
    return _flat_emit_field_map_to_legacy_dict(fm.model_dump())


# ---------------------------------------------------------------------------
# 2. Deterministic coverage + citation check (NO LLM) — PORT derive_fields.py:112
# ---------------------------------------------------------------------------
# A non-null value is CITED iff its source_chunk_id was ACTUALLY in the retrieved set
# (an invented/absent citation = uncited). Generalized from the spike's hardcoded
# ROW_FIELDS walk to a generic-envelope walk (scalars + collections). This is the
# BEFORE-render reject (D-08 failure class 1) — a pure-Python set-membership pass,
# NEVER a second LLM "did you cite?" call (RESEARCH §Pattern 4).


def _iter_leaves(fm_dict: dict):
    """Yield (location, field_name, cited_dict) over every Cited leaf of a field-map.

    Walks the GENERIC envelope: every ``scalars[key]`` then every
    ``collections[key][i][col]`` leaf. Tolerant of either the generic-envelope shape
    OR the flat spike-style shape (top-level ``{key: cited}`` + ``rows: [...]``) so the
    Wave-0 ``check_coverage`` stub (which passes a flat ``{project_name, report_date,
    rows}`` dict — test_template_render.py:113) and the production generic envelope both
    work without the caller pre-normalizing.

    THIRD branch (Plan 101.1-04 / D-09): a FLAT ``EmitFieldMap`` dict (``scalars`` is a
    LIST + ``rows`` is a list of ``{collection, cells}``) is normalized to the legacy
    generic envelope via the SAME mapping ``emit_field_map_to_legacy`` uses (WR-04 — one
    code path, the flat + nested walks cannot drift), then walked as the envelope below.
    """
    if _is_flat_emit_field_map_dict(fm_dict):
        fm_dict = _flat_emit_field_map_to_legacy_dict(fm_dict)
    scalars = fm_dict.get("scalars")
    collections = fm_dict.get("collections")
    if scalars is not None or collections is not None:
        # Generic envelope shape.
        for key, cited in (scalars or {}).items():
            yield ("scalar", key, cited)
        for cname, rows in (collections or {}).items():
            for ri, row in enumerate(rows or []):
                for col, cited in (row or {}).items():
                    yield (f"{cname}{ri}", col, cited)
        return

    # Flat spike-style shape: scalar leaves are top-level Cited dicts; any list value is
    # a collection of row dicts. A leaf is a dict carrying a "value" key.
    for key, val in fm_dict.items():
        if isinstance(val, list):
            for ri, row in enumerate(val):
                for col, cited in (row or {}).items():
                    yield (f"{key}{ri}", col, cited)
        elif isinstance(val, dict) and "value" in val:
            yield ("scalar", key, val)
        # other shapes (bare scalars, nested non-cited) are ignored as non-leaves


def check_coverage(
    fm_dict: dict, retrieved_ids: set[str], placeholder_keys: list[str]
) -> dict:
    """Coverage + citation stats over a field-map (PORT derive_fields.check_coverage).

    A non-null value is CITED iff its ``source_chunk_id`` was actually in
    ``retrieved_ids`` (an invented/absent citation = uncited). ``covers_template`` is
    True iff every placeholder key is present as a scalar/collection key (generic
    envelope) OR a top-level key (flat shape).

    Returns the same keys the spike returned (so downstream / 102 generalization is a
    drop-in): covered_keys, covers_template, uncited_value_count, invented_citation_count,
    citation_coverage_pct, null_rate, null_leaf_count (+ counts the spike exposed).

    THIRD branch (Plan 101.1-04 / D-09): a FLAT ``EmitFieldMap`` dict is normalized to
    the legacy envelope FIRST (the SAME mapping the nested path consumes) so the
    uncited/invented/null-rate verdicts are IDENTICAL on the flat vs nested shape (WR-04).
    """
    if _is_flat_emit_field_map_dict(fm_dict):
        fm_dict = _flat_emit_field_map_to_legacy_dict(fm_dict)
    # Which template keys are present? Support both the generic envelope and flat shapes.
    present_keys: set[str] = set()
    scalars = fm_dict.get("scalars")
    collections = fm_dict.get("collections")
    if scalars is not None or collections is not None:
        present_keys |= set((scalars or {}).keys())
        present_keys |= set((collections or {}).keys())
    else:
        present_keys |= set(fm_dict.keys())

    covered_keys = [k for k in placeholder_keys if k in present_keys]

    total_leaves = 0
    null_leaves = 0
    filled_leaves = 0
    cited_leaves = 0
    uncited_value_count = 0  # value present, source_chunk_id null (Pitfall 6)
    invented_citation_count = 0  # source_chunk_id present but NOT retrieved (T-101-02-03)

    # 101.1-06: NAME the offending leaves (capped) so the executor's bounded-retry
    # feedback can tell the model exactly which values to cite-or-null, and the
    # emit_rejected receipt records what was rejected (additive keys — count-field
    # consumers unchanged).
    _LEAF_NAME_CAP = 20
    uncited_leaves: list[str] = []
    invented_leaves: list[str] = []

    for _location, _fname, cited in _iter_leaves(fm_dict):
        cited = cited or {}
        total_leaves += 1
        value = cited.get("value")
        src = cited.get("source_chunk_id")
        if value is None:
            null_leaves += 1
            continue
        filled_leaves += 1
        if src is None:
            uncited_value_count += 1
            if len(uncited_leaves) < _LEAF_NAME_CAP:
                uncited_leaves.append(f"{_location}.{_fname}")
        elif src not in retrieved_ids:
            invented_citation_count += 1
            if len(invented_leaves) < _LEAF_NAME_CAP:
                invented_leaves.append(f"{_location}.{_fname}")
        else:
            cited_leaves += 1

    null_rate = (null_leaves / total_leaves) if total_leaves else 0.0
    coverage_pct = (cited_leaves / filled_leaves * 100.0) if filled_leaves else 0.0

    return {
        "covered_keys": covered_keys,
        "covers_template": set(placeholder_keys) <= present_keys,
        "total_leaves": total_leaves,
        "filled_value_count": filled_leaves,
        "null_leaf_count": null_leaves,
        "null_rate": round(null_rate, 4),
        "cited_value_count": cited_leaves,
        "uncited_value_count": uncited_value_count,
        "invented_citation_count": invented_citation_count,
        "citation_coverage_pct": round(coverage_pct, 1),
        "uncited_leaves": uncited_leaves,
        "invented_leaves": invented_leaves,
    }


# ---------------------------------------------------------------------------
# 3. Truncation guard — PORT derive_fields.py:267 (Rule-1 guard, Pitfall 3)
# ---------------------------------------------------------------------------


def is_truncated(
    meta: dict | None = None,
    *,
    stop_reason: str | None = None,
    finish_reason: str | None = None,
) -> bool:
    """True if the emission was cut off mid-tool-JSON (never a valid empty result).

    A truncated tool JSON silently drops collections (``default_factory`` empties them)
    — never accept a ``stop_reason=max_tokens`` / ``finish_reason=length`` emission as
    "no data found" (the spike's Rule-1 guard — derive_fields.py:267). The shared
    gateway normalizes both vocabularies (Anthropic ``stop_reason`` + OpenAI-family
    ``finish_reason``), so cover both.

    Accepts EITHER a positional ``meta`` dict (the legacy spike caller — used by the
    citation/integrity tests) OR the ``stop_reason=`` / ``finish_reason=`` kwargs (the
    Phase 101.1 ``forced_emit`` caller, which has the two reasons directly in hand
    after draining the forced shot). Both forms are equivalent; this reconciles the
    call shape the Wave-0 ``test_truncation_rejected`` stub asserts (Plan 01 SUMMARY
    "Issues Encountered" flagged this for THIS plan to resolve).
    """
    _stop = stop_reason if stop_reason is not None else (meta or {}).get("stop_reason")
    _finish = finish_reason if finish_reason is not None else (meta or {}).get("finish_reason")
    return _stop == "max_tokens" or _finish == "length"


# ---------------------------------------------------------------------------
# 4. Render-context builder + the worded→numeric hook (D-11) — PORT render_docx.py
# ---------------------------------------------------------------------------


def _num(cited: dict | None):
    """int(value) when the Cited value parses as an int, else None (PORT render_docx.py:47).

    The KB often expresses values as WORDS (High/Medium/Low) — those do NOT parse as
    ints, so a numeric-derived field is left blank. That is an honest, expected result,
    not a bug. Exposed so a Phase-104 ``numeric_hook`` can reuse it (D-11).
    """
    if not cited:
        return None
    v = cited.get("value")
    if v is None:
        return None
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return None


def _cell(cited: dict | None) -> dict:
    """A display-safe Cited dict: value None -> '' so a not-found field renders as a
    BLANK cell, never the literal 'None'. Keeps the nested dict shape so a template's
    ``{{ r.<field>.value }}`` lookup still resolves (PORT render_docx.py:65)."""
    cited = cited or {}
    v = cited.get("value")
    return {
        "value": "" if v is None else v,
        "source_chunk_id": cited.get("source_chunk_id"),
        "source_doc": cited.get("source_doc"),
        "source_page": cited.get("source_page"),
    }


def build_context(field_map_dict: dict, *, numeric_hook: Optional[Callable[[dict], dict]] = None) -> dict:
    """Turn a field-map dict into the docxtpl render context (PORT + generalize
    render_docx.build_context).

    Generalized from the spike's risk-register-specific build to walk the GENERIC
    envelope (or the flat spike shape): scalars → ``{k: _cell(v)}``; collections →
    ``{k: [{col: _cell(cell) for col, cell in row.items()} for row in rows]}``. None
    leaves are blanked to '' for clean cells.

    ``numeric_hook`` (the D-11 generic hook) — when provided, ``numeric_hook(row) ->
    dict`` is called per collection row and its returned derived fields are merged into
    that row. Default ``None`` means NO derived compute — the Low=1/Med=2/High=3,
    score=P×I VALUES are Phase 104 content, NOT here. The tool stays generic. To keep
    the trusted ``risk-register.docx`` template (which references ``{{ r.score }}``)
    rendering with the default hook, every collection row gets a blank ``score`` key
    unless the hook supplies one.

    THIRD branch (Plan 101.1-04 / D-09): a FLAT ``EmitFieldMap`` dict is normalized to
    the legacy envelope FIRST (the SAME mapping the nested path consumes) so the render
    context — and therefore the rendered bytes through the UNCHANGED docxtpl driver — is
    IDENTICAL to the equivalent nested map (WR-04 "two copies cannot drift").
    """
    if _is_flat_emit_field_map_dict(field_map_dict):
        field_map_dict = _flat_emit_field_map_to_legacy_dict(field_map_dict)
    ctx: dict = {}

    scalars = field_map_dict.get("scalars")
    collections = field_map_dict.get("collections")
    if scalars is not None or collections is not None:
        for key, cited in (scalars or {}).items():
            ctx[key] = _cell(cited)
        for cname, rows in (collections or {}).items():
            ctx[cname] = [_build_row(row, numeric_hook) for row in (rows or [])]
        return ctx

    # Flat spike-style shape: top-level Cited scalars + any list value is a collection.
    for key, val in field_map_dict.items():
        if isinstance(val, list):
            ctx[key] = [_build_row(row, numeric_hook) for row in val]
        else:
            ctx[key] = _cell(val)
    return ctx


def _build_row(row: dict | None, numeric_hook: Optional[Callable[[dict], dict]]) -> dict:
    """Build one collection row's render context: every column blanked-safe via _cell,
    plus a default blank ``score`` (so templates referencing a derived field render with
    the no-hook default), plus any derived fields the optional ``numeric_hook`` supplies."""
    row = row or {}
    r = {col: _cell(cited) for col, cited in row.items()}
    # Default-blank derived field so trusted templates referencing {{ r.score }} render
    # cleanly with the generic (no-hook) default — the VALUE is Phase 104's job (D-11).
    r.setdefault("score", "")
    if numeric_hook is not None:
        derived = numeric_hook(row) or {}
        for k, v in derived.items():
            r[k] = "" if v is None else v
    return r


# ---------------------------------------------------------------------------
# 5. Trusted render — docxtpl/Jinja with SSTI containment + autoescape (TMPL-03)
#    PORT render_docx.render VERBATIM. Heavy-lib imports are FUNCTION-LOCAL (Pitfall 4).
# ---------------------------------------------------------------------------


def render_docx_template(template_path: str, context: dict, out_path: str) -> dict:
    """Trusted docxtpl render with SSTI containment + autoescape, then save.

    ``SandboxedEnvironment(autoescape=True)`` is load-bearing and MANDATORY regardless
    of provenance (TMPL-03 defense-in-depth, T-101-02-01/02):
      - SandboxedEnvironment → SSTI containment: blocks attribute/builtin access.
      - autoescape=True       → XML-safe values: ``& < >`` in KB strings are escaped so
        they cannot corrupt the OOXML.

    docxtpl owns the bytes; the LLM never does. A ``{%tr %}``/``{%p %}`` tag split across
    a structural boundary raises ``TemplateSyntaxError`` — caught and reported as
    ``{rendered: False, error: ...}``, NOT crashed. The heavy-lib imports live INSIDE
    the function (the backend venv has no docxtpl — Pitfall 4; this runs in the sandbox).

    Returns ``{"rendered": bool, "error": str | None}``.
    """
    from docxtpl import DocxTemplate
    from jinja2 import TemplateSyntaxError
    from jinja2.sandbox import SandboxedEnvironment

    doc = DocxTemplate(template_path)
    jenv = SandboxedEnvironment(autoescape=True)  # SSTI containment + XML-safe (&<>)
    try:
        doc.render(context, jinja_env=jenv)  # docxtpl owns the bytes; the LLM never does
    except TemplateSyntaxError as exc:  # tag spans a structural boundary
        return {"rendered": False, "error": f"TemplateSyntaxError: {exc}"}
    doc.save(out_path)
    return {"rendered": True, "error": None}


# ---------------------------------------------------------------------------
# 6. Arbitrary render — the NET-NEW run-coalescing scalar replace (Pitfall 1)
#    NEVER imports docxtpl/jinja2 → SSTI is structurally impossible on this path.
# ---------------------------------------------------------------------------


def _replace_in_paragraph(paragraph, flat_scalars: dict[str, str]) -> tuple[set[str], set[str]]:
    """Run-coalescing scalar replace within ONE paragraph.

    The load-bearing algorithm (RESEARCH Pitfall 1, no production analog). Word
    fragments a literal ``{{token}}`` across multiple ``<w:r>`` runs (spellcheck /
    formatting toggles) — a naive ``runs[0].text.replace(...)`` only replaces the first
    fragment and orphans the rest → a silent non-fill.

    Two-stage approach:
      (a) Compute the paragraph's full concatenated text. If it contains NO replaceable
          token, leave the runs UNTOUCHED (preserve formatting; failure mode (b) — never
          match literal braces the user wanted that aren't in the scalar map).
      (b) If it does contain a token: do the replace on the full text, then COALESCE —
          set ``runs[0].text`` to the fully-replaced text and clear ``runs[1:]`` to ''.
          ``run.text =`` via python-docx auto-XML-escapes on write (the python-docx
          contract, NOT the docxtpl autoescape one). Accepts that a token split across
          DIFFERENT-format runs loses the trailing run's formatting (failure mode (a) —
          acceptable for content fill).

    UNMATCHED placeholder-shaped tokens (a bare-identifier ``{{token}}`` NOT in the
    scalar map) are BLANKED — never delivered as a surviving template tag (the "lean
    blank for clean cells" choice — RESEARCH Pitfall 1 step 3; the residual-scan contract
    is that NO ``{{``/``}}`` survives a fill, T-101-02-05). Only bare-identifier tokens
    are blanked (``_PLACEHOLDER_TOKEN_RE``) so arbitrary literal ``{{`` the user actually
    wanted is left intact (failure mode (b)).

    Returns (replaced_keys, matched_keys) for this paragraph.
    """
    runs = paragraph.runs
    if not runs:
        return set(), set()

    full = paragraph.text
    matched: set[str] = set()
    replaced_text = full
    for key, value in flat_scalars.items():
        token = "{{" + key + "}}"
        if token in replaced_text:
            matched.add(key)
            replaced_text = replaced_text.replace(token, value)

    # Blank any remaining placeholder-shaped token (unmatched intended placeholders).
    blanked_text = _PLACEHOLDER_TOKEN_RE.sub("", replaced_text)
    touched = matched or (blanked_text != replaced_text)
    replaced_text = blanked_text

    if not touched:
        return set(), matched  # no token here → leave runs (and their formatting) intact

    # Coalesce: whole replaced text into run[0] (keeps run[0]'s formatting), clear the rest.
    runs[0].text = replaced_text
    for r in runs[1:]:
        r.text = ""
    return matched, matched


def run_replace_docx(template_path: str, scalars: dict, out_path: str) -> dict:
    """The arbitrary-upload engine: run-coalescing scalar ``{{token}}`` replace.

    PROVENANCE-routed here for ``kind='template_input'`` uploads (D-02) — this path
    NEVER imports docxtpl or jinja2 (the SSTI-structurally-impossible property,
    T-101-02-04). Scalar-only: NO loops, NO table growth (variable collections are a
    trusted-path-only capability — D-04).

    ``scalars`` values may be a ``Cited`` dict (take ``.get('value')``) or a raw string;
    None → '' (blank). Walks: each body paragraph, each table cell paragraph, and each
    section header/footer paragraph (the python-docx-traversable surface). Text boxes /
    SmartArt / footnotes python-docx cannot reach are a documented limit — the residual
    scan (``residual_tags_in``) catches a surviving token as an honest fail, never a
    silent corruption (T-101-02-05).

    Returns ``{rendered, error, replaced_keys, unmatched_keys}``.
    """
    from docx import Document

    # (a) Build a flat {token_key: str_value} map — Cited dict → its .value, else the raw value.
    flat_scalars: dict[str, str] = {}
    for key, raw in (scalars or {}).items():
        if isinstance(raw, dict):
            v = raw.get("value")
        else:
            v = raw
        flat_scalars[key] = "" if v is None else str(v)

    doc = Document(template_path)
    replaced_keys: set[str] = set()
    matched_keys: set[str] = set()

    def _walk(paragraphs):
        for p in paragraphs:
            rep, mat = _replace_in_paragraph(p, flat_scalars)
            replaced_keys.update(rep)
            matched_keys.update(mat)

    # Body paragraphs.
    _walk(doc.paragraphs)
    # Table cell paragraphs.
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                _walk(cell.paragraphs)
    # Section header/footer paragraphs.
    for section in doc.sections:
        _walk(section.header.paragraphs)
        _walk(section.footer.paragraphs)

    doc.save(out_path)

    unmatched_keys = sorted(set(flat_scalars.keys()) - matched_keys)
    return {
        "rendered": True,
        "error": None,
        "replaced_keys": sorted(replaced_keys),
        "unmatched_keys": unmatched_keys,
    }


# ---------------------------------------------------------------------------
# 7. Residual-tag scan — the deterministic silent-miss detector (PORT render_docx.py:144)
# ---------------------------------------------------------------------------

_RESIDUAL_TOKENS = ("{{", "}}", "{%", "%}")


def _hits(texts: list[str]) -> list[str]:
    hits: list[str] = []
    for txt in texts:
        if txt and any(tok in txt for tok in _RESIDUAL_TOKENS):
            hits.append(txt.strip()[:80])
    return hits


def residual_tags_in(out_path: str, fmt: str) -> list[str]:
    """Any leftover Jinja/token markup after a render = a NOT-substituted tag (a silent
    non-fill). Re-opens the produced file and scans every text span; returns the hits.

    docx → body paragraphs + table cells; pptx → shape/text-frame runs + table cells;
    xlsx → cell values. The heavy-lib imports are function-local (sandbox-only at
    runtime — Pitfall 4). An empty list = no surviving token (a clean fill).
    """
    fmt = fmt.lower()
    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)
        texts = [p.text for p in doc.paragraphs]
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    texts.append(cell.text)
        return _hits(texts)

    if fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)
        texts: list[str] = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        for run in para.runs:
                            texts.append(run.text)
                if shape.has_table:
                    for row in shape.table.rows:
                        for cell in row.cells:
                            texts.append(cell.text)
        return _hits(texts)

    if fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)
        texts = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                for val in row:
                    if isinstance(val, str):
                        texts.append(val)
        return _hits(texts)

    raise ValueError(f"residual_tags_in: unsupported fmt {fmt!r} (expected docx/pptx/xlsx)")


# ---------------------------------------------------------------------------
# 8. Integrity re-open — the universal "will it open" oracle (TMPL-03, D-06/D-07)
#    PORT render_docx.assert_integrity, extended to all three formats.
# ---------------------------------------------------------------------------

# D-06 "no silent caps": the documented hard limits per format (state-of-the-art —
# python-pptx ≥1.0.0 cannot grow tables; openpyxl drops charts on save).
_PPTX_TABLE_LIMIT = "pptx cannot grow tables (python-pptx >=1.0.0)"
_XLSX_CHART_LIMIT = "openpyxl drops charts on save"


def assert_integrity(out_path: str, fmt: str) -> dict:
    """Re-open the produced file with the SAME library — the ground-truth corruption
    oracle (TMPL-03 / D-07). A file that fails re-open is NEVER delivered.

    docx → ``Document(path)``; pptx → ``Presentation(path)``; xlsx →
    ``load_workbook(path)``. Each loader RAISES on a corrupt/unopenable file — the
    exception propagates so the caller catches it → ``verdict.opened`` is False → the
    file is never written (test_corrupt_file_never_delivered). Heavy-lib imports are
    function-local (Pitfall 4).

    Returns ``{opened, residual_tags, residual_clean, rows, documented_limit}``:
      - ``rows`` (docx only) — total table rows across the document (the row-growth
        probe asserts ``header + N``); 0 for pptx/xlsx.
      - ``documented_limit`` — a fixed string for pptx-with-a-table / xlsx-with-charts
        (D-06 "no silent caps"), else None.
    """
    fmt = fmt.lower()
    residuals = residual_tags_in(out_path, fmt)
    documented_limit: str | None = None
    rows = 0

    if fmt == "docx":
        from docx import Document

        doc = Document(out_path)  # raises if corrupt / won't open
        rows = sum(len(t.rows) for t in doc.tables)

    elif fmt == "pptx":
        from pptx import Presentation

        prs = Presentation(out_path)  # raises if corrupt / won't open
        # D-06: pptx cannot grow tables — flag the limit when the deck HAS a table.
        has_table = any(
            getattr(shape, "has_table", False) for slide in prs.slides for shape in slide.shapes
        )
        if has_table:
            documented_limit = _PPTX_TABLE_LIMIT

    elif fmt == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(out_path)  # raises if corrupt / won't open
        # D-06: openpyxl drops charts on save — flag the limit when the book HAS charts.
        has_chart = any(getattr(ws, "_charts", None) for ws in wb.worksheets)
        if has_chart:
            documented_limit = _XLSX_CHART_LIMIT

    else:
        raise ValueError(f"assert_integrity: unsupported fmt {fmt!r} (expected docx/pptx/xlsx)")

    return {
        "opened": True,
        "rows": rows,
        "residual_tags": residuals,
        "residual_clean": len(residuals) == 0,
        "documented_limit": documented_limit,
    }


# ---------------------------------------------------------------------------
# 9. Engine selection by provenance (D-02 security boundary)
# ---------------------------------------------------------------------------

# A library AssetRef (authored/versioned/no-TTL, trusted) → docxtpl/Jinja.
_DOCXTPL_PROVENANCES = frozenset({"library", "asset", "assetref", "docxtpl"})
# An ephemeral upload (untrusted) → the non-Jinja run-replace engine.
_RUN_REPLACE_PROVENANCES = frozenset({"template_input", "upload", "ephemeral", "run_replace"})


def select_engine(provenance: str) -> str:
    """Select the fill engine from the template's PROVENANCE, never its content (D-02).

    A library ``AssetRef`` → ``"docxtpl"`` (trusted Jinja, row growth). An ephemeral
    ``kind='template_input'`` upload → ``"run_replace"`` (non-Jinja, scalar only). The
    untrusted ``template_input`` branch MUST return ``"run_replace"`` and can NEVER
    return ``"docxtpl"`` — the D-02 security boundary that makes SSTI structurally
    impossible for uploads (asserted below).
    """
    key = (provenance or "").strip().lower()

    if key in _RUN_REPLACE_PROVENANCES:
        engine = "run_replace"
        # D-02 hard invariant: an untrusted upload NEVER reaches Jinja.
        assert engine != "docxtpl", "untrusted upload must NEVER route to the Jinja engine"
        return engine

    if key in _DOCXTPL_PROVENANCES:
        return "docxtpl"

    raise ValueError(
        f"select_engine: unknown provenance {provenance!r} "
        f"(expected one of {sorted(_DOCXTPL_PROVENANCES | _RUN_REPLACE_PROVENANCES)})"
    )
