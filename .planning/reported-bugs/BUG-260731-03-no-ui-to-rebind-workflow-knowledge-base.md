---
id: BUG-260731-03
title: A workflow's knowledge base can only be chosen on the pre-draft describe screen — an unbound workflow searches the WHOLE KB and cannot be re-bound without regenerating
reported: 2026-07-31
surface: Agentic-RAG
severity: blocking
status: folded
affected_areas: [frontend/workflow-builder, backend/harness/scope, backend/api/validate, workflows/publish-gauntlet, RAG/retrieval-scope]
folded_into: "186 (control) / 187 (verdict)"
verified_closed_by: null
related_seeds: [SEED-132, SEED-136]
re_open_trigger: "SPLIT ROUTING at /gsd:discuss-phase 186 (2026-07-31), D-186-14. Phase 186 folds the MINIMUM fix: project_folder_id as an editable workflow-level control on the built canvas (the display-only header chip promoted into the existing picker, D-186-15) plus a neutral unbound INVITATION with no severity/code/tray row (D-186-16, EMPTY_DRAFT_INVITATION precedent — D-182-06 stays intact). Phase 187 keeps the NECESSARY half: the deterministic build-time POST /workflows/validate `incomplete` verdict for an unbound retrieval workflow (SEED-132 envelope; the bug is a direct counterexample to 187's SC#3 safe-by-construction claim). Do NOT flip to closed when 186 ships — 186 closes only the repair path. Close only when BOTH halves are verified: an author can re-bind from any of the three creation paths AND an unbound retrieval workflow is caught deterministically on the canvas before a golden run is spent."
reproduces_on:
  branch: develop
  commit: 97d3a9ff
  date: 2026-07-31
---

# BUG-260731-03: no UI to re-bind a workflow's knowledge base after drafting

## What we observed

Observed live while an operator was trying to publish a "Compliance Gap Report" workflow
(`compliance-gap-report-qqvfwd`, definition `d4ed9d41-8ac5-42fe-b143-c3fc86517b9e`). The
golden run succeeded; the publish gauntlet's judge **failed it on `grounded_in_evidence`
(55.00)** and named two problems — a citation-source inconsistency, and a table row drawn
from an unrelated corpus with a bare slide number as its `source_clause`.

Both named failures had a single cause:

```
project_folder_id : None          ← nothing binds this workflow to a corpus
phase 'retrieve'  : folder_scope None, tools ['search_documents']
   prompt: "Search the knowledge base for stated compliance obligations…"
```

With `project_folder_id: None`, "the knowledge base" is **everything** — at the time of
report, 40+ documents across 10 folders (SOPs, DBA, Private, Hybrid Search, `uat111_*`
test fixtures, Weekly reports, plus 18 unfiled docs). The retrieval step behaved
correctly; nothing had told it which corpus the report was about.

The three filenames the judge cited resolve to **three different folders**:

| File the judge named | Folder |
|---|---|
| `Project-Meridian-Charter-Excerpt.docx` | Project Meridian – Risks |
| `project-charter-source.md` | PM Demo Project (sample data) |
| `CS SOPs final_29 Oct 2025_Billing Team Comments.pptx` | SOPs |

The judge hedged that the two charter names might be "two different source names for what
appears to be the same document, or an unverifiable citation." Neither: they are two
genuinely different documents in two different folders. The citations were accurate; the
**corpus** was wrong. (The judge under-called it further — `risk-log.md`, cited in the rows
it *accepted*, is also in the sample-data folder, so even the good rows straddled two
corpora.)

**The actual bug is the repair path.** The knowledge-base picker —
*"Which knowledge base should this use?"*, `WorkflowBuilderPage.tsx:1347-1367`, default
option **"No specific knowledge base"** — renders **only on the pre-draft describe screen**.
Once a workflow has been drafted onto the canvas there is no control anywhere that sets
`project_folder_id`. `projectFolderId` state is read back from the definition at
`:520-521` and written only inside the generate handler (`:1051`, `:1059`). The builder's
save path preserves whatever is already in the definition.

So an operator who leaves that one dropdown at its default gets an unscoped workflow that
**cannot be corrected in the product** — only regenerated from scratch, losing all canvas
edits. Unblocking this instance required a direct DB write.

## Why it matters

**Severity: major.** Three compounding reasons:

1. **The default is the wrong answer for most workflows.** "No specific knowledge base"
   means whole-KB retrieval (`scope.py:199-209` — *"`None` out = whole-KB (unchanged
   behavior — D-06)"*). On any KB with more than one project in it, an unscoped
   retrieval workflow is very likely to pull foreign material.
2. **The failure surfaces late and expensively.** Nothing at author time flags an unbound
   workflow. It is caught by the judge at the publish hard-wall, after a full golden run,
   with a verdict that describes the *symptom* (bad citations) rather than the *cause*
   (no scope). The operator is told to fix the deliverable; the deliverable is fine.
3. **There is no supported fix.** Regeneration is the only in-product path, and it
   discards the authored canvas. That is a poor trade for a one-field mistake, and it also
   means the next attempt changes more than one variable, so the new judge score cannot be
   read against the old one.

Note this is *not* a grounding-gate failure. The `emit` phase's `citations_required`
(`mode: deterministic`) gate **passed, correctly** — every cell really was cited to a real,
resolvable chunk and unsupported cells were nulled with `[UNCITED]`. The gate asks "did it
cite something real?"; the judge asks "did it cite the *right* things?". No deterministic
gate can answer the second without knowing what the workflow is about — which is exactly
the binding this bug is about.

## Hypothesized cause

