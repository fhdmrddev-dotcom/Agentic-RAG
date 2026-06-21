# Pitfalls Research

**Domain:** Adding M-Files-style Tier A document management (metadata-driven views / virtual folders, document relationships, auto-classification, configurable metadata + per-field confidence, light governance view) to an existing single-tenant + per-user + `is_global` RAG platform.
**Researched:** 2026-06-15
**Confidence:** HIGH (architecture pitfalls verified against `supabase/full-schema.sql`, `retrieval_service.py`, `audit_service.py`, `tool_dispatcher.py`; external pitfalls MEDIUM, WebSearch-verified)

> **How to read this file.** Each pitfall is specific to adding *these* features to *this* codebase, not generic DMS advice. Every pitfall names warning signs, a prevention strategy, and a target phase. The recommended internal order (locked in PROJECT.md / SEED-005) is **enrichment → virtual folders → relationships → auto-classification**, with a light governance view and a multi-tenancy forward-compat discipline running across all of them. Phase numbers below are *roles* (P-ENRICH, P-VIEWS, P-REL, P-CLASS, P-GOV, plus a cross-cutting P-FOUND foundation/discipline) — map to real phase numbers when the roadmap is drawn.

---

## Critical Pitfalls

### Pitfall 1: Underestimation — "it's just saved searches + links"

