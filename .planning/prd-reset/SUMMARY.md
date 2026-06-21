# PRD-Reset Meta-Phase — Summary & Signoff Brief

> ℹ️ **Superseded sequencing — see `.planning/PRDs/SEQUENCE.md` (authoritative, 2026-06-15).** The six-milestone table in §E.1 reflects the ORIGINAL 2026-05-10 plan (v3.0 Skill Studio first). The project pivoted (v2.7–2.9 = Workspace / Harness / Workflow Studio) and on 2026-06-15 the roadmap was re-sequenced: Document Management = v3.0, Skill Studio re-scoped → v3.1, and the rest shifted down one slot. The cross-PRD consistency analysis below stays useful, but its version slots are stale.

**Date:** 2026-05-10
**Author:** Plan 09 consistency-pass agent
**Inputs:** 6 PRDs (v2.6, v3.0, v3.1, v3.2, v3.3, v3.4) + DECISIONS.md (D-PRD-01..11) + MIGRATION-RESERVATIONS.md + PRD-TEMPLATE.md + synthesis + meta-phase PLAN.md

---

## §A. Cross-PRD Consistency Check

### A.1 Resolved Q-ID collision — D-PRD-13/14/15 renumbering (BLOCKING ISSUE)

Wave 1B surfaced four independent claims on `D-PRD-13`. Resolution per PLAN.md Plan 09 brief (chronology of need + scope breadth):

| Decision | New ID | Affects | Surfaced first in | Conflict source |
|---|---|---|---|---|
| **Skill Versioning** (semver, immutable-on-publish) | `D-PRD-13` | v3.0 (origin) + v3.3 (ZIP roundtrip) + v3.4 (routine pins to skill version) | v3.0 §13 Q-v3.0-05 | v3.0.md:433 already correctly uses D-PRD-13 |
| **Operator Role Tier** (SYSTEM-level vs ORG-level split) | `D-PRD-14` | v3.1 (origin) + v3.2 (4-tier hierarchy layers on top) + v3.3 (service-account scoping) + v3.4 (routine ownership) | v3.1 §13 Q-v3.1-06 | v3.1.md:496 wrote it as D-PRD-13; collides with v3.0 |
| **SecretsBackend Interface Contract** (`get/set/rotate/list_keys` Python interface) | `D-PRD-15` | v3.1 (origin) + v3.2 (SSO `idp_metadata`) + v3.3 (webhook `secret` HMAC key storage) | v3.1 §13 Q-v3.1-07 | v3.1.md:497 wrote it as D-PRD-14; collides with v3.2 |

**Two duplicate claims to REJECT/FOLD:**
- v3.2 §13 footer (v3.2.md:507) proposing D-PRD-13 for "hybrid SaaS posture confirmation" — REJECTED (just confirmation of D-PRD-02 already locked).
- v3.2 §13 footer proposing D-PRD-14 for "4-tier role hierarchy" — FOLDED INTO D-PRD-14 Operator Role Tier (one decision, one ADR).
- v3.4 §13 Q-v3.4-09 (v3.4.md:456) proposing D-PRD-13 for "v3.2+v3.3 cross-PRD sequencing" — REJECTED (sequencing is enforced by PLAN.md ordering, not a separate ADR).

### A.2 Pair-by-pair audit (12 pairs)

