# Phase 250: Run Honesty — the residue - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

> ⚠ **THIS CONTEXT WAS GATHERED AUTONOMOUSLY, BY EXPLICIT OPERATOR INSTRUCTION, AND THAT IS
> DISCLOSED RATHER THAN HIDDEN.** The operator's own words at `/gsd:discuss-phase 250`
> (2026-09-15): *"please run this phase yourself end to end use your tools plan research if
> needed and execute and I want to come to see it finished unless it needs at the very end my
> review or validation do not involve Gemini and do it yourself."* No `AskUserQuestion` was put
> to a person. **Every `D-250-NN` below is CLAUDE'S call, not an operator ruling** — the two are
> not interchangeable, and a later phase must not cite one of these as *"the operator decided"*.
> Where a decision closes a register entry, the evidence is named inline so the call can be
> audited rather than trusted.
>
> ⛔ **CONSEQUENCE FOR `DEBT-06`, stated now so the close cannot overclaim:** the builder and the
> reviewer of this phase are the same agent. 250 therefore closes
> `verification_mode: self-verified` with `independent_review: owed`, exactly like 238 / 240 /
> 241 / 249. **It may NOT be recorded as peer-reviewed.** (`D-250-13`.)

<domain>
## Phase Boundary

**Delivers:** a run never claims something that did not happen — not about the question you
asked, not about output it did not produce, not about work it did not finish.

Four requirements. **The phase's first act was to take the measurement the ROADMAP said must be
taken here**, and it changed the shape of two of the four:

| Req | What it is here | Shape |
|---|---|---|
| `HONEST-01` | Context trimming never evicts the user's own question | **BUILD** — an eviction-ORDER rule in one function, no new protected class |
| `HONEST-02` | A model that produces no text says *what happened* | **BUILD** — one generic sentence becomes a closed taxonomy with an honest `unknown` arm |
| `HONEST-03` | The panel stops claiming a run is in progress once it ends | **BUILD, two halves** — a presentational run-state read (all rows, incl. 53 legacy) + a backend gate that admits every TRUE terminal status |
| `HONEST-04` | A completed task leaves no todo asserting unfinished work | ⭐ **COPY / SCOPING arm — the blocking measurement is ANSWERED** (`D-250-01`), and the answer is *marker PRESENT* |

**NOT in this phase:** conversation compaction / summarisation (`SEED-041`, `SEED-061`,
`SEED-180` — `HONEST-01` is an eviction-order fix, not a compaction strategy); making a weak
model actually drive the tool loop (`SEED-118`, `SEED-127` — this phase makes the failure
HONEST, it does not make the model succeed, and `D-250-17` writes that distinction into both
seeds so neither is wrongly closed); a `todos.status` enum value for *abandoned* (no migration —
`D-250-05`); removing the backend honesty marker entirely (`SEED-105` item 4, declined —
`D-250-03`); the `write_todos` chat card duplication (`BUG-260718-03`, `D-250-16`).
</domain>

<decisions>
## Implementation Decisions

### D-250-01 — The blocking measurement, TAKEN. The marker is PRESENT — and the report's binary was a false dichotomy

`BUG-260913-02` and the ROADMAP both say planning must not start until one question is answered:
*does the stuck todo carry `" (run ended — not completed)"`?* **PRESENT ⇒ copy decision. ABSENT ⇒
backend defect.** Measured directly against the live local database (`todos` + `runs`), not read
from a record:

| | |
|---|---|
| open todos (`pending` + `in_progress`) | **78**, across **26** threads |
| carrying the marker | **25** |
| NOT carrying it | **53** |
| of those 53 — updated BEFORE 2026-07-06 (Phase 138 shipped the reconciler) | **49** |
| of those 53 — updated ON/AFTER 2026-07-06 | **4**, on exactly **2** threads |
| run statuses on those 2 threads | `timed_out:1` · `cancelled:1` + `timed_out:1` — **not one `completed`** |
| newest marked row | **2026-09-13 14:31:05** — the operator's own report date |

⭐ **Both arms are true, of different rows, and that is the finding.** The newest stuck items —
the ones behind the operator's complaint — **carry the marker**, so the reconciler RAN and
`HONEST-04` is the **copy/scoping arm**: a person was told their finished work was unfinished.
Every post-138 unmarked row sits behind a run that ended `timed_out` or `cancelled`, which the
gate excluded **correctly by its own rule** — so `HONEST-03` gets a *located gate defect*, not a
mystery. The 49 remaining unmarked rows predate the reconciler's existence.

