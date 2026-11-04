---
phase: 305-connect-claude-code-and-cursor
plan: 04
subsystem: mcp-outbound-guard
tags: [mcp, pii-redaction, outbound-guard, org-admin, measurement, validation]
requires:
  - "305-02: RedactableText on the result models; render() from the model; read_document's chunker"
  - "305-03: dispatch's one-audit-row pipeline with the redaction_blocked outcome worded; the harness"
  - "mig 222 applied locally: organizations.pii_redaction_enabled (off by default, outside the authenticated UPDATE grant)"
provides:
  - "services/outbound_guard.py: the ONE outbound choke point (Redactor protocol, RedactableText walker, overlap window, 2 s deadline, fail closed) — 308 reuses it"
  - "services/pii_redactor.py: DeterministicRedactor (email, phone, card, IBAN, secrets, entropy), measured on the real corpus"
  - "db/outbound_policy.py + GET/PUT /org/api-keys/pii-redaction (require_org_manage, audited settings.update + pii_redaction)"
  - "frontend: OrgPiiRedactionCard under OrgMcpSwitchCard; OrgAuditTab reads the event"
  - "scripts/measure-redaction.py (read-only) and scripts/mcp-timeout-probe.py (standalone)"
  - "305-VALIDATION.md: G-4 rows, owed operator rows, the D-38 and D-43 measurements, the D-44 decision, the D-40 list, the gate record"
affects: [306, 308]
tech-stack:
  added: []
  patterns:
    - "walk a Pydantic model by Annotated metadata identity (REDACTABLE), never by field name or pattern"
    - "a read chunk's overlap window travels as a Pydantic PrivateAttr — never serialised, never in the outputSchema"
    - "label real-corpus samples as SHAPES (letters a/A, digits 9) in a scratch file outside the repo; commit aggregates only"
key-files:
  created:
    - backend/app/services/outbound_guard.py
    - backend/app/services/pii_redactor.py
    - backend/app/db/outbound_policy.py
    - backend/tests/unit/test_305_redaction.py
    - backend/tests/unit/test_305_outbound_guard.py
    - backend/tests/unit/test_305_pii_routes.py
    - backend/tests/integration/test_305_pii_switch_live.py
    - backend/tests/fixtures/phase305/redaction_cases.json
    - frontend/src/components/org/OrgPiiRedactionCard.tsx
    - frontend/src/components/org/__tests__/OrgPiiRedactionCard.test.tsx
    - scripts/measure-redaction.py
    - scripts/mcp-timeout-probe.py
    - .planning/phases/305-connect-claude-code-and-cursor/evidence/redaction-measurement.txt
    - .planning/phases/305-connect-claude-code-and-cursor/evidence/client-timeouts.txt
    - .planning/phases/305-connect-claude-code-and-cursor/305-VALIDATION.md
  modified:
    - backend/app/mcp/dispatch.py
    - backend/app/mcp/results.py
    - backend/app/mcp/read_tools.py
    - backend/app/api/api_keys.py
    - backend/app/models/api_key.py
    - backend/tests/fixtures/phase293/api_keys_contract.json
    - backend/tests/unit/_mcp305_harness.py
    - frontend/src/components/org/OrgSettingsTab.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - frontend/src/components/org/OrgAuditTab.test.tsx
    - frontend/src/lib/api/apiKeys.ts
    - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
    - frontend/src/components/settings/apiKeys/__tests__/apiKeysContract.test.ts
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/OPERATOR.md
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "The read chunk's overlap window is a PrivateAttr on ReadResult (results.with_window / window_of), not a return wrapper: same effect, the handler's return type unchanged."
  - "outbound_guard looks DEFAULT up at call time (redactor=None) — a bound default would ignore a module-level swap; the live withheld arm proved it."
  - "A JWT is a bearer token and is masked wherever it sits, links included; other high-entropy tokens inside links are not secrets (measured: link tracking tokens were 30/30 of the first entropy sample)."
  - "An email in a filename keeps its extension (jane@example.com.txt -> [email removed].txt) when a dotted domain remains without it."
  - "Claude Code 2.1.312 aborts a silent MCP call at ~60 s by default (documented: ~28 h); recorded for 306 as a design constraint, with the control and the MCP_TOOL_TIMEOUT knob measured."
requirements-completed: [GUARD-03, MCP-01, MCP-02]
duration: "~2 h 50 min"
completed: 2026-10-31
---

# Phase 305 Plan 04: PII redaction for AI tool results, and the phase's evidence — Summary

