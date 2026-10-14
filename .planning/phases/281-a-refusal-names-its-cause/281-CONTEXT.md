# Phase 281: A Refusal Names Its Cause - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

When a workflow step fails or a publish or draft is refused, the author reads **the check that actually
failed**, in plain words and under the step's canvas name. They never see a machine code or a wrong
subsystem. The harness freshness check stops counting archived (`retrievable = false`) documents.

Requirements: **FIX-09** (emit cause), **FIX-10** (publish gauntlet + describe door, folding `SEED-221`),
**DEBT-07** (freshness). The phase adds no new capability, validator kind, phase type or emitter. The
closed core stays at **7 / 1 / 30** and is recounted against the phase base.

</domain>

<decisions>
## Implementation Decisions

### Emit failure cause (FIX-09)

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

### Golden-run link (FIX-10, BUG-260815-06 #4)

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

### Describe-door refusals (FIX-10, SEED-221)

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

### Freshness (DEBT-07)

- **D-16:** `harness/freshness.py` (both queries: the `max(created_at)` query and the stem-collision
  query) counts only retrievable documents, by **importing `RETRIEVABLE_COLUMN`** from
  `retrieval_scope.py`. It must not restate the predicate. This is proven RED-first. `freshness.py` uses
  raw SQL, so the imported constant is a fixed identifier and never user input.
  `retrieval_scope.py` itself is **not edited**: its ledger says extraction FIRST next, and an import
  does not touch it.

### G-4 lived-experience scenarios (operator-defined at scope time)

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

### Guardrail decisions recorded at discuss

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

### Amendments after research (operator, at /gsd:plan-phase 281, 2026-10-14)

`281-RESEARCH.md` measured four CONTEXT premises false. These amendments **supersede** the decisions
they name. The originals stay above, unedited, so the correction is visible.

- **D-24 (amends D-14):** describe-door wording replacements, operator-approved:
  - `no_authoring_model` → next step *"Ask whoever runs this workspace to set up a drafting model."*
    The authoring model is env-only (`config.py:1510`), so no Settings door exists for anyone.
  - `connection_not_allowed · no service chosen` → *"This step acts outside the app, but no service is
    chosen for this workflow."* / *"Go back, tick a service under “{SERVICES_LABEL}”, then draft
    again."* `SERVICES_LABEL` is **imported** from `doorVocabulary.ts`, never retyped (D-24(a) copy
    fence).
  - **New 4th code `grounding_failed`** → *"The draft pointed at a tool, skill or folder this workflow
    can't use."* / *"Try again, or describe the work in more detail."*
  - **Catch arm:** a server sentence (e.g. the entitlement *"Your plan doesn't include…"*) renders as
    is. The unknown-code fallback never hides it.
- **D-25 (resolves Discretion: attempt counter):** an "attempt" in the emit message is **every model
  call** (the golden run: 9 calls inside 3 engine retries). The `Phase N (slug) gate failed after k
  attempt(s)` prefix is dropped from the composed string, so it never carries two totals.
- **D-26 (new):** the model's retry feedback (`ctx.retry_feedback`) carries the **executor's true
  cause**, not the validator's shape message (which fed the golden run a false *"invented=36"*). It is a
  deliberate model-input change and gets its own test.
- **D-27 (folds SEED-218):** the describe door refusal's connect affordance (`onOpenSettings`, threaded
  but unwired) is wired in `WorkflowsPage.tsx`, which the golden-run link plan already edits. No dead
  control ships beside the new words.
- **D-28 (amends D-07/D-10):** the gauntlet **is** reachable with the canvas flag off
  (`renderPublish` is mounted on both header branches). The link renders **only when `onOpenRun` is
  present** (prop presence, the SEED-190 / RunLogPanel precedent). With the flag off, both the button
  and the "coming soon" text are removed. The click goes through the Builder's existing
  `canLeaveBuilderRef` unsaved-work check. `BLOCKED_STEP_NEXT`'s *"Open the trial run…"* line is gated
  the same way, so it never names a link that isn't there.