⛔ **A plan may not restate this as "the reconciler is broken".** It is not. Its gate is narrow
and its words are wrong, and those are two different fixes on two different requirements.

### D-250-02 — `BUG-260902-01`'s mechanism claim is REFUTED, and the original stays in the report

That report states: *"The mechanism is therefore NOT 'terminal runs fail to reconcile'. There is
no reconciliation at all."* **Measured false.** `reconcile_open_todos_on_run_end`
(`backend/app/services/todos_service.py:117`) exists, ships, and has **exactly one** call site —
`backend/app/services/run_producer.py:146`, step 3 of the unified 8-invariant finalizer. What is
true is narrower and more useful: **its gate admits only `terminal_status == "completed"`**, so
a run that timed out, was cancelled or failed reconciles nothing. That is `D-250-08`'s fix. The
refutation is recorded in the report at close, beside the original, never over it.

### D-250-03 — `SEED-105` IS this phase's design, and ALL THREE of its re-open triggers have fired

`SEED-105-run-state-aware-todos-panel.md` (`status: planted`, 2026-07-06) was written at Phase
138's live UAT when the operator questioned the text-append. Its three `re_open_triggers`, read
verbatim against today's tree:

1. *"Any phase that re-touches `TodosSection.tsx` or the Workspace panel run-state rendering"* — **FIRED** (this phase).
2. *"Operator asks for the todos panel to look cleaner at run-end / dislikes the inline text marker in practice"* — **FIRED** (`BUG-260913-02`, 2026-09-13).
3. *"A user reports the in-progress spinner keeps animating after a run has ended"* — **FIRED** (`BUG-260902-01`, 2026-09-02).

⭐ **The design was chosen ten weeks ago and sat planted while two bugs were filed against its
absence.** This phase builds its items 1-3 (stop the spinner · dim the row · an "ended" pill
reusing the existing status-label vocabulary) and **declines item 4** (removing the backend
marker) — the marker is the only thing that records *why* a specific row stopped, and deleting a
shipped honesty signal to tidy a surface is the trade Phase 138 explicitly refused. Seed flipped
at close per `D-250-17`.

### D-250-04 — the panel's honesty is read from RUN STATE, not from the marker

`TodosSection.tsx` already calls `useViewingThread()`. It gains
`useStreamingForThread(threadId) || useLoadingForThread(threadId)` — two existing thread-scoped
selectors, both already exported from `StreamsProvider.tsx`.

⛔ **`StreamsProvider.tsx` (102 / 37 / 4880, G-5 FIRING) IS NOT MODIFIED.** No new state, no new
event, no new plumbing — the panel reads selectors that have shipped since Phase 075.4.

**Why run state and not the marker:** the marker only exists on rows the reconciler reached. A
run-state read makes **all 78 open rows honest, including the 49 legacy ones**, with no rewrite
of a single stored row. `useLoadingForThread` is OR-ed in deliberately: during a reconnect/fetch
window `streamingThreads` can read empty for a live run, and a row must never flash "not ticked"
while the agent is working.

### D-250-05 — NO MIGRATION AND NO BACKFILL

The ROADMAP expected none from this phase (*"250/251 should need none"*), and `D-250-04` is what
makes that hold: the 53 unmarked legacy rows become honest **presentationally**, so there is
nothing to rewrite. ⛔ **A data-backfill migration appending the marker to old rows is
explicitly REJECTED** — appending text to a user's stored rows is not cleanly reversible, and it
buys nothing the run-state read does not already buy. `todos.status` keeps its three-value CHECK
constraint (`pending | in_progress | completed`); the fourth state is a **display** state.

### D-250-06 — the fourth display status: `NOT TICKED`, dim tier, no animation

Governed by `references/run-state-honesty.md` D1 — *dim → amber → red, loudness earned by
severity* — and an abandoned todo is the **dim** tier: usually nobody's fault, often the user's
own Stop.

| | today | after |
|---|---|---|
| icon | `CircleDot`, `animate-dotBounce` — **still bouncing on a dead run** | `CircleDashed`, **no animation** |
| status word | `IN PROGRESS` (amber `--panel-status-active`) | **`NOT TICKED`** (`--panel-muted-foreground-dim`) |
| label text | `Translate document (run ended — not completed)` | `Translate document` — marker stripped |
| `title` | none | `The run ended before the agent marked this complete.` |

