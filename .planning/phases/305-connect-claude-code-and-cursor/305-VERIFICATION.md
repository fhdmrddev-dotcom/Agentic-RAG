---
phase: 305-connect-claude-code-and-cursor
verified: 2026-10-31
status: human_needed
score: 4/5 roadmap success criteria verified (SC#1 partial — local + Claude Code verified; Cursor, cloud two-worker container and one-box owed to the operator) · requirements 6/7 satisfied, MCP-01 needs human
verification_mode: self-verified
independent_review: self
verified_at_head: 3b9d1d7cd
base: 43e95f6b5
overrides_applied: 0
deferred:
  - truth: "GUARD-03 — redaction of webhook payloads (the requirement covers 'MCP results and webhook payloads')"
    addressed_in: "Phase 308"
    evidence: "Phase 308 SC#1: 'Payloads carry ids, status and a link, never document content, and pass through the redaction guard when the org has it on'; 308 'Depends on ... Phase 305 (the outbound guard)'"
human_verification:
  - test: "Cursor: add the key to Cursor's MCP settings, list tools, run one search, open one Open in Syrel link"
    expected: "Three read-only tools listed; ranked passages with titles and links; the link opens the document panel; note any call past ~60 s"
    why_human: "Cursor has no CLI to drive (D-43); ROADMAP SC#1 names Cursor explicitly"
  - test: "Deployed two-worker cloud container: after the 304+305 deploy (migs 220 -> 221 -> 222 pasted, each approved; get_advisors(security)), one claude CLI search against the cloud /mcp URL"
    expected: "Answers on https; BACKEND_PUBLIC_URL is the https public address (otherwise /mcp is a 404 by design); no 421; consecutive calls succeed across workers"
    why_human: "Needs an operator-triggered deploy; SC#1 names the deployed two-worker cloud backend"
  - test: "One-box: the same search through the one-box nginx (Host without a port, BACKEND_PUBLIC_URL = https://<host>/api)"
    expected: "Answers; the allowed-host list accepts the bare host"
    why_human: "Needs a one-box deploy; SC#1 names the one-box"
  - test: "Claude Desktop via the labelled mcp-remote bridge"
    expected: "Tools listed, one search answers"
    why_human: "Desktop client, no CLI (D-43; ROADMAP Flags 'Claude Desktop only through the labelled bridge')"
  - test: "G4-1 non-member arm as written: a SECOND account that is not a member of the org opens the SAME Open in Syrel link"
    expected: "'This document can't be opened', no panel, no title"
    why_human: "The 2026-10-31 drive substituted a foreign-org document under the same login (recorded in 305-VALIDATION §2.2 G4-1); the same refusal path, but not the scenario as scoped"
  - test: "305-REVIEW WR-04 and WR-06 'fixed: requires human verification' checks"
    expected: "Operator accepts (a) one literal '✕ not available: nothing this key can read there' covering not-available, bad-cursor and no-text alike; (b) list_documents paging folders and documents together (not folders first)"
    why_human: "Copy and paging-order decisions recorded in the fix log as owed to a human; no record of either being answered"
---

# Phase 305: Connect Claude Code and Cursor — Verification Report

**Phase Goal:** A member connects Claude Code or Cursor to one stable MCP URL with their key and can search, list and read their documents; every call is audited, limited per key, counted in operator spend, and redacted when their org asks for it.
**Verified:** 2026-10-31 at `3b9d1d7cd` (base `43e95f6b5`, 92 commits)
**Status:** human_needed
**Re-verification:** No (initial)
**Mode:** self-verified; `independent_review: self`. Read-only on source. No production, no Supabase MCP, no role-anon statement, operator's :8000 untouched (every live suite here runs in-process over `httpx.ASGITransport` or on its own free-port uvicorn).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Success criterion | Status | Evidence (code · test) |
|---|-------------------|--------|------------------------|
| 1 | Claude Code and Cursor connect to one stable MCP URL with a key and see the tool list on local, the deployed two-worker cloud backend and the one-box; consecutive calls on different workers succeed with no sticky session; an app session JWT is refused (MCP-01) | **PARTIAL** (human_needed) | `backend/app/mcp/__init__.py:37-54` registers `Route("/mcp")` + `Route("/mcp/")` (POST only, no Mount, no redirect), refuse-mount through `mcp_tool_catalogue.mcp_public_base()` (`services/mcp_tool_catalogue.py:119-147`: production needs https and non-loopback); `mcp_lifespan()` `stateless_http=True, json_response=True` (`__init__.py:57-73`); `main.py` +1 import, +1 `register_mcp(app)`, the one yield wrapped. Edge `mcp/edge.py:121-171`: 405 before key, `mcp_ip` bucket fails closed, Bearer header only, ONE 401 built at import (`:55-63`), only `mcp_off_*` -> 403. Host allowlist derived from `BACKEND_PUBLIC_URL` (`mcp/transport.py:38-58`, origins empty). Tests (re-run here): `test_305_two_worker_stateless` (20+ fresh connections, >= 2 worker PIDs, no `Mcp-Session-Id`) PASS; `test_305_refusals_live::test_every_refusal_is_one_identical_401` includes the `"app session jwt"` arm PASS; units `test_305_transport/edge_refusals/mount_predicate/lifespan_reentry/package_fence` PASS. Live Claude Code 2.1.312 drive: `evidence/g4/g4-1-claude-cli-search.txt`. **Not verifiable here:** Cursor, cloud container, one-box (owed, D-43) |
| 2 | `search_knowledge_base` returns ranked passages with title, citation and an "Open in Syrel" link, connector-fed passages marked external, quoted content delimited; `list_documents` / `read_document` page through folders and return text in bounded chunks; missing and forbidden get the same refusal; a narrowed key gets nothing outside its folders from any tool (MCP-02, MCP-03) | **VERIFIED** | `mcp/results.py:122-131` `Passage` (document_id, title, passage, citation, link, origin, version); `doc_link` = `primary_frontend_origin() + /app/library/<id>` (`:189-191`); `origin_of` external iff `source_connection_id` (`:194-196`; retrieval rows carry it, `retrieval_documents.py:34`); `_block` wraps every passage in BEGIN/END RETRIEVED DOCUMENT CONTENT with marker words neutralised (`:401-402, 247-251`); `defang` (`:222-233`). `read_tools.py:68-123` folders + documents paging via one validated cursor; `read_document` 8,000-char chunker (`results.py:358-394`); every missing/forbidden/other-org/out-of-scope/bad-cursor -> `NOT_AVAILABLE_SENTENCE` (`read_tools.py:129-139`). Narrowing is 304's `acting_member_reads` (folder predicate appended after scope clauses, `acting_member_reads.py:177-199`). Frontend `/app/library/<uuid>` route (`lib/appRoutes.ts`), `DocumentCantBeOpened` mounted once in `LibraryPage.tsx`. Tests re-run: `test_305_tools_live` (D-16 byte-identical body), `test_305_narrowed_tools_live` (6 arms incl. grant re-check at call, global folder, include_external) PASS; units `test_305_search_shape/paging_chunking/tool_defs` PASS; vitest `citationNav.test.tsx`, `DocumentCantBeOpened.test.tsx` in the green count gate. G-4 row 1 driven (§2.2) |
| 3 | Every tool labelled read-only or not, every error a tool error with a plain sentence, maintenance mode: reads work, starts get a JSON-RPC error with the maintenance sentence, never the HTML 503 (MCP-07) | **VERIFIED** | `mcp/tools.py:34-39` `READ_ONLY` annotations on all three (runtime check here: `readOnlyHint True` x3); `is_read_only` treats a missing hint as NOT read-only (`:52-55`). `server.py:68-87` unknown tool -> `-32602`, catch-all -> `GENERIC_FAILURE_SENTENCE` (never `str(exc)`); `dispatch.py:121-149` grant, maintenance (`MCPError(-32000, MAINTENANCE_SENTENCE)` for non-read-only), limit, validation, each a plain sentence. `middleware/maintenance.py:80-84` allowlists `MCP_PATH` on a segment boundary. Tests: `test_305_maintenance` (both protocol eras, test-registered non-read spec), `test_305_errors`, `test_305_dispatch`, `test_147_maintenance_mw` PASS. G-4 row 3 driven. Note: 305 registers no start-type tool, so the "starts are refused" arm is proven only with a test-only spec — the real start tools arrive in 306 |
| 4 | Every call writes an audit row naming key, tool, outcome; per-key limits with cheap and expensive buckets; over-limit error the model can relay; a search-only session appears in operator spend attributed to org and key (KEY-07, GUARD-02) | **VERIFIED** (one flaky live arm, see Warnings) | `dispatch.py:150-169` one row per call in a shielded, bounded `finally`; `mcp/audit.py` one parameterised asyncpg INSERT, org from the principal, metadata via the 293 `_audit_args` (`api_key_id`, `api_key_label`, `kind: mcp`, `tool`, `outcome`), refusals throttled through `refusal_audit_slot`. `mcp/limits.py` cheap -> `read`, expensive -> `expensive` (`api_key_searches_per_minute`, mig 222 CHECK 1..120 = settings.py 400 = UI clamp); over the limit is an `isError` sentence, never 429. Spend: `usage_sink` + `openai_service.embed_texts` record; `dispatch._write_usage` writes an unmeasured NULL-token row when nothing was measured; `db/rates.py` per_root CTE second leg over `mcp_usage`, key label joined org-constrained. Frontend: `ExpertSpendCard` "MCP · {label}", AdminSpendPage.tsx untouched. Tests re-run: `test_305_audit/limits/usage_sink/spend_cte/settings_knob` PASS; live `test_305_spend_live` (2) PASS, `test_305_audit_concurrency_live` PASS, `test_305_audit_live` — **1 arm flaky** (below). G-4 readbacks: spend `MCP · g4-305-claude-code ▲ Unrated`; over-limit `✕ refused: over the limit: 30 searches a minute` after BUG-261031-03/-04 fixes |
| 5 | Org-admin PII redaction (off by default) masks emails, phones, cards, IBANs and secrets while citations, ids and links work; redactor failure blocks; FP rate and latency measured on real documents (GUARD-03) | **VERIFIED** (MCP half; webhook half deferred to 308) | `services/outbound_guard.py` the one choke point: walks only `RedactableText` fields (by annotation, any depth), ids/links/cursors byte-identical; raise or 2 s deadline -> `WITHHELD`; unreadable switch -> redact; non-model shape -> withheld when on. `dispatch.py:136-145` guard before the only render, `redaction_blocked` audited. Switch: `organizations.pii_redaction_enabled boolean NOT NULL DEFAULT false` (mig 222), read live per call (`db/outbound_policy.py`), written only by the audited `PUT /org/api-keys/pii-redaction`. Read chunks carry a 128-char overlap window. Tests re-run: `test_305_redaction`, `test_305_outbound_guard`, `test_305_guard_unknown_shapes`, `test_305_pii_routes` PASS; live `test_305_pii_switch_live` (4 arms incl. split phone across chunks, withheld + audited, column outside the authenticated UPDATE grant) PASS. Measurement: `evidence/redaction-measurement.txt` + 305-VALIDATION §4 (13.16 M chars; final labelled FP 0% per recognizer; p99 0.749 ms search / 3.030 ms read vs 2,000 ms deadline). G-4 row 2 driven (`[email removed]`, link still opens). Names not covered, stated in `mcpKeyCopy.ts` |

**Score:** 4/5 success criteria verified; SC#1 partial pending the operator-owed client/topology rows.

### Requirements Coverage

| Requirement | Source plan | Status | Evidence |
|-------------|-------------|--------|----------|
| MCP-01 | 305-01 | NEEDS HUMAN (local SATISFIED) | SC#1 row. Cursor / cloud / one-box owed (D-43) |
| MCP-02 | 305-02 | SATISFIED | SC#2 row (passages, title, citation, link, external marker) |
| MCP-03 | 305-02 | SATISFIED | SC#2 row (paging, 8k chunks, one refusal) |
| MCP-07 | 305-01 | SATISFIED | SC#3 row |
| KEY-07 | 305-03 | SATISFIED | SC#4 row (audit + two buckets) |
| GUARD-02 | 305-03 | SATISFIED | SC#4 row (spend leg, org + key) |
| GUARD-03 | 305-04 | SATISFIED for MCP results; webhook payloads DEFERRED to Phase 308 SC#1 | SC#5 row |

No orphaned requirement: REQUIREMENTS.md maps exactly these seven ids to Phase 305 and every one is claimed by a plan.

### PLAN must_haves spot-checked against code

All four plans' `must_haves.truths` were read against the code; none contradicted. Specifically confirmed: `_TOOL_REGISTRY` = 30 (runtime); `threads.py`, `agent_loop.py`, `provider_gateway/dispatcher.py`, `config.py`, `frontend/src/lib/api.ts`, `AdminSpendPage.tsx`, `tool_dispatcher.py` have an EMPTY diff vs base; `main.py` is +1 import / +1 register / the yield wrapped (D-04); mig 222 has RLS on, no policy, REVOKE from PUBLIC/anon/authenticated, no SECURITY DEFINER, and its header states the 220 -> 221 -> 222 paste order + `get_advisors(security)` (D-39/D-40); `backend/Dockerfile` CMD carries `--timeout-graceful-shutdown 5`, compose `stop_grace_period: 20s` (D-48); exact pins `mcp==2.3.0`, `mcp-types==2.3.0`, `httpx2==2.16.0`, `httpcore2==2.16.0`, `sse-starlette==3.0.3`; httpx2 provenance approved by the operator before install (`evidence/deps-provenance.txt`).

### Gate verdicts (re-derived here, verbatim)

- **Vitest count gate** (repo root, `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`): `total 13698  ·  failed 0  ·  pinned total 12658` / `count gate OK — 594/594 pinned files present, no per-file decrease, 0 failing.` (exit 0)
- **tsc** (`cd frontend && npx tsc -p tsconfig.app.json --noEmit`): **61 errors = base 61**, across 27 files. Set diff by file: the only two error-bearing files 305 touched are `src/pages/LibraryPage.tsx` (2 x TS6133, line 59 `TabsList`/`TabsTrigger` — an import line 305 did not change) and none other; 305's added lines carry 0 errors. No error moved.
- **Hot-file ledger** (`node scripts/check-hot-file-ledger.cjs .planning/phases/305-connect-claude-code-and-cursor`): `scan list: 804 rows · subject: 133 files · watched: 54` / `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size** (`node scripts/check-claude-md-size.cjs`): `CLAUDE.md                                  108220 chars   72.1% of limit  headroom   41780  [OK]` / `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Deploy drift** (`bash scripts/check-deploy-drift.sh`): `RESULT: PASS — the one-box deploy artifacts are in sync.` (2 non-blocking WARNs: mig 215/216/218 seed-like statements; docker compose unavailable, structural fallback)
- **Seeds register** (`node scripts/check-seeds-register.cjs`): `seeds register gate OK — 404/404 parsed, 0 duplicate ids, 404/404 carry all 5 required keys.` (`unswept:  130 carry no trigger_when at all · 113 carry prose but no structured trigger`). `--phase 305` sweep: `[trigger-fires] SEED-397 (status: planted)`.
- **G-7** (`node scripts/check-gap-closure-rounds.cjs 305`): `plans: 4 total · 0 gap-closure` / `G-7 clear — no gap-closure plans in this phase.` G-8: 4 plans (within 3-5).
- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock): `70 failed, 11373 passed, 1 skipped, 2 xfailed, 2 xpassed, 59 warnings in 580.05s (0:09:40)` / `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` (exit 0) — 0 of the 70 `FAILED` ids contain `305`, `293`, `304`, `mcp`, `pii`, `redact`, `outbound` or `261031`.
- **Targeted backend, re-run here under the lock:** `pytest tests/unit -k "305 or bug_261031 or test_259 or test_304_acting_reads_fence or test_293_api_keys_routes"` -> `537 passed`. Live `tests/integration/test_305_*.py`: run A `1 failed, 53 passed` (the flaky arm below), all other 53 green incl. two-worker, refusals, tools, narrowed, pii switch, spend, schema privileges, graceful shutdown, search-pool deadlock, audit concurrency; no skips. `test_059_disconnect` 2 failed = **INHERITED** (asyncpg `ForeignKeyViolationError runs_thread_id_fkey`; identical before/after the bump in `evidence/sse-revalidation.txt`, 49 = 49).

