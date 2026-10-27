"""Phase 289 (VIS-03 / D-01) — the four sections of a finished run's evidence, composed.

PURE. No pool, no connection, no I/O, no clock. Every function here takes rows the route
(``api/workflow_run_evidence.py``) has already read under its one access query and turns them
into the wire dicts of ``RunEvidenceRead``. Keeping the privacy rules in pure code is what
lets them be pinned case by case (``tests/unit/test_289_run_evidence.py``) without a database.

The four sections and their one source each:

  * definition   — ``workflow_runs.definition_snapshot`` (migration 122), decoded through
                   ``_coerce_definition`` (imported, never copied). A run from before that
                   migration has no snapshot; it says ``recorded: False`` and the caller hands
                   in the live row as the fallback, so the page can say so instead of passing
                   the live row off as what ran (D-04).
  * phase log    — ``workflow_phases`` rows, each parsed ONCE through ``phase_output_object``
                   (the jsonb string-scalar unwrap), mirroring the owner read's per-row
                   derivation: ``declared_phase_measure``, the ``text`` key by name, the
                   ``_failure_reason`` strip-to-None, and ``confidence_for_wire``.
  * verdicts     — ``harness_audit`` rows of eleven kinds. ``metadata`` is double-encoded by
                   ``write_audit``, so it goes through the same unwrap. Only the phase slug is
                   read off it; nothing else on the metadata travels (an error string can carry
                   model or document text).
  * sources      — each phase's recorded ``citations``, deduped by ``(document_id,
                   chunk_index)`` with chat's own ``_deduplicate_citations``. Neither the
                   passage text nor the similarity score is ever copied (the
                   ``WorkflowRunCitationRead`` allow-list precedent).

Privacy for a same-org colleague (A-06, R-01..R-04): no owner email, no passage, no score; a
document the colleague cannot read under their own RLS is masked down to its step numbers, AND
the output of any step that cited it is withheld behind ``WITHHELD_OUTPUT_SENTENCE`` (CR-01);
the human-input step reports only whether it was answered.
"""
from __future__ import annotations

import posixpath
import re
from typing import Any, Iterable

from app.api.workflow_runs import (
    _WAITING_FALLBACK_NAME,
    _coerce_definition,
    _slug_to_phase_type,
    unsourced_who,
)
from app.models.thread import declared_phase_measure, phase_output_object
from app.services.harness.phase_confidence import confidence_for_wire
from app.services.harness.run_read_wire import unsourced_for_wire

# ── verdict kinds (R-03) ──────────────────────────────────────────────────────────────────
# Checks: the run asked a question of its own output and recorded the answer.
_CHECK_RESULT: dict[str, str] = {
    "gate_passed": "passed",
    "emit_validated": "passed",
    "validator_ask_user_approved": "passed",
    "gate_failed": "failed",
    "emit_rejected": "failed",
    "emit_integrity_failed": "failed",
}
# Recorded decisions: something the run did or was stopped from doing, with no pass/fail.
_RECORDED_KINDS: frozenset[str] = frozenset(
    {
        "policy_applied",
        "action_risk_pending",
        "tool_refused",
        "external_action_sent",
        "circuit_breaker_tripped",
    }
)
# ⚠ ``judge_verdict`` is deliberately absent: it is written on the PUBLISH golden run, never on
# an ordinary run, so an "Independent review" row here would describe something that did not
# happen to this run (R-03). Anything not named in the two lists above is dropped.
VERDICT_KINDS: tuple[str, ...] = tuple(sorted(set(_CHECK_RESULT) | _RECORDED_KINDS))
_GATE_KINDS = frozenset({"gate_passed", "gate_failed"})
# 289-REVIEW WR-03: a COMPOSED kind (no audit row carries it) for a `gate_failed` the engine
# wrote because the phase hit its wall clock before any validator ran (``harness_engine.py``,
# ``gate_error = f"wall_clock_timeout after {wall_clock}s"``). It is a recorded decision, not
# a check, so the report neither names validators as checked nor counts a failed check.
_TIMED_OUT_KIND = "gate_timed_out"
_WALL_CLOCK_TIMEOUT_PREFIX = "wall_clock_timeout"

_HUMAN_INPUT = "llm_human_input"

