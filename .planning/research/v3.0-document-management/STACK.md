# Stack Research

**Domain:** Document-management additions to an existing RAG platform (M-Files-aligned Tier A: metadata-driven virtual folders, document relationships, auto-classification) + the metadata-enrichment add-on (configurable fields, per-field confidence, lifted extraction window, extraction-model flexibility)
**Researched:** 2026-06-15
**Confidence:** HIGH (verified against the live codebase seams + current PyPI/Postgres sources)

## Headline Decision

**This milestone needs almost no new third-party libraries.** Every net-new capability composes from things already in the stack: Postgres jsonb + the existing `documents.metadata` GIN index, Pydantic 2.12.5 (`create_model` for dynamic schema), the existing `get_llm_client(user_settings)` seam, `asyncpg`/`supabase-py` RPC for parameterized queries, and a small hand-rolled filter→SQL compiler. The one genuinely net-new component is a **constrained filter-expression AST that compiles to a parameterized Postgres WHERE clause** — and the recommendation is to **build that ourselves (≈150-250 LOC), not adopt a rule-engine library**, because the existing virtual-folder seam must push the filter *down into SQL* for scale, and no off-the-shelf JSON-logic library does that (they all evaluate in-memory over already-loaded objects).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL jsonb (existing Supabase) | PG 15+ (current) | Store custom metadata fields + per-field confidence; evaluate virtual-folder filters server-side | Already the storage for `documents.metadata`; `@>`, `->>`, `(metadata->>'k')::date`, and `jsonb_path_*` cover every Tier A filter without a new datastore. Containment `@>` already works; ranges need a typed-cast compiler (below). |
| Pydantic | 2.12.5 (already installed) | Dynamic structured-extraction model from user/admin-defined fields; per-field validation | `pydantic.create_model(...)` builds a model at runtime from a field spec; pairs with the existing `response_format` / forced-emission path. No new dep — `create_model` is first-party and stable in v2.12. |
| `asyncpg` | >=0.29 (already installed) | Parameterized execution of the compiled virtual-folder WHERE clause (or a new `match_documents_by_filter` RPC) | Already in the streaming hot paths; `$1,$2…` bind params are the injection-safe substrate for the DSL compiler. Alternatively keep it in a Postgres SQL function called via supabase-py RPC (mirrors `match_document_chunks`). |
| Hand-rolled constrained filter AST → SQL compiler | net-new, in-repo | Represent + safely evaluate `document_type = contract AND expiry_date within next 90 days` over `documents.metadata` | A closed set of operators (`eq/neq/gt/gte/lt/lte/contains/in/exists/between/within_next_days`) + boolean `and/or/not`, parsed into a small Pydantic-typed AST, compiled to `(metadata->>'field')::type OP $n`. Field names validated against the registered-fields whitelist; values always bound, never interpolated. This is the no-eval, closed-registry pattern the codebase already uses for harness validation gates. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none required for Tier A core) | — | — | Tier A ships on the four core technologies above. The sections below list libraries considered and explicitly NOT adopted. |
| `json-rule-engine` | 2.1.0 (2026-01-04, pure-Python, zero deps) | Optional: in-memory evaluation of a classification rule against one freshly-extracted doc's metadata at upload time | ONLY for auto-classification (Tier A item 3), where you evaluate one rule against one in-memory metadata dict — not for virtual-folder views (those must push down to SQL). Even here a 30-line dict matcher likely suffices; adopt the lib only if rules grow complex (nested AND/OR, custom operators). Beta status (`4 - Beta`), so treat as optional. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Numbered SQL migration | New tables (`document_views`, `document_relationships`, `metadata_field_definitions`), expression/GIN indexes, RLS policies | Per CLAUDE.md: ship as `supabase/migrations/<digits>_name.sql`, apply via SQL editor, regen `full-schema.sql`. No `db push`/`db reset`. |
| `pg_trgm` (Postgres extension, optional) | Fuzzy/`contains` matching on metadata text fields if `ILIKE '%x%'` filters become hot | Already-available Postgres extension; enable only if a `contains` operator on free-text metadata shows up as a slow path. Not needed day one. |