| Pair | Honored? | Evidence | Action |
|---|---|---|---|
| v2.6 ↔ v3.0 (SEED-007 lift → eval-stream UI) | ✓ | v2.6.md:52 STREAMS-PROVIDER-01; v3.0.md:23 inherits D-PRD-06; v3.0.md:281 SEED-007 carry-forward; v3.0.md:207 eval hook on lifted Context | none |
| v2.6 ↔ v3.0 (run-backed streaming for eval SSE) | ✓ | v3.0.md:28 inherits D-v2.5-08 load-bearing; v3.0.md:51 eval_runner uses `_emit` XADD path; v3.0.md:296-297 corrects POST-stream pattern | none |
| v3.0 ↔ v3.1 (skills in admin shell, eval-run visibility) | ◐ | v3.1.md:294 partial routing; eval runs visible via active-runs ZSET; eval inspection lives in v3.0 Evals panel | accept partial |
| v3.1 ↔ v3.2 (operator role → org-aware shell + audit_log org_id) | ✓ | v3.1.md:63 OBS-PRIM-01 ships org_id NULL columns; v3.2.md:80 uses for org-admin filter; v3.2.md:300 Cluster C confirms super-admin/operator → org-admin/dept-admin/member layering | none |
| v3.2 ↔ v3.3 (service-accounts org-aware, rate-limit per-org tier) | ✓ | v3.3.md:43 service_accounts org_id; v3.3.md:65 rate-limits read orgs.subscription_tier; v3.3.md:29 v3.2 hard prereq | none |
| v3.3 ↔ v3.4 (webhooks → reactive routines) | ✓ | v3.4.md:50 reactive consumes v3.3 webhook receiver; v3.4.md:222 §6 cross-PRD dependency row with degradation fallback | none |
| v2.6 ↔ v3.2 (multi-worker → multi-tenancy under workers N) | ✓ | v3.2.md:25 D-PRD-12 inheritance; v3.2.md:120 RLS-REWRITE-02 keeps CONCUR-01 green | none |
| v2.6 ↔ v3.3 (multi-worker prereq for public API) | ✓ | v3.3.md:24 D-PRD-08 explicit hard prereq | none |
| **v2.6 ↔ v3.4 (token columns populated → spend-cap pre-flight)** | **✗** | **v3.4.md:223 explicitly flags v2.6 doesn't actually populate `runs.input_tokens`/`runs.output_tokens`. v3.4 has fallback estimator; not fatal but reduces v1 fidelity** | **ACTION: user picks (a) add TOKEN-COL-01 to v2.6 (~1 plan, recommended) or (b) ship v3.4 with estimator fallback** |
| v3.0 ↔ v3.3 (skills via API: POST /api/v1/skills/{id}/run) | ◐ | v3.3.md:36 mentions skills route mirror; MCP run_skill tool present; **but no explicit REST endpoint row in §5 inventory** | ACTION: low-severity doc-completeness — v3.3 §5 next revision adds the explicit route |
| v3.0 ↔ v3.4 (routines execute Skills, signature compatibility) | ✓ | v3.4.md:25 inherits D-PRD-09; v3.4.md:47 routine_definitions.action_skill_id; v3.4.md:221 §6 row inherits skill-version pin pattern | none |
| v3.2 ↔ v3.4 (org-scoped routines + spend caps map to org tier) | ✓ | v3.4.md:20 inherits D-PRD-02; v3.4.md:69 spend_caps reads orgs.subscription_tier; v3.4.md:220 v3.2 hard prereq | none |

### A.3 Milestone-ordering verification

Roadmap order v2.6 → v3.0 → v3.1 → v3.2 → v3.3 → v3.4 honors ALL hard prereqs structurally. Only the v2.6→v3.4 token-column row is structurally satisfied but content-wise unhonored (see §A.2 row 9).

### A.4 v3.0 ↔ v3.4 skill-versioning shape compatibility — ✓

v3.0 uses `semver text` + `published_at`; v3.4 uses `version int` + `published_at`. Both immutable-on-publish; both spawn new rows on edit; both pin in-flight references. Compatible patterns; cosmetic column-shape divergence only. v3.4.md:221 explicitly mirrors D-PRD-09 pattern.

### A.5 Issues found beyond the known D-PRD-13 collision

1. `runs.input_tokens` / `runs.output_tokens` not populated by v2.6 despite v3.4 dependency. **Severity: medium.**
2. v3.3 missing explicit `POST /api/v1/skills/{id}/run` REST route in §5 inventory. **Severity: low.**
3. v3.2 §13 footer text proposes ID-shadowing duplicates for D-PRD-13/14. **Severity: low (cosmetic; closes once §A.1 lands in DECISIONS.md).**
4. v3.4 §13 Q-v3.4-09 proposes a 4th D-PRD-13 claim. **Severity: low.**

---

## §B. Outdated-Content Prune Validation

