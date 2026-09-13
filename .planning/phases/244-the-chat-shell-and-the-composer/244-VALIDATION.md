# Phase 244 — VALIDATION

**Authored:** 2026-09-11 (at planning)
**Driven:** _not yet_ — every row below is `⬜ owed` until a driver fills it.
**Solo running (D-244-21):** Gemini is unavailable. This board is **self-verified**, never
"reviewed". `OV-SOLO-01`.

> ⛔ **NONE of the five ROADMAP success criteria close on a green unit test.** The plans ship code
> and fences; **this file is where the phase is proven.** A criterion ticked from a code reading is
> exactly what `SURF-03` did at the v4.0 close, and it is why `SHELL-05` is in this phase at all.

> ⚠ **A row may be BLOCKED, never silently omitted.** A provider with no key, or one blocked by a
> known defect, is recorded `⛔` with the reason and the blocking issue id. A scoreboard that lists
> only what passed is not a scoreboard.

---

## A — Cross-provider board (D-244-02, the system-prompt attachment line)

**Why this board exists.** `244-02` Task 3 appends a line to the turn's system prompt on the
**shared** path. CLAUDE.md's UAT scoreboard recipe makes a system-prompt addition a full-roster
obligation: **the seven native providers + OpenRouter = 8 rows.** Conventions do not transfer 1:1
between providers, and this project has paid for assuming they do.

### ⛔ DERIVE the roster — do NOT re-type it

The table below is keyed by **provider**, and the `model id` column is filled **at drive time** from
the registry, never from this document:

```bash
cd backend && ./venv/Scripts/python -c "
import sys; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
from collections import defaultdict
g = defaultdict(list)
for mid, cap in MODEL_CAPABILITIES.items():
    g[getattr(cap, 'provider', None)].append((mid, getattr(cap,'emit_tier',None), getattr(cap,'native_tools',None)))
for p in sorted(g, key=str):
    print(p, g[p])
"
```

