"""Phase 281 (FIX-09 / BUG-260730-02) — the ONE composer of an emit step's failure cause.

An ``llm_emit`` step can fail for different reasons on different sealed model calls: the
model narrated prose, the provider errored, the answer was cut off, the field-map left
template fields out, or the citation check refused uncited / invented values. Before this
module, every rejection went out as ONE failure value with ONE message naming all three
rejection causes, and a post-gate validator then overwrote even that with a shape message
(``citations_required: no field_map on output``). The golden run 43b34171 read
*"citations"* to its author with 100.0% citation coverage; its only missing key was
``rows``.

The executor (``phase_types._exec_llm_emit``) records one cause record per sealed shot (or
terminal arm) with :func:`shot_record`, and every surface reads the string
:func:`compose_emit_failure` builds from those records. The engine's gate path and its
no-validator ``fail_phase`` branch call the SAME function, so ``_failure_reason``,
``run_failed.reason``, the publish gauntlet's ``blocked_step.cause`` and the chat failure
message are one string (D-04). There is one composer and no per-surface re-wording.

THE HONESTY RULES (each is pinned by ``tests/unit/test_281_emit_cause.py``):

* **One composer.** Every emit-cause sentence and every "Check …" line lives in this file
  and nowhere else. The client holds no cause table (BUG-260815-06 req #3).
* **A cause that never happened is never named.** The word "citation" appears ONLY when an
  ``uncited`` or ``invented`` kind is present (D-01).
* **The head names the step ONLY by the author-set name the caller passes (D-32).** The
  caller scrubs ``PhaseSpec.name`` through ``publish_service._clean_label``; this leaf
  derives nothing. It never sees the slug and never invents a derived, config or type
  title. With no name the head reads "This step". Because one string serves every surface
  (D-04), a card whose headline is already ``nodeTitle`` repeats an author-set name once
  inside the cause — the recorded D-32 choice, preferred over splitting one failure into
  two strings.
* **Check, never fix; no promise.** Every kind carries exactly one server-written
  "Check …" line (D-03). No sentence says "fix", "soon", "later" or promises anything
  (sketch-findings ``run-honesty.md``).
* **An attempt is one sealed model call (D-25).** The header total is the number of
  records with ``attempt >= 1``; a terminal cause on the same call is merged into that
  call's record (:func:`record_terminal`), and an ``attempt`` 0 record (no model call was
  made) names its cause with no count anywhere (281-REVIEW WR-01). A shot that failed two checks (e.g. missing fields AND uncited values) counts
  under BOTH bullets, so bullet counts may sum above the header total: the merge key is
  the cause KIND, not the shot (Claude's discretion, recorded here).
* **Missing fields are named by the template's own placeholder names (D-02)**, in the
  order the executor's oracle produced them, unioned across merged shots: the first 5,
  then "and N more".

The module is a PURE LEAF: stdlib only, no I/O. It never imports ``phase_types``,
``harness_engine`` or anything under ``app.`` (the 200-03 one-module-per-concern
invariant); callers import it function-locally because of the ``harness`` package cycle.
"""

from __future__ import annotations

__all__ = [
    "KIND_MISSING_FIELDS",
    "KIND_UNCITED",
    "KIND_INVENTED",
    "KIND_NARRATED",
    "KIND_TRUNCATED",
    "KIND_PROVIDER_ERROR",
    "KIND_NO_TEMPLATE",
    "KIND_RENDER_FAILED",
    "KIND_INTEGRITY_FAILED",
    "KIND_UNEXPECTED",
    "KIND_ORDER",
    "FAILURE_TEMPLATE_FIELDS_MISSING",
    "shot_record",
    "record_terminal",
    "classify_forced_failure",
    "classify_rejection",
    "terminal_failure_value",
    "compose_emit_failure",
    "no_template_bound_sentence",
]

# ── The cause kinds (the merge key) ─────────────────────────────────────────────
KIND_MISSING_FIELDS = "missing_fields"
KIND_UNCITED = "uncited"
KIND_INVENTED = "invented"
KIND_NARRATED = "narrated"
KIND_TRUNCATED = "truncated"
KIND_PROVIDER_ERROR = "provider_error"
KIND_NO_TEMPLATE = "no_template_bound"
KIND_RENDER_FAILED = "render_failed"
KIND_INTEGRITY_FAILED = "integrity_failed"
KIND_UNEXPECTED = "unexpected"

