# Phase 224 — SUMMARY

**What the Agent Is Doing Reads Like a Sentence.** Five plans, three waves. `224-01`–`224-03` built
by Gemini; **`224-04` and `224-05` built by Claude**, which changes who may review this phase (below).

---

## What shipped

| | |
|---|---|
| **Winner D — the orphan is deleted** | `SeamCard`'s `write_todos` and `workspace_write` arms are gone. **`ask_user` survives** — it is the only record a human decided anything. `seamKindFor` is now an explicit `ask_user`-only check. |
| **The vocabulary is shared** | `toolName` / `TOOL_PHRASES` moved into `@/lib/toolNames`; `components/workflows/toolNames` is now a shim pointing the *safe* direction. `toolLabel` falls back to it, so no raw id reaches a person. |
| **Winner A — the approval card is reachable** | Docked above the composer while pending, with a live countdown. |
| **The deadline is on the wire** | `_APPROVAL_TIMEOUT_SECONDS` is a single module constant feeding the `wait_for`, the `expires_at`, the emit and the audit string. `timeout_seconds` ships beside `expires_at`, so the client anchors locally and clock skew cannot affect it. |
| **The glyph is gone** | `<Square>` removed from both terminal-status sites and its import with it. |
| **`BUG-260902-07`, both halves** | References folds by default, unconditionally; `CitationList` and `RunCard`'s Thinking fold mount **one shared `FoldTrigger`**. The Thinking default is untouched. |
| **The panel todo wraps by the sentence** | Not by the badge, at the measured 300 px floor. |
| **Six suites adopted into the gate** | `Seam` 8 · `TodosSection` 12 · `CitationList` 11 · `RunCard` 29 · `RunCard.timer` 7 · `ChatArea.approval` 3. |

## Gates

| gate | baseline | result |
|---|---|---|
| `tsc -p tsconfig.app.json` | 66 | **66** ✅ |
| count gate | 188/188 · pinned 6432 | **OK · 194/194 · pinned 6502 · total 7234 · failed 0** ✅ |
| backend unit | 70 failed | **71 failed** — ✅ **not this phase**, proven by reverting 224's only backend file and getting the identical 71 (below) |

⭐ **The adoption arithmetic is exact and was checked rather than assumed:** pinned 6432 → 6502 is
**+70**, and 8+12+11+29+7+3 = 70.

## ✅ RESOLVED — the backend +1 is NOT this phase, and it was settled by a controlled comparison

**Measured, twice, stable:** `71 failed / 3476 passed`. The 223-close baseline was `70 failed / 3477
passed`. **The totals are identical (3547), so exactly ONE test flipped pass → fail.**

What is established:
- `tests/unit/test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses` fails on
  `KeyError: 'call_id'`.
- ⚠ **That specific failure is provably NOT this phase's doing** — `git show e01990d55:…` and the
  current file both show the approval emit has **never** passed `call_id` as a kwarg.

⭐ **DRIVEN, NOT REASONED — the controlled comparison was run rather than handed over.** Phase 224's
ENTIRE backend footprint is two files (`git diff --name-only e01990d55 HEAD -- backend/`):
`tool_dispatcher.py` and the new `tests/test_224_approval_deadline.py`, the latter outside
`tests/unit`. So reverting **one file** isolates the phase completely:

```
git checkout e01990d55 -- backend/app/services/tool_dispatcher.py
pytest tests/unit   →   71 failed, 3476 passed          ← pre-224 dispatcher
git checkout HEAD   -- backend/app/services/tool_dispatcher.py
pytest tests/unit   →   71 failed, 3476 passed          ← with 224
```

**Identical. Phase 224 did not cause it.** The `70` was measured earlier in the session, during the
223 check; something between that reading and `e01990d55` moved it, and it is **not this phase**.
⚠ My own hypothesis — that `224-02`'s two new emit kwargs flipped a test asserting the exact kwarg
set — **was WRONG, and is recorded as wrong rather than deleted.** The reverted-file run disproves it.

⚠ **The `call_id` KeyError is a REAL pre-existing failure and should not be lost in this clearance.**
`test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses` asserts on a kwarg the
approval emit has never sent, before or after 224. It is failing for a genuine reason — the test and
the code disagree — and it belongs to whoever next touches that emit. It is NOT this phase's to fix,
and it is NOT resolved by this phase passing.

