---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
reviewed: 2026-11-04T00:00:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - backend/app/api/api_keys.py
  - backend/app/api/oauth_admin.py
  - backend/app/api/oauth_consent.py
  - backend/app/db/api_keys.py
  - backend/app/db/oauth.py
  - backend/app/mcp/__init__.py
  - backend/app/mcp/access_log.py
  - backend/app/mcp/edge.py
  - backend/app/mcp/oauth_clients.py
  - backend/app/mcp/oauth_metadata.py
  - backend/app/mcp/oauth_server.py
  - backend/app/mcp/oauth_store.py
  - backend/app/middleware/maintenance.py
  - backend/app/models/api_key.py
  - backend/app/security/api_key_auth.py
  - backend/app/security/egress.py
  - backend/app/security/mcp_principal.py
  - backend/app/security/oauth_tokens.py
  - backend/app/services/mcp_narrowing.py
  - backend/app/services/rate_limit.py
  - frontend/devRouting.ts
  - frontend/nginx.conf
  - frontend/src/App.tsx
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/admin/CapabilityGrid.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/McpSignInHostsCard.tsx
  - frontend/src/components/connect/ConsentOrgField.tsx
  - frontend/src/components/connect/ConsentPage.tsx
  - frontend/src/components/connect/ConsentWhoIsAsking.tsx
  - frontend/src/components/connect/consentFacts.ts
  - frontend/src/components/connect/oauthCopy.ts
  - frontend/src/components/org/OrgApiKeysTab.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/org/OrgConnectedApps.tsx
  - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
  - frontend/src/components/settings/apiKeys/ConnectedAppCard.tsx
  - frontend/src/components/settings/apiKeys/ConnectedAppsSection.tsx
  - frontend/src/components/settings/apiKeys/DisconnectAppSheet.tsx
  - frontend/src/components/settings/apiKeys/McpConnectSnippets.tsx
  - frontend/src/components/settings/apiKeys/McpKeyFields.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
  - frontend/src/components/settings/apiKeys/mcpSnippets.ts
  - frontend/src/hooks/useAppNavigation.ts
  - frontend/src/lib/api/apiKeys.ts
  - frontend/src/lib/api/oauth.ts
  - frontend/src/lib/appRoutes.ts
  - frontend/src/lib/returnTo.ts
  - frontend/vercel.json
  - frontend/vite.config.ts
  - scripts/check-migration-224-live.py
  - scripts/full-schema-supplement.sql
  - scripts/vitest-count-gate.cjs
  - supabase/migrations/224_mcp_oauth_grants.sql
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 307: Code Review Report

**Reviewed:** 2026-11-04
**Depth:** standard (diff `3ad306b63..HEAD`, security-weighted per the 307 threat model)
**Files Reviewed:** 55
**Status:** issues_found

## Summary

I reviewed the hand-written OAuth 2.1 authorization server (discovery, DCR, CIMD, authorize, consent, token, revoke), the access-token path through the shared admission code, migration 224, the connected-apps routes, the operator allowlist routes, and the frontend consent, connected-app and routing surfaces.

