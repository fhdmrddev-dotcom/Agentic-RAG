# Phase 224 — PREFLIGHT

**Written 2026-09-02 by Claude (reviewer), before Gemini plans.** Base `develop`, post-sketch.

**What this is.** ⚠ **Not build direction.** Measurements taken at HEAD while sketching, recorded so
they cannot be re-derived wrongly or assumed. Every claim names a file and line so it can be refuted
rather than trusted.

⚠ **A DECLARED CONFLICT, up front rather than at the close.** I drew sketches 223 and 226, which the
operator approved as this phase's acceptance bar. `AGENTS.md` §3.1 says whoever reviews a phase must
not have shaped the build. My reading — and the operator's, on 2026-09-02 — is that an
**operator-approved sketch is the OPERATOR's acceptance bar, not mine**, which is exactly what the
sketch checkpoint gate exists to produce. **It is recorded here so it is a decision, not a discovery.**
The consequence for my post-phase check is that it must be driven against the *shipped product*, never
against my own drawings.

---

## 1 · The scope is NOT the ROADMAP entry above the change bar

**Read `224-PROPOSAL.md` §`SCOPE CHANGE 2026-09-02` FIRST.** The proposal's original scope list and the
ROADMAP checklist line are **pre-sketch** and are superseded where they conflict. Two things moved:

- ⛔ **`SEED-128` (the reasoning timeline) is OUT**, on the operator's own words — its final entry
  records *"this is for the next milestones."* It had been marked `folded_into: 224`; that fold
  contradicted the direction that re-raised it. The seed is back to `planted`.
- ⭐ **`BUG-260902-07` is IN** — found during the sketch pass.

---

## 2 · What the sketches decided, and the measurement under each

### 2.1 Sketch 223 → **D · delete the seam card**

Delete `SeamCard`'s **`write_todos`** and **`workspace_write`** arms. ⚠ **`ask_user` SURVIVES.**

**The premise for keeping the card is measurably FALSE.** `SeamCard.tsx:3-8` justifies itself with
*"on thread reload the panel reconciles to current state and does NOT replay history, so the transcript
must be self-contained."* But:

- `StreamsProvider.tsx:106` — `useDerivedPanel` is *"a PURE read over the viewing thread's **persisted
  chat `tool_calls`**"*, and `workspacePanel.ts:204` takes the latest `write_todos` snapshot from them.
  **Panel and card read the same durable rows.**
- `FilesSection.tsx:158` — `useWorkspaceFiles` **fetches from the server** (`getThreadWorkspaceFiles`
  via `usePanelReconcile`), which is *more* durable than the transcript. `workspace_write`'s card is
  the weaker copy of the two.

⚠ **`ask_user` is a different category and must not go with them.** `You answered X` is the only record
a human made a decision; the panel shows a *pending* question, never an answered one, and
`SeamCard.tsx:6-8` says it *"CLOSES the documented ask_user reload gap"*.

⭐ **Precedent:** `MessageItem.tsx:536` already deleted the **live** pointers at SEED-098 — *"todos live
only in the right Workspace panel."* Only the reload card survived, because nobody re-checked its
premise. This finishes that job.

### 2.2 Sketch 226 → **A · dock the approval above the composer**

While a decision is pending it is **state, not content**, so it leaves the scrollback for the region
always on screen. **B's jump chip is the recorded fallback** with a concrete trigger (below).

⭐ **A's reload seam is cheaper than it looks, and 223 settled it.** D keeps the `ask_user` arm because
it is the record of a human decision. **An approval decision is the same category** — so a docked card
resolves through **a new `SeamKind`, not new machinery.**

⚠ **The fallback fires only if** a docked approval's decision cannot render back into the transcript at
the quality `SeamCard` already reaches for `ask_user` — a hole on reload, or machinery beyond a new
`SeamKind`. **Decide this at plan-phase, BEFORE the dock is built.** Deciding after means building it
twice.

---

## 3 · The construction hazards, ranked by how quietly they bite

### 3.1 ⭐ A COUNTDOWN CANNOT BE BUILT CLIENT-SIDE — the deadline must go on the wire

