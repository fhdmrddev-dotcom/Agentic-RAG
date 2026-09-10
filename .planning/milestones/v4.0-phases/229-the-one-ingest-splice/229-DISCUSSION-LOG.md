# Phase 229: The One Ingest Splice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 229-the-one-ingest-splice
**Areas discussed:** Splice Interface & Execution Layering, Deduplication Policy Across Producers, Email Attachment Cascade Isolation & Failure Reporting, Storage Upload Lifecycle

---

## Splice Interface & Execution Layering

| Option | Description | Selected |
|--------|-------------|----------|
| Two decoupled functions | mint_document_row() for DB minting/dedup/versioning, and run_ingest_pipeline() / splice_document() for heavy extraction/chunking | ✓ |
| Single unified ingest_file() | Single function accepting an optional BackgroundTasks instance | |
| You decide | Pick cleanest architecture for testability | |

**User's choice:** Two decoupled functions in `ingest_splice.py`.
**Notes:** Cleanly separates the fast, synchronous HTTP response from background execution.

| Option | Description | Selected |
|--------|-------------|----------|
| Return MintResult dataclass | Structured dataclass (document dict, is_duplicate bool, storage_path str, version_number int) | ✓ |
| Return tuple | Tuple (doc_dict, is_duplicate) | |
| You decide | Service layer conventions | |

**User's choice:** Return structured `MintResult` dataclass.
**Notes:** Explicit and type-safe, enabling callers to branch cleanly on duplicate detection.

| Option | Description | Selected |
|--------|-------------|----------|
| Move upload pipeline to splice_document() | Move pipeline execution into ingest_splice.py, leave backwards-compatible delegate stub _upload_pipeline in documents.py | ✓ |
| Move both _upload_pipeline and ingest_document | Move both completely into ingest_splice.py | |
| You decide | Balance module architecture against G-5 lines | |

**User's choice:** Move upload pipeline execution into `splice_document()`, keeping `_upload_pipeline` stub in `documents.py`.
**Notes:** Ensures all existing integration tests and callers remain green while achieving G-5 discharge.

| Option | Description | Selected |
|--------|-------------|----------|
| Sync core with async wrapper | Sync core mint_document_row() with threadpool-wrapped async_mint_document_row() | ✓ |
| Pure sync | Pure sync requiring callers to wrap in run_in_threadpool | |
| You decide | Prevent event-loop blocking | |

**User's choice:** Sync core with async wrapper.
**Notes:** Prevents event loop blocking in FastAPI async routes while allowing direct sync calls in background threads (email cascade).

---

## Deduplication Policy Across Producers

| Option | Description | Selected |
|--------|-------------|----------|
| Parity with /upload (HTTP 200) | Return existing document with HTTP 200, short-circuiting background work | ✓ |
| Force new version | Increment version_number on duplicate bytes | |
| You decide | Complete parity with /upload door | |

**User's choice:** Return existing document with HTTP 200 (exact parity with `/upload`).
**Notes:** Directly satisfies Success Criterion #2.

| Option | Description | Selected |
|--------|-------------|----------|
| Link existing document | Create document_relationships link ('attached_to') and skip duplicate chunking/storage | ✓ |
| Mint new version | Mint new version of attachment and link new version | |
| You decide | Prevent collisions and preserve relationships | |

**User's choice:** Link existing document without re-ingesting.
**Notes:** Prevents unique constraint collisions on `documents_dedup_idx` while preserving the relationship graph.

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform folder-scoped deduplication | Match on (user_id, content_hash, folder_id, status='completed', is_latest=True), defaulting folder_id=None | ✓ |
| Global deduplication | Global deduplication ignoring folder_id | |
| You decide | Preserve existing upload contract | |

