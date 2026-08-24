---
phase: 203-outlook-and-email-ingestion-pipeline
plan: 01
subsystem: ingestion-pipeline
tags: [EML-01, EML-02, SEED-150, backend, email, msg, eml, outlook, attachments, metadata, relationships]

requires:
  - phase: 201-csv-and-structured-tabular-ingestion
    provides: tabular text extraction & MIME routing
  - phase: 112-metadata-enrichment-crud
    provides: metadata_dict merge guard & DocumentMetadata extra="allow"
  - phase: 116-document-relationships
    provides: document_relationships schema & attached_to relation enum

provides:
  - parse_eml_bytes() for standard RFC-822 internet email messages
  - parse_msg_bytes() for Outlook compound binary messages via extract-msg
  - strip_quoted_replies() to strip forwarded/reply trails and quote markers
  - format_email_text_for_retrieval() generating clean Markdown chunks
  - Automatic email metadata header extraction (From, To, Cc, Date, Subject, Message-ID)
  - Automatic email attachment extraction and document_relationships linking

affects:
  - upload_document / _upload_pipeline — accepts .eml and .msg files
  - documents table — documents.metadata contains email headers and document_type="email"
  - document_relationships table — contains attached_to relationships between attachments and emails

tech-stack:
  added:
    - extract-msg>=0.48.0 (Outlook OLE binary parser)
  patterns:
    - email-thread-cleaning: strip quotes / forwarding headers before chunking to eliminate retrieval poisoning
    - deterministic-header-metadata: map From, To, Cc, Subject, Date, Message-ID into DocumentMetadata
    - email-attachment-cascade: extract child attachments, upload to storage, and create attached_to document relationships

key-files:
  created:
    - backend/app/services/email_extraction_service.py
    - backend/tests/unit/test_email_ingestion.py
  modified:
    - backend/app/api/documents.py
    - backend/requirements.txt

key-decisions:
  - "Standard library email package used for .eml with RFC 2047 header decoding and HTML-to-text fallback"
  - "extract-msg used for .msg files with safe memory-backed BytesIO streams"
  - "strip_quoted_replies regex engine strips standard On...wrote:, Outlook -----Original Message-----, and > quote blocks"
  - "Attachments automatically stored in documents table and linked to parent email with rel_type='attached_to'"

patterns-established:
  - "email_extraction_service: central module for all email MIME parsing and cleaning"

requirements-completed: [EML-01, EML-02]

duration: 12min
completed: 2026-08-24
---

# Phase 203: Outlook (.msg) & Email (.eml) Ingestion Pipeline — Plan 01 Summary

**Outlook compound binary messages (`.msg`) and internet email messages (`.eml`) are now fully supported with structured header extraction into metadata (`EML-01`), quoted reply/forwarding stripping (`EML-02`), and child attachment extraction with `attached_to` document relationships (`EML-02`).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-24T07:38Z
- **Completed:** 2026-08-24T07:43Z
- **Tasks:** 3
- **Files modified:** 2 (+ 2 created)

## Accomplishments

- `parse_eml_bytes()` & `parse_msg_bytes()`: High-fidelity email parsing supporting RFC-822 and Outlook binary formats with full RFC 2047 character set decoding.
- `strip_quoted_replies()`: Heuristic cleaner removing forwarded message trails, Outlook delimiters, and quote blocks before chunking.
- Header metadata extraction: Sets `title`, `author`, `date`, `document_type="email"`, `email_from`, `email_to`, `email_cc`, `email_message_id`, `email_in_reply_to`, and `email_references`.
- Attachment extraction: Automatically uploads child attachment documents and inserts `document_relationships` records with `rel_type="attached_to"`.
- 10 new unit tests in `test_email_ingestion.py` (56/56 full test suite green).

## Task Commits

1. **Phase 203 Planning** — `271886a4` (`docs(203): create phase plan — 1 plan in 1 wave (EML-01, EML-02)`)
2. **Implementation & Tests** — `725a2b5c` (`feat(203-01): Outlook (.msg) and email (.eml) ingestion pipeline (EML-01, EML-02)`)

## Decisions Made

- `strip_quoted_replies`: Strips historical trails while gracefully falling back to full text if cleaning leaves empty body.
- Attachment ingestion: Direct ingestion into `documents` using the child file's canonical MIME type with fallback to parent context.

## Deviations from Plan

None — executed smoothly and autonomously.

## Next Phase Readiness

- `EML-01` and `EML-02` are fully satisfied.
- Ready for **Phase 204: Scheduled & Recurring Unattended Runs** (`SCHED-01`, `SCHED-02`).

---
*Phase: 203-outlook-and-email-ingestion-pipeline*
*Completed: 2026-08-24*
