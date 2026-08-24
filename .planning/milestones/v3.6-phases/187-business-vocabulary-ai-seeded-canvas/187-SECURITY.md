# 187-SECURITY.md — Phase 187 Business Vocabulary + AI-Seeded Canvas

```yaml
phase: 187
phase_name: business-vocabulary-ai-seeded-canvas
authored: 2026-08-06
author: gsd-security-auditor (/gsd:secure-phase 187)
verified: 2026-08-06
verifier: gsd-security-auditor
register_authored_at_plan_time: true
asvs_level: 1
block_on: high
threats_total: 152          # 151 plan-time ids + 1 registered by the verifier (T-187-SEED-133)
threats_closed: 152
threats_open: 0             # T-187-SEED-133 dispositioned `accept` by the operator 2026-08-06
threats_accepted: 23        # 22 plan-time `accept` + T-187-SEED-133 (operator, at the secure-phase gate)
threats_transferred: 0
tier1_verified: 55          # individually read out of shipped source, with file:line
tier2_measured: 4           # the 4 distinct supply-chain ids (10 register rows), one measurement
tier3_sampled: 39           # of 92 tier-3 rows; the other 53 rest on the phase gate record
tier3_unsampled: 53
verdict: >-
  SECURED — 152/152 resolved at HEAD a51e12d3 (source tree byte-identical to the brief's
  91c37b5c). ZERO declared mitigations were found absent across all 151 plan-time threats.
  The one gap the plan-time register never named (T-187-SEED-133) was escalated, presented
  at the operator gate, and dispositioned `accept` with a phase-bound re-open trigger on
  2026-08-06. 7 non-blocking warnings and 10 citation drifts recorded. Nothing meets
  `block_on: high`. ⚠ UAT-13 (M6 — the SC#6 LIVE row) remains owed: an automated pass is
  not a live pass.
phase_commit_range: d478cee8..726148d2      # 155 commits, 2026-08-01 → 2026-08-04
head_verified_at: a51e12d3
head_in_audit_brief: 91c37b5c               # 3 commits back; `git diff 91c37b5c..a51e12d3 -- frontend/src backend/app supabase/migrations scripts/` is EMPTY
```

---

## How to read this file

This register was **authored at plan time** (`register_authored_at_plan_time: true`), across
**29** `<threat_model>` blocks whose union is **157 rows / 151 distinct ids**. `/gsd:secure-phase 187`
**verified those entries against shipped source**; it did not re-derive a fresh register from the diff.

The operator approved a **TIERED** verification. Every one of the 151 ids appears below with a
disposition, a status, and a **stated basis** — but the depth of that basis differs, and **every row
says which tier it was verified at**. This is the whole point of the tiering, so it is stated plainly:

| Tier | Rows | What "CLOSED" means for a row at this tier |
|---|---|---|
| **1** | 55 | The verifier **read the mitigation out of shipped source** and names the `file:line` read. |
| **2** | 4 ids / 10 rows | Closed by **one re-run measurement** whose raw result is printed below. |
| **3 — sampled** | 39 | The verifier **located the named fence/pin in the tree** and read enough of it to confirm it exists and is non-vacuous. |
| **3 — unsampled** | 53 | **NOT read by the verifier.** These rest on the phase's own gate record (`187-VERIFICATION.md`, the plan SUMMARYs, the green suites re-run below) — not on this auditor's reading. |

A mitigation is CLOSED only when it was *verified* at its stated tier. A re-scan of the plan text is
not evidence, and neither is a summary sentence. Where a plan or summary sentence is the only support
for a claim, the entry says so explicitly.

**Nothing in this file was inherited.** Every `file:line` in the plans was written between 2026-08-01
and 2026-08-04 at a different HEAD; each one cited below was re-resolved at `a51e12d3`. Ten had
drifted and are corrected in § *Citation drift*, per the standing project rule
(`feedback_dont_inherit_unmeasured_claims` — Phase 186 found 4 inherited claims false, Phase 188.1
found 9).

---

## Re-derived by the VERIFIER at HEAD `a51e12d3`, not inherited

