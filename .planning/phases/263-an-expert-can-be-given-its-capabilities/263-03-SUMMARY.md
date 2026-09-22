---
phase: 263-an-expert-can-be-given-its-capabilities
plan: 03
subsystem: api
tags: [fastapi, pydantic, typescript, http-422, ast-fence, extension-contract]

requires:
  - phase: 263-01
    provides: "filter_visible_skill_names — the ONE Expert-side skill-visibility predicate, with its load-bearing `bundle_id is not None` guard"
  - phase: 263-02
    provides: "author_skill_body / AuthoredSkillBody / SkillBodyAuthoringDisabled, and suggested_new_skills on ExpertDraftOutput"
provides:
  - "POST /experts and PATCH /experts/{id} refuse an unknown member skill with a named HTTP 422 carrying every unknown name"
  - "POST /experts/draft-skill-body — the body-authoring driver's route, behind require_expert_manage"
  - "Two DISTINGUISHABLE failure arms: 409 self_improve_disabled (operator flip) vs 503 skill_body_unavailable (honest failure)"
  - "ExpertMemberSkillsUnknownError / SkillBodyDisabledError / draftSkillBody / SuggestedNewSkill on the client"
  - "D-263-11 measured: the closed core is IDENTICAL at the phase base commit and at HEAD, keys as well as counts"
affects: [263-04, expert-authoring-studio, skill-proposals]

tech-stack:
  added: []
  patterns:
    - "Structured-refusal envelope: a DICT detail carrying `detail` + `error` + payload, mirroring entitlement_service"
    - "Client-side status-discriminated arm at the CALL SITE, never inside the shared handleResponse"
    - "Placement asserted by AST line index, not by eye, where an exception handler could swallow a status"

key-files:
  created:
    - backend/tests/unit/test_263_expert_save_refuses_unknown_skills.py
    - backend/tests/unit/test_263_draft_skill_body_route.py
  modified:
    - backend/app/api/experts.py
    - backend/app/models/expert.py
    - frontend/src/lib/api/experts.ts
    - backend/tests/unit/test_259_closed_core_inventory.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md

key-decisions:
  - "The 422 is raised ABOVE create_expert's try — proven by a plant that turned it into a 400"
  - "member_skills=None returns immediately: on PATCH it means 'not being changed', never 'emptied'"
  - "409 and 503 must not share a status code — a deliberate operator flip is not an outage"
  - "The client 422 arm discriminates on detail.error, never on the bare status"
  - "The plan's two single-line greps were replaced by AST/property assertions, because both read 0 against correct code"

patterns-established:
  - "Non-vacuity requires TWO differently-shaped plants, not one — Phase 259's F-2 is the precedent"
  - "A ledger row reading `young` while already at threshold is worse than an absent row"

requirements-completed: [PACK-15, PACK-16]

duration: ~95min
completed: 2026-09-21
---

# Phase 263 Plan 03: The save-time refusal, the body-authoring route, and the red line Summary

**`POST`/`PATCH /experts` now refuse an Expert naming a capability that does not exist with a named 422 that carries every unknown name; `POST /experts/draft-skill-body` mounts 263-02's driver behind `require_expert_manage` with an operator-refusal (409) that a UI can tell apart from an outage (503); and the closed core is measured byte-for-byte identical at the phase base commit and at HEAD.**

## Performance

- **Duration:** ~95 min
- **Tasks:** 3 (2 TDD, each RED-then-GREEN)
- **Files modified:** 9 (2 test files created, 4 source, 2 registers, 1 fixture)
- **Commits:** 6

## Task Commits

1. **Task 1 RED — the save-time refusal and its placement** — `ea90dab97` (test)
2. **Task 1 GREEN — refuse a save naming a capability that does not exist** — `acb63c4f7` (feat)
3. **Task 2 RED — the body-authoring route and its guard** — `a860b0021` (test)
4. **Task 2 GREEN — mount POST /experts/draft-skill-body** — `fdb08d25b` (feat)
5. **Task 3 — the client carrier and the red-line pin** — `965d5a08f` (feat)
6. **Task 3(h) — ledger hygiene** — `87f66307f` (docs)

## Worktree

The mandated `git reset --hard` **FIRED**, as the orchestrator predicted: the worktree arrived on the
default branch `5ff8c58466b21037edb2a842039c78617b6bcbb6`, not on this plan's base. Reset to
`8bff2747e13bbfe78d4bb9b7af2b65f0e2646503`, verified, tree clean. `bootstrap-worktree.sh` ran first,
before the HEAD assertion, and reported `BOOTSTRAP OK`.

