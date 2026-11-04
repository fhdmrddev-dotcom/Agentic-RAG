---
phase: 308-told-by-webhook
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - .github/workflows/backend-tests.yml
  - backend/app/api/notifications.py
  - backend/app/api/webhooks.py
  - backend/app/db/notifications.py
  - backend/app/db/webhook_outbox.py
  - backend/app/db/webhooks.py
  - backend/app/main.py
  - backend/app/models/webhook.py
  - backend/app/security/egress.py
  - backend/app/services/audit_service.py
  - backend/app/services/outbound_guard.py
  - backend/app/services/rate_limit.py
  - backend/app/services/webhook_drainer.py
  - backend/app/services/webhook_sender.py
  - backend/app/services/webhook_signer.py
  - backend/app/services/webhook_urls.py
  - backend/requirements-dev.txt
  - supabase/migrations/225_webhooks.sql
  - scripts/full-schema-supplement.sql
  - scripts/check-migration-225-live.py
  - frontend/src/components/settings/webhooks/DeleteWebhookSheet.tsx
  - frontend/src/components/settings/webhooks/RollWebhookSecretSheet.tsx
  - frontend/src/components/settings/webhooks/WebhookDeliveryLog.tsx
  - frontend/src/components/settings/webhooks/WebhookEndpointCard.tsx
  - frontend/src/components/settings/webhooks/WebhookEndpointForm.tsx
  - frontend/src/components/settings/webhooks/WebhookSecretOnce.tsx
  - frontend/src/components/settings/webhooks/WebhooksTab.tsx
  - frontend/src/components/settings/webhooks/webhookFacts.ts
  - frontend/src/components/settings/webhooks/webhookFocus.ts
  - frontend/src/components/settings/webhooks/webhookSnippets.ts
  - frontend/src/components/settings/webhooks/webhooksCopy.ts
  - frontend/src/lib/api/webhooks.ts
  - frontend/src/lib/api/notifications.ts
  - frontend/src/components/org/OrgWebhooks.tsx
  - frontend/src/components/org/OrgApiKeysTab.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/WaitingOnYouControl.tsx
  - frontend/src/components/layout/WaitingOnYouList.tsx
  - frontend/src/components/layout/attentionConditions.ts
  - frontend/src/components/layout/waitingVocabulary.ts
  - frontend/src/components/settings/settingsTabs.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/landing/facts.ts
  - scripts/build-public-openapi.cjs
  - scripts/vitest-count-gate.cjs
findings:
  critical: 1
  warning: 6
  info: 7
  total: 14
status: issues_found
---

# Phase 308: Code Review Report

**Reviewed:** 2026-11-04
**Depth:** standard (with call-chain reads into `egress.py`, `principal_liveness.py`, `acting_member.py`, `dependencies.py`, `secret_cipher.py`, migration 218 and `full-schema.sql` where a finding depended on them)
**Files Reviewed:** 47
**Status:** issues_found

## Narrative Findings (AI reviewer)

### Summary

I checked the phase's own failure list item by item.

**Held, confirmed by reading the code path:**
- **Exactly-once.** Fan-out is `UNIQUE (endpoint_id, event_id)` plus `ON CONFLICT DO NOTHING`. The send claim does the `'sending'` flip inside the `SKIP LOCKED` transaction. The lease renew and every record are guarded by `status='sending' AND attempts=$n`.
- **Triggers.** Errors are swallowed and warned, so a trigger failure cannot break the writer. Both functions are `SECURITY DEFINER` with `search_path=''`. EXECUTE is revoked from PUBLIC first.
- **Table access.** The four tables carry no grant and no policy for anon or authenticated.
- **Owner predicate.** It is bound in every member statement in `db/webhooks.py`.
- **Secrets.** They are never projected outside `get_endpoint_signing`.
- **Egress and URL rules.** Every send goes through `egress.send_pinned_http` under the `webhook` capability: pinned, redirects refused. `check_webhook_url` is re-run before each send.
- **Payloads.** They are typed, text-free models, and the D-41 `textless_ok` change is used only by `webhook_sender`.
- **Signing** matches Standard Webhooks: `{id}.{ts}.{body}`, the base64 key is decoded, and multiple signatures are space-separated.
- **Waiting-on-you list.** It binds `e.user_id = $1` and the member join, and the 300 email drainer cannot see a `webhook_disabled` notice.

