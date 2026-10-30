---
phase: 304
slug: personal-mcp-keys-that-act-as-you
status: owed  # 2026-10-31: automated gates recorded below; the three G-4 rows are OWED to verification (Claude drives Chrome after the merge)
created: 2026-10-31
nyquist_validation: false   # config.json; this file holds the G-4 rows and the gate record
independent_review: self
---

# Phase 304 — Validation: automated map, G-4 lived experience, gate record, owed operator items

The automated tests live in the plans (`304-01` … `304-06`). This file holds what code cannot prove: the
three operator-recognisable G-4 scenarios set at scope time (304-UI-SPEC §"Lived-experience (G-4) rows"),
the D-15 gate record, and the operator items owed before deploy. **Every G-4 row below is OWED — Claude
drives it in Chrome after the merge.** A row may be blocked (⛔ with the reason and the blocking id), but
never silently omitted.

## 1. Automated coverage (where each requirement is proven in code)

| Req | Proven by | Plan |
|-----|-----------|------|
| KEY-01 (mint an MCP key, see the secret once) | `test_304_api_keys_routes.py`; `ApiKeysTab.test.tsx` (show-once, secret absent from the DOM after save, never in storage), `McpConnectSnippets.test.tsx`, `mcpSnippets.test.ts` | 304-04, 304-05 |
| KEY-02 (the key acts as its owner in one org, never more) | `test_304_acting_org_rls_live.py` (13 passed, 0 skipped, two counterfactuals), `test_304_two_org_parity_live.py` + `test_304_narrowed_key_live.py` (D-15 gate 3: 50 passed, 0 skipped), `explain-acting-org.py` (GATE PASSED) | 304-01, 304-03 |
| KEY-03 (tools and folders narrow the key) | `test_304_key_scope.py`, `test_304_tool_catalogue.py`, `test_304_acting_reads_fence.py`; `mcpKeyFacts.test.ts`, `KeyFoldersField.test.tsx`, `McpKeyFields.test.tsx` | 304-02, 304-03, 304-05 |
| KEY-04 (refusals in words, server-side) | `test_304_resolver_kind.py`, `test_304_api_keys_routes.py` (D-07 expiry, D-08 empty folders, unknown tool, foreign folder); `apiKeyFacts.test.ts` (every audited refusal reason worded) | 304-02, 304-04, 304-05 |
| KEY-05 (the MCP key card and revoke) | `ApiKeyCard.test.tsx`, `RevokeApiKeySheet.test.tsx`, `test_304_principal_liveness.py` (revoke/expiry/membership/ban refused on the next call) | 304-02, 304-05 |
| KEY-06 (org admin and operator switches) | `test_304_mcp_switches_routes.py` (PUT writes one `settings.update` + `mcp_access` row; 403/404/422/500 arms); `OrgMcpSwitchCard.test.tsx`, `OrgAdminShell.test.tsx` (pulse + org-keyed remount), `OrgApiKeysTab.test.tsx` (admin notice), `OrgAuditTab.test.tsx` (on/off words), `CapabilityGrid.mcp.test.tsx`, `McpOffNotice.test.tsx` | 304-04, 304-05, 304-06 |

## 2. G-4 lived-experience scenarios (304-UI-SPEC, set at scope time — Claude drives Chrome after merge)

The dev account is in TWO orgs — prove the active org first. Each row carries its own evidence (a DOM read
plus a screenshot where the tab allows it, and the DB row where one is named); one row's evidence never
stands in for another's. Row 1 runs first.

| Row | Steps | Passes when | Verdict | Evidence needed |
|-----|-------|-------------|---------|-----------------|
| **G4-1 Mint, see once, reload, gone** (run first) | Settings → API keys → New key → "For an AI tool (MCP)" → keep the defaults → Create key. Read the show-once card. Click "I've saved the secret", then reload. | The show-once card shows the secret, and the Claude Code snippet reads `SYREL_MCP_KEY` with no secret in it. After the reload the card shows `● active`, "Read only", "All folders", "Not used yet" and a 90-day expiry, and the secret appears nowhere in the DOM. | OWED | DOM read of the show-once card (snippet text, no `srl_mcp_` inside it); DOM read after reload (`document.body.textContent` has no secret); screenshot; the `api_keys` row (`kind='mcp'`, `folder_ids` NULL, `tools` = the Read only set, `expires_at` ≈ +90 days). |
| **G4-2 Empty folder set refused in words** | New key → AI tool → "Only these folders" and tick none. Then force a POST with `folder_ids: []`. | "Create key" is disabled and reads "Tick at least one folder, or choose All folders I can see." The forced POST returns 422, and its sentence renders in the failure line with the label, preset and expiry kept. | OWED | DOM read of the disabled button and its description; the 422 response body; DOM read of the failure line with the choices still set; screenshot. |
| **G4-3 Admin switches MCP off** | As org admin: Org admin → Settings → switch "AI tool access (MCP)" off. Open Audit. Open Org admin → API keys. Then as the member: Settings → API keys, and New key. | The well turns armed ("off for {org}" + the impact line), the band's "every action recorded" marker pulses, and the Audit tab shows "Switched AI tool access (MCP) off for the organisation". The admin key list shows "MCP access is switched off for {org}. Every member's AI tool key is refused until you switch it back on in the Settings tab." The member's key card reads `⏸ switched off` with the org sentence, and the MCP tile in a new draft is disabled with the same sentence. Switching back on restores the card. | OWED | DOM reads of the armed well, the band marker class during the pulse, the audit row text, the admin notice, the member card tag + sentence, the disabled tile; the `audit_log` row (`action_type='settings.update'`, `metadata.event='mcp_access'`, `metadata.enabled=false`, the active `org_id`); the `organizations.mcp_enabled` value before and after. |

