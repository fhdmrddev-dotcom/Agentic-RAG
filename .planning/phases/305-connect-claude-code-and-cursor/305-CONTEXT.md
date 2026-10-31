# Phase 305: Connect Claude Code and Cursor - Context

**Gathered:** 2026-10-31
**Status:** Ready for planning
**Mode:** `--auto` (operator: "continue autonomously end to end"). Every gray area was resolved by taking the recommendation in `.planning/research/SUMMARY.md` (D3/D5/D7/D8/D9, Q1-Q5, Q16, Q19), the 304 decisions this phase consumes, or the safest option consistent with them. Each auto choice is logged in `305-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

A member pastes one stable MCP URL and their personal key (304) into Claude Code or Cursor, sees the tool list, and can search, list and read their documents. Every call is audited, counted against per-key limits, shows up in operator spend attributed to the org and the key, and is redacted when their org has turned redaction on.

Delivers: the `mcp` SDK dependency bump with the `test_059` fixture retired on purpose; the `backend/app/mcp/` package mounted stateless at one path; the key auth edge on the one 304 resolver; three read tools (`search_knowledge_base`, `list_documents`, `read_document`) wrapping 304's `acting_member_reads`; tool labels, plain tool errors and the maintenance behaviour; per-call audit, per-key limits in two buckets and spend attribution; the `outbound_guard` redaction choke point with a fail-closed deterministic redactor and its per-org switch.

Requirements: MCP-01, MCP-02, MCP-03, MCP-07, KEY-07, GUARD-02, GUARD-03.
**Not here:** `ask_agent` / `get_answer` / `list_workflows` / `run_workflow` / `get_workflow_run` and admission control (306); OAuth and the `.well-known` / protected-resource-metadata challenge (307); webhooks (308, which reuses `outbound_guard`); public docs (309).

</domain>

<decisions>
## Implementation Decisions

### Transport and mount (MCP-01; research D9, Q19)
- **D-01:** Take the official **`mcp>=2.3.0,<3`** SDK and **`sse-starlette>=3.0.3,<3.1`**. **No FastAPI or Starlette upgrade** (stays 0.115.6 / 0.41.3). The bump deliberately trips the `test_059_disconnect` version fixture: the plan that bumps it **re-validates the SSE endpoints in `runs.py` and `skill_tuner.py`** (driven, not assumed) and **retires the fixture consciously, with the reason written into the test body** — the `D-206-07` precedent. It must never trip by surprise. Exact pins are verified by a `pip --dry-run` in `backend/venv` at execution.
- **D-02:** The server runs **stateless** (`stateless_http=True`, no session ids, no sticky routing). Research decides JSON responses vs SSE for single answers; prefer **JSON responses** if the SDK and both target clients accept them, because nothing in 305 streams. **Proof is a two-worker test:** consecutive calls served by different uvicorn workers succeed (local `WORKER_COUNT=2`, then the deployed container at UAT).
- **D-03:** One new package, **`backend/app/mcp/`** (server, auth edge, tool modules, result shaping). MCP tools **call services**; they are never engine tools. **`_TOOL_REGISTRY` stays at 30** and the `test_259` inventory pin stays green (Extension Contract).
- **D-04:** `main.py` gets **one mount and one lifespan block** (the SDK session manager entered in the host lifespan) and nothing else (G-5, `99 / 73`). `config.py` is not edited unless research proves a new setting is unavoidable; then deployment-artifact parity lands in the **same commit**.
- **D-05:** **Host allowlist** (`TransportSecuritySettings(allowed_hosts=…)`) is **derived from `BACKEND_PUBLIC_URL`**, never hard-coded; local adds the loopback hosts. **In production, refuse to mount** (loud boot log, MCP path answers nothing rather than 421s) when `BACKEND_PUBLIC_URL` is unset or loopback (Q19). The server never advertises an `http://` URL in production.
- **D-06:** Canonical path stays **`/mcp`** on the backend origin (`mcp_tool_catalogue.MCP_PATH`, the one constant D-28 of 304 reserved). Research confirms it **per topology** (local, Vercel + Coolify cloud, one-box behind its `/api` proxy) and edits only `MCP_PATH` / `mcp_url()` if a topology needs a different public path. Trailing-slash and redirect behaviour is pinned by a test (a 307 redirect drops the auth header in some clients).

