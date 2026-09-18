---
seed_id: SEED-130
title: "GET /workflows/grounding-bundle: the template_placeholders path is dead code — a UUID template_asset_id can never match a storage-path asset, so it silently returns [] for every real template"
status: open
planted: 2026-07-25
phase_origin: "Phase 182 verification (182-VERIFICATION.md Anti-Patterns, WR-03) — surfaced at verification, deliberately deferred at gap closure. The Phase-182 gap-closure wave fixed the SC#4 per-node keying blocker (182-04), the publish-enforcement gap (182-06) and the fail-open severity classifier (182-07); this finding is real but has no consumer yet, so it is carried forward rather than fixed blind."
folded_into: null
category: "correctness / dead-path with an INCIDENTALLY-contained un-gated read — a documented feature that cannot fire, whose containment is an accident of typing rather than a control. As SHIPPED the route degrades to an empty list, never errors and never widens scope; the cost is a documented palette field that is permanently empty plus a test that green-lights the emptiness. But the ONLY thing keeping the reachable key space empty is the `UUID` annotation on the query parameter — `resolve_template_source` Branch 1 performs zero ownership, org or traversal validation on the value it is handed. Any fix that widens that annotation (including this seed's own Option B) turns the dead path into a live, un-gated service-role storage read. Corrected 2026-07-25 by plan 182-12 / WR-06; see the Correction section at the end of the body."
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
  - "Which side of the contract should move. Option A (RECOMMENDED): keep the `UUID` param and have `_resolve_template_placeholders` LOOK UP the asset row to get its storage path before building the `AssetRef` (an extra read; matches how a canvas dropdown would identify an asset — by id; makes the gate STRUCTURAL, derived from an owner-scoped query rather than string-matched). Option B: retype the param as the storage path (`str`) and drop the UUID coercion. **OPTION B IS UNSAFE AS WRITTEN — do not apply it literally.** The UUID annotation is the ONLY thing containing this path today; removing it turns `GET /workflows/grounding-bundle?template_asset_id=...` into an arbitrary object read across every tenant's `workspace-files` objects, authenticated only by 'is a canvas user', because `resolve_template_source` Branch 1 never validates ownership (see the corrected 'What it does NOT break' section). If Option B is chosen anyway, an ownership gate MUST be added IN THE SAME COMMIT at the seam that accepts the untrusted value — reject any value containing a parent-directory segment (`..`) or not prefixed with the caller's own id, and return the SAME empty list either way so the palette never becomes an existence oracle. Phase 184 owns this call because it owns the dropdown that supplies the value."
re_open_triggers:
  - "DID NOT FIRE AS PREDICTED — superseded 2026-07-31, kept verbatim as the record of a wrong prediction. Phase 184 SHIPPED (UAT 13/13) WITHOUT wiring template selection into the node-config side panel: it built the palette consumer (`useGroundingBundle`, plan 184-09) but hardcodes the template argument to `undefined` (`frontend/src/hooks/useGroundingBundle.ts:145`), and `PhaseFormPanel.tsx` has no template control. So the first real consumer never arrived and the field is still unused rather than visibly broken. Read this trigger as: WHICHEVER phase first puts a template control on the node-config panel is the first real consumer — the identity of that phase is now `suggested_phase`'s problem, not 184's. ORIGINAL TEXT: 'Phase 184 wires template selection into the node-config side panel (CANVAS-03 — `configure a selected node in a side panel backed by the existing PhaseConfig discriminated-union schema`) and the template dropdown needs real placeholder fields to offer. This is the FIRST real consumer; the moment it binds, the empty list becomes a visibly broken dropdown rather than an unused field.'"
  - "Any consumer — canvas, NL generator, Workflow Studio, or an API client — requires a NON-EMPTY `template_placeholders` payload from `GET /workflows/grounding-bundle?template_asset_id=...`. Reproduce first: call the route with a real library asset id and confirm `[]` before assuming a different root cause."
  - "Anyone edits `_resolve_template_placeholders` (`backend/app/services/harness/grounding.py`) or changes the `template_asset_id` param type on `get_grounding_bundle` (`backend/app/api/workflows.py:481`). Fix the key contract in THAT SAME commit rather than planting a sibling seed — the SEED-125 -> SEED-129 tail is the precedent for what happens when a known-adjacent site is left for later."
  - "SEED-110 (run-time template / file upload as a workflow run input) is picked up. It ships the surface that hands a template to a workflow, which makes the placeholder vocabulary load-bearing at run time as well as at author time — the two must agree on how a template is identified."
  - "WHOEVER IMPLEMENTS EITHER FIX OPTION: the ownership gate ships in the SAME commit as the fix, never as a follow-up. Option B removes the only containment that exists today, and Option A only makes the gate structural if the storage path is derived from an OWNER-SCOPED row read rather than from the caller-supplied value. A commit that changes the `template_asset_id` type or the `AssetRef` construction without adding that gate re-opens this trigger immediately (Phase 182 gap closure / WR-06)."
