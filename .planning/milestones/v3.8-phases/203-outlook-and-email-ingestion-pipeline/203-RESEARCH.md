# Phase 203: Outlook (.msg) & Email (.eml) Ingestion Pipeline — Research

**Gathered:** 2026-08-24
**Status:** Complete

## Technical Architecture

### 1. MIME and Extension Mapping
- `.eml` files: MIME types `message/rfc822`, `application/octet-stream`, `text/plain` with `.eml` extension.
- `.msg` files: MIME types `application/vnd.ms-outlook`, `application/x-msg`, `application/octet-stream` with `.msg` extension.
- Register in `ALLOWED_MIME_TYPES` and `_EXT_MIME_OVERRIDES` in `backend/app/api/documents.py`.

### 2. EML Parser Details (RFC-822 / 2822 / 5322)
- Built-in `email.message_from_bytes(raw, policy=email.policy.default)`.
- Access headers directly: `msg["Subject"]`, `msg["From"]`, `msg["To"]`, `msg["Cc"]`, `msg["Date"]`, `msg["Message-ID"]`.
- Body traversal: `msg.get_body(preferencelist=('plain', 'html'))`.
- Attachments: `msg.iter_attachments()`, retrieving `filename`, `content_type`, and `payload_bytes = att.get_content()`.

### 3. MSG Parser Details (Outlook Compound OLE)
- Using `extract_msg.openMsg(io.BytesIO(raw))` or `extract_msg.Message(io.BytesIO(raw))`.
- Extract properties: `msg.subject`, `msg.sender`, `msg.to`, `msg.cc`, `msg.date`, `msg.messageId`, `msg.body`.
- Attachments: iterate `msg.attachments`, retrieving `att.longFilename or att.shortFilename`, `att.mimetype`, `att.data`.

### 4. Quoted-Reply & Forward Trail Stripping
- Regex patterns for common email reply headers:
  - `On <date>, <sender> wrote:`
  - `-----Original Message-----`
  - `From: ... Sent: ... To: ... Subject: ...`
  - `________________________________` (Outlook horizontal separator)
  - Leading `>` quote lines.
- Preserve the active email text at the top while stripping repetitive historical trails to avoid duplicate retrieval poisoning.

### 5. Document Relationships Schema
- Check `document_relationships` table in Supabase schema:
  - `source_document_id`, `target_document_id`, `relationship_type` (`"attachment"` / `"child"`), `user_id`, `org_id`.
