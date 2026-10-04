---
title: What a workflow is
slug: automate/workflows/overview
section: automate
audience: user
status: written
release: shipped
covers: [A21, C1, C8, C27]
summary: >-
  A workflow is a fixed sequence of steps with checks between them. Syrel runs the steps in order,
  cites its sources, and cannot quietly skip a step or pass a failed check.
video: explainer.automate-workflows
reviewed: 2026-10-04
---

A chat answer is Syrel deciding, in the moment, how to help. A workflow is the opposite: a process your team defines once — "read the project documents, draft the weekly status report, check it, fill our template" — that Syrel then runs the same way every time.

## What a workflow is made of

- **Steps.** Each step does one kind of work: prepare the inputs, write something in one pass, work out a task with tools, split work across several helpers, check with you, produce the deliverable, or reach outside Syrel. See [Step types](/docs/automate/workflows/step-types).
- **Checks.** A step can require checks before it counts as done — the output matches a schema, claims carry citations, the output file opens, an AI judge scores it against a rubric, and more. A failed check leads to a bounded retry, a jump to another step, or a failed run. It never loops forever. See [Checks that must pass](/docs/automate/workflows/checks).
- **Grounding.** A step that reads your knowledge base must cite what it found, or it fails. You can make any step strict, but you cannot loosen a step that reads your knowledge base. See [Grounding and citations](/docs/automate/workflows/grounding).
- **Inputs.** A workflow can declare inputs — text, a number, a date, a choice from a list, a file — that whoever runs it fills in.
- **A deliverable.** A workflow can end by filling a Word template with values traced to their sources. The file is produced by fixed code, not written freehand by the model, and it is reopened and checked before the run counts it done. See [Producing a deliverable](/docs/automate/workflows/deliverables).

Word and PDF files are downloaded, not previewed inside Syrel.

## How it differs from chat

| | Chat (Deep mode) | Workflow |
|---|---|---|
| Who decides the next step | The model | The server, in the order the workflow defines |
| Tools | Everything your settings allow | Only the tools each step lists |
| Checks | None beyond the answer's citations | Every step's checks must pass |
| Repeatability | Each answer is new | Published workflows are frozen versions, so a rerun follows the same steps |
| Record | The chat history | Every step, check result and refused tool call is written to an insert-only audit trail |

## The life of a workflow

1. **Build it.** Describe it in plain language and let Syrel draft it, or build it step by step on the canvas. See [Building a workflow](/docs/automate/workflows/builder).
2. **Publish it.** Publishing turns your draft into a frozen version you can run and schedule. First it passes the publish check: ten stages, including a real test run graded by an independent judge. See [Publishing (the gauntlet)](/docs/automate/workflows/publish).
3. **Run it.** Run it from its card on the Workflows page, or on a schedule. Workflows are personal today: a workflow you build is visible only to you, and the starter workflows shipped with Syrel are visible to everyone. A run opens a chat in Workflow mode and has its own page showing each step, its checks and timings, and the deliverable. You can stop it at any point.

Runs are stored in the database, so a run can resume after a server restart.

## Safety rails

- A step can be armed to stop and ask a person before it runs. Steps that act outside Syrel — sending email, posting a message, creating a ticket — are always armed.
- Real sending is off until an operator switches it on. Until then, an outside action records what it would have sent: "Not sent — recorded". See [Real sending vs recorded](/docs/connect/live-sending).
- Scheduled and unattended runs have spend and time caps; a run that goes over is stopped the same way you would stop it, and the stop is recorded.
- Your organisation's plan decides whether workflows can be authored and run. A refusal names the plan that would allow it.
