# Project Research Summary

**Project:** Syrel (Agentic RAG platform), milestone v4.9 "Use It From Your Own Tools"
**Domain:** Outside-caller surfaces on a multi-tenant RAG/agent platform: a remote MCP server, personal MCP keys, OAuth 2.1 for MCP, outbound webhooks, guardrails for outside traffic (admission control, PII redaction), plus one defect fix (BUG-261022-01).
**Researched:** 2026-10-30 (phases from 303, migrations from 220)
**Confidence:** MEDIUM-HIGH overall. HIGH for the MCP SDK and spec, dependency resolution, existing-code integration points and the webhook standard. MEDIUM for the OAuth authorization-server choice, the org-narrowing mechanism, client timeouts and PII quality.

Detail files: `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (this directory). Synthesized by the research synthesizer; written by the orchestrator because the synthesizer's Write was refused.

## Executive Summary

v4.9 adds a second door to a product that already has one. The pattern is well established:

- A Streamable HTTP MCP server using the official `mcp` SDK 2.3.x mounted in FastAPI, run **stateless** so two uvicorn workers need no sticky sessions.
- A small, read-heavy tool set: search, list/read documents, ask the agent, list/run/read a workflow.
- Per-member credentials that act exactly as that member inside one org.
- Signed, thin-payload webhooks from a Postgres outbox.

Almost everything needed already exists, and all four files favour reuse over invention: Phase 293's key resolver, rate limiter and audit lockstep; Phase 300's trigger-fed outbox and per-worker drainer; `egress.send_pinned_http` for every outbound byte; the uid-synthesized RLS connection for "act as the member"; `unattended_launch` for workflow starts. The Extension Contract holds: MCP tools call services and are never engine tools, so `_TOOL_REGISTRY` stays at 30.

The work is mostly about four trust boundaries, which are where the milestone can fail:

1. **Visibility.** "Sees exactly what the member sees, in the key's org" must be proven with a two-org parity test. Every existing gate reads through the service role (the BUG-260911-01 blind spot).
2. **Narrowing.** Folder set and tool subset are enforced at the data layer and at `tools/call`, not at the entry tool or `tools/list`. An empty folder set means nothing, never "no filter".
3. **`ask_agent`.** The highest-severity surface. An outside prompt reaching an agent with the private KB, a networked sandbox and connector writes is the lethal trifecta on our side, so MCP-origin turns run a closed, read-only tool set.
4. **Credential liveness.** Keys, OAuth tokens and webhook subscriptions re-check membership, ban status and the org kill switch on every use.

Retrieved text is also hostile in the caller's model: results must be structured, delimited, provenance-tagged and defanged.

One product fact shapes the sequencing: **personal keys do not reach Claude.ai or Claude Desktop.** Hosted Claude accepts a static header only as a beta, owner-entered, org-shared credential, and Anthropic says it must not identify a person. Keys serve Claude Code, Cursor, VS Code, Codex and n8n; Claude.ai and Desktop need OAuth. The roadmap must say this plainly, and OAuth must not become the squeezed last phase.

## Where the research files disagree (and the call made)

| # | Disagreement | Positions | Recommendation and trade-off |
|---|---|---|---|
| D1 | **OAuth authorization server** | STACK: own thin AS issuing opaque tokens that are MCP key grants. ARCHITECTURE: Supabase OAuth 2.1 server plus an app-side `mcp_grants` table. PITFALLS: Supabase tokens are ordinary user JWTs (`aud: authenticated`), replayable against PostgREST with the member's full RLS; mitigation needs an audience hook on every sign-in plus RESTRICTIVE RLS on every table. | **Own AS with opaque, hashed, per-call-looked-up tokens.** Narrowing, instant revocation, liveness checks and audience binding then match keys exactly, and the token cannot be replayed at the Data API. Cost: five endpoints and a consent page to build and secure. Use the SDK's `mcp.shared.auth` models; the SDK's embedded `auth_server_provider` is an acceptable fast path. Supabase OAuth stays the fallback only if the spike shows the hook plus RESTRICTIVE RLS is cheap and safe. The `mcp_grants` table survives either way as the grant row. |
| D2 | **OAuth position** | ARCHITECTURE, STACK: last. FEATURES, PITFALLS: Claude.ai and Desktop users cannot use keys at all. | **Keys first, then OAuth as the fourth phase, before webhooks.** Keys validate the tool surface and narrowing model in header-capable clients; OAuth is the only path to the headline client and carries the most deploy-parity risk (`.well-known` routing on Vercel / Coolify / onebox, redirect URLs, a real Claude.ai connect). Webhooks are independent of OAuth and can run in parallel worktrees, so this costs no elapsed time. The milestone cannot claim "Claude Desktop works" until 307; until then the `mcp-remote` bridge snippet is a labelled developer workaround. |
| D3 | **Long-call budget** | ARCHITECTURE: ~120 s default wait. FEATURES: ~180 s internal deadline under the 240 s hosted cap. PITFALLS: return a handle in 20-30 s; client timeout reports run 60 s to 5 min and a retry creates a second run. | **A setting with a short default.** `run_workflow` returns a handle immediately. `ask_agent` waits at most ~30 s (`app_settings.mcp_ask_wait_seconds`), then returns `{status: running, run_id, conversation_id}` for `get_answer`. Optional client idempotency key, Redis-deduped for minutes. Every handle bound to the credential. Raise the default only on UAT evidence from Claude Code, Desktop and Cursor. 120/180 s are ceilings, not defaults. Timeout figures are LOW-confidence user reports. |
| D4 | **Org narrowing mechanism** | ARCHITECTURE: a transaction-local `app.acting_org_id` GUC that `current_user_org_ids()` intersects with (one hot edit in `dependencies.py` + a SECURITY DEFINER change). PITFALLS: reuse the shipped context builders and retrieval path; never write a new query. | **Take the GUC, gated.** It is the only single-place way to narrow every RLS policy and RPC; unset must be byte-identical. 304 owns three checks: EXPLAIN shows the initPlan shape survives; the backend baseline gate (71 failed, zero headroom); the two-org parity test as headline must-have. Fallback if EXPLAIN fails: explicit org predicates at each MCP read plus the same parity test. |
| D5 | **Where MCP auth lives** | STACK: SDK `TokenVerifier` (OAuth becomes a superset). ARCHITECTURE: a pure-ASGI wrapper. | Prefer `TokenVerifier` if it can return our single byte-identical 401, run the IP and key limiters and set the principal contextvar; otherwise the wrapper. Decide in 305 research. Either way it calls the extracted `authenticate_presented_key` core — a second resolver is the W-1 drift class. |
| D6 | **`get_run` scope** | ARCHITECTURE: credential-started runs plus the member's own. PITFALLS: credential-started only (293 D-12; the handle-hijacking mitigation). | **Credential-started only for v1.** Widening later is one line; narrowing after launch is breaking. |
| D7 | **Maintenance mode** | ARCHITECTURE: allow-list `/mcp`, block starts per tool. PITFALLS: the middleware returns an HTML 503 that clients report as "couldn't reach". | Compatible: allow reads, refuse starts, always a JSON-RPC error body with the maintenance sentence on the MCP path. |
| D8 | **Where redaction ships** | ARCHITECTURE: `outbound_guard` in the first MCP read phase. PITFALLS: a PII phase after MCP and webhooks, with a stubbed choke point earlier. | **Choke point + fail-closed deterministic redactor in 305**, the first phase that sends content out; webhooks reuse it and thin payloads keep their use small. No separate PII phase. False-positive and latency measurement on real documents is a 305 gate. |
| D9 | **MCP SDK vs pinned deps** | ARCHITECTURE: open and gating. STACK: measured. | Resolved: `mcp>=2.3.0,<3` + `sse-starlette>=3.0.3,<3.1` resolves with FastAPI 0.115.6 / Starlette 0.41.3 unchanged. Deliberately trips the `test_059_disconnect` version assertion; that phase re-validates the SSE endpoints in `runs.py` and `skill_tuner.py` and retires the fixture under a `D-NN`. No FastAPI upgrade bundled. |
| D10 | **Key storage** | FEATURES: a `kind` column or a sibling table. ARCHITECTURE: extend `api_keys` with `kind`, `folder_ids`, `tools`. | **Extend `api_keys`** — reuses revoke UI, audit, limiter, activity view. Relax mig 215's `workflows >= 1` CHECK for `kind='mcp'`. Prefix `srl_mcp_` so a workflow key can never authenticate MCP. |

## Key Findings

### Recommended Stack (STACK.md)

Two dependency changes and one test-only addition. No new infrastructure.

- **`mcp` 2.3.x** (`MCPServer` + `streamable_http_app(stateless_http=True)`): serves spec 2026-07-28 and legacy 2025-xx clients from one app, no sessions. `FastMCP` is removed in 2.x — ignore v1 examples. Required: `TransportSecuritySettings(allowed_hosts=…)` from `BACKEND_PUBLIC_URL` (otherwise 421 in production only) and `mcp.session_manager.run()` entered in the host lifespan.
- **`sse-starlette` → `>=3.0.3,<3.1`**: forced by `mcp` 2.x; capped because 3.6 needs a Starlette FastAPI 0.115.6 forbids.
- **Webhooks:** Postgres outbox + per-worker drainer (the Phase 300 pattern: `SKIP LOCKED`, lease, frozen payload, `next_attempt_at` backoff; Redis is a hint, never the record). Hand-rolled Standard Webhooks signer (`webhook-id`, `webhook-timestamp`, `v1,<HMAC-SHA256>`, `whsec_` secret, multi-signature rotation), secret stored via `secret_cipher`; `standardwebhooks==1.1.0` test-only for interop. Every delivery through a new closed `webhook` capability in `egress.py` (https only, DNS-pinned, redirects refused).
- **Admission:** Redis Lua lease semaphore keyed by provider account, fail-closed.
- **PII:** in-house deterministic redactor (regex + Luhn / mod-97 checksums, secret/token detection) behind a `Redactor` protocol so Presidio can slot in later.
- **Rejected:** Presidio/spaCy, `fastmcp`, Authlib, Svix, Celery/arq, cloud DLP. **Keep `mcp_client.py` hand-rolled** — the SDK client uses `httpx2` and would bypass pinned egress.

### Expected Features (FEATURES.md)

**Must have (table stakes):**
- A stateless Streamable HTTP endpoint at one stable URL with ~7 tools in four families: `search_knowledge_base`; `list_documents` / `read_document` (paged, bounded); `ask_agent` (citations + response-level confidence as `structuredContent`, plus a deep link); `list_workflows` / `run_workflow` / `get_workflow_run`.
- Tool hygiene: `readOnlyHint` / `destructiveHint` on every tool; short, factual, static descriptions; errors as `isError` results; an audit row and origin on everything.
- Personal keys: show-once secret, hash at rest, acts as the member, bound to one org; optional folder set and tool subset (intersection only, stored on the key, never in URL params); last-used, expiry, per-client snippets using env-var references; org kill switch; admin list and revoke; per-key rate buckets (cheap vs expensive).
- OAuth 2.1 per Claude's checklist: 401 + PRM, S256 PKCE, DCR and CIMD, the exact Claude callback plus any-port loopback, rotating refresh, endpoints under 10 s, an owned consent page with org picker, a connected-apps list with revoke.
- Webhooks: endpoint CRUD; event catalog (run finished, document ingested); Standard Webhooks signing; roll-secret overlap; backoff retries; delivery log, resend, test event; auto-disable + owner notice; thin payloads; owner-visibility fan-out.
- Admission control with refusals the model can relay; PII redaction at MCP results and webhook payloads only.

**Should have (differentiators):** citations + confidence as machine-branchable output (no competitor does this); "Open in Syrel" deep links (v4.8); a `workflow_run.waiting` webhook event; "waiting on <person>" via `get_workflow_run`; conversation handles; a "Test this key" button.

**Defer:** Expert-scoped `ask_agent`; OAuth scope step-up; ChatGPT `search`/`fetch` aliases (verify first); webhook recover-since-date; ed25519; MCP Apps; Connectors Directory (blocked by SEED-294); service-account credentials; HITL answered over MCP; `/api/v1` REST (operator-deferred).

**Anti-features:** every capability as a tool; one tool that both reads and writes; blocking `run_workflow`; relying on MCP tasks / sampling / elicitation; sessions; dynamic tool descriptions; keys or tokens in URLs; org-shared MCP keys; full-content webhook payloads; custom signing; global PII redaction.

### Architecture Approach (ARCHITECTURE.md)

A new outer edge, `backend/app/mcp/`, resolves one `McpPrincipal` before any tool runs; the credential kind (key now, OAuth later) hides behind it, so OAuth swaps only the resolver. Tools call services; they never touch `_TOOL_REGISTRY`, `handle_search_documents` or `send_message`. Reads run on the uid-synthesized RLS connection (`get_user_pg_connection(None, {"id": uid})`) narrowed to the key's org. "Ask" is a new sibling service, `unattended_chat.py`, calling `run_producer` with `ThreadScoping`; `threads.py` (97 phases) is not touched.

**Major components:**
1. `authenticate_presented_key` (extracted from `api_key_auth.py`) + `McpPrincipal` — one live-check path for keys and OAuth.
2. `security/acting_member.py`, the single sanctioned `dependencies.py` edit (org GUC contextvar), and mig 221 narrowing `current_user_org_ids()`.
3. The `app/mcp/` server and four tool modules, with a per-tool allow-check at dispatch.
4. `unattended_chat.py`; `key_run_read.py` (pure-move extraction out of `inbound.py` first); the existing `unattended_launch`.
5. `outside_admission.py` (Redis leases per org, credential and provider) and `outbound_guard.py` (redaction choke point).
6. `webhook_subscriptions` / `webhook_deliveries`, DB triggers on `workflow_runs` and `documents` status, a `WebhookDrainer` in every worker.
7. Migrations 220 (key kind, origin columns, audit literals), 221 (org GUC, settings knobs), 222 (webhooks), and a later grants table for OAuth. Apply each to cloud before the code ships (`assert_action_types_synced` refuses boot otherwise); `get_advisors(security)` after each.

**Hot-file discipline (G-5):** one mount/edit only — `main.py` (one mount + one lifespan block per phase), `dependencies.py` (~6 lines), `egress.py` (one capability), `audit_service.py`, `user_settings.py`, `settings.py`, `SettingsPage.tsx` (one mount per phase). Extract before editing — `inbound.py`. Minimal — `render_template.py`. Do not touch — `threads.py`, `agent_loop.py`, `dispatcher.py`, `lib/api.ts`. `middleware/maintenance.py` and `ingestion_queue_service.py` have no ledger row: add rows before any plan names them.

### Critical Pitfalls (PITFALLS.md, top five of 27)

1. **Service-role reads re-implementing visibility** — leaks across orgs or under-returns org-shared items. Prevent with the acting-member RLS context and a two-org, non-owner parity test (the keys phase's headline must-have).
2. **Narrowing enforced on search only, or at `tools/list` only.** Enforce in the shared scope object (reuse `expert_scope` intersection semantics) and at `tools/call`; `[]` refused at mint and meaning nothing; one driven test per route (search, read, ask, run, views, relationships, memory); refuse a workflow whose scope is outside a narrowed key.
3. **`ask_agent` as a lethal trifecta** — networked sandbox, `web_search`, connector writes, `remember`/`save_skill` poisoning. MCP-origin turns get a closed read-only tool set (start from `POWER_TOOLS` as the deny list plus every connector write); wrap the prompt in the TRUST-03 envelope; never pause for a human — end with "needs input in the app" plus a link, otherwise Phase 300 emails the owner about a run they did not start.
4. **Retrieved text and tool descriptions as injection vectors.** Structured results with provenance; connection-fed content marked `origin: external` (any outside sender can plant text in the mailbox root); quoted content delimited; markdown images defanged; tool list static and code-authored.
5. **Credentials that outlive access.** One `principal_still_allowed` predicate for keys, OAuth tokens, webhook delivery and run continuation, with a removal test per type; kill switch checked per call; never accept an app session JWT at `/mcp`.

Also load-bearing: stateless mode verified on the deployed two-worker container; the cloud-only proxy failures (421, `http://` in advertised URLs, `.well-known` hitting the SPA); webhook SSRF only through `egress.py`, response bodies never shown; webhooks emitted from DB triggers (document completion has 4+ writers), `webhook-id` stable across retries; redaction must not break citations or ids and must fail closed; a search-only session must appear in operator spend; new tables need an anon-role test (nothing in the suite requests as `anon`); BUG-261022-01 — `_cell` is a plain dict, so bare `{{ name }}` renders a repr `residual_tags_in` cannot see.

