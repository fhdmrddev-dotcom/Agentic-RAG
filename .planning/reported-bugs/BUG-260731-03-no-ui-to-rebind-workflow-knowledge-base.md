---
id: BUG-260731-03
title: A workflow's knowledge base can only be chosen on the pre-draft describe screen — an unbound workflow searches the WHOLE KB and cannot be re-bound without regenerating
reported: 2026-07-31
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [frontend/workflow-builder, backend/harness/scope, workflows/publish-gauntlet, RAG/retrieval-scope]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-132, SEED-136]
re_open_trigger: null
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

### Severity rationale for `blocking`

An operator can author, publish and ship a compliance deliverable built from unrelated
corpora, with no author-time warning, and with the one gate designed to stop it having
non-deterministically waved it through. The output is a plausible, well-formatted,
correctly-cited report about the wrong documents — the hardest class of wrong to notice
downstream.
