---
id: BUG-260827-01
title: A step bound to a service-only connection records "the bound connection is for a different capability" — it is not a different capability, it is NO capability
reported: 2026-08-27
surface: Agentic-RAG
severity: major
status: closed
affected_areas:
  - backend/harness
  - backend/connectors
  - frontend/settings
  - frontend/workflows
folded_into: null
verified_closed_by: /gsd:fast 2026-08-27 (G-3) — arm 2 only; see § Closure
related_seeds: [SEED-207]
re_open_trigger: arm 1 (the UI-reachable KeyError) is NOT closed — re-open when a phase gives a service-only connection a way to be reached (OAuth, Phase 215) or touches the closed-set guard at phase_types.py:~2323
reproduces_on:
  branch: worktree-agent-a89e80cc09e006aa4 (Phase 211, wave 4)
  commit: d9d62b29
  date: 2026-08-27
---

# BUG-260827-01: a service-only connection makes the run say something that is not true

## What we observed

⚠ **This is a CROSS-PLAN SEAM, not any one plan's defect. All three sites below are correct in
isolation; the JOIN ships the defect.** It was found by reading the merged tree at Phase 211's
wave 4, after all four prior plans had landed and been integration-gated.

**Site 1 — `frontend/src/components/settings/ConnectionFormPanel.tsx` (~731 / 744 / 752 / 777),
plan 211-03.** For an unrecognised service the create body is exactly `{name, config,
service_id}`: `capability` is set ONLY for the three known verbs and `mcp_server_url` ONLY for
`mcp`, with no trailing `else`. **A service-only row is creatable.** This is CONN-08 and it is
what the plan was for.

**Site 2 — `frontend/src/components/workflows/ConnectionPicker.tsx` (~478), plan 211-04.** The
read is `listConnectorConnections()` — no capability argument, no client-side shape filter.
**That row is listed and bindable.** This is SC#3 and it is what that plan was for.

**Site 3 — `backend/app/services/harness/phase_types.py:2460`, unchanged since Phase 190.**

```python
if not getattr(connection, "mcp_server_url", None) and getattr(connection, "capability", capability) != capability:
    ...
    return _record("the bound connection is for a different capability")
```

`getattr(connection, "capability", capability)`'s DEFAULT fires only when the attribute is
**MISSING** — never when its value is `None`. For a service-only row the attribute is present
and `None`, so arm 1 is `True`, `None != capability` is `True`, and the step is recorded-and-not-
sent with a sentence claiming a *different* capability.

