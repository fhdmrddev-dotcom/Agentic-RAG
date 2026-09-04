---
seed_id: SEED-234
title: "The `create_spreadsheet` gap is DISCOVERABILITY, not capability — `create_file` already mints a native Google Sheet, and nothing tells a model so; plus the three Sheets tools refuse an .xlsx without saying why"
created: 2026-09-01
planted_during: Phase 221 — driving all eleven Google writes against the operator's real account
status: planted
surface: Agentic-RAG
severity: medium
category: tool-coverage / refusal-quality
priority: medium
relates_to:
  - SEED-228 (read_doc refuses a .docx without saying why) — this is the SAME defect on the Sheets side, on three more tools
  - SEED-146 (the full integration capability surface)
trigger_when:
  - Anyone proposes adding a `create_spreadsheet` tool — read the first finding below first
  - A user or a model reports that it "cannot create a spreadsheet"
  - Any Google tool answers a bare `FAILED_PRECONDITION` to a person
  - The tool descriptions are next revised for model consumption
---

# SEED-234 — the tool exists; nothing says so

## Finding 1 — `create_file` already makes a native Google Sheet

Recorded coverage notes call out that "Sheets has no `create_spreadsheet` while Docs can be
created". **Measured live 2026-09-01, that is not a capability gap.**

```
create_file  name="AGENTIC-RAG UAT 221 - sheet"
             mime_type="application/vnd.google-apps.spreadsheet"
  -> id 1ORbrfNwSShfCyDzrAGX-dKKiTlj4yiuvCD62lYTgXA0
     mime_type application/vnd.google-apps.spreadsheet
     web_view_url https://docs.google.com/spreadsheets/d/.../edit
```

`append_rows` and `update_cells` then both succeeded on it and `read_sheet` read both writes
back. **The whole Sheets write path works; the only thing missing is that nothing tells a model
`create_file` can do this.** `create_file`'s `mime_type` description does not mention the
Google-native types, and no Sheets tool points at it.

**The cheap fix is words, not code:** name the native mime types in `create_file`'s description
(`application/vnd.google-apps.spreadsheet` / `.document` / `.presentation`), and have the Sheets
tools' descriptions say where a spreadsheet id comes from. Adding a `create_spreadsheet` tool is
the expensive answer to a documentation problem — and it would be a twelfth write to grant,
approve and audit.

## Finding 2 — three Sheets tools refuse an .xlsx with a bare FAILED_PRECONDITION

The operator's Drive holds `Pre-Assigned Allotment for Industrial - Testcases.xlsx`. It is an
uploaded Excel file, not a native Google Sheet, and the Sheets API does not operate on it:

```
append_rows     -> Google refused: HTTP 400 (FAILED_PRECONDITION)
update_cells    -> Google refused: HTTP 400 (FAILED_PRECONDITION)
list_sheet_tabs -> Google refused: HTTP 400 (FAILED_PRECONDITION)
```

Nothing in that sentence says *"this is an Excel file, not a Google Sheet — convert it, or pick
a different file"*, which is the only thing a person could act on. **This is SEED-228's defect
(`read_doc` on a `.docx`) on three more tools**, so it is a family rather than a one-off, and it
should be fixed once at the `_http` refusal layer rather than three more times.

⚠ The remedy is knowable without another call: Drive already returns `mime_type` in
`search_files`, so a refusal can say which type it got and which it needed.

## Finding 3 — `search_files` cannot filter by type at all

`search_files` matches "words against the file NAME" only. So a model asked to "put this in a
spreadsheet" cannot find one: it cannot filter to spreadsheets, cannot tell a native Sheet from
an uploaded `.xlsx` without reading every result's `mime_type`, and will therefore pick the
wrong file and hit Finding 2. **Fifty recent files in the operator's Drive contained ZERO native
Google Sheets and one `.xlsx`** — so the wrong pick is the likely pick, not the unlucky one.
