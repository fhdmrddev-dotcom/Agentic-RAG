---
phase: 115
slug: virtual-folders-agent-tool
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-20
---

# Phase 115 — Security

> Per-phase security contract for the `query_documents_by_view` agent tool (VIEW-07).
> Verify-mitigations mode (State B): every threat in the plan-time register
> (3 PLAN files) was verified against the IMPLEMENTED source — documentation and
> intent were NOT accepted as evidence. The cross-user leak triad was proven LIVE.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| model tool-call → handler | The model supplies untrusted, polymorphic `view`/`filter`/`limit`; validated at the handler edge (`_handle_query_documents_by_view`) | LLM-emitted filter literals, a view name, a row limit |
| handler → resolve core | The handler passes `caller = ctx.current_user["id"]` into `resolve_filter`; the core caller-scopes own+global — the leak boundary (VIEW-06) | The dispatching user's id; never `view["user_id"]` |
| filter value → SQL/PostgREST | Untrusted filter literals cross into the PostgREST builder; must stay bound params (no f-string SQL) inherited from the reused compiler | Attacker-controllable metadata values |
| workflow phase → dispatch | A locked harness phase's `phase_whitelist` is the EoP boundary; the tool obeys it via the generic `dispatch_tool` guard | Tool name vs the phase allow-set |
| model → advertised tool schema | The schema is the only surface the model fills; a non-cross-provider-safe shape (anyOf/oneOf) breaks Gemini | JSON-Schema tool definition |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified in source) | Status |
|-----------|----------|-----------|-------------|---------------------------------|--------|
| T-115-01-01 | Information Disclosure | `resolve_filter` extraction — cross-user leak if caller-scoping dropped | mitigate | Every documents leg scopes from `caller`: count-only own leg `.eq("user_id", caller)` (`document_view_resolver.py:300`), count-only global leg via `get_globally_visible_folder_ids(supabase, caller)` (`:285,304-310`); listing own leg `.eq("user_id", caller)` (`:318`), global leg `:324-331`. NEVER `view["user_id"]` (grep confirms 0 occurrences). Single core, no fork (`grep -c "async def _resolve_filter"` in route = 0). **Proven LIVE.** | closed |
| T-115-01-02 | Tampering | filter value → SQL injection / SSTI | mitigate | `view_filter_compiler.compile_filter` (`document_view_resolver.py:192`) emits bound Fragments; every value rides a bound PostgREST param via `.contains/.gte/.lt/.lte/.in_/getattr(q,builder)(col,value)` (`:240-279`) — never string-interpolated. The one `.or_()` (`is_empty`, `:273`) embeds only HARD-CODED literals + a whitelisted constant field key. No f-string SQL introduced in the move. | closed |
| T-115-01-03 | Denial of Service | relative-date span overflow (`_relative_window`) | mitigate | `_MAX_RELATIVE_DAYS = 36500` clamp (`document_view_resolver.py:75`) + `span = max(0, min(..., _MAX_RELATIVE_DAYS))` (`:105`) + `try/except OverflowError` on both `today ± timedelta` branches (`:107-117`). Moved verbatim — an absurd N can never raise an unhandled 500. | closed |
| T-115-01-04 | Tampering | range op on a custom number field (lexical "9">"100") | mitigate | `validate_operands(flt, number_fields)` (`document_view_resolver.py:184`) → `view_filter_compiler.validate_operands` rejects `_RANGE_OPS` on a numeric custom field (`view_filter_compiler.py:241-243`); the raised `ValueError` is caught and re-raised as `ResolveError(detail=...)` (`document_view_resolver.py:185-186`), carrying the rejection detail to the calm-error boundary. | closed |
| T-115-02-01 | Information Disclosure | cross-user leak via a seeded global view | mitigate | Handler passes ONLY `caller = ctx.current_user["id"]` (`tool_dispatcher.py:342,397-403`) into `resolve_filter`; never `view["user_id"]`. The resolver caller-scopes own+global (see T-115-01-01). **Proven LIVE** by the two-user leak test (not the RLS label). | closed |
| T-115-02-02 | Information Disclosure | view-name existence leak | mitigate | `get_view_by_name` reuses owner-scoped `list_views` (own+global, `document_view_service.py:154`) and filters in Python; unknown/unseeable name → `None` (`:157-158`) → handler routes to `_catalog()` (`tool_dispatcher.py:366-367`), never a 403/distinguishable error. Name is NEVER interpolated into a `.or_()`/`.eq()` grammar (WR-02 surface avoided). | closed |
| T-115-02-03 | Tampering | SQL/SSTI via an inline filter value | mitigate | `ViewFilter.model_validate(inline)` (`tool_dispatcher.py:384`, Literal-op reject) + the reused `compile_filter` bound params (see T-115-01-02). No f-string SQL in the handler. | closed |
| T-115-02-04 | Tampering | prompt-injected over-broad filter | mitigate | Empty conditions = no narrowing (resolver `[]` → no clip, D-113-9); results bounded by caller scope regardless (T-115-01-01); `validate_fields` rejects unknown/`_`-prefixed fields (`document_view_resolver.py:183`, `view_filter_compiler.validate_fields`). | closed |
| T-115-02-05 | Error Handling / DoS | a bad model filter raising into the agent loop | mitigate | `ResolveError` caught → calm ToolResult (`tool_dispatcher.py:405-410`); Pydantic `ValidationError` on a malformed inline filter (`:384-390`) and on an unparseable saved view (`:368-379`) caught → calm ToolResult. **Security objective met** (no stack trace / crash / DoS / leak reaches the user). See **Robustness Caveat** below — the WR-01 `limit`-parse and WR-03 catalog paths can raise out of the handler, but the agent-loop catch-all (`agent_loop.py:2097-2102`) converts them to a calm `"Tool error: …"` string with no leak. Robustness gap → backlog, NOT a security blocker. | closed |
| T-115-02-06 | Repudiation | audit-log evasion | mitigate | Every concrete resolve fires `write_audit_entry(action_type="search.query", metadata={via:"view"/"filter", document_ids:[…]})` via `ctx.spawn` (`tool_dispatcher.py:426-436`); `search.query` is in `VALID_ACTION_TYPES` (`audit_service.py:14`) — no new enum, no migration. Fire-and-forget with a getattr-guard so a write failure never breaks the answer. | closed |
| T-115-03-01 | Information Disclosure | cross-user leak via the agent tool path | mitigate | The LIVE two-user leak test drives `_handle_query_documents_by_view` directly (`test_115_tool_global_leak.py:244,250-253`), NOT the route — asserts disjoint id sets (`:271-273`), disjoint filenames (`:274`), differing totals 2 vs 1 (`:265-267`), unknown view → catalog never 403 (`:289-296`). **RAN LIVE on :54322, PASSED (not skipped).** | closed |
| T-115-03-02 | Elevation of Privilege | tool callable in a workflow phase that didn't allow it | mitigate | `dispatch_tool` `phase_whitelist` guard refuses a non-whitelisted tool BEFORE the registry lookup (`tool_dispatcher.py:2627-2638`); the handler is fetched only after (`:2639`). NO special-casing of `query_documents_by_view` around the guard (verified by reading the full guard + registry). Unit test proves excluded→refusal, included→dispatch, None→dispatch (3/3 PASS). | closed |
| T-115-03-03 | Tampering | cross-provider-unsafe schema (anyOf/oneOf) | mitigate | `QUERY_DOCUMENTS_BY_VIEW_TOOL` (`openai_service.py:107-189`) uses flat optional `view`/`filter`/`limit`; `value` is a JSON-Schema type-array `["string","number","boolean","null"]` (`:159`), NOT anyOf; either/or invariant in PROSE (`:118-121`); NO `anyOf`/`oneOf` anywhere. Unit schema test asserts their absence + op-enum ≡ `ViewCondition.op` + view/filter optional (3/3 PASS). | closed |
| T-115-03-04 | Information Disclosure | "registered but not advertised" (inverse Phase-101 bug) | mitigate | Dual-wiring verified: in `_TOOL_REGISTRY` (`tool_dispatcher.py:2584`) AND in `get_tools()` assembly (`openai_service.py:970`). Unit wiring test asserts BOTH contain the tool and agree (3/3 PASS); `get_tools()` runtime check confirms `query_documents_by_view` is advertised. | closed |
| T-115-02-SC | Tampering | npm/pip/cargo installs (supply chain) | accept | Zero packages installed this phase — see Accepted Risks Log AR-115-01. | closed |
| T-115-03-SC | Tampering | npm/pip/cargo installs (supply chain) | accept | Zero packages installed this phase — see Accepted Risks Log AR-115-02. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Robustness Caveat (non-blocking — backlog, NOT a security gap)

