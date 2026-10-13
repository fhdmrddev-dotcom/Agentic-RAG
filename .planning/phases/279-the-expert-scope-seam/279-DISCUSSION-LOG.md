# Phase 279: The Expert Scope Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 279-the-expert-scope-seam
**Areas discussed:** Seeds to fold, How the file splits, Fix vs record per item, The two trust items, Chrome checks for changed copy

---

## Seeds to fold

| Option | Description | Selected |
|--------|-------------|----------|
| None — keep 279 tight | Defer all 5 with reasons written into the seeds | ✓ |
| SEED-327 handoff instructions | Shared provider adapters + 8 live rows | |
| SEED-320 meter the handoff call | Medium, same file as WR-05 | |
| SEED-067 / SEED-303 / spike todo | Not about Expert scope | |

**User's choice:** the first answer ticked every option, including "None", which contradicts itself. A clarifying question was asked; the answer was **None — defer all 5**.

---

## How the file splits

| Option | Description | Selected |
|--------|-------------|----------|
| Three parts | pure / async statement / transcript wording | ✓ |
| Two parts | pure / everything else | |
| Package | `expert_scope/` with re-exports | |

| Option | Description | Selected |
|--------|-------------|----------|
| Repoint everything | 2 app importers; retarget tests in the move commit | ✓ |
| Re-export from expert_scope.py | Old imports work; string patches still need retargeting | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the 278 kit | AST pin, one home, retarget-only + no-loss, fixtures byte-equal | ✓ |
| Fixtures only | Lighter; can miss a body change | |

---

## Fix vs record per item

| Question | Options | Selected |
|---|---|---|
| Default | Fix all small ones · Trust + correctness only | Fix all small ones |
| IN-02 subfolders | Record, don't fix · Say it in the copy · Expand to subfolders | Record, don't fix |
| Dropped restricted→restricted | Byte-equal move, then fix · Record, don't fix | Byte-equal move, then fix |
| IN-03 / IN-04 | Fix IN-03, split IN-04 · Record both under SEED-327 | Fix IN-03, split IN-04 |

**Notes:** measured at discuss: all 16 SEED-328 items are still open in today's code.

---

## The two trust items

| Question | Options | Selected |
|---|---|---|
| WR-04 "Won't use" | Reword to what's true · Make it true · Both | Reword to what's true |
| WR-05 handoff summary | Quoted background · Move to the system block | Quoted background |
| Refused-send drive note | Refuse before the message is saved · Record, don't fix | Refuse before the message is saved |

---

## Chrome checks for changed copy

| Option | Selected |
|--------|----------|
| Swap card says "Won't search" (WR-04 / WR-03) | ✓ |
| Handoff arrives as background (WR-05 / WR-01) | ✓ |
| Chip never shows the wrong Expert (WR-06) | ✓ |
| Start Chat names the real cause (WR-07) | ✓ |

| Two-org drive | Selected |
|---|---|
| Operator switches org; Claude reads the local DB | ✓ |
| Claude drives it all in Chrome | |

---

## Claude's Discretion

- Function placement within the three modules; the org helper's home and name; the WR-02 conflict copy; the WR-05 wrapper wording.
- Plan count 3, run in sequence (plans 2 and 3 share `threads.py`).

## Deferred Ideas

- SEED-327, SEED-320, SEED-067 (status → deferred, with reasons); SEED-303 note appended (IN-02 routed there); spike todo not related.
- WR-04 "make it true" (a model note + filtering handoff items); WR-05 system-block placement.
