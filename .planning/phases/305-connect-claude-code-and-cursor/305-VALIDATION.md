---
phase: 305
slug: connect-claude-code-and-cursor
status: owed  # 2026-10-31: automated gates recorded below; the three G-4 rows, the must-have readback and the post-bump chat stream are OWED to verification (Claude drives them after the merge); four client rows are OWED to the operator
created: 2026-10-31
nyquist_validation: false   # config.json; this file holds the G-4 rows, the measurements and the gate record
independent_review: self
---

# Phase 305 — Validation: automated map, G-4 lived experience, measurements, gate record, owed items

The automated tests live in the plans (`305-01` … `305-04`). This file holds what code cannot prove: the
three operator-recognisable G-4 scenarios set at scope time (305-CONTEXT **D-42**, 305-UI-SPEC
§"Lived-experience (G-4) rows"), the redactor measurement (D-38), the client-timeout measurement for 306
(D-43 / D-57), the gate record (D-45), and the items owed to the operator (D-40 / D-43).

**Nothing in §2 or §3 has been run yet. Every row there is OWED — Claude drives it after the merge.** A row
may be blocked (⛔ with the reason), but never silently omitted.

## 1. Automated coverage (where each requirement is proven in code)

| Req | Proven by | Plan |
|-----|-----------|------|
| MCP-01 (an AI tool connects to `/mcp` with a personal key; stateless, two workers) | `test_305_transport.py`, `test_305_edge_refusals.py`, `test_305_mount_predicate.py`, `test_305_lifespan_reentry.py`; live `test_305_two_worker_stateless.py` (both worker PIDs served `POST /mcp`), `test_305_refusals_live.py` (one 401 body for every credential failure) | 305-01 |
| MCP-02 (search, list, read as the member, narrowed by the key) | `test_305_search_shape.py`, `test_305_paging_chunking.py`, `test_305_tool_defs.py`; live `test_305_tools_live.py` (D-16: seven unavailable cases, ONE byte-identical body), `test_305_narrowed_tools_live.py` | 305-02 |
| MCP-03 (the "Open in Syrel" address) | `citationNav.test.tsx`, `DocumentCantBeOpened.test.tsx`, `test_305_tools_live.py` (links) | 305-02 |
| MCP-07 / KEY-07 / GUARD-02 (audit, limits, spend) | `test_305_audit.py`, `test_305_limits.py`, `test_305_usage_sink.py`, `test_305_spend_cte.py`, `test_305_settings_knob.py`; live `test_305_audit_live.py`, `test_305_spend_live.py` | 305-03 |
| **GUARD-03** (org-admin PII redaction, off by default; masks without breaking ids; blocks on failure; names not covered) | `test_305_redaction.py` (every positive case masked with its exact mask, every negative byte-identical, ordered spans, 8k chunk < 20 ms) + `fixtures/phase305/redaction_cases.json`; `test_305_outbound_guard.py` (off -> same object; only `RedactableText` rewritten; overlap window masks a split phone / email / IBAN in both chunks; raise and deadline -> withheld; unreadable switch -> redact); `test_305_pii_routes.py` (admin wall, audit after write, 422/404/5xx with no row; guard before the one render; live read per call; `redaction_blocked`); live `test_305_pii_switch_live.py` (masks in `structuredContent` AND text, document id + link unchanged and `read_document` still answers, a phone split by the read boundary masked in both chunks with the cursor still paging, withheld arm audited `redaction_blocked`, column outside the `authenticated` UPDATE grant); `OrgPiiRedactionCard.test.tsx`, `OrgAuditTab.test.tsx`, `apiKeysContract.test.ts` | 305-04 |

## 2. G-4 lived-experience scenarios (D-42 — Claude drives these after the merge)

Verbatim from 305-UI-SPEC §"Lived-experience (G-4) rows". The dev account is in TWO orgs — prove the active
org first. Each row carries its own evidence; one row's evidence never stands in for another's. **Row 1 runs
first.**