**`NOT TICKED` is the operator's own vocabulary** — their report reads *"the to dos is not up to
date and ticked as completed"*. It is a statement about the **agent's bookkeeping**, which is
what the system actually knows, and not about whether the person's job got done — which is
exactly what `BUG-260913-02`'s candidate fix #1 asked for and what `(run ended — not completed)`
gets wrong. A `pending` row on an ended run reads `NOT TICKED` too: the identical suffix for both
open statuses is Phase 138 `D-02`, kept.

⚠ **A11Y is unchanged and load-bearing:** the status stays a visible WORD in the accessible tree,
colour stays additive (Phase 088-05). The `sr-only` progress line keeps counting only
`completed`.

### D-250-07 — the marker is STRIPPED from the label, and the marker STRING does not change

The frontend removes the `_RUN_ENDED_MARKER` suffix from `content` before rendering, and turns
its presence into the `title` sentence. ⛔ **`_RUN_ENDED_MARKER` itself stays BYTE-IDENTICAL** —
changing its wording would break the reconciler's own no-stack guard (D-04) against the **25 rows
already carrying the old text**, and would demand exactly the backfill `D-250-05` rejects. The
words the user reads are now the badge's, so the stored string no longer has to carry the
apology.

**Pinned, not copied:** the frontend constant is bound to `todos_service.py` by a `?raw` lockstep
fence — this project's established pattern for a backend literal a frontend depends on (see
`reference_frontend_suites_import_backend_source_raw`). A silent drift between the two would make
the strip a no-op and the marker would reappear inline, which is a defect no other gate can see.

### D-250-08 — the reconciler gate widens to EVERY TRUE TERMINAL STATUS, reusing a named set

```
- if terminal_status == "completed" and result_sink.get("cap_disposition") != "cap_paused":
+ if terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE:
```

`_RUN_STATUS_TO_TERMINAL_TYPE` (`backend/app/services/run_transport.py:77`) is
`{completed, failed, cancelled, timed_out}` — **the same predicate step 5 of the very same
finalizer already uses** to decide whether to emit a terminal sentinel. ⭐ `cap_paused` is
absent from that map, so **the D-05 trap is closed by the set itself rather than by a second
clause a later editor can drop** — a cap-paused run is non-terminal and re-attachable and must
never be marked.

⚠ **The `cap_disposition` clause is REMOVED ONLY because the new predicate strictly subsumes it**,
and the plan must prove that rather than assert it: a fence driving the cap-paused producer path
and asserting **zero** reconciliation is mandatory, driven RED against the un-widened gate.

This is what closes `HONEST-03`'s data half — the 2 threads in `D-250-01` and every future
timed-out or cancelled run.

### D-250-09 — `HONEST-01` is an eviction-ORDER rule. Do NOT extract user turns as a protected class

Root cause, located: `trim_messages_to_fit` (`backend/app/services/context_window.py:323`) has
three protected classes — the system message, the last `reserve_recent` (10) messages, and pinned
`load_skill` groups — and **the user's own turn is in none of them**. Trimming runs at the top of
**every** agent-loop iteration (`agent_loop.py:2073`), *after* tool results have been appended, so
by iteration 1 the newest messages are tool payloads and the user's question has drifted back into
evictable range. The comment at the protected-tail floor claims *"Hard floor: system_msg + last
user msg"* — **the code's floor is `len(protected) > 1`, which protects the last MESSAGE, and by
then that message is a tool result, not the question.** That is the defect in one line, and the
comment is wrong about its own code.

**The fix is a removal-order rule, not a fourth protected class.** Pinned skill groups can be
hoisted to the front by `_build_candidate` because a skill payload is self-contained; **a user
turn cannot** — hoisting it would detach a question from the answer that follows it and scramble
the transcript the model reads. So:

1. `_remove_oldest_atomic` gains a **user-last** rule: it removes the oldest **non-user** atomic
   group while any exists, and only falls through to a user group when nothing else remains.
   Order is preserved exactly — removal from the middle of a list is still in-order.
2. The same rule governs the protected-tail inward loop (`if not trimmable:`).
3. **Hard floor: the LAST user message is never evicted**, and the code must enforce what the
   comment already claims.