## Implications for Roadmap

Seven phases, each sized to the G-8 band (3-5 plans). 303 is independent; 308 (webhooks) can run in parallel with 306 and 307 provided DB-mutating suites are serialized (worktree rule 4).

### Phase 303: Word template bare-token fix (BUG-261022-01)
**Rationale:** Independent and quick; clears a known-open major bug before the new surface lands. The mechanism is read from code but never reproduced end to end, so the repro decides the size — if a few lines, run as `/gsd:quick`, not a phase.
**Delivers:** A bare `{{ name }}` against a cited-record context either renders the value or fails integrity — coerce the cell to render as its value (`{{ name.value }}`, `|default`, `score` keep working), or extend the integrity check to reject rendered record reprs and scan headers, footers and nested tables.
**Avoids:** Pitfall 21. The driver mirrors `template_render_service._replace_in_paragraph`, so fix both copies and re-run golden runs. No image rebuild.

### Phase 304: Acting member and personal MCP keys (no transport yet)
**Rationale:** The trust root. Every tool, the OAuth path and webhook visibility depend on "act as member X in org Y" being proven; reviewed alone, with no transport.
**Delivers:** Migrations 220/221 (key `kind`, `folder_ids`, `tools`, `srl_mcp_` prefix, relaxed CHECK, `'mcp'` origin on `workflow_runs` / `threads` / `runs`, audit literals, settings knobs, org GUC narrowing); extracted `authenticate_presented_key`, `McpPrincipal`, `acting_member.py`; key mint/list/revoke UI with presets (default read-only + expiry) and env-var snippets; org and operator kill switches; admin list and revoke; per-key limiter buckets.
**Avoids:** Pitfalls 1, 2 (empty set), 10, 20, 25, 27. **Headline must-have:** the two-org parity integration test, plus a negative arm (membership removed → next call refused).

