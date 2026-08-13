---
phase: 193
plan: AUTH-03-BACKEND
subsystem: workflows-api
requirement: AUTH-03 (rewritten 2026-08-14)
piece: 1 of 3 (backend). Piece 2 = Builder UI. Piece 3 = retire the run-time upload box.
tags: [workflows, templates, storage, authz, ooxml]
key-files:
  modified:
    - backend/app/api/workflows.py
  created:
    - backend/tests/unit/test_193_workflow_template_upload.py
commit: 44c582a0
completed: 2026-08-14
---

# Phase 193 — AUTH-03 backend: author-time template binding

A user can now attach a template to a workflow **while authoring it**, stored durably against that
workflow. One endpoint, one test file, no migration, no new service class.

## What shipped

**`POST /workflows/{definition_id}/template`** — multipart upload, returns the asset descriptor.

This is the missing **producer** for a consumer that already existed.
`resolve_template_source` Branch 1 (`backend/app/services/template_asset_service.py:145-180`) has
always been able to take a library `asset_ref`, download it from the `workspace-files` bucket and
mark it `provenance="library"` → the trusted docxtpl/Jinja render path. Nothing could ever create
one: all 10 template-bound published workflows were seeded straight into the DB, and
`WorkflowBuilderPage.tsx:667` only ever *read* `assets.find(a => a.kind === "template")` to display
a filename.

## The contract the frontend must consume (piece 2)

| | |
|---|---|
| **Method + path** | `POST /workflows/{definition_id}/template` |
| **Path param** | the workflow's `definition_id` (a UUID). Named `definition_id`, not `workflow_id`, to match every neighbouring route in the file — the URL is identical either way |
| **Body** | `multipart/form-data`, single part named **`file`** |
| **Accepted types** | `.docx`, `.pptx`, `.xlsx` **only** |
| **Auth** | standard `Authorization: Bearer <jwt>`; also carries `require_visible("workflow_authoring")` like every other authoring route |
| **Success** | **201** |

```jsonc
// 201 response — drop this object straight into definition.assets[]
{
  "kind": "template",
  "asset_id": "3f2b0a11-…/_library/9c8d7e66-…/a1b2c3d4-Q3 Report _final_.docx",
  "filename": "Q3 Report _final_.docx",
  "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
```

**Failure codes the client must handle:**

| Code | Meaning |
|---|---|
| `404` | workflow does not exist **or** is not yours — deliberately indistinguishable |
| `422` | wrong type / empty / too large (>10 MB) / not a real OOXML container. `detail` is a plain sentence, safe to show |
| `502` | Storage write failed. `detail` is a clean sentence, never a traceback |

**The endpoint does NOT write the definition.** It returns the descriptor and stops; the Builder
appends it to `definition.assets[]` and saves through the existing `PATCH /workflows/{id}`. That
keeps exactly **one** writer on the `definition` JSONB — a second server-side writer would race the
draft-save path and its Phase-186 `If-Match` concurrency token.

The four-key shape is not asserted by eye: `test_descriptor_round_trips_into_a_workflow_definition`
validates the response through `AssetRef.model_validate(...)` **and** through the
`extra='forbid'` `WorkflowDefinition`, so if the shapes ever drift the test fails rather than the
Builder.

## How it is built

Storage layout `{user_id}/_library/{definition_id}/{uuid8}-{safe_name}` in the `workspace-files`
bucket — the layout the seeded library fixtures already use and Branch 1 already reads. The `uuid8`
makes a re-upload a **new object** rather than an overwrite, so a draft still pointing at the old
`asset_id` keeps rendering.

Nothing was re-implemented. `validate_upload` (the shipped magic-byte gate), `MAX_FILE_SIZE`,
`BUCKET_NAME`, the WR-04 declared-size guard, the WR-05 filename sanitiser and `_owned_slug_or_404`
are all reused. The blocking supabase-py upload is `run_in_threadpool`-wrapped (CLAUDE.md /
D-v2.5-01).

**Two security decisions worth naming:**

1. **Narrower than the chat-time door, on purpose.** `POST /threads/{id}/workspace/files` accepts
   the widened Phase-151/D-09 allowlist (images, `.py`, `.sh`, `.md`, …) because those are skill
   assets the agent *reads*. A workflow template's bytes reach the **docxtpl/Jinja render engine**,
   so this door accepts the OOXML three only. A valid `.png` — which the wider validator happily
   accepts — is refused 422 here, and that is pinned by test.