**What goes wrong:**
Tier A reads like four small features. In this codebase each one is actually a **vertical stack**: a new table + RLS policies + a `SECURITY DEFINER` or invoker-scoped query path + at least one agent tool (the agent must be able to *use* views/relationships, not just the UI) + a new UI surface in the document/folder views + a **new `audit_log` action-type enum value + the migration to add it + the `VALID_ACTION_TYPES` sync** + cross-provider behavior consideration (any new agent tool is subject to the SC#10 4-axis UAT bar). SEED-005 itself flags this as its #1 risk ("Underestimating this — 'it's just saved searches and links' — is a real risk. Each Tier A item is probably 2–3 phases on its own.").

**Why it happens:**
The schema *looks* ready (folders, versioning, audit, metadata all exist), so the surface feels additive. But "compose with existing search/metadata/folders" hides that the existing `metadata_filter` is a flat equality dict (no DSL), the existing search RPC is owner-scoped (no shared-doc path), and the audit enum is a closed CHECK constraint — each of those is a sub-project, not a parameter.

**How to avoid:**
- Scope each Tier A item as **2–3 phases**, not one. Treat enrichment as its own milestone-anchor (it gates classification quality — see Pitfall 5).
- Write a **per-item "vertical checklist"** at scope-time: table, RLS (SELECT + INSERT + UPDATE + DELETE), query path (definer vs invoker — Pitfall 3), agent tool(s), UI surface, audit enum value + migration + sync (Pitfall 2), `org_id` forward-compat column (Pitfall 7), cross-provider UAT row if a tool is added.
- Apply the existing **G-6 "How we'd know this failed" gate** to each phase SPEC; if failure modes can't be enumerated the scope isn't ready.

**Warning signs:**
A phase SPEC for "virtual folders" with zero audit-enum task, zero RLS task, and no agent-tool task. A roadmap that fits all four Tier A items into ≤4 phases. Estimates that don't separately budget the metadata-enrichment workstream.

**Phase to address:** Roadmap construction (all phases) + P-FOUND (establish the vertical checklist as a phase-scoping requirement).

---

### Pitfall 2: The closed `audit_log` CHECK enum → silent rejects on new DM actions

**What goes wrong:**
`audit_log.action_type` is a **closed CHECK constraint** (`supabase/full-schema.sql:333`: `CHECK (action_type = ANY (ARRAY['document.upload', ... 'feedback.submit']))`), kept in lockstep with `VALID_ACTION_TYPES` in `backend/app/services/audit_service.py:13`. Audit writes are **fire-and-forget and swallow all exceptions** (`audit_service.py:38` — `except Exception ... swallowed (D-05)`). So the moment a DM feature writes a new action (`view.create`, `relationship.create`, `document.classify`, `metadata.update`, `view.delete`, `relationship.delete`), Postgres raises a `23514` CHECK violation, the service logs to stderr and *returns normally* — the action succeeds, the user sees success, and the governance audit trail **silently has a hole**. This is invisible in any UI-only test and in any test that mocks the DB.

**Why it happens:**
The closed enum is good hygiene (prevents typo'd action types) but turns "add an audit line" into "add an enum value via migration." Developers add the audit write in app code, see green tests (mocked DB or swallowed exception), and never notice the CHECK reject. Governance/compliance value is exactly the thing DM features are *supposed* to add — so a silent audit hole defeats the feature's own purpose.

**How to avoid:**
- For **every** new DM action, ship a numbered migration that `ALTER`s the CHECK constraint to add the new value(s), AND add the same string to `VALID_ACTION_TYPES`. These two MUST land in the same phase. (Migration discipline per CLAUDE.md: paste into Supabase SQL editor, never `db push`; then `regenerate-full-schema.sh`.)
- Add a **startup/CI assertion** that `VALID_ACTION_TYPES` is a subset of the DB CHECK enum (drift guard) — turns a silent runtime reject into a loud boot-time failure.
- During phase verification, write **one real audit row per new action against the live DB** and SELECT it back. Do not trust the swallowed write — the v2.9 lesson ("validation gates MUST be driven live, not statically; mocks false-green real failures," PROJECT.md D-102) applies directly: a static/mocked test will false-green this.
- Consider logging audit-write failures at **WARNING with the rejected action_type** so a missed enum value is greppable in logs even if the assertion is skipped.

**Warning signs:**
A DM phase that adds an agent tool or UI action but no migration touching `audit_log_action_type_check`. Audit CSV export missing rows for an action you know happened. stderr lines `audit write failed [action=view.create ...]`.

**Phase to address:** P-FOUND (establish the enum+sync+assertion discipline once) — then enforced per-phase in P-VIEWS, P-REL, P-CLASS, P-ENRICH.

---

### Pitfall 3: Cross-user leakage via shared views / relationships over per-user docs

**What goes wrong:**
Today's retrieval is **strictly owner-scoped**: both `match_document_chunks` and `keyword_search_chunks` are `SECURITY DEFINER` but every query filters `WHERE dc.user_id = match_user_id` (`full-schema.sql:105,129`). So search *cannot* currently surface another user's documents — even global-folder ones — because the predicate is the caller's own `user_id`. The risk arrives when DM features introduce **shared (`is_global`) saved-views or relationships that resolve documents across users**. A naive shared view implemented as a `SECURITY DEFINER` function that returns matching documents regardless of owner would leak: not just content, but **result counts, metadata values, and mere existence** of other users' documents (a contract title, a vendor name, an expiry date — leaked via the view's row count or facet labels even if content is gated). The same hazard already exists in principle for `folder_is_globally_visible` + the global-folder SELECT policy (`full-schema.sql:2138`), but DM views *aggregate and surface* metadata in ways raw search does not.

**Why it happens:**
"Make the view global so the team can share it" feels like reusing the existing `is_global` pattern (folders/skills/workflows). But `is_global` on a *folder* means "documents in it are readable by all" — an explicit content-sharing decision. A *view* or *relationship* is a query/edge over the whole corpus; making the view global silently widens what its filter can reach unless the underlying query re-applies per-user (or per-global-folder) scoping. `SECURITY DEFINER` bypasses RLS by design, so the scoping must be re-implemented inside the function — and it's easy to forget the count/existence side-channel (an empty result vs. "3 results you can't open" both leak).

**How to avoid:**
- **Default views and relationships to per-user (invoker) scope.** A shared view's *definition* (name + filter) can be `is_global`, but its *results* must be resolved per-viewer — never "owner's results shown to everyone."
- When a query MUST be `SECURITY DEFINER` (e.g. to read across the global-folder set), **re-apply the visibility predicate inside the function** exactly as `match_document_chunks` re-applies `user_id`: `WHERE owner = caller OR (folder_id global-visible)`. Treat every new definer RPC as a security review item (mirror the v2.9 secure-phase discipline; PROJECT.md "Audit every SECURITY DEFINER RPC for tenancy correctness").
- **Close the count/existence side-channel:** a shared view must compute counts and facets over the *viewer's visible set*, not the global set. Relationship edges that point at a document the viewer can't see should render as "linked document (no access)" — never leak the target's title/metadata.
- Prefer `SECURITY INVOKER` + RLS for any new DM table whose rows are per-user (views, relationships, classification suggestions). Only reach for `DEFINER` when you specifically need cross-owner global-folder reads, and document why.
- Mirror the **404-not-403** information-disclosure pattern already used for `/reextract` and template routes (PROJECT.md D-v2.6-04): a cross-user miss returns "not found," never "forbidden" (which confirms existence).

**Warning signs:**
A new `SECURITY DEFINER` function with no `user_id` / global-folder predicate in its `WHERE`. A view result count that differs depending on who created the view rather than who's viewing it. A relationship panel that shows a target document's title to a user who can't open it. Any DM RPC that takes `match_user_id` but doesn't use it in every branch.

**Phase to address:** P-VIEWS (shared-view scoping) and P-REL (relationship visibility), with the discipline established in P-FOUND. Each must pass a `secure-phase` gate that hand-checks the definer/invoker boundary (don't trust the label — re-run the leak test live, per the D-102 lesson).

---

### Pitfall 4: Filter-DSL hazards — injection, SSTI, and JSONB performance

**What goes wrong:**
Virtual folders need to express things like "all contracts expiring in 90 days" — but today `metadata_filter` is a **flat, equality-only dict, lowercased** (`retrieval_service.py:258` — `{k: v.lower() ... }`) applied via JSONB containment `d.metadata @> metadata_filter` (`full-schema.sql:108,132`). To support ranges / booleans / composition you need a real filter DSL, and three distinct hazards appear:

1. **Injection / SSTI.** If the DSL is compiled to SQL by string interpolation, or evaluated with `eval`/a templating engine, an attacker (or the agent, which authors filters) can inject. The codebase already has the right instincts — `query_user_documents` enforces SELECT-only + no-semicolons (`full-schema.sql:153`), and v2.9's `llm_emit` deliberately avoids `eval` with **no-eval closed registries** (PROJECT.md, harness gates) — but a new "view filter expression" is a fresh injection/SSTI surface that must adopt the same closed-registry / parameterized posture from day one.
2. **JSONB performance with no index.** WebSearch-verified: `metadata @> '{...}'` **scans every row without a GIN index**; a GIN index speeds containment but does *not* speed `->>` equality or range queries. Virtual folders run their filter on every sidebar render / refresh, over the whole corpus — an unindexed containment scan that's fine at 100 docs degrades sharply by 10k+.
3. **The date-range trap.** Metadata dates are stored as **lowercased strings** inside the JSONB blob (the same `.lower()` normalization). String-typed dates can't answer "expiring in 90 days" correctly (`"2026-01-09" < "2026-1-9"` lexical nonsense; no `interval` math). A btree on a *typed* column wins decisively for range queries (WebSearch-verified: "a proper column with a btree index will always win for equality and range queries on hot paths compared to JSONB with GIN").

**Why it happens:**
The flat dict "works" for the agent's occasional `document_type=contract` filter, so extending it feels like adding operators. But equality-on-strings and range-on-typed-dates are different engines; bolting ranges onto a lowercased-string JSONB blob produces silently-wrong results (the worst kind — no error, just wrong "expiring" lists). And because the existing filter is rare (agent-only, on explicit user ask), nobody has hit the unindexed-scan wall yet.

**How to avoid:**
- **Promote the metadata fields that views filter on (especially dates and document_type) to typed, indexed columns** — or a typed sidecar table — rather than range-querying lowercased JSONB strings. Date columns get a btree; `document_type` etc. get a GIN or btree as the query shape dictates. (This pairs naturally with the enrichment workstream that's already un-pinning the metadata model — Pitfall 5.)
- Build the filter DSL as a **closed-registry AST**: a fixed set of operators (`eq`, `in`, `range`, `before`, `after`, `and`, `or`) compiled to **parameterized** SQL, never string-interpolated, never `eval`/templated. Reuse the v2.9 no-eval-registry posture and the `query_user_documents` SELECT-only/no-semicolon guard as precedent.
- **Do not lowercase typed values.** Lowercasing is correct for free-text equality matching but destroys dates and case-sensitive identifiers. Scope normalization per-field-type, not globally.
- Add a **GIN index on `documents.metadata`** for containment, and **expression/btree indexes** on promoted typed columns, before the virtual-folder feature ships — and load-test view evaluation at ~10k docs.

**Warning signs:**
View filters built by interpolating user/agent strings into SQL. A "date range" view that returns wrong rows near month/day boundaries. `EXPLAIN` showing a seq scan on `documents` for a view query. Sidebar lag that grows with corpus size. Any range query against a value the codebase lowercased.

**Phase to address:** P-ENRICH (promote/typed metadata + indexes — must precede views) → P-VIEWS (the DSL + parameterized compilation + index verification). The DSL injection/SSTI review is a `secure-phase` item on P-VIEWS.

---

### Pitfall 5: Auto-classification quality is bounded by metadata quality → enrichment MUST sequence first

**What goes wrong:**
Auto-classification ("if document_type=invoice and metadata.vendor exists → suggest folder X") is built *on* the extracted metadata. But today's metadata is a **fixed 7-field model** (`title/author/date/document_type/topics/language/summary`) extracted from only **`content[:3000]`** by a **hardwired old `gpt-4o`** with **no per-field confidence** (SEED-005 update + breadcrumbs `embedding_service.py:100-137`). If you build classification on those weak inputs, you ship confident-looking routing suggestions grounded in metadata that missed the title page, guessed the type, and can't tell you how sure it was. Worse: **over-trusting the LLM classification** (auto-*moving* documents instead of *suggesting*) compounds a weak signal into silent misfiling.

A second, subtler trap: the **"author disappeared" non-regression**. `DocumentMetadata.author` is correctly omitted when there's no byline because `exclude_none=True` (`documents.py:1369`) — this is *correct best-effort behavior*, investigated and confirmed NOT a bug (SEED-005 update, bolded). A naive "fix" that forces an empty `author: ""` would corrupt every downstream equality filter and classification rule (an empty-string author is not the same as "no author") and break the JSONB containment semantics.

**Why it happens:**
The four Tier A items look independently shippable, so classification gets scheduled in parallel with (or before) enrichment to "show progress." LLM classification output looks authoritative, so the temptation is to auto-route. And the `exclude_none` behavior looks like a missing field to someone who doesn't read the history, inviting a "fix" that's actually a regression.

**How to avoid:**
- **Sequence enrichment FIRST** (PROJECT.md's locked order: enrichment → virtual folders → relationships → auto-classification). Classification consumes enriched, higher-confidence metadata; building it on the 7-field/3000-char/gpt-4o substrate is building on sand.
- Ship **per-field confidence** as part of enrichment, and make classification **confidence-aware**: low-confidence fields produce *suggestions a human confirms*, never auto-moves. Mirror the v2.9 judge-as-hard-wall instinct — classification is advisory until a human (or a high-confidence threshold) accepts it.
- **Classification suggests; it does not silently re-file.** Auto-routing is opt-in per rule and always reversible, with an audit line (subject to Pitfall 2's enum discipline: `document.classify`).
- **Document `exclude_none=True` as intended behavior in the phase SPEC** so no one "fixes" it. Treat "empty author dropped" as a non-regression invariant with a guarding test.

**Warning signs:**
A roadmap with classification before or beside enrichment. Classification rules keyed on fields with no confidence score. Auto-move (not auto-suggest) on upload. A PR adding `author: ""` or removing `exclude_none`. Routing suggestions that are confidently wrong on long docs (title page past char 3000).

**Phase to address:** P-ENRICH (un-pin extraction model, lift the window, custom fields + per-field confidence; lock `exclude_none` as intended) → P-CLASS (confidence-aware, suggest-not-move). P-CLASS must not start before P-ENRICH ships.

---

### Pitfall 6: Conflating the governance dashboard with the retrieval (knowledge-health) dashboard

**What goes wrong:**
The existing Knowledge Health Dashboard (v2.3 F-09) surfaces **retrieval** health — most-retrieved, never-retrieved, low-confidence, stale. DM features need a **governance** view — broken/dangling relationships, classification-pending, low-confidence-metadata, (later) retention-due, locked-too-long. SEED-005 explicitly calls these **distinct dashboards, not extensions** ("important to scope cleanly"). Bolting governance metrics onto the retrieval dashboard muddles two different audiences (the person tuning RAG vs. the person managing the document estate), creates a hot-file/G-5 refactor magnet on the health components, and produces a dashboard that does neither job well.

**Why it happens:**
A dashboard already exists with cards and an action-hook pattern, so adding "broken relationships" looks like adding a card. But retrieval health answers "is my KB good for the agent?" and governance answers "is my document estate well-managed?" — same widgets, different mental models and different drill-downs.

**How to avoid:**
- Build the **governance view as a separate surface** (its own page/route + its own queries), reusing the *card/action-hook component patterns* from knowledge-health without merging the data model. SEED-005's light SEED-046 scope is "a governance health view," not "more cards on the existing one."
- Keep it **light** for v3.0 (broken relationships, classification-pending, low-confidence metadata) — Tier B governance (retention-due, locked-too-long, awaiting-approval) is deferred to v3.5 and must NOT leak into v3.0 scope (Pitfall 8).
- Avoid touching the knowledge-health hot files for governance data; if a shared component genuinely needs extraction, invoke the G-5 refactor-between-waves rule first.

**Warning signs:**
A phase that adds governance metrics to `knowledge_health.py` / the existing dashboard component. One dashboard trying to serve both "tune retrieval" and "manage documents." Retention/approval metrics appearing in v3.0 governance scope.

**Phase to address:** P-GOV (light, separate governance view). Explicitly out of scope for any enrichment/views/relationships phase except as a data *producer* (those phases emit the signals; P-GOV displays them).

---

### Pitfall 7: Forward-compat with multi-tenancy (v3.3) — Tier A tables that fight an org discriminator

**What goes wrong:**
Multi-tenancy (orgs/departments/roles, SEED-004) is a **future milestone (v3.3)** that will rewrite RLS from `user_id = auth.uid()` to membership-based, retire `is_global`, and re-key visibility on an `org_id` discriminator. If Tier A tables bake in assumptions that fight this — no `org_id` slot, `is_global` semantics hardcoded into view/relationship logic, RLS policies that can't be re-keyed without a data migration, classification rules tied to per-user-only scope — then the v3.3 RLS rewrite has to *rewrite the DM tables too*, doubling that milestone's surface. SEED-004 explicitly warns: "DM features should land against a single-tenant model first, then extend... better than to design DM and tenancy simultaneously" — but "land first" only re-keys cleanly if you leave the seam.

**Why it happens:**
v3.3 is two milestones away, so it's tempting to ignore it. But RLS and visibility are exactly the columns DM features define, and retrofitting an org discriminator onto live tables with data is painful (SEED-004: "the tenancy model decision is one-way... migrating is painful").

**How to avoid:**
- **Follow the precedent already set in the codebase.** `workflow_definitions`, `workflow_runs`, `workflow_phases`, and `harness_audit` each already carry a nullable `org_id uuid` column with the exact comment: *"Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped."* (`full-schema.sql:455,722,755,779`). Every new Tier A table (`document_relationships`, `saved_views`/virtual folders, classification rules, custom-field definitions) gets the same nullable `org_id` column, no FK yet, RLS stays user-scoped for now.
- Keep RLS policies **shaped to be re-keyable**: `auth.uid() = user_id` today, structured so v3.3 can swap in `org_membership(...)` without dropping/recreating the table.
- **Don't hardcode `is_global` two-valued logic** into view/relationship resolution. Route visibility through a helper (like `folder_is_globally_visible`) so v3.3 can replace the helper's body with org/dept logic without touching call sites.
- Don't over-build: NO org tables, NO FK, NO membership logic in v3.0 — just the nullable discriminator column + re-keyable policy shape. (Avoid the opposite over-engineering trap; v3.3 owns the actual tenancy work.)

**Warning signs:**
A new DM table with no `org_id` column. RLS policies or view logic with `is_global` branching inline rather than behind a helper. A migration that would need a destructive rewrite to add `org_id` later. Per-user-only assumptions hardcoded into classification-rule scoping.

**Phase to address:** P-FOUND (establish the nullable-`org_id` + re-keyable-RLS convention once) — applied in every table-creating phase (P-VIEWS, P-REL, P-CLASS, P-ENRICH custom-fields table).

---

### Pitfall 8: Positioning drift — turning the RAG product into "a DMS," or pulling Tier B in early

**What goes wrong:**
Two related drifts. (1) **Positioning:** SEED-005 and its "Why This Seed Avoids Doing It Now" both warn that "'we're a RAG system' is a clearer story than 'we're a RAG system AND a DMS'." If DM features become the headline rather than a metadata-driven layer that *makes retrieval and cited workflow deliverables more trustworthy* (the v3.0 goal in PROJECT.md), the product loses its differentiator and starts competing head-on with SharePoint/M-Files/Documentum on their turf. (2) **Tier B creep:** retention, check-in/check-out, and approval workflows (Tier B) are explicitly deferred to **v3.5** and gated on "actual user-driven motivation" / "evidence of which Tier B feature is most-asked-for." Pulling them into v3.0 ("while we're in here") multiplies scope, drags in scheduled jobs / legal-hold / state-machine complexity, and delays the Tier A value.

**Why it happens:**
Once you're building DM tables it feels efficient to "finish the DMS." And enterprise/compliance conversations pull toward retention/approvals because they sound like the "real" DM features. But Tier A is chosen precisely because it *composes* with the existing metadata/search/folder model; Tier B *fights* the upload-driven, read-mostly architecture and is far more valuable once orgs/departments exist (SEED-004 — i.e., after v3.3, hence v3.5).

**How to avoid:**
- **Anchor every DM feature to the retrieval/deliverable story.** Virtual folders make saved queries first-class; relationships make "this contract amends that one" answerable by the agent; classification routes on metadata. Each should demonstrably improve what the agent can *retrieve and cite*, not just "manage documents."
- **Hard-fence Tier B out of v3.0.** No `document_locks`, no `retention_policies`, no `document_workflow_state`, no scheduled retention jobs, no legal-hold. If a stakeholder asks, capture as a v3.5 candidate, don't fold in.
- Keep the governance view **light** (Pitfall 6) — light governance is Tier A; full lifecycle governance is Tier B.
- Use the existing **scope-fork discipline** (the v2.8/v2.9 milestones repeatedly locked deferrals explicitly) to record any Tier B ask as deferred-with-trigger rather than silently absorbed.

**Warning signs:**
Roadmap language that positions v3.0 as "becoming a DMS." Any retention/approval/lock table or scheduled job appearing in v3.0 scope. DM features with no articulated retrieval/deliverable benefit. Marketing copy comparing to SharePoint feature-for-feature.

**Phase to address:** Milestone framing (PROJECT.md goal already correct) + every phase SPEC's "what this is NOT" section. Reinforce at `/gsd:new-milestone` scoping and each `/gsd:discuss-phase`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Extend the flat `metadata_filter` dict with ad-hoc operators instead of a real AST/DSL | Ships virtual folders fast | Injection/SSTI surface; silently-wrong date ranges; can't compose AND/OR | Never — build the closed-registry AST from the start |
| Range-query lowercased JSONB date strings | No schema change | Wrong "expiring" lists (lexical date compare); unindexed scans | Never for date ranges — promote to a typed, indexed column |
| Make a shared view a `SECURITY DEFINER` function without re-applying visibility | "Sharing works" in one line | Cross-user content/count/existence leakage | Never — re-apply the predicate inside the function |
| Add the audit write in app code without the CHECK-enum migration | Code compiles, tests (mocked) green | Silent 23514 reject → audit hole in the exact feature meant to add governance | Never — enum migration + sync ship in the same phase |
| Build classification on the 7-field/3000-char/gpt-4o metadata | Shows progress before enrichment lands | Confident-wrong routing on a weak signal | Never — sequence enrichment first |
| Skip the nullable `org_id` column on new DM tables | One fewer column | v3.3 must rewrite live DM tables to add a discriminator | Never — the precedent column is free and proven |
| Add governance cards to the existing knowledge-health dashboard | Reuses a built surface | Two audiences muddled; G-5 hot-file magnet | Only if extracting shared card components via a G-5 refactor first |
| Auto-move documents on classification (not suggest) | "Smart" UX | Silent misfiling compounds weak metadata; hard to reverse | Only behind a high-confidence threshold + audit + reversibility |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `audit_log` CHECK enum ↔ `VALID_ACTION_TYPES` | Add app-side action type, forget the DB CHECK migration | Ship migration (ALTER CHECK) + sync the frozenset in the same phase; add a subset-assertion at boot/CI |
| `SECURITY DEFINER` RPCs (new DM query paths) | Assume RLS protects a DEFINER function (it doesn't) | Re-apply `user_id`/global-folder predicate inside the function; secure-phase the boundary live |
| Supabase migrations | `supabase db push` / `db reset` (wipes dev data) | Paste numbered migration into SQL editor; `regenerate-full-schema.sh` (no reset); commit both (CLAUDE.md) |
| New agent tools (`get_related_documents`, view tools) | Ship without cross-provider UAT | SC#10 4-axis bar applies to any tool-calling change — author UAT rows in VALIDATION.md |
| `documents.metadata` JSONB filtering | Expect a GIN index to speed `->>`/range queries | GIN for containment only; promote range/date fields to typed btree columns |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unindexed JSONB containment on every view render | Sidebar lag grows with corpus | GIN on `documents.metadata`; promote hot filter fields to typed columns | ~10k+ docs (seq scan dominates) |
| Range query on lowercased string dates | Wrong rows near boundaries; no error | Typed date column + btree; per-field-type normalization | Any corpus — it's correctness, not just speed |
| Relationship graph traversal (recursive) without bounds | Slow "related docs" panel; N+1 | Cap traversal depth; index `source_doc_id`/`target_doc_id`; batch fetch | Dense relationship graphs / deep amend chains |
| Re-classifying / re-enriching the whole library on deploy | Latency + LLM cost spike | Opt-in per-document re-extraction (precedent: `/reextract`, D-v2.6-04), never auto-bulk | First request after deploy on a large library |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shared view leaks result counts / facet labels of other users' docs | Existence + metadata disclosure (titles, vendors, expiries) | Resolve view results/counts/facets over the *viewer's* visible set, not the global set |
| Relationship target shown to user without access | Title/metadata disclosure of an inaccessible doc | Render "linked document (no access)"; never leak target metadata |
| Filter DSL compiled by string interpolation / `eval` / templating | SQL injection / SSTI | Closed-registry AST → parameterized SQL; reuse no-eval-registry + SELECT-only/no-semicolon precedent |
| Cross-user miss returns 403 | Confirms a doc exists | Return 404 (precedent: `/reextract`, template routes, D-v2.6-04) |
| `audit_log` has INSERT RLS but NO SELECT RLS | Reads scoped only in app code → a new DM read path could over-return | Keep audit reads app-scoped to `user_id`; add SELECT scoping if a governance read path is added (and re-key for org later) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Virtual folder indistinguishable from a real folder | User tries to "move a file into" a saved query | Visual affordance that it's a saved view (icon/badge), like the global-folder indicator pattern |
| Classification auto-moves documents | Files vanish from where the user put them | Suggest-and-confirm; never silent re-file; reversible + audited |
| Per-field confidence hidden | User over-trusts a guessed `document_type`/`author` | Surface per-field confidence (low = visibly tentative) — it's a v3.0 deliverable, not optional polish |
| Governance metrics mixed into retrieval dashboard | Two audiences confused | Separate governance surface (Pitfall 6) |
| Empty view vs. "results you can't access" both render as empty | User can't tell "no matches" from "no access" | Distinguish "0 matches" from "N hidden by access" without leaking the hidden items' details |

## "Looks Done But Isn't" Checklist

- [ ] **New DM action audited:** Often missing the `audit_log` CHECK-enum migration + `VALID_ACTION_TYPES` sync — verify a real row INSERTs and SELECTs back against the live DB (not mocked).
- [ ] **Shared view scoping:** Often missing per-viewer result resolution — verify two users see different result *sets/counts* for the same shared view definition, with no cross-user leakage.
- [ ] **Filter DSL safety:** Often missing parameterization — verify an injection/SSTI attempt in a filter value is neutralized (no SQL/template execution).
- [ ] **Date-range correctness:** Often missing typed columns — verify "expiring in 90 days" returns correct rows across month/day boundaries (not lexical string compare).
- [ ] **JSONB indexing:** Often missing GIN/typed indexes — verify `EXPLAIN` shows index use (not seq scan) for view queries at ~10k docs.
- [ ] **`org_id` forward-compat:** Often missing on new tables — verify every new DM table has the nullable `org_id` column + re-keyable RLS.
- [ ] **`exclude_none` non-regression:** Verify empty `author` is still *dropped*, not coerced to `""` (it's correct behavior — guard with a test).
- [ ] **Classification is advisory:** Verify upload classification *suggests* (doesn't auto-move) and is reversible + audited.
- [ ] **Cross-provider:** Verify any new agent tool passes the SC#10 4-axis UAT.
- [ ] **Tier B fenced out:** Verify no retention/lock/approval table or scheduled job slipped into v3.0 scope.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Audit enum hole shipped | LOW | Add the missing CHECK value via migration + sync; backfill is impossible (lost rows) — add the boot-time subset assertion to prevent recurrence |
| Cross-user view/relationship leak shipped | HIGH | Treat as a security incident; patch the definer predicate; audit what was exposed; add live leak test to secure-phase |
| Filter DSL injection/SSTI shipped | HIGH | Replace string-compiled path with closed-registry AST; review all stored view definitions for malicious payloads |
| Classification built on un-enriched metadata | MEDIUM | Re-sequence: ship enrichment, re-run classification on enriched metadata; meanwhile keep classification suggest-only so damage is bounded |
| DM tables missing `org_id` | MEDIUM (worse at v3.3) | Add nullable column now via migration (cheap on small data); painful if deferred to v3.3 with large data |
| Date-range view returning wrong rows | MEDIUM | Promote date to typed column + btree; re-run/repair affected saved views; add boundary tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Underestimation | Roadmap + P-FOUND | Each Tier A item budgeted 2–3 phases; per-item vertical checklist in every SPEC |
| 2. Audit enum silent reject | P-FOUND (discipline), enforced in P-VIEWS/P-REL/P-CLASS/P-ENRICH | Live INSERT+SELECT of each new action; boot/CI subset assertion green |
| 3. Cross-user leakage | P-VIEWS + P-REL (P-FOUND discipline) | secure-phase live leak test: two users, different visible sets/counts; 404-not-403 on miss |
| 4. Filter-DSL hazards | P-ENRICH (typed cols/indexes) → P-VIEWS (DSL) | Injection/SSTI neutralized; date-range boundary correctness; `EXPLAIN` index use at 10k docs |
| 5. Classification bounded by metadata | P-ENRICH → P-CLASS (strict order) | Enrichment ships first; classification confidence-aware + suggest-only; `exclude_none` guarded |
| 6. Governance vs retrieval dashboard | P-GOV (separate surface) | No governance data in knowledge-health files; distinct route/queries |
| 7. Multi-tenancy forward-compat | P-FOUND, every table-creating phase | Every new DM table has nullable `org_id` + re-keyable RLS (matches workflow-table precedent) |
| 8. Positioning / Tier B creep | Milestone framing + every SPEC "what this is NOT" | No Tier B tables/jobs in v3.0; each feature anchored to retrieval/deliverable value |

## Sources

- `supabase/full-schema.sql` — audit_log CHECK enum (`:333`), `match_document_chunks`/`keyword_search_chunks` SECURITY DEFINER + `user_id` predicate (`:93,120`), `metadata @> metadata_filter` (`:108,132`), `query_user_documents` SELECT-only guard (`:144`), `folder_is_globally_visible` + global-folder SELECT policy (`:54,2138`), workflow-table `org_id` forward-compat columns + comments (`:455,722,755,779`) — HIGH
- `backend/app/services/audit_service.py` — `VALID_ACTION_TYPES` frozenset (`:13`), fire-and-forget swallowed write (`:38`) — HIGH
- `backend/app/services/retrieval_service.py` — `metadata_filter` lowercased flat dict (`:258`), per-RPC param assembly — HIGH
- `backend/app/services/tool_dispatcher.py` — `_handle_search_documents` metadata_filter pass-through (`:174`), `code.execute` audit write — HIGH
- `.planning/seeds/SEED-005-document-management-capabilities.md` — Tier A scope, "Why this is large despite just basics," "Known intersection with current debt," `exclude_none` non-regression, enrichment workstreams — HIGH
- `.planning/seeds/SEED-004-org-multi-tenancy.md` — v3.3 tenancy, "land DM single-tenant first then extend," audit-every-DEFINER-RPC — HIGH
- `.planning/PROJECT.md` — v3.0 goal/scope, locked order enrichment→views→relationships→classification, D-102 (validate live not statically), D-v2.6-04 (opt-in reextract, 404-not-403), SC#10 4-axis UAT, G-5/G-6 guardrails — HIGH
- [PostgreSQL JSONB Performance Guide: Indexing & Query Optimization (SitePoint)](https://www.sitepoint.com/postgresql-jsonb-query-performance-indexing/) — MEDIUM
- [PostgreSQL JSONB GIN Indexes: Why Your Queries Are Slow (DEV)](https://dev.to/polliog/postgresql-jsonb-gin-indexes-why-your-queries-are-slow-and-how-to-fix-them-12a0) — MEDIUM (GIN doesn't speed `->>`/range; typed btree wins for ranges)
- [Indexing JSONB in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/indexing-jsonb-in-postgres) — MEDIUM
- [Metadata Visibility Configuration — SQL Server (Microsoft Learn)](https://learn.microsoft.com/en-us/sql/relational-databases/security/metadata-visibility-configuration) — MEDIUM (metadata-disclosure-as-defense-in-depth)
- [The Metadata Minefield (Symmetry Systems)](https://www.symmetry-systems.com/blog/the-metadata-minefield-protecting-all-your-sensitive-data/) — LOW (metadata can expose as much as content)

---
*Pitfalls research for: v3.0 Document Management (M-Files-aligned Tier A on a single-tenant RAG platform)*
*Researched: 2026-06-15*
