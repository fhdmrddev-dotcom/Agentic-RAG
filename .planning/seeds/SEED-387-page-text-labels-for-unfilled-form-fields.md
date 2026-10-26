---
seed_id: SEED-387
title: A fillable-PDF field that no declared input fills shows its raw AcroForm name in the step panel (needs page-text labels from the backend)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names the template placeholders route or describe_files.py's AcroForm label reader, or a G-4/UAT row shows a raw name like topmostSubform[0].Page1[0].f1_01[0] in "What this form asks for".
trigger_paths: ["backend/app/services/describe_files.py", "backend/app/api/workflow_authoring_doors.py", "frontend/src/components/workflows/TemplateAttachSection.tsx"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: ["296-INVENTORY 291-S3-F2 (page-text half)", "296-07-SUMMARY 'Not done or partial'", "296-03 c496244c3 (page-text label filter in describe_files)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-387: Page-text labels for unfilled form fields

## The finding

296-07 fixed 291-S3-F2 for every field a declared input fills: the row reads the input's label, not
`topmostSubform[0].Page1[0].f1_01[0]`. A field NO declared input fills still shows its raw name,
because the placeholders route returns names only; a page-text label (which 296-03 now derives far
better in `describe_files`) never reaches that panel.

## Why it matters

Authors see a machine name for a handful of fields on real government forms (the W-9 has 23).

## When to surface

A change to the placeholders route or the AcroForm label reader, or a UAT row showing a raw name.

## Scope estimate

Small to medium: return `{key, label}` from the placeholders route using the same page-text reader,
and render the label when no input covers the field.

## Breadcrumbs

- 296-07-SUMMARY, Not done or partial, first bullet.
