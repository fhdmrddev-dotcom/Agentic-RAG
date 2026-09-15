---
seed_id: SEED-168
title: The CLASS of work the product is for — standardized, knowledge-derived, human-accountable work across domains — and the six capability axes it demands
created: 2026-08-16
planted_during: Phase 194.1 UAT (operator correction to SEED-167)
status: planted
priority: high
relates_to:
  - SEED-167 (living risk register) — ⚠ **SEED-167 IS AN INSTANCE OF THIS SEED, NOT THE REQUIREMENT.**
    The operator corrected this explicitly. Anyone planning from 167 alone will build a risk-register
    feature; the ask is the class.
  - SEED-014 (Automations & Routines) — the scheduling axis (axis A). One of six, not the whole.
  - SEED-142 (two-way connectors / auto-ingest) — the intake axis. Without it the knowledge base only
    changes when a human uploads, which caps every case below.
  - SEED-146 (connections umbrella) — the write-back axis (axis E5).
  - SEED-148 → RUN-02/RUN-03 (phase 195) — the "show me what it produced" axis.
  - SEED-141 → NODE-01 (phase 198) — the deterministic-step axis (axis C/B).
  - NODE-02 (phase 198) — the human-role axis, and **the one thing v3.7 can still cheaply get right**.
  - BUG-260816-06 — an unanswered human step becomes an approval. Axis D is broken today, not just thin.
trigger_when:
  - Scoping ANY phase that touches phase types, the authoring vocabulary, or the human-in-the-loop step
  - "/gsd:discuss-phase 198" — NODE-01 and NODE-02 both live here; read the axes table first
  - Planning the automations milestone (SEED-014) — use the axes as the milestone's coverage checklist
  - Any milestone-scoping conversation that asks "what is this product FOR?"
surface: Agentic-RAG
---

# SEED-168: The class of work — and the six axes that decide whether we cover it

## The correction that produced this seed

`SEED-167` was written from the operator's worked example (a self-updating risk register). The operator
corrected the framing the same day, and the correction is the point:

> "This is an example. I don't want you to just take the specific thing and implement things according to the
> specific example. The point is that we need to automate as much as possible business cases in different
> domains based on the knowledge in knowledge base … Let's say if I am a project manager … maybe I have
> something that is recurring that depends on the knowledge that I have. So risk example is one of them …
> Imagine something else in the HR department … and generalise this rule based on different domains like
> finance, like legal, maybe education, hospital … just to make sure that our workflow engine and the way we
> are presenting this workflow along the user to interact or see can cover most of the real business cases
> that rely on both a human and a knowledge base."
> — operator, 2026-08-16

⚠ **Building SEED-167 as specified would produce a risk-register feature and would MISS this.** The register
is a probe, not a requirement.

## The rule, stated once

> **The product automates standardized work whose input is organizational knowledge and whose output a person
> must be willing to stand behind.**

Three clauses, each load-bearing:
- **standardized** — the same shape recurs, so it is worth encoding as a workflow at all;
- **knowledge-derived** — the inputs are the company's own documents, emails, meetings, tickets, not a public
  corpus and not the model's memory;
- **human-accountable** — someone's name is on the output, so the human step is not decoration and *automation
  without a credible human moment is not a cheaper version of this — it is a different, unsellable product.*

## Domain examples — enough to prove generality, deliberately NOT exhaustive

| Domain | Cases |
|---|---|
| **Project / PMO** | risk register · issue & action log · weekly progress report · milestone / RAID tracking · steering-committee pack · change-request log · lessons-learned rollup |
| **HR** | job description from role knowledge · interview scorecard synthesis · onboarding pack assembly · policy attestation Q&A · performance-review evidence pack · exit-interview theme rollup · headcount & attrition reporting |
| **Finance** | variance commentary (actuals vs budget, with narrative) · month-end close checklist · AP/AR exception report · expense-policy compliance sweep · board pack assembly · audit evidence-request fulfilment |
| **Legal / Compliance** | contract obligation register · clause deviation review against a playbook · renewal & expiry calendar · regulatory-change impact assessment · NDA triage · litigation-hold scoping |
| **Education** | curriculum mapping to standards · accreditation evidence pack · student progress reporting · syllabus refresh against updated standards · safeguarding incident log |
| **Healthcare** | clinical audit cycle · incident / near-miss trend report · policy-review-due register · accreditation evidence pack · M&M meeting prep · guideline-change impact review |

