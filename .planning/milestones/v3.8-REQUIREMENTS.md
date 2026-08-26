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

- [x] **SCHED-01**: An author or admin can configure a cron or interval schedule for published workflows to execute unattended in the background. *(SEED-014)*
- [x] **SCHED-02**: Unattended scheduled runs enforce hard spend-cap and execution limits (token budget & duration circuit breaker) to prevent runaway costs. *(SEED-014)*
- [x] **L-01**: Cancelling a run — by a person, or by SCHED-02's circuit breaker — **stops the work**, not just the record. The producer issues no further provider calls after cancellation, at `WORKER_COUNT=2`, through the SAME path the manual Stop uses. *(Folded from Phase 194's recorded residual, 2026-08-24 — see ROADMAP → Phase 204. Acceptance is behavioural: measured provider requests, never inferred from the status column.)*

### Stateful Workflows & Living Registers (STATE)

- [x] **STATE-01**: A workflow can read the state/output of its own previous run to perform incremental processing (e.g. living risk registers, weekly diff reports). *(SEED-167, SEED-168)*
- [x] **STATE-02**: Workflow deliverable outputs can render state deltas (added, updated, closed items) relative to prior executions. *(SEED-167)*

### Outbound Action Connectors (CONN)

- [x] **CONN-02** *(RE-SCOPED 2026-08-24)*: A workflow reaches **Atlassian (Jira + Confluence) and GitHub through their official MCP servers** — reads as well as writes — with per-tool permissions and no per-vendor adapter code. ⚠ **Was:** *"First-party governed outbound action connectors for Jira (create/update issue) and Email/SMTP (send report/notification)"*. The Email/SMTP half moves to the Connections milestone (generic SMTP/IMAP). *(CONN-02, SEED-146 — see `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`)*
- [x] **CONN-03** *(PARTIALLY RE-SCOPED 2026-08-24)*: Connector credentials and configs are managed as platform/org-level assets in Settings with encrypted storage and cross-tenant isolation. ⚠ **The OAuth half is NOT in Phase 206** — MCP servers carry their own auth; Google/Microsoft OAuth is Connections-milestone work. ⚠ **The connection must be PROVIDER-shaped with PER-TOOL grants**, and Phase 206 commits that shape: a per-connector toggle cannot express "grant search freely, hold `Create issue` behind a confirm", and retrofitting the grain later is a migration. *(SEED-144, SEED-145)*

---

## Traceability

| REQ ID | Phase | Description | Status |
|---|---|---|---|
| **TAB-01** | 201 | CSV & Structured Tabular Ingestion | Complete (2026-08-24) |
| **TAB-02** | 202 | Table Chunks Retrieval Injection & Semantic Search | Complete (2026-08-24) |
| **EML-01** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **EML-02** | 203 | Outlook (`.msg`) & Email (`.eml`) Ingestion Pipeline | Complete (2026-08-24) |
| **SCHED-01** | 204 | Scheduled & Recurring Unattended Runs | ✅ **VERIFIED LIVE (2026-08-24)** — migrations 124 + 125 applied to local (dev data intact: 236 runs / 2881 audit rows unchanged), `full-schema.sql` regenerated. A real schedule was claimed in ~20s and launched a real unattended run. Exactly-once driven under genuine concurrency: **10 trials × 3 concurrent claimers on one due row → exactly 1 claim every time, 0 duplicates, 0 missed**, and a re-claim immediately after returns 0 (proving the in-transaction `next_run_at` advance, not just the lock, is what removes the row). ⚠ Owed: the schedule **dialog** has had no live UAT, and the concurrency proof is 3 connections in one process rather than 2 uvicorn workers — the claim is database-side so the property transfers, but the multi-process lifecycle (both workers booting a `SchedulerService`) is untested. |
| **SCHED-02** | 204 | Scheduled & Recurring Unattended Runs | ✅ **VERIFIED LIVE (2026-08-24)** — ⚠ **AND IT WAS BROKEN WHEN THE PHASE "PASSED".** 204-03 wrote the caps to `workflow_runs.inputs`; 204-02's `load_run_budget` read `workflow_runs.metadata`; `scheduler_service.py` contained **zero** occurrences of `metadata`. Because the read FAILS OPEN the breaker disarmed **silently** — measured on run `27e00e7e`: **3m20s against a 120s cap**. 106 tests were green because each parallel wave mocked the other side. Fixed by `arm_run_budget` (`57024280`) + an 8-case seam suite whose counterfactual drives 3 RED. **Now driven end to end:** a 60s cap tripped at **61.06s**, `reason=max_duration_exceeded`, run `cancelled`, 1 × `circuit_breaker_tripped` audit row. ⚠ Still true: token coverage is **3 of 4 phase types** — `llm_emit` cannot measure its own spend (`forced_emit.py` has zero `usage` occurrences). |
| **L-01** | 204 | Scheduled & Recurring Unattended Runs — cancellation reaches the PRODUCER | ✅ **BOTH CLAUSES NOW MET (2026-08-24)** — (a) *"or by SCHED-02's circuit breaker"*: the breaker composes `cancel_workflow_run_internals`, the SAME path manual Stop uses (D-204-03), and it was **observed stopping a real run** at 61s. (b) *`WORKER_COUNT=2`*: exactly-once driven under real concurrency, 10/10 trials with 3 racing claimers. ⚠ **Stated precisely rather than over-claimed:** the concurrency is 3 pooled connections in ONE process. The claim is entirely database-side (`FOR UPDATE SKIP LOCKED` + in-transaction advance), so Postgres cannot distinguish it from 3 workers — but two real uvicorn processes each booting a `SchedulerService` has not been exercised. |
| **STATE-01** | 205 | Stateful & Incremental Workflows | Complete (2026-08-24) - CORRECTED AT MILESTONE AUDIT 2026-08-26: this row still read `Planned` two days after the phase shipped. `205-VERIFICATION.md` (retroactive) re-derived 9/9 tests at HEAD. Owed: no live run of a genuinely stateful workflow across two executions has been recorded. |
| **STATE-02** | 205 | Stateful & Incremental Workflows | Complete (2026-08-24) - CORRECTED AT MILESTONE AUDIT 2026-08-26, same as STATE-01. |
| **CONN-02** | 206 | **MCP Connector Client — workflow-scoped** | ✅ Complete (2026-08-25, round trip DRIVEN LIVE against mcp.deepwiki.com) — ⚠ **CORRECTED AT MILESTONE AUDIT 2026-08-26**; this row still read `Planned` after 206 plus three inserts had shipped — ⚠ **RE-SCOPED 2026-08-24**: Atlassian + GitHub via official MCP servers, reads included, zero adapter code. Email/SMTP → Connections milestone. |
| **CONN-03** | 206 | **MCP Connector Client — workflow-scoped** | ✅ Complete for the credential half (2026-08-25) — ⚠ **CORRECTED AT MILESTONE AUDIT 2026-08-26**; still read `Planned`. **OAuth half explicitly deferred to the Connections milestone (SEED-204)** — credential-as-platform-asset half satisfied in 206; **OAuth half → Connections milestone**. ⚠ *"Workflow-scoped" is SEQUENCING, not an architectural boundary* — SEED-145 requires connections callable from chat, and 206 may not put a workflow-shaped FK on the connection. |