| Measurement | Command | Result |
|---|---|---|
| Register size | `for f in 187-*-PLAN.md; do awk '/<threat_model>/,/<\/threat_model>/' …` | **157 rows · 151 distinct ids** ✅ (matches the brief) |
| Disposition split (rows) | `awk` on field 8 | **130 `mitigate` · 27 `accept`** ✅ (matches the brief) |
| Disposition split (distinct ids) | same, de-duplicated | **129 `mitigate` · 22 `accept`** — see WARNING-4, `T-187-R5-SC` carries **both** |
| Duplicate ids | `uniq -c \| awk '$1>1'` | `T-187-R4-SC` ×4, `T-187-R5-SC` ×4 → 157 − 6 = 151 ✅ |
| **Supply chain (TIER 2)** | `git diff --stat d478cee8..726148d2 -- frontend/package.json frontend/package-lock.json backend/requirements.txt supabase/migrations/` | **empty output, exit 0 — 0 files changed.** Re-run to current HEAD: **also 0.** ✅ |
| Deploy-artifact drift | `bash scripts/check-deploy-drift.sh` | **RESULT: PASS**, exit 0. 2 WARNs, **both pre-existing** (the ≥ #089 seed-like migration list and the docker-compose parse fallback — the identical two `188.1-SECURITY.md` recorded) ✅ |
| Backend suites for SC#6 | `venv/Scripts/python.exe -m pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_route_assigned_reach.py tests/unit/test_187_authoring_step_names.py -q` | **45 passed** ✅ |
| Backend armed-disposition suites | `… tests/unit/test_ask_user_disposition.py tests/unit/test_185_engine_attachment.py tests/unit/test_harness_models.py -q` | **56 passed** ✅ |
| Frontend count gate | `node scripts/vitest-count-gate.cjs` | **`count gate OK` — total 2477 · pinned 2477 · failed 0 · 45/45 pinned files present** ✅ |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors**, of which **0** name any Phase-187 file (`SeedReceipt`, `StarterTemplatePicker`, `DescribeKbPicker`, `WorkflowBuilderPage`, `phaseVocabulary`, `definitionOps`, `ProblemsTray`, `verdictModel`, `PhaseNodeCard`, `StepTypePicker`, `PhaseSpine`) ✅ — same 33 `188.1-SECURITY.md` measured |
| `SeedReceipt.test.tsx` in isolation | `npx vitest run … --reporter=verbose` | **68 passed / 68**, 0 skipped ✅ |
| `dangerouslySetInnerHTML` in production Phase-187 components | `grep -rn … --include=*.tsx \| grep -v ".test."` | **0 JSX uses.** Every hit in `SeedReceipt.tsx` / `StarterTemplatePicker.tsx` / `DescribeKbPicker.tsx` / `PhaseNodeCard.tsx` / `PhaseNode.tsx` / `PhaseSpine.tsx` / `WorkflowCanvas.tsx` is **prose in a docblock**. The tree's only two real uses are `MarkdownRenderer.tsx:30` and `ShikiCode.tsx:168` — pre-existing chat surface, untouched ✅ |
| `workflow_authoring.py` `degraded` occurrences | `grep -c degraded backend/app/services/workflow_authoring.py` | **0** ⚠ — see **T-187-SEED-133**, the one OPEN row |
| Storage APIs in `WorkflowBuilderPage.tsx` | `grep -cE "localStorage\|sessionStorage\|indexedDB\|document\.cookie"` | **0** ✅ |
| `monkeypatch` in the roster suite | `grep -c monkeypatch backend/tests/integration/test_187_authoring_roster.py` | **0** ✅ |
| `@/lib/api` in `SeedReceipt.tsx` / `canvasModel.ts` | `grep -c` | **0 / 0** ✅ |
| `harness_audit` event-type CHECK | `grep -n action_risk_pending supabase/full-schema.sql` | `:1124` — a **23-value** closed list containing **both** `action_risk_pending` and `validator_ask_user_approved`. Introduced by mig **114** (pre-187); this phase adds **zero** migrations ✅ |
| Summaries carrying `## Threat Flags` | loop over `187-*-SUMMARY.md` | **21 of 29.** Missing on **187-02, -03, -07, -25, -26, -27, -28, -29** ⚠ — WARNING-2 |
| Phase source churn | `git diff --shortstat d478cee8..726148d2 -- frontend/src backend/app` | 39 files, **+10 144 / −243** |
| Source tree vs the brief's HEAD | `git diff --stat 91c37b5c..a51e12d3 -- frontend/src backend/app supabase/migrations scripts/` | **empty** — every figure here is equally true at the HEAD the brief named ✅ |

---

## Citation drift found at HEAD `a51e12d3` (reported, never silently substituted)

| Cited as | Actually at HEAD | Where the stale citation lives |
|---|---|---|
| `backend/app/services/harness/harness_engine.py` | **`backend/app/services/harness_engine.py`** — the `harness/` sub-package form resolves to **no file** | the audit brief |
| the exact-match ALLOW-LIST at **`:1194-1198`** | **`harness_engine.py:1272-1276`** (`if is_action_risk and choice != _ACTION_RISK_APPROVE_CHOICE`), rationale at `:1238-1271`. `:1197` today is the *shutdown-`CancelledError`* branch — a different control | `187-06-PLAN.md` T-187-06-04, and the brief |
| the storage source guard at `WorkflowBuilderPage.canvas.test.tsx:414-418` | **`:499-500`, `:810-811`, `:2731-2732`** — three sites, not one. `:414-418` is a panel-dismiss helper | `187-15-PLAN.md` T-187-15-04 |
| the deferred Phase-103 publish rework "named at `publish_service.py:478-479`" | **`:514-515`** | `187-CONTEXT.md:550` (the D-187-12 trigger) |
| `DescribeKbPicker.tsx` — **167 lines**, testid at `:147`, state marker `:135-136`, no-control return `:140` | **194 lines**; testid **`:174`**; state marker **`:162-163`**; no-control return **`:167`** | `187-VERIFICATION.md` § Required Artifacts — a **pre-fix** capture; the CR-R5-01 surrender effect (`:151-156`) was added after |
| `DescribeKbPicker.test.tsx` pinned at **30** | **37** (`scripts/vitest-count-gate.cjs:210`) | `187-VERIFICATION.md`; the gate's own comment at `:205` records the 30 → 37 move |
| `blockedReason` at `WorkflowBuilderPage.tsx:1117-1126` | **`:1125-1136`** | `187-UAT.md` § Gaps |
| `definitionOps.canRemovePhase` (`definitionOps.ts:282`) — the undecorated-title call | the `nodeTitle(referrers[0])` call is at **`:360`** | `187-15-SUMMARY.md:230` |
| the reason render at `SeedReceipt.tsx:342-353` | **`:336-345`** | `definitionOps.ts` `seedReceiptStepReason` docblock |
| `_interactive_phase_failures` at `publish_service.py:196, :518` | **both correct** ✅ — recorded because it is the one D-187-12 citation that did **not** drift | `187-CONTEXT.md:210` |

None of these changes a disposition. All are recorded because an uncited-but-inherited number is
exactly how a false claim survives a phase.

---

## Trust boundaries this phase touched

| Boundary | Description | Data crossing | Verified at |
|---|---|---|---|
| **Run-time governance** | the armed action-risk checkpoint — the person↔engine consent boundary | an approval/refusal string, a `harness_audit` receipt | `harness_engine.py:754-801`, `:1272-1308` |
| **Model → definition** | `POST /workflows/generate` — model-authored `WorkflowDefinition` JSONB | step names, tool names, folder/skill ids | `workflow_authoring.py:280-375` |
| **Server → canvas** | `POST /workflows/validate` verdicts and `GET /workflows/grounding-bundle` | verdict codes, `kb_tools` | `api/workflows.py:514-557`, `:755-767` |
| **RLS / org scope** | the loose door's KB picker — the phase's ONE tenant-scoped read | folder ids + names | `DescribeKbPicker.tsx:52`, `:103` |
| **Feature flag** | `visual_workflow_canvas` — the D-181-01 flag-off promise | every canvas affordance and request | `WorkflowBuilderPage.tsx:635`, `:810`, `:884`, `:1509`, `:1603`, `:1655` |
| **Un-gated carve-out** | `GET /workflows/starters` — world-readable `is_system_global` published rows | starter names + `business_requirement` | `StarterTemplatePicker.tsx:70`, `:103` |

---

## TIER 1 — 55 rows, each read out of shipped source

### 1a. The SC#6 / SEED-137 preemption — the reason this phase carries a threat model

| Threat ID | Cat. | Disp. | Status | Evidence read at HEAD `a51e12d3` |
|---|---|---|---|---|
| **T-187-06-01** | EoP | mitigate | **CLOSED** | The checkpoint is keyed on the phase boolean and **sits outside `phase.validators` entirely**: `harness_engine.py:754` — `if getattr(phase, "action_risk_armed", False):` — inline code between the pre-gate pass (`:703-725`) and the `while True:` retry loop (`:803-805`), reachable through no author-declared list. The reasoning ships in-source at `:727-753` and names the exact defect: *"`run_gates` is first-failure-wins (`validators.py:248`) and the append put the armed spec LAST, so any author-declared failing pre gate returned first and an `ask_user` Proceed fell straight through to the body with nobody asked. No ordering rule fixes that — the gate simply must not live in the author's list."* Verifier re-ran `test_187_armed_checkpoint_property.py` → **green**. |
| **T-187-01-01** | EoP | mitigate | **CLOSED** | The property itself: `backend/tests/unit/test_187_armed_checkpoint_property.py` (754 L) — **P1** at `:627` (`test_p1_body_implies_the_armed_prompt_was_awaited_first`) over a `CASES` table (`:311-436`) in which `reaches_body_without_arming` is **declared explicitly on every row with no default** (enforced by `:589-601`). The known-bypass row is pinned present at `:608-611`. Re-run **green**. ⚠ The *RED-on-HEAD* observation rests on `187-01-SUMMARY.md`, not on re-execution by this verifier. |
| **T-187-01-05** | EoP | mitigate | **CLOSED** | The Pitfall-4 fail-open registered at its origin. The falsification case `pre_fail_run` is present at `:336-340` with `reaches_body_without_arming: False`, and the in-file note at `:414-416` states why that row cannot serve as the falsification for the other half. Fixed in 187-06 (below) and re-verified green in 187-11. |
| **T-187-06-02** | EoP | mitigate | **CLOSED — with a wording correction, WARNING-5** | `harness_engine.py:1055-1056` — `_failing_on_failure` is called **only** inside `if not is_action_risk:`, with the rationale at `:1046-1054` naming the Phase-185 BLOCKER T-185-04-01 class. ⚠ The plan's *"not called at all when `is_action_risk`"* is **over-stated**: an armed call with `redis is None or run_id is None` early-outs at `:1065-1066` into `_route_on_failure`, which calls `_failing_on_failure` at `:898`. **The property still holds**, and the verifier proved it rather than assuming it: `_route_on_failure` (`:890-909`) returns **`skip_to` or `fail_run` and never `None`**, and the caller at `:798-801` runs the body **only on `None`**. So the no-transport path fails **closed**. |
| **T-187-06-03** | EoP | mitigate | **CLOSED** | `is_action_risk` is a **per-CALL parameter** (`harness_engine.py:1013`), never a phase read inside the helper — stated and justified at `:1035-1044` (*"this function serves BOTH the armed checkpoint AND the author's own `ask_user` gates on the SAME phase"*). Both asymmetry nets exist and are green: `test_185_engine_attachment.py:817` `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped`, `test_ask_user_disposition.py:638` `test_non_armed_free_text_fall_through_is_unchanged`. |
| **T-187-06-04** | Repud. | mitigate | **CLOSED** | The **exact-match ALLOW-LIST** is intact at `harness_engine.py:1272-1276` — `if is_action_risk and choice != _ACTION_RISK_APPROVE_CHOICE:` → `fail_run`, on the value already `.strip()`ed at `:1223`. Not casefold, not prefix, not substring; the reasoning at `:1255-1261` states why a looser rule is strictly worse. Ordering is preserved and load-bearing: `_is_abort_choice` runs **first** at `:1233`. ⚠ cited as `:1194-1198`; drifted. |
| **T-187-06-05** | Repud. | mitigate | **CLOSED** | The receipt `write_audit(event_type="validator_ask_user_approved")` is at `:1303-1308` — **after** the allow-list at `:1272`. D-187-18 changes only the `validator` value (`:1291`, `"validator": failed_idx`, `None` for a hoisted checkpoint) and the key stays **present**, per the reasoning at `:1280-1288`. |
| **T-187-06-06** | Repud. | mitigate | **CLOSED** | D-187-02 placement, read from source: the checkpoint (`:754`) sits **after** the pre-gate pass, whose `if outcome is not None: return outcome` at `:723-724` exits on a `fail_run` / `skip_to_phase` / aborted-`ask_user` before the checkpoint is reached. A step an author's gate skips away therefore produces **no** approval receipt. Stated in-source at `:737-741`. |
| **T-187-06-09** | EoP | **accept** | **CLOSED — accepted, still true, trigger concrete** | Re-verified rather than taken on trust: `publish_service._interactive_phase_failures` (`:500-540`) tests **only** `config.phase_type == "llm_human_input"` (`:521`) and `validator.on_failure == "ask_user"` (`:531`). It **never reads `action_risk_armed`**, so an armed phase still publishes past the pre-run interactive fence and its checkpoint fires inside the synchronous golden run with no subscriber. **Trigger, dual and concrete** (`187-CONTEXT.md:546-552`): *"whichever phase makes publish a background job … **or** the first time an armed workflow is published and its golden run wedges,"* with the one-line fix named. Neither has fired. |
| **T-187-11-04** | EoP | mitigate | **CLOSED** | The helper-level proof exists: `test_ask_user_disposition.py:730` `test_armed_checkpoint_on_a_fail_run_phase_still_asks()`, driving `_armed_phase(author_validators=author_fail_run)` at `:757` and `:781`. Green in the verifier's run. |
| **T-187-11-02** | EoP | mitigate | **CLOSED — partly on the summary, labelled** | Verifier measured what it could: across the WHOLE phase, `test_185_engine_attachment.py` gained **179 / lost 45** lines, and `git diff \| grep -E "^[+-]def test_"` returns **nothing** — no test was added, deleted or renamed. `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped` (new `:817`) sits **after** the last hunk (new `:804`) → untouched across the whole phase. ⚠ The stronger claim — an **AST function-body compare** of all four regression-net tests against plan-11's HEAD — rests on `187-11-SUMMARY.md:201` and `:223-226`, **not** on re-execution here. |
| **T-187-06-07** | DoS | mitigate | **CLOSED** | Only two event types are used, and both were already members of the closed CHECK: `harness_engine.py:778` `action_risk_pending`, `:1306` `validator_ask_user_approved`; `supabase/full-schema.sql:1124` lists both among **23** values (mig `114`, pre-187). Zero migrations this phase (measured). The precedent it guards against — `BUG-260731-02`, an unlisted kind killing the run — is named in-source at `:774-775`. |
| **T-187-06-08** | Tamper. | mitigate | **CLOSED — by measurement** | The WR-03 retry seed `validators[0].max_retries` is untouched at `harness_engine.py:693`. And the specific claim *"`test_185_engine_attachment.py:153-165` stays green unmodified"* was **measured**: `git diff -U0` over the phase shows the **first changed hunk begins at old line 167**, so `:153-165` is genuinely untouched. Criterion 18 above it WAS re-shaped — visibly, with 35 lines of recorded reasoning at the top of the hunk, which is what the ROADMAP threat item permits. |
| **T-187-11-03** | Repud. | mitigate | **CLOSED** | The `validator: null` receipt shape is pinned by construction and by comment: `harness_engine.py:1289-1294` writes `"validator": failed_idx` into `receipt_metadata`, and `:1283-1286` states *"the key stays PRESENT so there is exactly one row shape per `event_type`."* |

### 1b. Flag-off leakage (D-181-01)

| Threat ID | Cat. | Disp. | Status | Evidence |
|---|---|---|---|---|
| **T-187-05-01** | Tamper. | mitigate | **CLOSED** | The normalised `outerHTML` pin is real: `pages/WorkflowBuilderPage.describe.test.tsx:215-217` builds it (`normalise(ctaRegion().outerHTML)`), `:252-266` holds the constant captured from the UNMODIFIED page and says **WRITTEN ONCE**, `:268` asserts byte-for-byte. Round 5's picker did not break it — `:486` and `:498` re-assert the same literal with the folder picker mounted as a SIBLING. |
| **T-187-05-02** | EoP | mitigate | **CLOSED** | `describe.test.tsx:273` — *"an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)"* — asserted against **the same constant**, with the reason at `:274-280`. A formatting-independent guard sits at `:281` and its **positive control** (*"both guards FIND a planted door"*) at `:300`. |
| **T-187-15-01** | Tamper. | mitigate | **CLOSED — both mounts, both shapes read** | `StarterTemplatePicker` — explicit: `WorkflowBuilderPage.tsx:1509`, `{canvasEnabled && <StarterTemplatePicker … />}`. `SeedReceipt` — **structural**: it renders at `:1655` inside the `canvasEnabled ? ( … ) : graphChild` branch opened at `:1603`, with the reason shipped in the JSX comment at `:1651-1654`. |
| **T-187-15-02** | InfoDisc | mitigate | **CLOSED** | `WorkflowBuilderPage.tsx:884` — `const bundle = useGroundingBundle(canvasEnabled)`. The hook honours it: `hooks/useGroundingBundle.ts:141` `if (!enabled) return` (no request at all), `:189` the effect is keyed on `enabled` alone, `:192` returns `IDLE` when not enabled. So flag-off `kbTools` is `[]` and an ungated receipt would have claimed zero grounded steps on a workflow the run-time gate still binds. |
| **T-187-R5-08** | InfoDisc / behaviour | mitigate | **CLOSED** | `WorkflowBuilderPage.tsx:810` — `useLiveValidation(definition, hasEdited \|\| (canvasEnabled && phases.length > 0))`. The `canvasEnabled &&` is what preserves D-181-01, and the reasoning naming the fail-open it fixes ships at `:787`. |
| **T-187-15-04** | Tamper. | mitigate | **CLOSED — by direct property measurement** | `grep -cE "localStorage\|sessionStorage\|indexedDB\|document\.cookie" WorkflowBuilderPage.tsx` → **0**. The source guard exists at `canvas.test.tsx:499-500`, `:810-811`, `:2731-2732` — ⚠ **not** at the cited `:414-418`. |

### 1c. The round-5 RLS/org seam and the never-ran fail-open

| Threat ID | Cat. | Disp. | Status | Evidence |
|---|---|---|---|---|
| **T-187-R5-01** | InfoDisc | mitigate | **CLOSED** | `DescribeKbPicker.tsx:52` imports exactly `listFolders` from `@/lib/api`; the sole call is `:103`. Fenced at the source: `DescribeKbPicker.test.tsx:395` counts `from "@/lib/api"` occurrences, `:397-398` are the **positive controls**, `:400` forbids every other api symbol, `:405-407` forbid the route literal, a `fetch(` call and the API-base token. |
| **T-187-R5-02** | Tamper. | mitigate | **CLOSED — and stronger than the register claims** | Options are built **only** from `listFolders()` rows (`:105-115`); the change handler forwards `e.target.value` (`:177`); the source fence forbids the store, `useNavigate`, `setDrafted` and `setProjectFolder` (`test:411-413`) with `onChange` as the positive control (`:414`). Beyond the register: **CR-R5-01's surrender effect** at `:151-156` clears a held `value` the *settled* fetch does not offer, so the door cannot put an id on the wire that no control on screen shows — the reasoning at `:131-150` names why (`POST /workflows/generate` gates `unbound_retrieval` on `project_folder_id is None`, so a dangling id would suppress the verdict). |
| **T-187-R5-03** | Spoof(name) | mitigate | **CLOSED** | `DescribeKbPicker.tsx:114` — `rows.push({ id, label: name.trim().length > 0 ? name : id })`, with the CANVAS-01 totality reasoning at `:112-113`. A row with no usable id is **dropped**, not rendered blank (`:107-110`). On failure `:120-123` invents nothing: zero rows and a state that says why. |
| **T-187-R5-04** | Repud. | mitigate | **CLOSED** | Word-class fence at `DescribeKbPicker.test.tsx:346-353` over all three shipped sentences, with a **two-sided** control set: `:359-362` proves the class does not fire on `errorless` / `invalidate` / `blockchain` / `warningly`, and `:368-370` proves it **does** fire on planted severity sentences. `:378` asserts it over the rendered DOM. |
| **T-187-R5-05** | DoS | **accept** | **CLOSED** | One best-effort fetch on mount (`:99-103`), cancelled on unmount (`:126-128`), **no retry** on failure (`:118-124`). |
| **T-187-R5-06** | EoP | mitigate | **CLOSED** | `WorkflowBuilderPage.tsx:1130` — `if (isCheckOutstanding(validation.kind)) return DEGRADED_SENTENCE["not-run"]`. It sits **below** the flag gate (`:1127`) and **above** every verdict branch (`:1132-1135`); the only branch above it (`:1128`, empty draft) also returns a non-null reason, so nothing can shadow it. A never-ran check can no longer unblock Publish. |
| **T-187-R5-07** | Repud. | mitigate | **CLOSED** | `ProblemsTray.tsx:213-217` — the resting attribution `CHECKED_BEAT` (`= "checked by the server"`, `:87`) renders only when `checking \|\| !degraded`, and `not-run` is a `degraded` member (`verdictModel.ts:124` `TrayCheckCause = DegradedValidationCause \| "not-run"`, sentence at `:132`). The counts line is gated on the same fact: `:148` `showCounts = hasAnyVerdict \|\| degraded === null`. The reason ships in the JSX comment at `:211-212`. |
| **T-187-R5-12** | EoP | mitigate | **CLOSED** | `test_187_route_assigned_reach.py:90` quantifies over the **whole set** (`route_codes = set(workflows._ROUTE_ASSIGNED_CODES)`, `:101`) against `grounding.GROUNDING_VERDICT_CODES` (`:110`), with a **non-vacuity guard at `:105`** that fails if the set is empty. The run-level half at `:125-197` asserts `grounding_verdicts` emits none of them for any constructible input, and re-asserts the fixture actually produced the full vocabulary first (`:187`). Green. |

### 1d. The AI-seed provenance and starter carve-out

| Threat ID | Cat. | Disp. | Status | Evidence |
|---|---|---|---|---|
| **T-187-02-02** | Spoof. | mitigate | **CLOSED — the strongest row in the register** | `workflow_authoring.py:358-367` — `wd.model_copy(update={"phases": [p.model_copy(update={"name_seeded_by_ai": bool(p.name and p.name.strip())}) …]})`. **SERVER-side, AFTER validation** (`forced_emit(schema_model=…)` at `:297-307`, then `_check_grounding_fidelity` at `:335`), **never read off the payload** — stated at `:343-349`, including *why* it matters (the demote-on-config-edit rule clears a generator-seeded name and never a hand-typed one). `model_copy`, never a mutation and never a model validator, per `:351-354`. |
| **T-187-14-01** | EoP | **accept** | **CLOSED** | The picker widens nothing: `StarterTemplatePicker.tsx:70` imports exactly `listStarterWorkflows`. The source fence is at `StarterTemplatePicker.test.tsx:550-554`, and the six other API symbols are mocked and asserted `toHaveBeenCalledTimes(0)` at `:79`. |
| **T-187-14-02** | EoP | mitigate | **CLOSED — proved twice, as claimed** | (1) the `toHaveBeenCalledTimes(0)` sweep at `test:79`; (2) the page-level assertion at `WorkflowBuilderPage.describe.test.tsx:417` — *"NO second forward path: choosing a template writes nothing and generates nothing"* — alongside `:384` proving the choice fills the describe box and **keeps you there**. |
| **T-187-14-05** | DoS | mitigate | **CLOSED** | `StarterTemplatePicker.tsx:257` `if (!open) return null`, `:122` `abortRef`, `:139` `new AbortController()`, `:173`/`:199` `if (!open) return` — the fetch fires on first open, not on mount. |
| **T-187-13-06** | DoS | mitigate | **CLOSED** | `SeedReceipt.tsx:236` `if (!open) return null`, with the no-hidden-DOM rationale at `:116`. |
| **T-187-02-01** | Tamper. | mitigate | **CLOSED (verified at tier-1 depth)** | `backend/app/models/harness.py:263` — `name_seeded_by_ai: bool = False`, inside `class PhaseSpec(_StrictBase)` (`:201`) whose `model_config = ConfigDict(extra="forbid")` (`:35`). **No `@model_validator` on `PhaseSpec`** — the file's two (`:321`, `:335`) are on `WorkflowDefinition`. Pinned by `test_185_engine_attachment.py:297` `test_grounding_declares_no_model_validator_in_CODE` and `test_185_detection.py:425`. |
| **T-187-02-03** | DoS | mitigate | **CLOSED (tier-1 depth)** | The budget is structural: `workflow_authoring.py:309` shot 1, `:325` **exactly one** retry, `:327-332` an honest `could_not_generate` if that fails. There is no third call site. |

### 1e. Faces, receipts and the client-side grounding read

| Threat ID | Cat. | Disp. | Status | Evidence |
|---|---|---|---|---|
| **T-187-04-02** | InfoDisc | mitigate | **CLOSED** | `phaseVocabulary.ts:601-604` — a `skill_ref` miss yields `undefined`, **never the raw id** (comment says so verbatim at `:601`); `:606-613` — `folder_scope` resolves through `ctx.folderNames?.[soleFolderId]`, and only a **single** scoped folder can name a step (`:610`). No id is ever interpolated into a face. |
| **T-187-17-04** | InfoDisc | mitigate | **CLOSED** | Same guarantee under the WR-02 gate: `:570` `if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType))` — a gated-out path falls through to the type sentence, and `folderName` is already a resolved **name** or `undefined`. |
| **T-187-17-01** | Spoof. | mitigate | **CLOSED** | The predicate is the shipped constant, declared once at `phaseVocabulary.ts:277` (`GROUNDING_DIAL_TYPES = ["llm_agent","llm_batch_agents"]`) and reused at `:337` and `:570` — never re-typed, never widened. |
| **T-187-18-01** | Spoof. | mitigate | **CLOSED** | `StepTypePicker.tsx:185` — `const sentence = nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))`. The row is resolved over **the very phase the caller will build**, so it cannot promise a step other than the one it creates (stated at `:9-10`). |
| **T-187-18-04** | InfoDisc | **accept** | **CLOSED** | `PREVIEW_SLUG` exists only to be handed to `nodeTitle` and is never rendered (`:83-84`); `nodeTitle` carries the never-print-a-slug floor (`phaseVocabulary.ts:211-219`); the raw `phase_type` still appears only behind the ⌥ reveal via `technicalTitle` (`:226-230`). |
| **T-187-04-04**, **T-187-13-01**, **T-187-16-02** | Spoof. | **accept** ×3 | **CLOSED** | All three rest on the same verified fact: the run-time gate is **unconditional and server-side**. `backend/app/services/harness/grounding.py:951-958` — `if grounding_cause(phase) == "detected":` synthesizes exactly one `citations_required` post gate (`on_failure="fail_run"`, `max_retries=2`), computed at run time and never stored. A wrong client face is a display bug by construction (D-185-09). |
| **T-187-08-02** | InfoDisc | mitigate | **CLOSED** | An absent map means the tier misses and the generic sentence renders — the safe direction, read at `phaseVocabulary.ts:603-613` (`ctx.skillNames?.[…]` / `ctx.folderNames?.[…]` both optional-chained) and at `:211-219`. |
| **T-187-08-05** | InfoDisc | mitigate | **CLOSED — traced end to end** | Card and tray resolve through the **same** function with the **same** context object: `canvasModel.ts:295` `title: nodeTitle(phase, nameContext)` and `ProblemsTray.tsx:261` `{phase ? nodeTitle(phase, nameContext) : slug}`. |
| **T-187-15-07** | InfoDisc | **accept** | **CLOSED as accepted — ⚠ but its trigger HAS FIRED, WARNING-3** | Still true at HEAD: `definitionOps.ts:360` — `const lead = \`"${nodeTitle(referrers[0])}"\`` — the refusal notice resolves the **undecorated** title while the `Added`/`Removed` notices beside it use `nameContext`. Named, not buried, in `187-15-SUMMARY.md:228-244`, and **asserted** by *"THE DEFERRAL, ASSERTED"* in `WorkflowBuilderPage.canvas.test.tsx`. Re-open trigger: *"Phase 188's `WorkflowCanvas.tsx` extraction."* **That extraction shipped in Phase 188.1 on 2026-08-06** (`14917821` / `718ccd48`) and this item was not closed or re-triaged. |
| **T-187-R4-01** | Repud. | mitigate | **CLOSED** | The receipt renders from an **arrival snapshot**, not the live selector: `WorkflowBuilderPage.tsx:615` `const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[]>([])`, written at `:1228` beside the single `setDrafted` transition, consumed at `:1656` `phases={receiptPhases}`. |
| **T-187-R4-03** | Spoof. | mitigate | **CLOSED** | Same line: `:1228` **replaces** on every `onDraft` success — the comment states it (*"REPLACED per generation, never frozen for the session"*), and there is exactly one `setReceiptPhases` call site in the file (measured). |
| **T-187-R4-02** | InfoDisc | **accept** | **CLOSED — and the compensating control verified** | The accept turns on *"the CANVAS, not the receipt, is the live statement of current governance."* Verified: `canvasModel.isGrounded` derives the seal from live state per render, and `SeedReceipt.tsx:236` renders `null` when dismissed. The copy is past-tense and the card is dismissible and non-blocking. |
| **T-187-R4-05** | EoP | **accept** | **CLOSED — by measurement** | `grep -c "@/lib/api" SeedReceipt.tsx` → **0**. No endpoint, no request, no auth surface, no persisted field, no migration (0-file migration diff, measured). |
| **T-187-R4-06** | Spoof. | mitigate | **CLOSED** | `definitionOps.ts:707-712` — the `escalated` reason is `` `it was set to ${words} by hand` ``. **No principal is named**; the second person is gone. The seal word is composed from `GOVERNANCE_SEAL_LABEL`, never re-typed (`:709-710`). |
| **T-187-16-01** | Repud. | mitigate | **CLOSED** | `definitionOps.ts:578-585` — `seedReceiptGroundingLead(detectedCount)` counts **only** `detected` and returns `""` at zero. Its caller splits the two facts explicitly: `SeedReceipt.tsx:229-230` `detectedCount = rows.filter(row => row.cause === "detected").length` and `carriedCount = rows.length - detectedCount`, with the CR-01 reasoning at `:227-228` (*"Only the second may sit under a sentence that begins 'so I set'"*). |
| **T-187-20-01** | InfoDisc | **accept** | **CLOSED** | The sentence interpolates exactly one value, and it is clamped: `definitionOps.ts:632-633` `seedReceiptCarriedLead(carriedCount)` → `wholeCount(carriedCount)`, whose body at `:529-533` resolves NaN / negative / fractional to a non-negative integer. No author- or model-controlled string can reach it. |
| **T-187-20-03** | Repud. | mitigate | **CLOSED** | The carried paragraph attributes **no cause**; the per-row cause is rendered from `groundingCauseOf` (`SeedReceipt.tsx:213`) and asserted per row. Fenced with a positive control — see the T-187-R4-11 sample. |
| **T-187-10-04** | Spoof. | mitigate | **CLOSED** | The formatter takes the cause and the tool as **inputs** and never classifies: `seedReceiptStepReason(cause, tool)` at `definitionOps.ts:699`, called at `SeedReceipt.tsx:218` with `groundingCauseOf(phase, kbTools)` (`:213`) and `intersectingKbToolOf(phase, kbTools)`. Classification stays in `phaseVocabulary.ts` (D-182-06). |
| **T-187-R4-08** | DoS(meaning) | mitigate | **CLOSED — with the mechanism named precisely** | Two independent fences, both read: (1) **compile-time** — `definitionOps.ts:715-720` `const _never: never = cause`, so a fourth `GroundingCause` is a typecheck error (and `tsc` reports **0** errors naming this file); (2) **construction** — `SeedReceipt.tsx:214` `if (cause === null) continue`, so only the three non-null causes reach a row, and all three return a non-empty sentence. ⚠ The register calls the second half *"a DOM invariant"*; what ships at `SeedReceipt.test.tsx:282-288` is an exact-**membership** assertion, not a non-empty-reason assertion. The em-dash at `SeedReceipt.tsx:339` is unconditional, so the compile-time fence is the one doing the work. |
| **T-187-08-01** | Tamper. | mitigate | **CLOSED (tier-1 depth)** | `grep -c "@/lib/api" canvasModel.ts` → **0**. The name context is an optional option threaded to `nodeTitle` at `:295`. |

### 1f. Input validation / XSS — all seven

Every one of these is CLOSED on the **same measured fact**, stated once: across the entire
`frontend/src` tree there are exactly **two** JSX uses of `dangerouslySetInnerHTML`, both pre-existing
chat-surface renderers untouched by this phase (`components/chat/MarkdownRenderer.tsx:30`,
`components/chat/tool-bodies/ShikiCode.tsx:168`). In **every** Phase-187 component the identifier
appears **only inside docblock prose stating the rule**.

| Threat ID | Cat. | Disp. | Status | Component verified (production `dangerouslySetInnerHTML` count) |
|---|---|---|---|---|
| **T-187-13-04** | V5/XSS | mitigate | **CLOSED** | `SeedReceipt.tsx` → **0**. Names/reasons render as text children at `:337` / `:344`; the rule is stated at `:119-121`. |
| **T-187-16-04** | V5/XSS | mitigate | **CLOSED** | `SeedReceipt.tsx` → **0** (same file, tool ids at `:344`). |
| **T-187-14-03** | V5/XSS | mitigate | **CLOSED** | `StarterTemplatePicker.tsx` → **0**; the seed value flows into a `<textarea>` value via `onChoose`, never into HTML. |
| **T-187-20-02** | Tamper. | mitigate | **CLOSED** | `SeedReceipt.tsx:247` `data-carried-count={carriedCount}` — the same clamped integer (`:230`), rendered by React as an attribute value. Identical treatment to `data-detected-count` at `:244`. |
| **T-187-02-05** | V5 | **accept** | **CLOSED** | The emitted `name` renders as a plain React text child on the canvas — `PhaseNodeCard.tsx` → **0**, `PhaseNode.tsx` → **0**, `WorkflowCanvas.tsx` → **0**. |
| **T-187-04-05** | V5 | **accept** | **CLOSED** | Skill/folder names — same three components, same 0. |
| **T-187-09-05** | V5 | **accept** | **CLOSED** | Title/subtitle — `PhaseSpine.tsx` → **0**, `PhaseNodeCard.tsx` → **0**. |
| **T-187-07-05** | V5 | mitigate | **CLOSED** | Server-side, not client: `test_187_authoring_roster.py:439` — `wd = WorkflowDefinition.model_validate(result["definition"])` runs on **every** roster row; the `extra="forbid"` union IS the mechanism (`harness.py:35`). |

### 1g. Remaining Information-Disclosure rows

| Threat ID | Cat. | Disp. | Status | Evidence |
|---|---|---|---|---|
| **T-187-03-01** | InfoDisc | mitigate | **CLOSED — and its reach re-measured** | `api/workflows.py:755-767` mints `unbound_retrieval` **before any golden run**, keyed on `body.project_folder_id is None` × `grounding.grounding_cause(phase) == "detected"`. Its client reach was measured live during the phase and the comment block corrected accordingly (`:478-513`): the **server** publish gate is unchanged (the code is not in the shared collector) while the **client** Publish control IS gated, via `WorkflowBuilderPage.tsx:1132-1135`. Both halves are fenced — see T-187-R5-11 / -12. |
| **T-187-07-01** | InfoDisc | mitigate | **CLOSED — by measurement** | `test_187_authoring_roster.py:213` — `key_configured=bool(getattr(settings, f"{provider}_api_key", ""))`. A **boolean only**; the key value is never logged, printed or written to the scoreboard. The rule is restated at `:80-82`. |
| **T-187-12-04** | InfoDisc | mitigate | **CLOSED — by measurement** | `grep -nE "fetch\(\|createClient\|supabase\|XMLHttpRequest\|readFile\|@/lib/api" phaseVocabulary.corpus.test.ts` → **no matches**. The module performs no I/O. |
| **T-187-21-05** | InfoDisc | **accept** | **CLOSED** | The pasted gate output is test totals, exit codes and `git diff --stat` over a local repo. Verifier spot-checked `187-19/-21/-29-SUMMARY.md`: no secret, token, connection string or user datum appears. |
| **T-187-R4-18** | InfoDisc | **accept** | **CLOSED — verified by reading, not by a naive grep** | `scripts/vitest-count-gate.cjs` requires **only node builtins**: `:116` `node:child_process`, `:117` `node:fs`, `:118` `node:os`, `:119` `node:path`. The two textual `frontend/src` hits (`:108`, `:372`) are **comments**, one of which is the docblock asserting this property. |

---

## TIER 2 — the supply chain, closed by ONE measurement

Four distinct ids across **ten** register rows: `T-187-20-SC` (mitigate), `T-187-21-SC` (mitigate),
`T-187-R4-SC` (accept ×4), `T-187-R5-SC` (mitigate ×3 + accept ×1 — see WARNING-4).

```
$ git diff --stat d478cee8..726148d2 -- frontend/package.json frontend/package-lock.json \
                                        backend/requirements.txt supabase/migrations/
(0 files changed — empty output, exit 0)

$ git diff --stat d478cee8..HEAD -- <the same four paths>
(0 files changed — empty output, exit 0)

$ bash scripts/check-deploy-drift.sh
RESULT: PASS — the one-box deploy artifacts are in sync.   exit 0
  (2 WARNs, both pre-existing: the ≥#089 seed-like migration review list, and the
   docker-compose parse fallback — the identical two 188.1-SECURITY.md recorded)
```

**All four ids CLOSED.** Zero packages installed and zero migrations added across a 155-commit,
29-plan phase. No `[ASSUMED]` / `[SUS]` package was introduced, so the Package Legitimacy Gate was
never engaged. This measurement additionally discharges **T-187-02-04** and **T-187-19-04**
(the zero-migration rows).

---

## TIER 3 — verified AS A CLASS, with 39 samples

**The class.** 92 rows, overwhelmingly *Tampering* and *Repudiation* about **test-fence and
planning-record credibility**: a `?raw` source fence, a count pin, a positive control, a `git status
--porcelain` cleanliness criterion, a "record, never omit" rule for a manual board, a docblock
corrected to match measured behaviour. They are not product attack surface; they are the phase's own
honesty machinery.

**Class disposition: CLOSED**, on the phase's own gate record — re-run by this verifier, not
transcribed:

- `node scripts/vitest-count-gate.cjs` → **count gate OK · total 2477 · pinned 2477 · failed 0 · 45/45 pinned files present, no per-file decrease**
- backend: **45 passed** (the three `test_187_*` files) + **56 passed** (the three armed-disposition files)
- `npx tsc --noEmit -p tsconfig.app.json` → 33 errors, **0** naming a Phase-187 file
- `git diff --stat` over packages + migrations → **0 files changed**

### The 39 samples, spread across all 29 plans (6 of them from round 5)

| # | Threat ID | Plan | Named fence/pin | Located at HEAD |
|---|---|---|---|---|
| 1 | T-187-01-03 | 01 | *"a companion test pins the `run_gates` fake against the real function"* | ⚠ **CLOSED BY ELIMINATION, mechanism drift.** There is **no fake**: `test_187_armed_checkpoint_property.py:57` heads a section *"REAL VALIDATOR KINDS, NO `run_gates` FAKE"* and `:72` states *"the companion test is not needed — there is no fake."* The threat cannot occur; the declared control does not exist. |
| 2 | T-187-02-01 | 02 | `test_grounding_declares_no_model_validator_in_CODE` | `test_185_engine_attachment.py:297` ✅ (+ `test_185_detection.py:425`) |
| 3 | T-187-02-03 | 02 | budget 1 / 2 / never 3 | `workflow_authoring.py:309`, `:325`, `:327-332` ✅ |
| 4 | T-187-02-04 | 02 | zero migrations | measured — 0 files ✅ |
| 5 | T-187-03-02 | 03 | `test_182_severity_codes.py` exact-set literals | `:202` `("unbound_retrieval", False, "incomplete")` in an exact table; `:138-162` asserts the fail-loud branch is NOT taken ✅ |
| 6 | T-187-03-03 | 03 | no local KB-tool literal in `workflows.py` | `api/workflows.py:766` calls `grounding.grounding_cause(phase)`; rationale at `:747-750` ✅ |
| 7 | T-187-03-04 | 03 | minted in the ROUTE, not the collector | `:755-767` is inside `validate_workflow`; `_ROUTE_ASSIGNED_CODES` (`:514-520`) is disjoint from `grounding.GROUNDING_VERDICT_CODES` — proved by the T-187-R5-12 property ✅ |
| 8 | T-187-04-01 | 04 | CANVAS-01 totality guards | `phaseVocabulary.ts:599`, `:602`, `:610`, `:616`, `:218` — every `PhaseConfigJSON` read guarded ✅ |
| 9 | T-187-04-03 | 04 | one-copy `?raw` guards in both spine suites | `PhaseSpineGraph.test.tsx:22`, `:497`; `PhaseSpine.test.tsx:15`, `:18` ✅ |
| 10 | T-187-06-07 | 06 | event-type count unchanged | `full-schema.sql:1124` — 23-value CHECK containing both types; 0 migrations ✅ |
| 11 | T-187-06-08 | 06 | `test_185_engine_attachment.py:153-165` unmodified | measured — first changed hunk at old line **167** ✅ |
| 12 | T-187-08-01 | 08 | no api-client import in `canvasModel.ts` | `grep -c` → **0** ✅ |
| 13 | T-187-08-04 | 08 | `PhaseNodeCard.tsx` untouched | `git diff --stat d478cee8..726148d2 -- …/PhaseNodeCard.tsx` → **empty** ✅ |
| 14 | T-187-10-05 | 10 | a test forbids "safe"/"approved"/"proven" | `governanceVocabulary.test.ts:138` `BANNED_WORDS`, asserted 0 hits at `:223`, with **planted-literal positive controls** at `:230-259` (including a comment-only case that must NOT hit, and a URL trap that must) ✅ |
| 15 | T-187-11-03 | 11 | `validator: null` value **and key presence** | `harness_engine.py:1289-1294` + rationale `:1283-1286` ✅ |
| 16 | T-187-12-03 | 12 | corpus self-check on fixture + phase counts | `phaseVocabulary.corpus.test.ts:156` *"registers at least the 15 fixtures / 36 phases"*, `:161`, `:181`, `:202`, `:221` ✅ ⚠ the plan said *"27 well-formed rows, max 5 phases"*; the shipped self-check reads 15 / 36 |
| 17 | T-187-13-03 | 13 | the no-staging-animation source fence | `SeedReceipt.test.tsx:1144-1156` — `STAGING_NEEDLES`, plus `not.toMatch(/\.map\(\s*\([^)]*,\s*(index\|i)\b/)` and `not.toMatch(/delay/i)`; needles assembled from parts (`:59`) ✅ |
| 18 | T-187-13-06 | 13 | `open === false` renders `null` | `SeedReceipt.tsx:236` ✅ |
| 19 | T-187-14-05 | 14 | AbortController-scoped, first-open fetch | `StarterTemplatePicker.tsx:122`, `:139`, `:173`, `:199`, `:257` ✅ |
| 20 | T-187-15-04 | 15 | storage-API grep returns 0 | measured **0**; guard at `canvas.test.tsx:499-500`/`:810-811`/`:2731-2732` ⚠ not `:414-418` |
| 21 | T-187-16-01 | 16 | lead counts only `detected` + word-class fence | `definitionOps.ts:578-585`; `SeedReceipt.tsx:229-233` ✅ |
| 22 | T-187-16-05 | 16 | every `citation_policy` literal checked against the backend `Literal` **at live HEAD** | `SeedReceipt.test.tsx:118-123` names the source; `backend/app/models/harness.py:158` reads `Literal["strict","flag","partial","draft"]` — **re-verified identical at HEAD**; fixtures use `"strict"` (`:182`) and `"draft"` (`:214`) ✅ |
| 23 | T-187-17-02 | 17 | the constant reused, never re-typed | one declaration `phaseVocabulary.ts:277`, two uses `:337`/`:570` ✅ |
| 24 | T-187-17-05 | 17 | tier (3)'s docblock rewritten with measured evidence, incl. the `LlmEmitPhaseConfig` refutation | `phaseVocabulary.ts:531-570` — ~40 lines of cited evidence, naming `LlmEmitPhaseConfig.folder_scope` at `:556-561` and `_folder_scope_requires_project` at `:566-567` ✅ |
| 25 | T-187-18-02 | 18 | zero `PHASE_TYPE_SENTENCES` reads in the picker | `StepTypePicker.test.tsx:511` — identifier **assembled from parts** (`["PHASE","TYPE","SENTENCES"].join("_")`), occurrence count asserted `toBe(0)` at `:517`, with `nodeTitle` + `minimalPhaseFor` positive controls at `:518-519` ✅ |
| 26 | T-187-19-04 | 19 | zero-migration gate re-measured with raw output | 0 files ✅ |
| 27 | T-187-20-04 | 20 | testid-coverage guard | `SeedReceipt.test.tsx:1060-1085` — widened extraction regex covering `data-testid="…"`, `{"…"}` and `{'…'}`, with the three blind spots named at `:1064-1066`; comment-stripped subject at `:1254` ✅ |
| 28 | T-187-20-05 | 20 | count gate exits 0, five-suite total > 452 | gate re-run → OK, total **2477** ✅ |
| 29 | T-187-R4-01 | 22 | the snapshot + its three-input-path fence | `WorkflowBuilderPage.tsx:615`/`:1228`/`:1656` ✅ |
| 30 | T-187-R4-08 | 23 | the `never` guard | `definitionOps.ts:715-720` ✅ (see the tier-1 entry for the precise mechanism) |
| 31 | T-187-R4-11 | 24 | WR-09 deny-list + **positive control** | `SeedReceipt.test.tsx:576-591` three deny assertions across three drafts, then `:593-601` *"POSITIVE CONTROL — the ROW still names the cause the paragraph withholds"*, with the reason at `:594-596` ✅ (the `seed-receipt-step-judgement` testid resolves — it is slug-derived from the `ESCALATED_PHASES` fixture, not a missing hook) |
| 32 | T-187-R4-14 | 25 | both CR-03/CR-04 suites pinned | `scripts/vitest-count-gate.cjs:145` `SeedReceipt.test.tsx: 68`, `:416` `StarterTemplatePicker.test.tsx: 40` ✅ |
| 33 | T-187-R4-15 | 25 | pins from the gate's own printed `actual`, never a hand count | `vitest-count-gate.cjs:200-205` states it verbatim and forbids hand-counting `it(` literals *"which is unsound under `it.each`"* ✅ |
| 34 | **T-187-R5-09** | **27** | one debounced request per opened draft; zero-step drafts issue nothing | `WorkflowBuilderPage.tsx:810` — `phases.length > 0` is the zero-step guard ✅ |
| 35 | **T-187-R5-10** | **27** | `verdictModel`'s `?raw` purity guards re-run | `verdictModel.test.ts:22` `?raw` import, `:238` `FORBIDDEN_CODES` negative, `:248` `not.toMatch(/fetch\(/)`, `:226` *"each with a positive control proving the regex"* ✅ |
| 36 | **T-187-R5-13** | **28** | grep pin **ranked beneath** the property, needles from parts, each with a control | `test_187_route_assigned_reach.py:268-269` needles assembled; `:273-292` `test_the_needles_can_actually_match` — each control matches its own needle, **not** the other's, and a clean sentence matches neither ✅ |
| 37 | **T-187-R5-14** | **28** | comment-only change, proved by a comment-lines-only diff | **measured**: `git show 67b8025d -- backend/app/api/workflows.py` = 46 ins / 6 del; a comment+blank filter over that diff yields **ZERO** non-comment changed lines ✅ |
| 38 | **T-187-R5-15** | **29** | all three round-5 suites pinned | `vitest-count-gate.cjs:210-212` — `DescribeKbPicker.test.tsx: 37`, `ProblemsTray.test.tsx: 30`, `verdictModel.test.ts: 29`; gate reports **no per-file decrease** ✅ |
| 39 | **T-187-R5-16** | **29** | every number from the gate's `actual` column, hand counts forbidden | `vitest-count-gate.cjs:200-209` ✅ |

### The 53 unsampled tier-3 rows — read this plainly

`T-187-01-02` · `01-04` · `03-05` · `05-03` · `07-02` · `07-03` · `07-04` · `08-03` · `09-01` ·
`09-02` · `09-03` · `09-04` · `10-01` · `10-02` · `10-03` · `11-01` · `11-05` · `12-01` · `12-02` ·
`13-02` · `13-05` · `14-04` · `14-06` · `15-03` · `15-05` · `15-06` · `16-03` · `16-06` · `17-03` ·
`18-03` · `18-05` · `19-01` · `19-02` · `19-03` · `21-01` · `21-02` · `21-03` · `21-04` · `R4-04` ·
`R4-07` · `R4-09` · `R4-10` · `R4-12` · `R4-13` · `R4-16` · `R4-17` · `R5-11` · `R5-17` · `R5-18` ·
`R5-19`, plus `07-01`/`07-04`'s siblings already measured above.

**These 53 were NOT read by this verifier.** They are recorded CLOSED on the phase's own gate record —
`187-VERIFICATION.md` (`status: passed`, 13/14), the per-plan SUMMARY Threat-Model-Compliance tables,
and the four green gates re-run above. That is a weaker basis than a tier-1 row and it is labelled as
such deliberately. Three of them were, in fact, partially observed in passing and hold
(`07-02` roster derived from `MODEL_CAPABILITIES` at `test_187_authoring_roster.py:180-217`;
`07-04` `grep -c monkeypatch` → 0; `R5-11` the corrected `_ROUTE_ASSIGNED_CODES` comment at
`api/workflows.py:478-513`) — those three are upgraded to sampled in the count if a future verifier
prefers; the tally above keeps them conservative.

⚠ **`T-187-07-03` carries a recorded deviation** (found while sampling `07-01`): the declared control
was a **module-level `pytestmark = pytest.mark.skipif(...)`**. What shipped is a **per-row gate inside
the live test** — `test_187_authoring_roster.py:387` `if not os.environ.get(OPT_IN_ENV):` → block-and-skip
at `:245`. The deviation is deliberate and reasoned in-source at `:66-73`: a module-level skip would
also skip `test_roster_is_derived_from_the_live_registry`, which is T-187-07-02's mitigation and needs
no key. **The declared property holds** (`pytest tests/ -q` makes no provider call); the declared
mechanism does not exist.

---

## THE ONE OPEN ROW — T-187-SEED-133 (registered by the verifier, not by the plans)

| Field | Value |
|---|---|
| **Threat ID** | `T-187-SEED-133` |
| **Category** | Repudiation / Information Disclosure (an unhonest "we checked" over a check that could not run) |
| **Component** | `backend/app/services/workflow_authoring.py` — the NL-seed path, i.e. **this phase's SC#2 headline surface** |
| **Disposition** | **`accept` + register** — operator decision, 2026-08-06, at the `/gsd:secure-phase 187` gate |
| **Status** | **CLOSED (accepted)** — see the disposition record at the end of this entry |
| **Severity** | **Medium.** Not `block_on: high`: it is an integrity/honesty defect, not a confidentiality or authorization break, and it manifests only during a folder/skill registry outage. |

**The finding, measured by this verifier rather than inherited:**

```
$ grep -c "degraded" backend/app/services/workflow_authoring.py
0        (exit 1 — zero occurrences in a 377-line file)
```

`_assemble_grounding` (`workflow_authoring.py:153-188`) calls the shared
`assemble_grounding_bundle` and returns **`(grounded_prompt, bundle.tool_names, bundle.skill_ids)`**
at `:188` — **discarding `bundle.degraded`**. `generate_workflow_definition` consumes exactly that
tuple at `:280-287` and never learns the registry read failed.

The bundle's own contract says this is precisely what must not happen. `grounding.py:128-140` declares
`degraded: frozenset[str]` as *"THE ONE DEGRADATION SIGNAL"* and states the contract **both consumers**
rely on: *"when `degraded` is non-empty the grounding FIDELITY rules MUST NOT be run and MUST NOT be
reported."* The set is populated at `:386` (`"folders"`) and `:416` (`"skills"`).

**Both sibling consumers honour it. This one does not:**

| Consumer | Behaviour on a degraded read |
|---|---|
| `POST /workflows/validate` | `api/workflows.py:685-690` — `if bundle.degraded: findings.append(grounding.grounding_unavailable_finding(bundle.degraded))`. Honest. |
| `GET /workflows/grounding-bundle` | serializes its own `degraded` field (`grounding.py:325`). Honest. |
| **`POST /workflows/generate`** | **discards it.** The model is handed an empty folder tree and skill registry, emits a folder-blind draft, `_check_grounding_fidelity` passes **vacuously**, and the route returns `{ok: true, definition}` — presented to the author as a normal seed. |

**Why it belongs on Phase 187's ledger.** `SEED-133`'s re-open trigger was *"when Phase 187 is
scoped."* It fired, unnoticed, and 187 is the phase that built the NL-seed surface (SC#2) and the seed
receipt that narrates it (SC#6 / Req 5). A folder-blind draft additionally suppresses the
`unbound_retrieval` verdict this same phase introduced (D-187-11 / `BUG-260731-03`), because a draft
with no folders offered is a draft the author cannot bind.

**This is NOT a declared-mitigation-absent BLOCKER** — the plan-time register never named it, so no
mitigation was promised and none is missing. It was escalated because it is real, verified, on this
phase's own surface, and had **no disposition at all**.

---

### Disposition record — `accept` + register (operator, 2026-08-06)

**Decided at the `/gsd:secure-phase 187` gate**, with the fix option presented and declined for this
phase. Accepted on this reasoning:

1. **Nothing unsafe ships.** The folder-blind draft still passes through `POST /workflows/validate`
   and the full publish gauntlet before anything can be published, and both of those *do* honour
   `bundle.degraded`. The blast radius is a misleadingly confident **first draft**, not an unsafe
   published workflow.
2. **It manifests only during a registry outage** — the folder/skill read has to actually fail.
3. **The fix is not `/gsd:fast`.** Threading `degraded` from `_assemble_grounding`
   (`workflow_authoring.py:153-188`) to the consumer at `:280-287` is ~10 lines, but surfacing it
   changes the **`POST /workflows/generate` response shape**, which needs a frontend consumer check
   and a plan. Doing it inside a security-audit pass would be exactly the "closure round smuggles in
   a capability" pattern G-7 exists to stop.

**⚠ This is the SECOND deliberate deferral of this finding, and that is why the trigger below is
worded differently from the last one.** SEED-133's original trigger read *"when Phase 187 is
scoped"* — a condition that fired, silently, and was noticed only by today's `/gsd:audit-milestone`
sweep, months of work later. A trigger that depends on someone remembering to re-read a seed is not
a trigger. The replacement is bound to a named phase and to a mechanical check:

> **RE-OPEN TRIGGER (binding).**
> **(a) Phase 189 — `/gsd:discuss-phase 189` MUST surface this row.** 189 is the next phase touching
> the authoring/generation surface (governed external-action node model), and its discuss-phase
> already owes one mandatory item (the `PhaseNodeCard.tsx` G-5 refactor recommendation). This is the
> second. Both are recorded in `STATE.md`.
> **(b) Mechanical, phase-independent:** the moment
> `grep -c degraded backend/app/services/workflow_authoring.py` returns **non-zero**, this row is
> superseded and must be re-verified rather than re-accepted. While it returns **0**, the accept
> stands and the defect is present.
> **(c) Immediate escalation:** if `POST /workflows/generate` ever gains a consumer that treats its
> `ok: true` as evidence the grounding registry was READ — as opposed to merely evidence the model
> returned a valid definition — this stops being Medium and must be fixed before that consumer ships.

**What a future verifier should check rather than take on trust:** that `_assemble_grounding` still
returns a 3-tuple discarding `bundle.degraded` at `:188` (if it returns 4, the fix landed), and that
`api/workflows.py`'s validate path still branches on `bundle.degraded` — because the accept's whole
justification is that the sibling consumer is honest. If the sibling ever stops branching, the
downstream catch this acceptance rests on is gone and the disposition is void.

**SEED-133 itself is NOT closed by this acceptance** — it remains an open seed with the sharpened
trigger above written back into it.

**Suggested dispositions, for the operator to choose between — not for this auditor to pick:**
1. `mitigate` — thread `bundle.degraded` out of `_assemble_grounding` and refuse/annotate the seed.
   Roughly 1 file / ~10 lines on the return path plus the route's response shape → **not** `/gsd:fast`,
   because it changes an API response the client reads.
2. `accept` + register — with a concrete re-open trigger (e.g. *the first author-reported folder-blind
   draft*, or *the next phase touching `workflow_authoring.py`*), on the ground that a registry outage
   is rare and the draft is not persisted until the author saves.

---

## Accepted Risks Log — all 22 plan-time `accept` dispositions

| Risk ID | Threat Ref | Rationale (verified, not quoted) | Tier | Status |
|---|---|---|---|---|
| AR-01 | T-187-01-04 | Plan modified no production file. `git status --porcelain backend/app` clean at HEAD. | 3 | registered |
| AR-02 | T-187-02-05 | `name` renders as a React text child; `dangerouslySetInnerHTML` count **0** across the canvas components. | 1 | registered |
| AR-03 | T-187-04-04 | Face is display-only; the run-time gate is server-side and unconditional (`grounding.py:951-958`). | 1 | registered |
| AR-04 | T-187-04-05 | Same 0-count as AR-02. | 1 | registered |
| AR-05 | **T-187-06-09** | The armed-phase / synchronous-publish hole. `_interactive_phase_failures` (`publish_service.py:500-540`) still ignores `action_risk_armed`. **Dual concrete trigger recorded** (`187-CONTEXT.md:546-552`); neither has fired. | 1 | registered |
| AR-06 | T-187-13-01 | Display-only client read; server gate unconditional (D-185-09). | 1 | registered |
| AR-07 | T-187-14-01 | `GET /workflows/starters` is a documented un-gated RUN CARVE-OUT over `is_system_global` published rows (mig-056). The picker names exactly one api symbol. | 1 | registered |
| AR-08 | **T-187-15-07** | A refusal notice can name a step differently from the `Added`/`Removed` notices beside it (`definitionOps.ts:360`). Asserted by a test so it cannot be closed silently. ⚠ **Trigger has FIRED — WARNING-3.** | 1 | registered |
| AR-09 | T-187-16-02 | Same as AR-06. | 1 | registered |
| AR-10 | T-187-18-04 | `PREVIEW_SLUG` is never rendered; the raw type stays behind the ⌥ reveal. | 1 | registered |
| AR-11 | T-187-18-05 | `minimalPhaseFor` builds ≤ 6 plain object literals in a transient menu; no memo warranted. | 3 | registered |
| AR-12 | T-187-20-01 | One interpolated value, clamped by `wholeCount` (`definitionOps.ts:529-533`). | 1 | registered |
| AR-13 | T-187-21-05 | Raw gate output carries no secret/token/connection string/user datum. | 1 | registered |
| AR-14 | T-187-R4-02 | The snapshot can show governance the author has since changed. The **canvas** is the live ledger; the receipt is past-tense, dismissible and non-blocking. A live-tracking receipt is the strictly worse failure (that is CR-04). | 1 | registered |
| AR-15 | T-187-R4-05 | No endpoint, request, auth path, persisted field or migration. `@/lib/api` count in `SeedReceipt.tsx` = **0**. | 1 | registered |
| AR-16 | T-187-R4-07 | After the R4-06 fix an author who really escalated a step sees a sentence with no principal named. The client holds no provenance for that bit; re-opening second-person phrasing requires a `name_seeded_by_ai`-shaped marker. | 3 | registered |
| AR-17 | T-187-R4-13 | Editing `phaseVocabulary.ts` risks VOCAB-01's one-copy `?raw` guards; accepted **with a control** — both spine suites are inside the verify command and stayed green (gate: 0 failed). | 3 | registered |
| AR-18 | T-187-R4-18 | The gate script imports only node builtins (`:116-119`). | 1 | registered |
| AR-19 | T-187-R4-SC | No package-manager install; the Package Legitimacy Gate was not engaged. **Measured: 0 files changed.** | 2 | registered |
| AR-20 | T-187-R5-05 | One best-effort fetch on mount, cancelled on unmount, no retry (`DescribeKbPicker.tsx:99-129`). | 1 | registered |
| AR-21 | T-187-R5-10 | A widened union in a pure module; `verdictModel`'s `?raw` purity guards re-run green. | 3 | registered |
| AR-22 | T-187-R5-14 | Comment-only change to `workflows.py`. **Measured: 0 non-comment changed lines in `67b8025d`.** | 3 | registered |

*(`T-187-R5-SC` is declared `accept` by plan 187-29 and `mitigate` by 187-26/-27/-28 — see WARNING-4.
It is counted once, as `mitigate`, and discharged at tier 2 either way.)*

---

## Threat flags raised by this phase

**21 of 29 summaries declare `## Threat Flags: None`**, and the verifier confirmed the substance
independently: this phase created **zero** migrations, **zero** new network endpoints (it wires
existing `POST /workflows/generate`, `POST /workflows/validate`, `GET /workflows/starters`,
`GET /folders`), **zero** new auth paths and **zero** file-access patterns. It added one production
backend behaviour (the hoisted armed checkpoint), one net-new production component
(`DescribeKbPicker.tsx`, 194 L), two mounted components on one page, and a large body of vocabulary
and test surface.

**Unregistered flags — informational, none a blocker:**

1. **`DescribeKbPicker.tsx` — a net-new production component on the one RLS/org-scoped seam of the
   phase, shipped by plan 187-26, whose summary carries no `## Threat Flags` section at all.** The
   verifier read the component in full: one api symbol, no route literal, no `fetch(`, no store, no
   navigation, no free-text id path, a totality floor on nameless folders, and a settled-state
   surrender of any unofferable held id. **No new attack surface.** Recorded so the absent declaration
   is auditable rather than invisible.
2. **Plan 187-27 shipped a production behaviour change** (the widened `useLiveValidation` `enabled`,
   `WorkflowBuilderPage.tsx:810`) with no `## Threat Flags` section. The verifier read it: the
   `canvasEnabled &&` conjunct preserves D-181-01 exactly, and the change is pinned by a zero-call
   assertion observed RED (P-20, per `187-27-SUMMARY.md`).

---

## Non-blocking warnings

| # | Finding | Where | Why it is not a blocker | Suggested owner |
|---|---|---|---|---|
| **WARNING-1** | **The phase's single most important threat has no live confirmation.** `187-UAT.md` row 13 — *"An armed checkpoint cannot be preempted (SC#6 live)"*, source **M6 (Req 7 / SC#6) — the folded SEED-137 threat** — reads **`result: [pending]`**. The board's own summary is `total: 14 · passed: 6 · pending: 7 · blocked: 1` and its frontmatter still reads `status: testing`. `187-VERIFICATION.md` scores SC#6 *"✓ VERIFIED (automated); live row owed"*. **An automated pass is not a live pass**, and this file does not record it as one. | `187-UAT.md:82-86` | The automated property is genuinely strong and was **re-run green by this verifier** (45 passed), and the shipped source structure was read line by line (T-187-06-01/-02/-04/-05/-06). The residual risk is an integration seam no unit test observes — the ask_user rendezvous through the live chat `PendingAskCard`. | Run UAT-13 first, before Phase 189 opens. It is the row that would falsify SEED-137 end to end. |
| **WARNING-2** | **UF-5 recurring, and worse than in 188.1.** 8 of 29 summaries carry **no `## Threat Flags` section**: `187-02, -03, -07, -25, -26, -27, -28, -29`. Six of the eight are round-4/round-5 closure plans, and **two of those shipped production code** (see § Threat flags). `188-SECURITY.md` logged this as UF-5; `188.1-SECURITY.md` logged it again as WARNING-3; this is its third consecutive appearance. | the eight summaries | The verifier assessed both production changes directly and found no new attack surface. A missing declaration is a **repudiation/process** gap, not an exploitable one. | The executor template: make `## Threat Flags` a **hard section gate** in `execute-phase`, so an omission fails rather than reads as "None". Three phases of evidence now support it. |
| **WARNING-3** | **Two accepted deferrals whose re-open trigger has FIRED.** Both `T-187-15-07` (the refusal notice's undecorated title) and `187-VERIFICATION.md` deferred item #1 (**WR-08** — `StepTypePickerProps` has no `nameContext`, so the ＋ row can promise a different sentence than the card that lands) name the same trigger: *"Phase 188's `WorkflowCanvas.tsx` extraction."* **That extraction shipped in Phase 188.1 on 2026-08-06** (`14917821`, `718ccd48`). Neither item was closed or re-triaged. | `187-15-SUMMARY.md:237`; `187-VERIFICATION.md` § Deferred Items #1-2 | Both are naming-consistency defects on notice copy, not safety holes. Both remain **asserted by a test**, so neither can be closed silently. | Phase 189's discuss-phase — alongside the `PhaseNodeCard.tsx` G-5 refactor it already owes. Re-triage both: close, or re-date the trigger. A trigger that has fired and been ignored is worse than no trigger. |
| **WARNING-4** | **One id, two dispositions.** `T-187-R5-SC` is declared **`mitigate`** by plans 187-26 / -27 / -28 and **`accept`** by 187-29. `T-187-R4-SC` is consistently `accept` across its four rows. | `187-26/-27/-28/-29-PLAN.md` | The measurement discharges it either way (0 packages, 0 migrations). No disposition depends on the difference. | n/a — recorded so the 130/27 row split and the 129/22 id split are both explicable rather than looking like an arithmetic error. |
| **WARNING-5** | **A register sentence that is stronger than the code.** T-187-06-02 asserts *"`_failing_on_failure` is not called at all when `is_action_risk`."* It **is** reachable on an armed call, via `harness_engine.py:1065-1066` (`redis is None or run_id is None` → `_route_on_failure` → `:898`). | `187-06-PLAN.md` T-187-06-02 | The **property** holds and was proved, not assumed: `_route_on_failure` returns `skip_to`/`fail_run` and **never `None`**, and the caller runs the body only on `None` (`:798-801`). The no-transport path fails **closed**. | Free-ride on the next edit to that docstring. The precise claim is *"never reached on the path that can run the body."* |
| **WARNING-6** | **Two declared controls that do not exist, both closed by elimination.** (a) T-187-01-03's *"companion test pins the `run_gates` fake against the real function"* — there is **no fake** (`test_187_armed_checkpoint_property.py:57`, `:72`). (b) T-187-07-03's *"module-level `skipif`"* — replaced by a per-row gate at `test_187_authoring_roster.py:387`, for a reason recorded in-source at `:66-73`. | as cited | In both cases the **threat is eliminated rather than mitigated**, which is strictly stronger. Recorded because a future verifier grepping for the declared control would find nothing and could wrongly report a gap. | n/a — closed by this record. |
| **WARNING-7** | **`187-UAT.md` and `187-VERIFICATION.md` disagree with each other and with HEAD.** The verification body table reads *"Score: 11/14 truths verified. 2 FAILED (both BLOCKER-class)"* at `:215` while its frontmatter reads `status: passed` / `13/14`. Both are true of different moments — the two BLOCKERs were closed by direct fix (`12069204 + f2a43fc9`, `e854a505 + f2a43fc9`) rather than a round 6, per G-7. The verifier **independently re-verified both closures**: the CR-R5-01 surrender effect at `DescribeKbPicker.tsx:151-156`, and the pins at `vitest-count-gate.cjs:210-217` with the gate reporting 45/45 and no decrease. | `187-VERIFICATION.md:215` vs `:4-5` | Both blockers are genuinely closed at HEAD and were re-measured here, not taken on trust. The stale body table is a snapshot, and the closure block above it says so. | Free-ride on the next edit. The **artifact figures** in that same file (`DescribeKbPicker.tsx` 167 L, test pinned 30) are pre-fix and are corrected in § *Citation drift*. |

**None of the seven meets `block_on: high`.** All are process, documentation or precision-of-wording;
none changes a disposition, and none is user-reachable.

---

## What a future verifier should NOT take on trust from this file

Stated plainly, because the tiering is only honest if its edges are:

1. **The 53 unsampled tier-3 rows** were not read. They rest on `187-VERIFICATION.md`, the per-plan
   SUMMARY compliance tables, and the four gates re-run here — not on this auditor's reading of a
   fence.
2. **Every RED-first observation in this phase** rests on a SUMMARY sentence. The verifier read the
   guards and the falsifications out of shipped source and re-ran every suite green, but did **not**
   revert the tree to re-observe RED. This includes the P-20…P-25 probes, the `[count-decrease]`
   observations behind `T-187-R5-15`, and the HEAD-RED signature behind `T-187-01-01`.
3. **T-187-11-02's AST function-body compare** against plan-11's HEAD rests on `187-11-SUMMARY.md:201`
   / `:223-226`. What the verifier measured independently is weaker and stated as such in that row.
4. **UAT-13 / M6 was not performed by anyone**, and this file records it as owed rather than as done.

Everything else in this register was read out of shipped source or re-executed at HEAD `a51e12d3`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Accepted | Tier 1 / 2 / 3-sampled | Run By |
|---|---|---|---|---|---|---|
| 2026-08-06 | 152 | 151 | 1 | 22 | 55 / 4 / 39 | `gsd-security-auditor` (`/gsd:secure-phase 187`) |

---

## Sign-Off

- [x] All 151 plan-time threats have a disposition and a stated basis, tier-labelled
- [x] Tier-1 rows verified individually against shipped source with `file:line`
- [x] Tier-2 rows closed by a re-run measurement with raw output printed
- [x] Tier-3 class disposition stated, with 39 samples (6 from round 5) and the unsampled 53 named
- [x] Accepted risks documented in the Accepted Risks Log (**23** entries — 22 plan-time + T-187-SEED-133)
- [x] Implementation files never modified — this audit created exactly one file
- [x] `threats_open: 0` — **met 2026-08-06.** `T-187-SEED-133` was escalated to the operator gate and
      dispositioned `accept` with a phase-bound re-open trigger (not fixed, and the file says so)
- [ ] UAT-13 (M6 / SC#6 live) performed — **STILL OWED.** Run it first.

**Approval:** ✅ **SECURED 2026-08-06** at HEAD `a51e12d3` — 152/152 dispositioned, 0 open.

**Two things this approval explicitly does NOT claim:**

1. **T-187-SEED-133 is accepted, not fixed.** The defect is present in shipped code right now:
   `grep -c degraded backend/app/services/workflow_authoring.py` returns **0**. The acceptance rests
   entirely on the downstream `/validate` + publish gauntlet catching it — if that sibling ever stops
   branching on `bundle.degraded`, this disposition is void. See the disposition record above.
2. **SC#6 has an automated pass, not a live one.** `test_187_armed_checkpoint_property.py` +
   `test_187_authoring_step_names.py` = 38 passed, re-run by the verifier at HEAD. But **UAT-13 /
   M6** — driving an armed action-risk checkpoint end-to-end against an author-declared pre-gate on
   a real run — is `result: [pending]`. SEED-137 was folded into this phase precisely because that
   preemption shipped once already. The property is proved in the unit estate and **unproved on the
   live surface**, and this file will not read as though it were both.
