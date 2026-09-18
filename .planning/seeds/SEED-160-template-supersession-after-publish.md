---
seed_id: SEED-160
title: What happens when the template changes after the workflow is published — untested
status: open
planted: 2026-08-14
planted_by: Quick task 260814-q5r — scenario enumeration with the operator
surface: Agentic-RAG
severity: medium
affected_areas: [templates, workflow-publishing, versioning, workflow-runs]
requirements: [AUTH-03]
re_open_trigger: >
  The first time a published workflow's template needs replacing (a format change, a rebrand, a
  new reporting period), OR any phase touching `version_policy` / `supersede-by-filename`, OR a
  run failing because its bound template no longer matches its steps. Whichever comes first.
trigger_when: unset
---

# Template supersession after publish — an open question, not a known defect

## The scenario

The Q3 reporting format replaces Q2. The workflow is already published and running weekly. The
template must change; the steps probably must not.

## What is known

- `WorkflowDefinition` carries `version_policy` — the seeded fixtures use
  **`supersede-by-filename`** (measured on `e7c68d09`'s definition), which suggests the intended
  answer is "a new file with the same name supersedes the old one".
- A workflow binds its template in `definition.assets[]` as an `AssetRef`
  `{kind, asset_id, filename, mime}`, where `asset_id` is an immutable Storage path containing a
  `uuid8` — so **replacing a template mints a NEW path**, and the old object is not overwritten.
- The Phase-193 upload door writes the object and **deliberately does not write the definition** —
  the Builder does, keeping one writer on the JSONB and off the Phase-186 `If-Match` token.
- `260814-q5r` proved the Builder's replace path works **on a draft**.

## What is NOT known — the questions this seed exists to force

1. **Can a PUBLISHED workflow's template be replaced at all**, or must it be forked to a new
   version first? (The library's fork verb is *"Make my own copy"*.)
2. **Does the old Storage object get cleaned up**, or does every replacement leak an orphan? (The
   `260814-q5r` UAT created 3 orphans in ~90 seconds and they were removed by hand.)
3. **What does `supersede-by-filename` actually do at run time** — is it enforced anywhere, or is
   it, like `folder_scope` in [[BUG-260814-01]], a declared field nothing reads?
4. **What happens to in-flight runs** that resolved the old template before the swap?
5. **If the new template has DIFFERENT placeholders**, the workflow's retrieval steps are now
   wrong — silently, per [[SEED-157]]. Is there any re-check? (Almost certainly not.)

⚠ **Question 3 is the one to answer first**, and cheaply: `grep` for `version_policy` /
`supersede` in `backend/app/**` and see whether any code path reads it. A field that only the
seeder writes is the same class of defect as `folder_scope` — declared, rendered, and inert.

## Why medium and not high

No customer is hitting this yet (10 of 145 published workflows bind a template, all seeded). But
it becomes **blocking on the first real recurring deliverable**, because formats always change and
a product that requires rebuilding the workflow to change a letterhead will not survive contact.

Related: [[SEED-157]], [[BUG-260814-01]] (declared-but-inert fields are a pattern here, not an
isolated bug).
