---
id: BUG-261021-02
title: For a two-org account, creating a folder or a workflow ignores the chosen org (X-Org-Id), while creating a thread honours it
reported: 2026-10-21
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/folders, backend/workflows, backend/org-scoping]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 128266ef6
  date: 2026-10-21
---

# BUG-261021-02: Creating a folder or a workflow ignores the chosen org for a two-org account

## What we observed

Seen by the Phase 295 gap round 1 live re-drive on 2026-10-21 (`295-VALIDATION.md`, section "Gap round 1 re-drive", the observation under "New defects"). The account was `fhdmrd.dev@gmail.com`, which belongs to two orgs (`22f9c615` and `c1f18150`).

- `POST /threads` sent with `X-Org-Id: 22f9c615` created a thread in org `22f9c615`. The header was honoured.
- `POST /folders` sent with the same header created the folder in org `c1f18150`, the account's own org. The header was ignored.
- `POST /workflows` sent with the same header created the definition in org `c1f18150` too. The header was ignored.

Expected: all three create the row in the org the person chose (the validated `X-Org-Id`), as `POST /threads` does.

The re-drive had to move its test folder (`c8ce1ab5`) and definition (`2398e6f3`) into org `22f9c615` with a direct database update to set up the WR-06 check. That is listed in the same section.

## Why it matters

A person who works in two orgs and picks org A in the app can create a folder or a workflow that silently lands in org B. Org A's colleagues then cannot see it, and org B's members can. Nothing on screen says which org it went to. This is a tenancy mistake, not a cosmetic one. It also makes the org-scoping fixes of 295-09 and 295-10 (folders offered to a run are narrowed to the run's org) harder to rely on, because the folder's org may not be the one the person meant.

## Hypothesized cause

**Hypothesis, not verified.** `create_thread` in `backend/app/api/threads.py` (around line 819) calls `resolve_active_org_or_none` and stamps the validated active org on the insert. Its own comment says the alternative, the migration-106 trigger's `LIMIT 1` guess, "is the wrong org for a two-org user". The folder and workflow create routes (`backend/app/api/folders.py`, `backend/app/api/workflows.py` or the authoring service they call) may not stamp `org_id`, so the same trigger fills it with its `LIMIT 1` pick. Not read in detail for this report.

## Surface classification

`Agentic-RAG`: this app's own create routes and org resolution.

## Suggested routing

- **Fold into in-flight phase:** n/a. Phase 295 is in its last allowed gap round and adds no new capability; this is outside its files.
- **Defer to future phase / milestone:** the next phase that touches org scoping or the folder/workflow create routes.
- **Plant as seed:** not needed if routed to a phase.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

Switching the app to the right org does not help, because the server appears not to read that choice on these two routes. Today the only workaround is a direct database update of `org_id`, which is an operator action.

## Reference / evidence links

- `.planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md`, section "Gap round 1 re-drive (2026-10-21)", the observation below "New defects", and "Plants, cleanup and the id-snapshot diff".
- `backend/app/api/threads.py` `create_thread` (the route that honours the header).