### Phase 305: MCP server and read tools, with the redaction choke point
**Rationale:** Read-only first proves transport, auth, limits, result shape and redaction end to end before spending tools exist; the first phase that sends content out, so the outbound guard ships here.
**Delivers:** SDK bump and conscious `test_059` fixture retirement; the `app/mcp/` package, stateless mount, host allowlist from `BACKEND_PUBLIC_URL`, lifespan session manager; `search_knowledge_base`, `list_documents`, `read_document` (bounded, paged, structured, provenance-tagged; `isError`; one identical not-found refusal; dispatch-time tool allow-check; static descriptions; per-key limits; audit and spend attribution); `outbound_guard` with a fail-closed deterministic redactor and per-org policy; a JSON-RPC maintenance body.
**Avoids:** Pitfalls 3, 5, 8, 9, 18, 19, 20, 22, 24, 26. **UAT:** Claude Code and Cursor on the deployed two-worker container; Claude Desktop only via the labelled bridge.

### Phase 306: Ask the agent, run workflows over MCP, and admission control
**Rationale:** Start-type tools cost money and create threads, so they follow the proven read path; admission lands with the first thing it guards.
**Delivers:** `key_run_read` pure-move extraction first; `unattended_chat.py`; `ask_agent` / `get_answer` (closed read-only toolset, short wait then handle, idempotency key, citations and confidence as structured output); `list_workflows` / `run_workflow` / `get_workflow_run` (start and poll; "waiting on <person>" with a link; never answers the person's question); `outside_admission.py` (Redis leases per org, credential and provider, fail-closed; a relayable tool error on MCP, 429 + `Retry-After` elsewhere; optionally `/inbound` starts too).
**Avoids:** Pitfalls 4, 6, 7, 17, and 2 for the agent and workflow routes. **Verification:** the full 8-row cross-provider scoreboard (agent run path touched); a narrowed-key test per route; `harness_audit` shows no power tools for MCP-origin runs.

### Phase 307: OAuth 2.1 sign-in for MCP (Claude.ai and Claude Desktop)
**Rationale:** The only route to the headline clients and a superset of the key model (an OAuth grant is a key minted through a consent screen). Placed before webhooks because it carries the most deploy-parity risk.
**Delivers:** An own thin AS — metadata; authorize → React consent page with org, folder and tool choice; token endpoint with S256 PKCE and rotating refresh; DCR + CIMD advertised; revoke. PRM and the 401 challenge. A grant table (mig 22x). A connected-apps list with revoke; admin revoke-all. `.well-known` routing on cloud and onebox. CIMD fetch through `egress.py`. Redirect allowlist: both Claude callback hosts + port-agnostic loopback.
**Avoids:** Pitfalls 11, 12, 9 (well-known paths), 10 (token path). **Verification:** a real Claude.ai connect, refresh and revoke, plus Claude Code loopback.

### Phase 308: Outbound webhooks
**Rationale:** Independent of 306/307 beyond shared seams (the acting-member re-check and the redaction guard), so it can run in parallel.
**Delivers:** Migration 222; the `webhook` egress capability; swallow-and-warn triggers on `workflow_runs` and `documents` status; `WebhookDrainer`; Standard Webhooks signing with encrypted secrets and overlap rotation; backoff, 410 handling, auto-disable + owner notice; a delivery log (status and latency only), resend, test event; thin payloads and an owner-visibility re-check at send time; member and admin UI; optional `workflow_run.waiting` event.
**Avoids:** Pitfalls 13, 14, 15, 16, 10. **G-6 checks:** every ingest and finalization path emits exactly one event; two-worker dedupe; an SSRF refusal corpus at delivery time; an anon-role test.

### Phase 309: Close-out
**Rationale:** The promise is outside use without opening the app, so docs are the product.
**Delivers:** Public docs (per-client MCP quick start, webhook verification snippets, the statement that Claude.ai needs OAuth); landing facts; G-4 lived-experience rows; a seeds sweep (SEED-013 / 177 / 195 / 081 / 079 flips plus new seeds); a deploy-parity checklist with `get_advisors(security)`; ledger rows.

### Phase Ordering Rationale
- 304 precedes everything: the only phase whose failure is a cross-org data leak, and everything inherits it.
- Reads before spend (305 before 306); redaction ships with the first content egress.
- OAuth is a resolver swap behind the same principal — cheap only after 304, but it lands before webhooks so the headline client does not wait for the end of the milestone.
- Webhooks are parallelizable and reuse 304's re-check and 305's guard.
- 303 first; may collapse into `/gsd:quick`.

### Research Flags

Needs `/gsd:plan-phase --research-phase`:
- **305:** TokenVerifier vs ASGI wrapper; stateless behaviour on both workers with a 2025-11-25 client; static-bearer behaviour in Claude Code and Cursor; redactor false-positive rate and latency on the real corpus; host allowlist and proxy behaviour on cloud and onebox.
- **306:** restricting the MCP-origin tool set through `run_producer` / `ThreadScoping` without editing hot files (unverified); real client timeouts, measured; provider in-flight budgets (SEED-081 evidence table); idempotency design.
- **307 (OAuth spike):** own AS vs the SDK `OAuthAuthorizationServerProvider`; Claude's DCR/CIMD selection; port-agnostic loopback matching; refresh-rotation reuse detection; `.well-known` routing on Vercel, Coolify and onebox; whether Supabase OAuth is cheaper under the RESTRICTIVE-RLS mitigation.
- **304 (focused):** the EXPLAIN check and baseline-gate run for the `current_user_org_ids()` GUC change.

Standard patterns, skip research: 303 (the repro decides), 308 (Phase 300 / 293 patterns + Standard Webhooks), 309.

## Operator Decisions Needed (single list)

Each carries a recommendation. None blocks 303 or 304 except Q9 and Q10, which should be settled before 307 planning.

| # | Question | Recommendation |
|---|---|---|
| Q1 | Is the sandbox (`execute_code`) reachable over MCP at all? | **No.** Retrieval and read tools only; if ever added, disable the container network first. |
| Q2 | Exclude mailbox and other connector-fed folders from new keys by default? | **Yes, opt-in to include.** Mark such results `origin: external`; warn on the key screen. |
| Q3 | Maintenance-mode behaviour for MCP read tools? | **Reads allowed, starts refused**, with a JSON-RPC body on the MCP path. |
| Q4 | `get_run` scope? | **Runs started by this credential only** (293 D-12). |
| Q5 | PII redaction default on or off? | **Per-org setting, operator default off**, fail-closed when on. Connector-fed content flagged regardless. State that names are not covered by the deterministic redactor. |
| Q6 | Webhook ownership? | **Member-owned** (visibility is the owner's), with org-admin list, revoke and kill. Org-owned endpoints later. |
| Q7 | Default key posture? | **Read-only preset + expiry.** `ask_agent` and `run_workflow` are explicit opt-ins. |
| Q8 | Narrowed-key semantics? | Subfolders included, resolved per call; global folders excluded unless ticked; a workflow whose scope is outside the key is refused. |
| Q9 | OAuth AS: own opaque-token AS vs Supabase OAuth 2.1 (D1)? | **Own AS**, unless the spike says otherwise. |
| Q10 | OAuth phase position (D2); accept Claude.ai/Desktop arriving only with 307? | **Fourth phase**, before webhooks. |
| Q11 | Ask wait budget and idempotency (D3)? | **~30 s default, tunable, with a handle.** |
| Q12 | Org narrowing via GUC (D4)? | **Yes, gated** by EXPLAIN and the baseline. |
| Q13 | Admission also covers Phase 293 `/inbound` starts? | **Yes** if cheap in 306; otherwise plant a seed. |
| Q14 | An MCP-origin run hits `ask_user` or an approval pause? | **End with "needs input in the app" + a link.** Never answer over MCP. |
| Q15 | `ask_agent` threads appear in the owner's history with an MCP origin? | **Yes** — the same choice as 293 for key-started runs. |
| Q16 | Ship the `mcp-remote` bridge snippet for Claude Desktop before OAuth? | **Yes, labelled a developer workaround.** The key screen warns against pasting a personal key into Claude.ai org headers. |
| Q17 | Include `workflow_run.waiting` in the first webhook event catalogue? | **Yes** — cheap and unique to Syrel. |
| Q18 | Org-narrow in-app chat search too? | **No**, out of scope (it changes today's answers for two-org members). Plant a seed. |
| Q19 | Canonical MCP URL per topology (cloud vs onebox `/api` prefix; `.well-known` at origin root)? | Decide per topology; make `BACKEND_PUBLIC_URL` load-bearing and refuse the MCP mount if it is loopback in production. |
| Q20 | Cloud migrations 220 → 22x? | Per-action operator approval; paste into cloud before the code deploys; advisors after each. |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (MCP SDK, deps); MEDIUM (OAuth AS, PII) | Dependency resolution measured with a pip dry-run; spec and Claude docs read directly. OAuth AS choice rests on Supabase token docs, not a built spike. |
| Features | HIGH (client facts); MEDIUM (competitor UX); LOW (PII expectations, ChatGPT `search`/`fetch`) | Claude, Cursor and Standard Webhooks docs read directly. |
| Architecture | HIGH (integration points); MEDIUM (GUC narrowing, SDK specifics) | Read from code at `f267f2949`. The GUC edit is a recommendation to validate, not a measured result. |
| Pitfalls | HIGH (spec, Claude, code); MEDIUM/LOW (client timeouts, proxy specifics) | Timeout figures conflict (60 / 240 / 300 s) and are user reports. |

**Overall confidence:** MEDIUM-HIGH.

### Gaps to Address

- **MCP-origin tool restriction.** ARCHITECTURE assumes `ThreadScoping` + `run_producer` suffice; PITFALLS requires a closed read-only set. Verify in 306 research how the tool list is built and whether it can be constrained without editing `agent_loop.py` or `run_producer.py`.
- **Client timeouts.** Measure in 305/306 UAT before raising any default.
- **OAuth specifics unverified:** CIMD support, port-agnostic loopback matching, refresh reuse detection, `.well-known` routing, WAF reachability from `160.79.104.0/21`.
- **Redaction quality:** no data on false-positive rate or latency on real documents; names unhandled; LangSmith traces remain a residual (plant a seed).
- **Hosted topology:** canonical MCP URLs and `.well-known` paths for cloud (Vercel + Coolify) and onebox are undecided.
- **Provider in-flight budgets** for admission need measuring.
- **Seam checks before planning:** ledger rows for `middleware/maintenance.py` and `ingestion_queue_service.py`; the `test_259` inventory pin stays green; `test_059` fixture retirement recorded under a `D-NN`.

## Sources

### Primary (HIGH confidence)
- PyPI JSON and `pip --dry-run` in `backend/venv` (2026-10-30): `mcp` 2.3.0, `sse-starlette`, `standardwebhooks` resolution.
- Context7 `/modelcontextprotocol/python-sdk`: deploy, asgi, legacy-clients, authorization, migration.
- MCP spec 2026-07-28: versioning, authorization, Streamable HTTP, security best practices, changelog.
- Claude connector docs (authentication, build guide, review criteria, add custom connector); Claude Code and Cursor MCP docs.
- Standard Webhooks spec; Stripe webhooks and MCP docs; Svix retries.
- Codebase at `f267f2949`: `api_key_auth.py`, `inbound.py`, `unattended_launch.py`, `run_producer.py`, `notification_drainer.py`, `egress.py`, `rate_limit.py`, `dependencies.py`, `render_template.py`, `main.py`, migrations 215 and 218, `docs/EXTENSION-CONTRACT.md`, `docs/DEPLOYMENT-LESSONS.md`.

### Secondary (MEDIUM confidence)
- Supabase Auth OAuth 2.1 server docs (beta; token security, MCP authentication).
- Vendor MCP docs: Linear, GitHub, Sentry, Glean, Atlassian, Notion.
- Presidio docs; Simon Willison on the lethal trifecta; Invariant Labs on tool poisoning.

### Tertiary (LOW confidence, needs validation)
- Client timeout reports (claude-code issues, a third-party blog).
- The ChatGPT `search`/`fetch` convention.
- An archived Anthropic help article on the callback host change.

---
*Research completed: 2026-10-30*
*Ready for roadmap: yes*
