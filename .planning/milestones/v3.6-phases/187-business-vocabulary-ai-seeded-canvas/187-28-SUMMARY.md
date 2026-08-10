---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 28
subsystem: workflow-studio-validation
tags: [gap-closure, round-5, doc-claim, wr-14, d-187-11, bug-260731-03, property-over-pin]
gap_closure: true
gap_closure_round: 5
gap_closure_base: 15339441

requires:
  - "workflows.py — `_ROUTE_ASSIGNED_CODES`, `_INCOMPLETE_CODES`, `_severity` and the `/validate` route as 187-03 left them (D-187-11)"
  - "grounding.py — `GROUNDING_VERDICT_CODES` and the `grounding_verdicts` collector the publish gate enforces through (182-06)"
  - "test_182_severity_codes.py — the shipped emit-site scanner and its `_ROUTE_ASSIGNED_CODES` membership pin"
  - "WorkflowBuilderPage.tsx — the `blockedReason` memo and its `?? validation.verdicts[0]` fallback, as 187-27 leaves it"
provides:
  - "a `_ROUTE_ASSIGNED_CODES` comment that states what the code does, and points at the two files that measure each half"
  - "the SERVER-side property, quantified over the whole route-assigned set, in both a constant form and a behavioural form"
  - "the CLIENT-side property the old comment denied: an incomplete-only ok:false disables Publish with the server's message verbatim"
  - "a source-grep regression pin explicitly ranked BENEATH the property, with positive controls"
affects:
  - "documentation truth only — zero behaviour change, zero set membership change, zero route logic change"
  - "the backend unit tree: +7 collected, +1 file"
  - "the canvas suite: 124 → 128 cases"

tech-stack:
  added: []
  patterns:
    - "a corrected claim never ships alone — both halves of the corrected sentence get a behavioural fence, or the correction is just a second unmeasured claim (the WR-14 shape 187-24 established)"
    - "the source grep is ranked BENEATH the property IN SOURCE and says so — a deny-list of phrases is a regression pin, never the fence (Phase-185)"
    - "a needle assembled from parts, so the guard's own source cannot satisfy it (the conflict 187-25 hit)"
    - "a prose COUNT is pinned by comparing it to `len()`, not by fixing the digit"
    - "a positive control stated as a SUBSET, not an equality, when an equality would red before the assertion under test could"

key-files:
  created:
    - backend/tests/unit/test_187_route_assigned_reach.py
  modified:
    - backend/app/api/workflows.py
    - backend/tests/unit/test_182_severity_codes.py
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md

decisions:
  - "D-187-28-01: a NEW backend test file rather than an extension of `test_182_severity_codes.py`. That file's docstring states its convention outright — pure sync tests, no event loop, no DB, nothing to patch — and the behavioural half CALLS `grounding_verdicts`, which is async and needs a monkeypatched ⊆ seam. Breaking a stated convention to save a file is a worse trade than one more file. What the scanner suite already owns (the exact MEMBERSHIP of `_ROUTE_ASSIGNED_CODES`, and therefore its size) is NAMED in the new file's docblock, never copied"
  - "D-187-28-02: the old sentence is PARAPHRASED and its commit named (`a68132db`), never requoted. A verbatim quote framed as 'this used to say' would satisfy the source pin and silently disarm it — the exact self-defeat 187-25 hit"
  - "D-187-28-03: property 2's positive control is a SUBSET assertion, not an equality. An equality would fail the instant the collector emitted a route-assigned code, so the disjointness assertion under test could never be the thing that went red. Found by writing probe P-24 and watching the wrong line fail"
  - "D-187-28-04: `test_182_severity_codes.py`'s D-187-11 comment carried the SAME stale claim and was corrected in the same commit — comment-only, in a file this plan already runs as a gate (see Deviation 1)"
  - "D-187-28-05: `BUG-260731-03`'s frontmatter is UNTOUCHED. Its `re_open_trigger` needs BOTH halves verified LIVE and this round performs no manual row"

metrics:
  duration_minutes: 41
  tasks_completed: 3
  files_created: 1
  files_modified: 4
  tests_added: 11
  commits: 3
  completed: 2026-08-04
---

