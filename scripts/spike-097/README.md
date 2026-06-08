# scripts/spike-097 — Phase 097 Throwaway Spike (SEED-051)

**This is a THROWAWAY spike. Not production code. Do not import any of it from `backend/`.**

Phase 097 de-risks the entire v2.9 Workflow Studio milestone by running a
Risk-Register template-fill from a real KB folder end-to-end **on one provider**
(Anthropic native, forced tool-use), answering four schema-shaping unknowns
**before** any production schema (`inputs` / `assets` / `folder_scope`) is locked:

- (a) Can a model reliably derive the input field schema from a risk-register template?
- (b) Does KB-grounded `docxtpl` fill produce a clean, re-openable `.docx`?
- (c) What does authoring-time grounding actually need?
- (d) Does describe -> refine -> publish *feel* good with a human in the loop?

## Where things live

- All spike code lives **here, at the repo root** — deliberately **OUTSIDE
  `backend/`** because uvicorn `--reload` watches that tree and a stray scratch
  `.py` has wedged the Windows backend before (CLAUDE.md hard rule).
- All run artifacts land in `out/` (field-map JSON, filled `.docx`, corruption
  log, transcript, `kb-folders.json`, `spike-config.json`).
- `templates/risk-register.docx` is the `{%tr %}` variable-row template under test.

## Dependencies

- `docxtpl==0.20.2` is installed into the **backend venv only** (spike iteration
  loop). It is **NOT** added to `backend/Dockerfile.sandbox` or
  `backend/requirements*.txt` here — **Phase 101** does the production add and
  bumps the `SANDBOX_IMAGE` tag. Installing docxtpl pulls `jinja2` + `lxml` +
  `python-docx` transitively.
- Everything else the spike composes (scoped retrieval, the sandbox, the
  Anthropic native SDK, the OOXML libs) is already shipped.

## Run from the repo root

```bash
# scaffold / template (Wave 0)
backend/venv/Scripts/python.exe scripts/spike-097/make_template.py

# discover candidate risk-content KB folders for the test user (Wave 0)
backend/venv/Scripts/python.exe scripts/spike-097/find_risk_folder.py
```

`find_risk_folder.py` writes `out/kb-folders.json` (ranked candidate folders +
subtree ids + doc counts). The operator then confirms which folder holds genuine
risk content; that choice is recorded in `out/spike-config.json` — the single
source of truth every downstream experiment plan reads.

## Security

- `find_risk_folder.py` builds a **service-role** Supabase client (bypasses RLS),
  so every query is filtered by the test user's `user_id` (threat T-097-01).
  The service-role key is sourced name-only from `backend/.env` and is **never**
  echoed to stdout or written into any `out/` file.
