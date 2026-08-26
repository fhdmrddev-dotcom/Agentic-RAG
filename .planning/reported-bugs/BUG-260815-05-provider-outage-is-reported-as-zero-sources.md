---
id: BUG-260815-05
title: A retrieval-provider outage is reported to the operator as "nothing was retrieved (0 sources)" — an outage is indistinguishable from an empty knowledge base
reported: 2026-08-15
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [RAG/retrieval, backend/harness, workflows/publish-gauntlet, observability, embeddings, settings, admin/control-room]
folded_into: 210
verified_closed_by: null
related_seeds: [SEED-165]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 2986541f
  date: 2026-08-15
---

# BUG-260815-05: an embedding-provider 429 is surfaced as "your documents returned nothing"

## What we observed

Three consecutive golden runs failed during Phase 193.2's operator UAT, each blocked at publish.
Every one reported, verbatim and identically:

```
citations_required: nothing was retrieved (0 sources) — this step reads your documents
and must show where its answer came from
```

**That sentence is false.** Measured at the database and at the provider:

| Check | Result |
|---|---|
| Northwind KB documents in the bound folder (`Template-Test`) | **5**, all `status=completed` |
| Chunks | **18**, **0** with a NULL embedding |
| Embedding model / dimensions across the whole KB | one model, `text-embedding-3-small`, **1536**, 940 chunks |
| `org_id` on run vs documents vs folder | **identical** (`22f9c615…`) |
| Failing definition vs the definition that WORKED at 02:07 the same day | same `project_folder_id`, same `folder_scope: None`, same core tools |
| **A live `embeddings.create` call** | **`429 insufficient_quota` — `credit_balance_exhausted`, "You have no credits remaining"** |

Every document is embedded with `text-embedding-3-small`, so **every search must embed the query at
retrieval time**. With the OpenAI balance at zero that call fails, no vector search runs, and the
gate sees zero sources. The 429 is swallowed somewhere between the provider client and the gate.

**Timeline that isolates it:** Phase 193.1's run `d8331add` succeeded against this exact knowledge
base at **02:07** (11 of 13 planted facts). The three failures ran at **14:01, 14:07, 14:10**. No
code in the retrieval path changed between them — Phase 193.2 touched four source files
(`db/workflows.py` two `ORDER BY` lines, `models/harness.py`, `publish_service.py`,
`workflow_authoring.py`), none of them retrieval.

## Why it matters — severity `blocking`

**The operator could not diagnose this, and said so.** The message names a plausible, actionable,
*wrong* cause: it reads as *"your knowledge base has nothing on this topic"*, which sends the author
to re-check their documents, their folder selection, and their prompt wording — all of which were
correct. Diagnosis required an assistant reading `harness_audit`, `document_chunks`,
`workflow_definitions` and finally calling the embeddings API by hand. **There is no path from the
product's own surfaces to the real cause.**

⚠ **This is the same failure class the project has now fixed twice in copy and shipped once in
behaviour.** `193.2` exists because *the system knows things it does not tell the author*, and
`SEED-165`'s triage explicitly flagged *"a NULL that reads as 'empty' rather than 'you asked
wrong'"* as the shape worth fearing. **Here it is in production, costing a real UAT session.**

⚠ **The blast radius is the whole knowledge base, not one workflow.** Embedding is the one place
this project has **no provider fallback** — chat routes across seven providers via
`MODEL_CAPABILITIES`, but embedding is OpenAI-only (see `SEED`/memory *embeddings OpenAI SPOF*). An
empty balance silently zeroes retrieval for **every** search, every workflow and every chat that
grounds on documents. Nothing anywhere says so.

⚠ **The judge shares the same single point of failure.** `app_settings.harness_judge_model` is
`gpt-5.5` — also OpenAI. Had any run reached the judge stage it would have failed too, and
`resolve_judge_model`'s fallback chain (`claude-opus-4-8` → `gpt-5.5` → `None`) only helps when the
knob is *unset*, not when the configured provider is refusing.

## Hypothesized cause

The embedding client's exception is caught and converted into an empty result set rather than
propagated as a provider error. The gate then reports the empty set honestly, but the emptiness has
two very different meanings that the pipeline has collapsed into one:

1. *"the vector search ran and matched nothing"* — a real, honest empty result
2. *"the vector search never ran"* — an outage

**These must not share a message**, and the project already has a precedent for exactly this
distinction: `193.1`'s `resolve_template_placeholders` returns `("ok" | "unreadable" |
"not_requested")` precisely so that *could not read* is never indistinguishable from *nothing to
read* — and `grounding.py` carries a standing rule that a read failure must NEVER enter `degraded`
for the same reason. Retrieval needs the same three-state honesty.

## What a fix must do

1. **Propagate the provider error.** A retrieval call that could not execute must raise or return a
   distinguishable status — never `[]`. Follow the `("ok" | "unreadable" | "not_requested")`
   precedent rather than inventing a new shape.
2. **Say the true thing in the gate message.** *"The embedding provider refused the request
   (insufficient quota) — retrieval did not run"* is a different sentence from *"nothing was
   retrieved"*, and only one of them is actionable.
3. **Surface it to the operator/admin, not only in logs.** The Control Room already owns a
   dependency-health surface (Phase 146-148 pinned vitals). **An exhausted embedding provider is a
   dependency-health signal and belongs there** — an operator should learn this from a health tile,
   not from a failed publish three attempts later.
4. **Do not retry three times against a hard quota error.** All three attempts were identical and
   ~5-6 s apart. A `429 insufficient_quota` is not transient; retrying it wastes the run and hides
   the cause behind repetition.
5. ⚠ **Do not fix this by adding an embedding fallback provider.** That is a separate, larger
   decision (re-embedding the corpus, dimension compatibility, `SEED` *embeddings OpenAI SPOF*).
   This bug is about **honesty**, not redundancy. Fixing the message is cheap and independent.

## Related

- `SEED-165` — the triage that named this exact failure shape before it fired
- `BUG-260731-01` — the open question about whether the judge-model knob is wired; same
  observability family
- `BUG-260815-06` — the structural-gate refusal that named nothing actionable during the same
  session (the second half of this diagnosis gap)
- Phase 193.1 `D-26` / `resolve_template_placeholders` — the three-state honesty precedent to copy
- Phase 193.2 — the phase whose UAT this blocked; its thesis is *the system knows things it does not
  tell the author*
