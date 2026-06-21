# Phase 115: Virtual Folders — Agent Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 115-virtual-folders-agent-tool
**Areas discussed:** Tool surface & modes, View/field discoverability, Result shape for chat, Boundary vs existing tools

---

## Tool surface & modes

| Option | Description | Selected |
|--------|-------------|----------|
| One tool, both modes | Single tool accepts a saved view by name OR an inline metadata filter (113/114 AST); minimal toolbox growth, one resolve path; polymorphic arg slightly harder for weak models | ✓ |
| Two separate tools | run_saved_view(name) + filter_documents(conditions); clearer intent, simpler args, but +2 toolbox slots (Google/MiniMax max_tools cost) | |
| Saved views only | Tool only runs saved views by name; ad-hoc filtering stays with search_documents' metadata_filter; narrowest, no redundancy | |

**User's choice:** One tool, both modes (Recommended)
**Notes:** → D-115-1. Researcher/planner must design the view-name-XOR-filter discriminator so weak models (MiniMax/Google) can fill it reliably — ties to the open `minimax-m3-invalid-tool-args-400` report.

---

## View/field discoverability

| Option | Description | Selected |
|--------|-------------|----------|
| Self-listing catalog mode | Blank/unknown call returns the caller's saved views (name+desc+count) + filterable fields; model re-calls with a concrete choice; no prompt bloat, no shared-path touch, robust cross-provider | ✓ |
| Inject into system prompt | List view names + fields in the system prompt every turn; always visible but adds tokens + needs a prompt-assembly seam (touches shared chat path) | |
| Static schema + names by-name | Field names/types in the JSON schema; unknown view name returns a "here are yours" error; leanest but discovery is reactive (via error) | |

**User's choice:** Self-listing catalog mode (Recommended)
**Notes:** → D-115-2. Catalog is a MODE of the one tool (not a second tool). Field list reuses the same whitelist source the 113 compiler validates against — no drift.

---

## Result shape for chat

| Option | Description | Selected |
|--------|-------------|----------|
| Newest-N + total count | Up to N (~20, capped) newest rows (filename, doc_id, key metadata) + true total + truncation note; doc_id enables read/cite; N as optional arg | ✓ |
| Count + filenames only | Just total + filenames; leanest, but usually forces a second tool call to answer | |
| Full listing, every row | Every matching row (faithful to D-113-1) but blows context on large views, risky cross-provider | |

**User's choice:** Newest-N + total count (Recommended)
**Notes:** → D-115-3 / D-115-4. Reuses the 114 additive count-only resolve for the total; source_refs for citable answers.

---

## Boundary vs existing tools

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct exhaustive-listing lane | Name+describe as "list ALL docs matching a saved view or exact metadata criteria — complete, deterministic, no ranking, no query string"; explicitly contrasts search_documents / query_documents | ✓ |
| Plain description, model decides | Generic description; trust the model to disambiguate from search_documents' metadata_filter; higher overlap/confusion risk | |
| You decide | Planner/researcher chooses positioning + naming per cross-provider tool-selection research | |

**User's choice:** Distinct exhaustive-listing lane (Recommended)
**Notes:** → D-115-5. Additive — search_documents' metadata_filter arg stays (shared path untouched, no regression).

---

## Claude's Discretion

- Exact tool name (working: `query_documents_by_view`) + JSON-schema arg shape (D-115-12).
- N default + hard cap; which key metadata fields ride each compact row; catalog-mode trigger (empty args vs explicit `list_views:true`).
- Catalog per-view counts eager vs lazy/omitted at scale (mirror D-114-8).
- `source_refs` vs richer citation objects (D-115-4).
- Audit reuse `search.query` tagged `via:"view"` — no new audit action, no migration (D-115-10/11). Operator offered the chance to object; accepted as "ready for context."

## Deferred Ideas

- First-class `view.run` audit action → Phase 119 governance (re-open via additive migration).
- Nested OR/NOT boolean trees + grouping → out per 113/114.
- User-created shared/global views ("share my view") → out of v3.0.
- Fixing `minimax-m3-invalid-tool-args-400` → pre-existing MiniMax issue, left open; SC#10 MiniMax UAT row is the observation point.
- Reviewed-not-folded todo: `spike-nl-workflow-authoring.md` (score 0.6, keyword-only match) — unrelated to the agent tool.
