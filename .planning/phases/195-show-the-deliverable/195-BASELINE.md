# Phase 195 — Pre-Change Live Baseline (D-16)

**Driven:** 2026-08-17, by the orchestrator via Chrome MCP against the live local stack.
**Purpose:** discharge **D-16** — *"the phase's FIRST task is to prove SC#1 on a LIVE RUN before
changing anything."* A baseline only proves something if it **PREDATES** the change (the 188.1
lesson). This file is committed **before any source edit in Phase 195**.

⚠ **This is a MEASUREMENT, not a claim.** Everything below was read off the running app or the live
local DB this session. Where something was **not** exercised, it says so rather than implying it.

---

## Verdict

| Success criterion | Verdict |
|---|---|
| **SC#1** — a completed workflow that produced a file shows that file from the run surface | ✅ **MEASURED ALREADY-SATISFIED.** Listed, named, sized and carrying a real download control |
| **SC#2** — no second file UI | ❌ **FAILS TODAY, as expected.** Three live presentations measured below differ in element, icon token, padding and path rendering |
| **SC#3** — many files handled by the shipped pattern | n/a on this run (1 file). ⚠ The criterion names a **retired** pattern and is corrected by this phase (**D-11**) |

**Consequence: CONTEXT's framing is confirmed. SC#1 needed no plumbing; the phase is a
CONSOLIDATION + SCOPING phase.** Scope does **not** grow.

---

## Environment as measured

| Dependency | Reading |
|---|---|
| Supabase API / Postgres / Redis | ✅ `54321` / `54322` / `6379` |
| Backend (uvicorn) | ✅ `8000` |
| Frontend (vite) | ✅ `http://localhost:5173` — ⚠ **binds `[::1]` ONLY.** An IPv4 probe of `127.0.0.1:5173` reports it DOWN while it is running |
| Chrome extension | ✅ connected, local, `Browser 1` |
| `.docx` reader | ✅ Word 2016 present, `.docx` → `Word.Document.12` — **D-20's "open the file" bar is achievable** |
| Session | already authenticated as `fhdmrd@gmail.com` = `d8a54002-6a29-4b88-b918-cff2aa4a06d5`, the `user_id` owning every run below |

⚠ **`visual_workflow_canvas` reads `"everyone"` in the live local `app_settings.feature_visibility`.**
Its **cold default is `"off"` — hidden from EVERYONE, operators included**
(`backend/app/models/user_settings.py:1197-1203`), and `ChatLayout.tsx:752` gates the whole run view
on `activeView === "workflow-run" && canvasEnabled`. **RUN-02's surface therefore only exists where an
operator has flipped the canvas on.** Recorded because this is exactly the trap Phase 194.1's D-09
amendment hit — a receipt fed from a canvas-gated read would have been invisible at the shipped
default. It is **not** a blocker for v3.7 (the milestone is workflow completion and the operator has
flipped it locally), but a plan must not assume the surface is on for a fresh install.

---

## The run used, chosen on evidence

`northwind-qbr-fa65a43c` **v1**, `published`, definition `93a86e21-be72-49a0-be85-dd01a3aa38ca`.

Live DB confirms research exactly — **6 completed file-producing runs, each with EXACTLY ONE `.docx`
at 38-40 KB, `kind` NULL and `run_claim` NULL on every row:**

| Run | Thread | File id | Bytes |
|---|---|---|---|
| **`833e8e85`** ← used | `1189a1a3` | `d4598e01` | **39,660** |
| `27cf1ab9` | `fb2be102` | `6a4c403f` | 39,511 |
| `4bdd5f4c` | `bed9e525` | `8c604a85` | 38,367 |
| `9d619a30` | `21e81a99` | `40b9acec` | 39,644 |
| `b021c7b0` | `d6947e29` | `bb032418` | 39,698 |
| `cb0e2e95` | `7e05797b` | `369a083c` | 38,950 |

`b021c7b0` at **39,698 B** is the Phase 193.2 UAT hero run — it matches `STATE.md` byte for byte,
which independently corroborates both records.

⚠ **`run_claim` is NULL on all rows**, re-confirming **D-01**: it is Phase 141 template-asset context
isolation, **not** the attribution field. `kind` is NULL too. **No migration is warranted.**

**Path driven:** Chat → the Northwind thread whose spine reads
`gather-usage ✓ | gather-support ✓ | gather-commercial ✓ | synthesize ✓ | emit-qbr ✓` →
the panel receipt **"Open the run"** → the run surface. This is the documented thread→run seam
(`ChatLayout.tsx:366-372` `openRunSurface`), **not** a rail item — no nav item claims this view.

---

## What the run surface actually renders (`data-testid="run-deliverables"`)

```
What this run produced
Northwind-QBR-Template.docx
38.7 KB
```