---

## D-263-11 — the closed-core measurement

**The phase base commit was READ from `263-01-SUMMARY.md`, never re-derived** —
`48976e11e71a5986483546a5625e18064c3c474b`. Re-deriving it after wave 1 landed would have compared
HEAD against itself and the check would have passed vacuously.

**How the base was measured without touching the worktree.** `git archive 48976e11e backend` was
extracted into the scratchpad (`--strip-components=1`, keeping the path under Windows' 260-char
ceiling) and the suite run there with this worktree's venv interpreter. ⛔ No `git checkout -- <dir>`,
no blanket reset, no second worktree — the memory note that `git checkout -- <dir>` is *not* a restore
here (autocrlf moved 224 digests while `git status` read clean) makes the archive route the only safe one.

| Registry | Phase base `48976e11e` | HEAD `87f66307f` |
|---|---|---|
| `PHASE_TYPE_REGISTRY_ENTRIES` | **7** | **7** |
| `EMITTER_REGISTRY` | **1** | **1** |
| `_TOOL_REGISTRY` | **29** | **29** |
| `EXPERT_CORE_TOOLS` | **10** | **10** |
| `test_259_closed_core_inventory.py` | **6 passed** | **7 passed** (+ the new named assertion) |

⭐ **Stronger than the plan asked for: the KEY LISTS are identical too, not only the lengths.** Both
readings print
`['external_action','llm_agent','llm_batch_agents','llm_emit','llm_human_input','llm_single','programmatic']`,
`['render_template']`, the same 29 tool names and the same 10 core tools. A count alone would also
pass if a registry gained one entry and lost another.

⚠ **`STATE.md:82` records `EMITTER_REGISTRY` as 4. It is 1.** The test asserts 1 and passes at both
commits. Reported here and deliberately **not propagated** — a `4` sitting in a register is exactly
the figure a future phase would "restore".

### The two non-vacuity plants — differently shaped, per Phase 259's F-2

| # | Shape | Planted | Observed | Restored |
|---|---|---|---|---|
| A | dict literal | an 8th `PHASE_TYPE_REGISTRY_ENTRIES` key, `"expert_consult"` | `test_phase_type_registry_contains_zero_expert_executors` FAILED — *"Inventory drift: expected 7 phase type executors, got 8: ['programmatic', 'llm_single', 'llm_agent', 'llm_batch_agents', 'llm_human_input', 'llm_emit', 'external_action', 'expert_consult']"* | `phase_types.py` md5 `cad3130276f7b60202ae1b8c08c00a47` before and after |
| B | `register_emitter()` call | a second `EMITTER_REGISTRY` entry, `"bundle_emit"` | `test_emitter_registry_contains_zero_expert_emitters` FAILED — *"Emitter registry drift: expected 1 emitter, got 2: ['bundle_emit', 'render_template']"* | `emitters.py` md5 `5d7d227c42b96942bfa56f28852890ad` before and after |

Both printed their whole key list in the failure message, which is what makes the fence legible rather
than merely red. `git status --short` after both restores showed only this plan's two intended
modifications — nothing left behind.

**New assertion added to `test_259_closed_core_inventory.py`:** `skill_body_authoring`,
`draft_skill_body` and `author_skill_body` are absent as `_TOOL_REGISTRY` keys. That is the one way
this phase could have broken the red line — registering body authoring as a tool so the agent could
call it at will would take the registry to 30 and make it ENGINE surface.

---

## The 400-trap plant (T-263-17) — the finding that justifies the placement

`create_expert` wraps its service call in a bare `except Exception`, and **`HTTPException` subclasses
`Exception`**. Moving `_refuse_unknown_member_skills` one line down, inside the `try:`:

```
AssertionError: Expected the named 422 refusal, got 400:
{"detail":"Could not create expert bundle: 422: {'detail': \"1 of this Expert's capabilities do not
exist in your library: prisma-screening.\", 'error': 'expert_member_skills_unknown',
'unknown_skills': ['prisma-screening']}"}
```

**Observed status code under the plant: `400`.** Three cases went red (both POST refusal cases and the
placement fence); six stayed green — *which is the point*: a test asserting only "it refuses" would
have passed on the defect. Restored; `backend/app/api/experts.py` md5
**`e5fdd0a196e9a06c2843c0db616fe087` before and after**, identical.

