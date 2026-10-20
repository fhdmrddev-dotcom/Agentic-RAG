# Phase 281: A Refusal Names Its Cause - Research

**Researched:** 2026-10-14
**Phase base:** `ae7928a92` (develop). Last migration on disk: `206_retention_hold_hardening.sql`. No migration expected.
**Domain:** harness emit-failure reporting (backend), publish-gauntlet and describe-door refusal copy (frontend), KB freshness SQL
**Confidence:** HIGH. Every load-bearing claim below was measured in code or in the local database at the phase base.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Emit failure cause (FIX-09)

Measured at discuss. There are two defects, and each needs its own fix:
- **(a) Engine precedence.** The emit executor returns `_emit_failure_output(...)` with no `field_map`.
  The declared `citations_required` validator then runs on that output, reports
  `"no field_map on output"`, and that string becomes `_failure_reason`, `run_failed.reason` and the
  gauntlet's `named_failures`. This is the "least informative error wins by being last" defect.
- **(b) Executor taxonomy.** `phase_types.py` ~1641-1686 rejects for any of three reasons: uncited
  values, invented citations, or missing template keys (`missing_keys`). All three go out as one
  failure value, `citation_gate_rejected`, with one message that names all three possibilities. So
  "citation" can appear when only keys were missing.

- **D-01:** When attempts fail for different reasons, the author reads **every distinct cause, each
  with its attempt count**. Approved shape:
  ```
  Step "Write the report" failed after 3 attempts:
  • 2 attempts — filled the template, but these fields were missing: report_owner, findings
  • 1 attempt — the model wrote prose instead of filling the template
  ```
  Identical causes merge with a count. A cause that never happened is never named. "citations" appears
  **only** when the citation check itself failed (uncited or invented values).
- **D-02:** Missing template fields are named by the **placeholder names the author wrote in their
  template**: the first 5, then `and N more`.
- **D-03:** Each cause carries **one server-written "what to check" line**, worded as *check*, never
  *fix* and never a promise. Example for missing keys: *"Check that the template's field names match
  what this step produces."* It is written on the server, so the client still holds no cause table.
  This keeps 192 CR-01 and the 193.2-06 honesty constraints.
- **D-04:** **One string, everywhere.** The same cause text appears in the publish gauntlet's
  `blocked_step` reason, the chat failure message (`_surface_failure_message`) and the run page's
  failed step. There is one composer and one writer, with no per-surface re-wording.
- **D-05:** Defect (a) is fixed by **cause precedence inside the existing engine and executor**. An
  executor that already diagnosed its own failure wins over a post-gate validator that only sees a
  shape. Defect (b) is fixed by splitting the rejection into distinct failure values or causes inside
  `_exec_llm_emit`. ⛔ No new validator kind, phase type or executor (roadmap Flags: closed core).
- **D-06:** SC#1 is proven twice: as a fixture reproducing the `Compliance Gap Report` shape
  (`covers_template: false`, 100% citation coverage), and **once live**.

#### Golden-run link (FIX-10, BUG-260815-06 #4)

- **D-07:** *"(view coming soon)"* and its disabled button (`PublishGauntlet.tsx` `RunLink`, ~383) are
  replaced by a **working link** that opens `WorkflowRunPage` for the golden run through the existing
  `openRunSurface` path. Measured: the gauntlet's only live publish call site is the canvas-flagged
  Builder, so the "flag off" arm cannot render. If research finds otherwise, the flag-off arm **drops
  the phrase and the button**. No new schedule promise is ever added in its place.
- **D-08:** Label: **`▦ Open the golden run that was judged ›`**. The 8-character id fragment is
  removed.
- **D-09:** The run page opens **on the failed step if it already supports focusing or expanding a
  step**. If that would need new run-page work, it opens at the top, and step focus is recorded as
  deferred rather than built here.
- **D-10:** The link must not cost the author their draft. The publish `draft_changed` commit stage
  implies the draft is saved at publish time. Research confirms this before planning relies on it.

#### Describe-door refusals (FIX-10, SEED-221)

- **D-11:** Every describe-door refusal renders as **one plain sentence plus one next step**. All
  sentences come from **one translation table beside `doorVocabulary.ts`**, and that table is the only
  place a code becomes words.
- **D-12:** The raw code is **hidden by default**. With the existing app-wide *Show technical names*
  toggle on (`useTechnicalNamesOptional().showTechnical`, `WorkflowBuilderPage.tsx:1334`), it shows small
  after the sentence. The two-audience reveal is reused. No new toggle.
- **D-13:** `connection_not_allowed` is emitted for **three** situations
  (`workflow_authoring.py:417/426/446`). Each gets **its own sentence**. The server adds an **additive
  sub-reason field** beside the unchanged `error` code; the existing wire fields keep their meaning.
- **D-14:** Approved draft wording. The planner polishes it against the gauntlet's worded-verdict rules
  (sketch-findings `publish-gauntlet.md`) and the never-say list (no "coming soon", "later", or any
  other unowned promise):

  | code / sub-reason | sentence | next step |
  |---|---|---|
  | `connection_not_allowed` · no service chosen | This step acts outside the app, but no connected service is chosen for this workflow. | Choose one under Connected services, then try again. |
  | `connection_not_allowed` · service not allowed | This step uses a connected service this workflow isn't allowed to use. | Pick an allowed service, or ask an admin. |
  | `connection_not_allowed` · action not allowed | That service doesn't allow the action this step needs. | Choose a different action or service. |
  | `no_authoring_model` | No model is set up for drafting workflows. | Choose one in Settings, then try again. |
  | `could_not_generate` | The model couldn't produce a usable draft. | Try again, or describe the work in more detail. |
  | *unknown code* (fallback) | Something stopped the draft from being written. | Try again. |

  ⚠ Research confirms *where* the authoring model is set, and who can set it, before the
  `no_authoring_model` next step is finalised. The next step must not send a member to a door they
  cannot open.
- **D-15:** `test_214_argument_seams.py`'s `test_S7_…_shows_the_RAW_CODE` is **inverted**. The
  rendered screen shows the sentence and **not** the code, and an unknown code falls back to a sentence,
  never to the code. The table covers **all three codes plus the fallback**, not only
  `connection_not_allowed`.

#### Freshness (DEBT-07)

- **D-16:** `harness/freshness.py` (both queries: the `max(created_at)` query and the stem-collision
  query) counts only retrievable documents, by **importing `RETRIEVABLE_COLUMN`** from
  `retrieval_scope.py`. It must not restate the predicate. This is proven RED-first. `freshness.py` uses
  raw SQL, so the imported constant is a fixed identifier and never user input.
  `retrieval_scope.py` itself is **not edited**: its ledger says extraction FIRST next, and an import
  does not touch it.

#### G-4 lived-experience scenarios (operator-defined at scope time)

Chrome MCP drives each scenario. Every assertion reads the rendered **words**, never the presence of a
block.
- **D-17 · A — Emit miss at publish.** Publish `Compliance Gap Report` live. **FAIL if** the word
  "citations" appears, the missing fields are not named, or the step shows as a slug instead of its
  canvas name.
- **D-18 · B — Golden-run link.** On a refused publish, click *Open the golden run…*. **FAIL if**
  "coming soon" appears anywhere, the button does nothing, or it opens a different run.
- **D-19 · C — Describe-door refusal.** Draft a workflow whose step needs an unchosen service. **FAIL
  if** `connection_not_allowed` shows with technical names OFF, or no next step is given. With the
  toggle ON, the code appears small.
- **D-20 · D — Freshness with an archived doc.** Run a freshness-checked step over a folder whose
  newest document is archived. **FAIL if** the archived document's date decides the verdict. This is
  proven by the run's verdict on screen plus a DB read.

#### Guardrail decisions recorded at discuss

- **D-21 · G-2 skip (recorded, not silent; OV-266-01 is what an unrecorded skip cost).** No sketch.
  Every change sits on layouts that already shipped: the gauntlet's worded verdict, the describe
  door's error line and the run page. Copy is governed by the sketch-findings skill
  (`publish-gauntlet.md`, `node-vocabulary-and-reveal.md`).
- **D-22 · G-5.** These files FIRE: `phase_types.py`, `validator_kinds.py`, `workflow_authoring.py`,
  `PublishGauntlet.tsx`, `doorVocabulary.ts`, `WorkflowBuilderPage.tsx` (×6), `harness_engine.py` and
  `publish_service.py`. Each change is **honoured by construction**: one composer, one table, one
  import, no new branch family. Anything that is not gets recorded under
  `STATE.md → Guardrail overrides`. The new translation table is a **new leaf file** beside
  `doorVocabulary.ts`, not growth of it. The planner reads each file's section in
  `docs/HOT-FILE-LEDGER.md` first.
- **D-23 · G-8.** Target **3-4 plans**: emit cause precedence + taxonomy · gauntlet link + describe-door
  table · freshness (it may ride the emit plan) · G-4 drive + close.

### Claude's Discretion
- The exact merge key for "same cause" across attempts, and which attempt counter is user-facing.
  Engine gate retries and `_EMIT_MAX_ATTEMPTS = 3` executor attempts are different counters. Pick the
  one whose count matches what the author would call "an attempt", and state it in the plan.
- The wire shape of the per-cause list on `blocked_step`. It must be additive and must keep
  `step_name: null`-not-backfilled.
- The name of the describe-door sub-reason field.

### Deferred Ideas (OUT OF SCOPE)
- **Run page step focus.** If the run page cannot already land on a given step, that capability is
  deferred (D-09), not built here.