## Deferred, with a trigger — NOT dropped

Two of `224-04`'s must_haves were **not built**, deliberately:

1. **The right-aligned step-result column.**
2. **The status line moving inside the run frame.**

**Why:** both live in files outside the plan's declared `files_modified` — the step rows are rendered
by `ToolCallPanel.tsx` (a separate *extraction due* hot file), and the status line by `MessageItem`
while the frame is `RunCard`. ⚠ **And the column has an unresolved conflict with the operator's own
2026-08-31 noise audit** (`ToolCallPanel.tsx:420-430`), which *removed* a per-row column because *"the
eye went to the least informative thing on it."*

⭐ **Both go to Phase 227 (`The Run Frame Has One Owner`)**, proposed from this phase's execution: one
visual object is rendered by three files and none owns it, which is why two small visual changes became
scope questions. **Trigger: 227's execution.** After it, both are one-file edits.

## What was corrected mid-flight, and by whom

- **Gemini caught a fifth `120.0` site** I had not named (the audit reason string).
- **Gemini's skew fix was better than either option offered** — emitting `timeout_seconds` and
  anchoring on receipt removes skew rather than accepting it.
- **Claude's pre-flight was wrong twice**, both corrected in `224-PREFLIGHT.md` beside the originals:
  the predicted count-gate *decrease* could not happen (`Seam.test.tsx` was neither run nor pinned),
  and the claim that `CitationList`/`RunCard` had *no suite* was false — four existed and passed.
- **Claude widened scope once and reverted it:** a first pass swapped `References · 2 sources` for a
  count chip and broke three Phase 153 tests. **They were right** — the reported bug is the affordance,
  not the copy.
- **A dead helper was found by the compiler, not by review:** `hasInRangeMarker` became unreferenced
  when References went unconditional, and a comment claiming otherwise was corrected in place.

## ⚠ Who may review this

`AGENTS.md` §3.1 — whoever reviews must not have shaped the build. **Claude drew the sketches AND built
`224-04`/`224-05`, so Claude cannot review this phase.** It goes to **Gemini**.

⚠ **That is unchanged by the finding above being resolved.** Clearing my own work's suspected
regression is measurement, not review — the reviewer still has to check the parts I built.

## The visual bar — DRIVEN 2026-09-03, and what it could and could not reach

⛔ The acceptance bar is VISUAL and jsdom cannot judge it, so it was driven in a real browser against
the live app (`localhost:5173` + backend `:8000`). ⭐ **Measured by COMPUTED STYLE, not by eye** — a
screenshot would have shown a pill; `getComputedStyle` proves it is one.

| check | result |
|---|---|
| **No regression** — five chat/panel components changed | ✅ app mounts, `#root` populated, composer present, **no vite error overlay**, **no console errors or exceptions** |
| **`BUG-260902-07` half 1 — References folds by default** | ✅ `aria-expanded="false"` on a settled message with **5 sources** — precisely the case that used to open every time |
| **`BUG-260902-07` half 2 — the trigger reads as a control** | ✅ `border-width: 0.8px` · `border-radius: 9999px` · `background: rgba(238,239,242,0.5)` · `font-weight: 500`. It has a border, a shape, a surface and weight; before, it had none of the four |
| **The copy survived the affordance fix** | ✅ renders `References · 5 sources` verbatim — the count is visible while CLOSED |
| **The fold actually works** | ✅ click → `aria-expanded="true"` and the panel's text grows; click again → back to `"false"` |

### ⚠ Three checks the drive could NOT reach, stated rather than implied

1. **The terminal-status glyph removal.** No thread in the sample carried a `timed_out` / `stopped` /
   `cancelled` run, so no status line rendered and **the `<Square>` removal is verified only by source
   and by suite, never on screen.**
2. **The docked approval card above the fold.** Reproducing it needs a live connector call paused on
   `ask` — real credentials and a real third-party round trip. **Not reachable from a terminal.**
3. **The panel todo wrap at the 300 px floor.** Needs a thread with a long todo and the panel open at
   a laptop width.

⭐ **These are OWED, not passed.** The phase closes with them recorded as a decision — `CLAUDE.md`
allows exactly that (*"closing a phase with owed manual UAT rows is legitimate ... but state it as a
DECISION, never as a claim that everything ran"*). **Run #2 first** — it is the safety gate, and it is
the only one where being wrong has a cost beyond appearance.
