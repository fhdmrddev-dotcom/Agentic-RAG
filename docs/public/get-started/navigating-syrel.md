---
title: Finding your way around
slug: get-started/navigating-syrel
section: get-started
audience: user
status: written
release: shipped
covers: [A17, nav:chat, nav:workflows, nav:documents, nav:connections, nav:skills, nav:experts, nav:settings, view:chat, view:documents, view:skills, view:settings, view:workflows, view:connections, view:skill-studio, view:control-room, view:org-admin, view:workflow-run, view:admin-spend, view:experts]
unreleased: [A17]
summary: >-
  The rail on the left takes you to Chat, Workflows, Library, Connections, Skills, Experts and
  Settings; admins and operators see extra entries for their areas.
video: clip.get-started-navigating-syrel
reviewed: 2026-10-04
---

Syrel has one rail of icons down the left side. **New chat** is always at the top. On a phone the rail and the chat list open as a drawer.

## The rail

| Entry | What it opens | Who sees it |
|---|---|---|
| Chat | Your chats, the composer and the answer stream | Everyone |
| Workflows | The workflow library, the builder and the run log | Everyone, unless an operator hides workflow authoring |
| Library | Documents and folders, saved views, ingestion, indexing and health | Everyone |
| Connections | The catalog of outside services and your connections to them | Everyone (only org admins make changes) |
| Skills | Your skills and the skills shared with your organisation | Everyone |
| Experts | The catalog of Experts available to you | Everyone |
| Settings | AI model, search and integration settings, memory and your audit log | People with model management — platform operators by default |

Some entries only appear for certain roles:

- **Org admin** (a shield icon) — for organisation admins. See [Organisations and what is shared](/docs/get-started/workspaces-and-orgs).
- **Control Room** and **Spend** — for platform operators, who run the deployment.

An operator can change who sees Workflows and Settings from the Control Room's feature visibility settings. An entry you cannot see is hidden on purpose, and the server refuses the matching requests too.

## Other places you reach from the rail

- **The chat list.** Chats are grouped by date and can be filtered. Press ⌘K (Ctrl+K on Windows and Linux) to find a chat by name.
- **A workflow run's page.** Opening a run from the Workflows page shows the run's own page: its steps, checks, timings and deliverable. Word and PDF files are downloaded, not previewed inside Syrel.
- **Skill Studio.** Opening a skill's studio from the Skills page shows its evaluations, triggering and versions. It is visible to platform operators by default.
- **Document details.** Selecting a document in the Library opens its detail panel on the right.

## Changes in the next release

In v4.4 the rail also has a **Classification** entry for classification rules. v4.5 removes it and moves the rules into the Library as **Filing rules**; v4.5 has not shipped yet.

## Plain words or technical names

Labels across Syrel use everyday words — a workflow step reads "Write it up" rather than its internal type name. Builders and admins can reveal the technical names where they need them.
