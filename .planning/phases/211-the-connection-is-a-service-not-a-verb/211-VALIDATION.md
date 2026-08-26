---
phase: 211
slug: the-connection-is-a-service-not-a-verb
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
source: 211-RESEARCH.md §K (Validation Architecture)
---

# Phase 211 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Derived from `211-RESEARCH.md` §K.** Where this file and §K disagree, §K is the measured one.

---

## Test Infrastructure

| Property | Backend | Frontend |
|----------|---------|----------|
| **Framework** | `pytest` | `vitest` + `@testing-library/react` (jsdom) |
| **Config file** | `backend/pytest.ini` | `frontend/vitest.config.ts`; gate `scripts/vitest-count-gate.cjs` |
| **Quick run command** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/<file> -q` | `cd frontend && npx vitest run src/components/<dir> --reporter=basic` |
| **Full suite command** | `cd backend && python -m pytest tests/unit -q` | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the repo root** |
| **Typecheck** | — | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` |
| **Estimated runtime** | ~180 s full | ~30 s scoped · gate ~5 min |

⚠ **`npx tsc --noEmit` WITHOUT `-p tsconfig.app.json` checks ZERO files.** The flag is load-bearing.

### Baselines — untouched tree, from `211-MEASUREMENTS.md` §1. **Do NOT re-derive.**

| Gate | Baseline |
|---|---|
| Frontend typecheck | **34 errors** |
| Frontend count gate | **OK · 114/114 pinned · total 5793 · 0 failed** |
| Backend unit suite | **68 failed / 2680 passed** (rot set 68) |
| CLAUDE.md size | **83,431 chars · 55.6% of limit · OK** |

⚠ **34 and 68 are BASELINES, not targets.** Compare per-file, never against 0.
⚠ **A growing count-gate total is the gate WORKING.** Its contract is *no per-file decrease* and
*zero failing* — never a fixed grand total.

---

## Sampling Rate

- **After every task commit:** only the suites the task's `files_modified` touch —
  `pytest tests/unit/<touched> -q` and/or `npx vitest run <touched dir> --reporter=basic`. Under 30 s.
- **After every plan wave:** backend `python -m pytest tests/unit -q` (against the **68** rot
  baseline, per-file) **and** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the
  repo root, reading the **verdict line verbatim**, **and** `npx tsc --noEmit -p tsconfig.app.json`
  against the **34** baseline.
- **⭐ Migration wave — an EXTRA sample, not the same one.** The DB shape is sampled **twice**: RED
  before migration 127 (SC#4 INSERT refused) and green after (accepted; negative control still
  refused). **A single post-migration sample cannot distinguish *"the constraint was replaced"* from
  *"the constraint was deleted."***
- **Before `/gsd:verify-work`:** full backend suite at or below 68 with **no new failing file**;
  count gate `OK` with no per-file decrease; tsc ≤ 34.
- **Max feedback latency:** 30 s per task · ~6 min per wave.

### ⚠ A red count-gate run is not automatically a flake

Capture failing filenames from the gate's **own persisted JSON before re-running anything**, check
each against `git diff --numstat`, and only then compare against SEED-171's five known-flaky suites
(`WorkflowsPage.test.tsx`, `library/WorkflowCard.test.tsx`,
`WorkflowBuilderPage.{session,canvas}.test.tsx`, `WorkflowRunPage.test.tsx`).
**Do not reach for the worker cap** — Phase 195 measured that adjusting it does not fix these.
Phase 196 measured `failed 249` that was entirely REAL (missing mock exports).

---

## Per-Task Verification Map

> Task IDs are assigned when PLAN.md files are written. Each row below is a **success-criterion
> obligation** that some task must claim; a row nobody claims is an unplanned item.