**Did not hold:**
- The org-admin view leaks real receiver tokens (CR-01). This item is on the phase's own failure list.
- "Turn off" does not stop a delivery batch that has already been claimed (WR-01).
- One member's blackholed endpoint can stall delivery for every tenant (WR-02).
- A large 2xx response body is recorded as a failure and counts toward auto-disable (WR-03).
- Fan-out has no per-event failure bound (WR-05).
- `HTTPS://…` passes every app check and then 500s on the DB CHECK (WR-04).
- The "Waiting on you" webhook row does nothing when Settings is already open (WR-06).

## Critical Issues

### CR-01: Admin view and audit rows show receiver tokens: D-51's 16-character mask misses Zapier, and the host is never masked

**File:** `backend/app/services/webhook_urls.py:81-87` (also `backend/app/api/webhooks.py:173`, `backend/app/services/webhook_drainer.py:150`, `frontend/src/components/org/OrgAuditTab.tsx` `webhookHost`, `frontend/src/components/admin/AuditTab.tsx` `webhookHost`)

**Issue:** `admin_display` masks only path segments of 16 or more characters. D-51 names Zapier as the reason the mask exists. Zapier catch hooks have the shape `https://hooks.zapier.com/hooks/catch/<7-digit id>/<7-char token>/`, and every segment is under 16 characters. I ran it:

```
admin_display('https://hooks.zapier.com/hooks/catch/1234567/abc1234/')
-> ('hooks.zapier.com', '/hooks/catch/1234567/abc1234/', False)
```

So an org admin's `/org/webhooks` list shows the complete, working capability URL. Anyone holding it can POST to it and fire the member's Zap.

The host is never masked either. Pipedream (`https://eo<random>.m.pipedream.net`) and similar per-endpoint-subdomain receivers carry the token in the host. That host also goes into every `webhook.endpoint.*` audit row's metadata, so it reaches the org audit tab and the operator audit tab.

The code matches D-51 to the letter, but D-51 does not do what it says. The phase failure list names "an admin view leaking a query string or path token" as a failure.

**Fix:** Mask by shape, not by length. Show only the host and the first path segment, and mask every later segment:

```python
def admin_display(url: str) -> tuple[str, str, bool]:
    parts = urlsplit(url)
    segs = parts.path.split("/")
    # keep "" and the first real segment; mask everything after it
    masked = "/".join(s if i <= 1 or not s else MASK for i, s in enumerate(segs))
    return (parts.hostname or "").lower(), masked, bool(parts.query)
```

For the host, mask any leftmost label of 12 or more characters, or any label that is mostly hex or digits (Pipedream, ngrok-style). Apply the same treatment to the `host` written into audit metadata, or audit the registrable domain only. Pin a Zapier fixture and a Pipedream fixture in `test_308_webhook_urls.py`.

## Warnings

### WR-01: Turning an endpoint off, or changing its URL, does not stop deliveries already claimed. The drainer uses the `enabled` flag and URL read at claim time

**File:** `backend/app/services/webhook_drainer.py:327-367`, `backend/app/db/webhook_outbox.py:137-168`

**Issue:** `CLAIM_DELIVERIES_SQL` copies `e.enabled` and `e.url` into `ClaimedWebhookDelivery` when the batch is claimed. `_process` checks `row.enabled`, the snapshot, and then sends to `row.url`. Nothing re-reads the endpoint before the send:
- `RENEW_LEASE_SQL` checks only the delivery row.
- `SKIP_PENDING_SQL` (admin or owner turn-off, auto-disable) moves only `pending`/`retrying` rows and never touches `sending` rows.

A batch is up to 20 rows processed one after another, each bounded at 15 s, so a claimed batch can keep sending for about 5 minutes.

Scenario: an org admin turns off a member's endpoint (HOOK-06, reason `admin`) because it points somewhere it should not. Every delivery the drainer already claimed for it is still signed and sent afterwards. The same applies when the owner edits the URL to move off a compromised receiver: the claimed rows go to the old URL. The same applies when another worker auto-disables the endpoint (`failing`/`gone`) mid-batch.

