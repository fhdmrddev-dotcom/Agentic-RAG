---
title: Organisations and what is shared
slug: get-started/workspaces-and-orgs
section: get-started
audience: user
status: written
release: shipped
covers: [A3]
summary: >-
  Everything in Syrel belongs to an organisation. Your own work is private until you share it with
  your organisation; a small set of built-in content is visible to everyone.
reviewed: 2026-10-04
---

Every Syrel account belongs to at least one organisation, and everything you create — documents, folders, chats, skills, workflows — lives inside one. The database keeps organisations apart: a person in one organisation cannot read another organisation's data, whatever the app asks for.

## Switching organisation

If you belong to more than one organisation, open the profile menu at the bottom of the rail and pick the organisation you want to work in. The menu also holds your name and role badge, the light/dark theme switch and **Sign out**.

Everything you see after switching — Library, chats, workflows, Experts — belongs to the organisation you picked.

## Roles

| Role | What it adds |
|---|---|
| Member | Uses Syrel inside the organisation: chats, Library, workflows, skills, Experts. |
| Org admin | Also opens the org admin area from the shield in the rail: members, invitations and roles, single sign-on, the organisation's audit log, organisation settings and Experts. |

Platform operators are a separate group who run the whole deployment from the Control Room. Most people never need it.

## Private, shared with your organisation, or built in

| Scope | Who sees it | How it gets there |
|---|---|---|
| Private | Only you | Anything you create starts here. |
| Shared with your organisation | Every member of the organisation | You share a folder you own (**Share with org** on the folder) or a skill you own. Documents inside a shared folder are readable by every member. Sharing a skill asks for a passing evaluation first; the owner can share anyway, and that choice is recorded. |
| Built in | Every organisation | Platform content shipped with Syrel, such as the built-in skill-creator and starter workflows. Nobody can mark their own content as built in. |

A few things are organisation-wide by design:

- **Connections** to outside services can be used by members of the organisation; only org admins add or change them.
- **Experts** are installed per organisation: installing copies the Expert's sample documents into that organisation's Library, and no other organisation can read that copy.

> **Note:** Older release notes describe "global" folders and skills visible to every user. That changed in v3.4: sharing is now within your organisation, and only built-in platform content is visible to everyone.

## Your default model

You can pick your own default chat model from the models your organisation allows. If an operator has fixed the model, the picker shows a lock. See [Choosing a model](/docs/use/choosing-a-model).
