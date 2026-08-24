---
phase: 189
slug: governed-external-action-node-model
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 189 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Register provenance:** authored at plan time. All 16 plans (`189-01` … `189-16`) carry a
> parseable `<threat_model>` block; the consolidated register is 51 threats (`T-189-01` …
> `T-189-51`) plus a recurring `T-189-SC`. **No new threats were scanned for or added** —
> this audit verifies the declared register only.
>
> ⚠ **Every CLOSED verdict below cites a file:line the auditor read, or a command the auditor
> ran with its output.** A SUMMARY claim was treated as a claim, never as evidence. Where a
> summary asserted a grep count, that grep was re-run. Where a summary predated the
> standard-depth code review (8 commits, `b6225aec`..`653d05ca`), the threat was verified
> against **HEAD**, not against the summary prose.

---

## Verification method

| Disposition | How it was verified |
|---|---|
| `mitigate` (44) | The mitigation was located in the cited file at HEAD, read, and — where the plan claimed a mechanical guard — that guard was executed. A guard that exists but cannot fail was treated as OPEN. |
| `accept` (4: T-189-08, T-189-20, T-189-51, T-189-SC) | Entry present in the Accepted Risks Log below, plus a residual check where one was cheap (e.g. a secret-shaped-string sweep over the accepted doc). |
| `accept-and-inherit` (2: T-189-27, T-189-37) | Treated as `transfer`-shaped: the INHERITED control was located in shipped code and confirmed to cover the new type, rather than assumed. |

**Commands run for this audit (foreground, read-only — no `db push`, no `db reset`, backend not started):**

```
backend $ pytest tests/unit/test_189_no_egress.py tests/unit/test_189_external_action_model.py \
    tests/unit/test_103_grounding_fidelity.py tests/unit/test_185_detection.py \
    tests/test_migration_115.py tests/unit/test_publish_service.py -q
  → 138 passed

backend $ pytest tests/test_harness_engine.py tests/test_182_grounding_bundle.py \
    tests/test_182_extraction_parity.py -q
  → 2 failed, 57 passed          (both failures are the documented pre-existing
                                  `asyncpg … pool is closing` rows in
                                  test_182_grounding_bundle.py — NOT V22, which was
                                  re-run alone: 1 passed)

backend $ pytest tests/unit/test_185_engine_attachment.py -q      → 22 passed
backend $ pytest tests/test_migration_115.py -v                   → 3 passed (live :54322, not skipped)

frontend $ vitest run  phaseState · runVocabulary · phaseVocabulary · canvasModel ·
                       PhaseNodeCard · ExternalActionSection · PhaseFormPanel.rails ·
                       PhaseTimeline · phaseHooks                → 450 passed / 9 files
frontend $ vitest run  PhaseNode · canvasModel.purity · StepTypePicker · …
                                                                 → 485 passed / 4 files
frontend $ tsc --noEmit -p tsconfig.app.json                      → 33 errors (documented baseline;
                                                                    the max-2-badge @ts-expect-error
                                                                    control is in its NARROW state)
repo     $ node scripts/vitest-count-gate.cjs                     → count gate OK, 48/48 pinned,
                                                                    0 failing, total 2725
```

---

## The headline property (SC#4) — verified against HEAD, three ways

**SC#4: an `external_action` step RECORDS INTENT AND SENDS NOTHING.**

### (a) NO EGRESS — verified, and the sentinel is NON-VACUOUS

`_exec_external_action` (`backend/app/services/harness/phase_types.py:1810-1885`) was read end
to end. Its whole body is: a closed-set membership check, `_external_action_inputs`, a
`logger.info`, and a `return {...}`. **No transport identifier appears anywhere in the module** —
`grep -n "httpx|requests|smtplib|socket|urllib"` over `phase_types.py` returns zero hits outside
comments. There is no agent loop, no `tools_override` and no model call.

The sentinel `_block_all_http` (`backend/tests/unit/test_189_no_egress.py:84-144`) patches **five**
surfaces after review WR-03: `httpx.Client.send`, `httpx.AsyncClient.send`,
`smtplib.SMTP.__init__` (the **constructor**, so `SMTP_SSL`/`LMTP` inherit it),
`urllib.request.urlopen`, and `socket.socket.connect`. **Each has its own inertness control** —
`test_the_transport_patch_is_not_inert`, `…_async`, `test_the_smtp_patch_is_not_inert`,
`test_the_urllib_patch_is_not_inert`, `test_the_socket_patch_is_not_inert` (lines 266-338) — every
one of which drives a real call through the patched surface and requires `_EgressAttempted`. So the
fence **would** fail if a transport were added; it is not merely present. The `mcp` source fence
carries its own matcher control (`test_the_mcp_matcher_actually_matches`, line 206) that proves the
regex fires on `MCPClient` and does NOT fire on `mcpherson` — the plan's original `\bmcp\b` was
falsified by that control. All 138 backend cases green.