| SC / Decision | Behavior to prove | Test Type | Automated Command | Exists? | Status |
|---|---|---|---|---|---|
| **SC#1** | The three-verb `<select>` is gone from the create flow | unit (FE) | `npx vitest run src/components/settings/__tests__/ConnectionFormPanel.test.tsx -t "capability"` | ✅ — **assertion inverts**: `queryByTestId("connection-capability-chooser")` → `toBeNull()` | ⬜ |
| **SC#1** | Actions offered come from the connection's own advertised tools | unit (FE) | `npx vitest run src/components/workflows/McpToolPicker.reachability.test.tsx` | ✅ 11 cases — ⚠ **needs a legacy-shaped fixture that does not exist today** | ⬜ |
| **SC#1** | A static descriptor is byte-shaped like a sanitized MCP tool | unit (BE) | `pytest tests/unit/test_211_static_descriptors.py -q` | ❌ **Wave 0** | ⬜ |
| **SC#1 / D-211-06** | The descriptor's `required` equals the adapter's `INPUT_SCHEMA["required"]`, all three, **derived not retyped** | unit (BE), module-scope assert | same file | ❌ **Wave 0** — the mechanical-agreement assert | ⬜ |
| **SC#2** | Slack still sends: `ok:true` ⇒ `AdapterResult.ok` | unit (BE) | `pytest tests/unit/test_190_slack_ok_false.py -q` | ✅ 18 — **green untouched** | ⬜ |
| **SC#2** | Jira / SMTP argument refusals unchanged | unit (BE) | `pytest tests/unit/test_190_jira_adapter.py tests/unit/test_190_smtp_header_injection.py -q` | ✅ 17 + 13 — **green untouched** | ⬜ |
| **SC#2** | The executor's two-shape branch still refuses an unknown capability | unit (BE) | `pytest tests/unit/test_190_review_fix_executor.py -q` | ✅ 8 — will change; **the refusal case must remain** | ⬜ |
| **SC#2** | A legacy row **presents** as a service with named actions | integration, **mocks NEITHER side** (`AGENTS.md §3.1`) | new | ❌ **Wave 0** | ⬜ |
| **SC#3** | No `Message`/`Ticket`/`Email` category offered anywhere | unit (FE), **negative fence** | `npx vitest run src/components/settings src/components/workflows -t "category"` | ❌ **Wave 0** — model on the `?raw` cross-language fence at `ExternalActionSection.tsx:38`, don't invent one | ⬜ |
| **SC#3** | The picker's read is no longer capability-scoped | unit (FE) | `npx vitest run src/components/workflows/ConnectionPicker.test.tsx` | ✅ 47 — will change; assert `listConnectorConnections` called with **no** capability arg | ⬜ |
| **SC#4** | A row with neither capability nor MCP URL is ACCEPTED by the DB | integration (DB) | `psycopg2` INSERT against `127.0.0.1:54322`, post-migration | ❌ **Wave 0** — ⚠ **must be driven RED BEFORE migration 127** so the green is attributable | ⬜ |
| **SC#4** | The same row is accepted through `POST /connectors/connections` | unit (BE) | `pytest tests/unit/test_190_connectors_api.py -q` | ✅ 11 — will change; RED-first case is `_validate_connection_shape` raising at `connector.py:257-258` | ⬜ |
| **SC#4** | ⭐ A row that resolves to nothing is **STILL REFUSED** | unit (BE), **negative control** | same file | ❌ **Wave 0** — without this, SC#4's green proves only that the guarantee was **deleted** | ⬜ |
| **D-211-11** | Both shapes on one row are refused (Candidate 3) | integration (DB) | `psycopg2` UPDATE setting `capability` **and** `mcp_server_url` | ❌ **Wave 0** — a guarantee the table has never had | ⬜ |
| **D-211-09** | An off-list, server-controlled key is still **DROPPED** | unit (BE), **negative control** | `pytest tests/unit/test_mcp_connector_client.py -q` | ✅ 21 — will change. ⚠ **The load-bearing case is the DROP, not the carry** | ⬜ |
| **D-211-10** | An absent `readOnlyHint` still fails **CLOSED** | unit (FE) | `npx vitest run src/components/workflows/toolReadOnlyMap.test.ts` | ✅ 7 — **green untouched** | ⬜ |
| **Closed set** | Seven spellings agree; an outside value is **refused** | unit (BE), import-time | `pytest tests/unit/test_189_external_action_model.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_185_detection.py -q` | ✅ **green untouched** | ⬜ |
| **Column grant** | `GET /connectors/connections` still returns 200 after the new column | manual / UAT | load Settings → Connections in the browser | ⚠ **A 42501 looks like an outage, not a missing column** (mig 126 §3) | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_211_static_descriptors.py` — descriptor shape + `required` agreement
      with all three `INPUT_SCHEMA`s (SC#1, D-211-05, D-211-06)
- [ ] A **DB-level** SC#4 case — RED before migration 127, green after — **plus** its
      *resolves-to-nothing* negative control
- [ ] A **DB-level** both-shapes-at-once refusal case (D-211-11 / Candidate 3)
- [ ] A **negative fence** over the three category words in the frontend (SC#3)
- [ ] A **legacy-shaped connection fixture** — `discovered_tools` present, `mcp_server_url` absent —
      needed by SC#1's FE cases and by RESEARCH §A.6 / §J.4 / D-211-12
- [ ] The **cross-plan integration test that mocks neither side** (`AGENTS.md §3.1`) — 211 and 210
      share `live_connectors`, and this phase's backend and frontend halves ship in different waves
- [ ] **Gate bookkeeping:** `settings/` needs **BOTH knobs** for any new test file — the
      `vitest-count-gate.cjs` pin map **and** the file list at `:3294` / `:3310` / `:3340`

*Framework install: none — pytest and vitest both ship.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Creating a connection by naming a service shows no verb dropdown | CONN-04 / SC#1 | Lived-experience gate G-4 — wire format is insufficient | Settings → Connections → New. Confirm no `Message`/`Ticket`/`Email` chooser at any step. |
| A pre-existing Slack connection still sends | CONN-05 / SC#2 | Requires a real Slack webhook | Drive an existing `post_message` row through a workflow external-action step. |
| A pre-existing Jira connection still sends | CONN-05 / SC#2 | Requires a real Jira instance | Same, against the `create_ticket` row. |
| Browsing / filtering / picking never offers a verb category | CONN-05 / SC#3 | Visual — a fence proves absence in source, not in the rendered UI | Settings → Connections, and the canvas ConnectionPicker. Check chips, tabs, filters, form categories. |
| `GET /connectors/connections` returns 200 after the new column | D-211-11 | A missing column GRANT presents as a 503 outage | Load Settings → Connections. A 42501 here is the grant, not an outage. |

---

## Per-shape scoreboard (replaces the 4-axis cross-provider roster)

⚠ **CLAUDE.md's 8-row cross-provider roster does NOT apply to this phase.** That rule triggers on
*streaming, agent loop, provider routing, or UI state*; this is a connection-model refactor with **no
model call anywhere in its blast radius** (`phase_types.py:2288-2294`, D-22: *"a STEP the executor
performs, not a tool the LLM may call"*). What it owes instead is a **per-shape** board:

| # | Shape | Row on this box? | Verdict |
|---|---|---|---|
| 1 | Legacy capability — Slack (`post_message`) | ✅ exists | ⬜ |
| 2 | Legacy capability — Jira (`create_ticket`) | ✅ exists | ⬜ |
| 3 | Legacy capability — SMTP (`send_email`) | ⛔ **NO ROW EXISTS** (RESEARCH §J.1) | ⛔ — create a row first **or record the ⛔ with its reason**. Never silently omit. |
| 4 | MCP (DeepWiki) | ✅ exists | ⬜ |
| 5 | Service-only — neither capability nor URL (CONN-08) | ❌ new, this phase creates it | ⬜ |

**Rows may be blocked, but never silently omitted** — CLAUDE.md UAT scoreboard rule.

---

*Phase: 211-the-connection-is-a-service-not-a-verb*
*Validation strategy created: 2026-08-26 · source `211-RESEARCH.md` §K*
