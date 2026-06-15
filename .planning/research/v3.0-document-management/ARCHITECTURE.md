# Architecture Research — v3.0 Document Management (Tier A integration)

**Domain:** Integrating M-Files-aligned Tier A DM features into the existing Agentic RAG platform
**Researched:** 2026-06-15
**Confidence:** HIGH (every integration point cited from live source by file:line; no external-source guessing — this is an internal-architecture integration study, not an ecosystem survey)

> Scope note: this document answers ONLY "how do the Tier A features bolt onto what already exists?" It does not redesign retrieval, ingestion, or RLS — it composes with them. New-vs-modified is called out explicitly for every seam. Tier B (retention / check-in-out / approvals) is OUT.

---

## Standard Architecture — the seams we compose with (verified)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND (React/Vite)                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Folder tree│  │ Document      │  │ Chat + agent │  │ Knowledge  │  │
│  │ (sidebar)  │  │ detail        │  │ (SSE)        │  │ Health     │  │
│  │ + VIEWS*   │  │ + RELATIONS*  │  │              │  │ + GOV-HLTH*│  │
│  └─────┬──────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
├────────┼────────────────┼─────────────────┼────────────────┼─────────┤
│  FASTAPI                                                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │ documents.py │  │ NEW: views.py / │  │ tool_dispatcher.py       │ │
│  │ _upload_     │  │ relationships.py│  │ _TOOL_REGISTRY (registry)│ │
│  │ pipeline ►   │  │ classification  │  │ + NEW get_related_docs   │ │
│  │ ingest_doc   │  │ _rules.py       │  │                          │ │
│  └──────┬───────┘  └────────┬────────┘  └────────────┬─────────────┘ │
│         │                   │                         │               │
│  ┌──────▼─────────┐  ┌──────▼────────┐  ┌─────────────▼────────────┐ │
│  │ embedding_svc  │  │ retrieval_svc │  │ audit_service            │ │
│  │ extract_       │  │ search_       │  │ VALID_ACTION_TYPES ◄ SYNC│ │
│  │ metadata       │  │ documents     │  │ w/ closed CHECK enum     │ │
│  └────────────────┘  └───────┬───────┘  └──────────────────────────┘ │
├──────────────────────────────┼─────────────────────────────────────-─┤
│  SUPABASE (Postgres + pgvector + RLS)                                  │
│  documents.metadata jsonb │ folders (adjacency) │ audit_log (closed)   │
│  document_chunks │ document_tables │ document_images                   │
│  SECURITY DEFINER RPCs: match_document_chunks / keyword_search_chunks  │
│  helper: folder_is_globally_visible()                                  │
│  NEW: document_views │ document_relationships │ classification_rules   │
│       │ metadata_field_definitions                                     │
└──────────────────────────────────────────────────────────────────────┘
*  = new surface added by this milestone
```

### Component Responsibilities (existing — confirmed by source)

| Component | What it owns | File:line evidence |
|-----------|--------------|--------------------|
| `search_documents` | Hybrid retrieval; already accepts `metadata_filter: dict` (lowercase-normalized) + `folder_ids: list[str]` | `backend/app/services/retrieval_service.py:248-258` |
| `match_document_chunks` / `keyword_search_chunks` | `SECURITY DEFINER` RPCs; filter `dc.user_id = match_user_id` AND `d.metadata @> metadata_filter` AND `d.folder_id = ANY(p_folder_ids)` | `supabase/full-schema.sql:93-113, 120-137` |
| `_handle_search_documents` | Agent-facing seam; passes `metadata_filter` + `folder_subtree_ids`; post-query ⊆ scope clip (098 GOV-01) | `backend/app/services/tool_dispatcher.py:173-245` |
| `_TOOL_REGISTRY` / `dispatch_tool` | Registry-pattern tool dispatch; new tool = handler + one dict line (G-5 contract) | `tool_dispatcher.py:2353-2382, 2417-2439` |
| `_upload_pipeline` → `ingest_document` | BackgroundTask: extract → `extract_metadata` → chunk → embed → persist `documents.metadata` jsonb | `documents.py:136-245, 1334-1482` |
| `extract_metadata` | LLM structured extraction; **hardwired to `settings.llm_model`, reads `content[:3000]`** | `embedding_service.py:100-137` |
| `audit_log` + `write_audit_entry` | INSERT-only audit; **CLOSED CHECK enum** kept in sync with `VALID_ACTION_TYPES` frozenset | `full-schema.sql:333`, `audit_service.py:13-19` |
| `folder_is_globally_visible()` | Recursive ancestor walk for global-folder RLS | `full-schema.sql:54-70` |

---

## ⚠️ The load-bearing RLS finding (read this first)

**The two retrieval RPCs do NOT honor global-folder visibility — they scope strictly to `dc.user_id = match_user_id`.** `match_document_chunks` (`full-schema.sql:129`) and `keyword_search_chunks` (`full-schema.sql:105`) both `JOIN documents` and filter only on the caller's own `user_id`. The *table* RLS policy (`documents.py` SELECT policy, `full-schema.sql:2138`) is broader — it grants read on `auth.uid() = user_id OR folder_is_globally_visible(folder_id)` — but the `SECURITY DEFINER` RPCs bypass RLS entirely and re-implement a NARROWER user-only filter in SQL.

This is the exact class the question flags. It has two consequences for v3.0:

1. **A globally-shared View over per-user documents is the inverse risk**: a `document_views` row marked `is_global = true` that composes a `metadata_filter` must NOT, when one user opens it, surface another user's private documents. Because the View ultimately resolves through `search_documents` → these RPCs (user-scoped), **the existing RPC user-scope is actually the safety net**, not the hole. The leakage risk appears the moment a View is executed via a *direct table query* (e.g. a SQL pre-filter that bypasses the RPC) — that path hits the broad SELECT RLS policy and could pull global-folder docs the View author didn't intend, or (worse, if written with the service-role key) ALL users' docs.

2. **Relationships have the same SECURITY DEFINER trap**: a `get_related_documents` tool that joins `document_relationships → documents` must enforce the same `user_id`-or-`folder_is_globally_visible` predicate the SELECT policy uses. If implemented as a `SECURITY DEFINER` RPC for performance, it must re-state the visibility predicate explicitly (copy the `full-schema.sql:2138` logic), because DEFINER bypasses RLS.

**Discipline for all new DM RPCs/queries (the rule):** every new read path either (a) runs as the caller via the anon/authenticated key so table RLS applies, OR (b) is `SECURITY DEFINER` and re-implements the visibility predicate `(d.user_id = p_caller OR (d.folder_id IS NOT NULL AND folder_is_globally_visible(d.folder_id)))` verbatim. Never trust "it's behind a function" — `match_document_chunks` proves the function can be narrower OR broader than the policy.

---

## Per-feature integration

### 1. Virtual folders / saved views

**New table:** `document_views`

```sql
CREATE TABLE public.document_views (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name          text NOT NULL,
    filter_expr   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- composes search_documents metadata_filter
    folder_scope  uuid REFERENCES public.folders(id) ON DELETE SET NULL,  -- optional subtree anchor
    is_global     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;
```

- **Integration point (execution):** a View resolves to a `search_documents(query, user_id, supabase, metadata_filter=filter_expr, folder_ids=<subtree of folder_scope>)` call (`retrieval_service.py:248`). The `metadata_filter` seam already exists and is lowercase-normalized at `retrieval_service.py:257-258`; `filter_expr` should store keys lowercase to match. **No retrieval code changes needed for the metadata-equality case** — it's pure composition.
- **Pre-filter vs post-filter:** the RPC predicate `d.metadata @> metadata_filter` (`full-schema.sql:108, 132`) is a **JSONB containment pre-filter executed in SQL** — this is the right place for equality matches (`document_type = 'invoice'`). It is `@>` containment only: it does NOT support range/comparison (`expiry_date < now()+90d`) or existence-of-key. **For "contracts expiring in 90 days" you need a richer evaluator.** Recommendation: ship V1 as containment-only (equality on `document_type`, `language`, custom string fields) composing the existing seam with zero RPC change; defer range/date predicates to a follow-on that either (a) adds a `match_documents_advanced` SECURITY DEFINER RPC with the visibility predicate baked in, or (b) does a metadata-list query against `documents` directly under RLS then feeds the surviving doc_ids as a `folder_ids`-style filter. Do NOT post-filter range predicates in Python over an unbounded result set — it breaks `top_k`.
- **Sidebar render (frontend, modified):** Views render in the existing folder tree as a sibling group ("Views" / virtual-folder section) below real folders. Clicking a View issues a search instead of a folder listing. The folder tree component already distinguishes global vs per-user folders visually (v1.0 Phase 8) — reuse that affordance for `is_global` Views.
- **RLS design:** mirror the `skills` / `workflow_definitions` precedent exactly. SELECT: `auth.uid() = user_id OR is_global = true` (cf. `full-schema.sql:2110, 2117`). INSERT/UPDATE/DELETE: `auth.uid() = user_id`. Global INSERT must be blocked for non-admin (cf. `workflow_definitions` INSERT policy `full-schema.sql:1961` — `is_global = false` forced). **The View row being global does NOT make its *results* global** — results are still resolved per-caller through the user-scoped RPCs, so a global View is just a shared *query*, evaluated against each viewer's own visible documents. This is the correct M-Files semantic and is leak-safe by construction *as long as execution stays on the RPC path* (see the RLS finding above).
- **New vs modified:** NEW `document_views` table + `views.py` route + frontend Views section. MODIFIED: none in retrieval for the equality case.

### 2. Document relationships

**New table:** `document_relationships`

```sql
CREATE TABLE public.document_relationships (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    rel_type      text NOT NULL,   -- CLOSED CHECK enum: supersedes/amends/references/attached_to
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_rel CHECK (source_doc_id <> target_doc_id),
    CONSTRAINT rel_type_check CHECK (rel_type = ANY (ARRAY['supersedes','amends','references','attached_to']))
);
ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;
```

- **Versioning gotcha (load-bearing):** `documents` is version-aware — `version_number` / `is_latest`, and `restore_document_version` flips `is_latest` across siblings (`documents.py:613-653`). Relationships should reference the **document identity**, not a frozen version row, or a restore/new-version will orphan the link. Decision needed at scope-time: either (a) `source_doc_id` points at whatever row is `is_latest` and the tool always resolves through latest (simplest, matches `resolve_document_id` which already filters `is_latest = true` at `retrieval_service.py:187`), or (b) introduce a stable doc-family key. **Recommend (a)** for Tier A — least surface, consistent with existing latest-only resolution. Flag the `ON DELETE CASCADE`: deleting a doc silently drops its links (acceptable; audit it).
- **Agent tool (NEW, registry seam):** `get_related_documents` — handler `_handle_get_related_documents(args, ctx)` returning `ToolResult`, registered with one line in `_TOOL_REGISTRY` (`tool_dispatcher.py:2353`). The G-5 contract (`tool_dispatcher.py:8-12`) means `threads.py` is untouched. Tool must read `ctx.current_user["id"]` for scope and respect `ctx.phase_whitelist` automatically (the `dispatch_tool` guard at `:2424` handles whitelist refusal for free).
- **RLS + the SECURITY DEFINER trap:** SELECT policy: `auth.uid() = user_id`. But the *tool* joins `document_relationships → documents` to return filenames/metadata of the related docs — that read must enforce document visibility (own OR global-folder), not just relationship ownership. If the tool reads via the authenticated client, table RLS on `documents` (`full-schema.sql:2138`) applies for free. If it uses a DEFINER RPC for the join, re-state the `folder_is_globally_visible` predicate (see RLS finding).
- **Relationship panel (frontend, NEW):** on the existing document-detail surface; lists outgoing/incoming typed links with the related filename + type chip. Reuses document-detail real estate already present.
- **New vs modified:** NEW table + `_handle_get_related_documents` + `relationships.py` route (create/delete links) + detail panel. MODIFIED: `_TOOL_REGISTRY` (+1 line), `get_tools` schema list (the tool must be advertised — see Pitfall: the 101 `render_template` schema-visibility bug), audit enum (below).

### 3. Auto-classification on upload

**New table:** `classification_rules`

```sql
CREATE TABLE public.classification_rules (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         text NOT NULL,
    match_expr   jsonb NOT NULL,   -- e.g. {"document_type":"invoice","metadata.vendor":{"exists":true}}
    suggest_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
    is_global    boolean NOT NULL DEFAULT false,
    enabled      boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
```

- **Integration point (rule-eval step):** insert a classification pass in `ingest_document` **immediately after** `metadata_dict` is built and case-normalized (`documents.py:1369-1375`) and **before** the final persist write (`documents.py:1467-1482`). The rule evaluator matches `metadata_dict` against enabled `classification_rules.match_expr` and writes a *suggestion* (NOT an auto-move) onto the doc — e.g. `metadata_dict["_classification"] = {"suggested_folder_id": ..., "rule_id": ..., "confidence": ...}` so it persists in the same `metadata` jsonb write at `:1478`. **Suggest, don't auto-route** — Tier A scope is "routing suggestions," and auto-moving on a confidence guess is the kind of surprise that erodes trust.
- **Why this MUST come after enrichment (the dependency):** classification `match_expr` reads `document_type`, `vendor`, custom fields out of `metadata_dict`. With today's hardwired `gpt-4o` + 3,000-char window (`embedding_service.py:107, 114`) and the fixed 7-field model (`models/document.py`), the metadata is too thin for useful rules. **Enrichment (richer fields + better model + bigger window) is a hard prerequisite — classification quality is bounded by metadata richness.** This is the build-order driver.
- **UI (NEW):** a rules authoring surface (likely in the ingestion/library settings area) + a "suggested folder" accept/dismiss affordance on the document row or detail. Accepting an applied suggestion is the `classification.apply` audit action.
- **RLS:** same own-or-global pattern as Views. Background-task caveat: `_upload_pipeline`/`ingest_document` run with whatever client they were handed (service path, not request-scoped `auth.uid()`), so rule-matching reads must be **explicitly user-scoped in app code** (`.eq("user_id", user_id)` + global), the same way the rest of `ingest_document` is — there is no `auth.uid()` inside a BackgroundTask.
- **New vs modified:** NEW table + rule-eval helper + authoring UI + accept/dismiss UI. MODIFIED: `ingest_document` (one eval call between `:1375` and `:1467`).

### 4. Configurable metadata + per-field confidence (the enrichment foundation)

**New table:** `metadata_field_definitions`

```sql
CREATE TABLE public.metadata_field_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = global/admin field
    field_key   text NOT NULL,            -- lowercase, e.g. "vendor", "matter_number"
    field_type  text NOT NULL DEFAULT 'string',  -- string/date/number/enum
    description  text,                      -- fed to the extraction prompt
    is_global   boolean NOT NULL DEFAULT false,
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metadata_field_definitions ENABLE ROW LEVEL SECURITY;
```

- **Dynamic structured extraction (modified `extract_metadata`):** today the field set is a fixed `DocumentMetadata` Pydantic model (`models/document.py:8-16`) and the function ignores `user_settings` so it always falls to `settings.llm_model` (`embedding_service.py:114`). Three coordinated changes:
  1. **Un-pin the model** — thread the user's selected provider/model (or an admin "extraction model" setting) into the `get_llm_client()` call. The function already takes a `model: str | None` param (`embedding_service.py:100, 114`) but the caller `ingest_document` passes nothing (`documents.py:1368`). Wire the effective model through `_upload_pipeline` → `ingest_document` → `extract_metadata(text, model=...)`. Settings live in `user_settings`/`app_settings` per CLAUDE.md — add an `extraction_model` knob there, not an env var (minimal SEED-012 slice).
  2. **Lift the 3,000-char window** (`embedding_service.py:107`) — make it a setting; consider a front-matter + tail sample for long docs (title pages land past 3k).
  3. **Dynamic schema** — build the Pydantic model (or the `json_object` prompt + validation) at runtime from enabled `metadata_field_definitions`, replacing the static `DocumentMetadata`. Use Pydantic structured outputs per the no-LangChain / Pydantic rule.
- **Per-field confidence storage:** store confidence INSIDE the existing `documents.metadata` jsonb (no new column) — e.g. `{"vendor": "Acme", "_confidence": {"vendor": 0.91, "title": 0.6}}`. Persisted by the existing write at `documents.py:1478`. **Watch the `exclude_none=True` interaction** (`documents.py:1369`): the confidence sub-dict must not be dropped when sibling fields are null — keep `_confidence` as a populated dict, never `None`. This `exclude_none` behavior is also why "missing author" is correctly omitted (SEED-005 update, `:1369`) — preserve it; it is intended, not a bug.
- **`@>` containment compatibility:** the metadata-filter pre-filter is JSONB `@>` containment (`full-schema.sql:132`). Nesting confidence under a `_confidence` key keeps the top-level fields flat so `metadata @> {"vendor":"acme"}` still matches — do NOT restructure metadata into `{value, confidence}` tuples per field or you break the existing View/filter seam.
- **RLS:** own-or-global on `metadata_field_definitions`. Extraction runs in a BackgroundTask → read enabled definitions explicitly by `user_id` + global in app code (no `auth.uid()` in background context, same caveat as classification).
- **New vs modified:** NEW table + dynamic-schema builder + extraction-model setting + field-authoring UI. MODIFIED: `extract_metadata` (model + window + dynamic schema), `ingest_document` (pass effective model + persist confidence), `models/document.py` (static model → dynamic).

### 5. Governance health view (light SEED-046)

- **Distinct from the existing Knowledge Health Dashboard** (v2.3 F-09: most-retrieved / never-retrieved / low-confidence-retrieval / stale). SEED-005 explicitly calls these out as *separate dashboards, not extensions* (SEED-005 line 152). The existing one is about *retrieval* health; this new one is about *governance/DM* health.
- **New signals (all derivable from the new tables + existing metadata):**
  - **Broken relationships** — `document_relationships` rows whose `source_doc_id`/`target_doc_id` no longer resolve to a live doc (or no longer `is_latest`).
  - **Unclassified documents** — docs whose `metadata` matched no `classification_rules` (or have no `document_type`).
  - **Low-confidence metadata** — docs where `metadata._confidence.<field>` falls below a threshold (this is the per-field-confidence payoff; the existing dashboard's "low-confidence" is about *retrieval* similarity, a different number).
  - **Pending suggestions** — docs with an unaccepted `_classification.suggested_folder_id`.
- **Where it lives (frontend, NEW):** a sibling tab/section to the existing health dashboard. Reuse the dashboard shell + the paginated/actionable-empty-state pattern already shipped (v2.4 Phase 49 HLTH-*). It is read-only aggregation over the new tables — no new write path, no new RLS beyond what the source tables already enforce.
- **New vs modified:** NEW governance dashboard view + aggregation queries. MODIFIED: none (pure read over new tables under their own RLS).

---

## 🔴 The closed `audit_log` CHECK enum — migration requirement (FLAGGED)

`audit_log.action_type` is a **closed CHECK constraint** (`full-schema.sql:333`) that must stay byte-in-sync with the `VALID_ACTION_TYPES` frozenset (`audit_service.py:13-19`). There is **no SELECT RLS policy** on `audit_log` (reads are scoped in app code; INSERT-only policy at `full-schema.sql:1898`). Every new DM action that calls `write_audit_entry` will be **silently swallowed** if its `action_type` isn't in BOTH the DB CHECK and the Python frozenset — because `write_audit_entry` catches and logs-then-swallows all exceptions (`audit_service.py:38-39`). A constraint-violation insert fails quietly; the audit just never lands.

**New DM action types needed:** `view.create`, `view.delete` (optional), `relationship.create`, `relationship.delete`, `classification.apply`, `classification.rule.create` (optional), `metadata.field.create` (optional). Pick the minimal set that the UI actually audits — at least `relationship.create`, `view.create`, `classification.apply` per the question.

**Migration discipline (two-place sync, both required):**
1. A numbered SQL migration under `supabase/migrations/` (e.g. `NNN_audit_dm_action_types.sql`) that does `ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_type_check;` then re-adds it with the extended `ARRAY[...]`. Apply by pasting into the Supabase SQL editor (never `db push`/`db reset` per CLAUDE.md), then regenerate `full-schema.sql` via `scripts/regenerate-full-schema.sh`.
2. Extend `VALID_ACTION_TYPES` in `audit_service.py:13` in the **same** PR.

**This migration must land in the FIRST DM phase that writes any new audit row** — otherwise that phase's audits silently no-op and you discover it in production. It is cheap and isolated; sequence it as the very first migration of the milestone (a "DM foundations" migration that also creates the shared tables).

---

## Data Flow — the two changed paths

### Ingestion (modified)

```
POST /upload  → 201 in ~1s → _upload_pipeline (BackgroundTask, documents.py:136)
   → extract_composable (per-aspect)         [unchanged]
   → ingest_document (documents.py:1334)
       → extract_metadata(text, model=EFFECTIVE)   ◄ MODIFIED: un-pin model + bigger window + dynamic fields
       → metadata_dict + case-normalize (:1369)
       → ★ NEW: classification rule-eval → metadata_dict["_classification"] suggestion
       → chunk → embed → persist documents.metadata (:1478)   ◄ now carries _confidence + _classification
       → ★ NEW: audit classification.apply (only if a rule fired)
```

### Retrieval via a View (new composition, mostly unchanged code)

```
Click View → views.py resolves filter_expr + folder_scope subtree
   → search_documents(query, user_id, metadata_filter=filter_expr, folder_ids=subtree)  [UNCHANGED seam]
       → match_document_chunks / keyword_search_chunks (SECURITY DEFINER, user-scoped)  [UNCHANGED]
       → results (per-caller, leak-safe on the RPC path)
```

---

## Build order (dependency-respecting) — recommended

1. **DM Foundations (first, smallest, unblocks everything)** — the audit-enum migration + the shared new tables (`document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`) with RLS. Ship the audit `action_type` extension here so no later phase silently drops audits. No behavior yet — pure substrate.
2. **Metadata Enrichment** — un-pin extraction model (`user_settings`/`app_settings` knob), lift the 3k window, dynamic field schema from `metadata_field_definitions`, per-field confidence into `documents.metadata`. **Must precede classification** (classification quality is bounded by metadata richness — SEED-005 + PROJECT.md recommended order). This is the highest-leverage change and the foundation the M-Files "metadata not folders" story rests on.
3. **Virtual folders / saved views** — pure composition over the now-richer metadata + the existing `search_documents` seam; equality/containment V1, sidebar render. Smallest UX win, immediate value.
4. **Document relationships** — `get_related_documents` tool (registry seam) + relationship panel; version-identity decision baked in.
5. **Auto-classification** — rule-eval step in `ingest_document`; depends on (2) for useful metadata and benefits from (4)'s folder structure.
6. **Governance health view** — read-only aggregation over the tables produced by 1–5; last because it surfaces signals (broken relationships, unclassified, low-confidence) that only exist once the producers ship.

This matches the operator's stated order (PROJECT.md line 39: *enrichment → virtual folders → relationships → auto-classification*) with two refinements: a **DM Foundations** phase first (so the audit enum + shared tables land once, cleanly), and governance health **last** (it's a consumer).

---

## Anti-Patterns (DM-specific, to avoid)

### Bypassing the RPC seam for View execution
**Mistake:** running a View as a direct `documents` table query (especially with the service-role key) to support range filters.
**Why wrong:** the user-scoped RPC is the leak-safety net; a direct query hits the broader SELECT RLS (or, with service-role, NO RLS) and can surface other users' or unintended global-folder docs.
**Instead:** for equality, compose `search_documents` (RPC path) unchanged. For range/date predicates, add a `SECURITY DEFINER` RPC that re-states the `folder_is_globally_visible` visibility predicate verbatim, or query under the authenticated client so RLS applies.

### Restructuring `documents.metadata` into `{value, confidence}` per field
**Mistake:** nesting every metadata field as an object to attach confidence.
**Why wrong:** breaks the existing `metadata @> metadata_filter` JSONB-containment pre-filter (`full-schema.sql:132`) that every View and the current `metadata_filter` seam rely on, and breaks the case-normalize at `documents.py:1372`.
**Instead:** keep top-level fields flat; put confidence under a single `_confidence` sub-key (and classification under `_classification`).

### Adding a new agent tool without advertising its schema
**Mistake:** registering `get_related_documents` in `_TOOL_REGISTRY` but not adding it to the tool schema list the model sees (`get_tools`).
**Why wrong:** this is the exact Phase 101 `render_template` bug — the handler existed and dispatched, but the model never saw the schema so it was never called. Registry membership ≠ model visibility.
**Instead:** register in `_TOOL_REGISTRY` AND add the JSON schema to the advertised tool list; verify with a live cross-provider call.

### Auto-moving documents on a classification guess
**Mistake:** classification rule auto-routes the doc to a folder.
**Why wrong:** Tier A scope is *suggestions*; a wrong auto-move on a low-confidence guess is a trust-destroying surprise and conflicts with the version/folder semantics.
**Instead:** persist a suggestion (`_classification.suggested_folder_id`) + surface accept/dismiss; only an accepted suggestion writes `classification.apply` audit.

---

## Integration Points (summary table)

| Feature | Primary integration point (file:line) | New table(s) | New tool/route | Audit action |
|---------|---------------------------------------|--------------|----------------|--------------|
| Virtual folders | `search_documents` `retrieval_service.py:248` (metadata_filter + folder_ids — unchanged) | `document_views` | `views.py` (NEW route) | `view.create` |
| Relationships | `_TOOL_REGISTRY` `tool_dispatcher.py:2353` (+1) | `document_relationships` | `get_related_documents` tool + `relationships.py` | `relationship.create` |
| Auto-classification | `ingest_document` between `documents.py:1375` and `:1467` | `classification_rules` | rule-eval helper + authoring UI | `classification.apply` |
| Config metadata + confidence | `extract_metadata` `embedding_service.py:100/107/114`; persist `documents.py:1478` | `metadata_field_definitions` | extraction-model setting (user/app_settings) | (none — ingestion-scoped) |
| Governance health | read-only over new tables; sibling to v2.3 F-09 dashboard | (none) | governance dashboard view (NEW) | (none) |
| **Audit enum (all)** | `full-schema.sql:333` CHECK + `audit_service.py:13` frozenset | — | numbered migration (FIRST) | — |

---

## Sources

All evidence is in-repo (HIGH confidence — direct source, not training data):

- `backend/app/services/retrieval_service.py:25-80, 113-140, 180-204, 247-321` — search_documents seam, RPC params, latest-only resolution, filename enrich
- `backend/app/services/tool_dispatcher.py:8-12, 173-245, 2353-2382, 2417-2439` — G-5 registry contract, search handler, registry, dispatch guard
- `backend/app/services/audit_service.py:13-39` — VALID_ACTION_TYPES + swallow-on-error behavior
- `backend/app/services/embedding_service.py:100-137` — extract_metadata (hardwired model, 3k window, fixed schema)
- `backend/app/api/documents.py:136-245, 613-653, 1334-1505` — _upload_pipeline, restore (version flip), ingest_document (metadata build + persist + exclude_none)
- `supabase/full-schema.sql:54-70, 93-137, 327-442, 1898, 2110-2152, 2138, 2176-2180` — folder_is_globally_visible, SECURITY DEFINER RPCs (user-scoped), audit CHECK enum, documents/folders schema, RLS policy precedents (skills/workflow_definitions/documents)
- `.planning/seeds/SEED-005-document-management-capabilities.md` — Tier A scope, separate-dashboards note (line 152), enrichment→classification order, metadata-enrichment update
- `.planning/PROJECT.md:29-41` — v3.0 milestone scope + recommended internal order

---
*Architecture research for: v3.0 Document Management (Tier A integration into the existing Agentic RAG platform)*
*Researched: 2026-06-15*
