# Phase 250 — Run Honesty: the residue

**Built, verified and closed by Claude ALONE**, on the operator's explicit instruction
(*"please run this phase yourself end to end … do not involve Gemini and do it yourself"*).
Full run: discuss → plan → execute → verify, **no `AskUserQuestion`**.

⛔ **`verification_mode: self-verified`, `independent_review: owed`** — a fifth owed row beside
238 / 240 / 241 / 249. Builder and reviewer are the same agent, so this may **not** be recorded as
peer-reviewed (`D-250-13`).

---

## 1 · The measurement came first, and it changed the phase

The ROADMAP blocked planning on one question: *does the stuck todo carry
`" (run ended — not completed)"`?* **PRESENT ⇒ a copy decision. ABSENT ⇒ a backend defect.**
*"Planning before this is measured builds one of two mutually exclusive fixes at random."*

Measured against the live database before a line was planned (`250-MEASUREMENT.md`):

| | |
|---|---|
| open todos | **78** across **26** threads |
| carrying the marker | **25** — newest **2026-09-13 14:31**, the operator's own report date |
| not carrying it | **53** — **49** predate the reconciler, **4** were gated out |
| runs behind those 4 | `timed_out` / `cancelled` — **not one `completed`** |

⭐ **THE DICHOTOMY WAS FALSE, AND THAT IS THE FINDING.** Both arms are true, of different rows.
The newest items carry the marker → `HONEST-04` is the **copy** arm. Every post-138 unmarked row
sits behind a run the gate excluded **correctly by its own rule** → `HONEST-03` gets a **located
gate defect** rather than a hunt. **One measurement answered two requirements and refuted a third
claim.**

⭐ **`BUG-260902-01`'s mechanism claim is REFUTED.** *"There is no reconciliation at all"* is
false: `reconcile_open_todos_on_run_end` ships and has exactly **one** call site. Its **gate** was
the defect. That refutation is what made the fix a two-line predicate instead of a new subsystem.

⭐ **`SEED-105` ALREADY HELD THIS DESIGN — planted 2026-07-06 at a live operator UAT — and all
three of its `re_open_triggers` had fired** (this phase touching `TodosSection.tsx`; the operator
disliking the marker in practice; a user reporting the spinner still animating). **Ten weeks, two
bug reports filed against the absence of a decision that had already been made.** That is
`REG-02`'s case in one seed, and the seed is now `status: answered`.

---

## 2 · What shipped

### `HONEST-01` — the question is evicted LAST

`trim_messages_to_fit` had three protected classes (system message · last `reserve_recent` ·
pinned `load_skill` groups) and **the user's own turn was in none of them**. The loop re-trims at
the top of **every** iteration, *after* tool results are appended, so by iteration 1 the newest
messages are tool payloads and the question has drifted into evictable range.

⚠ **The protected-tail floor's own comment read *"Hard floor: system_msg + last user msg"* while
the code read `len(protected) > 1`** — which protects the last MESSAGE, by then a tool result.
**A comment that was wrong about its own code is how this survived five phases.**

**Fixed by eviction ORDER, not by a fourth protected class** — user turns are never hoisted,
because unlike a self-contained skill payload a hoisted question detaches from the answer that
follows it. Four ordered passes: non-user groups out of `trimmable`, non-user groups out of the
protected tail, then user turns, then the last-resort arm. ⭐ **The order had to hold ACROSS both
sections** — the first cut only ordered within `trimmable`, and a protected tail fat with tool
payloads still forced every question out before it could shrink. That is the bug, reproduced by
my own first implementation.

⚠ **One stated limitation, written into the code:** when the tail is down to the current question
plus the model's last reply and the pair still overflows, the question is given up — at that
point it alone exceeds the whole budget and `D-078-02` promises a list that fits rather than an
exception.

### `HONEST-02` — an empty run says what happened

One sentence for every possible cause (*"empty response after N iteration(s)"*) → a closed
four-arm taxonomy: reasoning-only · tools-ran-but-no-answer · nothing-we-could-see ·
**reason-not-captured**. The last arm is load-bearing for the same reason it is in
`run-honesty.md` D2: it proves a guess is never dressed as a diagnosis.

⛔ **THE TRAP, AND IT WOULD HAVE SHIPPED A LIE.** `full_reasoning_content` is **reset inside the
loop** (two sites — DeepSeek requires the current turn's reasoning round-tripped and nothing
older). Reading it at the fallback reports *"the model produced no reasoning"* about a model that
reasoned on **every** iteration — the honesty fix itself being dishonest, for exactly the
`gpt-5.6` family `BUG-260722-02` is filed against. A never-reset `reasoning_chars_this_run` was
added; **both reset sites carry a comment saying why it is deliberately absent from them**, and a
fence fails if the fallback ever reads the per-turn name again.

