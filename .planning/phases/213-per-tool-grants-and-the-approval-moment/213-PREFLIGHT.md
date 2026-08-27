---
type: preflight-review
phase: 213
phase_name: "Per-Tool Grants and the Approval Moment"
builder: gemini
reviewer: claude
reviewed_at: 2026-08-27
tree_state: clean at `5527569c` — reviewed BEFORE any 213 plan exists
plans_reviewed: []
verdict: plan against these constraints — a second pass is OWED once the plans exist
---

# Phase 213 — pre-flight

**⚠ TWO THINGS ABOUT THIS FILE ARE UNUSUAL, AND BOTH ARE STATED RATHER THAN GLOSSED.**

1. **It runs AHEAD of the plans, not against them.** `AGENTS.md §3.1`'s pre-flight reviews
   `NNN-*-PLAN.md` files that already exist; **213 has none** (`plans_reviewed: []`). So this is the
   same adversarial read, moved earlier: the constraints, seams and traps to **plan against**, with
   every claim carrying the file and line that produced it. ⭐ **A second pass is owed** once the
   plans land — that one is the real gap review, and only it can check wave shape, `files_modified`
   and `must_haves`.
2. **`AGENTS.md §3.1`'s own test makes 213 CLAUDE-built, on three criteria — 3 (the permission or
   approval model), 4 (a migration that commits a table shape) and 5 (anything that can fail OPEN).**
   `STATE.md` records it as ⭐ CLAUDE-BUILT. The operator asked for a Gemini pre-flight, which swaps
   the seat back; that is the operator's call and this file serves it. **Recorded, not argued** — but
   the reason those three criteria exist is that a permission bug *is* a security bug, and §1 and §2
   below are written at that weight.

**Severity key:** ⛔ blocking · ⚠ major · ▪ minor · ✅ verified-good.

**Read first:** `213-CONTEXT.md` (16 decisions, D-213-00..16) and
`.planning/sketches/213-grants-and-the-approval-moment/BUILD-CONTRACT.generated.md` (the G-2 bar,
generated from the running sketch — never hand-edit it).

---

## 0 · A correction to `213-CONTEXT.md`, made before anyone plans against it

### ⚠ CORR-1 — **D-213-10's premise is REFUTED. `PendingAskCard` ALREADY renders on `WorkflowRunPage`.**

`213-CONTEXT.md` states the ask *"does not exist on `WorkflowRunPage`"*. That is **wrong**, and it is
corrected here rather than quietly fixed because the wrong version would have bought a component
nobody needed:

```
frontend/src/pages/WorkflowRunPage.tsx:120     import { PendingAskCard } from "@/components/panel/PendingAskCard"
frontend/src/pages/WorkflowRunPage.tsx:563     const { data: asks, reconcile: reconcileAsks } = useAskUserPrompt(run?.thread_id ?? null)
frontend/src/pages/WorkflowRunPage.tsx:1560-75 <RunSpine … renderAsk={(slug) => slug === askAnchorSlug && asks.length > 0 ? … <PendingAskCard …
```

**What I got right and what I got wrong.** `ChatLayout.launch.test.tsx:502` really does assert
`WorkspacePanel` mounts only in the chat branch — I inferred the page's gap from the *panel's* mount
and did not read the page. `WorkflowRunPage` renders `PendingAskCard` **directly**, bypassing the
panel entirely. Phase 200.2 put the ask **inside the spine, at the step it belongs to**, and its own
comment says that placement *"is the whole point of it"*.

**So D-213-10 shrinks from "build a mount" to "prove the grant ask flows through the mount that
exists"** — and three real conditions gate that. They are checks, not claims:

| | condition | where |
|---|---|---|
| ⚠ **R-1** | the aside is `hidden … lg:flex` — **below the `lg` breakpoint the ask has no home on this page** | `WorkflowRunPage.tsx:552` |
| ⚠ **R-2** | the card renders **only at `askAnchorSlug`**, derived from a step whose reading is `waiting-for-you`, else the first `running`, else the last row | `:962-968` |
| ⚠ **R-3** | asks are fetched by **`run.thread_id`** — a run without one fetches nothing | `:563` |

**R-2 is the one to drive.** A step paused at the **armed action-risk checkpoint** is not an
`llm_human_input` step; if its reading is not `waiting-for-you`, the anchor falls through to
`running` — which may still be the right row, or may not be. **Nothing measured here settles it.**

---

## 1 · Cross-plan seam audit — the seams that WILL exist

