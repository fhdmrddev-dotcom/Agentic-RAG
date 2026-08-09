---
seed_id: SEED-110
title: Run-time template / file upload as a workflow run input — a place to hand a template (e.g. a docx to fill) to a workflow run
status: closed
closed: 2026-07-31
closed_by: "SHIPPED as v3.3 WFIN-01 in Phase 152 (Workflow Run Inputs), completed 2026-07-15 — this seed's own re-open trigger #1 fired, was swept into the v3.3 milestone as a requirement exactly as the seed demanded, and the requirement is `[x]`. Evidence: `.planning/milestones/v3.3-REQUIREMENTS.md:25` (WFIN-01 checked) + `:104` (`| WFIN-01 | Phase 152 (CORE) | Workflow & File Inputs | Complete |`); `.planning/milestones/v3.3-ROADMAP.md:72` (Phase 152 completed 2026-07-15). The surface landed in `152-03-PLAN.md` — RunModal quiet template upload. Code-verified at HEAD 2026-07-31: `backend/app/api/workspace.py:281` stamps the upload `kind='template_input'` (untrusted provenance, 422 on bad MIME/size at the route), and `backend/app/services/template_asset_service.py:197-248` resolves it back on the thread+user-scoped Branch 2 with `provenance='template_input'`. Closed as SHIPPED — do NOT re-plant."
planted: 2026-07-10
phase_origin: "Operator, during Phase 143 (Starter Workflow Library) discuss-phase: flagged that some workflows need to upload a template (e.g. a docx to fill) but there is no place to do so — the Run modal is only a kickoff textarea + a read-only KB chip. Operator + Claude agreed this is a separate, threat-modeled run-input surface, too big to fold into 143's 'one shelf section' red line; elevated to a v3.3 phase candidate rather than a dormant seed."
folded_into: 152
category: product capability — workflow run input surface, deferred to its own phase (v3.3 candidate). SHIPPED as WFIN-01 / Phase 152; closed 2026-07-31.
related_seeds:
  - SEED-104-agent-driven-skill-file-attachment (distinct: 104 attaches files to a SKILL during authoring; THIS is uploading a template as a workflow RUN INPUT)
  - SEED-084-starter-workflow-library (the phase that surfaced this gap)
related_phases:
  - Phase 144 (Agent-Driven Skill File Attachment / FILE-01) — adjacent file-attach surface; cross-check for a shared upload/storage/threat-model pattern
related_memories: [reference_render_template_workflow_only]
priority: medium
---

# SEED-110 — run-time template / file upload as a workflow run input (SHIPPED — closed 2026-07-31)

## CLOSED 2026-07-31 — this shipped as WFIN-01 in Phase 152. Do not re-plant.

**Everything below this section is the 2026-07-10 finding, preserved as history. The gap it
describes no longer exists.** This seed worked exactly as designed: its re-open trigger #1
demanded a `/gsd:new-milestone` sweep, the sweep happened, and the seed became a v3.3
requirement instead of rotting.

**The record:**

| Claim | Evidence |
|---|---|
| WFIN-01 is a shipped v3.3 requirement | `.planning/milestones/v3.3-REQUIREMENTS.md:25` — `[x] **WFIN-01**: User can upload a file (e.g. a docx template to fill) as a workflow run input from the Run modal` |
| It shipped in Phase 152 | `.planning/milestones/v3.3-REQUIREMENTS.md:104` — `| WFIN-01 | Phase 152 (CORE) | Workflow & File Inputs | Complete |` |
| Phase 152 completed 2026-07-15 | `.planning/milestones/v3.3-ROADMAP.md:72` |
| The Run-modal upload control itself | `152-03-PLAN.md` — "WFIN-01/02 frontend: RunModal inline scope `<select>` + quiet template upload + provenance note + doRun createThread→upload→send sequencing" |

**Code-verified at HEAD on 2026-07-31** (not taken on the roadmap's word):

- `backend/app/api/workspace.py:281` stamps the uploaded file `kind="template_input"` — the
  untrusted-upload provenance the seed's threat-model concern asked for; the route 422s bad
  MIME/size before storage (`workspace.py:241`).
- `backend/app/services/template_asset_service.py:197-248` resolves that upload back on
  **Branch 2**, scoped `AND kind = 'template_input'` by thread + user, returning
  `provenance="template_input"`.

**How the shipped design differs from this seed's implementation sketch** — worth recording so
nobody "finishes" the sketch against shipped code:

- The sketch proposed an **owner-scoped Storage bucket with RLS**. What shipped reuses the
  existing `workspace_files` table + bucket with a **provenance stamp plus a TTL expiry**
  (`backend/app/models/user_settings.py:253` — hours a `kind='template_input'` file lives before
  the gated read path stops honouring it). Same containment goal, cheaper mechanism.
- The sketch said "wire the uploaded artifact into the agent's `render_template` path". The
  shipped rule is **stricter**: a `template_input` file is *never routed to the Jinja engine*
  (the WFIN-01 requirement text says so verbatim). Untrusted bytes are a fill **source**, not a
  fill **program** — the SSTI distinction the phase's threat model drew.

**Honest partial**: Phase 152's SC#10 cross-provider proof came in at **8/9**, with the
OpenRouter axis blocked by BUG-260714-02 and **operator-accepted**
(`.planning/milestones/v3.3-REQUIREMENTS.md:105`, recorded against WFIN-02). This seed's "needs
its own SC#10 cross-provider proof" is therefore satisfied on the three native providers and
accepted-with-a-known-gap on OpenRouter. That gap belongs to BUG-260714-02, **not** to this
seed — it is not a reason to keep this one open.

**Not to be confused with SEED-130.** SEED-130 is the *author-time* `template_placeholders`
dead path in `GET /workflows/grounding-bundle`, which is still open. Run-time template
**upload** (this seed) shipped; author-time template **placeholder discovery** (SEED-130) did
not. SEED-130's fifth re-open trigger names this seed — that trigger has now fired in the sense
that the run-time surface exists, so whoever fixes SEED-130 must make the two agree on how a
template is identified. See SEED-130's own note dated 2026-07-31.

---

## The finding (2026-07-10, Phase 143 discuss-phase) — HISTORICAL

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

## Re-open trigger — FIRED AND SATISFIED (do not re-fire)

> **2026-07-31:** Trigger #1 fired during the v3.3 milestone sweep and was honoured — the seed
> became requirement WFIN-01 and shipped in Phase 152 on 2026-07-15. The "MUST be surfaced at
> the `/gsd:new-milestone` v3.3 sweep" instruction below is **discharged**; it is not a standing
> obligation for v3.6 or any later sweep. The triggers are preserved verbatim as the record of
> why this seed worked.

Fire when **either**:
1. A **template-fill starter or skill ships** (or is requested) that needs a user-supplied template at
   run time — the moment the "fill this document" use case becomes real, this is the missing piece, OR
2. Users ask to **hand a file/template to a workflow run** (a recurring "where do I upload my template?"
   signal).

**MUST be surfaced at the `/gsd:new-milestone` v3.3 sweep** as a concrete phase candidate — do not let
it rot as a dormant seed.

## Implementation sketch (when promoted) — SUPERSEDED BY WHAT SHIPPED

> **2026-07-31:** kept for provenance only. Where this sketch and Phase 152's shipped design
> disagree, **the shipped design wins** — see the differences table in the CLOSED section above
> (provenance-stamp + TTL rather than a new RLS bucket; and `template_input` bytes are
> deliberately NEVER handed to the Jinja engine, which is stricter than this sketch's wording).

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
