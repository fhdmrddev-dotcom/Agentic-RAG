# Phase 187 — deferred items (out-of-scope discoveries)

Logged by executors during execution. Not fixed in the plan that found them.

---

## D-ITEM-01 — `npx tsc -b` is NOT clean at HEAD (33 pre-existing errors)

**Found by:** plan 187-04, task 1 (2026-08-02)
**Status:** deferred — out of scope, zero delta from this phase so far

`187-RESEARCH.md:1769` and every 187 plan's acceptance criteria state *"`npx tsc -b`
exits 0"*. **Measured: it exits 2 with 33 `error TS` lines.** The claim was inherited,
never run. (The v3.3 lesson it cites — `tsc -b` ≠ `--noEmit` — is real; the *clean*
part is not.)

**Zero of the 33 errors are in `src/components/workflows/`.** Owners:

| Area | Sample |
|---|---|
| `src/pages/SettingsPage.tsx` / `.test.tsx` | `SettingsUpdate` missing `web_search_enabled`; `FullAppSettings` optional-vs-required drift |
| `src/providers/OrgProvider.test.tsx` | `OrgPermissions.can_manage_sso` missing from a test fixture |
| `src/providers/StreamsProvider.tsx` | unused `getActiveRuns` (TS6133) |
| `src/stores/streamsStore.ts` | `StateCreator` / `viewedThreadId: null` widening |

**How 187 plans should read the criterion:** treat it as *"`tsc -b` produces no NEW
error, and none inside the files the plan touches"* — measure the count before and
after (`npx tsc -b 2>&1 | grep -c 'error TS'`) rather than gating on exit 0, which
cannot pass today for reasons no 187 plan owns.

**Re-open trigger:** a dedicated frontend type-hygiene phase, or the first 187 plan
that touches `SettingsPage` / `StreamsProvider` / `streamsStore` and can fix its own
row cheaply.

---

## D-ITEM-02 — `scripts/vitest-count-gate.cjs` fails on WHOLE-GLOB concurrency flake

**Found by:** plan 187-16, post-task-2 verification (2026-08-02)
**Status:** deferred — out of scope, not caused by 187-16

The count gate runs the whole Wave-0 blast radius in one vitest invocation and reports
`failing-tests`. Measured on two consecutive runs of the same tree: **8 failed, then 7
failed** — a differing count with no edit between them, which is the signature of
cross-file interference, not a deterministic break.

| File | Failing cases |
|---|---|
| `PublishGauntlet.test.tsx` | 5 (the form / verdict / judge-wall block) |
| `WorkflowCanvas.test.tsx` | 2 (`has no axe violations …`) |

**Evidence it is not 187-16's:** both files pass ISOLATED; both pass run together; both
pass run together **with** `SeedReceipt.test.tsx` (128 passed). The 5-file consumer set
named in 187-16's verification is 447 passed / 0 failed. Per-file counts only grew
(`SeedReceipt.test.tsx` 33 → 47, `definitionOps.test.ts` 223 → 227), and neither file is
in the gate's `BASELINE` map, so no pin moved.

**How 187 plans should read it:** the plan-level verification blocks already say to run
the consumer set ISOLATED "never the full frontend suite, which is measured flaky at
42–49". The gate's `failing-tests` reason inherits that flake; its per-file COUNT
reasons remain trustworthy and are the part D-184-08 actually pins.

**Re-open trigger:** a test-infra phase that isolates the `axe` and `PublishGauntlet`
suites (e.g. `poolOptions.threads.singleThread` or per-file environments), or the first
plan whose own changes make the gate red in isolation.
## D-ITEM-187-20-01 — PublishGauntlet.test.tsx parallel-run flake (found by plan 187-20)

`node scripts/vitest-count-gate.cjs` exits 1 with a single `[failing-tests]` reason. Two cases
in `frontend/src/components/workflows/PublishGauntlet.test.tsx` fail only under the full
parallel blast-radius run:

- `the 4 HTTP outcomes each render distinctly`
- `named_failures key-detection: a MIXED list (lint dict + bare string) renders the lint row (lowercase code) AND the bare string as a block — the verdict is a block, never a pass`

PROVED PRE-EXISTING, not assumed: the four files plan 187-20 edits were restored to
`debced07~1` and the gate re-run — total 2075, failed 1, same two cases. The file passes
GREEN in isolation and the failure count varies run to run (2, then 1). It imports nothing
from `definitionOps` or `SeedReceipt`.

