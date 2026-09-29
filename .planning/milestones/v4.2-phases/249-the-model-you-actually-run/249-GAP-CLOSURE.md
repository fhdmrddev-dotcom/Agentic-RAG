# Phase 249 — Gap-closure round 1

**Date:** 2026-09-15 · **Trigger:** `/gsd:code-review 249` returned **2 BLOCKERS and 11 warnings**.
**G-7 status:** this is **round 1 of a permitted 2**. No new capability was introduced.

⭐ **Both blockers were VERIFIED BY DRIVING before a line was changed**, and both turned out to be
**regressions this phase itself introduced** — not pre-existing defects, not reviewer speculation.
⛔ *"A review is a CLAIM about code, not the code."* Each claim below was reproduced first.

---

## CR-01 — the judge picker offered options the server refuses with 400

**The claim:** `verified_models` changed from *built-ins* to *built-ins ∪ override rows*;
`SettingsPage` feeds that exact set to `JudgeModelPicker`; the judge validator on `PUT /settings`
is unchanged and uses the **sync** `get_model_capability`, which never reads the DB — so every
operator-added option is a guaranteed 400.

**Reproduced live, before the fix:**

```
candidate            : glm-4.7-flash     (an operator override row)
offered in picker    : true              (it is in verified_models)
PUT /settings status : 400
body                 : {"detail":"Unknown judge model: glm-4.7-flash"}
```

**Confirmed.** And it was **new** — before this phase, `verified_models` was built-ins only and
every option in that dropdown passed the validator.

**Fix — the reviewer's option (a), the smaller provable change.** A separate
`registry_models` field carries the validator's **exact** set (built-ins only); the picker reads
that. `verified_models` stays the union, because the chip genuinely needs the wider question.

**Driven after the fix:** `registry_models` = **61**, `verified_models` = **82**,
`glm-4.7-flash` present in the second and absent from the first.

⭐ **The lesson is not "add a field".** It is that **one name was answering two questions** —
*"may the judge run this?"* and *"should the chip fire?"* — and widening it for one silently broke
the other. That is the same shape as CR-02 below, in a different place.

---

## CR-02 — the phase silenced its own headline warning on the models it unblocked

**The claim:** `inferred_tools_lost` was computed only over ids **excluded from** `verified_models`.
An operator-added self-hosted row is *in* the union, so it was excluded — while resolving
`native_tools = False`, because the Add form leaves its tri-state on `unknown` (no family matches
for `lmstudio` / `custom`), the column stores NULL, and the runtime overlay falls back to the
provider inference.

**Reproduced live, before the fix** — a row added exactly as the UI adds one:

```
POST /admin/models  {"model_id":"cr02-probe-local","provider":"lmstudio"}   -> 200
in verified_models      : true
in inferred_tools_lost  : false        ⛔
resolved capability     : capability_source=db_override  provider=lmstudio  native_tools=False
```

**Confirmed, and it is the worst finding of the phase.** A model that **cannot call tools** got
**no marker on any surface** — and before this phase the Settings chip *did* fire for it, because
it was not a built-in. ⛔ **The phase whose goal is *"announces what it can and cannot do before it
is used"* removed the only announcement for the case it newly enabled.**

**Root cause, stated plainly: I fused two different questions.**

| Question | Drives |
|---|---|
| *Is this model REGISTERED?* | the `unverified` chip |
| *Will this model CALL TOOLS?* | the consequence |

An operator-added model is **registered** (no `unverified` chip — correct) and can still be
**tool-less** (must still warn — broken).

**Fix, three parts:**
1. `_tools_lost_model_ids()` — tool loss is computed from **resolved capability** over *every
   configured model*, mirroring `get_model_capability_async`'s overlay precedence (explicit stored
   value wins; NULL falls through to provider inference). Wire field renamed
   `inferred_tools_lost` → **`tools_lost_models`**, because the old name asserted the very thing
   that was wrong.
2. The chip's render guard is decoupled from `isUnverified` on **both** surfaces.
3. A **third** wording — `registeredButToolless()`, labelled **`no tools`** rather than
   `unverified`, because calling a model the operator entered "unverified" would be false.

