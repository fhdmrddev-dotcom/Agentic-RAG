---
phase: 308-told-by-webhook
plan: 02
subsystem: webhooks (outbound half — egress, URL rules, payloads, signer, sender)
tags: [webhooks, egress, ssrf, signing, standard-webhooks, redaction]
requires: []
provides:
  - "egress capability 'webhook' (_CALLER, empty tuple, https only)"
  - "backend/app/services/webhook_urls.py: check_webhook_url, host_of, admin_display, WebhookUrlError, MAX_URL_LENGTH"
  - "backend/app/models/webhook.py (payload half): RunEvent/DocumentEvent/TestEvent + data models, serialize_payload, build_run_event/build_document_event/build_test_event, TEST_MESSAGE"
  - "outbound_guard.guard(..., textless_ok=False) opt-in"
  - "backend/app/services/webhook_signer.py: SECRET_PREFIX, new_secret, sign, message_id, build_headers"
  - "backend/app/services/webhook_sender.py: send, classify, parse_retry_after, freeze_payload, SendOutcome, ERROR_WORDS, WEBHOOK_TIMEOUT_SECONDS, WEBHOOK_SEND_BOUND_SECONDS, RESPONSE_CAP_BYTES"
affects: [308-03 drainer, 308-04 routes (validator, Test, admin list), 308-06 interop proof]
tech-stack:
  added: []
  patterns: ["one egress door per outbound send (_CALLER capability)", "typed text-free payload + guard opt-in", "pure classification table"]
key-files:
  created:
    - backend/app/services/webhook_urls.py
    - backend/app/models/webhook.py
    - backend/app/services/webhook_signer.py
    - backend/app/services/webhook_sender.py
    - backend/tests/unit/test_308_egress_capability.py
    - backend/tests/unit/test_308_webhook_urls.py
    - backend/tests/unit/test_308_ssrf_corpus.py
    - backend/tests/unit/test_308_payload.py
    - backend/tests/unit/test_308_signer.py
    - backend/tests/unit/test_308_sender.py
  modified:
    - backend/app/security/egress.py
    - backend/app/services/outbound_guard.py
decisions:
  - "send() classifies only egress / httpx transport / timeout / OS errors; any other exception propagates to the drainer's per-row error path (308-03) rather than being mislabelled with a network error word"
  - "ERROR_WORDS is exported and pinned equal to migration 225's last_error CHECK set"
  - "payload timestamps are AwareDatetime; TestEvent/TestEventData carry __test__ = False so pytest never collects them"
metrics:
  duration: "~50 min (incl. ~20 min waiting on 308-01's local-DB lock)"
  completed: 2026-11-04
  tasks: 3
  files: 12
---

# Phase 308 Plan 02: The outbound half of webhooks — egress, URL rules, payloads, signer, sender — Summary

One closed `webhook` egress capability (three dict entries), a pure URL-rules module, typed text-free
Standard Webhooks payloads that survive the PII guard byte-identically through a single
`textless_ok` opt-in, a stdlib-only Standard Webhooks signer, and a one-send sender that goes through
`egress.send_pinned_http("webhook", …)` only and classifies every outcome into migration 225's error words.

## Tasks

| Task | Name | RED | GREEN |
|---|---|---|---|
| 1 | `webhook` egress capability, URL rules, SSRF corpus at save and send | 10bc5c6f6 | df68b0edc |
| 2 | Typed text-free payloads + the guard's `textless_ok` opt-in | cb2a3a3aa | 018c14288 |
| 3 | Standard Webhooks signer + one-send sender with its classification table | 8e07193c8 | 338db330e |

Every RED was confirmed failing (collection errors / 6 failures) before its GREEN.

## Evidence