#: Tie-break order for bullets with equal counts (and the order classify_rejection returns).
KIND_ORDER = (
    KIND_MISSING_FIELDS,
    KIND_UNCITED,
    KIND_INVENTED,
    KIND_NARRATED,
    KIND_TRUNCATED,
    KIND_PROVIDER_ERROR,
    KIND_NO_TEMPLATE,
    KIND_RENDER_FAILED,
    KIND_INTEGRITY_FAILED,
    KIND_UNEXPECTED,
)

#: The failure VALUE for a shot rejected ONLY because template fields were missing (D-30).
#: Any shot whose citation check failed keeps ``citation_gate_rejected``.
FAILURE_TEMPLATE_FIELDS_MISSING = "template_fields_missing"
_FAILURE_CITATION_GATE_REJECTED = "citation_gate_rejected"

_MAX_NAMED_FIELDS = 5
_DETAIL_MAX_CHARS = 200

# ── The words (D-01 / D-03). Lowercase sentence bodies follow "• k attempts — ". ──
_MISSING_FIELDS_SENTENCE = "filled the template, but these fields were missing: {names}."
_UNCITED_SENTENCE = "the citation check failed: {n} {values} cited no source."
_UNCITED_MERGED_SENTENCE = "the citation check failed: up to {n} {values} in one attempt cited no source."
_INVENTED_SENTENCE = (
    "the citation check failed: {n} {values} cited a source that was never retrieved."
)
_INVENTED_MERGED_SENTENCE = (
    "the citation check failed: up to {n} {values} in one attempt cited a source that was "
    "never retrieved."
)
_NARRATED_SENTENCE = "the model wrote prose instead of filling the template."
_TRUNCATED_SENTENCE = "the model's answer was cut off before the template was filled."
_PROVIDER_ERROR_SENTENCE = "the model provider returned an error."
_NO_TEMPLATE_SENTENCE = "no template is attached to this step{detail}."
_RENDER_FAILED_SENTENCE = "the template could not be filled in{detail}."
_INTEGRITY_FAILED_SENTENCE = (
    "the filled file did not open cleanly, or still had unfilled placeholders."
)
_UNEXPECTED_SENTENCE = "the step stopped on an unexpected error."

#: Phase 295 (D-12 / UI-SPEC E.1) — the PRE-RUN refusal for a fill step with no template.
#: ONE home for every surface that says it before a run starts: the lint finding
#: (``reachability``), so ``/validate`` and the publish refusal, then the chat kickoff and the
#: scheduled launch, which read it off that finding. It names no code. The run-time bullet
#: body above (``_NO_TEMPLATE_SENTENCE``) is a different sentence for a different moment (a
#: run that already started) and stays as shipped.
_NO_TEMPLATE_BOUND_REFUSAL = (
    "“{step}” fills a template, but no template is attached to this workflow. "
    "Attach a template before you publish or run it."
)

#: Exactly one "Check …" line per kind (D-03) — worded as CHECK, never as fix.
_CHECK_LINES: dict[str, str] = {
    KIND_MISSING_FIELDS: "Check that the template's field names match what this step produces.",
    KIND_UNCITED: "Check that the step before this one finds the documents these values come from.",
    KIND_INVENTED: "Check that the step before this one retrieves the documents this step cites.",
    KIND_NARRATED: "Check which model this step uses.",
    KIND_TRUNCATED: "Check which model this step uses and how long its answer may be.",
    KIND_PROVIDER_ERROR: "Check that this step's model provider is reachable.",
    KIND_NO_TEMPLATE: "Check that this step names a template.",
    KIND_RENDER_FAILED: "Check that the template file opens and its placeholders are well formed.",
    KIND_INTEGRITY_FAILED: "Check the template file.",
    KIND_UNEXPECTED: "Check the run's audit log for this step.",
}


