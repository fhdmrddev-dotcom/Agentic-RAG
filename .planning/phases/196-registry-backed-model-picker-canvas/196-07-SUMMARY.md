---
phase: 196-registry-backed-model-picker-canvas
plan: 07
subsystem: chat-composer
tags: [chat, composer, model-selection, restore, G-5, count-gate, BUG-260718-04, D-18]
requires:
  - phase: 196-04
    provides: "the api.ts edits this plan's third touch of that file sits beside — confirmed present at HEAD before editing"
  - phase: 149
    provides: "load_all_model_overrides + the D-149-05 deprecated_models comprehension the new field was modelled on, and D-149-08's disabled_ids predicate it deliberately matches"
  - phase: 095.1
    provides: "the runs -> messages JOIN that stamps MessageResponse.model — the reason D-18 needs no storage, no schema change and no migration"
  - phase: 194.1
    provides: "the recorded ChatArea.tsx measurement (useState 7->7, useEffect 4->4) that a naive D-18 would have failed"
provides:
  - "GET /settings/providers -> disabled_models: the operator-disabled id set, from the already-fetched overrides dict"
  - "frontend/src/hooks/useComposerModel.ts — the composer's provider/model machine + the per-thread restore rung"
  - "deriveLastUsedModel / resolveRestoreTarget / applyRestoreInOrder — the pure, separately-testable derivation"
  - "ChatArea.tsx measuring useState 2 / useEffect 3 — five state hooks and one effect lighter"
  - "two suites adopted into the count gate (2 TARGETS entries + 2 BASELINE pins)"
affects:
  - "196-09 (owes hot-file ledger rows — D-23; frontend/src/lib/api.ts is ABSENT and FIRES at 97 phases, backend/app/api/settings.py ABSENT at 16, scripts/vitest-count-gate.cjs still ABSENT as 196-05 flagged, and ChatArea.tsx's existing row is now stale)"
  - "phase verification (G-4 row U-C1 — the across-REFRESH claim is NOT provable in jsdom and is owed to Chrome MCP)"
tech-stack:
  added: []
  patterns:
    - "G-5 honoured by REDUCTION rather than by argument: the seam was chosen so the guarded file's hook counts go DOWN, and the arithmetic is the acceptance bar"
    - "an ordering guarantee extracted into a pure function purely so the SEQUENCE is observable — React batching makes an end-state assertion vacuous against a reversed implementation"
    - "a restore modelled as a SEED with a closing window (once per thread, and closed by any deliberate user choice) rather than as a policy that re-asserts itself"
    - "a stale measurement in a comment corrected in place, because on a ledger file the measurement IS the guardrail"
key-files:
  created:
    - backend/tests/test_196_providers_disabled_models.py
    - frontend/src/hooks/useComposerModel.ts
    - frontend/src/hooks/__tests__/useComposerModel.test.ts
    - frontend/src/components/chat/__tests__/ChatArea.model.test.tsx
  modified:
    - backend/app/api/settings.py
    - frontend/src/lib/api.ts
    - frontend/src/components/chat/ChatArea.tsx
    - scripts/vitest-count-gate.cjs
key-decisions:
  - "The plan's stated REASON for shipping disabled_models as a wire field is factually WRONG on this tree and the field was shipped anyway on a different, measured justification. _build_providers DOES filter disabled ids out of p.models (D-149-08, user_settings.py:712-713), and load_app_settings_async warms the all-rows cache before it runs — so the plan's 'a provider's models list is NOT filtered by registry enabled' is refuted. The field still earns its place: the restore's INPUT is a message from history, not the offered list, so a membership test conflates 'operator disabled it' with 'this provider never offered it', and D-18 asks for D-07's rule BY NAME."
  - "The restore is a SEED with a closing window, not a policy. It fires at most once per thread AND is closed by any deliberate setSelectedModel / handleProviderChange. Without that second condition a thread with nothing to restore from would have the operator's fresh pick overwritten the moment the assistant's reply landed carrying a different model — reintroducing the exact class of defect (a control that changes under you) this plan exists to remove."
  - "applyRestoreInOrder is a separate exported function rather than two inline setState calls, solely so the ORDER is observable to a test. React batches the calls, so an end-state assertion would pass against a reversed implementation right up until handleProviderChange clobbered the restored model in production."
  - "resolveRestoreTarget refuses on TWO independent grounds with different owners — disabled (D-07's set) and not-offered-by-any-provider — rather than collapsing them. The second is what stops the composer rendering a selection the <select> has no option for."
