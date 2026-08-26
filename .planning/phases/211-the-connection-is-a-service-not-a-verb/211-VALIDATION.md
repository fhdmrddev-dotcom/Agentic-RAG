---
phase: 211
slug: the-connection-is-a-service-not-a-verb
status: wave-4-automated-green-manual-rows-owed
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-26
updated: 2026-08-27
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
| **SC#1** | Actions offered come from the connection's own advertised tools | unit (FE) | `npx vitest run src/components/workflows/McpToolPicker.reachability.test.tsx` | ✅ 11 cases — ⚠ **needs a legacy-shaped fixture that does not exist today**; and leg (b) must be RE-POINTED (its `pressMcpShape` helper dies with the shape radiogroup) rather than deleted — claimed by `211-04` Task 3(g) | ⬜ |
| **D-211-12** | ⚠ **POSITIVE CONTROL 2** (`reachability.test.tsx:192-203`) asserts a bound capability row mounts NO tool picker — it pins the DEFECT and stays green after the phase | unit (FE), **inverted control** | same file | ❌ must INVERT — claimed by `211-04` Task 3(g)(2). ⚠ *A control that stays green while the criterion is false is worse than no control* | ⬜ |
| **SC#1** | A static descriptor is byte-shaped like a sanitized MCP tool | unit (BE) | `pytest tests/unit/test_211_static_descriptors.py -q` | ❌ **Wave 0** | ⬜ |
| **SC#1 / D-211-06** | The descriptor's `required` equals the adapter's `INPUT_SCHEMA["required"]`, all three, **derived not retyped** | unit (BE), module-scope assert | same file | ❌ **Wave 0** — the mechanical-agreement assert | ⬜ |
| **SC#2** | Slack still sends: `ok:true` ⇒ `AdapterResult.ok` | unit (BE) | `pytest tests/unit/test_190_slack_ok_false.py -q` | ✅ 18 — **green untouched** | ⬜ |
| **SC#2** | Jira / SMTP argument refusals unchanged | unit (BE) | `pytest tests/unit/test_190_jira_adapter.py tests/unit/test_190_smtp_header_injection.py -q` | ✅ 17 + 13 — **green untouched** | ⬜ |
| **SC#2** | The executor's two-shape branch still refuses an unknown capability | unit (BE) | `pytest tests/unit/test_190_review_fix_executor.py -q` | ✅ 8 — will change; **the refusal case must remain** | ⬜ |
| **SC#2** | A legacy row **presents** as a service with named actions — DATA half | integration, **mocks NEITHER side** (`AGENTS.md §3.1`) | `pytest tests/integration/test_211_service_shape_seam.py -q` | ✅ **14 passed, 0 skipped** (`211-05` T2a). Real handlers + real service + real local Postgres; every created row deleted in teardown and the DB verified byte-identical afterwards | ✅ |
| **SC#2 / D-211-12** | ⭐ A legacy row **presents** as a service with named actions — RENDER half. And a row whose action list is **EMPTY** still renders its card, its in-words empty state and a pressable Refresh, on EVERY shape | unit (FE), **renders against the REAL wire shape** | `npx vitest run src/components/workflows/__tests__/connectionCardReachability.test.tsx` | ✅ **10 cases** (`211-05` T1b). ⚠ **A backend-only seam test structurally cannot see a render gate** — revision iteration 1 caught a proposed gate that made every pre-existing row unreachable. Driven through the PRODUCTION CHAIN with only `@/lib/api` faked and **not one component prop constructed** (asserted by a `?raw` self-fence). RED against the pre-211-04 gate: **4 of 10 failing, MCP-empty correctly still green** | ✅ |
| **SC#2** | Every pre-existing capability row carries a one-element `discovered_tools` naming its own capability, the moment migration 127 lands | integration (DB) | `pytest tests/test_migration_127.py -q` (case 5) | ❌ **Wave 0** — claimed by `211-02` Task 1(b). ⚠ Without the §2b backfill, SC#2 is FALSE for every row that exists today | ⬜ |
| **SC#2** | The SQL backfill's descriptor JSON equals the Python descriptor | unit (BE), **cross-language source fence, NEVER skips** | `pytest tests/test_migration_127.py -k backfill_matches -q` | ❌ **Wave 0** — claimed by `211-02` Task 1(b) case 6 | ⬜ |
| **SC#2 / self-heal** | The capability arm of `POST /connections/{id}/discover` refreshes an action list with no network call | integration | `pytest tests/integration/test_211_service_shape_seam.py -q` (§5) | ✅ (`211-05` T2a). ⚠ Its ONLY caller in the product is the Refresh control `211-04` un-gates. ⭐ The *no network call* half is asserted MECHANICALLY, not promised — `mcp_client.list_tools` is replaced by a raiser, so touching it fails the case. The write is checked too: a refresh that returns the right list and caches nothing self-heals for exactly one render. The SERVICE-ONLY third arm (`ConnectorNothingToDiscover`) has its own case | ✅ |
| **Regression** | An MCP connection with `discovered_tools: []` still shows a clickable Discover control | unit (FE) | `npx vitest run src/components/workflows/McpToolPicker.test.tsx` | ✅ exists at `~:194-215` — **must stay green and must NOT be rewritten** (`211-04` Task 1(d)) | ⬜ |
| **SC#3** | No `Message`/`Ticket`/`Email` category offered anywhere | unit (FE), **negative fence** | `npx vitest run src/components/settings/__tests__/connectionVerbFence.test.ts` | ✅ **21 cases** (`211-05` T1a). Positional, not lexical: named + structural option sets, `role="radio"/"tab"/"option"` children, and literal `<option>` text. Falsified on 5 MUST-FIRE + 6 MUST-NOT-FIRE synthetic controls FIRST; then RED against three plants in real source, each restored md5-identical. ⚠ ONE named exemption (`SERVICE_SUGGESTIONS`'s `"Email over SMTP"` — a service identity, not a category), and a case proves the exemption is LOAD-BEARING | ✅ |
| **SC#3** | The picker's read is no longer capability-scoped | unit (FE) | `npx vitest run src/components/workflows/ConnectionPicker.test.tsx` | ✅ 47 — will change; assert `listConnectorConnections` called with **no** capability arg | ⬜ |
| **SC#4** | A row with neither capability nor MCP URL is ACCEPTED by the DB | integration (DB) | `psycopg2` INSERT against `127.0.0.1:54322`, post-migration | ❌ **Wave 0** — ⚠ **must be driven RED BEFORE migration 127** so the green is attributable | ⬜ |
| **SC#4** | The same row is accepted through `POST /connectors/connections` | unit (BE) | `pytest tests/unit/test_190_connectors_api.py -q` | ✅ 11 — will change; RED-first case is `_validate_connection_shape` raising at `connector.py:257-258` | ⬜ |
| **SC#4** | ⭐ A row that resolves to nothing is **STILL REFUSED** | unit (BE), **negative control** | same file | ❌ **Wave 0** — without this, SC#4's green proves only that the guarantee was **deleted** | ⬜ |
| **D-211-11** | Both shapes on one row are refused (Candidate 3) | integration (DB) | `psycopg2` UPDATE setting `capability` **and** `mcp_server_url` | ❌ **Wave 0** — a guarantee the table has never had | ⬜ |
| **D-211-09** | An off-list, server-controlled key is still **DROPPED** | unit (BE), **negative control** | `pytest tests/unit/test_mcp_connector_client.py -q` | ✅ 21 — will change. ⚠ **The load-bearing case is the DROP, not the carry** | ⬜ |
| **D-211-10** | An absent `readOnlyHint` still fails **CLOSED** | unit (FE) | `npx vitest run src/components/workflows/toolReadOnlyMap.test.ts` | ✅ 7 — **green untouched** | ⬜ |
| **Closed set** | Seven spellings agree; an outside value is **refused** | unit (BE), import-time | `pytest tests/unit/test_189_external_action_model.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_185_detection.py -q` | ✅ **green untouched** | ⬜ |
| **Column grant** | The new columns are readable by the `authenticated` role | integration (DB), **role-scoped** | `pytest tests/integration/test_211_service_shape_seam.py -q` (§6) | ✅ (`211-05` T2a). ⚠ **A 42501 looks like an outage, not a missing column** (mig 126 §3), and a service-role client cannot see it at all. FALSIFIED: a `REVOKE` inside a rolled-back transaction produced `42501`, grant intact afterwards | ✅ |
| **D-211-11** | Both shapes on one row are refused — at the model **AND** at the database | integration + unit | same file (§3) | ✅ **TWO separate assertions, because one passing does not imply the other.** The model is the API's gate; the CHECK constraint is the gate for every writer that is not the API (a migration, a script, a hand-edit in the SQL editor). Asserted by SQLSTATE `23514` and the constraint's NAME | ✅ |
| **⭐ Seam defect** | A service-only row bound to a native step records an INACCURATE sentence | integration (§7), **pins TODAY'S behaviour as the fix's RED** | same file | ✅ **CLOSED — `BUG-260827-01` fixed `8487ec99` (arm 2); §7 rewritten in the same commit. Arm 1 still open.** §7 pins the condition AND the sentence separately, plus the measured two-arm finding. See the *Known gap* section below | ⚠️ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_211_static_descriptors.py` — descriptor shape + `required` agreement
      with all three `INPUT_SCHEMA`s (SC#1, D-211-05, D-211-06)
- [ ] A **DB-level** SC#4 case — RED before migration 127, green after — **plus** its
      *resolves-to-nothing* negative control
- [ ] A **DB-level** both-shapes-at-once refusal case (D-211-11 / Candidate 3)
- [x] A **negative fence** over the three category words in the frontend (SC#3) — ✅
      `frontend/src/components/settings/__tests__/connectionVerbFence.test.ts`, 21 cases,
      **falsified on synthetic MUST-FIRE / MUST-NOT-FIRE controls BEFORE the tree was walked**
      and then driven RED against three plants in real production source (`211-05` T1a)
- [ ] A **legacy-shaped connection fixture** — `discovered_tools` present, `mcp_server_url` absent —
      needed by SC#1's FE cases and by RESEARCH §A.6 / §J.4 / D-211-12  → `211-04` T1(d), T3(g)
- [x] ⭐ A **legacy-shaped connection fixture with an EMPTY `discovered_tools`** — the shape every
      shipped row carried before migration 127 §2b. ⚠ **A pre-populated synthetic fixture cannot see
      the closed loop**; this one is the guard.  → `211-04` T1(d) and `211-05` T1(b) — ✅ both;
      `connectionCardReachability.test.tsx` carries it as CASE 1, driven RED against the
      pre-211-04 gate
- [ ] The **§2b descriptor backfill** in migration 127 plus the **cross-language SQL↔Python fence**
      that holds the two spellings in agreement without a database  → `211-02` T1
- [x] The **cross-plan integration test that mocks neither side** (`AGENTS.md §3.1`) — 211 and 210
      share `live_connectors`, and this phase's backend and frontend halves ship in different waves
      — ✅ `backend/tests/integration/test_211_service_shape_seam.py`, **14 passed, 0 skipped. It
      RAN; it did not skip.** ⚠ **AND IT IS ONLY HALF THE SEAM** — the render half is
      `connectionCardReachability.test.tsx`, and each file's docblock names the other
- [x] **Gate bookkeeping:** `settings/` and `workflows/__tests__/` each need **BOTH knobs** for any
      new test file — the `vitest-count-gate.cjs` pin map **and** the file list at `:3294` / `:3310` /
      `:3340`. Two new files this phase, so four entries.  → `211-05` T1(c) — ✅ **but the "four
      entries" premise was FALSIFIED BY MEASUREMENT and the correction is the point.** The gate was
      run with both files on disk and green BEFORE either knob was turned:
      `connectionCardReachability.test.tsx` printed as `— 10 new` (it already RAN, under the
      `src/components/workflows` DIRECTORY entry) while `connectionVerbFence.test.ts` was **absent
      from the printed list entirely**. So it is **three** entries, not four — a redundant
      file-level TARGETS line beside a covering directory entry would state a dependency that is
      not real, which this script's own 189-14 block refuses in writing. Both files are pinned;
      `116/116` pinned, `0` failing

*Framework install: none — pytest and vitest both ship.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Observed |
|---|---|---|---|---|
| Creating a connection by naming a service shows no verb dropdown | CONN-04 / SC#1 | Lived-experience gate G-4 — wire format is insufficient | Settings → Connections → New. Confirm no `Message`/`Ticket`/`Email` chooser at any step. | ⬜ **OWED — operator.** ⚠ The automated half is DONE and is not a substitute: `connectionVerbFence.test.ts` proves the chooser is gone from the SOURCE of both trees, and `ConnectionFormPanel.test.tsx` proves `queryByTestId("connection-capability-chooser")` is `null` |
| A pre-existing Slack connection still sends | CONN-05 / SC#2 | Requires a real Slack webhook | Drive an existing `post_message` row through a workflow external-action step. | ⬜ **OWED — operator.** Nothing automated can stand in for a real send |
| A pre-existing Jira connection still sends | CONN-05 / SC#2 | Requires a real Jira instance | Same, against the `create_ticket` row. | ⬜ **OWED — operator** |
| Browsing / filtering / picking never offers a verb category | CONN-05 / SC#3 | Visual — a fence proves absence in source, not in the rendered UI | Settings → Connections, and the canvas ConnectionPicker. Check chips, tabs, filters, form categories. | ⬜ **OWED — operator.** ⚠ Automated half DONE: the fence sweeps 117 non-test files across BOTH trees, was falsified on synthetic controls first, and was driven RED against three plants in real production source |
| `GET /connectors/connections` returns 200 after the new column | D-211-11 | A missing column GRANT presents as a 503 outage | Load Settings → Connections. A 42501 here is the grant, not an outage. | ✅ **PROVED AUTOMATICALLY, and by the only instrument that can see it** — `test_211_service_shape_seam.py` §6 opens a real Postgres session, takes `SET LOCAL ROLE authenticated` and reads `service_id` + `discovered_tools`. **Falsified**: a `REVOKE SELECT (service_id) … FROM authenticated` inside a rolled-back transaction produced `42501 permission denied for table connector_connections`, and the grant was verified intact after the rollback. ⚠ A service-role client CANNOT observe this — it bypasses both the grant and RLS |
| ⭐ A connection whose action list is EMPTY still renders its card, an in-words empty state and a pressable **Refresh** | D-211-12 / SC#2 | The closed loop revision iteration 1 caught — no green automation contradicts a card that renders nothing | Bind the service-only row (per-shape row 5) in a workflow external-action step. Its list is legitimately empty. Card present? Sentence present? Refresh pressable? **If the card renders NOTHING, STOP.** | ⬜ **OWED — operator, and this is the one to run.** ⚠ Automated half DONE and it is unusually strong: `connectionCardReachability.test.tsx` renders the PRODUCTION CHAIN against all four real row shapes and was observed RED against the pre-211-04 gate (**4 of 10 failing, MCP-empty correctly still green**). It still does not substitute for the driven scenario |
| A pre-existing Slack / Jira connection shows its named action **without anyone pressing anything first** | SC#2 / D-211-03 | Proves migration 127 §2b's backfill took, not merely that the self-heal path exists | Open each row. A press being required means the row is FAILED, not passed-with-a-note. | ⬜ **OWED — operator.** ⚠ The DATA half is proved: `test_211_service_shape_seam.py` reads the LIVE rows and asserts every `capability IS NOT NULL` row has `jsonb_array_length(discovered_tools) = 1` with `[0].name == capability`, non-vacuously (≥ 2 rows). **A backend test cannot see whether it RENDERS without a press** |

---

## Per-shape scoreboard (replaces the 4-axis cross-provider roster)

⚠ **CLAUDE.md's 8-row cross-provider roster does NOT apply to this phase.** That rule triggers on
*streaming, agent loop, provider routing, or UI state*; this is a connection-model refactor with **no
model call anywhere in its blast radius** (`phase_types.py:2288-2294`, D-22: *"a STEP the executor
performs, not a tool the LLM may call"*). What it owes instead is a **per-shape** board:

| # | Shape | Row on this box? | Verdict |
|---|---|---|---|
| 1 | Legacy capability — Slack (`post_message`) | ✅ exists (`slack` · `Slack-rag-test` · `discovered_tools` length **1**, re-measured on the live DB 2026-08-27) | ⬜ **OWED — operator.** Open the row: it must present as a SERVICE with a named action **with no press first**. Then drive it through a workflow external-action step and confirm it still SENDS (SC#2). ⚠ A press being required ⇒ the §2b backfill did not take ⇒ record **FAILED**, never *passed-with-a-note* |
| 2 | Legacy capability — Jira (`create_ticket`) | ✅ exists (`jira` · `Jira – KAN` · `discovered_tools` length **1**) | ⬜ **OWED — operator.** Same as row 1, against the Jira row |
| 3 | Legacy capability — SMTP (`send_email`) | ⛔ **NO ROW EXISTS ON THIS BOX** (RESEARCH §J.1; re-confirmed 2026-08-27 — the table holds exactly three rows: `slack`, `jira`, `mcp.deepwiki.com`) | ⛔ **BLOCKED, recorded rather than omitted.** ⚠ The automated coverage that stands in its place is NOT a substitute and is named so it is not mistaken for one: `test_211_service_shape_seam.py` exercises `send_email`'s descriptor derivation against the adapter's own `INPUT_SCHEMA`, and `test_190_smtp_header_injection.py` (13 cases) still guards its refusals. **Neither drives a real send.** To clear: create an SMTP connection and drive it, or leave the ⛔ standing with this reason |
| 4 | MCP (DeepWiki) | ✅ exists (`mcp.deepwiki.com` · `discovered_tools` length **3**) | ⬜ **OWED — operator.** Its tool list still renders and its grants are unchanged |
| 5 | ⭐ Service-only — neither capability nor URL (CONN-08) | ❌ new; **this phase makes it representable, and no such row exists on the box yet** — the seam test creates one and deletes it in teardown, verified byte-identical afterwards | ⬜ **OWED — operator, AND RUN THIS ONE FIRST.** Create a connection naming a service nobody here has heard of, with no credential and no endpoint. It SAVES (SC#4), it appears in the list, and it is offered no verb category anywhere. ⚠ Then do the closed-loop check below with it. ✅ **`BUG-260827-01` IS FIXED (`8487ec99`, 2026-08-27) — so binding row 5 to a step and running is now a REAL CHECK, not a known-failure to shrug past.** Arm 2 must now record *"the bound connection names a service but no way to reach it yet"*. ⚠ **Arm 1 is STILL OPEN**: through the shipped UI the bind CLEARS the step's `capability`, so the closed-set guard raises a bare `KeyError` first — if you see a stack trace rather than that sentence, you have hit arm 1, which is expected and is NOT a new finding |

**Rows may be blocked, but never silently omitted** — CLAUDE.md UAT scoreboard rule.

⚠ **NOT ONE OF THESE FIVE ROWS HAS BEEN DRIVEN, AND THAT IS STATED AS A DECISION RATHER THAN
LEFT AS A BLANK.** They are G-4 rows: CLAUDE.md's own rule is that *no screenshot or wire-format
check substitutes for a row — G-4 requires the driven scenario*, and the executor cannot drive a
browser. Auto-mode's `checkpoint:human-verify` auto-approval was therefore **NOT** taken: writing
a verdict nobody observed onto a lived-experience board would be exactly the over-claiming this
whole phase is about. **The phase closes with owed manual UAT rows** (CLAUDE.md G-7 §*"Closing a
phase with owed manual UAT rows is legitimate… but state it as a DECISION"*).

**Run row 5 first.** It is the only shape that has never existed before, it is the one the
closed-loop check depends on, and it is the one carrying a known run-time gap (below).

---

## ✅ CLOSED GAP — the service-only RUN-TIME seam (`BUG-260827-01`, `status: closed` — **ARM 2 ONLY**)

> ⚠ **This section is PRESERVED as written, because it was the fix's specification and the RED it names actually fired.** Closed 2026-08-27 by `/gsd:fast` (`8487ec99`) — the guard is split into two arms, the `getattr` DEFAULT is KEPT and the guard was NOT widened. §7 was rewritten in the same commit → 14 passed. **Arm 1 — the UI-reachable `KeyError` at the closed-set guard — is UNTOUCHED and is now the report's `re_open_trigger`.** Read the two-arm subsection below before driving row 5; it is what tells you which failure you are looking at.

⭐ **FOUND AFTER THIS PHASE'S PLANS WERE WRITTEN, RECORDED HERE, AND DELIBERATELY NOT FIXED.**
Full report: `.planning/reported-bugs/BUG-260827-01-service-only-connection-records-a-false-capability-mismatch.md`.

**It is a CROSS-PLAN SEAM, not any one plan's defect — all three sites are correct alone:**

| # | Site | Plan | What it does, correctly |
|---|---|---|---|
| 1 | `frontend/src/components/settings/ConnectionFormPanel.tsx` (~731 / 744 / 752 / 777) | 211-03 | for an unrecognised service the create body is exactly `{name, config, service_id}` — `capability` only for the three known verbs, `mcp_server_url` only for `mcp`, no trailing `else`. **A service-only row is creatable** (CONN-08) |
| 2 | `frontend/src/components/workflows/ConnectionPicker.tsx` (~478) | 211-04 | `listConnectorConnections()` — no capability argument, no shape filter. **That row is listed and bindable** (SC#3) |
| 3 | `backend/app/services/harness/phase_types.py:2460` | *unchanged since 190* | `getattr(connection, "capability", capability) != capability` — the `getattr` DEFAULT fires only when the attribute is **MISSING**, never when its value is `None` |

For a service-only row, arm 1 is `True` and `None != capability` is `True`, so the step is
recorded-and-not-sent with **`"the bound connection is for a different capability"`** — which is
false. It is not a *different* capability; it is **no** capability. That is an inaccurate
statement on the one surface in this codebase whose entire discipline is not over-claiming.

Migration 127's `shape_is_not_ambiguous` forbids BOTH shape fields being set and **PERMITS both
being NULL, by design** (CONN-08). Before this phase such a row could neither exist nor be
listed. **Both halves are new today.**

### ⚠ TWO reachable arms, and they are DIFFERENT failures — MEASURED, not assumed

| Path | Step config after the bind | What actually happens |
|---|---|---|
| **the shipped UI** | `capability` CLEARED by `ConnectionPicker.bind`; a service-only row advertises no action, so `tool_name` stays empty | the executor's **closed-set guard raises `KeyError`** at `phase_types.py:~2323` — line 2460 is never reached |
| **the definition / API surface** | `capability: "post_message"` alongside a service-only `connection_id`; nothing cross-checks the two | **line 2460 fires** and records the inaccurate sentence |

### Why it is not fixed here

`phase_types.py` is in **no** 211 plan's `files_modified`, plan 211-04's must_have promises that
branch stays untouched, and it is a **G-5 hot file** (`46 / 21 / 2627`) with no review cycle in
this phase. Editing it here would be an unreviewed change to the live run path inside a plan whose
subject is tests and bookkeeping.

### Its RED already exists

`backend/tests/integration/test_211_service_shape_seam.py` §7 asserts **today's** behaviour on
purpose — the condition AND the sentence, pinned separately — so a fix that changes one without
the other cannot pass, and **those cases go RED when the fix lands** and are updated in the same
commit. §7 also pins the genuinely-mismatched case as still refused, so a fix that merely widens
the guard would delete a real protection while closing a wording bug.

**Re-open trigger:** *the operator's `/gsd:fast` immediately after this phase* — ~4 lines, one
file, no schema and no API surface, which is G-3 territory by the guardrails' own rule.

---

## Owed items, named with their owner

| Item | Owner | State |
|---|---|---|
| The five per-shape rows + the four G-4 lived-experience checks | **operator** | ⬜ **OWED** — the executor cannot drive a browser; see the board above. Run row 5 first |
| `bash scripts/regenerate-full-schema.sh` (rebuild `supabase/full-schema.sql` for migration 127) | operator | ✅ **DONE 2026-08-27** — 6258 lines; and it surfaced a defect, see below |
| `/gsd:fast` fix for `BUG-260827-01` | operator | ✅ **DONE 2026-08-27 — `8487ec99`, arm 2 only.** RED observed firing before the rewrite; `tests/unit` held at the 68 baseline. ⚠ It also added the fix to the 211 backend review scope (`7e0ce0d9`), because a G-3 fast fix on a G-5 hot file otherwise ships ungated — and G-5 on `phase_types.py` is now **OWED**, not honoured |
| `pytest tests/test_migration_127.py -q` → `10 passed, 0 skipped` | operator | ✅ **DONE 2026-08-27** — see below |

### ✅ `test_migration_127.py` — the transition happened

Run on the main working tree on **2026-08-27**, verbatim:

```
..........                                                               [100%]
10 passed, 1 warning in 0.48s
```

That is the required transition **`3 passed, 7 skipped` → `10 passed, 0 skipped`**: the seven
live-DB cases now execute, including both negative controls (a service-only row ACCEPTED, an
ambiguous both-shapes row REFUSED). ⭐ **That pair is what makes SC#4's green mean *"the
constraint was REPLACED"* rather than *"the constraint was DELETED"*** — a single
post-migration sample cannot tell those apart.

---

## Automated gates at wave 4's close — measured, verbatim

| Gate | Baseline | Measured at `211-05` | Verdict |
|---|---|---|---|
| Frontend count gate | OK · 114/114 · total 5793 · 0 failed | **`count gate OK — 116/116 pinned files present, no per-file decrease, 0 failing.`** · `total 5829 · failed 0 · pinned total 5211` — identical on **two** runs | ✅ |
| Frontend typecheck (`-p tsconfig.app.json`) | **34** | **34**, none from either new file | ✅ |
| Backend unit suite | 68 failed / 2680 passed | **68 failed / 2778 passed** — no NEW failing file; the rot set is unchanged | ✅ |
| `test_211_service_shape_seam.py` | ❌ Wave 0 | **14 passed, 0 skipped** — it RAN, it did not skip | ✅ |
| `test_migration_127.py` | ❌ Wave 0 | **10 passed, 0 skipped** (operator, 2026-08-27) | ✅ |
| CLAUDE.md size gate | 83,431 chars | **`claude-md size gate OK`** · 84,775 chars · 56.5% of limit · no `[disposition-too-long]` / `[duplicate-row]` / `[malformed-row]` | ✅ |

⚠ **The count gate's grand total GREW (5793 → 5829) and that is the gate WORKING.** Its contract
is *no per-file DECREASE* and *zero failing*, never a fixed total. The movement is fully
attributable: `+10` `connectionCardReachability.test.tsx`, `+21` `connectionVerbFence.test.ts`,
and the rest is prior waves' work already on the base.

---

*Phase: 211-the-connection-is-a-service-not-a-verb*
*Validation strategy created: 2026-08-26 · source `211-RESEARCH.md` §K*
*Wave 4 results recorded: 2026-08-27 (`211-05`)*

### ✅ `regenerate-full-schema.sh` — done, and it caught a defect that would have shipped

Run 2026-08-27 by the operator. `supabase/full-schema.sql` rebuilt, 6258 lines, live-DB dump
(no `--reset`). Verified in the artifact: `service_id` present, `has_a_service_identity` and
`shape_is_not_ambiguous` present, `shape_is_one_of_two` **gone**, `idx_connector_connections_org_service`
present.

⚠ **THE GRANT WAS NOT IN IT, AND NOT ONLY MIGRATION 127'S.** `regenerate-full-schema.sh` runs
`pg_dump --no-privileges`, so **no ACL is ever carried by the dump** — every column GRANT is
mirrored by hand in `scripts/full-schema-supplement.sql`. That mirror had fallen **four columns**
behind the live table. Measured against `information_schema.column_privileges` rather than read
off a diff:

| Column | live SELECT | was in artifact | landed |
|---|---|---|---|
| `mcp_server_url` | yes | **NO** | Phase 206 — latent a whole milestone |
| `tool_grants` | yes | **NO** | Phase 206 — latent a whole milestone |
| `discovered_tools` | yes | **NO** | Phase 206 — latent a whole milestone |
| `service_id` | yes | **NO** | migration 127 — this phase |
| `secret_ciphertext` | NO | absent | correct, deliberate (CR-01) |

**The failure it ships is TOTAL, not partial.** `_SELECTABLE_COLUMNS` is DERIVED from
`ConnectorConnectionResponse`, so every read projects every response field by name. A greenfield
bootstrap from `full-schema.sql` would name four ungranted columns and PostgREST answers
`42501 permission denied for table connector_connections` on **every** read of the table —
including a pre-existing row unrelated to this phase. It presents as an **outage**, not a
permissions bug. That is migration 118's own recorded lesson, in that very file, recurring
because the mirror is manual.

Fixed at the SOURCE (`scripts/full-schema-supplement.sql` — editing the generated artifact would
be erased by the next regen), regenerated, and re-verified that all four now appear **and** that
`secret_ciphertext` still does not. `scripts/check-deploy-drift.sh` → PASS. Commit `0396aea2`.

⚠ **THREE OF THE FOUR WERE NOBODY'S PHASE.** They were watched by no gate: the drift check passes
on them, the dump cannot see them, and no test bootstraps from `full-schema.sql`. **The only reason
they were found is that someone read the regen's output instead of its "Done." line.** A gate that
compares this block against `information_schema.column_privileges` is the missing mechanism, and it
is not written yet.