41 synthesis §7 rows audited (lines 587-631 of milestone-shaping-2026-05-09.md). Routings spot-checked:
- v2.6 addresses: SCALABILITY_ROADMAP rows (workers/CONCUR/AnyIO/Realtime/POST-SSE), RAG_Quality Problem 3, Code_Quality_Review §1.A/§1.B/§2.C/§4.D/§1.C/§2.E/§2.F/concurrent-ingestion-race, Agent_Realtime Fix 2, KI-001 status, VPS_Deployment_Guide partial fix, Hostinger Redis omission partial fix, SEED-003 multi-worker rephrase, SEED-006 migration-number stale.
- v3.0 addresses: SKILL_STUDIO_PRD all 4 stale rows, Roadmap_Agentic_RAG archive, Episode4_PRD archive, Ethereal_Intelligence Settings retrofit (partial).
- v3.1 fully archives VPS_Deployment_Guide + Hostinger.
- v3.2 addresses: PRD_Enterprise_RAG F-01..F-10 (F-04 explicit precursor), F-06 v2 SIEM defer.
- Project-level OOS rows (per-claim confidence, PDF highlighting, diff view, Suggestions in Explorer) inherited from PROJECT.md across all 6 PRDs.

**Mild gap:** "PROJECT.md UAT verification gaps for phases 038-042" (synthesis §7 line 629) not picked up by any PRD. Recommend addressing during PROJECT.md evolution at v2.6 close (admin housekeeping; not a milestone-blocker).

**Acceptable defers:** CONTEXT-MANAGEMENT.md Options A/C/D/E (cost-optimization not in v2.6 scope); RECOVERED_User_Profiling_Detection_Heuristics (operational tooling, not strategy — synthesis explicit "exclude").

---

## §C. Lateral-Thinking Checklist

### C.1 21-feature walk

| # | Feature | Status |
|---|---|---|
| 1 | Real-time collaboration | REJECTED (no demand; v2.6/v3.0/v3.1 §10 entries) |
| 2 | Notification system | COVERED (v3.4 Theme G + AUTOM-NOTIF-01) |
| 3 | Audit log UI | COVERED (v3.1 AUDIT-UI-01) |
| 4 | Mobile native apps | AWAITING DECISION |
| 5 | Accessibility (WCAG 2.1 AA) | **GAP — unrouted across all 6 PRDs** |
| 6 | Compliance certifications (SOC 2, ISO 27001, GDPR DPA, HIPAA BAA) | DEFERRED to v3.2 readiness + v3.5+ |
| 7 | Internationalization | AWAITING DECISION |
| 8 | Backup/restore UX | DEFERRED to v3.2 |
| 9 | Cost tracking per org/user/skill/routine | COVERED (v3.4 Theme F) + DEFERRED (per-skill rollup waits for v3.4) |
| 10 | Search across threads/messages full-text | **MILD GAP** — no PRD picks up |
| 11 | Thread sharing (read-only links) | AWAITING DECISION |
| 12 | Skill marketplace | DEFERRED to v3.5+ marketplace milestone |
| 13 | LLM cost optimization | DEFERRED to v3.2 or later |
| 14 | Browser extension | AWAITING DECISION |
| 15 | A/B model comparison (D-2) | DEFERRED to v3.0 or v3.2 |
| 16 | Multi-Agent Orchestration (D-4) | COVERED (v3.0 Theme F) |
| 17 | Agent Checkpointing (D-5) | COVERED (v3.4 Theme D) |
| 18 | Per-document audit trail | PARTIAL (v3.4 dm_lifecycle_audit lifecycle events; per-document READ access trail not covered) |
| 19 | Embed/iframe widget | **GAP — unrouted** |
| 20 | Voice input (STT) | **GAP — unrouted** |
| 21 | Email-to-thread | **GAP — unrouted** |

### C.2 4 features surfaced beyond synthesis (load-bearing for enterprise buyer profile)

1. **SSO group → role mapping** (auto-provision via Okta/Azure AD groups) — DEFERRED to v3.2.5; schema-compatible extension of v3.2 `sso_configs.attribute_mapping`.
2. **Custom data-residency per org** (GDPR / regional compliance) — DEFERRED to v3.5+ regional-deployment milestone (reactive-to-customer-win).
3. **BYOK encryption** (customer-managed keys for at-rest data via KMS / AWS KMS / Azure Key Vault / GCP KMS) — DEFERRED to v3.1.5+ enterprise-tier add-on; reuses D-PRD-15 SecretsBackend contract via a `KmsBackedSecretsBackend` adapter.
4. **IP allow-listing per service account** — DEFERRED to v3.3.5 polish; column-additive extension of `api_keys` (already has `allowed_origins`; add `allowed_ips inet[]`).

