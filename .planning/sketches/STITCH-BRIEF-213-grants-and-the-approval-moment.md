# STITCH BRIEF — Phase 213, Per-Tool Grants and the Approval Moment

**Written 2026-08-27.** Extends `.planning/sketches/STITCH-BRIEF.md`; it does not replace it, and it
inherits every correction in `STITCH-BRIEF-212-the-catalog.md` rather than re-deriving them.

The standing method (§6.5 of the base brief) is unchanged and was **re-affirmed by the operator at
this phase's start**, after the reviewer proposed going straight to `/gsd:sketch`:

> *"We agreed that for whatever front end and your eye we should use Google Stitch first before doing
> the sketch, and the sketch should match perfectly Google Stitch when sketched."*

| Step | Tool | Produces | Acceptance bar? |
|---|---|---|---|
| 1 | **Stitch** | direction — composition, hierarchy, how little text a surface can carry | **No** |
| 2 | **Operator** | reaction to the range | — |
| 3 | **Normal sketch** under `.planning/sketches/` | the chosen direction **re-expressed against components that ship** | — |
| 4 | that sketch, approved | **Yes — the G-2 bar** | **Yes** |

⚠ **The operator added a clause this time: step 3 must MATCH step 1.** The sketch is not licensed to
drift from the Stitch direction it re-expresses — it changes the *materials* (shipped components,
`index.css` tokens), never the *composition*. Any place the shipped components cannot reproduce the
Stitch composition is a `SEED-155` finding to be **recorded and raised**, never silently designed
around. That is exactly how the workflow card drifted through three phases.

⚠ **This brief is exploration. Nothing in it authorises a source edit.**

---

## 0 · What was inherited, so no call is burned re-learning it

Every one of these was **measured** during Phase 212's pass. They are facts about the tool, not
guesses.

| Fact | Consequence here |
|---|---|
| ⭐ **Design systems are PROJECT-SCOPED, and a foreign asset id is SILENTLY IGNORED** | Generate **inside `projects/10710316306258284608`**, where *Aether Intelligence — Deep Midnight* (`assets/12493500246735489470`, v3) lives. 212 generated into a new project, passed the id on all four calls, was bound to none, and got a teal auto-system — **no error, no warning.** |
| `generate_screen_from_text` **always times out**, then lands 90 s – 3 min later | A timeout is not a failure. Poll `get_screen`; never retry. |
| `edit_screens` **is broken** — returns success with DOM ops and leaves the file byte-identical | Never used. Re-generate instead. |
| `generate_variants` **works but is very slow** — tens of minutes, not minutes | Not used in the first pass. Reach for it only after the operator has reacted. |
| `GEMINI_3_PRO` is **deprecated** | Use `GEMINI_3_1_PRO`. |
| The ratified mindset **did NOT arrive via the inherited `designMd`** | Every prompt below **carries it explicitly.** 212 proved the "nothing needs re-typing" claim false twice over. |

⚠ **ALWAYS GREP THE HEX VALUES OF A RETURNED SCREEN BEFORE READING ANYTHING INTO ITS COLOUR.**
`grep -oiE '#[0-9a-f]{6}' <file> | sort | uniq -c | sort -rn` — Deep Midnight is indigo `#A3A5FF`
on `#0D1117`. Teal `#3cddc7` on `#0b1326` means the design system did not bind.

---

## 1 · Why this phase gets a Stitch pass at all

`G-2` fires on any phase scoping a surface described in "feels like" terms. **213 has two**, and the
ROADMAP already records the sketch as owed:

1. **The grant list** — every tool a connection offers, in one list, each individually grantable.
2. **The approval moment** — a run pauses and asks a person before anything leaves.

And a third question arrived from the operator while they drove Phase 212, which this pass answers
rather than defers:

> *"Should we open each one in a pop-up window instead of being on the right and splitting the screen,
> which is already narrow, to 2 halves?"*

---

## 2 · The three screens, and what each is really asking

### Screen 1 — the grant list (the detail screen)

The load-bearing idea is **inheritance**: a connection-level default posture set once, which every
row inherits until individually overridden. GRANT-02 is that criterion. **The hard visual problem is
telling an INHERITED row from an OVERRIDDEN one at a glance while scrolling 44 rows** — that is what
the prompt asks Stitch to solve, because it is the thing prose cannot settle.