The module docblock claims these checks run "OUTSIDE any transaction, on fresh reads, in this order: enabled? …". For `enabled` and `url` that is not true.

**Fix:** Have the lease renew re-read the endpoint and return the URL to use, so the check and the send target come from the same read:

```sql
-- RENEW_LEASE_SQL
UPDATE public.webhook_deliveries d
   SET claimed_at = COALESCE($3::timestamptz, now())
  FROM public.webhook_endpoints e
 WHERE d.id = $1 AND d.status = 'sending' AND d.attempts = $2
   AND e.id = d.endpoint_id AND e.enabled
RETURNING e.url
```

If no row comes back, re-check `enabled` and record `skipped_disabled` (guarded by attempts). Then send to the URL that was returned, not to `row.url`.

### WR-02: One member's blackholed endpoint stalls webhook delivery for every org on the deployment

**File:** `backend/app/services/webhook_drainer.py:301-324`, `backend/app/services/webhook_sender.py:60-62`

**Issue:** `_send_pass` handles its claimed rows one after another (`for row in claimed: await self._process(...)`). Each send can take up to `WEBHOOK_SEND_BOUND_SECONDS = 15`. There is one drainer per worker (2 workers by default), so platform-wide throughput toward a non-answering receiver is roughly 2 deliveries per 15 s.

Scenario: a member registers a public address that drops packets, subscribed to `document.ingested`, in a busy org. Every ingested document they can see adds a delivery. Each attempt burns 10-15 s of a shared serial sender, and each delivery is retried 6 times over 10.5 h. Auto-disable needs 5 deliveries to fully fail, so it cannot fire for at least 10.5 h. Meanwhile every other tenant's `run.finished` / `run.waiting` deliveries queue behind these rows (`ORDER BY d.next_attempt_at`). This is a cross-tenant availability problem, not just a throughput tweak.

**Fix:** Send the claimed rows concurrently with a bounded `asyncio.Semaphore` (for example 8). The DB guards already make concurrent sends safe. Also cap claims per endpoint per pass in `CLAIM_DELIVERIES_SQL`, for example with `ROW_NUMBER() OVER (PARTITION BY d.endpoint_id)` at most 2, so one endpoint cannot fill a whole batch.

### WR-03: A 2xx with a body over 64 KiB is recorded `failed` and counts toward auto-disable; a 5xx with a large body is never retried

**File:** `backend/app/services/webhook_sender.py:166-167, 38-39`, `backend/app/services/webhook_drainer.py:411-420`, `backend/app/security/egress.py` (the `send_pinned_http` declared-length and stream caps)

**Issue:** `send_pinned_http` raises `EgressResponseTooLarge` before returning a status code. It raises on a declared `Content-Length` above `max_bytes`, or once the stream passes the cap. The sender therefore never learns the status and classifies the result `response_too_large`, not retryable. The drainer then records `failed` / `not_retried` and calls `register_failure`.

Scenario: a receiver answers `200 OK` with a large HTML or echo body (`Content-Length: 120000`). The receiver processed every delivery. Even so:
- Syrel logs each one as failed.
- After 5 deliveries it turns the endpoint off with reason `failing`.
- It tells the owner the endpoint "kept failing."

The reverse also happens: a `503` with a large error page is classified not-retryable, so the D-17 retry schedule is skipped.

D-16 says the body is "read under a small cap and discarded". Webhooks never need the body at all.

**Fix:** Have `EgressResponseTooLarge` carry the response's `status_code` (one attribute, set at both raise sites), and classify by status in `webhook_sender._classify_exception`. A 2xx is delivered, 408/429/5xx are retried, and any other status keeps `response_too_large`. If you prefer not to edit egress, at minimum skip `register_failure` for `response_too_large`.

### WR-04: `HTTPS://host/…` passes every application check, then fails migration 225's case-sensitive CHECK and returns a 500

**File:** `backend/app/services/webhook_urls.py:56`, `supabase/migrations/225_webhooks.sql:67`, `backend/app/api/webhooks.py:236-252, 274-287`