priority: medium
suggested_phase: "RE-ROUTED 2026-07-31 — the original routing (`Fold into Phase 184's node-config work`) is DEAD: Phase 184 shipped without a template picker (see the 2026-07-31 note at the end of the body for the code evidence). New routing: **the next phase that touches node config — Phase 187 (Business Vocabulary + AI-Seeded Canvas) is the nearest scoped candidate**, because it re-works the node-config vocabulary and its NL seed emits node configs, so it is the next point at which someone plausibly asks a node how it identifies a template. NOT Phase 185 (mid-flight at 10/11, blocked on operator UAT, governance-scoped — folding a template fix in now would be scope creep on a nearly-closed phase) and NOT Phase 186 (autosave/concurrency touches the draft WRITE path, not the config form fields). BE HONEST ABOUT THE WEAKNESS OF THIS ROUTING: no v3.6 phase currently scopes an author-time template picker at all, so 187 is the best available home rather than a confirmed one. If 187's discuss-phase does not put a template control on the node-config panel, RE-ROUTE AGAIN rather than silently attaching this to 187 — an unowned fix parked on a phase that never touches it is exactly how 184 inherited and then dropped this. The Option A / Option B question still belongs to whichever phase builds the dropdown, because that is the phase that decides how a node identifies a template. Still not worth a standalone /gsd:quick: with no consumer, a fix remains unverifiable beyond a unit test written against an assumption — the same reason it was deferred at Phase 182."
surface: Agentic-RAG
trigger_when: unset
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

Worth stating so a future reader does not over-scope the fix — and, since the Phase-182 round-2
review, worth stating **precisely**, because the original wording here was wrong in a way that
would have been inherited by whoever implements the fix.

- **Contained as shipped, but the containment is INCIDENTAL — not a control.** The path as it
  stands cannot widen scope: a bare UUID is not a real storage key, so the read misses and the
  function returns `[]`. What must not be mis-read is *why*. The containment comes entirely
  from the `UUID` annotation on the query parameter (`backend/app/api/workflows.py`
  `get_grounding_bundle`), which restricts the reachable key space to bare-UUID objects at the
  bucket root — objects the app never produces (real paths are
  `{user_id}/{thread_id}/{file_id}/v{n}` and `{user_id}/_library/…`). The resolver itself
  contributes nothing: `resolve_template_source` Branch 1
  (`backend/app/services/template_asset_service.py:145-180`) performs **no ownership, no org
  and no traversal validation** — `user_id` is a declared parameter of `resolve_template_source`
  that Branch 1 never reads — and the download is a raw service-role bucket read
  (`await _read_from_storage(supabase, asset_id)` →
  `supabase.storage.from_(BUCKET_NAME).download(storage_path)`). The value reaching it is
  CALLER-SUPPLIED: `grounding._resolve_template_placeholders` builds
  `AssetRef(asset_id=str(template_asset_id), …)` straight from the query parameter. So the
  correct statement is "un-gated, currently unreachable", never a blanket security clearance — and any
  change that widens the reachable key space (including this seed's own Option B) makes it
  reachable. See `needs_confirmation` above for the gate that must ship with either option.
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
6. The ownership gate shipped in the SAME commit as the fix (see the last `re_open_trigger`), and
   a test proves that a caller-supplied value naming another tenant's object returns the SAME
   empty list a nonexistent one does — no existence oracle, no 403/404 distinction.

## Correction (Phase 182 gap closure, plan 182-12 / WR-06)

**Applied 2026-07-25. Nothing in `backend/` changed — this corrected the seed's recorded
SECURITY VERDICT and its fix guidance, not the code. The dead-path fix itself remains DEFERRED
to Phase 184, and the seed stays `status: open` with `folded_into: null`.**

**What was wrong.** This seed's first "What it does NOT break" bullet used to give the path a
flat, unqualified security clearance, on the grounds that it "only ever narrows to `[]`" and so
"cannot widen scope, leak a foreign asset, or bypass the owner scoping the rest of the bundle
applies". (The exact wording is deliberately not reproduced here: a grep-based proof that a
false claim is gone cannot survive the claim being quoted — the lesson plan 182-11 learned the
hard way.) The *observable* half of that claim is true today. The
*causal* half is not: the path narrows to `[]` because the parameter's `UUID` annotation makes
the reachable key space empty, **not** because anything downstream checks ownership. Round-2
review verified in source that `resolve_template_source` Branch 1 accepts `user_id` and never
reads it, and that the download is a raw service-role `storage.from_(BUCKET_NAME).download(...)`.