requirements-completed: [BUG-260718-04]
duration: ~55min
completed: 2026-08-18
---

# Phase 196 Plan 07: The Per-Thread Model Restore Summary

**A chat thread now opens with the model it was actually using — derived from its own
run-backed history, with no new storage — and the file that got the feature came out of it
five state hooks lighter than it went in.**

## Performance

- **Duration:** ~55 min (bootstrap → SUMMARY commit)
- **Tasks:** 3/3
- **Files created:** 4 · **Files modified:** 4
- **Commits:** `dd5e4728` · `05b743b8` · `3958d7f8` · `03b4202a`
- **Deleted files across the plan:** none (`git diff --diff-filter=D` empty on every commit)

## The `ChatArea.tsx` triple at three points — the G-5 claim, PROVEN not asserted

The plan required this measured, not argued. All four figures re-derived with `grep -c` on
the file itself at each point, never copied forward:

| | pre-Task-2 | post-Task-2 | post-Task-3 | bar |
|---|---|---|---|---|
| `grep -c 'useState[(<]'` | **7** | **2** | **2** | 7 → 2 ✅ |
| `grep -c 'useEffect('` | **4** | **3** | **3** | 4 → 3 ✅ |
| `grep -c 'onStop'` | **0** | **0** | **0** | stays 0 ✅ |
| `grep -c 'useComposerModel'` | 0 | **2** | **2** | exactly 2 ✅ |
| `wc -l` | 587 | 571 | 571 | — |

**The third column is the one that matters.** The feature added no hook to the guarded file:
`useState` and `useEffect` are identical post-Task-2 and post-Task-3. That is the entire
point of having taken the seam first — a naive D-18 would have written the restore effect
into `ChatArea.tsx` and taken `useEffect` **4 → 5**, failing the measurement Phase 194.1
recorded in the ledger as its own honouring test.

⚠ **`grep -c 'useComposerModel'` read 3, not 2, on the first attempt** — the 187-24 trap that
plan 196-04 hit three times and 196-05 hit twice. The third occurrence was my own explanatory
comment naming the hook. **Fixed by REWORDING THE PROSE, never by waiving the criterion**; the
comment now says so explicitly, so the next person does not re-add the token.

## The RED output, verbatim

Both suites were driven RED before any implementation existed.

`useComposerModel.test.ts` — every export absent:
```
 Test Files  1 failed (1)
      Tests  17 failed (17)
```

`ChatArea.model.test.tsx` — **1 failed / 1 passed, and the split is the point**:
```
 × shows the last run-backed message's model, NOT the global default
 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```
The passing one is the **CONTROL**, which asserts today's shipped global-default behaviour.
A well-formed RED here is the feature case failing while the control passes — if both had
failed, the harness would have been the suspect rather than the missing feature.

⚠ **The first two RED attempts on the integration file failed for HARNESS reasons and were
NOT accepted as RED.** A `vi.mock` factory is hoisted above every top-level binding, so
referencing a `const` inside it threw a TDZ `ReferenceError` and the suite reported
`no tests` — which is not a failing assertion, it is a suite that never ran. Then
`scrollIntoView` (unimplemented in jsdom) threw the moment a thread had any message. Both were
fixed in the harness and recorded in the file, because *"it went red"* is worthless if it went
red before reaching the assertion.

## GREEN, and each suite's case count

```
 Test Files  2 passed (2)
      Tests  19 passed (19)
```

| Suite | Cases | What it owns |
|---|---:|---|
| `src/hooks/__tests__/useComposerModel.test.ts` | **17** | the whole derivation — every `<behavior>` bullet |
| `src/components/chat/__tests__/ChatArea.model.test.tsx` | **2** | does the value reach the control an operator looks at |
| `backend/tests/test_196_providers_disabled_models.py` | **7** | the wire contract for the disabled set |

All eight `<behavior>` bullets are covered, and the ordering bullet is asserted as a
**sequence** (`expect(order).toEqual(["provider:openai", "model:gpt-5.5"])`) on the exported
pure function the hook itself calls — not as an end state, which React batching would make
vacuous.

## The count gate — verdict line verbatim, with per-file deltas

**Run 1, BEFORE the pins** — this is where the `actual` column comes from, and the plan
forbids taking these numbers from any document, including itself:

```
  ChatArea.model.test.tsx                       —       2     new
  useComposerModel.test.ts                      —      17     new
  -------------------------------------------------------------
  total                                      4184    4277     +93
  total 4277  ·  failed 0  ·  pinned total 4184
count gate OK — 87/87 pinned files present, no per-file decrease, 0 failing.
```

**Runs 2 and 3, WITH the pins** — identical to each other:

```
  useComposerModel.test.ts                     17      17       0
  ChatArea.model.test.tsx                       2       2       0
  -------------------------------------------------------------
  total                                      4203    4277     +74
  total 4203  ·  failed 0  ·  pinned total 4203
count gate OK — 89/89 pinned files present, no per-file decrease, 0 failing.
```

Against the wave-3a close (`total 4258 · pinned 4184 · 87/87`) this plan takes the grand
total to **4277**, the pinned total to **4203** and pinned files to **89/89** — `+19` pinned
cases, exactly this plan's two suites, and `+2` pinned files. **A growing total is the gate
WORKING** — its contract is no per-file DECREASE and zero failing, never a fixed number.

The two `— new` rows in run 1 are the proof the suites RAN before they were pinned, which is
the `TARGETS`-vs-`BASELINE` distinction the script records as a rule. Both suites also appear
by name in the gate's own printed `running:` command line, so "it was adopted" is observed
rather than inferred.

**The gate edit is purely ADDITIVE beside 196-05's entries, as instructed.** Two `TARGETS`
lines appended after `useModelRegistry.test.ts`; two `BASELINE` keys appended after
196-05's three. Nothing there was restructured, renumbered or removed —
`git diff scripts/vitest-count-gate.cjs` shows **zero `-` lines**.

### SEED-171 triage

**Not applicable — no gate run reddened.** All three runs read `failed 0` first time, and none
of the four known-flaky suites (`WorkflowsPage.test.tsx`, `library/WorkflowCard.test.tsx`,
`WorkflowBuilderPage.session.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`) failed.
`GSD_VITEST_MAX_WORKERS=2` on every vitest and gate invocation in this plan; the cap was never
touched. ⚠ **Three green samples are not a claim that the flake is resolved** — SEED-171's own
finding is that clean and red runs both occur on byte-identical trees, so this is recorded as
an observation, not a clearance.

## Verification

| Check | Result |
|---|---|
| `pytest tests/test_196_providers_disabled_models.py -q` | **7 passed** |
| `pytest tests/ -q` (full backend) | **211 failed / 4043 passed / 1 error** |
| ↳ vs recorded baseline (211 failed / 4036 passed / 1 error) | **no new failures**; `+7` passed = exactly this plan's new file; the 1 error is the same pre-existing `test_077_cross_cancel.py` |
| `npx tsc --noEmit -p tsconfig.app.json` | **33 errors — IDENTICAL to the wave-1/2/3a baseline; ZERO in any file this plan touched** |
| `vitest run src/components/chat` (pre-Task-2) | 22 files / **241 passed** |
| `vitest run src/components/chat` (post-Task-2) | 22 files / **241 passed** — no per-file decrease |
| `vitest run src/components/chat src/hooks` (post-Task-3) | 30 files / **382 passed**, 0 failing |
| `node scripts/vitest-count-gate.cjs` ×3 | **count gate OK · 4277 · failed 0 · 89/89** |
| `npx eslint` on all four touched frontend files | **0 errors**, 1 warning — pre-existing (`useLayoutEffect` / `setViewingThread`, untouched) |
| SC#3 fence: `git diff --name-only` contains `SettingsPage.tsx` or `ModelPillRow.tsx` | **NO** — seven paths total, neither present |
| `verified_models` / `deprecated_models` changed | **NO** — `deprecated_models` byte-unchanged and pinned by its own adversarial case |

⚠ **`npx tsc --noEmit -p tsconfig.app.json` does NOT exit 0, and this plan's acceptance
criteria asking for exit 0 are UNREACHABLE on this tree.** Waves 1, 2 and 3a each recorded the
same 33-error baseline before this plan began. The honest bar is per-file and it is clean:
`tsc … | grep -E 'ChatArea\.tsx|useComposerModel|lib/api\.ts'` → **no output**. The four hits
under `grep 'ChatArea'` are all in `ChatAreaMode.test.tsx`, a different file, pre-existing, and
about `MessageInput` readonly-array props this plan never touched.

### The mechanical fences from the plan's acceptance criteria