Hypothesis, not finding: the picker was scoped to the NL-generation flow (its own comment
at `WorkflowBuilderPage.tsx:1345-1347` calls it *"ONE calm project picker — binds the
generated workflow to a knowledge base… NOT the sketch's full infer+confirm loop"*), on the
reasonable assumption that binding happens once at creation. The gap is that nothing
carried that control into the post-draft editing surface, where every *other* definition
field became editable via the canvas and the phase form panel.

## Suggested fix direction

Not prescriptive — for discuss-phase:

- **Minimum:** surface `project_folder_id` as an editable field on the built canvas
  (workflow-level settings, not per-phase). One control, same picker component.
- **Better:** make an unbound workflow a **build-time verdict** rather than a publish-time
  judge failure. `POST /workflows/validate` already returns per-node `{code, phase,
  message, severity}`; an unbound workflow whose phases carry retrieval tools is a textbook
  `incomplete` — "you are still building" — and would be caught on the canvas, before a
  golden run is ever spent. This is the same envelope SEED-132 is about.
- **Ordering constraint for whoever implements it:** a phase declaring `folder_scope`
  while the workflow has no `project_folder_id` raises a raw Pydantic 422 at the shape tier
  (`harness.py` `_folder_scope_requires_project`) — so the workflow-level binding must be
  settable *first*, and the UI must not let a user reach the per-phase control before it.

## Surface classification

`Agentic-RAG` — this app, our builder UI and our harness scope resolution. Routing
candidate at `/gsd:discuss-phase`, `/gsd:new-milestone`, `/gsd:complete-milestone`.

Natural homes: **Phase 187** already owns the AI-seed path where `project_folder_id` is
stamped (`WorkflowBuilderPage.tsx:1059`) and its SC#3 claims the seed is
"safe-by-construction" — an unbound seeded workflow is a counterexample to that claim, so
the binding control and the claim belong together. **Phase 186** is the alternative if the
fix is framed as workflow-level settings editing rather than seeding.

## Immediate mitigation applied (2026-07-31)

Direct DB patch on the blocked draft only — `project_folder_id` set to
`75755ec9-5ba7-495b-ad93-7500011cf6f2` (Project Meridian – Risks), row's existing jsonb
encoding preserved, phases and prompts untouched, status verified `draft` before writing.
This is an unblock, not a fix — the product gap stands.

Related: the same investigation surfaced [[SEED-138]] (definition jsonb double-encoding),
which is why `definition->'project_folder_id'` returns NULL for most rows and why this
condition is hard to audit in SQL.

---

## UPDATE 2026-07-31 (same day) — severity raised `major` → `blocking`

Two further observations within ~1 hour of the original report. Both make this worse than
first written.

### 1. The bug reproduced immediately, on the same operator, in under 10 minutes

After the mitigation patch bound draft `compliance-gap-report-qqvfwd` (13:53 created,
14:05 patched), the operator authored a **new** workflow rather than publishing the patched
one, and left the knowledge-base dropdown at its default again:

| slug | created | `project_folder_id` | status |
|---|---|---|---|
| `compliance-gap-report-qqvfwd` | 13:53 | `75755ec9…` (Meridian) — patched | **draft, never published** |
| `compliance-gap-report-hhe4ar` | 14:10 | **`None`** | **published 14:13, and run** |

This is the failure mode the original report predicted, occurring unprompted: the default
is silently wrong, nothing at author time flags it, and the operator had no reason to
suspect the new workflow differed from the fixed one. It also means the mitigation does not
generalise — **patching one row does not help, because the next workflow starts unbound
again.**

Note also that `hhe4ar` is now **published and therefore frozen** (the
`workflow_definitions_block_published_update` immutability trigger, T-103-01-02), so the
same DB mitigation cannot be applied to it. The only routes are publishing the bound draft
or forking to a new version.

### 2. The judge PASSED a *worse* deliverable than the one it failed

This is the more serious finding. Comparing the two golden runs:

| Golden run | Definition | Judge | Files cited by `retrieve` |
|---|---|---|---|
| `0d1eb209` | `qqvfwd` (unbound) | **FAIL — `grounded_in_evidence` 55.00** | 3 files / 3 folders |
| `58fee9d9` | `hhe4ar` (unbound) | **PASS → published** | **11 files / 5+ folders** |

The run that passed drew from `CS SOPs final_29 Oct 2025_Billing Team Comments.pptx`
(SOPs), `Chapter_5_Full_Draft (4).docx` (Test Wasim), `rag_corpus_documents.csv` (Hybrid
Search), `kb_doc2_team_highlights.md` (Weekly reports), plus the Meridian and PM-Demo files
— **more corpus contamination than the run the judge rejected**. The shipped `emit` output
still carries the foreign `CS SOPs…pptx` row that the earlier judge explicitly named as
disqualifying.

**Implication for the fix direction.** The original report suggested making an unbound
retrieval workflow a build-time `incomplete` verdict as the *better* option. This
observation upgrades that from "better" to **necessary**: the publish-gauntlet judge is
probabilistic and has now been shown to admit a worse instance of the exact defect it
rejected an hour earlier. A hard wall that fails open under variance is not a control for
this failure mode. Scope-boundness is a **structural, deterministic** property of the
definition — it should be checked by `/validate` on the canvas, where the answer is the same
every time, not inferred by a judge from the shape of the output.

This does not impugn the judge. Judging "did it cite the *right* things" from output alone
is genuinely hard, and it caught the problem once. The point is that the cheap deterministic
check upstream was never run.

### 3. Two corrections and a third entry point (browser session, same day)

Driving the app in Chrome to apply the mitigation surfaced three refinements to the original
write-up. Recording them so the report stays accurate:

- **CORRECTION — the binding IS displayed, in one place.** The builder header shows a
  `📁 Project Meridian — Risks` chip for a bound workflow. It is *display-only* and appears
  nowhere else: not on any Workflows-page card (published or draft), and there is still no
  control to set or change it. The original claim that nothing surfaces the binding was too
  strong; the accurate claim is that it is visible only after opening the builder, and is never
  editable.
- **CORRECTION — a per-run scope override DOES exist.** The Run dialog has a "Knowledge base"
  picker (defaulting to "All documents"), which is the `run_inputs["folder_id"]` override in
  `scope.py:201`. So an operator can scope a *run*. It does **not** help publishing: the
  gauntlet's golden run takes its scope from the definition (`publish_service.py:739`), so an
  unbound workflow still publishes against the whole KB. The gap is specifically the
  **author-time** binding.
- **A THIRD unbound entry point.** Forking a starter ("Use this →" on the Risk Register
  starter) creates a draft and drops straight into the builder, **bypassing the describe screen
  and its KB picker entirely**. The forked draft is unbound with no opportunity to have chosen
  otherwise. So all three creation paths — NL generate with the dropdown left at default,
  authoring a new workflow, and forking a starter — can produce an unbound workflow, and two of
  them never offer the choice at all.

### 4. What the fix actually bought (evidence the diagnosis was right)

Re-publishing the **bound** compliance workflow (`qqvfwd`, golden run `1b678d5a`):

| | Unbound | Bound to Meridian |
|---|---|---|
| Files retrieved | 11 files / 5 folders | **2 files, both Meridian** |
| `Citations` gauntlet pip | — | **✓ green** |
| `grounded_in_evidence` | ✕ 55.00 | **no longer a named failure** |

Judge, verbatim: *"The deliverable is honestly cited and fully populated (it did the work and
correctly nulled the one unsupported cell)."*

