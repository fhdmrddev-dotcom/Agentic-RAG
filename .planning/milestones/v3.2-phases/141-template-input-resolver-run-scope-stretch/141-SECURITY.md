---
phase: 141
slug: template-input-resolver-run-scope-stretch
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-07
---

# Phase 141 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> COLL-02 — a `template_input` template claimed by one run's context must not be resolvable by a foreign run's context (workflow→Deep, Deep→workflow, W1→W2 blocked), while same-mode reuse (Deep→Deep, same-workflow-run) is preserved.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| model → render_template tool args | Untrusted model input crosses here; the run-lineage claim MUST NOT be derived from tool args | tool arguments (untrusted) |
| run-context → resolver | The new authorization boundary: workflow-run W vs Deep vs W1/W2 — a foreign lineage must be invisible | ephemeral `template_input` bytes + `run_claim` lineage |
| resolver → agent context (error relay) | The failure string crosses back to the model/user; must not carry foreign bytes/ids | error relay string |
| migration author → live DB schema | A tampered/copy-pasted migration (NOT NULL/DEFAULT) permanently alters access-control for every legacy row | schema DDL |
| local schema → cloud schema | Cloud drifts from local — 092 must be applied to cloud by hand at deploy or the resolver leaks on prod | schema parity |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-141-01 | Information Disclosure | resolve_template_source Branch 2 WHERE | mitigate | Claim predicate `AND (run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)` — `template_asset_service.py:213`, `own_claim` bound `$3` :219; symmetric via `DEEP_CLAIM="deep"` (:87) + `own_claim_for_ctx` (:117); `claim_visible` mirror :229-234. Live-DB predicate proven to block foreign rows. | closed |
| T-141-02 | Tampering | own-claim derivation (all 3 callers) | mitigate | Server-derived, never from tool args: `tool_dispatcher.py:2056/2063` `own_claim_for_ctx(ctx)`; `phase_types.py:1100/1119/1126` `str(getattr(ctx,"run_id",None))`; emit re-dispatch reads `_ProducerStreamCtx.workflow_run_id` (:1052). | closed |
| T-141-03 | Elevation / Information Disclosure | claim-stamp race | mitigate | Conditional `UPDATE ... WHERE id=$2 AND run_claim IS NULL` (`template_asset_service.py:298`) + rowcount recheck :305 + re-SELECT :306-309 + `claim_visible` recheck → `_foreign_error()` never bytes :311-312. `test_resolver_claim_race_falls_through` green. | closed |
| T-141-04 | Information Disclosure | claim_visible truth table + scope-widen regression | mitigate | 5-direction truth-table tests pin all directions; `thread_id=$1` + `created_by=$2` preserved in every Branch-2 query — main SELECT :209-210, foreign probe :245-246, expired probe :269-270. `test_where_preserves_user_and_thread_scope` green. | closed |
| T-141-05 | Information Disclosure | honest foreign-claim error | mitigate | `_foreign_error()` :194-202 returns `bytes=None`/`filename=None`, names the condition only; foreign probe SELECTs `id` only (:244) and never reads it — no foreign id/filename/bytes leak. | closed |
| T-141-06 | Tampering / DoS | migration 092 run_claim column | mitigate | `092:42-43` `ADD COLUMN IF NOT EXISTS run_claim text` — nullable, no DEFAULT, no backfill, no NOT NULL (Pitfall 3 divergence from 076). `test_migration_092_additive_nullable` green. | closed |
| T-141-07 | DoS / Tampering | migration apply mechanism | mitigate | Applied by hand via psycopg2 :54322 (never db push/reset); live check `('YES','text',None)`; blocking operator checkpoint approved; dev data intact (threads=513/messages=1162/workspace_files=53). | closed |
| T-141-08 | Information Disclosure | Landmine 2 — emit render mis-claims 'deep' | mitigate | `_ProducerStreamCtx.__init__` stamps `self.workflow_run_id = getattr(inner,"run_id",None)` (`phase_types.py:1052`); `test_emit_ctx_carries_workflow_lineage` asserts `str(W)`, never `'deep'`. | closed |
| T-141-09 | Information Disclosure | cloud schema drift | mitigate | Cloud-parity note recorded (`141-03-SUMMARY.md`); `092` confirmed present in `scripts/pending-cloud-migrations.sh` output for by-hand deploy apply. | closed |
| T-141-SC | Tampering (supply chain) | package installs | accept | No npm/pip/cargo installs — pure SQL + 3 source files + 1 test + regenerated schema; no dependency manifest touched. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-141-01 | T-141-SC | Zero new dependencies in this phase (pure SQL migration + 3 backend source edits + 1 test + regenerated schema dump). No dependency manifest touched — nothing to slopcheck. | operator | 2026-07-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-07 | 10 | 10 | 0 | gsd-security-auditor (opus, verify-mitigations mode) |

**Residual advisories (NOT threat gaps — every declared mitigation is present in executable code):** WR-01 (mock pool doesn't exercise the production foreign-probe SQL — test-coverage gap; mitigation present at :213/:242-260 and independently closed by the phase verifier's rollback-only live-DB psycopg2 probe), WR-02 (comment-substring guard for the both-sites-wired test — the executable derivation was verified directly), WR-03 (emit step-1 vs step-4 divergence on the `run_id is None` edge — cannot occur on a real workflow run; step-4 blocks the delivered-bytes path), IN-01/IN-02 (informational; no security impact). Weighed from `141-REVIEW.md`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-07
