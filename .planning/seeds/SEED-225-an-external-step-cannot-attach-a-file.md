---
seed_id: SEED-225
title: An external step cannot attach a file — and an attachment needs two facts the model must not conflate
status: planted
status_note: |
  ── 2026-09-18 · RE-CONFIRMED BY MEASUREMENT and RE-PRIORITISED. Still true in the tree:
  `backend/app/services/connectors/smtp_adapter.py:289` reads "No CC, no BCC, no attachment,
  no HTML part" (D-32), and `slack_adapter.py:404` refuses `blocks` and `attachments` the same
  way. ⚠ SEVERITY IS UNDERSTATED AT `minor` FOR A COMMERCIAL OFFERING: a workflow that produces
  a deliverable cannot DELIVER it, which leaves several sellable shapes with no ending. Named
  by an outside architecture read as P14, blocking a finance-close pack and an RFP pack; see
  SEED-294 (go-to-market) and SEED-198 (the pack SKU). Left `minor` rather than raised, because
  the rating is honest about the ENGINEERING and the commercial weight belongs in SEED-294.
planted: 2026-08-28
planted_by: operator, during Phase 214's G-4 drive — raised as a gap while testing send_email
surface: Agentic-RAG
severity: minor
category: capability gap / outbound
priority: medium
scope: >
  An external action step takes text arguments only. There is no path by which a workflow's own
  output — or a knowledge-base document — can leave as an email attachment. Closing it needs an
  attachment argument SOURCE, not just an argument.
affected_areas: [backend/app/services/connectors, smtp-adapter, backend/app/services/harness/phase_types.py, frontend/src/components/workflows/ArgumentEditor.tsx]
relates_to:
  - BUG-260826-01 (argument sourcing — this is the same machinery extended to a non-text type)
  - BUG-260828-02 (nothing can declare a workflow input; an attachment source needs the same authoring surface)
  - BUG-260828-06 (the body is delivered as raw markdown — a rendered attachment has the same root)
  - SEED-217 (an upstream argument source is inert on native capability rows — an attachment sourced from an earlier step hits exactly this)
re_open_trigger: >
  The next phase that touches external-action arguments or the SMTP/Drive adapters — OR the first
  time a workflow is asked to deliver a produced document rather than a produced sentence. Also
  re-open if BUG-260828-02 ships the declared-input authoring surface, since the attachment source
  is the same surface with one more type.
trigger_when: unset
---

# SEED-225 — sending a file, and the two facts an attachment needs

## Where this came from

Raised by the operator mid-drive at Phase 214's G-4 checkpoint, while testing a `send_email` step:
*"what if this workflow includes a file or files that will be sent to that email?"*

Not tested, because there is nothing to test — the capability does not exist.

## The state today

An external action step resolves **text** arguments only (`to`, `subject`, `body`). Nothing in the
argument model, the editor or the SMTP adapter carries a file. A workflow that produces a document
can put its *text* in the body and cannot deliver the *document*.

## ⚠ The finding worth keeping: an attachment is TWO facts, not one

The operator stated it precisely — sending a file needs, separately:

1. **Which file is attached** — an identity: a produced output file, a knowledge-base document, or a
   rendered artefact of this run.
2. **A body that refers to that file** — text that describes what is attached and why.

These must not be conflated, and the second must not be allowed to *imply* the first. A body that
says *"please find the report attached"* while the attachment resolution silently produced nothing is
the same class of defect as `SEED-217` (an argument source that is inert and drops in silence) and
`BUG-260828-03` (a model narrating a capability it did not check). **If the attachment cannot be
resolved, the step must refuse — never send the body alone.**

## Why it is a seed and not a patch

It needs a new argument *source kind* — "a file from an earlier step" / "a document from the library"
— which is the `ArgumentSourceKind` machinery Phase 214 built, extended to a non-text type. That
means: the editor's source picker, the publish gate's satisfiability predicate, the approval pause's
argument list, and the receipt all have to learn a type they do not have. It is a phase, not an edit.

## Sequencing

Blocked behind `BUG-260828-02` — the declared-input authoring surface. An attachment argument sourced
*at launch* has nowhere to be declared until that ships, and an attachment sourced *from an earlier
step* hits `SEED-217`'s inert-upstream defect on the way through.
