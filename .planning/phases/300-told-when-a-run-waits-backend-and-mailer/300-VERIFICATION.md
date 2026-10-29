---
phase: 300-told-when-a-run-waits-backend-and-mailer
verified: 2026-10-29T14:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified in code; 0 failed
overrides_applied: 0
gaps: []
human_verification:
  - test: "G4-1 email arrives once after the delay (real delivery via Resend/SMTP from a built image)"
    expected: "One email, subject '[Test] {Workflow} is waiting on you' on dev, naming workflow, org, minutes and kind; link /app/runs/<id>; a backend restart during the wait still yields one; delivery row 'sent'"
    why_human: "A real send through a provider from a built image cannot be seen from code; Docker is denied to agents and the clean-image test is an AST/requirements closure"
  - test: "G4-2 / G4-3 answer-in-time sends none; opt-out sends none but notice stays"
    expected: "skipped_answered and skipped_opted_out delivery rows, no mail, notifications row present"
    why_human: "Live lived-experience row, needs Chrome plus mail capture"
  - test: "G4-4 invite failure line; G4-5 schedule row words; G4-7 Control Room Email tile; G4-8 email step honesty"
    expected: "As written in 300-VALIDATION section 3"
    why_human: "Operator-recognisable UI states (G-4); not yet driven"
  - test: "G4-6 signed-out email link -> sign in -> lands on /app/runs/<id>"
    expected: "Lands on the run showing the wait"
    why_human: "Depends on Phase 299's postponed G4-4a (sign-in return); the roadmap says 300 closes after 299"
  - test: "FIX-05 cross-provider roster (OpenAI, Anthropic, Google, DeepSeek, Zhipu, MiniMax, Moonshot, OpenRouter), key-launched and schedule-launched, including after the IN-03 change"
    expected: "Resumed phases run on the STARTING provider; workflow_runs.metadata.provider = starting provider"
    why_human: "Live provider calls and keys. IN-03 (b7e03e417) changed provider derivation after the plan; the REVIEW-FIX itself says the roster was not re-run"
  - test: "Three copy strings written by the fixer without a spec: WR-05 save veto ('An email address in the Email card isn't valid. Fix it, then save again.'), IN-01 test-address invite line, IN-04 'Can't send' Email tile state"
    expected: "Operator approves the words (UI-SPEC does not cover them)"
    why_human: "Product wording decision"
  - test: "Four-axis rows MT-1, PT-1, LM-1"
    expected: "Per 300-VALIDATION 2b-2d"
    why_human: "Live multi-tool, parallel-thread and long-message runs"
  - test: "Cloud deploy: paste migration 218 then get_advisors(security); Coolify EMAIL_PROVIDER/RESEND_API_KEY/ENVIRONMENT=production; Resend + DNS (SPF, DKIM, DMARC); one-box SMTP egress; CI image build"
    expected: "No new advisor ERROR; first real cloud send observed on the Email tile"
    why_human: "Operator-gated, each cloud write needs its own approval; not a code gap"
---

# Phase 300: Told When a Run Waits (Backend and Mailer) Verification Report

**Phase Goal:** When a workflow run starts waiting on a person, the system records one notice for its owner and, if still waiting after the delay, sends exactly one content-free email linking to the run, through an app-owned sender that works from a built image; scheduled or API-key runs that pause are launched and resumed correctly first.
**Verified:** 2026-10-29
**Status:** human_needed
**Re-verification:** No, initial verification

All code-observable truths hold. Everything outstanding is a live, provider-side or operator row. No gaps.

## Goal Achievement (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Blank required input on a scheduled run refused before launch, naming the input (FIX-04); paused API-key or schedule run resumes on its starting provider (FIX-05) | VERIFIED in code; roster HUMAN | `schedules.py` `_refuse_blank_required` (create, patch, resume) calling `missing_required_labels` (`inbound_inputs.py`); a second check at fire time in `scheduler_service.py`. `unattended_launch.py` calls `resolve_owner_run_model` once and records `model` + `metadata.provider` on the INSERT and in the first drive ctx. `harness_engine.py`, `run_lifecycle.py`, `run_producer.py` and `inbound.py` untouched. Tests `test_300_schedule_required_inputs.py` and `test_300_unattended_provider.py`. The cross-provider roster has not been driven. |
| 2 | Still waiting after the delay (default 2 min, Settings knob) sends exactly one email to `/app/runs/<id>`; answering in time sends none; restart or second worker never sends two; outcome stored (NOTE-02) | VERIFIED in code; live HUMAN | Migration 218: `notification_email_delay_seconds` default 120 with a bound CHECK. A fail-soft SECURITY DEFINER trigger writes one notice and one delivery per wait; `notification_id` is UNIQUE and there is a partial unique index on `(recipient_id, run_id)` where open. `db/notifications.py` claims with `FOR UPDATE OF d SKIP LOCKED` and flips to `sending` in the same transaction. The drainer re-checks still-waiting, opt-out and address, then renews the lease before sending (WR-03). Resend `Idempotency-Key` is sent. The drainer starts in `main.py` under `RUN_BOOT_SWEEPS` (D-20). Live suites (two drainers produce one send; answered gives `skipped_answered`) passed 74/74 per SECURITY and REVIEW-FIX; not re-run by me. |
| 3 | Email carries only escaped workflow name, org name, wait duration and the link; no question text or token (NOTE-03) | VERIFIED | `test_300_run_waiting_email.py` (only name/org/wait/kind/links, escaping, no token or query) passed in my re-run. The frozen payload comes from the trigger, which never copies the question text. |
| 4 | Opt-out in the user's Settings means no email; the in-app notice is still recorded (NOTE-04) | VERIFIED in code; live HUMAN | Drainer records `skipped_opted_out` and keeps the notice; `/me/preferences` and `EmailNotificationPreference.test.tsx`. |
| 5 | Built image sends via Resend (cloud) and SMTP (one-box) with nothing hand-installed; secret in env, other knobs in Settings; invite email uses the same sender; failed send shown to the inviter (NOTE-06) | VERIFIED in code; deliverability HUMAN | `email_provider.py` (none / Resend REST over httpx / stdlib smtplib off-loop). `test_300_clean_image_imports.py` is an AST/requirements closure, not a Docker build. `test_300_invite_outcome.py` and `InviteMemberDialog.test.tsx` cover the inviter-visible failure. Deploy parity: `check-deploy-drift.sh` PASS per REVIEW-FIX. |