### Auth edge (MCP-01; research D5; T-304-03, T-304-14)
- **D-07:** Research decides **SDK `TokenVerifier` vs a pure-ASGI wrapper** (D5). Prefer `TokenVerifier` **only if** it can return our single byte-identical 401, run the IP and per-key limiters, and set the principal for the tool call; otherwise the wrapper. **Either way it calls `api_key_auth.authenticate_presented_key(..., expected_kind="mcp")`** — a second resolver is the W-1 drift class and fails review.
- **D-08:** Every `KeyRefused` maps to **one identical response** (status, body bytes and headers; `WWW-Authenticate: Bearer`), **except** the two switched-off refusals, which carry their sentence (304 D-19). Unknown, malformed, revoked, expired, left the org, banned and wrong kind cannot be told apart from outside. An attributable refusal is audited through the existing throttled `api_key.refused` path.
- **D-09:** **An app session JWT presented at `/mcp` is refused** with the same identical 401: the MCP edge never calls `get_current_user` or any Supabase JWT check. (A JWT has no `srl_mcp_` prefix, so the resolver refuses it before any read; a test pins it.)
- **D-10:** The acting org comes **only from `McpPrincipal.org_id`** (T-304-03). No header, query parameter, tool argument or `X-Org-Id` can set or change it. Every read runs through `acting_member_connection` (304); the MCP path **never runs a statement as `anon`** — refused requests touch no member-scoped SQL at all. That is the 305 answer to **BUG-261031-01**'s exposure (see deferred).
- **D-11:** The key is read **from the `Authorization: Bearer` header only**. A key in a URL or query string is never accepted (and not logged).

### The three read tools (MCP-02, MCP-03)
- **D-12:** The tools wrap **304's `services/acting_member_reads.py`** (`search`, `list_documents` / `list_folders`, `read_document`) and add only argument validation, paging and result shaping. **No new visibility SQL in `app/mcp/`**; a static test fences the package from naming `org_members`, the service role or `get_service_role_supabase` for reads.
- **D-13:** `search_knowledge_base(query, limit?)` returns **ranked passages**, each with `document_id`, document title, the passage text, a citation (page / section where the retrieval result carries one), an **"Open in Syrel" link**, and `origin: "external"` on connector-fed passages (`documents.source_connection_id IS NOT NULL`, 304 D-40 — the one predicate). `limit` default 8, max 20.
- **D-14:** `list_documents(folder_id?, cursor?)` pages **through folders and documents**: with no `folder_id` it lists the top level the key can see; with one it lists that folder's subfolders and documents. Page size default 50, max 100, an opaque `next_cursor`. A narrowed key sees only its ticked subtrees (304 D-21/D-22/D-47).
- **D-15:** `read_document(document_id, cursor?)` returns the document's text in **bounded chunks** (a fixed character budget per call, ~8,000 characters, final value set in research against real documents) with `next_cursor` until the end. The chunk boundary never splits inside a citation marker.
- **D-16:** **A missing document and a forbidden one get the same refusal** — same `isError` result, same sentence ("No document with that id is available to this key."), same shape, same timing class. A malformed id gets it too. Tested as byte-equality of the two results.
- **D-17:** The "Open in Syrel" link is built from **`config.primary_frontend_origin()`** (never the raw `FRONTEND_URL` list) plus the app's **existing** document address. Research finds what that address is today (v4.8 gave views and runs `/app` addresses; documents may open through the Library detail panel). If no stable document address exists, research proposes the smallest one; it must open the document for the member and refuse in the app for anyone else.

### Result hygiene (MCP-02; pitfall 4)
- **D-18:** Results are **structured**: `structuredContent` plus a text rendering for clients that ignore it. Every passage carries provenance (document id, title, origin).
- **D-19:** **Quoted content is delimited** — each passage's text sits inside a clearly marked block that says it is retrieved document content, not instructions. **Markdown images and auto-loading links are defanged** (`![alt](url)` → `[image: alt]`; HTML `<img>` stripped), so the caller's client never fetches a URL a document planted.
- **D-20:** **Tool names, titles and descriptions are static, code-authored constants**, short and factual, and never contain user-authored text (folder names, document titles, key labels). A test fails if a description changes at runtime or between two keys.

