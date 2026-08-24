# Phase 199 + 192.2 — driven evidence log

**Driven:** 2026-08-19, live Chrome against `localhost:5173` + backend `:8000`, real logged-in
session, real data (108 workflows / 80 drafts / 3 starters). Every figure below was read off the
running product, not from a SUMMARY.

⚠ **jsdom returns 0 for all layout, which is why these rows were owed.** Everything here is a real
`getBoundingClientRect()` / `getComputedStyle()` reading in a browser with a layout engine.

---

## Rows CLOSED by measurement (no operator action needed)

### Row 3 — the fork dialog · PASS
| Claim | Measured |
|---|---|
| field opens EMPTY (sheet c6's `(Copy)` prefill refused) | `inputValue: ""` |
| no machine word `fork` anywhere | `/fork/i` → **false** |
| title / button | `Name your copy` / `Create my copy` |
| clash state says it in WORDS, not a green tick | `You already have one called this. Allowed — but you will not be able to tell them apart.` · `rgb(251,191,36)` · 11px |
| the warning never BLOCKS | `createDisabled: false` |
| sheet's `✓ Name available` | absent — `hasCheckMark: false` |

### Row 4 — the delete sheet · PASS (one nit)
All four graded guard atoms present on the live sheet:

| Guard | Measured |
|---|---|
| exact server counts fetched before the destructive offer | `1 versions · 17 run records` |
| victim named exactly once, inside `Permanently removed` | `victimNameCount: 1` |
| destructive weight AT REST (not hover-only — the 199-10 plant) | `Delete forever` → `rgb(220, 40, 40)` |
| audit receipt | `✎ Recorded with your name in the audit log.` |
| no optimistic vanish / undo | no `Undo` / `Restore` |
| title carries no victim (DEC-199-10-G) | `Delete this workflow?` |
| a KEPT group the sheet has no concept of | `Kept — not touched · 17 chat threads become normal chats…` |

⚠ **NIT — F4:** reads `1 versions`, unpluralized.

### Row 7 / 192.2 U10 — the fourth run arm · PASS (driven via payload override)
The wire carries all three keys live — `has_any_run` is deployed:
`["id","slug","name","definition","is_mine","is_system_global","updated_at","last_run_at","last_run_status","has_any_run"]`

| Override applied to `/workflows/starters` + `/workflows/published` | Result |
|---|---|
| baseline (no override) | `Never run` **67** · `Run by someone else` **0** · `Worked` 32 · `Failed` 11 |
| `has_any_run: true`, `last_run_at: null`, `last_run_status: null` | **31 rows flipped to `Run by someone else`** · `Never run` 0 on those rows · none painted as success |
| feed restored | back to 67 / 32 — no residue |

**This is blocker CR-01's fix proven on the real deployed frontend↔backend pairing.**

### 192.2 U4 — the unknown arm · PASS (driven, keys DELETED not nulled)
| Override | Result |
|---|---|
| `delete has_any_run; delete last_run_at; delete last_run_status` | **31 rows read `Not recorded`** · `data-run="unknown"` · gutter `rgba(0,0,0,0)` — no colour, no tick, no fabricated time · **zero** `Never run` · **zero** `Run by someone else` |

⚠ The row's own warning was honoured: the keys were **deleted**, not nulled — `null` is a different
arm and conflating them is the bug this row guards.

---

## Rows MECHANICALLY green, operator's EYE still owed

### Row 1 — the library toolbar · geometry PASS at three widths
| viewport | create x / y / h | search x / y / h | create painted first? | one baseline? |
|---|---|---|---|---|
| **1440** | 82 / 75 / **36** | 248 / 75 / **36** | ✅ | ✅ `centerDelta: 0` |
| **1024** (row wraps once) | 82 / 75 / 36 | 248 / 75 / 36 | ✅ | ✅ |
| **680** (row wraps twice) | 24 / 75 / 36 | 190 / 75 / 36 | ✅ | ✅ `sameHeight: true` |

`flex-wrap: wrap`, `flex-direction: row` — no reverse, no `order-*`. No horizontal scroll at 680.
Create control: `border: 0px` (the dashed box is gone), solid `bg rgb(163,165,255)`, `h 36`, radius 8px.
Six honest chips: `Ready to run 31 · Yours 108 · Still building 80 · Starters 3 · Makes a file 81 · 🔒Strict 77`.
**Sub-line provably gone:** `Describe it in plain English` → false; `/plain English|AI drafts/i` → false.

**Owed to your eye:** does losing that sub-line cost a first-time user anything?

### Row 2 — the run dialog · every c6 refusal HOLDS
| c6 asked for | Present? |
|---|---|
| `Target nodes: production-cluster` | ✗ |
| `Estimated time: ~45s` | ✗ |
| `Sequence length: 3 phases` | ✗ |
| verb `Execute` | ✗ |
| `📄` page glyph | ✗ — `svgCount: 0` |

Shipped instead: KB-scope select, kickoff textarea, the honest destination line
(`Run opens this workflow's run surface. The chat thread is still created, and stays reachable from
there.`), `Cancel` / `▶ Run workflow`.

⚠ **Owed to your decision — the deferred noise is REAL and I confirmed it live.** The whole dialog
contains exactly ONE mono string: `kickoff_prompt`, in `This workflow expects: kickoff_prompt`.

### Row 6 — the phase form panel disclosure · PASS mechanically
| Claim | Measured |
|---|---|
| ONE switch, default collapsed | `Explain each field` · `aria-expanded: false` |
| opening it restores guidance | label → `Hide the explanations` · `aria-expanded: true` · body **+252 chars** · `Instructions → "What you want the AI to do in this step."` |
| the refusal was PROMOTED, not folded | `Pick from the tools this workspace allows — you cannot add one by typing.` visible at rest |
| the deleted sentence is gone | `Leave blank to use the run's model` → **false** |
| its purpose survives in the control | first option reads `Use the run's model — today that would be deepseek-v4-flash` — **stronger than the deleted sentence**, it names the actual model |
| decisions stay at rest | `Order is locked` · `Runs as step 1 of 2 — steps run in order, one after another.` · 7 `ⓘ` markers |
| the node's own words are business words | title `Find contracts renewing in the next 90 days` / subtitle `AI agent step` — **not** `llm_agent` |

### Row 8 — the workspace panel empty state, on CHAT · PASS mechanically
`svgCount: 0` inside the scoped empty state — the decorative `Inbox` glyph is provably gone.
Two lines survive, centred in a 324×847 panel:
`No workspace activity yet` 14px `rgb(151,161,180)` · `When the agent writes files, tracks todos, or needs your input, it'll show up here.` 11.52px `rgb(166,174,191)`.

**Owed to your eye:** finished-and-quiet, or a gap where an icon used to be?

### Row 12 — the canvas node at 50% zoom · MEASURED, verdict owed
At `scale 0.528`:

| atom | declared | **effective** | weight | colour |
|---|---|---|---|---|
| title `Find contracts renewing in the next 90 days` | 14px | **7.40px** | 600 | `rgb(243,245,252)` |
| supporting `Searches and decides its own next move` | 11px | **5.81px** | 400 | `rgb(151,161,180)` |

The `⛨ Must prove it` corner mark measures `0.5×0.5` because its text is an **sr-only label** inside
a 21px grid — that is the intended shape, not a clipping defect (verified: `overflow:hidden`,
`textOverflow:clip`, parent is the corner-mark grid).

**Owed to your eye:** is 7.4px / 5.81px legible, or is sheet c2's readability claim false at that
zoom? Both are valid, reportable outcomes.

### Row 5 — the card at full scale · data captured, judgement owed
Real card text, verbatim:
```
Compliance Gap Report · v1 · Never run | Shared starter · SHARED · Shared starter · No project · 42 share this name · changed last month · ▶ Run
Quarterly Business Review — Northwind Logistics (Q3 2026) · v1 · Failed 4 days ago | Ready to run · YOURS · Ready to run · 2 share this name · changed 4 days ago · Template-Test · ▶ Run
Slack Connector UAT (Phase 190) · v1 · Stopped 3 days ago | Ready to run · YOURS · changed last week · PM Demo Project
```
Lead action swaps by state: published rows lead `▶ Run`, drafts lead `✎ Open`.
Run truths observed live: `Never run` · `Worked N ago` · `Failed N ago` · `Stopped N ago`.

⚠ **F5 — 192.2 U7 CONFIRMED LIVE (`BUG-260819-01`, status `open`).** The state word renders **twice**
on name-colliding rows: `… Shared starter · SHARED · Shared starter · …` and
`… Ready to run · YOURS · Ready to run · …`. Recorded as a known, deliberately-unfixed finding —
the fix is one decision in `rowIdentity.ts`, not in the card.

---

## ⚠ NEW FINDINGS — not in any owed row, found by driving the product

### F1 — the Builder spine prints the mechanism in mono, at rest, visibly
```
READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · on-fail branch (skip_to_phase)
 · no depends_on · no parallel lanes · inspect, don't drag
```
`font-mono`, **11px**, `rgb(151,161,180)`, `visible: true`, `opacity: 1`.

**This is DELIBERATE and recorded** — `DEC-199-02-F`: the locked 019-D `READ_ONLY_LEGEND` *"STAYS,
flagged rather than cut… it is a locked sketch contract asserted in four places… Re-opening it is a
phase, not a re-presentation."*

**But it is the single noisiest string in the product**, on the authoring surface, and it is exactly
what the operator's brief describes. **This is an operator decision, not a defect.**

### F2 — the spine's per-step chips print raw discriminators
`llm_agent` · `phase_index 0` · `llm_single` · `phase_index 1` — all `font-mono`, 10px, visible at rest.

**Also deliberate** — the c3 table's row 3: *"the shipped chip prints the RAW `phase_type`. Swapping
it for a business word would delete D-187-16's measured basis — the spine stopped swapping its title
precisely because the technical vocabulary was never hidden here."*

⚠ **The tension is real and should be named rather than smoothed over:** the CANVAS node for the same
step says `AI agent step` / `Searches and decides its own next move`, while the SPINE for that same
step says `llm_agent` / `phase_index 0`. **Two views of one workflow speak two different languages.**
That is a consistency finding, and consistency is half the operator's stated bottom line.

### F3 — the tool whitelist is 89% raw machine identifiers, inconsistently
Measured in the phase form panel's *What this step can do*:

| | count | examples |
|---|---|---|
| **raw snake_case** | **24** | `analyze_document`, `ask_user`, `attach_skill_file`, `fetch_document_file`, `get_related_documents`, `glob`, `grep`, `load_skill`, `ls`, `query_documents`, `query_documents_by_view`, `query_tables`, `read_skill_file`, `recall`, `remember`, `save_skill`, `task`, `tree`, `web_search`, `workspace_delete`, `workspace_diff`, `workspace_list`, `workspace_read`, `workspace_write`, `write_todos` |
| **human-named** | **3** | `Run code`, `Read a document`, `Search documents` |

⚠ **The inconsistency is worse than the noise.** Three tools got business names and 24 did not, on
one list, in one control — so the surface reads as half-finished rather than as deliberately
technical. Nothing in phase 199 touched this; no sheet drew it.

### F4 — `1 versions` (unpluralized) on the delete sheet.

### F5 — the doubled state word on name-colliding cards (`BUG-260819-01`, already open).

---

## Rows that CANNOT be driven without operator-provided data

| Row | Blocked on |
|---|---|
| **9** — `expiry unknown`, muted | needs a template upload whose `expires_at` the wire does not carry |
| **10** — file row holds its line at 1024 / 1440 | needs a long-path template row in the workspace panel |
| **11** — unreadable definition, no fabricated `v0` | needs a workflow run whose definition cannot be read |

These are recorded as **blocked with a reason**, never as passed. A scoreboard that lists only what
passed is not a scoreboard.