# 289-REVIEW CR-01 (T-289-31 MITIGATED for masked citations). A step's ``output_text`` is the
# model's synthesis of the passages it cited, so masking a source row while shipping that text
# would print the private document's content one row above "A document you don't have access
# to". For a non-owner, a step that cited ANY document they cannot read gets this sentence in
# place of its output. Same vocabulary as the masked source (``MASKED_SOURCE`` in
# ``frontend/src/components/workflows/evidenceVocabulary.ts``).
WITHHELD_OUTPUT_SENTENCE = "This step's output draws on a document you don't have access to."

# 296-01 (BUG-261020-02 / D-05). A later step is built on the earlier steps' outputs, so once a
# step is withheld for a citation, every LATER step can carry the withheld document's substance
# even when it cites nothing itself. For a non-owner, every step after the first withheld one
# gets this sentence (UI-SPEC A, exact words). Only a CITATION withhold starts the cascade: the
# human-input null-out (the owner's question and answer) never does (Pitfall 9).
WITHHELD_UPSTREAM_SENTENCE = (
    "This step builds on an earlier step you don't have access to, so its output is withheld too."
)

# 296-01 (289-IN-04). The readability check casts the cited ids to ``uuid[]``; ONE malformed id
# fails the whole cast and the fail-closed except then masks EVERY source. Only canonical UUIDs go
# to the read; a dropped id is never readable, so its citation stays masked (fail closed).
_CANONICAL_UUID = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def is_canonical_uuid(value: Any) -> bool:
    """True for an 8-4-4-4-12 hex string — the only shape the ``uuid[]`` cast is given."""
    return isinstance(value, str) and _CANONICAL_UUID.match(value) is not None


def _phase_specs(definition: Any) -> list[dict]:
    """The definition's phase dicts in ``phase_index`` order (stable for ties / missing)."""
    if not isinstance(definition, dict):
        return []
    raw = definition.get("phases")
    if not isinstance(raw, list):
        return []
    specs = [p for p in raw if isinstance(p, dict) and isinstance(p.get("slug"), str)]

    def _key(item: tuple[int, dict]) -> tuple[int, int]:
        pos, spec = item
        idx = spec.get("phase_index")
        return (idx if isinstance(idx, int) and not isinstance(idx, bool) else pos, pos)

    return [spec for _pos, spec in sorted(enumerate(specs), key=_key)]


def _name_by_slug(definition: Any) -> dict[str, str]:
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    names: dict[str, str] = {}
    for spec in _phase_specs(definition):
        cleaned = _clean_label(spec.get("name"))
        if cleaned:
            names[spec["slug"]] = cleaned
    return names