---

## §D. Verification Gate Self-Check (11 checkboxes)

| # | Checkbox | Status |
|---|---|---|
| 1 | Every §7 row mapped to a PRD's Gate 4 | ✓ (1 mild housekeeping gap noted) |
| 2 | No cross-PRD scope collision | ✓ (D-PRD-13/14 are NAMESPACE collisions, not SCOPE — resolved by §A.1) |
| 3 | Lateral-thinking checklist (≥21) walked | ✓ |
| 4 | ≥3 features surfaced beyond synthesis | ✓ (4 surfaced) |
| 5 | User signoff captured | **PENDING** (template in §E.3) |
| 6 | §8 (clusters, forward) vs §9 (docs, backward) split honored | ✓ all 6 PRDs |
| 7 | §10 (rejected w/ trigger) vs §11 (out-of-scope routing) split honored | ✓ all 6 PRDs |
| 8 | §4 OOS rows ⊆ §11 Lean entries | ✓ all 6 PRDs |
| 9 | No migration number collisions | ✓ (v2.6: 039-049 / v3.0: 050-064 / v3.1: 065-074 / v3.2: 075-094 / v3.3: 095-109 / v3.4: 110-124 — all within reserved ranges) |
| 10 | §9 PARTIALLY-SUPERSEDES rows close cleanly | ✓ all 6 PRDs (un-superseded portions land in §11 or §15 with rationale) |
| 11 | Q-ID upgrades route correctly + D-PRD-13 collision resolved | ✓ with §A.1 mapping applied |

**Total: 10 of 11 PASS, 1 PENDING (user signoff). No FAIL.**

---

## §E. Signoff Brief

### E.1 Six-milestone summary

