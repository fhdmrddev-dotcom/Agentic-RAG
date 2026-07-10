---
seed_id: SEED-110
title: Run-time template / file upload as a workflow run input — a place to hand a template (e.g. a docx to fill) to a workflow run
status: open
planted: 2026-07-10
phase_origin: "Operator, during Phase 143 (Starter Workflow Library) discuss-phase: flagged that some workflows need to upload a template (e.g. a docx to fill) but there is no place to do so — the Run modal is only a kickoff textarea + a read-only KB chip. Operator + Claude agreed this is a separate, threat-modeled run-input surface, too big to fold into 143's 'one shelf section' red line; elevated to a v3.3 phase candidate rather than a dormant seed."
category: product capability — workflow run input surface, deferred to its own phase (v3.3 candidate)
related_seeds:
  - SEED-104-agent-driven-skill-file-attachment (distinct: 104 attaches files to a SKILL during authoring; THIS is uploading a template as a workflow RUN INPUT)
  - SEED-084-starter-workflow-library (the phase that surfaced this gap)
related_phases:
  - Phase 144 (Agent-Driven Skill File Attachment / FILE-01) — adjacent file-attach surface; cross-check for a shared upload/storage/threat-model pattern
related_memories: [reference_render_template_workflow_only]
priority: medium
---

# SEED-110 — run-time template / file upload as a workflow run input (deferred, v3.3 phase candidate)

## The finding (2026-07-10, Phase 143 discuss-phase)

The Workflows page Run modal (`frontend/src/pages/WorkflowsPage.tsx` → `RunModal`) offers exactly:
a single "What should this run work on?" **kickoff textarea**, a **read-only bound-folder chip**, and
an input-keys **hint line**. There is **no file input**. A workflow whose job is to *fill a
user-supplied template* (e.g. "fill this DOCX", the `render_template` / template-fill class) has
**nowhere for the user to hand over the template** at run time.

`render_template` is workflow-fill-only and whitelist-gated (see `[[reference_render_template_workflow_only]]`);
the "Ephemeral Template Fill (101.1 UAT — uploaded template, no bound asset)" definition exists in
the DB, but the *upload affordance* for a run input was never built on the Workflows Run surface.

## Why deferred (not folded into Phase 143)

- It is a **NEW run-input surface**: file upload → storage (bucket/RLS) → a real **threat model**
  (untrusted file, size/type limits, ownership) → wiring the uploaded artifact into the agent's
  `render_template` path. That is comfortably its own phase, and folding it would blow Phase 143's
  explicit red line ("no new runtime — one shelf section + content authoring").
- It needs its own **SC#10 cross-provider proof** (a run input that reaches the agent loop).
- **It does NOT block Phase 143**: the 3 starters shipped there (Risk Register, Weekly Status Report,
  Compliance Gap Report) are all **KB→document** — they read the bound knowledge base and produce a
  doc; none asks the user to upload a template.

## Re-open trigger

Fire when **either**:
1. A **template-fill starter or skill ships** (or is requested) that needs a user-supplied template at
   run time — the moment the "fill this document" use case becomes real, this is the missing piece, OR
2. Users ask to **hand a file/template to a workflow run** (a recurring "where do I upload my template?"
   signal).

**MUST be surfaced at the `/gsd:new-milestone` v3.3 sweep** as a concrete phase candidate — do not let
it rot as a dormant seed.

## Implementation sketch (when promoted)

- A file-upload control in the Run modal (or a run-input step) → upload to a Storage bucket with
  owner-scoped RLS + size/MIME allowlist.
- Persist the uploaded artifact reference on the run inputs so the agent loop can resolve it into the
  `render_template` / template-fill path (reuse the existing whitelist-gated fill engine — no new
  runtime for the FILL, only for the INPUT).
- Cross-check Phase 144's file-attach storage/threat-model pattern for reuse (adjacent, not identical).

## Related
- Phase 143 CONTEXT `<deferred>` (this is the named landing).
- `[[reference_render_template_workflow_only]]` — `render_template` is fill-only, whitelist-gated.
- SEED-104 / Phase 144 — the skill-file-attach surface (distinct concern, shared upload pattern).
