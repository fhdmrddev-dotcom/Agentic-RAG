# Phase 37: Knowledge Health Dashboard — Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 037-knowledge-health-dashboard-backend
**Areas discussed:** Low-confidence data source, Staleness definition, API response shape, Never-retrieved scope

---

## Low-Confidence Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Query messages table | Join messages.source_refs against messages.confidence_avg_similarity. No migration needed. | ✓ |
| Add avg_similarity to audit log | Extend search.query metadata. Clean but historical entries missing, requires write-path change. | |
| Use confidence_level only | Use High/Medium/Low text enum. Coarser but simpler. | |

**User's choice:** Query messages table (Recommended)

---

## Confidence Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Avg similarity < 0.40 | Matches existing Low threshold from Phase 26 _compute_confidence | ✓ |
| Avg similarity < 0.55 | Catches Medium confidence documents too | |
| You decide | Claude picks threshold during planning | |

**User's choice:** < 0.40 (Recommended)

---

## Staleness Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Latest version's created_at | is_latest=True row's created_at. Re-uploads reset the clock. | ✓ |
| Original upload date | First-ever upload date. Re-uploads don't reset staleness. | |

**User's choice:** Latest version's created_at (Recommended)

---

## Staleness Configurability

| Option | Description | Selected |
|--------|-------------|----------|
| Query param on endpoint | GET /knowledge-health/summary?stale_days=90 | ✓ |
| Code constant only | Hardcode 90 days | |
| User settings field | Store per-user preference in settings table | |

**User's choice:** Query param (Recommended)

---

## API Response Shape — Document Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight summary | document_id, filename, folder_id, created_at, file_size + metric value | ✓ |
| Full document object | All columns from documents table | |
| Just IDs + name | Minimal — Phase 38 fetches details separately | |

**User's choice:** Lightweight summary (Recommended)

---

## Metrics Time Window

| Option | Description | Selected |
|--------|-------------|----------|
| Last 30 days | Consistent with audit log filter presets | ✓ |
| All-time | Every retrieval event since audit log creation | |
| Configurable via query param | ?window=30d | |

**User's choice:** Last 30 days (Recommended)

---

## Never-Retrieved Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Zero retrieval events ever | No search.query audit entry has ever referenced this document | ✓ |
| Zero in last 30 days | Not retrieved recently — catches forgotten content | |

**User's choice:** Zero retrieval events ever (Recommended)

---

## Claude's Discretion

- Exact aggregation strategy (Supabase client vs Python-side) for most-retrieved
- Whether to add a Postgres index in this phase or defer
- Error handling style

## Deferred Ideas

None.
