---
phase: 185
slug: graded-governance-per-node-grounding-mode-action-risk-dial
status: blocked
threats_open: 1
asvs_level: 2
created: 2026-07-31
---

# Phase 185 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Verdict: BLOCKED.** 48 of 49 plan-time threats verified CLOSED against the implementation.
One BLOCKER open: **T-185-04-01** — a typed refusal on an armed action-risk checkpoint executes
the action and writes a false approval receipt.

Register origin: `register_authored_at_plan_time: true` — all 13 plans carried a `<threat_model>`
block. The auditor verified mitigations against source; no SUMMARY claim was accepted as evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → `PATCH /workflows/{id}` | Governance booleans arrive inside an author-supplied definition JSONB, parsed by an `extra="forbid"` Pydantic model. | `grounding_escalated`, `action_risk_armed` (booleans only — `detected` has no field and is unrepresentable) |
| server → client `GET /workflows/grounding-bundle` | The KB tool list leaves the server for DISPLAY only; it drives no enforcement. | `kb_tools` — fixed 5-element constant of public tool names |
| stored definition JSONB → engine | An author-controlled definition is parsed and executed. This is where "the author cannot loosen the gate" becomes enforceable. | `PhaseSpec.validators`, author-declared gate specs |
| model output → gate | The LLM's own output is the input to `retrieved_and_cited`. | `output["citations"]` (tool-built off `ToolResult`) — deliberately NOT `source_refs` |
| human answer → `POST /runs/{id}/ask_user_response` → Redis pub/sub → paused run | The approval decision crosses from an authenticated browser to a coroutine possibly suspended on a different uvicorn worker. | `response_text` (**unconstrained `str` — see T-185-04-01**), `choice_index` |
| worker lifecycle → paused run | The boot sweep decides which paused runs are re-subscribed and on which `tool_call_id`. | `tool_call_id`, `ask_user:channels:{run_id}` SET |
| DB schema | Migration 114 widens one CHECK constraint by one literal. INSERT-only RLS on `harness_audit` untouched — receipt immutability holds. | `harness_audit.event_type` vocabulary (22 → 23 literals) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-185-01-01 | Information disclosure | `PhaseNodeCard` authored strings | accept | 0 `dangerouslySetInnerHTML`; guard + positive control `PhaseNodeCard.test.tsx:373-374` | closed |
| T-185-01-02 | Elevation of privilege | node focus surface | mitigate | 0 `<button`/`<a`/`tabIndex`/`onClick`/`role=`/`href=` in `PhaseNodeCard.tsx`; node walk `WorkflowCanvas.test.tsx:253-258, 284-286` | closed |
| T-185-02-01 | Tampering | `PhaseSpec` governance state | mitigate | **Structural.** `harness.py:32-35` `extra="forbid"` + `:201` `PhaseSpec(_StrictBase)`; only `grounding_escalated`/`action_risk_armed` authorable `:234-235`; no `detected` field exists → a PATCH body carrying one 422s. Derivation server-side `grounding.py:832-838`, detection checked FIRST so a hand-edited `escalated:false` is inert | closed |
| T-185-02-02 | Tampering | `ValidatorSpec.kind` Literal | accept | `validators.py:233-241` — unknown kind → `GateResult(False, …)`, fails closed | closed |
| T-185-02-03 | Information disclosure | `kb_tools` payload | accept | `grounding.py:797-800` fixed 5-element `KB_TOOLS`; served at `workflows.py:727` | closed |
| T-185-02-04 | Spoofing | client-side detection | accept by design | Client predicts; enforcement unconditional + server-side at `grounding.py:940` | closed |
| T-185-03-01 | Tampering | author-declared `citations_required` spec | mitigate | **Both halves structural.** APPEND at `grounding.py:951-953` (`[*phase.validators, *extra]`); `run_gates` enumerates the full list `validators.py:230`; index assertion `test_185_engine_attachment.py:153-165` (author idx 0, engine idx 1) | closed |
| T-185-03-02 | Spoofing | model fabricating citations | mitigate | `validator_kinds.py:293` reads `output.get("citations")`; `source_refs` appears only in docstring prose (`:256`, `:264`), never read | closed |
| T-185-03-03 | Repudiation | gate audit trail | accept | `validators.py:225-228, 230` — `idx` is the full-list index, `validator_index` stays correct | closed |
| T-185-03-04 | Denial of service | retry loop on a permanently uncited step | accept | `grounding.py:946` `max_retries=2` + shipped consecutive-identical short-circuit | closed |
| T-185-03-05 | Tampering | persistence of a synthesized gate | mitigate | Attachment at the RUN seam `harness_engine.py:1287-1290` only; 185 added no `@model_validator` (git-diff confirmed). See Observation 2 — the acceptance grep as written is imprecise | closed |
| **T-185-04-01** | **Elevation of privilege** | **`_is_abort_choice` / armed approval** | **mitigate** | **Declared mitigation present but does not close the threat — see BLOCKER below** | **OPEN** |
| T-185-04-02 | Denial of service | indefinite pub/sub wait | accept | Pure asyncio poll `ask_user_service.py:114-140` — one suspended coroutine + one pub/sub connection, not a thread | closed |
| T-185-04-03 | Repudiation | approval receipt | accept | `harness_engine.py:1167-1171` shipped `validator_ask_user_approved` row unchanged | closed |
| T-185-04-04 | Denial of service | un-Stoppable >1h wait | mitigate | `ask_user_service.py:55` `_CHANNELS_TTL_REFRESH_SECONDS=300`; re-arm inside the poll loop `:119-131` | closed |
| T-185-04-05 | Tampering | authorization of the answer | accept | `runs.py:519-525` owner-scoped + `:557-570` anchor confirm, 404-not-403. "Someone else approved it" is Phase 186 | closed |
| T-185-05-01 | Repudiation | audit event vocabulary | mitigate | `harness_engine.py:706-721` armed pause writes `action_risk_pending`; `gate_failed` only on the `else` branch `:723-730` | closed |
| T-185-05-02 | Denial of service | orphaned prompt rows | mitigate | `harness_engine.py:2007-2020` re-subscribes the SAME `_tcid`; `claim_run` CAS untouched `:1951` | closed |
| T-185-05-03 | Spoofing | the answered card | accept | `api/runs.py` unchanged across the phase (API diff = `workflows.py` +19 only) | closed |
| T-185-05-04 | Information disclosure | `action_risk_pending` emit payload | mitigate | `harness_engine.py:715` metadata `{phase, timing}`; `:721` emit carries `phase=` only — never the raw finding | closed |
| T-185-06-01 | Tampering | client-side KB intersection | accept by design | D-185-09: client predicts, `grounding.py:940` enforces | closed |
| T-185-06-02 | Tampering | `setPhaseGovernance` scope | mitigate | `definitionOps.ts:213-216` closed two-key `Readonly`; `PhaseConfigPatch` not widened (`:224`). See Observation 3 | closed |
| T-185-06-03 | Information disclosure | governance copy constants | accept | `definitionOps.ts:372-420` static consts, 0 `${}` interpolation | closed |
| T-185-07-01 | Elevation of privilege | the refused loose side | mitigate | Only writes are `grounding_escalated` (`GovernanceSection.tsx:225, 241`) and `action_risk_armed` (`:293`). Bypassing `disabled` is inert — `grounding.py:832` returns `"detected"` before reading the escalated bit | closed |
| T-185-07-02 | Information disclosure | `title` attributes | mitigate | `grep -c "title=" GovernanceSection.tsx` = 0; `aria-describedby` at `:222`, `:292` | closed |
| T-185-07-03 | Information disclosure | authored strings | accept | 0 `dangerouslySetInnerHTML`; all copy imported static consts | closed |
| T-185-07-04 | Tampering | flag-off surface | mitigate | Mount gated `PhaseFormPanel.tsx:1046` (`rails &&`); spread-conditional `WorkflowBuilderPage.tsx:1648` | closed |
| T-185-08-01 | Spoofing | client-synthesized locked row | accept by design | `GOVERNANCE_GATE_ROW_LABEL` (`definitionOps.ts:416`) is a display label via `GatesRail` (`PhaseFormPanel.tsx:1049`) — authorizes nothing | closed |
| T-185-08-02 | Tampering | the removed word-badge | mitigate | **Deletion verified complete over all of `frontend/src`:** `groundingFor` = 0, `GROUNDINGS` = 0, all three retired strings = 0 (recovered from deletion commit `30cb77f9`). This threat FIRED during execution (`nodePresentation.ts` missed by the plan inventory, caught by `tsc -b`); the fix is complete | closed |
| T-185-08-03 | Tampering | flag-off Spine surface | mitigate | `WorkflowBuilderPage.tsx:1648` `{...(canvasEnabled ? { rails, onGovernanceChange } : {})}` | closed |
| T-185-08-04 | Repudiation | test measuring stick | mitigate | `scripts/vitest-count-gate.cjs:75` pin 33, `:91` baseline 415, `:273-276` `[count-decrease]` — re-pinned in the same commit as the deletion (`30cb77f9`) | closed |
| T-185-09-01 | Elevation of privilege | node focus surface | mitigate | Seal is `pointer-events-none`, no role/tabIndex/onClick (`PhaseNodeCard.tsx:430-444`); canvas walk + double non-vacuity `WorkflowCanvas.test.tsx:269-286`, negative control `:289-295` | closed |
| T-185-09-02 | Repudiation | governance reading mid-run | mitigate | Props fence `PhaseNodeCard.test.tsx:1001` (+ positive control `:1007`, non-vacuity `:1014`); four-status `outerHTML` identity `:1017-1042` | closed |
| T-185-09-03 | Information disclosure | seal markup | accept | `PhaseNodeCard.tsx:441-442` static `⛨` + `sr-only` imported const | closed |
| T-185-10-01 | Elevation of privilege | canvas focus surface | mitigate | `FlowEdge.tsx` 0 role/tabIndex/onClick; `FlowEdge.test.tsx:310-312`, walk + non-vacuity `:323-351` | closed |
| T-185-10-02 | Repudiation | the unarmed reading | mitigate | `FlowEdge.test.tsx:247-256` ghost arc + line asserted dashed/faint; label pinned `:452` | closed |
| T-185-10-03 | Denial of service | canvas render loop | mitigate | `edgeTypes` at module scope `WorkflowCanvas.tsx:303`; `FlowEdge.tsx:365` `memo(FlowEdgeImpl)`. The "no warning in test output" half is not a codified assertion; the structural half is present | closed |
| T-185-10-04 | Tampering | committed projection snapshot | mitigate | `git show 94a89425 --numstat`: **21 insertions, 0 deletions**; only unique added line is `"type": "flow"` — no id/source/target/position changed. See Observation 1 | closed |
| T-185-11-01 | Repudiation | the phase's own evidence | mitigate | `governanceVocabulary.test.ts` — 30 tests pass; positive controls `:211/:227/:235/:314/:334`, scoping+anchor controls `:243-272`, non-vacuity `:184-199` | closed |
| T-185-11-02 | Tampering | "not author-loosenable-away" property | mitigate | **Both green independently:** (a) `harness.py:201/234-235` + `grounding.py:832-838`; (b) `grounding.py:951-953` + `validators.py:230` + `test_185_engine_attachment.py:165` | closed |
| T-185-11-03 | Information disclosure | Deep chat path | mitigate | Deep fence re-verified across the WHOLE phase: `git diff c31c3811~1..HEAD -- agent_loop.py tool_dispatcher.py openai_service.py anthropic_service.py` → 0 files. `ask_user_service.py` widening is type-only; all 4 call sites checked, none passes `None` on a shipped path | closed |
| T-185-12-01 | Tampering | citation gate strictness | mitigate | Gate unweakened: `validator_kinds.py:299-321` — retrieved-but-unmarked still returns `GateResult(False, …)`. Fix is on the producer `phase_types.py:184-238` | closed |
| T-185-12-02 | Spoofing | marker-shaped prose | accept | `validator_kinds.py:293` reads `citations` off `ToolResult` — not narratable | closed |
| T-185-12-03 | Repudiation | "not author-loosenable-away" | mitigate | Plan-12 source commits (`7c7d8b84`, `46f773ff`, `6c85a5e4`) touch only `validator_kinds.py` + `phase_types.py`; `grounding.py`/`harness_engine.py` untouched | closed |
| T-185-12-04 | Denial of service | Deep chat path | mitigate | `phase_types.py:235-237` returns `''` when `need <= 0`; `grep -c "grounding_cause" phase_types.py` = 0; 4-file Deep fence = 0 | closed |
| T-185-13-01 | Tampering | audit ledger closed vocabulary | mitigate | Migration `114:34-49` widens CHECK by exactly one literal (22→23); Python set `db/workflows.py:64-93` matches; pinned both directions `test_audit_event_registration.py:266, 284-303`; applied (`full-schema.sql:1124`) | closed |
| T-185-13-02 | Repudiation | armed pause receipt | mitigate | Pause `harness_engine.py:712-716`; approval receipt stays the separate row `:1167-1171` | closed |
| T-185-13-03 | Denial of service | live runs during apply | accept | Migration `114:30-32` documents the ACCESS EXCLUSIVE window; belongs to the standing cloud parity window (migs 099→114) | closed |
| T-185-13-04 | Elevation of privilege | none | n/a | Migration 114 is only `DROP CONSTRAINT` + `ADD CONSTRAINT` (`:34-49`) — no policy, grant, role, table, column or index | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## 🔴 BLOCKER — T-185-04-01