**Every MCP tool result now passes one fail-closed choke point: with an org's switch on, emails, phones,
card numbers, IBANs and secrets become `[… removed]` in both the structured result and its text while ids,
citations, cursors and Open in Syrel links stay byte-identical; a result that cannot be checked is withheld.
An org admin flips it in Org admin → Settings (audited). The redactor was measured on the real 13.2 M-char
corpus, tightened twice, and ships at 0% labelled false positives; and Claude Code's real client timeout
(~60 s, not the documented 28 h) is on record for 306.**

## Tasks and commits

| # | Task | Commits |
|---|---|---|
| 1 | Deterministic redactor + fail-closed outbound guard (pure) | `d95dd92f9` (RED) · `1f8d4c99d` |
| 2 | Org switch API + the guard on every MCP result, live | `891f9aa6a` (RED) · `9b177495a` |
| 3 | OrgPiiRedactionCard, its mount, the audit words, the API client | `7a7c3cffd` (RED) · `4a15ce412` |
| 4 | Measure, tighten, probe, validation, bookkeeping, gates | `db1a0c5d5` (RED) · `a843c9a9b` (RED) · `91964a07e` (tightening) · `aacea35f9` (scripts + evidence + OPERATOR) · `eb8187c14` (ledger + CLAUDE.md + pins) · final docs commit |

## How each RED was driven

- Task 1: both suites failed at collection (`cannot import name 'pii_redactor' / 'outbound_guard' from 'app.services'`).
- Task 2: 18 errors + 3 failures: no `app.db.outbound_policy`, no `dispatch._pii_on`, no `results.window_around`; the live PUT answered **404** (no route), the live search returned the email and phone verbatim, the withheld arm returned passages. The catalog-grant arm passed in RED by design (mig 222 invariant).
- Task 3: 5 failures: no `OrgPiiRedactionCard` module (whole file), three OrgAuditTab arms, two `getOrgPiiRedaction` / `setOrgPiiRedaction` calls.
- Tightening 1 (`db1a0c5d5`): 7 new negative fixture cases failed (3 phone, 4 secret). Tightening 2 (`a843c9a9b`): 3 negatives + the `SECRET_KEY=` value case failed.

## Measurements

**D-38 redactor** (`evidence/redaction-measurement.txt`, aggregates only): corpus 10,279 search chunks + 872 read
chunks with windows = 13,161,950 chars.

| Recognizer | Run 1 FP | Run 2 FP | Run 3 (ships) hits search/read | Run 3 FP |
|---|---|---|---|---|
| email | 0/30 | — | 129 / 93 | 0/30 |
| phone | **4/19 = 21.1% OVER** | 0/15 | 15 / 13 | 0/15 |
| card | no hits (487 raw) | — | 0 / 0 | no hits |
| iban | 0/2 | — | 2 / 1 | 0/2 |
| secret | **30/30 = 100% OVER** | **9/18 = 50% OVER** | 9 / 9 | 0/9 (all JWTs) |

Latency per unit (ms, `spans()` incl. window): search p50 0.259 · p95 0.439 · p99 0.749 · max 4.245; read p50
2.026 · p95 2.799 · p99 3.030 · max 4.001 (deadline 2,000). Run 1 FPs were decimals / a UUID group read as `00`
phone numbers and link tracking tokens; run 2 FPs were query parameters / percent-encoded link fragments.

**D-43 / D-57 client timeouts** (`evidence/client-timeouts.txt`), Claude Code 2.1.312, `claude -p`:

| Wait | Default | `MCP_TOOL_TIMEOUT=600000` |
|---|---|---|
| 30 s | answered (42.8 s wall) | — |
| 90 s | **aborted ~60 s in** — "The operation timed out." | answered (100.5 s) |
| 150 s | aborted ~60 s in | answered (162.5 s), foreground |
| 310 s | aborted ~60 s in | **aborted at 300 s** ("sent no response or progress for 300s") |

Control: a plain `httpx` client got the 90 s answer in 90.0 s from the same server, so the limit is the
client's. The server ran every abandoned call to completion (stateless + JSON).

## Gate verdicts (verbatim)

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

## Deviations from Plan

