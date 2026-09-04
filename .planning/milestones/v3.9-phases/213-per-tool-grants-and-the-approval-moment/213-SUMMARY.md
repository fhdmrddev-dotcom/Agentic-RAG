# Phase 213 Summary: Per-Tool Grants and the Approval Moment

## Executive Summary

Phase 213 delivers the full tri-state per-tool grant system and approval moment mechanics across the database schema, backend services, harness execution engine, and frontend settings/workflows UI.

> ⚠ **THAT SENTENCE WAS FALSE WHEN IT WAS WRITTEN, AND IS KEPT RATHER THAN OVERWRITTEN BECAUSE THE
> CORRECTION IS THE FINDING.** At `93fc2f521` the approval moment **did not exist** — Gate 5.5
> refused on `deny` and fell through on `ask`, so a tool needing approval dispatched exactly like one
> set to Allow, and the entire ask/refusal vocabulary shipped consumed by nothing.
> `213-POSTFLIGHT.md` measured it four independent ways. **§1 below describes the state at that
> commit; §2 is what closed the gap; §3 is the drive.** Read all three — §1 alone overclaims.

---

## 1. Work Completed by Wave

### Wave 1: Posture Schema & Backend Model/Service/API Updates (`213-01`)
- Created and applied `supabase/migrations/128_connector_connection_posture.sql` adding `default_approval_posture` (`text CHECK in ('allow', 'ask', 'deny') DEFAULT 'ask'`) and `tool_grants` (`jsonb DEFAULT '{}'::jsonb`) with column-level `GRANT SELECT` to `authenticated` and `service_role`.
- Updated `supabase/full-schema.sql`.
- Updated `backend/app/models/connector.py` with `ToolGrantPosture = Literal["allow", "ask", "deny"]`, `ConnectorConnectionCreate`, `ConnectorConnectionUpdate`, `ConnectorConnectionRead`.
- Replaced `bool(v)` grant sanitizer in `backend/app/services/connector_service.py` with `_sanitize_tool_grants` enforcing exact `_LEGAL_GRANT_VALUES = {"allow", "ask", "deny"}`.
- Updated `backend/app/api/connectors.py` endpoint `PATCH /connections/{id}/grants` with `ValueError -> 422`.
- Updated frontend types in `frontend/src/lib/api/org.ts`, `frontend/src/lib/api/connectors.ts`, `frontend/src/lib/api.ts`.
- Updated `frontend/src/components/workflows/McpToolPicker.tsx` and its test suite.
- Created unit tests in `backend/tests/unit/test_213_posture_schema.py` (15/15 passed).

### Wave 2: Gate 5.5 Execution Engine Integration & Audit Receipts (`213-02`)
- Created leaf module `backend/app/services/connectors/grants.py` defining `resolve_effective_posture` and `is_tool_allowed` with ZERO imports of `phase_types` or `harness_engine` (refactor taken by construction / D-213-00).
- Integrated Gate 5.5 into `backend/app/services/harness/phase_types.py:_exec_external_action` between Gate 5 and Gate 6/7 shape fork (enforcing SEC-1 / BUG-260827-02).
- Extended `_write_send_receipt` to accept `tool_name: str | None = None` and record `metadata["tool_name"] = str(tool_name)` (D-213-13/14).
- Updated Gate 6 (MCP) and Gate 7 (Capability) dispatch to pass `tool_name` to `_write_send_receipt` on success, and emit `tool_refused` on Gate 5.5 failure.
- Created unit tests in `backend/tests/unit/test_213_gate55_execution.py` (9/9 passed).

### Wave 3: Human Pause / Approval Moment Engine Dispatch & Recovery (`213-03`)
- Verified `_approval_sentence` in `backend/app/services/harness/grounding.py` generates honest copy.
- Confirmed `PendingAskCard` integration in `frontend/src/pages/WorkflowRunPage.tsx` via `RunSpine` `renderAsk` at `askAnchorSlug`.

### Wave 4: UI Tri-State Chips, Vocabulary & Connection Grants List (`213-04`)
- Ported copy vocabulary `frontend/src/components/settings/grantsVocabulary.ts` verbatim from `COPY.js`.
- Created `frontend/src/components/settings/ConnectionGrantsList.tsx` implementing all 10 invariants from `BUILD-CONTRACT.generated.md`:
  - Invariant 1: Primary override edge indicator (no state color on edge).
  - Invariant 2: 2px transparent edge lane.
  - Invariant 3: Three arms per segmented control group, exactly 1 pressed.
  - Invariant 4: Deny arm styled with destructive token.
  - Invariant 5: Widened panel split track to `clamp(480px, 38%, 640px)`.
  - Invariant 6: Search filter with empty state (`LIST_EMPTY`).
  - Invariant 7: Unknown direction handling and help copy.
  - Invariant 8: Zero `[title]` attribute rule (all text in DOM).
  - Invariant 9: Default posture segmented control.
  - Invariant 10: "You changed this" override marker.