**Threat as registered:** *An unrecognised decline phrase must NOT read as PROCEED.*

**Declared mitigation is present and green:**
- `backend/app/services/harness_engine.py:887` — `_ABORT_LIKE_CHOICES = ("abort", "cancel", "stop", "", "Do not run it".lower())`
- `backend/app/services/harness_engine.py:890-912` — `_is_abort_choice`
- `backend/tests/unit/test_ask_user_disposition.py:316-348` — invariant guard over all 4 finding branches, passing

**Why it does not close the threat.** The verification scope was the output of
`_ask_user_choices_from_finding` — the *presented button labels*. The shipped card does not
restrict the human to those labels. The chain, all in current code:

1. `frontend/src/components/panel/PendingAskCard.tsx:413-425` — the free-text `<textarea>` is
   **unconditional**. It renders alongside the armed checkpoint's two buttons (the choice buttons
   are gated on `options.length > 0` at `:380`/`:407`; the textarea is not gated at all).
2. `PendingAskCard.tsx:249-252, 266-267` — with no button clicked, `selectedValue` =
   `freeText.trim()`, submitted as `response_text` with `choice_index: null`.
3. `backend/app/api/runs.py:492-500, 592-649` — `response_text: str` is unconstrained; **no
   server-side validation against the prompt's `options`**. It passes straight through
   persist → PUBLISH.