# Phase 187 Plan 28: The Stale `_ROUTE_ASSIGNED_CODES` Claim (GAP C) Summary

`backend/app/api/workflows.py` now says what it does — a route-assigned verdict stays out of the
**server** publish gate but **does** gate the author's Publish **control**, deliberately — and both
halves of that sentence are held by a behavioural fence rather than by the comment's own authority.

## What shipped

| # | Task | Commit |
|---|---|---|
| 1 | the comment says what the code does | `67b8025d` |
| 2 | both halves of the corrected sentence become properties | `f82fd061` |
| 3 | measure the gates | `929f5af5` *(the deferred-item record; the gate measurements themselves change no source)* |

**Zero behaviour changed.** No set membership, no severity, no route logic, no migration, no
frontend source file. The whole of `workflows.py`'s diff is comment lines, proved mechanically:

```
$ git diff -U0 -- backend/app/api/workflows.py \
    | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]#' | wc -l
0
```

## The claim that was false, and how far it actually reached

The old block said the three route-assigned codes were confined to the canvas and that Phase 187
therefore left publishing alone. The first half of that is true of the **server**. The second half
is false of the **author**, and the mechanism is one half-expression in the Builder:

```ts
const first =
  validation.verdicts.find((v) => v.severity !== "incomplete") ?? validation.verdicts[0]
return first?.message ?? null
```

`.find` prefers an `error`; `?? validation.verdicts[0]` then catches **everything else** — including
an `incomplete`-ONLY envelope. And `ValidateResponse.ok == (verdicts == [])` by construction, so one
`incomplete` verdict is enough to make `ok:false`. A draft whose sole verdict is `unbound_retrieval`
therefore hands the server's own sentence to `publish-trigger.disabled` and `aria-describedby`.

**The operator's disposition, applied as written: the behaviour is correct and stays.** Blocking an
unbound retrieval workflow before a golden run is spent is precisely what `BUG-260731-03` escalated
to `blocking` for. Only the claim moved.

### A finding worth recording: the bug report already knew

`BUG-260731-03`'s own `UPDATE 2026-08-02` section is titled *"Why this blocks publish on the canvas
anyway"* and describes the fallback correctly, citing the memo by line. So from 2026-08-02 the
project held **both** the true description (in the report) and the false one (in the module), two
days apart, and nothing reconciled them. That is the WR-14 defect class in its purest form: the
module's comment was never wrong about a fact nobody knew — it was wrong about a fact somebody had
already written down elsewhere. It is the argument for the rule this plan applies: a claim that
matters gets a fence, and the fence lives next to the claim.

### The folded-in count fix — the file contradicted itself

