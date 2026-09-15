---
phase: 250-run-honesty-the-residue
reviewed: 2026-09-15T14:19:44Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/services/agent_loop.py
  - backend/app/services/context_window.py
  - backend/app/services/run_producer.py
  - backend/tests/unit/test_075_4_empty_response_iter_count.py
  - backend/tests/unit/test_250_reconciler_gate.py
  - backend/tests/unit/test_250_run_honesty_agent_loop.py
  - frontend/src/components/panel/__tests__/todoRunHonesty.lockstep.test.ts
  - frontend/src/components/panel/__tests__/TodosSection.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
  - frontend/src/components/panel/todoRunHonesty.ts
  - frontend/src/components/panel/TodosSection.tsx
  - scripts/vitest-count-gate.cjs
findings:
  critical: 3
  warning: 6
  info: 5
  total: 14
status: issues_found
---

# Phase 250: Code Review Report

**Reviewed:** 2026-09-15T14:19:44Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 250 ships four honesty changes. Two of them (HONEST-03 reconciler gate, HONEST-04 row
copy) are substantially correct and well-fenced. Two of them — **HONEST-01 (eviction order)
and HONEST-02 (empty-response taxonomy) — do not deliver what their own comments claim, and
both claims are refutable by running the shipped code.**

Every finding below was **driven, not reasoned about**. Reproductions were executed against
the shipped `backend/venv`, against the pre-fix module (`git show <base>:…`) for
before/after comparison, and against the repo's own eslint config. Commands and measured
output are inlined so each finding can be re-derived rather than believed.

What was verified green, so it is not re-litigated:

- `pytest tests/unit/test_250_run_honesty_agent_loop.py test_250_reconciler_gate.py test_075_4_empty_response_iter_count.py -q` → **21 passed**.
- Panel suites → **30 passed** (`TodosSection.test.tsx` 22 · `todoRunHonesty.lockstep.test.ts` 4 · `WorkspacePanel.derived.test.tsx` 4). The three `BASELINE` numbers added to `scripts/vitest-count-gate.cjs` are **correct as measured**, and adopting `WorkspacePanel.derived.test.tsx` into both knobs is the right call for the right reason.
- The context-window regression fences genuinely fire against the pre-fix module: `test_1_1` and `test_1_2` are **RED on the base commit** (measured — `QUESTION-0/1/2` dropped, newest question dropped). They are not vacuous.
- The `TodosSection.test.tsx` "hooks are never short-circuited" source fence **does fire** against a reconstructed pre-fix file (`offenders: [[220, 'const isRunLive = useStreamingForThread(threadId) || useLoadingForThread(threadId)']]`) and is clean against the shipped file.
- `npx eslint src/components/panel/TodosSection.tsx src/components/panel/todoRunHonesty.ts` → clean.

The three Critical findings are: the HONEST-01 floor is **not** enforced in the shape the
agent loop actually produces; the trimmer can emit an orphaned `tool` message that the
provider rejects outright; and the HONEST-02 reasoning arm is **structurally unreachable for
four of the eight roster providers, including the one the bug was filed against**.

CR-01 and CR-02 reproduce identically on the base commit, so they are **pre-existing defects,
not regressions**. They are Critical anyway, because this phase touched exactly this code,
added docstrings asserting the opposite, and added fences that claim to cover them.

---

## Critical Issues

### CR-01: HONEST-01's floor is not enforced — one oversized tool result evicts the newest user question *and everything else*

**File:** `backend/app/services/context_window.py:441-444` (PASS 4) and `backend/app/services/context_window.py:646-681` (`_remove_oldest_evictable`)

**Issue:**

The code asserts, twice, that the newest user turn is now protected:

> `context_window.py:436` — *"The floor is now enforced where it belongs: `_remove_oldest_evictable` never evicts the group holding the newest user turn, so the claim and the code finally agree."*
> `context_window.py:609` — *"**Neither the LAST group nor the group holding the NEWEST user turn is ever evicted.**"*

**Both statements are false.** Under `protect_tail=True`, `keep` holds the newest-user group
*and* the last group. Steps 1 and 2 skip everything in `keep`, so when the last group is the
one causing the overflow, step 3 fires and targets `keep[0]` — **the newest user turn** — and
evicts it *first*. The `while len(protected) > 1` loop then re-enters with a single group
left, `keep` collapses to `[0]`, step 3 fires again, and the last group goes too.