⚠ **This section comes first because of Phase 204.** That pre-flight caught three gaps and **missed
both defects that reached the operator, and both were SEAMS between parallel plans, each side
individually correct and individually green** — `204-03` wrote `workflow_runs.inputs`, `204-02` read
`workflow_runs.metadata`, the read failed OPEN, and the spend cap disarmed silently with **106 tests
green**. Every seam below is named with the **exact key on both sides**.

### ⛔ S-1 — the posture value vocabulary crosses five layers, and `bool()` coercion is shipped in two of them

D-213-05 changes `tool_grants` from `Record<string, boolean>` to a posture map. **The literal
strings must be identical on every side, and two shipped call sites will silently destroy them:**

```
backend/app/services/connector_service.py:761   changes["tool_grants"] = {str(k): bool(v) for k, v in payload.tool_grants.items()}
backend/app/services/connector_service.py:880   sanitized_grants       = {str(k): bool(v) for k, v in tool_grants.items()}
```

`bool("deny")` is **`True`**. Left in place, every posture a person sets becomes `true` — a **Deny
written by a human is stored as an Allow**, with no error anywhere. This is the phase's fail-open,
and it is two lines.

Full type surface to move in one commit — enumerated so nothing is found by a runtime error:

| layer | site |
|---|---|
| Pydantic | `backend/app/models/connector.py:254, 376, 428` — `dict[str, bool]` ×3 |
| service dataclass | `backend/app/services/connector_service.py:240` |
| service coercion | `:315-316`, `:499`, `:544`, `:624`, **`:761`**, **`:880`** |
| API signature | `backend/app/api/connectors.py:723, 733` — `tool_grants: dict[str, bool]` |
| the gate | `backend/app/services/harness/phase_types.py:2517-2518` — `grants.get(tool_name) is True` |
| TS types | `frontend/src/lib/api/org.ts:500, 524, 539` — `Record<string, boolean>` ×3 |
| the ONE predicate | `frontend/src/components/workflows/McpToolPicker.tsx:157` — `isToolGranted` |
| writers | `ConnectionFormPanel.tsx:560, 887`; `McpToolPicker.tsx:312-317` |

⚠ **`isToolGranted` is deliberately THE one grant predicate, not forked** (`McpToolPicker.tsx:362`).
Do not add a second. Its own docblock records the server mirror — *"the engine's gate is
`tool_grants.get(tool_name) is True` — A MISSING KEY DENIES"* — and **D-213-06 makes that sentence
false**. It must be rewritten in the same commit, or it becomes a comment that teaches the wrong
model to the next reader.

### ⛔ S-2 — `default_posture` has a writer, a reader and a **backfill**, and all three must name the same column