- **D-29 (amends D-09):** the run page cannot focus a step today, so the link opens at the top.
  Step focus is deferred.
- **D-30 (refines D-01/D-05):** per-call causes are recorded **by the executor**, because the audit
  rows lack the missing-field names and the narration attempt number. One new pure leaf,
  `harness/emit_cause.py`, composes the message for the executor, the engine and the no-validator
  branch. A new failure value, `template_fields_missing`, splits off from `citation_gate_rejected`.
  `PhaseCard.tsx`'s fixed copy and the frontend type union follow it. The engine's identical-output
  short-circuit must ignore the new keys, so retries are not multiplied. ⛔ Do not "fix" the validator
  by adding `retrieved_ids` to the failure output: the gate would pass and the run would end
  `completed`.
- **D-31 (seeds routed at plan-phase):** SEED-218 folded (D-27). SEED-350 and SEED-339 deferred (path
  match only, different defect), with the routing written into their frontmatter.
- **D-32 (operator ruling at plan-check, 2026-10-14; amends D-01's composer lead):** the composed
  failure message names the step **when the author gave it a name on the canvas** (`PhaseSpec.name`, the
  field `nodeTitle`'s first rung reads): `Step "<author name>" failed after N attempts:`, else
  `This step failed after N attempts:`. Never the slug, never a backfilled or derived name; `blocked_step.step_name`
  stays `null`-not-backfilled. Recorded choice: D-04's one string is kept, so the gauntlet and run-page cards
  repeat an author-set name once inside the cause.

### Claude's Discretion
- The exact merge key for "same cause" across attempts. (The counter itself is now decided by D-25.)
- The wire shape of the per-cause list on `blocked_step`. It must be additive and must keep
  `step_name: null`-not-backfilled.
- The name of the describe-door sub-reason field.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source reports and seed
- `.planning/reported-bugs/BUG-260730-02-emit-gate-reports-citations-when-citations-were-perfect.md` — FIX-09: both causes, the golden run's audit rows, file:line pointers
- `.planning/reported-bugs/BUG-260815-06-structural-gate-refusal-names-nothing-actionable.md` — FIX-10: the 4-of-5 shipped table; only #4 (the run link) remains; the honesty-vs-legibility rule
- `.planning/seeds/SEED-221-a-refusal-reaches-the-screen-as-a-machine-code.md` — the describe-door translation gap and its mechanical check
- `.planning/REQUIREMENTS.md` — FIX-09, FIX-10, DEBT-07
- `.planning/ROADMAP.md` § Phase 281 — success criteria, "How we'd know this failed", Flags

### Design vocabulary (read before writing any copy)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` + `references/publish-gauntlet.md` — worded verdict, the raw-on-demand rule
- `.claude/skills/sketch-findings-agentic-rag/references/node-vocabulary-and-reveal.md` — the ⌥ technical-names reveal (D-12)
- `.claude/skills/sketch-findings-agentic-rag/references/run-honesty.md` — no overclaiming

### Prior decisions this phase inherits
- `.planning/milestones/v3.7-phases/193.2-from-authored-to-runnable/` — plan 193.2-06: the interactive-phase refusal written by canvas label (the precedent and its constraints)
- `docs/HOT-FILE-LEDGER.md` — sections for every G-5 file in D-22
- `docs/EXTENSION-CONTRACT.md` — closed core (no new executor, validator or emitter)

### Code
- `backend/app/services/harness/phase_types.py` — `_emit_failure_output` (~1329), the reject branch (~1641-1712), `_EMIT_MAX_ATTEMPTS` (1120)
- `backend/app/services/harness/validator_kinds.py` — `citations_required` (~238-340)
- `backend/app/services/harness_engine.py` — the gate retry loop; the emit-failure `fail_phase` branch (~2467-2520)
- `backend/app/services/harness/publish_service.py` — `_failure_reason` read (~1027, ~1102) → `blocked_step`
- `backend/app/services/template_render_service.py` — `covers_template` / placeholder oracle
- `backend/app/services/workflow_authoring.py` — the 3 codes (417/426/446, 680-706, 783)
- `frontend/src/components/workflows/PublishGauntlet.tsx` — `RunLink` (~383), call sites (~1140)
- `frontend/src/pages/WorkflowBuilderPage.tsx` — `Couldn't generate — {errorMessage}` (~2183), `showTechnical` (~1334)
- `frontend/src/components/workflows/doorVocabulary.ts` — door copy home; the new table sits beside it
- `frontend/src/components/layout/ChatLayout.tsx` — `openRunSurface` (~503)
- `backend/app/services/harness/freshness.py` — both queries; `backend/app/services/retrieval_scope.py:78` `RETRIEVABLE_COLUMN`
- `backend/tests/integration/test_214_argument_seams.py` — S-7 test to invert (D-15)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PublishVerdict.blocked_step`: already joins the failed run's phase server-side, and the canvas label
  resolves via `phaseVocabulary.nodeTitle` (BUG-260828-09). D-01 only improves the *string* it carries.
- `openRunSurface(runId)`: sets `activeRunId` and navigates to `workflow-run`. This is the link's
  mechanism (D-07).
- `useTechnicalNamesOptional()`: the app-wide reveal, already read in the Builder (D-12).
- `RETRIEVABLE_COLUMN`: the one home of the archive predicate, already imported by `kb.py` and
  `document_relationship_service.py` (D-16).

### Established Patterns
- **Server owns the sentence; the client renders it verbatim.** No cause table lives on the client
  (BUG-260815-06 req #3). The describe-door table is the single, sanctioned code→words seam for codes
  the server does not word itself.
- **One composer per sentence.** The `_approval_sentence` precedent; never a second vocabulary for one
  state.
- **The `_surfaced` single-writer flag** on emit failures: one persist, one message. D-04 must keep it.

### Integration Points
- `_failure_reason` on `workflow_phases.output` → `publish_service` → `blocked_step` → gauntlet. Fixing
  the string at its source fixes all three surfaces (D-04).
- `harness_audit` `emit_rejected` / `emit_failed` rows already carry per-attempt `gate_verdict`
  (`covered_keys`, `covers_template`, counts). These rows are the per-attempt evidence D-01 aggregates.

</code_context>

<specifics>
## Specific Ideas

- The approved emit message preview (D-01) and the describe-door wording table (D-14) are the
  acceptance shapes. Final words are pinned in the plan and asserted as rendered text in G-4.
- The fixture for SC#1 reproduces golden run `43b34171-35d9-4884-9f12-0d76f42b1352`'s audit shape:
  37/39 leaves filled, 100.0% citation coverage, `covered_keys = [report_date, report_title, scope]`.

</specifics>

<deferred>
## Deferred Ideas

- **Run page step focus.** If the run page cannot already land on a given step, that capability is
  deferred (D-09), not built here.
- **Emit cause (b) root cause.** Whether `deepseek-v4-flash` is weak at large forced emission, or the
  placeholder spotlight is too faint (and the `forced: false` while `tier: "force"` oddity), is out of
  scope. This phase makes the failure *legible*; it does not make the model succeed.

### Reviewed bugs (not folded)
- `BUG-260828-05` (send receipt names the SMTP host, not the recipient). It is in `phase_types.py`, but
  a receipt naming the wrong target is not a refusal naming its cause. Left open by operator decision
  at this discuss (2026-10-14).
- `BUG-260609-02` (phantom "Sub-task" in Sub-Results) and `BUG-260610-01` (run timer reset on nav).
  These are harness UI surfaces this phase does not touch. Left open.

### Seeds sweep note
- `node scripts/check-seeds-register.cjs --phase 281` exited FATAL because no phase directory existed
  yet. `SEED-221` was already folded at milestone intake. **Re-run the sweep at plan-phase**, once
  `files_modified` exists.

</deferred>

---

*Phase: 281-a-refusal-names-its-cause*
*Context gathered: 2026-10-14*