## Net-New Capability → Integration Point Map

| Capability | Net-new? | Integration against verified seam |
|------------|----------|-----------------------------------|
| **1. Filter DSL / saved-search engine** | Build small AST→SQL compiler (no lib) | The existing RPCs (`match_document_chunks`, `keyword_search_chunks`, `full-schema.sql:120/93`) apply `metadata_filter` as `d.metadata @> metadata_filter` — **equality/containment ONLY**. `@>` cannot express `expiry_date < now()+90d` or `> / <`. So a virtual-folder view needs a richer compiled predicate. Two options: (a) extend the RPCs with a second `p_filter_sql`/structured-jsonb param the SQL function expands, or (b) a sibling `match_documents_by_filter` RPC. Either keeps the agent-facing `search_documents(metadata_filter=…)` seam (`retrieval_service.py:248`, `tool_dispatcher.py:171`) backward-compatible — the simple-equality path stays byte-identical; the DSL is additive. |
| **2. Configurable metadata schema + per-field confidence** | Pydantic `create_model` (no new lib) + 1 new table | Replace the fixed `DocumentMetadata` (7 fields, `document.py:8`) with a runtime model built from a new `metadata_field_definitions` table (user/admin-scoped, RLS). Extraction prompt + `response_format` are generated from the field defs. Store extracted values + per-field confidence back into `documents.metadata` jsonb (e.g. `{"client_name": {"value": "...", "confidence": 0.82}}` OR a parallel `metadata_confidence` jsonb — pick one shape and version it). RLS stays clean because field-defs are a normal user/global-scoped table and values live on the already-RLS'd `documents` row. |
| **3. Extraction-model flexibility** | PLUMBING ONLY — no new deps | Confirmed: `extract_metadata` (`embedding_service.py:100`) calls `get_llm_client()` with no args → falls to `config.py:703 llm_model="gpt-4o"`. `get_llm_client(user_settings)` ALREADY accepts `UserEffectiveSettings` (`openai_service.py:970`), and `UserEffectiveSettings.llm_model` already exists (`user_settings.py:99`). Thread the caller's `user_settings` (or a new `app_settings.extraction_model`) into the one `get_llm_client()` call + pass `model=` through `extract_metadata`. The `content[:3000]` cap (`embedding_service.py:107`) lifts to a configurable window in the same change. Zero new libraries. |
| **4. Document relationships** | Table + queries only — no library | `document_relationships(id, source_doc_id, target_doc_id, rel_type, created_by, created_at)` with a closed `rel_type` CHECK enum (`supersedes/amends/references/attached_to`), RLS, and a `get_related_documents` tool registered in `tool_dispatcher.py`. No graph DB. Cycle concern is minimal (links are typed + directional, usually acyclic like supersedes-chains); if a UI traversal ever walks the graph, cap depth and use a `WITH RECURSIVE` CTE with a visited-set guard — Postgres handles this natively. |

## Filter DSL — Why Build, Not Adopt (the load-bearing decision)

The question framed it as "small safe evaluator vs library (json-logic-py, jsonlogic, constrained AST)." The deciding factor is **where evaluation happens**:

- A virtual folder like "all contracts expiring in 90 days" must be evaluated **inside Postgres** so it scales (filter + the existing `documents_metadata_gin_idx` + a date expression index do the work; only matching rows return). 
- Every JSON-logic / rule-engine library found (`json-logic-py` — **unmaintained, no release in 12+ months**; `json-rule-engine` 2.1.0; `py-rules-engine`; `rule-evaluator`) evaluates **in-memory in Python over objects you already loaded**. Using one for views would mean `SELECT * FROM documents` then filter in Python — non-performant and an RLS/scope footgun.
- Therefore the view filter is best represented as a **small typed AST** (a Pydantic discriminated union: `Comparison | Logical | DateWindow`) that **compiles to a parameterized SQL predicate**. This is ~150-250 LOC, mirrors the existing closed-registry no-eval pattern used by harness validation gates, and is fully injection-safe because: (1) field names are validated against the `metadata_field_definitions` whitelist before any SQL is built, (2) operators come from a fixed dispatch dict, (3) all literals are bound params (`$n`), never string-interpolated.

