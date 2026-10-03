---
id: BUG-261004-01
title: Search keeps serving documents that were deleted or unshared at their source
reported: 2026-10-04
surface: Agentic-RAG
severity: major
status: open
affected_areas: [RAG/retrieval, backend/connectors, backend/watch, security/visibility, supabase/rpc]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-210, SEED-343, SEED-341]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: c863af46b
  date: 2026-10-04
---

# BUG-261004-01: Search keeps serving documents that were deleted or unshared at their source

## What we observed

Found by code reading during the 2026-10-04 release-history audit (seeds agent, confirmed by hand). **Not yet driven live.**

The watch loop records three source-side states on `public.documents.source_state` (migration `170_documents_source_state.sql`):

| State | Set by | Meaning |
|---|---|---|
| `missing_at_source` | `backend/app/services/watch_service.py:563` | file deleted or moved at the source (VIS-03) |
| `unauthorized_at_source` | `backend/app/services/watch_service.py:621` | file unshared / permission revoked at the source (VIS-04) |
| `source_disconnected` | `backend/app/api/connectors.py:610` | whole connection disconnected (VIS-05) |

Every retrieval filter excludes **only** `source_disconnected`:

- `supabase/migrations/200_filtered_retrieval_document_scope.sql` — current search RPCs: `AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')` (same clause as mig 170 `:74` / `:112`).
- `backend/app/services/retrieval_scope.py:76` and `:324` — `source_state.is.null,source_state.neq.source_disconnected`.
- `backend/app/services/expert_scope.py:162` — `_NOT_SOURCE_DISCONNECTED`, same rule.

**Expected:** a document the source owner deleted, or stopped sharing, stops being used to answer questions (it may stay visible in the Library as a record, per VIS-03's "retained in Library").
**Actual:** it is still retrieved, cited and quoted in chat, Expert-scoped chat and workflows — indefinitely.

**Production exposure today: none.** Read-only query on 2026-10-04: `SELECT source_state, count(*) FROM documents GROUP BY 1` → all 78 documents `NULL`, 1 org. No document in production carries either state yet.

## Why it matters

- **Revoking access at the source does nothing inside Syrel.** A Drive owner who unshares a file expects it gone; Syrel keeps answering from it. For a B2B buyer this reads as "your product ignores our permissions" — a security-review failure, not a UX nit.
- **Deleted content keeps influencing answers** with citations to a file that no longer exists, which undercuts the "answers with receipts" promise the product is sold on.
- It makes SEED-343 (citations must not surface documents the asker can't open) a present-tense risk for watched sources, not a future one.
- Severity `major` rather than `blocking` only because the watch loop ships **off by default** (`WATCH_PROCESS_ENABLED=false`, SEED-341) and production has zero affected rows today. It becomes blocking the moment a customer turns watching on.

## Hypothesized cause

Hypothesis: Phase 234 deliberately scoped the search filter to VIS-05 (disconnect) and read VIS-03's "retained in Library" as "retained everywhere". The three states were added together, but only one was wired into the RPC predicate, and the later scope helpers (`retrieval_scope.py`, `expert_scope.py`, mig 200) copied that single-state clause verbatim. Needs confirming against `234-CONTEXT.md` / VIS-03..05 wording before deciding whether `missing_at_source` should also be excluded or only demoted.

## Surface classification

`Agentic-RAG` — this app's retrieval and connector code. Routable at `/gsd:discuss-phase`.

## Suggested routing

- **Fold into in-flight phase:** n/a for 273 (artifacts). Strong candidate for **Phase 274 (thread-scoped attachments)** or **275 (retention & legal hold)** in v4.5 — 275 already owns document lifecycle, and the fix is lifecycle-shaped.
- **Defer to future phase / milestone:** only if 274/275 are re-scoped; must land before `WATCH_PROCESS_ENABLED` defaults on (SEED-341) or any customer enables it.
- **Plant as seed:** already tracked as SEED-210 (`partially-answered`); this report is the bug-shaped half of it.
- **External — note only:** no.

Fix shape (for planning, not decided): one shared predicate — exclude `unauthorized_at_source` and `source_disconnected` from retrieval; decide `missing_at_source` explicitly (exclude, or keep with a "deleted at source" citation badge) — applied in the RPCs (new migration), `retrieval_scope.py` and `expert_scope.py` together, plus a test that sets each state and asserts the chunk is or isn't returned. One home for the predicate, so the three copies cannot drift again.

## Workarounds (prompt-side, code-side, or UI-side)

- Keep the watch loop off (the default) — no document then enters either state.
- If a watched file must stop being used: delete the document in the Library, or disconnect the whole connection (which *is* filtered).

## Reference / evidence links

- `supabase/migrations/170_documents_source_state.sql` (states + original RPC filter)
- `supabase/migrations/200_filtered_retrieval_document_scope.sql` (current RPC filter)
- `backend/app/services/watch_service.py:563`, `:621`; `backend/app/api/connectors.py:610`
- `backend/app/services/retrieval_scope.py:76`, `:324`; `backend/app/services/expert_scope.py:162`
- `.planning/seeds/SEED-210-inbound-permission-and-lifecycle-envelope.md`, SEED-343, SEED-341
- `docs/history/v4.0-connected-knowledge.md` (watch loop history)
