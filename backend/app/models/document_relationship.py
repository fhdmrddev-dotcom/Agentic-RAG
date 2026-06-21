"""Pydantic models for typed document relationships (Phase 116, REL-01/03/04).

Two models live here — the create REQUEST and the RESPONSE — cloned from the
``document_view.py`` create/response shape (Phase 113/114).

The ``rel_type`` ``Literal`` is the DECLARATIVE reject-unknown mechanism: an incoming
body with ``rel_type:"forged"`` fails ``RelationshipCreate.model_validate(...)`` at
parse → 422 (T-116-01-01). No ``eval``, no if-ladder. The four members mirror the DB
CHECK at ``migration 071:67-68`` exactly; the DB CHECK is defense-in-depth, NOT the
primary gate (a forged type never reaches it because parse rejects it first).

Directionality contract (so Phase 117's relationship panel + the ``get_related_documents``
agent tool agree on which end is which):

  * ``source_doc_id`` is the SUBJECT of the verb; ``target_doc_id`` is its OBJECT.
      - ``A supersedes B`` → source=A (the newer), target=B (the superseded).
      - ``A amends B``      → source=A (the amendment), target=B (the amended).
      - ``A references B``  → source=A (the citing doc), target=B (the cited).
      - ``A attached_to B`` → source=A (the ATTACHMENT), target=B (the PARENT).
        Read it "A is attached to B": the attachment is the source, the parent is the
        target. The inverse (incoming) view of a parent B is therefore
        "B has_attachment A".
  * The agent tool renders OUTGOING edges (subject == source) with ``rel_type`` as the
    label and INCOMING edges (subject == target) with the inverse label
    (``superseded_by`` / ``amended_by`` / ``referenced_by`` / ``has_attachment``).

Read-time follow-to-latest (D-116-1a): the stored ``source_doc_id`` / ``target_doc_id``
are creation-time ids; both ends RESOLVE to their LATEST accessible version at read
time (via the service's ``_resolve_readable_latest``), so a re-upload / restore does
not orphan a link. The ids stored here are stable creation handles, not pinned reads.
"""

from typing import Literal

from pydantic import BaseModel


class RelationshipCreate(BaseModel):
    """The POST /document-relationships request body.

    ``rel_type`` is a closed ``Literal`` — a 5th value raises ValidationError at parse
    (the 422 gate; the DB CHECK at migration 071:68 is defense-in-depth).
    """

    source_doc_id: str
    target_doc_id: str
    rel_type: Literal["supersedes", "amends", "references", "attached_to"]


class RelationshipResponse(BaseModel):
    """A persisted relationship row (the POST 201 body / list item).

    ``user_id`` / ``created_at`` are nullable to match the ``ViewResponse`` analog (the
    row always carries them, but the response model stays permissive so a partial
    select never 500s on a missing field).
    """

    id: str
    user_id: str | None = None
    source_doc_id: str
    target_doc_id: str
    rel_type: str
    created_at: str | None = None
