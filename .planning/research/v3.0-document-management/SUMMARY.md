# Project Research Summary

**Project:** v3.0 Document Management (SEED-005 Tier A + metadata-enrichment add-on)
**Domain:** Metadata-driven document-management (DMS) layer on an AI-native RAG platform
**Researched:** 2026-06-15
**Confidence:** HIGH (stack + architecture verified by file:line against the live codebase; M-Files/SharePoint feature anchors verified against vendor docs; JSONB-perf pitfalls WebSearch-verified)

## Executive Summary

v3.0 turns the platform's *incidental* DM capabilities (nested folders, versioning, an immutable audit log, LLM-extracted per-doc metadata) into a *first-class, metadata-driven surface* modeled on **M-Files' "metadata, not folders" mental model**: saved metadata filters that render in the sidebar exactly like folders (virtual folders), typed directional document relationships, suggest-then-confirm auto-classification on upload, and an enrichment foundation (configurable custom fields + per-field confidence + a lifted extraction window + a choosable extraction model). Tier B — retention, check-in/out, approvals — is **explicitly OUT** (deferred to v3.5). All four research streams converge on one headline: **this milestone needs almost no new third-party dependencies.** Every capability composes from things already in the stack — Postgres `jsonb` + the existing `documents_metadata_gin_idx`, Pydantic 2.12.5 `create_model` for runtime extraction schemas, the existing `get_llm_client(user_settings)` seam (already accepts a model), and the existing `search_documents(metadata_filter, folder_ids)` retrieval seam. The single genuinely net-new component is a **small (~150–250 LOC) hand-rolled filter-AST → parameterized-SQL compiler** — built in-repo, *not* an off-the-shelf rule engine, because virtual-folder filters must push down into SQL to scale and every JSON-logic library evaluates in-memory.

