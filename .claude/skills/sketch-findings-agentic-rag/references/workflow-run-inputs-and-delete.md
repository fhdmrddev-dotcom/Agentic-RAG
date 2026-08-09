# Workflow Run Inputs & Safe Delete (Phase 152)

Two net-new UI calls on the workflow lifecycle: the **Run modal** gains a real run-input channel (a template file + an editable retrieval scope), and **deleting** a published workflow becomes a victim-naming cascade with no orphaned runs/threads. Both extend LIVE surfaces (`RunModal` in `WorkflowsPage.tsx:719`, the `⋯`-menu on the workflow card), not greenfield.

## Design Decisions

### D1 — Run inputs = inline-grows, keep the 560px dialog (072 winner A)
The two new controls fold into the existing calm 560px Run modal **without turning it into a form** (the "3-second read at rest" bar): the read-only KB chip becomes an **inline `<select>`** (mirrors chat's "All documents / folder" selector), the template upload is a **quiet `TemplateUpload`-style button**. Smallest diff, lowest risk, closest to what ships today.

- **Won over B (3-way segmented scope toggle + drag-drop dropzone):** more expressive/legible but more vertical weight — the toggle's `[ All documents | 📁 folder (default) | Pick a folder… ]` was the SEED-112 / Perplexity reference, kept as the documented alternative if the plain dropdown reads ambiguous.
- **Won over C (2-step wizard / panel-docked inputs):** hides depth behind a step; overkill for two controls.

### D2 — The SEED-112 scope-shape decision = a per-run OVERRIDE over the author default, server-enforced (072)
Every variant marks the workflow's bound folder as the **workflow default** and the per-run choice as an **override** — and the override is **narrow-only, server-enforced** (the Phase-098 resolver; the model can't widen it). The scope control's *shape* (dropdown A vs segmented toggle B) is the choice the sketch surfaces; the *semantics* (default + bounded override, never a prompt hint) are locked.

### D3 — Template-input provenance is an honest note, not a new claim (072, WFIN-01 threat model)
The uploaded template (`kind=template_input`, reusing Phase-100 `upload_template`) carries a **"stored untrusted — never run as code / never fed to the fill engine"** note — the Phase-100/151 threat boundary rendered as reassurance, right-weighted (not noisy). Upload states are real: validating → validated file card (✓, remove); a rejected file (422) shows an **inline error**.

### D4 — Delete = victim-naming confirm sheet (073 winner A)
Deleting a published workflow reuses the operator **victim-naming sheet** vocabulary (shipped in 064 Kill-run / 068 disable-user): a calm confirm naming two explicit groups — **Permanently removed** (definition · N versions · N run records) and **Kept — not touched** (the chat threads become normal chats; KB & folders untouched) — one danger button, a **"✎ recorded with your name"** footer. The cascade disposition IS the core content (WFIN-03: "no orphaned runs or threads"), not decoration.

- **Won over B (type-to-confirm):** highest friction, best against accidental delete of a heavily-used workflow — kept as the documented high-guard alternative.
- **Won over C (Archive vs Delete two-door):** reframes the primary verb toward a reversible Archive; kept as an option **only if discuss picks soft-archive over hard-delete**.

### D5 — The load-bearing reassurance line (073, WFIN-03)
**"The N chat threads become normal chats — transcripts & files stay."** Delete detaches-but-keeps the threads (clears `active_workflow_run_id`, keeps the thread) — the honest answer to "what happens to my conversations." The proposed disposition (versions + run records hard-deleted; threads detached-but-kept) is what the sketch puts on screen for the discuss-phase to lock.

### D6 — In-flight edge = cancel-then-delete, the zombie-heal honesty (073)
When a run is streaming right now, an amber banner ("cancel it first via the safe heal path, then delete") mirrors 064's `cancel_run` / zombie-heal honesty — never a silent delete of a live run.

## What to Avoid

- **Turning the Run modal into a form** — two new controls must still read in one glance; inline-grow, don't wizard (D1).
- **A per-run scope that can WIDEN the author default** — the override is narrow-only and server-enforced; the model never widens retrieval via a prompt hint (D2).
- **Claiming the template is safe/executed** — it's stored untrusted, never Jinja-fed; say so honestly (D3).
- **A bare "Delete?" confirm** — an action with downstream victims must name removed-vs-kept explicitly (D4/D5).
- **Orphaning threads or runs on delete** — threads detach-but-keep and become normal chats; that line is load-bearing (D5).
- **Deleting a workflow with a live run** — cancel-then-delete via the heal path (D6).

## Origin

Synthesized from sketches **072-run-inputs-modal** (winner A — inline-grows: chip→`<select>` + quiet upload) and **073-workflow-delete-cascade** (winner A — victim-naming sheet). Source files: `sources/072-run-inputs-modal/`, `sources/073-workflow-delete-cascade/`. Session 2026-07-14 (Phase 152, WFIN-01/02/03). Reuses the 064/068 victim-naming confirm-sheet + audit-recorded pattern, the Phase-098 scope resolver, and the Phase-100 `template_input` upload. SEED-112 scope-shape settled here (bounded per-run override).