**Checks that held up when traced through the code:**
- **Redirect matching (D-07).** It does a strict parse, then exact string equality. Loopback matches on any port with the same raw host. Userinfo, fragments, non-ASCII, custom schemes and non-loopback `http` are refused. I tried `\`, `@`, bracket, port and percent-encoding tricks and none got through. An unproven redirect never gets a Location: the request is stored as refused and the browser goes to Syrel's own page.
- **PKCE.** Only S256 is accepted. The challenge must be exactly 43 characters and the comparison is constant-time.
- **Codes.** Each code is single-use (MULTI GET+DEL). It is bound to the client, the byte-equal redirect and the resource.
- **RFC 9207.** `iss` is present on every authorize response.
- **Refresh rotation.** It runs under a grant-level `FOR UPDATE`, and the 60 s grace path requires an unused, unrevoked successor.
- **Fetching client metadata (CIMD).** It only goes through `egress.send_pinned_http`, pinned to the caller's host with no redirects, capped at 16 KB and bounded at 5 s.
- **Consent page.** It can't be framed (CSP `frame-ancestors`, XFO, and a JS check) and sends no Referer. A pick is made with a Bearer header, never a cookie. The org comes from the request body and membership is re-checked.
- **Migration 224.** It enables RLS with no policy and revokes from `PUBLIC` first.
- **Scoping.** Revoke-all is scoped to the org and to grants only. The allowlist routes have a router-level `require_operator`.

**What I found:**
- **One blocker:** the 16 KB form cap on `/oauth/token` and `/oauth/revoke` can be bypassed by an unauthenticated caller.
- **Partial-failure paths** that leave live grants nobody can use.
- **A "fact" shown to members that isn't the fact:** the connected app's redirect host.
- **Two unbounded or global resources an anonymous caller can exhaust:** the CIMD client rows and the door-wide token limiter.

## Critical Issues

### CR-01: The 16 KB token/revoke form cap is bypassed by any body sent without `Content-Length` (unauthenticated memory and CPU DoS)

**File:** `backend/app/mcp/oauth_server.py:390-409` (used by `token` at 432-454 and `revoke` at 568-582)
**Issue:** `_form` enforces `_TOKEN_FORM_MAX` (16 KB) only when the request *declares* a `Content-Length`:
```python
declared = request.headers.get("content-length")
try:
    if declared is not None and int(declared) > _TOKEN_FORM_MAX:
        return None
...
form = await request.form()
```
A request sent with `Transfer-Encoding: chunked` has no `Content-Length`, so the check is skipped. `request.form()` then parses the whole stream. I checked the installed Starlette 0.41.3 (`starlette/formparsers.py:FormParser.parse`): for `application/x-www-form-urlencoded` it has **no size or field limit**. It builds `field_value += message_bytes` across the whole body, which is unbounded memory and quadratic byte concatenation.

Nothing in the stack stops it either:
- `main.py` has no body-size middleware.
- uvicorn/h11 has no body limit.
- Traefik (the cloud Coolify proxy) passes chunked bodies through. The one-box nginx accepts up to 100 MB (`client_max_body_size 100m`).

Concrete failure: `POST /oauth/token`, `Content-Type: application/x-www-form-urlencoded`, `Transfer-Encoding: chunked`, a single 100 MB `grant_type=aaaa…` field, repeated up to the door ceiling of 600/min. Each request pins a worker on memory and CPU. Both `WORKER_COUNT=2` workers can be exhausted by an anonymous caller. This takes down the whole backend, not just OAuth, because these routes share the app's workers.

`register` does this correctly. Its `_read_capped` (146-160) streams and stops at the cap. The token and revoke paths need the same treatment.

**Fix:** read the body with the same capped stream, then parse it yourself. Never call `request.form()` on an unbounded stream:
```python
from urllib.parse import parse_qsl

async def _form(request: Request) -> dict[str, str] | None:
    ctype = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if ctype != _FORM_TYPE:
        return None
    raw = await _read_capped(request, _TOKEN_FORM_MAX)   # stops at 16 KB, declared or not
    if raw is None:
        return None
    try:
        pairs = parse_qsl(raw.decode("ascii"), keep_blank_values=True, strict_parsing=False,
                          max_num_fields=32)
    except (UnicodeDecodeError, ValueError):
        return None
    out: dict[str, str] = {}
    for k, v in pairs:
        if k in out:
            return None        # a parameter sent twice is invalid_request
        out[k] = v
    return out