def _int_or_none(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


# ── definition (D-04) ─────────────────────────────────────────────────────────────────────


def compose_definition(
    snapshot_raw: Any, fallback_raw: Any, fallback_version: int | None = None
) -> dict:
    """The definition that ran. ``recorded`` is False ONLY when no snapshot exists.

    ⚠ ``is None``, never truthiness (the owner read's rule): an empty dict is a definition that
    was recorded and held nothing, a different fact from never having been recorded.
    """
    snapshot = _coerce_definition(snapshot_raw)
    recorded = snapshot is not None
    definition = snapshot if recorded else _coerce_definition(fallback_raw)
    version = _int_or_none((definition or {}).get("version"))
    if version is None:
        version = _int_or_none(fallback_version)
    names = _name_by_slug(definition)
    types = _slug_to_phase_type(definition)
    phases = [
        {
            "n": n,
            "slug": spec["slug"],
            "name": names.get(spec["slug"]) or spec["slug"],
            "phase_type": types.get(spec["slug"]),
        }
        for n, spec in enumerate(_phase_specs(definition), start=1)
    ]
    return {"recorded": recorded, "version": version, "phases": phases, "full": definition}


def _normalise(definition: Any) -> dict | None:
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415

    decoded = _coerce_definition(definition)
    if decoded is None:
        return None
    try:
        return WorkflowDefinition.model_validate(decoded).model_dump(mode="json")
    except Exception:  # noqa: BLE001 — an old or odd shape: fall back to the version rule
        return None


def definition_changed(
    snapshot: Any, same_slug_versions: Iterable[Any], own_row: dict | None
) -> dict:
    """Whether the workflow has moved on since this run (Pitfall 5).

    Changed when a same-slug definition in the run's org carries a higher version, OR when the
    run's own definition row is a draft whose NORMALISED definition differs from the
    normalised snapshot. Never ``updated_at``: a published row is bumped by ``skill_snapshots``
    writes at first kickoff with no edit at all.
    """
    snap = _coerce_definition(snapshot)
    own = own_row if isinstance(own_row, dict) else {}
    base = _int_or_none((snap or {}).get("version"))
    if base is None:
        base = _int_or_none(own.get("version"))
    newer = [
        v for v in (_int_or_none(x) for x in (same_slug_versions or [])) if v is not None
    ]
    newer = [v for v in newer if base is not None and v > base]
    changed = bool(newer)
    if not changed and snap is not None and own.get("status") == "draft":
        left = _normalise(snap)
        right = _normalise(own.get("definition"))
        if left is not None and right is not None and left != right:
            changed = True
    return {"changed": changed, "current_version": max(newer) if newer else None}


# ── phase log (R-04 / R-05) ───────────────────────────────────────────────────────────────


def _ordered_rows(rows: Iterable[dict]) -> list[dict]:
    """Rows in ``phase_index`` order; a row with no readable index sorts last (stable)."""
    listed = [r for r in (rows or []) if isinstance(r, dict)]

    def _key(row: dict) -> int:
        idx = _int_or_none(row.get("phase_index"))
        return idx if idx is not None else 1 << 30

    return sorted(listed, key=_key)


def _nonblank(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def compose_phase_log(
    rows: Iterable[dict],
    definition: Any,
    viewer_is_owner: bool,
    owner_name: str | None,
    kb_label: str,
    readable_ids: set[str] | None = None,
) -> list[dict]:
    """One entry per durable phase row, numbered from 1 in ``phase_index`` order.

    ``readable_ids`` follows ``compose_sources``: ``None`` for the owner (nothing withheld);
    for anyone else, a step citing a document outside the set has its ``output_text``
    replaced by ``WITHHELD_OUTPUT_SENTENCE`` (CR-01), and every LATER step with an output gets
    ``WITHHELD_UPSTREAM_SENTENCE`` (296-01, D-05). An EMPTY set (the RLS check failed) withholds
    every citing step's output and everything after the first one: fail closed.
    """
    names = _name_by_slug(definition)
    types = _slug_to_phase_type(_coerce_definition(definition))
    # 295-05 (D-04): the viewer's words for the unsourced mark, through the one name chain.
    # ``owner_name`` already went through it (``started_by``); a colleague gets no name.
    who = unsourced_who(is_owner=viewer_is_owner, display_name=owner_name, viewer_email=None)
    log: list[dict] = []
    withheld_upstream = False  # 296-01 (D-05): set ONLY by a citation withhold below
    for n, row in enumerate(_ordered_rows(rows), start=1):
        slug = row.get("slug") if isinstance(row.get("slug"), str) else ""
        phase_type = types.get(slug)
        # ONE parse per row, feeding every fact below (the owner read's rule).
        obj = phase_output_object(row.get("output"))
        count, noun = declared_phase_measure(obj)
        raw_text = obj.get("text") if isinstance(obj, dict) else None
        output_text = raw_text if isinstance(raw_text, str) and raw_text else None
        raw_reason = obj.get("_failure_reason") if isinstance(obj, dict) else None
        failure_reason = _nonblank(raw_reason)
        raw_confidence = obj.get("confidence") if isinstance(obj, dict) else None
        raw_unsourced = obj.get("unsourced") if isinstance(obj, dict) else None
        human_input = None
        if phase_type == _HUMAN_INPUT:
            answer = _nonblank(obj.get("answer")) if isinstance(obj, dict) else None
            answered = answer is not None
            if viewer_is_owner:
                human_input = {
                    "answered": answered,
                    "question": output_text,
                    "answer": answer,
                    "answered_by": (owner_name or None) if answered else None,
                }
            else:
                # R-04: the question and the answer are the owner's; a colleague learns only
                # that the gate was (or was not) answered. ``text`` IS the question here.
                human_input = {
                    "answered": answered, "question": None, "answer": None, "answered_by": None,
                }
                output_text = None
        if not viewer_is_owner and readable_ids is not None and output_text is not None:
            if any(c["document_id"] not in readable_ids for c in _citations_of(row)):
                output_text = WITHHELD_OUTPUT_SENTENCE
                withheld_upstream = True
            elif withheld_upstream:
                output_text = WITHHELD_UPSTREAM_SENTENCE
        log.append(
            {
                "n": n,
                "slug": slug,
                "name": names.get(slug) or slug,
                "phase_type": phase_type,
                "status": row.get("status") if isinstance(row.get("status"), str) else "",
                "started_at": row.get("started_at"),
                "completed_at": row.get("completed_at"),
                "step_count": count,
                "step_noun": noun,
                "output_text": output_text,
                "failure_reason": failure_reason,
                "confidence": confidence_for_wire(raw_confidence, kb_label),
                "human_input": human_input,
                # 295-05: the stored uuid is replaced by the words, never copied.
                "unsourced": unsourced_for_wire(raw_unsourced, who=who),
            }
        )
    return log


def step_numbers(phase_log: Iterable[dict]) -> dict[str, int]:
    """``slug -> n`` off the composed phase log, the one numbering every section shares."""
    return {e["slug"]: e["n"] for e in phase_log if isinstance(e, dict) and e.get("slug")}


# ── verdicts (R-03) ───────────────────────────────────────────────────────────────────────


def _validator_kinds(definition: Any) -> dict[str, list[tuple[str, str]]]:
    out: dict[str, list[tuple[str, str]]] = {}
    for spec in _phase_specs(_coerce_definition(definition)):
        kinds: list[tuple[str, str]] = []
        for v in spec.get("validators") or []:
            if isinstance(v, dict) and isinstance(v.get("kind"), str):
                timing = v.get("timing") if v.get("timing") in ("pre", "post") else "post"
                kinds.append((v["kind"], timing))
        out[spec["slug"]] = kinds
    return out


def compose_verdicts(
    audit_rows: Iterable[dict], definition: Any, step_n_by_slug: dict[str, int]
) -> list[dict]:
    """Checks and recorded decisions, in recorded order. Only the phase slug leaves metadata."""
    validators = _validator_kinds(definition)
    verdicts: list[dict] = []
    for row in audit_rows or []:
        if not isinstance(row, dict):
            continue
        kind = row.get("event_type")
        if kind in _CHECK_RESULT:
            result = _CHECK_RESULT[kind]
        elif kind in _RECORDED_KINDS:
            result = "recorded"
        else:
            continue
        meta = phase_output_object(row.get("metadata")) or {}
        slug = meta.get("phase")
        if not isinstance(slug, str) or not slug:
            slug = meta.get("phase_slug")
        if not isinstance(slug, str) or not slug:
            slug = None
        checked: list[str] = []
        error = meta.get("error")
        if (
            kind == "gate_failed"
            and isinstance(error, str)
            and error.startswith(_WALL_CLOCK_TIMEOUT_PREFIX)
        ):
            # 289-REVIEW WR-03: the engine's wall-clock arm writes `gate_failed` when the phase
            # hung BEFORE its gates ran. Naming the phase's validators as "checked" (or counting
            # a failed check) would describe checks that never executed. Only the composed kind
            # leaves; the error text itself still never travels.
            kind, result = _TIMED_OUT_KIND, "recorded"
        elif kind in _GATE_KINDS and slug is not None:
            timing = "pre" if meta.get("timing") == "pre" else "post"
            checked = [k for (k, t) in validators.get(slug, []) if t == timing]
        verdicts.append(
            {
                "step_n": step_n_by_slug.get(slug) if slug is not None else None,
                "phase_slug": slug,
                "kind": kind,
                "result": result,
                "checked": checked,
                "at": row.get("created_at"),
            }
        )
    return verdicts


# ── sources (R-01) ────────────────────────────────────────────────────────────────────────


def cited_document_ids(rows: Iterable[dict]) -> list[str]:
    """Every distinct cited document id, in first-cited order (the RLS check's input).

    296-01 (289-IN-04): canonical UUIDs only — a malformed id would fail the ``uuid[]`` cast and
    mask every source. A dropped id is never readable, so its citation stays masked.
    """
    seen: list[str] = []
    for row in _ordered_rows(rows):
        for entry in _citations_of(row):
            doc = entry["document_id"]
            if is_canonical_uuid(doc) and doc not in seen:
                seen.append(doc)
    return seen


def _citations_of(row: dict) -> list[dict]:
    """The row's citations as NEW dicts of three named keys (never the stored object)."""
    obj = phase_output_object(row.get("output"))
    raw = obj.get("citations") if isinstance(obj, dict) else None
    out: list[dict] = []
    if not isinstance(raw, list):
        return out
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        doc_id = entry.get("document_id")
        if not isinstance(doc_id, str) or not doc_id:
            continue
        filename = entry.get("filename")
        out.append(
            {
                "document_id": doc_id,
                "filename": filename if isinstance(filename, str) and filename else None,
                "chunk_index": _int_or_none(entry.get("chunk_index")),
            }
        )
    return out


def compose_sources(
    rows: Iterable[dict],
    step_n_by_slug: dict[str, int],
    readable_ids: set[str] | None,
) -> list[dict]:
    """Cited documents, grouped. ``readable_ids is None`` means the owner (full sources).

    For anyone else, a document outside ``readable_ids`` is masked down to the step numbers
    that cited it. An EMPTY set (the RLS check failed) masks every document: fail closed.
    """
    from app.services.agent_loop import _deduplicate_citations  # noqa: PLC0415

    tagged: list[dict] = []
    for row in _ordered_rows(rows):
        step = step_n_by_slug.get(row.get("slug"))
        for entry in _citations_of(row):
            tagged.append({**entry, "_step": step})

    groups: dict[str, dict] = {}
    for entry in tagged:
        doc = entry["document_id"]
        group = groups.setdefault(
            doc, {"filename": None, "locations": set(), "cited_by": set()}
        )
        if group["filename"] is None and entry["filename"]:
            group["filename"] = entry["filename"]
        if isinstance(entry["_step"], int):
            group["cited_by"].add(entry["_step"])
    for entry in _deduplicate_citations(tagged):
        if entry["chunk_index"] is not None:
            groups[entry["document_id"]]["locations"].add(entry["chunk_index"])

    sources: list[dict] = []
    for doc, group in groups.items():
        cited_by = sorted(group["cited_by"])
        if readable_ids is not None and doc not in readable_ids:
            sources.append(
                {"masked": True, "document_id": None, "filename": None,
                 "locations": [], "cited_by": cited_by}
            )
            continue
        sources.append(
            {"masked": False, "document_id": doc, "filename": group["filename"],
             "locations": sorted(group["locations"]), "cited_by": cited_by}
        )
    return sources


# ── deliverable (R-02) ────────────────────────────────────────────────────────────────────


def _completed_objects(rows: Iterable[dict]) -> list[dict]:
    out = []
    for row in _ordered_rows(rows):
        if row.get("status") != "completed":
            continue
        obj = phase_output_object(row.get("output"))
        out.append(obj if isinstance(obj, dict) else {})
    return out


def deliverable_path(rows: Iterable[dict]) -> str | None:
    """The workspace path of the LAST completed step that produced a file, or None."""
    for obj in reversed(_completed_objects(rows)):
        path = obj.get("path")
        if isinstance(path, str) and path.strip():
            return path
    return None


def compose_deliverable(rows: Iterable[dict], viewer_is_owner: bool, file_id: Any) -> dict:
    """What the run produced: a file (its name), the final step's text, or nothing."""
    rows = list(rows or [])
    path = deliverable_path(rows)
    if path is not None:
        name = posixpath.basename(path.replace("\\", "/")) or None
        return {
            "kind": "file",
            "name": name,
            "file_id": str(file_id) if viewer_is_owner and file_id is not None else None,
        }
    completed = _completed_objects(rows)
    if completed and _nonblank(completed[-1].get("text")):
        return {"kind": "text", "name": None, "file_id": None}
    return {"kind": "none", "name": None, "file_id": None}


def final_output_text(rows: Iterable[dict]) -> str | None:
    """293 (D-08): the LAST completed step's text, the same step ``compose_deliverable`` reads as
    a text deliverable; ``None`` when no step completed or it wrote nothing."""
    completed = _completed_objects(list(rows or []))
    return _nonblank(completed[-1].get("text")) if completed else None


# ── started by (A-06) ─────────────────────────────────────────────────────────────────────


def started_by(display_name: Any, owner_email: Any, viewer_is_owner: bool) -> dict:
    """Who started the run. A colleague gets a cleaned display name or the fallback words."""
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    name = _clean_label(display_name)
    if viewer_is_owner:
        email = owner_email if isinstance(owner_email, str) and owner_email else None
        return {
            "name": name or _clean_label(email) or _WAITING_FALLBACK_NAME,
            "email": email,
            "is_you": True,
        }
    return {"name": name or _WAITING_FALLBACK_NAME, "email": None, "is_you": False}


__all__ = [
    "VERDICT_KINDS",
    "WITHHELD_OUTPUT_SENTENCE",
    "WITHHELD_UPSTREAM_SENTENCE",
    "cited_document_ids",
    "compose_definition",
    "compose_deliverable",
    "compose_phase_log",
    "compose_sources",
    "compose_verdicts",
    "definition_changed",
    "deliverable_path",
    "final_output_text",
    "is_canonical_uuid",
    "started_by",
    "step_numbers",
]