**Issue:** `check_webhook_url` compares `parts.scheme.lower() != "https"`, and egress (httpx) lowercases the scheme. Verified: `check_webhook_url('HTTPS://Example.com/hook')` returns the URL, and `validate_destination('webhook', …)` returns a pinned destination. The table CHECK is `url LIKE 'https://%'`, which is case-sensitive, so the INSERT or UPDATE raises `asyncpg.CheckViolationError`. Neither `create_endpoint` nor `update_endpoint` catches it, so the member gets an unworded 500 instead of a `{code, message}` refusal.

**Fix:** Pick one rule and apply it in both places. Either refuse a non-lowercase scheme in `check_webhook_url`:

```python
if parts.scheme != "https":
    raise WebhookUrlError("not_https")
```

or make the CHECK `lower(left(url, 8)) = 'https://'`. Refusing in the app keeps "the stored URL is exactly the sent URL" true. Also map `asyncpg.CheckViolationError` in both routes to the `NOT_A_URL` 422 as a backstop.

### WR-05: Fan-out has no per-event failure bound, so one event whose fan-out keeps raising blocks fan-out for all later events

**File:** `backend/app/services/webhook_drainer.py:220-231, 233-264`, `backend/app/db/webhook_outbox.py:64-73`

**Issue:** `CLAIM_EVENT_SQL` always takes the oldest un-fanned event (`ORDER BY created_at LIMIT 1`). `_fan_out` `break`s on the first exception and retries the same event on the next tick. Nothing records a failed fan-out attempt on the event: no attempt counter, no `fanned_out_at` on failure.

Inside the event's transaction, `_fan_out_one` makes several external calls: liveness through `principal_still_allowed`, document visibility on an acting-member connection, and the redaction switch read. If any of these raises every time for a particular event, both workers re-claim that event first on every tick and break, and every later event (other orgs included) is never fanned out. A plain SELECT failure on the acting connection, or a DB error specific to one owner, is enough. Only the 30-day purge would clear it.

**Fix:** Add `fan_out_attempts int NOT NULL DEFAULT 0` to `webhook_events` and bump it in a separate statement when `_fan_out_one` raises. After N attempts (for example 5), mark the event fanned out with `payload = NULL` and log it by id. Also `continue` to the next event instead of `break`, using `SKIP LOCKED` together with `ORDER BY fan_out_attempts, created_at`.

### WR-06: The "Waiting on you" webhook row does nothing when Settings is already the active view, and leaves a stale focus hint behind

**File:** `frontend/src/components/layout/ChatLayout.tsx:611-615`, `frontend/src/pages/SettingsPage.tsx:452-454`, `frontend/src/components/settings/webhooks/WebhooksTab.tsx:99-105`

**Issue:** `openWebhooksForAttention` writes the Settings tab id to `localStorage` and calls `onNavigate("settings")`. `SettingsPage` reads `localStorage` only in its `useState` initialiser, that is, once on mount.

If the member is already on Settings (the NavPanel mounts `WaitingOnYouControl` in every view) and clicks the webhook row:
- the view does not change;
- the active tab does not move to Webhooks;
- if the Webhooks tab is already open, the hint is not consumed either, because `readWebhookFocusOnce` runs only on `WebhooksTab` mount.

The `webhook_focus` hint then stays in `sessionStorage` and fires on the next, unrelated mount of the Webhooks tab, jumping to an endpoint the person did not ask for. Separately, `localStorage.setItem` is not wrapped in try/catch, so with storage blocked the handler throws before `onNavigate` runs. `writeWebhookFocus` guards against exactly that.

**Fix:** Route through the Settings address or a controlled prop, not a mount-time read. For example, call `onNavigate("settings", { tab: "8" })` if `useAppNavigation` supports a tab parameter, which `settingsTabFromAddress` already reads. Alternatively, dispatch a `settings:open-tab` event that `SettingsPage` and `WebhooksTab` listen for (the tab change, then `readWebhookFocusOnce()`). Wrap the `localStorage.setItem` in try/catch.

## Info

### IN-01: A delivery stranded at its last attempt by the stale-lease reclaim never counts toward auto-disable