```
Add a unit test that sends a chunked body over 16 KB with no `Content-Length` header and asserts `invalid_request` without the full body being read.

## Warnings

### WR-01: Approve mints a live grant before the code exists; a later failure leaves a "connected app" that can never connect

**File:** `backend/app/api/oauth_consent.py:233-268`
**Issue:** The order is:
1. `take_request` consumes the request.
2. `create_api_key` writes a live grant (90-day expiry).
3. `mark_client_granted`.
4. `save_code` writes to Redis.

If step 4 raises `OAuthStoreUnavailable`, the member gets 503. Redis blips are exactly what the 503 path exists for. Any `asyncpg` error in step 3 has the same effect. In both cases the grant row stays live, and it shows up in **Settings → Connected apps** and the org admin's list (`_GRANT_LIVE` only checks revoked, expiry and membership). The request is gone, so a retry starts over and mints a second grant. `_exchange_code` (oauth_server.py:496-499) explicitly revokes a grant whose code was spent "so a member is never shown a connected app that cannot connect". This path breaks that same invariant.
**Fix:** Revoke on any failure after the insert:
```python
row = await api_keys_db.create_api_key(...)
try:
    await oauth_db.mark_client_granted(pool, client_row_id)
    code = secrets.token_urlsafe(32)
    await oauth_store.save_code(redis, code_digest=oauth_store.digest_code(code), record={...})
except BaseException:
    await oauth_db.revoke_grant(pool, row["id"])     # never leave an unusable live grant
    raise
```
The better fix is to save the code before creating the grant: pre-generate the grant UUID, or write the code record after a `RETURNING id` inside a transaction that only commits after `save_code` succeeds.

### WR-02: Code-replay detection is not atomic with the take, so a concurrent replay escapes revocation and a Redis error orphans the grant

**File:** `backend/app/mcp/oauth_store.py:136-146`, `backend/app/mcp/oauth_server.py:476-484`
**Issue:** `take_code` does the MULTI GET+DEL, then writes `oauth:codeused:<digest>` in a **separate** `SETEX`. Two problems follow:
1. **Race.** A replay that arrives between the two commands (the classic attacker-races-legit-client case OAuth 2.1 §4.1.2 targets) finds neither the code nor the `codeused` marker. It gets a plain `invalid_grant` and the grant it bought is **not** revoked. That defeats the replay rule this code exists to implement.
2. **Redis failure.** If the `SETEX` raises, `OAuthStoreUnavailable` reaches the caller (503) after the code is already consumed. The client can never exchange it, and the grant stays live and listed, which is the same orphan problem as WR-01.

**Fix:** Do the take and the mark in one atomic step, for example a Lua script:
```lua
-- KEYS[1]=oauth:code:<d>, KEYS[2]=oauth:codeused:<d>, ARGV[1]=ttl
local v = redis.call('GET', KEYS[1])
if v then
  redis.call('DEL', KEYS[1])
  local gid = cjson.decode(v)['grant_id'] or ''
  redis.call('SETEX', KEYS[2], ARGV[1], gid)
end
return v
```
Alternatively, write the `grant_id` under a second key at `save_code` time (TTL 600 s), so a miss on the code key plus a hit on that key always means "already spent".

### WR-03: The connected app's `redirect_host`, the "fact" a member trusts, comes from the client's first registered redirect, not the one approved

**File:** `backend/app/api/api_keys.py:352-366, 378-388`; `backend/app/mcp/oauth_server.py:604-611`
**Issue:** On the consent page the redirect host shown is the one actually used (`record["redirect_host"]`), and the copy says the name is a claim and the host is the fact (D-12). The connected-apps list, the revoke audit (`_grant_audit_detail`) and the `/oauth/revoke` audit all derive the host from `oauth_clients.redirect_uris[0]` instead.

Any client can register up to 10 redirects. A DCR client that registers `["https://claude.ai/x", "http://localhost/cb"]` signs in through `localhost`, so the consent page shows "this computer". Afterwards, the member's **Connected apps** card and the org admin's list show **`claude.ai`**, kind **web**. The revoke audit row also names `claude.ai`, while the `api_key.create` row for the same grant names `localhost`. The two audit rows for one grant disagree, and the list launders a self-registered client into the built-in host's appearance.
**Fix:** Store the approved redirect host and kind on the grant at approve time and read them back, instead of re-deriving from the client row. Options: a nullable `oauth_redirect_host` / `oauth_redirect_kind` on `api_keys`, or a small `oauth_grants(grant_id, redirect_host, redirect_kind)` side table, in a follow-up migration. Until then, show every distinct registered host rather than only the first.

### WR-04: CIMD client rows are never pruned, so anonymous callers can grow `oauth_clients` without bound

**File:** `backend/app/mcp/oauth_server.py:237-266`; `backend/app/db/oauth.py:235-251`
**Issue:** Every `GET /oauth/authorize` with a fresh `https://…` `client_id` that serves a valid metadata document upserts an `oauth_clients` row of kind `cimd`. No session is needed and the redirect never has to be proven: the row is written before step 2. `delete_unused_dcr_clients` prunes `kind = 'dcr'` only. An attacker can serve a valid document from `https://attacker.example/c/<n>` and loop `n` at the `oauth_authorize` door ceiling (120/min, door-wide). That is about 170 k permanent rows a day, which also bloats every connected-apps join. D-09 bounds registered clients, but only DCR got the bound.
**Fix:** Extend the prune to CIMD rows that were never granted and whose `metadata_fetched_at` is older than 24 h:
```sql
DELETE FROM public.oauth_clients WHERE id IN (
  SELECT c.id FROM public.oauth_clients c
  WHERE c.last_grant_at IS NULL
    AND COALESCE(c.metadata_fetched_at, c.created_at) < now() - make_interval(hours => $1)
    AND NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.oauth_client_id = c.id)
  LIMIT $2)
```
Run it from both `register` and the CIMD upsert path.