**Score:** 5/5 verified in code.

### "How we'd know this failed" sweep

| Condition | Result |
|-----------|--------|
| Two workers or a restart send twice | Not observed: SKIP LOCKED, unique keys, lease renewal and idempotency key, with live DB tests |
| Email after the question was answered | Not observed: still-waiting re-check, and the lease renewal is after the re-check |
| Body carries question or document text | Not observed: renderer test passes |
| Trigger error breaks the engine's prompt insert | Not observed: whole body in `BEGIN … EXCEPTION WHEN OTHERS`; live test with a planted failing CHECK |
| Notice org from `messages.org_id` | Not observed: org comes from `workflow_runs.org_id`; live test with a message carrying org B |
| Tables readable by anon or other users; new advisor ERROR | Local: REVOKE ALL plus owner-only SELECT policy, no policy on the outbox, EXECUTE revoked from PUBLIC; `test_300_rls_anon_live.py` passes. Cloud advisor read is owed at deploy. |
| Send failure only logged | Not observed: outcome stored, invite shows the failure, Email tile exists |
| Dev mail reaches a real inbox | Guard exists (test-address redirect or hold-back); IN-02 removed the token and recipient leak from held-back logs |
| Tool-round cap pause or chat `ask_user` produces a notice | Not observed: trigger fires on harness rows for live, non-golden, owned workflow runs only; `cap_paused` is never written to `workflow_runs` |
| `harness_engine.py` edited to emit notices | Not observed: no commits in the window |
| Clean-image test passes only because the dev venv has the package | Mitigated: the test is an AST/requirements closure, no new package. CI image build remains the authority. |

## Requirements Coverage

| Requirement | Plan(s) | Status | Evidence |
|-------------|---------|--------|----------|
| NOTE-02 | 300-02, 300-04, 300-05 | SATISFIED in code (live row owed) | See SC2 |
| NOTE-03 | 300-03, 300-04 | SATISFIED | See SC3 |
| NOTE-04 | 300-02, 300-04, 300-05 | SATISFIED in code | See SC4 |
| NOTE-06 | 300-03, 300-05, 300-04 | SATISFIED in code (live row owed) | See SC5 |
| FIX-04 | 300-01 | SATISFIED | See SC1 |
| FIX-05 | 300-01 | SATISFIED in code (roster owed) | See SC1 |

All six IDs appear in the plans' frontmatter and in REQUIREMENTS.md. No orphans: NOTE-01 and NOTE-05 map to Phase 301 and are out of scope here. REQUIREMENTS.md checkboxes and traceability rows still read Pending, which is a bookkeeping update for the orchestrator at close.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase unit suites | `pytest tests/unit/test_300_*.py -q` | 287 passed | PASS |
| Live DB suites | not re-run by me | executors and SECURITY report 74 passed under the lock | Reported only |
| Gates | not re-run | backend 69 failed (ceiling 71), count gate OK 13300 with 0 failing, tsc 61 = base, deploy drift PASS | Reported only |

## Probe Execution

Step 7c: SKIPPED (no probe scripts declared or conventional for this phase).

## Anti-Patterns

I did not scan every file for debt markers. Review and security passes are clean: 41/41 threats closed. The one residual, UF-1 (same-org cross-thread answer closing a notice), is recorded in SEED-396, not hidden. IN-05 (From header not frozen across Resend retries) and IN-06 (overlapping schedule-modal refreshes) are deferred low-impact items. Neither contradicts a success criterion. Both are warnings only.

## Notes and caveats

- Migration 218 is applied locally only. Cloud paste is an operator action at deploy, not a gap.
- IN-03 (`b7e03e417`) changed `resolve_owner_run_model` after the plan. The provider is now derived from the model, not from `active_provider`. It is unit-tested and smoke-run, but the D-17 roster has not been re-driven, so SC1's second half rests on human verification.
- G-7: no closing round is warranted. Every success criterion is met in code, so stopping is a real option and the remaining work is live and operator rows.
- `300-VALIDATION.md` has status `planned`; no G-4 or four-axis row has been recorded as driven.

## Gaps Summary

None. Status is `human_needed` because the human verification list above is non-empty. Per the Step 9 decision tree, that takes priority even though all truths are VERIFIED in code.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
