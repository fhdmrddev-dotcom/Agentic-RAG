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
| backend unit | 70 failed | ⚠ **71 failed** — see below |

⭐ **The adoption arithmetic is exact and was checked rather than assumed:** pinned 6432 → 6502 is
**+70**, and 8+12+11+29+7+3 = 70.

## ⚠ ONE OPEN FINDING — the backend is +1 over baseline and I did not resolve it

**Measured, twice, stable:** `71 failed / 3476 passed`. The 223-close baseline was `70 failed / 3477
passed`. **The totals are identical (3547), so exactly ONE test flipped pass → fail.**

What is established:
- `tests/unit/test_chat_tool_approval.py::test_tool_approval_ask_emits_event_and_pauses` fails on
  `KeyError: 'call_id'`.
- ⚠ **That specific failure is provably NOT this phase's doing** — `git show e01990d55:…` and the
  current file both show the approval emit has **never** passed `call_id` as a kwarg.

What is **not** established: which test actually flipped. **The most likely cause is `224-02` adding
`expires_at` and `timeout_seconds` to that same emit** — a test asserting the exact kwarg set would
flip on that. ⚠ **I am recording this rather than clearing it.** An honest open item is worth more than
a clearance I cannot support, and the controlled comparison (run the suite at `e01990d55`, diff the
failure lists) is the first thing the reviewer should do.

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

## Still owed — and it cannot be closed from a terminal

⛔ **The acceptance bar for this phase is VISUAL and jsdom cannot judge it.** Owed browser checks:

1. The approval card is **reachable on arrival** at a laptop viewport, and shows a deadline it was
   **told** rather than one it invented.
2. References is **folded**, and its trigger is findable — on **both** components.
3. The panel todo label wraps by the sentence at the 300 px floor.
4. Nothing regressed on the run card after the glyph removal.