| Property | Measured value |
|---|---|
| Heading | **`"What this run produced"`** — ⚠ the exact literal **D-02** says overclaims. Confirms research **F3** (`WorkflowRunPage.tsx:122`) is live, not historical |
| Row element | **`<button type="button">`** |
| `aria-label` | `"Download Northwind-QBR-Template.docx (38.7 KB)"` |
| `title` | `"/Northwind-QBR-Template.docx"` (full path) |
| Visible name | `Northwind-QBR-Template.docx` (**basename**) |
| Size text | `38.7 KB` — 39,660 / 1024 = 38.73 ⇒ **KiB** formatting |
| Icon | `lucide-file-text` · `h-4 w-4 shrink-0 text-muted-foreground` · **16×16 measured** |
| Extension ribbon | **absent** |
| Row height | **33 px** |
| `<button>` count in region | **1** |
| `<li>` count | 1 |

⚠ **This independently confirms F10: the run page does NOT use `fileIcon()`.** `fileIcon()` renders a
stacked hex-coloured glyph **plus a mono `.EXT` ribbon** at 30 px in chat; the run page renders a flat
16 px monochrome glyph and no ribbon. **"One icon path" is a VISIBLE change, not a no-op.**

---

## The three live presentations, side by side

| | **Run page** | **Panel (`FilesSection`)** | **Chat** |
|---|---|---|---|
| Element | `BUTTON` | `DIV role="option" tabindex="0"` inside `role="listbox"` | — |
| Icon class | `h-4 w-4 shrink-0 **text-muted-foreground**` | `h-4 w-4 flex-shrink-0 **text-panel-muted-foreground**` | — |
| Icon size | 16×16 | 16×16 | — |
| Name shown | `Northwind-QBR-Template.docx` (basename) | `/Northwind-QBR-Template.docx` (**full path, `font-mono`**) | — |
| Size | `38.7 KB` | `38.7 KB` | — |
| Padding | `px-2 py-2` | `px-2.5 py-2` | — |
| Height | **33 px** | **38 px** | — |
| Activation | download | `cursor-pointer` → **preview** | — |

⚠ **CHAT RENDERS NO FILE CARD FOR THIS DELIVERABLE AT ALL.** The only chat trace is plain markdown
inside the assistant message: *"Produced the filled deliverable: /Northwind-QBR-Template.docx"*.
`document.querySelector('[data-testid="output-file-card"],[data-dead]')` → **null**.

**This is a REAL PLANNING CONSEQUENCE, not trivia:**
1. It corroborates **D-14** — `RunCard`'s badge parses `output_files` out of `tool_calls` and a
   workflow emit returns `path`, so chat structurally has nothing to render.
2. It corroborates **D-13** — chat gains no NEW file affordance, and none exists to regress.
3. ⚠ **It refines D-20's acceptance bar:** the "three-surface side-by-side" **cannot use this file for
   the chat row**, because chat never renders one for a workflow deliverable. `OutputFileCard`'s chat
   row must be exercised with a **sandbox `output_files`** case (an `execute_code` run), or the
   side-by-side must be honestly recorded as **two live surfaces + one fixture**.

**Four measured deltas the extraction must reconcile** — none stylistic:
`text-muted-foreground` vs `text-panel-muted-foreground` (**different design tokens**, the panel's
being a deliberate Phase 088-05 AA-contrast choice) · basename vs full `font-mono` path · `px-2` vs
`px-2.5` · `button` vs `div[role=option]` with roving `tabindex`.

---

## What was NOT done, stated rather than implied

- ⚠ **The download was NOT exercised.** The control's presence, its `aria-label` and the DB byte size
  are measured; **a file was not fetched to disk.** Downloading requires the operator's explicit
  go-ahead, and exercising it is **D-20's** acceptance step (post-change), not D-16's baseline. The
  two `KB`-matching readings are consistent with a correct wiring but **do not prove the bytes
  transfer.**
- **D-04's blind spot stands unexamined:** the 161 file-less workflow-run threads were not checked for
  whether any had an `llm_emit` phase. An **ACCEPTED BLIND SPOT**, not a proven absence.
- **`SC#3` was not exercised** — no run in the live DB has more than one deliverable (the 20-file
  thread is an agent chat, per D-01).

---

## Environment findings worth carrying (cost real calls this session)

1. ⚠ **The Chrome extension's coordinate clicks do NOT reach this React app.** Two
   `left_click` calls at correctly-measured centre coordinates left `aria-current` unchanged;
   `element.click()` navigated immediately. **Drive this app via `element.click()`**, and treat a
   silent no-op as an event-delivery problem, not a gated feature.
2. ⚠ **A 20-iteration click-and-read loop exceeded the 45 s CDP `Runtime.evaluate` window** and
   returned a timeout while the renderer stayed healthy. **Keep browser loops to ≤ 5 iterations.**
3. ⚠ **A 700 ms settle is too short** — two threads reported an EMPTY spine that was a load race, not
   an absence; one of them was the completed run. **A short wait manufactures false negatives.** Use
   ≥ 2.5 s after a thread selection.
4. Thread rows carry **no `data-thread-id`** — a specific thread cannot be addressed from the DOM.

---

*Baseline for Phase 195. Committed before any source change, per D-16.*