The inventory line said ``_ROUTE_ASSIGNED_CODES`` — the **2** codes THIS route mints itself` while a
comment nineteen lines below said *"The three codes the ROUTE mints itself"*. Both in the same block,
since D-187-11 added the third member. Corrected to `3` in the Task-1 commit.

**And a count is not a fence, so it got one.** Re-derived rather than inherited:
`test_182_severity_codes.py::test_known_codes_compose_from_the_owning_modules_with_no_orphan`
(lines 304-308) already asserts `set(workflows._ROUTE_ASSIGNED_CODES) == {"business_requirement",
"interactive_phase", "unbound_retrieval"}` — the exact MEMBERSHIP, and therefore the size. **That is
the existing guard, named rather than duplicated.** What it did not cover is the PROSE, so the new
file adds one derived assertion instead of a literal:

```python
expected = f"the {len(workflows._ROUTE_ASSIGNED_CODES)} codes THIS route mints itself"
assert expected in _module_source()
```

Observed RED by restoring the digit to `2` (probe P-25c).

## The property, and the pin ranked beneath it

`backend/tests/unit/test_187_route_assigned_reach.py` (7 cases) is layered on purpose, and says so
in its own source:

| layer | what it measures |
|---|---|
| **PROPERTY 1** | no member of `_ROUTE_ASSIGNED_CODES` appears in `grounding.GROUNDING_VERDICT_CODES` or `reachability.LINT_CODES` — quantified over the SET, with a non-empty assertion first so the quantifier cannot range over nothing |
| **PROPERTY 2** | the BEHAVIOURAL form: `grounding_verdicts` is DRIVEN, with all three grounding rules firing at once, and emits no route-assigned code. The constant and the emit sites are two things that can drift apart, so both are measured |
| **PROPERTY 3** | every route code is classified without `_severity`'s fail-loud branch — the SET-quantified form of the single-code case already in `test_182_severity_codes.py` |
| **PIN** (bottom) | `workflows.py`'s source no longer carries the two stale phrases; the inventory digit equals `len()`; the corrected block still names both surfaces and both evidence files |

The pin's own section header states the rank in source: *"⚠ THIS IS A PIN, NOT A FENCE … a deny-list
of phrases cannot be made fail-closed by adding more phrases — the Phase-185 lesson (WR-12's whole
existence) … Somebody can restate the false claim in words nobody listed here and this pin will stay
green; the properties above are what actually hold the line."*

Both needles are assembled from fragments (`"canvas" + "-" + "only"`), so this file's own source
cannot satisfy them, and `test_the_needles_can_actually_match` is their positive control — each
needle matches its own synthetic control, matches neither the other's nor a clean sentence.

## RED observed before green — seven probes, each applied and measured in ONE tool call

The 187-27 rule was followed from the start: **a probe applied in one call and measured in the next
is not a falsification.** Every probe below was applied, driven and reverted inside a single Bash
invocation, and every revert is proved by `sha256sum -c` (never `git checkout --`, per the 187-24
lesson).

| # | Probe | Observed RED | Revert |
|---|---|---|---|
| P-23 | added `unbound_retrieval` to `grounding.GROUNDING_VERDICT_CODES` | `Extra items in the left set: 'unbound_retrieval'` — PROPERTY 1 *and* PROPERTY 2's control, i.e. the constant/emit-site drift | `grounding.py: OK` |
| P-24 | made `grounding_verdicts` actually emit a route-assigned code | `` `grounding_verdicts` EMITTED a route-assigned code: ['unbound_retrieval'] `` — PROPERTY 2 only; PROPERTY 1 stayed green, which is the isolation that matters | `grounding.py: OK` |
| P-25a | restored the `canvas-only` phrasing | `test_the_stale_claim_phrases_are_gone_from_the_module` | `workflows.py: OK` |
| P-25b | restored the `not scoped to change what publishes` phrasing | same case, other needle | `workflows.py: OK` |
| P-25c | restored the stale digit `2` | `test_the_inventory_comment_states_the_real_set_size` | `workflows.py: OK` |
| P-25d | renamed `SERVER publish GATE` so the two surfaces stop being named | `test_the_corrected_comment_names_both_halves_and_points_at_its_evidence` | `workflows.py: OK` |
| P-26 | removed `\| _ROUTE_ASSIGNED_CODES` from `_KNOWN_CODES` | `assert 'business_requirement' in frozenset({...})` — PROPERTY 3 | `workflows.py: OK` |
| P-27 | **deleted `?? validation.verdicts[0]`** from `blockedReason` — the exact "fix" someone would reach for after reading the old comment | see below | `WorkflowBuilderPage.tsx: OK` |

**P-27 is the one this plan exists for**, and its raw signature:

```
Expected: "phase 'research' reads your documents, but this workflow is not bound to a
           knowledge base — it would search everything"
Received: "Not checked yet."

 Tests  1 failed | 3 passed | 124 skipped (128)
