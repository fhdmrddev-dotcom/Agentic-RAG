---
quick_id: 260814-q5r
plan: 01
subsystem: workflow-authoring
tags: [templates, honesty, authoring-panel, owner-gating, storage]
requires:
  - "resolve_template_source Branch 1 (library asset path -> bytes)"
  - "parse_docx_template_variables (the 097/101.1 coverage oracle)"
  - "POST /workflows/{id}/template (Phase 193 — the producer of these asset ids)"
provides:
  - "GET /workflows/{definition_id}/template/placeholders — owner-gated, prefix- and traversal-fenced"
  - "grounding.resolve_template_placeholders -> (names, read) three-state"
  - "useTemplatePlaceholders — the five-state leaf read"
  - "Four honest readings on TemplateAttachSection"
affects:
  - backend/app/services/harness/grounding.py
  - backend/app/api/workflows.py
  - frontend/src/components/workflows/TemplateAttachSection.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - CLAUDE.md
tech-stack:
  added: []          # NO new dependency — T-q5r-SC
  patterns: ["leaf-hook-consults-server (ConnectionPicker 190-12)", "fail-closed-by-shape union", "emptiness-gated copy (drift-safe)"]
key-files:
  created:
    - backend/tests/unit/test_q5r_template_placeholders.py
    - frontend/src/hooks/useTemplatePlaceholders.ts
  modified:
    - backend/app/services/harness/grounding.py
    - backend/app/api/workflows.py
    - frontend/src/lib/api.ts
    - frontend/src/components/workflows/TemplateAttachSection.tsx
    - frontend/src/components/workflows/TemplateAttachSection.test.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
decisions:
  - "D-1 honoured: a dedicated owner-gated route, NOT a widened template_asset_id on /grounding-bundle"
  - "D-5 honoured: the Storage read goes through get_user_supabase_client (user JWT), never the service role"
  - "getGroundingBundle's templateAssetId parameter remains UNUSED by the app — left in place, not deleted"
metrics:
  tasks: 3
  commits: 3
  duration: "~1h"
  completed: 2026-08-14
---

# Quick Task 260814-q5r: Show a Template's Placeholders When It Is Attached

**One-liner:** An owner-gated `GET /workflows/{id}/template/placeholders` plus a leaf hook turn
a bound `.docx` into the list of fields it will ask the step to fill in — and make "we could
not read it" structurally unable to render as "it has none".

## What Shipped

| Task | Commit | What |
|---|---|---|
| 1 | `19b94a1a` | The route + the `(names, read)` three-state + three `CLAUDE.md` ledger rows |
| 2 | `ce9d6f74` | `getWorkflowTemplatePlaceholders` + `useTemplatePlaceholders` |
| 3 | `9521dfb6` | Four readings on `TemplateAttachSection`, the `.find()` hoist, the pin |

## The Probe — finding 1 was re-confirmed by hand, not believed

The plan opened by refuting its own brief and told me to verify it rather than trust the
paragraph. **The premise held.** Driven through FastAPI's real validation machinery (a
`TestClient` over the real router, auth deps overridden so the probe measures query
validation and nothing else):

```
PROBE asset_id : 3f2b0a11-…-beef/_library/7c0e1f22-…-1234/a1b2c3d4-Q3 Report.docx
PROBE status   : 422
PROBE body     : {'detail': [{'type': 'uuid_parsing',
                              'loc': ['query', 'template_asset_id'],
                              'msg': "… found `/` at 37"}]}
```

The failure is at offset **37** — precisely the `/` between the user id and `_library`. The
shipped seam is not merely unwired; it is unwirable as typed.

⚠ **One honest wrinkle in the probe itself, recorded because it nearly became a false
result:** my first run returned `404 Not Found`, which reads like a verdict and is not one —
I had double-prefixed the router (it already carries `prefix="/workflows"`). A 404 from a
routing miss and a 404 from a gate are indistinguishable in the output. I fixed the probe
rather than reporting the 404.

## The RED plants — four planted, four observed, all reverted md5-identical

Every plant was applied to **real production source**, observed failing, then reverted and the
file hashed. A fence whose scope was never tested is not a fence.

