---
id: BUG-260809-02
title: A workflow built on the canvas can never be published — no UI anywhere sets `business_requirement`
reported: 2026-08-09
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [workflows/canvas-builder, workflows/publish-gauntlet, frontend/workflow-authoring]
folded_into: quick-260809-klo
verified_closed_by: null
related_seeds: [SEED-123]
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 5d5ea200
  date: 2026-08-09
---

# BUG-260809-02: The canvas builder has no way to declare `business_requirement`, so a from-scratch workflow is unpublishable

## What we observed

Operator report, 2026-08-09, on live cloud (`https://superrag.cloud`) minutes after the v3.4+v3.5+v3.6
deploy. Building a workflow **from scratch on the canvas**, the operator hit a blocking publish
message they could not act on:

> **Not finished yet** — *a workflow must declare exactly one business_requirement before publish*

The message names a field but the UI offers nowhere to enter it. Verbatim source:
`backend/app/services/harness/publish_service.py:167` (publish gauntlet stage 1) and
`backend/app/api/workflows.py:718` (the `/validate` seam).

**Measured against live cloud, not inferred:**

- The affected draft was `6acc280f-9dcf-4c90-a3c5-bbb5708426eb` — *"DMT Project Risk Identification
  & Analysis Report"*, 3 phases, `business_requirement: null`.
