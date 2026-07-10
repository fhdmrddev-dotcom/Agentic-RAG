---
phase: 132
slug: skill-versioning-eval-test-case-persistence
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-30
---

# Phase 132 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at PLAN time across 3 plans (register_authored_at_plan_time: true);
> mitigations verified against code by gsd-security-auditor on 2026-06-30.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| API (service-role) → Postgres | Backend writes to `skills`/`skill_versions`/`skill_test_cases` via the service-role client, which **BYPASSES RLS**. The version-capture trigger runs in this context (`auth.uid()` is NULL). The app-code `.eq("user_id", …)` filter is therefore the **sole runtime owner gate**; RLS is defense-in-depth. | Skill content, version history, eval test cases (per-user private authoring artifacts) |
| client → API | Authenticated requests carry a bearer token resolved by `get_current_user`; any `user_id` in the path/body could be forged and must be ignored in favor of `current_user["id"]`. | Bearer token; test-case payloads |
| browser → API | The frontend (thin client) sends the user's bearer token; all owner-scoping is enforced server-side. The UI is not itself a security boundary. | Rendered owner-scoped API responses only |
| Cross-user data | Version history is the author's private artifact — never visible to consumers of a *global* skill (D-12). | skill_versions rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-132-01 | Information disclosure | skill_versions cross-owner read via global skill | mitigate | Owner-only RLS `USING (auth.uid() = user_id)`, NO is_global branch (`079:184-186`) + app-code owner filter (`skill_test_cases.py:179`); defense-in-depth | closed |
| T-132-02 | Tampering | version-history mutation | mitigate | `BEFORE UPDATE` append-only block trigger `skill_versions_no_update` → ERRCODE check_violation/23514 (`079:151-166`); test `test_version_update_blocked` | closed |
| T-132-03 | Tampering | NULL/forged user_id on version rows | mitigate | Trigger sources `NEW.user_id` not `auth.uid()` (`079:132`); `user_id NOT NULL REFERENCES auth.users` (`079:47`); test asserts user_id == skill owner | closed |
| T-132-04 | Denial of service | version_number race → duplicate/lost version | mitigate | `UNIQUE (skill_id, version_number)` (`079:57`) → benign retryable 23505; test `test_version_number_unique` | closed |
| T-132-05 | Elevation of privilege | SECURITY DEFINER trigger search_path hijack | mitigate | `SET search_path = public, pg_temp` on `capture_skill_version()` (`079:105`) | closed |
| T-132-06 | Info disclosure / Tampering | IDOR on /test-cases/{id} and /skills/{id}/versions | mitigate | `.eq("user_id", current_user["id"])` on all 5 routes (`skill_test_cases.py:77,97,136,155,179`); PATCH/DELETE → 404 on no match; test `test_owner_scope_isolation` | closed |
| T-132-07 | Tampering | Forged user_id in request body/path | mitigate | Insert sets `user_id` from `current_user["id"]` only; body user_id ignored (`skill_test_cases.py:101-108`); test asserts created.user_id == owner | closed |
| T-132-08 | Information disclosure | Reading version history of a consumed global skill | mitigate | Versions GET owner-scoped `.eq("skill_id").eq("user_id")` (`skill_test_cases.py:174-180`); non-author gets `[]` (test confirms) | closed |
| T-132-10 | Information disclosure | UI requesting another user's cases/versions | mitigate | Server enforces `.eq(user_id)` (T-132-06); thin client renders only owner-scoped API responses, makes no client-side trust decision (`SkillTestCasesSection.tsx:48-50`) | closed |
| T-132-09 | Spoofing | Missing/invalid bearer token | accept | Existing `get_current_user` dependency on all 5 routes rejects unauthenticated requests; no new unauthenticated path | closed |
| T-132-11 | Tampering | Client forging skill_id/user_id | accept | Server never reads user_id from body; scopes by token (T-132-07 is the control) | closed |
| T-132-SC | Tampering | npm/pip installs | accept | No new pip/npm packages this phase (zero external deps; both SUMMARYs confirm) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-132-01 | T-132-09 | Authentication is an existing, unchanged platform control (`get_current_user`); this phase adds no new unauthenticated surface. | operator | 2026-06-30 |
| AR-132-02 | T-132-11 | Client cannot forge ownership — server ignores body user_id and scopes by token; no client-side trust exists. | operator | 2026-06-30 |
| AR-132-03 | T-132-SC | No new pip/npm packages introduced; reuses existing shadcn primitives + fetch + raw SDK. | operator | 2026-06-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-30 | 13 | 13 | 0 | gsd-security-auditor (verify mode; register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-30