| Plant | What was removed/merged | OBSERVED |
|---|---|---|
| **RED-1** | the `asset_id.startswith(f"{user_id}/")` clause | `1 failed, 13 passed` — `Failed: DID NOT RAISE <class 'fastapi.exceptions.HTTPException'>` |
| **RED-2** | only the `".." in asset_id.split("/")` clause | `2 failed, 12 passed` — `DID NOT RAISE` on **both** traversal cases |
| **RED-3** | the `except` arm returning `"ok"` instead of `"unreadable"` | `1 failed, 13 passed` — `AssertionError: a failed read reported itself as a successful one: 'ok' == 'ok'` |
| **RED-4** | the `unavailable` branch rendering `TEMPLATE_FIELDS_NONE` under the `template-fields-none` testid | `5 failed, 38 passed` — `TestingLibraryElementError: Unable to find an element by: [data-testid="template-fields-unavailable"]` + full DOM dump |

**⚠ RED-1's assertion, corrected rather than overclaimed.** `DID NOT RAISE` fires at the
`pytest.raises` boundary and by itself proves only that no exception was raised — the same RED
would appear if the route returned an empty list. So the **disclosure was confirmed separately**,
by driving the planted route directly:

```
RESULT   : {'read': 'ok', 'placeholders': ['their_secret']}
RESOLVER ASKED FOR: ['9c8d7e66-…-cafe/_library/x/aa-Their.docx']
```

Another author's field names really do cross the wire when that one clause is absent. The
initial draft of the test docstring claimed this without having measured it; it now says what
was actually seen and how.

**RED-4 failed as a real assertion, not a bare timeout** — it names the missing testid and
prints the tree. The whole planted run was **7.23 s across 43 cases**, so the five failures are
not five 5-second walls. Four cases beyond the headline fell with it (network failure,
missing-`read` key, unreadable `.pptx`, no-amber styling), so the merge is unsurvivable.

**md5 verification, recorded after every revert:**
- `backend/app/api/workflows.py` → `447ae47670a216814c319ab434fff869` (pre-plant == post-revert, twice)
- `backend/app/services/harness/grounding.py` → `85869e18259c5f3aeb808778a9609472`
- `frontend/src/components/workflows/TemplateAttachSection.tsx` → `37181e61cb2afd979605d6467746dbc2`

## The re-derived `CLAUDE.md` ledger numbers

All three files fire G-5 and **all three were absent from the table** — the third, fourth and
fifth occurrence of the "a guardrail cannot see what is absent from its list" failure.

| File | commits | phases | lines | command |
|---|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 33 | 10 | 2055 | `git log --oneline -- <f> \| wc -l`; `wc -l <f>` |
| `backend/app/api/workflows.py` | 32 | 16 | 1719 → 1813 | as above + `git show 4bb9c1ac:<f> \| wc -l` |
| `backend/app/services/harness/grounding.py` | 15 | 4 | 1150 → 1186 | as above |

Phase lists via `git log --format=%s -- <f> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u`.

⚠ **One correction against the plan's own derivation.** The plan's `<guardrails>` table gave
`WorkflowBuilderPage.tsx` as *10 phases*; the sed recipe actually returns **eleven** buckets,
the eleventh being `260809` — a **quick task** (`1c58a3fb`), not a phase. The count of 10 is
right and the derivation is corrected beside it so the next reader is not surprised by their own
command. The same `quick` bucket appears on both backend files (`3781a3fe`), and neither plan
figure changes.

⚠ **The `2055` figure went stale inside this very task** — Task 3 edited that file after
`CLAUDE.md` was committed in Task 1. The row says so and carries the re-derive command, which is
the same self-staling this table has now documented three times about `WorkflowsPage.tsx`.

## Count-gate pin: **25 → 43**

Read off the gate's OWN reported `actual`, never predicted. Final gate:
`total 3604 · failed 0 · pinned total 3580`, **exit 0**, 68/68 pinned files present, no
per-file decrease. Run with `GSD_VITEST_MAX_WORKERS=2` per the Phase 193 measurement.

No `TARGETS` edit — `src/components/workflows` is already a directory entry. Two pre-existing
drifts (`ExternalActionSection.test.tsx` +9, `PhaseTimeline.test.tsx` +4) were left alone: they
are not this task's to absorb.

## D-5: did the user-JWT Storage read work live? — **NOT DETERMINED. Owed.**

**Stated plainly rather than claimed either way.** The route was written to D-5 (the read goes
through `get_user_supabase_client`, so `workspace_storage_select_own` is a second,
database-enforced boundary under the route's own fence, exactly as the sibling Phase 193 upload
door does for its write). **No fallback to `get_supabase` was made — and none was needed, because
no live probe was run.** Every backend test monkeypatches `resolve_template_source` and never
reaches Storage.

This is the single most likely live failure mode: **if the authenticated read is refused, every
template will read *"We could not read this template's fields"*** — which is an honest sentence
and a useless product. It is the first thing the manual check must settle.