- `GET /workflows/drafts` showed 8 drafts. **Every one that HAD a requirement was either a seeded
  starter** (5 × "Compliance Gap Report", 1 × "Risk Register" — text identical to
  `supabase/migrations/094_starter_workflows.sql`) **or NL-generated** (*"Systematic Literature
  Review from KB Research"*, whose text matches no template). **The only draft with `null` was the
  one hand-built on the canvas.**

## Why it matters

**Severity `blocking`:** the canvas is v3.6's headline deliverable — *"a third, most-approachable
authoring door"* — and a workflow authored through it **cannot reach publish by any in-app route**.
The user is not warned at authoring time; they discover it only at the publish gate, after doing all
the work. The message names an internal field name (`business_requirement`) rather than saying what
to do, so there is no recovery path from inside the product.

The two workarounds both cost the user their work or their intent:
1. **Start from a starter template** — but the operator's starters are test data, and forking one to
   get a field is not authoring.
2. **Re-describe the workflow in natural language** — the generator supplies the field, but that
   discards the canvas work.

## Hypothesized cause

**This is a genuine hole, and the shape of it is narrower than first assumed — the first reading was
corrected on measurement:**

- **First (wrong) reading:** *"nothing in the app ever writes `business_requirement`."* A grep for
  an assignment (`business_requirement\s*=`) across `backend/app/` returns only two read-sites in
  `publish_service.py:969` / `validator_kinds.py:523,554`, and `workflow_authoring.py` has **zero**
  occurrences — which looked conclusive.
- **Falsified by the data:** the *"Systematic Literature Review from KB Research"* draft carries a
  requirement matching no seeded starter. **No code assigns it — the LLM emits it.** It is a declared
  field on `WorkflowDefinition` (`harness.py:538`), the NL generator returns a whole
  `WorkflowDefinition`, and the response schema is the `extra="forbid"` union — so the model fills
  the field as part of normal generation. A grep for an assignment could never have found that.
- **The actual defect:** `business_requirement` is reachable from the **NL door** (model-emitted) and
  the **template door** (seeded), and **unreachable from the CANVAS door**. A frontend sweep for any
  editable control — `grep -rn "business_requirement" frontend/src` filtered to
  `value=|onChange|update|patch|input` — returns **nothing**. It appears in the frontend only as a
  read: `PublishGauntlet.tsx:172` (the "Goal" stage label), `WorkflowSoul.tsx:22` (XSS note), and
  `definitionOps.ts:903` (reading it off a forked starter).

So the canvas is the one authoring door of three that cannot populate a publish-required field.

## Surface classification

**`Agentic-RAG`** — this app, and squarely inside v3.6's own scope.

## Fix sketch (not a decision)

The obvious shape is a single text input on the canvas Builder bound to
`definition.business_requirement`, alongside name/slug — the panel already round-trips every other
definition-level field through `builderStore` (`builderStore.ts:184` explicitly describes "the
working definition MINUS `phases` — slug, version, business_requirement, …", so the store already
carries it; only the control is missing). Worth pairing with a copy fix: the blocking message should
say *what to do* rather than name a field.

⚠ **A UI-only fix is not obviously sufficient** — check whether the message can also be reached from
the NL door when the model omits the field, in which case the same input serves both.

## Workaround applied 2026-08-09 (operator-approved)

The stuck draft was unblocked by `PATCH /workflows/6acc280f-…` sending the **complete existing
definition** back with the one field added (the endpoint takes a full `WorkflowDefinition` with
`phases` required, so a partial patch cannot silently truncate). Verified after: 3 phases unchanged,
`POST /workflows/validate` → **200 with 0 findings**. This is a per-draft rescue, not a fix.

## Fix landed 2026-08-09 — quick task `260809-klo` (status stays `open`)

A `business_requirement` text input now ships on the Builder header's identity group, gated on
`canvasEnabled` and rendered in both the Spine and Canvas views:
`WorkflowBuilderPage.tsx:1849` (the control) → `:1899` (the render site) →
`builderStore.ts:596` (`setBusinessRequirement`, which writes `meta` and arms `dirty` in one
`set()`). No write-path change was needed — `selectDefinition` is `{ ...meta, phases }`
(`builderStore.ts:293`) and `useDraftPersistence.ts:619` PATCHes exactly that, so the full-definition
requirement is satisfied by construction. Commits `da668c96`, `1c58a3fb`. Diff: 4 files,
410 insertions, **0 deletions**. `tsc -p tsconfig.app.json` unmoved at 33; the scoped 4-suite vitest
went 242 → 253 passing (+11 = exactly the tests added), 0 failing across 4 consecutive runs.

⚠ **Status remains `open`, deliberately.** The tests prove the typed sentence reaches the recorded
`updateWorkflowDraft` argument. They do **not** prove the live gauntlet accepts it — the reload +
publish row was not driven (no browser automation in the executor session). Flip to `closed` only
after that row runs against a real draft.

**Two corrections to this report, on measurement:**
- The report's own §"Fix sketch" guessed placement *"alongside name/slug"*. There is no name/slug
  input on that surface; the shipped placement is the identity group beside the KB affordance,
  which is the seam D-186-15 already used for the identical bug shape.
- `WorkflowCanvas.composition.test.tsx:83`'s `missing_business_requirement` is an invented fixture
  string the backend never emits. The real verdict code is `business_requirement`
  (`workflows.py:712-721`), and the authoring-time warning **already shipped end to end** through
  `verdictModel.ts:268` → `ProblemsTray`. Only the input was missing.

**Deferred, with triggers** (`260809-klo-deferred-items.md`):
`D-klo-DEF-01` the blocking copy — it is authored backend-side at `workflows.py:718` /
`publish_service.py:166-168`, and `blockedReason` relays it verbatim by design (D-182-06 forbids a
client-side message map), so it is not a frontend one-liner.
`D-klo-DEF-02` reachability of `inputs` / `assets` / `category` — unmeasured, re-derive don't inherit
(`project_folder_id` **is** reachable).
`D-klo-DEF-03` two shipped tests flake ~1-in-6 on a 1 s `waitFor`; pre-existing rate could not be
excluded, and no pinned test was edited to manufacture green.

## Routing note

Belongs to the canvas-authoring surface (v3.6). Candidate for the next milestone or a `/gsd:quick`
if scoped to the input + the copy. **Related to the CONN-02 pattern recorded at v3.6 close** — both
are cases where a shipped surface cannot reach a field the backend requires, found only by driving
the product rather than by any gate. Worth asking during the fix whether other definition-level
fields (`project_folder_id`, `inputs`, `assets`, `category`) are similarly unreachable from the
canvas.
