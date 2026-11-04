---
phase: 304-personal-mcp-keys-that-act-as-you
verified: 2026-10-31T00:00:00Z
status: passed
score: 5/5 success criteria verified (6/6 requirements KEY-01..06)
verification_mode: self-verified
independent_review: self
overrides_applied: 0
---

# Phase 304: Personal MCP Keys That Act as You — Verification Report

**Goal:** A member can mint a personal MCP key that acts as them inside one org, narrow it, see last use and revoke it; an org admin and the operator can switch MCP off; proven at the credential and data layer.
**Verified against:** develop HEAD `bb6ebc2f0`. **Re-verification:** No.

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Two-org non-owner parity through the acting-member RLS connection; membership removal refuses | VERIFIED | `supabase/migrations/221_acting_org_narrowing.sql` narrows `current_user_org_ids()` by the `app.acting_org_id` GUC (AND on org_members, same function attributes). `app/dependencies.py:163-165` sets the GUC only when the acting-org contextvar is set. `principal_liveness.py` refuses `not_member`. Re-ran `test_304_two_org_parity_live`, `test_304_narrowed_key_live`, `test_304_acting_org_rls_live` plus all `tests/unit/test_304_*`: **251 passed, 0 skipped**. EXPLAIN gate evidence in `evidence/explain-acting-org.txt` (GATE PASSED). |
| 2 | Create key, see secret once; defaults read-only + expiry; connector folders unticked; snippets read env var; Claude.ai warning; Desktop bridge labelled workaround | VERIFIED | Mig 220 CHECKs (`api_keys_mcp_expiry_check`, `api_keys_tools_check`). `mcpSnippets.ts:25` `SYREL_MCP_KEY`; `mcpKeyCopy.ts:97-128` bridge labelled "A developer workaround until…" and the "Don't paste this key into Claude.ai's organisation connector settings" warning. G-4 row 1 PASS with DOM + DB evidence (VALIDATION §2.1). Frontend `apiKeys` + `org` suites re-run: 29 files, 415 passed. |
| 3 | Narrow to folders (subfolders) and tools; empty folder set refused; narrowing only removes | VERIFIED | `api_keys.py:469-474` foreign-folder refusal; empty set refused server-side (422, `test_304_api_keys_routes`) and in UI (G-4 row 2 PASS, 422 body captured). Per-read-path narrowed-key arms in `test_304_narrowed_key_live` (passed in the run above); `test_304_acting_reads_fence` passed. |
| 4 | Last use, revoke; revoked/expired/owner left/banned refused on next resolution with the same refusal | VERIFIED | `principal_liveness.principal_still_allowed` checks revoke, expiry, membership, ban live with no cache; `recheck_principal` re-reads by id. `test_304_principal_liveness.py` and `test_304_resolver_kind.py` pass. `ApiKeyCard`/`RevokeApiKeySheet` tests pass. |
| 5 | Org admin list/revoke + org switch; operator deployment switch; next-call effect; workflow key never authenticates as MCP; MCP key never authenticates `/inbound` | VERIFIED | `principal_liveness.py:77-85` reads both switches live (fail closed, deployment first). `api_key_auth.py:352,369` kind-scoped digest plus row-kind check; `test_an_mcp_secret_at_the_inbound_door_is_the_one_401_and_never_reaches_the_db` passes. One resolver only: `authenticate_presented_key` (`api_key_auth.py:342`), consumed by `mcp_principal.py` and the `/inbound` wrapper. `test_304_mcp_switches_routes` passes. G-4 row 3 PASS (audit row `settings.update`, `metadata.event=mcp_access`; `mcp_enabled` flipped and restored). |

## "How we'd know this failed" checks

- Service-role reads re-implementing visibility: none found; reads go through the acting-member connection (fence test passes).
- Org narrowing initPlan shape: EXPLAIN gate A==B for 12 statements, loops=1.
- Backend baseline: recorded 70 <= 71 (VALIDATION §4). Observation: one post-fix run read 75 with 5 flaky extras (test_272_knowledge_health x4, test_email_ingestion), shown unrelated by isolated re-run; recorded here as an observation, not a gap.
- Empty folder set meaning "no filter": refused at both layers.
- Second key resolver: none (single `authenticate_presented_key`).
- Secret shown twice or stored unhashed: `key_hash` only; G-4 row 1 DOM shows secret absent after reload.
- Snippet puts key in URL: snippets use `Bearer ${SYREL_MCP_KEY}`.

## Requirements coverage

| Req | Status |
|-----|--------|
| KEY-01 | SATISFIED |
| KEY-02 | SATISFIED |
| KEY-03 | SATISFIED |
| KEY-04 | SATISFIED |
| KEY-05 | SATISFIED |
| KEY-06 | SATISFIED |

No orphaned requirements (all six map to Phase 304 and are claimed by plans).

## Anti-patterns

None blocking found in the verified files. Review WR-01..04 were fixed test-first and merged (`bb6ebc2f0`).

## Human verification

None required. G-4 rows 1-3 were driven in Chrome by Claude on 2026-10-31; screenshots timed out on a hidden tab, so DOM reads plus DB rows are the evidence (accepted under the self-verified mode).

## Owed before deploy (not phase gaps)

1. Cloud paste of migrations 220 and 221 with per-action operator approval, then `get_advisors(security)` read before the push. Deploys with Phase 305 (D-30). The schema-drift gate "blocking" is expected: it assumes `supabase db push`, which this project forbids.
2. D-41: operator confirms that an MCP key carrying no `workflows` tier gate is intended (TIER-02 pricing one-way door).
3. BUG-261031-01: reproduce the anon-role `current_user_org_ids()` backend crash on a disposable Postgres. Never on the shared local stack, never on production.

## Gaps

None.

---
_Verified: 2026-10-31 · Verifier: Claude (gsd-verifier), self-verified_