- Updated `frontend/src/components/settings/ConnectionsTab.tsx` and `ConnectionFormPanel.tsx`.
- Created unit tests in `frontend/src/components/settings/__tests__/ConnectionGrantsList.test.tsx` (8/8 passed).
- Updated `ConnectionFormPanel.test.tsx` (153/153 passed) and `ConnectionsTab.test.tsx` (86/86 passed).

### Wave 5: End-to-End Integration Tests & Gate Verification (`213-05`)
- Created `backend/tests/integration/test_213_end_to_end_grants.py` testing full flow without mocking posture logic (3/3 passed).
- Pinned `ConnectionGrantsList.test.tsx: 8` into `scripts/vitest-count-gate.cjs` TARGETS and BASELINE.
- Verified all gates:
  - Frontend count gate: 119/119 pinned files present, 0 failing, total 5865 tests passing.
  - Backend pytest suites: 173 passed, 0 failing across all connector, posture, Gate 5.5, end-to-end integration, and harness execution suites.
  - TypeScript compiler (`tsc`): 0 net-new errors.

---

## 2. What shipped AFTER the post-flight

`213-POSTFLIGHT.md` closed ⛔ **NOT COMPLETE** — the GRANT half shipped, the APPROVAL half did not.
Gap-closure **round 1** (`node scripts/check-gap-closure-rounds.cjs 213` → G-7 clear) and four
operator-driven fixes followed. **None of this is in §1, which was written before any of it.**

