# Phase 302: Close-Out and a True Register - Discussion Log

> **Audit trail only.** Decisions live in CONTEXT.md.

**Date:** 2026-10-30
**Mode:** `--auto` (operator "keep going"); recommended option each time.
**Areas:** FIX-01 approach, FIX-03 scope, FIX-06 dispositions, REG-08 timing, guardrails

## FIX-01
| Option | Selected |
|---|---|
| Read-side: panel also lists the thread's output files from the chat's source | ✓ |
| Copy sandbox outputs into workspace_files at generation | (two homes for bytes) |
| Accept and document the two homes | (SC#1 would be unmet) |

## FIX-03
| Option | Selected |
|---|---|
| Already built by 300 → drive live + close BUG-261027-03 | ✓ |
| Rebuild | (duplicate work) |

## FIX-06
| Option | Selected |
|---|---|
| Fix all six (each RED first), accept any research refutes | ✓ |
| Accept all with reasons | (cheap fixes left on the table) |

## REG-08
| Option | Selected |
|---|---|
| Last plan; write the TRUE current state (human_needed stays folded with what is owed) | ✓ |
| Wait for 298/300/301 operator UAT first | (blocks the phase on the operator) |

## Guardrails
G-2: no sketch (existing surface, existing rows) — override recorded. G-4 scenarios set (D-19). Four-axis for
FIX-01 (D-20). G-8: 3 plans (D-21).

## Deferred
`*.vercel.app` preview fix (bug filed only); copying outputs into workspace storage.