Live confirmation (189-VALIDATION.md, 2026-08-08 driven session): `workflow_phases.output` read
straight from the DB reads *"`NOT SENT — recorded only.` … `No email was sent. Nothing left this
workflow. This is a record of an intention, not a receipt.`"* with
`recorded_intent.capability = "send_email"`.

### (b) D-20 / D-22 — the capability names are NOT LLM-callable, and NOT on the rail

- `grep -c "send_email"` / `"create_ticket"` / `"post_message"` over
  `backend/app/services/tool_dispatcher.py` and `backend/app/services/openai_service.py` →
  **0 / 0** for all three, re-run by this audit.
- `grounding.py:481` — `tools=sorted(schema_tool_names)` where `schema_tool_names` is built from
  `get_tools(None)` only (line 439). The capability union goes **only** into `tool_names`
  (line 440/483), the fidelity membership set, never onto the wire rail.
- **V22** (`tests/test_182_grounding_bundle.py:289`) asserts `GroundingBundle.tools` is disjoint
  from `EXTERNAL_ACTION_CAPABILITIES`, guarded against vacuity by a non-emptiness assertion **and**
  a known-shipped-tool assertion (`search_documents`). Re-run alone by this audit: **1 passed**.
- `test_no_capability_is_a_dispatchable_tool_or_an_advertised_schema`
  (`test_189_no_egress.py:639`) checks BOTH `_TOOL_REGISTRY` and `get_tools()`, with
  `assert advertised` as its own non-vacuity floor.
- Author-facing rail: `PhaseFormPanel` mounts `ToolsField` under two mutually exclusive
  `pt === …` branches with **no default arm**, so `external_action` never reaches the generic
  rail — and this is now mechanically fenced by five cases in `PhaseFormPanel.rails.test.tsx`
  (all green), including a "no capability NAME anywhere in the panel HTML" case under three
  `toolOptions` shapes including `"degraded"`.

### (c) D-04 ARMING — coerces on every write path, and a LIVE run still pauses

`PhaseSpec._external_action_is_always_armed` (`backend/app/models/harness.py:407-461`) is a
`@model_validator(mode="after")` that COERCES `action_risk_armed` to `True` on an
`ExternalActionPhaseConfig`, membership tested by `isinstance` (not a re-typed string).

**The "all six write paths converge" claim was independently re-derived rather than inherited.**
Every write route in `backend/app/api/workflows.py` declares `body: WorkflowDefinition` —
`validate_workflow:606`, `create_draft:983`, `update_draft:1049` — and the remaining paths parse
explicitly: `publish_service.py:144`, `harness_engine.py:1958`, `workflow_kickoff.py:231`. The NL
generator's output is re-parsed by the same model (`workflow_authoring.py:11,137`). A `PhaseSpec`
validator is therefore the narrowest scope no path bypasses.

Live confirmation: the driven session recorded a **live (non-golden) run PAUSING at `act`** with
the approval prompt, while golden runs auto-continued (`0s → 69s → 150s` trace) — both halves of
D-19/D-04 observed on real runs.

---

## ⚠ CR-01 — re-verified at HEAD, and the fix is fail-closed BY CONSTRUCTION

The standard-depth review's blocker CR-01 found that the D-20 widening was **unconditional** and
`_unregistered_tools` carried **no `phase_type` term**, so
`{"phase_type": "llm_agent", "available_tools": ["send_email"], "action_risk_armed": false}`
parsed, passed stage 2.6 and **published clean**. Plans `189-04` and `189-07` had both recorded
T-189-05 / T-189-10 / T-189-12 as *mitigated*, with grep counts as evidence. Those summaries were
therefore **not accepted**; the family was re-verified against HEAD.

**HEAD is fail-closed by construction, not by an added condition** —
`backend/app/services/harness/grounding.py:750-757`, read by this auditor:

```python
allowed = set(tool_names) - EXTERNAL_ACTION_CAPABILITIES
if getattr(phase.config, "phase_type", None) == "external_action":
    allowed |= EXTERNAL_ACTION_CAPABILITIES
