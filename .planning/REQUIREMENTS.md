# Requirements: Milestone v4.9 Use It From Your Own Tools

**Defined:** 2026-10-30 (operator intake + research: `.planning/research/SUMMARY.md`)
**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviours (skills) that persist and can be shared.
**Milestone goal:** A person can use their knowledge base, agent and workflows from an MCP client (Claude Code, Cursor, Claude.ai, Claude Desktop) and be told by webhook when something happens, without opening the app.

Seeds folded at intake: SEED-013, SEED-177, SEED-195, SEED-081, SEED-079.
Bugs folded at intake: BUG-261022-01.

Decided at intake (operator, 2026-10-30):
- Arms in this milestone: MCP server first, then outbound webhooks. The versioned `/api/v1` REST surface waits for the next milestone.
- Sign-in: personal API keys first; OAuth 2.1 as the **fourth** phase (before webhooks), on our **own** small authorization server whose tokens are MCP grants — not Supabase's OAuth server, whose tokens are replayable against the Data API.
- Personal keys do not reach Claude.ai or Claude Desktop (hosted Claude only accepts an org-shared, owner-entered header). Those clients arrive with the OAuth phase.
- Any member can mint a key that sees only what they see; an org admin can switch MCP off for the org.
- `ask_agent` over MCP uses read-only tools only — no sandbox, web search, connector writes, or memory/skill saves.
- New keys exclude connector-fed folders (mailbox, synced sources) unless ticked.
- PII redaction is a per-org setting, off by default, fail-closed when on.
- The remaining research decisions (Q3-Q8, Q11-Q20 in `research/SUMMARY.md`) take the recommendation recorded there unless revisited at a phase's discuss step.

## v4.9 Requirements

### Personal MCP keys (KEY)

- [x] **KEY-01**: A member can create an MCP key in Settings, see the secret once, and copy a ready-made config snippet for Claude Code, Cursor or VS Code that reads the key from an environment variable. The screen warns against pasting a personal key into Claude.ai's org-wide headers and offers a labelled bridge snippet for Claude Desktop until OAuth ships. — `SEED-013`
- [x] **KEY-02**: A key acts as the member who made it, inside one org. Every result equals what that member sees in the app with that org active — never more, never another org's items. A two-org parity test proves it.
- [x] **KEY-03**: A member can narrow a key to a set of folders (subfolders included) and a subset of tools. Narrowing only removes access, an empty folder set is refused, and the limit holds on every tool (search, read, ask, run). — `SEED-195`
- [x] **KEY-04**: A new key defaults to read-only tools with an expiry. Ask and run are explicit opt-ins, and connector-fed folders (mailbox, synced sources) are excluded unless ticked.
- [x] **KEY-05**: A member sees each key's last use and can revoke it. A key that is revoked or expired, or whose owner left the org or was banned, is refused on its next call.
- [x] **KEY-06**: An org admin can list and revoke every MCP key in the org and switch MCP off for the org; the operator can switch it off for the whole deployment. Both take effect on the next call.
- [ ] **KEY-07**: Every MCP call is audited (key, tool, outcome) and rate-limited per key, with cheap and expensive tools in separate limits.

### MCP server and tools (MCP)

- [ ] **MCP-01**: A member can connect Claude Code or Cursor to one stable MCP URL with their key and see the tool list. It works across both backend workers, on local, cloud and the one-box install. — `SEED-013`, `SEED-177`
- [ ] **MCP-02**: `search_knowledge_base` returns ranked passages with document title, citation and an "open in Syrel" link, and marks connector-fed content as external.
- [ ] **MCP-03**: `list_documents` and `read_document` page through folders and documents and return a document's text in bounded chunks. A missing document and a forbidden one get the same refusal.
- [ ] **MCP-04**: `ask_agent` returns an answer with citations and confidence, using read-only tools only (no sandbox, web search, connector writes, memory or skill saves). If it is not done within the wait budget (a setting, about 30 s by default), it returns a handle that `get_answer` reads later; a retry with the same idempotency key returns the same run.
- [ ] **MCP-05**: An MCP ask appears in the member's thread history, marked as started from MCP.
- [ ] **MCP-06**: `list_workflows` lists what the key may run; `run_workflow` returns a run id at once; `get_workflow_run` returns status and result. A paused run shows "waiting on <person>" with a link and is never answered over MCP. A key reads only the runs it started, and a workflow whose scope lies outside a narrowed key is refused.
- [ ] **MCP-07**: Every tool is labelled read-only or not, and errors come back as tool errors with a plain sentence. In maintenance mode reads still work and starts are refused.

### OAuth sign-in for Claude.ai and Claude Desktop (OAUTH)

- [ ] **OAUTH-04**: A member can add Syrel as a custom connector in Claude.ai or Claude Desktop, sign in, and use the tools. A Syrel consent page names the client and its redirect host and lets the member pick the org and optional narrowing.
- [ ] **OAUTH-05**: Sign-in follows the current MCP authorization spec — protected-resource metadata, S256 PKCE, dynamic client registration and client ID metadata documents, tokens bound to this server — and works on cloud and on the one-box install.
- [ ] **OAUTH-06**: An OAuth grant obeys the same narrowing, liveness checks and kill switches as a key, cannot be used directly against the database API, and its refresh tokens rotate.
- [ ] **OAUTH-07**: A member sees their connected apps and can revoke each one; an org admin can revoke all of them.