⚠ **Cross-provider limitation, stated not hidden:** `reasoning_delta` is OpenAI-compat only, so an
Anthropic or Google run that thought silently registers zero. That is why the third arm is worded
as an **observation** — *"nothing we could see came back"* — never as a claim about the model's
interior.

### `HONEST-03` — two halves, and a fence that refuted its own plan

**Data half:** the step-3 gate admitted only `terminal_status == "completed"`, so `timed_out` /
`cancelled` / `failed` runs reconciled nothing. It now reads
`terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE` — the predicate **step 5 of the same finalizer
already uses**, eleven lines below.

⭐ **THE PLAN WAS WRONG AND THE FENCE CAUGHT IT BEFORE A LINE SHIPPED.** `D-250-08` argued the set
membership *"strictly subsumes"* the old `cap_disposition != "cap_paused"` clause and that the
clause could go. `test_5b` was written to **prove** that equivalence and **refuted** it: the
producer ordering delivers a cap-paused run as `terminal_status == "completed"`, so dropping the
clause let a **resumable** run be marked *"not completed"* — the exact D-05 trap. **Both clauses
ship**, the reason is written at the gate, and `D-250-08` is corrected in place with the original
struck through.

**Render half:** `TodosSection` derives a fourth **display** status from **whether a run is live on
the thread** (`useStreamingForThread || useLoadingForThread`), not from the marker. ⛔
`StreamsProvider.tsx` (4,880 lines, G-5 FIRING) **is not modified** — both selectors have shipped
since Phase 075.4.

### `HONEST-04` — the words are about the agent's bookkeeping, not your job

The marker is **stripped out of the label entirely** and becomes the row's `title`; the status
slot reads **`NOT TICKED`**, dim tier, no animation. ⭐ The word is the operator's own —
*"the to dos is not up to date and ticked as completed"* — and it says what the system actually
knows. ⛔ `status` is untouched; **nothing was auto-completed**, rejected for the third time on
record.

⛔ **The marker STRING is byte-unchanged**, deliberately: rewording it would break the no-stack
guard against the 25 rows already carrying it and force the backfill this phase rejected.

---

## 3 · The architectural payoff: no migration, no backfill

`BUG-260902-01` expected the 25 stale rows to need a backfill *"under whatever rule is chosen"*.
They did not. **Because the panel reads run state rather than the stored marker, all 53 unmarked
rows — 49 of them predating the reconciler entirely — read honestly without one stored row being
rewritten.** `todos.status` keeps its three-value CHECK constraint; the fourth state is display
only. **Phase 250 ships zero migrations**, as the ROADMAP expected.

**Driven in a real browser** on the two threads the reports are actually about
(`250-UAT.md` §A): `BUG-260902-01`'s own *"Search knowledge base for report data"* — an UNMARKED
2026-08-31 row behind a timed-out run — now reads `NOT TICKED`, not animating. `/run ended/i` →
**false** on both pages.

---

## 4 · Gates, re-derived and never read from a claim

| Gate | Baseline (before any edit) | Close |
|---|---|---|
| backend unit | **71 failed / 4804 passed**, SET saved | 71, **SET identical** — the one new failure was the shipped `BUG-260522-01` fence on the superseded sentence, **retired deliberately** (below) |
| frontend count gate | ⚠ **RED — 3 inherited failures** in two suites this phase cannot reach | **`count gate OK` — 0 failing**, `+13` attributed exactly (`TodosSection` 12→21, `todoRunHonesty.lockstep` new 4) |
| hot-file ledger | ⛔ FAILED on **4 files with no row** — 3 of them FIRING | **OK** — rows + same-commit sections added |
| `tsc -p tsconfig.app.json` | 67 at base (CLAUDE.md) | **65**, none naming this phase's files |
| G-7 | — | **clear**, zero gap-closure rounds |
| deploy drift | — | **PASS** |

⚠ **The count gate's baseline red was transient flake and is recorded as such, not as this phase
fixing it** — `WorkflowBuilderPage.canvas.test.tsx` (SEED-171's fifth named suite, its recorded
`STACK_TRACE_ERROR` signature) and `sketchComposition.test.tsx`. Filenames were captured from the
gate's persisted JSON **before** any re-run, the cap was never touched, and `250-GATE-BASELINE.md`
states in advance that a later green reading is the flake resolving rather than that file being
wrong.