**Injection + perf safety checklist for the compiler:**
- Field identifiers → validate against registered field names; reject anything not in the whitelist (prevents `metadata->>'x''; DROP…'`).
- Operators → fixed Python dict `{"eq": "=", "gte": ">=", …}`; no operator string ever comes from user input.
- Values → always `asyncpg` `$n` bind params (or PostgREST RPC structured-jsonb param), never f-stringed into SQL.
- Types → cast at the SQL boundary: `(metadata->>'expiry_date')::date`, `(metadata->>'amount')::numeric`. Guard cast failures (`NULLIF` / safe-cast helper) so one malformed value doesn't error the whole view.
- Perf → add a **B-tree expression index per hot date/number field**, e.g. `CREATE INDEX ON documents ((metadata->>'expiry_date')::date);` (the GIN index already covers equality/containment; expression indexes cover ranges). Promote a field to a typed expression index only when it's a hot filter — don't pre-index everything.

## Installation

```bash
# Backend — ONE optional addition, only if auto-classification rules outgrow a hand dict matcher:
pip install json-rule-engine==2.1.0   # pure-Python, zero deps; OPTIONAL, Tier A item 3 only

# Everything else is ALREADY installed:
#   pydantic 2.12.5  (create_model for dynamic extraction schema)
#   asyncpg >=0.29   (parameterized DSL execution)
#   supabase >=2.29  (RPC path for filter SQL function)
# No frontend package additions required for the data layer (views/relationships UI uses existing shadcn components).
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled AST→SQL compiler for views | `json-rule-engine` 2.1.0 | Never for views (in-memory only, no SQL push-down). Reasonable for the single-doc auto-classification rule eval if rules get nested/complex. |
| Hand-rolled AST→SQL compiler | `json-logic-py` | Never — **unmaintained** (no PyPI release in 12+ months per Snyk advisor); also in-memory only. |
| `pydantic.create_model` (first-party) | `dydantic` / `dyntamic` (3rd-party JSON-schema→Pydantic) | Only if you accept a full external JSON Schema as the field-definition format AND need its edge-case coverage. For a curated field-def table (name, type, description, required), first-party `create_model` is simpler and dependency-free. |
| `asyncpg` parameterized query OR Postgres SQL function (RPC) | SQLAlchemy Core query builder | Only if the team wants an ORM-style builder — but the codebase has NO SQLAlchemy (supabase-py + asyncpg only); adding it for this is unjustified surface. |
| Postgres jsonb + expression indexes | Promote hot fields to real typed columns | If a metadata field becomes a constantly-filtered hot path at large scale, promote it to a generated/typed column (Postgres best-practice 2025). Defer until a field proves hot. |
| Table + `WITH RECURSIVE` for relationships | Graph DB (Neo4j, AGE) | Never for Tier A. Typed directional links over hundreds–thousands of docs are trivially a relational table; a graph DB is massive operational surface for zero benefit here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `json-logic-py` | Unmaintained (no release 12+ months); in-memory only, can't push filters to SQL → wouldn't scale virtual folders | Hand-rolled constrained AST→SQL compiler |
| A general rules engine (`py-rules-engine`, Drools-style) for views | Massive over-engineering for `eq/range/and/or` over one jsonb column; introduces eval-surface + a config language users don't need | Closed-operator AST + parameterized SQL |
| LangChain / LangGraph for any extraction or classification step | Banned by project rules; the dynamic-schema extraction is one `create_model` + one `chat.completions.create` with `response_format` — raw SDK already does this | Existing `get_llm_client` + Pydantic `create_model` |
| Any graph database (Neo4j, Postgres AGE, etc.) for document relationships | Operational + cognitive overhead for what is a single typed-link table; cycles are guardable with a recursive-CTE visited set | `document_relationships` table + `WITH RECURSIVE` when traversal is needed |
| New full-text/search engine (Elasticsearch, Meilisearch, etc.) | The hybrid retrieval + jsonb metadata path already exists; views *compose* it, they don't replace it | Existing `search_documents` + the additive filter SQL |
| String-interpolated SQL for the filter (f-strings / `.format`) | Direct SQL-injection vector on user-authored view filters | Bound params (`$n` / RPC structured-jsonb param) + field-name whitelist + fixed operator dict |
| A second datastore for "saved searches" | Views are just rows: `document_views(name, filter_ast jsonb, folder_scope_ids, owner)` in Postgres with RLS | New Postgres table, RLS-scoped like every other table |

## Stack Patterns by Variant

**If virtual-folder filters stay equality-only (e.g. `document_type = contract`):**
- The existing `@>` containment path in `match_document_chunks` / `keyword_search_chunks` already handles it — no compiler needed for those.
- Because: the seam at `retrieval_service.py:248` + `tool_dispatcher.py:171` already passes `metadata_filter` straight through.

**If filters need ranges/dates/booleans (`expiry_date within 90 days`, `amount > 10000`):**
- Add the AST→SQL compiler + a `match_documents_by_filter` RPC (or extend the existing RPCs with a structured filter param) + per-hot-field expression indexes.
- Because: `@>` is containment-only; ranges require typed casts at the SQL boundary that containment can't express.

**If auto-classification rules stay simple (`if document_type==invoice and vendor present → suggest folder X`):**
- Hand-rolled dict matcher over the freshly-extracted metadata; no library.
- Because: it's one rule against one in-memory dict at upload time — a library is overkill.

**If auto-classification rules grow (nested AND/OR, many operators, user-authored):**
- Reuse the SAME AST the views use, evaluated in-memory against the metadata dict (or adopt `json-rule-engine` 2.1.0).
- Because: one filter grammar for both views and classification keeps the surface small and consistent.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| pydantic 2.12.5 | `create_model`, `response_format` forced-emission path | First-party `create_model` stable in v2.12; no upgrade needed. |
| asyncpg >=0.29 | PostgreSQL 15+ (Supabase) | Already in streaming hot paths; `$n` bind params are the injection-safe substrate. |
| supabase >=2.29 | PostgREST RPC for new SQL functions | The `match_document_chunks`-style RPC pattern is the established, RLS-respecting call path. |
| json-rule-engine 2.1.0 (OPTIONAL) | Python 3.x, zero core deps | `4 - Beta` status; adopt only if needed, isolated to the classification path. |

## Sources

- Live codebase (HIGH): `backend/app/services/retrieval_service.py:248`, `backend/app/services/tool_dispatcher.py:171`, `backend/app/services/embedding_service.py:100-137`, `backend/app/models/document.py:8`, `backend/app/config.py:703`, `backend/app/services/openai_service.py:970`, `backend/app/models/user_settings.py:99`, `supabase/full-schema.sql:93/120/132 (@> containment) + :1226 (documents_metadata_gin_idx)` — confirmed `metadata_filter` is equality-only via `@>`, `get_llm_client(user_settings)` + `UserEffectiveSettings.llm_model` already exist, GIN index already present, no SQLAlchemy in `requirements.txt` (supabase-py + asyncpg).
- PyPI / Snyk (HIGH–MEDIUM): json-logic-py unmaintained (no release 12+ months, Snyk advisor); `json-rule-engine` 2.1.0 released 2026-01-04, pure-Python, zero core deps, no `between` in core but custom operators registerable (verified via pypi.org project page).
- Pydantic (HIGH): installed 2.12.5; `create_model` is the first-party runtime-model path (pydantic docs + v2.11/2.12 release notes).
- PostgreSQL jsonb indexing best practices 2025-2026 (MEDIUM, multiple sources agree): broad GIN for containment + targeted B-tree *expression* indexes (often partial) for range/date hot paths; promote constantly-filtered keys to typed columns; `->>` + `cast()` + parameterized `text()`/bind-params is the injection-safe date-range pattern (oneuptime 2026-01, sitepoint, elysiate, SQLAlchemy discussion #7991).

---
*Stack research for: v3.0 Document Management (SEED-005 Tier A + metadata-enrichment add-on)*
*Researched: 2026-06-15*
