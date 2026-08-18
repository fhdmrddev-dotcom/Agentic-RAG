# STITCH BRIEF — regenerate the whole workflow surface, to see what it could be

**Written 2026-08-18** as a session handoff, and kept afterwards as the standing brief for using the
Google Stitch MCP on this project.

---

## 0. THE FIRST THING TO DO — do not skip it

The `stitch` MCP server is registered and healthy (`claude mcp list` → `✔ Connected`), but **nobody
has inspected what it exposes.** Before writing a single prompt to it:

```
ToolSearch "+stitch"        → enumerate every mcp__stitch__* tool
```

Read the tool schemas. **Do not guess the tool surface, do not assume it behaves like a
text-to-image API, and do not burn calls discovering the interface by trial.** Report what it can
actually do before using it.

If `+stitch` returns nothing, the session predates the server registration → restart Claude Code.

---

## 1. THE OPERATOR'S ASK, VERBATIM

> "I want to connect you through MCP to Google Stitch, use it to inspire all redesigns — not only
> for this page but for the whole workflow components."

and, on being asked to choose between three drawn directions first:

> "no I don't want to select now — let's use the new MCP to see how we can regenerate not only this
> page but everything, just to see how it could look like."

⚠ **THAT IS A DELIBERATE SEQUENCING DECISION AND IT MUST BE HONOURED: explore broadly FIRST, decide
after.** Sketch 176's A/B/C question is **deliberately left open**. Do not re-ask the operator to
pick a variant before showing them what Stitch produces. Their answer is *"show me the range."*

---

## 2. WHAT STITCH IS FOR HERE — and the trap it makes easier to fall into

Stitch output is **DIRECTION**: composition, hierarchy, how colour behaves, rhythm, motion, the
overall feeling. It is **NOT an acceptance bar** and must never be handed to a build phase as one.

⚠ **`SEED-155` is this project's most expensive design lesson and it applies double here.** An
approved sketch (163) drew a card the shipped components **structurally could not render**, because
the sketch hand-drew a surface that consumes existing components. Four complaints, three phases, one
seed. **A generative design tool makes that failure mode EASIER to hit, not harder** — it will
happily produce something beautiful and unbuildable.

**So the loop is:**

1. Stitch generates direction, freely, unconstrained by our components.
2. A human (the operator) reacts to the range.
3. **Then** the chosen direction is RE-EXPRESSED against the components that actually ship, in a
   normal sketch under `.planning/sketches/`, rendering real components rather than redrawing them.
4. Only that re-expressed sketch becomes an acceptance bar.

Never collapse steps 1 and 4.

---

## 3. NON-NEGOTIABLE CONSTRAINTS TO FEED STITCH

Give it these as input. Output that ignores them is inspiration, not a proposal.

**Design system**
- Aether Intelligence, **Deep Midnight** theme. Dark-first.
- Live tokens: `frontend/src/index.css` (`.dark`), mirrored for sketches in
  `.planning/sketches/themes/default.css`. **No new hex** in anything that comes back into a sketch.
- Icon convention is single-source: provider/model icons from `@lobehub/icons`; phase-type icons from
  the shared `PHASE_GLYPHS` map. See the `sketch-findings-agentic-rag` skill →
  `references/icon-convention.md` §4.

**Direction, confirmed twice by the operator**
- **CALM.** *"I like the idea of calm, for sure I'm desiring for calm."*
- Progressive disclosure: the one line that decides whether you care; the rest opens on demand.
- Colour must **carry meaning**, and must **never be the only carrier** — every state also says its
  word, so a colour-blind reader loses nothing.
- The existing MANIFEST direction still holds: *"calm instrument with selective signal-density at the
  live moment."*

**Two measurements that have already killed ideas — feed them in, they change the design**
- `285 workflow rows · 39 distinct names · 93% of rows carry a REPEATED name` (live DB, 2026-08-18;
  `84x Global WF` and `84x Preview WF` are test data). **The name cannot be the differentiator.**
- `11 of 18 rows are Unbound` (no project). **So project cannot be the differentiator either** —
  this refuted sketch 175's variant A and sketch 176's variant B, both measured, both left standing
  in their READMEs rather than patched away.
- `POST /workflows/generate` is a **one-shot fetch — no streaming, no progress events.** Any
  composing/loading design that shows determinate progress is showing a fabricated number, which
  this project forbids. Elapsed time and character only.

---

## 4. THE SURFACE INVENTORY — "everything", enumerated

The operator said the whole workflow product, not one page. In rough order of how badly each is
felt:

| # | Surface | Where it lives | Why it is on the list |
|---|---|---|---|
| 1 | **Workflows home / library** | `pages/WorkflowsPage.tsx`, `components/workflows/library/*` | *"Honestly I'm still not convinced with this home page."* Card sameness, header alignment, the create button, filter chips, search. `BUG-260815-08` + `SEED-155` + `SEED-184` |
| 2 | **The composing moment** | `WorkflowBuilderPage.tsx:1900`, `WorkflowDoorSwitch.tsx` | `SEED-182` — today it is a greyed-out duplicate of the form you just filled in, with a dead button. The one moment the product's agentic claim is literally true |
| 3 | **The draft configuration surface** | `DraftArrivalCard`, `DecisionsList` | `SEED-183` — vanishes on navigate, taking the ONLY rename control with it |
| 4 | **The two doors** | `WorkflowDoorSwitch.tsx` | describe-vs-build entry; duplicated describe screen |
| 5 | **The Builder canvas + phase spine** | `WorkflowCanvas.tsx`, `PhaseNodeCard.tsx`, `PhaseSpine` | authoring chrome, never given a density pass |
| 6 | **The publish gauntlet** | the 8-stage pip/energy strip | already energized in Phase 127 — check coherence with whatever new language lands |
| 7 | **The workflow run surface** | `WorkflowRunPage.tsx`, the panel's phase spine | where a run is watched; the "live moment" the MANIFEST calls the acceptance bar |

**Prior art to read before generating** — so Stitch is pushed somewhere new rather than re-deriving
what exists: sketches **160–163** (library + card identity), **172–174** (the decisions surface),
**175** (density language, verdict recorded), **176** (the home, three colour semantics).

---

## 5. STATE OF PLAY — what is already decided, so it is not re-litigated

- **Phase 197 (guided-authoring): 11/11 executed and merged, verification `human_needed`,
  NOT marked complete.** 3/3 ROADMAP success criteria verified in code, 0 gaps. Held open only
  because 9 of 11 G-4 UAT rows are owed. See `.planning/phases/197-guided-authoring/197-HUMAN-UAT.md`
  — 6 rows were driven by Claude (4 pass, 2 partial), the rest need the operator's eye.
- **Both code-review findings are FIXED**: CR-01 (the readiness verdict outliving its premise) and
  WR-01 (an empty name blanking the library title).
- **Sketch 175 verdict:** CALM is the direction · variant A (the dense list) REJECTED · B (colour on
  the card) wins · colour SEMANTICS re-opened.
- **Sketch 176: OPEN BY OPERATOR CHOICE.** A/B/C not selected. See §1.
- **`BUG-260815-08`**: `open` → `folded` into sketch 176.
- **Seeds planted 2026-08-18**: `SEED-182` (composing), `SEED-183` (draft config vanishes),
  `SEED-184` (density language), `SEED-185` (no router — twelve views, zero addressable;
  `SEED-178` is cross-linked as its thread-shaped instance).

---

## 6. GUARDRAILS THAT FIRE ON THIS WORK

- **G-2** — every surface here is live UI, so the sketch gate applies: an operator-approved mockup is
  the acceptance bar, before any spec or plan.
- **G-5, and one obligation is UNDISCHARGED** —
  `frontend/src/components/workflows/library/WorkflowCard.tsx` (8 commits / 3 phases / 818 L) is
  **firing with an undischarged refactor obligation**: the next phase touching it owes a refactor
  recommendation FIRST. A written recommendation is already carried in
  `.planning/sketches/175-what-the-eye-lands-on/README.md` — the seam it names is a **presentation
  layer** that decides what a row leads with and what defers, so the three surfaces share ONE
  language instead of three copies. Also firing: `WorkflowsPage.tsx` (34/12/1176),
  `WorkflowBuilderPage.tsx` (47/14/2656).
- **Do not start building.** This is exploration. Nothing here authorises a source edit.

---

## 7. PRACTICAL

View any sketch (Chrome MCP cannot open `file://`):

```bash
cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1
# → http://127.0.0.1:8899/176-the-workflows-home/index.html
```

The local stack, if a surface needs to be seen live: backend `:8000`, frontend `:5173`,
Supabase `:54322` — all were up on 2026-08-18. The operator starts the backend.

⚠ **The Stitch API key was pasted into the 2026-08-18 chat transcript.** It is stored in
`C:\Users\fhdmr\.claude.json` (project-scoped, redacted in CLI output). **Recommend rotating it**
once experimentation settles, and keeping the replacement out of chat.

---

## 8. WHAT "DONE" LOOKS LIKE FOR THE NEXT SESSION

Not a built page. A **range the operator can react to**:

1. What Stitch actually exposes, reported plainly.
2. Generated directions for the surfaces in §4 — breadth first, the home page included but not alone.
3. An honest read of each: what is genuinely new, what is unbuildable against our components, and
   what would cost a refactor to reach.
4. **No decision forced.** The operator asked to see the range. Let them look.