This is the report's own expected behaviour #2 verbatim — *"drop the oldest tool results first;
they are re-derivable by re-running retrieval, which a user question is not."*

⚠ **Deep Mode stays byte-identical (D-14):** no call site changes, no signature changes, no new
parameter. The function returns a differently-ordered *survivor set* under pressure and an
identical one when nothing is trimmed (the fast path is untouched).

### D-250-10 — `HONEST-02` is a CLOSED TAXONOMY with an honest `unknown` arm, and one accumulator is a trap

`agent_loop.py:3076` emits one sentence for every possible way a loop can end empty:

> *"The model returned an empty response after N iteration(s). Try breaking the request into
> smaller steps or switching to a different model."*

It names a count and a workaround and says **nothing about what happened**. Replaced by a closed
taxonomy, modelled on `references/run-honesty.md` D2 (which exists precisely so a run is never
shown as an empty success), keyed off state the loop already holds:

| arm | condition | says |
|---|---|---|
| `reasoning_only` | reasoning tokens seen, no visible text, no tool call | the model spent the turn reasoning and never wrote an answer |
| `tools_no_answer` | ≥1 tool call completed, no visible text | it ran N tool calls and never wrote the answer they were for |
| `nothing_at_all` | no text, no reasoning, no tool call | it returned nothing at all across N steps |
| `reason_unknown` | anything else | ⭐ says **the reason was not captured**, explicitly — never a guess dressed as a diagnosis |

⚠ **THE TRAP, AND IT WOULD HAVE SHIPPED A LIE:** `full_reasoning_content` is **reset to `""`**
inside the loop (`agent_loop.py:2733` and `:2839`). Reading it at the fallback would report *"no
reasoning"* for a model that reasoned on every iteration — i.e. the honesty fix would itself be
dishonest, for exactly the family (`gpt-5.6` Sol/Terra/Luna) the requirement is filed against. A
**new, never-reset** counter/flag is required, and the plan must drive that distinction RED.
`persisted_tool_calls` accumulates across the loop and is safe to read.

Keep the actionable tail (*"try smaller steps or another model"*) — it is useful and true — but
it follows the diagnosis instead of replacing it.

### D-250-11 — the D-14 red line, stated as a check rather than a promise

Provider differences stay at the adapter / sanitizer boundary. **Every change in this phase is
provider-agnostic by construction:** `D-250-09` reorders eviction inside a pure function that
never sees a provider; `D-250-10` reads shared accumulators and adds **no** `if provider ==`
branch to the shared path; `D-250-08` reads a transport-level status map; `D-250-04/06/07` are
frontend render. ⛔ A plan that finds itself needing a provider branch has found a different
phase.

### D-250-12 — G-2 disposition: NO `/gsd:sketch`, and the reason is recorded rather than assumed

