# Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 164-secdef-audit-cross-org-isolation-test-suite
**Mode:** `--auto` (operator ran unattended: "discuss it, decide the best option, then proceed to planning then execution"). Claude auto-selected the recommended option for every gray area against three live code/DB scouts + the Phase 163 hand-off. Options + rationale logged below for operator review.
**Areas discussed:** SECDEF org-predicate derivation, DEFINER-vs-INVOKER posture, `_inject_user_id` deletion safety, SEED-091 owner-nulling, isolation-suite depth, PRAG-01 RLS widening

---

## SECDEF org-predicate derivation

| Option | Description | Selected |
|--------|-------------|----------|
| In-body `current_user_org_ids()` | Filter `org_id = ANY(current_user_org_ids())` inside each DEFINER body; resolves via `auth.uid()` off the JWT-claims GUC that 163 set on the user-JWT connection | ✓ |
| Explicit `match_org_id` param | App passes the active org id as a new RPC argument alongside `match_user_id` | |

**Auto choice:** In-body `current_user_org_ids()` (D-164-01).
**Notes:** Explicit param rejected — redundant (membership is server-derivable), spoofable by an app-layer bug (a wrong value = silent cross-org read), inconsistent with the mig-108 RLS model. Load-bearing coupling: works only if the RPC runs on the user-JWT connection → D-164-02 routes the 3 retrieval RPCs (`retrieval_service.py:65,87` + `match_skills`) through the user-JWT client, which 163-07 explicitly deferred to 164. Fail-closed: wrong connection → `auth.uid()` NULL → 0 rows.

---

## DEFINER-vs-INVOKER posture for the 4 functions

| Option | Description | Selected |
|--------|-------------|----------|
| Keep DEFINER + in-body predicate + pinned search_path | Per ROADMAP SC#1 / TEN-03 verbatim; audit = recorded per-function justification | ✓ |
| Flip all 4 to SECURITY INVOKER | Let base-table RLS do isolation; drop the in-body predicate | |

**Auto choice:** Keep DEFINER (D-164-03).
**Notes:** INVOKER flip rejected — bigger behavioral change + pgvector index-scan perf risk under CONCUR-01, and the roadmap already locked DEFINER+predicate. The in-body predicate becomes the isolation guard; the pinned `search_path` closes the DEFINER search-path-hijack class (bodies fully schema-qualified). Contrast: `query_user_documents` is *already* INVOKER → it correctly relies on RLS with no conversion (D-164-04).

---

## `_inject_user_id` deletion safety

| Option | Description | Selected |
|--------|-------------|----------|
| Delete both regex injectors, rely on RLS via user-JWT client | `query_user_documents` is INVOKER → runs text-to-SQL under caller's role; RLS auto-scopes | ✓ |
| Extend the regex to also inject `org_id` | Keep the fragile pattern, add an org clause | |

**Auto choice:** Delete (D-164-04).
**Notes:** Live-verified `query_user_documents` is `LANGUAGE plpgsql` with no SECURITY clause → INVOKER. Deleting is safe *only* if its callers (`sql_service.py:106`, `kb.py:263`) run on the user-JWT client — verify/swap. The isolation suite must prove text-to-SQL + grep cannot cross orgs (red-then-green). Extending the regex rejected — TEN-03 says "deleted, not extended"; regex-scoping arbitrary SQL is exactly the fragile bypass class the milestone closes.

---

## SEED-091 / TEN-06 owner-identity nulling

| Option | Description | Selected |
|--------|-------------|----------|
| Null `user_id` (+ scope UUIDs) on non-owned global rows, uniform across folders/skills/views | SEED-091's minimal fix; loosen `FolderResponse.user_id`/`SkillResponse.user_id` to nullable | ✓ |
| Org-aware nulling (only cross-org/system-global) | Keep owner identity for same-org shared rows | |

**Auto choice:** Uniform null-on-non-owner-global (D-164-05).
**Notes:** Uniform is simpler and forward-safe — covers today's system-global leak (skill-creator owner) AND the later org-shared case with no org-branch. `ViewResponse.user_id` already `str | None`; loosen folder + skill models. Flag the frontend null-owner tolerance check for the plan.

---

## Isolation-suite depth + PRAG-01

| Option | Description | Selected |
|--------|-------------|----------|
| Exhaustive matrix over a table registry (~38 tables) × 2 orgs × both paths × 4 fns × spoof + live PRAG-01 retrieval | Extends `test_163_factories.py`; it's the milestone exit gate | ✓ |
| Representative-cluster sampling | Test one table per RLS cluster | |

**Auto choice:** Exhaustive (D-164-06) + additive `document_chunks` folder-visibility RLS widening for PRAG-01 (D-164-07).
**Notes:** Sampling rejected — it's the milestone exit gate ("every user-facing table"); a data-driven loop is cheap and catches the forgotten table. Must red-against-pre-164 then green. PRAG-01: widen `document_chunks` SELECT to mirror the full folder-visibility predicate (additive on mig-108 baseline), re-benchmark CONCUR-01 <1s.

---

## Claude's Discretion
- Exact `search_path` pin form (`pg_catalog, public` vs `''`+fully-qualified).
- Test-file organization (single parametrized module vs a `test_163_rls_*`-style split) — must expose one named `test_v3_4_org_isolation.py` exit gate.
- Whether `match_skills` client-swap shares the document-RPC helper or its own seam.

## Deferred Ideas
- Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters → later hardening pass (163-D-14).
- Permission-aware *citations* (PRAG-02) → STRETCH Phase 171.
- `X-Org-Id` narrowing UI + `<OrgContext>` switcher → Phase 166.
- `is_global`→`is_org_shared` + `is_system_global` allow-list rename → Phase 165.
- Chat-surface reported-bug backlog → post-v3.3 chat-polish phase (no overlap with 164's domain; SEED-091 is the only fold).
