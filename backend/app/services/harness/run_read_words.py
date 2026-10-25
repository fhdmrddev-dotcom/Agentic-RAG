"""Phase 293 (the ``api/workflow_runs.py`` named seam) — the viewer-aware run-read wording.

MOVED, NOT REWRITTEN. ``waiting_who``, ``unsourced_who``, ``compose_waiting_on``, their helper
``_first_line`` and ``_WAITING_FALLBACK_NAME`` were copied here verbatim from
``api/workflow_runs.py`` (where 288-05 and 295-05 wrote them). The ledger's named seam for that
FIRING route module was "move the viewer-aware wording into one module beside
``run_read_wire.py``, before any feature lands here"; Phase 293's inbound status read needs the
waiting-on name and must not import a FIRING route module to get it.

PURE: no pool, no client, no clock, no ``app.api`` import. The one lazy import is
``publish_service._clean_label`` (the scrubber every label already goes through), exactly as the
code did in its old home. ``api/workflow_runs.py`` re-exports every name, so each importer and
each ``patch("app.api.workflow_runs.<name>")`` keeps working; ``panel_unsourced_who`` and the
other readers that do I/O stay in the route module.
"""
from __future__ import annotations

from typing import Any

_WAITING_FALLBACK_NAME = "the person who started this run"


def _first_line(raw: object) -> str | None:
    """The first non-blank line of a prompt, scrubbed and clamped (V5), or None."""
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    if not isinstance(raw, str):
        return None
    for line in raw.splitlines():
        cleaned = _clean_label(line)
        if cleaned:
            return cleaned
    return None


def waiting_who(*, is_owner: bool, display_name: object, viewer_email: object) -> str:
    """The name chain, in its ONE home (295-05 factored it out of ``compose_waiting_on``).

    Scrubbed ``display_name``; else the viewer's email ONLY for the owner; else the words "the
    person who started this run". "(you)" only for the owner, and never on the fallback words.
    """
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    name = _clean_label(display_name)
    if name is None and is_owner:
        name = _clean_label(viewer_email)
    if name is None:
        name = _WAITING_FALLBACK_NAME
    return f"{name} (you)" if is_owner and name != _WAITING_FALLBACK_NAME else name


def unsourced_who(*, is_owner: bool, display_name: object, viewer_email: object) -> str:
    """295-05 (D-04, UI-SPEC B.1): who kept an unsourced output, in the viewer's words.

    The owner reads ``<name> (you)`` through the same chain as the waiting-on line. Anyone else
    reads "the person who started this run": the chain is called with the name withheld, so a
    colleague learns that the choice was made, never by whom beyond the run's starter.
    """
    if not is_owner:
        return waiting_who(is_owner=False, display_name=None, viewer_email=None)
    return waiting_who(is_owner=True, display_name=display_name, viewer_email=viewer_email)


def compose_waiting_on(
    *,
    owner_id: object,
    viewer_id: object,
    viewer_email: object,
    display_name: object,
    step_name: object,
    prompt_text: object,
    window_passed: bool,
) -> dict[str, Any]:
    """Phase 288 (D-09/D-10/D-11, A-06): the waiting-on sentence, as a pure function.

    Name chain: scrubbed ``display_name``; else the viewer's email ONLY when the viewer is the
    owner; else the words "the person who started this run". "(you)" only for the owner. A
    non-owner gets no email and no prompt line (A-06). The paused wording says the run is
    still waiting and continues when answered; it never says "expired".
    """
    from app.services.harness.publish_service import _clean_label  # noqa: PLC0415

    is_owner = str(owner_id) == str(viewer_id)
    who = waiting_who(is_owner=is_owner, display_name=display_name, viewer_email=viewer_email)
    prompt_line = _first_line(prompt_text) if is_owner else None
    if window_passed:
        # 289-05 (D-13): restored only after S5 drove a paused run that was answered from
        # the run page card and reached `completed` (289-VALIDATION.md S5, run 229f45ae).
        sentence = f"Still waiting on {who}; the run continues as soon as they answer."
    elif prompt_line:
        sentence = f'Waiting on {who} to answer "{prompt_line}".'
    else:
        sentence = f"Waiting on {who} to answer."
    return {
        "sentence": sentence,
        "step_name": _clean_label(step_name),
        "prompt_line": prompt_line,
        "window_passed": window_passed,
    }