**User's choice:** Uniform folder-scoped deduplication across all callers.
**Notes:** Preserves upload path contract (Success Criterion #4).

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform versioning | Query highest version_number on filename match, set previous is_latest=False, mint new version | ✓ |
| Producer-configurable flag | Flag to toggle versioning | |
| You decide | Adhere strictly to TRUST-01 | |

**User's choice:** Uniform versioning across all producers on matching filename.
**Notes:** Guarantees consistent version history regardless of ingress source.

---

## Email Attachment Cascade Isolation & Failure Reporting

| Option | Description | Selected |
|--------|-------------|----------|
| Per-attachment isolation | Wrap each attachment in isolated try/except block | ✓ |
| Abort whole email | Abort email processing on any attachment failure | |
| You decide | Satisfy SC#3 | |

**User's choice:** Per-attachment isolation in the cascade loop.
**Notes:** Fixes D-5 defect 2: failure on attachment 1 will not abort attachment 2.

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest error reporting | Record manifest in parent email's metadata["attachments"], mark child doc status='failed' | ✓ |
| Child doc status only | Only set child document status='failed' | |
| You decide | UI-friendly pattern | |

**User's choice:** Record manifest in parent email's metadata, mark child doc `status='failed'` with `error_message`.
**Notes:** Zero schema migrations required; full visibility into which attachments failed and why.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated integration test | Add test_email_identical_attachment_dedup verifying two emails with identical attachments | ✓ |
| Unit tests only | Cover via unit tests on mint_document_row | |
| You decide | Strongest regression guardrail | |

**User's choice:** Add dedicated integration test `test_email_identical_attachment_dedup`.
**Notes:** Directly tests and proves Claude's BUS-106 inference.

| Option | Description | Selected |
|--------|-------------|----------|
| Mark failed with error_message | Update attachment document row to status='failed' with sanitized error_message | ✓ |
| Delete orphaned row | Delete the row on extraction failure | |
| You decide | Align with root /upload | |

**User's choice:** Update attachment document row to `status='failed'` with sanitized `error_message`.
**Notes:** Avoids orphaned `pending` rows in the Library and provides clear failure states.

---

## Storage Upload Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Upload in splice_document() | Upload raw file bytes inside background task | ✓ |
| Foreground upload | Upload before minting document row | |
| You decide | Instant-201 contract | |

**User's choice:** Storage upload inside `splice_document()` in background task.
**Notes:** Preserves instant 201 response time for API callers.

| Option | Description | Selected |
|--------|-------------|----------|
| Upload failure non-regression | Log storage upload failures and proceed with in-memory extraction | ✓ |
| Fail loud | Mark document status='failed' if storage upload fails | |
| You decide | Balance SC#4 against storage integrity | |

**User's choice:** Preserve existing upload path behavior: log error and proceed with in-memory extraction.
**Notes:** Preserves existing `/upload` behavior strictly (Success Criterion #4).

| Option | Description | Selected |
|--------|-------------|----------|
| Full document row return | Return full minted document row from mint_document_row() | ✓ |
| Legacy 5-field subset | Return legacy dict (id, filename, mime_type, status, file_size) | |
| You decide | Clean API design | |

**User's choice:** Return the full document row for `POST /connectors/{id}/import`.
**Notes:** Establishes uniform API contract between `/upload` and connector imports.

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform 4-site chunk orchestration | Uniformly orchestrate text, table, image chunks and final recount | ✓ |
| Optional multimodal writes | Allow callers to disable multimodal chunks | |
| You decide | Satisfy SC#2 | |

**User's choice:** Uniformly execute all 4 chunk operations across all document sources.
**Notes:** Enforces Success Criterion #2: same searchable chunks and metadata regardless of ingress source.

---

## Claude's Discretion
- Internal helper decomposition in `backend/app/services/ingest_splice.py`.
- Exact logging formats and error string sanitization for attachment cascade failures.

---

## Deferred Ideas
- **Centralized User Access & Group-Based Document Sharing (SEED-115 / SEED-210 Enrichment):**
  - Mental Model: Dual-tier storage where each user has private personal storage, and can selectively share individual documents or folders with specific departments/groups (e.g. HR, Engineering, Finance) or the entire organization.
  - Centralized Governance: Central admin/operator console with visibility into all documents across groups and users, audit trails, and share management.
  - Forward-compatibility in Phase 229: `mint_document_row` accepts optional `org_id` and extensible `metadata`, checking existing org-shared folder visibility without locking in single-user assumptions.