Not fixed: outside plan 187-20 scope. Owner: whichever phase next touches PublishGauntlet,
or a dedicated flake-hunt. The gate reports no `[count-decrease]`, no `[missing-file]` and
no `[total-below-baseline]`, so it is not masking a coverage loss.

### RECURRENCE, plan 187-28 (2026-08-04) — same two cases, and PROVED not attributable

Plan 187-27 recorded that this flake "did not recur" on its gate sample. It recurs at
187-28 on both samples, with **exactly the same two case names** as above:

| sample | `failed` | which file |
|---|---|---|
| `node scripts/vitest-count-gate.cjs`, run 1 | 1 | (reason `[failing-tests]`) |
| `node scripts/vitest-count-gate.cjs`, run 2 | 2 | (reason `[failing-tests]`) |
| the TARGETS glob re-run with `--reporter=json` | 2 | **both in `PublishGauntlet.test.tsx`** |
| `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` (ISOLATED) | **0** | 46/46 green |

The variance (1, then 2) is the same non-determinism the original entry records.

**Attribution measured rather than assumed** — the method the 187-20 entry established,
pointed at this plan: `WorkflowBuilderPage.canvas.test.tsx` was rolled back to `67b8025d`
(this plan's Task-1 commit, i.e. WITHOUT 187-28's four added cases), the TARGETS glob was
re-run, and the result was **`failed 2`, the identical two cases, total 2164** — which is
187-27's recorded total exactly. Restored afterwards, proved by `sha256sum -c`. So the four
cases 187-28 adds neither cause nor worsen it; the flake is a property of the parallel run
at this plan's parent commit.

**No pin was moved.** `WorkflowBuilderPage.canvas.test.tsx` reports **128** against a pin of
22 (`+106`), `PublishGauntlet.test.tsx` reports **46** against 46, pinned total 715, and
grand total rose 2164 → 2168. The gate's only reason is `[failing-tests]`; there is no
`[count-decrease]`, no `[missing-file]` and no `[total-below-baseline]`, so it is still not
masking a coverage loss.

**Re-open trigger unchanged** (whichever phase next touches `PublishGauntlet.tsx`, or a
dedicated flake-hunt). Two independent plans have now each spent a measurement proving
non-attribution, which is itself the argument for fixing it rather than re-proving it a
third time.

### THIRD AND FOURTH MEASUREMENT, plan 187-29 (2026-08-04) — GREEN in isolation, and green in five whole-glob samples

Two further independent measurements, recorded because together they change what the honest
recommendation is:

| measurement | who | result |
|---|---|---|
| `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` ISOLATED at HEAD, after 187-28 | the orchestrator (not this plan) | **46/46 passed, 25.6 s** |
| `node scripts/vitest-count-gate.cjs` — 5 samples at HEAD (2 pre-pin, 1 post-pin, and the P-29 / P-30 probe samples) | plan 187-29 | `PublishGauntlet.test.tsx` **46**, `failed 0`, **every time** |

So the ledger now reads: 187-20 saw it (2 → 1 → 0 across three samples), 187-27 saw it not at all,
187-28 saw it on both its samples and **measured** non-attribution by rolling the canvas suite back,
the orchestrator measured it green isolated, and 187-29 saw it green in five consecutive whole-glob
samples. That is the signature of a **load-dependent race**, not of a broken assertion — and it is
now four separate parties' worth of evidence.

**STANDING RECOMMENDATION, on that evidence: fix it rather than prove it a fourth time.** Every plan
that meets a red gate here spends a measurement re-establishing something five measurements already
say. **No pin has ever been moved for it and none may be** — the gate's only reason is
`[failing-tests]`; there is no `[count-decrease]`, `[missing-file]` or `[total-below-baseline]`, so
lowering a pin would not even silence it, and would blind the gate to a real deletion.

### RECURRENCE of `D-ITEM-187-25-01`, plan 187-29 (2026-08-04)

Recorded here for adjacency; the entry itself is below. The **other** parallel flake
(`WorkflowBuilderPage.canvas.test.tsx`, the 184-11 rails positive control) recurred **once** in this
round — on the P-28 probe sample — with the identical FULLNAME and
`AssertionError: expected 0 to be greater than 0`. Its per-file count was **128** in that sample, as
in every other sample of the round. A `[failing-tests]` reason, never a count reason. No pin moved.