It was still blocked — on `answers_business_requirement` (25.00) — because the Meridian folder
holds project-management documents (charter, risk workshop notes, Week-09 status report) and
**no compliance obligations at all**. The judge: *"the requirement cannot actually be satisfied
from these sources… the correct action was to surface that the report cannot be grounded, not
to repurpose risk items as compliance gaps."*

**This is the most important line in the whole investigation.** The earlier attempts looked
*closer* to passing only because unscoped retrieval smuggled in a compliance-flavoured SOPs
deck. Fixing the scope did not break anything — it removed the camouflage and revealed that the
workflow was never satisfiable against this corpus. An unbound workflow does not just risk
citing the wrong documents; it can make an **impossible task look achievable**, which is
strictly worse than failing.

Confirmed by the converse: the **Risk Register** starter, bound to the same Meridian folder,
cited all three Meridian documents and **passed the judge** (golden run `de04dcd2`, published).
Right workflow + right corpus + author-time binding = honest pass.

### Severity rationale for `blocking`

An operator can author, publish and ship a compliance deliverable built from unrelated
corpora, with no author-time warning, and with the one gate designed to stop it having
non-deterministically waved it through. The output is a plausible, well-formatted,
correctly-cited report about the wrong documents — the hardest class of wrong to notice
downstream.

---

## UPDATE 2026-08-01 — the CONTROL half shipped (Phase 186, plan 08). Status stays `folded`.

**This report is NOT closed, and the frontmatter is deliberately unchanged.** Its own
`re_open_trigger` says so: 186 closes only the repair path. `status` remains `folded`,
`folded_into` remains `"186 (control) / 187 (verdict)"`, and `verified_closed_by` remains
`null`.

### What shipped (commit `99aa0c7e`, `frontend/src/pages/WorkflowBuilderPage.tsx`)

Per D-186-15, the display-only `📁 <folder>` header chip is now the **picker** — the same
project-folder select the describe screen already renders, at a second mount point, over
the same folder list (already fetched on mount, so no new request). An author can bind or
re-bind a knowledge base **after** drafting, from the built canvas, without regenerating
and without losing canvas edits. Per D-186-16 an unbound workflow now renders an explicit
state that names the consequence rather than the state:

> **No knowledge base · searches everything**

It is an INVITATION, not a verdict — no severity, no code, no problems-tray row, no node
mark, and it does **not** join `blockedReason`, so an unbound workflow is still
publishable. That deliberate omission is the other half of the split (below).

The binding persists through the autosave path this phase rebuilt: the picker's `onChange`
calls `setProjectFolder`, which writes `meta.project_folder_id` **and** arms `dirty` in one
act, so the leave guard fires and the debounced PATCH carries the binding.

### What was verified, and what was NOT

**Verified by automated test** (`WorkflowBuilderPage.header.test.tsx`, 15 → 27 cases,
observed RED before the implementation and GREEN after):

- an unbound drafted workflow renders the sentence above;
- the chip is a real `<select>` offering every folder the author can reach, plus "none";
- a bound workflow reads its folder **NAME**, never a UUID;
- choosing a folder ends in `updateWorkflowDraft` carrying `project_folder_id` — the
  binding reaches the wire through the shipped save path;
- the sentence renders in exactly **one** place on the whole surface, carries no severity
  word and no severity tone (both extracted from the shipped sources, not retyped), and
  leaves the publish seam **byte-identical** to a bound control render.

**NOT verified.** No live browser run, no live DB row, no golden run, no judge. This entry
records what the automated suite proved, not that the operator's original scenario has been
re-driven end to end. The lived-experience check (G-4) belongs to the phase's UAT.

**Reachability caveat.** The control is gated on the `visual_workflow_canvas` flag, so that
D-181-01's flag-off byte-identity promise (the v3.6 revert switch) still holds. With the
flag **on** — which is how this bug was reported — all four Builder entry paths reach it:
NL generate, fork a starter, tweak a published workflow, open a draft. With the flag
**off**, the shipped display-only chip is unchanged and the repair path is still absent.
Recorded with a re-open trigger in
`.planning/phases/186-concurrency-autosave/deferred-items.md`.

### What is still open — the reason this stays `folded`