| Grep | Target | Required | Measured |
|---|---|---|---|
| `disabled_models` | `backend/app/api/settings.py` | ≥ 2 | **2** |
| `enabled_model_allowed_set` | `backend/app/api/settings.py` | = pre-plan value | **1 — unchanged** |
| `INSERT INTO\|UPDATE model_capabilities` | the new backend test | 0 | **0** |
| `useState[(<]` | `ChatArea.tsx` | 2 | **2** |
| `useEffect(` | `ChatArea.tsx` | 3 | **3** |
| `onStop` | `ChatArea.tsx` | 0 | **0** |
| `useComposerModel` | `ChatArea.tsx` | exactly 2 | **2** (was 3 — see above) |
| `unknown` | `useComposerModel.ts` | ≥ 1, compared against | **4**, and compared: `if (model === UNKNOWN_MODEL) continue` |
| `disabled` | `useComposerModel.ts` | ≥ 1, from `getProviders` | **12**, sourced from `disabled_models` on that payload |
| `allowed_models` | `useComposerModel.ts` | not used | **0** (see Deviations) |

## Deviations from Plan

### 1. [Rule 1 — Correction] The plan's stated REASON for the wire field is REFUTED on this tree

- **Found during:** Task 1, reading `_build_providers` before writing the handler change.
- **The plan says, verbatim:** *"The `configured` comprehension filters only on
  `if p.api_key` — a provider's `models` list is the OPERATOR's configured list and is NOT
  filtered by registry `enabled`. That is why the enabled check needs a wire field rather
  than a membership test."*
- **Measured, and it is not true.** `_build_providers` (`user_settings.py:712-713`, D-149-08)
  ends with `if (disabled_ids) models = models.filter(...)` applied to the WHOLE assembled
  list, and `load_app_settings_async` (`:947-954`) **warms the all-rows override cache
  immediately before** the sync builder runs, precisely so that filter can see disabled rows.
  `GET /providers` is on that async path. So on this tree a disabled model **is** excluded
  from `p.models`.
- **The field was shipped anyway, on a justification that survives measurement.** Three
  reasons, none of which is the plan's:
  1. **The restore's INPUT is a message from HISTORY, not the offered list.** A membership
     test against `p.models` conflates *"the operator disabled it"* with *"this provider
     never offered it"* / *"it belongs to another provider"*. Those are different facts and
     D-18 asks for D-07's rule **by name**, not for something that happens to correlate.
  2. **The existing filter is CACHE-WARMTH dependent.** `disabled_ids` is read from the
     module-level `_all_model_overrides_cache`, not from a fresh query — the sync
     `load_app_settings()` path does not warm it, and the cache carries a 30s TTL. The
     explicit field is computed from the dict the handler itself just awaited.
  3. It costs one comprehension over an **already-fetched** dict — no new read, import or
     cache — and it makes the client able to state which rule it applied.
- **Recorded rather than smoothed over** because the plan's sentence would otherwise be
  inherited by the next reader as a measured fact about `_build_providers`, which it is not.
- **Files:** `backend/app/api/settings.py`
- **Commit:** `dd5e4728`

### 2. [Rule 2 — Missing critical] The restore would have clobbered a deliberate user choice

- **Found during:** Task 3, while designing the effect's re-entry conditions.
- **Issue:** *"restore once per thread"* alone is not sufficient. A thread with **nothing to
  restore from** never marks itself settled (correctly — messages arrive asynchronously, so
  "no answer yet" must not be mistaken for "no answer ever"). The operator picks a model and
  sends. The assistant's reply lands carrying a model — possibly a different one, e.g. after a
  disabled-model fallback — the effect re-evaluates, now finds a target, and **overwrites the
  pick the operator just made.**
- **Why this is Rule 2 and not polish:** a control that silently changes what the user
  selected is the precise defect class `BUG-260718-04` reports. Shipping the fix with a new
  instance of the same failure mode would be a net loss.
- **Fix:** the seeding window is closed by a deliberate choice as well as by a restore. Both
  `setSelectedModel` (wrapped as `chooseModel`) and `handleProviderChange` call `settle()`.
  Pinned by its own case — *"does NOT re-clobber a deliberate user choice when a later message
  arrives"* — which drives the exact sequence and fails without the wrapper.
- **Files:** `frontend/src/hooks/useComposerModel.ts`
- **Commit:** `03b4202a`

### 3. [Rule 1 — Bug] A Phase 194.1 comment in `ChatArea.tsx` still asserted `7 / 4`

