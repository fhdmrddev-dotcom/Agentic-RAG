---
phase: 134
slug: eval-results-honest-verdict-ratings
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-02
---

# Phase 134 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → API (reads) | Any authenticated user can request an eval readout; RLS + app-code owner gate fence cross-user rows | eval_runs / eval_results / eval_ratings rows (owner-scoped) |
| client → ratings write | FIRST user-initiated write in the eval domain; `result_id` must be owner-verified before any write | rating value + result_id |
| service-role writer → DB | Only the backend service-role task writes eval_runs/eval_results/eval_ratings; writes bypass RLS so the app-code `.eq("user_id")` owner-verify is the real access gate | verdict columns, rating upserts |
| eval answer / expected_behavior → judge | Untrusted model output + user-authored free text cross into the judge prompt; both are DATA, never instructions | arm output, expected_behavior text |
| eval runner → judge provider | The judge is a second provider call per arm on an independent model; must route to the judge provider, not the provider-under-test | judge prompt + API credentials |
| SPA → owner-gated API | The client renders only what owner-scoped routes return and writes ratings only through the Plan-03 owner-gated endpoint | rendered output / verdict_reason, rating writes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-134-01 | Elevation of Privilege | IDOR — rate/read another user's eval result via `result_id`; cross-user eval_ratings read | mitigate | Owner-verify `.eq("id", result_id).eq("user_id", user_id)` BEFORE write, 404 never 403 (`backend/app/api/evals.py:486-504`); read-side gate `evals.py:404-421`; defense-in-depth RLS SELECT `USING (auth.uid() = user_id)` (`supabase/migrations/081_eval_verdict_and_ratings.sql:117-118`); unit test `test_evals_router.py:261-286` | closed |
| T-134-02 | Tampering | Prompt injection via `expected_behavior`/answer coercing a "pass" | mitigate | `expected_behavior` woven as delimited DATA in judge rubric (`backend/app/services/eval_runner_service.py:177-187`); `overall_passed` schema-bound via `forced_emit(schema_model=JudgeVerdict)` (`:247`) | closed |
| T-134-03a | Repudiation / Tampering | Fabricated/gamed judge verdict | mitigate | Schema-bound `forced_emit`; coerced/unparseable emission → `{"failure":…}` → honest `judge_error`/`not_measured` (`eval_runner_service.py:239-265`, `:487-493`); ≤3 retry breaks on first real verdict, never softens `overall_passed=False` | closed |
| T-134-03b | Spoofing / Tampering | Forged owner in ratings write | mitigate | `user_id = current_user["id"]` (`evals.py:483`), upsert payload uses that local never the body (`:532-534`); `RateResultBody` carries only `rating` (`backend/app/models/eval_run.py:31-41`) | closed |
| T-134-04 | Tampering | Client forging eval_ratings/verdict rows | mitigate | RLS enabled with exactly one owner-only SELECT policy, NO client INSERT/UPDATE/DELETE policy (`081_eval_verdict_and_ratings.sql:110-118`); verdict columns service-role-written in same append-only insert (`eval_runner_service.py:342-364`) | closed |
| T-134-05 | Information Disclosure | Orphaned ratings after result/user delete | mitigate | Both FKs `ON DELETE CASCADE` (`081_eval_verdict_and_ratings.sql:83-84`) | closed |
| T-134-06 | Information Disclosure | Raw judge/provider error text leaking into RLS-readable `verdict_reason` | mitigate | Failure reason truncated `[:200]` (`eval_runner_service.py:493`), summary capped `[:2000]` (`:500`), `_truncate_error` (`:162-165`) — never a raw traceback | closed |
| T-134-07 | Denial of Service | Judge mis-routed to provider-under-test SDK → uniform 401/404 verdict failures | mitigate | Provider from judge-model registry (`eval_runner_service.py:216`), explicit `provider=provider` to `forced_emit` (`:242`); unit test `test_eval_runner.py:546-589` asserts judge provider != `active_provider` | closed |
| T-134-08 | Repudiation | Fabricated score on errored/empty arm | mitigate | Gate `status == "completed" and output.strip()` before judge (`eval_runner_service.py:481`); errored arm → `not_measured`, NULL passed (`:476-480`); unit test `test_eval_runner.py:471-503` asserts `judge.await_count == 0` | closed |
| T-134-09 | Tampering | Invalid `rating` value smuggled past the app | mitigate | App gate 400 if not in `("up","down")` (`evals.py:522-526`); DB second gate `CHECK (rating IN ('up','down'))` (`081_eval_verdict_and_ratings.sql:85`) | closed |
| T-134-10 | Denial of Service | Repeated ratings writes | accept | AR-134-01 — idempotent upsert on UNIQUE `(eval_result_id, user_id)` (`evals.py:528-540`, `081_eval_verdict_and_ratings.sql:89`); bounded, no fan-out, owner-scoped low-value target | closed |
| T-134-11 | Tampering | Client forging a rating for another user's result | mitigate | `handleRate` writes only via `rateEvalResult()` → Plan-03 owner-gated PUT (`frontend/src/components/skills/SkillEvalSection.tsx:272-280`); no client-direct Supabase write in component | closed |
| T-134-12 | Information Disclosure | XSS via rendered `output` / `verdict_reason` | mitigate | React text-node escaping: `verdict_reason` in `<p>{…}</p>` (`SkillEvalSection.tsx:449`), `output` in `<pre>{…}</pre>` (`:453-455`), `error` as text (`:457`); no `dangerouslySetInnerHTML` anywhere | closed |
| T-134-13 | Tampering | Additive `eval_verdict` demux branch regressing shared Deep/harness stream dispatch | mitigate | Additive `else if (t === "eval_verdict" …)` with NO `return` (`frontend/src/lib/api.ts:851-857`); cursor advance fires after (`:866`); Deep/harness branches untouched | closed |
| T-134-SC | Tampering | Supply chain (package installs) | accept | AR-134-02 — zero new dependencies this phase (`tech-stack.added: []` in all four SUMMARYs); mirrors AR-133-01 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-134-01 | T-134-10 | Repeated ratings writes are bounded and idempotent — upsert on UNIQUE `(eval_result_id, user_id)` means one row per (user, result), no fan-out; owner-scoped low-value target (`.planning/phases/134-eval-results-honest-verdict-ratings/134-03-PLAN.md:209`) | operator (plan-time disposition) | 2026-07-02 |
| AR-134-02 | T-134-SC | Zero new dependencies shipped in Phase 134 (RESEARCH Package Legitimacy Audit: N/A; `tech-stack.added: []` in all four SUMMARYs); mirrors accepted risk AR-133-01 | operator (plan-time disposition) | 2026-07-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-02 | 15 | 15 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-02