`ToolApprovalRequest` (`ChatToolApprovalCard.tsx:58-68`) carries `callId` · `connectionId` ·
`serviceId` · `serviceName` · `toolName` · `args` — **and no deadline.** The 120 s lives only at
`tool_dispatcher.py:4443` (`asyncio.wait_for(…, timeout=120.0)`).

**A client-side timer would duplicate a server constant and drift the first time anyone tunes it.**
Whatever duration ships, the card must be *told*, not left to guess. ⚠ The card today has **no notion
of time at all** — grep it for `timeout`/`countdown`/`expire` and the only `120` is `ARG_VALUE_CHARS`,
unrelated.

### 3.2 ⭐ `BUG-260902-07`'s two halves have DIFFERENT blast radii — do not treat them as one

| half | scope |
|---|---|
| **default state** — fold References by default | **ONE component.** `MessageItem.tsx:619` passes `defaultOpen={hasInRangeMarker(…)}`; a grounded answer normally has markers, so it is open *every time*. |
| **affordance** — the trigger reads as prose | **TWO components.** `CitationList.tsx:32-44` *and* `RunCard.tsx:481-484` (the Thinking fold) carry the identical `text-xs text-muted-foreground` + 12px chevron, no border, no surface. |

⚠ **DO NOT "fix" the Thinking block's default.** It is already `useState(false)` (`RunCard.tsx:90`) and
is correct. Flipping it would be a regression dressed as consistency.

⚠ **The default-state change REVERSES a shipped decision** — `CitationList.tsx:9-14` calls it the
*"canonical open-by-default contract (D-06/D-07)"* from Phase 153. The operator's direction supersedes
it; say so in CONTEXT so a later phase does not "restore" it as an oversight.

⭐ The affordance fix should be **one thing used twice**, not two similar things — the
`connectionMark` / `TOOL_PHRASES` lesson: a second copy is how two surfaces drift.

### 3.3 The vocabulary already exists and chat simply does not import it

`toolNames.ts:114` — `write_todos: "Track its to-dos"`, plus `ask_user: "Ask a person"` and
`workspace_write: "Write a file"`. It lives in `components/workflows/` and **chat never imports it**.

⚠ `WRITE_TODOS` is **nobody's string**: `SeamCard.tsx:43` returns the raw kind and `:51` applies a CSS
`uppercase`. There is no literal to grep for. ⚠ And read `toolNames.ts`'s own docblock before touching
it — it forbids a coalesced bracket read (`own()` exists because a plain object literal inherits
`constructor`, and the chip rendered as **nothing at all**).

### 3.4 The panel cannot simply be widened

`ChatLayout.tsx:727` is `clamp(300px,30%,420px)`. The operator's measured **308px** means it is
essentially **at its floor** on an ordinary laptop, so the todo-label wrap must be fixed in the
**label/badge layout**, not by a bigger number.

### 3.5 The Stitch pass contributed two changes, and both live inside `RunCard`

The status line moves **inside** the run frame, and each step's result takes a **right-aligned column**.
⚠ Both are `RunCard` internals — which is the file `MessageItem.tsx:841` was written to avoid touching
(*"ADDITIVE ONLY … never a touch of RunCard internals (G-5)"*). **This phase takes that G-5 obligation
deliberately.** Sketch variant C was rejected precisely because it could adopt neither.

---

## 4 · G-5 — four hot files, and two have read *extraction due* for some time

Re-derive rather than quoting these; they rot. Recipe is in `CLAUDE.md`.

| file | ledger says | note |
|---|---|---|
| `MessageItem.tsx` | 57 / 29 / 856 — **extraction due** | the seam-card block and the citation `defaultOpen` both live here |
| `ToolCallPanel.tsx` | 47 / 19 / 995 — **extraction due** | |
| `ChatArea.tsx` | 63 / 30 / 571 | |
| `WorkspacePanel.tsx` | 16 / 10 / 646 | ⚠ **cross-surface shell mounted by `ChatLayout`, with NO mount in any workflow page** — changes land in CHAT first |
| `RunCard.tsx` | 22 / 10 / 661 | §3.5 puts this in the blast radius; it is **not** in the ROADMAP's four |

