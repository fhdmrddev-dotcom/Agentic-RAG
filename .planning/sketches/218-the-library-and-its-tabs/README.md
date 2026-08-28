---
sketch: 218
name: the-library-and-its-tabs
question: "What is the Library's tab set, and which of the reference redesign's surfaces can this app draw honestly?"
winner: "A"
tags: [seed-224, bus-026, documents, library-health, retrieval, ingestion, charts, g-2, acceptance-bar]
---

# Sketch 218 — the Library and its tabs

**Written 2026-08-28.** Step 3 of the ratified method: Stitch gave the direction
(`STITCH-BRIEF-218-the-document-space.md`), this re-expresses it **against components that ship**.
⚠ The two are never collapsed — Stitch renders zero shipped components (`SEED-155`).

```
node drive.cjs           # 190 assertions
node drive.cjs --emit    # regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **190 passed, 0 failed.** ⚠ **Thirty-one of them read the LIVE SOURCE TREE**, not the
sketch — column order, tab classes, theme lightness, the ingestion steps, the eval FKs. If the repo
moves, they fail. That is the point.

---

## What is borrowed, and what is not

The operator's direction, in two parts:

> *"exactly as referenced but with the correct elements of the tabs — I like the colors, the
> presentation, the simplicity, not many text pollution, good user journey, a lot of charts bars
> visuals."*
> …then: *"we should abide to our theme — what I meant is not the colors, the **content**, the
> **types of charts**, the **journey**, the **simplicity**, the **functionality**."*

| | source |
|---|---|
| content · chart types · journey · simplicity · functionality | **the reference** (`projects/6647337692456837497`) |
| palette · typography · spacing · component shapes | **ours** — every value a token from `frontend/src/index.css` |

---

## Variants

| tab | what it is |
|---|---|
| **A · five tabs** ⭐ | `Documents · Views · Ingestion · Indexing · Health`. The seed's set. **CHOSEN by the operator 2026-08-28.** |
| **B · four tabs** | ⭐ the same, minus `Views`. **The fork this sketch exists to settle.** |
| **Health** | the charts screen — ring, bars, per-document strip, checked queries |
| **Indexing** | reference screen 13's composition, with its two invented numbers removed |
| **Ingestion** | the dropzone + queue, with the real six-stage strip |
| **Document detail** | reference screen 15, in the **shipped 430px panel track** |
| **⭐ upload** | the front door — a full-width dropzone, the library-wide pipeline row, the queue |
| **⭐ what we hide** | six columns stored on every document that reach no screen |
| **⚠ findings** | two things only a rendered sketch could catch |

---

## 1 · ⭐ The decision this sketch is asking for

**Does `Views` earn a tab?**

The sidebar beside it already renders the complete `ViewsGroup` — per-view counts, the `G` pill on
system-global seeds, Edit / Rename / Delete. So tab 2 is one of two things:

| arm | cost |
|---|---|
| the tab **duplicates** the sidebar group | the same list in two places, with two sources of selection state that can disagree |
| Views **leaves** the sidebar | a saved view stops being a one-click filter and becomes a tab-switch away — ⚠ a regression of Phase 114's own **D-114-1**: *ad-hoc filtering and a loaded saved view are the SAME surface* |

⭐ **Variant B is the third arm the reference does not have: drop the tab and change nothing else.**
Views is a *lens on the Documents tab*, not a destination.

**And one smaller ruling:** the shipped `Retrieval Score` tile is drawn **both ways** in the Health
tab — bare as it ships, and qualified with what it measures. It is not a fake number; it is a real
one that does not say what it is. **Silently dropping a shipped tile is the worse option.**

---

## 2 · The charts — four types, each from a named reference screen

| chart | from | what it carries here |
|---|---|---|
| vertical bars | V2's *Retrieval Frequency* | searches over time, 7d/30d/90d, hover for the value |
| **progress ring** | screen 13's *Vector DB Health* donut | coverage — **87 of 224** |
| horizontal bars | screen 09's frequency strip | most-retrieved, proportional |
| sparkline | V2's *Embedding Quality* line | per-tile trend |

All inline SVG/CSS — no library, no gradient, no 3D. Animation is one **700ms ease-out entrance with
a per-item stagger**, replayed when a variant is opened. ⚠ **Every animation is disabled under
`prefers-reduced-motion`**, and the drive asserts it.

### ⭐ The ring is honest where the reference's was not

Screen 13 draws *"Vector Database Health 98%"* — a number with nothing behind it. This ring draws
**87 of 224**, a real ratio of documents a search actually returned, and it prints the **numerator
and the denominator** rather than a percentage, so a coverage count cannot be mistaken for a quality
grade. **Same chart type, opposite honesty.**

---

## 3 · ⚠ Two findings only a rendered sketch could produce

### (a) The shipped tab bar INVERTS between themes

`components/ui/tabs.tsx` puts the active trigger on `bg-background` over a `bg-muted` track:

| theme | track | active | reads as |
|---|---|---|---|
| light | 94% L | 97% L | lighter **(+3)** — a raised chip ✅ |
| Deep Midnight | 11% L | **4% L** | darker **(−7)** — a hole ⚠ |

Its only other cue is `shadow-sm`: a 5%-opacity black shadow, **invisible on a 4%-lightness surface**.
Every reference image drew it lighter — a shape the shipped component *cannot* produce.

⚠ **The remedy touches a shared shadcn primitive.** Settings and Library Health mount the same
component, so a ring lands on three surfaces at once. **That is a decision, not a tweak.**

### (b) The ingestion pipeline has SIX stages, not three

`extracting → extracting_tables? → extracting_images? → chunking → embedding → metadata`

`SEED-224` asks for three (*parse → chunk → embed*). That drops labelling entirely and collapses three
extract phases into one, so **a file being labelled right now has no segment to be in**.

⭐ **The data already flows** — the step is written at every transition and is already Realtime-driven
into the badge, and the term map already carries a plain label for each. **Zero schema, zero backend:
the cheapest honest win in the seed.**

⚠ **And it is why there is no percentage and no ETA.** Two stages are decided *while the file runs*,
so there is no honest denominator when the strip first renders. A skipped stage is **struck through**,
never left as an empty box — an absent thing that looks pending is the failure this avoids.

---

## 4 · ⛔ The cut list, and it is ENFORCED not merely written down

`drive.cjs` asserts each of these is **absent from the rendered surface**:

| cut | why |
|---|---|
| *Embedding Quality 92%* + trend | no signal behind it — a lie with a line chart |
| *Semantic Match %* column | semantic match is a property of a **query**, not of a stored document |
| token pie charts | ingestion token accounting does not exist |
| *Query Latency p99* | the retrieval call computes a float and **throws it away** |
| Source column (SharePoint / Drive / …) | ingestion is manual upload only — `SEED-142` |
| the section-level heatmap + executive summary | needs a per-chunk score nobody stores |
| the word **golden** | `workflow_runs.is_golden_run` already means the publish gauntlet's live run |

The last one is why this sketch says **Checked queries** where the reference says *"Mark as Golden
Answer"* — one product must not carry two unrelated meanings on one word.

---

## 5 · ⚠ What the merge costs, and the seam that must not be missed

`KnowledgeHealthPage` is not just a page: `ChatLayout.tsx:879` renders it as the **trailing `else`**
of the view chain. `App.tsx:98` says so itself —

> *"a union member with no branch **silently renders Knowledge Health**"*

**So deleting it removes what the app shows when nothing matches.** The merge must install a
replacement fallback in the same commit, or a mis-route goes from *wrong page* to *blank screen*.

⭐ **This is a seam between two plans** — one deletes a nav entry, another builds a tab, both green,
and the fallback nobody owned disappears between them. Exactly the class the ratified pre-flight
says to audit.

---

## 6 · ⚠ One finding in `drive.cjs` that is itself a finding

**The SURFACE stripper had a bug that looked exactly like a passing suite.** Its `data-meta` pattern
matched one closing tag too many and silently ate the findings tab's **second tab-bar arm** — the very
remedy the sketch exists to propose — and the run still read **70/70 green**, because nothing asserted
that arm was present. `B8` now pins both arms.

**Three fences were then driven RED against planted defects** and the file restored **md5-identical**:

| planted defect | fired |
|---|---|
| average relevance faked to `0.92` (as the reference prints it) | `C6b` |
| the remedy tab-bar arm removed | `A4c`, `B8` |
| the shipped column order swapped (`Size` before `Type`) | `A2b` — *marked: ["Size","Type","Chunks"]* |

A guard nobody has seen fire is not a guard.

---

---

## 6b · ⭐ The front door, and what we already store and never show

**Two operator observations drove a second pass, and both were right.**

> *"I did not see for example where I can upload documents."*

Today upload is a **small button in the top-right corner of a folder header**. The reference opens on
a full-width dropzone. The **upload** tab draws it as the front door, with the reference's screen-07
**stage-card row** above the queue — a count of documents at each stage, which is a real aggregate we
can produce from the step every document already carries.

⛔ **Its per-file upload percentages are drawn as STAGES, and that is a measurement, not a taste.**
There is no `onUploadProgress` anywhere in the upload path — the client reports only
*"Uploading N files…"* — so a percentage bar would be a number nothing can know.

⚠ **The accepted formats are read from the shipped file input**, and that fence caught the sketch's
own older dropzone advertising `MSG`, which the input rejects. **A dropzone listing a format the
input refuses sends the user to a dead end** — exactly what the fence exists to prevent.

> *"we have a lot of things that we can show but it is hidden and buried."*

**Measured against the live schema and a walk of `frontend/src` — and true. Six columns are written
for every document and reach no screen at all:**

| stored today | shown? | what it would give the user |
|---|---|---|
| `documents.full_markdown` | ⛔ **zero non-test frontend refs** | ⭐ the whole parsed text of every file — the reference's Content Viewer, with no new extraction |
| `document_tables.headers` + `.rows` | count only | the extracted tables **as tables** |
| `document_images.description` | count only | a written description of every figure |
| `documents.extractor` | ⛔ never | which engine parsed this file — the first thing you want when an extraction looks wrong |
| `document_chunks.embedding_model` | ⛔ never | which chunks are still on the old model mid-re-embed |
| the recorded question text | aggregate only | ⭐ **the actual questions that found this document** |

⚠ **None of this needs a migration, an extraction pass, or a provider call.** It is a rendering gap
over data that already exists — the cheapest richness anywhere in this redesign, and what makes the
document detail deeper than the reference's.

### ⚠ The fence proving the `full_markdown` claim had to be rewritten, and that is itself a finding

Its first version shelled out to `grep -rl`, which printed *"The system cannot find the path
specified"* on this box and returned an empty list — so the assertion **passed vacuously,
manufacturing the very finding it was meant to verify**. It now walks the tree in JS and carries
**two positive controls**: the walker must find 200+ files, and it must find a column that *is*
surfaced (`table_count`). A fence that reports "zero references" because its own search failed is
worse than no fence.

---

## 7 · What this sketch does NOT settle

- **Whether `Retrieval Score` survives, and in which arm** — drawn both ways, operator's call.
- **The `Views` fork** — that is the question above.
- **Pixel spacing, Tailwind class choices, hover/focus states.** Those stay a human comparison, which
  is why a G-4 row must name this file as its reference and be driven **by looking**.
- **Whether `retrieval_events` is worth a table at all.** The brief measures that the two missing
  facts are keys on an existing jsonb column; a per-query-grain table is a separate, larger question.

---

## ⭐ DECIDED — variant A, the operator, 2026-08-28

> *"First I would prefer A."*

**The five-tab set ships:** `Documents · Views · Ingestion · Indexing · Health`.

⚠ **This overrides the recommendation in §1, and the reasoning there stays on the page rather than
being deleted.** The sketch argued for B on the grounds that `Views` has no content of its own — the
sidebar beside it already renders the whole `ViewsGroup`. That argument is not withdrawn; it is
**outvoted**, and it becomes a *build constraint* rather than a rejected idea:

> **Whoever builds tab 2 must decide where the selection state lives.** With Views in both the
> sidebar and a tab, selecting a view in one place and not the other is the defect this creates.
> **One source of truth, two renderings** — never two states.

**Still owed by the operator:** the `Retrieval Score` ruling (§3 of the Health tab — bare as it ships,
or qualified with what it measures). It is a small call and it does not block planning.

---

## 9 · ⭐ Connected sources — cloud storage, in scope as of 2026-08-28

> *"we need to have connectors with the cloud storage, to and from, based on a specific event or
> trigger… somewhere I remember we discussed this for this milestone."*

You did — it is **SEED-142**, planted 2026-08-08. The **sources** tab designs it.

### ⚠ SEED-142 lists five blockers for drive auto-ingest. FOUR HAVE SINCE SHIPPED.

| what auto-ingest needs | state | where |
|---|---|---|
| a scheduler | ✅ **shipped** | `scheduler_service.py` + `workflow_schedules` (cron / interval / timezone / budgets). ⚠ the seed still says *"a scheduler (none exists)"* |
| OAuth | ✅ **this milestone** | Phase **215 · BYO OAuth** |
| a read capability | ✅ **shipped** | v3.8's MCP client — per-tool consent, zero per-vendor adapter code |
| per-tool grants | ✅ **this milestone** | v3.9's whole thesis: a connection is rows, not code |
| per-file dedupe | ✅ **shipped** | `content_hash` + `version_number` / `is_latest` |
| **change detection** | ⛔ **missing** | the real gap — until it exists the schedule polls |
| **external folder → our folder mapping** | ⛔ missing | net-new config |

**The seed's verdict — *"nothing about that is buildable"* — is out of date.** A planner reading it
today would defer work that is now mostly substrate we already have. That measurement needs writing
back into the seed.

⚠ **And it fires a standing rule.** `CLAUDE.md` still reads *"Ingestion is manual file upload only"*,
marked **dated, not permanent**, with the instruction that whoever ships the first sync connector
changes it **in the same commit**. This design is that trigger.

### The four honesty rules the screen encodes

1. **"Checked every 15 minutes", never "instantly".** There is no change feed and no webhook. When a
   delta cursor lands, the sentence changes in the same commit.
2. **A dry run before the first import.** Manual upload is self-limiting — a person picks the files.
   A drive can put thousands of documents into the thing the agent answers from. The three arms
   (*will be added / already here / type not supported*) are all real; "already here" is a
   content-hash lookup, not a guess.
3. **A file removed from the drive is NOT removed from the Library** unless asked for explicitly. A
   revoked share would otherwise silently delete knowledge the agent depends on.
4. **"Connect a source" leaves for Settings › Connections.** No credential is collected on an
   ingestion screen — the same rule that kept the describe door from growing one.

⭐ **Two-way is a grant, not a feature.** The operator's *"to and from"* is the write row switched on
by a person. It inherits the per-tool approval model rather than inventing one, and **defaults off**.

---

## 10 · ⭐ Why the charts were one colour, and what changed

> *"why is it one color? maybe it's better to have it colored — your advice"*

**The advice: don't make it colourful, give the colour a job.** One colour for one series is correct;
thirty bars of one measurement in thirty colours invites a reader to hunt for meaning that is not
there — the same failure as the reference's *"Embedding Quality 92%"*.

**But there was a second dimension sitting unused in the data, and it is the best one in the product:**
every search already writes the documents it returned, and a search that found *nothing* writes an
empty list. So every bar now splits:

- **found something** (primary) · **found nothing** (warning)

That surfaces the single most important RAG fact there is — **how often the agent asked your library a
question and came back empty** — with no new schema and no new write. The ring's remainder is likewise
a real state (*137 never found*), not empty track, and the per-document bars carry each document's
state (ready / re-indexing / stale).

⚠ **Colour still never carries alone.** Every swatch prints its word and its count.

---

## 11 · ⚠ Three more fences that could not fire, all found the same way

This suite has now caught **three** vacuous or mis-targeted fences, and the pattern is consistent
enough to be worth naming: **a fence whose failure mode is indistinguishable from its success.**

| fence | how it was broken | how it was found |
|---|---|---|
| the buried-column check | shelled out to `grep`, which failed on this box and returned empty — so it *manufactured* the finding it was meant to verify | rewritten to walk the tree, behind two positive controls |
| `E1c` (SEED-142 staleness) | read `src(guess1) \|\| src(guess2) \|\| "none exists"` — **both filenames were wrong**, so it passed on its own fallback string | resolves the seed by glob, with a control asserting the file exists |
| `E6b` (the write grant) | a 220-char window regex across repeated rows **matched the next row's answer** — flipping the write grant to *Allowed* left it green | parses each grant row individually; a control prints what it parsed |

⚠ **`E6b` is the one that matters.** It is the most security-bearing assertion in the connector
design — *a write grant must never default to on* — and it silently passed its own planted defect.
**Every one of the three was found by planting the defect, never by reading the code.**

---

## 12 · ⭐ Governance merges in too — and it brings a collision with it

> *"we have one page which has three rows only, which is Governance, and I believe the best place
> is to merge this page also with the Library space — do you agree?"*

**Agreed, and the evidence is stronger than the row count:**

- its own heading is literally **"Document Governance"**
- all three signals are document signals — broken document relationships, unclassified documents,
  low-confidence document metadata
- its own docblock calls it *"Library Health, three different lists"*
- **every row already links out into the `DocumentDetailPanel` the Library owns**, and the page
  never mutates anything itself

**It is a filtered view of the Library wearing its own nav icon.**

### ⚠ The collision it brings, which would have shipped silently

| | shipped label | what it actually measures | threshold |
|---|---|---|---|
| Library Health | *Low Confidence* | average **retrieval similarity** | **0.38** |
| Governance | *Low-confidence metadata* | an **extracted field's** confidence | **0.5** |

**Two measurements, two thresholds, one pair of words** — and the merge puts them adjacent in the
same filter row. Renamed to **Weak matches** and **Unsure metadata**: plain words, neither printing
its mechanism.

⚠ **A verbatim fence could not have allowed this.** `A9c` asserted the four shipped tab names
appeared exactly, and fired the moment three were renamed — **a verbatim check cannot tell a rename
from a loss.** The rename now lives in `COPY.SIGNAL_RENAMES`, and the fence proves the map is
**total**: every shipped signal mapped, every target rendered. Dropping one fails; renaming one is
allowed and auditable.

### ⚠ And the merge must carry a permission, not just a list

The Governance nav entry is **feature-gated** (`governance_health`); the Documents entry is
**ungoverned and always visible**. Folding gated signals into an ungated tab **shows them to people
the map currently hides them from**. The gate moves to the merged chips or the tab — it does not
evaporate with the nav row. **A merge that drops a permission is a leak, not a tidy-up.**

### The nav arithmetic

Two document-scoped homes retire into the Library — **eight primary nav entries become six**.

⚠ **Classification is deliberately NOT folded in.** It is a different kind of surface — *rules
authoring*, not a view of documents — so it is not obviously the same merge, and folding it unasked
would be the scope creep this project's guardrails exist to stop. **It is named as an open question
rather than left silent.**

### Seven chips, two groups

A flat row of seven is a filter bar nobody reads, so they split on the question they answer:

- **Being used** — Most found · Never found · Weak matches
- **In good shape** — Stale · Unclassified · Broken links · Unsure metadata
