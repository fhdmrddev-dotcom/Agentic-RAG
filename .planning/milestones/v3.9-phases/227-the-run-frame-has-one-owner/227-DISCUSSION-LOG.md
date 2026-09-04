# Phase 227: The Run Frame Has One Owner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 227-The-Run-Frame-Has-One-Owner
**Areas discussed:** Component Topology, ToolCallPanel Extraction, Terminal Status Seam, Wave 1 Gate Pinning

---

## Component Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Evolve `RunCard.tsx` in place | Retain and evolve `RunCard.tsx` as the sole frame owner — keeps import paths clean, avoids alias indirection, updates the existing hot-file row. | ✓ |
| Create `RunFrame.tsx` with re-export | Create `RunFrame.tsx` as the canonical component and re-export from `RunCard.tsx` for backward compatibility. | |
| Create `RunFrame.tsx` with migration | Create `RunFrame.tsx` and migrate all import sites and test suites directly to `RunFrame`. | |

**User's choice:** Evolve `RunCard.tsx` in place as the sole frame owner.
**Notes:** Avoids churn and alias fragmentation across 15+ test suites and caller files while directly addressing the hot-file ledger row.

---

## ToolCallPanel Extraction

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `ToolCallDetails.tsx` AND `StepRow.tsx` | Extract `ToolCallDetails.tsx` (args/result/diff/subagent) and `StepRow.tsx` (rail line, status node, essence line) — makes `ToolCallPanel` a slim orchestrator (~250 lines) and makes step result layout a clean single-file target for SC#3. | ✓ |
| Extract `ToolCallDetails.tsx` only | Leaves `StepRow` inside `ToolCallPanel.tsx`, reducing it to ~550 lines. | |
| Keep single file | Keep `ToolCallPanel` as a single file and delegate frame-level coordination. | |

**User's choice:** Extract `ToolCallDetails.tsx` AND `StepRow.tsx`.
**Notes:** Legitimately discharges "extraction due" from `ToolCallPanel.tsx` by taking away concrete responsibilities, and prepares for SC#3 by localizing step result layout in `StepRow.tsx`.

---

## Terminal Status Seam

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `RunTerminalStatus` into `RunCard.tsx` | `MessageItem.tsx` delegates rendering to `<RunTerminalStatus>` at its current position below content. In a future phase, moving it inside `RunCard` is a 1-file edit in `RunCard.tsx`. | ✓ |
| Pass `terminalStatusPlacement` prop to `RunCard` | `RunCard` renders the status line internally, but for Phase 227 renders it below the card border via an outside slot. | |
| Claude's discretion | Implement whichever cleanly satisfies SC#3 and SC#2. | |

**User's choice:** Extract `RunTerminalStatus` into `RunCard.tsx` as a co-located component; `MessageItem` delegates at its current location.
**Notes:** Meets SC#2 (byte-identical layout on screen today) and SC#3 (future move inside frame is a 1-file edit in `RunCard.tsx`).

---

## Wave 1 Gate Pinning

| Option | Description | Selected |
|--------|-------------|----------|
| Pin all 14 covering suites | Adopt all 14 covering suites identified in measurement pack §4 into `scripts/vitest-count-gate.cjs` (`TARGETS` and `BASELINE`) before any refactoring begins. | ✓ |

**User's choice:** Confirmed ready for context and planning with standard GSD refactor flow.

---

## Deferred Ideas

- Right-aligned result column (conflict with noise audit; deferred to future phase).
- Moving terminal status line inside the frame card border (deferred to future phase).
