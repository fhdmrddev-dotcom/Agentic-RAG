# Sketch 227 — The paused queue and its refusal

**Phase:** 230 (The Durable Ingestion Queue) · **Requirement:** `QUEUE-05` / SC#3
**Date:** 2026-09-05 · **Status:** ✅ LOCKED · **Winner: B — the batch lane** (operator, 2026-09-05)
**Closes:** `BUG-260815-05` (a 429 surfacing as *"your documents returned nothing"*)

Open `index.html` (served over http — `file://` is blocked in the driven browser) and press
**▶ Run the outage**. The batch runs, OpenAI rate-limits at file 218, the queue pauses and names the
provider, a countdown ticks, and it resumes on its own and finishes.

## Why this sketch exists

Phase 230's G-2 gate fired: the paused state and the named refusal are user-visible, so they need an
operator-approved mockup before `230-05` is planned. Gemini requested it on `BUS-110`.

⭐ **Operator direction, 2026-09-05:** *"consider to add 3D animation and engaging content in line with
our theme — it should indicate visually more because our design currently is very static and boring."*
So this sketch follows the **Phase 127 precedent** — energized is the default, with a **calm anchor kept
as an in-sketch toggle** so we can feel exactly what the motion buys. Every variant works at
`--energy: 0`.

## The three variants

| | Variant | The idea | Cost |
|---|---|---|---|
| **A** | **The provider orb** | The provider is a physical object: a 3D-lit sphere that breathes while embedding, **holds its breath** (amber, slower, slightly contracted) when rate-limited, and settles green when done. The refusal grows out of it. | One more thing on screen; the orb must never imply a percentage it doesn't know. |
| **B** ⭐ **WINNER** | **The batch lane** | Every ~10 files is a bar. You watch the wave move and see **exactly where it stopped** — the held amber column is the file the provider refused. | Reads as a chart; at 3,000 files the bars stop being individually meaningful. |
| **C** | **The quiet strip** | The calm anchor: one line while working, and the refusal is the only thing that ever raises its voice. | Honest but, at rest, it is a spinner with a number — the thing the operator called static. |

## ⭐ LOCKED: variant B, with two corrections and one open decision

**Operator picked B (the batch lane), 2026-09-05**, after asking the right question — *does this
contradict what we already built for the Library and document ingestion?* It does not, but the audit
that answered it produced two binding corrections.

### ✅ It has a home that ALREADY EXISTS — this is not a new surface

**Library → Ingestion tab → `In progress` sub-tab.** Measured at `LibraryPage.tsx:690-694` and
`IngestionTab.tsx:128-131`, the shipped structure is:

| Tab / sub-tab | Holds today |
|---|---|
| Ingestion › **Add files** | the `DocumentUpload` hero dropzone |
| Ingestion › **In progress** | docs at `pending` / `processing`, showing `ingestion_step` (`:109`) |
| Ingestion › **Needs attention** | docs at `failed` (`:118`) |
| Ingestion › **History** | `completed` + `failed` (`:116`) |
| **Indexing** (separate tab) | embedding model + `ReembedStatusCard` — ⛔ **not this phase's concern** |

B's lane goes **above the rows already in `In progress`**. It re-visualises a list that exists; it
does not add a surface. The refusal banner sits at the top of that sub-tab.

### ⛔ CORRECTION 1 — the ETA is CUT (it violated a shipped decision)

The first draft of this sketch showed *"about 7 min left."* That contradicts **D-217-19**, written into
`DocumentUpload.tsx`:

> *"⛔ NO PERCENTAGE AND NO ETA — MEASURED, not preferred: `uploadDocument` is a plain `fetch` with
> `FormData` and there is no `onUploadProgress` … so bytes-sent is not observable and any percentage
> would be invented."*

**Removed from the sketch.** ⭐ **But the distinction that survives is the load-bearing part:**

- **Upload** = bytes over the wire → **not observable** → no percentage, no ETA. D-217-19 stands untouched.
- **The ingestion QUEUE** = discrete `ingestion_jobs` rows, each `pending`/`processing`/`completed`
  → **countable**. *"218 of 340 files"* is a real count of real rows, not an extrapolation.

So a determinate bar over **files** is honest; a **time estimate** is not. Same rule, correctly scoped.

### ❓ OPEN DECISION — does a paused batch show in `In progress` or `Needs attention`?

Genuinely undecided and it must not be picked silently by the plan. The work is **not failed** (it
resumes itself), so **`In progress`** is the reviewer's recommendation — *"Needs attention"* implies you
must act, and the refusal's own closing line is **"nothing for you to do."** Decide at `230-05`.

## Honesty rules the surface is built on

- The refusal **names the provider and the status** (`openai · 429 insufficient_quota`) and shows the
  provider's **own words verbatim** in a mono block.
- **The finished count is real and preserved** — *"218 of 340 files are already added and stay added.
  The remaining 122 are queued, not lost."* Nothing is re-embedded (SC#4's resume).
- The retry is a **countdown, never a fake percent**, and says **"nothing for you to do."**
- ⛔ Never *"your documents returned nothing"* — rendered in-sketch as a red "what this replaces" note
  so the old behaviour stays visible next to the new one.
- ⛔ **Never a silent swap to another provider.** D-2: `document_chunks.embedding` is `vector(N)` with
  one global `N`, and matching the dimension does not make vector **spaces** compatible.

## Motion inventory (all respect `prefers-reduced-motion`)

`orbFloat` 6s 3D drift · `orbHeld` 3.4s contracted breath (paused) · `ringPulse` 2.4s expanding rings ·
`comet` 1.7s energy sweep along the determinate bar (059-A lineage) · `laneRise` 1.1s active-column
rise · `dotBounce` 1.4s retry dots · `brandPulse` 1.5s live file dot · `fadeSlideUp` 0.34s refusal
entrance. The comet and rings are the only purely decorative motion, and both are gated on `--energy`.

## Verified before handoff

Driven in Chrome, not just written: the simulation runs, pauses at 218/340, renders the refusal with a
live countdown, resumes and completes. **Zero console errors.** (The `feedback_verify_sketch_js_before_handoff`
rule.)

## Open questions for the operator

1. **Which variant** — or A's orb on B's lane?
2. **Where does this live?** The sketch draws it as a card on the Library/ingestion surface. It could
   also be a slim always-visible strip. `SURF-03` (Phase 235) notes this product has **no in-app
   notification surface at all**, so a paused queue is currently only discoverable by opening the page.
3. **Is the orb honest at scale?** It carries no percentage of its own — the bar does. Confirm that
   separation is right before it is built.
