---
phase: 308-told-by-webhook
status: owed
written_by: 308-06 (D-39, D-40, D-33)
written: 2026-11-04
driven_by: Claude via Chrome MCP at phase verification (G-4)
---

# Phase 308 — Validation: lived-experience rows, the cross-provider decision, and what is owed

The five G-4 rows below are the operator's "I'd recognise failure here" scenarios (D-39), copied verbatim
from `308-UI-SPEC.md` §"Lived-experience (G-4) rows". They are **owed to verification**: Claude drives
each one through Chrome MCP against the local stack, with its own evidence per row (a screenshot or
DOM read for the screen, plus the DB / receiver read that proves it). None of them is run by this
plan. **Run row 1 first** — rows 2, 3 and 5 reuse its endpoint.

## G-4 rows (D-39)

| # | Row | Expected (verbatim, UI-SPEC) | Evidence to capture | Result |
|---|---|---|---|---|
| 1 | **Add, test, verify** | Settings → Webhooks → Add endpoint with a public receiver's https address and the default events → Save endpoint → the secret-once card shows `whsec_…`; Send test reads "Delivered — your receiver answered 2xx in … ms. It is in this endpoint's log."; the receiver's request verifies with `standardwebhooks` and the copied secret; after "I've saved the secret" the card lists the endpoint **On** with one `webhook.test` row, Sent. | screenshot of the verdict + log row; the receiver's captured request run through `Webhook(secret).verify(body, headers)` (the library `test_308_signer_interop.py` pins) | owed |
| 2 | **Exactly one delivery each** | Finish a workflow run and ingest a document; the open card's log shows exactly one `run.finished` and one `document.ingested` row, Sent, with **run …** and **document …** links that open the run and the document in the app. | `SELECT event_type, count(*) FROM webhook_deliveries WHERE endpoint_id = … GROUP BY 1` = 1 each; both links clicked | owed |
| 3 | **Failing → off → told** | Point an endpoint at a receiver answering 500; the log shows Retrying rows with "next …", tries climbing and HTTP 500; after 5 failed deliveries the tag reads **Off — kept failing**, the notice explains, and "Waiting on you" shows a `Webhook` row "… · webhook turned off · kept failing · turned off …" that opens this tab on that endpoint. | log screenshots per step; the `webhook_disabled` notice row; the Waiting row's text and the tab it opens | owed |
| 4 | **The refusal** | Save `http://169.254.169.254/` and an internal host name: each shows exactly "That address can't be reached from the internet, so Syrel won't send to it." under the address, keeps the typed value, and saves nothing. | DOM text under the field; `SELECT count(*) FROM webhook_endpoints` unchanged | owed |
| 5 | **Admin turn-off** | As an org admin, Org admin → API keys → Webhooks lists the member's endpoint (host + path, no query); Turn off → the band pulses and the receipt names owner and host; the member's card reads **Off — turned off by an org admin** with Turn on disabled and "Only an org admin can turn this back on." | admin table DOM (no `?`), receipt text, `webhook.endpoint.disabled` audit row, member card screenshot | owed |

**I'd recognise failure here if:** the log shows any part of a request or response body; an address
refusal shows a code, an IP or any other sentence; a secret appears anywhere after "I've saved the secret"
or after a reload; the admin table shows a query string; a member can turn on an admin-off endpoint; a
disabled button gives its reason only in a tooltip; a delivery row appears for an item the member cannot
open; the Settings strip label is longer than one word; an endpoint's address renders as a link.

### Row 3 method (Pitfall 11)

"Disabled after 5" cannot be driven in real time: the retry schedule is six attempts over about 10.5 h
per delivery. Row 3 is driven on the **LOCAL** database only, one of two ways, and the method used is
recorded in the row's evidence:

1. **The drainer's `now=` pin** — call `WebhookDrainer.tick(now=…)` with `now` advanced past each
   `next_attempt_at` (the seam `tests/integration/test_308_*_live.py` uses), or
2. **SQL** — between attempts, `UPDATE webhook_deliveries SET next_attempt_at = now() WHERE endpoint_id = …
   AND status = 'retrying'` on the local Supabase, then let the running drainer pick it up.

Never against cloud. The auto-disable, the notice, the `webhook.endpoint.auto_disabled` audit row and
the Waiting row are read from the real tables after the fifth failure.

## Cross-provider axis (D-40) — a decision, not an omission

Webhooks are **provider-independent**: the emission triggers see a run's status and a document's
ingest state, never a model, a provider or a tool call. The 8-row native-roster scoreboard
(CLAUDE.md §"UAT scoreboard recipe") is therefore **not applicable** to this phase. To show the
independence rather than assert it, **G-4 row 2 finishes its run on a non-default provider** (any
configured native provider other than the operator's default, chosen per request with `model` +
`provider` on `POST /threads/{id}/messages`), and the delivery is the same one row. The other three
axes: multi-tool and parallel-thread are not exercised by a webhook (it fires after a run, not during
one); long-message does not apply (the payload carries ids and a status, never text).

## Cipher probe (D-53, from 308-04)

`get_cipher() is not None` printed **True** on 2026-11-04 with the worktree's copied `backend/.env`.
No operator action is owed for the cipher. Without one, create and roll answer 503 `no_cipher` and store
nothing (pinned by `test_no_cipher_refuses_and_stores_nothing` and `test_roll_without_a_cipher_is_refused`).

## Interop (D-11, D-57)

`backend/tests/unit/test_308_signer_interop.py` verifies `build_headers` with the reference
`standardwebhooks==1.1.0` (`Webhook(secret).verify`): a plain message, both signatures during a roll's
overlap (each secret alone verifies), a one-byte tamper refused, a 10-minute-old signature refused while
a fresh resend with the same `webhook-id` verifies, and the `whsec_` round trip. The package was checked
before install (`308-standardwebhooks-evidence.md`; 308-06 Task 3).

## OWED — never done by this phase

- **G-4 rows 1-5** above, driven by Claude at verification (row 1 first).
- **Cloud migration 225** (D-33): paste into cloud Supabase **after** 220 → 221 → 222 → 223 → 224, in
  order, **before** the 308 backend deploys, each paste with its own explicit operator approval.
- **`get_advisors(security)`** on cloud right after 225, reading for any new finding on
  `webhook_endpoints` / `webhook_deliveries` / the new trigger functions.
- Deploy is operator-triggered (308 is not deployed by this plan).
