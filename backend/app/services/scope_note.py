"""Phase 268 (D-268-26 / SEED-319) — the ONE home of the MODEL-FACING scope-change note.

A thread's folder scope can change mid-thread (268-03). The ``scope_changed`` transcript row is rendered to
people and is never itself sent to a model. Measured live at 268-04, that left the model with pre-change search
results in its history and a system prompt naming the NEW folder, so 6 of 8 providers answered the follow-up
from history and cited a document from the dropped folder. D-268-26 (operator, 2026-09-29): tell the model — one
short, provider-neutral sentence, prepended to the NEXT user message in the reconstructed history.

This module holds the words and the fold. It reads the STORED payload dict (``tool_calls[0]`` of the row), never
the transcript sentence, and it never reads the payload's ``expert`` key: an Expert change is invisible to the
model (D-267-10), so no Expert name can reach it through this path.

Rules, each pinned by ``tests/unit/test_268_scope_history_note.py``:
  * A ``held`` change adds no note. Under a Restricted Expert the saved folder is not searched, so the model's
    effective search did not change; telling it otherwise would be false.
  * Consecutive changes before one user message FOLD into one note, first ``from`` → last ``to``: every result
    in history before them was retrieved under the first ``from``. A change that returns to where it started
    says nothing.
  * Folder paths are user-authored text: brackets and line breaks are removed and each path is capped, so a
    folder name cannot close the note or start a new instruction line.
"""
from __future__ import annotations

import re

SCOPE_CHANGED_KIND = "scope_changed"

_ALL_DOCUMENTS = "all your documents"
_PATH_CAP = 120
_UNSAFE = re.compile(r"[\[\]\r\n\t]+")


def _label(path: str | None) -> str:
    if not path:
        return _ALL_DOCUMENTS
    clean = re.sub(r"\s+", " ", _UNSAFE.sub(" ", str(path))).strip().lstrip("/")
    if not clean:
        return _ALL_DOCUMENTS
    if len(clean) > _PATH_CAP:
        clean = clean[: _PATH_CAP - 1].rstrip() + "…"
    return "/" + clean


def scope_history_note(from_path: str | None, to_path: str | None) -> str:
    """The note's words. ``None`` means the thread had no folder (all documents)."""
    return (
        f"[Search scope changed from {_label(from_path)} to {_label(to_path)}. Earlier search results in this "
        "conversation may come from outside the new scope; run a new search before citing documents.]"
    )


def _path(ref: object) -> str | None:
    if not isinstance(ref, dict):
        return None
    return ref.get("path") or ref.get("name") or None


class ScopeNoteFold:
    """Collects scope changes between user messages; hands the note to the next user message."""

    def __init__(self) -> None:
        self._from: str | None = None
        self._to: str | None = None
        self._pending = False

    def add(self, payload: dict) -> None:
        if payload.get("held"):
            return
        if not self._pending:
            self._from = _path(payload.get("from_folder"))
            self._pending = True
        self._to = _path(payload.get("to_folder"))

    def take(self) -> str | None:
        """The note for the user message about to be emitted, or None; resets the fold."""
        if not self._pending:
            return None
        src, dst = self._from, self._to
        self._pending = False
        self._from = self._to = None
        if _label(src) == _label(dst):
            return None
        return scope_history_note(src, dst)
