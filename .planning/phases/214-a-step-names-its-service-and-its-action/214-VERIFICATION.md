---
phase: 214-a-step-names-its-service-and-its-action
verified: 2026-08-28T18:00:00Z
status: gaps_found
score: 4/6 must-haves verified (STEP-02 FAILED per binding operator drive; STEP-03 PARTIAL)
overrides_applied: 0
gaps:
  - truth: "STEP-02 — a step's required arguments are author-fillable from every launch path, and a run supplies them"
    status: failed
    reason: "BINDING operator drive (214-UAT.md G4-3, 2026-08-28) — 'Asked when this runs' is unreachable for every author. Publish correctly refuses an undeclared launch argument, but nothing in the authoring surface can declare one. Not re-verified independently in this pass; carried forward as-is per instructions."
    artifacts:
      - path: "frontend/src/components/workflows/builderStore.ts"
        issue: "no action writes definition.inputs[] — the two references (PhaseFormPanel.tsx:293, WorkflowBuilderPage.tsx:1112) are read-only comments"
      - path: "frontend/src/lib/api/workflows.ts"
        issue: "never sends `inputs` on save — zero occurrences"
      - path: "backend/app/services/workflow_authoring.py"
        issue: "never emits `inputs` on generation"
    missing:
      - "An authoring surface that lets an author declare a WorkflowDefinition.inputs[] entry (key/label/description) so an 'Ask at launch' source arm has something to bind to. Filed as BUG-260828-02 (root cause of BLOCKING BUG-260826-01). Per CLAUDE.md G-7, this is a missing capability, not a gap-closure item — it is new-phase work."
  - truth: "STEP-03 — publish refuses a workflow with an unsatisfiable step, naming the step and the missing argument"
    status: partial
    reason: "The gate itself is VERIFIED correct by code trace (see Required Artifacts / Key Link Verification below) and confirmed firing correctly by the operator drive (G4-4, ask_undeclared on phase 'act'). But the on-screen sentence was illegible — truncated mid-word, and reported as the ONLY explanation reachable on that screen (BUG-260828-04)."
    artifacts:
      - path: "frontend/src/components/workflows/PublishRefusalList.tsx"
        issue: "Its own docblock explicitly forbids ever rendering the backend's raw diagnostic sentence on this surface ('THE BACKEND DIAGNOSTIC ... is exactly what BUG-260815-06 is about'). The composed, honest, per-step sentence this component builds (`\"«act»\" asks for \"«to»\" when it runs, but nothing asks for it.`) does NOT textually match what the operator recorded verbatim (`...but the wor[kflow declares no matching input]`), which is a character-for-character match to the BACKEND diagnostic string at backend/app/services/harness/reachability.py:192-193 — not this component's vocabulary. See Additional Findings below for the full trace and a hypothesis (stale frontend bundle at drive time) that the next investigator should rule in/out before treating this purely as a CSS wrapping bug."
    missing:
      - "Re-drive G4-4 against a hard-reloaded (non-HMR) build and confirm which text renders: the composed PublishRefusalList sentence (short, should not truncate) or the raw backend diagnostic (means isArgumentRefusal or its mount condition is failing in a real scenario the test suite does not cover)."
deferred: []
human_verification:
  - test: "Re-drive G4-4 (publish refusal legibility) against a fresh hard-reload / production-style build, not a dev server that may have been serving stale HMR state for PublishGauntlet.tsx / PublishRefusalList.tsx during the original drive."
    expected: "The short composed sentence renders in full: '\"act\" asks for \"to\" when it runs, but nothing asks for it.' If instead the raw backend diagnostic still appears, this is a real classification/mount defect, not a stale-bundle artifact, and BUG-260828-04 needs re-scoping beyond a CSS fix."
    why_human: "Requires a live browser drive; cannot be distinguished from a stale-HMR artifact by static code reading alone."
  - test: "G4-1, G4-2, G4-5, G4-7, G4-8 and the SC#10 8-provider roster + 3 axis rows"
    expected: "Per 214-UAT.md §5, these remain 'not run' by the operator's own decision (G-7-compliant: closing with owed rows is legitimate). Not re-driven in this static verification pass."
    why_human: "Requires live browser + real provider credentials; explicitly out of scope for a code-only verification pass per the phase's own closing decision."
---

## ✅ CORRECTION 2026-08-28 — SC#2 IS NOW MET (this report said FAILED, and that was true when written)

