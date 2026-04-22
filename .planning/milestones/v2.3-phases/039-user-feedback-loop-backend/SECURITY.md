# SECURITY.md — Phase 039: User Feedback Loop Backend

**Generated:** 2026-04-18
**ASVS Level:** L1
**Threats Closed:** 7/7
**Open:** 0

---

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-039-01 | Tampering | mitigate | `feedback.py:47` — `user_id = current_user["id"]`; `FeedbackRequest` model (lines 29–32) declares no `user_id` field |
| T-039-02 | Elevation of Privilege | mitigate | `028_message_feedback.sql:23-24` — RLS SELECT `USING (auth.uid() = user_id)`; `feedback.py:103,110,125,141,167` — redundant `.eq("user_id", user_id)` on all five queries |
| T-039-03 | Tampering | mitigate | `feedback.py:29-32` — `FeedbackRequest` has three fields only (`message_id`, `rating`, `reason`); `user_id` is absent from the model |
| T-039-04 | Spoofing | accept | Accepted per rationale below; DB enforcement confirmed at `028_message_feedback.sql:12` |
| T-039-05 | Information Disclosure | mitigate | `feedback.py:98,103,110,125,141,167` — all queries scoped to JWT-derived `user_id`; no cross-user data paths |
| T-039-06 | Denial of Service | mitigate | `feedback.py:121-130` — 30-day window bounds neg_message_ids; `feedback.py:162` — `[:TOP_DOWNVOTED]` (5) cap before documents query |
| T-039-07 | Injection | mitigate | `feedback.py:31-32` — `Literal` types reject out-of-set values before any DB call; `028_message_feedback.sql:9-10` — DB CHECK constraints; Supabase client uses parameterised queries throughout |

---

## Accepted Risks

### T-039-04 — Spoofing: Fraudulent rating via replayed token

**Rationale:** ASVS L1 does not require rate limiting on non-financial, non-safety-critical feedback actions. A valid JWT is required for any submission; an attacker replaying a captured token can only vote as that token's owner. The `UNIQUE (message_id, user_id)` constraint (migration 028, line 12) enforces one vote per message per authenticated user at the database layer, making repeated replay attempts a no-op after the first accepted vote.

**Residual risk:** A compromised JWT could be used to cast a single fraudulent vote per message. This is accepted at ASVS L1; rate limiting may be added in a future hardening phase if abuse patterns emerge.

---

## Unregistered Flags

None — both 039-01-SUMMARY.md and 039-02-SUMMARY.md reported no new threat flags.

---

## Implementation Notes

- `FeedbackRequest.rating` and `reason` use Pydantic `Literal` types (stricter than plain `str`), providing an additional validation layer beyond what the threat model specified.
- No UPDATE or DELETE RLS policies exist on `message_feedback`, enforcing immutability at the DB layer (D-01).
- Audit writes use `BackgroundTasks.add_task()` (fire-and-forget), consistent with the D-07 pattern and the `audit_service.py` docstring requirement.