- **Found during:** Task 2, after the counts moved.
- **Issue:** a JSX comment read *"which is why this file's `useState` / `useEffect` counts are
  unmoved at 7 / 4."* True when written; false the moment this plan landed.
- **Why it is a bug and not a typo:** on this file the measurement **is** the guardrail. The
  ledger's own most-repeated finding is that a stale figure answers the next auditor with a
  number that was true once and **stops the audit** — worse than an absent one.
- **Fix:** corrected in place, with the superseded figure preserved beside the new one and an
  explicit instruction to re-derive rather than copy forward.
- **Commit:** `05b743b8`

### 4. [Rule 3 — Blocking] Two harness gaps in the integration suite, and one test error of mine

- **`vi.mock` hoisting:** the factory is hoisted above every top-level binding, so referencing
  a `const` inside it throws a TDZ `ReferenceError` and the suite reports `no tests` rather
  than a failing assertion. The id is now spelled as a literal, with the reason in the file.
- **`scrollIntoView` / `TooltipProvider`:** jsdom implements no layout, and an ASSISTANT
  message renders run chrome reaching for a Radix `Tooltip`. `ChatAreaBanner.test.tsx` never
  hit either only because it renders an EMPTY thread. Both stubbed in the harness — **not**
  guarded in production code.
- **My own test error:** the provider-switch case asserted `claude-5-haiku` where
  `handleProviderChange` correctly resets to `models[0]` = `claude-5-sonnet`. **The
  implementation was right and the test was wrong**; the test was fixed and now asserts both
  `ANTHROPIC.models[0]` and the literal, with a note saying so.
- **Commits:** `3958d7f8`, `03b4202a`

### 5. [Rule 3 — Blocking] `allowed_models` in prose would have tripped a future grep

- Naming the forbidden identifier in the docblock left `grep -c 'allowed_models'` at **1** on
  a file whose whole point is that it does not use it. Reworded to name the concept without
  the token, with a sentence saying the omission is deliberate. Now **0**.
- **Commit:** `03b4202a`

### Not a deviation — the worktree forked from the WRONG base

`git merge-base HEAD cd1690cc` returned `3781a3fe`, not the dispatched SHA. Corrected with the
sanctioned startup `git reset --hard cd1690cc…` and re-verified before any work. Recorded
because this project's memory flags it as a recurring worktree failure, and it would have
silently built this plan on the wrong tree.

## What this plan did NOT do, and cannot prove

- ⚠ **"A thread restores its model across a page REFRESH" is NOT PROVEN and is not provable
  here.** jsdom has no page reload; a hook test exercises a derivation, never a lifecycle.
  Both suites prove *which model a thread resolves to*, not *that it survives F5*. That claim
  is **G-4 row U-C1** in `196-VALIDATION.md`, owed to Chrome MCP at phase verification, and a
  green run here must not be read as discharging it. The bug report's own close condition is
  *"restores its last-used model across navigate AND refresh"* — **navigate is covered by the
  per-thread re-restore case; refresh is owed.**
- **The composer's OFFERED list is deliberately not filtered by this plan.** The restore is
  made honest; which models the picker offers belongs to the deferred app-wide sweep. A
  disabled model is refused as a *restore target* and is not otherwise touched here.
- **No operator ever saw this surface.** The acceptance bar was the shipped composer's own
  behaviour, which is defensible for a change that adds no chrome — the Model pill renders
  exactly as before, with a different id in it.
- **`BUG-260718-04` is left at `status: folded`, not flipped to `closed`.** Its frontmatter is
  untouched by this plan. Flipping it requires the refresh row above, and this project has a
  recorded lesson that a bug's `status:` frontmatter IS the routing index — prose claiming
  closure inside a `folded` record is invisible.

## G-5 / D-23 note — FOUR touched files, and TWO of them are ABSENT from the ledger

Triples RE-DERIVED at close with CLAUDE.md's own recipe (six-digit dated quick-task buckets
excluded), never copied forward. These figures INCLUDE this plan's own commits:

| File | commits / phases / lines | In ledger? | G-5 |
|---|---|---|---|
| `frontend/src/lib/api.ts` | **170 / 97 / 6154** | ⚠ **NO** | ⚠ **FIRES — HARDEST IN THE REPO** |
| `scripts/vitest-count-gate.cjs` | **99 / 16 / 3181** | **NO** | **FIRES** (196-05 already flagged) |
| `backend/app/api/settings.py` | **30 / 16 / 616** | ⚠ **NO** | ⚠ **FIRES** |
| `frontend/src/components/chat/ChatArea.tsx` | **63 / 30 / 571** | yes — row reads `61 / 29 / 587` | **FIRES** — honoured by REDUCTION (this plan) |