The docstring calls this the "stated limitation" and scopes it to *"the question alone exceeds
the entire budget"*. That is not the trigger. Measured on a **20,000-token budget** with a
40-character question:

```python
m = [S("You are a helpful agent.")]
for i in range(6):
    m += [U(f"Q{i}: clause {i}?"), A(f"Clause {i} says ...")]
m += [U("FINAL QUESTION: summarise every clause for the board."),
      AT([tc("c9")]), T("c9", "DOC " + "x"*200000)]
trim_messages_to_fit(m, max_tokens=20000, reserve_recent=10)
```

```
budget=20000  in=50173  out_roles=['system', 'user']  users=[]
```

The returned list is `[system, "[Earlier conversation history was trimmed…]"]`. **Every user
question, including the one the turn cannot proceed without, is gone** — while the 200 KB tool
result that caused the overflow was the thing `keep` protected. This is precisely
`BUG-260906-01`, and the agent loop re-trims at the top of *every* iteration after appending
tool results, so this is the loop's normal steady-state shape, not an edge case.

Verified identical on the base commit (`OLD budget=20000 roles=['system','user'] users=[]`) —
so HONEST-01 changed nothing for this shape. The new fences cannot see it because
`_bug_shaped_history` builds *many medium* tool payloads (`chunk_chars=4000/6000`), never one
dominant payload in the newest group.

**Fix:** step 3 must prefer a protected group that carries **no** user turn before it gives up
the question. Driven and verified:

```python
    # 3 — last resort: a protected group must go after all. Give up the NON-USER
    # protected group first (it is the one that is over budget); the newest user
    # turn is the last thing in the whole list that may be evicted.
    if target is None and allow_user and keep:
        _nonuser_keep = [gi for gi in keep if not _has_user(groups[gi])]
        target = _nonuser_keep[0] if _nonuser_keep else keep[0]
```

With that one change, the same call returns `['system', 'user'(marker), 'user']` with
`users=['FINAL QUESTION: summarise every clause for the board.']` at budgets 6000 / 12000 /
20000. Add a fence with a **single dominant payload in the newest group** — the shape the
current fences structurally exclude.

---

### CR-02: The trimmer can return an orphaned `tool` message — a hard provider 400

**File:** `backend/app/services/context_window.py:647-659` (the `keep`-the-last-group rule), reachable from PASS 2 at `backend/app/services/context_window.py:416-419`

**Issue:**

`_remove_oldest_evictable`'s docstring promises:

> `context_window.py:619` — *"⛔ **Every removal is a COMPLETE atomic group** … so an assistant with `tool_calls` always leaves with its results and **a lone orphan tool result is removed as its own group rather than stranded**."*

It is stranded. `protected = rest[-reserve_recent:]` is a **raw index slice**, not a
group-aware one, so an `assistant(tool_calls) + tool + tool` group can be split across the
trimmable/protected boundary. PASS 1 (`allow_user=False`) removes the parent from `trimmable`;
PASS 2 then removes the orphan tool groups from the head of `protected` — **except the last
one, which `keep` protects because it is `len(groups)-1`.** `keep` does not ask whether the
"last group" is a valid turn or a headless tool result.

Measured (shipped code, `backend/venv`):

```
*** rr=2 b=3500 ORPHANS=['z2'] CHILDLESS=[] roles=['system', 'user', 'tool']
*** rr=1 b=7000 ORPHANS=['z2'] CHILDLESS=[] roles=['system','user','user','user','user','user','user','tool']
```

The returned list contains a `role: "tool"` message whose `tool_call_id` is produced by no
preceding assistant. OpenAI rejects this with
`400 Invalid parameter: messages with role 'tool' must be a response to a preceding message
with 'tool_calls'`; Anthropic rejects an unmatched `tool_result` block the same way. The run
dies with a provider error rather than a degraded answer.

`test_1_3_tool_pair_integrity_survives_the_new_order` is the fence that claims to cover this
and does not: it drives `turns=8, reserve_recent=10`, a shape where the trim happens to
resolve the boundary before returning. Reproduced identically on the base commit — pre-existing,
but the phase asserted the invariant and added a fence for it.

**Fix (belt and braces — do both):**

1. Do not `keep` a last group that is a headless tool message:

```python
    if protect_tail:
        ...
        _last = len(groups) - 1
        # A lone tool result is not a "final turn" — never protect it as one.
        if _last not in keep and groups[_last][0].get("role") != "tool":
            keep.append(_last)
```