- **Emit cause (b) root cause.** Whether `deepseek-v4-flash` is weak at large forced emission, or the
  placeholder spotlight is too faint (and the `forced: false` while `tier: "force"` oddity), is out of
  scope. This phase makes the failure *legible*; it does not make the model succeed.

#### Reviewed bugs (not folded)
- `BUG-260828-05` (send receipt names the SMTP host, not the recipient). It is in `phase_types.py`, but
  a receipt naming the wrong target is not a refusal naming its cause. Left open by operator decision
  at this discuss (2026-10-14).
- `BUG-260609-02` (phantom "Sub-task" in Sub-Results) and `BUG-260610-01` (run timer reset on nav).
  These are harness UI surfaces this phase does not touch. Left open.

#### Seeds sweep note
- `node scripts/check-seeds-register.cjs --phase 281` exited FATAL because no phase directory existed
  yet. `SEED-221` was already folded at milestone intake. **Re-run the sweep at plan-phase**, once
  `files_modified` exists.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-09 | When an emit step fails, the reported cause is the check that actually failed, never "citations" when citation coverage was 100%. (`BUG-260730-02`) | §Finding 1 (the golden run's real audit trail: 9 sealed shots under 3 engine attempts), §Finding 2 (taxonomy split, consumers), §Pattern 1-3 (per-shot records → one composer → engine precedence) |
| FIX-10 | A publish-gauntlet refusal shows the precise `harness_audit` reason in plain words, never a machine code. (`BUG-260815-06` #4 + `SEED-221`) | §Finding 3 (one string to three surfaces), §Finding 4 (the gauntlet IS reachable flag-off, so prop presence decides the link; no step focus exists), §Finding 5 (4 codes, not 3; the authoring model has no Settings door; the picker label is not "Connected services") |
| DEBT-07 | `harness/freshness.py` excludes archived (`retrievable=false`) documents. (W-1) | §Finding 6 (both queries, import-by-concatenation, reload-based non-restatement proof) |
</phase_requirements>

## Summary

The golden run that produced `BUG-260730-02` (`43b34171-…`) is still in the **local** database, and its audit trail settles the counter question. Measured: **3 engine gate attempts** (`gate_failed` attempt 0/1/2) wrapped **9 sealed forced-emit shots** (3 per engine attempt). Shots were: 7 × `emit_rejected` with `covers_template: false` (the template's collection `rows` was never emitted), 2 × `emit_failed` (narration). **Shot 1 also had 2 uncited values** (`citation_coverage_pct: 94.7`). The validator's words were wrong in **two different ways**. Engine attempt 1 reported `citations_required: uncited=0 invented=36`, because the executor's failure output carries a `field_map` but no `retrieved_ids`, so every cited value reads as "invented". Attempts 2 and 3 reported `no field_map on output`. The first wrong message was also fed back into the model's prompt as `ctx.retry_feedback`.

The fix has three parts. First, the executor writes one small record per sealed shot. Second, a single new pure module (`harness/emit_cause.py`) is the one composer, used by the executor, by the engine's gate path and by the no-validator `fail_phase` branch. Third, the engine applies one precedence rule: when the output carries an executor `failure`, the composed cause replaces the validator's string, and the reason is written without the `Phase N (slug) gate failed after k attempt(s):` prefix. With that prefix gone, `_failure_reason`, `blocked_step.cause`, the chat message and the run-page card all carry the identical string. `publish_service.py` and `validator_kinds.py` need **no edit**.

The frontend has three surprises. First, the gauntlet **is** reachable with the canvas flag off: `actionGroup` mounts `renderPublish` on both header branches (`WorkflowBuilderPage.tsx:1547`, `:2753`). So the link must gate on an `onOpenRun` prop that `WorkflowsPage` already holds as `canvasEnabled ? openRunSurface : undefined`. Second, `harness_authoring_model` is an **env-only** setting (`config.py:1510`) with no API and no UI, so *"Choose one in Settings"* sends everyone to a door that does not exist. Third, the service picker's real label is *"Services this workflow may use"* (`doorVocabulary.ts:417`), and it sits on the **loose door**, not on the Builder screen where the refusal renders. There is also a **fourth** describe code, `grounding_failed`, which D-14's table omits.

**Primary recommendation:** Count **sealed shots** as the author's "attempts". Compose once in a new leaf `harness/emit_cause.py`. Let the engine prefer the executor's diagnosis and write it verbatim. Split `citation_gate_rejected` into a new `template_fields_missing` failure value. Carry the per-cause list inside the existing `cause` string (newline bullets), not as a new wire field.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classify each forced-emit shot's cause | API / Backend (`_exec_llm_emit`) | — | Only the executor holds the gate verdict, the oracle and `missing_keys` per shot |
| Compose the cause sentence + "check" lines | API / Backend (new `harness/emit_cause.py`) | — | D-03/D-04: server owns the words, one composer |
| Cause precedence over a validator | API / Backend (`_run_phase_with_gates`) | — | The engine is where validator text currently wins |
| Persist the cause | Database (`workflow_phases.output._failure_reason`) | — | Already the single durable source read by publish, run page and thread APIs |
| Render the cause | Browser (PublishBlockedStepCard, PhaseCard) | — | Verbatim text child; only `whitespace-pre-line` is new |
| Golden-run link | Browser (PublishGauntlet ← WorkflowsPage `onOpenRun` ← ChatLayout `openRunSurface`) | API (`GET /workflow-runs/{id}`, canvas-gated) | No router; navigation is a state switch |
| Describe refusal sub-reason | API / Backend (`_check_allowed_connections`) | — | Additive wire field beside `error` |
| Describe refusal words | Browser (new `describeRefusalVocabulary.ts`) | — | SEED-221: the one sanctioned code→words seam for codes the server does not word |
| Freshness scope | Database query (`freshness.py`) | — | Predicate name imported from `retrieval_scope.RETRIEVABLE_COLUMN` |

## Standard Stack

No new libraries. Everything uses what is already installed and in use.

### Core (existing, verified in repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI + Pydantic | in `backend/venv` | API + response models | project stack (CLAUDE.md) |
| asyncpg | in `backend/venv` | `freshness.py` raw SQL via `ctx.pool` | existing pool (`dependencies.get_pg_pool`) |
| pytest (+asyncio) | 9.0.x (from pycache tags) | backend tests | `pytest tests/unit -q --continue-on-collection-errors` is the gate |
| React + vitest | vitest 4.1.0 (measured run) | frontend tests | `GSD_VITEST_MAX_WORKERS=2` |
| `marked` (`breaks: true`) | existing | chat message render | `MarkdownRenderer.tsx:7`: single `\n` already renders as a line break, so newline bullets work in chat without markdown list syntax |

**Installation:** none.

## Package Legitimacy Audit

This phase installs **no external packages**. slopcheck was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | No packages installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Measured Findings (the ten asks, with file:line evidence)

### Finding 1: How an emit failure flows, and which counter "3 attempt(s)" was (asks 1, 8)

**Two nested loops, verified:**
- **Executor loop:** `phase_types.py:1549` runs `for attempt in range(1, _EMIT_MAX_ATTEMPTS + 1)` (`_EMIT_MAX_ATTEMPTS = 3`, `:1120`).
  - State (a), narration or truncation or `provider_error` (`result.get("failure")`, `:1596`), returns **immediately** on that shot (`:1609`). It does not retry inside the executor.
  - State (b), a gate reject (`:1640-1653`), retries with feedback only `if retrieved_ids and attempt < _EMIT_MAX_ATTEMPTS` (`:1655`). Otherwise it is final (`:1675-1686`).
- **Engine loop:** `harness_engine.py:1087` runs `while True` in `_run_phase_with_gates`. It retries while `attempt < phase_max_retries` (validator `max_retries`, starter = 2 → 3 attempts) and not `identical` (`:1151-1162`).
- **The reason string** is composed in `_route_on_failure` (`harness_engine.py:1201-1203`): `f"Phase {phase.phase_index + 1} ({phase.slug}) gate failed after {attempt + 1} attempt(s): {error_message}"`. The ask_user variant is `:1525-1527` (`"… validation flagged: …"`).
- **No validator declared:** `run_gates` passes, the outcome is `completed`, and `run_workflow`'s branch at `harness_engine.py:2467/2512-2516` calls `fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)`.
  - ⚠ **`_failure_reason` is then the raw taxonomy CODE** (e.g. `citation_gate_rejected`). PhaseCard's "recorded reason" arm (`PhaseCard.tsx:346-352`) renders it verbatim on a reloaded run page. That is a machine code on screen today. The run then **continues and terminalizes `completed`** (`:2541-2544`, decided semantics, out of scope).

**Golden run `43b34171-35d9-4884-9f12-0d76f42b1352`, measured in the local DB** (`harness_audit` ordered by `created_at`; `workflow_runs.user_id = d8a54002…`, `is_golden_run = true`, `thread_id = b74ef7d8…`):

| engine attempt | sealed shots (executor) | executor return | validator `gate_failed.error` |
|---|---|---|---|
| 0 | rejected (cov 94.7%, **uncited 2**, `covers_template false`) · rejected (100%, ctf) · rejected (100%, ctf) | `citation_gate_rejected` **with** `field_map`, **no** `retrieved_ids` | `citations_required: uncited=0 invented=36 offending=[]` ← **false "invented"** |
| 1 | rejected (100%, ctf) · rejected (100%, ctf) · `emit_failed` (narrated) | `model_failed_to_emit`, no `field_map` | `citations_required: no field_map on output` |
| 2 | rejected · rejected · `emit_failed` | same | same |

`run_failed.reason` = `Phase 2 (emit) gate failed after 3 attempt(s): citations_required: no field_map on output`. `workflow_phases.output` for `emit` = `{"_failure_reason": <that string>}` **only**. The fail_run path (`:2387`) persists no field map.

**So "3 attempt(s)" was the ENGINE counter.** There were 9 model calls behind it.

**Why the validator says "invented=36":** `validator_kinds.py:340-355` runs `check_coverage(fm, set(output.get("retrieved_ids") or []), …)`. `retrieved_ids` and `placeholder_keys` are added **only** on the success return (`phase_types.py:1834-1835`). They never appear on `_emit_failure_output` (`:1329-1345`). ⚠ **Do not "fix" this by adding `retrieved_ids` to the failure output.** The validator would then PASS (`uncited=0 invented=0`), the gate passes, the phase drops into the no-validator `fail_phase` branch, the engine stops retrying, and the run continues as `completed`. That changes control flow, not just words.

**Chat side-effect, measured:** the golden run's thread holds **4** assistant failure messages. Three are executor-surfaced, one per engine attempt (`phase_types.py:1608/1685`). The fourth is the engine's `fail_run` surface (`harness_engine.py:2398`). The `_surfaced` flag only stops `_surface_final_answer` (`:437`). It does not dedupe `_surface_failure_message`.

**Per-attempt evidence in `harness_audit` is NOT sufficient for the aggregator (it corrects the CONTEXT claim):**
- `emit_rejected.gate_verdict` carries `covered_keys`, `covers_template` and the counts. It does **not** carry the placeholder list or the `missing_keys` names (`_emit_audit_metadata`, `:1236-1271`).
- `emit_failed` for state (a) carries **no `attempt` key** (`:1603-1606`, no `["attempt"]` assignment).
- **Recommendation:** aggregate from **in-memory per-shot records**. Optionally add `missing_keys` and `attempt` to the audit metadata additively, for legibility. No new event kind is needed. The CHECK constraint is untouched.

**The `identical` short-circuit hazard:** `identical = output == last_output` (`:1151`). Today two consecutive `model_failed_to_emit` outputs are byte-equal (fixed text). If the per-invocation records or the composed text are added to `output`, equality changes and the short-circuit fires less often, which costs extra engine attempts. **Compare on a projection that excludes the diagnostic keys** (`text`, `attempt_causes`). Pin this with a test.

### Finding 2: Taxonomy (b), oracle agreement, and who consumes the failure value (ask 2)

- Reject branch `phase_types.py:1640-1712`. The pass condition is `uncited == 0 and invented == 0 and not (oracle and missing_keys)`. Every reject, and the non-strict WR-06 fallback (`:1700-1710`), returns `citation_gate_rejected`. The fixed message names all three causes (`:1678-1683`).
- **State (a) also lumps three causes.** `forced_emit` returns `failure ∈ {None, "model_failed_to_emit", "provider_error"}` plus a `truncated` flag (`forced_emit.py:234, 393`). `:1596-1609` words every one of them as "narrated prose or was truncated", including a **provider outage**.
- **`covers_template` vs executor `missing_keys`:**
  - `covers_template` = `set(placeholder_keys) <= present_keys`, top-level keys only (`template_render_service.py:446-488`).
  - The executor's `missing_keys` = placeholders not in `covered_keys` (`:1628`), **plus** `coll.col` column misses, computed only when that collection was emitted with rows (`:1632-1639`).
  - They agree at top level. The executor's list is a strict superset. **Use the executor's `missing_keys`, which is the more specific of the two.**
  - Without an oracle (non-docx), `placeholder_keys` = the emitted keys, so `missing_keys` is always empty and is ignored (`not (oracle and …)`).
- **Placeholder names (D-02)** come from `_template_oracle(src)` → `parse_docx_template_variables` (`template_render_service.py:356`). Measured on the real starter template `scripts/pm-pack/templates/compliance-gap-report.docx`:
  `{'scalars': ['report_date','report_title','scope'], 'collections': ['rows'], 'columns': {'rows': ['current_state','gap','owner','requirement','severity','source_clause']}}`.
  **The golden run's only missing key was `rows`.** The model emitted the collection under another name. So the honest live message names `rows`, not `report_owner, findings` (the D-01 preview was illustrative).
- **Frontend consumers of the failure value (closed taxonomy):**
  - `types/index.ts:1328-1333`: the `EmitFailure` union, 5 members.
  - `PhaseCard.tsx:222-248`: `EMIT_FAILURE_COPY: Record<EmitFailure,…>`. `citation_gate_rejected` reads *"uncited or invented values"*. It takes precedence (`:283-286`) whenever `phase.emitFailure` is set by the live `phase_substep` SSE (`StreamsProvider.tsx:1412-1418`). **This is a third surface that says "citations" for a keys-only miss.**
  - `runVocabulary.ts:181-195`: an exhaustive `switch` over `EmitFailure`. An unknown member falls to `default` → the weakest clause.
  - `phaseNodeCardContract.ts:231`: type only.
  - An unknown value is **safe**: PhaseCard checks `phase.emitFailure in EMIT_FAILURE_COPY` and falls through. So a new backend value does not break render. Adding it to the union makes `Record<EmitFailure,…>` force the copy entry at typecheck.
- **Recommendation:** add one value, `template_fields_missing`, used when a shot's reject had **no** uncited or invented values and only missing keys. Keep `citation_gate_rejected` for any shot where the citation check failed. The terminal `failure` value is the classification of the shot that ended the invocation. Frontend: +1 union member, +1 `EMIT_FAILURE_COPY` entry (cause-neutral, no "citation"), +1 `case` in `runVocabulary` (→ `CLAUSE_FAILED_CHECKS`). No migration. `phase_transition.metadata.failure` is a free string (`harness_engine.py:2554`). No `harness_audit` CHECK change.

### Finding 3: One string to three surfaces, and the `_surfaced` rule (ask 3)

- **Publish path:**
  - `publish_service._blocked_step` (`:979-1046`) reads `_failure_reason` (`:1026-1027`). It strips `_REASON_PREFIX = r"^Phase\s+\d+\s+\({slug}\)[^:]*:\s*"` (`:932`) to make `cause`, and keeps the full string as `reason`.
  - `_structural_failures` (`:1098-1105`) puts the same `_failure_reason` into `named_failures`.
  - The wire model is `PublishVerdict.blocked_step: BlockedStep | None` (`api/workflows.py:1273-1293`). The client mirror is `lib/api/knowledge.ts:554-588`. The render is `PublishBlockedStepCard.tsx`: headline via `nodeTitle`, then `<p data-testid="blocked-step-cause">{blocked.cause}</p>` verbatim.
  - **If the engine writes the composed cause WITHOUT the `Phase N (slug)…:` prefix, `_REASON_PREFIX` does not match and `cause == reason == composed`. `publish_service.py` needs no edit** (`:1037-1038`).
- **Chat:** `_surface_failure_message(ctx, run_id, outcome.reason, pool)` (`harness_engine.py:2398`). Rendered through `marked` with `breaks: true`, so `\n• ` lines render as lines.
- **Run page:**
  - `WorkflowRunPage` → `PhaseTimeline` → `PhaseCard.classifyFailure`.
  - On a reconciled run (the golden-run link case), `phase.emitFailure` is **unset** (SSE-only), so `failureReason` (= `_failure_reason`) renders verbatim (`:346-352`) in a `<span>` (`:773`) with **no `whitespace-pre-line`**.
  - The panel is `hidden … lg:flex` (`WorkflowRunPage.tsx` run-panel `aside`). **It is invisible below the `lg` breakpoint**, so a G-4 drive needs a wide viewport.
- **Prefix decision (needed for D-04):** the engine prefix's "after k attempt(s)" counts **engine** attempts. If the composed body counts **shots**, the chat and run page would show two different totals in one string. For executor-diagnosed failures, write the composed cause **verbatim as the reason**. That needs a keyword-only flag through `_resolve_failure_with_ask_user` → `_route_on_failure`, defaulting False, so every other caller is byte-identical. It also removes the slug from all three surfaces for this class.
- **`_surfaced` constraint:** keep `_emit_failure_output`'s `_surfaced: True`, which `_surface_final_answer` reads (`:437`). The executor's per-invocation `_surface_failure_message` calls remain. Recommended: give each one the composed per-invocation string from the same composer. The **last** chat message (engine `fail_run`) is then the aggregate, equal to the gauntlet's cause. Collapsing to one message is a separate behaviour change. It is listed as an Open Question, not recommended here.

### Finding 4: Golden-run link, flag arms, focus, draft safety (ask 4)

- `RunLink` is at `PublishGauntlet.tsx:379-405`. It is rendered at `:1140` (block) and `:1141` (success with a run).
- **The gauntlet's ONLY call site is `WorkflowsPage.tsx:942-984` (`renderPublish`).** It is rendered in **both** flag arms. `WorkflowBuilderPage.tsx:1547` (docblock) and `:2753` (`{renderPublish(…)}` inside `actionGroup`) mount it on both header branches. **D-07's measured premise is refuted. The flag-off arm CAN render the gauntlet**, so it must drop the phrase and the button.
- **Mechanism already exists:**
  - `ChatLayout.tsx:503-509` `openRunSurface(runId)` → `setActiveRunId` + `onNavigate("workflow-run")`.
  - `ChatLayout.tsx:951-955` passes `onOpenRun={canvasEnabled ? openRunSurface : undefined}` into `WorkflowsPage`.
  - `WorkflowsPage.tsx:253` already declares `onOpenRun?: (runId: string) => void` (SEED-190, RunLogPanel precedent: *"ABSENT WHEN THE CANVAS LAYER IS OFF … renders … as plain text rather than as controls that go nowhere"*).
  - **Threading = one optional prop on `PublishGauntlet` (`onOpenRun?`) passed from `renderPublish`.** Prop absent → render nothing in RunLink's run arm. The golden-run id still appears in the raw-verdict disclosure (`VerdictRow name="golden_run_id"`, `:366`).
  - The `no-run-note` arm (golden_run_id null) is unchanged.
- **Server side:**
  - `GET /workflow-runs/{id}` (`api/workflow_runs.py:722-747`) is `require_canvas()`-gated and owner-scoped (`.eq("user_id", current_user["id"])`). It has no `is_golden_run` filter.
  - The golden run's row carries the publisher's `user_id` and a real `[validation] publish golden run — …` thread (`publish_service.py:1519-1531`, measured on `43b34171`). **The run page can load it.**
- **D-09:** `WorkflowRunPage({ runId, onBack, onOpenThread })` (`WorkflowRunPage.tsx:426`) has **no step-focus prop**. `openRunSurface` takes only `runId`. `RunStepList` expands only for citations (`expandedSlugs`, `RunStepList.tsx:139`). **→ Open at the top, record step focus as deferred.** The failed step's reason still shows in the right panel (`lg+`).
- **D-10, corrected:**
  - The gauntlet always checks the **stored** draft row (`stage0_token` / `draft_changed`, `publish_service.py:522-534`). The Builder holds autosave while publish runs (`PublishGauntlet.tsx` `onRunningChange`, D-186-12). The inner publish is blocked while a write is `saving` (`WorkflowBuilderPage.tsx:1575`).
  - **But `draft_changed` is about the server row, not about unsaved client edits.** `blockedReason` does **not** block a dirty-but-not-yet-saving draft, and `openRunSurface` is **app-level navigation that bypasses the Builder's leave guard**. Only `backToLibrary` consults it (`WorkflowsPage.tsx:787-797`, `WorkflowBuilderPage.tsx:1986-1989`, `UNSAVED_LEAVE_PROMPT` `:482`).
  - **Recommendation:** in `renderPublish`, wrap the link callback with the existing guard: `(id) => { if (canLeaveBuilderRef.current && !canLeaveBuilderRef.current()) return; onOpenRun(id) }`. This adds no state.
  - Returning via `onBack` lands on the Workflows library (`ChatLayout.tsx:1030`), not the open Builder. The draft is on the server, so re-opening it is safe.

### Finding 5: Describe door (ask 5)

**Codes (`workflow_authoring.py`, re-measured; `generate_workflow_definition` docstring `:658-660` lists FOUR):**

| code | site | detail today (shown verbatim in `errorDetail`) |
|---|---|---|
| `connection_not_allowed` · nothing ticked | `:417-425` | `phase '<slug>' acts outside the app, but no connected service was chosen…` (**slug**) |
| `connection_not_allowed` · connection not in allowed set (incl. `connection_id is None`) | `:426-434` | `phase '<slug>' names a service that was not chosen…` |
| `connection_not_allowed` · tool not in granted actions | `:445-454` | `phase '<slug>' uses an action that is not allowed…` |
| `no_authoring_model` | `:679-684` (none resolved), `:686-691` (no provider) | `no authoring model resolved (Settings.harness_authoring_model unset)` |
| `could_not_generate` | `:701-708` (no user settings), `:782-787` (2 shots failed) | `model_failed_to_emit` etc. |
| **`grounding_failed`** (missing from D-14) | via `harness/grounding.py:334-337`, `:1032/1037/1042` | `phase '<slug>' references a non-registered tool …` |

- **Wire:** `POST /workflows/generate` (`api/workflows.py:1871-1911`) returns the service dict as a 200. Client type `GenerateResult` (`lib/api/knowledge.ts:768-770`): `{ ok: false; error: string; detail?: string }`. **The sub-reason must be added to this type too.**
- **Render path:**
  - `useTemplateFirstDraft.ts:621-623`: `store.getState().setErrorState(result.error, result.detail)`.
  - Catch arm `:625-629`: `setErrorState("Couldn't generate the workflow.", e.message)`.
  - `builderStore.ts:439-444` → `errorMessage` / `errorDetail`.
  - `WorkflowBuilderPage.tsx:2177-2190`: `Couldn't generate — {errorMessage}`, then `{errorDetail}`, then *"Nothing was saved. Adjust your description and try again."*
  - **This is the only render site.** `useTemplateFirstDraft.ts:627` is the catch arm feeding the same render, not a second render.
- ⚠ **Catch-arm subtlety:** `generateWorkflow` throws `Error(entitlementRefusalMessage(...))` on a non-OK HTTP response (`lib/api/workflows.ts:963`, `_core.ts:50-62`). An entitlement 403 therefore reaches `errorDetail` as a plain-English plan sentence (*"Your plan doesn't include …"*). The fallback must not swallow that sentence.
- **Builder store invariant (ledger):** `builderStore` "every key this store puts on `meta` reaches the wire". Error fields are root keys, not `meta`, so they are safe. Prefer **not editing `builderStore.ts`**. The hook can store a table key (e.g. `connection_not_allowed:no_service`) as `errorMessage`, and the page resolves it through the table.
- **Where the authoring model is set (D-14 ⚠):**
  - `resolve_authoring_model` (`workflow_authoring.py:200-222`) reads `settings.harness_authoring_model`, which is **`app.config.Settings` (pydantic-settings, env var), `config.py:1510`**. Otherwise it uses the registry default `claude-opus-4-8` / `gpt-5.5` if `forced_emission`.
  - **Grep: no API field, no `app_settings` key, no frontend reference.** `harness_judge_model` *is* in `api/settings.py:350/910`, gated `require_visible("model_management")`. The authoring model is not.
  - **No member or operator can "choose one in Settings".** The only real remedy is infra (an env var, or a registry row for a default model).
  - Recommended next step: *"Ask whoever runs this workspace to set up a drafting model."* (operator to confirm).
- **"Connected services" does not exist as a label.** The picker is `SERVICES_LABEL = "Services this workflow may use"` (`doorVocabulary.ts:417`). It is mounted on the **loose door** (`WorkflowDoorSwitch.tsx:820`). The refusal renders on the **Builder's** describe screen after the hand-off (`WorkflowDoorSwitch.tsx:396-416`, `initialAllowedConnectionIds`). The next step must name the real label (**imported**, never re-typed, because of the D-24(a) fence) and say the author goes back to it.
- **S-7 tests** (`backend/tests/integration/test_214_argument_seams.py:1062-1117`):
  - They are **source-regex reads**, not renders. `:1101` `setErrorState\(\s*result\.error`, `:1104` `errorMessage:\s*message`, `:1107` `"{errorMessage}" in page`, `:1110-1117` assert `connection_not_allowed` absent from three vocab modules.
  - **"Reaches a rendered screen" is honestly done the S-1 way** (`:424-461`): assert the target vitest files exist, run `npx --no-install vitest run <paths>` with `GSD_VITEST_MAX_WORKERS=2`, and require evidence of executed cases (*"vitest exited 0 with no evidence"*).
  - **Inversion:** (1) every code + sub-reason + an unknown code resolves through the new table (a vitest render test asserts the sentence text and that the code string is **absent** with technical names off, and present with it on); (2) S-7 runs that vitest file via the S-1 harness; (3) the source assertions flip so the page renders the table's output, not raw `{errorMessage}`.
- **Copy-fence constraint:** `WorkflowDoorSwitch.test.tsx` D-24(a) sweeps `WorkflowBuilderPage?raw`, `useTemplateFirstDraft?raw` and others (`SWEPT_SOURCES`, `toHaveLength(6)` at `:654`) for any `doorVocabulary` literal.
  - A new module on the door surface joins `SWEPT_SOURCES` in the same commit (precedent comments `:30-33`). That bumps `6 → 7`, and the module needs ≥ 1000 characters (`:656`).
  - Any door word it needs (e.g. `SERVICES_LABEL`) must be **imported**.
- **Pinned copy that will move (deliberate re-baseline, recorded):**
  - `WorkflowBuilderPage.preDraft.baseline.test.tsx:381/384` (`flagOff:error` / `flagOn:error` byte-for-byte markup incl. *"Couldn't generate — Couldn't generate the workflow."*).
  - `WorkflowBuilderPage.test.tsx:224` (`/could not generate/i`).
  - `WorkflowBuilderPage.canvas.test.tsx:2599-2603`.
  - `useTemplateFirstDraft.test.tsx:426-474`.
  - Count-gate pins: `WorkflowBuilderPage.test.tsx: 15`, `preDraft.baseline: 22`, `useTemplateFirstDraft.test.tsx: 58`, `doorVocabulary.test.ts: 41`. Rule: no per-file decrease.
- Backend tests that pin the codes: `test_214_describe_vocabulary.py:193/217/245` (one per `connection_not_allowed` arm, the natural home for sub-reason asserts), `test_2141_describe_declares_inputs.py:412`, `test_103_nl_generate.py:203/281`, `test_187_authoring_step_names.py:355`, `test_workflow_authoring_requirement.py:1187`.

### Finding 6: Freshness (ask 6)

- `harness/freshness.py` (113 L, **1 commit / 1 phase**, no ledger row).
  - `newest_document_age_days` SQL is at `:56-63`: `SELECT max(created_at) … WHERE folder_id = ANY($1::uuid[])`.
  - `exact_stem_collisions` SQL is at `:96-103`: `SELECT filename … WHERE folder_id = ANY($1::uuid[])`.
  - Both are triple-quoted literals passed to `pool.fetchrow` / `pool.fetch`. Neither has any archive or latest predicate. (It also counts non-latest versions. That is not DEBT-07; do not widen.)
- Consumer: `validator_kinds._validate_freshness` (`:663-731`, `timing="pre"`). Staleness = newest age > `max_age_days`. **An archived recent document today makes a stale folder read FRESH.** After the fix the verdict flips to `freshness:staleness|…`. This is the D-20 observable.
- `RETRIEVABLE_COLUMN = "retrievable"` (`retrieval_scope.py:78`): a mig-205 STORED generated boolean (`archived_at IS NULL AND (source_state IS NULL OR source_state='live')`).
  - Importers: `kb.py`, `document_relationship_service.py`, `document_view_resolver.py`, `expert_scope_statement.py`, `retention/agent_wall.py`, `retrieval_documents.py`. **All of them use it through supabase-py `.eq(RETRIEVABLE_COLUMN, True)`. None splices it into raw SQL.**
  - `retrieval_scope.py:154-156` itself restates `retrievable` as a literal *because* `test_272_scope_resolver.py:371 test_no_f_string_sql` forbids f-string SQL there. That guard scans **retrieval_scope.py only**.
- **Recommended form:** build module-level SQL constants by **plain concatenation at import**, e.g. `_NEWEST_SQL = "SELECT max(created_at) AS newest FROM documents WHERE folder_id = ANY($1::uuid[]) AND " + RETRIEVABLE_COLUMN`. Guard it with an import-time `assert RETRIEVABLE_COLUMN.isidentifier()`. This is not an f-string, it carries no user input, and it is not a restatement.
- **RED-first proof (unit, no DB):** a fake pool records the SQL → assert `RETRIEVABLE_COLUMN` appears in both statements (RED today).
- **Non-restatement proof:** monkeypatch `retrieval_scope.RETRIEVABLE_COLUMN` to a sentinel identifier, `importlib.reload(freshness)`, and assert the sentinel is in both statements. A restated literal would fail. (`importlib` in a **test** is fine. The `test_255` dynamic-code ban covers the 17 trigger files only, and `freshness.py` is not one.)
- Existing tests: `tests/unit/test_freshness.py` (5 tests, patch the two functions; unaffected).
- No other freshness-like query restates the predicate. Two near-misses are different semantics and out of scope: `retention/disposition.py:365/734` (`archived_at IS NULL`, the retention writer's own guard), and `document_search_service.py:223` (an `include_archived` filter).

### Finding 7: G-5 binding invariants (ask 7)

Re-derived with the CLAUDE.md recipe at `ae7928a92`:

| File | measured triple | ledger row says | Binding invariants / named seam (from `docs/HOT-FILE-LEDGER.md`) |
|---|---|---|---|
| `harness/phase_types.py` | 54 / 27 / 2954 | 54/27/2954 (current) | The extraction obligation is **OWED**. Named seam: *one module per executor under `harness/`* (200-03 took `human_input.py`). "A phase that adds a SECOND concern … produces a refactor recommendation first." **→ The composer lives in a new leaf `harness/emit_cause.py`. `phase_types.py` gains only record-appends + calls (a call-out, not a concern).** The leaf must **never import `phase_types`** (the 200-03 invariant; guard with `grep -cE '^\s*(from\|import)\s+.*phase_types'` → 0, driven RED). `phase_types.py:84` imports `validator_kinds`, so watch for cycles. |
| `harness_engine.py` | 60 / 23 / 3297 | 60/23/3297 | "Honoured by construction" is claimed **by AST arithmetic** (the 256-05 precedent: `if 2 → 2`, AST-measured defs/calls). Named seam OWED: the `run_workflow` loop vs `_run_phase_with_gates` vs armed checkpoint vs resume. Imports from `app.services.harness.*` must be **function-local** (the cycle at `:1080-1086`). Do not touch the escape handler, `cancel_phase`, `finish_run` or the pause arm's sliced region (`test_200_human_gate_pause.py`). |
| `harness/publish_service.py` | 29 / 13 / 1942 | 29/13/1942 | **Recommended: NOT modified.** If touched: golden-run failures must preserve `golden_run_id`; no new stage word / `blocked_stage` / audit kind; `step_name` never backfilled with the slug. |
| `harness/validator_kinds.py` | 15 / 7 / 791 | 15/7/791 | **Recommended: NOT modified** (precedence lives in the engine). `VALIDATOR_REGISTRY` stays exactly the 10 kinds (`test_255:115-136`). |
| `workflow_authoring.py` | **16 / 10 / 1002** | 15/9/989 (**STALE**) | The four `{"ok": False}` returns stay "byte-untouched" apart from the additive key. A failure never carries `definition`/`readiness`. `None` vs `[]` for `allowed_connection_ids` must never collapse. Named seam: grounding-assembly vs definition-shaping (unchanged). |
| `PublishGauntlet.tsx` | **19 / 9 / 1343** | 17/9/1289 (**STALE**) | Both "no override" guards were measured blind; only a **role-SET scan** catches a planted override (keep the HardWall untouched). Named seam: stage strip vs verdict. The 214-10 precedent is new refusal render → own leaf. The RunLink change is one optional prop + one branch. |
| `WorkflowBuilderPage.tsx` | 56 / 21 / 2977 | 56/21/2977 | Honoured ×6 **by probe**: `useState[(<]` 21→21, `useEffect(` 7→7, `fetch(` 0→0. A SWEPT SOURCE of the D-24(a) copy fence: never spell a door word here, always import. Flag-off markup is pinned by `FLAG_OFF_HEADER_MARKUP` / the `preDraft.baseline` captures. |
| `WorkflowsPage.tsx` | 43 / 17 / 1415 | 43/17/1415 | "satisfied (192/192.1) — not a standing satisfied". `onOpenSettings` is UNWIRED here (**SEED-218**, see the seeds section). The 204-03 precedent was `+15/−0`: one prop. |
| `doorVocabulary.ts` | 6 / 4 / 540 | 6/4/540 | Governed table mirrored from a locked BUILD-CONTRACT. **Do not edit.** The new table is a new leaf that imports from it. |
| `useTemplateFirstDraft.ts` | 6 / 3 / 673 | FIRES at threshold | Honoured by construction (214). `allowed_connection_ids` absent-vs-`[]` must survive. |
| `PhaseCard.tsx` | 17 / 11 / 788 | FIRES | `SUBSTEP_META` must stay total over `EmitSubStep` (it.each-pinned). Named seam: the sub-step meta table. One copy entry + one className is honoured by construction. |
| `types/index.ts` | 98 / 77 / 1542 | FIRES | One union member, additive. |
| `lib/api/knowledge.ts` | 4 / 3 / 812 | 2/2/803 (row present, **stale**) | One optional field on `GenerateResult`. |
| `PublishBlockedStepCard.tsx` | 1 / 0 / 101 | young | `blockedStepOf`/`nodeTitle` contract; the cause renders as a text child (no `dangerouslySetInnerHTML`). Only `whitespace-pre-line` is added. |
| `runVocabulary.ts` | **9 / 4 / 660** | **NO ROW** | FIRES on the count with no row. Ledger gate fails until a row + section are added. Also triggers **SEED-350**. |
| `harness/freshness.py` | 1 / 1 / 113 | **NO ROW** | young. Row needed. |
| `harness/emit_cause.py` (new) | — | **NO ROW** | young. Row needed. |
| `describeRefusalVocabulary.ts` (new) | — | **NO ROW** | young. Row needed. |

**Measured with the gate itself:** `node scripts/check-hot-file-ledger.cjs --files …` over the 15 candidate files reports `[no-row]` for exactly **emit_cause.py, freshness.py, describeRefusalVocabulary.ts, runVocabulary.ts**. `.claude/hooks/hot-file-ledger-guard.js` runs that check **in the turn a PLAN.md is written**. The rows (with sections, same commit) must exist before or with the plan that names those files.

**Closed core (ask 8):** pins live in `backend/tests/unit/test_255_extension_contract_guard.py`:
- `test_phase_type_registry_is_closed` (7 executors, `:56`)
- `test_emitter_registry_is_closed` (`{"render_template"}`, `:84`)
- `test_tool_registry_is_closed` (30 tools incl. `show_artifact`, `:93-113`)
- `test_validator_registries_are_closed` (10 validator kinds)
- `test_no_dynamic_code_execution_in_trigger_paths` (17 files)

Recount = run that file + print `len(PHASE_TYPE_REGISTRY_ENTRIES)`, `len(EMITTER_REGISTRY)`, `len(_TOOL_REGISTRY)`. Measured green at base (part of the 76-pass targeted run).

## Architecture Patterns

### System Architecture Diagram

```
forced_emit shot ──► classify shot (executor) ──► record {kind, fields, counts}
      ▲  (≤3 per invocation)          │                    │
      │                               ▼                    ▼
 _exec_llm_emit  ◄────────── retry w/ feedback?     _emit_failure_output(failure=<split value>,
      │                                              text=compose(this invocation),
      │                                              attempt_causes=[records])  (+ _surfaced chat msg)
      ▼
_run_phase_with_gates  (engine attempts ≤ max_retries+1)
      │ accumulate records across invocations
      │ run_gates(post) ── validator says "no field_map" / "invented=36"
      │ PRECEDENCE: output has executor `failure` ⇒ cause = compose(all records)
      │   (gate_failed audit/SSE error = cause; validator text kept as validator_error)
      ▼ exhausted
_route_on_failure(reason_is_final=True) ⇒ reason = cause (no "Phase N (slug)" prefix)
      ▼
fail_phase → workflow_phases.output._failure_reason = cause ──┬──► publish_service._blocked_step.cause (prefix regex no-op) ──► PublishBlockedStepCard (pre-line)
                                                              ├──► _surface_failure_message ──► chat (marked breaks:true)
                                                              └──► GET /workflow-runs/{id} failure_reason ──► PhaseCard (pre-line)
No-validator path: run_workflow `_emit_failure` branch ──► fail_phase(reason = compose(output.attempt_causes)) (same composer)
```

### Recommended file layout
```
backend/app/services/harness/emit_cause.py      # NEW leaf: classify_shot(), compose_emit_failure(); words + check lines; no phase_types import
backend/app/services/harness/phase_types.py     # record per shot; split failure value; call composer
backend/app/services/harness_engine.py          # accumulate + precedence + reason_is_final; identity projection
backend/app/services/harness/freshness.py       # import RETRIEVABLE_COLUMN; concat SQL constants
backend/app/services/workflow_authoring.py      # additive sub-reason on 3 connection_not_allowed arms
frontend/src/components/workflows/describeRefusalVocabulary.ts  # NEW leaf: code(+sub) → {sentence, next}; fallback
frontend/src/components/workflows/PublishGauntlet.tsx           # RunLink: onOpenRun prop, D-08 label
frontend/src/pages/WorkflowsPage.tsx                            # pass guarded onOpenRun into renderPublish
```

### Pattern 1: Per-shot cause record (executor)
**What:** one JSON-safe dict per sealed shot, appended in `_exec_llm_emit`'s loop at each exit or continue point. A shot can carry more than one failed check.
```python
# Recommended shape (planner may rename). JSON-serializable — _persist_output json.dumps it.
{"attempt": 2, "kinds": ["missing_fields"], "missing": ["rows"], "uncited": 0, "invented": 0}
{"attempt": 3, "kinds": ["narrated"]}            # result["failure"]=="model_failed_to_emit", not truncated
{"attempt": 1, "kinds": ["provider_error"]}       # result["failure"]=="provider_error"
{"attempt": 1, "kinds": ["missing_fields", "uncited"], "missing": ["rows"], "uncited": 2, "invented": 0}
```
Terminal single-shot causes (`no_template_bound`, `render_failed`, `integrity_failed`, the unexpected backstop `:1348-1371`) produce one record each, so the composer stays total.

### Pattern 2: One composer (new leaf)
**What:** `compose_emit_failure(records: list[dict]) -> str`. It merges by **kind**, counts the attempts per kind (a shot with two kinds counts under both, stated in the docstring), names missing fields as the first 5 plus `and N more` (D-02, oracle order, union across merged shots), and appends one server-written *Check …* line per kind (D-03). The output is **plain text with `\n` bullets**.
```text
This step failed after 9 attempts:
• 7 attempts — filled the template, but these fields were missing: rows. Check that the template's field names match what this step produces.
• 2 attempts — the model wrote prose instead of filling the template. Check which model this step uses.
• 1 attempt — the citation check failed: 2 values cited no source. Check that the step before this one finds the documents these values come from.
```
The words above are DRAFTS for the planner to polish against `publish-gauntlet.md` and run-honesty (no "fix", no promise, no "soon/later"). The leaf is the ONE home of every emit-cause sentence. Pin them with a test that reads them off the module (the `runVocabulary.test.ts` idiom), never re-typed.

### Pattern 3: Engine precedence (one rule, no new branch family)
```python
# harness_engine._run_phase_with_gates — sketch, not final code
emit_records: list = []                                    # before `while True`
...
output = await asyncio.wait_for(_execute_phase(...), timeout=wall_clock)
if isinstance(output, dict):
    emit_records.extend(output.get("attempt_causes") or [])
gate = await run_gates(phase, output, ctx, timing="post")
...
diagnosed = isinstance(output, dict) and bool(output.get("failure")) and bool(output.get("_surfaced"))
cause = gate.error_message
if diagnosed:
    from app.services.harness.emit_cause import compose_emit_failure  # function-local: package cycle
    cause = compose_emit_failure(emit_records) or output.get("text") or gate.error_message
identical = _same_attempt(output, last_output)   # excludes "text"/"attempt_causes" when diagnosed
```
Then use `cause` for the `gate_failed` audit/emit `error` (add `validator_error` beside it), for `ctx.retry_feedback` (see Open Question 2), and pass `reason_is_final=diagnosed` to `_resolve_failure_with_ask_user` → `_route_on_failure`. That gives `reason = cause` (no prefix) when True, and is byte-identical otherwise. In `run_workflow`'s `_emit_failure` branch (`:2516`), replace `str(_emit_failure)` with `compose_emit_failure(output.get("attempt_causes") or []) or str(_emit_failure)`.

### Pattern 4: Golden-run link by prop presence (SEED-190 / RunLogPanel precedent)
```tsx
// PublishGauntlet: one optional prop. Absent ⇒ the run arm renders nothing (flag off).
function RunLink({ goldenRunId, onOpenRun }: { goldenRunId: string | null; onOpenRun?: (id: string) => void }) {
  if (goldenRunId != null) {
    if (!onOpenRun) return null
    return <button type="button" data-testid="run-link" onClick={() => onOpenRun(goldenRunId)}>▦ Open the golden run that was judged ›</button>
  }
  return /* existing no-run-note, unchanged */
}
// WorkflowsPage.renderPublish: onOpenRun={onOpenRun ? (id) => { if (canLeaveBuilderRef.current && !canLeaveBuilderRef.current()) return; onOpenRun(id) } : undefined}
```

### Pattern 5: Describe refusal table (new leaf)
`describeRefusalVocabulary.ts` exports `describeRefusal(code: string, subReason?: string | null): { sentence: string; next: string }`. It is total: unknown code → fallback. It imports `SERVICES_LABEL` from `doorVocabulary` instead of re-typing. The page renders `sentence` + `next`, plus `<span class="font-mono text-[10px]">{code}{sub ? ` · ${sub}` : ""}</span>` **only when `showTechnical`**. Recommended: the server `detail` (it carries slugs) also moves behind `showTechnical`.

### Anti-Patterns to Avoid
- **Adding `retrieved_ids` / `placeholder_keys` to the failure output so the validator "agrees".** It changes control flow (the gate passes, the run continues as `completed`). See Finding 1.
- **Reading `harness_audit` to aggregate.** It lacks missing-key names and state-(a) attempt numbers. Use in-memory records.
- **A client-side cause table for emit failures.** `blockedStepOf` / `PublishBlockedStepCard` render the server's `cause` verbatim (`publishBlockedStep.ts` "IT CLASSIFIES NOTHING"). Only the describe door gets a client table (SEED-221's sanctioned seam).
- **A server-side step-name ladder.** `step_name` stays `null` when unnamed; the client's `nodeTitle` names the step. The composed string must not lead with the step's name or slug.
- **Editing `doorVocabulary.ts`** to hold the new sentences. It is a governed, contract-mirrored table (21-24 ids).
- **f-string SQL** in `freshness.py`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step face in the gauntlet | a server or client `name ?? slug` | `phaseVocabulary.nodeTitle` via `blockedStepFace` | the 4-tier ladder's floor is "the slug never appears" |
| Technical-names reveal | a new toggle or local state | `useTechnicalNamesOptional()?.showTechnical ?? false` (already at `WorkflowBuilderPage.tsx:1334`) | one app-wide boolean; two toggles would disagree |
| Run navigation | a new route or URL | `openRunSurface` via `WorkflowsPage.onOpenRun` | the app has no router (SEED-185) |
| Unsaved-work check on leave | a new dirty flag | `canLeaveBuilderRef` + `UNSAVED_LEAVE_PROMPT` | the existing D-184-16 guard |
| Archive predicate | `archived_at IS NULL AND …` | `RETRIEVABLE_COLUMN` (mig-205 stored column) | the one home (Phase 275 D-36) |
| Placeholder names | re-parsing the docx | the `oracle` already computed in `_exec_llm_emit` (`:1512`) | same parse, same order |
| Multi-line rendering in chat | markdown list syntax | plain `\n` (`marked` `breaks: true`) | already configured |

## Runtime State Inventory

Not a rename or refactor phase. Omitted, with one note: the golden run `43b34171…` is **local dev data** used as the measured reference. Nothing in this phase migrates or rewrites it.

## Common Pitfalls

### Pitfall 1: The live SC#1 drive can honestly say "citation"
**What goes wrong:** D-17 says FAIL if "citations" appears. But the measured golden run's **first shot had 2 uncited values** (cov 94.7%). An honest composed message names that cause for 1 attempt.
**How to avoid:** assert against **the same run's own `emit_rejected` rows**. "Citation" may appear iff some shot had `uncited_value_count > 0` or `invented_citation_count > 0`, and then only with that count. Read the audit rows in the LIVE-EVIDENCE record. The fixture (D-06) uses 100% coverage on every shot, so there it must never appear.

### Pitfall 2: The live drive is nondeterministic
**What goes wrong:** the model may pass, or fail differently, on the live publish.
**How to avoid:** use the draft `compliance-gap-report-cim40y` (local, `status: draft`) with the model that failed 9/9 (`deepseek-v4-flash`) if its key is configured. Record whichever causes occur and match the message to that run's audit trail. A passing run is a ⛔/OWED row with its reason, never a fabricated pass.

### Pitfall 3: Two totals in one string
**What goes wrong:** keeping the engine prefix (`after 3 attempt(s)`, engine counter) in front of a composed body that counts shots (9).
**How to avoid:** use `reason_is_final` (Pattern 3) for executor-diagnosed failures only, and pin it with a test on the composed reason. Keep `test_260828_09_*`'s prefix tests green (other reasons still carry the prefix).

### Pitfall 4: The `identical` short-circuit stops firing
**What goes wrong:** adding per-invocation records or a composed `text` to `output` makes `output == last_output` false where it used to be true, which buys extra engine attempts (spend).
**How to avoid:** compare on a projection without `text` / `attempt_causes` when diagnosed. Test: two consecutive narrated invocations still exhaust at engine attempt 2.

### Pitfall 5: The ledger guard fires at PLAN-write time
**What goes wrong:** `hot-file-ledger-guard.js` fails a PLAN.md naming `runVocabulary.ts`, `freshness.py` or the two new files, because they have no row.
**How to avoid:** add the 4 rows + sections (re-derived triples, cell ≤ 200 chars) in the same commit as, or before, the plans. Also re-derive the 3 stale rows (`workflow_authoring.py`, `PublishGauntlet.tsx`, `knowledge.ts`).

### Pitfall 6: Wrong next-step doors
**What goes wrong:** D-14's *"Choose one in Settings"* (no such setting exists for anyone) and *"Connected services"* (no such label; the picker is on the previous screen).
**How to avoid:** use the wording in Open Question 1 after operator confirmation. Import `SERVICES_LABEL`.

### Pitfall 7: The copy fence and pinned markup
**What goes wrong:** spelling a door word in the new table or the page reds the D-24(a) fence. The `preDraft.baseline` byte-captures red on any error-arm change.
**How to avoid:** import door words. Join `SWEPT_SOURCES` (6→7) in the same commit. Re-capture `flagOff:error` / `flagOn:error` **deliberately**, with the reason written in the test file (the 193-08 precedent).

### Pitfall 8: The gauntlet IS reachable with the flag off
**What goes wrong:** trusting D-07's premise and leaving the run button rendered unconditionally. With the flag off, `GET /workflow-runs/{id}` is `require_canvas()`-gated, so the button would be dead.
**How to avoid:** gate on `onOpenRun` presence. Test both arms: the button is absent and "coming soon" is absent with the prop undefined; clicking with the prop calls it with the exact `golden_run_id`.

### Pitfall 9: The provider error is misreported today
`provider_error` from `forced_emit` is worded as "narrated prose". The split taxonomy should classify it as its own kind (Pattern 1). This does not change the `failure` value (it stays `model_failed_to_emit`) unless the planner chooses to; it is cause text only.

### Pitfall 10: Backend gates cover `tests/unit` only
Memory and STATE: CI runs all tests. Engine changes must also run root-level `tests/test_harness_engine.py` and `tests/test_094_rc4_failure.py` (148 passed at base with `test_publish_service.py`). `test_harness_gates` hangs at both revs (STATE).

## Code Examples

### Freshness, import-not-restate
```python
# backend/app/services/harness/freshness.py — sketch
from app.services.retrieval_scope import RETRIEVABLE_COLUMN  # Phase 275 D-36: the ONE name

assert RETRIEVABLE_COLUMN.isidentifier()  # a fixed identifier, never user input (D-16)
_NEWEST_SQL = (
    "SELECT max(created_at) AS newest FROM documents "
    "WHERE folder_id = ANY($1::uuid[]) AND " + RETRIEVABLE_COLUMN
)
_STEMS_SQL = (
    "SELECT filename FROM documents WHERE folder_id = ANY($1::uuid[]) AND " + RETRIEVABLE_COLUMN
)
```
```python
# RED-first + non-restatement test — sketch
def test_freshness_sql_derives_the_predicate(monkeypatch):
    import importlib, app.services.retrieval_scope as rs, app.services.harness.freshness as fr
    monkeypatch.setattr(rs, "RETRIEVABLE_COLUMN", "sentinel_col_281")
    fr = importlib.reload(fr)
    try:
        assert "sentinel_col_281" in fr._NEWEST_SQL and "sentinel_col_281" in fr._STEMS_SQL
    finally:
        monkeypatch.undo(); importlib.reload(fr)
```

### SC#1 fixture (unit, reuses `test_llm_emit_executor._patch_executor`)
Monkeypatch `phase_types._template_oracle` to return the measured compliance oracle (Finding 2). Fake `forced_emit` returns an `EmitFieldMap` with scalars `report_date/report_title/scope` and a collection under a **wrong** name (e.g. `obligations`), every cell cited to an id inside `retrieved_ids`. Then assert:
- `out["failure"] == "template_fields_missing"`
- `"rows" in out["text"]`
- `"citation" not in out["text"].lower()`
- `len(out["attempt_causes"]) == 3`

Engine-level twin: a stub executor sequence (rejected-missing ×1 invocation, narrated ×2) under a declared `citations_required` validator. Assert `_failure_reason`, `run_failed.reason` and `_blocked_step(...)["cause"]` are the **same** composed string, containing no `citations_required` and no `no field_map`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `named_failures = ["the golden run failed a structural gate"]` | `blocked_step {step_*, reason, cause}` from `_failure_reason` | BUG-260828-09 (2026-08-29) | 281 only improves the string it carries |
| validator text last-wins | executor diagnosis wins (this phase) | 281 | — |

**Deprecated/outdated:** the `RunLink` docblock (*"IR-02: the run-surface route is deferred (D-103-A → 103.1/104)"*). The run surface shipped in Phase 188/200.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Authors call a sealed forced-emit shot "an attempt" (so totals like "9 attempts" are acceptable) | Summary / Pattern 2 | Operator may prefer engine attempts. The composer then needs per-invocation terminal classification, which **loses** distinct causes in the no-validator case. Confirm at plan. |
| A2 | The run page opening at top (no focus) satisfies D-09 | Finding 4 | Low. D-09 pre-authorised it. |
| A3 | `deepseek-v4-flash` is still configured locally for the live SC#1 drive | Pitfall 2 | The drive uses another model, or that row is ⛔ with a reason |
| A4 | A shot failing two checks counts under both bullets (bullet counts may sum above the total) | Pattern 2 | Wording confusion. The alternative is a combined-kind bullet. |
| A5 | The D-14 wording replacements in Open Question 1 are acceptable to the operator | Finding 5 | Copy re-work at G-4 |

## Open Questions

1. **Describe-door wording that D-14 cannot keep as written**
   - Known: no Settings field for the authoring model; the picker label is *"Services this workflow may use"* on the loose door; there is a 4th code, `grounding_failed`; the catch arm may carry an entitlement sentence.
   - Recommendation:
     - `no_authoring_model` → next: *"Ask whoever runs this workspace to set up a drafting model."*
     - `connection_not_allowed · no service chosen` → next: *"Go back, tick a service under “{SERVICES_LABEL}”, then draft again."*
     - `grounding_failed` → *"The draft pointed at a tool, skill or folder this workflow can't use."* / *"Try again, or describe the work in more detail."*
     - Catch arm: render the entitlement sentence when present, else the fallback.
     - Confirm with the operator before locking.
2. **Should `ctx.retry_feedback` carry the executor's cause instead of the validator's?**
   - Known: today it fed *"invented=36"* to the model on the golden run (false). One string everywhere argues yes.
   - Unclear: it changes model input, and D-deferred says "does not make the model succeed".
   - Recommendation: yes, recorded as a deliberate decision with its own test. The feedback becomes true, not stronger.
3. **Four chat messages per failed validated emit.** Pre-existing (Finding 1). Recommendation: leave it. The last message equals the gauntlet cause. A fold would be a separate behaviour change.
4. **`BLOCKED_STEP_NEXT` says "Open the trial run…" even with the flag off** (`publishBlockedStep.ts`), where no link exists. Recommendation: note it for the planner. Gating it is a one-line prop decision in a young file; otherwise it stays as a known residual.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| backend venv + pytest | all backend tests | ✓ | targeted runs green: 76 + 148 + 2 passed at base | — |
| node / vitest | frontend tests | ✓ | node v24.19.0, vitest 4.1.0 (3 files, 131 passed, 43 s) | — |
| local Postgres (54322) | DB reads for G-4 D, golden-run reference | ✓ | read via `settings.postgres_dsn` (asyncpg) | — |
| Golden run `43b34171…` + draft `compliance-gap-report-cim40y` | SC#1 reference / live drive | ✓ (local) | — | — |
| Running backend + frontend + Chrome MCP | G-4 drives | operator-started (memory: user starts backend) | — | rows OWED/⛔ with reason |
| A provider key for the golden-run model | live SC#1 | unknown | — | another model; record which |

**Missing dependencies with no fallback:** none blocking planning.

## Validation Architecture (brief; nyquist is OFF)

| Req | Behaviour | Type | Command |
|---|---|---|---|
| FIX-09 | composer words, merge, first-5 + "and N more", no "citation" unless the citation check failed | unit | `pytest tests/unit/test_281_emit_cause.py -q` (Wave 0, new) |
| FIX-09 | SC#1 fixture: executor split value + records | unit | `pytest tests/unit/test_llm_emit_executor.py tests/unit/test_281_emit_cause.py -q` |
| FIX-09 / D-04 | engine precedence, `reason_is_final`, identity projection, `_blocked_step.cause == _failure_reason` | unit + root | `pytest tests/unit/test_281_engine_cause_precedence.py tests/unit/test_260828_09_publish_names_the_failing_step.py tests/test_harness_engine.py tests/test_094_rc4_failure.py -q` |
| DEBT-07 | both SQL carry the imported predicate (RED first) + reload proof | unit | `pytest tests/unit/test_281_freshness_retrievable.py tests/unit/test_freshness.py -q` |
| FIX-10 link | flag-arm prop gating, D-08 label, no "coming soon", click → exact id | vitest | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/PublishGauntlet.test.tsx` |
| FIX-10 door | table totality (4 codes + 3 subs + fallback), code hidden/shown by reveal | vitest + integration | `npx vitest run src/components/workflows/describeRefusalVocabulary.test.ts src/pages/WorkflowBuilderPage.test.tsx` · `pytest tests/integration/test_214_argument_seams.py -k S7` |
| closed core | 7/1/30 + 10 validators | unit | `pytest tests/unit/test_255_extension_contract_guard.py -q` |
| gates | backend ≤ base failed SET; vitest count gate; tsc set diff; ledger; CLAUDE.md size | full | `node scripts/check-backend-unit-baseline.cjs` · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` · `npx tsc -p tsconfig.app.json --noEmit` · `node scripts/check-hot-file-ledger.cjs 281` |

**Baseline:** CLAUDE.md locks 71. STATE records 71 failed / 7277 passed at 279 close. Memory records 72 at 280 with a flaky `test_230`. **Measure the failing SET at `ae7928a92` before the first edit**, and compare SETs, not counts.

## Recommended Plan Split (D-23, G-8: 4 plans)

| Plan | Wave | Owns (files_modified; disjoint across parallel plans) | Delivers |
|---|---|---|---|
| **281-01 Emit cause + freshness** | 1 | `harness/emit_cause.py` (new), `harness/phase_types.py`, `harness_engine.py`, `harness/freshness.py`, `tests/unit/test_281_emit_cause.py`, `tests/unit/test_281_engine_cause_precedence.py`, `tests/unit/test_281_freshness_retrievable.py`, `tests/unit/test_llm_emit_executor.py` (additive cases), `docs/HOT-FILE-LEDGER.md` rows for `emit_cause.py` + `freshness.py` | FIX-09 (a)+(b), D-01..D-06 backend, DEBT-07 / D-16 RED-first. **The failure value name and the composed-string format are fixed in this PLAN's interface block** so 281-03 can consume them. |
| **281-02 Describe-door table** | 1 (∥ 01) | `workflow_authoring.py`, `describeRefusalVocabulary.ts` (new) + its test, `useTemplateFirstDraft.ts`, `WorkflowBuilderPage.tsx`, `lib/api/knowledge.ts`, `WorkflowDoorSwitch.test.tsx` (SWEPT_SOURCES 6→7), `preDraft.baseline` / `WorkflowBuilderPage.test.tsx` / `canvas.test.tsx` / `useTemplateFirstDraft.test.tsx` re-pins, `tests/unit/test_214_describe_vocabulary.py`, `tests/integration/test_214_argument_seams.py` (S-7 inversion), ledger row for the new leaf | FIX-10 / SEED-221, D-11..D-15 |
| **281-03 Gauntlet link + emit render** | 2 (after 01) | `PublishGauntlet.tsx` + test, `WorkflowsPage.tsx`, `PublishBlockedStepCard.tsx` (pre-line), `PhaseCard.tsx` (+copy entry, pre-line), `types/index.ts` (+union member), `runVocabulary.ts` (+case) + tests, ledger row for `runVocabulary.ts` | D-07..D-10, the frontend half of D-04 / taxonomy |
| **281-04 G-4 drive + close** | 3, `autonomous: false` | `281-LIVE-EVIDENCE.md`, ledger + CLAUDE.md FIRING cells (≤ 80 chars), STATE.md, bug/seed frontmatter | D-17..D-20 drives (operator checkpoint), closed-core recount, gates, `BUG-260730-02` / `BUG-260815-06` / `SEED-221` status |

Two test-running agents in wave 1 respects the ≤ 2 concurrency rule. No plan mutates the local DB in automated tests. The D-20 live drive archives a document (an UPDATE) and runs **alone in 281-04**; restore `archived_at` afterwards.

## Seeds / Bugs Sweep (ask 10)

Seeds whose `trigger_paths` or `trigger_when` match this phase's expected files (status planted / partially-answered). **Route each at plan-phase** (fold / defer / leave, written back to the frontmatter):
- **SEED-218** (planted, high): *the describe door's refusal offers a connect button that does nothing; `onOpenSettings` is unwired.* Its trigger fires: (2) `files_modified` names `WorkflowsPage.tsx`, and (3) *"any phase that adds a second 'go and connect it' affordance"*. A D-14 next step that sends the author to connect or choose a service is exactly that sibling. **Strongly consider folding** (one prop in `WorkflowsPage.tsx`, which 281-03 already edits) or record an explicit deferral.
- **SEED-350** (planted): *"Stopped by you" shown for stops you did not make*. Triggers on `runVocabulary.ts` in `files_modified`. Unrelated cause; recommend a recorded deferral.
- **SEED-339** (planted): `{{prior_run.*}}` never filled for `llm_emit`. Triggers on `phase_types.py` / `harness_engine.py`. Different defect; recommend a recorded deferral.
- **SEED-300** / **SEED-307** (token holes / metering residuals): trigger on `phase_types.py` / `harness_engine.py`. No metering change here; leave, with a note.
- SEED-217, SEED-291 (phase_types; the closed core is honoured), SEED-223/281/295/298 (harness_engine), SEED-182/183 (`WorkflowBuilderPage.tsx`), SEED-184 (`WorkflowsPage.tsx`): matched by path; no overlap with refusal words. Leave, with notes.
- Reported bugs folded into 281: `BUG-260730-02`, `BUG-260815-06` (both `status: folded`). Every plan task must map to them (CLAUDE.md plan-phase touchpoint).

Run `node scripts/check-seeds-register.cjs --phase 281` once the PLAN files exist; it is the authoritative matcher.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | The run link reuses `GET /workflow-runs/{id}`'s owner gate (`.eq("user_id", …)`, uniform 404) + `require_canvas()`. There are no new endpoints. |
| V5 Input Validation | yes | Freshness SQL: `$N` bind params only; the column name is an imported constant asserted `isidentifier()`, never user input. The cause text renders as a React text child (no `dangerouslySetInnerHTML`). |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---|---|---|
| SQL injection via the spliced column name | Tampering | constant identifier + `isidentifier()` assert + concatenation at import, never f-string or runtime input |
| Info disclosure: slugs, model ids or detail in refusals | Information disclosure | `detail` and the code move behind the technical-names reveal; the composed cause carries no slug |
| Opening someone else's run | Elevation of privilege | the existing owner-scoped read returns 404 for a foreign id |
| Unbounded field names in the cause | DoS (UI) | first 5 + "and N more" (D-02) bounds the length |

## Sources

### Primary (HIGH confidence, measured in this session)
- Local DB (`harness_audit`, `workflow_phases`, `workflow_runs`, `messages`, `workflow_definitions`) for run `43b34171-35d9-4884-9f12-0d76f42b1352`
- `parse_docx_template_variables` executed on `scripts/pm-pack/templates/compliance-gap-report.docx`
- Code read at `ae7928a92`: `phase_types.py`, `harness_engine.py`, `validator_kinds.py`, `publish_service.py`, `freshness.py`, `retrieval_scope.py`, `workflow_authoring.py`, `harness/grounding.py`, `forced_emit.py`, `template_render_service.py`, `api/workflow_runs.py`, `api/workflows.py`, `config.py`, `api/settings.py`, `PublishGauntlet.tsx`, `PublishBlockedStepCard.tsx`, `publishBlockedStep.ts`, `WorkflowsPage.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowDoorSwitch.tsx`, `doorVocabulary.ts`, `useTemplateFirstDraft.ts`, `builderStore.ts`, `PhaseCard.tsx`, `runVocabulary.ts`, `types/index.ts`, `lib/api/knowledge.ts`, `lib/api/workflows.ts`, `_core.ts`, `ChatLayout.tsx`, `WorkflowRunPage.tsx`, `RunStepList.tsx`, `MarkdownRenderer.tsx`
- `docs/HOT-FILE-LEDGER.md` sections + `node scripts/check-hot-file-ledger.cjs --files …` (measured output)
- `backend/tests/unit/test_255_extension_contract_guard.py`, `backend/tests/integration/test_214_argument_seams.py`, `WorkflowDoorSwitch.test.tsx`, `scripts/vitest-count-gate.cjs`
- Targeted test runs at base (backend 76 + 148 + 2 passed; vitest 131 passed)
- `.claude/skills/sketch-findings-agentic-rag/references/publish-gauntlet.md` (D6 run link), `node-vocabulary-and-reveal.md` (one toggle, mono technical line)

### Secondary / Tertiary
- None. No web sources were needed: this phase is internal code with no external library behaviour in question.

## Metadata

**Confidence breakdown:**
- Stack: HIGH (no new dependencies)
- Architecture: HIGH (every seam traced to file:line; the golden run's trail was measured, not inferred)
- Pitfalls: HIGH for 1, 3-8 (measured); MEDIUM for 2 (live model behaviour)

**Research date:** 2026-10-14
**Valid until:** about 7 days. These hot files go stale within one phase, per the ledger. Re-derive the triples at plan time.
