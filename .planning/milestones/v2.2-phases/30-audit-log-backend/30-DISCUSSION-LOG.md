# Phase 30: Audit Log — Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 30-audit-log-backend
**Areas discussed:** Action type naming, Audit service pattern, Failure handling, Settings change granularity

---

## Action Type Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Dotted namespace | e.g., `document.upload`, `search.query` — readable, groupable by prefix in Phase 31 filters | ✓ |
| SCREAMING_SNAKE | e.g., `DOCUMENT_UPLOAD`, `SEARCH_QUERY` — traditional DB enum style | |
| Short verbs | e.g., `upload`, `delete`, `search` — minimal but loses context | |

**User's choice:** Dotted namespace (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text + CHECK constraint | Flexible, no ALTER TYPE needed to add values | ✓ |
| Postgres enum type | Type-safe at DB level but requires ALTER TYPE for new values | |
| You decide | Claude picks the approach | |

**User's choice:** Plain text + CHECK constraint (Recommended)
**Notes:** None

---

## Audit Service Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated audit_service.py | Single module, centralized write helper, imported by routers | ✓ |
| Inline in each router | Scattered across 6 files, simple but hard to change later | |
| FastAPI middleware | Too coarse-grained — can't capture rich payload data | |

**User's choice:** Dedicated audit_service.py (Recommended)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| FastAPI BackgroundTasks | Built-in, request-scoped, add_task() after response | ✓ |
| asyncio.create_task() | Works but not tied to request lifecycle | |
| You decide | Claude picks the mechanism | |

**User's choice:** FastAPI BackgroundTasks (Recommended)
**Notes:** None

---

## Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Log to stderr + continue | Catch exception, log to stderr, swallow — user unaffected | ✓ |
| Completely silent | Catch and discard — makes debugging impossible | |
| Log + LangSmith trace | More observable but adds LangSmith dependency to audit path | |

**User's choice:** Log to stderr + continue (Recommended)
**Notes:** None

---

## Settings Change Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| One entry per save, no diff | Log settings.update on every PUT /settings, store full payload | ✓ |
| Per-field diff | Compare old vs. new, log only changed fields | |
| Entry with diff metadata | One entry + diff of changed fields | |

**User's choice:** One entry per save, no diff (Recommended)
**Notes:** None

---

## Claude's Discretion

- Table column set and exact schema
- `metadata` JSONB shape per action type (intended shape documented in CONTEXT.md D-07)
- RLS policy implementation details
- `write_audit_entry()` function signature
- Index strategy

## Deferred Ideas

None raised during discussion.