⛔ The existing `except Exception` was **not** "improved". Widening it would touch every other failure
path in that endpoint — a separate concern. The correct placement needs no change to it at all.

⚠ **`update_expert` is ASYMMETRIC — it has no try/except at all.** The plan predicted this. The
placement was copied; the structure was not.

---

## Verification

| Check | Result |
|---|---|
| `test_263_expert_save_refuses_unknown_skills.py` | **9 passed** (plan asked ≥ 7) |
| `test_263_draft_skill_body_route.py` | **7 passed** (plan asked ≥ 4) |
| `test_259_closed_core_inventory.py` | **7 passed** |
| Expert-surface wave-merge sweep (15 files) | **110 passed** |
| Backend full `pytest tests/unit` at base | **72 failed**, 5350 passed, 2 xfailed, 2 xpassed |
| Backend full `pytest tests/unit` at HEAD | **71 failed**, 5368 passed, 2 xfailed, 2 xpassed |
| Set diff — NEW at HEAD | **0** |
| Set diff — GONE at HEAD | **1** (`test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`) |
| `npx tsc -p tsconfig.app.json --noEmit` base / HEAD | **72 / 72**, set diff **empty both directions** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | `count gate OK` — **total 8500 · failed 0 · pinned total 7746 · 297/297** |
| `node scripts/check-hot-file-ledger.cjs 263` | exit 1, **one** `[no-row]`: `ProposedSkillCard.tsx`, named by **263-04** — zero findings on this plan's surface |
| `node scripts/check-claude-md-size.cjs` | exit 0 — `114882 chars · 76.6% · headroom 35118` |
| `node scripts/check-seeds-register.cjs --phase 263` | `seeds register gate OK` — 310/310 parsed |

### ⚠ THE BASE MEASURED 72, ONE OVER THE CLAUDE.md CEILING — and it is INHERITED, not mine

This is the most important number in this summary and it deserves to be read carefully.

- The base run was launched **before this plan's first edit** and `grep -c "263_expert_save"` on its
  output returns **0**, so this plan's new files were provably NOT collected into it. It is a clean
  reading of `8bff2747e`.
- **72 failed / 5350 passed.** The orchestrator's brief said to expect **71** — the ceiling, with zero
  headroom.
- **HEAD reads 71 failed / 5368 passed.** The set diff says the extra base failure was
  `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`, and
  `git diff --stat <base>..HEAD -- backend/tests/unit/test_email_ingestion.py backend/app/services/email_ingestion_service.py`
  is **EMPTY**. So it is **provably unmodified by this plan** — a flake at the base that did not recur.
- `+18` passed is fully attributed: **9 + 7 + 1 = 17** new cases from this plan, plus the one flake
  that flipped back to green. No residual.

⭐ **This is the reason the plan mandated a FULL run.** Every targeted command in this plan was green
from the first invocation; only the full run could have shown a 72 at the base. Recorded as an
observation, never as proof of innocence: **one green sample of a flaky test is not proof that it is
stable.** The honest statement is that **this plan introduced zero new failures** and HEAD sits
exactly at the ceiling.

### The typecheck set diff

`base 72 → head 73 → head 72`. The intermediate `73` was **real and mine**, and it is recorded rather
than smoothed over: making `suggested_new_skills` required on `ExpertDraftOutput` produced
`TS2741` in `ExpertAuthoringStudio.test.tsx`, whose draft fixture predates 263-02. Fixed under
Rule 1 (see Deviations). ⛔ Never `npx tsc --noEmit` — that solution-style config checks zero files.

---

## Ledger hygiene (Task 3h) — TWO rows crossed G-5 in this one plan

Re-derived with CLAUDE.md's three-command recipe, **at HEAD, after the code commit**, never copied:

| File | Row said | **Re-derived** | Verdict |
|---|---|---|---|
| `backend/app/api/experts.py` | `6 / 3 / 398` | **`8 / 3 / 560`** | ⚠ STALE a 2nd time, **ONE PLAN** after 263-01 corrected it |
| `backend/app/models/expert.py` | `2 / 2 / 79` · `no (new)` · *young* | **`3 / 3 / 93`** | ⛔ **NOW FIRES** — present and reading `young` |
| `frontend/src/lib/api/experts.ts` | `2 / 2 / 186` · `no` · *young* | **`5 / 3 / 298`** | ⛔ **NOW FIRES** — present and reading `no` |