- **egress.py:** `git diff --numstat d874e7c81 -- backend/app/security/egress.py` = `3 0`. `test_190_egress.py` diff empty (D-45). Every suite reading the capability tables green: test_190_egress, test_307_cimd_fetch, test_221_application_grouping, test_google_reads, test_google_round1, test_service_tools (119 + 185 passed).
- **outbound_guard.py:** the only removed line is `        return WITHHELD` (now under `if not (textless_ok and isinstance(model, BaseModel)):`). `grep -rn textless_ok backend/app/mcp/` = 0, and an AST fence pins it. Every `test_305*` suite passes unedited (`-k "308_payload or 305"`: 468 passed).
- **SSRF corpus:** **19 save-time cases** (http, localhost, 127.0.0.1, [::1], 10/8, 172.16/12, 192.168/16, 100.64/10, 169.254.169.254, metadata.google.internal, [::ffff:127.0.0.1], decimal, hex, 127.1, octal, two userinfo forms, a public name answering private, one private answer among public ones). **17 send-time egress cases**, plus the DNS flip (public at save, 127.0.0.1 at send: refused, two lookups, no transport call) and the 302 to 169.254.169.254 (`redirected`, exactly one request). Sender-level: 6 URL-rule cases never reach egress (spy). No case does a real DNS lookup: the module-wide fixture swaps `egress._default_resolver` for one that raises.
- **Signer:** known-answer HMAC vectors are recomputed with stdlib. The header set is exactly five, the overlap order is new then old, separated by a space, and no log record carries the secret. Imports are `__future__`, `base64`, `hashlib`, `hmac`, `secrets` only.
- **Sender greps:** `AsyncClient` = 0 in both modules; `send_pinned_http(` = 1; `send_pinned_http\("webhook"` = 1; no logger line names url, body or secret.
- **All six 308-02 suites:** 211 passed.
- **Backend baseline** (`node scripts/check-backend-unit-baseline.cjs -- -rf`, run under the local-DB lock): **70 failed, 12537 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors. GATE PASSED (70 <= 71).** Failing-set diff: the 70 ids sit in 23 files. None is a 308-02 file, and none references egress, outbound_guard or webhook (the grep hits were all the word "regression"). Every failing file is byte-unchanged by this plan. Example: `test_190_review_fix_data_layer::test_CR01…` fails on `connector_service._RESPONSE_KEYS` (`account_email` / `account_name`), which this plan does not touch. **No new failing id.**
- `node scripts/check-hot-file-ledger.cjs .planning/phases/308-told-by-webhook` → `ledger gate OK`.
- **Reference-library interop is OWED to 308-06 (D-57).** Here the signer is proven only by its own known-answer tests.

## Deviations from Plan

### Auto-adjusted

1. **[Rule 2 - correctness] `send()` does not swallow unknown exceptions.** The sender classifies egress refusals, egress size/decode errors, httpx transport errors, timeouts and OS errors. Anything else propagates, and `classify(exc=…)` raises `TypeError` for an unknown class. Without this, a programming error would be recorded as a network error word that migration 225's CHECK does accept but that would be false. 308-03's per-row error path handles the propagation.
2. **`parse_retry_after(value, *, now=None)`:** an optional `now` test seam beside the planned signature.
3. **`ERROR_WORDS` export:** pinned equal to migration 225's `last_error` CHECK set, so the sender cannot invent a word the table refuses.
4. **The outbound_guard D-41 note is a comment under the docstring, not a docstring edit.** That keeps the acceptance rule "only the gate's lines are removed" literally true.
5. **`TestEvent` / `TestEventData` carry `__test__ = False`** so pytest never tries to collect them when 308-04's tests import them.
6. **`https:///path` and `https://:443/x` are `no_host`; `https://` is `not_url`.** Both codes are distinct, as the behavior list asks.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: log-disclosure | backend/app/security/egress.py (httpx inside `send_pinned_http`) / backend/app/services/logging_sink.py | Measured: httpx logs `HTTP Request: POST https://<pinned ip>/<path>?<query> "HTTP/1.1 200 OK"` at INFO, which includes a receiver's path and query tokens. It is silent at the default root WARNING. But the opt-in file log sink (`logging_sink.py:211`) lowers root to INFO, and its redacting filter does not cover URL paths or queries. This affects every egress caller (307's CIMD fetch too). It is not fixable inside 308-02's file budget (D-37 freezes egress.py; main.py belongs to another plan). **Recommended for 308-03 (it wires main.py per D-50):** `logging.getLogger("httpx").setLevel(logging.WARNING)`. The sender's own log lines are clean, and the test scopes its scan to `app.*` loggers for this reason. |

## Known Stubs

None. `models/webhook.py` deliberately holds only the payload half; 308-04 appends the route DTOs.

## TDD Gate Compliance

All three tasks have a `test(308-02)` commit followed by a `feat(308-02)` commit. No refactor commits were needed.

## Self-Check: PASSED

- All 10 created files and 2 modified files exist on disk.
- Commits 10bc5c6f6, df68b0edc, cb2a3a3aa, 018c14288, 8e07193c8, 338db330e are present in `git log`.
- No local-DB mutation came from this plan's suites. The one full baseline ran under the shared lock after 308-01 released it.
- STATE.md and ROADMAP.md are untouched.