| Row | Scenario (verbatim) | Evidence it needs | Verdict |
|-----|---------------------|-------------------|---------|
| **G4-1 Claude Code, search, open** (run first) | A real `claude` CLI session with the key from `SYREL_MCP_KEY` lists the three tools and runs a search; passages carry titles and an **Open in Syrel** link; opening the link in Chrome shows the Library with **that document's detail panel open**. Then, as a second account that is not a member of the org, the same link shows **This document can't be opened** and no panel. | A SEPARATE `claude` CLI process configured with the key from `SYREL_MCP_KEY` (its `tools/list` + one search transcript, secret never printed); Chrome MCP DOM read + screenshot of the open panel; the same link as the non-member (DOM: the refusal heading, no panel); the `audit_log` `api_key.read` row for the search. | OWED |
| **G4-2 Redaction on** | An org admin turns **Remove personal data from AI tool results** on in Org admin → Settings: the tag reads `on for {org}`, the band pulses, and Org admin → Audit shows **Turned personal data removal for AI tools on for the organisation**. The same search now returns `[email removed]` where the email was, and its link still opens the document. | Chrome MCP DOM + screenshot of the card ON (tag) and of the Audit row; the `audit_log` `settings.update` row with `metadata.event = 'pii_redaction'`; the `claude` CLI search transcript before/after showing the mask; the link opened in Chrome. Turn the switch back OFF afterwards (and record that row too). | OWED |
| **G4-3 Maintenance on, reads still work** | With maintenance on in the Control Room the search still answers, the key card's **last used** moved, and its call strip / **Show activity** show the call as `search_knowledge_base · ✓ answered`. | Control Room maintenance ON (DOM); the `claude` CLI search answering; the key card's Last used before/after (DOM); Show activity row (DOM + screenshot); the `audit_log` `api_key.read` row and the `mcp_usage` row for that call. Maintenance OFF afterwards. | OWED |

### 2.1 Also driven at verification (not G-4 rows; must-have readbacks)

| Item | What to drive | Passes when | Verdict |
|------|---------------|-------------|---------|
| Over-limit readback (305-03) | Set the searches knob low (or force one over-limit search) from the `claude` CLI | The key's activity row reads **✕ refused: over the limit: {N} searches a minute**, its bar is the tall refused bar, nothing on the card reads `✓` for it | OWED |
| Spend readback (305-03) | Admin → Spend after a search-only session | The rows show **MCP · {label}** and, with no embedding rate, **▲ Unrated** | OWED |
| Post-bump chat stream (305-01, D-01 "driven, not assumed") | One ordinary chat message streamed in Chrome after the `sse-starlette` 3.0.3 / `mcp` 2.x bump | Tokens stream to completion, the run card settles, no console error | OWED |

## 3. Owed to the operator (D-43 — recorded, not claimed)

| Row | Why it cannot be driven here | What the operator runs |
|-----|------------------------------|------------------------|
| **Cursor** | Installed locally, but there is no CLI to drive it | Add the key to Cursor's MCP settings; list tools, run one search, open one link; note any call that runs past ~60 s (see §5) |
| **The deployed two-worker cloud container** | Needs the 304+305 deploy | After deploy: one `claude` CLI search against the cloud `/mcp` URL; confirm `BACKEND_PUBLIC_URL` is the https public address (A1) |
| **The one-box** | Needs a one-box deploy | Same search through the one-box nginx (`Host` without a port) |
| **Claude Desktop via the labelled `mcp-remote` bridge** | A desktop client, no CLI | Configure the bridge with the key in `env`, list tools, run one search |

## 4. Measurement — the PII redactor on the real corpus (D-38)

Full record: `evidence/redaction-measurement.txt` (aggregates only; samples and labels were written as shapes
to a scratch file outside the repository and never committed). Script: `scripts/measure-redaction.py`
(read-only). Corpus: 10,279 search chunks + 872 read chunks (latest `full_markdown`, 8,000-char chunks + the
128-char window) = 13,161,950 characters.

| Recognizer | Run 1 labelled FP | Run 3 (ships) hits search / read | Run 3 labelled FP |
|------------|-------------------|----------------------------------|-------------------|
| Email | 0/30 (0%) | 129 / 93 | 0/30 (0%) |
| Phone | **4/19 (21.1%) OVER** — decimals and a UUID group read as `00` numbers | 15 / 13 | 0/15 (0%) |
| Card | no hits (487 raw candidates) | 0 / 0 | no hits (fixture-proven) |
| IBAN | 0/2 (0%) | 2 / 1 | 0/2 (0%) |
| Secret / entropy | **30/30 (100%) OVER** — link tracking tokens; run 2 still **9/18 (50%)** | 9 / 9 | 0/9 (0%) — all JWTs |

