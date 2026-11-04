---
phase: 300-told-when-a-run-waits-backend-and-mailer
plan: 03
subsystem: email
tags: [mailer, resend, smtp, invitations, workflow-email-step, deploy-parity, security]
requires:
  - app_settings.notification_email_delay_seconds / email_from_address / email_from_name / email_dev_redirect_address (300-02, migration 218)
  - org_invitations.email_delivery / email_failed_at / email_failure (300-02, migration 218)
  - app.api.api_docs.is_production_environment (the one home of the production check)
provides:
  - "email_provider: OutboundEmail, SendOutcome, configured_provider, one_line, shell_html, send_email, send_invite, compose_invite_link, RESEND_EMAILS_URL, USER_AGENT"
  - "run_waiting_email: duration_words, RenderedEmail, render_run_waiting"
  - "UserEffectiveSettings: notification_email_delay_seconds, email_from_address, email_from_name, email_dev_redirect_address"
  - "config: smtp_host, smtp_port, smtp_username, smtp_password, smtp_security; EMAIL_PROVIDER none | resend | smtp"
  - "invite wire: POST /org/invitations and /resend carry email_delivery; GET /org/invitations rows carry email_delivery (or null)"
affects: [300-04, 300-05, 301]
tech-stack:
  added:
    - "markdown-it-py>=4.0.0 (declared; already in the image transitively)"
  removed:
    - "the resend SDK lazy import (never installed in the built image)"
  patterns:
    - "one mail seam that never raises: every failure is a SendOutcome with a short, secret-free reason and a retryable flag"
    - "dev guard inside the seam: outside production redirect to the Settings test address with [Test], else suppressed"
    - "import closure checked by AST against requirements.txt, never by importing in the venv"
key-files:
  created:
    - backend/app/services/run_waiting_email.py
    - backend/tests/unit/test_300_mailer.py
    - backend/tests/unit/test_300_clean_image_imports.py
    - backend/tests/unit/test_300_run_waiting_email.py
    - backend/tests/unit/test_300_invite_outcome.py
    - backend/tests/unit/test_300_email_step_honesty.py
  modified:
    - backend/app/services/email_provider.py
    - backend/app/config.py
    - backend/app/models/user_settings.py
    - backend/app/api/org.py
    - backend/app/services/connectors/smtp_adapter.py
    - backend/app/services/harness/phase_types.py
    - backend/requirements.txt
    - backend/.env.example
    - deploy/onebox.env.example
    - docker-compose.prod.yml
    - docs/OPERATOR.md
    - scripts/check-deploy-drift.sh
    - backend/tests/unit/test_276_invite_email_brand.py
    - backend/tests/unit/test_190_smtp_header_injection.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/STATE.md
decisions:
  - "send_invite was built in Task 1, not Task 2: the re-pointed test_276 (D-34) calls it, so Task 1 could not go green without it. Task 2 deleted the temporary get_email_provider shim."
  - "The none provider and the dev guard both return suppressed; send_invite logs the invite link whenever the outcome is suppressed, so the offline flow keeps working outside production too."
  - "A recipient that is not a single local@domain, or an empty sender address, fails before any transport is opened; RESEND_API_KEY / SMTP_HOST unset also fail without a request."
  - "SMTP_* are active (empty) in backend/.env.example, COMMENTED in the one-box preset, and registered in OMITTED_FROM_ONEBOX with the reason."
  - "Workflow email step links are kept only for http, https and mailto (validateLink narrowed), beyond markdown-it's default javascript:/data: refusal, to match UI-SPEC S7b's allow-list."
  - "The send_email receipt falls back to the bare host when the resolved inputs carry no 'to'."
metrics:
  duration: ~1 h 40 min
  completed: 2026-10-29
  tasks: 3
  files: 23
---

# Phase 300 Plan 03: One app mailer, the run-waiting email, invite outcome, honest email step — Summary