```

The **subtraction happens first**, so the answer does not depend on what the caller passed: a
caller handing in a set that already contains the capabilities cannot widen a non-external type by
accident, and the strictly narrower set is the **default**. The rule itself was not weakened —
rule 2 fires on every name it ever fired on, and now on three MORE names for six of the seven
types. The negative control `test_a_capability_on_an_llm_agent_step_still_blocks_publish` was
added by the fix round (observed RED against the unfixed source per `189-REVIEW-FIX.md`) and is
green in this audit's run.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| author-supplied definition JSONB → `WorkflowDefinition.model_validate` | The ONE chokepoint all six write paths share (3 API routes + publish + engine + kickoff, each re-derived above) | untrusted `capability`, `available_tools`, `action_risk_armed`, `phase_type`, `slug` |
| `GET /workflows/grounding-bundle` → `PhaseFormPanel` `toolOptions` | The server decides which tool names an author may tick on ANY step. **Widening it widens what an UNARMED step may do** — the D-20 hole | tool-name list (narrow: `sorted(schema_tool_names)`) |
| `external_action` step → the network | **The boundary this phase exists to keep shut.** SC#4: no outbound egress ships here | nothing — zero transports reachable |
| `config.available_tools` → `ToolContext.phase_whitelist` → `dispatch_tool` | The shipped run-time enforcement point D-03 rides (unchanged by this phase) | tool names; off-whitelist → refusal + `tool_refused` audit |
| the publish HTTP request → the stage-3 golden run → the ask_user channel | A synchronous request blocking on a channel that has no human behind it | approval prompt / (on a golden run: nothing) |
| engine → `public.workflow_phases.status` | The CHECK constraint is the closed vocabulary; an unlisted value is a mid-run 23514 | the `recorded_not_sent` SLUG (never the rendered sentence) |
| engine → `harness_audit` | Receipts here are the ledger's record of what happened | `phase_transition` (`via: recorded_not_sent`); **no** `phase_completed`, **no** approval receipt on a golden run |
| server SSE → client store | An untyped `str` status / a new event type enters client type-space | `phase_recorded_not_sent` (CR-02, additive) |
| object-literal lookup ← user-influenceable key | `constructor` / `toString` / `__proto__` are INHERITED, never nullish, so `?? fallback` does not fire (WR-04) | phase status, ring reading, capability, phase_type, panel status |
| test process → local Postgres `:54322` | Every write inside a transaction proved to roll back (`workflow_phases` 439 rows before and after) | fixture rows only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation — evidence read/run by this audit | Status |
|-----------|----------|-----------|-------------|-----------------------------------------------|--------|
| T-189-01 | Elevation of Privilege | `PhaseSpec.action_risk_armed` (T2 — the D-04 disarm paths) | mitigate | `models/harness.py:407-461` — `@model_validator(mode="after")` coerces to `True` via `isinstance`. All six write paths re-derived (`api/workflows.py:606,983,1049`; `publish_service.py:144`; `harness_engine.py:1958`; `workflow_kickoff.py:231`). `test_action_risk_armed_cannot_be_stored_false_on_this_type` + `test_a_shipped_type_may_still_be_unarmed` (negative control) green. Client half: the arming switch is `disabled`+`aria-disabled` with a driven-click test. **Live: a non-golden run PAUSED at `act`.** | closed |
| T-189-02 | Tampering | dynamic resolution of an author-supplied `capability` | mitigate | `models/harness.py:251` — `capability: Literal["send_email","create_ticket","post_message"]`; `_StrictBase` `extra="forbid"` (`:38-41`). Second line of defence at `phase_types.py:1868` raises `KeyError` on a name absent from the closed set — never `eval`'d, never defaulted. `test_a_capability_outside_the_closed_set_is_refused` + `test_a_capability_outside_the_closed_set_raises_in_the_executor` green. | closed |
| T-189-03 | Information Disclosure | outbound egress from `_exec_external_action` (**SC#4**) | mitigate | See §(a). Executor read at `phase_types.py:1810-1885` — zero transports. Five-surface sentinel with **five independent inertness controls** (`test_189_no_egress.py:266-338`). `mcp` source fence + matcher control. Live-observed not-sent output. | closed |
| T-189-04 | Tampering | the test suite mutating the operator's local dev data | mitigate | `tests/test_migration_115.py:191,214,237-258` — outer `conn.transaction()` + `await tx.rollback()`, nested savepoint for the deliberate-failure branch with `inner.rollback()`. No `db push`, no `db reset`. Row count 439 before/after (recorded, and this audit ran the suite: 3 passed). | closed |
| T-189-05 | Elevation of Privilege | capability → `GroundingBundle.tools` / `get_tools()` / `_TOOL_REGISTRY` / the rail (**T1 — the D-20 hole**) | mitigate | See §(b). `grounding.py:481` narrow rail; `:439-440` union into `tool_names` ONLY. V22 re-run **1 passed**, non-vacuity floors read. `grep -c` on the three names over `tool_dispatcher.py`/`openai_service.py` → **0/0/0**. `test_no_capability_is_a_dispatchable_tool_or_an_advertised_schema` green. Panel rail fenced (5 cases green). | closed |
| T-189-06 | Denial of Service | the publish request thread on an armed phase | mitigate | `harness_engine.py:836-846` — the golden-run branch is a `logger.info` ONLY; no `subscribe_for_response`, no ask-channel contact. `test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run` + `test_an_armed_definition_reaches_the_stage_3_golden_run` green. Live: golden runs completed in 150 s (pre-fix: died at 7200 s). | closed |
| T-189-07 | Repudiation | a receipt written when no human was asked (D-19's rejected Option C) | mitigate | `harness_engine.py:838-846` — the branch writes NO `write_audit` and NO `_emit`; the comment records *"harness_audit is the ledger of things that HAPPENED to a person, and on a golden run nobody was asked."* `test_a_golden_run_writes_no_approval_and_no_pending_receipt` green. | closed |
| T-189-08 | Information Disclosure | `docs/CONNECTOR-ARCHITECTURE.md` is repo-visible | **accept** | Logged as `AR-189-01`. Residual check run anyway: `grep -niE "api[_-]?key\|secret\|password\|token *=\|\.internal\|Bearer "` over the 9.2 KB file → **zero hits**. No credential, endpoint, key or internal hostname. | closed |
| T-189-09 | Tampering | `CLAUDE.md` is a binding project-rules file | mitigate | `git show --stat 7b0e3e10 -- CLAUDE.md` → **`1 +`**. The full-phase diff shows `2 insertions, 1 deletion`; the second hunk was read and is Phase **188.2**'s hot-file-ledger row, not 189's. No reflow. | closed |
| T-189-10 | Elevation of Privilege | stage-2.6 rule 2 WEAKENED rather than widened | mitigate | `grounding.py:750-757` — subtract-then-conditionally-add. **Nothing is let through by the type test**; the narrower set is the default and rule 2 now fires on three MORE names for six of seven types. Negative control `test_a_capability_on_an_llm_agent_step_still_blocks_publish` green (added by CR-01, observed RED against the unfixed source). | closed |
| T-189-11 | Tampering | a second copy of the closed set drifting | mitigate | ONE Python home: `grounding.py:961`. Cross-module agreement test `test_the_literal_and_the_runtime_frozenset_are_the_same_closed_set` green. Cross-**language** fence: `ExternalActionSection.test.tsx:32` imports `backend/app/models/harness.py?raw` and asserts equality with the client tuple, with a falsifiable extractor control at `:440`. Both green. | closed |
| T-189-12 | Spoofing | a capability colliding with a KB tool and arming the grounding dial | mitigate | `grounding.py:966-968` — a **module-level `assert`** that `EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS == frozenset()`, i.e. an import-time failure, not a comment. `test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools` green; `test_185_detection.py:294` asserts `grounding_cause is None` over the whole capability SET. | closed |
| T-189-13 | Repudiation | a shipped docblock asserting a governance identity no longer true | mitigate | `git show --stat 44092d43` → `grounding.py` + its test only, in the SAME commit as the change that falsified the prose; 3 `⚠ CORRECTED` markers. `grounding.py:110,421-431,504-507` read — the wrong paragraphs are quoted, not deleted. | closed |
| T-189-14 | Elevation of Privilege | the golden-run branch loosening arming on LIVE runs | mitigate | `harness_engine.py:847-889` — the live path is an `elif _armed:` that still writes `action_risk_pending` and calls `_resolve_failure_with_ask_user`. **No mutation of `action_risk_armed` anywhere in the branch.** `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` + `test_the_armed_golden_run_subscribe_carries_the_indefinite_wait` green. Live-observed pause. | closed |
| T-189-15 | Spoofing | "skip the pause" becoming "skip the step" | mitigate | `test_the_armed_step_still_runs_on_a_golden_run` green. `test_a_golden_run_of_an_external_action_performs_no_egress` (`test_harness_engine.py:1106`) carries anti-vacuity assertions that the step RAN, RECORDED, and the run continued past it. | closed |
| T-189-16 | Tampering | coupling the run-time armed reader to the boot-time resume predicate | mitigate | `git log -L 2436,2470:backend/app/services/harness_engine.py` → last touch is **`a4010b46` (Phase 185)**; `_is_armed_action_risk` is textually untouched by 189. `test_the_two_resume_predicates_are_independent` (`test_185_engine_attachment.py:871`) green — 22 passed. | closed |
| T-189-17 | Tampering | the operator's local dev data (the migration apply) | mitigate | Blocking human checkpoint honoured; `supabase db push` / `db reset` named as forbidden in the migration header and never run by any agent. Applied verbatim in ONE psycopg2 transaction against `127.0.0.1:54322` with operator authorisation, deviation recorded in 189-06 rather than smoothed. Proved by DATA: `workflow_phases` **439 rows before and after**. | closed |
| T-189-18 | Tampering | `workflow_phases_status_check` losing a shipped literal in the DROP+ADD | mitigate | Migration file read: all five shipped literals (`pending`, `active`, `completed`, `failed`, `skipped`) present in the re-added constraint plus the sixth. `test_the_five_shipped_statuses_are_all_still_admitted` **PASSED** against the live DB. | closed |
| T-189-19 | Spoofing | the display sentence entering the constraint (the D-17 trap) | mitigate | `grep -c "Not sent" supabase/migrations/115_*.sql` → **0** (re-run). `test_the_display_sentence_is_rejected` **PASSED** — the rendered sentence is refused with SQLSTATE 23514. | closed |
| T-189-20 | Denial of Service | ACCESS EXCLUSIVE lock from mig-115 DROP+ADD | **accept** | Logged as `AR-189-02`. Immaterial on local dev. Review WR-01 additionally wrapped the pair in `BEGIN`/`COMMIT` with `DROP … IF EXISTS`, so the window is now atomic and the re-paste idempotent — verified by reading the file. Cloud apply deferred to the standing parity window. | closed |
| T-189-21 | Tampering | a hand-edited `full-schema.sql` | mitigate | Produced by `scripts/regenerate-full-schema.sh` in DEFAULT mode (no `--reset`) — commit `8b8c393e`. Diff is ONE line; verified present at `supabase/full-schema.sql:1932` carrying exactly the six literals. Never hand-edited. | closed |
| T-189-22 | Denial of Service | a strict RAISE bricking a stored workflow | mitigate | `models/harness.py:417-424` — the validator COERCES (fail-CLOSED: it ARMS) and the docblock carries an explicit *"Do not 'tighten' this into a raise later"*. Verified by reading; `test_a_pre_189_row_still_validates` green. | closed |
| T-189-23 | Spoofing | an unrecognised `workflow_phases.status` read as success | mitigate | `lib/phaseState.ts:100` — own-property guard returns `"unknown"`; `:181-182` — `canvasReading`'s `default: return "unknown"` floor. Both surfaces fail CLOSED. Client tests green (450 passed). Canvas word asserted `!== "Complete"`; the new ring asserted distinct from `done` by arc count. | closed |
| T-189-24 | Tampering | prototype pollution through the lookup tables (**WR-04**) | mitigate — **the four NAMED sinks are closed; see the note below on `BUG-260808-01`** | All named sinks read at HEAD and each `Object.prototype.hasOwnProperty.call`-guarded: `phaseState.ts:100` (`DB_PHASE_STATUS`), `runVocabulary.ts:104` (`RING_GEOMETRY`/word tables, module-private `own()` deliberately NOT merged), `phaseVocabulary.ts:689` (`EXTERNAL_CAPABILITY_SENTENCES`, inline form — the file keeps zero imports), `canvasModel.ts:353` (`PHASE_TYPE_SUBTITLES` — the one that was UNGUARDED at HEAD, fixed in the same commit as its 7th key). Bonus sink from WR-05: `panel/phaseStatusMeta.ts:130`. `"constructor"` probes green across all. | closed |
| T-189-25 | Repudiation | a second, local derivation of the status rule drifting | mitigate | The DB-slug→client-status derivation exists **exactly once**: `lib/phaseState.ts:69`. ⚠ The literal grep count moved from 1 to 4 after the summary was written (CR-02 added the SSE event name `phase_recorded_not_sent` at `api.ts:943` plus two comment references) — re-derived by this audit. The PROPERTY holds: `api.ts:943` maps a WIRE EVENT to a callback (a different mapping, following the shipped `phase_failed` precedent) and `StreamsProvider.tsx:1021-1024` is the sibling of `onPhaseCompleted`/`onPhaseFailed`, not a second slug derivation. | closed |
| T-189-26 | Repudiation | a recorded intent that reads like a receipt | mitigate | `test_the_recorded_output_body_cannot_read_as_a_receipt` (×3 capabilities) green, with `test_the_receipt_fence_actually_fires` as its **six-plant positive control** — the fence is proved to bite. Live output read from the DB opens with the negation and closes *"a record of an intention, not a receipt."* | closed |
| T-189-27 | Spoofing | a client lying about a phase's tools | **accept-and-inherit** | Inherited control located, not assumed: `tool_dispatcher.py:4142` — `if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:` refuses, and `_spawn_tool_refused_audit` (`:4049-4078`) writes the `tool_refused` row. The whitelist is re-read SERVER-SIDE. Strengthened by D-03 total replacement (`models/harness.py:267-279`): a lying list is strictly NARROWER. | closed |
| T-189-28 | Tampering | the NL generator emitting a malformed `external_action` phase | mitigate | `workflow_authoring.py:80` — ONE length-bounded prompt bullet; `:11,137` record that Pydantic re-applies the discriminator at `model_validate`, "the real strict gate", where `_StrictBase`, the `Literal` and the D-04 pin all apply. Live: the generator placed the type correctly on a real request and its output validated. | closed |
| T-189-29 | Repudiation | a BUILD CRITERION silently reduced to seven-of-eight | mitigate | `runVocabulary.ts:44,181,204,347,357` — the eighth uniqueness bullet is in the docblock's enumerated list, and the tiling + arc-count uniqueness are asserted over the WHOLE table. `runVocabulary.test.ts` green. Live-confirmed: dasharray `32.044 21.363 ×4`, dashoffset **16.022**, `animationName: none`. | closed |
| T-189-30 | Tampering | the fenced card subtree gaining a 7th file / losing coverage | mitigate | `PhaseNodeCard.test.tsx:104` declares the list; `:553` — `expect(CARD_SUBTREE_PATHS).toHaveLength(6)` — re-read, unmoved, and `:560` names the five destinations individually so a swap cannot pass the length pin. Green in this audit's run. | closed |
| T-189-31 | Repudiation | a `phase_completed` receipt for a phase that RECORDED | mitigate | `harness_engine.py:1798-1825` — the `elif _recorded_intent:` branch writes `phase_transition` with `via: "recorded_not_sent"` and **never** `phase_completed`; the `else:` at `:1861` is the only site that does. `test_a_recorded_not_sent_phase_writes_no_phase_completed_receipt` green. Live event stream shows event 5 = `phase_recorded_not_sent`, and no `phase_completed` for `act`. | closed |
| T-189-32 | Spoofing | a governed step silently SKIPPED rather than run | mitigate | `test_an_approved_external_action_records_not_sent_and_the_run_continues` green — asserts BOTH that the next phase ran AND that the external-action phase reached `recorded_not_sent`. Live: `retrieve=completed · act=recorded_not_sent · emit=completed · run=completed`. | closed |
| T-189-33 | Tampering | a non-atomic status+output write stranding a phase | mitigate | `db/workflows.py:1043-1047` — read: ONE `pool.execute`, ONE `UPDATE` setting `status`, `output` and `updated_at` together, `WHERE id = $1`. Copies `complete_phase`. Resumability invariant intact. | closed |
| T-189-34 | Denial of Service | a mid-run 23514 because the status is unlisted | mitigate | `tests/test_migration_115.py` **PASSES (3), does not skip** — verified with `-v` against the live DB. Python literal (`db/workflows.py:1044`) and SQL literal (`115_*.sql`) both `recorded_not_sent`, compared here. Live: `act` persisted as `recorded_not_sent` on every run. | closed |
| T-189-35 | Tampering | the sentinel key colliding with a Deep output key | mitigate | `harness_engine.py:1744-1755` — `elif _recorded_intent:` sits between the emit-failure branch and the `else: complete_phase`, so an output with no sentinel key routes to `complete_phase` unchanged. `RECORDED_INTENT_KEY` is IMPORTED (`:1742`), never re-typed. `test_an_output_with_no_sentinel_still_routes_to_complete_phase` green. Deep path byte-identical. | closed |
| T-189-36 | Tampering | the client type mirror drifting from the backend union | mitigate | `definitionOps.ts:67` — *"⚠ THIS IS A MIRROR. The client MIRRORS the server's closed set and never defines it."* A `?raw` fence asserts the client union equals `harness.py`'s `phase_type` literals IN ORDER, with a non-vacuity check on the read. Green. | closed |
| T-189-37 | Spoofing | a client-assembled config bypassing server validation | **accept-and-inherit** | Inherited control located: `minimalPhaseFor` (`definitionOps.ts:1024`) produces a FRAGMENT; every write re-parses through `WorkflowDefinition` (six paths re-derived above) where `_StrictBase`, the `Literal` and the D-04 pin apply. Strengthened: `requiredConfigFor` emits `capability` only — `not.toHaveProperty("available_tools")` asserted (green). | closed |
| T-189-38 | Repudiation | shipped prose asserting a reservation/count that no longer exists | mitigate | `PhaseNode.tsx:206-219` — the slot-1 reservation paragraph is corrected IN PLACE with the old sentence quoted. `git show --stat c842d9dd` → 9 files, both guards REWRITTEN (not deleted), each with a positive control. `PhaseNodeCard.tsx:41`, `phaseNodeCardContract.ts:12` likewise corrected. | closed |
| T-189-39 | Spoofing | a fabricated face claiming a capability the step does not have | mitigate | `phaseVocabulary.ts:689-691` — an unrecognised/inherited capability fails the own-guard and falls THROUGH to the type sentence; it never fabricates. Picker half: an unrecognised stored value selects NO row. `phaseVocabulary.test.ts` + `ExternalActionSection.test.tsx` green. | closed |
| T-189-40 | Elevation of Privilege | `external_action` joining `GROUNDING_DIAL_TYPES` | mitigate | `phaseVocabulary.ts:313` read at HEAD — `["llm_agent", "llm_batch_agents"]`, unchanged; `:310` records it is READ and NEVER edited. Backend has no such constant (grep → 0). `test_185_detection.py:294` asserts `grounding_cause is None` for the whole capability set. Green. | closed |
| T-189-41 | Denial of Service | a missing icon slug / split-brain between the two glyph maps | mitigate | `PhaseNodeCard.test.tsx:809,819` — `Object.keys(ICON_TINT).length === Object.keys(PHASE_GLYPHS).length` plus a per-key loop, so a one-sided addition fails. Green. Slug verified against the INSTALLED `@iconify-json/fluent-emoji@1.2.7` (not a network lookup) and `vite build` was run as an acceptance criterion, failing under a planted missing slug. | closed |
| T-189-42 | Repudiation | a refusal reason delivered as a `title`, unreachable to a screen reader | mitigate | `GovernanceSection.tsx:284,361` — `aria-describedby={refused ? reasonId : undefined}`; the reason is real DOM text. `grep -n "title="` over the section → **zero**. Tests green. Live-driven: the switch reads `role="switch" aria-checked="true" aria-disabled="true"` and visibly refuses a real click. | closed |
| T-189-43 | Tampering | the component authoring its own sentences | mitigate | `ExternalActionSection.tsx:64-65` — every user-visible string is an IMPORTED identifier (`EXTERNAL_CAPABILITY_SENTENCES`, `definitionOps`). A `?raw` fence (`:27`) asserts the component names no API route and contains none of the sentences it renders, with a positive control block. `grep` for `fetch(` / `/workflows` in the component → zero. Green. | closed |
| T-189-44 | Tampering | a spread silently retiring the max-2 badge typecheck guard | mitigate | `PhaseNode.tsx:252-270` read — **explicit nested ternaries, no `...` anywhere** in the `badges: BadgeSlots` expression, with the reason stated inline. A source fence asserts no spread. `tsc --noEmit -p tsconfig.app.json` re-run by this audit → **33**, i.e. the `@ts-expect-error` control is in its narrow state (34 with the union widened). | closed |
| T-189-45 | Elevation of Privilege | a focusable control entering the card | mitigate | `PhaseNode.tsx:245-250` — the badge is a plain `BadgeSlot` data object (`testId`/`tone`/`label`/`dataAttr`): no role, no tabindex, no handler. The card suite's leaf walk (driven RED against a planted `<button>` in a real destination module at 188.2) re-runs green. Live-driven: `querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')` inside the card → **0**. | closed |
| T-189-46 | Spoofing | a badge asserting something untrue of the step it sits on | mitigate | `phaseVocabulary.ts:810` — `notConnectedOf` keeps its type test and state test on **separate lines** so Phase 190 retires the badge by DATA, not by edit (`PhaseNode.tsx:229-238` records this). Driven ABSENT on all six shipped types at both the projection and rendered-canvas level; green. | closed |
| T-189-47 | Tampering | building an unreachable ghost-detour edge from a stale docblock (D-21) | mitigate | `git show --stat` over every 189 commit for `FlowEdge.tsx` → **no commit touches it; the diff is EMPTY**, re-derived by this audit. The correction is prose-only in `c842d9dd` (`⚠ CORRECTED at 189-15 (D-21)`), and the state is unreachable by construction. | closed |
| T-189-48 | Tampering | a future executor authoring a COLLIDING migration from a stale head figure | mitigate | `.planning/ROADMAP.md:36` corrected against a re-derived `ls supabase/migrations/ | tail -1` → `115_workflow_phases_recorded_not_sent.sql`; live head **115**, next free slot **116**. Confirmed by this audit's own `ls`. The letter-suffix hazard (`114b` silently skipped by the CLI) is stated. | closed |
| T-189-49 | Spoofing | a visual claim asserted from a green unit suite | mitigate | 189-VALIDATION.md §"THE OWED ROWS, DRIVEN" — U1–U7 driven via Chrome MCP on a live stack. **U2's falsification control was observed swinging BOTH ways** (a `zIndex 99999` plant flipped `badgeReachable` true→false, removal flipped it back). U3's greyscale half driven on a real run. | closed |
| T-189-50 | Repudiation | an owed row silently dropped so the board reads all-green | mitigate | Every row carries PASS / FAIL / BLOCKED with a reason. **`BUG-260807-01`'s row is recorded ⛔ FAIL** with its named successor, not dropped — the exact behaviour this threat demanded. Owed rows were carried explicitly across two sessions before being discharged. | closed |
| T-189-51 | Tampering | the driven UAT session mutating the operator's environment | **accept** | Logged as `AR-189-03`. Local dev only; all `workflow_definitions` rows are project-declared test fixtures; the `constructor`-slug fixture was **deleted afterwards**; no global setting changed; no cloud environment touched. | closed |
| T-189-SC | Tampering | npm / pip / cargo installs | **accept** | Logged as `AR-189-04`. **189 installs nothing** — re-checked: no lockfile or `requirements.txt` change in any 189 commit; the icon is a slug inside the already-installed `@iconify-json/fluent-emoji@1.2.7`, confirmed by reading the installed icon data. No install task exists, so no legitimacy checkpoint is owed. | closed |

**Totals — 51 threats + T-189-SC: 52 closed, 0 open.**

---

## Unregistered flags (WARNING — not blockers)

Every `## Threat Flags` section in `189-01` … `189-15`-SUMMARY.md declares **"None."** That is
correct as of when each was written — but **all fifteen predate the standard-depth code review**
(`b6225aec`..`653d05ca`), which shipped behaviour. The following surface arrived after the last
Threat Flags section and therefore has **no authored threat row**. None is a blocker; each is
recorded so it cannot read as absent.

| Flag | New surface | Where it landed | Why not a blocker |
|---|---|---|---|
| `UF-189-01` | **A new SSE event type, `phase_recorded_not_sent`**, crossing the server→client boundary, plus an `api.ts` dispatch branch and a `StreamsProvider` handler | `harness_engine.py:1856-1860`; `lib/api.ts:943`; `StreamsProvider.tsx:1021-1024` (CR-02, commit `11a2fa69`) | Additive and inert for an older client (`api.ts` dispatches on an else-if chain). Carries no new `harness_audit` kind and no CHECK migration, so the D-09 receipt argument is untouched. Fenced producer-side (`test_a_recorded_not_sent_phase_emits_its_own_live_event`) and end-to-end (`phaseHooks.test.tsx`, raw SSE → real `subscribeToRun` → real handler → store, observed RED at `'done'`). Live-verified on two runs. |
| `UF-189-02` | **A keyboard handler on the capability picker** — roving tabindex, Arrow/Home/End, `preventDefault` on handled keys | `ExternalActionSection.tsx` (WR-04, commit `8e208fdd`) | Client-side focus management only; no data path, no route, no privilege. Nine cases, 7 observed RED against the unfixed component; the two green-either-way cases are the negative controls (`Tab` not `preventDefault`ed; an unhandled key writes nothing). Live-driven APG behaviour confirmed. |
| `UF-189-03` | **A new module carrying a status lookup table**, `panel/phaseStatusMeta.ts` | WR-05, commit `1f43e9ec` | The move was proved byte-identical modulo two `export` keywords. Its `statusMeta` is own-property guarded (`:130`) and `statusWord` routes through it rather than indexing the table, so the WR-04 class is covered at birth. Outside `CARD_SUBTREE_PATHS`, so T-189-30's fence coverage is unaffected. |
| `UF-189-04` | **A seventh WR-04 sink** — the slug-keyed node-position lookup — found by driving | `BUG-260808-01` (filed 2026-08-08, `status: open`, `severity: minor`) | **See the T-189-24 note below.** Already filed with reproduction, a control observed both ways, and a named root enabler. Not silent, and not a defect in a mitigation T-189-24 names. |

---

## ⚠ T-189-24 vs `BUG-260808-01` — the judgement, with evidence

**Verdict: T-189-24 is CLOSED. `BUG-260808-01` is a distinct, already-filed sink, not a failure of
T-189-24's declared mitigation.** The reasoning, stated so it can be checked rather than trusted:

1. **T-189-24 names its sinks.** Across the four plans that carry it, the threat names exactly
   four: `DB_PHASE_STATUS[raw]` (189-08), `RING_GEOMETRY[reading]` (189-10), and the
   capability-sentence + subtitles lookups (189-13). All four were read at HEAD by this audit and
   all four are `Object.prototype.hasOwnProperty.call`-guarded — `phaseState.ts:100`,
   `runVocabulary.ts:104`, `phaseVocabulary.ts:689`, `canvasModel.ts:353` — with `"constructor"`
   probes green in a suite this audit ran.
2. **`BUG-260808-01`'s sink is none of those four.** It is the node-**position** lookup keyed by
   phase slug, in the canvas layout path. It was not in scope of any 189 plan and no 189 threat
   row names it.
3. **The neighbouring guard HELD.** `BUG-260807-01`'s `own()` guard on `verticalOffsetFor` was
   re-measured during the same driven session: `transformHasNaN: false` on every node and every
   affordance, **including the `constructor` one**. Nothing regressed.
4. **The failure mode differs.** `BUG-260807-01` produced a `NaN` term (an *invalid* transform);
   this one produces an *absent* transform. Same visible symptom, different mechanism.
5. **Blast radius is presentational.** A mispositioned, overlapping card. No privilege
   escalation, nothing leaked, no data path. Filed `minor`.
6. **The root enabler is named and outside this phase's register**: the phase `slug` is
   unconstrained end to end (`backend/app/models/harness.py:202` declares a bare `slug: str` with
   no pattern and no reserved-word list; `058_workflow_phases.sql:18` is `text NOT NULL`). Guarding
   sinks one at a time has now cost three reports (`BUG-260806-01`, `BUG-260807-01`,
   `BUG-260808-01`).

> **Recommendation carried forward, not silently absorbed:** the durable fix for this class is a
> `slug` constraint at the model, not a seventh call-site guard. That belongs to a phase, not to
> this audit, and is left with `BUG-260808-01` as its home. **This audit does not open a threat
> row for it** — `register_authored_at_plan_time` is true and the register is closed.

---

## `D-189-DEF-04` — the deferred golden-run risk, verified as properly deferred

WR-06 found that the golden-run branch bypasses the D-04 checkpoint **unconditionally, with no
phase-type term** — inert in 189 (nothing is sent) but live the day Phase 190 makes a capability
real, at which point *publishing* a workflow would perform the external action.

The review's proposed fix (a synthesized `PhaseOutcome`) was deliberately **NOT** taken; the
departure is argued in `189-REVIEW-FIX.md` and `deferred-items.md` rather than silent. This audit
verified the deferral is a **guarded** decision, not a remembered one:

- The decision, the rejected shape and the owner are recorded at `deferred-items.md`
  §`D-189-DEF-04` **and** in the branch comment itself (`harness_engine.py:802-835`), which names
  `external_action`, names Phase 190 as owner, and names the two admissible fix shapes.
- **The re-open trigger is a CHECK, not prose:**
  `tests/test_harness_engine.py:1106::test_a_golden_run_of_an_external_action_performs_no_egress`
  drives a REAL golden run with the WR-03-widened sentinel armed (imported from the no-egress
  suite rather than re-typed, so a future widening strengthens it automatically), with anti-vacuity
  assertions that the step ran and recorded. **Green in this audit's run.** It was driven RED
  against a planted `smtplib.SMTP(...)` inside `_exec_external_action`
  (`_EgressAttempted: smtplib.SMTP.__init__ was called`), so the fence is proved to bite.

**Disposition: accepted-and-deferred with a mechanical trigger.** Logged as `AR-189-05`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-189-01 | T-189-08 | `docs/CONNECTOR-ARCHITECTURE.md` is repo-visible. It records an architecture verdict already present in `.planning/` seeds and research. CONN-03's credential model is explicitly out of scope (Phase 190's). Residual sweep for secret-shaped strings (api key / secret / password / token= / .internal / Bearer) returned **zero hits** over the 9.2 KB file. | Phase 189 plan `189-03` (`<threat_model>`) | 2026-08-07 |
| AR-189-02 | T-189-20 | The ACCESS EXCLUSIVE lock taken by migration 115's DROP+ADD CONSTRAINT. Immaterial on local dev. On cloud it belongs in the standing migration-parity window (migs 099 onward land together), not mid-traffic; the migration header records this and the checkpoint text forbids applying to cloud in this phase. Review WR-01 further made the window atomic (`BEGIN`/`COMMIT`) and the re-paste idempotent (`DROP … IF EXISTS`). | Phase 189 plan `189-06` (`<threat_model>`) | 2026-08-07 |
| AR-189-03 | T-189-51 | The driven UAT session creates workflow and run rows in the LOCAL dev database. All `workflow_definitions` rows in this project are treated as test fixtures and are free to delete or reseed (standing project fact). The `constructor`-slug fixture was deleted after the row. No global setting changed; no cloud environment touched. | Phase 189 plan `189-16` (`<threat_model>`) | 2026-08-08 |
| AR-189-04 | T-189-SC | **Phase 189 installs nothing** — no npm package, no pip dependency, no shadcn block, no registry fetch. The only registry-adjacent item is an icon slug inside the already-installed `@iconify-json/fluent-emoji@1.2.7`, confirmed by reading the installed icon data rather than by a network lookup. No install task exists in any of the 16 plans, so no package-legitimacy checkpoint is owed. | `189-RESEARCH.md` § Package Legitimacy Audit; every plan's `<threat_model>` | 2026-08-07 |
| AR-189-05 | `D-189-DEF-04` (review WR-06) | The publish golden run executes the `external_action` body with the D-04 checkpoint skipped, unconditionally and with no phase-type term. **Inert in 189** — the step sends nothing and the phase row still lands `recorded_not_sent`. It stops being inert the day Phase 190 makes a capability real. Accepted for this phase with a mechanical re-open trigger (a test that goes RED on the exact commit that adds real egress) rather than a calendar date. Owner: Phase 190; two admissible fix shapes named on the branch comment. | `189-REVIEW-FIX.md` (fixer, argued departure) + `deferred-items.md` §D-189-DEF-04 | 2026-08-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Known operational gaps (recorded, not findings)

