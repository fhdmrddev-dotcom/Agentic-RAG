# Phase 082: Cross-cutting Verification + Extraction Telemetry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 082-cross-cutting-verification-extraction-telemetry
**Areas discussed:** 082.5 dependency gate, Extraction baseline scope, Verification approach, Milestone-close audit

---

## 082.5 Dependency Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Decouple — run 082 now | Drop 082.5 from 082's dependency list. 082.5 is independent infra. | ✓ |
| Execute 082.5 first | Plan+execute 082.5 before 082. Adds ~1 session. | |
| Ship both in parallel | Discuss/plan both now, execute concurrently. | |

**User's choice:** Decouple — run 082 now
**Notes:** 082.5 is independent infrastructure (error handling + logging) that doesn't affect the three verification checks.

---

## Extraction Baseline Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh re-extract | Call /reextract on thesis PDF + DOCX to prove full pipeline | ✓ |
| Query existing rows | Verify existing data hasn't been corrupted | |

**User's choice:** Fresh re-extract
**Notes:** User provided current live numbers (PDF: 48t/67i/441c, DOCX: 39t/58i/404c) as baseline reference.

### Threshold Decision

| Option | Description | Selected |
|--------|-------------|----------|
| ±20% of current | Standard ROADMAP SC#1 tolerance band | ✓ |
| Exact match | Stricter, catches any drift | |
| Just match direction | Looser, just confirm pipeline runs | |

**User's choice:** ±20% of current live numbers
**Notes:** None

---

## Verification Approach

### 067.5 Lived-Experience Protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Thread-switch stress test | 5 consecutive A→B→A cycles | ✓ |
| Full scenario matrix | 5 different scenarios (switch, F5, new-thread, tab, page-nav) | |
| You decide | Claude picks minimal set | |

**User's choice:** Thread-switch stress test
**Notes:** Original 067.5 protocol.

### Ownership Split

| Option | Description | Selected |
|--------|-------------|----------|
| Claude SC#1/2/4, user SC#3 | Automated + manual split | ✓ |
| Claude everything | Fully autonomous | |
| User everything | Claude writes runbook only | |

**User's choice:** Claude drives SC#1+2+4, user drives SC#3
**Notes:** SC#3 needs real browser interaction with human judgment.

---

## Milestone-Close Audit

### Audit Format

| Option | Description | Selected |
|--------|-------------|----------|
| 082-VERIFICATION.md table | REQ-ID × Status × Evidence + seed disposition | ✓ |
| REQUIREMENTS.md inline update | Update checkboxes directly | |
| Both | Standalone report + inline updates | |

**User's choice:** 082-VERIFICATION.md table
**Notes:** Standard GSD verification format.

### Seed Sweep Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Just the 7 named seeds | SEED-001 (partial), SEED-006/007/008/009/010/011 (close) | ✓ |
| Full sweep all 33 seeds | Audit every seed 001–033 | |

**User's choice:** Just the 7 named seeds
**Notes:** Other seeds stay as-is for next milestone triage.

---

## Claude's Discretion

- Plan splitting, API call sequences, pytest flags, verification report format details

## Deferred Ideas

- Phase 082.5 decoupled — ships independently
- Full seed sweep (012–033) deferred to /gsd:new-milestone
- ROADMAP progress table reconciliation deferred to /gsd:complete-milestone
