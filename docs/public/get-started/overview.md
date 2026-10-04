---
title: What Syrel is
slug: get-started/overview
section: get-started
audience: user
status: written
release: shipped
covers: [A5, A11, A21, A32, B14]
summary: >-
  Syrel is an AI agent that answers from your own documents with citations, runs code in a sealed
  sandbox, learns skills that persist, and runs checked, multi-step workflows that produce real files.
video: explainer.get-started
reviewed: 2026-10-04
---

Syrel is a chat-first AI agent for your organisation's knowledge. You put documents in its Library, ask questions in plain language, and get answers that cite the exact passages they came from. When a question needs more than a search, Syrel can run code, write files, ask you for a decision, and follow a workflow your team has published.

## What you can do with it

- **Ask your documents.** Syrel searches, reads and compares the documents you can see, and marks every claim it takes from them with a numbered citation you can open.
- **Keep a Library.** Folders, saved views, document details with confidence on each field, links between documents, and version history.
- **Run code and make files.** When your operator has switched the sandbox on, Syrel runs Python in an isolated container and hands back charts, spreadsheets, Word documents and PDFs.
- **Teach it skills.** A skill is a set of instructions (and optional files) that Syrel loads when a request matches it. Syrel can write one for you from a conversation.
- **Run workflows.** A workflow is a fixed sequence of steps with checks between them. Syrel runs the steps in order, and a step that fails its checks cannot quietly pass.
- **Bring in an Expert.** An Expert is an installable bundle of skills, knowledge and connections for one job, such as reviewing contracts.
- **Connect your services.** Google Workspace, Slack, Jira, email and any MCP server, with each tool allowed, held for approval, or denied.

Word and PDF files are downloaded, not previewed inside Syrel.

## How it keeps answers honest

- Answers grounded in your documents carry a confidence badge (High, Medium or Low), and a claim without a citation reads as general knowledge.
- Syrel only searches documents you are allowed to see. Your organisation's data is isolated from every other organisation's by the database itself. See [How your data is isolated](/docs/security/data-isolation).
- A workflow step that reads your knowledge base must cite what it found, or the step fails.
- Actions that reach outside Syrel (sending email, posting a message, creating a ticket) stop for approval, and real sending is off until an operator switches it on.

## Who these docs are for

| You are | Start with |
|---|---|
| New to Syrel | [Your first answer in five minutes](/docs/get-started/quickstart) |
| Building workflows | [What a workflow is](/docs/automate/workflows/overview) |
| An organisation admin | [Organisations and what is shared](/docs/get-started/workspaces-and-orgs) |
| Evaluating security | [How your data is isolated](/docs/security/data-isolation) |
| A developer | [Authentication](/docs/api/concepts/authentication) |

## What is not here yet

These docs describe Syrel as released (v4.4). Pages marked **Not yet released** describe v4.5, which is still being built. Pages marked **Full guide coming** are short summaries of features that ship today. Third-party API access (API keys, webhooks, rate limits) is not part of Syrel yet. Not available today. [See what's planned](/docs/api/roadmap-open-platform).