### Data-flow trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `search_knowledge_base` | passages | `acting_member_reads.search` -> `retrieval_service.search_documents` on the acting connection | yes (G4-1: 3 passages from the operator corpus) | FLOWING |
| Key card activity | MCP calls | `audit_log` rows -> `list_key_calls` -> `_call_from_audit` | yes (G4-3, over-limit readback) | FLOWING |
| Spend ledger MCP row | usage | `mcp_usage` -> `per_root` CTE second leg | yes (`MCP · g4-305-claude-code`, 7 tokens) | FLOWING |
| `OrgPiiRedactionCard` | switch | `GET/PUT /org/api-keys/pii-redaction` -> `organizations.pii_redaction_enabled` | yes (G4-2 audit rows on/off) | FLOWING |

### Anti-patterns

`git diff 43e95f6b5 HEAD` over `backend/app`, `frontend/src`, `scripts`, `supabase/migrations`: no `TBD` / `FIXME` / `XXX` in any modified file, and no added line carries `TODO` / `HACK`. No stub return on a user-visible path (every handler reads through `acting_member_reads`; empty results are real empty pages).

### Warnings (do not block the goal; recorded for the operator)

1. **Flaky live must-have arm.** `test_305_audit_live::test_an_over_limit_search_is_refused_audited_and_reads_as_not_ok` failed in 2 of 3 full-set runs here (`assert second.is_error` -> the second search answered with 4 passages, i.e. the `api_key_searches_per_minute = 1` written to `app_settings` was not the limit in force) and passed 8/8 alone, paired with each preceding live suite, and with every 305 module collected. Root cause not determined (load-sensitive: the runs overlapped the vitest gate; the test sets the knob by SQL + `invalidate_settings_cache()` and relies on the next async settings read reaching the DB). The behaviour itself was driven live (G-4 over-limit readback, 2 refusals / 32). The test file is unchanged since 305-03.
2. **Two post-review fixes were never reviewed.** `305-REVIEW.md` (to `e456f4af3`), `305-REVIEW-04.md` (to `44fb3f9ff`) and `305-SECURITY.md` (`audited_at_head: 5a7f6aad4`) all predate `554fe5235` (BUG-261031-03: `retrieval_tuning.get_server_ef_search` reads `pg_settings.reset_val` on the held in-transaction connection) and `d4aacad2e` (BUG-261031-04: the MCP audit row is now a raw asyncpg INSERT on the service-role pool instead of `audit_key_call_now`). Read here: org comes from the principal, the INSERT is parameterised, it writes the same three columns `write_audit_entry` writes; no defect found — but no review pass covers them.
3. **D-44's stated reason is narrower than the final diff.** "No agent, streaming or provider-routing path touched" was written before `554fe5235`. That fix changes the ef_search probe that every `_call_as_user` search uses, including the chat agent loop's (`agent_loop.py:1635`), and `embed_texts` gained one `usage_sink.record` line. Both are provider-independent, so the 8-provider scoreboard still does not apply; the new probe was driven live by the 30-call MCP burst through the same `_call_as_user`. No chat-with-search message was driven after `554fe5235` (the chat-stream readback predates it and used no tool).
4. **Stale prose in phase records** (contradicted by the same files' later sections): `305-VALIDATION.md` frontmatter `status: owed` and line 17 "Nothing in §2 or §3 has been run yet" vs the §2.2 PASS results; `305-SECURITY.md:201` "Approval: not verified. One BLOCKER (T-305-SC)" vs frontmatter `status: verified` / `open: 0`; `305-VALIDATION.md §1` labels the "Open in Syrel address" as MCP-03 (it is MCP-02's) and groups MCP-07 with the 305-03 audit suites (MCP-07 is proven by 305-01's maintenance/errors/dispatch suites).
5. **G-4 rows driven with substitutions,** honestly recorded: G4-1's non-member arm used a foreign-org document under the same login, not a second account on the same link; G4-2's band pulse was not observed; the chat-stream console read began after the stream.
6. **SEED-397 / AR-01** (per-address `mcp_ip` bucket keys on the proxy's address — one door-wide 1,200/min counter behind Traefik/nginx). Accepted residual; the seed's trigger "opens the MCP door to a paying org" will be met by the 304+305 production deploy with `mcp_enabled` on — decide before that deploy.
7. Open review INFO items `IN-04-01/02/04/05/06` and `IN-04` (305-01..03) left open by decision.

### Owed to the operator (recorded as decisions, not claimed) — confirmed

`305-VALIDATION.md §3` lists Cursor, the deployed two-worker cloud container, the one-box and Claude Desktop via the labelled `mcp-remote` bridge as OWED with why and what to run; none is claimed as passed anywhere in the SUMMARYs or VALIDATION. §7 lists the deploy-together items (220 -> 221 -> 222 cloud paste each approved, `get_advisors(security)`, 304 D-41 tier confirmation, `BACKEND_PUBLIC_URL` https, Coolify stop grace > 5 s).

### SUMMARY claims vs code

No SUMMARY claim was contradicted by the code. Gate figures quoted in VALIDATION §8 were re-derived: vitest now `13698 / 12658` (VALIDATION recorded `13697 / 12657` — one more test since, still 0 failing); tsc 61 = 61; ledger, size, drift, seeds verdicts match.

### Gaps Summary

No success criterion is FAILED and no must-have is contradicted by the code. The phase goal is achieved on local with a real Claude Code client. What remains is (a) the operator-owed client/topology rows that SC#1 names explicitly (Cursor, cloud two-worker container, one-box; Claude Desktop bridge), (b) two review "requires human verification" decisions and the G4-1 second-account arm, and (c) the warnings above — most importantly the flaky over-limit live arm and the two unreviewed post-review fixes.

---

_Verified: 2026-10-31_
_Verifier: Claude (gsd-verifier), self-verified_