### Outbound webhooks (HOOK)

- [ ] **HOOK-01**: A member can add an https webhook endpoint, choose events (run finished, run waiting on a person, document ingested), and send a test event.
- [ ] **HOOK-02**: Deliveries are signed per Standard Webhooks with a secret that can be rolled with an overlap. Payloads carry ids, status and a link — never document content.
- [ ] **HOOK-03**: Every path that finishes a run or ingests a document emits exactly one event per endpoint, even with two backend workers.
- [ ] **HOOK-04**: Failed deliveries retry with backoff. The member sees a delivery log (status, latency) and can resend; an endpoint that keeps failing is disabled and its owner told in-app.
- [ ] **HOOK-05**: A delivery is sent only if the endpoint's owner can still see the item at send time. Endpoints at private or internal addresses are refused when saved and when sent.
- [ ] **HOOK-06**: An org admin can list, disable and delete the org's webhook endpoints.

### Guardrails for outside traffic (GUARD)

- [ ] **GUARD-01**: Outside starts (MCP ask and run, and `/inbound`) are admitted under per-org, per-credential and per-provider limits. When full, the caller gets a plain "try again in N s", and in-app users are not slowed. — `SEED-081`
- [ ] **GUARD-02**: MCP usage, including search-only calls, appears in operator spend attributed to the org and the key.
- [ ] **GUARD-03**: An org admin can turn on PII redaction for MCP results and webhook payloads (off by default). When on, it masks emails, phone numbers, card numbers, IBANs and secrets without breaking citations or ids, and blocks rather than sends unredacted on failure. Names are not covered. — `SEED-079`

### Fix (FIX)

- [ ] **FIX-15**: A Word template using a bare `{{ name }}` renders the value, or fails the integrity check, instead of writing a cited record's dict text into the document. The bug is reproduced through the real sandbox driver first, and `{{ name.value }}` templates keep working. — `BUG-261022-01`

### Register and docs (REG)

- [ ] **REG-10**: SEED-013, SEED-177, SEED-195, SEED-081, SEED-079 and BUG-261022-01 read what actually shipped. Public docs give a quick start per client, webhook signature verification, and the statement that Claude.ai needs OAuth.

## Future Requirements (deferred)

- The versioned `/api/v1` REST surface (operator-deferred to the next milestone).
- An Expert-scoped `ask_agent`.
- ChatGPT `search` / `fetch` tool aliases (verify the convention first).
- Org-owned webhook endpoints (v4.9 endpoints are member-owned).
- Sandbox code execution over MCP, with the container network off.
- Active-org scoping of in-app chat search (today it spans every org the member belongs to).
- Webhook recover-since-date replay; ed25519 signatures.
- OAuth scope step-up; service-account credentials.
- NER-based PII detection (names), and redaction of LangSmith traces.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full-agent `ask_agent` over MCP | An outside prompt plus private data plus network access is an exfiltration path (lethal trifecta) |
| Org-shared MCP keys | A key must identify a person; Anthropic says the same for hosted connectors |
| Answering a paused run over MCP | The decision stays on the signed-in run page, as with email (v4.8) |
| Full-content webhook payloads | Thin payloads keep document content inside the boundary |
| Claude Connectors Directory listing | Blocked by `SEED-294` (no legal entity) |
| Presidio / spaCy redaction | Heavy dependency and model download; the deterministic redactor sits behind an interface so it can slot in later |
| Supabase OAuth 2.1 server | Its tokens are ordinary user JWTs, replayable against the Data API |

## Traceability

**Coverage:** 29 / 29 v4.9 requirements mapped, 0 orphans, 0 duplicates (roadmap 2026-10-30).

| Requirement | Phase | Status |
|-------------|-------|--------|
| KEY-01 | Phase 304 | Complete (2026-10-31) |
| KEY-02 | Phase 304 | Complete (2026-10-31) |
| KEY-03 | Phase 304 | Complete (2026-10-31) — read paths proven; ask/run arms inherit the scope in 305/306 |
| KEY-04 | Phase 304 | Complete (2026-10-31) |
| KEY-05 | Phase 304 | Complete (2026-10-31) |
| KEY-06 | Phase 304 | Complete (2026-10-31) |
| KEY-07 | Phase 305 | Pending |
| MCP-01 | Phase 305 | Pending |
| MCP-02 | Phase 305 | Pending |
| MCP-03 | Phase 305 | Pending |
| MCP-04 | Phase 306 | Pending |
| MCP-05 | Phase 306 | Pending |
| MCP-06 | Phase 306 | Pending |
| MCP-07 | Phase 305 | Pending |
| OAUTH-04 | Phase 307 | Pending |
| OAUTH-05 | Phase 307 | Pending |
| OAUTH-06 | Phase 307 | Pending |
| OAUTH-07 | Phase 307 | Pending |
| HOOK-01 | Phase 308 | Pending |
| HOOK-02 | Phase 308 | Pending |
| HOOK-03 | Phase 308 | Pending |
| HOOK-04 | Phase 308 | Pending |
| HOOK-05 | Phase 308 | Pending |
| HOOK-06 | Phase 308 | Pending |
| GUARD-01 | Phase 306 | Pending |
| GUARD-02 | Phase 305 | Pending |
| GUARD-03 | Phase 305 | Pending |
| FIX-15 | Phase 303 | Pending |
| REG-10 | Phase 309 | Pending |