⚠ **`RunCard.tsx` is missing from the ROADMAP entry's hot-file list** and the phase now edits it. A hot
file absent from a scan list is invisible to its own guardrail.

⭐ **Note what D does to the debt:** deleting two `SeamCard` arms *removes* code from `MessageItem.tsx`.
This is one of the rare phases that can discharge part of an *extraction due* row by subtraction.

---

## 5 · Gate baselines

| gate | baseline | note |
|---|---|---|
| `tsc` | **66** | ⚠ `-p tsconfig.app.json` — the bare form checks **zero** files |
| vitest count gate | pinned **6432**, total ~**7159**, **failed 0** | `GSD_VITEST_MAX_WORKERS=2`, from the repo root |
| backend unit | **70 failed** | that IS the baseline |

⚠ **SEED-171 is now SEVEN suites, and two were added on 2026-09-02**:
`library/ForkNameDialog.test.tsx` and `WorkflowCanvas.test.tsx`. **Capture failing filenames from the
gate's persisted JSON BEFORE re-running anything**, check them against `git diff --numstat`, and do
**not** touch the cap. ⭐ New hypothesis recorded there: every failure across both sightings was an
**aXe** or dialog-render assertion — the slowest work in the suite — so the file identity may matter
less than how many `axe` assertions land concurrently. **Untested; it is a hypothesis, not a finding.**

⚠ ~~**A count-gate DECREASE is EXPECTED this phase and is not a regression** — deleting two `SeamCard`
arms will delete their tests. `Seam.test.tsx` covers them. **The gate fails on a per-file decrease, so
the BASELINE pins must be updated in the same commit as the deletion**, and the summary must say which
file went down and by how much. A silent decrease and a deliberate one look identical to the gate.~~

⛔ **CORRECTED 2026-09-02, AFTER GEMINI HAD ALREADY PLANNED AROUND IT. The original is struck through
above rather than deleted, because being wrong in a pre-flight is the thing this document exists to
prevent.** Measured from the gate's own persisted JSON report — not from the `TARGETS` source, my first
read of which was incomplete and nearly produced a second wrong finding:

| suite | runs? | pinned? |
|---|---|---|
| `chat/__tests__/ToolApproval.test.tsx` (224-03) | ✅ RUNS | ✅ PINNED |
| `chat/__tests__/MessageInput.connectors.test.tsx` | ✅ RUNS | ✅ PINNED |
| **`panel/__tests__/Seam.test.tsx` (224-01)** | ⛔ **NOT RUN** | ⛔ **NOT PINNED** |
| **`panel/__tests__/TodosSection.test.tsx` (224-05)** | ⛔ **NOT RUN** | — |
| **`CitationList` / `RunCard` (224-04, 224-05)** | ⛔ **NO SUITE EXISTS** | — |

**So there is NO decrease and NO pin to update.** And the sharper consequence: 224-05's acceptance
criterion *"the count gate reports OK 188/188, 0 failing"* **passes whether or not four of the five
plans work.** Only 224-03 is genuinely guarded. ⚠ This is the Phase 214 shape — **TARGETS decides what
RUNS, BASELINE decides what is GUARDED** — with four surfaces outside both. The cheap remedy is to add
the touched suites to TARGETS and BASELINE within the phase, as 214 did at its close.

---

## 6 · What I will drive after execution

1. **No raw identifier reaches a person** — grep the rendered surface, not the source.
2. **The two `SeamCard` arms are gone and `ask_user` still renders** its answered card on reload.
3. **The approval card is reachable on arrival** at a laptop viewport, and **shows a deadline it was
   told**, not one the client invented.
4. **References folds by default**, and its trigger is legible — **on both components**, with the
   Thinking block's default **unchanged**.
5. **The status line sits inside the run frame** and results are right-aligned.
6. **Gates at or better than §5**, with the count-gate decrease explained and re-pinned.
7. ⚠ **Driven in a browser, not in jsdom.** The sketches are the acceptance bar and jsdom cannot judge
   whether a card is above the fold. This one needs the operator.