**Driven after the fix, on the operator's real configuration:**

```
gap-probe-local (lmstudio, no native_tools)
  in verified_models   : true
  in tools_lost_models : true     ✅
tools_lost_models total: 13 -> 16
```

⭐ **That `+3` is the measurement that matters.** Three models on the operator's own machine were
being silenced by my first implementation, on top of the probe. The count is not cosmetic.

---

## Warnings fixed in this round

| # | Finding | Disposition |
|---|---|---|
| **WR-01** | `raise … from None` clears `__cause__` only; `__context__` still held the asyncpg error and its row-bearing `DETAIL:` line | **FIXED, and more strongly than proposed.** The exception is now **built** in the except arm and **raised outside it**, so no exception is active and *neither* slot is populated. The fence pins both, and the leak blob now greps `__context__` too. ⚠ Nothing leaked *today* — `traceback`/`logging` honour `__suppress_context__` — but the arm's comment stated an absolute, and the guarantee now matches the claim. |
| **WR-02** | The guard named 3 leaf classes; `Unique` / `ForeignKey` / `Exclusion` violations still hit the broad arm with `exc_info=True`, which logs the same row | **FIXED** — catch `IntegrityConstraintViolationError`, the family base (verified: all five are subclasses), plus `UndefinedColumnError` (which is not). The fence is parameterised over all six. ⚠ Side effect stated: a unique/FK violation on `app_settings` now answers 400 rather than 500. That table holds **one row keyed `'global'`**, so the case is close to unreachable — and *"the database refused your value"* is the honest reading either way. |
| **WR-03** | The `setup.py` comment claimed `SettingsWriteRefused` *"propagates… Do not fix it"*, while the `except Exception:` three lines down catches it | **COMMENT CORRECTED, code unchanged.** ⭐ The code was already right: the write is best-effort by design (the file is authoritative), and it does **not** report success — `setup_complete_persisted` stays `False` and the caller logs *"not persisted yet"*. **A comment that describes the opposite of the code it annotates is worse than no comment**, and it was mine. |
| **WR-05** | `ModelPillRow.toolsLostModels` was wired to nobody — Settings still showed only the benign copy | **FIXED** — `/settings` now carries `tools_lost_models` and `SettingsPage` passes it. Same defect as CR-02, one surface over. |
| **WR-06** | A **third** inline copy of the tooltip remained in `SettingsPage.tsx`, still saying `timeout=90s` — two elements above the one the phase corrected | **FIXED** — it reads the shared module. ⭐ **This is the most embarrassing finding in the set:** the phase's own SUMMARY claims it corrected a false number, and left another copy of that exact false number on the same screen. *A phase that claims to have fixed a false number must fix every copy of it, or the claim is the drift.* |
| **WR-08** | Two comments this phase placed were factually wrong about the code they annotate | **BOTH CORRECTED IN PLACE, not deleted** — `AddModelRequest`'s docstring still named `PROVIDER_ENDPOINTS` as its validator (*in the very phase that stopped reading it*), and the `import asyncpg` comment stated a mechanism that is not how `except` clauses work. |
| **WR-10** | `SettingsModelBadge.test.tsx` was edited to bind the new shared copy module but sat in **neither** count-gate knob | **FIXED** — pinned in TARGETS and BASELINE. The assertion guarding that module's wording was not executing under the gate. |

## Warnings triaged as DEFERRED — named, with reasons, not swept