**Invitation and run-waiting email now go through one never-raising `send_email` seam that works from a built image (Resend over REST with httpx, the operator's mail server over stdlib SMTP, or a log-only default), with development mail held back unless a test address is set. The run-waiting renderer can only say five things. Invites report whether their email went, and the workflow email step names its recipient and sends readable HTML.**

## What was built

### Task 1: one mailer (D-21, D-10, D-08, D-28, D-34)
- `email_provider.py` was rewritten. `send_email(OutboundEmail, *, idempotency_key) -> SendOutcome` supports three providers:
  - `none`: returns `suppressed` and opens nothing.
  - `resend`: POSTs to `RESEND_EMAILS_URL` with `Authorization`, `User-Agent: Syrel-mailer/1`, `Content-Type` and an optional `Idempotency-Key`, through the `_http_client` seam.
    - 429, 5xx, `409 concurrent_idempotent_requests` and network errors fail as retryable.
    - 400, 401, 403, 422 and `409 invalid_idempotent_request` fail as not retryable.
    - The error `name` is read only when it looks like an enum value. The response body is never logged.
  - `smtp`: plain `smtplib.SMTP` / `SMTP_SSL` with STARTTLS, SSL or no TLS. It logs in only when a username is set and always attempts `quit`. A refused recipient counts as a failure.
- Development guard: it calls `is_production_environment()`. Outside production, mail goes to the Settings test address with `[Test] ` in front of the subject. With no test address set, the email is `suppressed`. Production ignores the test address.
- Sender: From is `formataddr((name, address))`. The Settings address falls back to `INVITE_FROM_EMAIL`. No reply address header is set.
- Header safety: `one_line` replaces CR, LF, every control character and the Unicode line separators with a space.
- The UI-SPEC S1 shell is in `shell_html`, and `send_invite` uses it with a plain-text alternative.
- `config.py` gains five `smtp_*` fields. `user_settings.py` gains the four migration-218 knobs, each with an `_val` loader line.
- `requirements.txt` now declares `markdown-it-py>=4.0.0`.
- Deploy parity landed in the same commit: `backend/.env.example`, the one-box preset, the compose file and `OPERATOR.md`. `OPERATOR.md` now covers the three providers, the SMTP vars, the Settings knobs (no seed row, no migration filename), `ENVIRONMENT=production`, SPF/DKIM/DMARC `p=none` at Hostinger, outbound SMTP on the VPS, and the fact that the first-ever production send is the G-4 row. The drift script was updated in the same commit.
- `test_276_invite_email_brand.py` was re-pointed onto the captured httpx request body (D-34), and its fake `resend` module was removed.

### Task 2: the renderer and the invite outcome (NOTE-03, D-02..D-06, D-11, D-22)
- `run_waiting_email.py` (new, pure) has two functions:
  - `duration_words` turns seconds into floor words.
  - `render_run_waiting(*, workflow_name, org_name, waited_seconds, run_id, kind)` takes exactly those five keyword-only inputs. A test pins the signature.
- The renderer's output:
  - Subject `{name} is waiting on you`, cut at 120 characters and never HTML-escaped.
  - HTML is escaped and sits on the shell, with the Settings footer.
  - The plain text is the seven-line layout, word for word.
  - The links are `/app/runs/<id>` and `/app/settings` on the primary origin, with no token and no query string.
- `org.py` changes:
  - Both send sites call `outcome = await run_in_threadpool(send_invite, ...)` inside the existing try. A raise becomes `failed`.
  - One helper, `_record_invite_delivery`, maps the outcome to the wire word and stores `email_delivery` (plus `email_failed_at` and `email_failure` when the send failed) on the caller's user-JWT connection. It has its own try/except, so storing the outcome can never fail the invite.
  - Both responses gain `email_delivery`, and so do the list's columns and rows.
  - Failure logs name the invitation id, never the address.

### Task 3: the workflow email step (D-23, D-24, D-32)
- `smtp_adapter.py`:
  - One module-level `_MD = MarkdownIt("js-default", {"breaks": True, "html": False})`, with image, table, strikethrough and hr turned off. Headings are capped at h3, and links are kept only for http, https and mailto.
  - The body is sent as `_markdown_to_text(body)` plus one `add_alternative(<UI-D15 wrapper>, subtype="html")`. The plain-text version drops the markdown markers, keeps line breaks, lists items as `- `, writes links as `text (url)`, and leaves one blank line between blocks.
  - The schema comment and the body description were updated. CC, BCC and attachments are still refused.
- `phase_types.py`: one hunk inside `_external_action_sent_body`. For `send_email` the first line now reads "Sent. Sends an email — the mail server accepted it.", and the destination line reads "Destination: {to} (via {host})". Every other capability's receipt is unchanged byte for byte; the test compares it to the pre-300 literal.
- `STATE.md → Guardrail overrides` gained exactly one bullet, the 300-03 G-5 override for `phase_types.py`. The owed refactor is NOT discharged.
- The OpenAPI snapshot is fresh (`test_276_openapi_snapshot_fresh` passes), so it was not regenerated.

## Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `c2a04fdee` | test(300-03): one mailer — Resend REST, SMTP, dev guard, clean image (RED) |
| 1 | GREEN | `bfd33bcc1` | feat(300-03): one app mailer — Resend REST and SMTP from a built image, dev mail held back (D-21, D-10, D-28) |
| 2 | RED | `8fbd20f8a` | test(300-03): content-free run-waiting email and visible invite outcome (RED) |
| 2 | GREEN | `23987a567` | feat(300-03): run-waiting email renderer; invite email on the shared shell with its outcome shown (NOTE-03, D-11) |
| 3 | RED | `6898a6568` | test(300-03): the email step names its recipient and sends rendered markdown (RED) |
| 3 | GREEN | `ffebe0ab6` | fix(300-03): the email step names who it sent to and sends readable mail (D-23, D-24) |

## Plan-end gates (verdict lines verbatim)

- Backend unit baseline (under the local-DB lock): `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` (69 failed, 10588 passed, 1 skipped, 2 xfailed, 2 xpassed)
- Hot-file ledger: `ledger gate OK — every watched file has a row.`
- CLAUDE.md size: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- Deploy drift: `RESULT: PASS — the one-box deploy artifacts are in sync.` (two WARNs carried over from the base: the seed-like 215/216/218 notice and the structural compose fallback used because docker is denied in the agent shell)
- Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`): `count gate OK — 567/567 pinned files present, no per-file decrease, 0 failing.`
- Frontend typecheck (`npx tsc -p tsconfig.app.json --noEmit`): 61 `error TS` lines, the same as the base's 61 (no frontend file changed)
- Plan verification suites: test_300_mailer, test_276_invite_email_brand, test_300_clean_image_imports, test_300_run_waiting_email, test_300_invite_outcome, test_300_email_step_honesty, test_190_smtp_header_injection, test_276_openapi_snapshot_fresh and tests/test_167_invitations all pass
- Acceptance greps:
  - `import resend` under backend/app reads 0.
  - markdown-it-py is declared once.
  - RESEND_EMAILS_URL appears 3 times and Idempotency-Key 2 times.
  - reply-to reads 0.
  - `run_in_threadpool(send_invite` appears 2 times.
  - get_email_provider reads 0 (searched across backend/app and backend/tests).
  - `"email_delivery"` appears 3 times in org.py.
  - `the mail server accepted it` appears once.
  - The phase_types.py diff against base has 1 hunk.
  - `MarkdownIt("js-default"` appears once, `"commonmark"` 0 times and `add_alternative(` once.
  - OPERATOR.md's `NNN_name.sql` count is 15, unchanged from the base.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `send_invite` built in Task 1 instead of Task 2**
- **Found during:** Task 1 (RED)
- **Issue:** Task 1 re-points `test_276` onto the REST provider through `send_invite`, so Task 1's GREEN needs it.
- **Fix:** Built it in Task 1. Task 2 tests its HTML and text layout and deletes the temporary `get_email_provider` shim, as the plan allowed.
- **Commits:** `bfd33bcc1`, `23987a567`

**2. [Rule 1 - Test asserted superseded behaviour] `test_190_smtp_header_injection.py` clean-send case**
- **Found during:** Task 3 (GREEN)
- **Issue:** `msg.get_content()` raises `KeyError` on a `multipart/alternative` message. D-24 makes every step email multipart by design.
- **Fix:** The test now reads the body from the `text/plain` part (`get_body(preferencelist=("plain",))`), with a dated comment. The property it checks is unchanged, and every T12 header-injection case still passes. The file is outside the plan's `files_modified`.
- **Commit:** `ffebe0ab6`

**3. [Rule 2 - Missing critical] Reply-To wording and recipient validation**
- The acceptance grep requires zero `reply-to` mentions in `email_provider.py`, so the docblock says "no reply address header".
- An unusable recipient (not a single `local@domain`, or containing control characters) fails before any transport is opened. A missing `RESEND_API_KEY` or `SMTP_HOST` also fails without a request.
- **Commit:** `bfd33bcc1`

**4. [Rule 2] The workflow email step only links http, https and mailto**
- markdown-it's default refuses only `javascript:`, `vbscript:`, `file:` and `data:`. UI-SPEC S7b allows only http, https and mailto, so `validateLink` was narrowed to match. A relative link renders as plain text.
- **Commit:** `ffebe0ab6`

## TDD Gate Compliance

Each task has its `test(...)` RED commit before its `feat`/`fix` GREEN commit. Each RED run failed for the expected reason before implementation: the mailer names were missing, `run_waiting_email` was missing, and the receipt/multipart behaviour was missing.

## Known Stubs

None. `run_waiting_email.render_run_waiting` has no caller yet. Its caller, the drainer, is 300-04's planned consumer of this contract.

## Threat Flags

None beyond the plan's threat register. The new outbound surfaces (the Resend API and the operator's SMTP relay) are T-300-20, T-300-21 and T-300-25 there, and each is mitigated as planned.

## Self-Check: PASSED

All six created files exist. All six commits (c2a04fdee, bfd33bcc1, 8fbd20f8a, 23987a567, 6898a6568, ffebe0ab6) are in `git log 159fd721c..HEAD`, and no tracked file was deleted.