2. Sanitise the candidate before returning, so no ordering bug can ever emit an invalid
   request:

```python
def _drop_orphan_tool_messages(msgs: list[dict]) -> list[dict]:
    live: set = set()
    out: list[dict] = []
    for m in msgs:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            live |= {tc.get("id") for tc in m["tool_calls"] if tc.get("id")}
        if m.get("role") == "tool" and m.get("tool_call_id") not in live:
            continue        # headless — its parent was trimmed away
        out.append(m)
    return out
```

and return `_drop_orphan_tool_messages(_build_candidate(...))` from `trim_messages_to_fit`.
Pin it with the reproduction above (`reserve_recent` chosen to split an atomic group).

---

### CR-03: The HONEST-02 reasoning arm is unreachable for OpenAI, Anthropic, Google and OpenRouter — and the arm that fires instead tells those users "no reasoning"

**File:** `backend/app/services/agent_loop.py:3117-3133` (arms 1 and 3); root cause at `backend/app/services/provider_gateway/openai_compat.py:292` and `backend/app/services/provider_gateway/events.py:18`

**Issue:**

Arm 1 is gated on `reasoning_chars_this_run > 0`, which is incremented **only** from the
`reasoning_delta` canonical event (`agent_loop.py:2226-2230`). `reasoning_delta` has exactly
two producers, both inside `openai_compat.py`:

- the `<think>` state machine, gated on `active_provider_name in ("moonshot", "deepseek", "minimax", "zhipu")` (`openai_compat.py:292`);
- DeepSeek's separate `delta.reasoning_content` field (`openai_compat.py:339-341`).

The Anthropic and Google adapters emit no reasoning event at all (`events.py:18` —
*"emitted only by the OpenAI path today"*; grep across `provider_gateway/` returns those two
sites only). Native OpenAI is routed through Chat Completions, not `/v1/responses`
(`openai_service.py:1770-1772` exists precisely because this app is on Chat Completions), and
OpenAI does not stream reasoning content there.

Against the CLAUDE.md eight-provider roster:

| Provider | arm 1 reachable? |
|---|---|
| OpenAI (gpt-5.6 family) | **No** |
| Anthropic | **No** |
| Google | **No** |
| OpenRouter | **No** |
| DeepSeek / Zhipu / MiniMax / Moonshot | Yes |

The code's own comment at `agent_loop.py:1752-1753` says this arm exists *"for exactly the
gpt-5.6 reasoning family the bug is filed against"*. **That is measurably false for the
shipped wiring**: a gpt-5.6 run that thinks and returns nothing falls through to arm 3, which
tells the user:

> *"The model produced no answer. Nothing we could see came back over N step(s) — **no text, no reasoning, no tool call** — and the provider ended the turn with 'stop'."*

So the headline requirement — tell the user their reasoning model reasoned and never answered —
is not delivered for the model family it was written for, and the message that *is* delivered
asserts a negative the backend never observed. That is the same overclaim class HONEST-02
exists to remove. The block comment at `agent_loop.py:3106-3110` acknowledges the limitation;
the **user-facing sentence does not**, and a comment is not a mitigation.

**Fix — two parts, both needed:**

1. **Make the arm reachable.** Emit `reasoning_delta` (or a `reasoning_tokens` signal) on the
   paths that have one. Anthropic streams `thinking_delta` on `content_block_delta`; OpenAI
   Chat Completions reports `usage.completion_tokens_details.reasoning_tokens`. Feeding either
   into `reasoning_chars_this_run` (rename to `reasoning_observed`) makes arm 1 fire for the
   families it was written for. This is adapter-boundary work, which is where D-14 says it
   belongs — it does **not** add a provider branch to the shared fallback.

2. **Until (1) lands, stop arm 3 asserting a negative it cannot see.** Drop `no reasoning`
   from the enumeration:

```python
            elif finish_reason:
                fallback = (
                    f"*The model produced no answer. No text and no tool call came back "
                    f"over {_steps} step(s), and the provider ended the turn with "
                    f"'{finish_reason}'. Some providers do not report reasoning to us, so "
                    f"the model may have been thinking without saying so.{_tail}*"
                )
```

3. Add a fence that names the reachable provider set, so the gap cannot silently persist —
   e.g. assert that every provider in `MODEL_CAPABILITIES` either produces a `reasoning_delta`
   or is listed in an explicit, commented `_NO_REASONING_SIGNAL` set.