---

## D-ITEM-187-23-01 — `GROUNDING_WHY_ESCALATED` carries the SAME second-person claim WR-11 just removed from the receipt row

**Found by:** plan 187-23, task 1 (2026-08-03)
**Status:** deferred — the plan's action says "Change nothing else in this file"

```
frontend/src/components/workflows/definitionOps.ts:475
export const GROUNDING_WHY_ESCALATED = "Because you turned this on by hand."
```

This is the *panel's* why-line for the grounding dial, not the receipt row. Plan 187-23
retired the identical claim from `seedReceiptStepReason("escalated")` because the input
(`grounding_escalated`, a boolean) records **that** the lock is authored and never **who**
authored it — and because a model emission can carry that bit (measured: it is in
`WF_SCHEMA`, `model_validate`s, and is returned verbatim by `POST /generate`). The same
argument applies verbatim to this constant: on a model-emitted escalation the panel tells a
user who clicked nothing that they turned the lock on by hand.

It is **not** identical in context — the panel line renders beside the dial the author is
operating, so on the ordinary path the reader has just done the act — which is why it is a
weaker case than the receipt row and was scoped out rather than swept in.

**Re-open trigger:** the next plan that touches the grounding dial's copy or
`PhaseFormPanel`'s governance section, or any plan that adds a governance-provenance bit of
the `name_seeded_by_ai` shape (which would make the second person legitimate again, gated).

---

## D-ITEM-187-23-02 — bare `npx tsc --noEmit` in `frontend/` is a VACUOUS check

**Found by:** plan 187-23, task 1 (2026-08-03)
**Status:** informational — affects how every 187 plan's typecheck criterion must be read

`frontend/tsconfig.json` is a SOLUTION file: `{"files": [], "references": [...]}`. So
`npx tsc --noEmit` from `frontend/` checks **zero files** and exits 0 with no output — it
cannot reproduce D-ITEM-01's 33 errors and cannot detect a new one either.

Measured at HEAD, 2026-08-03:

```
$ npx tsc --noEmit                      → exit 0, 0 error lines   (vacuous)
$ npx tsc --noEmit -p tsconfig.app.json → exit 2, 33 error lines  (the real baseline)
```

**How to read the criterion:** `npx tsc --noEmit -p tsconfig.app.json` is the command that
means what the plans intend. (Plan 187-22 already used this form.) The recorded project
lesson `tsc -b` ≠ `--noEmit` still holds; this is a second, separate trap in the same area.

---

## D-ITEM-187-24-01 — `groundingCauseOf` reads `phase.config` UNGUARDED, against its own module's totality contract

**Found by:** plan 187-24, task 1 (2026-08-03)
**Status:** deferred — widening it would change a shipped export's behaviour, which
threat-register entry `T-187-R4-13` accepted its risk on the explicit basis that 187-24's
change to `phaseVocabulary.ts` is purely additive

```
frontend/src/components/workflows/phaseVocabulary.ts
  groundingCauseOf:  const rawTools = phase.config.available_tools      ← unguarded
  nodeTitle:         const type = phase.config?.phase_type ?? ""        ← guarded
  derivedFaceOf:     const config = phase.config ?? { phase_type: "" }  ← guarded
```

The module's header states *"every exported resolver is TOTAL … the definition JSONB is
author-supplied and a projection must not crash on it"*. Two of the three phase-shaped
resolvers honour that on `config` itself; `groundingCauseOf` does not, and 187-24's new
`intersectingKbToolOf` deliberately MIRRORS it rather than diverging (a defensive guard on
one of two functions called one line apart is unreachable theatre — round-2 WR-04's finding,
re-confirmed here).

`PhaseSpecJSON.config` is typed REQUIRED, so this is only reachable from a hand-edited or
legacy JSONB row that TypeScript never saw. Not a live defect; a totality gap with a stated
contract behind it.

**Re-open trigger:** the next plan that may change a shipped `phaseVocabulary` export's
behaviour — add `phase.config ?? { phase_type: "" }` to `groundingCauseOf` and
`intersectingKbToolOf` in the same commit, so the two keep reading identically, and extend
the WR-14 agreement table with a config-less phase.


