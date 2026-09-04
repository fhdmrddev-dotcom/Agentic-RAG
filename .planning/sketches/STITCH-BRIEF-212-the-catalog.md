# STITCH BRIEF — Phase 212, The Catalog and Its Doors

**Written 2026-08-27.** Extends `.planning/sketches/STITCH-BRIEF.md`; it does not replace it.
The standing method (§6.5 there) is unchanged: **Stitch for the language → operator reacts → a
normal sketch re-expresses the chosen direction against components that actually ship → only that
sketch is the G-2 acceptance bar.** Steps 1 and 4 are never collapsed.

⚠ **This brief is exploration. Nothing in it authorises a source edit.**

---

## 0 · The MCP surface, inspected — reported before any prompt is written

§0 of the standing brief says to enumerate the tool surface before burning a call on it. Done
2026-08-27. **15 tools, in three families:**

| Family | Tools |
|---|---|
| Projects | `list_projects` · `create_project` · `get_project` · `delete_project` |
| Screens | `list_screens` · `get_screen` · `generate_screen_from_text` · `edit_screens` · `generate_variants` |
| Design systems | `list_design_systems` · `create_design_system` · `update_design_system` · `apply_design_system` · `upload_design_md` · `create_design_system_from_design_md` |

Facts that change how it is driven:

- **Models:** `GEMINI_3_1_PRO`, `GEMINI_3_FLASH`. `GEMINI_3_PRO` is **deprecated** — do not pass it.
- **`deviceType`:** `MOBILE | DESKTOP | TABLET | AGNOSTIC`. This surface is **`DESKTOP`**.
- **`generate_variants`** takes `variantCount` 1–5, `creativeRange` of `REFINE | EXPLORE | REIMAGINE`
  (default `EXPLORE`), and `aspects` of `LAYOUT | COLOR_SCHEME | IMAGES | TEXT_FONT | TEXT_CONTENT`.
  This is the "show me the range" instrument the operator asked for — one generation, then variants,
  rather than N hand-written prompts.
- **Generation takes minutes and the tool says DO NOT RETRY.** On timeout, poll `get_screen` every
  ~30 s, up to 10 times. A connection error does **not** mean the generation failed.
- **`generate_screen_from_text` takes a `designSystem` asset id** and its own schema says it "should
  always be configured for design consistency". Passing nothing silently gets a default system.

**Account state:** 21 projects exist. Three are the Aether line —
`projects/10710316306258284608` *Aether Workflow Surface — Stitch Exploration 2026-08-18* (23
screens), `projects/7797685529205337277` *Aether Journey v2* (25 screens, MOBILE, "Indigo Noir"),
`projects/5788490306374209360` *Aether Workflow Journey — Interactive Pass 2026-08-19* (1 screen).

---

## 1 · ⭐ THE DESIGN SYSTEM ALREADY EXISTS — do not author a new one

**`assets/12493500246735489470`, version 3, "Aether Intelligence — Deep Midnight."**

It already carries the full `designMd`, including the operator's ratified mindset (TEXT IS NOISE /
THE PURPOSE MUST SURVIVE THE CUT), the exact colour tokens, the CALM direction, the honesty rules,
the progressive-disclosure rule, the "draw the component, not the app" rule, and the three
measurements that have already killed design ideas.

⚠⚠ **CORRECTED 2026-08-27, SAME DAY, BY MEASUREMENT — THE PARAGRAPH BELOW WAS WRONG AND IS KEPT
RATHER THAN OVERWRITTEN, BECAUSE THE WAY IT FAILED IS THE FINDING.**

> ~~So every `generate_screen_from_text` call in this phase passes
> `designSystem: "assets/12493500246735489470"`. Nothing in §3 or §4 below needs re-typing into a
> prompt — it is inherited. Re-typing it is how the two copies drift.~~

**DESIGN SYSTEMS ARE PROJECT-SCOPED, AND A FOREIGN ASSET ID IS SILENTLY IGNORED.**
`assets/12493500246735489470` belongs to project `10710316306258284608`. It was passed on all four
generations into project `1998980346225284960` and **bound to none of them** — no error, no warning.
Stitch auto-created its own system, **"Obsidian Archive"** (`assets/9745ab2cf9ac4e37a688579bcf95e0ab`,
teal `#2dd4bf`), and `list_design_systems` on the new project returns that one and only that one.

Measured, on all four downloaded files:

```
grep -oiE '#[0-9a-f]{6}' <file> | sort | uniq -c | sort -rn
  → background #0b1326 · text #dae2fd · accent #3cddc7    (Obsidian Archive)
  → occurrences of Deep Midnight's #A3A5FF: 0
  → occurrences of Deep Midnight's #0D1117: 0
```

**Consequences, stated plainly:**

1. **Every render in this pass is in the WRONG PALETTE.** Teal accent on `#0b1326`, not indigo
   `#A3A5FF` on `#0D1117`. This is survivable *only* because Stitch output is DIRECTION and never a
   bar — the sketch step re-expresses it against `frontend/src/index.css` tokens anyway. **It would
   NOT be survivable if anything downstream took these colours literally.**
2. **The ratified mindset did NOT arrive via the design system either.** The outputs obey TEXT IS
   NOISE, the purpose rule, the honesty rules and the no-progress rule — but **the prompts in this
   brief carried all of those explicitly**, so their good behaviour cannot be credited to the
   inherited `designMd`. The claim "nothing needs re-typing" is refuted twice over.
3. **The fix, for the next pass:** either generate INSIDE project `10710316306258284608`, where
   Deep Midnight already lives, or rebuild it in the new project via `upload_design_md` +
   `create_design_system_from_design_md` — noting §0.1 below about the mutate path.

⚠ **ALWAYS VERIFY THE PALETTE OF A RETURNED SCREEN BEFORE READING ANYTHING INTO ITS COLOUR.** One
grep over the hex values is the whole check, and the tool reports success either way.

## 0.1 · ⚠ THE MUTATE PATH DOES NOT WORK; THE CREATE PATH DOES

Measured this session, and it changes how every future pass must be driven:

| Tool | Result |
|---|---|
| `create_project` | ✅ works |
| `generate_screen_from_text` | ✅ works ×5 — **always times out**, then lands 90 s–3 min later |
| `list_projects` / `list_screens` / `get_screen` / `list_design_systems` | ✅ work |
| `edit_screens` | ❌ **returned a SUCCESS payload with four DOM operations and matching `verified_html_context` — and the served file was BYTE-IDENTICAL afterwards** (same file id, same md5, zero occurrences of the new word) |
| `generate_variants` | ⚠ **WORKS, BUT IS VERY SLOW** — see the correction below |

⚠ **CORRECTED, LATER THE SAME SESSION: `generate_variants` is SLOW, NOT BROKEN, and the original
wrong verdict is kept here because the way it misled is the lesson.** It was first recorded as
*"timed out and produced nothing after 8 minutes of polling"*. That was true of the 8-minute window
and false about the tool: **all three variants did land** — `Purpose-First`, `Structured Columns`
and `Balanced Horizontal` — and appeared only after three further `generate_screen_from_text` calls
had been issued and completed. **Budget it in tens of minutes, not minutes, and poll far longer than
the schema's "every 30 s, up to 10 times" suggests.**

**Practical consequence: a hand-written variant via `generate_screen_from_text` is the FASTER path**,
and it is also the more controllable one — the auto-variants explore whatever they choose, whereas a
written prompt can force the specific question you want answered (this pass used written prompts for
A/B/C and got a density stress-test that the auto-variants did not produce). **Use both: fire
`generate_variants` for breadth, then write your own while it cooks.**

⚠ **`edit_screens` claiming success is the dangerous one.** It reports applied operations that were
never applied. **Verify by bytes — `md5sum` the re-downloaded file, or grep for the new string — and
never by the tool's own report.**

⚠ There is **no `DESIGN.md` in the repository.** The design language lives in Stitch and in
`frontend/src/index.css` (`.dark`), mirrored for sketches at `.planning/sketches/themes/default.css`.
`upload_design_md` / `create_design_system_from_design_md` are therefore **not** needed here; they
are the path for a *new* system, and this phase reuses the existing one.

---

## 2 · What this phase is, in one line

> A person finds a service the way they find an app — by its mark, its name and a one-line purpose —
> and adds one either from a curated Popular row or by pasting a URL for a service we have never
> heard of, on every install including cloud.

Requirements: `CAT-01`, `CAT-02`, `CAT-03`, `CAT-05`, `CONN-06`, `CONN-07`.

**The acceptance reference** is `screenshots/Screenshot 2026-08-24 202011.png` (Claude.ai Connectors
→ catalog IA and the `Custom` badge that IS the custom-URL door) and `202036` / `202044` (Claude.ai
Plugins Directory → long-tail catalog IA).