⚠ **`frontend/src/lib/api.ts` MEASURES 97 PHASES AND HAS NO LEDGER ROW.** CLAUDE.md's table
calls `backend/app/api/threads.py` at **76 phases** *"the hottest file in the repository"* —
**that claim is refuted by measurement.** `api.ts` is hotter by 21 phases and is more than four
times the size (6154 lines vs 1273). It has been invisible to its own guardrail for its entire
life, on a tree where three plans of THIS phase alone edited it.

**The 97 is robust to the recipe's known noise.** The bucket list contains sixteen bare
two-digit tokens (`03 07 08 11 12 13 15 16 27 29 31 32 46 48 49 56`) which may be early-numbering
phases or subject-line false positives. **Discarding all sixteen still leaves 81** — above
`threads.py`'s 76 either way. Both figures are published so the next reader can re-derive rather
than trust.

**Plan 196-09 owes rows AND `docs/HOT-FILE-LEDGER.md` detail sections under the same-commit
sync rule for all three absent files, and owes a RE-DERIVE of `ChatArea.tsx`'s existing row**,
which this plan made stale the moment it committed — the ledger's own most repeated finding,
happening again, on schedule.

**G-5 is honoured for this plan on every one of the four:**
- `ChatArea.tsx` — by **REDUCTION**, the arithmetic above.
- `scripts/vitest-count-gate.cjs` — **purely additive**; `git diff` shows zero `-` lines.
- `backend/app/api/settings.py` — one comprehension and one return key, inside the handler
  that already performed exactly that read.
- `frontend/src/lib/api.ts` — one optional field on one existing return type.

`frontend/src/hooks/useComposerModel.ts` is at 0 phases and owes a ledger row the moment it
reaches a third. It is the one to watch: it is now the single home of the composer's
provider/model machine, and any future model-selection work returns to it.

## Known Stubs

None. No placeholder values, no hardcoded empties flowing to UI, no unwired data source.
`disabled_models` is computed from real override rows; the restore reads real
`runs.model`-stamped messages; the hook's `status` has all three arms exercised. The
`?? []` defaults are back-compat for an older backend — an empty registry answers `[]`, pinned
by its own case — not placeholders.

## Threat Flags

None. No new network egress (the hook reuses the existing `getProviders` call — no new
endpoint, no new request), no new file access, no schema change, no migration, no package
installed (`T-196-SC` — accept, discharged).

The plan's register is discharged as written:

| Threat | Disposition | Discharged by |
|---|---|---|
| `T-196-CMP1` (a control that lies) | mitigate | the restore + the ORDER assertion on `applyRestoreInOrder`, asserted as a sequence not an end state |
| `T-196-CMP2` (restoring a disabled model) | mitigate | `resolveRestoreTarget`'s disabled refusal, against a set built with `_registry_row` semantics — `grep 'allowed_models'` → 0 |
| `T-196-CMP3` (the new field discloses disabled ids) | accept | unchanged: `deprecated_models` already ships the analogous set on the same payload to every chat user; no key, endpoint or reason string travels — the projection is bare ids |
| `T-196-CMP4` (a failed read as an empty success) | mitigate | `status: "failed"` with its own case asserting `status !== "ready"` |
| `T-196-CMP5` (the extraction) | mitigate | Task 2 shipped separately and behaviour-preserving; chat suites identical at 22/241 across the move; `onStop` fence re-asserted after BOTH tasks |

## Self-Check: PASSED

- `backend/tests/test_196_providers_disabled_models.py` — FOUND
- `frontend/src/hooks/useComposerModel.ts` — FOUND
- `frontend/src/hooks/__tests__/useComposerModel.test.ts` — FOUND
- `frontend/src/components/chat/__tests__/ChatArea.model.test.tsx` — FOUND
- commits `dd5e4728`, `05b743b8`, `3958d7f8`, `03b4202a` — all FOUND in `git log`
- TDD gate sequence present in log order for Task 3: `test(196-07)` (`3958d7f8`) →
  `feat(196-07)` (`03b4202a`). No REFACTOR commit — none was needed.
- `.planning/STATE.md` / `.planning/ROADMAP.md` — deliberately **UNTOUCHED**
  (orchestrator-owned). `git diff --name-only` against the base names eight paths, none
  under `.planning/` except this summary.