| Commit | What it changed |
|---|---|
| `d359bd2b` **213-06** | Gate 5.5 gains its `ask` arm keyed on `action_risk_armed` — armed ⇒ already asked, unarmed ⇒ REFUSE. Fail-closed moves back into the **gate** from a column default that is `'ask'` for every new connection. The prompt names tool + exact arguments (APPENDED, so 185's `startswith` assertions hold). Refusal takes the sketch's words; three `reason` values, one audit kind. Migration 128's false re-paste-safe claim corrected. |
| `49a189ac` **213-07** | ⚠ **Grants were STALE AFTER SAVE** — `onUpdate` called `reload()` before the grants write landed. Grants now write first, and only when one changed. The `DIRECTION_UNKNOWN_HELP` sentence rendered ~44 times on one connection; now once. |
| `bca71c38` | Eight catalog services get their own logo (SEED-215) — and flipping the marks broke `shapeForService`, which keyed the connection SHAPE off `markKey === "mcp"`. Phase 212's D-5 defect, reintroduced by a logo. |
| `09bfcb95` | ⛔ **BUG-260827-02's UI half** — Slack, Jira and SMTP rendered the posture control and `handleSave` **dropped every click** (`capability === "mcp"` on both arms). Nothing in the backend ever required that restriction; it lived in two frontend lines. |
| `7f36b505` · `56423bb2` | A connected vendor draws its own mark rather than the transport's plug; an MCP row can reach `Ready`; the Popular strip reads the connections it was ignoring (a connected GitHub still offered *Connect*, and pressing it opened an EMPTY form). |
| `a0b232ec` … `5bbfa24a` | Settings page measure `768 → 1152px`, tab strip adopts the card container and spans the panel's width; Governance follows (SEED-216). |

---

## 3. The driven check (2026-08-28)

**Method.** Live app, live local Supabase, nothing mocked. The grant surface was driven in Chrome
against `localhost:5173`; the gate was driven as **six real workflow runs** created through
`POST /workflows` + `POST /threads/{id}/messages` with the browser session's own JWT, each answered
through `POST /runs/{id}/ask_user_response`, and every verdict read from `workflow_phases` and
`harness_audit` in Postgres rather than from a suite. The MCP arm reached
`https://mcp.deepwiki.com/mcp` for real (`raw_status: 200`). **Nothing was sent to Slack, Jira or
SMTP** — the one capability-shape run was driven with its grant set to `deny` first, so the send was
refused by the gate under test.

⚠ **Every mutation was reverted and the revert was verified.** GitHub is back at 43 `ask` + 1 `deny`
with `create_branch` at `ask`; DeepWiki at its two `allow` keys; Slack `post_message` at `allow`. All
seven drive workflows and their threads were deleted (`204` each).

### Verdicts

| SC | Verdict | Evidence |
|---|---|---|
| **#1** one list, per-tool switching | ✅ **driven** | GitHub renders **44** `action-row-*` rows with a tri-state control each; `Search 44 actions` filters to exactly `create_branch`; a no-match query renders `data-state="empty"` reading *"No action matches that."* |
| **#2** connection default, per-tool override | ✅ **driven** | `create_branch` `ask → Deny`, Save, panel reopened → still `Deny`, and Postgres reads `tool_grants->>'create_branch' = 'deny'`. *"Use the default"* → Save → **the key is GONE** (44 → 43 keys) and the row falls back to the connection default. |
| **#3** the run pauses and names service, tool, arguments | ⚠ **PARTIAL — the pause is real, the SERVICE is never named** | See D-1 below. The hold, the tool, the arguments and the refuse-arm are all real. |
| **#4** denied or never-granted is refused, naming the grant | ✅ **driven, both reasons, both shapes** | MCP never-granted → `ask_question was refused. ask_question has never been allowed on this connection. Set it to Allow or Ask first…` / `reason: not_granted`. MCP explicit deny → `…is set to Deny on this connection.` / `posture_denied`. **Capability shape (Slack) → refused identically** — `tool_refused · post_message · posture_denied`. |
| **#5** every outbound call in the ledger | ✅ **driven** | The one real send wrote `external_action_sent` carrying `capability`, `connection_id`, `destination_host`, `tool_name: read_wiki_structure`, `raw_status: 200`. **`user_id` is non-null on all 9 audit event types** written during the drive. |

### ⭐ The headline: BUG-260827-02's run half is closed, and it was driven rather than reasoned

A **Slack** step — the capability shape, which before this phase consulted **no grant at all** — was
stopped by Gate 5.5 with `tool_refused / posture_denied` after a person had already approved it at
the armed checkpoint. That is the criterion the bug was filed for, observed on a real run.

### Findings

- ⚠ **D-1 — SC#3's "service" is named in NEITHER shape.** `_external_action_clause`
  (`grounding.py:1283`) fills the service slot from `config.capability`. An **MCP** row carries
  `capability = None`, so the clause is omitted — deliberate (*"never draw a name the system cannot
  know"*), and the consequence is that GitHub, DeepWiki and Notion pauses name no service. A
  **capability** row carries the same value in both slots, so the sentence reads
  **`It will run "post_message" through post_message.`** — a tautology, not a service. The service a
  person needs is *Slack*, which is on the connection row (`name` / `service_id`) and is not resolved
  because the composer is pure. **Driven verbatim on both shapes.**
- ⚠ **D-2 — the override marker overclaims: "You changed this" on rows nobody changed.**
  `resolveItemPosture` (`ConnectionGrantsList.tsx:29`) sets `isOverridden` on **key presence**, and
  migration 128 §3 backfills an explicit key onto every capability row. Slack's `post_message` shows
  the marker today; **no person can have set it**, because the control was unreachable for the
  capability shape until `09bfcb95f`, committed the same day. The reset link disappearing after
  *"Use the default"* confirms the marker tracks presence, not authorship.
- ⚠ **D-3 — the `approval_required` arm is UNREACHABLE from a workflow, and the drive proved it
  rather than assuming it.** A step authored with `action_risk_armed: false` still emitted
  `action_risk_pending` — the armed checkpoint is structural on `external_action`
  (`models/harness.py:475`). So Gate 5.5's unarmed-`ask` refusal cannot fire on any path that ships
  today; it is the fail-closed floor **for Phase 216's chat path**, which is exactly what 213-06
  claimed and what nothing in the workflow product can exercise. It is right, and it is untestable
  from the product until 216.
- ▪ **D-4 — the human "Do not run it" writes no audit event of its own.** Approval writes
  `validator_ask_user_approved`; the refusal is recorded only inside `run_failed`'s reason string. The
  ledger can be asked *who approved*, and cannot be asked *who declined* without parsing prose.
- ▪ **D-5 — the "Unknown direction" help sentence is MCP-voiced on a shape with no server.** Slack's
  row reads *"This server does not say whether this action only reads"*; a capability row has no
  server — the app's own descriptor is silent, and the copy should say so.
- ▪ **D-6 (out of 213's scope, recorded not routed)** — a run whose only phase `failed` on a refusal
  reports `run_completed` and status `completed`. The Phase-200 *"a paused run claimed it had
  finished"* family, in the harness's D-17 outcome mapping, not in anything 213 wrote.

### Not driven

- The **chat** path (Phase 216) — it does not exist yet; D-3 is the reason its floor could not be
  exercised.
- **Cloud.** Everything here is LOCAL. Migration 128 is applied to the local DB only — **cloud parity
  is owed before any deploy.**
