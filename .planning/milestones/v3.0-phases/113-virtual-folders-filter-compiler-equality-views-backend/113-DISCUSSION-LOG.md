# Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 113-virtual-folders-filter-compiler-equality-views-backend
**Areas discussed:** What a view returns, Sharing views (v1 scope), Filter format (future-proof?), Edge & matching rules

---

## What a view returns

| Option | Description | Selected |
|--------|-------------|----------|
| Complete listing | All matching latest-version docs, `DocumentResponse` shape, newest-first, with a total count (feels like a real folder); reuse the `@>` + folder-subtree predicate over a plain `documents` listing, NOT the vector RPC | ✓ |
| Ranked search results | Resolve via the `search_documents` vector RPC (ranked, similarity-capped top-K, needs a query string) | |

**User's choice:** Complete, newest-first, counted listing.
**Notes:** Newest-first is fine for v1; custom/per-field sort options deferred to the Phase 114 builder. Confirmed the roadmap's "search_documents seam" means reuse the metadata-filter + folder-scope *predicate*, not the semantic-search tool (a virtual folder has no query). → D-113-1, D-113-2.

---

## Sharing views (v1 scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Admin/seed-only globals | No user "share my view" path; global views are service-role/migration-seeded only (like global folders/skills); the migration-071 RLS already forces `is_global=false` on end-user writes; leak-safety = seeded global views resolve over each viewer's own set | ✓ |
| Build a user share path now | Add a user-facing "share my view" flow + the RLS changes to allow user-created global views | |

**User's choice:** Admin/seed-only globals confirmed.
**Notes:** Resolution is always over the *caller's* visible set (never the owner's); two users see different result sets for the same global view; cross-user/unauthorized id → 404-not-403; verified live in secure-phase. Unreachable `folder_scope` on a global view → **silently ignored** (resolve over the caller's visible set) rather than error/empty. → D-113-3, D-113-4, D-113-5.

---

## Filter format (future-proof now?)

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-compatible AST now, minimal impl | Store explicit condition-list AST `{op:"and", conditions:[{field,op,value}]}`; implement only `eq`+`and` in 113; 114 operators register additively (zero shape change, zero data migration) | ✓ |
| Minimal equality map now | Bare `{field: value}` map; rewrite the compiler + data-migrate live view rows in 114 | |

**User's choice:** "I need you to recommend." → Took the forward-compatible-AST recommendation.
**Notes:** Flat AND-of-conditions; **no nested OR/NOT** (114's `one_of` covers the OR case — nesting is complexity for no stated requirement). → D-113-6, D-113-7.

---

## Edge & matching rules

| Option | Description | Selected |
|--------|-------------|----------|
| Empty filter = no narrowing (valid) | Empty `conditions` → all docs in `folder_scope` / all visible docs; not rejected | ✓ |
| Unknown field: reject@save, tolerate@resolve | Save validates field against the live whitelist (reject unknown); a since-deleted field matches zero docs at resolve (non-fatal) | ✓ |
| Case-sensitive exact equality (v1) | `metadata @>` exact match ("Invoice" ≠ "invoice"); case/normalization → 114 typed columns (lowercasing JSONB now = the seq-scan anti-pattern 114 forbids) | ✓ |

**User's choice:** "I need you to recommend." → Took all three recommendations.
**Notes:** Optional forward hook — a `stale_fields`/`warnings` note in the resolve response for Phase 119 governance + the 114 builder. → D-113-9, D-113-10, D-113-11.

## Claude's Discretion

- Exact route paths/verbs; resolve as a dedicated endpoint vs. a query param.
- Whether the compiler emits a `metadata_filter` jsonb (rides `@>`) vs. a `metadata @> $1::jsonb` WHERE fragment (both parameterized).
- Pydantic model layout for the AST + the operator-registry mechanism (harness `@register_validator` pattern encouraged).
- Whether to ship the optional `stale_fields` resolve-warning in 113 or defer to 119.

## Deferred Ideas

- Range/date/relative-date + `one_of`/`contains`/`is_empty`, builder UI, sidebar render, typed indexed columns + `EXPLAIN`, case normalization, custom sort → Phase 114.
- Agent-tool resolution of a view (+ SC#10 4-axis cross-provider UAT) → Phase 115.
- User-created shared/global views ("share my view") → out of v3.0 scope as specced; re-open if product wants peer-to-peer sharing (RLS + share-flow change).
- Stale-field governance signal → Phase 119.
- Reviewed todo (not folded): `spike-nl-workflow-authoring.md` (score 0.2, "template" keyword only — unrelated).