```

Exactly one case red — the incomplete-only one. Both controls stayed green, which is what makes
them controls rather than duplicates.

### Why the client case was not already covered

Two nearby shipped cases look like it and are not:

- 184-11's *"the reason is the FIRST verdict's message VERBATIM"* sends a MIXED list, so the `.find`
  arm matches and the fallback never runs.
- 187-27's *"…an ok:false answer names the VERDICT verbatim"* sends `unbound_retrieval` at severity
  **`"error"`** — again the `.find` arm.

The route classifies `unbound_retrieval` as `incomplete` (D-182-03 / D-187-11), so the **shipping**
shape reaches the button only through the fallback. That half-expression is the entire mechanism of
GAP C and nothing was measuring it.

The four new client cases (124 → 128):

1. an `ok:false` whose SOLE verdict is an `incomplete` route-assigned code → the message **verbatim**,
   trigger disabled, reason reachable via `aria-describedby`, and provably not the never-ran sentence;
2. **CONTROL A** — a mixed list still leads with the `error`, so the case above cannot later be
   "fixed" by dropping incompletes without redding it;
3. **CONTROL B** — `ok:true` with zero verdicts leaves Publish ENABLED on the very same mount, ruling
   out "a settled loop blocks" and "a non-empty tray blocks";
4. a source guard: the page names neither `unbound_retrieval` nor the message text — it renders the
   server's string and never classifies (D-182-06) — with a positive control proving the matcher
   would catch a locally-authored copy.

## `BUG-260731-03` — the reported-bugs touchpoint (CLAUDE.md, MANDATORY)

Verified by reading the report and the code. **Frontmatter UNTOUCHED** — `status: folded`,
`folded_into: "186 (control) / 187 (verdict)"`, `verified_closed_by: null`. No `status` flip, no
`verified_closed_by` write, and no edit to the file at all.

| half | state |
|---|---|
| **verdict** | shipped in 187-03 (`unbound_retrieval`, `incomplete`, per-node, minted at `/validate` stage 5) and **pinned here** — the server-side property in `test_187_route_assigned_reach.py`, the client-side one in the canvas suite |
| **control** | 186-08 promoted the display-only header chip into a real picker (re-bind after drafting). **187-26 materially advances it**: the loose *"Describe & run"* door was the third creation path with no binding control — the report's §3 names it as an entry point that *"never offers the choice at all"* — and 187-26 gives it a picker before the AI generates. The `re_open_trigger` requires re-binding from **every** creation path, so this is the half that was still short |

**Why the report still cannot close:** its trigger requires BOTH halves verified **live**, and this
round performs no manual row. The verdict half has never been observed in a browser; 186's control
half never got its live confirmation either. Round-5's manual rows are authored in `187-29`.

Note the report's own body (its `UPDATE 2026-08-02`, §"The deliberate decision NOT to put it in
`grounding.grounding_verdicts`") repeats the *"canvas-only"* framing. It is a **historical record of
what was believed on that date**, immediately followed by the section that correctly describes the
real reach — so it is deliberately not rewritten. Reports are appended to, never edited backwards.

## Every gate, measured

| # | Gate | Result |
|---|---|---|
| 1 | the five named backend suites | **72 passed, 0 failed** |
| 2 | `pytest tests/unit` | **62 failed / 1700 passed / 2 xfailed / 2 xpassed**. Baseline **re-derived at the base commit** (see below): 62 / 1693 / 2 / 2. Failures **unchanged at 62**; collection rose 1759 → **1766** (+7, this plan's file). **Zero new failures; collection did not fall** |
| 3 | `npx vitest run …canvas.test.tsx` | **128 passed, 0 failed** (pre-task 124) |
| 4 | `node scripts/vitest-count-gate.cjs` | **reports VIOLATED on `[failing-tests]` only** — 1 then 2 failures, both in `PublishGauntlet.test.tsx`, which passes **46/46 in isolation**. Proved NOT attributable to this plan (below). Total 2164 → **2168**, pinned total **715**, `WorkflowBuilderPage.canvas.test.tsx` **128** (pin 22). **No `[count-decrease]`, no `[missing-file]`, no `[total-below-baseline]`, and NO pin lowered** |
| 5 | `npx tsc --noEmit -p tsconfig.app.json` | **33 `error TS` lines** (61 raw lines — several errors emit indented continuations). **Zero in this plan's files.** The bare form is vacuous (`D-ITEM-187-23-02`); the project form was used |
| 6 | migrations | `git diff --stat 15339441 HEAD -- supabase/migrations` **empty**; `git status --porcelain supabase/migrations` **empty** |
| 7 | planning docs untouched during execution | `git status --porcelain .planning/{REQUIREMENTS,STATE,ROADMAP}.md` **empty** at measurement time |
| 8 | the mount cap (D-187-14) | `git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` → **`15  3`** — **byte-identical to 187-27's recorded value. This plan spends ZERO of the cap**; it touches the page's TEST file only |

### The backend baseline, re-derived rather than inherited

`git diff --name-only 15339441 HEAD -- backend/ supabase/migrations` returned **0 lines** before any
edit — 187-26 and 187-27 were frontend-only — so the tree measured at HEAD *was* the base-commit
tree, and the baseline was taken there, pre-edit:

```
62 failed, 1693 passed, 2 xfailed, 2 xpassed, 32 warnings in 25.11s
```

That independently reproduces `187-VALIDATION.md` §(d)'s figure. It was re-measured, not copied.

### Gate 4's failure, attributed by measurement rather than by assertion

`D-ITEM-187-20-01` (the `PublishGauntlet.test.tsx` parallel flake) **recurs** — 187-27 recorded it as
absent, which was a lucky sample. The same two case names, the same 1-then-2 variance, green in
isolation.

Rather than assume non-attribution, it was measured: `WorkflowBuilderPage.canvas.test.tsx` was rolled
back to `67b8025d` (this plan's four cases removed), the TARGETS glob re-run, and the result was
**`failed 2`, the identical two cases, total 2164** — 187-27's own recorded total, exactly. Restored
afterwards with `sha256sum -c` passing. Recorded as a RECURRENCE section under the existing
`D-ITEM-187-20-01` rather than as a new entry (same file, same cases). **No pin was moved.**

## Deviations from Plan

### 1. [Rule 1 — a false claim in a comment, the defect class this plan closes] `test_182_severity_codes.py`'s D-187-11 note carried the SAME stale claim

- **Found during:** Task 1, while checking (as the plan directs) whether that file already pins
  `len(_ROUTE_ASSIGNED_CODES)`.
- **Issue:** its `test_known_codes_compose_from_the_owning_modules_with_no_orphan` comment read
  *"`unbound_retrieval` is CANVAS-ONLY … which Phase 187 is explicitly not scoped to do"* — the same
  two phrases, in a file the corrected comment now cites as the existing membership guard, and one
  this plan runs as a gate.
- **Fix:** comment-only. The claim is re-scoped to the **SERVER gate** (which is the true part) and a
  `⚠ 187-28` paragraph records that the canvas-only framing was measured false, names the operator
  decision, and points at the two files that measure both halves. Zero assertion changed; the suite's
  count is unchanged at 27 → the file still contributes the same cases (34 across the three Task-2
  suites).
- **Why it is not scope creep:** the plan's stated purpose is *"a comment that is true"*, and leaving
  an identical false comment in the file being cited as the guard would have shipped the defect the
  plan exists to close, one file over. The file is not in `files_modified`, which is why it is
  recorded here rather than passed over silently.
- **Files:** `backend/tests/unit/test_182_severity_codes.py`
- **Commit:** `f82fd061`

### 2. [Rule 3 — the instrument, not the property] PROPERTY 2's positive control had to become a subset assertion

- **Found during:** writing probe P-24.
- **Issue:** the control was first written as `codes == set(GROUNDING_VERDICT_CODES)`. Under P-24 it
  failed *first*, so the disjointness assertion under test could never be the line that went red —
  the fence would have been measuring the fixture, not the property.
- **Fix:** stated as `set(GROUNDING_VERDICT_CODES) <= codes` ("the fixture fired all three rules"),
  with the reason written into the source so the next reader does not "tidy" it back to an equality.
  P-24 then reds the intended line, as recorded above.
- **Files:** `backend/tests/unit/test_187_route_assigned_reach.py`
- **Commit:** `f82fd061`

### 3. [observation, no change] The plan's Task-3 file list named only the backend test file

Task 3 is measurement-only; it changes no source. Its commit (`929f5af5`) carries the
`deferred-items.md` recurrence record instead — the 187-26 / 187-27 precedent for a measurement task,
with the one artefact the scope-boundary rule requires for an out-of-scope discovery.

## Known Stubs

None. This plan ships no runtime code at all: one comment block, one new test file, one test-file
comment and one appended test block. No value flows to a rendered element, no placeholder copy, no
hardcoded empty that reaches a surface.

## Threat surface

Against the plan's own register:

- **T-187-R5-11** (repudiation, the comment) — **mitigated.** The claim is rewritten to match measured
  behaviour and both halves carry a behavioural fence; four source pins (P-25a-d) each observed
  firing, so the block cannot silently drift back to an unmeasured assertion.
- **T-187-R5-12** (elevation of privilege, `grounding_verdicts`) — **mitigated.** Two properties,
  both quantified over the whole route-assigned SET: the published constant (P-23 red) and the real
  collector driven with all three rules firing (P-24 red). The seam where a canvas verdict would
  silently become a hard server publish blocker is now measured from both directions.
- **T-187-R5-13** (spoofing of a fence, the grep pin) — **mitigated.** Ranked beneath the property in
  source and labelled as a pin; needles assembled from parts so the guard's own source cannot satisfy
  them; a dedicated teeth case proves each needle matches its own control, neither the other's nor a
  clean sentence.
- **T-187-R5-14** (tampering, `workflows.py`) — **accepted as planned**, and proved: the comment-only
  diff shows **0** added-or-removed non-`#` lines. Zero set membership, severity or route-logic edits.