G-2 is flagged for `HONEST-03` / `HONEST-04` in the ROADMAP. **Honoured by construction, not
waived:** the visual vocabulary this phase needs already exists and is already operator-approved
— `references/run-state-honesty.md` D1 (the dim/amber/red tier ladder, and *"derive from durable
state, never a live-only badge"*) and `SEED-105`'s own items 1-3, written **at a live operator
UAT**. The change is one existing row gaining a fourth status word and losing an animation: no
new component, no new layout, no new colour token. Sketching a mockup to re-derive a decision the
operator already made would be ceremony.

⚠ **This is a guardrail call made without the operator present, so it is flagged for their
end-of-phase review** rather than buried. If they want the pill sketched, `SEED-105` still holds
the design and the change is one file.

### D-250-13 — DEBT-06: builder == reviewer, disclosed at the close

`verification_mode: self-verified`, `independent_review: owed` — a fifth owed row beside
238 / 240 / 241 / 249. ⛔ It may not be recorded as peer-reviewed. Gemini is excluded by explicit
operator instruction for this phase.

### D-250-14 — G-5: FOUR files have NO ledger row, and three of them are FIRING

Triples re-derived from git on 2026-09-15 with the CLAUDE.md recipe (six-digit date buckets
subtracted), never copied forward:

| File | commits / phases / lines | G-5 | Row today |
|---|---|---|---|
| `backend/app/services/todos_service.py` | **4 / 3 / 187** | **FIRES** | ⛔ none, for its entire life |
| `backend/app/services/context_window.py` | **10 / 5 / 602** | **FIRES** | ⛔ none, for its entire life |
| `frontend/src/components/panel/TodosSection.tsx` | **6 / 4 / 210** | **FIRES** | ⛔ none, for its entire life |
| `backend/app/services/run_producer.py` | **3 / 2 / 693** | below threshold | ⛔ none |
| `backend/app/services/agent_loop.py` | **45 / 21 / 3326** | **FIRES** | has a detail section |

⭐ **Three FIRING files have been invisible to their own guardrail for their whole lives** — the
same failure `config.py` suffered for the project's entire history. `node scripts/check-hot-file-ledger.cjs 250`
**will fail until rows are added, and that is the gate working.** Rows go in the scan list in
`docs/HOT-FILE-LEDGER.md` **and** their sections in the same commit (the same-commit sync rule),
disposition cell ≤ 200 chars. `run_producer.py` gets a row **at 2 phases, before the threshold** —
an absent row is invisible to G-5 at any count (the `settingsSearchPayload.ts` precedent).

**G-5 dispositions for the three firing files, all *honoured by construction*:**
`todos_service.py` — byte-unchanged by this phase (only its caller's gate moves) unless a plan
proves otherwise. `context_window.py` — one removal-order rule inside one existing private
helper; no new public function, no signature change. `TodosSection.tsx` — one derived display
status on the **existing** row layout; `DerivedRow` gets the same treatment from the same helper,
never a second copy of the rule.

### D-250-15 — SC#10 cross-provider is MANDATORY: the full native roster + OpenRouter, 8 rows

Derived from `MODEL_CAPABILITIES`, **never re-typed** (the roster rots the moment a provider is
added), newest registry-backed id per provider. `HONEST-02` is filed `cross-provider/openai` and
a fix proven on one provider is not proven. Method is the cheapest honest one, proven in Phase
185 and re-used in 249: drive each row as a real run with a **per-request** `model` + `provider`
on `POST /threads/{id}/messages`, so no global setting is mutated and rows cannot contaminate
each other. ⛔ **A row with no key, or blocked by a known defect, is recorded ⛔ with its reason
and the blocking id — never dropped.** A scoreboard that lists only what passed is not a
scoreboard.

⚠ `HONEST-01` also needs a cross-provider read, because context budgets are per-provider
(`resolve_context_budget(active_provider, model)`) — the eviction rule is shared, but which
provider trims first is not.

### D-250-16 — reported-bugs routing (the MANDATORY discuss-phase cross-check)

| Report | Routing |
|---|---|
| `BUG-260906-01` context trim drops the user's question | **FOLDED** → `HONEST-01` |
| `BUG-260722-02` gpt-5.6 empty response in tool loop | **FOLDED** → `HONEST-02` |
| `BUG-260902-01` panel in-progress on a run that ended | **FOLDED** → `HONEST-03` (and its mechanism claim refuted, `D-250-02`) |
| `BUG-260913-02` todos never ticked on a completed task | **FOLDED** → `HONEST-04` (measurement taken, `D-250-01`) |
| `BUG-260609-02` phantom generic "Sub-task" in Sub-Results | **LEFT OPEN, not folded** — harness sub-agent surface (`BatchResultList`), zero overlap with the todos render path this phase opens. Re-open trigger unchanged. |
| `BUG-260718-03` `write_todos` card duplicated in chat | **LEFT OPEN, DEFERRED** — the chat card renders the tool call's own args, not the `todos` row, so nothing in this phase's render change reaches it. Re-open trigger: the next phase touching the chat tool-card for `write_todos`. |

### D-250-17 — seeds are answered by EDITING THE SEED

- **`SEED-105`** → flip `status: planted` → **answered/shipped by Phase 250**, recording that items 1-3 shipped and item 4 (delete the backend marker) was **declined with a reason**. Three fired triggers get named. A seed that shipped but still reads `planted` is re-proposed forever.
- **`SEED-118`** (weak-model tool-loop harness) and **`SEED-127`** (reasoning-first forced-emission gap) → **NOT closed.** `HONEST-02` makes the failure *legible*; it does not make the model *succeed*. Both seeds get one line recording that 250 touched their symptom and left their capability untouched — so a later reader cannot mistake an honest error message for a fixed loop.
- **`SEED-094`** stays `closed`. Its RUN-01b claim is true; `BUG-260913-02` already records that a closed seed is not evidence that a surface is well.

### Scope, gates and process

- **G-8 plan count: target 3-5.** The natural split is by surface, not by requirement: backend agent-loop/context (`HONEST-01` + `HONEST-02`), backend run-lifecycle gate (`HONEST-03` data half), frontend panel (`HONEST-03` render + `HONEST-04` copy), plus ledger/registers. Two plans touching `agent_loop.py` would be one plan with two tasks.
- **G-7:** zero gap-closure rounds so far; a maximum of 2 before triage is mandatory.
- **G-3:** none of these is a `/gsd:fast` — every one has a fence obligation and `HONEST-03` spans two languages.
- **Gates, all RE-DERIVED at baseline and again at close, never read from a claim:** `pytest tests/unit -q --continue-on-collection-errors` (capture the **SET** of failing names, never a tail — the ceiling is 71 with zero headroom and the set is the only sound comparison); `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the **repo root**, verdict line verbatim; `node scripts/check-hot-file-ledger.cjs 250`; `node scripts/check-claude-md-size.cjs`; `bash scripts/check-deploy-drift.sh`.
- ⚠ **`src/pages/WorkflowBuilderPage.canvas.test.tsx` is SEED-171's fifth named flaky suite and went red at 249's gap-closure on provably unmodified code.** If it reds here: capture filenames from the gate's persisted JSON **before** any re-run, check against `git diff --numstat`, record as an observation, do NOT touch the cap.
- **TDD:** every fence driven RED against a planted defect before it is trusted. Specifically required: the cap-paused non-reconciliation fence (`D-250-08`), the never-reset reasoning flag (`D-250-10`), the user-turn-survives-eviction fence (`D-250-09`), and the marker-strip lockstep fence (`D-250-07`).
- **G-4 lived-experience UAT is flagged for this phase** (panel + todo honesty). Driven in Chrome by Claude where a browser can reach it; anything that genuinely needs a person is recorded as OWED with the row named, never silently claimed.

### Claude's Discretion

- Exact icon for the fourth status (`CircleDashed` vs `CircleSlash`) and the precise `title` sentence, within `D-250-06`'s vocabulary.
- Whether the strip helper lives in `TodosSection.tsx` or a sibling module — one home either way, consumed by both `TodosRow` and `DerivedRow`.
- The taxonomy's exact sentences in `D-250-10`, provided each names what happened and the `unknown` arm admits it does not know.
- Plan decomposition within G-8's 3-5 target.
</decisions>

<canonical_refs>
## Canonical References

### The requirements and their registers
- `.planning/REQUIREMENTS.md` — `HONEST-01`..`HONEST-04` (lines 128-142)
- `.planning/ROADMAP.md` — Phase 250 detail, success criteria and Flags (lines 171-188)
- `.planning/reported-bugs/BUG-260906-01-context-trim-drops-the-users-own-question.md`
- `.planning/reported-bugs/BUG-260722-02-gpt56-reasoning-empty-response-in-tool-loop.md`
- `.planning/reported-bugs/workspace-panel-shows-in-progress-for-a-run-that-timed-out.md` (`BUG-260902-01`)
- `.planning/reported-bugs/BUG-260913-02-todos-never-ticked-on-a-task-that-demonstrably-completed.md`

### Seeds that are answered by EDITING THE SEED, never by shipping
- `.planning/seeds/SEED-105-run-state-aware-todos-panel.md` — **this phase's design**, all three triggers fired
- `.planning/seeds/SEED-118-weak-model-tool-loop-harness.md` — explicitly NOT closed here
- `.planning/seeds/SEED-094-run-end-honesty-baseline-emit-leak-and-todo-finalizer.md` — stays closed

### Design vocabulary this phase must speak (G-2)
- `.claude/skills/sketch-findings-agentic-rag/references/run-state-honesty.md` — D1 tier ladder, "derive from durable state"
- `.claude/skills/sketch-findings-agentic-rag/references/run-honesty.md` — D2 closed failure taxonomy + the `reason_unknown` arm
- `.claude/skills/sketch-findings-agentic-rag/references/panel-shell.md`

### Code the plans will read before they edit
- `backend/app/services/context_window.py:323` `trim_messages_to_fit` · `:520` `_build_candidate` · `:547` `_remove_oldest_atomic`
- `backend/app/services/agent_loop.py:2073` the per-iteration trim · `:3063-3080` the empty-response fallback · `:2733`/`:2839` the reasoning reset (the trap)
- `backend/app/services/todos_service.py:113` `_RUN_ENDED_MARKER` · `:117` `reconcile_open_todos_on_run_end`
- `backend/app/services/run_producer.py:145-156` the gate and the `except BaseException`
- `backend/app/services/run_transport.py:77` `_RUN_STATUS_TO_TERMINAL_TYPE`
- `frontend/src/components/panel/TodosSection.tsx` · `frontend/src/providers/StreamsProvider.tsx:4762`/`:4793` (READ ONLY)

### Standing rules this phase is governed by
- `CLAUDE.md` — G-1..G-8, the hot-file ledger rule, the backend baseline gate, the cross-provider roster rule
- `docs/HOT-FILE-LEDGER.md` — the authoritative scan list + the same-commit sync rule
- `.planning/DEBT-06-REFUSALS.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets — every one of them already ships
- `useStreamingForThread` / `useLoadingForThread` — thread-scoped selectors since Phase 075.4, exactly the run-state signal the panel needs, **no provider change**.
- `_RUN_STATUS_TO_TERMINAL_TYPE` — an already-named "true terminal" set, already used by step 5 of the same finalizer the gate lives in.
- `_extract_pinned_skill_groups` / `_atomic_groups` — the existing protected-class machinery in `context_window.py`; read as precedent, **not** as the shape for user turns (`D-250-09`).
- `persisted_tool_calls` — accumulates across the whole loop; safe to read at the fallback.
- `STATUS_LABEL` / `STATUS_TEXT_COLOR` / `StatusIndicator` — the panel's existing status vocabulary; the fourth state extends these maps rather than adding a parallel one.

### Established patterns
- **One finalizer, eight ordered invariants** (`run_producer.py`) — the reconciler is step 3 and its position relative to the terminal sentinel is load-bearing (the `todo_updated` emit must reach the live consumer BEFORE the sentinel). ⛔ Widening the gate must not move the step.
- **`?raw` lockstep fences** — a frontend suite imports backend source text to pin a shared literal.
- **Full-state-replace** is the ONLY todo mutation path (`replace_todos`); the reconciler rides it, and the no-op path is byte-clean (D-14).
- **Non-colour-only status** (A11Y) and **panel-scoped AA tokens** (088-05).

### Integration points
- `agent_loop.py` → `context_window.trim_messages_to_fit` (per iteration) → the `context_truncated` system warning.
- `run_producer._finalize_producer_run` → `todos_service.reconcile_open_todos_on_run_end` → `replace_todos` → `todo_updated` SSE → `useTodos` → `TodosSection`.
- `TodosSection` ← `useViewingThread` + `useTodos` + `useDerivedPanel` (+ the two new run-state reads).
</code_context>

<specifics>
## Specific Ideas

- The operator's own words are the badge: *"the to dos is not up to date and ticked as completed"* → **`NOT TICKED`**.
- The row must stop moving. `animate-dotBounce` on a dead run is the single loudest lie on the surface — `BUG-260902-01` describes a person waiting for something that stopped seven minutes earlier.
- `reason_unknown` is the load-bearing arm of `HONEST-02`'s taxonomy, for the same reason it is in `run-honesty.md` D2: it proves we never dress a guess as a diagnosis.
- A user question is not re-derivable. A tool result is — by re-running the tool. That asymmetry is the whole of `HONEST-01`.
</specifics>

<deferred>
## Deferred Ideas

- **Conversation compaction / summarising evicted turns** (`SEED-041`, `SEED-061`, `SEED-180`) — the honest fix for a thread that genuinely cannot fit. `HONEST-01` only decides what dies first.
- **Making a weak or reasoning-first model actually complete the loop** (`SEED-118`, `SEED-127`) — forced emission, per-model budgets, early force-answer. This phase makes the failure honest, not rare.
- **A real `abandoned` value in `todos.status`** — needs a migration + CHECK change + wire/type changes across two languages, and `D-250-04` makes it unnecessary for the symptom. Re-open if a *server-side* consumer (an API, an export, an eval) ever needs to distinguish abandoned from pending.
- **Deleting the backend honesty marker** (`SEED-105` item 4) — declined here; the marker is the only record of *why* a specific row stopped.
- **`BUG-260718-03`** — the `write_todos` card duplicated in chat.
- **A backfill of the 53 stale rows** — rejected (`D-250-05`), recorded so it is not re-proposed as new.
</deferred>
