# Phase 110: DM Foundations - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the **shared backend substrate** for all of v3.0 Document Management, once and cleanly — so no later phase (111–119) fights schema drift, silently drops an audit row, or has to re-touch the closed audit CHECK enum.

**In scope (DMF-01, DMF-02, DMF-03):**
- 4 new tables — `document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions` — with RLS enabled, each carrying a nullable `org_id uuid` (no FK) and the re-keyable `auth.uid() = user_id OR is_global` policy shape (mirrors the `workflow_definitions` precedent).
- Extend the `audit_log.action_type` closed CHECK enum + sync `VALID_ACTION_TYPES` (`audit_service.py:13`) in the **same** phase; regenerate `full-schema.sql` (no reset).
- A drift guard (boot **and** CI) that fails loudly if `VALID_ACTION_TYPES` is not a subset of the live DB CHECK enum.
- A live (not mocked) INSERT+SELECT round-trip of a real audit row for each new action type against the local DB.
- One DM capability flag in `app_settings` (default **on**) + a read-helper — the feature-independence seam a future entitlement/tier system (SEED-080, v3.2) plugs into.

**Out of scope (NOT this phase):**
- Any user-visible behavior, route, tool, or UI — those belong to 111–119. 110 is pure substrate; the flag gates nothing yet (no surfaces exist) so it is a no-op defaulting on → behavior unchanged.
- Entitlement *enforcement* (the flag is only the seam; SEED-080 enforcement is v3.2).
- The metadata-enrichment ingestion change (Phase 111) — it is reversible via its OWN knob, deliberately NOT entangled with this master flag (see D-110-2).

</domain>

<decisions>
## Implementation Decisions

### D-110-1 — Audit action types: land the FULL DM set now (8)
Bake all 8 DM audit action types into the CHECK enum **and** `VALID_ACTION_TYPES` in this phase, not just the SC-required minimum 4. Extending a closed CHECK is the exact friction Foundations exists to remove — do it once.

The 8 (exact strings, dot-namespaced to match the existing convention):
1. `view.create`            *(SC-required)*
2. `view.delete`
3. `relationship.create`    *(SC-required)*
4. `relationship.delete`
5. `classification.apply`   *(SC-required)*
6. `classification.rule.create`
7. `metadata.update`        *(SC-required)*
8. `metadata.field.create`

This takes the live CHECK from 11 → 19 total action types. The enum stays **additively** extensible if 111–119 surfaces a genuine 9th need (e.g. `view.update`) — landing 8 now just means none of the planned surfaces is *forced* to re-migrate the closed constraint.

### D-110-2 — Capability flag gates net-new SURFACES + TOOLS only (not enrichment)
One master `app_settings` boolean flag, default **on**, gates the net-new DM surfaces/tools (views, relationships, classification, governance) shipped in 113–119. Phase 111's metadata-enrichment change (un-pin model, lift the 3k window, custom fields, per-field confidence) is a **modification to an existing working ingestion path** and stays reversible via its OWN setting/default — deliberately NOT behind this master flag, so toggling DM "off" cleanly hides surfaces without entangling the hot ingestion path or risking a Deep/agent-loop regression.

In Phase 110 the flag is only **defined + a read-helper landed**; nothing observable is gated yet (no surfaces exist). Default-on → byte-identical behavior when unset.