The gap this report recorded was real and is now closed by **Phase 214.1** plus two fixes driven out
of the operator’s own testing. Recorded here rather than by editing the finding above, because the
finding was CORRECT at the time and the sequence is the useful part.

**The proof, operator-driven 2026-08-28 18:00:50** — a library launch wrote into `workflow_runs`:

```json
{"topic": "test", "to": "fhdmrd@gmail.com", "kickoff_prompt": "go"}
```

The author’s real values, from the door they clicked — not placeholders, not the bare
`kickoff_prompt` this report measured. **declare → publish → launch asks → run receives**, end to end.

| | |
|---|---|
| SC#2 / STEP-02 | ❌ FAILED → **✅ MET** |
| ⛔ `BUG-260826-01` | **CLOSED** — the milestone’s blocking defect |
| `BUG-260828-02` (authoring surface) | CLOSED by 214.1 |
| `BUG-260828-10` (golden run supplied no declared inputs) | CLOSED |

⚠ **SC#3 stays PARTIAL** and is NOT corrected by this. The gate mechanics are right, but a failed
publish still does not tell the author what failed or in which step — `BUG-260828-09`, hit three
times on the evening of the drive. **Phase 214 is 5/6, not 6/6.**


# Phase 214: A Step Names Its Service and Its Action — Verification Report

**Phase Goal:** An author adds an external step by picking a service and then a named action;
that step's required arguments arrive from whatever launched the run; publish refuses a step
nothing can satisfy; and every surface a run appears on says which service and which action —
including when it fails.

**Verified:** 2026-08-28
**Status:** gaps_found
**Re-verification:** No — initial verification, but SC#2/part of SC#3 are carried forward from a
binding operator drive (`214-UAT.md`) rather than re-derived, per the assignment's instruction.

⚠ **This report does not re-litigate SC#2 (STEP-02) or the "gate fires" half of SC#3 (STEP-03).**
Those are established as **binding** by `.planning/phases/214-a-step-names-its-service-and-its-action/214-UAT.md`,
a real operator drive dated 2026-08-28. My job was the five criteria that drive did not reach:
SC#1, SC#4, SC#5 in full, and a considered verdict on SC#3's *remaining* half (legibility).

## Goal Achievement

### Observable Truths