The handler docstring (T-115-02-05) promises "errors NEVER escape into the agent
loop." Two paths breach the handler's OWN contract but do NOT breach the security
objective (no crash / no raw stack trace / no leak reaching the user), because the
agent loop's outer catch-all (`agent_loop.py:2097-2102`, which explicitly catches
`ValueError`/`RuntimeError`/`Exception`) converts any escape to a calm
`"Tool error: …"` tool-result string and continues:

- **WR-01** (`tool_dispatcher.py:394`): `limit = max(1, min(int(args.get("limit") or 20), 50))`
  is OUTSIDE the `try/except` (which starts at `:396`). A weak model emitting
  `{"limit": "twenty"}` raises `ValueError` out of the handler — **reproduced live**
  (`int("twenty")` → `ValueError`). Caught by the loop; user gets a generic
  `"Tool error: invalid literal for int()…"` instead of the designed catalog-pointing
  recovery. The exception text carries no sensitive data. Suggested fix: reuse the
  module's existing `_normalize_optional_int` defensive coercion.
- **WR-03** (`tool_dispatcher.py:344-356`): `_catalog()` (the no-args default + the
  unknown-view fallthrough) runs `list_views` / `_build_field_meta` with no guard; a
  transient DB error raises out of the handler — again caught by the loop, no leak.