**File:** `backend/app/db/webhook_outbox.py:115-135`
**Issue:** When `RECLAIM_SQL` sets a real delivery to `failed` / `max_attempts` because its lease expired, `register_failure` is never called. The normal path counts that same outcome (`webhook_drainer.py:415-420`). An endpoint whose sends keep hanging past the lease therefore never auto-disables.
**Fix:** Return the endpoint ids of rows that reclaim moved to `failed` (excluding tests), and call `register_failure` for each from `_send_pass`.

### IN-02: The Test route writes an attempt row and a `test_sent` audit even when nothing was sent

**File:** `backend/app/db/webhooks.py:518-527`, `backend/app/api/webhooks.py:457-470`
**Issue:** `record_test_outcome` always inserts an attempt row, including when the payload was withheld or the key was unreadable. The drainer's `_fail_unsent` deliberately writes none (D-58: attempts are HTTP attempts). The audit row says "Sent a webhook test" for a test that never left.
**Fix:** Skip `insert_attempt` when `reason` is set. Audit `test_sent` only when `outcome is not None`.

### IN-03: The webhook liveness predicate inherits `_is_banned`'s fail-open behaviour

**File:** `backend/app/dependencies.py:254-262` (reached through `principal_still_allowed`, `webhook_drainer.py:121-127`)
**Issue:** If the `auth.users` read fails, a banned owner is treated as not banned and their endpoint keeps receiving. Fail-open is right for interactive requests (no self-inflicted outage). For a background sender acting on someone's behalf, fail-closed is the safer choice.
**Fix:** In the drainer's adapter, treat a failed ban read as "not allowed this pass" (`skip`, not `disable`). This needs a strict variant of the predicate, not a second predicate.

### IN-04: Fan-out holds a pool connection inside a transaction while acquiring more from the same pool

**File:** `backend/app/services/webhook_drainer.py:235-261`
**Issue:** While holding the event's row lock, `_fan_out_one` takes a second pool connection (acting-member visibility, `is_org_member`, `_is_banned`, `pii_redaction_enabled`). When requests have exhausted the pool, the drainer waits with an open transaction and a row lock, and `asyncpg` acquire has no timeout.
**Fix:** Read candidates, then commit. Compute liveness, visibility and the frozen payload outside the transaction. Re-claim the event to insert deliveries and mark it, guarded by `fanned_out_at IS NULL`.

### IN-05: An internationalised (IDN) hostname is refused with the "can't be reached from the internet" sentence

**File:** `backend/app/api/webhooks.py:151-155` (egress `host_not_ascii`)
**Issue:** `https://bücher.example/hook` is refused as unreachable, which is misleading. The receiver is public; Syrel just does not accept non-ASCII hosts.
**Fix:** Map `host_not_ascii` to a separate sentence ("Use the address's xn-- form").

### IN-06: `test_308_check_script.py` reads a `scripts/` file that does not trigger backend CI

**File:** `.github/workflows/backend-tests.yml:10-30`, `backend/tests/unit/test_308_check_script.py:17`
**Issue:** The test reads `scripts/check-migration-225-live.py`. That path is not in either `paths:` arm, and the module is not in `test_253_ci_path_coverage._MODULES_THAT_REACH_OUTSIDE_BACKEND`, so the fence that exists for this problem does not see it. An edit that breaks the script will not run the test that pins it.
**Fix:** Add the path to both arms and add the module to the 253 fence's module list.

### IN-07: The Test button works as a rate-limited port probe of public hosts

**File:** `backend/app/api/webhooks.py:406-471`, `backend/app/services/webhook_urls.py:66-67`
**Issue:** Any port is accepted, and the Test answer returns `error` (`connect` / `tls` / `timeout`) plus `latency_ms`. A member can tell open ports from closed ones on any public host at 5 tests per minute, with Syrel's IP as the source. Egress still blocks every internal address, so this concerns abuse of third parties, not SSRF.
**Fix:** Optionally restrict to 443 plus a small allow-list (8443), or collapse `connect`/`tls`/`timeout` into one "couldn't connect" word in the Test answer.

---

_Reviewed: 2026-11-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