⚠ **Read the COLUMNS, not the rows.** Almost every case above is one of: *maintain a register*, *produce a
periodic report*, *check a corpus against a standard*, *assemble an evidence pack*, *watch for what is due or
missing*. **Five shapes cover six domains** — which is the actual finding, and the reason a domain-by-domain
feature list would be the wrong response to this seed.

## The six capability axes

Derived from the cases above. **These are the coverage checklist** — the question is never "can we do HR?",
it is "which axis positions can the engine express?"

**A · Temporal** — what starts the run
`A1` on demand · `A2` on a cadence · `A3` on an event (a document lands) · `A4` on a *date condition* (this
policy is due for review in 30 days — nothing "happens"; the workflow must go looking)

**B · State** — what the run knows about last time
`B1` stateless generation · `B2` **incremental update of a prior artifact** · `B3` append-only log ·
`B4` reconciliation of two sources

**C · Evidence** — how it reads the knowledge base
`C1` retrieve-and-summarize · `C2` **per-document extraction across a SET** (40 contracts → 40 obligation
rows) · `C3` comparison against a reference (playbook, standard, policy) · `C4` **absence / exception
detection** (what is missing, expired, uncovered)

**D · Human role** — what the person actually does
`D1` approve/reject · `D2` **review-and-edit the draft** · `D3` **item-level adjudication** (of these 12
candidates, accept 8) · `D4` supply a judgement the KB cannot hold · `D5` sign-off with attribution

**E · Output** — what lands
`E1` chat answer · `E2` document from a template · `E3` structured register/table with stable row identity ·
`E4` multi-artifact (report + deck + email) · `E5` write-back to an external system

**F · Accountability** — why anyone trusts it
`F1` citations/provenance · `F2` confidence + escalation when weak · `F3` audit trail of who approved what ·
`F4` reproducibility

## Coverage today — MEASURED, 2026-08-16

The engine ships **seven phase types**: `llm_agent`, `llm_single`, `llm_batch_agents`, `llm_emit`,
`llm_human_input`, `programmatic`, `external_action`.

| Axis | Covered | Gap — measured, not estimated |
|---|---|---|
| **A** | `A1` | `A2` no scheduler (Phase 105, deferred). `A3` **ingestion is manual upload only** (CLAUDE.md rule; SEED-142). `A4` **nothing can express a date-condition trigger at all** |
| **B** | `B1` | `B2`/`B3`/`B4` — ⚠ **no run-to-run state exists.** `grep -rn "previous_run\|prior_run\|last_run_output\|incremental\|since_last"` over `services/harness/` + `models/harness.py` → **ZERO hits** (SEED-167) |
| **C** | `C1`, partial `C3` | ⚠ **`C2` is not a first-class shape.** `llm_batch_agents` fans out over **sub-QUESTIONS** produced by an upstream `programmatic` `split_topic` — not over a document set. "One row per contract" has no primitive. `C4` absence-detection is the weakest thing retrieval does, and nothing compensates |
| **D** | `D1`, weak `D2` | ⚠ **`llm_human_input` is ONE prompt with free text or a flat choice list.** `D3` item-level adjudication has no shape at all. `D5` attribution exists only for the armed checkpoint. ⚠ **And `D1` is currently BROKEN — `BUG-260816-06`: an unanswered step times out into a silent approval** |
| **E** | `E1`, `E2` | `E3` needs stable row identity (SEED-167 open Q2). `E4` untested. `E5` — connectors are **send-only and only 1 of 3 is drivable from a workflow** (CONN-02, unsatisfied). ⚠ Even `E2`'s output **cannot be seen from the run surface** (RUN-02, phase 195) |
| **F** | `F1`, `F2`, partial `F3` | `F3` is thin outside the armed path. `F4` golden runs exist |

