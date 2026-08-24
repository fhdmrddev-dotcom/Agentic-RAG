# Forward-check — what is already planned, and what the sketch must reserve room for

Swept 2026-08-19 across `.planning/ROADMAP.md`, all 45 `SEED-*.md`, `REQUIREMENTS.md`, the shipped
`PHASE_GLYPHS` map and `icon-convention.md`. The point is to design ONCE for decisions that are
already taken or already scheduled, instead of redrawing when they land.

---

## ⭐ THE HEADLINE FINDING — connections are ALREADY in the node vocabulary

`PHASE_GLYPHS` in `soulData.ts` ships **seven** keys, and one of them is not an AI step at all:

```
programmatic · llm_single · llm_agent · llm_batch_agents · llm_human_input · llm_emit · external_action
```

**`external_action` already exists as a first-class node kind.** So a step that calls Slack, Drive
or Jira is not a future bolt-on to be squeezed in later — the vocabulary reserved a seat for it
before this sketch started. **Any node sheet that omits it is already out of date on the day it is
drawn.**

⚠ **And the icon rule for it is already decided, in writing.** `icon-convention.md` §1:

> *"Every surface that shows a provider or model renders the SAME `@lobehub/icons` mark for that
> provider — **never hand-drawn, never approximated, never per-surface.**"*

So a connection node shows **Slack's own mark, Google Drive's own mark, Jira's own mark**, from the
one installed package, through the existing `providerLogo.tsx` seam. Drawing a generic plug or link
glyph for an integration would break a rule the codebase already enforces for model providers.

⚠ **A real gap found while checking:** the backend ships `llm_judge_rubric` as a phase type, and
**`PHASE_GLYPHS` has no key for it.** Seven glyphs, but the backend has a type none of them covers.
Worth naming now rather than discovering it when a judge step first renders on a canvas.

---

## Decisions already taken that the drawing must respect

| Decision | Where | What it means for the sketch |
|---|---|---|
| **The spine is LINEAR by design** | ROADMAP deferred table | A fan-out router is a **decision to revisit**, not a feature to draw. §10 draws it dashed and tagged `NOT BUILT`. Correct as-is. |
| **Connections are PROVIDER-shaped, not action-shaped** | `SEED-144` | One Slack *account*, then many capabilities under it. Never a separate connection per action. |
| **Connections are PLATFORM assets, not workflow assets** | `SEED-145` | The same connection is usable in **chat AND workflows**. So it appears in the step panel *and* has a home outside the builder. |
| **EVERY connector capability is a WRITE** | `SEED-146` | Any connection control must carry the graded-action treatment — arming, consequence, receipt. Never a bare toggle. |
| **Brand marks from `@lobehub/icons`, single-sourced** | `icon-convention.md` §1 | Real application marks, never invented ones. |
| **Manual upload only — but DATED** | `CLAUDE.md` | `SEED-142` says a connected drive should auto-ingest. The upload surface should not be drawn as though upload is the *only* way in forever. |

---

## Scheduled work that will change surfaces we have drawn

| # | Seed / phase | What lands | Which drawn screen it changes |
|---|---|---|---|
| 1 | **`SEED-185` — no router, 12 views, zero addressable URLs** | client-side routing | **Every screen.** Today nothing is linkable and a reload loses your place (`SEED-178`). When routing lands, screens gain real back/forward and deep links. ⚠ **Decide now:** the sketch currently draws `← Workflows` as the only way back, which matches today. That is the honest choice — but it means the sketch has no opinion on breadcrumbs, and it should say so rather than imply none are wanted. |
| 2 | **`SEED-151` — Projects become a real container** | files + instructions + their own chats | The library's `Project` select is a **filter** today. If projects become containers, that control stops being a filter and becomes navigation. The library sketch should not over-invest in the select as a filter chrome. |
| 3 | **`SEED-167` — incremental / stateful runs** | a run reads its OWN last output | The step panel needs a place to say *"start from what last time produced"*, and the run surface needs to show what carried forward. Neither is drawn. ⚠ Measured: zero occurrences of `previous_run`/`last_run_output` in the harness — this is genuinely absent, not hidden. |
| 4 | **`SEED-152` — confidence on phase outputs** | a confidence signal per phase | Chat messages already carry three confidence signals; workflow phase outputs carry none. If it lands, every step row on the run surface gains an atom. Leave room on that row. |
| 5 | **`SEED-164` + `BUG-260815-01`** | a human step that can actually be published | ⚠ **Today the publish gate REFUSES `llm_human_input` outright.** So §10 and the spine draw a human step that **cannot currently ship**. That is worth drawing — it is the target — but the publish sketch should not imply the gauntlet passes one today. |
| 6 | **`BUG-260816-06`** | unanswered human step must stop, not approve | ⚠ **An unanswered human step TIMES OUT INTO A SILENT APPROVAL** after 300 s — measured on **four of five real runs**. Any human-gate drawing that implies "it waits for you" is drawing the intent, not the behaviour. |
| 7 | **`SEED-181` — which skills are active in a thread** | per-thread skill visibility | A chat-surface atom; not in this journey, but the workspace panel is the cross-surface shell where it would land. |
| 8 | **`SEED-183` — draft configuration vanishes on navigate-away** | draft config persists | The draft-arrival screen (§9) shows a configuration surface. Today that surface **disappears** the moment you navigate away. |
| 9 | **`SEED-159` — an unfound field renders a silent blank** | explicit "we looked and found nothing" | Already honoured by our honesty rules (`Not recorded` / `time unknown`). ✅ No change needed — recorded so it is not re-litigated. |
| 10 | **`SEED-184` — information dumped as text, not presented** | — | **This is the seed this entire sketch exists to close.** Recorded so the link is explicit. |

---

## What to add to the Stitch pack because of this sweep

1. **§ 10 must gain two node kinds** — `external_action` (with a real brand mark) and the judge
   step. Six was already wrong; the shipped map has seven, and the backend has an eighth type with
   no glyph at all.
2. **§ 13 — the connection surfaces** (new): the connections list, one provider's detail with its
   capabilities, the graded arming of a write, and how a connection appears inside a step's
   "what it can reach".
3. **No change** to §§ 1–9, 11, 12. They were checked against every item above and none of them is
   invalidated — the forward work *adds* atoms rather than contradicting what is drawn.

---

## Deliberately NOT designed for now, with the reason

- **Scheduling / automations** (`SEED-014`) — the product cannot schedule anything, and `SEED-167`
  says a scheduler over stateless runs produces disconnected reports anyway. Drawing a schedule
  control would promise a feature whose prerequisite is unbuilt. Already banned in § 9's prompt.
- **Branching / looping** — a recorded linear commitment. Drawn once, dashed, tagged `NOT BUILT`.
- **In-app document editing** (`SEED-161`) — explicitly out of milestone.
- **Self-hosted inference as a deployment mode** (`SEED-173`) — no surface in this journey.