- **T-187-R5-SC** — **held: ZERO package-manager installs**, zero new dependencies, in either
  ecosystem.

No new surface beyond the register. This plan touches no route behaviour, no persisted field, no
schema, and no trust boundary.

## State writes — what was and was not done

Per the standing false-completion guard, recorded so the next reader can audit it:

- **`requirements.mark-complete` was NOT called.** `VOCAB-02` remains unmarked.
- **`state.advance-plan` was NOT called.**
- **`roadmap.update-plan-progress` was NOT called.** The two ROADMAP edits are hand-made and each
  individually true: the wave-15 checkbox for `187-28` is ticked, and the phase progress-table row
  moves `27/29` → `28/29`. **No checkbox for `187-29` was touched**; it remains `- [ ]`.

## Verification against the plan's success criteria

- [x] `git diff -U0 -- backend/app/api/workflows.py` shows comment lines ONLY (0 non-`#` lines)
- [x] The stale phrases are absent from the module and are not reproduced verbatim anywhere that
      would satisfy the pin — paraphrased, with commit `a68132db` named for the original wording
- [x] The server-side property is quantified over `_ROUTE_ASSIGNED_CODES`, in both a constant form
      and a behavioural form, never over one code
- [x] The client-side property asserts a non-null `blockedReason` **verbatim** + a disabled trigger,
      with two controls (mixed severities, `ok:true`) proving it is not vacuous