## `getGroundingBundle`'s `templateAssetId` remains UNUSED by the app

D-1's recorded cost, restated so it cannot be lost: `getGroundingBundle(templateAssetId, …)` and
the `GroundingBundle.template_placeholders` field it populates are **not called or read by
anything after this task**. They are left in place, not deleted — removing a shipped typed seam
is a separate decision. Both `api.ts` and the backend route docblock say so at the seam itself.

## Deviations from Plan

**1. [Rule 1 — accuracy] The test docstring's RED-1 claim was corrected before commit.**
The first draft asserted the recording stub "logged the foreign asset id" as part of the observed
pytest failure. It did not — that assertion sits after the `pytest.raises` boundary and never ran.
Measured separately, corrected in place, and the correction is called out in the docstring rather
than silently patched.

**2. [Rule 1 — a test that cannot fail] A source-md5 test was written and then deleted.**
I drafted `test_source_files_are_the_ones_the_red_plants_were_reverted_into`, which `pytest.skip`s
whenever the hash differs — i.e. it can never fail, and proves nothing. Removed. md5 verification
belongs in the shell (and is recorded above), not in a suite where it reads as a guard.

**3. [Rule 3 — probe correctness] The probe was fixed, not reinterpreted** (double-prefixed router;
see above).

## Pre-existing failures — reported faithfully, NOT fixed (scope boundary)

`tests/test_182_grounding_bundle.py` — **2 failed, 52 passed** across the three neighbour suites
the plan named:

```
FAILED test_grounding_bundle_returns_server_sourced_palette
FAILED test_grounding_bundle_fields_come_from_the_bundle
  AssertionError: Extra items in the left set: 'kb_tools'
```

**Proved pre-existing, not assumed:** `git show 4bb9c1ac:backend/app/api/workflows.py | grep kb_tools`
returns `:563` and `:1002`, so the field was on the response model at this task's base commit, and
`git diff -U0` over my two backend files contains **zero** occurrences of `kb_tools`. This is
Phase-185-era rot in a test that was never updated. Out of scope; not touched.

`npx eslint src/pages/WorkflowBuilderPage.tsx` reports **1 pre-existing error** —
`react-refresh/only-export-components` at `:254` (`useCanvasGate`, whose own docblock explains the
deliberate export). My diff's first hunk is at line 666, so the line is unshifted and untouched.
`TemplateAttachSection.tsx` and `useTemplatePlaceholders.ts` lint **0/0**.

## Verification

| Gate | Result |
|---|---|
| `tsc -p tsconfig.app.json` | **33** — the baseline, unmoved (measured after Task 2 and again after Task 3) |
| Count gate (`GSD_VITEST_MAX_WORKERS=2`) | **exit 0**, `failed 0`, no `[count-decrease]` |
| `test_q5r_template_placeholders.py` | **14 passed** |
| Named backend files (q5r + 193 upload + 182 degradation + 182 validate) | **77 passed** |
| `PhaseFormPanel` / `WorkflowBuilderPage` suites | **53 passed** |
| `git diff --stat PhaseFormPanel.tsx` | **1 insertion, 0 deletions** — as specified |
| 25 pre-existing `TemplateAttachSection` cases | **unedited** — the only 3 deletions in the suite are preamble import/mock lines |
| `.find()` count in `WorkflowBuilderPage.tsx` | **1** (`grep 'kind === "template"'`) |

⚠ **No whole-backend-suite green is claimed.** `backend/tests/unit` carries known rot
(~62 failed / ~1986 passed) and the frontend has SEED-056. Only the named files were run.

## OWED — the manual check (I cannot drive a browser)

Not automatable and **owed, not claimed**. Run in this order:

1. **FIRST — the D-5 question.** Attach a real `.docx` carrying `{{ … }}` tokens through the
   Builder and confirm field names appear without a reload. **If instead every template says
   *"We could not read this template's fields"*, the user-JWT Storage read is being refused
   live** and the route needs the documented `get_supabase` fallback. This is the one check that
   can invalidate the feature.
2. **The reading that makes it worth building** — reload the page and confirm the fields are
   still there on a re-opened saved draft (no re-upload).
3. Attach a `.pptx` and confirm the **Word-only** sentence, not the no-fields sentence.

## Threat Flags

None. No new network surface beyond the one route in the register, no schema change, no new
dependency (T-q5r-SC honoured — nothing was installed).

## Self-Check: PASSED

All created files present; all three commits present on `worktree-agent-a2738175c818d691c`.
