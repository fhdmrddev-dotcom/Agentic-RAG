# Phase 282 Discussion Log

> Audit trail only. Downstream agents read `282-CONTEXT.md`.

**Date:** 2026-10-15
**Mode:** autonomous (`--auto` equivalent). Operator instruction, verbatim: *"please continue this phase
autonomously end to end discuss take best decisions then plan and execute"*. Every choice below was made by
Claude and is marked for operator review at G-4.

## Inputs
- Two read-only scouts, one for the backend client timeouts and one for the ask_user surfaces, at HEAD `6f23afe7d`.
- G-2: sketch `282-one-answer-input` was written, driven in Chrome (1 input in every state, draft survives a
  panel toggle), and registered in `MANIFEST.md`.

## Areas and auto-selected answers

| Area | Options considered | Selected | Why |
|---|---|---|---|
| Where the one input lives | A input follows the open panel · B chat always · C pause opens the panel | **A** | It is sketch 006 C as approved, keeps 244-12 reachability, and needs no mount narrowing |
| Draft sharing | lift into streamsStore · new small store · copy between cards | **new store keyed by tool_call_id** | One home; streamsStore FIRES; copying is the named failure |
| How chat knows the panel shows the card | lift ChatLayout panel state · presence registry | **presence registry** | Leaves `ChatLayout.tsx` (FIRES) untouched |
| Selection a11y | switch to aria-pressed · keep radio + aria-checked + keyboard | **keep radio, complete the pattern** | aria-checked was already shipped (Finding C was measured on the wrong attribute) |
| Timeout delivery | `with_options` · constructor kwarg · per-request kwarg | **constructor** | `with_options` silently drops the LangSmith wrap |
| max_retries | 0 everywhere · SDK default · by provider class | **local 0, cloud 2 explicit (research confirms), Google 1** | Retrying a timeout on a slow GPU triples the wait; cloud transient retries are what the provider docs recommend |
| Ceiling | lower to 600 · keep 3600 made real | **3600 if measured honourable, else the measured bound with the reason** | A stored value the system cannot honour is the defect |
| Eager create on the event loop | ignore · fold conditionally | **fold if measured** (BUG-261015-02) | A longer timeout would otherwise freeze a worker for longer |
| Plan count | 4 (roadmap target) · 3 | **3** | The dead button was already fixed, and a11y fits inside the FIX-07 plan (G-8) |

## Routing
- Folded: BUG-260916-01, BUG-260918-01, SEED-172 #2/#3 (timeout field), BUG-261015-02 (new, conditional).
- Left: SEED-289 → `deferred`, BUG-260718-03 (open), todo "SPIKE — NL→workflow authoring" (keyword-only match).

## Owed to the operator
- Confirm or replace sketch 282 variant A (G-2 acceptance bar).
- Confirm or replace the four G-4 scenarios (D-17).
