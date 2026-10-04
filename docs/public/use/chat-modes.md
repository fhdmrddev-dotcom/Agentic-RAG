---
title: Deep mode and Workflow mode
slug: use/chat-modes
section: use
audience: user
status: written
release: shipped
covers: [A6, C25]
summary: >-
  In Deep mode Syrel decides how to answer; in Workflow mode a chat follows a published workflow
  step by step and is locked until the workflow ends or you cancel it.
video: clip.use-chat-modes
reviewed: 2026-10-04
---

Every chat is in one of two modes. Most of the time you are in **Deep mode** without thinking about it. A chat switches to **Workflow mode** when it runs a published workflow.

## Deep mode: Syrel works it out

In Deep mode Syrel is a free agent. It decides which tools to use and in what order — searching your documents, reading a file, running code, asking you a question — and stops when it has an answer.

Deep mode has two flavours, chosen in the composer:

| Choice | What Syrel can do |
|---|---|
| General | Everything your settings allow: document search and reading, code, skills, memory, the workspace, connected services. |
| Explorer | Only the tools for browsing and reading your Library (list, tree, search inside documents, read), plus whole-document analysis. It answers in plain prose rather than raw tool output. |

Use Deep mode for questions, research, drafting and one-off tasks.

## Workflow mode: Syrel follows the steps

In Workflow mode the chat runs a published workflow. The server controls each move from one step to the next, so the model cannot skip, reorder or invent steps. Each step can only use the tools the workflow allows it, and each step's checks must pass before the next step starts.

You start Workflow mode by running a published workflow from the **Workflows** page. Syrel asks for the inputs the workflow declares, then opens a chat that runs it. See [What a workflow is](/docs/automate/workflows/overview).

While a workflow runs:

- The chat is **locked**: the composer reads "Workflow running — Cancel to switch back", and the General/Explorer choice is controlled by the workflow.
- The workspace panel shows the workflow's steps as a live timeline, with the current step, the steps still to come and each check's result.
- If the workflow reaches its step limit, you get a **Continue** button that grants a bounded amount of extra work, instead of the run being cut short.

When the workflow finishes, or when you cancel it, the chat returns to Deep mode.

## Which to use

| You want to | Use |
|---|---|
| Ask a question or explore your documents | Deep mode (General or Explorer) |
| Produce the same kind of result the same way every time | Workflow mode, by running a published workflow |
| Get a cited, checked deliverable such as a filled report template | Workflow mode |

Word and PDF files are downloaded, not previewed inside Syrel.
