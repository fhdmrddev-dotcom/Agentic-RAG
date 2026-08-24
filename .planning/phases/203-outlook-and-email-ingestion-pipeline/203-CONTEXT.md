# Phase 203: Outlook (.msg) & Email (.eml) Ingestion Pipeline — Context

**Gathered:** 2026-08-24
**Status:** Ready for execution
**Source:** Autonomous GSD Execution (EML-01, EML-02)

<domain>
## Phase Boundary

Ingestion pipeline support for Outlook binary messages (`.msg`, MIME: `application/vnd.ms-outlook`, `application/x-msg`) and standard internet email files (`.eml`, MIME: `message/rfc822`, `text/plain` extension `.eml`).
Extracts email header metadata into first-class document metadata, strips quoted/forwarded replies for clean chunking, and extracts attachments as separate linked documents in `document_relationships`.

</domain>

<decisions>
## Implementation Decisions

### 1. File Format Handling & Parsers
- **D-01:** RFC-822 `.eml` parsed using Python built-in standard library `email` package (`email.policy.default`) for robust MIME decoding (UTF-8, ISO-8859-1, quoted-printable, base64).
- **D-02:** Outlook `.msg` parsed using `extract-msg` (`extract_msg.openMsg`).

### 2. Header Extraction & Metadata Schema (EML-01)
- **D-03:** Extract core headers into document metadata fields:
  - `title` / `subject` -> Email Subject
  - `author` / `from` -> Sender name & address
  - `date` -> ISO 8601 email sent timestamp
  - `document_type` -> `"email"`
  - `to`, `cc`, `bcc`, `message_id`, `in_reply_to`, `references` stored in metadata dictionary for semantic search and graph querying.

### 3. Body Extraction & Quoted-Reply Stripping (EML-02)
- **D-04:** Prefer plain-text body (`text/plain`). If only HTML body exists, strip HTML tags via clean parser (`html2text` or `HTMLParser`).
- **D-05:** Strip quoted replies and forwarding trails (e.g. lines starting with `>`, `From:`, `-----Original Message-----`, `On <date>, <author> wrote:`) to prevent duplicate chunk retrieval and context window poisoning.

### 4. Attachment Extraction & Document Relationships (EML-02)
- **D-06:** Attached files (PDFs, DOCX, CSV, images, spreadsheets) in `.msg` and `.eml` are extracted during upload.
- **D-07:** Each valid attachment is ingested as a child document and linked to the parent email via `document_relationships` (`relationship_type: "attachment"`).

</decisions>

<canonical_refs>
## Canonical References

- `backend/app/api/documents.py` — Ingestion pipeline, MIME type overrides, and `_upload_pipeline`
- `backend/app/services/extraction_service.py` — Document extractors and text parsing
- `backend/app/models/document.py` — Document and metadata models
- `supabase/migrations/` — `document_relationships` schema and constraints

</canonical_refs>
