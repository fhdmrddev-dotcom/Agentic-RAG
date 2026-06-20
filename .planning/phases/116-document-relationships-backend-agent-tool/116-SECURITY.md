---
phase: 116
slug: document-relationships-backend-agent-tool
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-20
---

# Phase 116 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 5 plan `<threat_model>` blocks parsed) → auditor ran in **verify-mitigations** mode (did not scan for new threats). State B (created from artifacts).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Phase 117 panel / API client → REST router → service | Untrusted `source_doc_id` / `target_doc_id` / `rel_type` from the create/delete bodies | Document ids, link type |
| Deep-mode model → `get_related_documents` tool args | Untrusted model-emitted `document_id` / `filename` strings (incl. attacker-aligned prompts replaying an OLD version id to probe a private latest) | Document selector strings |
| service-role supabase client | RLS BYPASSED — the service's app predicates (`is_latest` gate, global-folder containment, own-scoped `.eq("user_id")`) are the SOLE owner-scoping gate | All relationship + document rows |
| handler → agent loop | A raised exception would leak a stack trace to the model | Error text |
| re-upload event → edge enumeration | Versioning inserts a NEW uuid row (old `is_latest=False`); the read-side join must still find edges keyed on prior version ids without widening across documents | Edge rows over `(user_id, filename)` lineage |
| developer/operator → live local DB :54322 | A destructive apply (`db reset` / `db push`) would wipe dev data; a partial apply could half-build the index | Schema / dev rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-116-01-01 | Tampering | `rel_type` create body | mitigate | Pydantic `Literal[...]` → 422 (`models/document_relationship.py:47`); DB CHECK defense-in-depth | closed |
| T-116-01-02 | Tampering/Elevation | `user_id` in PostgREST `.or_()`/`.eq()` | mitigate | `_uid()` UUID guard (`service.py:56-68`, applied `:87,96,285,306`) | closed |
| T-116-01-03 | Tampering (TOCTOU) | duplicate edges | mitigate | additive partial unique index (migration `075:25-26`) + 23505-catch (`service.py:280-293`); **live unique idx confirmed :54322** | closed |
| T-116-01-04 | Information Disclosure | exact-filename resolver probe | mitigate | EXACT own-or-global match, no `%` ilike (`service.py:71-108`); partial `resolve_document_id` NOT reused | closed |
| T-116-01-SC | Tampering | npm/pip installs | accept | zero net-new deps (dependency-file diff empty) | closed |
| T-116-02-01 | Information Disclosure | probe-by-link existence oracle | mitigate | visible-both gate on BOTH endpoints → uniform 422 (`api/document_relationships.py:96-106`); readability BEFORE self-link (`:114`) — no ordering oracle | closed |
| T-116-02-02 | Tampering | cross-user delete | mitigate | own-scoped delete → 404-not-403 (`api:175-180`; `service.delete_relationship:296-308` `.eq("user_id", _uid)`) | closed |
| T-116-02-03 | Tampering | forged `rel_type` | mitigate | Pydantic `Literal` parse-422 + DB CHECK fallback (`api:132-138`) | closed |
| T-116-02-04 | Repudiation | no governance trail | mitigate | `relationship.create`/`.delete` audit (`api:147-157,185-190`); enum + boot drift-guard (`audit_service.py:22,29-53`); live `test_116_audit_live.py` | closed |
| T-116-02-05 | Tampering (integrity) | duplicate edges (double-click) | mitigate | SELECT-on-23505 returns existing (`service.py:277-293`); race-immune = live index | closed |
| T-116-02-SC | Tampering | npm/pip installs | accept | zero net-new deps | closed |
| T-116-03-01 | Information Disclosure | cross-viewer target leak (title/metadata of unseeable doc) | mitigate | per-viewer readability re-check + `_NO_ACCESS_MASK` (`tool_dispatcher.py:489,602-627`); D-116-9; **LIVE two-user non-vacuous** `test_116_tool_leak.py:269-308` | closed |
| T-116-03-02 | Information Disclosure | Gemini 400 / silent constraint loss from bad arg schema | mitigate | two flat scalar strings, NO anyOf/oneOf, NO multi-type `type` array (`openai_service.py:198-241`); advertised `get_tools:1023`; `test_116_tool_schema.py` asserts | closed |
| T-116-03-03 | DoS / Error Handling | handler raise leaking stack trace into agent loop | mitigate | calm-string contract — every path returns calm `ToolResult`, never raises (`tool_dispatcher.py:536-551,569-591,603-609`) | closed |
| T-116-03-04 | Elevation of Privilege | hallucinated/whitelisted-out tool name in workflow phase | mitigate | inherits `dispatch_tool` `phase_whitelist`-None guard (`:2824-2835`, no special-casing); `test_116_whitelist_guard.py` | closed |
| T-116-03-05 | Tampering | `user_id` interpolation in edge queries | mitigate | own-scoped `.eq("user_id", _uid(caller))` (`tool_dispatcher.py:576,582`) | closed |
| T-116-03-SC | Tampering | npm/pip installs | accept | zero net-new deps | closed |
| T-116-04-01 | DoS (data loss) | `db reset`/`db push` wiping dev data | mitigate | SQL-editor/psycopg2-only apply per CLAUDE.md (migration `075:17-23` header); index applied without reset; rows preserved | closed |
| T-116-04-02 | Tampering (integrity) | partial index apply | mitigate | single-txn `CREATE UNIQUE INDEX IF NOT EXISTS` (`075:25`, idempotent); live read-back from `pg_indexes` | closed |
| T-116-04-03 | Tampering (integrity) | duplicate edges before index lands | mitigate | live unique index = race-immune backstop for the 23505-catch; un-marked race-immune test green | closed |
| T-116-04-SC | Tampering | npm/pip installs | accept | zero net-new deps | closed |
| T-116-05-01 | Information Disclosure | `_resolve_readable_latest` global-by-id leg | mitigate | `.eq("is_latest", True)` on global leg (`service.py:210`) — mirrors `documents.py:558`; an old global-folder version is not independently readable. **Hand-verified non-vacuous (orchestrator + auditor).** | closed |
| T-116-05-02 | Information Disclosure | follow-to-latest step | mitigate | post-follow re-check `if from_global and folder_id not in global_folder_ids: return None` (`service.py:245-246`); own leg correctly excluded. **Hand-verified non-vacuous.** | closed |
| T-116-05-03 | Information Disclosure | non-vacuity of the leak mitigation | mitigate | LIVE two-version regression `test_116_tool_leak.py:376-418` — non-owner→None, owner→latest (RED-at-base/GREEN-after, non-vacuity guard) | closed |
| T-116-05-04 | Tampering / Integrity | edge enumeration over a single id | mitigate | `.in_(version_ids)` over subject's full `(user_id,filename)` set (`tool_dispatcher.py:577,583`); `_subject_version_ids` (`service.py:111-140`) scoped STRICTLY to subject lineage — **no cross-document widening (hand-verified)**; `[subject.id]` fallback | closed |
| T-116-05-05 | Spoofing / Elevation | `user_id` in PostgREST `.eq()` on service-role gate | mitigate | `_uid(user_id)` uniform on both write paths (`service.py:272,306`) → `ValueError` on malformed (WR-02) | closed |
| T-116-05-06 | DoS | in-band audit `await` on create/delete response path | accept | inherited `document_views.py` pattern; WR-03 reduced it to a comment-honesty fix (`api:141-146,182-184`); full BackgroundTasks decoupling out of 116 scope | closed |
| T-116-05-SC | Tampering | npm/pip/cargo installs | accept | zero net-new deps (read-side fixes + tests reuse existing venv) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-116-01 | T-116-05-06 | In-band blocking audit `await` on the create/delete response path adds latency. Inherited pattern shared with `document_views.py`; NOT a 116 regression. WR-03 reduced the scope to a comment-honesty fix; full `BackgroundTasks` decoupling is deferred (cross-cutting, would touch the shared audit path). | Operator (secure-phase 116) | 2026-06-20 |
| AR-116-02 | T-116-01-SC / 02-SC / 03-SC / 04-SC / 05-SC (all 6 supply-chain accepts) | Zero net-new dependencies this phase — verified by an EMPTY diff across `requirements.txt` / `pyproject.toml` / `package.json` / `Dockerfile.sandbox` over the full 116 commit range (not just by claim). No package-legitimacy gate required. | Operator (secure-phase 116) | 2026-06-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-20 | 28 | 28 | 0 | gsd-security-auditor (opus, ASVS L1) + orchestrator hand-spot-check of T-116-05-01/02/04 + supply-chain accepts |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-20