Zero six-digit dated-quick-task buckets in any of the three, so nothing needed subtracting.

⚠ **The plan said `api/experts.py`'s row reads the stale `1 / 1 / 175`. It did not — 263-01 had
already corrected it to `6 / 3 / 398` that same day, and it was stale AGAIN by the time I measured.**
Recorded because the *rate* is the finding: `+2` commits and `+162` lines inside one phase.

⭐ **The sharper finding: two rows crossed the threshold in this single plan, and BOTH were present
and reading `young` / `no`.** That is the state CLAUDE.md names as worse than an absent row — a row
that answers the auditor with a verdict and stops the audit. Neither the ledger gate nor the size gate
can detect it: the gate only asks whether a row EXISTS.

CLAUDE.md's abridged FIRING table and each file's `docs/HOT-FILE-LEDGER.md` section were updated in
the **same commit** (`87f66307f`). One disposition cell came in at 210 chars and was caught by
`check-claude-md-size.cjs` (`[disposition-too-long]`, cap 200) and trimmed — the guard fired for real.
Named seams recorded for all three files.

---

## Decisions Made

- **The refusal envelope mirrors `entitlement_service.py`** — a DICT detail carrying `"detail"`,
  `"error"` and `"unknown_skills"`. The `"detail"` key *inside* `detail` is load-bearing: the
  frontend's `handleResponse` reads exactly `err.detail?.detail`.
- **`unknown` is derived by SUBTRACTION from the caller's own input** (T-263-15). The payload echoes
  back only names the caller already submitted; it never enumerates the library.
- **`member_skills is None` returns immediately.** On PATCH, absent means "not being changed".
  Collapsing it to `[]` would run the check on every unrelated rename.
- **`bundle_id=None` on POST, the path id on PATCH.** Inverting either would break 263-01's born-for
  arm in one direction or admit every other user's private skill in the other.
- **409 and 503 may never share a status code.** D-263-14 gates only GENERATION, so the UI must be
  able to say *"your operator turned drafting off, write it by hand"* apart from *"try again later"*.
  Pinned by a case that asserts the two codes differ, not merely that each is what it is.
- **`handleResponse` was NOT widened.** Nine functions route through it. The arm is at the call site,
  following `toggleSkillOrgShared`. Proven: the diff for `experts.ts` removes **0** lines.
- **Wire types stayed in `lib/api/experts.ts`.** `frontend/src/types/index.ts` is byte-unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The studio's draft fixture lacked `suggested_new_skills`**
- **Found during:** Task 3, at the typecheck set diff
- **Issue:** Adding 263-02's now-required `suggested_new_skills` to the `ExpertDraftOutput` wire type
  turned `ExpertAuthoringStudio.test.tsx`'s pre-263 fixture into `TS2741`. Base 72 → 73 errors.
- **Fix:** Added `suggested_new_skills: []` to the fixture, with a comment recording *why* the field
  is required and why its absence does not surface as a `ValidationError` on the server path.
- **Verification:** tsc back to **72**, set diff empty both directions.
- **Committed in:** `965d5a08f`

**2. [Rule 3 - Blocking] Two of the plan's acceptance greps read 0 against CORRECT code**
- **Found during:** Tasks 2 and 3
- **Issue (a):** `grep -cE "async def draft_skill_body\(payload: SkillBodyDraftRequest,"` expects a
  single-line signature. The plan ALSO instructed me to *"copy `draft_expert`'s signature shape
  exactly"*, and that shape is **multi-line**. The two instructions contradict, and satisfying the
  grep would have meant deleting the load-bearing comment about the bare `*`.
  **Issue (b):** `grep -c "expert_member_skills_unknown" frontend/src/lib/api/experts.ts >= 2` assumes
  the 422 arm is inlined TWICE. Duplicating a discriminator in two functions is the exact shape
  CLAUDE.md records as a defect (mig 180: *"the defect WAS the duplication"*).
- **Fix:** Asserted the PROPERTIES the greps proxied for, which is strictly stronger than a text
  match. (a) A new AST case asserts the first parameter is named `payload` and annotated
  `SkillBodyDraftRequest`. (b) The arm is one helper, `throwIfMemberSkillsUnknown`; the equivalent
  measurement is `grep -c "throwIfMemberSkillsUnknown"` → **3** (1 declaration + 2 call sites).
- **Verification:** `test_263_draft_skill_body_route.py` 7 passed; `ExpertMemberSkillsUnknownError`
  greps **3**; `git diff` removes 0 lines from `experts.ts`.