4. `backend/app/services/harness_engine.py:1134-1146` — `choice = response_text.strip()`;
   `_is_abort_choice(choice)` is **exact-match membership**, so anything outside the 5 literals
   falls through to the PROCEED branch.
5. `harness_engine.py:1167-1171, 1178-1179` — writes a `validator_ask_user_approved` receipt and
   returns `None` (`is_pre=True`) → **the engine runs the risky step body.**

**Observed routing** (driven against the shipped `_is_abort_choice`):

| Free-text answer | Routing |
|---|---|
| `"Do not run it"`, `"Abort"` | fail_run (safe) |
| `"no"`, `"No"`, `"nope"`, `"don't"`, `"do not"`, `"decline"`, `"reject"`, `"not yet"`, `"NO!"`, `"absolutely not"`, `"n"` | **PROCEED + approval receipt** |
| `"stop it"`, `"cancel it"` | **PROCEED + approval receipt** (substrings don't match) |

A person who *types* a refusal instead of clicking the button gets the risky action **executed**
and is **recorded in the audit ledger as having authorised it** — verbatim the harm the threat names.

**Internally inconsistent with the phase's own posture.** `harness_engine.py:1123-1127` states:
*"a payload we could not read is not consent, and the only safe reading of 'we don't know what they
said' is 'do not run it'."* That reasoning is applied to `payload is None` but **not** to an
unrecognised free-text string — the identical epistemic situation.

**Provenance.** Phase 185 did not introduce the free-text field (it is the shipped 085/096 D3
"no-options trap"). Phase 185 is what made it safety-critical: pre-185 this gate guarded
*"continue a retrieval"*; post-185 it guards *"send the email / file the claim"* with a false
approval receipt.

**Required fix — engine, not card.** A UI-only change leaves the API open. `_ABORT_LIKE_CHOICES`
is deny-list-shaped and cannot be made fail-closed by extension. The armed PROCEED side needs an
**allow-list** at `harness_engine.py:1146`: only the exact presented approve label proceeds;
everything else — typed, unrecognised, or empty — routes to `fail_run`. Scope is roughly five
source lines plus a falsification test that drives a typed `"no"` and asserts zero
`validator_ask_user_approved` rows.

---

## Accepted Risks Log

The 17 `accept` / `accept by design` dispositions below were verified as genuinely accepted-and-bounded
rather than unmitigated gaps. Each cites the source location that makes the acceptance safe.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-185-01 | T-185-01-01 | Authored strings are plain React text children; no `dangerouslySetInnerHTML` added, shipped XSS grep guard unchanged | operator | 2026-07-31 |
| R-185-02 | T-185-02-02 | `ValidatorSpec.kind` Literal grows additively; an unrecognised kind fails CLOSED (`validators.py:233-241`) | operator | 2026-07-31 |
| R-185-03 | T-185-02-03 | `kb_tools` is a fixed 5-element constant of public tool names already in the shipped palette — discloses nothing about any user, org or document | operator | 2026-07-31 |
| R-185-04 | T-185-02-04 | Client-side detection is PREDICTION only; enforcement is unconditional and server-side. A wrong client read is a display bug by construction | operator | 2026-07-31 |
| R-185-05 | T-185-03-03 | Synthesized spec rides the shipped `gate_failed` row + SSE unchanged; `validator_index` stays correct. Accepted cost: a doubled gate row on hand-strict steps | operator | 2026-07-31 |
| R-185-06 | T-185-03-04 | Retry loop bounded by `max_retries: 2` plus the shipped consecutive-identical short-circuit | operator | 2026-07-31 |
| R-185-07 | T-185-04-02 | Indefinite pub/sub wait costs one suspended coroutine + one Redis connection per armed pause — not a thread, not the event loop | operator | 2026-07-31 |
| R-185-08 | T-185-04-03 | Approval receipt row unchanged from shipped behaviour | operator | 2026-07-31 |
| R-185-09 | T-185-04-05 | Answer *authorization* is the shipped POST endpoint's concern (IDOR-safe anchor-confirm, 404 on terminal run). "Someone else approved it" is explicitly Phase 186. **Note:** this is authorization only — answer *content* validation is T-185-04-01 and is NOT accepted | operator | 2026-07-31 |
| R-185-10 | T-185-05-03 | Answer authorization unchanged; `api/runs.py` untouched by the phase | operator | 2026-07-31 |
| R-185-11 | T-185-06-01 | Client predicts, server enforces (D-185-09) | operator | 2026-07-31 |
| R-185-12 | T-185-06-03 | Twelve governance copy constants are static prose with zero interpolation | operator | 2026-07-31 |
| R-185-13 | T-185-07-03 | All eleven rendered sentences are imported static consts; no template literal in any rendered position | operator | 2026-07-31 |
| R-185-14 | T-185-08-01 | The client-synthesized locked row is a prediction rendered to the author; authorizes nothing, blocks nothing (D-185-19) | operator | 2026-07-31 |
| R-185-15 | T-185-09-03 | Seal renders a static glyph + static `sr-only` label; no interpolation | operator | 2026-07-31 |
| R-185-16 | T-185-12-02 | Marker-shaped prose is why half (a) exists and reads `citations` off `ToolResult`; half (b) alone was never the security property | operator | 2026-07-31 |
| R-185-17 | T-185-13-03 | Brief ACCESS EXCLUSIVE lock during `DROP`+`ADD CONSTRAINT`; belongs to the standing cloud migration-parity window where migs 099→114 land together, not mid-traffic | operator | 2026-07-31 |

**T-185-04-01 is NOT in this log.** The operator elected to block and fix rather than accept.

### Carried residuals (recorded, not accepted risks)

- **T-185-05-02** — answering *during* a resume produces one further ask. Deferred, fail-closed.
- **T-185-08-04** — three deferred positive pins leave 2 / 10 / 55 tests of blind spot in three
  other files (SEED-056).

---

## Non-blocking Observations

1. **T-185-10-04 count drift.** The register says 51 snapshot entries move; measured is **21
   insertions, 0 deletions**. The load-bearing property (insertions only, no changed
   id/source/target/position) is verified — only the count in the plan prose is wrong.
2. **T-185-03-05 acceptance criterion is mis-worded.** The declared grep — *"`model_validator`
   must appear in NEITHER `harness.py` NOR `grounding.py`"* — is literally false against
   `harness.py`, which has 2 real `@model_validator` (`:293`, `:307`), both pre-existing
   `WorkflowDefinition` structural checks. Git-diff confirms **185 added none**, so the security
   property holds; the criterion should be re-phrased to *"no `@model_validator` on `PhaseSpec`"*
   before anyone re-runs it verbatim and reads a false failure.
3. **T-185-06-02 rests on TS excess-property checking**, which applies to fresh object literals
   only; a caller passing a wider variable would type-check. Adequate for the in-repo call sites.

---

## Unregistered Flags

**None.** Verified independently rather than taken from the SUMMARYs: `git diff` across the whole
phase shows no new `@router` decorators; `backend/app/api/` changed by +19 lines in `workflows.py`
only (the `kb_tools` response field, registered as T-185-02-03); one migration (114, registered as
T-185-13-01..04). `GET /workflows/grounding-bundle` is pre-existing (Phase 182 / D-182-01), not
net-new surface.

---

## Test Evidence Executed

| Suite | Result |
|---|---|
| `test_185_detection`, `test_185_engine_attachment`, `test_ask_user_disposition`, `test_audit_event_registration`, `test_harness_models`, `test_validator_kinds` | 131 backend unit tests pass |
| 6 workflow frontend suites | 383 tests pass |
| `governanceVocabulary.test.ts` | 30 tests pass |

Implementation files were **not modified** during this audit — read-only throughout.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-31 | 49 | 48 | 1 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed — **1 open (T-185-04-01, BLOCKER)**
- [ ] `status: verified` set in frontmatter — currently `blocked`

**Approval:** pending — blocked on T-185-04-01