---

## D-ITEM-187-25-01 — a SECOND parallel-execution flake, in `WorkflowBuilderPage.canvas.test.tsx` (not PublishGauntlet)

**Found by:** plan 187-25, task 1 (2026-08-04), on the first of four `node scripts/vitest-count-gate.cjs` runs
**Status:** deferred — pre-existing, not caused by this plan (which edits only a docblock and the pin map), and NOT pinned around

The plan anticipated that a red gate would be `D-ITEM-187-20-01`, the known
`PublishGauntlet.test.tsx` flake. **It was a different file.** Sample 1 reported
`failed 1`:

```
FILE:     WorkflowBuilderPage.canvas.test.tsx
FULLNAME: WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
          > POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:      AssertionError: expected 0 to be greater than 0
```

Diagnosed rather than pinned around, per the task's own stop-and-report rule:

| Evidence | Result |
|---|---|
| the same suite run ISOLATED | `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` → **117 passed, exit 0** |
| gate samples 2, 3 and 4 (whole target glob) | `failed 0` every time |
| its per-file count, all four samples | **117** — identical; never a `[count-decrease]` |
| `PublishGauntlet.test.tsx`, all four samples | **46**, 0 failing — `D-ITEM-187-20-01` did NOT bite this round |

Same *class* as `D-ITEM-187-20-01` / `D-ITEM-02` — an assertion that passes alone and
fails non-deterministically under whole-glob parallel load — but a **different file**, so
it is logged separately rather than folded into that entry. The failing case is a
`waitFor`-style positive control over a prop the panel receives, which is exactly the
shape that loses a race under load.

**No pin was moved for it.** A pin is lowered only alongside a deliberate, plan-authorised
deletion — never to quiet a red gate — and lowering `WorkflowBuilderPage.canvas.test.tsx`
from 22 (its actual is 117) would have been meaningless anyway: the flake is a
`[failing-tests]` reason, not a count reason.

**Re-open trigger:** Phase 188's `WorkflowCanvas.tsx` extraction, which reopens this suite
— give the 184-11 positive control a deterministic settle (an explicit `findBy*`/`waitFor`
on the rails key rather than a bare read), and re-sample the gate five times to confirm the
class is gone rather than merely quiet.

**RECURRENCE, plan 187-29 (2026-08-04).** It bit once in five whole-glob samples at this commit — the
P-28 probe sample — with the **identical** FULLNAME and message recorded above. Per-file count
**128** in that sample and in every other; the other four samples reported `failed 0`. Diagnosed by
extracting the FULLNAME from the gate's own JSON report rather than by assuming it was the
`PublishGauntlet` flake the plan anticipated — the same discipline 187-25 applied when it discovered
this file in the first place. **No pin was moved.**

---

## D-ITEM-187-29-01 — `WorkflowDoorSwitch` reads NO feature flag, so 187-26's KB picker renders on the loose door with `visual_workflow_canvas` OFF

**Found by:** plan 187-29, task 2 (2026-08-04), while running the stale-manual-row sweep for M8
**Status:** deferred — out of scope (this plan writes a pin map and planning records, no product code),
and it is a **decision that has not been made** rather than a defect with a known fix

```
frontend/src/components/workflows/WorkflowDoorSwitch.tsx:82
  * exactly as it ships. This shell does NOT read the canvas flag at all — the host page

frontend/src/components/workflows/WorkflowDoorSwitch.tsx:257
            <DescribeKbPicker value={kbFolderId} onChange={setKbFolderId} />
```

The mount is unconditional, and the shell it lives in evaluates no gate of its own — by design, per
its own docblock (the host page owns the one shared gate rule and passes the answer down as `inline`,
so there is no second copy of the gate here to drift from it). Consequence: **a flag-OFF user meets a
knowledge-base picker on the loose "Describe & run" door** whenever `listFolders()` returns anything.