The deterministic build-time `/validate` `incomplete` verdict for an unbound retrieval
workflow (**Phase 187**, SEED-132 envelope). 186 deliberately built no verdict: the repair
path exists now, but nothing at author time still *tells* an author that an unbound
retrieval workflow is a problem before a golden run is spent. Given §2 above — the judge
passed a worse deliverable than it failed — that half is the necessary one.

**Close this report only when BOTH are true:** an author can re-bind from every creation
path (shipped, pending live confirmation), **and** an unbound retrieval workflow is caught
deterministically on the canvas before a golden run is spent (Phase 187).

---

## UPDATE 2026-08-02 — the VERDICT half is planned and built (Phase 187, plan 03). Status stays `folded`.

**Still not closed.** `status: folded`, `folded_into: "186 (control) / 187 (verdict)"`,
`verified_closed_by: null` — unchanged, deliberately. Per this report's own
`re_open_trigger`, closing needs BOTH halves *verified*, and neither has had its live
confirmation yet: 186's re-bind control ships without a live browser run, and the verdict
below ships without one either.

### What was built (Phase 187, plan 03 — `backend/app/api/workflows.py`)

Per **D-187-11**, `POST /workflows/validate` now mints a new finding:

| | |
|---|---|
| Code | `unbound_retrieval` |
| Severity | `incomplete` — "you are still building", never red "broken" |
| Keying | **per node** — one verdict per offending phase, keyed to `phase.slug` |
| Predicate | `definition.project_folder_id is None` **and** `grounding.grounding_cause(phase) == "detected"` |
| Home | the **route's own** code (`_ROUTE_ASSIGNED_CODES`), stage 5 of `validate_workflow` |

The predicate calls `grounding.grounding_cause` — the ONE home of the
`available_tools ∩ KB_TOOLS` intersection (`grounding.py`, Phase 185). No local tool list
was introduced, so the day a 6th KB tool is added to `KB_TOOLS` this check picks it up for
free. The message states a fact and its consequence and nothing more: *"phase 'X' reads your
documents, but this workflow is not bound to a knowledge base — it would search
everything."* It never says "unsafe" and never says "blocked".

### The deliberate decision NOT to put it in `grounding.grounding_verdicts`

`grounding_verdicts` is **shared with publish** — plan 182-06 made the publish gate
enforcing through that same collector. A rule added there would silently become a **hard
publish blocker** in addition to a canvas verdict, changing what can be published. Phase 187
is not scoped to change publish behaviour, so the check is minted in the `/validate` route,
which is the only seam where a verdict can be canvas-only. `test_182_severity_codes.py` now
asserts this directly: `unbound_retrieval` is in `_ROUTE_ASSIGNED_CODES` and in **neither**
owning module's published code set, so the boundary fails a test rather than drifting.
`test_182_publish_grounding_stage.py` is run as proof that publish classification is
unchanged.

### Why this blocks publish on the canvas anyway

`blockedReason` (`frontend/src/pages/WorkflowBuilderPage.tsx:1093-1102`, measured
2026-08-02) returns the first verdict's message verbatim for **any** `ok: false` response —
`error` findings are merely ordered ahead of `incomplete` ones, so an `incomplete`-ONLY set
still falls through to `validation.verdicts[0]` and yields a non-null reason. And
`ValidateResponse.ok == (verdicts == [])` by construction, so one `incomplete` verdict is
enough. The author is therefore told on the canvas, at edit time, before a golden run is
ever spent — which is the half §2 above showed is the necessary one, because the publish
judge passed a worse deliverable than it failed.

Note the reachability boundary, honestly: `blockedReason` is gated on `canvasEnabled` and
`builderPhase === "drafted"`. With `visual_workflow_canvas` **off**, the D-181-01 revert
switch holds and this verdict reaches no UI — the same caveat the 186 entry recorded for
the re-bind control.

### What is NOT verified

- **No live browser run.** No screenshot, no observed canvas verdict, no observed Publish
  button state. Everything above is proven by unit tests against the route handler and by
  reading the shipped `blockedReason` source.
- **No live golden run**, no live judge, no live DB row. The original operator scenario has
  not been re-driven end to end.
- **No live confirmation of 186's control half either** — it was never obtained.

Both are the phase's UAT (G-4 lived-experience). Flip this report to `closed` only after
both halves have been observed in the product, not after a passing suite.
