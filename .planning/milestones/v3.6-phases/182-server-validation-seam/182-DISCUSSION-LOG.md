# Phase 182: Server Validation Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 182-server-validation-seam
**Areas discussed:** Server palette endpoint, Check breadth, Draft-in-progress feel (severity), Retire 181 canary

---

## Server palette endpoint (Palette)

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling GET endpoint (Recommended) | Ship a cacheable `GET /workflows/grounding-bundle` this phase; 184's node-config dropdowns are server-fed from day one (Pitfall 1 anti-drift). Reuses `_assemble_grounding`. | ✓ |
| Defer to 184 | 182 ships only `POST /validate`; validate uses the palette internally, the dropdown-feed endpoint is built in 184. | |
| Embed in /validate response | One endpoint returns verdicts + valid lists; wasteful on every edit, not cacheable. | |

**User's choice:** Sibling GET endpoint (Recommended)
**Notes:** Kept separate from `/validate` because `/validate` is called on every canvas edit — a cacheable `GET` is cleaner and de-risks 184.

---

## Check breadth (Breadth)

| Option | Description | Selected |
|--------|-------------|----------|
| Full static gauntlet (Recommended) | Report all four static blockers (lint + grounding-fidelity + business-requirement + interactive-phase), each categorized; canvas previews EVERY pre-run publish blocker. Golden-run + judge stay live-only. | ✓ |
| ROADMAP-literal (lint + grounding) | Only the two SC#1-named checks; business-req/interactive surface at publish time. | |
| Lint + grounding + business-req | Add the business-requirement gate but skip interactive-phase detection. | |

**User's choice:** Full static gauntlet (Recommended)
**Notes:** Maximizes the seam's whole point — "the canvas can never drift from the publish gauntlet." Underlying check functions reused verbatim (no client-side re-implementation).

---

## Draft-in-progress feel / severity (Severity)

| Option | Description | Selected |
|--------|-------------|----------|
| Add severity/category (Recommended) | Verdict = `{ code, phase, message, severity }` (error \| incomplete); underlying lint/grounding stay verbatim, the route classifies. Lets 184/185 paint "still building" vs "broken". | ✓ |
| Flat findings list | Return code/phase/message only; 184 infers rendering client-side. | |

**User's choice:** Add severity/category (Recommended)
**Notes:** The route classifies verbatim-check outputs; it does not modify the checks. Exact `code → severity` mapping left to researcher/planner, but the severity field is a required response-contract element.

---

## Retire 181 canary (Canary)

| Option | Description | Selected |
|--------|-------------|----------|
| Retire in 182, repoint test (Recommended) | Remove `/canvas/ping`; point `test_revert_byte_identical`'s 404-when-off assertion at the real `POST /workflows/validate` (SC#3 requires it anyway); kills dead code a phase earlier. | ✓ |
| Leave until 183 | Keep the throwaway canary through 182; retire it when 183 lands the first GET canvas route + nav entry. | |

**User's choice:** Retire in 182, repoint test (Recommended)
**Notes:** 182 SC#3 already requires proving `/validate` 404s-when-off, so the real-route assertion supersedes the canary's purpose.

---

## Claude's Discretion

- Shared-grounding module location (extract `_check_grounding_fidelity` + `_assemble_grounding` — REQUIRED: one shared source; location open).
- Whether to stack `require_visible("workflow_authoring")` on the two routes in addition to `require_canvas`.
- Grounding-fidelity behavior on unbound (`project_folder_id=None`) / partial drafts; empty-`phases` reporting.
- Exact `code → severity` mapping table + envelope field names (`ok` vs `valid`, `verdicts` vs `findings`).
- Request-shape confirmation (raw `WorkflowDefinition` body, `extra="forbid"` → 422).
- Plan/wave decomposition.

## Deferred Ideas

- Node-config dropdowns / side-panel that consume the grounding-bundle → Phase 184.
- Live per-node badge rendering from the verdict (VALID-03) → Phase 184.
- Per-node grounding-MODE verdict (grounded-strict vs open) added to the verdict → Phase 185.
- Golden-run + judge (live half of the publish gauntlet) — stay in publish only, never validate.
