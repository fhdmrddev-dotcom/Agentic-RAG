# Phase 147: Operator Control Plane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 147-operator-control-plane
**Areas discussed:** Kill & the victim's run, Switches & maintenance semantics, Live data vs the ledger, D-147-IA Overview promotion (+ reported-bugs routing)

---

## Reported-bugs routing (mandatory sweep)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold both into 147 | Kill produces exactly these states; fixing them makes the 064-B honest two-state contract true for the victim; SC#10 UAT hits them anyway | ✓ |
| Leave open | Separate Deep-chat polish; 147 verifies operator-side card states only | |
| Defer with named trigger | Re-open trigger "Phase 147 Kill UAT reproduces them" | |

**User's choice:** Fold both into 147 (BUG-260710-01 stopped-indicator lost on navigation + BUG-260710-02 empty bubble on early cancel)

---

## Kill & the victim's run

**Q1 — Which run kinds appear in the Active-runs list, and which get Kill?**

| Option | Description | Selected |
|--------|-------------|----------|
| List all, Kill chat+workflow | Every runs:active entry with a kind badge (Chat/Workflow/Eval/Tuner); Kill wired day-one for chat + workflow; eval/tuner shown as bounded internal jobs, honest "ends on its own" copy | ✓ |
| List + Kill everything | All four kinds killable — net-new cancel plumbing for eval/tuner lifecycles | |
| Chat + workflow only | Filtered list; monitor under-reports actual system activity | |

**Q2 — What does the victim see when an operator kills their run?**

| Option | Description | Selected |
|--------|-------------|----------|
| Same as self-cancel | "Stopped" indicator, no operator attribution in chat; who/why in operator_audit_log only; zero new shared-path surface | ✓ |
| Attributed: "ended by an administrator" | Plain note in chat; requires threading attribution through run state → message render (G-5 adjacent) | |
| Attributed + reason | Operator-typed reason persisted onto the victim's thread | |

**Notes:** Kill-path mechanics (new /admin endpoint reusing cancel/zombie-heal internals minus ownership filter, long-running/not-responding thresholds, workflow-run cancel delegation) routed to Claude's discretion.

---

## Switches & maintenance semantics

**Q1 — When a capability switch is OFF, what happens for end users?**

| Option | Description | Selected |
|--------|-------------|----------|
| Two-layer: hide + refuse | New runs don't advertise the tool + in-flight calls get a plain refusal ToolResult; fail-closed at the single dispatch_tool seam | ✓ |
| Refuse-only | Tool stays advertised, every call errors — wasted iterations | |
| Hide-only | In-flight runs keep using the capability until they end — weak emergency brake | |

**Q2 — What does the Workflows kill-switch stop?**

| Option | Description | Selected |
|--------|-------------|----------|
| Block new launches only | Run buttons refuse with plain copy; in-flight workflow runs finish; switches stop NEW work, Kill handles in-flight | ✓ |
| Block new + pause in-flight | Needs net-new harness pause/resume semantics | |
| Block new + kill in-flight | Mass-cancellation as a toggle side effect — contradicts the confirm-names-the-victim rule | |

**Q3 — What does maintenance/read-only mode block, and what do end users see?**

| Option | Description | Selected |
|--------|-------------|----------|
| Block all writes + banner | Middleware gate rejects mutating requests with plain error; allowlist = auth, /admin, self-cancel; in-flight finish; persistent app-wide banner | ✓ |
| Block new runs + uploads only | "Read-only" would be a half-truth | |
| Full freeze incl. in-flight | Mass-cancels user work on flip | |

---

## Live data vs the ledger

**Q1 — How does the Control Plane stay live without flooding the audit ledger?**

| Option | Description | Selected |
|--------|-------------|----------|
| Poll + visit-row exemption | Auto-poll ~10s while open (pause hidden); reads floor-exempt; one "Opened the Control Plane" ledger row per visit + manual ↻ rows; writes always floor-logged | ✓ |
| Manual refresh only | Keeps 146 D-04 posture but the pinned vitals silently rot — breaks the 063-B load-bearing degrade state | |
| SSE live stream | Net-new admin streaming surface — heavier than the problem | |

**Notes:** Resolves the seam 146 D-04 explicitly deferred to this phase. Elapsed tickers are client-side from started_at.

---

## D-147-IA: Overview promotion

| Option | Description | Selected |
|--------|-------------|----------|
| Promote | 146 Overview tab becomes the live Control Plane landing (063-B composition); health in exactly one place; how sketch 066 is drawn | ✓ |
| Keep both tabs | Thin Overview + separate Control Plane — duplicated health signals, the drift risk 066's contract exists to prevent | |

---

## Claude's Discretion

- Operator-kill endpoint shape + cancel-internals factoring for reuse
- Long-running / not-responding threshold mechanics (064-B tags)
- Workflow-run Kill delegation to existing workflow-run cancel machinery
- Net-new flag key names + flag-read failure semantics (fail-closed without transient-blip outage)
- Dependency-probe implementation (Redis/Supabase/sandbox reachability + latency; thresholds; "off by config" vs "down")
- Impact-copy data source for switch cards
- Poll cadence/backoff details + floor-exempt endpoint set
- Maintenance middleware placement + allowlist expression
- Audit action vocabulary for new writes (run.kill, flag.*, maintenance.set)

## Deferred Ideas

- Eval/tuner run cancellation (killable internal jobs) — future if needed
- Workflow pause/resume at phase boundaries — own harness capability
- Operator-typed kill reason shown to the victim — revisit at v3.4 governance
- Sub-tabbed Control Plane (063-C) — documented scale-up
- `spike-nl-workflow-authoring.md` todo — resurfaces at Phase 151/152 (same disposition as 146)