| Gap | Status |
|---|---|
| **Cloud parity is OWED.** Migration **115** is applied to the LOCAL database only. The standing parity queue is migs **099 → 115** plus `SECRETS_ENCRYPTION_KEY`, to be applied in order at the next production push. | Known and recorded (CLAUDE.md standing rule + the migration file's own header). Not a Phase 189 finding. |
| **Approve-control wording.** The live armed checkpoint's button reads *"Approve and run this step"*, but by this phase's contract that step never runs anything outward. Recorded during the driven session as a wording concern, not filed as a bug; flagged for review **with Phase 190**, when the same button WILL cause a send. | Recorded in `189-VALIDATION.md`. Not a threat-register gap; no threat row covers copy. |
| **Two authoring defects found during UAT** (⑂ Tweak fails with a silent 409; the LOOSE "Describe & run" door never persists `business_requirement`, so nothing it creates can be published). Neither is a Phase 189 regression. | Recorded in `189-VALIDATION.md`. Outside this register. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 52 (51 + T-189-SC) | 52 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate 44 · accept 4 · accept-and-inherit 2)
- [x] Every `mitigate` threat verified against **HEAD**, with a file:line read or a command run — no SUMMARY claim accepted as evidence
- [x] The CR-01 family (T-189-05 / T-189-10 / T-189-12) re-verified after the code review, and confirmed **fail-closed by construction** (subtract-then-conditionally-add, `grounding.py:750-757`)
- [x] The SC#4 no-egress sentinel confirmed **NON-VACUOUS** — five patched surfaces, five independent inertness controls, plus a `mcp`-matcher control
- [x] Accepted risks documented in the Accepted Risks Log (AR-189-01 … AR-189-05)
- [x] Unregistered flags recorded (UF-189-01 … UF-189-04) — all post-review surface, none a blocker
- [x] `threats_open: 0` confirmed
- [x] No implementation file was modified by this audit
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08
