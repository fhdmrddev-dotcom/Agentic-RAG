---
sketch: 016
name: output-files-hero
question: "At run end, how does the output area hero the deliverable the user asked for while keeping intermediates present-but-quiet and every link downloadable?"
winner: "A — Hero block + working group (working files visible-but-quiet by default)"
tags: [chat, output-files, hero, download, phase-095, D-07, D-08]
---

> **Winner: A — Hero block.** A big, unmissable "★ Your file" card for the deliverable + a quieter
> "Working files (N)" group. Per operator direction the working group **defaults open** (visible but
> secondary) to honor "show all files," with the collapse affordance retained. File-type icons are
> **per-extension color badges** (PPTX/PNG/MD/PDF/DOCX…) — one shared `fileIcon()` system reused by
> sketches 014 + 015 too.

# Sketch 016: Output Files — Hero / Working Split

## Design Question

D-07 (operator's verbatim intent): *"show all files that all agents generated… if the user asked
for docx, show clearly the final completed output the user asked for… there's nothing wrong with
showing all the files and making them always work, but the focus should be on the final intended
output to make it easier for the user."* Plus D-08: every link downloads — **even on a chat reopened
tomorrow** (the agent flags the final output; links are re-signed on demand). This sketch locks how
the **hero deliverable vs the quieter working files** renders, and proves the always-downloadable
guarantee against today's flat-list-with-dead-links.

Grounded by `095-SKETCH-GROUNDING.md` (Cluster C + the `final_output_files` / OutputFileCard reality).

## How to View

open .planning/sketches/016-output-files-hero/index.html

- **095 · hero / working** vs **Today · flat list** — toggle the view to contrast 095's hero/working split against today's flat, index-ordered list (no hero, no hierarchy).
- **🕐 Reopen this chat tomorrow** — in Today mode, watch two links (incl. the .pptx you asked for) go **✗ 404 · link expired**; in 095 mode every link still downloads (re-signed). This is BUG-260514-01 + the dead-link complaint, fixed.
- **⤓ Download** — click any file; it shows a ✓ Downloaded success state.

## Variants

- **A: Hero block + working group** — the deliverable is a big, unmissable "★ Your file" card with a prominent Download; intermediates fold into a quiet, collapsible "Working files (3)" group. Strongest hero/secondary hierarchy.
- **B: One list, starred hero** — a single list; the hero row is larger/starred/accented at the top, working files dimmed below. Lightest, everything visible at once; hero is less dominant.
- **C: Hero card + chip row** — the hero gets the full card; working files compress to a quiet horizontal chip row (one click each). Most compact; chips carry less metadata.

## What to Look For

- **Hero clarity (D-07):** can you instantly tell which file you asked for (the .pptx) vs the scratch charts? Is the hero unmissable without hiding the rest?
- **Present-but-secondary:** are the working files clearly available but visually quieter — not a flat pile, not hidden?
- **Always works (D-08):** flip Today + Reopen tomorrow — the dead `.pptx` is the whole point. 095 must keep every link alive on reopen.
- **Calm vs density:** A is the strongest hierarchy (two tiers), B the flattest (one list), C the most compact (chips). Which matches "calm instrument, focus on the deliverable"?

---

## Build Handover — reuse vs net-new (for a 100% match)

Line anchors from `095-SKETCH-GROUNDING.md §3` — re-confirm at plan-phase.

### ✅ Already in the code — reuse
| Asset | Where (verify) | How A uses it |
|---|---|---|
| `OutputFileCard` (filename + Download + size badge + `Replaces:` subline) | `OutputFileCard.tsx:130–143` | the working-file row + the hero card base |
| `resolveOutputUrl` (relative `/` → `API_BASE`, else passthrough) | `OutputFileCard.tsx:14–22` | URL resolution — keep |
| Bearer-token download intercept (`downloadSandboxOutput` → `<a download>`) | `OutputFileCard.tsx:88–107` | the always-works click path |
| `final_output_files` SSE (cumulative, full-replace onto `message.finalOutputFiles`) | `StreamsProvider:620–623` | the data source for the whole area |
| Final-outputs mount (flat `space-y-1.5` list) | `MessageItem.tsx:506–527` | the mount point — replace the flat map with hero+working render |

### 🔨 Net-new for 100% match
| Need | D | What's missing today | Where it lands |
|---|---|---|---|
| **Hero vs working split** | D-07 | flat index-ordered list, no hierarchy (`MessageItem.tsx:506–527`) | render the agent-flagged final output as a hero block; the rest as a visible-but-quiet "Working files" group |
| **Agent flags the final deliverable** | D-08 | no `final`/role field on the `final_output_files` payload today | a small backend tag per file (the agent knows intent) — render as "agent-flagged final output"; **exact field name = planning/backend decision (verify)** |
| **Per-extension file-type icon** (`fileIcon`/`iconFor`) | D-07 | one generic gradient icon for every file | extension→badge map (PPTX/PNG/MD/PDF/DOCX/CSV/JSON…); **shared with the 014/015 chat file cards** — build once |
| **Always-downloadable on reopen** | D-08 | dead links on reopen: signed-URL 1h TTL / sandbox cleanup / `url`-missing files render with no affordance (`OutputFileCard.tsx:72–86`) | **investigate-first** the exact dead-link root, then re-sign on demand (the contained backend touch); guarantee every final output carries a working `url` |

### ↪ Out of scope
- The run frame + per-tool essence (**014**) and the status strip/scroll (**015**). 016 is the file-area surface only.