⚠ **Reads and writes in ONE list, never two tabs.** GRANT-01 says *"a search and a create side by
side"*, and the reason is recorded in the ROADMAP: **the grant-time gate must NOT key on direction,
because a read is exactly where prompt injection enters.** A UI that sorts reads away from writes
teaches the opposite lesson.

⚠ **Direction is often UNKNOWN and the screen must say so.** `readOnlyHint` was **measured absent**
on the one server we can reach, and per spec a hint from an untrusted server may never *widen* a
permission. So direction has **three arms, never two** — the house honesty rule, met head-on.

### Screen 2 — the approval moment

**The exact arguments are the heart of the screen**, not a collapsed detail row. A person cannot
consent to something they cannot see. The prompt says so in those words and forbids the countdown a
generative tool reaches for by default (*there is no progress signal — a fabricated number is
forbidden*, and how long a human takes is unknowable).

It also asks that **Deny be as reachable as Approve.** The safe answer must not be the small grey one.

### Screen 3 — the layout question, drawn honestly

Rather than argue it, this screen draws **the same 44-row content twice**: once in the incumbent
400px right-side panel with the table still visible beside it, once as a full detail screen.

⚠ **The prompt explicitly forbids a winner** — no scores, no "recommended" badge — and asks for one
line under each naming **what it costs**. The trade is genuine and both halves are real:

- **`D-27` is not wrong, and it is not being overturned by preference.** Its recorded reason stands:
  *"when a check fails the honest next action is to look at the list — which connection is now
  unusable, is anything else in the same state. A dialog scrims that away."*
- **But `D-27` was decided for a 3–5 field FORM.** A 44-row list with a three-state control per row
  plus a connection-level default is a different object, and neither 400px nor a modal obviously
  holds it.

⚠ **A constraint the sketch step must respect and Stitch cannot know: the app has NO URL ROUTER**
(`SEED-185`) — `/settings` lands on chat. A "detail screen" is therefore not free; it is either a
new in-app view swap or a routing change. **If B wins, that cost is real and must be surfaced at
discuss-phase, not discovered in execution.**

---

## 3 · The facts these prompts are built on — measured, not invented

From the operator's live database, 2026-08-27 (`connector_connections`):

| connection | `mcp_server_url` | actions |
|---|---|---|
| GitHub | `https://api.githubcopilot.com/mcp/` | **44** |
| DeepWiki | `https://mcp.deepwiki.com/mcp` | 3 |
| Notion | `https://mcp.notion.com/mcp` | **0** — ⛔ OAuth-only endpoint, blocked on Phase 215 |
| Slack · Jira · Email | *(none — capability shape)* | **1 each** |

**GitHub's 44 is why the prompts use GitHub**: it is the only row that makes the scale problem real,
and the scale problem is the entire design question. Real action names are used
(`search_code`, `create_pull_request`, `merge_pull_request`, `delete_repository`) rather than
invented ones, so the row widths Stitch chooses are honest.

⚠ **The `1 · 1 · 1` rows are `SEED-214`, and the sketch must not design as if they will stay 1.**
`connector_connections.capability` is a single column, so a first-party connection structurally holds
one action; 213 breaks that lock. **A grant list drawn for three one-row connections would be
obsolete inside its own phase.**

---

## 4 · What was NOT asked for, and why

- **No variants in this pass.** They cost tens of minutes and the operator has not yet reacted to a
  range. Variants are step 2's instrument, not step 1's.
- **No refusal screen yet.** GRANT-04's refusal (*"a denied tool is refused, and the refusal names
  the grant that would allow it"*) reuses the shipped refusal vocabulary in
  `connectionRefusalCopy.ts` — it is a copy problem with an existing house pattern, not a composition
  problem. It belongs in the sketch step, drawn against the real component.
- **No audit-receipt screen.** GRANT-05's ledger row has a shipped vocabulary from Phases 146–148
  (`✎ writes, consequence ≠ receipt`), and inventing a second one in Stitch would create drift where
  none exists.

---

## 5 · Output

Screens land in `.planning/sketches/213-stitch-grants/` with a `README.md` recording the palette grep
per file, and each prompt verbatim beside its render.

**Then step 2: the operator reacts to the range.** Only after that does a normal sketch re-express
the chosen direction against `ConnectionFormPanel` / `ConnectionsTab` and the real `index.css`
tokens — and per the operator's clause at the top, **it must match what Stitch drew.**