⚠ **The honest summary: the engine covers `A1·B1·C1·D1·E2·F1` — one-shot, stateless, retrieve-and-summarize,
approve-once, fill-a-template, cited.** That is a real and useful column. **It is also exactly ONE position on
each of six axes**, and most cases in the table above need at least two positions the engine cannot express.

## What v3.7 can still absorb — one thing, and it is nearly free

⚠ **Reframe NODE-02 before phase 198 is scoped.** Its current text is *"A workflow can collect structured
input from a person mid-run"* — which reads as **a form node**. The axis analysis says a form is `D4`, and
**`D4` is the rarest human role in the table above.** The dominant one is **`D3` — item-level adjudication
over a list the run just produced**: *accept 8 of these 12 risks · flag 3 of these 40 obligations · approve
these 5 variance explanations and rewrite one.*

Three consequences, all cheap to act on **now** and expensive later:
1. **A form node would not cover the common case.** It would ship a second human step that still cannot do
   what a reviewer actually does.
2. **`D3` constrains upstream design.** Item-level decisions require the run to produce *items with stable
   identity* — which is `E3`, and the same identity problem `SEED-167` open-question 2 raises. **Decide it
   once, for both.**
3. **`D2` (review-and-edit) is nearly shipped and nobody has claimed it.** `PendingAskCard` already has a
   *"⤢ Review & edit full draft"* overlay. What is missing is that the edited text becomes the artifact rather
   than a comment on it.

Everything else on this seed is a milestone, not an absorption — and saying so is the point of having measured
the table rather than asserting coverage.

## Why this matters

⚠ **A product that can only do `A1·B1·C1·D1·E2·F1` demos beautifully and fails the second week**, because
week two is when someone asks *"update the one from last week"* — which is `B2`, and there is no `B2`. Every
domain in the table hits that wall at the same point, for the same reason, and it is not a domain-knowledge
problem.

**The axes are also the eval harness.** *"Does the engine cover finance?"* is unanswerable. *"Which axis
positions can it express, and which does this case need?"* is answerable, and turns a roadmap argument into a
measurement.

---

## ⚠ THE COVERAGE TABLE ABOVE WAS VERIFIED ADVERSARIALLY AND IS WRONG IN SIX PLACES

**Added 2026-08-16, hours after the table was written.** A dedicated capability-mapping pass measured every
axis position against shipped source and the live database. **The corrections are recorded BESIDE the
original rather than over it**, per this project's habit — a first pass that was wrong in a *cheapening*
direction and a first pass that was wrong in an *expensive* direction are different mistakes, and both are
visible here.

The honest column is **unchanged in shape** — `A1 · B1 · C1 · D1 · E2 · F1` — but three of those six are
weaker than claimed and two gaps are far cheaper to close than claimed.

