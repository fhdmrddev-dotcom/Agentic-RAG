---
seed_id: SEED-130
title: "GET /workflows/grounding-bundle: the template_placeholders path is dead code — a UUID template_asset_id can never match a storage-path asset, so it silently returns [] for every real template"
status: open
planted: 2026-07-25
phase_origin: "Phase 182 verification (182-VERIFICATION.md Anti-Patterns, WR-03) — surfaced at verification, deliberately deferred at gap closure. The Phase-182 gap-closure wave fixed the SC#4 per-node keying blocker (182-04), the publish-enforcement gap (182-06) and the fail-open severity classifier (182-07); this finding is real but has no consumer yet, so it is carried forward rather than fixed blind."
folded_into: null
category: "correctness / dead-path — a documented feature that cannot fire. Not a security or availability defect: the route degrades to an empty list, it never errors and never widens scope. The cost is a documented palette field that is permanently empty plus a test that green-lights the emptiness."
related_seeds: [SEED-110]
related_decisions:
  - "D-182-01 (182-CONTEXT.md) — `GET /workflows/grounding-bundle` ships as a sibling cacheable read whose payload includes `template placeholder fields`, because Phase 184's node-config dropdowns must be SERVER-fed, never a frontend constant (Pitfall 1 / ROADMAP SC#2 anti-drift). `template_placeholders` is one of the four documented palette fields; three of the four work."
  - "D-103-3 / D-103-CONF-2 — template grounding is OPTIONAL: a resolution miss must degrade to no placeholders, never a hard failure of the whole generate. That degrade policy is correct and must survive any fix; the defect is that the degrade is now the ONLY reachable outcome for the `template_asset_id` input, so an intentional soft-fail has quietly become an unconditional one."
  - "D-05 (template_asset_service) — `resolve_template_source` must NEVER surface a raw 404 / traceback; it relays a clean error result. Correct in itself, and the reason this dead path is completely silent (see `confirmed` below): the storage miss is swallowed one layer BELOW the `except Exception` that would have logged it."
confirmed:
  - "The key contract is genuinely mismatched. `backend/app/services/template_asset_service.py:158` states it verbatim: `asset_id is the Storage path in the workspace-files bucket (RESEARCH Q1: the seeded fixture lives at {user_id}/_library/...)`. The route's query param is typed `template_asset_id: UUID | None` (`backend/app/api/workflows.py:481`), and `_resolve_template_placeholders` passes it straight through as `AssetRef(asset_id=str(template_asset_id), filename=str(template_asset_id), ...)`. A bare UUID is not a `{user_id}/_library/...` path, so Branch 1's storage read cannot resolve a real library asset."
  - "The degrade is SILENT — quieter than the verification report assumed. `resolve_template_source` catches the storage failure INTERNALLY (`template_asset_service.py:157-173`) and returns a clean error-shaped result with no `bytes`, so `_resolve_template_placeholders` exits through its `if not data: return []` branch, NOT through the `except Exception` backstop. That means the `logger.warning(\"grounding: template placeholder resolution failed; skipping\")` line never fires. There is no log, no metric, and no error on the wire — the only observable is an empty list that looks exactly like the documented `no template requested` case."
  - "`backend/tests/test_182_grounding_bundle.py:114-136` (`test_grounding_bundle_returns_server_sourced_palette`) asserts `body[\"template_placeholders\"] == []` as the EXPECTED shape, with the comment `placeholders are PER-TEMPLATE: absent ?template_asset_id= -> [] (RESEARCH A3)`. For the no-param case that assertion is genuinely correct — but it is also the only coverage this field has, so the suite is green whether or not the WITH-param path works. A test passing for the wrong reason is exactly why a failures-only differential can never surface this: nothing fails, now or after a fix."
needs_confirmation:
  - "Whether any seeded/library template asset exists in the live DB whose storage path IS a bare UUID (e.g. an id-named object). If one does, the path is not 100% dead — it would resolve for that one accidental shape only. Check with a live listing of the `workspace-files` bucket under `{user_id}/_library/` before choosing between the two fix options below."
  - "Which side of the contract should move. Option A: keep the `UUID` param and have `_resolve_template_placeholders` LOOK UP the asset row to get its storage path before building the `AssetRef` (an extra read; matches how a canvas dropdown would identify an asset — by id). Option B: retype the param as the storage path (`str`) and drop the UUID coercion (no extra read; leaks a storage path onto the query string). Phase 184 owns this call because it owns the dropdown that supplies the value."
re_open_triggers:
  - "Phase 184 wires template selection into the node-config side panel (CANVAS-03 — `configure a selected node in a side panel backed by the existing PhaseConfig discriminated-union schema`) and the template dropdown needs real placeholder fields to offer. This is the FIRST real consumer; the moment it binds, the empty list becomes a visibly broken dropdown rather than an unused field."
  - "Any consumer — canvas, NL generator, Workflow Studio, or an API client — requires a NON-EMPTY `template_placeholders` payload from `GET /workflows/grounding-bundle?template_asset_id=...`. Reproduce first: call the route with a real library asset id and confirm `[]` before assuming a different root cause."
  - "Anyone edits `_resolve_template_placeholders` (`backend/app/services/harness/grounding.py`) or changes the `template_asset_id` param type on `get_grounding_bundle` (`backend/app/api/workflows.py:481`). Fix the key contract in THAT SAME commit rather than planting a sibling seed — the SEED-125 -> SEED-129 tail is the precedent for what happens when a known-adjacent site is left for later."
  - "SEED-110 (run-time template / file upload as a workflow run input) is picked up. It ships the surface that hands a template to a workflow, which makes the placeholder vocabulary load-bearing at run time as well as at author time — the two must agree on how a template is identified."