**Disposition:** These are robustness / contract-fidelity gaps, not security
vulnerabilities. The security-relevant invariant T-115-02-05 protects (no stack
trace, no crash, no DoS, no information disclosure reaching the user; error
self-corrects) holds via defense-in-depth at the loop layer. At ASVS L1 with
`block_on: open`, T-115-02-05's security disposition is CLOSED. Logged here so the
gap is auditable and not silently dropped; recommend folding the WR-01/WR-03 fixes
into a follow-up (they are also flagged in `115-REVIEW.md`).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-115-01 | T-115-02-SC | Zero packages installed this phase. `git diff df935231..HEAD -- backend/requirements.txt backend/Dockerfile.sandbox` is EMPTY (verified). No supply-chain / slopcheck surface introduced. | gsd-security-auditor | 2026-06-20 |
| AR-115-02 | T-115-03-SC | Zero packages installed this phase (same verification as AR-115-01; no dependency manifest change). Pure in-process schema constant + one registry line + test files. | gsd-security-auditor | 2026-06-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. All three SUMMARY files (`115-01`, `115-02`, `115-03`) report `## Threat Flags:
None` — no new network endpoint, auth path, file-access pattern, or schema change at a
trust boundary was introduced. The phase reuses the existing caller-scoped
`resolve_filter` (VIEW-06) and the existing `search.query` audit. Code-review finding
CR/WR-01–WR-03 (`115-REVIEW.md`) are robustness/honesty items, all within the declared
register (folded into the T-115-02-05 robustness caveat above), not new attack surface.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-20 | 16 | 16 | 0 | gsd-security-auditor |

Verification method (State B, verify-mitigations mode):
- 14 `mitigate` threats verified by reading the cited source (resolver, handler,
  schema, service, dispatch guard) — not by accepting the SUMMARY claims. The
  cross-user leak triad (T-115-01-01 / 02-01 / 03-01) was confirmed by source
  scoping AND by running the live two-user leak proof on :54322 (2/2 PASS, not skipped).
- 2 `accept` threats (supply chain) verified by an empty `git diff` of the dependency
  manifests and documented in the Accepted Risks Log.
- Full phase suite re-run live: 23 passed, 1 xfailed (the intentional Plan-01
  live-bad-field surface assertion), 0 failed.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-115-01, AR-115-02)
- [x] `threats_open: 0` confirmed
- [x] Cross-user leak triad proven LIVE (non-vacuous), not by an RLS/code label
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-20