| # | The table above says | MEASURED | Consequence |
|---|---|---|---|
| **1** | A4 — *"nothing can express a date-condition trigger at all"* | ⚠ **HALF WRONG — the date CONDITION ships and is complete.** `ViewCondition.op` includes `within_next` / `older_than` / `before` / `after` / `between` with `unit: days\|weeks\|months` (`models/document_view.py:42-64`), implemented at `document_view_resolver.py:106-112,250-262`, and **already advertised to the LLM** (`openai_service.py:154,171`). Only the **trigger** — something that evaluates it on a clock — is missing. | A4 stops being "design a query language" and becomes "a clock + a non-empty-view evaluator". **A2 and A4 become ONE piece of work, not two.** Caveat: no date-typed metadata field exists live (`metadata_field_definitions` = 1 row, `probe_k`, `string`). |
| **2** | C — *"partial `C3`"* | ⚠ **OVERSTATED — C3 is CANNOT.** `AssetRef.kind: Literal["template","reference"]` is declared (`models/harness.py:515`) and advertised to the model (`openai_service.py:787`), but **`kind=="reference"` has ZERO runtime consumers**: the only reader of `assets[]` selects `kind=="template"` (`phase_types.py:876`). | **An operator can attach a playbook today and nothing will ever read it.** The worst class of gap — the UI implies it works. |
| **3** | D — *"`D1` covered"* | ⚠ **TRUE BUT HOLLOW.** D1 is expressible only via `action_risk_armed`, and live it is armed on **exactly 5 phases, all 5 `external_action`, all 5 by the D-04 structural coercion — zero author-armed steps across 257 phases.** It is also **auto-continued on the publish golden run** (`harness_engine.py:838`), so it is never exercised at publish. | *"Covered"* reads as shipped-and-used. It is shipped and unused, on a node type that (per CONN-02) mostly sends nothing. |
| **4** | E3 — *"needs stable row identity"* | ⚠ **UNDERSTATED, in the cheap direction.** A **cited, structured, multi-row table already exists and is durably persisted**: `EmitFieldMap{scalars, rows}` (`template_render_service.py:186-198`), live as `workflow_phases.output.field_map.collections.rows` on **47 phases**,each cell `{value, source_chunk_id, source_doc, source_page}`. What is missing is an **identity field** on the row and any **consumer** — every downstream reader takes `text` only. | E3 goes from *"invent structured output"* to *"add an id and one consumer"*. **Materially cheaper than the table implies**, and it is the prerequisite D3 depends on. |
| **5** | E4 — *"untested"* | ⚠ **NOT UNTESTED — STRUCTURALLY BLOCKED.** Template binding is **definition-level, first-match-wins** (`phase_types.py:861-878`); `LlmEmitPhaseConfig` has no asset field. Live max output files in any run = **1**, across 55 producing runs. | *"Untested"* invites someone to try it and receive the same artifact twice. The fix is two files and additive-optional. |
| **6** | F3 — *"thin outside the armed path"* | ✅ Confirmed **and sharper: there is NO audit event of any kind for an `llm_human_input` answer.** The executor writes none (`phase_types.py:729-857`) and the 21 live `event_type` values contain no human-input verb. | A person's answer to a workflow question leaves **no attributable record at all** — which is a governance hole, not a logging nicety. |

### Two gaps the table MISSED entirely

- ⚠ **F2's escalation arm is also unpublishable.** Publish stage 2.5 refuses **two** shapes, not one: any
  `llm_human_input` phase **and any validator whose `on_failure == "ask_user"`** (`publish_service.py:673-738`).
  `ask_user` is the shipped D-11 escalate-to-a-human disposition used by the `freshness` gate. **The product
  ships an escalation mechanism its own publish gate refuses**, so the D-axis blocker is wider than "the gate
  refuses the human step" — it costs an F-axis position too.
- ⚠ **The human step is suppressed at AUTHORING, not just at publish.** `AUTHORING_SYSTEM_PROMPT` instructs
  the model not to compose one (`workflow_authoring.py:141-146`). And its `programmatic` bullet (`:63`) says
  *"a deterministic registered function (`fn`)"* while **naming none of them** — so an AI author cannot
  compose a valid `programmatic` phase except by guessing against a 2-entry registry.

## ⚠ THE CHEAPEST AXIS MOVE IN THIS DOCUMENT — and it needs no engine change

**Open the `programmatic` registry.** It holds exactly **two** functions today (`split_topic`, and
`eval_slow_step`, which is `split_topic` plus a 20-second sleep for one seed workflow) —
`harness/programmatic.py:38-43,73,128`. Everything around it ships: the decorator, the executor,
`input_keys` resolution, and — critically — `_exec_programmatic` **spreads every key of a prior phase's
output dict into `fn_input`** (`phase_types.py:496-503`), so a registered fn can already read `field_map`.

The single highest-leverage consequence, measured rather than argued: **`_collect_sub_questions` accepts a
`sub_questions` list from ANY prior phase output** (`phase_types.py:1676-1681`), and an agent phase's
`source_refs` is already `[{document_id, filename}]`. **So ONE registered function — read `source_refs`,
return `{"sub_questions": [per-document task, …]}` — makes `llm_batch_agents` fan out over a DOCUMENT SET
today, with zero change to the engine.** That is axis **C2**, the shape half the legal and finance cases in
the table above need, unlocked by one function in one file.

The same lever then reaches **C4** (a set-difference fn is the first absence primitive), **E3** (a fn can mint
stable row ids over `field_map`), and **B2/B4** (the deterministic diff/merge SEED-167 argues for, once a
state source exists).