| # | Finding | Why deferred |
|---|---|---|
| **WR-04** | `POST /setup/provider-key` checks only the bool, so a refusal escapes as an unhandled 500 rather than its worded one; `body.provider` is unvalidated | Real, but it is the **setup wizard**, not a MODEL-* surface, and the provider-validation half is a separate (pre-existing) question. → next phase touching `api/setup.py`. |
| **WR-07** | `SELF_HOSTED_PROVIDERS` in `ModelRegistryTab.tsx` is a **fourth** hand-typed backend mirror, unpinned by the new lockstep fence | ⚠ **Genuinely the same class this phase exists to close**, and deferring it is the uncomfortable call in this list. It drives only a helper *sentence*, so a drift degrades to a missing note rather than a broken door. → extend the lockstep fence to `_SELF_HOSTED_PROVIDERS` in the next phase that touches either file. |
| **WR-09** | The 400/500 split plus a verbatim `constraint_name` is a column/constraint oracle on `app_settings` | Operator-gated behind the audit floor; the schema is not secret and the value never appears. Defence-in-depth, not a live exposure. |
| **WR-11** | `ROUTING_PROVIDERS` is a third public name for a set `KNOWN_PROVIDERS` already derives from `_PROVIDER_BASE_URLS` | Fair. Both are **derived from the same dict**, so they cannot drift — which is the property that mattered. Consolidating names is a refactor, and this phase already declined the `MODEL_CAPABILITIES` seam for the same reason. |

---

## What this round says about the phase's own verification

⛔ **My self-verification passed this phase with both blockers present.** Every gate was green, six
fences were driven RED against plants, three scenarios were driven in a live browser — and none of
it caught either one. That is the argument for `DEBT-06` in a single sentence, and it is why the
close still reads `independent_review: owed` rather than treating this round as a substitute.

⭐ **What the review caught, the gates structurally could not.** CR-01 is a disagreement between
*two* components neither of whose tests are wrong. CR-02 is a warning that **correctly does not
fire** by its own implementation's logic. **No assertion about either surface in isolation would
have failed.** A green suite over a cross-surface contradiction is not a flaky gate — it is a gate
answering the question it was asked.


---

## Gates after the gap-closure

| Gate | Result |
|---|---|
| Backend unit | **71 failed / 4804 passed / 0 collection errors** — count AND **set** identical to the baseline's 71 names |
| Frontend count gate | total **8357** · pinned **7550** · **`failed 1`** — ⚠ see below |
| `tsc -p tsconfig.app.json` | **zero NEW** error files versus the 32-file base |

**The count arithmetic is clean and fully attributed:** pinned `7539 → 7550` and grand total
`8346 → 8357`, both **+11** — `MessageInput.unverified` 7 → 9 (the two CR-02 cases) plus
`SettingsModelBadge` adopted at 9. **No residual, and no per-file decrease.**

### ⚠ The one failing test, triaged by the protocol rather than by re-running

```
FILE: src/pages/WorkflowBuilderPage.canvas.test.tsx
TEST: 184-11 — … POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG : AssertionError: expected 0 to be greater than 0
```

Captured from the gate's **own persisted JSON, before anything was re-run**, exactly as the
triage rule requires. Then:

1. **`git diff --numstat abbaa2750..HEAD -- frontend/src/pages/ frontend/src/components/workflows/`
   is EMPTY.** This phase touched neither directory.
2. It is **`SEED-171`'s fifth named suite** (9 references in that seed).
3. The failure is its **recorded signature**, verbatim — `196-05` logged this same suite failing
   *its own positive control* with `AssertionError: expected 0 to be greater than 0`.

⛔ **The cap was not touched, and the run was not repeated to obtain a green.** `GSD_VITEST_MAX_WORKERS=2`
throughout. Per `SEED-171`'s own correction, adjusting the cap is **measured not to fix these**.

⚠ **Stated precisely: the suite is PROVABLY UNMODIFIED by this phase. It is not "fine."** One red
sample of a known-flaky suite is no more proof of guilt than one green sample is proof of
innocence.

⚠ **AND THE HONEST COMPARISON, because this phase's baseline was GREEN:** `249-GATE-BASELINE.md`
records `count gate OK` before the first edit, and the first close also read `count gate OK`. So
this is the **first red run of the phase**, on the **third** invocation of the same gate over a
tree whose workflow-builder code never changed. That is `SEED-171`'s thesis — *"the failing SET is
never the same twice, so there is no number to pin"* — and it is why the deterministic signals
(per-file deltas, fully attributed above) are what this close rests on.