- **Flag name (Claude's discretion, recommended):** `document_management_enabled` in `app_settings`. Planner finalizes the exact key + read-helper location against the existing `app_settings` access pattern.

### D-110-3 — Tables ship with their FULL known column set now
Create each of the 4 tables with every column the architecture research already specified (ARCHITECTURE.md per-feature DDL) — so 111–119 add *behavior*, not schema migrations. Concretely:
- `document_views`: `name`, `filter_expr jsonb`, `folder_scope uuid` (FK folders ON DELETE SET NULL), `is_global`, timestamps.
- `document_relationships`: `source_doc_id`/`target_doc_id` (FK documents ON DELETE CASCADE), `rel_type` with the closed CHECK `supersedes|amends|references|attached_to`, `CONSTRAINT no_self_rel`, timestamps.
- `classification_rules`: `name`, `match_expr jsonb`, `suggest_folder_id uuid` (FK folders), `is_global`, `enabled`, timestamps.
- `metadata_field_definitions`: `field_key`, `field_type` (default `string`), `description`, `is_global`, `enabled`, timestamps.
- **Every** table: `id uuid PK`, `user_id uuid` (FK auth.users ON DELETE CASCADE; nullable only on `metadata_field_definitions` where NULL = global/admin field per research), **nullable `org_id uuid` (no FK)**, RLS enabled.
A later phase may still `ALTER` if a genuinely new need emerges — this decision just front-loads the columns the design already knows it needs.

### D-110-4 — Drift guard fails at BOTH boot and CI
The `VALID_ACTION_TYPES ⊆ live-DB CHECK enum` assertion fires in two places:
- **Boot:** a lifespan startup assertion (hard-fail, mirroring the 075.4 `UnknownProviderError`-at-startup pattern). `main.py` already runs Phase-081.1 startup checks "after asyncpg pool init" (`main.py:~115`, lifespan at `:206`) — that's the home. Turns a silent prod `23514` reject into a loud boot failure.
- **CI:** a test that asserts the same subset relationship — catches drift before deploy, never depends on a restart to surface it.
There is no existing boot-time subset assertion today (scouting confirmed) — this is genuinely net-new. The harness `_AUDIT_EVENT_TYPES` runtime guard (`db/workflows.py:730`) is a separate frozenset and not a precedent to reuse directly.

### Claude's Discretion
- Exact flag key name + read-helper placement (recommend `document_management_enabled`).
- Single migration file (`071_dm_foundations.sql` covering all 4 tables + audit-enum DROP/ADD + `org_id` columns) vs splitting — recommend **one** numbered migration (`071_…`; next free number is 071, highest applied is 070). The capability flag default can ride the same migration (seed the `app_settings` row) or live as a code default — planner decides.
- Whether to add a btree index on `org_id` now (cheap forward-compat) — recommend yes, but non-blocking.
- The 4 tables themselves carry **no** new audit types for their own CRUD beyond the 8 in D-110-1; if the planner finds a table whose creation should be audited and isn't covered, extend additively.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 110: DM Foundations" — the 5 success criteria (verbatim acceptance bar).
- `.planning/REQUIREMENTS.md` — DMF-01 (audit), DMF-02 (RLS + nullable `org_id`), DMF-03 (capability flag).

### Architecture / research (HIGH confidence, file:line-cited)
- `.planning/research/v3.0-document-management/ARCHITECTURE.md` — per-feature **DDL for all 4 tables** (§1–4), the load-bearing RLS / `SECURITY DEFINER` finding, and §"The closed `audit_log` CHECK enum — migration requirement" (the two-place-sync discipline). **The DDL here is the source for D-110-3.**
- `.planning/research/v3.0-document-management/SUMMARY.md` — build order, Pitfall 2 (closed CHECK silent-reject), Pitfall 7 (`org_id` forward-compat).
- `.planning/research/v3.0-document-management/PITFALLS.md` — full pitfall detail.
- `.planning/research/v3.0-document-management/STACK.md` — near-zero-new-deps confirmation.

### Code precedents to mirror (verify file:line at plan time — line numbers drift)
- `backend/app/services/audit_service.py:13-39` — `VALID_ACTION_TYPES` frozenset + the **swallow-on-error** `write_audit_entry` (why a missing CHECK type fails *silently*). Extend the frozenset here in lockstep with the migration.
- `supabase/full-schema.sql:333` — current `audit_log_action_type_check` CHECK (11 types). `:1898` — audit_log INSERT-only policy (no SELECT RLS). `:54-70` — `folder_is_globally_visible()`. `:2110-2152` / `:2138` — RLS precedents (skills / `workflow_definitions` / documents) to mirror for the new tables.
- `backend/app/db/workflows.py:45,730` — the harness `_AUDIT_EVENT_TYPES` frozenset + its runtime `ValueError` guard (a *separate* sync pair; the lockstep pattern to imitate, not reuse).
- `backend/app/main.py:~115,206` — `lifespan` + the Phase-081.1 "after asyncpg pool init" startup-check block: the home for the D-110-4 boot assertion.
- `CLAUDE.md` §"Schema changes ship as numbered SQL migrations" — apply migration `071_…` by **pasting into the Supabase SQL editor** (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit both.

### Forward-compat seam
- `.planning/seeds/SEED-080-entitlement-feature-gating-primitive.md` — the entitlement/tier system the DMF-03 flag is the seam for (enforcement at v3.2 Operator UX; **none built here**).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets / patterns to mirror
- **Audit lockstep pattern:** `audit_service.py` frozenset ⇄ `full-schema.sql` CHECK. Two-place sync is mandatory; `write_audit_entry` swallows the constraint violation, so an out-of-sync type fails *silently* (the D-102 "static would false-green" trap → SC#4 demands a LIVE INSERT+SELECT).
- **RLS shape:** `workflow_definitions` / `skills` precedent — `auth.uid() = user_id OR is_global` SELECT; `auth.uid() = user_id` for INSERT/UPDATE/DELETE; global INSERT forced `is_global = false` for non-admin.
- **Startup hard-fail:** the 075.4 `UnknownProviderError`-at-lifespan pattern + the Phase-081.1 post-pool-init check block in `main.py` — the model for D-110-4's boot assertion.
- **Migration discipline:** numbered `NNN_name.sql` (next = `071`), SQL-editor apply, `regenerate-full-schema.sh` no-reset, commit migration + regenerated `full-schema.sql` together.

### Established patterns / constraints
- `documents.metadata` is JSONB with a `@>` containment pre-filter and a `documents_metadata_gin_idx` — **do not** restructure metadata into `{value, confidence}` tuples (breaks containment). (Not a 110 change, but the substrate that 111+ build on — keep tables compatible.)
- BackgroundTasks (`ingest_document`) run without `auth.uid()` — any future read of these new tables in a background context must be explicitly `user_id`-scoped in app code (relevant to 111/118, flagged here so the table design supports it).

### Integration Points
- `app_settings` — where the DM capability flag lives (D-110-2); planner confirms the existing read pattern.
- `main.py` lifespan — boot drift-guard insertion point (D-110-4).
- Audit subsystem (`audit_service.py` + `audit_log` CHECK) — the enum extension touchpoint (D-110-1).

</code_context>

<specifics>
## Specific Ideas

- The 8 audit action-type strings in D-110-1 are the locked vocabulary — downstream phases (112 `metadata.update`, 116 `relationship.create/delete`, 118 `classification.apply` + `classification.rule.create`, 111 `metadata.field.create`, 113/114 `view.create/delete`) consume them as-is. Do not invent new variants without an additive CHECK extension.
- SC#4 acceptance is **live**: a real audit row for each of the 8 must INSERT + SELECT back against the local Supabase DB (:54322) — psycopg2-direct or supabase-py, NOT a mock. This is the single most important verification gate for the phase (per the D-102 lesson).
- This phase has **no UI** → no G-2 sketch. (The first sketch in v3.0 fires at Phase 112.)

</specifics>

<deferred>
## Deferred Ideas

- Entitlement/tier **enforcement** on the capability flag → SEED-080, v3.2 Operator UX. 110 ships only the seam.
- Real multi-tenancy / org-scoped RLS → v3.3. 110 ships only the nullable `org_id` column + a re-keyable policy shape.
- Auditing the *creation* of views/rules/fields beyond the 8 types (e.g. `view.update`, `classification.rule.delete`) — additively extensible later if a surface genuinely needs it; not pre-landed.

*No scope creep surfaced — discussion stayed within the substrate boundary.*

</deferred>

---

*Phase: 110-dm-foundations*
*Context gathered: 2026-06-15*
