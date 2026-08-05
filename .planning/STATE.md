---
gsd_state_version: 1.0
milestone: v3.6
milestone_name: Visual / No-Code Workflow Studio — 🚧 ACTIVE
status: executing
last_updated: "2026-08-05T14:41:59.608Z"
last_activity: 2026-08-05 -- Phase 188 UAT board COMPLETE (16 PASS / 0 FAIL / 1 blocked); security review owed
progress:
  total_phases: 19
  completed_phases: 8
  total_plans: 114
  completed_plans: 114
  percent: 42
---

# Project State

> **Scope note:** **v3.2 Skill Eval Studio + Self-Improving SHIPPED + archived 2026-07-10** (started 2026-06-28; close-out in `.planning/milestones/v3.2-ROADMAP.md` + `MILESTONES.md`; FILE-01/Phase 144 deferred → v3.3). Roadmap created: CORE Phases 132-137 + STRETCH Phases 138-143 (gated behind CORE — v2.9 105-109 / v3.1 125-131 precedent). Numbering continues from v3.1's last phase (131). Scope source: `.planning/REQUIREMENTS.md` (8 CORE + 6 STRETCH); brief `.planning/PRDs/v3.1-skill-studio-eval.md`. **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers SHIPPED + archived 2026-06-28** (CORE 120-124+123.1; STRETCH 127/128/129 shipped, 125/126/130/131 deferred as carry-forwards now folded into v3.2 STRETCH; close-out in `.planning/milestones/v3.1-ROADMAP.md` + `MILESTONES.md`). The v3.x PRD roadmap (authoritative map: `.planning/PRDs/SEQUENCE.md`) is unchanged. **Everything below the "Roadmap shape (v3.2...)" block is v3.1-and-earlier accumulated context, retained per the milestone-transition convention.**

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-20 — Phase 163 THE ATOMIC CRUX complete; membership RLS enforced)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Current focus:** Phase 188 — non-technical-run-observability

## Deferred Items

Items acknowledged and deferred at **v3.4 milestone close on 2026-07-22** (38 open `audit-open` artifacts — all noise, by-design forward backlog, or live-UAT status-lag; none block the close):

| Category | Count | Disposition |
|----------|-------|-------------|
| Seeds (dormant) | 9 | By-design forward backlog with re-open triggers — 003 deploy-flexibility, 004 org-multi-tenancy (largely delivered by v3.4; STRETCH remnants), 040 model-registry-self-service, 041 conversation-compaction, 042 chat-input-modalities, 043 sandbox-package-mgmt, **045 ui-ux-polish (next UX track)**, 046 library-health, 084 starter-workflow-library. |
| Quick tasks (missing) | 22 | Stale legacy index refs; underlying files gone. Noise, not open work. |
| Todo (empty) | 1 | Malformed/empty entry. Noise. |
| UAT gaps | 3 | `partial` — the 166/167/168 live-UAT files (cross-provider SC#10 + the SSO round-trip, which needs cloud + a real IdP). Roll forward. |
| Verification gaps | 3 | `human_needed` — 166/167/168 VERIFICATION, satisfied when the live UAT runs. Roll forward. |

**v3.4 STRETCH carry-forwards (deferred with triggers → `.planning/v3.4-STRETCH-CARRYFORWARD.md`):** 169 Dept-Admin Shell · 170 Entitlement + Retention/Rate-Limit footholds · 171 Permission-Aware Citations (correct-sequencing: leak latent till dept/role folder-sharing ships) · 172 OIDC SSO (customer-triggered) · 173 Dept-Targeted Skills + rollout gating. **Cloud parity owed:** migrations 104-113 + `SECRETS_ENCRYPTION_KEY` at next production push.

**⚑ Phase 177 org live-UAT → CLOUD (operator-approved deferral 2026-07-23 — MUST NOT LOSE):** 3 of 4 UAT items verified live + approved; **item 4 outstanding** = (a) cross-provider org-switch teardown/reprobe, (b) a real-IdP **SAML** sign-in round-trip with no cross-org leak, (c) the two org-matrix cells un-testable on a single-org-admin local account — **multi-org** switcher present + teardown, and the **member** cell where the org-admin shield + "Organization admin" menu entry must VANISH (not disable). **Re-open trigger:** at the next cloud/prod push of the v3.4 org surfaces, stand up a **test organization** (invite a 2nd account → yields multi-org + a member) and wire a **real IdP SAML** connection, then run all of (a)–(c). Naturally pairs with the "Cloud parity owed" push above and the 166/167/168 SSO live-UAT that already rolls forward. Tracked in `.planning/milestones/v3.5-phases/177-v3-4-org-surface-polish/177-HUMAN-UAT.md` (blocked test + re_open_trigger; archived at v3.6 kickoff) and memory `reference_v34_org_live_uat_cloud`.

**Open reported bugs rolling forward** to a planned post-v3.3 chat-polish phase (none were folded into 146–159): BUG-260708-01/-02 (major), BUG-260714-01 (major), BUG-260712-02, BUG-260718-02/-03/-04, BUG-260609-02/-04, BUG-260610-01, BUG-260623-01, BUG-260706-01, BUG-260707-03; deferred BUG-260626-02/-03, BUG-260711-02; external BUG-260714-02 (OpenRouter). BUG-260718-01 CLOSED (folded into 159).

## Current Position

Phase: 188 (non-technical-run-observability) — **UAT COMPLETE · security review OWED**

**▶ NEXT ACTION: `/gsd:secure-phase 188`.** All 13 plans executed; the UAT board is settled at
**16 PASS · 0 FAIL · 1 ⛔ · 0 pending**; no `188-SECURITY.md` exists and `security_enforcement`
defaults on, so the phase is NOT yet verified. Precedent: 185 and 186 both closed SECURED.

**UAT rows 12 · 14 · 16 DRIVEN 2026-08-05 at `/gsd:verify-work 188` — all three PASS.** They
were already *counted* as PASS in the board's header but **none carried a driven record of its
own**: row 12's evidence lived inside the F1/F2 defect write-ups, row 14 was recorded verbatim
as "PARTIAL — cannot exercise all seven while F1 stands" and was never re-driven after F1 was
fixed, and row 16 had no record at all (its evidence was incidental to row 15, and its actual
observable — *"no broken preview pane renders"* — had never been checked). **Three of sixteen
claimed PASSes resting on evidence gathered while driving other rows is the exact pattern this
phase exists to remove.** Now each of the sixteen carries its own record.

- **Row 12** (run `b48cd039`, `doc_qa_scoped_098uat`) — 3 transitions watched live with no
  reload, each paired to a `workflow_phases` read; then a **hard refresh with `confirm` sitting
  `active`** returned **byte-identical** node readings against an unchanged DB. Only the elapsed
  figure moved (1m 15s → 1m 56s) — correct, and the reason F6 exists. Panel and canvas read side
  by side agree on every fact and differ only in vocabulary (§H #1). Terminal: `✓ Complete`,
  `Ran for 6m 05s — from when it was queued to its last update`.
- **Row 14** (colour off) — **6 of 7 readings observed on REAL runs.** The 7th cannot be:
  `workflow_phases_status_check` restricts the column to five values, so `unknown` is not a run
  state at all but the total-function fallback for a value arriving over the **wire**. Driven
  that way, an unrecognised status rendered **"State unknown — we can't tell what happened to
  this step"** — **not** `Complete`, no crash. **That is SC#3's total function proven against a
  genuinely unrecognised value, and no row had ever made the observation.** Four readings on one
  grayscale screen separate by geometry alone (`1.5 6` dots · `5 7` coarse · no arc element ·
  unbroken ring), and the rendered numbers match `RING_GEOMETRY`'s computation exactly.
- **Row 16** (`.docx`) — driven on run `27bb0f6b`, **fixture reuse recorded rather than silently
  made**. One control (the card IS the button); one click fired
  `GET /threads/…/workspace/files/…/raw` → blob → anchor `download="risk-register.docx"`,
  instrumented not inferred; and **0 iframes / 0 embeds / 0 file-bearing images** — there is no
  preview element to break.

⚠ **Two things recorded, not graded.** (1) The run surface is `👁 View only`, so a node reading
*"Pauses here until you answer"* sits on a screen with no way to answer — the route out is
present and labelled (`Open the chat thread`), so this is honest rather than broken, but it is a
legibility question worth a future row. (2) Two screenshots timed out (`Page.captureScreenshot`
— the known Chrome-MCP behaviour here); the ring geometry was read out of the DOM instead, which
is machine-checkable. The missing artefacts are pictures, not findings.

**F5 + F6 FIXED AND VERIFIED LIVE (2026-08-05, `3748e6d1` + `abd4ce64`).**

**F5** — the run-time waiting reading was structurally unreachable on the run surface.
`reconcilePhases` hardcodes `pendingAsk: null` in both branches, so `canvasReading`'s waiting
arm could never fire on a surface that rides polled reconciles. `WorkflowRunPage` now consumes
the durable `useAskUserPrompt` slice that already shipped — **no new endpoint, no wire change,
`reconcilePhases` untouched**. `PendingAsk` carries no phase reference, so the waiting step is
DERIVED under four conditions: an ask exists AND the run is live AND the step is the one running
AND it is `llm_human_input`. The ask token is written on as the `tool_call_id` pointer a live
event would have carried, so the derivation stays inside `canvasReading` and the Req 8 fence
(`canvasReading(` count == 1) is untouched. RED observed first on 4 of 8 cases.

**F6** — *found by watching the F5 verification run, not by any suite.* F3 moved the elapsed
figure's anchor to the `created_at` fallback and left the TICK GATE reading `claimedMs != null`;
since `claimed_at` is null on essentially every run (0 of 149 completed), the 1 s interval never
armed on ANY live run and the band rendered a frozen mount-time number that looked live.
Observed: a run 106 s old displaying "3s since it was queued". `anchorMs` is now computed once
and read by both the gate and the figure. **F6 is a defect introduced by a UAT fix (F3), which
survived because that fix was verified by re-reading the wording rather than watching the number
for ten seconds.**

Live evidence — run `2ad460f0` on `doc_qa_scoped_098uat`, paired DB read: DB
`completed/active/pending` rendered `Complete` / `Paused for your answer — it needs your reply
before it can continue` / `Not started`, with the clock advancing 37s → 57s across a 20 s gap.
The waiting reading arrived via the 5 s poll with **no wake event and no reload**. D-188-05 was
confirmed visible on one card: the design-time badge "Waits for you" sits directly beneath the
run-time sentence "Paused for your answer".

Gates: count gate **2460/2460, failed 0, 45/45 pinned, zero slack** (WorkflowRunPage 75 → 85,
re-pinned in the same commits) · `tsc --noEmit -p tsconfig.app.json` **33** (inherited baseline,
0 in touched files) · `vite build` exit 0 · zero migrations · `WorkflowCanvas.tsx` untouched.

**UAT rows 9 · 10 · 11 DRIVEN 2026-08-05 — all three PASS.** Board now **15 PASS · 0 FAIL ·
1 ⛔ · 1 pending**.

- **Row 9 multi-tool** (run `4d82ab27`) — both tools fired in one phase, evidenced from the
  Redis run buffer, NOT from the model's prose (which claimed "The Python code was executed"
  while showing a plain list). `execute_code`: `code_execution_start` + 5 × `code_stdout` +
  `exit_code 0`. `search_documents`: its `sources`/`citations` events, confirmed to be its
  activity by reading `_handle_search_documents` (`tool_dispatcher.py:686`) rather than
  inferring it from the citations' presence. Node read `Running` at both in-flight samples
  (DB `active` both times) and `Complete` only after the DB said `completed`.
- **Row 10 parallel-thread** (runs `882e33dc` + `3bab9aa4`, two tabs, concurrent) — different
  spines, node counts and bands at the same instant; `active_workflow_run_id` differs per
  thread and each equals its own run; B reaching terminal and NULLing its own anchor did not
  disturb A. ⚠ **The row's "refresh either tab" is not literally performable — there is no
  router and no deep link to a run**, so a reload lands on Chat; it was done as reload → the
  thread → the D-188-13 "Open the run" receipt.
- **Row 11 long-message** (run `0114b2fe`) — kickoff 5543 B persisted intact, run `completed`,
  no phase stranded, node correct at terminal, receipt opened it with `active_workflow_run_id`
  already NULL (CR-03 holding).

⚠ **Fixture substitution, recorded not silent:** rows 9/11 nominate `research_summarize`, which
is `is_system_global` but in org `430bffc6…` while this account is in `22f9c615…` — **not visible
to this user**, v3.4 RLS working as designed. Both rows name `multitool_scope_098uat` as the
alternative and that is what was driven.

⚠ **Methodology lesson — a false PASS was nearly recorded on row 11.** The smoke script titles
every thread `EVAL-02 long-message axis row` **and builds the same deterministic prompt each
time**, so a June thread matched both the title and a prompt substring, and its run surface
opened reading `✓ Complete`. Caught only because the spine had 2 nodes and row 11's workflow has
1; settled by reading the actual `GET /workflow-runs/{id}` off the network. **Identify a run by
its id on the wire — a title and a prompt are not identifiers.**

**F7 FIXED + ROW 15 DRIVEN 2026-08-05 (`c50e93f4`). UAT BOARD COMPLETE: 16 PASS · 0 FAIL ·
1 ⛔ · 0 pending.**

**F7 — SC#1's governance half never reached the run surface.** The criterion requires each node
to show live state **and its grounded-cited vs open governance state**; `grep -c grounded` over
both `188-UAT.md` and `188-VALIDATION.md` returned **0**, and it did not work. `toCanvas`
resolves `grounded` via `isGrounded(phase, kbTools)` and defaults an omitted `kbTools` to the
frozen empty `NO_KB_TOOLS`; the run page passed none, so `available_tools ∩ kb_tools` ran against
the empty set and the **`detected`** cause could never resolve. Quiet because `already-set` and
`escalated` still did — governance LOOKED right on workflows that declare it explicitly, while
every step grounded merely by reading the KB painted as ungoverned. **All 8 published KB-reading
fixtures in this org are detected-only**, so the failure covered the whole realistic population.
Falsified live on ONE workflow across BOTH surfaces before any edit: Builder canvas
`data-grounded="true"`, run surface no attribute. Fixed with the Builder's rule verbatim
(`useGroundingBundle`, ready-or-unavailable), R11 intact. RED first; verified live — the ⛨ corner
seal now renders and the two non-KB steps correctly carry none.

**Row 15 · the 🕐 Tomorrow journey — PASS** (run `27bb0f6b`, `risk-register-bnoz7n`, chosen
because the row needs a real deliverable). Launch landed on the run surface with **no composer**;
a full cache-busting reload; found the thread; "Open the run" re-opened it with **no live
stream** showing the full spine, `✓ Complete` on both nodes, `Ran for 2m 35s — from when it was
queued to its last update`, and `risk-register.docx · 37.4 KB` with its download control.
⚠ One clause of that row is **superseded**: it demands "no clock when `claimed_at` is null", which
**F3 deliberately reversed** on the 0-of-149 measurement. The intent (never an unlabelled clock)
holds; the wording predates F3/F6.

**Every ROADMAP success criterion for 188 is now verified**, SC#7 with 7/8 providers and minimax
recorded ⛔ `SC10-188-RUN` rather than omitted.

**Next action:** `/gsd:verify-work 188` — the phase-goal check, with a complete board behind it.
Then the 10 deferred review WARNINGs (WR-01, WR-04 first), the minimax re-drive (real spend —
operator's call), and the still-OWED G-5 `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction,
which is due before any further `WorkflowCanvas.tsx` feature touch (i.e. before Phase 189).

**Plan 187-01 COMPLETE (Wave 1, 2026-08-02, `6793f651`).** The SC#6 property test
(`backend/tests/unit/test_187_armed_checkpoint_property.py`, 30 tests) is written and **observed RED
on unmodified HEAD** — 8 failed / 22 passed, exit 1. Four author-validator-set rows fail on both P1
and P2 (`pre_ask_user_proceed`, `pre_ask_user_plus_post_citations`, `two_pre_ask_user`,
`pre_pass_then_pre_ask_user`), each showing **0 armed prompts, body invoked, `outcome='completed'`** —
on HEAD an armed step runs to a SUCCESSFUL completion with nobody asked. Mechanism recorded verbatim in
the file's docblock: `effective_phase` APPENDS the armed spec, `run_gates` is first-failure-wins
(`validators.py:248`), `_is_action_risk_finding` is False, and **`harness_engine.py:739` falls through
to the body**. The RED observation cannot now be retro-fitted. No production source was modified.
Backend collection 3474 → 3504.

**Plan 187-02 COMPLETE (Wave 1, 2026-08-02, `6a1661e6` + `b45675ef`).** VOCAB-01/02 backend half:
`AUTHORING_SYSTEM_PROMPT` now instructs a short, specific, plain-language **per-phase `name`**
(explicitly separate from the definition-level one), and `PhaseSpec` gains
**`name_seeded_by_ai: bool = False`** — additive-optional, `grounding_escalated`'s spelling verbatim,
**zero migrations**. `generate_workflow_definition` stamps it **server-side after validation** on the
single success path via `model_copy`, so first-emit and retry-emit results are stamped identically and
a model cannot launder a generated name into looking hand-typed (T-187-02-02, tested adversarially).
Measured: `grep -c model_validator` on `harness.py` **4 → 4** (no validator hook added);
`test_103_nl_generate` count **6 → 6** (the 1 / 2 / never-3 provider budget did not regress, and is now
pinned by three explicit tests); `test_harness_models` **11 → 15**; backend collection **3504 → 3516**;
`git diff --stat -- supabase/migrations` empty. `ValidatorSpec.kind`'s `"action_risk_approval"` Literal
**deliberately RETAINED** (additive-only policy, `harness.py:10-21`). **Carry forward:** the D-187-07
demote rule must clear `name` **and** the marker together, or a demoted phase keeps claiming AI
provenance for a name it no longer has.

**Plan 187-03 COMPLETE (Wave 1, 2026-08-02, `3727b006` → `a68132db` → `555fbf35` → `7ef69454`).**
D-187-11 / VOCAB-02 — `BUG-260731-03`'s **verdict half**. `POST /workflows/validate` mints a new
per-node **`unbound_retrieval`** finding at severity **`incomplete`** when
`project_folder_id is None` **and** `grounding.grounding_cause(phase) == "detected"`. Minted in the
**ROUTE** (`_ROUTE_ASSIGNED_CODES`), deliberately **NOT** in `grounding.grounding_verdicts` — that
collector is shared with publish (182-06 made publish enforcing), so a rule there would silently
become a publish blocker; `grep -c "unbound_retrieval" grounding.py` → **0** and
`test_182_publish_grounding_stage.py` is green unchanged. Registered in **both**
`_ROUTE_ASSIGNED_CODES` and `_INCOMPLETE_CODES` (`_ERROR_CODES` is derived by subtraction, so one
registration alone would classify `error` *silently*). The KB-tool intersection is **not copied** —
the check calls `grounding_cause`, proven falsifiably by a test that monkeypatches a 6th name into
`KB_TOOLS` and observes the verdict appear. Measured: `test_182_validate` **12 → 18**,
`test_182_severity_codes` **8 → 9**, backend collection **3517 → 3523**,
`git diff --stat -- supabase/migrations` **empty**. `BUG-260731-03` stays **`folded`**,
`verified_closed_by: null` — both halves still owe a live confirmation. **Carry forward:** the check
tests `"detected"` ONLY (not `already-set` / `escalated`, which do not imply KB reading); and
`blockedReason` renders this message **verbatim** next to a disabled Publish button, so rewording it
is a UX change. **UAT owes:** observing the verdict on the canvas with `visual_workflow_canvas` ON
(G-4) — nothing here was live-verified in a browser.

**Plan 187-04 COMPLETE (Wave 1, 2026-08-02, `8e86ee50` → `59b37865` → `dd12bb2f` → `f5ed99ac`).**
VOCAB-01 / D-187-04 / D-187-05 — the **config-derived node face**, in the ONE vocabulary module.
`phaseVocabulary.ts` gains `NameContext` (optional injected `folderNames` / `skillNames` /
`templateFilename`), a frozen module-scope `NO_NAME_CONTEXT`, the pure `derivedFace` core with its
precedence numbered `(1)`..`(5)` in the source, and the `derivedFaceOf` phase adapter; `nodeTitle`
becomes `nodeTitle(phase, ctx = NO_NAME_CONTEXT)` resolving **stored name → derived face → type
sentence → raw type**. `PhaseSpecJSON.name_seeded_by_ai` is declared here (additive-optional, read by
NO resolver in this file — 187-05's `definitionOps` demote rule owns it). The refuted "10 of 119"
docblock figure is replaced by the measured **0 of 57** and deliberately not restated, so a grep
proves it gone. Measured: `phaseVocabulary.test.ts` **33 → 72**; 8-file vocabulary set **902**
(bar 863); 5-file consumer set **381** (bar 381); `?raw` spine guards green.
**Carry forward — three things the next plans must not rediscover:**
(1) **The plan contradicted itself** ("an empty `NameContext` returns `null` for EVERY phase" vs
"`llm_human_input` renders `Wait for your approval`"). Resolved in favour of the D-187-04 tier
ORDER: tier 4 reads no lookup, so it resolves uncontextualised. **Consequence — a real product
change:** an unnamed `llm_human_input` step now reads **"Wait for your approval"** instead of
**"Check with you"** for *every* caller, context or not. 3 fixture snapshots + one
`WorkflowCanvas.test.tsx` assertion were updated to the intended value after reading the full diff
(nothing but the face changed).
(2) **`derivedFaceOf` does NOT read `assets`** — 187-08 / 187-15 owe resolving the definition's
`assets[]` entry where `kind === "template"` and passing its filename as `ctx.templateFilename`.
The `llm_emit` gate already lives in the core, so callers inherit it.
(3) **`npx tsc -b` does NOT exit 0 at HEAD** — measured **33 errors, 0 in `components/workflows`**
(owners: `SettingsPage`, `OrgProvider.test`, `StreamsProvider`, `streamsStore`). Every 187 plan
inherits that gate from `187-RESEARCH.md:1769` and it has never been true. Logged as `D-ITEM-01` in
the phase's new `deferred-items.md`; read the criterion as *no NEW error, none in the touched files*.

**Plan 187-05 COMPLETE (Wave 1, 2026-08-02, `b9b58b39` → `8dbb3b03`).** VOCAB-03 / D-181-01 — the
**flag-off describe-screen markup pin**, test-only, captured against the **UNMODIFIED** page before
the template door exists (`git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx` empty
is the plan's own acceptance criterion, T-187-05-03). New
`frontend/src/pages/WorkflowBuilderPage.describe.test.tsx`, **7 tests**: a verbatim
`FLAG_OFF_DESCRIBE_MARKUP` for the CTA flex column (`WorkflowBuilderPage.tsx:1450-1465`), the
**operator-like** map asserted against the **same constant** (equality, not a second copy), a
formatting-independent `/template|starter/i` negative guard over both `textContent` and attributes,
and a **positive control** that plants the 187-15 door into the captured string so both guards are
observed to bite. Measured: describe **7**; describe+header+canvas **122** (header+canvas baseline
**115**, unchanged); the 5-file Builder set **161**; `tsc -b` **33 → 33** (0 in the touched file).
**Carry forward — the reason this pin exists, and its exact reach:**
(1) `describeScreen` is constructed on **BOTH** flag branches — only `preDraftHeaderHosted`
(`:1399-1400`) consults `canvasEnabled` on this route — so anything 187-13/14/15 adds inside it
**ships flag-OFF unless it carries its own `canvasEnabled` gate**.
(2) The pin covers the **CTA column keyed to `describe-hint`**, i.e. the door's stated landing zone.
A door mounted as a **sibling** of that column (above the CTA, or between the picker and the CTA)
would NOT trip the byte pin — widen the region deliberately rather than assuming coverage.
(3) The literal contains the CTA in its **`disabled`** state (empty describe box = the arrival
state). A change to `canDraft`'s initial value reds this pin, and that would be a real product
change, not a test artefact.

**Plan 187-06 COMPLETE (Wave 2, 2026-08-02, `3253ee21` → `f4a3d539` → `b1239e10`).** SC#6 / SEED-137 —
**the armed action-risk checkpoint is HOISTED** out of `phase.validators` into an explicit engine step
at `harness_engine.py:754`, before `while True:` at `:805` (D-187-01/02/17). `effective_phase` now
synthesizes **only** `citations_required` (`timing="post"`, byte-unchanged, confirmed unreachable by
this hazard); `_is_action_risk_finding` is **deleted** (`grep -c` → 0); `_ACTION_RISK_FINDING_PREFIX`
is kept as a wire format. `is_action_risk` is an explicit keyword PARAMETER of
`_resolve_failure_with_ask_user` (Pitfall 3), and **the Pitfall-4 fail-open is closed STRUCTURALLY** —
`_failing_on_failure` is reachable only under `if not is_action_risk:`, skipped entirely rather than
computed-and-overridden. `total_phases` threaded from `run_workflow`. Zero migrations, zero new audit
event types (`grep -c "event_type="` **14 → 14**), allow-list untouched, `publish_service.py` clean
(D-187-12 still deferred).
**MEASURED: the SC#6 property is 30/30 GREEN** when its drive supplies the new keyword — proved with a
scratchpad-only pytest plugin, zero tree edits. A live probe shows the ledger writes
`action_risk_pending` then `validator_ask_user_approved` with **`validator: None`** (D-187-18 observed,
not asserted), and a typed refusal → `fail_run` with the body never invoked and zero receipts.
**Carry forward — 187-11 owes exactly three things:**
(1) **One keyword**: `test_187_armed_checkpoint_property.py:522-526` must pass
`total_phases=TOTAL_PHASES` to `_run_phase_with_gates`. Without it the checkpoint composes
`"Step 2 of 2"` instead of `"Step 2 of 4"`, the sentence join fails, and the property reads **15 red
that are not real** — do NOT read that as a regression.
(2) **Re-shape 9 shipped armed tests** (8 in `test_185_engine_attachment.py`, 1 in
`test_ask_user_disposition.py`): 6 are direct `_resolve_failure_with_ask_user` calls needing
`is_action_risk=True`; 3 drive `_drive_failing_pre_gate` with a manufactured armed finding and must
drive `action_risk_armed=True` instead.
(3) The 187-VALIDATION §5 falsification re-run (remove `harness_engine.py:754-803`, confirm 187-01's
RED signature returns).
**Also carry forward:** a hand-declared `action_risk_approval` ValidatorSpec is now an **ordinary
author gate** — nothing in the engine treats that `kind` specially. The Literal is kept (187-02) and
0 stored rows name it, so no live data is affected.

**Plan 187-07 COMPLETE (Wave 2, 2026-08-02, `9f530082` → `847f2374`).** SC#10 / VOCAB-02 — the
**8-provider generation roster is DERIVED and MEASURED LIVE**.
`backend/tests/integration/test_187_authoring_roster.py` imports `MODEL_CAPABILITIES`, groups on
`provider` and picks one representative per group by version tuple (ties → timeout → max-output → id).
**The heuristic needs no override map** — it independently picks the newest flagship in all 8 groups,
so the file hand-types **zero** model ids and `grep -c monkeypatch` → **0**. Each row passes its own
`SimpleNamespace(harness_authoring_model=…)` — `settings` is a **PARAMETER**
(`workflow_authoring.py:221-231`), so there is zero global mutation and the SPEC's "must run serially"
assumption is **SUPERSEDED**. Collection 3523 → **3533**; the default `pytest tests/ -q` skips all 8
rows in 0.30 s with no network.
**LIVE BOARD (718 s, all 8 rows, 0 ⛔): anthropic ✅ · deepseek ✅ · google ✅ · zhipu ✅ ·
moonshot ✅ · minimax ❌ · openai ❌ · openrouter ❌.**
**Carry forward — three findings, only ONE of which is about names:**
(1) **OpenRouter drops the per-step `name` NON-DETERMINISTICALLY** — sample 1 emitted a valid
definition with **5 of 5 phases unnamed**; sample 2, same prompt, named all 5. Non-native tool path
(`native_tools: False`). The assertion was **not weakened**; Req 1's derived face is the graceful
degradation. Re-sample with `-k openrouter`, never trust one generation.
(2) **`MODEL_CAPABILITIES` OVER-CLAIMS for the whole `gpt-5.6-*` family.** Registry says
`forced_emission: True` / `emit_tier: force_strict`, but OpenAI now refuses function tools for
reasoning-first models on `/v1/chat/completions` outright (verbatim 400: *"…use /v1/responses or set
reasoning_effort to 'none'"*). The ladder descends, gets a 200, emits nothing. **Do NOT "fix" this by
editing the roster** — it is a registry/gateway change (Rule 4), adjacent to `BUG-260731-01`.
Supplementary diagnostic: `gpt-5.5` (the fallback branch's own pick) names **5/5**, so **OpenAI's real
SC#10 answer is GREEN**.
(3) **`MiniMax-M3` never emits** — 4 × HTTP 200, no tool call, across 2 attempts (budget held at 2,
never 3). Nothing measured about names because nothing was emitted.
**The moonshot prediction was REFUTED and recorded** — the coerce-tier `kimi-k2.6` named all 5 phases,
though `resolve_authoring_model` branch 1 still returns an explicitly-set model without validating
`forced_emission`. No row was `xfail`-ed. **M7 (the env path reaching `resolve_authoring_model`)
remains manual and uncovered** — this roster drives the service function, not the env knob.

**Plan 187-08 COMPLETE (Wave 2, 2026-08-02, `a4cd1101` → `73d78491` → `9a48e1cd`).** VOCAB-01 /
D-187-05 — the derived node face is now **reachable from the canvas**. `ToCanvasOptions` gained an
OPTIONAL `nameContext` resolved against a new frozen module-scope
`NO_NAME_CONTEXT = Object.freeze({})`, the `NO_KB_TOOLS` idiom verbatim; `buildPhaseData` threads it
to **`nodeTitle` only** (`technicalTitle(phase)` keeps one argument — the reveal-ON line is the SLUG
and must stay the slug). `toCanvas` stays PURE: the api-client / `fetch` / `useState` / `useEffect`
greps are 0 and **no snapshot moved** (`git status --porcelain .../__snapshots__` empty).
**G-5 was capped and the caps were hit exactly: `WorkflowCanvas.tsx` 7 insertions / 2 deletions,
`ProblemsTray.tsx` 8 / 1, and 0 new function/state/effect lines** — extraction stays Phase 188's.
The 4th line is the one that matters: `ProblemsTray` is mounted INSIDE `WorkflowCanvas`, so the tray
half of RESEARCH Open Q6 closed for **zero lines in `WorkflowBuilderPage.tsx`** and cannot widen the
D-187-14 page gate; a card and the row pointing at it now resolve one name through one object.
Counts: `canvasModel.test.ts` 41 → **49**, `canvasModel.purity.test.ts` 79 → **143**,
`ProblemsTray.test.tsx` 23 → **26**; fixtures 100 / roundtrip 517 / WorkflowCanvas 35 all unchanged.
Set A **974 passed** (bar 863), Set B **384 passed** (bar 381), 0 failed. **Both halves were observed
RED** — Task 1's tests committed failing 6/192, and Task 2's card↔row control was proved by reverting
the tray thread and watching it go red before restoring it.
**Carry forward:** (1) **`ctx.templateFilename` has no producer yet** — threaded end-to-end and
covered by the purity fixtures, but `derivedFaceOf` deliberately does not read `assets` and this file
holds `phases`, not the definition. **187-15 owes the page-level `assets[] where kind === "template"`
→ `filename` resolution on the SAME prop this plan added.** (2) `tsc -b` re-measured independently:
**33 errors, 0 in `components/workflows`, identical before and after** — D-ITEM-01's reading holds,
inherited unmeasured. (3) One deviation, in the open: the tray leans on `nodeTitle`'s OWN default
parameter instead of re-declaring `NO_NAME_CONTEXT` (187-04 kept it module-private) — the identical
frozen reference, without a fourth copy or a needless export.

**Plan 187-09 COMPLETE (Wave 2, 2026-08-02, `37c898e8` → `3a9f5723` → `0b30dcac` → `8e54edee`).**
VOCAB-01 / SPEC Req 4 / D-187-06 / D-187-16 — **the ⌥ reveal stops destroying the title, on both
graph views.** The canvas change is three lines in the ADAPTER and nothing else: `title={data.title}`
unconditionally, `subtitle={technical ? data.technicalTitle : data.subtitle}`. `technicalTitle`
already rode on `data`, so **no new `PhaseNodeData` key, no projection change, no snapshot movement**
(`git status --porcelain` empty for `PhaseNodeCard.tsx`, `canvasModel.ts` and `__snapshots__/`).
With the reveal ON the card title now EQUALS its reveal-OFF title and the **whole slug reaches the
DOM uncut** — the subtitle slot wraps where the title slot is `truncate` at 14px in a 248px card,
which is the measured finding that decided sketch 149-C. `technicalLine` is still NOT passed: the
slot stays Phase 188's, and the reservation comment was MAINTAINED to say so rather than left.
The spine got **title agreement only** (D-187-16): `nodeTitle(phase, nameContext)` in both toggle
states, a new optional `nameContext` prop threaded to that call and nowhere else, and its raw
`phase_type` chip / `phase_index` line / `aria-label` template untouched — **0 non-comment diff
lines** match any of the three. `PhaseNode.test.tsx` is **net-new (13 tests)**: the adapter had no
suite of its own, which is why the reveal could destroy the title unnoticed for four phases.
`PhaseSpineGraph.test.tsx` 14 → **20**; `PhaseNodeCard.test.tsx` unchanged at 68; the 8-file
verification set **980 passed, 0 failed** (bar 863); the three `WorkflowCanvas` suites 111 passed;
7 consumer suites 265 passed. **Both halves observed RED** — 5/13 then 6/20 — before GREEN.
**Carry forward:** (1) **`PhaseSpineGraph` is no longer a `TechnicalNamesProvider` consumer.** With
the title no longer swapping, nothing it renders depends on the reveal, and BOTH `tsc -b` (TS6133)
and ESLint refused the dead read — so the subscription was removed, not left. The app-wide provider
is untouched and still the ONE technical-names state; a consumer was removed, none added.
(2) **187-15 owes `nameContext` to the spine mount** in `WorkflowBuilderPage.tsx`, one prop beside
the canvas prop 187-08 added; omitting it is byte-identical to HEAD and is pinned by its own test.
(3) **The D-ITEM-183-02 guard trap fired TWICE during execution** — two first-draft source guards
were satisfiable only by deleting the explanation of the change they checked. Both re-anchored on
code-only forms; the retired swap expression now survives exactly once, as a guard's positive
control. Anchor every 187 source guard on a form only CODE can have. (4) `tsc -b` re-measured
independently: **33 errors, 0 in `components/workflows`, identical before and after** — D-ITEM-01's
reading holds, inherited unmeasured. (5) `ProblemsTray` was audited for a card↔row disagreement and
has none: it never swapped — it keeps the plain name and ADDS a mono technical line, the same
principle 149-C locks. No edit, no deferred item.

**Plan 187-10 COMPLETE (Wave 2, 2026-08-02, `fcd94282` → `4f0f9787`).** VOCAB-01/02/03 / D-187-07 /
D-187-08 / D-187-10 — **a seeded name now has an invalidation story, and both new surfaces have
their sentences in the one copy home.** `IDENTITY_BEARING_CONFIG_KEYS` (`definitionOps.ts:220`) is
one exported `ReadonlySet` — `skill_ref`, `folder_scope`, `available_tools` — and `patchPhaseConfig`
reads the trigger off the PATCH's keys once, then clears **both** `name` and `name_seeded_by_ai` with
`delete` (never `= undefined`, so a phase that carried no name comes back with no name KEY). The
face then falls to `derivedFaceOf` and resumes tracking: the named test asserts the user-visible
consequence through `nodeTitle`, `"Check supplier pricing"` → `"Run the pricing policy check"`. A
**hand-typed** name survives every identity-bearing patch (marker absent AND explicit `false` both
tested). `setPhaseGovernance` is untouched — `git diff -U0 | grep -c PhaseGovernancePatch` returns
**0** across both commits. Task 2 added **11 exports** in the shipped copy-constant register:
`SEED_RECEIPT_*` (7) and `STARTER_DOOR_*` + `StarterChoiceJSON` (4). `definitionOps.test.ts`
**189 → 222**; both tasks observed RED (6/203, then a collection error); `tsc -b` **33 errors, 0 in
`components/workflows`, identical before and after** (D-ITEM-01, re-measured a third time).
**Carry forward — 187-13 and 187-14 own the two unwired surfaces:**
(1) **`seedReceiptGroundingLead(0)` returns `""`** — 187-13 must call it FIRST and render the
grounding paragraph + step list only when non-empty; that IS D-187-10's zero case and the whole of
the conditional. Each step's `cause` comes from `groundingCauseOf(phase, kbTools)` and the `tool`
from the real `available_tools ∩ kbTools` intersection — **do not hardcode `search_documents`**.
(2) **`StarterChoiceJSON` accepts a raw `listStarterWorkflows` row with no adapter**, pinned at
compile time by a type-only `PublishedWorkflow` assignment in `definitionOps.test.ts`.
(3) **One honesty correction, in the open:** the plan's phrasing "the fields the derived tier READS"
does not literally cover `available_tools` (`derivedFace` never reads it). The docblock states the
rule one notch wider — *an edit that could change what the step's face SAYS about that step* — and
justifies `available_tools` on its own terms (it decides `groundingCauseOf`'s `detected` branch).
D-187-07's member list is unchanged. `phase_type` is deliberately absent, measured: `PhaseFormPanel`
only READS it (`:719`), so no patch through this seam can carry it.
(4) **The template arm of the demote is DORMANT, not reachable** — the template filename is
definition-level (`assets[]`) and `frontend/src` has **zero** `assets` references outside docblocks.
Implemented and tested at the pure-function level only; nobody may claim a user can trigger it.

**Plan 187-11 COMPLETE (Wave 3, 2026-08-02, `3dfd47a4` → `a8410b27`).** VOCAB-02 / SC#6 / SEED-137 /
D-187-01 / D-187-18 — **the armed-checkpoint property is green AND has been watched fail again.**
`test_187_armed_checkpoint_property.py` is **30/30** (one keyword: `_drive` now passes
`total_phases=TOTAL_PHASES`, matching `run_workflow`'s one production call site — 187-06's diagnosis
was re-verified from the failure text, not trusted). Then the whole 49-line checkpoint block was
**removed** from `harness_engine.py` and the property went **17 failed / 13 passed on the RECORDED
assertions** (`assert armed_orders` / `assert len(armed_orders) == 1`, observed 0 prompts,
`body_invoked=True`, `outcome='completed'`), before being restored and re-verified green.
**The falsified RED set is a strict SUPERSET of 187-01's HEAD RED set (8 ids), and the reason is
measured:** on HEAD `effective_phase` still appended the armed spec, so the four rows with no author
pre gate ahead of it were still asked; 187-06 deleted that synthesis too, so with the checkpoint gone
NOTHING can ask. `pre_fail_run` / `pre_skip_to_phase` stay green in **both** states (D-187-02). All of
it is written into the file under `## Falsification observed after the fix`.
**Census re-shaped:** `_armed_phase()` rebuilt as `action_risk_armed=True` + the AUTHOR's validators;
9 shipped armed tests re-pointed at `is_action_risk=True` / `failed_idx=None`; criterion 18 re-shaped
VISIBLY with a 30-line D-187-01 comment (substance — 5 phases in / 5 out, every `phase_index` and
`slug` identical — asserted more strongly than before, on a real `WorkflowDefinition`). **One net-new
test** proves an armed checkpoint on a `fail_run`-declaring phase still awaits the rendezvous.
**Carry forward, four things:**
(1) **The four regression-net tests are AST-identical to HEAD** — measured with `ast.parse` over
`git show HEAD:<file>`, because the plan's `git diff | grep` form returns **2** benign hits (a git
hunk-header function label + one prose reference in a new docstring). Use the AST form; the grep
cannot tell a body edit from a context label.
(2) **`_drive_failing_pre_gate` must stay byte-identical.** After the hoist it can only reach an
AUTHOR's failing pre gate, which is exactly what the freshness regression net measures. The armed
rows use the new sibling `_drive_armed_checkpoint`, which lets the REAL `run_gates` pass and asserts
the effective armed phase carries **zero** validators up front.
(3) **`"action_risk:approval|" + eff.validators[0].config["prompt"]` now raises `IndexError`** — an
armed `execute_code` phase's effective validator list is empty. Compose the finding with
`_armed_finding()` (engine prefix + `grounding._approval_sentence`), never from a spec's config.
(4) **`pytest tests/ → 0 failed` is NOT a usable gate on this tree.** Measured: `tests/` = 211 failed
(mostly `tests/integration`, needs live Redis/Supabase); `tests/unit` = **62 failed / 1693 passed**,
against a pre-dispatch baseline of 86 / 1668. The 24 in-flight went to 0 and the 62 pre-existing rot
stayed at 62, identical file-for-file. Compare deltas against a measured baseline, not against zero.

**Plan 187-12 COMPLETE (Wave 3, 2026-08-02, `cb0ca5d9` → `46ba6915`).** VOCAB-01 / SC#5 / D-187-15 /
D-187-16 — **both SC#5 checks are now falsifiable over the shipped corpus, as pure-function sweeps.**
`phaseVocabulary.corpus.test.ts` is **42/42**; the 8-file vocabulary set plus it is **1022 passed, 0
failed**. Check 1 (no slug, no raw `phase_type` token in any reveal-OFF face) matches on word
boundaries and derives its forbidden list from `PHASE_TYPE_SENTENCES`, so a 7th type is covered the day
it exists. Check 2 is D-187-15's narrowing, made executable as `materialConfigKey` = `phase_type` +
`skill_ref` + sole `folder_scope` + template applicability.
**The SPEC's "check 2 FAILS on HEAD today" is now a count over named members, not a slogan:** under the
pre-187 two-tier resolution **2 of 15** members violate it — `branching` (`assess` + `draft`) and
`non-contiguous phase_index [0,1,3]` (`second` + `stranded`), both rendering `"Write it up"` — and
**0 of 15** under the shipped four-tier ladder. Observed, not asserted: the sweep was momentarily
pointed at `preDerivedFace` and ran **2 failed / 40 passed**, then restored green; both states are
pinned permanently by a falsification-control block.
**Carry forward, four things:**
(1) **The honest scope of that result** — both violating members are the two HAND-AUTHORED fixtures
this plan extended. No *real* transcribed member (4 seeds / 3 starters / PM pack) has a
materially-different pair at all, because every step that differs materially also differs in
`phase_type`. A test records exactly that, so nobody later reads the 2→0 as bigger than it is.
(2) **`contextFor(fixture)` in the corpus test is the 3-line shape 187-15 owes at the page** —
`assets.find(a => a.kind === "template")?.filename` → `NameContext.templateFilename`. The fixture
transcribes `assets[]` WITH its `kind` rather than a pre-resolved filename precisely so the filter
under test is not deleted.
(3) **A new derived tier must edit `materialConfigKey` in the same commit**, or check 2 stops measuring
it and goes quietly green.
(4) **Do not add an `ALL_FIXTURES` entry casually** — it writes a new projection snapshot block, and
the plan gates on `__snapshots__` staying byte-identical. Both new witnesses extend existing
hand-authored fixtures. `conftest.py` was NOT edited (`git status` empty, plus a named test asserting
the seed shape). The directory-wide vitest run shows 7–8 failures across `PublishGauntlet`,
`WorkflowCanvas` and `WorkflowBuilderPage.canvas` — **all three are 100% green in isolation (46 / 35 /
88)**; that is SEED-056 flake, re-confirming 187-CONTEXT's correction, and is not this plan's.

**Plan 187-13 COMPLETE (Wave 3, 2026-08-02, `a91a5ed7` → `a50ca3de`).** VOCAB-02 / Req 5 / D-187-08 /
D-187-09 / D-187-10 / D-187-14 — **the seed receipt exists as its own component file** (296 L) with a
33-test suite (533 L). `SeedReceipt` is a pure caller-driven leaf: `{ phases, kbTools, nameContext?,
open, onDismiss }`, `open === false` returns null, and it authors **no sentence of its own** — all four
sentences and both per-step reasons are asserted character-identically against their `definitionOps`
exports. The cause per step comes from the shipped `groundingCauseOf` over the server's `kbTools` prop
and the named tool is the **real** `available_tools ∩ kbTools` intersection: `grep -c
"search_documents\|KB_TOOLS"` is **0**, and a test grounds a step on a tool id (`consult_the_archive`)
that appears in no fixture and no constant, proving the palette is the server's. D-187-10's zero case
is the whole of the conditional — `seedReceiptGroundingLead(0) === ""` — so a bare draft still renders
the heading and the nothing-committed close with **no list node at all**.
**Falsification observed, not assumed (three ways):** the suite's own first run was **5 failed / 28
passed**; making the grounding block unconditional reds **5**; naming the head of `available_tools`
instead of the intersection reds **2** (the second fixture row lists a non-KB tool first precisely for
this). Both mutations reverted and re-verified green before either commit.
**Carry forward, four things:**
(1) **`WorkflowBuilderPage.tsx` is untouched** (`git status --porcelain` empty) — the single gated
mount line is **187-15's**, per D-187-14. The receipt is indifferent to where it mounts; `open` and the
in-memory per-draft dismissal (D-187-09 — a reload re-showing it is CORRECT) are the page's.
(2) **`grep -ci delay` on `SeedReceipt.tsx` must stay 0.** The no-staging fence is outright, in code
AND in prose — a comment is where "we could stagger this later" gets written down. Three component
comments were reworded to *"waits its turn"* so the strong fence could stand.
(3) **No reveal accessor is read**, deliberately: the receipt shows no technical token of its own (a
test asserts none of the five fixture slugs appears in its `textContent`). The tool id inside a
`detected` reason is NOT gated — `seedReceiptStepReason` reserves its unqualified form for *"the tool
is not known"*, so hiding a tool we do know would make the copy claim something false.
(4) **Three guard defects were found and fixed on the suite's first run** — a membership helper that
resolved a row's CHILDREN as rows (now `[data-slug]`, never a testid prefix), a fixture whose slug
`pricing` sat inside its own step name, and a `\bhidden\b=` fence that fired on the component's own
correct `aria-hidden`. All three are the same class: a guard that measures something other than what it
claims. `npx tsc -b` = **33 / 0 in `components/workflows`**, identical to HEAD (D-ITEM-01).

**Plan 187-22 COMPLETE (Wave 9 / gap-closure round 4, 2026-08-03, `fbf07b49` → `ef4e59e7` →
`4b0fe96e` → `31bb6af6`).** VOCAB-02 / Req 5 / CR-04 — **the BLOCKER: the seed receipt now describes
the generation that produced it and nothing that happened afterwards.** CR-04 was a DATA-FLOW defect,
not a copy defect: `<SeedReceipt phases={phases}>` was handed the LIVE `useStore` selector, while
`PhaseFormPanel` sits on the same screen writing the exact field the card's grounding classification
reads — so a post-arrival edit made the past-tense, first-person copy ("so I set them to must prove
it") claim the author's own act as the AI's. Fixed in the CALLER: a `receiptPhases` snapshot captured
beside the single `setDrafted(def)` transition, replaced on every generation (D-187-09), handed to the
mount in place of the selector. **One mechanism closes all three input paths** (`available_tools`,
`phases.length`, the grounding dial) — the two prior rounds had fixed this class by editing what the
copy SAYS; this one fixed where it READS FROM. **RED observed before / GREEN after**, both transcribed
raw in the SUMMARY: 3 failed / 113 passed → 404 passed, each failure a text/count mismatch against a
captured arrival baseline with its positive control passing first. D-187-14 cap held **by measurement**
— `git diff --numstat` = **8 ins / 1 del** against ≤ 15 / ≤ 2, the render body gaining no line (one
identifier). Two falsifications observed and cleanly reverted: caching inside the leaf reds 3 cases,
reverting the mount prop reds 4. `rerender(` in `SeedReceipt.test.tsx` **0 → 4**; counts 113 → 117 and
60 → 63; flag-OFF byte-identity guard still 34/34. Zero backend files, zero migrations, zero SDK
completion verbs.
**Carry forward, four things:**
(1) **The `<planner_note>` is CONFIRMED, and matters beyond this plan** — `187-REVIEW.md`'s proposed
fix and its proposed test contradict each other. `SeedReceipt` is a pure projection, so the review's
component-level falsification would still fail after the review's own fix, and could only be made green
by caching inside the leaf. **A review's suggested test is a claim to verify, not an artifact to copy.**
(2) **Three inherited claims measured FALSE** — the plan's `grep "phases={phases}" returns nothing`
criterion is unsatisfiable (3 mounts at HEAD; the canvas and spine correctly read live state and are
the ledger of *current* governance, T-187-R4-02), and the canvas suite's "prior 22" is really **113**.
Re-derived: the fence extracts the `<SeedReceipt>` element specifically.
(3) **The snapshot's safety precondition was verified, not assumed** — `setDrafted` destructures
without copying, so `def.phases` IS the store's initial array; every `definitionOps` op
(`patchPhaseConfig`, `setPhaseGovernance`, `assignIndices`, `orderPhases`, `addPhase`,
`insertPhaseAt`, `movePhase`) is immutable-by-construction. No defensive copy needed.
(4) **`SeedReceipt` is now source-fenced against `useState`/`useRef`** (needles assembled from parts,
`useMemo` explicitly excluded so the fence does not fire on the shipped derivation). The tempting wrong
fix for CR-04 can no longer land silently.

**Plan 187-23 COMPLETE (Wave 10 / gap-closure round 4, 2026-08-03, `f59af16a` → `7b1356c3`).**
VOCAB-02 / Req 5 — **WR-11 + WR-15: the escalated row now says what its bit knows, and a 4th grounding
cause is a typecheck error.** 187-20 deleted the carried paragraph's cause claim and recorded, in its
own docblock, that naming the cause is the ROW's job. But the row's `escalated` sentence was not a
statement about a cause — it was a statement about a PERSON ("you turned this on by hand") over a
BOOLEAN that records only that the lock is authored rather than derived. Now:
`it was set to must prove it by hand` — actor-free, same `it …` register as its two siblings, and the
governance words **composed from `GOVERNANCE_SEAL_LABEL`** rather than typed a third time.
**The reachability hypothesis is RESOLVED, by executing the model rather than reading it:**
`grounding_escalated` IS in the emit tool's advertised schema (`{'default': False, 'type': 'boolean'}`),
an emission carrying it `model_validate`s, `model_dump` carries it, and `generate_workflow_definition`
re-stamps only `name_seeded_by_ai` + `slug` (`workflow_authoring.py:341-377`) — so the PATH is observed
end-to-end; only a provider *choosing* to emit it stays reachable-by-schema. The review was one notch
too weak on the first half. Beside it, WR-15: `case null:` is now its own arm and `default:` is the
file's own `requiredConfigFor` / `deriveTier.ts:119-127` **`never` guard**, because `SeedReceipt`
renders the reason UNCONDITIONALLY after an em-dash — an unhandled member shipped a seal with a
dangling dash and no reason, on the one surface Req 5 forbids that. Counts re-measured at HEAD, never
inherited: `definitionOps.test.ts` **228 → 231**, `SeedReceipt.test.tsx` **63 → 66** (the plan's
inherited `60` was already stale). Task-1 RED was **exactly one** case — the single character-identity
pin — proving the sentence has one home. **Three falsifications observed and cleanly reverted:**
second-person wording reds the identity pin AND the property fence; a bare `default: return ""` reds
the source half ONLY (empirical proof the runtime half cannot see a typecheck guard, which is why the
pin has two halves); an empty escalated reason reds the DOM invariant with the defect printed in the
reader's own words (`⛨Must prove itWeigh the supplier opti… —`). Zero backend files, zero migrations,
zero SDK completion verbs.
**Carry forward, three things:**
(1) **`npx tsc --noEmit` from `frontend/` is a VACUOUS check** — the root `tsconfig.json` is a solution
file with `files: []`, so it type-checks ZERO files and exits 0 with no output. It can neither
reproduce D-ITEM-01's 33 errors nor detect a new one. Use `npx tsc --noEmit -p tsconfig.app.json`
(33 → 33, byte-identical output here). Logged as **D-ITEM-187-23-02**; a second, separate trap from the
recorded `tsc -b` ≠ `--noEmit` lesson.
(2) **`GROUNDING_WHY_ESCALATED` (`definitionOps.ts:475`) still carries the retired second-person claim**
on the PANEL surface ("Because you turned this on by hand."). Same bit, same argument, weaker case (it
renders beside the dial the author is operating). Scoped out per the plan's "change nothing else in
this file" — logged as **D-ITEM-187-23-01** with a re-open trigger: the next plan touching the
grounding dial's copy or `PhaseFormPanel`'s governance section.
(3) **Prefer type-system exhaustiveness over enumeration** — the Phase 185 lesson ("a deny-list cannot
be made fail-closed by extension") applied verbatim. And the review's suggested DOM test was NOT copied:
one assertion over one fixture would have passed before AND after the fix; what shipped is the property
over all three sealed fixtures plus the consequence plus a positive control, and probe 3 saw all three
bite.

**Plan 187-24 COMPLETE (Wave 11 / gap-closure round 4, 2026-08-03, `c4972bde` → `576a0e31` →
`17c6e338`).** VOCAB-02 + VOCAB-01 — **WR-14 + WR-12 + WR-13: one predicate with one home, and round
3's own two guards turned from gestures into measurements.** (1) `SeedReceipt.tsx` re-implemented the
`available_tools ∩ kbTools` loop ONE LINE after its `groundingCauseOf` call while its docblock claimed
"there is no second derivation to drift". The membership TEST itself is now extracted — `firstKbTool`
in `phaseVocabulary.ts`, read by `groundingCause`'s detected branch AND by the new
`intersectingKbToolOf` — so agreement is by construction, not coincidence, and the receipt declares no
predicate at all. Pinned by a **biconditional over a 12-phase table** (`detected` iff dial AND resolver
names a tool; the dial gate is the classifier's alone, so both halves are asserted) plus a source
fence. (2) The WR-09 fence was a deny-list of the DELETED clause: re-derived at HEAD, both needles
match **2 lines in all of `frontend/src`, BOTH prose**. It now carries a positive control over its own
needles *inside the same `it`* and asserts a **word-class property** over causal connectives; the two
historical wordings survive beneath it as regression pins, never as the fence. (3) The testid sweep
measured a MENTION: comments strip first now, all three static JSX spellings are extracted, and the
sibling `data-*` state class (`data-carried-count` and its four siblings) gets its own case with its
own non-vacuity. Counts re-measured at HEAD: `phaseVocabulary.test.ts` **90 → 96**, `SeedReceipt.test.tsx`
**66 → 68**, `definitionOps.test.ts` **231 → 232**; named five-suite set **475 → 484**. tsc
byte-identical at 33 after every task. **Nine falsifications observed and cleanly reverted**, including
all five WR-13 probes — the OLD sweep failed only the first, the NEW one fails all five.
**Carry forward, four things:**
(1) **A review's suggested ARTIFACT is a claim, not a patch — third round running.** WR-13's proposed
extraction regex admits backticks and swallows the TEMPLATE row testid `seed-receipt-step-${row.slug}`
as a static id, demanding a query for that literal string: a guard red on correct code. Narrowed, and
the `${`-exclusion is now asserted rather than implied.
(2) **Two needles were tried and REJECTED for firing on the correct code they sit beside** — a
`kbTools`-in-signature match (the component's own destructured props contain `kbTools`) and a
`for (const ` match (the component's own row derivation). Both rejections are written INTO the guard, so
the next author does not re-add them.
(3) **`git checkout --` is not a revert for an UNCOMMITTED task** — it restores to HEAD and silently
wipes the task's own edits along with the plant. Use a targeted plant/unplant that reverses exactly what
it applied, and check `git diff --stat` against what it *should* show rather than against zero.
(4) **`groundingCauseOf` reads `phase.config` UNGUARDED**, against its own module's totality contract
(`nodeTitle` and `derivedFaceOf` both guard it). `intersectingKbToolOf` deliberately MIRRORS it rather
than diverging — a defensive guard on one of two functions called one line apart cannot fire. Logged as
**D-ITEM-187-24-01**; re-open trigger = the next plan free to change a shipped `phaseVocabulary` export's
behaviour, which must fix both in one commit.

(`3713a716`), GOVERN-01/02/03 all `Complete`, `nyquist_compliant` true, SECURED 49/49 (`a00b1cc5`).
Security found one real fail-open BLOCKER — T-185-04-01, a **typed** refusal on an armed checkpoint ran
the step and filed a false approval receipt — fixed by quick task `260731-3y4` (`417728bd`) and
**confirmed live in the browser** on run `5d3a4707` (run failed, step never ran, zero receipts).

**Next: Phase 187 — Business Vocabulary + AI-Seeded Canvas.** Phase 186 is **CLOSED** as of
2026-08-01 (superseded wording preserved below rather than deleted).

**⚠ G-2 FIRES ON 187 — sketch before spec/discuss.** ROADMAP lists 187 in the sketch-first set
(plain-language node verbs + the Technical-names reveal + the NL-seeded canvas are all "feels like"
surfaces). The operator-approved mockup is the acceptance bar, so `/gsd:sketch 187` precedes
`/gsd:spec-phase 187`. Also inherited: **SEED-137 is folded in as 187's SC#6** — an armed
action-risk checkpoint can today be preempted by an author-declared `timing="pre"` validator, so the
gate is never asked and the step runs unapproved; it was folded here precisely because it falsifies
SC#3's "safe-by-construction" claim. 187 therefore **carries a threat model** (the fix touches the
D-185-05 attachment seam). Related open todo: `.planning/todos/pending/spike-nl-workflow-authoring.md`.

**Phase 186 close-out record (2026-08-01):** 20/20 plans · verification **`passed` 9/9** ·
operator UAT **6 passed, 0 issues, 2 skipped-with-reason** (`4d446670`) · **SECURED 112/112, 0 open**
(`74ccd224`) · CONCUR-01/02 both `Complete` · `nyquist_compliant` **true**. The per-task map's 20
rows had sat at `pending` the whole phase and were flipped on a **measured** re-run — frontend
443/443, backend 46/46 — not on assumption; the single parallel-run failure is a named 5 s-timeout
flake (46/46 in isolation under `--fileParallelism=false`) and `pytest -rs` shows the live-DB rows
ran 17/17 with **0 skipped**. **CR-03 was REFUTED, not worked around:** plan `186-18` shipped the
ordering fix, so the `saving` guard now sits ABOVE the flag gate (`WorkflowBuilderPage.tsx:1094` vs
`:1095`) and UAT row 8 drove that exact flag-off surface live.

**Carried forward from 186 (non-blocking, but unscheduled):**

- **WR-19 / WR-20** — hold-release honesty gaps in `useDraftPersistence.ts` (`:915`, `:889-891`).
  Not write-safety: `markSaved` is uncalled and `dirty` stays true, so no false receipt is possible.
  They still owe `deferred-items.md` entries with concrete re-open triggers — the WR-14..18 treatment.

- **Draft PATCH accepts a negative `max_steps`** (200 + persisted, DB-verified during UAT). Wants a
  server-side sanity clamp. Not a 186 defect — draft PATCH validation shipped in 183/184.

*(Superseded — accurate when written, preserved not deleted:)* ~~Phase 186 — ALL 17 PLANS EXECUTED
… **The phase is NOT complete:** the seven operator-driven rows in `186-VALIDATION.md` (1, 2, 3, 3b,
5, 6, 7) are still `to run` … **no requirement status has been advanced**.~~
CONTEXT gathered 2026-07-31 (`0a200d51`), 17 decisions (D-186-01..17); PLAN committed 2026-08-01
(`a4c4eb86`, 8 plans / 5 waves) — all 8 executed. Gap-closure plans 186-09..13 (waves 6-8) then
executed 2026-08-01 — **13/13 plans complete, all tasks done, zero plans outstanding.**

**Second gap-closure round PLANNED 2026-08-01 — 4 plans (186-14..17) in waves 9-10 (`a2dffab2`),
plan-check PASSED (0 blockers, 1 warning applied inline).** Operator scoped the round to
*blocker + interacting warnings*; IN-01/03/04/06 stay deferred, and truth 8 / SC#4's seven
`human_verification` rows stay operator-owned live UAT (not plannable code).

| Plan | Wave | Closes |
|---|---|---|
| **186-14** | 9 | **GAP-4 / CR-02 (blocker)** — `reload`'s catch RESTORES `{kind:"conflict"}` (guarded on `haltedRef` still true, so it can't manufacture a conflict), and the "why" becomes an EXTRA banner line via a new `note?: string` — never a replacement for the sentence that offers the exits. Plus **WR-07**: `isTerminalRefusal` gains `WorkflowConflictError` so a frozen published row stops yielding a doomed PATCH per edit. |
| **186-15** | 9 | **WR-11** — the pane-click assertion is retargeted to a call-count DELTA with its own positive control (a `grep -c "toHaveBeenCalledTimes(0)" >= 4` criterion structurally pins the ✕/Escape siblings against weakening). Plus **WR-06 residue**: per-test skips + DB-free coverage of the `stale_token` 409 wire shape. |
| **186-16** | 9 | **WR-10** — the inner Publish is gated on the live `blockedReason` (new `saving` branch), reason rendered in the modal. The review's preferred `flushPendingWrites()` seam was **rejected on a safety argument**: `PublishGauntlet` mounts on BOTH branches of the flag gate, so a flush from `runGauntlet` would issue an unrequested PATCH on the flag-off surface — the D-181-01 leak 186-13 just closed. Rejection recorded in `deferred-items.md` with a re-open trigger. |
| **186-17** | 10 | **WR-08** — the drain SPLITS two questions: payload identity alone decides the *receipt* (CR-01 preserved), `pendingRef` alone decides *immediate re-entry*; the new `break` also resolves `{kind:"saving"}` → `idle`. Plus **WR-09**: the hold resolution moves ABOVE every gate including `!enabled`, so the "Publishing —" sentence never outlives the hold on either surface. |

**Wave 9 → 10 is sequential by construction:** 186-14 and 186-17 both own `useDraftPersistence.ts`.
186-15 and 186-16 share no file with either, so they run beside 186-14 in wave 9.

**▶ PLAN 186-14 EXECUTED 2026-08-01 — GAP-4 / CR-02 (the phase's only remaining BLOCKER) and
WR-07 are CLOSED IN CODE.** 3 tasks, 3 commits (`ae19e5ca` fix / `67032b38` feat / `4f4574d0` fix)
plus `293f1176` (SUMMARY). Zero migrations (head still `114_…`), zero dependency changes,
`vite build` exit 0.

- `reload()`'s catch now restores `{ kind: "conflict", currentToken, note: RELOAD_FAILED_NOTE }`
  whenever `haltedRef.current` is still true, and mutates nothing else — a failed EXIT is not a
  failed WRITE. Guarded on the halt, so a reload that failed OUTSIDE a conflict still keeps the
  cause-neutral line (F21f is that falsification).

- `builder-conflict-note` renders as a SECOND LINE inside the banner, under the locked sentence,
  with both exits still mounted, enabled and in D-186-08 order.

- `isTerminalRefusal` now halts on `WorkflowConflictError` too (RED: 4 PATCHes where 1 is
  expected). No banner for it — a frozen row has no exits, and `PUBLISHED_CONFLICT_MESSAGE`
  already names the way out (Tweak) and stays on screen for the session.

- Tests: hook **40 → 46**, `BuilderSaveRegion` **8 → 11**; the 6-suite aggregate is **244/244**.
  Both REDs observed and recorded verbatim in the SUMMARY, with the `haltedRef` write-site
  enumeration (4 writes, 2 clears, both inside the two exits on the one surface) as the
  goal-backward proof GAP-4 has no third home.

- **Three MEASUREMENT deviations recorded, no code deviations:** (a) F21b/F21c passed in RED — the
  loop was always recoverable at the HOOK level; GAP-4 was a *reachability* defect (the surface
  lost both controls), so F21c is a regression guard, not the falsification; (b) the plan's
  `grep -c 'kind: "conflict"' == 3` criterion overlooked the pre-existing `Extract<PersistState, …>`
  annotation — the count is 3 → 4, with still exactly TWO producers; (c) **the WR-11 session row the
  re-verification recorded as failing 3/3 "including full isolation" PASSED here** — the 4-suite
  Task-2 command returned 145/145. 186-15 owns that row; do not assume either claim without
  re-measuring.

- **186-17 must RE-READ `useDraftPersistence.ts` before editing** — its `<interfaces>` line numbers
  are now stale (the file grew ~75 lines: `reload` :795, its catch :845, `isTerminalRefusal` :424,
  `performWrite`'s catch :614). This is exactly why waves 9 and 10 are sequential.

- `186-VALIDATION.md` gained **manual row 7 — Conflict-exit failure** (`to run`): reach the banner,
  go offline, press Reload, confirm the banner + both exits + the note survive, then restore the
  network and confirm a second Reload succeeds. No existing row changed.

⚠ **Executor warning carried into 186-17 Task 1 as a machine-checked criterion (not prose):** the
WR-08 fix must RETARGET `driveMidFlightEdit` — the shared driver behind F17a/b/c, whose
`toHaveBeenCalledTimes(2)` currently depends on the very `continue` being removed. F17's three
literal assertions (`toHaveBeenCalledTimes(2)`, `toHaveLength(4)`, `.toBe("T1")`) must survive
byte-identical; a scoped `git diff` showing changes only inside the helper body is the proof. A
green suite with a weakened F17 FAILS the task.

**▶ PLAN 186-15 EXECUTED 2026-08-01 — WR-11 and the WR-06 residue are CLOSED.** 3 tasks, 3 commits
(`165b3e0e` / `03841bd0` / `c4870806`) plus `19329bf2` (SUMMARY). Two test files only — measured
`git diff --stat e9f9c2fd..HEAD` = 2 files, 422 ins / 8 del. Zero migrations (head still `114_…`),
zero dependency changes in either stack.

- **WR-11**: the pane-click row now measures a call-count DELTA bracketed around the dismissal, with
  its POSITIVE CONTROL in the same row (an explicit Save must show a delta ≥ 1). The ✕/Escape
  siblings and all three `mockCreate` zeros are untouched — `toHaveBeenCalledTimes(0)` still appears
  **12** times, and there is no `it.skip`/`xit` anywhere in the file. Count 23 → 23.

- **WR-06 residue**: module `pytestmark` → four per-test `skipif(not PG_AVAILABLE, reason=
  _LIVE_DB_REASON)` (the 186-11 precedent, reason byte-identical), plus **9 new DB-free tests** —
  four at the route tier (`stale_token` / `already_published` / the codeless-404 collapse incl. an
  UNRECOGNISED cause / `CheckViolationError`) and five at the db tier (all four return shapes, the
  `token=None` defensive collapse, and the two SQL properties: `CONCURRENCY_TOKEN_SQL` in both the
  WHERE and the RETURNING, `created_by = $2` on the probe, no bind ever a `datetime`).

- Numbers: file **4 → 13 passed** live; **0 passed / 4 skipped → 9 passed / 4 skipped** with
  `POSTGRES_DSN` unreachable. Verification trio **12 → 21 passed** live, **3 → 12 passed** no-DB.
  Collection **3465 → 3474** (+9 exactly). Full backend suite **211 failed** both before AND after
  (pre-plan baseline taken deliberately), passed **3228 → 3237**; no phase-186 file is among the
  211 pre-existing failures.

- **All new backend tests were FALSIFIED against real source with no database**: renaming the 409
  detail's `token` key, giving the fail-closed 404 a machine code, and dropping `created_by = $2`
  from the owner-scoped probe each turned exactly one new test RED. Every injection reverted
  file-scoped; both source files verified clean.

- ⚠ **THE PLAN'S REQUIRED RED DID NOT REPRODUCE, and was not fabricated.** The shipped WR-11 row
  PASSED here in every configuration: **23/23 three times in isolation, 50/50 paired, 260/260 under
  16-file parallel load** — matching 186-14's report and contradicting the re-verification's 22 + 1
  (3/3). The diagnosis was confirmed anyway by INJECTING a 1500 ms pause between the pane appearing
  and the click (standing in for a lazy import slower than the 1000 ms `AUTOSAVE_DEBOUNCE_MS`): the
  shipped assertion then failed with the verifier's exact signature — `22 passed / 1 failed,
  "expected +0 times, but got 1 times"` — while the new delta passed 23/23 under the same pause.
  The positive control was itself falsified (snapshotting `mock.calls` instead of `.length` →
  `expected 0 to be greater than or equal to 1`). **Conclusion: the 186-12 / 186-13 "passes in
  isolation" claim was FALSE AS STATED — not because the row always failed, but because it was
  asserted as a property of the ROW when it was a property of the machine and the vite cache. The
  row had no true state; that was the defect. Quote none of these numbers without re-measuring.**

**▶ PLAN 186-16 EXECUTED 2026-08-01 — WR-10 is CLOSED.** 2 tasks, 2 commits (`e7b2b237` /
`3f06d112`) plus `f0384214` (SUMMARY). Four source/test files + `deferred-items.md`; 382 ins / 4 del.
Zero migrations (head still `114_…`), zero dependency changes.

- **The page half**: a new exported `SAVING_PUBLISH_WAIT` ("Saving your last change — Publish will
  be ready in a moment") and ONE branch in the `blockedReason` memo keyed on
  `persistState.kind === "saving"`, ranked **ahead of** the validation branches (the nearest
  obstacle is the one named). **+25 insertions exactly — the plan's cap** on this G-5 hot file; the
  memo body grew by 2 lines against a budget of 6, and the F16 fence anchor is byte-identical.

- **The gauntlet half**: `canPublish` gains `&& !blocked`, so the INNER modal Publish — the click
  that actually spends money, and the one gated on nothing but the input and `loading` — is refused
  too. The reason renders INSIDE the modal (`publish-inner-blocked-reason`, `aria-describedby`),
  because the trigger's reason sits behind the backdrop and an unreachable explanation IS R12's
  greyed-in-silence failure. `blocked` is handed DOWN, so the emptiness test keeps one home.

- Numbers, per file in isolation at 30 s: `PublishGauntlet.test.tsx` **41 → 46**; the canvas+header
  pair **111 → 114**; the 4-file acceptance set **183/183**, `vite build` exit 0.

- **The gate was FALSIFIED, not just run green**: removing `&& !blocked` reds exactly the 3 gate
  rows (the 2 identity rows correctly stay green). The refusal row measures the mocked TRANSPORT —
  a golden run's cost is spent the moment the request leaves — with the cleared-reason click as its
  positive control.

- **The review's preferred `flushPendingWrites()` was rejected on safety, and recorded**: the
  gauntlet mounts on BOTH branches of the flag gate, so a flush from `runGauntlet` is an unrequested
  PATCH on the flag-off surface — the D-181-01 leak 186-13 closed. In `deferred-items.md` with a
  re-open trigger, alongside the residual `conflict`/`error` case (bounded vs unbounded states).

- ⚠ **Four plan claims were refuted by measurement** (recorded in the SUMMARY, do not inherit):
  `PublishGauntlet.test.tsx` had **no** R12 blocked-trigger cases at all (every one lives in the
  canvas suite); the prop docblock's "24 shipped assertions" is stale (41); the canvas-pair baseline
  is **111, not the 141** the plan's verification block states; `WorkflowsPage.test.tsx` does exist.

**▶ PLAN 186-17 EXECUTED 2026-08-01 — WR-08 and WR-09 are CLOSED. This was the LAST plan of the
round; all 17 plans of phase 186 have now landed.** 2 tasks, 2 commits (`4b02ed18` / `fa6c1a03`)
plus `83b97669` (SUMMARY). Two source/test files + `186-VALIDATION.md`; zero migrations (head still
`114_…`), zero dependency changes, `BuilderSaveRegion.tsx` diff **empty**.

- **WR-08 — the drain asks TWO questions instead of using one answer twice.** Payload identity
  alone gates the RECEIPT (CR-01 preserved verbatim); `pendingRef` alone gates IMMEDIATE RE-ENTRY;
  every other supersession BREAKS after resolving `{kind:"saving"}` → `idle`, and the edit's own
  live debounce timer issues the follow-up. **Falsified: 11 PATCHes across 3 s of typing → 1**
  (F22a), and a Save press with nothing changed stopped minting a redundant token-bumping PATCH
  (F22d, 2 → 1). No second timer was added — D-186-01 intact. Both module docblocks the drain had
  made false are now true and stated as checkable rules.

- **WR-09 — the hold's reading resolves when the hold does, on BOTH surfaces.** The resolution sits
  above all three gates (halt, `enabled`, nothing-pending) because each is a reason not to WRITE
  and none is a reason to keep claiming a publish runs. RED was literally
  `expected 'held' not to be 'held'`. It is **functional** (`s.kind === "held" ? … : s`) so a
  `conflict` — the only reading carrying Reload/Overwrite — survives; F20h falsifies the wrong
  shape of the same fix. `heldPendingRef` on the flag-off path is set to the store's own `dirty`
  (F20f RED: a PATCH carrying the untouched 2-phase draft and the session's original token).

- **D-181-01 spot-check recorded in the SUMMARY**: four `performWrite()` call sites, gates
  unchanged from 186-13's enumeration — the two automatic ones behind `enabled`, `saveNow` and
  `overwrite` deliberately ungated because a person pressed them.

- Numbers, measured this session at 30 s: hook suite **46 → 53** in isolation; the 7-suite consumer
  set **270 → 277, zero failures**; canvas+session pair 110/110 (the WR-11 row did not fail);
  `vite build` exit 0.

- ⚠ **Six plan claims refuted by measurement** (recorded in the SUMMARY, do not inherit): the
  "three `pendingRef` arming sites" have been **one statement + three call paths** since 186-12, so
  `grep -c "pendingRef.current = true"` is 1 not 3; the consumer-set baseline is **270/270**, not
  the plan's "233 passed + 1 failed"; `grep -n "if (!enabled)"` cannot match the debounce effect's
  `if (!enabled || definition === null)`; `grep -c "continue"` is 2 because the docblock now names
  the hazard (one `continue` STATEMENT); F22a's RED is **parameter-dependent — 5 or 11** (a typing
  cadence longer than the round trip lets the storm self-terminate), both recorded; and F22c's
  STATE assertion cannot go red pre-fix because a request genuinely WAS outstanding.

- **`186-VALIDATION.md` row 3b was REWORDED, not added** (63 rows before and after): it now names
  both halves of the flag, including the flag-off requirement that the "Publishing —" sentence is
  GONE from the header once the gauntlet ends. Still `to run`.

⚠ **The `progress.completed_plans` counter was deliberately NOT incremented by 186-16 or 186-17.**
It reads
64 while `.planning/phases/*/NN-SUMMARY.md` counts **67 on disk** — it was already stale before this
plan and bumping a wrong base only launders it. The orchestrator owns the recount; do not treat 64
(or 65) as evidence of what has shipped.

**Decision-coverage gate skipped again** — same known parser quirk (CONTEXT.md uses `D-186-NN`,
the gate matches literal `D-NN`). Verified by hand instead: the new plans cite D-181-01, D-186-01,
-04, -07, -08, -09, -12 and D-182-06 in their `must_haves`.

**⚠ RE-VERIFICATION 2026-08-01 returned `gaps_found` again — 6/8 must-haves.** GAP-1 / GAP-2 /
GAP-3 and WR-01..WR-05 are all **genuinely closed**, each re-derived from source rather than trusted
from the SUMMARYs. But the re-review + re-verification independently found a **NEW blocker, GAP-4 /
CR-02**, in the same hook: `reload()`'s catch (`useDraftPersistence.ts:770`) sets `{kind:"error"}`
without clearing `haltedRef`, while the banner renders only on `conflict || resolving` — both false
after the catch. One flaky `listDraftWorkflows` on the **recommended default** conflict exit and the
draft is permanently unsavable for the session, behind a sentence that invites an impossible retry.
No test drives a rejecting reload. Five warnings also open: WR-06 residue (`stale_token` wire shape
has no DB-free coverage), WR-07 (a published-row 409 is unsatisfiable but never terminal), WR-08
(the CR-01 repair's `continue` gives back the debounce — one PATCH per round trip), WR-09 (flag-off,
"Publishing —" never resolves), WR-10 (Publish not gated on an outstanding write).

**A SUMMARY measurement claim was refuted:** 186-12 and 186-13 both record
`WorkflowBuilderPage.session.test.tsx > pane click — ZERO PATCHes` as a parallel-load flake that
"passes in isolation". It fails 3/3 including full isolation — the test encodes its claim as an
absolute call count while legitimately waiting up to 10 s for the lazily-imported canvas pane.
Product behaviour is correct; the test is wrong. Do not inherit the "passes in isolation" claim.

**CONCUR-01 ✓ satisfied; CONCUR-02 ⚠ partial — neither flipped to Complete** while GAP-4 and the
six manual UAT rows are open. Phase NOT marked complete.

**The prior (waves 1-5) reports are preserved:** `186-REVIEW-waves-1-5.md` keeps the definitions of
CR-01 and WR-01..WR-06 that the gap plans' `closes:` frontmatter references.

**⚠ `/gsd:verify-work 186` returned `gaps_found` — 4/7 must-haves verified (`8113deea`).** All 8
plans' tasks are done; this is a GOAL failure, not a task failure. Three blockers were independently
re-derived from source (not merely trusted from `186-REVIEW.md`), all in the one hook the phase built
to be the trustworthy seam, `frontend/src/hooks/useDraftPersistence.ts`:
**CR-01** an edit landing mid-flight before its own debounce timer matures is silently dropped while
the surface files `Saved ✓` — which also disarms `beforeunload`, the in-app leave guard and the blur
rescue, all keyed on `dirty`; **WR-01** `overwrite()`/`reload()` bypass the `inFlightRef` single-flight
check every other caller respects, so a double-click on the never-disabled Overwrite button manufactures
a conflict that does not exist; **WR-03** the hold-release effect never reads `enabled`, firing an
automatic unrequested PATCH on the **flag-off** surface — a direct hit against **D-181-01**, this
milestone's HARD gate #1. None were caught by the 1864/1864 frontend or 284/284 backend green suites —
they are interleaving/ordering defects the shipped tests do not exercise (the T-185-04-01 lesson again:
verify the PROPERTY, not the PATCH).

**Gap-closure PLAN committed 2026-08-01 (`1c65b6a0`, 5 plans / 3 waves; plan-check PASSED first
iteration, zero revisions).** Operator scope call: **all 3 blockers + all 4 warnings.**
Waves 6→7→8 are strictly sequential because 186-09/12/13 all modify `useDraftPersistence.ts`.

- **186-09** (W6) CR-01 — the receipt becomes a property of *what was written*: `performWrite` captures
  the payload's `phases`+`meta` identity at snapshot time and refuses `markSaved()` unless the store
  still holds it. Replaces the `pendingRef` queue-flag inference.

- **186-10** (W6) WR-02 — the missing `grounding_fidelity` row on the gauntlet spine, running index
  derived not hard-coded, and a coverage test sourced from `publish_service.py` itself.

- **186-11** (W6) WR-06 — the live-Postgres skip moves off the module onto the tests that need a DB, so
  the `draft_changed` invariant finally has DB-free CI coverage.

- **186-12** (W7) WR-01 — single-flight moves *inside* `performWrite`, becoming a property of the writer;
  caller-side checks deleted; both banner controls disabled while saving.

- **186-13** (W8) WR-03 + WR-04 + WR-05 — `if (!enabled) return` in the hold-release effect (D-181-01
  restored, proven by a flag-off test asserting **zero** network calls); the hold sentence stops promising
  a save the loop will not perform; a 404 halts the loop instead of retrying forever.

**Two delegated decisions locked in 186-13:** WR-04 → an honest held sentence (`HOLD_PUBLISHING_MANUAL`),
not a disabled button — because 186-02's stage-5 token guard is *not* flag-gated, so a flag-off write
mid-gauntlet would cost the person their whole golden run. WR-05 → halt + terminal sentence, **no
auto-recreate** — the 404-collapse is a deliberate existence-leak defence, so the client cannot
distinguish "deleted elsewhere" from "not yours", and silently minting a new row on an unclassifiable
refusal is worse than stopping.

**Gates:** requirements coverage ✓ (CONCUR-01, CONCUR-02 both claimed). Decision-coverage gate reported
*skipped — no trackable decisions*: the known parser quirk (CONTEXT.md uses `D-186-NN`, the gate matches
literal `D-NN`) — coverage hand-verified, not gate-verified. UI-SPEC gate (5.6) fired and was
**operator-overridden** (`--skip-ui`, 2026-08-01): gap closure on an already-shipped surface, no new UI
designed. Zero migrations — head stays 114.

**Still owed at re-verification:** the six G-4 manual UAT rows in `186-VALIDATION.md` are all still
"to run" (two-tab edit, stale tab, publish race, publish hold, KB re-bind ×3 paths, forced 422). They are
deliberately NOT plan tasks — per CLAUDE.md, UAT rows live in VALIDATION.md.

**Execution progress — Plan 186-01 COMPLETE (2026-08-01).** Wave 1's backend concurrency spine
shipped in 3 atomic commits (`42734175` RED suite → `684e63b2` SQL token + guard → `5cb1f5f7`
route), SUMMARY `e1e0f3fe`. The wire contract every later plan is written against is now live:
`CONCURRENCY_TOKEN_SQL`, `token: str` on `DraftCreateResponse`/`DraftRow`, an **optional**
`If-Match` header, and a 3-way refusal (404 code-less `draft not found` / 409 `already_published`
/ 409 `stale_token` + the current token). F1/F2/F3/F13 observed RED then GREEN. **Zero migrations
— head stays 114**; zero frontend files. Backend collected 3457 → 3461; the 211 full-suite
failures are pre-existing rot, proven by an identical failing set against baseline `a4c4eb86`.
⚠ **One consumer-visible change to carry forward:** a published-row PATCH now answers **409
`already_published`**, not the pre-186 404 (deliberate D-186-09 consequence).

**Execution progress — Plan 186-02 COMPLETE (2026-08-01).** Wave 2's publish-race guard (SC#3,
the highest-value item in the phase) shipped in 3 atomic commits (`7fa42425` RED suite →
`b4288727` two-sentinel `publish_definition` → `7fb4eeb3` stage-0 capture + `draft_changed`
branch), SUMMARY `90e543c8`. "We published what we validated" is now **structural** — a WHERE
conjunct on the stage-0 token, not a cooperative client hold. `publish_definition` gained an
**OPTIONAL** `token` keyword with **two sentinels, never one**: `-1` unchanged ("someone already
published this") and `-2` new ("the draft moved since we started checking it"); collapsing them
would file a receipt for an event that did not happen (T-185-04-01). The service captures the
token with `row.get("token")` — five shipped test files mock `get_definition` with token-less
dicts and a subscript would KeyError every one of them. A refused publish answers **HTTP 200**
`{published: false, blocked_stage: "draft_changed", golden_run_id}` and the golden run + its
`harness_audit` rows survive untouched (`_block` only ADDS). **No route branch was added** — the
publish route's own docstring already routes unrecognised stages to the 200 + structured verdict;
the only `api/workflows.py` change is that docstring. F5/F5b/F6 observed RED then GREEN (F5c is a
deliberate compatibility CONTROL, green both sides — it pins the token-free positional call that
keeps `test_103_tweak_fork.py` edit-free). **Zero migrations — head stays 114**; zero frontend
files; zero shipped test files edited. Backend collected 3461 → **3465**; full-suite failures
**211, unchanged**.
⚠ **Carry-forward for 186-05:** the `PublishGauntlet` fail-open is live and `draft_changed` is the
first stage that triggers it in production — `findIndex` → `-1` for an unrecognised stage makes
`isPassed` true for all eight nodes (8/8 GREEN on a refusal) while `wordedHeadline` prints the raw
machine token. **Both** `-1` reads must be fixed, not just the first.
The exact server sentence 186-05 must not contradict: *"the draft changed while it was being
checked — re-publish to check the new version"*.

**Execution progress — Plan 186-03 COMPLETE (2026-08-01).** Wave 2's transport client shipped in
2 atomic commits (`7adb5291` the token + the `If-Match` header → `4c78c688` the two named
refusals), SUMMARY `000fbd82`. `frontend/src/lib/api.ts` + its test only — **zero backend files,
zero migrations, zero packages**. The token now rides all three seeding responses (create, drafts
list, PATCH) as an opaque `string`; `updateWorkflowDraft(id, def, token?, signal?)` sends the
conditional header when it has one and **no header at all** when it does not. The 409 arm now
READS the body it used to discard: `stale_token` → `WorkflowStaleTokenError` (carrying
`currentToken`, so D-186-08's "overwrite with what's on screen" is ONE more PATCH); **every**
other value — missing body, unparseable body, no `detail`, unknown code — falls back to today's
`WorkflowConflictError`, asserted by three `.rejects` cases. New `WorkflowDraftUnreadableError`
for 422 with a fixed message and the raw body logged once at the boundary. `detail.code` stays
`string` — no client-side union (VALID-03 / D-182-06). Tests 14 → **24**; `tsc -b` **33 == baseline**
with 0 naming `api.ts`; the 6-file builder subset **200 → 200**.
⚠ **Two carry-forwards for 186-06:** (1) classify by `err.name`, never `instanceof`, never prose —
the three names are `WorkflowStaleTokenError` / `WorkflowConflictError` /
`WorkflowDraftUnreadableError`; (2) chain the token from the **PATCH response**, not the create
alone — every successful write returns a fresh one and ignoring it self-inflicts a stale refusal
on the next keystroke.
⚠ **Measurement note (the counting-criterion lesson, third time this phase):** the plan required
`grep -c "new Date(" api.ts` to stay 0 *and* told the executor to copy a RESEARCH docblock
containing the literal ``new Date(``. Unsatisfiable together — the prose was reworded (all facts
kept) so the fence stays a real guard. Also: the plan's "209-test clean subset" measures **200**
for the six files it names, on both sides of the change.

**Execution progress — Plan 186-06 COMPLETE (2026-08-01).** Wave 3's `useDraftPersistence` shipped
in 3 atomic commits (`e7fa55cb` core → `49b4982e` the hold → `696791a2` the halt), SUMMARY
`5bb6ad93`. **Two new files only** — the D-184-05 seam extraction 186-04's fence promised, with
`WorkflowBuilderPage.tsx` **untouched** (186-07 owns it). 531-line hook: single-flight queue (≤ 1
request outstanding, each carrying the previous write's token), `AUTOSAVE_DEBOUNCE_MS = 1000` with
its limit stated honestly, **no cancellation of any kind** on the write path, a 6-arm discriminated
`PersistState`, one hold mechanism with two sentences that flushes on release, and a `haltedRef`
conflict stop with Reload/Overwrite returned but never self-invoked. Tests 0 → **22** (8 → 16 → 22
across the three tasks); `tsc -b` **33 == baseline**, 0 naming a touched file; `vite build` exit 0;
the 7-file builder subset **219 passed** (non-decreasing).
⚠ **Three carry-forwards for 186-07:** (1) the **published-row 409 currently lands in the
cause-neutral branch** — `PUBLISHED_CONFLICT_MESSAGE` still has one home on the page and this hook
deliberately did not mint a second spelling, so 186-07 must either move that constant into the hook
or add a discriminator, or a **shipped sentence (184-11 / D-184-16 debt 3) regresses**; (2) pass
`validationCause` as a **primitive** (`validation.kind === "degraded" ? validation.cause : null`) —
handing the object in defeats the whole reason the hold gate is value-stable; (3) `enabled` is
*drafted + canvas-enabled*, **not** `hasEdited` — the hook's own `dirty` gate is what stops a
freshly opened draft from writing.
⚠ **Measurement note (the counting-criterion lesson, now FIVE plans running):** three of this
plan's acceptance greps were unsatisfiable as literally written — `AbortController`/`instanceof`
must count 0 *while the docblock explains why*; `grep "\], \[definition, enabled\])"` cannot match a
`useEffect` (which ends in a brace); `grep -c "listDraftWorkflows"` cannot be 1 because the import
line counts. Each was replaced by a measurement of the property, never by obfuscating the code.

**Execution progress — Plan 186-08 COMPLETE (2026-08-01).** Wave 5's folded bug fix shipped in 2
atomic commits (`99aa0c7e` the promoted picker → `2cf67334` F16 + the carry-forward records),
SUMMARY `a0c31e0a`. **`BUG-260731-03`'s repair path is closed:** the display-only `📁 <folder>`
header chip is now the same project-folder select the describe screen renders (one control, two
mount points, no new fetch), and an unbound workflow says `No knowledge base · searches
everything` — an INVITATION on the `EMPTY_DRAFT_INVITATION` precedent with no severity, no code,
no tray row, no node mark and **no `blockedReason` entry**. `onChange` calls `setProjectFolder`
(186-04: writes `meta` + arms `dirty` in one act) **and** `setHasEdited(true)` at the call site —
RESEARCH open risk #4 taken as option (a); the subscription's `meta` exclusion was NOT widened.
Header suite **15 → 27**, F16 observed RED (6 failed / 21 passed) then GREEN; `tsc -b` **33 ==
baseline**, `vite build` exit 0; the 50-file workflow set **1916 passed, 0 failed**; zero backend
files, zero migrations, zero packages, `components/workflows/` untouched.
⚠ **The control is GATED on `canvasEnabled`, deliberately.** D-181-01 (HARD gate #1) promises
flag-off byte-identity and pins it as literal markup; an unconditional affordance would break the
v3.6 revert switch. Flag-off keeps the shipped display-only chip and the markup pin passes
**unedited**. With the flag ON all four Builder entry paths reach the control — which is how the
bug was reported. Cost recorded with a re-open trigger in
`.planning/phases/186-concurrency-autosave/deferred-items.md` (which also carries D-186-17 forward
**plus its unbind addendum**, proven unreachable by a source assertion over `PhaseFormPanel`).
⚠ **`BUG-260731-03` STAYS `folded` — frontmatter byte-unchanged.** Only the control half shipped;
the deterministic build-time `/validate` `incomplete` verdict remains **Phase 187's** (D-186-14).
A dated note below the report's frontmatter records what was verified by test and what was not
(no live browser run, no golden run).
⚠ **Measurement note (the counting-criterion lesson, now SEVEN plans running):** two acceptance
greps counted the executor's own docblock prose (`project-folder-picker` → 3, `boundFolderName &&`
→ 1). Prose reworded to state the facts by description; counts became 2 and 0 honestly. And on the
first: the number moved further than the property — the flag-off arm still hides the unbound
state, by design, which is said plainly in the SUMMARY rather than left to the grep.

**Execution progress — Plan 186-09 COMPLETE (2026-08-01), the first gap-closure plan.** Wave 6's
CR-01 fix shipped in 2 atomic commits (`d1125fd9` F17 RED → `3ef3689b` the identity gate), SUMMARY
`e9319501`. **GAP-1 is closed at the property, not at the patch:** `performWrite` now binds
`writtenPhases = snapshot.phases` / `writtenMeta = snapshot.meta` before the request leaves, and
the bare `if (pendingRef.current)` became
`superseded = pendingRef.current || now.phases !== writtenPhases || now.meta !== writtenMeta`.
The branch BODY is byte-unchanged (the `haltedRef` break, the `holdRef` → `heldPendingRef` arm,
the trailing `continue`), so 186-12 and 186-13 open a function they still recognise;
`markSaved()` and `setState({kind:"saved"})` keep exactly one call site each. Two identity
compares and not a deep compare, because `selectDefinition` is `{ ...state.meta, phases:
state.phases }` and every mutating action replaces one of those two references — stated in the
code comment so the totality is argued, not assumed. Hook suite **23 → 26**, all green; `tsc -b`
**33 == baseline** with 0 naming a touched file; `vite build` exit 0; zero backend files, zero
migrations (head stays 114), zero packages.
⚠ **F17 was observed RED first and one plan PREDICTION was corrected by the observation.** The
recorded receipt pair read `[3]` vs `[4]` — the receipt named a payload the store had moved past —
and `updateWorkflowDraft` was called 1 time where 2 are expected. The plan predicted F17c would be
GREEN in RED; it is **red at 1**, because the orphaned timer found `dirty` already cleared and
issued nothing at all. The test docblock records the observed number, not the predicted one.
⚠ **The load-bearing line is the one that does LESS.** F17 advances `AUTOSAVE_DEBOUNCE_MS / 2`,
deliberately: the shipped F9 advances a FULL debounce after its second edit, which matures that
edit's own timer and arms `pendingRef` — the branch that already worked. Anyone who "tidies" that
half into a whole silently deletes the regression test.
⚠ **The frontend full-suite rot band is WIDER and UNSTABLE — 42/43 failures across two
consecutive runs of the same tree, with a DIFFERENT failing set each time** (SEED-056 records
"~14-17"). Proven not to be this plan's: the 8 genuinely-rotten files fail identically **in
isolation** (21/144), `PublishGauntlet` (18) and `WorkflowCanvas` (2) **pass fully in isolation**
(parallel-load flake), and all 5 suites importing the changed hook run **245/245**. Total
collected is **3556 on every run** — non-decreasing. Recorded with a re-open trigger in
`deferred-items.md`: the next gate that wants the frontend suite as a pass/fail signal must
measure per-file in isolation, not as one whole-suite number.
⚠ **Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-01` /
`CONCUR-02` stay as they are — 186-09 closes one of three blockers, and 186-12 / 186-13 modify the
same file in waves 7-8; marking either complete now would be exactly the false-completion record
the SDK verbs produce. ROADMAP plan-progress left to the orchestrator.

**Execution progress — Plan 186-10 COMPLETE (2026-08-01), the second gap-closure plan.** Wave 6's
WR-02 fix shipped in 2 atomic commits (`c36daf12` F18 RED → `8504af03` the Grounding row), SUMMARY
`5ed2a243`. **The spine can now place `grounding_fidelity`** — emitted by `publish_service.py` since
Phase 182, with no client row, so the most likely real refusal on a KB-bound workflow rendered as a
fully grey unplaceable spine under the generic fallback sentence. The new `Grounding` row is
**INSERTED at index 5** (its true pipeline position, after the interactive-phase gate and before the
golden run), not appended — which forced the second half: both `i === 5` reads (the amber aura and
the energy comet) became `i === RUNNING_STAGE_INDEX`, derived from the row whose codes include
`golden_run_timeout`, so a future insertion cannot silently pulse the wrong node. Icon
`~icons/fluent-emoji/books`, proven three ways (registry listing + `vite build` exit 0 + a render
assertion, since an unverified slug ships as an EMPTY svg rather than failing the build). **F7 is
untouched and green.** Suite **29 → 41** (F18 = 2 controls + a 10-case `it.each`), `tsc -b` **33 ==
baseline** with 0 naming a touched file, `eslint` exit 0, `vite build` exit 0, zero backend files,
zero migrations (head stays 114), zero packages.
⚠ **The claim that could go stale is now a test that reads the server's own source.** F18 extracts
the `stage="…"` literals from `publish_service.py` at test time (**11 distinct**: already_published ·
definition_invalid · business_requirement · lint · interactive_phase · grounding_fidelity ·
golden_run_timeout · golden_run_error · structural_gate · judge · draft_changed) and drives one
render per stage, asserting **exactly one** blocked node each. RED was exactly as predicted — one
failing case, `grounding_fidelity`, 0 blocked nodes where 1 was expected — so no second forgotten
stage exists. One evidence-justified exclusion, `already_published`, whose set size is asserted
`=== 1` so a future forgotten stage cannot be parked there instead of given a row.
⚠ **`node:fs` and `new URL(…, import.meta.url)` are both unusable in this codebase's frontend
tests — carry this forward.** The plan prescribed both; each failed for its own reason. Vite
**statically rewrites** the `new URL(literal, import.meta.url)` asset pattern, so `fileURLToPath`
receives a non-`file:` URL and the whole suite fails to collect. And `tsconfig.app.json` sets
`types: ["vite/client"]` on purpose — browser code must not reach a Node built-in — so three
`node:*` imports added **3 NEW tsc errors** (33 → 36). Both replaced by the `?raw` loader the same
file already uses for the component source. Adding `"node"` to the app tsconfig was **rejected**: it
would let shipped browser code use `process`/`Buffer` unchallenged, a permanent widening bought for
one test file.
⚠ **Measurement note (the counting-criterion lesson, now NINE plans running).** `grep -c "codes:"`
was specified to count 10 and counts **11** — the `STAGES` type annotation line contains
`codes: string[]`, so it was always N+1. `grep "i === 5"` was specified to return nothing and
returned the executor's own docblock explaining the literal's removal. Fixed by measuring the
property (`grep -c 'codes: \['` → 10) and rewording prose, never by obfuscating code; verified more
strongly than asked — no bare numeric index comparison survives anywhere in `GauntletSpine`.
⚠ **Three small Rule-1/2 repairs inside the two declared files.** The visible sentence *"Publishing
runs the full **8-stage gauntlet**"* became false with a ninth CHECK — the count was removed, not
incremented, so it cannot go stale again. The shipped Commit-node glyph test was widened to sweep
**every** node, because the component's icon docblock claims "the newest addition is pinned by a
render assertion" and a row-scoped test stops being that the moment a row is added. And the
`draft_changed` test's literal `8` ✓ badges became `nodeCount − 1` — a claim that had not changed
should not fail because a table grew.
⚠ **The frontend full-suite number is still not a gate, and this plan re-proved why.**
`PublishGauntlet.test.tsx` reports **18 failures under full-suite parallel load and 0 in isolation** —
byte-identical to the count 186-09 measured for this file BEFORE any change here. All 18 are
`Test timed out in 5000ms` on **shipped** (103/127-era) tests; the file takes 131 s under load vs
22 s alone; **zero F18 cases appear in any failure list**. The 13 suites importing `PublishGauntlet`
run **211/211** together. Full-suite failures measured **41 / 42 / 41** across three runs (186-09
measured 42/43); collected **3556 → 3568**, exactly the +12 F18 added — non-decreasing.
⚠ **Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-02` stays
as it is — WR-02 is one of three blockers plus four warnings, and 186-12 / 186-13 are still owed in
waves 7-8. ROADMAP plan-progress left to the orchestrator.
⚠ **Newly observable in manual UAT:** `186-VALIDATION.md` row 3 ("Publish race") can now show a
*placed* block for a grounding refusal instead of an all-grey spine. Still to run — deliberately not
a plan task.

**Execution progress — Plan 186-11 COMPLETE (2026-08-01), the third gap-closure plan.** Wave 6's
WR-06 fix shipped in 2 atomic commits (`4de772c3` the per-test skips → `c2c79c3b` the F6 row +
re-measured count), SUMMARY `f1978240`. **The phase's headline backend invariant now has CI
coverage without a database.** A module-level `pytestmark` in two files gated three tests that
touch no database at all; the skip is now a property of the tests that need one. Same command,
DSN at an unreachable port: **12 skipped / 0 passed → 3 passed / 9 skipped, exit 0** — the three
being F6 (`test_the_golden_run_receipt_survives_a_draft_changed_refusal`, the only automated proof
that a `-2` sentinel becomes a `draft_changed` block rather than `{published: True, version: -2}`
plus a false `publish_succeeded` receipt) and the two `*_maps_check_violation_to_409` route-mapping
guards. Each module binds ONE `_LIVE_DB_REASON`, byte-identical to the reason string it replaced,
so the skip report reads exactly as before and the decorators cannot drift. Three-file collected
count **12 → 12**; backend suite **3457 → 3465** with failures **211, byte-identical** to the band
186-01/186-02 measured — this plan adds no test and removes none, which is the point: it changed
reachability, not coverage. Zero source files, zero migrations (head stays 114), zero packages,
zero frontend files.
⚠ **`test_186_concurrent_patch.py` was left BYTE-UNCHANGED, deliberately.** All four of its tests
open a real asyncpg pool, so its module mark gates nothing rescuable and churning it would be a
change with no property behind it. Its docblock sentence stays literally true for that file.
⚠ **`get_pg_pool` being patched is NOT a DB-free signal — carry this forward.** Four
`test_186_concurrent_patch.py` tests patch `app.api.workflows.get_pg_pool`, and are nonetheless
fully live, because the mock **returns a real pool created in the test body**. Any future sweep
that widens this rescue by grepping for `patch(`/`AsyncMock` will mis-classify them; the criterion
is what the body ultimately connects to, established only by reading it.
⚠ **The plan's "seven live-DB tests" is NINE.** Twelve minus three DB-free is nine, confirmed by
the observed `3 passed, 9 skipped`. The plan's acceptance criteria were stated correctly (`0 passed
and 12 skipped` pre-task; "at least 3 PASSED, the remaining SKIPPED") and all are met — but
re-verification should measure **nine** and not read the correct result as a shortfall.
⚠ **One addition beyond the letter of the plan:** the three now-undecorated tests each carry a
`DELIBERATELY UNGUARDED (WR-06)` docstring note. They are the only un-decorated functions among
twelve siblings that all carry a `skipif`, and "adding the missing decorator for consistency"
would silently restore the exact defect WR-06 recorded — with a green suite either way.
⚠ **Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-02`
stays as it is — WR-06 is one of three blockers plus four warnings, and 186-12 / 186-13 are still
owed in waves 7-8. ROADMAP plan-progress left to the orchestrator.

**Execution progress — Plan 186-13 COMPLETE (2026-08-01), the LAST plan of the phase.** Wave 8
shipped in 4 commits (`36ce9806` F20 RED → `c572b3f9` the `enabled` gate → `41608375` the hold
sentence on both surfaces → `a24ffec6` the terminal 404), closing **WR-03 + WR-04 + WR-05** and
with them the third and final gap-report blocker. **GAP-1 (186-09), GAP-2 (186-12) and GAP-3
(186-13) are now all closed.**
RED observed first, with the hook unmodified: F20a `updateWorkflowDraft` **1 where 0 expected**,
F20a-create `createWorkflowDraft` **1 where 0**, F20b **1 where 0** — an unrequested PATCH
carrying the full definition, in a session where the person had switched the feature off.
**D-181-01 spot-check by source read, recorded in the SUMMARY:** all four `performWrite()` call
sites enumerated — `:653` (debounce timer) and `:703` (hold release) are AUTOMATIC and both now
`enabled`-gated with `enabled` in their dependency arrays; `:720` (`saveNow`) and `:804`
(`overwrite`) require a press and stay ungated by design (D-186-03 / D-186-08). `reload()` never
calls it. No automatic write path can cross the revert switch.
Task 2's load-bearing change was **falsified in place** — restoring the old `quietLine` ternary
order reds exactly 2 tests, both written for that clause, and leaves `header.test.tsx` green
either way, which is itself the evidence the resting flag-off markup is untouched.
Counts: `useDraftPersistence.test.tsx` **33 → 40**, `BuilderSaveRegion.test.tsx` **5 → 8**, the
three page suites **134 → 134**, six-file consumer run **251/251**, full suite **3580 → 3590
collected** with **40** failures all inside the SEED-056 band (the one
`WorkflowBuilderPage.session` failure passes in isolation — same parallel-load flake waves 6-7
recorded; `PublishGauntlet` took 124 s under load vs. milliseconds alone). `tsc -b` **33**, none
naming a touched file; `vite build` exit 0; package/lockfile diff empty. Zero migrations (114).
⚠ **Two acceptance greps were not satisfiable as literally written, and NO code was reworded to
make them so** (the counting-criterion lesson, now nine plans running): `grep "if (!enabled)
return"` misses the shipped `if (!enabled || definition === null) return`, so the property was
measured comment-filtered on `!enabled` → two code sites; and `grep -c` counts LINES, so the
wrapped `HOLD_PUBLISHING_MANUAL` declaration read 2 until a *genuinely useful* cross-reference
was added to `HOLD_PUBLISHING`'s docblock (a reader landing on the promise-form must know the
flag-off spelling exists) — 3 as a side effect, not as its purpose.
⚠ **Counters and requirement status deliberately NOT advanced by this executor.** `CONCUR-01` /
`CONCUR-02` stay **Pending** — `/gsd:verify-work 186` re-verifies both now that all three
blockers are closed. ROADMAP plan-progress and the plan counter left to the orchestrator.

**▶ PLAN 186-18 EXECUTED 2026-08-01 — CR-03 (the third gap-closure round's BLOCKER) is CLOSED IN
CODE.** 3 tasks, 3 commits (`64042c12` test / `bb693e10` fix / `bbccf283` docs) plus `17a1fd37`
(SUMMARY). Zero migrations, zero package changes. 186-16's refusal sat one line BELOW a
short-circuit returning `null` whenever `visual_workflow_canvas` is off, so it was dead code on the
one surface where the write it guards is still reachable (D-186-03 leaves `saveNow` ungated;
`actionGroup` mounts Save **and** `renderPublish` on both header branches). The fix is a **one-line
reorder**: `persistState.kind === "saving"` is now `blockedReason`'s first statement. Decisions:
**D-186-18-A** reorder, not a flush, not a new seam; **D-186-18-B** the four verdict branches stay
BELOW the flag gate (the flag hides *claims about the workflow*, never a fact about this client's
own write loop); **D-186-18-C** D-181-01 is **measured** — both byte-for-byte header pins pass with
`FLAG_OFF_HEADER_MARKUP` unedited, because the new reading is unreachable at rest; **D-186-18-D**
the 5-suite verify runs `--fileParallelism=false` (parallel workers flake `PublishGauntlet.test.tsx`
on `user-event` timeouts — 46/46 green alone; unrelated to this plan).
RED observed first and recorded verbatim (received `null` at the `SAVING_PUBLISH_WAIT` assertion,
*after* the `mockUpdate` call-count assertion passed — the premise measured, not argued); GREEN
199/199 across the five suites (198 pre-plan + Task 1's permitted `+1`); `tsc` clean in every
phase-186 file. `186-VALIDATION.md` gained **row 8** (flag-OFF Save-then-Publish, status `to run`)
— the operator board now has **eight** rows outstanding, not seven.
⚠ **Counters and requirement status deliberately NOT advanced by this executor** — `CONCUR-02`
stays as the orchestrator left it; plan counter, ROADMAP plan-progress and requirement completion
are the orchestrator's.

**▶ PLAN 186-19 EXECUTED 2026-08-01 — the two residual warnings WR-12 and WR-13 are CLOSED IN
CODE.** 2 tasks, 2 commits (`83a721fb` WR-12 / `a27e3e39` WR-13). Zero migrations, zero package
changes, zero component files touched (`git diff --stat BuilderSaveRegion.tsx` empty — the new
reading rides the `held` → quiet-line path 186-13/WR-04 left ungated by `autosaveEnabled`).
**WR-12:** 186-17 resolved the hold reading unconditionally, which killed the stale *"Publishing
— not saved…"* sentence and then left a BLANK where the true one belongs — the flag-off author
was holding unsent work with nothing on screen until the leave guard fired. New locked constant
`HOLD_ENDED_UNSAVED` ("Not saved — press Save draft to save your changes", one home, `:212`); the
`!enabled` branch reads `dirty` ONCE and, when true, applies a **second functional** `setState`
(a bare object would erase a `conflict` — GAP-4's second door). The `return` still sits above
`performWrite()`. **WR-13:** `overwrite()` now clears `heldPendingRef` beside `haltedRef`,
restoring the symmetry `reload()`'s success path already had — an arming made before a conflict
could otherwise flush a no-op PATCH after the conflict was resolved, minting a fresh token and
invalidating every other tab's guard. Decisions **D-186-19-A..D**.
⚠ **A PLANNED DOCBLOCK CLAIM WAS PROBED AND MEASURED FALSE, and the false premise is now recorded
by name so it cannot be resurrected:** *"a halted loop is always dirty"* does NOT hold — `saveNow`
bypasses the dirty gate by design (D-186-03), so a Save press on a CLEAN store issues one PATCH
and a stale-token refusal lands `{kind:"conflict"}` with `dirty === false` (probe: 1 update call,
`currentToken: "T-SERVER"`, dirty false). The shipped derivation is the **two-doors** one instead:
`haltedRef` is cleared in exactly two places and both now clear `heldPendingRef`.
Both REDs observed first and recorded verbatim (received `{kind:'idle'}` at F20b **and** F20i(a);
`expected "vi.fn()" to be called 2 times, but got 3 times` at F23). Hook suite **53 → 54 → 55**,
all green, **132 insertions / 0 deletions** — no pre-existing row could have been weakened.
Consumers 49/49 green and unedited. `tsc` has **33 pre-existing errors** unchanged and **0** in
this plan's files — the plan's "zero errors" criterion was an inherited claim, not a measurement.
No `186-VALIDATION.md` row added: both closures are proven by counting, and the operator board
stays at **eight** rows.
⚠ **Counters and requirement status deliberately NOT advanced by this executor** — `CONCUR-01`
and `CONCUR-02` stay as the orchestrator left them; plan counter, ROADMAP plan-progress and
requirement completion are the orchestrator's.

**▶ PLAN 186-20 EXECUTED 2026-08-01 — the round is CLOSED against a measured gate, and the five
carried warnings are scheduled decisions rather than omissions.** 2 tasks, 2 commits (`5a1cc5c8`
deferrals / `a72b1fd7` the gate). Two `.planning/` markdown files only — zero source files, zero
migrations, zero package changes.
**Task 1 — `deferred-items.md` gained WR-14..WR-18**, `Re-open trigger` count **6 → 11**, **175
insertions / 0 deletions** (no pre-existing entry edited). WR-14 records the trade this round
made: 186-18's CR-03 reorder lifted `SAVING_PUBLISH_WAIT` above the flag gate, so the wait reason
now outranks the verdict branches — and disables the free outer trigger — on the **flag-off**
Builder too. WR-18 records its containment: a null `detail.token` costs the **optimistic** guard,
not an authorisation (owner scope + published-row guard are server-side and untouched).
**Task 2 — the gate, all four commands run in-session.** Frontend consumer set (11 files,
`--fileParallelism=false` per D-186-18-D) **429/429 green**; the delta is attributed **per file**
against the pre-round tree `b417584d` — canvas 87→88 (186-18), hook 50→52 (186-19), the other nine
**unchanged** — so 426 → 429 is exactly +3 and nothing was replaced invisibly (the Phase 177
lesson). Backend `21 passed, 0 skipped` — **zero skips means live Postgres was present**, so the
DB-guarded F-guards genuinely ran; whole-suite collection **3474** (≥ 3457 / 3465). `tsc` **33
pre-existing errors across 19 files, 0 in any phase-186 file**. Zero migrations / packages in the
working tree **and** across the whole round.
⚠ **Two inherited plan claims measured FALSE and corrected:** (a) *"five entries already exist"* in
`deferred-items.md` — there were **six**; (b) *"Command 3 reports zero errors"* — the achievable
criterion is zero **in the phase's files**, matching what 186-19 found. Also: **five of the
verification report's WR line references are stale** (it predates 186-18/186-19) — WR-18's site is
`useDraftPersistence.ts:1058`, not `:980`; WR-16 `:988-1032`, not `:915-949`; WR-17 `:988-993`,
not `:910-914`; WR-15's real sites are `:633`/`:638`, not `:605-610`; WR-14's saving branch is
`WorkflowBuilderPage.tsx:1094`, not `:1077`. Every one re-derived from source.
`wave_0_complete` flipped `false` → `true` against `ls` evidence (all six files were already on
disk — a stale record, not a missing artifact). **`**Approval:** pending` untouched, all eight
Manual-Only rows still unrun, row 4 still ⛔, `.planning/REQUIREMENTS.md` unmodified** — `CONCUR-01`
and `CONCUR-02` stay **Pending** until the operator runs the board. **Phase 186 is now ready for
`/gsd:verify-work 186`, with SC#4 the only thing no automated evidence can close.**

Resume file: .planning/phases/188-non-technical-run-observability/188-UAT.md

Both owed items are now ROUTED at the discuss-phase touchpoint:

- `BUG-260731-03` (**blocking**) → `status: folded`, **SPLIT** `folded_into: "186 (control) /
  187 (verdict)"` (D-186-14). 186 gets the author-time KB-binding control (the display-only header
  chip promoted into the existing picker) + a neutral unbound invitation; 187 keeps the
  deterministic build-time `/validate` verdict. Its `re_open_trigger` states it must NOT flip to
  `closed` when 186 ships.

- `SEED-138` (definition jsonb double-encoded, 118/145 rows) — **reviewed, not folded.** Autosave
  heals-on-write (`update_workflow_definition` already writes correctly); all rows are test
  fixtures. Re-open trigger: first non-fixture production rows.

- `SEED-137` is already folded → **Phase 187 SC#6**.

**Three scouting findings that reframe 186's roadmap wording** (verified in code; full detail in
CONTEXT.md `<domain>`): (1) CONCUR-01's *"a cosmetic drag never mints a version"* is **already true
by construction** — `update_workflow_definition` never bumps `version`, and 184-07's `canvasNudge`
is browser-local at 0 network calls; (2) *"two people editing the same org-shared workflow"* is
**NOT reachable** — mig 111 gave `workflow_definitions` `is_system_global` (a platform flag), not
`is_org_shared`, and UPDATE is `created_by`-only at both the RLS and service layers, so the real
conflict is one user across two tabs; (3) the publish/dirty-draft race is **real and unguarded** —
stage 5 flips on `status='draft'` only, so an autosave landing mid-gauntlet publishes a definition
that never passed the gauntlet. **Zero migrations confirmed:** the concurrency token rides the
existing `updated_at` column, and the new `blocked_stage` is free-form metadata on the
already-registered `publish_blocked` event type (unlike 185-13's `action_risk_pending`).

*(Historical, superseded — the 185 execution detail below was accurate when written:)*
Plan: 1 of 13
(Summaries on disk: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12.)

**⚑ WAVE 7 / PLAN 185-12 LANDED (2026-07-30) — BUG-260730-01 IS CLOSED IN CODE, AND IT WAS A
BLOCKER FOR 185-11 TASK 3.** The auto-attached `retrieved_and_cited` gate demanded inline `[1]`
markers that *nothing* ever asked the model to write: not the step prompt, not the attachment seam
(`grounding.py` appends a ValidatorSpec and no prose), not the retry feedback (which echoed the
deficit without naming the format). The operator's publish golden run
(`workflow_runs.id = ded89703-44c4-4e40-b5fe-9af35a44a54d`, `deepseek-v4-flash`) burned all 3
attempts on it — with half (a) NOT firing, which proves retrieval succeeded and the loss was purely
the missing marker. Fixed on the **producer, never the checker**: one home for the format
(`CITATION_MARKER_PATTERN` / `_EXAMPLES` / `_GUIDANCE`), the remedy appended to the failure message
the engine already interpolates into `ctx.retry_feedback`, and an additive `_citation_instruction`
suffix composed on **both** agent paths (`_exec_llm_agent` + `_exec_llm_batch_agents`). The gate is
**no less strict** — a retrieved-but-unmarked answer still FAILS, asserted. D-14 held by prompt
**equality** across 10 ungoverned-phase cases; the Deep 4-file fence and the migrations/frontend
fence both report 0 files; `grep -c "grounding_cause" phase_types.py` == 0 (the instruction reads the
ATTACHED spec, so the judge and the instruction cannot disagree). Drift pin falsified RED and
reverted. Touched suites **51 → 78**; full unit suite **62 failed (baseline-identical), 1589 → 1616
passed** — no new failure. Commits `7c7d8b84` → `46f773ff` → `6c85a5e4`, summary `9dbec02a`.
**GOVERN-01 stays `Pending`: the operator UAT that would justify Complete has not run, and re-running
it is the next step.**

**⛔ PHASE 185 IS NOT COMPLETE AND MUST NOT BE MARKED SO. GOVERN-01 / GOVERN-02 / GOVERN-03 ALL
STAY `Pending`.** Every automated gate in the phase is green and every fence is recorded, but the
phase's acceptance bar is the G-4 lived-experience gate, and it has not been driven. What is owed,
authored in `185-VALIDATION.md` and nowhere else: the **four G-4 scenarios** (watch a step lock in
front of you · the seal survives a live run · arm it and walk away · the detour reads as a detour),
the **two other manual-only rows** (the greyscale render for criterion 17, and the before/after
screenshot diff on ordinary flow edges for D-185-18), and the **eight-row SC#10 scoreboard**
(OpenAI / Anthropic / Google / OpenRouter + multi-tool + parallel-thread + long-message + the
negative row). `nyquist_compliant` is deliberately still `false` for exactly this reason.

**Plan 185-11 TASKS 1-2 COMPLETE (`3864d962` the vocabulary sweep as a test → `<summary>` the
fences and the guardrail records). THE PHASE'S CROSS-CUTTING CRITERIA ARE NOW MACHINE-ENFORCED
RATHER THAN GREPPED ONCE BY HAND.** `governanceVocabulary.test.ts` (30 tests) sweeps the 25
non-test modules of `src/components/workflows` plus `WorkflowBuilderPage.tsx` and asserts criteria
14, 15 and the D-185-02 overclaim guard. **The match is scoped to string literals and JSX text via
the TypeScript PARSER, never a comment-stripping regex** — a file-wide grep flags two hits in this
tree (`definitionOps.ts:362`, which spells out why *Traceable* is deferred to the review moment,
and `WorkflowBuilderPage.tsx:18`, which records that one-shot emission is proven by spike-097) and
both are correct prose about engineering facts, not copy. That is the **D-ITEM-183-02 trap** that
cost 185-09 and 185-10 three false positives each — **and it bit this plan too**: fence 4 caught
the new test file naming the very symbol it forbade, in its OWN docblock, and the docblock was
reworded without weakening the guard. **Three plants observed RED against the real tree and
reverted** (a banned past participle in a real string literal → the banned half red naming
`./definitionOps.ts`; an overclaim phrase → THREE guards red at once; a reworded
`GOVERNANCE_SEAL_LABEL` → the drift lock red). Gates: tsc **33** (= baseline, 0 naming a touched
file), count gate per the VALIDATION posture (no `[count-decrease]`, no `[total-below-baseline]`,
no `[missing-file]`; total 1628 → **1658**, exactly +30; all **8** failures in
`PublishGauntlet.test.tsx` (6) and `WorkflowCanvas.test.tsx` (2, axe under parallel load — the file
passes 35/35 in isolation), both named in VALIDATION's pre-existing table at 10 and 4 and both
files this plan never opened).

**⚑ G-5 — THE FIRE ON `PhaseFormPanel.tsx` IS RECORDED AS HONOURED BY CONSTRUCTION.** The file was
the real hot one (1095 L, touched by 140 / 183 / 184). Phase 185 added a **mount point, not another
200 lines**, and the evidence is measured, not asserted:
`git diff --stat 59c32a06..HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` reports
**23 insertions / 6 deletions**, of which **16 ins / 6 del are docblock prose only**, 2 ins are type
declarations (`kbTools?: readonly string[]`, `onGovernanceChange?`), 1 ins is the import, and only
**4 insertions reach the render body** — one destructure line plus the 3-line
`{rails && <GovernanceSection … />}` mount. Criterion 21 asked for ≤ ~4 and got 4.
**`GovernanceSection.tsx` is the own-component half**: the dial, its refusal copy and the arming
switch all live there, never in the panel. The ledger row in `CLAUDE.md` now carries this, so the
next phase that opens the panel reads the shape it is expected to keep. **`WorkflowCanvas.tsx` is
the file that now FIRES G-5** (1574 L, 9 plans across 183 / 184 / 185) — extraction due in Phase
188, seam named by 185-10 (`PlaneEditingLayer` + `EDIT_AFFORDANCE`, mind the live ESM cycle).

**⚑ D-185-17 — THE ONE SCOPE DECISION TAKEN WITHOUT THE OPERATOR IN THE ROOM, AND ITS
REVERSIBILITY NOTE, VERBATIM.** The 137-B card rebuild was made Wave 1 (`185-01`) because computed
geometry showed no left verdict placement passes acceptance criterion 23 on the shipped 137-D, and
the operator accepted the visible canvas restyle. **It is the single most reversible thing in the
phase — drop the Wave-1 plan file and Wave 2+ still build, with acceptance criterion 23 failing
until the rebuild lands separately.** Nothing downstream reads the 137-B geometry as a contract;
185-09's corner seal asserts an **11px CLEARANCE from the card's right border**, never a composite
pixel offset, so it survives a geometry revert.

**⚑ PUBLISH BEHAVIOUR CHANGED (D-185-11's publish half) — recorded because it is a real behaviour
delta, not a bug.** The gauntlet gains **no new stage**, but its golden run drives the enforcement
seam (`_drive_golden_run` reaches the engine only via `run_workflow`), so **a detected step whose
golden run retrieves nothing now FAILS the golden-run stage and blocks publish**. This is accepted:
every `workflow_definitions` row is throwaway test data, so there is nothing to grandfather. Expect
it during the operator UAT — a blocked publish on a detected step is the gate working, not a
regression.

**⚑ `_exec_llm_human_input` IS UNCHANGED, AND THE GLOBAL TIMEOUT-ADVANCES-SILENTLY BEHAVIOUR
REMAINS OPEN — DELIBERATELY, SCOPED OUT BY SPEC.** Criterion 20 is a measured 0-file git-diff over
`backend/app/services/harness/phase_types.py`. An UNARMED human-input step still behaves exactly as
it did before 185: its bounded `ask_user` timeout expires and the run advances on its own, with no
one told. 185 made the wait indefinite **only** for ARMED action-risk checkpoints. Closing the
global case is not a bug fix, it is a behaviour change SPEC deliberately did not authorise; it needs
its own scope. Related residue already carried in this phase's `deferred-items.md`: answering an
armed checkpoint DURING a resume produces one further ask.

**Plan 185-10 COMPLETE (`94a89425` the projection → `6badaa6e` FlowEdge + the edgeTypes map →
`7c3f8b7c` the suite → `79354c6e` SUMMARY). THE ARMED CHECKPOINT IS A DETOUR: THE CONNECTOR
INTO THE RISKY STEP LEAVES THE FLOW AND COMES BACK THROUGH A POINT THAT REPRESENTS THE PERSON.**
`FlowEdge.tsx` is the **first custom `@xyflow/react` edge in this tree** — D-185-18 held exactly
as written: `grep -rn edgeTypes frontend/src` returned ONE hit at execution start and it was the
comment asserting none is registered. Four net-new pieces shipped (the component, the module-scope
`edgeTypes` map, `edge.type` in `toCanvas`, `markerEnd` re-rendered inside the edge), and only
`flow` is registered — `skip`, the unresolvable-skip stub and the `end` cap set no `type` and keep
the built-in renderer, which is what holds the blast radius. **D-185-10-A — `CanvasEdgeData.armed`
is THREE states, not two**, and that is the plan's one structural correction: ABSENT (no checkpoint
⇒ the ordinary connector, byte-identical to today), `false` (declared and OPEN ⇒ ghost arc + line
through), `true` (armed ⇒ the arc IS the path, no straight line past it). A plain boolean cannot
satisfy the plan's own two truths at once — "an ordinary unarmed flow edge renders identically to
today" AND "unarmed shows a ghost, present and open, never absent" — and sketch 147
(`index.html:459`) already models it this way, gating the whole mark on `step.risky`. **`armed:
false` is rendered and tested but NOT PRODUCIBLE today; Phase 189's external-action node is the
named producer** (`checkpointOnTarget` returns only `true | undefined` because Req 8 arms nothing
by default). **D-185-10-B — `FlowEdge` derives `GAP`/`INSERT_Y` from `CANVAS_LAYOUT` in its own
`DETOUR` table rather than importing `EDIT_AFFORDANCE`**, because `WorkflowCanvas` imports
`FlowEdge`'s VALUE at module scope for `edgeTypes` and importing back would close a live ESM cycle
(`FlowEdge.test.tsx` reaches it first ⇒ TDZ). `EDIT_AFFORDANCE` is now **exported** and the two
tables are pinned equal by a test — that pin is load-bearing, and it was falsified RED. **The "no
visible change" guard captures the BEFORE from the shipped default rendering in the same run** (one
probe harness rendered twice: no `type` ⇒ `builtinEdgeTypes.default`, then `type:"flow"`), never
from a hand-typed `d`. **A plan claim was corrected in our favour:** `defaultEdgeOptions` STILL
merges once `type` is set — the library just hands the resolved `url('#…')` to the component and
draws nothing itself, so the conclusion (re-render `markerEnd`) stands on a different mechanism.
**Both falsifications observed RED and reverted** (a planted `LINE` in the armed branch; `DETOUR.GAP

+ 4`, which reds the pin AND collapses clearance 8.19 → 4.97px). Clearance is COMPUTED by parsing

the exported `ARC`: **8.1941px** vs the sketch's 8.2. Three acceptance greps were comment-only false
positives (docblocks spelling the very tokens they forbade — the D-ITEM-183-02 trap); reworded, guard
not weakened, all three now **0**. Gates: snapshot **21 insertions / 0 deletions** with one unique
added line (`"type": "flow"`), `src/components/workflows` **27 files / 1514 passed**, `FlowEdge.test.tsx`
**22 passed**, tsc **33** (= baseline, 0 naming a touched file), `vite build` exit 0 with the canvas
still its own lazy chunk, **count gate OK** (0 failing this run — the `PublishGauntlet` flake did not
fire — no `[count-decrease]`, total 1628; `FlowEdge.test.tsx` reports `new` and was correctly NOT
added to `BASELINE`), **0** react-flow "new edgeTypes object" warnings, `backend/` **0 files**,
migrations **0 files** (head stays 113). **G-5 flagged on `WorkflowCanvas.tsx`** — `PlaneEditingLayer`

+ `EDIT_AFFORDANCE` named as the extraction for Phase 188. **GOVERN-02 / GOVERN-03 stay `Pending`**

(the 185-02/03/05/06/08/09 precedent): the canvas half is real and pinned, but VALIDATION criterion 4
and the D-185-18 manual before/after screenshot row are operator UAT that has not run.

**Plan 185-09 COMPLETE (`6bdc658a` the seal + the sealed edge → `59c54ba0` the props fence, the
four-mark zone check and the tab-stop walk → `6713a0fc` SUMMARY). THE CANVAS NOW SHOWS WHICH STEPS
MUST PROVE THEMSELVES, AND IT SPENDS NEITHER COLOUR NOR A BADGE TO DO IT.** A grounded card wears a
21×21 `<span>` at its top-right carrying its OWN `bg-[hsl(220_30%_100%/0.1)]` and its OWN
`border-[hsl(220_30%_100%/0.34)]`, plus a border reinforcement on the card itself that is EXPECTED to
be overwritten (by `selected` today, by Phase 188's run status tomorrow) — the 143-A degradation from
two carriers to one, never to zero. **⚠ EXECUTED AS A RESUMPTION: Task 1 was already complete and
UNCOMMITTED in the tree** from an interrupted earlier run (including `definitionOps.ts`, a 5th file
outside `files_modified`); it was verified rather than trusted — every acceptance grep re-run, `tsc
-b` re-measured, both suites re-run — then committed with one correction. **The seal ships at
`right-[17px]`, NOT the plan's literal `right-[11px]`** (143-A's 11px is measured inside the 248px
CARD; the element is positioned against the 260px NODE BOX, so 11 + the 6px gutter = 17) — and the
test asserts the **11px CLEARANCE** from the card's right border, never the 17, so the composite
cannot drift from the locked number. The plan contradicted itself here: its own Task 2 states the box
as `CARD_RIGHT−32 … CARD_RIGHT−11`, reachable only at 17. **THE FALSIFICATION CHANGED THE CODE:** the
four-run-state identity assertion, written as the plan specifies it (`className` + `textContent`),
stayed **GREEN** under a planted `data-run={props.status}` — an attribute-level dependency on run
state is invisible to both readings — so it now compares **`outerHTML`**, after which BOTH criterion-16
guards go red on the same plant. **The plan's stated zone-check falsification is INERT** (185-01
vacated `-right-2`); the verdict's CURRENT corner reds at `verdict × governance seal = 441px²`, and
both facts are live tests. Also fixed: a PRE-EXISTING 184-08 comment carried a Req-7 banned word and
made Task 1's own file-wide grep unsatisfiable — reworded, meaning preserved. Gates:
`PhaseNodeCard.test.tsx` **49 → 68**, `WorkflowCanvas.test.tsx` **33 → 35** (57 insertions, **0
deletions** — both shipped tab-stop `it()` blocks intact), **103/103** together, tsc **33** (=
baseline, 0 naming a touched file), `vite build` exit 0, count gate per the VALIDATION posture (no
`[count-decrease]` — `WorkflowCanvas.test.tsx` +4 — no `[total-below-baseline]`, no `[missing-file]`,
total **1598**, and all **5** failures in `PublishGauntlet.test.tsx`, a file this plan never opened,
below the recorded churn band). `git diff -- backend/ supabase/migrations` **0 files** (head stays
113). **GOVERN-02 stays `Pending`** (the 185-02/03/05/06/08 precedent): the canvas half is real and
pinned, but the panel's dial is 185-07's and criteria **16 (visual)** + **17 (colour-stripped
greyscale)** are operator UAT that has not run. `status` and `stepNumber` remain declared-and-
unrendered for 188; **badge slot 1 is still empty and a third badge is still a typecheck error**.

**Plan 185-08 COMPLETE — executed ACROSS AN INTERRUPTION, so `git log` reads as if the plan ran
backwards (Tasks 2→3→1).** Run 1: `814879b3` (Task 2 — the canvas carries `grounded`/`armed`, badge
slot 1 freed) → `d3b19858` (Task 3 — the client-synthesized locked gate row + the governance write
chain closed inside the D-14 `canvasEnabled` spread-conditional), then interrupted mid-Task-1.
Run 2: `30cb77f9` (Task 1 — the word-badge deletion + the count-gate re-pin, one commit).
**The 3-face grounding word-badge is GONE from the tree** — `groundingFor`, `GROUNDINGS`, the
`Grounding` interface, `nodePresentation.GROUNDING_TONE` and all three retired badge strings; a
whole-`frontend/src` grep returns **0** for each. Badge slot 1 is empty and reserved for 188/189
(a third badge is still a typecheck error). **THE PIN: `phaseVocabulary.test.ts` 42 → 33,
`BASELINE_TOTAL` 424 → 415, in the SAME COMMIT as the deletion (L-9), number read from the gate's
own `actual` column.** **The plan's "COMPLETE DELETION INVENTORY" was incomplete** — it missed
`nodePresentation.ts` importing the deleted `Grounding` **type**, which the acceptance greps could
not see and only `npx tsc -b` caught (34 vs the 33 baseline). `tsc -b` is back to **33** with 0
errors naming a touched file; `vite build` exit 0; **0 backend files, 0 migrations** (live head
**113**). **185-09 reads `PhaseNodeData.grounded`; 185-10 reads `PhaseNodeData.armed`** — and
`CanvasEdgeData` still carries only `{kind}`, so 185-10 must read `armed` off the target node or add
the field. The 137-B card rebuild (D-185-17, criterion 23) is **still entirely owed** — 185-08
touched `PhaseNodeCard.tsx` for two docblock lines only.

**Plan 185-05 COMPLETE (`7a55b9da` waiting-is-not-failing → `a4010b46` the resume sweep's armed
branch → `fa2b56da` the no-deadline card).** The armed wait is now HONEST end to end. **(1) L-5
closed:** the pre-gate failure block no longer announces `gate_failed` before it pauses — an armed
checkpoint writes an **`action_risk_pending`** audit row (`{phase, timing}` only, never the raw
finding) and emits **`action_risk_pending`** (`phase` only) on the producer stream. **Phase 188's
run surface is the named consumer; no frontend handler exists yet, deliberately** (an unhandled
event is inert and the `ask_user_prompt` that follows is what the person sees — D-185-13). Every
other failing pre-gate keeps `gate_failed` byte-identical in BOTH channels; `grep -c
'event_type="gate_failed"'` is **3 before and 3 after**. **(2) L-7 closed with fix (a):**
`resume_stranded_workflows` gained a step-**2b** branch (inserted AFTER the existing
`_load_run_definition`, so the whole sweep diff is **purely additive — zero deleted lines**) keyed
on the NEW predicate **`_is_armed_action_risk(active_phase, definition)`**, which reads the parsed
`WorkflowDefinition` because an armed step's stored `workflow_phases.config` says `llm_agent` and
its `output` is null. It re-subscribes the **SAME `tool_call_id`** with **`timeout_seconds=None`**
— chosen over expire-and-re-ask because re-asking with a new id IS G-4 scenario 3's named failure
from the person's chair. **`_is_llm_human_input` is byte-UNCHANGED** and the two predicates are
asserted independent on the same fixture. `resume_pending_prompt` + `_emit_ask_user_prompt` widened
to `float | None` with a `None`-preserving coercion. **(3) L-15 closed:**
`PendingAsk.timeout_seconds` is now **`number | null`** and `PendingAskCard` is TOTAL over the null
case (one `hasDeadline` reading; the tick effect returns early so `remaining <= 0 → expired` is
UNREACHABLE; no clock renders; `formatClock` is never called on a null) — without it every armed
prompt would have rendered *"No response within 0:00 — agent stopped"* on arrival. The waiting copy
has ONE home, the exported **`NO_DEADLINE_WAITING_LINE`**, asserted PRESENT on the null card and
**ABSENT** on a `timeout_seconds: 300` card (SPEC Req 9's honesty fence, both sides).
**All three tasks falsified RED and reverted** (always-armed predicate → the freshness control red;
`_is_armed_action_risk → False` → both L-7 tests red; the `hasDeadline` guard disabled → both card
tests red). Gates: `test_185_engine_attachment.py` **22 passed**, **281 passed** across the
harness/grounding/185/ask_user/validator/gate/workflow/publish/resume set, `PendingAskCard.test.tsx`
**27 passed** (23→27, no case deleted, 0 deletions inside either pre-existing expiry block), tsc
**33** (= baseline, 0 naming a touched file), count gate per the VALIDATION posture (no
`[count-decrease]` / `[total-below-baseline]` / `[missing-file]`; total **1574**; failures churned
20→24 on an unchanged tree, and `PendingAskCard` is absent from the 63-file failing list).
`phase_types.py` **0 files** (criterion 20 holds), migrations **0 files** (head stays 113), D-14
Deep fence **0 files**.
**⚠ G-4 scenario 3 is NOT closed by this plan — every layer of it is now individually correct and
the SEAM BETWEEN THEM IS UAT.** Unproven by unit tests: that an armed run genuinely reaches
`find_resumable_runs` after a real restart; that `/pending` serves the resumed card to a
reconnected browser with `timeout_seconds: null` intact through the real wire; and that a click on
the resumed card publishes onto the channel the sweep re-subscribed.
**⚠ RESIDUE, recorded in the phase's `deferred-items.md` with a re-open trigger:** answering an
armed checkpoint DURING a resume produces ONE further ask (the sweep unblocks, `_resume_run`
re-runs the still-`active` phase, the pre-gate mints a new id). Strictly better than before — the
pre-185-05 path produced that fresh ask anyway *while leaving the old row un-expired*, so
`/pending` served a DEAD card beside a live one — and fail-CLOSED throughout. Closing it needs a
durable-answer short-circuit at the disposition seam (a DB read + a resume-identity contract), i.e.
an architectural change outside SPEC Req 9's wording. **Phase 188 will render both asks.**
**Plan-internal contradiction documented (no code change forced):** Task 2's action mandates
`None if timeout_seconds is None else float(timeout_seconds)` while its own acceptance grep
requires `float(timeout_seconds)` to score 0 — the substring is inside the mandated expression. The
action text won; the bare hard cast at the call site is gone (`grep -c "tool_call_id,
float(timeout_seconds)"` → 0). **One Rule-2 auto-fix:** `api.ts`'s `ask_user_prompt` SSE parse cast
the value to `number`, laundering the very `null` this plan plumbs — now `number | null`.
**GOVERN-03 stays `Pending`** in REQUIREMENTS.md (the 185-02/03/04/06 precedent): the engine and
the card are honest, but the arming AFFORDANCE is 185-07/08's and the live G-4 pass has not run.

**Plan 185-06 COMPLETE (`e1ed4011` the KB list on the palette hook → `65438580` the two intents +
12 copy constants + `setPhaseGovernance` → `10aababe` the `setGovernance` store action).** The
CLIENT HALF of the governance data. **Names plans 07/08/09/10 use verbatim:**
`GroundingBundle.kb_tools` (api.ts), **`kbTools`** on `GroundingBundleState`,
`PhaseSpecJSON.grounding_escalated?` / `.action_risk_armed?`,
**`setPhaseGovernance(phases, slug, patch)`** + the exported **`PhaseGovernancePatch`** type
(`definitionOps.ts`), **`setGovernance(slug, patch)`** (`builderStore.ts`), and the twelve copy
constants `GROUNDING_DIAL_LOOSE_LABEL` / `GROUNDING_DIAL_STRICT_LABEL` /
`GROUNDING_NOTHING_TO_PROVE` / `GROUNDING_WHY_DETECTED` / `GROUNDING_WHY_ESCALATED` /
`GROUNDING_ALREADY_SET_NOTE` / `GROUNDING_TOOL_LIST_IS_THE_CONTROL` / `GROUNDING_ATTACHED_GATE` /
`GROUNDING_LOCK_REFUSAL` / `GOVERNANCE_GATE_ROW_LABEL` / `ACTION_RISK_ARM_LABEL` /
`ACTION_RISK_ARMED_NOTE`. **⚠ PLAN-VS-TREE PATH ERROR, inherited from PATTERNS §12 — plans 07-10
must not repeat it:** the plan named `frontend/src/stores/builderStore.ts`; that file does not
exist (`src/stores/` holds only `streamsStore.ts`). The builder store is
**`frontend/src/components/workflows/builderStore.ts`**. **`kbTools` rides on BOTH answer members
of the hook's union and on NEITHER waiting member** — a degraded folders/skills read must not
un-mark a locked step, while `idle`/`loading` stay data-free so their frozen module-scope identity
survives (pinned by an `Object.keys(state) === ["kind"]` assertion). Read as `bundle.kb_tools ?? []`
so a stale backend degrades to marking nothing rather than crashing a render site.
**Round-trip criterion 3 cost zero serializer code** — `fromCanvas` carries phases through BY
REFERENCE, so the new `canvasModel.roundtrip.test.ts` case is a `toBe` assertion, not a feature.
**`setPhaseGovernance` can never write into `config`, and the proof is reference identity**
(`expect(out[0].config).toBe(input[0].config)`); `PhaseConfigPatch` was NOT widened (D-185-10) and
`PhaseGovernancePatch` is a closed two-key type, so a general PhaseSpec writer is a typecheck error.
**D-185-02 honoured in copy AND in a test:** `GROUNDING_ATTACHED_GATE` claims
*retrieved-and-pointed-at*, and a fragment-assembled guard asserts the two emit-path signature
phrases are absent. The plan's own docblock instruction contradicted its own acceptance grep here
(it asked the file to quote what the grep forbids) — the grep won, and the rule is stated in the
docblock's own words. `setGovernance`'s `lastEditKind` is **`"config"`**, decided not copied:
arming changes no run order, no node count, no `phase_index`, so two flicks are ONE undo.
Gates: 52/52 hooks, 236/236 store+ops, 706/706 ops+roundtrip, tsc **33** (= baseline, 0 naming a
touched file), `npx vite build` exit 0, `git diff -- backend/ supabase/migrations` **0 files**.
Count gate per the VALIDATION posture: total 1504 → **1529**, no `[count-decrease]`, no
`[total-below-baseline]`, no `[missing-file]`, and all 24 failures are pre-existing SEED-056 rot in
files this plan never opened (below the recorded 34/35/40 churn band). **This plan renders nothing
and deletes nothing** — `groundingFor()` still ships; 185-08 owns its removal.
**GOVERN-01 / GOVERN-03 stay `Pending`** (the 184-02 / 185-02 / 185-03 precedent): the data and the
write chain exist, but no surface exposes them and the write chain is still missing its page
`useCallback` and its `PhaseFormPanel` prop.

**Plan 185-03 COMPLETE (`34532b9b` the two validator behaviours → `fa4fd3de` `effective_phase` →
`beae4639` the seam swap + suite → `cb329a36` SUMMARY). THE GATE NOW BITES.** `run_workflow`'s
`spec_by_slug` is a comprehension over **`effective_phase(phase, *, total_phases: int)`**
(`harness/grounding.py`) — the ONE enforcement seam, downstream of every
`WorkflowDefinition.model_validate()` (fresh kickoff, boot-time resume AND the publish golden run)
and upstream of `_run_phase_with_gates`, never on the save path. **Names plans 04/05/06 use
verbatim:** mode string **`"retrieved_and_cited"`**, finding prefix **`"action_risk:approval|"`**,
and `total_phases` is **keyword-only**. **The headline landmine is dead:** the shipped
`deterministic` mode reads `output["field_map"]`, which NO agent step produces, so attaching it
unchanged would have failed 100% of detected steps — the new mode reads **`citations`** (built by
the retrieval TOOL off `ToolResult`, so unfakeable) and never `source_refs`. Three properties are
structural, not asserted: an ungoverned phase is returned **BY REFERENCE**
(`effective_phase(p, total_phases=1) is p` — that IS D-14's byte-identical-when-unset); the
engine's spec is **APPENDED** so `validators[0]` stays the author's and the WR-03 retry seed is
untouched; and a deliberately weak author spec (`presence, min_markers: 0`) passes at index 0 and
is then followed by the real gate failing at `validator_index == 1` (D-185-05 — not
author-loosenable-away). **Falsified:** the return was flipped to PREPEND and the index-0
assertion turned RED (output quoted in the SUMMARY), then reverted — the other 7 tests stayed
green under the plant, which is exactly why that assertion had to exist. **Publish consequence,
confirmed with greps before being recorded:** `_drive_golden_run` (`:688-865`) reaches the engine
only via `run_workflow` (`:717` import, `:830` call), so the gauntlet gains NO new stage but a
detected step whose golden run retrieves nothing now **fails the golden-run stage and blocks
publish** — acceptable, every `workflow_definitions` row is throwaway test data.
**Plan-vs-tree discrepancy (no code change):** Task 2's criterion "`grep -c model_validator` returns
0 for both files" is unsatisfiable — `harness.py` has carried two `@model_validator(mode="after")`
since 098/099, both pure structural REJECTIONS that never touch `validators`, untouched by this
plan. L-2's real intent is now enforced by a tokenize-based code-only guard with two positive
controls. Gates: 13/13 + 8/8 new, **284 passed** across the harness/grounding/182/185/validator/
publish set, migrations **0 files** (head stays 113), `frontend/` **0 files**, D-14 Deep fence
**0 files**, exactly the 5 planned files touched.
**GOVERN-01 / GOVERN-03 stay `Pending`** in REQUIREMENTS.md (the 184-02 / 185-02 precedent) —
enforcement is now real but no surface exposes it; marking them Complete at plan 3 of 11 would
make the traceability table lie. **Nothing pauses yet:** `action_risk_approval` is registered and
attached, but its wait is the shipped bounded `ask_user` timeout until 185-04 makes it indefinite —
and RESEARCH L-4/L-5/L-6/L-7 plus the five `_resolve_failure_with_ask_user` deltas are ALL still
open and are that plan's work.

**Plan 185-02 COMPLETE (`f3584c5b` PhaseSpec intents → `04d475d4` KB_TOOLS + grounding_cause →
`9fe05885` the palette field → `df28e813` SUMMARY).** The detection foundation plans 03/06/07/08
all read from. **The names are final and downstream plans reference them literally:**
`PhaseSpec.grounding_escalated` / `PhaseSpec.action_risk_armed` (both `bool = False`),
`ValidatorSpec.kind` grown 9 → 10 with `"action_risk_approval"`, `grounding.KB_TOOLS` (frozenset)

+ `grounding.KB_TOOLS_SORTED` (wire form) + `grounding_cause(phase) -> "detected" | "already-set"

| "escalated" | None`, `GroundingBundle.kb_tools`, and the wire key **`kb_tools`** on
`GET /workflows/grounding-bundle`. **Req 3 is now true BY CONSTRUCTION, not by audit** — only the
author's escalation INTENT is stored; `detected` and `already-set` are recomputed at read time
from `config`, so there is no representable value that says a detected step is free to think and a
hand-edited JSONB row cannot lie. **The branch order is the mechanism** (detection checked FIRST):
an escalated step that gains `search_documents` reports `detected` and the stored bit goes INERT
without being rewritten, so the undo disappears and returns on its own when the tool is removed.
The KB list has exactly ONE backend home (D-182-06 red line) and reaches the client as DATA;
the client predicts, the server enforces. **Falsified:** `grounding_mode = "detected"` planted at
module scope in `grounding.py` turned the criterion-8 tokenizer source guard RED (output quoted in
the SUMMARY), then reverted — the guard strips comments AND string literals, so it cannot be
satisfied by editing prose (the D-ITEM-183-02 trap), and its needles are assembled from fragments.
Gates: 11/11 + 38/38 new, 161 passed across the grounding/harness/182/185 set, `git diff --stat --
supabase/migrations` **0 files** (live head stays 113), `-- frontend/` **0 files**, the D-14 Deep
fence **0 files**, exactly the 5 planned files touched. **Nothing enforces anything yet** — the
`harness_engine.py:1118` `spec_by_slug` seam is untouched and is plan 185-03's.
**GOVERN-01 / GOVERN-03 deliberately left `Pending`** in REQUIREMENTS.md (the 184-02 precedent):
this plan ships the substrate, not a user-visible capability, and marking them Complete at plan 2
of 11 would make the traceability table lie for the rest of the phase.
**Side effect to expect at every surface:** `model_dump(mode="json")` now writes
`"grounding_escalated": false, "action_risk_armed": false` into every saved draft JSONB — additive
and harmless (identical to `name: null` since 103), but the first save after 185 is not a
zero-diff save. **Out of scope, logged:** `pytest tests/unit` is 62 failed / 1549 passed on this
tree, all pre-existing rot in unrelated files (retrieval/sql/explorer/multimodal + one unmocked
live-provider test) — recorded in the phase's `deferred-items.md`; verification must scope its
pytest runs rather than assert a globally green suite.

**Phase 184.1 COMPLETE (`90f07551` pin → `0e9466de` merge → `12c557b3` budget+guards → SUMMARY).**
The Builder's three stacked header bands collapse into ONE flag-gated row, reclaiming **a MEASURED
61px** above the canvas — the operator's Phase 184 UAT report (275px of chrome over a 288px canvas
at 639px). **Figure corrected 2026-07-28** at phase-184 verification, superseding the ~90px this
line shipped with: measured live at a 900px viewport using the flag gate as the A/B (flag-off still
renders the old three bands) — header chrome 146px → 85px = **61px**, canvas graph surface starting
79px higher than the flag-off content. The 146px baseline was exact; the plan's own ~56px *target*
for the merged row is what missed (it ships at 85px), so nothing is lost in the flag-off surface.
On the Spine view the net is only 13px (the new tablist reinvests the saving); the gain belongs to
the Canvas view. Working: `184-UAT-RESULTS.md` § Measured.
**The pin was written FIRST**, green against the unmodified page, and passed after the merge with
**zero edits** — which is the evidence the flag gate held. `WorkflowBuilderPage.header.test.tsx` is
the first suite to ever pin this surface (D-181-01 was previously untested here). **Both required
falsifications were performed:** deleting a band red 6/7 (count 3→2); splitting the merged row red
4 (count 1→2, budget delta 2→1). Gates: tsc **33**, `npx vite build` exit 0, snapshots unchanged,
count gate **PublishGauntlet-flake only** across 3 runs. **D-184.1-04** recorded: the three bands
sit at three NESTING levels, so the two ancestor owners read the flag through ONE exported
`useCanvasGate()` rule (App.tsx's single fetch untouched) — the dispatch's "one call site in the
whole tree" instruction was escalated as a checkpoint and withdrawn by the coordinator (`34ddff75`
added `WorkflowsPage.tsx` to scope). **Owed:** operator UAT at ~900px width (the jsdom-unmeasurable
half), and `scripts/vitest-count-gate.cjs` `TARGETS` does not yet include the new pin.

**Plan 184-01 COMPLETE (`4a019bd8` gate → `ffb3e9cf` icon swap → `854ec42b` SUMMARY).** Wave 0's
measuring stick landed FIRST as its own single-file commit: `scripts/vitest-count-gate.cjs` pins
**per-FILE** counts (16 files / 424 tests / 0 failing), not just failures — the Phase-177 lesson that
a failures-only differential cannot see a *deleted* test. **Falsified before trusted:** deleting one
`deriveTier.test.ts` case produced `[count-decrease] deriveTier.test.ts — pinned 9, ran 8 (-1)` +
`[total-below-baseline] 423 < 424`, exit 1; restored → exit 0. Report writes to `os.tmpdir()` and the
script hard-refuses any path inside `frontend/`/`backend/` (T-184-01-03). Then the D-184-07 icon swap
as a **standalone three-file revert unit** (gate script NOT in it): `llm_agent`→`compass`,
`llm_batch_agents`→`handshake` across BOTH maps + both `~icons` imports + the verified-slugs docblock

+ one assertion. Gates: 424/424 all deltas 0, tsc **33** (= baseline, 0 phase-file names), `vite

build` exit 0, canvas snapshot byte-unchanged. **The D-184-08 carve-out is now SPENT** —
`soulData.test.ts:132-133` was the ONE permitted assertion edit in phase 184; 184-02/184-03 are under
a zero-assertion-edit gate, and any assertion edit there means the extraction was not
behaviour-preserving. **Deviation accepted by operator:** the plan's `npm run build` exit-0 criterion
was unsatisfiable on an untouched checkout (`tsc -b && vite build`, 33 pre-existing errors) → split
into a DIFFERENTIAL tsc count + `npx vite build` exit 0, per D-ITEM-183-01. **Deferred to phase
verification (G-4 row, not a gate on these commits):** the live in-app five-surface sweep — Docker
Desktop was down, so the operator substituted stronger mechanical evidence (measured luminance from
the installed icon set independently reproducing the sketch claim — `busts-in-silhouette` **33.3** vs
`handshake` **181.4**, against a 144–172 band for every other mark — plus both marks rendered against
the real Deep Midnight tokens: old mark near-invisible, both new marks legible and in-band).

**Plan 184-02 COMPLETE (`f6ac55f7` six pure ops → `d3d21abd` refusals/slug/drag → `8e549d68`
SUMMARY).** `definitionOps.ts` (461 L) is now the ONE mutation home for `WorkflowDefinition.phases`
— zero React, zero store, zero API-client, zero canvas import. R1's contiguous-`phase_index` proof
is a plain unit test swept over all 15 shipped fixtures, behind a **falsified** planted-gap control
(flattening `[0,1,3]`→`[0,1,2]` turned it red: *expected [] to include 3*; restored → green). Both
cheap refusals landed as pure predicates — `canRemovePhase` grounded on the shipped
`parseSkipTarget` (RESEARCH A4: the real orphan is a dangling `skip_to_phase`, not index
arithmetic) and `allowedTypesAt` returning **six** choices always, a stranding one disabled with
its reason. Network-freedom proved twice and both falsified: a `?raw` source fence plus a
whole-suite `fetch` spy at **0** calls. **Zero assertions edited in any pre-existing test file and
zero import-path-only changes** — the only test file in the plan's diff is net-new (795 insertions
/ 0 deletions), so the D-184-08 carve-out stays spent. Gates: count gate exit 0 on both commits
(551 then 595, 0 failing, every one of the 16 pinned files at delta **0**), tsc **33** (= baseline),
`vite build` exit 0, canvas snapshot byte-unchanged, 0 migration files. **No production caller is
wired** — `WorkflowBuilderPage.tsx` is untouched and is repointed in 184-04, so nothing shipped can
regress from this plan. **Deviation worth carrying (D-184-02-A):** the plan's stranding boundary
("at or after" the deliverable) is off by one — inserting AT the emit's position puts the new step
BEFORE it, so that boundary would refuse "add a step just before the deliverable" while stating a
reason that is factually false. Implemented strictly-after; `StepTypePicker` (184-04) inherits it.
**CANVAS-02 deliberately left `Pending`** in REQUIREMENTS.md: this plan ships the substrate, not a
user-visible capability, and marking it Complete at plan 2 of 13 would make the traceability table
lie for the rest of the phase.

**Plan 184-05 COMPLETE (`1a12a72d` fromCanvas + guards → `91614f4e` dump + generator → `685d4e7f`
the R2 property).** `canvasModel.fromCanvas` is the ONE client serializer and carries phases through
**BY REFERENCE** — so every field `toCanvas` drops (~20 config, 3 validator, 13 workflow-level)
survives a save by construction, not by diligence. It takes **no `edges` argument** (RESEARCH Q1),
reads only `node.id` + node ORDER, **never renumbers** (that stays `definitionOps.renumber`, so the
shipped `indexGap` `[0,1,3]` round-trips as an identity), and **fails SAFE on duplicate slugs** by
handing the source back untouched. Proof is **reference identity**, and it was falsified: a
one-line shallow rebuild (`out.push({...phase})`) turned **13 `toBe` assertions red** with
`Object.is equality` while **every `toStrictEqual` backstop stayed green** — the observation that
shows a deep-equality-only suite would have passed a serializer that had just copied every phase.
Coverage: 15 hand-authored generator shapes (one per config-union member with EVERY optional field
populated, both branch outcomes, gate-heavy, 12-deep, index gap, duplicate index, duplicate slug)
plus whatever the committed dump holds. Gates: count gate exit 0 (**752** total, 0 failing, all 16
pinned at delta 0; `canvasModel.purity.test.ts` 69→79 is an ALLOWED increase), tsc **33**, `npx
vite build` exit 0, canvas snapshot byte-unchanged, 0 migration + 0 backend files,
`__fixtures__/canvasFixtures.ts` untouched, **zero assertion edits** (both test files in the diff
are 379 insertions / 0 deletions). **CANVAS-02 deliberately left `Pending`** — this ships the save
path, not an affordance. **⚠ VERIFICATION BLOCKER — regenerate the corpus dump.**
`__fixtures__/corpusDump.json` is honestly EMPTY (`row_count: 0`) because local Supabase at
`127.0.0.1:54322` refused the connection (Docker down); the refusal reason is recorded in-band and
**no corpus data was invented**. Before `/gsd:verify-work`: `supabase start`, then
`backend/venv/Scripts/python.exe scripts/dump-workflow-corpus.py`, then commit the artifact — the
suite unions it in with no code change. Pairs naturally with 184-01's still-open live five-surface
icon sweep, which needs Docker too. **Three self-matching-guard traps hit and fixed in one plan**
(a docstring quoting its own read-only grep, a docblock naming the serializer it forbids, and a
`.source` regex firing on the spread `[...source]`) — when authoring a "grep for token X, expect 0"
criterion, name the CONCEPT in prose and put the literal where the grep does not look.

**Plan 184-06 COMPLETE (`7f71d6d5` api clients → `06b9a41f` the hook → `84d48049` R7's proofs →
SUMMARY).** The two canvas routes Phase 182 shipped and nothing ever called now have typed clients,
and `useLiveValidation.ts` owns the app's ONLY call to the validation seam — which is what the
shipped `WorkflowCanvas.test.tsx` scope fence forces, so the canvas takes `verdicts` as a prop and
Phase 188 can reuse the shape. **Last-write-wins is enforced twice on purpose** (D-184-13): an
`AbortController` cancels the in-flight call and a monotonic sequence drops a reply already sitting
in the network buffer. **The success path checks the sequence and NOTHING else** — a
`signal.aborted` check there (which looks like good hygiene, and `usePanelReconcile` has one) would
have made R7's out-of-order test pass on ABORT, voiding the proof. Falsified: deleting the sequence
check turned **exactly 1 of 20 red**, naming the older verdict rendering over the newer, while the
in-order sibling AND the abort-silent test both stayed green — which is what shows the red one is
about ordering and not about abort. **Every non-200 is fail-closed BY SHAPE** (D-184-14): the
`degraded` state carries no `ok` field at all, so "a blip rendered as a green light" is
unrepresentable; the 422 gets `cause: "unreadable"` and everything else `"unreachable"`, so a
reproducible shape rejection is never worded as "try again". **The 422 body is logged, never
shown** — asserted over EVERY string reachable from the state at any depth, with a positive
control. **No call fires before the first edit** (D-184-15) and the client classifies nothing
(unknown codes pass through verbatim). Gates: the new suite 20/20 with **exit 0** checked
explicitly, count gate exit 0 (752 total, 0 failing, 16/16 at delta 0), tsc **33**, `npx vite
build` exit 0, snapshot byte-unchanged, eslint clean, **zero assertion edits**, 0 backend + 0
migration files. **VALID-02 / VALID-03 deliberately left `Pending`** — the loop exists and is
proven, but no surface renders a verdict yet (184-08 / 184-13).

**Plan 184-07 COMPLETE (`2128dda3` canvasNudge → `782c4de9` StepTypePicker → `51e8bdca` its
suite → SUMMARY).** The two leaf modules the editing surface will consume. **The cosmetic `dy`
now lives in ONE browser-local module** keyed `agentic-rag.canvas-nudge.v1.<user_id>.<draft_id>`
— 138 C-local's "keep the interaction, move the storage" — so `git diff -- supabase/migrations`
is **0 lines** and slot 114 stays RESERVED, with the written promotion trigger recorded verbatim
in the docblock. The module imports neither the builder store, the canvas model nor the API
client (a `?raw` fence with planted controls) and a whole-suite spy recorded **0** calls, so
Phase 186's *"a cosmetic drag never mints a version"* is true by construction, not by a code path
someone has to defend. **An unsaved draft persists literally nothing** — `localStorage.length`
unchanged, 0 keys under the prefix — and a session with **no resolvable user id** takes the same
in-memory path, because an unscoped key is exactly the leak the per-user scoping prevents.
**Falsified:** removing the user segment from the key turned 5 isolation assertions red (user B
read user A's layout; Tidy-up wiped the neighbour). The `＋` menu (`StepTypePicker`) lists all
six types in the D-183-06 plain-language sentences with the shared 3D marks, and renders a
refused choice **disabled with its reason as real DOM text** wired by `aria-describedby` — never
a `title`, never omitted. **The picker authors no reason of its own:** the rendered sentence is
asserted character-identical to `definitionOps.STRANDING_REASON`, and `grep -cE 'would
(strand|come after)'` on the component returns 0. **Falsified:** filtering the refused rows out
turned 6 assertions red. **The plan text carried the SUPERSEDED at-or-after boundary** — 184-02
Deviation 1 corrected it to strictly-after, so the suite asserts BOTH sides (index 2 offers all
six enabled, index 3 refuses all six); **184-12 consumes the same function and must not
re-introduce the old rule.** One fence was deliberately NOT written (a blanket grep for the
auth-token key name) because it would have forced the docblock to omit the very read it explains
reusing — the D-ITEM-183-02 trap avoided at authoring time rather than after. Gates: 31/31 +
34/34 new, the full plan set 817/817 exit 0, count gate exit 0 on all three commits (16/16 at
delta 0), tsc **33**, `npx vite build` exit 0, snapshot byte-unchanged, eslint clean, **zero
assertion edits**, 0 backend + 0 migration files, 0 deletions. **Neither module is mounted** —
184-12 wires them — so **CANVAS-02 / VALID-02 deliberately left `Pending`**.

**RE-VERIFICATION GATE (2026-07-26, post-`183-09`): `human_needed`, not `passed`.** All 8
must-haves verified in code by direct source read; phase-scoped suite re-run independently at
423/423 with the per-file count pins (19/31/22) intact — no coverage loss. Regression gate clean:
the 9 repo-wide failing files return **identical** results (21 failed / 112 passed) at both the
pre-`183-09` baseline and HEAD → pre-existing SEED-056 rot, not regressions. Schema drift none;
codebase drift `warn` only. What blocks `passed` is **U-5 / U-6** in `183-HUMAN-UAT.md`: jsdom
proves the ✕ EXISTS, but only a live pass proves it is **FINDABLE** — which was the operator's
literal original complaint. Code review `183-REVIEW-09.md`: 0 Critical / 6 Warning / 5 Info; the
reviewer confirmed all three defects closed by reading the installed `@xyflow/react@12.11.2`
source rather than trusting the SUMMARY. **Open warning worth a decision before Phase 184 —
WR-09-01:** Escape and pane-click silently drop a focused field's pending autosave while the ✕
does not (no `blur` fires when a focused input is unmounted), an edit-loss asymmetry between the
three dismissal paths. Bounded (a later save recovers it) but real. Its sibling WR-09-02: the
"a dismissal must not PATCH a version" assertion sits on the ✕ tests — the one path that DOES
write — while the Escape/pane-click tests carry no write assertion at all.

**`183-09` gap closure SHIPPED (`3dc0671e` RED → `4e997f03` GAP-1 → `45633371` GAP-2/3).** All
three defects the live UAT confirmed are paid down, TDD, on the still-read-only surface rather
than handed to Phase 184 as inherited debt. **GAP-1** — the step panel now has a discoverable ✕
in its header (a REQUIRED `onClose` prop, so an unclosable panel is a typecheck error), plus
Escape and canvas pane-click-away; fixed in **BOTH** views and **flag-independently**, because the
defect was pre-existing Spine debt the canvas inherited — the Spine half is asserted with
`visual_workflow_canvas` **OFF**. **GAP-2 (WR-08-01)** — an `event.repeat` guard; a held
Enter/Space now activates exactly once. **GAP-3 (WR-08-04)** — the end cap and unresolved-skip
stub no longer inherit "Press enter or space to open this step's details". RED observed first:
exactly 8 failures, the auto-repeat test failing at **3** calls. Gates: 380 phase-file / 438
superset passed (0 failed), tsc 33 (≤33) with 0 phase-file names, a11y lint clean, build exit 0
with the canvas still its own lazy chunk, one snapshot moved additively by exactly 15
`domAttributes` keys with **0** deletions, `canvasModel.purity.test.ts` green UNMODIFIED, backend
13/13 untouched. **D-181-01 is NOT violated** — no nav entry, `"off"`-audience byte-identity and
`require_canvas` 404 pre-auth are all untouched (D-183-13 precedent). **Two decisions to carry:**
the Spine's empty-area click-away is deliberately deferred on **implementation cost + G-5 blast
radius, explicitly NOT the `jsx-a11y` gate** (a window listener would sidestep it, as Escape does)
— overturnable on operator call; and WR-08-02/03, WR-02/03/04, IN-01…IN-07 stay open as accepted
debt. **Two new manual rows U-5/U-6** added to `183-VALIDATION.md` — only a live pass can prove
the ✕ is *findable*, which was the operator's original complaint. **Next: re-verify 183, then
Phase 184.**

Orchestrator note: `state.advance-plan` again bumped `completed_phases` 2→3 (the recorded SDK
quirk) — hand-corrected back to 2 in this commit. Phase 183 is not complete until re-verification.

**Live UAT closed the human gate (`65e6ff5d`, `183-HUMAN-UAT.md` — 5 pass / 0 fail).** All four
G-4 rows U-1…U-4 plus the post-183-08 keyboard/screen-reader row were driven live; operator
drove U-1/U-2 + the U-4 flag flip, Claude drove Chrome DevTools for the U-3/U-4 DOM checks and
the U-5 accessibility-tree + real-key-press pass, operator confirmed each checkpoint.
`183-VERIFICATION.md` flipped `human_needed` → `passed`.

**Three findings the live pass produced — none reopens a 183 truth, ALL routed to `183-09`:**

1. **NEW GAP — the step detail panel has no discoverable close.** Its only exit is
   re-activating the SAME node (`WorkflowBuilderPage.tsx:206` toggle); zero buttons in the
   panel subtree, Escape does nothing, `onPaneClick` is unwired. **Explicitly NOT a 183
   regression** — reproduced live in the `[≣ Spine]` view with the Canvas never opened, so it
   is pre-existing debt the canvas inherited via the shared `handleSelectNode`.

2. **WR-08-01 CONFIRMED LIVE** (was theoretical): 1 real keydown + 1 `repeat:true` keydown
   both toggled ⇒ no `event.repeat` guard ⇒ a held Enter/Space rapid-toggles the panel for
   exactly the keyboard/switch users CR-01 was fixed for.

3. **WR-08-04 CONFIRMED LIVE**: the inert `__canvas__end` cap (role=null, non-focusable) still
   carries `aria-describedby` → "Press enter or space to open this step's details."
   **WR-06 CONFIRMED CLOSED live** — no arrow-key/delete text anywhere in the a11y tree.

**Two records to carry forward (not defects):**

- **U-3 was testing an unreachable state.** Its premise "40 of 95 definitions have zero phases
  — the most common canvas state" is FALSE: those 40 are Phase-167 fixtures (`Global WF` /
  `Preview WF`) invisible on every shelf (Published fetches `scope:"mine"`, Starters is curated,
  Drafts is drafts-only), and the Builder has no delete-step affordance. A throwaway zero-step
  draft was seeded, driven, and deleted. **Becomes genuinely reachable in Phase 184** once
  step deletion lands — re-point this row then.

- **Flag propagation is reload-gated by design** (`EffectiveFeaturesProvider` fetches once per
  session). Fine for a planned rollback; worth a decision if `visual_workflow_canvas` is ever
  needed as an INCIDENT kill switch, since open tabs keep the canvas until they reload.

**Re-verification 2026-07-26 (`096a9e58`): `gaps_found` → `human_needed`, 4/4 must-haves verified.** The SC#3 blocker is closed for real (verifier read `WorkflowCanvas.tsx` directly, did not trust the SUMMARY). **Nothing code-side blocks the phase; the only thing between 183 and `passed` is operator-driven live UAT** — the four G-4 rows **U-1…U-4** plus a real-screen-reader pass on the newly-added keyboard path, persisted as `183-HUMAN-UAT.md` (5 items, all pending). `visual_workflow_canvas` cold-defaults to `"off"` — flip it **On in the Control Room first**; U-4 flips it back. **New Warning-level debt from the scoped gap-closure review `183-REVIEW-08.md` (0 Critical / 4 Warning / 4 Info), independently re-derived by the verifier and NOT auto-folded:** **WR-08-01** no `event.repeat` guard — a held Enter rapid-toggles the panel and can settle CLOSED, contradicting the ARIA promise (the new test can't see it: synthetic `fireEvent.keyDown` never sets `repeat`); **WR-08-02** the grounding/tier agreement docblock overclaims — three gate-carrying configs still disagree and the new pin (`deriveTier(policy, new Set())`) is scoped to hide them, so WR-01's contradiction stays reachable; **WR-08-03** `ARIA_LABELS` is untyped so a library key rename silently reverts WR-06 with a green build; **WR-08-04** the end cap + unresolved-skip stub — the two nodes the CR-01 guard keeps inert — still announce "Press enter or space to open this step's details". **Operator decision owed:** fold these into a `183-09` gap plan, or accept as debt alongside WR-02/03/04 and carry into Phase 184. Orchestrator note: `state.advance-plan` bumped `completed_phases` 2→3 in `1b9fad84`, falsely marking 183 complete — reverted in `b6ae96f7`.

Status: Executing Phase 188

**Phase 184 — ALL 13 PLANS EXECUTED 2026-07-27** (`184-13-SUMMARY.md`, commits `dfee9500` / `e72b561e` / `42bd7533` / `728fc564`). The final plan mounted the problems tray, put undo/redo + the honest save state on the canvas in one bottom region with the tray's summary (R12: one region, two rows, at 900 px), and landed D-184-04's four key bindings behind a single gated window listener that yields to text fields. Count gate exit 0 at **1037 tests / 0 failing**, `tsc` differential held at **33**, `npx vite build` exit 0, canvas snapshot byte-unchanged, `revertByteIdentical.test.tsx` green at 7. **Phase-wide: zero `backend/` files and zero `supabase/migrations` files changed** — slot 114 stays RESERVED. **All 5 REQ-IDs (CANVAS-02/03/04, VALID-02/03) remain Pending — REQUIREMENTS.md is deliberately untouched and the orchestrator marks them at phase end after live verification.** Orchestrator note: `state.advance-plan` again bumped `completed_phases` 3→4, falsely marking 184 complete before verification — **reverted here**, exactly as it was for 183 in `b6ae96f7`. Owed to `/gsd:verify-work`: regenerate `__fixtures__/corpusDump.json` (184-05) and the live five-surface icon sweep (184-01), both needing Docker up; plus R12's visual half at 900 px and the two-save-entry-points read (184-13 Deviation 3).

**Phase 183 (read-only-canvas) — CONTEXT GATHERED 2026-07-25** (`865cbde1`; `183-CONTEXT.md` + `183-DISCUSSION-LOG.md`). All 4 gray areas discussed (the two the sketches left with no winner, plus the faithfulness and G-5 calls). **D-183-01..15 locked.** Headlines: the canvas is an **in-Builder `[≣ Spine] [⬡ Canvas]` toggle** (no new ActiveView, **no nav entry** — this formally RELEASES 181's deferred nav-entry promise and `revertByteIdentical.test.tsx`'s scope-freeze assertion keeps holding); **Spine stays the default**; flag-off ⇒ the toggle **VANISHES** (@xyflow out of the render path); click fires the EXISTING `onSelectNode` → shipped `PhaseFormPanel` (zero net-new panel); plain-language step-type fallback titles (only 10/119 phases have a real `phase.name`); 2 badge slots = grounding (derived from `citation_policy` + `citations_required`, NOT 185's authored field) + "Waits for you" on `llm_human_input` only; **layout = a PURE function of the definition** (no DOM measure → SC#4 becomes a snapshot test; clipping solved in CSS); unresolvable `skip_to_phase` renders as a **visibly broken reference** (agrees with the backend's existing `UNSATISFIABLE_SKIP`, `reachability.py:154`); test-only fixture table with ONE synthetic `branching` seed (no DB seed, no new starter); named empty state with ALL canvas chrome suppressed. **G-5: extract one shared vocabulary module AND repoint `PhaseSpineGraph`** — scouting found `soulData.ts`'s header falsely claims the `PhaseSpineGraph.tsx:24-31` duplicate was already replaced; it still renders the flat text glyphs Phase 127 retired (planner note: treat in-code claims of prior extraction as unverified). **The cross-cutting icon slug swaps (`compass` / `handshake`) stay a SEPARATE dedicated task** — 5 shipped surfaces, must not ride a canvas rollback; 183 ships only the canvas-local icon-well lightening. Client parse + a parity test pinned to `reachability.parse_skip_target` (:89); **183 does NOT call `/validate`** (that arrives with 184). D-181-08's freeze on `WorkflowBuilderPage.tsx` was 181-only and does not carry forward. **G-4: 4 operator-named live-UAT scenarios recorded** (Spine⇄Canvas agree · the 5-phase maximum reads without h-overflow · the empty draft doesn't look broken · flag-off = yesterday's Builder incl. operator accounts). Reported-bugs cross-check: 6 open `Agentic-RAG` reports, none folded; BUG-260609-04's re-open trigger repointed 124 → **188**. Next: `/gsd:plan-phase 183`.

**G-2 sketch gate for Phase 183: SATISFIED (2026-07-25).** Sketches 134-137 committed (`01bb4c64`, `7b74d2b5`, `01d50bba`, `86f866c5`, `e35c7489`). Winners: **136-B** (horizontal left->right flow) + **137-D** (frosted-glass step cards, 3D icon floating at the left edge, plain language with technical names behind the Alt reveal, Alive-by-default motion). Locked rules the canvas phases inherit: **colour budget** (step-type colour is a tint behind the icon only — the strong colours belong to Phase 188 run status) and **motion keys off run state, never selection**. New reusable asset `.planning/sketches/themes/phase-icons-3d.js` (verified 3D fluent-emoji marks; NEVER text glyphs). Icon choices: `llm_agent` -> `compass`; `llm_batch_agents` gets a lighter icon well in-scope, with the cross-cutting `handshake` swap left open. **Two findings that must reach the 183 plan: (1) `skip_to_phase` is used ZERO times in all 95 live definitions — SC#1's branch edge needs a fixture; (2) 40 of 95 definitions have zero phases — the empty projection is the most common canvas state.**

Last activity: 2026-08-05 -- Phase 188 execution started

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260611-irx | Per-process log filename — fix Windows multi-worker RotatingFileHandler rollover crash (WinError 32) | 2026-06-11 | `b5e916e2` | | [260611-irx-worker-log-rotation-pid](./quick/260611-irx-worker-log-rotation-pid/) |
| 260630-226 | Chat tool-card live-state de-duplication — active tools rest as the unified essence line (Variant B merged pill, body click-to-expand) + remove 3 loose duplicate lines below the run card (SEED-098) | 2026-06-30 | `e3ff8623` | | [260630-226-chat-tool-card-live-state-de-duplication](./quick/260630-226-chat-tool-card-live-state-de-duplication/) |
| 260705-hz1 | Fix SEED-102 — reverse the load_skill name-collision tie-break so an is_system built-in wins over a same-named owned row (`_handle_load_skill`, tool_dispatcher.py) + regression test | 2026-07-05 | `244668f0` | Verified — 19/19 green (independently re-confirmed after a mid-session tool outage cleared); plan-checked 0 blockers (2 passes); scope-contained (`git show --stat` = exactly 2 files) | [260705-hz1-fix-seed-102-reverse-the-name-collision-](./quick/260705-hz1-fix-seed-102-reverse-the-name-collision-/) |
| 260731-3y4 | Allow-list the armed PROCEED branch (`harness_engine.py`) — closes security BLOCKER **T-185-04-01** raised by `/gsd:secure-phase 185`. A **typed** refusal ("no", "nope", "stop it", "Do not run it." with a trailing period) on an armed action-risk checkpoint fell through the `_is_abort_choice` deny-list, RAN the risky step and wrote a `validator_ask_user_approved` receipt naming the person who refused. Phase 185's invariant guard was real but scoped to the presented BUTTON labels; `PendingAskCard`'s free-text textarea is unconditional and `runs.py` never validated `response_text` against the prompt's options. Fixed on the engine (a UI fix leaves the API open): `_ACTION_RISK_APPROVE_CHOICE` written once, and on the armed path ONLY the exact presented label proceeds — everything else → `fail_run`, no receipt. `_is_abort_choice` stays first so aborts keep their byte-identical reason; the branch is gated on `is_action_risk` so the three non-armed pairs are unmoved. | 2026-07-31 | `417728bd` | Verified — 6/6 must-haves. 18/18 disposition tests green; the 18-row refusal table observed **RED pre-fix** (every row PROCEEDed with a receipt). Plant-A falsification independently reproduced by the verifier (removing the `is_action_risk` guard → 4 RED, incl. **3 shipped tests the plan never opened**) then reverted with `git diff --stat` clean. Full suite 62 failed / 1626 passed vs the 62/1616 baseline — failure count byte-identical, +10 accounted (+6 mig-113 era, +4 this plan). Scope: exactly 2 files; D-14 Deep fence, `runs.py`, `frontend/`, `supabase/migrations` all 0. | [260731-3y4-armed-approval-allow-list](./quick/260731-3y4-armed-approval-allow-list/) |
| 260705-nfu | Fix silent data-loss bug in skill ZIP import — one colliding flattened filename (e.g. duplicate `__init__.py` from different folders) used to throw an unhandled exception that killed the rest of the upload loop, silently dropping every later file (confirmed live: the real imported docx skill was missing 6 files, incl. its whole templates/ folder). `_upload_skill_files` is now per-file resilient (try/except, logs, returns errors) + `import_skill` de-dups colliding flattened names (`_dedup_flattened_name`) before upload; sync-path failures surface via the existing `errors` response channel, background-path failures are logged. Folder-tree fidelity itself stays unchanged/deferred. | 2026-07-05 | `0402fa6b` | Verified — 18/18 new+existing tests green + 37/37 across the full skills suite (independently re-run after Docker/backend came back up); plan-checked 0 blockers (2 passes, 1 trivial self-corrected); scope-contained to `skills.py` + its test file | [260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip-](./quick/260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip-/) |

### Recent Completed Phases

**Guardrail overrides:**

- **G-5 / Phase 187 (2026-08-02, plan-phase) — FIRED on `WorkflowCanvas.tsx`, honoured by construction, no override taken.** The ledger row for `WorkflowCanvas.tsx` (1574 L, extraction due in Phase 188, seam named by `185-10`) fires, and `187-RESEARCH.md` initially recorded the file as "must not be touched". **It must be touched:** `toCanvas` has exactly ONE production call site and it is `WorkflowCanvas.tsx:879`, so Req 1's derived node face is unreachable without a pass-through. Plan **187-08** takes the narrowest possible diff — the same shape Phase 185 added for `kbTools` — and **caps it as a checkable acceptance criterion** (`git diff --numstat`: ≤ 7 insertions / ≤ 2 deletions on `WorkflowCanvas.tsx`, plus a grep criterion asserting **no new state / effect / function**). `ProblemsTray.tsx` is threaded through the same file (mounted at `:1383`), capped ≤ 8 ins / ≤ 1 del. **The Phase-188 extraction remains due and is not discharged by this.** Deviation surfaced by the planner, not silent.
- **G-5 / Phase 187 — `WorkflowBuilderPage.tsx` (D-187-14) — honoured by construction, and the cap is now DERIVED rather than round.** Both new surfaces (`SeedReceipt.tsx`, `StarterTemplatePicker.tsx`) ship as their own component files; the page gains gated mount lines plus a bounded `nameContext` memo. Plan **187-15** Task 3 gates it in two parts: a **structural sub-gate** on the literal D-187-14 wording (4 comment-filtered `git diff -U0` counts — 2 mounts / 0 other elements / 2 new props / 0 new functions) and a **total cap of ≤ 46 ins / ≤ 5 del derived as an 8-row component table** (41 for the base work + 5 for the Open-Q6 announcement-site threading), with the single extra deletion named (Prettier re-wrap) and an instruction to **name the overrunning row rather than move the total.**
- **Named gap carried out of 187 planning (not silent):** `definitionOps.canRemovePhase` (`definitionOps.ts:282`) is the ONE `nodeTitle()` call site left without the name context. Consequence, stated: the `Added` / `Removed` notices resolve the derived face while the `refusal` notice **in the same surface** does not. Recorded as threat `T-187-15-07`, in `187-VALIDATION.md`, and in `187-RESEARCH.md` Q6, with an acceptance criterion that **fails if the deferral is closed silently**. Re-open trigger: Phase 188's `WorkflowCanvas.tsx` extraction, which reopens these seams anyway.
- **✅ SCOPE DECISION RATIFIED BY OPERATOR 2026-07-29 — D-185-17 / Phase 185** (proposed at plan-phase unattended; operator ratified explicitly, together with the environment confirmations Docker up / `WORKER_COUNT=2` / KB has ingested documents). The operator accepted that ratifying **visibly restyles every node on the canvas** (137-D → 137-B: 248px centred card, 62px 3D icon floating above the top edge at `top:-26px`, `pt-[42px]`, `NODE_MIN_HEIGHT` 104) rather than take any of the three lock-amending alternatives. Original proposal follows. — the deferred **137-D → 137-B `PhaseNodeCard` geometry rebuild is pulled into Phase 185 as plan `185-01`, Wave 1**, reversing the 2026-07-29 "its own task, out of scope for 185" note. Forced by a computed fact the research pass found: on the **shipped** card (`ml-6` body offset, icon well `left-0 top-1/2 h-14 w-14`, 260×96) SPEC Req 6's amended verdict position `-left-2 top-1.5` **overlaps the icon well by 14×8 px**, and `-left-2` does not even straddle the card's left border (border at x=24). **No left placement satisfies acceptance criterion 23 on 137-D.** The SPEC's own sentence — *"185 places its marks against 137-B"* — is only true if 137-B exists first. It keeps its "own task" status as a standalone, separately-committed plan file: **deleting `185-01` leaves waves 2–6 buildable, with only criterion 23 failing.** Rejected alternatives: moving the seal to top-left (amends Req 6's CLAIMED corner — a lock); weakening criterion 23 (the operator added it after a computed occupancy audit); an ad-hoc y-offset on 137-D (invents a third geometry nobody approved). **Operator: ratify or drop `185-01` before executing Wave 1.**
- **G-5 / Phase 185 (2026-07-29, plan-phase) — honoured by construction, no override needed:** `PhaseFormPanel.tsx` (1078 L) is the real hot file; 185 adds a **mount point only** (pinned by acceptance criterion: `git diff --stat` ≤ ~4 lines) and the governance section ships as its own component. Noted for the ledger: `WorkflowCanvas.tsx` (1505 L) is now the largest workflow file and D-185-18's net-new `edgeTypes`/`FlowEdge` work adds to it — **G-5 should be audited against `WorkflowCanvas.tsx` before Phase 188.**
  - **✅ CLOSED at execution 2026-07-30 (plan `185-11` Task 2) — the prediction held and is now MEASURED, not asserted.** `git diff --stat 59c32a06..HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` = **23 insertions / 6 deletions**, of which 16 ins / 6 del are docblock prose, 2 ins are type declarations, 1 ins is the import, and **4 insertions reach the render body** (one destructure + the 3-line `{rails && <GovernanceSection … />}` mount). `GovernanceSection.tsx` shipped as the own-component half. Both files now carry ledger rows in `CLAUDE.md`, together with the `WorkflowCanvas.tsx` row the note above asked for — it measures **1574 L across 9 plans in 183 / 184 / 185, and it FIRES**: extraction due in Phase 188, seam named by `185-10` (`PlaneEditingLayer` + the exported `EDIT_AFFORDANCE`; mind the live ESM cycle — `WorkflowCanvas` imports `FlowEdge`'s value at module scope).
- **G-5 / Phase 167 (2026-07-21, plan-phase):** `backend/app/api/threads.py` (ledger: "G-5 fires — extraction due") is touched by plan 167-04 with a single additive line — the VIS-02 per-user model-default overlay guard at the send-path model-resolution call site. Accepted at plan verification: the plan-checker traced every smaller-footprint alternative (baking the overlay into `load_user_settings` leaks the chat user's personal default into 7 unrelated harness/workflow/publish call sites — a real regression; extending `resolve_run_model`'s signature or making `load_user_settings` async still needs a threads.py call-site edit) and confirmed the one-line guard is the minimal correct placement. Guard only — no new endpoint, no file growth beyond the guard, no per-provider fork, Deep byte-identical when unset (D-14). Mirrors the operator-approved 147/149 override shape. The threads.py extraction refactor remains due.
- **G-5 / Phase 163 (2026-07-18, roadmap-approval — v3.4 crux):** `backend/app/api/threads.py` is the most-fired G-5 hot file (ledger: "G-5 fires — extraction due") and Phase 163 (the atomic RLS + user-JWT-client crux) threads `org_id` through its ~1850-LOC `send_message`. G-5's letter wants a *dedicated* refactor phase before the feature; the roadmap instead sequences the extraction as **Wave 0 of 163** (operator-approved at roadmap sign-off) to keep the 160–168 numbering, with a HARD gate: **no `org_id` touches `send_message` until the extraction lands + proves Deep byte-identical.** The split-vs-bundle call (promote to a standalone phase 163.x if the extraction proves large) is **deliberately deferred to `/gsd:plan-phase 163`**, where the extraction's true size is measurable — the more rigorous point to decide it than blind at roadmap time. Safety property holds either way. Recommendation on record was the dedicated phase; operator chose bundle-now / decide-at-plan-time. Mirrors the 147/149 override shape; the extraction refactor is finally being done (not deferred again), just co-located with the crux.
- **G-5 / Phase 149 (2026-07-12, plan-phase):** `backend/app/api/threads.py` (ledger: "G-5 fires — extraction due") is touched by plan 149-06 Task 3 with a minimal in-place fallback-notice guard at the single shared model-resolution point for the locked D-149-10 enabled-enforcement decision. Accepted at plan verification (operator-confirmed): guard only, no new endpoint, no file growth beyond the guard, no per-provider fork, shared SSE emitter untouched — all new operator endpoints live in `admin.py`. Mirrors the Phase-147 override shape. The threads.py extraction refactor remains due.
- **G-5 / Phase 147 (2026-07-11, plan-phase):** `backend/app/api/threads.py` (ledger: "G-5 fires — extraction due") is touched by plan 147-04 Task 2 with a minimal in-place workflow-kickoff guard for the D-05 workflows kill-switch. Accepted at plan verification: conditional guard only, no new endpoint, no file growth beyond the guard — all new operator endpoints live in `admin.py`. The threads.py extraction refactor remains due.

**Phase 162.5 — threads.py Producer Extraction (G-5 refactor) — COMPLETE (2026-07-19).** 4/4 plans, sequential on main tree (file-ownership on `threads.py` forced serialization: leaves → kickoff → producer-heart → `[BLOCKING]` gate). The overdue G-5 extraction is PAID DOWN: `threads.py` **2,444 → 1,214 LOC** across 4 cohesive service modules (`thread_title.py` / `run_model_resolution.py` / `workflow_kickoff.py` / `run_producer.py`), with `agent_runner` + `spawn_continuation_run` UNIFIED onto ONE shared `_finalize_producer_run` (8 finalize-ordering invariants preserved) and **`agent_loop.py::run_agent_loop` byte-unchanged** (Deep red line held, D-A7); zero org_id/RLS content. **Plan 04 = the `[BLOCKING]` D-A6 gate: OPERATOR-APPROVED 2026-07-19.** The definitive **old-vs-new differential** (phase-start `263d0b73` vs HEAD, same targeted producer/finalize/continue/provider set) = **19 failed / 55 passed IDENTICAL both sides — zero net-new** (the 19 = documented pre-existing `insert_run`/source-drift rot). Live SC#10 4-axis all PASS: cross-provider **full native-7** completed (OpenAI/Anthropic/Google + DeepSeek/Moonshot/MiniMax/Zhipu; OpenRouter external-404 = not-our-code + bonus failure-path proof) · multi-tool (`search_documents`→cited [1]-[5]→`execute_code`=4) · parallel-thread (no cross-leak) · long-message (10,479 input tok) · Continue covered (`test_continue.py` 8/8 + live Resume). Scoreboard: `162.5-VALIDATION.md`. **Enables TEN-02** — Phase 163 threads `org_id` through the clean `run_producer(...)` seam. **Next: `/gsd:plan-phase 163` (THE ATOMIC CRUX — UNBLOCKED, D-A1 satisfied; mig slots 107 RLS + 108 TEN-04).**

**Phase 156 — Everyday UX Polish (STRETCH) (POLISH-01) — COMPLETE (2026-07-16).** 4/4 plans (Wave 0 shared `threadGroups` engine → Wave 1 permanent 58px icon rail + dedicated `ChatHistoryColumn` → Wave 2 hand-rolled ⌘K palette [no `cmdk`] → Wave 3 mobile drawer search + optional Date⇄Folder toggle) + an operator-requested **collapsible-layout refinement** (`8486e0c3`: pinned `☰` rail-expand 58⇄210 [NOT hover-driven] + fold-away history + `▷` reopen, both persisted). VERIFICATION `verified` (10/10 code truths + all 5 felt-experience items live). **verify-work 9/9 PASS** (`156-UAT.md` — operator batch-confirm of the live Chrome-DevTools UAT: 399 threads / 7 folders, both themes, zero h-overflow 390→3440px). **secure-phase `threats_open: 0` — 6/6 CLOSED** (`156-SECURITY.md`: 4 `mitigate` verified in code [T-156-01 XSS `dangerouslySetInnerHTML`=0 / T-156-03 Radix focus-trap / T-156-05 operator-shield outside `NAV_ITEMS` / T-156-SC no-`cmdk`] + 2 `accept` [T-156-02/04 client-not-a-trust-boundary]; short-circuit — register@plan-time, grep+lock-test verified; frontend-only, 11 files, no backend/py/auth). **POLISH-01 → complete; BUG-260711-01 `folded → closed`** (`verified_closed_by: 156` — the thin rail verifiably stops starving the history column at 399-thread scale). Frontend-only — NO backend/migration/cloud-parity. **Next: STRETCH 157 (Deployment Presets & Runbook, DEPLOY-01) / 158 (First-Run Install Wizard, DEPLOY-02) — gated behind CORE + budget; `/gsd:discuss-phase 157` when resumed.**

**Phase 153 — Inline Citations (CITE-01) — COMPLETE (2026-07-15).** 5/5 plans, all TDD, sequential on main tree. VERIFICATION `passed`; HUMAN-UAT 7/7 (0 issues) operator-accepted on the **Anthropic `claude-sonnet-5` SC#10 proof** (152 precedent — the native provider the research flagged for the mid-list-system-drop trap; dual-channel `active_system_prompt`+`messages[0]` injection survived, markers rendered). DB set-membership corroborated live (thread `c7a3eed5`: markers `[1..9]` = 9 `source_refs`, **0 out-of-range**). SECURE-PHASE **`threats_open: 0` — 27/27 CLOSED** (`153-SECURITY.md`, `539b1f0d`): 23 `mitigate` verified in code + 4 `accept` justified; `threads.py` + `StreamsProvider.tsx` confirmed absent from the phase diff (D-08/D-14/G-5 RED LINES held); 0 new deps. **RED LINES held; no migration, no new package.** **Seeds planted 2026-07-15:** SEED-118 (weak-model tool-loop harness — dedup guard + early force-answer + per-model budget) · SEED-119 (citation footer = retrieval superset of inline markers → make cited-vs-retrieved legible). **Advisory (non-blocking, in `153-SECURITY.md`):** MD-01 Open-doc dead-end (fail-safe UX), LW-02 `_strip_citation_note` literal-sentinel spoof (RLS-scoped self-inflicted). **Cross-provider breadth (OpenAI/Google/OpenRouter) + full-doc-peek/parallel-thread/long-message axes recommended for a future live spot-check (all unit-covered).** **Next: Phase 154 (Plain-Language Layer, LANG-01) — G-2 sketch not required (label layer); `/gsd:discuss-phase 154`.**

**Phase 123 — Skill Triggering Quality (TRIG-01 / TRIG-03 / CTX-03) — COMPLETE (2026-06-26).** All 3 gates clear: secure-phase 29/29 threats CLOSED (threats_open 0, `fc17016b`) · validate-phase NYQUIST-COMPLIANT 12/12 Per-Task COVERED (148 backend + 40 frontend = 188 tests green, `06ae19dc`) · verify 12/12 must-haves + **SC#10 4-axis live UAT 4/4 PASS** (2026-06-26): Axis 1 cross-provider D-01 fidelity · Axis 2 multi-tool pin durability (surfaced+fixed render bugs BUG-260626-01/-04 — shared `dedupMessagesByRunId` helper, `2a48fea4`/`6ec8be77`, verified live) · Axis 3 parallel-thread isolation (3-run Redis snapshot, no pin leak) · Axis 4 long-message pin + honest `_TRIM_MARKER` eviction (forced real 8000-tok overflow). `123-VERIFICATION.md` flipped `human_needed` → `passed`; `123-HUMAN-UAT.md` status passed (4/4). **Deferred (NOT 123 blockers):** BUG-260626-02 (Phase-120 baseline leak into live final-emit) + BUG-260626-03 (run-end todo finalizer) → **SEED-094** (backend run-end honesty). Follow-up candidate: LangSmith not emitting since 2026-06-20 (raw-SDK `wrap_openai` path). **Next: Phase 124 (Workflow Studio UX) — G-2 sketch-gated; run `/gsd:sketch 124`.**

**Phase 098 — Project Binding & Server-Side KB Scope Governance — COMPLETE (2026-06-10).** 5/5 plans. VERIFICATION verified (4/4 observable truths + 14 artifacts). HUMAN-UAT complete 6/6 (SC#10 cross-provider × multi-tool × parallel-thread × long-message + `scope_violation` observability + D-13 whitelist refusal). SECURE-PHASE `threats_open: 0` — 13 planned threats closed; WR-03 (fail-open scope → observable emit + kickoff fail-closed) + IN-01 (cycle guard) fixed in code, IN-02/IN-03 accepted (`098-SECURITY.md`). **Still OPEN (run-honesty UI polish, NOT security/scope):** BUG-260609-02 (SUB-RESULTS "Sub-task" loses desc on nav), BUG-260609-04 (phase card placeholder slug "phase-0"), 1-2s empty-bubble. **Next: `/gsd:plan-phase 099` (Workflow ↔ Skill Composition).**

---

_Historical — Phase 097 spike per-plan execution detail:_

**Plan 097-01 progress (Wave 0) — COMPLETE:**

- ✓ Task 1 (commit `75be6f92`): scaffolded `scripts/spike-097/`; installed `docxtpl==0.20.2` into the backend venv (venv-only, NOT Dockerfile.sandbox/requirements — Phase 101 does the prod add); generated `templates/risk-register.docx` with `{%tr %}` variable rows. Verified: `get_undeclared_template_variables() == {project_name, report_date, rows}`; throwaway 1/3-row render grows the table + re-opens clean.
- ✓ Task 2 (commit `5b6a87f3`): `find_risk_folder.py` mirrors `get_supabase()` (service-role, every query filtered by user_id — T-097-01) + `kb.py:186` BFS subtree; wrote `out/kb-folders.json`. Resolved test-user `user_id = d8a54002-6a29-4b88-b918-cff2aa4a06d5`.
- ✓ Task 3 (commit `61025148`, human-action resolved): existing KB had NO risk-name-matching folder, so a controlled synthetic corpus was generated (`make_sample_corpus.py` → 3 "Project Meridian" risk `.docx` in `sample-corpus/`) and the operator ingested it into a fresh folder. `find_risk_folder.py` re-ran; `out/spike-config.json` pins the confirmed `folder_id = 75755ec9-5ba7-495b-ad93-7500011cf6f2` ("Project Meridian — Risks", 3 docs / 9 embedded chunks), its `subtree_folder_ids` (bound retrieval scope), `user_id`, and `template_path`. Verify printed `confirmed folder 75755ec9…`. Citation-granularity note carried to Plan 03: one table-heavy doc chunked coarsely (1 chunk).

**Plan 097-02 progress (Wave 1, unknown a) — COMPLETE:**

- ✓ Task 1 (commit `f2cc7b3a`): `field_map.py` — cited `RiskRegisterFieldMap`/`RiskRow`/`Cited` Pydantic models (every leaf nullable + `source_chunk_id` provenance), spotlighted forced-tool prompt (`<doc id=... file=...>` — T-097-04), native Anthropic call wrapper that **mirrors but never imports** the production service (red line / G-5). A1 OpenAI-strict pivot documented, not used.
- ✓ Task 2 (commit `fc791f5f`): `derive_fields.py` — parse template (coverage oracle) → retrieve under **bound** `folder_ids` from `spike-config.json` (not a prompt hint — Pattern 2 / PROJ-02 / T-097-06) → single forced Anthropic emission → deterministic coverage+citation check → re-prompt-once. Evidence: `out/field-map.json` (6 KB-grounded rows M-01/02/03 + SR-01/02/03; 50/50 filled values cited = **100% citation coverage**; **11% null-rate** = declines not inventions; 0 invented citations; model did NOT fabricate the 4 unseen workshop-table risks) + `out/unknown-a.md` (verdict **YES**).
- **Deviation [Rule 1]:** first run truncated the tool JSON at 4096 output tokens (`stop_reason=max_tokens` → 0 rows via `default_factory=list`); raised `emit_field_map` max_tokens → 16384 + added a hard truncation guard. Re-run finished clean (`stop_reason=tool_use`, 4063 tokens).
- **Carry-forward to Plan 03/101:** retrieval's enriched chunk dict exposes no raw `document_chunks.id`, so the harness assigns `chunk-N` spotlight ids as the citation source of truth — the production citations design must thread a stable chunk id end-to-end. `Cited` provenance confirmed to belong in run OUTPUT (shape-only in `inputs`).

**Plan 097-04 progress (Wave 1, unknowns c+d) — COMPLETE:**

- ✓ Task 1 (commit `528e1d53`): `authoring_feel.py` — grounded one-shot WorkflowDefinition generation + refine loop. Assembled design-time grounding (folder tree + tool-registry names + skill names + template placeholders), one forced-tool Anthropic emission over the strict `WorkflowDefinition` schema (`extra="forbid"` + `model_validate()`), one refine turn, transcript capture. Mirrors-not-imports the production service (red line / G-5). Evidence: `out/transcript.md` (describe → refine → 2 schema-valid drafts) + `out/unknown-c.md`.
- ✓ Task 2 (human-verify checkpoint resolved, committed with plan-close): operator recorded the feel verdict in `out/unknown-d.md`. Verify passed: `unknown-d verdict OK` (>200 bytes + rating present; 8888 bytes).
- **Unknown (c) answer:** the draft USED folder tree + tool names + template placeholders (MUST-HAVE grounding for the Phase 103 generator prompt); skill registry provided but UNUSED this run (nice-to-have). `folder_scope` had no schema home → scope leaked as a resolved folder id inside an llm_agent prompt string → **PROJ-02**: add additive bound `folder_scope` (per-phase) + `project_folder_id` (per-definition); generator must RESOLVE spoken folder names/paths → ids.
- **Unknown (d) answer = MIXED.** Good: one sentence → correctly-typed 4-phase pipeline; refine absorbed as intent (no hand-edited JSON); human-confirm inferred from "pause for me to confirm." MIXED because the generator SILENTLY GUESSED on grey areas (substituted non-existent "Acme" folder → "Project Meridian — Risks" without asking; mapped spoken "/Risks subfolder" onto the whole folder — no such subfolder exists). Operator's two conditions for GOOD: (1) a clarify-as-you-go **grey-area validation loop** (surface every ambiguity — unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill — for user validation; NO silent substitution); (2) **post-build editability** — tweak → new version (immutability per-version, not per-workflow; `WorkflowDefinition.version` + "no-edit-published" already support republishing).
- **Carry-forward:** Phase 103 (WFAUTH-02) acceptance bars = grey-area validation loop + tweak-to-new-version path (G-2 sketch-gated). Phase 098 (PROJ-02) = bound `folder_scope`/`project_folder_id` + path→id resolution.

**Plan 097-03 progress (Wave 2, unknown b) — COMPLETE:**

- ✓ Task 1 (commit `19f8bdcc`): `render_docx.py` — `build_context` (deterministic `score = int(P)×int(I)` when numeric, else None — NOT an LLM field) + `render` (docxtpl `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` — SSTI containment T-097-08 + XML-safe `&<>` T-097-09) + `assert_integrity` (python-docx re-open T-097-10 + residual-tag scan T-097-11) + `log_pitfall` writer. Render runs LOCAL in the venv (prod render = sealed Docker sandbox, Phase 101). The LLM produces DATA; docxtpl owns the OOXML bytes.
- ✓ Task 2 (commit `b109df5b`): `run_spike.py` — the 6-step end-to-end run (parse → bound-scope retrieve → forced-tool field-map → coverage/cite check → render → integrity) produced `out/risk-register-filled.docx` (real KB → real cited field-map → real openable file, the SC#1 artifact; 5 chunks retrieved, 6 cited rows, 100% coverage, 1 table / 7 rows). Synthetic 1/5/20-row growth → 2/6/21 rows (Pitfall 5, the load-bearing surprise — PASS). `&<>` probe (`Acme & <Corp> risk`) survived as literal text (Pitfall 2 — autoescape contained it). `out/corruption.log` = one row per Pitfall 1–6 (all clean) + Pitfall 7 observe-only (single-version corpus) + pptx/xlsx not-exercised seed rows. `out/unknown-b.md` = verdict **YES / GO**.
- ✓ Task 3 (human-verify checkpoint, **operator-approved 2026-06-09**): operator opened `out/risk-register-filled.docx` in a real editor (Word/LibreOffice) — **NO "needs repair" banner**, risk table grew to **6 risk rows** (one per risk, not a single template row), scalar tags (`project_name`/`report_date`) filled. Blank Score column on the real doc accepted as **expected** (KB states P/I as words High/Med/Low → don't parse to ints for the P×I compute — not a defect). Upgrades Pitfall 3 from "parses via python-docx" to "renders clean in a real editor" — the strongest evidence for unknown (b). Confirmation appended to `corruption.log` + `unknown-b.md`.
- **Unknown (b) answer = YES / GO.** docxtpl is the recommended fill path for trusted project-library templates (the Phase 101 production target). No deviations.
- **Phase 101 carry-forwards:** (i) **worded likelihood/impact → numeric Score mapping** (real KB speaks High/Med/Low → real-doc Score blank by design; prod TMPL-02 needs a deterministic categorical→ordinal map); (ii) **coarse table chunking** (Plan 01) reduced workshop-table risk retrieval — register-style tables need finer chunking so every tabulated risk is independently citable; (iii) **pptx/xlsx variable-row growth still unexercised** (docx-first; python-pptx can't grow tables / openpyxl chart-preservation untested — deferred, logged as Phase 101 UAT rows).

**Plan 097-05 progress (Wave 3, go/no-go conclusion) — COMPLETE:**

- ✓ Task 1 (commit `f5f174bc`): drafted `scripts/spike-097/CONCLUSION.md` — the spike deliverable (SC#3): 4-unknown roll-up (a=YES / b=GO / c=grounding inventory / d=MIXED, each claim citing its `out/` artifact) + recommended `DECISION: GO` + recommended additive-optional `inputs`/`assets`/`folder_scope` schema shape (three open questions settled: `template_derived`→`source` enum value; `Cited` provenance→run OUTPUT only; `folder_scope`→BOUND resolved-id list) + the Phase 101 UAT seed (6 named pitfalls + pptx/xlsx deferrals). No `harness.py` edit, no migration, no `backend/` change.
- ✓ Task 2 (checkpoint:decision resolved 2026-06-09 — operator-confirmed `go-conditional`; finalized this session): updated CONCLUSION.md to **operator-confirmed DECISION: GO** conditional on **Conditions 1–8**. Conditions 1–6 kept; **Condition 7 replaced** with the FULL-native-roster cross-provider version (validate the field-map structured-output across all 7 natives + OpenRouter — NOT the SC#10 representative-4; explicit GLM/MiniMax tool-use-drop + DeepSeek/Moonshot reasoning-truncation traps; provider handling at the service boundary, shared fill path never branches); **Condition 8 added** = living-document feedback loop (optional OUTPUT re-ingestion). Extended the §3 schema recommendation with an **OUTPUT-side dimension** (`output_target_folder` / `reingest_output` / `version_policy` / `provenance`) as the Phase 098 lock candidate (RECOMMENDATION only, zero-migration — leverages the already-shipped `documents.py:402-423`/`:425-449`/`:656` dedup/versioning/reingest infra). Added an "Open design item — living-document feedback loop (SEED-069)" section. `097-05-SUMMARY.md` written (Self-Check: PASS).
- **SEED-069 planted** (`.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md`): workflows that produce evolving artifacts need optional OUTPUT re-ingestion so the next run grounds on the latest version. CRITICAL — the dedup/versioning/reingest infra ALREADY EXISTS; net-new is only thin wiring + a `derived/source` provenance flag (self-feedback amplification guard) + a scoped exception to the CLAUDE.md manual-upload-only rule. Linked to SEED-005 (DM versioning, next milestone) + GOV-02 (provenance receipt, STRETCH 107).

**Phase 097→098 housekeeping (historical — Phase 098 now COMPLETE):** Discuss-phase complete 2026-06-09: `.planning/phases/098-project-binding-server-side-kb-scope-governance/098-CONTEXT.md` committed (`9aae09cb`). 3 gray areas resolved (all operator-accepted): **(1)** output-side schema shapes (`output_target_folder`/`reingest_output`/`version_policy`/`provenance`) **locked-now, behavior-deferred** [D-08]; **(2)** scope-violation = **clip + observable run-log warning** (`scope_violation` event on the existing run-event/`run:{run_id}` channel) + per-phase `folder_scope` **narrow-only enforced at definition-save validate** [D-06/D-07], with the ⊆ assert **GATED no-op when scope is None** to keep Deep byte-identical on the shared `search_documents` path [D-05a]; **(3)** **representative-4** cross-provider in 098, **full native-7 reserved for Phase 101** [D-09]. A 3-agent adversarial verify pass confirmed code seams + source fidelity (0 high) and drove 4 medium precision fixes. **Housekeeping still open:** Phase 097 was never formally run through `/gsd:verify-work 097` + complete — the 098 dependency (097 schema shape) is satisfied by the operator-confirmed CONCLUSION.md, but the 097 verify/complete step remains outstanding. Phase 103 (Workflows page) stays **sketch-gated (G-2)**.

## Deferred Items

Items acknowledged and deferred at the **v3.2 milestone close on 2026-07-10** (47 total from the pre-close `audit-open` sweep). Triaged: none are v3.2 CORE blockers — the CORE Skill Eval Studio (132-137 + inserts 137.1/137.2) shipped complete; the open items are intentional forward seeds, stale pre-GSD tracker cruft, and live-UAT / verification status-lag on delivered STRETCH phases.

| Category | Count | Disposition |
|----------|-------|-------------|
| Unimplemented seeds | 9 | Deferred-by-design with re-open triggers (incl. SEED-108 RAG↔file bridge, SEED-109 eval/tuner run-lifecycle migration, SEED-110 workflow run-time template upload, SEED-112 per-workflow KB folder-scope). Future-milestone candidates — the SEED-110/112 workflow-file cluster surfaces at the v3.3 sweep. |
| UAT gaps | 10 | Live-UAT status-lag on delivered phases: 140 (embed 429), 141 (cross-provider render smoke), 142 (held-partial), 143 (non-operator A1 + empty-folder — core proven live 2026-07-10). Code shipped; verification debt only. |
| Verification gaps | 5 | `human_needed` bookkeeping never flipped to `passed` after the live UAT actually ran. No real pending work. |
| Quick tasks | 22 | Orphaned `[missing]` tracker slugs (Mar–Jun 2026) — already-fixed bugs from v2.5–v3.1. Tracking cruft, not v3.2 work. |
| Pending todos | 1 | Legacy spike todo — satisfied by shipped work. |

**FILE-01 (Phase 144, Agent-Driven Skill File Attachment)** — the one undelivered requirement; **deferred → v3.3** (gated STRETCH, not executed). Rolls forward with the workflow-file cluster (SEED-110 template upload, SEED-112 folder-scope).

**Open `surface: Agentic-RAG` reports (roll forward into the v3.3 UAT blast radius):** BUG-260609-02/-04, BUG-260610-01, BUG-260623-01, BUG-260706-01, BUG-260707-03, BUG-260708-01/-02, BUG-260710-01/-02 (nav/display + provider-polish), plus the deferred agent-loop / todo-loop notes. Cross-check at `/gsd:discuss-phase` per the reported-bugs mandate.

## Roadmap shape (v3.6, created 2026-07-24)

Numbering continues from v3.5's last CORE phase (177) but **SKIPS the reserved 178-180** (the deferred v3.5 STRETCH carry-forwards — Chat UI/UX Polish, Plain-Language Extensions, Agent-Loop Honesty; fold back per their own `re_open_trigger`s in `.planning/v3.5-STRETCH-CARRYFORWARD.md`, NOT reused here — exactly as v3.5 skipped the reserved 169-173) → **CORE Phases 181-189**, then **STRETCH Phases 190-191** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 / v3.5 178-180 precedent). Scope source: `.planning/REQUIREMENTS.md` (20 CORE + 3 STRETCH = 23 reqs). Research base: `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS — HIGH confidence, 4 researchers converged on one dependency-ordered build sequence) **+ the deep competitor crawl `.planning/research/deep-dive/`**. **Revised 2026-07-24:** the deep crawl (Beam / Glean / n8n) confirmed **NONE grade governance by KB-grounding** — the operator's *strict-when-grounded / flexible-when-open* rule is category white-space → a first-class **GOVERN** category (per-node grounding-strictness + action-risk dials) was added as a DEDICATED CORE phase (**185**, the milestone's headline differentiator), and the tail renumbered (was 181-188 CORE / 189-190 STRETCH). **Stack:** one net-new dep — `@xyflow/react` v12 (^12.11.2, MIT, React-19-compatible, zustand-internal); `zundo` for undo/redo (Phase 184). **Migrations:** live head = 113; **next free slot = 114 reserved ONLY IF** the nullable `workflow_layouts` side table (CANVAS-02 / OPEN-05) is confirmed needed at Phase-184 sketch — otherwise deterministic auto-layout = ZERO migrations. Graded governance (185) is ZERO-migration (additive optional `grounding_mode` field in the definition JSONB, not a column). Phase 190 (connectors, STRETCH) likely needs an org-scoped connector-credentials table (sized at discuss/sketch; reuses `SECRETS_ENCRYPTION_KEY`, no new key).

### CORE (committed) — Phases 181-189:

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 181 | Revert Foundation | REVERT-01, REVERT-02 | 4 | **HARD gate #1** (preserve-v1/revert); **red line D-14** (flag-off byte-identical, no new runtime); reuse-heavy (v3.3 `skill_studio` feature-flag pattern); `test_revert_byte_identical` CI + live-close gate; additive-nullable-only; **no threat model**; no migration; UI hint |
| 182 | Server Validation Seam | VALID-01 | 4 | backend-only reuse (`reachability.lint_workflow` + grounding-fidelity verbatim — the anti-drift seam, Pitfall 1); flag-gated 404 (inherits 181); **red line D-14**; **no SC#10**; no threat model; no migration; no `@xyflow` yet |
| 183 | Read-Only Canvas | CANVAS-01 | 4 | **G-2 sketch**; **stack: `@xyflow/react` v12 introduced here**; **G-5 ledger** (`WorkflowCanvas.tsx`/`canvasModel.ts`/`PhaseNode.tsx` mirror `PhaseSpineGraph.tsx` glyph/parse — proactive shared-glyph extraction, 1st touch); pure projection (Pitfall 3); **red line D-14**; no SC#10; no threat model; no migration; UI hint |
| 184 | Editable Canvas + Live Structural Validation | CANVAS-02, CANVAS-03, CANVAS-04, VALID-02, VALID-03 | 5 | **CORE deliverable** (VALID-02 = author-time STRUCTURAL validation only — reachability/whitelist/gate-wiring; grounding *strictness* layered by 185); **G-2 sketch**; **stack: `zundo`**; one-serializer round-trip → EXISTING draft CRUD, layout OUT of JSONB (Pitfall 3); server-authoritative per-node badges (VALID-03); CANVAS-04 rails **graded per GOVERN (185)**; **G-5 ledger** (`WorkflowBuilderPage.tsx` = 3rd door; `PhaseNode.tsx` 2nd touch); **migration SKETCH-CONDITIONAL** (slot 114 ONLY IF `workflow_layouts` confirmed, else ZERO); **red line D-14**; no SC#10; no threat model unless discuss surfaces one; UI hint |
| 185 | **Graded Governance: Per-Node Grounding Mode + Action-Risk Dial** | GOVERN-01, GOVERN-02, GOVERN-03 | 5 | **HEADLINE differentiator** (no competitor grades by KB-grounding — the deep-crawl white-space); ENGINE-ADDITIVE (optional per-node `grounding_mode` field AUTO-ATTACHES the EXISTING immutable `citations_required` + confidence gate on grounded nodes; open nodes ungated; strict gate NOT author-loosenable-away); GOVERN-03 reuses the existing `llm_human_input` phase-type for the action-risk/approval checkpoint; **Deep byte-identical when unset — D-14 load-bearing**; **G-2 sketch** (grounded-strict vs open-flexible badges + mode toggle "feels like"); **SC#10** (grounded citation/confidence enforcement rides the provider-sensitive retrieval/agent path — verify graded strictness holds cross-provider); **G-5 ledger** (`PhaseNode.tsx` ~3rd touch → refactor-before-3rd-touch PROACTIVELY + the validation seam); **no full threat model** (reuses the enforced gate library; the structural "not author-loosenable-away" property verified in-phase; connector threat model lands at 190); **NO migration** (additive optional field in the WorkflowDefinition JSONB, not a column); UI hint |
| 186 | Concurrency & Autosave | CONCUR-01, CONCUR-02 | 4 | autosave-in-place (never mint a version / re-arm the gauntlet — CONCUR-01); soft-lock / optimistic-token co-edit guard (mirrors `publish_definition` WR-03); **parallel-editor UAT row (SC#10 parallel axis)** — two-editor org-shared clobber; mechanism (block vs warn vs merge) = sketch/discuss call; **red line D-14**; **no full SC#10**; no threat model (v3.4 org RLS enforces the share boundary); no migration; UI hint |
| 187 | Business Vocabulary + AI-Seeded Canvas | VOCAB-01, VOCAB-02, VOCAB-03 | 5 | **G-2 sketch** (node vocabulary "feels like"); **SC#10** (VOCAB-02 AI-seed rides the provider-routed `POST /generate` NL generator); extends v3.3 LANG-01 + SEED-085 + Technical-names reveal; AI-seed structurally-safe (schema IS `extra="forbid"` union — Pitfall 7) **+ respects grounding mode (185) — a seeded grounded node auto-gets its citation/confidence gate (safe-by-construction)**; reuses Starter Workflow Library; acceptance bar = PM pack + Starter Library + 4 canonical seed shapes; **G-5 ledger** (`PhaseNode.tsx` + NL-seed into `WorkflowBuilderPage.tsx`); **red line D-14**; no threat model; no migration; UI hint |
| 188 | Non-Technical Run Observability | RUNVIZ-01, RUNVIZ-02 | 5 | **G-2 sketch** (live run "feels like"); **SC#10** (live run state, all providers); one run stream / two views — `CanvasRunView` reads the SAME `usePhases(threadId)` slice `PhaseTimeline` uses (no new Redis events, no new demux); **shows grounded-cited vs open per node (185)**; node state = total function over the FULL event set (Pitfall 4); reconcile-on-fetch (D-v2.5-03); **G-5 ledger** (`PhaseTimeline.tsx`/`PhaseCard.tsx`/`StreamsProvider.tsx` — hottest cluster; proactive shared phase-state extraction); `elkjs` deferred (→ 191); **red line D-14**; no threat model; no migration; UI hint |
| 189 | Governed External-Action Node Model | CONN-01 | 4 | **HARD gate #3 (CORE half)** — governed node vocabulary + recorded own-vs-Open-Platform decision (MCP-first, first-party-thin, Open-Platform-sequenced SEED-013/014); **NO live egress** (→ 190, STRETCH); MCP-backed node rides the EXISTING per-phase tool whitelist + reuses the 185 action-risk (GOVERN-03) checkpoint (zero new governance concept); **red line D-14**; no SC#10; **no threat model** (no egress yet — lands WITH 190); no migration; UI hint |

### STRETCH (gated behind CORE) — Phases 190-191:

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 190 | Live Connector Slice + Connector Security | CONN-02, CONN-03 | 5 | 189 — **HARD gate #3 (live-proof half)**; **threat model / mandatory `/gsd:secure-phase` (`threats_open: 0`)**: unconditional SSRF / egress allow-list regardless of credential state (n8n CVE class), the sibling "authenticated ≠ safe" RCE class → sandbox all expression/template eval + NO arbitrary-code node, org-scoped Fernet `enc:v1:` credentials by reference (never in JSONB/client), dedicated cross-org leak test (SEED-124/125 precedent); **SC#10** (live connector slice); 2-3 first-party (email/JIRA/Slack) — broad catalog/webhooks/API stay with Open Platform (SEED-013); **migration likely** (org-scoped connector-credentials table; reuses `SECRETS_ENCRYPTION_KEY`); MCP spec-version pin; **red line D-14** |
| 191 | Conditional Canvas Scale Hardening | SCALE-01 | 4 | 184 + 188 — **conditional: ship ONLY if a real workflow / org fan-out exceeds small scale** (workflows typically 5-50 phases); React Flow `onlyRenderVisibleElements` + node memoization (>~100-150 nodes); `elkjs` auto-layout only if run-viz must depict `llm_batch_agents` fan-out as branching; indexed org-scoped Workflows-list reads; **red line D-14**; no threat model; migration only if an index needs one |

- **Coverage:** 23/23 requirements mapped (20 CORE + 3 STRETCH); 0 unmapped, 0 duplicates. Every requirement → exactly one phase.
- **Sequencing rationale (research's dependency-ordered sequence + the GOVERN insert — governance-before-features, read-before-write, foundation-before-feels-like, connectors-last):** Revert Foundation FIRST (181 — HARD gate #1, the tested off-switch every later phase inherits). Server Validation Seam (182 — the anti-drift seam before anything calls it). Read-Only Canvas (183 — prove the projection cheaply before writes). Editable Canvas + round-trip + in-canvas live STRUCTURAL validation (184 — the core deliverable). **Graded Governance (185 — NEW, the headline differentiator; sequenced right after the editable canvas so it lands on a working canvas: grounding-strictness + action-risk dials on the shipped validation-gate + `llm_human_input` substrate).** Concurrency & Autosave (186 — close the org-shared co-edit clobber risk). Business Vocabulary + AI-Seeded Canvas (187 — G-2 sketch; the AI-seed respects grounding mode = safe-by-construction). Non-Technical Run-Observability (188 — G-2 sketch; shows grounded-cited vs open per node). Governed External-Action Node Model (189 — CONN-01 CORE, no live egress). STRETCH: live connector slice + security (190, LAST — highest new egress surface), then conditional scale hardening (191).
- **The headline differentiator (deep-crawl white-space):** no competitor (Beam/Glean/n8n) grades strictness by KB-grounding. Graded governance (185) makes a node *strict when grounded* (must cite retrieved knowledge above the confidence threshold) and *flexible when open* (exploratory), freely mixed, structurally enforced, not author-loosenable-away — the concrete "governed ↔ flexible" reconciliation SEED-123 named. Governance is the shape of the artifact, not a bolted-on run-time check.
- **The red line (D-14, load-bearing EVERY phase):** the canvas is a pure PROJECTION of `WorkflowDefinition`, never a second source of truth and never a second runtime; the harness engine stays the ONLY executor; every new route is flag/404-gated at every layer; Deep Mode byte-identical (graded governance is byte-identical when `grounding_mode` is unset); provider differences stay at the boundary. REVERT-02's `test_revert_byte_identical` gate makes flag-off provably byte-identical (Pitfall 2).
- **SC#10 (cross-provider mandate):** 185 (graded strictness — a grounded node's citation/confidence enforcement rides the provider-sensitive retrieval/agent path), 187 (VOCAB-02 AI-seed rides the provider-routed NL generator), 188 (RUNVIZ live run state), 190 (CONN live slice). Pure backend-reuse / flag phases (181, 182) + pure-authoring/projection phases (183, 184) are NOT flagged. **186 (Concurrency)** carries the SC#10 **parallel axis** (two-editor UAT row) but not full cross-provider streaming.
- **G-2 sketch-gated:** 183 (read-only canvas), 184 (editable canvas + node config), 185 (graded-governance state — grounded-strict vs open-flexible badges + mode toggle "feels like"), 187 (node vocabulary), 188 (live run). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. The `sketch-findings-agentic-rag` skill auto-loads on all canvas / phase-spine / run-surface work.
- **G-5 workflow-studio hot-file ledger (the synthesizer's explicit WATCH ITEM — track from phase 1, apply refactor-before-3rd-touch PROACTIVELY):** this milestone puts 6+ phases through the same hot-file class that triggered the 075.x chat-surface G-5 cascade. `PhaseNode.tsx` (183 read-only + 184 editable + **185 graded-governance dials = ~3rd touch → refactor-before-3rd-touch PROACTIVELY**), `PhaseSpineGraph.tsx` (183/184 glyph/parse → extract a shared glyph/parse module before the 3rd consumer), `WorkflowBuilderPage.tsx` (184 = the 3rd authoring door; 187 NL-seed), `PhaseTimeline.tsx`/`PhaseCard.tsx` (188 `CanvasRunView` reuses their phase-state derivation → extract a shared phase-state module), `StreamsProvider.tsx` (188 run stream — keep `<OrgContext>`/canvas OUTSIDE the stream path per the 067.5 Branch-D3 guard). Audit each phase's `files_modified` at discuss-phase; a match on a firing row means discuss produces a refactor recommendation FIRST.
- **Threat models (secure-phase):** 190 (CONN-02/03 — SSRF / "authenticated ≠ safe" RCE / org-scoped credentials / cross-tenant leak; the app's first user-supplied-destination egress surface; SEED-124/125 cross-org-leak-test precedent; `threats_open: 0`). REVERT-02 (181) is a tested-revert gate, not a threat model. **185 (Graded Governance) = no full threat model** (reuses the enforced validation-gate library; the structural "not author-loosenable-away" property is verified in-phase). NO threat model on the other pure-UX CORE canvas phases (183, 184, 186-189) unless a discuss-phase surfaces a real trust boundary. CONN-01 (189) has no live egress → its threat model lands with 190.
- **Migrations:** live head = 113; next free slot = 114 reserved ONLY IF the nullable `workflow_layouts` side table (OPEN-05) is confirmed at the Phase-184 sketch — otherwise deterministic auto-layout = ZERO migrations. Graded governance (185) = ZERO migration (additive optional `grounding_mode` in the definition JSONB). Phase 190 (STRETCH) likely adds an org-scoped connector-credentials table (sized at sketch; reuses `SECRETS_ENCRYPTION_KEY`, no new key). Don't manufacture migrations.
- **Reported-bugs:** the open `surface: Agentic-RAG` chat-surface backlog stays OUT (it is the v3.5 STRETCH 178-180 chat-polish track, SEED-045 — a SEPARATE track). No open report folds into a v3.6 workflow-studio phase at kickoff. Cross-check `.planning/reported-bugs/` at each `/gsd:discuss-phase`; fold only a report whose `affected_areas` genuinely overlaps a canvas/validate/governance/run-viz/connector surface.
- **Cloud parity owed:** migrations 099-113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (pre-existing debt, not new v3.6 work). Any v3.6 migration (184 layouts if taken / 190 connector-credentials) rides the same next-push parity checklist.

Roadmap detail: `.planning/ROADMAP.md` (active v3.6 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md` + `.planning/research/deep-dive/`.

## Roadmap shape (v3.5, created 2026-07-22)

Numbering continues from v3.4's last CORE phase (168) but **SKIPS the reserved 169-173** (the deferred v3.4 STRETCH carry-forwards — Dept-Admin, Entitlements, Permission-Aware Citations, OIDC SSO, Dept-Skills; fold back per their own `re_open_trigger`s in `.planning/v3.4-STRETCH-CARRYFORWARD.md`, NOT reused here) → **CORE Phases 174-177**, then **STRETCH Phases 178-180** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 precedent). Migrations: this is a CLEANUP milestone — prefer app-layer fixes; live head = 113, **next free slot = 114 reserved ONLY if a specific bug fix genuinely needs schema** (none expected — don't manufacture migrations). Scope source: `.planning/REQUIREMENTS.md` (14 CORE + 9 STRETCH = 23 reqs). No research phase (bug-fix / polish over known surfaces).

### CORE (committed) — Phases 174-177:

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 174 | Run-State & Lifecycle Honesty | STATE-01, STATE-02, STATE-03, STATE-04 | 5 | **SC#10**; **G-2 sketch** (honest run-state "feels like"); **G-5** (`MessageItem`/`StreamsProvider`/`useMessages`/`threads.py`); reported-bugs fold (5); UI hint; no threat model; no migration (runs.status authoritative — FND-01/145) |
| 175 | Cross-Provider Streaming Fidelity | XPROV-01, XPROV-02, XPROV-03 | 4 | **SC#10**; **G-5** (gateway/adapter/sanitizer boundary — `openai_compat.py`/`thread_title.py`); **red line D-14**; reported-bugs fold (4); OpenRouter-400s OUT (experimental); no threat model; no migration |
| 176 | Chat Render Correctness + Exec Reliability | RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01 | 5 | **SC#10**; **G-2 sketch** (render visual); **G-5** (`MessageItem`/`useMessages`/`StreamsProvider`; EXEC → `sandbox_service`/`tool_dispatcher`); reported-bugs fold (4 + 2 minor); UI hint; no threat model; migration only if RENDER-04 needs (unlikely) |
| 177 | v3.4 Org-Surface Polish | ORGUX-01, ORGUX-02 | 3 | **G-2 sketch** (org-surface "feels like"); **G-5 light** (`StreamsProvider` — `<OrgContext>` OUTSIDE the stream path, 067.5 Branch-D3 guard); rolls in 166/167/168 live-UAT status-lag; UI hint; **no SC#10** (not streamed state); **no threat model** (polish over already-secured 166-168, not new authz); no migration |

### STRETCH (gated behind CORE) — Phases 178-180:

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 178 | Chat UI/UX Polish Pass (SEED-045 umbrella) | POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05 | 4 | — (SEED-045 anchors shipped in 156); **SC#10** (run-state todos + workspace panel + provider logos touch live state); **G-2 sketch**; **G-5** (`ToolCallPanel`/`MessageItem`/workspace panel/`providerLogo`); SEED-098 = verify/close only; UI hint |
| 179 | Plain-Language / Terminology Extensions | LANG-01 | 2 | — (extends Phase-154; best after 177); label layer (no SC#10, no G-2, no G-5); red line (no enum/API break, Deep byte-identical); UI hint |
| 180 | Agent-Loop Behavior Honesty | LOOP-01, LOOP-02, LOOP-03 | 4 | — (touches the agent loop — most careful STRETCH); **SC#10**; **G-5** (`agent_loop.py`/`anthropic_service.py` — both hot-file rows); **red line D-14**; reported-bugs fold (3 deferred majors + BUG-260626-02/-03); may warrant careful decomposition |

- **Coverage:** 23/23 requirements mapped (14 CORE + 9 STRETCH); 0 unmapped, 0 duplicates. Every requirement → exactly one phase.
- **Sequencing rationale:** Run-state / lifecycle honesty FIRST (174) — it stabilizes the run-lifecycle surface every later chat phase renders on (empty bubbles, stop indicators, timers). Cross-provider streaming fidelity (175) then lands on a clean surface at the adapter/sanitizer boundary. Chat render correctness + exec reliability (176) shares that stabilized render surface. Org-surface polish (177) is independent (polish over the already-secured v3.4 surfaces) — sequenced after 174 only so the shared nav/profile shell is stable. STRETCH gated behind CORE: the chat polish pass (178), then plain-language extensions (179, after org labels exist), then agent-loop behavior honesty (180 — the most careful, touches `agent_loop.py`, last).
- **SC#10 (cross-provider mandate):** 174, 175, 176 (CORE chat surface) + 178 (run-state todos / workspace panel / provider logos touch live state) + 180 (agent loop). ORGUX (177) + LANG (179) deliberately NOT flagged — neither touches streamed state.
- **G-2 sketch-gated:** 174 (honest run-state), 176 (render visual), 177 (org-surface polish), 178 (polish seeds). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. LANG (179) = label layer, no sketch (Phase-154 precedent).
- **G-5 hot files (audit at discuss-phase):** `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` (174, 176, 178), `ToolCallPanel.tsx` + workspace panel (178), `threads.py` (174 run-lifecycle — extraction paid down in 162.5 but the file stays hot), `agent_loop.py` + `anthropic_service.py` (180 — both hot-file ledger rows), the gateway/adapter/sanitizer boundary (175).
- **Reported-bugs mandate:** this milestone IS the parked chat-surface backlog's home — cross-check `.planning/reported-bugs/` (`surface: Agentic-RAG`, status open/deferred) at each `/gsd:discuss-phase` and fold matching reports; some "open" reports may be already-fixed-pending-verification (triage fix-vs-verify). CORE phases 174-176 own most of the backlog; 180 owns the deferred agent-loop majors.
- **Threat models (secure-phase):** NONE this milestone — UI / bug-fix cleanup; ORGUX (177) is polish over the already-secured 166–168 surfaces (`threats_open: 0`), not new authz. Flag one only if a discuss-phase surfaces a real trust boundary.
- **Red line (D-14):** Deep Mode byte-identical; provider differences stay at the gateway/adapter/sanitizer boundary; no new runtime. Load-bearing on 175 (provider params/strip) and 180 (agent-loop behavior).
- **Cloud parity owed:** migrations 099–113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (no new v3.5 migrations expected).

Roadmap detail: `.planning/ROADMAP.md` (active v3.5 section). Requirements + traceability: `.planning/REQUIREMENTS.md`.

## Roadmap shape (v3.4, created 2026-07-18)

Numbering continues from v3.3's last phase (159) → **CORE Phases 160-168**, then **STRETCH Phases 169-173** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 precedent). Migrations continue from live head → **next free slot = 104**. Scope source: `.planning/REQUIREMENTS.md` (22 CORE + 7 STRETCH = 29 reqs). Research: `.planning/research/SUMMARY.md` (re-authored against live schema head 103).

**CORE (committed) — Phases 160-168:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 160 | Tenancy-Model ADR | ADR-01 | 3 | ratify-not-relitigate; no code; no threat model; skip research |
| 161 | Org / Dept / Role Schema | ORG-01, ORG-02 | 4 | **threat model** (isolation cluster; `current_user_org_ids()` breaks 42P17); additive/zero-behavior; skip research |
| 162 | Personal-Org Backfill | MIG-01 | 4 | **threat model** (lock-storm/idempotency/NOT-NULL-order/`is_global` data-loss) |
| 163 | RLS Rewrite + User-JWT Client Swap — **ATOMIC CRUX** | TEN-01, TEN-02, TEN-04 | 5 | **SC#10**; **threat model (security core)**; **G-5/G-1** (`threads.py` extraction = Wave 0); **perf gate** (CONCUR-01 <1s); **research-phase** (live 2-user SET LOCAL/SET ROLE leak test) |
| 164 | SECDEF Audit + Cross-Org Isolation Suite | TEN-03, TEN-05, TEN-06, PRAG-01 | 4 | **SC#10**; **threat model (security core)**; **research-phase** (pgvector+RLS); folds SEED-091; TEN-05 = exit gate |
| 165 | `is_global` Retirement Cleanup | MIG-02 | 3 | threat model (lighter — `is_system_global` migration-only); mechanical; skip research |
| 166 | Org-Admin Shell + Switcher + Profile + Audit + Settings Split | ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05 | 5 | **SC#10** (UI state); **G-2 sketch** (SEED-113); **G-5** (`StreamsProvider.tsx`); threat model (X-Org-Id/audit authz); UI hint |
| 167 | Invitations + Roles + Greenlists + JIT + Per-User Prefs | INV-01, INV-02, VIS-01, VIS-02 | 4 | **SC#10** (VIS-02 = provider routing; greenlist UI state); **threat model** (token/JIT race); G-2 sketch (if visual); UI hint |
| 168 | SSO — SAML 2.0 (CORE) | SSO-01 | 3 | **threat model** (Supabase owns SAML parse; enforcement-before-fallback); UI hint; 0 new deps |

**STRETCH (gated behind CORE) — Phases 169-173:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 169 | Dept-Admin Shell | ADMIN-06 | 2 | 166+167; G-2 sketch; UI hint |
| 170 | Commercial Footholds — Entitlements + Retention/Rate-Limit Data Layer | ENT-01, ENT-02 | 2 | 161+166; UI hint; footholds only (no enforcement/billing) |
| 171 | Permission-Aware Citations | PRAG-02 | 2 | 164+167; **research-gated** (CITE-01 + pgvector+RLS bench); SC#10; G-5 (`retrieval_service.py`+citation renderer); UI hint |
| 172 | OIDC Enterprise SSO | SSO-02 | 2 | 168; threat model (discovery SSRF); Authlib (scope-gated dep); UI hint; customer-triggered |
| 173 | Dept-Targeted Skills + Group Feature-Rollout Gating | VIS-03, VIS-04 | 2 | 165+167; UI hint |

- **Coverage:** 29/29 requirements mapped (22 CORE + 7 STRETCH); 0 unmapped, 0 duplicates. Every requirement → exactly one phase.
- **The atomic crux (LOCKED):** TEN-01 + TEN-02 + TEN-04 in ONE phase (163) — RLS is inert while the service-role / asyncpg-owner connection bypasses it. Never "policies now, client later." `SET LOCAL ROLE authenticated` (not the claims) is what turns RLS on.
- **`threads.py` extraction-first (G-5/G-1):** sequenced as **Wave 0 of Phase 163** before `org_id` threads through `send_message`; MAY be promoted to a dedicated refactor phase at discuss/plan-time (operator's call — if promoted, crux → 163.1 and STRETCH renumbers). Prior 147/149 in-place guard overrides logged below; this milestone pays the extraction down.
- **Data-dependency order (forced):** ADR → schema → backfill → crux → SECDEF+isolation-suite → is_global retirement → org-admin UI → invitations/roles/greenlists → SSO last (SSO has zero downstream dependents = first-to-cut).
- **SC#10 (cross-provider mandate):** 163 (crux — shared retrieval/agent-loop path), 164 (SECDEF/permission-aware retrieval), 166 (org-switcher/`<OrgContext>` UI state), 167 (VIS-02 model-default provider routing) + STRETCH 171. Pure-schema/ADR phases (160/161/162/165) deliberately NOT flagged.
- **Milestone exit gate:** the two-org `test_v3_4_org_isolation.py` suite (built in 164) is re-run AFTER 166/167/168 land, PLUS a final full-regression pass (SC#10 4-axis + CONCUR-01) — not only after the SECDEF phase.
- **G-2 sketch-gated:** 166 (org-admin shell/switcher/profile anchor — SEED-113), 167 (greenlist/roster UI if visual), 169 (dept-admin shell). `/gsd:sketch` before spec/discuss.
- **G-5 hot files:** `threads.py` (163 — extraction-first), `StreamsProvider.tsx` (166 — `<OrgContext>` OUTSIDE it, keep 067.5 Branch-D3 clear guard), `retrieval_service.py`+citation renderer (STRETCH 171).
- **Perf gate:** TEN-04 (163) `document_chunks`/`skill_embeddings` `org_id` denormalize+index must keep CONCUR-01 <1s green — benchmark before merge.
- **Research flags:** 163 crux (live 2-user leak test — do not ship on docs alone), STRETCH 171 (pgvector+RLS latency/recall bench), personal-org/JIT seam 162/167 boundary (trigger vs app-layer vs both). Skip: 160/161/165/166.
- **Threat models (secure-phase):** the isolation cluster 161-164 (security core), 165 (lighter), 166 (X-Org-Id/audit authz), 167 (token/JIT), 168 (SSO), + STRETCH 171/172. ADR 160 = no code.
- **Red line (D-14):** Deep Mode byte-identical; provider differences at the gateway/adapter boundary; no new runtime. KEEP the ~253 `.eq("user_id")` filters this milestone (belt-and-suspenders under the user-JWT client).
- **Reported-bugs:** chat-surface backlog stays OUT (post-v3.3 chat-polish phase); only SEED-091 folds here (TEN-06 → 164). Cross-check at each `/gsd:discuss-phase`.
- **Cloud parity owed:** v3.3 migrations 099-103 + `SECRETS_ENCRYPTION_KEY` still owed at next production push; v3.4 migrations start at slot 104.

Roadmap detail: `.planning/ROADMAP.md` (active v3.4 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md`.

## Roadmap shape (v3.3, created 2026-07-10)

Numbering continues from v3.2's last phase (145) → **CORE Phases 146-155**, then **STRETCH Phases 156-158** (gated behind CORE — ship only if CORE lands clean; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 precedent). **Phase 144 is BURNED** (held the deferred v3.2 FILE-01 phase, never executed, archived to `.planning/milestones/v3.2-phases/`; FILE-01 gets a fresh number — Phase 151). 144/145 are never reused. Scope source: `.planning/REQUIREMENTS.md` (19 reqs — 16 CORE + 3 STRETCH). Research: `.planning/research/SUMMARY.md`.

**CORE (committed) — Phases 146-155:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 146 | Operator Foundation | ADMIN-01 | 4 | **G-2 sketch**; threat model (service-role / no-RLS-backstop, default-deny 404); one-way-door `operator_users` schema; `org_id` stubs; UI hint |
| 147 | Operator Control Plane | ADMIN-02, FLAG-01 | 4 | **SC#10** (active-runs + Kill); **G-2 sketch**; fail-closed kill-switches; UI hint |
| 148 | Governance — Audit, Users & Feature Visibility | ADMIN-03, VIS-01 | 4 | threat model (cross-user reads); **G-2 sketch**; VIS-01 API-enforced; impersonation → STRETCH/named-trigger; UI hint |
| 149 | Model Registry & Discovery | MODEL-01, MODEL-02 | 4 | **SC#10**; **G-2 sketch**; propose-not-auto-enable; read path already live (mig 053); UI hint |
| 150 | Secrets at Rest | SEC-01 | 4 | threat model (secrets); app-layer `cryptography` (NOT pgsodium); env-fallback preserved; round-trip-verified |
| 151 | Agent File Tools | FILE-02, FILE-01 | 4 | **SC#10** (new agent tools); threat model FILE-01 (WRITE) + FILE-02 (RAG→sandbox); order FILE-02→FILE-01 |
| 152 | Workflow Run Inputs | WFIN-01, WFIN-02, WFIN-03 | 3 | **SC#10**; **G-2 sketch** (Run modal); threat model WFIN-01 (upload/SSTI); SEED-112 scope-shape = discuss/sketch; UI hint |
| 153 | Inline Citations | CITE-01 | 4 | **G-2 sketch** (mandatory); **G-5** (`MessageItem.tsx`/`StreamsProvider.tsx`); **SC#10**; Pitfall 14 (set-membership); UI hint |
| 154 | Plain-Language Layer | LANG-01 | 3 | Pitfall 15 (no enum/API/audit break; Deep byte-identical); extends Phase-124 two-door; UI hint |
| 155 | Accessibility Sweep — WCAG AA | A11Y-01 | 3 | LAST (audits all net-new surfaces); new dev deps `@axe-core/playwright` + `eslint-plugin-jsx-a11y`; UI hint |

**STRETCH (gated behind CORE) — Phases 156-158:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 156 | Everyday UX Polish | POLISH-01 | 3 | — (SEED-045 anchors; gated on CORE); UI hint |
| 157 | Deployment Presets & Runbook | DEPLOY-01 | 3 | — (docs/config; gated on CORE) |
| 158 | First-Run Install Wizard | DEPLOY-02 | 3 | 157 (uses presets); biggest lift → first to cut; UI hint |

- **Coverage:** 19/19 requirements mapped (16 CORE + 3 STRETCH); 0 unmapped. Every requirement → exactly one phase.
- **Sequencing rationale:** Operator foundation FIRST (146 — ADMIN-01 keystone; locks the v3.4 one-way-door role schema). Model registry + discovery early (149 — highest ROI, read path live since mig 053); secrets-at-rest (150) as the separable Track-3 security sub-phase. Workflow file cluster with internal order FILE-02 (read) → FILE-01 (write, reference threat pattern) in 151, then WFIN-01+WFIN-02 together on the shared run-input channel + WFIN-03 (safe delete) in 152. UX track last: CITE-01 (153, largest lift, G-5 hot files, G-2 sketch), LANG-01 (154, app-wide relabel), A11Y-01 (155, audits everything last).
- **SC#10 (cross-provider mandate):** 147 (active-runs/Kill), 149 (model-registry UI state → provider routing), 151 (two new agent tools), 152 (run-input channel + folder scope), 153 (inline citations).
- **UI hint:** 146, 147, 148, 149, 152, 153, 154, 155 (CORE) + 156, 158 (STRETCH).
- **G-2 sketch-gated:** 146, 147, 148, 149, 152, 153 (+ 156 if visual). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **Threat models (new WRITE/upload surfaces):** FILE-01 + FILE-02 (151), WFIN-01 (152); plus the standing admin-isolation threat model on 146/148 (service-role, no RLS backstop).
- **G-5 hot files:** `MessageItem.tsx` + `StreamsProvider.tsx` (153 inline citations — do NOT regress the shared render path); `threads.py` stays untouched (new agent tools register in the flat `_TOOL_REGISTRY`).
- **Red line:** never fork the shared path — provider differences at the gateway/adapter/sanitizer boundary (D-14). Deep Mode byte-identical; no new runtime.
- **Reported-bugs:** 10 open `surface: Agentic-RAG` reports roll into the v3.3 UAT blast radius; cross-check at each `/gsd:discuss-phase`. v3.2 verification debt (140/141/142/143) must not regress.

Roadmap detail: `.planning/ROADMAP.md` (active v3.3 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Research base: `.planning/research/SUMMARY.md`.

## Roadmap shape (v3.2, created 2026-06-28)

**CORE (committed) — Phases 132-137:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 132 | Skill Versioning + Eval Test-Case Persistence | VER-01, EVAL-01 | 4 | Schema/RLS foundation (~5 new tables); owner-scoped (skills precedent); no agent-loop/provider touch |
| 133 | Eval Runner — With-Skill vs Without-Skill | EVAL-02 | 4 | SC#10; G-5 (net-new eval router — do NOT grow `threads.py`; consume `agent_loop.py`/gateway read-only); no new runtime |
| 134 | Eval Results, Honest Verdict + Ratings | EVAL-03, EVAL-04 | 4 | SC#10 (per-provider verdict honesty, MP-03 precedent); UI hint (polished panel = 137) |
| 135 | Self-Improvement Loop (SI-01) | SI-01 | 4 | SC#10; UI hint (diff review); human-in-the-loop; G-5 (consume agent_loop/gateway read-only) |
| 136 | Skill Publish Gate (GATE-01) | GATE-01 | 3 | UI hint (publish-flow gate); future-publish-only |
| 137 | Skill Evals Panel UI (PANEL-01) | PANEL-01 | 4 | **G-2 sketch**; UI hint; SC#10 (UI state); additive (no Skills-tab redesign) |

**STRETCH (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 precedent) — Phases 138-144:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 138 | Run-End Honesty | RUN-01 | 3 | — (backend-only, small, can go early); G-5 (`agent_loop.py` finalizer); SEED-094 |
| 139 | Self-Improve Proposer (description-only) | SI-02 | 3 | 135 |
| 140 | Smart-Dispatch Relevance Pre-Filter | TRIG-02 | 3 | 123 (shipped); G-5 (catalog injection); SC#10 |
| 141 | template_input Resolver Run-Scope | COLL-02 | 2 | 120 (shipped) |
| 142 | Non-Python Skill-Script Honesty | SRH-01 | 3 | 120 (off COLL-01 seam, shipped); DISC-01 Layer 1 |
| 143 | Starter Workflow Library | WF-01 | 3 | — (Workflows page exists); SEED-084; UI hint |
| 144 (added 2026-07-05) | Agent-Driven Skill File Attachment | FILE-01 | 4 | — (no hard dependency; `skill_files` table/bucket already exist); new WRITE-capable tool — needs its own threat model + SC#10 proof; SEED-104 (promoted from Phase 137.2's live SC#4 UAT) |

- **Coverage:** 15/15 requirements mapped (8 CORE + 7 STRETCH); 0 unmapped. Every requirement → exactly one phase.
- **Sequencing rationale:** VER-01 paired WITH EVAL-01 in the foundation (132) — test cases reference an immutable skill version. Strict eval chain 132 → 133 → 134 (persistence → runner → results). SI-01 (135) needs the full eval substrate (EVAL-02 + EVAL-03 + VER-01 + EVAL-04 ratings). GATE-01 (136) consumes the pass/fail verdict. PANEL-01 (137) lands LAST as the sketch-gated consolidation of the whole eval experience (depends EVAL-01..04 + VER-01). RUN-01 (138) is backend-only/small — the safest STRETCH to pull forward; it closes SEED-094.
- **SC#10 (cross-provider mandate):** flagged on every phase touching streaming / agent loop / provider routing / UI state — headline three EVAL-02 (133), SI-01 (135), TRIG-02 (140), plus per-provider-display / UI-state phases 134, 137, 139.
- **UI hint:** 134, 135, 136, 137 (CORE) + 139, 143 (STRETCH).
- **G-2 sketch-gated:** 137 (PANEL-01). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **G-5 hot files (audit at discuss-phase):** `backend/app/api/threads.py` (firing → extraction STILL due — do NOT grow it; eval runner 133 + SI-01 135 = net-new routers, `skill_tuner.py` precedent), `backend/app/services/agent_loop.py` (RUN-01 138 finalizer/terminal; TRIG-02 140 catalog-injection; 133/135 consume read-only), catalog injection + `context_window.py` token budget (140).
- **Red line:** never fork the shared path — provider differences at the gateway/adapter/sanitizer boundary (D-14). Deep Mode byte-identical; no new eval runtime (evals reuse the agent loop + provider gateway).
- **Reported-bugs:** RUN-01 (138) closes SEED-094 (BUG-260626-02 baseline leak into final-emit + BUG-260626-03 run-end todo finalizer).

Roadmap detail: `.planning/ROADMAP.md` (active v3.2 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Scope source: `.planning/PRDs/v3.1-skill-studio-eval.md`.

## Roadmap shape (v3.1, created 2026-06-21)

**CORE (committed) — Phases 120-124:**

| Phase | Name | REQ-IDs | SC# | Flags |
|---|---|---|---|---|
| 120 | Collision Fix + Context Isolation | COLL-01, CTX-01 | 4 | G-5 (`threads.py`/`agent_loop.py`); SC#10 |
| 121 | One Front Door for Workflows (IA) | IA-01 | 3 | G-2 sketch; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter); SC#10 (eval axis, MP-03) |
| 123 | Skill Triggering Quality | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim); SC#10 |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | WUX-01, WUX-02 | 4 | G-2 sketch (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

**STRETCH (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent) — Phases 125-131:**

| Phase | Name | REQ-IDs | SC# | Depends |
|---|---|---|---|---|
| 125 | Self-Improve Proposer (description-only) | SI-02 | 3 | 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | TRIG-02 | 3 | 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | WUX-03 | 2 | 124 (G-2 sketch; UI hint) |
| 128 | Live Description Before tool_start | TDP-02 | 2 | 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MP-04 | 2 | 122 |
| 130 | template_input Resolver Run-Scope | COLL-02 | 2 | 120 |
| 131 | Non-Python Skill-Script Honesty | SRH-01 | 3 | 120 (off COLL-01 seam) |

- **Coverage:** 19/19 requirements mapped (12 CORE + 7 STRETCH); 0 unmapped. Every requirement → exactly one phase. *(Phase 131 / SRH-01 folded in 2026-06-22 — SEED-044 Layer 1, the honesty precursor to v3.2 DISC-01; surfaced by a JS-skill-import investigation.)*
- **Sequencing rationale:** COLL-01 (confirmed LIVE bug, Mechanism A) sequenced EARLIEST (Phase 120), paired with CTX-01 (same collision/context-isolation fix). MP-03 (per-provider scoreboard) lands in the SAME phase as MP-01/MP-02 (122) so the scoreboard substrate gates any MP-02 tier flip. TRIG-01 (headline skill-quality deliverable) gets its own phase (123) with TRIG-03 + CTX-03 as adjacent skill-triggering items. WUX-01/WUX-02 (G-2 sketch-gated UX re-skin) cluster in 124; IA-01 (also G-2/frontend) lands first in 121 as the "one front door" prerequisite the WUX re-skin builds on.
- **SC#10 (cross-provider mandate, EVAL axis per MP-03):** flagged on every phase touching streaming / agent loop / provider routing / UI state — 120, 121, 122, 123, 124 (+ dependent STRETCH 125, 126, 128, 129).
- **UI hint:** 121, 124 (CORE) + 125, 127 (STRETCH).
- **G-2 sketch-gated:** 121 (IA-01), 124 (WUX-01/02) + 127 (WUX-03). `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`.
- **G-5 hot files (audit at discuss-phase):** `backend/app/api/threads.py` (firing → extraction due; 120/121 thread/composer surface — do NOT grow it), `context_window.py`/`agent_loop.py` trim path (CTX-01 `_reconstruct_history` origin filter, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

Roadmap detail: `.planning/ROADMAP.md` (active v3.1 section). Requirements + traceability: `.planning/REQUIREMENTS.md`. Scope source: `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`.

## Roadmap shape (v2.9, created 2026-06-08)

| Phase | Name | REQ-IDs | SC# |
|---|---|---|---|
| 097 | Spike — Risk-Register Template-Fill + Authoring Feel | — (SEED-051; informs PROJ/TMPL/WFAUTH) | 4 |
| 098 | Project Binding + Server-Side KB Scope Governance | PROJ-01, PROJ-02, GOV-01 | 4 |
| 099 | Workflow ↔ Skill Composition | WFSKILL-01 | 3 |
| 100 | Ephemeral Template Upload | TMPL-01 | 3 |
| 101 | Template-Fill + Integrity Validation | TMPL-02, TMPL-03 | 4 |
| 102 | Reusable Validation-Gate Library + Output-Quality Gate | GATE-01, QUAL-01 | 3 |
| 103 | Workflows Page + Authoring API + NL Authoring | WFAUTH-01/02/03/04 | 4 |
| 104 | PM Flagship Content Pack | PM-01 | 3 |
| 105 (STRETCH) | Scheduled/Recurring Triggers + Budget Caps | SCHED-01 | 3 |
| 106 (STRETCH) | Citation-Traceable Grid Renderer | GRID-01 | 2 |
| 107 (STRETCH) | Per-Run Provenance Receipt View | GOV-02 | 2 |
| 108 (STRETCH) | Plugin Contract Lock — phase_type + file_preview | PLUG-01 | 2 |
| 109 (STRETCH) | Operator/Admin Role Tier | ROLE-01 | 2 |

- **SC#10 (cross-provider mandate) flagged on:** 098, 099, 101, 102, 103, 104 (workflow-run-bearing) + 106 (batch fan-out).
- **UI hint:** 100, 101, 103, 106, 107, 108.
- **G-2 sketch-gated:** 103. **G-6 failure-mode UAT rows:** 101.

## Milestone scope (locked 2026-06-08)

v2.9 = **Workflow Studio** — a value-first reframe of the provisional "Plugin Contract & Extension System." The headline insight from the deep research brief: v2.9 is ~80–90% composition of shipped v2.8 harness primitives; net-new is *authoring UX + a project/scope binding + ephemeral template upload + a small validation-gate library + the Workflows page* — NOT a new runtime, NOT the Plugin Contract.

**5 scope forks resolved:**

1. Scheduled/recurring execution → **DEFERRED** (hard-depends on a budget/spend-ceiling system that doesn't exist; v3.4 territory). v2.9 = author + run on demand. *(Carried as STRETCH Phase 105 with the hard budget prerequisite.)*
2. Self-serve global sharing + operator role tier → **DEFERRED** (v3.1). v2.9 keeps drafts + per-user publish (RLS already enforces). *(Carried as STRETCH Phase 109.)*
3. Template-fill magic → **BOTH** patterns: trusted project-library templates use docxtpl/Jinja; arbitrary uploads use non-Jinja run-replace. Spike sets how far the arbitrary path is pushed. *(Phase 097 spike → Phase 101 build.)*
4. Citation-traceable grid renderer → **STRETCH**. *(Phase 106.)*
5. PM flagship demo → **single template-fill** (status report from KB) as the spike + acceptance bar; standup-to-artifacts cascade = showcase content after primitives proven. *(Phase 097 spike + Phase 104 content pack.)*

Plugin Contract is OFF the critical path (STRETCH: lock `phase_type` + `file_preview` on flagship telemetry + one PPTX preview reference plugin → Phase 108). Connectors (email/OneDrive/GDrive) → SEED-013/014 (v3.3/v3.4). **Enhanced Document Structure** (M-Files/Doxis basics, SEED-005) = NEXT milestone after v2.9 (operator-confirmed 2026-06-08).

Research brief: `.planning/research/v2.9-EXPLORATION.md` (+ 6 dimension reports A–F under `.planning/research/v2.9-exploration/`).

## Seeds folded / routed (v2.9, /gsd:new-milestone seed scan)

- **SEED-051** (generalized NL→workflow authoring) → **FOLDED** as v2.9 CORE (spike-first — Phase 097 answers the 4 unknowns that become the schema; NL authoring lands in Phase 103).
- **SEED-037** (workspace panel office/PDF/PPTX viewing + download) → partial overlap with template preview / `file_preview` plugin → STRETCH (Phase 108).
- **SEED-013** (external integrations: API + MCP + webhooks) → connectors deferred; re-open trigger: first `data_source` plugin design (first reference = read-only GDrive/OneDrive folder→KB sync).
- **SEED-014** (automations & routines) → scheduled execution + scheduled ingestion deferred to v3.4 (Phase 105 only covers on-demand-budget-gated scheduling if promoted).
- **SEED-005** (DM / M-Files-Doxis basics) → **NEXT milestone after v2.9** (Enhanced Document Structure).
- **SEED-040 / SEED-012** (model-registry self-service / admin-operator UI) → operator tier + metadata-model-flexibility deferred (v3.1 / DM milestone; Phase 109 only if global sharing becomes a headline).
- **SEED-052** (interactive todo-driven HITL) → adjacent to `llm_human_input` review-with-provenance checkpoints; noted (Phase 101 review surface + Phase 102 gates).

## Open reported-bugs sweep (2026-06-08, /gsd:new-milestone mandate)

3 open `surface: Agentic-RAG` reports — **none fold into v2.9 CORE** (all Deep-mode chat / provider / live-execution polish, outside the Workflow Studio authoring domain). They sit in the SC#10 cross-provider blast radius (workflows run in a thread, share the composer + live-execution panel) → v2.9 UAT must not regress them.

| Report | Sev | Disposition |
|---|---|---|
| `general-chat-intermittent-silent-send-drop` | minor | leave open — tracked as SEED-055 residual |
| `minimax-m3-invalid-tool-args-400` | minor | leave open — provider-specific; MiniMax low-priority; re-open trigger: cross-provider workflow UAT surfaces it |
| `setting-up-agent-hides-model-activity` | major | leave open — Deep-mode dispatch-latency banner; candidate for a focused Deep-UX polish phase |

## Workflow guardrails firing (v2.9)

- **G-2 (sketch-before-plan) FIRES** — Workflows page / NL-form-editor / live read-only graph are live UI (Phase 103); `/gsd:sketch` before `/gsd:spec-phase`/`/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names these surfaces (sketches 012 workflows-page + 013 workflow-builder processed — confirm/extend).
- **G-6 (failure criteria upfront)** — each phase SPEC carries a "How we'd know this failed" section; template-fill known failure modes (run-split miss, XML corruption, pptx row-growth, xlsx chart strip, merged-cell mis-write, produced-file-won't-open) become UAT rows up front (Phase 101).
- **G-1/G-5 (hot-file caps)** — authoring work is greenfield (new page, new API router, additive optional model fields); it does NOT pile onto the G-5-firing hot files (`backend/app/api/threads.py`, `backend/app/services/anthropic_service.py`). Engine additions are additive seams on `backend/app/services/harness/phase_types.py` + `backend/app/models/harness.py`. `backend/app/api/threads.py` extraction remains due (carried — do not grow it in v2.9).
- **Red line** — workflows COMPOSE the shipped harness / agent-loop / provider-gateway; never re-implement. Deep Mode stays byte-identical. No new runtime.

## Accumulated Context

### Roadmap Evolution

- **Phase 144 added (2026-07-05):** Agent-Driven Skill File Attachment (FILE-01) — new `attach_skill_file` tool + endpoint so the agent can attach files/scripts/assets it creates during skill authoring, and a user can hand the agent an existing template file mid-conversation for the agent to attach; reuses the existing `skill_files` table/bucket, no new storage surface. Promoted from SEED-104 (planted during Phase 137.2's live SC#4 UAT, deliberately deferred there to avoid a 3rd decimal insert onto the 137.x chain mid-verification). Appended to the end of v3.2 STRETCH (after Phase 143); needs its own threat model at discuss-phase (net-new WRITE-capable tool) + SC#10 cross-provider proof.
- **Phase 111.1 INSERTED after Phase 111 (2026-06-15):** "Configurable / Multi-Provider Embeddings (incl. local Ollama + LM Studio)" — embedding-provider picker + local presets + re-embed-on-change lifecycle; new reqs **EMBED-01..06**; depends on Phase 111 (reuses its `lmstudio` provider plumbing); G-2 sketch fires (Settings UI). Lands before the DM read-path phases (113-119). Sourced from a 5-agent investigation (the `embedding-flexibility-scoping` workflow). **Decision:** keep embedding flexibility OUT of Phase 111 (different domain = retrieval substrate, not the metadata LLM; plus the fixed-`vector(1536)`/HNSW dimension + destructive-re-embed landmine) → its own phase. **Retires SEED-048.** **SEED-048 correction:** embeddings are NOT OpenAI-hardwired today — `embedding_model`/`embedding_base_url`/`embedding_api_key`/`embedding_dimensions` are already configurable Settings with UI controls (`SettingsPage.tsx:934-950`); what's missing = a provider picker, local presets, the re-embed lifecycle, and a fix for the `embed_chunks` `user_settings`-drop bug (folded in as EMBED-04). The 111.1 plan must VERIFY these findings against live code.

**Open blockers:** None. (Resolved 2026-06-08: Phase 097 Plan 01 Task 3 human-action checkpoint — operator confirmed folder `75755ec9-5ba7-495b-ad93-7500011cf6f2` "Project Meridian — Risks" and ingested a synthetic risk corpus to ground it; `out/spike-config.json` written + committed `61025148`.)

**Key decisions** (full log in PROJECT.md → Key Decisions): D-v2.8-01 (harness now; Plugin Contract was deferred to v2.9 — **now reframed**: Plugin Contract OFF the v2.9 critical path, value-first Workflow Studio instead, lock `phase_type`+`file_preview` on flagship telemetry as STRETCH Phase 108), GATEWAY-01 (one shared provider gateway, Deep byte-identical — workflows consume it, never re-implement), D-094-UNIFY (panel = single live-execution surface for Deep + Harness), D-095.1 (run honesty = projection/classification over existing data; provider handling at the gateway boundary). New v2.9 design anchors from research: "project = folder" as the single scope object; immutability = "no-edit-published" not "no-grow-format" (additive optional fields keep old workflows validating); LLM produces DATA, deterministic code produces the FILE; output-quality judge gate is a HARD publish blocker. **Spike 097 Plan 04 (unknown d, 2026-06-09):** describe→refine→publish feel = **MIXED** — the authoring mechanism works (grounded one-shot generation + conversational refine over the strict schema yields correctly-typed, schema-valid drafts) but Phase 103 (WFAUTH-02) MUST add (1) a clarify-as-you-go **grey-area validation loop** — surface every ambiguity (unresolvable folder ref / vague scope / unmapped placeholder / missing tool+skill) for explicit user validation, NO silent substitution (the spike caught the generator silently mapping a non-existent "Acme" folder and a non-existent "/Risks subfolder") — and (2) a **tweak→new-version** authoring path (editability = a versioning op; immutability is per-version, not per-workflow — confirms the "no-edit-published" anchor). Unknown (c): folder tree + tool names + template placeholders are MUST-HAVE authoring grounding; skill registry nice-to-have; PROJ-02 bound `folder_scope`/`project_folder_id` confirmed needed (scope leaked into prompt text for lack of a schema field).

**Deferred items carried from v2.8 close (2026-06-07):** 43 acknowledged items — full inventory in `.planning/milestones/v2.8-MILESTONE-AUDIT.md` (and the prior STATE.md in git history). Headline: CONC-01 partial → SEED-065-B (cross-tab GET p95 ~3 s residual); PARITY-01 re-deferred; 11 dormant forward seeds (SEED-002/003/004/005/040/041/042/043/044/045/046); SEED-048/050/057 carried/active.

**Planned Phase:** 112 (metadata-enrichment-document-detail-panel-manual-edit) — 4 plans — 2026-06-17T20:46:10.826Z

- Phase 123.1 inserted after Phase 123: Trigger Tuner design fidelity + UX polish (post-live-UAT gaps) (URGENT)

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 187 P28 | 41min | 3 tasks | 4 files |
| Phase 118 P02 | ~30 min | 2 tasks | 3 files |
| Phase 118 P03 | 12min | 2 tasks | 5 files |
| Phase 118 P05 | 10min | 2 tasks | 5 files |
| Phase 119 P01 | 11min | 2 tasks | 8 files |
| Phase 119 P02 | 7min | 3 tasks | 7 files |
| Phase 120 P01 | ~4min | 2 tasks (TDD) | 3 files |
| Phase 120 P02 | ~25min | 2 tasks (1 TDD) | 8 files |
| Phase 120 P03 | ~10min | 3 tasks | 2 files |
| Phase 121 P01 | 6min | 2 tasks | 2 files |
| Phase 121 P02 | ~12min | 2 tasks | 3 files |
| Phase 122 P01 | 29min | 2 tasks | 4 files |
| Phase 122 P04 | 5min | 2 tasks | 4 files |
| Phase 122 P02 | ~13min | 2 tasks (TDD) tasks | 3 files files |
| Phase 122 P03 | ~6min | 2 tasks | 3 files |
| Phase 175 P01 | ~35min | 2 tasks (1 TDD) | 5 files |
| Phase 185 P01 | 33min | 2 tasks | 5 files |
| Phase 175 P04 | ~7min | 2 tasks (2 TDD) | 5 files |
| Phase 123 P01 | 9min | 2 tasks | 8 files |
| Phase 123 P02 | 7min | 2 tasks | 3 files |
| Phase 123 P03 | 12min | 2 tasks | 6 files |
| Phase 123 P04 | 8min | 2 tasks | 3 files |
| Phase 123 P05 | ~10min | 3 tasks (2 TDD) | 11 files |
| Phase 123 P06 | ~30min | 2 tasks | 8 files |
| Phase 123.1 P01 | ~20min | 3 tasks | 6 files |
| Phase 123.1 P02 | 5min | 2 tasks | 4 files |
| Phase 123.1 P03 | ~12min | 1 task (TDD) | 2 files |
| Phase 123.1 P04 | 18min | 2 tasks | 4 files |
| Phase 123.1 P05 | 11min | 4 tasks | 7 files |
| Phase 123.1 P10 P10 | ~1min | 1 tasks | 2 files |
| Phase 123.1 P06 | 7min | 2 tasks | 3 files |
| Phase 123.1 P07 | ~12min | 2 tasks | 4 files |
| Phase 123.1 P08 | ~10min | 2 tasks | 6 files |
| Phase 123.1 P09 | ~6min | 1 tasks | 2 files |
| Phase 132 P03 | ~30min | 3 tasks (1 human-verify gate) | 4 files |
| Phase 138 P138-04 | 5min | 2 tasks | 2 files |
| Phase 142 P04 | ~5min | 2 tasks | 2 files |
| Phase 142 P02 | 8min | 3 tasks | 4 files |
| Phase 142 P03 | 5min | 3 tasks | 3 files |
| Phase 143 P02 | 9min | 2 tasks | 2 files |
| Phase 143 P03 | 6min | 3 tasks | 4 files |
| Phase 143 P04 | 6min | 2 tasks | 3 files |
| Phase 146 P01 | 9min | 3 tasks | 3 files |
| Phase 146 P02 | 11min | 3 tasks | 8 files |
| Phase 146 P146-04 | 2min | 2 tasks | 3 files |
| Phase 146 P05 | 3min | 3 tasks | 5 files |
| Phase 146 P06 | 10min | 3 tasks | 6 files |
| Phase 148 P01 | 40 | 3 tasks | 15 files |
| Phase 148 P03 | ~6min | 1 auto task (Task 1 = operator human-action) | 1 file |
| Phase 149 P09 | 7min | 2 tasks | 7 files |
| Phase 149 P11 | 18min | 2 tasks | 2 files |
| Phase 149 P12 | 12min | 1 tasks | 2 files |
| Phase 150 P02 | 2 | 2 tasks | 2 files |
| Phase 159 P01 | 13 | 2 tasks | 3 files |
| Phase 159 P06 | 12min | 3 tasks | 4 files |
| Phase 160 P160-01 | 6 | 2 tasks | 3 files |
| Phase 161 P01 | 11min | 3 tasks | 1 files |
| Phase 161 P02 | 8min | 2 tasks | 1 files |
| Phase 162 P01 | 19min | 3 tasks | 1 files |
| Phase 162 P162-02 | ~48min | 3 tasks | 4 files |
| Phase 162.5 P02 | 30 | 2 tasks | 3 files |
| Phase 162.5 P03 | ~50min | 2 tasks | 5 files |
| Phase 163 P01 | 25 | 2 tasks | 4 files |
| Phase 163 P02 | 8min | 2 tasks | 2 files |
| Phase 163 P03 | 11m | 3 tasks | 7 files |
| Phase 163 P04 | 9m | 2 tasks | 3 files |
| Phase 163 P06 | 59min | 3 tasks | 17 files |
| Phase 163 P07 | 45min | 2 tasks | 10 files |
| Phase 163 P08 | 36min | 3 tasks | 9 files |
| Phase 163 P09 | 125 | 2 tasks | 10 files |
| Phase 164 P02 | 30 | 2 tasks | 8 files |
| Phase 164 P02 | 30 | 2 tasks | 8 files |
| Phase 164 P164-03 | 42min | 2 tasks | 3 files |
| Phase 164 P164-04 | 35min | 3 tasks | 5 files |
| Phase 168 P01 | 12min | 3 tasks | 2 files |
| Phase 168 P02 | 13min | 2 tasks | 9 files |
| Phase 168 P03 | 8min | 2 tasks | 3 files |
| Phase 168 P04 | 32min | 2 tasks | 4 files |
| Phase 168 P05 | 14min | 2 tasks | 7 files |
| Phase 168 P06 | 11min | 2 tasks | 6 files |
| Phase 175 P02 | 15min | 2 tasks | 4 files |
| Phase 175 P03 | 3min | 2 tasks | 4 files |
| Phase 176 P01 | 13min | 2 tasks | 3 files |
| Phase 176 P02 | 13min | 2 tasks | 6 files |
| Phase 176 P03 | 35min | 2 tasks | 2 files |
| Phase 176 P04 | 35 | 2 tasks | 6 files |
| Phase 182 P01 | 24min | 3 tasks | 5 files |
| Phase 182 P02 | 22min | 2 tasks | 3 files |
| Phase 184 P01 | 51min | 3 tasks (1 checkpoint) | 4 files |
| Phase 182 P03 | 11min | 2 tasks | 4 files |
| Phase 182 P04 | 47min | 2 tasks | 4 files |
| Phase 182 P05 | 10min | 2 tasks | 5 files |
| Phase 182 P06 | 10min | 3 tasks | 4 files |
| Phase 182 P07 | 23min | 2 tasks | 4 files |
| Phase 182 P08 | 20min | 3 tasks | 5 files |
| Phase 182 P09 | 25min | 2 tasks | 3 files |
| Phase 182 P10 | 12min | 3 tasks | 4 files |
| Phase 182 P11 | 28min | 3 tasks | 8 files |
| Phase 182 P12 | 23min | 3 tasks | 8 files |
| Phase 183 P01 | 22min | 3 tasks | 6 files |
| Phase 183 P02 | 8min | 3 tasks | 5 files |
| Phase 183 P03 | 22min | 2 tasks | 3 files |
| Phase 183 P04 | 21min | 3 tasks | 9 files |
| Phase 183 P05 | 20min | 3 tasks | 6 files |
| Phase 183 P06 | 27min | 3 tasks | 3 files |
| Phase 183 P07 | 22min | 3 tasks | 3 files |
| Phase 183 P08 | 25m | 3 tasks | 5 files |
| Phase 184 P02 | 22min | 2 tasks | 2 files |
| Phase 184 P03 | 38min | 3 tasks | 4 files |
| Phase 184 P04 | 40min | 3 tasks | 6 files |
| Phase 184 P05 | 33min | 3 tasks | 6 files |
| Phase 184 P06 | 20min | 3 tasks | 3 files |
| Phase 184 P07 | 35min | 3 tasks | 4 files |
| Phase 184 P08 | 17min | 3 tasks | 7 files |
| Phase 184 P09 | 22min | 3 tasks | 4 files |
| Phase 184 P10 | 40min | 3 tasks | 5 files |
| Phase 184 P11 | 55min | 3 tasks | 8 files |
| Phase 184 P12 | 21min | 3 tasks | 4 files |
| Phase 184 P13 | 30min | 3 tasks | 7 files |
| Phase 184.1 P01 | 35min | 3 tasks | 4 files |
| Phase 185 P04 | 20min | 3 tasks | 5 files |
| Phase 185 P07 | 26min | 3 tasks | 4 files |
| Phase 185 P05 | 40 | 3 tasks | 7 files |
| Phase 185 P08 | 57min | 3 tasks | 17 files |
| Phase 185 P09 | 42min | 2 tasks | 5 files |
| Phase 185 P12 | 12min | 3 tasks | 4 files |
| Phase 186 P05 | 15min | 2 tasks | 3 files |
| Phase 186 P06 | 55min | 3 tasks | 2 files |
| Phase 186 P07 | 65min | 3 tasks | 12 files |

## Decisions

- [Phase 186]: 186-01 (D-186-07 AMENDED IN THE OPEN): the concurrency token is compared in **TEXT space** via one module-level `CONCURRENCY_TOKEN_SQL` = `to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, **not** `AND updated_at = $N`. asyncpg refuses a `str` bind to `timestamptz` with AND without a `::timestamptz` cast (probed live — `DataError` both ways), so the literal D-186-07 shape is a runtime 500, not a precision bug. Rejected alternatives are recorded at the constant: `updated_at::text` renders in the SESSION TimeZone (`+00` vs `+05:30` for the same row), and Python `isoformat()` / Pydantic's datetime serializer both DROP the fractional part at 0 µs (variable-width token). **Zero migrations — slot 115 stays free.**
- [Phase 186]: 186-01: the token rides an **`If-Match` header**, not a wrapper body model (`WorkflowDefinition` is `extra='forbid'` and the token is transport metadata, D-14), and it is **OPTIONAL for one release** — an absent header runs today's byte-identical unguarded UPDATE so a tab open across the deploy does not break on its next save. Dated concession, stated in the route docstring.
- [Phase 186]: 186-01 (D-186-09): stale = **409 + `detail.code`**, not 412 — the shipped client already branches on 409 and throws the body away, so adding a code is additive at one call site; 412 would split one concept across two statuses and drag the operator-verified published-row sentence with it. The stale 409 carries the **current token** so "overwrite with what's on screen" is one PATCH.
- [Phase 186]: 186-01 (T-186-01-01/02/03): the token is a **THIRD conjunct after `created_by = $2 AND status = 'draft'`**, never in place of either — a concurrency check, never an authorization check. The 0-row disambiguating probe is **owner-scoped**, so it can only ever describe a row the caller already owns, and the 404 stays **code-less** (a coded 404 would be an existence oracle). F3 asserts the foreign-id and unknown-id details equal *each other*.
- [Phase 186]: 186-01: **a published-row PATCH now returns 409 `already_published`, not the pre-186 404** — the deliberate consequence of disambiguating the 0-row write. `test_103_published_409.py` was EXTENDED not replaced (4 tests before, 4 after, 0 deleted, 1 renamed); its no-mutation assertions are untouched. `delete_draft`'s 409 keeps a bare-string detail on purpose, pinned by a new assertion so the asymmetry reads as a decision.
- [Phase 186]: 186-01 [Rule 1 bug]: **`= Header(default=None, alias=...)` leaks the unresolved `FieldInfo` when a route function is called DIRECTLY** — this repo's shipped route-test idiom. The sentinel is truthy, so it reached asyncpg as the bind (`DataError: expected str, got Header`) and reddened two existing tests. Use `Annotated[str | None, Header(alias=...)] = None`, whose default is a plain `None`. Applies to every future header parameter in this codebase.
- [Phase 186]: 186-01 (Pitfall 9, written into the source): `set_updated_at` uses `now()` = **TRANSACTION time** — two UPDATEs wrapped in ONE transaction produce an identical token and would silently disable the guard. Both production writers are single-statement autocommit; **186-02 must not wrap the stage-5 publish flip with any other UPDATE.**
- [Phase 185]: 185-01 (D-185-17): the 137-D → 137-B card rebuild SHIPPED as its own Wave-1 plan, before any governance mark. `PhaseNodeCard` is now a 248px centre-aligned card inside the 260px node box with the 3D mark floating above its top edge (`left-1/2 top-[-26px]`, 62×62); `CANVAS_LAYOUT.NODE_MIN_HEIGHT` 96 → 104 and `pt-[42px]` are D-185-17's amendments to `themes/canvas-184.css` (which carries 96/34) — every other constant is the sketch theme verbatim. The VALID-03 verdict mark moved `-right-2` → `-left-2 top-1.5`; the card's TOP-RIGHT corner is now empty and CLAIMED for plan 185-09's governance seal. Zero governance signal was added.
- [Phase 185]: 185-01: SPEC acceptance criterion 23's zone check runs over RENDERED marks only. The plan's Task-2 prose asked for zero overlap across {icon, verdict, stepNumber}, which its own Task-1 prose contradicts (the relocated verdict grazes the 137-B `.stepn` slot by 2×16px) — resolved toward the `must_haves`/SPEC wording, with the graze pinned as a hard `toBe(32)` residual plus a live assertion that the slot paints nothing (D-183-07) and that the documented `left:16` remedy clears it.
- [Phase 185]: 185-01: geometry assertions PARSE the component's own Tailwind placement classes off the rendered DOM (container dims from `CANVAS_LAYOUT`) rather than re-typing literals, so editing a placement class moves the boxes. The check was physically driven RED on the pre-rebuild card (`icon well × verdict = 112px²`, exactly D-185-17's hand-computed 14×8) before being accepted green, and those pre-rebuild boxes are now a permanent positive control so it can never go vacuous.
- [Phase 185]: 185-01: `vitest-count-gate.cjs` CANNOT exit 0 in this phase — measured pre-existing, not caused here. Baseline (`59c32a06`, all five files reverted) = 1497 total / **34 failed** with three stale positive pins (`canvasModel.purity.test.ts` +10, `WorkflowCanvas.test.tsx` +2, `WorkflowBuilderPage.canvas.test.tsx` +50); after the plan = 1504 / 35, the +7 being exactly this plan's new tests. Failing-test NAME diff = 5 new / 4 fixed, all in untouched files, no test in both lists — flake churn (SEED-056 + the `Axe is already running` cross-file pollution). The half this plan owns holds: `canvasModel.test.ts` is exactly 26, delta 0.
- [Phase 184]: 184-01 (D-184-08): the count gate ships as its OWN single-file commit BEFORE any Wave-0 source change, so the icon swap it carves out is itself measured by it. `scripts/vitest-count-gate.cjs` pins per-FILE counts keyed by bare filename with named failure reasons (`[failing-tests]` / `[total-below-baseline]` / `[missing-file]` / `[count-decrease]`); INCREASES are allowed and printed as `+N` (feature waves add tests), only decreases fail. A gate is falsified before it is trusted — delete a test, observe the named failure, restore, observe green, record both.
- [Phase 184]: 184-01 (D-184-07): the icon swap touches FIVE places in ONE commit — both maps, both `~icons` imports, the verified-slugs docblock, and the one pinned assertion. Swapping `soulData.PHASE_GLYPHS` alone leaves `phaseGlyph()` returning the old 3D component while the string fallback changed (a silent split-brain). The commit contains exactly the three icon files, so `git revert ffb3e9cf` undoes the icon decision alone and leaves the gate standing.
- [Phase 184]: 184-01 (D-184-08 carve-out — SPENT): `soulData.test.ts:132-133` (`"robot"`→`"compass"`, `"busts-in-silhouette"`→`"handshake"`) is the ONE permitted assertion edit in phase 184. Every other plan is under a zero-assertion-edit gate: an assertion that HAS to change means the extraction was not behaviour-preserving — that is the signal, not an inconvenience.
- [Phase 184]: 184-01 (D-ITEM-183-01): the plan's `npm run build` exit-0 criterion was unsatisfiable on an untouched checkout (`"build": "tsc -b && vite build"` with 33 pre-existing `develop` errors) → split into a DIFFERENTIAL `tsc` count (≤ 33) plus `npx vite build` exit 0, which is the real `~icons` presence proof and the path Vercel uses. Operator-accepted. Every `tsc` gate in this phase is differential, never "must be zero".
- [Phase 184]: 184-01 (D-ITEM-183-02): stale docblocks naming the retired slugs were reworded to name them as HISTORY, not current truth. The acceptance grep is deliberately scoped to map entries and imports precisely so a corrected docblock stays legal — a guard that only passes by making a comment lie is a broken guard.
- [Phase 175]: 175-04 (XPROV-03 D-03/D-04): title-gen + suggestion route their `sub_agent_model` override through `provider_safe_utility_model` — a cross-provider/unrecognised id is dropped BEFORE the call so no wrong-provider 404 → no `fallback_model` emit → no misleading banner (suppress-when-fine is automatic, no new branch). The 404 fallback branch + the `fallback_model`→`title` ordering invariant are untouched, so a genuine same-provider 404 still emits `fallback_model` honestly.
- [Phase 175]: 175-04 (XPROV-04 D-05): the title call injects a per-MODEL reasoning-off param driven generically off `get_model_capability(model).get("reasoning_off")` — `thinking_disabled` → `extra_body={"thinking":{"type":"disabled"}}` (DISABLE mirror of the DeepSeek ENABLE block), `effort_none` → `reasoning_effort="none"`; the full Plan-01 SAFE set (11+2) injects with NO hardcoded id list, UNSAFE rows inject an empty dict. Budget (30/160) + inline-await ordering byte-identical (D-14); empty/refusal on a SAFE provider still derives a real title.
- [Phase ?]: 118-02: classification-rules routes return RuleResponse(**row) so live CRUD tests can call coroutines directly (read .is_global/.id/.enabled); service imported as a module to avoid create_rule shadowing
- [Phase ?]: 118-02: removed 5 stale xfail markers in test_118_rule_crud.py so the CRUD tests are genuinely GREEN (xpass would silently mask a future regression)
- [Phase ?]: Phase 118-03: classification rule-eval spliced into ingest_document before the single persist write — own+global leak-safe read (no auth.uid in the BG task, D-118-8), first-match-wins ONE _classification suggestion, NEVER a folder move (CLASS-02)
- [Phase 118]: Phase 118-03: accept/dismiss endpoints — accept records prior_folder_id, re-validates the target folder, moves, audits classification.apply AFTER the move; dismiss clears; Undo reuses the existing move endpoint (CLASS-03 reversible)
- [Phase 119]: Phase 119-01: A1 LIVE — document_relationships FKs are ON DELETE CASCADE; a full endpoint delete cascades the edge away, so the only broken state is an orphaned old-version edge (lineage has no current is_latest). Broken predicate anchors on _latest_exists_anywhere, not the resolver None (which degrades to a stale old row).
- [Phase 119]: Phase 119-01: A3 PINNED LIVE — PostgREST deep-jsonb path for the _-leading key is the DOTTED form metadata->_classification->>status (quoted-arrow form returns nothing).
- [Phase 119]: Phase 119-01: masking != deletion (D-119-3) — an alive-but-unreadable target is masked, NOT broken; the existence probe is content-free (count only), no cross-user leak; DMF-03 non-gate confirmed (A8).
- [Phase 119]: Phase 119-02: D-119-2 navigation triad owned in ONE plan (App.tsx ActiveView union + nav-items ShieldCheck entry + ChatLayout governance branch) — clicking Governance renders GovernancePage, not KnowledgeHealthPage; the Phase 118 built-but-unreachable lesson applied.
- [Phase 119]: Phase 119-02: GovernanceRow is link-out-only (D-119-6) — clones only HealthDocumentRow chrome, imports no document-mutation helper; the whole row is a keyboard-operable button → DocumentDetailPanel. A5 lighter reuse: top-10 rows + honest backend total (no PaginationControls); D-119-9 initializedTabsRef no-refetch-loop guard carried verbatim into the 3-stacked-card page (Refresh clears it). Frontend-only, no migration/package/write path; threads.py untouched.
- [Phase 120]: Phase 120-01 (COLL-01): Option 2 lazy seed in the execute_code handler (tool_dispatcher.py) chosen over Option 1 (eager seed in agent_loop.py) — keeps the G-5 hot file agent_loop.py untouched (it does not import sandbox_manager), the session already exists at :868, and the SAME handler serves Deep + Harness so one seed site covers both. Guard via ctx._output_baseline_seeded (per-RUN not per-cell); run_in_threadpool-wrapped (D-v2.5-01).
- [Phase 120]: Phase 120-01 (COLL-01): snapshot_output_baseline SEEDS the existing SHA-256 hash-dedup baseline (no new filename heuristic — explicitly disproven by COLL-03-EVIDENCE §Refinement 1: the live 2 files shared ONE execution_id). D-120-02 honored — the helper never clears/deletes /sandbox/output/, is fully try/except-wrapped (empty/failure → {} = legacy behavior), and only stops RE-EMITTING pre-existing files. No schema/package change (stdlib hashlib/os/tempfile).
- [Phase 120]: Phase 120-02 (CTX-01): migration 076 AUTHORED only (NOT applied — Plan 03 applies + regenerates full-schema.sql); `messages.origin text NOT NULL DEFAULT 'deep'` + CHECK, no new RLS policy (inherits thread-owner policy, precedent 050). The DEFAULT 'deep' is load-bearing — fills legacy rows so the Deep neq() filter avoids the NULL three-valued-logic drop (Pitfall 1).
- [Phase 120]: Phase 120-02 (CTX-01): asymmetric origin filter extracted to module-level pure helper `_apply_origin_filter(history_q, agent_mode)` — Deep/Explorer neq('origin','harness') (replays deep + legacy), Harness eq('origin','harness') (strict, A1 defense-in-depth per D-120-06). A SINGLE shared WHERE clause (no per-provider fork); origin kept OUT of .select() projection (Pitfall 4) so _reconstruct_history is unchanged and pure-Deep threads return today's exact set (SC#4 byte-identical). Owner/thread .eq scope never relaxed (V4).
- [Phase 120]: Phase 120-02 (CTX-01): every enumerated HARNESS insert site tags origin='harness' (db/runs.py shared helper kwarg, harness_engine success/failure persists + raw expiry INSERT positional $4 (never f-stringed, T-120-06) + disposition prompt, phase_types llm_human_input prompt); api/runs.py ask_user_response is mode-aware (default 'deep', 'harness' ONLY on the confirmed workflow_runs-fallback branch, A2 safe-direction). api/threads.py:1020 user row UNTOUCHED (G-5); full-schema.sql NOT touched.
- [Phase 120]: Phase 120-03 (CTX-01): migration 076 APPLIED to the live DB (:54322) via psycopg2-direct (NOT db push/reset) — messages.origin NOT NULL DEFAULT 'deep'::text + messages_origin_check CHECK (origin IN ('deep','harness')) confirmed live; 658 legacy rows backfilled to 'deep', zero NULL (the load-bearing NULL-trap guard closed). full-schema.sql regenerated via scripts/regenerate-full-schema.sh (no --reset) — contains origin column at lines 615-616. Full Phase 120 test set green 21/21 (3 integration + 4 collision-regression + 14 origin-filter); the two prior PGRST204 test_093 failures (test_deep_runs_id_path_still_200, test_ask_user_answer_resolves_via_workflow_run_fallback) RESOLVED by the apply. The 3 test_sandbox_service TestHarvestOutputFiles failures are PRE-EXISTING (Phase 075.4 hash-keyed signature pivot, deferred-items.md), 0 net-new.
- [Phase 120]: Phase 120-03 (CTX-01) Rule 1 fix: the live-DB origin CHECK probe (test_120_migration.py) omitted the NOT NULL user_id column, so the INSERT failed on user_id BEFORE the origin CHECK was reached — a VACUOUS probe. Reuse the throwaway auth.users id for FK + NOT NULL so the CHECK genuinely accepts deep/harness and rejects 'other'. Lesson: live-DB constraint probes must satisfy every NOT NULL sibling column or the target CHECK is never evaluated (commit 035295a1).
- [Phase 121]: Phase 121-01 (IA-01): removed the Deep/Harness composer toggle + in-chat workflow picker → 2-pill composer (Model + General/Explorer); composer-stop is the post-removal Cancel (D-01, no new chrome); kickoffWorkflowId staging deleted as dead code but postMessage/doRun launch route untouched (SC#2/D-02); workflowLocked gating + mount reconcile + 409 banner preserved byte-identical (SC#3); tsc clean, no backend/migration (D-06/G-5).
- [Phase 121]: Phase 121-02 (IA-01): SC oracles bound as isolated test-only assertions — SC#1 2-pill (workflow-mode-selector + workflow-picker null, agent-mode + Model present), Cancel-reachability D-01 (composer-stop click → onStop), SC#3 (workflowLocked disable + 'Workflow running — Cancel to switch back' placeholder; getThreadWorkflow locked:true mount-reconcile disables; 409 test b byte-unchanged), SC#2 (ChatLayout doRun → createThread + postMessage{workflowDefinitionId} + onNavigate('chat')); RunCard tests untouched + GREEN
- [Phase ?]: Phase 121-02 (IA-01): reset workflowLockByThread in ChatAreaBanner beforeEach (Rule 1 test-isolation — the lock map is not mock-cleared so a locked reconcile bled into the next test); reconcile-lock mocks use mockResolvedValue not …Once because the mount reconcile effect can re-fire
- [Phase 122]: 122-01 (MP-02): emit_tier Literal[force_strict|force|coerce] is the single source of truth on every MODEL_CAPABILITIES row (D-122-04); 55 rows migrated 14/36/5; 2 DeepSeek DEMOTED to force (strict inert without /beta base_url, Pitfall 3); registry miss -> coerce (default-SAFE D-122-05). Old bools kept deprecated-unread for 1-phase rollback (no derived view re-reading strict_json_schema).
- [Phase 122]: 122-01 (MP-02): removed the hardcoded 'and provider == openai' strict gate (now tier-driven: json_schema response_format requested whenever strict_response_format is true) + the inert function-level DeepSeek strict loop in openai_service.py forcing branch; A4 preserved (OpenAI force_strict still emits json_schema response_format). Pitfall 5 seams (deepseek thinking-off, 111.1 local-provider) untouched; removed now-dead import copy (Rule 3).
- [Phase ?]: Phase 122-04 (TDP-01): TDP-01 is a PROMPT problem not a schema problem — the execute_code.description schema field (openai_service.py:601-603) is already strong; the fix is ONE ungated provider-agnostic nudge bullet in the shared SYSTEM_PROMPT (D-122-08, SC#4), one additive string no logic in G-5 hot file agent_loop.py, pinned by a string-presence guard.
- [Phase ?]: Phase 122-04 (TDP-01): NO Anthropic-specific extraction added — BUG-260528-03's stated cause is WRONG; tool_args_progress is already cross-provider in all 3 adapters, so the ungated SHARED-prompt nudge is the correct provider-agnostic lever (red line D-14 held, no shared-path fork).
- [Phase ?]: Phase 122-04 (TDP-01): exported humanize() (one word, no behavior change) to assert the bare-name floor (?? name) directly — no MEANINGFUL_TOOLS member is also absent from PRETTY_TOOL_NAMES (only execute_code, which has its own branch), so deriveWorkspacePanel() alone cannot exercise the floor; PRETTY_TOOL_NAMES NOT pre-emptively extended (D-122-08 — only if SC#10 UAT surfaces a bare name).
- [Phase 122]: 122-02 (MP-01): the force-coerce ladder lives IN forced_emit as a tier-scoped rung loop over _RUNGS_BY_TIER (force_strict→[strict_force,non_strict_force,coerce], force→[non_strict_force,coerce], coerce→[coerce]); a strict-400/truncation/no-emit DESCENDS to the next rung (continue) instead of short-circuiting to None (BUG-260615-01); all 4 consumers inherit it unchanged.
- [Phase 122]: 122-02 (MP-01): emit_rung telemetry added to the success dict + identifier-only logger.info; the ladder NEVER mutates the registry (D-122-03, runtime auto-demotion rejected). The Phase-103 strict override is preserved by DEMOTING strict_force→non_strict_force when strict=False; honest-fail floor returns emit_rung=None + the last rung's failure reason. 111.1 :251-291 injection block untouched (Pitfall 5).
- [Phase ?]: Phase 122-03 (MP-03): --forced-emit matrix is a DIRECT-CALL harness (imports forced_emit, drives it per provider x EASY/HARD schema) NOT body.model — body.model does not steer harness phases (Pitfall 6); no bearer/DB/agent-run (never writes), localhost gate in main() suffices, T-122-03-03 SQL surface N/A
- [Phase ?]: Phase 122-03 (MP-03): HARD schema (optional-heavy + additionalProperties confidence object) is the strict-rung trip-wire (Pitfall 1) making the recovery axis non-vacuous; recovery=PASS on any ladder win, force=PASS only on the declared TOP rung, trigger=FAIL on provider_error but honest_fail still PASS; DOCUMENTED clears the gate (D-122-07); the operator grep-before-tier-flip ritual is the MP-03 gate (NOT CI, D-122-06)
- [Phase ?]: Phase 123-01 (TRIG-03/D-01): LOAD_SKILL_POLICY lives in skill_lint.py (not agent_loop.py) so the Plan 03 Tuner classifier imports ONE source of truth — Pitfall 1 fidelity guard. agent_loop catalog note relaxed to fire load_skill on description match, reconciled with LOAD_SKILL_TOOL; owner-scoped catalog query preserved byte-for-byte.
- [Phase ?]: Phase 123-01 (TRIG-03): lint_description is pure/never-raises/warn-never-block (D-09); wired into POST+PATCH /skills + agent save_skill via the existing owner-scoped .or_() sibling fetch (excludes edited skill on PATCH, degrades to [] on read failure). openai_service NOT modified — already D-01-aligned. ZERO migration/package. 11 test_threads_skills failures verified pre-existing.
- [Phase 123]: 123-02 (CTX-03): trim_messages_to_fit gains a THIRD protected class — pinned load_skill groups (_extract_pinned_skill_groups) kept like the protected tail, de-duped to latest per skill, capped at PIN_BUDGET_FRACTION=1/3 of max_tokens, LRU-evict lowest-index over budget + honest _TRIM_MARKER; no-pins fast path = byte-identical pre-CTX-03 (G-5). Single trim path, no fork (D-14 RED LINE).
- [Phase 123]: 123-02 (CTX-03): _reconstruct_history tags load_skill tool-results with _pinned_skill IN CODE (gated on tc.get('name')=='load_skill', skill name from args with tool_call_id fallback) — never sniffs the result JSON (D-13), never hoists to system prompt. _atomic_groups mirrors _remove_oldest_atomic so a pinned group keeps its assistant+tool_calls parent (Pitfall 2).
- [Phase ?]: Phase 123-03 (TRIG-01): resolve_skill_builder_model (D-08) mirrors resolve_authoring_model — explicit setting (local id verbatim) -> first forced_emission default -> honest None; no paid-provider SPOF, decoupled from benchmark targets; surfaced on config.py Settings + UserEffectiveSettings.
- [Phase ?]: Phase 123-03 (TRIG-01): skill_tuner_service is thin orchestration over forced_emit (no agent-loop/raw-SDK fork, D-14); build_candidates/classify_fires use FLAT single-typed schemas + non-empty system_prompt; classify_fires embeds the shared LOAD_SKILL_POLICY (Pitfall 1 fidelity); honest-fail -> [] / would_load=False.
- [Phase ?]: Phase 123-03 (TRIG-01): pure scoring = deterministic 60/40 split + 3-repeat aggregate + pick_winner BY HELD-OUT (never train); every cell carries BOTH fires/no_false (042-A). configured_targets = presence-only probe, OpenRouter distinct from native deepseek/zhipu, N=1 clean baseline, local first-class. auto_seed does no I/O; fetch_owner_scoped_siblings carries the .or_(user_id.eq,is_global.eq.true) leak gate. ZERO migration/package.
- [Phase ?]: Phase 123-04 (TRIG-01): net-new owner-scoped skill_tuner.py router (start/stream/results) over the Phase-061+ run-buffer; service-role + .or_(own,global) sole leak gate, 404 on cross-user; tuner_progress/tuner_provider_done/tuner_complete vocab never overloads chat events.
- [Phase ?]: Phase 123-04 (TRIG-01): background run bounded on every axis (MAX_CASES=40/MAX_TARGETS=8/MAX_ITERATIONS<=5 + per-call get_per_call_timeout + one job per skill via _INFLIGHT_SKILLS->409); calls ONLY Plan-03 forced_emit service fns (D-14 red line); cases+scoreboard ephemeral at tuner_result:{run_id} run-buffer key, no DB schema change.
- [Phase 132]: Phase 132-03 (EVAL-01/VER-01): thin SkillTestCasesSection mounted in SkillDetailPanel gated on savedSkillId — deliberately non-designed (--skip-ui scope fence; reuses Input/Textarea/Button, no tabs/panel chrome) so it does NOT pre-empt the Phase 137/PANEL-01/G-2 sketch-gated Evals panel. 4 wire-mirror TS types + 5 fetch-client funcs mirror the existing skill funcs (getAuthHeaders→fetch→typed cast); owner-scoping enforced server-side (Plan 02 .eq(user_id)). createTestCase seeds an empty row filled inline+Saved. Operator G-4 UAT verified: add/edit/delete persist across reload, version increments on instructions change but NOT on enabled/global toggle (D-02). Pre-existing tsc -b rot (29 errors, unchanged by this plan) deferred per SEED-056.
- [Phase 123]: Phase 123-05 (TRIG-01): Trigger Tuner React surface + the reachability triad in ONE plan (App ActiveView 'skill-tuner' + tunerSkillId + onTuneSkill, ChatLayout skill-tuner mount branch, SkillsPage 'Tune triggers' entry action on the selected skill) — the Phase-118 built-but-unreachable lesson; SkillTunerPage is a focused full-surface entered WITH a skillId (GovernancePage/publish-gauntlet ActiveView no-router precedent).
- [Phase 123]: Phase 123-05 (TRIG-01): ProviderScoreboard (no-analog, 042-A) derives its N columns PURELY from the server-returned cells — a provider the org doesn't run is simply absent so it never renders (a score you can't act on is fabricated); N=1 is the clean baseline (no degraded affordance), OpenRouter≠native zhipu/z-ai, EVERY cell shows BOTH fires (recall) + no-false (the false-fire rail), never a hidden aggregate (T-123-05-01).
- [Phase 123]: Phase 123-05 (TRIG-01): author-confirm-not-auto-apply (042-A/D-03) — CandidateCard's Use→reveal-diff is NOT the write; updateSkill (PATCH /skills, re-lints) fires ONLY on explicit confirm. LiveRunCard: queued≠running (no fake percent, 043-A) + never-vanishing elapsed timer derived from a stable start-ts (the 095 lesson, frozen on terminal) + reconcile-on-return (terminal 'done' re-reads GET results, SSE tuner_complete a best-effort hint per D-v2.5-03). CaseEditor 60/40 split bar mirrors backend split_held_out. ZERO package/migration; chat subscribeToRun untouched (purpose-built streamTunerRun tuner_* reader). 14/14 vitest, tsc clean.
- [Phase ?]: Phase 123-06 (TRIG-03/TRIG-01): inline never-block lint in the SHARED SkillForm under Description (covers modal + 3-pane); 'Tune this' reuses the verified Plan-05 onTuneSkill navigator (D-12); onSave widened to Promise<Skill|void> to capture lint_warnings.
- [Phase ?]: Phase 123-06 [Rule 3]: wired skill_builder_model through the /settings router (FullSettingsResponse + SettingsUpdate + handler) + api.ts — Plan 03 added the field+resolver but NOT the router surface; the picker spans cloud+local (no paid-provider SPOF, test-proven). ZERO migration/package.
- [Phase ?]: Phase 123.1-01 (D-07): tuner_runs durable latest-per-skill persistence — on_conflict=skill_id latest-wins upsert (UNIQUE(skill_id), one row/skill) in run_in_threadpool (D-v2.5-01), best-effort try/except ALONGSIDE the Redis stash; survives a Redis flush/refresh (closes BUG-260624-01 HIGH #3). user_id=last-runner attribution, NOT an access gate.
- [Phase ?]: Phase 123.1-01 (D-05/D-08): two owner-gated GET routes — /tuner/runs/latest (registered BEFORE /runs/{run_id} so the literal beats the UUID converter; 404 cross-user owner-OR-global; rehydration-on-open) + /tuner/cases/seeded (provenance seeded/sibling never 'held'; owner-scoped sibling leak gate intact). seed_cases_with_provenance is a NEW fn over the unchanged string-only auto_seed_cases (run path untouched). Frontend getTunerLatest 404->null + getSeededCases. ZERO new pkg; red line held.
- [Phase ?]: Phase 123.1-02 (D-02/D-12): ProviderScoreboard restored to sketch-041 vertical full-width rows (was a cramped grid, BUG-260624-01 HIGH #1); per-row magnitude bar + leading combined score from the server TunerCell.score (previously unused), both honest sub-scores kept visible; server-score-only; unchanged API so Plan 04 reuses it for the D-04 standalone block.
- [Phase ?]: Phase 123.1-02 (D-11): CandidateCard descriptions line-clamp-3 with a shared useState Show more/less toggle across the header AND both diff-confirm sides (diff-current/diff-new); held-out score + Use action are siblings (never clamped) so a ~1500-char description never buries them (BUG-260624-01 MED #5); CandidateCard tests split into CandidateCard.test.tsx.
- [Phase ?]: Phase 123.1-03 (D-09/D-10): Skill-builder picker now derives options from configured providers[].models across ALL providers (grouped as optgroups via PROVIDER_META labels w/ id fallback), replacing the hardcoded SKILL_BUILDER_MODEL_OPTIONS — strong models (Sonnet/Opus, GPT-pro) selectable. Auto value="" default kept pre-selected (NOT forced) + custom-persisted "(current)" branch guarded by a builderConfiguredModels Set (no duplicate row). IN-02 placeholder local ids (lm-studio/qwen3, openai-compat/local-model) removed — local models come from real providers. SOFT amber "unverified" hint mirrors the Active-Model chip via verified_models; NEVER hard-disables an option; A4 honored (no new forced_emission_models field, verified_models signal reused). Stored field/contract (app_settings.skill_builder_model) + resolver unchanged. No-SPOF footer rewritten to a provider-derived line. 7/7 vitest, tsc clean.
- [Phase 123.1]: Phase 123.1-04 (D-03/D-04/D-05/D-06/D-07/D-12): integration wave wired Plan-01 GET routes + Plan-02 ProviderScoreboard into SkillTunerPage. Mount reconcile-via-fetch effect: getSeededCases hydrates the editor with real seeded/sibling provenance (editable before run, startRun POST-body unchanged so edits run verbatim); getTunerLatest rehydrates the durable scoreboard on open (null/404 = graceful empty, no error); getSettings resolves the configured-target count (has_key && non-empty models, mirroring backend configured_targets). held tag RESOLVED by DROPPING it from the EditorCase union (split bar owns train/held-out). D-04 standalone block = scoreboard.candidates.find(c=>c.is_baseline) rendered via the Plan-02 component. Layout widened to 360px config rail + full-width results. previewModelCount precedence: in-flight targets -> persisted target_count -> live configured count. subscribeToRun untouched (WR-06 red line).
- [Phase ?]: Phase 123.1-05 (BUG-260624-01 #1): MAX_SEEDED_SHOULD_NOT=8 caps the sibling-sourced should_not inside auto_seed_cases (the SOLE place) so the run path + editor seed share ONE capped set (editor shows exactly what runs); a pure post-fetch slice of the already-owner-scoped fetch_owner_scoped_siblings output — never re-reads DB / never widens scope. Generic off-topic baseline ALWAYS kept in full.
- [Phase ?]: Phase 123.1-05 (D-honesty): GET /tuner/cases/seeded returns top-level total = uncapped sibling count (derived from len(sibling_descs), not the capped base); CaseEditor cap banner shows 'showing N of M — capped' ONLY when total > shown sibling-provenance count (never silent); 'show all N' is an honest disclosure, never fabricates the withheld cases.
- [Phase ?]: Phase 123.1-05 (sketch 045-B): pre-run layout = full-width single-column stack (description -> CaseEditor -> run bar) driven off existing runPhase + scoreboard (no new mode machine); editor stays mounted so author can re-edit + re-run; results render full-width below; ProviderScoreboard/LiveRunCard/CandidateCard reused untouched.
- [Phase 123.1]: 123.1-10 (TT-10): silenced the langsmith logger to ERROR at module scope next to the asyncio suppressor (scoped to langsmith only; ERROR-and-above still surfaces; tracing not disabled) + documented an optional commented-out LANGSMITH_TRACING_SAMPLING_RATE knob in .env.example (no Settings field — the client reads it from os.environ via load_dotenv)
- [Phase 123.1]: 123.1-06 (TT-05/12/15): tuner build_cell renders an empty axis as the unmeasured sentinel None (frontend 'n/a'), never a fabricated 1.0; an all-error column (every classify raised) is measured=False + EXCLUDED from the persisted target_count; cell_score returns the single stored cell['score'] verbatim (no recompute drift). _score_axis floor + held-out math + gateway untouched.
- [Phase ?]: Phase 123.1-07: TT-07 — _run_tuner_job emits stage='provider_start' (provider+model) at each column start via the tuner's OWN _emit_tuner (not the shared runs.py consumer); the frontend onProgress flips the matching lane queued->running on it
- [Phase ?]: Phase 123.1-07: TT-08 — DELETE cancel route is owner-verify THEN run<->skill bind (404 cross-user/foreign run_id, mirrors CR-01), sets a TTL'd tuner_cancel:{run_id} flag + releases the inflight claim; job checks the flag at candidate AND provider loop tops, skips winner/stash/durable upsert when cancelled, still runs its finally cleanup
- [Phase ?]: 123.1-08 (TT-12 render half): unmeasured tuner cell renders 'could not measure' from the server measured/null sentinel, never a fabricated 0.00 or 1.00 axis
- [Phase ?]: 123.1-08 (TT-16): reconnect-exhaustion keeps 'still running' ONLY when durable getTunerLatest.run_id === active run; a null/404 or previous-run row still hits the retained 'Lost connection' terminal (no stuck run)
- [Phase ?]: Phase 123.1-09: TT-11 — removed both decorative w-16 shrink-0 bg-sidebar rails (SkillsPage + SkillTunerPage); content keeps existing px-8 so it sits flush against the real NavPanel; real NavPanel (ChatLayout.tsx:289) untouched; tsc clean
- [Phase ?]: Phase 123.1-09: the SkillTunerPage rail survived the 123.1-05/07/08 restructure (relocated to lines 494-495) and was still present — removed here as the primary path, not the reconcile fallback the plan anticipated
- [Phase ?]: 138-04: TODOS panel reconciles LIVE on a clean run terminal via _reconcileTodosOnTerminal (fetch-on-terminal per D-v2.5-03); reuse-only, clean-completion-gated, best-effort, additive-only on G-5 StreamsProvider.tsx. Closes VERIFICATION must-have #5 code side; live UAT owned by 138-05.
- [Phase ?]: 143-02: owned_only additive default-off param on list_published_workflows (Published shelf narrows to mine; picker/WorkspacePanel/threads.py keep globals default — D-143-2b); Starters shelf = own list_starter_workflows curated-globals query + GET /workflows/starters
- [Phase ?]: Phase 143 Plan 03: 3 curated starters authored as seed migration 094 with DISTINCT slugs (pm-* would UNIQUE-collide); promote = TRANSFORM (strip folder binding+scope, re-home template to seed _library, category='starter', keep strict citation gates); storage bytes via scripts/seed-starters.py --upload
- [Phase ?]: Phase 143 scope-narrowing threaded as a 3rd positional options param on listPublishedWorkflows (not a 2nd-arg options object) so WorkspacePanel's signal-as-2nd-arg call stays byte-identical (D-143-2b)
- [Phase 146-01]: operator_users carries NO org_id (D-06 org-agnostic principal) — protects the v3.4 one-way door
- [Phase 146-01]: operator_audit_log.action is free-text with NO CHECK (A4); actor is PLAIN uuid NO FK (tamper-resistant, mig-059 idiom)
- [Phase 146-01]: org_id stubs on documents/folders/threads/skills with NO index — harness_audit shape per D-05, not the DM-era indexed shape
- [Phase ?]: Phase 146-02: require_operator is a ROUTER-level gate returning a byte-identical 404 on non-membership (non-discoverable, sole authority, no RLS backstop); old BACKPRESSURE_ADMIN_USER_IDS + dev fail-open deleted (D-02), OPERATOR_EMAILS replaces it.
- [Phase ?]: Phase 146-02: operator_audit_floor is a per-action yield-dependency (probe-EXEMPT) writing one append-only row per gated action; membership seam is asyncpg (patch _pg_pool in tests, not the supabase mock — Pitfall 6).
- [Phase ?]: 146-04: operator probe is render-only (getOperatorProbe 404→null); backend require_operator 404 gate stays the sole authority (Pitfall 13)
- [Phase 146]: 146-05: shipped the five Control Room presentational leaves (OperatorBand/HealthSignals/LockedTab/TechnicalNamesToggle/RecentActionsCard) — sketch winners 061-B + 062-A, pure prop-driven leaves typed against the Plan-04 api.ts contract, composed by the Plan-06 shell
- [Phase 146]: 146-05: LockedTab keeps NO phase-number token in shipped copy OR source comments (T-146-10 grep treats any 'phase 1xx' substring as a leak); amber operator zone uses Tailwind amber-* tokens (StatusPill precedent), not a bespoke warning utility
- [Phase 146]: Control Room reachable via the probe-gated shield rendered OUTSIDE NAV_ITEMS (D-07 byte-identity, regression-locked); the 061-B shell's manual ↻ Refresh honesty beat (no auto-poll) visibly prepends the operator's own 'Viewed system health' ledger row (D-04/D-08)
- [Phase ?]: 148-01: Nyquist Wave-0 scaffold — 14 RED test_148 files + banned_user/feature_visibility fixtures; wave-ownership split
- [Phase 148]: 148-04: governance_service.py cross-user reads (query_platform_audit, list_users_roster) swallow-and-log to [] (best-effort feed); only the CSV over-cap refusal (AuditExportTooLarge, >_CSV_MAX_ROWS=50000) propagates as a deliberate 4xx — never truncates. Every filter a NULL-guarded $N bind (user scope / action_type text[] ANY / half-open [since,until) window); page_size clamped <=100 at the service boundary (SC#4 no-full-tenant-leak).
- [Phase 148]: 148-04: export CSV returns the COUNT-probe value as the exact filtered count (not len(rows)) — the authoritative set size that gates the cap and 148-06 stamps onto audit.export; belt-and-suspenders LIMIT (==cap) never truncates a validated under-cap set. grant_operator idempotent ON CONFLICT DO UPDATE re-stamps granted_by; revoke_operator refuses self-revoke (409) BEFORE any pool access (Pitfall 7 lockout-proof).
- [Phase 148]: 148-04: skipped requirements.mark-complete for ADMIN-03 — service layer built + unit-tested (10/10 service tests GREEN) but not yet wired to any router (148-06 endpoints / 148-07 UI); marking now would be false-green. Completes at phase verify-work (mirrors 148-02 substrate posture). Controller-level tests (disable/enable/view_platform_recorded) stay expected-RED, owned by 148-06.
- [Phase 148]: 148-05 (VIS-01): require_visible attached at ROUTER level for the no-carve-out governed routers (evals.py both routers, skill_tuner.py, skill_test_cases.py, document_governance.py) so EVERY endpoint is gated safe-by-construction (require_operator precedent — a future endpoint cannot forget it); PER-ENDPOINT (decorator dependencies=[]) only on the carve-out routers settings.py (4 model_management gates) + workflows.py (6 workflow_authoring gates), because router-gating them would 403 the Run carve-outs (RESEARCH anti-pattern is scoped to exactly those two files). GET /settings/providers, GET /workflows/published|starters, and the threads.py workflow launch left ungated (Run stays for everyone — D-05); threads.py untouched.
- [Phase 148]: 148-05: skipped requirements.mark-complete for VIS-01 — the API enforcement WALL is done (GET /features + require_visible gates GREEN) but VIS-01's frontend hide/bounce half (148-07) is unshipped; marking now would be false-green. Completes at phase verify-work (mirrors the 148-02/148-04 substrate posture).
- [Phase 148]: 148-03 (VIS-01): operator applied migration 098 to the live LOCAL DB via the SQL editor (NEVER db push/reset — preserves dev data); full-schema.sql regenerated (no --reset, live-DB dump) — feature_visibility jsonb column captured at line 468, a 1-insertion dump delta not a hand-edit (commit edfcc1a0). CLOUD PARITY: mig 098 (column + D-05 seed UPDATE) MUST be pasted into the CLOUD Supabase SQL editor at the next promotion — local + cloud each carry their own app_settings.global row (docs/DEPLOYMENT-WORKFLOW.md §5 parity checklist + the standing v3.3 cloud-migrations rule; mirrors mig 097). Skipped requirements.mark-complete for VIS-01 (multi-plan feature; marked at phase verify-work — same posture as 148-02/04/05).
- [Phase 149]: 149-11: agent_loop pre-injection gate now fires for compat-path STRUCTURED (operator native_tools=False OVR) via _should_pre_inject_structured — warmed by get_model_capability_async before the sync resolve_calling_mode read; anthropic/google native-SDK excluded (WR-05); openrouter+xml and no-override paths byte-identical (D-14).
- [Phase 149]: 149-12: suggestion chips strip <think> reasoning blocks before the line-parse (module-private _strip_think_blocks mirrored from the threads.py sibling, not imported — avoids api->service inversion + G-5 hot-file import); strip runs BEFORE clamp-to-3 so reasoning never fills chip slots; closes round-2 UAT Test-7 minor gap on the D-149-10 fallback path.
- [Phase 159]: D-159-01 realized (159-01): UTILITY_MODEL_EXCLUDE is the single shared chat-filter constant; curate imports it; discovery new entries carry a display-only utility tag that never mutates the confirmable diff (SC#3).
- [Phase 159]: 159-06 (D-159-04): the discovery suitability filter is DISPLAY-only — `visibleNew`/`hiddenNewCount` feed the render only; `accepted`/`enableNow`/`drafts`/`buildChanges` still read the FULL `result.new`, so a hidden utility model stays in the confirmable payload (SC#3 / T-159-13, test-locked). Default-on, persisted via `handleSetDiscoveryFilter` → `setFlag("model_discovery_filter_enabled")` → settings re-fetch; honest "N utility models hidden" + a non-destructive ephemeral "Show all".
- [Phase 159]: 159-06 (D-159-03): family-default pre-fill via draft-SEEDING on run (`seedDraftsFromDefaults`) — `isComplete`/`buildChanges` unchanged; `enableNow` stays default-off so `buildChanges` yields `enabled:false` (never auto-enable, T-159-12). "default — confirm" keyed on the static `familyDefaults(id)[field]!=null`; `native_tools` maps true→native / null→unseeded, never "none" (SC#3 by construction). All 6 plans shipped; MODEL-03 flips at `/gsd:verify-work 159` (phase-spanning STRETCH, false-green-avoidance).
- [Phase 160]: D-v3.4-01: Tenancy-Model ADR ratifies D-PRD-02 co-tenant + isolation-via-deployment posture + the binding 4-tier deployment-flexibility contract (per-phase enforcement 161-173; SEED-120 forward-compat); locks is_system_global / is_org_shared / slot 104+ naming for phases 161-168. ADR: .planning/phases/160-tenancy-model-adr/160-ADR.md
- [Phase 161]: Plan 161-01: authored mig 104 (org/dept/role schema) — 8 org tables + current_user_org_ids() 42P17 recursion-break helper + membership-correct RLS + seeded 4-tier permission catalog + 23-table nullable org_id sweep. Authored, NOT applied (Plan 02 applies/verifies).
- [Phase 161]: 161-02: migration 104 applied live + proven on the running DB — 42P17 non-recursion holds (SELECT count(*) FROM org_members = 0, no SQLSTATE 42P17); 8 org tables + RLS + 3 SECDEF helpers + D-02 seed catalog all live; full-schema.sql regenerated (head 104).
- [Phase 161]: full-schema.sql is schema-only — roles/role_permissions seed lives in migration 104, NOT the bootstrap artifact; 104 owed at next cloud push with 099-103; OPERATOR.md Step-3 registration deferred (check-deploy-drift PASS; 093/094/098 precedent).
- [Phase ?]: 162-01: authored mig 105 personal-org-backfill (§A provisioning loop + §D defensive handle_new_user trigger + §B batched-COMMIT procedure across 35 tables + §C 35 self-guarded NOT-NULL flips); committed per-task (author-only) — live apply + full-schema regen is Plan 162-02
- [Phase ?]: 162 (D-11 resolved): operator_audit_log EXCLUDED from org_id backfill + kept NULLABLE (no owning auth.users); 163 RLS must handle its NULL org_id. metadata_field_definitions gets a guarded (not unconditional) NOT-NULL flip — flips iff apply-time zero-NULL (A1 cloud caveat)- [Phase 162]: 162-02 (MIG-01 COMPLETE): mig 105 applied to LOCAL via psycopg2 autocommit (never db push/reset); SC#1-4 PASS — 8 users -> 8 personal orgs + default depts + org-admin memberships, 0 dup, 0 multi-default, zero SC#3 row/census delta, idempotent re-apply; only operator_audit_log stays org_id-nullable; metadata_field_definitions flipped NOT NULL. Cloud owed at next operator push (099-105 + SECRETS_ENCRYPTION_KEY).
- [Phase 162]: 162-02 apply-time deviations: Bug-1 page runs by run_id + user_settings by user_id (neither has an id column); Bug-2 surgically DISABLE/ENABLE the skill_versions + workflow_definitions immutability triggers around their one-time backfill CALL (re-enabled immediately; cloud-safe via table ownership). Rule 1/2: full-schema supplement handle_new_user was stale pre-105 and clobbered the extension in a greenfield paste -> updated supplement to mirror mig 105 §D.
- [Phase 162.5]: Plan 02 extracted workflow-kickoff machinery (kickoff preflight + harness run-context build) to workflow_kickoff.py; threads.py 2119->1851 LOC, byte-identical, app.api.threads.* patch surface preserved via D-A4 late imports
- [Phase ?]: D-A3 unification (162.5-03): producer _shielded_finalize + continuation _finalize collapsed onto ONE shared run_producer._finalize_producer_run; harness-F2 + cap_paused divergences are params not a forked order; the two finalize orderings can no longer drift
- [Phase ?]: 162.5-03: threads.py 2444->1214 LOC; producer heart is now a parameterized run_producer() seam for Phase 163 org_id threading (TEN-02); agent_loop.run_agent_loop byte-unchanged (Deep red line)
- [Phase 163]: 163-01: SET-LOCAL role-swap+both-GUC sequence extracted to _apply_rls_user_context, imported by both get_user_pg_connection and the test harness (zero drift).
- [Phase 163]: 163-01: get_service_role_supabase raises ValueError on falsy org_id (refuse-without-scope); get_user_supabase builds a per-request ANON-key+Bearer client and never mutates the service-role singleton.
- [Phase 163]: 163-01: live auth.uid() on :54322 reads legacy request.jwt.claim.sub first then JSON request.jwt.claims — both-GUC-forms is variant-independent (D-02).
- [Phase 163]: 163-02: mig 107 slot inverted to 107=TEN-04 (before 108=RLS) — 108's document_chunks/skill_embeddings predicates reference the org_id column 107 adds; Postgres applies migrations in integer order so the column lands first
- [Phase 163]: 163-02: TEN-04 kept Pending — plan 02 AUTHORS mig 107 + test_163_ten04_backfill (RED) only; applied plan 05, CONCUR-01-benchmarked plan 09/10. skill_embeddings backfill pages on skill_id (no id col); btree(org_id) default, HNSW/GIN untouched
- [Phase ?]: 163-03: migration 108 rewrites all 37 user-facing tables (97 policies, 6 sectioned clusters) to org_id IN (SELECT public.current_user_org_ids()) AND (owner OR preserved-global) — INERT under BYPASSRLS, applies AFTER 107; TEN-01 enforced only after plan-05 apply + Wave-4 client swap
- [Phase ?]: 163-03 DEVIATION: profiles kept owner-only (auth.uid()=id, NO membership macro) — no org_id column live (mig 104 excluded it); a membership prefix would abort the migration at apply (Rule 1/3)
- [Phase ?]: 163-03: global OR-branches (folder_is_globally_visible / is_global / EXISTS-on-skills) preserved verbatim but now membership-gated; audit_log carries explicit org_id IS NULL branch (D-10); 6 cluster tests RED until apply
- [Phase ?]: 163-04: D-08 leak core authored (15 tests, RED until 163-05 apply) — fail-loud auth.uid() preflight FIRST guards against a wrong-GUC-variant false-pass at 0 rows; role-swap-noop 1->0 diff proves SET LOCAL ROLE (not claims) turns RLS on; GUC arbitration hard-asserts only the both-forms default
- [Phase ?]: 163-06 THE FLIP: chat/streaming hot path swapped to per-request user-JWT clients (RLS is now the real gate); producer/agent-loop writer stays service-role (D-05, run_producer byte-unchanged); agent_loop.py+gateway byte-unchanged (D-09); blocker T-163-06c fixed (preflight workflow_runs read under RLS); TEN-02 ADVANCED (completes after 07/08 swaps + CONCUR-01 bench)
- [Phase ?]: 163-07: documents/DM cluster request handlers now enforce RLS via the user-JWT client (primary gate on document/folder CRUD); global-folder + is_global branches preserved. Detached ingestion BackgroundTasks (pdf_extraction_runs has no authenticated INSERT policy), audit_log analytics (knowledge_health), the cross-user existence probe (governance broken-relationships), and cross-user operator reads (governance_service) kept classified service-role.
- [Phase ?]: 163-08: skills cluster (23 handlers) -> user-JWT (RLS gate; is_global/is_system preserved via test_163_rls_skills); eval PURE READS (6) swapped, eval writes/reconcile/runner + workflow cluster + audit_log reads + app-level settings kept classified service-role (no authenticated write/SELECT policy / Run-carve-out / shared harness module / RLS-off); plan-09 async writers untouched
- [Phase ?]: 163-09: D-05 CLOSED — eval-runner/harness-resume/golden-run-publish/re-embed/skill-backfill route through get_service_role_supabase(org_id) + widen .eq(user_id) org-aware; org_id resolved self-contained from the entity each writer processes; org_id=None => byte-identical (D-14 filters kept); _reembed_adapter.or_() fixed to unblock the two-user isolation proof
- [Phase ?]: Phase 164-02 (TEN-06/SEED-091): one shared _null_foreign_global_owner rule ((is_global OR is_system) AND not-owner -> user_id=None) across folders/skills/views serialize paths; +folder_scope=None on global views; +skill_files A3 loosen/null; FolderResponse/SkillResponse/SkillFileResponse.user_id -> UUID|None. Frontend Folder/Skill.user_id stays hard-required string -> flagged follow-up.
- [Phase ?]: 164-03: migration 110 applied live to :54322 — 4 SECDEF fns org-scoped in-body (current_user_org_ids/auth.uid, never match_user_id) + search_path='' + OPERATOR(public.<=>); match_skills is_system OUTSIDE the gate; document_chunks SELECT RLS widened (PRAG-01). All 18 exit-gate legs GREEN; CONCUR-01 15ms. TEN-03/PRAG-01 = SQL half only, complete at 164-04.
- [Phase ?]: Phase 164-04 (D-164-02): producer retrieval RPCs + text-to-SQL/grep query_user_documents run over the Phase-163 asyncpg get_user_pg_connection user-context via a shared retrieval_service._call_as_user seam — never the request JWT (expires mid-run) nor service-role (auth.uid()=NULL → 0 rows).
- [Phase ?]: Phase 164-04 (D-164-04): _inject_user_id + _inject_user_id_for_grep DELETED — RLS on the INVOKER query_user_documents over the user-context is the cross-user gate; _inject_folder_scope + SELECT-only/no-semicolon guards RETAINED; query_user_documents NOT made DEFINER.
- [Phase ?]: Phase 164-04: asyncpg has no pgvector codec — embeddings formatted as '[...]'::public.vector (_vector_literal); id/document_id cast ::text for str-key parity with the old PostgREST JSON. Deep Mode byte-identical (DB-connection-seam swap only, no provider fork, D-14).
- [Phase ?]: 168-02: SSO provider-CRUD = ONE async service, TWO env-selected transport adapters (Cloud Management API vs self-hosted GoTrue); identical body, fail-closed on non-2xx, delete-via-API-first; mgmt token decrypted at call time (Phase-150 cipher), never logged. SSO-01 stays Pending (delivered across plans 02-06).
- [Phase ?]: 168-03: require_sso_manage = strict active-org, sso:manage-gated mirror of require_org_invite; provision_sso_membership hardcodes role='member' ($3 bind, no param, never a SAML attr — D-168-03/T-168-03), keys on (org_id,user_id) UUID (T-168-08), BYPASSRLS pool
- [Phase 168]: 168-04: /org/sso/route is a fully-public (zero-auth) boolean-only active-only domain lookup (anti-enumeration T-168-10); a 403 there would lock out all login via Plan 06
- [Phase ?]: 168-05: canManageSso is fail-closed render-only (SSO tab); require_sso_manage is the wall (T-168-06)
- [Phase ?]: 168-05: signInWithSSO redirects the browser MANUALLY (window.location.href); supabase-js does not auto-navigate (D-168-02); password path untouched (SC#3)
- [Phase ?]: 168-05: SSO callback fires provisionSso() once then a reprobeNonce bump re-probes /org/me so the JIT-joined org resolves in the switcher (D-168-04)
- [Phase 168]: 168-06: SSO tab live + identifier-first login fails OPEN to password on any route-lookup failure (T-168-07) — no lockout; SSO-01 COMPLETE
- [Phase ?]: Phase 175-01: reasoning_off marked per-MODEL across the whole docs-confirmed-SAFE set (13 rows), not per-provider-default
- [Phase ?]: Phase 175-01: XPROV-03 folded gate fires only on a CONFIDENT known-provider mismatch (excludes fallback bucket); sub_agent_service.py (4th site) byte-frozen keeps its own guard — D-03 coverage is 3/4
- [Phase ?]: 175-02: DSML stream-end flush (deepseek-gated, D-14) + honest leak signal via the EXISTING error SSE event through an Option-B post-drain hook
- [Phase ?]: D-175-03-01: reasoning_first STRUCTURED gate sits ABOVE db_native in resolve_calling_mode — the hard gpt-5.6 tools+reasoning 400 constraint wins over an operator native_tools=True override (XPROV-01 D-01)
- [Phase ?]: D-175-03-02: reasoning_tools_unsupported detection anchors on structured body[error] signature (message substrings / param==reasoning_effort), never str(exc) — a crafted message cannot misclassify an unrelated 400 (XPROV-01 D-04)
- [Phase ?]: Phase 176-01 RENDER-01 (D-05b): dup user bubble is born in the reconcile merge — dropped via a content-supersede check (supersededByPersisted) in the untyped-temp preserve branch; 075.7 preserve held (D-06)
- [Phase ?]: Phase 176-01 RENDER-02 (D-07): mount-path onTerminal mirrors the send-path content-reconcile keyed on run.run_id — backgrounded run un-folds live, no reload; content-only swap; send-path untouched (D-14)
- [Phase ?]: 176-02 (RENDER-04): live version pointer fix is a frontend refetch only — refreshVersions mirrors refreshGate + a versionsNonce, no migration/no realtime (D-12/D-16)
- [Phase ?]: 176-03 (EXEC-01): declared execute_code libraries install via python -m pip (system interpreter, non-stream => reliable exit_code), retry x1, never swallowed — replaces the venv-targeted failure-swallowing session.install (D-01/D-02.1)
- [Phase ?]: 176-03 (EXEC-01): undeclared ModuleNotFound auto-heal (install + threadpool-wrapped re-run once) bounded 1-per-module-per-RUN via a per-run Redis set heal_attempted:{run_id}, graceful call-local fallback; read+written entirely in tool_dispatcher.py — no ctx field, no agent_loop touch (D-02.2/D-04)
- [Phase ?]: 176-03 (EXEC-01): honest install_failed note on the model-facing llm_content only; persisted/UI tool_result stays a normal error — mirrors the runtime_gap pattern (D-03)
- [Phase 182]: 182-01: the ONE shared grounding source is backend/app/services/harness/grounding.py, NOT reachability.py — grounding touches the DB (folders/skills) and would poison reachability's documented pure-import property (Pitfall 1); it is also deliberately NOT re-exported from harness/__init__.py
- [Phase 182]: 182-01: one rule set, two presentations — grounding_verdicts() APPENDS per-node verdicts for /validate while _check_grounding_fidelity() SHORT-CIRCUITS to the historical {ok,error,detail} dict for NL-gen — both call the same three atomic helpers (_folder_scope_violation / _unregistered_tools / _unregistered_skill_ref) so no grounding rule can drift (D-182-02 / D-182-06 red line)
- [Phase 182]: 182-01: the NL grounding prompt is pinned byte-for-byte by an explicit golden literal in tests/test_182_extraction_parity.py, plus exact-literal COUNT guards (2 + 6) on the Phase-103 backstop suites — the golden is never re-derived from the renderer, so a reworded heading or a squashed blank line fails; the count guard is the Phase-177 coverage-loss lesson (a failures-only differential cannot see a DELETED test)
- [Phase 182]: 182-01: VALID-01 stays Pending after plan 01 — marked complete at the END of phase 182, not per-plan — the requirement text ('the server exposes POST /workflows/validate') only becomes true when 182-02 lands the route; all three 182 plans share VALID-01, so a per-plan mark-complete would create a false traceability record
- [Phase ?]: 182-02: /validate + /grounding-bundle gate on require_canvas ALONE (never stacked with require_visible, whose 403 leaks route existence); both declared as STATIC segments ahead of every /{definition_id} route
- [Phase ?]: 182-02: /validate CLASSIFIES only — severity is the route's single interpretive layer; no_terminal splits incomplete(empty draft) vs error(unreachable terminal); ok == (verdicts == []) so an incomplete-only set still blocks
- [Phase ?]: 182-02: VALID-01 marked COMPLETE — its text (server exposes POST /workflows/validate reusing lint_workflow + grounding fidelity verbatim) is literally true as of this plan; 182-03 adds no route so a re-mark there is idempotent
- [Phase ?]: 182-03: the 181 /canvas/ping canary is RETIRED (D-182-04) — its 404-when-off assertions were MIGRATED onto the real routes, never dropped; every future canvas route must append its own 404-when-off probe to test_revert_byte_identical.py
- [Phase ?]: 182-03: require_canvas 404s from TWO steps (flag off, and flag-live-but-caller-None) — a 404-when-off test that does not monkeypatch authenticate_canvas_request tests the anonymous fold, NOT the flag; the new authenticated-operator test injects the caller so D-181-01 step order is actually pinned
- [Phase 182]: D-182-04a: FolderScopeSubsetError subclasses ValueError so all 4 pre-existing except-ValueError callers keep working by construction; super().__init__(message) keeps str(exc)/args byte-identical
- [Phase 182]: D-182-04b: the folder_scope slug travels on a typed exception attribute (phase_slug), never by regexing the message — a source-text forbidden-token guard test pins the D-182-06 red line
- [Phase 182]: D-182-04c: except ValueError in grounding.py deliberately NOT narrowed to the subclass + slug read via getattr(..., None) — a plain ValueError degrades to phase: None instead of a 500 on the always-HTTP-200 /validate route (T-182-10)
- [Phase ?]: Phase 182-05: WR-08 (require_canvas-alone auth asymmetry on /validate + /grounding-bundle) REJECTED — D-182-05 locks the posture; require_visible's 403 would leak route existence and break the byte-identical-404 REVERT gate. Recorded in 182-DECISION-NOTES.md. WR-03/WR-04/WR-07 deferred as SEED-130/131/132 with concrete Phase-184/185 re-open triggers.
- [Phase 182]: publish_workflow enforces grounding fidelity at stage 2.6 via the SHARED grounding_verdicts collector — /validate and publish now provably report the same findings (agreement test); fails CLOSED on an unresolvable registry; create_draft/update_draft deliberately NOT gated
- [Phase 182]: 182-07 (WR-05): /validate's _severity fails CLOSED — an unrecognised verdict code classifies 'error' and logs a WARNING naming it, never the soft 'incomplete'. A wrongly-red verdict is visible and gets fixed; a wrongly-grey one silently misleads the author into a publish block.
- [Phase 182]: 182-07: verdict-code vocabularies are OWNED by the emitting module (reachability.LINT_CODES / grounding.GROUNDING_VERDICT_CODES). Downstream classifiers COMPOSE the known set; _ERROR_CODES is derived set arithmetic with no duplicated literal, and paired source-scanning drift detectors (falsified, plus a teeth self-test) enforce the pairing.
- [Phase 182]: 182-07: grounding_unavailable's canonical home is publish_service.py — publish-only, deliberately NOT composed into /validate's _KNOWN_CODES since /validate calls grounding_verdicts directly. Pinned by a boundary test that fails if publish ever mints a second unowned code.
- [Phase 182-08]: D-182-R2-01 implemented as a pre-routing pure-ASGI CanvasGateMiddleware (registered FIRST = INNERMOST, inside Setup+Maintenance, under CORS); gates on PATH ONLY and normalizes one trailing slash, so the flag-off canvas is byte-identical to an unbuilt path for every method and for hostile input
- [Phase 182-08]: D-182-R2-02 hides the canvas from /openapi.json via a request-time app.openapi hook (include_in_schema=False rejected — it would hide the routes from /docs even while ON); the removal set is derived from the ref graph, and the filtered doc is deep-copied per request and NEVER written to FastAPI's schema memo
- [Phase 182-08]: CANVAS_GATED_PATHS in backend/app/middleware/canvas_gate.py is the ONE registration point for canvas non-discoverability — Phase 183+ adds a route's absolute path there in the SAME commit that mounts it; Depends(require_canvas()) stays on every canvas route as defense in depth (D-182-05)
- [Phase 182-09]: WR-08 closed — require_canvas publishes the identity it already validated on request.state.canvas_caller and both canvas handlers consume it via Depends(canvas_caller) instead of re-running get_current_user. One token validation per canvas request instead of two (2 GoTrue round-trips + 2 auth.users ban queries -> 1 of each, on a route that fires on every canvas edit). Falsified: reverting the two route deps observes exactly 2, with the SAME token string twice.
- [Phase 182-09]: canvas_caller fails CLOSED onto the SAME _NOT_FOUND every deny path in the gate raises — never 500 (itself an existence signal on a route contracted to be byte-identical to an unbuilt one), never 403 (D-182-05 forbids it outright), never 401 (CR-01's leak channel). Falsified: removing the request.state assignment yields 404, not 500.
- [Phase 182-09]: run_in_threadpool applied to the CANVAS auth read ONLY (D-v2.5-01) — the shared get_current_user is deliberately untouched (every route in the app depends on it) and that non-goal is recorded in authenticate_canvas_request's docstring, so the asymmetry reads as a scoped decision rather than a missed site.
- [Phase 182-10]: WR-04 closed — the folder_scope subset walk MOVED into a non-raising scope.folder_scope_violations; assert_folder_scopes_subset is now a thin presentation that re-raises violations[0], so caller parity (type/str/args/phase_slug) holds by construction
- [Phase 182-10]: WR-03 (narrowing the broad except ValueError in the grounding folder_scope helpers) deliberately DEFERRED and recorded in the source as a decision — out of this round's operator-selected scope
- [Phase 182-11]: WR-01 closed — `_skill_registry`'s fail-closed swallow MOVED up to `assemble_grounding_bundle` and became `GroundingBundle.degraded`. One signal, both consumers branch identically; propagating the raise instead would have given /validate and publish two independent chances to describe the same failure differently. Falsified: restoring the swallow reproduces the exact false verdict `{'code': 'unregistered_skill', 'phase': 'answer', 'message': "... non-registered skill_ref '3333…'"}` — an outage in the log, an accusation on the wire.
- [Phase 182-11]: WR-02 closed — the two grounding I/O stages of `/validate` are SEALED, so a non-ValueError postgrest APIError returns a structured 200 instead of a 500. The seal is SCOPED: lint, the D-13 business-requirement check and the interactive-phase check stay OUTSIDE it, so a registry blip costs three rules and not the whole validation. Falsified: removing the seal makes the injected exception ESCAPE the handler.
- [Phase 182-11]: WR-07 closed at the two gate call sites — `fetch_all_folders`/`fetch_visible_folders` gained a keyword-only `strict=False`; `strict=True` asks for an exact count and raises `FolderReadTruncatedError`, deliberately a RuntimeError and NEVER a ValueError so the ⊆ rule's broad catch cannot re-dress an infrastructure truncation as a false `folder_scope` verdict (T-182-47). Every other caller is byte-identical and issues no extra COUNT(*).
- [Phase 182-11]: `grounding_unavailable` composes into `/validate`'s `_KNOWN_CODES` via `_DEGRADED_CODES` and classifies `error` BY DERIVATION (`_ERROR_CODES` stays `_KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES`) — "we could not verify" must never paint the soft `incomplete`. Its string lives once, in `grounding.py`, built from a constant so the severity drift scanner cannot mistake it for a `grounding_verdicts` code; the scanner's blind spot is covered by an explicit constant-to-classifier assertion.
- [Phase 182-11]: SEED-131 NARROWED, not closed — status stays `open` with all 4 re_open_triggers. What ships here: the sealed grounding stages + the honest code + the truncation-aware read + one shared failure posture. What stays deferred to Phase 184: the envelope-level design question (top-level degraded marker vs a third severity vs the verdict code), SEED-132's `@model_validator` 422s, any future unguarded read, and a whole-handler always-200 contract test.
- [Phase 182]: D-182-12-01: publish's grounding gate is scoped to the DEFINITION's org, not the publisher's org-membership union — one optional restrict_org_ids keyword intersected at the two points the caller's org set is already resolved (folders in folder_utils, skills in grounding), so no visibility rule is duplicated (WR-05) — _resolve_publish_supabase already read workflow_definitions.org_id to scope the BYPASSRLS client (D-05/T-163-05b) and then discarded it. It now returns (client, org_id) so one read serves both scopes. Falsified: removing both restrict_org_ids arguments makes an org-A definition naming an org-B skill publish again, while 106 other phase-182 tests stay green.
- [Phase 182]: D-182-12-02: an optional scope restriction is forwarded to internal callees ONLY when set, so unrestricted calls stay byte-identical on the wire and the documented monkeypatch seams keep their contract — Threading the keyword unconditionally broke 18 existing tests in two files outside files_modified, because fetch_visible_folders / resolve_project_subtree / folder_scope_violations are documented test seams. A restricted call still passes it explicitly, so a stale double fails loudly rather than silently ignoring a tenancy narrowing.
- [Phase 182]: D-182-12-03: SEED-130's 'not a security issue' verdict is CORRECTED and its Option B annotated unsafe-as-written; the dead-path fix itself stays deferred to Phase 184 (WR-06) — resolve_template_source Branch 1 accepts user_id and never reads it, then performs a raw service-role bucket download, so the UUID annotation on template_asset_id is the only — incidental — containment. Option B removes exactly that annotation. A wrong recorded verdict paired with a fix that depends on it is a control failure; correcting the record is the mitigation while the code fix is deferred.
- [Phase ?]: 183-01: A1 resolved — a handle-free custom node renders 0 edges; PhaseNode must render hidden handles (183-06)
- [Phase ?]: 183-01: tsc -b is RED on develop at baseline (33 pre-existing signatures, 0 xyflow) — Phase 183 tsc gates are differential (D-ITEM-183-01)
- [Phase ?]: D-183-02-A: parseSkipTarget ships the C-1 correction — a prefix-LENGTH slice, so skip_to_phase:a:b resolves to a:b (backend-authoritative)
- [Phase ?]: D-183-02-B: the C-1 parity claim is executable in two languages off ONE 12-row JSON case table; a mutation check confirmed both suites fail when a row is corrupted
- [Phase ?]: D-183-02-C: resolveJsonModule enabled in frontend/tsconfig.app.json (one added line) so shared JSON fixtures compile
- [Phase ?]: D-183-03 plumbing: EffectiveFeaturesProvider broadcasts the ONE effective-features map (value-passing, no state, no second GET /features); a NULL context is FAIL-CLOSED
- [Phase ?]: 183-03: the 183-07 Builder gate reads useEffectiveFeaturesOptional() and treats a null context as {} (strict === true, VANISH); it must NOT call useEffectiveFeatures() — one call site in the whole tree is the tripwire
- [Phase ?]: 183-04: PhaseSpineGraph hard-cut onto phaseVocabulary + soulData.PHASE_GLYPHS — no re-export shim, all five importers repointed in one commit; the Spine reads the app-wide reveal via useTechnicalNamesOptional and 183-06 must mirror 'showTechnical ? technicalTitle(phase) : nodeTitle(phase)' verbatim
- [Phase ?]: 183-05: canvas sequential edge derived by phase_index + 1 LOOKUP (mirrors reachability.py:164) — a phase_index gap yields NO bridging edge
- [Phase ?]: 183-05: an unresolvable skip_to_phase renders an unresolvedSkip stub terminating the edge, never a silent drop (D-183-10)
- [Phase ?]: 183-06: node clicks driven by fireEvent, not user-event — a user-event click inside the xyflow plane also dispatches mousedown, reaching d3-zoom, and d3-drag dereferences a null event.view under jsdom (25 green assertions, exit 1)
- [Phase ?]: 183-06: the D-183-08 reveal is threaded DOWN onto each node's data by the canvas shell, so PhaseNode stays a context-free leaf and a second technical-names state is structurally impossible
- [Phase ?]: D-183-07-A: flag-off renders the Builder graph column with NO wrapper element — the shipped spine is the grid's first child, so D-181-01 byte-identity is structural
- [Phase ?]: D-183-07-B: the @xyflow lazy split is KEPT on measurement — WorkflowCanvas chunk is 174.16 kB / 55.39 kB gzip, separate from the entry (A6 discharged)
- [Phase 183]: 183-08: keyboard activation on the read-only canvas reuses the memoized projection + CANVAS_NODE_TYPES.phase guard, so mouse and keyboard share ONE selection rule (D-183-05)
- [Phase 183]: 183-08: BOTH React Flow node-description keys overridden — the library renders the counter-intuitively named keyboardDisabled key at its keyboard-a11y opt-out false default
- [Phase 183]: 183-08: citation_policy 'partial' joins 'flag' on the MIDDLE grounding face (matching deriveTier) rather than gaining a fourth face — D-183-07 three-face vocabulary holds
- [Phase 183]: D-183-09-01: GAP-1 fixed in BOTH views and flag-independently — the panel-dismissal defect lives on the shipped Spine surface, not the canvas (D-183-13 precedent); D-181-01 frozen surfaces untouched
- [Phase 183]: D-183-09-02: PhaseFormPanel.onClose and WorkflowCanvas.onClearSelection are REQUIRED props — an unclosable panel is a typecheck error, not a silent UX regression
- [Phase 183]: D-183-09-03: the Spine's empty-area click-away deferred on implementation cost + G-5 blast radius, explicitly NOT the jsx-a11y gate — overturnable on operator call
- [Phase 184]: D-184-02-A: allowedTypesAt's stranding boundary is strictly-AFTER the deliverable — inserting AT the emit's position puts the new step BEFORE it, so an at-or-after boundary would refuse the most natural authoring act with a reason that is false about the edit refused
- [Phase ?]: D-184-06 landed: PhaseNodeCard is presentational with zero graph-library import; the badge slot is a max-2 tuple whose violation is TS2322
- [Phase ?]: D-184-04-A: a coalescing run keeps the FIRST pending handleSet args, not the last — undo must restore the state before the sentence began; a length-only assertion cannot see the difference
- [Phase ?]: D-184-04-B: setDrafted/setComposing clear the temporal history and do not mark the draft dirty — a generate is a document boundary, not a save boundary
- [Phase ?]: D-184-04-C: Omit against BuilderDefinition's index signature collapses to {} — DefinitionMeta is a key-remapped mapped type so the definition shape stays declared once
- [Phase ?]: 184-05: fromCanvas carries phases through BY REFERENCE — reference identity, not deep equality, is the R2 proof (a rebuild fails 13 toBe assertions while every toStrictEqual stays green)
- [Phase ?]: 184-05: fromCanvas takes no edges argument and NEVER renumbers — renumbering lives only in definitionOps.renumber; duplicate slugs fail SAFE by returning the source untouched
- [Phase ?]: 184-06: the /validate success path checks the monotonic sequence and NOTHING else — an aborted-signal check there would make R7's out-of-order proof pass on abort instead of on the guard
- [Phase ?]: 184-06: the degraded validation state carries no ok field at all, so a failed check rendering as clean is unrepresentable rather than merely tested-for
- [Phase ?]: 184-07: the cosmetic nudge key is agentic-rag.canvas-nudge.v1.<user_id>.<draft_id> — one flat key per user per draft; zero migrations, slot 114 stays RESERVED
- [Phase ?]: 184-07: a session with no resolvable user id takes the same in-memory path as an unsaved draft — an unscoped key would be the very leak per-user scoping prevents
- [Phase ?]: 184-07: StepTypePicker renders its refusal CHARACTER-IDENTICAL to definitionOps.STRANDING_REASON, proving it authored none of its own
- [Phase ?]: 184-08: the verdict-mark table lives in nodePresentation and the degraded copy in verdictModel — react-refresh/only-export-components forbids either from a component module; two Wave-0 seam assertions in PhaseNodeCard.test.tsx were narrowed and enumerated
- [Phase 184]: 184-09: the governance rails ride an OPTIONAL PhaseFormPanel prop whose absence renders today's panel byte-for-byte (D-14); the guard lives in a NEW PhaseFormPanel.rails.test.tsx because revertByteIdentical.test.tsx never renders that panel
- [Phase 184]: 184-09: PhaseGateRow is a discriminated union carrying onRemove on the unlocked branch ONLY, so 'a locked gate with a remove button' and 'a removable gate with nothing to press' are both un-representable; a locked row's DOM subtree holds zero button/[role=button]/input
- [Phase 184]: 184-09: useGroundingBundle is the app's only caller of GET /workflows/grounding-bundle; a non-empty degraded array resolves to unavailable and the ready member types degraded as the EMPTY TUPLE, so a degraded palette shown as complete is a typecheck error. idle/loading are DERIVED (react-hooks/set-state-in-effect), which also lets a read palette survive a transient disable
- [Phase ?]: 184-10: ARIA_LABELS unchanged — a SECOND editable-only node-description table keeps the announced affordance true in both modes, so no pinned assertion was edited
- [Phase ?]: 184-10: onNudge hands over the RESULTING offset, not the drag delta — passing the delta makes every second nudge discard the first
- [Phase 184]: D-184-11-01: a dismissal COMMITS to the definition and writes nothing on all three paths — the 183 review's blur-based fix is deliberately NOT taken, because Phase 184 has an explicit-save contract plus a leave guard
- [Phase 184]: D-184-11-02: blockedReason and the rails prop are both gated on the canvas flag, and rails is passed SPREAD-CONDITIONALLY so a flag-off panel receives no key at all (D-14)
- [Phase 184]: 184-12: delete is immediate with inline Undo and NO confirm dialog; R10a's orphaning case is a REFUSAL with a stated reason (different testid, different role), and neither refusal consults /validate
- [Phase 184]: 184-12: the canvas + / x affordances are plane-level overlays drawn through @xyflow ViewportPortal — they share the nodes' coordinate system while reporting a null .react-flow__node ancestor, so the one-tab-stop-per-node invariant holds by construction
- [Phase 184]: 184-13: SAVED_STILL_A_DRAFT moved to builderStore.ts and re-exported from the page — a code-split leaf must not import a page module for a string
- [Phase 184]: 184-13: the canvas bottom region is ONE optional session prop object, so 'two rows, never one, never three' is enforced by the type rather than by a test
- [Phase ?]: D-184.1-04: the Builder's three header bands are contributed at three NESTING levels, so the two ancestor band owners read the canvas flag too — through ONE exported useCanvasGate() rule; App.tsx's single useEffectiveFeatures fetch is untouched
- [Phase ?]: D-184.1-01: the merged Builder header is FLAG-GATED, so flag-off byte-identity holds by construction — the header had never been pinned by any suite before 184.1
- [Phase ?]: 185-04: the armed action-risk shutdown fix is guarded by is_action_risk; the freshness gate keeps today's destructive-on-deploy fail_run because SPEC Req 9 scopes the fail-closed change to armed checkpoints only, proved by an unchanged-path control test
- [Phase ?]: 185-07: PhaseFormRails.kbTools ships OPTIONAL — required would break WorkflowBuilderPage typecheck; absent marks nothing (D-185-09 safe direction)
- [Phase ?]: 185-07: the grounding refusal renders whenever the loose side is refused, not on press — a disabled button fires no click, so press-to-reveal could never appear
- [Phase 185]: 185-05: L-7 fixed by re-subscribing the SAME tool_call_id (fix a), not expire-and-re-ask — re-asking with a new id IS G-4 scenario 3's named failure from the person's chair
- [Phase 185]: 185-05: an armed pause writes and emits action_risk_pending, never gate_failed; the audit row carries {phase,timing} only because the raw finding IS the person's prompt and already reaches the browser (T-185-05-04)
- [Phase 185]: 185-05: PendingAsk.timeout_seconds is number|null and the countdown is TOTAL over null; NO_DEADLINE_WAITING_LINE renders only without a deadline (SPEC Req 9 honesty fence, asserted on both sides)
- [Phase ?]: Phase 185-08: nodePresentation.GROUNDING_TONE was DELETED, not re-typed off the dead Grounding type — zero consumers remained and Req 6 says governance spends no colour, so a surviving exported strict->green/flag->indigo table was the partial-deletion hazard T-185-08-02 names. Its ?raw guard was INVERTED in place to assert absence (with a positive control), holding PhaseNodeCard.test.tsx at 49 tests.
- [Phase ?]: Phase 185-08: the vitest count-gate pin for phaseVocabulary.test.ts moved 42 -> 33 and BASELINE_TOTAL 424 -> 415, in the SAME COMMIT as the groundingFor deletion (L-9), with 33 READ FROM THE GATE'S OWN 'actual' COLUMN, never hand-computed. ONLY that pin moved: the three stale POSITIVE pins (canvasModel.purity 69->79, WorkflowCanvas 31->33, WorkflowBuilderPage.canvas 22->77) stay deferred to SEED-056 per 185-VALIDATION.md, leaving 2/10/55 tests of deletion blind spot in those files.
- [Phase ?]: Phase 185-08: the grounding cause derivation moved DOWN into phaseVocabulary (groundingCause flat-input core + groundingCauseOf phase-shaped adapter + GROUNDING_DIAL_TYPES) as the ONE client home, so the panel dial and canvasModel cannot drift. Canvas consumes it as two flat booleans PhaseNodeData.grounded (185-09 seal) and .armed (185-10 detour); CanvasEdgeData still carries only {kind}, so 185-10 must read armed off the target node or add the field.
- [Phase ?]: Phase 185-08 LESSON: the plan's self-described 'COMPLETE DELETION INVENTORY' was incomplete — it missed nodePresentation.ts importing the deleted Grounding TYPE, and the acceptance greps (groundingFor|GROUNDINGS) could not catch it because the dangling symbol matched neither needle. Only 'npx tsc -b' caught it (34 errors vs the 33 baseline). An inventory built by grepping a FUNCTION name misses type-only call sites.
- [Phase 185]: 185-09: the governance seal ships at right-[17px], not the plan's literal right-[11px] — sketch 143-A's 11px is measured inside the 248px CARD while the element is positioned against the 260px NODE BOX (11 + the 6px gutter). The test asserts the 11px CLEARANCE from the card's right border, never the 17, so the composite cannot drift from the locked number.
- [Phase 185]: 185-09: criterion 16's identity assertion compares the seal's outerHTML, not className+textContent — the falsification proved the plan's wording leaves a hole (a planted data-run={props.status} kept the className/text form GREEN while the props fence caught it), so the two criterion-16 guards were not the complementary pair they were meant to be. Falsify a guard PAIR, not each guard.
- [Phase 185]: 185-09: the plan's stated zone-check falsification (seal at the verdict's OLD -right-2 top-1.5) is INERT — 185-01 vacated that corner, so a seal parked there collides with nothing. The meaningful plant is the verdict's CURRENT corner (-left-2 top-1.5), which reds at 'verdict × governance seal = 441px²'. Both facts are now live tests, and the class of mistake the inert plant represents is caught by the 11px clearance assertion, not by a zone check.
- [Phase 185]: 185-09: the seal's sr-only label is definitionOps.GOVERNANCE_SEAL_LABEL (a 5th file, outside the plan's files_modified), not a literal in the card's JSX — Req 7's vocabulary is a LOCK and GROUNDING_DIAL_STRICT_LABEL already lives there, so a card-local literal would be a second copy of a locked word free to drift from the panel's. Pinned by GROUNDING_DIAL_STRICT_LABEL.endsWith(GOVERNANCE_SEAL_LABEL).
- [Phase ?]: 186-05: the 9th publish-spine row is Commit, APPENDED after Judge — a draft-moved refusal happens after the grader passed, and appending keeps the golden-run row at the index the running highlight addresses
- [Phase ?]: 186-05: unknownBlock is the SINGLE load-bearing fail-closed guard — a first draft derived a second value that closed the same hole, making the guard deletable with F7 still green
- [Phase ?]: 186-05: BLOCKED_SENTENCE carries two keys because verdictModel.test.ts's FORBIDDEN_CODES fence bars several real stage identifiers from that module entirely; the total resolver's sentence fallback carries the rest
- [Phase 186]: 186-06 [Rule 2]: the autosave effect needs a **`dirty` gate on the fire path**. Without it the timer matures ~1 s after the Builder MOUNTS with no edit at all and writes — bumping `updated_at`, minting a new token and invalidating the one every other open tab holds. The hook would manufacture the exact stale-token conflict the phase exists to prevent, on every draft open. `saveNow` deliberately bypasses it.
- [Phase 186]: 186-06 [Rule 1]: the single-flight drain's **first turn must not file a receipt**. Written naively, a confirmed write whose follow-up is already queued still calls the receipt action — clearing `dirty` while the newer edit is unsent, so the leave guard stops firing and the toolbar reads clean for work that never left the browser. T-185-04-01 in a shape the plan text does not name. The receipt line is reached only when `pendingRef` is clear.
- [Phase 186]: 186-06: `overwrite` **re-enters the ONE writer** (adopt the 409's token → clear the halt → `performWrite`) instead of issuing its own request. That is what keeps the receipt action at exactly one caller AND makes a second-race refusal fall back into `conflict` with the newer token for free.
- [Phase 186]: 186-06: the hook **deliberately does not classify the published-row 409**. Minting a second spelling of the page's `PUBLISHED_CONFLICT_MESSAGE` is the two-enums failure 186-04 just retired; **186-07 must close this or a shipped sentence regresses.**
- [Phase 186]: 186-06 (method): the strongest RED is a **planted-defect run, not an unresolvable import**. The hook was first written with the in-flight guard removed and a date parse planted, so F9/F15 failed on real assertions. An absent module proves the file is missing; it proves nothing about whether the assertion can tell a correct hook from a broken one.
- [Phase 186]: 186-07: PUBLISHED_CONFLICT_MESSAGE MOVED into useDraftPersistence beside the branch that picks it (186-06's flagged debt), and the page re-exports the name — the SAVED_STILL_A_DRAFT precedent applied a second time. GENERIC_SAVE_ERROR was RETIRED with a tombstone: keeping it beside the hook's SAVE_FAILED_SENTENCE would leave ONE situation with TWO spellings, the failure 186-04 retired the store's parallel save enum for.
- [Phase 186]: 186-07 (G-5): the net-negative on WorkflowBuilderPage.tsx (194 ins / 230 del; 1656 -> 1620 L) was earned by EXTRACTION, not by trimming reasons out of docblocks. Composing the hook first produced +356/-148; two components then left the page — BuilderSaveRegion.tsx (net-new: the four save sentences + the three controls) and BuilderHeaderBar.tsx (moved VERBATIM, zero DOM change, so the flag-off markup pin passes unedited).
- [Phase 186]: 186-07 (D-186-12): publishInFlight is threaded through the EXISTING renderPublish seam as an optional 4th argument plus one optional PublishGauntlet prop (onRunningChange) — a boolean reporter, never a state channel, and no new context. A three-parameter renderPublish is still assignable, so every call site outside the Builder is byte-identical.
- [Phase 186]: 186-07 (F12 lesson): a fetch-only zero-network fence could NOT go red — the api client throws at getAuthHeaders before fetch is reached under jsdom, so a nudge wrongly routed into the write path would have left the shipped spy green. The fence now names the two draft mutations as well, and the planted-nudge falsification was observed RED before it was trusted.
- [Phase 186]: 186-12 (GAP-2 / WR-01): single flight is enforced INSIDE `performWrite`, not by each caller — an invariant every caller must remember is not an invariant. The three caller-side `inFlightRef` checks (timer, hold release, `saveNow`) were deleted; `overwrite`/`reload` had never had one, which is how a double-click on Overwrite issued two same-token PATCHes and manufactured a `stale_token` conflict that did not exist.
- [Phase 186]: 186-12: the two conflict exits carry a SEPARATE re-entrancy guard (`reloadingRef`), placed ABOVE the `tokenRef` assignment in `overwrite`. Guarding only the request would trade a duplicate PATCH for a corrupted token — F19d is the test that discriminates that half-fix (it reds on a late-settling racing write, not on the request count).
- [Phase 186]: 186-12: `resolving` is a plain boolean on `DraftPersistence`, NOT a sixth `PersistState` member — the union describes the write loop's OUTCOME and a resolution under way is not an outcome. The banner's render condition needed `|| resolving` because `overwrite()` flips the loop to `saving` synchronously; falsified in place (removing the clause reds exactly one of the five net-new `BuilderSaveRegion.test.tsx` tests).
- [Phase 186]: 186-13 (GAP-3 / WR-03): the `enabled` guard's POSITION in the hold-release effect is load-bearing four ways and is commented as such — AFTER the `holdRef.current = holdReason` mirror (the timer and `saveNow` read that ref at FIRE time on the flag-ON surface, so a stale mirror would let a write through mid-gauntlet), AFTER the `haltedRef` check, BEFORE the `heldPendingRef` clear (so a later flag-on session still finds the accumulated work), and BEFORE `performWrite()` (the leak itself).
- [Phase 186]: 186-13: `saveNow` / `overwrite` / `reload` stay UNGATED, stated in the source as a decision rather than left as an omission — D-186-03 keeps the explicit save working flag-off and D-186-08 requires both conflict exits on any surface. **Automatic writes obey the flag, chosen ones obey the person.**
- [Phase 186]: 186-13 (WR-04): the flag-off Save-during-publish outcome is an HONEST SENTENCE (`HOLD_PUBLISHING_MANUAL`), not a disabled button — a greyed control with no stated reason is the R12 failure, and it would have changed the resting flag-off header markup `header.test.tsx:305` pins byte for byte. The hold was NOT dropped flag-off either: 186-02's stage-5 token guard is not flag-gated, so removing the hold would restore client identity by making the SERVER refuse those writes and cost the person a whole golden run.
- [Phase 186]: 186-13: the hold sentence is selected on `enabled` — **the same input that decides whether the flush happens**, which is the only way the surface and the loop cannot disagree. `HOLD_UNREADABLE` is deliberately unchanged: it promises nothing about a future write, so it was already honest on both surfaces.
- [Phase 186]: 186-13 (WR-05): a 404 halts on a PREDICATE over the cause (`isTerminalRefusal`), never on a comparison against the sentence — otherwise a copy edit becomes a behaviour change. It halts into `{kind:"error"}` and NOT `{kind:"conflict"}`: Reload would find nothing and Overwrite would PATCH a row that is not there, so the banner would offer two dead affordances. No auto-recreate — the 404-collapse (missing ≡ not-owned, T-103-01-01) means the client cannot classify the refusal, and minting a new row on one it cannot read is worse than stopping.
- [Phase 186]: 186-13 (test lesson): a test asserting only the HIDING half of a gate certifies the silence it was meant to catch. `BuilderSaveRegion.test.tsx`'s `autosaveEnabled: false` case pinned that `saving`/`saved` render nothing and said nothing about `held` — which is exactly how a Save press that produced no visible outcome shipped. It now asserts both halves.
- [Phase 186]: 186-14 (GAP-4 / CR-02): **a failed EXIT is not a failed WRITE, and it never takes the exits with it.** A resolution's `catch` must ask "is the thing I was resolving still true?" before choosing a state — `reload()` RESTORES `{kind:"conflict"}` (plus a note) while `haltedRef` is set, rather than replacing it with an `error` the banner does not render on. Rejected alternatives are recorded in source: widening the banner to render on `error` too would put Reload/Overwrite on screen for a 422 and a dead network, where neither exit means anything; clearing `haltedRef` in the catch would "recover" the loop into the silent clobber the phase exists to prevent.
- [Phase 186]: 186-14: the restore is **guarded on `haltedRef`**, because manufacturing a conflict that never happened — telling a person their draft moved when nothing moved — is the same class of lie in the other direction. The guard has its own falsification (F21f), not just a comment.
- [Phase 186]: 186-14: **a banner may gain LINES; the sentence that OFFERS the exits may never be replaced.** The failed-exit explanation is an additive `builder-conflict-note` under the locked `CONFLICT_BANNER_MESSAGE`, deliberately NOT the `builder-save-error` span — that span is for a refused WRITE and this is a failed READ during a chosen resolution. Two situations in one element is how a sentence stops meaning one thing.
- [Phase 186]: 186-14 (WR-07): halting docblocks should state a **TAXONOMY, not a count** — `isTerminalRefusal` said "there are exactly TWO halting causes" and a third (a published row, frozen by the `workflow_definitions_block_published_update` trigger) had been retrying forever. The axis that matters is whether the person has an IN-APP exit and, if not, whether the sentence names an out-of-app one: stale token → conflict + two exits; gone row → error, no exit, "copy what you need"; published row → error, no exit, "use Tweak". No re-assertion machinery was added: nothing overwrites that state for the session, so the answer stays on screen beside the button.
- [Phase 186]: 186-14 (measurement lesson): **two of the plan's predicted REDs came up GREEN, and that changed the diagnosis rather than the fix.** The loop was always recoverable at the hook level (`reloadingRef` resets in `finally`); GAP-4 was a *reachability* defect — the SURFACE lost both controls, so no person could ever reach the second reload. A predicted RED that does not appear is evidence about the defect's shape, not a test to weaken.
- [Phase 186]: 186-15 (WR-11): **an absolute count over an interval is a claim about the CLOCK, not about the action.** The pane-click row asserted `toHaveBeenCalledTimes(0)` across a window that included a 10 s wait for a lazily-imported canvas, while a real 1000 ms autosave debounce was already armed — so the row went red for the product WORKING. Fixed as a DELTA bracketed around the dismissal, not by fake timers (which would have changed the timing model of 22 other rows for the sake of one) and never by loosening or skipping. The sibling ✕/Escape rows keep their absolute assertions on purpose: they never cross the debounce, and that contrast is what identified the cause.
- [Phase 186]: 186-15: **a delta assertion needs a positive control in the SAME test, or it is decoration.** A helper that cannot observe a PATCH makes its zero meaningless. The control wraps the same helper around an explicit Save (which bypasses debounce and dirty gate, so it needs no clock) and demands a delta ≥ 1. Falsified: snapshotting `mock.calls` instead of `.length` — the most likely way to break it — turns the control red immediately.
- [Phase 186]: 186-15 (WR-06): **a module-level `pytestmark` hides every invariant in the file, including the ones that need no database.** `grep -rn "stale_token" backend/tests/` matched exactly one file and that file was wholly skipped without Postgres, so the server half of a two-sided wire contract was absent from any CI while the client half was covered only against a mock. The skip is now a property of the four tests that need a pool. 0 → 9 DB-free passes.
- [Phase 186]: 186-15: **the fail-closed 404 was a claim in a comment and nothing else.** The route says "any cause this route does not recognise" collapses to the dull string 404; a DB-free test now drives an unrecognised cause and asserts its detail is EQUAL to the `not_found` one and is not a dict — a coded 404 would be an existence oracle (T-186-01-03). Falsified by giving the 404 a machine code.
- [Phase 186]: 186-16 (WR-10): **a gate that guards the entrance does not guard the purchase.** The publish trigger had been refused by `blockedReason` since 184-11, but the INNER modal button — which can be clicked minutes later, after the author finishes writing a golden input — was gated on nothing but the textarea and `loading`. The expensive click and the guarded click were not the same click. Both now read the SAME derived `blocked`, handed down rather than recomputed, so they cannot disagree about whether a reason was supplied.
- [Phase 186]: 186-16: **a stronger fix that writes past the revert switch is a weaker fix.** The review preferred `runGauntlet` awaiting a `flushPendingWrites()`, which closes the window rather than shrinking it. Rejected on safety, not cost: `PublishGauntlet` mounts unconditionally on BOTH branches of the flag gate, so that flush issues an unrequested PATCH on the flag-off surface — the exact D-181-01 leak 186-13 had just closed — and re-gating it on `enabled` makes it a conditional flush wearing a guarantee's clothes. The refusal rides the seam that already exists and is the vocabulary the phase speaks everywhere else (hold, and say why).
- [Phase 186]: 186-16: **only a BOUNDED state is safe to block on.** `saving` always ends by itself (`performWrite`'s `finally` clears `inFlightRef`; every terminal branch leaves `saving`), so the refusal is momentary by construction and needs no escape hatch. `conflict` and `error` are NOT bounded — blocking publish on them would need the surface to also offer the way out, which is a product decision, not a race fix. Deferred with a trigger rather than folded in because "arguably worse" is not the same as "in scope".
- [Phase 186]: 186-16: **the refusal branch is ranked FIRST, and that ordering is the message.** A saving draft that is also empty gets the wait, not the invitation — adding a step will not make Publish go until the PATCH lands, so naming the further obstacle would send the author to work that changes nothing. Same precedence rule the hold sentences already follow.
- [Phase 186]: 186-16 (falsification): the gate was proven by REMOVING `&& !blocked` and re-running — exactly the 3 gate rows went red while the 2 identity rows (no prop / whitespace-only reason) correctly stayed green. A row that stays green under the mutation is measuring identity, not the gate, and knowing which is which is the point. The refusal is asserted on the mocked TRANSPORT rather than on the rendered outcome: a golden run's cost is spent the moment the request leaves.
- [Phase 186]: 186-16 (measurement lesson, the third in three plans): **four claims inherited from the PLAN were false against the tree** — the gauntlet suite had no R12 cases at all (they live in the canvas suite), its prop docblock's "24 shipped assertions" is stale at 41, and the "canvas-pair baseline is 141" is 111. None changed what was built; all are recorded so a fourth reader does not inherit them. Re-measure before quoting any count in this phase.
- [Phase 186]: 186-15 (measurement lesson, the second in two plans): **a claim that cannot be reproduced is not thereby false — reproduce the MECHANISM instead of picking a side.** The WR-11 row passed 6/6 here and failed 3/3 for the verifier. Rather than record either, the failure condition was injected (a 1500 ms pause standing in for a slow lazy import), which reproduced the verifier's exact signature and confirmed the diagnosis. The real defect was that the row's result depended on machine and cache state at all. Both numbers are recorded in the SUMMARY so no third reader inherits one on trust.
- [Phase 186]: 186-17 (WR-08): **when one boolean answers two questions, split the questions — do not tune the boolean.** The drain's `superseded` decided both *may a receipt be filed* and *may the loop issue another request now*, so CR-01's correct widening of the first (queue flag → payload identity) silently widened the second into an unthrottled loop: one PATCH per ROUND TRIP while an author types, a rate set by network latency. Now identity alone gates the receipt and `pendingRef` alone gates re-entry. Rejected: a `dirty`-gated safety re-arm (a SECOND timer in a module whose rule is one timer, guarding the case `pendingRef` already identifies) and an `await delay()` before `continue` (keeps `inFlightRef` true through the quiet period, so Save-draft is disabled and `Saving…` shows while nothing is outstanding — a rate limit that lies about state).
- [Phase 186]: 186-17: **the re-entry rule is derivable from the arming site, not from a comment.** `pendingRef` has ONE home since 186-12 — `performWrite`'s single-flight guard — reached by exactly three beats (a MATURED timer, `saveNow`, the hold release), each of which had its beat CONSUMED and so has no live timer behind it. Every other supersession is an edit still inside its own debounce, and an edit reschedules the debounce effect by construction (`[definition, enabled]`). So: `continue` under `pendingRef`, `break` otherwise, and the ordinary beat writes the rest. A future change that arms `pendingRef` anywhere new must name the beat it consumed or the rule stops being derivable.
- [Phase 186]: 186-17: **the fix's own hazard is closed in the same task** — a `break` that leaves `{kind:"saving"}` on screen is WR-09's defect introduced by WR-08's cure, so the break resolves the reading to `idle` first. This is the pattern the phase failed five times: a mechanism honest about the thing it was written for and silent about the state it leaves behind.
- [Phase 186]: 186-17 (WR-09): **a state resolution belongs above every gate that only decides whether to WRITE.** The review proposed clearing the held reading inside the `!enabled` arm; the halt gate and the nothing-pending gate carry the identical hazard, so the fix would have been true in one third of the cases. And the resolution must be FUNCTIONAL (`s.kind === "held" ? {kind:"idle"} : s`) — a bare reset would erase a `conflict`, the only reading that carries Reload/Overwrite, reintroducing GAP-4 by a second door. F20h falsifies that wrong shape rather than trusting the comment.
- [Phase 186]: 186-17: **make a flag AGREE WITH THE TRUTH instead of choosing between two failure modes.** 186-13 left `heldPendingRef` armed on the flag-off path (so work would not be lost) and the review wanted it cleared (so a stale arming could not write later). `heldPendingRef.current = store.getState().dirty` satisfies both: it stops being a memory of a press and becomes a statement about the document. RED was a PATCH carrying the untouched 2-phase draft and the session's original token — a write against a document nobody had edited.
- [Phase 186]: 186-17 (measurement lesson, the fourth in four plans): **a falsification's STRENGTH is a parameter, and the parameter must be chosen by measurement.** F22a at the plan's typing cadence (250 ms against a 200 ms server) showed 5 calls — real, but the storm self-terminates when the typist is slower than the round trip. At 125 ms it is sustained and shows 11. Both are recorded in the test's own docblock so the choice is auditable. Also refuted here: the "three `pendingRef` arming sites" (one statement + three call paths since 186-12) and the plan's "233 passed + 1 failed" consumer-set baseline (270/270 at the real base commit). Re-measure before quoting any count in this phase — this is now unanimous across 186-14..17.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