**Migration 127's `connector_connections_shape_is_not_ambiguous` forbids BOTH shape fields being
set and PERMITS both being NULL — by design (CONN-08).** So the database allows the row on
purpose. Before this phase such a row could neither EXIST (migration 126's
`shape_is_one_of_two`) nor be LISTED (the picker's shape filter). **Both halves are new today.**

### ⚠ Two reachable arms, and they are DIFFERENT failures — measured, not assumed

`backend/tests/integration/test_211_service_shape_seam.py` §7 pins both:

| Path | Step config after the bind | What actually happens |
|---|---|---|
| **The shipped UI** | `capability` CLEARED by `ConnectionPicker.bind`, and the service-only row advertises no action to choose, so `tool_name` stays empty | the executor's **closed-set guard raises `KeyError`** at `phase_types.py:~2323` — line 2460 is never reached |
| **The definition / API surface** | `capability: "post_message"` alongside `connection_id: <service-only row>`; nothing cross-checks the two | **line 2460 fires** and records the inaccurate sentence |

Both are real. The second is the one this report is named for; the first is recorded here so a
fix addresses the arm it means to and does not leave a stack-trace-shaped failure behind.

## Why it matters

`recorded_not_sent` is the one surface in this codebase whose entire stated discipline is **not
over-claiming**. The 189/190 terminal exists precisely so a run says exactly what it did and no
more. This sentence states a fact about the connection that is false: it is not bound for a
different capability, it has **no** capability, because it names a service and nothing else —
which is a legitimate, deliberate, newly-supported shape.

A person who reads *"the bound connection is for a different capability"* will go and look for a
mismatch that does not exist. The honest reading is *"this connection names a service but no way
to reach it yet"* — the sentence `ConnectorNothingToDiscover` already carries on the refresh
path, one module over.

`major`, not `blocking`: nothing is sent that should not be, no credential moves, no data
crosses a tenant boundary. The step correctly declines to act. **What is wrong is the words.**

## Hypothesized cause

**Finding, not hypothesis** (the condition is pinned in a test): `getattr(obj, name, default)`
returns the ATTRIBUTE's value whenever the attribute exists, so a default cannot stand in for a
`None`. The line was written in Phase 190 when a connection could only ever be one of two shapes,
each with a non-null discriminator; the third shape did not exist and could not be represented.

The fix is ~4 lines in one file: distinguish *no capability at all* from *a different capability*
and give the first its own sentence.

## Surface classification

`Agentic-RAG` — this app, this repository, this run path.

## Suggested routing

- **Fold into in-flight phase:** n/a — **deliberately NOT fixed in Phase 211.**
  `backend/app/services/harness/phase_types.py` is in **no** 211 plan's `files_modified`, plan
  211-04's must_have promises that branch stays untouched, and it is a **G-5 hot file**
  (46 commits / 21 phases / 2627 L) with no review cycle in this phase. Editing it here would be
  an unreviewed change to the run path, in a plan whose whole subject is tests and bookkeeping.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** n/a — it has a test and a named fix.
- **External — note only:** no

### Remediation note

**The operator closes this immediately after Phase 211 via `/gsd:fast`** — ~4 lines, one file, no
schema and no API surface, which is G-3 territory by the workflow guardrails' own rule. The
follow-up already has its RED:
`backend/tests/integration/test_211_service_shape_seam.py` §7 asserts **today's** behaviour on
purpose, including the wrong sentence, so **those cases go RED when the fix lands** and are
updated in the same commit. That is what makes the fix provable rather than asserted.

⚠ **A fix must keep the genuinely-mismatched case refused.** §7 pins that too
(`capability="post_message"` against a `create_ticket` row → still `True`); a fix that simply
widens the guard would delete a real protection while closing a wording bug.

## Workarounds (prompt-side, code-side, or UI-side)

Bind a connection that carries an action, and pick that action. A service-only connection has
nothing to send with until OAuth ships (Phase 215) or an endpoint is supplied, so a step bound to
one was never going to send — the step's behaviour is right, only its words are wrong.

## Reference / evidence links

- `backend/app/services/harness/phase_types.py:2460` — the line
- `backend/tests/integration/test_211_service_shape_seam.py` §7 — the RED, pinning today's
  condition AND today's sentence separately, plus the two-arm measurement
- `frontend/src/components/settings/ConnectionFormPanel.tsx` — site 1 (211-03)
- `frontend/src/components/workflows/ConnectionPicker.tsx` — site 2 (211-04)
- `supabase/migrations/127_connector_connection_service_identity.sql` §3 —
  `connector_connections_shape_is_not_ambiguous`, which permits both NULL by design
- `.planning/phases/211-the-connection-is-a-service-not-a-verb/211-VALIDATION.md`
  § "Known gap — the service-only run-time seam"

---

## ✅ Closure — 2026-08-27, `/gsd:fast` (G-3)

**Fixed exactly where this report said it would be, in the way this report said it should be, and
the RED fired.**

`backend/app/services/harness/phase_types.py` — the single guard is split into its two arms.
The `getattr` DEFAULT is **kept**, so a connection object carrying no `capability` attribute at
all still passes as it always did; only *present-and-`None`* is split out and given the honest
sentence **"the bound connection names a service but no way to reach it yet"** — the same
*"not yet"* the refresh path already carries as
`connector_service.ConnectorNothingToDiscover`. **The guard was NOT widened**: a genuinely
mismatched row (`post_message` against a `create_ticket` connection) is still refused with the
sentence it was written for, which this report named as the protection a careless fix would
delete.

**The RED was observed firing, not assumed.** Run against the fixed source, the original §7
failed exactly where it was designed to:

```
>       assert 'getattr(connection, "capability", capability) != capability' in source
tests\integration	est_211_service_shape_seam.py:684: AssertionError
1 failed, 13 deselected
```

§7 was rewritten in the **same commit** to pin the two arms and both sentences — including a
dedicated `_RowWithNoCapabilityAttribute` case holding the preserved default — and the file then
read `14 passed`.

### ⚠ ARM 1 IS STILL OPEN. This report is `closed` for the WORDS, not for both paths it measured.

This report deliberately recorded **two** reachable arms as **different failures**. Only **arm 2**
(the definition/API-reachable state) is closed. **Arm 1 — the UI-reachable state, where
`ConnectionPicker.bind` clears the step's `capability`, a service-only row advertises no action,
and the closed-set guard raises a bare `KeyError` at `phase_types.py:~2323` — is untouched** and
remains a stack-trace-shaped failure. It is kept asserted in §7's
`test_the_ui_reachable_service_only_binding_hits_a_DIFFERENT_arm_first` so it cannot quietly
disappear, and it is the `re_open_trigger` in this file's frontmatter.

### ⚠ The G-5 obligation on this file is now OWED, not honoured

The hot-file row read *honoured by construction (211)* on the strength of an **empty diff**. That
diff is no longer empty, and this was a G-3 `/gsd:fast` with no review cycle — the right
instrument for four lines, the wrong one for a 2,664-line G-5 hot file's extraction. Re-derived at
the fix's commit: **`47 commits / 21 phases / 2664 L`**. The next phase whose `files_modified`
names this file must produce a refactor recommendation as its FIRST option. Full record:
`docs/HOT-FILE-LEDGER.md` → `backend/app/services/harness/phase_types.py` — Phase 211 →
*"✅ CLOSURE — 2026-08-27"*.
