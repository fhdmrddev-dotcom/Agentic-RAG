---
phase: 164
slug: secdef-audit-cross-org-isolation-test-suite
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-20
---

# Phase 164 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> v3.4 multi-tenancy cross-org isolation exit-gate phase. Register authored at plan time
> (four PLAN `<threat_model>` blocks, duplicate IDs merged) — every declared mitigation was
> independently re-verified against the source AND the live :54322 DB, not accepted on intent.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated caller (user B) → DEFINER function body | caller-supplied `match_user_id` param + `X-Org-Id` header are untrusted; org must be server-derived from `current_user_org_ids()`/`auth.uid()`, never a caller arg | document chunks, skills, folder-visibility (cross-org PII) |
| postgres-owned DEFINER execution → resolved objects (tables/operators) | attacker-controlled `search_path` could shadow a called object/operator (CVE-2018-1058) | schema resolution of every relation + the pgvector `<=>` operator |
| detached producer (service-role by default) → retrieval RPCs / INVOKER `query_user_documents` | the identity seam: unless the DB call carries the caller's uid, org scoping is inert (0-for-everyone) or bypassed (BYPASSRLS full leak) | vector/keyword retrieval, text-to-SQL, grep content search |
| arbitrary text-to-SQL string → INVOKER `query_user_documents` EXECUTE | untrusted SELECT text; RLS under role `authenticated` is the primary boundary after the security regex is deleted | any base-table read reachable from the crafted SELECT |
| DB row (RLS-visible global/system content) → serialized API response | RLS grants row visibility but cannot mask a column; the seeding owner's `user_id` (+ view scope UUID) leaks unless the serialize step nulls it | seeding owner identity of shared folders/skills/views |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-164-EoP-01 | Elevation of Privilege | `match_document_chunks` / `keyword_search_chunks` / `match_skills` trusting spoofed `match_user_id`; producer on service-role returning 0-for-everyone | mitigate | In-body `org_id = ANY(SELECT public.current_user_org_ids())` + owner branch on `auth.uid()` (never `match_user_id`); no `match_org_id` param added (D-164-01). Producer RPCs routed onto the asyncpg user-context. Verified: migration 110 §1 L93/L95, §2 L133/L135, §3 L175/L176; `retrieval_service.py:37,50,89` (`_call_as_user` + `$1::public.vector`); `agent_loop.py:1317-1320` (`match_skills` via `_call_as_user`). Live: `pg_proc` all four DEFINER, policy carries org gate. | closed |
| T-164-EoP-02 | Elevation / Tampering | `search_path` hijack inside a postgres-owned DEFINER fn (CVE-2018-1058) | mitigate | `SET search_path = ''` + schema-qualified refs + `OPERATOR(public.<=>)` on all four fns. Verified: migration 110 L85/L122/L161/L192 (`search_path=''`), L90/L98/L103/L167 (`OPERATOR(public.<=>)`). Live: `pg_proc.proconfig = ['search_path=""']` on all four. | closed |
| T-164-Spoof-07 | Spoofing / EoP | `X-Org-Id` header used to widen access | mitigate | Header inert (no reader in `backend/`); org derives only from membership via `current_user_org_ids()`. Verified: `test_v3_4_org_isolation.py:430-463` `test_org_header_spoof_does_not_widen` asserts A's org absent from B's org set and 0 A-rows on a B-scoped read. | closed |
| T-164-Avail-06 | Availability | `is_system` platform content trapped inside the org gate (would break built-in skill-creator universally) | mitigate | `is_system` branch hoisted OUTSIDE the org gate in `match_skills` (mig 109 FIX-A shape). Verified: migration 110 §3 L174 `WHERE ((s.is_system = true) OR (s.org_id = ANY(...) AND ...))`; guard test `test_is_system_stays_universal` at `test_v3_4_org_isolation.py:635`. | closed |
| T-164-ID-03 | Information Disclosure | INVOKER `query_user_documents` run on the producer's BYPASSRLS service-role after the security regex is deleted | mitigate | Text-to-SQL/grep DB path routed onto the asyncpg user-context (RLS enforced) in the SAME change; `_inject_user_id` / `_inject_user_id_for_grep` deleted only after. Verified: no `def _inject_user_id*` remains anywhere; `sql_service.py:96-97` (`get_user_pg_connection` → `query_user_documents`); `kb.py:269-270` (same seam). SELECT-only + no-`;` guard retained (`sql_service.py:83`). | closed |
| T-164-ID-05 | Information Disclosure | folders/skills/views list serializers exposing the seeding owner's `user_id` (+ view scope UUID) to non-owner readers | mitigate | Serialize-time null via one shared `_null_foreign_global_owner` rule (`is_global OR is_system` AND not-owner). Verified: `folder_utils.py:37-52` (helper); `skills.py:219-222` (inline); `document_view_service.py:112-114` (nulls `user_id` AND `folder_scope`); wired at `folders.py:20,34` + `kb.py:118`. Unit-proved in `test_seed091_owner_nulling.py`. **Residual WR-01** (non-global descendant path) transferred → Phase 165 (see Accepted Risks Log). | closed |
| T-164-ID-08 | Information Disclosure | shared-folder document read returning empty chunks (owner-only chunk RLS too narrow) | mitigate | `document_chunks` SELECT RLS widened (additive) to mirror the documents folder-visibility EXISTS. Verified: migration 110 §5 L215-222; live policy `(org_id IN (SELECT current_user_org_ids())) AND ((auth.uid()=user_id) OR EXISTS(...folder_is_globally_visible...))`. | closed |
| T-164-DoS-04 | Denial of Service (self) | token expiry mid-run silently degrading retrieval to 0 rows | mitigate | uid-synthesized asyncpg claims (no token) via `get_user_pg_connection` — request JWT never carried into the producer (163 red line). Verified: `retrieval_service.py:37-50` opens `get_user_pg_connection(None, {"id": user_id})`; no request-JWT supabase client constructed in the producer path. | closed |
| T-164-SC | Tampering | npm/pip/cargo installs (supply chain) | accept (N/A) | No package installs this phase (RESEARCH Package Legitimacy Audit = N/A). Recorded in Accepted Risks Log. | closed |
| CR-01 | Information Disclosure | Cross-org leak via the agent's KB browse/read tools (`ls`/`tree`/`glob`/`read_document`) — `folder_utils.py` service-role helpers (`fetch_visible_folders`, `get_globally_visible_folder_ids`, `is_in_global_subtree`) have no org predicate on the BYPASSRLS producer path | transfer | New surface found by the Phase-164 deep review (adjacent to T-164-ID-08 but on the browse-tool path, not retrieval). Operator-folded to Phase 165 / SEED-124. Tracking control VERIFIED PRESENT: `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` at `test_v3_4_org_isolation.py:867-902` is `@pytest.mark.xfail(strict=True)` — FAILS→XFAIL while the leak is live, XPASSes→strict-xfail-failure once Phase 165 org-scopes the helpers, forcing removal. See Accepted Risks Log. | transferred (Phase 165) |
| WR-01 | Information Disclosure | Sub-gap of T-164-ID-05: `_null_foreign_global_owner` nulls the owner only when the row itself is `is_global`/`is_system`, so a non-global DESCENDANT of a shared folder still returns the seeding owner's real UUID | transfer | The direct `is_global`/`is_system` row path IS closed and unit-proved; only the descendant path leaks. Operator-folded to Phase 165 / SEED-124 (same fixing phase). See Accepted Risks Log. | transferred (Phase 165) |

