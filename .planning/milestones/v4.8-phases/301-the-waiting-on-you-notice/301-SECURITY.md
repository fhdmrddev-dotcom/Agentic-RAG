---
phase: 301
slug: the-waiting-on-you-notice
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-10-30
audited_at_head: 6607f509d
---

# Phase 301 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Written retroactively on 2026-10-30, because the v4.8 milestone audit found it missing. The register is the plan-time one from 301-01/02/03-PLAN.md; a `gsd-security-auditor` verified each mitigation against code and tests at `6607f509d`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → GET /notifications | untrusted request; caller identity only from the verified JWT | workflow name, org name, wait start, kind (no question text) |
| API → shared asyncpg pool | the pool bypasses RLS, so the statement's own predicates are the access wall | the caller's open notices |
| Postgres WAL → Supabase Realtime → browser | Realtime delivers notification row changes; RLS governs who receives them | notice row ids and timestamps |
| Realtime event → browser | an event is untrusted and possibly missed; it may only trigger a refetch | none used (payload ignored) |
| server data → rendered row | org and workflow names are user-authored text | names rendered as text |
| row click → navigation | a click must open the run through 299's LinkGate, never change the active org | run id |
| shared screen → the list | anything on a row is visible to whoever sees the screen | names, kind words, waited phrase |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-301-01 | I | GET /notifications (anon) | mitigate | router-level `_require_bearer` 401 + `WWW-Authenticate` (`api/notifications.py:43-57`); 218 grants SELECT to authenticated only (`218:88-93`). Tests: `test_every_notifications_route_answers_401_without_a_bearer`, `test_300_rls_anon_live.py` | closed |
| T-301-02 | I | LIST_OPEN_SQL cross-user | mitigate | `n.recipient_id = $1` from `current_user["id"]` only (`db/notifications.py:224`). Test: `test_another_user_sees_none_of_the_owners_notices` (live) | closed |
| T-301-03 | I | LIST_OPEN_SQL left org | mitigate | `JOIN org_members m ... AND m.user_id = $1` (`db/notifications.py:220`). Test: `test_an_org_the_owner_has_left_drops_out` (live) | closed |
| T-301-04 | S | X-Org-Id header | mitigate | route takes only `current_user`; no `get_active_org_id`. Tests: `test_the_org_header_is_never_consulted`, token scan | closed |
| T-301-05 | E | pool posture | mitigate | `$1` present, `auth.uid()` absent in LIST_OPEN_SQL. Test: `test_the_statement_binds_the_caller_twice_and_walls_ended_runs` | closed |
| T-301-06 | I | question text on the wire | mitigate | no `tool_call_id`, no `messages` join; 8-field response model. Tests: drainer `*_SQL` scan covers LIST_OPEN_SQL; `test_two_rows_answer_the_eight_wire_fields_and_the_server_total` | closed |
| T-301-07 | I | Realtime publication (mig 219) | mitigate | 218 owner-only SELECT policy (`218:95-98`); 219 adds only the publication line. Tests: `test_219_changes_nothing_else`, `test_a_recipient_sees_her_own_notice_and_not_anothers` | closed |
| T-301-08 | R | stale notice after a swallowed close | mitigate | `wr.status IN ('active','paused')` (`db/notifications.py:222`). Test: `test_a_notice_left_open_on_an_ended_run_is_not_listed` (live) | closed |
| T-301-09 | D | list size | mitigate | `LIST_LIMIT = 50`, `count(*) OVER ()`, `LIMIT $2`; no client limit. Test: `test_total_counts_every_open_notice_when_the_limit_cuts_the_rows` (live) | closed |
| T-301-10 | T | cloud parity | accept | see Accepted Risks Log | closed |
| T-301-11 | T/S | Realtime payload | mitigate | callback `() => request()` ignores the payload (`useWaitingNotices.ts:218-223`). Tests: forged-payload test; `?raw` fence forbids `payload.new/old` | closed |
| T-301-12 | I | Realtime channel scope | mitigate | per-user channel, `filter: recipient_id=eq.${uid}` (`useWaitingNotices.ts:210,221`) on top of the 218 policy. Test: user-scoped subscription test | closed |
| T-301-13 | R | missed event / dropped socket | mitigate | refetch on SUBSCRIBED, focus, visible, org and membership change, 60 s poll. Tests: §3, §3b, §4 of `useWaitingNotices.test.tsx` | closed |
| T-301-14 | D | broken Realtime in the shell | mitigate | try/catch around channel and getSession (`useWaitingNotices.ts:208-253`). Tests: throwing/undefined channel, missing/rejecting getSession | closed |
| T-301-15 | I | a false all-clear | mitigate | failure keeps the last verdict (`useWaitingNotices.ts:126-133`). Tests: first-fetch-rejects and later-failure cases | closed |
| T-301-16 | T | Library badge vs waiting count | mitigate | required `mark`, `conditionsForMark`, `waitingTotal` reads the server total. Tests: `attentionTab`, `NavPanel.badge`, `ChatLayout.badge` | closed |
| T-301-17 | I | question text in the shell | mitigate | wire type and `WaitingCondition` carry no question field; `detail: ""`. Test: `attentionTab` mapping | closed |
| T-301-18 | T | XSS in row text | mitigate | names render as JSX text; no `dangerouslySetInnerHTML` (grep clean) | closed |
| T-301-19 | E/T | row select | mitigate | `condition.onOpen()` → `openRun(run_id)` → LinkGate; no `switchOrg` import. Tests: keyboard/click tests with an uncalled `switchOrg` spy | closed |
| T-301-20 | I | row content on a shared screen | mitigate | row shows title, org, kind, waited phrase, origin only. Test: "shows no raw wire value" | closed |
| T-301-21 | R | false all-clear pill / empty state | mitigate | pill only when answered/stale and total > 0; own loading/failed words. Tests: control state tests | closed |
| T-301-22 | D | FIRING shell re-render | mitigate | minute tick inside the open list only; one stable status state in ChatLayout. Test: minute-tick test | closed |
| T-301-23 | S | silent dismissal | mitigate | no dismiss / mark-read / snooze / clear control. Test: absence by name | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-301-R1 | T-301-10 | Migration 219 is not yet in cloud. Applying it is an operator deploy step: paste into the cloud SQL editor with per-action approval, require `migration_219_verify = PASS`, then run `get_advisors(security)`. Recorded at plan time in 301-01-SUMMARY "Cloud parity". **Still owed at deploy.** | plan-time (301-01), carried into this register 2026-10-30 | 2026-10-30 |

---

## Informational (not threats, not blockers)

1. The 60 s poll calls `setVerdict` with a fresh object (`useWaitingNotices.ts:121`), so the shell re-renders about once a minute even when nothing changed. The hook docblock (`:44-45`) overstates this. Performance only; an equality check before `setVerdict` would fix it.
2. Realtime delivery is gated by recipient, not membership. Someone who left an org still receives change events for their own residual notice rows. The events carry ids only; the person can already SELECT those rows; the client ignores payloads, and the refetch applies the membership join. 219 exposes nothing new.
3. The T-301-04 source scan forbids `get_active_org_id` but not a literal `Header("X-Org-Id")` parameter. The behaviour test covers today's code.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 23 | 23 (22 mitigated, 1 accepted) | 0 | gsd-security-auditor at 6607f509d; tests: backend unit 47 passed, backend live 35 passed (local-DB lock held), frontend 153/153 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
