---
status: partial
phase: 308-told-by-webhook
source: [308-VERIFICATION.md, 308-VALIDATION.md, 308-REVIEW-FIX.md]
started: 2026-11-04
updated: 2026-11-04
---

## Current Test

[awaiting human testing — run row 1 first; rows 2, 3 and 5 reuse its endpoint]

## Tests

### 1. G-4 row 1 — add, test, verify (Settings → Webhooks)
expected: Add endpoint at a public receiver's https address with the default events → Save endpoint → secret-once card shows `whsec_…`; Send test reads "Delivered — your receiver answered 2xx in … ms. It is in this endpoint's log."; the receiver's captured request verifies with `standardwebhooks` (`Webhook(secret).verify(body, headers)`); after "I've saved the secret" the card is **On** with one `webhook.test` row, Sent.
note: needs a public receiver (e.g. webhook.site) — sending test payloads to an outside service is an operator decision; loopback receivers are refused by design (D-24).
result: [pending]

### 2. G-4 row 2 — exactly one delivery each
expected: Finish a workflow run (on a non-default provider, D-40) and ingest a document; the open card's log shows exactly one `run.finished` and one `document.ingested`, Sent, with links that open the run and the document. `SELECT event_type, count(*) FROM webhook_deliveries WHERE endpoint_id = … GROUP BY 1` = 1 each.
result: [pending]

### 3. G-4 row 3 — failing → off → told (LOCAL DB only)
expected: Receiver answering 500 → Retrying rows with "next …", tries climbing, HTTP 500 → after 5 failed deliveries the tag reads **Off — kept failing**, the notice explains, and "Waiting on you" shows a `Webhook` row "… · webhook turned off · kept failing · turned off …" that opens this tab on that endpoint. Drive the clock with `tick(now=)` or SQL `next_attempt_at` per 308-VALIDATION §Row 3 method.
result: [pending]

### 4. G-4 row 4 — the refusal
expected: Saving `http://169.254.169.254/` and an internal host name each shows exactly "That address can't be reached from the internet, so Syrel won't send to it." under the address, keeps the typed value, saves nothing (`SELECT count(*) FROM webhook_endpoints` unchanged).
result: [pending]

### 5. G-4 row 5 — admin turn-off
expected: As an org admin, Org admin → API keys → Webhooks lists the member's endpoint with **host only** and a "path hidden" / "query hidden" marker (CR-01 / D-59 supersedes the UI-SPEC's host + path); Turn off → the band pulses and the receipt names owner and host; `webhook.endpoint.disabled` audit row; the member's card reads **Off — turned off by an org admin** with Turn on disabled and "Only an org admin can turn this back on."
result: [pending]

### 6. Review fixes marked "requires human verification" (308-REVIEW-FIX)
expected: WR-01 an endpoint turned off after a claim is not sent to (and an edited URL gets the new address); WR-02 a blackholed endpoint does not stall other endpoints' deliveries; WR-03 an oversized 2xx body counts as delivered and never toward auto-disable; WR-05 an event whose fan-out keeps raising does not block later events.
note: run with the local `uvicorn --reload` backend STOPPED when driving the live suites — its own drainer reclaims test rows (found by the review fixer).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

none — 308-VERIFICATION.md: 5/5 ROADMAP success criteria verified in code and tests.