*Status: open · closed · transferred*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party / deferred phase)*

**In-phase fix note — WR-02 (not a cross-org leak):** the deep review flagged that `_inject_folder_scope` produced invalid SQL after `_inject_user_id` deletion (WHERE spliced after a trailing `ORDER BY`/`LIMIT`). This was FIXED in-phase (Plan 164-05, commit `e8eb85a9`) and re-verified here: `sql_service.py:30-64` now splices the folder condition BEFORE the first trailing `order by|group by|having|limit|offset` boundary (L59-64). RLS via the user-context connection always owned cross-org isolation; WR-02 was a Phase-098 GOV-01 folder-containment correctness bug within T-164-ID-03's family, not a disclosure. Status: CLOSED in-phase.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| ACC-164-SC | T-164-SC | No npm/pip/cargo installs in this phase (RESEARCH Package Legitimacy Audit = N/A) — no supply-chain surface introduced. | operator | 2026-07-20 |
| ACC-164-CR01 | CR-01 | Cross-org leak via the agent's KB browse/read tools (`folder_utils.py` service-role helpers are org-blind) folded to **Phase 165 (is_global retirement / SEED-124)**. Re-open trigger: the `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` `xfail(strict=True)` marker XPASSes (leak closed) → strict-xfail failure forces the marker's removal and closes SEED-124. Marker verified present at `test_v3_4_org_isolation.py:867-902`. | operator | 2026-07-20 |
| ACC-164-WR01 | WR-01 (sub-gap of T-164-ID-05) | Non-global descendant of a shared folder still returns the seeding owner's UUID; the direct `is_global`/`is_system` row path is closed + unit-proved. Folded to **Phase 165 (is_global retirement / SEED-124)**. Re-open trigger: same SEED-124 fixing phase / `xfail(strict)` marker XPASS. | operator | 2026-07-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-20 | 11 | 9 mitigate/accept CLOSED + 2 transferred | 0 | gsd-security-auditor |

*Verification method: independent grep/read of cited source + live `pg_proc`/`pg_policy` introspection on :54322 (migration 110 confirmed applied: all four fns `prosecdef=true` + `search_path=""`; `document_chunks` SELECT policy carries the org gate + folder-visibility EXISTS). Exit-gate suite `test_v3_4_org_isolation.py` operationally GREEN (22 pass / 1 xfail — the SEED-124 known-open marker).*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (T-164-SC, CR-01, WR-01)
- [x] `threats_open: 0` confirmed (8 mitigate CLOSED + 1 accept CLOSED + 2 operator-transferred to Phase 165 with a live re-open trigger)
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-20
