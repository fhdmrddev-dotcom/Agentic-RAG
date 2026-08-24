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
- [ ] **L-01**: Cancelling a run — by a person, or by SCHED-02's circuit breaker — **stops the work**, not just the record. The producer issues no further provider calls after cancellation, at `WORKER_COUNT=2`, through the SAME path the manual Stop uses. *(Folded from Phase 194's recorded residual, 2026-08-24 — see ROADMAP → Phase 204. Acceptance is behavioural: measured provider requests, never inferred from the status column.)*

### Stateful Workflows & Living Registers (STATE)

- [ ] **STATE-01**: A workflow can read the state/output of its own previous run to perform incremental processing (e.g. living risk registers, weekly diff reports). *(SEED-167, SEED-168)*
- [ ] **STATE-02**: Workflow deliverable outputs can render state deltas (added, updated, closed items) relative to prior executions. *(SEED-167)*

### Outbound Action Connectors (CONN)

- [ ] **CONN-02** *(RE-SCOPED 2026-08-24)*: A workflow reaches **Atlassian (Jira + Confluence) and GitHub through their official MCP servers** — reads as well as writes — with per-tool permissions and no per-vendor adapter code. ⚠ **Was:** *"First-party governed outbound action connectors for Jira (create/update issue) and Email/SMTP (send report/notification)"*. The Email/SMTP half moves to the Connections milestone (generic SMTP/IMAP). *(CONN-02, SEED-146 — see `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`)*
- [ ] **CONN-03** *(PARTIALLY RE-SCOPED 2026-08-24)*: Connector credentials and configs are managed as platform/org-level assets in Settings with encrypted storage and cross-tenant isolation. ⚠ **The OAuth half is NOT in Phase 206** — MCP servers carry their own auth; Google/Microsoft OAuth is Connections-milestone work. ⚠ **The connection must be PROVIDER-shaped with PER-TOOL grants**, and Phase 206 commits that shape: a per-connector toggle cannot express "grant search freely, hold `Create issue` behind a confirm", and retrofitting the grain later is a migration. *(SEED-144, SEED-145)*

---

## Traceability

| REQ ID | Phase | Description | Status |
|---|---|---|---|
| **TAB-01** | 201 | CSV & Structured Tabular Ingestion | Complete (2026-08-24) |
| **TAB-02** | 202 | Table Chunks Retrieval Injection & Semantic Search | Complete (2026-08-24) |
| **EML-01** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **EML-02** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **SCHED-01** | 204 | Scheduled & Recurring Unattended Runs | ⚠ Built (204-03) — NOT verified: migration 124 is authored but **UNAPPLIED**, so the table does not exist on any database yet. Flip to Complete only after the SQL-editor paste + `regenerate-full-schema.sh` + the owed UAT rows in `204-03-SUMMARY.md`. |
| **SCHED-02** | 204 | Scheduled & Recurring Unattended Runs | ⚠ Built (204-02) — NOT verified: **migration 125 is authored but UNAPPLIED**, and `workflow_runs.metadata` did not previously exist. ⚠ **`load_run_budget` FAILS OPEN — with 125 unapplied the read raises, the budget resolves empty, and every run proceeds UNCAPPED.** So the enforcement half is not merely unrecorded, it is OFF. 37 cases pass; 6 counterfactuals driven RED (CF-B: removing the duration sentinel took the suite 5.6s → 24.9s because the hung phase stopped being killed). ⚠ Token coverage is **3 of 4 phase types** — `llm_agent`/`llm_batch_agents`/`llm_single` ✅, **`llm_emit` ❌** (`forced_emit.py` has zero `usage` occurrences and cannot measure its own spend). Flip to Complete after the SQL-editor paste + a live capped run. |
| **L-01** | 204 | Scheduled & Recurring Unattended Runs — cancellation reaches the PRODUCER | **Partial (204-01 + 204-02, 2026-08-24)** — ⚠ **ONE of the two named blockers is now CLEARED, the other is NOT, and the row is deliberately still unchecked.** ✅ CLEARED: *"or by SCHED-02's circuit breaker"* — 204-02 built the breaker and it composes `cancel_workflow_run_internals`, the SAME path the manual Stop uses (D-204-03), rather than a second cancel channel. Verified on the MERGED tree: the three phase-204 suites run together **100 passed**, which is the first time the two halves met. ⚠ **STILL OWED: the `WORKER_COUNT=2` clause.** It is verified as an in-process isolation property (worker A shares only Redis + Postgres with worker B) — there is **no live two-uvicorn-worker row**, and the requirement names that condition explicitly. ⚠ Also owed by inheritance: with migration 125 unapplied the breaker cannot trip at all, so the breaker-initiated arm of this requirement is currently unreachable in a running system. |
| **STATE-01** | 205 | Stateful & Incremental Workflows | Planned |
| **STATE-02** | 205 | Stateful & Incremental Workflows | Planned |
| **CONN-02** | 206 | **MCP Connector Client — workflow-scoped** | Planned — ⚠ **RE-SCOPED 2026-08-24**: Atlassian + GitHub via official MCP servers, reads included, zero adapter code. Email/SMTP → Connections milestone. |
| **CONN-03** | 206 | **MCP Connector Client — workflow-scoped** | Planned — credential-as-platform-asset half satisfied in 206; **OAuth half → Connections milestone**. ⚠ *"Workflow-scoped" is SEQUENCING, not an architectural boundary* — SEED-145 requires connections callable from chat, and 206 may not put a workflow-shaped FK on the connection. |