1. **[Design] Overlap window as a `PrivateAttr`** (`ReadResult._window`, `results.with_window` / `window_of`), not a return wrapper. Same effect (never serialised — asserted: `set(structuredContent) == set(ReadResult.model_fields)`), and existing tests that compare `ReadResult` from `read_tools.read_document` keep working.
2. **[Rule 1] `guard`'s `redactor` defaulted to `DEFAULT` bound at definition time**, so swapping the module redactor did nothing — found by the live withheld arm. Fixed: `redactor=None`, looked up at call time.
3. **[Rule 1] An email in a filename swallowed the extension** (`… jane@example.com.txt` -> `[email removed]`). Fixture-first (`email-filename-txt`, `email-country-tld-md` keeps `.md`), then fixed in the email recognizer. In `9b177495a`.
4. **[Rule 3] OpenAPI snapshot regenerated** (`export-openapi.py` + `build-public-openapi.cjs`) for the new route; `test_276_*` 71 passed.
5. **[Rule 3] Harness**: `_mcp305_harness.stub_accounting` stubs `dispatch._pii_on` to OFF, so every earlier 305 unit suite sees the column's default.
6. **[D-38, as planned] Two tightenings**, both over the 20% ceiling, each test-first. The tightening-1 code was not committed separately: one fix commit (`91964a07e`) follows both RED commits.
7. **[Scope] Extra timeout measurements beyond the plan's four waits**: an `httpx` control and three runs with `MCP_TOOL_TIMEOUT=600000`, because the default result contradicted the docs and 306 needs to know which side the limit is on.
8. **[Note] The live switch test calls the real route in-process** on a fresh FastAPI app with only `get_current_user` overridden (real `get_active_org_id` + `require_org_manage` on a user-JWT connection, an `org-admin` fixture user). The plan's "admin" role does not exist (`org_members_role_check`); `org-admin` is the role.
9. **[Plan text] `--allowedTools` is variadic in Claude Code** and swallowed a trailing prompt; the probe passes the prompt first and `--allowedTools=` / `--mcp-config=` as single tokens.

## Threat surface

No surface beyond the register. T-305-10 (field walker incl. titles and folder names; overlap window; text rendered from the redacted model; live boundary-split arm), T-305-11 (linear patterns, `MAX_INPUT` 64,000, 2 s deadline -> withheld; worst measured unit 8.0 ms in any run), T-305-24 (column outside the authenticated UPDATE grant, catalog-checked live; the audited route is the only writer), T-305-32 (ids, links, cursors, citations, origin, version passed through by field; live reopen + paging), T-305-33 (unreadable or missing switch -> redact), T-305-34 (shape-only samples outside the repo; evidence grep for email shapes = 0), T-305-35 (same 403 for a member, unit + live), T-305-36 (`grep -lE "timeout-probe|timeout_probe|wait_seconds" -r backend/app` = nothing) are implemented and tested.

## Known Stubs

None.

## Owed (in order)

1. **G-4 rows 1-3** (305-VALIDATION §2) — Claude drives after the merge: Claude Code search + link open (row 1 first), redaction on -> `[email removed]` with the link still opening, maintenance on -> search answers and Last used moves.
2. **The post-bump Chrome chat stream** (305-01 D-01) and the 305-03 readbacks (over-limit words, `MCP · {label}`, `▲ Unrated`) — §2.1.
3. **Operator rows** (§3): Cursor, the deployed two-worker cloud container, the one-box, Claude Desktop via the labelled `mcp-remote` bridge.
4. **Deploy-together (D-40)**: cloud paste 220 -> 221 -> 222 each under its own approval, then `get_advisors(security)`; the 304 D-41 tier confirmation; Coolify `BACKEND_PUBLIC_URL` https (A1); Coolify stop grace > 5 s (A7).
5. `graphify update .` in the main checkout after merge.

## TDD Gate Compliance

RED before GREEN for every task: `d95dd92f9` -> `1f8d4c99d`, `891f9aa6a` -> `9b177495a`, `7a7c3cffd` -> `4a15ce412`, `db1a0c5d5` + `a843c9a9b` -> `91964a07e`.

## Self-Check: PASSED

- All 15 created files listed in key-files exist.
- All 11 code/test/bookkeeping commits are on the branch (`d95dd92f9` … `eb8187c14`); this SUMMARY and 305-VALIDATION.md land in the final docs commit.
- No file deletions versus the base `e456f4af3`.
- The local-DB lock is released; no probe server or spawned uvicorn remains (the probe driver terminates its child); the operator's :8000 server was not touched. Samples and labels (which describe real local data as shapes) stay in the session scratchpad, outside the repository.
- STATE.md and ROADMAP.md were not edited (orchestrator's instruction).
