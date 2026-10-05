---
title: Building a workflow
slug: automate/workflows/builder
section: automate
audience: user
status: written
release: shipped
covers: [A22, C28, C29]
summary: >-
  Start a workflow by describing it and letting Syrel draft it, or build it yourself on the
  canvas; declare its inputs, configure each step, and save drafts as you go.
video: clip.workflows
reviewed: 2026-10-04
---

You build workflows in the **Workflows** area of the rail. A new workflow starts as a draft. Workflows are personal: one you build is visible only to you, while the starter workflows shipped with Syrel are visible to everyone. Sharing a workflow with your organisation is not available today.

![The workflow builder canvas with a step's settings open](/docs-assets/shots/workflow-builder.png)

## Two ways to start

When you create a workflow, Syrel asks **How do you want to start?** Both ways end up in the same editor, and you can switch at any time.

| Door | You | Syrel |
|---|---|---|
| **Draft it for me** | Write one paragraph describing the recurring work. | Writes the steps, sets how strict each one is, and asks you about anything it had to guess. |
| **Build it myself** | Decide every setting: what each step must cite, which checks have to pass, and which sources and model each step uses. | Checks your structure as you go. |

A drafted workflow is grounded in what actually exists in your organisation — your folders, the available tools and skills, and any template you attach — and Syrel retries the draft automatically if it fails validation. You can also start from a starter workflow on the Workflows page: copying it gives you your own draft.

## The canvas

The canvas shows your workflow as connected steps. You can add, move, connect, configure and delete steps, and every edit saves back to the definition the engine runs.

- **You cannot draw an invalid workflow.** As you build, the server checks the structure — every step reachable, the tools allowed, checks wired correctly — and each step shows the server's verdict.
- **Steps read in plain words**, such as "Work out how to do it" or "Produce the deliverable". A step you have named or configured shows what it does; the technical type names are one reveal away.
- **Drafts save as you work.** Moving a step saves the draft without creating a new version.
- **A stale copy cannot overwrite a newer one.** If the workflow changed since you opened it (for example in another tab), your save is refused with a clear message instead of silently replacing the newer version.

An operator can switch the canvas off for everyone from feature visibility. It is on for everyone by default.

## Configuring a step

Selecting a step opens its settings beside the canvas. Depending on the step type you can set:

- **What it does** — the instruction, in plain language.
- **Its sources** — which folders it may read. A workflow can be bound to a project folder (and its subfolders), and a step can narrow that further. The scope is fixed when the run starts; the model cannot widen it.
- **Its tools and skills** — the step can use only the tools it lists. A step can bring in a saved skill; the skill's version is frozen into the published workflow, so editing the skill later cannot break it.
- **Its model** — chosen from the models registered for your organisation.
- **Its checks and citation policy** — see [Checks that must pass](/docs/automate/workflows/checks) and [Grounding and citations](/docs/automate/workflows/grounding).
- **An approval checkpoint** — arm the step to stop and ask a person before it runs.
- **For a "Reach outside" step** — pick a service, then one of its actions, and fill each argument from a run input, a fixed value or an earlier step's result. Publishing refuses a step whose required arguments nothing can supply.

## Declaring inputs

A workflow can ask for inputs when it runs: text, a number, a date, a choice from a list, or a file. Steps can use an input's value, and an outside action can take an argument from it. You can also attach a document template while building; every run then fills that same template with current information.

Word and PDF files are downloaded, not previewed inside Syrel.

## Next

When the draft does what you want, publish it: [Publishing (the gauntlet)](/docs/automate/workflows/publish).