def shot_record(
    attempt: int,
    kinds: list[str],
    *,
    missing: list[str] | None = None,
    uncited: int = 0,
    invented: int = 0,
    detail: str | None = None,
) -> dict:
    """One JSON-safe cause record for one sealed shot (or one terminal arm).

    ``missing`` is carried only when ``missing_fields`` is among the kinds; ``detail`` (the
    dynamic, already-server-written part of a terminal message) only when given.
    """
    record: dict = {
        "attempt": int(attempt),
        "kinds": [str(k) for k in kinds],
        "uncited": int(uncited or 0),
        "invented": int(invented or 0),
    }
    if KIND_MISSING_FIELDS in record["kinds"]:
        record["missing"] = [str(m) for m in (missing or [])]
    if detail is not None:
        record["detail"] = str(detail)
    return record


def record_terminal(records: list, attempt: int, kind: str, *, detail: str | None = None) -> None:
    """Attach a terminal cause (render / integrity / unexpected) to the call it belongs to.

    281-REVIEW WR-01 (D-25): an attempt is ONE model call. A non-strict citation policy
    delivers the last rejected shot to the render, so a render failure after it belongs to
    THAT call's record — appending a new record would count one call twice. A different
    (or no previous) call gets its own record. Mutates ``records`` in place.
    """
    if records and isinstance(records[-1], dict) and records[-1].get("attempt") == int(attempt):
        last = records[-1]
        kinds = last.setdefault("kinds", [])
        if kind not in kinds:
            kinds.append(str(kind))
        if detail is not None:
            last["detail"] = str(detail)
        return
    records.append(shot_record(attempt, [kind], detail=detail))


def classify_forced_failure(failure: str | None, truncated: bool) -> str:
    """State (a): the forced shot never produced a field-map. A provider that threw is
    not a model that narrated (Pitfall 9); a cut-off answer is not prose."""
    if failure == "provider_error":
        return KIND_PROVIDER_ERROR
    if truncated:
        return KIND_TRUNCATED
    return KIND_NARRATED


def classify_rejection(
    *, uncited: int, invented: int, missing: list[str], oracle_present: bool
) -> list[str]:
    """State (b): which of the gate's three checks refused this shot, in ``KIND_ORDER``.

    Missing keys count only when a template oracle exists — without one the executor's
    placeholder list IS the emitted keys and nothing can be missing.
    """
    kinds: list[str] = []
    if oracle_present and missing:
        kinds.append(KIND_MISSING_FIELDS)
    if uncited:
        kinds.append(KIND_UNCITED)
    if invented:
        kinds.append(KIND_INVENTED)
    return kinds


def terminal_failure_value(kinds: list[str]) -> str:
    """The failure VALUE of the shot that ended the invocation (D-30)."""
    if list(kinds) == [KIND_MISSING_FIELDS]:
        return FAILURE_TEMPLATE_FIELDS_MISSING
    return _FAILURE_CITATION_GATE_REJECTED


def _plural(n: int, one: str, many: str) -> str:
    return one if n == 1 else many


def _names(missing: list[str]) -> str:
    shown = ", ".join(missing[:_MAX_NAMED_FIELDS])
    rest = len(missing) - _MAX_NAMED_FIELDS
    return f"{shown}, and {rest} more" if rest > 0 else shown


def _detail_suffix(detail: str | None) -> str:
    """``": <detail>"`` — one line, bounded to ``_DETAIL_MAX_CHARS``, no trailing period
    (the sentence supplies its own)."""
    if not detail:
        return ""
    text = " ".join(str(detail).split()).rstrip(". ")
    if not text:
        return ""
    if len(text) > _DETAIL_MAX_CHARS:
        text = text[: _DETAIL_MAX_CHARS - 1].rstrip() + "…"
    return f": {text}"