### A shipped fence retired CONSCIOUSLY, per `SEED-177`

`test_075_4_empty_response_iter_count.py` asserted the **exact sentence** `HONEST-02` replaced.
⭐ Its real claim — `BUG-260522-01`: *report the iterations that RAN, never the cap* — **survives
the rewording**, so the fence was **updated to pin the claim instead of the sentence**, with the
reason written into the test body, and gained a second test so a future "simplification" back to
one generic message cannot pass silently.

### Three fences read a comment as code, in one session

My first cut of the `HONEST-02` fences fired on the implementation's **own comments** — the
comment explaining why `full_reasoning_content` must not be read, and why no provider branch
belongs there. The updated `BUG-260522-01` fence did the same with `max_iterations`. ⭐ **This is
the Python twin of `frontend/src/lib/stripComments.testutil.ts`: a text fence cannot tell code
from a comment, and one that cannot is asserting about prose.** Two readings now exist —
`_code_only` for the words, `_identifiers_only` (strings stripped too) for the structure.

### And a fence that passed VACUOUSLY until a positive control caught it

The panel's *"does not animate"* assertions used `.animate-dotBounce`. The shipped class is
`motion-safe:animate-dotBounce` — one token — so the selector matched **nothing** and every
no-animation assertion would have passed over a still-bouncing dot. **The live-run positive
control two tests below is what found it.** A fence nobody has seen fire is not a fence.

---

## 4b · ⛔ A REAL BUG SHIPPED FOR ONE COMMIT, AND DRIVING THE APP IS WHAT FOUND IT

The liveness read went out as:

```ts
const isRunLive = useStreamingForThread(threadId) || useLoadingForThread(threadId)
```

**`||` short-circuits.** The instant the first selector returns `true` — **the instant a run
starts** — the second hook is never called, React counts fewer hooks than the previous render,
throws *"Rendered fewer hooks than expected"*, and **the entire app unmounts to a white page**.

⭐ **EVERY GATE WAS GREEN OVER IT**: 22 unit cases on this exact component, the count gate, the
ledger gate, the typecheck. Not through carelessness — **structurally**. The suite replaces both
selectors with `vi.fn()`, and a `vi.fn()` consumes no hook slot, so React's hook accounting never
sees the violation. **No rendered test in that file could have caught it.**

It was found by doing the one thing the phase's own record had listed as OWED: sending a real
message and watching the row. **The owed row was the bug.**

Fixed (two hooks on their own lines, `||` combining their *values*) and pinned by a **source**
fence — `TodosSection.test.tsx` → *"hooks are never short-circuited"* — driven RED against the
exact shipped defect with the file restored md5-identical.

⚠ **The lesson is this phase's own thesis turned on itself.** 250 exists because a surface
claimed something that had not happened. Its own verification claimed a component worked because
green tests said so — while the component crashed the page on the first real run. **A test that
mocks the thing under test measures the mock.**

---

## 5 · Owed at close — none of it a defect

| Owed | Why | How it closes |
|---|---|---|
| ~~**A3 — the live mirror-image control**~~ | ✅ **CLOSED 2026-09-15**, at the operator's request to be shown it — and it found the §4b defect. Round trip recorded twice by a 120 ms sampler: `NOT TICKED` → **`IN PROGRESS` + dot** → `NOT TICKED`. | done |
| **`HONEST-02` per-provider rows** | An empty-output run cannot be produced on demand. | Structural instead: no provider value reaches the taxonomy, fenced. |
| **Parallel-thread axis, live** | Thread-scoped by construction (`useStreamingForThread(threadId)`), not observed. | Any two-thread drive. |
| **Independent review (`DEBT-06`)** | Builder == reviewer, by instruction. ⛔ **WAIVED BY INSTRUCTION, NOT SATISFIED.** | `/gsd:code-review 250`, or Gemini. |
| **The word `NOT TICKED`** | Claude's call from the operator's own vocabulary, not the operator's ruling. G-2's sketch was declined (`D-250-12`) on the ground that `SEED-105` + `run-state-honesty.md` D1 already carry an operator-approved vocabulary. | One constant in `todoRunHonesty.ts`. |

⚠ **Two environment hazards observed while driving, neither this phase's:** the local box is
running a backend on `:8000` whose reload state is not something this phase verified, and the
Chrome CDP screenshot channel timed out three times mid-session (retry succeeded each time).
