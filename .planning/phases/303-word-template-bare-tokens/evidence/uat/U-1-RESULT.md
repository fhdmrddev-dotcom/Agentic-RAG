# 303 U-1 — live result (2026-11-06, local stack, backend up)

Driven through the real app: library template uploaded to Storage `workspace-files`, a published
2-step fill workflow (retrieve → llm_emit/render_template) inserted on the LOCAL DB, run started with
`POST /threads/{id}/messages` (`workflow_definition_id`) as the dev user, per-request model
`deepseek-v4-flash` / `deepseek`. Seed + run scripts are in this folder.

## U-1a — bare tokens fill the value  ✅ PASS
- def `00000000-0000-0000-0000-0000003030a1`, thread `11bfd6ac-8f21-4739-8aca-164fdfcd2b4b`,
  run **`826d3eaf-968c-49fd-bb62-7ef80e765b0b`** — `completed`, `residual_clean: true`, 6 cited fields.
- Output `u1-output-run-826d3eaf.docx`: header `Status report: Project Meridian`; body Period / Overall /
  Summary / Done all show values; nested table `Milestones: Week 11 — …`.
- Whole-package scan: `source_chunk_id` occurrences **0**, leftover `{{` **0**.

## U-1b — a template that prints a whole record is refused  ✅ PASS (after fix)
- def `00000000-0000-0000-0000-0000003030a2` (`{{ risks }}` printed beside a `risks` loop table).
- First run **`ca440cc9-1d3a-44cf-a6f5-b7712d2ce921`**: refused correctly (`residual_clean: false`,
  `residual_tags: ["record text: All risks: [{'description': …"]`, 0 files delivered), **but the person
  read the generic sentence** "the filled file did not open cleanly, or still had unfilled placeholders" —
  neither true. Cause: `phase_types.py` recorded `KIND_INTEGRITY_FAILED` with no cause, so
  `emit_cause` could only pick its one fixed sentence; the 303 handler wording never reached the
  workflow path.
- Fix: `emit_cause.integrity_detail(verdict)` + one record-text sentence; the executor passes it (RED
  `d024a6892`).
- Re-run **`18b90037-ed73-40bc-8ce8-8c57706b1d08`** (first wording) and final run
  **`6bc7da96-6a06-42d1-ac1b-1bc943fba3dd`** (shipped wording): failed with
  "a field in the template printed a whole cited record instead of one value (a single field reads
  {{ name }} or {{ name.value }}), so the file was not delivered. Check the template file." —
  the same words in the thread's assistant message; **0 files delivered**.
- Not observable from this shell: the in-container `/sandbox/output` delete (Docker CLI denied). Covered
  by `test_handler_removes_a_refused_file_from_sandbox_output`; nothing reached `workspace_files`.

## Noise, not 303
- Run `21fb06fe-a76c-4408-8568-bf7eff55b813` (default model gpt-4o): the retrieve step added a
  "documents older than 1 week" filter, found 0 sources and paused on the no-sources ask. Left paused.
- The model retries a record-printing template 3 times; a new fill cannot change a template defect.
  Pre-existing retry behaviour, recorded only.