## 3. Four-axis UAT — does not apply

304 touches no agent loop, provider routing, streaming or chat UI state (304-RESEARCH §Project Constraints):
the MCP server that consumes these keys is Phase 305. The CLAUDE.md "UAT scoreboard recipe" four-axis board
therefore has no rows here. It applies to 305, whose tools put questions to the agent.

## 4. Gate record

### D-15 (the phase's own gates)

- **Gate 1 — EXPLAIN** (`scripts/explain-acting-org.py`, 304-01, `evidence/explain-acting-org.txt`):
  ```
  VERDICT: A == B for all 12 statements: True; every current_user_org_ids() node loops=1 (or never executed), never per row: True; function unchanged: True
  GATE PASSED
  ```
- **Gate 2 — backend baseline after the migrations** (304-01): `70 failed, 10778 passed, 1 skipped, 2 xfailed, 2 xpassed` · `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).`
- **Gate 3 — two-org parity** (304-03, `evidence/parity-gate3.txt`): `50 passed, 67 warnings in 100.97s` — 0 skipped, exit 0.

### Phase close (304-06, run once)

Run in the 304-06 worktree on 2026-10-31 (base `16a90f4cb`, waves 1-3 merged). Verdict lines verbatim.

- **Backend unit baseline (D-43)** — `node scripts/check-backend-unit-baseline.cjs`, under the noclobber
  local-DB lock (released after):
  ```
  Summary:        70 failed, 10946 passed, 1 skipped, 2 xfailed, 2 xpassed, 58 warnings in 664.74s (0:11:04)
  [GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
  ```
  70 = the count every 304 plan measured, and the count research measured before the phase.
- **Vitest count gate** — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root.
  Before the 304-06 pins (304-05's `OrgApiKeysTab` red cleared by Task 1):
  ```
  total 13517  ·  failed 0  ·  pinned total 12427
  count gate OK — 580/580 pinned files present, no per-file decrease, 0 failing.
  ```
  After the nine new pins and nine raises (the verdict that stands):
  ```
  total 13614  ·  failed 0  ·  pinned total 12574
  count gate OK — 589/589 pinned files present, no per-file decrease, 0 failing.
  ```
- **Frontend typecheck** — `npx tsc -p tsconfig.app.json --noEmit`, set diff (file + code + message, line
  numbers stripped) against the base re-derived in a throwaway worktree at `16a90f4cb`: **61 `error TS` lines
  at base, 61 at HEAD, 0 new, 0 gone.** None is in a 304 file.
- **Hot-file ledger** — `node scripts/check-hot-file-ledger.cjs .planning/phases/304-personal-mcp-keys-that-act-as-you`:
  ```
  scan list: 783 rows · subject: 86 files · watched: 40
  ledger gate OK — every watched file has a row.
  ```
- **CLAUDE.md size** — `node scripts/check-claude-md-size.cjs`:
  ```
  CLAUDE.md                                  106733 chars   71.2% of limit  headroom   43267  [OK]
  claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
  ```
- **Seeds register** — `node scripts/check-seeds-register.cjs --phase 304` (the re-run CONTEXT §Seeds asked for):
  ```
  register: 403 files · parsed: 403 · skipped: 0 · duplicate ids: 0
  unswept:  130 carry no trigger_when at all · 113 carry prose but no structured trigger
  seeds register gate OK — 403/403 parsed, 0 duplicate ids, 403/403 carry all 5 required keys.
  ```
  23 seeds matched the phase's `files_modified` by path (the phase declares no surfaces, so
  `trigger_surfaces` matched nothing — a fact about the phase, not the register). The two unswept figures
  are reported separately, never summed.

## 5. Owed operator items (before 304 + 305 deploy)

1. **G-4 rows 1-3** above — Claude drives them at verification, row 1 first.
2. **D-41 — tier-gate confirmation (TIER-02, a pricing one-way door).** 304-04 runs the `workflows`
   entitlement check for workflow keys only, so an MCP key has no tier gate. The operator confirms that is
   intended before 304 + 305 deploy.
3. **Cloud migrations 220 and 221 (D-30, D-33).** Paste each into the cloud Supabase SQL editor with
   **per-action operator approval** (CLAUDE.md "Supabase MCP — WRITES ARE APPROVAL-GATED"), then run
   `get_advisors(security)` and read it before the push. 304 deploys **together with 305** (D-30): with no
   MCP server live, a minted key would have nothing to call.
4. **BUG-261031-01 (deferred-items F-1).** An `anon`-role call to `current_user_org_ids()` crashed a local
   Postgres backend during 304-01. Not established whether it predates 221. Reproduce on a disposable
   Postgres (never the shared stack, never production) before the cloud paste. ⛔ Never make a role-anon call
   to `current_user_org_ids()` on the shared local stack.