(If `Settings()` refuses for want of `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, run it with the
backend `.env` loaded — ⛔ do not work around it by transcribing the list from memory.)

**Selection rules, from CLAUDE.md:**
- One representative per provider group; prefer the **newest** model per provider.
- ⛔ Prefer a **registry-backed** id. An id absent from `MODEL_CAPABILITIES` resolves
  `capability_source=inferred` and **silently loses `emit_tier`** — the row would then measure a
  weaker configuration than the one that ships (`SEED-040`, `SEED-135`).
- **Moonshot / Kimi is the only `emit_tier: coerce` native row** — the weakest emission guarantee in
  the registry. It is the row most likely to fail and the most valuable one to drive.
- **Every OpenRouter row is `native_tools: False`** — it is the non-native tool path, not a fifth
  flavour of the native one.
- ⚠ **DeepSeek's `strict_json_schema` is INERT** (no `/beta` base_url, `D-122-04`) — record the row,
  do not infer anything from the flag.

### Method — cheapest honest, and it mutates nothing

Drive each row as a **real run** with a **per-request** `model` + `provider` on
`POST /threads/{id}/messages`. That scores the whole board **without mutating any global setting**,
so the operator's environment is untouched and rows cannot contaminate each other (the Phase 185
method).

**Per row, the scenario is the sketch's own:** attach `Meridian-Q4-pricing.xlsx` (or any `.xlsx`) to
a fresh thread, then send *"What is in the attached file?"*.

**Per row, record four observations — not a verdict:**

| # | Observation | How it is read |
|---|---|---|
| O1 | The prompt line was **present** in the turn | LangSmith trace `messages[0].content` contains the `## Files attached to this conversation` section and the filename |
| O2 | The model **acknowledged** the attachment without being told to look | the reply names the file, or calls a workspace/sandbox tool, on the FIRST turn |
| O3 | The model **used** it | `execute_code` reads `/sandbox/attachments/<name>` (or `workspace_read` for a text file) and the answer contains real content from the file |
| O4 | **No regression** | the run completes; no tool-call emission breakage; no provider-specific 400 |

| # | Provider | Model id (⛔ derive) | `emit_tier` | `native_tools` | O1 | O2 | O3 | O4 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| P-1 | OpenAI | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-2 | Anthropic (native SDK) | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-3 | Google | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-4 | DeepSeek | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-5 | Zhipu / GLM | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-6 | MiniMax | _derived_ | | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-7 | Moonshot / Kimi | _derived_ | `coerce` | | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |
| P-8 | OpenRouter | _derived_ | | `False` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ owed |

⚠ **O1 failing on any row is a SHARED-PATH defect**, not a provider quirk — the line is appended
above the service boundary. O2/O3 failing on one row while others pass is the provider variance this
board exists to measure; record it, and if it is Kimi, note the `coerce` tier beside it.

⚠ **Provider attribution must be VERIFIED per row.** On 2026-09-11 a board was abandoned because a
click for `anthropic` selected `minimax` — **a scoreboard with unverified attribution is worse than
none.** Read the provider back from the run record (`workflow_runs` / `harness_audit` /
LangSmith), never from the control you clicked.

---

## B — The four-axis bandwidth (CLAUDE.md SC#10)

This phase touches the agent loop, the composer and UI state, so the 4-axis rows are required
alongside the provider board.

| Axis | Row | What it exercises | Status |
|---|---|---|---|
| Cross-provider | A above | 8 rows | ⬜ owed |
| **Multi-tool** | X-1 | One prompt in a thread with an attachment that exercises **2+ tools** — e.g. `search_documents` (KB) **and** `execute_code` reading `/sandbox/attachments/`. ⭐ It also proves D-244-03 negatively: the attachment must **not** appear in the `search_documents` results. | ⬜ owed |
| **Parallel-thread** | X-2 | Thread A streaming while Thread B accepts a new prompt, with an attachment on A. Assert A's chip and B's composer are independent. | ⬜ owed |
| **Long-message** | X-3 | A thread with **≥ 50 prior messages** or a **≥ 5 KB** user prompt, with an attachment. Assert the prompt line still lands and the transcript chip still renders. | ⬜ owed |

---

## C — G-4 lived-experience rows (D-244-14, D-244-19; the ROADMAP's five criteria)

### L-1 — `SHELL-01`: the frame holds, MEASURED (D-244-19) ⬜ owed

⛔ **Not a screenshot.** ⛔ **`scrollTop` is NOT the reader's position** — it once reported a 1,039 px
drag that never happened. **Measure a LEAF element's bounding rect.**

Drive in Chrome, on a thread with a long transcript:

1. **The page root does not overflow:**
   `document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight`.
2. **The rail does not move:** capture a leaf element inside the nav rail (a nav row's own `<span>`,
   not the rail container) via `getBoundingClientRect()` **before and after** scrolling, and assert
   `top` and `left` are unchanged.
3. **No dead space under the composer:** the composer's bounding rect `bottom` is within 1 px of the
   viewport's usable bottom, before and after.

**Repeat the whole set at ≥ 3 viewport heights × panel CLOSED and panel OPEN = at least 6 samples.**
⚠ The ROADMAP's failure mode is *"fixed at one window height and the dead space returns at another"*,
which one height cannot see. Record the 6 measurements as a table, not a verdict.

| Sample | Viewport h | Panel | root overflow? | rail rect Δ | composer bottom Δ | Status |
|---|---|---|---|---|---|---|
| L-1-a | (small) | closed | | | | ⬜ |
| L-1-b | (medium) | closed | | | | ⬜ |
| L-1-c | (tall) | closed | | | | ⬜ |
| L-1-d | (small) | open | | | | ⬜ |
| L-1-e | (medium) | open | | | | ⬜ |
| L-1-f | (tall) | open | | | | ⬜ |

⚠ Also instrument `Element.prototype.scrollIntoView` for the run, to prove no app code scrolled.

### L-2 — `SHELL-02`: the cap-paused composer, AFTER A RELOAD ⬜ owed

⛔ **Verified after a reload, not only during a live stream** — ROADMAP criterion 2. Phase 228 removed
the reload that used to free the operator, so the live-stream-only check is the one that lies.

1. Drive a Deep run to its iteration cap so a Continue card appears.
2. **Reload the page** (`navigation.type === "navigate"`, not a soft re-render — assert it).
3. Assert the composer is **enabled** and the placeholder reads `Ask anything…`.
4. **Post a message.** Assert a **new** `runs` row appears for the thread (Supabase MCP read — free,
   no approval needed) and the run streams.
5. ⭐ **Poll again / navigate away and back.** Assert the lock does **not** return. This is D-244-09's
   *"drive it; do not reason about it"* — `244-03`'s source reading (C-2) predicts the lock WOULD
   return without the read bound, so this row is the one that proves the bound works.
6. Assert `MessageItem`'s sentence *"Reached the Continue limit — this run is stopped. Start a new
   message to keep going."* is **still on screen** — ⛔ the ROADMAP's named anti-fix is deleting it.

### L-3 — `SHELL-02` negative: a genuine harness run still locks ⬜ owed

Start a real workflow run. Assert the composer is disabled and BOTH the placeholder and the `title`
read *"Workflow running — Cancel to switch back"* (D-244-10, untouched copy).

### L-4 — `SHELL-03`: the approval, DRIVEN IN BOTH DIRECTIONS ⬜ owed

⛔ **A synthetic test that the stack mounts proves mounting, not answering.** `BUG-260828-07`'s
complaint is literally *"it looked right and did nothing"*, and this project's own record says
**presence assertions cannot see content drift**.

**Direction 1 — answer from the thread:**
1. Arm a real approval (a workflow step that raises `ask_user`).
2. In the **chat thread**, at the paused message, the two actions are present. Click one.
3. ⭐ Open the **workspace panel** and read its copy: the pause is settled there too, with no manual
   refresh. **Read the rendered sentence**, not a testid.

**Direction 2 — answer from the panel:**
4. Arm a second approval. Answer it **in the panel**.
5. Return to the thread. Assert the inline controls are gone and the row reads as settled.

6. Also check the third home: `WorkflowRunPage` still renders its direct `PendingAskCard` correctly
   (D-244-13 — `PendingAskCard.tsx` is a cross-surface shell; a change lands in three places).

### L-5 — `SHELL-04`: the local attach, end to end ⬜ owed

1. Open the `+` menu. Assert **three items in the drawn order**: `Attach a file`,
   `From cloud storage`, `Tools and connectors`.
2. Attach `Meridian-Q4-pricing.xlsx`. Assert the chip appears **in the existing chips row** beside a
   connector chip (arm one first), reading `this chat only · 24h`.
3. Send. ⭐ Assert the **sent message** carries the chip **above the text** with `this chat only` on
   it. **This is D-244-22's build obligation and the reason variant A won.**
4. Assert the agent's reply shows the one-line `Read <file>` pointer and contains real content.
5. ⛔ **The negative:** query `documents` for a row matching that filename (Supabase MCP read).
   **There must be none.** *"Not in the KB"* is structural (D-244-03) and this is how it is proven.
6. Attach a `.pdf`. ⭐ After `244-02`'s ruling it is **accepted**. Assert the agent can read it.
7. Attach an unsupported type (e.g. `.zip`). Assert the refusal shows the **server's verbatim**
   sentence: `Unsupported type .zip. Allowed: <sorted list including .pdf>`.
8. **The one-item menu case (D-244-26):** with a user who has **no cloud connection**, open the `+`
   menu. Assert the local item stands alone, reads correctly, and leaves no orphaned divider.
9. **The expired chip (D-244-25):** on a transcript whose attachment is past its TTL, assert the chip
   renders `No longer available`, struck through, with title
   *"Files attached to a chat are kept for 24 hours."* ⛔ Never a dead link, never a silent
   disappearance. ⚠ The TTL is a **read gate, not a delete sweeper** — the row survives invisibly;
   this row is what proves the UI tells the truth about it.

### L-6 — `SHELL-04`: the two doors, un-inverted ⬜ owed

1. From the **composer's** cloud item, pick a Drive file and confirm. The confirm word is **`Attach`**
   (⛔ never `Import`).
2. Assert a chip appears reading `this chat only` — **both composer doors mean the same thing**
   (D-244-05).
3. ⛔ **The negative:** no `documents` row was created (Supabase MCP read). Assert it.
4. ⛔ Assert the **textarea's value is unchanged** — the composer must not edit the person's words.
5. From the **Library**, with a folder selected, use the new single-file cloud door. Assert the
   document lands **in that folder**, not at root (Supabase MCP read of `documents.folder_id`).
6. With **no folder selected**, assert the door **refuses with a reason on screen** — ⛔ silently
   rooting is the defect and a silent refusal is the same failure wearing a different hat.

### L-7 — `SHELL-05`: the signal, DRIVEN END TO END FOR THE FIRST TIME (D-244-15a) ⬜ owed

⚠ **Phase 235 closed `SURF-03` UNTICKED and nothing has ever driven criterion 5.** Ticking it on a
code reading would repeat exactly what this project keeps paying for.

**(a) The positive:** break a watched source genuinely (revoke a token, or remove the watched folder
at the provider), wait past the server-side soft-failure debounce, and — **while doing something
else, on the Chat view, not the Health tab** — assert the rail badge appears and the popover names
the source with its cause sentence.

**(b) The negative, which is the ROADMAP's named failure mode:** with only **healthy** sources,
assert the badge does **not** appear. *"A signal nobody will trust after the first false one."*

**(c) The attribution (`BUG-260911-03`):** click through from the badge. Assert the Library opens and
the **Health** tab carries the count while the other four carry nothing. Then navigate away and back
into the Library and assert it opens on its **own default** — the one-shot hand-off must stay spent
(the Phase 235 plan-15 defect must stay closed).

---

## D — Rows recorded as blocked

_(none yet — a blocked row goes here with `⛔`, its reason, and its blocking issue id. ⛔ Never delete
a row from the tables above to make this section shorter.)_

---

## E — Reported-bug closure ledger

⛔ `status:` frontmatter **IS** the index; prose in a body saying "still open" is invisible to the
scan. ⛔ `verified_closed_by:` is set only after the named row passes — never on a green unit test.

| Report | Sev | Closes on | Status |
|---|---|---|---|
| `BUG-260828-08` (whole page scrolls) | — | **L-1**, all 6 samples | ⬜ owed |
| `BUG-260904-05` (cap-paused composer) | — | **L-2** + **L-3** | ⬜ owed |
| `BUG-260828-07` (approval buttons absent) | **high** | **L-4**, both directions | ⬜ owed |
| `BUG-260905-01` (cloud import inverted) | — | **L-5** step 5 + **L-6** | ⬜ owed |
| `BUG-260911-03` (badge does not say which tab) | minor | **L-7 (c)** | ⬜ owed |
| `BUG-260911-02` (first click does not open) | major | `244-01` Task 2's trace — closed on a traced mechanism **or** honestly retired with the production check written down | ⬜ owed |
| `BUG-260816-03` (thread-row identity) | major | `244-01` Task 3 for **(b)** and **(c)** only. ⛔ **(a)** — the workflow-vs-chat icon — is **deliberately deferred**: `Thread` carries no kind discriminator (a feed change), and the report itself routes to `/gsd:sketch`, which `D-244-18` rules out for this phase. ⛔ `status:` stays `folded`, never `closed`, with `(a)` named as the open half and a re-open trigger set. | ⬜ owed |

---

## F — What this file does NOT claim

- ⛔ It does not claim an independent review happened. **Gemini is unavailable; this is a
  self-verification** (`OV-SOLO-01`, D-244-21). `244-VERIFICATION.md` must say *"self-verified"*,
  never *"reviewed"*.
- ⛔ It does not treat a green `count gate OK` as a criterion. The gate is **not reliably reachable
  on demand** (`SEED-171`), so a criterion reading *"the gate is green"* can fail for reasons no plan
  controls. The deterministic evidence is the per-file deltas and the explicitly-run in-scope suites.
- ⛔ It does not treat `npx tsc --noEmit` as evidence of anything: in `frontend/` that command
  type-checks **ZERO** files. Only `tsc -p tsconfig.app.json --noEmit`, read as a **SET DIFF** against
  the 67-error base, counts.