Two tightenings, each test-first (`db1a0c5d5`, `a843c9a9b` RED -> `91964a07e`), both within D-56: the
`+`/`00` form must start a token; entropy skips tokens in links, path-shaped tokens, blobs over 128 chars,
`?`/`&` query parameters and percent-encoded neighbours, and judges `NAME=value` on the value.

Latency per unit, `DeterministicRedactor.spans()` incl. the window (ms): search p50 0.259 · p95 0.439 · p99
0.749 · max 4.245; read p50 2.026 · p95 2.799 · p99 3.030 · max 4.001. Against a 2,000 ms deadline.

## 5. Measurement — client timeouts, recorded for Phase 306 (D-43 / D-57, R-26)

Full record: `evidence/client-timeouts.txt`. Probe: `scripts/mcp-timeout-probe.py` (standalone, never imported
by `backend/app`), driven with the installed **Claude Code 2.1.312** via `claude -p --strict-mcp-config
--mcp-config <scratch>/probe.json --allowedTools mcp__probe__wait_seconds`.

| Wait | Default environment | With `MCP_TOOL_TIMEOUT=600000` |
|------|-------------------------|--------------------------------|
| 30 s | **answered** (wall 42.8 s) | — |
| 90 s | **aborted** ~60 s after the call started — "The operation timed out." (wall 69.3 s) | **answered** (wall 100.5 s) |
| 150 s | **aborted** ~60 s in (wall 76.5 s) | **answered** (wall 162.5 s), in the foreground — no backgrounding in `claude -p` |
| 310 s | **aborted** ~60 s in (wall 77.0 s) | **aborted at 300 s**: "…sent no response or progress for 300s; aborting…" (wall 318.4 s) |

Control: the same probe server answered a 90 s call to a plain `httpx` client in 90.0 s, so the ~60 s limit is
the client's, not the server's (the server ran every abandoned call to completion). **Documented vs measured:**
the docs say `MCP_TOOL_TIMEOUT` defaults to ~28 h; on 2.1.312 a silent call is cut at ~60 s unless the member
raises it, and then the documented 5-minute idle ceiling holds exactly. **For 306:** a tool that can run past
~60 s must answer at once and let the caller poll (or stream progress) — never hold one silent JSON response
open. Cursor, the cloud container, the one-box and Claude Desktop are owed (§3).

## 6. D-44 — the 8-provider cross-provider scoreboard does not apply (a decision, not an omission)

No agent, streaming or provider-routing path is touched by 305: the three MCP tools search (one query
embedding), list and read; nothing generates. The CLAUDE.md UAT roster rule applies to phases that touch
streaming, the agent loop, provider routing or UI state of a run — none of which 305 changes. The only
streaming-adjacent change is the `sse-starlette` bump, which §2.1's chat-stream drive covers. **306 runs the
full 8-row board.**

## 7. D-40 — deploy together, owed to the operator, in order

304 and 305 deploy together; 305 does not deploy itself. Before / at that operator-triggered deploy:

1. Cloud Supabase: paste **220 → 221 → 222**, each under its own explicit approval (never `db push`).
2. Then `get_advisors(security)` on the cloud project (BUG-260911-01 class).
3. Operator confirms **304 D-41** (no tier gate on MCP keys — TIER-02, a pricing one-way door).
4. Coolify: `BACKEND_PUBLIC_URL` is the **https** public address (A1) — otherwise `/mcp` is not mounted in
   production and the key screen shows no connection address.
5. Coolify: the backend's **stop grace** exceeds the 5 s `--timeout-graceful-shutdown` (A7; 20 s recommended).

## 8. Gate record (D-45)