**Why correcting a verdict was worth a plan slot.** This seed also offers, as one of two viable
fixes, "Option B: retype the param as the storage path (`str`) and drop the UUID coercion" —
i.e. remove the only containment there is. An implementer in Phase 184 would read "not a
security issue" at the top and Option B at the bottom, and would have no reason to re-derive the
analysis. A wrong recorded verdict paired with a fix that depends on it is a control failure in
its own right, and it is the cheapest possible thing to fix while the evidence is fresh.

**What changed, precisely:**

| Field / section | Change |
|---|---|
| `category` | Kept the dead-path characterisation; removed the unqualified security clearance; states that the containment is INCIDENTAL (the `UUID` annotation) rather than structural. |
| "What it does NOT break" → the first bullet | The unqualified security clearance REPLACED by "Contained as shipped, but the containment is INCIDENTAL — not a control", citing the file, the line range and the fact that `user_id` is never read in Branch 1. The old phrase is gone from this file entirely, quotations included, so a grep can prove it. |
| `needs_confirmation` → the Option A / Option B entry | Option A marked RECOMMENDED (a structural gate, derived from an owner-scoped row read). Option B annotated **UNSAFE AS WRITTEN**, with the exposure spelled out and the required ownership gate named — reject `..` or any value not prefixed with the caller's own id, and return the same empty list either way so the palette is never an existence oracle. |
| `re_open_triggers` | One ADDED: whoever implements either option ships the ownership gate in the same commit. The four original triggers are untouched. |
| "How we would know this is closed" | One item added (#6) requiring a test that a cross-tenant value is indistinguishable from a nonexistent one. |

**Explicitly NOT changed:** `status` (still `open`), `folded_into` (still `null`), `priority`,
`suggested_phase`, `related_seeds`, `related_decisions`, the four original `re_open_triggers`,
the three `confirmed` entries, and every line of source. No file under
`backend/app/services/template_asset_service.py` was touched, and the `template_asset_id`
parameter type is unchanged. The threat is registered as T-182-56 in plan 182-12's threat model
with disposition `mitigate (documentation control)` — the control being fixed is the record.

## Re-route (2026-07-31) — Phase 184 shipped without this; the defect is unchanged at HEAD

**Nothing in `backend/` changed. This updates the seed's ROUTING, not the code.** `status`
stays `open`, `folded_into` stays `null`. The only frontmatter fields touched are
`suggested_phase` and the first `re_open_trigger`.

### The defect is still present — verified at HEAD, 2026-07-31

The seed's own closure test #2 says: *"`grep -n "asset_id=str(template_asset_id)"
backend/app/services/harness/grounding.py` returns nothing"*. It still returns a hit, so by the
seed's own standard this is not closed:

```
backend/app/services/harness/grounding.py:261:            asset_id=str(template_asset_id),
backend/app/services/harness/grounding.py:262:            filename=str(template_asset_id),
```

The route parameter is likewise unchanged: `backend/app/api/workflows.py:679` is still
`template_asset_id: UUID | None = None`, with the lazy pool at `:703`. The key-type mismatch,
and the `UUID`-annotation containment that the Phase-182 correction above characterised as
INCIDENTAL, both stand exactly as documented.

**Line anchors have drifted — use function names, not ranges.** The body table above cites
`workflows.py:481` and `grounding.py:189-237` (later amended to `:193-241`). At HEAD the route
is at `workflows.py:679` and `_resolve_template_placeholders` spans `grounding.py:237-285`. The
seed already advises anchoring on the function name; this is the second time the ranges have
rotted, so treat every line number in this file as advisory.

**A SECOND UUID-typed entry point now feeds the same resolver.** `backend/app/api/workflows.py:1178`
declares `template_asset_id: UUID | None = None` on a request body model for the `/generate`
path (`:1173` — *"template grounding is OPTIONAL — a library `template_asset_id` OR a direct…"*;
`:1202` notes both are `UUID`s and 422 on a non-UUID). Whoever fixes this must decide about
**both** sites in the same commit. That doubles the surface of the last `re_open_trigger`'s
same-commit ownership-gate obligation — see the security re-flag below.

### What Phase 184 actually shipped, and why the trigger missed

Phase 184 shipped and passed operator UAT 13/13. It DID build the palette consumer — plan
`184-09-PLAN.md` ("`useGroundingBundle` + `PhaseFormPanel`'s optional governance rails"). It did
NOT build a template picker:

| Site | What is there at HEAD | Consequence |
|---|---|---|
| `frontend/src/hooks/useGroundingBundle.ts:136` | `export function useGroundingBundle(enabled: boolean)` | The hook takes **no** template argument — there is no way for a caller to supply one |
| `frontend/src/hooks/useGroundingBundle.ts:145` | `getGroundingBundle(undefined, controller.signal)` | The `templateAssetId` argument is **hardcoded `undefined`** |
| `frontend/src/pages/WorkflowBuilderPage.tsx:775` | `const bundle = useGroundingBundle(canvasEnabled)` | The hook's ONLY caller |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | No template control. The only `template` matches are `gridTemplateColumns` (`:20`, CSS) and a **read-only** `emitter` field defaulting to `"render_template"` (`:1002-1004`) | Nothing offers a template to pick |
| `frontend/src/lib/api.ts:3514-3521` | `getGroundingBundle(templateAssetId?, signal?)` appends `?template_asset_id=` only when supplied | The typed client DOES support the param — it is simply never given one |

So the `?template_asset_id=` path is **not reachable from the running app at all**. That is why
184 could ship 13/13 green over an unfixed defect, and why no UAT row could have caught it:
there is no surface on which the emptiness is observable.

### The consequence — latent, and now better camouflaged than before

**The moment any phase builds the node-config template dropdown, it renders an EMPTY list,
silently.** No exception, no log line, no metric, HTTP 200 — the failure mode the "Why it is
silent rather than loud" section above documents, now inherited by a UI control instead of an
unused JSON field. An author will see a template picker offering zero fields and have no signal
distinguishing "this template has no `{{ variables }}`" from "the lookup structurally cannot
work".

**184 made the trap worse, not neutral.** Before 184 there was no client at all. Now there is a
typed client that *looks* finished: `api.ts` accepts a `templateAssetId` and encodes it
correctly. An implementer wiring the dropdown will reasonably conclude that threading the id
through `useGroundingBundle` is the whole job — the client is right there and it compiles. They
will get `[]` back, with nothing anywhere pointing at `grounding.py`. The half-built client is a
plausible-looking dead end laid across the exact path the next implementer will walk.

**The observability item (#5 in "How we would know this is closed") is now the highest-value
half of the fix, and the cheapest.** A resolution miss on an EXPLICITLY-requested template must
log. Today "the caller asked for a template and got nothing" and "no template was requested" are
the same silent `[]`, and that indistinguishability is what will burn an hour of the next
implementer's time even if they fix nothing else.

### SECURITY — re-flagged, unchanged, and now doubled

**The Phase-182 correction above stands in full. Option B is still UNSAFE AS WRITTEN. Do not
apply it literally.** Re-stating it here because this seed has now survived one phase hand-off
(182 → 184) and is being handed to a second, and the round-2 finding is the thing most likely to
be lost in transit:

- The `UUID` annotation on the query parameter is the **ONLY** thing containing this path. It is
  an accident of typing, not a control.
- `resolve_template_source` Branch 1 (`backend/app/services/template_asset_service.py:145-180`)
  performs **no ownership, no org and no traversal validation**. `user_id` is a declared
  parameter that Branch 1 never reads. The download is a raw service-role
  `storage.from_(BUCKET_NAME).download(...)`.
- The value reaching it is **caller-supplied**, straight from the query parameter.
- Therefore: **widening the annotation — which is precisely what Option B instructs — converts a
  dead path into a live, un-gated, cross-tenant `workspace-files` read authenticated by nothing
  more than "is a canvas user".**
- The ownership gate ships in the **SAME COMMIT** as the fix, never as a follow-up (the last
  `re_open_trigger`). Reject `..` and any value not prefixed with the caller's own id, and return
  the **same empty list either way** so the palette never becomes an existence oracle.
- **NEW as of 2026-07-31:** with the second UUID-typed entry point at `workflows.py:1178`, that
  same-commit obligation now covers **two** seams. A fix that gates the query parameter and
  leaves the `/generate` body model un-gated has moved the hole, not closed it.

**Option A remains RECOMMENDED** — look the asset row up by id through an owner-scoped query and
build the `AssetRef` from the resolved storage path. It makes the gate STRUCTURAL rather than
string-matched, and it matches how a dropdown would identify an asset anyway: by id.

### Not verified, and stated as such

The `needs_confirmation` item about whether any live `workspace-files` object has a bare-UUID
storage path was **NOT** checked as part of this 2026-07-31 re-route. No live bucket listing was
run. That item remains genuinely open, and it still gates the Option A / Option B choice.