| Milestone | Theme | Phases | PRD lines | Key deliverables (3-5) | Competitive sentence |
|---|---|---|---|---|---|
| **v2.6** | Foundation: RAG quality, multi-worker, polish | 15 (~38 plans) | 556 | Docling-first PDF/DOCX; multimodal lift ≥80% figures; asyncpg+`--workers N`; StreamsProvider lift; SEED-008/009/010/011 polish | "Multimodal RAG that surfaces what's in the document + production-tier scale-out — Glean has neither, NotebookLM has multimodal but no agent layer." |
| **v3.0** | Skill Studio: iterative dev + eval + multi-agent | 13 (~35 plans) | 539 | 5 eval tables; 3 General-Mode agent tools; dual-execution streaming; semver versioning immutable-on-publish; Multi-Agent Orchestration mode | "Custom GPTs that you can actually test, version, and own — OpenAI Assistants ships no eval surface." |
| **v3.1** | Operator UX: admin shell, install wizard, presets, secrets | 13 (~38 plans) | 604 | operator_users table + /admin route; backpressure dashboard + audit-log browser; browser install wizard; Solo/Team/Enterprise presets; encrypted-in-Postgres secrets | "Hybrid SaaS posture from one codebase — Glean has no on-prem, M-Files has no co-tenant." |
| **v3.2** | Multi-Tenancy: orgs/depts/roles/SSO + RLS rewrite | ~12 | 626 | 8 new tables; RLS predicate rewrite on all 18 user-facing tables; SAML+OIDC+JIT; match_document_chunks SECURITY INVOKER; personal-org backfill | "Hybrid SaaS posture is real — same codebase serves co-tenant SMB and dedicated enterprise." |
| **v3.3** | Open Platform: REST API + MCP + service accounts + webhooks | 10-12 | 584 | /api/v1/* + OpenAPI 3.1; open-source MCP server (stdio+HTTP); org-scoped service accounts; HMAC webhooks at-least-once; Python+TS SDKs | "The only enterprise-grade self-hostable RAG platform addressable from any MCP host." |
| **v3.4** | Automations + DM Tier B | 12 | 552 | scheduler sibling process; events:* event bus; agent_checkpoints + resume; spend caps stacked; DM retention/check-in/out/linear approvals/lifecycle audit | "Glean answers; we act. ChatGPT Tasks schedules; we ground. n8n automates; we know your data." |

### E.2 Concerns (severity-ranked)

1. **[HIGH] D-PRD-13/14/15 ID collision must be resolved before any milestone executes.** Mitigation: §A.1 mapping + paste-ready ADRs in §E.3.
2. **[MEDIUM] v2.6 → v3.4 token-column population gap.** v3.4 spend caps need `runs.input_tokens`/`output_tokens` populated; v2.6 doesn't. v3.4 has fallback estimator. Mitigation: add small TOKEN-COL-01 requirement to v2.6 (~1 plan, recommended) OR ship as-is with v3.4 estimator fallback.
3. **[MEDIUM] WCAG 2.1 AA accessibility unrouted across all 6 PRDs.** Enterprise-sales blocker for some buyer profiles.
4. **[MEDIUM] Compliance certifications (SOC 2, ISO 27001, GDPR DPA, HIPAA BAA) deferred but not concretely scoped.** No audit budget yet.
5. **[LOW] PROJECT.md "UAT verification gaps phases 038-042" not picked up by any PRD.** Housekeeping at v2.6 close.
6. **[LOW] v3.3 missing explicit `POST /api/v1/skills/{id}/run` route in §5 inventory.**
7. **[LOW] 21-checklist items #19 (embed widget), #20 (voice input), #21 (email-to-thread) unmentioned.** Not enterprise blockers.
8. **[LOW] Per-document READ-access trail partial.** v3.4 covers lifecycle events but not per-document view tracking.
9. **[LOW] CONTEXT-MANAGEMENT.md Options A/C/D/E NOT IMPLEMENTED.** Acceptable defer.
10. **[LOW] Cosmetic §13 footer-text corrections in v3.0/v3.1/v3.2/v3.4 after §A.1 mapping is locked.**

### E.3 What changes after signoff

**(A) Paste-ready DECISIONS.md edits — three new ADRs to append after D-PRD-11:**

```markdown
## D-PRD-13 — Skill Versioning: semver + immutable-on-publish
**Status:** ACCEPTED 2026-05-10 (locked by Plan 09)
**Decision-makers:** User + Plan 09 SUMMARY.md §A.1
**Supersedes:** Q-v3.0-05 lifted from milestone-internal to cross-milestone

### Decision
Skills carry semver text versions on a new `skill_versions` table; published versions are IMMUTABLE; editing a published version creates a new draft row; explicit publish flips `published_at = now()`. Backfill: existing skills get synthetic `1.0.0`. Eval runs and routine runs link to `skill_version_id`.

### Consequences
- v3.0 ships primary infrastructure (Theme E + migrations 054-055)
- v3.3 ZIP export adds `versions/<semver>.md` siblings; import reconstructs idempotently
- v3.4 routine_definitions pin to a specific skill_version_id at routine publish

### Sources
.planning/PRDs/v3.0.md §3 Theme E + Q-v3.0-05; .planning/PRDs/v3.3.md §3 Theme A; .planning/PRDs/v3.4.md §3 Theme B + Q-v3.4-07

---

## D-PRD-14 — Operator Role Tier: SYSTEM-level vs ORG-level split
**Status:** ACCEPTED 2026-05-10
**Supersedes:** Q-v3.1-06 lifted from milestone-internal

### Decision
Two-axis role hierarchy:
- SYSTEM-level (cross-org): super_admin, operator → operator_users table (v3.1)
- ORG-level (intra-org): org_admin, dept_admin, member → org_members.role_id + dept_members.role_id (v3.2)

### Consequences
- v3.1 ships SYSTEM-level (operator_users + bootstrap-super-admin env var)
- v3.2 ships ORG-level (4-tier with role_permissions table)
- v3.3 service accounts inherit org_id from v3.2 membership
- v3.4 routine ownership maps to org-tier roles

### Sources
.planning/PRDs/v3.1.md §3 Theme A + Q-v3.1-06; .planning/PRDs/v3.2.md §3 Theme A + Q-v3.2-03; .planning/PRDs/v3.3.md §3 Theme B; .planning/PRDs/v3.4.md §3 Theme G

---

## D-PRD-15 — SecretsBackend Interface Contract
**Status:** ACCEPTED 2026-05-10
**Supersedes:** Q-v3.1-07 lifted from milestone-internal

### Decision
The SecretsBackend Python interface stabilizes at v3.1 ship as: `async get(key)/set(key,value)/rotate(key)/list_keys() -> ...`. Adapters (Vault, Doppler, 1Password Connect, Infisical, AWS KMS BYOK) ship in v3.1.5+ with no app-code changes elsewhere.

### Consequences
- v3.1 ships interface + 2 implementations (encrypted-in-Postgres + env-var)
- v3.1.5+ ships enterprise-tier adapters as add-ons (per D-PRD-10)
- v3.2 SSO idp_metadata + v3.3 webhook secret HMAC keys read/write through interface
- BYOK encryption becomes clean v3.1.5+ extension via KmsBackedSecretsBackend adapter

### Sources
.planning/PRDs/v3.1.md §3 Theme J + Q-v3.1-07; SUMMARY.md §C.2 surfaced feature #3
```

**(B) PRD revisions before `/gsd:new-milestone v2.6` consumes v2.6.md:** NONE BLOCKING. v2.6.md consumable as-is. The optional TOKEN-COL-01 addition is the user's signoff decision.

**(C) Cosmetic PRD edits at next revision:**
- v3.1.md:496 — change D-PRD-13 → D-PRD-14 (Operator Role Tier)
- v3.1.md:497 — change D-PRD-14 → D-PRD-15 (SecretsBackend)
- v3.2.md:507 — drop the "Q-v3.2-01 → D-PRD-13" + "Q-v3.2-03 → D-PRD-14" sentences (folded into D-PRD-02 + D-PRD-14)
- v3.3.md:29 — change "D-v3.2-NN (TBD)" reference to D-PRD-14 for ORG-level scoping
- v3.4.md:456 — drop D-PRD-13 upgrade routing in Q-v3.4-09 (sequencing is enforced by PLAN.md, not separate ADR)
- v3.3.md §5 — add explicit `POST /api/v1/skills/{id}/run` route to inventory

**(D) User signoff template:**

```
## User Signoff — Plan 09 PRD-Reset Meta-Phase
**Date:** _______
**User:** fhdmrd@gmail.com

**Approval status (pick one):**
[ ] APPROVED — paste D-PRD-13/14/15 ADRs into DECISIONS.md, proceed with /gsd:new-milestone v2.6
[ ] APPROVED WITH MODIFICATIONS — list below
[ ] KICKED BACK — list which PRDs need revision and why

**Decision on v2.6 token-column population (§E.2 #2) — pick one:**
[ ] Add TOKEN-COL-01 requirement to v2.6 §3 (recommended)
[ ] Ship v2.6 as-is; v3.4 ships with fallback estimator
[ ] Other: _______

**Optional decisions surfaced in §E.2:**
- WCAG 2.1 AA accessibility scope: _______ (defer-with-trigger / commit small lift in v3.1+v3.0 / dedicated post-v3.4 compliance milestone)
- SOC 2 / compliance scope: _______ (commission readiness assessment ahead of v3.2 / defer to v3.5+ / customer-driven add-on only)

**Signed:** _______
```

---

## §F. Recommended Next Command

After signoff (and DECISIONS.md edits applied per §E.3):

```
/gsd:new-milestone v2.6
```

Consumes `.planning/PRDs/v2.6.md` as scope brief. Generates `.planning/v2.6/REQUIREMENTS.md` + `.planning/v2.6/ROADMAP.md`; opens v2.6 milestone for `/gsd:plan-phase` per phase. v2.6 PRD passed all 6 verification gates and is ready as-is (with optional TOKEN-COL-01 addition per signoff decision).

---

## §G. Sources

Read in full: `.planning/prd-reset/PLAN.md` (252 lines); `.planning/prd-reset/DECISIONS.md` (1082 lines); `.planning/prd-reset/PRD-TEMPLATE.md` (473 lines); `.planning/prd-reset/MIGRATION-RESERVATIONS.md` (42 lines); `.planning/research/milestone-shaping-2026-05-09.md` §4 + §5 + §6 + §7 + §9; `.planning/PRDs/v2.6.md` (556) + `.planning/PRDs/v3.0.md` (539) + `.planning/PRDs/v3.1.md` (604) + `.planning/PRDs/v3.2.md` (626) + `.planning/PRDs/v3.3.md` (584) + `.planning/PRDs/v3.4.md` (552).
