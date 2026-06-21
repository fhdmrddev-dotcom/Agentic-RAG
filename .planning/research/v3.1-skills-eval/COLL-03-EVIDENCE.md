# COLL-03 — Live confirmation of the workflow↔skill collision (Mechanism A)

**Resolved 2026-06-21** against live local DB (:54322), thread `99af24d5-39a2-4f3c-a355-c65b43f73eb0`
("Weekly Status Report", user `d8a54002-…`). Closes the advisory's COLL-03 "needs live confirmation".

## Verdict
**Mechanism A (shared sandbox `/sandbox/output/` + unfiltered directory-wide harvest) — CONFIRMED.**
**Mechanism B (template_input newest-wins resolver) — DID NOT FIRE here** (no `template_input` rows; the
skill used `execute_code`, not `render_template`).

## Timeline (one thread, one sandbox)
| t | event | file |
|---|---|---|
| 21:24:14 | **Workflow run** `9854abae` (def `…1040a0`, gpt-5.4-mini) completes: "Produced the filled deliverable: /weekly-status-report.docx" | `weekly-status-report.docx` (**37,328 B**) — persisted to `workspace_files` path=/weekly-status-report.docx |
| 21:24:36 | user re-asks "generate weekly report" (now Deep chat, same thread) | |
| 21:25:12 | **Deep skill turn**: `load_skill(weekly-report-writer)` → … → ONE `execute_code` (exec `e13687e4`) | |
| 21:25:17 | assistant: "Your weekly report is ready: `Weekly_Report_2026-06-20.docx`" | |

## The smoking gun
The skill's `execute_code` (exec `e13687e4`) source has **exactly one** write:
```python
filename = 'Weekly_Report_2026-06-20.docx'
doc.save(f'/sandbox/output/{filename}')
```
- Verified: the code **never** writes `weekly-status-report.docx` (`'weekly-status-report.docx' in code == False`).

Yet that single `execute_code`'s `output_files` returned **TWO** files:
```
output_files: [
  { filename: "weekly-status-report.docx",       size: 37328, is_hero: true },   # <- the WORKFLOW's leftover
  { filename: "Weekly_Report_2026-06-20.docx",   size: 11545 }                    # <- the skill's actual output
]
```
Both `sandbox_files` rows carry the **same** Deep `execution_id` `e13687e4`. The 37,328-byte file is byte-for-byte
the workflow's earlier deliverable (same size as the `workspace_files` row from 21:24:14).

## Mechanism (why two files)
1. The sandbox container is keyed by `thread_id` and reused across the Harness run and the Deep turn.
2. The workflow's render wrote `weekly-status-report.docx` into `/sandbox/output/` and **nothing ever cleared it**.
3. The skill's `execute_code` saved its own `Weekly_Report_2026-06-20.docx` into the SAME `/sandbox/output/`.
4. `harvest_output_files` `os.walk`s `/sandbox/output/` **unfiltered**, and the per-run dedup baseline
   (`_previous_files_in_run`) starts **empty** → it emits **every** file on disk = the new skill file PLUS the
   stale workflow file. The stale file was even tagged **`is_hero:true`** (presented as the primary output).

## Refinements to the advisory
1. **Signature correction.** The true signature is NOT "same filename across two execution_ids" (both files share
   ONE Deep execution_id, so that heuristic returned NONE). It is: **a single `execute_code` emits more
   `output_files` than the code actually wrote, including a file the code never created.**
2. **IA-01 does NOT prevent this collision.** This thread had the workflow + Deep chat in one thread. Even if
   workflows launch only from the Workflows page (new thread), the user **Continues** in the workflow's own thread
   and chats — same sandbox, same leftover, same collision. **COLL-01 is the mandatory fix; IA-01 is clarity only.**
3. **COLL-02 (template resolver) is not needed for this case** (no `template_input` leftover; skill used
   `execute_code`). Keep COLL-02 as defense for the `render_template` path, but COLL-01 is the one that bit here.

## The fix (COLL-01) — confirmed sufficient for this case
Seed `harvest_output_files`' `previous_files` baseline from the `/sandbox/output/` listing at the **start of each
execute-code turn** (or mtime-filter against turn start), so a turn only emits files **it** created. Scope per
**run**, not per cell (a multi-cell run must keep its own intermediates). Smallest blast radius; no schema change.
