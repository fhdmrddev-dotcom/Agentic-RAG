---
phase: 039
slug: user-feedback-loop-backend
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-18
---

# Phase 039 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client → POST /feedback | Untrusted message_id and rating/reason values cross here | User-supplied strings |
| Client → GET /feedback/stats | Auth token crosses here; no request body but user identity must be verified | JWT |
| feedback.py → messages table | source_refs JSONB from messages is treated as trusted DB data but must be iterated defensively | Internal JSONB |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-039-01 | Tampering | POST /feedback — user_id | mitigate | `user_id = current_user["id"]` (JWT); `FeedbackRequest` has no `user_id` field | closed |
| T-039-02 | Elevation of Privilege | RLS bypass — message_feedback SELECT | mitigate | RLS `USING (auth.uid() = user_id)` + five redundant `.eq("user_id", user_id)` backend filters | closed |
| T-039-03 | Tampering | Mass assignment — FeedbackRequest | mitigate | Pydantic model exposes exactly `message_id`, `rating`, `reason`; `user_id` structurally absent | closed |
| T-039-04 | Spoofing | Fraudulent rating via replayed token | accept | See Accepted Risks Log | closed |
| T-039-05 | Information Disclosure | GET /feedback/stats — other users' data | mitigate | All six query sites in `feedback.py` scope to JWT-derived `user_id`; no cross-user path | closed |
| T-039-06 | Denial of Service | GET /feedback/stats — unbounded message_id IN query | mitigate | 30-day cutoff bounds neg_message_ids; `[:TOP_DOWNVOTED]` (5) hard cap before documents fetch | closed |
| T-039-07 | Injection | SQL injection via rating/reason strings | mitigate | Pydantic `Literal` types reject out-of-set values; DB CHECK constraints; Supabase parameterised queries | closed |

*Status: open · closed*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-039-01 | T-039-04 | ASVS L1 does not require rate limiting on feedback; UNIQUE(message_id, user_id) constraint prevents duplicate votes — one-vote-per-message enforced at DB level | gsd-security-auditor | 2026-04-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-18 | 7 | 7 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-18