- [x] Both properties observed RED before their pins — P-23/P-24/P-26 backend, P-27 client — with raw
      signatures recorded and every revert sha256-proved
- [x] The grep pin is labelled beneath the property IN SOURCE and carries positive controls
- [x] `BUG-260731-03` frontmatter UNCHANGED; the touchpoint finding recorded above
- [x] Backend unit baseline re-derived at the base commit (62/1693); no new failure; collection rose
- [x] Zero migrations; the page mount cap unspent (`15  3`, unchanged); zero SDK completion verbs
- [~] Gate 4 reports `[failing-tests]` — pre-existing `D-ITEM-187-20-01`, non-attribution measured,
      no pin lowered

## What this does NOT close

`187-28` closes GAP C only. **`187-29`** — the round-5 count pins and the `187-VALIDATION.md` record,
including manual rows **M15/M16/M17** — is untouched.

**Owed to the operator, and not satisfiable by any test in this plan:** `BUG-260731-03` still needs
both halves observed in the product. This plan proves the wire-level and state-machine properties;
only a live session can confirm that an unbound retrieval draft greys Publish with the route's own
sentence on a real screen, and that the re-bind control is reachable from every creation path. The
seeded-rows caveat is binding on both: the existing `workflow_definitions` rows are test data of
unknown vintage, so each must also be driven against a freshly generated draft.

## Self-Check: PASSED

All four files exist on disk (`backend/app/api/workflows.py`,
`backend/tests/unit/test_187_route_assigned_reach.py`,
`backend/tests/unit/test_182_severity_codes.py`,
`frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`). All three claimed commits
(`67b8025d`, `f82fd061`, `929f5af5`) resolve in `git log`. `.planning/REQUIREMENTS.md` is clean and
`VOCAB-02` carries no completion mark. `BUG-260731-03`'s frontmatter is byte-unchanged. In the
ROADMAP's round-5 waves `187-26`, `187-27` and `187-28` are ticked; `187-29` remains `- [ ]`.
</content>