---

## Warnings

### WR-01: The widened reconciler gate is thread-scoped with no live-run check — `cancelled` is exactly the status followed by an immediate re-prompt

**File:** `backend/app/services/run_producer.py:161-175`

**Issue:** `reconcile_open_todos_on_run_end(pool, thread_id, …)` marks **every** open todo on
the **thread**, not the todos of the run that just ended. The gate widened from
`terminal_status == "completed"` to `terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE`
(`completed`/`failed`/`cancelled`/`timed_out`), and step 3 runs **before** step 4's
`finalize_run_terminal`, i.e. before this run's `runs_by_thread:{tid}` ZREM.

Nothing in `send_message` refuses a second Deep run while one is live on a thread (the 409 at
`threads.py:789` is the workflow-anchor lock, not a Deep-run lock), and the finalizer runs
under `asyncio.shield` with several DB round-trips ahead of step 3. A user who hits Stop and
immediately re-prompts — the single most likely sequence after `cancelled` — can have the dying
run's reconciler append `" (run ended — not completed)"` to the **new** run's still-open todos.
The frontend then reads `not_ticked` with `RUN_ENDED_TITLE` on live work. That is
`BUG-260913-02` re-created by the fix for `BUG-260902-01`.

The new fences cannot see this: `test_250_reconciler_gate.py` drives `_finalize_producer_run`
with a fake reconciler and asserts only whether it was *called*.

**Fix:** make step 3 refuse when another run is still live on the thread, using the registry
that already exists:

```python
    _other_live = 0
    try:
        _other_live = await redis.zcard(f"runs_by_thread:{thread_id}")
    except Exception:
        logger.exception("RUN-01b: runs_by_thread read failed for %s", thread_id)
    if (
        terminal_status in _RUN_STATUS_TO_TERMINAL_TYPE
        and result_sink.get("cap_disposition") != "cap_paused"
        and _other_live <= 1          # only this run is still registered
    ):
```

Add a fence: two runs registered on the thread → `reconciled is False`.

---

### WR-02: Arm 1 outranks arm 2, so a reasoning model that ran tools is told only about the reasoning — and "this turn" is said about a RUN-scoped counter

**File:** `backend/app/services/agent_loop.py:3117-3127`

**Issue:** Two separate wording/ordering defects in the arm the phase calls load-bearing.

1. **Precedence swallows the more actionable fact.** `if reasoning_chars_this_run > 0` is
   tested before `elif _n_tools > 0`. A DeepSeek/Moonshot run that reasoned *and* executed six
   tool calls *and* wrote nothing produces: *"The model spent this turn reasoning and never
   wrote an answer — 4,120 characters of reasoning across 7 step(s), and no visible reply."*
   The six tool calls — the part the operator can act on — are never mentioned. For the four
   providers where arm 1 *is* reachable (see CR-03), this is the common shape, which makes
   arm 2 nearly dead.

2. **"this turn" is a claim the counter cannot support.** `reasoning_chars_this_run` is
   deliberately **run-scoped and never reset** (that is the whole point of its introduction at
   `agent_loop.py:1749-1756`). The sentence says *"spent **this turn** reasoning"* and then
   *"across {_steps} step(s)"* in the same breath. If the model reasoned on iteration 1 and
   emitted literally nothing on iterations 2-7, the message asserts something about the final
   turn that the counter did not observe.

**Fix:** state both facts when both are true, and use run-scoped language:

```python
            _bits = []
            if reasoning_chars_this_run > 0:
                _bits.append(f"{reasoning_chars_this_run:,} characters of reasoning")
            if _n_tools > 0:
                _bits.append(f"{_n_tools} tool call(s)")
            if _bits:
                fallback = (
                    f"*The model produced {' and '.join(_bits)} over {_steps} step(s) "
                    f"and never wrote an answer.{_tail}*"
                )
```

---

### WR-03: The page-blanking hook bug is already caught by this repo's own eslint — the fix added a narrower hand-rolled regex instead of wiring lint in

**File:** `frontend/src/components/panel/TodosSection.tsx:211-222` and `frontend/src/components/panel/__tests__/TodosSection.test.tsx:326-349`

**Issue:** `frontend/eslint.config.js:20` already extends `reactHooks.configs.flat.recommended`,
which sets `react-hooks/rules-of-hooks` to error. Driven against a reconstructed pre-fix file:

```
$ npx eslint --stdin --stdin-filename src/components/panel/TodosSection.tsx < bugged.tsx
  220:56  error  React Hook "useLoadingForThread" is called conditionally. React Hooks must be
                 called in the exact same order in every component render  react-hooks/rules-of-hooks
```

The defect that blanked the page **would have been caught by a tool already configured in this
repository**, with a better message than the one the new fence produces. The phase's response
was a 20-line comment plus a regex in one test file. That regex is materially narrower than
the invariant it claims to protect — it cannot see any of:

```tsx
const v = cond ? useA(id) : useB(id)     // conditional hook, ternary
if (x) { const a = useA() }              // conditional hook, block
if (todos.length === 0) return null      // early return ABOVE a hook added later
```

and `TodosSection.tsx:225` already has an early `return null`, so the third shape is one edit
away in this exact file.

**Fix:** the real remedy is a lint gate, not another `?raw` fence. Add an eslint run to the
frontend gate (or a `pre-commit`/PostToolUse hook alongside the existing CLAUDE.md size guard)
scoped at minimum to `react-hooks/rules-of-hooks` as an error. Keep the source fence if you
like it, but record in its docblock that it is a **backstop for a lint rule**, not the
primary guard — otherwise the next occurrence gets the same 20-line comment.

---

### WR-04: The honest reason is reachable only by mouse hover — screen-reader and keyboard users lose it entirely

**File:** `frontend/src/components/panel/TodosSection.tsx:126`

**Issue:** `RUN_ENDED_TITLE` is rendered as `title={…}` on a plain `<li>`. An `<li>` is not
focusable, so the tooltip never appears for a keyboard user; and `title` on a non-interactive
element is not reliably announced by any major screen reader. Before this phase the reason was
in the row's **text content** (`… (run ended — not completed)`), i.e. in the accessible tree.
After it, the only thing in the accessible tree is `Not ticked`, which does not say why.

This file's own contract is explicit about that tree — `TodosSection.tsx:142-145`: *"Status
text — non-color-only A11Y; in the accessible tree (NOT aria-hidden) so the status is conveyed
by text, not color alone."* The axe fences at `TodosSection.test.tsx:117` and `:180` cannot see
this: axe does not flag a `title` on a non-interactive element, and the `markedTitle` test
asserts only that the attribute is present.

**Fix:** put the reason in the accessible tree alongside the tooltip:

```tsx
      {wasMarked && status === "not_ticked" && (
        <span className="sr-only">{RUN_ENDED_TITLE}</span>
      )}
```

and add a fence asserting the sentence is reachable via `getByText`, not just via
`toHaveAttribute("title", …)`.

---

### WR-05: `trim_messages_to_fit` can return a list that still exceeds `max_tokens`, silently

**File:** `backend/app/services/context_window.py:441-446`

**Issue:** `_remove_oldest_evictable`'s docstring cites D-078-02 as *"this function ALWAYS
returns a list that fits, it never raises"* (`context_window.py:674-676`). Measured — an
oversized system prompt against a small budget:

```python
trim_messages_to_fit([S("S"*40000), U("What is clause 3?"), AT([tc("c1")]), T("c1","CHUNK "+"x"*5000)],
                     max_tokens=2000, reserve_recent=10)
# -> ['system', 'user'(marker)]   fits: False
```

All four passes exhaust, the loops break correctly (no hang — termination is sound), and the
function returns an over-budget list **with no log line**. Downstream this is the failure mode
`resolve_context_budget`'s own docstring describes: `400: request (41206 tokens) exceeds the
available context size (32768)`, with no trace pointing at the trimmer. This is entirely
reachable on a 32k local model with a large skill catalog, which is the configuration
CLAUDE.md documents.

**Fix:** a single honest log at the exit, so the next 400 is one grep away:

```python
    _out = _build_candidate(system_msg, trimmable, protected, trimmed_any, pinned_msgs)
    _final = estimate_messages_tokens(_out)
    if _final > max_tokens:
        logger.warning(
            "trim_messages_to_fit: EXHAUSTED and still over budget — %d > %d "
            "(system_msg alone is %d). The provider will reject this request.",
            _final, max_tokens, estimate_messages_tokens([system_msg] if system_msg else []),
        )
    return _out