### Narrowing at call time (pitfall 2)
- **D-21:** `tools/list` shows **only the tools this key may call**, and `tools/call` **re-checks the grant at dispatch** (304's `ToolNotGranted`) — narrowing that holds at list but not at call fails the phase. In 305 the only callable tools are the three read tools; the 306 tool names are never listed, even on a key that granted them, until 306 registers them.
- **D-22:** A narrowed key gets **nothing outside its folders from any of the three tools**: one driven test per tool for a narrowed key, plus the global-folder and connector-fed exclusion arms (304 D-32 extended to the transport).

### Labels and errors (MCP-07; research D7, Q3)
- **D-23:** Every tool carries **`readOnlyHint`** (true for all three) and **`destructiveHint: false`**, plus `openWorldHint: false`. The flags live with the static tool definitions.
- **D-24:** **Every failure inside a tool is a tool error** (`isError: true`) with one plain sentence the caller's model can relay — never a stack trace, never `str(exc)`, never an internal id. Protocol-level JSON-RPC errors are reserved for the transport (bad JSON, unknown method) and for the maintenance refusal of start-type tools.
- **D-25:** **Maintenance mode: reads still work, starts are refused.** `middleware/maintenance.py` blocks every POST today, and every MCP call is a POST, so the MCP path joins its **allowlist** (one entry; ⚠ the file has **no hot-file ledger row** — the plan that names it adds the row and its `docs/HOT-FILE-LEDGER.md` section in the same commit). Inside the server, a dispatch guard refuses any tool that is **not read-only** while maintenance is on, with a **JSON-RPC error carrying the maintenance sentence** — never the HTML or plain 503. In 305 every tool is read-only, so the guard is proven with a test-only non-read tool and 306 inherits it unchanged.

### Audit and per-key limits (KEY-07)
- **D-26:** **Every call writes one audit row** naming the key, the tool and the outcome. **No new audit literal** (304 D-36): reuse `api_key.read` with `metadata.kind = 'mcp'`, `metadata.tool`, `metadata.outcome` (`ok` / `refused` / `error` / `limited` / `redaction_blocked`) and the existing `api_key_id` / label fields. `audit_service.py` and the audit CHECK are not touched. Research measures whether one row per call needs the 293 throttling pattern for floods of *successful* calls; if it does, the throttle counts suppressed rows exactly as CR-02 does, never silently.
- **D-27:** **Two limit buckets per key**, on the shared Redis fixed-window limiter in `services/rate_limit.py` (atomic across both workers, **fail closed**): **cheap** (`list_documents`, `read_document`) and **expensive** (`search_knowledge_base` — it embeds the query, and the 306 tools join this bucket). Prefer reusing the existing `api_key_reads_per_minute` knob for the cheap bucket and adding **one** knob for the expensive bucket (`app_settings`, Settings UI under the existing API-keys knobs, CHECK-bounded like mig 215's). Research confirms whether the new knob can avoid touching `user_settings.py` (FIRING ⛔); if not, one field + readback, the 304 pattern.
- **D-28:** A key over its limit gets a **tool error the client's model can relay** ("This key has made too many searches in the last minute. Try again in N seconds."), not an HTTP 429 the client reports as "couldn't reach". The IP limiter (`enforce_ip_limit`) runs before key lookup, as on `/inbound`.

### Spend attribution (GUARD-02)
- **D-29:** **A search-only MCP session appears in operator spend, attributed to the org and the key.** Every MCP call that spends (the query embedding; rerank if on) records a usage row carrying org, user, key id, tool, model, provider and measured tokens. **It must flow through the ONE `per_root` spend CTE in `db/rates.py`** (or a leg of it) so totals, the ledger and the breakdowns agree by construction — a second spend dialect is the 257 defect. Research picks the storage (a `runs`-shaped row vs a dedicated usage table joined into the CTE) and records it as a `D-NN`.
- **D-30:** An embedding model with no `model_rates` row shows as **unrated** through the existing blind-spot honesty, never priced at $0.00.
- **D-31:** `frontend/src/pages/admin/AdminSpendPage.tsx` **FIRES with "extraction FIRST next" ⛔.** Prefer showing MCP spend through the **existing** breakdown and ledger (data only, no page edit). If the key attribution genuinely needs a page change, the plan **takes the page's named seam first** (pure-move extraction, proven behaviour-neutral) and adds the view in the extracted leaf.

### PII redaction (GUARD-03; research D8, Q5)
- **D-32:** One choke point, **`outbound_guard`** (`backend/app/services/outbound_guard.py`), behind a **`Redactor` protocol**, applied to **every MCP tool result** in 305 and reused by webhooks in 308. Nothing leaves the MCP path except through it.
- **D-33:** The 305 redactor is **in-house and deterministic**: regex plus checksums — emails, phone numbers, card numbers (Luhn), IBANs (mod-97), and secrets/tokens (known key prefixes and high-entropy token shapes). **No Presidio, spaCy or cloud DLP.** **Names are not covered**, and the docs and the setting's own helper text say so.
- **D-34:** It masks **text fields only** (passage text, document text chunks, titles where they carry PII). **Ids, citation markers, cursors and links are never rewritten** — they are passed through by field, not by pattern. A test proves a redacted result's citations, ids and "Open in Syrel" links still resolve.
- **D-35:** **Fail closed:** if the redactor raises or times out, the result is **blocked** — a tool error ("This result was withheld because it could not be checked for personal data.") and an audit outcome `redaction_blocked` — never sent unredacted.
- **D-36:** The switch is **per org, off by default**, set by an **org admin**. Storage follows 304 D-35: a dedicated column (e.g. `organizations.pii_redaction_enabled boolean NOT NULL DEFAULT false`), **not** `organizations.settings` (UPDATE-granted to `authenticated`, so it could be flipped through PostgREST with no audit row). The write is audited as `settings.update` with `metadata.event = 'pii_redaction'` (the 304 precedent). It is read per call, never cached past the existing 30-second settings window.
- **D-37:** The org admin control is **one card in the existing org admin Settings tab** beside `OrgMcpSwitchCard` (same shape, same audit pulse); **no new `OrgAdminShell` tab, no `SettingsPage.tsx` mount**. Copy says what it covers, that names are not covered, and that a result that cannot be checked is withheld.
- **D-38:** **False-positive rate and latency are measured on real local documents** and recorded as evidence in `305-VALIDATION.md` (a committed script under `scripts/` so it re-runs). The measurement is a gate, not a nicety: an unmeasured redactor does not ship.

### Data and migrations
- **D-39:** The next migration number is **222** (304 used 220/221). Any column it adds outside the `authenticated` grant is covered by an **anon-role test** and `get_advisors(security)` runs after the cloud paste (per-action approval). New SECURITY DEFINER functions, if any, revoke `EXECUTE` from **`PUBLIC`** first. ⛔ No `supabase db push` / `db reset`; local paste + `bash scripts/regenerate-full-schema.sh` (no `--reset`).
- **D-40:** **304 + 305 deploy together** (304 D-30). Before that deploy: cloud paste of **220 → 221 → 222**, each with its own approval, then advisors; and the operator confirms **304 D-41** (no tier gate on MCP keys). 305 does not deploy itself — the deploy is operator-triggered.

### Verification and UAT
- **D-41:** **Headline must-haves:** (1) the two-worker stateless test; (2) the identical-refusal tests (credential failures, missing vs forbidden document, app JWT); (3) a narrowed-key test per tool at `tools/call`; (4) redaction fail-closed and citation-preservation tests; (5) a search-only call visible in the spend summary with the org and key.
- **D-42:** **G-4 rows** (operator-style "I'd recognise failure"), driven by Claude at verification: (1) a real Claude Code session (a separate `claude` CLI process configured with the key from `SYREL_MCP_KEY`) lists the three tools, runs a search, gets passages with titles, and the "Open in Syrel" link opens the document in Chrome; (2) an org admin turns redaction on in the org Settings tab, the same search returns a masked email while the link still opens; (3) maintenance on in the Control Room — the search still answers, and the key card's "Last used" moved.
- **D-43:** **Owed to the operator, recorded at close, not claimed:** Cursor (no CLI to drive it); the deployed two-worker cloud container and the one-box (both need a deploy); Claude Desktop through the labelled `mcp-remote` bridge. **Client timeouts are measured here** (Claude Code locally; Cursor and the cloud at operator UAT) and recorded for 306 (research D3).
- **D-44:** **The 8-provider cross-provider scoreboard does not apply**: no LLM is called on any 305 path (search embeds a query; nothing generates). The recorded reason is "no agent, streaming or provider-routing path touched"; 306 runs the full board. Stated as a decision, not an omission.
- **D-45:** Worktree rule 4: suites that mutate the local DB (audit, spend, redaction-switch, parity extensions) serialize. Backend baseline ceiling stays **71** (measured 70); vitest with `GSD_VITEST_MAX_WORKERS=2`; tsc via `-p tsconfig.app.json` as a set diff. ⛔ No edits to `threads.py`, `agent_loop.py`, `dispatcher.py`, `frontend/src/lib/api.ts`.

### Revisions after research (2026-10-31, auto mode; evidence in `305-RESEARCH.md`)
These supersede or refine the decisions they name. The superseded text above is kept so the change is auditable.
- **D-46 (resolves D-07; R-01):** auth is a **pure-ASGI wrapper**, not the SDK `TokenVerifier` (a verifier is yes/no only, cannot carry the switched-off sentences, forces an OAuth issuer setting and cannot see the client address). It calls one `resolve_mcp_principal` → `authenticate_presented_key`.
- **D-47 (refines D-01..D-03; R-02/R-03):** build on the SDK's **low-level `Server`**, not `MCPServer` (it puts `str(exc)` into results). Every tool handler catches everything itself — the SDK otherwise leaks exception text as `{"code":0,"message":str(exc)}`. The principal travels in request state; a RED test proves it in both protocol eras (2025-11-25 and 2026-07-28).
- **D-48 (refines D-01; R-23, measured):** `sse-starlette` pins to **exactly `3.0.3`** (3.0.4 needs Starlette ≥ 0.49.1). 3.0.3 regresses graceful shutdown (upstream #149: an open stream survives uvicorn's exit signal), so the same plan sets **`--timeout-graceful-shutdown`** in `backend/Dockerfile` (deploy-artifact parity, same commit) and drives the shutdown behaviour. The `test_059` fixture keeps its name (26 modules import it) and is retired under this D-NN with the reason in its body. `httpx2` (a required SDK dependency) gets an ownership check against PyPI metadata before install, recorded in the SUMMARY.
- **D-49 (refines D-06; R-05..R-09):** stateless **JSON responses**; `register_mcp(app)` adds **both `/mcp` and `/mcp/`** (a single route 307-redirects to `http://` behind TLS); anything but POST gets **405** (a stateless GET hangs forever); allowed hosts from `BACKEND_PUBLIC_URL`, **no allowed origins** (a request with an `Origin` header is 403). One rule refuses the mount in production when `BACKEND_PUBLIC_URL` is unset, loopback or not https, and makes `mcp_url()` return `None` so the key screen shows "No address yet". `MCP_PATH` stays `/mcp`; URLs are `http://localhost:8000/mcp` (local), `https://api.superrag.cloud/mcp` (cloud), `https://<host>/api/mcp` (one-box). **No `config.py` edit, no new env var**; the one-box example default's comment is updated. The session manager is rebuilt on each lifespan entry (13 test modules enter it).
- **D-50 (refines D-08; R-27):** the two switched-off refusals return **HTTP 403** with their sentence; every other credential failure is the one identical 401.
- **D-51 (refines D-14/D-15; R-12..R-16):** read budget **8,000 characters** with a validated cursor; `acting_member_reads.list_documents` gains a `folder_id` argument (one additive change in the 304 module); search `limit` overrides the member's top-k.
- **D-52 (resolves D-17; R-17):** no document address exists today. The link is **`/app/library/<uuid>`**, opened through the citation "open document" hand-off `LibraryPage` already consumes. `frontend/src/lib/citationNav.tsx` has **no ledger row** — the plan that names it adds the row first. No `document` link-resolver kind in 305.
- **D-53 (refines D-26; R-18):** one audit row per call; throttle only refusals. Over-limit and not-granted calls are written as **`api_key.refused`** (the 293 precedent), and the key card's activity readback is fixed so a refused MCP call never reads as OK (one expression).
- **D-54 (resolves D-27; R-19):** the expensive-bucket knob **needs `user_settings.py`** (one field + one readback, the 304 pattern). The MCP IP limit gets its own bucket so MCP traffic cannot starve `/inbound`.
- **D-55 (resolves D-29..D-31; R-20):** spend storage is a new **`mcp_usage` table** (mig 222) added as a **second leg of the one `per_root` CTE** — a `runs` row is impossible (`runs.thread_id` required, no key column). Query-embedding tokens are captured by one call in `embed_texts` to a small usage collector (they are discarded today). Unrated embeddings show as unrated. The key label goes into the spend ledger's existing attribution cell (a separate small file); **`AdminSpendPage.tsx` is not touched.**
- **D-56 (refines D-33..D-35; R-21/R-22):** redact text fields only and **render the text block from the redacted structured result**; redact each read chunk with a **128-character overlap window**; fail closed on any error or a **2 s deadline**. Tight rules: cards need brand prefix + length + Luhn + grouping or a nearby keyword; phones need international form or a nearby keyword. Measured baseline (9,928 local chunks): 0.15 ms p95 per chunk. The org switch is `GET`/`PUT /org/api-keys/pii-redaction` on the existing org router, storage `organizations.pii_redaction_enabled` (mig 222).
- **D-57 (R-24, R-25, R-26, R-28):** an access-log filter strips query strings from MCP lines; the two-worker integration test logs both process ids; client timeouts are measured with a standalone probe against the installed Claude Code; the service-role client build moves off the event loop on the search path (304 IN-03).
- **D-58 (R-29):** **four plans** — 01 alone in wave 1 (dependency install in the main checkout after merge, `test_059`, mig 222, transport, two-worker test); 02 the three tools + the document address; 03 audit, limits, spend; 04 redaction + org card. Every plan writes the local DB, so plans serialize on the local-DB lock (worktree rule 4).

### Claude's Discretion
- Plan split within G-8 (3-5). A natural cut: (1) dependency bump + `test_059` retirement + SSE re-validation + package skeleton, mount, host allowlist, auth edge, maintenance allowlist; (2) the three tools, result shaping, hygiene, narrowing at call; (3) audit, limit buckets, spend attribution (mig 222 if needed); (4) `outbound_guard` + redactor + org switch + its card + the FP/latency measurement; (5) bookkeeping (ledger rows, count-gate pins, `CLAUDE.md` FIRING rows) if it cannot share a wave.
- Module and file names inside `backend/app/mcp/`; exact sentences within the decisions above; the chunk budget and page sizes within the stated bounds.
- Whether `list_folders` is exposed only through `list_documents` (D-14, no new tool name) — it must be, since the tool catalogue is fixed by 304 D-11.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/SUMMARY.md` — D3 (wait budgets, for the timeout measurement), D5 (auth placement), D7 (maintenance), D8 (redaction ships here), D9 (SDK + `test_059`), Q1-Q5, Q16, Q19
- `.planning/research/STACK.md` — `mcp` 2.3.x `MCPServer` + `streamable_http_app(stateless_http=True)`, `TransportSecuritySettings`, session manager in lifespan, the `sse-starlette` cap, the in-house redactor
- `.planning/research/ARCHITECTURE.md` — `backend/app/mcp/`, `McpPrincipal`, `outbound_guard`, hot-file discipline
- `.planning/research/PITFALLS.md` — pitfalls 3, 5, 8, 9, 18, 19, 20, 22, 24, 26 (421 / `http://` in production, stateless on two workers, injection via results and descriptions, redaction breaking ids, spend gaps, maintenance HTML)
- `.planning/research/FEATURES.md` — tool hygiene table stakes, result shape, citations as structured output
- `.planning/REQUIREMENTS.md` — MCP-01/02/03/07, KEY-07, GUARD-02/03
- `.planning/ROADMAP.md` §"Phase 305" — success criteria, "How we'd know this failed", Flags

### Phase 304 (what this wraps)
- `.planning/phases/304-personal-mcp-keys-that-act-as-you/304-CONTEXT.md` — D-11 (tool catalogue), D-17/D-18/D-19 (one resolver, liveness, refusals), D-20 (`McpPrincipal`), D-21..D-24 + D-38/D-40/D-46/D-47 (narrowed reads), D-28 (`MCP_PATH`), D-30/D-41 (deploy together, tier gate owed)
- `.planning/phases/304-personal-mcp-keys-that-act-as-you/304-SECURITY.md` — T-304-03, T-304-14, UF-1 (BUG-261031-01 needs a 305 threat id), UF-2
- `.planning/phases/304-personal-mcp-keys-that-act-as-you/304-REVIEW.md` — IN-01..IN-09 (IN-02 `wrong_kind` reachability, IN-03 service-role clients on the loop, IN-05 `view_documents` errors)

### Code this phase builds on
- `backend/app/security/api_key_auth.py` — `authenticate_presented_key`, `KeyRefused`, `audit_key_call(_now)`, refusal throttle
- `backend/app/security/mcp_principal.py`, `backend/app/security/principal_liveness.py`, `backend/app/security/acting_member.py`, `backend/app/security/acting_org.py`
- `backend/app/services/acting_member_reads.py` — the reads the tools wrap; `ToolNotGranted`
- `backend/app/services/mcp_tool_catalogue.py` — tool names, `MCP_PATH`, `mcp_url()`
- `backend/app/services/rate_limit.py` — shared Redis limiter, fail closed
- `backend/app/middleware/maintenance.py` — the POST block the MCP path must be allowlisted from (no ledger row yet)
- `backend/app/db/rates.py` + `backend/app/api/admin_spend.py` — the ONE `per_root` spend CTE
- `backend/app/config.py` `primary_frontend_origin()` — the one origin for links
- `backend/tests/integration/test_059_disconnect.py` — the fixture to retire under a `D-NN`
- `supabase/migrations/215_api_keys_and_run_origin.sql`, `220_*.sql`, `221_*.sql` — key table, grants, limits knobs

### Project rules
- `CLAUDE.md` §Rules (baseline 71, migrations via SQL editor, `regenerate-full-schema.sh`), §Supabase MCP (writes approval-gated; the `PUBLIC` EXECUTE trap; advisors), §Deployment (deploy-artifact parity same commit), §Workflow guardrails (G-2, G-4, G-5, G-8)
- `docs/EXTENSION-CONTRACT.md` — MCP tools are services; `_TOOL_REGISTRY` stays 30
- `docs/HOT-FILE-LEDGER.md` — sections for `backend/app/main.py`, `backend/app/config.py`, `frontend/src/pages/admin/AdminSpendPage.tsx`, `backend/app/models/user_settings.py`; add `backend/app/middleware/maintenance.py`
- `docs/DEPLOYMENT-WORKFLOW.md`, `docs/DEPLOYMENT-LESSONS.md` — proxy and host behaviour on Coolify / Vercel / one-box
- `docs/CONNECTOR-ARCHITECTURE.md` — MCP-first verdict (`D-v3.6-01`)
- Client docs (provider-docs-first, read in research): Claude Code MCP docs, Cursor MCP docs, the MCP spec 2026-07-28 (Streamable HTTP, tools, security best practices)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authenticate_presented_key(presented, pool=, redis=, call=, expected_kind="mcp")` returns a `ResolvedKey` with `kind`, `folder_ids`, `tools`, `include_external`, or raises `KeyRefused(reason, sentence)`; it already touches `last_used_at`.
- `acting_member_reads.py` (465 lines): `list_folders`, `list_documents`, `read_document`, `search`, `list_views`, `view_documents`, `related_documents`, `list_workflows`, each on `acting_member_connection` with the `KeyScope` applied and `d.retrievable` (304 D-46).
- `mcp_tool_catalogue.py`: the static tool names and presets, `MCP_PATH = "/mcp"`, `mcp_url()`.
- `rate_limit.hit` / `enforce_key_limit` / `enforce_ip_limit`: Redis fixed window, MULTI/EXEC, fail closed with 503 — the MCP edge turns its refusals into tool errors.
- `audit_key_call` / `audit_key_call_now` and the CR-02 refusal throttle.
- `OrgMcpSwitchCard.tsx` in `OrgSettingsTab.tsx` — the shape for the redaction card.

### Established Patterns
- One byte-identical refusal for every credential failure; only switched-off refusals carry words.
- Per-org booleans as dedicated columns outside the `authenticated` grant (304 D-35); audited as `settings.update` + `metadata.event`.
- No new audit literals: `api_key.*` with `metadata.kind = 'mcp'` (304 D-36).
- Pure-ASGI middleware, never `BaseHTTPMiddleware` (SSE byte-transparency), as `maintenance.py` and `canvas_gate.py` do.
- Spend is one CTE; every spend number derives from it.

### Integration Points
- `main.py` (one mount + one lifespan block), `maintenance.py` (one allowlist entry), `rate_limit.py` (one bucket kind), `db/rates.py` (one spend leg), org Settings tab (one card), mig 222.
- Consumers next: 306 (adds ask/run tools to the same server, the expensive bucket, the maintenance start guard), 307 (swaps the credential resolver behind `McpPrincipal`; adds the 401 `resource_metadata` challenge), 308 (reuses `outbound_guard`).

</code_context>

<specifics>
## Specific Ideas

- The member's experience should be: paste the snippet from the key screen, restart the client, see three tools, ask "what do my documents say about X", get passages with titles and links that open in Syrel.
- Guardrails firing at this discuss step (recorded in `STATE.md → Guardrail overrides`):
  - **G-2** (UI hint: the org redaction card, possibly a spend view): the operator chose autonomous end-to-end, so the acceptance bar is the UI-SPEC from `/gsd:ui-phase` plus the Claude-driven G-4 rows. The UI extends shipped, approved surfaces (`OrgMcpSwitchCard`, the spend breakdown).
  - **G-5:** `main.py` (one mount + one lifespan block), `config.py` (no edit preferred), `AdminSpendPage.tsx` (no edit preferred; seam first if touched), `user_settings.py` (at most one field + readback) — honoured by construction. `maintenance.py` gets its ledger row before its one edit.
- Timeouts: record what Claude Code does with a slow search (it is the input 306 needs for its ~30 s ask budget).

</specifics>

<deferred>
## Deferred Ideas

- "Test this key" button on the key card (304 deferred it to 305; not in any 305 requirement or success criterion) — re-offer at 309 close-out or as a quick task after deploy.
- Name redaction (Presidio-class NER) — out of scope by GUARD-03's own text; the `Redactor` protocol is the slot.
- Redaction of LangSmith traces and app logs (SEED-079's other arms) — residual; SEED-079 stays partly open.
- Org-shared MCP keys, `/api/v1` REST, service accounts — out of scope (REQUIREMENTS).
- ChatGPT `search` / `fetch` tool aliases — verify the convention first (research LOW confidence).

### Reviewed reported bugs
- **BUG-261031-01** (anon call to `current_user_org_ids()` crashed local Postgres) — **not folded; deferred** with a re-open trigger. 305's part is a threat id (304-SECURITY UF-1) and D-10: the MCP path never runs member-scoped SQL as `anon`. The reproduction itself is an operator action on a disposable Postgres 17.6 (STATE Owed); never on the shared stack or production.
- `BUG-261030-02` (Vercel previews cannot open the app) — deploy/routing, unrelated to the MCP path; left open.
- The rest of the open `Agentic-RAG` reports are chat, panel, nav or template surfaces this phase does not touch; left open.

### Seeds
- The register sweep matched **0 seeds by path** (the phase has no plans yet; re-run after planning). Routed at intake and folded here by scope:
  - `SEED-177` (MCP both ways) — the inbound-server arm lands here.
  - `SEED-079` (PII / DLP) — the MCP-results arm lands here (GUARD-03); logs, traces and provider egress stay open.
  - `SEED-013` — in part (the server and read tools); OAuth and webhooks remain in 307/308.
- `SEED-081` (admission control) — 306, not here.

</deferred>

---

*Phase: 305-connect-claude-code-and-cursor*
*Context gathered: 2026-10-31*