The recommended approach is dependency-first sequencing. **Enrichment is the spine and a hard prerequisite for classification** — classification quality is bounded by metadata quality, and today metadata is a fixed 7-field model extracted from only `content[:3000]` by a hardwired old `gpt-4o`. Build order (all four sources agree): **DM Foundations → Metadata Enrichment → Virtual Folders → Relationships → Auto-classification → Governance Health (last)**. Foundations lands the shared tables + the `audit_log` CHECK-enum extension once; governance is purely a consumer of signals the upstream features produce. The differentiators are AI-native and lean on existing strengths: LLM-extracted metadata auto-populates views with **zero manual tagging** (M-Files' folderless promise without the tagging discipline), **visible per-field confidence chips** (which M-Files does *not* surface), and **agent tools over metadata + relationships** (`get_related_documents`, virtual-folder queries answerable in chat).

The risks are concentrated and well-characterized. Top of the list: **underestimation** — each Tier A item is a vertical stack (table + RLS + query path + agent tool + UI + audit-enum migration + cross-provider UAT), realistically 2–3 phases each, not one. The most dangerous *silent* failure is the **closed `audit_log` CHECK enum**: audit writes swallow exceptions, so any new DM action whose `action_type` isn't added to BOTH the DB CHECK and the Python frozenset succeeds in the UI while the governance audit silently drops the row — a static/mocked test will false-green it (the v2.9 D-102 lesson applies directly). Cross-user leakage via shared (`is_global`) views/relationships is the security spine: `SECURITY DEFINER` bypasses RLS, so any new read path must either run as the invoker (RLS applies) or re-state the `folder_is_globally_visible` visibility predicate verbatim — including closing the count/existence side-channel. The filter DSL must be a closed-registry AST compiled to bound params (no `eval`, no string interpolation), with typed/indexed columns for date ranges (lowercased-string JSONB dates produce silently-wrong "expiring soon" lists). And two positioning fences: keep governance a *light read-only* surface distinct from the retrieval-health dashboard, and add a nullable `org_id` column to every new table now for v3.3 multi-tenancy forward-compat.

## Key Findings

### Recommended Stack

The stack story is "near-zero new dependencies." Tier A ships on four things already present: Postgres `jsonb` + the existing GIN index, Pydantic 2.12.5 `create_model`, `asyncpg`/supabase-py RPC for parameterized execution, and the existing LLM-client seam. The one net-new component is a **constrained filter-expression AST → parameterized Postgres WHERE compiler**, built in-repo (not a library) because virtual folders must push the filter *down into SQL* to scale, and every JSON-logic / rule-engine library found evaluates in-memory over already-loaded objects (`json-logic-py` is also unmaintained). Extraction-model flexibility is **plumbing only** — `get_llm_client(user_settings)` and `UserEffectiveSettings.llm_model` already exist; the caller just passes nothing today. Configurable metadata is `pydantic.create_model` building a runtime extraction schema from a new `metadata_field_definitions` table. One optional, isolated lib (`json-rule-engine` 2.1.0, pure-Python, zero deps) is available *only* for single-doc classification rule-eval if rules outgrow a hand dict matcher — and even then a 30-line matcher likely suffices.

**Core technologies:**
- **PostgreSQL `jsonb` + existing `documents_metadata_gin_idx`** — store custom fields + per-field confidence; evaluate equality/containment filters server-side. `@>` already works; ranges need typed-cast expression (btree) indexes per hot date/number field.
- **Pydantic 2.12.5 `create_model`** (already installed) — build the dynamic structured-extraction model at runtime from user/admin field definitions; first-party, no new dep, pairs with the existing `response_format` forced-emission path.
- **Hand-rolled filter-AST → parameterized-SQL compiler** (net-new, ~150–250 LOC, in-repo) — closed operator set (`eq/neq/gt/gte/lt/lte/contains/in/exists/between/within_next_days` + `and/or/not`), field names whitelisted against `metadata_field_definitions`, all literals bound as `$n`. The one genuinely new piece — and the load-bearing build-vs-adopt decision.
- **`asyncpg` >=0.29 / supabase-py RPC** (already installed) — injection-safe `$n`-bound execution of the compiled predicate, via a new `match_documents_by_filter` RPC or an extension of the existing RPCs (additive; the simple-equality path stays byte-identical).

### Expected Features

The M-Files **Dynamic View** is the UX anchor users will assume: a saved metadata filter that *looks like a folder but isn't*, where a document appears in many views with no duplication, and grouping levels render metadata as a nested pseudo-folder tree. Where we win is AI-native: extraction already runs on ingest, so views self-populate without tagging discipline; per-field confidence is surfaced (M-Files does not); relationships and views become agent tools, not just GUI dialogs.

**Must have (table stakes):**
- Saved view renders in the sidebar like a folder (the entire M-Files mental model).
- Live contents, multi-view, no duplication (query-not-copy).
- Filter operators: equals / one-of / contains / is-empty / numeric & date comparisons + relative-date ("expiring within N days").
- AND-composition of multiple conditions.
- Configurable / custom metadata fields (the spine — a fixed 7-field schema reads as a toy).
- Edit/override extracted metadata by hand (audit-logged).
- Typed, directional relationships (`supersedes / amends / references / attached_to`) + a relationship panel on doc detail.
- Classification is a *suggestion the user confirms*, not silent auto-filing.
- A light governance view (broken/dangling relationships, unclassified, low-confidence docs).

**Should have (competitive differentiators):**
- LLM-extracted metadata automatically feeds views — zero manual tagging (the headline story).
- Per-field confidence shown in the UI (M-Files surfaces no numeric per-field confidence).
- Agent tools over metadata & relationships (`get_related_documents`, views queryable in chat).
- Semantic content-based classification (understands an invoice that never says "invoice").
- Choose the extraction model + lift the 3,000-char window (the operator's headline ask).

**Defer (v3.0.x / v3.1):**
- View grouping levels (metadata → nested pseudo-folders) — ship flat-list first.
- Nested boolean (OR groups) in views.
- Full governance dashboard (start as 3 counters).
- Workflow deliverables auto-related + auto-classified (composes SEED-069).

**Anti-features (deliberately skip):** the full M-Files vault model (object types/classes/value-lists); silent autonomous classification + auto-filing (Doxis); check-out-to-edit; per-library view scoping (SharePoint silo); materialized "real folder per view"; untyped "just related" links; a raw end-user search DSL; approval/retention/legal-hold state machines (Tier B → v3.5).

### Architecture Approach

This is an *integration* study, not a redesign: Tier A composes with verified seams. Views resolve to an unchanged `search_documents(query, user_id, metadata_filter=filter_expr, folder_ids=subtree)` call — the equality/containment case needs **zero retrieval code changes**. Relationships register a `get_related_documents` tool via the one-line `_TOOL_REGISTRY` seam (G-5 contract keeps `threads.py` untouched) and **must also be added to the advertised `get_tools` schema** (the Phase 101 `render_template` bug: registry membership ≠ model visibility). Classification inserts a rule-eval step in `ingest_document` between metadata-build and persist, writing a *suggestion* into the same `metadata` jsonb — never an auto-move. Enrichment threads the effective model through `extract_metadata`, lifts the window, builds the schema dynamically, and stores per-field confidence under a flat `_confidence` sub-key so the `@>` containment pre-filter still matches (do NOT restructure metadata into `{value, confidence}` tuples).

**Major components:**
1. **DM Foundations (substrate)** — audit CHECK-enum extension + `VALID_ACTION_TYPES` sync + the four new tables (`document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`), RLS + nullable `org_id`.
2. **Enrichment** (`extract_metadata` + `metadata_field_definitions`) — un-pin model, lift window, dynamic Pydantic schema, `_confidence`.
3. **Virtual folders** (`document_views` + `views.py` + sidebar + filter-AST compiler).
4. **Relationships** (`document_relationships` + `get_related_documents` tool + detail panel; links resolve through latest/`is_latest`).
5. **Auto-classification** (`classification_rules` + rule-eval in `ingest_document`; suggest-then-confirm).
6. **Governance health** (read-only aggregation; separate from the retrieval-health dashboard; lands last).

### Critical Pitfalls

1. **Underestimation** — each Tier A item is a vertical stack; budget 2–3 phases each, per-item vertical checklist + G-6 gate.
2. **Closed `audit_log` CHECK enum → silent rejects** — ship enum migration + frozenset sync in the same phase; boot/CI subset assertion; verify a real INSERT+SELECT against the live DB (mocks false-green this — D-102).
3. **Cross-user leakage via shared views/relationships** — `SECURITY DEFINER` bypasses RLS; default to invoker scope or re-state `folder_is_globally_visible` verbatim; resolve results/counts/facets over the viewer's visible set (close the count/existence side-channel); 404-not-403 on miss.
4. **Filter-DSL hazards** — closed-registry AST → parameterized SQL (no eval/interpolation); promote hot date/`document_type` fields to typed indexed columns (GIN doesn't speed `->>`/range; lowercased-string dates give silently-wrong "expiring" lists); load-test at ~10k docs.
5. **Classification bounded by metadata quality** — sequence enrichment FIRST; confidence-aware + suggest-only; document `exclude_none=True` as intended (don't coerce `author: ""`).
6. **Governance ≠ retrieval dashboard** — separate surface reusing the card/action-hook patterns; keep it light; don't touch knowledge-health hot files.
7. **Multi-tenancy forward-compat (v3.3)** — nullable `org_id uuid` (no FK) on every new table per the `workflow_definitions` precedent; re-keyable RLS; visibility via a helper, not inline `is_global`.
8. **Positioning / Tier B creep** — anchor every feature to the retrieval/deliverable story; hard-fence Tier B.

## Implications for Roadmap

(All four sources converge on this order; each "phase" may expand to 2–3 real phases per Pitfall 1.)

- **Phase 1: DM Foundations** — four new tables (RLS + nullable `org_id`) + `audit_log` CHECK-enum extension (`view.create`, `relationship.create`, `classification.apply` min) + `VALID_ACTION_TYPES` sync + boot/CI subset assertion. Pure substrate. Avoids P2, P7.
- **Phase 2: Metadata Enrichment** — un-pin model + lift `content[:3000]` + custom fields via `create_model` + `_confidence` + manual edit (audit-logged). Hard prerequisite for classification. Avoids P5, P4.
- **Phase 3: Virtual Folders** — saved views, sidebar rendering, the net-new filter-AST → SQL compiler (equality V1 byte-identical on the existing seam; ranges add the compiler + visibility-aware path). Avoids P3, P4.
- **Phase 4: Relationships** — typed links + `get_related_documents` tool (registry + advertised schema) + relationship panel. Avoids P3 + the 101 schema-visibility bug.
- **Phase 5: Auto-classification** — `classification_rules` + rule-eval in `ingest_document`, suggest-not-move. Must follow Phase 2. Avoids P5, P2.
- **Phase 6: Governance Health** — read-only diagnostic, separate surface. Lands last (consumer). Avoids P6, P8.

**Ordering rationale:** dependency-driven (enrichment → classification is a hard prerequisite; date-typed fields unblock "expiring soon" views; governance consumes signals so it's last), architecture-driven (Foundations consolidates the audit-enum migration + shared tables once; equality views ship cheap), pitfall-driven (audit-enum + `org_id` discipline established once in Foundations; leakage + DSL safety concentrate in Views/Relationships under live secure-phase gates; Tier B fenced throughout).

**Research flags — needs deeper research:** Phase 2 (dynamic `create_model` → `response_format` across the native-7 + long-doc sampling spike), Phase 3 (the filter-AST → SQL compiler grammar + typed-index + DEFINER-vs-invoker decision + injection/SSTI secure-phase). Minor: Phase 5 (reuse the AST in-memory vs. a separate matcher).
**Standard patterns — skip deep research:** Phase 1 (migration/RLS/`org_id` precedents), Phase 4 (typed-link table + one-line registry seam), Phase 6 (dashboard-shell reuse).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Seams verified by file:line; PyPI/Pydantic verified; JSONB-index best-practice from multiple agreeing 2025–2026 sources. |
| Features | MEDIUM–HIGH | M-Files/SharePoint verified against vendor docs; the visible per-field-confidence differentiator is inferred from M-Files *not* documenting numeric confidence; Doxis vendor-docs-only. |
| Architecture | HIGH | Internal integration study; every seam/RLS finding/audit-enum trap/`@>`-vs-range constraint cited by file:line. |
| Pitfalls | HIGH | Architecture pitfalls verified against live schema/services; external JSONB-perf WebSearch-verified (MEDIUM); D-102 is direct internal precedent. |

**Overall confidence:** HIGH

**Gaps to address:** (1) filter-AST grammar + range-query execution path (DEFINER RPC vs invoker query) — resolve in Phase 3 spike/secure-phase; (2) per-field confidence display bar — no external UX anchor, our design call, warrants a G-2 sketch; (3) cross-provider extraction reliability of dynamic-schema `create_model` — SC#10 4-axis UAT; (4) relationship version-identity (recommend latest-resolved/`is_latest` for Tier A) — confirm at Phase 4 scope; (5) long-doc window-lift sampling (front-matter + tail) — Phase 2 spike.

## Sources

**Primary (HIGH):** live codebase by file:line (`retrieval_service.py:248-258`, `tool_dispatcher.py:8-12/173-245/2353-2382/2417-2439`, `embedding_service.py:100-137`, `documents.py:136-245/613-653/1334-1505`, `audit_service.py:13-39`, `models/document.py:8-16`, `config.py:703`, `openai_service.py:970`, `user_settings.py:99`); `full-schema.sql:54-70/93-137/333/455+722+755+779/1898/2110-2152/2138/1226`; Pydantic 2.12.5 `create_model`; M-Files official docs (Dynamic Views, property-based conditions, `DaysTo/DaysFrom`, object relationships, IML/Smart Metadata); Microsoft Support (SharePoint metadata navigation); SEED-005, SEED-004, PROJECT.md.
**Secondary (MEDIUM):** PyPI/Snyk (`json-logic-py` unmaintained; `json-rule-engine` 2.1.0); PostgreSQL JSONB indexing guides (SitePoint/DEV/Crunchy 2025–2026); Doxis vendor docs.
**Tertiary (LOW):** Symmetry Systems "Metadata Minefield" (metadata-disclosure motivation for the side-channel guard).
