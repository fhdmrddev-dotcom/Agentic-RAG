r"""The metadata + vision step BOTH ingest paths must run (BUG-260905-06).

⛔ THIS MODULE EXISTS BECAUSE THERE WERE TWO PIPELINES AND ONLY ONE OF THEM DID THIS.

Phase 229 built `splice_document` as the ONE ingest splice. Phase 230 then added a durable
queue *inside* it: with a `job_id` the function no longer delegates to `ingest_document` at
all — it runs its own inline chunk/embed loop and returns. That inline loop extracts tables
and images and never once touches metadata.

⚠ MEASURED, not inferred: `grep -n "extract_metadata\|metadata_dict\|context_header"` over
  `ingest_splice.py` returned **nothing**. `/upload` enqueues a job by default
  (`ingest_worker_enabled` is True), so from the Phase 230 cutover onward EVERY uploaded
  document reached `completed` with:

    - no title, date, author, document_type, or custom fields;
    - no `[Document: … | Title: … | Date: …]` chunk header, which is what lets a query like
      "amount paid on 17 Jan" match a receipt whose date exists only in its filename;
    - no vision transcription (SEED-226), so scans, drawings and uploaded images produced
      nothing at all;
    - no `_source` user-edit precedence guard and no `metadata.source` provenance carry —
      the two guards Phase 233 added at what it correctly called "the single metadata-write
      site all three re-extract entry points funnel through". They funnelled through it; the
      queue did not.

  The operator found it from the outside: *"the recent files do not have metadata, the old
  ones have."* Nothing in 5,600 tests did, because both paths were tested and neither test
  asserted they AGREE.

⭐ THE FIX IS A SHARED FUNCTION, NOT A SECOND COPY. `enrich_for_ingest` is now the only place
  this logic lives; `ingest_document` and the queue path both call it. A copy would have
  drifted exactly the way these two pipelines already did.

⚠ IT IS SYNCHRONOUS ON PURPOSE. It calls `asyncio.run` internally (the enriched-metadata
  extractor is async) and does blocking Supabase I/O, so an async caller MUST invoke it
  through `run_in_threadpool` — never await it, and never call it from inside a running loop.
  `asyncio.run` inside a running loop raises, and the broad `except` below would swallow that
  into `metadata=None`: the same silent degradation this module was written to end.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EnrichedIngest:
    """What the enrichment step produces for the chunk/embed stage that follows it."""

    #: The document text. REPLACED for a scan, APPENDED for a drawing, unchanged otherwise.
    text: str
    #: The metadata object to write to `documents.metadata`. None when nothing was derived.
    metadata: dict | None
    #: Prepended to every chunk BEFORE embedding (never stored on the chunk row).
    context_header: str
    #: Set when a model read the text off pixels; None when it came from a real text layer.
    vision: dict | None


def enrich_for_ingest(
    *,
    document_id: str,
    text: str,
    raw: bytes,
    mime_type: str,
    filename: str,
    user_id: str,
    supabase,
    app_settings,
) -> EnrichedIngest:
    """Derive metadata, transcribe unreadable pages, and build the chunk header.

    Every step is best-effort: any failure degrades to "no metadata" and never raises, so a
    document that would have ingested without enrichment still does.
    """
    from app.api.documents import IMAGE_MIME_TYPES  # noqa: PLC0415
    from app.services.embedding_service import (  # noqa: PLC0415
        extract_metadata,
        read_enabled_field_defs,
    )

    #: Stamped onto the document's metadata when a model read its text off pixels.
    #: None means the text came from a real text layer — the two must stay tellable apart.
    vision_provenance: dict | None = None

    # ── SEED-226 L1 + L2 — READ THE PAGES WHEN THE TEXT LAYER CANNOT BE TRUSTED ───────
    #
    # Two shapes of PDF arrive here with text that does not represent the document, and
    # they fail in opposite directions:
    #
    #   SCAN     — no text layer at all. Fails LOUDLY: zero chunks, and the user is told
    #              the file "needs OCR", a capability this product did not have.
    #   DRAWING  — a text layer that extracts fine and means nothing. Fails SILENTLY, and
    #              is the more dangerous of the two. MEASURED on a real AutoCAD floor plan
    #              (SEED-226, 2026-08-28): 2,822 line segments, 2,799 drawing ops, and a
    #              text layer of 252 chars containing EXACTLY ONE numeral. It ingested
    #              `completed`, with no error and nothing red, and a BOQ question against
    #              it would have been answered from run-together room names.
    #
    # ⚠ THIS RUNS BEFORE METADATA EXTRACTION ON PURPOSE. Title, date and document_type are
    #   derived from `text`; deriving them from 252 chars of room names and then replacing
    #   the text underneath would leave the metadata describing a document that no longer
    #   exists.
    #
    # ⚠ IT IS ADDITIVE FOR THE DRAWING CASE AND REPLACING FOR THE SCAN CASE. A drawing's
    #   own text layer is poor but not false — the room names ARE on the drawing — so it is
    #   kept and the transcription appended. A scan has nothing to keep.
    #
    # ⚠ EVERY FAILURE IS SOFT. No transcription, a model without vision, no API key, a
    #   render error: the document ingests exactly as it did before this block existed.
    if mime_type == "application/pdf" and raw:
        try:
            from app.services.extractors.aspects import vision_text  # noqa: PLC0415

            deficit = vision_text.classify_pdf_deficit(raw, text)
            if deficit is not None:
                budget = vision_text.page_budget(app_settings, deficit.pages)
                pages_b64 = vision_text.render_pdf_pages_b64(raw, budget)
                transcribed = vision_text.transcribe_pages(
                    pages_b64, deficit.kind, app_settings,
                )
                if transcribed.strip():
                    if deficit.kind == "drawing" and text.strip():
                        text = f"{text.strip()}\n\n{transcribed}"
                    else:
                        text = transcribed
                    vision_provenance = vision_text.provenance(
                        deficit.kind, len(pages_b64), deficit,
                    )
                    log.info(
                        "vision transcription for %s: kind=%s pages=%d/%d chars=%d",
                        document_id, deficit.kind, len(pages_b64), deficit.pages,
                        len(transcribed),
                    )
                    if vision_provenance.get("truncated"):
                        log.warning(
                            "document %s transcribed only %d of %d pages — "
                            "the shortfall is stated in every chunk header",
                            document_id, len(pages_b64), deficit.pages,
                        )
                else:
                    log.info(
                        "vision transcription for %s produced nothing (kind=%s)",
                        document_id, deficit.kind,
                    )
        except Exception:  # noqa: BLE001 — never let this block an ingest
            log.warning("vision transcription pass failed for %s", document_id, exc_info=True)

    # Extract metadata FIRST so we can use it to enrich chunk embeddings.
    # This is best-effort — failures are logged but never block ingestion.
    #
    # Phase 111 (D-111-2/8) — branch on metadata_enrichment_mode:
    #   - 'enriched' (default; any non-'legacy' value fails safe to enriched):
    #       cross-provider forced_emit through extract_metadata_enriched, with a
    #       runtime create_model schema (built-ins + user custom fields), a
    #       head+tail window sample (NOT content[:3000]), and a nested per-field
    #       `_confidence` map attached AFTER the dump.
    #   - 'legacy': the untouched OpenAI json_object extract_metadata path runs
    #       byte-identical (the reversibility path).
    # Three graceful-degradation layers are preserved: (1) extract_metadata_enriched's
    # own except→None [Plan 02], (2) the call-site except below → emitted=None, and
    # (3) the outer try/except backstop at the function bottom. A None metadata_dict
    # is fine — the doc still reaches status=completed and flat `@>` filters still match.
    mode = app_settings.metadata_enrichment_mode
    if mode != "legacy":  # default-on 'enriched'; any non-'legacy' value fails safe to enriched
        from app.config import get_model_capability  # noqa: PLC0415
        from app.services.embedding_service import (  # noqa: PLC0415
            attach_confidence,
            build_metadata_model,
            extract_metadata_enriched,
            resolve_extraction_model,
            sample_for_extraction,
        )

        # verify-work 111.1: the WHOLE enriched setup is inside the degrade try now.
        # build_metadata_model() raises ValueError on an unknown/typo'd custom
        # field_type (reachable only via a direct DB write — the CRUD API hard-validates
        # field_type), and resolve/read/sample can also fail; previously those sat
        # OUTSIDE the try so a metadata-config problem hard-FAILED the whole ingest
        # (status=failed, no chunks). The "metadata failure never breaks ingestion"
        # contract (D-111-8) requires ANY enriched failure to degrade to metadata=None.
        metadata_dict = None
        try:
            model = resolve_extraction_model(app_settings.extraction_model)  # env gpt-4o fallback
            # D-09 #1 (BUG-260616-01 / EMBED-01 data-egress cure): prefer the stored
            # explicit `extraction_provider`. When the operator pinned a provider in
            # Settings (e.g. `lmstudio`/`ollama`), trust it and SKIP name-inference
            # entirely — a slashed local id (`google/gemma-3-4b`) can no longer be
            # mis-inferred to `openrouter` and ship document text to the cloud.
            # Name-inference stays ONLY as the last-resort legacy fallback for pre-111.1
            # rows that never set `extraction_provider` (D-08 back-compat — byte-identical).
            provider = (getattr(app_settings, "extraction_provider", "") or "").strip().lower() \
                or (get_model_capability(model) or {}).get("provider")
            defs = read_enabled_field_defs(supabase, user_id)  # Plan-02 explicit-scoped, fail-closed read
            DynModel = build_metadata_model(defs)
            emit_tool = {
                "type": "function",
                "function": {
                    "name": "emit_document_metadata",
                    "description": (
                        "Emit structured metadata for this document with a per-field "
                        "0-1 confidence."
                    ),
                    "parameters": DynModel.model_json_schema(),
                },
            }
            sampled = sample_for_extraction(text, app_settings.extraction_window_cap)
            result = asyncio.run(extract_metadata_enriched(
                sampled=sampled,
                model=model,
                provider=provider,
                schema_model=DynModel,
                emit_tool=emit_tool,
                user_settings=app_settings,
            ))
            emitted = result.get("emitted")
            if not emitted:
                # Never let a metadata extraction silently yield None — surface the
                # forced-emit failure reason (model_failed_to_emit vs provider_error)
                # plus the resolved model/provider so the cause is diagnosable.
                log.warning(
                    "metadata extraction produced no emission "
                    "(model=%s provider=%s failure=%s) -> metadata=None",
                    model, provider, result.get("failure"),
                )
            # D-111-3 (WR-01 fix): use the dedicated helper, which POPS the public
            # `confidence` field out of the dump and renames it to the nested
            # `_confidence` key. Hand-rolling `metadata_dict["_confidence"] = ...`
            # left the flat `confidence` key in the dump (the populated-dict default
            # survives exclude_none), polluting the `metadata @>` containment filter.
            metadata_dict = attach_confidence(emitted.model_dump(exclude_none=True)) if emitted else None
        except Exception:  # noqa: BLE001 — degrade layer 2: ANY enriched failure → metadata=None; doc still completes (D-111-8)
            log.warning("enriched metadata extraction failed; degrading to None", exc_info=True)
            metadata_dict = None
    else:
        metadata = extract_metadata(text)  # UNTOUCHED legacy path (byte-identical)
        metadata_dict = metadata.model_dump(exclude_none=True) if metadata else None

    # Phase 203 (EML-01): Merge deterministic email header metadata
    if mime_type in ("message/rfc822", "application/vnd.ms-outlook", "application/x-msg"):
        try:
            from app.services.email_extraction_service import parse_eml_bytes, parse_msg_bytes  # noqa: PLC0415
            parsed_email = parse_eml_bytes(raw) if mime_type == "message/rfc822" else parse_msg_bytes(raw)
            metadata_dict = metadata_dict or {}
            if parsed_email.subject and not metadata_dict.get("title"):
                metadata_dict["title"] = parsed_email.subject
            if parsed_email.sender and not metadata_dict.get("author"):
                metadata_dict["author"] = parsed_email.sender
            if parsed_email.date and not metadata_dict.get("date"):
                metadata_dict["date"] = parsed_email.date
            if not metadata_dict.get("document_type"):
                metadata_dict["document_type"] = "email"
            if parsed_email.sender:
                metadata_dict["email_from"] = parsed_email.sender
            if parsed_email.to:
                metadata_dict["email_to"] = parsed_email.to
            if parsed_email.cc:
                metadata_dict["email_cc"] = parsed_email.cc
            if parsed_email.message_id:
                metadata_dict["email_message_id"] = parsed_email.message_id
            if parsed_email.in_reply_to:
                metadata_dict["email_in_reply_to"] = parsed_email.in_reply_to
            if parsed_email.references:
                metadata_dict["email_references"] = parsed_email.references
        except Exception as em_exc:
            log.warning("Email metadata extraction warning for %s: %s", document_id, em_exc)

    # Phase 220 (TAKEOFF-01): DXF Takeoff extraction for CAD drawings
    if (
        mime_type in ("application/dxf", "image/vnd.dxf", "application/x-dxf")
        or (filename and filename.lower().endswith(".dxf"))
    ):
        try:
            from app.services.extractors.aspects.dxf import extract_dxf_takeoff  # noqa: PLC0415
            takeoff_payload = extract_dxf_takeoff(raw, filename=filename)
            metadata_dict = metadata_dict or {}
            metadata_dict["_takeoff"] = takeoff_payload
            if not metadata_dict.get("document_type"):
                metadata_dict["document_type"] = "cad_drawing"
        except Exception as dxf_exc:
            log.warning("DXF takeoff extraction warning for %s: %s", document_id, dxf_exc)

    # ── SEED-226 — SAY THAT A MODEL READ THIS, RATHER THAN A PARSER ──────────────────
    #
    # ⚠ NOT DECORATION. Text produced by transcription is INFERRED. Retrieval, the detail
    #   panel and anything that later prices a line item off this document are entitled to
    #   know that before quoting a number from it — and a transcription that cannot be told
    #   apart from a real text layer is precisely the failure SEED-226 was planted on.
    # ⚠ `raw and` IS LOAD-BEARING AND WAS ADDED AFTER A REAL NEAR-MISS. The backfill tool
    #   calls this function with `raw=b""` (the bytes live in storage, not on the row), so
    #   without this guard an image row would be stamped
    #   `_vision = {engine: "vision", pages_transcribed: 1, advisory: true}` for a
    #   transcription THAT NEVER RAN. A provenance record that claims work nobody did is
    #   worse than none — it is the exact "cannot tell inferred from parsed" failure the
    #   stamp exists to prevent, inverted.
    # ⛔ BUG-260905-12 — REMEMBER THAT ENRICHMENT PRODUCED NOTHING, BEFORE ANYTHING HIDES IT.
    #
    # `ingest_document`'s BUG-260905-07 guard keeps a document's existing metadata when a
    # degraded extraction returns `None`. The image branch immediately below promotes that
    # `None` to `{"document_type": "image", "_vision": …}` — a NON-None dict — so for an image
    # that guard can never fire, and the wholesale `update({"metadata": …})` erases the title,
    # date, summary, topics, author and language the document already had.
    #
    # ⚠ MEASURED on the operator's library 2026-09-06, and this is the exact fingerprint:
    #   two re-ingested images left holding `['document_type']` and nothing else, beside a
    #   TIFF and a WebP whose enrichment happened to succeed and which kept all seven fields.
    #   Reported as "re-ingesting the documents again is not extracting metadata" — the
    #   metadata was not missing, it was DELETED by the re-ingest.
    #
    # ⚠ IT IS BUG-260905-07 RE-OPENED THROUGH A PATH ITS GUARD CANNOT SEE, which is why the
    #   flag is captured HERE rather than the guard being duplicated downstream: this is the
    #   last line at which "extraction produced nothing" is still knowable.
    enrichment_degraded = metadata_dict is None

    if raw and mime_type in IMAGE_MIME_TYPES:
        from app.services.extractors.aspects import vision_text  # noqa: PLC0415
        metadata_dict = metadata_dict or {}
        metadata_dict["_vision"] = vision_text.provenance("scan", 1)
        if not metadata_dict.get("document_type"):
            metadata_dict["document_type"] = "image"
    elif vision_provenance is not None:
        metadata_dict = metadata_dict or {}
        metadata_dict["_vision"] = vision_provenance
        if vision_provenance.get("kind") == "drawing" and not metadata_dict.get("document_type"):
            metadata_dict["document_type"] = "drawing"

    # Normalize case-sensitive filter fields for consistent retrieval.
    # D-111-9: lowercase ONLY document_type + language; _confidence is nested and
    # is NEVER touched here, and is NEVER promoted to a flat filter field.
    if metadata_dict:
        if metadata_dict.get("document_type"):
            metadata_dict["document_type"] = metadata_dict["document_type"].lower()
        if metadata_dict.get("language"):
            metadata_dict["language"] = metadata_dict["language"].lower()

    # Phase 112 D-03 (META-05) — re-extract precedence merge guard.
    # Preserve any field a human marked _source='user' (via PATCH /documents/{id}/metadata,
    # Plan 01) across re-extraction, so a later extraction never silently destroys an edit.
    #
    # Pitfall 1 (single write site): this guard MUST live here at the SINGLE
    # ingest_document metadata-write site — NOT in a re-extract wrapper — so ALL THREE
    # re-extract entry points inherit it: /upload + /reingest (-> _upload_pipeline ->
    # ingest_document) and /reextract (-> background_tasks.add_task(ingest_document)).
    # A wrapper-placed guard would pass a /reextract-only test while still destroying
    # edits on /upload + /reingest. The guard reads the PRIOR doc's _source map (there
    # is no request-scoped `body` in this function's scope — Pitfall 1 is self-enforced).
    #
    # Pitfall 2 (degrade): enriched extraction can degrade to metadata_dict=None; we
    # promote None -> {} BEFORE the user-field loop so a degrade-with-prior-user-fields
    # yields {user fields + _source}, never None (a degrade must NOT wipe a human edit).
    #
    # sync .execute() — already inside the BackgroundTask thread (this function is a
    # sync def), so D-v2.5-01 (no blocking I/O in async handlers) does NOT fire here.
    prior = (
        supabase.table("documents").select("metadata")
        .eq("id", document_id).maybe_single().execute()
    )
    # WR-02: defensive-copy the fetched prior blob (+ the nested _source dict we
    # read) so the SELECT result stays pristine and restored values don't share a
    # mutable reference with the prior object. Behavior unchanged; purely defensive.
    prior_meta = dict((getattr(prior, "data", None) or {}).get("metadata") or {})
    # ── BUG-260905-12 — A DEGRADE RESTORES WHAT WAS THERE, NOT JUST WHAT A HUMAN TYPED ────
    #
    # The `_source='user'` loop below preserves HUMAN edits across a re-extract. That was
    # always right and is untouched — but it is not enough, because nothing preserved the
    # MODEL-derived fields, and for an image `metadata_dict` is never None by the time the
    # downstream keep-guard looks at it (see `enrichment_degraded` above).
    #
    # ⚠ ONLY ON A DEGRADE, AND ONLY FOR FIELDS THE FRESH PASS DID NOT SET. A successful
    #   extraction must still be able to CHANGE a title or drop a stale topic — restoring
    #   unconditionally would make metadata permanently un-updatable, which is a worse bug
    #   than the one being fixed.
    #
    # ⚠ UNDERSCORE KEYS ARE EXCLUDED. `_vision`, `_classification`, `_confidence` and
    #   `_source` describe THIS pass; carrying a previous pass's `_vision` forward would
    #   claim a transcription that did not happen — the same class of lie the `raw and`
    #   guard above exists to prevent.
    if enrichment_degraded and prior_meta:
        metadata_dict = metadata_dict or {}
        for fld, val in prior_meta.items():
            if fld.startswith("_"):
                continue
            if fld == "document_type" and metadata_dict.get("document_type") == "image":
                # The placeholder must not outrank a real type the document already carried.
                metadata_dict[fld] = val
            elif fld not in metadata_dict:
                metadata_dict[fld] = val

    user_fields = dict(prior_meta.get("_source") or {})  # {field: "user"}
    if user_fields:
        metadata_dict = metadata_dict or {}  # Pitfall 2: degrade None -> {} before the loop
        preserved_source = metadata_dict.setdefault("_source", {})
        for fld, src in user_fields.items():
            if src != "user":
                continue
            if fld in prior_meta:
                metadata_dict[fld] = prior_meta[fld]  # restore the human value
            else:
                metadata_dict.pop(fld, None)          # human cleared it -> keep it cleared
            preserved_source[fld] = "user"            # keep the marker
            # a human override has no model score -> drop any fresh _confidence for it
            if isinstance(metadata_dict.get("_confidence"), dict):
                metadata_dict["_confidence"].pop(fld, None)

    # ── Phase 233 (BUG-260905-03 / PREV-02) — PROVENANCE SURVIVES EXTRACTION ──────────
    #
    # ⛔ THE WRITE BELOW REPLACES `metadata` WHOLESALE, AND THAT SILENTLY DESTROYED
    #    TIER-1 IDENTITY ON EVERY SUCCESSFUL INGEST.
    #
    # `mint_document_row` stamps `metadata.source = {system, external_id, version}` so a
    # later preview can honestly say "already here — matched by source file, not by
    # content". `metadata_dict` is built from the EXTRACTED metadata and has never heard
    # of that key, so `update({"metadata": metadata_dict})` deleted it the moment a
    # document completed.
    #
    # ⚠ MEASURED ON REAL ROWS, not reasoned about. After a Drive folder import:
    #     13:35:42  completed  src=None                     O6 OPERATIONALIZATION...
    #     13:33:19  failed     src={google, 1GofDH...}       FMrad_AI_writing_report.pdf
    #   ONLY THE FAILED ROWS KEPT THEIR IDENTITY — because only they never reached this
    #   write. The "Already here" bucket would therefore have matched NOTHING, FOREVER,
    #   which is the one bucket Phase 233 exists to make honest.
    #
    # ⚠ It is carried at the SAME SITE as the `_source` user-edit guard above, and off the
    #   SAME `prior_meta` read, deliberately: this is the single metadata-write site all
    #   three re-extract entry points funnel through (/upload, /reingest, /reextract). A
    #   guard placed anywhere else inherits only one of them — Pitfall 1, one key over.
    #
    # ⚠ Extraction has no opinion about these keys. They are stamped by the INGRESS DOOR
    #   and describe where the bytes came from, so re-extracting must carry them forward
    #   untouched rather than re-deriving or dropping them.
    _PROVENANCE_KEYS = ("source",)
    for _pk in _PROVENANCE_KEYS:
        if _pk in prior_meta:
            metadata_dict = metadata_dict or {}
            metadata_dict.setdefault(_pk, prior_meta[_pk])

    # Build a context header prepended to each chunk before embedding.
    # The header makes filename, title, date, and document type visible in the
    # vector space so queries like "amount paid on 17 Jan" can match a receipt
    # whose date appears only in the filename — not in its text content.
    # We embed the enriched text but store the raw chunk for clean display.
    header_parts = [f"Document: {filename}"] if filename else []
    if metadata_dict:
        if metadata_dict.get("title"):
            header_parts.append(f"Title: {metadata_dict['title']}")
        if metadata_dict.get("date"):
            header_parts.append(f"Date: {metadata_dict['date']}")
        if metadata_dict.get("document_type"):
            header_parts.append(f"Type: {metadata_dict['document_type']}")

    # ── SEED-226 — A PARTIAL TRANSCRIPTION SAYS SO IN EVERY CHUNK ───────────────────
    #
    # ⛔ THE ALTERNATIVE WAS A SILENT 5% DOCUMENT. The page budget will transcribe 50 pages
    #   of a 1,000-page scan; without this the document reaches `completed` with no error
    #   and reads as whole. A reader — human or agent — cannot tell a document that HAS no
    #   answer from one whose answer was on page 400.
    #
    # ⚠ IT GOES IN THE HEADER, NOT IN THE BODY, ON PURPOSE. A note appended to the text is
    #   one chunk among many and is retrieved only if it happens to match the query. The
    #   header is prepended to EVERY chunk before embedding, so any retrieved fragment of a
    #   truncated document carries its own limit with it.
    #
    # ⚠ `metadata._vision.truncated` is written too, but is NOT relied on for this: a grep
    #   for the sibling `_images` truncation key across `frontend/src` returns nothing, and
    #   `DocumentDetailPanel` ignores `_`-prefixed keys by contract. That fact has never
    #   reached a human, which is exactly why this one does not depend on the UI.
    if vision_provenance and vision_provenance.get("truncated", {}).get("note"):
        header_parts.append(vision_provenance["truncated"]["note"])

    context_header = f"[{' | '.join(header_parts)}]\n" if header_parts else ""

    return EnrichedIngest(
        text=text,
        metadata=metadata_dict,
        context_header=context_header,
        vision=vision_provenance,
    )