2. **User-JWT client, not service role.** The upload runs on `get_user_supabase_client`, so
   migration 054's `workspace_storage_insert_own` policy (`(storage.foldername(name))[1] =
   auth.uid()`) is a *second, database-enforced* boundary underneath the route's owner-gate. A
   service-role client would have bypassed it. The path's first segment is the authenticated
   caller's id and never client input, and `/` + `..` are sanitised out of the filename, so the
   object cannot land outside the user-keyed prefix (pinned by a traversal test).

## RED-first evidence

The whole file was written before the endpoint existed and run:

```
E  AttributeError: module 'app.api.workflows' has no attribute 'upload_workflow_template'
15 failed, 1 warning in 0.64s
```

RED for the right reason — the producer did not exist. After implementation: **16 passed**.

Two of those tests failed *again* after the endpoint landed, and both failures were real information
rather than noise, so they are recorded rather than quietly fixed:

- **The non-owner test was not testing anything.** My `_run` helper defaulted with
  `owner_row if owner_row is not None else {...}`, so passing `owner_row=None` — "the owner-gate
  finds nothing" — silently handed the route an **owned** row. The endpoint's only authorization
  proof would have passed while asserting nothing. Replaced with an explicit `_DEFAULT` sentinel.
- **I asserted the wrong filename contract.** I expected `Q3 Report (final).docx` back verbatim; the
  shipped WR-05 sanitiser's charset is `[a-zA-Z0-9._\- ]`, so it returns `Q3 Report _final_.docx`.
  The WR-05 contract is *"an ordinary name must not 422"*, which is **not** the same as *"survives
  verbatim"*. The test now asserts the measured value and says why.

## Test delta

Baseline given: **62 failed / 1986 passed** on `backend/tests/unit`.
Measured after this work: **62 failed / 2046 passed** (2 xfailed, 2 xpassed, 28.9 s).

**Failures unchanged at 62 — zero regressions.** Not one of the 62 names this work; grepping the
failure list for `193` / `workflow_template` returns nothing. The passed count is +60 rather than
+16, so the 1986 figure was already stale before this task started (other work has landed on
`develop`); the failure count is the load-bearing half and it did not move.

Run with `backend/venv/Scripts/python.exe -m pytest tests/unit -q -p no:randomly`.

## Found but deliberately NOT fixed

1. **`GenerateRequest.template_asset_id` is typed `UUID`, but a library asset_id is a Storage
   path.** `backend/app/api/workflows.py` types the NL-generate body field as `UUID | None`, while
   the service beneath it (`workflow_authoring.py:241`, `grounding.py:249`) accepts `UUID | str` and
   passes the value to `resolve_template_source` **as a storage path**. So a real library
   `asset_id` — `{uid}/_library/{wf}/{uuid8}-name.docx` — cannot get past FastAPI's validation on
   that route: it 422s at the door. The optional template-placeholder grounding in
   `_resolve_template_placeholders` is therefore unreachable from the HTTP API for any genuinely
   library-stored template. Not touched: it is a different route, a different requirement, and
   widening the type is a wire-contract change that deserves its own decision.
2. **The run-time upload box is still there.** Unchanged, as instructed — that is piece 3, and only
   safe once pieces 1 and 2 ship. Note that for any workflow that *does* bind a template it is
   already unreachable code: Branch 1 returns unconditionally when `asset_ref` is present.
3. **No delete/replace endpoint.** Re-uploading mints a new object and the old one is left in the
   bucket (deliberate — see the `uuid8` reasoning above), so bound templates accumulate. There is no
   `DELETE /workflows/{id}/template` and no reaper. Out of scope for the smallest thing that works.

## Scope check

One source file (+149 / −2, of which the 2 deletions are two import lines rewritten) plus one test
file. No migration — the descriptor lives inside the existing `definition` JSONB, exactly as
expected. No new service class, no vocabulary module, no characterization baselines. `STATE.md`,
`ROADMAP.md` and `REQUIREMENTS.md` were not touched, and no `gsd-sdk state.*` verb was called.

## Self-Check: PASSED

- `backend/app/api/workflows.py` — modified, route registers on the real app
  (`/workflows/{definition_id}/template` `['POST']`) and generates valid OpenAPI
- `backend/tests/unit/test_193_workflow_template_upload.py` — FOUND, 16 passed
- commit `44c582a0` — FOUND in `git log`
