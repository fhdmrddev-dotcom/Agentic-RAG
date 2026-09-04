---
id: BUG-260828-04
title: The publish refusal is truncated on screen — the author cannot read why publish was refused
surface: Agentic-RAG
severity: high
status: folded
folded_into: 214.1
reported: 2026-08-28
reported_by: operator, driving Phase 214's G-4 checkpoint
affected_areas: [frontend/src/components/workflows/PublishGauntlet.tsx, frontend/src/components/workflows/PublishRefusalList.tsx, frontend/src/components/workflows/ProblemsTray.tsx]
re_open_trigger: the operator sees the raw backend diagnostic INSIDE the publish modal on a hard-reloaded (non-HMR) build — which the 214.1-03 fence says cannot happen; OR a phase decides the builder's ProblemsTray should compose author-facing sentences instead of rendering the server's message verbatim
---
# A refusal that cannot be read names nothing

The gate fired correctly (`ask_undeclared`), but the operator saw only:

> `phase 'act': the required argument 'to' is asked for at launch, but the wor`

The sentence ends mid-word. The full text is `…but the workflow declares no matching input`
(`backend/app/services/harness/reachability.py:190-193`).

⚠ Phase 214's own rule is that **a refusal is only honest if it names the next action**. A refusal
clipped before its last clause names neither the cause nor the action — functionally a generic
failure, which is exactly what `BUG-260815-06` describes and what 214-10 was built to end.

The operator also reported it as the ONLY message reachable on that screen, so the clipped line was
the entire explanation available.

---

## ⚠ DIAGNOSED 2026-08-28 (plan `214.1-03`, D-214.1-04) — RE-SCOPED, and the publish surface is INNOCENT

The plan was forbidden from assuming a cause. It rendered the byte-exact live entry
(`code="ask_undeclared"`, `phase="act"`, `step_name="act"`, `argument="to"`, `upstream=null`, with the
server's diagnostic present on the entry) through the real `PublishGauntlet` and read what came out.

**Hypothesis (a) — a classification or mount defect on the publish path — is REFUTED BY MEASUREMENT.**
The composed sentence arrives IN FULL (its final clause is in the DOM, asserted separately from its
opening), and the server's diagnostic string, the fragment the operator quoted, and the machine code
are each absent — counted, not inferred. Five cases, green on the first run.

**No CSS clamp was shipped, because there is none to remove.** `PublishGauntlet.tsx` contains no
`truncate`, no `line-clamp`, no `text-ellipsis` and no `whitespace-nowrap` anywhere on its
failure-rendering path; `LintRow` / `PhaseRow` / `BlockMessage` each render `String(message)` in a
plain `leading-relaxed` div. `ProblemsTray.tsx` has none either. **The diff for this bug is
TEST-ONLY** — no component source was modified.

**⭐ The answer is hypothesis (c), and it is reproducible BY CONSTRUCTION rather than guessed.**
`_gap_message`'s diagnostic is carried on the `LintError` that `lint_workflow` emits, and
`lint_workflow` has **two** callers: `publish_service` AND `POST /workflows/validate`. The `act` step
bound the NATIVE `send_email` capability, which is the arm `/validate` *does* evaluate (only the MCP
arm is skipped there, for want of a `tool_schemas` map). `api/workflows.py` classifies the five
argument-gap codes as `error`, and `ProblemsTray.tsx:24-26` states in its own docblock that it renders
the server's `message` **VERBATIM BY DESIGN** — already pinned by its own suite. So that exact string
is *supposed* to appear on the builder canvas, on every keystroke, and it is not a defect there.

**Hypothesis (b) — a stale bundle — also remains live and is now unfalsifiable.** Both 214-10 commits
are dated the SAME DAY as the drive:

```
3d508f28f 2026-08-28 feat(214-10): the cause above the spine, and the spine's state in words
0af16b150 2026-08-28 feat(214-10): the publish refusal is five sentences, not one
```

It is named rather than dismissed, but (c) is preferred because it is a path anyone can reproduce
today, whereas (b) asks us to assume a browser cache state nobody can now observe.

**The re-scope.** Composing author-facing sentences on the live-validation surface would be a SECOND
refusal vocabulary on a different route — a phase, not a fix, and explicitly out of scope here. The
tray was not changed.

## ⚠ A SEPARATE, REAL FINDING — the next action is worded but INERT

`PublishGauntlet.tsx` mounts `PublishRefusalList` with `entries` + `totalSteps` and **no
`onGoToStep`**, so every `data-testid="refusal-next"` control renders `disabled`. SC#3 says a refusal
names its next action; the words are on screen and the control does nothing. `RefusalItem` keeps it
from being a dead affordance by stating where the fix lives in the control's `title` — which is the
shipped `RunLink` precedent, not an oversight.

**NOT fixed in `214.1-03`**, deliberately: the gauntlet holds no canvas-navigation seam, so wiring one
is a second concern on a file whose ledger row already fires. The current state is PINNED by a test so
it is recorded rather than noticed. **Re-open trigger:** the next phase that touches
`PublishGauntlet.tsx` for any reason, or the first phase that gives the publish modal a way to reach a
step on the canvas.
