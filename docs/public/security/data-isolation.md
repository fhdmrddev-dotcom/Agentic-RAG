---
title: How your data is isolated
slug: security/data-isolation
section: security
audience: user
status: written
release: shipped
covers: [H42]
summary: >-
  Each organisation's data is kept apart by the database itself. Inside an organisation your work
  is private unless you share it, and only built-in platform content is visible to everyone.
video: explainer.security
reviewed: 2026-10-04
---

Syrel keeps organisations apart at the database, not only in the app. This page explains what that means and what is shared on purpose.

## The organisation is the boundary

Every row of user data — documents, folders, chats, skills, workflows, connections — belongs to an organisation. Row-level security in the database lets a signed-in person read only rows their membership allows. Most API requests talk to the database **as the signed-in person**, using their own credentials, so a missing filter in application code does not turn into a leak: the database still refuses the rows. Where the server has to use its own service credentials — background work such as ingestion and schedules, and a few reads such as workflow definitions — it limits each query to the caller in code.

Search follows the same rule. Document search, keyword search and skill matching return only content the person asking may see, including folder-level sharing.

## Private, shared, built in

| Scope | Who can read it |
|---|---|
| Private | Only its owner. Everything starts here. |
| Shared with your organisation | Every member of that organisation. You choose this per folder (and its documents) and per skill. |
| Built in | Every organisation. Reserved for platform content shipped with Syrel, such as the skill-creator skill and starter workflows. Users cannot mark their own content as built in. |

Workflows are visible only to the person who built them, plus the built-in starters.

## Things that are copied, not shared

- **Experts.** Installing an Expert copies its sample documents into your organisation and indexes them there. Your copy is yours; another organisation installing the same Expert gets its own.
- **Connected sources.** Everything a connection brings into the Library gets the single visibility set on that connection, enforced by the database and shown on screen. Each document records which connection placed it.

## What people can and cannot discover

- When you ask for something that belongs to another organisation, or to another person, the API answers **404 Not Found** rather than "forbidden", so the response does not reveal that it exists.
- Platform operators run the deployment from the Control Room. Their endpoints answer 404 to everyone else.

## What this does not cover

- Departments exist in the data model but nothing reads them yet, so there is no department-level access today.
- The code sandbox runs on the same host as the deployment; see [Sandbox isolation](/docs/security/sandbox-isolation) for why it suits single-tenant installs only.
- Per-organisation retention and legal hold are not available today.

## Related

- [Organisations and what is shared](/docs/get-started/workspaces-and-orgs)
- [Organisations and row-level security](/docs/api/concepts/orgs-and-rls) (for developers)
- [Audit trails](/docs/security/audit-trails)
