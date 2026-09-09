"""Phase 240 (SRC-05 SC#2 / D-240-08) — the email-attachment child loop, in ONE home.

⛔ **THE DEFECT THIS MODULE CLOSES.** This loop lived only in `app/api/documents.py`, inside the
legacy `ingest_document`. **Watches and `/upload` both run the QUEUE path** (`ingest_splice`), and
`grep -n "rfc822\\|attachment"` over that file returned one docstring line and no code. A watched
mailbox would therefore have ingested every message and **none of their attachments** — SC#2 false
with the whole suite green, because the existing tests exercise the legacy path.

⚠ **THIS WAS THE FOURTH RECORDED DISAGREEMENT BETWEEN THE TWO INGEST PATHS.** `ingest_splice.py`'s
own comments narrate the first three — BUG-260905-06 (the metadata step), the empty-chunk refusal,
and the Phase 234 provenance carry. Each was found by someone going looking, and each was fixed
the same way: **one function, both callers, never a copy.** That is what this module is.

⭐ **IT IS A MOVE, NOT A REWRITE.** `test_240_attachments_both_paths.py`'s legacy pin was written
and passing BEFORE the extraction and must keep passing after. If it ever has to be edited to stay
green, the move changed behaviour and the edit is the failure — the things a tidy-up would quietly
lose are `sanitize_attachment_filename`, the `ALLOWED_MIME_TYPES` refusal, and the
relationship-insert-ABOVE-the-early-return that keeps a shared attachment linked to both parents.

## Two deliberate deltas from the legacy code, both named

1. **`depth`** (TM-240-09). A `.eml` attached to a `.eml` would recurse. The legacy loop was never
   reachable from a watch, so nested mail could only arrive by hand; making the loop run on the
   queue path opens it to a mailbox where an attacker chooses the attachment. **New exposure, new
   guard, same commit.**
2. **`org_id` / `ingest_visibility` pass-through.** The queue path carries them and the legacy path
   does not. Minting a child without them would place it outside its connection's visibility
   scope — a `VIS-*` regression on the very path Phase 231 built. Both default to `None`, so the
   legacy call stays byte-equivalent.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from app.services.email_extraction_service import parse_eml_bytes, parse_msg_bytes
from app.services.ingest_splice import mint_document_row
from app.services.transient_errors import is_transient

log = logging.getLogger(__name__)

#: How deep a message-inside-a-message chain may go. 1 means: a message's attachments become
#: documents, and a message that ARRIVED as an attachment does not spawn a third level.
MAX_MAIL_NESTING_DEPTH = 1

MAIL_MIME_TYPES = ("message/rfc822", "application/vnd.ms-outlook", "application/x-msg")

#: Attempts for a step that failed TRANSIENTLY — the first try plus two more.
#: ⚠ Small on purpose. The measured healthy cost of the step this guards is 0.03-0.56 s, so
#:   retrying is nearly free; the failure it rescues is a scheduling stall, not a sick server.
_UPLOAD_ATTEMPTS = 3

#: Seconds between attempts. Patched to 0 by the suite — a test must not sleep for real.
_RETRY_SLEEP = 1.0


def _with_transient_retry(step: str, fn: Callable[[], Any]) -> Any:
    """Run `fn`, retrying only a TRANSIENT failure, and name the step on the way out.

    ⛔ **THE FAILURE THIS EXISTS FOR, MEASURED 2026-09-09.** An attachment upload raised the bare
    word `timed out` after exactly 20.010 s — `storage3.constants.DEFAULT_TIMEOUT` — and the
    attachment was lost. Two hypotheses were measured FALSE before the real one was found:
    concurrency on the shared client (12 parallel uploads, max 0.17 s) and a stale keep-alive
    connection (idle 30 / 75 / 120 s, then 0.03 s). What reproduces it is **GIL contention**:
    the identical upload takes 0.23 s idle, **7.27 s under 16 CPU-bound threads and 21.07 s
    under 32**. The backend log agrees — 15.8 seconds with no line at all, in a process that was
    otherwise logging constantly.

    ⚠ **So the deadline was measuring OUR OWN SCHEDULING, not the server**, during an ingest that
    runs PDF and image extraction on threads.

    ⛔ **AND THE REASON ONE STALL WAS FATAL IS A FIFTH TWO-PATHS DISAGREEMENT.** The queue
    classifies a timeout as transient and retries it; an attachment child is minted and ingested
    OUTSIDE the queue and inherited no retry at all.

    ⚠ **RETRYING IS NOT SWALLOWING.** After the attempts the error is re-raised, so the caller
    still records the attachment FAILED — with the step named, because `timed out` alone cost a
    session of log archaeology.
    """
    last: BaseException | None = None
    # ⚠ `max(1, …)` so a misconfigured constant can never make this raise for an operation it
    #   never attempted (IN-02) — a failure report about work that did not happen is worse
    #   than no retry at all.
    attempts = max(1, _UPLOAD_ATTEMPTS)
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last = exc
            if not is_transient(exc) or attempt == attempts:
                break
            log.warning(
                "attachment %s failed transiently (attempt %d/%d): %s — retrying",
                step, attempt, attempts, exc,
            )
            time.sleep(_RETRY_SLEEP)
    raise AttachmentStepError(step, last) from last


class AttachmentStepError(Exception):
    """Carries WHICH step failed alongside the original message.

    ⚠ The step is the half that was missing. `timed out` names a symptom and no location; the
    manifest entry and the child document both store this string, so the next occurrence is one
    read rather than a walk through the backend log.
    """

    def __init__(self, step: str, cause: BaseException | None) -> None:
        self.step = step
        self.cause = cause
        super().__init__(f"{step}: {cause}")


#: The parent-message columns an attachment inherits. Placement and scope only — never content.
_PLACEMENT_COLUMNS = "folder_id, org_id, source_connection_id, ingest_visibility"


def _inherited_placement(supabase: Any, document_id: str, user_id: str) -> dict[str, Any]:
    """Read the message's own placement, so its attachments land beside it.

    ⛔ **FOUND BY DRIVING THE REAL WATCH (2026-09-09, UAT row M-2), NOT BY READING.** The
    operator emailed themselves a PDF. The watch minted it as its own document and wrote the
    `attached_to` link — and the child arrived with `folder_id = NULL` and
    `source_connection_id = NULL`. It existed, it was linked, and it sat nowhere a person looks.

    ⚠ **THE FOLDER HALF IS NOT A PHASE 240 REGRESSION.** `5f8a54702` shows the legacy loop
    passing `folder_id=None` EXPLICITLY, so the extraction preserved it faithfully. What changed
    is that a watched mailbox now produces attachments at all — which is what made a
    long-standing behaviour visible for the first time. Recorded because "the code I just moved
    is wrong" and "the code I just moved newly EXPOSES something" are different findings.

    ⛔ **THE VISIBILITY HALF WAS A REAL GAP IN THIS MODULE.** `mint_document_row` writes
    `ingest_visibility` ONLY alongside `source_connection_id` — *"the pair is written together or
    not at all"* — and this module accepted `ingest_visibility` with no way to pass a connection.
    Every visibility it forwarded was silently discarded by the function it was handed to, so the
    parameter its own docstring introduced to prevent a VIS-* regression could not do it.

    ⚠ **IT RESOLVES HERE AND NOT IN EITHER CALLER, deliberately.** Two callers resolving the same
    four columns is how the two ingest paths disagreed four times already. One home, both callers.

    ⚠ **It never raises and never invents.** An unreadable or absent parent yields `{}`, and the
    caller's own defaults stand — a hand-uploaded `.eml` has no connection and no folder, and its
    attachment must still arrive with nothing made up on its behalf.
    """
    try:
        resp = (
            supabase.table("documents")
            .select(_PLACEMENT_COLUMNS)
            .eq("id", document_id)
            # ⛔ OWNER-SCOPED, NOT JUST ROW-SCOPED (code review WR-05). On the queue path this
            #    is the SERVICE-ROLE client, so RLS does not backstop the read — and of the
            #    four columns copied onto the child, `mint_document_row` re-validates only
            #    `folder_id`. `org_id`, `source_connection_id` and `ingest_visibility` go
            #    through unchecked.
            # ⚠ It was not exploitable when found: both call sites pass an id that was
            #   ownership-checked upstream. That is the reason to add the line now rather than
            #   the reason not to — one new caller makes it a cross-tenant tagging primitive.
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        # ⛔ ERROR, NOT WARNING (code review WR-02). A FAILED read is not "no placement": every
        #    attachment on this message is then minted with no folder and no connection — the
        #    M-2 defect, permanently, because nothing re-runs the placement. It deserves the
        #    level that gets noticed.
        # ⚠ The stall this phase measured was OUR OWN SCHEDULING, and a starved thread times
        #   out a PostgREST select exactly as readily as a storage PUT.
        log.error(
            "Placement read FAILED for message %s (%s) — its attachments will be minted with "
            "no folder and no connection", document_id, exc,
        )
        return {}

    row = getattr(resp, "data", None)
    if row is None:
        # A hand-uploaded `.eml`: nothing to inherit, and nothing invented on its behalf.
        return {}
    if not isinstance(row, dict):
        # ⚠ THIS ARM USED TO BE COMPLETELY SILENT. PostgREST returns a one-element LIST without
        #   `maybe_single`, so a client-shape change would have degraded every attachment's
        #   placement with no log line at all.
        log.error(
            "Unexpected placement shape for message %s: %r — treating as no placement",
            document_id, type(row),
        )
        return {}
    return row



#: The extraction wall clock, matching `ingest_splice.splice_document`'s own constant.
#: ⚠ Duplicated as a NUMBER rather than imported, because importing `ingest_splice` from here
#:   is the cycle this module already dodges for `mint_document_row`. If one moves, both move.
_EXTRACT_WALL_CLOCK_S = 130.0


def _extract_attachment_text(
    raw: bytes, mime_type: str, wall_clock_s: float = _EXTRACT_WALL_CLOCK_S
) -> str:
    """Route PDF and DOCX to the extraction service, BOUNDED; everything else to `extract_text`.

    ⛔ THE BOUND WAS MISSING AND THE DOCSTRING CLAIMED OTHERWISE (code review WR-04). This said
       it was `splice_document`'s branch *"spelled the same way on purpose"* while that path
       wraps the composer in `asyncio.wait_for(..., timeout=wall_clock_s)` and this one had no
       timeout at all. **A claim of sameness is not sameness.**

    ⚠ THE FAILURE IT OPENS is the same attacker as CR-01: a PDF bomb attached to a message in a
      watched mailbox extracts for as long as the engine wants, holding a threadpool worker
      until the ingestion job blows its 300 s lease; `reclaim_stale_ingestion_claims` returns
      the job to `pending` and the same unbounded extraction runs again, up to `max_retries`.

    ⚠ A `ThreadPoolExecutor`, not `asyncio.wait_for` — this function is SYNC (it runs inside
      `run_in_threadpool`), so there is no event loop here to await on.
    """
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    from app.api.documents import extract_text  # noqa: PLC0415
    from app.services.extraction_service import (  # noqa: PLC0415
        DOCX_MIME,
        PDF_MIME,
    )
    from app.services import extraction_service  # noqa: PLC0415

    if mime_type not in (PDF_MIME, DOCX_MIME):
        return extract_text(raw, mime_type)

    # ⚠ Resolved through the MODULE so a test can patch `extraction_service.extract_composable`
    #   by name; a from-import would bind the original and make the bound untestable.
    #
    # ⛔ NO `with` BLOCK, AND THE TEST IS WHY. `ThreadPoolExecutor.__exit__` calls
    #    `shutdown(wait=True)`, so the first version raised on time and then BLOCKED for the
    #    full extraction anyway — a bound that changed who waits and freed nothing. Measured:
    #    the timeout fired at 0.5 s and the call still took 30.0 s.
    #
    # ⚠ `shutdown(wait=False)` returns immediately and the runaway thread is ORPHANED, not
    #   killed — Python cannot kill a thread. That is a real and deliberate trade: the harm
    #   WR-04 names is the ingestion job holding its 300 s lease and being reclaimed into a
    #   retry loop, and returning promptly is what stops that. One leaked thread finishing its
    #   work and exiting is strictly better than a job that never completes.
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        future = pool.submit(extraction_service.extract_composable, raw, mime_type)
        return future.result(timeout=wall_clock_s).text or ""
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def ingest_email_attachments(
    *,
    raw: bytes,
    mime_type: str,
    document_id: str,
    user_id: str,
    supabase: Any,
    folder_id: str | None = None,
    org_id: str | None = None,
    ingest_visibility: str | None = None,
    source_connection_id: str | None = None,
    depth: int = 0,
) -> list[dict] | None:
    """Mint each attachment as its own document, linked to the message it arrived on.

    Returns the attachment manifest, or `None` when this is not a mail document (or when the
    nesting cap refuses to go deeper).

    ⚠ **It never raises.** A failure here degrades to a warning and a manifest entry, exactly as
    the legacy loop did: an attachment problem must not fail the message that carried it.
    """
    if mime_type not in MAIL_MIME_TYPES:
        return None
    if depth >= MAX_MAIL_NESTING_DEPTH:
        # TM-240-09 — a message that arrived AS an attachment does not open its own.
        log.info(
            "email attachment nesting cap reached at depth %d for %s — not recursing",
            depth,
            document_id,
        )
        return None

    # Imported inside the function for the same reason the legacy code did: `ingest_document`
    # lives in the API module, and a module-level import would make this service depend on the
    # router package at import time.
    # ⚠ `app.api.documents` is imported HERE and not at module level, and it is the only one
    #   that has to be: that module now imports THIS one, so a top-level import either way is a
    #   cycle. `mint_document_row` and the parsers are hoisted to module scope precisely so a
    #   test can patch them by name — a function-local import is unpatchable from outside, which
    #   is a testability cost worth paying only where a cycle forces it.
    # ⚠ `extract_text` is deliberately NOT here any more (IN-01): after the PDF/DOCX routing
    #   change its only call site is `_extract_attachment_text`, which imports it itself.
    from app.api.documents import (  # noqa: PLC0415
        ALLOWED_MIME_TYPES,
        _EXT_MIME_OVERRIDES,
        _UNRELIABLE_MIME_TYPES,
        ingest_document,
    )

    # ⭐ INHERITANCE IS THE DEFAULT, NOT A LAW — an explicit argument still wins, so a caller
    #   that knows better than the parent row keeps saying so. Resolved once, above the loop:
    #   every attachment on one message shares one message's placement.
    inherited = _inherited_placement(supabase, document_id, user_id)
    folder_id = folder_id if folder_id is not None else inherited.get("folder_id")
    org_id = org_id if org_id is not None else inherited.get("org_id")
    # ⛔ THE PAIR TRAVELS TOGETHER OR NOT AT ALL. `mint_document_row` writes visibility only
    #   beside a connection id, so resolving one without the other re-creates the exact silent
    #   drop this change exists to close.
    # ⛔ ATOMIC IN BOTH DIRECTIONS (code review WR-03). The old rule was one-way: a caller
    #    passing `ingest_visibility="org"` with no connection got its visibility paired with the
    #    PARENT's connection, so a child could be org-visible on a connection whose parent row
    #    is private. That is the ONLY construction here that can widen a child beyond the
    #    message it came from — and it contradicted the comment right above it.
    if source_connection_id is None and ingest_visibility is None:
        source_connection_id = inherited.get("source_connection_id")
        ingest_visibility = inherited.get("ingest_visibility")
    elif source_connection_id is None:
        # ⚠ An explicit visibility with no explicit connection cannot be honoured: pairing it
        #   with the parent's connection claims a scope the caller never asked the parent for.
        #   Dropping it is the safe direction — `mint_document_row` then writes neither.
        ingest_visibility = None

    try:
        parsed_email = (
            parse_eml_bytes(raw) if mime_type == "message/rfc822" else parse_msg_bytes(raw)
        )
        attachment_manifest: list[dict] = []

        for att in parsed_email.attachments:
            if not att.raw or not att.filename:
                continue

            att_doc_id: str | None = None
            try:
                att_ext = (
                    "." + att.filename.rsplit(".", 1)[-1].lower()
                    if "." in att.filename
                    else ""
                )
                att_mime = att.content_type
                if att_mime in _UNRELIABLE_MIME_TYPES and att_ext in _EXT_MIME_OVERRIDES:
                    att_mime = _EXT_MIME_OVERRIDES[att_ext]

                if att_mime not in ALLOWED_MIME_TYPES:
                    # ⚠ RECORDED, NOT DROPPED. "We would not ingest this" and "there was nothing
                    #   here" are different facts, and the manifest is the only place a person can
                    #   learn which one happened.
                    attachment_manifest.append({
                        "filename": att.filename,
                        "status": "skipped",
                        "error": f"MIME type {att_mime} not allowed",
                    })
                    continue

                # Mint row with on_conflict="link" (G-2):
                # Handles exact duplicate attachment or concurrent ingest collision without failing
                mint_result = mint_document_row(
                    raw=att.raw,
                    filename=att.filename,
                    mime_type=att_mime,
                    user_id=user_id,
                    supabase=supabase,
                    folder_id=folder_id,
                    org_id=org_id,
                    ingest_visibility=ingest_visibility,
                    source_connection_id=source_connection_id,
                    on_conflict="link",
                )
                att_doc = mint_result.document
                att_doc_id = att_doc["id"]

                # ⛔ THIS INSERT SITS ABOVE THE `is_duplicate` EARLY-RETURN, AND THAT ORDER IS
                #    LOAD-BEARING. ROADMAP 240 names the failure it prevents: *"two different
                #    emails carrying the same attachment collide on documents_dedup_idx and one is
                #    silently swallowed."* A duplicate mints no second document — it must still
                #    gain a second `attached_to` row, or the second message loses its attachment.
                #    Driven RED by moving this below the return.
                try:
                    supabase.table("document_relationships").insert({
                        "user_id": user_id,
                        "source_doc_id": att_doc_id,
                        "target_doc_id": document_id,
                        "rel_type": "attached_to",
                    }).execute()
                except Exception as rel_err:
                    log.warning(
                        "Failed to link attachment %s -> %s: %s", att_doc_id, document_id, rel_err
                    )

                if mint_result.is_duplicate:
                    # Duplicate in folder: link into the manifest, but do NOT upload bytes and do
                    # NOT re-ingest.
                    attachment_manifest.append({
                        "filename": att.filename,
                        "status": "linked",
                        "document_id": att_doc_id,
                        "is_duplicate": True,
                    })
                    continue

                # New document: upload to storage
                # ⛔ THE ONE STEP THAT IS RETRIED, and only this one. Extraction and ingest are
                #    CPU work on local bytes; a retry there repeats the same computation and
                #    reaches the same answer. The upload is the network hop the stall hit.
                _with_transient_retry(
                    "upload",
                    # ⛔ `upsert` IS WHAT MAKES THE RETRY SAFE (code review CR-02). The stall
                    #    this retry exists for is a CLIENT-side deadline — measured at 21.07 s
                    #    on a call the server completed fine — so the object can already be
                    #    there when attempt 2 fires. Without upsert that attempt is refused as
                    #    a duplicate, the refusal carries no transient tell, and the retry
                    #    LOSES the attachment it was added to save, with a worse reason.
                    # ⚠ `watch_service` already passes it at both of its upload sites; this one
                    #   did not, which is the same copy-drift this module exists to stop.
                    lambda: supabase.storage.from_("documents").upload(
                        path=mint_result.storage_path,
                        file=att.raw,
                        file_options={"content-type": att_mime, "upsert": "true"},
                    ),
                )

                # Extract and ingest child document
                #
                # ⛔ THE SIXTH TWO-PATHS DISAGREEMENT, AND IT FAILED EVERY PDF AND DOCX
                #    ATTACHMENT EVER SENT. `extract_text`'s own docstring says it handles
                #    *"non-PDF/non-DOCX MIME types"* — since Phase 069 those two go through
                #    `extraction_service`. A PDF handed to it falls past every branch to a bare
                #    `raw.decode("utf-8")` and dies on the first non-ASCII byte of the body:
                #    `'utf-8' codec can't decode byte 0xe2 in position 10`, measured on the
                #    operator's real Gmail watch on 2026-09-09.
                #
                # ⚠ IT WAS INVISIBLE BECAUSE ANOTHER DEFECT SAT IN FRONT OF IT. The first live
                #   run of this loop hit the storage timeout and never REACHED extraction; and
                #   `splice_document` has always branched correctly, so nothing upstream noticed.
                #
                # ⚠ THE BRANCH IS `splice_document`'s, deliberately spelled the same way. The
                #   honest fix for the whole family is to put the child on the ingestion queue
                #   so it inherits ONE pipeline instead of a parallel one — SEED-262.
                att_text = _extract_attachment_text(att.raw, att_mime)
                # ⚠ `depth + 1` IS THE HALF THAT WAS MISSING. The child's own ingest calls
                #   this loop again from `documents.py`; without carrying the count the guard
                #   above sees 0 forever (CR-01).
                ingest_document(
                    document_id=att_doc_id,
                    text=att_text,
                    user_id=user_id,
                    supabase=supabase,
                    raw=att.raw,
                    mime_type=att_mime,
                    filename=att.filename,
                    engine_override="legacy",
                    attachment_depth=depth + 1,
                )
                attachment_manifest.append({
                    "filename": att.filename,
                    "status": "completed",
                    "document_id": att_doc_id,
                })

            except Exception as att_err:
                log.warning(
                    "Email attachment '%s' processing failed for parent %s: %s",
                    att.filename,
                    document_id,
                    att_err,
                )
                if att_doc_id:
                    try:
                        supabase.table("documents").update({
                            "status": "failed",
                            "ingestion_step": "failed",
                            "error_message": str(att_err)[:250],
                        }).eq("id", att_doc_id).execute()
                    except Exception:
                        pass
                attachment_manifest.append({
                    "filename": att.filename,
                    "status": "failed",
                    "error": str(att_err)[:250],
                })

        return attachment_manifest or None

    except Exception as att_exc:
        log.warning(
            "Email attachment extraction loop warning for %s: %s", document_id, att_exc
        )
        return None