```

---

### WR-06: The `isStreaming || isLoading` liveness claim is untested, and the suite structurally cannot test it

**File:** `frontend/src/components/panel/TodosSection.tsx:205-222`

**Issue:** The comment claims `useLoadingForThread` closes the window where
`streamingThreads` reads empty for a live run. `loadingThreads` is added and removed **inside
`loadMessages`** (`StreamsProvider.tsx:3276-3278` add, `:3387-3390` remove), while
`streamingThreads` is filled by a *different* code path (the reconcile-derive at
`StreamsProvider.tsx:2178`, the reattach at `:2796`). Nothing proves the two windows abut. If
`loadMessages`' `finally` clears `loadingThreads` before the reconcile-derive adds the thread
to `streamingThreads`, **every open todo flashes `Not ticked` mid-run** — the exact
"mirror-image failure" the comment names as the thing it must not do.

`TodosSection.test.tsx:269-278` asserts only that `loading=true, streaming=false` reads
`IN PROGRESS`. Both selectors are `vi.fn()`, so the suite pins the mock's ordering, not the
provider's.

**Fix:** either (a) prove the ordering with a `StreamsProvider`-level test that drives
`loadMessages` → reconcile-derive against the real store and asserts
`isStreaming || isLoading` is never false while a run row exists, or (b) sidestep the ordering
entirely by deriving liveness from the thread's own run row rather than from two transient
sets. Until one of those exists, soften the comment from a claim to an assumption — this
phase's whole subject is not stating things the system has not observed.

---

## Info

### IN-01: `_remove_oldest_atomic` is now dead code, and the reason given for keeping it is refuted by a grep

**File:** `backend/app/services/context_window.py:689-750`

**Issue:** The retention rationale reads *"deleting a shipped function to tidy a diff is how a
caller nobody grepped for breaks silently"* (`context_window.py:694-696`). Grepped:
`_remove_oldest_atomic` appears in **one file in the whole backend** — its own definition.
Not one call site, not one test. 62 lines of unreachable code justified by a hazard that does
not exist here.

**Fix:** either delete it in the same commit that lands CR-01's fix, or keep it and pin it with
a unit test so the claim "this is the primitive the newer helper's contract is stated against"
is executable rather than prose.

### IN-02: Dead condition in `_build_candidate`

**File:** `backend/app/services/context_window.py:565`

**Issue:** `if add_marker and trimmable is not None:` — `trimmable` is a `list` on every call
site and can never be `None`. The second conjunct is always true.

**Fix:** `if add_marker:`.

### IN-03: Vestigial outer `try` / `finally: pass` in the producer

**File:** `backend/app/services/run_producer.py:394`, `:588-589`

**Issue:** `finally: pass  # outer try kept structurally` — the outer `try` now wraps a single
inner `try` and contributes nothing. Pre-existing, but it sits directly on the block this phase
edited and makes the eight-invariant ordering harder to read than it needs to be.

**Fix:** collapse the outer `try/finally` into the inner one in a dedicated no-behaviour-change
commit, or delete the `finally: pass` and keep the `try` only if something still needs it.

### IN-04: The hook fence re-implements `stripComments.testutil.ts` and does not strip block comments

**File:** `frontend/src/components/panel/__tests__/TodosSection.test.tsx:345`

**Issue:** `line.replace(/\/\/.*$/, "")` is a third hand-rolled copy of a rule the repo
deliberately centralised — `frontend/src/lib/stripComments.testutil.ts` exists *because*
"the repair for *two copies of a rule drift* must not itself be two copies of a rule"
(`stripComments.testutil.ts:13-15`), and CLAUDE.md's ledger names it the ONE home. The local
copy also misses `/* … */` blocks, so a future JSDoc quoting the forbidden pattern — which this
file already does in `//` form at `TodosSection.tsx:212` — would fire the fence falsely.

**Fix:** `import { stripComments } from "@/lib/stripComments.testutil"` and run the regex over
`stripComments(src).split(/\r?\n/)`.

### IN-05: `test_2_1` asserts three sentences for a taxonomy it calls "closed" at four

**File:** `backend/tests/unit/test_250_run_honesty_agent_loop.py:253-256`

**Issue:** The docstring says *"SC#2 — four arms"*; the assertion is
`assert len(sentences) >= 3`. Deleting one arm — most plausibly arm 2, which CR-03/WR-02 show
is nearly dead in practice — keeps the fence green.

**Fix:** assert the arm **count** structurally rather than counting string literals, e.g. that
the block contains exactly one `if`, two `elif` and one `else` after `_identifiers_only`.

---

_Reviewed: 2026-09-15T14:19:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
