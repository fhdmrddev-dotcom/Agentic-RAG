---
id: BUG-260923-02
title: Long lists scroll endlessly or silently truncate — pagination is missing or inconsistent app-wide
reported: 2026-09-23
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/admin-spend, frontend/lists, frontend/library, frontend/navigation, backend/api-list-endpoints]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: dea7f5539
  date: 2026-09-23
---

# BUG-260923-02: Long lists need pagination — one of them silently hides most of its rows

## What we observed

Operator report after the v4.3 deploy: *"anywhere in the application that has a very big list — for
example the Spend page with all the entries — we have to implement pagination so I can navigate
through pages, same as the documents page, instead of scrolling down endlessly."*

Measured in code at `dea7f5539`:

### ⛔ The Spend ledger is TRUNCATED, not just long (the severity driver)

`frontend/src/pages/admin/AdminSpendPage.tsx:117-121` fetches the ledger with `limit: 50` and
**no offset, ever**. The header renders the full count — *"Attributable Runs Ledger
({totalRunsCount})"* (`:589`), which on the dev DB reads **1183** — while only the first 50 rows
exist on the page. The backend already supports paging (`api/admin_spend.py:127-128`,
`limit ≤ 200`, `offset`) and the client already sends `offset` when given one
(`lib/api/spend.ts:96-97`); **nothing in the UI ever passes it.** Rows 51+ are unreachable.

### Lists with paging today (the pattern to reuse)

- Library documents — `components/library/DocumentsPager.tsx` (108 lines) via `LibraryPage.tsx`
- Knowledge-health feedback — `components/health/PaginationControls.tsx` (46 lines)
- Control Room audit (`AuditTab.tsx`, `/admin/audit` 1-based `page`/`page_size ≤ 100`), Org audit
  (`OrgAuditTab.tsx`), users roster (`/admin/users`)

⚠ **Two different pager components already exist** (`DocumentsPager` and `PaginationControls`)
and the backend uses **two conventions** (`page`/`page_size` in admin/audit/org vs
`limit`/`offset` in spend, governance and knowledge-health). A fix that adds a third is the
failure mode to avoid.

### Lists that return EVERYTHING in one response (no paging parameter at all)

`GET /threads` (`threads.py:233`), `GET /skills` (`skills.py:196`), `GET /experts`
(`experts.py:393`) — each returns a full `list[...]`. They are short today; the chat-history
column and the Skills / Experts catalogs grow without bound per user or org.

## Update 2026-09-23 — Spend ledger FIXED (`43360c9bc`)

The truncation is fixed on `develop`: the ledger pages with the shared `PaginationControls`
("Showing 1–50 of N", Previous / Next); page clicks refetch the ledger only; a filter change
returns to page 1. 4 new tests, RED without the fix. **Not yet deployed to production.** The
app-wide half (one pager, one backend convention, the unpaged `/threads` `/skills` `/experts`)
remains open — this report stays `open` for it.

## Why it matters

- **Spend:** an operator reading the ledger to reconcile cost sees 50 of 1,183 runs with no way to
  reach the rest, under a header that states the full number — on the page whose purpose is saying
  honestly what it can and cannot see. That is the `major`.
- **Everywhere else:** endless scrolling degrades as data grows, and each list that fetches
  everything gets slower per user over time.

## Hypothesized cause

No shared list/paging contract. Each surface was built in its own phase and chose its own answer
(pager, "first N", or everything), and the Spend ledger shipped its backend half without the UI
half — the same built-but-unreachable pattern Phase 257.1 fixed for the Spend page itself.

## Proposed direction (to be decided at scoping)

1. **Fix the Spend ledger first** — small: wire `offset` through a pager; the API is ready.
2. **One pager component** (consolidate `DocumentsPager` + `PaginationControls`) and **one backend
   convention**, then adopt it list by list, largest first: Spend ledger → workflow run history →
   chat history (`/threads`) → Skills → Experts.
3. Decide per surface: numbered pages (ledgers, audit, library — "navigate through pages", the
   operator's ask) vs. "load more" (chat history column, where a pager is unusual).

## Surface classification

`Agentic-RAG` — this app.

## Suggested routing

- **Fold into in-flight phase:** n/a (no milestone active)
- **Defer to future phase / milestone:** next milestone. The Spend ledger truncation is a
  `/gsd:quick`-sized fix and can go first; the app-wide consolidation is a phase (UI → G-2 sketch of
  the one pager, G-4 lived UAT on a list with >1 page of real rows).
- **Plant as seed:** not needed — this report is the register entry.
- **External — note only:** no

## Workarounds

Spend: filter by time range or coverage chip to bring a subset under 50 rows. No workaround for
reading the full ledger in the UI today.
