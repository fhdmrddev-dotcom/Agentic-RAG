---
sketch: 218
name: the-library-and-its-tabs
question: "What is the Library's tab set, and which of the reference redesign's surfaces can this app draw honestly?"
winner: null
tags: [seed-224, bus-026, documents, library-health, retrieval, ingestion, charts, g-2, acceptance-bar]
---

# Sketch 218 — the Library and its tabs

**Written 2026-08-28.** Step 3 of the ratified method: Stitch gave the direction
(`STITCH-BRIEF-218-the-document-space.md`), this re-expresses it **against components that ship**.
⚠ The two are never collapsed — Stitch renders zero shipped components (`SEED-155`).

```
node drive.cjs           # 124 assertions
node drive.cjs --emit    # regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **124 passed, 0 failed.** ⚠ **Thirty-one of them read the LIVE SOURCE TREE**, not the
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
| **A · five tabs** | `Documents · Views · Ingestion · Indexing · Health`. The seed's set. |
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
