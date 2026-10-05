---
title: What an Expert is
slug: experts/what-are-experts
section: experts
audience: user
status: written
release: shipped
covers: [A32, A33, A40]
summary: >-
  An Expert is a bundle of skills, knowledge folders, connections and starter prompts for one job.
  Inviting it into a chat adds those to the chat; it never takes a tool away.
video: explainer.experts
reviewed: 2026-10-04
---

An Expert packages what Syrel needs to do one kind of work well — reviewing contracts, analysing financial reports, answering HR policy questions — so you do not have to set it up chat by chat.

## What an Expert carries

An Expert is data, not code. It lists:

- **Skills** — the instructions it brings, such as how to review a clause.
- **Knowledge** — the folders of documents it answers from, and how they combine with the chat's own folder.
- **Connections** — the outside services it needs, such as Google Workspace.
- **Starter prompts** — one-click "Try asking…" questions that show what it is for.
- **Who may use it** — access granted per person or per role.

## An Expert adds; it never takes away

When an Expert joins a chat, the chat keeps every tool it already had and gains the Expert's skills and connections. An Expert never removes a tool such as web search or code execution.

Knowledge works through the Expert's folder rule, and Syrel states the effect before the Expert joins:

| Folder rule | What the Expert reads |
|---|---|
| Biased | The chat's folder plus the Expert's own folders. |
| Restricted | Only the Expert's own folders. When you invite a restricted Expert, Syrel first tells you which of the chat's documents it will not read. |

> **Note:** Older release notes say a restricted Expert could take tools away from the chat. That changed in v4.4: an Expert only adds tools, skills and connections, and "restricted" now concerns knowledge folders only.

## One Expert at a time

A chat has one active Expert. Swapping or removing it writes a note in the chat that says what the next turn will and will not use. To ask a different Expert, start a new chat scoped to it; Syrel carries a summary of the first chat across.

## Experts belong to your organisation

An org admin installs an Expert for the organisation. Installing copies the Expert's sample documents into your organisation's Library and indexes them there, so the Expert answers from your organisation's own copy. Installing again creates no duplicates, and no other organisation can read your copy.

Syrel ships five starter Experts: **Financial Analyzer**, **Contract Reviewer**, **HR Policy Advisor**, **Operations Analyst** and **Security & Compliance**. Which Experts your organisation can see depends on its plan.

## Next

- Browse what is available: [The Experts catalog](/docs/experts/catalog)
- Use one in a chat: [Bringing an Expert into a chat](/docs/experts/using-experts)
- Create your own: [Authoring and installing Experts](/docs/experts/authoring)