### WR-05: Door-wide `/oauth/token` limiter: one anonymous caller can block every connected app's refresh

**File:** `backend/app/services/rate_limit.py:205-228`; `backend/app/mcp/oauth_server.py:82-99, 432-435`
**Issue:** `_client_addr` is `request.client.host`. Behind the proxy that is the proxy's address, which the module itself says makes these "door-wide ceilings". So `OAUTH_TOKEN_PER_MINUTE = 600` is shared by every member's every app. A single unauthenticated script sending 600 junk `POST /oauth/token`/min (each is answered quickly with `invalid_request`) means every legitimate refresh gets 429. Access tokens live 1 h, so after an hour of this every connected app in the deployment is effectively disconnected.

This is recorded as SEED-397 (deferred). But `/oauth/token` is the one door whose starvation breaks *existing* connections rather than new sign-ins, and D-34's goal ("a burst of registrations cannot starve token refreshes") doesn't hold against a burst on the token door itself.
**Fix (short of SEED-397):**
- Count refresh-grant requests in a separate bucket keyed by the presented token's digest or `client_id`, after a cheap prefix and shape check. Unauthenticated junk can then only exhaust its own bucket.
- Or count only requests that fail `invalid_request`/`invalid_grant` against the door-wide ceiling.

### WR-06: Consent page: an automatic org change on re-read keeps the previous org's folder picks

**File:** `frontend/src/components/connect/ConsentPage.tsx:161-171` (vs. 446-451)
**Issue:** When the member changes org by hand, `onChange` resets the draft (`folderMode: "all", folderIds: [], external: false`). When the org changes *automatically*, the draft is not reset. That happens in `toPhase` after an approve refusal: a 403 triggers `load({ quiet: true })`, and if the picked org's switch is now off, `setOrgId` falls back to `defaultOrg(...)`. The draft keeps the old org's `folderIds` with `folderMode: "only"`. `draftFolderIds` filters them against the new org's folders, so it sends `folder_ids: []`. `firstUnmetAllow` still passes because it checks `draft.folderIds.length`, not what will actually be sent. Allow stays enabled, the summary reads "only 0 folders in <new org>", and the server answers 422 with the empty-folders sentence. The member also never chose the new org; it was swapped in silently. External access (`external`) carries over to an org the member never confirmed, too.
**Fix:** Put the reset in one place. When `toPhase` picks a different org than `prev`, apply the same draft reset that `onChange` does:
```ts
setOrgId((prev) => {
  const keep = prev !== null && req.orgs.some((o) => o.id === prev && o.mcp_off === null)
  if (!keep) setDraft((d) => ({ ...d, folderMode: "all", folderIds: [], external: false }))
  return keep ? prev : defaultOrg(req.orgs)
})
```
Also make `firstUnmetAllow` use `draftFolderIds(...)` rather than `draft.folderIds`, so Allow is blocked when nothing would be sent.