Name it on all three sides before a line is written: migration 128's `ALTER TABLE` and `GRANT
SELECT`, `ConnectorConnectionResponse`'s field, and `connector_service`'s `_SELECTABLE_COLUMNS`
projection. ⚠ **`connector_service` projects `_SELECTABLE_COLUMNS`, never `SELECT *`** (mig 127 §4),
so a column present in the response model but absent from the grant is a **total** read failure — see
SEC-2.

### ⚠ S-3 — there is no integration test that mocks NEITHER side, and the phase has two natural waves

The 204 shape exactly. A backend wave will test the gate with the frontend mocked; a frontend wave
will test the grant list with `updateConnectionGrants` mocked. **Neither exercises the join.** One
test must set a posture through the real write path and then read it through the real gate, with
**both** connection shapes. Absent that, this is a gap, not a nice-to-have.

### ⚠ S-4 — the refusal sentence is composed in the backend (D-213-15) and the same words live in the frontend

`grantsVocabulary.ts` (ported from the sketch's `COPY.js`) and the backend's run sentence carry
`REFUSED_BECAUSE_DENIED` / `REFUSED_NEXT`. **Two homes by decision** — each owns its own surface. The
seam risk is drift, so pin it: a test that asserts the backend sentence and the vocabulary entry
agree, or an explicit recorded note that they are allowed to differ and why.

---

## 2 · Security, ordering and reachability

### ⛔ SEC-1 — **the grant gate's POSITION in the gate sequence is the whole fix, and it is a fail-open if placed wrong**

`_exec_external_action` is an ordered sequence:

```
2354  GATE 1 · D-16  golden-run gate      → _record(), suppresses the SEND at publish time
2365  GATE 2 · D-26  operator kill switch
2399  GATE 3 · D-06  egress guard
2409  GATE 4 · D-13  nothing bound
2424  GATE 5 · D-14  resolve connection, scoped by the run's org
2511  GATE 6 ·       MCP tool dispatch   ← `if connection.mcp_server_url:` — the grant check lives INSIDE this
2588  GATE 7 ·       legacy adapter dispatch   ← consults NO grant at all (BUG-260827-02)
```

**The grant/posture gate belongs between Gate 5 and the shape fork** — a shape-independent gate that
runs after the connection resolves and before **either** dispatch arm. Anywhere inside Gate 6 leaves
Gate 7 ungated, which is the bug. Anywhere above Gate 5 has no connection to read grants from.

⚠ **And the ORDERING RULE IS BINDING (ROADMAP SC#4):** this gate closes **BEFORE or WITH** D-213-01's
unlock, never after. A connection that can hold many actions with no per-tool gate is **every one of
them armed by the row merely existing**.

▪ Keep **Gate 1 above** the new gate. Do not "tidy" it — see VG-1.

### ⚠ SEC-2 — migration 128 owes a column-level `GRANT SELECT`, and the failure looks like an outage

Migration 118 re-granted `SELECT` **column by column** so `secret_ciphertext` could be excluded *by
omission*. **A new column is therefore unreadable by default.** Migration 127 §4 records the measured
consequence in its own words:

> *"the projection names a column `authenticated` has no grant on and PostgREST answers `42501
> permission denied for table connector_connections`. **THE FAILURE IS TOTAL AND IT LOOKS LIKE AN
> OUTAGE** — 'Could not load connections' on a pre-existing Slack row that has nothing to do with
> this phase."*

Copy 127 §4's shape exactly — **one column per line**, so the omission of `secret_ciphertext` stays
visible in a diff. D-213-08 asks for the 42501 to be **driven RED before the grant is added**; a
guard nobody has watched fire is not a guard.

### ⚠ SEC-3 — `PATCH /connections/{id}/grants` carries **no `require_visible("live_connectors")`**, and every other write does

```
backend/app/api/connectors.py:395, 431, 473, 497, 743   dependencies=[Depends(require_visible("live_connectors")), …]   # D-26 — per endpoint, never on the router
backend/app/api/connectors.py:716-719                    dependencies=[Depends(require_org_manage)]                      # ← the grants write. No kill switch.
```

⚠ **This is a genuine design question, not an obvious defect, and the plan must answer it rather than
inherit it.** *Narrowing* a permission should plausibly work even with sending disabled; *widening*
one is arming. Under D-213-06 this endpoint now does both. Pick, and record the reason.

▪ Its `summary` also reads *"…for an MCP connection"* — it serves both shapes after this phase.

### ⚠ SEC-4 — "Always allow" (D-213-11) is a **run-time surface that writes a durable permission**

It must reach the same authorization as the Settings screen (`require_org_manage`). A person who can
answer an ask is not necessarily a person who may change a connection. If the two differ, the button
is hidden — not shown and then refused.

### ⚠ REACH-1 — see **CORR-1 / R-1..R-3** above. Drive `lg` **and** below-`lg`, and drive a
library-launched run, not only a chat-launched one.

---

## 3 · Against the approved sketch

The sketch is the G-2 bar and `drive.cjs` makes it executable — **66 assertions, and its §3 is the
contract the React suite must reproduce.** Three items are not negotiable by the builder:

- ⛔ **`ConnectionFormPanel.test.tsx:571` pins `400px` and this sketch deliberately invalidates it.**
  ```
  expect(screen.getByTestId("connections-split").style.gridTemplateColumns).toContain("400px")
  ```
  It becomes `clamp(480px, 38%, 640px)` **in the same commit**. ⚠ The surrounding test is D-27's
  protected property — *nothing between the list and the document may be `aria-hidden`* — so change
  the number, **not** the assertion around it.
- ⚠ **`COPY.js` is PORTED to `frontend/src/components/settings/grantsVocabulary.ts` and IMPORTED.**
  Strings are never retyped into JSX. `LIST_EMPTY` in particular was found *declared and never
  rendered* by `drive.cjs` (README §5.1) — the empty state a 44-row searchable list reaches on the
  first typo. It ships.
- ⚠ **The override edge is coloured by AUTHORSHIP (`--primary`), not by state**, and the edge lane is
  **always reserved** (`border-left: 2px solid transparent`) so a row never shifts 2px. This is the
  one recorded departure from Stitch; §4 of the sketch renders both rules side by side so it can be
  re-judged by looking. **If it is changed, record it — an unrecorded change is how the workflow card
  drifted through three phases (`SEED-155`).**

▪ Invariant **#9** (no countdown on the ask) is satisfied by a shipped mechanism, not a new one:
`PendingAskCard.tsx:481-488` renders `NO_DEADLINE_WAITING_LINE` **only when `!hasDeadline`**. So the
grant ask must be created with **no deadline** — otherwise the clock at `:478` renders and the
invariant breaks without anyone editing the card.

---

## 4 · Gates

### ⚠ GATE-1 — a new suite under `src/components/settings/` is **UNGATED by default**

`scripts/vitest-count-gate.cjs`'s `TARGETS` reaches `src/components/settings/` through **four
FILE-LEVEL entries and no bare-directory entry** — deliberately, and the file says so at `:3345`.
So `grantsVocabulary.test.ts` or a new grant-list suite **passes precisely because it was never
pinned**. Any new suite is added to `TARGETS` by hand, in this phase, or it is invisible to the gate
for the rest of the project's life.

▪ `src/pages/WorkflowRunPage.test.tsx` **is** pinned (`:3244`), so run-page work is watched.

### ▪ GATE-2 — re-derive the gate totals; do not quote this file's or CLAUDE.md's

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, **from the repo root**, verdict line
read **verbatim**. The contract is *no per-file DECREASE* and *zero failing*, **never a fixed grand
total** — a bigger number is the gate working. If a run reds, capture the failing filenames from the
gate's **own persisted JSON** *before* re-running anything, and check each against `git diff
--numstat`. **Do not reach for the cap** — that model is refuted (`SEED-171`), and red is sometimes
real (196-08: `failed 249`, every one a genuine missing mock).

### ⚠ GATE-3 — the two-layer audit registration, in ONE commit

D-213-16 adds `reason` values (no new kind — good). **If a new kind is ever added**, it goes in
`_AUDIT_EVENT_TYPES` (`backend/app/db/workflows.py:274-315`) **and** the migration `CHECK`, in the
same commit. `backend/tests/unit/test_audit_event_registration.py::test_g2_python_allow_list_equals_sql_check`
pins the two sets equal in both directions. A kind in one layer only **moves** the failure
(`ValueError` ↔ Postgres `23514`); it does not remove it.

### ▪ GATE-4 — migration housekeeping

Next number is **`128_`**; the filename must match `<digits>_name.sql` (a letter suffix like `128b`
is **silently skipped** by the CLI). Apply by **pasting into the Supabase SQL editor** — never `db
push` / `db reset` — then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit
`supabase/full-schema.sql`. Deploy-artifact parity (`scripts/check-deploy-drift.sh`) is likely N/A
here — **verify rather than assume**; it fires on env vars, seed-bearing migrations, bundled services
and the sandbox tag.

---

## 5 · Ledger

### ⚠ LEDGER-1 — three rows are STALE and must be re-derived, not edited

Measured 2026-08-27 with CLAUDE.md's own recipe:

| file | row says | measured |
|---|---|---|
| `ConnectionFormPanel.tsx` | 9 / 5 / **2009** | 10 / 5 / **2124** |
| `connectionFormCopy.ts` | 7 / 5 / **968** | 8 / 5 / **1069** |
| `models/connector.py` | 6 / **3** / 468 | 6 / **4** / 468 |
| `api/connectors.py` | 7 / **3** / 781 | 7 / **4** / 781 |

⚠ **A row that is present and WRONG answers the auditor with `satisfied` and stops the audit** —
worse than an absent row.

### ⚠ LEDGER-2 — `phase_types.py`'s obligation reads **OWED**, and that is why D-213-00 exists

CLAUDE.md's row records the G-5 obligation as *"now OWED, not honoured"* since `BUG-260827-01` closed
on 2026-08-27. **Gate 6 sits at line 2511 of that 2,664-line file.** D-213-00 takes the refactor by
construction — the gate leaves into `backend/app/services/connectors/grants.py` on the
`backend/app/services/harness/human_input.py` precedent: verbatim move where possible, the re-import
**load-bearing and never "tidied" away**, and the honest leaf invariant at its real strength —
**this module must never import `phase_types` back.**

▪ ⚠ That precedent's own recorded surprise: **the patch surface moves with the function.** Nine test
sites across five files patched `phase_types.<name>` and had to be repointed, **measured RED first**.
Expect the same for `tool_grants` patch sites.

### ▪ LEDGER-3 — same-commit sync rule

A row and its `docs/HOT-FILE-LEDGER.md` section move together; a disposition cell is capped at **200
chars** and `scripts/check-claude-md-size.cjs` fails above it. New files (`connectors/grants.py`,
`grantsVocabulary.ts`) owe rows at their third phase, not now.

---

## 6 · Verified good — do NOT re-check these

- ✅ **VG-1 — WR-06 is CLOSED, and Gate 1 is why.** `harness_engine.py:840-870` carries a live review
  finding warning that a golden run skips the pause while the step still runs, which *"once Phase 190
  wires a real send, PUBLISHING a workflow would PERFORM THE EXTERNAL ACTION, with nobody asked."*
  **Phase 190 closed it** at `phase_types.py:2354-2363`, and the comment records the observed RED
  before the line existed — *"i.e. PUBLISHING a workflow performed the external action. Driven green
  by this gate in the SAME commit."* **Leave Gate 1 where it is and above the new gate.**
- ✅ **VG-2 — the armed checkpoint is correctly placed and does not need moving.** Hoisted OUT of
  `phase.validators` (D-187-01, because `run_gates` is first-failure-wins and an author's failing
  pre-gate returned first), **after** the pre-gate pass (D-187-02, so a skipped step is never
  approved) and **before** the retry loop (D-187-17, so one execution asks **once**, not three times).
  D-213-09 gives it a second trigger; it must not change its position.
- ✅ **VG-3 — the two armed readings are deliberately independent** (`harness_engine.py:787` run-time,
  `_is_armed_action_risk` at `:2240` boot-time resume), pinned by
  `test_the_two_resume_predicates_are_independent`. **Do not unify them, and do not add a third.**
- ✅ **VG-4 — a live run already waits indefinitely and is already fail-closed.**
  `subscribe_for_response` with `timeout_seconds = None` is *"wait indefinitely"*; the shutdown
  sentinel `CancelledError` and the unparseable-payload refusal are shipped. D-213-12 inherits this
  unchanged.
- ✅ **VG-5 — `discovered_tools`'s sanitizer allow-list is WIDENED, not replaced**
  (`mcp_client.py:306-328`, D-211-09). D-213-02 keeps `discovered_tools` MCP-only, so this phase
  should not touch it.
- ✅ **VG-6 — 212's grant merge already defaults newly discovered tools to ungranted** and preserves
  existing decisions (D-212-13 / CONN-07). ⚠ Under D-213-06 *"ungranted"* now means *inherit* —
  **that merge is a real read of the new semantics** and must be re-examined, but the merge's
  key-preserving shape is right and should be kept.
- ✅ **VG-7 — the descriptor/permission asymmetry is deliberate.** *"A descriptor is an
  advertisement, not a permission … it must not be 'wired up'"* (`descriptors.py:56`). D-213-01
  changes the descriptor **count**, never the asymmetry.
- ✅ **VG-8 — `capability` is already NULLABLE** (mig 126) and the shape CHECK
  (`capability IS NOT NULL OR mcp_server_url IS NOT NULL`, plus 127's mutual exclusion) already
  refuses a row that is neither. **D-213-01's unlock needs no schema change** — it is one function's
  return value.

---

## 7 · What I could not check

- **Nothing was driven, and no code exists.** This is a read of the tree at `5527569c`.
- **No plans exist**, so wave shape, `depends_on`, `files_modified` and `must_haves` are unreviewed —
  including whether any `must_have` contains an **"or"** (212's SEC-2: a must_have with an escape
  hatch is satisfiable both ways, and one of those ways ships the weaker security posture).
- **`askAnchorSlug`'s behaviour for a step paused at the armed checkpoint is UNMEASURED** (R-2). It
  needs a driven run, not a code read.
- **Cloud parity is unmeasured.** ⚠ Migration 128 + the code reading `default_posture` must ship in
  **ONE operation**, exactly as mig 118 + `connector_service.py` had to — a grant without its code,
  or code without its grant, is a total read failure on a pre-existing row.
- **SC#10's 8-row roster is not addressed here.** 213 pauses a live run, so it owes the full native
  roster + OpenRouter, derived from `MODEL_CAPABILITIES`, never re-typed; blocked rows recorded ⛔
  with a reason rather than dropped.

---

## 8 · What I owe

1. **The real gap review**, once `213-*-PLAN.md` files exist — wave shape, seam audit against actual
   `files_modified`, and every threat-model mitigation checked for a test (Phase 203 wrote three
   mitigations and implemented none while every task passed).
2. **A driven check after execution**, not a re-read — gate verdicts read verbatim, §1's seams
   exercised end to end, and every surface in §2 reached **in a browser**. Both Phase 204 defects and
   two of Phase 212's five were found by driving, never by reading.

⚠ **Phase 212's closing lesson, which this phase is one file away from repeating:** five defects, and
**not one was visible to a gate** — 2,796 passing backend tests, a green count gate and a green
typecheck saw none. **Three shared one cause: a test that MOCKS THE THING UNDER TEST.** *A mock
proves the caller is self-consistent; it cannot prove the wire is right.* S-1's `bool(v)` coercion is
exactly that shape — a mocked write path would never reveal that `bool("deny") is True`.
