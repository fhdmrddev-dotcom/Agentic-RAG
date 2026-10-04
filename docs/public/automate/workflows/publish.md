---
title: Publishing (the gauntlet)
slug: automate/workflows/publish
section: automate
audience: user
status: written
release: shipped
covers: [A23, C30]
summary: >-
  Before a workflow is published it passes a 10-stage check, including a real test run that an
  independent AI judge grades against the workflow's one business requirement.
video: clip.automate-workflows-publish
reviewed: 2026-10-04
---

Publishing turns a draft into a frozen version that you can run from the Workflows page and put on a schedule. A workflow that passes its structural checks but produces bad output cannot publish: before it is frozen, it has to do the real job once, and an independent judge has to agree it did.

## The ten stages

When you choose to publish, Syrel runs the checks in order and shows them as a strip of ten stages. The first stage that fails stops the publish and says why.

| Stage | What it checks |
|---|---|
| Owner | The workflow exists and you own it. |
| Valid | The definition is a valid workflow. |
| Goal | The workflow declares exactly one business requirement — the result it exists to produce. |
| Structure | Every step is reachable, the workflow has an end, every input a step needs is supplied, and nothing is orphaned. |
| Pause | Steps that pause for a person can be handled during the test run. |
| Grounding | Every folder, tool and skill the workflow points at actually exists. |
| Golden run | A real run of the workflow against your project's documents. |
| Citations | The citation and integrity checks that ran during the golden run passed. |
| Judge | An independent model grades the deliverable against the business requirement. |
| Commit | The draft did not change while it was being checked. |

The strip shows a worded verdict, with the raw detail of each stage available when you want it.

## The golden run

The golden run is a real run, not a simulation: it reads your documents, runs every step and its checks, and produces the deliverable. If the workflow asks a person for a choice partway through, the golden run continues with the first configured choice, so a human-in-the-loop workflow can still publish — while a live run will still pause for a real person.

If the golden run times out or fails, the publish stops at that stage and the workflow stays a draft.

## The judge

The judge is a separate model that grades the golden run's deliverable against the business requirement you declared. A deliverable that is well-formed but does not meet the requirement fails here. An operator chooses which model acts as judge.

## After publishing

- The published version is frozen: it cannot be edited, so every run of it follows the same steps.
- A published workflow appears on the Workflows page, where you can run it or give it a schedule.
- If the deliverable is a file, the run produces it for you to download.

Word and PDF files are downloaded, not previewed inside Syrel.

> **Note:** Older release notes describe a publish check with eight stages. Two stages were added later — Grounding and the final Commit check — so it has ten today.