- **Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock): `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` Summary: `70 failed, 11291 passed, 1 skipped, 2 xfailed, 2 xpassed, 61 warnings in 703.92s (0:11:43)`. 70 = the measured base (305-03's final run read 70); no failing id contains `305`, `293`, `304`, `mcp`, `pii`, `redact` or `outbound` (grep over the 70 `FAILED` lines = 0).
- **Vitest count gate** (repo root, `GSD_VITEST_MAX_WORKERS=2`):
  - Run 1 (shared the machine with the backend baseline and two Claude Code probe processes): `total 13697 · failed 1 · pinned total 12657` / `FAIL [failing-tests] 1 test(s) failed — the gate requires 0.` Captured from the gate's own persisted JSON before any re-run: `src/pages/WorkflowBuilderPage.canvas.test.tsx` › "WorkflowBuilderPage 184-13 — the undo/redo keys (D-184-04) but a NEW act still gets its message — the clear is not indiscriminate", `STACK_TRACE_ERROR` at **5087 ms** (the 5 s test timeout). That file, `WorkflowBuilderPage.tsx` and `components/workflows/` are **provably unmodified** by this plan (`git diff --numstat e456f4af3 HEAD` and `git status --short` on them: empty). One green sample of a timeout-bound suite is not proof of innocence; it is recorded as a load-sensitive timeout on a byte-unchanged suite, not as fine.
  - Run 2 (no other load): `total 13697 · failed 0 · pinned total 12657` / `count gate OK — 594/594 pinned files present, no per-file decrease, 0 failing.` Per-file: `OrgAuditTab.test.tsx 26/26`, `apiKeysContract.test.ts 11/11`, `OrgPiiRedactionCard.test.tsx 9/9` (first pin, FILE-LEVEL target).
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): **61 errors = base 61**, across 27 files, none of which 305-04 touched (the plan's frontend files have 0). Set diff by file: no error in a changed file and an equal total, so no error moved.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/305-connect-claude-code-and-cursor`: `ledger gate OK — every watched file has a row.` (`scan list: 804 rows · subject: 133 files · watched: 54`)
- `node scripts/check-claude-md-size.cjs`: `CLAUDE.md 108220 chars 72.1% of limit headroom 41780 [OK]` / `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- `node scripts/check-seeds-register.cjs --phase 305`: `seeds register gate OK — 403/403 parsed, 0 duplicate ids, 403/403 carry all 5 required keys.` (`trigger sweep — phase 305 (4 plan file(s), 133 path(s) in files_modified)`: 34 seeds' `trigger_paths` match 305 paths — routing input for verification, none folded here; `unswept: 130 carry no trigger_when at all · 113 carry prose but no structured trigger`.)
- `bash scripts/check-deploy-drift.sh`: `RESULT: PASS — the one-box deploy artifacts are in sync.` (2 non-blocking WARNs: migrations 215/216/218 seed-like statements for human review; docker compose unavailable here, structural fallback.)
- OpenAPI: `test_276_*` 71 passed after regenerating the snapshot + public spec for `/org/api-keys/pii-redaction`.
- Targeted backend (under the lock): `test_305_pii_routes`, `test_304_mcp_switches_routes`, `test_293_api_keys_routes`, every `test_305_*` unit suite, live `test_305_pii_switch_live`, `test_305_tools_live`, `test_305_narrowed_tools_live`, `test_305_audit_live`, `test_305_refusals_live`, `test_305_spend_live`: **383 passed**, no skip; `test_305_two_worker_stateless` + `test_304_narrowed_key_live`: 13 passed.
- Targeted frontend: `src/components/org` + `src/components/settings/apiKeys`: **445 passed** (32 files).
- Acceptance greps: no presidio/spacy/google.cloud/boto import (0); `backend/requirements.txt` unchanged; `NAMES ARE NOT COVERED` present; the `WITHHELD_SENTENCE = "…"` line = 1; `outbound_guard.guard(` in dispatch = 1, before the only `_results.render(`; `"event": "pii_redaction"` in api_keys.py = 1; `main.py`, `db/api_keys.py`, `audit_service.py` unchanged; OrgSettingsTab `+` lines = 3; OrgAdminShell / SettingsPage / CapabilityGrid unchanged; `Names are not covered.` = 1 and `[email removed]` = 1 in mcpKeyCopy.ts; no email shape in the redaction evidence (0); the probe is not referenced under `backend/app`; no `| 0 / 0 / 0 |` row left for the 305 files. `threads.py`, `agent_loop.py`, `provider_gateway/dispatcher.py`, `frontend/src/lib/api.ts`, `config.py`, `AdminSpendPage.tsx` untouched; chat `_TOOL_REGISTRY` untouched (30); no migration.