⚠ **The ROADMAP fences what those shots are the bar FOR, verbatim:** *"The bar is the catalog IA and
the grant grain, **NOT** the two-click Connect moment — those shots depict a product where the vendor
owns every OAuth app, which D-v3.9-01 explicitly declines."* Stitch will happily draw the seductive
one-click Connect. That is the wrong half of the reference.

---

## 3 · FIVE MEASUREMENTS THAT MUST CHANGE THE DESIGN

The standing brief carries three such measurements for the workflow surface (`93% repeated names`,
`11 of 18 Unbound`, `no progress signal`). These are this phase's equivalents, all re-derived on the
untouched tree at `43c95968` and recorded in
`.planning/phases/212-the-catalog-and-its-doors/212-MEASUREMENTS.md`.

**1 · THE REAL DATA IS THREE ROWS, NOT A GRID.** Live DB, `connector_connections`:

```
service_id            capability        has_mcp   discovered_tools
jira                  create_ticket     False     1
mcp.deepwiki.com      None              True      3
slack                 post_message      False     1
```

A catalog designed as a dense populated grid will look **wrong on the actual install**. The states
that matter most here are **sparse and empty**, not full. Draw those first, not last.

**2 · THE ONE ROW THAT MOST NEEDS A MARK HAS A HOSTNAME WHERE A SLUG SHOULD BE.** `mcp.deepwiki.com`
is a *hostname*; `jira` and `slack` are slugs. Migration 127's own `COMMENT` on `service_id` states
the design constraint, verbatim:

> The curated "Popular" set (Phase 212) is a **PRESENTATION LOOKUP** keyed by this value — a miss
> degrades to a **generic mark, NEVER to a refusal and NEVER to a hidden row**.

So the catalog needs a **first-class unknown-service row**: real mark, real name, real purpose line,
sitting in the same list as Slack — not an error state, not a lesser tier, not filtered out. **If
Stitch draws the uncurated service as degraded, the generation has failed the requirement.**

**3 · TOOL COUNTS ARE 1, 1 AND 3.** A card reading "23 tools" is a fabricated number, which the
honesty rules forbid. Whatever the row leads with, it cannot be a tool count that flatters.

**4 · THE SURFACE HAS AN OFF STATE AND IT IS THE COLD DEFAULT.** `live_connectors` ships `off`
(`user_settings.py:1214`), the frontend read **fails closed**, and `ConnectionsTab.tsx:85-87` says
what happens: *"every WRITE affordance is REMOVED rather than disabled — a hidden button the API
still honours is one defect; a rendered one that 403s is another."* **Draw the flag-off catalog.**
It is what a fresh install shows, and it is half of `BUG-260810-01`.

**5 · NO FILTER MAY DESCRIBE WHAT A CONNECTOR CAN DO.** `CAT-03` is `All / Connected / Not
connected` and nothing else. This is `SEED-207`'s retirement made visible: the three verbs
(`send_email` / `create_ticket` / `post_message`) stop being the organising axis. **If a generated
filter row offers "Messaging" / "Email" / "Tickets", it has re-drawn the model this phase exists to
retire.**

---

## 4 · The surfaces to generate — components, not just the page

§6.5 of the standing brief: *"use Stitch to map everything — not only the main pages but all the
components."* Page-level generation alone re-derives layout and leaves the atoms untouched.

| # | Surface | The question it must answer |
|---|---|---|
| 1 | **The catalog list** — populated, **sparse (3 rows)**, **empty**, **flag-off** | What does a person scan? Four states, and three of them are the common ones |
| 2 | **One service row**, four ways — connected · not connected · custom-URL · **uncurated/unknown** | What is the one line that decides whether you care? (progressive disclosure) |
| 3 | **The filter chip row** | Three state chips only — `All / Connected / Not connected` |
| 4 | **The Popular row** | A curated set inside the same list every other service lives in, not a separate shelf |
| 5 | **The paste-a-URL door** + **pre-save discovery preview** | The moment tools appear *before* the connection is saved — the phase's most novel moment |
| 6 | **Edit form** | Name / credential / endpoint change with grants visibly preserved (`CONN-07`) |
| 7 | **Delete confirm sheet** | Victim-naming: what breaks, named, before the button arms |

⚠ **Out of scope for this brief: the per-tool grant list and the approval moment.** Those are
**Phase 213**, which owes its own G-2 sketch. Generating them here invites a plan to build them here.