priority: medium
suggested_phase: "Fold into Phase 184's node-config work — the first real consumer, and the phase that decides how a dropdown identifies a template (which settles the Option A / Option B question above). Not worth a standalone /gsd:quick before then: with no consumer, a fix today would be unverifiable beyond a unit test written against an assumption."
---

# SEED-130 — the `template_placeholders` dead path in the grounding bundle

## The gap

`GET /workflows/grounding-bundle` documents four palette fields. Three of them (`tools`,
`folders`, `skills`) are genuinely server-sourced and verified. The fourth,
`template_placeholders`, cannot produce a non-empty value for any real library asset.

The break is a **key-type mismatch across a module boundary**:

| Site | What it does | The problem |
|---|---|---|
| `backend/app/api/workflows.py:481` | `template_asset_id: UUID \| None = None` query param | Types the identifier as a **UUID** |
| `backend/app/api/workflows.py:505` | `pool = await get_pg_pool() if template_asset_id is not None else None` | Lazily builds the pg pool — correct, and the only cost the dead path actually incurs |
| `backend/app/services/harness/grounding.py:189-237` (`_resolve_template_placeholders`; the block sits at **:193-241 at HEAD** after plan 182-04 shifted the file by 4 lines — anchor on the function name, not the range) | Builds `AssetRef(asset_id=str(template_asset_id), filename=str(template_asset_id), kind="template", ...)` and calls `resolve_template_source` Branch 1 | Passes the **UUID** into a field the resolver reads as a **storage path** |
| `backend/app/services/template_asset_service.py:158` | `# asset_id is the Storage path in the workspace-files bucket (RESEARCH Q1: the seeded fixture lives at {user_id}/_library/...)` | States the real contract verbatim: `asset_id` **is a path**, not an id |
| `backend/tests/test_182_grounding_bundle.py:114-136` | `assert body["template_placeholders"] == []` | Freezes the empty result as the expected shape (correct for the no-param case, but it is the field's only coverage) |

A bare UUID is never a `{user_id}/_library/...` path, so the storage read misses, and the
function returns `[]`.

## Why it is silent rather than loud

`resolve_template_source` catches the storage failure itself (`template_asset_service.py:157-173`,
per D-05: never surface a raw 404) and returns a clean error result with no `bytes`. So
`_resolve_template_placeholders` exits through its `if not data: return []` branch — **not**
through the `except Exception` backstop that carries the
`logger.warning("grounding: template placeholder resolution failed; skipping")` line.

Net effect: no exception, no log line, no metric, HTTP 200, and an empty list that is
indistinguishable from the documented "no template requested" response. Two individually
correct decisions (an optional-grounding soft-fail, and a no-raw-404 relay) compose into a
failure mode with zero observability.

## What it does NOT break

Worth stating so a future reader does not over-scope the fix:

- **Not a security issue.** The path only ever narrows to `[]`; it cannot widen scope, leak a
  foreign asset, or bypass the owner scoping the rest of the bundle applies.
- **Not an availability issue.** The route stays 200. The only wasted work is one lazily-created
  pg pool per call that supplies a `template_asset_id`.
- **Not the workflow RUN template path.** Workflow execution fills templates through
  `render_template` / `resolve_template_source` with a real `AssetRef` from
  `WorkflowDefinition.assets[]`, where `asset_id` genuinely IS a storage path. That path works.
  Only the **grounding-bundle query-param** entry point is mistyped.

## How we would know this is closed

1. A test exists that drives the route WITH the param and asserts a **non-empty** result:
   `GET /workflows/grounding-bundle?template_asset_id=<real library asset>` returns a
   `template_placeholders` list containing the template's actual docx variables. It must FAIL
   against today's code before it is trusted (the falsification discipline Phase 182's CR-01 fix
   used).
2. `grep -n "asset_id=str(template_asset_id)" backend/app/services/harness/grounding.py` returns
   nothing — the `AssetRef` is built from a resolved storage path, or the param is retyped so the
   value it carries genuinely is one.
3. `backend/tests/test_182_grounding_bundle.py`'s `== []` assertion is scoped explicitly to the
   NO-param case (its name or docstring says so) and is no longer the only coverage the field has.
4. A live check: with `visual_workflow_canvas` on, call the route with a real library asset id for
   a template known to contain `{{ variables }}` and confirm the returned names match
   `parse_docx_template_variables` run directly on the same file.
5. Whichever fix option is taken, the OPTIONAL-grounding degrade survives: an unresolvable or
   foreign asset still yields `[]` and never a 5xx (D-103-3). Add the missing observability while
   there — a resolution miss on an EXPLICITLY-requested template should log, since "the caller
   asked for a template and got nothing" is not the same event as "no template was requested".
