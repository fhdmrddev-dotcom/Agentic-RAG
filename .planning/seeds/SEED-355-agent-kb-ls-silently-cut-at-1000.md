---
seed_id: SEED-355
title: "The agent's KB browse (kb_ls / kb_tree / kb_grep / kb_glob) reads a folder's documents unranged — silently cut at 1,000"
created: 2026-10-16
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase that edits backend/app/api/kb.py or an agent kb tool handler (backend/app/services/tools/documents.py _handle_kb_*); OR an operator report that an agent listed, searched or globbed a large folder and missed documents; OR any phase that pages an agent tool's output (it owes the cross-provider UAT scoreboard anyway)."
trigger_paths: ["backend/app/api/kb.py", "backend/app/services/tools/kb*.py", "backend/app/services/tools/documents.py"]
trigger_surfaces: ["library", "retrieval"]
migration_note:
relates_to: ["Phase 284 (FIX-11, D-23 layer 1 — backend/tests/unit/test_284_route_inventory.py ALLOW_LIST)", "284-RESEARCH.md §Route Inventory", "SEED-356 (the governance edge read, same class)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-355: The agent's KB browse reads a folder's documents unranged

## The finding

`backend/app/api/kb.py` `ls_path` (`:58-112`) lists a folder's documents with
`supabase.table("documents").select("id, filename, status, created_at").eq("folder_id", …)` and **no
`.range()` / `.limit()`** — one read for the caller's own documents and one for a globally-visible
folder's. PostgREST's `max_rows` (1,000 locally; production not yet read, 284 R-09) cuts each read
silently, so **an agent running `kb_ls` on a 10,000-document folder sees 1,000 and is not told**.
`tree_path` (`:116`), `grep_path` (`:256`) and `glob_path` (`:337`) read the same way. The agent
tools call these cores in-process with the SERVICE ROLE (`app/services/tools/documents.py:161-191`),
so migration 207's `library_documents` view cannot simply be swapped in — it reads 0 rows to the
service role (R-02).

Phase 284 left them deliberately: `GET /kb/*` has no frontend caller, and changing an agent tool's
output owes the 8-row cross-provider UAT scoreboard, which is not FIX-11's scope. They are
allow-listed in `test_284_route_inventory.py` with this seed as the reason, so the fence names them
and a new unbounded route still fails.

## Why it matters

An agent asked "what is in the Contracts folder?" answers from the first 1,000 rows of an unordered
read, and its listing looks complete. Nobody pays until a folder crosses 1,000 documents — the
synthetic 284 scale account has one at 10,000, so the condition is easy to reach.

## When to surface

When any phase edits `backend/app/api/kb.py` or an agent kb tool handler; when an operator reports a
truncated kb listing; or when a phase pages any agent tool's output.

## Scope estimate

Medium: each core needs a stated order + `.range()` (or a `count="exact"` total and a "showing N of
M" note in the tool result), done on the service-role two-leg path like `resolve_filter(via_view=False)`
in 284-04, plus the cross-provider UAT rows for the four kb tools.

## Breadcrumbs

- `backend/app/api/kb.py:58-112` (`ls_path`), `:116` (`tree_path`), `:256` (`grep_path`), `:337` (`glob_path`)
- `backend/tests/unit/test_284_route_inventory.py` — `ALLOW_LIST[("GET", "/kb/ls")]` and siblings
- 284-RESEARCH.md §Route Inventory, row `GET /kb/ls …`; 284-MEASUREMENTS.md (the 1,000 cut, measured)
