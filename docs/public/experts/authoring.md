---
title: Authoring and installing Experts
slug: experts/authoring
section: experts
audience: admin
status: written
release: shipped
covers: [A40]
summary: >-
  Org admins create, edit, disable and delete Experts in the org admin area, draft them with AI
  from uploaded files, grant access per person or role, and install Experts for the organisation.
video: clip.experts-authoring
reviewed: 2026-10-04
---

Experts are managed by organisation admins. Open the org admin area from the shield in the rail and choose **Experts** to reach the authoring studio. Who may author Experts is itself a setting, so your organisation can widen or narrow it.

## The authoring studio

An Expert is built from these parts:

| Section | What you set |
|---|---|
| Identity | Name, description, icon and when to use it. |
| Knowledge scope | The folders it answers from and its folder rule — **biased** (the chat's folder plus these) or **restricted** (only these). |
| Bound capabilities | The skills it brings and the connections it needs. |
| Action tiles | The one-click starter prompts people see. |
| Access grants | Who may use it — specific people or roles. |

You can disable an Expert without deleting it, and delete one you no longer need.

## Drafting with AI

You can start an Expert by uploading files and letting Syrel draft it. The draft proposes the skills the Expert will need. When a skill does not exist yet, the studio proposes it as a new skill, and a person approves each one before it is created. Saving refuses a skill name that does not exist, so an Expert cannot point at a skill that is not there.

A skill created for an Expert loads for every member of the organisation, not just its author.

## Installing an Expert

An Expert answers from documents, and those documents have to be in your organisation. Installing is explicit:

1. In the Experts catalog, choose to install the Expert. You need the permission to manage Experts.
2. Syrel copies the Expert's sample documents into your organisation's Library and indexes them there. The card reads **Installing…** until they are ready.
3. When indexing finishes, the Expert can join chats and answer from your organisation's copy.

Installing again creates no duplicates. If an install fails, the card says so and an org admin can retry it. Another organisation can never read your organisation's copy.

## What an Expert cannot do

- It cannot remove a tool from a chat — Experts only add.
- It cannot read documents the person using it cannot see.
- It cannot change what a chat used in earlier turns; a swap takes effect from the next turn and is recorded in the chat.

## Related

- [What an Expert is](/docs/experts/what-are-experts)
- [Spend](/docs/administer/control-room/spend) — operators can see token and dollar totals per Expert.