**Why this is NOT recorded as a D-181-01 violation.** That decision's subject is the **Builder** page's
first screen, and 187-26 leaves it byte-identical when the new prop is absent (`initialProjectFolderId`
ABSENT ⇒ today's behaviour; the flag-off byte-identity guards are green in every gate sample). The
**door** is a different, upstream surface, and its flag-blindness is a property of the Phase-124 shell
that **predates round 5** — 187-26 added a control to an already-ungated screen rather than ungating
anything.

**Why it is logged rather than passed over.** It is still a new control on a screen a flag-off user
reaches, and nothing in the phase measures that. The honest statement is that nobody has decided
whether the two-door shell belongs inside D-181-01's fence — and an undecided question that nobody
writes down becomes an assumption.

**Re-open trigger:** the next plan that touches `WorkflowDoorSwitch`, **or** any plan that must be able
to revert the v3.6 surfaces from the flag alone (a rollback, a staged enablement, or a customer with
the flag off). Decide then whether the door joins D-181-01's fence or is deliberately outside it, and
**write the decision down either way** — including the case where the answer is "outside, on purpose",
which is a legitimate answer and is currently indistinguishable from nobody having asked.

---

## D-ITEM-187-CLOSE-01 — the server's unbound rule tests NULLITY, not RESOLVABILITY

**Logged:** 2026-08-04, at phase close, alongside the CR-R5-01 fix.
**Status:** open, pre-existing, deliberately out of scope for a fast fix.

`backend/app/api/workflows.py:755` mints `unbound_retrieval` on `if body.project_folder_id is None:`.
So **any** non-null id suppresses the finding — live, deleted, out-of-RLS-scope, or fabricated. Nothing
downstream covers for it: `GenerateRequest.project_folder_id` is `UUID | None` with no ownership or
existence check, and nothing in `harness/grounding.py` validates that the id resolves against
`fetch_visible_folders` — `render_grounding_prompt` will state "BOUND to project folder id=<dead id>".

The CR-R5-01 fix closes the only client path that could produce a stale invisible id **on the describe
door**. It does not, and cannot, stop a dead id arriving from anywhere else — a different client, a
direct API call, or a future surface.

**Why deferred rather than fixed:** `187-VERIFICATION.md` listed this as OPTIONAL and explicitly "a
separate decision". It is a backend behaviour change with a real question behind it (does a dead id
mean *unbound*, or does it mean *invalid request*? — those want different responses), and answering it
inside a fast fix would be exactly the overreach that grew this phase from 15 plans to 29.

**Re-open trigger:** the next phase touching the grounding rules or `POST /workflows/generate`'s
request validation — or the first report of a workflow publishing with retrieval steps scoped to a
folder that does not exist.

---

## D-ITEM-187-CLOSE-02 (PROCESS) — propose a G-7 guardrail: cap gap-closure ROUNDS

**Logged:** 2026-08-04, at phase close, from the operator's own question.

CLAUDE.md's G-1 caps repeated phase INSERTS on the same hot file. Nothing caps repeated gap-closure
ROUNDS on the same phase, and Phase 187 shows what that costs: **15 plans on 2026-08-02 → 29 on
2026-08-04**, five rounds. The measured tell at round 5 was that **both** remaining gaps lived in code
round 5 had authored that same day (`DescribeKbPicker.tsx` created `f5a28e7e`; the pin block edited
`51c44f37`) — a round 6 would have been 100% cleanup of round 5, while every ROADMAP success criterion
was already verified.

Three mechanisms drive it, all structural rather than anyone's mistake:

1. **The gate manufactures findings.** Every `execute-phase` ends with a standard-depth code review of
   code written that morning; such a review essentially always returns something, a must_have then
   scores failed, and `gaps_found` routes straight back into `plan-phase --gaps`. Nothing in the loop
   asks *"is the phase goal met?"* as the terminating question.
2. **Each round adds must_haves, which are new failure surface.** Plan 187-29 existed ONLY to pin round
   5's guards; its own headline must_have then failed. A bookkeeping plan manufactured a gap.
3. **Closure rounds smuggle in features.** "The loose door has no KB picker" is a MISSING CAPABILITY,
   not a defect in shipped code. 187-26 built new UI inside a closure round — which is both how 15
   became 29 and why the blocker existed at all: new surface, no prior review cycles.

**Proposed rule (needs operator ratification before it goes into CLAUDE.md):** after **round 2** on a
phase, every further finding is triaged as **fast-fix / defer-to-next-phase / accept** and never as a
new round — UNLESS a ROADMAP success criterion is actually unmet. And a closure round may not introduce
a new user-facing capability; that is a phase, not a gap.

**Re-open trigger:** the next phase to reach gap-closure round 3.