| # | Requirement | Truth | Status | Evidence |
|---|---|---|---|---|
| 1 | STEP-01 | An author picks a service and then a named action — no server URL, no hand-written JSON argument object anywhere | ✓ VERIFIED | Real mount chain confirmed in the shipped tree (not a fixture): `PhaseFormPanel.tsx:1478` → `ExternalActionSection.tsx:164` → `ConnectionPicker.tsx:869` → `ArgumentEditor.tsx`. `MCP_TOOL_ARGS_LABEL` / `"Tool Arguments (JSON)"` — zero hits repo-wide (`grep -rn` returned nothing). No `Textarea`/`textarea` in `McpToolPicker.tsx`. `visual_workflow_canvas` confirmed cold-default `"everyone"` at `backend/app/models/user_settings.py:1209`, so this surface is reachable by every author on a fresh install, not only behind a flag flip. |
| 2 | STEP-02 | Required arguments are author-fillable from every launch path, and a run supplies them | ✗ **FAILED** | **Binding operator drive, not re-verified here.** `214-UAT.md` G4-3: unreachable for every author — publish correctly refuses `Ask at launch` with no way to declare the matching input. `BUG-260828-02` (root cause) and `BUG-260826-01` (the original blocking bug it explains) both open. |
| 3 | STEP-03 | Publish refuses a step nothing can satisfy, naming the step and the missing argument | ◐ **PARTIAL** | **Gate mechanics: VERIFIED by code trace** (see Key Link Verification). **On-screen legibility: FAILED**, per the operator drive (G4-4) and confirmed independently in this pass — see Additional Findings for a trace showing the text observed does not match the component built to display it. |
| 4 | STEP-04 | Service mark and action name appear on the run spine and run surfaces | ✓ VERIFIED | `StepIdentity` mounted and wired on all documented run surfaces: `PhaseCard.tsx:658` (panel), `frontend/src/components/chat/RunCard.tsx:380` (chat), `RunSpine.tsx:365` and `RunStepList.tsx:197` (`WorkflowRunPage`), `PendingAskCard.tsx:546` and `:728` (approval pause). `PhaseTimeline.tsx` deliberately does not import it (mounts `PhaseCard`, which does — D-11-D, asserted at runtime not by grep). See caveat below re: the *chat-side* approval cue. |
| 5 | STEP-05 | A failed external step reports its own failure reason on the panel, not a generic one | ✓ VERIFIED | Full wire traced end to end: write (`backend/app/db/workflows.py:1856` `fail_phase`) → jsonb string-scalar-tolerant read (`backend/app/models/thread.py:49` `phase_output_object`) → server projection (`backend/app/api/workflow_runs.py:850-870`, `backend/app/api/threads.py:1333-1339`) → wire field `failure_reason` (`backend/app/lib/api` types) → frontend reconcile (`frontend/src/providers/StreamsProvider.tsx:3925,3975` maps `failure_reason` → `failureReason`) → `PhaseCard.tsx`'s `classifyFailure`'s `fromRecord` arm (narrowed, not weakened, per plan 214-11's own measured RED-drive). |
| 6 | STEP-06 | Describe door offers connected services + granted tools as vocabulary; a named-but-absent service gets a stated refusal with a next action | ✓ VERIFIED | `DescribeServicePicker` mounted in `WorkflowDoorSwitch.tsx:819`; enforced server-side on the **emitted** definition (not just prompted) via `backend/app/services/workflow_authoring.py:366` `_check_allowed_connections` → `"connection_not_allowed"` (lines 405/414/434), threaded through `backend/app/api/workflows.py`. Prose-named absent-service refusal wired via `describeServiceMatch.ts` + `DESCRIBE_REFUSAL` at `WorkflowDoorSwitch.tsx:616`. |

**Score:** 4/6 truths fully verified (STEP-01, STEP-04, STEP-05, STEP-06). STEP-02 failed (binding). STEP-03 partial (mechanics pass, legibility fails).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/ArgumentEditor.tsx` / `ArgumentRow.tsx` / `argumentModel.ts` | Per-argument field rendering, three-arm source picker, no JSON | ✓ VERIFIED | Files exist, mounted on the real tree (not just tested in isolation), no escape-hatch pattern found. |
| `backend/app/services/harness/reachability.py::_check_external_action_arguments` | STEP-03's static lint check | ✓ VERIFIED | Lines 199-292: computes `LintError`s with `kind`/`step_name`/`argument`/`upstream`, called from `_check_input_contracts`'s one ordered walk. |
| `backend/app/services/harness/publish_service.py` stage 2 | Pre-golden-run block on lint errors | ✓ VERIFIED | Lines 175-205: `lint_workflow(...)` result short-circuits with `named_failures=[_lint_named_failure(e) for e in lint_errors]` **before** any golden run. |
| `backend/app/services/harness/publish_service.py::_lint_named_failure` | Wire shape carrying kind + step name + argument (not a composed sentence) | ✓ VERIFIED | Lines 684-710: for codes in `ARGUMENT_GAP_CODES`, adds `step_name` (via `_clean_label`), `argument`, `upstream`; `message` stays the raw diagnostic reserved for the log/audit receipt. |
| `frontend/src/components/workflows/PublishRefusalList.tsx` / `publishRefusalEntry.ts` / `publishRefusalVocabulary.ts` | Client-composed, honest, per-step sentence — never the backend diagnostic | ✓ EXISTS, mounted (`PublishGauntlet.tsx:810`) — **but see Additional Findings**: the text the operator actually observed does not match this component's output. |
| `frontend/src/components/workflows/StepIdentity.tsx`, `stepActionWords.ts` | Shared mark+action element, one resolver | ✓ VERIFIED | Confirmed mounted on 5 surfaces (see truth #4). |
| `frontend/src/components/workflows/DescribeServicePicker.tsx`, `describeServiceMatch.ts` | Connected-services picker + prose-match refusal | ✓ VERIFIED | Mounted, backend-enforced. |
| `backend/app/services/workflow_authoring.py::_check_allowed_connections` | Post-emit enforcement on the definition | ✓ VERIFIED | Lines 366-434. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `PhaseFormPanel.tsx` | `ExternalActionSection.tsx` | JSX mount, `:1478` | WIRED | |
| `ExternalActionSection.tsx` | `ConnectionPicker.tsx` | JSX mount, `:164` | WIRED | |
| `ConnectionPicker.tsx` | `ArgumentEditor.tsx` | JSX mount, `:869` | WIRED | |
| `reachability.py::_check_external_action_arguments` | `publish_service.py` stage 2 | `lint_workflow(...)` called before golden run | WIRED | Confirmed pre-golden-run short-circuit at line ~190-198. |
| `publish_service.py::_lint_named_failure` | frontend `isArgumentRefusal` | wire shape `{code, phase, message, step_name, argument, upstream}` | WIRED (structurally) | Hand-traced predicate against the exact live entry shape observed in the drive (`code="ask_undeclared"`, `phase="act"`, `step_name="act"`, `argument="to"`, `upstream=null`) — the predicate returns `true` for this entry, meaning `PublishRefusalList` SHOULD have rendered it. See Additional Findings for the contradiction this raises against the operator's observation. |
| `db/workflows.py::fail_phase` | `models/thread.py::phase_output_object` | `output._failure_reason`, jsonb string-scalar tolerant | WIRED | Confirmed the string-scalar handling this phase's D-214-23 finding required. |
| `workflow_runs.py` / `threads.py` | wire `failure_reason` | `phase_output_object(...).get("_failure_reason")` | WIRED | Lines 850-870 (`workflow_runs.py`), 1333-1339 (`threads.py`). |
| `StreamsProvider.tsx` | `Phase.failureReason` | reconcile mapping | WIRED | `failure_reason` → `failureReason` at both reconcile call sites (3925, 3975). |
| `PhaseCard.tsx::classifyFailure` | `phase.failureReason` | `fromRecord` arm | WIRED | Narrowed correctly per plan 214-11's own RED-drive (a recorded reason no longer falls to `gate_failed` generic copy). |
| `WorkflowDoorSwitch.tsx` | `DescribeServicePicker.tsx` | JSX mount, `:819` | WIRED | |
| `workflow_authoring.py::generate_workflow` | `_check_allowed_connections` | called on emitted definition | WIRED | Line 699. |

### Additional Findings (beyond the assignment's five criteria, surfaced by the trace)

**1. STEP-03's legibility failure may be a different, more specific defect than "text truncated by CSS."**
Tracing the exact scenario the operator drove (`code="ask_undeclared"`, `phase="act"`) through
`isArgumentRefusal` (`publishRefusalEntry.ts`) by hand against the live wire shape shows the
predicate returns `true` — meaning `PublishRefusalList` should mount and render its own short,
composed sentence (`"«act»" asks for "«to»" when it runs, but nothing asks for it.`), which
contains none of the words the operator recorded. What the operator recorded —
`"...but the wor"` — is a character-for-character prefix of the **raw backend diagnostic**
literal at `backend/app/services/harness/reachability.py:192-193`
(`f"{where}: the required argument {gap.argument!r} is asked for at launch, but the "
"workflow declares no matching input"`), which `PublishRefusalList`'s own docblock explicitly
says must never reach this surface. Two explanations are consistent with the evidence and
neither can be ruled out by static reading alone:
  - **(a) A real defect** in the mount condition or `isArgumentRefusal` that only manifests
    against a live server response shape not covered by the unit fixtures (i.e. the tests build
    entries by hand and may not exercise the exact production shape).
  - **(b) A stale frontend bundle at drive time** — this project's own memory bank
    (`reference_hmr_provider_change_stale_code.md`) records this exact failure class
    recurring elsewhere: the backend process picks up new code immediately while a dev-server
    frontend can keep serving pre-merge JS for a component under active HMR. `214-UAT.md`'s
    "staleness ruled out" reasoning only establishes that the **backend gate** is post-merge
    (its sentence didn't exist before this phase); it does not establish the **frontend
    component tree** was fresh.

  **Recommendation:** re-drive G4-4 against a hard-reloaded / production build before deciding
  BUG-260828-04's fix. If the raw diagnostic still appears after a clean reload, this is a real
  classification defect and more serious than a CSS wrap fix; if the composed sentence appears
  and is merely wrapped oddly, the original bug report's framing (CSS truncation) is correct.
  I did not have a live browser in this verification pass to settle it, so I record it as
  **not resolved**, not as a pass.

**2. STEP-04's identity mechanism has one surface it did not reach: the chat-side approval cue.**
The five surfaces `StepIdentity` was mounted on (truth #4) do not include
`frontend/src/components/panel/PausedRunCue.tsx` — the Phase 087 component that renders in
**chat** (`MessageItem.tsx:534`) when a run is paused on `ask_user`. It shows a generic,
hardcoded `"ask_user · awaiting your answer"` label with no service or action name, and was not
touched by any Phase 214 plan. `PendingAskCard.tsx` (which does carry `StepIdentity`) is mounted
only from `WorkflowRunPage.tsx` — i.e., only in the workflow run panel, not in chat. This is
consistent with, and likely the visible half of, the already-filed `BUG-260828-07` ("Approve /
Do-not-run render in the workflow panel but not in the chat thread") — that bug is about missing
*controls*; this finding is about the missing *identity*. Not scored as a STEP-04 failure (the
roadmap SC's literal wording — "run spine and run surfaces" — is satisfied by the five surfaces
that were built), but flagged because it is the same seam the filed bug names, from a different
angle, and a future fix to `BUG-260828-07` should carry `StepIdentity` along with the controls
it restores.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| STEP-01 | 214-07, 214-01 | Service→action picking, no URL, no hand-written JSON | ✓ SATISFIED | See truth #1 |
| STEP-02 | 214-09, 214-12, 214-16 | Arguments author-fillable from every launch path | ✗ BLOCKED | Binding UAT: `BUG-260828-02` — no authoring surface creates a declared input |
| STEP-03 | 214-05, 214-10 | Publish refuses the unsatisfiable, naming step + argument | ◐ PARTIAL | Gate mechanics satisfied; on-screen legibility not — `BUG-260828-04`, plus this report's Additional Finding #1 |
| STEP-04 | 214-08, 214-11 | Service mark + action name on run spine/surfaces | ✓ SATISFIED | See truth #4; caveat re: chat approval cue noted, non-blocking |
| STEP-05 | 214-02, 214-11 | Failed step reports its own failure reason on the panel | ✓ SATISFIED | See truth #5, full wire traced |
| STEP-06 | 214-13 | Describe door bound to connected/granted vocabulary, refuses named-but-absent services | ✓ SATISFIED | See truth #6 |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps all six STEP-01..06 IDs to Phase 214, and all six appear in this phase's plans (traceability table lines 212-217).

### Anti-Patterns Found

Scanned the phase's newly-created and heavily-modified core files
(`ArgumentEditor.tsx`, `ArgumentRow.tsx`, `argumentModel.ts`, `StepIdentity.tsx`,
`stepActionWords.ts`, `PublishRefusalList.tsx`, `publishRefusalVocabulary.ts`,
`DescribeServicePicker.tsx`, `describeServiceMatch.ts`, `reachability.py`,
`workflow_authoring.py`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`. **None found.**
No debt-marker blocker.

### Human Verification Required

See `human_verification` in frontmatter. In summary: re-drive G4-4 against a fresh build to
settle whether STEP-03's legibility defect is a stale-bundle artifact or a real classification
bug (materially different fixes follow from each); and the remaining SC#10 roster / axis rows
and G4-1/2/5/7/8 stay `not run` by the operator's own already-recorded decision (`214-UAT.md` §5)
— not re-driven in this pass, and not required to be, since G-7/G-4 already logged that decision
as legitimate.

### Gaps Summary

**What IS delivered and verified in this codebase (not merely claimed by a SUMMARY):** the
argument-editor authoring surface (STEP-01) is real, reachable by an ordinary author on a cold
install (the `visual_workflow_canvas` flag defaults `everyone`), and the old JSON escape hatch is
fully deleted, not merely deprecated. The run-identity mechanism (STEP-04) and the failure-reason
honesty wire (STEP-05) are both real, end-to-end, traced from the database write through the
exact jsonb string-scalar handling this phase's own investigation (D-214-23) required, through to
five separate mounted UI surfaces. The describe-door vocabulary constraint (STEP-06) is enforced
where it has to be — on the model's emitted output, not merely in the prompt — which is the
harder and more honest of the two things D-214-20 promised.

**What is NOT delivered:** STEP-02, confirmed unreachable by the binding operator drive — this is
the milestone's blocking defect and the phase cannot close as `passed` while it stands.
STEP-03's refusal mechanics are sound, but the message reaching the author's screen is either
mis-classified or (my hypothesis, unresolved) a stale-bundle artifact from the drive itself —
either way, an author today cannot reliably read why publish refused their workflow, which
undercuts the same "an author can fix what's wrong" promise SC#3 exists to keep.

**Net:** 4 of 6 requirements are solidly shipped and independently verified against the actual
codebase, not against fixtures or SUMMARY claims. The two that are not (STEP-02 fully, STEP-03
partially) share a root cause pattern worth naming for whoever plans the closure: both are gaps
between "the backend enforces correctly" and "the author-facing surface can act on that
enforcement" — one because nothing can produce the declaration the gate checks for, the other
because what the gate names does not legibly reach the screen.

---

_Verified: 2026-08-28_
_Verifier: Claude (gsd-verifier)_
