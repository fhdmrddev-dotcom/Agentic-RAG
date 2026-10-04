---
title: Key concepts
slug: get-started/key-concepts
section: get-started
audience: user
status: written
release: shipped
covers: [A10, A13, A27]
summary: >-
  The words Syrel uses for its building blocks, from chats and runs to skills, workflows, Experts
  and connections.
reviewed: 2026-10-04
---

A short glossary of the words you will meet across Syrel and these docs.

## Working in chat

**Chat (thread).** One conversation with Syrel. Syrel keeps the history itself and sends it to the model on each turn; no conversation state is held by the AI provider.

**Run.** One piece of work Syrel does for you — answering a message, or carrying out a workflow. A run keeps going if you refresh the page, switch tabs or open the chat in a second tab, and you can stop it at any time.

**Tool.** An action Syrel can take during a run, such as searching your documents, reading a file, running code or asking you a question. Each tool use appears as a card you can open.

**Citation.** A numbered marker such as `[1]` on a claim taken from your documents. It links to the exact passage.

**Confidence.** A High, Medium or Low badge on answers grounded in your documents, based on how closely the retrieved passages matched.

**Workspace.** The files Syrel writes during a chat, with every version kept. You see them in the workspace panel beside the chat, together with Syrel's to-do list and any question it is waiting on.

**Sandbox.** An isolated container where Syrel runs Python when your operator has switched code execution on.

**Memory.** Facts and preferences Syrel stores to use in later chats.

## Your knowledge

**Library.** Where your documents live, in folders.

**Document.** A file Syrel has read, split into searchable sections and labelled with details such as type, date and author. Re-uploading a file with the same name creates a new version.

**Saved view.** A virtual folder: a saved filter that lists every document matching it, wherever it is stored.

**Scope.** The folder (and its subfolders) a chat is limited to. With no scope, Syrel searches everything you can see.

## Automation

**Skill.** A named set of instructions, with optional files, that Syrel loads when a request matches it.

**Workflow.** A fixed sequence of steps that Syrel runs in order. The server controls each move from one step to the next; the model cannot skip or reorder steps.

**Step.** One stage of a workflow, such as "Work out how to do it" or "Produce the deliverable".

**Check.** A test a step must pass before it counts as done, such as "claims must carry citations".

**Deliverable.** The file a workflow produces, for example a Word report filled from a template. Word and PDF files are downloaded, not previewed inside Syrel.

**Publishing.** The gate a workflow passes before it becomes a frozen version you can run and schedule, including a real test run graded by an independent judge.

## People and access

**Organisation.** The boundary for all data. Members of one organisation cannot read another's.

**Expert.** An installable bundle of skills, knowledge and connections for one job. It adds to a chat; it never removes a tool.

**Connection.** A link to an outside service, such as Google Workspace, Slack or an MCP server.

**Tool grant.** Whether each tool on a connection is allowed, held for your approval (Ask), or denied.

**Operator.** A person who runs the whole Syrel deployment from the Control Room.
