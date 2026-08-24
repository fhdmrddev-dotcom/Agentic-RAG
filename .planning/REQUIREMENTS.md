# Requirements — v3.8 Document Intelligence, Automations & Connectors

**Milestone:** v3.8 · **Opened:** 2026-08-24 · **Status:** Scoped, Roadmap Active

**Goal:** Elevate document ingestion to first-class structured table and email parsing, deliver unattended recurring workflow execution with strict spend caps, provide stateful multi-run memory, and wire governed outbound action connectors.

**Provenance:** Requirements trace directly to user-reported operational seeds (`SEED-149`, `SEED-150`, `SEED-060`, `SEED-087`, `SEED-014`, `SEED-167`, `SEED-168`, `SEED-144`, `SEED-145`, `SEED-146`, `CONN-02`).

---

## v3.8 Requirements

### Tabular Ingestion & Table Search (TAB)

- [x] **TAB-01**: CSV and spreadsheet files automatically extract structured tables into `document_tables` during ingestion, enabling `query_table` on CSV documents. *(SEED-149, SEED-060)*
- [x] **TAB-02**: Extracted tables (CSV, DOCX, PDF) are injected as structured markdown representations and summaries into `document_chunks` so semantic vector search retrieves facts located within table cells. *(SEED-149, SEED-087, SEED-021, SEED-022)*

### Email Ingestion Pipeline (EML)

- [x] **EML-01**: Outlook compound binary (`.msg`) and RFC-822 (`.eml`) email files are parsed on upload with headers (From, To, Cc, Date, Subject) extracted into first-class metadata. *(SEED-150)*
- [x] **EML-02**: Email thread deduplication and quoted-reply stripping prevent duplicate retrieval poisoning, and email attachments are extracted and linked via document relationships. *(SEED-150)*

### Automations & Scheduled Runs (SCHED)

- [ ] **SCHED-01**: An author or admin can configure a cron or interval schedule for published workflows to execute unattended in the background. *(SEED-014)*
- [ ] **SCHED-02**: Unattended scheduled runs enforce hard spend-cap and execution limits (token budget & duration circuit breaker) to prevent runaway costs. *(SEED-014)*

### Stateful Workflows & Living Registers (STATE)

- [ ] **STATE-01**: A workflow can read the state/output of its own previous run to perform incremental processing (e.g. living risk registers, weekly diff reports). *(SEED-167, SEED-168)*
- [ ] **STATE-02**: Workflow deliverable outputs can render state deltas (added, updated, closed items) relative to prior executions. *(SEED-167)*

### Outbound Action Connectors (CONN)

- [ ] **CONN-02**: First-party governed outbound action connectors for Jira (create/update issue) and Email/SMTP (send report/notification) can be configured and triggered from workflow external action nodes. *(CONN-02, SEED-146)*
- [ ] **CONN-03**: Connector credentials and configs are managed as platform/org-level assets in Settings with encrypted storage and cross-tenant isolation. *(SEED-144, SEED-145)*

---

## Traceability

| REQ ID | Phase | Description | Status |
|---|---|---|---|
| **TAB-01** | 201 | CSV & Structured Tabular Ingestion | Complete (2026-08-24) |
| **TAB-02** | 202 | Table Chunks Retrieval Injection & Semantic Search | Complete (2026-08-24) |
| **EML-01** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **EML-02** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **SCHED-01** | 204 | Scheduled & Recurring Unattended Runs | Planned |
| **SCHED-02** | 204 | Scheduled & Recurring Unattended Runs | Planned |
| **STATE-01** | 205 | Stateful & Incremental Workflows | Planned |
| **STATE-02** | 205 | Stateful & Incremental Workflows | Planned |
| **CONN-02** | 206 | Outbound Action Connectors (Jira, Email, Slack) | Planned |
| **CONN-03** | 206 | Outbound Action Connectors (Jira, Email, Slack) | Planned |
