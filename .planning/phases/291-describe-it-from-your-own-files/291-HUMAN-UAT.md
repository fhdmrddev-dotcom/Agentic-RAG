---
status: partial
phase: 291-describe-it-from-your-own-files
source: [291-VERIFICATION.md]
started: 2026-10-23T00:00:00Z
updated: 2026-10-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. G-4 Chrome UAT rows S1-S7 (291-VALIDATION.md). Run S1 first
expected: The lived-experience scenarios pass: template, form and reference upload; the arrival card; launch; the fillable-PDF fill and the Word fill. A large fillable PDF (state or country dropdown, 200+ fields) drafts with every field. A form that can't be sent shows the stated refusal, not a silent drop.
result: S1 BLOCKED at the draft step (2026-10-23, Chrome, blank IRS W-9 `fw9.pdf`, 23 AcroForm fields, no /TU tooltips).
  - Door half PASSED with a finding: all 23 fields listed (15 text, 8 yes/no, types carried over), no raw `topmostSubform[0]…` name shown. FINDING: labels inferred from page text are often wrong or empty: ".", "–" ×3, "3.", "on", "Print", a duplicated "6 City, state, and ZIP code", and instruction sentences ("Note: If the account is…"). Choice-of-n: not covered (the W-9 has no dropdown).
  - Draft half BLOCKED: `POST /workflows/generate` returned `{"ok":false,"error":"could_not_generate","detail":"provider_error"}` twice. LangSmith trace 3b362033-db1b-40b8-a9e5-48a88f8cfbbb: Anthropic `claude-opus-4-8` 400 "Your credit balance is too low" (req_011CgJuqe1mdA6KwVSc1yqnb). Operator billing, not a code defect.
  - FINDING (copy): the card says "The model couldn't produce a usable draft. Try again, or describe the work in more detail." for a billing failure. Retrying or rewording cannot help. The retry also re-sent the whole prompt with "Your emission failed strict validation: provider_error".
  - FINDING (SECURITY): the LangSmith trace of `stream_anthropic` records the provider API key in its inputs. `anthropic_service.stream_anthropic`, `google_service` streaming_chat and `web_search_service.web_search` are `@traceable` without `process_inputs=redact_inputs` (the redactor already exists in `rerank_engines/tracing.py`). Rotate the key.
  - Card fold and DB inputs count: not reached on Anthropic.
  - RE-RUN 2026-10-23 on `HARNESS_AUTHORING_MODEL=gpt-5.5` (backend restarted 13:18). Draft arrived in ~70 s. Workflow `909eab02-fc51-4640-bcb1-3730a264944b` saved.
    - Card: "23 inputs from fw9.pdf"; the "Where each answer comes from" fold lists all 23. Header "Asked when this runs 23".
    - DB (`/workflows/drafts` definition): 23 inputs, 23 distinct keys, each one an exact AcroForm name; 1 step `llm_emit` / `render_template`; asset `template:fw9.pdf:application/pdf`. **R1-WR-02 live check PASSED on gpt-5.5:** with the field names grounded by reference, the drafter still chose `render_template` and used every exact key.
    - Types: 14 text, 8 yes/no, plus 1 the model turned from text into enum `["", "C", "S", "P"]` (f1_03, LLC classification). FINDING: the read type (text) was overridden, and an empty-string option was accepted.
    - FINDING (labels, lived experience): the inputs the model stored have GOOD labels ("Line 1: vendor legal name / …"), but the door AND the card fold show the page-text guesses (".", "–", "3.", "on"…). The author reviews the worse set.
    - Minor: one `GET …/template/placeholders?asset_id=fw9.pdf` 404 fires before the bind (the filename is passed as the asset id); it repeats correctly after the PATCH. Harmless noise.
  - Follow-ups found in the same session and FIXED: the trace key leak (`6d14ccf59`); the draft card couldn't scroll, so ~1200 px of the inputs fold was unreachable (`a8da0e1ef`); a draft whose one step was numbered 1 saved but could not publish ("phase_index must be contiguous 0..0, got [1]"), and accepted drafts now renumber 0..N-1 (`4f7994dd7`; the saved draft `909eab02` predates the fix and still carries index 1); the drafting model is now a Settings control (`4f7994dd7`).
  - Picker LIVE-VERIFIED 2026-10-23 (Chrome, Settings → AI Model): "Workflow drafting model" shows "Auto · gpt-5.5", 56 models + Auto. Picking `claude-sonnet-5` saved (`GET /settings` → stored and resolved `claude-sonnet-5`); back to Auto → stored `""`, resolved `gpt-5.5` (env). Left on Auto. Screenshot `screenshot-1792762454013-6.jpg`.
  - Still OPEN: the card's last line says "Nothing is saved or published yet" right after Save; the door and the card show page-text labels instead of the model's labels; the billing failure reads as "describe the work in more detail".
  - S1 VERDICT: ⚠ PARTIAL. The mechanics pass (every field, types, fold, one input per field in DB). Label quality fails the "I'd recognize failure here" bar on a tooltip-less real form. Model: gpt-5.5 (not yet S5-verified, Pitfall 10).

### 2. SC#4: authoring roster run (`RUN_291_AUTHORING_ROSTER=1 backend/tests/integration/test_291_authoring_roster.py`)
expected: Every native provider row plus OpenRouter passes, or is recorded as blocked with a reason and an issue id. Include a "calculate the totals" description that does NOT grant execute_code.
result: [pending]

### 3. SC#5 live: run a workflow on an author's fillable PDF and on a confirmed Word copy
expected: The author's own form comes back filled, with no placeholders the author added.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
