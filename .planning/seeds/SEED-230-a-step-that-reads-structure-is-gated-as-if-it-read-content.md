---
id: SEED-230
title: A step that reads STRUCTURE is gated as if it read CONTENT — owning a search tool synthesizes a citation gate the author never declared and cannot see
status: planted
planted: 2026-08-29
planted_by: Claude, from six measured golden runs after closing BUG-260828-09
surface: Agentic-RAG
severity: high
category: design gap / governance
priority: high
scope: >
  `effective_phase` synthesizes a `citations_required` gate for ANY `llm_agent` /
  `llm_batch_agents` step whose `available_tools` intersects `KB_TOOLS`. The gate demands
  RETRIEVED SOURCES. A step whose job is to map folder structure answers with `ls`/`tree`/`glob`,
  retrieves nothing, and fails a gate the author never declared, cannot see in its validators,
  and whose only exit is removing tools.
affected_areas:
  - backend/app/services/harness/grounding.py
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/PhaseFormPanel.tsx
relates_to:
  - BUG-260828-09 (the bug that made this measurable — until it was fixed, the cause was invisible)
  - SEED-228 (the OTHER publish bind; measured NOT to be this one — see below)
  - D-185-01 / D-185-04 (the decision that synthesizes the gate)
  - D-185-07 (detection wins; the lock is one-way)
re_open_trigger: >
  Immediately for the DECISION (the operator has two workflows in this state). Otherwise the next
  phase touching grounding, the phase form panel's tool picker, or the citation gate.
---

# SEED-230 — the gate fires on the TOOLBOX, and the job is not in the toolbox

## What was measured

Six golden runs across two workflows, 2026-08-28. **Every single first attempt failed identically:**

```
citations_required: nothing was retrieved (0 sources) — this step reads your documents
and must show where its answer came from
```

| workflow / step | attempt 0 | attempt 1 | attempt 2 | outcome |
|---|---|---|---|---|
| KB Library Structure Summary · `survey-library` ×4 | 0 sources | 0 sources | 0 sources | ❌ run failed |
| KB Library Structure Summary · `survey-library` ×2 | 0 sources | **recovered** | — | ✅ ran |
| DeepWiki → Slack · `read-structure` ×2 | 0 sources | 0 sources | 0 sources | ❌ run failed |

**Recovery rate: 2 of 8 attempts, on byte-identical definitions.** Nothing about the workflow
changed between a failure and a success — the operator re-clicked Publish.

## ⚠ It is NOT SEED-228, and that was checked rather than assumed

Both definitions carry a real `project_folder_id` (`37380338…` and `c1012f9e…`). `unbound_retrieval`
never fired on either. SEED-228 is a separate live bind about *whole-library intent*; this one is
about *what kind of reading a step does*. **Do not fold them.**

## The mechanism, exactly

`grounding.effective_phase` appends a `citations_required` ValidatorSpec
(`mode: retrieved_and_cited`, `max_retries: 2`, `on_failure: fail_run`) whenever
`groundingCause(phase) == "detected"`. And `detected` is:

```
phase_type ∈ {llm_agent, llm_batch_agents}   AND   available_tools ∩ KB_TOOLS ≠ ∅
```

`KB_TOOLS = {search_documents, query_documents, read_document, analyze_document,
get_related_documents}`. ⭐ **`ls`, `tree` and `glob` are NOT in it.**

Both failing steps carry `ls, tree, glob` **and** `search_documents, query_documents,
read_document, get_related_documents`. Their prompts ask for a STRUCTURAL MAP —
verbatim: *"Use the folder/listing and search tools to map out the top-level folders…"*.
So the step does its job with the listing tools, retrieves nothing, and is failed by a gate it
earned for merely OWNING the search tools.

⚠ **The author cannot see the gate.** `validators: []` on every step of both definitions. The spec
is synthesized at run time and deliberately never persisted (correctly — D-185-07, so removing the
tool is a real exit). The consequence is that the author's own step list shows no gate, while the
run enforces one.

⚠ **Detection is one-way and `citation_policy` is NOT an exit here.** The `already-set` branch is
gated on `phase_type == llm_emit`; on an `llm_agent` step the dial cannot reach it. **The only exit
is removing the tool.**

## ⭐ The strongest finding: the gate is being satisfied by evidence it would itself call weak

The run that *recovered* and published carried `similarity_scores: [0.344, 0.408]`.
`api/knowledge_health.py`'s low-confidence retrieval cutoff is **0.38**. So one of the two
citations that unblocked publish is **below the line the product itself uses to flag a retrieval as
low-confidence**, and the other is barely over.

**That is not grounding — it is gate-shaped noise.** The retry feedback (*"Previous output failed
validation… Fix it"*) pushes the model to run a search it did not need, and it publishes on
whatever comes back. A gate that a model satisfies by producing weak evidence on the second try is
measuring compliance, not provenance.

## The immediate workaround, which costs no code

**Remove the four KB tools from the structural step and keep `ls`/`tree`/`glob`.** Detection stops
firing, no gate is synthesized, and the step does precisely its stated job. This is a workflow
edit, and it is available today.

⚠ **It is a workaround and not the answer**, for two reasons worth writing down: the author has to
know that a tool they are not using still governs them, and a step that *legitimately* mixes
structural and content reading has nowhere to stand.

## The decision this seed exists to put to the operator

**Is "reads your documents" a property of the TOOLBOX or of the JOB?** Today it is the toolbox.
Three ways it could go, and this seed picks none:

1. **Leave it.** The gate is right for the case it was built for, the exit exists, and the cost is
   that authors must curate toolboxes. Cheapest; keeps a one-way lock that has never been widened.
2. **Make the gate name itself in the author's step list** — render the synthesized spec as a
   read-only row on the phase form, with the tool that earned it and the one way out. Does not
   change behaviour at all; changes only whether the author can SEE what will judge them. ⚠ This is
   the smallest honest change and it addresses the operator's actual experience.
3. **Let a step declare structural reading** — a third grounding state meaning *"this step reads
   the shape of the library, not the content of documents"*, satisfied by listing tools. Most
   correct, most expensive, and it widens a lock that is deliberately one-way — so it needs a
   sketch and a threat read, never a quiet patch.

⚠ **What it must NOT become:** a way to turn the citation gate off. A step that answers FROM
document content must still show where the answer came from. This seed asks for the system to be
able to tell those two jobs apart — or, failing that, to say out loud which one it thinks it is
looking at.