---

## 5 · The mindset, applied to this surface specifically

Inherited from the design system, restated only where this surface makes it concrete:

- **The one-line purpose is the thing that must survive the cut.** *"Post messages and read channels
  in your workspace"* — what it is FOR, in plain human language. Never *"MCP connector, 3 tools
  discovered, capability post_message"*, which is the mechanism.
- **Never name the mechanism.** No `service_id`, no `capability`, no `mcp_server_url`, no "discovered
  via JSON-RPC", no protocol names on the face of a row. The word **MCP** should not need to appear
  for a person to add a service. `SEED-205` records the operator's own framing: *"they pick the
  SERVICE, not the protocol."*
- **Colour carries state and never carries it alone.** A connected dot always sits beside its word.
- **At most one accent per row.** Marks are brand identity, not decoration — provider marks come from
  `@lobehub/icons` per the single-source icon convention; the generic fallback mark is a real design
  problem to solve, not a grey square.

---

## 6 · Guardrails live on this work

- **G-2** — the sketch gate. An operator-approved mockup is the acceptance bar, and it is owed
  **before** spec or plan.
- **G-5 fires on four files this phase touches**, all four re-derived 2026-08-27 and all four
  understated in the ledger: `ConnectionsTab.tsx` **9/4/1218**, `ConnectionFormPanel.tsx`
  **7/4/1889**, `connectionsCopy.ts` **6/5/571**, `connectionFormCopy.ts` **5/4/966**. A design that
  needs both big components rewritten is not automatically wrong — but it should be *chosen*, not
  arrived at.
- **`SEED-155`** — the sketch that drew a card the components could not render. A generative tool
  makes that easier to hit. **Stitch output is direction, never a bar.**

---

## 7 · ⚠ A SEQUENCING CONFLICT THAT ALREADY EXISTS — name it before generating

Phase 212 **already has a locked `212-UI-SPEC.md` and five written plans** (`a239b693`, five plans /
four waves). Neither Stitch nor a sketch was run — `grep -rlni "sketch\|stitch"` across every 212
artifact returns nothing, and `.planning/sketches/` has no 212 entry.

G-2's order is sketch → spec → plan. The phase ran spec → plan. **Nothing has executed yet** (tree
clean, no execution commits), so the sketch can still become the real bar rather than a retrofit —
but whatever comes out of this brief will likely change plans `212-02`, `212-03` and `212-04`, and
`212-UI-SPEC.md` is currently marked `Status: Locked`.

**That is a decision for the operator, not something this brief settles.** It is on the bus.

---

## 8 · The call sequence, concretely

```
create_project  title:"Aether Connections — Catalog & Doors 2026-08-27"
                                                    → returns projects/{id}

generate_screen_from_text
    projectId:    {id}
    designSystem: "assets/12493500246735489470"       # ⭐ never omit
    deviceType:   DESKTOP
    modelId:      GEMINI_3_1_PRO
    prompt:       <one surface from §4>

generate_variants   selectedScreenIds:[...]  creativeRange: EXPLORE
                    aspects:[LAYOUT, TEXT_CONTENT]  variantCount: 3
```

Generate §4 rows **1, 2 and 5 first** — the list, the row, and the paste-a-URL moment. Those three
carry the phase. Rows 3, 4, 6 and 7 follow once the language is settled, so they inherit it rather
than each inventing one.

⚠ **`aspects: [LAYOUT, TEXT_CONTENT]`, not `COLOR_SCHEME`.** The palette is settled and the
design system forbids new hex. The open questions here are *what a row leads with* and *how few words
it can carry* — which is exactly what those two aspects vary.

---

## 9 · What "done" looks like

Not a built page, and not a chosen design. **A range the operator can react to**, plus an honest read
of each direction:

1. what is genuinely new,
2. what is **unbuildable** against `ConnectionsTab.tsx` / `ConnectionFormPanel.tsx` as they ship,
3. what would cost a refactor to reach — and whether that refactor is the G-5 one already owed.

**No decision forced.** The operator asked to see the range.

---

## 10 · Housekeeping carried forward from the standing brief

⚠ **The Stitch API key was pasted into the 2026-08-18 chat transcript** and is stored project-scoped
in `C:\Users\fhdmr\.claude.json`. The standing brief recommends rotating it once experimentation
settles, and keeping the replacement out of chat. Still owed.