def _sentence(kind: str, recs: list[dict]) -> str:
    """The cause sentence for one kind, from every record that carried it."""
    if kind == KIND_MISSING_FIELDS:
        seen: list[str] = []
        for rec in recs:
            for name in rec.get("missing") or []:
                if name not in seen:
                    seen.append(name)
        return _MISSING_FIELDS_SENTENCE.format(names=_names(seen) or "unknown")
    if kind in (KIND_UNCITED, KIND_INVENTED):
        key = "uncited" if kind == KIND_UNCITED else "invented"
        n = max((int(rec.get(key) or 0) for rec in recs), default=0)
        values = _plural(n, "value", "values")
        if len(recs) > 1:
            template = _UNCITED_MERGED_SENTENCE if kind == KIND_UNCITED else _INVENTED_MERGED_SENTENCE
        else:
            template = _UNCITED_SENTENCE if kind == KIND_UNCITED else _INVENTED_SENTENCE
        return template.format(n=n, values=values)
    if kind in (KIND_NO_TEMPLATE, KIND_RENDER_FAILED):
        # The most recent detail wins: it is the cause the author met last.
        detail = next((rec.get("detail") for rec in reversed(recs) if rec.get("detail")), None)
        template = _NO_TEMPLATE_SENTENCE if kind == KIND_NO_TEMPLATE else _RENDER_FAILED_SENTENCE
        return template.format(detail=_detail_suffix(detail))
    return {
        KIND_NARRATED: _NARRATED_SENTENCE,
        KIND_TRUNCATED: _TRUNCATED_SENTENCE,
        KIND_PROVIDER_ERROR: _PROVIDER_ERROR_SENTENCE,
        KIND_INTEGRITY_FAILED: _INTEGRITY_FAILED_SENTENCE,
    }.get(kind, _UNEXPECTED_SENTENCE)


def compose_emit_failure(records: list[dict], *, step_name: str | None = None) -> str:
    """The ONE failure string for an emit step (format pinned by 281-01's interface block).

    Line 1 names the step by its author-set name when the caller passes one (already
    scrubbed), else "This step"; then one ``• k attempt(s) — <sentence> <check line>``
    bullet per distinct kind, count descending, ties in ``KIND_ORDER``. Plain text with
    ``\\n`` separators — no markdown list syntax. ``""`` for no records.
    """
    recs = [r for r in (records or []) if isinstance(r, dict)]
    if not recs:
        return ""

    def _counted(rec: dict) -> bool:
        # 281-REVIEW WR-01: a record with ``attempt`` 0 is a terminal arm reached before any
        # model call (no template, an error while resolving it). It names its cause but is
        # never counted as an attempt.
        try:
            return int(rec.get("attempt", 1)) > 0
        except (TypeError, ValueError):
            return True

    total = sum(1 for rec in recs if _counted(rec))

    by_kind: dict[str, list[dict]] = {}
    for rec in recs:
        kinds = [k for k in (rec.get("kinds") or []) if isinstance(k, str)] or [KIND_UNEXPECTED]
        for kind in dict.fromkeys(kinds):  # a kind counts once per shot
            key = kind if kind in _CHECK_LINES else KIND_UNEXPECTED
            by_kind.setdefault(key, []).append(rec)

    attempts = _plural(total, "attempt", "attempts")
    name = step_name.strip() if isinstance(step_name, str) else ""
    if total == 0:
        # No model call was made: the header carries no count at all.
        head = f'Step "{step_name}" failed:' if name else "This step failed:"
    else:
        head = (
            f'Step "{step_name}" failed after {total} {attempts}:'
            if name
            else f"This step failed after {total} {attempts}:"
        )

    def _k(kind: str) -> int:
        return sum(1 for rec in by_kind[kind] if _counted(rec))

    ordered = sorted(by_kind, key=lambda k: (-_k(k), -len(by_kind[k]), KIND_ORDER.index(k)))
    lines = [head]
    for kind in ordered:
        k = _k(kind)
        sentence = _sentence(kind, by_kind[kind])
        if k == 0:
            lines.append(f"• {sentence[:1].upper()}{sentence[1:]} {_CHECK_LINES[kind]}")
            continue
        lines.append(
            f"• {k} {_plural(k, 'attempt', 'attempts')} — "
            f"{sentence} {_CHECK_LINES[kind]}"
        )
    return "\n".join(lines)


def no_template_bound_sentence(step_label: str | None) -> str:
    """Phase 295 (D-12) — the one sentence a fill step with no template is refused with.

    ``step_label`` is the step's authored name, or its slug when it has none (the caller
    decides; this leaf derives nothing). With neither, the step is "This step".
    """
    label = str(step_label).strip() if step_label else ""
    return _NO_TEMPLATE_BOUND_REFUSAL.format(step=label or "This step")