- **Committed in:** `fdb08d25b`, `965d5a08f`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking).
**Impact on plan:** No scope creep. Deviation 2 REPLACED two acceptance criteria with stronger ones
rather than weakening them — writing code to satisfy a grep instead of satisfying the property is the
"green fence coexisting with the shipped defect" shape this project keeps paying for.

## Issues Encountered

- **The base backend baseline read 72, one over the zero-headroom ceiling.** Resolved by measurement,
  not assumption: the extra failure is in a file provably untouched by this plan and did not recur at
  HEAD. Documented above rather than quietly absorbed.
- **`git archive` needed POSIX paths for `tar -C`** — `tar` reads a leading `C:` as a remote host
  (`Cannot connect to C: resolve failed`). Use `/c/...`.
- **Provider-docs-first:** ⚠ Not applicable to this plan's surface — it adds no provider-facing
  behaviour (the provider call lives in 263-02's service, which this plan only mounts). Stated rather
  than claimed: Context7 MCP and the `ctx7` CLI do not exist in this environment and `npx --yes` is
  forbidden, so no provider documentation was read.

## Threat Flags

None. Every surface this plan adds is inside the plan's own `<threat_model>`:

- **T-263-14** (EoP on the new route) — mitigated: router-level `require_capability("experts")` plus
  `Depends(require_expert_manage)`, declared where the AST fence reads it, with a local restatement of
  that fence so a `*`-refactor fails here first.
- **T-263-15** (info disclosure via the 422) — mitigated by subtraction, as above.
- **T-263-16** (a client trusting its own fence) — mitigated: the server re-checks independently on
  both endpoints.
- **T-263-17** (the refusal degraded to a 400) — mitigated and RED-driven; see the plant.
- **T-263-18** (cost) — accepted, as planned; three gates named (`experts:manage`, the `experts`
  entitlement, FLAG-01).
- **T-263-SC** — held: **this plan installed nothing.** No `npm install`, no `pip install`.

## Next Phase Readiness (263-04)

Ready. What 263-04 consumes:

```ts
// frontend/src/lib/api/experts.ts
export interface SuggestedNewSkill { name: string; description: string; why_needed: string }
export interface AuthoredSkillBody { instructions: string; summary: string }
export class ExpertMemberSkillsUnknownError extends Error { readonly unknownSkills: string[] }
export class SkillBodyDisabledError extends Error {}
export async function draftSkillBody(payload: {
  skill_name: string; skill_description: string; why_needed: string;
  expert_name: string; expert_description: string;
}): Promise<AuthoredSkillBody>
// ExpertDraftOutput now carries: suggested_new_skills: SuggestedNewSkill[]
```

⛔ **THREE THINGS 263-04 MUST NOT BE SURPRISED BY.**

1. **The two `vi.mock("@/lib/api/experts", () => ({...}))` FACTORIES replace the whole module** —
   `ExpertAuthoringStudio.test.tsx` and `OrgExpertsTab.test.tsx`. Neither declares `draftSkillBody`,
   `ExpertMemberSkillsUnknownError` or `SkillBodyDisabledError`. Harmless today because no component
   imports them; **nine-suites-red the moment a consumer is wired**. Phase 196 measured exactly this
   (`failed 249` from mock factories missing a new export). Extend both factories in the same commit
   as the first consumer.
2. **`ProposedSkillCard.tsx` is the ledger gate's ONE remaining `[no-row]`.** It is named by
   `263-04-PLAN.md`, so `check-hot-file-ledger.cjs 263` will keep exiting 1 until 263-04 adds its row
   AND its section, in the same commit.
3. **Render `unknownSkills` as React text children** (T-263-19). No `dangerouslySetInnerHTML` was
   introduced and none should be: these are strings a user typed.

### Owed UAT (this plan's rows, needing a running stack)

| # | Row |
|---|---|
| U-05 | A direct API call (curl / REST client, **no browser**) to `POST /experts` with a phantom `member_skills` entry returns **422** with the names — the row that proves D-263-09's *"a UI-only fence is not a fence"*. |
| U-06 | The same call from a stale client that ignores the fence still cannot save; the evidence is the 422 body, quoted verbatim. |

Both are owed at 263-04's UAT session. **Stated as a decision, not as a claim that everything ran.**

---
*Phase: 263-an-expert-can-be-given-its-capabilities*
*Completed: 2026-09-21*