### WR-07: `check-migration-224-live.py` reports "NOT live" after a legitimate operator action and crashes on auth errors

**File:** `scripts/check-migration-224-live.py:155-159, 173-177`
**Issue:**
1. Line 158 requires `{"claude.ai", "claude.com"}` to be present in the **live** `app_settings('global')` row. D-08 and `oauth_admin.remove_sign_in_host` explicitly allow an operator to remove a built-in host, and the empty list is allowed. After that, the deploy check reports migration 224 as not live, although the schema is correct. The checklist is told to run this after every cloud apply, so it will fail there.
2. `{e.get("host") for e in json.loads(raw)}` raises `AttributeError` on any non-dict entry.
3. `main()` only maps `OSError`/`ConnectionError` to exit 2. An `asyncpg.InvalidPasswordError` (or any `asyncpg.PostgresError`) escapes as a traceback with exit 1, which reads as "migration missing" rather than "harness error".

**Fix:** Check the column **default** (already done at 150-153) and drop the live-row assertion, or downgrade it to a printed note. Guard entries with `isinstance(e, dict)`. Catch `asyncpg.PostgresError` alongside `OSError` and return 2.

## Info

### IN-01: Refusals of OAuth access tokens are audited without `credential: "oauth"`

**File:** `backend/app/security/api_key_auth.py:334-343` (via `_refused` at 366-369 and 441)
**Issue:** These refusals are written by `_refuse`, which passes `detail=None` (or `{"suppressed": n}`):
- `wrong_resource` from `authenticate_presented_access_token`
- every liveness refusal of a grant at `/mcp`: `mcp_off_org`, `mcp_off_deployment`, `not_member`, `banned`

`oauthAuditLabel` keys off `detail.credential`, so these rows read as personal-key refusals in both audit browsers, while `refresh_reuse` (oauth_server.py:558-561) does carry the marker.
**Fix:** Have `_admit`/`_refused` accept `credential` and add `{"credential": "oauth"}` to `detail` when `credential == "oauth"`.

### IN-02: A CIMD client's name gets a green "verified" badge, but only the publishing host was checked

**File:** `frontend/src/components/connect/ConsentWhoIsAsking.tsx` (the `cimd` branch)
**Issue:** Any https host can publish `client_name: "Claude"`. For CIMD the page drops the "calls itself" qualifier and shows a `BadgeCheck` "verified" tag next to the name. The redirect allowlist limits what a fake can actually capture, but the visual says the name is verified when the name is still a claim (D-12).
**Fix:** Keep the "calls itself" wording for CIMD too, and attach "verified" to the "published at {host}" line only. That is the current layout, but the badge reads as applying to the name above it.

### IN-03: `host_seeded` is a hard-coded constant, not the allowlist's built-in flag

**File:** `backend/app/api/oauth_consent.py:63, 192`
**Issue:** `SEEDED_HOSTS = {"claude.ai", "claude.com"}` duplicates migration 224's default. `oauth_admin._wire` already derives `built_in` from the stored entry (no `added_by`). If an operator removes claude.ai and adds it back, the entry is no longer built in, but the consent page still shows the "seeded" why-line.
**Fix:** Read `get_redirect_hosts(pool)` in `read_request` and set `host_seeded` from the matching entry's missing `added_by`.

### IN-04: A DCR prune between authorize and approve can return a 500 after the request was consumed

**File:** `backend/app/mcp/oauth_server.py:181-184`, `backend/app/api/oauth_consent.py:233-254`
**Issue:** Suppose a DCR client was registered more than 24 h ago and never granted. If it is pruned by another caller's `register` while one of its requests is pending (TTL 600 s), approve has already run `take_request`. `create_api_key` then hits the `oauth_client_id` foreign key and raises an unhandled `ForeignKeyViolationError`. The result is a 500, and the request is gone.
**Fix:** Have the prune exclude clients with a pending request, or simply catch `asyncpg.ForeignKeyViolationError` in approve and answer 410 (`_gone()`).

---

_Reviewed: 2026-11-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
