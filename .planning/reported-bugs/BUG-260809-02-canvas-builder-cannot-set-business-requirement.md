---
id: BUG-260809-02
title: A workflow built on the canvas can never be published — no UI anywhere sets `business_requirement`
reported: 2026-08-09
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [workflows/canvas-builder, workflows/publish-gauntlet, frontend/workflow-authoring]
folded_into: quick-260809-klo
verified_closed_by: live-uat-2026-08-10-local-chrome-devtools-mcp
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

~~⚠ **Status remains `open`, deliberately.**~~ **The owed row was driven 2026-08-10 — see
§"Owed UAT row driven" below. Status is now `closed`.**

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

## Owed UAT row driven 2026-08-10 — PASS, and the bug is closed

Driven against **local** (`http://localhost:5173`, backend `:8000` reporting
`{"status":"ok","redis":"ok","maintenance":false}`) through the chrome-devtools MCP server, as one
continuous session in the real UI. `visual_workflow_canvas` was confirmed
`audience: everyone` in `app_settings.feature_visibility` first, so the `canvasEnabled` gate on the
control was actually open rather than assumed.

**Target draft `a0ed8ee9-103e-4be4-a9dc-6e2370f762e8`** — *"Read-only refusal (098 UAT — D-13
whitelist)"* v2, 1 phase (`llm_agent`), `business_requirement: null`. Chosen deliberately as the
simplest shape on the board so that no unrelated gauntlet stage could muddy the verdict.

| # | Step | Observed |
|---|---|---|
| 0 | Pre-state in the Builder | Publish button **`disabled`**, `description="a workflow must declare exactly one business_requirement before publish"`. The draft card read *"draft · purpose not declared yet"*. This is the reported bug, reproduced live. |
| 1 | The control exists | `input[aria-label="Business requirement — the one line this workflow must satisfy"]`, placeholder *"What must this workflow deliver? · required to publish"*, empty, visible. |
| 2 | Type the sentence | `PATCH /workflows/a0ed8ee9-…` → **200**, then `POST /workflows/validate` → **200**. Header flipped to *"Saved · just now"*; Publish became **enabled** and the blocked reason cleared. |
| 3 | DB after the PATCH | `business_requirement` persisted verbatim, **and `phases` still length 1** — the full-definition PATCH did not truncate. |
| 4 | **Hard reload** (cache-ignoring) | The sentence survives. Draft card now renders the requirement **instead of** *"purpose not declared yet"*; re-opening the Builder shows the input repopulated; Publish still enabled. **This is the half the executor's unit tests could not prove.** |
| 5 | Canvas view | Same input, same value, present in **both** `≣Spine` and `⬡Canvas` — the fix's both-views claim holds by observation, not by reading the gate expression. |
| 6 | Publish gauntlet | Ran for real (golden run against the KB + independent judge). `POST /workflows/{id}/publish` → **200**, body `{"published":true,"version":2,"golden_run_id":"bcb58ff0-0487-4077-8e68-c8aa9197d859","blocked_stage":null,"named_failures":[]}`. **`blocked_stage: null`** — stage 1 no longer returns the `business_requirement` verdict. Row is `published` in `workflow_definitions`. |

**⚠ One honest limitation, recorded rather than buried.** The Claude-in-Chrome extension (which
drives literal OS keystrokes) was not connected, so the sentence was entered by dispatching a
React-native `input` event from the page after setting the value through
`HTMLInputElement.prototype.value`'s native setter. The chrome-devtools `fill` tool was tried
FIRST and is recorded here because its failure is informative: it set the DOM value but produced
**no** `PATCH` and **no** re-`validate`, and Publish stayed disabled — React's `onChange` never
fired. That is the standard CDP-sets-`.value`-directly artifact and **not** app behaviour, but it
is an inference about the harness, not a measurement of it. What the driven row therefore proves is
the `onChange → builderStore → debounced PATCH → reload → publish` path — the same path keystrokes
take. What it does **not** exercise is the keypress layer itself (per-character debounce, IME,
paste). If a future defect is reported at that layer, this row is not evidence against it.

Two notes for whoever reads this next:
- `definition` is stored as a **JSON string scalar**, so `definition->>'business_requirement'` and
  `definition->'phases'` both silently mislead — an initial sweep read every draft as `phases=0`,
  which was false (the target has 1, another has 4). Parse the column in the client. Same trap
  already recorded for `phase_type`.
- The three `D-klo-DEF-*` deferrals are untouched by this row and remain open on their own triggers
  — in particular `D-klo-DEF-01` (the blocking copy still names the internal field name) and
  `D-klo-DEF-03` (the two ~1-in-6 flaky tests).

## Routing note

Belongs to the canvas-authoring surface (v3.6). Candidate for the next milestone or a `/gsd:quick`
if scoped to the input + the copy. **Related to the CONN-02 pattern recorded at v3.6 close** — both
are cases where a shipped surface cannot reach a field the backend requires, found only by driving
the product rather than by any gate. Worth asking during the fix whether other definition-level
fields (`project_folder_id`, `inputs`, `assets`, `category`) are similarly unreachable from the
canvas.
